interface MarkdownResult {
  format: 'markdown' | 'text' | 'error'
  data?: string
  error?: string
}

interface Env {
  AI?: {
    run: (model: string, input: unknown) => Promise<unknown>
    toMarkdown: (file: { name: string; blob: Blob }) => Promise<MarkdownResult>
  }
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

type PagesContext = {
  request: Request
  env: Env
}

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
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
  additionalProperties: false,
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
  required: [
    'name','species','other_species','breed','sex','age_value','age_unit','size','city','state','country',
    'description','temperament','sterilised','vaccinated','dewormed','good_with_dogs','good_with_cats',
    'good_with_children','special_needs','medical_notes','adoption_requirements','contact_name','contact_phone',
  ],
}

function parseStructuredResult(result: unknown) {
  const response = (result as { response?: unknown } | null)?.response ?? result
  if (response && typeof response === 'object') return response
  if (typeof response !== 'string' || !response.trim()) throw new Error('AI returned no structured data.')

  const cleaned = response.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error('AI returned an unreadable structured response. Please try the scan again.')
  }
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

    // First use Cloudflare's document/image conversion service to read the creative.
    // This avoids relying on a vision model that does not currently support JSON Mode.
    const converted = await context.env.AI.toMarkdown({
      name: file.name || 'adoption-creative',
      blob: file,
    })

    if (converted.format === 'error' || !converted.data?.trim()) {
      throw new Error(converted.error || 'Cloudflare could not read this creative. Try a clearer image.')
    }

    const extractionPrompt = `
You are extracting a NEW animal adoption listing from text produced from an adoption creative.

Rules:
- Use only facts explicitly stated in the supplied converted content.
- The converted content may contain visual descriptions generated from the image. Do NOT use visual appearance alone to infer age, sex, breed, size, health, sterilisation, vaccination, temperament, compatibility, medical status or special needs.
- Never invent missing details.
- For missing text fields return an empty string.
- For missing enum fields return "unknown".
- Preserve phone numbers accurately.
- country may be "India" only when the supplied content clearly identifies an Indian place/context; otherwise return an empty string.
- description should summarise only factual adoption information present in the creative; do not add promotional claims that are not present.

Converted creative content:
---
${converted.data}
---
`

    const result = await context.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
      messages: [
        {
          role: 'system',
          content: 'Extract factual animal adoption listing data. Never guess or infer unstated facts.',
        },
        { role: 'user', content: extractionPrompt },
      ],
      response_format: { type: 'json_schema', json_schema: schema },
      temperature: 0.1,
      max_tokens: 1600,
    })

    return json({ data: parseStructuredResult(result) })
  } catch (error) {
    console.error('Creative extraction failed', error)
    return json({ error: error instanceof Error ? error.message : 'Creative extraction failed.' }, 500)
  }
}

export function onRequest() {
  return json({ error: 'Method not allowed.' }, 405)
}
