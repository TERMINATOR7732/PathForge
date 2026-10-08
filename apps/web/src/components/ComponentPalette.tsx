import React, { useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Boxes,
} from 'lucide-react';
import { CoreNodeType } from '@pathforge/shared';

interface PaletteItem {
  type: CoreNodeType;
  label: string;
  zone: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PALETTE_GROUPS: {
  id: string;
  title: string;
  items: PaletteItem[];
}[] = [
  {
    id: 'perimeter',
    title: 'PERIMETER',
    items: [
      { type: 'internet', label: 'Internet', zone: 'PUBLIC', color: '#8b949e', icon: Globe },
      { type: 'firewall', label: 'Firewall / WAF', zone: 'DMZ', color: '#39c5bb', icon: Shield },
      { type: 'load_balancer', label: 'Load Balancer', zone: 'DMZ', color: '#39c5bb', icon: Layers },
      { type: 'vpn', label: 'VPN Gateway', zone: 'DMZ', color: '#39c5bb', icon: KeyRound },
    ],
  },
  {
    id: 'compute',
    title: 'COMPUTE',
    items: [
      { type: 'web_server', label: 'Web Server', zone: 'DMZ', color: '#58a6ff', icon: Server },
      { type: 'api_server', label: 'API Server', zone: 'INTERNAL', color: '#58a6ff', icon: Cpu },
    ],
  },
  {
    id: 'data',
    title: 'DATA',
    items: [
      { type: 'database', label: 'Database (SQL)', zone: 'RESTR', color: '#e3b341', icon: Database },
      { type: 'redis', label: 'Redis Cache', zone: 'RESTR', color: '#e3b341', icon: Zap },
    ],
  },
  {
    id: 'management',
    title: 'MANAGEMENT',
    items: [
      { type: 'admin', label: 'Admin Portal', zone: 'MGMT', color: '#bc8cff', icon: Lock },
    ],
  },
  {
    id: 'network',
    title: 'NETWORKS',
    items: [
      { type: 'internal_network', label: 'Internal Net', zone: 'INTERNAL', color: '#58a6ff', icon: Network },
      { type: 'external_network', label: 'External Net', zone: 'PUBLIC', color: '#8b949e', icon: Share2 },
    ],
  },
];

interface ComponentPaletteProps {
  onAddNodeType?: (type: CoreNodeType) => void;
}

export const ComponentPalette: React.FC<ComponentPaletteProps> = ({ onAddNodeType }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`border-r border-[#212631] bg-[#11151c] flex flex-col h-full select-none transition-all duration-200 z-20 font-sans ${
        isCollapsed ? 'w-12' : 'w-52'
      }`}
    >
      {/* Header Bar */}
      <div className="h-10 px-3 border-b border-[#212631] flex items-center justify-between bg-[#161b24] shrink-0">
        {!isCollapsed && (
          <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#c9d1d9]">
            <Boxes className="w-3.5 h-3.5 text-[#58a6ff]" />
            <span>Components</span>
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#212631] transition-colors ml-auto cursor-pointer"
          title={isCollapsed ? 'Expand Component Palette' : 'Collapse Palette'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Palette Component Tiles */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {PALETTE_GROUPS.map((group) => (
          <div key={group.id} className="space-y-1.5">
            {!isCollapsed && (
              <div className="text-[10px] uppercase font-semibold tracking-wider text-[#8b949e] px-1">
                {group.title}
              </div>
            )}

            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;

                if (isCollapsed) {
                  return (
                    <button
                      key={item.type}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/pathforge-node-type', item.type);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => onAddNodeType?.(item.type)}
                      className="w-8 h-8 rounded border border-[#212631] bg-[#161b24] hover:border-[#388bfd] hover:bg-[#1a212d] flex items-center justify-center transition-all cursor-grab active:cursor-grabbing mx-auto text-[#8b949e] hover:text-[#58a6ff]"
                      title={`${item.label} (${item.zone}) — Drag to canvas or click to add`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                }

                return (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/pathforge-node-type', item.type);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => onAddNodeType?.(item.type)}
                    className="group flex items-center justify-between p-2 rounded-md border border-[#212631] bg-[#161b24] hover:bg-[#1a212d] hover:border-[#388bfd]/60 transition-all cursor-grab active:cursor-grabbing shadow-xs"
                    title={`Drag onto canvas or click to add ${item.label}`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div
                        className="w-6 h-6 rounded bg-[#11151c] border border-[#212631] flex items-center justify-center shrink-0"
                        style={{ color: item.color }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-medium text-[#f0f3f6] group-hover:text-white truncate">
                        {item.label}
                      </span>
                    </div>

                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#11151c] text-[#8b949e] border border-[#212631] shrink-0 font-semibold">
                      {item.zone}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Instructions */}
      {!isCollapsed && (
        <div className="p-2.5 border-t border-[#212631] bg-[#11151c] text-[10px] text-[#8b949e] space-y-0.5">
          <div className="font-semibold text-[#c9d1d9] uppercase tracking-wide">Usage</div>
          <div>• Drag tile onto canvas</div>
          <div>• Drag port to connect</div>
          <div>• Click to inspect & configure</div>
        </div>
      )}
    </aside>
  );
};
