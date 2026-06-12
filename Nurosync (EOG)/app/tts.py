from PySide6.QtCore import QThread, Signal
import pyttsx3
import pythoncom

class TTSWorker(QThread):
    finished_speaking = Signal()

    def __init__(self):
        super().__init__()
        self.text_to_speak = ""

    def speak(self, text):
        if self.isRunning():
            self.terminate()
            self.wait()
        self.text_to_speak = text
        self.start()

    def run(self):
        pythoncom.CoInitialize()
        try:
            engine = pyttsx3.init()
            engine.say(self.text_to_speak)
            engine.runAndWait()
        except Exception:
            try:
                import win32com.client
                speaker = win32com.client.Dispatch("SAPI.SpVoice")
                speaker.Speak(self.text_to_speak)
            except Exception:
                pass
        finally:
            pythoncom.CoUninitialize()
            self.finished_speaking.emit()
