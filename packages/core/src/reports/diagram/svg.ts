import { Environment } from '../../domain/environment.js';

export interface SvgExportOptions {
  includeTitle?: boolean;
}

/**
 * Generates a clean, standalone vector SVG architecture diagram
 * directly from the authoritative Environment domain graph.
 *
 * Preserves security semantics:
 * - ALLOW (green/blue) vs DENY (dashed red with [DENY] marker)
 * - Transport encryption indicators ([TLS])
 * - Node zones, names, and service listening ports
 */
export function exportEnvironmentAsSvg(
  environment: Environment,
  options: SvgExportOptions = {}
): string {
  const nodes = environment.getNodes();
  const edges = environment.getEdges();

  const nodeWidth = 150;
  const nodeHeight = 64;

  // Compute bounding box
  let minX = 0;
  let minY = 0;
  let maxX = 800;
  let maxY = 500;

  if (nodes.length > 0) {
    minX = Math.min(...nodes.map((n) => n.position.x));
    minY = Math.min(...nodes.map((n) => n.position.y));
    maxX = Math.max(...nodes.map((n) => n.position.x + nodeWidth));
    maxY = Math.max(...nodes.map((n) => n.position.y + nodeHeight));
  }

  const padding = 80;
  const viewBoxX = minX - padding;
  const viewBoxY = minY - padding;
  const viewBoxWidth = Math.max(maxX - minX + padding * 2, 600);
  const viewBoxHeight = Math.max(maxY - minY + padding * 2, 400);

  const parts: string[] = [];

  // XML Declaration and root svg
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}" width="100%" height="100%" style="background-color: #0d0f12; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;">`
  );

  // Markers in defs
  parts.push(`  <defs>
    <marker id="arrow-allow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#3fb950" />
    </marker>
    <marker id="arrow-deny" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#f85149" />
    </marker>
    <marker id="arrow-default" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#58a6ff" />
    </marker>
  </defs>`);

  // Background rect
  parts.push(
    `  <rect x="${viewBoxX}" y="${viewBoxY}" width="${viewBoxWidth}" height="${viewBoxHeight}" fill="#0d0f12" />`
  );

  // Optional Title
  if (options.includeTitle !== false) {
    parts.push(
      `  <text x="${viewBoxX + 24}" y="${viewBoxY + 32}" fill="#e6edf3" font-size="14" font-weight="bold">${escapeXml(environment.name)}</text>`
    );
    parts.push(
      `  <text x="${viewBoxX + 24}" y="${viewBoxY + 48}" fill="#7d8590" font-size="10">PathForge Architecture Diagram · Generated Deterministically</text>`
    );
  }

  // 1. Draw Edges
  parts.push('  <!-- Edges -->');
  for (const edge of edges) {
    const sourceNode = environment.getNode(edge.source);
    const targetNode = environment.getNode(edge.target);
    if (!sourceNode || !targetNode) continue;

    const x1 = sourceNode.position.x + nodeWidth / 2;
    const y1 = sourceNode.position.y + nodeHeight / 2;
    const x2 = targetNode.position.x + nodeWidth / 2;
    const y2 = targetNode.position.y + nodeHeight / 2;

    const isDeny = edge.access === 'deny';
    const isEncrypted = edge.encrypted;

    const strokeColor = isDeny ? '#f85149' : isEncrypted ? '#3fb950' : '#58a6ff';
    const markerId = isDeny ? 'arrow-deny' : isEncrypted ? 'arrow-allow' : 'arrow-default';
    const dashArray = isDeny ? 'stroke-dasharray="6,4"' : '';

    parts.push(
      `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="2" ${dashArray} marker-end="url(#${markerId})" />`
    );

    // Midpoint label
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 - 8;

    const labelText = isDeny
      ? `[DENY] ${edge.protocol}:${edge.ports}`
      : `${edge.protocol}:${edge.ports}${isEncrypted ? ' [TLS]' : ''}`;

    const labelBg = isDeny ? '#381619' : '#161b22';
    const labelColor = isDeny ? '#f85149' : '#abb2bf';

    const textWidth = Math.max(labelText.length * 6.5 + 8, 50);

    parts.push(
      `  <rect x="${midX - textWidth / 2}" y="${midY - 8}" width="${textWidth}" height="14" rx="3" fill="${labelBg}" stroke="${strokeColor}" stroke-width="0.75" />`
    );
    parts.push(
      `  <text x="${midX}" y="${midY + 2}" fill="${labelColor}" font-size="8.5" font-weight="bold" text-anchor="middle">${escapeXml(labelText)}</text>`
    );
  }

  // 2. Draw Nodes
  parts.push('  <!-- Nodes -->');
  for (const node of nodes) {
    const x = node.position.x;
    const y = node.position.y;

    const zone = node.zone ?? 'internal';
    const zoneColor =
      zone === 'public'
        ? '#f85149'
        : zone === 'dmz'
        ? '#d29922'
        : zone === 'restricted'
        ? '#a371f7'
        : '#58a6ff';

    // Node body rect
    parts.push(
      `  <rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="6" fill="#161b24" stroke="#30363d" stroke-width="1.5" />`
    );

    // Zone top indicator bar
    parts.push(
      `  <rect x="${x}" y="${y}" width="${nodeWidth}" height="3" rx="1.5" fill="${zoneColor}" />`
    );

    // Zone pill
    parts.push(
      `  <text x="${x + 8}" y="${y + 16}" fill="${zoneColor}" font-size="8" font-weight="bold" text-transform="uppercase">${escapeXml(zone)}</text>`
    );

    // Node name
    parts.push(
      `  <text x="${x + 8}" y="${y + 34}" fill="#ffffff" font-size="11" font-weight="bold">${escapeXml(truncate(node.name, 18))}</text>`
    );

    // Service / Port / Type details
    const detail = node.service?.port
      ? `${node.type} :${node.service.port}`
      : node.type;

    parts.push(
      `  <text x="${x + 8}" y="${y + 50}" fill="#7d8590" font-size="9">${escapeXml(detail)}</text>`
    );
  }

  parts.push('</svg>');
  return parts.join('\n');
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
