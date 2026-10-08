import { ValidationResult } from '@pathforge/shared';
import { Environment } from '../domain/environment.js';
import { EnvironmentSnapshot } from '../comparison/snapshot.js';
import { AttackPathAnalysisResult } from '../attack-path/types.js';
import { ArchitectureAnalysisResult } from '../architecture/types.js';
import { ProductionReadinessAssessment } from '../production-readiness/types.js';
import { TestingIntelligenceResult } from '../testing-intelligence/types.js';
import { TechnicalDebtAssessment } from '../technical-debt/types.js';
import { ChangeAnalysisResult } from '../change-analysis/types.js';
import {
  EngineeringHistoryRecord,
  HistoryRecordSource,
  HistorySourceIdentity,
  HistoryTopologySummary,
  HistoryValidationSummary,
  HistoryAttackPathSummary,
  HistoryArchitectureSummary,
  HistoryReadinessSummary,
  HistoryTestingSummary,
  HistoryTechnicalDebtSummary,
  HistoryChangeAnalysisSummary,
  HISTORY_SCHEMA_VERSION,
} from './types.js';
import {
  computeCanonicalTopologyHash,
  generateHistoryRecordId,
  sanitizeHistorySourcePath,
} from './identity.js';

/**
 * Input arguments for capturing a historical engineering record.
 */
export interface CaptureHistoryRecordOptions {
  readonly environment: Environment | EnvironmentSnapshot;
  readonly validationResult: ValidationResult;
  readonly source: HistoryRecordSource;
  readonly sourceIdentity?: Partial<HistorySourceIdentity>;
  readonly revisionIdentity?: string;
  readonly timestamp?: string;
  readonly attackPathAnalysis?: AttackPathAnalysisResult | null;
  readonly architectureAnalysis?: ArchitectureAnalysisResult | null;
  readonly productionReadiness?: ProductionReadinessAssessment | null;
  readonly testingIntelligence?: TestingIntelligenceResult | null;
  readonly technicalDebt?: TechnicalDebtAssessment | null;
  readonly changeAnalysis?: ChangeAnalysisResult | null;
  readonly evidenceNotes?: readonly string[];
}

/**
 * Creates an immutable historical snapshot record from current analysis state.
 *
 * TRUTHFULNESS GUARANTEE:
 * If an analysis layer is not provided, it is NOT fabricated or defaulted to 0.
 * It is left undefined and recorded as omitted evidence.
 */
export function captureEngineeringHistoryRecord(
  options: CaptureHistoryRecordOptions
): EngineeringHistoryRecord {
  const { environment, validationResult } = options;

  const envId = 'id' in environment ? environment.id : environment.environmentId;
  const envName = environment.name;

  // 1. Topology Summary
  const isDomainEnv = 'getNodes' in environment;
  const nodes = isDomainEnv ? environment.getNodes() : environment.nodes;
  const edges = isDomainEnv ? environment.getEdges() : environment.edges;

  const criticalNodeCount = (nodes as readonly any[]).filter((n) => {
    const crit = n.criticality ?? n.metadata?.criticality;
    return crit === 'critical';
  }).length;

  const internetFacingNodeCount = (nodes as readonly any[]).filter((n) => {
    const zone = n.zone ?? n.metadata?.zone;
    return n.type === 'internet' || zone === 'public';
  }).length;

  const topologySummary: HistoryTopologySummary = Object.freeze({
    nodeCount: nodes.length,
    edgeCount: edges.length,
    criticalNodeCount,
    internetFacingNodeCount,
  });

  // 2. Validation Summary
  const findingCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  validationResult.findings.forEach((f) => {
    if (f.severity in findingCounts) {
      findingCounts[f.severity as keyof typeof findingCounts]++;
    }
  });

  const sortedFindingIds = Object.freeze(
    validationResult.findings.map((f) => f.id).sort()
  );

  const validationSummary: HistoryValidationSummary = Object.freeze({
    findingCount: validationResult.findings.length,
    criticalCount: findingCounts.critical,
    highCount: findingCounts.high,
    mediumCount: findingCounts.medium,
    lowCount: findingCounts.low,
    infoCount: findingCounts.info,
    findingIds: sortedFindingIds,
  });

  // 3. Attack Path Summary (if available)
  let attackPathSummary: HistoryAttackPathSummary | undefined = undefined;
  if (options.attackPathAnalysis) {
    const ap = options.attackPathAnalysis;
    attackPathSummary = Object.freeze({
      pathCount: ap.summary.attackPathCount,
      criticalPathCount: ap.intelligence.criticalAttackPaths,
      highRiskPathCount: ap.intelligence.highRiskAttackPaths,
      highestRiskScore: ap.intelligence.mostDangerousPath?.riskScore ?? 0,
      highestRisk: ap.summary.highestRisk,
      reachableCriticalAssets: ap.intelligence.reachableCriticalAssets,
      mostExposedAssetId: ap.intelligence.mostExposedAsset?.asset.id ?? null,
      mostExposedAssetName: ap.intelligence.mostExposedAsset?.asset.name ?? null,
    });
  }

  // 4. Architecture Summary (if available)
  let architectureSummary: HistoryArchitectureSummary | undefined = undefined;
  if (options.architectureAnalysis) {
    const arch = options.architectureAnalysis;
    architectureSummary = Object.freeze({
      score: arch.score.score,
      rating: arch.score.rating,
      segmentation: arch.profile?.segmentation ?? 'unknown',
      findingsCount: arch.findings?.length ?? 0,
    });
  }

  // 5. Production Readiness Summary (if available)
  let readinessSummary: HistoryReadinessSummary | undefined = undefined;
  if (options.productionReadiness) {
    const pr = options.productionReadiness;
    readinessSummary = Object.freeze({
      score: pr.score,
      rating: pr.rating,
      status: pr.status,
      blockedGatesCount: pr.summary.blockedGates,
      warningCount: pr.summary.warningCount,
    });
  }

  // 6. Testing Intelligence Summary (if available)
  let testingSummary: HistoryTestingSummary | undefined = undefined;
  if (options.testingIntelligence) {
    const ti = options.testingIntelligence;
    testingSummary = Object.freeze({
      score: ti.score,
      level: ti.level,
      criticalCoverage: ti.coverage.criticalCoverage,
      highCoverage: ti.coverage.highCoverage,
      unverifiedPropertiesCount: ti.coverage.unverifiedProperties,
    });
  }

  // 7. Technical Debt Summary (if available)
  let technicalDebtSummary: HistoryTechnicalDebtSummary | undefined = undefined;
  if (options.technicalDebt) {
    const td = options.technicalDebt;
    technicalDebtSummary = Object.freeze({
      score: td.summary.overallScore,
      rating: td.summary.rating,
      activeCount: td.summary.activeCount,
      p0Count: td.summary.p0Count,
      p1Count: td.summary.p1Count,
    });
  }

  // 8. Change Analysis Summary (if available)
  let changeSummary: HistoryChangeAnalysisSummary | undefined = undefined;
  if (options.changeAnalysis) {
    const ca = options.changeAnalysis;
    changeSummary = Object.freeze({
      totalChanges: ca.summary.totalChanges,
      impactLevel: ca.summary.impactLevel,
      regressionDetected: ca.summary.regressionDetected,
      risksIntroduced: ca.summary.risksIntroduced,
      risksResolved: ca.summary.risksResolved,
    });
  }

  // 9. Compute Canonical Topology Hash & Record Identity
  const canonicalTopologyHash = computeCanonicalTopologyHash(environment);

  // Normalize source identity with security sanitization
  const sourceIdentity = buildSanitizedSourceIdentity(
    options.source,
    envId,
    envName,
    options.sourceIdentity
  );

  const revisionIdentity =
    options.revisionIdentity ??
    (sourceIdentity.type === 'local-git'
      ? sourceIdentity.commitSha
      : sourceIdentity.type === 'github-pr'
      ? sourceIdentity.headSha
      : canonicalTopologyHash.slice(0, 12));

  const id = generateHistoryRecordId({
    environmentId: envId,
    source: options.source,
    revisionIdentity,
    canonicalTopologyHash,
    findingIds: sortedFindingIds,
  });

  const timestamp = options.timestamp ?? new Date().toISOString();

  const evidenceNotes: string[] = [];
  if (options.evidenceNotes) {
    evidenceNotes.push(...options.evidenceNotes);
  }
  if (!options.attackPathAnalysis) evidenceNotes.push('Attack path analysis omitted');
  if (!options.architectureAnalysis) evidenceNotes.push('Architecture analysis omitted');
  if (!options.productionReadiness) evidenceNotes.push('Production readiness omitted');
  if (!options.testingIntelligence) evidenceNotes.push('Testing intelligence omitted');
  if (!options.technicalDebt) evidenceNotes.push('Technical debt evaluation omitted');

  return Object.freeze({
    schemaVersion: HISTORY_SCHEMA_VERSION,
    id,
    environmentId: envId,
    environmentName: envName,
    timestamp,
    source: options.source,
    sourceIdentity,
    revisionIdentity,
    topology: topologySummary,
    validation: validationSummary,
    attackPath: attackPathSummary,
    architecture: architectureSummary,
    readiness: readinessSummary,
    testing: testingSummary,
    technicalDebt: technicalDebtSummary,
    changeAnalysis: changeSummary,
    evidenceNotes: Object.freeze(evidenceNotes),
  });
}

function buildSanitizedSourceIdentity(
  source: HistoryRecordSource,
  environmentId: string,
  environmentName: string,
  rawIdentity?: Partial<HistorySourceIdentity>
): HistorySourceIdentity {
  switch (source) {
    case 'local-git': {
      const gitId = rawIdentity as Partial<import('./types.js').LocalGitSourceIdentity>;
      return Object.freeze({
        type: 'local-git',
        repositoryPath: sanitizeHistorySourcePath(gitId?.repositoryPath ?? 'local-repo'),
        commitSha: gitId?.commitSha ?? 'HEAD',
        branch: gitId?.branch,
        comparisonMode: gitId?.comparisonMode,
      });
    }
    case 'github-pr': {
      const ghId = rawIdentity as Partial<import('./types.js').GitHubPrSourceIdentity>;
      return Object.freeze({
        type: 'github-pr',
        owner: ghId?.owner ?? 'unknown-owner',
        repository: ghId?.repository ?? 'unknown-repo',
        prNumber: ghId?.prNumber ?? 0,
        baseSha: ghId?.baseSha ?? '0000000000000000000000000000000000000000',
        headSha: ghId?.headSha ?? '0000000000000000000000000000000000000000',
      });
    }
    case 'scenario': {
      const scId = rawIdentity as Partial<import('./types.js').ScenarioSourceIdentity>;
      return Object.freeze({
        type: 'scenario',
        scenarioId: scId?.scenarioId ?? environmentId,
        scenarioName: scId?.scenarioName ?? environmentName,
      });
    }
    case 'manual':
    default: {
      return Object.freeze({
        type: 'manual',
        environmentId,
        name: rawIdentity?.type === 'manual' ? rawIdentity.name : environmentName,
      });
    }
  }
}
