import pandas as pd
import datetime
import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

class ReportGenerator:
    @staticmethod
    def export_csv(path, session_data):
        df = pd.DataFrame({
            "timestamp": session_data.history_timestamps,
            "raw_signal": session_data.history_raw_signal,
            "baseline": session_data.history_baseline,
            "blink_threshold": session_data.history_threshold,
            "blink_sequence": session_data.history_blink_sequence,
            "command": session_data.history_telemetry_commands,
            "source": session_data.history_source,
            "raw_line": session_data.history_raw_lines
        })
        df.to_csv(path, index=False)

    @staticmethod
    def _analyze_session(session_data):
        res = {}
        dur = max(1, session_data.get_session_duration())
        raw_list = list(session_data.history_raw_signal)
        base_list = list(session_data.history_baseline)
        cmds = session_data.command_history

        # Basics
        if raw_list:
            avg_raw = sum(raw_list) / len(raw_list)
            min_raw = min(raw_list)
            max_raw = max(raw_list)
            rng = max_raw - min_raw
            drift = abs(base_list[0] - base_list[-1]) if base_list else 0
            
            chunk_size = 50
            max_noise = 0
            for i in range(0, len(raw_list), chunk_size):
                chunk = raw_list[i:i+chunk_size]
                if len(chunk) > 1:
                    c_avg = sum(chunk)/len(chunk)
                    c_noise = (sum((x - c_avg)**2 for x in chunk)/len(chunk))**0.5
                    max_noise = max(max_noise, c_noise)
            
            recent_raw = raw_list[-100:] if len(raw_list) >= 100 else raw_list
            avg_recent = sum(recent_raw) / len(recent_raw)
            noise = (sum((x - avg_recent)**2 for x in recent_raw) / len(recent_raw))**0.5
            
            out_of_bounds = sum(1 for x in raw_list if x < 10 or x > 4085)
            oob_pct = out_of_bounds / len(raw_list)
        else:
            avg_raw = min_raw = max_raw = rng = drift = max_noise = noise = oob_pct = 0

        # Signal Reliability Score (0-100)
        rel = 100 - (min(50, noise) / 50 * 50) - (oob_pct * 100)
        res['signal_reliability'] = max(0, min(100, int(rel)))

        # Electrode Contact Quality
        if rng < 10 or oob_pct > 0.1:
            res['contact_quality'] = "Poor"
        elif rng < 50 or oob_pct > 0.02:
            res['contact_quality'] = "Inconsistent"
        else:
            res['contact_quality'] = "Optimal"

        # Blink Control Reliability & Distribution
        valid_blinks = 0
        total_blinks = session_data.total_blink_sequences
        dist = {"FORWARD": 0, "LEFT": 0, "RIGHT": 0, "BACKWARD": 0, "STOP": 0, "EMERGENCY_STOP": 0}
        
        last_t = -999
        strain_times = []
        rapid_stops = 0

        for t, seq, cmd, src in cmds:
            if cmd in dist:
                dist[cmd] += 1
            if src == "Headband Blink":
                valid_blinks += 1
                if t - last_t > 0 and last_t != -999:
                    strain_times.append(t - last_t)
                last_t = t
            if cmd in ["STOP", "EMERGENCY_STOP"]:
                if t - last_t < 3 and src != "Headband Blink":
                    rapid_stops += 1
        
        if total_blinks > 0:
            res['blink_reliability'] = max(0, min(100, int((valid_blinks / max(1, total_blinks)) * 100)))
        else:
            res['blink_reliability'] = 0

        total_cmds = sum(dist.values())
        res['dist'] = {k: (v/total_cmds*100 if total_cmds > 0 else 0) for k, v in dist.items()}
        res['total_cmds'] = total_cmds

        # Safety Events
        res['safety_events'] = dist.get("EMERGENCY_STOP", 0) + (1 if oob_pct > 0.05 else 0)

        # Worst Signal Warning
        res['worst_signal'] = f"Peak noise of {max_noise:.1f}." + (" Requires recalibration." if max_noise > 150 else " Acceptable.")

        # Baseline Drift Analysis
        drift_rate = (drift / dur) * 60
        res['baseline_drift'] = f"Total: {drift:.1f}, Rate: {drift_rate:.1f}/min"

        # Control Strain Indicator
        if len(strain_times) > 3:
            avg_t = sum(strain_times)/len(strain_times)
            var_t = (sum((x - avg_t)**2 for x in strain_times)/len(strain_times))**0.5
            res['control_strain'] = "High" if var_t > 10 else "Moderate" if var_t > 5 else "Low"
        else:
            res['control_strain'] = "Insufficient Data"

        # Overall Grade
        grade_score = res['signal_reliability'] * 0.4 + res['blink_reliability'] * 0.4 + (100 if res['contact_quality'] == "Optimal" else 50 if res['contact_quality'] == "Inconsistent" else 0) * 0.2
        if grade_score >= 90: res['overall_grade'] = "A"
        elif grade_score >= 80: res['overall_grade'] = "B"
        elif grade_score >= 70: res['overall_grade'] = "C"
        elif grade_score >= 60: res['overall_grade'] = "D"
        else: res['overall_grade'] = "F"

        # Caregiver Recs
        recs = []
        if res['contact_quality'] == "Poor": recs.append("Ensure electrodes are secure.")
        if res['signal_reliability'] < 60: recs.append("High noise detected. Check for interference.")
        if res['control_strain'] == "High": recs.append("User shows erratic timing. Consider shorter sessions.")
        if not recs: recs.append("No immediate action required.")
        res['recommendations'] = " ".join(recs)
        
        return res

    @staticmethod
    def export_pdf(path, session_data, img_path=None, clin_text=""):
        doc = SimpleDocTemplate(path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        story = []
        styles = getSampleStyleSheet()
        
        title_style = styles['Heading1']
        title_style.alignment = 1
        h2_style = styles['Heading2']
        h2_style.textColor = colors.HexColor("#008080")
        h2_style.spaceAfter = 10
        normal_style = styles['Normal']
        
        stats = ReportGenerator._analyze_session(session_data)
        
        # Header
        story.append(Paragraph("NuroSync Clinical EOG Report", title_style))
        story.append(Spacer(1, 15))
        
        dt_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        dur = int(session_data.get_session_duration())
        
        pat_data = [
            ["Patient Name:", session_data.patient_name, "Date:", dt_str],
            ["Age/Gender:", f"{session_data.patient_age} / {session_data.patient_gender}", "Session:", f"{dur}s"],
            ["Overall Grade:", stats['overall_grade'], "Firmware:", "v1.0 Proto"]
        ]
        t_pat = Table(pat_data, colWidths=[100, 150, 100, 150])
        t_pat.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
            ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTNAME', (2,0), (2,-1), 'Helvetica-Bold'),
            ('FONTNAME', (1,2), (1,2), 'Helvetica-Bold'),
            ('TEXTCOLOR', (1,2), (1,2), colors.darkblue),
            ('GRID', (0,0), (-1,-1), 1, colors.lightgrey),
            ('BACKGROUND', (0,0), (0,-1), colors.whitesmoke),
            ('BACKGROUND', (2,0), (2,-1), colors.whitesmoke),
            ('PADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(t_pat)
        story.append(Spacer(1, 15))
        
        # Section 1: Signal Integrity
        story.append(Paragraph("1. Signal Integrity Analytics", h2_style))
        sig_data = [
            ["Signal Reliability:", f"{stats['signal_reliability']}%", "Worst Signal:", stats['worst_signal']],
            ["Contact Quality:", stats['contact_quality'], "Baseline Drift:", stats['baseline_drift']]
        ]
        t_sig = Table(sig_data, colWidths=[120, 130, 100, 150])
        t_sig.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
            ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTNAME', (2,0), (2,-1), 'Helvetica-Bold'),
            ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.lightgrey),
            ('PADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(t_sig)
        story.append(Spacer(1, 15))

        # Section 2: Control & Usability
        story.append(Paragraph("2. Control & Usability", h2_style))
        dist_str = ", ".join([f"{k}:{v:.0f}%" for k, v in stats['dist'].items() if v > 0]) or "None"
        ctl_data = [
            ["Blink Reliability:", f"{stats['blink_reliability']}%", "Control Strain:", stats['control_strain']],
            ["Total Commands:", str(stats['total_cmds']), "Distribution:", dist_str]
        ]
        t_ctl = Table(ctl_data, colWidths=[120, 130, 100, 150])
        t_ctl.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
            ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTNAME', (2,0), (2,-1), 'Helvetica-Bold'),
            ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.lightgrey),
            ('PADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(t_ctl)
        story.append(Spacer(1, 15))

        # Section 3: Safety & Recommendations
        story.append(Paragraph("3. Safety & Caregiver Recommendations", h2_style))
        safe_data = [
            ["Safety Events:", str(stats['safety_events'])],
            ["Recommendations:", stats['recommendations']]
        ]
        t_safe = Table(safe_data, colWidths=[120, 380])
        t_safe.setStyle(TableStyle([
            ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.lightgrey),
            ('PADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(t_safe)
        story.append(Spacer(1, 15))

        # Section 4: Visuals
        story.append(Paragraph("4. Best Signal Snapshot", h2_style))
        if img_path and os.path.exists(img_path):
            try:
                img = RLImage(img_path, width=450, height=135, kind='proportional')
                story.append(img)
                story.append(Spacer(1, 5))
                story.append(Paragraph("Snapshot captures a 5-second optimal window representing the highest signal-to-noise ratio during the session.", normal_style))
            except Exception as e:
                story.append(Paragraph(f"Error loading image: {e}", normal_style))
        else:
            story.append(Paragraph("No image available.", normal_style))
            
        story.append(Spacer(1, 20))
        
        # Clinical Interpretation
        story.append(Paragraph("5. Practical Interpretation", h2_style))
        interp_style = ParagraphStyle(
            name='InterpStyle',
            parent=normal_style,
            fontSize=11,
            leading=14,
            spaceAfter=10,
            backColor=colors.whitesmoke,
            borderPadding=10,
            borderColor=colors.lightgrey,
            borderWidth=1
        )
        
        story.append(Paragraph(clin_text, interp_style))
        story.append(Spacer(1, 30))
        
        # Footer Note
        footer_style = ParagraphStyle(
            name='FooterStyle',
            parent=normal_style,
            fontSize=9,
            textColor=colors.red,
            alignment=1,
            fontName='Helvetica-Oblique'
        )
        story.append(Paragraph("This report is generated by a research prototype and is not a medical diagnosis.", footer_style))
        
        doc.build(story)
