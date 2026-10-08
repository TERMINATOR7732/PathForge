import { FileCategory } from './types.js';

/**
 * Deterministically classifies a canonical repository-relative path
 * into a standard engineering file category.
 *
 * Principle: Unknown files must remain explicitly 'unknown'. Never guess.
 */
export function classifyFile(filePath: string): FileCategory {
  if (!filePath) {
    return 'unknown';
  }

  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const filename = normalized.split('/').pop() || '';

  // 1. Tests (evaluated first to capture e.g. src/app.test.ts as test rather than application)
  if (
    /\.(test|spec)\.[a-z0-9]+$/i.test(normalized) ||
    /(_test|\.test)\.[a-z0-9]+$/i.test(normalized) ||
    /^test_[a-z0-9_]+\.py$/i.test(filename) ||
    /(^|\/)(__tests__|tests|test|spec)\//i.test(normalized)
  ) {
    return 'tests';
  }

  // 2. Dependencies & Package Manifests (evaluated before documentation to catch requirements*.txt)
  if (
    filename === 'package.json' ||
    filename === 'package-lock.json' ||
    filename === 'pnpm-lock.yaml' ||
    filename === 'yarn.lock' ||
    filename === 'bun.lockb' ||
    /^requirements.*\.txt$/i.test(filename) ||
    filename === 'pipfile' ||
    filename === 'pipfile.lock' ||
    filename === 'pyproject.toml' ||
    filename === 'poetry.lock' ||
    filename === 'go.mod' ||
    filename === 'go.sum' ||
    filename === 'cargo.toml' ||
    filename === 'cargo.lock' ||
    filename === 'pom.xml' ||
    filename === 'build.gradle' ||
    filename === 'build.gradle.kts' ||
    filename === 'gemfile' ||
    filename === 'gemfile.lock'
  ) {
    return 'dependencies';
  }

  // 3. Documentation
  if (
    /\.(md|markdown|rst|txt|adoc)$/i.test(normalized) ||
    /(^|\/)(docs|documentation)\//i.test(normalized) ||
    /^(readme|contributing|license|changelog)(\.[a-z0-9]+)?$/i.test(filename)
  ) {
    return 'documentation';
  }

  // 3. CI / CD Configurations
  if (
    /^\.github\/workflows\/[a-z0-9_.-]+\.ya?ml$/i.test(normalized) ||
    /^\.gitlab-ci\.ya?ml$/i.test(normalized) ||
    /^\.circleci\/config\.ya?ml$/i.test(normalized) ||
    /(^|\/)jenkinsfile$/i.test(normalized) ||
    /^(bitbucket-pipelines|azure-pipelines)\.ya?ml$/i.test(filename)
  ) {
    return 'cicd';
  }

  // 4. Infrastructure Manifests
  if (
    filename === 'dockerfile' ||
    filename.startsWith('dockerfile.') ||
    filename.endsWith('.dockerfile') ||
    /^docker-compose.*\.ya?ml$/i.test(filename) ||
    /^compose.*\.ya?ml$/i.test(filename) ||
    /\.k8s\.ya?ml$/i.test(normalized) ||
    /(^|\/)(k8s|kubernetes|helm|manifests)\/[a-z0-9_.-]+\.ya?ml$/i.test(normalized) ||
    filename === 'chart.yaml' ||
    filename === 'values.yaml' ||
    /\.tf$/i.test(filename) ||
    /\.tfvars$/i.test(filename) ||
    /\.tf\.json$/i.test(filename) ||
    /^pulumi(\.[a-z0-9_-]+)?\.ya?ml$/i.test(filename) ||
    /\.cfn\.ya?ml$/i.test(filename) ||
    /\.cfn\.json$/i.test(filename) ||
    /^cloudformation.*\.ya?ml$/i.test(filename) ||
    /^cloudformation.*\.json$/i.test(filename) ||
    /\.ansible\.ya?ml$/i.test(filename) ||
    /^playbook.*\.ya?ml$/i.test(filename) ||
    /(^|\/)(playbooks|roles)\//i.test(normalized)
  ) {
    return 'infrastructure';
  }

  // 5. Security & Configuration
  if (
    /^\.env\.(example|template|sample|dist)$/i.test(filename) ||
    /^env\.template$/i.test(filename) ||
    /\.rego$/i.test(filename) ||
    /(^|\/)policies\/[a-z0-9_.-]+\.(json|ya?ml)$/i.test(normalized) ||
    /^(iptables|nftables|pf\.conf|ufw)/i.test(filename) ||
    /^(auth|permissions|roles|iam|security)-policy\.(json|ya?ml)$/i.test(filename)
  ) {
    return 'security-config';
  }

  // 6. Dependencies & Package Manifests
  if (
    filename === 'package.json' ||
    filename === 'package-lock.json' ||
    filename === 'pnpm-lock.yaml' ||
    filename === 'yarn.lock' ||
    filename === 'bun.lockb' ||
    /^requirements.*\.txt$/i.test(filename) ||
    filename === 'pipfile' ||
    filename === 'pipfile.lock' ||
    filename === 'pyproject.toml' ||
    filename === 'poetry.lock' ||
    filename === 'go.mod' ||
    filename === 'go.sum' ||
    filename === 'cargo.toml' ||
    filename === 'cargo.lock' ||
    filename === 'pom.xml' ||
    filename === 'build.gradle' ||
    filename === 'build.gradle.kts' ||
    filename === 'gemfile' ||
    filename === 'gemfile.lock'
  ) {
    return 'dependencies';
  }

  // 7. Application Code
  if (
    /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|cs|cpp|c|h|hpp|rb|php|swift|scala|vue|svelte|html|css|scss)$/i.test(
      filename
    )
  ) {
    return 'application';
  }

  // 8. Unknown
  return 'unknown';
}
