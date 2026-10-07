import { Finding, FindingEvidence } from '@pathforge/shared';
import { ValidationContext, ValidationRule } from '../types/rule.js';

export class UntrustedToInternalNetworkRule implements ValidationRule {
  readonly id = 'PF-004';
  readonly name = 'Untrusted Network to Internal Network Boundary Violation';
  readonly category = 'network_boundary';
  readonly defaultSeverity = 'critical';
  readonly description =
    'Detects unmediated network links connecting untrusted external networks directly into private internal network segments.';
  readonly enabledByDefault = true;

  evaluate(context: ValidationContext): Finding[] {
    const findings: Finding[] = [];
    const graph = context.environment.graph;

    const untrustedSources = graph
      .getNodes()
      .filter(
        (n) =>
          n.type === 'internet' ||
          n.type === 'external_network' ||
          n.zone === 'public'
      );

    const internalNetworks = graph
      .getNodes()
      .filter(
        (n) =>
          n.type === 'internal_network' ||
          (n.zone === 'internal' && n.type !== 'web_server' && n.type !== 'api_server' && n.type !== 'database')
      );

    for (const source of untrustedSources) {
      for (const target of internalNetworks) {
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
            id: `PF-004-${source.id}-${target.id}`,
            ruleId: this.id,
            severity: this.defaultSeverity,
            category: this.category,
            title: `Critical: Untrusted Network Directly Bridged to Internal Network (${source.name} → ${target.name})`,
            description: `A direct edge connects untrusted network "${source.name}" directly into internal network segment "${target.name}". Protocol: ${primaryEdge.protocol}, Port: ${primaryEdge.ports}, Access: ${primaryEdge.access.toUpperCase()}.`,
            whyItMatters:
              'Internal networks typically operate with permissive internal trust assumptions and unauthenticated microservices. Directly bridging external networks into an internal segment bypasses all perimeter security defenses.',
            impact:
              'External adversaries gain uninhibited broadcast and routing access to internal hosts, internal metadata services, private APIs, and unhardened cluster utilities.',
            affectedNodes: [source.id, target.id],
            affectedEdges: edgeIds,
            recommendation:
              'Isolate external ingress into a DMZ. Use strict perimeter firewalls or authenticated VPN gateways before routing any traffic to internal segments.',
            remediation:
              `Remove direct edge(s) [${edgeIds.join(', ')}] bridging "${source.name}" to "${target.name}". Terminate external traffic in a DMZ or VPN.`,
            evidence,
            metadata: { ...evidence },
          });
        }
      }
    }

    return findings;
  }
}
