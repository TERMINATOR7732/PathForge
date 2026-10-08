import React, { useState } from 'react';
import {
  ChangeAnalysisResult,
  EnvironmentSnapshot,
  SecuritySignificance,
} from '@pathforge/core';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  GitCompare,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  HelpCircle,
  Camera,
  RefreshCw,
  Gauge,
  Coins,
} from 'lucide-react';

interface ChangeAnalysisPanelProps {
  changeAnalysis: ChangeAnalysisResult | null;
  baselineSnapshot: EnvironmentSnapshot | null;
  onCaptureBaseline: () => void;
  onLocateElement: (target: { id: string; type: 'node' | 'edge' }) => void;
  onSelectNode: (nodeId: string) => void;
  onRequestValidate?: () => void;
}

export const ChangeAnalysisPanel: React.FC<ChangeAnalysisPanelProps> = ({
  changeAnalysis,
  baselineSnapshot,
  onCaptureBaseline,
  onLocateElement,
  onRequestValidate,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'changes' | 'risks' | 'paths' | 'intelligence'>('changes');
  const [significanceFilter, setSignificanceFilter] = useState<'all' | SecuritySignificance>('all');

  if (!baselineSnapshot) {
    return (
      <div className="p-8 text-center bg-[#0d1117] border border-[#21262d] rounded-lg">
        <GitCompare className="w-12 h-12 text-[#8b949e] mx-auto mb-3 opacity-60" />
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-1">No Baseline Snapshot Established</h3>
        <p className="text-xs text-[#8b949e] max-w-md mx-auto mb-4">
          Establish an immutable baseline of your current validated topology to track security changes, attack path mutations, and regressions.
        </p>
        <button
          onClick={onCaptureBaseline}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold transition-colors"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Capture Initial Baseline</span>
        </button>
      </div>
    );
  }

  if (!changeAnalysis) {
    return (
      <div className="p-8 text-center bg-[#0d1117] border border-[#21262d] rounded-lg">
        <RefreshCw className="w-8 h-8 text-[#58a6ff] mx-auto mb-3 animate-spin" />
        <p className="text-xs text-[#8b949e]">Analyzing continuous changes against baseline...</p>
      </div>
    );
  }

  const {
    summary,
    changes,
    newlyIntroducedRisks,
    resolvedRisks,
    unchangedRisks,
    regressionDetected,
    regressionDetails,
    attackPathDelta,
    architectureDelta,
    readinessDelta,
    technicalDebtDelta,
    recommendations,
  } = changeAnalysis;

  const filteredChanges = changes.filter((c) => {
    if (significanceFilter === 'all') return true;
    return c.classification === significanceFilter;
  });

  const getImpactBadge = () => {
    switch (summary.impactLevel) {
      case 'CRITICAL':
        return 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/40';
      case 'HIGH':
        return 'bg-[#f0883e]/20 text-[#f0883e] border-[#f0883e]/40';
      case 'MEDIUM':
        return 'bg-[#d29922]/20 text-[#d29922] border-[#d29922]/40';
      case 'LOW':
      default:
        return 'bg-[#3fb950]/20 text-[#3fb950] border-[#3fb950]/40';
    }
  };

  const getSignificanceBadge = (sig: SecuritySignificance) => {
    switch (sig) {
      case 'security-increasing':
        return {
          label: 'SECURITY INCREASING',
          badge: 'bg-[#238636]/15 text-[#3fb950] border-[#238636]/40',
          icon: TrendingUp,
        };
      case 'security-decreasing':
        return {
          label: 'SECURITY DECREASING',
          badge: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/40',
          icon: TrendingDown,
        };
      case 'security-ambiguous':
        return {
          label: 'SECURITY AMBIGUOUS',
          badge: 'bg-[#d29922]/15 text-[#d29922] border-[#d29922]/40',
          icon: HelpCircle,
        };
      case 'security-neutral':
      default:
        return {
          label: 'SECURITY NEUTRAL',
          badge: 'bg-[#30363d]/30 text-[#8b949e] border-[#30363d]',
          icon: Minus,
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Baseline Strip & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-[#161b22] border border-[#30363d]">
        <div className="flex items-center space-x-2 text-xs">
          <Camera className="w-3.5 h-3.5 text-[#58a6ff]" />
          <span className="text-[#8b949e] font-mono">
            BASELINE:{' '}
            <span className="text-[#e6edf3]">
              {baselineSnapshot.nodes.length} nodes, {baselineSnapshot.edges.length} edges
            </span>{' '}
            · {new Date(baselineSnapshot.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {onRequestValidate && (
            <button
              onClick={onRequestValidate}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#21262d] border border-[#30363d] text-xs text-[#c9d1d9] hover:bg-[#30363d] transition-colors"
              title="Re-run validation engine"
            >
              <RefreshCw className="w-3 h-3 text-[#58a6ff]" />
              <span>Revalidate</span>
            </button>
          )}
          <button
            onClick={onCaptureBaseline}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#21262d] border border-[#30363d] text-xs text-[#c9d1d9] hover:bg-[#30363d] transition-colors"
            title="Set current environment as the new baseline"
          >
            <Camera className="w-3 h-3 text-[#3fb950]" />
            <span>Update Baseline</span>
          </button>
        </div>
      </div>

      {/* 2. Impact Health Banner */}
      <div className="p-3.5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-0.5 rounded border text-xs font-mono font-bold tracking-wider ${getImpactBadge()}`}>
              IMPACT: {summary.impactLevel}
            </span>
            <span className="px-2 py-0.5 rounded bg-[#21262d] border border-[#30363d] text-[11px] font-mono uppercase text-[#c9d1d9]">
              {summary.category}
            </span>
          </div>
          <span className="text-xs font-mono text-[#8b949e]">
            {summary.totalChanges} Total Change{summary.totalChanges === 1 ? '' : 's'}
          </span>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-[#e6edf3]">{summary.headline}</h4>
          {summary.impactReasons.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs text-[#8b949e]">
              {summary.impactReasons.map((r, i) => (
                <li key={i} className="flex items-start space-x-1.5">
                  <span className="text-[#58a6ff] mt-0.5">▪</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Metric Counters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-[#21262d]">
          <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
            <div className="text-[10px] uppercase font-mono text-[#8b949e]">CHANGES</div>
            <div className="text-base font-bold font-mono text-[#e6edf3]">{summary.totalChanges}</div>
          </div>
          <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
            <div className="text-[10px] uppercase font-mono text-[#3fb950]">STRENGTHENED</div>
            <div className="text-base font-bold font-mono text-[#3fb950]">{summary.securityIncreasing}</div>
          </div>
          <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
            <div className="text-[10px] uppercase font-mono text-[#f85149]">WEAKENED</div>
            <div className="text-base font-bold font-mono text-[#f85149]">{summary.securityDecreasing}</div>
          </div>
          <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
            <div className="text-[10px] uppercase font-mono text-[#f85149]">NEW RISKS</div>
            <div className="text-base font-bold font-mono text-[#f85149]">{summary.risksIntroduced}</div>
          </div>
          <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-center">
            <div className="text-[10px] uppercase font-mono text-[#3fb950]">RESOLVED</div>
            <div className="text-base font-bold font-mono text-[#3fb950]">{summary.risksResolved}</div>
          </div>
        </div>
      </div>

      {/* 3. Regression Banner if Regression Detected */}
      {regressionDetected && (
        <div className="p-3.5 rounded-lg bg-[#da3633]/10 border border-[#da3633]/40 space-y-2">
          <div className="flex items-center space-x-2 text-[#f85149]">
            <AlertOctagon className="w-4 h-4" />
            <span className="text-xs font-mono font-bold tracking-wider uppercase">
              SECURITY REGRESSION DETECTED
            </span>
          </div>
          <p className="text-xs text-[#c9d1d9] leading-relaxed">
            {regressionDetails.explanation}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-1">
            <div className="p-2 rounded bg-[#0d1117]/80 border border-[#238636]/30">
              <span className="text-[#3fb950] font-bold block mb-1">
                ✓ RESOLVED ({regressionDetails.resolvedRisks.length}):
              </span>
              <ul className="text-[#8b949e] space-y-0.5">
                {regressionDetails.resolvedRisks.map((r) => (
                  <li key={r.id} className="truncate">
                    {r.ruleId} · {r.title}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-2 rounded bg-[#0d1117]/80 border border-[#da3633]/30">
              <span className="text-[#f85149] font-bold block mb-1">
                ⚠ INTRODUCED ({regressionDetails.newRisks.length}):
              </span>
              <ul className="text-[#8b949e] space-y-0.5">
                {regressionDetails.newRisks.map((r) => (
                  <li key={r.id} className="truncate">
                    {r.ruleId} · {r.title}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 4. Sub-Tab Navigation Strip */}
      <div className="flex items-center space-x-1 border-b border-[#21262d] pb-1 text-xs font-mono">
        <button
          onClick={() => setActiveSubTab('changes')}
          className={`px-3 py-1.5 rounded transition-colors ${
            activeSubTab === 'changes'
              ? 'bg-[#21262d] text-[#e6edf3] font-semibold border border-[#30363d]'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          CHANGES ({changes.length})
        </button>
        <button
          onClick={() => setActiveSubTab('risks')}
          className={`px-3 py-1.5 rounded transition-colors ${
            activeSubTab === 'risks'
              ? 'bg-[#21262d] text-[#e6edf3] font-semibold border border-[#30363d]'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          RISK DELTA (+{newlyIntroducedRisks.length} / -{resolvedRisks.length})
        </button>
        <button
          onClick={() => setActiveSubTab('paths')}
          className={`px-3 py-1.5 rounded transition-colors ${
            activeSubTab === 'paths'
              ? 'bg-[#21262d] text-[#e6edf3] font-semibold border border-[#30363d]'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          ATTACK PATHS (+{attackPathDelta.added.length} / -{attackPathDelta.removed.length})
        </button>
        <button
          onClick={() => setActiveSubTab('intelligence')}
          className={`px-3 py-1.5 rounded transition-colors ${
            activeSubTab === 'intelligence'
              ? 'bg-[#21262d] text-[#e6edf3] font-semibold border border-[#30363d]'
              : 'text-[#8b949e] hover:text-[#c9d1d9]'
          }`}
        >
          INTELLIGENCE DELTA
        </button>
      </div>

      {/* 5. Sub-Tab Content */}

      {/* Sub-Tab A: Changes */}
      {activeSubTab === 'changes' && (
        <div className="space-y-3">
          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <span className="text-[#8b949e] mr-1">Filter:</span>
            {(['all', 'security-decreasing', 'security-increasing', 'security-neutral'] as const).map((sig) => (
              <button
                key={sig}
                onClick={() => setSignificanceFilter(sig)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  significanceFilter === sig
                    ? 'bg-[#30363d] text-[#e6edf3] font-bold border border-[#58a6ff]'
                    : 'bg-[#161b22] text-[#8b949e] border border-[#21262d] hover:text-[#c9d1d9]'
                }`}
              >
                {sig === 'all' ? 'ALL' : sig.replace('security-', '').toUpperCase()}
              </button>
            ))}
          </div>

          {filteredChanges.length === 0 ? (
            <div className="p-6 text-center bg-[#0d1117] border border-[#21262d] rounded text-xs text-[#8b949e]">
              No infrastructure changes match the selected filter.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredChanges.map((change) => {
                const sig = getSignificanceBadge(change.classification);
                const SigIcon = sig.icon;
                return (
                  <div
                    key={change.id}
                    className="p-3 rounded bg-[#161b22] border border-[#30363d] space-y-2 transition-colors hover:border-[#58a6ff]/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 rounded bg-[#21262d] text-[#c9d1d9] text-[10px] font-mono font-bold">
                          {change.type}
                        </span>
                        <span className="text-xs font-semibold text-[#e6edf3]">{change.label}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`flex items-center space-x-1 px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${sig.badge}`}>
                          <SigIcon className="w-3 h-3" />
                          <span>{sig.label}</span>
                        </span>
                        <button
                          onClick={() => {
                            if (change.targetType === 'node') {
                              onLocateElement({ id: change.targetId, type: 'node' });
                            } else {
                              onLocateElement({ id: change.targetId, type: 'edge' });
                            }
                          }}
                          className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] hover:text-[#58a6ff] text-[10px] font-mono"
                          title="Locate on canvas"
                        >
                          <Crosshair className="w-3 h-3" />
                          <span>Locate</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#8b949e]">{change.description}</p>

                    <div className="p-2 rounded bg-[#0d1117] border border-[#21262d] text-xs font-mono space-y-1">
                      <div className="text-[11px] text-[#58a6ff]">WHY IT MATTERS:</div>
                      <div className="text-[#c9d1d9]">{change.classificationReason}</div>
                    </div>

                    {change.fieldChanges && change.fieldChanges.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {change.fieldChanges.map((fc, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-[#0d1117] border border-[#30363d] text-[10px] font-mono text-[#8b949e]"
                          >
                            <span className="text-[#58a6ff]">{fc.field}:</span> {String(fc.before ?? 'none')} →{' '}
                            <span className="text-[#e6edf3] font-bold">{String(fc.after ?? 'none')}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab B: Risk Delta */}
      {activeSubTab === 'risks' && (
        <div className="space-y-4">
          {/* Newly Introduced */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs font-mono font-bold text-[#f85149]">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>NEWLY INTRODUCED RISKS ({newlyIntroducedRisks.length})</span>
            </div>
            {newlyIntroducedRisks.length === 0 ? (
              <div className="p-3 rounded bg-[#0d1117] border border-[#21262d] text-xs text-[#3fb950]">
                ✓ Zero new security findings introduced by this change.
              </div>
            ) : (
              <div className="space-y-2">
                {newlyIntroducedRisks.map((finding) => (
                  <div
                    key={finding.id}
                    className="p-3 rounded bg-[#da3633]/10 border border-[#da3633]/30 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 rounded bg-[#da3633]/20 text-[#f85149] text-[10px] font-mono font-bold">
                          {finding.severity.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono text-[#e6edf3]">{finding.ruleId}</span>
                        <span className="text-xs font-semibold text-[#e6edf3]">{finding.title}</span>
                      </div>
                      <button
                        onClick={() => {
                          if (finding.affectedEdges.length > 0) {
                            onLocateElement({ id: finding.affectedEdges[0], type: 'edge' });
                          } else if (finding.affectedNodes.length > 0) {
                            onLocateElement({ id: finding.affectedNodes[0], type: 'node' });
                          }
                        }}
                        className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] hover:text-[#58a6ff] text-[10px] font-mono"
                      >
                        <Crosshair className="w-3 h-3" />
                        <span>Locate</span>
                      </button>
                    </div>
                    <p className="text-xs text-[#8b949e]">{finding.description}</p>
                    <p className="text-xs text-[#c9d1d9]">{finding.whyItMatters}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolved Risks */}
          <div className="space-y-2 pt-2 border-t border-[#21262d]">
            <div className="flex items-center space-x-2 text-xs font-mono font-bold text-[#3fb950]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>RESOLVED RISKS ({resolvedRisks.length})</span>
            </div>
            {resolvedRisks.length === 0 ? (
              <div className="p-3 rounded bg-[#0d1117] border border-[#21262d] text-xs text-[#8b949e]">
                No baseline security findings were eliminated by this change.
              </div>
            ) : (
              <div className="space-y-1.5">
                {resolvedRisks.map((finding) => (
                  <div
                    key={finding.id}
                    className="p-2.5 rounded bg-[#238636]/10 border border-[#238636]/30 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-[#3fb950] font-mono font-bold">{finding.ruleId}</span>
                      <span className="text-[#e6edf3]">{finding.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#3fb950] uppercase">RESOLVED</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unchanged Active Risks */}
          <div className="pt-2 border-t border-[#21262d] text-xs text-[#8b949e] font-mono">
            UNCHANGED RISKS: <span className="text-[#e6edf3]">{unchangedRisks.length} findings</span> continue to persist across both states.
          </div>
        </div>
      )}

      {/* Sub-Tab C: Attack Path Delta */}
      {activeSubTab === 'paths' && (
        <div className="space-y-3">
          <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] text-xs font-mono text-[#8b949e]">
            {attackPathDelta.summary}
          </div>

          {attackPathDelta.added.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-[#f85149]">
                NEW ATTACK PATHS ({attackPathDelta.added.length}):
              </span>
              {attackPathDelta.added.map((item, i) => (
                <div
                  key={i}
                  className="p-3 rounded bg-[#da3633]/10 border border-[#da3633]/30 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#f85149]">
                      [{item.afterRisk?.toUpperCase()} RISK · SCORE {item.afterRiskScore}]
                    </span>
                    <button
                      onClick={() => onLocateElement({ id: item.targetId, type: 'node' })}
                      className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] hover:text-[#58a6ff] text-[10px] font-mono"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Locate Target</span>
                    </button>
                  </div>
                  <div className="text-[#e6edf3] font-semibold">{item.summary}</div>
                  <div className="font-mono text-[#8b949e] text-[11px] truncate">
                    {item.signature}
                  </div>
                </div>
              ))}
            </div>
          )}

          {attackPathDelta.removed.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-[#3fb950]">
                SEVERED ATTACK PATHS ({attackPathDelta.removed.length}):
              </span>
              {attackPathDelta.removed.map((item, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded bg-[#238636]/10 border border-[#238636]/30 text-xs text-[#3fb950] font-mono flex items-center justify-between"
                >
                  <span>✓ {item.summary}</span>
                  <span className="text-[10px] text-[#8b949e]">WAS {item.beforeRisk?.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}

          {attackPathDelta.changed.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-[#d29922]">
                MODIFIED RISK PATHS ({attackPathDelta.changed.length}):
              </span>
              {attackPathDelta.changed.map((item, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded bg-[#d29922]/10 border border-[#d29922]/30 text-xs space-y-1"
                >
                  <div className="text-[#e6edf3] font-semibold">{item.summary}</div>
                  <div className="font-mono text-[#8b949e] text-[11px] truncate">{item.signature}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab D: Intelligence Delta */}
      {activeSubTab === 'intelligence' && (
        <div className="space-y-3">
          {/* Architecture Delta */}
          <div className="p-3 rounded bg-[#161b22] border border-[#30363d] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#a371f7] font-bold flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>ARCHITECTURE QUALITY</span>
              </span>
              <span className="text-[#8b949e]">
                {architectureDelta.scoreBefore} ({architectureDelta.ratingBefore}) →{' '}
                <span className="text-[#e6edf3] font-bold">
                  {architectureDelta.scoreAfter} ({architectureDelta.ratingAfter})
                </span>{' '}
                ({architectureDelta.scoreDelta >= 0 ? '+' : ''}
                {architectureDelta.scoreDelta})
              </span>
            </div>
            {architectureDelta.observations.length > 0 ? (
              <ul className="text-xs text-[#8b949e] space-y-1 pt-1 border-t border-[#21262d]">
                {architectureDelta.observations.map((obs, i) => (
                  <li key={i} className="flex items-center space-x-1.5">
                    <span className="text-[#a371f7]">▪</span>
                    <span>{obs}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[#8b949e] pt-1 border-t border-[#21262d]">
                Structural architecture remained consistent across changes.
              </p>
            )}
          </div>

          {/* Production Readiness Delta */}
          <div className="p-3 rounded bg-[#161b22] border border-[#30363d] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#3fb950] font-bold flex items-center space-x-1.5">
                <Gauge className="w-3.5 h-3.5" />
                <span>PRODUCTION READINESS</span>
              </span>
              <span className="text-[#8b949e]">
                {readinessDelta.scoreBefore} ({readinessDelta.ratingBefore}) →{' '}
                <span className="text-[#e6edf3] font-bold">
                  {readinessDelta.scoreAfter} ({readinessDelta.ratingAfter})
                </span>{' '}
                ({readinessDelta.scoreDelta >= 0 ? '+' : ''}
                {readinessDelta.scoreDelta})
              </span>
            </div>
            <div className="text-xs text-[#8b949e] pt-1 border-t border-[#21262d] space-y-1">
              <div>
                Status Transition: <span className="font-mono text-[#c9d1d9]">{readinessDelta.statusBefore}</span>{' '}
                <ArrowRight className="w-3 h-3 inline mx-1" />{' '}
                <span className="font-mono text-[#e6edf3] font-bold">{readinessDelta.statusAfter}</span>
              </div>
              {readinessDelta.newBlockers.length > 0 && (
                <div className="text-[#f85149]">
                  ⚠ {readinessDelta.newBlockers.length} new blocker(s):{' '}
                  {readinessDelta.newBlockers.map((b) => b.title).join(', ')}
                </div>
              )}
              {readinessDelta.resolvedBlockers.length > 0 && (
                <div className="text-[#3fb950]">
                  ✓ {readinessDelta.resolvedBlockers.length} blocker(s) eliminated
                </div>
              )}
            </div>
          </div>

          {/* Technical Debt Delta */}
          <div className="p-3 rounded bg-[#161b22] border border-[#30363d] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#e3b341] font-bold flex items-center space-x-1.5">
                <Coins className="w-3.5 h-3.5" />
                <span>TECHNICAL DEBT</span>
              </span>
              <span className="text-[#8b949e]">
                Health {technicalDebtDelta.scoreBefore} ({technicalDebtDelta.ratingBefore}) →{' '}
                <span className="text-[#e6edf3] font-bold">
                  {technicalDebtDelta.scoreAfter} ({technicalDebtDelta.ratingAfter})
                </span>{' '}
                ({technicalDebtDelta.scoreDelta >= 0 ? '+' : ''}
                {technicalDebtDelta.scoreDelta})
              </span>
            </div>
            <div className="text-xs text-[#8b949e] pt-1 border-t border-[#21262d] space-y-1 font-mono">
              <div>
                P0 Critical Debt: {technicalDebtDelta.p0Before} →{' '}
                <span className={technicalDebtDelta.p0Delta > 0 ? 'text-[#f85149] font-bold' : 'text-[#3fb950]'}>
                  {technicalDebtDelta.p0After} ({technicalDebtDelta.p0Delta >= 0 ? '+' : ''}
                  {technicalDebtDelta.p0Delta})
                </span>
              </div>
              <div>
                P1 High Debt: {technicalDebtDelta.p1Before} →{' '}
                <span className={technicalDebtDelta.p1Delta > 0 ? 'text-[#f85149] font-bold' : 'text-[#3fb950]'}>
                  {technicalDebtDelta.p1After} ({technicalDebtDelta.p1Delta >= 0 ? '+' : ''}
                  {technicalDebtDelta.p1Delta})
                </span>
              </div>
              {technicalDebtDelta.newDebt.length > 0 && (
                <div className="text-[#f85149] font-sans">
                  ⚠ {technicalDebtDelta.newDebt.length} new debt pattern(s) introduced
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Recommendations Strip */}
      {recommendations.length > 0 && (
        <div className="p-3 rounded-lg bg-[#0d1117] border border-[#21262d] space-y-1.5">
          <div className="text-xs font-mono font-bold text-[#58a6ff]">RECOMMENDED ACTIONS:</div>
          <ul className="text-xs text-[#8b949e] space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start space-x-1.5">
                <span className="text-[#58a6ff] mt-0.5">▸</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
