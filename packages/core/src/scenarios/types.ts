import { EnvironmentDefinition } from '@pathforge/shared';

export type ScenarioRiskLevel = 'hardened' | 'critical' | 'high' | 'chaos';

export interface ScenarioDefinition {
  readonly id: string;
  readonly name: string;
  readonly shortDescription: string;
  readonly purpose: string;
  readonly riskLevel: ScenarioRiskLevel;
  readonly riskLabel: string;
  readonly learningObjective: string;
  readonly topologyPreview: string;
  readonly definition: EnvironmentDefinition;
}
