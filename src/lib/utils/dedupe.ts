/**
 * Field Deduplication Utility
 * Removes duplicate items from arrays for API response optimization
 */

/**
 * Deduplicate items by JSON stringification
 * Use for simple objects where all fields should be compared
 */
export function deduplicateFields<T>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter(item => {
        const key = JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Deduplicate items by a specific key field
 * More efficient for large objects with unique identifiers
 */
export function deduplicateByKey<T, K extends keyof T>(items: T[], key: K): T[] {
    const seen = new Set<T[K]>();
    return items.filter(item => {
        const value = item[key];
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
    });
}

/**
 * Deduplicate and limit array size
 * Useful for paginated responses
 */
export function deduplicateAndLimit<T, K extends keyof T>(
    items: T[],
    key: K,
    limit: number
): T[] {
    const unique = deduplicateByKey(items, key);
    return unique.slice(0, limit);
}
