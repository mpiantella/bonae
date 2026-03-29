/** Deep-merge plain objects; arrays are replaced when override provides an array. */
export function mergeDeep<T>(base: T, override: unknown): T {
  if (override === undefined || override === null) {
    return base;
  }
  if (typeof override !== 'object' || override === null) {
    return override as T;
  }
  if (Array.isArray(override)) {
    return override as T;
  }
  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    return override as T;
  }
  const b = base as Record<string, unknown>;
  const o = override as Record<string, unknown>;
  const out: Record<string, unknown> = { ...b };
  for (const key of Object.keys(o)) {
    const ov = o[key];
    const bv = b[key];
    if (
      ov !== undefined &&
      ov !== null &&
      typeof ov === 'object' &&
      !Array.isArray(ov) &&
      typeof bv === 'object' &&
      bv !== null &&
      !Array.isArray(bv)
    ) {
      out[key] = mergeDeep(bv, ov) as unknown;
    } else if (ov !== undefined) {
      out[key] = ov;
    }
  }
  return out as T;
}
