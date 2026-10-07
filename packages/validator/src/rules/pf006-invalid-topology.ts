import { Finding } from '@pathforge/shared';
import { ValidationContext, ValidationRule } from '../types/rule.js';

export class InvalidTopologyRule implements ValidationRule {
  readonly id = 'PF-006';
  readonly name = 'Invalid or Anomalous Network Topology';
  readonly category = 'topology_anomaly';
  readonly defaultSeverity = 'medium';
  readonly description =
    'Detects topological anomalies including self-loops, orphaned isolated infrastructure components, and reverse egress flows.';
  readonly enabledByDefault = true;

  evaluate(context: ValidationContext): Finding[] {
    const findings: Finding[] = [];
    const graph = context.environment.graph;
    const nodes = graph.getNodes();
    const edges = graph.getEdges();

    // 1. Self loops
    for (const edge of edges) {
      if (edge.source === edge.target) {
        findings.push({
          id: `PF-006-self-loop-${edge.id}`,
          ruleId: this.id,
          severity: 'medium',
          category: this.category,
          title: `Medium: Self-Referential Network Edge (${edge.source} ↺)`,
          description: `Edge "${edge.id}" connects node "${edge.source}" directly to itself.`,
          whyItMatters:
            'A network interface routing packets back into itself indicates circular routing, feedback loops, or unintended topology state.',
          impact:
            'Packet storms, routing oscillation, or dead-end routing rules.',
          affectedNodes: [edge.source],
          affectedEdges: [edge.id],
          recommendation: 'Remove recursive or self-referential edge connections.',
          remediation: `Delete self-loop edge "${edge.id}".`,
        });
      }
    }

    // 2. Orphan nodes (if more than 1 node exists)
    if (nodes.length > 1) {
      for (const node of nodes) {
        const degree = graph.getDegree(node.id);
        if (degree.total === 0) {
          findings.push({
            id: `PF-006-orphan-${node.id}`,
            ruleId: this.id,
            severity: 'low',
            category: this.category,
            title: `Low: Orphaned Infrastructure Component ("${node.name}")`,
            description: `Node "${node.name}" (${node.id}) is completely isolated with no incoming or outgoing network edges.`,
            whyItMatters:
              'Unconnected infrastructure instances in architecture diagrams often signify legacy unmanaged infrastructure, shadow IT, or forgotten assets that receive neither security patches nor monitoring.',
            impact:
              'Unmonitored assets can become unmaintained targets or incur unnecessary resource waste.',
            affectedNodes: [node.id],
            affectedEdges: [],
            recommendation:
              'Connect this component to the appropriate network segment or decommission it.',
            remediation: `Add inbound/outbound edges for "${node.name}" or remove it from the topology.`,
          });
        }
      }
    }

    // 3. Database initiating outbound traffic to Internet
    const dataNodes = graph
      .getNodes()
      .filter((n) => n.type === 'database' || n.type === 'redis');
    const internetNodes = graph
      .getNodes()
      .filter((n) => n.type === 'internet');

    for (const data of dataNodes) {
      for (const net of internetNodes) {
        const outbound = graph.getDirectEdges(data.id, net.id);
        if (outbound.length > 0) {
          const edgeIds = outbound.map((e) => e.id);
          findings.push({
            id: `PF-006-data-egress-${data.id}-${net.id}`,
            ruleId: this.id,
            severity: 'high',
            category: this.category,
            title: `High: Data Store Egress Directly to Public Internet (${data.name} → ${net.name})`,
            description: `Database node "${data.name}" initiates outbound connections directly to the Internet "${net.name}".`,
            whyItMatters:
              'Databases have no legitimate operational reason to initiate outbound connections directly to public internet IP ranges. This is a classic indicator of automated data exfiltration or reverse-shell command-and-control.',
            impact:
              'Data exfiltration by compromised database plugins, or attackers establishing reverse interactive command shells.',
            affectedNodes: [data.id, net.id],
            affectedEdges: edgeIds,
            recommendation:
              'Block all outbound Internet egress from databases at the perimeter firewall. Any required outbound telemetry or updates should route through an internal proxy.',
            remediation:
              `Remove direct egress edge(s) [${edgeIds.join(', ')}] from database "${data.name}".`,
          });
        }
      }
    }

    return findings;
  }
}
