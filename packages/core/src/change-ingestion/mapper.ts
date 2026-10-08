import {
  ChangeAnalysisOptions,
  ChangeAnalysisResult,
  analyzeInfrastructureChanges,
} from '../change-analysis/index.js';
import { Environment } from '../domain/environment.js';
import { EnvironmentSnapshot } from '../comparison/snapshot.js';
import { NormalizedChangeSet, NormalizedFileChange } from './types.js';

export interface IngestionBridgeResult {
  readonly changeSet: NormalizedChangeSet;
  readonly isInfrastructureProven: boolean;
  readonly engineeringObservation: string;
  readonly securityImpactStatement: string;
  readonly changeAnalysisResult?: ChangeAnalysisResult;
}

/**
 * Deterministically filters files that contain infrastructure or security configurations.
 */
export function filterInfrastructureRelevantFiles(
  files: readonly NormalizedFileChange[]
): NormalizedFileChange[] {
  return files.filter(
    (f) => f.category === 'infrastructure' || f.category === 'security-config'
  );
}

/**
 * Deterministically filters files that cannot be mapped directly to modeled infrastructure topology.
 */
export function filterUnmappedFiles(
  files: readonly NormalizedFileChange[]
): NormalizedFileChange[] {
  return files.filter(
    (f) => f.category !== 'infrastructure' && f.category !== 'security-config'
  );
}

/**
 * Bridges normalized repository changes with Phase 3.1 change analysis.
 *
 * PRINCIPLE OF TRUTHFUL GOVERNANCE:
 * Source code diffs represent developer actions and engineering intent.
 * They do NOT automatically prove infrastructure or security posture changes
 * until modeled before/after environments are provided and evaluated.
 */
export function bridgeToChangeAnalysis(
  changeSet: NormalizedChangeSet,
  options?: {
    beforeEnvironment?: Environment | EnvironmentSnapshot;
    afterEnvironment?: Environment;
    changeAnalysisOptions?: ChangeAnalysisOptions;
  }
): IngestionBridgeResult {
  const infraCount = changeSet.infrastructureRelevantFiles.length;
  const unmappedCount = changeSet.unmappedFiles.length;
  const totalFiles = changeSet.files.length;

  const engineeringObservation =
    totalFiles === 0
      ? 'No repository file changes observed.'
      : `Observed ${totalFiles} repository change(s): ${infraCount} infrastructure/security-relevant file(s) and ${unmappedCount} application/unmapped file(s).`;

  // If before & after modeled environments are supplied, invoke Phase 3.1 change analysis
  if (options?.beforeEnvironment && options?.afterEnvironment) {
    const analysis = analyzeInfrastructureChanges(
      options.beforeEnvironment,
      options.afterEnvironment,
      options.changeAnalysisOptions
    );

    const netDelta = analysis.summary.risksIntroduced - analysis.summary.risksResolved;
    return {
      changeSet,
      isInfrastructureProven: true,
      engineeringObservation,
      securityImpactStatement: `Correlated ${infraCount} repository change(s) with modeled topology mutations: ${analysis.summary.impactLevel} impact (${netDelta >= 0 ? '+' : ''}${netDelta} net risk delta).`,
      changeAnalysisResult: analysis,
    };
  }

  // If modeled environments are not supplied, explicitly assert that no posture change is proven
  const securityImpactStatement =
    infraCount > 0
      ? `Detected ${infraCount} infrastructure/security-sensitive manifest change(s). Security posture impact cannot be proven without evaluating modeled topology before and after states.`
      : 'Application/code changes detected. Zero infrastructure or security posture changes are proven from code diff alone.';

  return {
    changeSet,
    isInfrastructureProven: false,
    engineeringObservation,
    securityImpactStatement,
  };
}
