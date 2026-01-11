import { validateDateOfBirth, validatePhoneNumber } from '../../src/lib/validation'

describe('User profile validation', () => {
  it('rejects invalid phone numbers', () => {
    expect(validatePhoneNumber('not-a-phone').isValid).toBe(false)
    expect(validatePhoneNumber('123').isValid).toBe(false)
  })

  it('accepts valid phone numbers', () => {
    expect(validatePhoneNumber('+14155552671').isValid).toBe(true)
  })

  it('accepts empty dateOfBirth', () => {
    expect(validateDateOfBirth('').isValid).toBe(true)
  })

  it('rejects underage dateOfBirth', () => {
    const dob = new Date(Date.now() - 10 * 365.25 * 24 * 60 * 60 * 1000).toISOString()
    expect(validateDateOfBirth(dob).isValid).toBe(false)
  })

  it('rejects non-ISO dateOfBirth format', () => {
    expect(validateDateOfBirth('01/01/2000').isValid).toBe(false)
  })

  it('accepts valid dateOfBirth', () => {
    const dob = new Date(Date.now() - 20 * 365.25 * 24 * 60 * 60 * 1000).toISOString()
    expect(validateDateOfBirth(dob).isValid).toBe(true)
  })
})
