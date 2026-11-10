import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import type { AppEnv } from './lib/types'
import { requireAuth, requireWrite } from './lib/auth'
import authRoutes from './routes/auth'
import core from './routes/core'
import work from './routes/work'
import admin from './routes/admin'

const app = new Hono<AppEnv>()

app.use('*', secureHeaders({ crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: false, contentSecurityPolicy: undefined }))

app.onError((e, c) => {
  console.error(e)
  return c.json({ error: 'Error interno del servidor', detail: String(e?.message || e).slice(0, 300) }, 500)
})

app.get('/api/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }))

// Autenticación (público)
app.route('/', authRoutes)

// API protegida
const api = new Hono<AppEnv>()
api.use('*', requireAuth)
api.use('*', requireWrite)
api.route('/', core)
api.route('/', work)
api.route('/', admin)
app.route('/api', api)

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) return c.json({ error: 'Recurso no encontrado' }, 404)
  return c.html(shell())
})

app.get('/', (c) => c.html(shell()))

const V = '20261106a'
function shell() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>RIMI Hub · Grupo Phronesis</title>
<meta name="description" content="Portal de gestión de inversiones del Régimen de Incentivo para Medianas Inversiones">
<meta name="theme-color" content="#00322B">
<link rel="icon" href="/static/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/css/app.css?v=${V}">
</head>
<body>
<div id="app"><div class="boot"><div class="boot-mark"></div></div></div>
<div id="toasts" aria-live="polite"></div>
<div id="modal-root"></div>
<script src="https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.3/Sortable.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js" defer></script>
<script type="module" src="/static/js/main.js?v=${V}"></script>
</body>
</html>`
}

export default app
