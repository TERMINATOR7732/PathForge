import React, { useState, useEffect, useRef } from 'react';
import { Environment } from '@pathforge/core';
import { Search, X, Server, ArrowRight } from 'lucide-react';

interface SearchNodesModalProps {
  isOpen: boolean;
  environment: Environment;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}

export const SearchNodesModal: React.FC<SearchNodesModalProps> = ({
  isOpen,
  environment,
  onClose,
  onSelectNode,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  const nodes = environment.getNodes();
  const q = query.trim().toLowerCase();

  const filteredNodes = nodes.filter((n) => {
    if (!q) return true;
    const nameMatch = n.name.toLowerCase().includes(q);
    const typeMatch = n.type.toLowerCase().includes(q);
    const zoneMatch = (n.metadata.zone ?? '').toLowerCase().includes(q);
    const cidrMatch = (n.metadata.cidr ?? '').toLowerCase().includes(q);
    const tagsMatch = (n.metadata.tags ?? []).some((t) => t.toLowerCase().includes(q));
    const portMatch = n.metadata.service?.port
      ? String(n.metadata.service.port).includes(q)
      : false;
    return nameMatch || typeMatch || zoneMatch || cidrMatch || tagsMatch || portMatch;
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredNodes.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredNodes.length) % Math.max(1, filteredNodes.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredNodes[selectedIndex];
      if (target) {
        onSelectNode(target.id);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl mx-4 bg-[#11151c] border border-[#212631] rounded-lg shadow-2xl overflow-hidden flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-3.5 py-3 border-b border-[#212631] bg-[#161b24] gap-2.5">
          <Search className="w-4 h-4 text-[#58a6ff] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search components by name, type, zone, CIDR, port, or tag... (Esc to close)"
            className="flex-1 bg-transparent text-[#f0f3f6] placeholder-[#8b949e] text-sm outline-none border-none p-0 focus:ring-0"
            aria-label="Search infrastructure components"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded text-[#8b949e] hover:text-white"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredNodes.length === 0 ? (
            <div className="py-8 text-center text-[#8b949e] text-xs">
              No components match &quot;{query}&quot;
            </div>
          ) : (
            filteredNodes.map((n, idx) => {
              const isSelected = idx === selectedIndex;
              const zone = (n.metadata.zone ?? 'internal').toUpperCase();
              const port = n.metadata.service?.port;

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    onSelectNode(n.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2 rounded-md flex items-center justify-between cursor-pointer transition-colors text-xs ${
                    isSelected
                      ? 'bg-[#1f6feb]/20 border border-[#388bfd]/60 text-[#f0f3f6]'
                      : 'hover:bg-[#161b24] text-[#c9d1d9] border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Server className="w-4 h-4 text-[#58a6ff] shrink-0" />
                    <div className="truncate">
                      <div className="font-semibold text-sm text-[#f0f3f6] truncate">
                        {n.name}
                      </div>
                      <div className="text-2xs text-[#8b949e] flex items-center space-x-2 mt-0.5">
                        <span className="capitalize">{n.type.replace('_', ' ')}</span>
                        {n.metadata.cidr && <span>· {n.metadata.cidr}</span>}
                        {port && <span>· Port {port}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="px-1.5 py-0.5 rounded bg-[#0b0e14] border border-[#212631] text-[10px] font-mono font-semibold text-[#8b949e]">
                      {zone}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#58a6ff] opacity-70" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-3.5 py-2 border-t border-[#212631] bg-[#161b24] text-2xs text-[#8b949e] flex items-center justify-between">
          <span>{filteredNodes.length} components found</span>
          <span>Use ↑ ↓ to navigate · Enter to select · Esc to close</span>
        </div>
      </div>
    </div>
  );
};
