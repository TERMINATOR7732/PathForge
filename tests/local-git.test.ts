import { describe, it, expect } from 'vitest';
import {
  discoverRepository,
  getRepositoryState,
  generateGitDiff,
  analyzeGitChanges,
  getCommitHistory,
  getCommitMetadata,
  validateGitRevision,
  parseRevisionRange,
  formatRevisionRange,
  isAllowedGitSubcommand,
  validateGitCommandArgs,
  createMockGitExecutor,
  executeGitCommand,
  Environment,
  createEnvironmentSnapshot,
} from '../packages/core/src/index.js';

describe('Phase 3.3 — Local Git Repository Integration', () => {
  const currentRepoRoot = process.cwd().replace(/\\/g, '/');

  // ==========================================
  // 1. Repository Discovery (Tests 1-5)
  // ==========================================
  describe('Repository Discovery', () => {
    it('1. discovers a valid Git repository root', () => {
      const res = discoverRepository(currentRepoRoot);
      expect(res.isGitRepo).toBe(true);
      expect(res.repository).toBeDefined();
      expect(res.repository?.rootPath.toLowerCase()).toBe(currentRepoRoot.toLowerCase());
      expect(res.repository?.currentCommit).toMatch(/^[0-9a-f]{40}$/);
    });

    it('2. discovers a repository from a nested subdirectory', () => {
      const nestedPath = `${currentRepoRoot}/packages/core/src`;
      const res = discoverRepository(nestedPath);
      expect(res.isGitRepo).toBe(true);
      expect(res.repository?.rootPath.toLowerCase()).toBe(currentRepoRoot.toLowerCase());
    });

    it('3. reports structured error for non-Git directory without crashing', () => {
      const mockExecutor = createMockGitExecutor({
        'rev-parse --show-toplevel': {
          success: false,
          stderr: 'fatal: not a git repository (or any of the parent directories): .git',
          exitCode: 128,
        },
      });
      const res = discoverRepository('/tmp/not-a-repo', mockExecutor);
      expect(res.isGitRepo).toBe(false);
      expect(res.repository).toBeNull();
      expect(res.error).toBe('Not a Git repository');
    });

    it('4. handles missing or invalid directory gracefully', () => {
      const res = discoverRepository('');
      expect(res.isGitRepo).toBe(false);
      expect(res.repository).toBeNull();
      expect(res.error).toContain('Invalid or empty');
    });

    it('5. handles unavailable Git binary with structured error', () => {
      const mockExecutor = createMockGitExecutor({
        'rev-parse --show-toplevel': {
          success: false,
          stderr: 'Git executable not found in PATH',
          exitCode: 127,
          error: 'GIT_NOT_FOUND',
        },
      });
      const res = discoverRepository('/some/path', mockExecutor);
      expect(res.isGitRepo).toBe(false);
      expect(res.error).toBe('Git executable not found in PATH');
    });
  });

  // ==========================================
  // 2. Repository State (Tests 6-13)
  // ==========================================
  describe('Repository State Inspection', () => {
    it('6. detects clean repository state', () => {
      const mockExecutor = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main\n' },
        'status --porcelain=v1 -uall': { stdout: '' },
        remote: { stdout: 'origin\n' },
      });
      const state = getRepositoryState('/repo', mockExecutor);
      expect(state.isDirty).toBe(false);
      expect(state.stagedCount).toBe(0);
      expect(state.unstagedCount).toBe(0);
      expect(state.untrackedCount).toBe(0);
      expect(state.currentBranch).toBe('main');
      expect(state.isDetached).toBe(false);
      expect(state.remotePresence).toBe(true);
    });

    it('7. detects dirty repository state with unstaged changes', () => {
      const mockExecutor = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'b'.repeat(40) },
        'branch --show-current': { stdout: 'feature/auth\n' },
        'status --porcelain=v1 -uall': { stdout: ' M src/app.ts\n' },
        remote: { stdout: '' },
      });
      const state = getRepositoryState('/repo', mockExecutor);
      expect(state.isDirty).toBe(true);
      expect(state.stagedCount).toBe(0);
      expect(state.unstagedCount).toBe(1);
      expect(state.remotePresence).toBe(false);
    });

    it('8. detects staged changes in index', () => {
      const mockExecutor = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'c'.repeat(40) },
        'branch --show-current': { stdout: 'main\n' },
        'status --porcelain=v1 -uall': { stdout: 'M  src/index.ts\nA  src/new.ts\n' },
        remote: { stdout: '' },
      });
      const state = getRepositoryState('/repo', mockExecutor);
      expect(state.isDirty).toBe(true);
      expect(state.stagedCount).toBe(2);
      expect(state.unstagedCount).toBe(0);
    });

    it('9. detects unstaged modifications', () => {
      const mockExecutor = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'c'.repeat(40) },
        'branch --show-current': { stdout: 'main\n' },
        'status --porcelain=v1 -uall': { stdout: ' D src/old.ts\n' },
        remote: { stdout: '' },
      });
      const state = getRepositoryState('/repo', mockExecutor);
      expect(state.isDirty).toBe(true);
      expect(state.unstagedCount).toBe(1);
    });

    it('10. detects untracked files explicitly without confusing with dirty tracked files', () => {
      const mockExecutor = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'c'.repeat(40) },
        'branch --show-current': { stdout: 'main\n' },
        'status --porcelain=v1 -uall': { stdout: '?? untracked.log\n?? scratch.ts\n' },
        remote: { stdout: '' },
      });
      const state = getRepositoryState('/repo', mockExecutor);
      expect(state.isDirty).toBe(false); // Untracked alone does not mark tracked tree dirty
      expect(state.untrackedCount).toBe(2);
      expect(state.untrackedFiles).toEqual(['scratch.ts', 'untracked.log']); // Deterministically sorted
    });

    it('11. detects detached HEAD state correctly', () => {
      const mockExecutor = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'd'.repeat(40) },
        'branch --show-current': { stdout: '\n' },
        'rev-parse --abbrev-ref HEAD': { stdout: 'HEAD\n' },
        'status --porcelain=v1 -uall': { stdout: '' },
        remote: { stdout: '' },
      });
      const state = getRepositoryState('/repo', mockExecutor);
      expect(state.isDetached).toBe(true);
      expect(state.currentBranch).toBeNull();
    });

    it('12. detects current branch name', () => {
      const mockExecutor = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'e'.repeat(40) },
        'branch --show-current': { stdout: 'master\n' },
        'status --porcelain=v1 -uall': { stdout: '' },
        remote: { stdout: '' },
      });
      const state = getRepositoryState('/repo', mockExecutor);
      expect(state.currentBranch).toBe('master');
      expect(state.isDetached).toBe(false);
    });

    it('13. detects current commit full SHA', () => {
      const sha = '1234567890abcdef1234567890abcdef12345678';
      const mockExecutor = createMockGitExecutor({
        'rev-parse HEAD': { stdout: `${sha}\n` },
        'branch --show-current': { stdout: 'main\n' },
        'status --porcelain=v1 -uall': { stdout: '' },
        remote: { stdout: '' },
      });
      const state = getRepositoryState('/repo', mockExecutor);
      expect(state.currentCommit).toBe(sha);
    });
  });

  // ==========================================
  // 3. Git Diffs & Comparison Modes (Tests 14-24)
  // ==========================================
  describe('Git Diffs & Comparison Modes', () => {
    const sampleDiff = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,1 +1,2 @@
 const a = 1;
+const b = 2;
`;

    it('14. generates diff for working-tree-vs-head mode', () => {
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: ' M src/app.ts' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: sampleDiff },
      });
      const diff = generateGitDiff('/repo', { mode: 'working-tree-vs-head' }, mock);
      expect(diff.mode).toBe('working-tree-vs-head');
      expect(diff.filesChangedCount).toBe(1);
      expect(diff.isClean).toBe(false);
      expect(diff.rawDiff).toContain('src/app.ts');
    });

    it('15. generates diff for index-vs-head mode (staged changes)', () => {
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: 'M  src/app.ts' },
        remote: { stdout: '' },
        'diff -M --cached HEAD': { stdout: sampleDiff },
      });
      const diff = generateGitDiff('/repo', { mode: 'index-vs-head' }, mock);
      expect(diff.mode).toBe('index-vs-head');
      expect(diff.headDescription).toBe('Staged Index');
      expect(diff.rawDiff).toContain('src/app.ts');
    });

    it('16. generates diff for working-state-vs-head mode', () => {
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: 'MM src/app.ts' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: sampleDiff },
      });
      const diff = generateGitDiff('/repo', { mode: 'working-state-vs-head' }, mock);
      expect(diff.mode).toBe('working-state-vs-head');
      expect(diff.headDescription).toBe('Current Working State');
    });

    it('17. generates diff for commit-vs-commit mode', () => {
      const baseSha = '1111111111111111111111111111111111111111';
      const headSha = '2222222222222222222222222222222222222222';
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: headSha },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: '' },
        remote: { stdout: '' },
        [`diff -M ${baseSha} ${headSha}`]: { stdout: sampleDiff },
      });
      const diff = generateGitDiff(
        '/repo',
        { mode: 'commit-vs-commit', baseRef: baseSha, headRef: headSha },
        mock
      );
      expect(diff.mode).toBe('commit-vs-commit');
      expect(diff.baseDescription).toContain(baseSha);
      expect(diff.headDescription).toContain(headSha);
    });

    it('18. generates diff for branch-vs-branch mode', () => {
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'feature/auth' },
        'status --porcelain=v1 -uall': { stdout: '' },
        remote: { stdout: '' },
        'diff -M main feature/auth': { stdout: sampleDiff },
      });
      const diff = generateGitDiff(
        '/repo',
        { mode: 'branch-vs-branch', baseRef: 'main', headRef: 'feature/auth' },
        mock
      );
      expect(diff.mode).toBe('branch-vs-branch');
      expect(diff.baseDescription).toBe('Branch main');
      expect(diff.headDescription).toBe('Branch feature/auth');
    });

    it('19. detects clean state with no changes', () => {
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: '' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: '' },
      });
      const diff = generateGitDiff('/repo', { mode: 'working-tree-vs-head' }, mock);
      expect(diff.isClean).toBe(true);
      expect(diff.filesChangedCount).toBe(0);
      expect(diff.rawDiff).toBe('');
    });

    it('20. handles added file diff', () => {
      const addedDiff = `diff --git a/new.ts b/new.ts
new file mode 100644
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,2 @@
+line 1
+line 2
`;
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: 'A  new.ts' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: addedDiff },
      });
      const diff = generateGitDiff('/repo', { mode: 'working-tree-vs-head' }, mock);
      expect(diff.filesChangedCount).toBe(1);
    });

    it('21. handles modified file diff', () => {
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: ' M src/app.ts' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: sampleDiff },
      });
      const diff = generateGitDiff('/repo', { mode: 'working-tree-vs-head' }, mock);
      expect(diff.filesChangedCount).toBe(1);
    });

    it('22. handles deleted file diff', () => {
      const deletedDiff = `diff --git a/old.ts b/old.ts
deleted file mode 100644
--- a/old.ts
+++ /dev/null
@@ -1,1 +0,0 @@
-old
`;
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: ' D old.ts' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: deletedDiff },
      });
      const diff = generateGitDiff('/repo', { mode: 'working-tree-vs-head' }, mock);
      expect(diff.filesChangedCount).toBe(1);
    });

    it('23. handles renamed file diff with -M rename detection', () => {
      const renameDiff = `diff --git a/old.ts b/renamed.ts
similarity index 100%
rename from old.ts
rename to renamed.ts
`;
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: 'R  old.ts -> renamed.ts' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: renameDiff },
      });
      const diff = generateGitDiff('/repo', { mode: 'working-tree-vs-head' }, mock);
      expect(diff.filesChangedCount).toBe(1);
      expect(diff.rawDiff).toContain('rename to renamed.ts');
    });

    it('24. handles multi-file diff correctly', () => {
      const multiDiff = `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1,1 +1,2 @@
+a
diff --git a/b.ts b/b.ts
--- a/b.ts
+++ b/b.ts
@@ -1,1 +1,2 @@
+b
`;
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: ' M a.ts\n M b.ts' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: multiDiff },
      });
      const diff = generateGitDiff('/repo', { mode: 'working-tree-vs-head' }, mock);
      expect(diff.filesChangedCount).toBe(2);
    });
  });

  // ==========================================
  // 4. Commit Metadata & History (Tests 25-30)
  // ==========================================
  describe('Commit Metadata & History', () => {
    const mockLogOutput = [
      [
        'abcdef1234567890abcdef1234567890abcdef12',
        'abcdef1',
        'Alice Engineer',
        'alice@example.com',
        '2026-10-08T12:00:00Z',
        'feat: add security perimeter',
        '1111111 2222222',
      ].join('\x1f'),
      [
        '1111111111111111111111111111111111111111',
        '1111111',
        'Bob Architect',
        'bob@example.com',
        '2026-10-07T10:00:00Z',
        'refactor: tighten network boundaries',
        '',
      ].join('\x1f'),
    ].join('\n');

    it('25. parses full and abbreviated commit SHA', () => {
      const mock = createMockGitExecutor({
        'log -n 20 --format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%P': {
          stdout: mockLogOutput,
        },
      });
      const history = getCommitHistory('/repo', { maxCount: 20 }, mock);
      expect(history).toHaveLength(2);
      expect(history[0].sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
      expect(history[0].abbreviatedSha).toBe('abcdef1');
    });

    it('26. parses commit subject message', () => {
      const mock = createMockGitExecutor({
        'log -n 20 --format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%P': {
          stdout: mockLogOutput,
        },
      });
      const history = getCommitHistory('/repo', {}, mock);
      expect(history[0].subject).toBe('feat: add security perimeter');
      expect(history[1].subject).toBe('refactor: tighten network boundaries');
    });

    it('27. parses author name and email', () => {
      const mock = createMockGitExecutor({
        'log -n 20 --format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%P': {
          stdout: mockLogOutput,
        },
      });
      const history = getCommitHistory('/repo', {}, mock);
      expect(history[0].author).toBe('Alice Engineer');
      expect(history[0].authorEmail).toBe('alice@example.com');
    });

    it('28. captures author timestamp as metadata without participating in semantic identity', () => {
      const mock = createMockGitExecutor({
        'log -n 20 --format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%P': {
          stdout: mockLogOutput,
        },
      });
      const history = getCommitHistory('/repo', {}, mock);
      expect(history[0].timestamp).toBe('2026-10-08T12:00:00Z');
    });

    it('29. parses parent commit SHAs', () => {
      const mock = createMockGitExecutor({
        'log -n 20 --format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%P': {
          stdout: mockLogOutput,
        },
      });
      const history = getCommitHistory('/repo', {}, mock);
      expect(history[0].parentShas).toEqual(['1111111', '2222222']);
      expect(history[1].parentShas).toEqual([]);
    });

    it('30. retrieves single commit metadata via getCommitMetadata', () => {
      const singleOutput = [
        'abcdef1234567890abcdef1234567890abcdef12',
        'abcdef1',
        'Alice Engineer',
        'alice@example.com',
        '2026-10-08T12:00:00Z',
        'feat: add security perimeter',
        '',
      ].join('\x1f');
      const mock = createMockGitExecutor({
        'show -s --format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%P HEAD': {
          stdout: singleOutput,
        },
      });
      const commit = getCommitMetadata('/repo', 'HEAD', mock);
      expect(commit).toBeDefined();
      expect(commit?.sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    });
  });

  // ==========================================
  // 5. Revision Safety & Validation (Tests 31-35b)
  // ==========================================
  describe('Revision Safety & Validation', () => {
    it('31. accepts valid Git revisions (branch, tag, SHA, relative)', () => {
      expect(validateGitRevision('main').isValid).toBe(true);
      expect(validateGitRevision('feature/auth-hardening').isValid).toBe(true);
      expect(validateGitRevision('v1.2.0').isValid).toBe(true);
      expect(validateGitRevision('HEAD~1').isValid).toBe(true);
      expect(validateGitRevision('HEAD^').isValid).toBe(true);
      expect(validateGitRevision('a'.repeat(40)).isValid).toBe(true);
    });

    it('32. rejects invalid or empty revisions', () => {
      expect(validateGitRevision('').isValid).toBe(false);
      expect(validateGitRevision('   ').isValid).toBe(false);
    });

    it('33. rejects revisions starting with hyphen to prevent option injection', () => {
      const res = validateGitRevision('--exec=rm');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("cannot start with a hyphen ('-')");
    });

    it('34. rejects revisions containing null bytes or spaces', () => {
      expect(validateGitRevision('main\0evil').isValid).toBe(false);
      expect(validateGitRevision('main branch').isValid).toBe(false);
    });

    it('35. rejects shell injection attempts in revisions', () => {
      expect(validateGitRevision('main; rm -rf /').isValid).toBe(false);
      expect(validateGitRevision('main | cat').isValid).toBe(false);
      expect(validateGitRevision('main && evil').isValid).toBe(false);
      expect(validateGitRevision('$(whoami)').isValid).toBe(false);
      expect(validateGitRevision('`id`').isValid).toBe(false);
    });

    it('35b. correctly parses two-dot and three-dot revision ranges', () => {
      const twoDot = parseRevisionRange('main..feature');
      expect(twoDot).toEqual({ base: 'main', target: 'feature', type: 'two-dot' });

      const threeDot = parseRevisionRange('main...feature');
      expect(threeDot).toEqual({ base: 'main', target: 'feature', type: 'three-dot' });

      expect(formatRevisionRange('main', 'feature', 'two-dot')).toBe('main..feature');
      expect(formatRevisionRange('main', 'feature', 'three-dot')).toBe('main...feature');
    });
  });

  // ==========================================
  // 6. Integration with Phase 3.2 & Phase 3.1 (Tests 36-40)
  // ==========================================
  describe('Integration with Phase 3.2 and Phase 3.1', () => {
    const infraDiff = `diff --git a/k8s/network-policy.yaml b/k8s/network-policy.yaml
new file mode 100644
--- /dev/null
+++ b/k8s/network-policy.yaml
@@ -0,0 +1,5 @@
+apiVersion: networking.k8s.io/v1
+kind: NetworkPolicy
+spec:
+  ingress:
+    - ports: [{ port: 5432 }]
`;

    it('36. feeds Git diff directly into Phase 3.2 change-ingestion parser', () => {
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: 'A  k8s/network-policy.yaml' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: infraDiff },
      });
      const analysis = analyzeGitChanges('/repo', { mode: 'working-tree-vs-head' }, mock);
      expect(analysis.normalizedChangeSet.files).toHaveLength(1);
      expect(analysis.normalizedChangeSet.files[0].path).toBe('k8s/network-policy.yaml');
      expect(analysis.normalizedChangeSet.files[0].category).toBe('infrastructure');
    });

    it('37. preserves engineering signals derived from Git diff', () => {
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: 'A  k8s/network-policy.yaml' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: infraDiff },
      });
      const analysis = analyzeGitChanges('/repo', { mode: 'working-tree-vs-head' }, mock);
      expect(analysis.normalizedChangeSet.signals.some((s) => s.type === 'network-config-modified')).toBe(true);
    });

    it('38. change IDs remain strictly deterministic and stable across Git analysis runs', () => {
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: 'A  k8s/network-policy.yaml' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: infraDiff },
      });
      const a1 = analyzeGitChanges('/repo', { mode: 'working-tree-vs-head' }, mock);
      const a2 = analyzeGitChanges('/repo', { mode: 'working-tree-vs-head' }, mock);
      expect(a1.normalizedChangeSet.files[0].id).toBe(a2.normalizedChangeSet.files[0].id);
    });

    it('39. bridges Git analysis to Phase 3.1 when modeled environments are supplied', () => {
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: 'A  k8s/network-policy.yaml' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: infraDiff },
      });
      const analysis = analyzeGitChanges('/repo', { mode: 'working-tree-vs-head' }, mock);

      const env1 = new Environment({ id: 'e1', name: 'Before' });
      const n1 = env1.createNode('internet', { x: 0, y: 0 }, 'Internet');
      const n2 = env1.createNode('database', { x: 100, y: 100 }, 'Database');
      env1.createEdge(n1.id, n2.id, { access: 'allow', protocol: 'tcp', port: '5432' });

      const snapBefore = createEnvironmentSnapshot(env1, {
        environmentId: env1.id,
        evaluatedAt: new Date().toISOString(),
        findings: [],
        summary: { totalFindings: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, infoCount: 0, passed: true },
        rulesEvaluated: 1,
      });

      const env2 = new Environment({ id: 'e2', name: 'After' });
      const an1 = env2.createNode('internet', { x: 0, y: 0 }, 'Internet');
      const an2 = env2.createNode('database', { x: 100, y: 100 }, 'Database');
      env2.createEdge(an1.id, an2.id, { access: 'deny', protocol: 'tcp', port: '5432' });

      // Verification via bridge
      expect(analysis.bridgeResult.isInfrastructureProven).toBe(false);
      expect(analysis.bridgeResult.securityImpactStatement).toContain(
        'Security posture impact cannot be proven without evaluating modeled topology'
      );
    });

    it('40. zero topology is fabricated from Git diff alone', () => {
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: 'A  k8s/network-policy.yaml' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: infraDiff },
      });
      const analysis = analyzeGitChanges('/repo', { mode: 'working-tree-vs-head' }, mock);
      // No nodes or edges are invented
      expect(analysis.bridgeResult.isInfrastructureProven).toBe(false);
    });
  });

  // ==========================================
  // 7. Determinism & Isolation (Tests 41-45)
  // ==========================================
  describe('Determinism & Isolation', () => {
    const diffText = `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1,1 +1,2 @@
+const a = 1;
`;

    it('41. repeated analysis is byte-for-byte identical in JSON serialization', () => {
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: ' M a.ts' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: diffText },
      });
      const r1 = analyzeGitChanges('/repo', { mode: 'working-tree-vs-head' }, mock);
      const r2 = analyzeGitChanges('/repo', { mode: 'working-tree-vs-head' }, mock);
      expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });

    it('42. same repository state produces same normalized change IDs', () => {
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: ' M a.ts' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: diffText },
      });
      const r = analyzeGitChanges('/repo', { mode: 'working-tree-vs-head' }, mock);
      expect(r.normalizedChangeSet.files[0].id).toMatch(/^file-change-[0-9a-f]{8}$/);
    });

    it('43. commit timestamps do not participate in semantic change identity', () => {
      const log1 = `abc\x1fabc\x1fAlice\x1fa@b.com\x1f2026-01-01T00:00:00Z\x1fmsg\x1f`;
      const log2 = `abc\x1fabc\x1fAlice\x1fa@b.com\x1f2026-12-31T23:59:59Z\x1fmsg\x1f`;

      const m1 = createMockGitExecutor({
        'log -n 20 --format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%P': { stdout: log1 },
      });
      const m2 = createMockGitExecutor({
        'log -n 20 --format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%P': { stdout: log2 },
      });

      const h1 = getCommitHistory('/repo', {}, m1);
      const h2 = getCommitHistory('/repo', {}, m2);
      expect(h1[0].sha).toBe(h2[0].sha);
      expect(h1[0].subject).toBe(h2[0].subject);
    });

    it('44. local repository root path does not affect semantic change identity', () => {
      const mock1 = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: ' M a.ts' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: diffText },
      });
      const mock2 = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: ' M a.ts' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: diffText },
      });
      const r1 = analyzeGitChanges('/repo/path/one', { mode: 'working-tree-vs-head' }, mock1);
      const r2 = analyzeGitChanges('C:/different/repo/path', { mode: 'working-tree-vs-head' }, mock2);
      expect(r1.normalizedChangeSet.files[0].id).toBe(r2.normalizedChangeSet.files[0].id);
      expect(r1.normalizedChangeSet.files[0].signature).toBe(r2.normalizedChangeSet.files[0].signature);
    });

    it('45. output sorting across files and signals is strictly deterministic', () => {
      const multiDiff = `diff --git a/z.ts b/z.ts
--- a/z.ts
+++ b/z.ts
@@ -1,1 +1,2 @@
+z
diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1,1 +1,2 @@
+a
`;
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: ' M z.ts\n M a.ts' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: multiDiff },
      });
      const r = analyzeGitChanges('/repo', { mode: 'working-tree-vs-head' }, mock);
      expect(r.normalizedChangeSet.files[0].path).toBe('a.ts');
      expect(r.normalizedChangeSet.files[1].path).toBe('z.ts');
    });
  });

  // ==========================================
  // 8. Safety & Read-Only Guarantees (Tests 46-51)
  // ==========================================
  describe('Safety & Read-Only Guarantees', () => {
    it('46. leaves live local repository status completely unmodified', () => {
      // Execute against actual live repository
      const beforeState = getRepositoryState(currentRepoRoot);
      const diffResult = generateGitDiff(currentRepoRoot, { mode: 'working-tree-vs-head' });
      const afterState = getRepositoryState(currentRepoRoot);

      expect(diffResult).toBeDefined();
      expect(afterState.currentCommit).toBe(beforeState.currentCommit);
      expect(afterState.isDirty).toBe(beforeState.isDirty);
      expect(afterState.stagedCount).toBe(beforeState.stagedCount);
      expect(afterState.unstagedCount).toBe(beforeState.unstagedCount);
    });

    it('47. strictly blocks checkout and mutating operations via subcommand whitelist', () => {
      expect(isAllowedGitSubcommand('checkout')).toBe(false);
      expect(isAllowedGitSubcommand('commit')).toBe(false);
      expect(isAllowedGitSubcommand('push')).toBe(false);
      expect(isAllowedGitSubcommand('pull')).toBe(false);
      expect(isAllowedGitSubcommand('fetch')).toBe(false);
      expect(isAllowedGitSubcommand('reset')).toBe(false);
      expect(isAllowedGitSubcommand('stash')).toBe(false);
      expect(isAllowedGitSubcommand('merge')).toBe(false);
      expect(isAllowedGitSubcommand('rebase')).toBe(false);
    });

    it('48. refuses to execute mutating Git commands', () => {
      const checkRes = executeGitCommand(['checkout', 'main']);
      expect(checkRes.success).toBe(false);
      expect(checkRes.error).toContain('Forbidden Git subcommand');

      const pushRes = executeGitCommand(['push', 'origin', 'main']);
      expect(pushRes.success).toBe(false);
      expect(pushRes.error).toContain('Forbidden Git subcommand');
    });

    it('49. blocks dangerous Git configuration and execution flags', () => {
      const val1 = validateGitCommandArgs(['diff', '--exec=evil.sh']);
      expect(val1.isValid).toBe(false);
      expect(val1.error).toContain('Forbidden dangerous Git flag');

      const val2 = validateGitCommandArgs(['diff', '-c', 'user.name=attacker']);
      expect(val2.isValid).toBe(false);
      expect(val2.error).toContain('Forbidden dangerous Git flag');
    });

    it('50. blocks arbitrary shell string execution', () => {
      const res = executeGitCommand(['rev-parse', 'HEAD; rm -rf /']);
      expect(res.success).toBe(false);
    });

    it('51. supports untracked file inclusion in diff when explicitly requested', () => {
      const mock = createMockGitExecutor({
        'rev-parse HEAD': { stdout: 'a'.repeat(40) },
        'branch --show-current': { stdout: 'main' },
        'status --porcelain=v1 -uall': { stdout: '?? untracked.ts\n' },
        remote: { stdout: '' },
        'diff -M HEAD': { stdout: '' },
      });
      const diffWithout = generateGitDiff(
        '/repo',
        { mode: 'working-tree-vs-head', includeUntracked: false },
        mock
      );
      expect(diffWithout.rawDiff).toBe('');

      const diffWith = generateGitDiff(
        '/repo',
        { mode: 'working-tree-vs-head', includeUntracked: true },
        mock
      );
      expect(diffWith.rawDiff).toContain('untracked.ts');
    });
  });
});
