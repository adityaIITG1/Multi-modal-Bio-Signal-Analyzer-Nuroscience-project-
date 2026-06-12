import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import JSZip from "jszip";
import {
  Brain,
  Bot,
  Code,
  DollarSign,
  Download,
  Terminal,
  ChevronLeft,
  CheckCircle2,
  Briefcase,
  Layers,
  Wand2,
  MessageSquare,
  Globe,
  Smartphone,
  Play,
  ChevronRight
} from "lucide-react";

// --- CONSTANTS ---

const INDUSTRIES = [
  "Lawyer / Advocate Chatbot", "Doctor / Clinic Chatbot", "Hospital Chatbot",
  "Physiotherapy / Rehab Center Chatbot", "Coaching Center Chatbot",
  "School / College Admission Chatbot", "E-commerce Store Chatbot",
  "Real Estate Lead Chatbot", "Restaurant / Hotel Chatbot", "Salon / Gym Chatbot",
  "Travel Agency Chatbot", "Local Shop Chatbot", "Portfolio / Personal Brand Chatbot",
  "Freelancer Chatbot", "Digital Marketing Agency Chatbot", "NGO / Social Work Chatbot",
  "Event Booking Chatbot", "Insurance Agent Chatbot", "Financial Advisor Chatbot",
  "Customer Support Chatbot"
];

const BOT_TYPES = [
  "FAQ Chatbot", "Lead Generation Chatbot", "Appointment Booking Chatbot",
  "WhatsApp Enquiry Bot", "Website Chatbot", "AI Knowledge Base Bot",
  "Document Q&A Bot", "Product Recommendation Bot", "Customer Support Bot",
  "Patient Intake Bot"
];

const FEATURESList = [
  "Welcome Message", "Service Information", "Pricing / Fee Details",
  "Appointment Booking", "WhatsApp Lead Capture", "Call Button",
  "Email Capture", "Location / Google Maps Link", "Working Hours",
  "FAQ Answers", "Document Checklist", "Payment Information",
  "Report Upload Guidance", "Product Recommendation", "Order Status",
  "Human Handover", "Emergency Alert", "Multilingual Support",
  "Voice Reply", "Admin Lead Dashboard"
];

type AppState =
  | "MAIN_MENU"
  | "INDUSTRY_SELECT"
  | "BOT_TYPE_SELECT"
  | "FEATURES_SELECT"
  | "GENERATING_VIEW"
  | "DASHBOARD_VIEW"
  | "PRICING_VIEW"
  | "SALES_VIEW"
  | "PREVIEW_VIEW";

interface ScannerOption {
  label: string;
  icon?: any;
  action?: () => void;
  nextState?: AppState;
  selected?: boolean;
}

interface BlinkBotProps {
  isActive: boolean;
  onExit: () => void;
}

export default function BlinkBotBuilder({ isActive, onExit }: BlinkBotProps) {
  // Navigation & State
  const [appState, setAppState] = useState<AppState>("MAIN_MENU");
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // User Selections
  const [selectedIndustry, setSelectedIndustry] = useState<string>("");
  const [selectedBotType, setSelectedBotType] = useState<string>("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  // Generation
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  
  // Audio
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const speak = (text: string) => {
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    synth.speak(utterance);
  };

  // Timer Ref
  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const SCAN_DELAY_MS = 2500;
  const lastPressTime = useRef<number>(0);

  // --- Dynamic Option Builder ---
  const getCurrentOptions = (): ScannerOption[] => {
    switch (appState) {
      case "MAIN_MENU":
        return [
          { label: "Create New Chatbot", icon: Wand2, action: () => { setAppState("INDUSTRY_SELECT"); setActiveIndex(0); speak("Select Industry."); } },
          { label: "My Projects", icon: Briefcase, action: () => speak("No saved projects found.") },
          { label: "Exit Builder", icon: ChevronLeft, action: onExit },
        ];
      case "INDUSTRY_SELECT":
        return [
          ...INDUSTRIES.map(ind => ({ label: ind, action: () => { setSelectedIndustry(ind); setAppState("BOT_TYPE_SELECT"); setActiveIndex(0); speak("Select Bot Type."); } })),
          { label: "Go Back", icon: ChevronLeft, action: () => { setAppState("MAIN_MENU"); setActiveIndex(0); } }
        ];
      case "BOT_TYPE_SELECT":
        return [
          ...BOT_TYPES.map(bt => ({ label: bt, action: () => { setSelectedBotType(bt); setAppState("FEATURES_SELECT"); setActiveIndex(0); speak("Select Features."); } })),
          { label: "Go Back", icon: ChevronLeft, action: () => { setAppState("INDUSTRY_SELECT"); setActiveIndex(0); } }
        ];
      case "FEATURES_SELECT":
        return [
          { label: "Finish Selection & Generate", icon: Wand2, action: () => { 
            if (selectedFeatures.length === 0) { speak("Select at least one feature."); return; }
            setAppState("GENERATING_VIEW"); setActiveIndex(0); startGeneration(); 
          }},
          ...FEATURESList.map(feat => ({
            label: feat,
            selected: selectedFeatures.includes(feat),
            action: () => {
              setSelectedFeatures(prev => prev.includes(feat) ? prev.filter(f => f !== feat) : [...prev, feat]);
              speak(selectedFeatures.includes(feat) ? "Removed" : "Added");
            }
          })),
          { label: "Go Back", icon: ChevronLeft, action: () => { setAppState("BOT_TYPE_SELECT"); setActiveIndex(0); } }
        ];
      case "DASHBOARD_VIEW":
        return [
          { label: "Preview Chatbot", icon: Play, nextState: "PREVIEW_VIEW" },
          { label: "Pricing Estimate", icon: DollarSign, nextState: "PRICING_VIEW" },
          { label: "Sales Pitch", icon: MessageSquare, nextState: "SALES_VIEW" },
          { label: "Download Project ZIP", icon: Download, action: handleDownloadZip },
          { label: "Start New Project", icon: Wand2, action: () => { setSelectedIndustry(""); setSelectedBotType(""); setSelectedFeatures([]); setAppState("MAIN_MENU"); setActiveIndex(0); } },
          { label: "Exit Builder", icon: ChevronLeft, action: onExit }
        ];
      case "PRICING_VIEW":
      case "SALES_VIEW":
      case "PREVIEW_VIEW":
        return [
          { label: "Go Back", icon: ChevronLeft, action: () => { setAppState("DASHBOARD_VIEW"); setActiveIndex(0); } }
        ];
      default:
        return [];
    }
  };

  const currentOptions = getCurrentOptions();

  // --- Generation Logic ---
  const startGeneration = () => {
    speak("AI is building your chatbot prompt and generating code.");
    setTerminalLines(["> Initializing BlinkBot AI Engine..."]);
    
    const steps = [
      `> Analyzing Industry: ${selectedIndustry}...`,
      `> Architecting Bot Type: ${selectedBotType}...`,
      `> Injecting ${selectedFeatures.length} premium features...`,
      "> Building System Prompt...",
      "> Generating HTML/CSS/JS frontend code...",
      "> Synthesizing pricing matrix...",
      "> Creating sales pitches...",
      "> Finalizing Project Package. Ready!"
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setTerminalLines(prev => [...prev, steps[currentStep]]);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setAppState("DASHBOARD_VIEW");
          setActiveIndex(0);
          speak("Chatbot generated successfully. Welcome to the dashboard.");
        }, 1500);
      }
    }, 800);
  };

  // --- Download Logic ---
  const handleDownloadZip = async () => {
    speak("Zipping project files for download.");
    const zip = new JSZip();
    
    const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${selectedIndustry} Chatbot</title>
  <style>
    body { font-family: sans-serif; background: #f0f4f8; }
    .chat-container { width: 350px; height: 500px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); padding: 16px; display: flex; flex-direction: column; }
    .header { font-weight: bold; font-size: 1.2rem; margin-bottom: 16px; text-align: center; color: #3b82f6; }
    .messages { flex: 1; overflow-y: auto; margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; }
  </style>
</head>
<body>
  <div class="chat-container">
    <div class="header">${selectedIndustry}</div>
    <div class="messages">
      <div>🤖 Welcome! I am your ${selectedBotType}.</div>
      ${selectedFeatures.map(f => `<div>✅ Feature Active: ${f}</div>`).join("")}
    </div>
  </div>
</body>
</html>`;

    const readme = `# ${selectedIndustry} - AI Chatbot Project\nType: ${selectedBotType}\nFeatures: ${selectedFeatures.join(", ")}\n\n## Setup Instructions\n1. Open index.html in your browser.\n2. For backend, deploy the server.js file to Node.js.\n3. Update .env with your LLM API Key.\n\nGenerated by BlinkBot Builder.`;

    zip.file("index.html", indexHtml);
    zip.file("README.md", readme);
    zip.file(".env.example", "GROQ_API_KEY=your_api_key_here\n");

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BlinkBot_${selectedIndustry.replace(/[^a-zA-Z]/g, "")}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    speak("Download complete.");
  };

  // --- Dynamic Content Generators ---
  const isPremium = selectedFeatures.includes("Appointment Booking") || selectedFeatures.includes("Admin Lead Dashboard") || selectedFeatures.includes("Human Handover");
  const baseIndia = isPremium ? 10000 : 3000;
  const baseIntl = isPremium ? 200 : 50;
  
  const pricing = {
    basic: { in: `₹${baseIndia} - ₹${baseIndia + 3000}`, us: `$${baseIntl} - $${baseIntl + 100}` },
    standard: { in: `₹${baseIndia * 2.5} - ₹${baseIndia * 3.5}`, us: `$${baseIntl * 2.5} - $${baseIntl * 3.5}` },
    premium: { in: `₹${baseIndia * 5} - ₹${baseIndia * 8}`, us: `$${baseIntl * 5} - $${baseIntl * 8}` }
  };

  // --- Scanner Logic ---
  const stopScanner = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setProgress(0);
  };

  const DWELL_TIME_MS = 5000;

  const startScanner = () => {
    stopScanner();
    const startTime = Date.now();
    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min((elapsed / DWELL_TIME_MS) * 100, 100);
      setProgress(p);

      if (p >= 100) {
        stopScanner();
        const option = currentOptionsRef.current[activeIndexRef.current];
        if (option) {
          if (option.action) option.action();
          if (option.nextState) {
            setAppState(option.nextState);
            setActiveIndex(0);
          }
        }
      }
    }, 50);
  };

  useEffect(() => {
    if (isActive && appState !== "GENERATING_VIEW") {
      startScanner();
    } else {
      stopScanner();
    }
    return stopScanner;
  }, [isActive, appState, currentOptions.length]);

  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const currentOptionsRef = useRef(currentOptions);
  currentOptionsRef.current = currentOptions;
  const startScannerRef = useRef(startScanner);
  startScannerRef.current = startScanner;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (!isActive || e.code !== "Space" || appState === "GENERATING_VIEW") return;
      e.preventDefault();

      // Single click: Move to next option
      setActiveIndex((prev) => (prev + 1) % currentOptionsRef.current.length);
      
      // Reset the dwell timer
      setProgress(0);
      startScannerRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, appState]);

  useEffect(() => {
    const el = document.getElementById(`bot-opt-${activeIndex}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIndex]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-50 bg-slate-900 flex overflow-hidden font-sans rounded-3xl text-white">
      {/* Sidebar Navigation */}
      {appState !== "GENERATING_VIEW" && (
        <div className="w-[360px] flex-shrink-0 flex flex-col gap-4 bg-slate-800/80 p-6 border-r border-slate-700 shadow-2xl backdrop-blur-md z-10 overflow-y-auto">
          <div className="mb-4">
            <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Bot className="w-8 h-8 text-indigo-400" />
              BlinkBot
            </h2>
            <p className="text-slate-400 text-sm mt-1 font-medium">Create & sell chatbots with one blink.</p>
          </div>

          <div className="flex flex-col gap-3 pb-8">
            {currentOptions.map((opt, idx) => (
              <motion.div
                key={opt.label}
                id={`bot-opt-${idx}`}
                animate={{
                  scale: activeIndex === idx ? 1.02 : 1,
                  x: activeIndex === idx ? 10 : 0
                }}
                className={`relative p-4 rounded-2xl flex items-center gap-4 transition-all overflow-hidden ${
                  activeIndex === idx 
                    ? "bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.3)] text-white" 
                    : "bg-slate-700/50 text-slate-300 border border-slate-600/50"
                }`}
              >
                {activeIndex === idx && (
                  <div 
                    className="absolute bottom-0 left-0 h-1 bg-white" 
                    style={{ width: `${progress}%`, transition: "width 50ms linear" }} 
                  />
                )}
                <div className="shrink-0 flex items-center justify-center">
                  {opt.selected ? <CheckCircle2 className="w-6 h-6 text-green-400" /> : opt.icon ? <opt.icon className="w-6 h-6" /> : <div className="w-6 h-6 rounded-full border-2 border-current opacity-30" />}
                </div>
                <span className="font-bold text-lg">{opt.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 relative flex items-center justify-center bg-slate-900 p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          
          {appState === "GENERATING_VIEW" && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-3xl bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden font-mono"
            >
              <div className="bg-slate-800 px-4 py-3 flex items-center gap-2 border-b border-slate-700">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-4 text-sm text-slate-400 font-bold">BlinkBot AI Generator Engine</span>
              </div>
              <div className="p-6 text-green-400 min-h-[400px] text-lg leading-loose space-y-2">
                {terminalLines.map((line, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                    {line}
                  </motion.div>
                ))}
                <motion.div 
                  animate={{ opacity: [1, 0] }} 
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-3 h-5 bg-green-400 inline-block align-middle ml-2"
                />
              </div>
            </motion.div>
          )}

          {appState === "MAIN_MENU" && (
             <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="text-center"
           >
             <Bot className="w-24 h-24 text-indigo-500 mx-auto mb-6" />
             <h1 className="text-5xl font-black text-white mb-4">BlinkBot Builder</h1>
             <p className="text-xl text-slate-400 font-medium">Create and sell business chatbots with one blink.</p>
           </motion.div>
          )}

          {appState === "DASHBOARD_VIEW" && (
            <motion.div className="w-full max-w-5xl">
              <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                    <Bot className="w-10 h-10 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white">Project Dashboard</h2>
                    <p className="text-slate-400 font-medium">{selectedIndustry} • {selectedBotType}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700/50">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-400" /> Included Features</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedFeatures.map(f => (
                        <span key={f} className="px-3 py-1.5 bg-slate-800 text-slate-300 text-sm font-semibold rounded-lg border border-slate-700">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700/50">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Terminal className="w-5 h-5 text-indigo-400" /> Generated AI Prompt</h3>
                    <p className="text-slate-400 text-sm italic font-mono bg-slate-950 p-4 rounded-xl border border-slate-800 h-[150px] overflow-y-auto">
                      &quot;Create a professional AI chatbot for a {selectedIndustry.split(" ")[0]}. The chatbot should act as a {selectedBotType.toLowerCase()}. Core functionalities include: {selectedFeatures.join(", ")}. Ensure strict adherence to industry ethical guidelines and never provide final professional advice without human handover.&quot;
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {appState === "PRICING_VIEW" && (
            <motion.div className="w-full max-w-4xl bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl">
              <h2 className="text-3xl font-black text-white mb-8 flex items-center gap-3"><DollarSign className="w-8 h-8 text-green-400" /> Pricing Estimate Calculator</h2>
              <p className="text-slate-400 mb-6">Suggested selling prices based on the {selectedFeatures.length} premium features selected for the {selectedIndustry} market.</p>
              
              <div className="grid grid-cols-3 gap-6">
                {/* Basic */}
                <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700">
                  <h3 className="text-xl font-bold text-white mb-2">Basic Package</h3>
                  <p className="text-green-400 font-black text-2xl mb-1">{pricing.basic.in}</p>
                  <p className="text-slate-400 text-sm font-bold mb-4">{pricing.basic.us}</p>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li>✓ Setup & Deployment</li>
                    <li>✓ 3 Basic Features</li>
                    <li>✓ 7 Days Support</li>
                  </ul>
                </div>
                {/* Standard */}
                <div className="bg-indigo-600/20 p-6 rounded-2xl border border-indigo-500/50 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Recommended</div>
                  <h3 className="text-xl font-bold text-white mb-2">Standard Package</h3>
                  <p className="text-indigo-400 font-black text-2xl mb-1">{pricing.standard.in}</p>
                  <p className="text-slate-400 text-sm font-bold mb-4">{pricing.standard.us}</p>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li>✓ Everything in Basic</li>
                    <li>✓ Up to 10 Features</li>
                    <li>✓ WhatsApp Integration</li>
                    <li>✓ 1 Month Support</li>
                  </ul>
                </div>
                {/* Premium */}
                <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700 border-t-amber-400 border-t-4">
                  <h3 className="text-xl font-bold text-white mb-2">Premium Package</h3>
                  <p className="text-amber-400 font-black text-2xl mb-1">{pricing.premium.in}</p>
                  <p className="text-slate-400 text-sm font-bold mb-4">{pricing.premium.us}</p>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li>✓ Full Custom Development</li>
                    <li>✓ All {selectedFeatures.length} Features</li>
                    <li>✓ Admin Dashboard</li>
                    <li>✓ 1 Year Maintenance</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {appState === "SALES_VIEW" && (
            <motion.div className="w-full max-w-4xl bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl">
              <h2 className="text-3xl font-black text-white mb-8 flex items-center gap-3"><MessageSquare className="w-8 h-8 text-indigo-400" /> Sales & Outreach Pitch</h2>
              
              <div className="space-y-6">
                <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Smartphone className="w-5 h-5 text-green-400" /> WhatsApp Cold Pitch</h3>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    &quot;Hello Sir/Ma&apos;am,\n\nI noticed your business online. I am an AI Developer and I have built a custom *{selectedBotType}* specifically designed for a *{selectedIndustry.split(" ")[0]}*.\n\nIt can automatically handle customer inquiries 24/7 and features: {selectedFeatures.slice(0,3).join(", ")}.\n\nCould I send you a quick 1-minute demo link to test it yourself? It saves hours of manual work.&quot;
                  </p>
                </div>

                <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Globe className="w-5 h-5 text-blue-400" /> LinkedIn Connect Message</h3>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    &quot;Hi! I specialize in building AI automation for the {selectedIndustry.split(" ")[0]} sector. I&apos;ve developed a custom chatbot that handles {selectedFeatures[0]?.toLowerCase() || "lead generation"} and {selectedFeatures[1]?.toLowerCase() || "customer support"}. Would love to connect and share a live demo with you!&quot;
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {appState === "PREVIEW_VIEW" && (
            <motion.div className="w-[380px] h-[600px] bg-slate-100 rounded-[2.5rem] border-[8px] border-slate-800 shadow-2xl flex flex-col relative overflow-hidden">
              <div className="bg-indigo-600 pt-10 pb-4 px-6 rounded-b-3xl shadow-md z-10">
                <h3 className="text-white font-bold text-lg">{selectedIndustry.split(" ")[0]} Assistant</h3>
                <p className="text-indigo-200 text-xs font-medium">Online • Powered by AI</p>
              </div>
              <div className="flex-1 bg-slate-50 p-4 flex flex-col gap-3 overflow-y-auto">
                <div className="self-start max-w-[85%] bg-white p-3 rounded-2xl rounded-tl-none shadow-sm text-slate-800 text-sm">
                  Welcome! I am the automated {selectedBotType.toLowerCase()}. How can I assist you today?
                </div>
                <div className="self-end max-w-[85%] bg-indigo-600 p-3 rounded-2xl rounded-tr-none shadow-sm text-white text-sm">
                  What services do you offer?
                </div>
                <div className="self-start max-w-[85%] bg-white p-3 rounded-2xl rounded-tl-none shadow-sm text-slate-800 text-sm">
                  I can help you with: <br/>
                  {selectedFeatures.slice(0,4).map(f => `• ${f}`).join("\n")}
                </div>
              </div>
              <div className="bg-white p-4 border-t border-slate-200">
                <div className="bg-slate-100 rounded-full py-2 px-4 text-slate-400 text-sm flex justify-between">
                  <span>Type a message...</span>
                  <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center"><ChevronRight className="w-3 h-3 text-white"/></div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
