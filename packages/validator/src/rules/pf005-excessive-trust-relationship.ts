import { Finding } from '@pathforge/shared';
import { ValidationContext, ValidationRule } from '../types/rule.js';

export class ExcessiveTrustRelationshipRule implements ValidationRule {
  readonly id = 'PF-005';
  readonly name = 'Excessive Trust Relationship / Tier Bypass';
  readonly category = 'trust_boundary';
  readonly defaultSeverity = 'medium';
  readonly description =
    'Detects multi-tier architecture violations where presentation layers directly access persistent data stores, bypassing API application controls.';
  readonly enabledByDefault = true;

  evaluate(context: ValidationContext): Finding[] {
    const findings: Finding[] = [];
    const graph = context.environment.graph;

    const webServers = graph.getNodesByType('web_server');
    const apiServers = graph.getNodesByType('api_server');
    const dataNodes = graph
      .getNodes()
      .filter((n) => n.type === 'database' || n.type === 'redis');

    // If an API tier exists, web servers should not talk directly to data stores
    if (apiServers.length > 0) {
      for (const web of webServers) {
        for (const data of dataNodes) {
          const directEdges = graph.getDirectEdges(web.id, data.id);
          if (directEdges.length > 0) {
            const edgeIds = directEdges.map((e) => e.id);
            findings.push({
              id: `PF-005-tier-bypass-${web.id}-${data.id}`,
              ruleId: this.id,
              severity: this.defaultSeverity,
              category: this.category,
              title: `Medium: Tier Bypass — Frontend Directly Queries Data Tier (${web.name} → ${data.name})`,
              description: `Presentation node "${web.name}" establishes a direct link to data storage node "${data.name}", bypassing intermediate API server tier "${apiServers[0]?.name}".`,
              whyItMatters:
                'Multi-tier architectures isolate database credentials, query logic, and domain business rules behind an API server tier. Allowing presentation web tiers to talk directly to databases violates tier isolation.',
              impact:
                'If the public-facing web server is compromised via SSRF or template injection, attackers can issue arbitrary queries to data stores without encountering API authentication or business logic rate-limits.',
              affectedNodes: [web.id, data.id],
              affectedEdges: edgeIds,
              recommendation:
                'Channel all database operations through the API tier. Web tier nodes should only issue RPC/REST requests to API servers.',
              remediation:
                `Remove edge(s) [${edgeIds.join(', ')}] between "${web.name}" and "${data.name}". Route requests through API server "${apiServers[0]?.name}".`,
            });
          }
        }
      }
    }

    // Check for bidirectional edges directly into data tier from public or external nodes
    for (const edge of graph.getEdges()) {
      if (edge.metadata?.direction === 'bidirectional') {
        const source = graph.getNode(edge.source);
        const target = graph.getNode(edge.target);
        if (
          (source?.type === 'internet' || source?.type === 'external_network') ||
          (target?.type === 'database' && source?.metadata?.zone === 'public')
        ) {
          findings.push({
            id: `PF-005-bidirectional-${edge.id}`,
            ruleId: this.id,
            severity: 'high',
            category: this.category,
            title: `High: Dangerous Bidirectional Trust Edge (${edge.source} ↔ ${edge.target})`,
            description: `Edge "${edge.id}" establishes bidirectional trust across disparate security zones.`,
            whyItMatters:
              'Bidirectional trust relationships allow compromised endpoints in less-trusted zones to initiate inbound connections to higher-security zones.',
            impact:
              'Reverse shell tunnels, command-and-control pivot channels, and unrestricted lateral traversal.',
            affectedNodes: [edge.source, edge.target],
            affectedEdges: [edge.id],
            recommendation:
              'Replace bidirectional relationships with explicit, unidirectional ingress and egress rules.',
            remediation:
              `Configure edge "${edge.id}" with direction: 'unidirectional' and restrict allowed traffic directions.`,
          });
        }
      }
    }

    return findings;
  }
}
