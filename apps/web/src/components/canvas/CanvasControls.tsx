import React from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface CanvasControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
}) => {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="absolute bottom-4 left-4 flex items-center space-x-1 bg-[#14171d]/90 backdrop-blur-sm border border-[#262c37] rounded-md p-1 shadow-lg select-none z-20">
      <button
        onClick={onZoomOut}
        className="p-1.5 rounded hover:bg-[#202530] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
        title="Zoom Out (Ctrl + Wheel)"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>

      <span
        onClick={onResetView}
        className="px-2 py-0.5 text-[10px] font-mono text-[#8b949e] hover:text-[#e6edf3] cursor-pointer text-center min-w-[42px]"
        title="Click to reset zoom to 100%"
      >
        {zoomPercent}%
      </span>

      <button
        onClick={onZoomIn}
        className="p-1.5 rounded hover:bg-[#202530] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
        title="Zoom In (Ctrl + Wheel)"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>

      <div className="h-3 w-px bg-[#262c37] mx-0.5" />

      <button
        onClick={onResetView}
        className="p-1.5 rounded hover:bg-[#202530] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
        title="Reset Pan & Zoom (1:1)"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
