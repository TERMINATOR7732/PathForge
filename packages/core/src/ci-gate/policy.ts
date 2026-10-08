import { CiGatePolicy } from './types.js';

/**
 * Conservative default policy for CI engineering gates.
 * Blocks on critical findings, critical attack paths, hard production blockers,
 * architecture criticals, critical debt, and proven topology regressions.
 */
export const DEFAULT_CI_GATE_POLICY: CiGatePolicy = Object.freeze({
  blockOnCriticalFindings: true,
  blockOnHighRiskAttackPaths: true,
  blockOnReadinessNotReady: true,
  blockOnArchitectureCritical: true,
  blockOnCriticalTechnicalDebt: true,
  blockOnRegressions: true,

  warnOnHighFindings: true,
  warnOnModerateAttackPaths: true,
  warnOnReadinessWarnings: true,
  warnOnElevatedTechnicalDebt: true,

  requireTestingEvidence: false,
  requireBaselineForRegression: false,
  allowWarnings: true,

  minReadinessScore: 60,
  minDebtScore: 40,
  maxCriticalFindingsAllowed: 0,
});

/**
 * Validates a policy object and reports any configuration errors.
 */
export function validateCiGatePolicy(raw: unknown): {
  valid: boolean;
  errors: string[];
  policy?: CiGatePolicy;
} {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      errors: ['Policy must be a non-null object'],
    };
  }

  const obj = raw as Record<string, unknown>;

  // Helper for boolean fields
  const checkBoolean = (key: string) => {
    if (key in obj && typeof obj[key] !== 'boolean') {
      errors.push(`Field '${key}' must be a boolean`);
    }
  };

  // Helper for number fields (0-100 range)
  const checkScore = (key: string) => {
    if (key in obj && obj[key] !== undefined) {
      const val = obj[key];
      if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 100) {
        errors.push(`Field '${key}' must be a number between 0 and 100`);
      }
    }
  };

  // Helper for non-negative integer fields
  const checkCount = (key: string) => {
    if (key in obj && obj[key] !== undefined) {
      const val = obj[key];
      if (typeof val !== 'number' || isNaN(val) || val < 0 || !Number.isInteger(val)) {
        errors.push(`Field '${key}' must be a non-negative integer`);
      }
    }
  };

  checkBoolean('blockOnCriticalFindings');
  checkBoolean('blockOnHighRiskAttackPaths');
  checkBoolean('blockOnReadinessNotReady');
  checkBoolean('blockOnArchitectureCritical');
  checkBoolean('blockOnCriticalTechnicalDebt');
  checkBoolean('blockOnRegressions');

  checkBoolean('warnOnHighFindings');
  checkBoolean('warnOnModerateAttackPaths');
  checkBoolean('warnOnReadinessWarnings');
  checkBoolean('warnOnElevatedTechnicalDebt');

  checkBoolean('requireTestingEvidence');
  checkBoolean('requireBaselineForRegression');
  checkBoolean('allowWarnings');

  checkScore('minReadinessScore');
  checkScore('minDebtScore');
  checkCount('maxCriticalFindingsAllowed');
  checkCount('maxHighFindingsAllowed');

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Merge with default values for unspecified fields
  const policy: CiGatePolicy = {
    blockOnCriticalFindings:
      typeof obj.blockOnCriticalFindings === 'boolean'
        ? obj.blockOnCriticalFindings
        : DEFAULT_CI_GATE_POLICY.blockOnCriticalFindings,
    blockOnHighRiskAttackPaths:
      typeof obj.blockOnHighRiskAttackPaths === 'boolean'
        ? obj.blockOnHighRiskAttackPaths
        : DEFAULT_CI_GATE_POLICY.blockOnHighRiskAttackPaths,
    blockOnReadinessNotReady:
      typeof obj.blockOnReadinessNotReady === 'boolean'
        ? obj.blockOnReadinessNotReady
        : DEFAULT_CI_GATE_POLICY.blockOnReadinessNotReady,
    blockOnArchitectureCritical:
      typeof obj.blockOnArchitectureCritical === 'boolean'
        ? obj.blockOnArchitectureCritical
        : DEFAULT_CI_GATE_POLICY.blockOnArchitectureCritical,
    blockOnCriticalTechnicalDebt:
      typeof obj.blockOnCriticalTechnicalDebt === 'boolean'
        ? obj.blockOnCriticalTechnicalDebt
        : DEFAULT_CI_GATE_POLICY.blockOnCriticalTechnicalDebt,
    blockOnRegressions:
      typeof obj.blockOnRegressions === 'boolean'
        ? obj.blockOnRegressions
        : DEFAULT_CI_GATE_POLICY.blockOnRegressions,

    warnOnHighFindings:
      typeof obj.warnOnHighFindings === 'boolean'
        ? obj.warnOnHighFindings
        : DEFAULT_CI_GATE_POLICY.warnOnHighFindings,
    warnOnModerateAttackPaths:
      typeof obj.warnOnModerateAttackPaths === 'boolean'
        ? obj.warnOnModerateAttackPaths
        : DEFAULT_CI_GATE_POLICY.warnOnModerateAttackPaths,
    warnOnReadinessWarnings:
      typeof obj.warnOnReadinessWarnings === 'boolean'
        ? obj.warnOnReadinessWarnings
        : DEFAULT_CI_GATE_POLICY.warnOnReadinessWarnings,
    warnOnElevatedTechnicalDebt:
      typeof obj.warnOnElevatedTechnicalDebt === 'boolean'
        ? obj.warnOnElevatedTechnicalDebt
        : DEFAULT_CI_GATE_POLICY.warnOnElevatedTechnicalDebt,

    requireTestingEvidence:
      typeof obj.requireTestingEvidence === 'boolean'
        ? obj.requireTestingEvidence
        : DEFAULT_CI_GATE_POLICY.requireTestingEvidence,
    requireBaselineForRegression:
      typeof obj.requireBaselineForRegression === 'boolean'
        ? obj.requireBaselineForRegression
        : DEFAULT_CI_GATE_POLICY.requireBaselineForRegression,
    allowWarnings:
      typeof obj.allowWarnings === 'boolean'
        ? obj.allowWarnings
        : DEFAULT_CI_GATE_POLICY.allowWarnings,

    minReadinessScore:
      typeof obj.minReadinessScore === 'number'
        ? obj.minReadinessScore
        : DEFAULT_CI_GATE_POLICY.minReadinessScore,
    minDebtScore:
      typeof obj.minDebtScore === 'number'
        ? obj.minDebtScore
        : DEFAULT_CI_GATE_POLICY.minDebtScore,
    maxCriticalFindingsAllowed:
      typeof obj.maxCriticalFindingsAllowed === 'number'
        ? obj.maxCriticalFindingsAllowed
        : DEFAULT_CI_GATE_POLICY.maxCriticalFindingsAllowed,
    maxHighFindingsAllowed:
      typeof obj.maxHighFindingsAllowed === 'number'
        ? obj.maxHighFindingsAllowed
        : undefined,
  };

  return { valid: true, errors: [], policy };
}

/**
 * Merges a base policy with explicit overrides.
 */
export function mergeCiGatePolicy(
  base: CiGatePolicy,
  overrides?: Partial<CiGatePolicy>
): CiGatePolicy {
  if (!overrides) return { ...base };
  return {
    ...base,
    ...overrides,
  };
}
