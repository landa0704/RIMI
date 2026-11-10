import { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { can, projectAccess } from '../lib/auth'
import { logActivity, notify, pick, today, err, getSettings, parseJSON, inactiveError } from '../lib/util'

const work = new Hono<AppEnv>()
const inList = (ids: number[]) => (ids.length ? ids.join(',') : '0')

// ---------------------------------------------------------------- TAREAS
const TASK_SQL = `SELECT k.*, p.name project_name, p.code project_code, p.responsible_id project_responsible_id, i.code inv_code, i.description inv_description,
  ua.name assignee_name, ua.avatar_color assignee_color, uc.name creator_name,
  (SELECT COUNT(*) FROM messages m WHERE m.task_id=k.id) msg_count
  FROM tasks k LEFT JOIN projects p ON p.id=k.project_id LEFT JOIN investments i ON i.id=k.investment_id
  LEFT JOIN users ua ON ua.id=k.assignee_id LEFT JOIN users uc ON uc.id=k.created_by`

work.get('/tasks', async (c) => {
  const q = c.req.query()
  const where = [`p.company_id IN (${inList(c.get('companyIds'))})`]
  const binds: any[] = []
  if (q.project_id) { where.push('k.project_id=?'); binds.push(q.project_id) }
  if (q.investment_id) { where.push('k.investment_id=?'); binds.push(q.investment_id) }
  if (q.assignee === 'me') { where.push('k.assignee_id=?'); binds.push(c.get('user').id) }
  else if (q.assignee) { where.push('k.assignee_id=?'); binds.push(q.assignee) }
  if (q.created === 'me') { where.push('k.created_by=?'); binds.push(c.get('user').id) }
  if (q.status === 'open') where.push("k.status!='completada'")
  else if (q.status) { where.push('k.status=?'); binds.push(q.status) }
  if (q.role) { where.push('k.role_key=?'); binds.push(q.role) }
  const { results } = await c.env.DB.prepare(`${TASK_SQL} WHERE ${where.join(' AND ')}
    ORDER BY CASE k.status WHEN 'completada' THEN 1 ELSE 0 END, k.due_date IS NULL, k.due_date, CASE k.priority WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END LIMIT 500`).bind(...binds).all()
  return c.json({ tasks: results })
})

work.post('/tasks', async (c) => {
  const b = await c.req.json()
  if (!b.title || !b.project_id) return err(c, 400, 'Título y proyecto son obligatorios')
  const p = await projectAccess(c, Number(b.project_id))
  if (!p) return err(c, 404, 'Proyecto no encontrado')
  const blockedTask = inactiveError(c, p); if (blockedTask) return blockedTask
  if (!can(c, 'tasks.create') && p.responsible_id !== c.get('user').id) return err(c, 403, 'Tu perfil no tiene el permiso "Crear tareas"')
  const r = await c.env.DB.prepare(`INSERT INTO tasks (project_id, investment_id, title, description, assignee_id, role_key, created_by, due_date, status, priority, procedure_ref)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(b.project_id, b.investment_id || null, b.title, b.description || null, b.assignee_id || null, b.role_key || null,
    c.get('user').id, b.due_date || null, b.status || 'pendiente', b.priority || 'media', b.procedure_ref || null).run()
  await logActivity(c, { project_id: b.project_id, investment_id: b.investment_id, action: 'task', summary: `Creó la tarea "${b.title}"` })
  await notify(c, [b.assignee_id], { type: 'task', title: 'Nueva tarea asignada', body: `${b.title} · ${p.name}`, link: `#/tasks?open=${r.meta.last_row_id}` })
  return c.json({ id: r.meta.last_row_id })
})

work.get('/tasks/:id', async (c) => {
  const t = await c.env.DB.prepare(`${TASK_SQL} WHERE k.id=?`).bind(c.req.param('id')).first<any>()
  if (!t || !(await projectAccess(c, t.project_id))) return err(c, 404, 'Tarea no encontrada')
  return c.json({ task: t })
})

work.put('/tasks/:id', async (c) => {
  const t = await c.env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(c.req.param('id')).first<any>()
  if (!t) return err(c, 404, 'Tarea no encontrada')
  const p = await projectAccess(c, t.project_id)
  if (!p) return err(c, 404, 'Tarea no encontrada')
  const blockedTask = inactiveError(c, p); if (blockedTask) return blockedTask
  const u = c.get('user')
  const b = pick(await c.req.json(), ['title', 'description', 'assignee_id', 'role_key', 'due_date', 'status', 'priority', 'investment_id'])
  // El asignado puede cambiar estado; creador, responsable y RIMI pueden editar todo
  const canAll = can(c, 'tasks.manage') || t.created_by === u.id || p.responsible_id === u.id
  if (!canAll) {
    const onlyStatus = Object.keys(b).every(k => k === 'status')
    if (!(t.assignee_id === u.id && onlyStatus)) return err(c, 403, 'Sólo podés cambiar el estado de tus tareas')
  }
  const sets = Object.keys(b).map(k => `${k}=?`)
  const binds: any[] = Object.values(b)
  if (b.status === 'completada' && t.status !== 'completada') sets.push('completed_at=CURRENT_TIMESTAMP')
  if (b.status && b.status !== 'completada') sets.push('completed_at=NULL')
  if (!sets.length) return c.json({ ok: true })
  await c.env.DB.prepare(`UPDATE tasks SET ${sets.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...binds, t.id).run()
  if (b.status && b.status !== t.status) {
    const labels: Record<string, string> = { pendiente: 'Pendiente', en_curso: 'En curso', bloqueada: 'Bloqueada', completada: 'Completada' }
    await logActivity(c, { project_id: t.project_id, investment_id: t.investment_id, action: 'task', summary: `"${t.title}" → ${labels[b.status] || b.status}` })
    await c.env.DB.prepare("INSERT INTO messages (project_id, task_id, user_id, body, kind) VALUES (?,?,?,?, 'system')").bind(t.project_id, t.id, u.id, `${u.name} cambió el estado a **${labels[b.status]}**`).run()
    await notify(c, [t.created_by, t.assignee_id], { type: 'task', title: `Tarea ${labels[b.status]?.toLowerCase()}`, body: t.title, link: `#/tasks?open=${t.id}` })
  }
  if (b.assignee_id && b.assignee_id !== t.assignee_id) {
    await notify(c, [b.assignee_id], { type: 'task', title: 'Te reasignaron una tarea', body: `${t.title} · ${p.name}`, link: `#/tasks?open=${t.id}` })
    await logActivity(c, { project_id: t.project_id, action: 'task', summary: `Reasignó "${t.title}"` })
  }
  return c.json({ ok: true })
})

work.delete('/tasks/:id', async (c) => {
  const t = await c.env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(c.req.param('id')).first<any>()
  if (!t) return err(c, 404, 'Tarea no encontrada')
  const p = await projectAccess(c, t.project_id)
  const blockedTask = inactiveError(c, p); if (blockedTask) return blockedTask
  if (!p || !(can(c, 'tasks.manage') || t.created_by === c.get('user').id || p.responsible_id === c.get('user').id)) return err(c, 403, 'Sin permisos para eliminar esta tarea')
  await c.env.DB.batch([c.env.DB.prepare('DELETE FROM messages WHERE task_id=?').bind(t.id), c.env.DB.prepare('DELETE FROM tasks WHERE id=?').bind(t.id)])
  return c.json({ ok: true })
})

// ---------------------------------------------------------------- CHAT
work.get('/messages', async (c) => {
  const q = c.req.query()
  const pid = Number(q.project_id)
  if (!pid || !(await projectAccess(c, pid))) return err(c, 404, 'Proyecto no encontrado')
  const where = ['m.project_id=?']; const binds: any[] = [pid]
  if (q.task_id) { where.push('m.task_id=?'); binds.push(q.task_id) }
  else if (q.investment_id) { where.push('m.investment_id=?'); binds.push(q.investment_id) }
  else if (q.scope !== 'all') where.push('m.task_id IS NULL')
  if (q.after) { where.push('m.id > ?'); binds.push(q.after) }
  const { results } = await c.env.DB.prepare(`SELECT m.*, u.name user_name, u.avatar_color, u.functional_role, i.code inv_code
    FROM messages m JOIN users u ON u.id=m.user_id LEFT JOIN investments i ON i.id=m.investment_id
    WHERE ${where.join(' AND ')} ORDER BY m.id DESC LIMIT 300`).bind(...binds).all()
  return c.json({ messages: results.reverse() })
})

work.post('/messages', async (c) => {
  const b = await c.req.json()
  const pid = Number(b.project_id)
  const body = String(b.body || '').trim()
  if (!body) return err(c, 400, 'El mensaje está vacío')
  if (body.length > 5000) return err(c, 400, 'Mensaje demasiado largo')
  const p = await projectAccess(c, pid)
  if (!p) return err(c, 404, 'Proyecto no encontrado')
  const blockedChat = inactiveError(c, p); if (blockedChat) return blockedChat
  if (!can(c, 'chat.write')) return err(c, 403, 'Tu perfil no tiene el permiso "Escribir en conversaciones"')
  const u = c.get('user')
  const r = await c.env.DB.prepare('INSERT INTO messages (project_id, investment_id, task_id, user_id, body) VALUES (?,?,?,?,?)')
    .bind(pid, b.investment_id || null, b.task_id || null, u.id, body).run()
  await c.env.DB.prepare('UPDATE projects SET updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(pid).run()
  // Menciones: @Nombre (primer nombre o nombre completo)
  const { results: users } = await c.env.DB.prepare('SELECT id, name FROM users WHERE active=1').all<{ id: number; name: string }>()
  const lower = body.toLowerCase()
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const nl = norm(lower)
  const mentioned = users.filter(x => {
    const full = norm(x.name), first = full.replace(/^(ing\.|lic\.|cr\.|dr\.)\s*/, '').split(' ')[0]
    return nl.includes('@' + full.replace(/\s+/g, ' ')) || new RegExp(`@${first}(\\b|$)`).test(nl)
  }).map(x => x.id)
  const link = b.task_id ? `#/tasks?open=${b.task_id}` : `#/projects/${pid}?tab=chat${b.investment_id ? `&inv=${b.investment_id}` : ''}`
  await notify(c, mentioned, { type: 'mention', title: `${u.name} te mencionó`, body: body.slice(0, 140), link })
  // Notificar a participantes (sin los mencionados)
  let others: number[] = []
  if (b.task_id) {
    const t = await c.env.DB.prepare('SELECT assignee_id, created_by FROM tasks WHERE id=?').bind(b.task_id).first<any>()
    others = [t?.assignee_id, t?.created_by]
  } else {
    const { results: mem } = await c.env.DB.prepare('SELECT DISTINCT user_id FROM members WHERE project_id=? AND (investment_id IS NULL OR investment_id=?)').bind(pid, b.investment_id || 0).all<{ user_id: number }>()
    others = mem.map(m => m.user_id)
  }
  await notify(c, others.filter(x => !mentioned.includes(x)), { type: 'message', title: `${u.name} escribió en ${p.name}`, body: body.slice(0, 140), link })
  return c.json({ id: r.meta.last_row_id })
})

// Bandeja de conversaciones (último mensaje por proyecto)
work.get('/conversations', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT p.id project_id, p.name, p.code, t.color type_color, t.icon type_icon,
    (SELECT body FROM messages m WHERE m.project_id=p.id AND m.task_id IS NULL ORDER BY m.id DESC LIMIT 1) last_body,
    (SELECT created_at FROM messages m WHERE m.project_id=p.id AND m.task_id IS NULL ORDER BY m.id DESC LIMIT 1) last_at,
    (SELECT u.name FROM messages m JOIN users u ON u.id=m.user_id WHERE m.project_id=p.id AND m.task_id IS NULL ORDER BY m.id DESC LIMIT 1) last_user,
    (SELECT COUNT(*) FROM messages m WHERE m.project_id=p.id) total
    FROM projects p LEFT JOIN project_types t ON t.id=p.type_id WHERE p.company_id IN (${inList(c.get('companyIds'))})
    ORDER BY last_at IS NULL, last_at DESC`).all()
  return c.json({ conversations: results })
})

// ---------------------------------------------------------------- NOTIFICACIONES
work.get('/notifications', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT n.*, u.name actor_name, u.avatar_color actor_color FROM notifications n LEFT JOIN users u ON u.id=n.actor_id
    WHERE n.user_id=? ORDER BY n.id DESC LIMIT 80`).bind(c.get('user').id).all()
  const unread = await c.env.DB.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read_at IS NULL').bind(c.get('user').id).first<{ n: number }>()
  return c.json({ notifications: results, unread: unread?.n || 0 })
})
work.get('/notifications/count', async (c) => {
  const r = await c.env.DB.prepare('SELECT COUNT(*) n, MAX(id) last FROM notifications WHERE user_id=? AND read_at IS NULL').bind(c.get('user').id).first<{ n: number; last: number }>()
  return c.json({ unread: r?.n || 0, last: r?.last || 0 })
})
work.post('/notifications/read', async (c) => {
  const { id } = await c.req.json<{ id?: number }>().catch(() => ({} as any))
  if (id) await c.env.DB.prepare('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').bind(id, c.get('user').id).run()
  else await c.env.DB.prepare('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL').bind(c.get('user').id).run()
  return c.json({ ok: true })
})

// ---------------------------------------------------------------- DOCUMENTOS
work.get('/documents', async (c) => {
  const q = c.req.query()
  const where = [`p.company_id IN (${inList(c.get('companyIds'))})`]; const binds: any[] = []
  if (q.project_id) { where.push('d.project_id=?'); binds.push(q.project_id) }
  if (q.investment_id) { where.push('d.investment_id=?'); binds.push(q.investment_id) }
  if (q.folder) { where.push('d.folder_key=?'); binds.push(q.folder) }
  if (q.q) { where.push('(d.name LIKE ? OR d.supplier LIKE ? OR d.doc_number LIKE ?)'); binds.push(`%${q.q}%`, `%${q.q}%`, `%${q.q}%`) }
  const { results } = await c.env.DB.prepare(`SELECT d.*, p.name project_name, p.code project_code, i.code inv_code, i.description inv_description, u.name uploader_name, dt.name type_name, dt.icon type_icon
    FROM documents d JOIN projects p ON p.id=d.project_id LEFT JOIN investments i ON i.id=d.investment_id LEFT JOIN users u ON u.id=d.uploaded_by LEFT JOIN doc_types dt ON dt.key=d.doc_type
    WHERE ${where.join(' AND ')} ORDER BY d.created_at DESC LIMIT 500`).bind(...binds).all()
  return c.json({ documents: results, storage: !!c.env.FILES })
})

const MAX_FILE = 25 * 1024 * 1024
work.post('/documents', async (c) => {
  const form = await c.req.parseBody()
  const pid = Number(form.project_id)
  const p = await projectAccess(c, pid)
  if (!p) return err(c, 404, 'Proyecto no encontrado')
  const blockedDoc = inactiveError(c, p); if (blockedDoc) return blockedDoc
  if (!can(c, 'documents.upload')) return err(c, 403, 'Tu perfil no tiene el permiso "Subir documentos"')
  const file = form.file as File | undefined
  const meta = {
    investment_id: form.investment_id ? Number(form.investment_id) : null,
    folder_key: (form.folder_key as string) || null, doc_type: (form.doc_type as string) || 'otro',
    doc_number: (form.doc_number as string) || null, doc_date: (form.doc_date as string) || null,
    amount: form.amount ? Number(form.amount) : null, currency: (form.currency as string) || null,
    supplier: (form.supplier as string) || null, notes: (form.notes as string) || null
  }
  if (!meta.folder_key) {
    const dt = await c.env.DB.prepare('SELECT folder_key FROM doc_types WHERE key=?').bind(meta.doc_type).first<{ folder_key: string }>()
    meta.folder_key = dt?.folder_key || '00'
  }
  let name = (form.name as string) || '', r2_key: string | null = null, size: number | null = null, mime: string | null = null
  if (file && typeof file === 'object') {
    if (file.size > MAX_FILE) return err(c, 413, 'El archivo supera los 25 MB')
    name = name || file.name; size = file.size; mime = file.type || 'application/octet-stream'
    if (c.env.FILES) {
      r2_key = `projects/${pid}/${meta.folder_key}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`
      await c.env.FILES.put(r2_key, file.stream(), { httpMetadata: { contentType: mime } })
    }
  }
  if (!name) return err(c, 400, 'Adjuntá un archivo o indicá un nombre de referencia')
  const r = await c.env.DB.prepare(`INSERT INTO documents (project_id, investment_id, folder_key, doc_type, name, r2_key, size, mime, doc_number, doc_date, amount, currency, supplier, notes, uploaded_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(pid, meta.investment_id, meta.folder_key, meta.doc_type, name, r2_key, size, mime, meta.doc_number, meta.doc_date,
    meta.amount, meta.currency, meta.supplier, meta.notes, c.get('user').id).run()
  await logActivity(c, { project_id: pid, investment_id: meta.investment_id, action: 'document', summary: `Subió "${name}"` })
  const { results: mem } = await c.env.DB.prepare("SELECT DISTINCT user_id FROM members WHERE project_id=? AND role_key IN ('resp_rimi','resp_proyecto')").bind(pid).all<{ user_id: number }>()
  await notify(c, mem.map(m => m.user_id), { type: 'document', title: `Nuevo documento en ${p.name}`, body: name, link: `#/projects/${pid}?tab=docs` })
  return c.json({ id: r.meta.last_row_id, stored: !!r2_key })
})

work.put('/documents/:id', async (c) => {
  const d = await c.env.DB.prepare('SELECT * FROM documents WHERE id=?').bind(c.req.param('id')).first<any>()
  const pd = d ? await projectAccess(c, d.project_id) : null
  if (!d || !pd) return err(c, 404, 'Documento no encontrado')
  const blockedDoc = inactiveError(c, pd); if (blockedDoc) return blockedDoc
  const b = pick(await c.req.json(), ['name', 'investment_id', 'folder_key', 'doc_type', 'status', 'doc_number', 'doc_date', 'amount', 'currency', 'supplier', 'notes'])
  if (b.status && b.status !== d.status && !can(c, 'documents.validate')) return err(c, 403, 'Tu perfil no tiene el permiso "Validar documentos"')
  if (!can(c, 'documents.upload') && Object.keys(b).some(k => k !== 'status')) return err(c, 403, 'Tu perfil no tiene el permiso "Subir documentos"')
  const keys = Object.keys(b)
  if (keys.length) await c.env.DB.prepare(`UPDATE documents SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`).bind(...Object.values(b), d.id).run()
  if (b.status && b.status !== d.status) await logActivity(c, { project_id: d.project_id, action: 'document', summary: `"${d.name}" → ${b.status}` })
  return c.json({ ok: true })
})

work.delete('/documents/:id', async (c) => {
  const d = await c.env.DB.prepare('SELECT * FROM documents WHERE id=?').bind(c.req.param('id')).first<any>()
  const pd = d ? await projectAccess(c, d.project_id) : null
  if (!d || !pd) return err(c, 404, 'Documento no encontrado')
  const blockedDoc = inactiveError(c, pd); if (blockedDoc) return blockedDoc
  if (!can(c, 'documents.delete') && d.uploaded_by !== c.get('user').id) return err(c, 403, 'Sólo quien lo subió o un perfil con "Eliminar documentos de otros" puede eliminarlo')
  if (d.r2_key && c.env.FILES) await c.env.FILES.delete(d.r2_key).catch(() => { })
  await c.env.DB.prepare('DELETE FROM documents WHERE id=?').bind(d.id).run()
  await logActivity(c, { project_id: d.project_id, action: 'document', summary: `Eliminó "${d.name}"` })
  return c.json({ ok: true })
})

work.get('/documents/:id/file', async (c) => {
  const d = await c.env.DB.prepare('SELECT * FROM documents WHERE id=?').bind(c.req.param('id')).first<any>()
  if (!d || !(await projectAccess(c, d.project_id))) return err(c, 404, 'Documento no encontrado')
  if (!d.r2_key || !c.env.FILES) return err(c, 404, 'Este documento es una referencia sin archivo almacenado')
  const obj = await c.env.FILES.get(d.r2_key)
  if (!obj) return err(c, 404, 'Archivo no encontrado en el almacenamiento')
  const inline = c.req.query('inline') === '1'
  return new Response(obj.body, {
    headers: {
      'Content-Type': d.mime || 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(d.name)}`,
      'Cache-Control': 'private, max-age=300'
    }
  })
})

// ---------------------------------------------------------------- DASHBOARD
work.get('/dashboard', async (c) => {
  const db = c.env.DB
  const ids = inList(c.get('companyIds'))
  const uid = c.get('user').id
  const s = await getSettings(db)
  const [byStage, byType, byZone, totals, myTasks, overdue, upcoming, activity, invByElig, invByStage, deadlines] = await Promise.all([
    db.prepare(`SELECT stage_key, COUNT(*) n, COALESCE(SUM(budget),0) amount FROM projects WHERE company_id IN (${ids}) GROUP BY stage_key`).all(),
    db.prepare(`SELECT t.id, t.name, t.color, t.icon, COUNT(p.id) n, COALESCE(SUM(p.budget),0) amount FROM project_types t LEFT JOIN projects p ON p.type_id=t.id AND p.company_id IN (${ids}) GROUP BY t.id HAVING n>0 ORDER BY amount DESC`).all(),
    db.prepare(`SELECT z.id, z.name, z.color, COUNT(p.id) n, COALESCE(SUM(p.budget),0) amount FROM zones z LEFT JOIN projects p ON p.zone_id=z.id WHERE z.company_id IN (${ids}) GROUP BY z.id ORDER BY amount DESC`).all(),
    db.prepare(`SELECT COUNT(*) projects, COALESCE(SUM(budget),0) budget,
      (SELECT COUNT(*) FROM investments i JOIN projects p ON p.id=i.project_id WHERE p.company_id IN (${ids})) investments,
      (SELECT COUNT(*) FROM documents d JOIN projects p ON p.id=d.project_id WHERE p.company_id IN (${ids})) documents,
      (SELECT COALESCE(SUM(i.total),0) FROM investments i JOIN projects p ON p.id=i.project_id WHERE p.company_id IN (${ids}) AND i.eligibility IN ('General elegible','Específica elegible')) eligible_amount
      FROM projects WHERE company_id IN (${ids})`).first<any>(),
    db.prepare(`SELECT k.*, p.name project_name, i.code inv_code FROM tasks k JOIN projects p ON p.id=k.project_id LEFT JOIN investments i ON i.id=k.investment_id
      WHERE k.assignee_id=? AND k.status!='completada' AND p.company_id IN (${ids}) ORDER BY k.due_date IS NULL, k.due_date LIMIT 8`).bind(uid).all(),
    db.prepare(`SELECT COUNT(*) n FROM tasks k JOIN projects p ON p.id=k.project_id WHERE k.status!='completada' AND k.due_date < date('now') AND p.company_id IN (${ids})`).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) n FROM tasks k JOIN projects p ON p.id=k.project_id WHERE k.status!='completada' AND k.due_date BETWEEN date('now') AND date('now','+7 days') AND p.company_id IN (${ids})`).first<{ n: number }>(),
    db.prepare(`SELECT a.*, u.name user_name, u.avatar_color, p.name project_name FROM activity a LEFT JOIN users u ON u.id=a.user_id LEFT JOIN projects p ON p.id=a.project_id
      WHERE a.project_id IS NOT NULL AND p.company_id IN (${ids}) ORDER BY a.created_at DESC, a.id DESC LIMIT 12`).all(),
    db.prepare(`SELECT i.eligibility, COUNT(*) n, COALESCE(SUM(i.total),0) amount FROM investments i JOIN projects p ON p.id=i.project_id WHERE p.company_id IN (${ids}) GROUP BY i.eligibility`).all(),
    db.prepare(`SELECT i.stage_key, COUNT(*) n FROM investments i JOIN projects p ON p.id=i.project_id WHERE p.company_id IN (${ids}) GROUP BY i.stage_key`).all(),
    db.prepare(`SELECT p.id, p.name, p.code, p.stage_key, p.first_purchase_date, p.startup_est_date, p.stage_changed_at, t.color type_color, t.icon type_icon
      FROM projects p LEFT JOIN project_types t ON t.id=p.type_id WHERE p.company_id IN (${ids}) AND p.stage_key!='cerrado' ORDER BY p.startup_est_date LIMIT 10`).all()
  ])
  return c.json({
    settings: { program_start: s.program_start, window_start: s.rimi_window_start, window_end: s.rimi_window_end },
    by_stage: byStage.results, by_type: byType.results, by_zone: byZone.results, totals,
    my_tasks: myTasks.results, overdue: overdue?.n || 0, upcoming: upcoming?.n || 0, activity: activity.results,
    inv_by_eligibility: invByElig.results, inv_by_stage: invByStage.results, deadlines: deadlines.results
  })
})

// ---------------------------------------------------------------- CALENDARIO
work.get('/calendar', async (c) => {
  const db = c.env.DB
  const ids = inList(c.get('companyIds'))
  const from = c.req.query('from') || today().slice(0, 8) + '01'
  const to = c.req.query('to') || today()
  const [tasks, projects, invs, recurring] = await Promise.all([
    db.prepare(`SELECT k.id, k.title, k.due_date date, k.status, k.priority, k.project_id, p.name project_name, ua.name assignee_name FROM tasks k JOIN projects p ON p.id=k.project_id
      LEFT JOIN users ua ON ua.id=k.assignee_id WHERE p.company_id IN (${ids}) AND k.due_date BETWEEN ? AND ?`).bind(from, to).all(),
    db.prepare(`SELECT id, name, code, first_purchase_date, startup_est_date, startup_real_date FROM projects WHERE company_id IN (${ids})`).all<any>(),
    db.prepare(`SELECT i.id, i.code, i.description, i.purchase_date, i.invoice_date, i.startup_date, i.project_id, p.name project_name FROM investments i JOIN projects p ON p.id=i.project_id
      WHERE p.company_id IN (${ids}) AND (i.purchase_date BETWEEN ?1 AND ?2 OR i.startup_date BETWEEN ?1 AND ?2 OR i.invoice_date BETWEEN ?1 AND ?2)`).bind(from, to).all<any>(),
    db.prepare('SELECT * FROM recurring_events WHERE active=1').all<any>()
  ])
  const events: any[] = []
  for (const t of tasks.results as any[]) events.push({ kind: 'task', date: t.date, title: t.title, sub: t.project_name, status: t.status, priority: t.priority, link: `#/tasks?open=${t.id}`, who: t.assignee_name })
  for (const p of projects.results) {
    const add = (d: string, label: string, kind: string) => { if (d && d >= from && d <= to) events.push({ kind, date: d, title: `${label}: ${p.name}`, sub: p.code, link: `#/projects/${p.id}` }) }
    add(p.first_purchase_date, 'Primera compra', 'purchase'); add(p.startup_est_date, 'Puesta en marcha est.', 'startup'); add(p.startup_real_date, 'Puesta en marcha real', 'startup')
  }
  for (const i of invs.results) {
    const add = (d: string, label: string, kind: string) => { if (d && d >= from && d <= to) events.push({ kind, date: d, title: `${label} ${i.code}`, sub: `${i.description} · ${i.project_name}`, link: `#/projects/${i.project_id}?tab=investments&inv=${i.id}` }) }
    add(i.purchase_date, 'Compra', 'purchase'); add(i.invoice_date, 'Factura', 'invoice'); add(i.startup_date, 'Puesta en marcha', 'startup')
  }
  // Agenda recurrente mensual
  const start = new Date(from + 'T12:00:00Z'), end = new Date(to + 'T12:00:00Z')
  for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 12)); d <= end; d.setUTCMonth(d.getUTCMonth() + 1)) {
    for (const r of recurring.results) {
      const y = d.getUTCFullYear(), m = d.getUTCMonth()
      const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
      const day = Math.min(r.day_to || r.day_from, last)
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      if (date >= from && date <= to) events.push({ kind: 'recurring', date, title: r.title, sub: `${r.day_to && r.day_to !== r.day_from ? `Del ${r.day_from} al ${r.day_to}` : `Día ${r.day_from}`} · ${r.procedure_ref}`, color: r.color, role: r.role_key, description: r.description })
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date))
  return c.json({ events })
})

// ---------------------------------------------------------------- REPORTES
work.get('/reports/summary', async (c) => {
  const db = c.env.DB
  const ids = inList(c.get('companyIds'))
  const s = await getSettings(db)
  const { results: projects } = await db.prepare(`SELECT p.*, z.name zone_name, f.name farm_name, t.name type_name, t.min_exempt, co.name company_name, co.mipyme_category, ur.name responsible_name,
    (SELECT COALESCE(SUM(total),0) FROM investments i WHERE i.project_id=p.id) inv_total,
    (SELECT COALESCE(SUM(total),0) FROM investments i WHERE i.project_id=p.id AND i.eligibility IN ('General elegible','Específica elegible')) eligible_total,
    (SELECT COUNT(*) FROM investments i WHERE i.project_id=p.id) inv_count,
    (SELECT COUNT(*) FROM investments i WHERE i.project_id=p.id AND i.eligibility='Pendiente de validación') pending_count,
    (SELECT COUNT(*) FROM tasks k WHERE k.project_id=p.id AND k.status!='completada' AND k.due_date < date('now')) overdue,
    (SELECT COUNT(*) FROM checklist_items ci WHERE ci.project_id=p.id AND ci.status IN ('Adjunto','No aplica')) chk_done,
    (SELECT COUNT(*) FROM checklist_items ci WHERE ci.project_id=p.id) chk_total
    FROM projects p LEFT JOIN zones z ON z.id=p.zone_id LEFT JOIN farms f ON f.id=p.farm_id LEFT JOIN project_types t ON t.id=p.type_id
    LEFT JOIN companies co ON co.id=p.company_id LEFT JOIN users ur ON ur.id=p.responsible_id WHERE p.company_id IN (${ids}) ORDER BY co.name, z.name, p.name`).all<any>()
  const thresholds: Record<string, number> = { micro: +s.threshold_micro, pequena: +s.threshold_pequena, mediana1: +s.threshold_mediana1, mediana2: +s.threshold_mediana2 }
  return c.json({
    thresholds,
    projects: projects.map(p => ({ ...p, data: parseJSON(p.data, {}), threshold: p.min_exempt ? 0 : thresholds[p.mipyme_category] || 0 }))
  })
})

work.get('/reports/investments', async (c) => {
  const ids = inList(c.get('companyIds'))
  const { results } = await c.env.DB.prepare(`SELECT i.*, p.name project_name, p.code project_code, z.name zone_name, f.name farm_name, t.name type_name, co.name company_name
    FROM investments i JOIN projects p ON p.id=i.project_id LEFT JOIN zones z ON z.id=p.zone_id LEFT JOIN farms f ON f.id=p.farm_id
    LEFT JOIN project_types t ON t.id=p.type_id LEFT JOIN companies co ON co.id=p.company_id WHERE p.company_id IN (${ids}) ORDER BY p.code, i.seq`).all()
  return c.json({ investments: results })
})

// Búsqueda global
work.get('/search', async (c) => {
  const q = `%${(c.req.query('q') || '').trim()}%`
  if (q.length < 4) return c.json({ results: [] })
  const ids = inList(c.get('companyIds'))
  const db = c.env.DB
  const [p, i, d, z] = await Promise.all([
    db.prepare(`SELECT id, name title, code sub FROM projects WHERE company_id IN (${ids}) AND (name LIKE ?1 OR code LIKE ?1) LIMIT 6`).bind(q).all(),
    db.prepare(`SELECT i.id, i.project_id, i.code || ' · ' || i.description title, p.name sub FROM investments i JOIN projects p ON p.id=i.project_id WHERE p.company_id IN (${ids}) AND (i.description LIKE ?1 OR i.ncm LIKE ?1 OR i.supplier LIKE ?1 OR i.brand_model LIKE ?1) LIMIT 8`).bind(q).all(),
    db.prepare(`SELECT d.id, d.project_id, d.name title, p.name sub FROM documents d JOIN projects p ON p.id=d.project_id WHERE p.company_id IN (${ids}) AND (d.name LIKE ?1 OR d.doc_number LIKE ?1 OR d.supplier LIKE ?1) LIMIT 6`).bind(q).all(),
    db.prepare(`SELECT z.id, z.name title, z.province sub FROM zones z WHERE z.company_id IN (${ids}) AND z.name LIKE ?1 LIMIT 4`).bind(q).all()
  ])
  return c.json({
    results: [
      ...p.results.map((x: any) => ({ type: 'project', icon: 'folder-kanban', ...x, link: `#/projects/${x.id}` })),
      ...i.results.map((x: any) => ({ type: 'investment', icon: 'package', ...x, link: `#/projects/${x.project_id}?tab=investments&inv=${x.id}` })),
      ...d.results.map((x: any) => ({ type: 'document', icon: 'file-text', ...x, link: `#/projects/${x.project_id}?tab=docs` })),
      ...z.results.map((x: any) => ({ type: 'zone', icon: 'map-pin', ...x, link: `#/explorer?zone=${x.id}` }))
    ]
  })
})

export default work
 work
