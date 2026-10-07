import React, { useState } from 'react';
import { InfrastructureNode } from '@pathforge/core';
import { Map, ChevronDown, ChevronUp } from 'lucide-react';

interface CanvasMinimapProps {
  nodes: InfrastructureNode[];
  pan: { x: number; y: number };
  zoom: number;
  canvasWidth: number;
  canvasHeight: number;
  onNavigate: (newPanX: number, newPanY: number) => void;
}

export const CanvasMinimap: React.FC<CanvasMinimapProps> = ({
  nodes,
  pan,
  zoom,
  canvasWidth,
  canvasHeight,
  onNavigate,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // Determine graph bounds
  let minX = 0;
  let minY = 0;
  let maxX = 1200;
  let maxY = 700;

  if (nodes.length > 0) {
    minX = Math.min(0, ...nodes.map((n) => n.position.x - 50));
    minY = Math.min(0, ...nodes.map((n) => n.position.y - 50));
    maxX = Math.max(1200, ...nodes.map((n) => n.position.x + 250));
    maxY = Math.max(700, ...nodes.map((n) => n.position.y + 150));
  }

  const boundsWidth = Math.max(1, maxX - minX);
  const boundsHeight = Math.max(1, maxY - minY);

  const mapW = 160;
  const mapH = 96;

  // Viewport in graph space
  const vpLeft = -pan.x / zoom;
  const vpTop = -pan.y / zoom;
  const vpWidth = canvasWidth / zoom;
  const vpHeight = canvasHeight / zoom;

  // Transform to minimap space
  const mapVpX = Math.max(0, Math.min(mapW, ((vpLeft - minX) / boundsWidth) * mapW));
  const mapVpY = Math.max(0, Math.min(mapH, ((vpTop - minY) / boundsHeight) * mapH));
  const mapVpW = Math.max(8, Math.min(mapW - mapVpX, (vpWidth / boundsWidth) * mapW));
  const mapVpH = Math.max(8, Math.min(mapH - mapVpY, (vpHeight / boundsHeight) * mapH));

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert click back to graph coordinates
    const targetGraphX = minX + (clickX / mapW) * boundsWidth;
    const targetGraphY = minY + (clickY / mapH) * boundsHeight;

    // Center viewport on clicked point
    const newPanX = -(targetGraphX * zoom - canvasWidth / 2);
    const newPanY = -(targetGraphY * zoom - canvasHeight / 2);

    onNavigate(newPanX, newPanY);
  };

  return (
    <div className="absolute bottom-4 right-4 bg-[#14171d]/90 backdrop-blur-sm border border-[#262c37] rounded-md shadow-lg select-none z-20 overflow-hidden">
      <div className="px-2 py-1 border-b border-[#222630] flex items-center justify-between text-[10px] font-mono text-[#8b949e] bg-[#0e1014]/60">
        <div className="flex items-center space-x-1">
          <Map className="w-3 h-3 text-[#58a6ff]" />
          <span>MINIMAP</span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hover:text-white transition-colors"
          title={collapsed ? 'Expand Minimap' : 'Collapse Minimap'}
        >
          {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {!collapsed && (
        <div
          className="relative bg-[#0d0f12] cursor-crosshair"
          style={{ width: `${mapW}px`, height: `${mapH}px` }}
          onClick={handleMinimapClick}
        >
          {/* Node dots */}
          {nodes.map((node) => {
            const nx = ((node.position.x - minX) / boundsWidth) * mapW;
            const ny = ((node.position.y - minY) / boundsHeight) * mapH;
            const nw = Math.max(6, (200 / boundsWidth) * mapW);
            const nh = Math.max(3, (90 / boundsHeight) * mapH);

            return (
              <div
                key={node.id}
                style={{
                  left: `${nx}px`,
                  top: `${ny}px`,
                  width: `${nw}px`,
                  height: `${nh}px`,
                }}
                className="absolute rounded-[1px] bg-[#3e4657] border border-[#58a6ff]/40"
              />
            );
          })}

          {/* Viewport Box */}
          <div
            style={{
              left: `${mapVpX}px`,
              top: `${mapVpY}px`,
              width: `${mapVpW}px`,
              height: `${mapVpH}px`,
            }}
            className="absolute border border-[#388bfd] bg-[#388bfd]/10 pointer-events-none rounded-[1px]"
          />
        </div>
      )}
    </div>
  );
};
