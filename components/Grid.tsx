import React from 'react';
import { LevelData, GridColor } from '../types';

interface GridProps {
  level: LevelData;
  cursorPos: { x: number; y: number };
  isError: boolean;
}

export const Grid: React.FC<GridProps> = ({ level, cursorPos, isError }) => {
  const { gridSize, gridColors } = level;
  
  // Create grid cells
  const cells = [];
  for (let y = 0; y < gridSize.rows; y++) {
    for (let x = 0; x < gridSize.cols; x++) {
      const key = `${x},${y}`;
      const color = gridColors[key] || GridColor.None;
      cells.push({ x, y, color, key });
    }
  }

  return (
    <div 
      className={`grid gap-3 p-4 bg-white rounded-xl shadow-sm transition-transform duration-300 ${isError ? 'animate-shake' : ''}`}
      style={{ 
        gridTemplateColumns: `repeat(${gridSize.cols}, minmax(0, 1fr))`,
      }}
    >
      {cells.map(cell => {
        const isCursor = cell.x === cursorPos.x && cell.y === cursorPos.y;
        
        return (
          <div 
            key={cell.key}
            className={`
              w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center
              transition-all duration-300 relative
              ${cell.color}
            `}
          >
             {/* Cursor Indicator */}
             <div className={`
                absolute inset-0 rounded-full border-4 border-slate-800 transition-opacity duration-200
                ${isCursor ? 'opacity-100 scale-110' : 'opacity-0 scale-90'}
                ${isError && isCursor ? 'border-red-600' : ''}
             `}></div>
             
             {/* Inner white dot for empty cells to make them look like "slots" */}
             {cell.color === GridColor.None && (
                 <div className="w-4 h-4 bg-white/40 rounded-full"></div>
             )}
          </div>
        );
      })}
      
      <style>{`
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        .animate-shake {
            animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </div>
  );
};
