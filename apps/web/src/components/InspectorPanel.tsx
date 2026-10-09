import React, { useState, useEffect, useMemo } from 'react';
import { Environment, AttackPath } from '@pathforge/core';
import {
  Finding,
  NodeZone,
  AssetCriticality,
  EdgeProtocol,
  EdgeAccess,
  EdgeRelationship,
  NodeServiceInfo,
  Severity,
} from '@pathforge/shared';
import { validateCidrOrIp, parsePortInput } from '@pathforge/core';
import { RemediationAction, getRemediationActions } from '@pathforge/validator';
import {
  Info,
  ArrowRight,
  ShieldAlert,
  Trash2,
  Save,
  Check,
  AlertCircle,
  Server,
  Shield,
  Activity,
  Layers,
  X,
  Flame,
  Wrench,
  Crosshair,
  AlertOctagon,
  AlertTriangle,
  HelpCircle,
  Network,
  ChevronDown,
} from 'lucide-react';

interface InspectorPanelProps {
  environment: Environment;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedFinding?: Finding | null;
  selectedAttackPath?: AttackPath | null;
  findings: Finding[];
  onClearSelection?: () => void;
  onApplyRemediation?: (action: RemediationAction, finding: Finding) => void;
  onLocateElement?: (target: { id: string; type: 'node' | 'edge' }) => void;
  onAnalyzeBlastRadius?: (nodeId: string) => void;
  onUpdateNodeConfig?: (
    nodeId: string,
    patch: {
      name?: string;
      zone?: NodeZone;
      cidr?: string;
      criticality?: AssetCriticality;
      service?: NodeServiceInfo;
      tags?: string[];
    }
  ) => void;
  onUpdateEdgeConfig?: (
    edgeId: string,
    patch: {
      protocol?: EdgeProtocol;
      ports?: string;
      access?: EdgeAccess;
      encrypted?: boolean;
      relationship?: EdgeRelationship;
    }
  ) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
}

const ZONE_OPTIONS: { id: NodeZone; label: string; activeColor: string }[] = [
  { id: 'public', label: 'PUBLIC', activeColor: 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/60' },
  { id: 'dmz', label: 'DMZ', activeColor: 'bg-[#39c5bb]/20 text-[#39c5bb] border-[#39c5bb]/60' },
  { id: 'internal', label: 'INTERNAL', activeColor: 'bg-[#1f6feb]/20 text-[#58a6ff] border-[#388bfd]/60' },
  { id: 'restricted', label: 'RESTR', activeColor: 'bg-[#9e6a03]/25 text-[#e3b341] border-[#9e6a03]/60' },
  { id: 'management', label: 'MGMT', activeColor: 'bg-[#8957e5]/20 text-[#bc8cff] border-[#8957e5]/60' },
];

const CRITICALITY_OPTIONS: { id: AssetCriticality; label: string; activeColor: string }[] = [
  { id: 'low', label: 'LOW', activeColor: 'bg-[#1f6feb]/20 text-[#58a6ff] border-[#388bfd]/60' },
  { id: 'medium', label: 'MED', activeColor: 'bg-[#d29922]/20 text-[#e3b341] border-[#d29922]/60' },
  { id: 'high', label: 'HIGH', activeColor: 'bg-[#f0883e]/20 text-[#f0883e] border-[#f0883e]/60' },
  { id: 'critical', label: 'CRIT', activeColor: 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/60' },
];

const PROTO_OPTIONS: EdgeProtocol[] = ['TCP', 'UDP', 'HTTP', 'HTTPS', 'SSH', 'TLS', 'ICMP', 'ANY'];

const getSeverityBadge = (sev: Severity) => {
  switch (sev) {
    case 'critical':
      return {
        bg: 'bg-[#da3633]/20 text-[#f85149] border-[#da3633]/50',
        label: 'CRITICAL',
        icon: AlertOctagon,
      };
    case 'high':
      return {
        bg: 'bg-[#f0883e]/20 text-[#f0883e] border-[#f0883e]/50',
        label: 'HIGH',
        icon: AlertTriangle,
      };
    case 'medium':
      return {
        bg: 'bg-[#d29922]/20 text-[#e3b341] border-[#d29922]/50',
        label: 'MEDIUM',
        icon: AlertTriangle,
      };
    default:
      return {
        bg: 'bg-[#58a6ff]/20 text-[#58a6ff] border-[#58a6ff]/50',
        label: 'INFO',
        icon: Info,
      };
  }
};

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  environment,
  selectedNodeId,
  selectedEdgeId,
  selectedFinding = null,
  selectedAttackPath = null,
  findings,
  onClearSelection,
  onApplyRemediation,
  onLocateElement,
  onAnalyzeBlastRadius,
  onUpdateNodeConfig,
  onUpdateEdgeConfig,
  onDeleteNode,
  onDeleteEdge,
}) => {
  const selectedNode = selectedNodeId ? environment.getNode(selectedNodeId) : null;
  const selectedEdge = selectedEdgeId ? environment.getEdge(selectedEdgeId) : null;

  // Local form state for Node editing
  const [nodeName, setNodeName] = useState('');
  const [nodeZone, setNodeZone] = useState<NodeZone>('internal');
  const [nodeCidr, setNodeCidr] = useState('');
  const [nodeCriticality, setNodeCriticality] = useState<AssetCriticality>('medium');
  const [servicePort, setServicePort] = useState('');
  const [serviceProto, setServiceProto] = useState('TCP');
  const [nodeTags, setNodeTags] = useState('');
  const [nodeError, setNodeError] = useState<string | null>(null);
  const [nodeSaved, setNodeSaved] = useState(false);

  // Local form state for Edge editing
  const [edgeProtocol, setEdgeProtocol] = useState<EdgeProtocol>('TCP');
  const [edgePorts, setEdgePorts] = useState('');
  const [edgeAccess, setEdgeAccess] = useState<EdgeAccess>('allow');
  const [edgeEncrypted, setEdgeEncrypted] = useState(false);
  const [edgeRelationship, setEdgeRelationship] = useState<EdgeRelationship>('network');
  const [edgeError, setEdgeError] = useState<string | null>(null);
  const [edgeSaved, setEdgeSaved] = useState(false);

  // Sync state whenever selected node changes
  useEffect(() => {
    if (selectedNode) {
      setNodeName(selectedNode.name);
      setNodeZone((selectedNode.metadata.zone as NodeZone) ?? 'internal');
      setNodeCidr(selectedNode.metadata.cidr ?? '');
      setNodeCriticality(selectedNode.metadata.criticality ?? 'medium');
      setServicePort(selectedNode.metadata.service?.port ? String(selectedNode.metadata.service.port) : '');
      setServiceProto(selectedNode.metadata.service?.protocol ?? 'TCP');
      setNodeTags((selectedNode.metadata.tags ?? []).join(', '));
      setNodeError(null);
      setNodeSaved(false);
    }
  }, [selectedNodeId, selectedNode]);

  // Sync state whenever selected edge changes
  useEffect(() => {
    if (selectedEdge) {
      setEdgeProtocol(selectedEdge.metadata.protocol ?? 'TCP');
      setEdgePorts(selectedEdge.metadata.ports ?? 'ANY');
      setEdgeAccess(selectedEdge.metadata.access ?? 'allow');
      setEdgeEncrypted(selectedEdge.metadata.encrypted ?? false);
      setEdgeRelationship(selectedEdge.metadata.relationship ?? 'network');
      setEdgeError(null);
      setEdgeSaved(false);
    }
  }, [selectedEdgeId, selectedEdge]);

  const handleSaveNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode || !onUpdateNodeConfig) return;

    // Validate CIDR / IP
    const cidrCheck = validateCidrOrIp(nodeCidr);
    if (!cidrCheck.valid) {
      setNodeError(cidrCheck.error ?? 'Invalid IP/CIDR');
      return;
    }

    // Validate service port if provided
    let sPort: number | undefined;
    if (servicePort.trim() !== '') {
      const portCheck = parsePortInput(servicePort);
      if (!portCheck.valid || portCheck.config?.type !== 'single') {
        setNodeError('Service port must be a single integer between 1 and 65535');
        return;
      }
      sPort = portCheck.config.value;
    }

    const tagsArray = nodeTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onUpdateNodeConfig(selectedNode.id, {
      name: nodeName.trim() || selectedNode.name,
      zone: nodeZone,
      cidr: nodeCidr.trim() || undefined,
      criticality: nodeCriticality,
      service: sPort ? { name: nodeName.toLowerCase(), port: sPort, protocol: serviceProto } : undefined,
      tags: tagsArray.length > 0 ? tagsArray : undefined,
    });

    setNodeSaved(true);
    setTimeout(() => setNodeSaved(false), 2000);
  };

  const handleSaveEdge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEdge || !onUpdateEdgeConfig) return;

    const portCheck = parsePortInput(edgePorts);
    if (!portCheck.valid) {
      setEdgeError(portCheck.error ?? 'Invalid port configuration');
      return;
    }

    onUpdateEdgeConfig(selectedEdge.id, {
      protocol: edgeProtocol,
      ports: portCheck.formatted,
      access: edgeAccess,
      encrypted: edgeEncrypted,
      relationship: edgeRelationship,
    });

    setEdgeSaved(true);
    setTimeout(() => setEdgeSaved(false), 2000);
  };

  // Node-specific findings
  const nodeFindings = useMemo(
    () => (selectedNode ? findings.filter((f) => f.affectedNodes.includes(selectedNode.id)) : []),
    [selectedNode, findings]
  );

  // Edge-specific findings
  const edgeFindings = useMemo(
    () => (selectedEdge ? findings.filter((f) => f.affectedEdges.includes(selectedEdge.id)) : []),
    [selectedEdge, findings]
  );

  const inDegree = selectedNode
    ? environment.graph.getIncomingEdges(selectedNode.id).length
    : 0;
  const outDegree = selectedNode
    ? environment.graph.getOutgoingEdges(selectedNode.id).length
    : 0;

  // Environment metrics when nothing selected
  const envMetrics = useMemo(() => {
    const nodes = environment.getNodes();
    const edges = environment.getEdges();
    const zoneCounts: Record<string, number> = {
      public: 0,
      dmz: 0,
      internal: 0,
      restricted: 0,
      management: 0,
    };
    nodes.forEach((n) => {
      const z = (n.metadata.zone as string) ?? 'internal';
      if (zoneCounts[z] !== undefined) {
        zoneCounts[z]++;
      }
    });

    const critIssues = findings.filter((f) => f.severity === 'critical').length;
    const highIssues = findings.filter((f) => f.severity === 'high').length;

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      zoneCounts,
      critIssues,
      highIssues,
      totalFindings: findings.length,
    };
  }, [environment, findings]);

  // Check if edge crosses trust zones
  const edgeCrossingInfo = useMemo(() => {
    if (!selectedEdge) return null;
    const srcNode = environment.getNode(selectedEdge.source);
    const tgtNode = environment.getNode(selectedEdge.target);
    if (!srcNode || !tgtNode) return null;
    const srcZone = (srcNode.metadata.zone as string) ?? 'internal';
    const tgtZone = (tgtNode.metadata.zone as string) ?? 'internal';
    const isCrossing = srcZone !== tgtZone;
    return {
      srcName: srcNode.name,
      tgtName: tgtNode.name,
      srcZone,
      tgtZone,
      isCrossing,
    };
  }, [selectedEdge, environment]);

  // Remediation actions for selected finding
  const findingRemediationActions = useMemo(() => {
    if (!selectedFinding) return [];
    return getRemediationActions(selectedFinding, environment);
  }, [selectedFinding, environment]);

  const hasAnySelection =
    Boolean(selectedNode) ||
    Boolean(selectedEdge) ||
    Boolean(selectedFinding) ||
    Boolean(selectedAttackPath);

  return (
    <aside className={`w-80 border-l border-[#212631] bg-[#11151c] flex-col h-full select-none text-xs font-sans ${hasAnySelection ? 'flex fixed inset-y-0 right-0 z-40 max-w-[90vw] md:static' : 'hidden lg:flex'}`}>
      {/* Panel Header */}
      <div className="h-10 px-3.5 border-b border-[#212631] bg-[#161b24] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          {selectedNode ? (
            <Server className="w-3.5 h-3.5 text-[#58a6ff]" />
          ) : selectedEdge ? (
            <Network className="w-3.5 h-3.5 text-[#58a6ff]" />
          ) : selectedFinding ? (
            <ShieldAlert className="w-3.5 h-3.5 text-[#f85149]" />
          ) : selectedAttackPath ? (
            <Flame className="w-3.5 h-3.5 text-[#f85149]" />
          ) : (
            <Info className="w-3.5 h-3.5 text-[#58a6ff]" />
          )}

          <span className="text-xs font-bold tracking-wider text-[#c9d1d9] uppercase">
            {selectedNode
              ? 'Node Inspector'
              : selectedEdge
              ? 'Connection Inspector'
              : selectedFinding
              ? 'Finding Detail'
              : selectedAttackPath
              ? 'Attack Path'
              : 'Topology Overview'}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] px-2 py-0.5 rounded border border-[#212631] bg-[#11151c] text-[#8b949e] font-mono font-semibold">
            {selectedNode
              ? 'NODE'
              : selectedEdge
              ? 'EDGE'
              : selectedFinding
              ? 'FINDING'
              : selectedAttackPath
              ? 'THREAT'
              : 'OVERVIEW'}
          </span>

          {hasAnySelection && onClearSelection && (
            <button
              onClick={onClearSelection}
              className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#212631] transition-colors cursor-pointer"
              title="Close inspection and return to overview"
              aria-label="Close inspector"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* ======================================================== */}
        {/* FINDING INSPECTOR (SELECTED FINDING)                     */}
        {/* ======================================================== */}
        {selectedFinding && !selectedNode && !selectedEdge && (
          <div className="space-y-3.5">
            {/* Finding Header Card */}
            {(() => {
              const sevBadge = getSeverityBadge(selectedFinding.severity);
              const SevIcon = sevBadge.icon;
              return (
                <div className="p-3 rounded-lg border border-[#212631] bg-[#161b24] space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.2 rounded border font-bold flex items-center space-x-1 font-mono ${sevBadge.bg}`}
                    >
                      <SevIcon className="w-2.5 h-2.5 mr-0.5" />
                      <span>{sevBadge.label}</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#8b949e]">
                      {selectedFinding.ruleId}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-[#f0f3f6] leading-snug">
                    {selectedFinding.title}
                  </div>
                </div>
              );
            })()}

            {/* Plain English Root Cause */}
            <div className="p-3 rounded-lg bg-[#161b24] border border-[#212631] space-y-1.5">
              <div className="text-[10px] uppercase text-[#f85149] font-bold tracking-wider flex items-center space-x-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>What is wrong</span>
              </div>
              <p className="text-[#c9d1d9] leading-relaxed text-xs">
                {selectedFinding.whyItMatters}
              </p>
            </div>

            {/* Threat Impact */}
            <div className="p-3 rounded-lg bg-[#161b24] border border-[#212631] space-y-1.5">
              <div className="text-[10px] uppercase text-[#f0883e] font-bold tracking-wider flex items-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Why it matters</span>
              </div>
              <p className="text-[#c9d1d9] leading-relaxed text-xs">
                {selectedFinding.impact}
              </p>
            </div>

            {/* Where It Appears */}
            <div className="p-3 rounded-lg bg-[#161b24] border border-[#212631] space-y-2">
              <div className="text-[10px] uppercase text-[#58a6ff] font-bold tracking-wider flex items-center space-x-1.5">
                <Crosshair className="w-3.5 h-3.5" />
                <span>Where it appears</span>
              </div>
              <div className="space-y-1.5">
                {selectedFinding.affectedNodes.map((nodeId) => {
                  const n = environment.getNode(nodeId);
                  return (
                    <div
                      key={nodeId}
                      className="flex items-center justify-between p-1.5 rounded bg-[#11151c] border border-[#212631] text-xs"
                    >
                      <span className="text-[#f0f3f6] font-medium truncate">
                        {n?.name ?? nodeId}
                      </span>
                      {onLocateElement && (
                        <button
                          onClick={() => onLocateElement({ id: nodeId, type: 'node' })}
                          className="px-2 py-0.5 rounded bg-[#212631] text-[#58a6ff] hover:bg-[#303746] text-[10px] font-semibold cursor-pointer"
                        >
                          Locate
                        </button>
                      )}
                    </div>
                  );
                })}
                {selectedFinding.affectedEdges.map((edgeId) => {
                  const edge = environment.getEdge(edgeId);
                  const src = edge ? environment.getNode(edge.source) : null;
                  const tgt = edge ? environment.getNode(edge.target) : null;
                  return (
                    <div
                      key={edgeId}
                      className="flex items-center justify-between p-1.5 rounded bg-[#11151c] border border-[#212631] text-xs"
                    >
                      <span className="text-[#f0f3f6] font-medium truncate text-[11px]">
                        {src?.name ?? 'Node'} → {tgt?.name ?? 'Node'}
                      </span>
                      {onLocateElement && (
                        <button
                          onClick={() => onLocateElement({ id: edgeId, type: 'edge' })}
                          className="px-2 py-0.5 rounded bg-[#212631] text-[#58a6ff] hover:bg-[#303746] text-[10px] font-semibold cursor-pointer"
                        >
                          Locate
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* What to do next & Remediation */}
            <div className="p-3 rounded-lg bg-[#161b24] border border-[#212631] space-y-2">
              <div className="text-[10px] uppercase text-[#3fb950] font-bold tracking-wider flex items-center space-x-1.5">
                <Wrench className="w-3.5 h-3.5" />
                <span>What to do next</span>
              </div>
              <p className="text-[#c9d1d9] text-xs leading-relaxed">
                {selectedFinding.remediation}
              </p>

              {findingRemediationActions.length > 0 && onApplyRemediation && (
                <div className="pt-1.5 space-y-1.5">
                  {findingRemediationActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => onApplyRemediation(action, selectedFinding)}
                      className="w-full px-3 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>{action.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Expandable Technical Evidence */}
            {selectedFinding.evidence && (
              <details className="rounded-lg bg-[#161b24] border border-[#212631] p-3 text-xs space-y-2 group">
                <summary className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider cursor-pointer flex items-center justify-between list-none">
                  <span>Technical Evidence & Config</span>
                  <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                </summary>
                <div className="pt-2 border-t border-[#212631] space-y-1.5 text-[11px] text-[#8b949e]">
                  <div>
                    Category:{' '}
                    <strong className="text-[#c9d1d9] capitalize font-mono">
                      {selectedFinding.category.replace('_', ' ')}
                    </strong>
                  </div>
                  {selectedFinding.evidence.protocol && (
                    <div>
                      Protocol:{' '}
                      <strong className="text-[#f0f3f6] font-mono">
                        {selectedFinding.evidence.protocol}
                      </strong>
                    </div>
                  )}
                  {selectedFinding.evidence.ports && (
                    <div>
                      Ports:{' '}
                      <strong className="text-[#f0f3f6] font-mono">
                        {selectedFinding.evidence.ports}
                      </strong>
                    </div>
                  )}
                  {selectedFinding.evidence.access && (
                    <div>
                      Access Policy:{' '}
                      <strong className="text-[#f0f3f6] font-mono uppercase">
                        {selectedFinding.evidence.access}
                      </strong>
                    </div>
                  )}
                  {selectedFinding.evidence.encrypted !== undefined && (
                    <div>
                      Encryption:{' '}
                      <strong className="text-[#f0f3f6] font-mono">
                        {selectedFinding.evidence.encrypted ? 'TLS Enabled' : 'Cleartext'}
                      </strong>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* ATTACK PATH INSPECTOR (SELECTED ATTACK PATH)             */}
        {/* ======================================================== */}
        {selectedAttackPath && !selectedNode && !selectedEdge && !selectedFinding && (
          <div className="space-y-3.5">
            {/* Header Card */}
            <div className="p-3 rounded-lg border border-[#da3633]/40 bg-[#1e1317] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase px-1.5 py-0.2 rounded border font-bold flex items-center space-x-1 font-mono text-[#f85149] bg-[#da3633]/20 border-[#da3633]/50">
                  <Flame className="w-2.5 h-2.5 mr-0.5" />
                  <span>{selectedAttackPath.risk.toUpperCase()} RISK</span>
                </span>
                <span className="font-mono text-[10px] text-[#f85149] font-bold">
                  Score: {selectedAttackPath.riskScore}/100
                </span>
              </div>
              <div className="text-sm font-bold text-white leading-snug">
                {selectedAttackPath.entryPoint.name} → {selectedAttackPath.target.name}
              </div>
            </div>

            {/* Plain English Threat Summary */}
            <div className="p-3 rounded-lg bg-[#161b24] border border-[#212631] space-y-1.5">
              <div className="text-[10px] uppercase text-[#f85149] font-bold tracking-wider flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Threat Scenario</span>
              </div>
              <p className="text-[#c9d1d9] leading-relaxed text-xs">
                A threat actor gaining access to <strong className="text-white">{selectedAttackPath.entryPoint.name}</strong> can traverse {selectedAttackPath.hopCount} network hop{selectedAttackPath.hopCount === 1 ? '' : 's'} to directly reach critical asset <strong className="text-white">{selectedAttackPath.target.name}</strong>.
              </p>
            </div>

            {/* Modeled Route Steps */}
            <div className="p-3 rounded-lg bg-[#161b24] border border-[#212631] space-y-2">
              <div className="text-[10px] uppercase text-[#58a6ff] font-bold tracking-wider flex items-center space-x-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span>Modeled Route Sequence</span>
              </div>
              <div className="space-y-1.5">
                {selectedAttackPath.steps.map((step) => (
                  <div
                    key={step.step}
                    className="p-2 rounded bg-[#11151c] border border-[#212631] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-[#58a6ff]">
                        Hop {step.step}
                      </span>
                      <span className="text-[10px] font-mono text-[#8b949e]">
                        {step.protocol}:{step.ports}
                      </span>
                    </div>
                    <div className="text-[#f0f3f6] font-medium flex items-center space-x-1.5 truncate">
                      <span className="truncate">{step.sourceNodeName}</span>
                      <ArrowRight className="w-3 h-3 text-[#58a6ff] shrink-0" />
                      <span className="truncate">{step.targetNodeName}</span>
                    </div>
                    {step.explanation && (
                      <div className="text-[10px] text-[#8b949e] leading-tight pt-0.5">
                        {step.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Defensive Advice */}
            <div className="p-3 rounded-lg bg-[#161b24] border border-[#212631] space-y-1.5">
              <div className="text-[10px] uppercase text-[#3fb950] font-bold tracking-wider flex items-center space-x-1.5">
                <Wrench className="w-3.5 h-3.5" />
                <span>Defensive Remediation</span>
              </div>
              <p className="text-[#c9d1d9] text-xs leading-relaxed">
                Break this attack path by placing intermediate hops behind an isolated DMZ firewall or restricting connection access policies from allow to deny.
              </p>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* NODE INSPECTOR & CONFIGURATION                           */}
        {/* ======================================================== */}
        {selectedNode && (
          <form onSubmit={handleSaveNode} className="space-y-4">
            {/* Identity Card */}
            <div className="p-3 rounded-lg border border-[#212631] bg-[#161b24] space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-[#8b949e]">
                <span className="text-[#58a6ff] uppercase font-bold tracking-wider">
                  {selectedNode.type}
                </span>
                <span className="font-mono">{selectedNode.id}</span>
              </div>
              <div className="text-sm font-bold text-[#f0f3f6] truncate font-sans">
                {selectedNode.name}
              </div>
              <div className="flex items-center space-x-3 pt-1 text-[11px] text-[#8b949e] font-mono">
                <span>In: {inDegree}</span>
                <span>•</span>
                <span>Out: {outDegree}</span>
              </div>
            </div>

            {/* Asset Name Field */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider block">
                Display Name
              </label>
              <input
                type="text"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-[#161b24] border border-[#212631] focus:border-[#388bfd] text-xs text-[#f0f3f6] focus:outline-hidden"
              />
            </div>

            {/* Trust Zone Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider block">
                Trust Zone Perimeter
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {ZONE_OPTIONS.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => setNodeZone(z.id)}
                    className={`py-1 px-2 rounded text-[11px] font-semibold border transition-all text-center cursor-pointer ${
                      nodeZone === z.id
                        ? z.activeColor
                        : 'bg-[#161b24] text-[#8b949e] border-[#212631] hover:border-[#303746]'
                    }`}
                  >
                    {z.label}
                  </button>
                ))}
              </div>
            </div>

            {/* IP / CIDR Configuration */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider">
                  IPv4 / CIDR Address
                </label>
                <span className="text-[10px] text-[#8b949e]">Optional</span>
              </div>
              <input
                type="text"
                placeholder="e.g. 10.0.1.5/24 or 192.168.1.1"
                value={nodeCidr}
                onChange={(e) => setNodeCidr(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-[#161b24] border border-[#212631] focus:border-[#388bfd] text-xs text-[#f0f3f6] font-mono focus:outline-hidden"
              />
            </div>

            {/* Service Port & Protocol */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider block">
                  Service Port
                </label>
                <input
                  type="text"
                  placeholder="e.g. 443"
                  value={servicePort}
                  onChange={(e) => setServicePort(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#161b24] border border-[#212631] focus:border-[#388bfd] text-xs text-[#f0f3f6] font-mono focus:outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider block">
                  Protocol
                </label>
                <select
                  value={serviceProto}
                  onChange={(e) => setServiceProto(e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-[#161b24] border border-[#212631] focus:border-[#388bfd] text-xs text-[#f0f3f6] font-mono focus:outline-hidden"
                >
                  {PROTO_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Criticality Rating */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider block">
                Asset Criticality
              </label>
              <div className="grid grid-cols-4 gap-1">
                {CRITICALITY_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setNodeCriticality(c.id)}
                    className={`py-1 rounded text-[10px] font-bold border transition-all text-center cursor-pointer ${
                      nodeCriticality === c.id
                        ? c.activeColor
                        : 'bg-[#161b24] text-[#8b949e] border-[#212631] hover:border-[#303746]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags Input */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider block">
                Metadata Tags
              </label>
              <input
                type="text"
                placeholder="prod, tier-1, pci (comma-separated)"
                value={nodeTags}
                onChange={(e) => setNodeTags(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-[#161b24] border border-[#212631] focus:border-[#388bfd] text-xs text-[#f0f3f6] focus:outline-hidden"
              />
            </div>

            {/* Error Message */}
            {nodeError && (
              <div className="p-2.5 rounded bg-[#da3633]/15 border border-[#da3633]/50 text-[#f85149] text-[11px] flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{nodeError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="submit"
                className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded text-xs font-semibold transition-colors shadow-xs cursor-pointer ${
                  nodeSaved
                    ? 'bg-[#238636] text-white'
                    : 'bg-[#1f6feb] hover:bg-[#388bfd] text-white'
                }`}
              >
                {nodeSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{nodeSaved ? 'Properties Applied' : 'Apply Changes'}</span>
              </button>

              {onDeleteNode && (
                <button
                  type="button"
                  onClick={() => onDeleteNode(selectedNode.id)}
                  className="p-1.5 rounded bg-[#da3633]/15 hover:bg-[#da3633]/30 border border-[#da3633]/40 text-[#f85149] transition-colors cursor-pointer"
                  title="Delete Component"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Blast Radius Simulation Trigger */}
            {onAnalyzeBlastRadius && (
              <button
                type="button"
                onClick={() => onAnalyzeBlastRadius(selectedNode.id)}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded border border-[#8957e5]/50 bg-[#8957e5]/10 hover:bg-[#8957e5]/20 text-[#bc8cff] text-xs font-semibold transition-colors cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Simulate Node Compromise</span>
              </button>
            )}

            {/* Node-specific Findings */}
            {nodeFindings.length > 0 && (
              <div className="pt-2 border-t border-[#212631] space-y-2">
                <div className="text-[10px] uppercase text-[#f85149] font-bold tracking-wider flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Component Findings ({nodeFindings.length})</span>
                </div>
                <div className="space-y-1.5">
                  {nodeFindings.map((f) => (
                    <div
                      key={f.id}
                      className="p-2 rounded bg-[#da3633]/10 border border-[#da3633]/30 text-xs space-y-1"
                    >
                      <div className="text-[#f85149] font-semibold text-[11px]">{f.title}</div>
                      <div className="text-[10px] text-[#8b949e] line-clamp-2">{f.whyItMatters}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {/* ======================================================== */}
        {/* EDGE INSPECTOR & CONFIGURATION                           */}
        {/* ======================================================== */}
        {selectedEdge && (
          <form onSubmit={handleSaveEdge} className="space-y-4">
            {/* Identity Card */}
            <div className="p-3 rounded-lg border border-[#212631] bg-[#161b24] space-y-2">
              <div className="text-[10px] text-[#8b949e] font-mono flex items-center justify-between">
                <span>CONNECTION</span>
                <span>{selectedEdge.id}</span>
              </div>
              <div className="text-xs font-bold text-[#f0f3f6] flex items-center space-x-2">
                <span className="truncate max-w-[110px]">
                  {environment.getNode(selectedEdge.source)?.name ?? selectedEdge.source}
                </span>
                <ArrowRight className="w-3 h-3 text-[#58a6ff] shrink-0" />
                <span className="truncate max-w-[110px]">
                  {environment.getNode(selectedEdge.target)?.name ?? selectedEdge.target}
                </span>
              </div>
            </div>

            {/* Zone Crossing Advisory */}
            {edgeCrossingInfo && edgeCrossingInfo.isCrossing && (
              <div className="p-2.5 rounded bg-[#d29922]/15 border border-[#d29922]/40 text-xs space-y-1">
                <div className="text-[10px] uppercase text-[#e3b341] font-bold flex items-center space-x-1">
                  <Shield className="w-3 h-3" />
                  <span>Trust Boundary Crossing</span>
                </div>
                <div className="text-[11px] text-[#c9d1d9] leading-relaxed">
                  Traffic traverses from <strong className="uppercase font-mono text-white">{edgeCrossingInfo.srcZone}</strong> to{' '}
                  <strong className="uppercase font-mono text-white">{edgeCrossingInfo.tgtZone}</strong>.
                </div>
              </div>
            )}

            {/* Protocol Selector */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider block">
                Transport Protocol
              </label>
              <select
                value={edgeProtocol}
                onChange={(e) => setEdgeProtocol(e.target.value as EdgeProtocol)}
                className="w-full px-2 py-1.5 rounded bg-[#161b24] border border-[#212631] focus:border-[#388bfd] text-xs text-[#f0f3f6] font-mono focus:outline-hidden"
              >
                {PROTO_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Port Input */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider">
                  Destination Port(s)
                </label>
                <span className="text-[10px] text-[#8b949e] font-mono">ANY, 443, 80-90</span>
              </div>
              <input
                type="text"
                value={edgePorts}
                onChange={(e) => setEdgePorts(e.target.value)}
                placeholder="ANY or 443 or 80,443"
                className="w-full px-2.5 py-1.5 rounded bg-[#161b24] border border-[#212631] focus:border-[#388bfd] text-xs text-[#f0f3f6] font-mono focus:outline-hidden"
              />
            </div>

            {/* Access Policy Toggle */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider block">
                Firewall / Route Policy
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEdgeAccess('allow')}
                  className={`py-1.5 rounded text-xs font-bold border transition-all text-center cursor-pointer ${
                    edgeAccess === 'allow'
                      ? 'bg-[#238636]/25 text-[#3fb950] border-[#238636]'
                      : 'bg-[#161b24] text-[#8b949e] border-[#212631] hover:border-[#303746]'
                  }`}
                >
                  ALLOW
                </button>
                <button
                  type="button"
                  onClick={() => setEdgeAccess('deny')}
                  className={`py-1.5 rounded text-xs font-bold border transition-all text-center cursor-pointer ${
                    edgeAccess === 'deny'
                      ? 'bg-[#da3633]/25 text-[#f85149] border-[#da3633]'
                      : 'bg-[#161b24] text-[#8b949e] border-[#212631] hover:border-[#303746]'
                  }`}
                >
                  DENY
                </button>
              </div>
            </div>

            {/* Encryption Checkbox */}
            <div className="p-2.5 rounded bg-[#161b24] border border-[#212631] flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-[#f0f3f6]">Transport Encryption</div>
                <div className="text-[10px] text-[#8b949e]">Enforce TLS/HTTPS tunnel</div>
              </div>
              <input
                type="checkbox"
                checked={edgeEncrypted}
                onChange={(e) => setEdgeEncrypted(e.target.checked)}
                className="w-4 h-4 rounded border-[#212631] bg-[#11151c] text-[#1f6feb] focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Relationship Classification */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider block">
                Relationship Type
              </label>
              <select
                value={edgeRelationship}
                onChange={(e) => setEdgeRelationship(e.target.value as EdgeRelationship)}
                className="w-full px-2 py-1.5 rounded bg-[#161b24] border border-[#212631] focus:border-[#388bfd] text-xs text-[#f0f3f6] font-mono focus:outline-hidden"
              >
                <option value="network">Network Connection</option>
                <option value="dependency">Application Dependency</option>
                <option value="management">Management Channel</option>
              </select>
            </div>

            {/* Error Message */}
            {edgeError && (
              <div className="p-2.5 rounded bg-[#da3633]/15 border border-[#da3633]/50 text-[#f85149] text-[11px] flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{edgeError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="submit"
                className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded text-xs font-semibold transition-colors shadow-xs cursor-pointer ${
                  edgeSaved
                    ? 'bg-[#238636] text-white'
                    : 'bg-[#1f6feb] hover:bg-[#388bfd] text-white'
                }`}
              >
                {edgeSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{edgeSaved ? 'Connection Applied' : 'Apply Changes'}</span>
              </button>

              {onDeleteEdge && (
                <button
                  type="button"
                  onClick={() => onDeleteEdge(selectedEdge.id)}
                  className="p-1.5 rounded bg-[#da3633]/15 hover:bg-[#da3633]/30 border border-[#da3633]/40 text-[#f85149] transition-colors cursor-pointer"
                  title="Delete Connection"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Edge Security Findings */}
            {edgeFindings.length > 0 && (
              <div className="pt-2 border-t border-[#212631] space-y-2">
                <div className="text-[10px] uppercase text-[#f85149] font-bold tracking-wider flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Connection Violations ({edgeFindings.length})</span>
                </div>
                <div className="space-y-1.5">
                  {edgeFindings.map((f) => (
                    <div
                      key={f.id}
                      className="p-2 rounded bg-[#da3633]/10 border border-[#da3633]/30 text-xs space-y-1"
                    >
                      <div className="text-[#f85149] font-semibold text-[11px]">{f.title}</div>
                      <div className="text-[10px] text-[#8b949e] line-clamp-2">{f.whyItMatters}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {/* ======================================================== */}
        {/* ENVIRONMENT OVERVIEW (NOTHING SELECTED)                  */}
        {/* ======================================================== */}
        {!selectedNode && !selectedEdge && !selectedFinding && !selectedAttackPath && (
          <div className="space-y-4">
            {/* System Info Card */}
            <div className="p-3 bg-[#161b24] rounded-lg border border-[#212631] space-y-1.5">
              <div className="flex items-center space-x-2">
                <Server className="w-3.5 h-3.5 text-[#58a6ff]" />
                <span className="text-xs font-bold text-[#f0f3f6]">{environment.name}</span>
              </div>
              <p className="text-[11px] text-[#8b949e] leading-relaxed">
                {environment.description || 'Deterministic infrastructure security model with verified boundaries.'}
              </p>
            </div>

            {/* Metrics Matrix */}
            <div>
              <div className="text-[10px] uppercase text-[#8b949e] font-bold tracking-wider mb-2 flex items-center space-x-1.5">
                <Activity className="w-3.5 h-3.5 text-[#58a6ff]" />
                <span>Topology Architecture Metrics</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#161b24] p-2.5 rounded-lg border border-[#212631]">
                  <div className="text-[10px] uppercase text-[#8b949e] font-medium">Assets</div>
                  <div className="text-[#f0f3f6] text-base font-bold mt-0.5">
                    {envMetrics.totalNodes}
                  </div>
                </div>
                <div className="bg-[#161b24] p-2.5 rounded-lg border border-[#212631]">
                  <div className="text-[10px] uppercase text-[#8b949e] font-medium">Connections</div>
                  <div className="text-[#f0f3f6] text-base font-bold mt-0.5">
                    {envMetrics.totalEdges}
                  </div>
                </div>
                <div className="bg-[#161b24] p-2.5 rounded-lg border border-[#212631]">
                  <div className="text-[10px] uppercase text-[#8b949e] font-medium">Findings</div>
                  <div className="text-[#f0f3f6] text-base font-bold mt-0.5">
                    {envMetrics.totalFindings}
                  </div>
                </div>
                <div className="bg-[#161b24] p-2.5 rounded-lg border border-[#212631]">
                  <div className="text-[10px] uppercase text-[#f85149] font-medium">Crit / High</div>
                  <div className="text-[#f85149] text-base font-bold mt-0.5">
                    {envMetrics.critIssues + envMetrics.highIssues}
                  </div>
                </div>
              </div>
            </div>

            {/* Trust Zone Allocation */}
            <div>
              <div className="text-[10px] uppercase text-[#8b949e] font-bold tracking-wider mb-2 flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-[#bc8cff]" />
                <span>Trust Zone Allocation</span>
              </div>
              <div className="space-y-1.5">
                {ZONE_OPTIONS.map((z) => {
                  const count = envMetrics.zoneCounts[z.id] ?? 0;
                  return (
                    <div
                      key={z.id}
                      className="px-2.5 py-1.5 rounded bg-[#161b24] border border-[#212631] flex items-center justify-between text-xs"
                    >
                      <span className="text-[#c9d1d9] font-medium">{z.label}</span>
                      <span className="text-[#8b949e] font-mono font-semibold">
                        {count} node{count === 1 ? '' : 's'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Instructions Prompt */}
            <div className="p-3 bg-[#161b24]/50 rounded-lg border border-[#212631] text-[11px] text-[#8b949e] space-y-1">
              <div className="text-[#c9d1d9] font-semibold flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-[#58a6ff]" />
                <span>Interactive Workbench Tip</span>
              </div>
              <p className="leading-relaxed">
                Click any component, connection, security finding, or attack path to inspect properties and defensive remediation options.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
