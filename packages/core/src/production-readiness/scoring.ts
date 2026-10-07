import { Environment } from '../domain/environment.js';
import { ValidationResult } from '@pathforge/shared';
import { AttackPathAnalysisResult } from '../attack-path/types.js';
import { ArchitectureAnalysisResult } from '../architecture/types.js';
import {
  ReadinessCategoryId,
  ReadinessCategoryAssessment,
  ReadinessScoreDeduction,
  ProductionReadinessRating,
  CategoryStatus,
} from './types.js';

export interface ScoringContext {
  environment: Environment;
  validationResult: ValidationResult | null;
  attackPathAnalysis: AttackPathAnalysisResult;
  architectureAnalysis: ArchitectureAnalysisResult;
}

export interface ScoringResult {
  score: number; // 0-100 integer
  rating: ProductionReadinessRating;
  categories: ReadinessCategoryAssessment[];
}

/**
 * Deterministically computes explainable 0-100 category scores and the weighted
 * production readiness score across all 7 readiness categories.
 */
export function calculateReadinessScore(ctx: ScoringContext): ScoringResult {
  const { environment, validationResult, attackPathAnalysis, architectureAnalysis } = ctx;
  const findings = validationResult?.findings ?? [];
  const edges = environment.getEdges();

  const categoryWeights: Record<ReadinessCategoryId, number> = {
    security: 30,
    'attack-exposure': 20,
    architecture: 20,
    'access-control': 10,
    communication: 10,
    resilience: 5,
    'evidence-coverage': 5,
  };

  const categories: ReadinessCategoryAssessment[] = [];

  // ==========================================
  // Category 1: Security Posture (30%)
  // ==========================================
  {
    const deductions: ReadinessScoreDeduction[] = [];
    const observations: string[] = [];

    const criticalFindings = findings.filter((f) => f.severity === 'critical');
    const highFindings = findings.filter((f) => f.severity === 'high');
    const mediumFindings = findings.filter((f) => f.severity === 'medium');
    const lowFindings = findings.filter((f) => f.severity === 'low');

    if (criticalFindings.length > 0) {
      const pts = criticalFindings.length * 25;
      deductions.push({
        category: 'security',
        points: pts,
        reason: `${criticalFindings.length} critical validation finding(s) detected.`,
        evidence: criticalFindings.map((f) => f.ruleId).join(', '),
      });
      observations.push(`Found ${criticalFindings.length} critical severity security rule violation(s).`);
    }

    if (highFindings.length > 0) {
      const pts = highFindings.length * 15;
      deductions.push({
        category: 'security',
        points: pts,
        reason: `${highFindings.length} high severity validation finding(s) detected.`,
        evidence: highFindings.map((f) => f.ruleId).join(', '),
      });
      observations.push(`Found ${highFindings.length} high severity security violation(s).`);
    }

    if (mediumFindings.length > 0) {
      const pts = mediumFindings.length * 8;
      deductions.push({
        category: 'security',
        points: pts,
        reason: `${mediumFindings.length} medium severity validation finding(s).`,
        evidence: mediumFindings.map((f) => f.ruleId).join(', '),
      });
    }

    if (lowFindings.length > 0) {
      const pts = lowFindings.length * 3;
      deductions.push({
        category: 'security',
        points: pts,
        reason: `${lowFindings.length} low severity finding(s).`,
      });
    }

    const totalDeductions = deductions.reduce((acc, d) => acc + d.points, 0);
    const score = Math.max(0, 100 - totalDeductions);

    let status: CategoryStatus = 'PASSED';
    if (criticalFindings.length > 0 || score < 50) {
      status = 'BLOCKED';
    } else if (highFindings.length > 0 || score < 75) {
      status = 'WARNING';
    }

    if (observations.length === 0) {
      observations.push('Zero active validation rule violations identified.');
    }

    categories.push({
      id: 'security',
      name: 'Security Posture',
      weight: categoryWeights.security,
      score,
      status,
      summary:
        status === 'BLOCKED'
          ? 'Active critical validation violations present serious operational security risk.'
          : status === 'WARNING'
          ? 'High or medium security findings require remediation prior to production rollout.'
          : 'Security rules pass with zero active policy violations.',
      observations,
      deductions,
    });
  }

  // ==========================================
  // Category 2: Attack Exposure (20%)
  // ==========================================
  {
    const deductions: ReadinessScoreDeduction[] = [];
    const observations: string[] = [];

    const criticalPaths = attackPathAnalysis.attackPaths.filter((p) => p.risk === 'critical');
    const highRiskPaths = attackPathAnalysis.attackPaths.filter((p) => p.risk === 'high');
    const sensitiveReached = attackPathAnalysis.summary.sensitiveAssetsReached;
    const criticalReached = attackPathAnalysis.summary.criticalAssetsReached;

    if (criticalPaths.length > 0) {
      deductions.push({
        category: 'attack-exposure',
        points: 40,
        reason: `${criticalPaths.length} critical attack path(s) reach sensitive targets.`,
        evidence: criticalPaths.map((p) => p.id).join(', '),
      });
      observations.push(`Adversarial reachability traces ${criticalPaths.length} critical path(s).`);
    }

    if (highRiskPaths.length > 0) {
      deductions.push({
        category: 'attack-exposure',
        points: 25,
        reason: `${highRiskPaths.length} high-risk attack path(s) reach internal assets.`,
        evidence: highRiskPaths.map((p) => p.id).join(', '),
      });
      observations.push(`Detected ${highRiskPaths.length} high-risk multi-hop attack path(s).`);
    }

    if (criticalReached > 0 && criticalPaths.length === 0) {
      deductions.push({
        category: 'attack-exposure',
        points: 20,
        reason: `${criticalReached} critical asset(s) reachable from untrusted ingress.`,
      });
    }

    if (sensitiveReached > 0 && criticalPaths.length === 0 && highRiskPaths.length === 0) {
      deductions.push({
        category: 'attack-exposure',
        points: Math.min(25, sensitiveReached * 10),
        reason: `${sensitiveReached} sensitive asset(s) reachable through modeled network paths.`,
      });
    }

    const totalDeductions = deductions.reduce((acc, d) => acc + d.points, 0);
    const score = Math.max(0, 100 - totalDeductions);

    let status: CategoryStatus = 'PASSED';
    if (criticalPaths.length > 0 || score < 50) {
      status = 'BLOCKED';
    } else if (highRiskPaths.length > 0 || sensitiveReached > 0 || score < 75) {
      status = 'WARNING';
    }

    if (observations.length === 0) {
      observations.push('Zero attack paths reach sensitive or critical workloads.');
    }

    categories.push({
      id: 'attack-exposure',
      name: 'Attack Exposure',
      weight: categoryWeights['attack-exposure'],
      score,
      status,
      summary:
        status === 'BLOCKED'
          ? 'Crown-jewel workloads are exposed to untrusted adversarial attack paths.'
          : status === 'WARNING'
          ? 'Internal attack pathways exist that reach sensitive workloads.'
          : 'No attack pathways reach sensitive or restricted internal tiers.',
      observations,
      deductions,
    });
  }

  // ==========================================
  // Category 3: Network Architecture (20%)
  // ==========================================
  {
    const deductions: ReadinessScoreDeduction[] = [];
    const observations: string[] = [];

    const directData = architectureAnalysis.tierAnalysis.hasDirectEdgeToData;
    const archFindings = architectureAnalysis.findings;
    const isFlat = architectureAnalysis.topologyAnalysis.isFlatTopology;
    const segQuality = architectureAnalysis.topologyAnalysis.segmentationQuality;

    if (directData || archFindings.some((f) => f.id === 'ARCH-001')) {
      deductions.push({
        category: 'architecture',
        points: 35,
        reason: 'Direct edge-to-data ingress bypasses application tier boundaries.',
      });
      observations.push('Data stores receive direct ingress without compute mediation.');
    }

    if (archFindings.some((f) => f.id === 'ARCH-002')) {
      deductions.push({
        category: 'architecture',
        points: 20,
        reason: 'Missing application tier: perimeter connects directly to data stores.',
      });
    }

    if (isFlat || archFindings.some((f) => f.id === 'ARCH-003')) {
      deductions.push({
        category: 'architecture',
        points: 25,
        reason: 'Flat internal network topology lacks workload tier segmentation.',
      });
      observations.push('Disparate workloads co-located in an unsegmented internal network.');
    }

    if (archFindings.some((f) => f.id === 'ARCH-004')) {
      deductions.push({
        category: 'architecture',
        points: 20,
        reason: 'Privileged management plane exposed to untrusted sources.',
      });
      observations.push('Administrative interface reachable across trust boundaries.');
    }

    if (archFindings.some((f) => f.id === 'ARCH-007')) {
      deductions.push({
        category: 'architecture',
        points: 15,
        reason: 'Weak perimeter segmentation: compute workloads receive direct uninspected ingress.',
      });
    }

    if (segQuality === 'weak' && !isFlat) {
      deductions.push({
        category: 'architecture',
        points: 10,
        reason: 'Weak network segmentation across trust zones.',
      });
    }

    const totalDeductions = deductions.reduce((acc, d) => acc + d.points, 0);
    const score = Math.max(0, 100 - totalDeductions);

    let status: CategoryStatus = 'PASSED';
    if (directData || archFindings.some((f) => f.id === 'ARCH-001' || f.id === 'ARCH-002') || score < 50) {
      status = 'BLOCKED';
    } else if (isFlat || archFindings.some((f) => f.id === 'ARCH-003' || f.id === 'ARCH-007') || score < 75) {
      status = 'WARNING';
    }

    if (observations.length === 0) {
      observations.push('Multi-tier layered architecture with strong zone segmentation.');
    }

    categories.push({
      id: 'architecture',
      name: 'Network Architecture',
      weight: categoryWeights.architecture,
      score,
      status,
      summary:
        status === 'BLOCKED'
          ? 'Structural architectural bypasses undermine perimeter security boundaries.'
          : status === 'WARNING'
          ? 'Network zoning or perimeter mediation is suboptimal for production isolation.'
          : 'Architecture adheres to layered multi-tier isolation and defensible segmentation.',
      observations,
      deductions,
    });
  }

  // ==========================================
  // Category 4: Access Control (10%)
  // ==========================================
  {
    const deductions: ReadinessScoreDeduction[] = [];
    const observations: string[] = [];

    const broadAccessFindings = findings.filter((f) => f.ruleId === 'PF-007');
    const trustBypassFindings = findings.filter((f) => f.ruleId === 'PF-005');
    const internalBridgingFindings = findings.filter((f) => f.ruleId === 'PF-004');

    if (broadAccessFindings.length > 0) {
      const pts = Math.min(40, broadAccessFindings.length * 20);
      deductions.push({
        category: 'access-control',
        points: pts,
        reason: `${broadAccessFindings.length} overly broad access rule(s) (wildcard ports or ANY protocol).`,
        evidence: broadAccessFindings.map((f) => f.id).join(', '),
      });
      observations.push('Wildcard or overly broad port access permitted to internal tiers.');
    }

    if (trustBypassFindings.length > 0) {
      const pts = Math.min(30, trustBypassFindings.length * 15);
      deductions.push({
        category: 'access-control',
        points: pts,
        reason: `${trustBypassFindings.length} excessive trust relationship(s) bypassing security tiers.`,
      });
    }

    if (internalBridgingFindings.length > 0) {
      const pts = Math.min(40, internalBridgingFindings.length * 25);
      deductions.push({
        category: 'access-control',
        points: pts,
        reason: `${internalBridgingFindings.length} unmediated bridge(s) from untrusted ingress into internal networks.`,
      });
      observations.push('Direct access from public sources into internal network subnets.');
    }

    const totalDeductions = deductions.reduce((acc, d) => acc + d.points, 0);
    const score = Math.max(0, 100 - totalDeductions);

    let status: CategoryStatus = 'PASSED';
    if (internalBridgingFindings.length > 0 || broadAccessFindings.length > 0 || score < 50) {
      status = 'BLOCKED';
    } else if (trustBypassFindings.length > 0 || score < 75) {
      status = 'WARNING';
    }

    if (observations.length === 0) {
      observations.push('Least-privilege port access and defensible boundaries enforced.');
    }

    categories.push({
      id: 'access-control',
      name: 'Access Control',
      weight: categoryWeights['access-control'],
      score,
      status,
      summary:
        status === 'BLOCKED'
          ? 'Overly broad access or unmediated network bridging violates least privilege.'
          : status === 'WARNING'
          ? 'Excessive trust links or broad port permissions require tightening.'
          : 'Access control rules conform to least privilege without wildcard exposure.',
      observations,
      deductions,
    });
  }

  // ==========================================
  // Category 5: Communication Security (10%)
  // ==========================================
  {
    const deductions: ReadinessScoreDeduction[] = [];
    const observations: string[] = [];

    const cleartextFindings = findings.filter((f) => f.ruleId === 'PF-008');
    
    // Check unencrypted allow edges terminating at database, redis, or restricted
    const unencryptedSensitive = edges.filter((e) => {
      if (e.access === 'deny') return false;
      if (e.encrypted) return false;
      const target = environment.getNode(e.target);
      return (
        target &&
        (target.type === 'database' ||
          target.type === 'redis' ||
          target.zone === 'restricted' ||
          target.criticality === 'critical')
      );
    });

    if (cleartextFindings.length > 0 || unencryptedSensitive.length > 0) {
      const count = Math.max(cleartextFindings.length, unencryptedSensitive.length);
      const pts = Math.min(50, count * 35);
      deductions.push({
        category: 'communication',
        points: pts,
        reason: `${count} sensitive communication channel(s) operate over unencrypted cleartext.`,
      });
      observations.push('Sensitive database or restricted traffic lacks transport encryption.');
    }

    const totalDeductions = deductions.reduce((acc, d) => acc + d.points, 0);
    const score = Math.max(0, 100 - totalDeductions);

    let status: CategoryStatus = 'PASSED';
    if (cleartextFindings.length > 0 || unencryptedSensitive.length > 0 || score < 50) {
      status = 'BLOCKED';
    } else if (score < 75) {
      status = 'WARNING';
    }

    if (observations.length === 0) {
      observations.push('Transport encryption (TLS/SSH) verified on sensitive communication channels.');
    }

    categories.push({
      id: 'communication',
      name: 'Communication Security',
      weight: categoryWeights.communication,
      score,
      status,
      summary:
        status === 'BLOCKED'
          ? 'Unencrypted sensitive communication channels expose critical data to interception.'
          : status === 'WARNING'
          ? 'Cleartext communications exist between infrastructure components.'
          : 'Sensitive communication channels enforce encrypted transport.',
      observations,
      deductions,
    });
  }

  // ==========================================
  // Category 6: Resilience & Fragility (5%)
  // ==========================================
  {
    const deductions: ReadinessScoreDeduction[] = [];
    const observations: string[] = [];

    const spofs = architectureAnalysis.dependencyAnalysis.singlePointsOfFailure;
    const isHighConcentration =
      architectureAnalysis.dependencyAnalysis.concentrationRating === 'high';

    if (spofs.length > 0) {
      const pts = Math.min(40, spofs.length * 20);
      deductions.push({
        category: 'resilience',
        points: pts,
        reason: `${spofs.length} potential single point(s) of failure modeled.`,
      });
      observations.push(
        `${spofs.length} component(s) are modeled without redundant replicas (${spofs.map((s) => s.nodeName).slice(0, 2).join(', ')}).`
      );
    }

    if (isHighConcentration) {
      deductions.push({
        category: 'resilience',
        points: 25,
        reason: 'High centralized dependency concentration on critical components.',
      });
      observations.push('Centralized architectural bottlenecks detected.');
    }

    const totalDeductions = deductions.reduce((acc, d) => acc + d.points, 0);
    const score = Math.max(0, 100 - totalDeductions);

    let status: CategoryStatus = 'PASSED';
    if (spofs.length > 0 || isHighConcentration || score < 75) {
      status = 'WARNING';
    }

    if (observations.length === 0) {
      observations.push('Dependencies are distributed across modeled tiers.');
    }

    categories.push({
      id: 'resilience',
      name: 'Resilience & Fragility',
      weight: categoryWeights.resilience,
      score,
      status,
      summary:
        status === 'WARNING'
          ? 'Potential single points of failure exist. Note: actual HA/failover cannot be verified from graph.'
          : 'No severe single-component bottlenecks identified among modeled workloads.',
      observations,
      deductions,
    });
  }

  // ==========================================
  // Category 7: Operational Evidence Coverage (5%)
  // ==========================================
  {
    // Truthfully report that operational controls (backups, DR, monitoring, etc.) are unverified in graph
    const deductions: ReadinessScoreDeduction[] = [
      {
        category: 'evidence-coverage',
        points: 25,
        reason: 'Operational runtime controls (backups, monitoring, alerting, patching) are outside graph scope.',
      },
    ];

    const observations = [
      'Topology model represents structural architecture, not operational runtime execution.',
      'Backups, incident response, secret rotation, and monitoring must be validated separately.',
    ];

    const score = 75; // Standard truthful coverage score for structural-only model
    const status: CategoryStatus = 'UNVERIFIED';

    categories.push({
      id: 'evidence-coverage',
      name: 'Operational Evidence Coverage',
      weight: categoryWeights['evidence-coverage'],
      score,
      status,
      summary: 'UNVERIFIED: Operational runtime controls cannot be established from the network model.',
      observations,
      deductions,
    });
  }

  // ==========================================
  // Weighted Total Score Calculation
  // ==========================================
  let weightedSum = 0;
  for (const cat of categories) {
    weightedSum += (cat.score * cat.weight) / 100;
  }
  const finalScore = Math.max(0, Math.min(100, Math.round(weightedSum)));

  // Score to qualitative rating
  let rating: ProductionReadinessRating;
  if (finalScore >= 90) {
    rating = 'EXCELLENT';
  } else if (finalScore >= 75) {
    rating = 'GOOD';
  } else if (finalScore >= 50) {
    rating = 'NEEDS_ATTENTION';
  } else if (finalScore >= 25) {
    rating = 'POOR';
  } else {
    rating = 'CRITICAL';
  }

  return {
    score: finalScore,
    rating,
    categories,
  };
}
