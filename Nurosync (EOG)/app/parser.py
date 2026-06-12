from PySide6.QtCore import QObject, Signal

class DataParser(QObject):
    telemetry_received = Signal(float, float, float)
    command_received = Signal(str)
    blink_detected = Signal(int)
    blink_executed = Signal(int)
    parse_error = Signal(str)

    def parse_line(self, line):
        try:
            line = line.strip()
            if not line:
                return

            if line.startswith("Command:"):
                cmd = line.split(":", 1)[1].strip()
                self.command_received.emit(cmd)
            
            elif line.startswith("Blink detected in sequence:"):
                val = line.split(":", 1)[1].strip()
                self.blink_detected.emit(int(val))
                
            elif line.startswith("Blink sequence executed:"):
                val = line.split(":", 1)[1].strip()
                self.blink_executed.emit(int(val))
                
            elif "Raw_Signal:" in line and "Baseline:" in line and "Blink_Threshold:" in line:
                parts = line.split(",")
                raw = base = thresh = 0.0
                valid = True
                for part in parts:
                    if ":" in part:
                        key, val = part.split(":", 1)
                        key = key.strip()
                        try:
                            val = float(val.strip())
                            if key == "Raw_Signal":
                                raw = val
                            elif key == "Baseline":
                                base = val
                            elif key == "Blink_Threshold":
                                thresh = val
                        except ValueError:
                            valid = False
                if valid:
                    self.telemetry_received.emit(raw, base, thresh)
                else:
                    self.parse_error.emit(line)
            else:
                self.parse_error.emit(line)
        except Exception as e:
            self.parse_error.emit(line)
