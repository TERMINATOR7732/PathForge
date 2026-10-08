import { CiGateResult } from './types.js';

/**
 * Redacts any potential secrets, API keys, and authorization tokens.
 */
function sanitizeTokens(text: string): string {
  return text
    .replace(/(ghp_[a-zA-Z0-9]{20,})/g, 'ghp_***REDACTED***')
    .replace(/(gho_[a-zA-Z0-9]{20,})/g, 'gho_***REDACTED***')
    .replace(/(Bearer\s+)[a-zA-Z0-9._~+/-]{15,}/gi, '$1***REDACTED***')
    .replace(/(sk-[a-zA-Z0-9]{20,})/g, 'sk-***REDACTED***')
    .replace(/(AKIA[0-9A-Z]{16})/g, 'AKIA***REDACTED***')
    .replace(/(:\/\/[^:]+:)[^@]+(@)/g, '$1***REDACTED***$2');
}

/**
 * Formats a CI gate result into deterministic, machine-readable JSON.
 * Guarantees secret scrubbing and stable schema versioning.
 */
export function formatCiGateJson(result: CiGateResult): string {
  const jsonString = JSON.stringify(result, null, 2);
  return sanitizeTokens(jsonString);
}

/**
 * Formats a CI gate result into a clean, human-readable terminal output.
 * Follows technical restraint: no decorative emojis, clean alignment, explicit exit code.
 */
export function formatCiGateHuman(result: CiGateResult): string {
  const lines: string[] = [];
  const divider = '─'.repeat(54);

  lines.push('PATHFORGE ENGINEERING GATE');
  lines.push(divider);

  // Target Information
  lines.push(`Target:          ${result.target.identifier}`);
  lines.push(`Environment:     ${result.target.environmentName} (${result.target.environmentId})`);
  if (result.target.revision) {
    lines.push(`Revision:        ${result.target.revision}`);
  }
  if (result.target.branch) {
    lines.push(`Branch:          ${result.target.branch}`);
  }

  lines.push('');
  lines.push(`STATUS:          ${result.status}`);
  lines.push(`Score:           ${result.score}/100`);
  lines.push(`Exit Code:       ${result.exitCode}`);

  // Blocking Reasons Section
  if (result.blockingReasons.length > 0) {
    lines.push('');
    lines.push('Blocking Reasons');
    lines.push(divider);
    for (const reason of result.blockingReasons) {
      const sevBadge = reason.severity.toUpperCase().padEnd(8);
      lines.push(`${sevBadge} [${reason.category}] ${reason.title}`);
      lines.push(`          ${reason.description}`);
      if (reason.evidence && reason.evidence.length > 0) {
        for (const ev of reason.evidence.slice(0, 3)) {
          lines.push(`          ▸ ${ev}`);
        }
      }
    }
  }

  // Warnings Section
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings');
    lines.push(divider);
    for (const warning of result.warnings) {
      const sevBadge = warning.severity.toUpperCase().padEnd(8);
      lines.push(`${sevBadge} [${warning.category}] ${warning.title}`);
      lines.push(`          ${warning.description}`);
    }
  }

  // Passed Controls Section (Top 5)
  if (result.passedControls.length > 0) {
    lines.push('');
    lines.push(`Passed Controls (${result.passedControls.length})`);
    lines.push(divider);
    for (const ctrl of result.passedControls.slice(0, 5)) {
      lines.push(`PASSED   [${ctrl.category}] ${ctrl.name}`);
    }
    if (result.passedControls.length > 5) {
      lines.push(`         ... and ${result.passedControls.length - 5} more verified controls`);
    }
  }

  // Evidence Gaps Section (Unverified Controls)
  if (result.evidenceGaps.length > 0) {
    lines.push('');
    lines.push('Evidence Gaps (Unverified Operational Controls)');
    lines.push(divider);
    for (const gap of result.evidenceGaps.slice(0, 4)) {
      lines.push(`UNVERIF  ${gap.title}`);
      lines.push(`         ${gap.description}`);
    }
  }

  // Evidence Summary
  lines.push('');
  lines.push('Evidence Summary');
  lines.push(divider);
  lines.push(
    `Security Findings:       ${result.summary.securityFindings.critical} critical / ${result.summary.securityFindings.high} high / ${result.summary.securityFindings.medium} medium`
  );
  lines.push(
    `Attack Paths:            ${result.summary.attackPathsCount} total (${result.summary.criticalAttackPathsCount} critical)`
  );
  lines.push(`Architecture Score:      ${result.summary.architectureScore}/100`);
  lines.push(
    `Production Readiness:    ${result.summary.readinessStatus} (${result.summary.readinessScore}/100)`
  );
  lines.push(`Technical Debt:          ${result.summary.debtRating} (${result.summary.debtScore}/100)`);
  if (result.summary.testingCoveragePercent !== undefined) {
    lines.push(`Testing Coverage:        ${result.summary.testingCoveragePercent}%`);
  }
  lines.push(`Baseline Compared:       ${result.summary.baselineAvailable ? 'YES' : 'NO'}`);
  lines.push(
    `Regression Detected:     ${result.summary.regressionDetected ? 'YES (SECURITY DEGRADATION)' : 'NO'}`
  );

  lines.push(divider);
  lines.push(`Engineering Gate: ${result.status}`);
  lines.push(`Exit code: ${result.exitCode}`);

  const output = lines.join('\n');
  return sanitizeTokens(output);
}
