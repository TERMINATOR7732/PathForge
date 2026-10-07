export * from './pf001-public-database-exposure.js';
export * from './pf002-public-admin-exposure.js';
export * from './pf003-missing-security-boundary.js';
export * from './pf004-untrusted-to-internal.js';
export * from './pf005-excessive-trust-relationship.js';
export * from './pf006-invalid-topology.js';
export * from './pf007-overly-broad-access.js';
export * from './pf008-unencrypted-sensitive-communication.js';
export * from './pf009-service-connection-mismatch.js';

import { RuleRegistry } from '../registry/rule-registry.js';
import { PublicDatabaseExposureRule } from './pf001-public-database-exposure.js';
import { PublicAdminExposureRule } from './pf002-public-admin-exposure.js';
import { MissingSecurityBoundaryRule } from './pf003-missing-security-boundary.js';
import { UntrustedToInternalNetworkRule } from './pf004-untrusted-to-internal.js';
import { ExcessiveTrustRelationshipRule } from './pf005-excessive-trust-relationship.js';
import { InvalidTopologyRule } from './pf006-invalid-topology.js';
import { OverlyBroadAccessRule } from './pf007-overly-broad-access.js';
import { UnencryptedSensitiveCommunicationRule } from './pf008-unencrypted-sensitive-communication.js';
import { ServiceConnectionMismatchRule } from './pf009-service-connection-mismatch.js';

/**
 * Creates and registers all standard PathForge validation rules into a new registry.
 */
export function createDefaultRuleRegistry(): RuleRegistry {
  const registry = new RuleRegistry();
  registry.register(new PublicDatabaseExposureRule());
  registry.register(new PublicAdminExposureRule());
  registry.register(new MissingSecurityBoundaryRule());
  registry.register(new UntrustedToInternalNetworkRule());
  registry.register(new ExcessiveTrustRelationshipRule());
  registry.register(new InvalidTopologyRule());
  registry.register(new OverlyBroadAccessRule());
  registry.register(new UnencryptedSensitiveCommunicationRule());
  registry.register(new ServiceConnectionMismatchRule());
  return registry;
}
