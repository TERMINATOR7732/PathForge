import { Environment } from '../domain/environment.js';
import { ValidationResult } from '@pathforge/shared';
import { AttackPathAnalysisResult } from '../attack-path/types.js';
import { ArchitectureAnalysisResult } from '../architecture/types.js';
import { BlastRadiusAnalysisResult } from '../blast-radius/types.js';
import { ProductionReadinessAssessment } from '../production-readiness/types.js';
import { TestingIntelligenceResult } from '../testing-intelligence/types.js';
import { FixVerificationResult } from '../comparison/verification.js';
import { getTechnicalDebtDefinition } from './catalog.js';
import { calculateDebtPriority } from './prioritization.js';
import { TechnicalDebtItem } from './types.js';

export interface DetectorContext {
  environment: Environment;
  validationResult: ValidationResult | null;
  attackPathAnalysis: AttackPathAnalysisResult;
  architectureAnalysis: ArchitectureAnalysisResult;
  blastRadiusAnalysis?: BlastRadiusAnalysisResult | null;
  productionReadiness?: ProductionReadinessAssessment | null;
  testingIntelligence?: TestingIntelligenceResult | null;
  fixVerification?: FixVerificationResult | null;
  scenarioId?: string | null;
}

/**
 * Deterministically maps existing PathForge evidence from validation, attack paths,
 * architecture, and testing intelligence to structured technical debt items.
 */
export function detectTechnicalDebt(ctx: DetectorContext): TechnicalDebtItem[] {
  const {
    environment,
    validationResult,
    attackPathAnalysis,
    architectureAnalysis,
    productionReadiness,
    testingIntelligence,
    fixVerification,
  } = ctx;

  const nodes = environment.getNodes();
  const edges = environment.getEdges();
  const findings = validationResult?.findings ?? [];

  // Sparse or empty environment rule: no fabricated technical debt
  if (nodes.length <= 1) {
    return [];
  }

  const items: TechnicalDebtItem[] = [];

  // Helper to build a TechnicalDebtItem with priority calculation
  const createItem = (params: {
    definitionId: string;
    evidence: string[];
    affectedNodeIds: string[];
    affectedEdgeIds: string[];
    causedBy?: string[];
    status?: 'ACTIVE' | 'MITIGATED' | 'UNVERIFIED';
    customSummary?: string;
    customWhyItMatters?: string;
  }): TechnicalDebtItem => {
    const def = getTechnicalDebtDefinition(params.definitionId);
    if (!def) {
      throw new Error(`Unknown technical debt definition: ${params.definitionId}`);
    }

    const affectedNodes = params.affectedNodeIds.map((id) => environment.getNode(id)).filter(Boolean);
    const hasCriticalAsset = affectedNodes.some((n) => n?.criticality === 'critical');
    const hasSensitiveAsset = affectedNodes.some(
      (n) => n?.criticality === 'high' || n?.zone === 'restricted' || n?.type === 'database' || n?.type === 'redis'
    );

    const hasUntrustedIngressNode = params.affectedNodeIds.some((id) => {
      const node = environment.getNode(id);
      if (!node) return false;
      return (
        node.type === 'internet' ||
        node.type === 'external_network' ||
        node.zone === 'public'
      );
    });

    const hasDirectUntrustedEdgeToAffected = edges.some((e) => {
      if (e.access === 'deny') return false;
      const srcNode = environment.getNode(e.source);
      if (!srcNode) return false;
      const isSrcUntrusted =
        srcNode.type === 'internet' ||
        srcNode.type === 'external_network' ||
        srcNode.zone === 'public';
      if (!isSrcUntrusted) return false;
      const tgtNode = environment.getNode(e.target);
      if (!tgtNode) return false;
      // Untrusted edge directly exposing a critical/sensitive asset or non-perimeter component
      return (
        params.affectedNodeIds.includes(e.target) &&
        (tgtNode.criticality === 'critical' ||
          tgtNode.criticality === 'high' ||
          tgtNode.zone === 'restricted' ||
          tgtNode.type === 'database' ||
          tgtNode.type === 'admin')
      );
    });

    const hasHighRiskAttackPathToAffected = attackPathAnalysis.attackPaths.some(
      (p) =>
        (p.risk === 'critical' || p.risk === 'high') &&
        params.affectedNodeIds.includes(p.target.id)
    );

    const isSecurityOrAccessOrArch =
      def.category === 'security-debt' ||
      def.category === 'access-control-debt' ||
      def.category === 'architecture-debt';

    const reachableFromUntrustedIngress =
      isSecurityOrAccessOrArch &&
      (hasUntrustedIngressNode ||
        hasDirectUntrustedEdgeToAffected ||
        hasHighRiskAttackPathToAffected);

    const affectedComponentsCount =
      new Set([...params.affectedNodeIds, ...params.affectedEdgeIds]).size;

    const isCriticalPropertyUnverified =
      testingIntelligence?.unverifiedProperties.some((p) => p.property.importance === 'critical') ?? false;

    const isHighPropertyUnverified =
      testingIntelligence?.unverifiedProperties.some((p) => p.property.importance === 'high') ?? false;

    const priorityInfo = calculateDebtPriority({
      severity: def.baseSeverity,
      category: def.category,
      hasCriticalAsset,
      hasSensitiveAsset,
      reachableFromUntrustedIngress,
      affectedComponentsCount,
      isCriticalPropertyUnverified,
      isHighPropertyUnverified,
    });

    return {
      id: `ITEM-${def.id}`,
      definitionId: def.id,
      title: def.title,
      category: def.category,
      severity: def.baseSeverity,
      priority: priorityInfo.priority,
      priorityScore: priorityInfo.score,
      priorityFactors: priorityInfo.factors,
      status: params.status ?? 'ACTIVE',
      summary: params.customSummary ?? def.summary,
      whyItMatters: params.customWhyItMatters ?? def.whyItMatters,
      debtImpact: def.debtImpact,
      futureChangeImpact: def.futureChangeImpact,
      evidence: params.evidence.slice().sort(),
      affectedNodeIds: params.affectedNodeIds.slice().sort(),
      affectedEdgeIds: params.affectedEdgeIds.slice().sort(),
      sourceAnalysis: def.defaultSource,
      causedBy: (params.causedBy ?? []).slice().sort(),
      recommendation: def.recommendation,
    };
  };

  // Helper to check if a rule was verified resolved in fixVerification
  const isRuleVerifiedResolved = (ruleId: string): boolean => {
    if (!fixVerification) return false;
    return fixVerification.resolvedFindings.some((r) => r.finding.ruleId === ruleId);
  };

  // ========================================================
  // Category 1: Security Debt
  // ========================================================

  // TD-001: Public Sensitive Asset Exposure
  const pf001 = findings.filter((f) => f.ruleId === 'PF-001');
  const hasAllowedEdgeToData = edges.some((e) => {
    if (e.access === 'deny') return false;
    const srcNode = environment.getNode(e.source);
    const tgtNode = environment.getNode(e.target);
    if (!srcNode || !tgtNode) return false;
    const srcZone = (srcNode.zone ?? '').toLowerCase();
    const srcType = srcNode.type.toLowerCase();
    const tgtType = tgtNode.type.toLowerCase();
    const isEdgeSource = srcZone === 'public' || srcType === 'internet' || srcType === 'external_network';
    const isDataTarget = tgtType === 'database' || tgtType === 'redis';
    return isEdgeSource && isDataTarget;
  });
  const arch001 = architectureAnalysis.findings.filter((f) => f.id === 'ARCH-001' && hasAllowedEdgeToData);
  const pf001Resolved = isRuleVerifiedResolved('PF-001');

  if (pf001.length > 0 || arch001.length > 0) {
    items.push(
      createItem({
        definitionId: 'TD-001',
        evidence: [...pf001.map((f) => f.id), ...arch001.map((f) => f.id)],
        affectedNodeIds: [
          ...pf001.flatMap((f) => f.affectedNodes),
          ...arch001.flatMap((f) => f.affectedNodeIds),
        ],
        affectedEdgeIds: pf001.flatMap((f) => f.affectedEdges),
        causedBy: ['PF-001', ...arch001.map((f) => f.id)],
        status: 'ACTIVE',
      })
    );
  } else if (pf001Resolved) {
    items.push(
      createItem({
        definitionId: 'TD-001',
        evidence: ['resolved-PF-001'],
        affectedNodeIds: [],
        affectedEdgeIds: [],
        causedBy: ['PF-001'],
        status: 'MITIGATED',
        customSummary: 'Public database exposure was verified resolved by revalidation.',
      })
    );
  }

  // TD-002: Unencrypted Sensitive Communication
  const pf008 = findings.filter((f) => f.ruleId === 'PF-008');
  const pf008Resolved = isRuleVerifiedResolved('PF-008');

  if (pf008.length > 0) {
    items.push(
      createItem({
        definitionId: 'TD-002',
        evidence: pf008.map((f) => f.id),
        affectedNodeIds: pf008.flatMap((f) => f.affectedNodes),
        affectedEdgeIds: pf008.flatMap((f) => f.affectedEdges),
        causedBy: ['PF-008'],
        status: 'ACTIVE',
      })
    );
  } else if (pf008Resolved) {
    items.push(
      createItem({
        definitionId: 'TD-002',
        evidence: ['resolved-PF-008'],
        affectedNodeIds: [],
        affectedEdgeIds: [],
        causedBy: ['PF-008'],
        status: 'MITIGATED',
        customSummary: 'Transport encryption was enabled and verified resolved by revalidation.',
      })
    );
  }

  // TD-003: Excessive Trust Relationship
  const pf005 = findings.filter((f) => f.ruleId === 'PF-005');
  const pf005Resolved = isRuleVerifiedResolved('PF-005');

  if (pf005.length > 0) {
    items.push(
      createItem({
        definitionId: 'TD-003',
        evidence: pf005.map((f) => f.id),
        affectedNodeIds: pf005.flatMap((f) => f.affectedNodes),
        affectedEdgeIds: pf005.flatMap((f) => f.affectedEdges),
        causedBy: ['PF-005'],
        status: 'ACTIVE',
      })
    );
  } else if (pf005Resolved) {
    items.push(
      createItem({
        definitionId: 'TD-003',
        evidence: ['resolved-PF-005'],
        affectedNodeIds: [],
        affectedEdgeIds: [],
        causedBy: ['PF-005'],
        status: 'MITIGATED',
      })
    );
  }

  // TD-004: Broad Network Access
  const pf007 = findings.filter((f) => f.ruleId === 'PF-007');
  const pf007Resolved = isRuleVerifiedResolved('PF-007');

  if (pf007.length > 0) {
    items.push(
      createItem({
        definitionId: 'TD-004',
        evidence: pf007.map((f) => f.id),
        affectedNodeIds: pf007.flatMap((f) => f.affectedNodes),
        affectedEdgeIds: pf007.flatMap((f) => f.affectedEdges),
        causedBy: ['PF-007'],
        status: 'ACTIVE',
      })
    );
  } else if (pf007Resolved) {
    items.push(
      createItem({
        definitionId: 'TD-004',
        evidence: ['resolved-PF-007'],
        affectedNodeIds: [],
        affectedEdgeIds: [],
        causedBy: ['PF-007'],
        status: 'MITIGATED',
      })
    );
  }

  // ========================================================
  // Category 2: Architecture Debt
  // ========================================================

  // TD-005: Flat Network Architecture
  const arch002 = architectureAnalysis.findings.filter((f) => f.id === 'ARCH-002');
  if (arch002.length > 0 || architectureAnalysis.topologyAnalysis.isFlatTopology) {
    items.push(
      createItem({
        definitionId: 'TD-005',
        evidence: arch002.map((f) => f.id).concat('flat-internal-topology'),
        affectedNodeIds: arch002.flatMap((f) => f.affectedNodeIds),
        affectedEdgeIds: [],
        causedBy: ['ARCH-002'],
        status: 'ACTIVE',
      })
    );
  }

  // TD-006: Tier Bypass
  const archBypass = architectureAnalysis.findings.filter(
    (f) => f.id === 'ARCH-005' || (f.id === 'ARCH-001' && hasAllowedEdgeToData)
  );
  const hasPerimeterToData = architectureAnalysis.tierAnalysis.tierTransitions.some(
    (t) => t.fromTier === 'perimeter' && t.toTier === 'data'
  );
  if (archBypass.length > 0 || hasPerimeterToData) {
    items.push(
      createItem({
        definitionId: 'TD-006',
        evidence: archBypass.map((f) => f.id),
        affectedNodeIds: archBypass.flatMap((f) => f.affectedNodeIds),
        affectedEdgeIds: archBypass.flatMap((f) => f.affectedEdgeIds),
        causedBy: archBypass.map((f) => f.id),
        status: 'ACTIVE',
      })
    );
  }

  // TD-007: Weak Perimeter Segmentation
  const arch007 = architectureAnalysis.findings.filter((f) => f.id === 'ARCH-007');
  if (arch007.length > 0 || architectureAnalysis.topologyAnalysis.segmentationQuality === 'weak') {
    items.push(
      createItem({
        definitionId: 'TD-007',
        evidence: arch007.map((f) => f.id),
        affectedNodeIds: arch007.flatMap((f) => f.affectedNodeIds),
        affectedEdgeIds: [],
        causedBy: ['ARCH-007'],
        status: 'ACTIVE',
      })
    );
  }

  // TD-008: Dependency Concentration
  const arch003Findings = architectureAnalysis.findings.filter((f) => f.id.startsWith('ARCH-003'));
  const highConnNodes = architectureAnalysis.dependencyAnalysis.highConnectivityNodes;
  const concentratedNodes = architectureAnalysis.dependencyAnalysis.profiles.filter((p) => p.inDegree >= 3);
  if (arch003Findings.length > 0 || highConnNodes.length > 0 || concentratedNodes.length > 0) {
    const affectedNodeIds = Array.from(
      new Set([
        ...arch003Findings.flatMap((f) => f.affectedNodeIds),
        ...highConnNodes.map((n) => n.nodeId),
        ...concentratedNodes.map((n) => n.nodeId),
      ])
    ).sort();

    items.push(
      createItem({
        definitionId: 'TD-008',
        evidence: [
          ...arch003Findings.map((f) => f.id),
          ...highConnNodes.map((n) => `high-connectivity-${n.nodeName}`),
          ...concentratedNodes.map((n) => `fan-in-${n.nodeName}-${n.inDegree}`),
        ],
        affectedNodeIds,
        affectedEdgeIds: [],
        causedBy: arch003Findings.length > 0 ? arch003Findings.map((f) => f.id) : ['high-dependency-concentration'],
        status: 'ACTIVE',
      })
    );
  }

  // ========================================================
  // Category 3: Resilience Debt
  // ========================================================

  // TD-009: Potential Single Point of Failure
  const arch004Findings = architectureAnalysis.findings.filter((f) => f.id.startsWith('ARCH-004'));
  const spofs = architectureAnalysis.dependencyAnalysis.singlePointsOfFailure;
  if (arch004Findings.length > 0 || spofs.length > 0) {
    const affectedNodeIds = Array.from(
      new Set([
        ...spofs.map((s) => s.nodeId),
        ...arch004Findings.map((f) => f.affectedNodeIds[0]).filter(Boolean),
      ])
    ).sort();

    items.push(
      createItem({
        definitionId: 'TD-009',
        evidence: [
          ...arch004Findings.map((f) => f.id),
          ...spofs.map((s) => `spof-${s.role.toLowerCase().replace(/\s+/g, '-')}`),
        ],
        affectedNodeIds,
        affectedEdgeIds: [],
        causedBy: arch004Findings.length > 0 ? arch004Findings.map((f) => f.id) : ['single-point-of-failure'],
        status: 'ACTIVE',
      })
    );
  }

  // TD-010: Critical Dependency Concentration
  const criticalDeps = architectureAnalysis.dependencyAnalysis.criticalAssetDependencies.filter(
    (dep) => dep.inDegree >= 3 || (dep.isCriticalAsset && dep.inDegree >= 2)
  );
  if (criticalDeps.length > 0) {
    items.push(
      createItem({
        definitionId: 'TD-010',
        evidence: criticalDeps.map((d) => `critical-concentration-${d.nodeName}`),
        affectedNodeIds: criticalDeps.map((d) => d.nodeId),
        affectedEdgeIds: [],
        causedBy: criticalDeps.map((d) => `critical-dep-${d.nodeId}`),
        status: 'ACTIVE',
      })
    );
  }

  // ========================================================
  // Category 4: Access-Control Debt
  // ========================================================

  // TD-011: Wildcard Access (allow edges with ANY:ANY, excluding explicit DENY)
  const wildcardEdges = edges.filter(
    (e) => e.access === 'allow' && (e.ports === 'ANY' || e.protocol === 'ANY')
  );
  if (wildcardEdges.length > 0) {
    items.push(
      createItem({
        definitionId: 'TD-011',
        evidence: wildcardEdges.map((e) => e.id),
        affectedNodeIds: Array.from(
          new Set(wildcardEdges.flatMap((e) => [e.source, e.target]))
        ),
        affectedEdgeIds: wildcardEdges.map((e) => e.id),
        causedBy: ['wildcard-network-edges'],
        status: 'ACTIVE',
      })
    );
  }

  // TD-012: Excessive Administrative Reachability
  const pf002 = findings.filter((f) => f.ruleId === 'PF-002');
  const arch006 = architectureAnalysis.findings.filter((f) => f.id === 'ARCH-006');
  const pf002Resolved = isRuleVerifiedResolved('PF-002');

  if (pf002.length > 0 || arch006.length > 0) {
    items.push(
      createItem({
        definitionId: 'TD-012',
        evidence: [...pf002.map((f) => f.id), ...arch006.map((f) => f.id)],
        affectedNodeIds: [
          ...pf002.flatMap((f) => f.affectedNodes),
          ...arch006.flatMap((f) => f.affectedNodeIds),
        ],
        affectedEdgeIds: pf002.flatMap((f) => f.affectedEdges),
        causedBy: ['PF-002', ...arch006.map((f) => f.id)],
        status: 'ACTIVE',
      })
    );
  } else if (pf002Resolved) {
    items.push(
      createItem({
        definitionId: 'TD-012',
        evidence: ['resolved-PF-002'],
        affectedNodeIds: [],
        affectedEdgeIds: [],
        causedBy: ['PF-002'],
        status: 'MITIGATED',
      })
    );
  }

  // TD-013: Overly Broad Protocol/Port Access
  const broadRangeEdges = edges.filter(
    (e) => e.access === 'allow' && e.ports && e.ports.includes('-')
  );
  if (broadRangeEdges.length > 0) {
    items.push(
      createItem({
        definitionId: 'TD-013',
        evidence: broadRangeEdges.map((e) => e.id),
        affectedNodeIds: Array.from(
          new Set(broadRangeEdges.flatMap((e) => [e.source, e.target]))
        ),
        affectedEdgeIds: broadRangeEdges.map((e) => e.id),
        causedBy: ['port-range-allowances'],
        status: 'ACTIVE',
      })
    );
  }

  // ========================================================
  // Category 5: Testing Debt
  // ========================================================

  // TD-014: Missing Critical Verification Coverage
  if (testingIntelligence) {
    const unverifiedCritical = testingIntelligence.unverifiedProperties.filter(
      (p) => p.property.importance === 'critical'
    );
    if (unverifiedCritical.length > 0) {
      items.push(
        createItem({
          definitionId: 'TD-014',
          evidence: unverifiedCritical.map((p) => p.property.id),
          affectedNodeIds: Array.from(
            new Set(unverifiedCritical.flatMap((p) => p.affectedNodeIds))
          ),
          affectedEdgeIds: Array.from(
            new Set(unverifiedCritical.flatMap((p) => p.affectedEdgeIds))
          ),
          causedBy: unverifiedCritical.map((p) => p.property.id),
          status: 'ACTIVE',
          customSummary: `${unverifiedCritical.length} critical security property assumption(s) lack verification evidence.`,
        })
      );
    }
  }

  // TD-015: Missing Regression Baseline
  if (testingIntelligence && !testingIntelligence.regressions.hasBaseline) {
    items.push(
      createItem({
        definitionId: 'TD-015',
        evidence: ['no-baseline-established'],
        affectedNodeIds: [],
        affectedEdgeIds: [],
        causedBy: ['no-baseline'],
        status: 'ACTIVE',
        customSummary: 'No immutable validated snapshot exists to detect future security regressions.',
      })
    );
  }

  // TD-016: Unverified High-Risk Property
  if (testingIntelligence) {
    const unverifiedHigh = testingIntelligence.unverifiedProperties.filter(
      (p) => p.property.importance === 'high'
    );
    if (unverifiedHigh.length > 0) {
      items.push(
        createItem({
          definitionId: 'TD-016',
          evidence: unverifiedHigh.map((p) => p.property.id),
          affectedNodeIds: Array.from(
            new Set(unverifiedHigh.flatMap((p) => p.affectedNodeIds))
          ),
          affectedEdgeIds: Array.from(
            new Set(unverifiedHigh.flatMap((p) => p.affectedEdgeIds))
          ),
          causedBy: unverifiedHigh.map((p) => p.property.id),
          status: 'ACTIVE',
          customSummary: `${unverifiedHigh.length} high-importance property assumption(s) lack verification evidence.`,
        })
      );
    }
  }

  // ========================================================
  // Category 6: Operational Debt
  // ========================================================

  // TD-017, TD-018, TD-019: Unverified Operational Controls
  if (productionReadiness && productionReadiness.limitations.length > 0) {
    // TD-017: Missing Operational Evidence
    items.push(
      createItem({
        definitionId: 'TD-017',
        evidence: productionReadiness.limitations.map((l) => l.id),
        affectedNodeIds: [],
        affectedEdgeIds: [],
        causedBy: productionReadiness.limitations.map((l) => l.id),
        status: 'UNVERIFIED',
        customSummary: `${productionReadiness.limitations.length} runtime operational control(s) unrepresented in the topology model.`,
      })
    );

    // TD-018: Unverified Recovery Controls (Backups / Disaster recovery)
    const recoveryControls = productionReadiness.limitations.filter(
      (l) => l.category === 'resilience' || l.id.includes('backup') || l.id.includes('recovery')
    );
    if (recoveryControls.length > 0) {
      items.push(
        createItem({
          definitionId: 'TD-018',
          evidence: recoveryControls.map((l) => l.id),
          affectedNodeIds: [],
          affectedEdgeIds: [],
          causedBy: recoveryControls.map((l) => l.id),
          status: 'UNVERIFIED',
          customSummary: 'Data backup, snapshotting, and disaster recovery failover controls are unverified.',
        })
      );
    }

    // TD-019: Unverified Monitoring/Alerting
    const observabilityControls = productionReadiness.limitations.filter(
      (l) => l.category === 'observability' || l.id.includes('monitoring') || l.id.includes('alerting')
    );
    if (observabilityControls.length > 0) {
      items.push(
        createItem({
          definitionId: 'TD-019',
          evidence: observabilityControls.map((l) => l.id),
          affectedNodeIds: [],
          affectedEdgeIds: [],
          causedBy: observabilityControls.map((l) => l.id),
          status: 'UNVERIFIED',
          customSummary: 'Runtime metrics telemetry collection and security alert pipelines are unverified.',
        })
      );
    }
  }

  // ========================================================
  // Category 7: Complexity Debt
  // ========================================================

  // TD-020: High Connectivity Concentration
  if (architectureAnalysis.dependencyAnalysis.highConnectivityNodes.length > 0) {
    const highConn = architectureAnalysis.dependencyAnalysis.highConnectivityNodes;
    items.push(
      createItem({
        definitionId: 'TD-020',
        evidence: highConn.map((b) => b.nodeId),
        affectedNodeIds: highConn.map((b) => b.nodeId),
        affectedEdgeIds: [],
        causedBy: highConn.map((b) => b.nodeId),
        status: 'ACTIVE',
      })
    );
  }

  // TD-021: Excessive Trust Boundaries
  const excessiveBoundaryPaths = attackPathAnalysis.attackPaths.filter(
    (p) => p.trustBoundariesCrossed >= 4
  );
  if (excessiveBoundaryPaths.length > 0) {
    items.push(
      createItem({
        definitionId: 'TD-021',
        evidence: excessiveBoundaryPaths.map((p) => p.id),
        affectedNodeIds: Array.from(
          new Set(excessiveBoundaryPaths.flatMap((p) => p.nodes.map((n) => n.id)))
        ),
        affectedEdgeIds: Array.from(
          new Set(excessiveBoundaryPaths.flatMap((p) => p.edges.map((e) => e.id)))
        ),
        causedBy: excessiveBoundaryPaths.map((p) => p.id),
        status: 'ACTIVE',
      })
    );
  }

  // TD-022: Infrastructure Topology Complexity
  if (nodes.length >= 4 && edges.length / nodes.length >= 1.5) {
    items.push(
      createItem({
        definitionId: 'TD-022',
        evidence: [`edge-to-node-ratio-${(edges.length / nodes.length).toFixed(1)}`],
        affectedNodeIds: nodes.map((n) => n.id),
        affectedEdgeIds: edges.map((e) => e.id),
        causedBy: ['mesh-topology-ratio'],
        status: 'ACTIVE',
      })
    );
  }

  return items;
}
