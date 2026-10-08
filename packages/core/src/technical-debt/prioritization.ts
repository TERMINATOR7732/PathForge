import {
  DebtCategory,
  DebtPriority,
  DebtRating,
  DebtSeverity,
  PriorityFactor,
  TechnicalDebtItem,
  TechnicalDebtSummary,
} from './types.js';

export interface PrioritizationInput {
  severity: DebtSeverity;
  category: DebtCategory;
  hasCriticalAsset: boolean;
  hasSensitiveAsset: boolean;
  reachableFromUntrustedIngress: boolean;
  affectedComponentsCount: number;
  isCriticalPropertyUnverified: boolean;
  isHighPropertyUnverified: boolean;
}

export interface PrioritizationResult {
  score: number;
  priority: DebtPriority;
  factors: PriorityFactor[];
}

/**
 * Deterministically maps an aggregate overall debt score (0-100) to qualitative rating.
 * 90–100 → LOW_DEBT
 * 75–89  → MANAGEABLE
 * 50–74  → ELEVATED
 * 25–49  → HIGH
 * 0–24   → SEVERE
 */
export function getDebtRating(overallScore: number): DebtRating {
  if (overallScore >= 90) {
    return 'LOW_DEBT';
  }
  if (overallScore >= 75) {
    return 'MANAGEABLE';
  }
  if (overallScore >= 50) {
    return 'ELEVATED';
  }
  if (overallScore >= 25) {
    return 'HIGH';
  }
  return 'SEVERE';
}

/**
 * Deterministically calculates a transparent 0-100 priority score and priority level
 * for a technical debt item based on observable architectural facts.
 */
export function calculateDebtPriority(input: PrioritizationInput): PrioritizationResult {
  const factors: PriorityFactor[] = [];
  let score = 0;

  // 1. Severity points
  switch (input.severity) {
    case 'CRITICAL':
      score += 40;
      factors.push({ id: 'sev-crit', label: 'Critical severity impact', points: 40 });
      break;
    case 'HIGH':
      score += 30;
      factors.push({ id: 'sev-high', label: 'High severity impact', points: 30 });
      break;
    case 'MEDIUM':
      score += 20;
      factors.push({ id: 'sev-med', label: 'Medium severity impact', points: 20 });
      break;
    case 'LOW':
    default:
      score += 10;
      factors.push({ id: 'sev-low', label: 'Low severity impact', points: 10 });
      break;
  }

  // 2. Security impact on critical or sensitive assets
  if (input.hasCriticalAsset) {
    score += 20;
    factors.push({ id: 'asset-crit', label: 'Directly impacts critical crown jewel asset', points: 20 });
  } else if (input.hasSensitiveAsset) {
    score += 10;
    factors.push({ id: 'asset-sens', label: 'Impacts sensitive data tier asset', points: 10 });
  }

  // 3. Reachability from untrusted ingress
  if (input.reachableFromUntrustedIngress) {
    score += 20;
    factors.push({ id: 'reach-untrusted', label: 'Traversable from untrusted ingress entry point', points: 20 });
  } else {
    score += 5;
    factors.push({ id: 'reach-internal', label: 'Internal component reachability', points: 5 });
  }

  // 4. Architectural scope
  if (input.affectedComponentsCount > 1) {
    score += 10;
    factors.push({ id: 'scope-multi', label: 'Cross-cutting impact on multiple components', points: 10 });
  } else if (input.affectedComponentsCount === 1) {
    score += 5;
    factors.push({ id: 'scope-single', label: 'Isolated to single component', points: 5 });
  }

  // 5. Verification gap
  if (input.isCriticalPropertyUnverified) {
    score += 10;
    factors.push({ id: 'gap-crit', label: 'Underlying critical security property unverified', points: 10 });
  } else if (input.isHighPropertyUnverified) {
    score += 5;
    factors.push({ id: 'gap-high', label: 'Underlying high-importance property unverified', points: 5 });
  }

  // Clamp to 0-100
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  // Map to priority tier
  let priority: DebtPriority;
  if (finalScore >= 80) {
    priority = 'P0';
  } else if (finalScore >= 60) {
    priority = 'P1';
  } else if (finalScore >= 35) {
    priority = 'P2';
  } else {
    priority = 'P3';
  }

  return {
    score: finalScore,
    priority,
    factors,
  };
}

/**
 * Deterministically sorts technical debt items:
 * 1. Priority score descending
 * 2. Severity rank descending (CRITICAL -> HIGH -> MEDIUM -> LOW)
 * 3. Category alphabetical
 * 4. Debt ID alphabetical
 */
export function sortDebtItems(items: readonly TechnicalDebtItem[]): TechnicalDebtItem[] {
  const severityRank: Record<DebtSeverity, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  return [...items].sort((a, b) => {
    // 1. Priority score descending
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }

    // 2. Severity rank descending
    const rankDiff = severityRank[b.severity] - severityRank[a.severity];
    if (rankDiff !== 0) {
      return rankDiff;
    }

    // 3. Category alphabetical
    const catDiff = a.category.localeCompare(b.category);
    if (catDiff !== 0) {
      return catDiff;
    }

    // 4. Debt ID alphabetical
    return a.id.localeCompare(b.id);
  });
}

/**
 * Deterministically computes aggregate score, ratings, and count breakdowns
 * for a set of technical debt items.
 */
export function calculateDebtSummary(
  items: readonly TechnicalDebtItem[],
  isSparse = false
): TechnicalDebtSummary {
  const activeItems = items.filter((i) => i.status === 'ACTIVE');
  const mitigatedItems = items.filter((i) => i.status === 'MITIGATED');
  const unverifiedItems = items.filter((i) => i.status === 'UNVERIFIED');

  const byCategory: Record<DebtCategory, number> = {
    'security-debt': 0,
    'architecture-debt': 0,
    'resilience-debt': 0,
    'access-control-debt': 0,
    'testing-debt': 0,
    'operational-debt': 0,
    'complexity-debt': 0,
  };

  for (const item of activeItems) {
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  }

  let p0Count = 0;
  let p1Count = 0;
  let p2Count = 0;
  let p3Count = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const item of activeItems) {
    if (item.priority === 'P0') p0Count++;
    else if (item.priority === 'P1') p1Count++;
    else if (item.priority === 'P2') p2Count++;
    else p3Count++;

    if (item.severity === 'CRITICAL') criticalCount++;
    else if (item.severity === 'HIGH') highCount++;
    else if (item.severity === 'MEDIUM') mediumCount++;
    else lowCount++;
  }

  // Calculate overall score (100 = minimal debt, 0 = severe debt)
  let overallScore = 100;

  if (isSparse) {
    overallScore = 100;
  } else {
    let deductions = 0;
    // Deductions from active items by priority
    deductions += p0Count * 18;
    deductions += p1Count * 10;
    deductions += p2Count * 5;
    deductions += p3Count * 2;

    // Small deduction from unverified items (capped at 10)
    const unverifiedDeduction = Math.min(10, unverifiedItems.length * 1.5);
    deductions += unverifiedDeduction;

    overallScore = Math.max(0, Math.min(100, Math.round(100 - deductions)));
  }

  // Determine qualitative debt rating
  const rating: DebtRating = getDebtRating(overallScore);

  const sortedActive = sortDebtItems(activeItems);
  const topPriorities = sortedActive.slice(0, 5);

  return {
    overallScore,
    rating,
    totalItems: items.length,
    activeCount: activeItems.length,
    mitigatedCount: mitigatedItems.length,
    unverifiedCount: unverifiedItems.length,
    p0Count,
    p1Count,
    p2Count,
    p3Count,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    byCategory,
    topPriorities,
  };
}
