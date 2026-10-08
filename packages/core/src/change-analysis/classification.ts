import { Environment } from '../domain/environment.js';
import { EnvironmentSnapshot } from '../comparison/snapshot.js';
import { InfrastructureDiff, InfrastructureChange } from '../comparison/diff.js';
import {
  EngineeringChangeType,
  InfrastructureChangeItem,
  InfrastructureChangeFieldDiff,
  SecuritySignificance,
} from './types.js';

interface NodeLike {
  id: string;
  type?: string;
  zone?: string;
  criticality?: string;
  metadata?: {
    zone?: string;
    criticality?: string;
    service?: { port?: number; protocol?: string };
    [key: string]: unknown;
  };
  service?: { port?: number; protocol?: string };
}

function getNodeZone(node?: NodeLike | null): string {
  if (!node) return 'internal';
  return (node.zone ?? node.metadata?.zone ?? 'internal').toLowerCase().trim();
}

function getNodeType(node?: NodeLike | null): string {
  if (!node) return '';
  return (node.type ?? '').toLowerCase().trim();
}

function getNodeCriticality(node?: NodeLike | null): string {
  if (!node) return 'medium';
  return (node.criticality ?? node.metadata?.criticality ?? 'medium').toLowerCase().trim();
}

function isUntrustedIngressNode(node?: NodeLike | null): boolean {
  if (!node) return false;
  const zone = getNodeZone(node);
  const type = getNodeType(node);
  return zone === 'public' || type === 'internet' || type === 'external_network';
}

function isSensitiveAssetNode(node?: NodeLike | null): boolean {
  if (!node) return false;
  const crit = getNodeCriticality(node);
  if (crit === 'critical' || crit === 'high') return true;
  const zone = getNodeZone(node);
  if (zone === 'restricted') return true;
  const type = getNodeType(node);
  return type === 'database' || type === 'redis' || type === 'admin' || type === 'vpn';
}

function isDefensiveComponentNode(node?: NodeLike | null): boolean {
  if (!node) return false;
  const type = getNodeType(node);
  return type === 'firewall' || type === 'load_balancer' || type === 'vpn';
}

function mapDiffType(diffType: InfrastructureChange['type']): EngineeringChangeType {
  switch (diffType) {
    case 'node-added':
      return 'NODE_ADDED';
    case 'node-removed':
      return 'NODE_REMOVED';
    case 'node-config-changed':
      return 'NODE_CONFIG_CHANGED';
    case 'edge-added':
      return 'EDGE_ADDED';
    case 'edge-removed':
      return 'EDGE_REMOVED';
    case 'edge-config-changed':
      return 'EDGE_CONFIG_CHANGED';
  }
}

/**
 * Classifies an added node.
 */
function classifyNodeAdded(
  nodeId: string,
  current: Environment
): { classification: SecuritySignificance; reason: string } {
  const currNode = current.getNode(nodeId);
  if (!currNode) {
    return { classification: 'security-neutral', reason: 'Node added to topology' };
  }

  if (isUntrustedIngressNode(currNode)) {
    // Check if it has outgoing allow edges to sensitive assets
    const outgoing = current.getEdges().filter((e) => e.source === nodeId && e.access === 'allow');
    const connectsToSensitive = outgoing.some((e) => {
      const tgt = current.getNode(e.target);
      return isSensitiveAssetNode(tgt);
    });

    if (connectsToSensitive || outgoing.length > 0) {
      return {
        classification: 'security-decreasing',
        reason: 'New untrusted ingress node added with active connectivity to infrastructure assets',
      };
    }

    return {
      classification: 'security-neutral',
      reason: 'New ingress node added without active connections',
    };
  }

  if (isDefensiveComponentNode(currNode)) {
    return {
      classification: 'security-increasing',
      reason: `Defensive security boundary component "${currNode.name}" (${currNode.type}) added`,
    };
  }

  return {
    classification: 'security-neutral',
    reason: `Infrastructure component "${currNode.name}" (${currNode.type}) added in zone "${currNode.zone}"`,
  };
}

/**
 * Classifies a removed node.
 */
function classifyNodeRemoved(
  nodeId: string,
  baseline: EnvironmentSnapshot
): { classification: SecuritySignificance; reason: string } {
  const baseNode = baseline.nodes.find((n) => n.id === nodeId);
  if (!baseNode) {
    return { classification: 'security-neutral', reason: 'Node removed from topology' };
  }

  if (isUntrustedIngressNode(baseNode)) {
    return {
      classification: 'security-increasing',
      reason: `Untrusted ingress entry point "${baseNode.name}" permanently eliminated`,
    };
  }

  if (isDefensiveComponentNode(baseNode)) {
    return {
      classification: 'security-decreasing',
      reason: `Defensive security component "${baseNode.name}" (${baseNode.type}) removed from perimeter`,
    };
  }

  return {
    classification: 'security-neutral',
    reason: `Infrastructure node "${baseNode.name}" (${baseNode.type}) removed from topology`,
  };
}

/**
 * Classifies a reconfigured node.
 */
function classifyNodeConfigChanged(
  nodeId: string,
  fieldDiffs: InfrastructureChangeFieldDiff[],
  current: Environment
): { classification: SecuritySignificance; reason: string } {
  const currNode = current.getNode(nodeId);

  // Check zone changes
  const zoneDiff = fieldDiffs.find((f) => f.field === 'zone');
  if (zoneDiff) {
    const beforeZone = String(zoneDiff.before ?? '').toLowerCase();
    const afterZone = String(zoneDiff.after ?? '').toLowerCase();

    if (beforeZone !== 'public' && afterZone === 'public') {
      return {
        classification: 'security-decreasing',
        reason: `Zone changed from "${beforeZone}" to public untrusted boundary, exposing asset to untrusted scope`,
      };
    }

    if (beforeZone === 'public' && (afterZone === 'internal' || afterZone === 'dmz' || afterZone === 'restricted')) {
      return {
        classification: 'security-increasing',
        reason: `Asset relocated from public zone into protected "${afterZone}" network zone`,
      };
    }
  }

  // Check service changes
  const protoDiff = fieldDiffs.find((f) => f.field === 'service.protocol');
  if (protoDiff) {
    const beforeProto = String(protoDiff.before ?? '').toUpperCase();
    const afterProto = String(protoDiff.after ?? '').toUpperCase();

    if (beforeProto === 'HTTPS' && afterProto === 'HTTP') {
      return {
        classification: 'security-decreasing',
        reason: 'Service listener protocol downgraded from encrypted HTTPS to cleartext HTTP',
      };
    }
    if (beforeProto === 'HTTP' && afterProto === 'HTTPS') {
      return {
        classification: 'security-increasing',
        reason: 'Service listener protocol upgraded to encrypted HTTPS',
      };
    }
  }

  // Check if ONLY criticality changed
  const nonCritDiffs = fieldDiffs.filter((f) => f.field !== 'criticality');
  if (nonCritDiffs.length === 0 && fieldDiffs.some((f) => f.field === 'criticality')) {
    const critDiff = fieldDiffs.find((f) => f.field === 'criticality')!;
    return {
      classification: 'security-neutral',
      reason: `Asset criticality updated (${String(critDiff.before)} → ${String(critDiff.after)}); modifies asset importance classification without directly altering defensive security controls`,
    };
  }

  return {
    classification: 'security-neutral',
    reason: `Node configuration updated on "${currNode?.name ?? nodeId}"`,
  };
}

/**
 * Classifies an added edge.
 */
function classifyEdgeAdded(
  edgeId: string,
  current: Environment
): { classification: SecuritySignificance; reason: string } {
  const currEdge = current.getEdge(edgeId);
  if (!currEdge) {
    return { classification: 'security-neutral', reason: 'Connection added' };
  }

  if (currEdge.access === 'deny') {
    return {
      classification: 'security-increasing',
      reason: `Explicit DENY security barrier added between "${currEdge.source}" and "${currEdge.target}"`,
    };
  }

  const srcNode = current.getNode(currEdge.source);
  const tgtNode = current.getNode(currEdge.target);

  if (isUntrustedIngressNode(srcNode)) {
    if (isSensitiveAssetNode(tgtNode)) {
      return {
        classification: 'security-decreasing',
        reason: 'New untrusted ingress to a sensitive data asset',
      };
    }
    return {
      classification: 'security-decreasing',
      reason: `New untrusted ingress link created from "${srcNode?.name}" to "${tgtNode?.name}"`,
    };
  }

  if (isSensitiveAssetNode(tgtNode) && !currEdge.encrypted && currEdge.access === 'allow') {
    return {
      classification: 'security-decreasing',
      reason: 'Unencrypted communication link added to sensitive asset',
    };
  }

  return {
    classification: 'security-neutral',
    reason: `Internal connection added between "${srcNode?.name ?? currEdge.source}" and "${tgtNode?.name ?? currEdge.target}"`,
  };
}

/**
 * Classifies a removed edge.
 */
function classifyEdgeRemoved(
  edgeId: string,
  baseline: EnvironmentSnapshot
): { classification: SecuritySignificance; reason: string } {
  const baseEdge = baseline.edges.find((e) => e.id === edgeId);
  if (!baseEdge) {
    return { classification: 'security-neutral', reason: 'Connection removed' };
  }

  if (baseEdge.metadata?.access === 'deny') {
    return {
      classification: 'security-decreasing',
      reason: `Explicit security DENY barrier between "${baseEdge.source}" and "${baseEdge.target}" was removed`,
    };
  }

  const srcNode = baseline.nodes.find((n) => n.id === baseEdge.source);
  const tgtNode = baseline.nodes.find((n) => n.id === baseEdge.target);

  if (isUntrustedIngressNode(srcNode) && isSensitiveAssetNode(tgtNode)) {
    return {
      classification: 'security-increasing',
      reason: 'Direct untrusted ingress link to sensitive asset permanently eliminated',
    };
  }

  if (isUntrustedIngressNode(srcNode)) {
    return {
      classification: 'security-increasing',
      reason: 'Untrusted ingress link removed',
    };
  }

  return {
    classification: 'security-neutral',
    reason: `Connection between "${srcNode?.name ?? baseEdge.source}" and "${tgtNode?.name ?? baseEdge.target}" removed`,
  };
}

/**
 * Classifies an edge configuration change.
 */
function classifyEdgeConfigChanged(
  edgeId: string,
  fieldDiffs: InfrastructureChangeFieldDiff[],
  _current: Environment
): { classification: SecuritySignificance; reason: string } {
  let incPoints = 0;
  let decPoints = 0;
  const reasons: string[] = [];

  for (const diff of fieldDiffs) {
    if (diff.field === 'access') {
      const before = String(diff.before ?? '').toLowerCase();
      const after = String(diff.after ?? '').toLowerCase();
      if (before === 'allow' && after === 'deny') {
        incPoints += 2;
        reasons.push('Access policy restricted from ALLOW to strict DENY barrier');
      } else if (before === 'deny' && after === 'allow') {
        decPoints += 2;
        reasons.push('Security barrier lowered from DENY to permissive ALLOW');
      }
    }

    if (diff.field === 'encrypted') {
      const before = Boolean(diff.before);
      const after = Boolean(diff.after);
      if (!before && after) {
        incPoints += 1;
        reasons.push('Sensitive transport channel encrypted');
      } else if (before && !after) {
        decPoints += 1;
        reasons.push('Sensitive communication changed from encrypted to cleartext');
      }
    }

    if (diff.field === 'protocol') {
      const before = String(diff.before ?? '').toUpperCase();
      const after = String(diff.after ?? '').toUpperCase();
      if ((before === 'HTTP' || before === 'TCP') && after === 'HTTPS') {
        incPoints += 1;
        reasons.push('Protocol upgraded to encrypted HTTPS');
      } else if (before === 'HTTPS' && (after === 'HTTP' || after === 'TCP')) {
        decPoints += 1;
        reasons.push('Protocol downgraded from encrypted HTTPS to cleartext');
      }
    }

    if (diff.field === 'ports') {
      const before = String(diff.before ?? '').toUpperCase().trim();
      const after = String(diff.after ?? '').toUpperCase().trim();
      const isBeforeAny = before === 'ANY' || before === '*' || before === 'ANY:ANY' || before.includes('0-65535');
      const isAfterAny = after === 'ANY' || after === '*' || after === 'ANY:ANY' || after.includes('0-65535');

      if (isBeforeAny && !isAfterAny) {
        incPoints += 1;
        reasons.push('Broad access was restricted to a specific protocol and port');
      } else if (!isBeforeAny && isAfterAny) {
        decPoints += 1;
        reasons.push('Port restriction broadened to wildcard ANY access');
      }
    }

    if (diff.field === 'relationship') {
      const before = String(diff.before ?? '').toLowerCase();
      const after = String(diff.after ?? '').toLowerCase();
      if (before !== 'trust' && after === 'trust') {
        decPoints += 1;
        reasons.push('Relationship elevated to full trust across security boundary');
      } else if (before === 'trust' && after !== 'trust') {
        incPoints += 1;
        reasons.push('Trust relationship downgraded to standard network access');
      }
    }
  }

  if (incPoints > 0 && decPoints > 0) {
    return {
      classification: 'security-ambiguous',
      reason: `Edge configuration contains mixed security modifications (${reasons.join('; ')})`,
    };
  }

  if (decPoints > 0) {
    return {
      classification: 'security-decreasing',
      reason: reasons.join('; ') || 'Connection security control weakened',
    };
  }

  if (incPoints > 0) {
    return {
      classification: 'security-increasing',
      reason: reasons.join('; ') || 'Connection security control strengthened',
    };
  }

  return {
    classification: 'security-neutral',
    reason: `Edge "${edgeId}" configuration updated`,
  };
}

/**
 * Deterministically classifies all infrastructure diffs into InfrastructureChangeItem objects.
 */
export function classifyChanges(
  diff: InfrastructureDiff,
  baseline: EnvironmentSnapshot,
  current: Environment
): InfrastructureChangeItem[] {
  const items: InfrastructureChangeItem[] = [];

  for (const change of diff.changes) {
    const type = mapDiffType(change.type);

    const fieldChanges: InfrastructureChangeFieldDiff[] = (change.fieldChanges ?? []).map((fc) => ({
      field: fc.field,
      before: fc.before,
      after: fc.after,
      description: `${fc.field}: ${String(fc.before ?? 'none')} → ${String(fc.after ?? 'none')}`,
    }));

    let affectedNodeIds: string[] = [];
    let affectedEdgeIds: string[] = [];

    if (change.targetType === 'node') {
      affectedNodeIds = [change.targetId];
    } else {
      affectedEdgeIds = [change.targetId];
      const edge = current.getEdge(change.targetId);
      if (edge) {
        affectedNodeIds = [edge.source, edge.target];
      } else {
        const baseEdge = baseline.edges.find((e) => e.id === change.targetId);
        if (baseEdge) {
          affectedNodeIds = [baseEdge.source, baseEdge.target];
        }
      }
    }

    let classification: SecuritySignificance = 'security-neutral';
    let classificationReason = change.description;

    switch (change.type) {
      case 'node-added': {
        const res = classifyNodeAdded(change.targetId, current);
        classification = res.classification;
        classificationReason = res.reason;
        break;
      }
      case 'node-removed': {
        const res = classifyNodeRemoved(change.targetId, baseline);
        classification = res.classification;
        classificationReason = res.reason;
        break;
      }
      case 'node-config-changed': {
        const res = classifyNodeConfigChanged(change.targetId, fieldChanges, current);
        classification = res.classification;
        classificationReason = res.reason;
        break;
      }
      case 'edge-added': {
        const res = classifyEdgeAdded(change.targetId, current);
        classification = res.classification;
        classificationReason = res.reason;
        break;
      }
      case 'edge-removed': {
        const res = classifyEdgeRemoved(change.targetId, baseline);
        classification = res.classification;
        classificationReason = res.reason;
        break;
      }
      case 'edge-config-changed': {
        const res = classifyEdgeConfigChanged(change.targetId, fieldChanges, current);
        classification = res.classification;
        classificationReason = res.reason;
        break;
      }
    }

    items.push({
      id: change.id,
      type,
      targetId: change.targetId,
      targetType: change.targetType,
      label: change.label,
      description: change.description,
      classification,
      classificationReason,
      fieldChanges: fieldChanges.length > 0 ? fieldChanges : undefined,
      before: change.before,
      after: change.after,
      affectedNodeIds,
      affectedEdgeIds,
    });
  }

  // Deterministically sort items by ID
  return items.sort((a, b) => a.id.localeCompare(b.id));
}
