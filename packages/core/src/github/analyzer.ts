import {
  GitHubAnalysisOptions,
  GitHubAnalysisResult,
  GitHubProvider,
  PullRequestEvidence,
  PullRequestRiskStatus,
} from './types.js';
import { parsePullRequestReference } from './pull-request.js';
import { getPullRequestMetadata, getPullRequestFiles } from './pull-request.js';
import { getPullRequestDiff } from './diff.js';
import { mapPullRequestToChangeSet, partitionSignals } from './mapper.js';
import { bridgeToChangeAnalysis } from '../change-ingestion/mapper.js';
import { getDefaultGitHubProvider, sanitizeErrorMessage } from './provider.js';

/**
 * Evaluates the deterministic PR risk status based on evidence.
 *
 * GOVERNANCE INVARIANT:
 * Never declare SECURITY_REGRESSION or SECURITY_IMPROVEMENT from code diffs alone.
 * Regressions and posture improvements are only proven when before/after
 * modeled infrastructure environments are evaluated.
 */
export function determinePullRequestRiskStatus(
  filesCount: number,
  securitySensitiveSignalsCount: number,
  isInfrastructureProven: boolean,
  regressionDetected?: boolean,
  risksIntroduced = 0,
  securityDecreasing = 0,
  risksResolved = 0,
  securityIncreasing = 0
): PullRequestRiskStatus {
  if (filesCount === 0) {
    return 'NO_ENGINEERING_IMPACT';
  }

  if (isInfrastructureProven) {
    if (regressionDetected || risksIntroduced > 0 || securityDecreasing > 0) {
      return 'SECURITY_REGRESSION';
    }
    if (securityIncreasing > securityDecreasing && risksResolved > 0) {
      return 'SECURITY_IMPROVEMENT';
    }
    if (securitySensitiveSignalsCount > 0) {
      return 'SECURITY_SENSITIVE_CHANGE';
    }
    return 'ENGINEERING_CHANGE_DETECTED';
  }

  // Without proven before/after topology evaluation:
  if (securitySensitiveSignalsCount > 0) {
    return 'SECURITY_SENSITIVE_CHANGE';
  }

  return 'ENGINEERING_CHANGE_DETECTED';
}

/**
 * Coordinates read-only analysis of a GitHub Pull Request.
 *
 * PIPELINE:
 * GitHub PR -> Metadata + Files + Patch -> Phase 3.2 Ingestion -> Phase 3.1 Bridge -> PR Analysis Result
 */
export async function analyzePullRequest(
  refInput: unknown,
  options?: GitHubAnalysisOptions,
  customProvider?: GitHubProvider
): Promise<GitHubAnalysisResult> {
  const ref = parsePullRequestReference(refInput);
  const provider = customProvider || getDefaultGitHubProvider();

  try {
    // 1. Retrieve metadata, files, and diff
    const metadata = await getPullRequestMetadata(ref, provider);
    const files = await getPullRequestFiles(ref, provider);

    let rawDiff = '';
    try {
      rawDiff = await getPullRequestDiff(ref, provider);
    } catch {
      // If diff retrieval fails, rawDiff stays empty and mapper synthesizes from files
      rawDiff = '';
    }

    // 2. Ingest through Phase 3.2
    const normalizedChangeSet = mapPullRequestToChangeSet(rawDiff, files, {
      maskSecrets: options?.maskSecrets !== false,
    });

    // 3. Bridge into Phase 3.1
    const bridgeResult = bridgeToChangeAnalysis(normalizedChangeSet, {
      beforeEnvironment: options?.beforeEnvironment,
      afterEnvironment: options?.afterEnvironment,
      changeAnalysisOptions: options?.changeAnalysisOptions,
    });

    // 4. Partition signals
    const signalsSummary = partitionSignals(normalizedChangeSet.signals);

    // 5. Determine deterministic PR risk status
    const analysisSummary = bridgeResult.changeAnalysisResult?.summary;
    const riskStatus = determinePullRequestRiskStatus(
      normalizedChangeSet.summary.filesChanged,
      normalizedChangeSet.summary.securitySensitiveSignalCount,
      bridgeResult.isInfrastructureProven,
      bridgeResult.changeAnalysisResult?.regressionDetected,
      analysisSummary?.risksIntroduced,
      analysisSummary?.securityDecreasing,
      analysisSummary?.risksResolved,
      analysisSummary?.securityIncreasing
    );

    // 6. Build evidence model
    const observedChanges: string[] = [];
    for (const f of normalizedChangeSet.files) {
      observedChanges.push(
        `${f.changeType}: ${f.path} (+${f.linesAdded}/-${f.linesDeleted}) [${f.category}]`
      );
    }
    if (observedChanges.length === 0) {
      observedChanges.push('Zero file modifications observed.');
    }

    const evidenceSource = bridgeResult.isInfrastructureProven
      ? 'PATHFORGE_ENVIRONMENT_ANALYSIS'
      : 'GITHUB_PR_PATCH';

    let conclusion = '';
    let limitationStatement = '';

    if (bridgeResult.isInfrastructureProven && bridgeResult.changeAnalysisResult) {
      const net =
        bridgeResult.changeAnalysisResult.summary.risksIntroduced -
        bridgeResult.changeAnalysisResult.summary.risksResolved;
      conclusion = `Correlated pull request modifications with modeled infrastructure topology. ${bridgeResult.changeAnalysisResult.summary.headline} (Net Risk Delta: ${net >= 0 ? '+' : ''}${net}).`;
      limitationStatement =
        'Evaluated against provided before/after infrastructure topology models. Verified via deterministic validation engine.';
    } else {
      if (signalsSummary.securitySensitive.length > 0) {
        conclusion = `Detected ${signalsSummary.securitySensitive.length} security-sensitive configuration modification(s) across pull request files.`;
        limitationStatement =
          'Infrastructure and security posture changes are not proven from repository diff alone. Correlate with modeled topology states to verify attack path mutations and risk deltas.';
      } else if (normalizedChangeSet.summary.filesChanged > 0) {
        conclusion = `Observed ${normalizedChangeSet.summary.filesChanged} code/configuration modification(s) without sensitive perimeter alterations.`;
        limitationStatement =
          'Application-level code changes observed. Zero infrastructure security findings or regressions are fabricated from code diffs alone.';
      } else {
        conclusion = 'Pull request introduces zero file modifications.';
        limitationStatement = 'No changes to evaluate.';
      }
    }

    const evidence: PullRequestEvidence = Object.freeze({
      observedChanges: Object.freeze(observedChanges),
      evidenceSource,
      securityImpactProven: bridgeResult.isInfrastructureProven,
      conclusion,
      limitationStatement,
    });

    return Object.freeze({
      repository: Object.freeze({
        owner: ref.owner,
        repository: ref.repository,
        fullName: `${ref.owner}/${ref.repository}`,
      }),
      pullRequest: ref,
      metadata,
      comparison: Object.freeze({
        baseSha: metadata.baseSha,
        headSha: metadata.headSha,
        baseBranch: metadata.baseBranch,
        headBranch: metadata.headBranch,
      }),
      files,
      normalizedChangeSet,
      bridgeResult,
      riskStatus,
      evidence,
      signalsSummary,
      isAnalysisComplete: true,
    });
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const sanitizedError = sanitizeErrorMessage(rawMessage);

    // Return structured failure result without crashing
    const fallbackMetadata = Object.freeze({
      prNumber: ref.pullRequestNumber,
      title: `PR #${ref.pullRequestNumber}`,
      body: null,
      author: 'unknown',
      state: 'OPEN' as const,
      isDraft: false,
      baseBranch: 'unknown',
      headBranch: 'unknown',
      baseSha: '0000000000000000000000000000000000000000',
      headSha: '0000000000000000000000000000000000000000',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      changedFilesCount: 0,
      additions: 0,
      deletions: 0,
    });

    const emptyChangeSet = mapPullRequestToChangeSet('', []);
    const bridgeResult = bridgeToChangeAnalysis(emptyChangeSet);
    const signalsSummary = partitionSignals([]);

    const evidence: PullRequestEvidence = Object.freeze({
      observedChanges: Object.freeze([]),
      evidenceSource: 'STRUCTURED_PR_METADATA',
      securityImpactProven: false,
      conclusion: 'Pull request analysis could not be completed.',
      limitationStatement: `Analysis failed: ${sanitizedError}`,
    });

    return Object.freeze({
      repository: Object.freeze({
        owner: ref.owner,
        repository: ref.repository,
        fullName: `${ref.owner}/${ref.repository}`,
      }),
      pullRequest: ref,
      metadata: fallbackMetadata,
      comparison: Object.freeze({
        baseSha: fallbackMetadata.baseSha,
        headSha: fallbackMetadata.headSha,
        baseBranch: fallbackMetadata.baseBranch,
        headBranch: fallbackMetadata.headBranch,
      }),
      files: Object.freeze([]),
      normalizedChangeSet: emptyChangeSet,
      bridgeResult,
      riskStatus: 'INSUFFICIENT_EVIDENCE',
      evidence,
      signalsSummary,
      isAnalysisComplete: false,
      error: sanitizedError,
    });
  }
}
