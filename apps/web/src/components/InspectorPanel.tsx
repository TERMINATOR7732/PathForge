import React, { useState, useEffect } from 'react';
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
  const nodeFindings = selectedNode
    ? findings.filter((f) => f.affectedNodes.includes(selectedNode.id))
    : [];

  // Edge-specific findings
  const edgeFindings = selectedEdge
    ? findings.filter((f) => f.affectedEdges.includes(selectedEdge.id))
    : [];

  const inDegree = selectedNode
    ? environment.graph.getIncomingEdges(selectedNode.id).length
    : 0;
  const outDegree = selectedNode
    ? environment.graph.getOutgoingEdges(selectedNode.id).length
    : 0;

  return (
    <aside className="w-80 border-l border-[#222630] bg-[#111318] flex flex-col h-full select-none">
      {/* Panel Header */}
      <div className="px-3.5 py-2.5 border-b border-[#222630] flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b949e] font-semibold flex items-center space-x-1.5">
          <Info className="w-3.5 h-3.5" />
          <span>Inspector</span>
        </span>
        <span className="text-[10px] text-[#5c6370] font-mono">
          {selectedNode ? 'NODE CONFIG' : selectedEdge ? 'EDGE CONFIG' : 'ENVIRONMENT'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Node Inspector & Configuration */}
        {selectedNode && (
          <form onSubmit={handleSaveNode} className="space-y-3.5 text-xs font-mono">
            {/* Name Input */}
            <div>
              <label className="text-[10px] uppercase text-[#5c6370] block mb-1">
                Component Name
              </label>
              <input
                type="text"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                className="w-full bg-[#161a22] border border-[#2a303c] rounded px-2.5 py-1.5 text-xs text-[#e6edf3] font-mono focus:outline-none focus:border-[#388bfd] transition-colors"
                placeholder="Component Name"
                required
              />
            </div>

            {/* Type (Read-only) & Position */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#161a22] p-2 rounded border border-[#262c37]">
                <div className="text-[9px] uppercase text-[#5c6370]">Type</div>
                <div className="text-[#58a6ff] font-medium mt-0.5 truncate">
                  {selectedNode.type}
                </div>
              </div>
              <div className="bg-[#161a22] p-2 rounded border border-[#262c37]">
                <div className="text-[9px] uppercase text-[#5c6370]">Position</div>
                <div className="text-[#8b949e] font-medium mt-0.5">
                  {selectedNode.position.x} / {selectedNode.position.y}
                </div>
              </div>
            </div>

            {/* Zone & Criticality */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase text-[#5c6370] block mb-1">
                  Trust Zone
                </label>
                <select
                  value={nodeZone}
                  onChange={(e) => setNodeZone(e.target.value as NodeZone)}
                  className="w-full bg-[#161a22] border border-[#2a303c] rounded px-2 py-1.5 text-xs text-[#c9d1d9] font-mono focus:outline-none focus:border-[#388bfd]"
                >
                  <option value="public">Public</option>
                  <option value="dmz">DMZ</option>
                  <option value="internal">Internal</option>
                  <option value="restricted">Restricted</option>
                  <option value="management">Management</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] uppercase text-[#5c6370] block mb-1">
                  Criticality
                </label>
                <select
                  value={nodeCriticality}
                  onChange={(e) => setNodeCriticality(e.target.value as AssetCriticality)}
                  className="w-full bg-[#161a22] border border-[#2a303c] rounded px-2 py-1.5 text-xs text-[#c9d1d9] font-mono focus:outline-none focus:border-[#388bfd]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            {/* CIDR / IP */}
            <div>
              <label className="text-[10px] uppercase text-[#5c6370] block mb-1">
                IP Address / CIDR
              </label>
              <input
                type="text"
                value={nodeCidr}
                onChange={(e) => setNodeCidr(e.target.value)}
                placeholder="e.g. 10.0.1.10/32 or 10.0.1.0/24"
                className="w-full bg-[#161a22] border border-[#2a303c] rounded px-2.5 py-1.5 text-xs text-[#e6edf3] font-mono focus:outline-none focus:border-[#388bfd] transition-colors"
              />
            </div>

            {/* Service Port & Protocol */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase text-[#5c6370] block mb-1">
                  Service Port
                </label>
                <input
                  type="text"
                  value={servicePort}
                  onChange={(e) => setServicePort(e.target.value)}
                  placeholder="e.g. 443"
                  className="w-full bg-[#161a22] border border-[#2a303c] rounded px-2 py-1.5 text-xs text-[#e6edf3] font-mono focus:outline-none focus:border-[#388bfd]"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase text-[#5c6370] block mb-1">
                  Service Proto
                </label>
                <select
                  value={serviceProto}
                  onChange={(e) => setServiceProto(e.target.value)}
                  className="w-full bg-[#161a22] border border-[#2a303c] rounded px-2 py-1.5 text-xs text-[#c9d1d9] font-mono focus:outline-none focus:border-[#388bfd]"
                >
                  <option value="TCP">TCP</option>
                  <option value="HTTPS">HTTPS</option>
                  <option value="HTTP">HTTP</option>
                  <option value="SSH">SSH</option>
                  <option value="UDP">UDP</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-[10px] uppercase text-[#5c6370] block mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={nodeTags}
                onChange={(e) => setNodeTags(e.target.value)}
                placeholder="production, tier=database, payments"
                className="w-full bg-[#161a22] border border-[#2a303c] rounded px-2.5 py-1.5 text-xs text-[#e6edf3] font-mono focus:outline-none focus:border-[#388bfd] transition-colors"
              />
            </div>

            {/* Validation Error Message */}
            {nodeError && (
              <div className="p-2 rounded bg-[#271415] border border-[#da3633]/60 text-[#f85149] text-[11px] flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{nodeError}</span>
              </div>
            )}

            {/* Action Buttons: Save & Delete */}
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="submit"
                className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded text-xs font-mono font-medium transition-colors shadow-sm ${
                  nodeSaved
                    ? 'bg-[#238636] text-white'
                    : 'bg-[#1f6feb] hover:bg-[#388bfd] text-white'
                }`}
              >
                {nodeSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{nodeSaved ? 'Saved to Domain' : 'Save Node Config'}</span>
              </button>

              {onDeleteNode && (
                <button
                  type="button"
                  onClick={() => onDeleteNode(selectedNode.id)}
                  className="p-1.5 rounded bg-[#2b181a] hover:bg-[#3b1d20] border border-[#da3633]/50 text-[#f85149] transition-colors"
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
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded text-xs font-mono font-medium bg-[#271d17] hover:bg-[#38231a] text-[#f0883e] border border-[#f0883e]/50 transition-colors shadow-sm cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Analyze Blast Radius</span>
              </button>
            )}

            {/* Connection Summary */}
            <div className="pt-2 border-t border-[#222630]">
              <div className="flex items-center justify-between text-[10px] text-[#5c6370] mb-1">
                <span>INBOUND: {inDegree}</span>
                <span>OUTBOUND: {outDegree}</span>
              </div>
            </div>

            {/* Security Alerts on Selected Node */}
            {nodeFindings.length > 0 && (
              <div>
                <div className="text-[10px] font-mono uppercase text-[#f85149] mb-1.5 font-semibold flex items-center space-x-1">
                  <ShieldAlert className="w-3 h-3" />
                  <span>Security Findings ({nodeFindings.length})</span>
                </div>
                <div className="space-y-1.5">
                  {nodeFindings.map((f) => (
                    <div
                      key={f.id}
                      className="p-2 rounded bg-[#271415] border border-[#da3633]/40 text-xs font-mono"
                    >
                      <div className="text-[#f85149] font-medium text-[11px]">{f.title}</div>
                      <div className="text-[10px] text-[#c9d1d9] mt-1 leading-snug line-clamp-2">
                        {f.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {/* Edge Inspector & Configuration */}
        {!selectedNode && selectedEdge && (
          <form onSubmit={handleSaveEdge} className="space-y-3.5 text-xs font-mono">
            {/* Endpoints Header */}
            <div>
              <div className="text-[10px] font-mono uppercase text-[#5c6370] mb-1">
                Connection
              </div>
              <div className="text-xs font-mono font-medium text-white bg-[#161a22] p-2 rounded border border-[#262c37] flex items-center justify-between">
                <span className="truncate">
                  {environment.getNode(selectedEdge.source)?.name ?? selectedEdge.source}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#58a6ff] mx-1 shrink-0" />
                <span className="truncate">
                  {environment.getNode(selectedEdge.target)?.name ?? selectedEdge.target}
                </span>
              </div>
            </div>

            {/* Protocol & Port */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase text-[#5c6370] block mb-1">
                  Protocol
                </label>
                <select
                  value={edgeProtocol}
                  onChange={(e) => setEdgeProtocol(e.target.value as EdgeProtocol)}
                  className="w-full bg-[#161a22] border border-[#2a303c] rounded px-2 py-1.5 text-xs text-[#c9d1d9] font-mono focus:outline-none focus:border-[#388bfd]"
                >
                  <option value="TCP">TCP</option>
                  <option value="UDP">UDP</option>
                  <option value="HTTP">HTTP</option>
                  <option value="HTTPS">HTTPS</option>
                  <option value="SSH">SSH</option>
                  <option value="TLS">TLS</option>
                  <option value="ICMP">ICMP</option>
                  <option value="ANY">ANY</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] uppercase text-[#5c6370] block mb-1">
                  Port / Range
                </label>
                <input
                  type="text"
                  value={edgePorts}
                  onChange={(e) => setEdgePorts(e.target.value)}
                  placeholder="443, 8000-8080, ANY"
                  className="w-full bg-[#161a22] border border-[#2a303c] rounded px-2 py-1.5 text-xs text-[#e6edf3] font-mono focus:outline-none focus:border-[#388bfd]"
                  required
                />
              </div>
            </div>

            {/* Access & Relationship */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase text-[#5c6370] block mb-1">
                  Access Policy
                </label>
                <select
                  value={edgeAccess}
                  onChange={(e) => setEdgeAccess(e.target.value as EdgeAccess)}
                  className="w-full bg-[#161a22] border border-[#2a303c] rounded px-2 py-1.5 text-xs text-[#c9d1d9] font-mono focus:outline-none focus:border-[#388bfd]"
                >
                  <option value="allow">Allow</option>
                  <option value="deny">Deny</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] uppercase text-[#5c6370] block mb-1">
                  Relationship
                </label>
                <select
                  value={edgeRelationship}
                  onChange={(e) => setEdgeRelationship(e.target.value as EdgeRelationship)}
                  className="w-full bg-[#161a22] border border-[#2a303c] rounded px-2 py-1.5 text-xs text-[#c9d1d9] font-mono focus:outline-none focus:border-[#388bfd]"
                >
                  <option value="network">Network Reachability</option>
                  <option value="management">Management</option>
                  <option value="trust">Trust Boundary</option>
                  <option value="dependency">Dependency</option>
                </select>
              </div>
            </div>

            {/* Encryption Checkbox */}
            <div className="p-2.5 rounded bg-[#161a22] border border-[#262c37] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lock className={`w-3.5 h-3.5 ${edgeEncrypted ? 'text-[#3fb950]' : 'text-[#8b949e]'}`} />
                <span className="text-xs text-[#c9d1d9]">Encrypted Channel (TLS/SSH)</span>
              </div>
              <input
                type="checkbox"
                checked={edgeEncrypted}
                onChange={(e) => setEdgeEncrypted(e.target.checked)}
                className="w-4 h-4 rounded bg-[#0d0f12] border-[#2a303c] text-[#388bfd] focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Edge Validation Error */}
            {edgeError && (
              <div className="p-2 rounded bg-[#271415] border border-[#da3633]/60 text-[#f85149] text-[11px] flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{edgeError}</span>
              </div>
            )}

            {/* Save & Delete Edge */}
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="submit"
                className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded text-xs font-mono font-medium transition-colors shadow-sm ${
                  edgeSaved
                    ? 'bg-[#238636] text-white'
                    : 'bg-[#1f6feb] hover:bg-[#388bfd] text-white'
                }`}
              >
                {edgeSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{edgeSaved ? 'Saved to Domain' : 'Save Connection'}</span>
              </button>

              {onDeleteEdge && (
                <button
                  type="button"
                  onClick={() => onDeleteEdge(selectedEdge.id)}
                  className="p-1.5 rounded bg-[#2b181a] hover:bg-[#3b1d20] border border-[#da3633]/50 text-[#f85149] transition-colors"
                  title="Delete Connection"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Edge Security Alerts */}
            {edgeFindings.length > 0 && (
              <div>
                <div className="text-[10px] font-mono uppercase text-[#f85149] mb-1.5 font-semibold flex items-center space-x-1">
                  <ShieldAlert className="w-3 h-3" />
                  <span>Edge Violations ({edgeFindings.length})</span>
                </div>
                <div className="space-y-1.5">
                  {edgeFindings.map((f) => (
                    <div
                      key={f.id}
                      className="p-2 rounded bg-[#271415] border border-[#da3633]/40 text-xs font-mono"
                    >
                      <div className="text-[#f85149] font-medium text-[11px]">{f.title}</div>
                      <div className="text-[10px] text-[#e6edf3] mt-1 leading-snug font-mono">
                        {f.description}
                      </div>
                      <div className="text-[10px] text-[#8b949e] mt-1 leading-snug">
                        {f.whyItMatters}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {/* Global Topology Summary when nothing selected */}
        {!selectedNode && !selectedEdge && (
          <div className="space-y-3">
            <div className="p-3 bg-[#161a22] rounded border border-[#262c37] space-y-2">
              <div className="text-xs font-mono font-medium text-white">{environment.name}</div>
              <div className="text-[10px] text-[#8b949e] font-mono leading-relaxed">
                {environment.description}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-[#161a22] p-2 rounded border border-[#262c37]">
                <div className="text-[9px] uppercase text-[#5c6370]">Total Nodes</div>
                <div className="text-white text-sm font-semibold mt-0.5">
                  {environment.getNodes().length}
                </div>
              </div>
              <div className="bg-[#161a22] p-2 rounded border border-[#262c37]">
                <div className="text-[9px] uppercase text-[#5c6370]">Total Edges</div>
                <div className="text-white text-sm font-semibold mt-0.5">
                  {environment.getEdges().length}
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-[#161a22] rounded border border-[#262c37] text-[10px] font-mono space-y-1.5">
              <div className="text-[#8b949e]">Author: {environment.metadata.author ?? 'System'}</div>
              <div className="text-[#5c6370]">
                Last evaluated: {new Date(environment.metadata.updatedAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
