# NuroSync Python Desktop App

This is a lightweight Python desktop app for monitoring the NuroSync ESP32-S3 headband, visualizing data, and running the Blink-to-Speak interface.

## 1. How to Install
Open a terminal in the root `NuroSync` directory and run:
```bash
pip install -r requirements.txt
```

## 2. How to Run
In the same terminal, start the app by running:
```bash
python main.py
```

## 2.1 Desktop Launcher
A ready-to-use desktop launcher is available in the project root as `run_nurosync.bat`.
Copy `run_nurosync.bat` to your Windows desktop and double-click it to launch the app.

If the virtual environment is not created yet, run:
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## 3. Which File to Open
If you need to edit or view the entry point of the app, open `main.py`. The application logic is located inside the `app/` directory.

## 4. Which COM Port to Select
When the app launches, go to the **Settings** tab. The dropdown will automatically list available COM ports. Select the COM port that corresponds to the ESP32-S3 USB connection (usually named "USB Serial Device" or similar in Device Manager). The baud rate is fixed at 115200.

## 5. How to Connect Headband
1. Power on the NuroSync headband.
2. Plug the receiver module (or the headband directly, depending on your setup) into your PC's USB port.
3. In the Python app **Settings** tab, select the correct COM port and click **Connect**.
4. Telemetry and commands will begin streaming in the Dashboard and Live Signals tabs.
