import { Severity, RuleCategory } from '@pathforge/shared';
import { VerificationStatus, ResolutionClassification } from '../comparison/verification.js';

export type ReportGateState = 'PASSED' | 'BLOCKED';

export interface ReportMetadata {
  readonly title: string;
  readonly reportVersion: string;
  readonly toolVersion: string;
  readonly generatedAt: string;
}

export interface ReportEnvironmentIdentity {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

export interface ReportExecutiveSummary {
  readonly status: VerificationStatus | 'no-baseline';
  readonly headline: string;
  readonly narrative: string;
  readonly baselineAvailable: boolean;
  readonly baselineTimestamp?: string;
  readonly evaluatedAt: string;
  readonly productionGate: ReportGateState;
}

export interface ReportSeverityDelta {
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

export interface ReportSecurityDeltaSummary {
  readonly critical: ReportSeverityDelta;
  readonly high: ReportSeverityDelta;
  readonly medium: ReportSeverityDelta;
  readonly low: ReportSeverityDelta;
  readonly total: ReportSeverityDelta;
  readonly productionGate: {
    readonly before: ReportGateState;
    readonly after: ReportGateState;
  };
}

export interface ReportResolvedFinding {
  readonly ruleId: string;
  readonly title: string;
  readonly severity: Severity;
  readonly category: RuleCategory;
  readonly affectedNodes: readonly string[];
  readonly affectedEdges: readonly string[];
  readonly resolutionType: ResolutionClassification;
  readonly changeSummary: string;
  readonly verificationProof: string;
  readonly beforeState: {
    readonly sourceName?: string;
    readonly targetName?: string;
    readonly protocol?: string;
    readonly ports?: string;
    readonly access?: string;
    readonly encrypted?: boolean;
  };
  readonly afterState?: {
    readonly sourceName?: string;
    readonly targetName?: string;
    readonly protocol?: string;
    readonly ports?: string;
    readonly access?: string;
    readonly encrypted?: boolean;
    readonly isRemoved?: boolean;
  };
}

export interface ReportUnresolvedFinding {
  readonly id: string;
  readonly ruleId: string;
  readonly title: string;
  readonly severity: Severity;
  readonly category: RuleCategory;
  readonly affectedNodes: readonly string[];
  readonly affectedEdges: readonly string[];
  readonly unchangedContext: string;
}

export interface ReportRegressionFinding {
  readonly id: string;
  readonly ruleId: string;
  readonly title: string;
  readonly severity: Severity;
  readonly category: RuleCategory;
  readonly affectedNodes: readonly string[];
  readonly affectedEdges: readonly string[];
  readonly whyItAppeared: string;
}

export interface ReportInfrastructureChange {
  readonly id: string;
  readonly type: string;
  readonly targetId: string;
  readonly targetType: 'node' | 'edge';
  readonly label: string;
  readonly description: string;
  readonly fieldChanges?: Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
}

export interface ReportRemediationRecord {
  readonly actionId: string;
  readonly type: string;
  readonly title: string;
  readonly outcome: 'Verified Eliminated' | 'Applied';
}

export interface VerificationReport {
  readonly metadata: ReportMetadata;
  readonly environment: ReportEnvironmentIdentity;
  readonly executiveSummary: ReportExecutiveSummary;
  readonly securityDelta?: ReportSecurityDeltaSummary;
  readonly resolvedFindings: readonly ReportResolvedFinding[];
  readonly stillPresentFindings: readonly ReportUnresolvedFinding[];
  readonly regressions: readonly ReportRegressionFinding[];
  readonly infrastructureChanges: readonly ReportInfrastructureChange[];
  readonly remediation?: ReportRemediationRecord;
  readonly productionGate: ReportGateState;
}
