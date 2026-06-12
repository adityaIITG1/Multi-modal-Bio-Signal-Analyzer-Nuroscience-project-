import React from 'react';
import { motion } from 'framer-motion';

export function SingleSwitchScanner({ 
  children, 
  isFocused, 
  progress 
}: { 
  children: React.ReactNode, 
  isFocused: boolean, 
  progress: number 
}) {
  return (
    <div className={`relative p-5 mb-4 rounded-2xl transition-all duration-300 ${isFocused ? 'bg-cyan-900/60 border-2 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.4)] transform scale-[1.02]' : 'bg-slate-800/40 backdrop-blur-md border border-slate-700/50 hover:bg-slate-800/60'}`}>
      {children}
      
      {/* 2-Second Dwell Indicator Overlay */}
      {isFocused && (
        <div className="absolute top-0 left-0 h-1 bg-cyan-400 rounded-t-xl" style={{ width: `${progress}%`, transition: 'width 50ms linear' }} />
      )}
      
      {/* Circular Indicator for visual confirmation */}
      {isFocused && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
          <svg className="w-8 h-8 transform -rotate-90">
            <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-700" />
            <circle 
              cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="4" fill="transparent" 
              strokeDasharray="88" strokeDashoffset={88 - (progress / 100) * 88}
              className="text-cyan-400 transition-all duration-75" 
            />
          </svg>
        </div>
      )}
    </div>
  );
}
