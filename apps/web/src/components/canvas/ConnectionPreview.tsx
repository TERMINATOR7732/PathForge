import React from 'react';
import { ConnectionDraft } from './types.js';

interface ConnectionPreviewProps {
  draft: ConnectionDraft;
}

export const ConnectionPreview: React.FC<ConnectionPreviewProps> = ({ draft }) => {
  const { startX, startY, currentX, currentY } = draft;

  const dx = Math.abs(currentX - startX);
  const curvature = Math.max(dx * 0.5, 40);

  const path = `M ${startX} ${startY} C ${startX + curvature} ${startY}, ${
    currentX - curvature
  } ${currentY}, ${currentX} ${currentY}`;

  return (
    <g className="pointer-events-none">
      {/* Outer subtle glow */}
      <path
        d={path}
        fill="none"
        stroke="#388bfd"
        strokeWidth={3}
        strokeOpacity={0.25}
      />
      {/* Main dashed interactive path */}
      <path
        d={path}
        fill="none"
        stroke="#58a6ff"
        strokeWidth={2}
        strokeDasharray="5 3"
        markerEnd="url(#arrowhead-active)"
      />
      {/* Starting point ring */}
      <circle cx={startX} cy={startY} r={3} fill="#58a6ff" />
      {/* Target point indicator */}
      <circle cx={currentX} cy={currentY} r={4} fill="#388bfd" fillOpacity={0.7} />
    </g>
  );
};
