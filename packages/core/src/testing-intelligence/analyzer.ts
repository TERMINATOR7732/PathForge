import { Environment } from '../domain/environment.js';
import { analyzeAttackPaths } from '../attack-path/analyzer.js';
import { analyzeArchitecture } from '../architecture/analyzer.js';
import { evaluatePropertyCoverage } from './coverage.js';
import { evaluateRegressionIntelligence } from './regressions.js';
import type {
  CategoryCoverageSummary,
  CoverageGap,
  CoverageLevel,
  PropertyCategory,
  TestingCoverageSummary,
  TestingIntelligenceOptions,
  TestingIntelligenceResult,
} from './types.js';

const CATEGORY_NAMES: Record<PropertyCategory, string> = {
  'network-security': 'Network Security',
  'communication-security': 'Communication Security',
  'access-control': 'Access Control',
  'attack-resistance': 'Attack Resistance',
  architecture: 'Architecture Integrity',
  remediation: 'Remediation & Regressions',
};

const CATEGORY_ORDER: readonly PropertyCategory[] = [
  'network-security',
  'communication-security',
  'access-control',
  'attack-resistance',
  'architecture',
  'remediation',
];

/**
 * Deterministically analyzes the verification and test coverage of an infrastructure
 * model, evaluating whether security and architectural assumptions are backed by evidence.
 */
export function assessTestingIntelligence(
  environment: Environment,
  options: TestingIntelligenceOptions = {}
): TestingIntelligenceResult {
  const analyzedAt = options.analyzedAt ?? new Date().toISOString();
  const nodes = environment.getNodes();
  const isSparse = nodes.length <= 1;

  // 1. Compose or run underlying domain analyses
  const validationResult = options.validationResult ?? null;
  const attackPathAnalysis =
    options.attackPathAnalysis ?? analyzeAttackPaths(environment);
  const architectureAnalysis =
    options.architectureAnalysis ?? analyzeArchitecture(environment);
  const blastRadiusAnalysis = options.blastRadiusAnalysis ?? null;
  const fixVerification = options.fixVerification ?? null;
  const scenarioId = options.scenarioId ?? null;

  // 2. Evaluate Property Coverage
  const properties = evaluatePropertyCoverage({
    environment,
    validationResult,
    attackPathAnalysis,
    architectureAnalysis,
    blastRadiusAnalysis,
    fixVerification,
    scenarioId,
  });

  const verifiedProperties = properties.filter((p) => p.status === 'VERIFIED');
  const partialProperties = properties.filter((p) => p.status === 'PARTIAL');
  const unverifiedProperties = properties.filter((p) => p.status === 'UNVERIFIED');

  // 3. Compute Weighting and Coverage Scores
  let totalWeight = 0;
  let earnedWeight = 0;

  let criticalTotalWeight = 0;
  let criticalEarnedWeight = 0;

  let highTotalWeight = 0;
  let highEarnedWeight = 0;

  let normalTotalWeight = 0;
  let normalEarnedWeight = 0;

  for (const p of properties) {
    totalWeight += p.weight;
    earnedWeight += p.scoreContribution;

    if (p.property.importance === 'critical') {
      criticalTotalWeight += p.weight;
      criticalEarnedWeight += p.scoreContribution;
    } else if (p.property.importance === 'high') {
      highTotalWeight += p.weight;
      highEarnedWeight += p.scoreContribution;
    } else {
      normalTotalWeight += p.weight;
      normalEarnedWeight += p.scoreContribution;
    }
  }

  const score = isSparse
    ? 0
    : totalWeight > 0
    ? Math.round((earnedWeight / totalWeight) * 100)
    : 0;

  const criticalCoverage = isSparse
    ? 0
    : criticalTotalWeight > 0
    ? Math.round((criticalEarnedWeight / criticalTotalWeight) * 100)
    : 100;

  const highCoverage = isSparse
    ? 0
    : highTotalWeight > 0
    ? Math.round((highEarnedWeight / highTotalWeight) * 100)
    : 100;

  const normalCoverage = isSparse
    ? 0
    : normalTotalWeight > 0
    ? Math.round((normalEarnedWeight / normalTotalWeight) * 100)
    : 100;

  const overallCoverage = score;

  // 4. Determine Qualitative Coverage Level
  let level: CoverageLevel;
  if (isSparse || score < 25) {
    level = 'INSUFFICIENT';
  } else if (score < 50) {
    level = 'WEAK';
  } else if (score < 75) {
    level = 'MODERATE';
  } else if (score < 90) {
    level = 'GOOD';
  } else {
    level = 'EXCELLENT';
  }

  // 5. Category Coverage Summaries
  const categories: CategoryCoverageSummary[] = CATEGORY_ORDER.map((catKey) => {
    const catProps = properties.filter((p) => p.property.category === catKey);
    let catTotalWeight = 0;
    let catEarnedWeight = 0;
    let catVerified = 0;
    let catPartial = 0;
    let catUnverified = 0;

    for (const p of catProps) {
      catTotalWeight += p.weight;
      catEarnedWeight += p.scoreContribution;
      if (p.status === 'VERIFIED') catVerified++;
      else if (p.status === 'PARTIAL') catPartial++;
      else catUnverified++;
    }

    const catScore = isSparse
      ? 0
      : catTotalWeight > 0
      ? Math.round((catEarnedWeight / catTotalWeight) * 100)
      : 0;

    return {
      category: catKey,
      name: CATEGORY_NAMES[catKey],
      score: catScore,
      totalProperties: catProps.length,
      verified: catVerified,
      partial: catPartial,
      unverified: catUnverified,
    };
  });

  // 6. Build Coverage Gaps
  const gaps: CoverageGap[] = [];
  for (const p of properties) {
    if (p.status === 'VERIFIED') continue;

    // Severity mapping
    let severity: 'critical' | 'high' | 'medium' | 'low';
    if (p.status === 'UNVERIFIED') {
      if (p.property.importance === 'critical') severity = 'high';
      else if (p.property.importance === 'high') severity = 'medium';
      else severity = 'low';
    } else {
      // PARTIAL status
      if (p.property.importance === 'critical') severity = 'medium';
      else severity = 'low';
    }

    gaps.push({
      id: `GAP-${p.property.id}`,
      propertyId: p.property.id,
      severity,
      title: `${p.property.name} ${p.status === 'UNVERIFIED' ? 'Unverified' : 'Partially Verified'}`,
      whyItMatters: p.notes || p.property.description,
      recommendedTest: p.property.verificationStrategy,
      relatedNodeIds: p.affectedNodeIds.slice().sort(),
      relatedEdgeIds: p.affectedEdgeIds.slice().sort(),
    });
  }

  // Sort gaps deterministically: severity (high -> medium -> low), then propertyId
  const severityRank: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  gaps.sort((a, b) => {
    const rankDiff = (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0);
    if (rankDiff !== 0) return rankDiff;
    return a.propertyId.localeCompare(b.propertyId);
  });

  // 7. Deterministic Recommendations
  const recommendationsSet = new Set<string>();
  for (const gap of gaps) {
    recommendationsSet.add(gap.recommendedTest);
  }
  const recommendations = Array.from(recommendationsSet);

  // 8. Regression Intelligence
  const regressions = evaluateRegressionIntelligence(fixVerification);

  // 9. Summary String
  const summary = isSparse
    ? 'Empty or single-node topology has insufficient modeled components to establish verification coverage.'
    : `Model verification coverage is ${level} (${score}/100) across ${properties.length} security properties: ${verifiedProperties.length} verified, ${partialProperties.length} partial, and ${unverifiedProperties.length} unverified assumptions.`;

  const coverage: TestingCoverageSummary = {
    totalProperties: properties.length,
    verifiedProperties: verifiedProperties.length,
    partialProperties: partialProperties.length,
    unverifiedProperties: unverifiedProperties.length,
    criticalCoverage,
    highCoverage,
    normalCoverage,
    overallCoverage,
  };

  return {
    environmentId: environment.id,
    analyzedAt,
    score,
    level,
    summary,
    coverage,
    categories,
    properties,
    verifiedProperties,
    partialProperties,
    unverifiedProperties,
    gaps,
    recommendations,
    regressions,
  };
}
