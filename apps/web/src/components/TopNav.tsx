import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Play,
  Download,
  Terminal,
  RefreshCw,
  RotateCcw,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { ValidationResult } from '@pathforge/shared';
import { getScenarioById } from '@pathforge/core';

interface TopNavProps {
  currentScenarioId: string;
  onOpenScenarioModal: () => void;
  onOpenResetModal: () => void;
  onValidate: () => void;
  onExport: () => void;
  validationResult: ValidationResult | null;
  isValidationStale?: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentScenarioId,
  onOpenScenarioModal,
  onOpenResetModal,
  onValidate,
  onExport,
  validationResult,
  isValidationStale = false,
}) => {
  const currentScenario = getScenarioById(currentScenarioId);
  const scenarioName = currentScenario?.name ?? 'Custom Environment';

  return (
    <header className="h-12 border-b border-[#222630] bg-[#111318] flex items-center justify-between px-4 select-none z-30">
      <div className="flex items-center space-x-3">
        {/* Brand */}
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded bg-[#388bfd]/10 border border-[#388bfd]/30 flex items-center justify-center text-[#388bfd]">
            <Terminal className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="font-semibold text-sm tracking-wide text-white font-mono">
              PathForge
            </span>
            <span className="text-[10px] text-[#5c6370] uppercase font-mono tracking-wider hidden sm:inline">
              v0.3.0 · Phase 1.7
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-[#222630]" />

        {/* Scenario Lab Trigger */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={onOpenScenarioModal}
            className="flex items-center space-x-2 px-2.5 py-1 rounded bg-[#181c24] border border-[#2a303c] text-xs text-[#e6edf3] font-mono hover:bg-[#202530] hover:border-[#388bfd]/60 transition-colors shadow-sm"
            title="Open Scenario Lab to load preconfigured topologies"
          >
            <Layers className="w-3.5 h-3.5 text-[#58a6ff]" />
            <span className="text-[#8b949e]">SCENARIO:</span>
            <span className="font-semibold text-white truncate max-w-[150px] sm:max-w-[220px]">
              {scenarioName}
            </span>
            <ChevronDown className="w-3 h-3 text-[#8b949e]" />
          </button>

          {/* Reset Scenario Button */}
          <button
            onClick={onOpenResetModal}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-[#181c24] border border-[#2a303c] text-xs text-[#8b949e] hover:bg-[#241a18] hover:text-[#f85149] hover:border-[#da3633]/40 transition-colors font-mono"
            title="Reset scenario to original baseline definition"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden md:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Middle Status Indicator */}
      <div className="hidden lg:flex items-center space-x-3">
        {isValidationStale ? (
          <div className="flex items-center space-x-2 px-2.5 py-0.5 rounded bg-[#2b1f14] border border-[#f0883e]/50 text-[#f0883e] text-xs font-mono animate-pulse">
            <RefreshCw className="w-3 h-3" />
            <span>TOPOLOGY MODIFIED · VALIDATION STALE</span>
          </div>
        ) : validationResult ? (
          <div className="flex items-center space-x-2">
            {validationResult.summary.passed ? (
              <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded bg-[#14261b] border border-[#238636]/50 text-[#3fb950] text-xs font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>VALIDATED · PRODUCTION GATE: PASSED</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-2.5 py-0.5 rounded bg-[#2d1519] border border-[#da3633]/50 text-[#f85149] text-xs font-mono">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>
                  VALIDATED · PRODUCTION GATE: BLOCKED ({validationResult.summary.totalFindings} FINDING
                  {validationResult.summary.totalFindings > 1 ? 'S' : ''})
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
          <span className="hidden sm:inline">Export JSON</span>
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
