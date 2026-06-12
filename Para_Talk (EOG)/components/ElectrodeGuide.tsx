"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, Cable, X } from "lucide-react";

export default function ElectrodeGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative z-50">
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[14px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:shadow-sm transition-all border border-indigo-100"
      >
        <Cable className="h-5 w-5 drop-shadow-sm" />
        Electrode Setup
      </button>

      {/* Popover Guide */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute top-full right-0 mt-4 w-[500px] bg-white rounded-[28px] shadow-[0_20px_60px_rgba(15,76,129,0.15)] border border-slate-100 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-500 p-5 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Cable className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">EOG Electrode Setup</h3>
                  <p className="text-indigo-100 text-xs font-medium uppercase tracking-wider">Female Placement Guide</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex gap-6 items-center bg-slate-50">
              
              {/* Graphic Diagram */}
              <div className="relative w-48 h-56 shrink-0 bg-white rounded-[20px] shadow-sm border border-slate-200 overflow-hidden flex items-center justify-center">
                <svg viewBox="0 0 200 240" className="w-full h-full">
                  {/* Body */}
                  <path d="M50 240 Q 50 170 100 170 Q 150 170 150 240" fill="#e2e8f0" />
                  {/* Neck */}
                  <rect x="85" y="130" width="30" height="50" fill="#e2e8f0" />
                  {/* Hair Background (Female style) */}
                  <path d="M 55 90 C 55 30 145 30 145 90 C 145 140 120 150 100 150 C 80 150 55 140 55 90 Z" fill="#cbd5e1" />
                  {/* Head / Face */}
                  <circle cx="100" cy="90" r="40" fill="#e2e8f0" />
                  
                  {/* Wires */}
                  {/* Black Wire (Above Eye) */}
                  <path d="M 115 75 C 140 60 170 100 170 240" fill="none" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="4 4" className="animate-[dash_20s_linear_infinite]" />
                  
                  {/* Red Wire (Below Eye) */}
                  <path d="M 115 105 C 140 120 155 150 155 240" fill="none" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="4 4" className="animate-[dash_20s_linear_infinite]" />
                  
                  {/* Yellow Wire (Behind Ear) */}
                  <path d="M 140 95 C 160 95 180 130 180 240" fill="none" stroke="#eab308" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="4 4" className="animate-[dash_20s_linear_infinite]" />

                  {/* Electrodes */}
                  {/* IN+ (Black - Above Eye) */}
                  <circle cx="115" cy="75" r="7" fill="white" stroke="#1e293b" strokeWidth="3" />
                  <circle cx="115" cy="75" r="3" fill="#1e293b" className="animate-pulse" />

                  {/* IN- (Red - Below Eye) */}
                  <circle cx="115" cy="105" r="7" fill="white" stroke="#ef4444" strokeWidth="3" />
                  <circle cx="115" cy="105" r="3" fill="#ef4444" className="animate-pulse" />

                  {/* REF (Yellow - Behind Ear) */}
                  <circle cx="140" cy="95" r="7" fill="white" stroke="#eab308" strokeWidth="3" />
                  <circle cx="140" cy="95" r="3" fill="#eab308" className="animate-pulse" />
                </svg>

                <style dangerouslySetInnerHTML={{__html: `
                  @keyframes dash { to { stroke-dashoffset: -1000; } }
                `}} />
              </div>

              {/* Instructions text */}
              <div className="flex-1 space-y-4">
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex gap-3 shadow-sm">
                  <div className="h-4 w-4 shrink-0 rounded-full bg-slate-800 border-2 border-white shadow-sm mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">1. Above Eye (IN+)</p>
                    <p className="text-xs text-slate-600 mt-1">Place the <strong className="text-slate-700">Black</strong> wire electrode roughly 1 inch above the right eyebrow.</p>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-3 shadow-sm">
                  <div className="h-4 w-4 shrink-0 rounded-full bg-red-500 border-2 border-white shadow-sm mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">2. Below Eye (IN-)</p>
                    <p className="text-xs text-slate-600 mt-1">Place the <strong className="text-red-600">Red</strong> wire electrode on the cheekbone directly below the right eye.</p>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex gap-3 shadow-sm">
                  <div className="h-4 w-4 shrink-0 rounded-full bg-yellow-400 border-2 border-white shadow-sm mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">3. Behind Ear (REF)</p>
                    <p className="text-xs text-slate-600 mt-1">Place the <strong className="text-yellow-600">Yellow</strong> wire electrode on the bony area behind the ear (Mastoid).</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 border-t border-slate-100 flex gap-3 items-center">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-full">
                <Info className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-slate-500">
                Connect the wires to the <strong className="text-slate-700">BioAmp EXG Pill</strong>. Use medical-grade gel electrodes and clean the skin with an alcohol swab before application for best signal quality.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
