import { ALL_PERMS, parsePerms } from './permissions'
import type { Context, Next } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { AppEnv, SessionUser } from './types'
import { randomId } from './util'

const SESSION_COOKIE = 'rimi_session'
const SESSION_DAYS = 14
const ITER = 100000

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)))
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))

async function pbkdf2(password: string, salt: Uint8Array, iter: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256)
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await pbkdf2(password, salt, ITER)
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(bits)}`
}

export async function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false
  const [alg, iterS, saltS, hashS] = stored.split('$')
  if (alg !== 'pbkdf2') return false
  const bits = new Uint8Array(await pbkdf2(password, unb64(saltS), parseInt(iterS)))
  const expected = unb64(hashS)
  if (bits.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i]
  return diff === 0
}

export function validatePasswordStrength(p: string): string | null {
  if (!p || p.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'La contraseña debe combinar letras y números.'
  return null
}

export async function createSession(c: Context<AppEnv>, userId: number) {
  const id = randomId(32)
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000)
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES (?,?,?,?)')
      .bind(id, userId, expires.toISOString(), (c.req.header('user-agent') || '').slice(0, 200)),
    c.env.DB.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(new Date().toISOString())
  ])
  const secure = new URL(c.req.url).protocol === 'https:'
  setCookie(c, SESSION_COOKIE, id, { httpOnly: true, secure, sameSite: 'Lax', path: '/', expires })
}

export async function destroySession(c: Context<AppEnv>) {
  const id = getCookie(c, SESSION_COOKIE)
  if (id) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run()
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export async function loadSessionUser(c: Context<AppEnv>): Promise<SessionUser | null> {
  const id = getCookie(c, SESSION_COOKIE)
  if (!id) return null
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.system_role, u.functional_role, u.position, u.avatar_color, u.auth_provider, u.must_change_password, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND u.active = 1`
  ).bind(id).first<SessionUser & { expires_at: string }>()
  if (!row || new Date(row.expires_at) < new Date()) return null
  const { expires_at, ...user } = row
  return user
}

/** Middleware: exige sesión válida y carga las empresas habilitadas del usuario */
export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const user = await loadSessionUser(c)
  if (!user) return c.json({ error: 'No autenticado' }, 401)
  c.set('user', user)
  let companyIds: number[]
  if (user.system_role === 'admin') {
    const { results } = await c.env.DB.prepare('SELECT id FROM companies').all<{ id: number }>()
    companyIds = results.map(r => r.id)
  } else {
    const { results } = await c.env.DB.prepare('SELECT company_id FROM user_companies WHERE user_id = ?').bind(user.id).all<{ company_id: number }>()
    companyIds = results.map(r => r.company_id)
  }
  c.set('companyIds', companyIds)
  c.set('perms', await effectivePerms(c.env.DB, user))
  await next()
}

/** Permisos efectivos = permisos del perfil ∪ permisos adicionales del rol funcional. Admin = todos. */
export async function effectivePerms(db: D1Database, user: { system_role: string; functional_role: string | null }) {
  if (user.system_role === 'admin') return [...ALL_PERMS]
  const [prof, role] = await Promise.all([
    db.prepare('SELECT permissions FROM profiles WHERE key=?').bind(user.system_role).first<{ permissions: string }>(),
    user.functional_role ? db.prepare('SELECT permissions FROM functional_roles WHERE key=?').bind(user.functional_role).first<{ permissions: string }>() : Promise.resolve(null)
  ])
  return [...new Set([...parsePerms(prof?.permissions), ...parsePerms(role?.permissions)])]
}
export const can = (c: Context<AppEnv>, perm: string) => isAdmin(c) || (c.get('perms') || []).includes(perm)

export const isAdmin = (c: Context<AppEnv>) => c.get('user').system_role === 'admin'
export const isRimi = (c: Context<AppEnv>) => ['admin', 'rimi'].includes(c.get('user').system_role)
/** Un perfil sin ningún permiso es de sólo lectura */
export const canWrite = (c: Context<AppEnv>) => isAdmin(c) || (c.get('perms') || []).length > 0

export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  if (!isAdmin(c)) return c.json({ error: 'Se requieren permisos de administrador' }, 403)
  await next()
}

export async function requireWrite(c: Context<AppEnv>, next: Next) {
  // Acciones personales permitidas también a perfiles de sólo lectura
  const personal = /\/api\/notifications\/read$/.test(c.req.path)
  if (c.req.method !== 'GET' && !personal && !canWrite(c)) return c.json({ error: 'Tu perfil es de sólo lectura' }, 403)
  await next()
}

/** Acceso a un proyecto: debe pertenecer a una empresa habilitada para el usuario */
export async function projectAccess(c: Context<AppEnv>, projectId: number) {
  const p = await c.env.DB.prepare('SELECT id, company_id, name, responsible_id, rimi_id, stage_key, status FROM projects WHERE id = ?')
    .bind(projectId).first<{ id: number; company_id: number; name: string; responsible_id: number; rimi_id: number; stage_key: string; status: string }>()
  if (!p) return null
  if (!c.get('companyIds').includes(p.company_id)) return null
  return p
}

// ---------------- Microsoft Entra ID (Microsoft 365) ----------------

export function msConfigured(env: AppEnv['Bindings']) {
  return !!(env.MS_CLIENT_ID && env.MS_CLIENT_SECRET && env.MS_TENANT_ID)
}

async function sha256b64url(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return b64(d).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function redirectUri(c: Context<AppEnv>) {
  const base = c.env.APP_URL || new URL(c.req.url).origin
  return `${base.replace(/\/$/, '')}/auth/microsoft/callback`
}

export async function msAuthorizeUrl(c: Context<AppEnv>) {
  const state = randomId(24)
  const verifier = randomId(48)
  await c.env.DB.prepare('INSERT INTO oauth_states (state, verifier) VALUES (?,?)').bind(state, verifier).run()
  await c.env.DB.prepare("DELETE FROM oauth_states WHERE created_at < datetime('now','-15 minutes')").run()
  const params = new URLSearchParams({
    client_id: c.env.MS_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: redirectUri(c),
    response_mode: 'query',
    scope: 'openid profile email User.Read',
    state,
    code_challenge: await sha256b64url(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account'
  })
  return `https://login.microsoftonline.com/${c.env.MS_TENANT_ID}/oauth2/v2.0/authorize?${params}`
}

export async function msExchange(c: Context<AppEnv>, code: string, state: string) {
  const row = await c.env.DB.prepare('SELECT verifier FROM oauth_states WHERE state = ?').bind(state).first<{ verifier: string }>()
  if (!row) throw new Error('Estado OAuth inválido o vencido')
  await c.env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run()
  const res = await fetch(`https://login.microsoftonline.com/${c.env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.env.MS_CLIENT_ID!, client_secret: c.env.MS_CLIENT_SECRET!, grant_type: 'authorization_code',
      code, redirect_uri: redirectUri(c), code_verifier: row.verifier, scope: 'openid profile email User.Read'
    })
  })
  const tok: any = await res.json()
  if (!res.ok) throw new Error(tok.error_description || 'Error al obtener el token de Microsoft')
  const me: any = await (await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,jobTitle,mobilePhone', {
    headers: { Authorization: `Bearer ${tok.access_token}` }
  })).json()
  return {
    oid: me.id as string,
    email: String(me.mail || me.userPrincipalName || '').toLowerCase(),
    name: (me.displayName as string) || '',
    jobTitle: (me.jobTitle as string) || null,
    phone: (me.mobilePhone as string) || null
  }
}
