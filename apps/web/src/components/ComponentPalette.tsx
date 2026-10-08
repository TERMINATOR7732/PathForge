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
  desc: string;
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
      {
        type: 'internet',
        label: 'Internet',
        zone: 'PUBLIC',
        desc: 'Public ingress entry point',
        color: '#f85149',
        icon: Globe,
      },
      {
        type: 'firewall',
        label: 'Firewall / WAF',
        zone: 'DMZ',
        desc: 'Perimeter filtering & inspection',
        color: '#39c5bb',
        icon: Shield,
      },
      {
        type: 'load_balancer',
        label: 'Load Balancer',
        zone: 'DMZ',
        desc: 'Ingress traffic distribution',
        color: '#39c5bb',
        icon: Layers,
      },
      {
        type: 'vpn',
        label: 'VPN Gateway',
        zone: 'DMZ',
        desc: 'Encrypted tunnel gateway',
        color: '#39c5bb',
        icon: KeyRound,
      },
    ],
  },
  {
    id: 'compute',
    title: 'COMPUTE',
    items: [
      {
        type: 'web_server',
        label: 'Web Server',
        zone: 'DMZ',
        desc: 'Frontend web presentation tier',
        color: '#58a6ff',
        icon: Server,
      },
      {
        type: 'api_server',
        label: 'API Server',
        zone: 'INTERNAL',
        desc: 'Backend service execution',
        color: '#58a6ff',
        icon: Cpu,
      },
    ],
  },
  {
    id: 'data',
    title: 'DATA',
    items: [
      {
        type: 'database',
        label: 'Database (SQL)',
        zone: 'RESTR',
        desc: 'Relational data persistence',
        color: '#e3b341',
        icon: Database,
      },
      {
        type: 'redis',
        label: 'Redis Cache',
        zone: 'RESTR',
        desc: 'Fast key-value cache layer',
        color: '#e3b341',
        icon: Zap,
      },
    ],
  },
  {
    id: 'management',
    title: 'MANAGEMENT',
    items: [
      {
        type: 'admin',
        label: 'Admin Portal',
        zone: 'MGMT',
        desc: 'Privileged operations console',
        color: '#bc8cff',
        icon: Lock,
      },
    ],
  },
  {
    id: 'network',
    title: 'NETWORKS',
    items: [
      {
        type: 'internal_network',
        label: 'Internal Subnet',
        zone: 'INTERNAL',
        desc: 'Isolated VPC private network',
        color: '#58a6ff',
        icon: Network,
      },
      {
        type: 'external_network',
        label: 'External Net',
        zone: 'PUBLIC',
        desc: 'Public routed network boundary',
        color: '#8b949e',
        icon: Share2,
      },
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
      className={`border-r border-[var(--pf-border-default)] bg-[var(--pf-bg-panel)] flex flex-col h-full select-none transition-all duration-200 z-20 font-sans ${
        isCollapsed ? 'w-12' : 'w-60'
      }`}
    >
      {/* Header Bar */}
      <div className="h-10 px-3 border-b border-[var(--pf-border-subtle)] flex items-center justify-between bg-[var(--pf-bg-panel-raised)] shrink-0">
        {!isCollapsed && (
          <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[var(--pf-text-secondary)]">
            <Boxes className="w-3.5 h-3.5 text-[var(--pf-accent)]" />
            <span>Components</span>
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded text-[var(--pf-text-muted)] hover:text-[var(--pf-text-primary)] hover:bg-[var(--pf-bg-panel-hover)] transition-colors ml-auto cursor-pointer"
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
              <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--pf-text-muted)] px-1">
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
                      className="w-8 h-8 rounded border border-[var(--pf-border-subtle)] bg-[var(--pf-bg-panel-raised)] hover:border-[var(--pf-border-focus)] hover:bg-[var(--pf-bg-panel-hover)] flex items-center justify-center transition-all cursor-grab active:cursor-grabbing mx-auto text-[var(--pf-text-muted)] hover:text-[var(--pf-text-primary)]"
                      title={`${item.label} (${item.zone}) — ${item.desc}`}
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
                    className="group flex items-start gap-2.5 p-2 rounded border border-[var(--pf-border-subtle)] bg-[var(--pf-bg-panel-raised)] hover:bg-[var(--pf-bg-panel-hover)] hover:border-[var(--pf-border-strong)] transition-all cursor-grab active:cursor-grabbing shadow-xs"
                    title={`Drag onto canvas or click to add ${item.label}`}
                  >
                    <div
                      className="w-7 h-7 rounded bg-[var(--pf-bg-panel)] border border-[var(--pf-border-default)] flex items-center justify-center shrink-0 mt-0.5"
                      style={{ color: item.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--pf-text-primary)] group-hover:text-[var(--pf-accent)] truncate">
                          {item.label}
                        </span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[var(--pf-bg-app)] text-[var(--pf-text-muted)] border border-[var(--pf-border-subtle)] shrink-0 font-medium">
                          {item.zone}
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--pf-text-muted)] truncate mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Instructions */}
      {!isCollapsed && (
        <div className="p-2.5 border-t border-[var(--pf-border-subtle)] bg-[var(--pf-bg-panel)] text-[10px] text-[var(--pf-text-muted)] space-y-0.5 shrink-0">
          <div className="font-semibold text-[var(--pf-text-secondary)] uppercase tracking-wide">Usage</div>
          <div>• Drag tile onto canvas</div>
          <div>• Drag port to connect nodes</div>
          <div>• Click node or edge to inspect</div>
        </div>
      )}
    </aside>
  );
};
