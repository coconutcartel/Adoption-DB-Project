interface MarkdownResult {
  format: 'markdown' | 'text' | 'error'
  data?: string
  error?: string
}

interface CropBox {
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}

interface Env {
  AI?: {
    run: (model: string, input: unknown) => Promise<unknown>
    toMarkdown: (
      file: { name: string; blob: Blob },
      options?: unknown,
    ) => Promise<MarkdownResult | MarkdownResult[]>
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

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
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
  if (response && typeof response === 'object') return response as Record<string, unknown>
  if (typeof response !== 'string' || !response.trim()) throw new Error('AI returned no structured data.')

  const cleaned = response.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    throw new Error('AI returned an unreadable structured response. Please try the scan again.')
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function hashSeed(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  return Math.abs(hash)
}

function cuteName(species: string, seed: string) {
  const dogNames = ['Biscuit', 'Mochi', 'Peanut', 'Toffee', 'Mango', 'Pickle', 'Noodle', 'Pippin', 'Bean', 'Waffles']
  const catNames = ['Miso', 'Mochi', 'Nori', 'Pebble', 'Fig', 'Boba', 'Pixel', 'Pudding', 'Olive', 'Sprout']
  const otherNames = ['Pip', 'Sunny', 'Bean', 'Clover', 'Pebble', 'Mango', 'Button', 'Mochi', 'Bubbles', 'Toto']
  const names = species === 'dog' ? dogNames : species === 'cat' ? catNames : otherNames
  return names[hashSeed(seed) % names.length]
}

function readBox(item: unknown): CropBox | null {
  if (!item || typeof item !== 'object') return null
  const record = item as Record<string, unknown>
  const box = (record.box && typeof record.box === 'object' ? record.box : record) as Record<string, unknown>
  const xmin = Number(box.xmin ?? box.x_min ?? box.x1 ?? box.left)
  const ymin = Number(box.ymin ?? box.y_min ?? box.y1 ?? box.top)
  const xmax = Number(box.xmax ?? box.x_max ?? box.x2 ?? box.right)
  const ymax = Number(box.ymax ?? box.y_max ?? box.y2 ?? box.bottom)
  if (![xmin, ymin, xmax, ymax].every(Number.isFinite) || xmax <= xmin || ymax <= ymin) return null
  return { xmin, ymin, xmax, ymax }
}

function largestDetectedBox(result: unknown): CropBox | null {
  const record = result && typeof result === 'object' ? result as Record<string, unknown> : null
  const rawObjects = Array.isArray(record?.objects) ? record.objects : Array.isArray(result) ? result : []
  const boxes = rawObjects.map(readBox).filter((box): box is CropBox => Boolean(box))
  if (!boxes.length) return null
  return boxes.sort((a, b) => ((b.xmax - b.xmin) * (b.ymax - b.ymin)) - ((a.xmax - a.xmin) * (a.ymax - a.ymin)))[0]
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

    const convertedResult = await context.env.AI.toMarkdown(
      { name: file.name || 'adoption-creative', blob: new Blob([await file.arrayBuffer()], { type: file.type }) },
      { conversionOptions: { output: { format: 'text' } } },
    )
    const converted = Array.isArray(convertedResult) ? convertedResult[0] : convertedResult

    if (!converted || converted.format === 'error' || !converted.data?.trim()) {
      throw new Error(converted?.error || 'Cloudflare could not read this creative. Try a clearer image.')
    }

    const extractionPrompt = `
You are extracting a NEW animal adoption listing from text produced from an adoption creative.

Rules:
- Use only facts explicitly stated in the supplied converted content.
- Do NOT infer age, sex, breed, size, health, sterilisation, vaccination, temperament, compatibility, medical status or special needs from visual appearance.
- Never invent missing factual details.
- For missing text fields return an empty string.
- For missing enum fields return "unknown".
- Preserve phone numbers accurately, including a country code if one is printed. The app will remove the country code later.
- country may be "India" only when the supplied content clearly identifies an Indian place/context; otherwise return an empty string.
- description should summarise only factual adoption information present in the creative.

Converted creative content:
---
${converted.data}
---
`

    const structuredResult = await context.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
      messages: [
        { role: 'system', content: 'Extract factual animal adoption listing data. Never guess or infer unstated facts.' },
        { role: 'user', content: extractionPrompt },
      ],
      response_format: { type: 'json_schema', json_schema: schema },
      temperature: 0.1,
      max_tokens: 1600,
    })

    const extracted = parseStructuredResult(structuredResult)
    const species = stringValue(extracted.species) || 'unknown'
    const missingName = !stringValue(extracted.name)
    const missingContactName = !stringValue(extracted.contact_name)

    if (missingName) extracted.name = cuteName(species, `${file.name}:${converted.data.slice(0, 600)}`)
    if (missingContactName) extracted.contact_name = 'Fosterer'

    let crop: CropBox | null = null
    try {
      const image = `data:${file.type};base64,${toBase64(await file.arrayBuffer())}`
      const target = species === 'dog' || species === 'cat'
        ? species
        : stringValue(extracted.other_species) || 'animal'
      const detection = await context.env.AI.run('@cf/moondream/moondream3.1-9B-A2B', {
        task: 'detect',
        image,
        target,
        max_objects: 12,
        stream: false,
      })
      crop = largestDetectedBox(detection)

      if (!crop && target !== 'animal') {
        const fallbackDetection = await context.env.AI.run('@cf/moondream/moondream3.1-9B-A2B', {
          task: 'detect',
          image,
          target: 'animal',
          max_objects: 12,
          stream: false,
        })
        crop = largestDetectedBox(fallbackDetection)
      }
    } catch (cropError) {
      console.warn('Animal crop detection failed', cropError)
    }

    return json({
      data: extracted,
      crop,
      generated: { name: missingName, contact_name: missingContactName },
    })
  } catch (error) {
    console.error('Creative extraction failed', error)
    return json({ error: error instanceof Error ? error.message : 'Creative extraction failed.' }, 500)
  }
}

export function onRequest() {
  return json({ error: 'Method not allowed.' }, 405)
}
