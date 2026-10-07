import React, { useMemo } from 'react';
import {
  BlastRadiusAnalysisResult,
  BlastRadiusImpact,
  Environment,
} from '@pathforge/core';
import {
  Radio,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  Crosshair,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface BlastRadiusPanelProps {
  environment: Environment;
  analysisResult: BlastRadiusAnalysisResult | null;
  selectedCompromisedNodeId: string | null;
  onSelectCompromisedNode: (nodeId: string) => void;
  onLocateElement: (target: { id: string; type: 'node' | 'edge' }) => void;
  onClearAnalysis?: () => void;
}

const getImpactBadge = (impact: BlastRadiusImpact) => {
  switch (impact) {
    case 'critical':
      return {
        bg: 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/50',
        badgeBg: 'bg-[#f85149]',
        icon: AlertOctagon,
        label: 'CRITICAL IMPACT',
        desc: 'Compromise enables lateral access to critical crown jewels or restricted data tiers.',
      };
    case 'high':
      return {
        bg: 'bg-[#f0883e]/20 text-[#f0883e] border-[#f0883e]/50',
        badgeBg: 'bg-[#f0883e]',
        icon: AlertTriangle,
        label: 'HIGH IMPACT',
        desc: 'Compromise enables lateral movement across trust boundaries or sensitive assets.',
      };
    case 'medium':
      return {
        bg: 'bg-[#d29922]/20 text-[#d29922] border-[#d29922]/50',
        badgeBg: 'bg-[#d29922]',
        icon: AlertTriangle,
        label: 'MEDIUM IMPACT',
        desc: 'Compromise enables limited lateral movement confined to internal systems.',
      };
    default:
      return {
        bg: 'bg-[#58a6ff]/20 text-[#58a6ff] border-[#58a6ff]/50',
        badgeBg: 'bg-[#58a6ff]',
        icon: Info,
        label: 'LOW / CONTAINED',
        desc: 'Compromised asset is isolated; no sensitive lateral paths available.',
      };
  }
};

export const BlastRadiusPanel: React.FC<BlastRadiusPanelProps> = ({
  environment,
  analysisResult,
  selectedCompromisedNodeId,
  onSelectCompromisedNode,
  onLocateElement,
  onClearAnalysis,
}) => {
  const allNodes = useMemo(() => {
    return environment
      .getNodes()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [environment]);

  const blastRadius = analysisResult?.blastRadius ?? null;
  const summary = analysisResult?.summary ?? null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0f12] text-xs font-mono select-none">
      {/* 1. Header Toolbar with Node Picker */}
      <div className="p-3 border-b border-[#222630] bg-[#12151b] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-[#f0883e] animate-pulse" />
            <span className="font-bold text-white tracking-wide text-xs">
              BLAST RADIUS & LATERAL MOVEMENT
            </span>
            {summary && (
              <span className="px-1.5 py-0.5 rounded bg-[#1f242e] text-[#58a6ff] border border-[#30363d] text-[10px]">
                {summary.totalReachableAssets} Lateral Asset{summary.totalReachableAssets === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {onClearAnalysis && (
              <button
                onClick={onClearAnalysis}
                className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-[#c9d1d9] text-[10px] transition-colors border border-[#30363d]"
                title="Reset blast radius inspection"
              >
                Clear Selection
              </button>
            )}
          </div>
        </div>

        {/* Compromised Node Selection Row */}
        <div className="flex items-center space-x-2 pt-0.5">
          <span className="text-[11px] text-[#8b949e] font-semibold whitespace-nowrap">
            Compromised Origin:
          </span>
          <select
            value={selectedCompromisedNodeId ?? ''}
            onChange={(e) => onSelectCompromisedNode(e.target.value)}
            className="flex-1 max-w-sm px-2 py-1 rounded bg-[#161b22] border border-[#30363d] text-[#e6edf3] text-xs focus:border-[#58a6ff] focus:outline-none"
          >
            <option value="" disabled>
              Select an asset to compromise...
            </option>
            {allNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} [{n.type}] — Zone: {n.zone} ({n.criticality})
              </option>
            ))}
          </select>

          {selectedCompromisedNodeId && (
            <button
              onClick={() => onLocateElement({ id: selectedCompromisedNodeId, type: 'node' })}
              className="px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] text-[10px] flex items-center space-x-1 border border-[#30363d] transition-colors"
              title="Center canvas on compromised asset"
            >
              <Crosshair className="w-3 h-3" />
              <span>Locate</span>
            </button>
          )}
        </div>

        {/* Aggregate Summary Metric Cards */}
        {blastRadius && summary && (
          <div className="grid grid-cols-5 gap-2 pt-1">
            <div className="p-2 rounded bg-[#161b24] border border-[#222630]">
              <div className="text-[10px] text-[#8b949e]">Reachable Assets</div>
              <div className="text-sm font-bold text-white font-mono mt-0.5">
                {summary.totalReachableAssets}
              </div>
            </div>

            <div className="p-2 rounded bg-[#161b24] border border-[#222630]">
              <div className="text-[10px] text-[#8b949e]">Sensitive Assets</div>
              <div className="text-sm font-bold text-[#f0883e] font-mono mt-0.5">
                {summary.totalSensitiveAssetsReached}
              </div>
            </div>

            <div className="p-2 rounded bg-[#161b24] border border-[#222630]">
              <div className="text-[10px] text-[#8b949e]">Critical Assets</div>
              <div className="text-sm font-bold text-[#f85149] font-mono mt-0.5">
                {summary.totalCriticalAssetsReached}
              </div>
            </div>

            <div className="p-2 rounded bg-[#161b24] border border-[#222630]">
              <div className="text-[10px] text-[#8b949e]">Max Lateral Depth</div>
              <div className="text-sm font-bold text-[#d2a8ff] font-mono mt-0.5">
                {summary.maxLateralMovementDepth} Hop{summary.maxLateralMovementDepth === 1 ? '' : 's'}
              </div>
            </div>

            <div className="p-2 rounded bg-[#161b24] border border-[#222630]">
              <div className="text-[10px] text-[#8b949e]">Trust Boundaries</div>
              <div className="text-sm font-bold text-[#58a6ff] font-mono mt-0.5">
                {summary.maxTrustBoundariesCrossed} Crossed
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Main Content Split Body */}
      {!selectedCompromisedNodeId || !blastRadius ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 font-mono">
          <div className="w-12 h-12 rounded-full bg-[#1c1815] border border-[#f0883e]/40 flex items-center justify-center">
            <Radio className="w-6 h-6 text-[#f0883e]" />
          </div>
          <div className="text-sm font-semibold text-[#e6edf3]">
            No Asset Selected for Blast Radius Analysis
          </div>
          <p className="text-xs text-[#8b949e] max-w-md leading-relaxed">
            Choose an infrastructure component above or click "Analyze Blast Radius" from an attack path or inspector to calculate lateral movement potential.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Reachable Assets List & Lateral Steps */}
          <div className="w-[420px] border-r border-[#222630] flex flex-col bg-[#0e1015] overflow-y-auto">
            {/* Impact Rating Banner */}
            {(() => {
              const impactBadge = getImpactBadge(blastRadius.highestImpact);
              const ImpactIcon = impactBadge.icon;
              return (
                <div className={`p-3 border-b ${impactBadge.bg} flex items-start space-x-2.5`}>
                  <ImpactIcon className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold font-mono tracking-wider">
                      {impactBadge.label}
                    </div>
                    <div className="text-[10px] opacity-90 leading-normal">
                      {impactBadge.desc}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Reachable Assets Inventory */}
            <div className="p-3 border-b border-[#222630] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#c9d1d9]">
                <span>REACHABLE ASSETS ({blastRadius.reachableNodes.length})</span>
                <span className="text-[10px] text-[#8b949e]">Sorted by hop distance</span>
              </div>

              {blastRadius.reachableNodes.length === 0 ? (
                <div className="p-3 rounded bg-[#13161c] border border-[#222630] text-center text-[#8b949e] text-xs">
                  <CheckCircle2 className="w-4 h-4 text-[#3fb950] mx-auto mb-1" />
                  Topologically isolated. Zero lateral movement paths.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {blastRadius.reachableNodes.map((target) => (
                    <div
                      key={target.id}
                      className={`p-2 rounded border transition-colors flex items-center justify-between ${
                        target.isCritical
                          ? 'bg-[#211417] border-[#da3633]/50 text-[#f85149]'
                          : target.isSensitive
                          ? 'bg-[#201815] border-[#f0883e]/40 text-[#f0883e]'
                          : 'bg-[#14171d] border-[#262c37] text-[#c9d1d9]'
                      }`}
                    >
                      <div className="space-y-0.5 truncate max-w-[280px]">
                        <div className="font-semibold text-xs truncate flex items-center space-x-1.5">
                          <span className="truncate">{target.name}</span>
                          {target.isCritical && (
                            <span className="px-1 py-0.2 rounded bg-[#da3633]/20 border border-[#da3633]/40 text-[9px] font-bold">
                              CRITICAL
                            </span>
                          )}
                          {target.isSensitive && !target.isCritical && (
                            <span className="px-1 py-0.2 rounded bg-[#f0883e]/20 border border-[#f0883e]/40 text-[9px]">
                              SENSITIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#8b949e] font-mono">
                          Zone: {target.zone} · Type: {target.type} · +{target.depth} hop{target.depth > 1 ? 's' : ''}
                        </div>
                      </div>

                      <button
                        onClick={() => onLocateElement({ id: target.id, type: 'node' })}
                        className="p-1.5 rounded hover:bg-[#222630] text-[#8b949e] hover:text-[#58a6ff] transition-colors shrink-0"
                        title="Locate asset on canvas"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lateral Movement Steps */}
            <div className="p-3 space-y-2 flex-1">
              <div className="text-[11px] font-bold text-[#c9d1d9]">
                LATERAL MOVEMENT FLOW ({blastRadius.lateralMovementSteps.length} Steps)
              </div>

              {blastRadius.lateralMovementSteps.length === 0 ? (
                <div className="text-[#8b949e] text-xs">
                  No outgoing ALLOW edges originate from this node.
                </div>
              ) : (
                <div className="space-y-2">
                  {blastRadius.lateralMovementSteps.map((step) => (
                    <div
                      key={step.edgeId}
                      className="p-2 rounded bg-[#13161d] border border-[#222630] space-y-1.5 text-[11px]"
                    >
                      <div className="flex items-center space-x-1.5 text-[#58a6ff]">
                        <span className="w-4 h-4 rounded-full bg-[#1f242e] flex items-center justify-center text-[10px] font-bold text-[#8b949e]">
                          {step.stepIndex}
                        </span>
                        <span className="font-semibold text-white truncate max-w-[130px]">
                          {step.sourceNodeName}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[#8b949e] shrink-0" />
                        <span className="font-semibold text-white truncate max-w-[130px]">
                          {step.targetNodeName}
                        </span>
                      </div>

                      <div className="text-[10px] text-[#8b949e] flex items-center space-x-2">
                        <span className="px-1 py-0.2 rounded bg-[#1a1f29] text-[#58a6ff] border border-[#30363d]">
                          {step.protocol}/{step.ports || 'ANY'}
                        </span>
                        {step.crossesTrustBoundary ? (
                          <span className="px-1 py-0.2 rounded bg-[#381619] text-[#f85149] border border-[#da3633]/40">
                            Boundary: {step.sourceZone} → {step.targetZone}
                          </span>
                        ) : (
                          <span className="text-[#8b949e]">
                            Intra-zone: {step.sourceZone}
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-[#8b949e] leading-relaxed pt-0.5">
                        {step.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Deterministic Explanations & Risk Factors */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#0d0f12]">
            {/* 1. Why This Blast Radius Exists */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#e6edf3] uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-[#f0883e]" />
                <span>Why This Blast Radius Exists</span>
              </div>

              <div className="p-3 rounded bg-[#14171e] border border-[#222630] space-y-2">
                {blastRadius.explanationFacts.map((fact, idx) => (
                  <div key={idx} className="flex items-start space-x-2 text-xs text-[#c9d1d9] leading-relaxed">
                    <span className="text-[#58a6ff] font-bold shrink-0">{idx + 1}.</span>
                    <span>{fact}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Key Risk Factors */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#e6edf3] uppercase tracking-wider flex items-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#f85149]" />
                <span>Exploitation & Risk Consequences</span>
              </div>

              <div className="p-3 rounded bg-[#14171e] border border-[#222630] space-y-2">
                {blastRadius.riskFactors.map((rf, idx) => (
                  <div key={idx} className="flex items-start space-x-2 text-xs text-[#c9d1d9] leading-relaxed">
                    <span className="text-[#f85149] shrink-0 font-bold">▸</span>
                    <span>{rf}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Defense Guidance & Boundary Breakdown */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#e6edf3] uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#3fb950]" />
                <span>Containment Recommendations</span>
              </div>

              <div className="p-3 rounded bg-[#131b17] border border-[#238636]/30 text-xs text-[#8b949e] space-y-2 leading-relaxed">
                <p>
                  To reduce lateral movement from <strong className="text-white">"{blastRadius.compromisedNode.name}"</strong>:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[#c9d1d9]">
                  <li>
                    Introduce explicit <code className="text-[#f85149]">[DENY]</code> barriers or internal firewalls isolating this component.
                  </li>
                  <li>
                    Restrict wildcard ports and limit allowed traffic to authenticated service-specific ports only.
                  </li>
                  <li>
                    Enforce network tier segmentation so compromised perimeter hosts cannot directly address restricted-tier databases.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
