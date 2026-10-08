import React from 'react';
import { InfrastructureEdge, InfrastructureNode } from '@pathforge/core';
import { Lock } from 'lucide-react';

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
  isHoveredFromFinding,
  isFocusedTarget,
  isOnAttackPath = false,
  attackHopOrder = null,
  isLateralMovement = false,
  isDimmed = false,
  onSelect,
}) => {
  // Source connects from right handle (x + 204, y + 37)
  // Target connects to left handle (x, y + 37)
  const sx = sourceNode.position.x + 204;
  const sy = sourceNode.position.y + 37;
  const tx = targetNode.position.x;
  const ty = targetNode.position.y + 37;

  const dx = Math.abs(tx - sx);
  const curvature = Math.max(dx * 0.45, 40);

  const path = `M ${sx} ${sy} C ${sx + curvature} ${sy}, ${tx - curvature} ${ty}, ${tx} ${ty}`;

  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;

  const isDenied = edge.access === 'deny';
  const isEncrypted = edge.encrypted;

  // Determine trust boundary transition
  const sourceZone = sourceNode.metadata.zone ?? 'internal';
  const targetZone = targetNode.metadata.zone ?? 'internal';
  const isBoundaryCrossing = sourceZone !== targetZone;

  let strokeColor = '#252c3b';
  let markerId = 'arrowhead-normal';
  let strokeWidth = 1.5;
  let strokeDasharray: string | undefined = undefined;

  if (isOnAttackPath) {
    strokeColor = '#f85149';
    markerId = 'arrowhead-critical';
    strokeWidth = 2.5;
    strokeDasharray = '6 3';
  } else if (isLateralMovement) {
    strokeColor = '#a371f7';
    markerId = 'arrowhead-lateral';
    strokeWidth = 2;
    strokeDasharray = '4 3';
  } else if (isFocusedTarget) {
    strokeColor = '#58a6ff';
    markerId = 'arrowhead-active';
    strokeWidth = 2.5;
  } else if (isHoveredFromFinding || isVulnerable) {
    strokeColor = '#f85149';
    markerId = 'arrowhead-critical';
    strokeWidth = 2;
    strokeDasharray = '4 3';
  } else if (isSelected) {
    strokeColor = '#58a6ff';
    markerId = 'arrowhead-active';
    strokeWidth = 2;
  } else if (isDenied) {
    strokeColor = '#3b4354';
    markerId = 'arrowhead-denied';
    strokeDasharray = '3 3';
  }

  const portDisplay = edge.ports;
  const protoDisplay = edge.protocol;
  const label =
    portDisplay && portDisplay !== 'ANY'
      ? `${protoDisplay}:${portDisplay}`
      : protoDisplay;

  return (
    <g
      className={`cursor-pointer group transition-opacity duration-150 ${
        isDimmed ? 'opacity-15 hover:opacity-70' : 'opacity-100'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(edge.id);
      }}
    >
      {/* Invisible thick path for generous hit detection */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
      />

      {/* Visible Directional Path */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        markerEnd={`url(#${markerId})`}
        className={`transition-colors group-hover:stroke-[#58a6ff] ${
          isOnAttackPath ? 'attack-path-flow' : ''
        }`}
      />

      {/* Edge Label Pill */}
      <foreignObject
        x={midX - 60}
        y={midY - 11}
        width={120}
        height={22}
        className="overflow-visible pointer-events-auto"
      >
        <div
          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border text-center transition-all select-none truncate flex items-center justify-center space-x-1 ${
            isOnAttackPath
              ? 'bg-[#1b1114] border-[#f85149] text-[#f85149] ring-1 ring-[#f85149]/40'
              : isVulnerable
              ? 'bg-[#1a1114] border-[#da3633] text-[#f85149]'
              : isSelected
              ? 'bg-[#121b27] border-[#58a6ff] text-[#58a6ff] ring-1 ring-[#58a6ff]/40'
              : isDenied
              ? 'bg-[#14161b] border-[#2a303c] text-[#7d8590]'
              : 'bg-[#0e1117] border-[#1c212c] text-[#7d8590] group-hover:border-[#384152] group-hover:text-[#c9d1d9]'
          }`}
          title={`${sourceNode.name} (${sourceZone}) → ${targetNode.name} (${targetZone}) [${isDenied ? 'DENY ' : ''}${label}${isEncrypted ? ' · TLS' : ''}${isBoundaryCrossing ? ' · Boundary Cross' : ''}]`}
        >
          {isEncrypted && (
            <span title="Encrypted TLS Channel" className="inline-flex items-center">
              <Lock className="w-2.5 h-2.5 shrink-0 text-[#3fb950]" />
            </span>
          )}

          {isDenied && (
            <span className="text-[#f85149] font-bold text-[8px] shrink-0">DENY</span>
          )}

          {attackHopOrder !== null && (
            <span className="text-[#f85149] font-bold text-[8px] shrink-0">#{attackHopOrder}</span>
          )}

          <span className="truncate">{label}</span>

          {isBoundaryCrossing && !isOnAttackPath && (
            <span className="w-1 h-1 rounded-full bg-[#388bfd] shrink-0" title="Crosses Trust Boundary" />
          )}
        </div>
      </foreignObject>
    </g>
  );
};
