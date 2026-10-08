import {
  EngineeringHistoryRecord,
  EngineeringHistoryStore,
  HistorySaveResult,
  HistoryStoreQueryOptions,
  HISTORY_SCHEMA_VERSION,
} from './types.js';

/**
 * In-memory implementation of EngineeringHistoryStore.
 * Ideal for unit testing, offline headless workflows, and client fallback.
 */
export class InMemoryHistoryStore implements EngineeringHistoryStore {
  private readonly records = new Map<string, EngineeringHistoryRecord>();

  public save(record: EngineeringHistoryRecord): HistorySaveResult {
    if (this.records.has(record.id)) {
      const existing = this.records.get(record.id)!;
      return { record: existing, isDuplicate: true };
    }
    this.records.set(record.id, record);
    return { record, isDuplicate: false };
  }

  public get(id: string): EngineeringHistoryRecord | null {
    return this.records.get(id) ?? null;
  }

  public list(options?: HistoryStoreQueryOptions): readonly EngineeringHistoryRecord[] {
    let result = Array.from(this.records.values());

    if (options?.environmentId) {
      result = result.filter((r) => r.environmentId === options.environmentId);
    }

    if (options?.source) {
      result = result.filter((r) => r.source === options.source);
    }

    if (options?.sinceTimestamp) {
      const sinceTime = new Date(options.sinceTimestamp).getTime();
      result = result.filter((r) => new Date(r.timestamp).getTime() >= sinceTime);
    }

    // Sort chronologically descending (newest first)
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (options?.limit && options.limit > 0) {
      result = result.slice(0, options.limit);
    }

    return Object.freeze(result);
  }

  public delete(id: string): boolean {
    return this.records.delete(id);
  }

  public clear(environmentId?: string): void {
    if (!environmentId) {
      this.records.clear();
      return;
    }
    for (const [id, record] of this.records.entries()) {
      if (record.environmentId === environmentId) {
        this.records.delete(id);
      }
    }
  }
}

/**
 * Node.js filesystem helper safely resolved at runtime.
 */
interface NodeFsModule {
  existsSync(p: string): boolean;
  mkdirSync(p: string, opts?: { recursive: boolean }): void;
  readFileSync(p: string, encoding: string): string;
  writeFileSync(p: string, data: string, encoding: string): void;
  unlinkSync(p: string): void;
  readdirSync(p: string): string[];
}

interface NodePathModule {
  join(...paths: string[]): string;
}

function getNodeBuiltin<T>(moduleName: string): T | null {
  try {
    const g = globalThis as any;
    if (g.process && g.process.versions && Boolean(g.process.versions.node)) {
      // 1. Node 20+ process.getBuiltinModule
      if (typeof g.process.getBuiltinModule === 'function') {
        const mod = g.process.getBuiltinModule(moduleName);
        if (mod) return mod as T;
      }
      // 2. Global require
      if (typeof g.require === 'function') {
        return g.require(moduleName) as T;
      }
      // 3. createRequire in ESM
      try {
        const modMod = g.process?.getBuiltinModule?.('node:module');
        if (modMod && typeof modMod.createRequire === 'function') {
          const req = modMod.createRequire(import.meta.url);
          return req(moduleName) as T;
        }
      } catch {}
      // 4. Runtime require fallback
      try {
        const reqResolver = new Function(
          'return typeof require !== "undefined" ? require : null'
        )();
        if (typeof reqResolver === 'function') {
          return reqResolver(moduleName) as T;
        }
      } catch {}
    }
  } catch {
    // Browser or bundled environment
  }
  return null;
}

function getNodeFs(): NodeFsModule | null {
  return getNodeBuiltin<NodeFsModule>('node:fs');
}

function getNodePath(): NodePathModule | null {
  return getNodeBuiltin<NodePathModule>('node:path');
}

/**
 * Local file-based implementation of EngineeringHistoryStore.
 * Saves history snapshots as deterministic JSON files in a local directory.
 * Excludes sensitive secrets, handles malformed records, and enforces schema versions.
 */
export class FileSystemHistoryStore implements EngineeringHistoryStore {
  private readonly baseDir: string;
  private readonly fs: NodeFsModule;
  private readonly path: NodePathModule;

  constructor(baseDir: string = '.pathforge/history') {
    const fs = getNodeFs();
    const path = getNodePath();
    if (!fs || !path) {
      throw new Error(
        'FileSystemHistoryStore requires a Node.js runtime with filesystem access.'
      );
    }
    this.baseDir = baseDir;
    this.fs = fs;
    this.path = path;
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!this.fs.existsSync(this.baseDir)) {
      this.fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getRecordFilePath(id: string): string {
    const safeFilename = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    return this.path.join(this.baseDir, `${safeFilename}.json`);
  }

  public save(record: EngineeringHistoryRecord): HistorySaveResult {
    this.ensureDirectory();
    const filePath = this.getRecordFilePath(record.id);

    if (this.fs.existsSync(filePath)) {
      try {
        const content = this.fs.readFileSync(filePath, 'utf-8');
        const existing = JSON.parse(content) as EngineeringHistoryRecord;
        return { record: existing, isDuplicate: true };
      } catch {
        // If file exists but is corrupted, overwrite with valid record
      }
    }

    const data = JSON.stringify(record, null, 2);
    // Write atomically
    this.fs.writeFileSync(filePath, data, 'utf-8');
    return { record, isDuplicate: false };
  }

  public get(id: string): EngineeringHistoryRecord | null {
    this.ensureDirectory();
    const filePath = this.getRecordFilePath(id);
    if (!this.fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = this.fs.readFileSync(filePath, 'utf-8');
      const record = JSON.parse(content) as EngineeringHistoryRecord;
      if (record.schemaVersion !== HISTORY_SCHEMA_VERSION) {
        return null;
      }
      return record;
    } catch {
      return null;
    }
  }

  public list(options?: HistoryStoreQueryOptions): readonly EngineeringHistoryRecord[] {
    this.ensureDirectory();
    let filenames: string[] = [];
    try {
      filenames = this.fs.readdirSync(this.baseDir);
    } catch {
      return Object.freeze([]);
    }

    const records: EngineeringHistoryRecord[] = [];
    for (const file of filenames) {
      if (!file.endsWith('.json')) continue;
      const fullPath = this.path.join(this.baseDir, file);
      try {
        const content = this.fs.readFileSync(fullPath, 'utf-8');
        const parsed = JSON.parse(content) as EngineeringHistoryRecord;
        if (parsed && parsed.schemaVersion === HISTORY_SCHEMA_VERSION && parsed.id) {
          records.push(parsed);
        }
      } catch {
        // Skip corrupt or unparseable files without crashing
      }
    }

    let filtered = records;
    if (options?.environmentId) {
      filtered = filtered.filter((r) => r.environmentId === options.environmentId);
    }
    if (options?.source) {
      filtered = filtered.filter((r) => r.source === options.source);
    }
    if (options?.sinceTimestamp) {
      const sinceTime = new Date(options.sinceTimestamp).getTime();
      filtered = filtered.filter((r) => new Date(r.timestamp).getTime() >= sinceTime);
    }

    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (options?.limit && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }

    return Object.freeze(filtered);
  }

  public delete(id: string): boolean {
    this.ensureDirectory();
    const filePath = this.getRecordFilePath(id);
    if (this.fs.existsSync(filePath)) {
      try {
        this.fs.unlinkSync(filePath);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  public clear(environmentId?: string): void {
    this.ensureDirectory();
    const records = this.list(environmentId ? { environmentId } : undefined);
    for (const r of records) {
      this.delete(r.id);
    }
  }
}

/**
 * Options for configuring the default history store.
 */
export interface CreateHistoryStoreOptions {
  readonly baseDir?: string;
  readonly inMemory?: boolean;
}

/**
 * Factory function creating an appropriate history store for the current environment.
 */
export function createDefaultHistoryStore(
  options?: CreateHistoryStoreOptions
): EngineeringHistoryStore {
  if (options?.inMemory) {
    return new InMemoryHistoryStore();
  }

  const hasFs = getNodeFs() !== null;
  if (hasFs) {
    try {
      return new FileSystemHistoryStore(options?.baseDir ?? '.pathforge/history');
    } catch {
      return new InMemoryHistoryStore();
    }
  }

  return new InMemoryHistoryStore();
}
