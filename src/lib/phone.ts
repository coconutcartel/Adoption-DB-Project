import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js'

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const availableCountries = getCountries()

function normalise(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

const aliases: Record<string, CountryCode> = {
  uk: 'GB',
  unitedkingdom: 'GB',
  greatbritain: 'GB',
  england: 'GB',
  usa: 'US',
  us: 'US',
  unitedstates: 'US',
  unitedstatesofamerica: 'US',
  uae: 'AE',
  unitedarabemirates: 'AE',
  southkorea: 'KR',
  northkorea: 'KP',
  russia: 'RU',
  vietnam: 'VN',
}

export const countryOptions = availableCountries
  .map((code) => ({
    code,
    name: regionNames.of(code) || code,
    callingCode: getCountryCallingCode(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

export function countryCodeForName(countryName: string): CountryCode | undefined {
  const raw = countryName.trim()
  if (!raw) return undefined
  const upper = raw.toUpperCase() as CountryCode
  if (availableCountries.includes(upper)) return upper

  const key = normalise(raw)
  if (aliases[key]) return aliases[key]
  return countryOptions.find((country) => normalise(country.name) === key)?.code
}

export function countryCallingCode(countryName: string) {
  const code = countryCodeForName(countryName)
  return code ? getCountryCallingCode(code) : ''
}

export function localPhoneNumber(phone: string, countryName: string) {
  const input = phone.trim()
  if (!input) return ''
  const countryCode = countryCodeForName(countryName)

  try {
    const parsed = parsePhoneNumberFromString(input, countryCode)
    if (parsed?.nationalNumber) return parsed.nationalNumber
  } catch {
    // Fall back to digit-only cleanup below.
  }

  let digits = input.replace(/\D/g, '')
  if (!digits) return ''
  if (countryCode && (input.startsWith('+') || input.startsWith('00'))) {
    const callingCode = getCountryCallingCode(countryCode)
    if (digits.startsWith(callingCode)) digits = digits.slice(callingCode.length)
    else if (digits.startsWith(`00${callingCode}`)) digits = digits.slice(callingCode.length + 2)
  }
  return digits
}

export function internationalPhoneDigits(phone: string, countryName: string) {
  const input = phone.trim()
  if (!input) return ''
  const countryCode = countryCodeForName(countryName)

  try {
    const parsed = parsePhoneNumberFromString(input, countryCode)
    if (parsed?.number) return parsed.number.replace(/\D/g, '')
  } catch {
    // Fall back to concatenating calling code + local digits.
  }

  const local = localPhoneNumber(input, countryName)
  const callingCode = countryCallingCode(countryName)
  return callingCode ? `${callingCode}${local}` : local
}

export function localPhoneDisplay(phone: string, countryName: string) {
  return localPhoneNumber(phone, countryName) || phone.trim()
}
