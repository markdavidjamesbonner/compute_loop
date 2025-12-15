import React, { useState, useEffect, useCallback, useRef } from "react";
import { LevelData } from "../types";
import { Grid } from "./Grid";
import { CodeDisplay } from "./CodeDisplay";
import { ArrowLeft, RefreshCw, Home } from "lucide-react";

interface GameViewProps {
  level: LevelData;
  onComplete: () => void;
  onExit: () => void;
}

export const GameView: React.FC<GameViewProps> = ({
  level,
  onComplete,
  onExit,
}) => {
  const [cursorPos, setCursorPos] = useState(level.startPos);
  const [stepIndex, setStepIndex] = useState(0); // Which step of the solution we are waiting for
  const [isError, setIsError] = useState(false);

  // Focus ref to capture keyboard events if we wanted a specific div focus,
  // but window listener is better for game feel.

  const resetLevel = useCallback(() => {
    setCursorPos(level.startPos);
    setStepIndex(0);
    setIsError(false);
  }, [level]);

  // Effect to reset when level ID changes
  useEffect(() => {
    resetLevel();
  }, [level.id, resetLevel]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isError) return;

      // Check if key is directional
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
        return;

      e.preventDefault();

      const expectedStep = level.solutionTrace[stepIndex];

      if (e.key === expectedStep.key) {
        // Correct Input
        setCursorPos({ x: expectedStep.expectedX, y: expectedStep.expectedY });

        const nextIndex = stepIndex + 1;
        setStepIndex(nextIndex);

        if (nextIndex >= level.solutionTrace.length) {
          // Level Complete
          setTimeout(() => {
            onComplete();
          }, 300);
        }
      } else {
        // Wrong Input
        setIsError(true);
        setTimeout(() => {
          resetLevel();
        }, 500);
      }
    },
    [level, stepIndex, isError, onComplete, resetLevel]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Determine active node for code highlighting
  // The trace step contains the node ID that *generated* that move.
  // If we are waiting for step 0, we highlight trace[0].nodeId.
  const activeNodeId = level.solutionTrace[stepIndex]?.nodeId || null;

  return (
    <div className="flex flex-col min-h-screen max-w-5xl mx-auto p-4 md:p-6 gap-6 overflow-y-auto">


      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={onExit}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
        >
          <Home className="w-6 h-6 text-gray-600" />
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          Level {level.id + 1}
        </h2>
        <button
          onClick={resetLevel}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
        >
          <RefreshCw className="w-6 h-6 text-gray-600" />
        </button>
      </div>


      {/* Game Area */}
      <div className="flex-1 flex flex-col md:flex-row gap-8 items-center md:items-start justify-center min-h-0">

        {/* Left: Code Panel */}
        <div className="w-full md:w-3/5 bg-white rounded-xl shadow-lg p-6 overflow-y-auto border-l-4 border-yellow-400 min-h-[300px] max-h-full flex flex-col">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 shrink-0">
            Program
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <CodeDisplay node={level.codeTree} activeNodeId={activeNodeId} />
          </div>
          <div className="mt-auto pt-6 text-sm text-gray-400 text-center shrink-0">
            Use your keyboard arrow keys to run the code.
          </div>
        </div>

        {/* Right: Grid */}
        <div className="w-full md:w-2/5 flex items-center justify-center">
          <Grid level={level} cursorPos={cursorPos} isError={isError} />
        </div>

      </div>


      {/* Progress Bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden shrink-0 w-full max-w-md mx-auto">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{
            width: `${(stepIndex / level.solutionTrace.length) * 100}%`,
          }}
        ></div>
      </div>


    </div>
  );
};
