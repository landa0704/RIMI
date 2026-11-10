import type { Context } from 'hono'
import type { AppEnv } from './types'

// Feriados nacionales Argentina (inamovibles + trasladables estimados) 2026-2028
const HOLIDAYS = new Set([
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-03-23', '2026-03-24', '2026-04-02', '2026-04-03',
  '2026-05-01', '2026-05-25', '2026-06-15', '2026-06-20', '2026-07-09', '2026-07-10', '2026-08-17',
  '2026-10-12', '2026-11-23', '2026-12-07', '2026-12-08', '2026-12-25',
  '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-24', '2027-03-25', '2027-03-26', '2027-04-02',
  '2027-05-01', '2027-05-25', '2027-06-17', '2027-06-20', '2027-07-09', '2027-08-16', '2027-10-11',
  '2027-11-22', '2027-12-08', '2027-12-25',
  '2028-01-01', '2028-02-28', '2028-02-29', '2028-03-24', '2028-04-02', '2028-04-14', '2028-05-01',
  '2028-05-25', '2028-06-20', '2028-07-09', '2028-08-17', '2028-10-12', '2028-11-20', '2028-12-08', '2028-12-25'
])

export const isoDate = (d: Date) => d.toISOString().slice(0, 10)
export const today = () => isoDate(new Date())

export function isBusinessDay(d: Date) {
  const wd = d.getUTCDay()
  return wd !== 0 && wd !== 6 && !HOLIDAYS.has(isoDate(d))
}

/** Suma días hábiles (lunes a viernes, sin feriados nacionales) */
export function addBusinessDays(from: string | Date, days: number): string {
  const d = new Date(typeof from === 'string' ? from + 'T12:00:00Z' : from)
  let n = 0
  while (n < days) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (isBusinessDay(d)) n++
  }
  return isoDate(d)
}

export function businessDaysBetween(a: string, b: string): number {
  const d1 = new Date(a + 'T12:00:00Z'), d2 = new Date(b + 'T12:00:00Z')
  const sign = d2 >= d1 ? 1 : -1
  const cur = new Date(sign > 0 ? d1 : d2), end = sign > 0 ? d2 : d1
  let n = 0
  while (cur < end) { cur.setUTCDate(cur.getUTCDate() + 1); if (isBusinessDay(cur)) n++ }
  return n * sign
}

export const PROJECT_STATUSES = ['activo', 'inactivo']
export const INACTIVE_MSG = 'El proyecto está inactivo: reactivalo desde el menú del proyecto para poder modificarlo.'

export function parseJSON<T = any>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try { return JSON.parse(s) } catch { return fallback }
}

export async function logActivity(c: Context<AppEnv>, a: { project_id?: number | null; investment_id?: number | null; action: string; summary: string; detail?: any }) {
  const u = c.get('user')
  await c.env.DB.prepare('INSERT INTO activity (project_id, investment_id, user_id, action, summary, detail) VALUES (?,?,?,?,?,?)')
    .bind(a.project_id ?? null, a.investment_id ?? null, u?.id ?? null, a.action, a.summary, a.detail ? JSON.stringify(a.detail) : null).run()
}

export async function notify(c: Context<AppEnv>, userIds: (number | null | undefined)[], n: { type: string; title: string; body?: string; link?: string }) {
  const actor = c.get('user')?.id ?? null
  const ids = [...new Set(userIds.filter((x): x is number => !!x && x !== actor))]
  if (!ids.length) return
  const stmt = c.env.DB.prepare('INSERT INTO notifications (user_id, type, title, body, link, actor_id) VALUES (?,?,?,?,?,?)')
  await c.env.DB.batch(ids.map(id => stmt.bind(id, n.type, n.title, n.body ?? null, n.link ?? null, actor)))
}

export async function systemMessage(c: Context<AppEnv>, project_id: number, body: string, investment_id: number | null = null) {
  const u = c.get('user')
  await c.env.DB.prepare("INSERT INTO messages (project_id, investment_id, user_id, body, kind) VALUES (?,?,?,?, 'system')")
    .bind(project_id, investment_id, u.id, body).run()
}

export async function getSettings(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  return Object.fromEntries(results.map(r => [r.key, r.value]))
}

export function pick<T extends Record<string, any>>(obj: T, keys: string[]) {
  const out: Record<string, any> = {}
  for (const k of keys) if (k in obj) out[k] = obj[k] === '' ? null : obj[k]
  return out
}

export function randomId(bytes = 32) {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const err = (c: Context, status: number, message: string) => c.json({ error: message }, status as any)

/** Proyecto inactivo = sólo lectura: devuelve la respuesta de error o null si se puede escribir */
export const inactiveError = (c: Context, p?: { status?: string | null } | null) =>
  p && p.status === 'inactivo' ? err(c, 409, INACTIVE_MSG) : null
