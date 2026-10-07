import { EnvironmentDefinition } from '@pathforge/shared';
import { ScenarioDefinition } from './types.js';
import { deserializeEnvironment } from '../serialization/serializer.js';
import { Environment } from '../domain/environment.js';

export const SCENARIO_SECURE_WEB: ScenarioDefinition = {
  id: 'secure-web-app',
  name: 'Secure Web Application',
  shortDescription: 'Production-ready reference architecture',
  purpose: 'Demonstrate what a healthy, properly segmented multi-tier environment looks like with zero high or critical security violations.',
  riskLevel: 'hardened',
  riskLabel: 'Hardened (Zero Critical/High)',
  learningObjective: 'Explore defense-in-depth perimeter inspection, DMZ reverse proxies, explicit trust boundaries, and transport encryption.',
  topologyPreview: 'Internet → Firewall → LB → Web → API → Database & Redis',
  definition: {
    id: 'env-demo-standard-web',
    name: 'Secure Web Application',
    description: 'Hardened baseline architecture: Public ingress passes through a perimeter firewall and load balancer to web frontend, routed through internal API microservices to isolated PostgreSQL and Redis caching tiers.',
    nodes: [
      {
        id: 'node-internet',
        type: 'internet',
        name: 'Public Internet',
        position: { x: 100, y: 240 },
        metadata: { zone: 'public', description: 'Untrusted external incoming network traffic' },
      },
      {
        id: 'node-firewall',
        type: 'firewall',
        name: 'Perimeter WAF & Firewall',
        position: { x: 300, y: 240 },
        metadata: { zone: 'dmz', description: 'Edge inspection filtering TLS 443, rate limiting, and DDoS mitigation' },
      },
      {
        id: 'node-lb',
        type: 'load_balancer',
        name: 'Ingress Load Balancer',
        position: { x: 500, y: 240 },
        metadata: { zone: 'dmz', description: 'Layer 7 reverse proxy terminating TLS and balancing requests' },
      },
      {
        id: 'node-web',
        type: 'web_server',
        name: 'Frontend Web Cluster',
        position: { x: 700, y: 240 },
        metadata: { zone: 'dmz', description: 'Stateless React/Next.js edge server nodes' },
      },
      {
        id: 'node-api',
        type: 'api_server',
        name: 'Core API Service',
        position: { x: 900, y: 240 },
        metadata: { zone: 'private', description: 'Internal business logic API microservice with token authorization' },
      },
      {
        id: 'node-db',
        type: 'database',
        name: 'Primary PostgreSQL DB',
        position: { x: 1100, y: 180 },
        metadata: {
          zone: 'restricted',
          criticality: 'critical',
          description: 'Encrypted relational database cluster in private subnet',
          service: { name: 'postgres', port: 5432, protocol: 'TCP' },
        },
      },
      {
        id: 'node-redis',
        type: 'redis',
        name: 'Redis Session Cache',
        position: { x: 1100, y: 320 },
        metadata: {
          zone: 'restricted',
          description: 'Encrypted in-memory cache and session store',
          service: { name: 'redis', port: 6379, protocol: 'TCP' },
        },
      },
    ],
    edges: [
      {
        id: 'edge-internet-to-fw',
        source: 'node-internet',
        target: 'node-firewall',
        metadata: { protocol: 'https', ports: '443', direction: 'unidirectional', access: 'allow', encrypted: true },
      },
      {
        id: 'edge-fw-to-lb',
        source: 'node-firewall',
        target: 'node-lb',
        metadata: { protocol: 'https', ports: '443', direction: 'unidirectional', access: 'allow', encrypted: true },
      },
      {
        id: 'edge-lb-to-web',
        source: 'node-lb',
        target: 'node-web',
        metadata: { protocol: 'http', ports: '8080', direction: 'unidirectional', access: 'allow', encrypted: false },
      },
      {
        id: 'edge-web-to-api',
        source: 'node-web',
        target: 'node-api',
        metadata: { protocol: 'https', ports: '8443', direction: 'unidirectional', access: 'allow', encrypted: true },
      },
      {
        id: 'edge-api-to-db',
        source: 'node-api',
        target: 'node-db',
        metadata: { protocol: 'tcp', ports: '5432', direction: 'unidirectional', access: 'allow', encrypted: true },
      },
      {
        id: 'edge-api-to-redis',
        source: 'node-api',
        target: 'node-redis',
        metadata: { protocol: 'tcp', ports: '6379', direction: 'unidirectional', access: 'allow', encrypted: true },
      },
    ],
    metadata: {
      version: '1.0.0',
      createdAt: '2026-10-07T12:00:00.000Z',
      updatedAt: '2026-10-07T12:00:00.000Z',
      author: 'PathForge Security Architecture Team',
      tags: ['demo', 'three-tier', 'hardened', 'baseline'],
    },
  },
};

export const SCENARIO_PUBLIC_DB: ScenarioDefinition = {
  id: 'public-db-exposure',
  name: 'Public Database Exposure',
  shortDescription: 'Intentional vulnerability — practice remediation',
  purpose: 'Demonstrate the full Bad Architecture → Finding → Explanation → Fix → Revalidate → Prove workflow.',
  riskLevel: 'critical',
  riskLabel: 'Critical Risk (Gate Blocked)',
  learningObjective: 'Detect PF-001 and PF-008, apply a one-click remediation to block public reachability, and verify that the production gate transitions from BLOCKED to PASSED.',
  topologyPreview: 'Internet → Customer Database (Cleartext 5432)',
  definition: {
    id: 'env-demo-public-db',
    name: 'Public Database Exposure',
    description: 'Critical anti-pattern: A production database is directly exposed to the public Internet with ALLOW access policy over cleartext TCP 5432.',
    nodes: [
      {
        id: 'node-internet',
        type: 'internet',
        name: 'Public Internet',
        position: { x: 160, y: 240 },
        metadata: { zone: 'public', description: 'Untrusted external incoming network traffic' },
      },
      {
        id: 'node-db',
        type: 'database',
        name: 'Customer Database',
        position: { x: 580, y: 240 },
        metadata: {
          zone: 'restricted',
          criticality: 'critical',
          description: 'Relational PostgreSQL database containing customer records and credentials',
          service: { name: 'postgres', port: 5432, protocol: 'TCP' },
        },
      },
    ],
    edges: [
      {
        id: 'edge-internet-to-db',
        source: 'node-internet',
        target: 'node-db',
        metadata: {
          protocol: 'TCP',
          ports: '5432',
          direction: 'unidirectional',
          access: 'allow',
          encrypted: false,
          description: 'DANGEROUS: Unmediated direct public access to database port 5432',
        },
      },
    ],
    metadata: {
      version: '1.0.0',
      createdAt: '2026-10-07T15:00:00.000Z',
      updatedAt: '2026-10-07T15:00:00.000Z',
      author: 'PathForge Security Architecture Team',
      tags: ['demo', 'vulnerable', 'public-db', 'remediation-lab'],
    },
  },
};

export const SCENARIO_FLAT_NETWORK: ScenarioDefinition = {
  id: 'flat-network',
  name: 'Flat / Poorly Segmented Network',
  shortDescription: 'Weak segmentation and excessive trust',
  purpose: 'Demonstrate realistic lateral movement risks when internal systems lack perimeter firewalls and isolation.',
  riskLevel: 'high',
  riskLabel: 'High Risk (Poor Segmentation)',
  learningObjective: 'Identify missing security perimeter boundaries, overly broad access, and tier bypasses that occur when internal subnets are directly bridged to public ingress.',
  topologyPreview: 'Internet → Corp Internal LAN [Web, API, DB, Admin]',
  definition: {
    id: 'env-demo-flat-network',
    name: 'Flat / Poorly Segmented Network',
    description: 'Weak segmentation anti-pattern: Public Internet is bridged directly to an internal switch where Web, API, Database, and Admin reside with no firewall boundary.',
    nodes: [
      {
        id: 'node-internet',
        type: 'internet',
        name: 'Public Internet',
        position: { x: 100, y: 250 },
        metadata: { zone: 'public', description: 'Untrusted external incoming network traffic' },
      },
      {
        id: 'node-internal-net',
        type: 'internal_network',
        name: 'Corp Internal LAN',
        position: { x: 360, y: 250 },
        metadata: { zone: 'internal', cidr: '10.0.0.0/16', description: 'Shared internal subnet switch connecting all company servers without VLANs' },
      },
      {
        id: 'node-web',
        type: 'web_server',
        name: 'Web Portal',
        position: { x: 660, y: 100 },
        metadata: { zone: 'internal', description: 'Company web portal running on shared internal subnet', service: { name: 'http', port: 80, protocol: 'HTTP' } },
      },
      {
        id: 'node-api',
        type: 'api_server',
        name: 'Backend API Service',
        position: { x: 660, y: 200 },
        metadata: { zone: 'internal', description: 'Internal business API service', service: { name: 'http', port: 8080, protocol: 'HTTP' } },
      },
      {
        id: 'node-db',
        type: 'database',
        name: 'Customer Database',
        position: { x: 660, y: 300 },
        metadata: { zone: 'internal', criticality: 'critical', description: 'Production database co-located in same subnet with frontend workloads', service: { name: 'postgres', port: 5432, protocol: 'TCP' } },
      },
      {
        id: 'node-admin',
        type: 'admin',
        name: 'Internal Admin Console',
        position: { x: 660, y: 400 },
        metadata: { zone: 'internal', description: 'System administration server with exposed SSH access', service: { name: 'ssh', port: 22, protocol: 'SSH' } },
      },
    ],
    edges: [
      {
        id: 'edge-internet-to-lan',
        source: 'node-internet',
        target: 'node-internal-net',
        metadata: { protocol: 'ANY', ports: 'ANY', direction: 'unidirectional', access: 'allow', encrypted: false, description: 'DANGEROUS: Untrusted public ingress bridged directly to internal network' },
      },
      {
        id: 'edge-lan-to-web',
        source: 'node-internal-net',
        target: 'node-web',
        metadata: { protocol: 'HTTP', ports: '80', direction: 'unidirectional', access: 'allow', encrypted: false },
      },
      {
        id: 'edge-lan-to-api',
        source: 'node-internal-net',
        target: 'node-api',
        metadata: { protocol: 'HTTP', ports: '8080', direction: 'unidirectional', access: 'allow', encrypted: false },
      },
      {
        id: 'edge-lan-to-db',
        source: 'node-internal-net',
        target: 'node-db',
        metadata: { protocol: 'TCP', ports: '5432', direction: 'unidirectional', access: 'allow', encrypted: false },
      },
      {
        id: 'edge-lan-to-admin',
        source: 'node-internal-net',
        target: 'node-admin',
        metadata: { protocol: 'SSH', ports: '22', direction: 'unidirectional', access: 'allow', encrypted: true },
      },
      {
        id: 'edge-web-to-db',
        source: 'node-web',
        target: 'node-db',
        metadata: { protocol: 'TCP', ports: '5432', direction: 'unidirectional', access: 'allow', encrypted: false, relationship: 'trust', description: 'Improper direct trust link from presentation tier directly to DB' },
      },
    ],
    metadata: {
      version: '1.0.0',
      createdAt: '2026-10-07T15:00:00.000Z',
      updatedAt: '2026-10-07T15:00:00.000Z',
      author: 'PathForge Security Architecture Team',
      tags: ['demo', 'vulnerable', 'flat-network', 'poor-segmentation'],
    },
  },
};

export const SCENARIO_CHAOS_LAB: ScenarioDefinition = {
  id: 'chaos-lab',
  name: 'Chaos Lab',
  shortDescription: 'Break the architecture and observe the consequences',
  purpose: 'Experiment freely with graph mutations. PathForge never blocks insecure designs.',
  riskLevel: 'chaos',
  riskLabel: 'Chaos Sandbox (Multiple Violations)',
  learningObjective: 'Freely create anti-patterns, mutate configurations, and observe deterministic security feedback.',
  topologyPreview: 'Internet → [DB, Admin, LAN], Web → DB:ANY, API → DB:5432',
  definition: {
    id: 'env-demo-compromised-chaos',
    name: 'Chaos Lab',
    description: 'Intentionally compromised environment designed for experimentation: Direct internet database access, exposed admin console, unmediated internal network bridge, and excessive trust bypasses.',
    nodes: [
      {
        id: 'node-internet',
        type: 'internet',
        name: 'Public Internet',
        position: { x: 80, y: 240 },
        metadata: { zone: 'public', description: 'Untrusted external incoming network traffic' },
      },
      {
        id: 'node-web',
        type: 'web_server',
        name: 'Frontend Web App',
        position: { x: 380, y: 90 },
        metadata: { zone: 'dmz', description: 'Public-facing web server', service: { name: 'http', port: 80, protocol: 'HTTP' } },
      },
      {
        id: 'node-api',
        type: 'api_server',
        name: 'Core API Service',
        position: { x: 380, y: 210 },
        metadata: { zone: 'internal', description: 'Backend API service', service: { name: 'http', port: 8080, protocol: 'HTTP' } },
      },
      {
        id: 'node-internal-net',
        type: 'internal_network',
        name: 'Internal Subnet',
        position: { x: 380, y: 350 },
        metadata: { zone: 'internal', cidr: '10.0.0.0/24', description: 'Internal network segment' },
      },
      {
        id: 'node-db',
        type: 'database',
        name: 'Production Database',
        position: { x: 740, y: 150 },
        metadata: {
          zone: 'restricted',
          criticality: 'critical',
          description: 'Core database cluster containing user credentials and PII',
          service: { name: 'postgres', port: 5432, protocol: 'TCP' },
        },
      },
      {
        id: 'node-admin',
        type: 'admin',
        name: 'Admin Management Console',
        position: { x: 740, y: 310 },
        metadata: {
          zone: 'management',
          description: 'Cluster management console with administrative shell',
          service: { name: 'ssh', port: 22, protocol: 'SSH' },
        },
      },
    ],
    edges: [
      {
        id: 'edge-chaos-internet-to-db',
        source: 'node-internet',
        target: 'node-db',
        metadata: { protocol: 'TCP', ports: '5432', direction: 'unidirectional', access: 'allow', encrypted: false, description: 'DANGEROUS: Direct public database access configured for quick debugging' },
      },
      {
        id: 'edge-chaos-internet-to-admin',
        source: 'node-internet',
        target: 'node-admin',
        metadata: { protocol: 'SSH', ports: '22', direction: 'unidirectional', access: 'allow', encrypted: true, description: 'DANGEROUS: Admin management SSH console exposed directly to Internet' },
      },
      {
        id: 'edge-chaos-internet-to-internal',
        source: 'node-internet',
        target: 'node-internal-net',
        metadata: { protocol: 'ANY', ports: 'ANY', direction: 'unidirectional', access: 'allow', encrypted: false, description: 'DANGEROUS: Untrusted public ingress bridging directly into internal subnet' },
      },
      {
        id: 'edge-chaos-web-to-db',
        source: 'node-web',
        target: 'node-db',
        metadata: { protocol: 'TCP', ports: 'ANY', direction: 'unidirectional', access: 'allow', encrypted: false, description: 'DANGEROUS: Web tier queries database with wildcard ports bypassing API' },
      },
      {
        id: 'edge-chaos-api-to-db',
        source: 'node-api',
        target: 'node-db',
        metadata: { protocol: 'TCP', ports: '5432', direction: 'unidirectional', access: 'allow', encrypted: false, description: 'API tier connects to DB over unencrypted cleartext channel' },
      },
    ],
    metadata: {
      version: '1.0.0',
      createdAt: '2026-10-07T15:00:00.000Z',
      updatedAt: '2026-10-07T15:00:00.000Z',
      author: 'PathForge Security Architecture Team',
      tags: ['demo', 'chaos', 'vulnerable', 'experimentation-sandbox'],
    },
  },
};

export const SCENARIO_CATALOG: readonly ScenarioDefinition[] = Object.freeze([
  SCENARIO_SECURE_WEB,
  SCENARIO_PUBLIC_DB,
  SCENARIO_FLAT_NETWORK,
  SCENARIO_CHAOS_LAB,
]);

export function getAllScenarios(): readonly ScenarioDefinition[] {
  return SCENARIO_CATALOG;
}

export function getScenarioById(id: string): ScenarioDefinition | undefined {
  return SCENARIO_CATALOG.find((s) => s.id === id);
}

export function getDefaultScenario(): ScenarioDefinition {
  return SCENARIO_SECURE_WEB;
}

export function instantiateScenario(scenarioOrId: ScenarioDefinition | string): Environment {
  const scenario = typeof scenarioOrId === 'string' ? getScenarioById(scenarioOrId) : scenarioOrId;
  if (!scenario) {
    throw new Error(`Scenario not found: ${scenarioOrId}`);
  }
  const clonedDef = JSON.parse(JSON.stringify(scenario.definition)) as EnvironmentDefinition;
  return deserializeEnvironment(clonedDef);
}
