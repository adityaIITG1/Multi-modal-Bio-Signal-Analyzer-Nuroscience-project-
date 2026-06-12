import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Bot,
  BarChart,
  LayoutTemplate,
  Search,
  PenTool,
  Presentation,
  Accessibility,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Users,
  Target
} from "lucide-react";
import BlinkBotBuilder from "./BlinkBotBuilder";
import BlinkDataAnalyst from "./BlinkData";
import BlinkWebsiteBuilder from "./BlinkWebsiteBuilder";
import BlinkResearchAssistant from "./BlinkResearchAssistant";
import BlinkCreatorStudio from "./BlinkCreatorStudio";
import BlinkPitchDeck from "./BlinkPitchDeck";
import BlinkAccessibilityTester from "./BlinkAccessibilityTester";

// --- Types & Data ---

type HubState = "MENU" | "PROFILE" | "ACTIVE_MODULE";

interface JobProfile {
  id: string;
  title: string;
  icon: any;
  color: string;
  demand: string;
  opportunity: string;
  userRole: string;
  aiRole: string;
  bestBuyers: string[];
  earningPotential: string;
  available: boolean;
}

const JOB_PROFILES: JobProfile[] = [
  {
    id: "bot-builder",
    title: "AI Chatbot Builder",
    icon: Bot,
    color: "from-blue-500 to-indigo-600",
    demand: "Very High",
    opportunity: "Upwork's 2026 report shows chatbot dev demand increased 71%. Every local business now wants 24/7 AI support on WhatsApp and their website.",
    userRole: "Select industry & features using spacebar. Confirm the pricing strategy. Export and email the ZIP file to clients.",
    aiRole: "Architects the conversation flow, generates the HTML/JS code, writes the system prompt, and drafts your sales pitch.",
    bestBuyers: ["Lawyers", "Doctors", "Clinics", "Coaching Centers", "Local Shops", "Real Estate Agents"],
    earningPotential: "₹3,000 - ₹25,000 per bot + Monthly Maintenance",
    available: true
  },
  {
    id: "data-analyst",
    title: "Data Analysis Report Maker",
    icon: BarChart,
    color: "from-amber-400 to-orange-500",
    demand: "Very High",
    opportunity: "WEF reports AI & Big Data as the fastest-growing skills (2025-2030). Businesses have raw data but no time to understand it.",
    userRole: "Upload a CSV file, scan through auto-generated chart options, and click 'Export Report'.",
    aiRole: "Cleans the data, detects columns, calculates correlations, draws Recharts, and writes a professional summary.",
    bestBuyers: ["E-commerce Shops", "Schools", "Small Companies", "Digital Marketers"],
    earningPotential: "₹2,000 - ₹10,000 per custom report",
    available: true
  },
  {
    id: "website-builder",
    title: "Website / Landing Page Builder",
    icon: LayoutTemplate,
    color: "from-emerald-400 to-teal-500",
    demand: "High",
    opportunity: "Millions of offline businesses are moving online but cannot afford $1000 agency fees.",
    userRole: "Select business type and design theme via eye blinks. Approve the final look.",
    aiRole: "Generates HTML, CSS, JavaScript, responsive mobile layouts, and writes all the copy/text.",
    bestBuyers: ["Advocates", "Gyms", "Salons", "Local Services"],
    earningPotential: "₹5,000 - ₹30,000 per website",
    available: true
  },
  {
    id: "research-assistant",
    title: "AI Research Assistant",
    icon: Search,
    color: "from-purple-500 to-pink-600",
    demand: "High",
    opportunity: "Content creators and researchers spend hours reading articles. They will pay you to synthesize it.",
    userRole: "Input a topic name. Wait for the report. Export to PDF.",
    aiRole: "Searches the web, extracts key facts, builds comparison tables, and lists references.",
    bestBuyers: ["Students", "Lawyers", "Startups", "YouTubers", "Bloggers"],
    earningPotential: "₹1,000 - ₹5,000 per research paper",
    available: true
  },
  {
    id: "creator-studio",
    title: "AI Content Assistant",
    icon: PenTool,
    color: "from-rose-400 to-red-500",
    demand: "Very High",
    opportunity: "Social media consistency is the #1 problem for brands. AI content generation grew 220% YoY on Upwork.",
    userRole: "Pick a niche and a platform (LinkedIn/Twitter). Export a 30-day content calendar.",
    aiRole: "Writes viral hooks, educational posts, engaging captions, and suggests hashtags.",
    bestBuyers: ["LinkedIn Creators", "Coaches", "Doctors", "Lawyers"],
    earningPotential: "₹10,000 - ₹40,000 per month (Retainer)",
    available: true
  },
  {
    id: "pitch-deck",
    title: "Presentation / Pitch Deck Creator",
    icon: Presentation,
    color: "from-cyan-400 to-blue-500",
    demand: "High",
    opportunity: "Founders struggle to explain their ideas beautifully to investors.",
    userRole: "Input the startup idea and problem statement.",
    aiRole: "Structures the 10-slide deck, writes speaker notes, and formats the revenue model.",
    bestBuyers: ["Startups", "Hackathon Teams", "College Students", "Small Businesses"],
    earningPotential: "₹4,000 - ₹15,000 per pitch deck",
    available: true
  },
  {
    id: "accessibility-tester",
    title: "Accessibility Tester",
    icon: Accessibility,
    color: "from-lime-400 to-green-500",
    demand: "Medium-High",
    opportunity: "Highly unique proposition: A permanently disabled user providing real, authentic accessibility testing for corporate websites.",
    userRole: "Navigate the client's URL using your spacebar. Note where you get stuck.",
    aiRole: "Compiles your navigation data into a professional WCAG compliance report for the engineering team.",
    bestBuyers: ["Web Agencies", "Startups", "NGOs", "Government Portals"],
    earningPotential: "₹5,000 - ₹20,000 per audit",
    available: true
  }
];

interface ScannerOption {
  label: string;
  icon?: any;
  action?: () => void;
  selected?: boolean;
}

interface BlinkIncomeHubProps {
  isActive: boolean;
  onExit: () => void;
}

export default function BlinkIncomeHub({ isActive, onExit }: BlinkIncomeHubProps) {
  const [hubState, setHubState] = useState<HubState>("MENU");
  const [activeProfileId, setActiveProfileId] = useState<string>(JOB_PROFILES[0].id);
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastPressTime = useRef<number>(0);

  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const speak = (text: string) => {
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    synth.speak(utterance);
  };

  const activeProfile = JOB_PROFILES.find(p => p.id === activeProfileId) || JOB_PROFILES[0];

  // --- Dynamic Options ---
  const getCurrentOptions = (): ScannerOption[] => {
    if (hubState === "MENU") {
      return [
        ...JOB_PROFILES.map(job => ({
          label: job.title + (job.available ? "" : " (Coming Soon)"),
          icon: job.icon,
          action: () => {
            setActiveProfileId(job.id);
            setHubState("PROFILE");
            setActiveIndex(0);
            speak(`Profile for ${job.title}. ${job.opportunity}`);
          }
        })),
        { label: "Exit Income Hub", icon: ChevronLeft, action: onExit }
      ];
    } else if (hubState === "PROFILE") {
      return [
        {
          label: activeProfile.available ? "Launch Module" : "Module Locked",
          icon: activeProfile.available ? TrendingUp : Search,
          action: () => {
            if (activeProfile.available) {
              setHubState("ACTIVE_MODULE");
              speak("Launching module.");
            } else {
              speak("This module is currently in development.");
            }
          }
        },
        { label: "Go Back", icon: ChevronLeft, action: () => { setHubState("MENU"); setActiveIndex(0); } }
      ];
    }
    return [];
  };

  const currentOptions = getCurrentOptions();

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
        if (option && option.action) {
          option.action();
        }
      }
    }, 50);
  };

  useEffect(() => {
    if (isActive && hubState !== "ACTIVE_MODULE") {
      startScanner();
    } else {
      stopScanner();
    }
    return stopScanner;
  }, [isActive, hubState, currentOptions.length]);

  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const currentOptionsRef = useRef(currentOptions);
  currentOptionsRef.current = currentOptions;
  const startScannerRef = useRef(startScanner);
  startScannerRef.current = startScanner;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (!isActive || e.code !== "Space" || hubState === "ACTIVE_MODULE") return;
      e.preventDefault();

      // Single click: Move to next option
      setActiveIndex((prev) => (prev + 1) % currentOptionsRef.current.length);
      
      // Reset the dwell timer
      setProgress(0);
      startScannerRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, hubState]);

  useEffect(() => {
    const el = document.getElementById(`hub-opt-${activeIndex}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIndex]);

  // If a module is active, delegate rendering to it entirely.
  if (hubState === "ACTIVE_MODULE") {
    if (activeProfileId === "bot-builder") return <BlinkBotBuilder isActive={true} onExit={() => { setHubState("MENU"); setActiveIndex(0); startScanner(); }} />;
    if (activeProfileId === "data-analyst") return <BlinkDataAnalyst isActive={true} onExit={() => { setHubState("MENU"); setActiveIndex(0); startScanner(); }} />;
    if (activeProfileId === "website-builder") return <BlinkWebsiteBuilder isActive={true} onExit={() => { setHubState("MENU"); setActiveIndex(0); startScanner(); }} />;
    if (activeProfileId === "research-assistant") return <BlinkResearchAssistant isActive={true} onExit={() => { setHubState("MENU"); setActiveIndex(0); startScanner(); }} />;
    if (activeProfileId === "creator-studio") return <BlinkCreatorStudio isActive={true} onExit={() => { setHubState("MENU"); setActiveIndex(0); startScanner(); }} />;
    if (activeProfileId === "pitch-deck") return <BlinkPitchDeck isActive={true} onExit={() => { setHubState("MENU"); setActiveIndex(0); startScanner(); }} />;
    if (activeProfileId === "accessibility-tester") return <BlinkAccessibilityTester isActive={true} onExit={() => { setHubState("MENU"); setActiveIndex(0); startScanner(); }} />;
    return null;
  }

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-50 bg-[#0B1121] flex overflow-hidden font-sans rounded-3xl text-white">
      {/* Sidebar Menu */}
      <div className="w-[360px] flex-shrink-0 flex flex-col gap-4 bg-slate-900/80 p-6 border-r border-slate-800 shadow-2xl backdrop-blur-md z-10 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-emerald-400" />
            Income AI
          </h2>
          <p className="text-slate-400 text-sm mt-1 font-medium">Your spacebar-powered digital agency.</p>
        </div>

        <div className="flex flex-col gap-3 pb-8">
          {currentOptions.map((opt, idx) => (
            <motion.div
              key={opt.label}
              id={`hub-opt-${idx}`}
              animate={{
                scale: activeIndex === idx ? 1.02 : 1,
                x: activeIndex === idx ? 10 : 0
              }}
              className={`relative p-4 rounded-2xl flex items-center gap-4 transition-all overflow-hidden ${
                activeIndex === idx 
                  ? "bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.3)] text-white" 
                  : "bg-slate-800/50 text-slate-300 border border-slate-700/50"
              }`}
            >
              {activeIndex === idx && (
                <div 
                  className="absolute bottom-0 left-0 h-1 bg-white" 
                  style={{ width: `${progress}%`, transition: "width 50ms linear" }} 
                />
              )}
              <div className="shrink-0 flex items-center justify-center">
                {opt.icon ? <opt.icon className="w-6 h-6" /> : <div className="w-6 h-6 rounded-full border-2 border-current opacity-30" />}
              </div>
              <span className="font-bold text-[15px]">{opt.label}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col bg-[#0B1121] p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          {hubState === "MENU" && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <Briefcase className="w-24 h-24 text-emerald-500 mx-auto mb-6 opacity-80" />
              <h1 className="text-5xl font-black text-white mb-4">Select a Business Module</h1>
              <p className="text-xl text-slate-400 font-medium max-w-lg">Each module is a complete business-in-a-box. Let the AI do the heavy lifting while you command it with a single blink.</p>
            </motion.div>
          )}

          {hubState === "PROFILE" && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className={`w-full p-8 rounded-3xl mb-6 bg-gradient-to-r ${activeProfile.color} relative overflow-hidden shadow-2xl`}>
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative z-10 flex items-center gap-6">
                  <div className="p-5 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30">
                    <activeProfile.icon className="w-12 h-12 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full backdrop-blur-md uppercase tracking-wider">
                        Demand: {activeProfile.demand}
                      </span>
                    </div>
                    <h1 className="text-4xl font-black text-white">{activeProfile.title}</h1>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 flex flex-col">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-400" /> The Opportunity
                  </h3>
                  <p className="text-slate-200 text-lg font-medium leading-relaxed">
                    {activeProfile.opportunity}
                  </p>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 flex flex-col">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" /> Who to Sell To
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {activeProfile.bestBuyers.map(buyer => (
                      <span key={buyer} className="px-4 py-2 bg-slate-900 text-slate-300 font-bold text-sm rounded-xl border border-slate-700">
                        {buyer}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 flex-1">
                <div className="col-span-2 bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" /> Division of Labor
                  </h3>
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/30">
                        <span className="text-blue-400 font-bold">You</span>
                      </div>
                      <div>
                        <h4 className="text-white font-bold mb-1">Your Role (Spacebar Only)</h4>
                        <p className="text-slate-400 text-sm">{activeProfile.userRole}</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 border border-purple-500/30">
                        <Bot className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold mb-1">AI&apos;s Role (Heavy Lifting)</h4>
                        <p className="text-slate-400 text-sm">{activeProfile.aiRole}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-1 bg-gradient-to-b from-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-700/50 flex flex-col justify-center items-center text-center">
                  <DollarSign className="w-12 h-12 text-emerald-400 mb-4" />
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Earning Potential</h3>
                  <p className="text-2xl font-black text-white">{activeProfile.earningPotential}</p>
                  <p className="text-emerald-400 text-xs font-bold mt-2 bg-emerald-400/10 px-3 py-1 rounded-full">Highly Scalable</p>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
