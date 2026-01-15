/**
 * Captcha Service - INTENTIONALLY DISABLED FOR BETA
 * 
 * This service is a no-op stub to reduce friction for beta users.
 * Full captcha protection (hCaptcha/reCAPTCHA) will be implemented post-beta.
 * 
 * May be referenced in auth flows but always returns success.
 */
export async function verifyCaptcha(_token?: string, _ipAddress?: string): Promise<boolean> {
    // Always returns true - captcha disabled for beta
    return true;
}

export const captchaService = {
    verify: async (_token?: string, _ipAddress?: string) => ({ success: true }),
    isEnabled: () => false,
};
