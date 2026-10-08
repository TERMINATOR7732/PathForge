import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, Crosshair } from 'lucide-react';

interface CanvasControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitView?: () => void;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitView,
}) => {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="absolute bottom-4 left-4 flex items-center space-x-1 bg-[#11151c]/95 backdrop-blur-sm border border-[#212631] rounded-md p-1 shadow-md select-none z-20 font-sans">
      <button
        onClick={onZoomOut}
        className="p-1.5 rounded hover:bg-[#161b24] text-[#8b949e] hover:text-white transition-colors cursor-pointer"
        title="Zoom Out (Wheel Down)"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>

      <span
        onClick={onResetView}
        className="px-2 py-0.5 text-[11px] font-mono text-[#8b949e] hover:text-white cursor-pointer text-center min-w-[42px]"
        title="Reset zoom to 100%"
      >
        {zoomPercent}%
      </span>

      <button
        onClick={onZoomIn}
        className="p-1.5 rounded hover:bg-[#161b24] text-[#8b949e] hover:text-white transition-colors cursor-pointer"
        title="Zoom In (Wheel Up)"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>

      <div className="h-3 w-px bg-[#212631] mx-0.5" />

      {onFitView && (
        <button
          onClick={onFitView}
          className="p-1.5 rounded hover:bg-[#161b24] text-[#8b949e] hover:text-[#58a6ff] transition-colors cursor-pointer"
          title="Fit Topology to Viewport (Auto-Center)"
        >
          <Crosshair className="w-3.5 h-3.5" />
        </button>
      )}

      <button
        onClick={onResetView}
        className="p-1.5 rounded hover:bg-[#161b24] text-[#8b949e] hover:text-white transition-colors cursor-pointer"
        title="Reset Pan & Zoom (1:1)"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
