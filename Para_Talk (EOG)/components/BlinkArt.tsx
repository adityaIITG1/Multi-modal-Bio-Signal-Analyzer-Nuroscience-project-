"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, Settings, Paintbrush, ImageIcon, Download, Terminal, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type MenuOption = {
  label: string;
  icon?: React.ElementType;
  action?: () => void;
  nextState?: string;
  value?: string;
};

type BlinkArtProps = {
  isActive: boolean;
  onExit: () => void;
};

const AUTO_SELECT_MS = 3500;

export default function BlinkArt({ isActive, onExit }: BlinkArtProps) {
  const [artState, setArtState] = useState<string>("MAIN_MENU");
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const [promptSubject, setPromptSubject] = useState<string>("");
  const [promptStyle, setPromptStyle] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string>("");

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const handleKeyboardInput = (char: string) => {
    let input: HTMLInputElement | HTMLTextAreaElement | null = null;
    let btn: HTMLButtonElement | null = null;
    
    const previewContainer = document.getElementById("blinkart-keyboard-container");
    if (previewContainer) {
      input = previewContainer.querySelector("input, textarea") as HTMLInputElement | HTMLTextAreaElement | null;
      btn = previewContainer.querySelector("button");
    }

    if (char === "ENTER") {
      if (btn) btn.click();
      return;
    }

    if (input) {
      if (char === "BACKSPACE") {
        input.value = input.value.slice(0, -1);
      } else {
        input.value += char;
      }
      input.setAttribute('value', input.value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const virtualKeyboardOptions: MenuOption[] = [
    ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map(char => ({
      label: char,
      action: () => handleKeyboardInput(char)
    })),
    ...Array.from({ length: 10 }, (_, i) => i.toString()).map(char => ({
      label: char,
      action: () => handleKeyboardInput(char)
    })),
    { label: "Space", action: () => handleKeyboardInput(" ") },
    { label: "Backspace", action: () => handleKeyboardInput("BACKSPACE") },
    { label: "Enter / Submit", icon: Play, action: () => handleKeyboardInput("ENTER") },
    { label: "Cancel", icon: Settings, action: () => setArtState("MAIN_MENU") }
  ];

  const generateArt = async (finalPromptText: string) => {
    setArtState("GENERATING");
    setGenerationError(null);
    setImageUrl(null);
    
    // DiceBear uses styles like "bottts", "micah", etc. 
    // We will extract the style from the finalPromptText or default to bottts
    let selectedStyle = "bottts";
    const possibleStyles = ["adventurer", "bottts", "micah", "pixel-art", "shapes"];
    for (const s of possibleStyles) {
      if (finalPromptText.includes(s)) {
        selectedStyle = s;
        break;
      }
    }

    const seed = encodeURIComponent(finalPromptText);
    const url = `https://api.dicebear.com/7.x/${selectedStyle}/svg?seed=${seed}&size=512`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("DiceBear API Failed");
      const blob = await response.blob();
      setImageUrl(URL.createObjectURL(blob));
      setArtState("VIEW_ART");
      setActiveIndex(0);
    } catch (err) {
      setGenerationError("Failed to generate vector art. Please check your connection.");
      setArtState("VIEW_ART");
      setActiveIndex(0);
    }
  };

  const handleCustomSubmit = () => {
    const input = document.querySelector("#blinkart-keyboard-container input") as HTMLInputElement;
    if (input && input.value) {
      setCustomPrompt(input.value);
      generateArt(input.value);
    }
  };

  const getCurrentOptions = (): MenuOption[] => {
    switch (artState) {
      case "MAIN_MENU": return [
        { label: "Create Built-in Art", icon: Paintbrush, nextState: "SELECT_SUBJECT" },
        { label: "Custom Prompt (Keyboard)", icon: Terminal, nextState: "VIRTUAL_KEYBOARD" },
        { label: "Exit BlinkArt", icon: Settings, action: onExit }
      ];
      case "SELECT_SUBJECT": return [
        { label: "A Brave Hero", value: "Hero" },
        { label: "A Cute Robot", value: "Robot" },
        { label: "A Magical Creature", value: "Creature" },
        { label: "An Anime Protagonist", value: "Protagonist" },
        { label: "Abstract Geometry", value: "Geometry" },
        { label: "Go Back", icon: Settings, nextState: "MAIN_MENU" }
      ];
      case "SELECT_STYLE": return [
        { label: "Fantasy Adventurer", value: "adventurer" },
        { label: "Sci-Fi Cyber Bot", value: "bottts" },
        { label: "Anime / Manga Style", value: "micah" },
        { label: "Retro Pixel Art", value: "pixel-art" },
        { label: "Abstract Shapes", value: "shapes" },
        { label: "Go Back", icon: Settings, nextState: "SELECT_SUBJECT" }
      ];
      case "VIRTUAL_KEYBOARD": return virtualKeyboardOptions;
      case "VIEW_ART": return [
        { label: "Create New Vector", icon: Paintbrush, action: () => { setImageUrl(null); setArtState("MAIN_MENU"); } },
        { label: "Save Image (SVG)", icon: Download, action: () => {
          if (imageUrl) {
            const a = document.createElement('a');
            a.href = imageUrl;
            a.download = `BlinkArt_${Date.now()}.svg`;
            a.target = "_blank";
            a.click();
          }
        }},
        { label: "Exit BlinkArt", icon: Settings, action: onExit }
      ];
      default: return [];
    }
  };

  const currentOptions = getCurrentOptions();

  const activateOption = useCallback(
    (index: number) => {
      const option = currentOptions[index];
      if (!option) return;
      
      if (option.action) {
        option.action();
        window.setTimeout(() => setProgress(0), 100);
        return;
      }

      if (option.nextState) {
        setArtState(option.nextState);
        setActiveIndex(0);
        return;
      }

      if (option.value !== undefined) {
        if (artState === "SELECT_SUBJECT") {
          setPromptSubject(option.value);
          setArtState("SELECT_STYLE");
          setActiveIndex(0);
        } else if (artState === "SELECT_STYLE") {
          setPromptStyle(option.value);
          const finalPrompt = `${promptSubject}. ${option.value}`;
          generateArt(finalPrompt);
        }
      }
    },
    [artState, currentOptions, promptSubject]
  );

  const latestActivateOption = useRef(activateOption);
  useEffect(() => {
    latestActivateOption.current = activateOption;
  }, [activateOption]);

  const scheduleSelect = useCallback(
    (index: number) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      
      setProgress(0);
      let startTime = Date.now();
      
      intervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const p = Math.min((elapsed / AUTO_SELECT_MS) * 100, 100);
        setProgress(p);
      }, 50);

      timerRef.current = window.setTimeout(() => latestActivateOption.current(index), AUTO_SELECT_MS);
    },
    []
  );

  const moveNext = useCallback(() => {
    setActiveIndex((current) => {
      const next = (current + 1) % currentOptions.length;
      return next;
    });
  }, [currentOptions.length]);

  useEffect(() => {
    if (artState === "GENERATING" || !isActive) return;
    scheduleSelect(activeIndex);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [activeIndex, scheduleSelect, artState, isActive]);

  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        moveNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, moveNext]);

  return (
    <div className="flex flex-col md:flex-row h-full max-h-[85vh] gap-4 md:gap-6 bg-slate-50/50 p-2 md:p-6 rounded-[32px]">
      <div className="flex-1 bg-white border border-slate-200 rounded-[24px] shadow-sm flex flex-col overflow-hidden relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/50 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-amber-400"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
            </div>
            <div className="h-4 w-[1px] bg-slate-200 ml-2"></div>
            <span className="font-mono text-[11px] font-bold text-slate-400 tracking-wider ml-2">BlinkArt - Canvas</span>
          </div>
        </div>

        <div className="flex-1 bg-slate-50/50 p-4 relative overflow-hidden flex flex-col items-center justify-center">
          {artState === "VIEW_ART" && (
            <div className="flex flex-col items-center justify-center w-full h-full">
              {generationError ? (
                <div className="text-center p-8 bg-red-50 text-red-600 rounded-2xl border-2 border-red-200">
                  <div className="text-4xl mb-4">⚠️</div>
                  <h3 className="font-bold text-xl mb-2">Generation Failed</h3>
                  <p>{generationError}</p>
                </div>
              ) : imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt="Generated Art" 
                  className="max-w-full max-h-full object-contain rounded-xl shadow-lg border-4 border-white"
                />
              ) : null}
            </div>
          )}

          {artState === "GENERATING" && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 absolute inset-0 z-10 bg-slate-50/50 backdrop-blur-sm">
              <motion.div animate={{ rotate: 360, scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="mb-6 relative">
                <div className="absolute inset-0 bg-blue-400 rounded-full blur-xl opacity-20"></div>
                <Paintbrush className="w-12 h-12 text-blue-500 opacity-50" />
              </motion.div>
              <div className="text-lg font-medium animate-pulse">Painting your imagination...</div>
            </div>
          )}

          {artState === "VIRTUAL_KEYBOARD" ? (
            <div id="blinkart-keyboard-container" className="flex flex-col items-center justify-center w-full max-w-lg mx-auto gap-4">
              <h3 className="text-xl font-bold text-slate-700">Enter your art prompt:</h3>
              <input 
                type="text" 
                placeholder="Type here..." 
                className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 text-lg shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
                defaultValue={customPrompt}
              />
              <button onClick={handleCustomSubmit} className="hidden">Submit</button>
            </div>
          ) : !imageUrl && artState !== "GENERATING" && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
              <p>Welcome to BlinkArt.</p>
              <p>Select options on the right using your Blink/Spacebar.</p>
            </div>
          )}
        </div>
      </div>

      <div className="w-1/3 min-w-[320px] max-w-[400px] bg-white border border-slate-200 rounded-[24px] shadow-sm flex flex-col p-4 shrink-0 overflow-hidden">
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-800 mb-1">
            {artState === "MAIN_MENU" && "BlinkArt Control"}
            {artState === "SELECT_SUBJECT" && "Choose Subject"}
            {artState === "SELECT_STYLE" && "Choose Style"}
            {artState === "VIRTUAL_KEYBOARD" && "Type Prompt"}
            {artState === "VIEW_ART" && "Art Result"}
          </h2>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Spacebar / Blink to Navigate
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 pb-4 hide-scrollbar">
          <div className={`grid ${artState === 'VIRTUAL_KEYBOARD' ? 'grid-cols-4 gap-1' : 'grid-cols-2 gap-2'} content-start`}>
            {artState !== "GENERATING" && currentOptions.map((opt, idx) => {
              const isActiveOption = idx === activeIndex;
              const Icon = opt.icon || ImageIcon;
              return (
                <div 
                  key={idx}
                  id={`art-option-${idx}`}
                  className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all text-center gap-2 overflow-hidden ${
                    isActiveOption 
                      ? 'border-blue-500 bg-white shadow-md transform scale-[1.02]' 
                      : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                  }`}
                  style={{ minHeight: artState === 'VIRTUAL_KEYBOARD' ? '60px' : '100px' }}
                >
                  {/* Progress background */}
                  {isActiveOption && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-blue-100/60 transition-all duration-75 ease-linear z-0"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                  
                  {artState !== 'VIRTUAL_KEYBOARD' && (
                    <div className={`relative z-10 p-2 rounded-xl transition-colors ${isActiveOption ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon className="w-5 h-5" strokeWidth={isActiveOption ? 2.5 : 2} />
                    </div>
                  )}
                  
                  <span className={`relative z-10 text-[12px] md:text-[13px] font-bold leading-tight transition-colors ${isActiveOption ? 'text-blue-700' : 'text-slate-600'}`}>
                    {opt.label}
                  </span>
                  
                  {isActiveOption && (
                    <motion.div 
                      layoutId="artActiveRing"
                      className="absolute inset-0 border-2 border-blue-500 rounded-xl z-20 pointer-events-none"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
