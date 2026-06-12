"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface DinoGameProps {
  onClose: () => void;
}

export default function DinoGame({ onClose }: DinoGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [gameState, setGameState] = useState<"start" | "playing" | "gameover">("start");
  const [score, setScore] = useState(0);

  // Mutable refs to hold the live game data for the animation loop
  const requestRef = useRef<number>(0);
  const gameRunningRef = useRef(false);
  const scoreRef = useRef(0);
  const speedRef = useRef(6);
  const frameRef = useRef(0);

  const dinoRef = useRef({
    x: 90,
    y: 270,
    width: 95,
    height: 80,
    dy: 0,
    gravity: 0.75,
    jumpPower: -15,
    grounded: true
  });

  const obstaclesRef = useRef<any[]>([]);
  const starsRef = useRef<any[]>([]);

  // Initialize stars once
  useEffect(() => {
    starsRef.current = [];
    for (let i = 0; i < 80; i++) {
      starsRef.current.push({
        x: Math.random() * 870,
        y: Math.random() * 220,
        r: Math.random() * 2,
        speed: Math.random() * 0.6 + 0.2
      });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fixed canvas size matching user request
    canvas.width = 870;
    canvas.height = 390;

    const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };

    const drawBackground = () => {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#0f172a");
      gradient.addColorStop(0.65, "#1e293b");
      gradient.addColorStop(1, "#020617");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw stars
      starsRef.current.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(125, 211, 252, 0.9)";
        ctx.fill();

        if (gameRunningRef.current) {
          star.x -= star.speed;
          if (star.x < 0) {
            star.x = canvas.width;
            star.y = Math.random() * 220;
          }
        }
      });

      // Ground glow and line
      ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
      ctx.fillRect(0, 345, canvas.width, 3);

      // Ground block
      ctx.fillStyle = "#334155";
      ctx.fillRect(0, 348, canvas.width, 42);
    };

    const drawDino = () => {
      const dino = dinoRef.current;
      ctx.save();

      const x = dino.x;
      const y = dino.y;

      ctx.shadowBlur = 28;
      ctx.shadowColor = "#38bdf8";
      ctx.fillStyle = "#22d3ee";

      // Body
      roundRect(ctx, x + 8, y + 22, 42, 34, 12);
      ctx.fill();

      // Head
      roundRect(ctx, x + 38, y + 4, 34, 30, 10);
      ctx.fill();

      // Snout
      roundRect(ctx, x + 62, y + 14, 24, 14, 6);
      ctx.fill();

      // Neck
      ctx.fillRect(x + 42, y + 26, 18, 20);

      // Tail
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 32);
      ctx.lineTo(x - 26, y + 16);
      ctx.lineTo(x + 2, y + 48);
      ctx.closePath();
      ctx.fill();

      // Legs
      ctx.fillRect(x + 18, y + 54, 9, 20);
      ctx.fillRect(x + 38, y + 54, 9, 20);

      // Feet
      roundRect(ctx, x + 15, y + 70, 18, 7, 4);
      ctx.fill();
      roundRect(ctx, x + 35, y + 70, 18, 7, 4);
      ctx.fill();

      // Arms
      ctx.fillRect(x + 58, y + 36, 8, 16);
      roundRect(ctx, x + 56, y + 50, 14, 5, 3);
      ctx.fill();

      ctx.shadowBlur = 0;

      // Eye
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(x + 60, y + 15, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.arc(x + 61, y + 15, 2, 0, Math.PI * 2);
      ctx.fill();

      // Mouth
      ctx.strokeStyle = "#020617";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 66, y + 25);
      ctx.lineTo(x + 82, y + 25);
      ctx.stroke();

      ctx.restore();
    };

    const drawObstacle = (ob: any) => {
      ctx.save();
      ctx.shadowBlur = 25;
      ctx.shadowColor = "#f43f5e";

      const gradient = ctx.createLinearGradient(ob.x, ob.y, ob.x, ob.y + ob.height);
      gradient.addColorStop(0, "#fb7185");
      gradient.addColorStop(1, "#be123c");

      ctx.fillStyle = gradient;
      roundRect(ctx, ob.x, ob.y, ob.width, Math.max(0, ob.height), 12);
      ctx.fill();

      ctx.restore();
    };

    const updateDino = () => {
      const dino = dinoRef.current;
      dino.y += dino.dy;

      if (!dino.grounded) {
        dino.dy += dino.gravity;
      }

      if (dino.y >= 270) {
        dino.y = 270;
        dino.dy = 0;
        dino.grounded = true;
      }
    };

    const spawnObstacle = () => {
      if (frameRef.current % 95 === 0) {
        const height = Math.random() * 35 + 45;
        obstaclesRef.current.push({
          x: canvas.width,
          y: 348 - height,
          width: Math.random() * 18 + 32,
          height
        });
      }
    };

    const updateObstacles = () => {
      obstaclesRef.current.forEach(ob => ob.x -= speedRef.current);
      obstaclesRef.current = obstaclesRef.current.filter(ob => ob.x + ob.width > 0);
    };

    const checkCollision = () => {
      const dino = dinoRef.current;
      for (let ob of obstaclesRef.current) {
        if (
          dino.x < ob.x + ob.width &&
          dino.x + dino.width > ob.x &&
          dino.y < ob.y + ob.height &&
          dino.y + dino.height > ob.y
        ) {
          endGame();
        }
      }
    };

    const drawScore = () => {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "700 20px Inter";
      ctx.fillText("Distance: " + scoreRef.current, 24, 36);
    };

    const endGame = () => {
      gameRunningRef.current = false;
      setGameState("gameover");
    };

    const gameLoop = () => {
      if (!gameRunningRef.current) {
        // Just draw static frame if not running
        drawBackground();
        drawScore();
        drawDino();
        obstaclesRef.current.forEach(drawObstacle);
        requestRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      frameRef.current++;
      scoreRef.current++;
      speedRef.current += 0.002;

      setScore(scoreRef.current);

      drawBackground();
      drawScore();

      updateDino();
      drawDino();

      spawnObstacle();
      updateObstacles();

      obstaclesRef.current.forEach(drawObstacle);

      checkCollision();

      requestRef.current = requestAnimationFrame(gameLoop);
    };

    // Start loop immediately to draw start screen state
    requestRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const resetGame = () => {
    scoreRef.current = 0;
    speedRef.current = 6;
    frameRef.current = 0;
    obstaclesRef.current = [];
    dinoRef.current.y = 270;
    dinoRef.current.dy = 0;
    dinoRef.current.grounded = true;
    setScore(0);
  };

  const startGame = () => {
    resetGame();
    gameRunningRef.current = true;
    setGameState("playing");
  };

  const jump = () => {
    if (dinoRef.current.grounded && gameRunningRef.current) {
      dinoRef.current.dy = dinoRef.current.jumpPower;
      dinoRef.current.grounded = false;
    } else if (!gameRunningRef.current) {
      // Start or restart if blink happens when game is not running
      startGame();
    }
  };

  // Keyboard controls for EOG blink (Spacebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        jump();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md"
    >
      <div 
        className="relative w-full max-w-[920px] rounded-[32px] p-6 text-white overflow-hidden"
        style={{
          background: "rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(25px)",
          border: "1px solid rgba(255, 255, 255, 0.16)",
          boxShadow: "0 30px 100px rgba(0, 0, 0, 0.45)"
        }}
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white z-[60]"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="flex justify-between items-center mb-5 pr-14">
          <div className="text-[28px] font-extrabold tracking-tight">
            🦖 Neuro Dino Runner
          </div>
          <div className="px-5 py-2.5 rounded-full font-bold shadow-[0_0_25px_rgba(56,189,248,0.5)]"
               style={{ background: "linear-gradient(135deg, #38bdf8, #6366f1)" }}>
            Score: <span>{score}</span>
          </div>
        </div>

        <div className="relative">
          <canvas 
            ref={canvasRef} 
            className="block w-full rounded-[24px]"
            style={{
              background: "linear-gradient(180deg, #0f172a 0%, #1e293b 70%, #020617 100%)",
              boxShadow: "inset 0 0 60px rgba(56, 189, 248, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)"
            }} 
          />

          <AnimatePresence>
            {gameState === "start" && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[24px] text-center"
                style={{ background: "rgba(2, 6, 23, 0.55)", backdropFilter: "blur(12px)" }}
              >
                <h1 className="text-[44px] font-bold mb-3">Premium Dino Game</h1>
                <p className="text-slate-300 text-lg mb-6">Blink to jump over futuristic obstacles.</p>
                <button 
                  onClick={startGame}
                  className="px-8 py-3.5 rounded-full text-white font-extrabold text-lg transition-transform hover:-translate-y-1 hover:scale-105"
                  style={{ 
                    background: "linear-gradient(135deg, #22d3ee, #6366f1)",
                    boxShadow: "0 0 35px rgba(99, 102, 241, 0.6)",
                    border: "none"
                  }}
                >
                  Start Game
                </button>
              </motion.div>
            )}

            {gameState === "gameover" && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[24px] text-center"
                style={{ background: "rgba(2, 6, 23, 0.55)", backdropFilter: "blur(12px)" }}
              >
                <h1 className="text-[44px] font-bold mb-3">Game Over</h1>
                <p className="text-slate-300 text-lg mb-6">Your Score: <span className="text-white font-bold">{score}</span></p>
                <button 
                  onClick={startGame}
                  className="px-8 py-3.5 rounded-full text-white font-extrabold text-lg transition-transform hover:-translate-y-1 hover:scale-105"
                  style={{ 
                    background: "linear-gradient(135deg, #22d3ee, #6366f1)",
                    boxShadow: "0 0 35px rgba(99, 102, 241, 0.6)",
                    border: "none"
                  }}
                >
                  Play Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex justify-between items-center text-sm text-slate-300 mt-4 px-2">
          <span>Press SPACE / BLINK to Jump</span>
          <span>Premium Chrome Dino Style</span>
        </div>
      </div>
    </motion.div>
  );
}
