import { FixVerificationResult } from '../comparison/verification.js';
import { RegressionIntelligence } from './types.js';

/**
 * Deterministically evaluates regression intelligence from authoritative
 * fix verification state and baseline comparisons.
 */
export function evaluateRegressionIntelligence(
  fixVerification?: FixVerificationResult | null
): RegressionIntelligence {
  if (!fixVerification) {
    return {
      hasBaseline: false,
      baselineTimestamp: null,
      status: 'no-baseline',
      summary: 'No regression baseline available. Execute a validation and remediation cycle to establish a verification baseline.',
      resolvedPropertiesCount: 0,
      regressedPropertiesCount: 0,
      regressedFindings: [],
      remediationVerified: false,
    };
  }

  const { baselineTimestamp, resolvedFindings, newFindings } = fixVerification;

  if (newFindings.length > 0) {
    return {
      hasBaseline: true,
      baselineTimestamp,
      status: 'regressions-detected',
      summary: `Security regressions detected: ${newFindings.length} new finding(s) introduced by recent topology modifications.`,
      resolvedPropertiesCount: resolvedFindings.length,
      regressedPropertiesCount: newFindings.length,
      regressedFindings: newFindings.map((n) => n.finding.ruleId).slice().sort(),
      remediationVerified: false,
    };
  }

  if (resolvedFindings.length > 0) {
    return {
      hasBaseline: true,
      baselineTimestamp,
      status: 'healthy',
      summary: `Verification passed: ${resolvedFindings.length} finding(s) verified resolved with zero regressions introduced.`,
      resolvedPropertiesCount: resolvedFindings.length,
      regressedPropertiesCount: 0,
      regressedFindings: [],
      remediationVerified: true,
    };
  }

  return {
    hasBaseline: true,
    baselineTimestamp,
    status: 'healthy',
    summary: 'Verification baseline active. No security regressions detected in current topology.',
    resolvedPropertiesCount: 0,
    regressedPropertiesCount: 0,
    regressedFindings: [],
    remediationVerified: false,
  };
}
