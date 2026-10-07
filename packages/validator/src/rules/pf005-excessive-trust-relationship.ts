import { Finding, FindingEvidence } from '@pathforge/shared';
import { ValidationContext, ValidationRule } from '../types/rule.js';

export class ExcessiveTrustRelationshipRule implements ValidationRule {
  readonly id = 'PF-005';
  readonly name = 'Excessive Trust Relationship / Tier Bypass';
  readonly category = 'trust_boundary';
  readonly defaultSeverity = 'medium';
  readonly description =
    'Detects multi-tier architecture violations where presentation layers directly access persistent data stores, bypassing API application controls, or inappropriate trust relationships across boundaries.';
  readonly enabledByDefault = true;

  evaluate(context: ValidationContext): Finding[] {
    const findings: Finding[] = [];
    const graph = context.environment.graph;

    const webServers = graph.getNodesByType('web_server');
    const apiServers = graph.getNodesByType('api_server');
    const dataNodes = graph
      .getNodes()
      .filter((n) => n.type === 'database' || n.type === 'redis');

    // 1. Tier Bypass: If an API tier exists, web servers should not talk directly to data stores on ALLOW edges
    if (apiServers.length > 0) {
      for (const web of webServers) {
        for (const data of dataNodes) {
          const directEdges = graph.getDirectEdges(web.id, data.id);
          const allowEdges = directEdges.filter((e) => e.access !== 'deny');
          if (allowEdges.length > 0) {
            const edgeIds = allowEdges.map((e) => e.id);
            const primaryEdge = allowEdges[0];
            const evidence: FindingEvidence = {
              sourceNode: web.id,
              sourceName: web.name,
              sourceZone: web.zone,
              targetNode: data.id,
              targetName: data.name,
              targetZone: data.zone,
              targetCriticality: data.criticality,
              protocol: primaryEdge.protocol,
              ports: primaryEdge.ports,
              access: primaryEdge.access,
              encrypted: primaryEdge.encrypted,
              relationship: primaryEdge.relationship,
            };

            findings.push({
              id: `PF-005-tier-bypass-${web.id}-${data.id}`,
              ruleId: this.id,
              severity: this.defaultSeverity,
              category: this.category,
              title: `Medium: Tier Bypass — Frontend Directly Queries Data Tier (${web.name} → ${data.name})`,
              description: `Presentation node "${web.name}" establishes a direct link to data storage node "${data.name}", bypassing intermediate API server tier "${apiServers[0]?.name}". Protocol: ${primaryEdge.protocol}, Port: ${primaryEdge.ports}.`,
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
              evidence,
              metadata: { ...evidence },
            });
          }
        }
      }
    }

    // 2. Dangerous Explicit Trust Relationships: relationship: 'trust' across sensitive boundaries
    for (const edge of graph.getEdges()) {
      if (edge.access === 'deny') continue;

      const source = graph.getNode(edge.source);
      const target = graph.getNode(edge.target);
      if (!source || !target) continue;

      if (edge.relationship === 'trust') {
        const isSourceUntrusted =
          source.type === 'internet' ||
          source.type === 'external_network' ||
          source.zone === 'public';
        const isTargetSensitive =
          target.zone === 'restricted' ||
          target.zone === 'management' ||
          target.zone === 'internal' ||
          target.criticality === 'critical' ||
          target.type === 'database';

        const isDmzToRestricted =
          source.zone === 'dmz' &&
          (target.zone === 'restricted' || target.criticality === 'critical');

        if (isSourceUntrusted && isTargetSensitive) {
          const evidence: FindingEvidence = {
            sourceNode: source.id,
            sourceName: source.name,
            sourceZone: source.zone,
            targetNode: target.id,
            targetName: target.name,
            targetZone: target.zone,
            targetCriticality: target.criticality,
            relationship: edge.relationship,
          };

          findings.push({
            id: `PF-005-trust-${edge.id}`,
            ruleId: this.id,
            severity: 'high',
            category: this.category,
            title: `High: Inappropriate Trust Relationship (${source.name} → ${target.name})`,
            description: `Edge "${edge.id}" establishes an explicit trust relationship from untrusted source "${source.name}" (zone: ${source.zone}) to sensitive asset "${target.name}" (zone: ${target.zone}).`,
            whyItMatters:
              'Trust relationships eliminate mutual verification and bypass boundary validation, exposing critical internal assets to unverified external traffic.',
            impact:
              'External entities are implicitly trusted to access sensitive operations without standard cryptographic authentication or access policy enforcement.',
            affectedNodes: [source.id, target.id],
            affectedEdges: [edge.id],
            recommendation:
              'Change edge relationship to "network" and enforce zero-trust token authentication.',
            remediation:
              `Update edge "${edge.id}" relationship from "trust" to "network" and enforce explicit access control.`,
            evidence,
            metadata: { ...evidence },
          });
        } else if (isDmzToRestricted) {
          const evidence: FindingEvidence = {
            sourceNode: source.id,
            sourceName: source.name,
            sourceZone: source.zone,
            targetNode: target.id,
            targetName: target.name,
            targetZone: target.zone,
            targetCriticality: target.criticality,
            relationship: edge.relationship,
          };

          findings.push({
            id: `PF-005-trust-${edge.id}`,
            ruleId: this.id,
            severity: 'medium',
            category: this.category,
            title: `Medium: Perimeter Trust Boundary Violation (${source.name} → ${target.name})`,
            description: `Edge "${edge.id}" establishes an unmediated trust relationship from DMZ node "${source.name}" into restricted asset "${target.name}".`,
            whyItMatters:
              'DMZ nodes are exposed to external web traffic and represent higher risk of compromise. Direct trust relationships into restricted backend stores undermine defense-in-depth.',
            impact:
              'A compromised DMZ host can abuse implicit trust to execute unrestricted administrative or storage operations.',
            affectedNodes: [source.id, target.id],
            affectedEdges: [edge.id],
            recommendation:
              'Authenticate requests via intermediary API tiers and eliminate transitive trust.',
            remediation:
              `Reconfigure edge "${edge.id}" relationship to standard network dependency.`,
            evidence,
            metadata: { ...evidence },
          });
        }
      }

      // 3. Dangerous Bidirectional trust edges across security boundaries
      if (edge.direction === 'bidirectional') {
        if (
          source.type === 'internet' ||
          source.type === 'external_network' ||
          (target.type === 'database' && source.zone === 'public')
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
