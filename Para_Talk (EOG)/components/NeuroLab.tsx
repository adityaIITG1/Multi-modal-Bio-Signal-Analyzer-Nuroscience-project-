"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Heart,
  Eye,
  Zap,
  Cpu,
  Layers,
  Wifi,
  Database,
  Sliders,
  X,
  Play,
  Pause,
  RefreshCw,
  Volume2,
  Lightbulb,
  MessageSquare,
  Network,
  Binary,
  ShieldCheck,
  ChevronLeft
} from "lucide-react";

interface NeuroLabProps {
  onExit: () => void;
}

type RhythmType = "Normal" | "Tachycardia" | "Bradycardia" | "Fibrillation";
type BrainState = "Focus (Beta)" | "Relaxed (Alpha)" | "Meditation (Theta)" | "Deep Sleep (Delta)";

export default function NeuroLab({ onExit }: NeuroLabProps) {
  // Simulator Controls
  const [isPlaying, setIsPlaying] = useState(true);
  const [ecgRhythm, setEcgRhythm] = useState<RhythmType>("Normal");
  const [heartRate, setHeartRate] = useState(72);
  const [emgFlex, setEmgFlex] = useState(25);
  const [brainState, setBrainState] = useState<BrainState>("Focus (Beta)");
  const [activeSignalPath, setActiveSignalPath] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "System Initialized. Awaiting bio-signals...",
    "BLE Gateway: Connected to BioAmp EXG Pill",
    "ESP8266: Wi-Fi stream established at 115200 baud."
  ]);

  // EOG Blink Trigger State
  const [eyeBlinkActive, setEyeBlinkActive] = useState(false);
  const [eyeX, setEyeX] = useState(0);
  const [eyeY, setEyeY] = useState(0);

  // References for Canvas drawing
  const ecgCanvasRef = useRef<HTMLCanvasElement>(null);
  const eogCanvasRef = useRef<HTMLCanvasElement>(null);
  const emgCanvasRef = useRef<HTMLCanvasElement>(null);
  const eegCanvasRef = useRef<HTMLCanvasElement>(null);

  // Simulation parameters updated by sliders
  const simParamsRef = useRef({
    isPlaying: true,
    ecgRhythm: "Normal" as RhythmType,
    heartRate: 72,
    emgFlex: 25,
    brainState: "Focus (Beta)" as BrainState,
    blinkTriggered: false
  });

  // Keep ref synchronized with state to avoid re-binding canvas loop
  useEffect(() => {
    simParamsRef.current = {
      isPlaying,
      ecgRhythm,
      heartRate,
      emgFlex,
      brainState,
      blinkTriggered: simParamsRef.current.blinkTriggered
    };
  }, [isPlaying, ecgRhythm, heartRate, emgFlex, brainState]);

  // Log message helper
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 14)]);
  };

  // Trigger eye blink
  const triggerBlink = () => {
    if (eyeBlinkActive) return;
    setEyeBlinkActive(true);
    simParamsRef.current.blinkTriggered = true;
    addLog("EOG Event: Vertical Blink detected. Amplitude: +380µV");
    
    // Simulate flow animation
    triggerSignalFlow("eog-blink");

    setTimeout(() => {
      setEyeBlinkActive(false);
    }, 180);
  };

  // Signal flow simulation
  const triggerSignalFlow = (type: "eog-blink" | "emg-flex" | "ecg-spike") => {
    if (activeSignalPath) return;
    setActiveSignalPath(type);
    
    if (type === "eog-blink") {
      addLog("MCU Code: Parsing blink impulse -> Command matches: 'Select Next Element'");
      setTimeout(() => {
        addLog("Serial Gateway: Dispatched keystroke 'SPACE' to local interface");
        setTimeout(() => {
          addLog("Llama 3 AI Engine: Formulating Context -> Speech Output triggered");
          setTimeout(() => {
            setActiveSignalPath(null);
            addLog("System Status: Idle. Listening...");
          }, 800);
        }, 800);
      }, 800);
    } else if (type === "emg-flex") {
      addLog("MCU Code: EMG amplitude exceeds threshold (70%)");
      setTimeout(() => {
        addLog("Relay Output: Sending HIGH signal to Pin 12 (ESP8266)");
        setTimeout(() => {
          addLog("Device Controller: Smart Relay switched ON (Appliance Activated)");
          setTimeout(() => {
            setActiveSignalPath(null);
          }, 800);
        }, 800);
      }, 800);
    } else if (type === "ecg-spike") {
      addLog("Diagnostics: Heart Rate spike calculated -> Updating BPM metrics");
      setTimeout(() => {
        addLog("Telemetry: Uploading ECG metrics to medical report storage (PDF)");
        setTimeout(() => {
          setActiveSignalPath(null);
        }, 800);
      }, 800);
    }
  };

  // Trigger high muscle flex
  const flexMuscle = () => {
    setEmgFlex(85);
    addLog("EMG Event: Muscle strength spike detected. Amplitude: 92µV");
    triggerSignalFlow("emg-flex");
    setTimeout(() => {
      setEmgFlex(25);
    }, 1200);
  };

  // Eye movement follower
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 15;
      setEyeX(x);
      setEyeY(y);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Keyboard Space listener for blink
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        triggerBlink();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [eyeBlinkActive]);

  // Main Canvas Animation loop
  useEffect(() => {
    let animationId: number;
    let t = 0;
    
    // Wave draw buffers
    const bufferSize = 400;
    const ecgBuffer = new Array(bufferSize).fill(0);
    const eogVBuffer = new Array(bufferSize).fill(0);
    const eogHBuffer = new Array(bufferSize).fill(0);
    const emgBuffer = new Array(bufferSize).fill(0);
    const eegBuffer = new Array(bufferSize).fill(0);

    const drawLoop = () => {
      t++;
      const params = simParamsRef.current;

      if (params.isPlaying) {
        // --- 1. ECG Signal Calculation ---
        let hrFreq = (params.heartRate / 60) * 60; // frequency base
        let ecgVal = 0;
        let period = Math.floor(3600 / (params.heartRate / 60)); // frames per cycle
        if (period <= 0) period = 50;
        let cycleIdx = t % period;

        if (params.ecgRhythm === "Normal") {
          // P-Q-R-S-T wave model
          if (cycleIdx < 10) ecgVal = 0; // Baseline
          else if (cycleIdx >= 10 && cycleIdx < 18) ecgVal = Math.sin((cycleIdx - 10) * Math.PI / 8) * 0.12; // P wave
          else if (cycleIdx >= 18 && cycleIdx < 22) ecgVal = 0; // PR segment
          else if (cycleIdx >= 22 && cycleIdx < 24) ecgVal = -0.15; // Q wave
          else if (cycleIdx >= 24 && cycleIdx < 28) ecgVal = (cycleIdx - 24) * 0.45; // R rising
          else if (cycleIdx >= 28 && cycleIdx < 32) ecgVal = 1.8 - (cycleIdx - 28) * 0.65; // R falling to S
          else if (cycleIdx >= 32 && cycleIdx < 36) ecgVal = -0.8 + (cycleIdx - 32) * 0.2; // S returning
          else if (cycleIdx >= 36 && cycleIdx < 44) ecgVal = 0; // ST segment
          else if (cycleIdx >= 44 && cycleIdx < 56) ecgVal = Math.sin((cycleIdx - 44) * Math.PI / 12) * 0.35; // T wave
          else ecgVal = (Math.random() - 0.5) * 0.02; // baseline noise
        } else if (params.ecgRhythm === "Tachycardia") {
          period = Math.floor(3600 / 140); // speed up
          let tachyIdx = t % period;
          if (tachyIdx < 4) ecgVal = 0;
          else if (tachyIdx >= 4 && tachyIdx < 8) ecgVal = Math.sin((tachyIdx - 4) * Math.PI / 4) * 0.1;
          else if (tachyIdx >= 8 && tachyIdx < 10) ecgVal = -0.15;
          else if (tachyIdx >= 10 && tachyIdx < 13) ecgVal = (tachyIdx - 10) * 0.55;
          else if (tachyIdx >= 13 && tachyIdx < 17) ecgVal = 1.65 - (tachyIdx - 13) * 0.7;
          else if (tachyIdx >= 17 && tachyIdx < 20) ecgVal = -1.15 + (tachyIdx - 17) * 0.38;
          else if (tachyIdx >= 20 && tachyIdx < 25) ecgVal = Math.sin((tachyIdx - 20) * Math.PI / 5) * 0.35;
          else ecgVal = (Math.random() - 0.5) * 0.02;
        } else if (params.ecgRhythm === "Bradycardia") {
          period = Math.floor(3600 / 45); // slow down
          let bradyIdx = t % period;
          if (bradyIdx < 40) ecgVal = (Math.random() - 0.5) * 0.015; // long baseline
          else if (bradyIdx >= 40 && bradyIdx < 48) ecgVal = Math.sin((bradyIdx - 40) * Math.PI / 8) * 0.12;
          else if (bradyIdx >= 48 && bradyIdx < 52) ecgVal = 0;
          else if (bradyIdx >= 52 && bradyIdx < 54) ecgVal = -0.15;
          else if (bradyIdx >= 54 && bradyIdx < 58) ecgVal = (bradyIdx - 54) * 0.45;
          else if (bradyIdx >= 58 && bradyIdx < 62) ecgVal = 1.8 - (bradyIdx - 58) * 0.65;
          else if (bradyIdx >= 62 && bradyIdx < 66) ecgVal = -0.8 + (bradyIdx - 62) * 0.2;
          else if (bradyIdx >= 66 && bradyIdx < 74) ecgVal = 0;
          else if (bradyIdx >= 74 && bradyIdx < 86) ecgVal = Math.sin((bradyIdx - 74) * Math.PI / 12) * 0.35;
          else ecgVal = (Math.random() - 0.5) * 0.015;
        } else if (params.ecgRhythm === "Fibrillation") {
          // chaotic v-fib
          ecgVal = Math.sin(t * 0.23) * 0.45 + Math.sin(t * 0.47) * 0.3 + (Math.random() - 0.5) * 0.25;
        }

        ecgBuffer.shift();
        ecgBuffer.push(ecgVal);

        // --- 2. EOG Signal Calculation ---
        let eogV = (Math.random() - 0.5) * 0.08;
        let eogH = Math.sin(t * 0.015) * 0.35 + (Math.random() - 0.5) * 0.05;

        if (params.blinkTriggered) {
          eogV = 2.4; // blink peak
          params.blinkTriggered = false; // reset ref trigger
        } else if (Math.random() < 0.005) {
          // Occasional random blink micro-spike
          eogV = 1.2;
        }

        // smooth the blink decay
        const prevV = eogVBuffer[eogVBuffer.length - 1];
        if (prevV > 0.1) {
          eogV = prevV * 0.82; // exponential decay
        }

        eogVBuffer.shift();
        eogVBuffer.push(eogV);
        eogHBuffer.shift();
        eogHBuffer.push(eogH);

        // --- 3. EMG Signal Calculation ---
        // Muscle is high frequency noise proportional to flexing intensity
        const flexRatio = params.emgFlex / 100;
        let emgNoise = (Math.random() - 0.5) * (0.05 + flexRatio * 1.8);
        // Add low frequency envelope baseline
        emgNoise += Math.sin(t * 0.05) * 0.08 * flexRatio;

        emgBuffer.shift();
        emgBuffer.push(emgNoise);

        // --- 4. EEG Signal Calculation ---
        // EEG is combo of delta (1-4Hz), theta (4-8Hz), alpha (8-12Hz), beta (12-30Hz)
        let eegVal = 0;
        if (params.brainState === "Focus (Beta)") {
          // Dominant beta (fast waves) + low amplitude
          eegVal = Math.sin(t * 0.55) * 0.35 + Math.sin(t * 0.85) * 0.25 + (Math.random() - 0.5) * 0.15;
        } else if (params.brainState === "Relaxed (Alpha)") {
          // Dominant alpha (med frequency, smooth)
          eegVal = Math.sin(t * 0.25) * 0.65 + Math.sin(t * 0.48) * 0.2 + (Math.random() - 0.5) * 0.08;
        } else if (params.brainState === "Meditation (Theta)") {
          // Slow theta waves, larger amplitude
          eegVal = Math.sin(t * 0.12) * 0.85 + Math.sin(t * 0.28) * 0.3 + (Math.random() - 0.5) * 0.05;
        } else if (params.brainState === "Deep Sleep (Delta)") {
          // Very slow large delta waves
          eegVal = Math.sin(t * 0.05) * 1.45 + Math.sin(t * 0.11) * 0.4 + (Math.random() - 0.5) * 0.03;
        }

        eegBuffer.shift();
        eegBuffer.push(eegVal);
      }

      // --- Draw Canvases ---
      drawWave(ecgCanvasRef.current, ecgBuffer, "#FF2E63", "ECG Monitor");
      drawTwoChannelWave(eogCanvasRef.current, eogVBuffer, eogHBuffer, "#08D9D6", "#FFDE7D", "EOG Dual-Channel (V/H)");
      drawWave(emgCanvasRef.current, emgBuffer, "#FF9F43", "EMG Raw Signal");
      drawWave(eegCanvasRef.current, eegBuffer, "#A855F7", "EEG Brainwaves");

      animationId = requestAnimationFrame(drawLoop);
    };

    const drawWave = (canvas: HTMLCanvasElement | null, buffer: number[], color: string, label: string) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      
      // Clear canvas with trace tail
      ctx.fillStyle = "rgba(10, 8, 20, 0.9)";
      ctx.fillRect(0, 0, w, h);

      // Grid background
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      const gridSize = 20;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw Center Baseline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Plot Signal Line
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      const step = w / buffer.length;
      for (let i = 0; i < buffer.length; i++) {
        // map value -2.5 to 2.5 to canvas height
        const val = buffer[i];
        const x = i * step;
        const y = h / 2 - (val * (h * 0.38));
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // reset shadow

      // Draw Label
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "bold 11px Outfit, Inter, sans-serif";
      ctx.fillText(label, 15, 20);
    };

    const drawTwoChannelWave = (canvas: HTMLCanvasElement | null, bufV: number[], bufH: number[], colV: string, colH: string, label: string) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "rgba(10, 8, 20, 0.9)";
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      const gridSize = 20;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw baseline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      const step = w / bufV.length;

      // Plot Channel H (Horizontal)
      ctx.strokeStyle = colH;
      ctx.shadowColor = colH;
      ctx.shadowBlur = 4;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < bufH.length; i++) {
        const y = h / 2 - (bufH[i] * (h * 0.35));
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * step, y);
      }
      ctx.stroke();

      // Plot Channel V (Vertical/Blink)
      ctx.strokeStyle = colV;
      ctx.shadowColor = colV;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < bufV.length; i++) {
        const y = h / 2 - (bufV[i] * (h * 0.35));
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * step, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw Labels
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "bold 11px Outfit, Inter, sans-serif";
      ctx.fillText(label, 15, 20);

      // Legend
      ctx.fillStyle = colV;
      ctx.fillRect(w - 110, 12, 8, 8);
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillText("Vert (Blink)", w - 95, 20);

      ctx.fillStyle = colH;
      ctx.fillRect(w - 180, 12, 8, 8);
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillText("Horiz", w - 165, 20);
    };

    animationId = requestAnimationFrame(drawLoop);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans select-none relative overflow-x-hidden">
      
      {/* Background cyber grid and radial gradient glowing spheres */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35 z-0 pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] z-0 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] z-0 pointer-events-none" />

      {/* Header Bar */}
      <header className="w-full shrink-0 z-20 border-b border-white/5 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onExit}
            className="group flex items-center justify-center w-11 h-11 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all shadow-[0_0_15px_rgba(0,0,0,0.4)]"
          >
            <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-white group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-200 to-purple-400">
                NEUROLAB LABORATORY
              </h1>
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">
              Bio-Signal Simulator & Interactive Architecture
            </p>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-white/5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span>EXG Stream Active</span>
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              isPlaying 
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? "PAUSE SIMULATOR" : "RUN SIMULATOR"}
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 w-full grid grid-cols-1 xl:grid-cols-12 gap-6 p-6 z-10 overflow-y-auto">
        
        {/* Left Column: Interactive Lab Monitors (7 Cols) */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          
          {/* Signal Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. ECG Card */}
            <div className="bg-slate-950/60 border border-white/5 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl flex flex-col gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-500 animate-[pulse_1.5s_infinite]" />
                  <span className="font-extrabold text-sm tracking-tight text-slate-200">Electrocardiography (ECG)</span>
                </div>
                <span className="text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full font-bold uppercase">
                  HEART RATE
                </span>
              </div>

              <div className="relative h-[130px] rounded-2xl overflow-hidden border border-white/5">
                <canvas ref={ecgCanvasRef} className="w-full h-full" width={400} height={130} />
              </div>

              {/* Slider & Selectors */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">BPM Frequency: <strong className="text-rose-400 font-bold">{heartRate}</strong></span>
                  <span className="text-slate-500">Normal Range: 60-100</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="160"
                  value={heartRate}
                  onChange={(e) => {
                    setHeartRate(Number(e.target.value));
                    if (ecgRhythm === "Normal") {
                      if (Number(e.target.value) > 100) setEcgRhythm("Tachycardia");
                      else if (Number(e.target.value) < 60) setEcgRhythm("Bradycardia");
                    }
                  }}
                  className="w-full accent-rose-500 bg-slate-900 h-1.5 rounded-lg appearance-none cursor-pointer"
                />

                {/* Rhythm selectors */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {(["Normal", "Tachycardia", "Bradycardia", "Fibrillation"] as RhythmType[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setEcgRhythm(r);
                        if (r === "Tachycardia") setHeartRate(125);
                        else if (r === "Bradycardia") setHeartRate(48);
                        else if (r === "Normal") setHeartRate(72);
                      }}
                      className={`text-[9px] font-black uppercase py-1.5 px-1 rounded-lg border text-center transition-all ${
                        ecgRhythm === r
                          ? "bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                          : "bg-slate-900/50 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                      }`}
                    >
                      {r === "Fibrillation" ? "V-Fib" : r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. EOG Card */}
            <div className="bg-slate-950/60 border border-white/5 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl flex flex-col gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl" />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-cyan-400" />
                  <span className="font-extrabold text-sm tracking-tight text-slate-200">Electrooculography (EOG)</span>
                </div>
                <span className="text-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-bold uppercase">
                  EYE MOVEMENTS
                </span>
              </div>

              <div className="relative h-[130px] rounded-2xl overflow-hidden border border-white/5">
                <canvas ref={eogCanvasRef} className="w-full h-full" width={400} height={130} />
              </div>

              {/* Eye Visualizer & Blink Trigger */}
              <div className="flex items-center gap-4 bg-slate-900/50 border border-white/5 p-3 rounded-2xl">
                {/* SVG Eye */}
                <div className="w-14 h-14 bg-slate-950 border border-white/10 rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  <svg viewBox="0 0 100 100" className="w-full h-full p-1.5">
                    {/* Sclera (White eye background) */}
                    <path
                      d="M 10 50 Q 50 15 90 50 Q 50 85 10 50 Z"
                      fill="#1E293B"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="2"
                    />
                    
                    {/* Pupil/Iris Group (Animates with mouse) */}
                    <AnimatePresence>
                      {!eyeBlinkActive ? (
                        <motion.g
                          style={{
                            x: eyeX,
                            y: eyeY,
                          }}
                        >
                          <circle cx="50" cy="50" r="22" fill="#08D9D6" />
                          <circle cx="50" cy="50" r="16" fill="#0E172A" />
                          <circle cx="45" cy="45" r="4" fill="#FFFFFF" />
                        </motion.g>
                      ) : (
                        // Eyelid closes on blink
                        <path
                          d="M 10 50 Q 50 48 90 50 Z"
                          stroke="#08D9D6"
                          strokeWidth="4"
                          strokeLinecap="round"
                          fill="none"
                        />
                      )}
                    </AnimatePresence>
                  </svg>
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Blink Threshold Switch</span>
                    <span className="text-[10px] text-cyan-400/80 font-bold uppercase tracking-wider">Trigger: SPACE</span>
                  </div>
                  <button
                    onClick={triggerBlink}
                    className={`w-full py-2 px-4 rounded-xl text-xs font-black uppercase transition-all tracking-wider ${
                      eyeBlinkActive
                        ? "bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(8,217,214,0.4)] scale-[0.98]"
                        : "bg-slate-800 border border-cyan-500/30 hover:border-cyan-500/70 text-cyan-300 hover:bg-slate-800/80"
                    }`}
                  >
                    {eyeBlinkActive ? "EYE BLINK DETECTED" : "TRIGGER MANUAL BLINK"}
                  </button>
                </div>
              </div>
            </div>

            {/* 3. EMG Card */}
            <div className="bg-slate-950/60 border border-white/5 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl flex flex-col gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl" />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <span className="font-extrabold text-sm tracking-tight text-slate-200">Electromyography (EMG)</span>
                </div>
                <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase">
                  MUSCLE TENSION
                </span>
              </div>

              <div className="relative h-[130px] rounded-2xl overflow-hidden border border-white/5">
                <canvas ref={emgCanvasRef} className="w-full h-full" width={400} height={130} />
              </div>

              {/* Flex Slider & Muscle strength flex */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Muscle Flex Tension: <strong className="text-amber-400 font-bold">{emgFlex}%</strong></span>
                  <span className={`text-[10px] font-black uppercase ${emgFlex >= 70 ? "text-red-400 animate-pulse" : "text-slate-500"}`}>
                    {emgFlex >= 70 ? "THRESHOLD TRIGGERED (HIGH)" : "BELOW TRIGGER POINT"}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={emgFlex}
                    onChange={(e) => {
                      setEmgFlex(Number(e.target.value));
                      if (Number(e.target.value) >= 70) {
                        triggerSignalFlow("emg-flex");
                      }
                    }}
                    className="flex-1 accent-amber-500 bg-slate-900 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                  <button
                    onClick={flexMuscle}
                    className="py-1.5 px-3 bg-amber-500/15 border border-amber-500/30 hover:border-amber-500 text-amber-400 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all shrink-0"
                  >
                    FLEX ARM
                  </button>
                </div>
              </div>
            </div>

            {/* 4. EEG Card */}
            <div className="bg-slate-950/60 border border-white/5 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl flex flex-col gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl" />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-400" />
                  <span className="font-extrabold text-sm tracking-tight text-slate-200">Electroencephalography (EEG)</span>
                </div>
                <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-bold uppercase">
                  BRAIN WAVES
                </span>
              </div>

              <div className="relative h-[130px] rounded-2xl overflow-hidden border border-white/5">
                <canvas ref={eegCanvasRef} className="w-full h-full" width={400} height={130} />
              </div>

              {/* Mental State dropdown selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Cognitive Mental State</span>
                  <span className="text-slate-500">Dominant Frequency Band</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {(["Focus (Beta)", "Relaxed (Alpha)", "Meditation (Theta)", "Deep Sleep (Delta)"] as BrainState[]).map((state) => {
                    const isSelected = brainState === state;
                    return (
                      <button
                        key={state}
                        onClick={() => {
                          setBrainState(state);
                          addLog(`EEG State: Switched dominant frequency band to ${state}`);
                        }}
                        className={`py-2 px-3 text-[10px] font-bold rounded-xl border text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-purple-500/10 border-purple-500/30 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.15)]"
                            : "bg-slate-900/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                        }`}
                      >
                        <span>{state.split(" ")[0]}</span>
                        <span className="text-[8px] font-black uppercase text-slate-500">{state.split(" ")[1]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* Diagnostic System logs */}
          <div className="bg-slate-950/60 border border-white/5 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Binary className="w-4.5 h-4.5 text-blue-400" />
                <span className="font-extrabold text-xs tracking-tight text-slate-200 uppercase">Gateway Diagnostics Terminal</span>
              </div>
              <button 
                onClick={() => setLogs(["System logs cleared. Listening..."])}
                className="text-[9px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest flex items-center gap-1"
              >
                <RefreshCw className="w-2.5 h-2.5" /> Clear Logs
              </button>
            </div>

            <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-4 font-mono text-[10.5px] leading-relaxed text-blue-300/80 h-[140px] overflow-y-auto flex flex-col gap-1.5 shadow-inner">
              {logs.map((log, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="text-slate-600 shrink-0">❯</span>
                  <span className={log.includes("Event:") ? "text-cyan-400 font-bold" : log.includes("Error:") ? "text-red-400" : ""}>{log}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Premium System Architecture Map (5 Cols) */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          
          {/* Architecture Card */}
          <div className="bg-slate-950/60 border border-white/5 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl flex flex-col gap-6 flex-1 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-indigo-400" />
                <span className="font-extrabold text-sm tracking-tight text-slate-200">Interactive Project Architecture</span>
              </div>
              <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase">
                HACKATHON SCHEMATIC
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              This schematic illustrates the flow of raw biological voltage signals from the patient to our localized cloud processing server, running LLM agents and downstream automation.
            </p>

            {/* Interactive Flow Diagram */}
            <div className="relative border border-white/5 bg-slate-950/70 rounded-2xl p-4 flex-1 min-h-[360px] flex flex-col justify-between overflow-hidden shadow-inner">
              
              {/* Animated Connection Paths SVG Layer */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                {/* Defs for gradients & shadow filters */}
                <defs>
                  <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#08D9D6" />
                    <stop offset="50%" stopColor="#A855F7" />
                    <stop offset="100%" stopColor="#FF9F43" />
                  </linearGradient>
                  
                  {/* Glow shadow filter */}
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Vertical Bus line connecting sensors to MCU */}
                <path d="M 55 50 L 55 130 L 140 130" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                <path d="M 55 130 L 55 210 L 140 210" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />

                {/* EOG Path to MCU */}
                <path d="M 85 50 H 140" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                
                {/* MCU to API Router */}
                <path d="M 220 130 H 260 V 170 H 300" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                
                {/* API Router to Llama Core */}
                <path d="M 380 170 H 420" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                
                {/* Llama Core down to Actuators */}
                <path d="M 460 210 V 260 H 380" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                <path d="M 460 210 V 300 L 260 300" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                <path d="M 460 210 V 330 H 160" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />

                {/* Animated active paths (Dashed and glowing) */}
                {activeSignalPath === "eog-blink" && (
                  <>
                    {/* EOG to MCU */}
                    <path
                      d="M 85 50 H 140"
                      fill="none"
                      stroke="#08D9D6"
                      strokeWidth="3.5"
                      strokeDasharray="8 8"
                      strokeDashoffset="0"
                      className="animate-[dash_8s_linear_infinite]"
                      filter="url(#glow)"
                    />
                    {/* MCU to Local Gateway */}
                    <path
                      d="M 220 130 H 260 V 170 H 300"
                      fill="none"
                      stroke="#08D9D6"
                      strokeWidth="3.5"
                      strokeDasharray="8 8"
                      className="animate-[dash_8s_linear_infinite]"
                      filter="url(#glow)"
                    />
                    {/* Local Gateway to Llama */}
                    <path
                      d="M 380 170 H 420"
                      fill="none"
                      stroke="#08D9D6"
                      strokeWidth="3.5"
                      strokeDasharray="8 8"
                      className="animate-[dash_8s_linear_infinite]"
                      filter="url(#glow)"
                    />
                    {/* Llama to TTS / Speech */}
                    <path
                      d="M 460 210 V 300 L 260 300"
                      fill="none"
                      stroke="#08D9D6"
                      strokeWidth="3.5"
                      strokeDasharray="8 8"
                      className="animate-[dash_8s_linear_infinite]"
                      filter="url(#glow)"
                    />
                  </>
                )}

                {activeSignalPath === "emg-flex" && (
                  <>
                    {/* EMG to MCU */}
                    <path
                      d="M 55 130 L 55 130 H 140"
                      fill="none"
                      stroke="#FF9F43"
                      strokeWidth="3.5"
                      strokeDasharray="8 8"
                      className="animate-[dash_8s_linear_infinite]"
                      filter="url(#glow)"
                    />
                    {/* MCU to local Gateway */}
                    <path
                      d="M 220 130 H 260 V 170 H 300"
                      fill="none"
                      stroke="#FF9F43"
                      strokeWidth="3.5"
                      strokeDasharray="8 8"
                      className="animate-[dash_8s_linear_infinite]"
                      filter="url(#glow)"
                    />
                    {/* Local Gateway to Relays */}
                    <path
                      d="M 460 210 V 260 H 380"
                      fill="none"
                      stroke="#FF9F43"
                      strokeWidth="3.5"
                      strokeDasharray="8 8"
                      className="animate-[dash_8s_linear_infinite]"
                      filter="url(#glow)"
                    />
                  </>
                )}

                {activeSignalPath === "ecg-spike" && (
                  <>
                    {/* ECG to MCU */}
                    <path
                      d="M 55 130 L 55 210 H 140"
                      fill="none"
                      stroke="#FF2E63"
                      strokeWidth="3.5"
                      strokeDasharray="8 8"
                      className="animate-[dash_8s_linear_infinite]"
                      filter="url(#glow)"
                    />
                    {/* MCU to Local Gateway */}
                    <path
                      d="M 220 130 H 260 V 170 H 300"
                      fill="none"
                      stroke="#FF2E63"
                      strokeWidth="3.5"
                      strokeDasharray="8 8"
                      className="animate-[dash_8s_linear_infinite]"
                      filter="url(#glow)"
                    />
                  </>
                )}
              </svg>

              {/* Node Layout Groups (Absolute Positioned Elements) */}
              
              {/* Row 1: Bio-Sensors Group */}
              <div className="flex flex-col gap-4 relative z-10 w-[120px]">
                {/* Node: EOG */}
                <div className="flex items-center gap-2 bg-slate-900 border border-cyan-500/20 p-2 rounded-xl text-left shadow-sm">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30">
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-200">EOG SENSORS</p>
                    <p className="text-[7.5px] text-slate-500 font-bold uppercase leading-none mt-0.5">Eye Blinks</p>
                  </div>
                </div>

                {/* Node: EMG */}
                <div className="flex items-center gap-2 bg-slate-900 border border-amber-500/20 p-2 rounded-xl text-left shadow-sm">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/30">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-200">EMG SENSORS</p>
                    <p className="text-[7.5px] text-slate-500 font-bold uppercase leading-none mt-0.5">Muscle Flex</p>
                  </div>
                </div>

                {/* Node: ECG */}
                <div className="flex items-center gap-2 bg-slate-900 border border-rose-500/20 p-2 rounded-xl text-left shadow-sm">
                  <div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/30">
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-200">ECG SENSORS</p>
                    <p className="text-[7.5px] text-slate-500 font-bold uppercase leading-none mt-0.5">Heart Beat</p>
                  </div>
                </div>
              </div>

              {/* MCU Processing Node */}
              <div className="absolute left-[130px] top-[102px] z-10 w-[95px] text-center bg-slate-900 border border-indigo-500/30 p-2.5 rounded-2xl shadow-lg">
                <Cpu className="w-5 h-5 text-indigo-400 mx-auto mb-1 animate-pulse" />
                <p className="text-[9px] font-black text-slate-100">MCU GATEWAY</p>
                <p className="text-[7px] text-slate-500 font-bold leading-none mt-0.5">ESP8266 / Arduino</p>
              </div>

              {/* Local App/API Gateway Node */}
              <div className="absolute left-[295px] top-[142px] z-10 w-[95px] text-center bg-slate-900 border border-indigo-500/20 p-2.5 rounded-2xl shadow-lg">
                <Database className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
                <p className="text-[9px] font-black text-slate-100">NEXT.JS API</p>
                <p className="text-[7px] text-slate-500 font-bold leading-none mt-0.5">WebSockets/Local</p>
              </div>

              {/* AI Processing Node */}
              <div className="absolute right-[10px] top-[152px] z-10 w-[110px] text-center bg-slate-900 border border-purple-500/30 p-2.5 rounded-2xl shadow-lg">
                <div className="relative">
                  <div className="absolute inset-0 bg-purple-500/10 rounded-full blur-md animate-ping" />
                  <Database className="w-5 h-5 text-purple-400 mx-auto mb-1 relative z-10" />
                </div>
                <p className="text-[9px] font-black text-slate-100">LLAMA 3 CORE</p>
                <p className="text-[7px] text-slate-500 font-bold leading-none mt-0.5">Groq Cloud Gateway</p>
              </div>

              {/* Actuator Endpoints (Right bottom stacked) */}
              <div className="flex flex-col gap-2.5 items-end self-end w-[130px] relative z-10">
                {/* Node: Smart Relay */}
                <div className="flex items-center gap-2 bg-slate-900 border border-amber-500/20 p-1.5 rounded-lg w-full text-right justify-end shadow-sm">
                  <div>
                    <p className="text-[8.5px] font-bold text-slate-200">SMART RELAY</p>
                    <p className="text-[7px] text-slate-500 font-medium leading-none">Home Automation</p>
                  </div>
                  <div className="w-5 h-5 rounded-md bg-amber-500/10 flex items-center justify-center border border-amber-500/30">
                    <Lightbulb className="w-3 h-3 text-amber-400" />
                  </div>
                </div>

                {/* Node: Speech Output */}
                <div className="flex items-center gap-2 bg-slate-900 border border-cyan-500/20 p-1.5 rounded-lg w-full text-right justify-end shadow-sm">
                  <div>
                    <p className="text-[8.5px] font-bold text-slate-200">TTS SPEECH</p>
                    <p className="text-[7px] text-slate-500 font-medium leading-none">Vocal Synthesis</p>
                  </div>
                  <div className="w-5 h-5 rounded-md bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30">
                    <Volume2 className="w-3 h-3 text-cyan-400" />
                  </div>
                </div>

                {/* Node: WhatsApp */}
                <div className="flex items-center gap-2 bg-slate-900 border border-emerald-500/20 p-1.5 rounded-lg w-full text-right justify-end shadow-sm">
                  <div>
                    <p className="text-[8.5px] font-bold text-slate-200">WHATSAPP API</p>
                    <p className="text-[7px] text-slate-500 font-medium leading-none">Emergency Alerts</p>
                  </div>
                  <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
                    <MessageSquare className="w-3 h-3 text-emerald-400" />
                  </div>
                </div>
              </div>

            </div>

            {/* Test Simulation Pulse Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => {
                  triggerBlink();
                  triggerSignalFlow("eog-blink");
                }}
                className="py-2.5 px-2 bg-cyan-500/15 border border-cyan-500/30 hover:border-cyan-500 hover:bg-cyan-500/20 text-cyan-400 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all tracking-wider shadow-sm"
              >
                PULSE EOG BLINK
              </button>
              <button
                onClick={() => {
                  flexMuscle();
                  triggerSignalFlow("emg-flex");
                }}
                className="py-2.5 px-2 bg-amber-500/15 border border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/20 text-amber-400 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all tracking-wider shadow-sm"
              >
                PULSE EMG FLEX
              </button>
              <button
                onClick={() => {
                  setHeartRate(135);
                  triggerSignalFlow("ecg-spike");
                  setTimeout(() => setHeartRate(72), 3000);
                }}
                className="py-2.5 px-2 bg-rose-500/15 border border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/20 text-rose-400 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all tracking-wider shadow-sm"
              >
                PULSE ECG SPIKE
              </button>
            </div>
          </div>
          
        </div>

      </main>

      {/* Embedded SVG keyframe animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dash {
          to {
            stroke-dashoffset: -400;
          }
        }
      `}} />
    </div>
  );
}
