import { FileChangeType } from './types.js';

/**
 * FNV-1a 32-bit deterministic string hash.
 * Produces an 8-character hex string without random numbers, timestamps, or machine identifiers.
 */
export function deterministicStringHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Result of path normalization.
 */
export interface PathNormalizationResult {
  readonly path: string;
  readonly isDevNull: boolean;
  readonly error?: string;
}

/**
 * Normalizes a raw file path into a canonical repository-relative path.
 *
 * Rules:
 * - Strips bounding quotes.
 * - Converts all backslashes to forward slashes.
 * - Strips leading git diff prefixes 'a/' and 'b/'.
 * - Strips leading './'.
 * - Collapses duplicate slashes ('//').
 * - Preserves special '/dev/null' marker.
 * - Strictly rejects absolute filesystem paths and root traversals ('../').
 */
export function normalizeRepositoryPath(rawPath: string): PathNormalizationResult {
  if (!rawPath || typeof rawPath !== 'string') {
    return { path: '', isDevNull: false, error: 'Empty or invalid file path' };
  }

  // Strip bounding quotes
  let p = rawPath.trim();
  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
    p = p.slice(1, -1);
  }

  // Convert backslashes
  p = p.replace(/\\/g, '/');

  // Detect special /dev/null indicator
  if (p === '/dev/null' || p === 'dev/null') {
    return { path: '/dev/null', isDevNull: true };
  }

  // Check for absolute Windows drive paths (e.g. C:/foo)
  if (/^[a-zA-Z]:[/\\]/.test(p) || /^[a-zA-Z]:$/.test(p)) {
    return {
      path: '',
      isDevNull: false,
      error: `Absolute filesystem paths are rejected from canonical repository model: ${rawPath}`,
    };
  }

  // Check for URL schemes (e.g. file://, http://)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(p)) {
    return {
      path: '',
      isDevNull: false,
      error: `URI schemes are rejected from canonical repository model: ${rawPath}`,
    };
  }

  // Strip leading git 'a/' or 'b/' prefix
  if (p.startsWith('a/') || p.startsWith('b/')) {
    p = p.slice(2);
  }

  // Strip leading './'
  while (p.startsWith('./')) {
    p = p.slice(2);
  }

  // Collapse duplicate slashes
  p = p.replace(/\/+/g, '/');

  // Check for root-level absolute Unix paths (e.g. /etc/passwd or /var/log)
  if (p.startsWith('/')) {
    return {
      path: '',
      isDevNull: false,
      error: `Absolute root paths are rejected from canonical repository model: ${rawPath}`,
    };
  }

  // Check for directory traversal escaping root
  if (p === '..' || p.startsWith('../') || p.includes('/../')) {
    return {
      path: '',
      isDevNull: false,
      error: `Directory traversal sequences ('..') are rejected: ${rawPath}`,
    };
  }

  // Strip trailing slash
  if (p.endsWith('/')) {
    p = p.slice(0, -1);
  }

  if (!p) {
    return { path: '', isDevNull: false, error: 'Normalized path resulted in empty string' };
  }

  return { path: p, isDevNull: false };
}

/**
 * Result of secret masking.
 */
export interface SecretMaskingResult {
  readonly maskedText: string;
  readonly secretsCount: number;
}

/**
 * Deterministically masks credentials, private keys, API keys, and sensitive tokens.
 * Values are replaced with fixed placeholder tags (e.g. [REDACTED_SECRET]).
 */
export function maskSensitiveContent(text: string): SecretMaskingResult {
  if (!text) {
    return { maskedText: '', secretsCount: 0 };
  }

  let secretsCount = 0;
  let masked = text;

  // 1. PEM Private Keys
  const privateKeyPattern = /-----BEGIN[ A-Z_-]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z_-]*PRIVATE KEY-----/g;
  masked = masked.replace(privateKeyPattern, () => {
    secretsCount++;
    return '[REDACTED_PRIVATE_KEY]';
  });

  // 2. AWS Access Key IDs
  const awsKeyPattern = /\b(AKIA[0-9A-Z]{16})\b/g;
  masked = masked.replace(awsKeyPattern, () => {
    secretsCount++;
    return '[REDACTED_AWS_KEY]';
  });

  // 3. GitHub Tokens (ghp_, gho_, ghu_, ghs_, ghr_)
  const githubTokenPattern = /\b(gh[pousr]_[a-zA-Z0-9]{36,255})\b/g;
  masked = masked.replace(githubTokenPattern, () => {
    secretsCount++;
    return '[REDACTED_GITHUB_TOKEN]';
  });

  // 4. Generic API Keys / Tokens (e.g. sk-...)
  const apiKeyPattern = /\b(sk-[a-zA-Z0-9]{20,})\b/g;
  masked = masked.replace(apiKeyPattern, () => {
    secretsCount++;
    return '[REDACTED_API_KEY]';
  });

  // 5. JWT tokens
  const jwtPattern = /\b(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g;
  masked = masked.replace(jwtPattern, () => {
    secretsCount++;
    return '[REDACTED_JWT_TOKEN]';
  });

  // 6. Common credential assignments: password = "...", api_key: "..."
  const assignmentPattern =
    /\b(password|passwd|secret|api[_-]?key|auth[_-]?token|bearer[_-]?token|access[_-]?token|client[_-]?secret)\s*([:=])\s*(['"]?)([^'"\s,;\r\n]{6,})\3/gi;
  masked = masked.replace(assignmentPattern, (_match, key, sep, quote, val) => {
    if (val.startsWith('[REDACTED_')) {
      return `${key}${sep}${quote}${val}${quote}`;
    }
    secretsCount++;
    return `${key}${sep}${quote}[REDACTED_SECRET]${quote}`;
  });

  return { maskedText: masked, secretsCount };
}

/**
 * Deterministically generates a stable identity for a normalized file change.
 */
export function generateFileChangeId(path: string, changeType: FileChangeType): string {
  const hash = deterministicStringHash(`${path}:${changeType}`);
  return `file-change-${hash}`;
}

/**
 * Deterministically generates a canonical signature for a file change.
 */
export function generateFileSignature(
  path: string,
  changeType: FileChangeType,
  linesAdded: number,
  linesDeleted: number,
  hunksContent: string
): string {
  const contentHash = deterministicStringHash(hunksContent);
  return `sig-${deterministicStringHash(`${path}:${changeType}:${linesAdded}:${linesDeleted}:${contentHash}`)}`;
}

/**
 * Deterministically generates a stable identity for an engineering signal.
 */
export function generateSignalId(file: string, signalType: string): string {
  const hash = deterministicStringHash(`${file}:${signalType}`);
  return `signal-${hash}`;
}
