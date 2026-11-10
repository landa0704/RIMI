// Pruebas funcionales end-to-end de la API RIMI Hub
const BASE = process.env.BASE || 'http://localhost:3000'
const RUN = Date.now().toString(36)
let pass = 0, fail = 0
const results = []
function ok(cond, name, extra = '') { if (cond) { pass++; results.push('✔ ' + name) } else { fail++; results.push('✘ ' + name + ' ' + extra) } }
async function session(email, password = 'Rimi2026!') {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0]
  const call = async (path, method = 'GET', body, raw) => {
    const init = { method, headers: { cookie } }
    if (body instanceof FormData) init.body = body
    else if (body !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body) }
    const res = await fetch(BASE + (path.startsWith('/') ? path : '/api/' + path), init)
    if (raw) return res
    let data = {}; try { data = await res.json() } catch { }
    return { status: res.status, data }
  }
  return { status: r.status, call }
}

// --- Auth
const bad = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@phronesis.com.ar', password: 'mal' }) })
ok(bad.status === 401, 'Login con clave incorrecta rechazado')
const noauth = await fetch(BASE + '/api/projects')
ok(noauth.status === 401, 'API protegida sin sesión → 401')
const admin = await session('admin@phronesis.com.ar'); ok(admin.status === 200, 'Login admin')
const rimi = await session('rimi@solfrut.com.ar'); ok(rimi.status === 200, 'Login RIMI')
const proy = await session('proyecto@solfrut.com.ar')
const compras = await session('compras@solfrut.com.ar')
const dir = await session('direccion@solfrut.com.ar')
const cfg = await (await fetch(BASE + '/api/auth/config')).json()
ok(cfg.microsoft && cfg.microsoft.configured === false, 'Config pública informa estado SSO Microsoft')
const ms = await fetch(BASE + '/auth/microsoft', { redirect: 'manual' })
ok(ms.status === 302 && (ms.headers.get('location') || '').includes('login?error'), 'SSO sin configurar redirige con mensaje claro')

// --- Bootstrap
const boot = await admin.call('bootstrap')
ok(boot.status === 200 && boot.data.form_fields.length > 50, 'Bootstrap con catálogos del Anexo I', boot.data.form_fields?.length)
ok(boot.data.stages.filter(s => s.entity === 'project').length === 9, '9 etapas de proyecto del procedimiento')
ok(boot.data.roles.length >= 9, 'Roles funcionales cargados')

// --- Jerarquía: zona + finca
const z = await rimi.call('zones', 'POST', { company_id: 1, name: `Zona Test ${RUN}`, province: 'La Rioja' }); ok(z.status === 200, 'RIMI crea zona')
const f = await rimi.call('farms', 'POST', { zone_id: z.data.id, name: 'Finca Test', hectares: 50 }); ok(f.status === 200, 'RIMI crea finca')
const zc = await compras.call('zones', 'POST', { company_id: 1, name: 'X' }); ok(zc.status === 403, 'Compras NO puede crear zonas')

// --- Proyecto
const sc = await proy.call(`projects/suggest-code?company_id=1&zone_id=${z.data.id}`)
ok(/^SF-[A-Z]{3}-\d{4}-\d{3}$/.test(sc.data.code), 'Código sugerido automático', sc.data.code)
const np = await proy.call('projects', 'POST', { company_id: 1, zone_id: z.data.id, farm_id: f.data.id, type_id: 1, name: 'Proyecto Test Energético', currency: 'USD', data: { objective: 'Test' } })
ok(np.status === 200 && np.data.id, 'Responsable crea proyecto')
const pid = np.data.id
let pd = await proy.call(`projects/${pid}`)
ok(pd.data.project.stage_key === 'borrador', 'Proyecto inicia en "Ficha en preparación"')
ok(pd.data.checklist.length === 12, 'Checklist de 12 documentos generado (hoja 03)')
ok(pd.data.members.some(m => m.role_key === 'resp_rimi'), 'Responsable RIMI asignado automáticamente')
let tk = await proy.call(`tasks?project_id=${pid}`)
ok(tk.data.tasks.length === 3 && tk.data.tasks.every(t => t.auto), 'Tareas automáticas de la etapa inicial (3)', tk.data.tasks.length)
ok(tk.data.tasks.some(t => t.role_key === 'compras' && t.assignee_id === 4), 'Tarea de Compras asignada al usuario de Compras')

// --- Inversiones
const inv = await proy.call(`projects/${pid}/investments`, 'POST', { description: 'Transformador 1000 kVA', component_type: 'Bien / equipo', quantity: 2, unit: 'u', unit_price: 30000, ncm: '8504.23.00', eligibility: 'General elegible' })
ok(inv.status === 200 && inv.data.code === 'INV-01', 'Alta de inversión con código INV-01')
const invd = await proy.call(`investments/${inv.data.id}`)
ok(invd.data.investment.total === 60000, 'Total = cantidad × unitario', invd.data.investment.total)
ok(invd.data.investment.eligibility === 'Pendiente de validación', 'Operaciones NO puede fijar elegibilidad (campo restringido)')
const bulk = await proy.call(`projects/${pid}/investments/bulk`, 'POST', { rows: [{ description: 'Paneles 580 Wp', quantity: 100, unit_price: 150 }, { description: 'Inversor', quantity: 1, unit_price: 9000 }, { description: '' }] })
ok(bulk.data.imported === 2, 'Importación masiva (filas vacías ignoradas)')
pd = await proy.call(`projects/${pid}`)
ok(pd.data.project.budget === 60000 + 15000 + 9000, 'Presupuesto del proyecto recalculado', pd.data.project.budget)
const fis = await (await session('impuestos@solfrut.com.ar')).call(`investments/${inv.data.id}`, 'PUT', { eligibility: 'General elegible', ncm_status: 'Validada' })
ok(fis.status === 200, 'Impuestos valida elegibilidad')

// --- Flujo de etapas con validación del procedimiento
const st1 = await proy.call(`projects/${pid}/stage`, 'POST', { stage_key: 'evaluacion' })
ok(st1.status === 422 && st1.data.warnings.length, 'Avance bloqueado si faltan campos obligatorios de la Ficha', JSON.stringify(st1.data).slice(0, 120))
const st2 = await proy.call(`projects/${pid}/stage`, 'POST', { stage_key: 'evaluacion', force: true, note: 'Envío forzado test' })
ok(st2.status === 200 && st2.data.tasks_created === 3, 'Avance forzado genera tareas de Evaluación', JSON.stringify(st2.data))
pd = await proy.call(`projects/${pid}`)
ok(!!pd.data.project.ficha_sent_at, 'Fecha de envío a RIMI registrada automáticamente')
const stc = await compras.call(`projects/${pid}/stage`, 'POST', { stage_key: 'contable' })
ok(stc.status === 403, 'Compras NO puede mover la etapa de evaluación')
const dic = await rimi.call(`projects/${pid}`, 'PUT', { dictamen: 'General elegible', dictamen_notes: 'OK test' })
ok(dic.status === 200, 'RIMI registra dictamen')
const st3 = await rimi.call(`projects/${pid}/stage`, 'POST', { stage_key: 'contable' })
ok(st3.status === 200, 'Con dictamen avanza a Tratamiento contable sin advertencias')

// --- Tareas: permisos y estados
tk = await compras.call('tasks?assignee=me&status=open')
const myTask = tk.data.tasks.find(t => t.project_id === pid)
ok(!!myTask, 'Compras ve sus tareas asignadas')
const upd = await compras.call(`tasks/${myTask.id}`, 'PUT', { status: 'completada' })
ok(upd.status === 200, 'Asignado completa su tarea')
const updBad = await compras.call(`tasks/${myTask.id}`, 'PUT', { title: 'hack' })
ok(updBad.status === 403, 'Asignado NO puede editar el título de una tarea ajena')
const nt = await proy.call('tasks', 'POST', { project_id: pid, investment_id: inv.data.id, title: 'Tarea manual', assignee_id: 4, due_date: '2026-11-20' })
ok(nt.status === 200, 'Crear tarea manual por inversión')

// --- Chat + menciones + notificaciones
const before = (await compras.call('notifications/count')).data.unread
const msg = await proy.call('messages', 'POST', { project_id: pid, body: 'Hola @Carolina revisá la OC' })
ok(msg.status === 200, 'Enviar mensaje al chat del proyecto')
const after = (await compras.call('notifications/count')).data.unread
ok(after > before, 'Mención @Carolina genera notificación', `${before}→${after}`)
const msgs = await rimi.call(`messages?project_id=${pid}`)
ok(msgs.data.messages.some(m => m.kind === 'system') && msgs.data.messages.some(m => m.body.includes('@Carolina')), 'Historial con mensajes de sistema y de usuarios')
const im = await proy.call('messages', 'POST', { project_id: pid, investment_id: inv.data.id, body: 'Comentario del transformador' })
ok(im.status === 200, 'Chat por inversión')

// --- Documentos (R2)
const fd = new FormData()
fd.append('project_id', pid); fd.append('investment_id', inv.data.id); fd.append('doc_type', 'factura')
fd.append('file', new Blob(['%PDF-1.4 test factura'], { type: 'application/pdf' }), 'Factura A-0001.pdf')
const up = await proy.call('documents', 'POST', fd)
ok(up.status === 200 && up.data.stored, 'Subida de archivo a R2', JSON.stringify(up.data))
const docs = await proy.call(`documents?project_id=${pid}`)
const d0 = docs.data.documents[0]
ok(d0 && d0.folder_key === '04', 'Factura archivada en carpeta 04 · Comprobantes (Anexo II)')
const dl = await proy.call(`documents/${d0.id}/file`, 'GET', undefined, true)
ok(dl.status === 200 && (await dl.text()).includes('factura'), 'Descarga del archivo')
const val = await compras.call(`documents/${d0.id}`, 'PUT', { status: 'validado' })
ok(val.status === 403, 'Compras NO puede validar documentos')
const val2 = await rimi.call(`documents/${d0.id}`, 'PUT', { status: 'validado' })
ok(val2.status === 200, 'RIMI valida documentos')

// --- Checklist
const chk = pd.data.checklist[0]
const ch = await proy.call(`checklist/${chk.id}`, 'PUT', { status: 'Adjunto', reference: 'memoria.pdf' })
ok(ch.status === 200, 'Actualizar checklist')

// --- Sólo lectura
const ro = await dir.call(`projects/${pid}`, 'PUT', { name: 'hack' })
ok(ro.status === 403, 'Dirección (sólo lectura) no puede modificar')
const rog = await dir.call(`projects/${pid}`)
ok(rog.status === 200, 'Dirección puede consultar')

// --- Aislamiento por empresa
const gk = await admin.call('projects', 'POST', { company_id: 2, name: 'Proyecto GK' })
const iso = await compras.call(`projects/${gk.data.id}`)
ok(iso.status === 404, 'Usuario sin acceso a Genética Incarí no ve sus proyectos')

// --- Administración
const af = await admin.call('admin/form-fields', 'POST', { entity: 'project', section_key: 'B', label: 'Potencia instalada (kW)', type: 'number', required: 0 })
ok(af.status === 200 && af.data.key.startsWith('potencia_instalada_kw'), 'Constructor: nuevo campo personalizado', af.data.key)
const sv = await proy.call(`projects/${pid}`, 'PUT', { data: { [af.data.key]: 600 } })
pd = await proy.call(`projects/${pid}`)
ok(pd.data.project.data[af.data.key] === 600, 'Campo personalizado se guarda en la ficha')
const nonAdmin = await rimi.call('admin/form-fields', 'POST', { entity: 'project', section_key: 'B', label: 'x' })
ok(nonAdmin.status === 403, 'RIMI no accede al constructor (sólo admin)')
const nu = await admin.call('admin/users', 'POST', { email: `nuevo.test.${RUN}@solfrut.com.ar`, name: 'Usuario Test', functional_role: 'compras', company_ids: [1] })
ok(nu.status === 200 && nu.data.temp_password, 'Alta de usuario con clave temporal')
const nus = await session(`nuevo.test.${RUN}@solfrut.com.ar`, nu.data.temp_password)
const me = await nus.call('/api/auth/me')
ok(me.data.user.must_change_password === 1, 'Usuario nuevo obligado a cambiar la clave')
const cp = await nus.call('/api/auth/password', 'POST', { next: 'Nueva2026x' })
ok(cp.status === 200, 'Cambio de contraseña')
const nc = await admin.call('companies', 'POST', { name: `Empresa Test ${RUN}`, short_code: 'ET' })
ok(nc.status === 200, 'Admin agrega empresa')
const cal = await admin.call('calendar?from=2026-12-01&to=2026-12-31')
ok(cal.data.events.filter(e => e.kind === 'recurring').length >= 7, 'Agenda recurrente del procedimiento en calendario')
const rep = await admin.call('reports/summary')
ok(rep.data.projects.length && 'threshold' in rep.data.projects[0], 'Reporte con monto mínimo por proyecto')
const srch = await admin.call('search?q=8504')
ok(srch.data.results.some(r => r.type === 'investment'), 'Búsqueda global por NCM')
const act = await admin.call(`projects/${pid}/activity`)
ok(act.data.activity.length >= 8, 'Historial de auditoría registra acciones', act.data.activity.length)

// --- Perfiles, permisos y roles funcionales
const pf = await proy.call('farms', 'POST', { zone_id: z.data.id, name: `Finca Resp ${RUN}`, hectares: 12 })
ok(pf.status === 200, 'Resp. de proyecto crea finca (permiso extra del rol)')
const pz = await proy.call('zones', 'POST', { company_id: 1, name: 'Zona no permitida' })
ok(pz.status === 403, 'Resp. de proyecto NO crea zonas (no tiene el permiso)')
const cf = await compras.call('farms', 'POST', { zone_id: z.data.id, name: 'X' })
ok(cf.status === 403, 'Compras NO crea fincas')
const pbt = await proy.call('bootstrap')
ok(pbt.data.user.perms.includes('farms.manage') && pbt.data.user.perms.includes('projects.create'), 'Permisos efectivos = perfil + rol', pbt.data.user.perms?.join(','))
const dn = await dir.call('notifications/read', 'POST', {})
ok(dn.status === 200, 'Usuario de sólo lectura puede marcar notificaciones como leídas')
const profs = (await admin.call('admin/profiles')).data.profiles
ok(profs.length >= 4 && profs.find(p => p.key === 'admin'), 'Listado de perfiles con usuarios asignados')
const ap = profs.find(p => p.key === 'admin')
ok((await admin.call(`admin/profiles/${ap.id}`, 'PUT', { permissions: [] })).status === 400, 'Perfil Administrador: permisos inmutables')
ok((await admin.call(`admin/profiles/${profs.find(p => p.key === 'viewer').id}`, 'DELETE')).status === 409, 'Perfiles base no se eliminan')
const npf = await admin.call('admin/profiles', 'POST', { name: `Resp finca ${RUN}`, copy_from: 'viewer' })
ok(npf.status === 200 && npf.data.key, 'Admin crea perfil personalizado', npf.data.key)
await admin.call(`admin/profiles/${npf.data.id}`, 'PUT', { permissions: ['zones.manage', 'farms.manage', 'bogus.perm'] })
const pfu = await admin.call('admin/users', 'POST', { email: `perfil.test.${RUN}@solfrut.com.ar`, name: 'Perfil Test', system_role: npf.data.key, functional_role: 'tecnico', company_ids: [1] })
ok(pfu.status === 200, 'Alta de usuario con perfil personalizado')
const pfs = await session(`perfil.test.${RUN}@solfrut.com.ar`, pfu.data.temp_password)
const pfz = await pfs.call('zones', 'POST', { company_id: 1, name: `Zona perfil ${RUN}` })
ok(pfz.status === 200, 'Perfil personalizado habilita crear zona')
ok((await pfs.call('projects', 'POST', { company_id: 1, zone_id: z.data.id, type_id: 1, name: 'No' })).status === 403, 'Perfil personalizado sin "crear proyecto" → 403')
ok((await admin.call(`admin/profiles/${npf.data.id}`, 'DELETE')).status === 409, 'No se elimina un perfil en uso')
const rl = (await admin.call('admin/roles')).data.roles.find(r => r.key === 'compras')
await admin.call(`admin/roles/${rl.id}`, 'PUT', { permissions: ['zones.manage'] })
const cz = await compras.call('zones', 'POST', { company_id: 1, name: `Zona compras ${RUN}` })
ok(cz.status === 200, 'Permiso extra en rol funcional se aplica al instante')
await admin.call(`admin/roles/${rl.id}`, 'PUT', { permissions: [] })
ok((await compras.call('zones', 'POST', { company_id: 1, name: 'Y' })).status === 403, 'Quitar permiso del rol lo revoca')
ok((await compras.call('admin/stage-tasks')).status === 403, 'Sin "config.workflow" no se accede a tareas automáticas')

// --- Constructor: eliminar, papelera, restaurar
const ff = (await admin.call('bootstrap')).data.form_fields
const objF = ff.find(x => x.entity === 'project' && x.key === 'ficha_version')
const del1 = await admin.call(`admin/form-fields/${objF.id}`, 'DELETE')
ok(del1.status === 200, 'Admin elimina un campo del sistema (va a la papelera)')
const ff2 = (await admin.call('bootstrap')).data.form_fields.find(x => x.id === objF.id)
ok(ff2 && ff2.deleted_at && ff2.active === 0, 'Campo eliminado queda en papelera')
ok((await admin.call(`admin/form-fields/${objF.id}?purge=1`, 'DELETE')).status === 409, 'Campo del sistema no se borra definitivamente')
const rs = await admin.call(`admin/form-fields/${objF.id}/restore`, 'POST', {})
const ff3 = (await admin.call('bootstrap')).data.form_fields.find(x => x.id === objF.id)
ok(rs.status === 200 && !ff3.deleted_at && ff3.active === 1, 'Restaurar campo desde la papelera')
const nameF = ff.find(x => x.entity === 'project' && x.key === 'name')
ok((await admin.call(`admin/form-fields/${nameF.id}`, 'DELETE')).status === 409, 'Campo estructural (Nombre) no se puede eliminar')
const tmpF = await admin.call('admin/form-fields', 'POST', { entity: 'investment', section_key: ff.find(x => x.entity === 'investment').section_key, label: `Temporal ${RUN}`, type: 'text' })
await admin.call(`admin/form-fields/${tmpF.data.id}`, 'DELETE')
const pg = await admin.call(`admin/form-fields/${tmpF.data.id}?purge=1`, 'DELETE')
ok(pg.status === 200 && !(await admin.call('bootstrap')).data.form_fields.some(x => x.id === tmpF.data.id), 'Campo personalizado se borra definitivamente')

// --- Activo / Inactivo y duplicado de proyectos
const stP = await proy.call('projects', 'POST', { company_id: 1, zone_id: z.data.id, farm_id: f.data.id, type_id: 1, name: `Proyecto estado ${RUN}`, currency: 'USD', status: 'inactivo' })
ok(stP.status === 200 && stP.data.id, 'Alta de proyecto (con status:inactivo en el body)', JSON.stringify(stP.data))
const stId = stP.data.id
const stRead = await admin.call(`projects/${stId}`)
ok(stRead.data.project.status === 'activo', 'El alta ignora el status del body: arranca Activo')
const stInv = await proy.call(`projects/${stId}/investments`, 'POST', { description: 'Bien para duplicar', quantity: 2, unit_price: 100, unit: 'u', component_type: 'Bien / equipo' })
ok(stInv.status === 200, 'Responsable carga un componente antes de desactivar', JSON.stringify(stInv.data))
const stNoPerm = await proy.call(`projects/${stId}/status`, 'PUT', { status: 'inactivo' })
ok(stNoPerm.status === 403, 'Responsable sin permiso "Activar o desactivar" no puede desactivar (403)', JSON.stringify(stNoPerm.data))
const stOff = await admin.call(`projects/${stId}/status`, 'PUT', { status: 'inactivo' })
ok(stOff.status === 200 && stOff.data.status === 'inactivo', 'Admin desactiva el proyecto')
const stRimiOn = await rimi.call(`projects/${stId}/status`, 'PUT', { status: 'activo' })
ok(stRimiOn.status === 200, 'Responsable RIMI (perfil con permiso) reactiva el proyecto', JSON.stringify(stRimiOn.data))
const stRimiOff = await rimi.call(`projects/${stId}/status`, 'PUT', { status: 'inactivo' })
ok(stRimiOff.status === 200, 'Responsable RIMI desactiva el proyecto')
const stBad = await admin.call(`projects/${stId}/status`, 'PUT', { status: 'borrado' })
ok(stBad.status === 400, 'Estado inválido rechazado (400)')
const stList = await admin.call('projects?status=inactivo')
ok(stList.data.projects.some(x => x.id === stId), 'Filtro status=inactivo lista el proyecto')
const stAct = await admin.call('projects?status=activo')
ok(!stAct.data.projects.some(x => x.id === stId), 'Filtro status=activo excluye el proyecto inactivo')
const blk1 = await proy.call(`projects/${stId}`, 'PUT', { name: 'Cambio bloqueado' })
ok(blk1.status === 409, 'Inactivo: no se edita la ficha (409)', JSON.stringify(blk1.data))
const blk2 = await proy.call(`projects/${stId}/investments`, 'POST', { description: 'Bien bloqueado', quantity: 1, unit_price: 10 })
ok(blk2.status === 409, 'Inactivo: no se agregan componentes (409)')
const blk3 = await proy.call('tasks', 'POST', { project_id: stId, title: 'Tarea bloqueada' })
ok(blk3.status === 409, 'Inactivo: no se crean tareas (409)')
const blk4 = await proy.call('messages', 'POST', { project_id: stId, body: 'Mensaje bloqueado' })
ok(blk4.status === 409, 'Inactivo: no se escribe en la conversación (409)')
const blk5 = await proy.call(`projects/${stId}/members`, 'POST', { user_id: 1, role_key: 'resp_proyecto' })
ok(blk5.status === 409, 'Inactivo: no se modifica el equipo (409)')
const blk6 = await proy.call(`checklist/${stRead.data.checklist[0].id}`, 'PUT', { status: 'Adjunto' })
ok(blk6.status === 409, 'Inactivo: no se cambia el checklist (409)')
const dupSame = await admin.call(`projects/${stId}/duplicate`, 'POST', { name: 'Dup', code: stRead.data.project.code })
ok(dupSame.status === 409, 'Duplicar con un código ya usado es rechazado (409)')
const dupNew = await admin.call(`projects/${stId}/duplicate`, 'POST', { name: `Copia ${RUN}`, code: `TST-DUP-${RUN}` })
ok(dupNew.status === 200 && dupNew.data.id, 'Duplicar un proyecto inactivo con código nuevo', JSON.stringify(dupNew.data))
const dupRead = await admin.call(`projects/${dupNew.data.id}`)
ok(dupRead.data.project.status === 'activo' && dupRead.data.project.stage_key === 'borrador', 'El duplicado queda Activo en "Ficha en preparación"')
ok(dupRead.data.investments.length === 1 && dupRead.data.investments[0].total === 200, 'El duplicado copia los componentes con su total')
ok(dupRead.data.investments[0].eligibility === 'Pendiente de validación' && dupRead.data.investments[0].code === 'INV-01', 'El duplicado vuelve al default de elegibilidad y renumera el componente (INV-01)')
ok(dupRead.data.checklist.length === 12, 'El duplicado genera su propio checklist')
const dupTasks = await admin.call(`tasks?project_id=${dupNew.data.id}`)
ok(dupTasks.data.tasks.length > 0 && dupTasks.data.tasks.every(t => t.project_id === dupNew.data.id), 'El duplicado tiene sus propias tareas de etapa')
const codeDup = await proy.call('projects', 'POST', { company_id: 1, zone_id: z.data.id, name: 'Choque de código', code: `TST-DUP-${RUN}` })
ok(codeDup.status === 409, 'Alta con código ya existente rechazada (409)', JSON.stringify(codeDup.data))
const stOn = await admin.call(`projects/${stId}/status`, 'PUT', { status: 'activo' })
ok(stOn.status === 200, 'Admin reactiva el proyecto')
const edOn = await proy.call(`projects/${stId}`, 'PUT', { name: `Proyecto estado ${RUN} editado` })
ok(edOn.status === 200, 'Reactivado: vuelve a permitir editar la ficha')
await admin.call(`projects/${dupNew.data.id}`, 'DELETE')
await admin.call(`projects/${stId}`, 'DELETE')

// --- Limpieza
await admin.call(`projects/${pid}`, 'DELETE'); await admin.call(`projects/${gk.data.id}`, 'DELETE')
await admin.call(`farms/${f.data.id}`, 'DELETE'); await admin.call(`zones/${z.data.id}`, 'DELETE')
await admin.call(`admin/form-fields/${af.data.id}`, 'DELETE'); await admin.call(`companies/${nc.data.id}`, 'DELETE')
await admin.call(`admin/users/${nu.data.id}`, 'PUT', { active: 0 })
await admin.call(`farms/${pf.data.id}`, 'DELETE'); await admin.call(`zones/${pfz.data.id}`, 'DELETE'); await admin.call(`zones/${cz.data.id}`, 'DELETE')
await admin.call(`admin/users/${pfu.data.id}`, 'PUT', { active: 0, system_role: 'viewer' }); await admin.call(`admin/profiles/${npf.data.id}`, 'DELETE')

console.log(results.join('\n'))
console.log(`\nRESULTADO: ${pass}/${pass + fail} pruebas OK · puntaje ${(pass / (pass + fail) * 10).toFixed(1)}/10`)
process.exit(fail ? 1 : 0)
