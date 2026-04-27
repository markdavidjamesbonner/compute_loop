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

// Wrap coordinates to create a toroidal grid (wraps around edges)
const wrapPos = (x: number, y: number) => {
  const wrappedX = ((x % COLS) + COLS) % COLS;
  const wrappedY = ((y % ROWS) + ROWS) % ROWS;
  return { x: wrappedX, y: wrappedY };
};

const movePos = (x: number, y: number, dir: Direction) => {
  let newX = x;
  let newY = y;
  switch (dir) {
    case 'ArrowUp': newY = y - 1; break;
    case 'ArrowDown': newY = y + 1; break;
    case 'ArrowLeft': newX = x - 1; break;
    case 'ArrowRight': newX = x + 1; break;
  }
  return wrapPos(newX, newY);
};

interface SimulationState {
  x: number;
  y: number;
  gridColors: Record<string, GridColor>;
  trace: TraceStep[];
}

// Helper to generate a single action node
const generateAction = (dir: Direction): CodeNode => ({
  id: generateId(),
  type: 'action',
  action: ACTION_NAMES[dir]
});

// Helper to execute a move and update trace
const executeMove = (state: SimulationState, dir: Direction, nodeId: string) => {
  state.trace.push({
    key: dir,
    nodeId,
    expectedX: 0,
    expectedY: 0
  });
  const next = movePos(state.x, state.y, dir);
  state.x = next.x;
  state.y = next.y;
};

// Helper to execute a nested code structure's moves
// This is used to re-execute nested structures in repeat loops
const executeNodeMoves = (state: SimulationState, node: CodeNode): number => {
  let steps = 0;

  if (node.type === 'action' && node.action) {
    // Map action string to Direction
    const actionToDir: Record<string, Direction> = {
      'up': 'ArrowUp',
      'down': 'ArrowDown',
      'left': 'ArrowLeft',
      'right': 'ArrowRight'
    };
    const dir = actionToDir[node.action] as Direction;
    if (dir) {
      executeMove(state, dir, node.id);
      steps++;
    }
  } else if (node.type === 'loop' && node.count && node.children) {
    // Repeat loop: execute body count times
    for (let i = 0; i < node.count; i++) {
      for (const child of node.children) {
        steps += executeNodeMoves(state, child);
      }
    }
  } else if (node.type === 'while' && node.conditionColor && node.children) {
    // While loop: execute body while condition is met
    // For trace generation, we simulate execution
    const startKey = `${state.x},${state.y}`;
    const cellColor = state.gridColors[startKey] || GridColor.None;
    if (cellColor === node.conditionColor) {
      // Execute body at least once
      for (const child of node.children) {
        steps += executeNodeMoves(state, child);
      }
    }
  } else if (node.type === 'conditional' && node.children && node.children.length > 0) {
    // Conditional: execute first branch (the one that matches)
    steps += executeNodeMoves(state, node.children[0]);
  } else if (node.children) {
    // Recursively execute children
    for (const child of node.children) {
      steps += executeNodeMoves(state, child);
    }
  }

  return steps;
};

// Generate a code structure recursively
// Returns the node and number of steps it generates
const generateCodeStructure = (
  state: SimulationState,
  difficulty: number,
  remainingSteps: number,
  allowNesting: boolean,
  depth: number = 0
): { node: CodeNode | null; steps: number } => {
  if (remainingSteps <= 0 || depth > 5) {
    return { node: null, steps: 0 };
  }

  // Check current cell color - use it to generate appropriate structures
  const currentKey = `${state.x},${state.y}`;
  const currentColor = state.gridColors[currentKey] || GridColor.None;

  const rand = Math.random();
  const maxDepth = difficulty >= 50 ? 3 : difficulty >= 30 ? 2 : 1;

  // If we're on a colored cell, try to generate structures that use it
  if (currentColor !== GridColor.None) {
    // For high levels (50+), prioritize complex structures
    if (difficulty >= 50 && allowNesting && depth < maxDepth && rand < 0.6 && remainingSteps >= 3) {
      const nestedRand = Math.random();
      if (nestedRand < 0.5 && remainingSteps >= 4) {
        return generateWhileLoop(state, difficulty, remainingSteps, true, depth);
      } else if (nestedRand < 0.75 && remainingSteps >= 5) {
        return generateRepeatLoop(state, difficulty, remainingSteps, true, depth);
      } else if (remainingSteps >= 3) {
        return generateConditional(state, difficulty, remainingSteps, true, depth);
      }
    }

    // Try while loops (levels 20+) - higher probability when on colored cell
    if (difficulty >= 20 && remainingSteps >= 3 && rand < 0.7) {
      return generateWhileLoop(state, difficulty, remainingSteps, allowNesting, depth);
    }

    // Try conditionals (levels 10+) - higher probability when on colored cell
    if (difficulty >= 10 && remainingSteps >= 2 && rand < 0.6) {
      return generateConditional(state, difficulty, remainingSteps, allowNesting, depth);
    }
  }

  // Try repeat loops (levels 1+) - can work from any cell
  if (difficulty >= 1 && remainingSteps >= 3 && rand < 0.5) {
    return generateRepeatLoop(state, difficulty, remainingSteps, allowNesting, depth);
  }

  // Try while loops even if not on colored cell (lower probability)
  if (difficulty >= 20 && remainingSteps >= 3 && rand < 0.3) {
    return generateWhileLoop(state, difficulty, remainingSteps, allowNesting, depth);
  }

  // Try conditionals even if not on colored cell (lower probability)
  if (difficulty >= 10 && remainingSteps >= 2 && rand < 0.2) {
    return generateConditional(state, difficulty, remainingSteps, allowNesting, depth);
  }

  // Fallback to single action
  if (remainingSteps >= 1) {
    const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    const actionNode = generateAction(dir);
    console.log(`  📍 Generating standalone action: ${dir} at (${state.x},${state.y}), nodeId=${actionNode.id}`);
    executeMove(state, dir, actionNode.id);
    console.log(`  ✅ Added trace step for ${dir}, new position (${state.x},${state.y}), trace length=${state.trace.length}`);
    return { node: actionNode, steps: 1 };
  }

  return { node: null, steps: 0 };
};

// Generate a while loop
const generateWhileLoop = (
  state: SimulationState,
  difficulty: number,
  maxSteps: number,
  allowNesting: boolean,
  depth: number
): { node: CodeNode | null; steps: number } => {
  const startX = state.x;
  const startY = state.y;
  const startKey = `${startX},${startY}`;
  const currentColor = state.gridColors[startKey] || GridColor.None;

  // Use current cell's color if available, otherwise random
  // This ensures while loops actually execute when we're on colored cells
  const conditionColor = currentColor !== GridColor.None
    ? currentColor
    : [GridColor.Red, GridColor.Blue, GridColor.Yellow, GridColor.Green][
        Math.floor(Math.random() * 4)
      ];

  // Generate loop body first (needed for UI display even if condition is false)
  const bodyLength = difficulty >= 50 ? (Math.random() > 0.5 ? 2 : 1) : 1;
  const maxIterations = difficulty >= 50 ? 5 : difficulty >= 30 ? 3 : 2;

  // Generate body actions and nodes once (we'll repeat them)
  const bodyActions: Direction[] = [];
  const bodyNodes: CodeNode[] = [];
  for (let i = 0; i < bodyLength; i++) {
    const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    bodyActions.push(dir);
    const actionNode = generateAction(dir);
    bodyNodes.push(actionNode);
  }

  // Check if current cell can support this while loop
  // CRITICAL: If the current cell has a different color (not empty, not condition color),
  // this while loop cannot execute. This prevents generating steps for while loops that can't run
  // (e.g., when previous while loops with the same color consumed all cells of that color)
  // Note: currentColor is already declared above

  if (currentColor !== GridColor.None && currentColor !== conditionColor) {
    // Current cell has a different color - this while loop cannot execute
    // Still create the node for UI display, but return 0 steps
    console.log(`⚠️  While loop at (${startX},${startY}) cannot execute: current cell color is ${currentColor}, required ${conditionColor}`);
    console.log(`    This likely means previous while loops consumed all cells of this color.`);
    const whileNode: CodeNode = {
      id: generateId(),
      type: 'while',
      conditionColor,
      children: bodyNodes
    };
    return { node: whileNode, steps: 0 };
  }

  // Check if current cell has condition color - if not, can't execute
  // DON'T PAINT - just check what's actually in the grid
  if (currentColor !== conditionColor) {
    console.log(`⚠️  While loop at (${startX},${startY}) cannot execute: current cell color is ${currentColor}, required ${conditionColor}`);
    const whileNode: CodeNode = {
      id: generateId(),
      type: 'while',
      conditionColor,
      children: bodyNodes
    };
    return { node: whileNode, steps: 0 };
  }

  console.log(`🔵 While loop starting at (${startX},${startY}), conditionColor=${conditionColor}, maxIterations=${maxIterations}, bodyLength=${bodyLength}`);

  // Simulate the while loop execution
  // Execute iterations as long as condition is met
  let iterations = 0;
  let totalSteps = 0;

  while (iterations < maxIterations && totalSteps + bodyLength <= maxSteps) {
    // Check condition on CURRENT position before each iteration
    // Use state.x/state.y which is updated by executeMove
    const currentKey = `${state.x},${state.y}`;
    const cellColor = state.gridColors[currentKey] || GridColor.None;

    // Check condition FIRST - if false, exit immediately
    if (cellColor !== conditionColor) {
      // Condition is false, exit loop - don't generate more steps
      console.log(`  🛑 While loop condition false at (${state.x},${state.y}): color=${cellColor}, required=${conditionColor} - exiting`);
      break;
    }

    // Condition is true - execute body
    console.log(`  🔄 While loop iteration ${iterations + 1}/${maxIterations}: executing body at (${state.x},${state.y})`);

    // Execute body actions
    for (let i = 0; i < bodyActions.length; i++) {
      const dir = bodyActions[i];
      const actionNode = bodyNodes[i];

      // Check intermediate positions (except before first action)
      if (i > 0) {
        const intermediateKey = `${state.x},${state.y}`;
        const intermediateColor = state.gridColors[intermediateKey] || GridColor.None;

        // If intermediate position doesn't have condition color, can't continue
        if (intermediateColor !== GridColor.None && intermediateColor !== conditionColor) {
          console.log(`    🛑 Stopping body execution at action ${i + 1}/${bodyActions.length}: position (${state.x},${state.y}) has color ${intermediateColor}, required ${conditionColor}`);
          break;
        }

        if (intermediateColor === GridColor.None) {
          console.log(`    🛑 Stopping body execution at action ${i + 1}/${bodyActions.length}: position (${state.x},${state.y}) is empty`);
          break;
        }
      }

      // Execute this action (this updates state.x and state.y)
      executeMove(state, dir, actionNode.id);
      totalSteps++;
    }

    iterations++;

    // After executing body, state.x/state.y have been updated to the new position
    // The condition will be checked again at the start of the next iteration
    console.log(`  ✅ Completed iteration ${iterations}, now at (${state.x},${state.y}), color=${state.gridColors[`${state.x},${state.y}`] || GridColor.None}`);
  }

  // Ensure we executed at least one iteration (condition was true, so we should have executed)
  // This is a safeguard - should never be needed since condition was checked first
  if (iterations === 0 && bodyNodes.length > 0) {
    console.warn(`While loop condition was true but no iterations executed - executing body once`);
    for (let i = 0; i < bodyActions.length; i++) {
      const dir = bodyActions[i];
      const actionNode = bodyNodes[i];
      executeMove(state, dir, actionNode.id);
      totalSteps++;
    }
    iterations = 1;
  }

  const whileNode: CodeNode = {
    id: generateId(),
    type: 'while',
    conditionColor,
    children: bodyNodes
  };

  return { node: whileNode, steps: totalSteps };
};

// Generate a repeat loop
const generateRepeatLoop = (
  state: SimulationState,
  difficulty: number,
  maxSteps: number,
  allowNesting: boolean,
  depth: number
): { node: CodeNode | null; steps: number } => {
  const loopCount = difficulty >= 50
    ? Math.floor(Math.random() * 5) + 3  // 3-7 iterations
    : difficulty >= 30
    ? Math.floor(Math.random() * 4) + 2   // 2-5 iterations
    : Math.floor(Math.random() * 3) + 2; // 2-4 iterations

  const bodyLength = difficulty >= 30 && Math.random() > 0.4 ? 2 : 1;

  if (loopCount * bodyLength > maxSteps) {
    return { node: null, steps: 0 };
  }

  const bodyNodes: CodeNode[] = [];
  const bodyActions: Direction[] = [];

  // Generate body - SIMPLIFIED: only simple actions for now
  // TODO: Add nested structure support later once simple actions work correctly
  for (let i = 0; i < bodyLength; i++) {
    // Simple action only
    const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    bodyActions.push(dir);
    const actionNode = generateAction(dir);
    bodyNodes.push(actionNode);
  }

  // Execute the loop - SIMPLIFIED: execute body actions loopCount times
  // Each iteration executes all body actions in order, using the SAME nodeIds
  let totalSteps = 0;
  for (let i = 0; i < loopCount; i++) {
    for (let j = 0; j < bodyLength; j++) {
      const dir = bodyActions[j];
      const node = bodyNodes[j];
      // Execute the move using the same nodeId for all iterations
      // This is correct - the same action node is executed multiple times
      executeMove(state, dir, node.id);
      totalSteps++;
    }
  }

  const loopNode: CodeNode = {
    id: generateId(),
    type: 'loop',
    count: loopCount,
    children: bodyNodes
  };

  return { node: loopNode, steps: totalSteps };
};

// Generate a conditional (with else-if chains for high levels)
const generateConditional = (
  state: SimulationState,
  difficulty: number,
  maxSteps: number,
  allowNesting: boolean,
  depth: number
): { node: CodeNode | null; steps: number } => {
  const useElseIf = difficulty >= 30 && Math.random() > 0.5;
  const numBranches = useElseIf && difficulty >= 50
    ? Math.floor(Math.random() * 2) + 2  // 2-3 branches (if + 1-2 else-if)
    : useElseIf
    ? 2  // if + else-if
    : 2; // if + else

  // CRITICAL: Determine which branch to execute FIRST, before generating nested structures
  // This ensures we check the correct cell color and don't execute wrong branches
  const currentKey = `${state.x},${state.y}`;
  const currentColor = state.gridColors[currentKey] || GridColor.None;

  // Generate branch colors first
  const branchColors: GridColor[] = [];
  for (let i = 0; i < numBranches; i++) {
    if (i === 0) {
      // First branch: if condition - use current cell color if available
      const firstBranchColor = currentColor !== GridColor.None
        ? currentColor
        : [GridColor.Red, GridColor.Blue, GridColor.Yellow, GridColor.Green][
            Math.floor(Math.random() * 4)
          ];
      branchColors.push(firstBranchColor);
    } else {
      // Else-if branches: different colors
      const usedColors = branchColors.slice(0, i);
      const availableColors = [GridColor.Red, GridColor.Blue, GridColor.Yellow, GridColor.Green]
        .filter(c => !usedColors.includes(c));
      branchColors.push(availableColors[Math.floor(Math.random() * availableColors.length)]);
    }
  }

  // Determine which branch to execute based on ACTUAL current cell color
  let branchIndex = numBranches - 1; // Default to else branch
  for (let i = 0; i < numBranches; i++) {
    if (currentColor === branchColors[i]) {
      branchIndex = i;
      break;
    }
  }

  console.log(`  🎯 Conditional: current cell (${state.x},${state.y}) has color ${currentColor}, will execute branch ${branchIndex}`);

  // Now generate branches - execute only the chosen branch
  const branches: CodeNode[] = [];
  const branchMoves: Direction[] = [];

  // Save state before generating branches
  const savedX = state.x;
  const savedY = state.y;

  // Generate branch nodes (without executing)
  for (let i = 0; i < numBranches; i++) {
    const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    branchMoves.push(dir);

    // Generate branch content (with potential nesting)
    if (allowNesting && depth < 2 && difficulty >= 40 && Math.random() > 0.7) {
      // For nested structures, we need to generate the code tree but not execute yet
      // We'll execute only the chosen branch
      const nested = generateCodeStructure(state, difficulty, maxSteps - 1, false, depth + 1);
      if (nested.node) {
        branches.push(nested.node);
        // Restore state after generating (nested structures might have moved us)
        state.x = savedX;
        state.y = savedY;
        // Remove steps added by nested structure (we'll execute chosen branch later)
        const stepsToRemove = nested.steps;
        if (stepsToRemove > 0) {
          console.log(`  🗑️  Removing ${stepsToRemove} trace steps from branch ${i} (will execute chosen branch later)`);
          state.trace.splice(state.trace.length - stepsToRemove, stepsToRemove);
        }
        continue;
      }
    }

    // Simple action branch
    branches.push(generateAction(dir));
  }

  // Restore state before executing chosen branch
  state.x = savedX;
  state.y = savedY;

  // Execute ONLY the chosen branch
  const chosenNode = branches[branchIndex];

  if (chosenNode.type === 'action') {
    // Simple action - execute it
    const chosenMove = branchMoves[branchIndex];
    executeMove(state, chosenMove, chosenNode.id);
  } else {
    // Nested structure - execute it to generate trace steps
    executeNodeMoves(state, chosenNode);
  }

  // Store branch colors by adding them to child nodes as metadata
  // We'll use the conditionColor field on child nodes to store their branch color
  const branchesWithColors = branches.map((branch, idx) => {
    // For the first branch, we don't need to store it (it's in conditionColor)
    // For else-if branches, we'll store the color in a way CodeDisplay can access
    // Actually, CodeDisplay will infer from position, so we just need to ensure order is correct
    return branch;
  });

  const conditionalNode: CodeNode = {
    id: generateId(),
    type: 'conditional',
    conditionColor: branchColors[0], // Primary condition color (for 'if')
    children: branchesWithColors
  };

  // Store branch colors array as a custom property (we'll access via a helper)
  // For now, CodeDisplay will infer colors based on position and available colors

  return { node: conditionalNode, steps: 1 };
};

export const generateLevel = (levelIndex: number): LevelData => {
  nodeIdCounter = 0;

  const difficulty = levelIndex;
  const startX = Math.floor(Math.random() * (COLS - 2)) + 1;
  const startY = Math.floor(Math.random() * (ROWS - 2)) + 1;

  // STEP 1: Generate the grid colors FIRST
  // This is the source of truth - code will be generated to match this grid
  const gridColors: Record<string, GridColor> = {};
  const allColors = [GridColor.Red, GridColor.Blue, GridColor.Yellow, GridColor.Green];
  const totalCells = COLS * ROWS;

  // Higher color density for higher levels
  const colorDensity = difficulty >= 50
    ? 0.4 + (Math.random() * 0.3)  // 40-70%
    : 0.3 + (Math.random() * 0.2);  // 30-50%
  const cellsToColor = Math.floor(totalCells * colorDensity);

  // Get all cell positions and shuffle
  const allPositions: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      allPositions.push({ x, y });
    }
  }
  for (let i = allPositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
  }

  // Fill grid with random colors
  for (let i = 0; i < Math.min(cellsToColor, allPositions.length); i++) {
    const pos = allPositions[i];
    const key = `${pos.x},${pos.y}`;
    const randomColor = allColors[Math.floor(Math.random() * allColors.length)];
    gridColors[key] = randomColor;
  }

  console.log(`🎨 Generated grid with ${Object.keys(gridColors).length} colored cells`);

  const rootNode: CodeNode = {
    id: generateId(),
    type: 'root',
    children: []
  };

  const simState: SimulationState = {
    x: startX,
    y: startY,
    gridColors: { ...gridColors }, // Copy grid colors - code generation will check, not paint
    trace: []
  };

  // Increase target steps for higher levels
  const targetSteps = difficulty >= 50
    ? 15 + Math.min(30, Math.floor((difficulty - 50) * 2))
    : 5 + Math.min(20, Math.floor(levelIndex * 1.5));

  let stepsGenerated = 0;
  let attempts = 0;
  const existingColors = new Set<string>();

  // Generate code structures until we reach target steps
  while (stepsGenerated < targetSteps && attempts < 200) {
    attempts++;
    const remaining = targetSteps - stepsGenerated;

    const result = generateCodeStructure(simState, difficulty, remaining, true, 0);

    if (result.node) {
      // Add node to tree even if it has 0 steps (e.g., while loops that can't execute)
      // This ensures the code tree matches what's displayed in the UI
      console.log(`📦 Generated ${result.node.type} node (id=${result.node.id}), steps=${result.steps}, trace length=${simState.trace.length}`);
      rootNode.children?.push(result.node);
      stepsGenerated += result.steps;

      // Collect conditional colors
      const collectColors = (node: CodeNode) => {
        if (node.type === 'conditional' || node.type === 'while') {
          if (node.conditionColor) {
            existingColors.add(`${simState.x},${simState.y}`);
          }
        }
        node.children?.forEach(collectColors);
      };
      collectColors(result.node);
    } else {
      // Fallback: only generate random action if no node was returned at all
      const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const actionNode = generateAction(dir);
      executeMove(simState, dir, actionNode.id);
      rootNode.children?.push(actionNode);
      stepsGenerated++;
    }
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

  // Validation: Count expected trace steps from code tree
  // This accounts for loops executing their bodies multiple times
  const countExpectedSteps = (node: CodeNode): number => {
    let steps = 0;

    if (node.type === 'action') {
      steps = 1;
    } else if (node.type === 'loop' && node.count && node.children) {
      // Repeat loop: body steps * count
      let bodySteps = 0;
      for (const child of node.children) {
        bodySteps += countExpectedSteps(child);
      }
      steps = bodySteps * node.count;
    } else if (node.type === 'while' && node.children) {
      // While loop: we can't know exact iterations from code tree alone
      // So we count the body steps (will be executed at least once)
      // The actual trace steps will be >= this
      for (const child of node.children) {
        steps += countExpectedSteps(child);
      }
      // Note: actual trace steps will be >= this (could be multiple iterations)
    } else if (node.type === 'conditional' && node.children && node.children.length > 0) {
      // Conditional: only one branch executes
      steps = countExpectedSteps(node.children[0]);
    } else if (node.children) {
      // Recursively count children
      for (const child of node.children) {
        steps += countExpectedSteps(child);
      }
    }

    return steps;
  };

  const expectedSteps = countExpectedSteps(rootNode);
  const actualSteps = simState.trace.length;

  console.log(`🔍 Validation: Expected minimum steps: ${expectedSteps}, actual trace steps: ${actualSteps}`);

  // For while loops, actual steps can be >= expected (multiple iterations)
  // So we only warn if actual is significantly less than expected
  if (actualSteps < expectedSteps - 2) {
    console.warn(`⚠️  Possible issue: Trace has fewer steps than expected minimum!`);
    console.warn(`   Expected minimum: ${expectedSteps}, actual: ${actualSteps}`);
  } else if (actualSteps > expectedSteps + 10) {
    // Large difference might indicate an issue, but some is expected for while loops
    console.log(`ℹ️  Trace has more steps than base count (expected for while loops with multiple iterations)`);
  }

  // Grid colors were generated first - use them directly
  // Code generation checked these colors, so they're the source of truth
  console.log(`🎨 Using pre-generated grid with ${Object.keys(gridColors).length} colored cells`);

  return {
    id: levelIndex,
    gridSize: { cols: COLS, rows: ROWS },
    startPos: { x: startX, y: startY },
    gridColors: gridColors, // Use the pre-generated grid (source of truth)
    codeTree: rootNode,
    solutionTrace: simState.trace,
    difficulty
  };
};

