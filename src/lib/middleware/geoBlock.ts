import { TRPCError } from '@trpc/server'
import axios from 'axios'
import { logger } from '../logger'
import { getRedisClient } from '../redis'

type IpApiResponse = {
  country_code?: string
}

function normalizeCountryCode(code: unknown): string | null {
  if (typeof code !== 'string') return null
  const trimmed = code.trim().toUpperCase()
  if (trimmed.length !== 2) return null
  return trimmed
}

function getBlockedCountries(): string[] {
  try {
    const blocked = require('../../../constants/geoBlocked.json') as unknown
    if (Array.isArray(blocked)) return blocked.filter((v) => typeof v === 'string').map((v) => v.toUpperCase())
    return []
  } catch {
    return []
  }
}

export async function geoBlockMiddleware(ip: string): Promise<void> {
  if (process.env.GEO_BLOCKING_ENABLED === 'false') return
  if (!ip || ip === 'unknown') return

  const blockedCountries = getBlockedCountries()
  if (blockedCountries.length === 0) return

  const cacheKey = `geo:${ip}`
  const redis = getRedisClient()

  try {
    if (redis) {
      const cached = await redis.get(cacheKey)
      const cachedCountry = normalizeCountryCode(cached)
      if (cachedCountry) {
        if (blockedCountries.includes(cachedCountry)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Service unavailable in your region' })
        }
        return
      }
    }
  } catch (err) {
    logger.warn('[GeoBlock] Cache read failed', { error: err instanceof Error ? err.message : String(err) })
  }

  try {
    const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`
    const timeoutMs = Number.parseInt(process.env.EXTERNAL_CALL_TIMEOUT || '5000', 10)
    const res = await axios.get<IpApiResponse>(url, {
      timeout: Number.isFinite(timeoutMs) ? timeoutMs : 5000,
      validateStatus: () => true,
    })

    const countryCode = normalizeCountryCode(res.data?.country_code)
    if (countryCode) {
      try {
        if (redis) await redis.set(cacheKey, countryCode, 'EX', 60 * 60 * 24)
      } catch (err) {
        logger.warn('[GeoBlock] Cache write failed', { error: err instanceof Error ? err.message : String(err) })
      }

      if (blockedCountries.includes(countryCode)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Service unavailable in your region' })
      }
    }
  } catch (err) {
    if (err instanceof TRPCError) throw err
    logger.warn('[GeoBlock] Lookup failed (fail-open)', { error: err instanceof Error ? err.message : String(err) })
  }
}

