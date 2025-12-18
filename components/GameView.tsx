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

  // Helper to find conditional, while loop, or repeat loop parent of a node
  // Returns the innermost (most specific) parent that contains the nodeId
  const findConditionalParent = (nodeId: string, node: CodeNode): CodeNode | null => {
    // Don't check if this node is the nodeId itself - we're looking for parents
    if (node.id === nodeId) {
      return null;
    }

    // First, recursively search children to find the innermost parent
    if (node.children) {
      for (const child of node.children) {
        const found = findConditionalParent(nodeId, child);
        if (found) return found; // Return the innermost parent found
      }
    }

    // Then check if this node itself is a parent of nodeId
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
    if (node.type === 'loop' && node.children) {
      // Check if nodeId is in the repeat loop body
      const isInLoop = node.children.some(child =>
        child.id === nodeId || findNodeInTree(nodeId, child)
      );
      if (isInLoop) {
        return node;
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

  // Helper to find a node by ID and return its action name
  const findNodeById = (nodeId: string, node: CodeNode): CodeNode | null => {
    if (node.id === nodeId) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeById(nodeId, child);
        if (found) return found;
      }
    }
    return null;
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isError) return;

      // Check if key is directional
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
        return;

      e.preventDefault();

      const expectedStep = level.solutionTrace[stepIndex];

      if (!expectedStep) {
        // No more steps expected
        return;
      }

      // Debug logging
      const wrappedCursor = wrapPos(cursorPos.x, cursorPos.y, level.gridSize.cols, level.gridSize.rows);

      // Calculate expected position BEFORE executing this step
      // The trace's expectedX/Y is AFTER execution, so we need to work backwards
      let expectedBeforeX: number, expectedBeforeY: number;
      if (stepIndex === 0) {
        // First step: should be at start position
        expectedBeforeX = level.startPos.x;
        expectedBeforeY = level.startPos.y;
      } else {
        // Previous step's end position is where we should be before this step
        const prevStep = level.solutionTrace[stepIndex - 1];
        expectedBeforeX = prevStep.expectedX;
        expectedBeforeY = prevStep.expectedY;
      }
      const expectedBeforeWrapped = wrapPos(expectedBeforeX, expectedBeforeY, level.gridSize.cols, level.gridSize.rows);
      const positionMatches = wrappedCursor.x === expectedBeforeWrapped.x && wrappedCursor.y === expectedBeforeWrapped.y;

      // Find the node to get its action name
      const node = findNodeById(expectedStep.nodeId, level.codeTree);
      const actionName = node?.type === 'action' ? node.action : node?.type || 'unknown';

      console.log(`Step ${stepIndex}: Expected key=${expectedStep.key}, Pressed key=${e.key}, nodeId=${expectedStep.nodeId}`);
      console.log(`  Node type: ${node?.type}, action: ${actionName}`);
      console.log(`  Position BEFORE step: current=(${wrappedCursor.x},${wrappedCursor.y}), expected=(${expectedBeforeWrapped.x},${expectedBeforeWrapped.y}), match=${positionMatches}`);
      console.log(`  Position AFTER step (from trace): (${expectedStep.expectedX},${expectedStep.expectedY})`);

      // Find the parent control structure (if any)
      const conditionalParent = findConditionalParent(expectedStep.nodeId, level.codeTree);

      if (conditionalParent) {
        console.log(`  Parent type: ${conditionalParent.type}, conditionColor: ${conditionalParent.conditionColor}`);
        if (conditionalParent.type === 'loop') {
          console.log(`  🔁 Repeat loop: count=${conditionalParent.count}, current step in trace`);
        }
        // Debug: Show what children the parent has
        const childActions = conditionalParent.children?.map(c =>
          c.type === 'action' ? `${c.id}:${c.action}()` : `${c.id}:${c.type}`
        ) || [];
        console.log(`  Parent children:`, childActions);
        console.log(`  Current step nodeId: ${expectedStep.nodeId}, action: ${actionName}`);

        // Check if this step should actually be in this parent
        const shouldBeInParent = conditionalParent.children?.some(c =>
          c.id === expectedStep.nodeId || findNodeInTree(expectedStep.nodeId, c)
        );
        console.log(`  ✅ Step SHOULD be in this parent: ${shouldBeInParent}`);

        if (!shouldBeInParent) {
          console.log(`  ⚠️  WARNING: Step nodeId ${expectedStep.nodeId} is NOT actually in parent's children!`);
          console.log(`  This suggests the trace has the wrong nodeId for this step.`);
        }
      } else {
        console.log(`  No parent control structure found for nodeId=${expectedStep.nodeId}`);
      }

      // Handle while loops - check condition is met
      if (conditionalParent && conditionalParent.type === 'while' && conditionalParent.conditionColor) {
        const cellKey = `${wrappedCursor.x},${wrappedCursor.y}`;
        const cellColor = level.gridColors[cellKey] || GridColor.None;
        const conditionMet = cellColor === conditionalParent.conditionColor;

        console.log(`  🔄 While loop condition check:`);
        console.log(`     Current position: (${wrappedCursor.x}, ${wrappedCursor.y})`);
        console.log(`     Expected position BEFORE step: (${expectedBeforeWrapped.x}, ${expectedBeforeWrapped.y})`);
        console.log(`     Position matches: ${positionMatches}`);
        console.log(`     Current cell color: ${cellColor}`);
        console.log(`     Required color: ${conditionalParent.conditionColor}`);
        console.log(`     Condition met: ${conditionMet}`);
        console.log(`     Expected step key: ${expectedStep.key}, nodeId: ${expectedStep.nodeId}`);

        // For while loops, the condition must be met before executing the body
        // SIMPLIFIED: Just block execution if condition isn't met
        // The trace should only have steps for when condition IS met
        if (!conditionMet) {
          console.log(`  ❌ While loop condition NOT met - blocking execution`);
          console.log(`     The trace expects this step, but you're on the wrong color.`);
          console.log(`     This indicates a trace generation issue - the trace should not have steps for when condition is false.`);
          setIsError(true);
          setTimeout(() => {
            resetLevel();
          }, 500);
          return;
        }
        console.log(`  ✅ While loop condition met - allowing execution`);
      }

      // Validate the key matches the expected step
      // This works for: regular actions, repeat loops (no condition check needed),
      // while loops (condition already checked above), and conditionals
      if (e.key !== expectedStep.key) {
        // Wrong Input
        console.log(`  ❌ Key mismatch! Expected ${expectedStep.key}, got ${e.key} for nodeId=${expectedStep.nodeId}`);
        console.log(`  📋 Full trace context:`);
        const start = Math.max(0, stepIndex - 3);
        const end = Math.min(level.solutionTrace.length, stepIndex + 3);
        console.log(`  Surrounding trace steps (${start}-${end-1}):`);
        for (let i = start; i < end; i++) {
          const step = level.solutionTrace[i];
          const stepNode = findNodeById(step.nodeId, level.codeTree);
          const stepAction = stepNode?.type === 'action' ? stepNode.action : stepNode?.type || 'unknown';
          const marker = i === stepIndex ? '👉' : '  ';
          console.log(`${marker} Step ${i}: key=${step.key}, nodeId=${step.nodeId}, action=${stepAction}, pos=(${step.expectedX},${step.expectedY})`);
        }
        if (conditionalParent && conditionalParent.type === 'loop') {
          console.log(`  🔁 This was from a repeat loop (count=${conditionalParent.count})`);
        }
        // Check if this might be a missing trace step issue
        if (!conditionalParent && actionName === 'down') {
          console.log(`  ⚠️  This is a standalone 'down()' action with no parent - check if trace step exists`);
        }
        setIsError(true);
        setTimeout(() => {
          resetLevel();
        }, 500);
        return;
      }

      console.log(`  ✅ Key matches - proceeding`);

      // Correct Input - update position and advance to next step
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

  // Determine last executed node (the previous step that was just completed)
  // This helps learners find their place in the code
  // stepIndex points to the NEXT step to execute, so stepIndex - 1 is the last completed step
  const lastExecutedNodeId = stepIndex > 0 && level.solutionTrace[stepIndex - 1]
    ? level.solutionTrace[stepIndex - 1].nodeId
    : null;

  // Debug logging to help diagnose highlighting issues
  useEffect(() => {
    if (lastExecutedNodeId) {
      console.log(`📍 Last executed node: ${lastExecutedNodeId}, stepIndex: ${stepIndex}, activeNodeId: ${activeNodeId}`);
    }
  }, [lastExecutedNodeId, stepIndex, activeNodeId]);

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
            <CodeDisplay node={level.codeTree} activeNodeId={activeNodeId} lastExecutedNodeId={lastExecutedNodeId} />
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
