import type { AnimalFilters } from '../types'

export interface SmartSearchParse {
  filters: Partial<AnimalFilters>
  chips: string[]
}

function stripPhrase(text: string, pattern: RegExp) {
  return text.replace(pattern, ' ')
}

export function parseAdoptionQuery(input: string): SmartSearchParse {
  let working = input.trim().toLowerCase()
  const filters: Partial<AnimalFilters> = {}
  const chips: string[] = []

  const set = <K extends keyof AnimalFilters>(key: K, value: AnimalFilters[K], label: string) => {
    filters[key] = value
    chips.push(label)
  }

  const cityMatch = working.match(/\b(?:in|near|around)\s+([a-z][a-z .'-]{1,40}?)(?=\s*[,.;]?\s*(?:that|who|which|and|with|good|friendly|sterilised|sterilized|spayed|neutered|vaccinated|dewormed|small|medium|large|male|female)\b|\s*[,.;!?]?\s*$)/)
  if (cityMatch?.[1]) {
    const city = cityMatch[1].trim().replace(/\s+/g, ' ')
    if (city.length > 1) {
      set('city', city, `Near ${city.replace(/\b\w/g, (c) => c.toUpperCase())}`)
      working = working.replace(cityMatch[0], ' ')
    }
  }

  if (/\b(dog|dogs|puppy|puppies|canine)\b/.test(working)) {
    set('species', 'dog', 'Dog')
    working = stripPhrase(working, /\b(dog|dogs|puppy|puppies|canine)\b/g)
  } else if (/\b(cat|cats|kitten|kittens|feline)\b/.test(working)) {
    set('species', 'cat', 'Cat')
    working = stripPhrase(working, /\b(cat|cats|kitten|kittens|feline)\b/g)
  }

  if (/\b(female|girl)\b/.test(working)) {
    set('sex', 'female', 'Female')
    working = stripPhrase(working, /\b(female|girl)\b/g)
  } else if (/\b(male|boy)\b/.test(working)) {
    set('sex', 'male', 'Male')
    working = stripPhrase(working, /\b(male|boy)\b/g)
  }

  if (/\bsmall\b/.test(working)) {
    set('size', 'small', 'Small')
    working = stripPhrase(working, /\bsmall\b/g)
  } else if (/\bmedium(?:[- ]sized)?\b/.test(working)) {
    set('size', 'medium', 'Medium')
    working = stripPhrase(working, /\bmedium(?:[- ]sized)?\b/g)
  } else if (/\b(large|big)\b/.test(working)) {
    set('size', 'large', 'Large')
    working = stripPhrase(working, /\b(large|big)\b/g)
  }

  const dogFriendly = /\b(good with dogs|dog[- ]friendly|friendly with dogs|can live with dogs)\b/
  const catFriendly = /\b(good with cats|cat[- ]friendly|friendly with cats|can live with cats)\b/
  const childFriendly = /\b(good with (children|kids)|child[- ]friendly|kid[- ]friendly|friendly with (children|kids)|can live with (children|kids))\b/

  if (dogFriendly.test(working)) {
    set('good_with_dogs', 'yes', 'Good with dogs')
    working = stripPhrase(working, new RegExp(dogFriendly.source, 'g'))
  }
  if (catFriendly.test(working)) {
    set('good_with_cats', 'yes', 'Good with cats')
    working = stripPhrase(working, new RegExp(catFriendly.source, 'g'))
  }
  if (childFriendly.test(working)) {
    set('good_with_children', 'yes', 'Good with children')
    working = stripPhrase(working, new RegExp(childFriendly.source, 'g'))
  }

  if (/\b(sterilised|sterilized|spayed|neutered)\b/.test(working)) {
    set('sterilised', 'yes', 'Sterilised')
    working = stripPhrase(working, /\b(sterilised|sterilized|spayed|neutered)\b/g)
  }
  if (/\b(vaccinated|fully vaccinated)\b/.test(working)) {
    set('vaccinated', 'yes', 'Vaccinated')
    working = stripPhrase(working, /\b(fully vaccinated|vaccinated)\b/g)
  }
  if (/\bdewormed\b/.test(working)) {
    set('dewormed', 'yes', 'Dewormed')
    working = stripPhrase(working, /\bdewormed\b/g)
  }

  working = working
    .replace(/\b(i am|i'm|im|we are|we're|looking for|searching for|want|would like|need|please|show me|find me|an?|the|pet|animal|for adoption|to adopt|that is|who is|which is)\b/g, ' ')
    .replace(/\b(and|with|preferably|ideally)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (working.length >= 2) {
    filters.search = working
    chips.push(`Keywords: ${working}`)
  }

  return { filters, chips }
}
