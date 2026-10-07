import React, { useState, useMemo, useEffect } from 'react';
import { Finding, RuleCategory, Severity, ValidationResult } from '@pathforge/shared';
import {
  Environment,
  FixVerificationResult,
  AttackPathAnalysisResult,
  BlastRadiusAnalysisResult,
  ArchitectureAnalysisResult,
  ProductionReadinessAssessment,
  TestingIntelligenceResult,
  TechnicalDebtAssessment,
} from '@pathforge/core';
import { getRemediationActions, RemediationAction } from '@pathforge/validator';
import {
  ChevronUp,
  ChevronDown,
  AlertOctagon,
  AlertTriangle,
  Info,
  ShieldCheck,
  CheckCircle2,
  Wrench,
  HelpCircle,
  Crosshair,
  RotateCcw,
  Sparkles,
  Layers,
  History,
  Flame,
  Radio,
  Gauge,
  FlaskConical,
  Coins,
} from 'lucide-react';
import { RecommendedArchitectureView } from './RecommendedArchitectureView.js';
import { RemediationModal } from './RemediationModal.js';
import { VerificationPanel } from './VerificationPanel.js';
import { AttackPathsPanel } from './AttackPathsPanel.js';
import { BlastRadiusPanel } from './BlastRadiusPanel.js';
import { ArchitecturePanel } from './ArchitecturePanel.js';
import { ProductionReadinessPanel } from './ProductionReadinessPanel.js';
import { TestingIntelligencePanel } from './TestingIntelligencePanel.js';
import { TechnicalDebtPanel } from './TechnicalDebtPanel.js';

interface FindingsDrawerProps {
  findings: Finding[];
  environment: Environment;
  isValidationStale: boolean;
  resolvedFindings?: Finding[];
  latestVerification?: FixVerificationResult | null;
  validationResult?: ValidationResult | null;
  attackPathAnalysis?: AttackPathAnalysisResult | null;
  selectedAttackPathId?: string | null;
  onSelectAttackPath?: (pathId: string | null) => void;
  blastRadiusResult?: BlastRadiusAnalysisResult | null;
  selectedCompromisedNodeId?: string | null;
  onSelectCompromisedNode?: (nodeId: string) => void;
  onClearBlastRadius?: () => void;
  architectureResult?: ArchitectureAnalysisResult | null;
  productionReadiness?: ProductionReadinessAssessment | null;
  testingIntelligence?: TestingIntelligenceResult | null;
  technicalDebt?: TechnicalDebtAssessment | null;
  onSelectNode: (nodeId: string) => void;
  onLocateElement: (target: { id: string; type: 'node' | 'edge' }) => void;
  onHoverFinding: (finding: Finding | null) => void;
  onApplyRemediation: (action: RemediationAction, finding: Finding) => void;
  onClearResolved?: () => void;
  onRequestValidate?: () => void;
}

const getSeverityBadge = (sev: Severity) => {
  switch (sev) {
    case 'critical':
      return {
        bg: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/30',
        icon: AlertOctagon,
      };
    case 'high':
      return {
        bg: 'bg-[#f0883e]/15 text-[#f0883e] border-[#f0883e]/30',
        icon: AlertTriangle,
      };
    case 'medium':
      return {
        bg: 'bg-[#d29922]/15 text-[#d29922] border-[#d29922]/30',
        icon: AlertTriangle,
      };
    default:
      return {
        bg: 'bg-[#58a6ff]/15 text-[#58a6ff] border-[#58a6ff]/30',
        icon: Info,
      };
  }
};

export const FindingsDrawer: React.FC<FindingsDrawerProps> = ({
  findings,
  environment,
  isValidationStale,
  resolvedFindings = [],
  latestVerification,
  validationResult,
  attackPathAnalysis,
  selectedAttackPathId,
  onSelectAttackPath,
  blastRadiusResult,
  selectedCompromisedNodeId,
  onSelectCompromisedNode,
  onClearBlastRadius,
  architectureResult,
  productionReadiness,
  testingIntelligence,
  technicalDebt,
  onSelectNode,
  onLocateElement,
  onHoverFinding,
  onApplyRemediation,
  onClearResolved,
  onRequestValidate,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'findings' | 'attack-paths' | 'blast-radius' | 'verification' | 'architecture' | 'readiness' | 'testing' | 'debt'>('findings');
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(
    findings[0]?.id ?? null
  );

  // Auto-switch to verification tab if new verification with changes arrives
  useEffect(() => {
    if (
      latestVerification &&
      (latestVerification.resolvedFindings.length > 0 ||
        latestVerification.newFindings.length > 0)
    ) {
      setActiveTab('verification');
    }
  }, [latestVerification]);

  // Auto-switch to blast radius tab if compromised asset is selected
  useEffect(() => {
    if (selectedCompromisedNodeId) {
      setActiveTab('blast-radius');
      setIsOpen(true);
    }
  }, [selectedCompromisedNodeId]);

  // Filter States
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | RuleCategory>('all');
  const [assetFilter, setAssetFilter] = useState<'all' | string>('all');

  // Remediation confirmation state
  const [pendingRemediation, setPendingRemediation] = useState<{
    action: RemediationAction;
    finding: Finding;
  } | null>(null);

  // Extract unique assets involved in current findings
  const uniqueAffectedAssets = useMemo(() => {
    const assets = new Set<string>();
    findings.forEach((f) => {
      f.affectedNodes.forEach((nId) => assets.add(nId));
    });
    return Array.from(assets).sort();
  }, [findings]);

  // Compute counts per severity
  const severityCounts = useMemo(() => {
    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    findings.forEach((f) => {
      if (counts[f.severity] !== undefined) {
        counts[f.severity]++;
      }
    });
    return counts;
  }, [findings]);

  // Apply filters
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      if (assetFilter !== 'all' && !f.affectedNodes.includes(assetFilter)) return false;
      return true;
    });
  }, [findings, severityFilter, categoryFilter, assetFilter]);

  const hasActiveFilters =
    severityFilter !== 'all' || categoryFilter !== 'all' || assetFilter !== 'all';

  const resetFilters = () => {
    setSeverityFilter('all');
    setCategoryFilter('all');
    setAssetFilter('all');
  };

  // Determine current active finding
  const currentFinding = useMemo(() => {
    if (!filteredFindings.length) return null;
    return filteredFindings.find((f) => f.id === expandedFindingId) ?? filteredFindings[0];
  }, [filteredFindings, expandedFindingId]);

  // Get available remediation actions for current finding
  const remediationActions = useMemo(() => {
    if (!currentFinding) return [];
    return getRemediationActions(currentFinding, environment);
  }, [currentFinding, environment]);

  const primaryAction = remediationActions.find((a) => a.isAutomated);

  const handleLocateFinding = (finding: Finding) => {
    if (finding.affectedEdges.length > 0) {
      onLocateElement({ id: finding.affectedEdges[0], type: 'edge' });
    } else if (finding.affectedNodes.length > 0) {
      onLocateElement({ id: finding.affectedNodes[0], type: 'node' });
    }
  };

  return (
    <>
      <div
        className={`border-t border-[#222630] bg-[#111318] transition-all duration-200 select-none flex flex-col ${
          isOpen ? 'h-96' : 'h-9'
        }`}
      >
        {/* Drawer Header Bar */}
        <div className="h-9 px-4 flex items-center justify-between border-b border-[#222630] bg-[#0e1015]">
          <div className="flex items-center space-x-2 text-xs font-mono">
            {/* Tab 1: Findings */}
            <button
              onClick={() => {
                setActiveTab('findings');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded text-xs font-mono transition-colors ${
                activeTab === 'findings'
                  ? 'bg-[#181d26] text-[#e6edf3] font-semibold border border-[#388bfd]'
                  : 'text-[#8b949e] hover:text-[#c9d1d9] border border-transparent'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#58a6ff]" />
              <span>ACTIVE FINDINGS ({findings.length})</span>
            </button>

            {/* Tab 2: Attack Paths */}
            <button
              onClick={() => {
                setActiveTab('attack-paths');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded text-xs font-mono transition-colors ${
                activeTab === 'attack-paths'
                  ? 'bg-[#181d26] text-[#e6edf3] font-semibold border border-[#f85149]'
                  : 'text-[#8b949e] hover:text-[#c9d1d9] border border-transparent'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-[#f85149]" />
              <span>
                ATTACK PATHS ({attackPathAnalysis?.attackPaths.length ?? 0})
              </span>
            </button>

            {/* Tab 3: Blast Radius */}
            <button
              onClick={() => {
                setActiveTab('blast-radius');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded text-xs font-mono transition-colors ${
                activeTab === 'blast-radius'
                  ? 'bg-[#181d26] text-[#e6edf3] font-semibold border border-[#f0883e]'
                  : 'text-[#8b949e] hover:text-[#c9d1d9] border border-transparent'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-[#f0883e]" />
              <span>
                BLAST RADIUS ({blastRadiusResult?.summary.totalReachableAssets ?? 0})
              </span>
            </button>

            {/* Tab 4: Fix Verification */}
            <button
              onClick={() => {
                setActiveTab('verification');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded text-xs font-mono transition-colors ${
                activeTab === 'verification'
                  ? 'bg-[#181d26] text-[#e6edf3] font-semibold border border-[#238636]'
                  : 'text-[#8b949e] hover:text-[#c9d1d9] border border-transparent'
              }`}
            >
              <History className="w-3.5 h-3.5 text-[#3fb950]" />
              <span>
                FIX VERIFICATION
                {latestVerification?.resolvedFindings && latestVerification.resolvedFindings.length > 0
                  ? ` (${latestVerification.resolvedFindings.length} Resolved)`
                  : ''}
              </span>
            </button>

            {/* Tab 5: Architecture Analysis */}
            <button
              onClick={() => {
                setActiveTab('architecture');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded text-xs font-mono transition-colors ${
                activeTab === 'architecture'
                  ? 'bg-[#181d26] text-[#e6edf3] font-semibold border border-[#a371f7]'
                  : 'text-[#8b949e] hover:text-[#c9d1d9] border border-transparent'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#a371f7]" />
              <span>
                ARCHITECTURE ({architectureResult?.findings.length ?? 0})
              </span>
            </button>

            {/* Tab 6: Production Readiness */}
            <button
              onClick={() => {
                setActiveTab('readiness');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded text-xs font-mono transition-colors ${
                activeTab === 'readiness'
                  ? 'bg-[#181d26] text-[#e6edf3] font-semibold border border-[#3fb950]'
                  : 'text-[#8b949e] hover:text-[#c9d1d9] border border-transparent'
              }`}
            >
              <Gauge className="w-3.5 h-3.5 text-[#3fb950]" />
              <span>
                READINESS ({productionReadiness ? `${productionReadiness.score}/100` : '—'})
              </span>
            </button>

            {/* Tab 7: Testing Intelligence */}
            <button
              onClick={() => {
                setActiveTab('testing');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded text-xs font-mono transition-colors ${
                activeTab === 'testing'
                  ? 'bg-[#181d26] text-[#e6edf3] font-semibold border border-[#58a6ff]'
                  : 'text-[#8b949e] hover:text-[#c9d1d9] border border-transparent'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5 text-[#58a6ff]" />
              <span>
                TESTING ({testingIntelligence ? `${testingIntelligence.score}/100` : '—'})
              </span>
            </button>

            {/* Tab 8: Technical Debt & Engineering Risk */}
            <button
              onClick={() => {
                setActiveTab('debt');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded text-xs font-mono transition-colors ${
                activeTab === 'debt'
                  ? 'bg-[#181d26] text-[#e6edf3] font-semibold border border-[#e3b341]'
                  : 'text-[#8b949e] hover:text-[#c9d1d9] border border-transparent'
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-[#e3b341]" />
              <span>
                DEBT ({technicalDebt ? `${technicalDebt.summary.activeCount} active` : '—'})
              </span>
            </button>

            {/* Stale Validation Warning */}
            {isValidationStale && (
              <span className="px-2 py-0.5 rounded bg-[#2b1f14] text-[#f0883e] border border-[#f0883e]/50 text-[10px] font-semibold animate-pulse ml-1">
                VALIDATION STALE · TOPOLOGY MODIFIED
              </span>
            )}

            {/* Verification Status Pill */}
            {latestVerification && (
              <button
                onClick={() => {
                  setActiveTab('verification');
                  setIsOpen(true);
                }}
                className={`ml-1 flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                  latestVerification.status === 'verified'
                    ? 'bg-[#14261b] text-[#3fb950] border-[#238636]/60 hover:bg-[#1a3824]'
                    : latestVerification.status === 'requires-attention'
                    ? 'bg-[#291b15] text-[#f0883e] border-[#f0883e]/60 hover:bg-[#38231a]'
                    : 'bg-[#161a22] text-[#8b949e] border-[#2d333b]'
                }`}
                title="View verification and before/after comparison"
              >
                <span>
                  {latestVerification.status === 'verified'
                    ? `✓ VERIFICATION PASSED (${latestVerification.resolvedFindings.length} RESOLVED)`
                    : latestVerification.status === 'requires-attention'
                    ? `⚠ VERIFICATION REQUIRES ATTENTION (${latestVerification.newFindings.length} NEW)`
                    : 'VERIFICATION UNCHANGED'}
                </span>
              </button>
            )}

            {/* Resolved Notification Badge (legacy Phase 1.5 feedback) */}
            {!latestVerification && resolvedFindings.length > 0 && (
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-[#14261b] text-[#3fb950] border border-[#238636]/60 text-[10px]">
                <Sparkles className="w-3 h-3 text-[#3fb950]" />
                <span className="font-semibold">
                  {resolvedFindings.length} Finding{resolvedFindings.length === 1 ? '' : 's'} Resolved!
                </span>
                {onClearResolved && (
                  <button
                    onClick={onClearResolved}
                    className="text-[#8b949e] hover:text-[#c9d1d9] ml-1"
                    title="Dismiss notification"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>

          <div
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-2 text-[#8b949e] text-xs font-mono cursor-pointer hover:text-[#c9d1d9]"
          >
            <span>{isOpen ? 'Collapse' : 'Expand'}</span>
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </div>
        </div>

        {/* Drawer Content */}
        {isOpen && (
          <div className="flex-1 flex overflow-hidden">
            {activeTab === 'verification' ? (
              <VerificationPanel
                verification={latestVerification ?? null}
                environment={environment}
                validationResult={validationResult}
                onLocateElement={onLocateElement}
                onSelectNode={onSelectNode}
                onRequestValidate={onRequestValidate ?? (() => {})}
              />
            ) : activeTab === 'attack-paths' ? (
              <AttackPathsPanel
                analysisResult={
                  attackPathAnalysis ?? {
                    environmentId: environment.id,
                    analyzedAt: new Date().toISOString(),
                    entryPoints: [],
                    attackPaths: [],
                    reachableAssets: [],
                    summary: {
                      entryPointCount: 0,
                      reachableAssetCount: 0,
                      sensitiveAssetsReached: 0,
                      criticalAssetsReached: 0,
                      attackPathCount: 0,
                      highestRisk: 'none',
                    },
                    intelligence: {
                      totalAttackPaths: 0,
                      criticalAttackPaths: 0,
                      highRiskAttackPaths: 0,
                      mediumRiskAttackPaths: 0,
                      lowRiskAttackPaths: 0,
                      reachableCriticalAssets: 0,
                      entryPointExposures: [],
                      exposedAssets: [],
                      mostDangerousPath: null,
                      mostExposedAsset: null,
                    },
                  }
                }
                selectedPathId={selectedAttackPathId ?? null}
                onSelectPath={onSelectAttackPath ?? (() => {})}
                onLocateElement={onLocateElement}
                onAnalyze={onRequestValidate}
                onAnalyzeBlastRadius={(nodeId) => {
                  onSelectCompromisedNode?.(nodeId);
                  setActiveTab('blast-radius');
                  setIsOpen(true);
                }}
                isStale={isValidationStale}
              />
            ) : activeTab === 'blast-radius' ? (
              <BlastRadiusPanel
                environment={environment}
                analysisResult={blastRadiusResult ?? null}
                selectedCompromisedNodeId={selectedCompromisedNodeId ?? null}
                onSelectCompromisedNode={onSelectCompromisedNode ?? (() => {})}
                onLocateElement={onLocateElement}
                onClearAnalysis={onClearBlastRadius}
              />
            ) : activeTab === 'architecture' && architectureResult ? (
              <ArchitecturePanel
                analysisResult={architectureResult}
                onLocateElement={onLocateElement}
                onSelectTab={setActiveTab}
              />
            ) : activeTab === 'readiness' && productionReadiness ? (
              <ProductionReadinessPanel
                assessment={productionReadiness}
                onLocateElement={onLocateElement}
                onSelectTab={setActiveTab}
              />
            ) : activeTab === 'testing' && testingIntelligence ? (
              <TestingIntelligencePanel
                intelligence={testingIntelligence}
                onLocateElement={onLocateElement}
                onSelectTab={setActiveTab}
              />
            ) : activeTab === 'debt' && technicalDebt ? (
              <TechnicalDebtPanel
                assessment={technicalDebt}
                onLocateElement={onLocateElement}
                onSelectTab={setActiveTab}
              />
            ) : findings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center font-mono space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#3fb950]" />
                <div className="text-sm font-semibold text-[#e6edf3]">
                  Zero Security Violations Detected
                </div>
                <div className="text-xs text-[#8b949e] max-w-md">
                  All active network paths conform to verified security boundaries, least-privilege
                  access, and defense-in-depth isolation policies.
                </div>
              </div>
            ) : (
              <>
                {/* Left Side: Filter Toolbar & Finding List */}
                <div className="w-[380px] border-r border-[#222630] flex flex-col bg-[#0d0f13]">
                  {/* Filters Bar */}
                  <div className="p-2 border-b border-[#222630] space-y-1.5 bg-[#12151b] text-[10px] font-mono">
                    {/* Severity Pills */}
                    <div className="flex items-center space-x-1 overflow-x-auto pb-0.5">
                      <button
                        onClick={() => setSeverityFilter('all')}
                        className={`px-1.5 py-0.5 rounded border transition-colors ${
                          severityFilter === 'all'
                            ? 'bg-[#21262d] text-[#e6edf3] border-[#58a6ff]'
                            : 'bg-[#161a22] text-[#8b949e] border-[#222630] hover:border-[#30363d]'
                        }`}
                      >
                        All ({findings.length})
                      </button>

                      {severityCounts.critical > 0 && (
                        <button
                          onClick={() => setSeverityFilter('critical')}
                          className={`px-1.5 py-0.5 rounded border transition-colors ${
                            severityFilter === 'critical'
                              ? 'bg-[#381619] text-[#f85149] border-[#f85149]'
                              : 'bg-[#161a22] text-[#f85149]/80 border-[#222630] hover:border-[#da3633]/50'
                          }`}
                        >
                          Crit ({severityCounts.critical})
                        </button>
                      )}

                      {severityCounts.high > 0 && (
                        <button
                          onClick={() => setSeverityFilter('high')}
                          className={`px-1.5 py-0.5 rounded border transition-colors ${
                            severityFilter === 'high'
                              ? 'bg-[#332215] text-[#f0883e] border-[#f0883e]'
                              : 'bg-[#161a22] text-[#f0883e]/80 border-[#222630] hover:border-[#f0883e]/50'
                          }`}
                        >
                          High ({severityCounts.high})
                        </button>
                      )}

                      {severityCounts.medium > 0 && (
                        <button
                          onClick={() => setSeverityFilter('medium')}
                          className={`px-1.5 py-0.5 rounded border transition-colors ${
                            severityFilter === 'medium'
                              ? 'bg-[#332a15] text-[#d29922] border-[#d29922]'
                              : 'bg-[#161a22] text-[#d29922]/80 border-[#222630] hover:border-[#d29922]/50'
                          }`}
                        >
                          Med ({severityCounts.medium})
                        </button>
                      )}

                      {hasActiveFilters && (
                        <button
                          onClick={resetFilters}
                          className="px-1.5 py-0.5 rounded text-[#8b949e] hover:text-[#c9d1d9] flex items-center"
                          title="Reset filters"
                        >
                          <RotateCcw className="w-2.5 h-2.5 mr-0.5" />
                          Reset
                        </button>
                      )}
                    </div>

                    {/* Category & Asset Dropdowns */}
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <select
                        value={categoryFilter}
                        onChange={(e) =>
                          setCategoryFilter(e.target.value as 'all' | RuleCategory)
                        }
                        className="bg-[#161a22] border border-[#2d333b] rounded px-1.5 py-0.5 text-[#c9d1d9] text-[10px] focus:outline-hidden focus:border-[#58a6ff]"
                      >
                        <option value="all">All Categories</option>
                        <option value="exposure">Exposure</option>
                        <option value="network_boundary">Boundary</option>
                        <option value="access_control">Access Control</option>
                        <option value="trust_boundary">Trust Boundary</option>
                        <option value="topology_anomaly">Topology</option>
                      </select>

                      <select
                        value={assetFilter}
                        onChange={(e) => setAssetFilter(e.target.value)}
                        className="bg-[#161a22] border border-[#2d333b] rounded px-1.5 py-0.5 text-[#c9d1d9] text-[10px] focus:outline-hidden focus:border-[#58a6ff]"
                      >
                        <option value="all">All Assets</option>
                        {uniqueAffectedAssets.map((assetId) => (
                          <option key={assetId} value={assetId}>
                            {assetId}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Finding List Items */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredFindings.length === 0 ? (
                      <div className="p-4 text-center text-[11px] text-[#8b949e] font-mono space-y-2">
                        <div>No findings match the current filter.</div>
                        <button
                          onClick={resetFilters}
                          className="px-2 py-1 rounded bg-[#21262d] text-[#58a6ff] hover:bg-[#30363d] text-[10px]"
                        >
                          Clear Filters
                        </button>
                      </div>
                    ) : (
                      filteredFindings.map((f) => {
                        const isExpanded = currentFinding?.id === f.id;
                        const sevInfo = getSeverityBadge(f.severity);
                        const Icon = sevInfo.icon;

                        return (
                          <div
                            key={f.id}
                            onClick={() => setExpandedFindingId(f.id)}
                            onMouseEnter={() => onHoverFinding(f)}
                            onMouseLeave={() => onHoverFinding(null)}
                            className={`p-2 rounded border cursor-pointer text-xs font-mono transition-all ${
                              isExpanded
                                ? 'bg-[#181d26] border-[#388bfd]'
                                : 'bg-[#14171d] border-[#222630] hover:border-[#2e3440]'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`text-[9px] uppercase px-1.5 py-0.5 rounded border font-semibold flex items-center space-x-1 ${sevInfo.bg}`}
                              >
                                <Icon className="w-2.5 h-2.5 mr-0.5" />
                                <span>{f.severity}</span>
                              </span>
                              <div className="flex items-center space-x-1.5">
                                <span className="text-[10px] text-[#5c6370]">{f.ruleId}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleLocateFinding(f);
                                  }}
                                  className="text-[#8b949e] hover:text-[#58a6ff] p-0.5 rounded hover:bg-[#21262d]"
                                  title="Locate on canvas"
                                >
                                  <Crosshair className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="text-[#c9d1d9] font-medium truncate text-[11px]">
                              {f.title}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Side: Finding Deep Dive (Investigation & Remediation) */}
                <div className="flex-1 overflow-y-auto p-4 bg-[#0d0f12] text-xs font-mono space-y-3.5">
                  {currentFinding ? (
                    <div className="space-y-3.5">
                      {/* Top Header & Quick Action Buttons */}
                      <div className="flex items-start justify-between border-b border-[#222630] pb-2.5 gap-2">
                        <div>
                          <div className="text-white font-medium text-sm flex items-center space-x-2">
                            <span>{currentFinding.title}</span>
                          </div>
                          <div className="text-[#5c6370] text-[10px] mt-0.5">
                            Rule: <span className="text-[#8b949e]">{currentFinding.ruleId}</span> · Category:{' '}
                            <span className="text-[#8b949e]">{currentFinding.category}</span>
                          </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={() => handleLocateFinding(currentFinding)}
                            className="px-2.5 py-1 rounded bg-[#161b22] border border-[#30363d] text-[#58a6ff] hover:bg-[#21262d] transition-colors flex items-center space-x-1 shadow-xs text-[11px]"
                            title="Center and highlight affected components on canvas"
                          >
                            <Crosshair className="w-3.5 h-3.5" />
                            <span>Locate on Canvas</span>
                          </button>

                          {primaryAction && (
                            <button
                              onClick={() =>
                                setPendingRemediation({
                                  action: primaryAction,
                                  finding: currentFinding,
                                })
                              }
                              className="px-2.5 py-1 rounded bg-[#238636] border border-[#2ea043] text-white hover:bg-[#2ea043] transition-colors flex items-center space-x-1 shadow-xs text-[11px] font-semibold"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              <span>Apply Fix</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Structured Security Evidence */}
                      {currentFinding.evidence && (
                        <div className="p-2 rounded bg-[#161b22] border border-[#2d333b] flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[10px] text-[#8b949e]">
                          <span className="text-[#58a6ff] font-semibold uppercase tracking-wider">
                            EVIDENCE:
                          </span>
                          {currentFinding.evidence.protocol && (
                            <span>
                              Protocol:{' '}
                              <strong className="text-[#c9d1d9]">
                                {currentFinding.evidence.protocol}
                              </strong>
                            </span>
                          )}
                          {currentFinding.evidence.ports && (
                            <span>
                              Port:{' '}
                              <strong className="text-[#c9d1d9]">
                                {currentFinding.evidence.ports}
                              </strong>
                            </span>
                          )}
                          {currentFinding.evidence.access && (
                            <span>
                              Access:{' '}
                              <strong
                                className={
                                  currentFinding.evidence.access === 'deny'
                                    ? 'text-[#f85149]'
                                    : 'text-[#3fb950]'
                                }
                              >
                                {currentFinding.evidence.access.toUpperCase()}
                              </strong>
                            </span>
                          )}
                          {currentFinding.evidence.encrypted !== undefined && (
                            <span>
                              Channel:{' '}
                              <strong
                                className={
                                  currentFinding.evidence.encrypted
                                    ? 'text-[#3fb950]'
                                    : 'text-[#d29922]'
                                }
                              >
                                {currentFinding.evidence.encrypted ? 'Encrypted' : 'Unencrypted'}
                              </strong>
                            </span>
                          )}
                          {currentFinding.evidence.targetZone && (
                            <span>
                              Dest Zone:{' '}
                              <strong className="text-[#c9d1d9]">
                                {currentFinding.evidence.targetZone}
                              </strong>
                            </span>
                          )}
                          {currentFinding.evidence.targetCriticality && (
                            <span>
                              Criticality:{' '}
                              <strong className="text-[#c9d1d9]">
                                {currentFinding.evidence.targetCriticality}
                              </strong>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Explanation Grid (Why It Matters & Threat Impact) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* What & Why */}
                        <div className="p-2.5 rounded bg-[#14171d] border border-[#222630] space-y-1">
                          <div className="text-[10px] uppercase text-[#f85149] font-semibold flex items-center space-x-1">
                            <HelpCircle className="w-3 h-3" />
                            <span>1. What is Wrong & Why It Matters</span>
                          </div>
                          <div className="text-[#c9d1d9] leading-relaxed text-[11px]">
                            {currentFinding.whyItMatters}
                          </div>
                        </div>

                        {/* Impact & Exploitation */}
                        <div className="p-2.5 rounded bg-[#14171d] border border-[#222630] space-y-1">
                          <div className="text-[10px] uppercase text-[#f0883e] font-semibold flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>2. Threat Impact & Exploitation Scenario</span>
                          </div>
                          <div className="text-[#c9d1d9] leading-relaxed text-[11px]">
                            {currentFinding.impact}
                          </div>
                        </div>
                      </div>

                      {/* Visual Architecture Pattern Comparison */}
                      <RecommendedArchitectureView finding={currentFinding} />

                      {/* Available Remediation Actions Panel */}
                      <div className="p-3 rounded bg-[#14171e] border border-[#222630] space-y-2">
                        <div className="text-[10px] uppercase text-[#3fb950] font-semibold flex items-center justify-between">
                          <span className="flex items-center space-x-1">
                            <Wrench className="w-3 h-3" />
                            <span>Remediation Actions & Guidance</span>
                          </span>
                          <span className="text-[#8b949e] lowercase font-normal">
                            deterministic domain resolution
                          </span>
                        </div>

                        <div className="text-[#c9d1d9] text-[11px] leading-relaxed">
                          {currentFinding.remediation}
                        </div>

                        {/* Action buttons list */}
                        {remediationActions.length > 0 && (
                          <div className="pt-1.5 flex flex-wrap gap-2">
                            {remediationActions.map((action) => {
                              if (action.isAutomated) {
                                return (
                                  <button
                                    key={action.id}
                                    onClick={() =>
                                      setPendingRemediation({
                                        action,
                                        finding: currentFinding,
                                      })
                                    }
                                    className="px-2.5 py-1 rounded bg-[#1b2a20] border border-[#238636] text-[#7ee787] hover:bg-[#238636] hover:text-white transition-all flex items-center space-x-1 text-[11px] font-medium"
                                  >
                                    <Wrench className="w-3 h-3" />
                                    <span>{action.title}</span>
                                  </button>
                                );
                              }
                              return (
                                <div
                                  key={action.id}
                                  className="px-2 py-1 rounded bg-[#161a22] border border-[#30363d] text-[#8b949e] text-[10px] flex items-center space-x-1"
                                >
                                  <Layers className="w-3 h-3 text-[#58a6ff]" />
                                  <span>{action.title}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Affected Components */}
                      <div className="flex items-center flex-wrap gap-2 pt-1 text-[11px]">
                        <span className="text-[#8b949e]">Affected Nodes:</span>
                        {currentFinding.affectedNodes.map((nId) => (
                          <button
                            key={nId}
                            onClick={() => {
                              onSelectNode(nId);
                              onLocateElement({ id: nId, type: 'node' });
                            }}
                            className="px-2 py-0.5 rounded bg-[#1c2333] border border-[#388bfd]/30 text-[#58a6ff] hover:bg-[#253046] transition-colors cursor-pointer"
                            title="Click to center and inspect node"
                          >
                            {nId}
                          </button>
                        ))}
                        {currentFinding.affectedEdges.length > 0 && (
                          <>
                            <span className="text-[#8b949e] ml-2">Affected Edges:</span>
                            {currentFinding.affectedEdges.map((eId) => (
                              <button
                                key={eId}
                                onClick={() =>
                                  onLocateElement({ id: eId, type: 'edge' })
                                }
                                className="px-2 py-0.5 rounded bg-[#2a1b1d] border border-[#da3633]/30 text-[#f85149] hover:bg-[#381619] transition-colors cursor-pointer"
                                title="Click to center and inspect edge"
                              >
                                {eId}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {pendingRemediation && (
        <RemediationModal
          finding={pendingRemediation.finding}
          action={pendingRemediation.action}
          onConfirm={() => {
            onApplyRemediation(pendingRemediation.action, pendingRemediation.finding);
            setPendingRemediation(null);
          }}
          onCancel={() => setPendingRemediation(null)}
        />
      )}
    </>
  );
};
