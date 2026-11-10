import { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import {
  verifyPassword, createSession, destroySession, loadSessionUser, msConfigured, msAuthorizeUrl, msExchange,
  hashPassword, validatePasswordStrength, redirectUri
} from '../lib/auth'
import { getSettings } from '../lib/util'

const auth = new Hono<AppEnv>()

// Configuración pública para la pantalla de login
auth.get('/api/auth/config', async (c) => {
  const s = await getSettings(c.env.DB)
  return c.json({
    app_name: s.app_name, group_name: s.group_name, tagline: s.tagline,
    microsoft: { enabled: s.ms_enabled === '1', configured: msConfigured(c.env) },
    local_login: s.local_login_enabled !== '0',
    program_start: s.program_start
  })
})

// Rate-limit simple por email (en D1, ventana 15 min)
async function tooManyAttempts(db: D1Database, email: string) {
  const r = await db.prepare("SELECT COUNT(*) n FROM activity WHERE action='login_failed' AND summary = ? AND created_at > datetime('now','-15 minutes')")
    .bind(email).first<{ n: number }>()
  return (r?.n || 0) >= 8
}

auth.post('/api/auth/login', async (c) => {
  const s = await getSettings(c.env.DB)
  if (s.local_login_enabled === '0') return c.json({ error: 'El acceso con usuario y contraseña está deshabilitado. Ingresá con Microsoft 365.' }, 403)
  const { email, password } = await c.req.json<{ email: string; password: string }>().catch(() => ({ email: '', password: '' }))
  const em = String(email || '').trim().toLowerCase()
  if (!em || !password) return c.json({ error: 'Ingresá tu correo y contraseña.' }, 400)
  if (await tooManyAttempts(c.env.DB, em)) return c.json({ error: 'Demasiados intentos. Esperá 15 minutos.' }, 429)
  const u = await c.env.DB.prepare('SELECT id, password_hash, active FROM users WHERE email = ?').bind(em).first<{ id: number; password_hash: string; active: number }>()
  if (!u || !u.active || !(await verifyPassword(password, u.password_hash))) {
    await c.env.DB.prepare("INSERT INTO activity (action, summary) VALUES ('login_failed', ?)").bind(em).run()
    return c.json({ error: 'Correo o contraseña incorrectos.' }, 401)
  }
  await createSession(c, u.id)
  return c.json({ ok: true })
})

auth.post('/api/auth/logout', async (c) => {
  await destroySession(c)
  return c.json({ ok: true })
})

auth.get('/api/auth/me', async (c) => {
  const user = await loadSessionUser(c)
  if (!user) return c.json({ error: 'No autenticado' }, 401)
  return c.json({ user })
})

auth.post('/api/auth/password', async (c) => {
  const user = await loadSessionUser(c)
  if (!user) return c.json({ error: 'No autenticado' }, 401)
  const { current, next } = await c.req.json<{ current: string; next: string }>()
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first<{ password_hash: string }>()
  if (row?.password_hash && !user.must_change_password && !(await verifyPassword(current || '', row.password_hash)))
    return c.json({ error: 'La contraseña actual no es correcta.' }, 400)
  const weak = validatePasswordStrength(next)
  if (weak) return c.json({ error: weak }, 400)
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').bind(await hashPassword(next), user.id).run()
  return c.json({ ok: true })
})

// ---------- SSO Microsoft 365 ----------
auth.get('/auth/microsoft', async (c) => {
  if (!msConfigured(c.env)) return c.redirect('/#/login?error=' + encodeURIComponent('Microsoft 365 aún no está configurado. Pedí al administrador que cargue los datos de la App Registration.'))
  return c.redirect(await msAuthorizeUrl(c))
})

auth.get('/auth/microsoft/callback', async (c) => {
  const code = c.req.query('code'), state = c.req.query('state')
  const fail = (m: string) => c.redirect('/#/login?error=' + encodeURIComponent(m))
  if (c.req.query('error')) return fail(c.req.query('error_description') || 'Acceso cancelado')
  if (!code || !state) return fail('Respuesta inválida de Microsoft')
  try {
    const ms = await msExchange(c, code, state)
    if (!ms.email) return fail('Tu cuenta de Microsoft no tiene un correo asociado.')
    const s = await getSettings(c.env.DB)
    const domains = (s.ms_allowed_domains || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
    if (domains.length && !domains.some(d => ms.email.endsWith('@' + d))) return fail(`El dominio de ${ms.email} no está habilitado.`)
    let u = await c.env.DB.prepare('SELECT id, active FROM users WHERE ms_oid = ? OR email = ?').bind(ms.oid, ms.email).first<{ id: number; active: number }>()
    if (u && !u.active) return fail('Tu usuario está deshabilitado. Contactá al administrador.')
    if (!u) {
      if (s.ms_auto_provision !== '1') return fail(`${ms.email} no tiene acceso. Pedí al administrador que te dé de alta.`)
      const prof = await c.env.DB.prepare('SELECT key FROM profiles WHERE key=?').bind(s.ms_default_profile || 'viewer').first<{ key: string }>()
      const r = await c.env.DB.prepare("INSERT INTO users (email, name, auth_provider, ms_oid, system_role, position, phone) VALUES (?,?, 'microsoft', ?, ?, ?, ?)")
        .bind(ms.email, ms.name || ms.email, ms.oid, prof?.key || 'viewer', ms.jobTitle, ms.phone).run()
      const id = r.meta.last_row_id as number
      const first = await c.env.DB.prepare('SELECT id FROM companies WHERE active = 1 ORDER BY id LIMIT 1').first<{ id: number }>()
      if (first) await c.env.DB.prepare('INSERT OR IGNORE INTO user_companies (user_id, company_id) VALUES (?,?)').bind(id, first.id).run()
      const admins = await c.env.DB.prepare("SELECT id FROM users WHERE system_role='admin' AND active=1").all<{ id: number }>()
      const st = c.env.DB.prepare("INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, 'user', 'Nuevo usuario vía Microsoft 365', ?, '#/admin/users')")
      if (admins.results.length) await c.env.DB.batch(admins.results.map(a => st.bind(a.id, `${ms.name} (${ms.email}) ingresó por primera vez. Asignale rol y empresas.`)))
      u = { id, active: 1 }
    } else {
      await c.env.DB.prepare("UPDATE users SET ms_oid = ?, auth_provider = CASE WHEN password_hash IS NULL THEN 'microsoft' ELSE auth_provider END WHERE id = ?").bind(ms.oid, u.id).run()
    }
    await createSession(c, u.id)
    return c.redirect('/#/')
  } catch (e: any) {
    return fail(e.message || 'Error de autenticación')
  }
})

auth.get('/api/auth/microsoft/redirect-uri', (c) => c.json({ redirect_uri: redirectUri(c) }))

export default auth
