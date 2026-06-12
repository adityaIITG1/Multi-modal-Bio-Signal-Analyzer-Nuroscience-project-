import React, { useState, useEffect } from "react";
import { Plus, Trash2, ShieldCheck, ChevronLeft } from "lucide-react";

interface Target {
  id: string;
  name: string;
}

export default function CaretakerCyberTargets({ onExit }: { onExit: () => void }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [newTarget, setNewTarget] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("blink_cyber_targets");
    if (saved) {
      try {
        setTargets(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse targets", e);
      }
    }
  }, []);

  const saveTargets = (newTargets: Target[]) => {
    setTargets(newTargets);
    localStorage.setItem("blink_cyber_targets", JSON.stringify(newTargets));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTarget.trim()) return;
    const t = { id: Date.now().toString(), name: newTarget.trim() };
    saveTargets([...targets, t]);
    setNewTarget("");
  };

  const handleDelete = (id: string) => {
    saveTargets(targets.filter((t) => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#0A111F] p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={onExit}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="bg-emerald-500/20 p-4 rounded-2xl border border-emerald-500/30">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Target Manager</h1>
            <p className="text-slate-400">Pre-load Cyber Shield targets for the user.</p>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl mb-8">
          <form onSubmit={handleAdd} className="flex gap-4">
            <input
              type="text"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="Business Name or URL (e.g. Starbucks)"
              className="flex-1 bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all"
            >
              <Plus className="w-5 h-5" />
              Add Target
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white mb-4">Saved Targets ({targets.length})</h2>
          {targets.length === 0 ? (
            <div className="text-center p-8 border border-dashed border-slate-700 rounded-2xl text-slate-500">
              No targets added yet. Use the form above to add one.
            </div>
          ) : (
            targets.map((target) => (
              <div 
                key={target.id}
                className="flex items-center justify-between bg-slate-800 border border-slate-700 p-4 rounded-xl hover:border-slate-600 transition-all"
              >
                <span className="text-lg text-white font-medium">{target.name}</span>
                <button
                  onClick={() => handleDelete(target.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 rounded-lg transition-all"
                  title="Delete Target"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
