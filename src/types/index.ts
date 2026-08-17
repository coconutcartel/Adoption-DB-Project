export type AdoptionStatus = 'available' | 'reserved' | 'adopted' | 'withdrawn'
export type ModerationStatus = 'active' | 'under_review' | 'hidden'
export type Species = 'dog' | 'cat' | 'other'
export type Sex = 'male' | 'female' | 'unknown'
export type AnimalSize = 'small' | 'medium' | 'large' | 'unknown'
export type YesNoUnknown = 'yes' | 'no' | 'unknown'
export type AgeUnit = 'months' | 'years'
export type UserRole = 'user' | 'moderator' | 'admin'
export type ReportReason =
  | 'duplicate'
  | 'misleading'
  | 'scam'
  | 'animal_safety'
  | 'inappropriate'
  | 'already_adopted'
  | 'other'
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'

export interface AnimalPhoto {
  id: string
  animal_id: string
  storage_path: string
  public_url: string
  alt_text: string | null
  sort_order: number
}

export interface Animal {
  id: string
  owner_id: string
  name: string
  species: Species
  other_species: string | null
  breed: string | null
  sex: Sex
  age_value: number | null
  age_unit: AgeUnit | null
  size: AnimalSize
  city: string
  state: string | null
  country: string
  description: string
  temperament: string | null
  sterilised: YesNoUnknown
  vaccinated: YesNoUnknown
  dewormed: YesNoUnknown
  good_with_dogs: YesNoUnknown
  good_with_cats: YesNoUnknown
  good_with_children: YesNoUnknown
  special_needs: string | null
  medical_notes: string | null
  adoption_requirements: string | null
  contact_name: string
  contact_phone: string
  whatsapp_ok: boolean
  adoption_status: AdoptionStatus
  moderation_status: ModerationStatus
  is_published: boolean
  created_at: string
  updated_at: string
  animal_photos?: AnimalPhoto[]
}

export interface Profile {
  id: string
  display_name: string
  city: string | null
  phone: string | null
  organisation_name: string | null
  created_at: string
  updated_at: string
}

export interface ListingReport {
  id: string
  animal_id: string
  reporter_id: string
  reason: ReportReason
  details: string | null
  status: ReportStatus
  moderator_notes: string | null
  created_at: string
  reviewed_at: string | null
  animal?: Pick<Animal, 'id' | 'name' | 'owner_id' | 'adoption_status' | 'moderation_status'>
}

export interface AnimalFilters {
  search: string
  species: '' | Species
  sex: '' | Sex
  size: '' | AnimalSize
  city: string
  good_with_dogs?: '' | YesNoUnknown
  good_with_cats?: '' | YesNoUnknown
  good_with_children?: '' | YesNoUnknown
  sterilised?: '' | YesNoUnknown
  vaccinated?: '' | YesNoUnknown
  dewormed?: '' | YesNoUnknown
}
