import {
  evaluateCiGate,
  DEFAULT_CI_GATE_POLICY,
  CiGateTargetInfo,
} from '../ci-gate/index.js';
import {
  EngineeringRun,
  ExecuteEngineeringRunOptions,
  RunIntelligenceSummary,
  RunChangesSummary,
  ENGINEERING_RUN_SCHEMA_VERSION,
} from './types.js';
import { buildEvidenceLineage, buildEvidenceMatrix } from './lineage.js';
import { captureEngineeringHistoryRecord } from '../history/snapshot.js';
import { EngineeringHistoryStore, HistorySaveResult } from '../history/types.js';

/**
 * Deterministically executes a continuous engineering run across all intelligence layers and CI gate evaluation.
 */
export function executeEngineeringRun(options: ExecuteEngineeringRunOptions): EngineeringRun {
  const {
    environment,
    source,
    validationResult = null,
    attackPathAnalysis = null,
    architectureAnalysis = null,
    productionReadiness = null,
    testingIntelligence = null,
    technicalDebt = null,
    changeAnalysis = null,
    policy = DEFAULT_CI_GATE_POLICY,
    isStale = false,
    staleReason,
  } = options;

  const targetInfo: CiGateTargetInfo = {
    targetType:
      source.type === 'local-git'
        ? 'git-repository'
        : source.type === 'github-pr'
        ? 'github-pr'
        : source.type === 'scenario'
        ? 'scenario'
        : 'environment-file',
    identifier: source.identifier || environment?.name || 'unknown-environment',
    environmentId: environment?.id || 'env-unknown',
    environmentName: environment?.name || 'Unknown Environment',
    revision: source.revision,
    branch: source.branch,
  };

  const gateResult = evaluateCiGate(
    {
      target: targetInfo,
      environment,
      validationResult,
      attackPathAnalysis,
      architectureAnalysis,
      productionReadiness,
      testingIntelligence,
      technicalDebt,
      changeAnalysis,
    },
    policy
  );

  const lineageContext = {
    environment,
    gateResult,
    validationResult,
    attackPathAnalysis,
    architectureAnalysis,
    productionReadiness,
    testingIntelligence,
    technicalDebt,
    changeAnalysis,
  };

  const evidenceLineage = buildEvidenceLineage(lineageContext);
  const evidenceMatrix = buildEvidenceMatrix(lineageContext);

  // Extract top deterministic reasons for executive decision banner
  const topReasons: string[] = [];
  if (gateResult.status === 'BLOCK') {
    for (const br of gateResult.blockingReasons.slice(0, 3)) {
      topReasons.push(`${br.title}: ${br.description}`);
    }
  } else if (gateResult.status === 'WARN') {
    for (const w of gateResult.warnings.slice(0, 3)) {
      topReasons.push(`${w.title}: ${w.description}`);
    }
  } else if (gateResult.status === 'INSUFFICIENT_EVIDENCE') {
    for (const eg of gateResult.evidenceGaps.slice(0, 3)) {
      topReasons.push(`${eg.title}: ${eg.description}`);
    }
  } else {
    for (const pc of gateResult.passedControls.slice(0, 3)) {
      topReasons.push(`${pc.name}: ${pc.description}`);
    }
  }

  // Build intelligence summary
  const intelligenceSummary: RunIntelligenceSummary = {
    securityFindingsCount: validationResult?.findings.length ?? 0,
    criticalFindingsCount: validationResult?.findings.filter((f) => f.severity === 'critical').length ?? 0,
    highFindingsCount: validationResult?.findings.filter((f) => f.severity === 'high').length ?? 0,
    attackPathsCount: attackPathAnalysis?.attackPaths.length ?? 0,
    criticalAttackPathsCount:
      attackPathAnalysis?.attackPaths.filter((p) => p.risk === 'critical').length ?? 0,
    architectureScore: architectureAnalysis?.score.score ?? 100,
    readinessScore: productionReadiness?.score ?? 0,
    readinessStatus: productionReadiness?.status ?? 'UNEVALUATED',
    debtScore: technicalDebt?.summary.overallScore ?? 100,
    debtRating: technicalDebt?.summary.rating ?? 'UNRATED',
    testingCoveragePercent: testingIntelligence?.coverage.criticalCoverage ?? testingIntelligence?.coverage.overallCoverage,
    regressionDetected: Boolean(changeAnalysis?.regressionDetected),
    baselineAvailable: Boolean(changeAnalysis !== null),
  };

  // Build changes summary if change analysis is available
  let changesSummary: RunChangesSummary | undefined;
  if (changeAnalysis) {
    const topoCount = changeAnalysis.changes.length;
    changesSummary = {
      filesCount: (source.details?.filesCount as number) ?? 1,
      additions: (source.details?.additions as number) ?? 0,
      deletions: (source.details?.deletions as number) ?? 0,
      impact: changeAnalysis.summary.impactLevel.toUpperCase(),
      securitySensitiveCount: changeAnalysis.newlyIntroducedRisks.length,
      topologyChangeCount: topoCount,
    };
  }

  const runId = `run-${environment?.id || 'env'}-${Date.now()}`;
  const runStatus = isStale
    ? 'STALE'
    : gateResult.status === 'INSUFFICIENT_EVIDENCE'
    ? 'INSUFFICIENT_EVIDENCE'
    : 'CURRENT';

  return Object.freeze({
    schemaVersion: ENGINEERING_RUN_SCHEMA_VERSION,
    id: runId,
    timestamp: new Date().toISOString(),
    source,
    status: runStatus,
    environmentId: environment?.id || 'env-unknown',
    environmentName: environment?.name || 'Unknown Environment',
    compositeScore: gateResult.score,
    gateStatus: gateResult.status,
    exitCode: gateResult.exitCode,
    topReasons: Object.freeze(topReasons),
    intelligenceSummary,
    changesSummary,
    evidenceMatrix,
    evidenceLineage,
    gateResult,
    isBaselineAvailable: Boolean(changeAnalysis !== null),
    staleReason: isStale ? staleReason || 'Source or topology modified since last run' : undefined,
  });
}

/**
 * Persists an engineering run evaluation to the persistent history store.
 */
export async function captureRunToHistory(
  run: EngineeringRun,
  environment: any,
  validationResult: any,
  store: EngineeringHistoryStore,
  options?: {
    attackPathAnalysis?: any;
    architectureAnalysis?: any;
    productionReadiness?: any;
    testingIntelligence?: any;
    technicalDebt?: any;
    changeAnalysis?: any;
    notes?: string[];
  }
): Promise<HistorySaveResult> {
  const historySource =
    run.source.type === 'local-git'
      ? 'local-git'
      : run.source.type === 'github-pr'
      ? 'github-pr'
      : run.source.type === 'scenario'
      ? 'scenario'
      : 'manual';

  const historyRecord = captureEngineeringHistoryRecord({
    environment,
    validationResult,
    source: historySource,
    sourceIdentity: {
      type: historySource as any,
      ...(run.source.details ?? {}),
    },
    revisionIdentity: run.source.revision || run.source.branch || 'current',
    timestamp: run.timestamp,
    attackPathAnalysis: options?.attackPathAnalysis,
    architectureAnalysis: options?.architectureAnalysis,
    productionReadiness: options?.productionReadiness,
    testingIntelligence: options?.testingIntelligence,
    technicalDebt: options?.technicalDebt,
    changeAnalysis: options?.changeAnalysis,
    evidenceNotes: options?.notes ?? [`CI Gate Verdict: ${run.gateStatus} (exit code ${run.exitCode})`],
  });

  const saveResult = await Promise.resolve(store.save(historyRecord));
  return saveResult;
}
