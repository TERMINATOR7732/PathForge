import {
  DiffHunk,
  DiffHunkLine,
  FileChangeType,
  IngestionOptions,
  NormalizedFileChange,
} from './types.js';
import {
  generateFileChangeId,
  generateFileSignature,
  maskSensitiveContent,
  normalizeRepositoryPath,
} from './normalizer.js';
import { classifyFile } from './classifier.js';

export interface ParsedDiffResult {
  readonly files: readonly NormalizedFileChange[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly maskedSecretsCount: number;
}

interface RawFileDiffBlock {
  oldPathRaw?: string;
  newPathRaw?: string;
  isNewFile: boolean;
  isDeletedFile: boolean;
  isRenamed: boolean;
  isBinary: boolean;
  hunks: DiffHunk[];
  patchLines: string[];
}

/**
 * Deterministically parses a standard unified diff string.
 *
 * Handles:
 * - Added, modified, deleted, renamed files.
 * - Multi-file and multi-hunk diffs.
 * - Binary file markers.
 * - Secret masking across hunks and patches.
 * - Malformed input with structured errors/warnings (never unhandled exceptions).
 */
export function parseUnifiedDiff(
  rawDiff: string,
  options?: IngestionOptions
): ParsedDiffResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let totalMaskedSecrets = 0;

  if (!rawDiff || typeof rawDiff !== 'string' || rawDiff.trim().length === 0) {
    return {
      files: [],
      warnings: [],
      errors: [],
      maskedSecretsCount: 0,
    };
  }

  // Pre-split lines, standardizing CRLF / LF
  const lines = rawDiff.replace(/\r\n/g, '\n').split('\n');
  const fileBlocks: RawFileDiffBlock[] = [];

  let currentBlock: RawFileDiffBlock | null = null;
  let currentHunk: {
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    header: string;
    lines: DiffHunkLine[];
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect file boundary: 'diff --git '
    if (line.startsWith('diff --git ')) {
      // Finalize previous hunk
      if (currentHunk && currentBlock) {
        currentBlock.hunks.push(currentHunk);
        currentHunk = null;
      }
      // Finalize previous file block
      if (currentBlock) {
        fileBlocks.push(currentBlock);
      }

      currentBlock = {
        isNewFile: false,
        isDeletedFile: false,
        isRenamed: false,
        isBinary: false,
        hunks: [],
        patchLines: [],
      };

      // Try to parse diff --git a/path b/path
      const parts = line.slice('diff --git '.length).trim();
      const match = parts.match(/^(?:a\/)?"?([^"\s]+)"?\s+(?:b\/)?"?([^"\s]+)"?$/);
      if (match) {
        currentBlock.oldPathRaw = match[1];
        currentBlock.newPathRaw = match[2];
      }
      continue;
    }

    // Detect start of simple unified diff without 'diff --git'
    if (!currentBlock && line.startsWith('--- ')) {
      currentBlock = {
        isNewFile: false,
        isDeletedFile: false,
        isRenamed: false,
        isBinary: false,
        hunks: [],
        patchLines: [],
      };
      currentBlock.oldPathRaw = line.slice(4).trim();
      continue;
    }

    if (!currentBlock) {
      // Discard stray content outside of file block
      continue;
    }

    // Metadata lines in diff header
    if (line.startsWith('new file mode ')) {
      currentBlock.isNewFile = true;
      continue;
    }
    if (line.startsWith('deleted file mode ')) {
      currentBlock.isDeletedFile = true;
      continue;
    }
    if (line.startsWith('similarity index ') || line.startsWith('rename from ')) {
      currentBlock.isRenamed = true;
      if (line.startsWith('rename from ')) {
        currentBlock.oldPathRaw = line.slice('rename from '.length).trim();
      }
      continue;
    }
    if (line.startsWith('rename to ')) {
      currentBlock.isRenamed = true;
      currentBlock.newPathRaw = line.slice('rename to '.length).trim();
      continue;
    }
    if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      currentBlock.isBinary = true;
      continue;
    }

    // Old file path marker
    if (line.startsWith('--- ')) {
      currentBlock.oldPathRaw = line.slice(4).trim().split('\t')[0];
      continue;
    }

    // New file path marker
    if (line.startsWith('+++ ')) {
      currentBlock.newPathRaw = line.slice(4).trim().split('\t')[0];
      continue;
    }

    // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    if (line.startsWith('@@ ')) {
      if (currentHunk) {
        currentBlock.hunks.push(currentHunk);
      }

      currentBlock.patchLines.push(line);

      const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (!hunkMatch) {
        warnings.push(`Malformed hunk header encountered at line ${i + 1}: ${line}`);
        currentHunk = {
          oldStart: 1,
          oldCount: 0,
          newStart: 1,
          newCount: 0,
          header: line,
          lines: [],
        };
      } else {
        currentHunk = {
          oldStart: parseInt(hunkMatch[1], 10),
          oldCount: hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1,
          newStart: parseInt(hunkMatch[3], 10),
          newCount: hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1,
          header: line,
          lines: [],
        };
      }
      continue;
    }

    // Within a hunk
    if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'added',
          content: line.slice(1),
        });
        currentBlock.patchLines.push(line);
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'deleted',
          content: line.slice(1),
        });
        currentBlock.patchLines.push(line);
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({
          type: 'context',
          content: line.slice(1),
        });
        currentBlock.patchLines.push(line);
      } else if (line === '') {
        // Trailing empty newline or whitespace between hunks - skip
        continue;
      } else if (line.startsWith('\\ No newline at end of file')) {
        // Standard diff marker, skip
        continue;
      } else {
        // Unknown line inside hunk
        warnings.push(`Unexpected diff line encountered at line ${i + 1}: ${line}`);
      }
    }
  }

  // Push final hunk and block
  if (currentHunk && currentBlock) {
    currentBlock.hunks.push(currentHunk);
  }
  if (currentBlock) {
    fileBlocks.push(currentBlock);
  }

  // Normalize each file block into NormalizedFileChange
  const normalizedFileMap = new Map<string, NormalizedFileChange>();

  for (const block of fileBlocks) {
    // Determine raw paths
    const rawOld = block.oldPathRaw || '';
    const rawNew = block.newPathRaw || '';

    const normOld = normalizeRepositoryPath(rawOld);
    const normNew = normalizeRepositoryPath(rawNew);

    if (normOld.error && !normOld.isDevNull && rawOld) {
      errors.push(normOld.error);
      continue;
    }
    if (normNew.error && !normNew.isDevNull && rawNew) {
      errors.push(normNew.error);
      continue;
    }

    // Determine changeType and target canonical path
    let changeType: FileChangeType = 'MODIFIED';
    let targetPath = normNew.path;
    let oldPath: string | undefined = undefined;
    let newPath: string | undefined = undefined;

    if (block.isNewFile || normOld.isDevNull) {
      changeType = 'ADDED';
      targetPath = normNew.path;
    } else if (block.isDeletedFile || normNew.isDevNull) {
      changeType = 'DELETED';
      targetPath = normOld.path;
    } else if (block.isRenamed || (normOld.path && normNew.path && normOld.path !== normNew.path)) {
      changeType = 'RENAMED';
      targetPath = normNew.path;
      oldPath = normOld.path;
      newPath = normNew.path;
    } else {
      changeType = 'MODIFIED';
      targetPath = normNew.path || normOld.path;
    }

    if (!targetPath || targetPath === '/dev/null') {
      warnings.push(`Could not determine valid canonical path for diff block`);
      continue;
    }

    // Calculate added and deleted line counts
    let linesAdded = 0;
    let linesDeleted = 0;
    for (const hunk of block.hunks) {
      for (const hl of hunk.lines) {
        if (hl.type === 'added') linesAdded++;
        if (hl.type === 'deleted') linesDeleted++;
      }
    }

    // Apply secret masking to hunks and patch if option enabled (default true)
    const shouldMask = options?.maskSecrets !== false;
    let processedPatch = block.patchLines.join('\n');
    let processedHunks = block.hunks;

    if (shouldMask) {
      const maskResult = maskSensitiveContent(processedPatch);
      processedPatch = maskResult.maskedText;
      totalMaskedSecrets += maskResult.secretsCount;

      // Mask each hunk line content
      processedHunks = block.hunks.map((hunk) => ({
        ...hunk,
        lines: hunk.lines.map((l) => {
          const lMask = maskSensitiveContent(l.content);
          return {
            ...l,
            content: lMask.maskedText,
          };
        }),
      }));
    }

    const category = classifyFile(targetPath);
    const id = generateFileChangeId(targetPath, changeType);
    const signature = generateFileSignature(
      targetPath,
      changeType,
      linesAdded,
      linesDeleted,
      processedPatch
    );

    const normalizedChange: NormalizedFileChange = {
      id,
      path: targetPath,
      changeType,
      oldPath,
      newPath,
      linesAdded,
      linesDeleted,
      hunks: Object.freeze(processedHunks),
      patch: processedPatch || undefined,
      signature,
      category,
      isBinary: block.isBinary || undefined,
    };

    if (normalizedFileMap.has(targetPath)) {
      warnings.push(`Duplicate diff entry for file: ${targetPath}; merged with previous entry`);
    }
    normalizedFileMap.set(targetPath, Object.freeze(normalizedChange));
  }

  // Deterministically sort by path
  const sortedFiles = Array.from(normalizedFileMap.values()).sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  return {
    files: Object.freeze(sortedFiles),
    warnings: Object.freeze(warnings),
    errors: Object.freeze(errors),
    maskedSecretsCount: totalMaskedSecrets,
  };
}
