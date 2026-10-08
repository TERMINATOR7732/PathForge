declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string;
  export function existsSync(path: string): boolean;
}

declare module 'node:path' {
  export function isAbsolute(p: string): boolean;
  export function resolve(...paths: string[]): string;
  export function basename(p: string): string;
}

declare namespace NodeJS {
  interface Process {
    argv: string[];
    cwd(): string;
    exit(code?: number): never;
  }
}

declare const process: NodeJS.Process;
