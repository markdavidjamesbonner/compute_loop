import React, { useEffect, useRef } from 'react';
import { Lock, Play, Check } from 'lucide-react';

interface LevelMapProps {
  unlockedLevel: number;
  onSelectLevel: (level: number) => void;
}

export const LevelMap: React.FC<LevelMapProps> = ({ unlockedLevel, onSelectLevel }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate a list of "endless" levels for the map visual
  // We'll show a bit more than what's unlocked to show progress possibility
  const totalVisible = Math.max(unlockedLevel + 5, 20);
  const levels = Array.from({ length: totalVisible }, (_, i) => i);

  // Auto scroll to latest unlocked
  useEffect(() => {
    if (scrollRef.current) {
       // Simple logic: scroll to bottom if levels grow downwards, but here let's flow nicely
       // Actually, let's just ensure the unlocked one is in view.
       // For this simple demo, we won't over-engineer scrolling.
    }
  }, [unlockedLevel]);

  return (
    <div className="flex flex-col items-center bg-slate-100 p-6 w-full min-h-screen">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2 shrink-0">
            jake's wicked function solving game
        </h1>
        <p className="text-slate-500 mb-8 shrink-0">execute the code - become the computer.</p>

        <div className="relative w-full max-w-md pb-20" ref={scrollRef}>
            <div className="flex flex-wrap justify-center gap-4">
                {levels.map((lvl) => {
                    const isLocked = lvl > unlockedLevel;
                    const isCompleted = lvl < unlockedLevel;
                    const isCurrent = lvl === unlockedLevel;

                    let bgClass = "bg-gray-300";
                    if (isCompleted) bgClass = "bg-emerald-500 hover:bg-emerald-600";
                    if (isCurrent) bgClass = "bg-amber-400 hover:bg-amber-500 animate-pulse-slow";
                    if (isLocked) bgClass = "bg-slate-200";

                    return (
                        <button
                            key={lvl}
                            disabled={isLocked}
                            onClick={() => onSelectLevel(lvl)}
                            className={`
                                w-16 h-16 rounded-full flex items-center justify-center
                                text-white font-bold text-xl shadow-md transition-all
                                transform hover:scale-105 active:scale-95
                                ${bgClass}
                                ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                            `}
                        >
                            {isLocked ? (
                                <Lock className="w-6 h-6 text-slate-400" />
                            ) : isCompleted ? (
                                <span className="flex flex-col items-center">
                                    <span className="text-sm opacity-80">{lvl + 1}</span>
                                    <Check className="w-5 h-5" />
                                </span>
                            ) : (
                                <span className="text-white drop-shadow-md">{lvl + 1}</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>

        <div className="text-slate-400 text-sm shrink-0 pb-6">
            Procedurally generated endless levels
        </div>
    </div>
  );
};
