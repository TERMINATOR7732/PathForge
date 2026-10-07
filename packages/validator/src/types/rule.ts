import { Finding, RuleCategory, Severity } from '@pathforge/shared';
import { Environment } from '@pathforge/core';

export interface ValidationContext {
  environment: Environment;
  options?: {
    strict?: boolean;
    allowedRules?: string[];
    ignoredRules?: string[];
    customParams?: Record<string, unknown>;
  };
}

export interface ValidationRule {
  readonly id: string;
  readonly name: string;
  readonly category: RuleCategory;
  readonly defaultSeverity: Severity;
  readonly description: string;
  readonly enabledByDefault: boolean;

  evaluate(context: ValidationContext): Finding[];
}
