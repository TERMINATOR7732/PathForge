import React, { useState, useEffect, useMemo } from 'react';
import { Environment } from '@pathforge/core';
import {
  Finding,
  NodeZone,
  AssetCriticality,
  EdgeProtocol,
  EdgeAccess,
  EdgeRelationship,
  NodeServiceInfo,
} from '@pathforge/shared';
import { validateCidrOrIp, parsePortInput } from '@pathforge/core';
import {
  Info,
  ArrowRight,
  ShieldAlert,
  Trash2,
  Save,
  Check,
  AlertCircle,
  Lock,
  Radio,
  Server,
  Shield,
  Activity,
  Layers,
} from 'lucide-react';

interface InspectorPanelProps {
  environment: Environment;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  findings: Finding[];
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

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  environment,
  selectedNodeId,
  selectedEdgeId,
  findings,
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

    setNodeError(null);

    const tagsArray = nodeTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const serviceInfo: NodeServiceInfo | undefined =
      sPort !== undefined
        ? { port: sPort, protocol: serviceProto }
        : undefined;

    onUpdateNodeConfig(selectedNode.id, {
      name: nodeName,
      zone: nodeZone,
      cidr: cidrCheck.value,
      criticality: nodeCriticality,
      service: serviceInfo,
      tags: tagsArray,
    });

    setNodeSaved(true);
    setTimeout(() => setNodeSaved(false), 2000);
  };

  const handleSaveEdge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEdge || !onUpdateEdgeConfig) return;

    // Validate port input
    const portCheck = parsePortInput(edgePorts);
    if (!portCheck.valid) {
      setEdgeError(portCheck.error ?? 'Invalid port format');
      return;
    }

    setEdgeError(null);

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

  return (
    <aside className="w-80 border-l border-[#212631] bg-[#11151c] flex flex-col h-full select-none text-xs font-sans">
      {/* Panel Header */}
      <div className="h-10 px-3.5 border-b border-[#212631] bg-[#161b24] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <Info className="w-3.5 h-3.5 text-[#58a6ff]" />
          <span className="text-xs font-bold tracking-wider text-[#c9d1d9] uppercase">
            Properties
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded border border-[#212631] bg-[#11151c] text-[#8b949e] font-mono font-semibold">
          {selectedNode ? 'NODE' : selectedEdge ? 'CONNECTION' : 'TOPOLOGY'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
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
              <div className="flex items-center space-x-2 pt-1 text-[10px] text-[#8b949e] font-mono border-t border-[#212631]">
                <span>IN: {inDegree} flows</span>
                <span>·</span>
                <span>OUT: {outDegree} flows</span>
              </div>
            </div>

            {/* Section: Identity */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase text-[#8b949e] font-bold tracking-wider block">
                Identity
              </label>
              <input
                type="text"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                className="w-full bg-[#11151c] border border-[#212631] rounded px-2.5 py-1.5 text-xs text-[#f0f3f6] focus:outline-none focus:border-[#58a6ff] transition-colors"
                placeholder="Asset Name"
                required
              />
            </div>

            {/* Section: Network & Reachability */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-[#8b949e] font-bold tracking-wider block">
                Network & Zone
              </label>

              {/* Trust Zone Segmented Selector */}
              <div className="grid grid-cols-5 gap-1">
                {ZONE_OPTIONS.map((z) => {
                  const isSelected = nodeZone === z.id;
                  return (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => setNodeZone(z.id)}
                      className={`py-1 text-[9px] font-bold rounded border text-center transition-all cursor-pointer font-mono ${
                        isSelected
                          ? z.activeColor
                          : 'bg-[#161b24] border-[#212631] text-[#8b949e] hover:border-[#303746]'
                      }`}
                    >
                      {z.label}
                    </button>
                  );
                })}
              </div>

              {/* IP / CIDR Block */}
              <div>
                <input
                  type="text"
                  value={nodeCidr}
                  onChange={(e) => setNodeCidr(e.target.value)}
                  placeholder="IP or CIDR (e.g. 10.0.1.10/32)"
                  className="w-full bg-[#11151c] border border-[#212631] rounded px-2.5 py-1.5 text-xs text-[#f0f3f6] font-mono focus:outline-none focus:border-[#58a6ff] transition-colors"
                />
              </div>
            </div>

            {/* Section: Service Specs */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase text-[#8b949e] font-bold tracking-wider block">
                Service Specs
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="text"
                    value={servicePort}
                    onChange={(e) => setServicePort(e.target.value)}
                    placeholder="Port (e.g. 443)"
                    className="w-full bg-[#11151c] border border-[#212631] rounded px-2.5 py-1.5 text-xs text-[#f0f3f6] font-mono focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
                <div>
                  <select
                    value={serviceProto}
                    onChange={(e) => setServiceProto(e.target.value)}
                    className="w-full bg-[#11151c] border border-[#212631] rounded px-2 py-1.5 text-xs text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
                  >
                    <option value="TCP">TCP</option>
                    <option value="HTTPS">HTTPS</option>
                    <option value="HTTP">HTTP</option>
                    <option value="SSH">SSH</option>
                    <option value="UDP">UDP</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section: Security Classification */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-[#8b949e] font-bold tracking-wider block">
                Security Criticality
              </label>
              <div className="grid grid-cols-4 gap-1">
                {CRITICALITY_OPTIONS.map((c) => {
                  const isSelected = nodeCriticality === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNodeCriticality(c.id)}
                      className={`py-1 text-[9px] font-bold rounded border text-center transition-all cursor-pointer font-mono ${
                        isSelected
                          ? c.activeColor
                          : 'bg-[#161b24] border-[#212631] text-[#8b949e] hover:border-[#303746]'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>

              {/* Tags */}
              <input
                type="text"
                value={nodeTags}
                onChange={(e) => setNodeTags(e.target.value)}
                placeholder="Tags (comma-separated, e.g. pci, database)"
                className="w-full bg-[#11151c] border border-[#212631] rounded px-2.5 py-1.5 text-xs text-[#f0f3f6] focus:outline-none focus:border-[#58a6ff]"
              />
            </div>

            {/* Validation Error Banner */}
            {nodeError && (
              <div className="p-2.5 rounded bg-[#da3633]/15 border border-[#da3633]/50 text-[#f85149] text-[11px] flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{nodeError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center space-x-2">
                <button
                  type="submit"
                  className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded text-xs font-semibold transition-colors shadow-xs cursor-pointer ${
                    nodeSaved
                      ? 'bg-[#238636] text-white'
                      : 'bg-[#1f6feb] hover:bg-[#388bfd] text-white'
                  }`}
                >
                  {nodeSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{nodeSaved ? 'Updated' : 'Save Config'}</span>
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

              {onAnalyzeBlastRadius && (
                <button
                  type="button"
                  onClick={() => onAnalyzeBlastRadius(selectedNode.id)}
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded text-xs font-semibold bg-[#f0883e]/15 hover:bg-[#f0883e]/25 text-[#f0883e] border border-[#f0883e]/40 transition-colors shadow-xs cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Simulate Blast Radius</span>
                </button>
              )}
            </div>

            {/* Node-specific Findings */}
            {nodeFindings.length > 0 && (
              <div className="pt-2 border-t border-[#212631] space-y-2">
                <div className="text-[10px] uppercase text-[#f85149] font-bold tracking-wider flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Violations on Node ({nodeFindings.length})</span>
                </div>
                <div className="space-y-1.5">
                  {nodeFindings.map((f) => (
                    <div
                      key={f.id}
                      className="p-2 rounded bg-[#da3633]/10 border border-[#da3633]/30 text-xs space-y-1"
                    >
                      <div className="text-[#f85149] font-semibold text-[11px] flex items-center justify-between">
                        <span>{f.title}</span>
                        <span className="text-[9px] uppercase px-1 rounded bg-[#da3633]/20 text-[#f85149] font-mono">
                          {f.severity}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#8b949e] line-clamp-2 leading-relaxed">
                        {f.whyItMatters}
                      </div>
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
        {!selectedNode && selectedEdge && (
          <form onSubmit={handleSaveEdge} className="space-y-4">
            {/* Connection Endpoints Card */}
            <div className="p-3 rounded-lg border border-[#212631] bg-[#161b24] space-y-2">
              <div className="text-[10px] text-[#8b949e] uppercase font-bold tracking-wider flex items-center justify-between">
                <span>Traffic Connection</span>
                <span className="font-mono text-[#58a6ff]">{selectedEdge.id}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#f0f3f6] font-semibold bg-[#11151c] p-2 rounded border border-[#212631]">
                <span className="truncate max-w-[110px]" title={edgeCrossingInfo?.srcName}>
                  {edgeCrossingInfo?.srcName ?? selectedEdge.source}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#58a6ff] mx-1 shrink-0" />
                <span className="truncate max-w-[110px]" title={edgeCrossingInfo?.tgtName}>
                  {edgeCrossingInfo?.tgtName ?? selectedEdge.target}
                </span>
              </div>

              {edgeCrossingInfo?.isCrossing && (
                <div className="p-1.5 rounded bg-[#f0883e]/15 border border-[#f0883e]/40 text-[#f0883e] text-[10px] font-semibold flex items-center space-x-1.5">
                  <ShieldAlert className="w-3 h-3 shrink-0" />
                  <span>
                    CROSS-ZONE: {edgeCrossingInfo.srcZone.toUpperCase()} → {edgeCrossingInfo.tgtZone.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Section: Traffic Policy */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-[#8b949e] font-bold tracking-wider block">
                Transport Protocol
              </label>
              <div className="grid grid-cols-4 gap-1">
                {PROTO_OPTIONS.map((proto) => {
                  const isSelected = edgeProtocol === proto;
                  return (
                    <button
                      key={proto}
                      type="button"
                      onClick={() => setEdgeProtocol(proto)}
                      className={`py-1 text-[9px] font-bold rounded border text-center transition-all cursor-pointer font-mono ${
                        isSelected
                          ? 'bg-[#1f6feb]/25 text-[#58a6ff] border-[#388bfd]'
                          : 'bg-[#161b24] border-[#212631] text-[#8b949e] hover:border-[#303746]'
                      }`}
                    >
                      {proto}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="text-[10px] uppercase text-[#8b949e] font-bold tracking-wider block mb-1">
                  Port / Range
                </label>
                <input
                  type="text"
                  value={edgePorts}
                  onChange={(e) => setEdgePorts(e.target.value)}
                  placeholder="443, 8000-8080, ANY"
                  className="w-full bg-[#11151c] border border-[#212631] rounded px-2.5 py-1.5 text-xs text-[#f0f3f6] font-mono focus:outline-none focus:border-[#58a6ff]"
                  required
                />
              </div>

              {/* Access Policy Segmented Button */}
              <div>
                <label className="text-[10px] uppercase text-[#8b949e] font-bold tracking-wider block mb-1">
                  Access Policy
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEdgeAccess('allow')}
                    className={`py-1.5 text-[10px] font-bold rounded border text-center transition-all cursor-pointer font-mono ${
                      edgeAccess === 'allow'
                        ? 'bg-[#238636]/25 text-[#3fb950] border-[#238636]'
                        : 'bg-[#161b24] border-[#212631] text-[#8b949e] hover:border-[#303746]'
                    }`}
                  >
                    ALLOW (PERMIT)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEdgeAccess('deny')}
                    className={`py-1.5 text-[10px] font-bold rounded border text-center transition-all cursor-pointer font-mono ${
                      edgeAccess === 'deny'
                        ? 'bg-[#da3633]/25 text-[#f85149] border-[#da3633]'
                        : 'bg-[#161b24] border-[#212631] text-[#8b949e] hover:border-[#303746]'
                    }`}
                  >
                    DENY (BLOCK)
                  </button>
                </div>
              </div>
            </div>

            {/* Section: Encryption & Relationship */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-[#8b949e] font-bold tracking-wider block">
                Security & Relationship
              </label>

              {/* Encryption Toggle */}
              <div className="p-2.5 rounded bg-[#161b24] border border-[#212631] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Lock className={`w-3.5 h-3.5 ${edgeEncrypted ? 'text-[#3fb950]' : 'text-[#8b949e]'}`} />
                  <span className="text-xs text-[#c9d1d9] font-medium">Encrypted Channel (TLS/SSH)</span>
                </div>
                <input
                  type="checkbox"
                  checked={edgeEncrypted}
                  onChange={(e) => setEdgeEncrypted(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#11151c] border-[#303746] text-[#1f6feb] cursor-pointer"
                />
              </div>

              {/* Relationship Semantic */}
              <select
                value={edgeRelationship}
                onChange={(e) => setEdgeRelationship(e.target.value as EdgeRelationship)}
                className="w-full bg-[#11151c] border border-[#212631] rounded px-2.5 py-1.5 text-xs text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
              >
                <option value="network">Network Reachability</option>
                <option value="management">Management Channel</option>
                <option value="trust">Trust Boundary Transition</option>
                <option value="dependency">Direct Dependency</option>
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
                <span>{edgeSaved ? 'Updated' : 'Save Connection'}</span>
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
        {!selectedNode && !selectedEdge && (
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
                Click any component or connection on the canvas to inspect ports, access control policies,
                trust zone classifications, or simulate compromise blast radius.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
