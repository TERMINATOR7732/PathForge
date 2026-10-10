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
  Flame,
  Radio,
  Crosshair,
} from 'lucide-react';

export const NODE_WIDTH = 186;
export const NODE_HEIGHT = 80;

interface CanvasNodeProps {
  node: InfrastructureNode;
  isSelected: boolean;
  isCritical: boolean;
  isHigh: boolean;
  isHoveredFromFinding?: boolean;
  isConnectionTarget?: boolean;
  isOnAttackPath?: boolean;
  attackHopIndex?: number | null;
  isAttackOrigin?: boolean;
  isAttackTarget?: boolean;
  isCompromisedOrigin?: boolean;
  lateralDepth?: number | null;
  isLateralCritical?: boolean;
  isDimmed?: boolean;
  degree: { inDegree: number; outDegree: number; total: number };
  onSelect: (nodeId: string) => void;
  onStartDrag: (nodeId: string, clientX: number, clientY: number) => void;
  onStartConnection: (sourceNodeId: string, handleX: number, handleY: number) => void;
  onHoverConnectionTarget: (nodeId: string | null) => void;
}

interface NodeCategoryConfig {
  category: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

function getNodeCategoryConfig(type: string): NodeCategoryConfig {
  switch (type) {
    case 'internet':
      return { category: 'EXTERNAL', color: '#8b949e', icon: Globe };
    case 'external_network':
      return { category: 'EXTERNAL', color: '#8b949e', icon: Share2 };
    case 'firewall':
      return { category: 'PERIMETER', color: '#39c5bb', icon: Shield };
    case 'load_balancer':
      return { category: 'PERIMETER', color: '#39c5bb', icon: Layers };
    case 'vpn':
      return { category: 'GATEWAY', color: '#39c5bb', icon: KeyRound };
    case 'web_server':
      return { category: 'COMPUTE', color: '#58a6ff', icon: Server };
    case 'api_server':
      return { category: 'COMPUTE', color: '#58a6ff', icon: Cpu };
    case 'database':
      return { category: 'DATA', color: '#e3b341', icon: Database };
    case 'redis':
      return { category: 'CACHE', color: '#e3b341', icon: Zap };
    case 'admin':
      return { category: 'ADMIN', color: '#bc8cff', icon: Lock };
    case 'internal_network':
    default:
      return { category: 'NETWORK', color: '#58a6ff', icon: Network };
  }
}

export const CanvasNode: React.FC<CanvasNodeProps> = ({
  node,
  isSelected,
  isCritical,
  isHigh,
  isHoveredFromFinding = false,
  isConnectionTarget = false,
  isOnAttackPath = false,
  attackHopIndex = null,
  isAttackOrigin = false,
  isAttackTarget = false,
  isCompromisedOrigin = false,
  lateralDepth = null,
  isLateralCritical = false,
  isDimmed = false,
  onSelect,
  onStartDrag,
  onStartConnection,
  onHoverConnectionTarget,
}) => {
  const catConfig = getNodeCategoryConfig(node.type);
  const Icon = catConfig.icon;

  // Determine State Borders and Styling
  let borderClass = 'border-[#2d3442] hover:border-[#424c5e]';
  let bgClass = 'bg-[#141822]';
  let ringClass = '';

  if (isCompromisedOrigin || isAttackOrigin) {
    borderClass = 'border-[#f0883e]';
    ringClass = 'ring-2 ring-[#f0883e]/60 shadow-[0_0_14px_rgba(240,136,62,0.25)]';
    bgClass = 'bg-[#1c1814]';
  } else if (isAttackTarget) {
    borderClass = 'border-[#f85149]';
    ringClass = 'ring-2 ring-[#f85149]/70 shadow-[0_0_16px_rgba(248,81,73,0.3)]';
    bgClass = 'bg-[#1c1416]';
  } else if (isOnAttackPath) {
    borderClass = 'border-[#f85149]';
    ringClass = 'ring-2 ring-[#f85149]/50 shadow-[0_0_10px_rgba(248,81,73,0.2)]';
    bgClass = 'bg-[#1a1315]';
  } else if (lateralDepth !== null && lateralDepth !== undefined) {
    borderClass = isLateralCritical ? 'border-[#f85149]' : 'border-[#bc8cff]';
    ringClass = isLateralCritical
      ? 'ring-2 ring-[#f85149]/50 shadow-md'
      : 'ring-2 ring-[#bc8cff]/50 shadow-[0_0_10px_rgba(188,140,255,0.2)]';
    bgClass = 'bg-[#181320]';
  } else if (isSelected) {
    borderClass = 'border-[#58a6ff]';
    ringClass = 'ring-2 ring-[#58a6ff]/60 shadow-[0_0_12px_rgba(88,166,255,0.25)]';
    bgClass = 'bg-[#182030]';
  } else if (isHoveredFromFinding) {
    borderClass = 'border-[#f0883e]';
    ringClass = 'ring-2 ring-[#f0883e]/50 shadow-md';
    bgClass = 'bg-[#1a1612]';
  } else if (isConnectionTarget) {
    borderClass = 'border-[#58a6ff]';
    ringClass = 'ring-2 ring-[#58a6ff]/40';
    bgClass = 'bg-[#182030]';
  } else if (isCritical) {
    borderClass = 'border-[#f85149]/70 hover:border-[#f85149]';
  } else if (isHigh) {
    borderClass = 'border-[#f0883e]/70 hover:border-[#f0883e]';
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(node.id);
    onStartDrag(node.id, e.clientX, e.clientY);
  };

  const handleOutputHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStartConnection(node.id, node.position.x + NODE_WIDTH, node.position.y + NODE_HEIGHT / 2);
  };

  const zoneName = (node.metadata.zone ?? 'internal').toUpperCase();
  const servicePort = node.metadata.service?.port;
  const serviceProtocol = node.metadata.service?.protocol ?? 'TCP';

  return (
    <div
      style={{
        position: 'absolute',
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: `${NODE_WIDTH}px`,
        height: `${NODE_HEIGHT}px`,
      }}
      className={`group rounded-lg border ${borderClass} ${bgClass} ${ringClass} select-none z-10 cursor-grab active:cursor-grabbing transition-[opacity,box-shadow,border-color] duration-150 font-sans shadow-sm flex flex-col justify-between ${
        isDimmed ? 'opacity-25 grayscale-[70%] hover:opacity-80' : 'opacity-100'
      }`}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => onHoverConnectionTarget(node.id)}
      onMouseLeave={() => onHoverConnectionTarget(null)}
    >
      {/* Input Connection Handle (Left) */}
      <div
        className="absolute -left-[5px] top-[35px] w-2.5 h-2.5 rounded-full bg-[#11151c] border-2 border-[#58a6ff] hover:bg-[#58a6ff] hover:scale-125 transition-transform z-20 cursor-pointer"
        title="Inbound Traffic Port (Click/Drop to Connect)"
        onMouseEnter={() => onHoverConnectionTarget(node.id)}
      />

      {/* Output Connection Handle (Right) */}
      <div
        className="absolute -right-[5px] top-[35px] w-2.5 h-2.5 rounded-full bg-[#11151c] border-2 border-[#3fb950] hover:bg-[#3fb950] hover:scale-125 transition-transform z-20 cursor-crosshair"
        title="Outbound Traffic Port (Drag to Target)"
        onMouseDown={handleOutputHandleMouseDown}
      />

      {/* Left Tier Accent Stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
        style={{ backgroundColor: catConfig.color }}
      />

      {/* Row 1: Node Header (Type, Icon, Status Indicator) */}
      <div className="flex items-center justify-between pl-3 pr-2.5 pt-2 text-[10px] leading-none">
        <div className="flex items-center space-x-1.5 truncate">
          <span style={{ color: catConfig.color }} className="inline-flex shrink-0">
            <Icon className="w-3.5 h-3.5" />
          </span>
          <span className="text-[#8b949e] uppercase font-semibold tracking-wider truncate text-[9px]">
            {node.type.replace('_', ' ')}
          </span>
        </div>

        {/* Dynamic Status / Traversal Badge */}
        {isCompromisedOrigin || isAttackOrigin ? (
          <span className="inline-flex items-center space-x-1 text-[9px] text-[#f0883e] font-bold bg-[#f0883e]/20 px-1.5 py-0.5 rounded border border-[#f0883e]/40">
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            <span>ORIGIN</span>
          </span>
        ) : isAttackTarget ? (
          <span className="inline-flex items-center space-x-1 text-[9px] text-[#f85149] font-bold bg-[#f85149]/20 px-1.5 py-0.5 rounded border border-[#f85149]/40">
            <Crosshair className="w-2.5 h-2.5" />
            <span>TARGET</span>
          </span>
        ) : isOnAttackPath && attackHopIndex !== null ? (
          <span className="inline-flex items-center space-x-1 text-[9px] text-[#f85149] font-bold bg-[#f85149]/20 px-1.5 py-0.5 rounded border border-[#f85149]/40">
            <Flame className="w-2.5 h-2.5" />
            <span>HOP #{attackHopIndex}</span>
          </span>
        ) : lateralDepth !== null && lateralDepth !== undefined ? (
          <span
            className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded border ${
              isLateralCritical
                ? 'text-[#f85149] bg-[#f85149]/20 border-[#f85149]/40'
                : 'text-[#bc8cff] bg-[#bc8cff]/20 border-[#bc8cff]/40'
            }`}
          >
            +{lateralDepth} HOP
          </span>
        ) : isCritical ? (
          <span className="inline-flex items-center text-[9px] text-[#f85149] font-bold bg-[#da3633]/20 px-1.5 py-0.5 rounded border border-[#da3633]/40">
            CRITICAL
          </span>
        ) : isHigh ? (
          <span className="inline-flex items-center text-[9px] text-[#f0883e] font-bold bg-[#f0883e]/20 px-1.5 py-0.5 rounded border border-[#f0883e]/40">
            HIGH
          </span>
        ) : null}
      </div>

      {/* Row 2: Asset Identity Name */}
      <div className="pl-3 pr-2.5 py-0.5">
        <div
          className="text-sm font-semibold text-[#f0f3f6] truncate font-sans tracking-tight"
          title={`${node.name} (${node.type.replace('_', ' ')})\nZone: ${zoneName}\nCIDR: ${node.metadata.cidr || 'N/A'}\nService: ${servicePort ? `${serviceProtocol}:${servicePort}` : 'None'}\nCriticality: ${node.metadata.criticality || 'medium'}`}
        >
          {node.name}
        </div>
      </div>

      {/* Row 3: Trust Zone & Service Specs */}
      <div className="flex items-center justify-between pl-3 pr-2.5 pb-2 text-2xs">
        {/* Trust Zone Pill */}
        <span className="px-1.5 py-0.5 rounded bg-[#0d1117] text-[#8b949e] border border-[#212631] font-mono uppercase font-semibold">
          {zoneName}
        </span>

        {/* Service Port Pill */}
        {servicePort ? (
          <span className="px-1.5 py-0.5 rounded bg-[#1f6feb]/15 text-[#58a6ff] border border-[#388bfd]/30 font-mono font-semibold">
            {serviceProtocol}:{servicePort}
          </span>
        ) : (
          <span className="text-2xs font-mono text-[#484f58] uppercase">
            {catConfig.category}
          </span>
        )}
      </div>

      {/* Selection Corner Accents (rendered when selected) */}
      {isSelected && (
        <>
          <div className="absolute -top-1 -left-1 w-2 h-2 rounded-[1px] bg-[#58a6ff]" />
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-[1px] bg-[#58a6ff]" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-[1px] bg-[#58a6ff]" />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 rounded-[1px] bg-[#58a6ff]" />
        </>
      )}
    </div>
  );
};
