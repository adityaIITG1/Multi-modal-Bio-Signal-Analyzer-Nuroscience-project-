import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Palette, 
  Settings, 
  Image as ImageIcon,
  Type,
  Layout,
  Briefcase,
  Download,
  Share2,
  ChevronLeft,
  CheckCircle2,
  Play,
  Sparkles
} from "lucide-react";
import BlinkKeyboard from "./BlinkKeyboard";

import { generateStaticSvg, LayoutTemplateType } from "./SvgTemplateEngine";

type DesignState = 
  | "MAIN_MENU"
  | "SELECT_MODE"
  | "SELECT_TYPE"
  | "SELECT_LAYOUT"
  | "SELECT_INDUSTRY"
  | "SELECT_STYLE"
  | "SELECT_SIZE"
  | "SELECT_TEXT"
  | "SELECT_COLOR"
  | "SELECT_FONT"
  | "SELECT_EFFECT"
  | "SELECT_TEXTURE"
  | "TYPE_CUSTOM_TEXT"
  | "GENERATING"
  | "PREVIEW_RESULT";

type MenuOption = {
  label: string;
  icon?: any;
  action?: () => void;
  nextState?: DesignState;
  value?: string;
};

const AUTO_SELECT_MS = 4000;

export default function BlinkDesignStudio({ isActive, onExit }: { isActive: boolean, onExit: () => void }) {
  const [designState, setDesignState] = useState<DesignState>("MAIN_MENU");
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Selected Options
  const [designType, setDesignType] = useState<string>("");
  const [layoutTemplate, setLayoutTemplate] = useState<LayoutTemplateType | string>("Modern Split");
  const [industry, setIndustry] = useState<string>("");
  const [designStyle, setDesignStyle] = useState<string>("");
  const [designSize, setDesignSize] = useState<string>("");
  const [textStyle, setTextStyle] = useState<string>("");
  const [colorTheme, setColorTheme] = useState<string>("");
  const [customText, setCustomText] = useState<string>("");
  const [font, setFont] = useState<string>("");
  const [effect, setEffect] = useState<string>("");
  const [texture, setTexture] = useState<string>("");
  const [generationMode, setGenerationMode] = useState<"STATIC" | "AI" | "PRO">("STATIC");
  const [aiSvgResult, setAiSvgResult] = useState<string>("");
  const [estimatedPrice, setEstimatedPrice] = useState<string>("Evaluating...");

  const intervalRef = useRef<number | null>(null);

  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const speak = (text: string) => {
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    synth.speak(utterance);
  };

  const handleComplete = async () => {
    setDesignState("GENERATING");
    setIsGenerating(true);
    speak(generationMode === "STATIC" ? "Generating your static design structure." : "Generating your advanced AI Canva layout.");
    
    if (generationMode === "AI" || generationMode === "PRO") {
      let finalSvg = "";
      try {
        const res = await fetch("/api/groq-design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            designType, industry, designStyle, colorTheme, customText,
            font, effect, texture, generationMode
          })
        });
        if (res.ok) {
          finalSvg = await res.text();
          setAiSvgResult(finalSvg);
        } else {
          console.error("Failed to generate AI SVG");
        }
      } catch (err) {
        console.error(err);
      }
      
      // Request Pricing
      try {
        const priceRes = await fetch("/api/groq-pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ designType, finalSvg, generationMode })
        });
        if (priceRes.ok) {
          const { price } = await priceRes.json();
          setEstimatedPrice(price);
        } else {
          setEstimatedPrice("₹1,500 / $20");
        }
      } catch (err) {
        setEstimatedPrice("₹1,500 / $20");
      }

      setIsGenerating(false);
      setDesignState("PREVIEW_RESULT");
      speak(`Design ready. Estimated value is ${estimatedPrice}. You can now download it.`);
    } else {
      setTimeout(() => {
        setIsGenerating(false);
        setEstimatedPrice("₹500 / $5");
        setDesignState("PREVIEW_RESULT");
        speak("Design ready. You can now download or sell this design.");
      }, 4000);
    }
  };

  const mainMenuOptions: MenuOption[] = [
    { label: "Create New Design", icon: Palette, nextState: "SELECT_MODE" },
    { label: "Exit Studio", icon: ChevronLeft, action: onExit }
  ];

  const modeOptions = [
    { label: "Quick AI Mode", icon: Palette, value: "AI", nextState: "SELECT_TYPE" as DesignState },
    { label: "Advanced Pro Editor", icon: Palette, value: "PRO", nextState: "SELECT_TYPE" as DesignState },
    { label: "Static Templates", icon: Palette, value: "STATIC", nextState: "SELECT_TYPE" as DesignState },
    { label: "Go Back", icon: ChevronLeft, nextState: "MAIN_MENU" as DesignState }
  ];

  const designTypes = [
    "YouTube Thumbnail", "A4 Pamphlet", "Social Media Post", "Logo", 
    "Business Card", "Brochure", "Brand Kit"
  ].map(t => ({ label: t, icon: ImageIcon, value: t, nextState: "SELECT_LAYOUT" as DesignState }));

  const layoutOptions = [
    "Modern Split", "Centered Hero", "Diagonal Cut", "Minimalist Grid", 
    "Circular Focus", "Floating Cards", "Geometric Tech", 
    "Organic Blobs", "Neon Cyberpunk", "Elegant Luxury"
  ].map(t => ({ label: t, icon: Layout, value: t, nextState: "SELECT_INDUSTRY" as DesignState }));

  const industries = [
    "AI / Tech", "Healthcare", "Education", "YouTube Creator", 
    "Startup", "Restaurant", "Real Estate", "Personal Brand"
  ].map(t => ({ label: t, icon: Briefcase, value: t, nextState: "SELECT_STYLE" as DesignState }));

  const styles = [
    "Premium Dark", "Glassmorphism", "Minimal White", "Luxury Gold", 
    "Bold Viral", "Modern Gradient"
  ].map(t => ({ label: t, icon: Palette, value: t, nextState: "SELECT_SIZE" as DesignState }));

  const sizes = [
    "1280x720 (Thumbnail)", "1080x1080 (Square)", "1080x1920 (Story)", 
    "A4 Portrait", "Business Card"
  ].map(t => ({ label: t, icon: Layout, value: t, nextState: "SELECT_TEXT" as DesignState }));

  const textStyles = [
    "Big Bold Title", "Minimal Text", "Hinglish Text", "Shock / Viral Text", 
    "Call-to-Action Focused"
  ].map(t => ({ label: t, icon: Type, value: t, nextState: "SELECT_COLOR" as DesignState }));

  const colorThemes = [
    "Red + Blue", "Black + Gold", "Purple + Neon", "Dark + Cyan", 
    "Custom AI Suggested"
  ].map(t => ({ label: t, icon: Palette, value: t, nextState: (generationMode === "PRO" ? "SELECT_FONT" : "TYPE_CUSTOM_TEXT") as DesignState }));

  const fonts = [
    "Inter / Roboto", "Playfair Display", "Bebas Neue", "Montserrat", "Comic Sans (Meme)"
  ].map(t => ({ label: t, icon: Type, value: t, nextState: "SELECT_EFFECT" as DesignState }));

  const effects = [
    "None", "Drop Shadow", "Neon Glow", "3D Text Extrusion", "Cyberpunk Glitch"
  ].map(t => ({ label: t, icon: Sparkles, value: t, nextState: "SELECT_TEXTURE" as DesignState }));

  const textures = [
    "Clean Background", "Noise / Grain", "Grid Lines", "Polka Dots"
  ].map(t => ({ label: t, icon: ImageIcon, value: t, nextState: "TYPE_CUSTOM_TEXT" as DesignState }));

  const resultOptions: MenuOption[] = [
    { label: "Download Complete Package (ZIP)", icon: Download, action: () => handleDownload("zip") },
    { label: "Download as PNG", icon: Download, action: () => handleDownloadImage("png") },
    { label: "Download as JPG", icon: Download, action: () => handleDownloadImage("jpg") },
    { label: "Create Another Design", icon: Palette, action: () => {
      setDesignType("");
      setIndustry("");
      setDesignStyle("");
      setDesignSize("");
      setTextStyle("");
      setColorTheme("");
      setCustomText("");
      setDesignState("MAIN_MENU");
    }},
    { label: "Exit Studio", icon: ChevronLeft, action: onExit }
  ];

  const getCurrentOptions = (): MenuOption[] => {
    switch (designState) {
      case "MAIN_MENU": return mainMenuOptions;
      case "SELECT_MODE": return modeOptions;
      case "SELECT_TYPE": return [...designTypes, { label: "Go Back", icon: ChevronLeft, nextState: "SELECT_MODE" }];
      case "SELECT_LAYOUT": return [...layoutOptions, { label: "Go Back", icon: ChevronLeft, nextState: "SELECT_TYPE" }];
      case "SELECT_INDUSTRY": return [...industries, { label: "Go Back", icon: ChevronLeft, nextState: "SELECT_LAYOUT" }];
      case "SELECT_STYLE": return [...styles, { label: "Go Back", icon: ChevronLeft, nextState: "SELECT_INDUSTRY" }];
      case "SELECT_SIZE": return [...sizes, { label: "Go Back", icon: ChevronLeft, nextState: "SELECT_STYLE" }];
      case "SELECT_TEXT": return [...textStyles, { label: "Go Back", icon: ChevronLeft, nextState: "SELECT_SIZE" }];
      case "SELECT_COLOR": return [...colorThemes, { label: "Go Back", icon: ChevronLeft, nextState: "SELECT_TEXT" }];
      case "SELECT_FONT": return [...fonts, { label: "Go Back", icon: ChevronLeft, nextState: "SELECT_COLOR" }];
      case "SELECT_EFFECT": return [...effects, { label: "Go Back", icon: ChevronLeft, nextState: "SELECT_FONT" }];
      case "SELECT_TEXTURE": return [...textures, { label: "Go Back", icon: ChevronLeft, nextState: "SELECT_EFFECT" }];
      case "TYPE_CUSTOM_TEXT": return [];
      case "PREVIEW_RESULT": return resultOptions;
      default: return [];
    }
  };

  const currentOptions = getCurrentOptions();

  const renderWrappedText = (text: string, x: number, y: number, maxChars: number = 22) => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    words.forEach(w => {
      if ((currentLine + w).length > maxChars) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = w + ' ';
      } else {
        currentLine += w + ' ';
      }
    });
    if (currentLine.trim()) lines.push(currentLine.trim());

    return (
      <text x={x} y={y} fill="#FFF" fontSize={lines.length > 2 ? "36" : "48"} fontFamily="sans-serif" fontWeight="black">
        {lines.map((line, i) => (
          <tspan x={x} dy={i === 0 ? 0 : (lines.length > 2 ? 40 : 55)} key={i}>{line}</tspan>
        ))}
      </text>
    );
  };

  const getDimensions = () => {
    switch(designType) {
      case "Logo": return { w: 500, h: 500 };
      case "Business Card": return { w: 1050, h: 600 };
      case "A4 Pamphlet": 
      case "Brochure": return { w: 800, h: 1131 };
      case "Social Media Post": return { w: 1080, h: 1080 };
      case "YouTube Thumbnail":
      default: return { w: 1280, h: 720 };
    }
  };

  const handleDownloadImage = (format: 'png' | 'jpg') => {
    const { w, h } = getDimensions();
    speak(`Downloading as ${format.toUpperCase()}`);
    const svgElement = document.querySelector('.drop-shadow-2xl');
    if (!svgElement) {
      speak("Error finding image.");
      return;
    }
    const xml = new XMLSerializer().serializeToString(svgElement);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const image64 = 'data:image/svg+xml;base64,' + svg64;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (format === 'jpg') {
          ctx.fillStyle = '#1E1B4B'; // default background if transparent
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        const url = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BlinkDesign_${designType.replace(/\s+/g, "_")}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        speak("Download complete.");
      }
    };
    img.src = image64;
  };

  const handleDownload = async (type: string) => {
    speak("Preparing your download package.");
    try {
      const res = await fetch("/api/design-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designType, layoutTemplate, industry, designStyle, designSize, textStyle, colorTheme, customText, aiSvgResult
        })
      });

      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BlinkDesign_${designType.replace(/\s+/g, "_")}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      speak("Download started.");
    } catch (err) {
      console.error(err);
      speak("Error downloading file.");
    }
  };

  const stopScanner = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setProgress(0);
  };

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
          if (option.action) {
            option.action();
          } else if (option.nextState) {
            if (option.value) {
              switch (designStateRef.current) {
                case "SELECT_MODE": setGenerationMode(option.value as any); break;
                case "SELECT_TYPE": setDesignType(option.value); break;
                case "SELECT_LAYOUT": setLayoutTemplate(option.value as LayoutTemplateType); break;
                case "SELECT_INDUSTRY": setIndustry(option.value); break;
                case "SELECT_STYLE": setDesignStyle(option.value); break;
                case "SELECT_SIZE": setDesignSize(option.value); break;
                case "SELECT_TEXT": setTextStyle(option.value); break;
                case "SELECT_COLOR": setColorTheme(option.value); break;
                case "SELECT_FONT": setFont(option.value); break;
                case "SELECT_EFFECT": setEffect(option.value); break;
                case "SELECT_TEXTURE": setTexture(option.value); break;
              }
            }
            setDesignState(option.nextState);
            setActiveIndex(0);
          }
        }
      }
    }, 50);
  };

  useEffect(() => {
    if (isActive && designState !== "GENERATING" && designState !== "TYPE_CUSTOM_TEXT") {
      startScanner();
    } else {
      stopScanner();
    }
    return stopScanner;
  }, [isActive, designState, currentOptions.length]);

  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const currentOptionsRef = useRef(currentOptions);
  currentOptionsRef.current = currentOptions;
  const designStateRef = useRef(designState);
  designStateRef.current = designState;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || !isActive || e.code !== "Space" || designState === "GENERATING" || designState === "TYPE_CUSTOM_TEXT") return;
      e.preventDefault();
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
  }, [isActive, designState]);

  useEffect(() => {
    const el = document.getElementById(`design-opt-${activeIndex}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIndex]);

  // Initial greeting
  useEffect(() => {
    if (isActive && designState === "MAIN_MENU") {
      speak("BlinkDesign Studio. Create stunning designs with one blink. Option 1: Create New Design.");
    }
  }, [isActive, designState]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-50 bg-[#0B1121] flex overflow-hidden font-sans rounded-[32px] text-white">
      {designState === "TYPE_CUSTOM_TEXT" && (
        <BlinkKeyboard 
          isActive={true} 
          onClose={() => setDesignState("SELECT_COLOR")} 
          onSubmit={(txt) => {
            setCustomText(txt);
            handleComplete();
          }} 
        />
      )}
      {/* Left Panel - Options */}
      <div className="w-[400px] flex-shrink-0 flex flex-col bg-slate-900/80 p-6 border-r border-slate-800 shadow-2xl z-10 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
            <Palette className="w-8 h-8 text-pink-500" />
            BlinkDesign
          </h2>
          <p className="text-slate-400 mt-2 text-sm uppercase tracking-wider font-bold">
            {designState.replace("_", " ")}
          </p>
        </div>

        <div className="flex flex-col gap-3 pb-8">
          {currentOptions.map((opt, idx) => {
            const isSelected = activeIndex === idx;
            return (
              <motion.div
                key={opt.label}
                id={`design-opt-${idx}`}
                animate={{
                  scale: isSelected ? 1.02 : 1,
                  x: isSelected ? 10 : 0
                }}
                className={`relative p-5 rounded-2xl flex items-center gap-4 transition-all overflow-hidden ${
                  isSelected 
                    ? "bg-gradient-to-r from-pink-600 to-purple-600 shadow-[0_0_20px_rgba(236,72,153,0.4)] text-white" 
                    : "bg-slate-800/50 text-slate-300 border border-slate-700/50"
                }`}
              >
                {isSelected && (
                  <div 
                    className="absolute bottom-0 left-0 h-1.5 bg-white" 
                    style={{ width: `${progress}%`, transition: "width 50ms linear" }} 
                  />
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

      {/* Right Panel - Preview & Brief */}
      <div className="flex-1 relative flex flex-col items-center justify-center bg-gradient-to-br from-[#0B1121] to-[#1a0b2e] p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          {designState === "MAIN_MENU" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <Palette className="w-32 h-32 text-pink-500 mx-auto mb-8 opacity-80" />
              <h1 className="text-6xl font-black mb-6 tracking-tight">BlinkDesign Studio</h1>
              <p className="text-2xl text-slate-400 max-w-lg mx-auto">Create stunning designs with one blink.</p>
            </motion.div>
          )}

          {designState !== "MAIN_MENU" && designState !== "PREVIEW_RESULT" && !isGenerating && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <Settings className="w-6 h-6 text-pink-400" />
                Current Configuration
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Type</p>
                  <p className="text-lg font-medium text-white">{designType || "..."}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Industry</p>
                  <p className="text-lg font-medium text-white">{industry || "..."}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Style</p>
                  <p className="text-lg font-medium text-white">{designStyle || "..."}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Size</p>
                  <p className="text-lg font-medium text-white">{designSize || "..."}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Text Style</p>
                  <p className="text-lg font-medium text-white">{textStyle || "..."}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Color Theme</p>
                  <p className="text-lg font-medium text-white">{colorTheme || "..."}</p>
                </div>
              </div>
            </motion.div>
          )}

          {isGenerating && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <div className="w-24 h-24 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-8" />
              <h2 className="text-4xl font-black text-white">Generating Design Asset...</h2>
              <p className="text-slate-400 mt-4 text-lg">Synthesizing layouts, color palettes, and structures.</p>
            </motion.div>
          )}

          {designState === "PREVIEW_RESULT" && !isGenerating && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-5xl flex gap-8 h-full">
              {/* Left Side - SVG Preview */}
              <div className="flex-1 bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex items-center justify-center">
                {(generationMode === "AI" || generationMode === "PRO") && aiSvgResult ? (
                  <div dangerouslySetInnerHTML={{ __html: aiSvgResult }} className="w-full h-full rounded-xl drop-shadow-2xl overflow-hidden [&>svg]:w-full [&>svg]:h-full" />
                ) : (
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: generateStaticSvg(layoutTemplate, getDimensions().w, getDimensions().h, customText || designType, industry, designStyle, colorTheme) 
                    }} 
                    className="w-full h-full rounded-xl drop-shadow-2xl overflow-hidden [&>svg]:w-full [&>svg]:h-full" 
                  />
                )}
              </div>

              {/* Right Side - Business Details */}
              <div className="w-[350px] flex flex-col gap-4 overflow-y-auto">
                <div className="bg-gradient-to-br from-emerald-900/80 to-teal-900/80 p-6 rounded-3xl border border-emerald-500/30">
                  <h3 className="text-emerald-400 font-bold mb-2">Estimated Value</h3>
                  <p className="text-4xl font-black text-white">{estimatedPrice}</p>
                  <p className="text-sm text-emerald-200 mt-2">Market average for {designType} in {industry}.</p>
                </div>

                <div className="bg-slate-900/80 p-6 rounded-3xl border border-white/10">
                  <h3 className="text-pink-400 font-bold mb-4 flex items-center gap-2"><Share2 className="w-4 h-4"/> Client Pitch (LinkedIn)</h3>
                  <p className="text-sm text-slate-300 italic">
                    "Hey! I created a highly accessible {designStyle} {designType} tailored for the {industry} space. 
                    It uses {colorTheme} styling to maximize engagement. Would love to help you scale your brand!"
                  </p>
                </div>

                <div className="bg-slate-900/80 p-6 rounded-3xl border border-white/10">
                  <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2"><Briefcase className="w-4 h-4"/> Package Includes</h3>
                  <ul className="text-sm text-slate-300 space-y-2 mt-4">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400"/> SVG High-Res File</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400"/> AI Image Prompts</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400"/> Project JSON Data</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-400"/> Professional PDF Brief</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
