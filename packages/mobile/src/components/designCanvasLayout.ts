interface Insets { left: number; right: number; top: number; bottom: number; }

/** Keep the controls' scale while letting iOS use the whole safe viewport. */
export function getDesignCanvasLayout(width: number, height: number, insets: Insets, adaptiveWidth: boolean, uiScale = 1, overflowScale = 1) {
  const horizontal = Math.max(insets.left, insets.right, 8);
  const vertical = Math.max(insets.top, insets.bottom, 4);
  const paddingLeft = adaptiveWidth ? Math.max(insets.left, 8) : horizontal;
  const paddingRight = adaptiveWidth ? Math.max(insets.right, 8) : horizontal;
  const paddingTop = adaptiveWidth ? Math.max(insets.top, 4) : vertical;
  const paddingBottom = adaptiveWidth ? Math.max(insets.bottom, 4) : vertical;
  const viewportWidth = Math.max(1, width - paddingLeft - paddingRight);
  const viewportHeight = Math.max(1, height - paddingTop - paddingBottom);
  const scale = Math.min(viewportWidth / 844, viewportHeight / 390) * Math.min(uiScale, overflowScale, 1);
  return {
    paddingLeft, paddingRight, paddingTop, paddingBottom,
    viewportWidth, viewportHeight, scale,
    canvasWidth: adaptiveWidth ? viewportWidth / scale : 844,
    canvasHeight: 390,
  };
}
