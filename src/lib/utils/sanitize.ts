/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Sanitization utilities for API/tRPC responses.
 * - Converts BigInt → number (safe) or string (overflow)
 * - Handles circular references via WeakSet to avoid infinite loops
 * - Converts Map → plain object and Set → array
 * - Removes functions, stringifies symbols
 */

export function sanitizeBigInt<T>(value: T, visited: WeakSet<object> = new WeakSet()): T {
  if (value === null || value === undefined) return value;

  const t = typeof value;
  if (t === 'bigint') {
    const asNumber = Number(value);
    return (Number.isFinite(asNumber) ? asNumber : (value as unknown as bigint).toString()) as unknown as T;
  }
  if (t === 'symbol') return (value as symbol).toString() as unknown as T;
  if (t === 'function') return undefined as unknown as T;
  if (t !== 'object') return value; // string | number | boolean

  const obj = value as unknown as object;
  if (visited.has(obj)) return value; // circular reference detected
  visited.add(obj);

  if (value instanceof Date) return value as unknown as T;

  if (value instanceof Map) {
    const mapped: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      mapped[String(k)] = sanitizeBigInt(v as any, visited);
    }
    return mapped as unknown as T;
  }

  if (value instanceof Set) {
    return Array.from(value).map(v => sanitizeBigInt(v as any, visited)) as unknown as T;
  }

  if (Array.isArray(value)) {
    return (value as any[]).map(v => sanitizeBigInt(v, visited)) as unknown as T;
  }

  const cleaned: Record<string, unknown> = {};
  for (const key of Object.getOwnPropertyNames(obj)) {
    let prop: unknown;
    try {
      // @ts-ignore dynamic access
      prop = (obj as any)[key];
    } catch {
      continue; // skip getters that throw
    }
    cleaned[key] = sanitizeBigInt(prop, visited);
  }
  return cleaned as T;
}

/**
 * Converts arbitrary value to a finite number (fallback 0 on invalid / overflow).
 */
export function toSafeNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === 'string') {
    const parsed = parseFloat(v);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
