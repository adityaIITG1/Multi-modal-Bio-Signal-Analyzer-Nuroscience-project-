import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, X, Video, ChevronDown, Eye } from 'lucide-react';

interface BlinkYouTubeProps {
  onExit: () => void;
}

import { Loader2 } from 'lucide-react';

const SCANNER_DURATION = 2000;
const INTERVAL_TIME = 50;

export default function BlinkYouTube({ onExit }: BlinkYouTubeProps) {
  const [videoIds, setVideoIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [scannerProgress, setScannerProgress] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  
  const scannerIntervalRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const idleBlinkCountRef = useRef(0);

  const playSound = (type: 'tick' | 'select' | 'swipe') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      if (type === 'tick') {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
      } else if (type === 'select') {
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'swipe') {
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
      }
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
    } catch (e) {
      // ignore
    }
  };

  const scheduleSelect = useCallback(() => {
    if (scannerIntervalRef.current) window.clearInterval(scannerIntervalRef.current);
    if (isIdle) return; // Do not scan if idle
    
    const step = (INTERVAL_TIME / SCANNER_DURATION) * 100;
    setScannerProgress(0);
    
    scannerIntervalRef.current = window.setInterval(() => {
      setScannerProgress(prev => {
        if (prev >= 100) {
          window.clearInterval(scannerIntervalRef.current!);
          return 100;
        }
        return prev + step;
      });
    }, INTERVAL_TIME);
  }, [isIdle]);

  const fetchMoreVideos = async () => {
    try {
      const res = await fetch('/api/shorts-feed');
      const data = await res.json();
      if (data.videos && data.videos.length > 0) {
        setVideoIds(prev => {
          const newIds = data.videos.filter((id: string) => !prev.includes(id));
          return [...prev, ...newIds];
        });
      }
    } catch (e) {}
  };

  useEffect(() => {
    // Initial fetch
    fetch('/api/shorts-feed')
      .then(r => r.json())
      .then(data => {
        if (data.videos && data.videos.length > 0) {
          setVideoIds(data.videos);
        } else {
          // Fallback just in case
          setVideoIds(["dQw4w9WgXcQ", "jNQXAC9IVRw"]);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setVideoIds(["dQw4w9WgXcQ", "jNQXAC9IVRw"]);
        setIsLoading(false);
      });
  }, []);

  const handleAction = useCallback(() => {
    if (isLoading || videoIds.length === 0) return;
    playSound('select');
    if (activeIndex === 0) {
      // Scroll Next
      setIsScrolling(true);
      playSound('swipe');
      
      // Fetch more if we're getting close to the end
      if (currentIndex >= videoIds.length - 5) {
        fetchMoreVideos();
      }

      setTimeout(() => {
        setCurrentIndex(c => (c + 1) % videoIds.length);
        setIsPlaying(true);
        setIsScrolling(false);
        scheduleSelect(); // restart scanner
      }, 300); // Swipe animation duration
    } else if (activeIndex === 1) {
      // Play / Pause
      const newState = !isPlaying;
      setIsPlaying(newState);
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: newState ? 'playVideo' : 'pauseVideo' }),
          '*'
        );
      }
      setScannerProgress(0); // Optional: wait for next input
    } else if (activeIndex === 2) {
      // Watch Mode (Idle)
      setIsIdle(true);
      idleBlinkCountRef.current = 0; // reset blink count when entering idle mode
      setScannerProgress(0);
      if (scannerIntervalRef.current) window.clearInterval(scannerIntervalRef.current);
    } else if (activeIndex === 3) {
      // Exit
      onExit();
    }
  }, [activeIndex, isPlaying, onExit, scheduleSelect]);

  useEffect(() => {
    if (scannerProgress >= 100) {
      handleAction();
    }
  }, [scannerProgress, handleAction]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        
        if (isIdle) {
          idleBlinkCountRef.current += 1;
          
          // Require 2 blinks to wake up
          if (idleBlinkCountRef.current >= 2) {
            idleBlinkCountRef.current = 0;
            setIsIdle(false);
            playSound('tick');
            setActiveIndex(0);
          } else {
            // Play a subtle tick for the first blink so user knows it registered
            playSound('tick');
          }
          return;
        }

        idleBlinkCountRef.current = 0; // Reset just in case
        playSound('tick');
        setActiveIndex(curr => (curr + 1) % 4); // Now 4 options
        scheduleSelect();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    // Start initial scan if not idle
    if (!isIdle) scheduleSelect();
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (scannerIntervalRef.current) window.clearInterval(scannerIntervalRef.current);
    };
  }, [scheduleSelect]);

  const controls = [
    { label: "Scroll Next", icon: ChevronDown, color: "bg-blue-500" },
    { label: isPlaying ? "Pause" : "Play", icon: isPlaying ? Pause : Play, color: "bg-amber-500" },
    { label: "Watch (Hide Controls)", icon: Eye, color: "bg-purple-500" },
    { label: "Exit Shorts", icon: X, color: "bg-red-500" }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center font-sans overflow-hidden">
      
      {/* Background Blur Effect */}
      {!isLoading && videoIds.length > 0 && (
      <div className="absolute inset-0 z-0 opacity-40 blur-3xl scale-110">
         <iframe 
            src={`https://www.youtube.com/embed/${videoIds[currentIndex]}?enablejsapi=1&autoplay=1&controls=0&mute=1&loop=1&playlist=${videoIds[currentIndex]}`}
            className="w-full h-full pointer-events-none"
         />
      </div>
      )}

      <div className="relative z-10 w-full max-w-[600px] h-full max-h-[95vh] flex items-center justify-center">
        
        {/* Wrapper to hold the Phone Frame AND the Overlays securely */}
        <div className="relative w-full aspect-[9/16] shadow-2xl">
          
          {/* Phone Mockup Frame (Strictly for clipping the video) */}
          <div className="absolute inset-0 bg-slate-900 rounded-[40px] border-[8px] border-slate-800 overflow-hidden isolate">
            {/* Video Container with Swipe Animation */}
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              {isLoading || videoIds.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 text-white">
                  <Loader2 className="w-12 h-12 animate-spin text-red-500" />
                  <p className="font-bold">Fetching Live Shorts Feed...</p>
                </div>
              ) : (
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={currentIndex}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-100%", opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute inset-0"
                >
                  <iframe 
                    ref={iframeRef}
                    id="yt-player"
                    src={`https://www.youtube.com/embed/${videoIds[currentIndex]}?enablejsapi=1&autoplay=1&controls=0&modestbranding=1&rel=0&showinfo=0&loop=1&playlist=${videoIds[currentIndex]}`}
                    allow="autoplay; encrypted-media"
                    className="w-full h-full pointer-events-none"
                    style={{ border: 'none' }}
                  />
                  
                  {/* Overlay to prevent clicking iframe */}
                  <div className="absolute inset-0 z-10 pointer-events-auto" />
                  
                  {/* Bottom Aesthetic Gradient overlay */}
                  <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent z-20 pointer-events-none" />
                </motion.div>
              </AnimatePresence>
              )}
            </div>
          </div>

          {/* Shorts Header (OUTSIDE overflow-hidden to bypass WebKit z-index bugs) */}
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/90 via-black/50 to-transparent z-[100] flex items-start pt-8 px-8 pointer-events-none rounded-t-[40px]">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-8 h-8 text-red-500 fill-current drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                <path d="M17.77,10.32l-1.2-.54L17.53,9.3A4.95,4.95,0,0,0,20,4.9a5,5,0,0,0-5-5,4.92,4.92,0,0,0-4.4,2.77L3.1,15.77a5.05,5.05,0,0,0,2.37,6.86,4.92,4.92,0,0,0,4.4-2.77l1.2.54-.96.48a4.95,4.95,0,0,0-2.47,4.4A5,5,0,0,0,12.64,24,4.92,4.92,0,0,0,17.04,21.23l7.5-13.1a5.05,5.05,0,0,0-2.37-6.86A5.12,5.12,0,0,0,17.77,10.32Zm-7.77,5.68V9l6,3.5-6,3.5Z" />
              </svg>
              <span className="text-white font-extrabold text-2xl tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Shorts</span>
            </div>
          </div>

          {/* Blink Controls Panel overlayed on right side (OUTSIDE overflow-hidden) */}
          {!isIdle && (
            <div className="absolute bottom-16 right-4 z-[100] flex flex-col gap-4">
              {controls.map((ctrl, i) => {
              const isSelected = activeIndex === i;
              const Icon = ctrl.icon;
              return (
                <div key={i} className="relative group">
                  <div className={`
                    w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300
                    ${isSelected ? 'bg-white scale-110' : 'bg-black/60 backdrop-blur-md'}
                  `}>
                    <Icon className={`w-6 h-6 ${isSelected ? 'text-black' : 'text-white'}`} />
                  </div>
                  
                  {/* Label Tooltip */}
                  {isSelected && (
                    <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-white text-black font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
                      {ctrl.label}
                    </div>
                  )}

                  {/* Progress Indicator */}
                  {isSelected && (
                    <div className="absolute -inset-1 z-[-1] rounded-full overflow-hidden">
                       <svg className="w-full h-full transform -rotate-90">
                         <circle
                           cx="50%" cy="50%" r="48%"
                           className="stroke-amber-400 fill-none"
                           strokeWidth="4"
                           strokeDasharray="100 100"
                           strokeDashoffset={100 - scannerProgress}
                           pathLength="100"
                         />
                       </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}

        </div>
      </div>
    </div>
  );
}
