import { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { isAdmin, isRimi, can, projectAccess } from '../lib/auth'
import { addBusinessDays, getSettings, logActivity, notify, parseJSON, pick, systemMessage, today, err, inactiveError, PROJECT_STATUSES } from '../lib/util'

const core = new Hono<AppEnv>()

const inList = (ids: number[]) => (ids.length ? ids.join(',') : '0')

// ---------------------------------------------------------------- BOOTSTRAP
core.get('/bootstrap', async (c) => {
  const db = c.env.DB
  const ids = inList(c.get('companyIds'))
  const [settings, companies, zones, farms, types, roles, stages, sections, fields, profiles, folders, docTypes, users, unread] = await Promise.all([
    getSettings(db),
    db.prepare(`SELECT * FROM companies WHERE id IN (${ids}) ORDER BY id`).all(),
    db.prepare(`SELECT * FROM zones WHERE company_id IN (${ids}) ORDER BY name`).all(),
    db.prepare(`SELECT f.* FROM farms f JOIN zones z ON z.id=f.zone_id WHERE z.company_id IN (${ids}) ORDER BY f.name`).all(),
    db.prepare('SELECT * FROM project_types ORDER BY sort, name').all(),
    db.prepare('SELECT * FROM functional_roles ORDER BY sort').all(),
    db.prepare('SELECT * FROM stages ORDER BY entity, sort').all(),
    db.prepare('SELECT * FROM form_sections ORDER BY entity, sort').all(),
    db.prepare('SELECT * FROM form_fields ORDER BY entity, sort').all(),
    db.prepare('SELECT id, key, name, description, color, permissions, is_system, sort FROM profiles ORDER BY sort, name').all(),
    db.prepare('SELECT * FROM folders ORDER BY sort').all(),
    db.prepare('SELECT * FROM doc_types ORDER BY sort').all(),
    db.prepare('SELECT id, name, email, system_role, functional_role, position, avatar_color, active FROM users ORDER BY name').all(),
    db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(c.get('user').id).first<{ n: number }>()
  ])
  // no exponer configuración sensible
  return c.json({
    user: { ...c.get('user'), perms: c.get('perms') }, settings, profiles: profiles.results,
    companies: companies.results, zones: zones.results, farms: farms.results, project_types: types.results,
    roles: roles.results, stages: stages.results, form_sections: sections.results, form_fields: fields.results,
    folders: folders.results, doc_types: docTypes.results, users: users.results, unread: unread?.n || 0,
    server_today: today()
  })
})

// ---------------------------------------------------------------- JERARQUÍA
core.get('/tree', async (c) => {
  const db = c.env.DB
  const ids = inList(c.get('companyIds'))
  const [companies, zones, farms, projects] = await Promise.all([
    db.prepare(`SELECT id, name, color, short_code, mipyme_category, active FROM companies WHERE id IN (${ids}) ORDER BY id`).all(),
    db.prepare(`SELECT * FROM zones WHERE company_id IN (${ids}) ORDER BY name`).all(),
    db.prepare(`SELECT f.* FROM farms f JOIN zones z ON z.id=f.zone_id WHERE z.company_id IN (${ids}) ORDER BY f.name`).all(),
    db.prepare(`SELECT p.id, p.code, p.name, p.company_id, p.zone_id, p.farm_id, p.type_id, p.stage_key, p.status, p.budget, p.currency,
      (SELECT COUNT(*) FROM investments i WHERE i.project_id=p.id) inv_count,
      (SELECT COALESCE(SUM(total),0) FROM investments i WHERE i.project_id=p.id) inv_total
      FROM projects p WHERE p.company_id IN (${ids}) ORDER BY p.name`).all()
  ])
  return c.json({ companies: companies.results, zones: zones.results, farms: farms.results, projects: projects.results })
})

// Empresas (admin)
core.post('/companies', async (c) => {
  if (!isAdmin(c)) return err(c, 403, 'Sólo el administrador puede crear empresas')
  const b = await c.req.json()
  if (!b.name) return err(c, 400, 'El nombre es obligatorio')
  const r = await c.env.DB.prepare('INSERT INTO companies (name, short_code, legal_name, cuit, mipyme_category, color, description) VALUES (?,?,?,?,?,?,?)')
    .bind(b.name, b.short_code || null, b.legal_name || null, b.cuit || null, b.mipyme_category || 'pequena', b.color || '#4F8226', b.description || null).run()
  const id = r.meta.last_row_id
  await c.env.DB.prepare('INSERT OR IGNORE INTO user_companies (user_id, company_id) SELECT id, ? FROM users WHERE system_role = \'admin\'').bind(id).run()
  await logActivity(c, { action: 'company', summary: `Creó la empresa ${b.name}` })
  return c.json({ id })
})
core.put('/companies/:id', async (c) => {
  if (!isAdmin(c)) return err(c, 403, 'Sólo el administrador puede editar empresas')
  const b = pick(await c.req.json(), ['name', 'short_code', 'legal_name', 'cuit', 'mipyme_category', 'color', 'description', 'active', 'logo_url'])
  const keys = Object.keys(b)
  if (!keys.length) return c.json({ ok: true })
  await c.env.DB.prepare(`UPDATE companies SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...Object.values(b), c.req.param('id')).run()
  return c.json({ ok: true })
})
core.delete('/companies/:id', async (c) => {
  if (!isAdmin(c)) return err(c, 403, 'Sólo el administrador')
  const n = await c.env.DB.prepare('SELECT COUNT(*) n FROM projects WHERE company_id=?').bind(c.req.param('id')).first<{ n: number }>()
  if (n?.n) return err(c, 409, 'La empresa tiene proyectos. Desactivala en lugar de eliminarla.')
  await c.env.DB.prepare('DELETE FROM companies WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// Zonas
core.post('/zones', async (c) => {
  if (!can(c, 'zones.manage')) return err(c, 403, 'Tu perfil no tiene el permiso "Crear y editar zonas"')
  const b = await c.req.json()
  if (!b.name || !b.company_id) return err(c, 400, 'Nombre y empresa son obligatorios')
  if (!c.get('companyIds').includes(Number(b.company_id))) return err(c, 403, 'Empresa no habilitada')
  const r = await c.env.DB.prepare('INSERT INTO zones (company_id, name, province, locality, description, color) VALUES (?,?,?,?,?,?)')
    .bind(b.company_id, b.name, b.province || null, b.locality || null, b.description || null, b.color || null).run()
  await logActivity(c, { action: 'zone', summary: `Creó la zona ${b.name}` })
  return c.json({ id: r.meta.last_row_id })
})
core.put('/zones/:id', async (c) => {
  if (!can(c, 'zones.manage')) return err(c, 403, 'Tu perfil no tiene el permiso "Crear y editar zonas"')
  const b = pick(await c.req.json(), ['name', 'province', 'locality', 'description', 'color'])
  const keys = Object.keys(b)
  if (keys.length) await c.env.DB.prepare(`UPDATE zones SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...Object.values(b), c.req.param('id')).run()
  return c.json({ ok: true })
})
core.delete('/zones/:id', async (c) => {
  if (!can(c, 'zones.manage')) return err(c, 403, 'Tu perfil no tiene el permiso "Crear y editar zonas"')
  const n = await c.env.DB.prepare('SELECT COUNT(*) n FROM projects WHERE zone_id=?').bind(c.req.param('id')).first<{ n: number }>()
  if (n?.n) return err(c, 409, 'La zona tiene proyectos asociados')
  await c.env.DB.prepare('DELETE FROM zones WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// Fincas
core.post('/farms', async (c) => {
  if (!can(c, 'farms.manage')) return err(c, 403, 'Tu perfil no tiene el permiso "Crear y editar fincas"')
  const b = await c.req.json()
  if (!b.name || !b.zone_id) return err(c, 400, 'Nombre y zona son obligatorios')
  const zf = await c.env.DB.prepare('SELECT company_id FROM zones WHERE id=?').bind(b.zone_id).first<{ company_id: number }>()
  if (!zf || !c.get('companyIds').includes(zf.company_id)) return err(c, 403, 'Zona no habilitada')
  const r = await c.env.DB.prepare('INSERT INTO farms (zone_id, name, address, hectares, lat, lng, notes) VALUES (?,?,?,?,?,?,?)')
    .bind(b.zone_id, b.name, b.address || null, b.hectares || null, b.lat || null, b.lng || null, b.notes || null).run()
  await logActivity(c, { action: 'farm', summary: `Creó la finca ${b.name}` })
  return c.json({ id: r.meta.last_row_id })
})
core.put('/farms/:id', async (c) => {
  if (!can(c, 'farms.manage')) return err(c, 403, 'Tu perfil no tiene el permiso "Crear y editar fincas"')
  const b = pick(await c.req.json(), ['name', 'address', 'hectares', 'lat', 'lng', 'notes', 'zone_id'])
  const keys = Object.keys(b)
  if (keys.length) await c.env.DB.prepare(`UPDATE farms SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...Object.values(b), c.req.param('id')).run()
  return c.json({ ok: true })
})
core.delete('/farms/:id', async (c) => {
  if (!can(c, 'farms.manage')) return err(c, 403, 'Tu perfil no tiene el permiso "Crear y editar fincas"')
  const n = await c.env.DB.prepare('SELECT COUNT(*) n FROM projects WHERE farm_id=?').bind(c.req.param('id')).first<{ n: number }>()
  if (n?.n) return err(c, 409, 'La finca tiene proyectos asociados')
  await c.env.DB.prepare('DELETE FROM farms WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ---------------------------------------------------------------- PROYECTOS
const PROJECT_CORE = ['company_id', 'zone_id', 'farm_id', 'type_id', 'code', 'name', 'responsible_id', 'rimi_id', 'currency', 'budget',
  'first_purchase_date', 'startup_est_date', 'startup_real_date', 'classification', 'dictamen', 'dictamen_date', 'dictamen_notes',
  'ficha_sent_at', 'ficha_version', 'folder_path', 'status']
const RESTRICTED_PROJECT = ['dictamen', 'dictamen_date', 'dictamen_notes', 'rimi_id']

const PROJECT_LIST_SQL = `SELECT p.*, z.name zone_name, f.name farm_name, t.name type_name, t.icon type_icon, t.color type_color, t.min_exempt,
  co.name company_name, co.color company_color, ur.name responsible_name, ur.avatar_color responsible_color, uk.name rimi_name,
  (SELECT COUNT(*) FROM investments i WHERE i.project_id=p.id) inv_count,
  (SELECT COALESCE(SUM(total),0) FROM investments i WHERE i.project_id=p.id) inv_total,
  (SELECT COUNT(*) FROM tasks k WHERE k.project_id=p.id AND k.status!='completada') open_tasks,
  (SELECT COUNT(*) FROM tasks k WHERE k.project_id=p.id AND k.status!='completada' AND k.due_date < date('now')) overdue_tasks,
  (SELECT COUNT(*) FROM documents d WHERE d.project_id=p.id) doc_count,
  (SELECT COUNT(*) FROM checklist_items ci WHERE ci.project_id=p.id AND ci.status IN ('Adjunto','No aplica')) chk_done,
  (SELECT COUNT(*) FROM checklist_items ci WHERE ci.project_id=p.id) chk_total
  FROM projects p
  LEFT JOIN zones z ON z.id=p.zone_id LEFT JOIN farms f ON f.id=p.farm_id LEFT JOIN project_types t ON t.id=p.type_id
  LEFT JOIN companies co ON co.id=p.company_id LEFT JOIN users ur ON ur.id=p.responsible_id LEFT JOIN users uk ON uk.id=p.rimi_id`

core.get('/projects', async (c) => {
  const q = c.req.query()
  const where: string[] = [`p.company_id IN (${inList(c.get('companyIds'))})`]
  const binds: any[] = []
  if (q.company_id) { where.push('p.company_id = ?'); binds.push(q.company_id) }
  if (q.zone_id) { where.push('p.zone_id = ?'); binds.push(q.zone_id) }
  if (q.farm_id) { where.push('p.farm_id = ?'); binds.push(q.farm_id) }
  if (q.type_id) { where.push('p.type_id = ?'); binds.push(q.type_id) }
  if (q.stage) { where.push('p.stage_key = ?'); binds.push(q.stage) }
  if (q.status && PROJECT_STATUSES.includes(q.status)) { where.push('p.status = ?'); binds.push(q.status) }
  if (q.mine === '1') { where.push('(p.responsible_id = ? OR p.rimi_id = ? OR EXISTS (SELECT 1 FROM members m WHERE m.project_id=p.id AND m.user_id=?))'); const u = c.get('user').id; binds.push(u, u, u) }
  if (q.q) { where.push('(p.name LIKE ? OR p.code LIKE ?)'); binds.push(`%${q.q}%`, `%${q.q}%`) }
  const { results } = await c.env.DB.prepare(`${PROJECT_LIST_SQL} WHERE ${where.join(' AND ')} ORDER BY p.updated_at DESC`).bind(...binds).all()
  return c.json({ projects: results.map((p: any) => ({ ...p, data: parseJSON(p.data, {}) })) })
})

async function suggestCode(db: D1Database, companyId: number, zoneId?: number) {
  const co = await db.prepare('SELECT short_code, name FROM companies WHERE id=?').bind(companyId).first<{ short_code: string; name: string }>()
  const z = zoneId ? await db.prepare('SELECT name FROM zones WHERE id=?').bind(zoneId).first<{ name: string }>() : null
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase()
  const prefix = `${co?.short_code || norm(co?.name || 'XX').slice(0, 2)}-${z ? norm(z.name).slice(0, 3) : 'GEN'}-${new Date().getFullYear()}`
  const r = await db.prepare('SELECT COUNT(*) n FROM projects WHERE code LIKE ?').bind(prefix + '-%').first<{ n: number }>()
  return `${prefix}-${String((r?.n || 0) + 1).padStart(3, '0')}`
}

core.get('/projects/suggest-code', async (c) => {
  return c.json({ code: await suggestCode(c.env.DB, Number(c.req.query('company_id')), Number(c.req.query('zone_id')) || undefined) })
})

core.post('/projects', async (c) => {
  const b = await c.req.json()
  const u = c.get('user')
  if (!can(c, 'projects.create')) return err(c, 403, 'Tu perfil no tiene el permiso "Crear proyectos"')
  if (!b.name || !b.company_id) return err(c, 400, 'Nombre y empresa son obligatorios')
  if (!c.get('companyIds').includes(Number(b.company_id))) return err(c, 403, 'Empresa no habilitada')
  // El estado no se fija al crear: todo proyecto nuevo arranca Activo (cambio sólo por PUT /projects/:id/status)
  const coreVals = pick(b, PROJECT_CORE.filter(k => k !== 'status' && (!RESTRICTED_PROJECT.includes(k) || can(c, 'projects.dictamen'))))
  if (!coreVals.code) coreVals.code = await suggestCode(c.env.DB, b.company_id, b.zone_id)
  const codeTaken = await c.env.DB.prepare('SELECT id FROM projects WHERE code = ?').bind(coreVals.code).first()
  if (codeTaken) return err(c, 409, `Ya existe un proyecto con el código ${coreVals.code}. Elegí otro código.`)
  if (!coreVals.responsible_id) coreVals.responsible_id = u.id
  if (!coreVals.rimi_id) {
    const r = await c.env.DB.prepare("SELECT u.id FROM users u WHERE u.functional_role='resp_rimi' AND u.active=1 AND (u.system_role='admin' OR EXISTS (SELECT 1 FROM user_companies uc WHERE uc.user_id=u.id AND uc.company_id=?)) ORDER BY u.id LIMIT 1").bind(b.company_id).first<{ id: number }>()
    if (r) coreVals.rimi_id = r.id
  }
  const data = b.data && typeof b.data === 'object' ? b.data : {}
  const keys = Object.keys(coreVals)
  const r = await c.env.DB.prepare(`INSERT INTO projects (${keys.join(',')}, data, created_by, stage_key) VALUES (${keys.map(() => '?').join(',')}, ?, ?, 'borrador')`)
    .bind(...Object.values(coreVals), JSON.stringify(data), u.id).run()
  const id = r.meta.last_row_id as number
  // checklist + miembros base
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO checklist_items (project_id, item_key, label, required_note, sort) SELECT ?, item_key, label, required_note, sort FROM checklist_templates').bind(id),
    c.env.DB.prepare("INSERT INTO members (project_id, user_id, role_key) VALUES (?, ?, 'resp_proyecto')").bind(id, coreVals.responsible_id),
    ...(coreVals.rimi_id ? [c.env.DB.prepare("INSERT INTO members (project_id, user_id, role_key) VALUES (?, ?, 'resp_rimi')").bind(id, coreVals.rimi_id)] : [])
  ])
  await createStageTasks(c, id, 'borrador')
  await logActivity(c, { project_id: id, action: 'create', summary: 'Creó el proyecto' })
  await systemMessage(c, id, `Proyecto creado por ${u.name}. Etapa inicial: **Ficha en preparación** (10 días hábiles).`)
  await notify(c, [coreVals.responsible_id, coreVals.rimi_id], { type: 'project', title: 'Nuevo proyecto RIMI', body: b.name, link: `#/projects/${id}` })
  return c.json({ id, code: coreVals.code })
})

// Duplicar proyecto: copia ficha y componentes (sin datos fiscales, documentos, tareas ni conversación)
core.post('/projects/:id/duplicate', async (c) => {
  const srcId = Number(c.req.param('id'))
  const src = await projectAccess(c, srcId)
  if (!src) return err(c, 404, 'Proyecto no encontrado')
  if (!can(c, 'projects.create')) return err(c, 403, 'Tu perfil no tiene el permiso "Crear proyectos"')
  const b = await c.req.json<{ name?: string; code?: string; responsible_id?: number; first_purchase_date?: string; startup_est_date?: string }>().catch(() => ({} as any))
  const db = c.env.DB
  const full = await db.prepare('SELECT * FROM projects WHERE id=?').bind(srcId).first<any>()
  const name = (b.name || '').trim() || `${full.name} (copia)`
  const code = (b.code || '').trim() || await suggestCode(db, full.company_id, full.zone_id || undefined)
  const taken = await db.prepare('SELECT id FROM projects WHERE code = ?').bind(code).first()
  if (taken) return err(c, 409, `Ya existe un proyecto con el código ${code}. Elegí otro código.`)
  const u = c.get('user')
  const responsible = Number(b.responsible_id) || u.id
  const rimi = full.rimi_id || null
  const data = parseJSON(full.data, {})
  const r = await db.prepare(`INSERT INTO projects (company_id, zone_id, farm_id, type_id, code, name, responsible_id, rimi_id, currency, budget,
      first_purchase_date, startup_est_date, classification, folder_path, data, created_by, stage_key, status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'borrador', 'activo')`)
    .bind(full.company_id, full.zone_id, full.farm_id, full.type_id, code, name, responsible, rimi, full.currency, 0,
      b.first_purchase_date || null, b.startup_est_date || null, full.classification, null, JSON.stringify(data), u.id).run()
  const id = r.meta.last_row_id as number
  // Componentes: se copian datos técnicos y comerciales; se limpian elegibilidad, validación NCM y BK/BIT
  const { results: invs } = await db.prepare('SELECT * FROM investments WHERE project_id=? ORDER BY seq, id').bind(srcId).all<any>()
  const copyFields = INV_FIELDS.filter(k => !['eligibility', 'ncm_status', 'bk_bit', 'stage_key', 'responsible_id', 'seq', 'code', 'total'].includes(k))
  let seq = 0
  const invStmts = invs.map((i: any) => {
    seq++
    const vals: Record<string, any> = {}
    copyFields.forEach(k => { vals[k] = i[k] ?? null })
    if (vals.quantity != null || vals.unit_price != null) computeTotal(vals)
    vals.seq = seq; vals.code = `INV-${String(seq).padStart(2, '0')}`
    vals.stage_key = 'identificada'; vals.responsible_id = i.responsible_id || responsible
    vals.data = JSON.stringify(parseJSON(i.data, {}))
    const keys = Object.keys(vals)
    return db.prepare(`INSERT INTO investments (project_id, ${keys.join(',')}) VALUES (?, ${keys.map(() => '?').join(',')})`).bind(id, ...Object.values(vals))
  })
  if (invStmts.length) await db.batch(invStmts)
  await db.batch([
    db.prepare('INSERT INTO checklist_items (project_id, item_key, label, required_note, sort) SELECT ?, item_key, label, required_note, sort FROM checklist_templates').bind(id),
    db.prepare("INSERT INTO members (project_id, user_id, role_key) VALUES (?, ?, 'resp_proyecto')").bind(id, responsible),
    ...(rimi ? [db.prepare("INSERT INTO members (project_id, user_id, role_key) VALUES (?, ?, 'resp_rimi')").bind(id, rimi)] : [])
  ])
  await recalcBudget(db, id)
  await createStageTasks(c, id, 'borrador')
  await logActivity(c, { project_id: id, action: 'create', summary: `Creó el proyecto duplicando ${full.code || full.name} (${invs.length} componentes)` })
  await systemMessage(c, id, `Proyecto creado por ${u.name} a partir de **${full.code || full.name}**. Se copiaron ${invs.length} componentes; revisar datos fiscales y fechas.`)
  await notify(c, [responsible, rimi], { type: 'project', title: 'Nuevo proyecto RIMI (duplicado)', body: name, link: `#/projects/${id}` })
  return c.json({ id, code, copied: invs.length })
})

core.get('/projects/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!(await projectAccess(c, id))) return err(c, 404, 'Proyecto no encontrado')
  const db = c.env.DB
  const [p, invs, members, checklist] = await Promise.all([
    db.prepare(`${PROJECT_LIST_SQL} WHERE p.id = ?`).bind(id).first<any>(),
    db.prepare(`SELECT i.*, u.name responsible_name,
      (SELECT COUNT(*) FROM documents d WHERE d.investment_id=i.id) doc_count,
      (SELECT COUNT(*) FROM tasks k WHERE k.investment_id=i.id AND k.status!='completada') open_tasks,
      (SELECT COUNT(*) FROM messages m WHERE m.investment_id=i.id) msg_count
      FROM investments i LEFT JOIN users u ON u.id=i.responsible_id WHERE i.project_id=? ORDER BY i.seq, i.id`).bind(id).all<any>(),
    db.prepare(`SELECT m.*, u.name, u.email, u.avatar_color, u.position, i.code inv_code FROM members m JOIN users u ON u.id=m.user_id
      LEFT JOIN investments i ON i.id=m.investment_id WHERE m.project_id=? ORDER BY m.investment_id IS NOT NULL, m.role_key`).bind(id).all(),
    db.prepare('SELECT * FROM checklist_items WHERE project_id=? ORDER BY sort').bind(id).all()
  ])
  return c.json({
    project: { ...p, data: parseJSON(p.data, {}) },
    investments: invs.results.map(i => ({ ...i, data: parseJSON(i.data, {}) })),
    members: members.results, checklist: checklist.results
  })
})

core.put('/projects/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const prev = await projectAccess(c, id)
  if (!prev) return err(c, 404, 'Proyecto no encontrado')
  const blockedProject = inactiveError(c, prev); if (blockedProject) return blockedProject
  const b = await c.req.json()
  const canEdit = can(c, 'projects.edit') || prev.responsible_id === c.get('user').id
  const canFiscal = can(c, 'projects.dictamen')
  if (!canEdit && !canFiscal) return err(c, 403, 'Tu perfil no tiene el permiso "Editar fichas de proyecto"')
  const allowed = PROJECT_CORE.filter(k => k !== 'status' && (RESTRICTED_PROJECT.includes(k) ? canFiscal : canEdit))
  const vals = pick(b, allowed)
  const ignored = PROJECT_CORE.filter(k => k in b && !allowed.includes(k))
  if (!canEdit) delete b.data
  if (vals.company_id && !c.get('companyIds').includes(Number(vals.company_id))) return err(c, 403, 'Empresa no habilitada')
  const sets = Object.keys(vals).map(k => `${k}=?`)
  const binds: any[] = Object.values(vals)
  if (b.data && typeof b.data === 'object') {
    const cur = await c.env.DB.prepare('SELECT data FROM projects WHERE id=?').bind(id).first<{ data: string }>()
    sets.push('data=?'); binds.push(JSON.stringify({ ...parseJSON(cur?.data, {}), ...b.data }))
  }
  if (!sets.length) return c.json({ ok: true, ignored })
  await c.env.DB.prepare(`UPDATE projects SET ${sets.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...binds, id).run()
  if (vals.dictamen) {
    const full = await c.env.DB.prepare('SELECT dictamen_date FROM projects WHERE id=?').bind(id).first<{ dictamen_date: string }>()
    if (!full?.dictamen_date) await c.env.DB.prepare('UPDATE projects SET dictamen_date=? WHERE id=?').bind(today(), id).run()
    await systemMessage(c, id, `Dictamen registrado: **${vals.dictamen}**. La conformidad no implica aprobación del beneficio, del cupo ni de la inversión.`)
    await notify(c, [prev.responsible_id], { type: 'stage', title: `Dictamen: ${vals.dictamen}`, body: prev.name, link: `#/projects/${id}?tab=ficha` })
  }
  await logActivity(c, { project_id: id, action: 'update', summary: 'Actualizó la ficha del proyecto', detail: Object.keys(vals).concat(b.data ? Object.keys(b.data) : []) })
  if (vals.responsible_id && vals.responsible_id !== prev.responsible_id) {
    await c.env.DB.prepare("INSERT INTO members (project_id, user_id, role_key) SELECT ?, ?, 'resp_proyecto' WHERE NOT EXISTS (SELECT 1 FROM members WHERE project_id=? AND user_id=? AND role_key='resp_proyecto' AND investment_id IS NULL)")
      .bind(id, vals.responsible_id, id, vals.responsible_id).run()
    await notify(c, [vals.responsible_id], { type: 'project', title: 'Fuiste designado Responsable del Proyecto', body: prev.name, link: `#/projects/${id}` })
  }
  return c.json({ ok: true, ignored })
})

// Activar / desactivar proyecto (permiso "projects.status", configurable en Perfiles y permisos)
core.put('/projects/:id/status', async (c) => {
  const id = Number(c.req.param('id'))
  const p = await projectAccess(c, id)
  if (!p) return err(c, 404, 'Proyecto no encontrado')
  if (!can(c, 'projects.status')) return err(c, 403, 'Tu perfil no tiene el permiso "Activar o desactivar proyectos"')
  const { status } = await c.req.json<{ status?: string }>().catch(() => ({} as { status?: string }))
  if (!status || !PROJECT_STATUSES.includes(status)) return err(c, 400, 'Estado inválido (activo o inactivo)')
  if (status === p.status) return c.json({ ok: true, status })
  await c.env.DB.prepare('UPDATE projects SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status, id).run()
  const label = status === 'activo' ? 'Activo' : 'Inactivo'
  await logActivity(c, { project_id: id, action: 'status', summary: `Marcó el proyecto como ${label}` })
  await systemMessage(c, id, `${c.get('user').name} marcó el proyecto como **${label}**${status === 'inactivo' ? '. Queda en sólo lectura hasta reactivarlo.' : '.'}`)
  return c.json({ ok: true, status })
})

core.delete('/projects/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!can(c, 'projects.delete')) return err(c, 403, 'Tu perfil no tiene el permiso "Eliminar proyectos"')
  if (!(await projectAccess(c, id))) return err(c, 404, 'Proyecto no encontrado')
  const docs = await c.env.DB.prepare('SELECT r2_key FROM documents WHERE project_id=? AND r2_key IS NOT NULL').bind(id).all<{ r2_key: string }>()
  if (c.env.FILES) for (const d of docs.results) await c.env.FILES.delete(d.r2_key).catch(() => { })
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM messages WHERE project_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM tasks WHERE project_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM documents WHERE project_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM checklist_items WHERE project_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM members WHERE project_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM investments WHERE project_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM activity WHERE project_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM projects WHERE id=?').bind(id)
  ])
  return c.json({ ok: true })
})

/** Crea las tareas automáticas configuradas para una etapa */
async function createStageTasks(c: any, projectId: number, stageKey: string) {
  const db: D1Database = c.env.DB
  const { results: tpl } = await db.prepare("SELECT * FROM stage_tasks WHERE entity='project' AND stage_key=? AND active=1 ORDER BY sort").bind(stageKey).all<any>()
  if (!tpl.length) return 0
  const { results: mem } = await db.prepare('SELECT user_id, role_key FROM members WHERE project_id=? AND investment_id IS NULL').bind(projectId).all<{ user_id: number; role_key: string }>()
  const fallback = await db.prepare('SELECT responsible_id, rimi_id, company_id FROM projects WHERE id=?').bind(projectId).first<{ responsible_id: number; rimi_id: number; company_id: number }>()
  const findUser = async (role: string) => {
    const m = mem.find(x => x.role_key === role)
    if (m) return m.user_id
    // sólo usuarios con acceso a la empresa del proyecto (evita asignar tareas de Solfrut a usuarios de otra empresa)
    const u = await db.prepare("SELECT u.id FROM users u WHERE u.functional_role=? AND u.active=1 AND (u.system_role='admin' OR EXISTS (SELECT 1 FROM user_companies uc WHERE uc.user_id=u.id AND uc.company_id=?)) ORDER BY u.id LIMIT 1").bind(role, fallback?.company_id || 0).first<{ id: number }>()
    if (u) return u.id
    return role === 'resp_rimi' ? fallback?.rimi_id : fallback?.responsible_id
  }
  const stmt = db.prepare("INSERT INTO tasks (project_id, title, description, assignee_id, role_key, created_by, due_date, status, priority, stage_key, procedure_ref, auto) VALUES (?,?,?,?,?,?,?, 'pendiente', ?, ?, ?, 1)")
  const batch = []
  const assignees: number[] = []
  for (const t of tpl) {
    const a = await findUser(t.role_key)
    if (a) assignees.push(a)
    batch.push(stmt.bind(projectId, t.title, t.description, a ?? null, t.role_key, c.get('user').id, addBusinessDays(today(), t.due_days || 5),
      (t.due_days || 5) <= 2 ? 'alta' : 'media', stageKey, t.procedure_ref))
  }
  await db.batch(batch)
  const p = await db.prepare('SELECT name FROM projects WHERE id=?').bind(projectId).first<{ name: string }>()
  await notify(c, assignees, { type: 'task', title: 'Nuevas tareas asignadas', body: `${p?.name}: ${tpl.length} tarea(s) de la etapa`, link: `#/projects/${projectId}?tab=tasks` })
  return tpl.length
}

// Cambio de etapa con validaciones del procedimiento
core.post('/projects/:id/stage', async (c) => {
  const id = Number(c.req.param('id'))
  const p = await projectAccess(c, id)
  if (!p) return err(c, 404, 'Proyecto no encontrado')
  const blockedStage = inactiveError(c, p); if (blockedStage) return blockedStage
  const { stage_key, note, force } = await c.req.json<{ stage_key: string; note?: string; force?: boolean }>()
  const db = c.env.DB
  const target = await db.prepare("SELECT * FROM stages WHERE entity='project' AND key=?").bind(stage_key).first<any>()
  const current = await db.prepare("SELECT * FROM stages WHERE entity='project' AND key=?").bind(p.stage_key).first<any>()
  if (!target) return err(c, 400, 'Etapa inválida')
  const u = c.get('user')
  const isOwner = p.responsible_id === u.id
  // Permisos: avanzar desde borrador → responsable o RIMI; resto → RIMI o rol de la etapa actual
  const allowed = can(c, 'projects.stage') || (p.stage_key === 'borrador' && isOwner) || (current?.role_key && current.role_key === u.functional_role)
  if (!allowed) return err(c, 403, 'No tenés permisos para cambiar la etapa de este proyecto')

  const warnings: string[] = []
  const full = await db.prepare('SELECT * FROM projects WHERE id=?').bind(id).first<any>()
  const invCount = await db.prepare('SELECT COUNT(*) n FROM investments WHERE project_id=?').bind(id).first<{ n: number }>()
  if (stage_key === 'evaluacion') {
    const data = parseJSON(full.data, {} as any)
    const { results: req } = await db.prepare("SELECT key, label, core FROM form_fields WHERE entity='project' AND required=1 AND active=1 AND deleted_at IS NULL AND section_key IN (SELECT key FROM form_sections WHERE entity='project' AND restricted=0)").all<any>()
    const missing = req.filter(f => { const v = f.core ? full[f.key] : data[f.key]; return v === null || v === undefined || v === '' }).map(f => f.label)
    if (missing.length) warnings.push(`Campos obligatorios incompletos: ${missing.join(', ')}`)
    if (!invCount?.n) warnings.push('La ficha no tiene componentes cargados (hoja 02)')
  }
  if (stage_key === 'contable' && !full.dictamen) warnings.push('No se registró el dictamen de elegibilidad')
  if (warnings.length && !force) return c.json({ ok: false, warnings }, 422)

  const sets = ['stage_key=?', 'stage_changed_at=CURRENT_TIMESTAMP', 'updated_at=CURRENT_TIMESTAMP']
  const binds: any[] = [stage_key]
  if (stage_key === 'evaluacion' && !full.ficha_sent_at) { sets.push('ficha_sent_at=?'); binds.push(today()) }
  if (stage_key === 'contable' && !full.dictamen_date) { sets.push('dictamen_date=?'); binds.push(today()) }
  await db.prepare(`UPDATE projects SET ${sets.join(',')} WHERE id=?`).bind(...binds, id).run()
  const n = await createStageTasks(c, id, stage_key)
  const forward = (target.sort || 0) > (current?.sort || 0)
  await logActivity(c, { project_id: id, action: 'stage', summary: `${forward ? 'Avanzó' : 'Retrocedió'} a ${target.name}`, detail: { from: p.stage_key, to: stage_key, note, warnings } })
  await systemMessage(c, id, `${u.name} movió el proyecto a **${target.name}**${n ? ` · se generaron ${n} tareas del procedimiento` : ''}${note ? `\n> ${note}` : ''}${warnings.length ? `\n⚠ Avance forzado: ${warnings.join(' · ')}` : ''}`)
  const { results: mem } = await db.prepare('SELECT DISTINCT user_id FROM members WHERE project_id=?').bind(id).all<{ user_id: number }>()
  await notify(c, mem.map(m => m.user_id), { type: 'stage', title: `${p.name} → ${target.name}`, body: note || target.description, link: `#/projects/${id}` })
  return c.json({ ok: true, tasks_created: n })
})

// ---------------------------------------------------------------- INVERSIONES
const INV_FIELDS = ['component_type', 'description', 'brand_model', 'quantity', 'unit', 'ncm', 'ncm_status', 'supplier', 'supplier_cuit', 'unit_price',
  'currency', 'total', 'purchase_date', 'invoice_date', 'startup_date', 'spec_doc', 'eligibility', 'bk_bit', 'stage_key', 'responsible_id', 'serial_number', 'is_new', 'seq', 'code']
const RESTRICTED_INV = ['eligibility', 'ncm_status', 'bk_bit']

function computeTotal(v: Record<string, any>, prev?: any) {
  const q = v.quantity ?? prev?.quantity, up = v.unit_price ?? prev?.unit_price
  if (q !== null && q !== undefined && up !== null && up !== undefined && q !== '' && up !== '') v.total = Math.round(Number(q) * Number(up) * 100) / 100
}

async function recalcBudget(db: D1Database, projectId: number) {
  await db.prepare('UPDATE projects SET budget = (SELECT COALESCE(SUM(total),0) FROM investments WHERE project_id=?), updated_at=CURRENT_TIMESTAMP WHERE id=? AND (SELECT COUNT(*) FROM investments WHERE project_id=?) > 0')
    .bind(projectId, projectId, projectId).run()
}

core.post('/projects/:id/investments', async (c) => {
  const pid = Number(c.req.param('id'))
  const pAcc = await projectAccess(c, pid)
  if (!pAcc) return err(c, 404, 'Proyecto no encontrado')
  const blockedInv = inactiveError(c, pAcc); if (blockedInv) return blockedInv
  const invEdit = can(c, 'investments.edit') || pAcc.responsible_id === c.get('user').id
  const invFiscal = can(c, 'projects.dictamen')
  if (!invEdit) return err(c, 403, 'Tu perfil no tiene el permiso "Cargar y editar bienes"')
  const b = await c.req.json()
  if (!b.description) return err(c, 400, 'La descripción técnica es obligatoria')
  const vals = pick(b, INV_FIELDS.filter(k => !RESTRICTED_INV.includes(k) || invFiscal))
  computeTotal(vals)
  const mx = await c.env.DB.prepare('SELECT COALESCE(MAX(seq),0) m FROM investments WHERE project_id=?').bind(pid).first<{ m: number }>()
  vals.seq = (mx?.m || 0) + 1
  vals.code = vals.code || `INV-${String(vals.seq).padStart(2, '0')}`
  const data = b.data && typeof b.data === 'object' ? b.data : {}
  const keys = Object.keys(vals)
  const r = await c.env.DB.prepare(`INSERT INTO investments (project_id, ${keys.join(',')}, data) VALUES (?, ${keys.map(() => '?').join(',')}, ?)`)
    .bind(pid, ...Object.values(vals), JSON.stringify(data)).run()
  await recalcBudget(c.env.DB, pid)
  await logActivity(c, { project_id: pid, investment_id: r.meta.last_row_id as number, action: 'investment', summary: `Agregó ${vals.code}: ${b.description}` })
  return c.json({ id: r.meta.last_row_id, code: vals.code })
})

core.get('/investments/:id', async (c) => {
  const inv = await c.env.DB.prepare('SELECT i.*, u.name responsible_name FROM investments i LEFT JOIN users u ON u.id=i.responsible_id WHERE i.id=?').bind(c.req.param('id')).first<any>()
  if (!inv || !(await projectAccess(c, inv.project_id))) return err(c, 404, 'Inversión no encontrada')
  const members = await c.env.DB.prepare('SELECT m.*, u.name, u.email, u.avatar_color FROM members m JOIN users u ON u.id=m.user_id WHERE m.investment_id=?').bind(inv.id).all()
  return c.json({ investment: { ...inv, data: parseJSON(inv.data, {}) }, members: members.results })
})

core.put('/investments/:id', async (c) => {
  const inv = await c.env.DB.prepare('SELECT * FROM investments WHERE id=?').bind(c.req.param('id')).first<any>()
  if (!inv) return err(c, 404, 'Inversión no encontrada')
  const pAcc = await projectAccess(c, inv.project_id)
  if (!pAcc) return err(c, 404, 'Inversión no encontrada')
  const blockedInv = inactiveError(c, pAcc); if (blockedInv) return blockedInv
  const invEdit = can(c, 'investments.edit') || pAcc.responsible_id === c.get('user').id
  const invFiscal = can(c, 'projects.dictamen')
  if (!invEdit && !invFiscal) return err(c, 403, 'Tu perfil no tiene el permiso "Cargar y editar bienes"')
  const b = await c.req.json()
  const vals = pick(b, INV_FIELDS.filter(k => RESTRICTED_INV.includes(k) ? invFiscal : invEdit))
  if (!invEdit) delete b.data
  if ('quantity' in vals || 'unit_price' in vals) computeTotal(vals, inv)
  const sets = Object.keys(vals).map(k => `${k}=?`)
  const binds: any[] = Object.values(vals)
  if (b.data && typeof b.data === 'object') { sets.push('data=?'); binds.push(JSON.stringify({ ...parseJSON(inv.data, {}), ...b.data })) }
  if (!sets.length) return c.json({ ok: true })
  await c.env.DB.prepare(`UPDATE investments SET ${sets.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...binds, inv.id).run()
  await recalcBudget(c.env.DB, inv.project_id)
  if (vals.stage_key && vals.stage_key !== inv.stage_key) {
    const st = await c.env.DB.prepare("SELECT name FROM stages WHERE entity='investment' AND key=?").bind(vals.stage_key).first<{ name: string }>()
    await logActivity(c, { project_id: inv.project_id, investment_id: inv.id, action: 'stage', summary: `${inv.code} → ${st?.name}` })
    await systemMessage(c, inv.project_id, `${c.get('user').name} movió **${inv.code} · ${inv.description}** a **${st?.name}**`, inv.id)
  } else if (vals.eligibility && vals.eligibility !== inv.eligibility) {
    await logActivity(c, { project_id: inv.project_id, investment_id: inv.id, action: 'dictamen', summary: `${inv.code}: ${vals.eligibility}` })
    await systemMessage(c, inv.project_id, `Elegibilidad de **${inv.code}** actualizada a **${vals.eligibility}**`, inv.id)
  } else {
    await logActivity(c, { project_id: inv.project_id, investment_id: inv.id, action: 'update', summary: `Editó ${inv.code}` })
  }
  return c.json({ ok: true })
})

core.delete('/investments/:id', async (c) => {
  const inv = await c.env.DB.prepare('SELECT * FROM investments WHERE id=?').bind(c.req.param('id')).first<any>()
  if (!inv) return err(c, 404, 'Inversión no encontrada')
  const pDel = await projectAccess(c, inv.project_id)
  if (!pDel) return err(c, 404, 'Inversión no encontrada')
  const blockedInv = inactiveError(c, pDel); if (blockedInv) return blockedInv
  const mayEdit = can(c, 'investments.edit') || pDel.responsible_id === c.get('user').id
  if (!can(c, 'investments.delete') && !(mayEdit && inv.stage_key === 'identificada')) return err(c, 403, 'Sólo se pueden eliminar componentes en estado "Identificada" (o con el permiso "Eliminar bienes en cualquier estado")')
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE documents SET investment_id=NULL WHERE investment_id=?').bind(inv.id),
    c.env.DB.prepare('DELETE FROM tasks WHERE investment_id=?').bind(inv.id),
    c.env.DB.prepare('DELETE FROM messages WHERE investment_id=?').bind(inv.id),
    c.env.DB.prepare('DELETE FROM members WHERE investment_id=?').bind(inv.id),
    c.env.DB.prepare('DELETE FROM investments WHERE id=?').bind(inv.id)
  ])
  await recalcBudget(c.env.DB, inv.project_id)
  await logActivity(c, { project_id: inv.project_id, action: 'investment', summary: `Eliminó ${inv.code}: ${inv.description}` })
  return c.json({ ok: true })
})

// Importación masiva de componentes (hoja 02 pegada desde Excel / CSV)
core.post('/projects/:id/investments/bulk', async (c) => {
  const pid = Number(c.req.param('id'))
  const pb = await projectAccess(c, pid)
  if (!pb) return err(c, 404, 'Proyecto no encontrado')
  const blockedBulk = inactiveError(c, pb); if (blockedBulk) return blockedBulk
  if (!can(c, 'investments.edit') && pb.responsible_id !== c.get('user').id) return err(c, 403, 'Tu perfil no tiene el permiso "Cargar y editar bienes"')
  const { rows } = await c.req.json<{ rows: any[] }>()
  if (!Array.isArray(rows) || !rows.length) return err(c, 400, 'No hay filas para importar')
  const mx = await c.env.DB.prepare('SELECT COALESCE(MAX(seq),0) m FROM investments WHERE project_id=?').bind(pid).first<{ m: number }>()
  let seq = mx?.m || 0
  const stmts = rows.filter(r => r.description).slice(0, 200).map(r => {
    const v = pick(r, INV_FIELDS.filter(k => !RESTRICTED_INV.includes(k)))
    computeTotal(v)
    seq++; v.seq = seq; v.code = `INV-${String(seq).padStart(2, '0')}`
    const keys = Object.keys(v)
    return c.env.DB.prepare(`INSERT INTO investments (project_id, ${keys.join(',')}) VALUES (?, ${keys.map(() => '?').join(',')})`).bind(pid, ...Object.values(v))
  })
  if (stmts.length) await c.env.DB.batch(stmts)
  await recalcBudget(c.env.DB, pid)
  await logActivity(c, { project_id: pid, action: 'investment', summary: `Importó ${stmts.length} componentes` })
  return c.json({ imported: stmts.length })
})

// ---------------------------------------------------------------- MIEMBROS
core.post('/projects/:id/members', async (c) => {
  const pid = Number(c.req.param('id'))
  const p = await projectAccess(c, pid)
  if (!p) return err(c, 404, 'Proyecto no encontrado')
  const blockedMember = inactiveError(c, p); if (blockedMember) return blockedMember
  if (!can(c, 'members.manage') && p.responsible_id !== c.get('user').id) return err(c, 403, 'Sólo el Responsable del Proyecto o un perfil con "Gestionar el equipo" pueden gestionar participantes')
  const { user_id, role_key, investment_id } = await c.req.json()
  if (!user_id || !role_key) return err(c, 400, 'Usuario y rol son obligatorios')
  const exists = await c.env.DB.prepare('SELECT id FROM members WHERE project_id=? AND user_id=? AND role_key=? AND IFNULL(investment_id,0)=IFNULL(?,0)').bind(pid, user_id, role_key, investment_id || null).first()
  if (exists) return err(c, 409, 'Ese participante ya tiene ese rol')
  await c.env.DB.prepare('INSERT INTO members (project_id, investment_id, user_id, role_key) VALUES (?,?,?,?)').bind(pid, investment_id || null, user_id, role_key).run()
  const role = await c.env.DB.prepare('SELECT name FROM functional_roles WHERE key=?').bind(role_key).first<{ name: string }>()
  await notify(c, [user_id], { type: 'member', title: `Te sumaron a ${p.name}`, body: `Rol: ${role?.name || role_key}`, link: `#/projects/${pid}` })
  await logActivity(c, { project_id: pid, investment_id, action: 'member', summary: `Sumó un participante como ${role?.name || role_key}` })
  return c.json({ ok: true })
})
core.delete('/members/:id', async (c) => {
  const m = await c.env.DB.prepare('SELECT * FROM members WHERE id=?').bind(c.req.param('id')).first<any>()
  if (!m) return err(c, 404, 'No encontrado')
  const p = await projectAccess(c, m.project_id)
  if (!p) return err(c, 404, 'No encontrado')
  const blockedMember = inactiveError(c, p); if (blockedMember) return blockedMember
  if (!can(c, 'members.manage') && p.responsible_id !== c.get('user').id) return err(c, 403, 'Sin permisos para gestionar el equipo')
  await c.env.DB.prepare('DELETE FROM members WHERE id=?').bind(m.id).run()
  return c.json({ ok: true })
})

// ---------------------------------------------------------------- CHECKLIST
core.put('/checklist/:id', async (c) => {
  const it = await c.env.DB.prepare('SELECT * FROM checklist_items WHERE id=?').bind(c.req.param('id')).first<any>()
  const pc = it ? await projectAccess(c, it.project_id) : null
  if (!it || !pc) return err(c, 404, 'No encontrado')
  const blockedChk = inactiveError(c, pc); if (blockedChk) return blockedChk
  if (!can(c, 'projects.edit') && pc.responsible_id !== c.get('user').id) return err(c, 403, 'Tu perfil no tiene el permiso "Editar fichas de proyecto"')
  const b = pick(await c.req.json(), ['status', 'reference', 'notes'])
  const keys = Object.keys(b)
  if (keys.length) await c.env.DB.prepare(`UPDATE checklist_items SET ${keys.map(k => `${k}=?`).join(',')}, updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...Object.values(b), c.get('user').id, it.id).run()
  if (b.status && b.status !== it.status) await logActivity(c, { project_id: it.project_id, action: 'checklist', summary: `${it.label}: ${b.status}` })
  return c.json({ ok: true })
})

// ---------------------------------------------------------------- ACTIVIDAD
core.get('/projects/:id/activity', async (c) => {
  const pid = Number(c.req.param('id'))
  if (!(await projectAccess(c, pid))) return err(c, 404, 'Proyecto no encontrado')
  const { results } = await c.env.DB.prepare(`SELECT a.*, u.name user_name, u.avatar_color FROM activity a LEFT JOIN users u ON u.id=a.user_id
    WHERE a.project_id=? ORDER BY a.created_at DESC, a.id DESC LIMIT 200`).bind(pid).all()
  return c.json({ activity: results })
})

export default core
export { createStageTasks }
