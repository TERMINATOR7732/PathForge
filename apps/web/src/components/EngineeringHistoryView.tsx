import React, { useState, useMemo, useCallback } from 'react';
import { ValidationResult } from '@pathforge/shared';
import {
  Environment,
  AttackPathAnalysisResult,
  ArchitectureAnalysisResult,
  ProductionReadinessAssessment,
  TestingIntelligenceResult,
  TechnicalDebtAssessment,
  ChangeAnalysisResult,
  EngineeringHistoryRecord,
  captureEngineeringHistoryRecord,
  compareHistoricalRecords,
  calculateEngineeringTrends,
  InMemoryHistoryStore,
  HistoricalComparisonVerdict,
  TrendDirection,
} from '@pathforge/core';
import {
  Camera,
  History,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  Trash2,
  GitPullRequest,
  FolderGit2,
  Calendar,
  Layers,
} from 'lucide-react';

export interface EngineeringHistoryViewProps {
  environment: Environment | null;
  validationResult: ValidationResult | null;
  attackPathAnalysis?: AttackPathAnalysisResult | null;
  architectureResult?: ArchitectureAnalysisResult | null;
  productionReadiness?: ProductionReadinessAssessment | null;
  testingIntelligence?: TestingIntelligenceResult | null;
  technicalDebt?: TechnicalDebtAssessment | null;
  changeAnalysis?: ChangeAnalysisResult | null;
}

// Initial realistic demo history track
function createInitialDemoRecords(env: Environment | null): EngineeringHistoryRecord[] {
  const envId = env?.id ?? 'std-web-app';
  const envName = env?.name ?? 'Standard Web App';

  return [
    {
      schemaVersion: 1,
      id: 'hist-demo-01',
      environmentId: envId,
      environmentName: envName,
      timestamp: '2026-10-01T09:30:00.000Z',
      source: 'manual',
      sourceIdentity: { type: 'manual', environmentId: envId, name: 'Initial Unhardened Baseline' },
      revisionIdentity: 'v1.0.0',
      topology: { nodeCount: 4, edgeCount: 4, criticalNodeCount: 1, internetFacingNodeCount: 1 },
      validation: {
        findingCount: 3,
        criticalCount: 1,
        highCount: 1,
        mediumCount: 1,
        lowCount: 0,
        infoCount: 0,
        findingIds: ['PF-001', 'PF-002', 'PF-005'],
      },
      attackPath: {
        pathCount: 3,
        criticalPathCount: 1,
        highRiskPathCount: 1,
        highestRiskScore: 82,
        highestRisk: 'critical',
        reachableCriticalAssets: 1,
        mostExposedAssetId: 'database-1',
        mostExposedAssetName: 'Primary DB',
      },
      architecture: { score: 61, rating: 'needs-attention', segmentation: 'weak', findingsCount: 2 },
      readiness: { score: 64, rating: 'NEEDS_ATTENTION', status: 'NOT_READY', blockedGatesCount: 2, warningCount: 1 },
      testing: { score: 55, level: 'MODERATE', criticalCoverage: 40, highCoverage: 60, unverifiedPropertiesCount: 3 },
      technicalDebt: { score: 52, rating: 'ELEVATED', activeCount: 4, p0Count: 1, p1Count: 1 },
      evidenceNotes: [],
    },
    {
      schemaVersion: 1,
      id: 'hist-demo-02',
      environmentId: envId,
      environmentName: envName,
      timestamp: '2026-10-04T14:15:00.000Z',
      source: 'local-git',
      sourceIdentity: {
        type: 'local-git',
        repositoryPath: 'infra-repo',
        commitSha: '71b91ac5e9a1',
        branch: 'feature/network-hardening',
      },
      revisionIdentity: '71b91ac',
      topology: { nodeCount: 5, edgeCount: 5, criticalNodeCount: 1, internetFacingNodeCount: 1 },
      validation: {
        findingCount: 1,
        criticalCount: 0,
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        infoCount: 0,
        findingIds: ['PF-005'],
      },
      attackPath: {
        pathCount: 2,
        criticalPathCount: 0,
        highRiskPathCount: 1,
        highestRiskScore: 51,
        highestRisk: 'high',
        reachableCriticalAssets: 0,
        mostExposedAssetId: 'api-server-1',
        mostExposedAssetName: 'API Gateway',
      },
      architecture: { score: 78, rating: 'good', segmentation: 'moderate', findingsCount: 1 },
      readiness: { score: 79, rating: 'GOOD', status: 'READY_WITH_WARNINGS', blockedGatesCount: 0, warningCount: 2 },
      testing: { score: 72, level: 'GOOD', criticalCoverage: 80, highCoverage: 80, unverifiedPropertiesCount: 2 },
      technicalDebt: { score: 68, rating: 'MANAGEABLE', activeCount: 2, p0Count: 0, p1Count: 1 },
      evidenceNotes: [],
    },
    {
      schemaVersion: 1,
      id: 'hist-demo-03',
      environmentId: envId,
      environmentName: envName,
      timestamp: '2026-10-08T11:00:00.000Z',
      source: 'github-pr',
      sourceIdentity: {
        type: 'github-pr',
        owner: 'acme-corp',
        repository: 'cloud-infrastructure',
        prNumber: 102,
        baseSha: '71b91ac5e9a1',
        headSha: 'a83f2d1b09c2',
      },
      revisionIdentity: 'a83f2d1',
      topology: { nodeCount: 5, edgeCount: 6, criticalNodeCount: 1, internetFacingNodeCount: 1 },
      validation: {
        findingCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        infoCount: 0,
        findingIds: [],
      },
      attackPath: {
        pathCount: 1,
        criticalPathCount: 0,
        highRiskPathCount: 0,
        highestRiskScore: 34,
        highestRisk: 'medium',
        reachableCriticalAssets: 0,
        mostExposedAssetId: 'api-server-1',
        mostExposedAssetName: 'API Gateway',
      },
      architecture: { score: 88, rating: 'strong', segmentation: 'strong', findingsCount: 0 },
      readiness: { score: 89, rating: 'EXCELLENT', status: 'READY', blockedGatesCount: 0, warningCount: 1 },
      testing: { score: 86, level: 'GOOD', criticalCoverage: 100, highCoverage: 90, unverifiedPropertiesCount: 1 },
      technicalDebt: { score: 85, rating: 'MANAGEABLE', activeCount: 1, p0Count: 0, p1Count: 0 },
      evidenceNotes: [],
    },
  ];
}

export const EngineeringHistoryView: React.FC<EngineeringHistoryViewProps> = ({
  environment,
  validationResult,
  attackPathAnalysis,
  architectureResult,
  productionReadiness,
  testingIntelligence,
  technicalDebt,
  changeAnalysis,
}) => {
  // Store instance
  const store = useMemo(() => {
    const s = new InMemoryHistoryStore();
    const demoRecords = createInitialDemoRecords(environment);
    demoRecords.forEach((r) => s.save(r));
    return s;
  }, [environment]);

  const [records, setRecords] = useState<readonly EngineeringHistoryRecord[]>(() => store.list());
  const [selectedBaselineId, setSelectedBaselineId] = useState<string>(() => records[records.length - 1]?.id ?? '');
  const [selectedCurrentId, setSelectedCurrentId] = useState<string>(() => records[0]?.id ?? '');
  const [captureFeedback, setCaptureFeedback] = useState<string | null>(null);

  // Sync records
  const refreshRecords = useCallback(() => {
    const updated = store.list();
    setRecords(updated);
    if (updated.length > 0) {
      if (!selectedCurrentId || !updated.some((r) => r.id === selectedCurrentId)) {
        setSelectedCurrentId(updated[0].id);
      }
      if (!selectedBaselineId || !updated.some((r) => r.id === selectedBaselineId)) {
        setSelectedBaselineId(updated[updated.length - 1]?.id ?? updated[0].id);
      }
    }
  }, [store, selectedBaselineId, selectedCurrentId]);

  // Capture current state snapshot
  const handleCaptureSnapshot = useCallback(() => {
    if (!environment || !validationResult) {
      setCaptureFeedback('Cannot capture snapshot: topology or validation result missing.');
      return;
    }

    const newRecord = captureEngineeringHistoryRecord({
      environment,
      validationResult,
      source: 'manual',
      sourceIdentity: { type: 'manual', environmentId: environment.id, name: environment.name },
      attackPathAnalysis,
      architectureAnalysis: architectureResult,
      productionReadiness,
      testingIntelligence,
      technicalDebt,
      changeAnalysis,
    });

    const saveRes = store.save(newRecord);
    refreshRecords();

    if (saveRes.isDuplicate) {
      setCaptureFeedback(`Snapshot already recorded (ID: ${saveRes.record.id.slice(0, 18)}...) — zero semantic drift.`);
    } else {
      setCaptureFeedback(`✓ Successfully captured new snapshot (${saveRes.record.id.slice(0, 18)}...)`);
      setSelectedCurrentId(saveRes.record.id);
    }

    setTimeout(() => setCaptureFeedback(null), 5000);
  }, [
    environment,
    validationResult,
    attackPathAnalysis,
    architectureResult,
    productionReadiness,
    testingIntelligence,
    technicalDebt,
    changeAnalysis,
    store,
    refreshRecords,
  ]);

  const handleDeleteRecord = useCallback((id: string) => {
    store.delete(id);
    refreshRecords();
  }, [store, refreshRecords]);

  const handleClearHistory = useCallback(() => {
    store.clear();
    refreshRecords();
  }, [store, refreshRecords]);

  // Compute trends across chronological records
  const trends = useMemo(() => calculateEngineeringTrends(records), [records]);

  // Compute comparison between selected baseline and current
  const baselineRecord = useMemo(
    () => records.find((r) => r.id === selectedBaselineId) ?? records[records.length - 1],
    [records, selectedBaselineId]
  );
  const currentRecord = useMemo(
    () => records.find((r) => r.id === selectedCurrentId) ?? records[0],
    [records, selectedCurrentId]
  );

  const comparison = useMemo(() => {
    if (!baselineRecord || !currentRecord) return null;
    return compareHistoricalRecords(baselineRecord, currentRecord);
  }, [baselineRecord, currentRecord]);

  const getVerdictBadge = (verdict: HistoricalComparisonVerdict) => {
    switch (verdict) {
      case 'ENGINEERING_POSTURE_IMPROVED':
        return {
          bg: 'bg-[#238636]/20 text-[#3fb950] border-[#238636]/40',
          icon: CheckCircle2,
          label: 'POSTURE IMPROVED',
        };
      case 'ENGINEERING_POSTURE_DEGRADED':
        return {
          bg: 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/40',
          icon: AlertOctagon,
          label: 'POSTURE DEGRADED',
        };
      case 'MIXED_ENGINEERING_IMPACT':
        return {
          bg: 'bg-[#d29922]/20 text-[#d29922] border-[#d29922]/40',
          icon: AlertTriangle,
          label: 'MIXED IMPACT',
        };
      case 'NO_MEANINGFUL_CHANGE':
        return {
          bg: 'bg-[#1f6feb]/20 text-[#58a6ff] border-[#1f6feb]/40',
          icon: Minus,
          label: 'NO MEANINGFUL CHANGE',
        };
      case 'INSUFFICIENT_EVIDENCE':
      default:
        return {
          bg: 'bg-[#8b949e]/20 text-[#c9d1d9] border-[#8b949e]/40',
          icon: HelpCircle,
          label: 'INSUFFICIENT EVIDENCE',
        };
    }
  };

  const getTrendDirectionBadge = (dir: TrendDirection) => {
    switch (dir) {
      case 'improving':
        return {
          bg: 'bg-[#238636]/15 text-[#3fb950] border-[#238636]/40',
          icon: TrendingUp,
          label: 'IMPROVING',
        };
      case 'degrading':
        return {
          bg: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/40',
          icon: TrendingDown,
          label: 'DEGRADING',
        };
      case 'stable':
        return {
          bg: 'bg-[#1f6feb]/15 text-[#58a6ff] border-[#1f6feb]/40',
          icon: Minus,
          label: 'STABLE',
        };
      case 'insufficient-data':
      default:
        return {
          bg: 'bg-[#8b949e]/15 text-[#8b949e] border-[#8b949e]/30',
          icon: HelpCircle,
          label: 'INSUFFICIENT DATA',
        };
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'local-git':
        return <FolderGit2 className="w-3.5 h-3.5 text-[#58a6ff]" />;
      case 'github-pr':
        return <GitPullRequest className="w-3.5 h-3.5 text-[#8957e5]" />;
      case 'scenario':
        return <Layers className="w-3.5 h-3.5 text-[#e3b341]" />;
      case 'manual':
      default:
        return <Camera className="w-3.5 h-3.5 text-[#3fb950]" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-[#161b22] border border-[#30363d]">
        <div className="space-y-0.5">
          <div className="text-xs font-mono font-bold text-[#e6edf3] flex items-center space-x-1.5 uppercase">
            <History className="w-4 h-4 text-[#3fb950]" />
            <span>Persistent Engineering History & Longitudinal Trends</span>
          </div>
          <p className="text-[11px] font-mono text-[#8b949e]">
            {records.length} analyzed snapshot{records.length === 1 ? '' : 's'} recorded · 100% deterministic local-first store (₹0)
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {records.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="px-2.5 py-1 rounded bg-[#21262d] border border-[#30363d] text-xs font-mono text-[#8b949e] hover:text-[#f85149] transition-colors"
              title="Clear all stored history records"
            >
              Clear History
            </button>
          )}
          <button
            onClick={handleCaptureSnapshot}
            className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-mono font-semibold transition-colors shadow-sm"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Capture Analysis Snapshot</span>
          </button>
        </div>
      </div>

      {/* Capture Feedback Notification */}
      {captureFeedback && (
        <div className="p-2.5 rounded bg-[#1f6feb]/10 border border-[#1f6feb]/30 text-xs font-mono text-[#58a6ff] flex items-center justify-between">
          <span>{captureFeedback}</span>
          <button onClick={() => setCaptureFeedback(null)} className="text-[#8b949e] hover:text-[#c9d1d9]">×</button>
        </div>
      )}

      {/* 2. Longitudinal Trend Overview (Compact Cards) */}
      <div className="p-3.5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-mono font-bold text-[#e6edf3] uppercase tracking-wider flex items-center space-x-2">
            <span>Engineering Posture Trajectory</span>
            {(() => {
              const b = getTrendDirectionBadge(trends.overallDirection);
              const Icon = b.icon;
              return (
                <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded border text-[10px] font-bold ${b.bg}`}>
                  <Icon className="w-3 h-3" />
                  <span>{b.label}</span>
                </span>
              );
            })()}
          </div>
          <span className="text-[11px] font-mono text-[#8b949e]">
            Longitudinal Direction Across {trends.recordCount} Snapshots
          </span>
        </div>

        <p className="text-xs font-mono text-[#c9d1d9] bg-[#0d1117] p-2 rounded border border-[#21262d]">
          {trends.summary}
        </p>

        {/* 6 Dimension Sparkline Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* Security */}
          <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
            <div className="text-[10px] font-mono uppercase text-[#8b949e] flex items-center justify-between">
              <span>Security</span>
              <span className={trends.securityTrend.direction === 'improving' ? 'text-[#3fb950]' : trends.securityTrend.direction === 'degrading' ? 'text-[#f85149]' : 'text-[#8b949e]'}>
                {trends.securityTrend.delta > 0 ? `+${trends.securityTrend.delta}` : trends.securityTrend.delta}
              </span>
            </div>
            <div className="text-sm font-bold font-mono text-[#e6edf3]">
              {trends.securityTrend.lastValue} <span className="text-[10px] font-normal text-[#8b949e]">crit+high</span>
            </div>
            <div className="text-[10px] font-mono text-[#8b949e] truncate">
              {trends.securityTrend.direction.toUpperCase()}
            </div>
          </div>

          {/* Attack Exposure */}
          <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
            <div className="text-[10px] font-mono uppercase text-[#8b949e] flex items-center justify-between">
              <span>Attack Risk</span>
              <span className={trends.attackExposureTrend.direction === 'improving' ? 'text-[#3fb950]' : trends.attackExposureTrend.direction === 'degrading' ? 'text-[#f85149]' : 'text-[#8b949e]'}>
                {trends.attackExposureTrend.delta > 0 ? `+${trends.attackExposureTrend.delta}` : trends.attackExposureTrend.delta}
              </span>
            </div>
            <div className="text-sm font-bold font-mono text-[#e6edf3]">
              {trends.attackExposureTrend.lastValue} <span className="text-[10px] font-normal text-[#8b949e]">/100</span>
            </div>
            <div className="text-[10px] font-mono text-[#8b949e] truncate">
              {trends.attackExposureTrend.direction.toUpperCase()}
            </div>
          </div>

          {/* Architecture */}
          <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
            <div className="text-[10px] font-mono uppercase text-[#8b949e] flex items-center justify-between">
              <span>Architecture</span>
              <span className={trends.architectureTrend.direction === 'improving' ? 'text-[#3fb950]' : trends.architectureTrend.direction === 'degrading' ? 'text-[#f85149]' : 'text-[#8b949e]'}>
                {trends.architectureTrend.delta > 0 ? `+${trends.architectureTrend.delta}` : trends.architectureTrend.delta}
              </span>
            </div>
            <div className="text-sm font-bold font-mono text-[#e6edf3]">
              {trends.architectureTrend.lastValue} <span className="text-[10px] font-normal text-[#8b949e]">/100</span>
            </div>
            <div className="text-[10px] font-mono text-[#8b949e] truncate">
              {trends.architectureTrend.direction.toUpperCase()}
            </div>
          </div>

          {/* Readiness */}
          <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
            <div className="text-[10px] font-mono uppercase text-[#8b949e] flex items-center justify-between">
              <span>Readiness</span>
              <span className={trends.readinessTrend.direction === 'improving' ? 'text-[#3fb950]' : trends.readinessTrend.direction === 'degrading' ? 'text-[#f85149]' : 'text-[#8b949e]'}>
                {trends.readinessTrend.delta > 0 ? `+${trends.readinessTrend.delta}` : trends.readinessTrend.delta}
              </span>
            </div>
            <div className="text-sm font-bold font-mono text-[#e6edf3]">
              {trends.readinessTrend.lastValue} <span className="text-[10px] font-normal text-[#8b949e]">/100</span>
            </div>
            <div className="text-[10px] font-mono text-[#8b949e] truncate">
              {trends.readinessTrend.direction.toUpperCase()}
            </div>
          </div>

          {/* Testing */}
          <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
            <div className="text-[10px] font-mono uppercase text-[#8b949e] flex items-center justify-between">
              <span>Testing</span>
              <span className={trends.testingTrend.direction === 'improving' ? 'text-[#3fb950]' : trends.testingTrend.direction === 'degrading' ? 'text-[#f85149]' : 'text-[#8b949e]'}>
                {trends.testingTrend.delta > 0 ? `+${trends.testingTrend.delta}` : trends.testingTrend.delta}
              </span>
            </div>
            <div className="text-sm font-bold font-mono text-[#e6edf3]">
              {trends.testingTrend.lastValue} <span className="text-[10px] font-normal text-[#8b949e]">/100</span>
            </div>
            <div className="text-[10px] font-mono text-[#8b949e] truncate">
              {trends.testingTrend.direction.toUpperCase()}
            </div>
          </div>

          {/* Technical Debt */}
          <div className="p-2.5 rounded bg-[#0d1117] border border-[#21262d] space-y-1">
            <div className="text-[10px] font-mono uppercase text-[#8b949e] flex items-center justify-between">
              <span>Debt Health</span>
              <span className={trends.technicalDebtTrend.direction === 'improving' ? 'text-[#3fb950]' : trends.technicalDebtTrend.direction === 'degrading' ? 'text-[#f85149]' : 'text-[#8b949e]'}>
                {trends.technicalDebtTrend.delta > 0 ? `+${trends.technicalDebtTrend.delta}` : trends.technicalDebtTrend.delta}
              </span>
            </div>
            <div className="text-sm font-bold font-mono text-[#e6edf3]">
              {trends.technicalDebtTrend.lastValue} <span className="text-[10px] font-normal text-[#8b949e]">/100</span>
            </div>
            <div className="text-[10px] font-mono text-[#8b949e] truncate">
              {trends.technicalDebtTrend.direction.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Historical Comparison (Baseline vs Current) */}
      {comparison && baselineRecord && currentRecord && (
        <div className="p-3.5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-mono font-bold text-[#e6edf3] uppercase tracking-wider">
              Historical Delta Evaluation
            </div>
            {(() => {
              const b = getVerdictBadge(comparison.verdict);
              const Icon = b.icon;
              return (
                <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded border text-xs font-bold ${b.bg}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{b.label}</span>
                </span>
              );
            })()}
          </div>

          <p className="text-xs font-mono text-[#8b949e]">
            {comparison.verdictExplanation}
          </p>

          {/* Comparison Selector Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 rounded bg-[#0d1117] border border-[#21262d]">
            <div>
              <label className="text-[10px] font-mono text-[#8b949e] uppercase block mb-1">
                Baseline Snapshot:
              </label>
              <select
                value={selectedBaselineId}
                onChange={(e) => setSelectedBaselineId(e.target.value)}
                className="w-full p-1.5 rounded bg-[#161b22] border border-[#30363d] text-[#c9d1d9] font-mono text-xs focus:outline-none"
              >
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.timestamp).toLocaleDateString()} · {r.revisionIdentity} ({r.source})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-[#8b949e] uppercase block mb-1">
                Current Snapshot:
              </label>
              <select
                value={selectedCurrentId}
                onChange={(e) => setSelectedCurrentId(e.target.value)}
                className="w-full p-1.5 rounded bg-[#161b22] border border-[#30363d] text-[#c9d1d9] font-mono text-xs focus:outline-none"
              >
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.timestamp).toLocaleDateString()} · {r.revisionIdentity} ({r.source})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
            {/* Security Findings */}
            <div className="p-2 rounded bg-[#0d1117] border border-[#21262d]">
              <div className="text-[10px] text-[#8b949e] uppercase">Critical Risks</div>
              <div className="text-[#e6edf3] font-bold">
                {baselineRecord.validation.criticalCount} → {currentRecord.validation.criticalCount}
              </div>
              <div className={comparison.securityDelta.criticalDelta > 0 ? 'text-[#f85149]' : comparison.securityDelta.criticalDelta < 0 ? 'text-[#3fb950]' : 'text-[#8b949e]'}>
                {comparison.securityDelta.criticalDelta > 0 ? `+${comparison.securityDelta.criticalDelta}` : comparison.securityDelta.criticalDelta} delta
              </div>
            </div>

            {/* Attack Exposure */}
            <div className="p-2 rounded bg-[#0d1117] border border-[#21262d]">
              <div className="text-[10px] text-[#8b949e] uppercase">Attack Paths</div>
              <div className="text-[#e6edf3] font-bold">
                {baselineRecord.attackPath?.pathCount ?? '—'} → {currentRecord.attackPath?.pathCount ?? '—'}
              </div>
              <div className={comparison.attackExposureDelta.pathCountDelta > 0 ? 'text-[#f85149]' : comparison.attackExposureDelta.pathCountDelta < 0 ? 'text-[#3fb950]' : 'text-[#8b949e]'}>
                {comparison.attackExposureDelta.pathCountDelta > 0 ? `+${comparison.attackExposureDelta.pathCountDelta}` : comparison.attackExposureDelta.pathCountDelta} delta
              </div>
            </div>

            {/* Architecture Quality */}
            <div className="p-2 rounded bg-[#0d1117] border border-[#21262d]">
              <div className="text-[10px] text-[#8b949e] uppercase">Architecture</div>
              <div className="text-[#e6edf3] font-bold">
                {baselineRecord.architecture?.score ?? '—'} → {currentRecord.architecture?.score ?? '—'}
              </div>
              <div className={comparison.architectureDelta.scoreDelta > 0 ? 'text-[#3fb950]' : comparison.architectureDelta.scoreDelta < 0 ? 'text-[#f85149]' : 'text-[#8b949e]'}>
                {comparison.architectureDelta.scoreDelta > 0 ? `+${comparison.architectureDelta.scoreDelta}` : comparison.architectureDelta.scoreDelta} delta
              </div>
            </div>

            {/* Readiness */}
            <div className="p-2 rounded bg-[#0d1117] border border-[#21262d]">
              <div className="text-[10px] text-[#8b949e] uppercase">Readiness</div>
              <div className="text-[#e6edf3] font-bold">
                {baselineRecord.readiness?.score ?? '—'} → {currentRecord.readiness?.score ?? '—'}
              </div>
              <div className={comparison.readinessDelta.scoreDelta > 0 ? 'text-[#3fb950]' : comparison.readinessDelta.scoreDelta < 0 ? 'text-[#f85149]' : 'text-[#8b949e]'}>
                {comparison.readinessDelta.scoreDelta > 0 ? `+${comparison.readinessDelta.scoreDelta}` : comparison.readinessDelta.scoreDelta} delta
              </div>
            </div>

            {/* Testing */}
            <div className="p-2 rounded bg-[#0d1117] border border-[#21262d]">
              <div className="text-[10px] text-[#8b949e] uppercase">Testing Score</div>
              <div className="text-[#e6edf3] font-bold">
                {baselineRecord.testing?.score ?? '—'} → {currentRecord.testing?.score ?? '—'}
              </div>
              <div className={comparison.testingDelta.scoreDelta > 0 ? 'text-[#3fb950]' : comparison.testingDelta.scoreDelta < 0 ? 'text-[#f85149]' : 'text-[#8b949e]'}>
                {comparison.testingDelta.scoreDelta > 0 ? `+${comparison.testingDelta.scoreDelta}` : comparison.testingDelta.scoreDelta} delta
              </div>
            </div>

            {/* Technical Debt */}
            <div className="p-2 rounded bg-[#0d1117] border border-[#21262d]">
              <div className="text-[10px] text-[#8b949e] uppercase">Debt Health</div>
              <div className="text-[#e6edf3] font-bold">
                {baselineRecord.technicalDebt?.score ?? '—'} → {currentRecord.technicalDebt?.score ?? '—'}
              </div>
              <div className={comparison.technicalDebtDelta.scoreDelta > 0 ? 'text-[#3fb950]' : comparison.technicalDebtDelta.scoreDelta < 0 ? 'text-[#f85149]' : 'text-[#8b949e]'}>
                {comparison.technicalDebtDelta.scoreDelta > 0 ? `+${comparison.technicalDebtDelta.scoreDelta}` : comparison.technicalDebtDelta.scoreDelta} delta
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Chronological History Timeline */}
      <div className="p-3.5 rounded-lg bg-[#161b22] border border-[#30363d] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-mono font-bold text-[#e6edf3] uppercase tracking-wider flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#58a6ff]" />
            <span>Analysis Timeline (Newest to Oldest)</span>
          </div>
          <span className="text-[11px] font-mono text-[#8b949e]">
            {records.length} Recorded Snapshot{records.length === 1 ? '' : 's'}
          </span>
        </div>

        {records.length === 0 ? (
          <div className="p-6 text-center bg-[#0d1117] border border-[#21262d] rounded space-y-2">
            <History className="w-8 h-8 text-[#8b949e] mx-auto opacity-50" />
            <div className="text-xs font-mono text-[#e6edf3]">No Historical Snapshots Recorded</div>
            <p className="text-[11px] font-mono text-[#8b949e] max-w-sm mx-auto">
              Click &quot;Capture Analysis Snapshot&quot; above to persist the current environment state into the local timeline.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div
                key={r.id}
                className={`p-3 rounded-lg border transition-all ${
                  r.id === selectedCurrentId
                    ? 'bg-[#1c2128] border-[#58a6ff]'
                    : r.id === selectedBaselineId
                    ? 'bg-[#1c2128] border-[#3fb950]'
                    : 'bg-[#0d1117] border-[#21262d] hover:border-[#30363d]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center space-x-2">
                    {getSourceIcon(r.source)}
                    <span className="font-bold text-[#e6edf3]">
                      {new Date(r.timestamp).toLocaleDateString()} {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#21262d] text-[#c9d1d9] text-[10px] uppercase font-bold border border-[#30363d]">
                      {r.source}
                    </span>
                    <span className="text-[#8b949e] text-[11px]">
                      rev: <code className="text-[#58a6ff]">{r.revisionIdentity.slice(0, 10)}</code>
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {r.id !== selectedBaselineId && (
                      <button
                        onClick={() => setSelectedBaselineId(r.id)}
                        className="px-2 py-0.5 rounded bg-[#21262d] text-[#8b949e] hover:text-[#3fb950] border border-[#30363d] text-[10px]"
                        title="Set as baseline for historical comparison"
                      >
                        Set Baseline
                      </button>
                    )}
                    {r.id !== selectedCurrentId && (
                      <button
                        onClick={() => setSelectedCurrentId(r.id)}
                        className="px-2 py-0.5 rounded bg-[#21262d] text-[#8b949e] hover:text-[#58a6ff] border border-[#30363d] text-[10px]"
                        title="Set as current for historical comparison"
                      >
                        Set Current
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteRecord(r.id)}
                      className="p-1 rounded text-[#8b949e] hover:text-[#f85149] transition-colors"
                      title="Delete record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Metric Summary Badges */}
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-[#21262d] text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-[#8b949e]">
                    <span className="text-[#e6edf3] font-bold">Nodes:</span> {r.topology.nodeCount}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-[#8b949e]">
                    <span className="text-[#f85149] font-bold">Crit:</span> {r.validation.criticalCount}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-[#8b949e]">
                    <span className="text-[#f0883e] font-bold">High:</span> {r.validation.highCount}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-[#8b949e]">
                    <span className="text-[#3fb950] font-bold">Readiness:</span> {r.readiness?.score ?? '—'}/100
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-[#8b949e]">
                    <span className="text-[#e3b341] font-bold">Debt:</span> {r.technicalDebt?.score ?? '—'}/100
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#21262d] text-[#8b949e]">
                    <span className="text-[#58a6ff] font-bold">Risk:</span> {r.attackPath?.highestRiskScore ?? '—'}
                  </span>
                  <span className="ml-auto text-[10px] text-[#8b949e] truncate max-w-[200px]">
                    ID: {r.id}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
