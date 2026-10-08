import React from 'react';
import {
  ScenarioDefinition,
  getAllScenarios,
} from '@pathforge/core';
import {
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  Flame,
  CheckCircle2,
  X,
  ArrowRight,
  Layers,
  BookOpen,
} from 'lucide-react';

interface ScenarioModalProps {
  isOpen: boolean;
  activeScenarioId: string;
  onClose: () => void;
  onSelectScenario: (scenarioId: string) => void;
}

const getRiskBadge = (level: ScenarioDefinition['riskLevel'], label: string) => {
  switch (level) {
    case 'hardened':
      return {
        bg: 'bg-[#14261b] text-[#3fb950] border-[#238636]/60',
        icon: ShieldCheck,
        label,
      };
    case 'critical':
      return {
        bg: 'bg-[#2d1519] text-[#f85149] border-[#da3633]/60',
        icon: AlertOctagon,
        label,
      };
    case 'high':
      return {
        bg: 'bg-[#291b15] text-[#f0883e] border-[#f0883e]/60',
        icon: AlertTriangle,
        label,
      };
    case 'chaos':
      return {
        bg: 'bg-[#241733] text-[#d2a8ff] border-[#8957e5]/60',
        icon: Flame,
        label,
      };
  }
};

export const ScenarioModal: React.FC<ScenarioModalProps> = ({
  isOpen,
  activeScenarioId,
  onClose,
  onSelectScenario,
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

  const scenarios = getAllScenarios();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scenario-modal-title"
    >
      <div className="w-full max-w-3xl rounded-lg bg-[#111318] border border-[#30363d] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#222630] bg-[#0d0f14] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded bg-[#388bfd]/15 border border-[#388bfd]/30 flex items-center justify-center text-[#58a6ff]">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <div id="scenario-modal-title" className="text-sm font-semibold text-white tracking-wide">
                SCENARIO LAB
              </div>
              <div className="text-[11px] text-[#8b949e]">
                Prebuilt infrastructure security models & experimentation sandboxes
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d] focus:outline-hidden focus:ring-1 focus:ring-[#388bfd] transition-colors"
            title="Close scenario picker (Esc)"
            aria-label="Close scenario picker"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scenarios Grid */}
        <div className="p-5 overflow-y-auto space-y-3.5 bg-[#0e1015]">
          {scenarios.map((scenario) => {
            const isActive = scenario.id === activeScenarioId;
            const badge = getRiskBadge(scenario.riskLevel, scenario.riskLabel);
            const BadgeIcon = badge.icon;

            return (
              <div
                key={scenario.id}
                className={`p-4 rounded-md border transition-all text-xs space-y-2.5 ${
                  isActive
                    ? 'bg-[#161b24] border-[#388bfd]/80 shadow-md ring-1 ring-[#388bfd]/40'
                    : 'bg-[#13161c] border-[#222630] hover:border-[#30363d]'
                }`}
              >
                {/* Title & Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-white">
                        {scenario.name}
                      </span>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded bg-[#1f6feb]/20 text-[#58a6ff] border border-[#388bfd]/40 text-[10px] font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#8b949e]">
                      {scenario.shortDescription}
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold flex items-center space-x-1.5 border shrink-0 ${badge.bg}`}
                  >
                    <BadgeIcon className="w-3 h-3" />
                    <span>{badge.label}</span>
                  </span>
                </div>

                {/* Purpose */}
                <div className="text-[11px] text-[#c9d1d9] leading-relaxed bg-[#0c0e12] p-2.5 rounded border border-[#1b1f27]">
                  <strong className="text-[#8b949e] uppercase text-[10px] block mb-0.5">
                    Purpose & Learning Objective:
                  </strong>
                  {scenario.purpose}
                </div>

                {/* Topology & Action footer */}
                <div className="flex items-center justify-between pt-1 text-[11px] text-[#8b949e] border-t border-[#1e232d]">
                  <div className="flex items-center space-x-1.5 truncate max-w-md">
                    <span className="text-[#5c6370]">Flow:</span>
                    <span className="font-mono text-[#abb2bf] text-[10px] truncate">
                      {scenario.topologyPreview}
                    </span>
                  </div>

                  {isActive ? (
                    <div className="flex items-center space-x-1 text-[#3fb950] text-[11px] font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Loaded in Canvas</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        onSelectScenario(scenario.id);
                        onClose();
                      }}
                      className="px-3 py-1 rounded bg-[#1f6feb] text-white hover:bg-[#388bfd] transition-colors text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
                    >
                      <span>Load Scenario</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="px-5 py-3 border-t border-[#222630] bg-[#0d0f14] flex items-center justify-between text-[11px] text-[#8b949e]">
          <div className="flex items-center space-x-1.5">
            <BookOpen className="w-3.5 h-3.5 text-[#58a6ff]" />
            <span>
              Deterministic local-first engine. Insecure connections are permitted and analyzed.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#21262d] text-[#c9d1d9] hover:text-white hover:bg-[#30363d] transition-colors text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
