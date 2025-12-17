import React from 'react';
import { CodeNode, GridColor } from '../types';

interface CodeDisplayProps {
  node: CodeNode;
  activeNodeId: string | null;
  depth?: number;
}

const ColorBadge = ({ color }: { color: GridColor }) => {
    let colorClass = "bg-gray-400";
    if (color === GridColor.Red) colorClass = "bg-rose-500";
    if (color === GridColor.Blue) colorClass = "bg-sky-500";
    if (color === GridColor.Green) colorClass = "bg-emerald-500";
    if (color === GridColor.Yellow) colorClass = "bg-amber-400";

    return (
        <span className={`inline-block w-3 h-3 rounded-full mx-1 align-middle ${colorClass} border border-black/10 shadow-sm`}></span>
    );
};

export const CodeDisplay: React.FC<CodeDisplayProps> = ({ node, activeNodeId, depth = 0 }) => {
  const indent = depth * 20; // Increased indentation for better readability
  const isActive = node.id === activeNodeId;

  if (node.type === 'root') {
    return (
    //   <div className="font-code text-sm sm:text-base leading-relaxed text-slate-700">
    //     {node.children?.map(child => (
    //       <CodeDisplay key={child.id} node={child} activeNodeId={activeNodeId} depth={0} />
    //     ))}
    //   </div>
      <div
        className="font-code text-xl leading-relaxed text-slate-900"
        style={{ fontSize: '1.25rem' }}
      >
        {node.children?.map(child => (
          <CodeDisplay key={child.id} node={child} activeNodeId={activeNodeId} depth={0} />
        ))}
      </div>
    );
  }

  if (node.type === 'action') {
    return (
      <div
        data-node-id={node.id}
        className={`
          relative my-0.5 px-2 py-0.5 rounded
          transition-all duration-200
          ${isActive ? '' : 'hover:bg-slate-50'}
          `}
        //   ${isActive ? 'bg-amber-200 text-amber-900 font-bold shadow-sm translate-x-1' : 'hover:bg-slate-50'}
        style={{ marginLeft: indent }}
      >
        {/* <span className={isActive ? 'text-amber-800' : 'text-blue-600'}>{node.action}</span> */}
        <span className={isActive ? 'text-green-800' : 'text-blue-700'}>{node.action}</span>
        <span className="text-slate-400">();</span>
      </div>
    );
  }

  // Check if the loop itself is "active" (meaning one of its children is likely active,
  // or we might want to highlight the loop header when entering it.
  // For now, we only highlight actions, but we could highlight the wrapper).
  if (node.type === 'loop') {
    return (
      <div className="my-1 group">
        <div
          style={{ marginLeft: indent }}
          className="text-purple-700 font-semibold flex items-center"
        >
          <span>repeat</span>
          <span className="mx-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 text-xs border border-slate-200">
             {node.count}
          </span>
          <span className="text-slate-500">{'{'}</span>
        </div>

        <div className="border-l-2 border-slate-100 ml-3 pl-1 group-hover:border-slate-200 transition-colors">
          {node.children?.map(child => (
            <CodeDisplay key={child.id} node={child} activeNodeId={activeNodeId} depth={depth + 1} />
          ))}
        </div>

        <div style={{ marginLeft: indent }} className="text-slate-500 font-semibold">{'}'}</div>
      </div>
    );
  }

  if (node.type === 'while') {
    return (
      <div className="my-1 group">
        <div
          style={{ marginLeft: indent }}
          className="text-purple-700 font-semibold flex items-center"
        >
          <span>while</span>
          <span className="text-slate-500 mx-1">(</span>
          <span className="bg-white px-1 py-0.5 rounded border border-slate-200 flex items-center">
            <ColorBadge color={node.conditionColor || GridColor.None} />
          </span>
          <span className="text-slate-500 mx-1">)</span>
          <span className="text-slate-500">{'{'}</span>
        </div>

        <div className="border-l-2 border-slate-100 ml-3 pl-1 group-hover:border-slate-200 transition-colors">
          {node.children?.map(child => (
            <CodeDisplay key={child.id} node={child} activeNodeId={activeNodeId} depth={depth + 1} />
          ))}
        </div>

        <div style={{ marginLeft: indent }} className="text-slate-500 font-semibold">{'}'}</div>
      </div>
    );
  }

  if (node.type === 'conditional') {
    const numBranches = node.children?.length || 0;
    const hasElseIf = numBranches > 2;

    // For else-if chains, determine colors for each branch
    // The first branch uses conditionColor, else-if branches use different colors
    // The last branch (else) doesn't have a color condition
    const allColors = [GridColor.Red, GridColor.Blue, GridColor.Yellow, GridColor.Green];
    const getBranchColor = (index: number): GridColor | null => {
      if (index === 0) {
        // First branch: if condition
        return node.conditionColor || GridColor.None;
      }
      if (index < numBranches - 1) {
        // Middle branches: else-if conditions
        const usedColors = [node.conditionColor].filter(c => c !== undefined && c !== GridColor.None) as GridColor[];
        const availableColors = allColors.filter(c => !usedColors.includes(c));
        // Use different colors for each else-if branch
        const colorIndex = (index - 1) % availableColors.length;
        return availableColors[colorIndex];
      }
      // Last branch: else (no color condition)
      return null;
    };

    return (
      <div className="my-1 group">
        {/* If branch */}
        <div
          style={{ marginLeft: indent }}
          className="text-purple-700 font-semibold flex items-center"
        >
          <span>if</span>
          <span className="text-slate-500 mx-1">(</span>
          <span className="bg-white px-1 py-0.5 rounded border border-slate-200 flex items-center">
            <ColorBadge color={getBranchColor(0)} />
          </span>
          <span className="text-slate-500 mx-1">)</span>
          <span className="text-slate-500">{'{'}</span>
        </div>

        <div className="border-l-2 border-slate-100 ml-3 pl-1 group-hover:border-slate-200 transition-colors">
          <CodeDisplay node={node.children![0]} activeNodeId={activeNodeId} depth={depth + 1} />
        </div>

        {/* Else-if branches */}
        {hasElseIf && node.children!.slice(1, -1).map((child, idx) => {
          const branchColor = getBranchColor(idx + 1);
          return (
            <React.Fragment key={child.id}>
              <div style={{ marginLeft: indent }} className="text-purple-700 font-semibold mt-0.5 flex items-center">
                {'}'} <span className="text-purple-700">else if</span>
                <span className="text-slate-500 mx-1">(</span>
                {branchColor && (
                  <span className="bg-white px-1 py-0.5 rounded border border-slate-200 flex items-center">
                    <ColorBadge color={branchColor} />
                  </span>
                )}
                <span className="text-slate-500 mx-1">)</span>
                <span className="text-slate-500">{'{'}</span>
              </div>
              <div className="border-l-2 border-slate-100 ml-3 pl-1 group-hover:border-slate-200 transition-colors">
                <CodeDisplay node={child} activeNodeId={activeNodeId} depth={depth + 1} />
              </div>
            </React.Fragment>
          );
        })}

        {/* Else branch (last child) */}
        {node.children![numBranches - 1] && (
          <>
            <div style={{ marginLeft: indent }} className="text-purple-700 font-semibold mt-0.5">
              {'}'} <span className="text-purple-700">else</span> <span className="text-slate-500">{'{'}</span>
            </div>
            <div className="border-l-2 border-slate-100 ml-3 pl-1 group-hover:border-slate-200 transition-colors">
              <CodeDisplay node={node.children![numBranches - 1]} activeNodeId={activeNodeId} depth={depth + 1} />
            </div>
          </>
        )}

        <div style={{ marginLeft: indent }} className="text-slate-500 font-semibold">{'}'}</div>
      </div>
    );
  }

  return null;
};
