import { VALID_SOLANA_ADDRESSES } from '../utils/test-fixtures'

describe('birdeyeData.getTokenPriceUSD', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    delete process.env.BIRDEYE_API_KEY
  })

  it('returns null when API key is missing', async () => {
    const create = jest.fn(() => ({ get: jest.fn() }))

    jest.doMock('axios', () => ({
      __esModule: true,
      default: { create },
      create,
    }))

    const { birdeyeData } = await import('../../src/lib/services/birdeyeData')

    const price = await birdeyeData.getTokenPriceUSD(VALID_SOLANA_ADDRESSES.SOL_MINT)
    expect(price).toBeNull()
  })

  it('returns parsed price and caches it', async () => {
    process.env.BIRDEYE_API_KEY = 'test-key'

    const get = jest.fn().mockResolvedValue({ data: { data: { value: 12.34 } } })
    const create = jest.fn(() => ({ get }))

    jest.doMock('axios', () => ({
      __esModule: true,
      default: { create },
      create,
    }))

    const { birdeyeData } = await import('../../src/lib/services/birdeyeData')

    const mint = VALID_SOLANA_ADDRESSES.SOL_MINT
    const price1 = await birdeyeData.getTokenPriceUSD(mint)
    const price2 = await birdeyeData.getTokenPriceUSD(mint)

    expect(price1).toBe(12.34)
    expect(price2).toBe(12.34)
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('returns null for invalid response shape', async () => {
    process.env.BIRDEYE_API_KEY = 'test-key'

    const get = jest.fn().mockResolvedValue({ data: { ok: true, data: { value: 'nope' } } })
    const create = jest.fn(() => ({ get }))

    jest.doMock('axios', () => ({
      __esModule: true,
      default: { create },
      create,
    }))

    const { birdeyeData } = await import('../../src/lib/services/birdeyeData')

    const price = await birdeyeData.getTokenPriceUSD(VALID_SOLANA_ADDRESSES.SOL_MINT)
    expect(price).toBeNull()
  })
})

