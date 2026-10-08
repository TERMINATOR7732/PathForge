import {
  EngineeringHistoryRecord,
  EngineeringHistoryStore,
  HistoryComparisonResult,
  HistoryStoreQueryOptions,
  HistoryTrendsSummary,
} from './types.js';
import { compareHistoricalRecords } from './comparison.js';
import { calculateEngineeringTrends } from './trends.js';

/**
 * Queries engineering history records matching the given criteria.
 */
export async function queryHistory(
  store: EngineeringHistoryStore,
  options?: HistoryStoreQueryOptions
): Promise<readonly EngineeringHistoryRecord[]> {
  const result = store.list(options);
  return result instanceof Promise ? await result : result;
}

/**
 * Compares the two most recent historical records for an environment.
 * Baseline is the previous record (index 1), Current is the latest record (index 0).
 * Returns null if fewer than two records are available.
 */
export async function compareLatestHistory(
  store: EngineeringHistoryStore,
  environmentId?: string
): Promise<HistoryComparisonResult | null> {
  const listResult = store.list({ environmentId, limit: 2 });
  const records = listResult instanceof Promise ? await listResult : listResult;

  if (records.length < 2) {
    return null;
  }

  // records[0] is newest (current), records[1] is older (baseline)
  return compareHistoricalRecords(records[1], records[0]);
}

/**
 * Calculates longitudinal engineering trends across history records in the store.
 */
export async function getHistoryTrends(
  store: EngineeringHistoryStore,
  options?: HistoryStoreQueryOptions
): Promise<HistoryTrendsSummary> {
  const listResult = store.list(options);
  const records = listResult instanceof Promise ? await listResult : listResult;
  return calculateEngineeringTrends(records);
}
