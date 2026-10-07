export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

export interface ConnectionDraft {
  sourceNodeId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}
