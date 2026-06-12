"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Download, Play, Save, ChevronLeft, Home, FileText, CheckCircle, Zap } from "lucide-react";

// --- DATA STRUCTURES ---
const INDUSTRIES = [
  "Doctor / Clinic", "Advocate / Law Firm", "Coaching Center", "School / College",
  "Real Estate", "E-commerce Store", "Restaurant / Hotel", "Gym / Salon",
  "Travel Agency", "Local Shop", "Hospital / Rehab Center", "Startup",
  "NGO", "Freelancer", "Digital Marketing Agency", "HR / Recruitment",
  "Finance / Insurance", "Education Creator", "YouTube Creator", "Small Business"
];

const PROBLEMS = [
  "Too many customer questions", "Missed leads", "Manual appointment booking",
  "Repeated WhatsApp replies", "Slow document search", "Manual report creation",
  "No customer follow-up", "No website assistant", "Manual data analysis",
  "Poor client communication", "No sales automation", "No FAQ support",
  "Staff spends time on repetitive work", "Need professional proposal generator",
  "Need automated email replies"
];

const AGENT_TYPES = [
  "Customer Support Agent", "Lead Generation Agent", "Appointment Booking Agent",
  "Document Q&A Agent", "Resume Screening Agent", "Clinic Assistant Agent",
  "Legal Enquiry Agent", "Coaching Admission Agent", "Real Estate Lead Agent",
  "E-commerce Support Agent", "Data Analysis Agent", "Cyber Safety Report Agent",
  "Social Media Content Agent", "Research Assistant Agent", "Email Automation Agent",
  "WhatsApp Reply Agent", "Invoice / Billing Assistant Agent", "HR Policy Assistant Agent",
  "Travel Planning Agent", "Small Business Automation Agent"
];

const WORKFLOW_STEPS = [
  "Receive user query", "Understand intent", "Ask follow-up question",
  "Collect name/mobile/email", "Search knowledge base", "Generate answer",
  "Recommend next action", "Book appointment", "Save lead",
  "Send WhatsApp message", "Generate report", "Create PDF",
  "Notify business owner", "Follow up after 24 hours", "Escalate to human"
];

const TOOLS = [
  "Website chatbot", "WhatsApp Business", "Email", "Google Sheets",
  "PDF knowledge base", "CSV database", "Calendar booking", "CRM export",
  "Telegram bot", "Voice read aloud", "PDF report export", "ZIP project download",
  "Local JSON storage", "Groq API", "OpenAI-compatible API backend"
];

const MAIN_MENU = [
  "Create New AI Agent", "Choose Business Problem", "Choose Agent Type",
  "Choose Workflow Steps", "Choose Tools / Integrations", "Generate Agent Prompt",
  "Estimate Selling Price", "AI Agent Preview", "Save / Download Agent", "Back to Main OS"
];

type Step = "HOME" | "PROBLEM" | "TYPE" | "INDUSTRY" | "WORKFLOW" | "TOOLS" | "GENERATING" | "RESULT";

export default function BlinkAgentBuilder({ onExit }: { onExit?: () => void }) {
  const [currentStep, setCurrentStep] = useState<Step>("HOME");
  const [options, setOptions] = useState<string[]>(MAIN_MENU);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  // Selection State
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [selectedProblem, setSelectedProblem] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [pricing, setPricing] = useState<{india: string, intl: string} | null>(null);

  const [loading, setLoading] = useState(false);
  const [panelView, setPanelView] = useState<"ARCHITECTURE" | "ESTIMATE" | "PROMPT" | "PREVIEW">("ARCHITECTURE");
  
  const [previewChat, setPreviewChat] = useState<{role: string, content: string}[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Timers and Refs
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inactiveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Spacebar mechanics removed refs for double/long press

  // --- VOICE FEEDBACK ---
  const speak = useCallback((text: string) => {
    if (!voiceEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN"; // English/Hindi accent
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  // --- SCANNING & SELECTION LOGIC ---
  const handleSelectOption = useCallback(() => {
    const option = options[selectedIndex];
    speak(`Selected ${option}`);
    
    if (currentStep === "HOME") {
      if (option === "Create New AI Agent") {
        setCurrentStep("INDUSTRY");
        setOptions(["Done", ...INDUSTRIES]);
        setSelectedIndex(1);
      } else if (option === "Choose Business Problem") {
        setCurrentStep("PROBLEM");
        setOptions(["Done", ...PROBLEMS]);
        setSelectedIndex(1);
      } else if (option === "Choose Agent Type") {
        setCurrentStep("TYPE");
        setOptions(["Done", ...AGENT_TYPES]);
        setSelectedIndex(1);
      } else if (option === "Choose Workflow Steps") {
        setCurrentStep("WORKFLOW");
        setOptions(["Done", ...WORKFLOW_STEPS]);
        setSelectedIndex(1);
      } else if (option === "Choose Tools / Integrations") {
        setCurrentStep("TOOLS");
        setOptions(["Done", ...TOOLS]);
        setSelectedIndex(1);
      } else if (option === "Generate Agent Prompt") {
        setPanelView("PROMPT");
      } else if (option === "Estimate Selling Price") {
        setPanelView("ESTIMATE");
      } else if (option === "AI Agent Preview") {
        setPanelView("PREVIEW");
      } else if (option === "Save / Download Agent") {
        handleDownload();
      } else if (option === "Back to Main OS") {
        if (onExit) {
          onExit();
        } else {
          window.history.back();
        }
      }
    } else if (currentStep === "INDUSTRY") {
      if (option === "Done") { setCurrentStep("HOME"); setOptions(MAIN_MENU); setSelectedIndex(0); setPanelView("ARCHITECTURE"); }
      else { setSelectedIndustry(option); setCurrentStep("HOME"); setOptions(MAIN_MENU); setSelectedIndex(0); setPanelView("ARCHITECTURE"); }
    } else if (currentStep === "PROBLEM") {
      if (option === "Done") { setCurrentStep("HOME"); setOptions(MAIN_MENU); setSelectedIndex(0); setPanelView("ARCHITECTURE"); }
      else { setSelectedProblem(option); setCurrentStep("HOME"); setOptions(MAIN_MENU); setSelectedIndex(0); setPanelView("ARCHITECTURE"); }
    } else if (currentStep === "TYPE") {
      if (option === "Done") { setCurrentStep("HOME"); setOptions(MAIN_MENU); setSelectedIndex(0); setPanelView("ARCHITECTURE"); }
      else { setSelectedType(option); setCurrentStep("HOME"); setOptions(MAIN_MENU); setSelectedIndex(0); setPanelView("ARCHITECTURE"); }
    } else if (currentStep === "WORKFLOW") {
      if (option === "Done") { setCurrentStep("HOME"); setOptions(MAIN_MENU); setSelectedIndex(0); setPanelView("ARCHITECTURE"); }
      else {
        setSelectedWorkflows(prev => prev.includes(option) ? prev.filter(p => p !== option) : [...prev, option]);
      }
    } else if (currentStep === "TOOLS") {
      if (option === "Done") { setCurrentStep("HOME"); setOptions(MAIN_MENU); setSelectedIndex(0); setPanelView("ARCHITECTURE"); }
      else {
        setSelectedTools(prev => prev.includes(option) ? prev.filter(p => p !== option) : [...prev, option]);
      }
    }
  }, [currentStep, options, selectedIndex, speak]);

  const handleMove = useCallback(() => {
    setSelectedIndex((prev) => (prev + 1) % options.length);
  }, [options.length]);

  const handleGoBack = useCallback(() => {
    speak("Going back");
    setCurrentStep("HOME");
    setOptions(MAIN_MENU);
    setSelectedIndex(0);
  }, [speak]);

  // Restart 2-second dwell timer whenever index changes
  useEffect(() => {
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    speak(options[selectedIndex]); // Speak the highlighted item
    
    // Scroll the selected item into view
    const activeElement = document.getElementById(`agent-option-${selectedIndex}`);
    if (activeElement) {
      activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    
    dwellTimerRef.current = setTimeout(() => {
      handleSelectOption();
    }, 2000); // 2 SECONDS DWELL TO SELECT

    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [selectedIndex, options, handleSelectOption, speak]);

  // Handle Spacebar Logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        // Stop dwell timer while interacting
        if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleMove();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleMove]);

  // Download logic
  const handleDownload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/blink-agent/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: selectedIndustry,
          problem: selectedProblem,
          type: selectedType,
          workflows: selectedWorkflows,
          tools: selectedTools
        })
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BlinkAgent_${selectedType ? selectedType.replace(/\s+/g, '_') : 'Project'}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        speak("Download started");
      }
    } catch (e) {
      console.error(e);
      speak("Error generating project");
    }
    setLoading(false);
  }, [selectedIndustry, selectedProblem, selectedType, selectedWorkflows, selectedTools, speak]);

  const runPreviewDemo = useCallback(async () => {
    setIsChatLoading(true);
    const userMsg = "Hello, I need help with my problem.";
    setPreviewChat([{role: "user", content: userMsg}]);
    
    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `You are an AI Agent for ${selectedIndustry || "General"}. Agent Type: ${selectedType}. Problem: ${selectedProblem}. Tools: ${selectedTools.join(",")}. Workflow: ${selectedWorkflows.join(",")}. Respond briefly to the user: "${userMsg}"`,
          model: "llama-3.1-8b-instant",
          language: "en"
        })
      });
      const data = await res.json();
      const aiReply = data.reply || data.error || "No response received.";
      setPreviewChat(prev => [...prev, {role: "agent", content: aiReply}]);
      speak(aiReply);
    } catch(e) {
      setPreviewChat(prev => [...prev, {role: "agent", content: "Error connecting to AI."}]);
    }
    setIsChatLoading(false);
  }, [selectedIndustry, selectedType, selectedProblem, selectedTools, selectedWorkflows, speak]);

  // Auto-run preview when panel opens
  useEffect(() => {
    if (panelView === "PREVIEW" && previewChat.length === 0) {
      runPreviewDemo();
    }
  }, [panelView, previewChat.length, runPreviewDemo]);

  const calculatePrice = () => {
    let base = 15000;
    if (selectedWorkflows.length > 3) base += 10000;
    if (selectedTools.includes("WhatsApp API")) base += 15000;
    if (selectedTools.includes("Stripe / Razorpay")) base += 10000;
    if (selectedTools.includes("Custom CRM")) base += 20000;
    if (selectedType === "Autonomous Multi-Agent") base += 30000;
    return base;
  };

  return (
    <div className="flex h-screen w-full bg-[#0A0F1C] text-white overflow-hidden font-sans">
      {/* LEFT PANEL - SCANNER */}
      <div className="w-1/3 border-r border-gray-800 p-4 flex flex-col h-full bg-gray-900/50 backdrop-blur-md rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
            <Zap className="w-6 h-6 text-cyan-400" />
            BlinkAgent
          </h1>
          <button onClick={() => setVoiceEnabled(!voiceEnabled)}>
            <Mic className={`w-6 h-6 ${voiceEnabled ? "text-green-400" : "text-red-500"}`} />
          </button>
        </div>
        
        <div className="flex flex-col gap-3 overflow-y-auto pb-20 custom-scrollbar flex-1 px-2">
          {options.map((opt, idx) => {
            const isSelected = selectedWorkflows.includes(opt) || selectedTools.includes(opt);
            const isHighlighted = idx === selectedIndex;
            return (
              <div
                id={`agent-option-${idx}`}
                key={idx}
                className={`p-5 rounded-2xl border-2 transition-all duration-300 transform shadow-lg text-lg font-medium flex justify-between items-center ${
                  isHighlighted
                    ? "bg-cyan-900/40 border-cyan-400 scale-105 shadow-cyan-500/20"
                    : "bg-gray-800/60 border-gray-700 text-gray-300"
                }`}
              >
                {opt}
                {isSelected && <CheckCircle className="text-green-400 w-6 h-6" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* CENTER & RIGHT PANEL */}
      <div className="w-2/3 p-6 flex flex-col h-full">
        {/* Top Info Bar */}
        <div className="flex gap-4 mb-6">
           <div className="bg-gray-900/80 p-4 rounded-xl border border-gray-800 flex-1">
              <p className="text-sm text-gray-400">Industry</p>
              <p className="text-lg font-semibold text-purple-400">{selectedIndustry || "None"}</p>
           </div>
           <div className="bg-gray-900/80 p-4 rounded-xl border border-gray-800 flex-1">
              <p className="text-sm text-gray-400">Agent Type</p>
              <p className="text-lg font-semibold text-green-400">{selectedType || "None"}</p>
           </div>
           <div className="bg-gray-900/80 p-4 rounded-xl border border-gray-800 flex-1">
              <p className="text-sm text-gray-400">Problem Solved</p>
              <p className="text-lg font-semibold text-pink-400">{selectedProblem || "None"}</p>
           </div>
        </div>

        {/* Visualizer Area based on panelView */}
        <div className="flex-1 bg-gray-900/40 border border-gray-800 rounded-2xl p-6 overflow-y-auto">
          {panelView === "ARCHITECTURE" && (
            <>
              <h2 className="text-xl font-bold mb-4 text-white">Agent Workflow Architecture</h2>
              <div className="flex flex-wrap gap-2 mb-8">
                 {selectedWorkflows.length === 0 ? (
                   <p className="text-gray-500">No workflow steps selected.</p>
                 ) : (
                   selectedWorkflows.map((w, i) => (
                     <div key={i} className="flex items-center gap-2">
                       <div className="bg-cyan-900/30 border border-cyan-500/50 text-cyan-100 px-4 py-2 rounded-full text-sm font-medium">
                         {i+1}. {w}
                       </div>
                       {i < selectedWorkflows.length - 1 && <span className="text-gray-600">→</span>}
                     </div>
                   ))
                 )}
              </div>

              <h2 className="text-xl font-bold mb-4 text-white">Integrations</h2>
              <div className="flex flex-wrap gap-2">
                 {selectedTools.length === 0 ? (
                   <p className="text-gray-500">No integrations selected.</p>
                 ) : (
                   selectedTools.map((t, i) => (
                     <div key={i} className="bg-purple-900/30 border border-purple-500/50 text-purple-100 px-4 py-2 rounded-xl text-sm font-medium">
                       {t}
                     </div>
                   ))
                 )}
              </div>
            </>
          )}

          {panelView === "ESTIMATE" && (
            <div className="flex flex-col items-center justify-center h-full">
               <h2 className="text-2xl font-bold mb-2 text-white">Estimated Selling Price</h2>
               <p className="text-gray-400 mb-8 text-center max-w-md">Based on your selected workflows, integrations, and agent complexity.</p>
               
               <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 border border-green-500/50 p-8 rounded-3xl text-center shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                  <p className="text-sm text-green-400 font-bold uppercase tracking-widest mb-2">Market Value</p>
                  <p className="text-6xl font-black text-white">₹{calculatePrice().toLocaleString('en-IN')}</p>
                  <p className="mt-4 text-green-300/80">~${Math.round(calculatePrice() / 83).toLocaleString()}</p>
               </div>
            </div>
          )}

          {panelView === "PROMPT" && (
            <div className="h-full flex flex-col">
              <h2 className="text-xl font-bold mb-4 text-white">Generated System Prompt</h2>
              <div className="bg-black/50 p-4 rounded-xl border border-gray-700 flex-1 overflow-auto font-mono text-sm text-green-400">
                You are a highly capable AI Agent designed for the {selectedIndustry || "General"} industry.
                Your primary goal is to solve the following problem: {selectedProblem || "General tasks"}.
                
                You operate as a {selectedType || "Standard Agent"}.
                
                Workflows you must follow:
                {selectedWorkflows.map((w,i) => `\n${i+1}. ${w}`)}
                
                Tools available to you:
                {selectedTools.map((t,i) => `\n- ${t}`)}
              </div>
            </div>
          )}

          {panelView === "PREVIEW" && (
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Live AI Preview</h2>
                {isChatLoading && <span className="text-sm text-purple-400 font-bold animate-pulse">Generating...</span>}
              </div>
              <div className="flex-1 bg-black/40 rounded-xl border border-gray-700 p-4 flex flex-col gap-4 overflow-y-auto">
                {previewChat.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Preparing agent...
                  </div>
                ) : (
                  previewChat.map((msg, i) => (
                    <div key={i} className={`p-4 rounded-xl max-w-[80%] ${msg.role === 'user' ? 'bg-blue-900/50 border border-blue-500/30 self-end' : 'bg-gray-800 border border-gray-600 self-start'}`}>
                      <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">{msg.role}</p>
                      <p className="text-white whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="mt-6 flex justify-between items-center bg-gray-900/80 border border-gray-800 p-4 rounded-2xl">
           <div className="flex gap-6 text-sm text-gray-400">
             <div className="flex items-center gap-2">
               <div className="w-12 h-6 bg-gray-800 rounded flex items-center justify-center text-xs border border-gray-700">SPACE</div>
               <span>Move</span>
             </div>
             <div className="flex items-center gap-2">
               <div className="w-8 h-6 bg-gray-800 rounded flex items-center justify-center text-xs border border-gray-700">2s</div>
               <span>Select</span>
             </div>

           </div>

           <button 
             onClick={handleDownload}
             disabled={loading}
             className="bg-cyan-500 hover:bg-cyan-400 text-black px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
           >
             {loading ? "Generating..." : "Download ZIP"}
             <Download className="w-5 h-5" />
           </button>
        </div>
      </div>
    </div>
  );
}
