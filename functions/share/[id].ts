interface Env {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

type PagesContext = {
  request: Request
  env: Env
  params: { id?: string }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char))
}

function storageUrl(base: string, path: string) {
  return `${base}/storage/v1/object/public/animal-photos/${path.split('/').map(encodeURIComponent).join('/')}`
}

export async function onRequest(context: PagesContext) {
  const id = context.params.id || ''
  const supabaseUrl = context.env.VITE_SUPABASE_URL
  const key = context.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const destination = `/animals/${encodeURIComponent(id)}`

  if (!id || !supabaseUrl || !key) return Response.redirect(new URL(destination, context.request.url).toString(), 302)

  const query = new URLSearchParams({
    id: `eq.${id}`,
    select: 'id,name,species,sex,age_value,age_unit,city,state,description,animal_photos(storage_path,sort_order)',
    is_published: 'eq.true',
    moderation_status: 'eq.active',
    adoption_status: 'in.(available,reserved)',
    limit: '1',
  })

  const response = await fetch(`${supabaseUrl}/rest/v1/animals?${query.toString()}`, { headers: { apikey: key } })
  if (!response.ok) return Response.redirect(new URL(destination, context.request.url).toString(), 302)
  const rows = await response.json() as Array<{
    name: string
    species: string
    sex: string
    age_value: number | null
    age_unit: string | null
    city: string
    state: string | null
    description: string
    animal_photos?: Array<{ storage_path: string; sort_order: number }>
  }>
  const animal = rows[0]
  if (!animal) return Response.redirect(new URL('/', context.request.url).toString(), 302)

  const photos = [...(animal.animal_photos || [])].sort((a, b) => a.sort_order - b.sort_order)
  const image = photos[0]?.storage_path ? storageUrl(supabaseUrl, photos[0].storage_path) : ''
  const age = animal.age_value && animal.age_unit ? `${animal.age_value} ${animal.age_unit}` : 'Age unknown'
  const location = [animal.city, animal.state].filter(Boolean).join(', ')
  const title = `${animal.name} is looking for a home 🐾`
  const description = `${animal.species.charAt(0).toUpperCase() + animal.species.slice(1)} · ${animal.sex} · ${age} · ${location}`
  const canonical = new URL(destination, context.request.url).toString()

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(context.request.url)}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:alt" content="Photo of ${escapeHtml(animal.name)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ''}
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(canonical)}">
</head>
<body>
<p>Opening ${escapeHtml(animal.name)}'s adoption listing… <a href="${escapeHtml(canonical)}">Continue</a></p>
<script>location.replace(${JSON.stringify(canonical)})</script>
</body>
</html>`

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } })
}
