import { Finding, FindingEvidence } from '@pathforge/shared';
import { ValidationContext, ValidationRule } from '../types/rule.js';

export class MissingSecurityBoundaryRule implements ValidationRule {
  readonly id = 'PF-003';
  readonly name = 'Missing Security Boundary';
  readonly category = 'network_boundary';
  readonly defaultSeverity = 'high';
  readonly description =
    'Detects direct public ingress into application compute servers or restricted zones without traversing a perimeter firewall or security gateway.';
  readonly enabledByDefault = true;

  evaluate(context: ValidationContext): Finding[] {
    const findings: Finding[] = [];
    const graph = context.environment.graph;

    const publicSources = graph
      .getNodes()
      .filter(
        (n) =>
          n.type === 'internet' ||
          n.type === 'external_network' ||
          n.zone === 'public'
      );

    // Compute nodes or restricted/internal workloads directly reachable from untrusted sources
    const boundaryRequiredNodes = graph
      .getNodes()
      .filter(
        (n) =>
          n.type === 'web_server' ||
          n.type === 'api_server' ||
          (n.zone === 'restricted' && n.type !== 'database' && n.type !== 'redis')
      );

    for (const source of publicSources) {
      for (const target of boundaryRequiredNodes) {
        if (source.id === target.id) continue;

        const directEdges = graph.getDirectEdges(source.id, target.id);
        const allowEdges = directEdges.filter((e) => e.access !== 'deny');

        if (allowEdges.length > 0) {
          const edgeIds = allowEdges.map((e) => e.id);
          const primaryEdge = allowEdges[0];

          const evidence: FindingEvidence = {
            sourceNode: source.id,
            sourceName: source.name,
            sourceZone: source.zone,
            targetNode: target.id,
            targetName: target.name,
            targetZone: target.zone,
            targetCriticality: target.criticality,
            protocol: primaryEdge.protocol,
            ports: primaryEdge.ports,
            access: primaryEdge.access,
            encrypted: primaryEdge.encrypted,
          };

          findings.push({
            id: `PF-003-${source.id}-${target.id}`,
            ruleId: this.id,
            severity: this.defaultSeverity,
            category: this.category,
            title: `High: Missing Perimeter Security Boundary (${source.name} → ${target.name})`,
            description: `Traffic flows directly from public node "${source.name}" to compute node "${target.name}" without passing through a firewall or protective security boundary. Protocol: ${primaryEdge.protocol}, Port: ${primaryEdge.ports}, Access: ${primaryEdge.access.toUpperCase()}.`,
            whyItMatters:
              'Application servers are optimized for business logic execution, not for filtering raw Layer-3/Layer-4 network anomalies, SYN floods, port scans, or volumetric DDoS attacks.',
            impact:
              'Application compute resources can be exhausted by uninspected volumetric traffic, and unpatched server operating system vulnerabilities remain exposed to the public Internet.',
            affectedNodes: [source.id, target.id],
            affectedEdges: edgeIds,
            recommendation:
              'Introduce a Next-Generation Firewall (NGFW) or Web Application Firewall (WAF) and Load Balancer in front of all public-facing compute instances.',
            remediation:
              `Insert a Firewall or Load Balancer between "${source.name}" and "${target.name}". Remove direct ingress edge(s) [${edgeIds.join(', ')}].`,
            evidence,
            metadata: { ...evidence },
          });
        }
      }
    }

    return findings;
  }
}
