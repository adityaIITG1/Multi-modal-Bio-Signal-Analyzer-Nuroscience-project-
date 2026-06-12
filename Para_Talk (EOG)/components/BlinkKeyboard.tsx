import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BlinkKeyboardProps {
  isActive: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
  title?: string;
}

const CHARS = [
  "A", "B", "C", "D", "E",
  "F", "G", "H", "I", "J",
  "K", "L", "M", "N", "O",
  "P", "Q", "R", "S", "T",
  "U", "V", "W", "X", "Y", "Z",
  "SPACE", "PASTE", "DELETE", "SUBMIT", "CLOSE"
];

const AUTO_SELECT_MS = 4000;

export default function BlinkKeyboard({ isActive, onClose, onSubmit, title }: BlinkKeyboardProps) {
  const [typedText, setTypedText] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const activeIndexRef = useRef(activeIndex);
  const typedTextRef = useRef(typedText);
  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    typedTextRef.current = typedText;
  }, [activeIndex, typedText]);

  useEffect(() => {
    if (!isActive) return;

    const scheduleSelect = (index: number) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);

      setProgress(0);
      const startTime = Date.now();

      intervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        setProgress(Math.min((elapsed / AUTO_SELECT_MS) * 100, 100));
      }, 50);

      timerRef.current = window.setTimeout(async () => {
        const char = CHARS[index];
        if (char === "SPACE") setTypedText((prev) => prev + " ");
        else if (char === "PASTE") {
          try {
            const text = await navigator.clipboard.readText();
            setTypedText((prev) => prev + text);
          } catch (err) {
            console.error("Failed to read clipboard:", err);
          }
        }
        else if (char === "DELETE") setTypedText((prev) => prev.slice(0, -1));
        else if (char === "SUBMIT") {
          if (typedTextRef.current.trim().length > 0) {
            onSubmit(typedTextRef.current);
            setTypedText("");
          }
        }
        else if (char === "CLOSE") onClose();
        else setTypedText((prev) => prev + char);

        // Reset to beginning after selection
        setActiveIndex(0);
        scheduleSelect(0);
      }, AUTO_SELECT_MS);
    };

    const moveNext = () => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % CHARS.length;
        scheduleSelect(next);
        return next;
      });
    };

    scheduleSelect(0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        moveNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [isActive, onClose, onSubmit]);

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-8 font-sans"
      >
        <div className="w-full max-w-4xl flex flex-col items-center">
          <h2 className="text-white text-2xl font-bold mb-4 flex items-center gap-2 text-center">
            <span className="text-emerald-400">{title || "Custom Query"}</span>
          </h2>
          
          <div className="w-full bg-slate-800/80 border border-slate-700 p-6 rounded-2xl mb-8 min-h-[120px] flex items-center shadow-xl">
            <p className="text-4xl text-white font-mono tracking-wider break-all">
              {typedText}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-4 h-8 bg-blue-500 ml-1 translate-y-1"
              />
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 w-full max-w-3xl">
            {CHARS.map((char, index) => {
              const isActiveChar = activeIndex === index;

              return (
                <div
                  key={index}
                  className={`
                    relative flex items-center justify-center px-6 py-4 rounded-xl font-bold text-2xl transition-all duration-300 overflow-hidden
                    ${isActiveChar 
                      ? "bg-slate-700 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] scale-110 border-blue-500 border" 
                      : "bg-slate-800 text-slate-400 border border-transparent"
                    }
                    ${char.length > 1 ? "text-sm tracking-widest uppercase px-4" : "w-[60px] h-[60px]"}
                  `}
                >
                  <span className="z-10 relative">{char}</span>
                  {isActiveChar && (
                    <div 
                      className="absolute bottom-0 left-0 h-1 bg-blue-400 transition-all duration-75"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
