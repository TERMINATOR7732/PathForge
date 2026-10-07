import { Environment } from '@pathforge/core';
import { Finding, ValidationResult, ValidationSummary } from '@pathforge/shared';
import { RuleRegistry } from '../registry/rule-registry.js';
import { ValidationContext } from '../types/rule.js';

export interface ValidatorEngineOptions {
  registry?: RuleRegistry;
  strict?: boolean;
  failOnSeverity?: 'critical' | 'high' | 'medium' | 'low';
}

export class ValidatorEngine {
  private readonly registry: RuleRegistry;
  private readonly defaultOptions: ValidatorEngineOptions;

  constructor(registry: RuleRegistry, defaultOptions: ValidatorEngineOptions = {}) {
    this.registry = registry;
    this.defaultOptions = defaultOptions;
  }

  evaluate(
    environment: Environment,
    contextOverrides: Partial<ValidationContext['options']> = {}
  ): ValidationResult {
    const context: ValidationContext = {
      environment,
      options: {
        strict: this.defaultOptions.strict ?? false,
        ...contextOverrides,
      },
    };

    const rules = this.registry.getActiveRules().filter((rule) => {
      if (
        context.options?.allowedRules &&
        !context.options.allowedRules.includes(rule.id)
      ) {
        return false;
      }
      if (
        context.options?.ignoredRules &&
        context.options.ignoredRules.includes(rule.id)
      ) {
        return false;
      }
      return true;
    });

    const findings: Finding[] = [];
    for (const rule of rules) {
      try {
        const ruleFindings = rule.evaluate(context);
        findings.push(...ruleFindings);
      } catch (err) {
        // Deterministic error capture: rule failure produces an error finding
        findings.push({
          id: `rule-error-${rule.id}-${Date.now()}`,
          ruleId: rule.id,
          severity: 'high',
          category: 'topology_anomaly',
          title: `Validation Rule Execution Failure: ${rule.name}`,
          description: `Internal error evaluating rule ${rule.id}: ${err instanceof Error ? err.message : String(err)}`,
          whyItMatters: 'A validation rule threw an unexpected exception during execution.',
          impact: 'Security posture evaluation might be incomplete.',
          affectedNodes: [],
          affectedEdges: [],
          recommendation: 'Check environment topology consistency and rule implementation.',
          remediation: 'Inspect topology nodes and rule requirements.',
        });
      }
    }

    const summary: ValidationSummary = {
      totalFindings: findings.length,
      criticalCount: findings.filter((f) => f.severity === 'critical').length,
      highCount: findings.filter((f) => f.severity === 'high').length,
      mediumCount: findings.filter((f) => f.severity === 'medium').length,
      lowCount: findings.filter((f) => f.severity === 'low').length,
      infoCount: findings.filter((f) => f.severity === 'info').length,
      passed: false,
    };

    const failSeverity = this.defaultOptions.failOnSeverity ?? 'high';
    if (failSeverity === 'critical') {
      summary.passed = summary.criticalCount === 0;
    } else if (failSeverity === 'high') {
      summary.passed = summary.criticalCount === 0 && summary.highCount === 0;
    } else if (failSeverity === 'medium') {
      summary.passed =
        summary.criticalCount === 0 &&
        summary.highCount === 0 &&
        summary.mediumCount === 0;
    } else {
      summary.passed = summary.totalFindings === 0;
    }

    return {
      environmentId: environment.id,
      evaluatedAt: new Date().toISOString(),
      findings,
      summary,
      rulesEvaluated: rules.length,
    };
  }
}
