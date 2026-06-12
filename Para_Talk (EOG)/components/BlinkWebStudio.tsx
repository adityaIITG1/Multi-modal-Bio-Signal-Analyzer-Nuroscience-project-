import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Globe, Code, Server, Database, Palette, Type, ChevronLeft, Download, Eye, FileJson, Play 
} from "lucide-react";
import BlinkKeyboard from "./BlinkKeyboard";

type WebState = 
  | "MAIN_MENU"
  | "SELECT_TYPE"
  | "SELECT_FRONTEND"
  | "SELECT_BACKEND"
  | "SELECT_DATABASE"
  | "SELECT_THEME"
  | "TYPE_CUSTOM_PROMPT"
  | "GENERATING"
  | "PREVIEW_RESULT";

type MenuOption = {
  label: string;
  icon?: any;
  action?: () => void;
  nextState?: WebState;
  value?: string;
};

const AUTO_SELECT_MS = 4000;

export default function BlinkWebStudio({ isActive, onExit }: { isActive: boolean, onExit: () => void }) {
  const [webState, setWebState] = useState<WebState>("MAIN_MENU");
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Selections
  const [siteType, setSiteType] = useState("");
  const [frontend, setFrontend] = useState("");
  const [backend, setBackend] = useState("");
  const [database, setDatabase] = useState("");
  const [theme, setTheme] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  
  // Results
  const [generatedCode, setGeneratedCode] = useState<{html: string, serverCode: string, databaseCode: string} | null>(null);

  const intervalRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const speak = (text: string) => {
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    synth.speak(utterance);
  };

  const handleComplete = async () => {
    setWebState("GENERATING");
    setIsGenerating(true);
    speak("Synthesizing Full Stack Architecture. Please wait, this may take a moment.");
    
    try {
      const res = await fetch("/api/groq-web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteType, frontend, backend, database, theme, customPrompt })
      });
      
      if (res.ok) {
        const data = await res.json();
        setGeneratedCode(data);
        setIsGenerating(false);
        setWebState("PREVIEW_RESULT");
        speak("Website generation complete. You can now preview and download.");
      } else {
        console.error("Failed to generate web code");
        speak("Failed to generate web code. Please try again.");
        setIsGenerating(false);
        setWebState("MAIN_MENU");
      }
    } catch (err) {
      console.error(err);
      speak("An error occurred while generating code.");
      setIsGenerating(false);
      setWebState("MAIN_MENU");
    }
  };

  const handleDownloadZip = async () => {
    speak("Packaging source code into ZIP.");
    try {
      const res = await fetch("/api/web-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteType, frontend, backend, database, theme, customPrompt, generatedCode })
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BlinkWeb_${siteType.replace(/\\s+/g, "_")}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      speak("Download complete.");
    } catch (err) {
      console.error(err);
      speak("Error downloading file.");
    }
  };

  const handleScrollPreview = (direction: 'up' | 'down') => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const scrollAmount = direction === 'down' ? 400 : -400;
      iframeRef.current.contentWindow.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      speak(`Scrolled ${direction}`);
    }
  };

  const mainMenuOptions: MenuOption[] = [
    { label: "Create New Website", icon: Globe, nextState: "SELECT_TYPE" },
    { label: "Exit Web Studio", icon: ChevronLeft, action: onExit }
  ];

  const siteTypes = [
    "Static Landing Page", "Dynamic Web App", "E-Commerce Site", "Portfolio", "Blog", "SaaS Dashboard"
  ].map(t => ({ label: t, icon: Globe, value: t, nextState: "SELECT_FRONTEND" as WebState }));

  const frontends = [
    "Vanilla HTML / Tailwind", "React / Next.js", "Vue.js", "Angular"
  ].map(t => ({ label: t, icon: Code, value: t, nextState: "SELECT_BACKEND" as WebState }));

  const backends = [
    "None (Frontend Only)", "Node.js / Express", "Python / Django", "PHP / Laravel", "GoLang Server"
  ].map(t => ({ label: t, icon: Server, value: t, nextState: "SELECT_DATABASE" as WebState }));

  const databases = [
    "None", "PostgreSQL", "MongoDB", "MySQL", "Firebase"
  ].map(t => ({ label: t, icon: Database, value: t, nextState: "SELECT_THEME" as WebState }));

  const themes = [
    "Modern Minimalist", "Dark Mode Tech", "Vibrant Startup", "Elegant Luxury", "Playful / Creative"
  ].map(t => ({ label: t, icon: Palette, value: t, nextState: "TYPE_CUSTOM_PROMPT" as WebState }));

  const resultOptions: MenuOption[] = [
    { label: "Scroll Down Preview", icon: Eye, action: () => handleScrollPreview('down') },
    { label: "Scroll Up Preview", icon: Eye, action: () => handleScrollPreview('up') },
    { label: "Download Source Code (ZIP)", icon: Download, action: handleDownloadZip },
    { label: "Create Another Website", icon: Globe, action: () => {
      setGeneratedCode(null);
      setWebState("MAIN_MENU");
    }},
    { label: "Exit Studio", icon: ChevronLeft, action: onExit }
  ];

  const getCurrentOptions = (): MenuOption[] => {
    switch (webState) {
      case "MAIN_MENU": return mainMenuOptions;
      case "SELECT_TYPE": return [...siteTypes, { label: "Go Back", icon: ChevronLeft, nextState: "MAIN_MENU" }];
      case "SELECT_FRONTEND": return [...frontends, { label: "Go Back", icon: ChevronLeft, nextState: "SELECT_TYPE" }];
      case "SELECT_BACKEND": return [...backends, { label: "Go Back", icon: ChevronLeft, nextState: "SELECT_FRONTEND" }];
      case "SELECT_DATABASE": return [...databases, { label: "Go Back", icon: ChevronLeft, nextState: "SELECT_BACKEND" }];
      case "SELECT_THEME": return [...themes, { label: "Go Back", icon: ChevronLeft, nextState: "SELECT_DATABASE" }];
      case "TYPE_CUSTOM_PROMPT": return [];
      case "PREVIEW_RESULT": return resultOptions;
      default: return [];
    }
  };

  const currentOptions = getCurrentOptions();

  const stopScanner = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setProgress(0);
  };

  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const currentOptionsRef = useRef(currentOptions);
  currentOptionsRef.current = currentOptions;
  const webStateRef = useRef(webState);
  webStateRef.current = webState;

  const startScanner = () => {
    stopScanner();
    const startTime = Date.now();
    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min((elapsed / AUTO_SELECT_MS) * 100, 100);
      setProgress(p);

      if (p >= 100) {
        stopScanner();
        const option = currentOptionsRef.current[activeIndexRef.current];
        if (option) {
          speak(`Selected ${option.label}`);
          if (option.action) {
            option.action();
          } else if (option.nextState) {
            if (option.value) {
              switch (webStateRef.current) {
                case "SELECT_TYPE": setSiteType(option.value); break;
                case "SELECT_FRONTEND": setFrontend(option.value); break;
                case "SELECT_BACKEND": setBackend(option.value); break;
                case "SELECT_DATABASE": setDatabase(option.value); break;
                case "SELECT_THEME": setTheme(option.value); break;
              }
            }
            setWebState(option.nextState);
            setActiveIndex(0);
          }
        }
      }
    }, 50);
  };

  useEffect(() => {
    if (isActive && webState !== "TYPE_CUSTOM_PROMPT" && webState !== "GENERATING") {
      startScanner();
    } else {
      stopScanner();
    }
    return stopScanner;
  }, [isActive, webState, currentOptions.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || !isActive || e.code !== "Space" || webState === "GENERATING" || webState === "TYPE_CUSTOM_PROMPT") return;
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((prev) => {
        const next = (prev + 1) % currentOptionsRef.current.length;
        const opt = currentOptionsRef.current[next];
        if (opt) speak(opt.label);
        return next;
      });
      setProgress(0);
      startScanner();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, webState]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-[#0B1121] z-50 flex overflow-hidden font-sans">
      <div className="w-[450px] bg-[#0f172a] border-r border-slate-800 flex flex-col p-8 shadow-2xl relative z-10">
        <div className="flex items-center gap-4 mb-12">
          <Globe className="w-10 h-10 text-emerald-400" />
          <h2 className="text-3xl font-black tracking-tight text-white">BlinkWeb</h2>
        </div>
        <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-2">
          {webState.replace("_", " ")}
        </div>
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 pb-20">
          {currentOptions.map((opt, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <motion.div
                key={idx}
                animate={{ scale: isSelected ? 1.02 : 1, x: isSelected ? 10 : 0 }}
                className={`relative p-5 rounded-2xl flex items-center gap-4 transition-all overflow-hidden ${
                  isSelected ? "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-[0_0_20px_rgba(16,185,129,0.4)] text-white" : "bg-slate-800/50 text-slate-300 border border-slate-700/50"
                }`}
              >
                {isSelected && (
                  <div className="absolute bottom-0 left-0 h-1.5 bg-white" style={{ width: `${progress}%`, transition: "width 50ms linear" }} />
                )}
                <div className="shrink-0 flex items-center justify-center">
                  {opt.icon ? <opt.icon className="w-7 h-7" /> : <div className="w-7 h-7 rounded-full border-2 border-current opacity-30" />}
                </div>
                <span className="font-bold text-[16px]">{opt.label}</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center bg-gradient-to-br from-[#0B1121] to-[#0f2119] p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          {webState === "MAIN_MENU" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <Code className="w-32 h-32 text-emerald-500 mx-auto mb-8 opacity-80" />
              <h1 className="text-6xl font-black mb-6 tracking-tight text-white">BlinkWeb Studio</h1>
              <p className="text-2xl text-slate-400 max-w-lg mx-auto">Build Full Stack Websites with one blink.</p>
            </motion.div>
          )}

          {webState !== "MAIN_MENU" && webState !== "PREVIEW_RESULT" && !isGenerating && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <Server className="w-6 h-6 text-emerald-400" /> Current Stack Architecture
              </h3>
              <div className="grid grid-cols-2 gap-4 text-white">
                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Site Type</p>
                  <p className="text-lg font-medium">{siteType || "..."}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Frontend</p>
                  <p className="text-lg font-medium">{frontend || "..."}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Backend</p>
                  <p className="text-lg font-medium">{backend || "..."}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Database</p>
                  <p className="text-lg font-medium">{database || "..."}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 col-span-2">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Theme</p>
                  <p className="text-lg font-medium">{theme || "..."}</p>
                </div>
              </div>
            </motion.div>
          )}

          {isGenerating && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-white">
              <div className="w-24 h-24 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-8" />
              <h2 className="text-4xl font-black">Building Full Stack Architecture...</h2>
              <p className="text-slate-400 mt-4 text-lg">Writing HTML, CSS, Servers, and Databases.</p>
            </motion.div>
          )}

          {webState === "PREVIEW_RESULT" && !isGenerating && generatedCode && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full h-full flex flex-col gap-4">
              <div className="flex-1 bg-white rounded-3xl overflow-hidden shadow-2xl relative">
                <iframe 
                  ref={iframeRef}
                  srcDoc={generatedCode.html}
                  className="w-full h-full border-none"
                  title="Live Preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {webState === "TYPE_CUSTOM_PROMPT" && (
        <BlinkKeyboard 
          isActive={true}
          onClose={() => setWebState("SELECT_THEME")}
          onSubmit={(text) => {
            setCustomPrompt(text);
            handleComplete();
          }}
        />
      )}
    </div>
  );
}
