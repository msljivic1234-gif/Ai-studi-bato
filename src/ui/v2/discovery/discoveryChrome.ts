/** A fixed compact FULL detent. Only transforms/opacity change while the list scrolls. */
export function chromeJoin(sheetTop: number, compactTop: number, capsules: number): number {
  'worklet';
  if (!Number.isFinite(sheetTop) || capsules <= 0) return 0;
  // Android detents settle at fractional layout pixels. Saturate the last dp for both paint and accessibility.
  if (sheetTop <= compactTop + 1) return 1;
  return Math.max(0, Math.min(1, (compactTop + capsules - sheetTop) / capsules));
}

/** The native list owns the offset, including restore. At zero all capsules return before Gorhom lowers the sheet. */
export function capsuleCollapse(offset: number, capsules: number): number {
  'worklet';
  if (!Number.isFinite(offset) || offset <= 0 || capsules <= 0) return 0;
  return offset >= capsules - 1 ? capsules : Math.max(0, offset);
}
