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

  const rand = Math.random();
  const maxDepth = difficulty >= 50 ? 3 : difficulty >= 30 ? 2 : 1;

  // For high levels (50+), prioritize complex structures
  if (difficulty >= 50 && allowNesting && depth < maxDepth && rand < 0.6 && remainingSteps >= 3) {
    // Try nested structures: while with conditionals, loops with conditionals, etc.
    const nestedRand = Math.random();

    if (nestedRand < 0.4 && remainingSteps >= 4) {
      // Generate a while loop with nested conditional
      return generateWhileLoop(state, difficulty, remainingSteps, true, depth);
    } else if (nestedRand < 0.7 && remainingSteps >= 5) {
      // Generate a repeat loop with nested conditional
      return generateRepeatLoop(state, difficulty, remainingSteps, true, depth);
    } else if (remainingSteps >= 3) {
      // Generate a conditional with nested structures
      return generateConditional(state, difficulty, remainingSteps, true, depth);
    }
  }

  // Try while loops (levels 20+)
  if (difficulty >= 20 && remainingSteps >= 3 && rand < 0.4) {
    return generateWhileLoop(state, difficulty, remainingSteps, allowNesting, depth);
  }

  // Try repeat loops (levels 1+)
  if (difficulty >= 1 && remainingSteps >= 3 && rand < 0.5) {
    return generateRepeatLoop(state, difficulty, remainingSteps, allowNesting, depth);
  }

  // Try conditionals with else-if chains (levels 10+)
  if (difficulty >= 10 && remainingSteps >= 2 && rand < 0.4) {
    return generateConditional(state, difficulty, remainingSteps, allowNesting, depth);
  }

  // Fallback to single action
  if (remainingSteps >= 1) {
    const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    const actionNode = generateAction(dir);
    executeMove(state, dir, actionNode.id);
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
  const conditionColor = [GridColor.Red, GridColor.Blue, GridColor.Yellow, GridColor.Green][
    Math.floor(Math.random() * 4)
  ];

  const startX = state.x;
  const startY = state.y;
  const startKey = `${startX},${startY}`;

  // Check if we're already on a cell with the condition color
  const currentColor = state.gridColors[startKey] || GridColor.None;
  const startsOnCondition = currentColor === conditionColor;

  // Generate loop body (1-2 actions for variety)
  const bodyLength = difficulty >= 50 ? (Math.random() > 0.5 ? 2 : 1) : 1;
  const maxIterations = difficulty >= 50 ? 8 : difficulty >= 30 ? 5 : 3;

  // Generate body actions and nodes once (we'll repeat them)
  const bodyActions: Direction[] = [];
  const bodyNodes: CodeNode[] = [];
  for (let i = 0; i < bodyLength; i++) {
    const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    bodyActions.push(dir);
    const actionNode = generateAction(dir);
    bodyNodes.push(actionNode);
  }

  // Simulate the while loop execution
  let tempX = startX;
  let tempY = startY;
  let iterations = 0;
  let totalSteps = 0;

  // Execute iterations until we exit the condition
  while (iterations < maxIterations && totalSteps + bodyLength <= maxSteps) {
    const currentKey = `${tempX},${tempY}`;
    const cellColor = state.gridColors[currentKey] || GridColor.None;

    if (cellColor !== conditionColor) {
      // Condition is false, exit loop
      break;
    }

    // Execute body (reuse the same body nodes for trace)
    for (let i = 0; i < bodyActions.length; i++) {
      const dir = bodyActions[i];
      const actionNode = bodyNodes[i];
      executeMove(state, dir, actionNode.id);
      totalSteps++;

      const next = movePos(tempX, tempY, dir);
      tempX = next.x;
      tempY = next.y;
    }

    iterations++;

    // Ensure we eventually exit (paint the next cell differently if needed)
    if (iterations >= maxIterations - 1) {
      const exitKey = `${tempX},${tempY}`;
      if (!state.gridColors[exitKey] || state.gridColors[exitKey] === conditionColor) {
        // Paint it a different color to ensure exit
        const otherColors = [GridColor.Red, GridColor.Blue, GridColor.Yellow, GridColor.Green]
          .filter(c => c !== conditionColor);
        state.gridColors[exitKey] = otherColors[Math.floor(Math.random() * otherColors.length)];
      }
    }
  }

  // Ensure we start on the condition color if we have iterations
  if (iterations > 0 && !startsOnCondition) {
    state.gridColors[startKey] = conditionColor;
  }

  // Fallback: if no iterations happened, ensure at least one
  if (iterations === 0 && bodyNodes.length > 0) {
    state.gridColors[startKey] = conditionColor;
    // Execute body once
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

  // Generate body (with potential nesting for high levels)
  for (let i = 0; i < bodyLength; i++) {
    if (allowNesting && depth < 2 && difficulty >= 30 && Math.random() > 0.6) {
      // Nested structure in loop body
      const nested = generateCodeStructure(state, difficulty, maxSteps - (loopCount * bodyLength), false, depth + 1);
      if (nested.node) {
        bodyNodes.push(nested.node);
        // Estimate steps (will be recalculated)
        bodyActions.push(DIRECTIONS[0]); // Placeholder
        continue;
      }
    }

    // Simple action
    const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    bodyActions.push(dir);
    const actionNode = generateAction(dir);
    bodyNodes.push(actionNode);
  }

  // Execute the loop
  let totalSteps = 0;
  for (let i = 0; i < loopCount; i++) {
    for (let j = 0; j < bodyLength; j++) {
      if (j < bodyActions.length) {
        const dir = bodyActions[j];
        const nodeId = bodyNodes[j].id;
        executeMove(state, dir, nodeId);
        totalSteps++;
      }
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

  const branches: CodeNode[] = [];
  const branchMoves: Direction[] = [];
  const branchColors: GridColor[] = [];

  // Generate branches
  for (let i = 0; i < numBranches; i++) {
    const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    branchMoves.push(dir);

    if (i === 0) {
      // First branch: if condition
      branchColors.push([GridColor.Red, GridColor.Blue, GridColor.Yellow, GridColor.Green][
        Math.floor(Math.random() * 4)
      ]);
    } else {
      // Else-if branches: different colors
      const usedColors = branchColors.slice(0, i);
      const availableColors = [GridColor.Red, GridColor.Blue, GridColor.Yellow, GridColor.Green]
        .filter(c => !usedColors.includes(c));
      branchColors.push(availableColors[Math.floor(Math.random() * availableColors.length)]);
    }

    // Generate branch content (with potential nesting)
    if (allowNesting && depth < 2 && difficulty >= 40 && Math.random() > 0.7) {
      const nested = generateCodeStructure(state, difficulty, maxSteps - 1, false, depth + 1);
      if (nested.node) {
        branches.push(nested.node);
        continue;
      }
    }

    // Simple action branch
    branches.push(generateAction(dir));
  }

  // Determine which branch to take based on current cell color
  const currentKey = `${state.x},${state.y}`;
  const currentColor = state.gridColors[currentKey] || GridColor.None;

  let branchIndex = numBranches - 1; // Default to else branch
  for (let i = 0; i < numBranches; i++) {
    if (currentColor === branchColors[i]) {
      branchIndex = i;
      break;
    }
  }

  // If no branch matches, paint the cell for the first branch
  if (branchIndex === numBranches - 1 && currentColor !== branchColors[0]) {
    state.gridColors[currentKey] = branchColors[0];
    branchIndex = 0;
  }

  // Execute the chosen branch
  const chosenMove = branchMoves[branchIndex];
  const chosenNode = branches[branchIndex];
  executeMove(state, chosenMove, chosenNode.id);

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

    if (result.node && result.steps > 0) {
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
      // Fallback: single move
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

  // Collect all conditional/while colors from the code tree
  const conditionalColors = new Set<GridColor>();
  const collectConditionalColors = (node: CodeNode) => {
    if ((node.type === 'conditional' || node.type === 'while') && node.conditionColor) {
      conditionalColors.add(node.conditionColor);
    }
    node.children?.forEach(collectConditionalColors);
  };
  collectConditionalColors(rootNode);

  // Populate grid with colors
  const existingColorMap = { ...simState.gridColors };
  const allColors = [GridColor.Red, GridColor.Blue, GridColor.Yellow, GridColor.Green];
  const totalCells = COLS * ROWS;

  // Higher color density for higher levels
  const colorDensity = difficulty >= 50
    ? 0.4 + (Math.random() * 0.3)  // 40-70%
    : 0.3 + (Math.random() * 0.2);  // 30-50%
  const cellsToColor = Math.floor(totalCells * colorDensity);

  // Get all cell positions
  const allPositions: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      allPositions.push({ x, y });
    }
  }

  // Shuffle positions
  for (let i = allPositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
  }

  // Ensure conditional colors appear at least once
  const conditionalColorArray = Array.from(conditionalColors);
  let positionIndex = 0;
  for (const color of conditionalColorArray) {
    while (positionIndex < allPositions.length) {
      const pos = allPositions[positionIndex];
      const key = `${pos.x},${pos.y}`;
      if (!existingColorMap[key] || existingColorMap[key] === GridColor.None) {
        simState.gridColors[key] = color;
        positionIndex++;
        break;
      }
      positionIndex++;
    }
  }

  // Fill remaining positions with random colors
  let coloredCount = Object.keys(existingColorMap).filter(k => existingColorMap[k] !== GridColor.None).length;
  for (let i = 0; i < allPositions.length && coloredCount < cellsToColor; i++) {
    const pos = allPositions[i];
    const key = `${pos.x},${pos.y}`;
    if (!existingColorMap[key] || existingColorMap[key] === GridColor.None) {
      const randomColor = allColors[Math.floor(Math.random() * allColors.length)];
      simState.gridColors[key] = randomColor;
      coloredCount++;
    }
  }

  // Merge back existing colors (these override random colors for logic correctness)
  Object.assign(simState.gridColors, existingColorMap);

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
