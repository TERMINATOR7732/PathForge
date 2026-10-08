import { GitHubProvider, GitHubPullRequestReference, PullRequestFile } from './types.js';

/**
 * Normalizes and synthesizes a complete unified diff from raw diff text and/or structured PR files.
 *
 * REUSE PRINCIPLE:
 * We generate standard unified diff text so that Phase 3.2's authoritative
 * parser and normalizer can process it with zero duplicated logic.
 */
export function normalizePullRequestPatch(
  rawDiff: string,
  files?: readonly PullRequestFile[]
): string {
  let cleanDiff = (rawDiff || '').replace(/\r\n/g, '\n').trim();

  // If a full diff is already available, check if we need to append synthetic headers for binary files
  if (cleanDiff.length > 0) {
    if (files && files.length > 0) {
      const existingHeaders = new Set<string>();
      const lines = cleanDiff.split('\n');
      for (const line of lines) {
        if (line.startsWith('diff --git a/')) {
          const parts = line.split(' ');
          if (parts[2] && parts[2].startsWith('a/')) {
            existingHeaders.add(parts[2].slice(2));
          }
        }
      }

      const missingBinaryBlocks: string[] = [];
      for (const f of files) {
        if (f.isBinary && !existingHeaders.has(f.filename)) {
          missingBinaryBlocks.push(
            `diff --git a/${f.filename} b/${f.filename}\nBinary files a/${f.filename} and b/${f.filename} differ`
          );
        }
      }

      if (missingBinaryBlocks.length > 0) {
        cleanDiff = `${cleanDiff}\n${missingBinaryBlocks.join('\n')}`;
      }
    }

    return cleanDiff;
  }

  // If raw diff is empty, synthesize from individual file patches
  if (!files || files.length === 0) {
    return '';
  }

  const fileBlocks: string[] = [];

  for (const f of files) {
    const filename = f.filename;
    const prevFilename = f.previousFilename || f.filename;

    if (f.isBinary) {
      fileBlocks.push(
        `diff --git a/${prevFilename} b/${filename}\nBinary files a/${prevFilename} and b/${filename} differ`
      );
      continue;
    }

    if (f.patch && f.patch.trim().length > 0) {
      const patchContent = f.patch.replace(/\r\n/g, '\n').trim();

      if (patchContent.startsWith('diff --git ')) {
        // Patch already contains git diff header
        fileBlocks.push(patchContent);
      } else {
        // Construct canonical git diff header around hunk
        const headerLines: string[] = [`diff --git a/${prevFilename} b/${filename}`];

        if (f.status === 'added') {
          headerLines.push('new file mode 100644');
          headerLines.push('--- /dev/null');
          headerLines.push(`+++ b/${filename}`);
        } else if (f.status === 'deleted') {
          headerLines.push('deleted file mode 100644');
          headerLines.push(`--- a/${prevFilename}`);
          headerLines.push('+++ /dev/null');
        } else if (f.status === 'renamed' && f.previousFilename) {
          headerLines.push(`rename from ${f.previousFilename}`);
          headerLines.push(`rename to ${filename}`);
          headerLines.push(`--- a/${f.previousFilename}`);
          headerLines.push(`+++ b/${filename}`);
        } else {
          headerLines.push(`--- a/${prevFilename}`);
          headerLines.push(`+++ b/${filename}`);
        }

        headerLines.push(patchContent);
        fileBlocks.push(headerLines.join('\n'));
      }
    } else {
      // File has no textual patch (e.g. empty added file or binary)
      const headerLines: string[] = [`diff --git a/${prevFilename} b/${filename}`];
      if (f.status === 'added') {
        headerLines.push('new file mode 100644');
        headerLines.push('--- /dev/null');
        headerLines.push(`+++ b/${filename}`);
      } else if (f.status === 'deleted') {
        headerLines.push('deleted file mode 100644');
        headerLines.push(`--- a/${prevFilename}`);
        headerLines.push('+++ /dev/null');
      } else if (f.status === 'renamed' && f.previousFilename) {
        headerLines.push(`rename from ${f.previousFilename}`);
        headerLines.push(`rename to ${filename}`);
      }
      fileBlocks.push(headerLines.join('\n'));
    }
  }

  return fileBlocks.join('\n');
}

/**
 * Retrieves the raw unified diff for a pull request using the provider.
 */
export async function getPullRequestDiff(
  ref: GitHubPullRequestReference,
  provider: GitHubProvider
): Promise<string> {
  const diff = await provider.getPullRequestDiff(ref);
  return (diff || '').replace(/\r\n/g, '\n').trim();
}
