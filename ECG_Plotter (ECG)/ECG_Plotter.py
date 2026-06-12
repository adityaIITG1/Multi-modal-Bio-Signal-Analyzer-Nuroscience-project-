
import sys
import os
import time
from datetime import datetime

import numpy as np
import serial
import serial.tools.list_ports

from PyQt5 import QtWidgets, QtCore
import pyqtgraph as pg
import pyqtgraph.exporters

from scipy.signal import butter, filtfilt, find_peaks

from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
import re


class NeuroPulseAIECGMonitor(QtWidgets.QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Real time ECG Monitor - Powered by NeuroPulse AI")
        self.resize(1520, 900)

        self.serial_port = None
        self.is_paused = False
        self.session_start_time = None
        self.generated_report = False

        # Firmware-aligned defaults
        self.max_seconds = 60.0
        self.fs_guess = 250.0
        self.default_port_name = "COM9"

        # Data buffers
        self.raw_samples = []         # list[(time_ms, ecg)]
        self.firmware_bpm_log = []    # list[(time_ms, bpm)] from "BPM:" lines if available
        self.synthetic_time_ms = 0.0
        self.last_sample_time = 0.0
        self.serial_buffer = ""
        self.byte_buffer = bytearray()
        self.last_raw_line = ""
        self.parse_fail_count = 0
        self.last_data_time = time.time()

        # Last computed state
        self.last_result = None
        self.last_ai_summary = ""
        self.last_report_path = None

        # Timers
        self.read_timer = QtCore.QTimer()
        self.read_timer.timeout.connect(self.read_serial_fast)

        self.plot_timer = QtCore.QTimer()
        self.plot_timer.timeout.connect(self.update_plots)
        self.plot_timer.start(40)

        self.report_check_timer = QtCore.QTimer()
        self.report_check_timer.timeout.connect(self.check_auto_report)
        self.report_check_timer.start(500)

        pg.setConfigOptions(antialias=False, useOpenGL=False)

        self.init_ui()
        self.apply_theme()
        self.refresh_ports()
        self.set_default_port(self.default_port_name)
        self.setup_plots()
        self.showMaximized() # Ensure it fits the screen

    def init_ui(self):
        central = QtWidgets.QWidget()
        self.setCentralWidget(central)

        root = QtWidgets.QVBoxLayout(central)
        root.setContentsMargins(10, 8, 10, 8)
        root.setSpacing(8)

        header = QtWidgets.QFrame()
        header.setObjectName("card")
        header_layout = QtWidgets.QHBoxLayout(header)
        header_layout.setContentsMargins(18, 16, 18, 16)

        title_col = QtWidgets.QVBoxLayout()
        title_row = QtWidgets.QHBoxLayout()
        title_row.setSpacing(15)

        self.heart_label = QtWidgets.QLabel("❤")
        self.heart_label.setObjectName("heartIcon")
        self.heart_label.setAlignment(QtCore.Qt.AlignCenter)
        self.heart_label.setFixedSize(60, 60)

        self.title_label = QtWidgets.QLabel("Real time ECG Monitor")
        self.title_label.setObjectName("titleLabel")
        
        self.brand_label = QtWidgets.QLabel("Powered by NeuroPulse AI")
        self.brand_label.setObjectName("brandLabel")
        
        title_row.addWidget(self.heart_label)
        title_row.addWidget(self.title_label)
        title_row.addWidget(self.brand_label)
        title_row.addStretch()

        self.subtitle_label = QtWidgets.QLabel("High-Fidelity BioAmp Clinical Data Stream")
        self.subtitle_label.setObjectName("subtitleLabel")

        title_col.addLayout(title_row)
        title_col.addWidget(self.subtitle_label)
        
        # Pulsing Animation
        self.heart_anim = QtCore.QVariantAnimation()
        self.heart_anim.setDuration(800)
        self.heart_anim.setStartValue(22)
        self.heart_anim.setEndValue(32)
        self.heart_anim.setEasingCurve(QtCore.QEasingCurve.InOutQuad)
        self.heart_anim.setLoopCount(-1) # Infinite
        self.heart_anim.valueChanged.connect(self.update_heart_pulse)
        self.heart_anim.start()

        self.connection_badge = QtWidgets.QLabel("● Disconnected")
        self.connection_badge.setObjectName("badgeOff")
        self.connection_badge.setAlignment(QtCore.Qt.AlignCenter)
        self.connection_badge.setMinimumWidth(220)
        self.connection_badge.setMinimumHeight(40)

        header_layout.addLayout(title_col)
        header_layout.addStretch()
        header_layout.addWidget(self.connection_badge)
        root.addWidget(header)

        patient_card = QtWidgets.QFrame()
        patient_card.setObjectName("card")
        p_layout = QtWidgets.QHBoxLayout(patient_card)
        p_layout.setContentsMargins(14, 10, 14, 10)

        self.name_input = QtWidgets.QLineEdit()
        self.name_input.setPlaceholderText("Enter Patient Name")
        self.age_input = QtWidgets.QLineEdit()
        self.age_input.setPlaceholderText("Age")
        self.age_input.setFixedWidth(70)
        self.bg_input = QtWidgets.QLineEdit()
        self.bg_input.setPlaceholderText("Blood Group")
        self.bg_input.setFixedWidth(120)

        patient_lbl = QtWidgets.QLabel("<b>Patient Details:</b>")
        patient_lbl.setStyleSheet("color: #2D3748;")
        p_layout.addWidget(patient_lbl)
        p_layout.addWidget(self.name_input)
        p_layout.addWidget(self.age_input)
        p_layout.addWidget(self.bg_input)
        root.addWidget(patient_card)

        controls = QtWidgets.QFrame()
        controls.setObjectName("card")
        grid = QtWidgets.QGridLayout(controls)
        grid.setContentsMargins(14, 14, 14, 14)
        grid.setHorizontalSpacing(10)
        grid.setVerticalSpacing(8)

        self.port_combo = QtWidgets.QComboBox()
        self.baud_combo = QtWidgets.QComboBox()
        self.baud_combo.addItems(["115200", "230400", "460800", "921600"])
        self.baud_combo.setCurrentText("115200")

        self.mode_combo = QtWidgets.QComboBox()
        self.mode_combo.addItems([
            "CHORDS Protocol (Binary)",
            "Auto Detect",
            "Single ECG Value Per Line",
            "time_ms,ecg",
            "BPM Text Only",
        ])
        self.mode_combo.setCurrentText("CHORDS Protocol (Binary)")

        self.refresh_btn = QtWidgets.QPushButton("Refresh")
        self.refresh_btn.setObjectName("btnRefresh")
        self.connect_btn = QtWidgets.QPushButton("Connect")
        self.connect_btn.setObjectName("btnConnect")
        self.disconnect_btn = QtWidgets.QPushButton("Disconnect")
        self.disconnect_btn.setObjectName("btnDisconnect")
        self.pause_btn = QtWidgets.QPushButton("Pause")
        self.pause_btn.setObjectName("btnPause")
        self.clear_btn = QtWidgets.QPushButton("Clear Plot")
        self.clear_btn.setObjectName("btnClear")
        self.save_btn = QtWidgets.QPushButton("Save PNG")
        self.save_btn.setObjectName("btnSave")
        self.report_btn = QtWidgets.QPushButton("Generate Report")
        self.report_btn.setObjectName("btnSave")

        self.disconnect_btn.setEnabled(False)
        self.pause_btn.setEnabled(False)

        self.autoscale_toggle = QtWidgets.QCheckBox("Auto Scale")
        self.autoscale_toggle.setChecked(True)
        self.bandpass_toggle = QtWidgets.QCheckBox("ECG Filter")
        self.bandpass_toggle.setChecked(True)
        self.peak_toggle = QtWidgets.QCheckBox("R-Peaks")
        self.peak_toggle.setChecked(True)

        self.status_label = QtWidgets.QLabel("Ready")
        self.status_label.setObjectName("statusLabel")

        self.lowcut_spin = QtWidgets.QDoubleSpinBox()
        self.lowcut_spin.setRange(0.1, 20.0)
        self.lowcut_spin.setValue(0.5)
        self.lowcut_spin.setSingleStep(0.1)

        self.highcut_spin = QtWidgets.QDoubleSpinBox()
        self.highcut_spin.setRange(5.0, 100.0)
        self.highcut_spin.setValue(35.0)
        self.highcut_spin.setSingleStep(1.0)

        self.report_interval_spin = QtWidgets.QSpinBox()
        self.report_interval_spin.setRange(60, 600)
        self.report_interval_spin.setValue(60)
        self.report_interval_spin.setSuffix(" s")

        self.sample_rate_spin = QtWidgets.QDoubleSpinBox()
        self.sample_rate_spin.setRange(50.0, 1000.0)
        self.sample_rate_spin.setValue(250.0)
        self.sample_rate_spin.setSuffix(" Hz")
        self.sample_rate_spin.setSingleStep(5.0)

        grid.addWidget(self.make_label("COM Port"), 0, 0)
        grid.addWidget(self.port_combo, 0, 1)
        grid.addWidget(self.make_label("Baud"), 0, 2)
        grid.addWidget(self.baud_combo, 0, 3)
        grid.addWidget(self.make_label("Input Mode"), 0, 4)
        grid.addWidget(self.mode_combo, 0, 5)
        grid.addWidget(self.refresh_btn, 0, 6)
        grid.addWidget(self.connect_btn, 0, 7)
        grid.addWidget(self.disconnect_btn, 0, 8)
        grid.addWidget(self.pause_btn, 0, 9)
        grid.addWidget(self.clear_btn, 0, 10)
        grid.addWidget(self.save_btn, 0, 11)
        grid.addWidget(self.report_btn, 0, 12)

        grid.addWidget(self.autoscale_toggle, 1, 0, 1, 2)
        grid.addWidget(self.bandpass_toggle, 1, 2, 1, 2)
        grid.addWidget(self.peak_toggle, 1, 4, 1, 2)
        grid.addWidget(self.make_label("Status"), 1, 6)
        grid.addWidget(self.status_label, 1, 7, 1, 6)

        grid.addWidget(self.make_label("Low Cut"), 2, 0)
        grid.addWidget(self.lowcut_spin, 2, 1)
        grid.addWidget(self.make_label("High Cut"), 2, 2)
        grid.addWidget(self.highcut_spin, 2, 3)
        grid.addWidget(self.make_label("Report Every"), 2, 4)
        grid.addWidget(self.report_interval_spin, 2, 5)
        grid.addWidget(self.make_label("Sample Rate"), 2, 6)
        grid.addWidget(self.sample_rate_spin, 2, 7)

        tip_lbl = QtWidgets.QLabel("💡 Heart BioAmp ECGFilter sketch ke liye 'Single ECG Value Per Line' best hai.")
        tip_lbl.setStyleSheet("color: #F2994A; font-style: italic; font-size: 13px;")
        grid.addWidget(tip_lbl, 2, 8, 1, 5)
        root.addWidget(controls)

        stats_row = QtWidgets.QHBoxLayout()
        stats_row.setSpacing(10)
        self.stat_bpm = self.make_stat("BPM", "--")
        self.stat_quality = self.make_stat("Quality", "Idle")
        self.stat_peaks = self.make_stat("R-Peaks", "0")
        self.stat_session = self.make_stat("Session", "0s")
        self.stat_last = self.make_stat("Latest", "-")
        stats_row.addWidget(self.stat_bpm)
        stats_row.addWidget(self.stat_quality)
        stats_row.addWidget(self.stat_peaks)
        stats_row.addWidget(self.stat_session)
        stats_row.addWidget(self.stat_last)
        root.addLayout(stats_row)

        main = QtWidgets.QHBoxLayout()
        main.setSpacing(10)

        plot_card = QtWidgets.QFrame()
        plot_card.setObjectName("card")
        plot_layout = QtWidgets.QVBoxLayout(plot_card)
        plot_layout.setContentsMargins(10, 10, 10, 10)

        self.ecg_plot = pg.PlotWidget()
        self.ecg_plot.setBackground("#FFFFFF")
        self.ecg_plot.showGrid(x=True, y=True, alpha=0.8)
        self.ecg_plot.setTitle("ECG Clinical Stream", color="#2D3436", size="14pt")
        self.ecg_plot.setLabel("left", "mV", color="#4A5568", size="12pt")
        self.ecg_plot.setLabel("bottom", "Time (s)", color="#4A5568", size="12pt")

        self.bpm_plot = pg.PlotWidget()
        self.bpm_plot.setBackground("#FFFFFF")
        self.bpm_plot.showGrid(x=True, y=True, alpha=0.8)
        self.bpm_plot.setTitle("BPM Vital Trend", color="#2D3436", size="14pt")
        self.bpm_plot.setLabel("left", "BPM", color="#4A5568", size="12pt")
        self.bpm_plot.setLabel("bottom", "Time (s)", color="#4A5568", size="12pt")
        self.bpm_plot.setYRange(40, 140)

        axis_pen = pg.mkPen("#A0AEC0", width=1)
        for pw in [self.ecg_plot, self.bpm_plot]:
            pw.getAxis("left").setPen(axis_pen)
            pw.getAxis("bottom").setPen(axis_pen)
            pw.getAxis("left").setTextPen("#2D3748")
            pw.getAxis("bottom").setTextPen("#2D3748")

        plot_layout.addWidget(self.ecg_plot, 3)
        plot_layout.addWidget(self.bpm_plot, 2)
        main.addWidget(plot_card, 5)

        side_scroll = QtWidgets.QScrollArea()
        side_scroll.setWidgetResizable(True)
        side_scroll.setFrameShape(QtWidgets.QFrame.NoFrame)
        side_scroll.setHorizontalScrollBarPolicy(QtCore.Qt.ScrollBarAlwaysOff)
        
        side_card = QtWidgets.QFrame()
        side_card.setObjectName("card")
        side_layout = QtWidgets.QVBoxLayout(side_card)
        side_layout.setContentsMargins(10, 10, 10, 10)
        side_layout.setSpacing(6)

        panel_title = QtWidgets.QLabel("AI GRAPH ANALYST")
        panel_title.setObjectName("panelTitle")

        self.audience_combo = QtWidgets.QComboBox()
        self.audience_combo.addItems(["General User", "Physiotherapist", "Medical Doctor"])
        self.audience_combo.setMinimumHeight(35)

        self.analysis_output = QtWidgets.QTextEdit()
        self.analysis_output.setReadOnly(True)
        self.analysis_output.setObjectName("analystBox")
        self.analysis_output.setHtml("<i style='color:#718096;'>Click the button below...</i>")
        self.analysis_output.setMinimumHeight(180)

        obs_header = QtWidgets.QLabel("● OBSERVATIONS")
        obs_header.setObjectName("subHeader")
        self.obs_box = QtWidgets.QPlainTextEdit()
        self.obs_box.setReadOnly(True)
        self.obs_box.setObjectName("analystSmallBox")
        self.obs_box.setMaximumHeight(100)

        diag_header = QtWidgets.QLabel("● DIAGNOSTICS")
        diag_header.setObjectName("subHeader")
        self.diag_box = QtWidgets.QPlainTextEdit()
        self.diag_box.setReadOnly(True)
        self.diag_box.setObjectName("analystSmallBox")
        self.diag_box.setMaximumHeight(100)

        self.analyze_btn = QtWidgets.QPushButton("🚀 GENERATE CLINICAL INSIGHT")
        self.analyze_btn.setObjectName("analystBtn")
        self.analyze_btn.setMinimumHeight(45)

        side_layout.addWidget(panel_title)
        side_layout.addWidget(self.audience_combo)
        side_layout.addWidget(self.analysis_output)
        side_layout.addWidget(obs_header)
        side_layout.addWidget(self.obs_box)
        side_layout.addWidget(diag_header)
        side_layout.addWidget(self.diag_box)
        side_layout.addStretch()
        side_layout.addWidget(self.analyze_btn)
        
        side_scroll.setWidget(side_card)
        main.addWidget(side_scroll, 2)

        root.addLayout(main)

        self.refresh_btn.clicked.connect(self.refresh_ports)
        self.connect_btn.clicked.connect(self.connect_serial)
        self.disconnect_btn.clicked.connect(self.disconnect_serial)
        self.pause_btn.clicked.connect(self.toggle_pause)
        self.clear_btn.clicked.connect(self.clear_plot)
        self.save_btn.clicked.connect(self.save_plot)
        self.report_btn.clicked.connect(self.generate_report)
        self.analyze_btn.clicked.connect(self.generate_ai_insight)
        self.mode_combo.currentTextChanged.connect(self.on_mode_changed)

    def on_mode_changed(self, mode):
        self.clear_plot() # Reset buffers to avoid mixing time scales
        if mode == "CHORDS Protocol (Binary)":
            self.sample_rate_spin.setValue(250.0)
            self.status_label.setText("Mode: CHORDS (Binary) - Buffers Cleared - Rate 250Hz")
        elif mode == "Single ECG Value Per Line":
            self.sample_rate_spin.setValue(125.0)
            self.status_label.setText("Mode: Text Stream - Buffers Cleared - Rate 125Hz")

    def make_label(self, text):
        lbl = QtWidgets.QLabel(text)
        lbl.setObjectName("fieldLabel")
        return lbl

    def make_stat(self, title, value):
        card = QtWidgets.QFrame()
        card.setObjectName("card")
        lay = QtWidgets.QVBoxLayout(card)
        lay.setContentsMargins(14, 10, 14, 10)
        lay.setSpacing(2)
        t = QtWidgets.QLabel(title)
        t.setObjectName("statTitle")
        v = QtWidgets.QLabel(value)
        v.setObjectName("statValue")
        lay.addWidget(t)
        lay.addWidget(v)
        card.value_label = v
        return card

    def apply_theme(self):
        self.setStyleSheet("""
            QMainWindow { background: #F0F2F5; }
            QFrame#card {
                background: white;
                border: 1px solid #E2E8F0;
                border-radius: 12px;
            }
            QLabel#titleLabel { color: #1A202C; font-size: 32px; font-weight: 900; letter-spacing: -0.5px; }
            QLabel#brandLabel { 
                color: #D0021B; font-size: 18px; font-weight: 700; 
                font-style: italic; letter-spacing: 1px; padding-top: 8px;
            }
            QLabel#subtitleLabel { color: #718096; font-size: 12px; }
            QLabel#badgeOff {
                background: #FFF5F5; color: #C53030; border: 1px solid #FEB2B2;
                border-radius: 13px; font-weight: 700; padding: 8px 12px;
            }
            QLabel#badgeOn {
                background: #F0FFF4; color: #2F855A; border: 1px solid #9AE6B4;
                border-radius: 13px; font-weight: 700; padding: 8px 12px;
            }
            QLabel#fieldLabel { color: #2D3748; font-size: 13px; font-weight: 700; }
            QLabel#statusLabel {
                color: #4A5568; background: #EDF2F7; border: 1px solid #E2E8F0;
                border-radius: 10px; padding: 8px; font-size: 13px;
            }
            QLabel#statTitle { color: #718096; font-size: 13px; font-weight: 700; }
            QLabel#statValue { color: #2D3748; font-size: 22px; font-weight: 800; font-family: 'Consolas'; }
            QLabel#panelTitle { 
                color: #1A202C; font-size: 16px; font-weight: 900; 
                letter-spacing: 1.5px; border-bottom: 2px solid #D0021B; padding-bottom: 4px;
                margin-bottom: 5px;
            }
            QLabel#subHeader {
                color: #4A5568; font-size: 11px; font-weight: 800; letter-spacing: 1px;
                margin-top: 5px; margin-bottom: 2px;
            }
            QComboBox, QSpinBox, QDoubleSpinBox, QLineEdit {
                background: white; color: #2D3748; border: 1px solid #CBD5E0;
                border-radius: 10px; padding: 8px; font-size: 13px;
            }
            QPushButton {
                color: white; font-weight: 800; border: 1px solid rgba(0,0,0,0.05);
                border-radius: 12px; padding: 10px 16px; font-size: 13px;
            }
            QPushButton#btnRefresh { background: #3182CE; }
            QPushButton#btnConnect { background: #38A169; }
            QPushButton#btnDisconnect { background: #E53E3E; }
            QPushButton#btnPause { background: #805AD5; }
            QPushButton#btnClear { background: #ED8936; }
            QPushButton#btnSave { background: #319795; }
            QPushButton:hover { background-color: rgba(0,0,0,0.1); }
            QPushButton:disabled {
                background: #E2E8F0 !important;
                color: #A0AEC0 !important;
                border: 1px solid #CBD5E0;
            }
            QCheckBox { color: #2D3748; font-weight: 600; font-size: 13px; }
            QCheckBox::indicator {
                width: 16px; height: 16px; border-radius: 4px;
                border: 1px solid #CBD5E0; background: white;
            }
            QCheckBox::indicator:checked { background: #D0021B; border: 1px solid #D0021B; }
            QPlainTextEdit, QTextEdit {
                background: #F7FAFC; color: #2D3748; border: 1px solid #E2E8F0;
                border-radius: 10px; padding: 6px; font-size: 11px;
            }
            QTextEdit#analystBox {
                background: white; border: 1px solid #D0021B; color: #1A202C;
                font-family: 'Segoe UI'; font-size: 14px; padding: 10px;
            }
            QPlainTextEdit#analystSmallBox {
                background: #FAFAFA; border: 1px solid #E2E8F0; color: #4A5568;
                font-family: 'Consolas'; font-size: 11px;
            }
            QPushButton#analystBtn {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #D0021B, stop:1 #A10115);
                margin-top: 10px; font-size: 14px; letter-spacing: 1px;
            }
        """)

    def setup_plots(self):
        self.ecg_plot.clear()
        self.bpm_plot.clear()

        # Real medical look: Red for ECG
        self.curve_raw = self.ecg_plot.plot([], [], pen=pg.mkPen("#FF4D4D", width=1.5), name="Raw ECG")
        self.curve_filtered = self.ecg_plot.plot([], [], pen=pg.mkPen("#D0021B", width=2.0), name="Filtered ECG")
        self.curve_peaks = self.ecg_plot.plot([], [], pen=None, symbol='o', symbolBrush="#007AFF", symbolSize=7, name="R Peaks")

        self.curve_bpm = self.bpm_plot.plot([], [], pen=pg.mkPen("#2D3748", width=2), symbol='o', symbolSize=5)
        self.curve_fw_bpm = self.bpm_plot.plot([], [], pen=pg.mkPen("#718096", width=1, style=QtCore.Qt.DashLine), symbol='x', symbolSize=6)

    # ---------------------------
    # Serial
    # ---------------------------
    def refresh_ports(self):
        current = self.port_combo.currentText()
        self.port_combo.clear()
        ports = [port.device for port in serial.tools.list_ports.comports()]
        for p in ports:
            self.port_combo.addItem(p)
        if current:
            idx = self.port_combo.findText(current)
            if idx >= 0:
                self.port_combo.setCurrentIndex(idx)
        self.status_label.setText("Ports refreshed" if self.port_combo.count() else "No COM ports found")

    def set_default_port(self, port_name="COM9"):
        idx = self.port_combo.findText(port_name)
        if idx >= 0:
            self.port_combo.setCurrentIndex(idx)
        else:
            self.port_combo.insertItem(0, port_name)
            self.port_combo.setCurrentIndex(0)

    def connect_serial(self):
        self.clear_plot() # Always start fresh
        port = self.port_combo.currentText() or self.default_port_name
        baud = int(self.baud_combo.currentText())
        try:
            self.serial_port = serial.Serial(port, baud, timeout=0, write_timeout=0)
            
            # For some Arduinos/ESP32, we need to toggle DTR/RTS to start data flow
            self.serial_port.dtr = True
            self.serial_port.rts = True
            
            self.serial_port.reset_input_buffer()

            # Small delay for Arduino Bootloader/Reset
            time.sleep(1.5)
            
            # Send START command for CHORDS firmware
            self.serial_port.write(b"START\n")
            self.serial_port.flush()

            self.read_timer.start(2)
            self.connect_btn.setEnabled(False)
            self.disconnect_btn.setEnabled(True)
            self.pause_btn.setEnabled(True)

            self.connection_badge.setText(f"● Connected  {port}")
            self.connection_badge.setObjectName("badgeOn")
            self.connection_badge.style().unpolish(self.connection_badge)
            self.connection_badge.style().polish(self.connection_badge)

            self.status_label.setText(f"Connected to {port} @ {baud}")
            self.session_start_time = time.time()
            self.generated_report = False
            self.synthetic_time_ms = 0.0
        except Exception as e:
            self.status_label.setText(f"Connection failed: {e}")

    def disconnect_serial(self):
        self.read_timer.stop()
        if self.serial_port and self.serial_port.is_open:
            try:
                self.serial_port.write(b"STOP\n")
                self.serial_port.flush()
                time.sleep(0.1)
            except:
                pass
            self.serial_port.close()
        self.serial_port = None
        self.is_paused = False

        self.connect_btn.setEnabled(True)
        self.disconnect_btn.setEnabled(False)
        self.pause_btn.setEnabled(False)
        self.pause_btn.setText("Pause")

        self.connection_badge.setText("● Disconnected")
        self.connection_badge.setObjectName("badgeOff")
        self.connection_badge.style().unpolish(self.connection_badge)
        self.connection_badge.style().polish(self.connection_badge)

        self.status_label.setText("Disconnected")

    def toggle_pause(self):
        self.is_paused = not self.is_paused
        self.pause_btn.setText("Resume" if self.is_paused else "Pause")
        self.status_label.setText("Paused" if self.is_paused else "Live reading resumed")

    def clear_plot(self):
        self.raw_samples = []
        self.firmware_bpm_log = []
        self.synthetic_time_ms = 0.0
        self.last_result = None
        self.last_ai_summary = ""
        self.last_report_path = None
        self.serial_buffer = ""
        self.byte_buffer = bytearray()

        self.curve_raw.setData([], [])
        self.curve_filtered.setData([], [])
        self.curve_peaks.setData([], [])
        self.curve_bpm.setData([], [])
        self.curve_fw_bpm.setData([], [])

        self.stat_bpm.value_label.setText("--")
        self.stat_quality.value_label.setText("Idle")
        self.stat_peaks.value_label.setText("0")
        self.stat_session.value_label.setText("0s")
        self.stat_last.value_label.setText("-")
        self.obs_box.clear()
        self.diag_box.clear()
        self.analysis_output.setHtml("<i style='color:#718096;'>Waiting for fresh ECG data stream...</i>")
        self.status_label.setText("Plot cleared")

    def save_plot(self):
        path, _ = QtWidgets.QFileDialog.getSaveFileName(self, "Save ECG Plot", "ecg_plot.png", "PNG Files (*.png)")
        if not path:
            return
        exporter = pg.exporters.ImageExporter(self.ecg_plot.plotItem)
        exporter.export(path)
        self.status_label.setText(f"Saved: {path}")

    def read_serial_fast(self):
        if not self.serial_port or self.is_paused:
            return
        try:
            waiting = self.serial_port.in_waiting
            if waiting <= 0:
                return

            raw_bytes = self.serial_port.read(waiting)
            if not raw_bytes:
                return

            self.last_data_time = time.time()
            mode = self.mode_combo.currentText()

            if mode == "CHORDS Protocol (Binary)":
                self.byte_buffer.extend(raw_bytes)
                self.parse_binary_chords()
            else:
                self.serial_buffer += raw_bytes.decode(errors="ignore")
                if "\n" in self.serial_buffer:
                    lines = self.serial_buffer.split("\n")
                    self.serial_buffer = lines.pop() # Keep partial line
                    for line in lines:
                        clean = line.strip()
                        if clean:
                            self.last_raw_line = clean
                            self.parse_line(clean, mode)
            
            self.trim_buffers()
        except Exception as e:
            self.status_label.setText(f"Read error: {e}")
            self.disconnect_serial()

    def parse_binary_chords(self):
        # CHORDS Protocol: 0xC7 0x7C [Counter] [6 Channels * 2 Bytes BigEndian] [0x01]
        # Total PACKET_LEN = 16
        packet_len = 16
        now_ms = time.time() * 1000.0
        
        while len(self.byte_buffer) >= packet_len:
            if self.byte_buffer[0] == 0xC7 and self.byte_buffer[1] == 0x7C:
                if self.byte_buffer[15] == 0x01:
                    packet = self.byte_buffer[:packet_len]
                    self.byte_buffer = self.byte_buffer[packet_len:]
                    
                    ch0_high = packet[3]
                    ch0_low = packet[4]
                    ecg_val = (ch0_high << 8) | ch0_low
                    
                    # Ensure smooth 250Hz spacing (4ms per sample)
                    if self.last_sample_time == 0:
                        self.last_sample_time = now_ms
                    else:
                        self.last_sample_time += 4.0
                        
                    # Sync with real time if we fall too far behind
                    if (now_ms - self.last_sample_time) > 500:
                        self.last_sample_time = now_ms

                    self.raw_samples.append((self.last_sample_time, float(ecg_val)))
                    self.last_raw_line = f"CHORDS Binary Packet (Ch0: {ecg_val})"
                else:
                    self.byte_buffer.pop(0)
            else:
                self.byte_buffer.pop(0)

    def parse_line(self, line, mode):
        if not line:
            return
        now_ms = time.time() * 1000.0

        # Explicit BPM text
        upper = line.upper()
        if "BPM" in upper:
            bpm_value = self.extract_bpm_from_text(line)
            if bpm_value is not None:
                self.firmware_bpm_log.append((now_ms, bpm_value))
            return

        parts = [p.strip() for p in line.split(",") if p.strip() != ""]

        # Forced modes
        if mode == "Single ECG Value Per Line":
            self.parse_single_value_line(parts)
            return
        elif mode == "time_ms,ecg":
            self.parse_time_value_line(parts)
            return
        elif mode == "BPM Text Only":
            return

        # Auto detect
        if len(parts) == 1:
            self.parse_single_value_line(parts)
        elif len(parts) >= 2:
            self.parse_time_value_line(parts)

    def parse_single_value_line(self, parts):
        try:
            # Clean non-numeric characters except dots and minus
            raw_val = parts[0]
            clean_val = re.sub(r"[^0-9\.\-]", "", raw_val)
            if not clean_val:
                self.parse_fail_count += 1
                return
            ecg = float(clean_val)
            self.parse_fail_count = 0
        except Exception:
            self.parse_fail_count += 1
            return
        dt_ms = 1000.0 / max(1.0, self.sample_rate_spin.value())
        self.synthetic_time_ms += dt_ms
        self.raw_samples.append((self.synthetic_time_ms, ecg))

    def parse_time_value_line(self, parts):
        try:
            t_raw = re.sub(r"[^0-9\.\-]", "", parts[0])
            v_raw = re.sub(r"[^0-9\.\-]", "", parts[1])
            if not t_raw or not v_raw:
                self.parse_fail_count += 1
                return
            t_ms = float(t_raw)
            ecg = float(v_raw)
            self.parse_fail_count = 0
        except Exception:
            self.parse_fail_count += 1
            return
        self.raw_samples.append((t_ms, ecg))

    def extract_bpm_from_text(self, line):
        cleaned = line.replace(":", " ").replace(",", " ")
        parts = cleaned.split()
        for token in parts:
            try:
                value = float(token)
                if 20 <= value <= 240:
                    return value
            except Exception:
                continue
        return None

    def trim_buffers(self):
        if self.raw_samples:
            t_latest = self.raw_samples[-1][0]
            cutoff = t_latest - self.max_seconds * 1000.0
            self.raw_samples = [s for s in self.raw_samples if s[0] >= cutoff]

        if self.firmware_bpm_log:
            t_latest = self.firmware_bpm_log[-1][0]
            cutoff = t_latest - self.max_seconds * 1000.0
            self.firmware_bpm_log = [s for s in self.firmware_bpm_log if s[0] >= cutoff]

    # ---------------------------
    # Signal processing
    # ---------------------------
    def estimate_fs(self, time_ms):
        if len(time_ms) < 5:
            return self.sample_rate_spin.value()
        diffs = np.diff(time_ms.astype(float))
        diffs = diffs[diffs > 0]
        if len(diffs) == 0:
            return self.sample_rate_spin.value()
        median_dt = np.median(diffs)
        fs = 1000.0 / median_dt
        return float(np.clip(fs, 50.0, 2000.0))

    def bandpass_filter(self, signal, fs):
        low = self.lowcut_spin.value()
        high = self.highcut_spin.value()
        if len(signal) < 30 or not self.bandpass_toggle.isChecked():
            return signal.astype(float)
        nyq = 0.5 * fs
        low_n = max(low / nyq, 1e-5)
        high_n = min(high / nyq, 0.99)
        if low_n >= high_n:
            return signal.astype(float)
        b, a = butter(3, [low_n, high_n], btype='band')
        try:
            return filtfilt(b, a, signal.astype(float))
        except Exception:
            return signal.astype(float)

    def detect_r_peaks(self, filtered, time_ms, fs):
        if len(filtered) < max(100, int(fs * 2)):
            return np.array([], dtype=int), np.array([], dtype=float)
        norm = (filtered - np.mean(filtered)) / (np.std(filtered) + 1e-8)
        distance = max(int(0.35 * fs), 1) # Increased distance to avoid double counting
        prominence = max(0.65, np.std(norm) * 0.4) # Increased prominence to filter noise
        peaks, _ = find_peaks(norm, distance=distance, prominence=prominence)
        rr = np.diff(time_ms[peaks]) if len(peaks) >= 2 else np.array([], dtype=float)
        rr = rr[(rr > 350) & (rr < 1500)]
        return peaks.astype(int), rr

    def signal_quality(self, filtered, peaks, fs):
        if len(filtered) < int(fs * 5):
            return "Short recording"
        std = np.std(filtered)
        peak_density = len(peaks) / max(len(filtered) / fs, 1)
        if std < 1e-3 or peak_density < 0.3:
            return "Poor"
        if peak_density < 0.6:
            return "Fair"
        return "Good"

    def analyze_current_window(self):
        if len(self.raw_samples) < 50:
            return None

        arr = np.array(self.raw_samples, dtype=float)
        time_ms = arr[:, 0]
        ecg = arr[:, 1]

        order = np.argsort(time_ms)
        time_ms = time_ms[order]
        ecg = ecg[order]

        fs = self.estimate_fs(time_ms)
        filtered = self.bandpass_filter(ecg, fs)
        peaks, rr = self.detect_r_peaks(filtered, time_ms, fs)

        if len(rr) > 0:
            bpm_values = 60000.0 / rr
            bpm_times = time_ms[peaks][1:1 + len(bpm_values)]
            mean_bpm = float(np.mean(bpm_values))
            min_bpm = float(np.min(bpm_values))
            max_bpm = float(np.max(bpm_values))
        else:
            bpm_values = np.array([], dtype=float)
            bpm_times = np.array([], dtype=float)
            mean_bpm = min_bpm = max_bpm = 0.0

        sdnn = float(np.std(rr, ddof=1)) if len(rr) > 1 else 0.0
        duration_sec = float((time_ms[-1] - time_ms[0]) / 1000.0) if len(time_ms) > 1 else 0.0
        quality = self.signal_quality(filtered, peaks, fs)

        return {
            "time_ms": time_ms,
            "ecg": ecg,
            "filtered": filtered,
            "peaks": peaks,
            "rr": rr,
            "bpm_times": bpm_times,
            "bpm_values": bpm_values,
            "mean_bpm": round(mean_bpm, 2),
            "min_bpm": round(min_bpm, 2),
            "max_bpm": round(max_bpm, 2),
            "sdnn": round(sdnn, 2),
            "duration_sec": round(duration_sec, 2),
            "fs": round(fs, 2),
            "quality": quality,
        }

    # ---------------------------
    # Update UI
    # ---------------------------
    def update_plots(self):
        result = self.analyze_current_window()
        self.last_result = result

        if result is not None:
            t_ms = result["time_ms"]
            # Auto-reset if time jump is too large (corruption check)
            if len(t_ms) > 1 and (t_ms[-1] - t_ms[0]) > (self.max_seconds + 10) * 1000.0:
                self.clear_plot()
                return

            t_sec = (t_ms - t_ms[0]) / 1000.0
            self.curve_raw.setData(t_sec, result["ecg"])
            self.curve_filtered.setData(t_sec, result["filtered"])

            # Keep window sliding (show last 10 seconds)
            cur_t = t_sec[-1]
            self.ecg_plot.setXRange(max(0, cur_t - 10), cur_t, padding=0)

            if self.peak_toggle.isChecked() and len(result["peaks"]) > 0:
                peak_t = t_sec[result["peaks"]]
                peak_y = result["filtered"][result["peaks"]]
                self.curve_peaks.setData(peak_t, peak_y)
            else:
                self.curve_peaks.setData([], [])

            if len(result["bpm_values"]) > 0:
                bpm_t = (result["bpm_times"] - result["time_ms"][0]) / 1000.0
                self.curve_bpm.setData(bpm_t, result["bpm_values"])
                self.stat_bpm.value_label.setText(f"{result['mean_bpm']:.1f}")
            else:
                self.curve_bpm.setData([], [])
                self.stat_bpm.value_label.setText("--")

            self.stat_quality.value_label.setText(result["quality"])
            self.stat_peaks.value_label.setText(str(len(result["peaks"])))
            self.stat_last.value_label.setText(f"{result['ecg'][-1]:.1f}")

            obs, diag = self.build_observations_diagnostics(result)
            self.obs_box.setPlainText("\n".join(f"• {x}" for x in obs))
            self.diag_box.setPlainText("\n".join(f"• {x}" for x in diag))

            # Auto-generate AI insight if we have enough peaks and it's currently empty/waiting
            if len(result["peaks"]) > 8:
                # Update every 300 plot cycles (~12 seconds) or if it's still "Waiting"
                if "Waiting" in self.analysis_output.toPlainText() or (int(time.time()) % 15 == 0):
                    self.generate_ai_insight()

        else:
            self.curve_raw.setData([], [])
            self.curve_filtered.setData([], [])
            self.curve_peaks.setData([], [])
            self.curve_bpm.setData([], [])

        # Firmware BPM overlay if present
        if self.firmware_bpm_log:
            bpm_arr = np.array(self.firmware_bpm_log, dtype=float)
            t0 = bpm_arr[0, 0]
            fw_t = (bpm_arr[:, 0] - t0) / 1000.0
            fw_bpm = bpm_arr[:, 1]
            self.curve_fw_bpm.setData(fw_t, fw_bpm)
        else:
            self.curve_fw_bpm.setData([], [])

        if self.session_start_time:
            elapsed = int(time.time() - self.session_start_time)
            self.stat_session.value_label.setText(f"{elapsed}s")
            if not self.generated_report:
                left = max(0, self.report_interval_spin.value() - elapsed)
                status_msg = f"Live capture running... auto report in {left}s"
                if self.parse_fail_count > 10:
                    status_msg += f" | ⚠️ PARSE ERROR: '{self.last_raw_line[:20]}...'"
                elif not self.raw_samples and self.last_raw_line:
                    status_msg += f" | 🔍 Raw data: '{self.last_raw_line[:20]}...'"
                
                if time.time() - self.last_data_time > 2.0 and not self.is_paused:
                    status_msg += " | ⏳ No data on port (Check Baud/Device)"
                
                self.status_label.setText(status_msg)

        if self.autoscale_toggle.isChecked():
            self.ecg_plot.enableAutoRange(axis='y', enable=True)
            self.bpm_plot.enableAutoRange(axis='y', enable=True)

        self.check_auto_report()

    # ---------------------------
    # Insight + report
    # ---------------------------
    def build_observations_diagnostics(self, result):
        obs = []
        diag = []

        obs.append(f"Recording duration {result['duration_sec']:.1f} sec at approx {result['fs']:.1f} Hz sampling.")
        obs.append(f"Detected {len(result['peaks'])} R-peaks with signal quality marked as {result['quality'].lower()}.")

        if result["mean_bpm"] > 0:
            obs.append(f"Average BPM {result['mean_bpm']:.1f}, range {result['min_bpm']:.1f} to {result['max_bpm']:.1f}.")
        else:
            obs.append("Stable BPM could not be estimated from the current ECG window.")

        if self.firmware_bpm_log:
            latest_fw_bpm = self.firmware_bpm_log[-1][1]
            obs.append(f"Firmware-reported BPM stream is also available. Latest firmware BPM {latest_fw_bpm:.1f}.")

        if result["sdnn"] > 0:
            obs.append(f"Estimated short-term variability (SDNN) {result['sdnn']:.1f} ms.")
        else:
            obs.append("RR variability could not be estimated reliably in the current window.")

        if result["quality"].lower() in {"poor", "short recording"}:
            diag.append("Signal quality is limited; BPM and HRV values should be treated as provisional.")
        elif result["quality"].lower() == "fair":
            diag.append("Signal is usable but electrode contact or motion control can be improved.")
        else:
            diag.append("Signal morphology is stable enough for engineering-level ECG review.")

        if result["mean_bpm"] <= 0:
            diag.append("Heart rate trend unavailable because peak detection was insufficient or noisy.")
        elif result["mean_bpm"] < 60:
            diag.append("Detected heart rate is below 60 BPM in this window.")
        elif result["mean_bpm"] <= 100:
            diag.append("Detected heart rate lies in the common resting reference range.")
        else:
            diag.append("Detected heart rate is above 100 BPM in this window.")

        if result["sdnn"] == 0:
            diag.append("HRV estimate unavailable from this sample window.")
        elif result["sdnn"] < 20:
            diag.append("Short-term variability appears low in this segment.")
        elif result["sdnn"] <= 80:
            diag.append("Short-term variability appears moderate in this segment.")
        else:
            diag.append("Short-term variability appears high or peak detection may be unstable.")

        diag.append("These are engineering diagnostics, not a clinical diagnosis.")
        return obs, diag

    def generate_ai_insight(self):
        result = self.last_result or self.analyze_current_window()
        if result is None:
            self.analysis_output.setHtml("<b style='color:#FF7B7B;'>Not enough ECG data yet.</b>")
            return

        audience = self.audience_combo.currentText()
        obs, diag = self.build_observations_diagnostics(result)

        if audience == "General User":
            summary = (
                f"<b style='color:#00FF85;'>STATUS:</b> Mean heart rate is {result['mean_bpm']:.1f} BPM. "
                f"Signal quality looks <b>{result['quality'].lower()}</b>. "
                "This is a project-style ECG interpretation, not a doctor report."
            )
        elif audience == "Physiotherapist":
            summary = (
                f"<b style='color:#FFD600;'>THERAPY VIEW:</b> ECG window shows {len(result['peaks'])} detected beats, "
                f"mean BPM {result['mean_bpm']:.1f}, SDNN {result['sdnn']:.1f} ms, "
                f"and overall signal quality {result['quality'].lower()}."
            )
        else:
            summary = (
                f"<b style='color:#00E5FF;'>CLINICAL VIEW:</b> Real-time processed ECG suggests "
                f"mean rate {result['mean_bpm']:.1f} BPM, quality {result['quality'].lower()}, "
                f"with {len(result['peaks'])} detected R-peaks in the current analysis window."
            )

        self.last_ai_summary = " ".join(obs + diag) + " AI Analyst note: this output is for engineering interpretation only."
        html = summary + "<br><br><b>Observations</b><br>" + "<br>".join("• " + x for x in obs) + "<br><br><b>Diagnostics</b><br>" + "<br>".join("• " + x for x in diag)
        
        # Non-blocking visual alert
        if result["mean_bpm"] > 0 and (result["mean_bpm"] < 50 or result["mean_bpm"] > 120):
            html = f"<div style='background:#FFF5F5; border:1px solid #FEB2B2; padding:8px; border-radius:5px; color:#C53030; font-weight:bold;'>⚠️ ABNORMAL RATE DETECTED: {result['mean_bpm']:.1f} BPM. Please check electrode contact.</div><br>" + html
            self.status_label.setStyleSheet("color: #C53030; font-weight: bold;")
        else:
            self.status_label.setStyleSheet("color: #4A5568; font-weight: normal;")

        self.analysis_output.setHtml(html)

    def check_auto_report(self):
        if not self.serial_port or not self.session_start_time or self.generated_report:
            return
        
        elapsed = time.time() - self.session_start_time
        interval = self.report_interval_spin.value()
        
        if elapsed >= interval:
            self.generated_report = True # Mark as done so it doesn't repeat
            self.generate_report(auto_open=True)
            self.status_label.setText("Initial Auto-Report Generated. Subsequent reports are manual.")

    def generate_report(self, auto_open=True):
        result = self.last_result or self.analyze_current_window()
        if result is None:
            self.status_label.setText("Not enough ECG data for report")
            return

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_dir = r"C:\Users\ASUS\OneDrive\Desktop\ECG_Plotter\ECG_Plotter_Reports"
        os.makedirs(report_dir, exist_ok=True)
        png_path_ecg = os.path.join(report_dir, f"ecg_stream_{ts}.png")
        png_path_bpm = os.path.join(report_dir, f"bpm_trend_{ts}.png")
        pdf_path = os.path.join(report_dir, f"NeuroPulseAI_ECG_Report_{ts}.pdf")

        try:
            exp_ecg = pg.exporters.ImageExporter(self.ecg_plot.plotItem)
            exp_ecg.export(png_path_ecg)
            exp_bpm = pg.exporters.ImageExporter(self.bpm_plot.plotItem)
            exp_bpm.export(png_path_bpm)
        except Exception as e:
            self.status_label.setText(f"Graph export failed: {e}")
            return

        patient_name = self.name_input.text().strip() or "Aditya Kumar Singh"
        patient_age = self.age_input.text().strip() or "N/A"
        patient_bg = self.bg_input.text().strip() or "N/A"

        obs, diag = self.build_observations_diagnostics(result)
        ai_summary = " ".join(obs + diag) + " AI Analyst note: this report supports engineering interpretation and is not a certified medical diagnosis."

        self.create_pdf_report(
            pdf_path=pdf_path,
            png_ecg=png_path_ecg,
            png_bpm=png_path_bpm,
            patient_name=patient_name,
            patient_age=patient_age,
            patient_bg=patient_bg,
            result=result,
            observations=obs,
            diagnostics=diag,
            ai_summary=ai_summary,
        )

        self.last_report_path = pdf_path
        self.status_label.setText(f"Report Ready: {pdf_path}")

        if auto_open:
            try:
                os.startfile(pdf_path)
            except Exception:
                pass

        # Cleanup temporary screenshots
        try:
            if os.path.exists(png_path_ecg): os.remove(png_path_ecg)
            if os.path.exists(png_path_bpm): os.remove(png_path_bpm)
        except Exception:
            pass

        QtWidgets.QMessageBox.information(self, "Report Generated", f"PDF report created:\n{pdf_path}")

    def create_pdf_report(self, pdf_path, png_ecg, png_bpm, patient_name, patient_age, patient_bg, result, observations, diagnostics, ai_summary):
        c = canvas.Canvas(pdf_path, pagesize=A4)
        width, height = A4

        def wrap(text, width_chars=100):
            words = text.split()
            lines = []
            current = ""
            for word in words:
                test = (current + " " + word).strip()
                if len(test) <= width_chars:
                    current = test
                else:
                    lines.append(current)
                    current = word
            if current:
                lines.append(current)
            return lines

        y = height - 45
        c.setFont("Helvetica-Bold", 18)
        c.drawString(40, y, "NeuroPulseAI ECG Analysis Report")
        y -= 15
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(40, y, "Clinical Grade BioAmp Monitoring System")
        y -= 25

        c.setFont("Helvetica", 10)
        c.drawString(40, y, f"Patient: {patient_name}    Age: {patient_age}    Blood Group: {patient_bg}")
        y -= 14
        c.drawString(40, y, f"Generated: {datetime.now().strftime('%d-%m-%Y %H:%M:%S')}")
        y -= 25

        # ECG Graph on first page
        if os.path.exists(png_ecg):
            c.setFont("Helvetica-Bold", 11)
            c.drawString(40, y, "I. ECG Clinical Waveform")
            y -= 190
            img = ImageReader(png_ecg)
            c.drawImage(img, 40, y, width=width - 80, height=180, preserveAspectRatio=True)
            y -= 20

        # BPM Graph
        if os.path.exists(png_bpm):
            c.setFont("Helvetica-Bold", 11)
            c.drawString(40, y, "II. BPM Vital Trend")
            y -= 130
            img = ImageReader(png_bpm)
            c.drawImage(img, 40, y, width=width - 80, height=120, preserveAspectRatio=True)
            y -= 25

        c.setFont("Helvetica-Bold", 11)
        c.drawString(40, y, "III. Analysis Metrics")
        y -= 15
        c.setFont("Helvetica", 9)
        metrics = [
            f"Session Duration: {result['duration_sec']}s",
            f"Mean BPM: {result['mean_bpm']}",
            f"R-Peak Count: {len(result['peaks'])}",
            f"Signal Quality: {result['quality']}",
        ]
        if self.firmware_bpm_log:
            metrics.append(f"Firmware BPM: {self.firmware_bpm_log[-1][1]:.1f}")
        
        # Horizontal metrics
        c.drawString(50, y, " | ".join(metrics))
        y -= 25

        c.setFont("Helvetica-Bold", 11)
        c.drawString(40, y, "IV. Clinical Observations")
        y -= 15
        c.setFont("Helvetica", 9)
        for item in observations[:4]: # Top 4 obs
            for idx, line in enumerate(wrap(item, 110)):
                prefix = u"\u2022 " if idx == 0 else "   "
                c.drawString(50, y, prefix + line)
                y -= 12
        
        y -= 15
        c.setFont("Helvetica-Bold", 11)
        c.drawString(40, y, "V. Engineering Diagnostics")
        y -= 15
        c.setFont("Helvetica", 9)
        for item in diagnostics[:4]:
            for idx, line in enumerate(wrap(item, 110)):
                prefix = u"\u2022 " if idx == 0 else "   "
                c.drawString(50, y, prefix + line)
                y -= 12

        y -= 20
        c.setFont("Helvetica-Bold", 10)
        c.drawString(40, y, "AI Summary Note:")
        y -= 14
        c.setFont("Helvetica-Oblique", 9)
        for line in wrap(ai_summary, 115):
            c.drawString(40, y, line)
            y -= 11

        c.setFont("Helvetica-Oblique", 7)
        c.drawString(40, 20, "This report is generated for engineering interpretation and educational purposes only. Not a clinical diagnosis.")
        c.save()


    def update_heart_pulse(self, size):
        self.heart_label.setStyleSheet(f"font-size: {size}px; color: #D0021B; border: none; background: transparent;")

if __name__ == "__main__":
    app = QtWidgets.QApplication(sys.argv)
    window = NeuroPulseAIECGMonitor()
    window.show()
    sys.exit(app.exec_())
