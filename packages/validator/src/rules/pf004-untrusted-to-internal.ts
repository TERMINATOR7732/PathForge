import { Finding } from '@pathforge/shared';
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
      .filter((n) => n.type === 'internet' || n.type === 'external_network');

    const internalNetworks = graph.getNodesByType('internal_network');

    for (const source of untrustedSources) {
      for (const target of internalNetworks) {
        const directEdges = graph.getDirectEdges(source.id, target.id);
        if (directEdges.length > 0) {
          const edgeIds = directEdges.map((e) => e.id);
          findings.push({
            id: `PF-004-${source.id}-${target.id}`,
            ruleId: this.id,
            severity: this.defaultSeverity,
            category: this.category,
            title: `Critical: Untrusted Network Directly Bridged to Internal Network (${source.name} → ${target.name})`,
            description: `A direct edge connects untrusted network "${source.name}" directly into internal network segment "${target.name}".`,
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
          });
        }
      }
    }

    return findings;
  }
}
