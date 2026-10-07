import { Environment } from '../domain/environment.js';
import { analyzeAttackPaths } from '../attack-path/analyzer.js';
import { analyzeArchitecture } from '../architecture/analyzer.js';
import { assessProductionReadiness } from '../production-readiness/analyzer.js';
import { assessTestingIntelligence } from '../testing-intelligence/analyzer.js';
import { detectTechnicalDebt } from './detectors.js';
import { calculateDebtSummary, sortDebtItems } from './prioritization.js';
import {
  TechnicalDebtAssessment,
  TechnicalDebtOptions,
} from './types.js';

/**
 * Deterministically evaluates accumulated technical debt, structural fragility,
 * access-control compromises, and testing gaps in a modeled infrastructure environment.
 */
export function assessTechnicalDebt(
  environment: Environment,
  options: TechnicalDebtOptions = {}
): TechnicalDebtAssessment {
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

  const productionReadiness =
    options.productionReadiness !== undefined
      ? options.productionReadiness
      : !isSparse
      ? assessProductionReadiness(environment, {
          validationResult,
          attackPathAnalysis,
          architectureAnalysis,
          blastRadiusAnalysis,
          fixVerification,
        })
      : null;

  const testingIntelligence =
    options.testingIntelligence !== undefined
      ? options.testingIntelligence
      : !isSparse
      ? assessTestingIntelligence(environment, {
          validationResult,
          attackPathAnalysis,
          architectureAnalysis,
          blastRadiusAnalysis,
          fixVerification,
          scenarioId,
        })
      : null;

  // 2. Detect technical debt items from existing evidence
  const rawItems = detectTechnicalDebt({
    environment,
    validationResult,
    attackPathAnalysis,
    architectureAnalysis,
    blastRadiusAnalysis,
    productionReadiness,
    testingIntelligence,
    fixVerification,
    scenarioId,
  });

  // 3. Deterministically sort items
  const sortedItems = sortDebtItems(rawItems);
  const activeItems = sortedItems.filter((i) => i.status === 'ACTIVE');
  const mitigatedItems = sortedItems.filter((i) => i.status === 'MITIGATED');
  const unverifiedItems = sortedItems.filter((i) => i.status === 'UNVERIFIED');

  // 4. Compute aggregate summary
  const summary = calculateDebtSummary(sortedItems, isSparse);

  // 5. Build prioritized unique recommendations
  const recsSet = new Set<string>();
  for (const item of activeItems) {
    if (item.recommendation) {
      recsSet.add(item.recommendation);
    }
  }
  const recommendations = Array.from(recsSet);

  return {
    environmentId: environment.id,
    analyzedAt,
    summary,
    items: sortedItems,
    activeItems,
    mitigatedItems,
    unverifiedItems,
    recommendations,
  };
}
