export type Direction = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

export enum GridColor {
  None = 'bg-gray-200',
  Red = 'bg-rose-500',
  Blue = 'bg-sky-500',
  Yellow = 'bg-amber-400',
  Green = 'bg-emerald-500',
}

export interface GridCell {
  x: number;
  y: number;
  color: GridColor;
}

export type CodeNodeType = 'root' | 'loop' | 'while' | 'conditional' | 'action';

export interface CodeNode {
  id: string;
  type: CodeNodeType;
  action?: string; // 'right', 'up', etc.
  count?: number; // for repeat loops
  conditionColor?: GridColor; // for conditionals and while loops
  children?: CodeNode[];
  // For conditionals with else-if chains: each child represents a branch
  // [0] = if branch, [1] = else-if branch, [2] = else-if branch, etc., [last] = else branch
  // For while loops: children are the loop body
}

export interface TraceStep {
  key: Direction;
  nodeId: string; // The ID of the code node active during this step
  expectedX: number;
  expectedY: number;
}

export interface LevelData {
  id: number;
  gridSize: { cols: number; rows: number };
  startPos: { x: number; y: number };
  gridColors: Record<string, GridColor>; // key: "x,y", value: Color
  codeTree: CodeNode;
  solutionTrace: TraceStep[];
  difficulty: number;
}
