import React, { useEffect } from 'react';
import { Finding } from '@pathforge/shared';
import { RemediationAction } from '@pathforge/validator';
import { AlertTriangle, Wrench, X, ShieldAlert, Check } from 'lucide-react';

interface RemediationModalProps {
  finding: Finding;
  action: RemediationAction;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RemediationModal: React.FC<RemediationModalProps> = ({
  finding,
  action,
  onConfirm,
  onCancel,
}) => {
  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs select-none">
      <div className="w-[520px] rounded-lg bg-[#14171d] border border-[#30363d] shadow-2xl overflow-hidden font-mono text-xs">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-[#2d333b]">
          <div className="flex items-center space-x-2 text-[#e6edf3]">
            <Wrench className="w-4 h-4 text-[#3fb950]" />
            <span className="font-semibold text-sm">Confirm Remediation Action</span>
          </div>
          <button
            onClick={onCancel}
            className="text-[#8b949e] hover:text-[#c9d1d9] transition-colors p-1"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-3.5">
          {/* Finding Context */}
          <div className="p-2.5 rounded bg-[#1c1315] border border-[#da3633]/30 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#f85149] font-semibold">
              <span className="flex items-center">
                <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                TARGET VIOLATION: {finding.ruleId}
              </span>
              <span className="uppercase">{finding.severity}</span>
            </div>
            <div className="text-[#e6edf3] font-medium text-[11px]">{finding.title}</div>
          </div>

          {/* Action Details */}
          <div className="p-3 rounded bg-[#161a22] border border-[#222630] space-y-2">
            <div className="text-[11px] font-semibold text-[#58a6ff] uppercase tracking-wide">
              Planned Remediation:
            </div>
            <div className="text-[#e6edf3] text-[12px] font-medium">{action.title}</div>
            <p className="text-[#8b949e] text-[11px] leading-relaxed">
              {action.description}
            </p>
          </div>

          {/* Structural Impact */}
          <div className="p-3 rounded bg-[#111317] border border-[#222630] space-y-1.5">
            <div className="text-[10px] font-semibold text-[#d29922] uppercase flex items-center">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Graph Domain Impact:
            </div>
            <p className="text-[#c9d1d9] text-[11px] leading-relaxed">
              {action.impactSummary}
            </p>
          </div>

          {/* Stale Validation Warning */}
          <div className="p-2.5 rounded bg-[#151c27] border border-[#388bfd]/30 text-[10px] text-[#79c0ff] leading-relaxed">
            <strong>State Discipline:</strong> Applying this change will modify the authoritative
            infrastructure domain model. Validation status will immediately turn{' '}
            <span className="text-[#f0883e] font-semibold">STALE</span>. You will need to click{' '}
            <span className="underline font-semibold">Validate Topology</span> to verify that the
            finding is formally resolved.
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end space-x-2.5 px-4 py-3 bg-[#161b22] border-t border-[#2d333b]">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3.5 py-1.5 rounded bg-[#238636] border border-[#2ea043] text-white font-medium hover:bg-[#2ea043] transition-colors flex items-center space-x-1.5 shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Remediation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
