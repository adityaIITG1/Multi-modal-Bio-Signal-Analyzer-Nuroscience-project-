"use client";

import React, { useState, useEffect, useRef } from "react";
import BlinkKeyboard from "./BlinkKeyboard";
import html2canvas from "html2canvas";
import { 
  ShieldCheck, ShieldAlert, Download, Target, 
  Search, Lock, CheckCircle2, AlertTriangle, ArrowLeft 
} from "lucide-react";

type CyberState = "SELECT_BUSINESS" | "SELECT_CHECK" | "SELECT_TARGET" | "TYPE_URL" | "ANALYZING" | "DASHBOARD";
type CyberData = any;

interface BlinkCyberShieldProps {
  isActive: boolean;
  onExit: () => void;
  speak: (text: string) => void;
}

const AUTO_SELECT_MS = 4000;

export default function BlinkCyberShield({ isActive, onExit, speak }: BlinkCyberShieldProps) {
  const [cyberState, setCyberState] = useState<CyberState>("SELECT_BUSINESS");
  const [businessType, setBusinessType] = useState("");
  const [checkType, setCheckType] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [reportData, setReportData] = useState<CyberData | null>(null);
  const [savedTargets, setSavedTargets] = useState<{label: string, value: string}[]>([]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const businessOptions = [
    "Clinic / Doctor", "Hospital", "Advocate / Law Firm", "Coaching Center",
    "School / College", "Local Shop", "E-commerce Store", "Real Estate Business",
    "Restaurant / Hotel", "Startup", "Freelancer", "Small Office", "NGO",
    "Digital Marketing Agency", "Travel Agency", "Personal Brand"
  ];

  const checkOptions = [
    "Website Safety Check",
    "Business Account Safety",
    "Email / Phishing Safety",
    "Data Privacy Check",
    "WhatsApp Business Safety",
    "Social Media Safety"
  ];

  const dashboardOptions = [
    { label: "Download ZIP Report", action: "export" },
    { label: "Download Image Report", action: "image" },
    { label: "New Scan", action: "new" },
    { label: "Exit Cyber Shield", action: "exit" }
  ];

  const getCurrentOptions = () => {
    switch (cyberState) {
      case "SELECT_BUSINESS":
        return businessOptions.map(b => ({ label: b, value: b }));
      case "SELECT_CHECK":
        return checkOptions.map(c => ({ label: c, value: c }));
      case "SELECT_TARGET":
        return [...savedTargets, { label: "✏️ Manual Type Target", value: "MANUAL" }];
      case "DASHBOARD":
        return dashboardOptions;
      default:
        return [];
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
  const cyberStateRef = useRef(cyberState);
  cyberStateRef.current = cyberState;

  const handleAction = async (option: any) => {
    speak(`Selected ${option.label}`);
    
    if (cyberStateRef.current === "SELECT_BUSINESS") {
      setBusinessType(option.value);
      setCyberState("SELECT_CHECK");
      setActiveIndex(0);
    } else if (cyberStateRef.current === "SELECT_CHECK") {
      setCheckType(option.value);
      setCyberState("SELECT_TARGET");
      setActiveIndex(0);
    } else if (cyberStateRef.current === "SELECT_TARGET") {
      if (option.value === "MANUAL") {
        setCyberState("TYPE_URL");
      } else {
        analyzeTarget(option.value);
      }
      setActiveIndex(0);
    } else if (cyberStateRef.current === "DASHBOARD") {
      if (option.action === "export") {
        speak("Generating ZIP report");
        await downloadReport();
      } else if (option.action === "image") {
        speak("Generating Image report");
        await downloadImageReport();
      } else if (option.action === "new") {
        setReportData(null);
        setCyberState("SELECT_BUSINESS");
        setActiveIndex(0);
      } else if (option.action === "exit") {
        onExit();
      }
    }
  };

  const startScanner = () => {
    stopScanner();
    if (currentOptionsRef.current.length === 0) return;

    const startTime = Date.now();
    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min((elapsed / AUTO_SELECT_MS) * 100, 100);
      setProgress(p);

      if (p >= 100) {
        stopScanner();
        const option = currentOptionsRef.current[activeIndexRef.current];
        if (option) {
          handleAction(option);
        }
      }
    }, 50);
  };

  useEffect(() => {
    if (isActive && cyberState !== "TYPE_URL" && cyberState !== "ANALYZING") {
      startScanner();
    } else {
      stopScanner();
    }
    return stopScanner;
  }, [isActive, cyberState, currentOptions.length]);

  useEffect(() => {
    if (cyberState === "SELECT_TARGET") {
      try {
        const saved = localStorage.getItem("blink_cyber_targets");
        if (saved) {
          const parsed = JSON.parse(saved);
          setSavedTargets(parsed.map((t: any) => ({ label: t.name, value: t.name })));
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [cyberState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || !isActive || e.code !== "Space" || cyberState === "TYPE_URL" || cyberState === "ANALYZING") return;
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
  }, [isActive, cyberState]);

  useEffect(() => {
    if (isActive) {
      const el = document.getElementById(`cyber-option-${activeIndex}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeIndex, isActive, cyberState]);

  const analyzeTarget = async (url: string) => {
    setTargetUrl(url);
    setCyberState("ANALYZING");
    speak("Analyzing target for vulnerabilities...");
    try {
      const res = await fetch("/api/cyber-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, businessType, checkType })
      });

      if (!res.ok) {
        throw new Error("Failed to fetch cyber analysis");
      }

      const data = await res.json();
      setReportData(data);
      setCyberState("DASHBOARD");
      speak("Analysis complete. Dashboard generated.");
    } catch (err) {
      console.error(err);
      speak("Error during analysis");
      setCyberState("SELECT_BUSINESS");
    }
  };

  const downloadReport = async () => {
    try {
      const res = await fetch("/api/cyber-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportData, businessType, checkType, url: targetUrl })
      });
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "BlinkCyberShield_Report.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      speak("Download started");
    } catch (err) {
      console.error(err);
      speak("Error downloading report");
    }
  };

  const downloadImageReport = async () => {
    try {
      const element = document.getElementById("cyber-dashboard");
      if (!element) return;
      const canvas = await html2canvas(element, { backgroundColor: "#060B14" });
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "BlinkCyberShield_Report.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      speak("Image download started");
    } catch (err) {
      console.error("Error capturing image:", err);
      speak("Error downloading image");
    }
  };

  if (!isActive) return null;

  if (cyberState === "TYPE_URL") {
    return (
      <BlinkKeyboard
        isActive={true}
        onSubmit={analyzeTarget}
        onClose={() => setCyberState("SELECT_CHECK")}
        title={`Enter Business Name (e.g. "Starbucks") or hit PASTE`}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-[#060B14] text-white z-50 flex overflow-hidden font-sans">
      
      {/* LEFT SCANNER PANEL */}
      <div className="w-[450px] bg-[#0A111F] border-r border-green-900/30 flex flex-col p-8 shadow-2xl relative z-10">
        <div className="flex items-center gap-4 mb-12">
          <ShieldCheck className="w-12 h-12 text-emerald-500" />
          <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-emerald-400 to-cyan-500">
            BlinkCyber Shield
          </h1>
        </div>
        
        <p className="text-emerald-400 text-sm font-semibold tracking-wider uppercase mb-8">
          {cyberState === "SELECT_BUSINESS" ? "1. Select Business Type" :
           cyberState === "SELECT_CHECK" ? "2. Select Check Type" :
           cyberState === "SELECT_TARGET" ? "3. Select Saved Target" :
           cyberState === "ANALYZING" ? "4. Analyzing Target" :
           "Dashboard Options"}
        </p>

        <div className="flex-1 overflow-hidden relative">
          <div className="flex flex-col gap-3 absolute inset-0 overflow-y-auto pr-4 pb-20 custom-scrollbar">
            {currentOptions.map((opt, i) => {
              const isSelected = i === activeIndex;
              return (
                <div
                  id={`cyber-option-${i}`}
                  key={i}
                  className={`
                    flex-shrink-0 p-5 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden
                    ${isSelected ? 'bg-emerald-500/10 border-emerald-500' : 'bg-slate-800/50 border-slate-700/50'}
                  `}
                >
                  <span className={`relative z-10 font-semibold ${isSelected ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {opt.label}
                  </span>
                  {isSelected && (
                    <div 
                      className="absolute bottom-0 left-0 h-1.5 bg-gradient-to-r from-emerald-400 to-cyan-400"
                      style={{ width: `${progress}%`, transition: 'width 50ms linear' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-slate-500 text-xs font-medium px-2 relative z-20 pb-4">
          <span>Spacebar to Scan Down</span>
          <span>Timer to Select</span>
        </div>
      </div>

      {/* CENTER & RIGHT CONTENT PANEL */}
      <div className="flex-1 flex flex-col relative">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900 via-[#060B14] to-[#060B14] pointer-events-none" />
        
        {cyberState === "ANALYZING" && (
          <div className="flex-1 flex flex-col items-center justify-center relative z-10">
            <Search className="w-24 h-24 text-emerald-500 animate-pulse mb-8" />
            <h2 className="text-4xl font-black text-white mb-4">Scanning Target</h2>
            <p className="text-emerald-400 font-mono">Running ethical hygiene checks on {targetUrl}...</p>
          </div>
        )}

        {cyberState === "DASHBOARD" && reportData && (
          <div id="cyber-dashboard" className="flex-1 flex p-8 gap-8 overflow-hidden relative z-10">
            
            {/* CENTER: DASHBOARD SCORES */}
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-4 custom-scrollbar">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <h2 className="text-3xl font-black text-white">Cybersecurity Dashboard</h2>
                  <p className="text-slate-400">{businessType} | {targetUrl}</p>
                </div>
                <div className={`px-6 py-2 rounded-full font-bold border ${reportData.overallScore >= 75 ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : reportData.overallScore >= 50 ? 'bg-orange-500/10 border-orange-500 text-orange-400' : 'bg-red-500/10 border-red-500 text-red-400'}`}>
                  {reportData.overallScore >= 90 ? 'Highly Safe' : reportData.overallScore >= 75 ? 'Safe but Improve' : reportData.overallScore >= 50 ? 'Medium Risk' : reportData.overallScore >= 25 ? 'High Risk' : 'Critical Risk'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-slate-800/40 border border-slate-700 rounded-3xl p-8 flex flex-col items-center justify-center shadow-lg backdrop-blur-sm">
                  <span className="text-slate-400 font-medium mb-4">Overall Safety Score</span>
                  <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="8" />
                      <circle cx="50" cy="50" r="45" fill="none" 
                        stroke={reportData.overallScore >= 75 ? '#10b981' : reportData.overallScore >= 50 ? '#f59e0b' : '#ef4444'} 
                        strokeWidth="8" strokeDasharray="283" strokeDashoffset={283 - (283 * reportData.overallScore) / 100}
                        className="transition-all duration-1000" />
                    </svg>
                    <span className="absolute text-4xl font-black">{reportData.overallScore}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Website", score: reportData.websiteScore },
                    { label: "Email", score: reportData.emailScore },
                    { label: "Privacy", score: reportData.privacyScore },
                    { label: "WhatsApp", score: reportData.whatsappScore }
                  ].map((cat, idx) => (
                    <div key={idx} className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
                      <span className="text-slate-400 text-sm font-medium">{cat.label}</span>
                      <span className={`text-2xl font-bold ${cat.score >= 75 ? 'text-emerald-400' : cat.score >= 50 ? 'text-orange-400' : 'text-red-400'}`}>
                        {cat.score}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-2xl p-6">
                <h3 className="text-emerald-400 font-semibold mb-4 flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> Safe Points</h3>
                <ul className="space-y-2">
                  {reportData.safePoints?.map((pt: string, i: number) => (
                    <li key={i} className="text-emerald-100 text-sm flex items-start gap-2">
                      <span className="text-emerald-500 mt-1">•</span> {pt}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-red-900/20 border border-red-800/50 rounded-2xl p-6">
                <h3 className="text-red-400 font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Unsafe Points</h3>
                <ul className="space-y-2">
                  {reportData.unsafePoints?.map((pt: string, i: number) => (
                    <li key={i} className="text-red-100 text-sm flex items-start gap-2">
                      <span className="text-red-500 mt-1">•</span> {pt}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* RIGHT: FIXES & PROPOSAL */}
            <div className="w-96 flex flex-col gap-6 overflow-y-auto pr-4 custom-scrollbar">
              
              <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
                <h3 className="text-cyan-400 font-semibold mb-4">Priority Fixes</h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-red-400 text-xs font-bold uppercase">High Priority</span>
                    <ul className="mt-1">
                      {reportData.priorityFixes?.high?.map((f: string, i: number) => (
                        <li key={i} className="text-slate-300 text-sm">- {f}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-orange-400 text-xs font-bold uppercase">Medium Priority</span>
                    <ul className="mt-1">
                      {reportData.priorityFixes?.medium?.map((f: string, i: number) => (
                        <li key={i} className="text-slate-300 text-sm">- {f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4">Business Impact</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{reportData.businessImpact}</p>
              </div>

              <div className="bg-blue-900/20 border border-blue-800/50 rounded-2xl p-6">
                <h3 className="text-blue-400 font-semibold mb-4">Client Proposal</h3>
                <p className="text-blue-100 text-sm italic leading-relaxed whitespace-pre-wrap">{reportData.clientProposal}</p>
              </div>

            </div>
          </div>
        )}

        {(cyberState === "SELECT_BUSINESS" || cyberState === "SELECT_CHECK") && (
          <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-center px-12">
            <Lock className="w-32 h-32 text-slate-800 mb-8" />
            <h2 className="text-5xl font-black text-white mb-6">Ethical Auditing</h2>
            <p className="text-xl text-slate-400 max-w-2xl leading-relaxed">
              Generate non-invasive cybersecurity hygiene reports. Protect small businesses, identify risks, and export PowerBI-style PDF proposals for your clients.
            </p>
            <div className="mt-12 p-6 bg-slate-800/50 border border-slate-700 rounded-2xl max-w-xl">
              <p className="text-slate-400 text-sm leading-relaxed">
                <span className="text-red-400 font-bold">DISCLAIMER:</span> This is a basic non-invasive cybersecurity hygiene check. It does not guarantee complete security. Advanced penetration testing should be done only with written permission by trained cybersecurity professionals.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
