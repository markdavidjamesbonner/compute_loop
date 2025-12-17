import React, { useState, useEffect, useCallback, useRef } from "react";
import { LevelData, CodeNode, GridColor } from "../types";
import { Grid } from "./Grid";
import { CodeDisplay } from "./CodeDisplay";
import { ArrowLeft, RefreshCw, Home } from "lucide-react";

// Wrap coordinates to create a toroidal grid (wraps around edges)
const wrapPos = (x: number, y: number, cols: number, rows: number) => {
  // Handle negative modulo correctly
  const wrappedX = ((x % cols) + cols) % cols;
  const wrappedY = ((y % rows) + rows) % rows;
  return { x: wrappedX, y: wrappedY };
};

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
  const codeScrollRef = useRef<HTMLDivElement>(null);
  const userScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Helper to find conditional or while loop parent of a node
  const findConditionalParent = (nodeId: string, node: CodeNode): CodeNode | null => {
    if (node.type === 'conditional' && node.children) {
      // Check if nodeId is in any branch of the conditional
      const isInConditional = node.children.some(child =>
        child.id === nodeId || findNodeInTree(nodeId, child)
      );
      if (isInConditional) {
        return node;
      }
    }
    if (node.type === 'while' && node.children) {
      // Check if nodeId is in the while loop body
      const isInWhile = node.children.some(child =>
        child.id === nodeId || findNodeInTree(nodeId, child)
      );
      if (isInWhile) {
        return node;
      }
    }
    if (node.children) {
      for (const child of node.children) {
        const found = findConditionalParent(nodeId, child);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper to recursively find a node in the tree
  const findNodeInTree = (nodeId: string, node: CodeNode): boolean => {
    if (node.id === nodeId) return true;
    if (node.children) {
      return node.children.some(child => findNodeInTree(nodeId, child));
    }
    return false;
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isError) return;

      // Check if key is directional
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
        return;

      e.preventDefault();

      const expectedStep = level.solutionTrace[stepIndex];

      // Check if this step is from a conditional or while loop
      const conditionalParent = findConditionalParent(expectedStep.nodeId, level.codeTree);

      if (conditionalParent && conditionalParent.conditionColor) {
        // This is a conditional or while loop step - verify the color condition
        const wrappedCursor = wrapPos(cursorPos.x, cursorPos.y, level.gridSize.cols, level.gridSize.rows);
        const cellKey = `${wrappedCursor.x},${wrappedCursor.y}`;
        const cellColor = level.gridColors[cellKey] || GridColor.None;

        // Map action names to directions
        const ACTION_TO_DIRECTION: Record<string, string> = {
          'up': 'ArrowUp',
          'down': 'ArrowDown',
          'left': 'ArrowLeft',
          'right': 'ArrowRight'
        };

        if (conditionalParent.type === 'while') {
          // For while loops, the condition must be true (cell color matches)
          const conditionMet = cellColor === conditionalParent.conditionColor;

          if (!conditionMet) {
            // Condition is false, but we're still in the loop - this shouldn't happen in trace
            // But we'll allow it if the key matches the trace
            if (e.key === expectedStep.key) {
              const wrapped = wrapPos(expectedStep.expectedX, expectedStep.expectedY, level.gridSize.cols, level.gridSize.rows);
              setCursorPos(wrapped);
              const nextIndex = stepIndex + 1;
              setStepIndex(nextIndex);
              if (nextIndex >= level.solutionTrace.length) {
                setTimeout(() => onComplete(), 300);
              }
            } else {
              setIsError(true);
              setTimeout(() => resetLevel(), 500);
            }
          } else {
            // Condition is true, verify the action matches
            const traceExpectedAction = conditionalParent.children?.find(
              child => child.id === expectedStep.nodeId || findNodeInTree(expectedStep.nodeId, child)
            );
            const traceExpectedDirection = traceExpectedAction?.action
              ? ACTION_TO_DIRECTION[traceExpectedAction.action]
              : null;

            if (e.key === expectedStep.key && (traceExpectedDirection === null || e.key === traceExpectedDirection)) {
              const wrapped = wrapPos(expectedStep.expectedX, expectedStep.expectedY, level.gridSize.cols, level.gridSize.rows);
              setCursorPos(wrapped);
              const nextIndex = stepIndex + 1;
              setStepIndex(nextIndex);
              if (nextIndex >= level.solutionTrace.length) {
                setTimeout(() => onComplete(), 300);
              }
            } else {
              setIsError(true);
              setTimeout(() => resetLevel(), 500);
            }
          }
        } else {
          // This is a conditional (if/else-if/else)
          const conditionMet = cellColor === conditionalParent.conditionColor;

          // Find which branch the trace expects
          let traceExpectedBranchIndex = -1;
          for (let i = 0; i < (conditionalParent.children?.length || 0); i++) {
            const child = conditionalParent.children![i];
            if (child.id === expectedStep.nodeId || findNodeInTree(expectedStep.nodeId, child)) {
              traceExpectedBranchIndex = i;
              break;
            }
          }

          // Determine which branch should be taken based on current cell color
          // For else-if chains: check each branch color until one matches
          let expectedBranchIndex = (conditionalParent.children?.length || 1) - 1; // Default to else
          if (conditionMet) {
            expectedBranchIndex = 0; // If branch
          } else {
            // Check else-if branches (if any)
            // For simplicity, we'll check if the color matches any of the other branch colors
            // Since we don't store branch colors explicitly, we'll use the trace expectation
            expectedBranchIndex = traceExpectedBranchIndex >= 0 ? traceExpectedBranchIndex : expectedBranchIndex;
          }

          const traceExpectedAction = traceExpectedBranchIndex >= 0
            ? conditionalParent.children![traceExpectedBranchIndex]
            : null;
          const traceExpectedDirection = traceExpectedAction?.action
            ? ACTION_TO_DIRECTION[traceExpectedAction.action]
            : null;

          // Verify that the pressed key matches the trace expectation
          const keyMatchesTrace = e.key === expectedStep.key;
          const keyMatchesExpectedDirection = traceExpectedDirection ? e.key === traceExpectedDirection : true;

          if (keyMatchesTrace && keyMatchesExpectedDirection) {
            const wrapped = wrapPos(expectedStep.expectedX, expectedStep.expectedY, level.gridSize.cols, level.gridSize.rows);
            setCursorPos(wrapped);
            const nextIndex = stepIndex + 1;
            setStepIndex(nextIndex);
            if (nextIndex >= level.solutionTrace.length) {
              setTimeout(() => onComplete(), 300);
            }
          } else {
            setIsError(true);
            setTimeout(() => resetLevel(), 500);
          }
        }
      } else {
        // Regular step (not a conditional)
        if (e.key === expectedStep.key) {
          // Correct Input
          // Wrap coordinates to ensure they're in bounds (should already be wrapped, but safety check)
          const wrapped = wrapPos(expectedStep.expectedX, expectedStep.expectedY, level.gridSize.cols, level.gridSize.rows);
          setCursorPos(wrapped);

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
      }
    },
    [level, stepIndex, isError, onComplete, resetLevel, cursorPos]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Determine active node for code highlighting
  // The trace step contains the node ID that *generated* that move.
  // If we are waiting for step 0, we highlight trace[0].nodeId.
  const activeNodeId = level.solutionTrace[stepIndex]?.nodeId || null;

  // Track manual scrolling to prevent auto-scroll interference
  useEffect(() => {
    const scrollContainer = codeScrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      userScrollingRef.current = true;
      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      // Reset user scrolling flag after a delay
      scrollTimeoutRef.current = setTimeout(() => {
        userScrollingRef.current = false;
      }, 1000);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Auto-scroll code panel to active node when stepIndex changes
  // Only auto-scroll if user hasn't manually scrolled recently
  useEffect(() => {
    if (activeNodeId && codeScrollRef.current && !userScrollingRef.current) {
      // Small delay to ensure DOM is updated
      const timeoutId = setTimeout(() => {
        if (!userScrollingRef.current && codeScrollRef.current) {
          const activeElement = codeScrollRef.current.querySelector(`[data-node-id="${activeNodeId}"]`);
          if (activeElement) {
            // Scroll the active element into view with some padding
            activeElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            });
          }
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [activeNodeId]);

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto overflow-hidden">

      {/* Header with Progress Bar */}
      <div className="shrink-0 p-4 md:p-6 pb-2">
        <div className="flex items-center justify-between mb-4">
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
        {/* Progress Bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden w-full max-w-md mx-auto">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{
              width: `${(stepIndex / level.solutionTrace.length) * 100}%`,
            }}
          ></div>
        </div>
      </div>

      {/* 🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨 game area */}
      {/* 🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨 */}
      <div className="flex-1 flex flex-col md:flex-row gap-8 items-start justify-start min-h-0 overflow-hidden px-4 md:px-6 pb-4 md:pb-6">

        {/* 🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨 left: code panel */}
        <div className="w-full md:w-2/3 bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-400 flex flex-col overflow-hidden h-full">

          <div className="mt-auto text-sm text-gray-900 shrink-0 pb-3">
            Use your keyboard arrow keys to call the functions.
          </div>

          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-10 shrink-0">
            program
          </div>

          <div
            ref={codeScrollRef}
            className="flex-1 overflow-y-auto min-h-0 scroll-smooth"
            style={{ scrollBehavior: 'smooth' }}
          >
            <CodeDisplay node={level.codeTree} activeNodeId={activeNodeId} />
          </div>

        </div>

        {/* 🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨 right: grid - sticky */}
        {/* 🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨 */}
        <div className="w-full md:w-1/3 flex items-center justify-center shrink-0 sticky top-0 self-start">
          <Grid level={level} cursorPos={cursorPos} isError={isError} />
        </div>

      </div>

    </div>
  );
};
