import React from 'react';
import { InfrastructureEdge, InfrastructureNode } from '@pathforge/core';

interface CanvasEdgeProps {
  edge: InfrastructureEdge;
  sourceNode: InfrastructureNode;
  targetNode: InfrastructureNode;
  isSelected: boolean;
  isVulnerable: boolean;
  onSelect: (edgeId: string) => void;
}

export const CanvasEdge: React.FC<CanvasEdgeProps> = ({
  edge,
  sourceNode,
  targetNode,
  isSelected,
  isVulnerable,
  onSelect,
}) => {
  // Source connects from right handle (x + 200, y + 45)
  // Target connects to left handle (x, y + 45)
  const sx = sourceNode.position.x + 200;
  const sy = sourceNode.position.y + 45;
  const tx = targetNode.position.x;
  const ty = targetNode.position.y + 45;

  const dx = Math.abs(tx - sx);
  const curvature = Math.max(dx * 0.5, 40);

  const path = `M ${sx} ${sy} C ${sx + curvature} ${sy}, ${tx - curvature} ${ty}, ${tx} ${ty}`;

  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;

  let strokeColor = '#3e4657';
  let markerId = 'arrowhead-normal';

  if (isVulnerable) {
    strokeColor = '#f85149';
    markerId = 'arrowhead-critical';
  } else if (isSelected) {
    strokeColor = '#388bfd';
    markerId = 'arrowhead-active';
  }

  const label = edge.metadata?.ports
    ? `${edge.metadata.protocol ?? 'tcp'}:${edge.metadata.ports}`
    : edge.metadata?.protocol ?? 'tcp';

  return (
    <g
      className="cursor-pointer group"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(edge.id);
      }}
    >
      {/* Invisible thick path for easy click hit detection */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        className="cursor-pointer"
      />

      {/* Visible line */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isSelected || isVulnerable ? 2.5 : 1.75}
        strokeDasharray={isVulnerable ? '4 3' : undefined}
        markerEnd={`url(#${markerId})`}
        className="transition-colors group-hover:stroke-[#58a6ff]"
      />

      {/* Edge Label Pill */}
      <foreignObject
        x={midX - 45}
        y={midY - 12}
        width={90}
        height={24}
        className="overflow-visible pointer-events-auto"
      >
        <div
          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border text-center transition-all select-none truncate ${
            isVulnerable
              ? 'bg-[#2b1617] border-[#da3633] text-[#f85149]'
              : isSelected
              ? 'bg-[#122438] border-[#388bfd] text-[#58a6ff] ring-1 ring-[#388bfd]/50'
              : 'bg-[#14171d] border-[#262c37] text-[#8b949e] group-hover:border-[#384152] group-hover:text-[#c9d1d9]'
          }`}
          title={`${edge.source} → ${edge.target} (${label})`}
        >
          {label}
        </div>
      </foreignObject>
    </g>
  );
};
