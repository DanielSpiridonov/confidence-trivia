// Dimensions are in the existing safe design canvas, not physical screen pixels.
export function getHomeCardsLayout(width: number, height: number) {
  const gap = Math.max(9, Math.min(16, width * 0.025));
  const cardHeight = Math.min(300, Math.max(1, height));
  const cardWidth = Math.max(1, Math.min(208, cardHeight * 0.68, (width - gap * 2) / 3));
  return { cardWidth, cardHeight, gap, width: cardWidth * 3 + gap * 2 };
}
