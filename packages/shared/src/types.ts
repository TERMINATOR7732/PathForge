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

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeMetadata {
  zone?: 'public' | 'dmz' | 'private' | 'restricted' | string;
  os?: string;
  version?: string;
  tags?: string[];
  description?: string;
  [key: string]: unknown;
}

export interface EdgeMetadata {
  protocol?: 'tcp' | 'udp' | 'icmp' | 'http' | 'https' | 'ssh' | 'all' | string;
  ports?: string;
  direction?: 'unidirectional' | 'bidirectional';
  access?: 'allow' | 'deny';
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
