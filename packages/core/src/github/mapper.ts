import {
  EngineeringSignal,
  IngestionOptions,
  NormalizedChangeSet,
} from '../change-ingestion/types.js';
import { ingestRepositoryChanges } from '../change-ingestion/ingest.js';
import { PullRequestFile, PullRequestSignalsSummary } from './types.js';
import { normalizePullRequestPatch } from './diff.js';

/**
 * Maps GitHub Pull Request diff and files into Phase 3.2's authoritative normalized change set.
 *
 * REUSE PRINCIPLE:
 * Reuses Phase 3.2's ingestRepositoryChanges parser directly. Zero duplicated diff parsing.
 */
export function mapPullRequestToChangeSet(
  rawDiff: string,
  files?: readonly PullRequestFile[],
  options?: IngestionOptions
): NormalizedChangeSet {
  const normalizedDiff = normalizePullRequestPatch(rawDiff, files);
  return ingestRepositoryChanges(normalizedDiff, options);
}

/**
 * Deterministically partitions engineering signals into category-specific collections.
 */
export function partitionSignals(
  signals: readonly EngineeringSignal[]
): PullRequestSignalsSummary {
  const securitySensitive: EngineeringSignal[] = [];
  const infrastructure: EngineeringSignal[] = [];
  const cicd: EngineeringSignal[] = [];
  const testing: EngineeringSignal[] = [];
  const dependency: EngineeringSignal[] = [];

  for (const s of signals) {
    if (s.isSecuritySensitive) {
      securitySensitive.push(s);
    }
    if (s.category === 'infrastructure') {
      infrastructure.push(s);
    } else if (s.category === 'cicd') {
      cicd.push(s);
    } else if (s.category === 'testing') {
      testing.push(s);
    } else if (s.category === 'dependency') {
      dependency.push(s);
    }
  }

  // Sort each partition deterministically by signal id
  const sortFn = (a: EngineeringSignal, b: EngineeringSignal) => a.id.localeCompare(b.id);
  securitySensitive.sort(sortFn);
  infrastructure.sort(sortFn);
  cicd.sort(sortFn);
  testing.sort(sortFn);
  dependency.sort(sortFn);

  return Object.freeze({
    securitySensitive: Object.freeze(securitySensitive),
    infrastructure: Object.freeze(infrastructure),
    cicd: Object.freeze(cicd),
    testing: Object.freeze(testing),
    dependency: Object.freeze(dependency),
  });
}
