import React from 'react';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  targetScenarioName: string;
  onStay: () => void;
  onConfirmDiscard: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  targetScenarioName,
  onStay,
  onConfirmDiscard,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onStay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onStay]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 font-sans select-none overflow-x-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onStay();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-modal-title"
    >
      <div className="w-full max-w-md min-w-0 rounded-lg bg-[#111318] border border-[#30363d] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#222630] bg-[#0d0f14] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[#f0883e]">
            <AlertTriangle className="w-4 h-4" />
            <span id="unsaved-modal-title" className="text-xs font-bold tracking-wide uppercase">
              Unsaved Changes Warning
            </span>
          </div>

          <button
            onClick={onStay}
            className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d] focus:outline-hidden focus:ring-1 focus:ring-[#388bfd] transition-colors"
            title="Stay in current scenario (Esc)"
            aria-label="Close unsaved changes modal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 bg-[#0e1015] text-xs">
          <p className="text-[#c9d1d9] leading-relaxed">
            You have active modifications in your current modeled environment. Switching to{' '}
            <strong className="text-white">"{targetScenarioName}"</strong> will discard these unsaved changes.
          </p>

          <div className="p-2.5 rounded bg-[#1a1513] border border-[#f0883e]/30 text-[11px] text-[#f0883e] leading-relaxed">
            PathForge operates client-side in memory with zero persistent browser or cloud storage. In-memory modifications will be discarded upon switching. Download the Topology Model (.json) from Export to save an offline backup to your computer before switching.
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#222630] bg-[#0d0f14] flex flex-col sm:flex-row sm:items-center justify-end gap-2 text-xs">
          <button
            onClick={onStay}
            className="w-full sm:w-auto px-3 py-1.5 rounded bg-[#21262d] text-[#c9d1d9] hover:text-white hover:bg-[#30363d] transition-colors font-medium cursor-pointer text-center"
          >
            Stay in Current Scenario
          </button>
          <button
            onClick={onConfirmDiscard}
            className="w-full sm:w-auto px-3 py-1.5 rounded bg-[#da3633] text-white hover:bg-[#f85149] transition-colors font-semibold flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
          >
            <span>Discard & Switch</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
