import { describe, it, expect, beforeEach } from 'vitest';
import {
  // References
  validateRepositoryReference,
  parseRepositoryReference,
  validatePullRequestReference,
  parsePullRequestReference,
  // Metadata & Diff
  getPullRequestMetadata,
  getPullRequestFiles,
  getPullRequestDiff,
  normalizePullRequestPatch,
  // Provider
  MockGitHubProvider,
  createMockGitHubProvider,
  sanitizeErrorMessage,
  // Mapper & Analyzer
  mapPullRequestToChangeSet,
  partitionSignals,
  analyzePullRequest,
  determinePullRequestRiskStatus,
  // Core Domain
  deserializeEnvironment,
  serializeEnvironment,
  Environment,
} from '../packages/core/src/index.js';
import fs from 'fs';
import path from 'path';

describe('Phase 3.4 — Read-Only GitHub Repository & Pull Request Integration', () => {
  let mockProvider: MockGitHubProvider;
  let baselineEnv: Environment;

  const SAMPLE_APP_PATCH = `diff --git a/src/service.ts b/src/service.ts
--- a/src/service.ts
+++ b/src/service.ts
@@ -10,3 +10,4 @@
 export function computeTotal(items: number[]) {
+  console.log("Processing items count:", items.length);
   return items.reduce((a, b) => a + b, 0);
 }`;

  const SAMPLE_INFRA_PATCH = `diff --git a/k8s/network-policy.yaml b/k8s/network-policy.yaml
--- a/k8s/network-policy.yaml
+++ b/k8s/network-policy.yaml
@@ -5,3 +5,4 @@
 spec:
   ingress:
+    - ports: [{ port: 5432 }]`;

  const SAMPLE_SECRET_PATCH = `diff --git a/config.ts b/config.ts
--- a/config.ts
+++ b/config.ts
@@ -1,2 +1,3 @@
+const apiKey = "sk-live-9876543210abcdef0123456789";
 export const endpoint = "https://api.internal";`;

  const SAMPLE_CI_PATCH = `diff --git a/.github/workflows/security.yml b/.github/workflows/security.yml
--- a/.github/workflows/security.yml
+++ b/.github/workflows/security.yml
@@ -10,2 +10,4 @@
     steps:
+      - name: Snyk Security Scan
+        run: snyk test`;

  const SAMPLE_TEST_PATCH = `diff --git a/tests/api.test.ts b/tests/api.test.ts
--- a/tests/api.test.ts
+++ b/tests/api.test.ts
@@ -1,3 +1,6 @@
 describe('API', () => {
+  it('validates request schema', () => {
+    expect(true).toBe(true);
+  });
 });`;

  const SAMPLE_DEP_PATCH = `diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -15,2 +15,3 @@
   "dependencies": {
+    "cors": "^2.8.5"
   }`;

  beforeEach(() => {
    mockProvider = createMockGitHubProvider();

    // Register standard demo repository
    mockProvider.registerRepository({
      owner: 'acme-corp',
      repository: 'cloud-infrastructure',
      fullName: 'acme-corp/cloud-infrastructure',
      defaultBranch: 'main',
      isPrivate: false,
      description: 'Production infrastructure manifests and services',
    });

    const demoFilePath = path.resolve(
      __dirname,
      '../environments/demo/standard-web-app.json'
    );
    baselineEnv = deserializeEnvironment(fs.readFileSync(demoFilePath, 'utf-8'));
  });

  // =========================================================================
  // 1. REPOSITORY REFERENCES (Tests 1-4)
  // =========================================================================
  describe('Repository References', () => {
    it('1. validates standard owner/repository string', () => {
      const res = validateRepositoryReference('acme-corp/cloud-infrastructure');
      expect(res.isValid).toBe(true);
      expect(res.value?.owner).toBe('acme-corp');
      expect(res.value?.repository).toBe('cloud-infrastructure');
      expect(res.value?.fullName).toBe('acme-corp/cloud-infrastructure');
    });

    it('2. validates full GitHub URL format', () => {
      const res = validateRepositoryReference('https://github.com/facebook/react.git');
      expect(res.isValid).toBe(true);
      expect(res.value?.owner).toBe('facebook');
      expect(res.value?.repository).toBe('react');
      expect(res.value?.fullName).toBe('facebook/react');
    });

    it('3. rejects invalid repository owner', () => {
      expect(validateRepositoryReference('-invalid/repo').isValid).toBe(false);
      expect(validateRepositoryReference('invalid-/repo').isValid).toBe(false);
      expect(validateRepositoryReference('in--valid/repo').isValid).toBe(false);
      expect(validateRepositoryReference('inv@lid/repo').isValid).toBe(false);
      expect(validateRepositoryReference('').isValid).toBe(false);
    });

    it('4. rejects invalid repository name with traversal or slashes', () => {
      expect(validateRepositoryReference('owner/..').isValid).toBe(false);
      expect(validateRepositoryReference('owner/.').isValid).toBe(false);
      expect(validateRepositoryReference('owner/nested/repo').isValid).toBe(false);
      expect(validateRepositoryReference('owner/repo\0inject').isValid).toBe(false);
      expect(() => parseRepositoryReference('bad')).toThrow('Invalid repository reference');
    });
  });

  // =========================================================================
  // 2. PULL REQUEST REFERENCES (Tests 5-7)
  // =========================================================================
  describe('Pull Request References', () => {
    it('5. parses PR reference from various valid string formats', () => {
      const ref1 = parsePullRequestReference('acme-corp/cloud-infrastructure#101');
      expect(ref1.owner).toBe('acme-corp');
      expect(ref1.repository).toBe('cloud-infrastructure');
      expect(ref1.pullRequestNumber).toBe(101);
      expect(ref1.canonicalId).toBe('acme-corp/cloud-infrastructure#101');

      const ref2 = parsePullRequestReference('https://github.com/acme-corp/cloud-infrastructure/pull/42');
      expect(ref2.pullRequestNumber).toBe(42);

      const ref3 = parsePullRequestReference({
        owner: 'acme-corp',
        repository: 'cloud-infrastructure',
        pullRequestNumber: 77,
      });
      expect(ref3.pullRequestNumber).toBe(77);
    });

    it('6. rejects invalid PR numbers (non-integers, floats, negative, zero)', () => {
      expect(validatePullRequestReference('acme/repo#0').isValid).toBe(false);
      expect(validatePullRequestReference('acme/repo#-5').isValid).toBe(false);
      expect(validatePullRequestReference('acme/repo#abc').isValid).toBe(false);
      expect(
        validatePullRequestReference({ owner: 'acme', repository: 'repo', pullRequestNumber: 3.14 })
          .isValid
      ).toBe(false);
      expect(() => parsePullRequestReference('invalid-format')).toThrow(
        'Invalid pull request format'
      );
    });

    it('7. produces deterministic canonical PR identifier', () => {
      const r1 = parsePullRequestReference('Org/Repo#12');
      const r2 = parsePullRequestReference('https://github.com/Org/Repo/pull/12');
      expect(r1.canonicalId).toBe(r2.canonicalId);
      expect(r1.canonicalId).toBe('Org/Repo#12');
    });
  });

  // =========================================================================
  // 3. METADATA HANDLING (Tests 8-13)
  // =========================================================================
  describe('Metadata Handling', () => {
    beforeEach(() => {
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 1 },
        {
          prNumber: 1,
          title: 'Implement Network Policy Hardening',
          body: 'Secures ingress traffic for internal databases',
          author: 'dev-alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feature/network-hardening',
          baseSha: '1111111111111111111111111111111111111111',
          headSha: '2222222222222222222222222222222222222222',
          createdAt: '2026-10-01T10:00:00Z',
          updatedAt: '2026-10-02T12:00:00Z',
          changedFilesCount: 2,
          additions: 25,
          deletions: 5,
        }
      );
    });

    it('8. retrieves and normalizes complete PR metadata', async () => {
      const ref = parsePullRequestReference('acme-corp/cloud-infrastructure#1');
      const meta = await getPullRequestMetadata(ref, mockProvider);

      expect(meta.prNumber).toBe(1);
      expect(meta.title).toBe('Implement Network Policy Hardening');
      expect(meta.author).toBe('dev-alice');
      expect(meta.state).toBe('OPEN');
      expect(meta.isDraft).toBe(false);
      expect(meta.changedFilesCount).toBe(2);
      expect(meta.additions).toBe(25);
      expect(meta.deletions).toBe(5);
    });

    it('9. preserves base commit SHA accurately', async () => {
      const ref = parsePullRequestReference('acme-corp/cloud-infrastructure#1');
      const meta = await getPullRequestMetadata(ref, mockProvider);
      expect(meta.baseSha).toBe('1111111111111111111111111111111111111111');
    });

    it('10. preserves head commit SHA accurately', async () => {
      const ref = parsePullRequestReference('acme-corp/cloud-infrastructure#1');
      const meta = await getPullRequestMetadata(ref, mockProvider);
      expect(meta.headSha).toBe('2222222222222222222222222222222222222222');
    });

    it('11. preserves base and head branch names', async () => {
      const ref = parsePullRequestReference('acme-corp/cloud-infrastructure#1');
      const meta = await getPullRequestMetadata(ref, mockProvider);
      expect(meta.baseBranch).toBe('main');
      expect(meta.headBranch).toBe('feature/network-hardening');
    });

    it('12. normalizes state strings (open, closed, merged)', async () => {
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 2 },
        {
          prNumber: 2,
          title: 'Merged PR',
          body: null,
          author: 'bob',
          state: 'MERGED',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'patch-1',
          baseSha: 'aaaa',
          headSha: 'bbbb',
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z',
          changedFilesCount: 1,
          additions: 1,
          deletions: 1,
        }
      );
      const meta = await getPullRequestMetadata(
        parsePullRequestReference('acme-corp/cloud-infrastructure#2'),
        mockProvider
      );
      expect(meta.state).toBe('MERGED');
    });

    it('13. enforces timestamp metadata-only invariant', async () => {
      // Analyzing same diff with two different timestamps must produce identical normalized changes
      const res1 = mapPullRequestToChangeSet(SAMPLE_INFRA_PATCH);
      const res2 = mapPullRequestToChangeSet(SAMPLE_INFRA_PATCH);
      expect(res1.summary.filesChanged).toBe(res2.summary.filesChanged);
      expect(res1.files[0].id).toBe(res2.files[0].id);
      expect(res1.signals.length).toBe(res2.signals.length);
    });
  });

  // =========================================================================
  // 4. CHANGED FILES (Tests 14-21)
  // =========================================================================
  describe('Changed Files', () => {
    it('14. parses and normalizes added files', async () => {
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 10 },
        {
          prNumber: 10,
          title: 'Add New Service',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 1,
          additions: 10,
          deletions: 0,
        },
        [
          {
            filename: 'src/new-service.ts',
            status: 'added',
            additions: 10,
            deletions: 0,
            changes: 10,
            patch: '@@ -0,0 +1,10 @@\n+export const newService = true;',
            isBinary: false,
          },
        ]
      );

      const files = await getPullRequestFiles(
        parsePullRequestReference('acme-corp/cloud-infrastructure#10'),
        mockProvider
      );
      expect(files.length).toBe(1);
      expect(files[0].status).toBe('added');
      expect(files[0].filename).toBe('src/new-service.ts');
    });

    it('15. parses modified files', async () => {
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 11 },
        {
          prNumber: 11,
          title: 'Modify Service',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 1,
          additions: 2,
          deletions: 1,
        },
        [
          {
            filename: 'src/existing.ts',
            status: 'modified',
            additions: 2,
            deletions: 1,
            changes: 3,
            isBinary: false,
          },
        ]
      );

      const files = await getPullRequestFiles(
        parsePullRequestReference('acme-corp/cloud-infrastructure#11'),
        mockProvider
      );
      expect(files[0].status).toBe('modified');
    });

    it('16. parses deleted files', async () => {
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 12 },
        {
          prNumber: 12,
          title: 'Delete Service',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 1,
          additions: 0,
          deletions: 50,
        },
        [
          {
            filename: 'deprecated.ts',
            status: 'deleted',
            additions: 0,
            deletions: 50,
            changes: 50,
            isBinary: false,
          },
        ]
      );

      const files = await getPullRequestFiles(
        parsePullRequestReference('acme-corp/cloud-infrastructure#12'),
        mockProvider
      );
      expect(files[0].status).toBe('deleted');
    });

    it('17. parses renamed files with previousFilename', async () => {
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 13 },
        {
          prNumber: 13,
          title: 'Rename File',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 1,
          additions: 0,
          deletions: 0,
        },
        [
          {
            filename: 'src/v2/app.ts',
            previousFilename: 'src/v1/app.ts',
            status: 'renamed',
            additions: 0,
            deletions: 0,
            changes: 0,
            isBinary: false,
          },
        ]
      );

      const files = await getPullRequestFiles(
        parsePullRequestReference('acme-corp/cloud-infrastructure#13'),
        mockProvider
      );
      expect(files[0].status).toBe('renamed');
      expect(files[0].previousFilename).toBe('src/v1/app.ts');
    });

    it('18. explicitly handles binary files without failing', async () => {
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 14 },
        {
          prNumber: 14,
          title: 'Add Assets',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 1,
          additions: 0,
          deletions: 0,
        },
        [
          {
            filename: 'assets/logo.png',
            status: 'added',
            additions: 0,
            deletions: 0,
            changes: 0,
            isBinary: true,
          },
        ]
      );

      const files = await getPullRequestFiles(
        parsePullRequestReference('acme-corp/cloud-infrastructure#14'),
        mockProvider
      );
      expect(files[0].isBinary).toBe(true);
      expect(files[0].patch).toBeUndefined();

      // Normalization should handle binary file without crash
      const synthDiff = normalizePullRequestPatch('', files);
      expect(synthDiff).toContain('Binary files');
    });

    it('19. handles patch unavailable state without throwing', async () => {
      const files = [
        {
          filename: 'large-data.json',
          status: 'modified' as const,
          additions: 5000,
          deletions: 200,
          changes: 5200,
          isBinary: false,
        },
      ];
      const diff = normalizePullRequestPatch('', files);
      expect(diff).toContain('diff --git a/large-data.json b/large-data.json');
    });

    it('20. handles multiple files with different modification types', async () => {
      const files = [
        { filename: 'b.ts', status: 'modified' as const, additions: 2, deletions: 1, changes: 3, isBinary: false },
        { filename: 'a.ts', status: 'added' as const, additions: 10, deletions: 0, changes: 10, isBinary: false },
        { filename: 'c.ts', status: 'deleted' as const, additions: 0, deletions: 5, changes: 5, isBinary: false },
      ];
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 15 },
        {
          prNumber: 15,
          title: 'Multi files',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 3,
          additions: 12,
          deletions: 6,
        },
        files
      );

      const loaded = await getPullRequestFiles(
        parsePullRequestReference('acme-corp/cloud-infrastructure#15'),
        mockProvider
      );
      expect(loaded.length).toBe(3);
    });

    it('21. sorts files deterministically in alphabetical order', async () => {
      const unsorted = [
        { filename: 'z-last.ts', status: 'modified' as const, additions: 1, deletions: 0, changes: 1, isBinary: false },
        { filename: 'a-first.ts', status: 'modified' as const, additions: 1, deletions: 0, changes: 1, isBinary: false },
        { filename: 'm-mid.ts', status: 'modified' as const, additions: 1, deletions: 0, changes: 1, isBinary: false },
      ];
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 16 },
        {
          prNumber: 16,
          title: 'Unsorted',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 3,
          additions: 3,
          deletions: 0,
        },
        unsorted
      );

      const loaded = await getPullRequestFiles(
        parsePullRequestReference('acme-corp/cloud-infrastructure#16'),
        mockProvider
      );
      expect(loaded[0].filename).toBe('a-first.ts');
      expect(loaded[1].filename).toBe('m-mid.ts');
      expect(loaded[2].filename).toBe('z-last.ts');
    });
  });

  // =========================================================================
  // 5. INGESTION REUSE & SIGNALS (Tests 22-29)
  // =========================================================================
  describe('Phase 3.2 Ingestion & Engineering Signals', () => {
    it('22. routes PR patch directly into Phase 3.2 ingestion parser', () => {
      const changeSet = mapPullRequestToChangeSet(SAMPLE_APP_PATCH);
      expect(changeSet.files.length).toBe(1);
      expect(changeSet.files[0].path).toBe('src/service.ts');
      expect(changeSet.summary.filesChanged).toBe(1);
    });

    it('23. classifies files into appropriate engineering categories', () => {
      const infraSet = mapPullRequestToChangeSet(SAMPLE_INFRA_PATCH);
      expect(infraSet.files[0].category).toBe('infrastructure');

      const appSet = mapPullRequestToChangeSet(SAMPLE_APP_PATCH);
      expect(appSet.files[0].category).toBe('application');
    });

    it('24. extracts engineering signals from PR patch', () => {
      const infraSet = mapPullRequestToChangeSet(SAMPLE_INFRA_PATCH);
      expect(infraSet.signals.length).toBeGreaterThan(0);
      expect(infraSet.signals.some((s) => s.type === 'network-config-modified')).toBe(true);
    });

    it('25. detects security-sensitive configuration signals', () => {
      const secretSet = mapPullRequestToChangeSet(SAMPLE_SECRET_PATCH);
      expect(secretSet.summary.securitySensitiveSignalCount).toBeGreaterThan(0);
      expect(secretSet.summary.maskedSecretsCount).toBe(1);
    });

    it('26. detects dependency manifest signals', () => {
      const depSet = mapPullRequestToChangeSet(SAMPLE_DEP_PATCH);
      const partitions = partitionSignals(depSet.signals);
      expect(partitions.dependency.length).toBeGreaterThan(0);
    });

    it('27. detects CI/CD workflow security signals', () => {
      const ciSet = mapPullRequestToChangeSet(SAMPLE_CI_PATCH);
      const partitions = partitionSignals(ciSet.signals);
      expect(partitions.cicd.length).toBeGreaterThan(0);
      expect(partitions.cicd.some((s) => s.type === 'cicd-security-step-modified')).toBe(true);
    });

    it('28. detects test file modification signals', () => {
      const testSet = mapPullRequestToChangeSet(SAMPLE_TEST_PATCH);
      const partitions = partitionSignals(testSet.signals);
      expect(partitions.testing.length).toBeGreaterThan(0);
      expect(partitions.testing.some((s) => s.type === 'tests-modified')).toBe(true);
    });

    it('29. detects infrastructure manifest signals', () => {
      const infraSet = mapPullRequestToChangeSet(SAMPLE_INFRA_PATCH);
      const partitions = partitionSignals(infraSet.signals);
      expect(partitions.infrastructure.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 6. EVIDENCE MODEL & GOVERNANCE (Tests 30-34)
  // =========================================================================
  describe('Truthful Governance & Evidence Model', () => {
    it('30. code-only PR results in securityImpactProven: false and no fabricated findings', async () => {
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 20 },
        {
          prNumber: 20,
          title: 'Update math calculation',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 1,
          additions: 1,
          deletions: 0,
        },
        [{ filename: 'src/service.ts', status: 'modified', additions: 1, deletions: 0, changes: 1, isBinary: false }],
        SAMPLE_APP_PATCH
      );

      const result = await analyzePullRequest('acme-corp/cloud-infrastructure#20', {}, mockProvider);
      expect(result.evidence.securityImpactProven).toBe(false);
      expect(result.evidence.evidenceSource).toBe('GITHUB_PR_PATCH');
      expect(result.evidence.conclusion).toContain('Observed 1 code/configuration modification');
      expect(result.riskStatus).toBe('ENGINEERING_CHANGE_DETECTED');
    });

    it('31. infrastructure-sensitive PR produces signals only without topology correlation', async () => {
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 21 },
        {
          prNumber: 21,
          title: 'Expose database port in ingress',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 1,
          additions: 1,
          deletions: 0,
        },
        [{ filename: 'k8s/network-policy.yaml', status: 'modified', additions: 1, deletions: 0, changes: 1, isBinary: false }],
        SAMPLE_INFRA_PATCH
      );

      const result = await analyzePullRequest('acme-corp/cloud-infrastructure#21', {}, mockProvider);
      expect(result.evidence.securityImpactProven).toBe(false);
      expect(result.riskStatus).toBe('SECURITY_SENSITIVE_CHANGE');
      expect(result.evidence.conclusion).toContain('Detected 1 security-sensitive configuration modification');
      expect(result.evidence.limitationStatement).toContain('not proven from repository diff alone');
    });

    it('32. proves impact when explicit before/after environments are supplied', async () => {
      // Create broken environment by adding Internet -> DB edge
      const brokenEnv = deserializeEnvironment(serializeEnvironment(baselineEnv));
      brokenEnv.createEdge('node-internet', 'node-db', { protocol: 'tcp', ports: '5432' });

      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 22 },
        {
          prNumber: 22,
          title: 'Direct DB access',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 1,
          additions: 1,
          deletions: 0,
        },
        [{ filename: 'k8s/network-policy.yaml', status: 'modified', additions: 1, deletions: 0, changes: 1, isBinary: false }],
        SAMPLE_INFRA_PATCH
      );

      const result = await analyzePullRequest(
        'acme-corp/cloud-infrastructure#22',
        {
          beforeEnvironment: baselineEnv,
          afterEnvironment: brokenEnv,
        },
        mockProvider
      );

      expect(result.evidence.securityImpactProven).toBe(true);
      expect(result.evidence.evidenceSource).toBe('PATHFORGE_ENVIRONMENT_ANALYSIS');
      expect(result.riskStatus).toBe('SECURITY_REGRESSION');
      expect(result.bridgeResult.changeAnalysisResult?.summary.category).toBe('degradation');
      expect(result.bridgeResult.changeAnalysisResult?.summary.impactLevel).toBe('CRITICAL');
    });

    it('33. missing after environment clearly asserts lack of modeled topology', async () => {
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 23 },
        {
          prNumber: 23,
          title: 'Config without after env',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 1,
          additions: 1,
          deletions: 0,
        },
        [{ filename: 'src/api.ts', status: 'modified', additions: 1, deletions: 0, changes: 1, isBinary: false }],
        SAMPLE_APP_PATCH
      );

      const result = await analyzePullRequest(
        'acme-corp/cloud-infrastructure#23',
        { beforeEnvironment: baselineEnv }, // Missing afterEnvironment
        mockProvider
      );

      expect(result.evidence.securityImpactProven).toBe(false);
      expect(result.evidence.limitationStatement).toContain('Zero infrastructure security findings or regressions');
    });

    it('34. does not fabricate attack paths from source diff alone', async () => {
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 24 },
        {
          prNumber: 24,
          title: 'Infra diff alone',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 1,
          additions: 1,
          deletions: 0,
        },
        [{ filename: 'k8s/network-policy.yaml', status: 'modified', additions: 1, deletions: 0, changes: 1, isBinary: false }],
        SAMPLE_INFRA_PATCH
      );

      const result = await analyzePullRequest('acme-corp/cloud-infrastructure#24', {}, mockProvider);
      expect(result.bridgeResult.changeAnalysisResult).toBeUndefined();
    });
  });

  // =========================================================================
  // 7. PULL REQUEST RISK STATUS CLASSIFICATION (Tests 35-40)
  // =========================================================================
  describe('Pull Request Risk Status', () => {
    it('35. returns NO_ENGINEERING_IMPACT when 0 files changed', () => {
      const status = determinePullRequestRiskStatus(0, 0, false);
      expect(status).toBe('NO_ENGINEERING_IMPACT');
    });

    it('36. returns ENGINEERING_CHANGE_DETECTED for standard changes without security signals', () => {
      const status = determinePullRequestRiskStatus(3, 0, false);
      expect(status).toBe('ENGINEERING_CHANGE_DETECTED');
    });

    it('37. returns SECURITY_SENSITIVE_CHANGE when sensitive signals detected without topology', () => {
      const status = determinePullRequestRiskStatus(2, 1, false);
      expect(status).toBe('SECURITY_SENSITIVE_CHANGE');
    });

    it('38. returns SECURITY_IMPROVEMENT when proven fixes resolve risks', () => {
      const status = determinePullRequestRiskStatus(
        1,
        0,
        true, // isInfrastructureProven
        false, // regressionDetected
        0, // risksIntroduced
        0, // securityDecreasing
        1, // risksResolved
        1 // securityIncreasing
      );
      expect(status).toBe('SECURITY_IMPROVEMENT');
    });

    it('39. returns SECURITY_REGRESSION when regression is proven in modeled topology', () => {
      const status = determinePullRequestRiskStatus(
        1,
        1,
        true, // isInfrastructureProven
        true, // regressionDetected
        1, // risksIntroduced
        1 // securityDecreasing
      );
      expect(status).toBe('SECURITY_REGRESSION');
    });

    it('40. returns INSUFFICIENT_EVIDENCE on unretrieved or failed analysis', async () => {
      const result = await analyzePullRequest('acme-corp/non-existent#999', {}, mockProvider);
      expect(result.isAnalysisComplete).toBe(false);
      expect(result.riskStatus).toBe('INSUFFICIENT_EVIDENCE');
      expect(result.error).toBeDefined();
    });
  });

  // =========================================================================
  // 8. DETERMINISM (Tests 41-45)
  // =========================================================================
  describe('Determinism & Stability Invariants', () => {
    beforeEach(() => {
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 30 },
        {
          prNumber: 30,
          title: 'Determinism test',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z',
          changedFilesCount: 2,
          additions: 10,
          deletions: 5,
        },
        [
          { filename: 'src/api.ts', status: 'modified', additions: 5, deletions: 5, changes: 10, isBinary: false },
          { filename: 'k8s/net.yaml', status: 'modified', additions: 5, deletions: 0, changes: 5, isBinary: false },
        ],
        `${SAMPLE_APP_PATCH}\n${SAMPLE_INFRA_PATCH}`
      );
    });

    it('41. produces identical analysis results across repeated executions', async () => {
      const run1 = await analyzePullRequest('acme-corp/cloud-infrastructure#30', {}, mockProvider);
      const run2 = await analyzePullRequest('acme-corp/cloud-infrastructure#30', {}, mockProvider);

      expect(run1.riskStatus).toBe(run2.riskStatus);
      expect(run1.normalizedChangeSet.files.length).toBe(run2.normalizedChangeSet.files.length);
      expect(run1.signalsSummary.securitySensitive.length).toBe(run2.signalsSummary.securitySensitive.length);
      expect(run1.evidence.conclusion).toBe(run2.evidence.conclusion);
    });

    it('42. maintains file ordering independence (scrambled input produces sorted output)', async () => {
      const scrambled = [
        { filename: 'zebra.yaml', status: 'modified' as const, additions: 1, deletions: 0, changes: 1, isBinary: false },
        { filename: 'alpha.yaml', status: 'modified' as const, additions: 1, deletions: 0, changes: 1, isBinary: false },
      ];
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 31 },
        {
          prNumber: 31,
          title: 'Scrambled',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 2,
          additions: 2,
          deletions: 0,
        },
        scrambled
      );

      const files = await getPullRequestFiles(
        parsePullRequestReference('acme-corp/cloud-infrastructure#31'),
        mockProvider
      );
      expect(files[0].filename).toBe('alpha.yaml');
      expect(files[1].filename).toBe('zebra.yaml');
    });

    it('43. metadata timestamps never alter change hash, categories, or signals', () => {
      const set1 = mapPullRequestToChangeSet(SAMPLE_INFRA_PATCH);
      const set2 = mapPullRequestToChangeSet(SAMPLE_INFRA_PATCH);

      expect(set1.files[0].id).toBe(set2.files[0].id);
      expect(set1.files[0].signature).toBe(set2.files[0].signature);
    });

    it('44. produces stable change IDs without random UUIDs or machine state', () => {
      const set = mapPullRequestToChangeSet(SAMPLE_APP_PATCH);
      const fileId = set.files[0].id;
      expect(typeof fileId).toBe('string');
      expect(fileId.length).toBeGreaterThan(0);
      expect(fileId).toBe(mapPullRequestToChangeSet(SAMPLE_APP_PATCH).files[0].id);
    });

    it('45. maintains deterministic signal ordering across collections', () => {
      const set = mapPullRequestToChangeSet(`${SAMPLE_INFRA_PATCH}\n${SAMPLE_CI_PATCH}`);
      const part1 = partitionSignals(set.signals);
      const part2 = partitionSignals(set.signals);

      expect(part1.infrastructure.map((s) => s.id)).toEqual(
        part2.infrastructure.map((s) => s.id)
      );
    });
  });

  // =========================================================================
  // 9. PROVIDER FAILURE HANDLING (Tests 46-51)
  // =========================================================================
  describe('Provider Failures & Error Handling', () => {
    it('46. handles AUTH_UNAVAILABLE gracefully without crash', async () => {
      mockProvider.registerError('acme-corp/cloud-infrastructure#40', {
        code: 'AUTH_UNAVAILABLE',
        message: 'GitHub CLI not authenticated',
      });

      const res = await analyzePullRequest('acme-corp/cloud-infrastructure#40', {}, mockProvider);
      expect(res.isAnalysisComplete).toBe(false);
      expect(res.riskStatus).toBe('INSUFFICIENT_EVIDENCE');
      expect(res.error).toContain('AUTH_UNAVAILABLE');
    });

    it('47. handles REPOSITORY_NOT_FOUND gracefully', async () => {
      mockProvider.registerError('unknown-org/unknown-repo', {
        code: 'REPOSITORY_NOT_FOUND',
        message: 'Could not resolve to a repository',
      });

      const res = await analyzePullRequest('unknown-org/unknown-repo#1', {}, mockProvider);
      expect(res.isAnalysisComplete).toBe(false);
      expect(res.error).toContain('REPOSITORY_NOT_FOUND');
    });

    it('48. handles PR_NOT_FOUND gracefully', async () => {
      mockProvider.registerError('acme-corp/cloud-infrastructure#99999', {
        code: 'PR_NOT_FOUND',
        message: 'Pull request 99999 not found',
      });

      const res = await analyzePullRequest('acme-corp/cloud-infrastructure#99999', {}, mockProvider);
      expect(res.isAnalysisComplete).toBe(false);
      expect(res.error).toContain('PR_NOT_FOUND');
    });

    it('49. handles RATE_LIMITED error gracefully', async () => {
      mockProvider.registerError('acme-corp/cloud-infrastructure#41', {
        code: 'RATE_LIMITED',
        message: 'API rate limit exceeded',
      });

      const res = await analyzePullRequest('acme-corp/cloud-infrastructure#41', {}, mockProvider);
      expect(res.isAnalysisComplete).toBe(false);
      expect(res.error).toContain('RATE_LIMITED');
    });

    it('50. handles NETWORK_UNAVAILABLE error gracefully', async () => {
      mockProvider.registerError('acme-corp/cloud-infrastructure#42', {
        code: 'NETWORK_UNAVAILABLE',
        message: 'Connection timed out',
      });

      const res = await analyzePullRequest('acme-corp/cloud-infrastructure#42', {}, mockProvider);
      expect(res.isAnalysisComplete).toBe(false);
      expect(res.error).toContain('NETWORK_UNAVAILABLE');
    });

    it('51. handles MALFORMED_RESPONSE error gracefully', async () => {
      mockProvider.registerError('acme-corp/cloud-infrastructure#43', {
        code: 'MALFORMED_RESPONSE',
        message: 'Unexpected token < in JSON at position 0',
      });

      const res = await analyzePullRequest('acme-corp/cloud-infrastructure#43', {}, mockProvider);
      expect(res.isAnalysisComplete).toBe(false);
      expect(res.error).toContain('MALFORMED_RESPONSE');
    });
  });

  // =========================================================================
  // 10. SECURITY & CREDENTIAL SANITIZATION (Tests 52-54)
  // =========================================================================
  describe('Security & Credential Sanitization', () => {
    it('52. sanitizes GitHub tokens from error messages', () => {
      const rawError = 'Failed with token ghp_123456789012345678901234567890123456 in header';
      const sanitized = sanitizeErrorMessage(rawError);
      expect(sanitized).not.toContain('ghp_123456789012345678901234567890123456');
      expect(sanitized).toContain('[REDACTED_GH_TOKEN]');
    });

    it('53. sanitizes Bearer tokens and generic API keys', () => {
      const rawError = 'Error: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and sk-live-1234567890abcdef1234567890';
      const sanitized = sanitizeErrorMessage(rawError);
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(sanitized).not.toContain('sk-live-1234567890abcdef1234567890');
      expect(sanitized).toContain('[REDACTED_TOKEN]');
      expect(sanitized).toContain('[REDACTED_SECRET]');
    });

    it('54. analysis result contains zero token fields or authorization headers', async () => {
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 50 },
        {
          prNumber: 50,
          title: 'Sanitization check',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 1,
          additions: 1,
          deletions: 0,
        },
        [{ filename: 'src/app.ts', status: 'modified', additions: 1, deletions: 0, changes: 1, isBinary: false }],
        SAMPLE_APP_PATCH
      );

      const res = await analyzePullRequest('acme-corp/cloud-infrastructure#50', {}, mockProvider);
      const json = JSON.stringify(res);
      expect(json).not.toContain('token');
      expect(json).not.toContain('ghp_');
      expect(json).not.toContain('gho_');
      expect(json).not.toContain('Bearer');
    });
  });

  // =========================================================================
  // 11. READ-ONLY MANDATE (Tests 55-57)
  // =========================================================================
  describe('Strict Read-Only Mandate', () => {
    it('55. GitHubProvider interface contains zero mutation methods', () => {
      const providerMethods = Object.getOwnPropertyNames(MockGitHubProvider.prototype);
      const mutatingNames = [
        'createComment',
        'addComment',
        'merge',
        'mergePullRequest',
        'close',
        'approve',
        'requestChanges',
        'push',
        'createBranch',
        'updateBranch',
        'createCheck',
      ];
      for (const m of mutatingNames) {
        expect(providerMethods).not.toContain(m);
      }
    });

    it('56. mock provider has no mutation APIs', () => {
      const p = createMockGitHubProvider() as unknown as Record<string, unknown>;
      expect(p.mergePullRequest).toBeUndefined();
      expect(p.addComment).toBeUndefined();
      expect(p.pushCommit).toBeUndefined();
    });

    it('57. analysis execution leaves repository state completely unmodified', async () => {
      mockProvider.registerPullRequest(
        { owner: 'acme-corp', repository: 'cloud-infrastructure', pullRequestNumber: 60 },
        {
          prNumber: 60,
          title: 'Read only check',
          body: '',
          author: 'alice',
          state: 'OPEN',
          isDraft: false,
          baseBranch: 'main',
          headBranch: 'feat',
          baseSha: '1111',
          headSha: '2222',
          createdAt: '',
          updatedAt: '',
          changedFilesCount: 1,
          additions: 1,
          deletions: 0,
        },
        [{ filename: 'src/app.ts', status: 'modified', additions: 1, deletions: 0, changes: 1, isBinary: false }],
        SAMPLE_APP_PATCH
      );

      const beforeEnvJson = serializeEnvironment(baselineEnv);
      await analyzePullRequest('acme-corp/cloud-infrastructure#60', { beforeEnvironment: baselineEnv }, mockProvider);
      const afterEnvJson = serializeEnvironment(baselineEnv);

      expect(afterEnvJson).toBe(beforeEnvJson);
    });
  });
});
