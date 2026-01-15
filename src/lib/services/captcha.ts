// Stub file - captcha disabled for beta
export async function verifyCaptcha(_token?: string): Promise<boolean> {
    // Always returns true - captcha disabled for beta
    return true;
}

export const captchaService = {
    verify: async () => ({ success: true }),
    isEnabled: () => false,
};
