import { demoAnimals } from './demo'
import { isSupabaseConfigured, supabase } from './supabase'
import type { Animal, AnimalFilters, ListingReport, ReportReason, ReportStatus } from '../types'

const animalSelect = `
  *,
  animal_photos (
    id,
    animal_id,
    storage_path,
    alt_text,
    sort_order
  )
`

function sortPhotos(animal: Animal): Animal {
  const photos = [...(animal.animal_photos ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((photo) => ({
      ...photo,
      public_url: photo.public_url || (supabase ? supabase.storage.from('animal-photos').getPublicUrl(photo.storage_path).data.publicUrl : ''),
    }))
  return { ...animal, animal_photos: photos }
}

export async function getPublicAnimals(filters?: AnimalFilters): Promise<Animal[]> {
  if (!supabase || !isSupabaseConfigured) {
    let items = [...demoAnimals]
    if (filters?.search) {
      const q = filters.search.toLowerCase()
      items = items.filter((a) => [a.name, a.breed, a.city, a.description].some((v) => v?.toLowerCase().includes(q)))
    }
    if (filters?.species) items = items.filter((a) => a.species === filters.species)
    if (filters?.sex) items = items.filter((a) => a.sex === filters.sex)
    if (filters?.size) items = items.filter((a) => a.size === filters.size)
    if (filters?.city) items = items.filter((a) => a.city.toLowerCase().includes(filters.city.toLowerCase()))
    if (filters?.good_with_dogs) items = items.filter((a) => a.good_with_dogs === filters.good_with_dogs)
    if (filters?.good_with_cats) items = items.filter((a) => a.good_with_cats === filters.good_with_cats)
    if (filters?.good_with_children) items = items.filter((a) => a.good_with_children === filters.good_with_children)
    if (filters?.sterilised) items = items.filter((a) => a.sterilised === filters.sterilised)
    if (filters?.vaccinated) items = items.filter((a) => a.vaccinated === filters.vaccinated)
    if (filters?.dewormed) items = items.filter((a) => a.dewormed === filters.dewormed)
    return items
  }

  let query = supabase
    .from('animals')
    .select(animalSelect)
    .in('adoption_status', ['available', 'reserved'])
    .eq('is_published', true)
    .eq('moderation_status', 'active')
    .order('created_at', { ascending: false })

  if (filters?.species) query = query.eq('species', filters.species)
  if (filters?.sex) query = query.eq('sex', filters.sex)
  if (filters?.size) query = query.eq('size', filters.size)
  if (filters?.city) query = query.ilike('city', `%${filters.city}%`)
  if (filters?.good_with_dogs) query = query.eq('good_with_dogs', filters.good_with_dogs)
  if (filters?.good_with_cats) query = query.eq('good_with_cats', filters.good_with_cats)
  if (filters?.good_with_children) query = query.eq('good_with_children', filters.good_with_children)
  if (filters?.sterilised) query = query.eq('sterilised', filters.sterilised)
  if (filters?.vaccinated) query = query.eq('vaccinated', filters.vaccinated)
  if (filters?.dewormed) query = query.eq('dewormed', filters.dewormed)
  if (filters?.search.trim()) {
    query = query.textSearch('search_document', filters.search.trim(), { type: 'websearch', config: 'english' })
  }

  const { data, error } = await query
  if (error) throw error
  return (data as Animal[]).map(sortPhotos)
}

export async function getAnimal(id: string): Promise<Animal | null> {
  if (!supabase || !isSupabaseConfigured) return demoAnimals.find((animal) => animal.id === id) ?? null
  const { data, error } = await supabase.from('animals').select(animalSelect).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? sortPhotos(data as Animal) : null
}

export async function getMyAnimals(userId: string): Promise<Animal[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('animals').select(animalSelect).eq('owner_id', userId).order('updated_at', { ascending: false })
  if (error) throw error
  return (data as Animal[]).map(sortPhotos)
}

export async function createAnimalDraft(userId: string, values: Partial<Animal>) {
  if (!supabase) throw new Error('Supabase is not configured')
  const payload = { ...values, owner_id: userId, is_published: false, moderation_status: 'active' }
  const { data, error } = await supabase.from('animals').insert(payload).select().single()
  if (error) throw error
  return data as Animal
}

export async function updateAnimal(id: string, values: Partial<Animal>) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.from('animals').update(values).eq('id', id).select().single()
  if (error) throw error
  return data as Animal
}

export async function publishAnimal(id: string) {
  return updateAnimal(id, { is_published: true })
}

export async function uploadAnimalPhotos(userId: string, animalId: string, files: File[]) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { count, error: countError } = await supabase.from('animal_photos').select('*', { count: 'exact', head: true }).eq('animal_id', animalId)
  if (countError) throw countError
  if ((count ?? 0) + files.length > 5) throw new Error('A listing can have a maximum of 5 photos.')
  const uploaded = []
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    if (!allowedTypes.has(file.type)) throw new Error(`${file.name} is not a supported image type.`)
    if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} is larger than 8 MB.`)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/${animalId}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('animal-photos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (uploadError) throw uploadError
    const { data: row, error: photoError } = await supabase
      .from('animal_photos')
      .insert({ animal_id: animalId, uploader_id: userId, storage_path: path, sort_order: index })
      .select()
      .single()
    if (photoError) throw photoError
    uploaded.push(row)
  }
  return uploaded
}

export async function removeAnimalPhoto(photoId: string, storagePath: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.from('animal_photos').delete().eq('id', photoId)
  if (error) throw error
  const { error: storageError } = await supabase.storage.from('animal-photos').remove([storagePath])
  if (storageError) console.warn('Photo row removed but storage cleanup failed:', storageError.message)
}

export async function submitReport(animalId: string, reporterId: string, reason: ReportReason, details: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.from('listing_reports').insert({
    animal_id: animalId,
    reporter_id: reporterId,
    reason,
    details: details.trim() || null,
  })
  if (error) throw error
}

export async function getMyRole(userId: string) {
  if (!supabase) return 'user' as const
  const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return (data?.role ?? 'user') as 'user' | 'moderator' | 'admin'
}

export async function getReports(): Promise<ListingReport[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('listing_reports')
    .select(`*, animal:animals(id,name,owner_id,adoption_status,moderation_status)`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as ListingReport[]
}

export async function updateReportStatus(id: string, status: ReportStatus, notes?: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase
    .from('listing_reports')
    .update({ status, moderator_notes: notes?.trim() || null, reviewed_at: status === 'open' ? null : new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function moderateAnimal(id: string, moderationStatus: 'active' | 'under_review' | 'hidden') {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.from('animals').update({ moderation_status: moderationStatus }).eq('id', id)
  if (error) throw error
}
