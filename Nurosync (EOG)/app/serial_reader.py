from PySide6.QtCore import QThread, Signal
import serial
import serial.tools.list_ports
import time

class SerialReader(QThread):
    connected = Signal(str)
    disconnected = Signal()
    error_occurred = Signal(str)
    raw_line_received = Signal(str)

    def __init__(self):
        super().__init__()
        self.serial_port = None
        self.port_name = None
        self.baud_rate = 115200
        self.running = False

    def connect_port(self, port_name, baud_rate=115200):
        self.port_name = port_name
        self.baud_rate = baud_rate
        self.start()

    def disconnect_port(self):
        self.running = False
        self.wait()
        if self.serial_port and self.serial_port.is_open:
            try:
                self.serial_port.close()
            except Exception:
                pass
        self.disconnected.emit()

    def write_line(self, line):
        if self.serial_port and self.serial_port.is_open:
            try:
                self.serial_port.write(line.encode('utf-8'))
                return True
            except Exception as e:
                self.error_occurred.emit(f"Serial write error: {str(e)}")
        return False

    def run(self):
        try:
            self.serial_port = serial.Serial(self.port_name, self.baud_rate, timeout=1)
            self.running = True
            self.connected.emit(self.port_name)
        except Exception as e:
            self.error_occurred.emit(f"Failed to connect: {str(e)}")
            return

        while self.running:
            if self.serial_port and self.serial_port.is_open:
                try:
                    if self.serial_port.in_waiting > 0:
                        line = self.serial_port.readline().decode('utf-8', errors='ignore').strip()
                        if line:
                            self.raw_line_received.emit(line)
                    else:
                        time.sleep(0.01)
                except serial.SerialException as e:
                    self.error_occurred.emit(f"Serial disconnected: {str(e)}")
                    self.running = False
                    self.disconnected.emit()
                    break

    @staticmethod
    def get_available_ports():
        return [port.device for port in serial.tools.list_ports.comports()]
