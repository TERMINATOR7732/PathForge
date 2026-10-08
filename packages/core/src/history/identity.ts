import { Environment } from '../domain/environment.js';
import { EnvironmentSnapshot } from '../comparison/snapshot.js';
import { deterministicStringHash } from '../change-ingestion/normalizer.js';
import { HistoryRecordSource } from './types.js';

/**
 * 64-bit deterministic hash combining two distinct FNV seeds for robust collision resistance.
 */
export function deterministicStringHash64(input: string): string {
  const h1 = deterministicStringHash(input);
  const h2 = deterministicStringHash(`salt-pf-${input}`);
  return `${h1}${h2}`;
}

/**
 * Computes a canonical hash of an infrastructure topology.
 *
 * CRITICAL INVARIANT:
 * Canvas visual coordinates (x, y) are intentionally EXCLUDED.
 * Moving a node across the canvas does NOT change the semantic security topology.
 * Arrays of nodes and edges are strictly sorted by stable ID.
 */
export function computeCanonicalTopologyHash(
  topology: Environment | EnvironmentSnapshot
): string {
  const isDomainEnv = 'getNodes' in topology;

  const nodes = isDomainEnv
    ? topology.getNodes().map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        zone: n.zone,
        criticality: n.criticality,
        service: n.service ? { port: n.service.port, protocol: n.service.protocol } : null,
      }))
    : topology.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        zone: n.metadata?.zone ?? 'public',
        criticality: n.metadata?.criticality ?? 'low',
        service: n.metadata?.service
          ? { port: n.metadata.service.port, protocol: n.metadata.service.protocol }
          : null,
      }));

  const edges = isDomainEnv
    ? topology.getEdges().map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        protocol: e.protocol,
        ports: e.ports,
        access: e.access,
        encrypted: e.encrypted,
      }))
    : topology.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        protocol: e.metadata?.protocol ?? 'TCP',
        ports: e.metadata?.ports ?? '',
        access: e.metadata?.access ?? 'allow',
        encrypted: e.metadata?.encrypted ?? false,
      }));

  // Deterministically sort nodes and edges by id
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => a.id.localeCompare(b.id));

  const canonicalString = JSON.stringify({ nodes, edges });
  return deterministicStringHash64(canonicalString);
}

/**
 * Parameters for generating a stable historical record ID.
 */
export interface GenerateRecordIdParams {
  readonly environmentId: string;
  readonly source: HistoryRecordSource;
  readonly revisionIdentity: string;
  readonly canonicalTopologyHash: string;
  readonly findingIds?: readonly string[];
}

/**
 * Generates a stable, content-derived deterministic identity for a historical record.
 *
 * INVARIANTS:
 * - Timestamps are NEVER included in the ID calculation.
 * - Random UUIDs are forbidden.
 * - Same environment + revision + canonical topology + findings = identical ID.
 */
export function generateHistoryRecordId(params: GenerateRecordIdParams): string {
  const sortedFindings = params.findingIds
    ? [...params.findingIds].sort().join(',')
    : '';

  const key = [
    params.environmentId,
    params.source,
    params.revisionIdentity,
    params.canonicalTopologyHash,
    sortedFindings,
  ].join('::');

  const hash = deterministicStringHash64(key);
  return `hist-${params.source}-${hash}`;
}

/**
 * Sanitizes remote URLs and paths to ensure no passwords or tokens are stored in history.
 */
export function sanitizeHistorySourcePath(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.replace(/\b(ghp|gho|github_pat)_[a-zA-Z0-9_]{16,}\b/gi, '[REDACTED_TOKEN]');
  cleaned = cleaned.replace(/https?:\/\/[^/:]+:[^/@]+@/g, 'https://[REDACTED_CREDS]@');
  return cleaned;
}
