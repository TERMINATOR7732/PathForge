/**
 * PathForge Shared Types & Core Constants
 * Build. Break. Defend. Prove.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type RuleCategory =
  | 'exposure'
  | 'network_boundary'
  | 'access_control'
  | 'trust_boundary'
  | 'topology_anomaly'
  | 'unrestricted_reachability';

export type CoreNodeType =
  | 'internet'
  | 'firewall'
  | 'load_balancer'
  | 'web_server'
  | 'api_server'
  | 'database'
  | 'redis'
  | 'admin'
  | 'vpn'
  | 'internal_network'
  | 'external_network';

export type NodeType = CoreNodeType | (string & {});

export type NodeZone =
  | 'public'
  | 'dmz'
  | 'internal'
  | 'restricted'
  | 'management'
  | 'private' // backward compatibility with earlier baseline JSONs
  | (string & {});

export type AssetCriticality = 'low' | 'medium' | 'high' | 'critical';

export interface NodeServiceInfo {
  name?: string;
  port?: number;
  protocol?: string;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeMetadata {
  zone?: NodeZone;
  cidr?: string; // e.g. "10.0.1.10/32" or "10.0.1.0/24"
  criticality?: AssetCriticality;
  service?: NodeServiceInfo;
  tags?: string[];
  os?: string;
  version?: string;
  description?: string;
  [key: string]: unknown;
}

export type EdgeProtocol =
  | 'TCP'
  | 'UDP'
  | 'HTTP'
  | 'HTTPS'
  | 'SSH'
  | 'TLS'
  | 'ICMP'
  | 'ANY'
  | (string & {});

export type EdgeAccess = 'allow' | 'deny';

export type EdgeRelationship =
  | 'network'
  | 'management'
  | 'trust'
  | 'dependency'
  | (string & {});

export interface SinglePortConfig {
  type: 'single';
  value: number;
}

export interface RangePortConfig {
  type: 'range';
  start: number;
  end: number;
}

export interface AnyPortConfig {
  type: 'any';
}

export type PortConfig = SinglePortConfig | RangePortConfig | AnyPortConfig;

export interface EdgeMetadata {
  protocol?: EdgeProtocol;
  ports?: string; // Human-readable/string representation (e.g. "443", "8000-8080", "ANY")
  portConfig?: PortConfig; // Structured port representation
  direction?: 'unidirectional' | 'bidirectional';
  access?: EdgeAccess;
  relationship?: EdgeRelationship;
  trust?: 'untrusted' | 'semi-trusted' | 'trusted';
  encrypted?: boolean;
  description?: string;
  [key: string]: unknown;
}

export interface NodeDefinition {
  id: string;
  type: NodeType;
  name: string;
  position?: NodePosition;
  metadata?: NodeMetadata;
}

export interface EdgeDefinition {
  id: string;
  source: string;
  target: string;
  metadata?: EdgeMetadata;
}

export interface EnvironmentMetadata {
  version: string;
  createdAt: string;
  updatedAt: string;
  author?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface EnvironmentDefinition {
  id: string;
  name: string;
  description: string;
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
  metadata: EnvironmentMetadata;
}

export interface FindingEvidence {
  sourceNode?: string;
  sourceName?: string;
  sourceZone?: NodeZone;
  targetNode?: string;
  targetName?: string;
  targetZone?: NodeZone;
  targetCriticality?: AssetCriticality;
  protocol?: EdgeProtocol;
  ports?: string;
  access?: EdgeAccess;
  encrypted?: boolean;
  relationship?: EdgeRelationship;
  direction?: string;
  [key: string]: unknown;
}

/**
 * Finding model.
 * PathForge core principle: Never simply say "this is wrong." Explain why.
 */
export interface Finding {
  id: string;
  ruleId: string;
  severity: Severity;
  category: RuleCategory;
  title: string;
  description: string;
  whyItMatters: string;
  impact: string;
  affectedNodes: string[];
  affectedEdges: string[];
  recommendation: string;
  remediation: string;
  evidence?: FindingEvidence;
  metadata?: Record<string, unknown>;
}

export interface ValidationSummary {
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  passed: boolean;
}

export interface ValidationResult {
  environmentId: string;
  evaluatedAt: string;
  findings: Finding[];
  summary: ValidationSummary;
  rulesEvaluated: number;
}
