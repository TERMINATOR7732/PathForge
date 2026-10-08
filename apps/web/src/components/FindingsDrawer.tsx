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
  const [isOpen, setIsOpen] = useState(false); // Default collapsed into dock to let canvas dominate!
  const [primaryMode, setPrimaryMode] = useState<PrimaryMode>('findings');
  const [threatSubTab, setThreatSubTab] = useState<ThreatSubTab>('attack-paths');
  const [intelSubTab, setIntelSubTab] = useState<IntelSubTab>('architecture');

  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(
    findings[0]?.id ?? null
  );

  // Auto-switch to verification tab if new verification arrives
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

  // Compute overall gate status
  const gateStatus = useMemo(() => {
    if (severityCounts.critical > 0) return { label: 'BLOCK', color: 'text-[#f85149] bg-[#da3633]/20 border-[#da3633]/40' };
    if (severityCounts.high > 0 || (attackPathAnalysis && attackPathAnalysis.summary.criticalAssetsReached > 0)) {
      return { label: 'WARN', color: 'text-[#f0883e] bg-[#f0883e]/20 border-[#f0883e]/40' };
    }
    return { label: 'PASS', color: 'text-[#3fb950] bg-[#238636]/20 border-[#238636]/40' };
  }, [severityCounts, attackPathAnalysis]);

  return (
    <>
      <div
        className={`border-t border-[#212631] bg-[#11151c] transition-all duration-200 select-none flex flex-col font-sans z-30 ${
          isOpen ? 'h-80 md:h-[320px]' : 'h-10'
        }`}
      >
        {/* ======================================================== */}
        {/* DOCK BAR (COLLAPSED COMMAND DOCK)                         */}
        {/* ======================================================== */}
        <div className="h-10 px-3.5 flex items-center justify-between border-b border-[#212631] bg-[#161b24] shrink-0 text-xs">
          {/* Dock Metrics & Navigation Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto py-1">
            {/* Dock Item 1: Findings Status */}
            <button
              onClick={() => {
                setPrimaryMode('findings');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-2 px-2.5 py-1 rounded transition-all cursor-pointer ${
                primaryMode === 'findings' && isOpen
                  ? 'bg-[#1f6feb]/20 text-[#58a6ff] border border-[#388bfd]/60 font-semibold'
                  : 'text-[#c9d1d9] hover:bg-[#212631] hover:text-white border border-transparent'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#58a6ff]" />
              <span className="font-semibold uppercase tracking-wide text-[11px]">Findings:</span>
              <span className="font-mono text-[11px] text-[#8b949e]">
                {severityCounts.critical > 0 && (
                  <span className="text-[#f85149] font-bold mr-1.5">{severityCounts.critical} Crit</span>
                )}
                {severityCounts.high > 0 && (
                  <span className="text-[#f0883e] font-bold mr-1.5">{severityCounts.high} High</span>
                )}
                {severityCounts.medium > 0 && (
                  <span className="text-[#e3b341] font-bold mr-1.5">{severityCounts.medium} Med</span>
                )}
                {findings.length === 0 && <span className="text-[#3fb950] font-bold">0 Clean</span>}
              </span>
            </button>

            <div className="h-3.5 w-px bg-[#212631]" />

            {/* Dock Item 2: Attack Paths */}
            <button
              onClick={() => {
                setPrimaryMode('threats');
                setThreatSubTab('attack-paths');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-2 px-2.5 py-1 rounded transition-all cursor-pointer ${
                primaryMode === 'threats' && isOpen
                  ? 'bg-[#da3633]/20 text-[#f85149] border border-[#f85149]/60 font-semibold'
                  : 'text-[#c9d1d9] hover:bg-[#212631] hover:text-white border border-transparent'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-[#f85149]" />
              <span className="font-semibold uppercase tracking-wide text-[11px]">Attack Paths:</span>
              <span className="font-mono font-bold text-[11px] text-[#f85149]">
                {attackPathCount}
              </span>
            </button>

            <div className="h-3.5 w-px bg-[#212631]" />

            {/* Dock Item 3: Defend & Prove (Verification) */}
            <button
              onClick={() => {
                setPrimaryMode('prove');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-2 px-2.5 py-1 rounded transition-all cursor-pointer ${
                primaryMode === 'prove' && isOpen
                  ? 'bg-[#238636]/20 text-[#3fb950] border border-[#238636]/60 font-semibold'
                  : 'text-[#c9d1d9] hover:bg-[#212631] hover:text-white border border-transparent'
              }`}
            >
              <History className="w-3.5 h-3.5 text-[#3fb950]" />
              <span className="font-semibold uppercase tracking-wide text-[11px]">Defend & Prove</span>
              {latestVerification && (
                <span className={`text-[10px] font-mono px-1 rounded font-bold ${
                  latestVerification.status === 'verified'
                    ? 'text-[#3fb950] bg-[#238636]/20'
                    : 'text-[#f0883e] bg-[#f0883e]/20'
                }`}>
                  {latestVerification.status === 'verified' ? 'PASS' : 'ATTN'}
                </span>
              )}
            </button>

            <div className="h-3.5 w-px bg-[#212631]" />

            {/* Dock Item 4: Readiness & Engineering Gate */}
            <button
              onClick={() => {
                setPrimaryMode('intel');
                setIntelSubTab('readiness');
                setIsOpen(true);
              }}
              className={`flex items-center space-x-2 px-2.5 py-1 rounded transition-all cursor-pointer ${
                primaryMode === 'intel' && isOpen
                  ? 'bg-[#bc8cff]/20 text-[#bc8cff] border border-[#bc8cff]/60 font-semibold'
                  : 'text-[#c9d1d9] hover:bg-[#212631] hover:text-white border border-transparent'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-[#bc8cff]" />
              <span className="font-semibold uppercase tracking-wide text-[11px]">Readiness:</span>
              <span className="font-mono font-bold text-[11px] text-[#bc8cff]">
                {productionReadiness ? `${productionReadiness.score}/100` : '—'}
              </span>

              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-bold ml-1 ${gateStatus.color}`}>
                GATE: {gateStatus.label}
              </span>
            </button>
          </div>

          {/* Right Action: Expand/Collapse Console */}
          <div className="flex items-center space-x-2.5 shrink-0">
            {/* Stale Validation Warning */}
            {isValidationStale && (
              <button
                onClick={onRequestValidate}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-[#d29922]/15 text-[#e3b341] border border-[#d29922]/40 text-[10px] font-bold animate-pulse cursor-pointer hover:bg-[#d29922]/25"
                title="Click to re-analyze modified topology"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>TOPOLOGY MODIFIED · RE-ANALYZE</span>
              </button>
            )}

            {/* Resolved Notification Badge */}
            {resolvedFindings.length > 0 && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-[#238636]/20 text-[#3fb950] border border-[#238636]/40 text-[10px] font-bold">
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

            {/* Expand / Collapse Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center space-x-1 px-2 py-1 rounded border border-[#212631] bg-[#11151c] hover:border-[#303746] hover:bg-[#1a212d] text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>{isOpen ? 'Collapse Console' : 'Open Console'}</span>
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SUB-NAVIGATION BAR (For Modes 2 & 4 when expanded)       */}
        {/* ======================================================== */}
        {isOpen && primaryMode === 'threats' && (
          <div className="h-7 px-3.5 bg-[#0e1218] border-b border-[#212631] flex items-center space-x-2 text-xs shrink-0">
            <span className="text-[#8b949e] uppercase text-[10px] font-bold tracking-wider">VIEW:</span>
            <button
              onClick={() => setThreatSubTab('attack-paths')}
              className={`px-2 py-0.5 rounded border text-xs transition-colors cursor-pointer ${
                threatSubTab === 'attack-paths'
                  ? 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/60 font-semibold'
                  : 'bg-[#161b24] text-[#8b949e] border-[#212631] hover:border-[#303746]'
              }`}
            >
              Attack Traversal Paths ({attackPathCount})
            </button>
            <button
              onClick={() => setThreatSubTab('blast-radius')}
              className={`px-2 py-0.5 rounded border text-xs transition-colors cursor-pointer ${
                threatSubTab === 'blast-radius'
                  ? 'bg-[#f0883e]/20 text-[#f0883e] border-[#f0883e]/60 font-semibold'
                  : 'bg-[#161b24] text-[#8b949e] border-[#212631] hover:border-[#303746]'
              }`}
            >
              Compromise Blast Radius ({blastRadiusCount} Reachable)
            </button>
          </div>
        )}

        {isOpen && primaryMode === 'intel' && (
          <div className="h-7 px-3.5 bg-[#0e1218] border-b border-[#212631] flex items-center space-x-2 text-xs shrink-0 overflow-x-auto">
            <span className="text-[#8b949e] uppercase text-[10px] font-bold tracking-wider">INTEL VIEW:</span>
            <button
              onClick={() => setIntelSubTab('architecture')}
              className={`px-2 py-0.5 rounded border text-xs transition-colors cursor-pointer ${
                intelSubTab === 'architecture'
                  ? 'bg-[#bc8cff]/20 text-[#bc8cff] border-[#bc8cff]/60 font-semibold'
                  : 'bg-[#161b24] text-[#8b949e] border-[#212631] hover:border-[#303746]'
              }`}
            >
              Architecture Patterns ({architectureResult?.findings.length ?? 0})
            </button>
            <button
              onClick={() => setIntelSubTab('readiness')}
              className={`px-2 py-0.5 rounded border text-xs transition-colors cursor-pointer ${
                intelSubTab === 'readiness'
                  ? 'bg-[#238636]/20 text-[#3fb950] border-[#238636]/60 font-semibold'
                  : 'bg-[#161b24] text-[#8b949e] border-[#212631] hover:border-[#303746]'
              }`}
            >
              Production Readiness ({productionReadiness ? `${productionReadiness.score}/100` : '—'})
            </button>
            <button
              onClick={() => setIntelSubTab('testing')}
              className={`px-2 py-0.5 rounded border text-xs transition-colors cursor-pointer ${
                intelSubTab === 'testing'
                  ? 'bg-[#1f6feb]/20 text-[#58a6ff] border-[#388bfd]/60 font-semibold'
                  : 'bg-[#161b24] text-[#8b949e] border-[#212631] hover:border-[#303746]'
              }`}
            >
              Testing Intelligence ({testingIntelligence ? `${testingIntelligence.score}/100` : '—'})
            </button>
            <button
              onClick={() => setIntelSubTab('debt')}
              className={`px-2 py-0.5 rounded border text-xs transition-colors cursor-pointer ${
                intelSubTab === 'debt'
                  ? 'bg-[#d29922]/20 text-[#e3b341] border-[#d29922]/60 font-semibold'
                  : 'bg-[#161b24] text-[#8b949e] border-[#212631] hover:border-[#303746]'
              }`}
            >
              Technical Debt ({technicalDebt ? technicalDebt.summary.activeCount : '—'})
            </button>
            <button
              onClick={() => setIntelSubTab('changes')}
              className={`px-2 py-0.5 rounded border text-xs transition-colors cursor-pointer ${
                intelSubTab === 'changes'
                  ? 'bg-[#1f6feb]/20 text-[#58a6ff] border-[#388bfd]/60 font-semibold'
                  : 'bg-[#161b24] text-[#8b949e] border-[#212631] hover:border-[#303746]'
              }`}
            >
              Continuous Changes & Gates
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* EXPANDED CONSOLE CONTENT PANELS                          */}
        {/* ======================================================== */}
        {isOpen && (
          <div className="flex-1 flex overflow-hidden">
            {/* ---------------------------------------------------- */}
            {/* MODE 1: ISSUES & FINDINGS INVESTIGATION WORKFLOW     */}
            {/* ---------------------------------------------------- */}
            {primaryMode === 'findings' && (
              findings.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-[#3fb950]" />
                  <div className="text-sm font-bold text-[#f0f3f6]">
                    Zero Security Violations Detected
                  </div>
                  <div className="text-xs text-[#8b949e] max-w-md">
                    All network flows conform to strict security perimeters, least-privilege
                    access policies, and verified transport encryption.
                  </div>
                </div>
              ) : (
                <>
                  {/* Left Column: Filter Bar & Finding List */}
                  <div className="w-[340px] border-r border-[#212631] flex flex-col bg-[#11151c] shrink-0">
                    {/* Filters Toolbar */}
                    <div className="p-2 border-b border-[#212631] bg-[#161b24] space-y-1.5 text-xs">
                      {/* Severity Filter Pills */}
                      <div className="flex items-center space-x-1 overflow-x-auto pb-0.5">
                        <button
                          onClick={() => setSeverityFilter('all')}
                          className={`px-2 py-0.5 rounded border transition-colors cursor-pointer text-[11px] ${
                            severityFilter === 'all'
                              ? 'bg-[#212631] text-[#f0f3f6] border-[#58a6ff] font-semibold'
                              : 'bg-[#11151c] text-[#8b949e] border-[#212631] hover:border-[#303746]'
                          }`}
                        >
                          All ({findings.length})
                        </button>

                        {severityCounts.critical > 0 && (
                          <button
                            onClick={() => setSeverityFilter('critical')}
                            className={`px-2 py-0.5 rounded border transition-colors cursor-pointer text-[11px] ${
                              severityFilter === 'critical'
                                ? 'bg-[#da3633]/20 text-[#f85149] border-[#da3633] font-semibold'
                                : 'bg-[#11151c] text-[#f85149] border-[#212631] hover:border-[#da3633]/50'
                            }`}
                          >
                            Crit ({severityCounts.critical})
                          </button>
                        )}

                        {severityCounts.high > 0 && (
                          <button
                            onClick={() => setSeverityFilter('high')}
                            className={`px-2 py-0.5 rounded border transition-colors cursor-pointer text-[11px] ${
                              severityFilter === 'high'
                                ? 'bg-[#f0883e]/20 text-[#f0883e] border-[#f0883e] font-semibold'
                                : 'bg-[#11151c] text-[#f0883e] border-[#212631] hover:border-[#f0883e]/50'
                            }`}
                          >
                            High ({severityCounts.high})
                          </button>
                        )}

                        {severityCounts.medium > 0 && (
                          <button
                            onClick={() => setSeverityFilter('medium')}
                            className={`px-2 py-0.5 rounded border transition-colors cursor-pointer text-[11px] ${
                              severityFilter === 'medium'
                                ? 'bg-[#d29922]/20 text-[#e3b341] border-[#d29922] font-semibold'
                                : 'bg-[#11151c] text-[#e3b341] border-[#212631] hover:border-[#d29922]/50'
                            }`}
                          >
                            Med ({severityCounts.medium})
                          </button>
                        )}

                        {hasActiveFilters && (
                          <button
                            onClick={resetFilters}
                            className="px-2 py-0.5 rounded text-[#8b949e] hover:text-[#f0f3f6] flex items-center ml-auto cursor-pointer"
                            title="Reset filters"
                          >
                            <RotateCcw className="w-2.5 h-2.5 mr-0.5" />
                            Reset
                          </button>
                        )}
                      </div>

                      {/* Category & Asset Dropdowns */}
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-[11px]">
                        <select
                          value={categoryFilter}
                          onChange={(e) =>
                            setCategoryFilter(e.target.value as 'all' | RuleCategory)
                          }
                          className="bg-[#11151c] border border-[#212631] rounded px-1.5 py-0.5 text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
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
                          className="bg-[#11151c] border border-[#212631] rounded px-1.5 py-0.5 text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
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

                    {/* Findings Rows */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {filteredFindings.length === 0 ? (
                        <div className="p-4 text-center text-xs text-[#8b949e] space-y-2">
                          <div>No findings match the current filter.</div>
                          <button
                            onClick={resetFilters}
                            className="px-2.5 py-1 rounded bg-[#212631] text-[#58a6ff] hover:bg-[#303746] text-xs font-semibold cursor-pointer"
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
                              className={`p-2 rounded-md border cursor-pointer text-xs transition-all ${
                                isExpanded
                                  ? 'bg-[#161b24] border-[#388bfd] shadow-sm'
                                  : 'bg-[#11151c] border-[#212631] hover:border-[#303746]'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className={`text-[9px] uppercase px-1.5 py-0.2 rounded border font-bold flex items-center space-x-1 font-mono ${sevInfo.bg}`}
                                >
                                  <Icon className="w-2.5 h-2.5 mr-0.5" />
                                  <span>{sevInfo.label}</span>
                                </span>
                                <div className="flex items-center space-x-1.5">
                                  <span className="text-[10px] text-[#8b949e] font-mono">{f.ruleId}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleLocateFinding(f);
                                    }}
                                    className="text-[#8b949e] hover:text-[#58a6ff] p-0.5 rounded hover:bg-[#212631] cursor-pointer"
                                    title="Locate on canvas"
                                  >
                                    <Crosshair className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="text-[#f0f3f6] font-medium truncate text-xs">
                                {f.title}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right Column: Finding Investigation Deep Dive */}
                  <div className="flex-1 overflow-y-auto p-4 bg-[#0d1117] text-xs space-y-3.5">
                    {currentFinding ? (
                      <div className="space-y-3.5">
                        {/* Title Bar & Actions */}
                        <div className="flex items-start justify-between border-b border-[#212631] pb-2.5 gap-2">
                          <div>
                            <div className="text-[#f0f3f6] font-bold text-sm flex items-center space-x-2">
                              <span>{currentFinding.title}</span>
                            </div>
                            <div className="text-[#8b949e] text-xs mt-0.5">
                              Rule: <span className="font-mono text-[#c9d1d9]">{currentFinding.ruleId}</span> · Category:{' '}
                              <span className="text-[#c9d1d9] capitalize">{currentFinding.category.replace('_', ' ')}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={() => handleLocateFinding(currentFinding)}
                              className="px-2.5 py-1.5 rounded bg-[#161b24] border border-[#212631] text-[#58a6ff] hover:bg-[#212631] transition-colors flex items-center space-x-1 text-xs font-semibold cursor-pointer"
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
                                className="px-3 py-1.5 rounded bg-[#238636] border border-[#2ea043] text-white hover:bg-[#2ea043] transition-colors flex items-center space-x-1 text-xs font-semibold cursor-pointer shadow-xs"
                              >
                                <Wrench className="w-3.5 h-3.5" />
                                <span>Apply Fix</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Structured Evidence Banner */}
                        {currentFinding.evidence && (
                          <div className="p-2 rounded bg-[#161b24] border border-[#212631] flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-[#8b949e]">
                            <span className="text-[#58a6ff] font-bold uppercase tracking-wider text-[10px]">
                              EVIDENCE:
                            </span>
                            {currentFinding.evidence.protocol && (
                              <span>
                                Protocol:{' '}
                                <strong className="text-[#f0f3f6] font-mono">
                                  {currentFinding.evidence.protocol}
                                </strong>
                              </span>
                            )}
                            {currentFinding.evidence.ports && (
                              <span>
                                Port:{' '}
                                <strong className="text-[#f0f3f6] font-mono">
                                  {currentFinding.evidence.ports}
                                </strong>
                              </span>
                            )}
                            {currentFinding.evidence.access && (
                              <span>
                                Access:{' '}
                                <strong
                                  className={`font-mono ${
                                    currentFinding.evidence.access === 'deny'
                                      ? 'text-[#f85149]'
                                      : 'text-[#3fb950]'
                                  }`}
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
                                <strong className="text-[#f0f3f6] uppercase font-mono">
                                  {currentFinding.evidence.targetZone}
                                </strong>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Explanation Grid (Root cause & Threat Impact) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-[#161b24] border border-[#212631] space-y-1.5">
                            <div className="text-[10px] uppercase text-[#f85149] font-bold tracking-wider flex items-center space-x-1.5">
                              <HelpCircle className="w-3.5 h-3.5" />
                              <span>1. Root Cause & Architectural Risk</span>
                            </div>
                            <div className="text-[#c9d1d9] leading-relaxed text-xs">
                              {currentFinding.whyItMatters}
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-[#161b24] border border-[#212631] space-y-1.5">
                            <div className="text-[10px] uppercase text-[#f0883e] font-bold tracking-wider flex items-center space-x-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>2. Threat Impact & Exploitation Path</span>
                            </div>
                            <div className="text-[#c9d1d9] leading-relaxed text-xs">
                              {currentFinding.impact}
                            </div>
                          </div>
                        </div>

                        {/* Recommended Architecture Comparison */}
                        <RecommendedArchitectureView finding={currentFinding} />

                        {/* Remediation Action Panel */}
                        <div className="p-3.5 rounded-lg bg-[#161b24] border border-[#212631] space-y-2">
                          <div className="text-[10px] uppercase text-[#3fb950] font-bold tracking-wider flex items-center justify-between">
                            <span className="flex items-center space-x-1.5">
                              <Wrench className="w-3.5 h-3.5" />
                              <span>Remediation Guidance</span>
                            </span>
                            <span className="text-[#8b949e] lowercase font-normal">
                              deterministic resolution
                            </span>
                          </div>

                          <div className="text-[#c9d1d9] text-xs leading-relaxed">
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
                                      className="px-3 py-1.5 rounded bg-[#238636]/20 border border-[#238636] text-[#7ee787] hover:bg-[#238636] hover:text-white transition-all flex items-center space-x-1.5 text-xs font-semibold cursor-pointer"
                                    >
                                      <Wrench className="w-3.5 h-3.5" />
                                      <span>{action.title}</span>
                                    </button>
                                  );
                                }
                                return (
                                  <div
                                    key={action.id}
                                    className="px-2.5 py-1 rounded bg-[#11151c] border border-[#212631] text-[#8b949e] text-xs flex items-center space-x-1.5"
                                  >
                                    <Layers className="w-3.5 h-3.5 text-[#58a6ff]" />
                                    <span>{action.title}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Affected Components */}
                        <div className="flex items-center flex-wrap gap-2 pt-1 text-xs">
                          <span className="text-[#8b949e] font-semibold">Affected Assets:</span>
                          {currentFinding.affectedNodes.map((nId) => (
                            <button
                              key={nId}
                              onClick={() => {
                                onSelectNode(nId);
                                onLocateElement({ id: nId, type: 'node' });
                              }}
                              className="px-2 py-0.5 rounded bg-[#1f6feb]/15 border border-[#388bfd]/40 text-[#58a6ff] hover:bg-[#1f6feb]/25 transition-colors cursor-pointer font-mono text-[11px]"
                              title="Click to center and inspect node"
                            >
                              {nId}
                            </button>
                          ))}
                          {currentFinding.affectedEdges.length > 0 && (
                            <>
                              <span className="text-[#8b949e] font-semibold ml-2">Connections:</span>
                              {currentFinding.affectedEdges.map((eId) => (
                                <button
                                  key={eId}
                                  onClick={() =>
                                    onLocateElement({ id: eId, type: 'edge' })
                                  }
                                  className="px-2 py-0.5 rounded bg-[#da3633]/15 border border-[#da3633]/40 text-[#f85149] hover:bg-[#da3633]/25 transition-colors cursor-pointer font-mono text-[11px]"
                                  title="Click to center and inspect connection"
                                >
                                  {eId}
                                </button>
                              ))}
                            </>
                          )}
                        </div>

                        {/* Cross-Analysis Shortcuts */}
                        <div className="flex items-center space-x-2 pt-2 border-t border-[#212631] text-xs">
                          <span className="text-[#8b949e] font-semibold">Cross-Analysis:</span>
                          {attackPathAnalysis && attackPathAnalysis.attackPaths.length > 0 && (
                            <button
                              onClick={() => {
                                setPrimaryMode('threats');
                                setThreatSubTab('attack-paths');
                              }}
                              className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#161b24] hover:bg-[#212631] text-[#58a6ff] border border-[#212631] transition-colors cursor-pointer"
                              title="Trace paths involving this finding"
                            >
                              <Flame className="w-3.5 h-3.5 text-[#f85149]" />
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
                              className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#161b24] hover:bg-[#212631] text-[#f0f3f6] border border-[#212631] transition-colors cursor-pointer"
                              title="Simulate compromise blast radius from primary affected node"
                            >
                              <Radio className="w-3.5 h-3.5 text-[#f0883e]" />
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
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <Activity className="w-8 h-8 text-[#58a6ff]" />
                  <div className="text-sm font-bold text-[#f0f3f6]">System Intelligence Active</div>
                  <div className="text-xs text-[#8b949e]">
                    Click "Analyze System" on the top toolbar to compute complete architectural and readiness metrics.
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Remediation Confirmation Modal */}
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
