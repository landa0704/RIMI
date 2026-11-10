import { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { hashPassword, isAdmin, can, msConfigured, redirectUri, validatePasswordStrength } from '../lib/auth'
import { PERMISSIONS, STRUCTURAL_FIELDS, parsePerms } from '../lib/permissions'
import { logActivity, notify, pick, err, randomId } from '../lib/util'

const admin = new Hono<AppEnv>()

// Todas las rutas /admin/* requieren admin, salvo las marcadas como RIMI
admin.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname
  const workflowAllowed = /\/admin\/(stage-tasks|recurring)/.test(path) && can(c, 'config.workflow')
  if (!isAdmin(c) && !workflowAllowed) return err(c, 403, 'Se requieren permisos de administrador')
  await next()
})

const SAFE_KEY = /^[a-z][a-z0-9_]{1,40}$/

// ---------------------------------------------------------------- SETTINGS
const PUBLIC_SETTINGS = ['app_name', 'group_name', 'tagline', 'primary_color', 'accent_color', 'program_start', 'rimi_window_start', 'rimi_window_end',
  'default_currency', 'ms_enabled', 'ms_allowed_domains', 'ms_auto_provision', 'ms_default_profile', 'local_login_enabled', 'threshold_micro', 'threshold_pequena', 'threshold_mediana1', 'threshold_mediana2']

admin.get('/admin/settings', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  return c.json({
    settings: Object.fromEntries(results.map(r => [r.key, r.value])),
    integrations: {
      microsoft: { configured: msConfigured(c.env), tenant: c.env.MS_TENANT_ID ? c.env.MS_TENANT_ID.slice(0, 8) + '…' : null, redirect_uri: redirectUri(c) },
      storage: { r2: !!c.env.FILES }
    }
  })
})
admin.put('/admin/settings', async (c) => {
  const b = pick(await c.req.json(), PUBLIC_SETTINGS)
  const stmt = c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
  const entries = Object.entries(b)
  if (entries.length) await c.env.DB.batch(entries.map(([k, v]) => stmt.bind(k, v === null ? '' : String(v))))
  await logActivity(c, { action: 'settings', summary: 'Actualizó la configuración general' })
  return c.json({ ok: true })
})

// ---------------------------------------------------------------- USUARIOS
admin.get('/admin/users', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT u.id, u.email, u.name, u.auth_provider, u.system_role, u.functional_role, u.position, u.phone, u.avatar_color, u.active,
    u.last_login_at, u.created_at, u.must_change_password, (u.password_hash IS NOT NULL) has_password, (u.ms_oid IS NOT NULL) has_ms,
    (SELECT GROUP_CONCAT(company_id) FROM user_companies uc WHERE uc.user_id=u.id) company_ids,
    (SELECT COUNT(*) FROM tasks k WHERE k.assignee_id=u.id AND k.status!='completada') open_tasks,
    (SELECT COUNT(DISTINCT project_id) FROM members m WHERE m.user_id=u.id) projects
    FROM users u ORDER BY u.active DESC, u.name`).all<any>()
  return c.json({ users: results.map(u => ({ ...u, company_ids: u.company_ids ? String(u.company_ids).split(',').map(Number) : [] })) })
})

function tempPassword() {
  return 'Rimi-' + randomId(6).replace(/[^A-Za-z0-9]/g, 'x') + Math.floor(Math.random() * 90 + 10)
}

admin.post('/admin/users', async (c) => {
  const b = await c.req.json()
  const email = String(b.email || '').trim().toLowerCase()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err(c, 400, 'Correo inválido')
  if (!b.name) return err(c, 400, 'El nombre es obligatorio')
  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first()
  if (exists) return err(c, 409, 'Ya existe un usuario con ese correo')
  if (b.system_role && !(await c.env.DB.prepare('SELECT id FROM profiles WHERE key=?').bind(b.system_role).first())) return err(c, 400, 'Perfil inexistente')
  let password: string | null = null
  if (b.auth_provider !== 'microsoft') {
    password = b.password || tempPassword()
    const weak = validatePasswordStrength(password!)
    if (weak) return err(c, 400, weak)
  }
  const colors = ['#00322B', '#4F8226', '#0A88C9', '#0A6FA6', '#C2410C', '#6FA137', '#B8860B', '#1F3A5F', '#A16207', '#BE123C', '#7C3AED']
  const r = await c.env.DB.prepare(`INSERT INTO users (email, name, password_hash, auth_provider, system_role, functional_role, position, phone, avatar_color, must_change_password)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(email, b.name, password ? await hashPassword(password) : null, b.auth_provider === 'microsoft' ? 'microsoft' : 'local',
    b.system_role || 'viewer', b.functional_role || null, b.position || null, b.phone || null, colors[Math.floor(Math.random() * colors.length)], password && !b.password ? 1 : 0).run()
  const id = r.meta.last_row_id as number
  const cids: number[] = Array.isArray(b.company_ids) ? b.company_ids : []
  if (cids.length) await c.env.DB.batch(cids.map(cid => c.env.DB.prepare('INSERT OR IGNORE INTO user_companies (user_id, company_id) VALUES (?,?)').bind(id, cid)))
  await c.env.DB.prepare("INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, 'info', 'Bienvenido a RIMI Hub', 'Tu acceso fue creado. Revisá tus tareas asignadas.', '#/tasks')").bind(id).run()
  await logActivity(c, { action: 'user', summary: `Creó el usuario ${email}` })
  return c.json({ id, temp_password: password && !b.password ? password : null })
})

admin.put('/admin/users/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const b = await c.req.json()
  const vals = pick(b, ['name', 'system_role', 'functional_role', 'position', 'phone', 'active', 'avatar_color', 'auth_provider'])
  if (id === c.get('user').id && (vals.system_role && vals.system_role !== 'admin' || vals.active === 0)) return err(c, 400, 'No podés quitarte permisos de administrador ni desactivarte')
  if (vals.system_role && !(await c.env.DB.prepare('SELECT id FROM profiles WHERE key=?').bind(vals.system_role).first())) return err(c, 400, 'Perfil inexistente')
  const keys = Object.keys(vals)
  if (keys.length) await c.env.DB.prepare(`UPDATE users SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...Object.values(vals), id).run()
  if (Array.isArray(b.company_ids)) {
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM user_companies WHERE user_id=?').bind(id),
      ...b.company_ids.map((cid: number) => c.env.DB.prepare('INSERT OR IGNORE INTO user_companies (user_id, company_id) VALUES (?,?)').bind(id, cid))
    ])
  }
  if (vals.active === 0) await c.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run()
  await logActivity(c, { action: 'user', summary: `Editó el usuario #${id}` })
  return c.json({ ok: true })
})

admin.post('/admin/users/:id/reset-password', async (c) => {
  const id = Number(c.req.param('id'))
  const pass = tempPassword()
  await c.env.DB.prepare('UPDATE users SET password_hash=?, must_change_password=1 WHERE id=?').bind(await hashPassword(pass), id).run()
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run()
  await logActivity(c, { action: 'user', summary: `Restableció la contraseña del usuario #${id}` })
  return c.json({ temp_password: pass })
})

// ---------------------------------------------------------------- PERFILES Y PERMISOS
admin.get('/admin/permissions', (c) => c.json({ permissions: PERMISSIONS }))
admin.get('/admin/profiles', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT p.*, (SELECT COUNT(*) FROM users u WHERE u.system_role=p.key AND u.active=1) users
    FROM profiles p ORDER BY p.sort, p.name`).all<any>()
  return c.json({ profiles: results.map(p => ({ ...p, permissions: parsePerms(p.permissions) })) })
})
admin.post('/admin/profiles', async (c) => {
  const b = await c.req.json()
  if (!b.name) return err(c, 400, 'El nombre es obligatorio')
  let key = String(b.key || b.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30)
  if (!/^[a-z]/.test(key)) key = 'p_' + key
  if (await c.env.DB.prepare('SELECT id FROM profiles WHERE key=?').bind(key).first()) key = key + '_' + Date.now().toString(36).slice(-3)
  let perms = parsePerms(b.permissions)
  if (b.copy_from) {
    const src = await c.env.DB.prepare('SELECT permissions FROM profiles WHERE key=?').bind(b.copy_from).first<{ permissions: string }>()
    if (src && !b.permissions) perms = parsePerms(src.permissions)
  }
  const mx = await c.env.DB.prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM profiles').first<{ s: number }>()
  const r = await c.env.DB.prepare('INSERT INTO profiles (key, name, description, color, permissions, is_system, sort) VALUES (?,?,?,?,?,0,?)')
    .bind(key, b.name, b.description || null, b.color || '#4F8226', JSON.stringify(perms), mx?.s || 99).run()
  await logActivity(c, { action: 'profile', summary: `Creó el perfil "${b.name}"`, detail: { permissions: perms } })
  return c.json({ id: r.meta.last_row_id, key })
})
admin.put('/admin/profiles/:id', async (c) => {
  const p = await c.env.DB.prepare('SELECT * FROM profiles WHERE id=?').bind(c.req.param('id')).first<any>()
  if (!p) return err(c, 404, 'Perfil no encontrado')
  const b = pick(await c.req.json(), ['name', 'description', 'color', 'permissions'])
  if (p.key === 'admin' && 'permissions' in b) return err(c, 400, 'El perfil Administrador siempre tiene todos los permisos')
  if ('permissions' in b) b.permissions = JSON.stringify(parsePerms(b.permissions))
  const keys = Object.keys(b)
  if (keys.length) await c.env.DB.prepare(`UPDATE profiles SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...Object.values(b), p.id).run()
  await logActivity(c, { action: 'profile', summary: `Actualizó el perfil "${b.name || p.name}"`, detail: 'permissions' in b ? { permissions: JSON.parse(b.permissions) } : undefined })
  return c.json({ ok: true })
})
admin.delete('/admin/profiles/:id', async (c) => {
  const p = await c.env.DB.prepare('SELECT * FROM profiles WHERE id=?').bind(c.req.param('id')).first<any>()
  if (!p) return err(c, 404, 'Perfil no encontrado')
  if (p.is_system) return err(c, 409, 'Los perfiles base no se eliminan; podés editar sus permisos')
  const used = await c.env.DB.prepare('SELECT COUNT(*) n FROM users WHERE system_role=?').bind(p.key).first<{ n: number }>()
  if (used?.n) return err(c, 409, `El perfil está asignado a ${used.n} usuario(s). Reasignalos antes de eliminarlo.`)
  await c.env.DB.prepare('DELETE FROM profiles WHERE id=?').bind(p.id).run()
  await logActivity(c, { action: 'profile', summary: `Eliminó el perfil "${p.name}"` })
  return c.json({ ok: true })
})

// ---------------------------------------------------------------- ROLES FUNCIONALES
admin.get('/admin/roles', async (c) => c.json({ roles: (await c.env.DB.prepare('SELECT * FROM functional_roles ORDER BY sort').all()).results }))
admin.post('/admin/roles', async (c) => {
  const b = await c.req.json()
  if (!b.name || !SAFE_KEY.test(b.key || '')) return err(c, 400, 'Nombre y clave (minúsculas, sin espacios) son obligatorios')
  const mx = await c.env.DB.prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM functional_roles').first<{ s: number }>()
  await c.env.DB.prepare('INSERT INTO functional_roles (key, name, description, color, icon, sort, permissions) VALUES (?,?,?,?,?,?,?)').bind(b.key, b.name, b.description || null, b.color || '#4F8226', b.icon || 'user', mx?.s || 99, JSON.stringify(parsePerms(b.permissions))).run()
  await logActivity(c, { action: 'role', summary: `Creó el rol funcional "${b.name}"` })
  return c.json({ ok: true })
})
admin.put('/admin/roles/:id', async (c) => {
  const b = pick(await c.req.json(), ['name', 'description', 'color', 'icon', 'sort', 'permissions'])
  if ('permissions' in b) b.permissions = JSON.stringify(parsePerms(b.permissions))
  const keys = Object.keys(b)
  if ('permissions' in b) await logActivity(c, { action: 'role', summary: `Actualizó los permisos del rol funcional #${c.req.param('id')}` })
  if (keys.length) await c.env.DB.prepare(`UPDATE functional_roles SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...Object.values(b), c.req.param('id')).run()
  return c.json({ ok: true })
})
admin.delete('/admin/roles/:id', async (c) => {
  const r = await c.env.DB.prepare('SELECT key FROM functional_roles WHERE id=?').bind(c.req.param('id')).first<{ key: string }>()
  if (!r) return err(c, 404, 'No encontrado')
  const used = await c.env.DB.prepare('SELECT (SELECT COUNT(*) FROM members WHERE role_key=?1) + (SELECT COUNT(*) FROM users WHERE functional_role=?1) n').bind(r.key).first<{ n: number }>()
  if (used?.n) return err(c, 409, 'El rol está en uso por usuarios o proyectos')
  await c.env.DB.prepare('DELETE FROM functional_roles WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ---------------------------------------------------------------- TIPOS DE PROYECTO
admin.post('/admin/project-types', async (c) => {
  const b = await c.req.json()
  if (!b.name) return err(c, 400, 'Nombre obligatorio')
  const mx = await c.env.DB.prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM project_types').first<{ s: number }>()
  const r = await c.env.DB.prepare('INSERT INTO project_types (name, icon, color, min_exempt, description, sort) VALUES (?,?,?,?,?,?)')
    .bind(b.name, b.icon || 'folder', b.color || '#4F8226', b.min_exempt ? 1 : 0, b.description || null, mx?.s || 99).run()
  return c.json({ id: r.meta.last_row_id })
})
admin.put('/admin/project-types/:id', async (c) => {
  const b = pick(await c.req.json(), ['name', 'icon', 'color', 'min_exempt', 'description', 'sort', 'active'])
  const keys = Object.keys(b)
  if (keys.length) await c.env.DB.prepare(`UPDATE project_types SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...Object.values(b), c.req.param('id')).run()
  return c.json({ ok: true })
})
admin.delete('/admin/project-types/:id', async (c) => {
  const n = await c.env.DB.prepare('SELECT COUNT(*) n FROM projects WHERE type_id=?').bind(c.req.param('id')).first<{ n: number }>()
  if (n?.n) return err(c, 409, 'Hay proyectos con este tipo. Desactivalo en su lugar.')
  await c.env.DB.prepare('DELETE FROM project_types WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ---------------------------------------------------------------- CONSTRUCTOR DE FORMULARIOS
admin.post('/admin/form-sections', async (c) => {
  const b = await c.req.json()
  if (!b.title || !['project', 'investment'].includes(b.entity)) return err(c, 400, 'Título y entidad son obligatorios')
  const key = b.key && /^[A-Za-z0-9_]{1,20}$/.test(b.key) ? b.key : 's' + Date.now().toString(36)
  const mx = await c.env.DB.prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM form_sections WHERE entity=?').bind(b.entity).first<{ s: number }>()
  await c.env.DB.prepare('INSERT INTO form_sections (entity, key, title, description, icon, letter, restricted, sort) VALUES (?,?,?,?,?,?,?,?)')
    .bind(b.entity, key, b.title, b.description || null, b.icon || 'layout-list', b.letter || null, b.restricted ? 1 : 0, mx?.s || 99).run()
  await logActivity(c, { action: 'builder', summary: `Creó la sección "${b.title}"` })
  return c.json({ key })
})
admin.put('/admin/form-sections/:id', async (c) => {
  const b = pick(await c.req.json(), ['title', 'description', 'icon', 'letter', 'restricted', 'sort', 'active'])
  const keys = Object.keys(b)
  if (keys.length) await c.env.DB.prepare(`UPDATE form_sections SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...Object.values(b), c.req.param('id')).run()
  return c.json({ ok: true })
})
admin.delete('/admin/form-sections/:id', async (c) => {
  const s = await c.env.DB.prepare('SELECT * FROM form_sections WHERE id=?').bind(c.req.param('id')).first<any>()
  if (!s) return err(c, 404, 'No encontrada')
  const struct = STRUCTURAL_FIELDS[s.entity] || []
  const { results: inSec } = await c.env.DB.prepare('SELECT key, label FROM form_fields WHERE entity=? AND section_key=? AND deleted_at IS NULL').bind(s.entity, s.key).all<{ key: string; label: string }>()
  const blocking = inSec.filter(f => struct.includes(f.key))
  if (blocking.length) return err(c, 409, `La sección contiene campos estructurales (${blocking.map(f => f.label).join(', ')}). Movelos a otra sección antes de eliminarla.`)
  // todos los campos de la sección van a la papelera (restaurables); la sección se elimina
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE form_fields SET deleted_at=COALESCE(deleted_at, CURRENT_TIMESTAMP), active=0, required=0 WHERE entity=? AND section_key=?').bind(s.entity, s.key),
    c.env.DB.prepare('DELETE FROM form_sections WHERE id=?').bind(s.id)
  ])
  await logActivity(c, { action: 'builder', summary: `Eliminó la sección "${s.title}" (sus campos quedaron en la papelera)` })
  return c.json({ ok: true })
})

const FIELD_TYPES = ['text', 'textarea', 'number', 'money', 'date', 'select', 'multiselect', 'checkbox', 'user', 'ncm', 'email', 'url', 'phone', 'company', 'zone', 'farm', 'project_type']
admin.post('/admin/form-fields', async (c) => {
  const b = await c.req.json()
  if (!b.label || !['project', 'investment'].includes(b.entity) || !b.section_key) return err(c, 400, 'Etiqueta, entidad y sección son obligatorias')
  if (!FIELD_TYPES.includes(b.type || 'text')) return err(c, 400, 'Tipo de campo inválido')
  let key = (b.key || b.label).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 36)
  if (!/^[a-z]/.test(key)) key = 'f_' + key
  const dup = await c.env.DB.prepare('SELECT id FROM form_fields WHERE entity=? AND key=?').bind(b.entity, key).first()
  if (dup) key = key + '_' + Date.now().toString(36).slice(-3)
  const mx = await c.env.DB.prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM form_fields WHERE entity=? AND section_key=?').bind(b.entity, b.section_key).first<{ s: number }>()
  const r = await c.env.DB.prepare(`INSERT INTO form_fields (entity, section_key, key, label, type, options, required, help, placeholder, width, core, sort)
    VALUES (?,?,?,?,?,?,?,?,?,?,0,?)`).bind(b.entity, b.section_key, key, b.label, b.type || 'text', b.options || null, b.required ? 1 : 0, b.help || null,
    b.placeholder || null, b.width || 'half', mx?.s || 99).run()
  await logActivity(c, { action: 'builder', summary: `Agregó el campo "${b.label}"` })
  return c.json({ id: r.meta.last_row_id, key })
})
admin.put('/admin/form-fields/:id', async (c) => {
  const f = await c.env.DB.prepare('SELECT * FROM form_fields WHERE id=?').bind(c.req.param('id')).first<any>()
  if (!f) return err(c, 404, 'No encontrado')
  const allowed = ['label', 'options', 'required', 'help', 'placeholder', 'width', 'sort', 'active', 'section_key', 'readonly']
  if (!f.core) allowed.push('type')
  const b = pick(await c.req.json(), allowed)
  if (b.active === 0 && (STRUCTURAL_FIELDS[f.entity] || []).includes(f.key)) return err(c, 400, 'Este campo es estructural y no puede ocultarse')
  const keys = Object.keys(b)
  if (keys.length) await c.env.DB.prepare(`UPDATE form_fields SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...Object.values(b), f.id).run()
  return c.json({ ok: true })
})
// Eliminar campo: va a la papelera (se puede restaurar). Con ?purge=1 se borra definitivamente (sólo personalizados).
admin.delete('/admin/form-fields/:id', async (c) => {
  const f = await c.env.DB.prepare('SELECT * FROM form_fields WHERE id=?').bind(c.req.param('id')).first<any>()
  if (!f) return err(c, 404, 'No encontrado')
  if ((STRUCTURAL_FIELDS[f.entity] || []).includes(f.key)) return err(c, 409, `"${f.label}" es estructural (organiza empresa, zona, tipo o responsable) y no puede quitarse del formulario.`)
  if (c.req.query('purge') === '1') {
    if (f.core) return err(c, 409, 'Los campos del sistema no se borran definitivamente: quedan en la papelera y se pueden restaurar.')
    await c.env.DB.prepare('DELETE FROM form_fields WHERE id=?').bind(f.id).run()
    await logActivity(c, { action: 'builder', summary: `Borró definitivamente el campo "${f.label}"` })
    return c.json({ ok: true, purged: true })
  }
  await c.env.DB.prepare('UPDATE form_fields SET deleted_at=CURRENT_TIMESTAMP, active=0 WHERE id=?').bind(f.id).run()
  await logActivity(c, { action: 'builder', summary: `Eliminó el campo "${f.label}" (enviado a la papelera)` })
  return c.json({ ok: true, trashed: true })
})
admin.post('/admin/form-fields/:id/restore', async (c) => {
  const f = await c.env.DB.prepare('SELECT * FROM form_fields WHERE id=?').bind(c.req.param('id')).first<any>()
  if (!f) return err(c, 404, 'No encontrado')
  const sec = await c.env.DB.prepare('SELECT key FROM form_sections WHERE entity=? AND key=?').bind(f.entity, f.section_key).first<{ key: string }>()
  const fallback = sec ? null : await c.env.DB.prepare('SELECT key FROM form_sections WHERE entity=? ORDER BY sort LIMIT 1').bind(f.entity).first<{ key: string }>()
  await c.env.DB.prepare('UPDATE form_fields SET deleted_at=NULL, active=1, section_key=COALESCE(?, section_key) WHERE id=?').bind(fallback?.key || null, f.id).run()
  await logActivity(c, { action: 'builder', summary: `Restauró el campo "${f.label}"` })
  return c.json({ ok: true })
})
// Reordenamiento masivo (drag & drop)
admin.post('/admin/reorder', async (c) => {
  const { table, items } = await c.req.json<{ table: string; items: { id: number; sort: number; section_key?: string }[] }>()
  const tables: Record<string, string> = { fields: 'form_fields', sections: 'form_sections', stages: 'stages', roles: 'functional_roles', types: 'project_types', stage_tasks: 'stage_tasks' }
  const t = tables[table]
  if (!t || !Array.isArray(items)) return err(c, 400, 'Parámetros inválidos')
  await c.env.DB.batch(items.map(i => i.section_key && t === 'form_fields'
    ? c.env.DB.prepare(`UPDATE ${t} SET sort=?, section_key=? WHERE id=?`).bind(i.sort, i.section_key, i.id)
    : c.env.DB.prepare(`UPDATE ${t} SET sort=? WHERE id=?`).bind(i.sort, i.id)))
  return c.json({ ok: true })
})

// ---------------------------------------------------------------- FLUJO DE ETAPAS
admin.post('/admin/stages', async (c) => {
  const b = await c.req.json()
  if (!b.name || !['project', 'investment'].includes(b.entity)) return err(c, 400, 'Nombre y entidad obligatorios')
  const key = (b.key || b.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30)
  const mx = await c.env.DB.prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM stages WHERE entity=? AND is_final=0').bind(b.entity).first<{ s: number }>()
  try {
    await c.env.DB.prepare('INSERT INTO stages (entity, key, name, short_name, color, icon, phase, sort, sla_days, role_key, description, is_final) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(b.entity, key, b.name, b.short_name || b.name, b.color || '#4F8226', b.icon || 'circle', b.phase || null, b.sort ?? mx?.s ?? 99, b.sla_days || null, b.role_key || null, b.description || null, b.is_final ? 1 : 0).run()
  } catch { return err(c, 409, 'Ya existe una etapa con esa clave') }
  return c.json({ key })
})
admin.put('/admin/stages/:id', async (c) => {
  const b = pick(await c.req.json(), ['name', 'short_name', 'color', 'icon', 'phase', 'sort', 'sla_days', 'role_key', 'description', 'is_final'])
  const keys = Object.keys(b)
  if (keys.length) await c.env.DB.prepare(`UPDATE stages SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...Object.values(b), c.req.param('id')).run()
  return c.json({ ok: true })
})
admin.delete('/admin/stages/:id', async (c) => {
  const s = await c.env.DB.prepare('SELECT * FROM stages WHERE id=?').bind(c.req.param('id')).first<any>()
  if (!s) return err(c, 404, 'No encontrada')
  const table = s.entity === 'project' ? 'projects' : 'investments'
  const n = await c.env.DB.prepare(`SELECT COUNT(*) n FROM ${table} WHERE stage_key=?`).bind(s.key).first<{ n: number }>()
  if (n?.n) return err(c, 409, `Hay ${n.n} registro(s) en esta etapa`)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM stage_tasks WHERE entity=? AND stage_key=?').bind(s.entity, s.key),
    c.env.DB.prepare('DELETE FROM stages WHERE id=?').bind(s.id)
  ])
  return c.json({ ok: true })
})

// Tareas automáticas por etapa (RIMI también puede editarlas)
admin.get('/admin/stage-tasks', async (c) => c.json({ stage_tasks: (await c.env.DB.prepare('SELECT * FROM stage_tasks ORDER BY entity, stage_key, sort').all()).results }))
admin.post('/admin/stage-tasks', async (c) => {
  const b = await c.req.json()
  if (!b.title || !b.stage_key) return err(c, 400, 'Título y etapa obligatorios')
  const r = await c.env.DB.prepare('INSERT INTO stage_tasks (entity, stage_key, title, description, role_key, due_days, procedure_ref, sort) VALUES (?,?,?,?,?,?,?,?)')
    .bind(b.entity || 'project', b.stage_key, b.title, b.description || null, b.role_key || null, b.due_days || 5, b.procedure_ref || null, b.sort || 99).run()
  return c.json({ id: r.meta.last_row_id })
})
admin.put('/admin/stage-tasks/:id', async (c) => {
  const b = pick(await c.req.json(), ['title', 'description', 'role_key', 'due_days', 'procedure_ref', 'sort', 'active', 'stage_key'])
  const keys = Object.keys(b)
  if (keys.length) await c.env.DB.prepare(`UPDATE stage_tasks SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...Object.values(b), c.req.param('id')).run()
  return c.json({ ok: true })
})
admin.delete('/admin/stage-tasks/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM stage_tasks WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// Agenda recurrente
admin.get('/admin/recurring', async (c) => c.json({ recurring: (await c.env.DB.prepare('SELECT * FROM recurring_events ORDER BY day_from').all()).results }))
admin.post('/admin/recurring', async (c) => {
  const b = await c.req.json()
  if (!b.title || !b.day_from) return err(c, 400, 'Título y día obligatorios')
  await c.env.DB.prepare('INSERT INTO recurring_events (title, description, day_from, day_to, role_key, procedure_ref, color) VALUES (?,?,?,?,?,?,?)')
    .bind(b.title, b.description || null, b.day_from, b.day_to || null, b.role_key || null, b.procedure_ref || null, b.color || '#4F8226').run()
  return c.json({ ok: true })
})
admin.put('/admin/recurring/:id', async (c) => {
  const b = pick(await c.req.json(), ['title', 'description', 'day_from', 'day_to', 'role_key', 'procedure_ref', 'color', 'active'])
  const keys = Object.keys(b)
  if (keys.length) await c.env.DB.prepare(`UPDATE recurring_events SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...Object.values(b), c.req.param('id')).run()
  return c.json({ ok: true })
})
admin.delete('/admin/recurring/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM recurring_events WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// Carpetas y tipos de documento
admin.put('/admin/folders/:id', async (c) => {
  const b = pick(await c.req.json(), ['name', 'description', 'per_investment', 'sort'])
  const keys = Object.keys(b)
  if (keys.length) await c.env.DB.prepare(`UPDATE folders SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...Object.values(b), c.req.param('id')).run()
  return c.json({ ok: true })
})
admin.post('/admin/doc-types', async (c) => {
  const b = await c.req.json()
  if (!b.name || !b.folder_key) return err(c, 400, 'Nombre y carpeta obligatorios')
  const key = b.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30) + '_' + Date.now().toString(36).slice(-3)
  await c.env.DB.prepare('INSERT INTO doc_types (key, name, folder_key, icon, sort) VALUES (?,?,?,?,99)').bind(key, b.name, b.folder_key, b.icon || 'file').run()
  return c.json({ ok: true })
})
admin.delete('/admin/doc-types/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM doc_types WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// Auditoría global
admin.get('/admin/audit', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT a.*, u.name user_name, u.avatar_color, p.name project_name FROM activity a LEFT JOIN users u ON u.id=a.user_id
    LEFT JOIN projects p ON p.id=a.project_id ORDER BY a.id DESC LIMIT 300`).all()
  return c.json({ activity: results })
})

// Comunicado a todos los usuarios
admin.post('/admin/broadcast', async (c) => {
  const { title, body } = await c.req.json()
  if (!title) return err(c, 400, 'Título obligatorio')
  const { results } = await c.env.DB.prepare('SELECT id FROM users WHERE active=1').all<{ id: number }>()
  await notify(c, results.map(r => r.id), { type: 'info', title, body })
  return c.json({ sent: results.length })
})

export default admin
