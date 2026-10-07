import React from 'react';
import { Finding } from '@pathforge/shared';
import { Check, X, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface RecommendedArchitectureViewProps {
  finding: Finding;
}

interface PatternDiagram {
  ruleId: string;
  flawSummary: string;
  recommendedSummary: string;
  currentFlow: Array<{ label: string; zone?: string; type: 'source' | 'edge' | 'target' | 'warning' }>;
  recommendedFlow: Array<{ label: string; zone?: string; type: 'node' | 'edge' | 'safe' }>;
  keyPrinciples: string[];
}

const ARCHITECTURE_PATTERNS: Record<string, PatternDiagram> = {
  'PF-001': {
    ruleId: 'PF-001',
    flawSummary: 'Direct unmediated ingress from untrusted public network into database storage tier.',
    recommendedSummary: 'Isolated multi-tier segmentation with application boundary and private subnet placement.',
    currentFlow: [
      { label: 'Internet', zone: 'public', type: 'source' },
      { label: 'ALLOW (5432)', type: 'warning' },
      { label: 'Database', zone: 'restricted', type: 'target' },
    ],
    recommendedFlow: [
      { label: 'Internet', zone: 'public', type: 'node' },
      { label: 'HTTPS (443)', type: 'edge' },
      { label: 'Firewall / WAF', zone: 'dmz', type: 'node' },
      { label: 'Forward', type: 'edge' },
      { label: 'API Server', zone: 'internal', type: 'node' },
      { label: 'TLS (5432)', type: 'edge' },
      { label: 'Database', zone: 'restricted', type: 'safe' },
    ],
    keyPrinciples: [
      'Databases must reside exclusively in isolated private/restricted tiers.',
      'Perimeter clients must interact exclusively with hardened application gateways.',
      'Direct database ingress from public Internet addresses must be blocked with DENY policy.',
    ],
  },

  'PF-002': {
    ruleId: 'PF-002',
    flawSummary: 'Remote administrative ports (SSH, RDP, Web Admin) directly exposed to untrusted clients.',
    recommendedSummary: 'Administrative isolation behind authenticated bastion gateway with encrypted transport.',
    currentFlow: [
      { label: 'Internet', zone: 'public', type: 'source' },
      { label: 'ALLOW (SSH / 22)', type: 'warning' },
      { label: 'Admin Interface', zone: 'management', type: 'target' },
    ],
    recommendedFlow: [
      { label: 'Internet', zone: 'public', type: 'node' },
      { label: 'MFA VPN', type: 'edge' },
      { label: 'Bastion / Jump Host', zone: 'dmz', type: 'node' },
      { label: 'Internal SSH', type: 'edge' },
      { label: 'Admin Target', zone: 'management', type: 'safe' },
    ],
    keyPrinciples: [
      'Never expose administration endpoints to unauthenticated public networks.',
      'Mandate MFA-protected VPN or Bastion gateways for operational access.',
      'Audit and restrict access using short-lived credentials and role-based policies.',
    ],
  },

  'PF-003': {
    ruleId: 'PF-003',
    flawSummary: 'Missing perimeter security inspection boundary between untrusted sources and infrastructure.',
    recommendedSummary: 'Deploy dedicated Stateful Firewall or WAF as the first ingress hop.',
    currentFlow: [
      { label: 'Internet', zone: 'public', type: 'source' },
      { label: 'Unfiltered Ingress', type: 'warning' },
      { label: 'Internal Service', zone: 'internal', type: 'target' },
    ],
    recommendedFlow: [
      { label: 'Internet', zone: 'public', type: 'node' },
      { label: 'Ingress Hop', type: 'edge' },
      { label: 'Perimeter Firewall / WAF', zone: 'dmz', type: 'node' },
      { label: 'Filtered', type: 'edge' },
      { label: 'Internal Service', zone: 'internal', type: 'safe' },
    ],
    keyPrinciples: [
      'All traffic crossing network trust boundaries must undergo stateful packet inspection.',
      'Block unadvertised ports and anomalous packet signatures at perimeter boundary.',
    ],
  },

  'PF-004': {
    ruleId: 'PF-004',
    flawSummary: 'Untrusted network directly ingress into internal protected subnet bypassing DMZ tier.',
    recommendedSummary: 'Establish a DMZ inspection tier to terminate external connections before internal forwarding.',
    currentFlow: [
      { label: 'Untrusted Source', zone: 'public', type: 'source' },
      { label: 'Direct Bypass', type: 'warning' },
      { label: 'Internal Network', zone: 'internal', type: 'target' },
    ],
    recommendedFlow: [
      { label: 'Untrusted Source', zone: 'public', type: 'node' },
      { label: 'Perimeter', type: 'edge' },
      { label: 'DMZ Reverse Proxy', zone: 'dmz', type: 'node' },
      { label: 'Authorized RPC', type: 'edge' },
      { label: 'Internal Network', zone: 'internal', type: 'safe' },
    ],
    keyPrinciples: [
      'Untrusted networks must terminate sessions in the DMZ.',
      'Internal networks must reject direct routing from external sources.',
    ],
  },

  'PF-005': {
    ruleId: 'PF-005',
    flawSummary: 'Tier bypass / excessive trust relationship bypassing standard n-tier architecture hierarchy.',
    recommendedSummary: 'Enforce strict tiered hierarchy: Ingress → DMZ → Application Tier → Data Storage Tier.',
    currentFlow: [
      { label: 'DMZ Web', zone: 'dmz', type: 'source' },
      { label: 'Bypass App Layer', type: 'warning' },
      { label: 'Restricted Storage', zone: 'restricted', type: 'target' },
    ],
    recommendedFlow: [
      { label: 'DMZ Web', zone: 'dmz', type: 'node' },
      { label: 'API Call', type: 'edge' },
      { label: 'Application Tier', zone: 'internal', type: 'node' },
      { label: 'Data Query', type: 'edge' },
      { label: 'Restricted Storage', zone: 'restricted', type: 'safe' },
    ],
    keyPrinciples: [
      'Each tier must only communicate with its immediate neighboring tier.',
      'Web presentation layers must never execute direct queries against core database storage.',
    ],
  },

  'PF-006': {
    ruleId: 'PF-006',
    flawSummary: 'Anomalous or inverted connection direction violating standard client-server network topology.',
    recommendedSummary: 'Restore standard North-South ingress and East-West service communication patterns.',
    currentFlow: [
      { label: 'Internal DB', zone: 'restricted', type: 'source' },
      { label: 'Inverted Egress', type: 'warning' },
      { label: 'Public Internet', zone: 'public', type: 'target' },
    ],
    recommendedFlow: [
      { label: 'Application Layer', zone: 'internal', type: 'node' },
      { label: 'Authorized DB Pull', type: 'edge' },
      { label: 'Database', zone: 'restricted', type: 'safe' },
    ],
    keyPrinciples: [
      'Databases should accept inbound connections from authorized services and avoid initiating outbound egress.',
      'Enforce strict egress filtering (egress firewalls) on restricted database tiers.',
    ],
  },

  'PF-007': {
    ruleId: 'PF-007',
    flawSummary: 'Overly permissive wildcard access rule (* or ANY) permitting arbitrary port traversal.',
    recommendedSummary: 'Enforce Principle of Least Privilege: restrict rules to exact required port and protocol.',
    currentFlow: [
      { label: 'Source Node', zone: 'dmz', type: 'source' },
      { label: 'ALLOW ANY (*)', type: 'warning' },
      { label: 'Target Service', zone: 'internal', type: 'target' },
    ],
    recommendedFlow: [
      { label: 'Source Node', zone: 'dmz', type: 'node' },
      { label: 'TCP 443 / 5432 Only', type: 'edge' },
      { label: 'Target Service', zone: 'internal', type: 'safe' },
    ],
    keyPrinciples: [
      'Never specify ANY / wildcard ports on allow rules reaching production services.',
      'Audit security group and firewall rule definitions to ensure strict port pinning.',
    ],
  },

  'PF-008': {
    ruleId: 'PF-008',
    flawSummary: 'Unencrypted cleartext transport across network boundary reaching sensitive asset.',
    recommendedSummary: 'Mandate end-to-end transport encryption (TLS 1.3 / SSH) across all network paths.',
    currentFlow: [
      { label: 'Client / Service', zone: 'dmz', type: 'source' },
      { label: 'Cleartext (HTTP / TCP)', type: 'warning' },
      { label: 'Sensitive DB / Service', zone: 'restricted', type: 'target' },
    ],
    recommendedFlow: [
      { label: 'Client / Service', zone: 'dmz', type: 'node' },
      { label: 'TLS Encrypted (HTTPS/mTLS)', type: 'edge' },
      { label: 'Sensitive DB / Service', zone: 'restricted', type: 'safe' },
    ],
    keyPrinciples: [
      'Enforce TLS transport encryption for all queries transmitting credentials or sensitive payloads.',
      'Disallow unencrypted HTTP, cleartext Redis, or unencrypted database wire protocols.',
    ],
  },

  'PF-009': {
    ruleId: 'PF-009',
    flawSummary: 'Mismatched edge destination port targeting an inactive or incorrect listener port.',
    recommendedSummary: 'Align network routing rules directly to verified service listener configuration.',
    currentFlow: [
      { label: 'Client Node', type: 'source' },
      { label: 'Port Misconfiguration', type: 'warning' },
      { label: 'Target Node', type: 'target' },
    ],
    recommendedFlow: [
      { label: 'Client Node', type: 'node' },
      { label: 'Aligned Listener Port', type: 'edge' },
      { label: 'Target Node', type: 'safe' },
    ],
    keyPrinciples: [
      'Verify that ingress security policies reflect the actual ports bound by target daemon processes.',
    ],
  },
};

export const RecommendedArchitectureView: React.FC<RecommendedArchitectureViewProps> = ({
  finding,
}) => {
  const pattern = ARCHITECTURE_PATTERNS[finding.ruleId] ?? {
    ruleId: finding.ruleId,
    flawSummary: finding.description,
    recommendedSummary: finding.recommendation,
    currentFlow: [
      { label: finding.affectedNodes[0] ?? 'Source', type: 'source' },
      { label: 'Vulnerable Flow', type: 'warning' },
      { label: finding.affectedNodes[1] ?? 'Target', type: 'target' },
    ],
    recommendedFlow: [
      { label: finding.affectedNodes[0] ?? 'Source', type: 'node' },
      { label: 'Protected Boundary', type: 'edge' },
      { label: finding.affectedNodes[1] ?? 'Target', type: 'safe' },
    ],
    keyPrinciples: [
      'Enforce network segmentation and defense-in-depth principles.',
      'Restrict all communication to least-privilege policies.',
    ],
  };

  return (
    <div className="space-y-2.5 font-mono text-xs">
      <div className="flex items-center justify-between text-[11px] text-[#8b949e] border-b border-[#222630] pb-1.5">
        <span className="font-semibold text-[#58a6ff] uppercase tracking-wider flex items-center space-x-1">
          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
          <span>Architectural Pattern Comparison</span>
        </span>
        <span className="text-[10px] text-[#5c6370]">{pattern.ruleId} Defense Profile</span>
      </div>

      {/* Side-by-side or stacked visual comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Flawed Pattern */}
        <div className="p-2.5 rounded bg-[#1c1315] border border-[#da3633]/40 space-y-2">
          <div className="flex items-center space-x-1.5 text-[10px] text-[#f85149] font-semibold uppercase">
            <X className="w-3.5 h-3.5" />
            <span>Current Flawed Architecture</span>
          </div>
          <p className="text-[11px] text-[#f85149]/90 leading-tight">
            {pattern.flawSummary}
          </p>

          {/* Flow representation */}
          <div className="flex items-center flex-wrap gap-1 pt-1.5 text-[10px]">
            {pattern.currentFlow.map((step, idx) => {
              if (step.type === 'warning') {
                return (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-[#381619] border border-[#f85149]/60 text-[#f85149] font-bold flex items-center"
                  >
                    <AlertCircle className="w-2.5 h-2.5 mr-1 inline" />
                    {step.label}
                  </span>
                );
              }
              return (
                <React.Fragment key={idx}>
                  <span className="px-2 py-0.5 rounded bg-[#161a22] border border-[#30363d] text-[#c9d1d9]">
                    {step.label}
                    {step.zone && <span className="text-[#8b949e] text-[9px] ml-1">({step.zone})</span>}
                  </span>
                  {idx < pattern.currentFlow.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-[#f85149] shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Recommended Secure Pattern */}
        <div className="p-2.5 rounded bg-[#101b16] border border-[#238636]/50 space-y-2">
          <div className="flex items-center space-x-1.5 text-[10px] text-[#3fb950] font-semibold uppercase">
            <Check className="w-3.5 h-3.5" />
            <span>Recommended Defense Pattern</span>
          </div>
          <p className="text-[11px] text-[#3fb950]/90 leading-tight">
            {pattern.recommendedSummary}
          </p>

          {/* Secure Flow representation */}
          <div className="flex items-center flex-wrap gap-1 pt-1.5 text-[10px]">
            {pattern.recommendedFlow.map((step, idx) => {
              if (step.type === 'edge') {
                return (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-[#13291d] border border-[#238636]/40 text-[#7ee787] text-[9px]"
                  >
                    {step.label}
                  </span>
                );
              }
              const isSafe = step.type === 'safe';
              return (
                <React.Fragment key={idx}>
                  <span
                    className={`px-2 py-0.5 rounded border text-[10px] ${
                      isSafe
                        ? 'bg-[#183424] border-[#3fb950] text-[#7ee787] font-semibold'
                        : 'bg-[#161a22] border-[#30363d] text-[#c9d1d9]'
                    }`}
                  >
                    {step.label}
                    {step.zone && <span className="text-[#8b949e] text-[9px] ml-1">({step.zone})</span>}
                  </span>
                  {idx < pattern.recommendedFlow.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-[#3fb950] shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Key Architectural Principles */}
      <div className="p-2 rounded bg-[#131720] border border-[#222630] space-y-1 text-[10px]">
        <div className="text-[#58a6ff] uppercase font-semibold">Security Principles Applied:</div>
        <ul className="list-disc list-inside space-y-0.5 text-[#8b949e]">
          {pattern.keyPrinciples.map((principle, idx) => (
            <li key={idx} className="leading-relaxed">
              <span className="text-[#c9d1d9]">{principle}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
