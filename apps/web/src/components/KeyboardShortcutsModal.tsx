import React, { useEffect, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  title: string;
  items: ShortcutItem[];
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories: ShortcutCategory[] = [
    {
      title: 'Canvas Navigation',
      items: [
        { keys: ['F'], description: 'Fit all nodes into viewport' },
        { keys: ['Z'], description: 'Zoom directly into selected node' },
        { keys: ['0'], description: 'Reset zoom level to 100%' },
        { keys: ['+', '='], description: 'Zoom in' },
        { keys: ['-'], description: 'Zoom out' },
        { keys: ['Space', '+ Drag'], description: 'Pan canvas freely' },
      ],
    },
    {
      title: 'Graph Editing & History',
      items: [
        { keys: ['Ctrl / ⌘', 'Z'], description: 'Undo node / edge mutation' },
        { keys: ['Ctrl / ⌘', 'Y'], description: 'Redo previously undone change' },
        { keys: ['Delete', 'Backspace'], description: 'Delete selected node or edge' },
        { keys: ['Drag Node'], description: 'Reposition infrastructure component' },
        { keys: ['Drag Handle'], description: 'Connect nodes with directed network edge' },
      ],
    },
    {
      title: 'Workbench & Navigation',
      items: [
        { keys: ['Ctrl / ⌘', 'K'], description: 'Search & jump to any node' },
        { keys: ['Alt', 'I'], description: 'Toggle right Node Inspector' },
        { keys: ['Ctrl', '`'], description: 'Toggle bottom Console / Findings' },
        { keys: ['Ctrl', 'O'], description: 'Open Scenario Lab chooser' },
        { keys: ['Escape'], description: 'Clear selection or close dialogs' },
      ],
    },
    {
      title: 'Shortcuts & Investigation',
      items: [
        { keys: ['?'], description: 'Open this keyboard shortcuts cheatsheet' },
        { keys: ['Click Finding'], description: 'Instantly pan canvas to affected resource' },
        { keys: ['Double-click Bar'], description: 'Toggle console expanded / collapsed' },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--pf-bg-panel)] border border-[var(--pf-border-default)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--pf-border-default)] bg-[var(--pf-bg-panel-header)]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-[var(--pf-accent-subtle)] text-[var(--pf-accent)] border border-[var(--pf-border-focus)]">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="shortcuts-modal-title"
                className="text-base font-semibold text-[var(--pf-text-primary)]"
              >
                Keyboard Shortcuts & Navigation
              </h2>
              <p className="text-xs text-[var(--pf-text-muted)] mt-0.5">
                Quick commands to navigate, inspect, and edit topologies efficiently
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--pf-text-muted)] hover:text-[var(--pf-text-primary)] hover:bg-[var(--pf-bg-hover)] rounded-md transition-colors"
            title="Close dialog (Escape)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Grouped 2-column grid */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {categories.map((cat) => (
              <div
                key={cat.title}
                className="bg-[var(--pf-bg-app)] border border-[var(--pf-border-subtle)] rounded-lg p-3.5 space-y-2.5"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--pf-text-secondary)] border-b border-[var(--pf-border-subtle)] pb-1.5">
                  {cat.title}
                </h3>
                <ul className="space-y-2">
                  {cat.items.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between text-xs space-x-2"
                    >
                      <span className="text-[var(--pf-text-secondary)] truncate">
                        {item.description}
                      </span>
                      <div className="flex items-center space-x-1 shrink-0">
                        {item.keys.map((k, kidx) => (
                          <kbd
                            key={kidx}
                            className="px-1.5 py-0.5 text-[11px] font-mono font-medium rounded bg-[var(--pf-bg-panel)] text-[var(--pf-text-primary)] border border-[var(--pf-border-default)] shadow-xs"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[var(--pf-border-default)] bg-[var(--pf-bg-panel-header)] flex justify-between items-center text-xs text-[var(--pf-text-muted)]">
          <span>Press <kbd className="font-mono bg-[var(--pf-bg-app)] px-1 py-0.5 rounded border border-[var(--pf-border-subtle)]">?</kbd> anywhere to toggle this cheat sheet</span>
          <button
            onClick={onClose}
            className="pf-btn pf-btn-secondary px-3 py-1.5 text-xs font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
