import re

NEW_CLASS_CODE = """
class ClinicalEOGReportPage(QWidget):
    def __init__(self, session_data):
        super().__init__()
        self.session_data = session_data
        self.is_recording = False
        self.record_time_left = 0
        self.init_ui()
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_metrics)
        self.timer.start(1000)

    def init_ui(self):
        main_layout = QVBoxLayout()

        # Title
        title_lbl = QLabel("Clinical EOG Report")
        title_lbl.setStyleSheet("font-size: 28px; font-weight: bold; color: #00E5FF;")
        title_lbl.setAlignment(Qt.AlignCenter)
        main_layout.addWidget(title_lbl)
        
        subtitle_lbl = QLabel("Research / Prototype Metrics for EOG-Based Assistive Control")
        subtitle_lbl.setStyleSheet("color: #94a3b8; font-size: 16px; font-style: italic;")
        subtitle_lbl.setAlignment(Qt.AlignCenter)
        main_layout.addWidget(subtitle_lbl)

        # Top row cards
        top_grid = QGridLayout()
        top_grid.setSpacing(10)
        self.top_cards = {}
        top_titles = ["Session Duration", "Total Packets", "Total Blink Events", "Total Commands", "Last Command", "Signal Quality"]
        for i, t in enumerate(top_titles):
            gb = QGroupBox(t)
            l = QVBoxLayout()
            lbl = QLabel("-")
            lbl.setAlignment(Qt.AlignCenter)
            lbl.setStyleSheet("font-size: 18px; font-weight: bold;")
            l.addWidget(lbl)
            gb.setLayout(l)
            top_grid.addWidget(gb, 0, i)
            self.top_cards[t] = lbl
        main_layout.addLayout(top_grid)

        content_layout = QGridLayout()
        content_layout.setSpacing(15)

        # Section 1: Live EOG Health Summary
        s1_gb = QGroupBox("Live EOG Health Summary")
        s1_l = QGridLayout()
        self.lbl_s1 = {
            "Current Raw Signal": self._create_metric_lbl(),
            "Average Raw Signal": self._create_metric_lbl(),
            "Baseline": self._create_metric_lbl(),
            "Blink Threshold": self._create_metric_lbl(),
            "Signal Range": self._create_metric_lbl(),
            "Noise Level": self._create_metric_lbl(),
            "Baseline Drift": self._create_metric_lbl(),
            "Signal Stability": self._create_metric_lbl(),
            "Electrode Contact Status": self._create_metric_lbl()
        }
        row, col = 0, 0
        for k, v in self.lbl_s1.items():
            s1_l.addWidget(QLabel(k + ":"), row, col)
            s1_l.addWidget(v, row, col + 1)
            row += 1
            if row > 4:
                row = 0
                col += 2
        s1_gb.setLayout(s1_l)
        content_layout.addWidget(s1_gb, 0, 0)

        # Section 2: Blink Control Analytics
        s2_gb = QGroupBox("Blink Control Analytics")
        s2_l = QVBoxLayout()
        s2_metrics_l = QGridLayout()
        self.lbl_s2 = {
            "Total detected blink sequences": self._create_metric_lbl(),
            "Last blink sequence count": self._create_metric_lbl(),
            "Most frequent blink count": self._create_metric_lbl(),
            "Average time between blink events": self._create_metric_lbl(),
            "Blink reliability estimate": self._create_metric_lbl(),
            "Command success estimate": self._create_metric_lbl()
        }
        for i, (k, v) in enumerate(self.lbl_s2.items()):
            s2_metrics_l.addWidget(QLabel(k + ":"), i//2, (i%2)*2)
            s2_metrics_l.addWidget(v, i//2, (i%2)*2 + 1)
        s2_l.addLayout(s2_metrics_l)
        
        # Blink mapping panel
        map_l = QGridLayout()
        mappings = [
            ("1 blink", "FORWARD"), ("2 blinks", "LEFT"), ("3 blinks", "RIGHT"),
            ("4 blinks", "BACKWARD"), ("5+ blinks", "STOP"), ("Long blink", "EMERGENCY_STOP")
        ]
        for i, (b, c) in enumerate(mappings):
            lbl = QLabel(f"{b} = {c}")
            lbl.setStyleSheet("background: #1e293b; padding: 4px; border-radius: 4px; font-size: 12px; color: #00E5FF;")
            lbl.setAlignment(Qt.AlignCenter)
            map_l.addWidget(lbl, i//3, i%3)
        s2_l.addWidget(QLabel("Blink Mapping Logic:"))
        s2_l.addLayout(map_l)
        s2_gb.setLayout(s2_l)
        content_layout.addWidget(s2_gb, 0, 1)

        # Section 3: Command History
        s3_gb = QGroupBox("Command History")
        s3_l = QVBoxLayout()
        self.history_table = QTableWidget(0, 4)
        self.history_table.setHorizontalHeaderLabels(["Time", "Blink Seq", "Command", "Source"])
        self.history_table.horizontalHeader().setStretchLastSection(True)
        s3_l.addWidget(self.history_table)
        s3_gb.setLayout(s3_l)
        content_layout.addWidget(s3_gb, 1, 0)

        # Section 4: Best Signal Snapshot
        s4_gb = QGroupBox("Best Signal Snapshot")
        s4_l = QVBoxLayout()
        self.plot_widget = pg.PlotWidget()
        self.plot_widget.setBackground('#050816')
        self.plot_widget.setMouseEnabled(x=False, y=False)
        self.plot_widget.hideButtons()
        self.snap_raw_line = self.plot_widget.plot(pen=pg.mkPen('#00E5FF', width=2))
        self.snap_base_line = self.plot_widget.plot(pen=pg.mkPen('#22C55E', width=2, style=pg.QtCore.Qt.DashLine))
        self.snap_thresh_line = self.plot_widget.plot(pen=pg.mkPen('#EF4444', width=2, style=pg.QtCore.Qt.DotLine))
        self.snap_msg = QLabel("Collect at least 60 seconds of telemetry to generate best signal snapshot.")
        self.snap_msg.setAlignment(Qt.AlignCenter)
        self.snap_msg.setStyleSheet("color: #94a3b8;")
        s4_l.addWidget(self.plot_widget)
        s4_l.addWidget(self.snap_msg)
        s4_gb.setLayout(s4_l)
        content_layout.addWidget(s4_gb, 1, 1)

        # Section 5: Clinical / Practical Interpretation
        s5_gb = QGroupBox("Clinical / Practical Interpretation")
        s5_l = QVBoxLayout()
        self.txt_clinical = QTextEdit()
        self.txt_clinical.setReadOnly(True)
        self.txt_clinical.setStyleSheet("font-size: 14px; background-color: #0F172A; border: 1px solid #334155; padding: 10px; color: #e0e0e0;")
        s5_l.addWidget(self.txt_clinical)
        warn_lbl = QLabel("Prototype interpretation, not a medical diagnosis.")
        warn_lbl.setStyleSheet("color: #F59E0B; font-weight: bold; font-size: 12px;")
        s5_l.addWidget(warn_lbl)
        s5_gb.setLayout(s5_l)
        content_layout.addWidget(s5_gb, 2, 0)

        # Section 6: 60-Second Report Generator
        s6_gb = QGroupBox("Report Generation")
        s6_l = QVBoxLayout()
        self.btn_report = QPushButton("Generate 60-Second Clinical Report")
        self.btn_report.setStyleSheet("background-color: #00E5FF; color: #050816; font-size: 18px; font-weight: bold; padding: 15px;")
        self.btn_report.clicked.connect(self.start_report)
        s6_l.addWidget(self.btn_report)
        
        btn_csv = QPushButton("Export CSV Only")
        btn_csv.clicked.connect(self.export_csv)
        s6_l.addWidget(btn_csv)
        s6_gb.setLayout(s6_l)
        content_layout.addWidget(s6_gb, 2, 1)

        main_layout.addLayout(content_layout)
        self.setLayout(main_layout)

    def _create_metric_lbl(self):
        lbl = QLabel("--")
        lbl.setStyleSheet("font-weight: bold; font-size: 14px;")
        return lbl

    def _set_status_color(self, lbl, status):
        if status == "Good":
            lbl.setStyleSheet("color: #22C55E; font-weight: bold; font-size: 14px;")
            lbl.setText(status)
        elif status == "Moderate":
            lbl.setStyleSheet("color: #F59E0B; font-weight: bold; font-size: 14px;")
            lbl.setText(status)
        else:
            lbl.setStyleSheet("color: #EF4444; font-weight: bold; font-size: 14px;")
            lbl.setText(status)
            
    def start_report(self):
        if self.is_recording: return
        self.is_recording = True
        self.record_time_left = 60
        self.session_data.clear() # clear to start fresh 60s window
        self.btn_report.setEnabled(False)
        self.btn_report.setText(f"Recording report data: {self.record_time_left}...")
        self.report_timer = QTimer()
        self.report_timer.timeout.connect(self.tick_report)
        self.report_timer.start(1000)

    def tick_report(self):
        self.record_time_left -= 1
        if self.record_time_left > 0:
            self.btn_report.setText(f"Recording report data: {self.record_time_left}...")
        else:
            self.report_timer.stop()
            self.is_recording = False
            self.btn_report.setEnabled(True)
            self.btn_report.setText("Generate 60-Second Clinical Report")
            self.export_pdf_report()

    def export_csv(self):
        path, _ = QFileDialog.getSaveFileName(self, "Save CSV", "", "CSV Files (*.csv)")
        if path: 
            ReportGenerator.export_csv(path, self.session_data)
            QMessageBox.information(self, "Success", "CSV exported successfully.")

    def export_pdf_report(self):
        path, _ = QFileDialog.getSaveFileName(self, "Save PDF", "NuroSync_Clinical_Report.pdf", "PDF Files (*.pdf)")
        if path:
            # Capture plot image
            import pyqtgraph.exporters
            exporter = pyqtgraph.exporters.ImageExporter(self.plot_widget.scene())
            img_path = "temp_snap.png"
            exporter.export(img_path)
            
            # Pass clinical text and image path to generator
            clin_text = self.txt_clinical.toPlainText()
            ReportGenerator.export_pdf(path, self.session_data, img_path, clin_text, self)
            QMessageBox.information(self, "Success", "Clinical PDF Report generated successfully.")

    def update_metrics(self):
        if not self.session_data.timestamps:
            return

        # Basic Stats
        raw = self.session_data.raw_signal[-1]
        base = self.session_data.baseline[-1]
        thresh = self.session_data.blink_threshold[-1]
        dur = self.session_data.get_session_duration()
        pkts = self.session_data.total_packets
        cmds = self.session_data.command_count
        
        hist_raw = list(self.session_data.history_raw_signal)
        avg_raw = sum(hist_raw)/max(1, len(hist_raw))

        # Top Cards
        h, m, s = int(dur)//3600, (int(dur)%3600)//60, int(dur)%60
        self.top_cards["Session Duration"].setText(f"{h:02d}:{m:02d}:{s:02d}")
        self.top_cards["Total Packets"].setText(str(pkts))
        self.top_cards["Total Blink Events"].setText(str(self.session_data.total_blink_sequences))
        self.top_cards["Total Commands"].setText(str(cmds))
        self.top_cards["Last Command"].setText(self.session_data.last_command)
        
        diff = abs(raw - base)
        thresh_diff = abs(thresh - base)
        sig_qual_status = "Good" if thresh_diff > 100 and diff < thresh_diff*0.5 else "Moderate" if thresh_diff > 50 else "Poor"
        self._set_status_color(self.top_cards["Signal Quality"], sig_qual_status)

        # Section 1
        self.lbl_s1["Current Raw Signal"].setText(f"{raw:.1f}")
        self.lbl_s1["Average Raw Signal"].setText(f"{avg_raw:.1f}")
        self.lbl_s1["Baseline"].setText(f"{base:.1f}")
        self.lbl_s1["Blink Threshold"].setText(f"{thresh:.1f}")
        
        recent_raw = hist_raw[-100:] if len(hist_raw) >= 100 else hist_raw
        sig_range = max(recent_raw) - min(recent_raw) if recent_raw else 0
        self.lbl_s1["Signal Range"].setText(f"{sig_range:.1f}")
        
        # Noise level = std dev
        import math
        avg_rec = sum(recent_raw)/max(1, len(recent_raw))
        var = sum((x - avg_rec)**2 for x in recent_raw) / max(1, len(recent_raw))
        noise = math.sqrt(var)
        self.lbl_s1["Noise Level"].setText(f"{noise:.1f}")
        
        hist_base = list(self.session_data.history_baseline)
        first_base = hist_base[0] if hist_base else base
        base_drift = base - first_base
        self.lbl_s1["Baseline Drift"].setText(f"{base_drift:.1f}")

        sig_stab = "Good" if noise < 50 else "Moderate" if noise < 150 else "Poor"
        self._set_status_color(self.lbl_s1["Signal Stability"], sig_stab)
        
        elec_cont = "Poor" if sig_range < 5 or raw <= 5 or raw >= 4090 else "Good"
        self._set_status_color(self.lbl_s1["Electrode Contact Status"], elec_cont)

        # Section 2
        self.lbl_s2["Total detected blink sequences"].setText(str(self.session_data.total_blink_sequences))
        self.lbl_s2["Last blink sequence count"].setText(str(self.session_data.current_blink_sequence))
        
        seqs = [cmd[1] for cmd in self.session_data.command_history if cmd[3] == "Headband Blink"]
        freq_seq = max(set(seqs), key=seqs.count) if seqs else 0
        self.lbl_s2["Most frequent blink count"].setText(str(freq_seq))
        
        avg_time = dur / max(1, len(seqs)) if seqs else 0
        self.lbl_s2["Average time between blink events"].setText(f"{avg_time:.1f} s")
        
        rel = "Good" if sig_stab == "Good" and elec_cont == "Good" else "Moderate" if elec_cont == "Good" else "Poor"
        self._set_status_color(self.lbl_s2["Blink reliability estimate"], rel)
        self._set_status_color(self.lbl_s2["Command success estimate"], rel)

        # Section 3
        self.history_table.setRowCount(0)
        for t, seq, cmd, src in reversed(self.session_data.recent_commands[-20:]):
            row = self.history_table.rowCount()
            self.history_table.insertRow(row)
            self.history_table.setItem(row, 0, QTableWidgetItem(f"{t:.1f}s"))
            self.history_table.setItem(row, 1, QTableWidgetItem(str(seq)))
            self.history_table.setItem(row, 2, QTableWidgetItem(cmd))
            self.history_table.setItem(row, 3, QTableWidgetItem(src))

        # Section 4: Best snapshot
        if dur > 60:
            self.snap_msg.hide()
            self.plot_widget.show()
            # simple mock for best 5s: just show the last 50 packets for now (approx 5s if 10Hz)
            # In a real implementation, we'd search history for min noise
            t_data = list(self.session_data.history_timestamps)[-100:]
            r_data = list(self.session_data.history_raw_signal)[-100:]
            b_data = list(self.session_data.history_baseline)[-100:]
            th_data = list(self.session_data.history_threshold)[-100:]
            self.snap_raw_line.setData(t_data, r_data)
            self.snap_base_line.setData(t_data, b_data)
            self.snap_thresh_line.setData(t_data, th_data)
        else:
            self.plot_widget.hide()
            self.snap_msg.show()

        # Section 5: Interpretation
        text = f"During this session, the EOG signal showed {sig_stab.lower()} stability. "
        text += f"Electrode contact appears {'acceptable' if elec_cont == 'Good' else 'inconsistent'}. "
        if self.session_data.total_blink_sequences > 0:
            text += "Blink events were detected and converted into assistive control commands. "
        else:
            text += "No valid blink events detected yet. "
            
        if abs(base_drift) < 200:
            text += "Baseline drift was low, suggesting stable sensor placement. "
        else:
            text += "Baseline drift is noticeable, electrodes may be shifting. "
            
        if sig_stab != "Good":
            text += "The user may benefit from recalibration if signal noise increases."
        else:
            text += "Signal quality is adequate for reliable control."
            
        self.txt_clinical.setPlainText(text)
        
        # Expose stats for report
        self.current_stats = {
            "avg_raw": avg_raw,
            "min_raw": min(hist_raw) if hist_raw else 0,
            "max_raw": max(hist_raw) if hist_raw else 0,
            "avg_base": sum(hist_base)/max(1, len(hist_base)) if hist_base else 0,
            "avg_thresh": sum(list(self.session_data.history_threshold))/max(1, len(self.session_data.history_threshold)) if self.session_data.history_threshold else 0,
            "sig_range": sig_range,
            "noise": noise,
            "base_drift": base_drift,
            "freq_cmd": freq_seq
        }

"""

with open("e:/Nurosync/app/ui.py", "r", encoding='utf-8') as f:
    content = f.read()

# Replace the classes
pattern = re.compile(r"class EOGDiagnosticsPage\(QWidget\):.*?class SettingsPage\(QWidget\):", re.DOTALL)
content = pattern.sub(NEW_CLASS_CODE + "\\nclass SettingsPage(QWidget):", content)

# Update App init
init_pattern = re.compile(r"self\.tabs = QTabWidget\(\).*?self\.tabs\.addTab\(self\.sett, \"Settings\"\)", re.DOTALL)

new_init_code = """self.tabs = QTabWidget()
        self.dash = DashboardPage(self.session_data, self.serial_worker)
        self.live = LiveSignalsPage(self.session_data)
        self.rep = ClinicalEOGReportPage(self.session_data)
        self.sett = SettingsPage(self.session_data, self.serial_worker)
        
        self.tabs.addTab(self.dash, "Dashboard")
        self.tabs.addTab(self.live, "Live Signals")
        self.tabs.addTab(self.rep, "Clinical EOG Report")
        self.tabs.addTab(self.sett, "Settings")"""

content = init_pattern.sub(new_init_code, content)

# Also update parser.blink_executed connect
content = content.replace("parser.blink_executed.connect(self.session_data.blink_executed.emit)", 
                          "parser.blink_executed.connect(self.session_data.set_blink_sequence)")

with open("e:/Nurosync/app/ui.py", "w", encoding='utf-8') as f:
    f.write(content)

print("ui.py successfully refactored.")
