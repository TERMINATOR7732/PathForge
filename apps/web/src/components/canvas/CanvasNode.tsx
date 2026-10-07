import React from 'react';
import { InfrastructureNode } from '@pathforge/core';
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

interface CanvasNodeProps {
  node: InfrastructureNode;
  isSelected: boolean;
  isCritical: boolean;
  isHigh: boolean;
  isConnectionTarget: boolean;
  degree: { inDegree: number; outDegree: number; total: number };
  onSelect: (nodeId: string) => void;
  onStartDrag: (nodeId: string, clientX: number, clientY: number) => void;
  onStartConnection: (sourceNodeId: string, handleX: number, handleY: number) => void;
  onHoverConnectionTarget: (nodeId: string | null) => void;
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

export const CanvasNode: React.FC<CanvasNodeProps> = ({
  node,
  isSelected,
  isCritical,
  isHigh,
  isConnectionTarget,
  degree,
  onSelect,
  onStartDrag,
  onStartConnection,
  onHoverConnectionTarget,
}) => {
  const Icon = getNodeIcon(node.type);

  let borderClass = 'border-[#262c37] hover:border-[#384152]';
  let bgClass = 'bg-[#14171d]';

  if (isConnectionTarget) {
    borderClass = 'border-[#388bfd] ring-2 ring-[#388bfd]/60';
    bgClass = 'bg-[#152336]';
  } else if (isCritical) {
    borderClass = 'border-[#f85149] ring-1 ring-[#f85149]/40';
    bgClass = 'bg-[#1c1315]';
  } else if (isHigh) {
    borderClass = 'border-[#f0883e] ring-1 ring-[#f0883e]/30';
    bgClass = 'bg-[#1c1714]';
  } else if (isSelected) {
    borderClass = 'border-[#388bfd] ring-1 ring-[#388bfd]/60';
    bgClass = 'bg-[#151c27]';
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only primary left button initiates drag
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(node.id);
    onStartDrag(node.id, e.clientX, e.clientY);
  };

  const handleOutputHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Output handle is at x + 200, y + 45
    onStartConnection(node.id, node.position.x + 200, node.position.y + 45);
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: '200px',
      }}
      className={`group rounded-md border ${borderClass} ${bgClass} shadow-md transition-shadow select-none z-10 cursor-grab active:cursor-grabbing`}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => onHoverConnectionTarget(node.id)}
      onMouseLeave={() => onHoverConnectionTarget(null)}
    >
      {/* Input Connection Handle (Left) */}
      <div
        className="absolute -left-2 top-[37px] w-3.5 h-3.5 rounded-full bg-[#181c24] border-2 border-[#58a6ff] hover:bg-[#58a6ff] hover:scale-125 transition-all shadow-sm z-20 cursor-pointer"
        title="Input connection port"
        onMouseEnter={() => onHoverConnectionTarget(node.id)}
      />

      {/* Output Connection Handle (Right) */}
      <div
        className="absolute -right-2 top-[37px] w-3.5 h-3.5 rounded-full bg-[#181c24] border-2 border-[#3fb950] hover:bg-[#3fb950] hover:scale-125 transition-all shadow-sm z-20 cursor-crosshair"
        title="Drag from here to connect to another node"
        onMouseDown={handleOutputHandleMouseDown}
      />

      {/* Card Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#222630] bg-[#0e1014]/70">
        <div className="flex items-center space-x-1.5">
          <Icon className="w-3.5 h-3.5 text-[#58a6ff] shrink-0" />
          <span className="text-[10px] font-mono text-[#8b949e] uppercase font-semibold truncate max-w-[120px]">
            {node.type.replace('_', ' ')}
          </span>
        </div>
        {isCritical ? (
          <span className="flex items-center text-[9px] font-mono text-[#f85149] font-semibold shrink-0">
            <AlertTriangle className="w-3 h-3 mr-0.5 fill-current" />
            RISK
          </span>
        ) : (
          <span className="text-[9px] font-mono text-[#5c6370] uppercase">
            {node.metadata.zone ?? 'net'}
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="p-2.5">
        <div className="text-xs font-medium text-[#e6edf3] font-mono truncate" title={node.name}>
          {node.name}
        </div>
        <div className="text-[9px] text-[#5c6370] font-mono mt-0.5 truncate flex items-center justify-between">
          <span className="truncate">{node.metadata.cidr || node.id}</span>
          {node.metadata.service?.port && (
            <span className="ml-1 text-[9px] text-[#58a6ff] bg-[#161b22] px-1 rounded border border-[#30363d] shrink-0 font-mono">
              :{node.metadata.service.port}
            </span>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="flex items-center justify-between px-2.5 py-1 border-t border-[#222630]/60 text-[9px] font-mono text-[#5c6370] bg-[#0c0d10]/40">
        <span>zone: {node.metadata.zone ?? 'internal'}</span>
        <span>in:{degree.inDegree} / out:{degree.outDegree}</span>
      </div>
    </div>
  );
};
