import sys
from PySide6.QtWidgets import QApplication
from app.serial_reader import SerialReader
from app.parser import DataParser
from app.ui import NuroSyncApp

def main():
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    
    serial_worker = SerialReader()
    parser = DataParser()
    
    serial_worker.raw_line_received.connect(parser.parse_line)
    
    window = NuroSyncApp(serial_worker, parser)
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
