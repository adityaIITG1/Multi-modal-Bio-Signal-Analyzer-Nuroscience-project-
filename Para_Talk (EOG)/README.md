<div align="center">
  <!-- TODO: Drag and drop your Debuggers Squad logo here on GitHub to show the image -->

  # 🧠 ParaTalk: Advanced EOG-Based Communication System
  
  **Empowering paralyzed patients to communicate, play, and connect through simple eye blinks.**
  
  [![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)](https://react.dev/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
  [![Framer Motion](https://img.shields.io/badge/Framer_Motion-purple?style=for-the-badge&logo=framer)](https://www.framer.com/motion/)
  [![Web Serial API](https://img.shields.io/badge/Web_Serial-API-yellow?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
</div>

<br />

> **ParaTalk** is a highly aesthetic, life-changing web application designed specifically for patients suffering from total paralysis or locked-in syndrome. By utilizing **Electrooculography (EOG)** via a BioAmp EXG Pill, patients can control the entire interface using just their eye blinks.

---

## ✨ Features

- 🏥 **Care Mode:** Quickly request water, food, bathroom assistance, or alert caregivers to pain/emergencies.
- 💬 **Normal Talk:** A dynamic phrase board for everyday conversational responses and emotional expression.
- 🎮 **Entertainment Hub:** 8 integrated, single-button spacebar games (like Dino Run and Flappy Bird) fully playable via eye-blinks.
- 🌐 **Multilingual Text-to-Speech:** Native TTS support in multiple Indian languages (English, Hindi, Bengali, Marathi, Tamil, etc.).
- 🔌 **Direct Arduino Integration:** Connect your EOG Arduino directly to the browser via the Web Serial API—no external middleware required!
- ⚡ **Relay Control:** Trigger physical hardware (like calling a caregiver's buzzer) directly from the dashboard.

---

## 📸 Interface Previews

| Care Mode | Normal Talk |
| :---: | :---: |
| *(Image coming soon)* | *(Image coming soon)* |
| **Games Hub** | **Electrode Setup** |
| *(Image coming soon)* | *(Image coming soon)* |

---

## 🛠️ Hardware Setup (BioAmp EXG Pill)

ParaTalk integrates perfectly with the **BioAmp EXG Pill** to read vertical eye movements (blinks). 

**Electrode Placement:**
1. 🔴 **Red (IN-):** Below the right eye.
2. ⚫ **Black (IN+):** Above the right eye.
3. 🟡 **Yellow (REF):** Behind the right ear (Mastoid bone).

Connect your Arduino via USB, click **"Connect EOG Arduino"** in the top navigation bar, and the dashboard will automatically listen for `BLINK` serial commands at `115200` baud.

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/adityaIITG1/ParaTalk_NeuroScience.git
cd ParaTalk_NeuroScience
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. *(Note: For the best experience, use a Chromium-based browser like Chrome or Edge to utilize the Web Serial API).*

---

## 👨‍💻 Built By
Designed and developed with ❤️ by the **Debuggers Squad**.
