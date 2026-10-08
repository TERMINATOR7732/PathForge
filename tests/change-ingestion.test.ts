import { describe, it, expect } from 'vitest';
import {
  ingestRepositoryChanges,
  parseUnifiedDiff,
  normalizeRepositoryPath,
  classifyFile,
  maskSensitiveContent,
  filterInfrastructureRelevantFiles,
  filterUnmappedFiles,
  bridgeToChangeAnalysis,
  createEnvironmentSnapshot,
  Environment,
} from '../packages/core/src/index.js';

describe('Phase 3.2 — Repository Change Ingestion Foundation', () => {
  // ==========================================
  // 1. Unified Diff Parsing (Tests 1-10)
  // ==========================================
  describe('Unified Diff Parsing', () => {
    it('1. parses an empty diff safely without error', () => {
      const res = parseUnifiedDiff('');
      expect(res.files).toHaveLength(0);
      expect(res.warnings).toHaveLength(0);
      expect(res.errors).toHaveLength(0);
      expect(res.maskedSecretsCount).toBe(0);
    });

    it('2. parses a single modified file', () => {
      const diff = `diff --git a/src/app.ts b/src/app.ts
index 1234567..89abcdef 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 import express from 'express';
+const port = 8080;
 app.listen(port);
`;
      const res = parseUnifiedDiff(diff);
      expect(res.files).toHaveLength(1);
      const f = res.files[0];
      expect(f.path).toBe('src/app.ts');
      expect(f.changeType).toBe('MODIFIED');
      expect(f.linesAdded).toBe(1);
      expect(f.linesDeleted).toBe(0);
      expect(f.hunks).toHaveLength(1);
    });

    it('3. parses an added new file', () => {
      const diff = `diff --git a/src/new-service.ts b/src/new-service.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/new-service.ts
@@ -0,0 +1,3 @@
+export function hello() {
+  return 'world';
+}
`;
      const res = parseUnifiedDiff(diff);
      expect(res.files).toHaveLength(1);
      const f = res.files[0];
      expect(f.path).toBe('src/new-service.ts');
      expect(f.changeType).toBe('ADDED');
      expect(f.linesAdded).toBe(3);
      expect(f.linesDeleted).toBe(0);
    });

    it('4. parses a deleted file', () => {
      const diff = `diff --git a/legacy.ts b/legacy.ts
deleted file mode 100644
index 1234567..0000000
--- a/legacy.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export const old = 1;
-export const dead = 2;
`;
      const res = parseUnifiedDiff(diff);
      expect(res.files).toHaveLength(1);
      const f = res.files[0];
      expect(f.path).toBe('legacy.ts');
      expect(f.changeType).toBe('DELETED');
      expect(f.linesAdded).toBe(0);
      expect(f.linesDeleted).toBe(2);
    });

    it('5. parses a renamed file', () => {
      const diff = `diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 100%
rename from src/old-name.ts
rename to src/new-name.ts
`;
      const res = parseUnifiedDiff(diff);
      expect(res.files).toHaveLength(1);
      const f = res.files[0];
      expect(f.path).toBe('src/new-name.ts');
      expect(f.oldPath).toBe('src/old-name.ts');
      expect(f.newPath).toBe('src/new-name.ts');
      expect(f.changeType).toBe('RENAMED');
    });

    it('6. parses multiple files in a single unified diff', () => {
      const diff = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 const a = 1;
+const a2 = 2;
diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -1,2 +1,1 @@
 const b = 1;
-const dead = 2;
`;
      const res = parseUnifiedDiff(diff);
      expect(res.files).toHaveLength(2);
      expect(res.files[0].path).toBe('src/a.ts');
      expect(res.files[0].linesAdded).toBe(1);
      expect(res.files[1].path).toBe('src/b.ts');
      expect(res.files[1].linesDeleted).toBe(1);
    });

    it('7. parses multiple hunks within a single file', () => {
      const diff = `diff --git a/src/multi.ts b/src/multi.ts
--- a/src/multi.ts
+++ b/src/multi.ts
@@ -1,3 +1,4 @@
 line 1
+line 1.5
 line 2
@@ -10,3 +11,4 @@
 line 10
+line 10.5
 line 11
`;
      const res = parseUnifiedDiff(diff);
      expect(res.files).toHaveLength(1);
      expect(res.files[0].hunks).toHaveLength(2);
      expect(res.files[0].linesAdded).toBe(2);
    });

    it('8. accurately tracks added, deleted, and context lines', () => {
      const diff = `diff --git a/test.txt b/test.txt
--- a/test.txt
+++ b/test.txt
@@ -1,4 +1,4 @@
 context 1
-deleted 1
+added 1
 context 2
`;
      const res = parseUnifiedDiff(diff);
      const hunk = res.files[0].hunks[0];
      expect(hunk.lines).toHaveLength(4);
      expect(hunk.lines[0].type).toBe('context');
      expect(hunk.lines[1].type).toBe('deleted');
      expect(hunk.lines[2].type).toBe('added');
      expect(hunk.lines[3].type).toBe('context');
    });

    it('9. handles malformed diff headers with a structured warning instead of crashing', () => {
      const diff = `diff --git malformed_without_spaces
---
+++
@@ -1,1 +1,1 @@
+some line
`;
      const res = parseUnifiedDiff(diff);
      expect(res.files).toBeDefined();
      expect(res.warnings.length + res.errors.length).toBeGreaterThan(0);
    });

    it('10. handles malformed hunk headers with warnings without crashing', () => {
      const diff = `diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ invalid hunk header @@
+line 1
`;
      const res = parseUnifiedDiff(diff);
      expect(res.files).toHaveLength(1);
      expect(res.warnings.some((w) => w.includes('Malformed hunk header'))).toBe(true);
      expect(res.files[0].linesAdded).toBe(1);
    });
  });

  // ==========================================
  // 2. Path Normalization (Tests 11-15)
  // ==========================================
  describe('Path Normalization', () => {
    it('11. normalizes leading dot-slash: ./src/app.ts -> src/app.ts', () => {
      const norm = normalizeRepositoryPath('./src/app.ts');
      expect(norm.path).toBe('src/app.ts');
      expect(norm.error).toBeUndefined();
    });

    it('12. normalizes standard repository path: src/app.ts -> src/app.ts', () => {
      const norm = normalizeRepositoryPath('src/app.ts');
      expect(norm.path).toBe('src/app.ts');
      expect(norm.error).toBeUndefined();
    });

    it('13. strips git a/ diff prefix: a/src/app.ts -> src/app.ts', () => {
      const norm = normalizeRepositoryPath('a/src/app.ts');
      expect(norm.path).toBe('src/app.ts');
    });

    it('14. strips git b/ diff prefix: b/src/app.ts -> src/app.ts', () => {
      const norm = normalizeRepositoryPath('b/src/app.ts');
      expect(norm.path).toBe('src/app.ts');
    });

    it('15. rejects absolute filesystem paths (Windows drive and Unix root)', () => {
      const win = normalizeRepositoryPath('C:/Users/Admin/repo/src/app.ts');
      expect(win.path).toBe('');
      expect(win.error).toBeDefined();
      expect(win.error).toContain('Absolute filesystem paths are rejected');

      const unix = normalizeRepositoryPath('/etc/passwd');
      expect(unix.path).toBe('');
      expect(unix.error).toBeDefined();
      expect(unix.error).toContain('Absolute root paths are rejected');
    });

    it('15b. rejects directory traversal sequences attempting to escape repository root', () => {
      const traversal = normalizeRepositoryPath('../outside.ts');
      expect(traversal.path).toBe('');
      expect(traversal.error).toBeDefined();
      expect(traversal.error).toContain('Directory traversal sequences');
    });

    it('15c. normalizes backslashes and collapses duplicate slashes', () => {
      const winBackslash = normalizeRepositoryPath('.\\src\\\\components\\\\App.tsx');
      expect(winBackslash.path).toBe('src/components/App.tsx');
    });
  });

  // ==========================================
  // 3. File Classification (Tests 16-25)
  // ==========================================
  describe('File Classification', () => {
    it('16. classifies TypeScript application files as application', () => {
      expect(classifyFile('src/services/user.ts')).toBe('application');
      expect(classifyFile('apps/web/src/App.tsx')).toBe('application');
    });

    it('17. classifies test and spec files as tests', () => {
      expect(classifyFile('src/services/user.test.ts')).toBe('tests');
      expect(classifyFile('tests/integration.spec.js')).toBe('tests');
      expect(classifyFile('tests/deep-configuration.test.ts')).toBe('tests');
      expect(classifyFile('test_auth.py')).toBe('tests');
    });

    it('18. classifies Dockerfiles as infrastructure', () => {
      expect(classifyFile('Dockerfile')).toBe('infrastructure');
      expect(classifyFile('docker/Dockerfile.api')).toBe('infrastructure');
      expect(classifyFile('docker-compose.yml')).toBe('infrastructure');
      expect(classifyFile('docker-compose.prod.yaml')).toBe('infrastructure');
    });

    it('19. classifies Kubernetes manifests as infrastructure', () => {
      expect(classifyFile('k8s/deployment.yaml')).toBe('infrastructure');
      expect(classifyFile('manifests/ingress.k8s.yaml')).toBe('infrastructure');
      expect(classifyFile('helm/values.yaml')).toBe('infrastructure');
    });

    it('20. classifies Terraform configurations as infrastructure', () => {
      expect(classifyFile('terraform/main.tf')).toBe('infrastructure');
      expect(classifyFile('variables.tfvars')).toBe('infrastructure');
      expect(classifyFile('infra.tf.json')).toBe('infrastructure');
    });

    it('21. classifies CI/CD workflows as cicd', () => {
      expect(classifyFile('.github/workflows/deploy.yml')).toBe('cicd');
      expect(classifyFile('.gitlab-ci.yml')).toBe('cicd');
      expect(classifyFile('Jenkinsfile')).toBe('cicd');
    });

    it('22. classifies dependency manifests as dependencies', () => {
      expect(classifyFile('package.json')).toBe('dependencies');
      expect(classifyFile('requirements.txt')).toBe('dependencies');
      expect(classifyFile('Cargo.toml')).toBe('dependencies');
      expect(classifyFile('go.mod')).toBe('dependencies');
    });

    it('23. classifies lockfiles as dependencies', () => {
      expect(classifyFile('package-lock.json')).toBe('dependencies');
      expect(classifyFile('yarn.lock')).toBe('dependencies');
      expect(classifyFile('Cargo.lock')).toBe('dependencies');
      expect(classifyFile('poetry.lock')).toBe('dependencies');
    });

    it('24. classifies documentation files as documentation', () => {
      expect(classifyFile('README.md')).toBe('documentation');
      expect(classifyFile('docs/architecture.markdown')).toBe('documentation');
      expect(classifyFile('LICENSE')).toBe('documentation');
    });

    it('25. classifies unrecognized extensions/files as unknown without guessing', () => {
      expect(classifyFile('binary.dat')).toBe('unknown');
      expect(classifyFile('random_file')).toBe('unknown');
      expect(classifyFile('custom.xyz123')).toBe('unknown');
    });
  });

  // ==========================================
  // 4. Engineering Signals (Tests 26-32)
  // ==========================================
  describe('Engineering Signals', () => {
    it('26. derives network configuration signals from network-related changes', () => {
      const diff = `diff --git a/k8s/network-policy.yaml b/k8s/network-policy.yaml
new file mode 100644
--- /dev/null
+++ b/k8s/network-policy.yaml
@@ -0,0 +1,5 @@
+apiVersion: networking.k8s.io/v1
+kind: NetworkPolicy
+spec:
+  ingress:
+    - ports: [{ port: 443 }]
`;
      const cs = ingestRepositoryChanges(diff);
      const networkSignals = cs.signals.filter((s) => s.type === 'network-config-modified');
      expect(networkSignals.length).toBeGreaterThan(0);
      expect(networkSignals[0].isSecuritySensitive).toBe(true);
      expect(networkSignals[0].hint).toContain('Network port configuration changed');
    });

    it('27. derives TLS/encryption signals when encryption parameters change', () => {
      const diff = `diff --git a/nginx.conf b/nginx.conf
--- a/nginx.conf
+++ b/nginx.conf
@@ -1,2 +1,3 @@
 server {
+  ssl_protocols TLSv1.3;
 }
`;
      const cs = ingestRepositoryChanges(diff);
      const tlsSignals = cs.signals.filter((s) => s.type === 'encryption-modified');
      expect(tlsSignals.length).toBeGreaterThan(0);
      expect(tlsSignals[0].category).toBe('security');
      expect(tlsSignals[0].isSecuritySensitive).toBe(true);
    });

    it('28. derives authentication signals from auth policies', () => {
      const diff = `diff --git a/auth-policy.json b/auth-policy.json
--- a/auth-policy.json
+++ b/auth-policy.json
@@ -1,2 +1,3 @@
 {
+  "oauth_provider": "internal_sso"
 }
`;
      const cs = ingestRepositoryChanges(diff);
      const authSignals = cs.signals.filter((s) => s.type === 'authentication-modified');
      expect(authSignals.length).toBeGreaterThan(0);
      expect(authSignals[0].isSecuritySensitive).toBe(true);
    });

    it('29. derives CI/CD workflow and security scan step signals', () => {
      const diff = `diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,2 +1,4 @@
 jobs:
   test:
+    - name: Run Snyk Security Scan
+      run: snyk test
`;
      const cs = ingestRepositoryChanges(diff);
      expect(cs.signals.some((s) => s.type === 'cicd-workflow-modified')).toBe(true);
      expect(cs.signals.some((s) => s.type === 'cicd-security-step-modified')).toBe(true);
    });

    it('30. derives distinct testing signals for added, modified, and deleted tests', () => {
      const diff = `diff --git a/tests/a.test.ts b/tests/a.test.ts
new file mode 100644
--- /dev/null
+++ b/tests/a.test.ts
@@ -0,0 +1,1 @@
+test('adds', () => {});
diff --git a/tests/b.test.ts b/tests/b.test.ts
--- a/tests/b.test.ts
+++ b/tests/b.test.ts
@@ -1,1 +1,2 @@
+// modified
 test('runs', () => {});
diff --git a/tests/c.test.ts b/tests/c.test.ts
deleted file mode 100644
--- a/tests/c.test.ts
+++ /dev/null
@@ -1,1 +0,0 @@
-test('old', () => {});
`;
      const cs = ingestRepositoryChanges(diff);
      expect(cs.signals.some((s) => s.type === 'tests-added')).toBe(true);
      expect(cs.signals.some((s) => s.type === 'tests-modified')).toBe(true);
      const deletedSignal = cs.signals.find((s) => s.type === 'tests-deleted');
      expect(deletedSignal).toBeDefined();
      expect(deletedSignal?.isSecuritySensitive).toBe(true); // Deleting tests flags security attention
    });

    it('31. derives dependency signals distinguishing manifests from lockfiles', () => {
      const diff = `diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -1,2 +1,3 @@
 "dependencies": {
+  "express": "^4.18.2"
 }
diff --git a/package-lock.json b/package-lock.json
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,1 +1,2 @@
+"lock": 1
`;
      const cs = ingestRepositoryChanges(diff);
      expect(cs.signals.some((s) => s.type === 'dependency-manifest-modified')).toBe(true);
      expect(cs.signals.some((s) => s.type === 'lockfile-modified')).toBe(true);
    });

    it('32. infrastructure signals represent observations, not vulnerability findings', () => {
      const diff = `diff --git a/Dockerfile b/Dockerfile
--- a/Dockerfile
+++ b/Dockerfile
@@ -1,1 +1,2 @@
 FROM alpine:3.18
+EXPOSE 8080
`;
      const cs = ingestRepositoryChanges(diff);
      const infraSignal = cs.signals.find((s) => s.type === 'dockerfile-modified');
      expect(infraSignal).toBeDefined();
      // Signals contain explanatory hints, not security findings
      expect(infraSignal?.hint).toContain('Container image definition altered');
      expect(cs.summary.securitySensitiveSignalCount).toBe(0); // Port expose without explicit flaw is standard infra signal
    });
  });

  // ==========================================
  // 5. Determinism & Stability (Tests 33-37)
  // ==========================================
  describe('Determinism & Stability', () => {
    const sampleDiffA = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,1 +1,2 @@
+const a = 1;
diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -1,1 +1,2 @@
+const b = 2;
`;

    const sampleDiffB = `diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -1,1 +1,2 @@
+const b = 2;
diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,1 +1,2 @@
+const a = 1;
`;

    it('33. identical input yields identical output byte-for-byte in JSON serialization', () => {
      const r1 = ingestRepositoryChanges(sampleDiffA);
      const r2 = ingestRepositoryChanges(sampleDiffA);
      expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });

    it('34. order of files in input does not alter the canonical sorted result', () => {
      const r1 = ingestRepositoryChanges(sampleDiffA);
      const r2 = ingestRepositoryChanges(sampleDiffB);
      expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });

    it('35. hunk ordering is preserved and stable across identical diffs', () => {
      const r1 = ingestRepositoryChanges(sampleDiffA);
      expect(r1.files[0].path).toBe('src/a.ts');
      expect(r1.files[1].path).toBe('src/b.ts');
    });

    it('36. change IDs are deterministic and stable without random UUIDs or timestamps', () => {
      const r1 = ingestRepositoryChanges(sampleDiffA);
      const r2 = ingestRepositoryChanges(sampleDiffA);
      expect(r1.files[0].id).toBe(r2.files[0].id);
      expect(r1.files[0].id).toMatch(/^file-change-[0-9a-f]{8}$/);
    });

    it('37. summary metric counts are strictly deterministic', () => {
      const r = ingestRepositoryChanges(sampleDiffA);
      expect(r.summary.filesChanged).toBe(2);
      expect(r.summary.filesModified).toBe(2);
      expect(r.summary.linesAdded).toBe(2);
      expect(r.summary.linesDeleted).toBe(0);
    });
  });

  // ==========================================
  // 6. Security & Secret Masking (Tests 38-40)
  // ==========================================
  describe('Security & Secret Masking', () => {
    it('38. masks AWS keys, GitHub tokens, and API keys in diff hunks', () => {
      const diffWithSecrets = `diff --git a/config.ts b/config.ts
--- a/config.ts
+++ b/config.ts
@@ -1,2 +1,4 @@
+const awsKey = "AKIA1234567890ABCDEF";
+const ghToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
+const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz";
`;
      const cs = ingestRepositoryChanges(diffWithSecrets);
      const patch = cs.files[0].patch || '';
      expect(patch).toContain('[REDACTED_AWS_KEY]');
      expect(patch).toContain('[REDACTED_GITHUB_TOKEN]');
      expect(patch).toContain('[REDACTED_API_KEY]');
      expect(patch).not.toContain('AKIA1234567890ABCDEF');
      expect(patch).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
      expect(cs.summary.maskedSecretsCount).toBeGreaterThanOrEqual(3);
    });

    it('39. masks private-key-like blocks', () => {
      const diffWithKey = `diff --git a/server.key b/server.key
--- /dev/null
+++ b/server.key
@@ -0,0 +1,5 @@
+-----BEGIN RSA PRIVATE KEY-----
+MIIEowIBAAKCAQEA0Y1+secretkeydatahere
+-----END RSA PRIVATE KEY-----
`;
      const cs = ingestRepositoryChanges(diffWithKey);
      const patch = cs.files[0].patch || '';
      expect(patch).toContain('[REDACTED_PRIVATE_KEY]');
      expect(patch).not.toContain('secretkeydatahere');
      expect(cs.summary.maskedSecretsCount).toBeGreaterThanOrEqual(1);
    });

    it('40. masks credentials in key-value assignments', () => {
      const diff = `diff --git a/env.local b/env.local
--- a/env.local
+++ b/env.local
@@ -1,1 +1,2 @@
+password: "super_secret_db_password_123"
`;
      const cs = ingestRepositoryChanges(diff);
      const patch = cs.files[0].patch || '';
      expect(patch).toContain('[REDACTED_SECRET]');
      expect(patch).not.toContain('super_secret_db_password_123');
    });
  });

  // ==========================================
  // 7. Robustness, Formats & Governance (Tests 41-49)
  // ==========================================
  describe('Robustness, Formats & Truthful Governance', () => {
    it('41. safely handles binary file indicators', () => {
      const diff = `diff --git a/assets/logo.png b/assets/logo.png
new file mode 100644
index 0000000..abcdef1
Binary files /dev/null and b/assets/logo.png differ
`;
      const cs = ingestRepositoryChanges(diff);
      expect(cs.files).toHaveLength(1);
      expect(cs.files[0].isBinary).toBe(true);
      expect(cs.files[0].linesAdded).toBe(0);
    });

    it('42. handles duplicate file entries in diff gracefully with warnings', () => {
      const diff = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,1 +1,2 @@
+line 1
diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,1 +1,2 @@
+line 2
`;
      const cs = ingestRepositoryChanges(diff);
      expect(cs.files).toHaveLength(1);
      expect(cs.summary.parseWarnings.some((w) => w.includes('Duplicate diff entry'))).toBe(true);
    });

    it('43. handles unsupported or random lines without crashing', () => {
      const garbage = `Some random text from an email
not a diff at all
just unstructured logging
`;
      const cs = ingestRepositoryChanges(garbage);
      expect(cs.files).toHaveLength(0);
      expect(cs.summary.filesChanged).toBe(0);
    });

    it('44. handles incomplete diff hunks safely', () => {
      const incomplete = `diff --git a/incomplete.ts b/incomplete.ts
--- a/incomplete.ts
+++ b/incomplete.ts
@@ -1,10 +1,10 @@
+only one line provided
`;
      const cs = ingestRepositoryChanges(incomplete);
      expect(cs.files).toHaveLength(1);
      expect(cs.files[0].linesAdded).toBe(1);
    });

    it('45. unmapped files remain explicitly unmapped without fabricating topology', () => {
      const diff = `diff --git a/docs/readme.md b/docs/readme.md
--- a/docs/readme.md
+++ b/docs/readme.md
@@ -1,1 +1,2 @@
+# Title
diff --git a/src/logic.py b/src/logic.py
--- a/src/logic.py
+++ b/src/logic.py
@@ -1,1 +1,2 @@
+print("hi")
`;
      const cs = ingestRepositoryChanges(diff);
      expect(cs.infrastructureRelevantFiles).toHaveLength(0);
      expect(cs.unmappedFiles).toHaveLength(2);
      expect(cs.summary.unmappedCount).toBe(2);
    });

    it('46. supports StructuredChangeSetSource input', () => {
      const structuredSource = {
        type: 'structured-changes' as const,
        files: [
          {
            path: 'k8s/service.yaml',
            changeType: 'MODIFIED' as const,
            linesAdded: 5,
            linesDeleted: 2,
            content: 'port: 8080',
          },
        ],
      };
      const cs = ingestRepositoryChanges(structuredSource);
      expect(cs.files).toHaveLength(1);
      expect(cs.files[0].path).toBe('k8s/service.yaml');
      expect(cs.files[0].category).toBe('infrastructure');
      expect(cs.infrastructureRelevantFiles).toHaveLength(1);
    });

    it('47. supports RepositorySnapshotSource input comparing file maps', () => {
      const snapshotSource = {
        type: 'snapshot-comparison' as const,
        beforeFiles: {
          'src/app.ts': 'const a = 1;',
          'legacy.ts': 'export const old = true;',
        },
        afterFiles: {
          'src/app.ts': 'const a = 2;\nconst b = 3;',
          'new.ts': 'export const brandNew = true;',
        },
      };
      const cs = ingestRepositoryChanges(snapshotSource);
      expect(cs.summary.filesChanged).toBe(3); // 1 modified, 1 deleted, 1 added
      expect(cs.summary.filesModified).toBe(1);
      expect(cs.summary.filesDeleted).toBe(1);
      expect(cs.summary.filesAdded).toBe(1);
    });

    it('48. truthful governance: does not claim infrastructure posture changes from code diff alone', () => {
      const diff = `diff --git a/src/api.ts b/src/api.ts
--- a/src/api.ts
+++ b/src/api.ts
@@ -1,1 +1,2 @@
+export function api() {}
`;
      const cs = ingestRepositoryChanges(diff);
      const bridge = bridgeToChangeAnalysis(cs);
      expect(bridge.isInfrastructureProven).toBe(false);
      expect(bridge.securityImpactStatement).toContain(
        'Zero infrastructure or security posture changes are proven from code diff alone'
      );
    });

    it('49. bridges to Phase 3.1 change analysis when modeled before/after environments are provided', () => {
      const diff = `diff --git a/k8s/db.yaml b/k8s/db.yaml
--- a/k8s/db.yaml
+++ b/k8s/db.yaml
@@ -1,1 +1,2 @@
+kind: Database
`;
      const cs = ingestRepositoryChanges(diff);

      const env1 = new Environment({ id: 'env-1', name: 'Before Env' });
      const node1 = env1.createNode('internet', { x: 0, y: 0 }, 'Internet');
      const node2 = env1.createNode('database', { x: 100, y: 100 }, 'Database');
      env1.createEdge(node1.id, node2.id, { access: 'allow', protocol: 'tcp', port: '5432' });

      const snapBefore = createEnvironmentSnapshot(env1, {
        environmentId: env1.id,
        evaluatedAt: new Date().toISOString(),
        findings: [],
        summary: { totalFindings: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, infoCount: 0, passed: true },
        rulesEvaluated: 1,
      });

      // After env: deny the edge (security hardening)
      const env2 = new Environment({ id: 'env-2', name: 'After Env' });
      const n1 = env2.createNode('internet', { x: 0, y: 0 }, 'Internet');
      const n2 = env2.createNode('database', { x: 100, y: 100 }, 'Database');
      env2.createEdge(n1.id, n2.id, { access: 'deny', protocol: 'tcp', port: '5432' });

      const bridge = bridgeToChangeAnalysis(cs, {
        beforeEnvironment: snapBefore,
        afterEnvironment: env2,
      });

      expect(bridge.isInfrastructureProven).toBe(true);
      expect(bridge.changeAnalysisResult).toBeDefined();
      expect(bridge.changeAnalysisResult?.changes.length).toBeGreaterThan(0);
      expect(bridge.securityImpactStatement).toContain('Correlated');
    });
  });
});
