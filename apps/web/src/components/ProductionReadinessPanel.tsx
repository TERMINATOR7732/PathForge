import React, { useState } from 'react';
import {
  ProductionReadinessAssessment,
  ProductionGateStatus,
  CategoryStatus,
} from '@pathforge/core';
import {
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  ShieldCheck,
  Crosshair,
  SlidersHorizontal,
  Layers,
  FileQuestion,
  ArrowRight,
  Shield,
} from 'lucide-react';

interface ProductionReadinessPanelProps {
  assessment: ProductionReadinessAssessment;
  onLocateElement: (target: { id: string; type: 'node' | 'edge' }) => void;
  onSelectTab?: (tab: 'findings' | 'attack-paths' | 'blast-radius' | 'verification' | 'architecture' | 'readiness') => void;
}

export const ProductionReadinessPanel: React.FC<ProductionReadinessPanelProps> = ({
  assessment,
  onLocateElement,
  onSelectTab: _onSelectTab,
}) => {
  const [activeSection, setActiveSection] = useState<'all' | 'gates' | 'categories' | 'blocking' | 'strengths' | 'gaps'>('all');

  const { status, score, rating, summary, gates, categories, blockingReasons, warnings, strengths, limitations, recommendedNextSteps } = assessment;

  // Status Styling
  const getStatusBadge = () => {
    switch (status) {
      case 'READY':
        return {
          bg: 'bg-[#238636]/15 text-[#3fb950] border-[#238636]/40',
          icon: ShieldCheck,
          label: 'PRODUCTION READY',
        };
      case 'READY_WITH_WARNINGS':
        return {
          bg: 'bg-[#9e6a03]/15 text-[#d29922] border-[#9e6a03]/40',
          icon: AlertTriangle,
          label: 'READY WITH WARNINGS',
        };
      case 'NOT_READY':
        return {
          bg: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/40',
          icon: AlertOctagon,
          label: 'NOT PRODUCTION READY',
        };
      default:
        return {
          bg: 'bg-[#8b949e]/15 text-[#8b949e] border-[#8b949e]/40',
          icon: FileQuestion,
          label: 'INSUFFICIENT EVIDENCE',
        };
    }
  };

  const getGateBadge = (gStatus: ProductionGateStatus) => {
    switch (gStatus) {
      case 'PASSED':
        return { bg: 'bg-[#238636]/15 text-[#3fb950] border-[#238636]/30', label: 'PASSED' };
      case 'WARNING':
        return { bg: 'bg-[#d29922]/15 text-[#d29922] border-[#d29922]/30', label: 'WARNING' };
      case 'BLOCKED':
        return { bg: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/30', label: 'BLOCKED' };
      default:
        return { bg: 'bg-[#58a6ff]/15 text-[#58a6ff] border-[#58a6ff]/30', label: 'LIMITED' };
    }
  };

  const getCategoryStatusBadge = (cStatus: CategoryStatus) => {
    switch (cStatus) {
      case 'PASSED':
        return 'text-[#3fb950] bg-[#238636]/15 border-[#238636]/30';
      case 'WARNING':
        return 'text-[#d29922] bg-[#d29922]/15 border-[#d29922]/30';
      case 'BLOCKED':
        return 'text-[#f85149] bg-[#da3633]/15 border-[#da3633]/30';
      default:
        return 'text-[#8b949e] bg-[#21262d] border-[#30363d]';
    }
  };

  const statusInfo = getStatusBadge();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#0d0f13] text-[#c9d1d9] font-mono text-xs">
      {/* Top Banner: Score, Status & Key Metrics */}
      <div className="p-4 border-b border-[#222630] bg-[#111318]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 px-2.5 py-1 rounded border font-semibold text-xs ${statusInfo.bg}`}>
              <StatusIcon className="w-4 h-4" />
              <span>{statusInfo.label}</span>
            </div>

            <div className="flex items-center space-x-2 bg-[#161a22] px-3 py-1 rounded border border-[#2d333b]">
              <span className="text-[#8b949e] text-[11px]">READINESS SCORE:</span>
              <span className="text-base font-bold text-[#e6edf3]">{score}</span>
              <span className="text-[#8b949e] text-[10px]">/ 100</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                rating === 'EXCELLENT' || rating === 'GOOD'
                  ? 'bg-[#238636]/20 text-[#3fb950] border-[#238636]/40'
                  : rating === 'NEEDS_ATTENTION'
                  ? 'bg-[#d29922]/20 text-[#d29922] border-[#d29922]/40'
                  : 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/40'
              }`}>
                {rating}
              </span>
            </div>
          </div>

          {/* Quick Gate Metric Pills */}
          <div className="flex items-center space-x-2 text-[11px]">
            <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#161a22] border border-[#2d333b]">
              <span className="text-[#8b949e]">GATES:</span>
              <span className="text-[#3fb950] font-bold">{summary.passedGates} P</span>
              <span className="text-[#8b949e]">/</span>
              <span className="text-[#d29922] font-bold">{summary.warningGates} W</span>
              <span className="text-[#8b949e]">/</span>
              <span className="text-[#f85149] font-bold">{summary.blockedGates} B</span>
            </div>

            <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#161a22] border border-[#2d333b]">
              <span className="text-[#8b949e]">BLOCKING:</span>
              <span className={`font-bold ${summary.blockingReasonCount > 0 ? 'text-[#f85149]' : 'text-[#3fb950]'}`}>
                {summary.blockingReasonCount}
              </span>
            </div>

            <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#161a22] border border-[#2d333b]">
              <span className="text-[#8b949e]">STRENGTHS:</span>
              <span className="text-[#3fb950] font-bold">{summary.strengthCount}</span>
            </div>
          </div>
        </div>

        {/* Score Progress Bar */}
        <div className="mt-3">
          <div className="h-1.5 w-full bg-[#21262d] rounded-full overflow-hidden flex">
            <div
              className={`h-full transition-all duration-300 ${
                score >= 80 ? 'bg-[#3fb950]' : score >= 50 ? 'bg-[#d29922]' : 'bg-[#f85149]'
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        {/* Executive Verdict Callout */}
        <div className="mt-3 p-2.5 rounded bg-[#161a22] border border-[#2d333b] text-[#8b949e] text-[11px] leading-relaxed">
          <span className="text-[#58a6ff] font-semibold mr-1.5">EXECUTIVE VERDICT:</span>
          {summary.executiveVerdict}
        </div>

        {/* Section Filter Pills */}
        <div className="mt-3 flex items-center space-x-1.5 pt-2 border-t border-[#222630]/60 overflow-x-auto text-[10px]">
          <span className="text-[#8b949e] flex items-center space-x-1 mr-1">
            <SlidersHorizontal className="w-3 h-3" />
            <span>VIEW:</span>
          </span>
          {(['all', 'gates', 'categories', 'blocking', 'strengths', 'gaps'] as const).map((sec) => (
            <button
              key={sec}
              onClick={() => setActiveSection(sec)}
              className={`px-2 py-0.5 rounded border transition-colors uppercase ${
                activeSection === sec
                  ? 'bg-[#1f242c] text-[#e6edf3] border-[#58a6ff] font-semibold'
                  : 'bg-[#14171d] text-[#8b949e] border-[#222630] hover:text-[#c9d1d9]'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* 1. Production Gates Section */}
        {(activeSection === 'all' || activeSection === 'gates') && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-[#e6edf3] flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-[#58a6ff]" />
                <span>PRODUCTION READINESS GATES ({gates.length})</span>
              </span>
              <span className="text-[10px] text-[#8b949e]">Deterministic compliance thresholds</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {gates.map((gate) => {
                const badge = getGateBadge(gate.status);
                return (
                  <div
                    key={gate.id}
                    className="p-3 rounded bg-[#111318] border border-[#222630] flex flex-col justify-between space-y-2 hover:border-[#30363d] transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="font-semibold text-[#e6edf3] text-[11px] truncate">
                          {gate.name}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded border text-[9px] font-bold ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8b949e] leading-snug line-clamp-2">
                        {gate.summary}
                      </p>
                    </div>

                    <div className="space-y-1 pt-1.5 border-t border-[#222630]/60">
                      {gate.reasons.slice(0, 2).map((reason, idx) => (
                        <div key={idx} className="text-[9.5px] text-[#8b949e] flex items-start space-x-1">
                          <span className="text-[#58a6ff]">•</span>
                          <span className="line-clamp-1">{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Blocking Reasons Section */}
        {(activeSection === 'all' || activeSection === 'blocking') && blockingReasons.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-[#f85149] flex items-center space-x-1.5">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>BLOCKING REASONS ({blockingReasons.length})</span>
              </span>
              <span className="text-[10px] text-[#8b949e]">Critical violations blocking production deployment</span>
            </div>

            <div className="space-y-2">
              {blockingReasons.map((reason) => (
                <div
                  key={reason.id}
                  className="p-3 rounded bg-[#181112] border border-[#da3633]/40 space-y-2"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.2 rounded bg-[#da3633]/20 text-[#f85149] border border-[#da3633]/40 text-[9px] font-bold uppercase">
                        {reason.severity}
                      </span>
                      <span className="font-semibold text-[#e6edf3] text-[11px]">{reason.title}</span>
                    </div>

                    {reason.affectedNodeIds.length > 0 && (
                      <button
                        onClick={() => onLocateElement({ id: reason.affectedNodeIds[0], type: 'node' })}
                        className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-[10px] border border-[#30363d] transition-colors"
                      >
                        <Crosshair className="w-3 h-3 text-[#58a6ff]" />
                        <span>Locate Asset</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[10.5px] text-[#c9d1d9] leading-relaxed">
                    {reason.explanation}
                  </p>

                  <div className="p-2 rounded bg-[#111318] border border-[#222630] space-y-1">
                    <div className="text-[9.5px] text-[#58a6ff] font-semibold">RECOMMENDED REMEDIATION:</div>
                    <div className="text-[10px] text-[#8b949e]">{reason.recommendation}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Non-Blocking Warnings Section */}
        {(activeSection === 'all' || activeSection === 'blocking') && warnings.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-[#d29922] flex items-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>OPERATIONAL & RESILIENCE WARNINGS ({warnings.length})</span>
              </span>
              <span className="text-[10px] text-[#8b949e]">Non-blocking architectural recommendations</span>
            </div>

            <div className="space-y-2">
              {warnings.map((warn) => (
                <div
                  key={warn.id}
                  className="p-2.5 rounded bg-[#161410] border border-[#d29922]/30 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-[#e6edf3] text-[11px] flex items-center space-x-1.5">
                      <span className="text-[#d29922]">⚠</span>
                      <span>{warn.title}</span>
                    </div>

                    {warn.affectedNodeIds.length > 0 && (
                      <button
                        onClick={() => onLocateElement({ id: warn.affectedNodeIds[0], type: 'node' })}
                        className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-[9.5px] border border-[#30363d]"
                      >
                        <Crosshair className="w-2.5 h-2.5 text-[#58a6ff]" />
                        <span>Locate</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-[#8b949e] leading-snug">
                    {warn.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Readiness Categories Breakdown */}
        {(activeSection === 'all' || activeSection === 'categories') && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-[#e6edf3] flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-[#a371f7]" />
                <span>READINESS CATEGORIES BREAKDOWN</span>
              </span>
              <span className="text-[10px] text-[#8b949e]">Weighted health scores by functional domain</span>
            </div>

            <div className="space-y-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-3 rounded bg-[#111318] border border-[#222630] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-[#e6edf3] text-[11px]">{cat.name}</span>
                      <span className="text-[#8b949e] text-[9.5px]">({cat.weight}% weight)</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-[#e6edf3] text-xs">{cat.score}/100</span>
                      <span className={`px-1.5 py-0.2 rounded border text-[9px] font-bold uppercase ${getCategoryStatusBadge(cat.status)}`}>
                        {cat.status}
                      </span>
                    </div>
                  </div>

                  <div className="h-1 w-full bg-[#21262d] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        cat.score >= 80 ? 'bg-[#3fb950]' : cat.score >= 50 ? 'bg-[#d29922]' : 'bg-[#f85149]'
                      }`}
                      style={{ width: `${cat.score}%` }}
                    />
                  </div>

                  <p className="text-[10px] text-[#8b949e]">{cat.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Objective Strengths Section */}
        {(activeSection === 'all' || activeSection === 'strengths') && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-[#3fb950] flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>OBJECTIVELY VERIFIED STRENGTHS ({strengths.length})</span>
              </span>
              <span className="text-[10px] text-[#8b949e]">Confirmed defensive architecture attributes</span>
            </div>

            {strengths.length === 0 ? (
              <div className="p-3 rounded bg-[#111318] border border-[#222630] text-[10.5px] text-[#8b949e] italic">
                No objective strengths verified in current topology model.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {strengths.map((str, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded bg-[#101912] border border-[#238636]/30 text-[10.5px] text-[#e6edf3] flex items-start space-x-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#3fb950] shrink-0 mt-0.5" />
                    <span>{str}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. Unverified Operational Controls / Evidence Gaps */}
        {(activeSection === 'all' || activeSection === 'gaps') && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-[#58a6ff] flex items-center space-x-1.5">
                <FileQuestion className="w-3.5 h-3.5" />
                <span>OPERATIONAL EVIDENCE GAPS & LIMITATIONS ({limitations.length})</span>
              </span>
              <span className="text-[10px] text-[#8b949e]">Unmodeled runtime controls outside graph scope</span>
            </div>

            <div className="p-3 rounded bg-[#111318] border border-[#222630] mb-2.5 text-[10.5px] text-[#8b949e] leading-relaxed">
              <span className="text-[#58a6ff] font-semibold">TRUTHFUL ENGINEERING DISCLOSURE: </span>
              PathForge evaluates modeled virtual infrastructure diagrams and configurations. The following 10 runtime operational controls cannot be verified from network topology models and require external audit verification.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {limitations.map((lim) => (
                <div
                  key={lim.id}
                  className="p-2.5 rounded bg-[#161a22] border border-[#2d333b] space-y-1 text-[10px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#e6edf3] text-[10.5px]">{lim.name}</span>
                    <span className="text-[9px] text-[#8b949e] uppercase px-1 py-0.2 rounded bg-[#21262d]">
                      {lim.category}
                    </span>
                  </div>
                  <p className="text-[#8b949e]">{lim.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Recommended Next Steps */}
        {recommendedNextSteps.length > 0 && (
          <div className="pt-2 border-t border-[#222630]">
            <div className="text-xs font-semibold text-[#e6edf3] mb-2 flex items-center space-x-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-[#58a6ff]" />
              <span>RECOMMENDED NEXT STEPS FOR PRODUCTION</span>
            </div>
            <div className="space-y-1.5">
              {recommendedNextSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-[#161a22] border border-[#2d333b] text-[10.5px] text-[#c9d1d9] flex items-start space-x-2"
                >
                  <span className="text-[#58a6ff] font-bold">{idx + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
