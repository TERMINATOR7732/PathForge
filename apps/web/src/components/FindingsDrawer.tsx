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
  ChangeAnalysisResult,
  EnvironmentSnapshot,
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
  Layers,
  History,
  Flame,
  Radio,
  Activity,
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
import { ChangeAnalysisPanel } from './ChangeAnalysisPanel.js';

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
  changeAnalysis?: ChangeAnalysisResult | null;
  baselineSnapshot?: EnvironmentSnapshot | null;
  onCaptureBaseline?: () => void;
  onSelectNode: (nodeId: string) => void;
  onLocateElement: (target: { id: string; type: 'node' | 'edge' }) => void;
  onHoverFinding: (finding: Finding | null) => void;
  onApplyRemediation: (action: RemediationAction, finding: Finding) => void;
  onClearResolved?: () => void;
  onRequestValidate?: () => void;
}

type PrimaryMode = 'findings' | 'threats' | 'prove' | 'intel';
type ThreatSubTab = 'attack-paths' | 'blast-radius';
type IntelSubTab = 'architecture' | 'readiness' | 'testing' | 'debt' | 'changes';

const getSeverityBadge = (sev: Severity) => {
  switch (sev) {
    case 'critical':
      return {
        bg: 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/50',
        label: 'CRIT',
        icon: AlertOctagon,
      };
    case 'high':
      return {
        bg: 'bg-[#f0883e]/20 text-[#f0883e] border-[#f0883e]/50',
        label: 'HIGH',
        icon: AlertTriangle,
      };
    case 'medium':
      return {
        bg: 'bg-[#d29922]/20 text-[#e3b341] border-[#d29922]/50',
        label: 'MED',
        icon: AlertTriangle,
      };
    default:
      return {
        bg: 'bg-[#58a6ff]/20 text-[#58a6ff] border-[#58a6ff]/50',
        label: 'INFO',
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
  changeAnalysis = null,
  baselineSnapshot = null,
  onCaptureBaseline,
  onSelectNode,
  onLocateElement,
  onHoverFinding,
  onApplyRemediation,
  onClearResolved,
  onRequestValidate,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [primaryMode, setPrimaryMode] = useState<PrimaryMode>('findings');
  const [threatSubTab, setThreatSubTab] = useState<ThreatSubTab>('attack-paths');
  const [intelSubTab, setIntelSubTab] = useState<IntelSubTab>('architecture');

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
      setPrimaryMode('prove');
      setIsOpen(true);
    }
  }, [latestVerification]);

  // Auto-switch to blast radius tab if compromised asset is selected
  useEffect(() => {
    if (selectedCompromisedNodeId) {
      setPrimaryMode('threats');
      setThreatSubTab('blast-radius');
      setIsOpen(true);
    }
  }, [selectedCompromisedNodeId]);

  // Bridge callback for legacy sub-panels
  const handleSelectTab = (tab: string) => {
    if (tab === 'findings') {
      setPrimaryMode('findings');
    } else if (tab === 'attack-paths') {
      setPrimaryMode('threats');
      setThreatSubTab('attack-paths');
    } else if (tab === 'blast-radius') {
      setPrimaryMode('threats');
      setThreatSubTab('blast-radius');
    } else if (tab === 'verification') {
      setPrimaryMode('prove');
    } else if (
      tab === 'architecture' ||
      tab === 'readiness' ||
      tab === 'testing' ||
      tab === 'debt' ||
      tab === 'changes'
    ) {
      setPrimaryMode('intel');
      setIntelSubTab(tab as IntelSubTab);
    }
    setIsOpen(true);
  };

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

  const attackPathCount = attackPathAnalysis?.attackPaths.length ?? 0;
  const blastRadiusCount = blastRadiusResult?.summary.totalReachableAssets ?? 0;

  return (
    <>
      <div
        className={`border-t border-[#21262d] bg-[#0d1117] transition-all duration-200 select-none flex flex-col ${
          isOpen ? 'h-84 md:h-[340px]' : 'h-9'
        }`}
      >
        {/* ======================================================== */}
        {/* DRAWER HEADER BAR                                        */}
        {/* ======================================================== */}
        <div className="h-9 px-3 flex items-center justify-between border-b border-[#21262d] bg-[#161b22] shrink-0">
          <div className="flex items-center space-x-1.5 overflow-x-auto text-xs font-mono py-0.5">
            {/* Mode 1: Issues & Findings */}
            <button
              onClick={() => {
                setPrimaryMode('findings');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                primaryMode === 'findings' && isOpen
                  ? 'bg-[#1f6feb]/20 text-[#58a6ff] border border-[#388bfd]'
                  : 'text-[#8b949e] hover:text-[#c9d1d9] border border-transparent'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#58a6ff]" />
              <span>1. ISSUES & FINDINGS</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                findings.length > 0 ? 'bg-[#da3633]/20 text-[#f85149]' : 'bg-[#238636]/20 text-[#3fb950]'
              }`}>
                {findings.length}
              </span>
            </button>

            {/* Mode 2: Threat Vectors */}
            <button
              onClick={() => {
                setPrimaryMode('threats');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                primaryMode === 'threats' && isOpen
                  ? 'bg-[#da3633]/20 text-[#f85149] border border-[#f85149]'
                  : 'text-[#8b949e] hover:text-[#c9d1d9] border border-transparent'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-[#f85149]" />
              <span>2. THREAT VECTORS</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#161b22] text-[#8b949e] border border-[#30363d]">
                {attackPathCount}
              </span>
            </button>

            {/* Mode 3: Defend & Prove */}
            <button
              onClick={() => {
                setPrimaryMode('prove');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                primaryMode === 'prove' && isOpen
                  ? 'bg-[#238636]/20 text-[#3fb950] border border-[#238636]'
                  : 'text-[#8b949e] hover:text-[#c9d1d9] border border-transparent'
              }`}
            >
              <History className="w-3.5 h-3.5 text-[#3fb950]" />
              <span>3. DEFEND & PROVE</span>
              {latestVerification && (
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  latestVerification.status === 'verified'
                    ? 'bg-[#238636]/20 text-[#3fb950]'
                    : 'bg-[#f0883e]/20 text-[#f0883e]'
                }`}>
                  {latestVerification.status === 'verified' ? 'PASS' : 'ATTN'}
                </span>
              )}
            </button>

            {/* Mode 4: System Intel & Gates */}
            <button
              onClick={() => {
                setPrimaryMode('intel');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                primaryMode === 'intel' && isOpen
                  ? 'bg-[#bc8cff]/20 text-[#d2a8ff] border border-[#bc8cff]'
                  : 'text-[#8b949e] hover:text-[#c9d1d9] border border-transparent'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-[#bc8cff]" />
              <span>4. SYSTEM INTEL & GATES</span>
              {productionReadiness && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#161b22] text-[#8b949e] border border-[#30363d]">
                  {productionReadiness.score}%
                </span>
              )}
            </button>

            {/* Stale Validation Warning */}
            {isValidationStale && (
              <span className="px-2 py-0.5 rounded bg-[#f0883e]/20 text-[#f0883e] border border-[#f0883e]/50 text-[10px] font-semibold animate-pulse ml-1">
                VALIDATION STALE
              </span>
            )}

            {/* Resolved Findings Notification */}
            {resolvedFindings.length > 0 && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-[#238636]/20 text-[#3fb950] border border-[#238636]/40 text-[10px] font-semibold ml-1">
                <span>{resolvedFindings.length} Resolved</span>
                {onClearResolved && (
                  <button
                    onClick={onClearResolved}
                    className="ml-1 text-[#8b949e] hover:text-white"
                    title="Dismiss"
                  >
                    ×
                  </button>
                )}
              </span>
            )}
          </div>

          {/* Right Action / Collapse Toggle */}
          <div className="flex items-center space-x-2 shrink-0">
            {!isOpen && (
              <div className="hidden lg:flex items-center space-x-2 text-[10px] font-mono text-[#8b949e] mr-2">
                <span>{findings.length} Findings</span>
                <span>·</span>
                <span>{attackPathCount} Attack Paths</span>
                <span>·</span>
                <span>{productionReadiness ? `Readiness ${productionReadiness.score}/100` : 'Ready'}</span>
              </div>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center space-x-1 px-2 py-0.5 rounded border border-[#30363d] bg-[#0d1117] text-[#8b949e] hover:text-[#f0f6fc] text-xs font-mono transition-colors cursor-pointer"
            >
              <span>{isOpen ? 'Collapse' : 'Expand Dock'}</span>
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECONDARY SUB-NAVIGATION BAR (For Modes 2 & 4)           */}
        {/* ======================================================== */}
        {isOpen && primaryMode === 'threats' && (
          <div className="h-7 px-3 bg-[#0d1117] border-b border-[#21262d] flex items-center space-x-2 text-[11px] font-mono shrink-0">
            <span className="text-[#8b949e] uppercase text-[10px] font-semibold">VIEW:</span>
            <button
              onClick={() => setThreatSubTab('attack-paths')}
              className={`px-2 py-0.5 rounded border text-xs transition-colors ${
                threatSubTab === 'attack-paths'
                  ? 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/50 font-semibold'
                  : 'bg-[#161b22] text-[#8b949e] border-[#21262d] hover:border-[#30363d]'
              }`}
            >
              Attack Paths ({attackPathCount})
            </button>
            <button
              onClick={() => setThreatSubTab('blast-radius')}
              className={`px-2 py-0.5 rounded border text-xs transition-colors ${
                threatSubTab === 'blast-radius'
                  ? 'bg-[#f0883e]/20 text-[#f0883e] border-[#f0883e]/50 font-semibold'
                  : 'bg-[#161b22] text-[#8b949e] border-[#21262d] hover:border-[#30363d]'
              }`}
            >
              Blast Radius Simulation ({blastRadiusCount} Reachable)
            </button>
          </div>
        )}

        {isOpen && primaryMode === 'intel' && (
          <div className="h-7 px-3 bg-[#0d1117] border-b border-[#21262d] flex items-center space-x-2 text-[11px] font-mono shrink-0 overflow-x-auto">
            <span className="text-[#8b949e] uppercase text-[10px] font-semibold">VIEW:</span>
            <button
              onClick={() => setIntelSubTab('architecture')}
              className={`px-2 py-0.5 rounded border text-xs transition-colors ${
                intelSubTab === 'architecture'
                  ? 'bg-[#bc8cff]/20 text-[#d2a8ff] border-[#bc8cff]/50 font-semibold'
                  : 'bg-[#161b22] text-[#8b949e] border-[#21262d] hover:border-[#30363d]'
              }`}
            >
              Architecture ({architectureResult?.findings.length ?? 0})
            </button>
            <button
              onClick={() => setIntelSubTab('readiness')}
              className={`px-2 py-0.5 rounded border text-xs transition-colors ${
                intelSubTab === 'readiness'
                  ? 'bg-[#238636]/20 text-[#3fb950] border-[#238636]/50 font-semibold'
                  : 'bg-[#161b22] text-[#8b949e] border-[#21262d] hover:border-[#30363d]'
              }`}
            >
              Readiness ({productionReadiness ? `${productionReadiness.score}/100` : '—'})
            </button>
            <button
              onClick={() => setIntelSubTab('testing')}
              className={`px-2 py-0.5 rounded border text-xs transition-colors ${
                intelSubTab === 'testing'
                  ? 'bg-[#1f6feb]/20 text-[#58a6ff] border-[#388bfd]/50 font-semibold'
                  : 'bg-[#161b22] text-[#8b949e] border-[#21262d] hover:border-[#30363d]'
              }`}
            >
              Testing Intelligence ({testingIntelligence ? `${testingIntelligence.score}/100` : '—'})
            </button>
            <button
              onClick={() => setIntelSubTab('debt')}
              className={`px-2 py-0.5 rounded border text-xs transition-colors ${
                intelSubTab === 'debt'
                  ? 'bg-[#d29922]/20 text-[#e3b341] border-[#d29922]/50 font-semibold'
                  : 'bg-[#161b22] text-[#8b949e] border-[#21262d] hover:border-[#30363d]'
              }`}
            >
              Tech Debt ({technicalDebt ? technicalDebt.summary.activeCount : '—'})
            </button>
            <button
              onClick={() => setIntelSubTab('changes')}
              className={`px-2 py-0.5 rounded border text-xs transition-colors ${
                intelSubTab === 'changes'
                  ? 'bg-[#1f6feb]/20 text-[#58a6ff] border-[#388bfd]/50 font-semibold'
                  : 'bg-[#161b22] text-[#8b949e] border-[#21262d] hover:border-[#30363d]'
              }`}
            >
              Continuous Changes & Gates ({changeAnalysis ? changeAnalysis.summary.totalChanges : '—'})
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* DRAWER CONTENT PANELS                                    */}
        {/* ======================================================== */}
        {isOpen && (
          <div className="flex-1 flex overflow-hidden">
            {/* ---------------------------------------------------- */}
            {/* MODE 1: ISSUES & FINDINGS                            */}
            {/* ---------------------------------------------------- */}
            {primaryMode === 'findings' && (
              findings.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center font-mono space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-[#3fb950]" />
                  <div className="text-sm font-semibold text-[#f0f6fc]">
                    Zero Security Violations Detected
                  </div>
                  <div className="text-xs text-[#8b949e] max-w-md">
                    All active network flows conform to strict security boundaries, least-privilege
                    access policies, and verified zone defense.
                  </div>
                </div>
              ) : (
                <>
                  {/* Left Column: Filter Bar & Finding Rows */}
                  <div className="w-[360px] border-r border-[#21262d] flex flex-col bg-[#0d1117] shrink-0">
                    {/* Filters Toolbar */}
                    <div className="p-2 border-b border-[#21262d] bg-[#161b22] space-y-1.5 text-[10px] font-mono">
                      {/* Severity Pills */}
                      <div className="flex items-center space-x-1 overflow-x-auto pb-0.5">
                        <button
                          onClick={() => setSeverityFilter('all')}
                          className={`px-1.5 py-0.5 rounded border transition-colors ${
                            severityFilter === 'all'
                              ? 'bg-[#21262d] text-[#f0f6fc] border-[#58a6ff]'
                              : 'bg-[#161b22] text-[#8b949e] border-[#21262d] hover:border-[#30363d]'
                          }`}
                        >
                          All ({findings.length})
                        </button>

                        {severityCounts.critical > 0 && (
                          <button
                            onClick={() => setSeverityFilter('critical')}
                            className={`px-1.5 py-0.5 rounded border transition-colors ${
                              severityFilter === 'critical'
                                ? 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]'
                                : 'bg-[#161b22] text-[#f85149] border-[#21262d] hover:border-[#da3633]/50'
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
                                ? 'bg-[#f0883e]/20 text-[#f0883e] border-[#f0883e]'
                                : 'bg-[#161b22] text-[#f0883e] border-[#21262d] hover:border-[#f0883e]/50'
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
                                ? 'bg-[#d29922]/20 text-[#e3b341] border-[#d29922]'
                                : 'bg-[#161b22] text-[#e3b341] border-[#21262d] hover:border-[#d29922]/50'
                            }`}
                          >
                            Med ({severityCounts.medium})
                          </button>
                        )}

                        {hasActiveFilters && (
                          <button
                            onClick={resetFilters}
                            className="px-1.5 py-0.5 rounded text-[#8b949e] hover:text-[#f0f6fc] flex items-center ml-auto"
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
                          className="bg-[#0d1117] border border-[#30363d] rounded px-1.5 py-0.5 text-[#c9d1d9] text-[10px] focus:outline-none focus:border-[#58a6ff]"
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
                          className="bg-[#0d1117] border border-[#30363d] rounded px-1.5 py-0.5 text-[#c9d1d9] text-[10px] focus:outline-none focus:border-[#58a6ff]"
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

                    {/* Finding Rows */}
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
                                  ? 'bg-[#161b22] border-[#388bfd] shadow-xs'
                                  : 'bg-[#11141a] border-[#21262d] hover:border-[#30363d]'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className={`text-[9px] uppercase px-1.5 py-0.2 rounded border font-semibold flex items-center space-x-1 ${sevInfo.bg}`}
                                >
                                  <Icon className="w-2.5 h-2.5 mr-0.5" />
                                  <span>{sevInfo.label}</span>
                                </span>
                                <div className="flex items-center space-x-1.5">
                                  <span className="text-[10px] text-[#8b949e]">{f.ruleId}</span>
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
                              <div className="text-[#f0f6fc] font-medium truncate text-[11px]">
                                {f.title}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right Column: Deep-Dive Investigation & Remediation */}
                  <div className="flex-1 overflow-y-auto p-3.5 bg-[#0d1117] text-xs font-mono space-y-3.5">
                    {currentFinding ? (
                      <div className="space-y-3.5">
                        {/* Title Bar & Quick Actions */}
                        <div className="flex items-start justify-between border-b border-[#21262d] pb-2.5 gap-2">
                          <div>
                            <div className="text-[#f0f6fc] font-semibold text-sm flex items-center space-x-2">
                              <span>{currentFinding.title}</span>
                            </div>
                            <div className="text-[#8b949e] text-[10px] mt-0.5">
                              Rule: <span className="text-[#c9d1d9]">{currentFinding.ruleId}</span> · Category:{' '}
                              <span className="text-[#c9d1d9]">{currentFinding.category}</span>
                            </div>
                          </div>

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
                          <div className="p-2 rounded bg-[#161b22] border border-[#21262d] flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[10px] text-[#8b949e]">
                            <span className="text-[#58a6ff] font-semibold uppercase tracking-wider">
                              EVIDENCE:
                            </span>
                            {currentFinding.evidence.protocol && (
                              <span>
                                Protocol:{' '}
                                <strong className="text-[#f0f6fc]">
                                  {currentFinding.evidence.protocol}
                                </strong>
                              </span>
                            )}
                            {currentFinding.evidence.ports && (
                              <span>
                                Port:{' '}
                                <strong className="text-[#f0f6fc]">
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
                                      : 'text-[#e3b341]'
                                  }
                                >
                                  {currentFinding.evidence.encrypted ? 'Encrypted' : 'Unencrypted'}
                                </strong>
                              </span>
                            )}
                            {currentFinding.evidence.targetZone && (
                              <span>
                                Dest Zone:{' '}
                                <strong className="text-[#f0f6fc]">
                                  {currentFinding.evidence.targetZone}
                                </strong>
                              </span>
                            )}
                            {currentFinding.evidence.targetCriticality && (
                              <span>
                                Criticality:{' '}
                                <strong className="text-[#f0f6fc]">
                                  {currentFinding.evidence.targetCriticality}
                                </strong>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Explanation Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-2.5 rounded bg-[#161b22] border border-[#21262d] space-y-1">
                            <div className="text-[10px] uppercase text-[#f85149] font-semibold flex items-center space-x-1">
                              <HelpCircle className="w-3 h-3" />
                              <span>1. Root Cause & Architectural Risk</span>
                            </div>
                            <div className="text-[#c9d1d9] leading-relaxed text-[11px]">
                              {currentFinding.whyItMatters}
                            </div>
                          </div>

                          <div className="p-2.5 rounded bg-[#161b22] border border-[#21262d] space-y-1">
                            <div className="text-[10px] uppercase text-[#f0883e] font-semibold flex items-center space-x-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>2. Threat Impact & Exploitation Path</span>
                            </div>
                            <div className="text-[#c9d1d9] leading-relaxed text-[11px]">
                              {currentFinding.impact}
                            </div>
                          </div>
                        </div>

                        {/* Architecture Comparison */}
                        <RecommendedArchitectureView finding={currentFinding} />

                        {/* Remediation Panel */}
                        <div className="p-3 rounded bg-[#161b22] border border-[#21262d] space-y-2">
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
                                      className="px-2.5 py-1 rounded bg-[#238636]/20 border border-[#238636] text-[#7ee787] hover:bg-[#238636] hover:text-white transition-all flex items-center space-x-1 text-[11px] font-semibold"
                                    >
                                      <Wrench className="w-3 h-3" />
                                      <span>{action.title}</span>
                                    </button>
                                  );
                                }
                                return (
                                  <div
                                    key={action.id}
                                    className="px-2 py-1 rounded bg-[#0d1117] border border-[#30363d] text-[#8b949e] text-[10px] flex items-center space-x-1"
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
                          <span className="text-[#8b949e]">Affected Assets:</span>
                          {currentFinding.affectedNodes.map((nId) => (
                            <button
                              key={nId}
                              onClick={() => {
                                onSelectNode(nId);
                                onLocateElement({ id: nId, type: 'node' });
                              }}
                              className="px-2 py-0.5 rounded bg-[#1f6feb]/15 border border-[#388bfd]/40 text-[#58a6ff] hover:bg-[#1f6feb]/25 transition-colors cursor-pointer"
                              title="Click to center and inspect node"
                            >
                              {nId}
                            </button>
                          ))}
                          {currentFinding.affectedEdges.length > 0 && (
                            <>
                              <span className="text-[#8b949e] ml-2">Connections:</span>
                              {currentFinding.affectedEdges.map((eId) => (
                                <button
                                  key={eId}
                                  onClick={() =>
                                    onLocateElement({ id: eId, type: 'edge' })
                                  }
                                  className="px-2 py-0.5 rounded bg-[#da3633]/15 border border-[#da3633]/40 text-[#f85149] hover:bg-[#da3633]/25 transition-colors cursor-pointer"
                                  title="Click to center and inspect connection"
                                >
                                  {eId}
                                </button>
                              ))}
                            </>
                          )}
                        </div>

                        {/* Cross-Analysis Shortcuts */}
                        <div className="flex items-center space-x-2 pt-2 border-t border-[#21262d] text-[11px]">
                          <span className="text-[#8b949e]">Cross-Analysis:</span>
                          {attackPathAnalysis && attackPathAnalysis.attackPaths.length > 0 && (
                            <button
                              onClick={() => {
                                setPrimaryMode('threats');
                                setThreatSubTab('attack-paths');
                              }}
                              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#21262d] text-[#58a6ff] transition-colors"
                              title="Trace paths involving this finding"
                            >
                              <Flame className="w-3 h-3 text-[#f85149]" />
                              <span>Trace in Attack Paths</span>
                            </button>
                          )}
                          {currentFinding.affectedNodes[0] && (
                            <button
                              onClick={() => {
                                onSelectCompromisedNode?.(currentFinding.affectedNodes[0]);
                                setPrimaryMode('threats');
                                setThreatSubTab('blast-radius');
                              }}
                              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#161b22] hover:bg-[#21262d] text-[#f0f6fc] transition-colors"
                              title="Simulate compromise blast radius from primary affected node"
                            >
                              <Radio className="w-3 h-3 text-[#f0883e]" />
                              <span>Simulate Blast Radius</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              )
            )}

            {/* ---------------------------------------------------- */}
            {/* MODE 2: THREAT VECTORS (Attack Paths & Blast Radius) */}
            {/* ---------------------------------------------------- */}
            {primaryMode === 'threats' && (
              threatSubTab === 'attack-paths' ? (
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
                    setThreatSubTab('blast-radius');
                  }}
                  isStale={isValidationStale}
                />
              ) : (
                <BlastRadiusPanel
                  environment={environment}
                  analysisResult={blastRadiusResult ?? null}
                  selectedCompromisedNodeId={selectedCompromisedNodeId ?? null}
                  onSelectCompromisedNode={onSelectCompromisedNode ?? (() => {})}
                  onLocateElement={onLocateElement}
                  onClearAnalysis={onClearBlastRadius}
                />
              )
            )}

            {/* ---------------------------------------------------- */}
            {/* MODE 3: DEFEND & PROVE (Fix Verification & Diff)    */}
            {/* ---------------------------------------------------- */}
            {primaryMode === 'prove' && (
              <VerificationPanel
                verification={latestVerification ?? null}
                environment={environment}
                validationResult={validationResult}
                onLocateElement={onLocateElement}
                onSelectNode={onSelectNode}
                onRequestValidate={onRequestValidate ?? (() => {})}
              />
            )}

            {/* ---------------------------------------------------- */}
            {/* MODE 4: SYSTEM INTEL & GATES                         */}
            {/* ---------------------------------------------------- */}
            {primaryMode === 'intel' && (
              intelSubTab === 'architecture' && architectureResult ? (
                <ArchitecturePanel
                  analysisResult={architectureResult}
                  onLocateElement={onLocateElement}
                  onSelectTab={handleSelectTab}
                />
              ) : intelSubTab === 'readiness' && productionReadiness ? (
                <ProductionReadinessPanel
                  assessment={productionReadiness}
                  onLocateElement={onLocateElement}
                  onSelectTab={handleSelectTab}
                />
              ) : intelSubTab === 'testing' && testingIntelligence ? (
                <TestingIntelligencePanel
                  intelligence={testingIntelligence}
                  onLocateElement={onLocateElement}
                  onSelectTab={handleSelectTab}
                />
              ) : intelSubTab === 'debt' && technicalDebt ? (
                <TechnicalDebtPanel
                  assessment={technicalDebt}
                  onLocateElement={onLocateElement}
                  onSelectTab={handleSelectTab}
                />
              ) : intelSubTab === 'changes' ? (
                <div className="flex-1 overflow-y-auto p-4 bg-[#0d1117]">
                  <ChangeAnalysisPanel
                    changeAnalysis={changeAnalysis}
                    baselineSnapshot={baselineSnapshot}
                    onCaptureBaseline={onCaptureBaseline ?? (() => {})}
                    onLocateElement={onLocateElement}
                    onSelectNode={onSelectNode}
                    onRequestValidate={onRequestValidate}
                    environment={environment}
                    validationResult={validationResult}
                    attackPathAnalysis={attackPathAnalysis}
                    architectureResult={architectureResult}
                    productionReadiness={productionReadiness}
                    testingIntelligence={testingIntelligence}
                    technicalDebt={technicalDebt}
                    isValidationStale={isValidationStale}
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center font-mono space-y-2">
                  <Activity className="w-8 h-8 text-[#58a6ff]" />
                  <div className="text-sm font-semibold text-[#f0f6fc]">System Intelligence Active</div>
                  <div className="text-xs text-[#8b949e]">
                    Click "Analyze System" on the top navigation bar to compute complete architectural and gate metrics.
                  </div>
                </div>
              )
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
