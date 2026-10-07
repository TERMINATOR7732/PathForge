import React from 'react';
import { Environment } from '@pathforge/core';
import { Finding } from '@pathforge/shared';
import { Info, ArrowRight, ShieldAlert } from 'lucide-react';

interface InspectorPanelProps {
  environment: Environment;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  findings: Finding[];
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  environment,
  selectedNodeId,
  selectedEdgeId,
  findings,
}) => {
  const selectedNode = selectedNodeId ? environment.getNode(selectedNodeId) : null;
  const selectedEdge = selectedEdgeId ? environment.getEdge(selectedEdgeId) : null;

  // Node-specific findings
  const nodeFindings = selectedNode
    ? findings.filter((f) => f.affectedNodes.includes(selectedNode.id))
    : [];

  // Edge-specific findings
  const edgeFindings = selectedEdge
    ? findings.filter((f) => f.affectedEdges.includes(selectedEdge.id))
    : [];

  return (
    <aside className="w-80 border-l border-[#222630] bg-[#111318] flex flex-col h-full select-none">
      {/* Panel Header */}
      <div className="px-3.5 py-2.5 border-b border-[#222630] flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b949e] font-semibold flex items-center space-x-1.5">
          <Info className="w-3.5 h-3.5" />
          <span>Inspector</span>
        </span>
        <span className="text-[10px] text-[#5c6370] font-mono">
          {selectedNode ? 'NODE' : selectedEdge ? 'EDGE' : 'ENVIRONMENT'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Node Inspector */}
        {selectedNode && (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-mono uppercase text-[#5c6370] mb-1">
                Component Name
              </div>
              <div className="text-sm font-mono font-medium text-white bg-[#161a22] p-2 rounded border border-[#262c37]">
                {selectedNode.name}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-[#161a22] p-2 rounded border border-[#262c37]">
                <div className="text-[9px] uppercase text-[#5c6370]">Type</div>
                <div className="text-[#58a6ff] font-medium mt-0.5">{selectedNode.type}</div>
              </div>
              <div className="bg-[#161a22] p-2 rounded border border-[#262c37]">
                <div className="text-[9px] uppercase text-[#5c6370]">Zone</div>
                <div className="text-[#c9d1d9] font-medium mt-0.5">
                  {selectedNode.metadata.zone ?? 'default'}
                </div>
              </div>
            </div>

            {/* Ingress / Egress Connections */}
            <div>
              <div className="text-[10px] font-mono uppercase text-[#5c6370] mb-1.5 flex items-center justify-between">
                <span>Inbound Links</span>
                <span className="text-[#8b949e]">
                  {environment.graph.getIncomingEdges(selectedNode.id).length}
                </span>
              </div>
              <div className="space-y-1">
                {environment.graph.getIncomingEdges(selectedNode.id).map((e) => {
                  const src = environment.getNode(e.source);
                  return (
                    <div
                      key={e.id}
                      className="text-xs font-mono p-1.5 rounded bg-[#161a22] border border-[#262c37] flex items-center justify-between text-[#8b949e]"
                    >
                      <span className="text-[#c9d1d9] truncate">{src?.name ?? e.source}</span>
                      <ArrowRight className="w-3 h-3 text-[#5c6370] mx-1 shrink-0" />
                      <span className="text-[#58a6ff] shrink-0">{e.metadata.ports ?? 'edge'}</span>
                    </div>
                  );
                })}
                {environment.graph.getIncomingEdges(selectedNode.id).length === 0 && (
                  <div className="text-[10px] font-mono text-[#5c6370] italic">
                    No inbound ingress links
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase text-[#5c6370] mb-1.5 flex items-center justify-between">
                <span>Outbound Links</span>
                <span className="text-[#8b949e]">
                  {environment.graph.getOutgoingEdges(selectedNode.id).length}
                </span>
              </div>
              <div className="space-y-1">
                {environment.graph.getOutgoingEdges(selectedNode.id).map((e) => {
                  const tgt = environment.getNode(e.target);
                  return (
                    <div
                      key={e.id}
                      className="text-xs font-mono p-1.5 rounded bg-[#161a22] border border-[#262c37] flex items-center justify-between text-[#8b949e]"
                    >
                      <ArrowRight className="w-3 h-3 text-[#5c6370] mr-1 shrink-0" />
                      <span className="text-[#c9d1d9] truncate">{tgt?.name ?? e.target}</span>
                      <span className="text-[#58a6ff] shrink-0 ml-1">
                        {e.metadata.ports ?? 'edge'}
                      </span>
                    </div>
                  );
                })}
                {environment.graph.getOutgoingEdges(selectedNode.id).length === 0 && (
                  <div className="text-[10px] font-mono text-[#5c6370] italic">
                    No outbound egress links
                  </div>
                )}
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
          </div>
        )}

        {/* Edge Inspector */}
        {!selectedNode && selectedEdge && (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-mono uppercase text-[#5c6370] mb-1">
                Edge ID
              </div>
              <div className="text-xs font-mono font-medium text-white bg-[#161a22] p-2 rounded border border-[#262c37]">
                {selectedEdge.id}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-[#161a22] p-2 rounded border border-[#262c37]">
                <div className="text-[9px] uppercase text-[#5c6370]">Protocol</div>
                <div className="text-[#58a6ff] font-medium mt-0.5 uppercase">
                  {selectedEdge.metadata.protocol ?? 'tcp'}
                </div>
              </div>
              <div className="bg-[#161a22] p-2 rounded border border-[#262c37]">
                <div className="text-[9px] uppercase text-[#5c6370]">Ports</div>
                <div className="text-[#c9d1d9] font-medium mt-0.5">
                  {selectedEdge.metadata.ports ?? 'unspecified'}
                </div>
              </div>
              <div className="bg-[#161a22] p-2 rounded border border-[#262c37]">
                <div className="text-[9px] uppercase text-[#5c6370]">Direction</div>
                <div className="text-[#c9d1d9] font-medium mt-0.5">
                  {selectedEdge.metadata.direction ?? 'unidirectional'}
                </div>
              </div>
              <div className="bg-[#161a22] p-2 rounded border border-[#262c37]">
                <div className="text-[9px] uppercase text-[#5c6370]">Encrypted</div>
                <div
                  className={`font-medium mt-0.5 ${
                    selectedEdge.metadata.encrypted ? 'text-[#3fb950]' : 'text-[#f85149]'
                  }`}
                >
                  {selectedEdge.metadata.encrypted ? 'YES (TLS)' : 'NO (Cleartext)'}
                </div>
              </div>
            </div>

            {/* Source & Target */}
            <div className="bg-[#161a22] p-2.5 rounded border border-[#262c37] space-y-2 text-xs font-mono">
              <div>
                <span className="text-[9px] uppercase text-[#5c6370] block">Source</span>
                <span className="text-[#e6edf3]">
                  {environment.getNode(selectedEdge.source)?.name ?? selectedEdge.source}
                </span>
              </div>
              <div className="h-px bg-[#262c37]" />
              <div>
                <span className="text-[9px] uppercase text-[#5c6370] block">Destination</span>
                <span className="text-[#e6edf3]">
                  {environment.getNode(selectedEdge.target)?.name ?? selectedEdge.target}
                </span>
              </div>
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
                      <div className="text-[10px] text-[#c9d1d9] mt-1 leading-snug">
                        {f.whyItMatters}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
