import React, { useState, useMemo } from 'react';
import {
  AttackPathAnalysisResult,
  AttackPathRisk,
} from '@pathforge/core';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  Crosshair,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  Info,
  Radio,
  Zap,
  Target,
  Shield,
} from 'lucide-react';

interface AttackPathsPanelProps {
  analysisResult: AttackPathAnalysisResult;
  selectedPathId: string | null;
  onSelectPath: (pathId: string | null) => void;
  onLocateElement: (target: { id: string; type: 'node' | 'edge' }) => void;
  onAnalyze?: () => void;
  onAnalyzeBlastRadius?: (nodeId: string) => void;
  isStale?: boolean;
}

const getRiskBadge = (risk: AttackPathRisk) => {
  switch (risk) {
    case 'critical':
      return {
        bg: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/40',
        bar: 'bg-[#f85149]',
        icon: AlertOctagon,
        label: 'CRITICAL',
      };
    case 'high':
      return {
        bg: 'bg-[#f0883e]/15 text-[#f0883e] border-[#f0883e]/40',
        bar: 'bg-[#f0883e]',
        icon: AlertTriangle,
        label: 'HIGH',
      };
    case 'medium':
      return {
        bg: 'bg-[#d29922]/15 text-[#d29922] border-[#d29922]/40',
        bar: 'bg-[#d29922]',
        icon: AlertTriangle,
        label: 'MEDIUM',
      };
    default:
      return {
        bg: 'bg-[#58a6ff]/15 text-[#58a6ff] border-[#58a6ff]/40',
        bar: 'bg-[#58a6ff]',
        icon: Info,
        label: 'LOW',
      };
  }
};

export const AttackPathsPanel: React.FC<AttackPathsPanelProps> = ({
  analysisResult,
  selectedPathId,
  onSelectPath,
  onLocateElement,
  onAnalyze,
  onAnalyzeBlastRadius,
  isStale = false,
}) => {
  const [riskFilter, setRiskFilter] = useState<'all' | AttackPathRisk>('all');
  const [entryPointFilter, setEntryPointFilter] = useState<string>('all');
  const [targetFilter, setTargetFilter] = useState<'all' | 'critical' | 'high' | 'sensitive'>('all');

  const { attackPaths, summary, entryPoints, intelligence } = analysisResult;

  // Filter paths
  const filteredPaths = useMemo(() => {
    return attackPaths.filter((path) => {
      if (riskFilter !== 'all' && path.risk !== riskFilter) {
        return false;
      }
      if (entryPointFilter !== 'all' && path.entryPoint.id !== entryPointFilter) {
        return false;
      }
      if (targetFilter !== 'all') {
        if (targetFilter === 'critical' && path.target.criticality !== 'critical') {
          return false;
        }
        if (targetFilter === 'high' && path.target.criticality !== 'high') {
          return false;
        }
        if (targetFilter === 'sensitive' && path.target.criticality !== 'critical' && path.target.criticality !== 'high') {
          return false;
        }
      }
      return true;
    });
  }, [attackPaths, riskFilter, entryPointFilter, targetFilter]);

  // Selected path object
  const activePath = useMemo(() => {
    if (!selectedPathId) {
      return filteredPaths[0] ?? attackPaths[0] ?? null;
    }
    return attackPaths.find((p) => p.id === selectedPathId) ?? null;
  }, [selectedPathId, filteredPaths, attackPaths]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0f12] text-xs font-mono select-none">
      {/* 1. Header Toolbar & Summary Metrics */}
      <div className="p-3 border-b border-[#222630] bg-[#12151b] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Flame className="w-4 h-4 text-[#f85149]" />
            <span className="font-bold text-white tracking-wide text-xs">
              RISK-WEIGHTED ATTACK PATH INTELLIGENCE
            </span>
            <span className="px-1.5 py-0.2 rounded bg-[#1f242e] text-[#58a6ff] border border-[#30363d] text-[10px]">
              {attackPaths.length} Path{attackPaths.length === 1 ? '' : 's'} Analyzed
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {isStale && (
              <span className="px-2 py-0.5 rounded bg-[#2b1f14] text-[#f0883e] border border-[#f0883e]/50 text-[10px] font-semibold animate-pulse">
                TOPOLOGY MODIFIED · STALE
              </span>
            )}
            {onAnalyze && (
              <button
                onClick={onAnalyze}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#1f242e] border border-[#30363d] text-[#c9d1d9] hover:text-white hover:border-[#58a6ff] transition-colors text-[11px]"
                title="Re-run deterministic risk-weighted reachability analysis"
              >
                <RefreshCw className="w-3 h-3 text-[#58a6ff]" />
                <span>Re-Analyze</span>
              </button>
            )}
          </div>
        </div>

        {/* Reachability Intelligence Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[10px]">
          <div className="p-1.5 rounded bg-[#161a22] border border-[#222630] space-y-0.5">
            <div className="text-[#8b949e]">Entry Points</div>
            <div className="text-sm font-bold text-white">{summary.entryPointCount}</div>
          </div>
          <div className="p-1.5 rounded bg-[#161a22] border border-[#222630] space-y-0.5">
            <div className="text-[#8b949e]">Reachable Assets</div>
            <div className="text-sm font-bold text-white">{summary.reachableAssetCount}</div>
          </div>
          <div className="p-1.5 rounded bg-[#161a22] border border-[#222630] space-y-0.5">
            <div className="text-[#8b949e]">Sensitive Reached</div>
            <div className="text-sm font-bold text-[#f0883e]">{summary.sensitiveAssetsReached}</div>
          </div>
          <div className="p-1.5 rounded bg-[#161a22] border border-[#222630] space-y-0.5">
            <div className="text-[#8b949e]">Critical Reached</div>
            <div className="text-sm font-bold text-[#f85149]">{summary.criticalAssetsReached}</div>
          </div>
          <div className="p-1.5 rounded bg-[#161a22] border border-[#222630] space-y-0.5">
            <div className="text-[#8b949e]">Average Risk</div>
            <div className="text-sm font-bold text-white">
              {summary.averageRiskScore ?? 0}
              <span className="text-[10px] text-[#8b949e]">/100</span>
            </div>
          </div>
          <div className="p-1.5 rounded bg-[#161a22] border border-[#222630] space-y-0.5">
            <div className="text-[#8b949e]">Highest Risk</div>
            <div
              className={`text-sm font-bold uppercase ${
                summary.highestRisk === 'critical'
                  ? 'text-[#f85149]'
                  : summary.highestRisk === 'high'
                  ? 'text-[#f0883e]'
                  : summary.highestRisk === 'medium'
                  ? 'text-[#d29922]'
                  : 'text-[#3fb950]'
              }`}
            >
              {summary.highestRisk}
            </div>
          </div>
        </div>

        {/* Intelligence Highlights: Most Dangerous Path & Most Exposed Asset */}
        {(intelligence?.mostDangerousPath || intelligence?.mostExposedAsset) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
            {intelligence.mostDangerousPath && (
              <div
                onClick={() => onSelectPath(intelligence.mostDangerousPath!.id)}
                className={`p-2 rounded bg-[#1a1415] border border-[#f85149]/40 flex items-center justify-between cursor-pointer hover:border-[#f85149] transition-colors ${
                  activePath?.id === intelligence.mostDangerousPath.id ? 'ring-1 ring-[#f85149]' : ''
                }`}
                title="Click to view most dangerous attack path"
              >
                <div className="flex items-center space-x-2 truncate">
                  <Zap className="w-3.5 h-3.5 text-[#f85149] shrink-0" />
                  <span className="text-[#8b949e]">Most Dangerous:</span>
                  <span className="font-semibold text-white truncate">
                    {intelligence.mostDangerousPath.target.name}
                  </span>
                </div>
                <div className="flex items-center space-x-1 shrink-0 ml-2">
                  <span className="px-1.5 py-0.2 rounded bg-[#da3633]/20 text-[#f85149] border border-[#da3633]/40 text-[9px] font-bold uppercase">
                    Risk {intelligence.mostDangerousPath.riskScore}
                  </span>
                </div>
              </div>
            )}

            {intelligence.mostExposedAsset && (
              <div
                onClick={() => {
                  const matchingPath = attackPaths.find(
                    (p) => p.target.id === intelligence.mostExposedAsset!.asset.id
                  );
                  if (matchingPath) onSelectPath(matchingPath.id);
                }}
                className="p-2 rounded bg-[#171b26] border border-[#58a6ff]/40 flex items-center justify-between cursor-pointer hover:border-[#58a6ff] transition-colors"
                title="Click to view attack paths reaching the most exposed asset"
              >
                <div className="flex items-center space-x-2 truncate">
                  <Target className="w-3.5 h-3.5 text-[#58a6ff] shrink-0" />
                  <span className="text-[#8b949e]">Most Exposed Asset:</span>
                  <span className="font-semibold text-white truncate">
                    {intelligence.mostExposedAsset.asset.name}
                  </span>
                </div>
                <div className="flex items-center space-x-1 shrink-0 ml-2">
                  <span className="px-1.5 py-0.2 rounded bg-[#1f242e] text-[#58a6ff] border border-[#30363d] text-[9px]">
                    {intelligence.mostExposedAsset.entryPointCount} Entry Points
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#222630]/60 text-[10px]">
          {/* Risk Level Filter */}
          <div className="flex items-center space-x-1">
            <SlidersHorizontal className="w-3 h-3 text-[#8b949e]" />
            <span className="text-[#8b949e]">Risk:</span>
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRiskFilter(r)}
                className={`px-1.5 py-0.5 rounded border uppercase transition-colors ${
                  riskFilter === r
                    ? 'bg-[#21262d] text-[#e6edf3] border-[#58a6ff]'
                    : 'bg-[#161a22] text-[#8b949e] border-[#222630] hover:border-[#30363d]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Target Criticality Filter */}
          <div className="flex items-center space-x-1">
            <span className="text-[#8b949e]">Target:</span>
            {(['all', 'critical', 'high', 'sensitive'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setTargetFilter(c)}
                className={`px-1.5 py-0.5 rounded border capitalize transition-colors ${
                  targetFilter === c
                    ? 'bg-[#21262d] text-[#e6edf3] border-[#58a6ff]'
                    : 'bg-[#161a22] text-[#8b949e] border-[#222630] hover:border-[#30363d]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Entry Point Filter */}
          {entryPoints.length > 1 && (
            <div className="flex items-center space-x-1 ml-auto">
              <span className="text-[#8b949e]">Entry:</span>
              <select
                value={entryPointFilter}
                onChange={(e) => setEntryPointFilter(e.target.value)}
                className="bg-[#161a22] border border-[#222630] text-[#c9d1d9] rounded px-1.5 py-0.5 text-[10px] focus:outline-hidden focus:border-[#58a6ff]"
              >
                <option value="all">All Entry Points ({entryPoints.length})</option>
                {entryPoints.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Content Area */}
      {attackPaths.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 font-mono">
          <ShieldCheck className="w-10 h-10 text-[#3fb950]" />
          <div className="text-sm font-semibold text-white">
            Zero Attack Paths to Sensitive Assets Detected
          </div>
          <p className="text-xs text-[#8b949e] max-w-md leading-relaxed">
            No allowed traversal routes connect attacker-controlled entry points to sensitive, restricted,
            or critical infrastructure assets. All ingress flows either terminate at properly isolated tiers
            or are blocked by defensive DENY barriers.
          </p>
        </div>
      ) : filteredPaths.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2 text-[#8b949e]">
          <CheckCircle2 className="w-6 h-6 text-[#58a6ff]" />
          <div className="text-xs">No attack paths match the selected filters.</div>
          <button
            onClick={() => {
              setRiskFilter('all');
              setEntryPointFilter('all');
              setTargetFilter('all');
            }}
            className="text-[10px] text-[#58a6ff] hover:underline"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Attack Path List */}
          <div className="w-[340px] border-r border-[#222630] flex flex-col overflow-y-auto bg-[#0d0f14] divide-y divide-[#222630]">
            {filteredPaths.map((path) => {
              const isSelected = activePath?.id === path.id;
              const badge = getRiskBadge(path.risk);
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={path.id}
                  onClick={() => onSelectPath(path.id)}
                  className={`p-3 text-left transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-[#181d26] border-l-3 border-[#f85149] shadow-inner'
                      : 'hover:bg-[#12161f] border-l-3 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase flex items-center space-x-1 ${badge.bg}`}
                    >
                      <BadgeIcon className="w-3 h-3" />
                      <span>{badge.label}</span>
                      <span className="font-mono ml-0.5">· {path.riskScore}</span>
                    </span>

                    <span className="text-[10px] text-[#8b949e] font-mono">
                      {path.hopCount} hop{path.hopCount === 1 ? '' : 's'} · {path.trustBoundariesCrossed} boundar{path.trustBoundariesCrossed === 1 ? 'y' : 'ies'}
                    </span>
                  </div>

                  {/* Flow summary */}
                  <div className="flex items-center space-x-1.5 text-[11px] font-medium text-white truncate">
                    <span className="truncate text-[#58a6ff]">{path.entryPoint.name}</span>
                    <ArrowRight className="w-3 h-3 text-[#8b949e] shrink-0" />
                    <span className="truncate text-[#f85149] font-semibold">{path.target.name}</span>
                  </div>

                  {/* Target and Dominant Factor Excerpt */}
                  <div className="space-y-0.5 text-[10px]">
                    <div className="flex items-center justify-between text-[#5c6370]">
                      <span>Target: {path.target.criticality} / {path.target.zone}</span>
                      {path.target.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onLocateElement({ id: path.target.id, type: 'node' });
                          }}
                          className="text-[#8b949e] hover:text-[#58a6ff] p-0.5"
                          title="Locate target on canvas"
                        >
                          <Crosshair className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {path.riskAssessment?.dominantFactors?.[0] && (
                      <div className="text-[9px] text-[#8b949e] truncate italic">
                        • {path.riskAssessment.dominantFactors[0]}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Deep Attack Path Details & Explanation */}
          {activePath ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0d0f12]">
              {/* Path Header */}
              <div className="p-3.5 rounded bg-[#161a22] border border-[#2d333b] space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                          getRiskBadge(activePath.risk).bg
                        }`}
                      >
                        {activePath.risk.toUpperCase()} RISK · SCORE {activePath.riskScore}/100
                      </span>
                      <span className="text-white text-sm font-semibold">
                        Reachable Asset: {activePath.target.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#8b949e] mt-1">
                      Target Role: <strong className="text-[#c9d1d9]">{activePath.target.type}</strong> ·
                      Criticality: <strong className="text-[#f85149]">{activePath.target.criticality}</strong> ·
                      Zone: <strong className="text-[#d2a8ff]">{activePath.target.zone}</strong>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {onAnalyzeBlastRadius && (
                      <button
                        onClick={() => onAnalyzeBlastRadius(activePath.target.id)}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#271d17] border border-[#f0883e]/50 text-[#f0883e] hover:bg-[#38231a] hover:text-white transition-colors text-[11px]"
                        title="Analyze lateral movement from this compromised asset"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>Analyze Blast Radius</span>
                      </button>
                    )}
                    <button
                      onClick={() => onLocateElement({ id: activePath.target.id, type: 'node' })}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#21262d] text-[#c9d1d9] hover:text-white hover:bg-[#30363d] transition-colors text-[11px]"
                      title="Center canvas on target node"
                    >
                      <Crosshair className="w-3.5 h-3.5 text-[#58a6ff]" />
                      <span>Locate Target</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#222630] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                  <div>
                    <span className="text-[#8b949e] block">Entry Point</span>
                    <strong className="text-white">{activePath.entryPoint.name}</strong>
                  </div>
                  <div>
                    <span className="text-[#8b949e] block">Hop Count</span>
                    <strong className="text-white">{activePath.hopCount} Network Hops</strong>
                  </div>
                  <div>
                    <span className="text-[#8b949e] block">Boundaries Crossed</span>
                    <strong className="text-white">{activePath.trustBoundariesCrossed} Zones Crossed</strong>
                  </div>
                  <div>
                    <span className="text-[#8b949e] block">Path Identity</span>
                    <code className="text-[#58a6ff] truncate block" title={activePath.id}>
                      {activePath.id}
                    </code>
                  </div>
                </div>
              </div>

              {/* NEW: RISK ASSESSMENT & FACTOR COMPOSITION */}
              <div className="p-3.5 rounded bg-[#151922] border border-[#2d333b] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-[#f85149]" />
                    <span className="text-xs font-bold text-white tracking-wide">
                      RISK ASSESSMENT ({activePath.riskScore}/100)
                    </span>
                  </div>
                  <span className="text-[10px] text-[#8b949e]">
                    Relative Prioritization Metric · Deterministic Model
                  </span>
                </div>

                {/* Score Bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 rounded-full bg-[#21262d] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getRiskBadge(activePath.risk).bar}`}
                      style={{ width: `${activePath.riskScore}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-[#8b949e]">
                    <span>0 (Low)</span>
                    <span>25 (Medium)</span>
                    <span>50 (High)</span>
                    <span>75+ (Critical)</span>
                    <span>100</span>
                  </div>
                </div>

                {/* Dominant Risk Factors */}
                {activePath.riskAssessment?.dominantFactors && activePath.riskAssessment.dominantFactors.length > 0 && (
                  <div className="p-2.5 rounded bg-[#1c1417] border border-[#da3633]/30 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#f85149] flex items-center space-x-1">
                      <Flame className="w-3 h-3 text-[#f85149]" />
                      <span>Dominant Risk Factors</span>
                    </div>
                    <ul className="space-y-1 text-[11px] text-[#e6edf3] list-disc list-inside leading-relaxed">
                      {activePath.riskAssessment.dominantFactors.map((dominant, idx) => (
                        <li key={idx} className="text-[#f85149]">
                          <span className="text-[#e6edf3]">{dominant}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Mitigating Factors (Defenses Present) */}
                {activePath.riskAssessment?.mitigatingFactors && activePath.riskAssessment.mitigatingFactors.length > 0 && (
                  <div className="p-2.5 rounded bg-[#12231c] border border-[#238636]/40 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#3fb950] flex items-center space-x-1">
                      <Shield className="w-3 h-3 text-[#3fb950]" />
                      <span>Mitigating Defensive Controls Present</span>
                    </div>
                    <ul className="space-y-1 text-[10px] text-[#c9d1d9]">
                      {activePath.riskAssessment.mitigatingFactors.map((mit, idx) => (
                        <li key={idx} className="flex items-start space-x-1.5">
                          <span className="text-[#3fb950] font-bold">✓</span>
                          <span>
                            <strong className="text-[#3fb950]">-{mit.weight} pts:</strong> {mit.reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Hop-by-Hop Traversal Steps */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#8b949e] flex items-center space-x-1.5">
                  <Flame className="w-3.5 h-3.5 text-[#f85149]" />
                  <span>STEP-BY-STEP REACHABILITY TRAVERSAL</span>
                </div>

                <div className="space-y-2">
                  {activePath.steps.map((step) => (
                    <div
                      key={step.step}
                      className="p-2.5 rounded bg-[#13161d] border border-[#222630] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-4 h-4 rounded-full bg-[#1e2430] border border-[#388bfd]/50 flex items-center justify-center text-[9px] font-bold text-[#58a6ff]">
                            {step.step}
                          </span>
                          <span className="font-semibold text-white text-[11px]">
                            {step.sourceNodeName}
                          </span>
                          <ArrowRight className="w-3 h-3 text-[#f85149]" />
                          <span className="font-semibold text-white text-[11px]">
                            {step.targetNodeName}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1 text-[9px]">
                          <span className="px-1.5 py-0.2 rounded bg-[#16291e] text-[#3fb950] border border-[#238636]/40 uppercase font-bold">
                            {step.access}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-[#181d26] text-[#58a6ff] border border-[#30363d]">
                            {step.protocol}:{step.ports}
                          </span>
                          {step.encrypted ? (
                            <span className="px-1.5 py-0.2 rounded bg-[#14261b] text-[#3fb950] border border-[#238636]/40">
                              TLS
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded bg-[#291b15] text-[#f0883e] border border-[#f0883e]/40">
                              Cleartext
                            </span>
                          )}
                          {step.boundaryCrossed && (
                            <span className="px-1.5 py-0.2 rounded bg-[#241733] text-[#d2a8ff] border border-[#8957e5]/40 font-semibold">
                              {step.fromZone} → {step.toZone}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-[10px] text-[#8b949e]">
                        {step.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* WHY THIS PATH EXISTS */}
              <div className="p-3 rounded bg-[#14171d] border border-[#222630] space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#58a6ff] flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5 text-[#58a6ff]" />
                  <span>WHY THIS PATH EXISTS (DETERMINISTIC FACTS)</span>
                </div>
                <ul className="space-y-1 text-[11px] text-[#c9d1d9] list-decimal list-inside leading-relaxed">
                  {activePath.whyItExists.map((fact, idx) => (
                    <li key={idx} className="pl-1">
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* ALL CONTRIBUTING RISK FACTORS */}
              <div className="p-3 rounded bg-[#1a1415] border border-[#da3633]/30 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#f85149] flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#f85149]" />
                  <span>ALL CONTRIBUTING RISK FACTORS</span>
                </div>
                <ul className="space-y-1 text-[11px] text-[#e6edf3] list-disc list-inside leading-relaxed">
                  {activePath.riskFactors.map((factor, idx) => (
                    <li key={idx} className="pl-1 text-[#f85149]">
                      <span className="text-[#c9d1d9]">{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8 text-[#8b949e]">
              Select an attack path from the list to review reachability details.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
