import React from 'react';
import { RotateCcw, AlertTriangle, X } from 'lucide-react';

interface ResetScenarioModalProps {
  isOpen: boolean;
  scenarioName: string;
  onClose: () => void;
  onConfirmReset: () => void;
}

export const ResetScenarioModal: React.FC<ResetScenarioModalProps> = ({
  isOpen,
  scenarioName,
  onClose,
  onConfirmReset,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
    >
      <div className="w-full max-w-md rounded-lg bg-[#111318] border border-[#30363d] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#222630] bg-[#0d0f14] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[#f0883e]">
            <AlertTriangle className="w-4 h-4" />
            <span id="reset-modal-title" className="text-xs font-bold tracking-wide uppercase">
              Reset Scenario
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d] focus:outline-hidden focus:ring-1 focus:ring-[#388bfd] transition-colors"
            title="Cancel (Esc)"
            aria-label="Close reset modal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 bg-[#0e1015] text-xs">
          <p className="text-[#c9d1d9] leading-relaxed">
            Are you sure you want to reset <strong className="text-white">"{scenarioName}"</strong> to its original definition?
          </p>

          <div className="p-2.5 rounded bg-[#1a1513] border border-[#f0883e]/30 text-[11px] text-[#f0883e] leading-relaxed">
            All unsaved canvas edits, custom node positions, and modified edge policies will be discarded.
            Stale verification states and old baselines will be cleanly cleared.
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#222630] bg-[#0d0f14] flex items-center justify-end space-x-2 text-xs">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-[#21262d] text-[#c9d1d9] hover:text-white hover:bg-[#30363d] transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirmReset();
              onClose();
            }}
            className="px-3 py-1.5 rounded bg-[#da3633] text-white hover:bg-[#f85149] transition-colors font-semibold flex items-center space-x-1.5 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Confirm Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};
