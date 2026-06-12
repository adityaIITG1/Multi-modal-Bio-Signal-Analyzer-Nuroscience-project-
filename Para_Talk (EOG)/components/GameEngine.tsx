"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export type GameType = "flappy" | "jump" | "shooter" | "basket" | "rocket" | "tunnel" | "aim";

interface GameEngineProps {
  game: GameType;
  onClose: () => void;
}

export default function GameEngine({ game, onClose }: GameEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"start" | "playing" | "gameover">("start");
  const [score, setScore] = useState(0);

  const requestRef = useRef<number>(0);
  const stateRef = useRef({
    running: false,
    score: 0,
    frame: 0,
    player: { x: 100, y: 220, w: 40, h: 40, dy: 0, lane: 1, angle: 0, power: 0 },
    objects: [] as any[],
    bullets: [] as any[],
    target: { x: 700, y: 220, r: 35, dir: 1 }
  });

  const getGameName = () => {
    const names: Record<GameType, string> = {
      flappy: "Flappy Bird",
      jump: "Geometry Jump",
      shooter: "Space Shooter",
      basket: "Basketball Timing",
      rocket: "Rocket Landing",
      tunnel: "Cyber Tunnel",
      aim: "Aim Challenge"
    };
    return names[game];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 900;
    canvas.height = 440;

    const hit = (a: any, b: any) => {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    };

    const round = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const endGame = () => {
      stateRef.current.running = false;
      setGameState("gameover");
    };

    const bg = (st: any) => {
      ctx.clearRect(0, 0, 900, 440);
      let g = ctx.createLinearGradient(0, 0, 0, 440);
      g.addColorStop(0, "#0f172a");
      g.addColorStop(1, "#020617");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 900, 440);

      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = "#7dd3fc";
        ctx.fillRect((i * 97 + st.frame) % 900, (i * 53) % 250, 2, 2);
      }

      ctx.fillStyle = "#334155";
      ctx.fillRect(0, 390, 900, 50);
    };

    const drawPlayer = (st: any, color = "#38bdf8") => {
      const p = st.player;
      ctx.save();
      ctx.shadowBlur = 25;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      round(p.x, p.y, p.w, p.h, 12);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "white";
      ctx.beginPath(); ctx.arc(p.x + 12, p.y + 14, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + 28, p.y + 14, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    // --- GAME LOGICS ---
    const flappy = (st: any) => {
      st.player.dy += 0.35; st.player.y += st.player.dy;
      if (st.frame % 90 === 0) {
        let gap = 135, top = Math.random() * 170 + 40;
        st.objects.push({ x: 900, top: top, bottom: top + gap });
      }
      st.objects.forEach((o: any) => {
        o.x -= 4;
        ctx.fillStyle = "#22c55e";
        round(o.x, 0, 60, o.top, 12); ctx.fill();
        round(o.x, o.bottom, 60, 440 - o.bottom, 12); ctx.fill();
        if (st.player.x < o.x + 60 && st.player.x + st.player.w > o.x && (st.player.y < o.top || st.player.y + st.player.h > o.bottom)) endGame();
      });
      if (st.player.y < 0 || st.player.y > 390) endGame();
      drawPlayer(st);
    };

    const jump = (st: any) => {
      st.player.y += st.player.dy;
      st.player.dy += 0.7;
      if (st.player.y > 350) { st.player.y = 350; st.player.dy = 0; }

      if (st.frame % 80 === 0) st.objects.push({ x: 900, y: 350, w: 35, h: 40 });
      st.objects.forEach((o: any) => {
        o.x -= 6;
        ctx.fillStyle = "#f43f5e";
        ctx.beginPath();
        ctx.moveTo(o.x, o.y + 40); ctx.lineTo(o.x + 18, o.y); ctx.lineTo(o.x + 35, o.y + 40);
        ctx.fill();
        if (hit(st.player, o)) endGame();
      });
      drawPlayer(st, "#a78bfa");
    };

    const shooter = (st: any) => {
      st.player.y = 220 + Math.sin(st.frame / 25) * 90;
      drawPlayer(st, "#22d3ee");

      if (st.frame % 55 === 0) st.objects.push({ x: 900, y: Math.random() * 330 + 40, w: 40, h: 40 });

      st.bullets.forEach((b: any) => {
        b.x += 10;
        ctx.fillStyle = "#facc15";
        ctx.fillRect(b.x, b.y, 20, 5);
      });

      st.objects.forEach((o: any) => {
        o.x -= 3.5;
        ctx.fillStyle = "#ef4444";
        round(o.x, o.y, o.w, o.h, 10); ctx.fill();

        st.bullets.forEach((b: any) => {
          if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
            o.dead = true; b.dead = true; st.score += 10;
          }
        });
        if (hit(st.player, o)) endGame();
      });

      st.objects = st.objects.filter((o: any) => !o.dead && o.x > -50);
      st.bullets = st.bullets.filter((b: any) => !b.dead && b.x < 900);
    };

    const basket = (st: any) => {
      ctx.fillStyle = "#f97316";
      ctx.beginPath(); ctx.arc(180, 300, 28, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = "white"; ctx.lineWidth = 5;
      ctx.strokeRect(690, 120, 90, 60);
      ctx.beginPath(); ctx.arc(735, 190, 35, 0, Math.PI); ctx.stroke();

      st.player.power = (Math.sin(st.frame / 15) + 1) / 2;
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(100, 380, st.player.power * 300, 20);
      ctx.fillStyle = "white"; ctx.font = "bold 16px Arial"; ctx.fillText("Press SPACE when power is near center", 100, 360);
    };

    const rocket = (st: any) => {
      st.player.x = 430; st.player.w = 44; st.player.h = 70;
      st.player.dy += 0.18; st.player.y += st.player.dy;

      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.moveTo(st.player.x + 22, st.player.y);
      ctx.lineTo(st.player.x + 44, st.player.y + 70);
      ctx.lineTo(st.player.x, st.player.y + 70);
      ctx.fill();

      ctx.fillStyle = "#22c55e";
      ctx.fillRect(360, 390, 180, 12);

      if (st.player.y + 70 >= 390) {
        if (Math.abs(st.player.dy) < 3) {
          st.score += 50; 
          st.player.y = 100;
          st.player.dy = 0;
        } else {
          endGame();
        }
      }
    };

    const tunnel = (st: any) => {
      let lanes = [110, 220, 330];
      st.player.y = lanes[st.player.lane]; st.player.x = 120;

      ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2;
      lanes.forEach(y => { ctx.beginPath(); ctx.moveTo(0, y + 20); ctx.lineTo(900, y + 20); ctx.stroke(); });

      if (st.frame % 65 === 0) {
        st.objects.push({ x: 900, lane: Math.floor(Math.random() * 3), w: 45, h: 45 });
      }

      st.objects.forEach((o: any) => {
        o.x -= 7;
        o.y = lanes[o.lane];
        ctx.fillStyle = "#ef4444";
        round(o.x, o.y, o.w, o.h, 10); ctx.fill();
        if (st.player.lane === o.lane && st.player.x + 40 > o.x && st.player.x < o.x + 45) endGame();
      });

      drawPlayer(st, "#06b6d4");
    };

    const aim = (st: any) => {
      st.target.x += st.target.dir * 5;
      if (st.target.x > 850 || st.target.x < 80) st.target.dir *= -1;

      ctx.fillStyle = "#ef4444";
      ctx.beginPath(); ctx.arc(st.target.x, st.target.y, st.target.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "white";
      ctx.beginPath(); ctx.arc(st.target.x, st.target.y, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath(); ctx.arc(st.target.x, st.target.y, 7, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(450, 0); ctx.lineTo(450, 440); ctx.stroke();

      ctx.fillStyle = "white"; ctx.font = "bold 16px Arial";
      ctx.fillText("Blink when target crosses center line", 320, 370);
    };

    const loop = () => {
      const st = stateRef.current;
      if (!st.running) {
        // Just draw static bg
        bg(st);
        if (game === "basket") basket(st);
        if (game === "rocket") rocket(st);
        if (game === "aim") aim(st);
        if (game === "tunnel") tunnel(st);
        if (game === "shooter") shooter(st);
        if (game === "jump") jump(st);
        if (game === "flappy") flappy(st);
        requestRef.current = requestAnimationFrame(loop);
        return;
      }

      st.frame++; 
      if (game !== "basket" && game !== "aim") st.score++;
      setScore(st.score);

      bg(st);

      if (game === "flappy") flappy(st);
      if (game === "jump") jump(st);
      if (game === "shooter") shooter(st);
      if (game === "basket") basket(st);
      if (game === "rocket") rocket(st);
      if (game === "tunnel") tunnel(st);
      if (game === "aim") aim(st);

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, [game]);

  const resetGame = () => {
    stateRef.current = {
      running: true,
      score: 0,
      frame: 0,
      player: { x: 100, y: 220, w: 40, h: 40, dy: 0, lane: 1, angle: 0, power: 0 },
      objects: [],
      bullets: [],
      target: { x: 700, y: 220, r: 35, dir: 1 }
    };
    setScore(0);
  };

  const startGame = () => {
    resetGame();
    setGameState("playing");
  };

  const handleAction = () => {
    const st = stateRef.current;
    if (!st.running) {
      startGame();
      return;
    }

    if (game === "flappy") st.player.dy = -7;
    if (game === "jump" && st.player.y >= 350) st.player.dy = -13;
    if (game === "shooter") st.bullets.push({ x: st.player.x + 45, y: st.player.y + 15 });
    if (game === "basket") {
      let diff = Math.abs(st.player.power - 0.55);
      if (diff < 0.12) st.score += 10; else st.score -= 5;
    }
    if (game === "rocket") st.player.dy -= 2.8;
    if (game === "tunnel") st.player.lane = (st.player.lane + 1) % 3;
    if (game === "aim") {
      if (Math.abs(st.target.x - 450) < 35) st.score += 10; else st.score -= 3;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        handleAction();
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md"
    >
      <div 
        className="relative w-full max-w-[950px] rounded-[32px] p-6 text-white overflow-hidden"
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
            🎮 {getGameName()}
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
              background: "#07111f",
              boxShadow: "inset 0 0 60px rgba(56, 189, 248, 0.05)",
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
                <h1 className="text-[44px] font-bold mb-3">{getGameName()}</h1>
                <p className="text-slate-300 text-lg mb-6">Press SPACE or Blink to play</p>
                <button 
                  onClick={startGame}
                  className="px-8 py-3.5 rounded-full text-white font-extrabold text-lg transition-transform hover:-translate-y-1 hover:scale-105"
                  style={{ 
                    background: "linear-gradient(135deg, #38bdf8, #6366f1)",
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
                <p className="text-slate-300 text-lg mb-6">Final Score: <span className="text-white font-bold">{score}</span></p>
                <button 
                  onClick={startGame}
                  className="px-8 py-3.5 rounded-full text-white font-extrabold text-lg transition-transform hover:-translate-y-1 hover:scale-105"
                  style={{ 
                    background: "linear-gradient(135deg, #38bdf8, #6366f1)",
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
      </div>
    </motion.div>
  );
}
