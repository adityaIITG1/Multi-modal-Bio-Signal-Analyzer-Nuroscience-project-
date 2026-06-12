import sys
import os
import csv
import socket
import time
import threading
import collections
import asyncio
from datetime import datetime

import numpy as np
import serial
import serial.tools.list_ports

try:
    from bleak import BleakClient, BleakScanner
    BLEAK_AVAILABLE = True
except Exception:
    BleakClient = None
    BleakScanner = None
    BLEAK_AVAILABLE = False

from PyQt5 import QtWidgets, QtCore, QtGui
import pyqtgraph as pg
import pyqtgraph.exporters

BLE_DEVICE_NAME = "NeuroPulseAI-4CH"
BLE_SERVICE_UUID = "19b10000-e8f2-537e-4f6c-d104768a1214"
BLE_DATA_CHAR_UUID = "19b10001-e8f2-537e-4f6c-d104768a1214"

# Fix Windows timer resolution to 1ms (default is 15ms which causes slow QTimer)
try:
    import ctypes
    ctypes.windll.winmm.timeBeginPeriod(1)
except Exception:
    pass



class VerticalLabel(QtWidgets.QLabel):
    def __init__(self, text, color="#00E5FF", parent=None):
        super().__init__(text, parent)
        self.color = color
        self.setAlignment(QtCore.Qt.AlignCenter)

    def paintEvent(self, event):
        painter = QtGui.QPainter(self)
        painter.setRenderHint(QtGui.QPainter.Antialiasing)
        painter.setPen(QtGui.QColor(self.color))
        
        # Center the text
        metrics = QtGui.QFontMetrics(self.font())
        text_width = metrics.horizontalAdvance(self.text())
        text_height = metrics.height()
        
        painter.translate(self.width() / 2 + text_height / 2, self.height() / 2 + text_width / 2)
        painter.rotate(-90)
        
        painter.drawText(0, 0, self.text())
        painter.end()


    def sizeHint(self):
        metrics = QtGui.QFontMetrics(self.font())
        text_width = metrics.horizontalAdvance(self.text())
        text_height = metrics.height()
        # For vertical, width is text_height, height is text_width
        return QtCore.QSize(text_height + 15, text_width + 40)

    def minimumSizeHint(self):
        return self.sizeHint()


class NeuroPulseAI4ChAutoWirelessPlotter(QtWidgets.QMainWindow):
    """
    Auto-wireless plotter.

    Supported inputs:
    1) Simple USB serial:
       millis,ch1,ch2,ch3,ch4
       where ch1..ch4 are already Arduino-computed envelopes
    2) WiFi UDP auto-listen:
       millis,sig1,env1,sig2,env2,sig3,env3,sig4,env4
    3) USB Serial fallback:
       same format as above

    Plot shows filtered signals.
    Comparison uses envelope values.
    """

    def __init__(self):
        super().__init__()
        self.setWindowTitle("NeuroPulseAI - 4CH EMG Auto Wireless Plotter")
        if os.path.exists("neuropulse_icon.png"):
            self.setWindowIcon(QtGui.QIcon("neuropulse_icon.png"))
        self.resize(1720, 980)


        self.num_channels = 4
        self.max_points = 100
        self.default_names = [
            "Channel 1",
            "Channel 2",
            "Channel 3",
            "Channel 4",
        ]
        self.short_names = ["CH1", "CH2", "CH3", "CH4"]
        self.colors = ["#00E5FF", "#FFD600", "#00FF85", "#FF4D6D"]
        self.plots = []


        self.filtered_data = np.zeros((self.num_channels, self.max_points), dtype=np.float32)
        self.envelope_data = np.zeros((self.num_channels, self.max_points), dtype=np.float32)
        self.activity_data = np.zeros((self.num_channels, self.max_points), dtype=np.float32)
        self.latest_signal = np.zeros(self.num_channels, dtype=np.float32)
        self.latest_envelope = np.zeros(self.num_channels, dtype=np.float32)
        
        # Local deterministic EMG analysis settings
        self.last_ai_update = 0
        self.ai_update_interval = 60000
        self.latest_ai_analysis = "Awaiting live EMG data..."
        self.latest_vision_analysis = "Report findings will be generated from recorded EMG data."
        self._last_ai_stats_summary = None




        self.serial_port = None
        self.serial_buffer = ""
        self.udp_socket = None
        self.connected_mode = None
        self.last_packet_time = 0.0
        self.last_data_time = 0.0
        self._ble_thread = None
        self._ble_thread_running = False

        self.total_frames = 0
        self.session_started_at = None
        self.report_generated = False
        self.auto_report_completed = False
        self.report_generation_in_progress = False
        self.last_report_path = None
        self.report_interval_seconds = 60
        self.snapshot_seconds = 30
        self.snapshot_captured = False
        self.snapshot_path = None
        self.best_snapshot_score = 0.0
        self.last_best_snapshot_time = 0.0
        self.is_paused = False
        self.enable_log = False
        self._log_queue = []
        self.enable_autoscale = True

        self.session_peaks = np.zeros(self.num_channels, dtype=np.float32)
        self.session_sum_envelope = np.zeros(self.num_channels, dtype=np.float64)
        self.session_active_counts = np.zeros(self.num_channels, dtype=np.int64)
        self.session_sample_count = 0
        self.session_first_window = collections.deque(maxlen=500)
        self.session_recent_window = collections.deque(maxlen=500)
        self.latest_rehab_metrics = {}
        self.stats_warmup_samples = 250
        self.stats_warmup_remaining = self.stats_warmup_samples

        self.curves = []
        self.strength_curves = []
        self.activity_curves = []
        self.signal_cards = []
        self.signal_checkboxes = []
        self.signal_visible = [True, True, True, True]

        # Thread-safe queue for serial lines (background thread â†’ main thread)
        self.serial_line_queue = collections.deque(maxlen=2000)
        self._serial_thread = None
        self._serial_thread_running = False

        # read_timer only used for UDP polling now (serial uses a background thread)
        self.read_timer = QtCore.QTimer()
        self.read_timer.timeout.connect(self.poll_inputs)
        self.read_timer.start(5)   # 5ms UDP polling (Windows-friendly)

        self.plot_timer = QtCore.QTimer()
        self.plot_timer.timeout.connect(self.update_plot)
        self.plot_timer.start(8)

        self.log_timer = QtCore.QTimer()
        self.log_timer.timeout.connect(self.flush_log_box)
        self.log_timer.start(50)

        self.auto_timer = QtCore.QTimer()
        self.auto_timer.timeout.connect(self.auto_health_check)
        self.auto_timer.start(500)

        self.report_timer = QtCore.QTimer()
        self.report_timer.timeout.connect(self.check_auto_report_timer)
        self.report_timer.start(1000)


        pg.setConfigOptions(antialias=False, useOpenGL=False)

        self.init_ui()
        self.apply_theme()
        self.refresh_ports()
        self.setup_curves()
        self.start_auto_udp_listener()
        self.statusBar().showMessage("Affected side set to: None")
        self.start_blinking_affected()



    def init_ui(self):
        central = QtWidgets.QWidget()
        self.setCentralWidget(central)

        root = QtWidgets.QVBoxLayout(central)
        root.setContentsMargins(4, 1, 4, 1)
        root.setSpacing(1)


        header = QtWidgets.QFrame()
        header.setObjectName("headerCard")
        header.setFixedHeight(34)

        header_layout = QtWidgets.QHBoxLayout(header)
        header_layout.setContentsMargins(15, 0, 15, 0)

        # Left Part - Horizontal Side-by-Side
        title_block = QtWidgets.QHBoxLayout()
        title_block.setSpacing(10)
        self.title_label = QtWidgets.QLabel("NeuroPulseAI")
        self.title_label.setObjectName("titleLabel")
        self.title_label.setStyleSheet("font-size: 18px;")
        
        self.brand_label = QtWidgets.QLabel("DEBUGGERS SQUAD")
        self.brand_label.setObjectName("brandLabel")
        
        self.subtitle_label = QtWidgets.QLabel("4CH EMG Data-Based Analysis Suite")
        self.subtitle_label.setObjectName("subtitleLabel")
        
        title_block.addWidget(self.title_label)
        title_block.addWidget(self.brand_label)
        title_block.addWidget(self.subtitle_label)


        # Center Part
        center_title = QtWidgets.QLabel("EMG (ELECTROMYOGRAPHY)")

        center_title.setObjectName("centerTitle")
        center_title.setAlignment(QtCore.Qt.AlignCenter)

        # Right Part
        self.connection_badge = QtWidgets.QLabel("Auto WiFi Waiting...")
        self.connection_badge.setObjectName("badgeWait")
        self.connection_badge.setAlignment(QtCore.Qt.AlignCenter)
        self.connection_badge.setMinimumWidth(220)
        self.connection_badge.setFixedHeight(30)

        header_layout.addLayout(title_block)
        header_layout.addStretch()
        header_layout.addWidget(center_title)
        header_layout.addStretch()
        header_layout.addWidget(self.connection_badge)
        root.addWidget(header)

        # Patient Info Row
        patient_card = QtWidgets.QFrame()
        patient_card.setObjectName("patientRow")
        patient_card.setMaximumHeight(26)
        p_layout = QtWidgets.QHBoxLayout(patient_card)
        p_layout.setContentsMargins(8, 0, 8, 0)
        p_layout.setSpacing(6)

        self.name_input = QtWidgets.QLineEdit("Patient Name")
        self.name_input.setPlaceholderText("Patient Name")
        self.name_input.setAlignment(QtCore.Qt.AlignCenter)
        
        self.age_input = QtWidgets.QLineEdit()
        self.age_input.setPlaceholderText("Age")
        self.age_input.setFixedWidth(50)
        
        self.id_input = QtWidgets.QLineEdit()
        self.id_input.setText(f"NP-{datetime.now().strftime('%Y%m%d')}-6079")
        self.id_input.setFixedWidth(180)
        self.id_input.setObjectName("caseIdField")
        
        self.blood_group_combo = QtWidgets.QComboBox()
        self.blood_group_combo.addItems(["Blood Group", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
        self.blood_group_combo.setFixedWidth(120)
        self.blood_group_combo.setObjectName("bloodGroupCombo")

        p_layout.addWidget(self.name_input, 4)
        p_layout.addWidget(self.make_label("Age:"), 0, QtCore.Qt.AlignRight)
        p_layout.addWidget(self.age_input)
        p_layout.addWidget(self.id_input)
        p_layout.addWidget(self.blood_group_combo)
        root.addWidget(patient_card)

        # Controls Grid
        controls = QtWidgets.QFrame()
        controls.setObjectName("card")
        grid = QtWidgets.QGridLayout(controls)
        grid.setContentsMargins(8, 1, 8, 1)
        grid.setHorizontalSpacing(6)
        grid.setVerticalSpacing(0)

        self.auto_udp_checkbox = QtWidgets.QCheckBox("Auto WiFi UDP")
        self.auto_udp_checkbox.setChecked(True)
        self.auto_udp_checkbox.stateChanged.connect(self.handle_auto_udp_toggle)

        self.listen_ip_input = QtWidgets.QLineEdit("0.0.0.0")
        self.listen_port_spin = QtWidgets.QSpinBox()
        self.listen_port_spin.setRange(1024, 65535)
        self.listen_port_spin.setValue(4210)

        self.port_combo = QtWidgets.QComboBox()
        self.baud_combo = QtWidgets.QComboBox()
        self.baud_combo.addItems(["115200", "230400", "460800"])
        self.baud_combo.setCurrentText("115200")

        self.samples_spin = QtWidgets.QSpinBox()
        self.samples_spin.setRange(50, 12000)
        self.samples_spin.setValue(100)
        self.samples_spin.valueChanged.connect(self.change_window_size)

        self.active_threshold_spin = QtWidgets.QDoubleSpinBox()
        self.active_threshold_spin.setRange(0.5, 5000.0)
        self.active_threshold_spin.setValue(15.0)

        self.refresh_btn = QtWidgets.QPushButton("REFRESH")
        self.refresh_btn.setObjectName("btnRefresh")
        self.connect_serial_btn = QtWidgets.QPushButton("CONNECT USB")
        self.connect_serial_btn.setObjectName("btnConnect")
        self.connect_ble_btn = QtWidgets.QPushButton("CONNECT BLE")
        self.connect_ble_btn.setObjectName("btnConnect")
        self.restart_auto_btn = QtWidgets.QPushButton("RESTART WIFI")
        self.restart_auto_btn.setObjectName("btnRestartAuto")
        self.disconnect_btn = QtWidgets.QPushButton("DISCONNECT")
        self.disconnect_btn.setObjectName("btnDisconnect")
        self.pause_btn = QtWidgets.QPushButton("PAUSE")
        self.pause_btn.setObjectName("btnPause")
        self.clear_btn = QtWidgets.QPushButton("CLEAR")
        self.clear_btn.setObjectName("btnClear")
        self.save_btn = QtWidgets.QPushButton("SAVE PNG")
        self.save_btn.setObjectName("btnSave")
        self.report_btn = QtWidgets.QPushButton("GENERATE PDF REPORT")
        self.report_btn.setObjectName("btnPDF")

        self.log_toggle = QtWidgets.QCheckBox("Log")
        self.log_toggle.stateChanged.connect(self.toggle_log)
        self.autoscale_toggle = QtWidgets.QCheckBox("Auto Scale")
        self.autoscale_toggle.setChecked(True)
        self.autoscale_toggle.stateChanged.connect(self.toggle_autoscale)

        self.compare_mode_combo = QtWidgets.QComboBox()
        self.compare_mode_combo.addItems(["Affected vs Normal", "Channel Ranking", "Raw View"])
        self.affected_side_combo = QtWidgets.QComboBox()
        self.affected_side_combo.addItems(["Select Affected Side", "Left Affected", "Right Affected", "Both Normal"])
        self.affected_side_combo.currentTextChanged.connect(self.update_side_labels)
        
        self.status_label = QtWidgets.QLabel("System Active")
        self.status_label.setObjectName("statusLabel")
        self.channel_name_edits = [QtWidgets.QLineEdit(t) for t in self.default_names]

        # Row 0
        grid.addWidget(self.auto_udp_checkbox, 0, 0)
        grid.addWidget(self.make_label("IP"), 0, 1)
        grid.addWidget(self.listen_ip_input, 0, 2, 1, 2)
        grid.addWidget(self.make_label("Port"), 0, 4)
        grid.addWidget(self.listen_port_spin, 0, 5)
        self.affected_lbl = self.make_label("Side")
        grid.addWidget(self.affected_lbl, 0, 6)
        grid.addWidget(self.affected_side_combo, 0, 7, 1, 2)
        grid.addWidget(self.refresh_btn, 0, 9)
        grid.addWidget(self.connect_serial_btn, 0, 10)
        grid.addWidget(self.connect_ble_btn, 0, 11)
        grid.addWidget(self.disconnect_btn, 0, 12)

        # Row 1
        grid.addWidget(self.make_label("COM"), 1, 0)
        grid.addWidget(self.port_combo, 1, 1, 1, 2)
        grid.addWidget(self.make_label("Baud"), 1, 3)
        grid.addWidget(self.baud_combo, 1, 4)
        grid.addWidget(self.make_label("Window"), 1, 5)
        grid.addWidget(self.samples_spin, 1, 6)
        grid.addWidget(self.make_label("Thresh"), 1, 7)
        grid.addWidget(self.active_threshold_spin, 1, 8)
        grid.addWidget(self.autoscale_toggle, 1, 9)
        grid.addWidget(self.pause_btn, 1, 10)
        grid.addWidget(self.clear_btn, 1, 11)

        # Row 2
        grid.addWidget(self.make_label("Mode"), 2, 0)
        grid.addWidget(self.compare_mode_combo, 2, 1, 1, 3)
        grid.addWidget(self.log_toggle, 2, 4)
        grid.addWidget(self.save_btn, 2, 5, 1, 2)
        grid.addWidget(self.report_btn, 2, 7, 1, 2)
        grid.addWidget(self.restart_auto_btn, 2, 9, 1, 3)

        # Row 3 - Side Labels
        self.left_side_control_lbl = QtWidgets.QLabel("Left Side")
        self.left_side_control_lbl.setObjectName("sideLabelLeft")
        grid.addWidget(self.left_side_control_lbl, 3, 0, 1, 6)
        
        self.right_side_control_lbl = QtWidgets.QLabel("Right Side")
        self.right_side_control_lbl.setObjectName("sideLabelRight")
        grid.addWidget(self.right_side_control_lbl, 3, 6, 1, 5)

        # AI Badge (Full Width)
        self.ai_badge = QtWidgets.QLabel("LOCAL EMG ANALYSIS: Data Findings | Symmetry | Master Reports")
        self.ai_badge.setObjectName("aiBadge")
        self.ai_badge.setAlignment(QtCore.Qt.AlignCenter)
        grid.addWidget(self.ai_badge, 4, 0, 1, 12)

        # Row 5/6 - Channel Name Edits
        grid.addWidget(self.make_label("CH1"), 5, 0); grid.addWidget(self.channel_name_edits[0], 5, 1, 1, 5)
        grid.addWidget(self.make_label("CH3"), 5, 6); grid.addWidget(self.channel_name_edits[2], 5, 7, 1, 5)
        grid.addWidget(self.make_label("CH2"), 6, 0); grid.addWidget(self.channel_name_edits[1], 6, 1, 1, 5)
        grid.addWidget(self.make_label("CH4"), 6, 6); grid.addWidget(self.channel_name_edits[3], 6, 7, 1, 5)
        
        root.addWidget(controls)


        # Stat Bar
        stat_bar = QtWidgets.QHBoxLayout()
        stat_bar.setSpacing(4)
        stat_bar.setContentsMargins(0, 0, 0, 0)
        self.stat_frames = self.make_stat("FRAMES", "0")
        self.stat_mode = self.make_stat("MODE", "Idle")
        self.stat_session = self.make_stat("SESSION", "0 s")
        self.stat_comparison = self.make_stat("SYMMETRY", "-")
        self.stat_most_active = self.make_stat("PEAK", "-")
        self.stat_transport = self.make_stat("LINK", "Auto WiFi")
        for card in [self.stat_frames, self.stat_mode, self.stat_session, self.stat_comparison, self.stat_most_active, self.stat_transport]:
            stat_bar.addWidget(card)
        root.addLayout(stat_bar)

        rehab_bar = QtWidgets.QHBoxLayout()
        rehab_bar.setSpacing(4)
        rehab_bar.setContentsMargins(0, 0, 0, 0)
        self.stat_rehab_score = self.make_stat("SESSION SCORE", "-")
        self.stat_deficit = self.make_stat("SIDE DEFICIT", "-")
        self.stat_pair_balance = self.make_stat("CHANNEL BALANCE", "-")
        self.stat_fatigue = self.make_stat("FATIGUE DROP", "-")
        self.stat_weakest = self.make_stat("LOWEST ACTIVITY", "-")
        self.stat_quality = self.make_stat("SIGNAL QUALITY", "-")
        for card in [
            self.stat_rehab_score,
            self.stat_deficit,
            self.stat_pair_balance,
            self.stat_fatigue,
            self.stat_weakest,
            self.stat_quality,
        ]:
            rehab_bar.addWidget(card)
        root.addLayout(rehab_bar)

        main = QtWidgets.QHBoxLayout()
        main.setSpacing(10)
        plot_card = QtWidgets.QFrame()
        plot_card.setObjectName("card")
        plot_card_layout = QtWidgets.QHBoxLayout(plot_card)
        plot_card_layout.setContentsMargins(5, 5, 5, 5)
        plot_card_layout.setSpacing(0)
        self.side_label_layout = QtWidgets.QVBoxLayout()
        self.side_label_layout.setSpacing(0)
        self.side_label_layout.setContentsMargins(0, 0, 0, 0)
        self.left_side_label = VerticalLabel("LEFT SIDE", color="#00E5FF")
        self.left_side_label.setFont(QtGui.QFont("Segoe UI", 12, QtGui.QFont.Bold))
        self.right_side_label = VerticalLabel("RIGHT SIDE", color="#00E5FF")
        self.right_side_label.setFont(QtGui.QFont("Segoe UI", 12, QtGui.QFont.Bold))
        
        self.side_label_layout.addWidget(self.left_side_label, 1)
        self.side_label_layout.addWidget(self.right_side_label, 1)
        # Spacer to account for the X-axis at the bottom of the last plot
        self.side_label_layout.addSpacing(20) 
        
        plot_card_layout.addLayout(self.side_label_layout)

        self.plot_layout_widget = pg.GraphicsLayoutWidget()
        self.plot_layout_widget.setBackground((12, 16, 24))
        plot_card_layout.addWidget(self.plot_layout_widget, 1)
        main.addWidget(plot_card, 7)
        side_card = QtWidgets.QFrame()
        side_card.setObjectName("card")
        side_layout = QtWidgets.QVBoxLayout(side_card)
        side_layout.setContentsMargins(10, 8, 10, 8)
        side_layout.setSpacing(6)
        panel_title = QtWidgets.QLabel("Channel Dashboard")
        panel_title.setObjectName("panelTitle")
        
        side_layout.addWidget(panel_title)

        self.signal_scroll = QtWidgets.QScrollArea()
        self.signal_scroll.setWidgetResizable(True)
        self.signal_scroll.setFrameShape(QtWidgets.QFrame.NoFrame)
        self.signal_scroll.setFixedHeight(430)

        self.signal_scroll.setStyleSheet("background: transparent; border: none;")






        self.signal_container = QtWidgets.QWidget()
        self.signal_container.setObjectName("scrollContent")
        self.signal_container.setStyleSheet("background: transparent;")
        self.signal_layout = QtWidgets.QVBoxLayout(self.signal_container)
        self.signal_layout.setSpacing(3)
        self.signal_layout.setContentsMargins(1, 1, 1, 1)
        self.signal_scroll.setWidget(self.signal_container)
        side_layout.addWidget(self.signal_scroll, 5)




        compare_title = QtWidgets.QLabel("Affected vs Normal Insight")
        compare_title.setObjectName("panelTitle")
        side_layout.addWidget(compare_title)
        self.compare_output = QtWidgets.QTextEdit()
        self.compare_output.setReadOnly(True)
        self.compare_output.setObjectName("analystBox")
        self.compare_output.setMinimumHeight(90)
        self.compare_output.setMaximumHeight(135)
        side_layout.addWidget(self.compare_output, 1)


        self.log_box = QtWidgets.QPlainTextEdit()
        self.log_box.setReadOnly(True)
        self.log_box.setMaximumHeight(140)
        self.log_box.setVisible(False)
        side_layout.addWidget(self.log_box)
        main.addWidget(side_card, 3)
        root.addLayout(main, 10)
        self.refresh_btn.clicked.connect(self.refresh_ports)
        self.connect_serial_btn.clicked.connect(self.connect_serial)
        self.connect_ble_btn.clicked.connect(self.connect_ble)
        self.restart_auto_btn.clicked.connect(self.restart_auto_udp)
        self.disconnect_btn.clicked.connect(self.disconnect_all)
        self.pause_btn.clicked.connect(self.toggle_pause)
        self.clear_btn.clicked.connect(self.clear_plot)
        self.save_btn.clicked.connect(self.save_plot)
        self.report_btn.clicked.connect(self.generate_pdf_report)

    def make_plain_label(self, html):
        lbl = QtWidgets.QLabel(html)
        lbl.setStyleSheet("color:white;")
        return lbl

    def make_label(self, text):
        lbl = QtWidgets.QLabel(text)
        lbl.setObjectName("fieldLabel")
        return lbl

    def make_stat(self, title, value):
        card = QtWidgets.QFrame()
        card.setObjectName("card")
        card.setMinimumHeight(44)
        lay = QtWidgets.QVBoxLayout(card)
        lay.setContentsMargins(10, 3, 10, 3)
        lay.setSpacing(0)
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
            QFrame#card { background: #111826; border: 1px solid #1F2A3D; border-radius: 8px; }
            QFrame#headerCard { background: #0F2D52; border: none; border-radius: 0px; }
            QFrame#patientRow { background: transparent; border: none; }
            
            QLabel#titleLabel { color: white; font-size: 24px; font-weight: 900; letter-spacing: 1px; }


            QLabel#brandLabel { background: #E63946; color: white; font-size: 8px; font-weight: 800; padding: 1px 6px; border-radius: 3px; }
            QLabel#subtitleLabel { color: #8CA0BB; font-size: 9px; margin-top: 0px; }
            QLabel#centerTitle { color: white; font-size: 16px; font-weight: 700; letter-spacing: 3px; }
            
            QLabel#badgeWait { background: #1A1D23; color: #F2994A; border: 2px solid #F2994A; border-radius: 7px; font-weight: 800; padding: 3px; }
            QLabel#badgeOn { background: #1A1D23; color: #27AE60; border: 2px solid #27AE60; border-radius: 7px; font-weight: 800; padding: 3px; }
            
            QLabel#fieldLabel { color: #8CA0BB; font-size: 10px; font-weight: 800; }
            QLabel#sideLabelLeft { color: #E63946; font-size: 11px; font-weight: 900; border-bottom: 1px solid #E63946; padding: 0px; margin-top: 0px; }
            QLabel#sideLabelRight { color: #2D9CDB; font-size: 11px; font-weight: 900; border-bottom: 1px solid #2D9CDB; padding: 0px; margin-top: 0px; }
            QLabel#orientationTip { color: #F2994A; font-size: 11px; font-weight: 800; }
            
            QLabel#statTitle { color: #8CA0BB; font-size: 8px; font-weight: 800; }
            QLabel#statValue { color: white; font-size: 20px; font-weight: 900; }
            QLabel#panelTitle { color: #8CA0BB; font-size: 13px; font-weight: 900; padding-bottom: 6px; border-bottom: 2px solid #1F2A3D; text-transform: uppercase; letter-spacing: 1px; }
            
            QTextEdit#analystBox { 
                background: #000000; 
                color: #FFFFFF; 
                font-family: 'Segoe UI', sans-serif;
                font-size: 15px; 
                line-height: 1.6;
                border: 2px solid #2C313C;
                border-radius: 10px;
                padding: 12px;
            }
            
            QLabel#aiBadge {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #1E293B, stop:1 #0F172A);
                color: #00E5FF;
                font-size: 8px;
                font-weight: 800;
                padding: 1px;
                border: 1px solid #1E40AF;
                border-radius: 5px;
                margin-bottom: 1px;
                line-height: 1.3;
            }




            QComboBox, QSpinBox, QDoubleSpinBox, QLineEdit {

                background: #11141A; color: #DDE6F2; border: 1px solid #2C313C;
                border-radius: 5px; padding: 2px 7px; font-size: 11px;
            }
            QLineEdit#caseIdField { font-weight: 800; color: #DDE6F2; }
            QComboBox#bloodGroupCombo { color: #E63946; font-weight: 900; }

            
            QPushButton {
                color: white; font-weight: 900; border-radius: 4px; padding: 3px 9px; font-size: 9px;
                text-transform: uppercase;
            }
            QPushButton#btnRefresh { background: #2D9CDB; }
            QPushButton#btnConnect { background: #27AE60; }
            QPushButton#btnDisconnect { background: #E63946; }
            QPushButton#btnPause { background: #9B51E0; }
            QPushButton#btnClear { background: #F2994A; }
            QPushButton#btnSave { background: #16A085; }
            QPushButton#btnRestartAuto { background: #219653; }
            QPushButton#btnPDF { background: #00B8D9; }
            
            QPushButton:hover { background-color: rgba(255,255,255,0.1); }
            
            QCheckBox { color: white; font-weight: 800; font-size: 10px; }
            QScrollArea { border: none; background: transparent; }
            QPlainTextEdit, QTextEdit { background: #1A1D23; border: 1px solid #2C313C; border-radius: 6px; color: #DDE6F2; }
            
            QStatusBar { background: #0F2D52; color: #8CA0BB; font-size: 11px; font-weight: 700; }
        """)



    def channel_plot_title(self, channel_index):
        name = self.channel_name_edits[channel_index].text().strip() or f"Channel {channel_index + 1}"
        bg = self.colors[channel_index]
        fg = "#07111F" if channel_index in (0, 1, 2) else "#FFFFFF"
        return (
            f"<span style='background-color:{bg}; color:{fg}; "
            "font-size:9pt; font-weight:800; padding:3px 14px; "
            "border-radius:5px;'>"
            f"{name}: Cleaned Signal / Strength / Active"
            "</span>"
        )

    def setup_curves(self):
        self.plot_layout_widget.clear()
        self.curves.clear()
        self.strength_curves.clear()
        self.activity_curves.clear()
        self.plots.clear()

        while self.signal_layout.count():
            item = self.signal_layout.takeAt(0)
            widget = item.widget()
            if widget:
                widget.deleteLater()

        self.signal_cards.clear()
        self.signal_checkboxes.clear()

        axis_pen = pg.mkPen("#73839A")
        
        for i in range(self.num_channels):
            p = self.plot_layout_widget.addPlot(row=i, col=0)
            p.setTitle(self.channel_plot_title(i))
            p.showGrid(x=True, y=True, alpha=0.1)
            p.setLabel("left", f"CH {i+1}", color=self.colors[i])
            if i < self.num_channels - 1:
                p.getAxis('bottom').setStyle(showValues=False)
            
            p.getAxis("left").setPen(axis_pen)
            p.getAxis("bottom").setPen(axis_pen)
            p.getAxis("left").setTextPen("#D0DAE7")
            p.getAxis("bottom").setTextPen("#D0DAE7")
            
            self.plots.append(p)
            p.enableAutoRange(axis='y', enable=self.enable_autoscale)
            
            name = self.channel_name_edits[i].text().strip() or f"Channel {i+1}"
            activity = p.plot(
                self.activity_data[i],
                pen=pg.mkPen("#FF2D55", width=1),
                brush=pg.mkBrush(255, 45, 85, 70),
                fillLevel=0,
                name=f"{name} Active"
            )
            strength = p.plot(
                self.envelope_data[i],
                pen=pg.mkPen("#00FF66", width=2),
                name=f"{name} Strength"
            )
            curve = p.plot(
                self.filtered_data[i],
                pen=pg.mkPen("#FFD600", width=1.6),
                name=f"{name} Cleaned"
            )
            curve.setVisible(self.signal_visible[i])
            strength.setVisible(self.signal_visible[i])
            activity.setVisible(self.signal_visible[i])
            self.curves.append(curve)
            self.strength_curves.append(strength)
            self.activity_curves.append(activity)


            row = QtWidgets.QFrame()
            row.setStyleSheet(f"""
                QFrame {{
                    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #202737, stop:1 #101622);
                    border: 1px solid #3A465C;
                    border-left: 5px solid {self.colors[i]};
                    border-radius: 9px;
                }}
                QFrame:hover {{
                    border: 1px solid #64748B;
                    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #263248, stop:1 #151D2C);
                }}
            """)
            lay = QtWidgets.QVBoxLayout(row)
            lay.setContentsMargins(7, 3, 7, 3)
            lay.setSpacing(1)




            top = QtWidgets.QHBoxLayout()
            top.setContentsMargins(0, 0, 0, 0)
            top.setSpacing(4)
            cb = QtWidgets.QCheckBox(name)
            cb.setStyleSheet(f"""
                QCheckBox {{
                    color: #FFFFFF;
                    font-size: 15px;
                    font-weight: 900;
                    spacing: 7px;
                    background: rgba(255,255,255,0.03);
                    border: 0;
                }}
                QCheckBox::indicator {{
                    width: 16px;
                    height: 16px;
                    border-radius: 5px;
                    background: #0B1220;
                    border: 1px solid {self.colors[i]};
                }}
                QCheckBox::indicator:checked {{
                    background: {self.colors[i]};
                    border: 1px solid {self.colors[i]};
                }}
            """)
            cb.setChecked(self.signal_visible[i])
            cb.stateChanged.connect(lambda _, idx=i: self.toggle_channel(idx))
            top.addWidget(cb)
            top.addStretch()

            value_lbl = QtWidgets.QLabel("0.0")
            value_lbl.setStyleSheet(f"""
                color:#FFFFFF;
                background: rgba(0,0,0,0.22);
                border: 1px solid {self.colors[i]};
                border-radius: 8px;
                padding: 1px 7px;
                font-weight: 900;
                font-size: 16px;
            """)
            top.addWidget(value_lbl)

            def make_metric_row(label, color, value="0.00"):
                metric = QtWidgets.QFrame()
                metric.setStyleSheet("""
                    QFrame {
                        background: rgba(8, 12, 20, 0.78);
                        border: 1px solid #34445E;
                        border-radius: 5px;
                    }
                """)
                metric.setMinimumHeight(16)
                metric_layout = QtWidgets.QHBoxLayout(metric)
                metric_layout.setContentsMargins(6, 0, 6, 0)
                metric_layout.setSpacing(6)

                swatch = QtWidgets.QLabel()
                swatch.setFixedSize(12, 12)
                swatch.setStyleSheet(f"background:{color}; border-radius:3px; border:0;")
                metric_layout.addWidget(swatch)

                name_lbl = QtWidgets.QLabel(label)
                name_lbl.setStyleSheet("color:#F5F8FF;font-size:12px;font-weight:900;border:0;background:transparent;")
                metric_layout.addWidget(name_lbl)
                metric_layout.addStretch()

                value_metric = QtWidgets.QLabel(value)
                value_metric.setAlignment(QtCore.Qt.AlignRight | QtCore.Qt.AlignVCenter)
                value_metric.setMinimumWidth(46)
                value_metric.setStyleSheet(f"color:{color};font-size:12px;font-weight:900;border:0;background:transparent;")
                metric_layout.addWidget(value_metric)
                return metric, value_metric

            clean_row, clean_value = make_metric_row("Cleaned Signal", "#FFD600")
            strength_row, strength_value = make_metric_row("Muscle Strength", "#00FF66")
            active_row, active_value = make_metric_row("Muscle Active", "#FF2D55", "IDLE")

            bottom = QtWidgets.QLabel("Peak: 0.0 | Active: 0.0%")
            bottom.setStyleSheet("color:#AFC2DA;font-size:9px;font-weight:800;border:0;background:transparent;")

            lay.addLayout(top)
            lay.addWidget(clean_row)
            lay.addWidget(strength_row)
            lay.addWidget(active_row)
            lay.addWidget(bottom)

            row.value_label = value_lbl
            row.clean_value_label = clean_value
            row.strength_value_label = strength_value
            row.active_value_label = active_value
            row.extra_label = bottom

            self.signal_layout.addWidget(row)
            self.signal_cards.append(row)
            self.signal_checkboxes.append(cb)

        self.update_visible_plots()

    def update_visible_plots(self):
        # Clear existing plots from the layout
        self.plot_layout_widget.clear()
        self.plots.clear()
        self.curves = [None] * self.num_channels
        self.strength_curves = [None] * self.num_channels
        self.activity_curves = [None] * self.num_channels
        
        axis_pen = pg.mkPen("#73839A")
        visible_count = 0
        
        # Calculate how many visible channels in Left/Right groups for label stretch
        left_visible = sum(self.signal_visible[0:2])
        right_visible = sum(self.signal_visible[2:4])
        
        # Update side labels visibility and stretch
        self.left_side_label.setVisible(left_visible > 0)
        self.right_side_label.setVisible(right_visible > 0)
        
        if left_visible > 0:
            self.side_label_layout.setStretchFactor(self.left_side_label, left_visible)
        if right_visible > 0:
            self.side_label_layout.setStretchFactor(self.right_side_label, right_visible)

        # Re-add only visible plots
        current_row = 0
        for i in range(self.num_channels):
            if not self.signal_visible[i]:
                continue
            
            p = self.plot_layout_widget.addPlot(row=current_row, col=0)
            p.setTitle(self.channel_plot_title(i))
            p.showGrid(x=True, y=True, alpha=0.22)
            p.setLabel("left", f"CH {i+1}", color=self.colors[i])
            p.setLabel("bottom", "Samples", color="#8CA0BB")
            p.setMenuEnabled(False)

            
            p.getAxis("left").setPen(axis_pen)
            p.getAxis("bottom").setPen(axis_pen)
            p.getAxis("left").setTextPen("#D0DAE7")
            p.getAxis("bottom").setTextPen("#D0DAE7")
            
            # Only show bottom axis for the last visible plot
            is_last = (i == next(reversed([idx for idx, v in enumerate(self.signal_visible) if v])))
            if not is_last:
                p.getAxis('bottom').setStyle(showValues=False)
            
            name = self.channel_name_edits[i].text().strip() or f"Channel {i+1}"
            activity = p.plot(
                self.activity_data[i],
                pen=pg.mkPen("#FF2D55", width=1),
                brush=pg.mkBrush(255, 45, 85, 75),
                fillLevel=0,
                name=f"{name} Active"
            )
            strength = p.plot(
                self.envelope_data[i],
                pen=pg.mkPen("#00FF66", width=2),
                name=f"{name} Strength"
            )
            curve = p.plot(
                self.filtered_data[i],
                pen=pg.mkPen("#FFD600", width=1.6),
                name=f"{name} Cleaned"
            )
            
            self.plots.append(p)
            p.enableAutoRange(axis='y', enable=self.enable_autoscale)
            self.curves[i] = curve
            self.strength_curves[i] = strength
            self.activity_curves[i] = activity
            current_row += 1
            visible_count += 1
            
        if visible_count == 0:
            # Add a placeholder label if nothing is selected
            msg = pg.TextItem("Select channels from the dashboard", color="#8CA0BB", anchor=(0.5, 0.5))
            dummy = self.plot_layout_widget.addPlot()
            dummy.addItem(msg)
            dummy.hideAxis('left')
            dummy.hideAxis('bottom')

        self.signal_layout.addStretch()

    def refresh_ports(self):
        current = self.port_combo.currentText()
        self.port_combo.clear()
        ports = [port.device for port in serial.tools.list_ports.comports()]
        for p in ports:
            self.port_combo.addItem(p)
        if "COM10" in ports:
            self.port_combo.setCurrentText("COM10")
        elif current in ports:
            self.port_combo.setCurrentText(current)
        self.status_label.setText("COM ports refreshed")

    def handle_auto_udp_toggle(self):
        if self.auto_udp_checkbox.isChecked():
            self.start_auto_udp_listener()
        else:
            if self.udp_socket:
                self.udp_socket.close()
                self.udp_socket = None
            if self.connected_mode == "WiFi UDP":
                self.connected_mode = None
                self.set_wait_badge("Auto WiFi off")
            self.status_label.setText("Auto WiFi UDP stopped")

    def start_auto_udp_listener(self):
        try:
            if self.udp_socket:
                self.udp_socket.close()
            ip = self.listen_ip_input.text().strip() or "0.0.0.0"
            port = int(self.listen_port_spin.value())
            self.udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.udp_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.udp_socket.bind((ip, port))
            self.udp_socket.setblocking(False)
            self.read_timer.start(2)
            self.status_label.setText(f"Auto WiFi listening on {ip}:{port}")
            self.stat_transport.value_label.setText("Auto WiFi")
            self.set_wait_badge("Waiting for WiFi packet...")
        except Exception as e:
            self.status_label.setText(f"Auto WiFi start failed: {e}")

    def restart_auto_udp(self):
        self.start_auto_udp_listener()

    def connect_serial(self):
        port = self.port_combo.currentText()
        if not port:
            self.status_label.setText("Select a COM port")
            return
        baud = int(self.baud_combo.currentText())
        try:
            if self.serial_port and self.serial_port.is_open:
                self.serial_port.close()
            self._serial_thread_running = False
            self.serial_port = serial.Serial(port, baud, timeout=0.02, write_timeout=0)
            self.serial_port.reset_input_buffer()
            self.serial_buffer = ""
            self.connected_mode = "USB Serial"
            # Start background reader thread (bypasses Windows 15ms timer limit)
            self._serial_thread_running = True
            self._serial_thread = threading.Thread(
                target=self._serial_reader_thread,
                daemon=True
            )
            self._serial_thread.start()
            self.set_connected_badge(f"Connected USB Serial {port}")
            self.status_label.setText(f"Connected to USB Serial {port} @ {baud}")
            self.stat_mode.value_label.setText("Live")
            self.stat_transport.value_label.setText("USB Serial")
            self.connect_btn_state(True)
            if self.session_started_at is None:
                self.session_started_at = time.time()
                self.report_generated = False
            self.setup_curves()
        except Exception as e:
            self.status_label.setText(f"USB connect failed: {e}")

    def _serial_reader_thread(self):
        """Background thread: continuously reads serial at full speed, puts lines into deque."""
        buf = ""
        while self._serial_thread_running:
            try:
                if self.serial_port and self.serial_port.is_open:
                    chunk = self.serial_port.read(self.serial_port.in_waiting or 1)
                    if chunk:
                        buf += chunk.decode(errors="ignore")
                        while "\n" in buf:
                            line, buf = buf.split("\n", 1)
                            line = line.strip()
                            if line:
                                self.serial_line_queue.append(line)
                else:
                    time.sleep(0.001)
            except Exception:
                time.sleep(0.001)

    def connect_ble(self):
        if not BLEAK_AVAILABLE:
            self.status_label.setText("BLE needs Python package: pip install bleak")
            return

        if self._ble_thread and self._ble_thread.is_alive():
            self.status_label.setText("BLE already connecting/connected")
            return

        self._ble_thread_running = True
        self.connected_mode = "BLE"
        self.set_wait_badge("Searching BLE...")
        self.status_label.setText(f"Searching for BLE device {BLE_DEVICE_NAME}")
        self.stat_transport.value_label.setText("BLE")
        self._ble_thread = threading.Thread(target=self._ble_reader_thread, daemon=True)
        self._ble_thread.start()

    def _ble_reader_thread(self):
        try:
            asyncio.run(self._ble_client_loop())
        except Exception as e:
            self.status_label.setText(f"BLE error: {e}")
            self.connected_mode = None
            self._ble_thread_running = False

    async def _ble_client_loop(self):
        device = await BleakScanner.find_device_by_filter(
            lambda d, ad: (
                d.name == BLE_DEVICE_NAME
                or BLE_SERVICE_UUID.lower() in [s.lower() for s in (ad.service_uuids or [])]
            ),
            timeout=12.0,
        )
        if device is None:
            self.status_label.setText("BLE device not found")
            self.set_wait_badge("BLE not found")
            self.connected_mode = None
            self._ble_thread_running = False
            return

        buf = ""

        def handle_notify(_sender, data):
            nonlocal buf
            buf += bytes(data).decode(errors="ignore")
            while "\n" in buf:
                line, buf = buf.split("\n", 1)
                line = line.strip()
                if line:
                    self.serial_line_queue.append(line)

        async with BleakClient(device) as client:
            await client.start_notify(BLE_DATA_CHAR_UUID, handle_notify)
            self.set_connected_badge("Connected BLE")
            self.status_label.setText(f"Connected to BLE {device.name or device.address}")
            self.stat_mode.value_label.setText("Live")
            self.stat_transport.value_label.setText("BLE")
            self.connect_btn_state(True)
            if self.session_started_at is None:
                self.session_started_at = time.time()
                self.report_generated = False
            self.setup_curves()

            while self._ble_thread_running:
                await asyncio.sleep(0.05)

            await client.stop_notify(BLE_DATA_CHAR_UUID)

    def connect_btn_state(self, connected):
        self.disconnect_btn.setEnabled(connected)
        self.pause_btn.setEnabled(connected or self.auto_udp_checkbox.isChecked())

    def disconnect_all(self):
        self._ble_thread_running = False
        if self._ble_thread and self._ble_thread.is_alive():
            self._ble_thread.join(timeout=1.0)
        self._ble_thread = None

        # Stop background serial thread first
        self._serial_thread_running = False
        if self._serial_thread and self._serial_thread.is_alive():
            self._serial_thread.join(timeout=0.5)
        self._serial_thread = None
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()
        self.serial_port = None
        self.serial_buffer = ""
        self.serial_line_queue.clear()
        if self.udp_socket:
            self.udp_socket.close()
        self.udp_socket = None
        self.connected_mode = None
        self.is_paused = False
        self.pause_btn.setText("Pause")
        self.connect_btn_state(False)
        if self.auto_udp_checkbox.isChecked():
            self.start_auto_udp_listener()
        else:
            self.connection_badge.setText("Disconnected")
            self.connection_badge.setObjectName("badgeOff")
            self.refresh_badge_style()
            self.status_label.setText("Disconnected")
            self.stat_mode.value_label.setText("Idle")
            self.stat_transport.value_label.setText("-")

    def set_connected_badge(self, text):
        self.connection_badge.setText(text)
        self.connection_badge.setObjectName("badgeOn")
        self.refresh_badge_style()

    def set_wait_badge(self, text):
        self.connection_badge.setText(text)
        self.connection_badge.setObjectName("badgeWait")
        self.refresh_badge_style()

    def refresh_badge_style(self):
        self.connection_badge.style().unpolish(self.connection_badge)
        self.connection_badge.style().polish(self.connection_badge)

    def toggle_pause(self):
        self.is_paused = not self.is_paused
        if self.is_paused:
            self.pause_btn.setText("Resume")
            self.status_label.setText("Paused")
            self.stat_mode.value_label.setText("Paused")
        else:
            self.pause_btn.setText("Pause")
            self.status_label.setText("Live resumed")
            self.stat_mode.value_label.setText("Live")

    def toggle_log(self):
        self.enable_log = self.log_toggle.isChecked()
        self.log_box.setVisible(self.enable_log)

    def toggle_autoscale(self):
        self.enable_autoscale = self.autoscale_toggle.isChecked()
        for p in self.plots:
            p.enableAutoRange(axis='y', enable=self.enable_autoscale)

    def update_side_labels(self):
        side = self.affected_side_combo.currentText()
        shadow = QtWidgets.QGraphicsDropShadowEffect()
        shadow.setBlurRadius(20)
        shadow.setColor(QtGui.QColor("#FF4D6D"))
        shadow.setOffset(0, 0)

        if side == "Left Affected":
            self.left_side_label.setText("LEFT SIDE (AFFECTED)")
            self.left_side_label.color = "#FF4D6D"
            self.left_side_label.setGraphicsEffect(shadow)
            
            self.left_side_control_lbl.setText("LEFT AFFECTED")
            self.left_side_control_lbl.setStyleSheet("color: #FF4D6D; font-weight: 900;")
            
            self.right_side_label.setText("RIGHT SIDE")
            self.right_side_label.color = "#00FF85"
            self.right_side_label.setGraphicsEffect(None)
            self.right_side_control_lbl.setText("Right Side")
            self.right_side_control_lbl.setStyleSheet("")
        elif side == "Right Affected":
            self.left_side_label.setText("LEFT SIDE")
            self.left_side_label.color = "#00FF85"
            self.left_side_label.setGraphicsEffect(None)
            self.left_side_control_lbl.setText("Left Side")
            self.left_side_control_lbl.setStyleSheet("")
            
            shadow_r = QtWidgets.QGraphicsDropShadowEffect()
            shadow_r.setBlurRadius(20)
            shadow_r.setColor(QtGui.QColor("#FF4D6D"))
            shadow_r.setOffset(0, 0)
            self.right_side_label.setText("RIGHT SIDE (AFFECTED)")
            self.right_side_label.color = "#FF4D6D"
            self.right_side_label.setGraphicsEffect(shadow_r)
            
            self.right_side_control_lbl.setText("RIGHT AFFECTED")
            self.right_side_control_lbl.setStyleSheet("color: #FF4D6D; font-weight: 900;")
        else:
            self.left_side_label.setText("LEFT SIDE")
            self.left_side_label.color = "#00E5FF"
            self.left_side_label.setGraphicsEffect(None)
            self.left_side_control_lbl.setText("Left Side")
            self.left_side_control_lbl.setStyleSheet("")
            
            self.right_side_label.setText("RIGHT SIDE")
            self.right_side_label.color = "#00E5FF"
            self.right_side_label.setGraphicsEffect(None)
            self.right_side_control_lbl.setText("Right Side")
            self.right_side_control_lbl.setStyleSheet("")

        
        self.left_side_label.update()
        self.right_side_label.update()
        self.statusBar().showMessage(f"Affected side set to: {side}")
        
        if side == "Select Affected Side" or "Affected" in side:
            self.start_blinking_affected()
        else:
            self.stop_blinking_affected()
            self.affected_side_combo.setStyleSheet("")
            self.affected_lbl.setStyleSheet("")




    def start_blinking_affected(self):
        if not hasattr(self, 'blink_timer'):
            self.blink_timer = QtCore.QTimer()
            self.blink_timer.timeout.connect(self.toggle_blink_style)
            self.blink_state = False
        if not self.blink_timer.isActive():
            self.blink_timer.start(1200)

    def stop_blinking_affected(self):
        if hasattr(self, 'blink_timer'):
            self.blink_timer.stop()
        self.affected_side_combo.setGraphicsEffect(None)
        self.affected_side_combo.setStyleSheet("")
        self.affected_lbl.setStyleSheet("")

    def toggle_blink_style(self):
        self.blink_state = not self.blink_state
        side = self.affected_side_combo.currentText()
        
        # Reset labels to normal state first
        self.left_side_label.setStyleSheet("color: #00E5FF; font-weight: bold;")
        self.right_side_label.setStyleSheet("color: #00E5FF; font-weight: bold;")
        self.left_side_control_lbl.setStyleSheet("color: #00E5FF; font-weight: bold;")
        self.right_side_control_lbl.setStyleSheet("color: #00E5FF; font-weight: bold;")
        self.affected_lbl.setStyleSheet("")

        if "Left" in side:
            if self.blink_state:
                self.left_side_label.setStyleSheet("color: #E63946; font-weight: 900;")
                self.left_side_label.setText("LEFT SIDE (AFFECTED)")
                self.left_side_control_lbl.setStyleSheet("color: #E63946; font-weight: 900;")
                self.left_side_control_lbl.setText("LEFT AFFECTED")
                self.affected_lbl.setStyleSheet("color: #E63946; font-weight: 900;")
            else:
                self.left_side_control_lbl.setText("Left Side")
        elif "Right" in side:
            if self.blink_state:
                self.right_side_label.setStyleSheet("color: #E63946; font-weight: 900;")
                self.right_side_label.setText("RIGHT SIDE (AFFECTED)")
                self.right_side_control_lbl.setStyleSheet("color: #E63946; font-weight: 900;")
                self.right_side_control_lbl.setText("RIGHT AFFECTED")
                self.affected_lbl.setStyleSheet("color: #E63946; font-weight: 900;")
            else:
                self.right_side_control_lbl.setText("Right Side")
        
        if self.blink_state and side == "Select Affected Side":
            # Pulse glow for the combo box itself if nothing is selected
            glow_style = "color: #E63946; border: 1px solid #E63946; font-weight: 900;"
            self.affected_side_combo.setStyleSheet(glow_style)
            self.affected_lbl.setStyleSheet("color: #E63946; font-weight: 900;")
            
            shadow = QtWidgets.QGraphicsDropShadowEffect()
            shadow.setBlurRadius(15)
            shadow.setColor(QtGui.QColor("#E63946"))
            shadow.setOffset(0, 0)
            self.affected_side_combo.setGraphicsEffect(shadow)
        else:
            self.affected_side_combo.setStyleSheet("")
            self.affected_lbl.setStyleSheet("")
            self.affected_side_combo.setGraphicsEffect(None)






    def poll_inputs(self):
        if self.is_paused:
            return
        self.poll_udp()
        # Drain serial lines accumulated by the background reader thread
        if self.serial_line_queue:
            while self.serial_line_queue:
                self.ingest_line(self.serial_line_queue.popleft())
            self.last_packet_time = time.time()
            self.last_data_time = self.last_packet_time


    def poll_udp(self):
        if not self.udp_socket:
            return
        try:
            got_packet = False
            while True:
                data, _addr = self.udp_socket.recvfrom(4096)
                if not data:
                    break
                text = data.decode(errors="ignore").replace("\r", "")
                for line in text.split("\n"):
                    if line.strip():
                        self.ingest_line(line.strip())
                        got_packet = True
            if got_packet:
                self.last_packet_time = time.time()
                self.last_data_time = self.last_packet_time
                if self.connected_mode != "WiFi UDP":
                    self.connected_mode = "WiFi UDP"
                    self.connect_btn_state(True)
                    self.set_connected_badge("Connected WiFi UDP")
                    self.status_label.setText("Auto WiFi connected")
                    self.stat_mode.value_label.setText("Live")
                    self.stat_transport.value_label.setText("WiFi UDP")
                    if self.session_started_at is None:
                        self.session_started_at = time.time()
                        self.report_generated = False
                    self.setup_curves()
                elif self.connection_badge.objectName() != "badgeOn":
                    self.set_connected_badge("Connected WiFi UDP")
                    self.status_label.setText("Auto WiFi receiving data")
                    self.stat_mode.value_label.setText("Live")
                    self.stat_transport.value_label.setText("WiFi UDP")
        except BlockingIOError:
            pass
        except Exception as e:
            self.status_label.setText(f"UDP read error: {e}")

    def poll_serial(self):
        if not self.serial_port or self.connected_mode == "WiFi UDP":
            return
        try:
            waiting = self.serial_port.in_waiting
            if waiting <= 0:
                return
            raw_bytes = self.serial_port.read(waiting)
            if not raw_bytes:
                return
            self.serial_buffer += raw_bytes.decode(errors="ignore")
            while "\n" in self.serial_buffer:
                line, self.serial_buffer = self.serial_buffer.split("\n", 1)
                line = line.strip()
                if line:
                    self.ingest_line(line)
            self.last_packet_time = time.time()
        except Exception as e:
            self.status_label.setText(f"Serial read error: {e}")

    def auto_health_check(self):
        if self.auto_udp_checkbox.isChecked() and self.last_data_time and (time.time() - self.last_data_time <= 3.0):
            if self.connection_badge.objectName() != "badgeOn":
                self.connected_mode = "WiFi UDP"
                self.set_connected_badge("Connected WiFi UDP")
                self.status_label.setText("Auto WiFi receiving data")
                self.stat_mode.value_label.setText("Live")
                self.stat_transport.value_label.setText("WiFi UDP")
            return

        if self.connected_mode == "WiFi UDP" and (time.time() - self.last_packet_time > 3.0):
            self.connected_mode = None
            if self.auto_udp_checkbox.isChecked():
                self.set_wait_badge("Waiting for WiFi packet...")
                self.status_label.setText("WiFi packet lost, waiting again...")
                self.stat_transport.value_label.setText("Auto WiFi")

    def ingest_line(self, line):
        if line.startswith("#"):
            msg = line.lstrip("#").strip()
            if msg:
                self.status_label.setText(msg)
                self.compare_output.setHtml(
                    f"<span style='color:#00E5FF;'>{msg}</span>"
                )
                if self.enable_log:
                    self._log_queue.append(line)
            return

        parts = [x.strip() for x in line.split(",")]
        if len(parts) not in (5, 9):
            return
        try:
            _millis = float(parts[0])
            values = [float(x) for x in parts[1:]]
        except ValueError:
            return

        if len(parts) == 5:
            # Simple Arduino format: millis,ch1,ch2,ch3,ch4.
            # The pasted sketch sends Arduino-computed envelopes, so use them
            # for both display and comparison.
            env = np.array(values[0:4], dtype=np.float32)
            sig = env.copy()
        else:
            sig = np.array([values[0], values[2], values[4], values[6]], dtype=np.float32)
            env = np.array([values[1], values[3], values[5], values[7]], dtype=np.float32)

        self.filtered_data[:, :-1] = self.filtered_data[:, 1:]
        self.filtered_data[:, -1] = sig
        self.envelope_data[:, :-1] = self.envelope_data[:, 1:]
        self.envelope_data[:, -1] = env
        active_mask = env > self.active_threshold_spin.value()
        self.activity_data[:, :-1] = self.activity_data[:, 1:]
        self.activity_data[:, -1] = np.where(active_mask, env, 0.0)

        self.latest_signal = sig
        self.latest_envelope = env
        self.total_frames += 1
        self.last_data_time = time.time()

        if self.stats_warmup_remaining > 0:
            self.stats_warmup_remaining -= 1
            if self.stats_warmup_remaining == 0:
                self.status_label.setText("Signal settled. EMG statistics recording started.")
            else:
                self.status_label.setText(
                    f"Settling EMG filters... {self.stats_warmup_remaining} samples"
                )
            if self.enable_log:
                self._log_queue.append(line)
            return

        if self.session_started_at is None:
            self.session_started_at = self.last_data_time
            self.report_generated = False
            self.snapshot_captured = False
        self.session_sample_count += 1
        self.session_peaks = np.maximum(self.session_peaks, env)
        self.session_sum_envelope += env
        self.session_active_counts += (env > self.active_threshold_spin.value()).astype(np.int64)
        mean_env = float(np.mean(env))
        if self.session_sample_count <= self.session_first_window.maxlen:
            self.session_first_window.append(mean_env)
        self.session_recent_window.append(mean_env)
        self.update_best_activity_snapshot(env)
        self.check_auto_report_timer(update_label=False)

        if self.enable_log:
            self._log_queue.append(line)

    def change_window_size(self):
        new_size = self.samples_spin.value()
        old_size = self.max_points
        self.max_points = new_size
        if new_size > old_size:
            extra1 = np.zeros((self.num_channels, new_size - old_size), dtype=np.float32)
            extra2 = np.zeros((self.num_channels, new_size - old_size), dtype=np.float32)
            self.filtered_data = np.hstack((self.filtered_data, extra1))
            self.envelope_data = np.hstack((self.envelope_data, extra2))
            self.activity_data = np.hstack((self.activity_data, extra2.copy()))
        else:
            self.filtered_data = self.filtered_data[:, -new_size:]
            self.envelope_data = self.envelope_data[:, -new_size:]
            self.activity_data = self.activity_data[:, -new_size:]
        self.status_label.setText(f"Window changed to {new_size}")

    def update_plot(self):
        if not hasattr(self, '_last_ui_update_time'):
            self._last_ui_update_time = 0.0

        # 1. Update Graph Curves (100+ FPS)
        for i, curve in enumerate(self.curves):
            if curve is not None and self.signal_visible[i]:
                curve.setData(self.filtered_data[i])
                if i < len(self.strength_curves) and self.strength_curves[i] is not None:
                    self.strength_curves[i].setData(self.envelope_data[i])
                if i < len(self.activity_curves) and self.activity_curves[i] is not None:
                    self.activity_curves[i].setData(self.activity_data[i])

        # 2. Throttled UI Text & Stats updates (10 FPS) to prevent GUI lag
        now_ms = time.time() * 1000
        if now_ms - self._last_ui_update_time >= 100:
            self._last_ui_update_time = now_ms

            if self.session_started_at:
                self.check_auto_report_timer(update_label=True)

            for i in range(self.num_channels):
                cleaned = float(self.latest_signal[i])
                strength = float(self.latest_envelope[i])
                is_active = strength > float(self.active_threshold_spin.value())
                self.signal_cards[i].value_label.setText(f"{strength:.1f}")
                if hasattr(self.signal_cards[i], "clean_value_label"):
                    self.signal_cards[i].clean_value_label.setText(f"{cleaned:.2f}")
                    self.signal_cards[i].strength_value_label.setText(f"{strength:.2f}")
                    self.signal_cards[i].active_value_label.setText("ACTIVE" if is_active else "IDLE")
                    self.signal_cards[i].active_value_label.setStyleSheet(
                        "color:#FF2D55;font-size:10px;font-weight:900;border:0;background:transparent;"
                        if is_active
                        else "color:#8CA0BB;font-size:10px;font-weight:900;border:0;background:transparent;"
                    )
                if self.session_sample_count > 0:
                    active_pct = 100.0 * float(self.session_active_counts[i]) / float(self.session_sample_count)
                    self.signal_cards[i].extra_label.setText(
                        f"Peak: {self.session_peaks[i]:.1f} | Active: {active_pct:.1f}%"
                    )
            
            self.update_comparison_text()
            self.update_rehab_scorecard()
            self.stat_frames.value_label.setText(str(self.total_frames))

    def flush_log_box(self):
        if not self.enable_log or not self._log_queue:
            return

        batch_size = min(len(self._log_queue), 80)
        batch = self._log_queue[:batch_size]
        del self._log_queue[:batch_size]
        self.log_box.appendPlainText("\n".join(batch))

        doc = self.log_box.document()
        while doc.blockCount() > 250:
            cursor = QtGui.QTextCursor(doc.findBlockByNumber(0))
            cursor.select(QtGui.QTextCursor.BlockUnderCursor)
            cursor.removeSelectedText()
            cursor.deleteChar()

    def update_comparison_text(self):
        names = [e.text().strip() or f"Channel {i+1}" for i, e in enumerate(self.channel_name_edits)]
        latest = self.latest_envelope.copy()
        side_sel = self.affected_side_combo.currentText()

        if np.all(latest == 0):
            self.compare_output.setHtml(
                "<span style='color:#8CA0BB;'>Live data connected. Signal is idle / below threshold.</span>"
            )
            return

        if self.session_sample_count > 0:
            m = self.compute_rehab_metrics()
            if m.get("no_contact"):
                self.stat_comparison.value_label.setText("-")
                self.stat_most_active.value_label.setText("No contact")
                self.compare_output.setHtml(
                    "<span style='color:#FFD166;'>Idle/no-contact baseline detected. "
                    "Attach electrodes and press CLEAR before interpretation.</span>"
                )
                return

        ch1, ch2, ch3, ch4 = latest
        left_mean = float((ch1 + ch2) / 2.0)
        right_mean = float((ch3 + ch4) / 2.0)
        ratio = 100.0 * left_mean / right_mean if right_mean > 1e-6 else 0.0
        self.stat_comparison.value_label.setText(f"{ratio:.1f}%")
        
        most_idx = int(np.argmax(latest))
        self.stat_most_active.value_label.setText(names[most_idx])
        self.compare_output.setHtml(
            "<div style='color:#DDE6F2; font-size:14px; font-family: Segoe UI, sans-serif;'>"
            f"Live signal received.<br>"
            f"Strongest: <b>{names[most_idx]}</b> ({latest[most_idx]:.1f})<br>"
            f"Left avg: {left_mean:.1f} | Right avg: {right_mean:.1f}<br>"
            "Yellow = cleaned signal, green = strength, red = active zone."
            "</div>"
        )

        # Automatic local EMG analysis trigger
        current_time = time.time() * 1000
        if current_time - self.last_ai_update > self.ai_update_interval:
            self.trigger_ai_analyst(names, latest, ratio, side_sel)

    def compute_rehab_metrics(self):
        names = [e.text().strip() or f"Channel {i+1}" for i, e in enumerate(self.channel_name_edits)]
        latest = self.latest_envelope.astype(np.float64)
        count = max(1, self.session_sample_count)
        means = np.array([float(self.session_sum_envelope[i] / count) for i in range(4)], dtype=np.float64)
        peaks = self.session_peaks.astype(np.float64)
        active_pct = np.array([
            100.0 * float(self.session_active_counts[i]) / count
            for i in range(4)
        ], dtype=np.float64)

        left_mean = float((means[0] + means[1]) / 2.0)
        right_mean = float((means[2] + means[3]) / 2.0)
        stronger = max(left_mean, right_mean)
        weaker = min(left_mean, right_mean)
        symmetry = 100.0 * weaker / stronger if stronger > 1e-6 else 0.0
        deficit = max(0.0, 100.0 - symmetry)
        weaker_side = "Left" if left_mean < right_mean else "Right"

        left_pair_stronger = max(float(means[0]), float(means[1]))
        left_pair_weaker = min(float(means[0]), float(means[1]))
        right_pair_stronger = max(float(means[2]), float(means[3]))
        right_pair_weaker = min(float(means[2]), float(means[3]))
        left_pair_balance = 100.0 * left_pair_weaker / left_pair_stronger if left_pair_stronger > 1e-6 else 0.0
        right_pair_balance = 100.0 * right_pair_weaker / right_pair_stronger if right_pair_stronger > 1e-6 else 0.0
        pair_balance = float((left_pair_balance + right_pair_balance) / 2.0)

        first_avg = float(np.mean(self.session_first_window)) if self.session_first_window else 0.0
        recent_avg = float(np.mean(self.session_recent_window)) if self.session_recent_window else 0.0
        fatigue_drop = max(0.0, 100.0 * (first_avg - recent_avg) / first_avg) if first_avg > 1e-6 else 0.0

        mean_level = float(np.mean(means))
        active_mean = float(np.mean(active_pct))
        threshold = float(self.active_threshold_spin.value())
        no_contact = (
            mean_level < max(5.0, threshold * 0.35)
            and active_mean < 8.0
            and float(np.max(peaks)) < threshold
        )
        if no_contact:
            signal_quality = "Idle / No contact"
            quality_score = 0.0
        elif mean_level < max(5.0, threshold * 0.20):
            signal_quality = "Low"
            quality_score = 45.0
        elif active_mean >= 10.0 and np.any(peaks > threshold) and np.all(np.isfinite(means)):
            signal_quality = "Good"
            quality_score = 90.0
        else:
            signal_quality = "Fair"
            quality_score = 70.0

        fatigue_score = max(0.0, 100.0 - fatigue_drop)
        rehab_score = int(round(np.clip(
            0.35 * symmetry + 0.20 * fatigue_score + 0.20 * pair_balance + 0.15 * quality_score + 0.10 * min(100.0, float(np.mean(active_pct))),
            0.0,
            100.0,
        )))
        if no_contact:
            rehab_score = 0

        weakest_idx = int(np.argmin(means))
        strongest_idx = int(np.argmax(peaks))

        if fatigue_drop >= 30.0:
            fatigue_level = "High"
        elif fatigue_drop >= 15.0:
            fatigue_level = "Moderate"
        else:
            fatigue_level = "Low"

        metrics = {
            "names": names,
            "latest": latest,
            "means": means,
            "peaks": peaks,
            "active_pct": active_pct,
            "left_mean": left_mean,
            "right_mean": right_mean,
            "symmetry": symmetry,
            "deficit": deficit,
            "weaker_side": weaker_side,
            "left_pair_balance": left_pair_balance,
            "right_pair_balance": right_pair_balance,
            "pair_balance": pair_balance,
            "fatigue_drop": fatigue_drop,
            "fatigue_level": fatigue_level,
            "signal_quality": signal_quality,
            "no_contact": no_contact,
            "rehab_score": rehab_score,
            "weakest_idx": weakest_idx,
            "strongest_idx": strongest_idx,
            "weakest_name": names[weakest_idx],
            "strongest_name": names[strongest_idx],
        }
        self.latest_rehab_metrics = metrics
        return metrics

    def update_rehab_scorecard(self):
        if self.session_sample_count <= 0:
            return

        m = self.compute_rehab_metrics()
        if m.get("no_contact"):
            self.stat_rehab_score.value_label.setText("0/100")
            self.stat_deficit.value_label.setText("-")
            self.stat_pair_balance.value_label.setText("-")
            self.stat_fatigue.value_label.setText("-")
            self.stat_weakest.value_label.setText("No contact")
            self.stat_quality.value_label.setText(m["signal_quality"])
            return

        self.stat_rehab_score.value_label.setText(f"{m['rehab_score']}/100")
        self.stat_deficit.value_label.setText(f"{m['deficit']:.1f}%")
        self.stat_pair_balance.value_label.setText(f"L {m['left_pair_balance']:.0f}% | R {m['right_pair_balance']:.0f}%")
        self.stat_fatigue.value_label.setText(f"{m['fatigue_level']} {m['fatigue_drop']:.0f}%")
        self.stat_weakest.value_label.setText(m["weakest_name"])
        self.stat_quality.value_label.setText(m["signal_quality"])

    def trigger_ai_analyst(self, names, values, ratio, affected_side):
        stats_summary = {
            "Channels": {names[i]: float(values[i]) for i in range(4)},
            "Left_to_Right_Ratio": f"{ratio:.1f}%",
            "Affected_Side_Selection": affected_side,
            "Timestamp": datetime.now().strftime("%H:%M:%S")
        }
        self._last_ai_stats_summary = stats_summary
        text = self.build_local_ai_analysis(stats_summary)
        self.last_ai_update = time.time() * 1000
        self.latest_ai_analysis = text
        self.compare_output.setHtml(
            "<div style='color:#FFFFFF; font-size:14px; font-family: Segoe UI, sans-serif;'>"
            + text.replace("\n", "<br>")
            + "<br><br><span style='color:#00E5FF;'>Local data-based analysis. No internet AI used.</span>"
            + "</div>"
        )
        return

    def build_local_ai_analysis(self, stats_summary):
        if self.session_sample_count <= 0:
            return "Local analysis unavailable until live EMG data is received."

        m = self.compute_rehab_metrics()
        affected_side = stats_summary.get("Affected_Side_Selection", "Not selected") if stats_summary else "Not selected"

        if m.get("no_contact"):
            return (
                f"* Session Score: 0/100. Signal Quality: {m['signal_quality']}.\n"
                "* Electrodes/sensor contact are not detected strongly enough for left-right interpretation.\n"
                "* Current values are being treated as idle baseline/noise, not muscle activation.\n"
                "* Connect all electrodes with a shared reference/ground, then press CLEAR to start a clean session.\n"
                f"* Selected affected side: {affected_side}. Non-diagnostic rehab monitoring support only."
            )

        if m["deficit"] >= 30.0:
            symmetry_text = f"Marked {m['weaker_side'].lower()}-side deficit detected."
        elif m["deficit"] >= 15.0:
            symmetry_text = f"Mild to moderate {m['weaker_side'].lower()}-side deficit detected."
        else:
            symmetry_text = "Left-right activation is relatively balanced."

        pair_note = (
            f"left-side channel balance {m['left_pair_balance']:.0f}%; "
            f"right-side channel balance {m['right_pair_balance']:.0f}%."
        )
        if m["right_pair_balance"] < 60.0:
            focus = "Suggested focus: compare the two right-side muscles/channels and train the weaker activation pattern."
        elif m["left_pair_balance"] < 60.0:
            focus = "Suggested focus: compare the two left-side muscles/channels and train the weaker activation pattern."
        elif m["fatigue_drop"] >= 20.0:
            focus = "Suggested focus: endurance training with planned rest intervals."
        else:
            focus = "Suggested focus: continue balanced voluntary activation practice."

        return (
            f"* Session Score: {m['rehab_score']}/100. Signal Quality: {m['signal_quality']}.\n"
            f"* Side Deficit: {m['deficit']:.1f}%. Symmetry Score: {m['symmetry']:.1f}%. {symmetry_text}\n"
            f"* Lowest Activity: {m['weakest_name']}. Highest Peak: {m['strongest_name']}.\n"
            f"* Fatigue Drop: {m['fatigue_level']} ({m['fatigue_drop']:.1f}% decline from early to recent activity).\n"
            f"* Channel Balance: {pair_note}\n"
            f"* {focus}\n"
            f"* Selected affected side: {affected_side}. Non-diagnostic rehab monitoring support only."
        )


    def save_plot(self):
        path, _ = QtWidgets.QFileDialog.getSaveFileName(
            self, "Save Plot", "NeuroPulseAI_4CH_EMG_auto_wireless.png", "PNG Files (*.png)"
        )
        if not path:
            return
        exporter = pg.exporters.ImageExporter(self.plot_layout_widget.scene())
        exporter.export(path)
        self.status_label.setText(f"Saved: {path}")

    def toggle_channel(self, index):
        self.signal_visible[index] = self.signal_checkboxes[index].isChecked()
        self.update_visible_plots()
        self.update_side_labels()


    def clear_plot(self):
        self.filtered_data.fill(0)
        self.envelope_data.fill(0)
        self.activity_data.fill(0)
        self.total_frames = 0
        self.session_sample_count = 0
        self.session_peaks.fill(0)
        self.session_sum_envelope.fill(0)
        self.session_active_counts.fill(0)
        self.session_first_window.clear()
        self.session_recent_window.clear()
        self.latest_rehab_metrics = {}
        self.stats_warmup_remaining = self.stats_warmup_samples
        self.session_started_at = None
        self.report_generated = False
        self.auto_report_completed = False
        self.report_generation_in_progress = False
        self.snapshot_captured = False
        self.best_snapshot_score = 0.0
        self.last_best_snapshot_time = 0.0
        if self.snapshot_path and os.path.exists(self.snapshot_path):
            try:
                os.remove(self.snapshot_path)
            except OSError:
                pass
        self.snapshot_path = None
        self.stat_frames.value_label.setText("0")
        self.status_label.setText("Plot cleared. Waiting for EMG filters to settle." if self.connected_mode else "Plot and session stats cleared")

    def update_best_activity_snapshot(self, env):
        threshold = float(self.active_threshold_spin.value())
        if not np.any(env > threshold):
            return
        recent_env = self.envelope_data[:, -min(80, self.envelope_data.shape[1]):]
        recent_sig = self.filtered_data[:, -min(80, self.filtered_data.shape[1]):]
        active_points = float(np.count_nonzero(recent_env > threshold))
        peak_score = float(np.max(recent_env))
        spread_score = float(np.mean(np.ptp(recent_sig, axis=1)))
        activity_score = peak_score + (0.25 * active_points) + (0.15 * spread_score)
        if activity_score <= 0.0:
            return

        now = time.time()
        min_improvement = max(12.0, self.best_snapshot_score * 0.12)
        if self.best_snapshot_score > 0 and activity_score < self.best_snapshot_score + min_improvement:
            return
        if now - self.last_best_snapshot_time < 2.0:
            return

        self.best_snapshot_score = max(self.best_snapshot_score, activity_score)
        self.last_best_snapshot_time = now
        self.capture_report_snapshot(force=True, reason="best activity", score=activity_score)

    def capture_report_snapshot(self, force=False, reason="30-second", score=None):
        if self.snapshot_captured and not force:
            return
        try:
            os.makedirs("reports", exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            if force and self.snapshot_path and os.path.exists(self.snapshot_path):
                try:
                    os.remove(self.snapshot_path)
                except OSError:
                    pass
            self.snapshot_path = f"reports/snapshot_{reason.replace(' ', '_')}_{timestamp}.png"
            QtCore.QTimer.singleShot(150, lambda path=self.snapshot_path, sc=score, rsn=reason: self.finish_report_snapshot(path, sc, rsn))
            self.snapshot_captured = True
        except Exception as e:
            self.snapshot_path = None
            self.snapshot_captured = True
            self.status_label.setText(f"{reason.title()} snapshot failed: {e}")

    def finish_report_snapshot(self, path, score, reason):
        try:
            captured = self.export_graph_snapshot(path)
            if not captured:
                if path and os.path.exists(path):
                    try:
                        os.remove(path)
                    except OSError:
                        pass
                self.snapshot_path = None
                self.status_label.setText(f"{reason.title()} graph snapshot unavailable; report will use metrics only")
            else:
                if score is not None:
                    self.best_snapshot_score = max(self.best_snapshot_score, float(score))
                    self.last_best_snapshot_time = time.time()
                    self.status_label.setText(f"Best activity snapshot captured for report (score {self.best_snapshot_score:.1f})")
                else:
                    self.status_label.setText(f"{reason.title()} graph snapshot captured for report")
        except Exception as e:
            self.snapshot_path = None
            self.snapshot_captured = True
            self.status_label.setText(f"{reason.title()} snapshot failed: {e}")

    def export_graph_snapshot(self, path):
        try:
            QtWidgets.QApplication.processEvents()
            self.plot_layout_widget.repaint()
            QtWidgets.QApplication.processEvents()
            exporter = pg.exporters.ImageExporter(self.plot_layout_widget.scene())
            exporter.parameters()["width"] = 2400
            exporter.export(path)
            QtWidgets.QApplication.processEvents()
            return os.path.exists(path) and os.path.getsize(path) >= 100
        except Exception:
            return False

    def check_auto_report_timer(self, update_label=True):
        if not self.session_started_at:
            return

        elapsed = int(time.time() - self.session_started_at)
        if update_label:
            self.stat_session.value_label.setText(f"{elapsed} s")

        if elapsed >= self.snapshot_seconds and not self.snapshot_captured:
            self.capture_report_snapshot()

        if (
            elapsed >= self.report_interval_seconds
            and not self.auto_report_completed
            and not self.report_generation_in_progress
        ):
            self.report_generation_in_progress = True
            self.status_label.setText("Report generating... 60-second session complete.")
            QtCore.QTimer.singleShot(0, self.generate_auto_pdf_report)

    def generate_auto_pdf_report(self):
        if self.auto_report_completed:
            self.report_generation_in_progress = False
            return
        self.generate_pdf_report(auto_trigger=True)

    def build_session_report_findings(self):
        m = self.compute_rehab_metrics()
        names = m["names"]
        count = max(1, self.session_sample_count)
        affected_side = self.affected_side_combo.currentText()
        duration = int(time.time() - self.session_started_at) if self.session_started_at else 0

        if m["deficit"] >= 30.0:
            symmetry = f"marked {m['weaker_side'].lower()}-side activation deficit"
            balance = "Bilateral EMG symmetry is reduced and requires targeted rehab attention."
        elif m["deficit"] >= 15.0:
            symmetry = f"mild to moderate {m['weaker_side'].lower()}-side activation deficit"
            balance = "Side-to-side activation difference is present and should be monitored."
        else:
            symmetry = "near-symmetric bilateral activation"
            balance = "Left and right activation were within the balanced monitoring range."

        if affected_side == "Left Affected":
            affected_note = "The selected affected side is left; compare this report with clinical examination and patient symptoms."
        elif affected_side == "Right Affected":
            affected_note = "The selected affected side is right; compare this report with clinical examination and patient symptoms."
        elif affected_side == "Both Normal":
            affected_note = "No affected side was selected; findings describe side-to-side muscle activity only."
        else:
            affected_note = "Affected side was not selected; interpretation is limited to channel activity and symmetry."

        if m.get("no_contact"):
            return (
                f"* Recording summary: {count} EMG samples captured over approximately {duration} seconds.\n"
                f"* Session Score: 0/100. Signal Quality: {m['signal_quality']}.\n"
                "* Electrode/sensor contact was not strong enough for reliable EMG interpretation.\n"
                "* Recorded values are treated as idle baseline/noise, so side deficit, weakest muscle, fatigue, and symmetry findings are suppressed.\n"
                "* Action required: attach electrodes with correct reference/ground, wait for the signal to settle, then press CLEAR before recording.\n"
                f"* Clinical note: {affected_note} This is a non-diagnostic rehab monitoring prototype that provides quantitative EMG feedback for physiotherapy support."
            )

        return (
            f"* Recording summary: {count} EMG samples captured over approximately {duration} seconds.\n"
            f"* Session Score: {m['rehab_score']}/100. Signal Quality: {m['signal_quality']}.\n"
            f"* Side Deficit: {m['deficit']:.1f}%. Symmetry Score: {m['symmetry']:.1f}%. Impression: {symmetry}. {balance}\n"
            f"* Lowest Activity: {m['weakest_name']} showed the lowest average activation ({m['means'][m['weakest_idx']]:.1f}).\n"
            f"* Highest Peak: {m['strongest_name']} showed the highest peak activation ({m['peaks'][m['strongest_idx']]:.1f}).\n"
            f"* Channel Balance: left-side channel balance {m['left_pair_balance']:.1f}%; right-side channel balance {m['right_pair_balance']:.1f}%.\n"
            f"* Fatigue Drop: {m['fatigue_level']} fatigue pattern with {m['fatigue_drop']:.1f}% decline from early to recent activity.\n"
            f"* Sustained activation: {names[0]} {m['active_pct'][0]:.1f}%, {names[1]} {m['active_pct'][1]:.1f}%, {names[2]} {m['active_pct'][2]:.1f}%, {names[3]} {m['active_pct'][3]:.1f}% above threshold.\n"
            f"* Clinical note: {affected_note} This is a non-diagnostic rehab monitoring prototype that provides quantitative EMG feedback for physiotherapy support."
        )


    def generate_pdf_report(self, auto_trigger=False):
        """Capture the graph and build a local data-based PDF report."""
        try:
            self.status_label.setText("Report generating... capturing graph and compiling PDF.")
            self.report_btn.setText("REPORT GENERATING...")
            self.report_btn.setEnabled(False)
            QtWidgets.QApplication.processEvents()
            os.makedirs("reports", exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            temp_png = self.snapshot_path if auto_trigger and self.snapshot_path and os.path.exists(self.snapshot_path) else None
            if temp_png is None:
                temp_png = f"reports/temp_graph_{timestamp}.png"
                captured = self.export_graph_snapshot(temp_png)
                if not captured:
                    temp_png = None

            report_findings = self.build_session_report_findings()
            self.finalize_master_report(report_findings, temp_png, auto_trigger)
            return
            
        except Exception as e:
            if auto_trigger:
                self.auto_report_completed = False
                self.report_generated = False
                self.report_generation_in_progress = False
            self.report_btn.setText("GENERATE PDF REPORT")
            self.report_btn.setEnabled(True)
            self.status_label.setText(f"Report initialization error: {e}")
            self.show_report_error(f"Report initialization error:\n{e}")

    def finalize_master_report(self, vision_text, temp_png, auto_trigger):
        """Stage 2: Compile the Master PDF with multimodal findings and cleanup."""
        try:
            self.latest_vision_analysis = vision_text
            self.status_label.setText("Compiling Master Clinical Report...")
            
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, KeepTogether
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib import colors
            from reportlab.lib.units import inch
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            pdf_path = f"reports/NeuroPulse_Master_Report_{timestamp}.pdf"
            
            # Core Calculations
            m = self.compute_rehab_metrics()
            names = m["names"]
            means = m["means"]
            peaks = m["peaks"]
            active_pct = m["active_pct"]
            
            patient = self.name_input.text().strip() or "Unknown"
            case_id = self.id_input.text().strip() or "N/A"
            notes_widget = getattr(self, "notes_input", None)
            notes = notes_widget.text().strip() if notes_widget else ""
            notes = notes or "N/A"
            
            # PDF Document Setup
            doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=32, leftMargin=32, topMargin=32, bottomMargin=32)
            title_style = ParagraphStyle(
                'Title',
                fontSize=20,
                leading=25,
                textColor=colors.white,
                backColor=colors.HexColor("#0F2D52"),
                borderPadding=10,
                fontName='Helvetica-Bold',
                alignment=1,
                spaceAfter=12,
            )
            subtitle_style = ParagraphStyle(
                'Subtitle',
                fontSize=10,
                leading=14,
                textColor=colors.HexColor("#30445F"),
                alignment=1,
                spaceAfter=8,
            )
            section_title = ParagraphStyle('Section', fontSize=13, leading=16, fontName='Helvetica-Bold', backColor=colors.HexColor("#123B63"), textColor=colors.white, borderPadding=7, spaceBefore=10, spaceAfter=7, keepWithNext=True)
            body = ParagraphStyle('Body', fontSize=11.2, leading=15.2, textColor=colors.HexColor("#102033"))
            ai_style = ParagraphStyle(
                'AI',
                fontSize=11,
                leading=15,
                leftIndent=12,
                borderLeftColor=colors.HexColor("#00A7B5"),
                borderLeftWidth=3,
                borderPadding=8,
                backColor=colors.HexColor("#F7FBFF"),
                textColor=colors.HexColor("#102033"),
                spaceBefore=4,
                spaceAfter=6,
            )
            
            elements = []
            elements.append(Paragraph("NeuroPulse AI: Electromyography (EMG) Profile", title_style))
            elements.append(Spacer(1, 14))
            elements.append(Paragraph(
                "Yellow = cleaned signal &nbsp;&nbsp;|&nbsp;&nbsp; Green = muscle strength &nbsp;&nbsp;|&nbsp;&nbsp; Red = muscle active shadow",
                subtitle_style
            ))
            elements.append(Spacer(1, 14))
            elements.append(Paragraph(
                f"<b>Patient:</b> {patient} &nbsp;&nbsp;|&nbsp;&nbsp; <b>ID:</b> {case_id} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Date:</b> {datetime.now().strftime('%d-%m-%Y %H:%M')}",
                body
            ))
            elements.append(Spacer(1, 15))

            metric_strip = Table(
                [[
                    Paragraph(f"Avg Strength<br/><b>{float(np.mean(means)):.1f}</b>", subtitle_style),
                    Paragraph(f"Active Time<br/><b>{float(np.mean(active_pct)):.1f}%</b>", subtitle_style),
                    Paragraph(f"Major Spikes<br/><b>{int(np.sum(peaks > self.active_threshold_spin.value()))}</b>", subtitle_style),
                    Paragraph(f"Signal Quality<br/><b>{m['signal_quality']}</b>", subtitle_style),
                ]],
                colWidths=[1.75 * inch, 1.75 * inch, 1.75 * inch, 1.75 * inch],
            )
            metric_strip.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, 0), colors.HexColor("#E9F8EF")),
                ('BACKGROUND', (1, 0), (1, 0), colors.HexColor("#FFECEF")),
                ('BACKGROUND', (2, 0), (2, 0), colors.HexColor("#FFF7D6")),
                ('BACKGROUND', (3, 0), (3, 0), colors.HexColor("#EAF2FF")),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor("#102033")),
                ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor("#B8C7D9")),
                ('INNERGRID', (0, 0), (-1, -1), 0.6, colors.HexColor("#D4DEE8")),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('PADDING', (0, 0), (-1, -1), 9),
            ]))
            elements.append(metric_strip)
            elements.append(Spacer(1, 8))

            elements.append(Paragraph("1. Clinical Summary", section_title))
            summary_data = [
                ["Session Score", f"{m['rehab_score']}/100"],
                ["Symmetry Score", f"{m['symmetry']:.1f}%"],
                ["Side Deficit", f"{m['deficit']:.1f}% ({m['weaker_side']} lower)"],
                ["Lowest Activity Channel", m["weakest_name"]],
                ["Fatigue Drop", f"{m['fatigue_level']} ({m['fatigue_drop']:.1f}% decline)"],
                ["Signal Quality", m["signal_quality"]],
            ]
            summary_table = Table(summary_data, colWidths=[2.5 * inch, 4.5 * inch])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#EAF2FF")),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor("#0F2D52")),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#B8C7D9")),
                ('PADDING', (0, 0), (-1, -1), 7),
            ]))
            elements.append(summary_table)
            elements.append(Spacer(1, 10))

            elements.append(Paragraph("2. 30-Second Graph Snapshot", section_title))
            if temp_png and os.path.exists(temp_png):
                img = Image(temp_png)
                img.drawWidth = 7.55 * inch
                img.drawHeight = 3.2 * inch
                elements.append(img)
            else:
                elements.append(Paragraph("Graph snapshot was not available. Quantitative session metrics are included below.", body))
            elements.append(Spacer(1, 10))

            elements.append(Paragraph("3. Muscle-wise Quantitative Summary", section_title))
            table_data = [["Muscle / Channel", "Avg", "Peak", "Active %", "Quality"]]
            for i in range(4):
                q = "No contact" if m.get("no_contact") else ("Good" if active_pct[i] >= 10.0 and peaks[i] > self.active_threshold_spin.value() else "Low")
                table_data.append([names[i], f"{means[i]:.1f}", f"{peaks[i]:.1f}", f"{active_pct[i]:.1f}%", q])

            t = Table(table_data, colWidths=[2.0*inch, 1.2*inch, 1.2*inch, 1.2*inch, 1.2*inch])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#EAF2FF")),
                ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#0F2D52")),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#B8C7D9")),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('PADDING', (0, 0), (-1, -1), 6),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FBFF")])
            ]))
            elements.append(t)

            elements.append(KeepTogether([
                Paragraph("4. Local Data-Based EMG Findings", section_title),
                Paragraph("<b>Signal Reasoning (Quantitative Text Analysis):</b>", body),
                Paragraph(self.latest_ai_analysis.replace("\n", "<br/>"), ai_style),
            ]))
            elements.append(Spacer(1, 8))
            elements.append(KeepTogether([
                Paragraph("<b>Recorded Session Findings:</b>", body),
                Paragraph(vision_text.replace("\n", "<br/>"), ai_style),
            ]))

            elements.append(KeepTogether([
                Paragraph("5. Clinical Observations & Notes", section_title),
                Paragraph(f"<b>Summary Notes:</b> {notes}", body),
            ]))
            elements.append(Spacer(1, 10))
            elements.append(Paragraph("<b>Comparative Analysis:</b>", body))
            left_mean = m["left_mean"]
            right_mean = m["right_mean"]
            ratio = m["symmetry"]
            most_idx = m["strongest_idx"]
            summary_html = f"""
            - Left Side Avg: {left_mean:.1f}<br/>
            - Right Side Avg: {right_mean:.1f}<br/>
            - Symmetry Ratio (L/R): {ratio:.1f}%<br/>
            - Most Dynamic Channel: {names[most_idx]}
            """
            elements.append(Paragraph(summary_html, body))

            doc.build(elements)
            self.last_report_path = os.path.abspath(pdf_path)
            if auto_trigger:
                self.auto_report_completed = True
                self.report_generated = True
                self.report_generation_in_progress = False
            self.status_label.setText(f"Master Report Finalized: {pdf_path}")
            self.open_report_and_notify(pdf_path, auto_trigger)
            
            # Stage 3: Cleanup temporary images after the PDF is built.
            if temp_png and os.path.exists(temp_png):
                os.remove(temp_png)
            if temp_png == self.snapshot_path:
                self.snapshot_path = None
            self.report_btn.setText("GENERATE PDF REPORT")
            self.report_btn.setEnabled(True)
                
        except Exception as e:
            if auto_trigger:
                self.auto_report_completed = False
                self.report_generated = False
                self.report_generation_in_progress = False
            self.report_btn.setText("GENERATE PDF REPORT")
            self.report_btn.setEnabled(True)
            self.status_label.setText(f"Master Report Error: {e}")
            self.show_report_error(f"Master Report Error:\n{e}")
            if temp_png and os.path.exists(temp_png):
                os.remove(temp_png)

    def open_report_and_notify(self, pdf_path, auto_trigger):
        abs_path = os.path.abspath(pdf_path)
        opened = False
        try:
            os.startfile(abs_path)
            opened = True
        except Exception as e:
            self.status_label.setText(f"Report saved but could not open automatically: {e}")

        title = "Automatic 60-Second Report Ready" if auto_trigger else "Master Report Ready"
        message = (
            "Automatic 1-minute EMG rehab report generated.\n\n"
            if auto_trigger
            else "EMG rehab report generated.\n\n"
        )
        message += f"Saved to:\n{abs_path}"
        if opened:
            message += "\n\nThe PDF has been opened on screen."

        box = QtWidgets.QMessageBox(self)
        box.setIcon(QtWidgets.QMessageBox.Information)
        box.setWindowTitle(title)
        box.setText(message)
        box.setStandardButtons(QtWidgets.QMessageBox.Ok)
        box.setWindowModality(QtCore.Qt.ApplicationModal)
        box.setWindowFlag(QtCore.Qt.WindowStaysOnTopHint, True)
        box.exec_()

    def show_report_error(self, message):
        box = QtWidgets.QMessageBox(self)
        box.setIcon(QtWidgets.QMessageBox.Critical)
        box.setWindowTitle("Report Generation Failed")
        box.setText(message)
        box.setStandardButtons(QtWidgets.QMessageBox.Ok)
        box.setWindowModality(QtCore.Qt.ApplicationModal)
        box.setWindowFlag(QtCore.Qt.WindowStaysOnTopHint, True)
        box.exec_()



def main():
    app = QtWidgets.QApplication(sys.argv)
    window = NeuroPulseAI4ChAutoWirelessPlotter()
    window.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
