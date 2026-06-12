"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Brain, Trophy, Clock, X, MessageSquare, Play, Volume2, Shield } from "lucide-react";

interface BlinkDebateArenaProps {
  isActive: boolean;
  onExit: () => void;
  speak: (text: string) => void;
}

type DebatePhase = "HOME" | "TOPIC_SELECT" | "SIDE_SELECT" | "DEBATE" | "JUDGEMENT";
type Side = "For" | "Against";

interface ReplyOption {
  type: string;
  text: string;
}

const TOPICS = [
  "AI is good for education",
  "Online degree vs offline degree",
  "Should exams be replaced by projects?",
  "Is social media harmful?",
  "Should India invest more in AI?",
  "Are robots better than humans in healthcare?",
  "Is technology making people lazy?",
  "Should coding be taught in school?",
  "Should plastic be banned?",
  "Is remote work better than office work?"
];

const AUTO_SELECT_MS = 2000;
const DEBATE_DURATION = 120; // 2 minutes in seconds
const TURN_DURATION = 20; // 20 seconds opponent time limit

export default function BlinkDebateArena({ isActive, onExit, speak }: BlinkDebateArenaProps) {
  const [phase, setPhase] = useState<DebatePhase>("HOME");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [userSide, setUserSide] = useState<Side | null>(null);
  
  // Debate State
  const [timeLeft, setTimeLeft] = useState(DEBATE_DURATION);
  const [isOpponentTurn, setIsOpponentTurn] = useState(true);
  const [opponentTurnTimeLeft, setOpponentTurnTimeLeft] = useState(TURN_DURATION);
  const [opponentText, setOpponentText] = useState("");
  const opponentTextRef = useRef("");
  useEffect(() => { opponentTextRef.current = opponentText; }, [opponentText]);
  
  const [transcript, setTranscript] = useState<{speaker: string, text: string}[]>([]);
  const transcriptRef = useRef<{speaker: string, text: string}[]>([]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  
  // Reply Options State
  const [replyOptions, setReplyOptions] = useState<ReplyOption[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isJudging, setIsJudging] = useState(false);
  const [scorecard, setScorecard] = useState<any>(null);

  // Scanner State
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<any>(null);
  
  // Refs for current states used in event listeners
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const replyOptionsRef = useRef(replyOptions);
  replyOptionsRef.current = replyOptions;
  const isOpponentTurnRef = useRef(isOpponentTurn);
  isOpponentTurnRef.current = isOpponentTurn;

  // Speech Recognition
  const recognitionRef = useRef<any>(null);

  // Audio BGM
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Play suspenseful background music at very low volume
    audioRef.current = new Audio("https://cdn.pixabay.com/download/audio/2022/10/25/audio_51bfdae016.mp3?filename=dark-ambient-suspense-123497.mp3");
    audioRef.current.loop = true;
    audioRef.current.volume = 0.05;
    if (isActive) {
      audioRef.current.play().catch(() => {});
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isActive]);

  const initRecognition = useCallback(() => {
    if (typeof window !== "undefined" && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-IN';
      
      recognitionRef.current.onresult = (event: any) => {
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          }
        }
        if (final) {
          setOpponentText(prev => prev + " " + final);
        }
      };
      
      recognitionRef.current.onerror = (e: any) => {
        if (e.error === "no-speech") return;
        console.warn("Speech Rec Info:", e.error);
      };
      
      recognitionRef.current.onend = () => {
        if (isOpponentTurnRef.current && phaseRef.current === "DEBATE") {
          try { recognitionRef.current.start(); } catch (e) {}
        }
      };
    }
  }, []);

  useEffect(() => {
    initRecognition();
  }, [initRecognition]);

  // Main Debate Timer
  useEffect(() => {
    if (phase !== "DEBATE") return;
    
    const debateTimer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(debateTimer);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(debateTimer);
  }, [phase]);

  // Opponent Turn Timer
  useEffect(() => {
    if (phase !== "DEBATE" || !isOpponentTurn) return;
    
    const turnTimer = setInterval(() => {
      setOpponentTurnTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(turnTimer);
          finishOpponentTurn();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(turnTimer);
  }, [phase, isOpponentTurn]);

  const handleTimeUp = async () => {
    setPhase("JUDGEMENT");
    speak("Debate completed. Generating judgement.");
    setIsJudging(true);
    
    try {
      const currentTranscript = transcriptRef.current;
      const res = await fetch("/api/judge-debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedTopic,
          userSide: userSide,
          opponentTranscript: currentTranscript.filter(t => t.speaker === "Opponent").map(t => t.text).join(" "),
          userReplies: currentTranscript.filter(t => t.speaker === "User").map(t => t.text).join(" "),
          language: "en-IN"
        })
      });
      const data = await res.json();
      setScorecard(data);
      
      if (data.winner === "Disabled User") {
        speak(`Congratulations! You won the debate with a score of ${data.userScore}`);
      } else {
        speak(`The Opponent won the debate with a score of ${data.opponentScore}`);
      }
    } catch (e) {
      console.error(e);
      speak("Error generating judgement.");
    } finally {
      setIsJudging(false);
    }
  };

  const finishOpponentTurn = async () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    
    setIsOpponentTurn(false);
    const finalOpponentText = opponentTextRef.current.trim() || "The opponent remained silent.";
    setTranscript(prev => [...prev, { speaker: "Opponent", text: finalOpponentText }]);
    
    speak("Opponent argument heard. Generating replies.");
    setIsGenerating(true);
    
    try {
      const res = await fetch("/api/generate-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedTopic,
          userSide: userSide,
          opponentText: finalOpponentText
        })
      });
      const data = await res.json();
      setReplyOptions(data.replies);
      speak("Four reply options are ready.");
      setActiveIndex(0);
      startScanner();
    } catch(e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const selectReply = (reply: ReplyOption) => {
    stopScanner();
    setTranscript(prev => [...prev, { speaker: "User", text: reply.text }]);
    speak(reply.text);
    setReplyOptions([]);
    
    // Calculate dynamic timeout based on text length (approx 70ms per character + 1s buffer)
    const speakDuration = Math.max(4000, reply.text.length * 70 + 1000);
    
    // After speaking, it's opponent's turn again
    setTimeout(() => {
      setIsOpponentTurn(true);
      setOpponentTurnTimeLeft(TURN_DURATION);
      setOpponentText("");
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch(e){}
      }
    }, speakDuration); 
  };

  const playMoveSound = useCallback((index: number) => {
    try {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
      const freq = pentatonic[index % pentatonic.length];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  }, []);

  const moveNext = useCallback(() => {
    setActiveIndex((current) => {
      let maxOptions = 0;
      if (phaseRef.current === "HOME") maxOptions = 2; // Start, Exit
      else if (phaseRef.current === "TOPIC_SELECT") maxOptions = TOPICS.length;
      else if (phaseRef.current === "SIDE_SELECT") maxOptions = 2; // For, Against
      else if (phaseRef.current === "DEBATE" && !isOpponentTurnRef.current && replyOptionsRef.current.length > 0) maxOptions = replyOptionsRef.current.length;
      else if (phaseRef.current === "JUDGEMENT" && scorecard) maxOptions = 1; // Exit

      if (maxOptions === 0) return 0;
      
      const next = (current + 1) % maxOptions;
      playMoveSound(next);
      
      // Start the 2-second selection timer for the new option
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);

      setProgress(0);
      let startTime = Date.now();

      intervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const p = Math.min((elapsed / AUTO_SELECT_MS) * 100, 100);
        setProgress(p);
      }, 50);

      timerRef.current = window.setTimeout(() => {
        // Auto SELECT when timer finishes (Dwell Select)
        if (handleSelectRef.current) handleSelectRef.current();
      }, AUTO_SELECT_MS);

      return next;
    });
  }, [playMoveSound, scorecard]);

  const startScanner = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (intervalRef.current) window.clearInterval(intervalRef.current);

    setProgress(0);
    let startTime = Date.now();

    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min((elapsed / AUTO_SELECT_MS) * 100, 100);
      setProgress(p);
    }, 50);

    timerRef.current = window.setTimeout(() => {
      // Auto SELECT when timer finishes (Dwell Select)
      if (handleSelectRef.current) handleSelectRef.current();
    }, AUTO_SELECT_MS);
  }, []);

  const stopScanner = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setProgress(0);
  };

  const handleSelect = useCallback(() => {
    if (phaseRef.current === "HOME") {
      if (activeIndexRef.current === 0) {
        setPhase("TOPIC_SELECT");
        setActiveIndex(0);
        speak("Select a topic");
        startScanner();
      } else {
        onExit();
      }
    } else if (phaseRef.current === "TOPIC_SELECT") {
      setSelectedTopic(TOPICS[activeIndexRef.current]);
      setPhase("SIDE_SELECT");
      setActiveIndex(0);
      speak("Choose your side. For, or Against.");
      startScanner();
    } else if (phaseRef.current === "SIDE_SELECT") {
      setUserSide(activeIndexRef.current === 0 ? "For" : "Against");
      setPhase("DEBATE");
      setIsOpponentTurn(true);
      setOpponentTurnTimeLeft(TURN_DURATION);
      setOpponentText("");
      stopScanner();
      speak("Debate started. Opponent speaking.");
      setTimeout(() => {
        if (recognitionRef.current && isOpponentTurnRef.current && phaseRef.current === "DEBATE") {
          try { recognitionRef.current.start(); } catch(e){}
        }
      }, 3000);
    } else if (phaseRef.current === "DEBATE" && !isOpponentTurnRef.current && replyOptionsRef.current.length > 0) {
      selectReply(replyOptionsRef.current[activeIndexRef.current]);
    } else if (phaseRef.current === "JUDGEMENT" && scorecard) {
      onExit();
    }
  }, [onExit, speak, startScanner, scorecard]);

  const handleSelectRef = useRef(handleSelect);
  useEffect(() => {
    handleSelectRef.current = handleSelect;
  }, [handleSelect]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        // Spacebar now triggers MOVEMENT instead of selection!
        moveNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveNext]);

  useEffect(() => {
    if (phase === "HOME") {
      startScanner();
    }
  }, [phase, startScanner]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col font-sans overflow-hidden">
      {/* Background Textures */}
      <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[length:32px_32px]" />
      
      {/* Header */}
      <div className="relative z-10 w-full p-6 flex justify-between items-center border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="bg-amber-500/20 p-3 rounded-full border border-amber-500/50">
            <MessageSquare className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-600 tracking-tight">
              BlinkDebate Arena
            </h1>
            <p className="text-amber-500/60 font-bold uppercase tracking-[0.2em] text-xs">Debate with one blink</p>
          </div>
        </div>
        <button onClick={onExit} className="p-3 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors">
          <X className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 flex flex-col relative z-10 p-6 overflow-hidden items-center justify-center">
        
        {phase === "HOME" && (
          <div className="flex flex-col gap-6 w-full max-w-md">
            <h2 className="text-4xl font-black text-white text-center mb-8">Ready to Debate?</h2>
            {["Start Debate", "Exit"].map((label, i) => (
              <div key={label} className={`relative p-6 rounded-2xl border-2 transition-all ${activeIndex === i ? 'bg-amber-500/20 border-amber-500 scale-105 shadow-[0_0_30px_rgba(245,158,11,0.3)]' : 'bg-white/5 border-white/10'}`}>
                <div className="text-2xl font-bold text-center text-white">{label}</div>
                {activeIndex === i && (
                  <div className="absolute bottom-0 left-0 h-1 bg-amber-500" style={{ width: `${progress}%`, transition: 'width 50ms linear' }} />
                )}
              </div>
            ))}
          </div>
        )}

        {phase === "TOPIC_SELECT" && (
          <div className="flex flex-col w-full max-w-4xl h-full">
            <h2 className="text-3xl font-bold text-white mb-6 text-center">Select a Topic</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pb-20 px-4">
              {TOPICS.map((topic, i) => {
                const isActive = activeIndex === i;
                // Auto-scroll logic
                if (isActive && typeof document !== "undefined") {
                  document.getElementById(`topic-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return (
                  <div id={`topic-${i}`} key={i} className={`relative p-6 rounded-2xl border-2 transition-all ${isActive ? 'bg-blue-500/20 border-blue-500 scale-[1.02] shadow-[0_0_30px_rgba(59,130,246,0.3)]' : 'bg-white/5 border-white/10'}`}>
                    <div className="text-xl font-bold text-white">{topic}</div>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 h-1 bg-blue-500" style={{ width: `${progress}%`, transition: 'width 50ms linear' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {phase === "SIDE_SELECT" && (
          <div className="flex flex-col gap-6 w-full max-w-2xl">
            <h2 className="text-3xl font-bold text-white text-center mb-8">Choose Your Side</h2>
            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-8">
              <p className="text-xl text-center text-amber-400 font-medium">{selectedTopic}</p>
            </div>
            <div className="flex gap-6 w-full">
              {["FOR", "AGAINST"].map((label, i) => (
                <div key={label} className={`flex-1 relative p-8 rounded-2xl border-2 transition-all ${activeIndex === i ? 'bg-green-500/20 border-green-500 scale-105 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'bg-white/5 border-white/10'}`}>
                  <div className="text-3xl font-bold text-center text-white">{label}</div>
                  {activeIndex === i && (
                    <div className="absolute bottom-0 left-0 h-1 bg-green-500" style={{ width: `${progress}%`, transition: 'width 50ms linear' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === "DEBATE" && (
          <div className="w-full max-w-6xl h-full flex flex-col md:flex-row gap-6 relative">
            
            {/* Center / Left Panel: Opponent & Timer */}
            <div className="flex-1 flex flex-col gap-6">
              {/* Main Timer */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex justify-between items-center shadow-lg">
                <div>
                  <h3 className="text-amber-500 font-bold uppercase tracking-widest text-xs mb-1">Debate Time</h3>
                  <div className="text-4xl font-mono font-black text-white flex items-center gap-3">
                    <Clock className="w-8 h-8 text-amber-500" />
                    {formatTime(timeLeft)}
                  </div>
                </div>
                <div className="text-right">
                  <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">Topic</h3>
                  <div className="text-lg font-bold text-slate-200">{selectedTopic}</div>
                  <div className="text-sm font-medium text-amber-500">You are: {userSide}</div>
                </div>
              </div>

              {/* Opponent Listening Area */}
              <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col relative overflow-hidden">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 shadow-inner transition-all ${isOpponentTurn ? 'bg-blue-500/20 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 'bg-slate-800 border-slate-700'}`}>
                    <Mic className={`w-8 h-8 ${isOpponentTurn ? 'text-blue-400 animate-pulse' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">Opponent</h2>
                    <p className={`text-sm font-bold ${isOpponentTurn ? 'text-blue-400' : 'text-slate-500'}`}>
                      {isOpponentTurn ? `Speaking... (${opponentTurnTimeLeft}s left)` : "Waiting"}
                    </p>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto text-xl text-slate-300 font-medium leading-relaxed">
                  {isOpponentTurn ? (
                    <span className="text-white bg-blue-500/10 p-2 rounded">{opponentText || "Listening to opponent..."}</span>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {transcript.map((msg, idx) => (
                        <div key={idx} className={`p-4 rounded-xl ${msg.speaker === "User" ? 'bg-amber-500/10 border border-amber-500/20 ml-12 text-amber-100' : 'bg-white/5 border border-white/10 mr-12 text-slate-300'}`}>
                          <span className="text-xs font-bold uppercase block mb-1 opacity-50">{msg.speaker}</span>
                          {msg.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {isOpponentTurn && (
                  <button onClick={finishOpponentTurn} className="mt-4 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg">
                    Skip Turn (Testing)
                  </button>
                )}
              </div>
            </div>

            {/* Right Panel: Reply Options */}
            <div className="flex-1 flex flex-col gap-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 relative">
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 shadow-inner transition-all ${!isOpponentTurn ? 'bg-green-500/20 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'bg-slate-800 border-slate-700'}`}>
                  <Brain className={`w-6 h-6 ${!isOpponentTurn ? 'text-green-400' : 'text-slate-500'}`} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">Your Replies</h2>
                  <p className={`text-sm font-bold ${!isOpponentTurn ? 'text-green-400' : 'text-slate-500'}`}>
                    {isGenerating ? "AI Generating..." : !isOpponentTurn ? "Select your response" : "Waiting for opponent"}
                  </p>
                </div>
              </div>

              {isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center text-amber-500">
                   <Shield className="w-16 h-16 animate-bounce mb-4 opacity-50" />
                   <h3 className="text-2xl font-bold animate-pulse">Analyzing Argument...</h3>
                </div>
              ) : replyOptions.length > 0 && !isOpponentTurn ? (
                <div className="flex flex-col gap-4 flex-1">
                  {replyOptions.map((opt, i) => {
                    const isActive = activeIndex === i;
                    return (
                      <div key={i} className={`flex-1 relative p-4 rounded-xl border-2 transition-all flex flex-col justify-center overflow-hidden ${isActive ? 'bg-green-500/20 border-green-500 scale-[1.02] shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'bg-black/40 border-white/5'}`}>
                        <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isActive ? 'text-green-400' : 'text-slate-500'}`}>{opt.type}</span>
                        <div className={`text-lg font-medium leading-snug ${isActive ? 'text-white' : 'text-slate-400'}`}>{opt.text}</div>
                        {isActive && (
                          <div className="absolute bottom-0 left-0 h-1 bg-green-500" style={{ width: `${progress}%`, transition: 'width 50ms linear' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-lg font-medium text-center">
                  Replies will appear here automatically when the opponent finishes speaking.
                </div>
              )}
            </div>
            
          </div>
        )}

        {phase === "JUDGEMENT" && (
          <div className="w-full max-w-7xl bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            {isJudging ? (
              <div className="py-20 flex flex-col items-center text-center">
                <Trophy className="w-24 h-24 text-amber-500 animate-pulse mb-6 drop-shadow-[0_0_30px_rgba(245,158,11,0.5)]" />
                <h2 className="text-4xl font-black text-white mb-4">AI is judging the debate...</h2>
                <p className="text-xl text-slate-400">Analyzing logic, evidence, and emotional impact</p>
              </div>
            ) : scorecard ? (
              <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-10 duration-700">
                <div className="text-center mb-8 border-b border-white/10 pb-8">
                  <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-600 mb-2">
                    {scorecard.winner} Wins!
                  </h2>
                  <p className="text-xl text-slate-300 italic">"{scorecard.reason}"</p>
                </div>

                <div className="flex justify-between items-center mb-8 gap-8">
                  <div className="flex-1 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6 text-center">
                    <h3 className="text-blue-400 font-black uppercase tracking-widest text-sm mb-2">Opponent Score</h3>
                    <div className="text-6xl font-black text-white">{scorecard.opponentScore}</div>
                  </div>
                  <div className="flex-1 bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center relative overflow-hidden">
                    <h3 className="text-green-400 font-black uppercase tracking-widest text-sm mb-2">Your Score</h3>
                    <div className="text-6xl font-black text-white">{scorecard.userScore}</div>
                    {scorecard.winner === "Disabled User" && (
                       <div className="absolute inset-0 bg-green-500/20 animate-pulse z-0 pointer-events-none" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-y-auto mb-6">
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <h4 className="text-amber-500 font-bold uppercase text-xs tracking-widest mb-2">Your Best Line</h4>
                    <p className="text-white italic">"{scorecard.bestUserLine}"</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <h4 className="text-amber-500 font-bold uppercase text-xs tracking-widest mb-2">Opponent Best Line</h4>
                    <p className="text-white italic">"{scorecard.bestOpponentLine}"</p>
                  </div>
                  <div className="md:col-span-2 bg-white/5 rounded-xl p-5 border border-white/10">
                    <h4 className="text-amber-500 font-bold uppercase text-xs tracking-widest mb-2">Areas for Improvement</h4>
                    <ul className="list-disc list-inside text-slate-300">
                      {scorecard.improvements?.map((imp: string, i: number) => (
                        <li key={i}>{imp}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className={`relative p-6 rounded-2xl border-2 transition-all bg-amber-500/20 border-amber-500 text-center shadow-[0_0_30px_rgba(245,158,11,0.3)]`}>
                  <div className="text-2xl font-bold text-white">Exit Arena</div>
                  <div className="absolute bottom-0 left-0 h-1 bg-amber-500" style={{ width: `${progress}%`, transition: 'width 50ms linear' }} />
                </div>
              </div>
            ) : null}
          </div>
        )}
        
      </div>
    </div>
  );
}
