from PySide6.QtWidgets import (QMainWindow, QTabWidget, QVBoxLayout, QHBoxLayout, 
                                 QWidget, QLabel, QPushButton, QGridLayout, 
                                 QGroupBox, QLineEdit, QFormLayout, QComboBox, 
                                 QPlainTextEdit, QTextEdit, QFileDialog, QMessageBox, QFrame, QHeaderView, QTableWidget, QTableWidgetItem, QProgressBar)
from PySide6.QtCore import Qt, QTimer, QObject, Signal
from collections import deque
import pyqtgraph as pg
import time
import random
from app.report_generator import ReportGenerator
from app.tts import TTSWorker

PREMIUM_THEME_QSS = """
QWidget { 
    background-color: #050816; 
    color: #e0e0e0; 
    font-family: 'Segoe UI', Arial, sans-serif; 
    font-size: 14px; 
}
QTabWidget::pane { 
    border: 1px solid #1e293b; 
    background: #0F172A; 
    border-radius: 8px; 
}
QTabBar::tab { 
    background: #0F172A; 
    border: 1px solid #1e293b; 
    padding: 10px 20px; 
    margin-right: 4px; 
    border-top-left-radius: 8px; 
    border-top-right-radius: 8px; 
}
QTabBar::tab:selected { 
    background: #1e293b; 
    color: #00E5FF; 
    font-weight: bold;
    border-bottom: 2px solid #00E5FF;
}
QPushButton { 
    background-color: #1e293b; 
    border: 1px solid #334155; 
    border-radius: 6px; 
    padding: 10px 20px; 
    color: #e0e0e0;
}
QPushButton:hover { 
    background-color: #334155; 
    border-color: #00E5FF;
}
QPushButton:pressed { 
    background-color: #0F172A; 
}
QLabel#title { 
    font-size: 28px; 
    font-weight: bold; 
    color: #00E5FF; 
    margin-bottom: 10px; 
}
QLabel#subtitle { 
    font-size: 16px; 
    color: #94a3b8; 
}
QComboBox, QTextEdit, QPlainTextEdit, QLineEdit { 
    background-color: #0F172A; 
    border: 1px solid #334155; 
    border-radius: 6px;
    padding: 6px; 
}
QGroupBox { 
    border: 1px solid #1e293b; 
    border-radius: 8px; 
    margin-top: 1.5ex; 
    font-weight: bold; 
    background-color: #0F172A;
}
QGroupBox::title { 
    subcontrol-origin: margin; 
    left: 10px; 
    padding: 0 5px 0 5px; 
    color: #00E5FF;
}
QTableWidget {
    background-color: #0F172A;
    border: 1px solid #1e293b;
    border-radius: 6px;
}
QHeaderView::section {
    background-color: #1e293b;
    padding: 4px;
    border: 1px solid #334155;
    color: #00E5FF;
}
"""

class SessionData(QObject):
    data_updated = Signal()
    command_received = Signal(str)
    blink_detected = Signal(int)
    blink_executed = Signal(int)
    report_generated = Signal(str)

    def __init__(self):
        super().__init__()
        self.patient_name = "Not Provided"
        self.patient_age = "Not Provided"
        self.patient_gender = "Not Provided"
        self.clear()

    def add_telemetry(self, raw, base, thresh, raw_line=""):
        self.total_packets += 1
        t = time.time() - self.start_time
        self.timestamps.append(t)
        self.raw_signal.append(raw)
        self.baseline.append(base)
        self.blink_threshold.append(thresh)
        
        self.history_timestamps.append(t)
        self.history_raw_signal.append(raw)
        self.history_baseline.append(base)
        self.history_threshold.append(thresh)
        self.history_telemetry_commands.append(self.last_command)
        self.history_raw_lines.append(raw_line)
        self.history_blink_sequence.append(self.current_blink_sequence)
        self.history_source.append(self.last_source if hasattr(self, 'last_source') else "Headband Blink")
        self.data_updated.emit()

    def add_command(self, command_str, source="Headband Blink"):
        self.command_count += 1
        self.last_command = command_str
        self.last_source = source
        
        # Determine blink sequence based on source
        seq = self.current_blink_sequence if source == "Headband Blink" else 0
        
        self.command_history.append((time.time() - self.start_time, seq, command_str, source))
        
        # Keep recent command history bounded
        if len(self.recent_commands) > 50:
            self.recent_commands.pop(0)
        self.recent_commands.append((time.time() - self.start_time, seq, command_str, source))
        
        self.command_counts[command_str] = self.command_counts.get(command_str, 0) + 1
        self.command_received.emit(command_str)

    def add_parse_error(self):
        self.parse_error_count += 1

    def add_spoken_phrase(self, phrase):
        self.spoken_phrases.append((time.time() - self.start_time, phrase))
        
    def add_typed_message(self, message):
        self.typed_messages.append((time.time() - self.start_time, message))

    def clear(self):
        self.start_time = time.time()
        self.total_packets = 0
        self.command_count = 0
        self.parse_error_count = 0
        self.raw_line_count = 0
        
        self.raw_signal = deque(maxlen=300)
        self.baseline = deque(maxlen=300)
        self.blink_threshold = deque(maxlen=300)
        self.timestamps = deque(maxlen=300)
        
        self.history_raw_signal = []
        self.history_baseline = []
        self.history_threshold = []
        self.history_timestamps = []
        self.history_telemetry_commands = []
        self.history_raw_lines = []
        self.history_blink_sequence = []
        self.history_source = []
        
        self.command_history = []
        self.recent_commands = []
        self.command_counts = {}
        self.spoken_phrases = []
        self.typed_messages = []
        
        self.last_command = "None"
        self.total_blink_sequences = 0
        self.current_blink_sequence = 0
        
        self.patient_name = "Not Provided"
        self.patient_age = "Not Provided"
        self.patient_gender = "Not Provided"
        
        # Last calibration details
        self.last_cal_timestamp = None
        self.last_cal_baseline = None
        self.last_cal_noise = None
        self.last_cal_avg_peak = None
        self.last_cal_threshold = None
        self.last_cal_strength = None
        self.last_cal_confidence = None
        
        self.data_updated.emit()

    def set_blink_sequence(self, seq):
        self.current_blink_sequence = seq
        self.total_blink_sequences += 1

    def get_session_duration(self):
        return time.time() - self.start_time

class SmartBlinkCalibrator(QObject):
    status_changed = Signal(str, int)  # msg, pct
    calibration_finished = Signal(bool, str) # success, message

    STATE_IDLE = 0
    STATE_RESTING = 1
    STATE_BLINKING = 2

    def __init__(self, serial_worker, session_data):
        super().__init__()
        self.serial_worker = serial_worker
        self.session_data = session_data
        
        self.state = self.STATE_IDLE
        self.resting_signals = []
        self.blinking_signals = []
        self.all_signals = []
        
        self.timer = QTimer()
        self.timer.timeout.connect(self.on_timer_tick)
        self.elapsed_time = 0.0

    def start_calibration(self):
        if not self.serial_worker or not self.serial_worker.serial_port or not self.serial_worker.serial_port.is_open:
            self.calibration_finished.emit(False, "Connect headband first.")
            return False
            
        self.resting_signals.clear()
        self.blinking_signals.clear()
        self.all_signals.clear()
        
        self.state = self.STATE_RESTING
        self.elapsed_time = 0.0
        
        self.timer.start(100)
        self.status_changed.emit("Relax your eyes. Do not blink for 5 seconds.", 0)
        return True

    def handle_telemetry(self, raw, base, thresh):
        if self.state == self.STATE_RESTING:
            self.resting_signals.append(raw)
            self.all_signals.append(raw)
        elif self.state == self.STATE_BLINKING:
            self.blinking_signals.append(raw)
            self.all_signals.append(raw)

    def on_timer_tick(self):
        self.elapsed_time += 0.1
        
        if self.state == self.STATE_RESTING:
            rem = max(0, int(5.0 - self.elapsed_time))
            pct = int((self.elapsed_time / 5.0) * 100)
            self.status_changed.emit(f"Relax your eyes. Do not blink for 5 seconds. (Remaining: {rem}s)", pct)
            
            if self.elapsed_time >= 5.0:
                self.state = self.STATE_BLINKING
                self.elapsed_time = 0.0
                self.status_changed.emit("Now blink naturally 5 times.", 0)
                
        elif self.state == self.STATE_BLINKING:
            rem = max(0, int(10.0 - self.elapsed_time))
            pct = int((self.elapsed_time / 10.0) * 100)
            self.status_changed.emit(f"Now blink naturally 5 times. (Remaining: {rem}s)", pct)
            
            if self.elapsed_time >= 10.0:
                self.state = self.STATE_IDLE
                self.timer.stop()
                self.calculate_calibration()

    def calculate_calibration(self):
        self.status_changed.emit("Calculating threshold...", 100)
        
        if len(self.resting_signals) < 50 or len(self.blinking_signals) < 100:
            self.calibration_finished.emit(False, "Not enough telemetry for calibration.")
            return
            
        stuck_count = sum(1 for x in self.all_signals if x <= 50 or x >= 4040)
        if stuck_count > 0.1 * len(self.all_signals):
            self.calibration_finished.emit(False, "Poor electrode contact or saturated signal. Check electrode placement.")
            return
            
        resting_min = min(self.resting_signals)
        resting_max = max(self.resting_signals)
        if (resting_max - resting_min) < 5.0:
            if resting_min < 100 or resting_max > 4000:
                self.calibration_finished.emit(False, "Poor electrode contact or saturated signal. Check electrode placement.")
                return

        resting_mean = sum(self.resting_signals) / len(self.resting_signals)
        resting_std = (sum((x - resting_mean)**2 for x in self.resting_signals) / len(self.resting_signals))**0.5
        
        peaks = []
        n = len(self.blinking_signals)
        window_size = 20
        i = window_size
        threshold_barrier = resting_mean + max(3 * resting_std, 150.0)
        
        while i < n - window_size:
            val = self.blinking_signals[i]
            if val == max(self.blinking_signals[i - window_size : i + window_size + 1]):
                if val > threshold_barrier:
                    peaks.append(val)
                    i += window_size
                    continue
            i += 1
            
        if len(peaks) == 0:
            self.calibration_finished.emit(False, "Blink signal too weak. Please adjust electrodes and retry.")
            return
            
        average_blink_peak = sum(peaks) / len(peaks)
        max_blink_peak = max(peaks)
        
        average_blink_amplitude = max(0.0, average_blink_peak - resting_mean)
        recommended_threshold = resting_mean + max(3 * resting_std, 0.35 * average_blink_amplitude)
        
        recommended_threshold = max(recommended_threshold, resting_max + 50.0)
        recommended_threshold = max(recommended_threshold, resting_mean + 3 * resting_std)
        recommended_threshold = max(recommended_threshold, resting_mean + 150.0)
        
        if recommended_threshold >= average_blink_peak:
            recommended_threshold = average_blink_peak - max(50.0, (average_blink_peak - resting_mean) * 0.2)
            recommended_threshold = max(recommended_threshold, resting_max + 50.0)
            
        if recommended_threshold >= average_blink_peak:
            self.calibration_finished.emit(False, "Blink signal too weak. Please adjust electrodes and retry.")
            return
            
        if average_blink_amplitude < 500:
            blink_strength = "Weak"
        elif average_blink_amplitude < 1200:
            blink_strength = "Moderate"
        else:
            blink_strength = "Strong"
            
        num_peaks = len(peaks)
        snr = average_blink_amplitude / max(0.1, resting_std)
        
        if 4 <= num_peaks <= 7 and snr >= 8.0:
            confidence = "High"
        elif 3 <= num_peaks and snr >= 4.0:
            confidence = "Medium"
        else:
            confidence = "Low"
            
        import datetime
        self.session_data.last_cal_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.session_data.last_cal_baseline = resting_mean
        self.session_data.last_cal_noise = resting_std
        self.session_data.last_cal_avg_peak = average_blink_peak
        self.session_data.last_cal_threshold = recommended_threshold
        self.session_data.last_cal_strength = blink_strength
        self.session_data.last_cal_confidence = confidence
        
        self.calibration_finished.emit(True, "Calibration Complete")
        self.session_data.data_updated.emit()

class DashboardPage(QWidget):
    def __init__(self, session_data, serial_worker, calibrator):
        super().__init__()
        self.session_data = session_data
        self.serial_worker = serial_worker
        self.calibrator = calibrator
        self.is_connected = False
        layout = QVBoxLayout()

        grid = QGridLayout()
        grid.setSpacing(15)
        
        self.cards = {}
        titles = ["Serial Status", "Telemetry Status", "Session Time", "Total Packets", "Commands Received", "Last Command", "Current Raw Signal", "Signal Quality"]
        for i, title in enumerate(titles):
            gb = QGroupBox(title)
            l = QVBoxLayout()
            lbl = QLabel("...")
            lbl.setAlignment(Qt.AlignCenter)
            lbl.setStyleSheet("font-size: 20px; font-weight: bold;")
            l.addWidget(lbl)
            gb.setLayout(l)
            grid.addWidget(gb, i//4, i%4)
            self.cards[title] = lbl
            
        layout.addLayout(grid)

        # Compact Calibration Section
        cal_layout = QHBoxLayout()
        cal_layout.setContentsMargins(10, 5, 10, 5)
        
        self.lbl_dash_cal_status = QLabel("Blink Calibration: Not Calibrated")
        self.lbl_dash_cal_status.setStyleSheet("font-weight: bold; color: #94a3b8; font-size: 14px;")
        
        self.btn_dash_start_cal = QPushButton("Start Auto Calibration")
        self.btn_dash_start_cal.setStyleSheet("QPushButton { background-color: #00E5FF; color: #050816; font-weight: bold; padding: 6px 15px; border-radius: 4px; } QPushButton:hover { background-color: #00B2CC; }")
        
        cal_layout.addWidget(self.lbl_dash_cal_status)
        cal_layout.addWidget(self.btn_dash_start_cal)
        cal_layout.addStretch()
        layout.addLayout(cal_layout)

        # Bottom section: History & Mapping
        bot_layout = QHBoxLayout()
        
        hist_gb = QGroupBox("Recent Command History")
        hist_l = QVBoxLayout()
        self.history_table = QTableWidget(0, 2)
        self.history_table.setHorizontalHeaderLabels(["Time", "Command"])
        self.history_table.horizontalHeader().setStretchLastSection(True)
        hist_l.addWidget(self.history_table)
        hist_gb.setLayout(hist_l)
        bot_layout.addWidget(hist_gb, stretch=2)
        
        map_gb = QGroupBox("Control Panel")
        map_gb.setStyleSheet("QGroupBox::title { color: #00E5FF; }")
        map_l = QVBoxLayout()
        
        # Mapping badges
        badges_l = QGridLayout()
        badges_l.setSpacing(5)
        mappings = [
            ("1 blink", "FORWARD", "#00E5FF"),
            ("2 blinks", "LEFT", "#00E5FF"),
            ("3 blinks", "RIGHT", "#00E5FF"),
            ("4 blinks", "BACKWARD", "#00E5FF"),
            ("5+ blinks", "STOP", "#EF4444"),
            ("Long blink", "EMERGENCY STOP", "#EF4444")
        ]
        for i, (b, c, col) in enumerate(mappings):
            lbl = QLabel(f"{b} → <span style='color:{col}; font-weight:bold;'>{c}</span>")
            lbl.setStyleSheet("background: #1e293b; padding: 4px; border-radius: 4px; font-size: 14px;")
            lbl.setAlignment(Qt.AlignCenter)
            badges_l.addWidget(lbl, i//2, i%2)
        map_l.addLayout(badges_l)

        # Manual Remote
        lbl_rem = QLabel("Manual Car Remote")
        lbl_rem.setStyleSheet("color: #94a3b8; font-size: 16px; margin-top: 10px; font-weight: bold;")
        lbl_rem.setAlignment(Qt.AlignCenter)
        map_l.addWidget(lbl_rem)

        rem_grid = QGridLayout()
        rem_grid.setSpacing(5)
        
        self.btn_f = QPushButton("FORWARD\n↑")
        self.btn_l = QPushButton("LEFT\n←")
        self.btn_s = QPushButton("STOP\n■")
        self.btn_r = QPushButton("RIGHT\n→")
        self.btn_b = QPushButton("BACKWARD\n↓")
        self.btn_e = QPushButton("EMERGENCY STOP")

        for btn in [self.btn_f, self.btn_l, self.btn_r, self.btn_b]:
            btn.setStyleSheet("QPushButton { border: 1px solid #00E5FF; color: #00E5FF; padding: 5px; } QPushButton:hover { background: #1e293b; }")
        self.btn_s.setStyleSheet("QPushButton { background-color: #EF4444; color: white; padding: 5px; border: none; font-weight: bold; }")
        self.btn_e.setStyleSheet("QPushButton { background-color: #991b1b; color: white; padding: 10px; border: 2px solid #EF4444; font-weight: bold; font-size: 16px; } QPushButton:hover { background-color: #EF4444; }")

        rem_grid.addWidget(self.btn_f, 0, 1)
        rem_grid.addWidget(self.btn_l, 1, 0)
        rem_grid.addWidget(self.btn_s, 1, 1)
        rem_grid.addWidget(self.btn_r, 1, 2)
        rem_grid.addWidget(self.btn_b, 2, 1)

        map_l.addLayout(rem_grid)
        map_l.addWidget(self.btn_e)

        self.btn_f.clicked.connect(lambda: self.send_manual_command('F', 'FORWARD'))
        self.btn_l.clicked.connect(lambda: self.send_manual_command('L', 'LEFT'))
        self.btn_s.clicked.connect(lambda: self.send_manual_command('S', 'STOP'))
        self.btn_r.clicked.connect(lambda: self.send_manual_command('R', 'RIGHT'))
        self.btn_b.clicked.connect(lambda: self.send_manual_command('B', 'BACKWARD'))
        self.btn_e.clicked.connect(lambda: self.send_manual_command('E', 'EMERGENCY_STOP'))

        map_gb.setLayout(map_l)
        bot_layout.addWidget(map_gb, stretch=1)
        
        layout.addLayout(bot_layout)
        self.setLayout(layout)
        self.session_data.data_updated.connect(self.update_ui)
        
        # Connect calibrator signals
        self.calibrator.status_changed.connect(self.on_cal_status_changed)
        self.calibrator.calibration_finished.connect(self.on_cal_finished)
        self.btn_dash_start_cal.clicked.connect(self.calibrator.start_calibration)

    def on_cal_status_changed(self, msg, pct):
        self.lbl_dash_cal_status.setText(f"Calibration: {msg}")
        self.lbl_dash_cal_status.setStyleSheet("font-weight: bold; color: #F59E0B; font-size: 14px;")
        self.btn_dash_start_cal.setEnabled(False)

    def on_cal_finished(self, success, message):
        self.btn_dash_start_cal.setEnabled(True)
        if success:
            QMessageBox.information(self, "Calibration Complete", f"Auto Calibration complete!\nRecommended Threshold: {self.session_data.last_cal_threshold:.0f}\nBlink Strength: {self.session_data.last_cal_strength}\nConfidence: {self.session_data.last_cal_confidence}")
        else:
            QMessageBox.warning(self, "Calibration Failed", message)
        self.update_ui()

    def set_serial_status(self, connected, port=""):
        self.is_connected = connected
        
        # Update remote buttons state
        for btn in [self.btn_f, self.btn_l, self.btn_r, self.btn_b, self.btn_s, self.btn_e]:
            btn.setEnabled(connected)
            if not connected:
                btn.setStyleSheet("QPushButton { background-color: #334155; color: #94a3b8; border: 1px solid #475569; padding: 5px; }")
            elif btn == self.btn_s:
                btn.setStyleSheet("QPushButton { background-color: #EF4444; color: white; padding: 5px; border: none; font-weight: bold; }")
            elif btn == self.btn_e:
                btn.setStyleSheet("QPushButton { background-color: #991b1b; color: white; padding: 10px; border: 2px solid #EF4444; font-weight: bold; font-size: 16px; } QPushButton:hover { background-color: #EF4444; }")
            else:
                btn.setStyleSheet("QPushButton { border: 1px solid #00E5FF; color: #00E5FF; padding: 5px; } QPushButton:hover { background: #1e293b; }")

        if connected:
            self.cards["Serial Status"].setText(f"Connected ({port})")
            self.cards["Serial Status"].setStyleSheet("color: #22C55E; font-size: 18px; font-weight: bold;")
            self.cards["Telemetry Status"].setText("Waiting...")
        else:
            self.cards["Serial Status"].setText("Disconnected")
            self.cards["Serial Status"].setStyleSheet("color: #EF4444; font-size: 18px; font-weight: bold;")
            self.cards["Telemetry Status"].setText("Offline")

    def update_ui(self):
        dur = int(self.session_data.get_session_duration())
        self.cards["Session Time"].setText(f"{dur//3600:02d}:{(dur%3600)//60:02d}:{dur%60:02d}")
        self.cards["Total Packets"].setText(str(self.session_data.total_packets))
        self.cards["Commands Received"].setText(str(self.session_data.command_count))
        self.cards["Last Command"].setText(self.session_data.last_command)
        
        if self.session_data.total_packets > 0:
            self.cards["Telemetry Status"].setText("Receiving")
            self.cards["Telemetry Status"].setStyleSheet("color: #22C55E; font-size: 18px; font-weight: bold;")
            
            raw = self.session_data.raw_signal[-1]
            base = self.session_data.baseline[-1]
            thresh = self.session_data.blink_threshold[-1]
            
            self.cards["Current Raw Signal"].setText(f"{raw:.1f}")
            
            thresh_diff = abs(thresh - base)
            diff = abs(raw - base)
            if thresh_diff == 0:
                qual, color = "Low", "#EF4444"
            else:
                ratio = diff / thresh_diff
                if ratio < 0.2: qual, color = "Good", "#22C55E"
                elif ratio < 0.5: qual, color = "Fair", "#F59E0B"
                else: qual, color = "Noisy", "#F59E0B"
            self.cards["Signal Quality"].setText(qual)
            self.cards["Signal Quality"].setStyleSheet(f"color: {color}; font-size: 20px; font-weight: bold;")

        # Update calibration status label on Dashboard if not actively calibrating
        if self.calibrator.state == SmartBlinkCalibrator.STATE_IDLE:
            if self.session_data.last_cal_threshold is not None:
                self.lbl_dash_cal_status.setText(f"Blink Calibration: Recommended Threshold: {self.session_data.last_cal_threshold:.0f} (Strength: {self.session_data.last_cal_strength})")
                self.lbl_dash_cal_status.setStyleSheet("font-weight: bold; color: #22C55E; font-size: 14px;")
            else:
                self.lbl_dash_cal_status.setText("Blink Calibration: Not Calibrated")
                self.lbl_dash_cal_status.setStyleSheet("font-weight: bold; color: #94a3b8; font-size: 14px;")

        # Update table
        self.history_table.setRowCount(0)
        for t, seq, cmd, src in reversed(self.session_data.recent_commands):
            row = self.history_table.rowCount()
            self.history_table.insertRow(row)
            self.history_table.setItem(row, 0, QTableWidgetItem(f"{t:.1f}s"))
            self.history_table.setItem(row, 1, QTableWidgetItem(cmd))

    def send_manual_command(self, command_char, label):
        if not self.is_connected or not self.serial_worker.serial_port or not self.serial_worker.serial_port.is_open:
            QMessageBox.warning(self, "Warning", "Connect headband serial first")
            return
            
        try:
            self.serial_worker.serial_port.write(f"{command_char}\n".encode('utf-8'))
            src = "Emergency" if label == "EMERGENCY_STOP" else "Manual App Remote"
            self.session_data.add_command(label, source=src)
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Failed to send command: {e}")

class LiveSignalsPage(QWidget):
    def __init__(self, session_data):
        super().__init__()
        self.session_data = session_data
        layout = QVBoxLayout()
        
        # Stat cards
        stats_layout = QHBoxLayout()
        self.lbl_raw = QLabel("Raw Signal: 0")
        self.lbl_base = QLabel("Baseline: 0")
        self.lbl_thresh = QLabel("Threshold: 0")
        for lbl in [self.lbl_raw, self.lbl_base, self.lbl_thresh]:
            lbl.setStyleSheet("font-size: 16px; font-weight: bold; background: #0F172A; padding: 10px; border-radius: 6px;")
            stats_layout.addWidget(lbl)
        layout.addLayout(stats_layout)
        
        self.plot_widget = pg.PlotWidget()
        self.plot_widget.setBackground('#050816')
        self.plot_widget.addLegend()
        self.plot_widget.setYRange(0, 4095, padding=0)
        self.plot_widget.setMouseEnabled(x=False, y=False)
        self.plot_widget.hideButtons()
        self.raw_line = self.plot_widget.plot(pen=pg.mkPen('#00E5FF', width=2), name="Raw Signal")
        self.base_line = self.plot_widget.plot(pen=pg.mkPen('#22C55E', width=2, style=pg.QtCore.Qt.DashLine), name="Baseline")
        self.thresh_line = self.plot_widget.plot(pen=pg.mkPen('#EF4444', width=2, style=pg.QtCore.Qt.DotLine), name="Threshold")
        
        self.overlay_text = pg.TextItem("Waiting for telemetry...", color='#94a3b8', anchor=(0.5, 0.5))
        self.plot_widget.addItem(self.overlay_text)
        layout.addWidget(self.plot_widget, stretch=3)
        
        # Serial preview
        prev_gb = QGroupBox("Raw Serial Preview")
        prev_l = QVBoxLayout()
        self.raw_preview = QPlainTextEdit()
        self.raw_preview.setReadOnly(True)
        self.raw_preview.setMaximumHeight(100)
        prev_l.addWidget(self.raw_preview)
        prev_gb.setLayout(prev_l)
        layout.addWidget(prev_gb, stretch=1)
        
        self.setLayout(layout)
        
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_plot)
        self.timer.start(100)

    def append_raw_line(self, line):
        self.raw_preview.appendPlainText(line)

    def update_plot(self):
        if self.session_data.timestamps:
            self.overlay_text.hide()
            t = list(self.session_data.timestamps)
            raw = list(self.session_data.raw_signal)
            base = list(self.session_data.baseline)
            thresh = list(self.session_data.blink_threshold)
            self.raw_line.setData(t, raw)
            self.base_line.setData(t, base)
            self.thresh_line.setData(t, thresh)
            
            self.lbl_raw.setText(f"Raw Signal: {raw[-1]:.1f}")
            self.lbl_base.setText(f"Baseline: {base[-1]:.1f}")
            self.lbl_thresh.setText(f"Threshold: {thresh[-1]:.1f}")
        else:
            self.overlay_text.show()

import pyqtgraph.exporters
import os

class ClinicalEOGReportPage(QWidget):
    def __init__(self, session_data):
        super().__init__()
        self.session_data = session_data
        
        # Main layout with ScrollArea
        main_layout = QVBoxLayout(self)
        from PySide6.QtWidgets import QScrollArea, QSpinBox
        self.scroll_area = QScrollArea(self)
        self.scroll_area.setWidgetResizable(True)
        self.scroll_area.setStyleSheet("QScrollArea { border: none; background-color: transparent; }")
        
        self.content_widget = QWidget()
        self.init_ui()
        self.scroll_area.setWidget(self.content_widget)
        main_layout.addWidget(self.scroll_area)
        
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_metrics)
        self.timer.start(1000)
        self.session_data.command_received.connect(self.update_command_history)
        self.report_timer = QTimer()
        self.report_timer.timeout.connect(self.handle_report_tick)
        self.report_countdown = 0

    def init_ui(self):
        main_layout = QVBoxLayout(self.content_widget)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(15)
        
        # Title
        title_lbl = QLabel("Clinical EOG Report")
        title_lbl.setStyleSheet("font-size: 28px; font-weight: bold; color: #00E5FF; margin-bottom: 5px;")
        sub_lbl = QLabel("Research / Prototype Metrics for EOG-Based Assistive Control")
        sub_lbl.setStyleSheet("color: #94a3b8; font-size: 16px; margin-bottom: 10px;")
        main_layout.addWidget(title_lbl)
        main_layout.addWidget(sub_lbl)

        # Patient Info Section
        pat_gb = QGroupBox("Patient / User Information")
        pat_gb.setStyleSheet("QGroupBox::title { color: #00E5FF; font-size: 16px; }")
        pat_l = QGridLayout()
        pat_l.setSpacing(10)
        
        self.inp_name = QLineEdit()
        self.inp_name.setPlaceholderText("Enter Patient Name")
        self.inp_age = QLineEdit()
        self.inp_age.setPlaceholderText("Enter Age")
        self.cb_gender = QComboBox()
        self.cb_gender.addItems(["Not specified", "Male", "Female", "Other"])
        
        btn_save_pat = QPushButton("Save Patient Info")
        btn_save_pat.setStyleSheet("background-color: #22C55E; color: white;")
        btn_save_pat.clicked.connect(self.save_patient)
        
        btn_clr_pat = QPushButton("Clear Patient Info")
        btn_clr_pat.setStyleSheet("background-color: #EF4444; color: white;")
        btn_clr_pat.clicked.connect(self.clear_patient)
        
        pat_l.addWidget(QLabel("Patient Name:"), 0, 0)
        pat_l.addWidget(self.inp_name, 0, 1)
        pat_l.addWidget(QLabel("Age:"), 0, 2)
        pat_l.addWidget(self.inp_age, 0, 3)
        pat_l.addWidget(QLabel("Gender:"), 0, 4)
        pat_l.addWidget(self.cb_gender, 0, 5)
        pat_l.addWidget(btn_save_pat, 1, 4)
        pat_l.addWidget(btn_clr_pat, 1, 5)
        
        # Display saved info
        self.lbl_saved_pat = QLabel(f"Patient Name: {self.session_data.patient_name}  |  Age: {self.session_data.patient_age}  |  Gender: {self.session_data.patient_gender}")
        self.lbl_saved_pat.setStyleSheet("color: #F59E0B; font-weight: bold; margin-top: 5px;")
        pat_l.addWidget(self.lbl_saved_pat, 2, 0, 1, 6)
        
        pat_gb.setLayout(pat_l)
        main_layout.addWidget(pat_gb)

        # Top row cards
        top_cards = QGroupBox()
        tc_l = QHBoxLayout()
        self.lbl_dur = self._create_top_card("Session Duration", "00:00:00", tc_l)
        self.lbl_grade = self._create_top_card("Overall Grade", "-", tc_l)
        self.lbl_pkts = self._create_top_card("Total Packets", "0", tc_l)
        self.lbl_blinks = self._create_top_card("Total Blink Events", "0", tc_l)
        self.lbl_cmds = self._create_top_card("Total Commands", "0", tc_l)
        self.lbl_sig_qual = self._create_top_card("Signal Quality", "-", tc_l)
        top_cards.setLayout(tc_l)
        top_cards.setMinimumHeight(100)
        main_layout.addWidget(top_cards)

        mid_layout = QHBoxLayout()
        
        # Section 1 & 2 layout
        col1_layout = QVBoxLayout()
        
        # Section 1: SIGNAL INTEGRITY ANALYTICS
        s1_gb = QGroupBox("1. Signal Integrity Analytics")
        s1_gb.setStyleSheet("QGroupBox::title { color: #00E5FF; font-size: 16px; }")
        s1_l = QGridLayout()
        s1_l.setSpacing(10)
        self.lbl_sig_rel = self._add_metric_row(s1_l, 0, "Signal Reliability Score:")
        self.lbl_cont_qual = self._add_metric_row(s1_l, 1, "Electrode Contact Quality:")
        self.lbl_worst_sig = self._add_metric_row(s1_l, 2, "Worst Signal / Warning:")
        self.lbl_base_drift = self._add_metric_row(s1_l, 3, "Baseline Drift:")
        self.lbl_worst_sig.setWordWrap(True)
        s1_gb.setLayout(s1_l)
        col1_layout.addWidget(s1_gb)
        
        # Section 2: CONTROL & USABILITY
        s2_gb = QGroupBox("2. Control & Usability")
        s2_gb.setStyleSheet("QGroupBox::title { color: #00E5FF; font-size: 16px; }")
        s2_l = QGridLayout()
        s2_l.setSpacing(10)
        self.lbl_blk_rel = self._add_metric_row(s2_l, 0, "Blink Control Reliability:")
        self.lbl_tot_cmds = self._add_metric_row(s2_l, 1, "Total Valid Commands:")
        self.lbl_ctrl_strain = self._add_metric_row(s2_l, 2, "Control Strain Indicator:")
        self.lbl_cmd_dist = self._add_metric_row(s2_l, 3, "Command Distribution:")
        self.lbl_cmd_dist.setWordWrap(True)
        s2_gb.setLayout(s2_l)
        col1_layout.addWidget(s2_gb)
        
        # Section 3: SAFETY & CAREGIVER RECS
        s3_gb_rec = QGroupBox("3. Safety & Caregiver Recommendations")
        s3_gb_rec.setStyleSheet("QGroupBox::title { color: #00E5FF; font-size: 16px; }")
        s3_l_rec = QGridLayout()
        s3_l_rec.setSpacing(10)
        self.lbl_safe_evts = self._add_metric_row(s3_l_rec, 0, "Safety Events:")
        self.lbl_recs = self._add_metric_row(s3_l_rec, 1, "Recommendations:")
        self.lbl_recs.setWordWrap(True)
        s3_gb_rec.setLayout(s3_l_rec)
        col1_layout.addWidget(s3_gb_rec)
        col1_layout.addWidget(s2_gb)
        
        mid_layout.addLayout(col1_layout, stretch=1)
        
        # Section 3 & 4 layout
        col2_layout = QVBoxLayout()
        
        # Section 4: BEST SIGNAL SNAPSHOT
        s4_gb = QGroupBox("Best Signal Snapshot (5-sec)")
        s4_gb.setStyleSheet("QGroupBox::title { color: #00E5FF; font-size: 16px; }")
        s4_l = QVBoxLayout()
        self.plot_widget = pg.PlotWidget()
        self.plot_widget.setBackground('#050816')
        self.plot_widget.setYRange(0, 4095, padding=0)
        self.plot_widget.setMouseEnabled(x=False, y=False)
        self.plot_widget.hideButtons()
        self.plot_widget.setMinimumHeight(200)
        self.snap_raw = self.plot_widget.plot(pen=pg.mkPen('#00E5FF', width=2))
        self.snap_base = self.plot_widget.plot(pen=pg.mkPen('#22C55E', width=2, style=pg.QtCore.Qt.DashLine))
        self.snap_thresh = self.plot_widget.plot(pen=pg.mkPen('#EF4444', width=2, style=pg.QtCore.Qt.DotLine))
        self.snap_overlay = pg.TextItem("Collect at least 60 seconds of telemetry to generate best signal snapshot.", color='#94a3b8', anchor=(0.5, 0.5))
        self.plot_widget.addItem(self.snap_overlay)
        s4_l.addWidget(self.plot_widget)
        s4_gb.setLayout(s4_l)
        col2_layout.addWidget(s4_gb, stretch=1)
        
        # Section 3: COMMAND HISTORY
        s3_gb = QGroupBox("Command History (Last 20)")
        s3_gb.setStyleSheet("QGroupBox::title { color: #00E5FF; font-size: 16px; }")
        s3_l = QVBoxLayout()
        self.hist_table = QTableWidget(0, 4)
        self.hist_table.setHorizontalHeaderLabels(["Time", "Sequence", "Command", "Source"])
        self.hist_table.horizontalHeader().setStretchLastSection(True)
        self.hist_table.setMinimumHeight(200)
        s3_l.addWidget(self.hist_table)
        s3_gb.setLayout(s3_l)
        col2_layout.addWidget(s3_gb, stretch=1)
        
        mid_layout.addLayout(col2_layout, stretch=2)
        main_layout.addLayout(mid_layout)
        
        # Bottom row
        bot_layout = QHBoxLayout()
        
        # Section 5: CLINICAL / PRACTICAL INTERPRETATION
        s5_gb = QGroupBox("Clinical / Practical Interpretation")
        s5_gb.setStyleSheet("QGroupBox::title { color: #00E5FF; font-size: 16px; }")
        s5_l = QVBoxLayout()
        self.txt_interp = QTextEdit()
        self.txt_interp.setReadOnly(True)
        self.txt_interp.setStyleSheet("font-size: 14px; background-color: #0F172A; border: 1px solid #334155; padding: 10px;")
        self.txt_interp.setMinimumHeight(150)
        s5_l.addWidget(self.txt_interp)
        safe_lbl = QLabel("Prototype interpretation, not a medical diagnosis.")
        safe_lbl.setStyleSheet("color: #EF4444; font-style: italic; font-weight: bold;")
        s5_l.addWidget(safe_lbl)
        s5_gb.setLayout(s5_l)
        bot_layout.addWidget(s5_gb, stretch=2)
        
        # Section 6: 60-SECOND REPORT GENERATOR
        s6_gb = QGroupBox("Report Generator")
        s6_gb.setStyleSheet("QGroupBox::title { color: #00E5FF; font-size: 16px; }")
        s6_l = QVBoxLayout()
        self.btn_gen = QPushButton("Generate 60-Second Clinical Report")
        self.btn_gen.setStyleSheet("background-color: #00E5FF; color: #050816; font-size: 18px; font-weight: bold; padding: 15px;")
        self.btn_gen.clicked.connect(self.start_report)
        self.btn_gen.setMinimumHeight(60)
        s6_l.addWidget(self.btn_gen)
        self.lbl_rep_stat = QLabel("")
        self.lbl_rep_stat.setAlignment(Qt.AlignCenter)
        self.lbl_rep_stat.setStyleSheet("font-size: 16px; font-weight: bold; color: #F59E0B;")
        s6_l.addWidget(self.lbl_rep_stat)
        s6_gb.setLayout(s6_l)
        bot_layout.addWidget(s6_gb, stretch=1)
        
        main_layout.addLayout(bot_layout)

    def save_patient(self):
        self.session_data.patient_name = self.inp_name.text() or "Not Provided"
        self.session_data.patient_age = self.inp_age.text() or "Not Provided"
        self.session_data.patient_gender = self.cb_gender.currentText()
        self.lbl_saved_pat.setText(f"Patient Name: {self.session_data.patient_name}  |  Age: {self.session_data.patient_age}  |  Gender: {self.session_data.patient_gender}")

    def clear_patient(self):
        self.inp_name.clear()
        self.inp_age.clear()
        self.cb_gender.setCurrentIndex(0)
        self.session_data.patient_name = "Not Provided"
        self.session_data.patient_age = "Not Provided"
        self.session_data.patient_gender = "Not Provided"
        self.lbl_saved_pat.setText(f"Patient Name: {self.session_data.patient_name}  |  Age: {self.session_data.patient_age}  |  Gender: {self.session_data.patient_gender}")

    def _create_top_card(self, title, val, layout):
        gb = QGroupBox()
        l = QVBoxLayout()
        t = QLabel(title)
        t.setStyleSheet("color: #94a3b8; font-size: 12px;")
        t.setAlignment(Qt.AlignCenter)
        v = QLabel(val)
        v.setStyleSheet("font-size: 20px; font-weight: bold; color: #e0e0e0;")
        v.setAlignment(Qt.AlignCenter)
        l.addWidget(t)
        l.addWidget(v)
        gb.setLayout(l)
        layout.addWidget(gb)
        return v

    def _add_metric_row(self, layout, row, label):
        layout.addWidget(QLabel(label), row, 0)
        lbl = QLabel("-")
        lbl.setStyleSheet("font-weight: bold;")
        layout.addWidget(lbl, row, 1)
        return lbl

    def _set_badge(self, lbl, text, status):
        col = "#22C55E" if status == "Good" else "#F59E0B" if status == "Moderate" else "#EF4444"
        lbl.setText(text)
        lbl.setStyleSheet(f"font-weight: bold; color: {col};")

    def update_command_history(self):
        self.hist_table.setRowCount(0)
        for t, seq, cmd, src in reversed(self.session_data.command_history[-20:]):
            row = self.hist_table.rowCount()
            self.hist_table.insertRow(row)
            self.hist_table.setItem(row, 0, QTableWidgetItem(f"{t:.1f}s"))
            self.hist_table.setItem(row, 1, QTableWidgetItem(str(seq)))
            self.hist_table.setItem(row, 2, QTableWidgetItem(cmd))
            self.hist_table.setItem(row, 3, QTableWidgetItem(src))

    def update_metrics(self):
        dur = int(self.session_data.get_session_duration())
        self.lbl_dur.setText(f"{dur//3600:02d}:{(dur%3600)//60:02d}:{dur%60:02d}")
        self.lbl_pkts.setText(str(self.session_data.total_packets))
        self.lbl_blinks.setText(str(self.session_data.total_blink_sequences))
        self.lbl_cmds.setText(str(self.session_data.command_count))
        
        # We need report_generator to run _analyze_session
        from report_generator import ReportGenerator
        stats = ReportGenerator._analyze_session(self.session_data)
        
        self.lbl_grade.setText(stats['overall_grade'])
        col = "#22C55E" if stats['overall_grade'] in ["A", "B"] else "#F59E0B" if stats['overall_grade'] == "C" else "#EF4444"
        self.lbl_grade.setStyleSheet(f"font-size: 20px; font-weight: bold; color: {col};")
        
        # Top card updates
        sig_qual = "Good" if stats['contact_quality'] == "Optimal" else "Moderate" if stats['contact_quality'] == "Inconsistent" else "Poor"
        self._set_badge(self.lbl_sig_qual, sig_qual, sig_qual)
        
        # Section 1
        self.lbl_sig_rel.setText(f"{stats['signal_reliability']}%")
        self.lbl_cont_qual.setText(stats['contact_quality'])
        self.lbl_worst_sig.setText(stats['worst_signal'])
        self.lbl_base_drift.setText(stats['baseline_drift'])
        
        # Section 2
        self.lbl_blk_rel.setText(f"{stats['blink_reliability']}%")
        self.lbl_tot_cmds.setText(str(stats['total_cmds']))
        dist_str = ", ".join([f"{k}:{v:.0f}%" for k, v in stats['dist'].items() if v > 0]) or "None"
        self.lbl_cmd_dist.setText(dist_str)
        self.lbl_ctrl_strain.setText(stats['control_strain'])
        
        # Section 3
        self.lbl_safe_evts.setText(str(stats['safety_events']))
        self.lbl_recs.setText(stats['recommendations'])
        
        # Section 5 text
        interp = f"Session overall grade was {stats['overall_grade']}. "
        interp += f"Contact quality was {stats['contact_quality']}. "
        interp += f"Blink control reliability was {stats['blink_reliability']}%. "
        interp += f"Control strain was {stats['control_strain']}. "
        interp += stats['recommendations']
        self.txt_interp.setPlainText(interp)

        # Best Snapshot update
        if len(self.session_data.history_timestamps) > 600: # ~60s at 10Hz
            self.snap_overlay.hide()
            # Find a 5s segment with good variance and low noise. We'll just grab recent 5s if stable.
            if stab in ["Good", "Moderate"]:
                seg_len = min(50, len(recent_raw))
                self.snap_raw.setData(recent_raw[-seg_len:])
                self.snap_base.setData(list(self.session_data.baseline)[-seg_len:])
                self.snap_thresh.setData(list(self.session_data.blink_threshold)[-seg_len:])

    def start_report(self):
        if len(self.session_data.history_timestamps) < 10:
            QMessageBox.warning(self, "Warning", "Not enough data. Please start receiving telemetry first.")
            return
            
        self.btn_gen.setEnabled(False)
        self.report_countdown = 60
        self.lbl_rep_stat.setText(f"Collecting telemetry... {self.report_countdown}s")
        self.report_timer.start(1000)

    def handle_report_tick(self):
        self.report_countdown -= 1
        if self.report_countdown > 10:
            self.lbl_rep_stat.setText(f"Collecting telemetry... {self.report_countdown}s")
        elif self.report_countdown > 0:
            self.lbl_rep_stat.setText(f"Capturing best signal snapshot... {self.report_countdown}s")
        else:
            self.report_timer.stop()
            self.lbl_rep_stat.setText("Generating PDF...")
            self.generate_and_save_report()

    def generate_and_save_report(self):
        path, _ = QFileDialog.getSaveFileName(self, "Save Report", "NuroSync_Clinical_Report.pdf", "PDF Files (*.pdf)")
        if path:
            csv_path = path.replace(".pdf", ".csv")
            
            # Save snapshot image
            img_path = "snapshot_tmp.png"
            exporter = pyqtgraph.exporters.ImageExporter(self.plot_widget.plotItem)
            exporter.parameters()['width'] = 800
            exporter.export(img_path)
            
            from app.report_generator import ReportGenerator
            
            clin_text = self.txt_interp.toPlainText()
            ReportGenerator.export_pdf(path, self.session_data, img_path, clin_text)
            ReportGenerator.export_csv(csv_path, self.session_data)
            
            if os.path.exists(img_path):
                os.remove(img_path)
                
            self.lbl_rep_stat.setText("Download complete.")
            QMessageBox.information(self, "Success", f"Report saved to:\n{path}\n{csv_path}")
        else:
            self.lbl_rep_stat.setText("")
            
        self.btn_gen.setEnabled(True)

class SettingsPage(QWidget):
    def __init__(self, session_data, serial_worker, calibrator):
        super().__init__()
        self.session_data = session_data
        self.serial_worker = serial_worker
        self.calibrator = calibrator
        self.init_ui()
        self.serial_worker.connected.connect(self.on_connected)
        self.serial_worker.disconnected.connect(self.on_disconnected)
        self.serial_worker.raw_line_received.connect(self.on_raw_line)
        self.serial_worker.error_occurred.connect(self.on_error)

    def init_ui(self):
        from PySide6.QtWidgets import QScrollArea
        
        # Create a scroll area for Settings tab to prevent squishing on low height resolutions
        scroll = QScrollArea(self)
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("QScrollArea { border: none; background-color: transparent; }")
        
        container = QWidget()
        container.setStyleSheet("background-color: transparent;")
        
        # Side-by-side main layout for better use of horizontal screen space
        main_layout = QHBoxLayout(container)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(15)
        
        # Left column: Connection, Diagnostic Counters, Test Injection
        left_layout = QVBoxLayout()
        left_layout.setSpacing(15)
        
        conn_gb = QGroupBox("Connection Settings")
        conn_l = QFormLayout()
        
        self.combo = QComboBox()
        self.refresh_ports()
        btn_refresh = QPushButton("Refresh Ports")
        btn_refresh.clicked.connect(self.refresh_ports)
        port_l = QHBoxLayout()
        port_l.addWidget(self.combo)
        port_l.addWidget(btn_refresh)
        
        baud_combo = QComboBox()
        baud_combo.addItem("115200")
        
        btn_conn_l = QHBoxLayout()
        self.btn_conn = QPushButton("Connect")
        self.btn_conn.clicked.connect(self.connect_serial)
        self.btn_conn.setStyleSheet("background-color: #22C55E; color: white;")
        self.btn_disconn = QPushButton("Disconnect")
        self.btn_disconn.clicked.connect(self.disconnect_serial)
        self.btn_disconn.setEnabled(False)
        self.btn_disconn.setStyleSheet("background-color: #EF4444; color: white;")
        btn_conn_l.addWidget(self.btn_conn)
        btn_conn_l.addWidget(self.btn_disconn)
        
        self.lbl_status = QLabel("Disconnected")
        self.lbl_status.setStyleSheet("color: #EF4444; font-weight: bold;")
        
        conn_l.addRow("COM Port:", port_l)
        conn_l.addRow("Baud Rate:", baud_combo)
        conn_l.addRow("Action:", btn_conn_l)
        conn_l.addRow("Status:", self.lbl_status)
        conn_gb.setLayout(conn_l)
        left_layout.addWidget(conn_gb)
        
        stats_gb = QGroupBox("Diagnostic Counters")
        stats_l = QFormLayout()
        self.lbl_raw = QLabel("0")
        self.lbl_pkt = QLabel("0")
        self.lbl_cmd = QLabel("0")
        self.lbl_err = QLabel("0")
        stats_l.addRow("Raw Lines:", self.lbl_raw)
        stats_l.addRow("Valid Packets:", self.lbl_pkt)
        stats_l.addRow("Commands:", self.lbl_cmd)
        stats_l.addRow("Parse Errors:", self.lbl_err)
        stats_gb.setLayout(stats_l)
        left_layout.addWidget(stats_gb)
        
        test_gb = QGroupBox("Test Injection")
        test_l = QHBoxLayout()
        btn_inj_tel = QPushButton("Inject Telemetry")
        btn_inj_tel.clicked.connect(self.inject_telemetry)
        btn_inj_cmd = QPushButton("Inject Command")
        btn_inj_cmd.clicked.connect(self.inject_command)
        test_l.addWidget(btn_inj_tel)
        test_l.addWidget(btn_inj_cmd)
        test_gb.setLayout(test_l)
        left_layout.addWidget(test_gb)
        
        left_layout.addStretch()
        
        # Right column: Smart Blink Calibration
        right_layout = QVBoxLayout()
        right_layout.setSpacing(15)
        
        # Smart Blink Calibration GroupBox
        cal_gb = QGroupBox("Smart Blink Calibration")
        cal_l = QVBoxLayout()
        
        # Upper control layout
        ctrl_layout = QHBoxLayout()
        self.btn_start_cal = QPushButton("Start Auto Calibration")
        self.btn_start_cal.setStyleSheet("background-color: #00E5FF; color: #050816; font-weight: bold;")
        self.btn_recal_cmd = QPushButton("Send Recalibrate Command")
        self.btn_recal_cmd.setStyleSheet("background-color: #3b82f6; color: white;")
        ctrl_layout.addWidget(self.btn_start_cal)
        ctrl_layout.addWidget(self.btn_recal_cmd)
        cal_l.addLayout(ctrl_layout)
        
        # Status Label and Progress Bar
        self.lbl_cal_status = QLabel("Status: Idle")
        self.lbl_cal_status.setStyleSheet("font-weight: bold; color: #94a3b8;")
        self.cal_progress = QProgressBar()
        self.cal_progress.setValue(0)
        self.cal_progress.setFixedHeight(15)
        self.cal_progress.setStyleSheet("""
            QProgressBar {
                border: 1px solid #334155;
                border-radius: 4px;
                background-color: #0F172A;
                text-align: center;
            }
            QProgressBar::chunk {
                background-color: #00E5FF;
                border-radius: 3px;
            }
        """)
        cal_l.addWidget(self.lbl_cal_status)
        cal_l.addWidget(self.cal_progress)
        
        # Form grid layout for values
        form_grid = QGridLayout()
        form_grid.setSpacing(10)
        
        # Current Baseline
        form_grid.addWidget(QLabel("Current Baseline:"), 0, 0)
        self.lbl_val_baseline = QLabel("-")
        form_grid.addWidget(self.lbl_val_baseline, 0, 1)
        
        # Noise Level
        form_grid.addWidget(QLabel("Noise Level:"), 0, 2)
        self.lbl_val_noise = QLabel("-")
        form_grid.addWidget(self.lbl_val_noise, 0, 3)
        
        # Average Blink Peak
        form_grid.addWidget(QLabel("Average Blink Peak:"), 1, 0)
        self.lbl_val_avg_peak = QLabel("-")
        form_grid.addWidget(self.lbl_val_avg_peak, 1, 1)
        
        # Recommended Threshold
        form_grid.addWidget(QLabel("Recommended Threshold:"), 1, 2)
        self.lbl_val_rec_thresh = QLabel("-")
        self.lbl_val_rec_thresh.setStyleSheet("font-weight: bold; color: #00E5FF;")
        form_grid.addWidget(self.lbl_val_rec_thresh, 1, 3)
        
        # Strength & Confidence & Timestamp
        form_grid.addWidget(QLabel("Blink Strength:"), 2, 0)
        self.lbl_val_strength = QLabel("-")
        form_grid.addWidget(self.lbl_val_strength, 2, 1)
        
        form_grid.addWidget(QLabel("Confidence:"), 2, 2)
        self.lbl_val_confidence = QLabel("-")
        form_grid.addWidget(self.lbl_val_confidence, 2, 3)
        
        form_grid.addWidget(QLabel("Last Calibration:"), 3, 0)
        self.lbl_val_timestamp = QLabel("-")
        form_grid.addWidget(self.lbl_val_timestamp, 3, 1, 1, 3)
        
        cal_l.addLayout(form_grid)
        
        # Actions Layout: vertical structure to fit cleanly inside right column width
        act_layout = QVBoxLayout()
        act_layout.setSpacing(10)
        
        auto_layout = QHBoxLayout()
        self.btn_apply_auto = QPushButton("Apply Auto Threshold")
        self.btn_apply_auto.setStyleSheet("background-color: #22C55E; color: white;")
        self.btn_apply_auto.setEnabled(False)
        auto_layout.addWidget(self.btn_apply_auto)
        auto_layout.addStretch()
        
        manual_layout = QHBoxLayout()
        self.inp_manual_thresh = QLineEdit()
        self.inp_manual_thresh.setPlaceholderText("Enter custom threshold")
        self.inp_manual_thresh.setFixedWidth(150)
        self.btn_apply_manual = QPushButton("Apply Manual Threshold")
        self.btn_apply_manual.setStyleSheet("background-color: #3b82f6; color: white;")
        
        manual_layout.addWidget(QLabel("Manual Threshold: "))
        manual_layout.addWidget(self.inp_manual_thresh)
        manual_layout.addWidget(self.btn_apply_manual)
        manual_layout.addStretch()
        
        act_layout.addLayout(auto_layout)
        act_layout.addLayout(manual_layout)
        cal_l.addLayout(act_layout)
        
        # Warning label for compatibility
        self.lbl_compat_warning = QLabel("Warning: Firmware must support T:<value> command to apply threshold.")
        self.lbl_compat_warning.setStyleSheet("color: #F59E0B; font-weight: bold; font-style: italic; font-size: 12px; margin-top: 5px;")
        self.lbl_compat_warning.setWordWrap(True)
        cal_l.addWidget(self.lbl_compat_warning)
        
        cal_gb.setLayout(cal_l)
        right_layout.addWidget(cal_gb)
        
        right_layout.addStretch()
        
        # Assemble columns
        main_layout.addLayout(left_layout, stretch=1)
        main_layout.addLayout(right_layout, stretch=1)
        
        scroll.setWidget(container)
        
        # Page level layout holding the scroll area
        page_layout = QVBoxLayout(self)
        page_layout.setContentsMargins(0, 0, 0, 0)
        page_layout.addWidget(scroll)
        self.setLayout(page_layout)
        
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_stats)
        self.timer.start(100)
        
        # Connect calibration events and triggers
        self.btn_start_cal.clicked.connect(self.calibrator.start_calibration)
        self.btn_recal_cmd.clicked.connect(self.send_recalibrate_command)
        self.btn_apply_auto.clicked.connect(self.apply_auto_threshold)
        self.btn_apply_manual.clicked.connect(self.apply_manual_threshold)
        
        self.calibrator.status_changed.connect(self.on_cal_status_changed)
        self.calibrator.calibration_finished.connect(self.on_cal_finished)
        self.session_data.data_updated.connect(self.update_calibration_fields)

    def on_cal_status_changed(self, msg, pct):
        self.lbl_cal_status.setText(f"Status: {msg}")
        self.lbl_cal_status.setStyleSheet("font-weight: bold; color: #F59E0B;")
        self.cal_progress.setValue(pct)
        self.btn_start_cal.setEnabled(False)

    def on_cal_finished(self, success, message):
        self.btn_start_cal.setEnabled(True)
        if success:
            self.lbl_cal_status.setText("Status: Calibration Complete.")
            self.lbl_cal_status.setStyleSheet("font-weight: bold; color: #22C55E;")
            self.cal_progress.setValue(100)
        else:
            self.lbl_cal_status.setText(f"Status: Failed - {message}")
            self.lbl_cal_status.setStyleSheet("font-weight: bold; color: #EF4444;")
            self.cal_progress.setValue(0)
            # Since calibrator might fail before running, notify via messagebox if active tab is Settings
            QMessageBox.warning(self, "Calibration Failed", message)
        self.update_calibration_fields()

    def update_calibration_fields(self):
        sd = self.session_data
        if sd.last_cal_threshold is not None:
            self.lbl_val_baseline.setText(f"{sd.last_cal_baseline:.1f}")
            self.lbl_val_noise.setText(f"{sd.last_cal_noise:.2f}")
            self.lbl_val_avg_peak.setText(f"{sd.last_cal_avg_peak:.1f}")
            self.lbl_val_rec_thresh.setText(f"{sd.last_cal_threshold:.0f}")
            
            self.lbl_val_strength.setText(sd.last_cal_strength)
            if sd.last_cal_strength == "Strong":
                self.lbl_val_strength.setStyleSheet("color: #22C55E; font-weight: bold;")
            elif sd.last_cal_strength == "Moderate":
                self.lbl_val_strength.setStyleSheet("color: #F59E0B; font-weight: bold;")
            else:
                self.lbl_val_strength.setStyleSheet("color: #EF4444; font-weight: bold;")
                
            self.lbl_val_confidence.setText(sd.last_cal_confidence)
            if sd.last_cal_confidence == "High":
                self.lbl_val_confidence.setStyleSheet("color: #22C55E; font-weight: bold;")
            elif sd.last_cal_confidence == "Medium":
                self.lbl_val_confidence.setStyleSheet("color: #F59E0B; font-weight: bold;")
            else:
                self.lbl_val_confidence.setStyleSheet("color: #EF4444; font-weight: bold;")
                
            self.lbl_val_timestamp.setText(sd.last_cal_timestamp)
            self.btn_apply_auto.setEnabled(True)
        else:
            self.lbl_val_baseline.setText("-")
            self.lbl_val_noise.setText("-")
            self.lbl_val_avg_peak.setText("-")
            self.lbl_val_rec_thresh.setText("-")
            self.lbl_val_rec_thresh.setStyleSheet("")
            self.lbl_val_strength.setText("-")
            self.lbl_val_strength.setStyleSheet("")
            self.lbl_val_confidence.setText("-")
            self.lbl_val_confidence.setStyleSheet("")
            self.lbl_val_timestamp.setText("-")
            self.btn_apply_auto.setEnabled(False)

    def send_recalibrate_command(self):
        if not self.serial_worker or not self.serial_worker.serial_port or not self.serial_worker.serial_port.is_open:
            QMessageBox.warning(self, "Warning", "Connect headband first.")
            return
            
        success = self.serial_worker.write_line("C\n")
        if success:
            self.session_data.add_command("RECALIBRATE", source="Diagnostic App UI")
            QMessageBox.information(self, "Success", "Recalibration command 'C' sent successfully.")
        else:
            QMessageBox.critical(self, "Error", "Failed to send Recalibrate command.")

    def apply_auto_threshold(self):
        if not self.serial_worker or not self.serial_worker.serial_port or not self.serial_worker.serial_port.is_open:
            QMessageBox.warning(self, "Warning", "Connect headband first.")
            return
            
        val = self.session_data.last_cal_threshold
        if val is None:
            QMessageBox.warning(self, "Warning", "Please run calibration first.")
            return
            
        thresh_val = int(round(val))
        success = self.serial_worker.write_line(f"T:{thresh_val}\n")
        if success:
            self.session_data.add_command(f"THRESHOLD_AUTO:{thresh_val}", source="Diagnostic App UI")
            QMessageBox.warning(self, "Warning", f"Threshold command 'T:{thresh_val}' sent.\n\nFirmware must support T:<value> command to apply threshold.")
        else:
            QMessageBox.critical(self, "Error", "Failed to send threshold command.")

    def apply_manual_threshold(self):
        if not self.serial_worker or not self.serial_worker.serial_port or not self.serial_worker.serial_port.is_open:
            QMessageBox.warning(self, "Warning", "Connect headband first.")
            return
            
        txt = self.inp_manual_thresh.text().strip()
        try:
            val = int(txt)
            if not (0 <= val <= 4095):
                raise ValueError()
        except ValueError:
            QMessageBox.warning(self, "Warning", "Please enter a valid threshold integer (0 - 4095).")
            return
            
        success = self.serial_worker.write_line(f"T:{val}\n")
        if success:
            self.session_data.add_command(f"THRESHOLD_MANUAL:{val}", source="Diagnostic App UI")
            QMessageBox.warning(self, "Warning", f"Manual threshold command 'T:{val}' sent.\n\nFirmware must support T:<value> command to apply threshold.")
        else:
            QMessageBox.critical(self, "Error", "Failed to send threshold command.")

    def refresh_ports(self):
        self.combo.clear()
        self.combo.addItems(self.serial_worker.get_available_ports())

    def connect_serial(self):
        port = self.combo.currentText()
        if port:
            self.serial_worker.connect_port(port, 115200)

    def disconnect_serial(self):
        self.serial_worker.disconnect_port()

    def on_connected(self, port):
        self.lbl_status.setText(f"Connected to {port}")
        self.lbl_status.setStyleSheet("color: #22C55E; font-weight: bold;")
        self.btn_conn.setEnabled(False)
        self.btn_disconn.setEnabled(True)

    def on_disconnected(self):
        self.lbl_status.setText("Disconnected")
        self.lbl_status.setStyleSheet("color: #EF4444; font-weight: bold;")
        self.btn_conn.setEnabled(True)
        self.btn_disconn.setEnabled(False)

    def on_error(self, err_msg):
        self.lbl_status.setText("Connection Failed")
        self.lbl_status.setStyleSheet("color: #EF4444; font-weight: bold;")
        self.btn_conn.setEnabled(True)
        self.btn_disconn.setEnabled(False)
        QMessageBox.critical(self, "Connection Error", err_msg)

    def on_raw_line(self, line):
        self.session_data.raw_line_count += 1

    def update_stats(self):
        self.lbl_raw.setText(str(self.session_data.raw_line_count))
        self.lbl_pkt.setText(str(self.session_data.total_packets))
        self.lbl_cmd.setText(str(self.session_data.command_count))
        self.lbl_err.setText(str(self.session_data.parse_error_count))

    def inject_telemetry(self):
        r = 2000 + random.randint(-100, 100)
        self.session_data.add_telemetry(r, 2000, 2100, f"Raw_Signal:{r},Baseline:2000,Blink_Threshold:2100")

    def inject_command(self):
        cmd = random.choice(["FORWARD", "LEFT", "RIGHT", "BACKWARD", "STOP", "EMERGENCY_STOP"])
        self.session_data.add_command(cmd)

class NuroSyncApp(QMainWindow):
    def __init__(self, serial_worker, parser):
        super().__init__()
        self.setWindowTitle("NuroSync Premium Desktop Monitor")
        self.resize(1000, 750)
        self.setStyleSheet(PREMIUM_THEME_QSS)
        
        self.session_data = SessionData()
        self.serial_worker = serial_worker
        self.calibrator = SmartBlinkCalibrator(self.serial_worker, self.session_data)
        
        parser.telemetry_received.connect(lambda r, b, t: self.session_data.add_telemetry(r, b, t))
        parser.telemetry_received.connect(self.calibrator.handle_telemetry)
        parser.command_received.connect(self.session_data.add_command)
        parser.parse_error.connect(lambda e: self.session_data.add_parse_error())
        parser.blink_detected.connect(self.session_data.blink_detected.emit)
        parser.blink_executed.connect(self.session_data.blink_executed.emit)
        
        cw = QWidget()
        l = QVBoxLayout()
        
        # Top Bar
        top_bar = QHBoxLayout()
        title_l = QVBoxLayout()
        title = QLabel("NuroSync")
        title.setObjectName("title")
        subtitle = QLabel("EOG Blink Assistive Control Monitor")
        subtitle.setObjectName("subtitle")
        title_l.addWidget(title)
        title_l.addWidget(subtitle)
        
        top_bar.addLayout(title_l)
        top_bar.addStretch()
        
        self.lbl_top_status = QLabel("Disconnected")
        self.lbl_top_status.setStyleSheet("background: #EF4444; color: white; padding: 5px 15px; border-radius: 12px; font-weight: bold;")
        self.lbl_top_timer = QLabel("00:00:00")
        self.lbl_top_timer.setStyleSheet("font-size: 20px; font-family: monospace; color: #00E5FF; font-weight: bold; margin-left: 15px;")
        
        top_bar.addWidget(self.lbl_top_status)
        top_bar.addWidget(self.lbl_top_timer)
        l.addLayout(top_bar)
        
        self.tabs = QTabWidget()
        self.dash = DashboardPage(self.session_data, self.serial_worker, self.calibrator)
        self.live = LiveSignalsPage(self.session_data)
        self.clin_rep = ClinicalEOGReportPage(self.session_data)
        self.sett = SettingsPage(self.session_data, self.serial_worker, self.calibrator)
        
        self.tabs.addTab(self.dash, "Dashboard")
        self.tabs.addTab(self.live, "Live Signals")
        self.tabs.addTab(self.clin_rep, "Clinical EOG Report")
        self.tabs.addTab(self.sett, "Settings")
        
        self.serial_worker.connected.connect(self.on_connected)
        self.serial_worker.disconnected.connect(self.on_disconnected)
        self.serial_worker.raw_line_received.connect(self.live.append_raw_line)
        self.serial_worker.error_occurred.connect(self.on_error)
        
        l.addWidget(self.tabs)
        cw.setLayout(l)
        self.setCentralWidget(cw)
        
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_top_bar)
        self.timer.start(1000)

    def on_connected(self, port):
        self.lbl_top_status.setText("Connected")
        self.lbl_top_status.setStyleSheet("background: #22C55E; color: white; padding: 5px 15px; border-radius: 12px; font-weight: bold;")
        self.dash.set_serial_status(True, port)

    def on_disconnected(self):
        self.lbl_top_status.setText("Disconnected")
        self.lbl_top_status.setStyleSheet("background: #EF4444; color: white; padding: 5px 15px; border-radius: 12px; font-weight: bold;")
        self.dash.set_serial_status(False)

    def on_error(self, err_msg):
        self.lbl_top_status.setText("Error")
        self.lbl_top_status.setStyleSheet("background: #EF4444; color: white; padding: 5px 15px; border-radius: 12px; font-weight: bold;")
        self.dash.set_serial_status(False)

    def update_top_bar(self):
        dur = int(self.session_data.get_session_duration())
        self.lbl_top_timer.setText(f"{dur//3600:02d}:{(dur%3600)//60:02d}:{dur%60:02d}")

    def closeEvent(self, event):
        self.serial_worker.disconnect_port()
        super().closeEvent(event)
