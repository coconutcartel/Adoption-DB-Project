import type { Animal } from '../types'
import { internationalPhoneDigits, localPhoneDisplay } from './phone'

export function formatAge(animal: Animal) {
  if (!animal.age_value || !animal.age_unit) return 'Age unknown'
  const unit = animal.age_value === 1 ? animal.age_unit.replace(/s$/, '') : animal.age_unit
  return `${animal.age_value} ${unit}`
}

export function formatSpecies(animal: Animal) {
  if (animal.species === 'other' && animal.other_species) return animal.other_species
  return animal.species.charAt(0).toUpperCase() + animal.species.slice(1)
}

export function prettyValue(value: string | null | undefined) {
  if (!value) return 'Unknown'
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function shareUrl(animalId: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/share/${animalId}`
}

export function contactPhoneDisplay(phone: string, country: string) {
  return localPhoneDisplay(phone, country)
}

export function phoneLink(phone: string, country: string) {
  const digits = internationalPhoneDigits(phone, country)
  return digits ? `tel:+${digits}` : `tel:${phone}`
}

export function whatsappLink(phone: string, animalName: string, animalId: string, country: string) {
  const digits = internationalPhoneDigits(phone, country)
  const text = encodeURIComponent(`Hi, I'm interested in adopting ${animalName}. I found the listing on rehome.\n\n${shareUrl(animalId)}`)
  return `https://wa.me/${digits}?text=${text}`
}
