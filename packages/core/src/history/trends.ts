import {
  EngineeringHistoryRecord,
  HistoryTrendMetric,
  HistoryTrendsSummary,
  TrendDirection,
} from './types.js';

/**
 * Calculates deterministic longitudinal engineering trends across chronologically ordered records.
 */
export function calculateEngineeringTrends(
  records: readonly EngineeringHistoryRecord[]
): HistoryTrendsSummary {
  // Sort records chronologically (oldest to newest)
  const sorted = [...records].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  if (sorted.length < 2) {
    return Object.freeze({
      recordCount: sorted.length,
      overallDirection: 'insufficient-data',
      securityTrend: createEmptyTrendMetric('Security Findings (Critical + High)'),
      attackExposureTrend: createEmptyTrendMetric('Attack Path Max Risk Score'),
      architectureTrend: createEmptyTrendMetric('Architecture Quality Score'),
      readinessTrend: createEmptyTrendMetric('Production Readiness Score'),
      testingTrend: createEmptyTrendMetric('Testing Intelligence Score'),
      technicalDebtTrend: createEmptyTrendMetric('Technical Debt Health Score'),
      summary:
        'At least two historical analysis records are required to calculate deterministic engineering trends.',
    });
  }

  // 1. Security Trend (Critical + High Findings, LOWER is BETTER)
  const securityTrend = computeMetricTrend(
    'Security Findings (Critical + High)',
    sorted,
    (r) => r.validation.criticalCount + r.validation.highCount,
    'lower-is-better'
  );

  // 2. Attack Exposure Trend (Max Risk Score, LOWER is BETTER)
  const attackExposureTrend = computeMetricTrend(
    'Attack Exposure Max Risk',
    sorted,
    (r) => r.attackPath?.highestRiskScore ?? 0,
    'lower-is-better'
  );

  // 3. Architecture Quality Trend (HIGHER is BETTER)
  const architectureTrend = computeMetricTrend(
    'Architecture Quality',
    sorted,
    (r) => r.architecture?.score ?? 0,
    'higher-is-better'
  );

  // 4. Production Readiness Trend (HIGHER is BETTER)
  const readinessTrend = computeMetricTrend(
    'Production Readiness',
    sorted,
    (r) => r.readiness?.score ?? 0,
    'higher-is-better'
  );

  // 5. Testing Intelligence Trend (HIGHER is BETTER)
  const testingTrend = computeMetricTrend(
    'Testing Coverage',
    sorted,
    (r) => r.testing?.score ?? 0,
    'higher-is-better'
  );

  // 6. Technical Debt Health Trend (HIGHER is BETTER: 100=clean, 0=severe)
  const technicalDebtTrend = computeMetricTrend(
    'Technical Debt Health',
    sorted,
    (r) => r.technicalDebt?.score ?? 0,
    'higher-is-better'
  );

  // Overall Direction Synthesis
  const allMetrics = [
    securityTrend,
    attackExposureTrend,
    architectureTrend,
    readinessTrend,
    testingTrend,
    technicalDebtTrend,
  ];

  let improvingCount = 0;
  let degradingCount = 0;
  let stableCount = 0;

  for (const m of allMetrics) {
    if (m.direction === 'improving') improvingCount++;
    else if (m.direction === 'degrading') degradingCount++;
    else if (m.direction === 'stable') stableCount++;
  }

  let overallDirection: TrendDirection;
  let summary: string;

  if (improvingCount > 0 && degradingCount === 0) {
    overallDirection = 'improving';
    summary = `Consistent improvement across ${improvingCount} engineering dimension(s) with zero observed regressions over ${sorted.length} recorded snapshots.`;
  } else if (degradingCount > 0 && improvingCount === 0) {
    overallDirection = 'degrading';
    summary = `Engineering posture degraded across ${degradingCount} dimension(s) with increased risks or unresolved technical debt over ${sorted.length} snapshots.`;
  } else if (improvingCount > 0 && degradingCount > 0) {
    overallDirection = 'stable';
    summary = `Mixed trajectory across ${sorted.length} snapshots: ${improvingCount} dimension(s) improved while ${degradingCount} dimension(s) experienced regressions.`;
  } else {
    overallDirection = 'stable';
    summary = `Stable engineering posture maintained with zero metric drift across ${sorted.length} recorded snapshots.`;
  }

  return Object.freeze({
    recordCount: sorted.length,
    overallDirection,
    securityTrend,
    attackExposureTrend,
    architectureTrend,
    readinessTrend,
    testingTrend,
    technicalDebtTrend,
    summary,
  });
}

function computeMetricTrend(
  name: string,
  records: readonly EngineeringHistoryRecord[],
  extractor: (r: EngineeringHistoryRecord) => number,
  polarity: 'higher-is-better' | 'lower-is-better'
): HistoryTrendMetric {
  const dataPoints = records.map((r) => ({
    timestamp: r.timestamp,
    recordId: r.id,
    revision: r.revisionIdentity.slice(0, 7),
    value: extractor(r),
  }));

  const firstValue = dataPoints[0].value;
  const lastValue = dataPoints[dataPoints.length - 1].value;
  const delta = lastValue - firstValue;

  let direction: TrendDirection;
  let explanation: string;

  if (delta === 0) {
    direction = 'stable';
    explanation = `${name} remained unchanged at ${lastValue} across all snapshots.`;
  } else if (polarity === 'higher-is-better') {
    if (delta > 0) {
      direction = 'improving';
      explanation = `${name} improved by +${delta} points (${firstValue} → ${lastValue}).`;
    } else {
      direction = 'degrading';
      explanation = `${name} degraded by ${delta} points (${firstValue} → ${lastValue}).`;
    }
  } else {
    // lower-is-better
    if (delta < 0) {
      direction = 'improving';
      explanation = `${name} improved with a reduction of ${Math.abs(delta)} (${firstValue} → ${lastValue}).`;
    } else {
      direction = 'degrading';
      explanation = `${name} degraded with an increase of +${delta} (${firstValue} → ${lastValue}).`;
    }
  }

  return Object.freeze({
    name,
    direction,
    dataPoints: Object.freeze(dataPoints),
    firstValue,
    lastValue,
    delta,
    explanation,
  });
}

function createEmptyTrendMetric(name: string): HistoryTrendMetric {
  return Object.freeze({
    name,
    direction: 'insufficient-data',
    dataPoints: Object.freeze([]),
    firstValue: 0,
    lastValue: 0,
    delta: 0,
    explanation: 'Insufficient data points to calculate trend trajectory.',
  });
}
