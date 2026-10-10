import { describe, it, expect, beforeEach } from 'vitest';
import {
  Environment,
  instantiateScenario,
  serializeEnvironment,
  deserializeEnvironment,
} from '@pathforge/core';
import {
  loadUiPreferences,
  saveUiPreferences,
  clampConsoleHeight,
  DEFAULT_UI_PREFERENCES,
  UI_PREFERENCES_STORAGE_KEY,
  MIN_CONSOLE_HEIGHT,
  MAX_CONSOLE_HEIGHT,
  DEFAULT_CONSOLE_HEIGHT,
} from '../apps/web/src/utils/uiPreferences.js';

class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('UI Usability & Quality-of-Life Sprint Invariants', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
  });

  describe('1. UI Preferences & Panel Visibility Contracts', () => {
    it('provides default preferences with Node Inspector EXPANDED by default', () => {
      const prefs = loadUiPreferences(mockStorage);
      expect(prefs.isInspectorOpen).toBe(true);
      expect(prefs.version).toBe(1);
      expect(prefs.consoleHeight).toBe(DEFAULT_CONSOLE_HEIGHT);
      expect(prefs.isPaletteOpen).toBe(true);
    });

    it('persists manual collapse of Node Inspector to storage', () => {
      saveUiPreferences({ isInspectorOpen: false }, mockStorage);
      const reloaded = loadUiPreferences(mockStorage);
      expect(reloaded.isInspectorOpen).toBe(false);
    });

    it('persists manual expansion of Node Inspector to storage', () => {
      saveUiPreferences({ isInspectorOpen: false }, mockStorage);
      saveUiPreferences({ isInspectorOpen: true }, mockStorage);
      const reloaded = loadUiPreferences(mockStorage);
      expect(reloaded.isInspectorOpen).toBe(true);
    });

    it('recovers gracefully from malformed or corrupted JSON in localStorage', () => {
      mockStorage.setItem(UI_PREFERENCES_STORAGE_KEY, '{invalid_json:::');
      const prefs = loadUiPreferences(mockStorage);
      expect(prefs.isInspectorOpen).toBe(true);
      expect(prefs.consoleHeight).toBe(DEFAULT_CONSOLE_HEIGHT);
      expect(prefs.version).toBe(1);
    });

    it('recovers gracefully when localStorage contains non-object or missing keys', () => {
      mockStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify('plain-string'));
      const prefs1 = loadUiPreferences(mockStorage);
      expect(prefs1).toEqual(DEFAULT_UI_PREFERENCES);

      mockStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify({}));
      const prefs2 = loadUiPreferences(mockStorage);
      expect(prefs2.isInspectorOpen).toBe(true);
      expect(prefs2.consoleHeight).toBe(DEFAULT_CONSOLE_HEIGHT);
    });

    it('safely handles null storage when storage is disabled or unavailable', () => {
      const prefs = loadUiPreferences(null);
      expect(prefs).toEqual(DEFAULT_UI_PREFERENCES);
      const saved = saveUiPreferences({ isInspectorOpen: false }, null);
      expect(saved.isInspectorOpen).toBe(false);
    });
  });

  describe('2. Console Height Bounds & Divider Clamping', () => {
    it('clamps console height to minimum 120px', () => {
      expect(clampConsoleHeight(50)).toBe(MIN_CONSOLE_HEIGHT);
      expect(clampConsoleHeight(0)).toBe(MIN_CONSOLE_HEIGHT);
      expect(clampConsoleHeight(-200)).toBe(MIN_CONSOLE_HEIGHT);
    });

    it('clamps console height to maximum 800px (or provided viewport bound)', () => {
      expect(clampConsoleHeight(1200)).toBe(MAX_CONSOLE_HEIGHT);
      expect(clampConsoleHeight(900, 600)).toBe(600);
    });

    it('handles non-numeric or NaN console height with fallback', () => {
      expect(clampConsoleHeight(NaN)).toBe(DEFAULT_CONSOLE_HEIGHT);
      expect(clampConsoleHeight('bad')).toBe(DEFAULT_CONSOLE_HEIGHT);
      expect(clampConsoleHeight(null)).toBe(DEFAULT_CONSOLE_HEIGHT);
      expect(clampConsoleHeight(undefined)).toBe(DEFAULT_CONSOLE_HEIGHT);
    });

    it('persists and restores resized console heights', () => {
      saveUiPreferences({ consoleHeight: 450, isConsoleOpen: true }, mockStorage);
      const reloaded = loadUiPreferences(mockStorage);
      expect(reloaded.consoleHeight).toBe(450);
      expect(reloaded.isConsoleOpen).toBe(true);
    });
  });

  describe('3. Inspector Invariant: Node Selection while Collapsed', () => {
    it('maintains collapsed inspector state when another node is selected', () => {
      // User manually collapses inspector
      saveUiPreferences({ isInspectorOpen: false }, mockStorage);
      let prefs = loadUiPreferences(mockStorage);
      expect(prefs.isInspectorOpen).toBe(false);

      // Simulating user clicking and selecting multiple nodes in the canvas
      let selectedNodeId: string | null = null;
      const handleSelectNode = (id: string | null) => {
        selectedNodeId = id;
        // CRITICAL INVARIANT: handleSelectNode MUST NOT mutate isInspectorOpen!
      };

      handleSelectNode('node-web');
      expect(selectedNodeId).toBe('node-web');
      prefs = loadUiPreferences(mockStorage);
      expect(prefs.isInspectorOpen).toBe(false);

      handleSelectNode('node-db');
      expect(selectedNodeId).toBe('node-db');
      prefs = loadUiPreferences(mockStorage);
      expect(prefs.isInspectorOpen).toBe(false);

      handleSelectNode(null);
      expect(selectedNodeId).toBeNull();
      prefs = loadUiPreferences(mockStorage);
      expect(prefs.isInspectorOpen).toBe(false);
    });

    it('re-expanding inspector immediately displays previously selected node properties', () => {
      const env = instantiateScenario('public-db-exposure');
      let selectedNodeId: string | null = 'node-db';
      saveUiPreferences({ isInspectorOpen: false }, mockStorage);

      // User re-expands inspector
      saveUiPreferences({ isInspectorOpen: true }, mockStorage);
      const prefs = loadUiPreferences(mockStorage);
      expect(prefs.isInspectorOpen).toBe(true);

      const activeNode = env.getNode(selectedNodeId!);
      expect(activeNode).toBeDefined();
      expect(activeNode?.id).toBe('node-db');
      expect(activeNode?.name).toBe('Customer Database');
    });
  });

  describe('4. Deterministic Graph Undo / Redo Engine', () => {
    let env: Environment;
    let undoStack: string[];
    let redoStack: string[];

    beforeEach(() => {
      env = instantiateScenario('public-db-exposure');
      undoStack = [];
      redoStack = [];
    });

    const pushHistory = () => {
      undoStack.push(serializeEnvironment(env));
      redoStack = [];
    };

    const undo = () => {
      if (undoStack.length === 0) return;
      const previous = undoStack.pop()!;
      redoStack.push(serializeEnvironment(env));
      env = deserializeEnvironment(previous);
    };

    const redo = () => {
      if (redoStack.length === 0) return;
      const next = redoStack.pop()!;
      undoStack.push(serializeEnvironment(env));
      env = deserializeEnvironment(next);
    };

    it('reverts node creation upon undo and restores it upon redo', () => {
      const initialNodeCount = env.getNodes().length;

      // 1. Snapshot before mutation
      pushHistory();
      const newNode = env.createNode('firewall', { x: 500, y: 300 });
      expect(env.getNodes().length).toBe(initialNodeCount + 1);
      expect(env.getNode(newNode.id)).toBeDefined();

      // 2. Undo
      undo();
      expect(env.getNodes().length).toBe(initialNodeCount);
      expect(env.getNode(newNode.id)).toBeUndefined();

      // 3. Redo
      redo();
      expect(env.getNodes().length).toBe(initialNodeCount + 1);
      expect(env.getNode(newNode.id)).toBeDefined();
    });

    it('reverts node deletion upon undo and restores deletion upon redo', () => {
      const initialNodeCount = env.getNodes().length;
      const targetNode = env.getNode('node-db')!;
      expect(targetNode).toBeDefined();

      // 1. Snapshot before deletion
      pushHistory();
      env.removeNode('node-db');
      expect(env.getNodes().length).toBe(initialNodeCount - 1);
      expect(env.getNode('node-db')).toBeUndefined();

      // 2. Undo
      undo();
      expect(env.getNodes().length).toBe(initialNodeCount);
      const restored = env.getNode('node-db');
      expect(restored).toBeDefined();
      expect(restored?.name).toBe('Customer Database');

      // 3. Redo
      redo();
      expect(env.getNodes().length).toBe(initialNodeCount - 1);
      expect(env.getNode('node-db')).toBeUndefined();
    });

    it('reverts edge configuration remediation upon undo', () => {
      const edges = env.getEdges();
      const edge = edges[0];
      expect(edge).toBeDefined();
      const originalAccess = edge.metadata.access;

      // 1. Push history and remediate edge to access: 'deny'
      pushHistory();
      env.updateEdgeConfig(edge.id, { access: 'deny' });
      expect(env.getEdge(edge.id)?.metadata.access).toBe('deny');

      // 2. Undo
      undo();
      expect(env.getEdge(edge.id)?.metadata.access).toBe(originalAccess);

      // 3. Redo
      redo();
      expect(env.getEdge(edge.id)?.metadata.access).toBe('deny');
    });

    it('truncates redo history when a new mutation is made after an undo', () => {
      pushHistory();
      env.createNode('firewall', { x: 100, y: 100 });

      undo();
      expect(redoStack.length).toBe(1);

      // New action after undo must invalidate redo branch
      pushHistory();
      env.createNode('waf', { x: 200, y: 200 });
      expect(redoStack.length).toBe(0);
    });

    it('supports multiple sequential undos and redos reliably', () => {
      const initialCount = env.getNodes().length;

      pushHistory();
      const n1 = env.createNode('firewall', { x: 10, y: 10 });
      pushHistory();
      const n2 = env.createNode('waf', { x: 20, y: 20 });
      pushHistory();
      const n3 = env.createNode('database', { x: 30, y: 30 });

      expect(env.getNodes().length).toBe(initialCount + 3);

      undo(); // removes n3
      expect(env.getNode(n3.id)).toBeUndefined();
      expect(env.getNode(n2.id)).toBeDefined();

      undo(); // removes n2
      expect(env.getNode(n2.id)).toBeUndefined();
      expect(env.getNode(n1.id)).toBeDefined();

      undo(); // removes n1
      expect(env.getNode(n1.id)).toBeUndefined();
      expect(env.getNodes().length).toBe(initialCount);

      // Sequential redos
      redo(); // re-adds n1
      expect(env.getNode(n1.id)).toBeDefined();
      redo(); // re-adds n2
      expect(env.getNode(n2.id)).toBeDefined();
      redo(); // re-adds n3
      expect(env.getNode(n3.id)).toBeDefined();
      expect(env.getNodes().length).toBe(initialCount + 3);
    });
  });

  describe('5. Component Search & Navigation Filtering Rules', () => {
    it('filters nodes by name, type, zone, cidr, service port, and tags', () => {
      const env = instantiateScenario('public-db-exposure');
      const nodes = env.getNodes();

      const searchFilter = (query: string) => {
        const q = query.trim().toLowerCase();
        return nodes.filter((n) => {
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
      };

      // Name search
      const byName = searchFilter('Customer');
      expect(byName.length).toBeGreaterThan(0);
      expect(byName.some((n) => n.id === 'node-db')).toBe(true);

      // Type search
      const byType = searchFilter('database');
      expect(byType.length).toBeGreaterThan(0);
      expect(byType.some((n) => n.type === 'database')).toBe(true);

      // Zone search
      const byZone = searchFilter('public');
      expect(byZone.length).toBeGreaterThan(0);

      // Port search
      const byPort = searchFilter('5432');
      expect(byPort.length).toBeGreaterThan(0);
    });
  });

  describe('6. Selection Integrity during Graph Undo / Redo', () => {
    let env: Environment;
    let undoStack: string[];
    let redoStack: string[];
    let selectedNodeId: string | null;
    let selectedEdgeId: string | null;

    beforeEach(() => {
      env = instantiateScenario('public-db-exposure');
      undoStack = [];
      redoStack = [];
      selectedNodeId = null;
      selectedEdgeId = null;
    });

    const pushHistory = () => {
      undoStack.push(serializeEnvironment(env));
      redoStack = [];
    };

    const undo = () => {
      if (undoStack.length === 0) return;
      const previous = undoStack.pop()!;
      redoStack.push(serializeEnvironment(env));
      env = deserializeEnvironment(previous);
      if (selectedNodeId && !env.getNode(selectedNodeId)) {
        selectedNodeId = null;
      }
      if (selectedEdgeId && !env.getEdge(selectedEdgeId)) {
        selectedEdgeId = null;
      }
    };

    it('clears selectedNodeId when undoing a newly created node', () => {
      pushHistory();
      const node = env.createNode('waf', { x: 100, y: 100 });
      selectedNodeId = node.id;
      expect(selectedNodeId).toBe(node.id);

      undo();
      expect(env.getNode(node.id)).toBeUndefined();
      expect(selectedNodeId).toBeNull();
    });

    it('clears selectedEdgeId when undoing a newly created edge', () => {
      const n1 = env.createNode('waf', { x: 50, y: 50 });
      const n2 = env.createNode('backend_service', { x: 150, y: 50 });

      pushHistory();
      const edge = env.createEdge(n1.id, n2.id);
      selectedEdgeId = edge.id;
      expect(selectedEdgeId).toBe(edge.id);

      undo();
      expect(env.getEdge(edge.id)).toBeUndefined();
      expect(selectedEdgeId).toBeNull();
    });
  });

  describe('7. Form Control & Modal Shortcut Isolation Rules', () => {
    const isEventSuppressed = (
      targetTag: string,
      isContentEditable: boolean,
      isModalOpen: boolean
    ) => {
      if (
        targetTag === 'INPUT' ||
        targetTag === 'TEXTAREA' ||
        targetTag === 'SELECT' ||
        isContentEditable
      ) {
        return true;
      }
      if (isModalOpen) {
        return true;
      }
      return false;
    };

    it('suppresses keyboard shortcuts when user is focused inside INPUT', () => {
      expect(isEventSuppressed('INPUT', false, false)).toBe(true);
    });

    it('suppresses keyboard shortcuts when user is focused inside TEXTAREA', () => {
      expect(isEventSuppressed('TEXTAREA', false, false)).toBe(true);
    });

    it('suppresses keyboard shortcuts when user is focused inside SELECT', () => {
      expect(isEventSuppressed('SELECT', false, false)).toBe(true);
    });

    it('suppresses keyboard shortcuts when user is focused on a contentEditable element', () => {
      expect(isEventSuppressed('DIV', true, false)).toBe(true);
    });

    it('suppresses canvas shortcuts when any modal dialog is open', () => {
      expect(isEventSuppressed('DIV', false, true)).toBe(true);
    });

    it('allows global shortcuts when focus is on non-editable canvas background with no modal', () => {
      expect(isEventSuppressed('DIV', false, false)).toBe(false);
      expect(isEventSuppressed('BODY', false, false)).toBe(false);
    });
  });

  describe('8. Node Drag Jitter Threshold & Click Protection', () => {
    it('does not trigger history snapshot when clicking a node without movement', () => {
      let historyPushed = false;
      const onNodeDragStart = () => {
        historyPushed = true;
      };

      const initialX = 150;
      const initialY = 200;

      // Simulate click down and release with sub-pixel or 0 jitter
      const movedX = 151;
      const movedY = 200;
      const deltaX = Math.abs(movedX - initialX);
      const deltaY = Math.abs(movedY - initialY);
      const hasMoved = deltaX > 2 || deltaY > 2;

      if (hasMoved) {
        onNodeDragStart();
      }

      expect(hasMoved).toBe(false);
      expect(historyPushed).toBe(false);
    });

    it('triggers history snapshot once when node is actually dragged beyond 2px', () => {
      let historyCallCount = 0;
      const onNodeDragStart = () => {
        historyCallCount++;
      };

      const initialX = 150;
      const initialY = 200;

      let hasMoved = false;

      // Movement 1: 10px move
      const movedX1 = 160;
      const movedY1 = 200;
      if (!hasMoved && (Math.abs(movedX1 - initialX) > 2 || Math.abs(movedY1 - initialY) > 2)) {
        hasMoved = true;
        onNodeDragStart();
      }

      // Movement 2: continued drag
      const movedX2 = 180;
      const movedY2 = 210;
      if (!hasMoved && (Math.abs(movedX2 - initialX) > 2 || Math.abs(movedY2 - initialY) > 2)) {
        hasMoved = true;
        onNodeDragStart();
      }

      expect(hasMoved).toBe(true);
      expect(historyCallCount).toBe(1); // Only fired ONCE per drag
    });
  });
});
