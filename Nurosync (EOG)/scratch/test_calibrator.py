import sys
import os
import unittest
from PySide6.QtCore import QCoreApplication

# Ensure app path is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.ui import SmartBlinkCalibrator, SessionData

class MockSerialPort:
    def __init__(self):
        self.is_open = True

    def write(self, data):
        pass

class MockSerialWorker:
    def __init__(self):
        self.serial_port = MockSerialPort()

    def write_line(self, line):
        return True

class TestSmartBlinkCalibrator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Instantiate QApplication for QTimer to work
        cls.app = QCoreApplication(sys.argv)

    def setUp(self):
        self.serial_worker = MockSerialWorker()
        self.session_data = SessionData()
        self.calibrator = SmartBlinkCalibrator(self.serial_worker, self.session_data)
        
        self.status_updates = []
        self.finish_result = None

        self.calibrator.status_changed.connect(lambda msg, pct: self.status_updates.append((msg, pct)))
        self.calibrator.calibration_finished.connect(lambda success, msg: setattr(self, "finish_result", (success, msg)))

    def test_successful_calibration(self):
        # 1. Start calibration
        success = self.calibrator.start_calibration()
        self.assertTrue(success)
        self.assertEqual(self.calibrator.state, SmartBlinkCalibrator.STATE_RESTING)

        # 2. Simulate 5 seconds of resting data (approx 50 samples)
        # Baseline = 2000, std = ~10
        for _ in range(50):
            self.calibrator.handle_telemetry(2000, 2000, 2700)
            self.calibrator.handle_telemetry(1990, 2000, 2700)
            self.calibrator.handle_telemetry(2010, 2000, 2700)

        # Force state transition to blinking phase
        self.calibrator.state = SmartBlinkCalibrator.STATE_BLINKING

        # 3. Simulate 10 seconds of blinking data (approx 100 samples)
        # Create 5 distinct blink peaks (around 3000)
        # Blink duration is approx 200-300ms, so 20-30 samples
        for i in range(200):
            # Baseline
            self.calibrator.handle_telemetry(2000, 2000, 2700)

        # Function to inject a blink
        def inject_blink():
            for val in [2000, 2200, 2500, 2900, 3200, 3500, 3200, 2900, 2500, 2200, 2000]:
                self.calibrator.handle_telemetry(val, 2000, 2700)

        for _ in range(5):
            inject_blink()
            for _ in range(20):
                self.calibrator.handle_telemetry(2000, 2000, 2700)

        # Run calculation
        self.calibrator.calculate_calibration()

        # Check results
        self.assertIsNotNone(self.finish_result)
        success, message = self.finish_result
        self.assertTrue(success, f"Calibration failed with message: {message}")

        # Check session data fields
        self.assertIsNotNone(self.session_data.last_cal_threshold)
        self.assertIsNotNone(self.session_data.last_cal_baseline)
        self.assertIsNotNone(self.session_data.last_cal_noise)
        self.assertIsNotNone(self.session_data.last_cal_avg_peak)
        self.assertEqual(self.session_data.last_cal_strength, "Strong")
        self.assertEqual(self.session_data.last_cal_confidence, "High")

    def test_failure_disconnected(self):
        self.serial_worker.serial_port.is_open = False
        success = self.calibrator.start_calibration()
        self.assertFalse(success)
        self.assertIsNotNone(self.finish_result)
        self.assertFalse(self.finish_result[0])
        self.assertEqual(self.finish_result[1], "Connect headband first.")

    def test_failure_not_enough_telemetry(self):
        success = self.calibrator.start_calibration()
        self.assertTrue(success)
        # Do not feed any telemetry
        self.calibrator.calculate_calibration()
        self.assertIsNotNone(self.finish_result)
        self.assertFalse(self.finish_result[0])
        self.assertEqual(self.finish_result[1], "Not enough telemetry for calibration.")

    def test_failure_saturated_signal(self):
        success = self.calibrator.start_calibration()
        self.assertTrue(success)
        
        # Feed all 4095
        for _ in range(60):
            self.calibrator.handle_telemetry(4095, 2000, 2700)
            
        self.calibrator.state = SmartBlinkCalibrator.STATE_BLINKING
        for _ in range(120):
            self.calibrator.handle_telemetry(4095, 2000, 2700)
            
        self.calibrator.calculate_calibration()
        self.assertFalse(self.finish_result[0])
        self.assertIn("Poor electrode contact", self.finish_result[1])

    def test_failure_weak_signal(self):
        success = self.calibrator.start_calibration()
        self.assertTrue(success)
        
        # Feed baseline
        for _ in range(60):
            self.calibrator.handle_telemetry(2000, 2000, 2700)
            
        self.calibrator.state = SmartBlinkCalibrator.STATE_BLINKING
        # Feed very tiny fluctuations (max 2050)
        for _ in range(120):
            self.calibrator.handle_telemetry(2000, 2000, 2700)
            self.calibrator.handle_telemetry(2050, 2000, 2700)
            
        self.calibrator.calculate_calibration()
        self.assertFalse(self.finish_result[0])
        self.assertIn("Blink signal too weak", self.finish_result[1])

if __name__ == "__main__":
    unittest.main()
