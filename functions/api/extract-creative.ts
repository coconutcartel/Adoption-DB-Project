interface Env {
  AI?: { run: (model: string, input: unknown) => Promise<unknown> }
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

type PagesContext = {
  request: Request
  env: Env
}

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })
}

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

async function requireAdmin(request: Request, env: Env) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!token || !url || !key) return false

  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  })
  if (!userResponse.ok) return false
  const user = await userResponse.json() as { id?: string }
  if (!user.id) return false

  const roleResponse = await fetch(`${url}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(user.id)}&select=role`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  })
  if (!roleResponse.ok) return false
  const roles = await roleResponse.json() as Array<{ role?: string }>
  return roles[0]?.role === 'admin'
}

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    species: { type: 'string', enum: ['dog', 'cat', 'other', 'unknown'] },
    other_species: { type: 'string' },
    breed: { type: 'string' },
    sex: { type: 'string', enum: ['male', 'female', 'unknown'] },
    age_value: { type: 'string' },
    age_unit: { type: 'string', enum: ['months', 'years', 'unknown'] },
    size: { type: 'string', enum: ['small', 'medium', 'large', 'unknown'] },
    city: { type: 'string' },
    state: { type: 'string' },
    country: { type: 'string' },
    description: { type: 'string' },
    temperament: { type: 'string' },
    sterilised: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    vaccinated: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    dewormed: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    good_with_dogs: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    good_with_cats: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    good_with_children: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    special_needs: { type: 'string' },
    medical_notes: { type: 'string' },
    adoption_requirements: { type: 'string' },
    contact_name: { type: 'string' },
    contact_phone: { type: 'string' },
  },
  required: ['name','species','other_species','breed','sex','age_value','age_unit','size','city','state','country','description','temperament','sterilised','vaccinated','dewormed','good_with_dogs','good_with_cats','good_with_children','special_needs','medical_notes','adoption_requirements','contact_name','contact_phone'],
}

export async function onRequestPost(context: PagesContext) {
  try {
    if (!(await requireAdmin(context.request, context.env))) return json({ error: 'Admin access required.' }, 403)
    if (!context.env.AI) return json({ error: 'Workers AI binding is not configured yet.' }, 503)

    const form = await context.request.formData()
    const file = form.get('creative')
    if (!(file instanceof File)) return json({ error: 'Choose a creative to upload.' }, 400)
    if (!allowedTypes.has(file.type)) return json({ error: 'Use a JPG, PNG or WebP creative.' }, 400)
    if (file.size > 8 * 1024 * 1024) return json({ error: 'Creative must be 8 MB or smaller.' }, 400)

    const imageUrl = `data:${file.type};base64,${toBase64(await file.arrayBuffer())}`
    const result = await context.env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
      messages: [
        {
          role: 'system',
          content: 'You extract factual adoption-listing information from animal adoption posters. Never guess. Only use facts explicitly written in the image. Visual appearance alone must not be used to infer age, sex, breed, health, sterilisation, vaccination, temperament, compatibility, or medical status. If a fact is not stated, return an empty string or unknown. Preserve phone numbers accurately. Return only the requested structured data.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Read this adoption creative and extract the new-listing fields. Country may default to India only if the creative clearly refers to an Indian location; otherwise leave it blank.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: 'json_schema', json_schema: schema },
      temperature: 0.1,
      max_completion_tokens: 1600,
    }) as { response?: unknown; choices?: Array<{ message?: { content?: string } }> }

    let extracted: unknown = result.response ?? result.choices?.[0]?.message?.content ?? result
    if (typeof extracted === 'string') extracted = JSON.parse(extracted)
    return json({ data: extracted })
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'Creative extraction failed.' }, 500)
  }
}

export function onRequest() {
  return json({ error: 'Method not allowed.' }, 405)
}
