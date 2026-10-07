import React, { useState, useMemo } from 'react';
import {
  ArchitectureAnalysisResult,
  ArchitectureFindingCategory,
} from '@pathforge/core';
import {
  Layers,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertOctagon,
  Crosshair,
  Info,
  CheckCircle2,
  SlidersHorizontal,
  Flame,
  Shield,
  Activity,
} from 'lucide-react';

interface ArchitecturePanelProps {
  analysisResult: ArchitectureAnalysisResult;
  onLocateElement: (target: { id: string; type: 'node' | 'edge' }) => void;
  onSelectTab?: (tab: 'findings' | 'attack-paths' | 'blast-radius' | 'verification' | 'architecture') => void;
}

const getSeverityBadge = (sev: string) => {
  switch (sev) {
    case 'critical':
      return {
        bg: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/40',
        bar: 'bg-[#f85149]',
        icon: AlertOctagon,
      };
    case 'high':
      return {
        bg: 'bg-[#f0883e]/15 text-[#f0883e] border-[#f0883e]/40',
        bar: 'bg-[#f0883e]',
        icon: AlertTriangle,
      };
    case 'medium':
      return {
        bg: 'bg-[#d29922]/15 text-[#d29922] border-[#d29922]/40',
        bar: 'bg-[#d29922]',
        icon: AlertTriangle,
      };
    default:
      return {
        bg: 'bg-[#58a6ff]/15 text-[#58a6ff] border-[#58a6ff]/40',
        bar: 'bg-[#58a6ff]',
        icon: Info,
      };
  }
};

const getRatingColor = (rating: string) => {
  switch (rating) {
    case 'strong':
      return { text: 'text-[#3fb950]', bg: 'bg-[#238636]/15', border: 'border-[#238636]/40', bar: 'bg-[#3fb950]' };
    case 'good':
      return { text: 'text-[#58a6ff]', bg: 'bg-[#388bfd]/15', border: 'border-[#388bfd]/40', bar: 'bg-[#58a6ff]' };
    case 'needs-attention':
      return { text: 'text-[#f0883e]', bg: 'bg-[#f0883e]/15', border: 'border-[#f0883e]/40', bar: 'bg-[#f0883e]' };
    default:
      return { text: 'text-[#f85149]', bg: 'bg-[#da3633]/15', border: 'border-[#da3633]/40', bar: 'bg-[#f85149]' };
  }
};

export const ArchitecturePanel: React.FC<ArchitecturePanelProps> = ({
  analysisResult,
  onLocateElement,
  onSelectTab,
}) => {
  const { profile, findings, score, tierAnalysis, topologyAnalysis, dependencyAnalysis } = analysisResult;

  const [categoryFilter, setCategoryFilter] = useState<'all' | ArchitectureFindingCategory>('all');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  const filteredFindings = useMemo(() => {
    if (categoryFilter === 'all') return findings;
    return findings.filter((f) => f.category === categoryFilter);
  }, [findings, categoryFilter]);

  const activeFinding = useMemo(() => {
    if (!selectedFindingId) {
      return filteredFindings[0] ?? findings[0] ?? null;
    }
    return findings.find((f) => f.id === selectedFindingId) ?? null;
  }, [selectedFindingId, filteredFindings, findings]);

  const ratingColor = getRatingColor(score.rating);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0f12] text-xs font-mono select-none">
      {/* 1. Header Toolbar & Architecture Score Banner */}
      <div className="p-3 border-b border-[#222630] bg-[#12151b] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#58a6ff]" />
            <span className="font-bold text-white tracking-wide text-xs">
              ARCHITECTURE ANALYSIS INTELLIGENCE
            </span>
            <span className="px-1.5 py-0.2 rounded bg-[#1f242e] text-[#58a6ff] border border-[#30363d] text-[10px]">
              {findings.length} Structural Observation{findings.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[10px] text-[#8b949e]">
            <span>Deterministic Structural Graph Evaluation · No AI</span>
          </div>
        </div>

        {/* Score & Profile Summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[10px]">
          {/* Architecture Score Card */}
          <div className={`p-2 rounded bg-[#161a22] border ${ratingColor.border} space-y-1 sm:col-span-1`}>
            <div className="flex items-center justify-between">
              <span className="text-[#8b949e]">Architecture Score</span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${ratingColor.bg} ${ratingColor.text}`}>
                {score.rating.replace('-', ' ')}
              </span>
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-bold text-white">{score.score}</span>
              <span className="text-[10px] text-[#8b949e]">/100</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#21262d] overflow-hidden">
              <div className={`h-full ${ratingColor.bar}`} style={{ width: `${score.score}%` }} />
            </div>
          </div>

          {/* Segmentation Quality Card */}
          <div className="p-2 rounded bg-[#161a22] border border-[#222630] space-y-1">
            <div className="text-[#8b949e] flex items-center justify-between">
              <span>Segmentation</span>
              <Shield className="w-3 h-3 text-[#58a6ff]" />
            </div>
            <div className="text-sm font-bold uppercase text-white">
              {profile.segmentation}
            </div>
            <div className="text-[9px] text-[#8b949e] truncate" title={topologyAnalysis.rationale}>
              {profile.networkZonesCount} zones · {profile.trustBoundariesCount} boundaries
            </div>
          </div>

          {/* Tier Separation Quality Card */}
          <div className="p-2 rounded bg-[#161a22] border border-[#222630] space-y-1">
            <div className="text-[#8b949e] flex items-center justify-between">
              <span>Tier Separation</span>
              <Layers className="w-3 h-3 text-[#58a6ff]" />
            </div>
            <div className="text-sm font-bold uppercase text-white">
              {profile.tierSeparation}
            </div>
            <div className="text-[9px] text-[#8b949e] truncate" title={tierAnalysis.rationale}>
              {profile.applicationTiersCount} active tiers modeled
            </div>
          </div>

          {/* Dependency Concentration Card */}
          <div className="p-2 rounded bg-[#161a22] border border-[#222630] space-y-1">
            <div className="text-[#8b949e] flex items-center justify-between">
              <span>Concentration</span>
              <Activity className="w-3 h-3 text-[#58a6ff]" />
            </div>
            <div className="text-sm font-bold uppercase text-white">
              {profile.dependencyConcentration}
            </div>
            <div className="text-[9px] text-[#8b949e] truncate" title={dependencyAnalysis.rationale}>
              {dependencyAnalysis.singlePointsOfFailure.length} potential SPOF(s)
            </div>
          </div>
        </div>

        {/* Deductions Summary Strip (if any) */}
        {score.deductions.length > 0 && (
          <div className="p-1.5 rounded bg-[#161a22]/70 border border-[#222630] flex flex-wrap items-center gap-1.5 text-[9px]">
            <span className="text-[#8b949e] font-semibold">Score Deductions:</span>
            {score.deductions.map((d, idx) => (
              <span key={idx} className="px-1.5 py-0.2 rounded bg-[#2b1f14] text-[#f0883e] border border-[#f0883e]/30">
                {d.reason}
              </span>
            ))}
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#222630]/60 text-[10px]">
          <div className="flex items-center space-x-1">
            <SlidersHorizontal className="w-3 h-3 text-[#8b949e]" />
            <span className="text-[#8b949e]">Category:</span>
            {(
              [
                'all',
                'tier-separation',
                'flat-topology',
                'critical-asset-dependency',
                'single-point-of-failure',
                'management-exposure',
                'segmentation',
              ] as const
            ).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-1.5 py-0.5 rounded border capitalize transition-colors ${
                  categoryFilter === cat
                    ? 'bg-[#21262d] text-[#e6edf3] border-[#58a6ff]'
                    : 'bg-[#161a22] text-[#8b949e] border-[#222630] hover:border-[#30363d]'
                }`}
              >
                {cat.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Main Content Area */}
      {findings.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 font-mono">
          <ShieldCheck className="w-10 h-10 text-[#3fb950]" />
          <div className="text-sm font-semibold text-white">
            Clean Architectural Foundation
          </div>
          <p className="text-xs text-[#8b949e] max-w-md leading-relaxed">
            Multi-tier segregation, controlled cross-zone transitions, and balanced dependencies conform to
            defense-in-depth principles. No unsegmented flat networks, direct edge-to-data bypasses, or single points
            of failure were detected in the modeled graph.
          </p>
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2 text-[#8b949e]">
          <CheckCircle2 className="w-6 h-6 text-[#58a6ff]" />
          <div className="text-xs">No architectural observations match the selected category filter.</div>
          <button
            onClick={() => setCategoryFilter('all')}
            className="text-[10px] text-[#58a6ff] hover:underline"
          >
            Clear Filter
          </button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Architectural Findings List */}
          <div className="w-[360px] border-r border-[#222630] flex flex-col overflow-y-auto bg-[#0d0f14] divide-y divide-[#222630]">
            {filteredFindings.map((finding) => {
              const isSelected = activeFinding?.id === finding.id;
              const badge = getSeverityBadge(finding.severity);
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={finding.id}
                  onClick={() => setSelectedFindingId(finding.id)}
                  className={`p-3 text-left transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-[#181d26] border-l-3 border-[#58a6ff] shadow-inner'
                      : 'hover:bg-[#12161f] border-l-3 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase flex items-center space-x-1 ${badge.bg}`}
                    >
                      <BadgeIcon className="w-3 h-3" />
                      <span>{finding.severity}</span>
                    </span>

                    <span className="text-[10px] text-[#8b949e] font-mono">
                      {finding.category.replace('-', ' ')}
                    </span>
                  </div>

                  {/* Finding Title */}
                  <div className="text-[11px] font-semibold text-white line-clamp-1">
                    {finding.title}
                  </div>

                  {/* Finding Summary Excerpt */}
                  <div className="text-[10px] text-[#8b949e] line-clamp-2 leading-relaxed">
                    {finding.summary}
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-[#5c6370] pt-0.5">
                    <span>{finding.id}</span>
                    {finding.affectedNodeIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLocateElement({ id: finding.affectedNodeIds[0], type: 'node' });
                        }}
                        className="text-[#8b949e] hover:text-[#58a6ff] flex items-center space-x-1"
                        title="Locate affected component on canvas"
                      >
                        <Crosshair className="w-3 h-3" />
                        <span>Locate</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Deep Architectural Detail & Recommendations */}
          {activeFinding ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0d0f12]">
              {/* Finding Header Card */}
              <div className="p-3.5 rounded bg-[#161a22] border border-[#2d333b] space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                          getSeverityBadge(activeFinding.severity).bg
                        }`}
                      >
                        {activeFinding.severity.toUpperCase()} · {activeFinding.id}
                      </span>
                      <span className="text-white text-sm font-semibold">
                        {activeFinding.title}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#8b949e] mt-1">
                      Structural Category: <strong className="text-[#c9d1d9]">{activeFinding.category.replace('-', ' ')}</strong>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {activeFinding.affectedNodeIds.length > 0 && (
                      <button
                        onClick={() =>
                          onLocateElement({ id: activeFinding.affectedNodeIds[0], type: 'node' })
                        }
                        className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#21262d] text-[#c9d1d9] hover:text-white hover:bg-[#30363d] transition-colors text-[11px]"
                        title="Center canvas on primary affected node"
                      >
                        <Crosshair className="w-3 h-3 text-[#58a6ff]" />
                        <span>Locate on Canvas</span>
                      </button>
                    )}
                    {onSelectTab && (
                      <button
                        onClick={() => onSelectTab('attack-paths')}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#21262d] text-[#c9d1d9] hover:text-white hover:bg-[#30363d] transition-colors text-[11px]"
                        title="Switch to Attack Paths analysis"
                      >
                        <Flame className="w-3 h-3 text-[#f85149]" />
                        <span>View Attack Paths</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-xs text-[#c9d1d9] leading-relaxed pt-1">
                  {activeFinding.summary}
                </div>
              </div>

              {/* WHY IT MATTERS (ARCHITECTURAL IMPACT) */}
              <div className="p-3 rounded bg-[#161822] border border-[#30363d] space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#58a6ff] flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5 text-[#58a6ff]" />
                  <span>WHY THIS STRUCTURAL PATTERN MATTERS</span>
                </div>
                <p className="text-[11px] text-[#c9d1d9] leading-relaxed">
                  {activeFinding.whyItMatters}
                </p>
              </div>

              {/* OBSERVABLE GRAPH EVIDENCE */}
              <div className="p-3 rounded bg-[#14171d] border border-[#222630] space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#e6edf3] flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#f0883e]" />
                  <span>OBSERVABLE GRAPH EVIDENCE</span>
                </div>
                <ul className="space-y-1 text-[11px] text-[#c9d1d9] list-disc list-inside leading-relaxed">
                  {activeFinding.evidence.map((ev, idx) => (
                    <li key={idx} className="pl-1">
                      <span>{ev}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CONCRETE ARCHITECTURAL RECOMMENDATION */}
              <div className="p-3 rounded bg-[#12231c] border border-[#238636]/40 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#3fb950] flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#3fb950]" />
                  <span>CONCRETE ARCHITECTURAL RECOMMENDATION</span>
                </div>
                <p className="text-[11px] text-[#e6edf3] leading-relaxed">
                  {activeFinding.recommendation}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8 text-[#8b949e]">
              Select an architectural observation from the list to review structural details and recommendations.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
