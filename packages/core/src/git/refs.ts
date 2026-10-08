/**
 * Pure deterministic validation and parsing of Git revisions and ref ranges.
 *
 * SAFETY MANDATE:
 * Prevents flag injection (e.g. arguments starting with '-'), shell metacharacters,
 * directory escape, and malformed revisions before passing to git CLI.
 */

export interface RevisionValidationResult {
  readonly isValid: boolean;
  readonly sanitizedRef?: string;
  readonly error?: string;
}

export interface ParsedRevisionRange {
  readonly base: string;
  readonly target: string;
  readonly type: 'two-dot' | 'three-dot';
}

/**
 * Validates a single Git revision (branch, tag, SHA, HEAD reference).
 */
export function validateGitRevision(rawRef: string): RevisionValidationResult {
  if (!rawRef || typeof rawRef !== 'string') {
    return { isValid: false, error: 'Revision must be a non-empty string' };
  }

  const trimmed = rawRef.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: 'Revision cannot be empty' };
  }

  // Prevent flag injection: Git CLI interprets leading '-' as option flags
  if (trimmed.startsWith('-')) {
    return {
      isValid: false,
      error: `Revision cannot start with a hyphen ('-'): '${trimmed}'`,
    };
  }

  // Check for dangerous shell and escape characters
  // Disallowed: ; & | $ ` < > \ " ' * ? [ ] ( ) { } space \r \n \t \0
  const unsafeCharsPattern = /[;&|\$`<>"'\s\\*?\[\](){}\r\n\t\0]/;
  if (unsafeCharsPattern.test(trimmed)) {
    return {
      isValid: false,
      error: `Revision contains invalid or unsafe characters: '${trimmed}'`,
    };
  }

  // Check for invalid Git ref sequences
  if (trimmed.includes('..')) {
    return {
      isValid: false,
      error: `Revision cannot contain '..' sequence (use parseRevisionRange for ranges): '${trimmed}'`,
    };
  }

  if (trimmed.startsWith('/') || trimmed.endsWith('/')) {
    return {
      isValid: false,
      error: `Revision cannot start or end with slash: '${trimmed}'`,
    };
  }

  if (trimmed.endsWith('.lock')) {
    return {
      isValid: false,
      error: `Revision cannot end with '.lock': '${trimmed}'`,
    };
  }

  if (trimmed.includes('@{')) {
    // Check if reflog syntax is safe: e.g. HEAD@{1}
    if (!/^[a-zA-Z0-9_./~^+-]+@\{\d+\}$/.test(trimmed)) {
      return {
        isValid: false,
        error: `Invalid reflog syntax in revision: '${trimmed}'`,
      };
    }
  }

  // Match valid Git ref characters: alphanumeric, _, ., -, /, @, ~, ^, +
  const validPattern = /^[a-zA-Z0-9_./@~^+-]+$/;
  if (!validPattern.test(trimmed)) {
    return {
      isValid: false,
      error: `Revision contains unsupported characters: '${trimmed}'`,
    };
  }

  return { isValid: true, sanitizedRef: trimmed };
}

/**
 * Parses a commit range string into base and target revisions.
 *
 * Supports:
 * - 'base..target' (two-dot): standard diff between base and target
 * - 'base...target' (three-dot): diff from merge-base of base and target to target
 */
export function parseRevisionRange(range: string): ParsedRevisionRange | null {
  if (!range || typeof range !== 'string') {
    return null;
  }

  const trimmed = range.trim();

  if (trimmed.includes('...')) {
    const parts = trimmed.split('...');
    if (parts.length !== 2) return null;
    const baseVal = validateGitRevision(parts[0]);
    const targetVal = validateGitRevision(parts[1]);
    if (!baseVal.isValid || !targetVal.isValid || !baseVal.sanitizedRef || !targetVal.sanitizedRef) {
      return null;
    }
    return {
      base: baseVal.sanitizedRef,
      target: targetVal.sanitizedRef,
      type: 'three-dot',
    };
  }

  if (trimmed.includes('..')) {
    const parts = trimmed.split('..');
    if (parts.length !== 2) return null;
    const baseVal = validateGitRevision(parts[0]);
    const targetVal = validateGitRevision(parts[1]);
    if (!baseVal.isValid || !targetVal.isValid || !baseVal.sanitizedRef || !targetVal.sanitizedRef) {
      return null;
    }
    return {
      base: baseVal.sanitizedRef,
      target: targetVal.sanitizedRef,
      type: 'two-dot',
    };
  }

  return null;
}

/**
 * Formats a revision range deterministically.
 */
export function formatRevisionRange(
  base: string,
  target: string,
  type: 'two-dot' | 'three-dot' = 'two-dot'
): string {
  const separator = type === 'three-dot' ? '...' : '..';
  return `${base}${separator}${target}`;
}
