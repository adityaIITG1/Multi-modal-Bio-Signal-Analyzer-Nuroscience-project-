import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Target, AlertCircle, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';

interface Question {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface BlinkCurrentAffairsProps {
  language?: string;
  speak: (text: string) => void;
  playSound: (type: 'switch' | 'select' | 'error' | 'success') => void;
  triggerKey?: string;
  externalActiveIndex?: number;
}

const BlinkCurrentAffairs: React.FC<BlinkCurrentAffairsProps> = ({
  language = 'en-IN',
  speak,
  playSound,
  triggerKey,
  externalActiveIndex,
}) => {
  const [phase, setPhase] = useState<'SETUP' | 'LOADING' | 'QUIZ' | 'RESULTS'>('SETUP');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(20);
  const timerRef = useRef<number | null>(null);
  const isAnsweringRef = useRef(false);

  // Scanner state
  const [activeIndex, setActiveIndex] = useState(0);
  const [scannerProgress, setScannerProgress] = useState(0);
  const scannerIntervalRef = useRef<number | null>(null);

  // Post-answer state
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const fetchQuestions = async () => {
    setPhase('LOADING');
    playSound('switch');
    try {
      const res = await fetch('/api/generate-current-affairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language })
      });
      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setPhase('QUIZ');
        startQuiz(data.questions);
      } else {
        throw new Error("Invalid questions format");
      }
    } catch (e) {
      console.error(e);
      // Fallback
      setQuestions([
        {
          question: "Failed to load latest current affairs. Who won the 2022 FIFA World Cup?",
          options: ["France", "Brazil", "Argentina", "Germany"],
          answer: "Argentina",
          explanation: "Argentina defeated France in the 2022 World Cup final."
        }
      ]);
      setPhase('QUIZ');
      startQuiz(null);
    }
  };

  const startQuiz = (qs?: Question[] | null) => {
    setCurrentIndex(0);
    setScore(0);
    startQuestion();
  };

  const startQuestion = () => {
    isAnsweringRef.current = false;
    setShowExplanation(false);
    setSelectedOption(null);
    setTimeLeft(40);
    setActiveIndex(0);
    setScannerProgress(0);
    startTimer();
    scheduleSelect();
  };

  const startTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          window.clearInterval(timerRef.current!);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
  };

  const scheduleSelect = useCallback(() => {
    if (scannerIntervalRef.current) window.clearInterval(scannerIntervalRef.current);
    
    const intervalTime = 50; 
    const scanDuration = 2000; 
    const step = (intervalTime / scanDuration) * 100;

    setScannerProgress(0);
    scannerIntervalRef.current = window.setInterval(() => {
      setScannerProgress(prev => {
        if (prev >= 100) {
          window.clearInterval(scannerIntervalRef.current!);
          return 100;
        }
        return prev + step;
      });
    }, intervalTime);
  }, []);

  const stopScanner = () => {
    if (scannerIntervalRef.current) window.clearInterval(scannerIntervalRef.current);
    setScannerProgress(0);
  };

  const handleTimeUp = () => {
    if (isAnsweringRef.current) return;
    isAnsweringRef.current = true;
    stopScanner();
    playSound('error');
    setShowExplanation(true);
    setTimeout(nextQuestion, 5000);
  };

  const handleSelectOption = useCallback(() => {
    if (phase !== 'QUIZ' || isAnsweringRef.current) return;
    isAnsweringRef.current = true;
    
    stopScanner();
    stopTimer();
    
    const selectedIdx = activeIndex;
    setSelectedOption(selectedIdx);
    
    const currentQ = questions[currentIndex];
    const isCorrect = currentQ.options[selectedIdx] === currentQ.answer;
    
    if (isCorrect) {
      playSound('success');
      setScore(s => s + 1);
    } else {
      playSound('error');
    }
    
    setShowExplanation(true);
    setTimeout(nextQuestion, 6000);
  }, [phase, showExplanation, activeIndex, questions, currentIndex, playSound]);

  useEffect(() => {
    if (scannerProgress >= 100 && phase === 'QUIZ' && !showExplanation) {
      handleSelectOption();
    }
  }, [scannerProgress, phase, showExplanation, handleSelectOption]);

  const nextQuestion = () => {
    if (currentIndex >= questions.length - 1) {
      setPhase('RESULTS');
    } else {
      setCurrentIndex(c => c + 1);
      startQuestion();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'SETUP') {
          fetchQuestions();
        } else if (phase === 'RESULTS') {
          setPhase('SETUP');
        } else if (phase === 'QUIZ' && !showExplanation) {
          playSound('switch');
          setActiveIndex(curr => (curr + 1) % 4);
          scheduleSelect();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, showExplanation, fetchQuestions, playSound, scheduleSelect]);

  // Sync external index if provided
  useEffect(() => {
    if (externalActiveIndex !== undefined && externalActiveIndex >= 0) {
      // In this component, we run our own scanner for options.
      // But if the external dashboard scanner is driving, we can sync.
      // For now, we rely on our internal scanner for options.
    }
  }, [externalActiveIndex]);

  useEffect(() => {
    return () => {
      stopScanner();
      stopTimer();
    };
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto h-[600px] flex flex-col justify-center items-center">
      {phase === 'SETUP' && (
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-12 text-center shadow-[0_0_50px_rgba(0,0,0,0.3)] max-w-2xl w-full">
          <Target className="w-24 h-24 text-blue-500 mx-auto mb-6 animate-pulse" />
          <h2 className="text-4xl font-black text-white mb-4">Global News Quiz</h2>
          <p className="text-xl text-slate-400 mb-8">10 dynamically generated questions on the latest world events. Test your knowledge using the eye-blink scanner.</p>
          
          <button 
            onClick={fetchQuestions}
            className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-2xl text-2xl font-bold text-white shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all"
          >
            Start Quiz
          </button>
        </div>
      )}

      {phase === 'LOADING' && (
        <div className="text-center">
          <div className="w-24 h-24 border-t-4 border-blue-500 border-solid rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-3xl font-bold text-white">Fetching Latest News...</h2>
          <p className="text-slate-400 mt-2">AI is analyzing current events to build your quiz.</p>
        </div>
      )}

      {phase === 'QUIZ' && questions.length > 0 && questions[currentIndex] && (
        <div className="w-full flex flex-col h-full bg-slate-900/50 backdrop-blur-3xl border border-white/10 rounded-[40px] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)]">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/20">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                <span className="text-2xl font-black text-blue-400">{currentIndex + 1}/10</span>
              </div>
              <div>
                <h3 className="text-slate-400 font-bold tracking-widest text-sm uppercase">Current Score</h3>
                <div className="text-2xl font-black text-white">{score}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Clock className={`w-8 h-8 ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
              <div className={`text-4xl font-black ${timeLeft <= 5 ? 'text-red-500' : 'text-white'}`}>
                0:{timeLeft.toString().padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Progress Bar Timer */}
          <div className="w-full h-2 bg-slate-800">
            <div 
              className={`h-full transition-all duration-1000 ${timeLeft <= 5 ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${(timeLeft / 40) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="flex-1 p-8 flex flex-col">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center leading-tight">
              {questions[currentIndex].question}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              {questions[currentIndex].options.map((opt, idx) => {
                const isActive = activeIndex === idx && !showExplanation;
                const isSelected = selectedOption === idx;
                const isCorrect = opt === questions[currentIndex].answer;
                
                let bgStyle = "bg-white/5 border-white/10";
                if (showExplanation) {
                  if (isCorrect) bgStyle = "bg-green-500/20 border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]";
                  else if (isSelected) bgStyle = "bg-red-500/20 border-red-500/50";
                } else if (isActive) {
                  bgStyle = "bg-blue-500/20 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.3)]";
                }

                return (
                  <div 
                    key={idx}
                    className={`relative p-6 rounded-2xl border-2 transition-all flex items-center gap-4 ${bgStyle}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center font-bold text-slate-300">
                      {['A', 'B', 'C', 'D'][idx]}
                    </div>
                    <span className="text-xl font-bold text-white">{opt}</span>
                    
                    {showExplanation && isCorrect && <CheckCircle2 className="absolute right-6 w-8 h-8 text-green-500" />}
                    {showExplanation && isSelected && !isCorrect && <XCircle className="absolute right-6 w-8 h-8 text-red-500" />}

                    {/* Scanner Progress Bar */}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 h-1 bg-blue-500 rounded-b-2xl" style={{ width: `${scannerProgress}%` }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Explanation Banner */}
            <AnimatePresence>
              {showExplanation && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="mt-6 p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex gap-4 items-start"
                >
                  <AlertCircle className="w-8 h-8 text-amber-500 flex-shrink-0" />
                  <div>
                    <h4 className="text-amber-500 font-bold uppercase tracking-wider text-sm mb-1">Explanation</h4>
                    <p className="text-white text-lg">{questions[currentIndex].explanation}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {phase === 'RESULTS' && (
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-12 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-3xl w-full">
          <Trophy className="w-32 h-32 text-amber-500 mx-auto mb-6 animate-pulse drop-shadow-[0_0_40px_rgba(245,158,11,0.6)]" />
          <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-600 mb-2">
            Quiz Complete!
          </h2>
          <p className="text-xl text-slate-300 mb-8">Here is how you performed against the global news.</p>

          <div className="bg-black/30 rounded-3xl p-8 mb-8 border border-white/5">
            <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Final Score</div>
            <div className="text-8xl font-black text-white">{score}<span className="text-5xl text-slate-500">/10</span></div>
            
            <div className="mt-6 text-2xl font-bold text-amber-400">
              {score === 10 ? "Flawless News Junkie!" : score >= 7 ? "Great Knowledge!" : score >= 4 ? "Average Awareness" : "Needs Catching Up!"}
            </div>
          </div>
          
          <button 
            onClick={() => setPhase('SETUP')}
            className="w-full py-6 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-2xl font-bold text-white transition-all flex items-center justify-center gap-2"
          >
            Play Again <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
};

export default BlinkCurrentAffairs;
