import React from 'react';
import { ShieldAlert, ShieldCheck, Play, Download, Terminal, RefreshCw } from 'lucide-react';
import { ValidationResult } from '@pathforge/shared';

interface TopNavProps {
  currentEnvId: string;
  onSelectEnv: (envId: string) => void;
  onValidate: () => void;
  onExport: () => void;
  validationResult: ValidationResult | null;
  isValidationStale?: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentEnvId,
  onSelectEnv,
  onValidate,
  onExport,
  validationResult,
  isValidationStale = false,
}) => {
  return (
    <header className="h-12 border-b border-[#222630] bg-[#111318] flex items-center justify-between px-4 select-none z-30">
      <div className="flex items-center space-x-4">
        {/* Brand */}
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded bg-[#388bfd]/10 border border-[#388bfd]/30 flex items-center justify-center text-[#388bfd]">
            <Terminal className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="font-semibold text-sm tracking-wide text-white font-mono">
              PathForge
            </span>
            <span className="text-[10px] text-[#5c6370] uppercase font-mono tracking-wider">
              v0.2.0 · Phase 1.2
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-[#222630]" />

        {/* Environment Picker */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-[#8b949e] font-mono">ENV:</span>
          <select
            value={currentEnvId}
            onChange={(e) => onSelectEnv(e.target.value)}
            className="bg-[#181c24] border border-[#2a303c] rounded px-2.5 py-1 text-xs text-[#e6edf3] font-mono focus:outline-none focus:border-[#388bfd] transition-colors"
          >
            <option value="standard-web">Standard Secure 3-Tier Web App</option>
            <option value="compromised-chaos">Chaos Lab — Direct DB & Exposed Admin</option>
          </select>
        </div>
      </div>

      {/* Middle Status Indicator */}
      <div className="flex items-center space-x-3">
        {isValidationStale ? (
          <div className="flex items-center space-x-2 px-2.5 py-0.5 rounded bg-[#d29922]/15 border border-[#d29922]/40 text-[#d29922] text-xs font-mono">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>TOPOLOGY MODIFIED · VALIDATION OUTDATED</span>
          </div>
        ) : validationResult ? (
          <div className="flex items-center space-x-2">
            {validationResult.summary.passed ? (
              <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded bg-[#238636]/10 border border-[#238636]/30 text-[#3fb950] text-xs font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>TOPOLOGY SECURE</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-2.5 py-0.5 rounded bg-[#da3633]/10 border border-[#da3633]/30 text-[#f85149] text-xs font-mono">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>
                  {validationResult.summary.totalFindings} FINDING
                  {validationResult.summary.totalFindings > 1 ? 'S' : ''} (
                  {validationResult.summary.criticalCount} CRITICAL,{' '}
                  {validationResult.summary.highCount} HIGH)
                </span>
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-[#5c6370] font-mono">Validation Pending</span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onExport}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#181c24] border border-[#2a303c] text-xs text-[#c9d1d9] hover:bg-[#202530] hover:text-white transition-colors font-mono"
          title="Export topology definition as JSON"
        >
          <Download className="w-3 h-3 text-[#8b949e]" />
          <span>Export JSON</span>
        </button>

        <button
          onClick={onValidate}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs text-white font-medium transition-all font-mono shadow-sm ${
            isValidationStale
              ? 'bg-[#1f6feb] hover:bg-[#388bfd] ring-2 ring-[#388bfd]/50'
              : 'bg-[#238636] hover:bg-[#2ea043]'
          }`}
          title="Run deterministic validation engine"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>{isValidationStale ? 'Re-Validate Topology' : 'Validate Topology'}</span>
        </button>
      </div>
    </header>
  );
};
