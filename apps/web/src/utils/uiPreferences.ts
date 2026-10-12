/**
 * PathForge UI Preferences Service
 *
 * Provides a versioned, namespaced, local-first preference store for workbench panel sizing
 * and visibility. Handles storage unavailability, malformed JSON, and bounds validation safely.
 */

export const UI_PREFERENCES_STORAGE_KEY = 'pathforge_ui_prefs_v1';

export const MIN_CONSOLE_HEIGHT = 120;
export const DEFAULT_CONSOLE_HEIGHT = 320;
export const MAX_CONSOLE_HEIGHT = 800;

export interface UiPreferences {
  version: 1;
  consoleHeight: number;
  isConsoleOpen: boolean;
  isInspectorOpen: boolean;
  isPaletteOpen: boolean;
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  version: 1,
  consoleHeight: DEFAULT_CONSOLE_HEIGHT,
  isConsoleOpen: false,
  isInspectorOpen: true, // CRITICAL: Inspector is expanded and visible by default
  isPaletteOpen: true,
};

/**
 * Computes responsive maximum console height targeting ~40–45% of available viewport height
 * on compact displays while respecting the global MAX_CONSOLE_HEIGHT ceiling.
 */
export function getResponsiveMaxConsoleHeight(
  viewportHeight: number = typeof window !== 'undefined' ? window.innerHeight : 900
): number {
  if (!viewportHeight || Number.isNaN(viewportHeight) || viewportHeight <= 0) {
    return MAX_CONSOLE_HEIGHT;
  }
  // Target 45% of viewport height, clamped between MIN_CONSOLE_HEIGHT + 40 (160px) and MAX_CONSOLE_HEIGHT (800px)
  const responsiveCap = Math.round(viewportHeight * 0.45);
  return Math.max(MIN_CONSOLE_HEIGHT + 40, Math.min(MAX_CONSOLE_HEIGHT, responsiveCap));
}

/**
 * Validates and clamps a candidate height within bounds.
 */
export function clampConsoleHeight(
  height: unknown,
  maxAvailableHeight?: number
): number {
  if (typeof height !== 'number' || Number.isNaN(height)) {
    return DEFAULT_CONSOLE_HEIGHT;
  }
  const effectiveMax =
    typeof maxAvailableHeight === 'number' && !Number.isNaN(maxAvailableHeight)
      ? maxAvailableHeight
      : typeof window !== 'undefined'
      ? getResponsiveMaxConsoleHeight(window.innerHeight)
      : MAX_CONSOLE_HEIGHT;
  const max = Math.max(MIN_CONSOLE_HEIGHT + 40, effectiveMax);
  return Math.max(MIN_CONSOLE_HEIGHT, Math.min(max, Math.round(height)));
}

/**
 * Loads UI preferences safely from localStorage.
 * Falls back to default preferences if storage is unavailable, empty, or corrupted.
 */
export function loadUiPreferences(
  storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null
): UiPreferences {
  if (!storage) {
    return { ...DEFAULT_UI_PREFERENCES };
  }

  try {
    const raw = storage.getItem(UI_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_UI_PREFERENCES };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_UI_PREFERENCES };
    }

    const consoleHeight = clampConsoleHeight(parsed.consoleHeight);
    const isConsoleOpen = typeof parsed.isConsoleOpen === 'boolean' ? parsed.isConsoleOpen : DEFAULT_UI_PREFERENCES.isConsoleOpen;
    // CRITICAL: isInspectorOpen must default to true if missing or non-boolean
    const isInspectorOpen = typeof parsed.isInspectorOpen === 'boolean' ? parsed.isInspectorOpen : true;
    const isPaletteOpen = typeof parsed.isPaletteOpen === 'boolean' ? parsed.isPaletteOpen : true;

    return {
      version: 1,
      consoleHeight,
      isConsoleOpen,
      isInspectorOpen,
      isPaletteOpen,
    };
  } catch {
    // Graceful recovery from malformed JSON or Storage access errors
    return { ...DEFAULT_UI_PREFERENCES };
  }
}

/**
 * Saves partial or complete UI preferences safely to localStorage.
 */
export function saveUiPreferences(
  patch: Partial<UiPreferences>,
  storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null
): UiPreferences {
  if (!storage) {
    return { ...DEFAULT_UI_PREFERENCES, ...patch, version: 1 };
  }

  try {
    const current = loadUiPreferences(storage);
    const updated: UiPreferences = {
      version: 1,
      consoleHeight:
        patch.consoleHeight !== undefined
          ? clampConsoleHeight(patch.consoleHeight)
          : current.consoleHeight,
      isConsoleOpen:
        patch.isConsoleOpen !== undefined ? Boolean(patch.isConsoleOpen) : current.isConsoleOpen,
      isInspectorOpen:
        patch.isInspectorOpen !== undefined ? Boolean(patch.isInspectorOpen) : current.isInspectorOpen,
      isPaletteOpen:
        patch.isPaletteOpen !== undefined ? Boolean(patch.isPaletteOpen) : current.isPaletteOpen,
    };

    storage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return { ...DEFAULT_UI_PREFERENCES, ...patch, version: 1 };
  }
}
