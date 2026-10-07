import { Environment } from '../domain/environment.js';
import { EnvironmentSnapshot } from './snapshot.js';

export type InfrastructureChangeType =
  | 'node-added'
  | 'node-removed'
  | 'node-config-changed'
  | 'edge-added'
  | 'edge-removed'
  | 'edge-config-changed';

export interface InfrastructureChange {
  id: string;
  type: InfrastructureChangeType;
  targetId: string;
  targetType: 'node' | 'edge';
  label: string;
  description: string;
  isSecurityRelevant: boolean;
  fieldChanges?: Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface InfrastructureDiff {
  hasChanges: boolean;
  hasSecurityRelevantChanges: boolean;
  changes: InfrastructureChange[];
  addedNodeIds: string[];
  removedNodeIds: string[];
  modifiedNodeIds: string[];
  addedEdgeIds: string[];
  removedEdgeIds: string[];
  modifiedEdgeIds: string[];
}

/**
 * Deterministically compares an immutable baseline snapshot with the current environment.
 * Identifies added, removed, and modified components.
 *
 * POSITION RULE: Node position coordinates (x, y) represent presentation layout only.
 * They are explicitly excluded from configuration diffs and never constitute security changes.
 */
export function diffEnvironments(
  baseline: EnvironmentSnapshot,
  current: Environment
): InfrastructureDiff {
  const changes: InfrastructureChange[] = [];

  const baselineNodeMap = new Map(baseline.nodes.map((n) => [n.id, n]));
  const currentNodeMap = new Map(current.getNodes().map((n) => [n.id, n]));

  const addedNodeIds: string[] = [];
  const removedNodeIds: string[] = [];
  const modifiedNodeIds: string[] = [];

  // 1. Detect added nodes
  for (const [nodeId, currNode] of currentNodeMap.entries()) {
    if (!baselineNodeMap.has(nodeId)) {
      addedNodeIds.push(nodeId);
      changes.push({
        id: `change-node-added-${nodeId}`,
        type: 'node-added',
        targetId: nodeId,
        targetType: 'node',
        label: `Node Added: ${currNode.name}`,
        description: `New infrastructure node "${currNode.name}" (${currNode.type}) added in zone "${currNode.zone}".`,
        isSecurityRelevant: true,
        after: {
          id: currNode.id,
          name: currNode.name,
          type: currNode.type,
          zone: currNode.zone,
          criticality: currNode.criticality,
        },
      });
    }
  }

  // 2. Detect removed nodes
  for (const [nodeId, baseNode] of baselineNodeMap.entries()) {
    if (!currentNodeMap.has(nodeId)) {
      removedNodeIds.push(nodeId);
      changes.push({
        id: `change-node-removed-${nodeId}`,
        type: 'node-removed',
        targetId: nodeId,
        targetType: 'node',
        label: `Node Removed: ${baseNode.name}`,
        description: `Infrastructure node "${baseNode.name}" (${baseNode.type}) was deleted from the topology.`,
        isSecurityRelevant: true,
        before: {
          id: baseNode.id,
          name: baseNode.name,
          type: baseNode.type,
          zone: baseNode.metadata?.zone,
        },
      });
    }
  }

  // 3. Detect node configuration modifications (EXCLUDING position)
  for (const [nodeId, baseNode] of baselineNodeMap.entries()) {
    const currNode = currentNodeMap.get(nodeId);
    if (!currNode) continue;

    const fieldChanges: Array<{ field: string; before: unknown; after: unknown }> = [];

    if (baseNode.name !== currNode.name) {
      fieldChanges.push({ field: 'name', before: baseNode.name, after: currNode.name });
    }

    const baseZone = baseNode.metadata?.zone ?? 'internal';
    const currZone = currNode.zone;
    if (baseZone !== currZone) {
      fieldChanges.push({ field: 'zone', before: baseZone, after: currZone });
    }

    const baseCrit = baseNode.metadata?.criticality ?? 'medium';
    const currCrit = currNode.criticality;
    if (baseCrit !== currCrit) {
      fieldChanges.push({ field: 'criticality', before: baseCrit, after: currCrit });
    }

    const baseCidr = baseNode.metadata?.cidr ?? '';
    const currCidr = currNode.metadata.cidr ?? '';
    if (baseCidr !== currCidr) {
      fieldChanges.push({ field: 'cidr', before: baseCidr, after: currCidr });
    }

    const basePort = baseNode.metadata?.service?.port;
    const currPort = currNode.service?.port;
    if (basePort !== currPort) {
      fieldChanges.push({ field: 'service.port', before: basePort, after: currPort });
    }

    const baseProto = baseNode.metadata?.service?.protocol;
    const currProto = currNode.service?.protocol;
    if (baseProto !== currProto) {
      fieldChanges.push({ field: 'service.protocol', before: baseProto, after: currProto });
    }

    if (fieldChanges.length > 0) {
      modifiedNodeIds.push(nodeId);
      const descList = fieldChanges
        .map((fc) => `${fc.field}: ${String(fc.before ?? 'none')} → ${String(fc.after ?? 'none')}`)
        .join(', ');

      changes.push({
        id: `change-node-config-${nodeId}`,
        type: 'node-config-changed',
        targetId: nodeId,
        targetType: 'node',
        label: `Node Reconfigured: ${currNode.name}`,
        description: `Configuration updated on "${currNode.name}" (${descList}).`,
        isSecurityRelevant: true,
        fieldChanges,
        before: { ...baseNode.metadata, name: baseNode.name },
        after: { ...currNode.metadata, name: currNode.name },
      });
    }
  }

  // 4. Detect edge additions, removals, and configuration changes
  const baselineEdgeMap = new Map(baseline.edges.map((e) => [e.id, e]));
  const currentEdgeMap = new Map(current.getEdges().map((e) => [e.id, e]));

  const addedEdgeIds: string[] = [];
  const removedEdgeIds: string[] = [];
  const modifiedEdgeIds: string[] = [];

  for (const [edgeId, currEdge] of currentEdgeMap.entries()) {
    if (!baselineEdgeMap.has(edgeId)) {
      addedEdgeIds.push(edgeId);
      changes.push({
        id: `change-edge-added-${edgeId}`,
        type: 'edge-added',
        targetId: edgeId,
        targetType: 'edge',
        label: `Connection Added: ${currEdge.source} → ${currEdge.target}`,
        description: `New edge "${edgeId}" connects ${currEdge.source} to ${currEdge.target} (${currEdge.protocol}:${currEdge.ports}, ${currEdge.access.toUpperCase()}).`,
        isSecurityRelevant: true,
        after: {
          id: currEdge.id,
          source: currEdge.source,
          target: currEdge.target,
          access: currEdge.access,
          protocol: currEdge.protocol,
          ports: currEdge.ports,
          encrypted: currEdge.encrypted,
        },
      });
    }
  }

  for (const [edgeId, baseEdge] of baselineEdgeMap.entries()) {
    if (!currentEdgeMap.has(edgeId)) {
      removedEdgeIds.push(edgeId);
      changes.push({
        id: `change-edge-removed-${edgeId}`,
        type: 'edge-removed',
        targetId: edgeId,
        targetType: 'edge',
        label: `Connection Removed: ${baseEdge.source} → ${baseEdge.target}`,
        description: `Connection "${edgeId}" between ${baseEdge.source} and ${baseEdge.target} was permanently removed.`,
        isSecurityRelevant: true,
        before: {
          id: baseEdge.id,
          source: baseEdge.source,
          target: baseEdge.target,
          access: baseEdge.metadata?.access,
          protocol: baseEdge.metadata?.protocol,
          ports: baseEdge.metadata?.ports,
        },
      });
    }
  }

  for (const [edgeId, baseEdge] of baselineEdgeMap.entries()) {
    const currEdge = currentEdgeMap.get(edgeId);
    if (!currEdge) continue;

    const fieldChanges: Array<{ field: string; before: unknown; after: unknown }> = [];

    const baseAccess = baseEdge.metadata?.access ?? 'allow';
    const currAccess = currEdge.access;
    if (baseAccess !== currAccess) {
      fieldChanges.push({ field: 'access', before: baseAccess, after: currAccess });
    }

    const baseProto = baseEdge.metadata?.protocol ?? 'TCP';
    const currProto = currEdge.protocol;
    if (baseProto !== currProto) {
      fieldChanges.push({ field: 'protocol', before: baseProto, after: currProto });
    }

    const basePorts = baseEdge.metadata?.ports ?? 'ANY';
    const currPorts = currEdge.ports;
    if (basePorts !== currPorts) {
      fieldChanges.push({ field: 'ports', before: basePorts, after: currPorts });
    }

    const baseEncrypted = baseEdge.metadata?.encrypted ?? false;
    const currEncrypted = currEdge.encrypted;
    if (baseEncrypted !== currEncrypted) {
      fieldChanges.push({ field: 'encrypted', before: baseEncrypted, after: currEncrypted });
    }

    const baseRel = baseEdge.metadata?.relationship ?? 'network';
    const currRel = currEdge.relationship;
    if (baseRel !== currRel) {
      fieldChanges.push({ field: 'relationship', before: baseRel, after: currRel });
    }

    if (fieldChanges.length > 0) {
      modifiedEdgeIds.push(edgeId);
      const descList = fieldChanges
        .map((fc) => `${fc.field}: ${String(fc.before).toUpperCase()} → ${String(fc.after).toUpperCase()}`)
        .join(', ');

      changes.push({
        id: `change-edge-config-${edgeId}`,
        type: 'edge-config-changed',
        targetId: edgeId,
        targetType: 'edge',
        label: `Connection Policy Changed: ${currEdge.source} → ${currEdge.target}`,
        description: `Edge "${edgeId}" updated (${descList}).`,
        isSecurityRelevant: true,
        fieldChanges,
        before: { ...baseEdge.metadata, source: baseEdge.source, target: baseEdge.target },
        after: { ...currEdge.metadata, source: currEdge.source, target: currEdge.target },
      });
    }
  }

  return {
    hasChanges: changes.length > 0,
    hasSecurityRelevantChanges: changes.some((c) => c.isSecurityRelevant),
    changes,
    addedNodeIds,
    removedNodeIds,
    modifiedNodeIds,
    addedEdgeIds,
    removedEdgeIds,
    modifiedEdgeIds,
  };
}
