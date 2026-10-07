import { Finding, FindingEvidence } from '@pathforge/shared';
import { ValidationContext, ValidationRule } from '../types/rule.js';

const COMMON_DB_PORTS = [5432, 3306, 27017, 6379, 1433];
const DB_SERVICE_KEYWORDS = ['postgres', 'mysql', 'mongo', 'redis', 'mssql', 'database', 'db'];

export class PublicDatabaseExposureRule implements ValidationRule {
  readonly id = 'PF-001';
  readonly name = 'Public Database Exposure';
  readonly category = 'exposure';
  readonly defaultSeverity = 'critical';
  readonly description =
    'Detects direct network ingress from untrusted public networks to database or cache nodes.';
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

    const isDataNode = (node: (typeof publicSources)[0]) => {
      if (node.type === 'database' || node.type === 'redis') return true;
      if (node.service?.port && COMMON_DB_PORTS.includes(node.service.port)) return true;
      if (
        node.service?.name &&
        DB_SERVICE_KEYWORDS.some((kw) =>
          node.service?.name?.toLowerCase().includes(kw)
        )
      ) {
        return true;
      }
      return false;
    };

    const dataNodes = graph.getNodes().filter(isDataNode);

    for (const source of publicSources) {
      for (const target of dataNodes) {
        if (source.id === target.id) continue;

        const directEdges = graph.getDirectEdges(source.id, target.id);
        // CRITICAL PRINCIPLE: Only active ALLOW edges constitute reachable exposure.
        // A configured DENY edge blocks traffic and must NOT be flagged as exposure.
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
            id: `PF-001-${source.id}-${target.id}`,
            ruleId: this.id,
            severity: this.defaultSeverity,
            category: this.category,
            title: `Critical: Public Database Exposure (${source.name} → ${target.name})`,
            description: `A direct connection was found from untrusted node "${source.name}" to data node "${target.name}". Protocol: ${primaryEdge.protocol}, Port: ${primaryEdge.ports}, Access: ${primaryEdge.access.toUpperCase()}, Channel: ${primaryEdge.encrypted ? 'Encrypted' : 'Unencrypted'}, Target Zone: ${target.zone}, Criticality: ${target.criticality}.`,
            whyItMatters:
              'Databases and in-memory caches must never be directly exposed to the public Internet or untrusted external networks. They lack hardened public-facing application layers and Web Application Firewall (WAF) mitigations.',
            impact:
              'Remote unauthenticated attackers can probe database ports, attempt brute-force authentication, exploit known database engine CVEs, or directly exfiltrate sensitive persisted records without traversing application authorization boundaries.',
            affectedNodes: [source.id, target.id],
            affectedEdges: edgeIds,
            recommendation:
              'Route all traffic through a secure DMZ tier (Firewall → Load Balancer → Web/API App Server) and relocate the database into an isolated private network segment accessible only by authenticated application services.',
            remediation:
              `Delete direct edge(s) [${edgeIds.join(', ')}] connecting "${source.name}" to "${target.name}". Connect the application tier to "${target.name}" instead.`,
            evidence,
            metadata: { ...evidence },
          });
        }
      }
    }

    return findings;
  }
}
