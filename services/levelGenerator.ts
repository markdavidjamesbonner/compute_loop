import { LevelData, CodeNode, TraceStep, Direction, GridColor } from '../types';

let nodeIdCounter = 0;
const generateId = () => `node-${nodeIdCounter++}`;

const DIRECTIONS: Direction[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const ACTION_NAMES: Record<Direction, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const COLS = 5;
const ROWS = 6;

const isValidPos = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < ROWS;

const movePos = (x: number, y: number, dir: Direction) => {
  switch (dir) {
    case 'ArrowUp': return { x, y: y - 1 };
    case 'ArrowDown': return { x, y: y + 1 };
    case 'ArrowLeft': return { x: x - 1, y };
    case 'ArrowRight': return { x: x + 1, y };
  }
};

interface SimulationState {
  x: number;
  y: number;
  gridColors: Record<string, GridColor>;
  trace: TraceStep[];
}

// Helper: Check if a sequence of moves is valid starting from (x,y)
const checkPath = (x: number, y: number, moves: Direction[]): { valid: boolean; finalX: number; finalY: number } => {
  let cx = x;
  let cy = y;
  for (const move of moves) {
    const next = movePos(cx, cy, move);
    if (!isValidPos(next.x, next.y)) return { valid: false, finalX: cx, finalY: cy };
    cx = next.x;
    cy = next.y;
  }
  return { valid: true, finalX: cx, finalY: cy };
};

export const generateLevel = (levelIndex: number): LevelData => {
  nodeIdCounter = 0;
  
  // Accelerated Difficulty:
  // Level 0: Intro (Linear)
  // Level 1-2: Simple Loops
  // Level 3-5: Multi-action Loops
  // Level 6+: Conditionals + Loops
  const difficulty = levelIndex; 
  
  const startX = Math.floor(Math.random() * (COLS - 2)) + 1;
  const startY = Math.floor(Math.random() * (ROWS - 2)) + 1;

  const rootNode: CodeNode = {
    id: generateId(),
    type: 'root',
    children: []
  };

  const simState: SimulationState = {
    x: startX,
    y: startY,
    gridColors: {},
    trace: []
  };

  const targetSteps = 5 + Math.min(20, Math.floor(levelIndex * 1.5));
  let stepsGenerated = 0;
  let attempts = 0;

  while (stepsGenerated < targetSteps && attempts < 100) {
    attempts++;
    const remaining = targetSteps - stepsGenerated;
    
    // Feature flags based on difficulty
    const allowLoop = difficulty >= 1 && remaining >= 3;
    const allowMultiStepLoop = difficulty >= 3 && remaining >= 4;
    const allowConditional = difficulty >= 5 && remaining >= 1;

    // Priorities: Complex structures > Simple Moves
    const rand = Math.random();

    // --- TRY GENERATING A LOOP ---
    if (allowLoop && rand < 0.7) { 
        const loopCount = Math.floor(Math.random() * 3) + 2; // 2 to 4 iterations
        const bodyLength = (allowMultiStepLoop && Math.random() > 0.5) ? 2 : 1;
        
        if (remaining < loopCount * bodyLength) {
             // Not enough steps for this specific loop, try simpler move next iteration
             continue; 
        }

        // We need to find a sequence of `bodyLength` moves that can be repeated `loopCount` times
        // Brute force search for a valid sequence
        let bestSequence: Direction[] | null = null;
        
        for(let t=0; t<20; t++) { // 20 trials to find a valid loop body
            const candidateSeq: Direction[] = [];
            // Generate random candidate sequence
            let cx = simState.x; // temp vars for generation only
            let cy = simState.y;
            
            // Note: We don't check validity deep here, we check validity of the *Repeated* sequence below
            // But we should pick valid single moves to increase success rate
            let tempSeqValid = true;
            for(let b=0; b<bodyLength; b++) {
                 const possible = DIRECTIONS.filter(d => {
                     const n = movePos(cx, cy, d);
                     return isValidPos(n.x, n.y);
                 });
                 if(possible.length === 0) { tempSeqValid = false; break; }
                 const m = possible[Math.floor(Math.random() * possible.length)];
                 candidateSeq.push(m);
                 const n = movePos(cx, cy, m);
                 cx = n.x; cy = n.y;
            }
            if(!tempSeqValid) continue;

            // Now check if repeating this candidate sequence `loopCount` times is valid
            // We must reset to actual simState start for the check
            const fullSequence: Direction[] = [];
            for(let k=0; k<loopCount; k++) fullSequence.push(...candidateSeq);
            
            const check = checkPath(simState.x, simState.y, fullSequence);
            if (check.valid) {
                bestSequence = candidateSeq;
                break;
            }
        }

        if (bestSequence) {
            // Success! Add Loop Node
            const loopNode: CodeNode = {
                id: generateId(),
                type: 'loop',
                count: loopCount,
                children: bestSequence.map(dir => ({
                    id: generateId(),
                    type: 'action',
                    action: ACTION_NAMES[dir]
                }))
            };
            rootNode.children?.push(loopNode);

            // Update Sim State
            for (let i = 0; i < loopCount; i++) {
                for (let b = 0; b < bestSequence.length; b++) {
                    const dir = bestSequence[b];
                    // Find the child node ID corresponding to this action in the loop body
                    const actionNodeId = loopNode.children![b].id;
                    
                    simState.trace.push({
                        key: dir,
                        nodeId: actionNodeId,
                        expectedX: 0, expectedY: 0 // filled later
                    });
                    const next = movePos(simState.x, simState.y, dir);
                    simState.x = next.x;
                    simState.y = next.y;
                }
            }
            stepsGenerated += loopCount * bodyLength;
            continue;
        }
    }

    // --- TRY GENERATING A CONDITIONAL ---
    if (allowConditional && rand > 0.6) {
        // if (Blue) { A } else { B }
        // We force the condition to be true (or false) by painting the grid
        
        // Find two valid distinct moves if possible
        const validMoves = DIRECTIONS.filter(d => isValidPos(movePos(simState.x, simState.y, d).x, movePos(simState.x, simState.y, d).y));
        
        if (validMoves.length >= 1) {
            const chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];
            // Pick a different move for the 'else' branch if possible, otherwise just a random one (gameplay wise it doesn't matter if we don't take it, but visually better if distinct)
            const otherMove = DIRECTIONS.find(d => d !== chosenMove) || DIRECTIONS[0];

            const conditionColor = Math.random() > 0.5 ? GridColor.Blue : GridColor.Red;
            const takeTrueBranch = Math.random() > 0.5;
            
            // Paint the cell
            const key = `${simState.x},${simState.y}`;
            if (takeTrueBranch) {
                simState.gridColors[key] = conditionColor;
            } else {
                // Paint it something else or leave empty to fail the condition
                // To ensure 'else' is triggered, we can just NOT paint it the condition color.
                // But to make it interesting, let's paint it a DIFFERENT color if possible, or just leave it.
                // Let's leave it empty or existing color if not matching.
                if (simState.gridColors[key] === conditionColor) {
                    // It was already painted the condition color! We must overwrite or pick different logic.
                    // For simplicity, let's force the branch that matches the EXISTING color if it exists.
                    // (Skipping complex existing color logic for this demo, just overwriting is safest for generator)
                    simState.gridColors[key] = GridColor.None; 
                }
            }

            const ifNode: CodeNode = {
                id: generateId(),
                type: 'conditional',
                conditionColor: conditionColor,
                children: [
                    { id: generateId(), type: 'action', action: ACTION_NAMES[chosenMove] }, // True
                    { id: generateId(), type: 'action', action: ACTION_NAMES[otherMove] }   // False
                ]
            };
            rootNode.children?.push(ifNode);

            // Update Sim State
            const actualMove = takeTrueBranch ? chosenMove : otherMove;
            const activeNodeIndex = takeTrueBranch ? 0 : 1;
            
            simState.trace.push({
                key: actualMove,
                nodeId: ifNode.children![activeNodeIndex].id,
                expectedX: 0, expectedY: 0
            });
            const next = movePos(simState.x, simState.y, actualMove);
            simState.x = next.x;
            simState.y = next.y;
            stepsGenerated++;
            continue;
        }
    }

    // --- FALLBACK: SINGLE MOVE ---
    const validMoves = DIRECTIONS.filter(d => {
        const n = movePos(simState.x, simState.y, d);
        return isValidPos(n.x, n.y);
    });

    if (validMoves.length === 0) break; // Trapped
    
    const move = validMoves[Math.floor(Math.random() * validMoves.length)];
    const actionNode: CodeNode = {
        id: generateId(),
        type: 'action',
        action: ACTION_NAMES[move]
    };
    rootNode.children?.push(actionNode);
    
    simState.trace.push({
        key: move,
        nodeId: actionNode.id,
        expectedX: 0, expectedY: 0
    });
    const next = movePos(simState.x, simState.y, move);
    simState.x = next.x;
    simState.y = next.y;
    stepsGenerated++;
  }

  // Update trace coordinates
  let currX = startX;
  let currY = startY;
  for (const step of simState.trace) {
      const next = movePos(currX, currY, step.key);
      step.expectedX = next.x;
      step.expectedY = next.y;
      currX = next.x;
      currY = next.y;
  }

  return {
    id: levelIndex,
    gridSize: { cols: COLS, rows: ROWS },
    startPos: { x: startX, y: startY },
    gridColors: simState.gridColors,
    codeTree: rootNode,
    solutionTrace: simState.trace,
    difficulty
  };
};
