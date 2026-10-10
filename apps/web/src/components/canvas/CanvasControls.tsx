import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, Crosshair, Focus } from 'lucide-react';

interface CanvasControlsProps {
  zoom: number;
  selectedNodeId?: string | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitView?: () => void;
  onZoomToSelected?: () => void;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  zoom,
  selectedNodeId,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitView,
  onZoomToSelected,
}) => {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="absolute bottom-4 left-4 flex items-center space-x-1.5 bg-[#11151c]/95 backdrop-blur-sm border border-[#212631] rounded-md p-1.5 shadow-md select-none z-20 font-sans">
      <button
        onClick={onZoomOut}
        className="p-1.5 rounded hover:bg-[#161b24] text-[#8b949e] hover:text-white transition-colors cursor-pointer"
        title="Zoom Out (- or Scroll Down)"
        aria-label="Zoom Out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      <span
        onClick={onResetView}
        className="px-2 py-0.5 text-xs font-mono text-[#8b949e] hover:text-white cursor-pointer text-center min-w-[46px]"
        title="Reset zoom to 100% (0)"
      >
        {zoomPercent}%
      </span>

      <button
        onClick={onZoomIn}
        className="p-1.5 rounded hover:bg-[#161b24] text-[#8b949e] hover:text-white transition-colors cursor-pointer"
        title="Zoom In (+ or Scroll Up)"
        aria-label="Zoom In"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      <div className="h-3.5 w-px bg-[#212631] mx-0.5" />

      {selectedNodeId && onZoomToSelected && (
        <button
          onClick={onZoomToSelected}
          className="p-1.5 rounded hover:bg-[#161b24] text-[#58a6ff] hover:text-[#79b8ff] transition-colors cursor-pointer"
          title="Zoom to Selected Node (Z)"
          aria-label="Zoom to Selected Node"
        >
          <Focus className="w-4 h-4" />
        </button>
      )}

      {onFitView && (
        <button
          onClick={onFitView}
          className="p-1.5 rounded hover:bg-[#161b24] text-[#8b949e] hover:text-[#58a6ff] transition-colors cursor-pointer"
          title="Fit Topology to Viewport (F)"
          aria-label="Fit to Viewport"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      )}

      <button
        onClick={onResetView}
        className="p-1.5 rounded hover:bg-[#161b24] text-[#8b949e] hover:text-white transition-colors cursor-pointer"
        title="Reset Pan & Zoom 1:1"
        aria-label="Reset Pan and Zoom"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
};
