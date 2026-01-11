import axios from 'axios'
import { logger } from '../logger'

export type CaptchaProvider = 'hcaptcha' | 'recaptcha'

export function getCaptchaConfig(): {
  enabled: boolean
  provider: CaptchaProvider
  siteKey?: string
} {
  const enabled = process.env.CAPTCHA_ENABLED === 'true'
  const provider = (process.env.CAPTCHA_PROVIDER || 'hcaptcha').toLowerCase() === 'recaptcha' ? 'recaptcha' : 'hcaptcha'
  const siteKey = provider === 'hcaptcha' ? process.env.HCAPTCHA_SITE_KEY : process.env.RECAPTCHA_SITE_KEY

  if (siteKey) {
    return { enabled, provider, siteKey }
  }
  return { enabled, provider }
}

export async function verifyCaptcha(token: string, remoteIp?: string): Promise<boolean> {
  const cfg = getCaptchaConfig()
  if (!cfg.enabled) return true
  if (!token || token.trim().length < 10) return false

  try {
    if (cfg.provider === 'hcaptcha') {
      const secret = process.env.HCAPTCHA_SECRET_KEY
      if (!secret) return false

      const res = await axios.post(
        'https://hcaptcha.com/siteverify',
        new URLSearchParams({
          response: token,
          secret,
          ...(remoteIp ? { remoteip: remoteIp } : {}),
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 }
      )
      return !!res.data?.success
    }

    const secret = process.env.RECAPTCHA_SECRET_KEY
    if (!secret) return false
    const res = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      new URLSearchParams({
        response: token,
        secret,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 }
    )
    return !!res.data?.success
  } catch (error: any) {
    // Network error = fail closed for security
    logger.error('CAPTCHA verification network error', {
      error: error.message,
      provider: cfg.provider
    })
    return false
  }
}

