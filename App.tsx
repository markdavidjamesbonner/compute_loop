import React, { useState, useMemo } from 'react';
import { LevelMap } from './components/LevelMap';
import { GameView } from './components/GameView';
import { generateLevel } from './services/levelGenerator';
import { LevelData } from './types';

function App() {
    const [gameState, setGameState] = useState<'map' | 'playing'>('map');

    // Set to high number to unlock all levels for testing
    const [unlockedLevel, setUnlockedLevel] = useState(13);

    const [currentLevelId, setCurrentLevelId] = useState(0);

  // Memoize level data so it doesn't regenerate on every render, only when ID changes
  // In a real app, we might store generated levels to avoid them changing if user re-enters same ID.
  // For this demo, re-generating implies "infinite variations", but let's try to keep it stable per session.
  const [levelCache, setLevelCache] = useState<Record<number, LevelData>>({});

  const loadLevel = (id: number) => {
    setCurrentLevelId(id);
    setGameState('playing');
  };

  const currentLevelData = useMemo(() => {
    if (levelCache[currentLevelId]) {
        return levelCache[currentLevelId];
    }
    const newData = generateLevel(currentLevelId);
    setLevelCache(prev => ({ ...prev, [currentLevelId]: newData }));
    return newData;
  }, [currentLevelId, levelCache]);

  const handleLevelComplete = () => {
    if (currentLevelId === unlockedLevel) {
        setUnlockedLevel(prev => prev + 1);
    }
    // Optional: Auto-advance
    // setCurrentLevelId(prev => prev + 1);
    // Or go back to map
    setGameState('map');
  };

  return (
    <div className="min-h-screen w-full bg-[#f3f4f6] text-slate-800 overflow-y-auto">
      {gameState === 'map' ? (
        <LevelMap
            unlockedLevel={unlockedLevel}
            selectedLevel={currentLevelId}
            onSelectLevel={loadLevel}
        />
      ) : (
        <GameView
            level={currentLevelData}
            onComplete={handleLevelComplete}
            onExit={() => setGameState('map')}
        />
      )}
    </div>
  );
}

export default App;
