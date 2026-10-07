import { ValidationRule } from '../types/rule.js';
import { RuleCategory, Severity } from '@pathforge/shared';

export class RuleRegistry {
  private readonly rules: Map<string, ValidationRule> = new Map();
  private readonly disabledRules: Set<string> = new Set();

  register(rule: ValidationRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Validation rule with id '${rule.id}' is already registered`);
    }
    this.rules.set(rule.id, rule);
    if (!rule.enabledByDefault) {
      this.disabledRules.add(rule.id);
    }
  }

  unregister(ruleId: string): boolean {
    this.disabledRules.delete(ruleId);
    return this.rules.delete(ruleId);
  }

  getRule(ruleId: string): ValidationRule | undefined {
    return this.rules.get(ruleId);
  }

  hasRule(ruleId: string): boolean {
    return this.rules.has(ruleId);
  }

  getAllRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  getActiveRules(): ValidationRule[] {
    return this.getAllRules().filter((rule) => !this.disabledRules.has(rule.id));
  }

  getRulesByCategory(category: RuleCategory): ValidationRule[] {
    return this.getAllRules().filter((rule) => rule.category === category);
  }

  getRulesBySeverity(severity: Severity): ValidationRule[] {
    return this.getAllRules().filter((rule) => rule.defaultSeverity === severity);
  }

  enableRule(ruleId: string): void {
    if (!this.rules.has(ruleId)) {
      throw new Error(`Cannot enable unregistered rule '${ruleId}'`);
    }
    this.disabledRules.delete(ruleId);
  }

  disableRule(ruleId: string): void {
    if (!this.rules.has(ruleId)) {
      throw new Error(`Cannot disable unregistered rule '${ruleId}'`);
    }
    this.disabledRules.add(ruleId);
  }

  isRuleEnabled(ruleId: string): boolean {
    return this.rules.has(ruleId) && !this.disabledRules.has(ruleId);
  }

  clear(): void {
    this.rules.clear();
    this.disabledRules.clear();
  }
}
