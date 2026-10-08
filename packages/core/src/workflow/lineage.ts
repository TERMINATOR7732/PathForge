import { ValidationResult } from '@pathforge/shared';
import { AttackPathAnalysisResult } from '../attack-path/types.js';
import { ArchitectureAnalysisResult } from '../architecture/types.js';
import { ProductionReadinessAssessment } from '../production-readiness/types.js';
import { TestingIntelligenceResult } from '../testing-intelligence/types.js';
import { TechnicalDebtAssessment } from '../technical-debt/types.js';
import { ChangeAnalysisResult } from '../change-analysis/types.js';
import { CiGateResult, CiGateReason } from '../ci-gate/types.js';
import {
  EvidenceLineageItem,
  EvidenceMatrixRow,
  ElementTargetRef,
} from './types.js';

interface LineageContext {
  readonly environment: any;
  readonly gateResult: CiGateResult;
  readonly validationResult?: ValidationResult | null;
  readonly attackPathAnalysis?: AttackPathAnalysisResult | null;
  readonly architectureAnalysis?: ArchitectureAnalysisResult | null;
  readonly productionReadiness?: ProductionReadinessAssessment | null;
  readonly testingIntelligence?: TestingIntelligenceResult | null;
  readonly technicalDebt?: TechnicalDebtAssessment | null;
  readonly changeAnalysis?: ChangeAnalysisResult | null;
}

function resolveElementRef(id: string, type: 'node' | 'edge', environment: any): ElementTargetRef {
  if (type === 'node') {
    const node = environment?.getNode ? environment.getNode(id) : null;
    return {
      id,
      type: 'node',
      label: node?.name ?? `Node ${id}`,
    };
  } else {
    const edge = environment?.getEdge ? environment.getEdge(id) : null;
    const srcNode = edge ? (environment?.getNode ? environment.getNode(edge.source) : null) : null;
    const tgtNode = edge ? (environment?.getNode ? environment.getNode(edge.target) : null) : null;
    const edgeLabel = srcNode && tgtNode ? `${srcNode.name} → ${tgtNode.name}` : `Edge ${id}`;
    return {
      id,
      type: 'edge',
      label: edgeLabel,
    };
  }
}

/**
 * Maps a CI Gate reason to the underlying concrete elements that caused it.
 */
function findRelatedElementsForReason(
  reason: CiGateReason,
  ctx: LineageContext
): { nodeIds: string[]; edgeIds: string[] } {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  // 1. Findings correlation
  if (ctx.validationResult?.findings) {
    for (const f of ctx.validationResult.findings) {
      if (
        (reason.category === 'security' && (f.severity === 'critical' || f.severity === 'high')) ||
        reason.id.includes(f.ruleId) ||
        reason.description.toLowerCase().includes(f.title.toLowerCase())
      ) {
        if (f.affectedNodes) f.affectedNodes.forEach((n: string) => nodeIds.add(n));
        if (f.affectedEdges) f.affectedEdges.forEach((e: string) => edgeIds.add(e));
      }
    }
  }

  // 2. Attack Paths correlation
  if (ctx.attackPathAnalysis?.attackPaths && (reason.category === 'attack-exposure' || reason.category === 'security')) {
    for (const ap of ctx.attackPathAnalysis.attackPaths) {
      if (ap.risk === 'critical' || ap.risk === 'high') {
        if (ap.nodes) ap.nodes.forEach((n) => nodeIds.add(n.id));
        if (ap.edges) ap.edges.forEach((e) => edgeIds.add(e.id));
      }
    }
  }

  // 3. Architecture correlation
  if (ctx.architectureAnalysis?.findings && reason.category === 'architecture') {
    for (const af of ctx.architectureAnalysis.findings) {
      if (af.affectedNodeIds) af.affectedNodeIds.forEach((n: string) => nodeIds.add(n));
      if (af.affectedEdgeIds) af.affectedEdgeIds.forEach((e: string) => edgeIds.add(e));
    }
  }

  // 4. Regression correlation
  if (ctx.changeAnalysis?.newlyIntroducedRisks && reason.category === 'regression') {
    for (const nr of ctx.changeAnalysis.newlyIntroducedRisks) {
      if (nr.affectedNodes) nr.affectedNodes.forEach((n: string) => nodeIds.add(n));
      if (nr.affectedEdges) nr.affectedEdges.forEach((e: string) => edgeIds.add(e));
    }
  }

  return {
    nodeIds: Array.from(nodeIds),
    edgeIds: Array.from(edgeIds),
  };
}

/**
 * Builds deterministic evidence lineage items from the evaluated gate and intelligence modules.
 */
export function buildEvidenceLineage(ctx: LineageContext): readonly EvidenceLineageItem[] {
  const lineage: EvidenceLineageItem[] = [];

  // 1. Map all Blocking Reasons
  for (const br of ctx.gateResult.blockingReasons) {
    const { nodeIds, edgeIds } = findRelatedElementsForReason(br, ctx);
    const targetElements: ElementTargetRef[] = [
      ...nodeIds.map((nid) => resolveElementRef(nid, 'node', ctx.environment)),
      ...edgeIds.map((eid) => resolveElementRef(eid, 'edge', ctx.environment)),
    ];

    lineage.push({
      id: `lineage-block-${br.id}`,
      controlId: br.id,
      controlName: br.title,
      category: br.category,
      verdict: 'BLOCK',
      description: br.description,
      affectedNodeIds: nodeIds,
      affectedEdgeIds: edgeIds,
      targetElements,
      rationale: `Blocking Gate Rule: ${br.description}`,
      sourceDiffLines: br.evidence,
    });
  }

  // 2. Map all Warnings
  for (const w of ctx.gateResult.warnings) {
    const { nodeIds, edgeIds } = findRelatedElementsForReason(w, ctx);
    const targetElements: ElementTargetRef[] = [
      ...nodeIds.map((nid) => resolveElementRef(nid, 'node', ctx.environment)),
      ...edgeIds.map((eid) => resolveElementRef(eid, 'edge', ctx.environment)),
    ];

    lineage.push({
      id: `lineage-warn-${w.id}`,
      controlId: w.id,
      controlName: w.title,
      category: w.category,
      verdict: 'WARN',
      description: w.description,
      affectedNodeIds: nodeIds,
      affectedEdgeIds: edgeIds,
      targetElements,
      rationale: `Gate Policy Warning: ${w.description}`,
      sourceDiffLines: w.evidence,
    });
  }

  // 3. Map Passed Controls
  for (const pc of ctx.gateResult.passedControls) {
    lineage.push({
      id: `lineage-pass-${pc.id}`,
      controlId: pc.id,
      controlName: pc.name,
      category: pc.category,
      verdict: 'PASS',
      description: pc.description,
      affectedNodeIds: [],
      affectedEdgeIds: [],
      targetElements: [],
      rationale: `Verified Policy Standard: ${pc.description}`,
    });
  }

  // 4. Map Evidence Gaps
  for (const eg of ctx.gateResult.evidenceGaps) {
    lineage.push({
      id: `lineage-unverif-${eg.id}`,
      controlId: eg.controlId,
      controlName: eg.title,
      category: 'operational-evidence',
      verdict: 'INSUFFICIENT_EVIDENCE',
      description: eg.description,
      affectedNodeIds: [],
      affectedEdgeIds: [],
      targetElements: [],
      rationale: eg.rationale,
    });
  }

  return Object.freeze(lineage);
}

/**
 * Builds the compact, structured evidence matrix summarizing all 7 engineering dimensions.
 */
export function buildEvidenceMatrix(ctx: LineageContext): readonly EvidenceMatrixRow[] {
  const rows: EvidenceMatrixRow[] = [];
  const env = ctx.environment;

  // 1. Critical Security Findings
  const criticalFindings = ctx.validationResult?.findings.filter((f) => f.severity === 'critical') ?? [];
  const highFindings = ctx.validationResult?.findings.filter((f) => f.severity === 'high') ?? [];
  const criticalTargetRefs: ElementTargetRef[] = [];
  criticalFindings.forEach((cf) => {
    cf.affectedNodes?.forEach((nid) => criticalTargetRefs.push(resolveElementRef(nid, 'node', env)));
    cf.affectedEdges?.forEach((eid) => criticalTargetRefs.push(resolveElementRef(eid, 'edge', env)));
  });

  rows.push({
    control: 'Critical Security Findings',
    category: 'Security',
    result: criticalFindings.length === 0 ? 'PASS' : 'BLOCK',
    evidence:
      criticalFindings.length === 0
        ? '0 active critical findings verified'
        : `${criticalFindings.length} critical finding(s) detected: ${criticalFindings.map((f) => f.title).join(', ')}`,
    targetElements: criticalTargetRefs,
  });

  // 2. High Security Findings
  const highTargetRefs: ElementTargetRef[] = [];
  highFindings.forEach((hf) => {
    hf.affectedNodes?.forEach((nid) => highTargetRefs.push(resolveElementRef(nid, 'node', env)));
    hf.affectedEdges?.forEach((eid) => highTargetRefs.push(resolveElementRef(eid, 'edge', env)));
  });

  rows.push({
    control: 'High Security Findings',
    category: 'Security',
    result: highFindings.length === 0 ? 'PASS' : 'WARN',
    evidence:
      highFindings.length === 0
        ? '0 active high findings verified'
        : `${highFindings.length} high finding(s) detected: ${highFindings.map((f) => f.title).join(', ')}`,
    targetElements: highTargetRefs,
  });

  // 3. Attack Exposure & Reachability
  const attackPaths = ctx.attackPathAnalysis?.attackPaths ?? [];
  const critAttackPaths = attackPaths.filter((p) => p.risk === 'critical');
  const elevatedAttackPaths = attackPaths.filter((p) => p.risk === 'high' || p.risk === 'medium');
  const attackTargetRefs: ElementTargetRef[] = [];
  critAttackPaths.forEach((cp) => {
    cp.nodes?.forEach((n) => attackTargetRefs.push(resolveElementRef(n.id, 'node', env)));
    cp.edges?.forEach((e) => attackTargetRefs.push(resolveElementRef(e.id, 'edge', env)));
  });

  const attackResult: 'PASS' | 'WARN' | 'BLOCK' =
    critAttackPaths.length > 0 ? 'BLOCK' : elevatedAttackPaths.length > 0 ? 'WARN' : 'PASS';
  const attackEvidence =
    critAttackPaths.length > 0
      ? `${critAttackPaths.length} critical attack path(s) reaching high-value targets`
      : elevatedAttackPaths.length > 0
      ? `${elevatedAttackPaths.length} elevated path(s) detected with lateral movement opportunities`
      : '0 critical or elevated attack paths';

  rows.push({
    control: 'Attack Path Exposure',
    category: 'Attack Exposure',
    result: attackResult,
    evidence: attackEvidence,
    targetElements: attackTargetRefs,
  });

  // 4. Architecture Quality
  const archScore = ctx.architectureAnalysis?.score.score ?? 100;
  const archFindings = ctx.architectureAnalysis?.findings ?? [];
  const archResult: 'PASS' | 'WARN' | 'BLOCK' = archScore < 50 ? 'BLOCK' : archScore < 75 ? 'WARN' : 'PASS';
  const archTargetRefs: ElementTargetRef[] = [];
  archFindings.forEach((af) => {
    af.affectedNodeIds?.forEach((nid) => archTargetRefs.push(resolveElementRef(nid, 'node', env)));
    af.affectedEdgeIds?.forEach((eid) => archTargetRefs.push(resolveElementRef(eid, 'edge', env)));
  });

  rows.push({
    control: 'Architecture Quality',
    category: 'Architecture',
    result: archResult,
    evidence: `Architecture score ${archScore}/100 (${ctx.architectureAnalysis?.score.rating ?? 'good'}) · ${archFindings.length} anti-pattern(s)`,
    targetElements: archTargetRefs,
  });

  // 5. Production Readiness
  const readiness = ctx.productionReadiness;
  const readinessScore = readiness?.score ?? 0;
  const readinessStatus = readiness?.status ?? 'UNEVALUATED';
  const readinessResult: 'PASS' | 'WARN' | 'BLOCK' =
    readinessStatus === 'READY'
      ? 'PASS'
      : readinessStatus === 'READY_WITH_WARNINGS'
      ? 'WARN'
      : 'BLOCK';

  rows.push({
    control: 'Production Readiness',
    category: 'Operations',
    result: readiness ? readinessResult : 'UNVERIFIED',
    evidence: readiness
      ? `Status ${readinessStatus} (${readinessScore}/100) · ${readiness.summary.blockedGates} blocked gates, ${readiness.summary.warningGates} warnings`
      : 'Production readiness assessment not yet computed',
    targetElements: [],
  });

  // 6. Testing Intelligence
  const testing = ctx.testingIntelligence;
  const testingResult: 'PASS' | 'WARN' | 'BLOCK' | 'UNVERIFIED' = testing
    ? (testing.unverifiedProperties.length === 0 ? 'PASS' : 'WARN')
    : 'UNVERIFIED';

  rows.push({
    control: 'Testing Intelligence',
    category: 'Verification',
    result: testingResult,
    evidence: testing
      ? `Coverage score ${testing.score}/100 (${testing.level}) · ${testing.verifiedProperties.length} verified, ${testing.unverifiedProperties.length} unverified properties`
      : 'Testing intelligence coverage unverified',
    targetElements: [],
  });

  // 7. Technical Debt Health
  const debt = ctx.technicalDebt;
  const debtScore = debt?.summary.overallScore ?? 100;
  const debtRating = debt?.summary.rating ?? 'LOW_DEBT';
  const debtResult: 'PASS' | 'WARN' | 'BLOCK' =
    debtRating === 'SEVERE' || debtRating === 'HIGH'
      ? 'BLOCK'
      : debtRating === 'ELEVATED'
      ? 'WARN'
      : 'PASS';

  rows.push({
    control: 'Technical Debt Health',
    category: 'Technical Debt',
    result: debt ? debtResult : 'PASS',
    evidence: debt
      ? `Debt health score ${debtScore}/100 (${debtRating}) · ${debt.activeItems.length} active item(s)`
      : 'Technical debt health at baseline (100/100)',
    targetElements: [],
  });

  // 8. Topology Regression
  const change = ctx.changeAnalysis;
  const hasRegression = Boolean(change?.regressionDetected);
  const regressionResult: 'PASS' | 'BLOCK' | 'UNVERIFIED' = !change
    ? 'UNVERIFIED'
    : hasRegression
    ? 'BLOCK'
    : 'PASS';

  rows.push({
    control: 'Continuous Regression Delta',
    category: 'Change Analysis',
    result: regressionResult,
    evidence: !change
      ? 'No baseline established for comparative regression analysis'
      : hasRegression
      ? `Security regression detected: ${change.regressionDetails.explanation}`
      : '0 security regressions detected against baseline',
    targetElements: [],
  });

  // 9. CI Engineering Gate Verdict
  rows.push({
    control: 'CI Engineering Gate',
    category: 'Gate Evaluation',
    result:
      ctx.gateResult.status === 'PASS'
        ? 'PASS'
        : ctx.gateResult.status === 'WARN'
        ? 'WARN'
        : ctx.gateResult.status === 'BLOCK'
        ? 'BLOCK'
        : 'UNVERIFIED',
    evidence: `Gate verdict: ${ctx.gateResult.status} (exit code ${ctx.gateResult.exitCode}) · composite score ${ctx.gateResult.score}/100`,
    targetElements: [],
  });

  return Object.freeze(rows);
}
