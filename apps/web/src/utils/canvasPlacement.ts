/**
 * Canvas Node Placement Utility
 *
 * Computes non-overlapping positions for newly created infrastructure nodes
 * based on existing node geometry and canvas visible space.
 */

export const NODE_CANVAS_WIDTH = 186;
export const NODE_CANVAS_HEIGHT = 80;

export interface Position {
  x: number;
  y: number;
}

export interface NodeWithPosition {
  position: Position;
}

/**
 * Checks whether two node bounding boxes overlap with reasonable margin.
 */
export function doNodesOverlap(
  pos1: Position,
  pos2: Position,
  width: number = NODE_CANVAS_WIDTH,
  height: number = NODE_CANVAS_HEIGHT
): boolean {
  const horizontalOverlap = Math.abs(pos1.x - pos2.x) < width * 0.75;
  const verticalOverlap = Math.abs(pos1.y - pos2.y) < height * 0.75;
  return horizontalOverlap && verticalOverlap;
}

/**
 * Computes a sensible, non-overlapping canvas position for a newly created node.
 * If the preferred position is clear, it is used immediately.
 * If occupied, it tests cascading offsets and grid slots around the preferred location.
 */
export function getNonOverlappingPosition(
  existingNodes: readonly NodeWithPosition[],
  preferredPos: Position = { x: 300, y: 250 },
  options?: {
    stepX?: number;
    stepY?: number;
    maxCascade?: number;
  }
): Position {
  const stepX = options?.stepX ?? 36;
  const stepY = options?.stepY ?? 28;
  const maxCascade = options?.maxCascade ?? 10;

  const isOccupied = (p: Position): boolean => {
    return existingNodes.some((node) => doNodesOverlap(p, node.position));
  };

  // If preferred position is completely clear, use it directly
  if (!isOccupied(preferredPos)) {
    return { x: Math.round(preferredPos.x), y: Math.round(preferredPos.y) };
  }

  // 1. Try gentle cascading diagonal offsets (staggered stack)
  for (let i = 1; i <= maxCascade; i++) {
    const candidate: Position = {
      x: preferredPos.x + i * stepX,
      y: preferredPos.y + i * stepY,
    };
    if (!isOccupied(candidate)) {
      return { x: Math.round(candidate.x), y: Math.round(candidate.y) };
    }
  }

  // 2. Try clean grid placements in nearby workspace
  const gridSpacingX = NODE_CANVAS_WIDTH + 24;
  const gridSpacingY = NODE_CANVAS_HEIGHT + 24;

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const candidate: Position = {
        x: preferredPos.x + col * gridSpacingX,
        y: preferredPos.y + row * gridSpacingY,
      };
      if (!isOccupied(candidate)) {
        return { x: Math.round(candidate.x), y: Math.round(candidate.y) };
      }
    }
  }

  // 3. Fallback: deterministic offset based on existing node count
  const fallback = (existingNodes.length % 8) * 32;
  return {
    x: Math.round(preferredPos.x + fallback),
    y: Math.round(preferredPos.y + fallback),
  };
}
