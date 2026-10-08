import React from 'react';
import { InfrastructureEdge, InfrastructureNode } from '@pathforge/core';
import { Lock } from 'lucide-react';
import { NODE_WIDTH, NODE_HEIGHT } from './CanvasNode.js';

interface CanvasEdgeProps {
  edge: InfrastructureEdge;
  sourceNode: InfrastructureNode;
  targetNode: InfrastructureNode;
  isSelected: boolean;
  isVulnerable: boolean;
  isHoveredFromFinding?: boolean;
  isFocusedTarget?: boolean;
  isOnAttackPath?: boolean;
  attackHopOrder?: number | null;
  isLateralMovement?: boolean;
  isDimmed?: boolean;
  onSelect: (edgeId: string) => void;
}

export const CanvasEdge: React.FC<CanvasEdgeProps> = ({
  edge,
  sourceNode,
  targetNode,
  isSelected,
  isVulnerable,
  isHoveredFromFinding = false,
  isOnAttackPath = false,
  attackHopOrder = null,
  isLateralMovement = false,
  isDimmed = false,
  onSelect,
}) => {
  // Source output handle (right side)
  const sx = sourceNode.position.x + NODE_WIDTH;
  const sy = sourceNode.position.y + NODE_HEIGHT / 2;

  // Target input handle (left side)
  const tx = targetNode.position.x;
  const ty = targetNode.position.y + NODE_HEIGHT / 2;

  // Compute smooth bezier curve
  const dx = tx - sx;
  const dy = ty - sy;

  let pathData = '';
  if (dx >= 20) {
    const curvature = Math.max(Math.abs(dx) * 0.45, 40);
    pathData = `M ${sx} ${sy} C ${sx + curvature} ${sy}, ${tx - curvature} ${ty}, ${tx} ${ty}`;
  } else {
    // Looping / reverse connection curve
    const loopOffsetY = Math.abs(dy) < 50 ? 60 : 0;
    const midY = (sy + ty) / 2 + loopOffsetY;
    pathData = `M ${sx} ${sy} C ${sx + 60} ${sy}, ${sx + 60} ${midY}, ${(sx + tx) / 2} ${midY} C ${tx - 60} ${midY}, ${tx - 60} ${ty}, ${tx} ${ty}`;
  }

  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;

  const isDenied = edge.metadata.access === 'deny';
  const isEncrypted = edge.metadata.encrypted === true;
  const proto = (edge.metadata.protocol ?? 'TCP').toUpperCase();
  const ports = edge.metadata.ports ?? '';
  const label = ports ? `${proto}:${ports}` : proto;

  // Stroke styling hierarchy
  let strokeColor = '#3b4454';
  let strokeWidth = 1.5;
  let strokeDasharray: string | undefined = isDenied ? '4 4' : undefined;
  let markerId = 'arrowhead-normal';

  if (isOnAttackPath) {
    strokeColor = '#f85149';
    strokeWidth = 2.5;
    strokeDasharray = '6 4';
    markerId = 'arrowhead-attack';
  } else if (isLateralMovement) {
    strokeColor = '#bc8cff';
    strokeWidth = 2;
    strokeDasharray = '5 3';
    markerId = 'arrowhead-lateral';
  } else if (isVulnerable || isHoveredFromFinding) {
    strokeColor = '#f85149';
    strokeWidth = 2;
    markerId = 'arrowhead-vulnerable';
  } else if (isSelected) {
    strokeColor = '#58a6ff';
    strokeWidth = 2;
    markerId = 'arrowhead-selected';
  } else if (isDenied) {
    strokeColor = '#5b6577';
    strokeWidth = 1.5;
    markerId = 'arrowhead-denied';
  }

  return (
    <g
      className={`group cursor-pointer select-none transition-opacity duration-150 ${
        isDimmed ? 'opacity-15' : 'opacity-100'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(edge.id);
      }}
    >
      {/* Invisible wider hit area for easy selection */}
      <path
        d={pathData}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        className="cursor-pointer"
      />

      {/* Main Connection Path */}
      <path
        d={pathData}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        markerEnd={`url(#${markerId})`}
        className={isOnAttackPath ? 'attack-path-flow' : 'transition-colors duration-150'}
      />

      {/* Compact Midpoint Specification Pill */}
      <foreignObject
        x={midX - 55}
        y={midY - 11}
        width={110}
        height={22}
        className="pointer-events-none overflow-visible"
      >
        <div className="flex items-center justify-center h-full w-full">
          <div
            className={`pointer-events-auto px-1.5 py-0.5 rounded text-[9px] font-mono leading-none flex items-center space-x-1 border shadow-xs transition-transform group-hover:scale-105 ${
              isOnAttackPath
                ? 'bg-[#1c1214] border-[#f85149] text-[#f85149] font-bold'
                : isVulnerable
                ? 'bg-[#1c1214] border-[#da3633] text-[#f85149] font-semibold'
                : isSelected
                ? 'bg-[#141d2b] border-[#58a6ff] text-[#58a6ff] font-semibold'
                : isDenied
                ? 'bg-[#161a22] border-[#303746] text-[#8b949e]'
                : 'bg-[#11151c] border-[#212631] text-[#8b949e] group-hover:border-[#388bfd] group-hover:text-white'
            }`}
          >
            {isEncrypted && (
              <span title="Encrypted TLS Channel">
                <Lock className="w-2.5 h-2.5 text-[#3fb950] shrink-0" />
              </span>
            )}

            {isDenied && (
              <span className="text-[#f85149] font-bold text-[8px] uppercase">DENY</span>
            )}

            {attackHopOrder !== null && (
              <span className="text-[#f85149] font-bold text-[8px]">#{attackHopOrder}</span>
            )}

            <span className="truncate">{label}</span>
          </div>
        </div>
      </foreignObject>
    </g>
  );
};
