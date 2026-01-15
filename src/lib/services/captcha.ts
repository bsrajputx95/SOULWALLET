// Stub file - captcha disabled for beta
export async function verifyCaptcha(_token?: string, _ipAddress?: string): Promise<boolean> {
    // Always returns true - captcha disabled for beta
    return true;
}

export const captchaService = {
    verify: async (_token?: string, _ipAddress?: string) => ({ success: true }),
    isEnabled: () => false,
};
