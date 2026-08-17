import type { Animal } from '../types'

export const demoAnimals: Animal[] = [
  {
    id: 'demo-bruno', owner_id: 'demo', name: 'Bruno', species: 'dog', other_species: null,
    breed: 'Indie mix', sex: 'male', age_value: 2, age_unit: 'years', size: 'medium',
    city: 'Mapusa', state: 'Goa', country: 'India',
    description: 'Friendly, people-loving and happiest when he has company. Bruno is looking for a patient forever family.',
    temperament: 'Affectionate, playful, food-motivated', sterilised: 'yes', vaccinated: 'yes', dewormed: 'yes',
    good_with_dogs: 'yes', good_with_cats: 'unknown', good_with_children: 'yes', special_needs: null,
    medical_notes: null, adoption_requirements: 'Indoor sleeping area and a secure compound.',
    contact_name: 'Demo Fosterer', contact_phone: '+91 90000 00000', whatsapp_ok: true,
    adoption_status: 'available', moderation_status: 'active', is_published: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    animal_photos: [{ id: 'p1', animal_id: 'demo-bruno', storage_path: '', public_url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1200&q=80', alt_text: 'Demo dog', sort_order: 0 }]
  },
  {
    id: 'demo-miso', owner_id: 'demo', name: 'Miso', species: 'cat', other_species: null,
    breed: 'Domestic shorthair', sex: 'female', age_value: 8, age_unit: 'months', size: 'small',
    city: 'Panjim', state: 'Goa', country: 'India',
    description: 'Curious, gentle and very fond of sunny windows. Miso is litter-trained and ready for a calm home.',
    temperament: 'Gentle, curious, quiet', sterilised: 'yes', vaccinated: 'yes', dewormed: 'yes',
    good_with_dogs: 'unknown', good_with_cats: 'yes', good_with_children: 'unknown', special_needs: null,
    medical_notes: null, adoption_requirements: 'Indoor-only home preferred.',
    contact_name: 'Demo Fosterer', contact_phone: '+91 90000 00000', whatsapp_ok: true,
    adoption_status: 'available', moderation_status: 'active', is_published: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    animal_photos: [{ id: 'p2', animal_id: 'demo-miso', storage_path: '', public_url: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=1200&q=80', alt_text: 'Demo cat', sort_order: 0 }]
  }
]
