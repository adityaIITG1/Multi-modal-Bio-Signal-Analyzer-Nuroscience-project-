"use client";

import React, { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Play, Brain, Shield, Settings, Volume2, Save, Undo, Eye, RotateCcw } from "lucide-react";

interface BlinkChessProps {
  isActive: boolean;
  onExit: () => void;
  speak: (text: string) => void;
}

type MenuState = "MAIN_MENU" | "DIFFICULTY" | "PLAYING" | "GAME_OVER" | "VOICE" | "COMING_SOON";

const AUTO_SELECT_MS = 2000;

const PIECE_IMAGES: Record<string, Record<string, string>> = {
  w: {
    k: "https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg",
    q: "https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg",
    r: "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg",
    b: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg",
    n: "https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg",
    p: "https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg"
  },
  b: {
    k: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg",
    q: "https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg",
    r: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg",
    b: "https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg",
    n: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg",
    p: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg"
  }
};

const calculateCapturedPieces = (chessInstance: any) => {
  const initialCounts: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
  const currentCountsW: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  const currentCountsB: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  
  const board = chessInstance.board();
  for (const row of board) {
    for (const piece of row) {
      if (piece) {
        if (piece.color === 'w') currentCountsW[piece.type]++;
        else currentCountsB[piece.type]++;
      }
    }
  }
  
  const capturedW: string[] = []; 
  const capturedB: string[] = []; 
  
  for (const type of ['q', 'r', 'b', 'n', 'p']) {
    const wDiff = initialCounts[type] - currentCountsW[type];
    for (let i = 0; i < wDiff; i++) capturedW.push(type);
    
    const bDiff = initialCounts[type] - currentCountsB[type];
    for (let i = 0; i < bDiff; i++) capturedB.push(type);
  }
  return { capturedW, capturedB };
};

const isSquareSafe = (chessInstance: any, from: string, to: string) => {
  try {
    const clone = new Chess(chessInstance.fen());
    clone.move({ from, to, promotion: 'q' } as any);
    const enemyMoves = clone.moves({ verbose: true }) as any[];
    return !enemyMoves.some(m => m.to === to);
  } catch {
    return false;
  }
};

export default function BlinkChessAIPro({ isActive, onExit, speak }: BlinkChessProps) {
  const [gameState, setGameState] = useState<MenuState>("MAIN_MENU");
  const [difficulty, setDifficulty] = useState(5);
  const [stockfishReady, setStockfishReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // --- AUDIO SYSTEM ---
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio("https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3");
    audioRef.current.loop = true;
    audioRef.current.volume = 0.15;
    if (bgmEnabled && isActive) {
      audioRef.current.play().catch(e => console.log("Audio autoplay prevented"));
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isActive, bgmEnabled]);

  const playSFX = (type: 'tick' | 'select' | 'move') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'tick') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } else if (type === 'select') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'move') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {}
  };

  const speakText = (enText: string, hiText: string, overrideLang?: "English" | "Hindi", onEnd?: () => void) => {
    const currentLang = overrideLang || languageRef.current;
    const text = currentLang === "English" ? enText : hiText;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (onEnd) {
        utterance.onend = onEnd;
      }
      if (currentLang === "Hindi") {
        utterance.lang = "hi-IN";
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        const voices = window.speechSynthesis.getVoices();
        const hiVoice = voices.find(v => v.lang.includes("hi-IN") && v.name.includes("Google")) 
                     || voices.find(v => v.lang.includes("hi-IN"));
        if (hiVoice) utterance.voice = hiVoice;
      } else {
        utterance.lang = "en-US";
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
      }
      window.speechSynthesis.speak(utterance);
    }
  };

  const getHindiMenuLabel = (id: string) => {
    const labels: any = {
      play: "AI ke khilaaf khele",
      difficulty: "Kathinai ka star",
      training: "Training mode",
      puzzle: "Puzzle mode",
      multiplayer: "Online multiplayer",
      save: "Game save ya load kare",
      voice: "Bhasha badle",
      eog: "EOG Blink Connect",
      accessibility: "Accessibility Settings",
      exit: "Chess se bahar nikle",
      diff_1: "Level 1 (Naya Khiladi)",
      diff_5: "Level 5 (Sikhandu)",
      diff_10: "Level 10 (Madhyam)",
      diff_15: "Level 15 (Uchch)",
      diff_20: "Level 20 (Grandmaster)",
      diff_back: "Main menu par wapas",
      lang_hi: "Hindi",
      lang_en: "English",
      lang_back: "Main menu par wapas"
    };
    return labels[id] || id;
  };

  // --- CHESS STATE ---
  const [language, setLanguage] = useState<"English" | "Hindi">("Hindi");
  const languageRef = useRef(language);
  languageRef.current = language;
  const [chess] = useState(new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [boardScanState, setBoardScanState] = useState<"IDLE" | "SCANNING" | "READING_VISION">("IDLE");
  const [scanSquareIndex, setScanSquareIndex] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [safeSquares, setSafeSquares] = useState<string[]>([]);
  const [dangerSquares, setDangerSquares] = useState<string[]>([]);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const boardScanStateRef = useRef(boardScanState);
  boardScanStateRef.current = boardScanState;
  const scanSquareIndexRef = useRef(scanSquareIndex);
  scanSquareIndexRef.current = scanSquareIndex;
  const selectedSquareRef = useRef(selectedSquare);
  selectedSquareRef.current = selectedSquare;
  const legalMovesRef = useRef(legalMoves);
  legalMovesRef.current = legalMoves;

  const mainMenuItems = [
    { id: "play", label: "Play vs AI", icon: Play },
    { id: "difficulty", label: "Difficulty", icon: Settings },
    { id: "training", label: "Training Mode", icon: Brain },
    { id: "puzzle", label: "Puzzle Mode", icon: Eye },
    { id: "multiplayer", label: "Online Multiplayer", icon: Shield },
    { id: "save", label: "Save / Load Game", icon: Save },
    { id: "voice", label: "Voice Language", icon: Volume2 },
    { id: "eog", label: "EOG Blink Connect", icon: Eye },
    { id: "accessibility", label: "Accessibility Settings", icon: Settings },
    { id: "exit", label: "Exit Chess", icon: RotateCcw }
  ];

  const difficultyMenuItems = [
    { id: "diff_1", label: "Level 1 (Beginner)", icon: Settings },
    { id: "diff_5", label: "Level 5 (Amateur)", icon: Settings },
    { id: "diff_10", label: "Level 10 (Intermediate)", icon: Settings },
    { id: "diff_15", label: "Level 15 (Advanced)", icon: Settings },
    { id: "diff_20", label: "Level 20 (Grandmaster)", icon: Settings },
    { id: "diff_back", label: "Back to Main Menu", icon: RotateCcw }
  ];

  const voiceMenuItems = [
    { id: "lang_hi", label: "Hindi", icon: Volume2 },
    { id: "lang_en", label: "English", icon: Volume2 },
    { id: "lang_back", label: "Back to Main Menu", icon: RotateCcw }
  ];

  const comingSoonItems = [
    { id: "coming_back", label: "Back to Main Menu", icon: RotateCcw }
  ];

  const currentOptions = gameState === "MAIN_MENU" ? mainMenuItems : 
                         gameState === "DIFFICULTY" ? difficultyMenuItems : 
                         gameState === "VOICE" ? voiceMenuItems : 
                         gameState === "COMING_SOON" ? comingSoonItems : [];
  
  const currentOptionsRef = useRef(currentOptions);
  currentOptionsRef.current = currentOptions;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const handleAction = (item: any) => {
    const hiLabel = getHindiMenuLabel(item.id);
    
    if (item.id === "exit") {
      speakText(`Exiting game`, `Game band kiya jaa raha hai`);
      onExit();
    } else if (item.id === "voice") {
      setGameState("VOICE");
      setActiveIndex(-1);
      speakText("Select Voice Language", "Bhasha chune");
    } else if (item.id.startsWith("lang_")) {
      if (item.id === "lang_back") {
        setGameState("MAIN_MENU");
        setActiveIndex(-1);
        speakText("Returned to Main Menu", "Main menu par wapas aa gaye");
      } else {
        const nextLang = item.id === "lang_en" ? "English" : "Hindi";
        setLanguage(nextLang);
        setGameState("MAIN_MENU");
        setActiveIndex(-1);
        if (nextLang === "Hindi") {
          speakText("", "Hindi bhasha chuni gayi", "Hindi");
        } else {
          speakText("English language selected", "", "English");
        }
      }
    } else if (item.id === "play") {
      chess.reset();
      setFen(chess.fen());
      setGameState("PLAYING");
      
      setBoardScanState("SCANNING");
      setScanSquareIndex(48); // A2 pawn
      setProgress(0);
      speakText("Game started against AI", "AI ke khilaaf game shuru hua");
    } else if (item.id === "difficulty") {
      setGameState("DIFFICULTY");
      setActiveIndex(-1);
      speakText("Select Difficulty Level", "Kathinai ka star chune");
    } else if (item.id.startsWith("diff_")) {
      if (item.id === "diff_back") {
        setGameState("MAIN_MENU");
        setActiveIndex(-1);
        speakText("Returned to Main Menu", "Main menu par wapas aa gaye");
      } else {
        const level = parseInt(item.id.split("_")[1]);
        setDifficulty(level);
        setGameState("MAIN_MENU");
        setActiveIndex(-1);
        speakText(`Difficulty set to level ${level}`, `Kathinai level ${level} set kiya gaya`);
      }
    } else if (item.id === "coming_back") {
      setGameState("MAIN_MENU");
      setActiveIndex(-1);
      speakText("Returned to Main Menu", "Main menu par wapas aa gaye");
    } else if (item.id === "training" || item.id === "puzzle" || item.id === "multiplayer" || item.id === "save" || item.id === "accessibility" || item.id === "eog") {
      setGameState("COMING_SOON");
      setActiveIndex(-1);
      speakText(`${item.label} is coming soon.`, `${hiLabel} jald hi aayega.`);
    }
  };

  const stopScanner = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setProgress(0);
  };

  useEffect(() => {
    const code = `importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');`;
    const blob = new Blob([code], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg === "uciok") {
        setStockfishReady(true);
      } else if (typeof msg === 'string' && msg.startsWith("bestmove")) {
        const moveStr = msg.split(" ")[1];
        if (moveStr) {
          executeEngineMove(moveStr);
        }
      }
    };

    worker.postMessage("uci");
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    let timer: number;
    if (gameState === "PLAYING") {
      timer = window.setInterval(() => {
        if (chess.turn() === 'w') {
          setWhiteTime(prev => prev + 1);
        } else {
          setBlackTime(prev => prev + 1);
        }
      }, 1000);
    }
    return () => window.clearInterval(timer);
  }, [gameState, fen]); // depend on fen so it updates smoothly when turn changes

  const startScanner = () => {
    stopScanner();
    if ((gameStateRef.current === "MAIN_MENU" || gameStateRef.current === "DIFFICULTY" || gameStateRef.current === "VOICE" || gameStateRef.current === "COMING_SOON") && currentOptionsRef.current.length === 0) return;

    const startTime = Date.now();
    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min((elapsed / AUTO_SELECT_MS) * 100, 100);
      setProgress(p);

      if (p >= 100) {
        stopScanner();
        if (gameStateRef.current === "MAIN_MENU" || gameStateRef.current === "DIFFICULTY" || gameStateRef.current === "VOICE" || gameStateRef.current === "COMING_SOON") {
          const option = currentOptionsRef.current[activeIndexRef.current];
          if (option) {
            playSFX('select');
            handleAction(option);
          }
        } else if (gameStateRef.current === "PLAYING") {
          playSFX('select');
          handleBoardSelection();
        }
      }
    }, 50);
  };

  useEffect(() => {
    if (isActive && (gameState === "MAIN_MENU" || gameState === "DIFFICULTY" || gameState === "VOICE" || gameState === "COMING_SOON" || (gameState === "PLAYING" && boardScanState === "SCANNING"))) {
      startScanner();
    } else {
      stopScanner();
    }
    return stopScanner;
  }, [isActive, gameState, boardScanState]);

  const [eogStatus, setEogStatus] = useState("EOG Disconnected");

  const triggerBlinkAction = () => {
    if (!isActive) return;
    
    if (audioRef.current && audioRef.current.paused && bgmEnabled) {
      audioRef.current.play().catch(e => console.log("Audio autoplay prevented"));
    }

    if (gameState === "MAIN_MENU" || gameState === "DIFFICULTY" || gameState === "VOICE" || gameState === "COMING_SOON") {
      const next = (activeIndexRef.current + 1) % currentOptionsRef.current.length;
      setActiveIndex(next);
      
      const option = currentOptionsRef.current[next];
      if (option) {
          const hiLabel = getHindiMenuLabel(option.id);
          speakText(option.label, hiLabel);
      }
      
      playSFX('tick');
      setProgress(0);
      startScanner();
    } else if (gameState === "PLAYING") {
      if (boardScanState === "SCANNING") {
        let nextIdx = (scanSquareIndexRef.current + 1) % 64;
        if (selectedSquareRef.current && legalMovesRef.current.length > 0) {
            const validOptions = [...legalMovesRef.current, selectedSquareRef.current];
            for (let i = 0; i < 64; i++) {
              const r = Math.floor(nextIdx / 8);
              const c = nextIdx % 8;
              if (validOptions.includes(getSquareName(r, c))) break;
              nextIdx = (nextIdx + 1) % 64;
            }
        } else if (!selectedSquareRef.current) {
            const allMoves = chess.moves({ verbose: true }) as any[];
            const validFroms = Array.from(new Set(allMoves.map(m => m.from)));
            if (validFroms.length > 0) {
                for (let i = 0; i < 64; i++) {
                  const r = Math.floor(nextIdx / 8);
                  const c = nextIdx % 8;
                  if (validFroms.includes(getSquareName(r, c))) break;
                  nextIdx = (nextIdx + 1) % 64;
                }
            }
        }
        
        setScanSquareIndex(nextIdx);
        
        const rIdx = Math.floor(nextIdx / 8);
        const cIdx = nextIdx % 8;
        const sq = getSquareName(rIdx, cIdx);
        const piece = chess.get(sq as any);
        
        if (!selectedSquareRef.current) {
            if (piece) {
               speakText(`${getEnglishColorName(piece)} ${getEnglishPieceName(piece)} on ${sq}`, `${getHindiSquareName(sq)} par ${getColorName(piece)} ${getHindiPieceName(piece)}`);
            } else {
               speakText(`Empty ${sq}`, `Khali ${getHindiSquareName(sq)}`);
            }
        } else {
            const isLegal = legalMovesRef.current.includes(sq);
            if (isLegal) {
                if (piece) {
                    speakText(`Capture ${getEnglishColorName(piece)} ${getEnglishPieceName(piece)} on ${sq}`, `${getHindiSquareName(sq)} par ${getColorName(piece)} ${getHindiPieceName(piece)} ko maare`);
                } else {
                    speakText(`Move to ${sq}`, `${getHindiSquareName(sq)} par chale`);
                }
            } else if (sq === selectedSquareRef.current) {
                speakText(`Deselect piece`, `Mohra chhod de`);
            } else {
                speakText(`Invalid ${sq}`, `Galat ${getHindiSquareName(sq)}`);
            }
        }
        
        playSFX('tick');
        setProgress(0);
        startScanner();
      }
    } else if (gameState === "GAME_OVER") {
      playSFX('select');
      setGameState("MAIN_MENU");
      setActiveIndex(-1);
      speakText("Returning to main menu", "Main menu mein wapas ja rahe hain");
    }
  };
  useEffect(() => {
    if (!isActive) return;
    const ws = new WebSocket("ws://localhost:8080");
    ws.onopen = () => setEogStatus("EOG Connected");
    ws.onclose = () => setEogStatus("EOG Disconnected");
    ws.onmessage = (event) => {
      if (event.data === "BLINK") {
        triggerBlinkAction();
      }
    };
    return () => ws.close();
  }, [isActive, gameState, boardScanState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive || e.repeat || e.code !== "Space") return;
      e.preventDefault();
      e.stopPropagation();
      triggerBlinkAction();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, gameState, boardScanState]);

  useEffect(() => {
    if (gameState === "MAIN_MENU" || gameState === "DIFFICULTY" || gameState === "VOICE" || gameState === "COMING_SOON") {
      const el = document.getElementById(`blinkchess-menu-item-${activeIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeIndex, gameState]);

  const getSquareName = (rIdx: number, cIdx: number) => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const rank = 8 - rIdx;
    return files[cIdx] + rank;
  };

  const getHindiPieceName = (piece: any) => {
    if (!piece) return "";
    const names: any = { p: "Pyada", n: "Ghoda", b: "Oont", r: "Haathi", q: "Rani", k: "Raja" };
    return names[piece.type] || "";
  };

  const getHindiPieceNameOblique = (piece: any) => {
    if (!piece) return "";
    const names: any = { p: "Pyade", n: "Ghode", b: "Oont", r: "Haathi", q: "Rani", k: "Raja" };
    return names[piece.type] || "";
  };

  const getColorName = (piece: any) => {
    if (!piece) return "";
    return piece.color === "w" ? "Safed" : "Kaala";
  };

  const getColorNameOblique = (piece: any) => {
    if (!piece) return "";
    return piece.color === "w" ? "Safed" : "Kaale";
  };

  const getEnglishPieceName = (piece: any) => {
    if (!piece) return "";
    const names: any = { p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King" };
    return names[piece.type] || "";
  };

  const getEnglishColorName = (piece: any) => {
    if (!piece) return "";
    return piece.color === "w" ? "White" : "Black";
  };

  const getHindiSquareName = (sq: string) => {
    if (!sq || sq.length !== 2) return sq;
    const letter = sq[0].toUpperCase();
    const numbers: any = { '1': 'Ek', '2': 'Do', '3': 'Teen', '4': 'Chaar', '5': 'Paanch', '6': 'Chhah', '7': 'Saat', '8': 'Aath' };
    const num = numbers[sq[1]] || sq[1];
    return `${letter} ${num}`;
  };

  const executeMove = (from: string, to: string) => {
    try {
      const piece = chess.get(from as any);
      const move = chess.move({ from, to, promotion: 'q' } as any);
      if (move) {
        setFen(chess.fen());
        setMoveHistory(prev => [...prev, move.san]);
        const pName = getHindiPieceName(piece);
        const cName = getColorName(piece);
        
        playSFX('move');
        if (move.captured) {
          const pNameOblique = getHindiPieceNameOblique(piece);
          const cNameOblique = getColorNameOblique(piece);
          speakText(
            `${getEnglishColorName(piece)} ${getEnglishPieceName(piece)} captured!`,
            `${cNameOblique} ${pNameOblique} ne maar diya!`
          );
        } else {
          speakText(
            `${getEnglishColorName(piece)} ${getEnglishPieceName(piece)} moved from ${from.toUpperCase()} to ${to.toUpperCase()}`,
            `${cName} ${pName} ${getHindiSquareName(from)} se ${getHindiSquareName(to)} gaya`
          );
        }
        
        if (chess.inCheck()) speakText("Check. Your King is in danger.", "Check. Raja khatre mein hai.");
        if (chess.isCheckmate()) { speakText("Congratulations! You win!", "Badhai ho! Aap jeet gaye!"); setGameState("GAME_OVER"); }
        
        if (!chess.isGameOver()) {
          setBoardScanState("IDLE");
          workerRef.current?.postMessage(`position fen ${chess.fen()}`);
          workerRef.current?.postMessage(`go depth ${difficulty}`);
        }
      }
    } catch (e) {
      console.error(e);
      speakText("Illegal move", "Galat chaal");
    }
  };

  const executeEngineMove = (moveStr: string) => {
    if (chess.isGameOver()) return;
    
    const from = moveStr.substring(0, 2);
    const to = moveStr.substring(2, 4);
    const promotion = moveStr.length > 4 ? moveStr.substring(4, 5) : undefined;
      
    try {
      const piece = chess.get(from as any);
      const move = chess.move({ from, to, promotion } as any);
      setFen(chess.fen());
      setMoveHistory(prev => [...prev, moveStr]);
      
      playSFX('move');
      if (move && move.captured) {
        const pNameOblique = getHindiPieceNameOblique(piece);
        const cNameOblique = getColorNameOblique(piece);
        speakText(
          `${getEnglishColorName(piece)} ${getEnglishPieceName(piece)} captured!`,
          `${cNameOblique} ${pNameOblique} ne maar diya!`
        );
      } else {
        speakText(
          `${getEnglishColorName(piece)} ${getEnglishPieceName(piece)} moved from ${from.toUpperCase()} to ${to.toUpperCase()}`,
          `${getColorName(piece)} ${getHindiPieceName(piece)} ${getHindiSquareName(from)} se ${getHindiSquareName(to)} gaya`
        );
      }
      
      if (chess.inCheck()) speakText("Your king is in check.", "Aapka raja check mein hai.");
      if (chess.isCheckmate()) { speakText("Checkmate! AI wins.", "Checkmate! AI jeet gaya."); setGameState("GAME_OVER"); }
      
      setBoardScanState("SCANNING");
      
      // Smart jump to first valid piece for the player
      const allMoves = chess.moves({ verbose: true }) as any[];
      if (allMoves.length > 0) {
         const firstValid = allMoves[0].from;
         const r = 8 - parseInt(firstValid[1]);
         const c = firstValid.charCodeAt(0) - 'a'.charCodeAt(0);
         setScanSquareIndex(r * 8 + c);
      } else {
         setScanSquareIndex(0);
      }
      
      startScanner();
    } catch(e) {
      console.error("Stockfish gave invalid move?", moveStr);
    }
  };

  const handleBoardSelection = () => {
    if (boardScanStateRef.current === "SCANNING") {
      const rIdx = Math.floor(scanSquareIndexRef.current / 8);
      const cIdx = scanSquareIndexRef.current % 8;
      const sq = getSquareName(rIdx, cIdx);
      
      if (!selectedSquareRef.current) {
        const piece = chess.get(sq as any);
        if (piece && piece.color === 'w') {
          setSelectedSquare(sq);
          const moves = chess.moves({ square: sq as any, verbose: true }) as any[];
          
          const safeSq: string[] = [];
          const dangerSq: string[] = [];
          for (const m of moves) {
             if (isSquareSafe(chess, m.from, m.to)) safeSq.push(m.to);
             else dangerSq.push(m.to);
          }
          
          setLegalMoves(moves.map((m: any) => m.to));
          setSafeSquares(safeSq);
          setDangerSquares(dangerSq);
          
          speakText(
            `Selected ${getEnglishColorName(piece)} ${getEnglishPieceName(piece)}`,
            `${getColorName(piece)} ${getHindiPieceName(piece)} chuna gaya`
          );
          setBoardScanState("SCANNING");
          setProgress(0);
          
          if (moves.length > 0) {
            // Smart jump directly to the first legal destination square
            const firstMove = moves[0].to;
            const r = 8 - parseInt(firstMove[1]);
            const c = firstMove.charCodeAt(0) - 'a'.charCodeAt(0);
            setScanSquareIndex(r * 8 + c);
          } else {
            setScanSquareIndex(0);
          }
          startScanner();
        } else {
          speakText("Invalid piece. Select a white piece.", "Galat mohra. Safed mohra chune.");
          setScanSquareIndex(0);
          setProgress(0);
          startScanner();
        }
      } else {
        if (legalMovesRef.current.includes(sq)) {
          executeMove(selectedSquareRef.current, sq);
          setSelectedSquare(null);
          setLegalMoves([]);
          setBoardScanState("IDLE");
          stopScanner();
        } else if (sq === selectedSquareRef.current) {
          setSelectedSquare(null);
          setLegalMoves([]);
          setSafeSquares([]);
          setDangerSquares([]);
          setProgress(0);
          
          const allMoves = chess.moves({ verbose: true }) as any[];
          if (allMoves.length > 0) {
             const firstValid = allMoves[0].from;
             const r = 8 - parseInt(firstValid[1]);
             const c = firstValid.charCodeAt(0) - 'a'.charCodeAt(0);
             setScanSquareIndex(r * 8 + c);
          } else {
             setScanSquareIndex(0);
          }
          
          startScanner();
          speakText("Piece deselected", "Mohra chhod diya");
        } else {
          speakText("Illegal move", "Galat chaal");
          
          setSelectedSquare(null);
          setLegalMoves([]);
          setSafeSquares([]);
          setDangerSquares([]);
          setProgress(0);
          
          const allMoves = chess.moves({ verbose: true }) as any[];
          if (allMoves.length > 0) {
             const firstValid = allMoves[0].from;
             const r = 8 - parseInt(firstValid[1]);
             const c = firstValid.charCodeAt(0) - 'a'.charCodeAt(0);
             setScanSquareIndex(r * 8 + c);
          } else {
             setScanSquareIndex(0);
          }
          
          startScanner();
        }
      }
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-[#0A0505] text-white z-50 flex overflow-hidden font-sans">
      <div className="w-[450px] bg-[#120A0A] border-r border-amber-900/30 flex flex-col p-8 shadow-2xl relative z-10">
        <div className="flex flex-col mb-8">
          <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-amber-200 to-amber-600 mb-2">
            BlinkChess
          </h1>
          <span className={`text-xs font-bold text-amber-500 tracking-widest uppercase ${gameState === "PLAYING" ? "mb-10" : ""}`}>AI Pro Engine</span>
          
          {gameState === "PLAYING" && (
            <div className="bg-gradient-to-br from-slate-800/90 to-black/80 rounded-2xl p-8 border-2 border-amber-500/40 shadow-[0_0_40px_rgba(217,119,6,0.15)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-amber-400 to-amber-600"></div>
              
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-amber-400 text-xl font-black uppercase tracking-[0.15em] flex items-center gap-3 drop-shadow-md m-0">
                  <Shield className="w-7 h-7 text-amber-500" /> FIDE Integration Vision
                </h3>
                <button
                  onClick={() => {
                    const enVisionText = "F I D E Integration Vision. The International Chess Federation can leverage Blink Chess Pro to revolutionize accessibility in competitive chess. By utilizing E O G hardware where a single blink advances the scanner and a 2-second dwell timer finalizes the selection, players with severe motor disabilities can compete entirely hands-free. The Game Changer: This technology eliminates physical barriers, standardizing an inclusive tournament interface. It ensures that tactical brilliance is the sole factor determining a champion, seamlessly bridging the gap between able-bodied and physically impaired prodigies on the global stage.";
                    const hiVisionText = "F I D E Integration Vision. International Chess Federation Blink Chess Pro ka upyog karke competitive chess mein accessibility ko behtar bana sakti hai. E O G hardware ke zariye jahan ek blink se scanner aage badhta hai, aur 2-second ke timer se selection hota hai, gambhir motor disabilities wale khiladi bina haath lagaye khel sakte hain. Game Changer: Yeh technology physical barriers ko khatam karti hai, ek inclusive tournament interface banati hai. Yeh sunishchit karta hai ki champion banne ke liye sirf tactical brilliance zaroori ho, jisse global stage par sabhi khiladi barabar roop se khel saken.";
                    speakText(enVisionText, hiVisionText);
                  }}
                  className="text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 p-2 rounded-full transition-colors cursor-pointer"
                  title="Read Vision Text"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-6">
                <p className="text-slate-100 text-base leading-relaxed text-justify tracking-wide">
                  The <strong className="text-white font-black drop-shadow-md">International Chess Federation (FIDE)</strong> can leverage BlinkChess Pro to revolutionize accessibility in competitive chess. By utilizing EOG hardware where a <strong className="text-amber-400 font-black tracking-wider">single blink</strong> (spacebar) advances the scanner and a <strong className="text-amber-400 font-black tracking-wider">2-second dwell timer</strong> finalizes the selection, players with severe motor disabilities can compete entirely hands-free.
                </p>
                
                <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>
                
                <p className="text-slate-100 text-base leading-relaxed text-justify tracking-wide">
                  <strong className="text-amber-500 font-black text-lg block mb-1">The Game Changer:</strong> 
                  This technology eliminates physical barriers, standardizing an inclusive tournament interface. It ensures that tactical brilliance is the sole factor determining a champion, seamlessly bridging the gap between able-bodied and physically impaired prodigies on the global stage.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div className="flex flex-col gap-3 absolute inset-0 overflow-y-auto pr-4 pb-20 custom-scrollbar">
            {currentOptions.map((opt, i) => {
              const isSelected = i === activeIndex;
              const Icon = opt.icon;
              return (
                <div
                  key={i}
                  id={`blinkchess-menu-item-${i}`}
                  className={`
                    flex-shrink-0 p-5 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden flex items-center gap-4
                    ${isSelected ? 'bg-amber-500/10 border-amber-500' : 'bg-slate-900/50 border-slate-800'}
                  `}
                >
                  <Icon className={`w-6 h-6 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className={`relative z-10 font-bold ${isSelected ? 'text-amber-400' : 'text-slate-300'}`}>
                    {opt.label}
                  </span>
                  {isSelected && (
                    <div 
                      className="absolute bottom-0 left-0 h-1.5 bg-gradient-to-r from-amber-400 to-yellow-200"
                      style={{ width: `${progress}%`, transition: 'width 50ms linear' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center text-xs font-medium text-slate-500">
          <span>Spacebar to Scan Down</span>
          <span>Timer to Select</span>
        </div>

        <div className="mt-4 pt-4 border-t border-amber-900/30 flex items-center justify-between text-xs font-medium">
          <span className="text-amber-500 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${eogStatus === "EOG Connected" ? "bg-green-500" : "bg-red-500"}`} />
            {eogStatus}
          </span>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                const nextLang = language === "English" ? "Hindi" : "English";
                setLanguage(nextLang);
                if (nextLang === "Hindi") {
                  speakText("", "Hindi bhasha chuni gayi", "Hindi");
                } else {
                  speakText("English language selected", "", "English");
                }
              }}
              className="text-slate-400 hover:text-amber-400 flex items-center gap-2 transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              {language === "English" ? "Lang: EN" : "Lang: HI"}
            </button>
            <button 
              onClick={() => setBgmEnabled(!bgmEnabled)}
              className="text-slate-400 hover:text-amber-400 flex items-center gap-2 transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              {bgmEnabled ? "Music On" : "Music Off"}
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black flex flex-col items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[length:32px_32px]" />
        
        {gameState === "GAME_OVER" && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center">
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-200 to-amber-600 mb-6 drop-shadow-[0_0_30px_rgba(217,119,6,0.5)]">
               {chess.isCheckmate() && chess.turn() === 'w' ? "AI WINS!" : 
                chess.isCheckmate() && chess.turn() === 'b' ? "YOU WIN!" : "GAME DRAWN"}
            </h1>
            <div className="text-2xl text-white/70 mb-12 font-medium">
               {chess.isCheckmate() ? "Checkmate" : "Stalemate"}
            </div>
            <button onClick={() => setGameState("MAIN_MENU")} className="px-8 py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(217,119,6,0.3)]">
               Return to Main Menu
            </button>
          </div>
        )}

        {(gameState === "MAIN_MENU" || gameState === "DIFFICULTY" || gameState === "VOICE" || gameState === "COMING_SOON") && (
          <div className="text-center">
            <Shield className="w-24 h-24 text-amber-500/20 mx-auto mb-6" />
            <h2 className="text-2xl text-slate-500 font-medium">
              {gameState === "MAIN_MENU" ? "Select an option from the menu" : 
               gameState === "DIFFICULTY" ? "Select Difficulty Level" :
               gameState === "VOICE" ? "Select Voice Language" :
               "Feature Coming Soon!"}
            </h2>
          </div>
        )}
        
        {gameState === "PLAYING" && (
          <div className="flex flex-row items-center justify-center gap-6 md:gap-10 relative z-10 w-full max-w-[1200px]">
             
            {/* Captured Black Pieces (You captured) */}
            <div className="hidden md:flex flex-col gap-2 p-4 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 w-[70px] min-h-[450px] shadow-[0_0_40px_rgba(0,0,0,0.5)]">
               <div className="text-[10px] text-amber-500/70 text-center font-black mb-3 uppercase tracking-[0.2em]">Black<br/>Taken</div>
               <div className="flex flex-col gap-1 items-center">
                 {calculateCapturedPieces(chess).capturedB.map((p, i) => (
                   <img key={i} src={PIECE_IMAGES['b'][p]} className="w-10 h-10 drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)] transition-transform hover:scale-110" alt="captured" />
                 ))}
               </div>
            </div>

            <div className="flex flex-col items-center gap-6 relative w-full max-w-[750px]">
              
              {/* Top Bar (Black / AI Info & Clock) */}
              <div className="w-full bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 flex justify-between items-center shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-slate-600 flex items-center justify-center shadow-inner">
                    <Shield className="w-6 h-6 text-amber-500/80" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-slate-200 tracking-wide">Stockfish Engine</span>
                    <span className="text-amber-500/60 text-xs font-bold uppercase tracking-widest">Level {difficulty} AI</span>
                  </div>
                </div>
                <div className={`px-5 py-2 rounded-xl font-mono text-xl font-bold shadow-inner ${chess.turn() === 'b' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-black/40 text-slate-500 border border-transparent'}`}>
                  {formatTime(blackTime)}
                </div>
              </div>

              <div className="relative shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden border-[8px] border-[#2A2621]" style={{ width: 'min(70vh, 100%)', aspectRatio: '1/1' }}>
                <div className="absolute inset-0 pointer-events-none z-20">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => (
                    <div key={n} className="absolute left-1 text-[10px] font-bold text-white/50" style={{ top: `${(i * 100) / 8}%` }}>
                      {9 - n}
                    </div>
                  ))}
                  {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((l, i) => (
                    <div key={l} className="absolute bottom-0 text-[10px] font-bold text-white/50" style={{ left: `${(i * 100) / 8 + 8}%` }}>
                      {l}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
                  {chess.board().map((row, rIdx) =>
                    row.map((piece, cIdx) => {
                      const isLight = (rIdx + cIdx) % 2 === 0;
                      const sqName = getSquareName(rIdx, cIdx);
                      const currentIndex = rIdx * 8 + cIdx;
                      const isScanned = boardScanState === "SCANNING" && scanSquareIndex === currentIndex;
                      const isSelected = selectedSquare === sqName;
                      const isLegalMove = legalMoves.includes(sqName);
                      
                      return (
                        <div 
                          key={cIdx} 
                          className="flex-1 flex items-center justify-center relative"
                          style={{ backgroundColor: isLight ? '#f0d9b5' : '#b58863' }}
                        >
                          {isScanned && (
                            <>
                              <div className="absolute inset-0 border-[4px] border-white/80 z-30 shadow-[inset_0_0_15px_rgba(255,255,255,0.5)]" />
                              <div 
                                className="absolute bottom-0 left-0 h-2 bg-gradient-to-r from-blue-400 to-cyan-300 z-40"
                                style={{ width: `${progress}%`, transition: 'width 50ms linear' }}
                              />
                            </>
                          )}
                          {isSelected && <div className="absolute inset-0 bg-[#cdd26a]/70 z-10" />}
                          {isLegalMove && (
                            <div className={`absolute w-[40%] h-[40%] rounded-full z-10 opacity-80 ${
                              safeSquares.includes(sqName) ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)]' :
                              dangerSquares.includes(sqName) ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]' :
                              'bg-black/20'
                            }`} />
                          )}
                          
                          {piece && (
                            <img 
                              src={PIECE_IMAGES[piece.color][piece.type]} 
                              alt={`${piece.color} ${piece.type}`}
                              className="relative z-20 w-[90%] h-[90%] drop-shadow-[0_5px_8px_rgba(0,0,0,0.5)] transition-transform duration-300 hover:scale-110 hover:-translate-y-1"
                              draggable={false}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              {/* Bottom Bar (White / Player Info & Clock) */}
              <div className="w-full bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 flex justify-between items-center shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-slate-600 flex items-center justify-center shadow-inner relative">
                     <Brain className="w-6 h-6 text-green-400/80" />
                     {boardScanState === "SCANNING" && (
                        <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full animate-pulse border-2 border-slate-800" />
                     )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-white tracking-wide">
                      You (White)
                    </span>
                    <span className={`text-xs font-bold uppercase tracking-widest ${chess.turn() === 'w' ? 'text-green-400' : 'text-slate-500'}`}>
                      {chess.turn() === 'w' ? "Your Turn" : "Waiting"}
                    </span>
                  </div>
                </div>
                <div className={`px-5 py-2 rounded-xl font-mono text-xl font-bold shadow-inner ${chess.turn() === 'w' ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'bg-black/40 text-slate-500 border border-transparent'}`}>
                  {formatTime(whiteTime)}
                </div>
              </div>
            </div>

            {/* Captured White Pieces (AI captured) */}
            <div className="hidden md:flex flex-col gap-2 p-4 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 w-[70px] min-h-[450px] shadow-[0_0_40px_rgba(0,0,0,0.5)]">
               <div className="text-[10px] text-slate-400/70 text-center font-black mb-3 uppercase tracking-[0.2em]">White<br/>Taken</div>
               <div className="flex flex-col gap-1 items-center">
                 {calculateCapturedPieces(chess).capturedW.map((p, i) => (
                   <img key={i} src={PIECE_IMAGES['w'][p]} className="w-10 h-10 drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)] transition-transform hover:scale-110" alt="captured" />
                 ))}
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
