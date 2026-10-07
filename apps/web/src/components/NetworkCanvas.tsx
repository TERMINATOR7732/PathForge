import { Environment } from '@pathforge/core';
import { Finding } from '@pathforge/shared';
import {
  Globe,
  Shield,
  Layers,
  Server,
  Cpu,
  Database,
  Zap,
  Lock,
  KeyRound,
  Network,
  Share2,
  AlertTriangle,
} from 'lucide-react';

interface NetworkCanvasProps {
  environment: Environment;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  activeFindings: Finding[];
}

const getNodeIcon = (type: string) => {
  switch (type) {
    case 'internet':
      return Globe;
    case 'firewall':
      return Shield;
    case 'load_balancer':
      return Layers;
    case 'web_server':
      return Server;
    case 'api_server':
      return Cpu;
    case 'database':
      return Database;
    case 'redis':
      return Zap;
    case 'admin':
      return Lock;
    case 'vpn':
      return KeyRound;
    case 'internal_network':
      return Network;
    default:
      return Share2;
  }
};

export const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
  environment,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  activeFindings,
}) => {
  const nodes = environment.getNodes();
  const edges = environment.getEdges();

  // Find all node IDs affected by critical or high findings
  const criticalAffectedNodeIds = new Set(
    activeFindings
      .filter((f) => f.severity === 'critical')
      .flatMap((f) => f.affectedNodes)
  );

  const highAffectedNodeIds = new Set(
    activeFindings
      .filter((f) => f.severity === 'high')
      .flatMap((f) => f.affectedNodes)
  );

  const affectedEdgeIds = new Set(
    activeFindings.flatMap((f) => f.affectedEdges)
  );

  return (
    <div
      className="flex-1 h-full canvas-grid relative overflow-auto p-8 select-none"
      onClick={() => {
        onSelectNode(null);
        onSelectEdge(null);
      }}
    >
      {/* SVG Connecting Edges Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: 1400, minHeight: 800 }}>
        <defs>
          <marker
            id="arrowhead-normal"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 8 4, 0 8" fill="#4a5568" />
          </marker>
          <marker
            id="arrowhead-critical"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 8 4, 0 8" fill="#f85149" />
          </marker>
          <marker
            id="arrowhead-active"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 8 4, 0 8" fill="#388bfd" />
          </marker>
        </defs>

        {edges.map((edge) => {
          const sourceNode = environment.getNode(edge.source);
          const targetNode = environment.getNode(edge.target);
          if (!sourceNode || !targetNode) return null;

          const isSelected = selectedEdgeId === edge.id;
          const isVulnerable = affectedEdgeIds.has(edge.id);

          // Card dimensions: width 190, height ~95
          const sx = sourceNode.position.x + 190;
          const sy = sourceNode.position.y + 45;
          const tx = targetNode.position.x;
          const ty = targetNode.position.y + 45;

          const midX = (sx + tx) / 2;
          const midY = (sy + ty) / 2;

          let strokeColor = '#3e4657';
          let markerId = 'arrowhead-normal';

          if (isVulnerable) {
            strokeColor = '#f85149';
            markerId = 'arrowhead-critical';
          } else if (isSelected) {
            strokeColor = '#388bfd';
            markerId = 'arrowhead-active';
          }

          return (
            <g key={edge.id} className="pointer-events-auto cursor-pointer" onClick={(e) => {
              e.stopPropagation();
              onSelectEdge(edge.id);
              onSelectNode(null);
            }}>
              <path
                d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={isSelected || isVulnerable ? 2.5 : 1.75}
                strokeDasharray={isVulnerable ? '4 3' : undefined}
                markerEnd={`url(#${markerId})`}
                className="transition-colors hover:stroke-[#58a6ff]"
              />

              {/* Edge Label Pill */}
              <foreignObject
                x={midX - 45}
                y={midY - 12}
                width={90}
                height={24}
                className="overflow-visible"
              >
                <div
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border text-center transition-all ${
                    isVulnerable
                      ? 'bg-[#2b1617] border-[#da3633] text-[#f85149]'
                      : isSelected
                      ? 'bg-[#122438] border-[#388bfd] text-[#58a6ff]'
                      : 'bg-[#181c24] border-[#2a303c] text-[#8b949e] hover:border-[#3e4657]'
                  }`}
                >
                  {edge.metadata?.ports
                    ? `${edge.metadata.protocol ?? 'tcp'}:${edge.metadata.ports}`
                    : edge.metadata?.protocol ?? 'edge'}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>

      {/* Nodes Layer */}
      <div className="relative" style={{ minWidth: 1400, minHeight: 800 }}>
        {nodes.map((node) => {
          const Icon = getNodeIcon(node.type);
          const isSelected = selectedNodeId === node.id;
          const isCritical = criticalAffectedNodeIds.has(node.id);
          const isHigh = !isCritical && highAffectedNodeIds.has(node.id);
          const degree = environment.graph.getDegree(node.id);

          let borderClass = 'border-[#262c37] hover:border-[#384152]';
          let bgClass = 'bg-[#14171d]';

          if (isCritical) {
            borderClass = 'border-[#f85149] ring-1 ring-[#f85149]/40';
            bgClass = 'bg-[#1b1416]';
          } else if (isHigh) {
            borderClass = 'border-[#f0883e] ring-1 ring-[#f0883e]/30';
            bgClass = 'bg-[#1c1815]';
          } else if (isSelected) {
            borderClass = 'border-[#388bfd] ring-1 ring-[#388bfd]/50';
            bgClass = 'bg-[#151c27]';
          }

          return (
            <div
              key={node.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode(node.id);
                onSelectEdge(null);
              }}
              style={{
                position: 'absolute',
                left: `${node.position.x}px`,
                top: `${node.position.y}px`,
                width: '190px',
              }}
              className={`rounded-md border ${borderClass} ${bgClass} shadow-md cursor-pointer transition-all select-none hover:shadow-lg`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#222630] bg-[#0f1116]/60">
                <div className="flex items-center space-x-1.5">
                  <Icon className="w-3.5 h-3.5 text-[#58a6ff]" />
                  <span className="text-[10px] font-mono text-[#8b949e] uppercase font-semibold">
                    {node.type.replace('_', ' ')}
                  </span>
                </div>
                {isCritical && (
                  <span className="flex items-center text-[9px] font-mono text-[#f85149] font-semibold">
                    <AlertTriangle className="w-3 h-3 mr-0.5 fill-current" />
                    RISK
                  </span>
                )}
              </div>

              {/* Card Body */}
              <div className="p-2.5">
                <div className="text-xs font-medium text-[#e6edf3] font-mono truncate" title={node.name}>
                  {node.name}
                </div>
                <div className="text-[10px] text-[#5c6370] font-mono mt-0.5 truncate">
                  ID: {node.id}
                </div>
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between px-2.5 py-1 border-t border-[#222630]/70 text-[9px] font-mono text-[#5c6370]">
                <span>zone: {node.metadata.zone ?? 'default'}</span>
                <span>deg: {degree.total} (in:{degree.inDegree}/out:{degree.outDegree})</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
