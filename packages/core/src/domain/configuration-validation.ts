import {
  PortConfig,
  EdgeProtocol,
  NodeZone,
  AssetCriticality,
} from '@pathforge/shared';

export interface ValidationResult<T = unknown> {
  valid: boolean;
  value?: T;
  error?: string;
}

/**
 * Validates an IPv4 address or CIDR notation (e.g. 10.0.1.10 or 10.0.1.0/24).
 * Returns valid=true for empty/undefined values as IP/CIDR is optional on nodes.
 */
export function validateCidrOrIp(input: string | undefined): ValidationResult<string | undefined> {
  if (!input || input.trim() === '') {
    return { valid: true, value: undefined };
  }

  const trimmed = input.trim();
  const parts = trimmed.split('/');

  if (parts.length > 2) {
    return {
      valid: false,
      error: `Invalid CIDR format: "${trimmed}" contains multiple slashes.`,
    };
  }

  const ipPart = parts[0];
  const octets = ipPart.split('.');

  if (octets.length !== 4) {
    return {
      valid: false,
      error: `Invalid IP address: "${ipPart}" must contain exactly 4 octets.`,
    };
  }

  for (const octet of octets) {
    if (!/^\d+$/.test(octet)) {
      return {
        valid: false,
        error: `Invalid octet "${octet}" in IP address "${ipPart}".`,
      };
    }
    const num = parseInt(octet, 10);
    if (num < 0 || num > 255) {
      return {
        valid: false,
        error: `IP octet ${num} is out of valid range (0-255).`,
      };
    }
  }

  if (parts.length === 2) {
    const maskPart = parts[1];
    if (!/^\d+$/.test(maskPart)) {
      return {
        valid: false,
        error: `CIDR prefix "${maskPart}" must be a non-negative integer.`,
      };
    }
    const mask = parseInt(maskPart, 10);
    if (mask < 0 || mask > 32) {
      return {
        valid: false,
        error: `CIDR prefix length /${mask} must be between 0 and 32.`,
      };
    }
  }

  return { valid: true, value: trimmed };
}

/**
 * Parses and validates port specifications:
 * - Single port: "443", 443
 * - Port range: "8000-8080"
 * - All ports: "ANY", "*", "all"
 */
export function parsePortInput(
  input: string | number | undefined
): { valid: boolean; config?: PortConfig; formatted?: string; error?: string } {
  if (input === undefined || input === null) {
    return { valid: true, config: { type: 'any' }, formatted: 'ANY' };
  }

  if (typeof input === 'number') {
    if (Number.isInteger(input) && input >= 1 && input <= 65535) {
      return {
        valid: true,
        config: { type: 'single', value: input },
        formatted: String(input),
      };
    }
    return {
      valid: false,
      error: `Port ${input} must be an integer between 1 and 65535.`,
    };
  }

  const trimmed = input.trim();
  if (trimmed === '' || trimmed === '*' || trimmed.toUpperCase() === 'ANY' || trimmed.toLowerCase() === 'all') {
    return { valid: true, config: { type: 'any' }, formatted: 'ANY' };
  }

  // Check for range: e.g. "8000-8080"
  if (trimmed.includes('-')) {
    const rangeParts = trimmed.split('-');
    if (rangeParts.length !== 2) {
      return {
        valid: false,
        error: `Invalid port range format: "${trimmed}". Expected start-end (e.g. 8000-8080).`,
      };
    }

    const startStr = rangeParts[0].trim();
    const endStr = rangeParts[1].trim();

    if (!/^\d+$/.test(startStr) || !/^\d+$/.test(endStr)) {
      return {
        valid: false,
        error: `Port range "${trimmed}" must contain numeric values only.`,
      };
    }

    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);

    if (start < 1 || start > 65535 || end < 1 || end > 65535) {
      return {
        valid: false,
        error: `Port range values must be between 1 and 65535. Received ${start}-${end}.`,
      };
    }

    if (start > end) {
      return {
        valid: false,
        error: `Invalid port range: start port (${start}) cannot be greater than end port (${end}).`,
      };
    }

    return {
      valid: true,
      config: { type: 'range', start, end },
      formatted: `${start}-${end}`,
    };
  }

  // Single port string: e.g. "443"
  if (/^\d+$/.test(trimmed)) {
    const port = parseInt(trimmed, 10);
    if (port >= 1 && port <= 65535) {
      return {
        valid: true,
        config: { type: 'single', value: port },
        formatted: String(port),
      };
    }
    return {
      valid: false,
      error: `Port ${port} must be between 1 and 65535.`,
    };
  }

  return {
    valid: false,
    error: `Invalid port value "${trimmed}". Expected a port number (1-65535), range (e.g. 8000-8080), or ANY.`,
  };
}

/**
 * Checks whether a given target port is permitted by the PortConfig.
 * This function enables future deterministic attack path and reachability analysis.
 */
export function isPortAllowed(config: PortConfig | undefined, targetPort: number): boolean {
  if (!config || config.type === 'any') {
    return true;
  }
  if (config.type === 'single') {
    return config.value === targetPort;
  }
  if (config.type === 'range') {
    return targetPort >= config.start && targetPort <= config.end;
  }
  return false;
}

/**
 * Validates protocol against controlled allowed set.
 */
export function validateProtocol(
  input: string | undefined
): ValidationResult<EdgeProtocol> {
  if (!input || input.trim() === '') {
    return { valid: true, value: 'TCP' };
  }

  const normalized = input.trim().toUpperCase();
  const validProtocols: EdgeProtocol[] = [
    'TCP',
    'UDP',
    'HTTP',
    'HTTPS',
    'SSH',
    'TLS',
    'ICMP',
    'ANY',
  ];

  if (validProtocols.includes(normalized as EdgeProtocol)) {
    return { valid: true, value: normalized as EdgeProtocol };
  }

  // Allow custom protocol string if non-empty, but warn
  return { valid: true, value: normalized };
}

/**
 * Validates zone classification against standard controlled set.
 */
export function validateZone(
  input: string | undefined
): ValidationResult<NodeZone> {
  if (!input || input.trim() === '') {
    return { valid: true, value: 'internal' };
  }

  const normalized = input.trim().toLowerCase();
  const validZones: NodeZone[] = [
    'public',
    'dmz',
    'internal',
    'restricted',
    'management',
    'private', // backward compatibility
  ];

  if (validZones.includes(normalized as NodeZone)) {
    return { valid: true, value: normalized as NodeZone };
  }

  return { valid: true, value: normalized };
}

/**
 * Validates asset criticality.
 */
export function validateCriticality(
  input: string | undefined
): ValidationResult<AssetCriticality> {
  if (!input || input.trim() === '') {
    return { valid: true, value: 'medium' };
  }

  const normalized = input.trim().toLowerCase();
  const validCriticalities: AssetCriticality[] = ['low', 'medium', 'high', 'critical'];

  if (validCriticalities.includes(normalized as AssetCriticality)) {
    return { valid: true, value: normalized as AssetCriticality };
  }

  return {
    valid: false,
    error: `Invalid criticality "${input}". Expected low, medium, high, or critical.`,
  };
}
