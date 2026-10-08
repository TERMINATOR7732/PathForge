import {
  EngineeringSignal,
  EngineeringSignalCategory,
  EngineeringSignalType,
  NormalizedFileChange,
} from './types.js';
import { generateSignalId } from './normalizer.js';

/**
 * Deterministically derives engineering signals from normalized file changes.
 *
 * PRINCIPLE:
 * Signals represent observed engineering context and operational hints.
 * They are NOT vulnerability findings and do not assert security posture on their own.
 */
export function extractEngineeringSignals(
  files: readonly NormalizedFileChange[]
): EngineeringSignal[] {
  const signalMap = new Map<string, EngineeringSignal>();

  for (const file of files) {
    const p = file.path.toLowerCase();
    const patchText = (file.patch || '').toLowerCase();

    // 1. Tests Signals
    if (file.category === 'tests') {
      if (file.changeType === 'ADDED') {
        addSignal(signalMap, {
          type: 'tests-added',
          category: 'testing',
          file: file.path,
          description: `Verification test file added: ${file.path}`,
          hint: 'New tests introduced -> verify they exercise intended assertions',
          isSecuritySensitive: false,
        });
      } else if (file.changeType === 'DELETED') {
        addSignal(signalMap, {
          type: 'tests-deleted',
          category: 'testing',
          file: file.path,
          description: `Verification test file deleted: ${file.path}`,
          hint: 'Tests deleted -> potential reduction in verification coverage, requires testing review',
          isSecuritySensitive: true,
        });
      } else {
        addSignal(signalMap, {
          type: 'tests-modified',
          category: 'testing',
          file: file.path,
          description: `Verification test file modified: ${file.path}`,
          hint: 'Test assertions updated -> verify coverage maintained',
          isSecuritySensitive: false,
        });
      }
    }

    // 2. Dependencies Signals
    if (file.category === 'dependencies') {
      if (p.includes('lock')) {
        addSignal(signalMap, {
          type: 'lockfile-modified',
          category: 'dependency',
          file: file.path,
          description: `Dependency lockfile modified: ${file.path}`,
          hint: 'Resolved dependency graph updated -> review locked component versions',
          isSecuritySensitive: false,
        });
      } else {
        addSignal(signalMap, {
          type: 'dependency-manifest-modified',
          category: 'dependency',
          file: file.path,
          description: `Dependency manifest modified: ${file.path}`,
          hint: 'Project dependencies altered -> check for version bumps or new dependencies',
          isSecuritySensitive: false,
        });
      }
    }

    // 3. CI/CD Signals
    if (file.category === 'cicd') {
      addSignal(signalMap, {
        type: 'cicd-workflow-modified',
        category: 'cicd',
        file: file.path,
        description: `CI/CD workflow modified: ${file.path}`,
        hint: 'Continuous integration workflow altered -> deployment or build gate may be impacted',
        isSecuritySensitive: false,
      });

      // Check for security scanner keywords in workflow
      if (
        patchText.includes('trivy') ||
        patchText.includes('snyk') ||
        patchText.includes('semgrep') ||
        patchText.includes('codeql') ||
        patchText.includes('sonar') ||
        patchText.includes('audit') ||
        patchText.includes('security')
      ) {
        addSignal(signalMap, {
          type: 'cicd-security-step-modified',
          category: 'cicd',
          file: file.path,
          description: `Security scanning step modified in CI workflow: ${file.path}`,
          hint: 'Pipeline security verification step altered -> review pipeline security posture',
          isSecuritySensitive: true,
        });
      }
    }

    // 4. Infrastructure Signals
    if (file.category === 'infrastructure') {
      if (p.includes('dockerfile')) {
        addSignal(signalMap, {
          type: 'dockerfile-modified',
          category: 'infrastructure',
          file: file.path,
          description: `Container build configuration modified: ${file.path}`,
          hint: 'Container image definition altered -> inspect base image, exposed ports, and root user',
          isSecuritySensitive: false,
        });
      } else if (p.includes('k8s') || p.includes('kubernetes') || p.includes('helm')) {
        addSignal(signalMap, {
          type: 'kubernetes-manifest-modified',
          category: 'infrastructure',
          file: file.path,
          description: `Kubernetes / container manifest modified: ${file.path}`,
          hint: 'Cluster workload or service specification altered -> inspect service exposure and network policies',
          isSecuritySensitive: false,
        });
      } else if (p.endsWith('.tf') || p.endsWith('.tfvars') || p.endsWith('.tf.json')) {
        addSignal(signalMap, {
          type: 'terraform-modified',
          category: 'infrastructure',
          file: file.path,
          description: `Terraform IaC configuration modified: ${file.path}`,
          hint: 'Infrastructure resource declarations changed -> inspect resource definitions and security groups',
          isSecuritySensitive: false,
        });
      } else {
        addSignal(signalMap, {
          type: 'infrastructure-manifest-modified',
          category: 'infrastructure',
          file: file.path,
          description: `Infrastructure manifest modified: ${file.path}`,
          hint: 'Infrastructure configuration altered -> inspect deployment topology and configuration',
          isSecuritySensitive: false,
        });
      }

      // Check if patch/file indicates network or service port configuration
      if (
        patchText.includes('port') ||
        patchText.includes('ingress') ||
        patchText.includes('targetport') ||
        patchText.includes('listen')
      ) {
        addSignal(signalMap, {
          type: 'network-config-modified',
          category: 'infrastructure',
          file: file.path,
          description: `Network configuration or port bindings modified: ${file.path}`,
          hint: 'Network port configuration changed -> requires downstream topology/security evaluation',
          isSecuritySensitive: true,
        });
      }
    }

    // 5. Security & Configuration Signals
    if (file.category === 'security-config') {
      if (
        p.includes('iptables') ||
        p.includes('nftables') ||
        p.includes('pf.conf') ||
        p.includes('ufw') ||
        p.includes('network')
      ) {
        addSignal(signalMap, {
          type: 'network-exposure-modified',
          category: 'security',
          file: file.path,
          description: `Firewall or network boundary rule modified: ${file.path}`,
          hint: 'Perimeter access rules altered -> requires downstream reachability analysis',
          isSecuritySensitive: true,
        });
      } else if (p.includes('auth') || p.includes('oauth') || p.includes('sso') || p.includes('login')) {
        addSignal(signalMap, {
          type: 'authentication-modified',
          category: 'security',
          file: file.path,
          description: `Authentication policy or configuration modified: ${file.path}`,
          hint: 'Identity verification settings altered -> review credential and authentication flow',
          isSecuritySensitive: true,
        });
      } else if (
        p.includes('role') ||
        p.includes('permission') ||
        p.includes('iam') ||
        p.includes('rbac') ||
        p.includes('policy') ||
        p.endsWith('.rego')
      ) {
        addSignal(signalMap, {
          type: 'authorization-modified',
          category: 'security',
          file: file.path,
          description: `Authorization or access-control policy modified: ${file.path}`,
          hint: 'Access control rules altered -> review least-privilege boundaries',
          isSecuritySensitive: true,
        });
      } else {
        addSignal(signalMap, {
          type: 'security-config-modified',
          category: 'security',
          file: file.path,
          description: `Security configuration file modified: ${file.path}`,
          hint: 'Security-sensitive configuration change detected -> requires downstream deterministic evaluation',
          isSecuritySensitive: true,
        });
      }
    }

    // 6. Content-based Signals across any file type
    if (
      patchText.includes('tls') ||
      patchText.includes('ssl') ||
      patchText.includes('cipher') ||
      patchText.includes('https') ||
      patchText.includes('certificate')
    ) {
      addSignal(signalMap, {
        type: 'encryption-modified',
        category: 'security',
        file: file.path,
        description: `Cryptographic or TLS transport settings altered: ${file.path}`,
        hint: 'Encryption parameters changed -> review channel encryption coverage',
        isSecuritySensitive: true,
      });
    }

    if (
      patchText.includes('secret') ||
      patchText.includes('api_key') ||
      patchText.includes('apikey') ||
      patchText.includes('password') ||
      patchText.includes('token')
    ) {
      addSignal(signalMap, {
        type: 'secret-handling-modified',
        category: 'security',
        file: file.path,
        description: `Credential or secret handling modified: ${file.path}`,
        hint: 'Secret or credential references altered -> verify secrets are not exposed in plaintext',
        isSecuritySensitive: true,
      });
    }
  }

  // Deterministically sort signals by category -> type -> file
  const signals = Array.from(signalMap.values());
  signals.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.file.localeCompare(b.file);
  });

  return signals;
}

function addSignal(
  map: Map<string, EngineeringSignal>,
  signal: {
    type: EngineeringSignalType;
    category: EngineeringSignalCategory;
    file: string;
    description: string;
    hint: string;
    isSecuritySensitive: boolean;
  }
): void {
  const id = generateSignalId(signal.file, signal.type);
  if (!map.has(id)) {
    map.set(id, { id, ...signal });
  }
}
