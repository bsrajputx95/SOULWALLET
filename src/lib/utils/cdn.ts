/**
 * CDN Helper Utility
 * Constructs CDN URLs for static assets when CDN is enabled
 */

const CDN_URL = process.env.CDN_URL || '';
const CDN_ENABLED = process.env.CDN_ENABLED === 'true';

/**
 * Get CDN URL for a static asset path
 * Returns original path if CDN is not configured
 */
export function getCdnUrl(path: string): string {
    if (!CDN_ENABLED || !CDN_URL) {
        return path;
    }

    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${CDN_URL}${normalizedPath}`;
}

/**
 * Get CDN URL for an image with size optimization
 * Supports query params for CDN-side image resizing
 */
export function getCdnImageUrl(
    path: string,
    options?: { width?: number; height?: number; quality?: number }
): string {
    const baseUrl = getCdnUrl(path);

    if (!CDN_ENABLED || !options) {
        return baseUrl;
    }

    const params = new URLSearchParams();
    if (options.width) params.set('w', options.width.toString());
    if (options.height) params.set('h', options.height.toString());
    if (options.quality) params.set('q', options.quality.toString());

    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Check if CDN is available and configured
 */
export function isCdnEnabled(): boolean {
    return CDN_ENABLED && !!CDN_URL;
}
