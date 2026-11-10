import { state, api, esc, icon, paintIcons, avatar, B, roleOf, hexA, modal, toast, handleErr, confirmDialog, fdatetime, ago, emptyState, stagesFor, fieldOptions, profileOf } from '../lib.js'

const SECTIONS = [
  ['overview', 'Resumen', 'layout-dashboard'], ['companies', 'Empresas', 'building-2'], ['users', 'Usuarios y accesos', 'users'], ['profiles', 'Perfiles y permisos', 'shield-check'],
  ['builder', 'Constructor de formularios', 'blocks'], ['workflow', 'Flujo y tareas automáticas', 'git-branch'], ['roles', 'Roles funcionales', 'id-card'],
  ['types', 'Tipos de proyecto', 'tags'], ['agenda', 'Agenda recurrente', 'calendar-range'], ['docs', 'Carpetas y documentos', 'folder-tree'],
  ['appearance', 'Apariencia y parámetros', 'palette'], ['integrations', 'Microsoft 365 / Azure', 'key-round'], ['audit', 'Auditoría', 'scroll-text']
]
const FIELD_TYPES = [
  ['text', 'Texto corto', 'type'], ['textarea', 'Texto largo', 'align-left'], ['number', 'Número', 'hash'], ['money', 'Importe', 'dollar-sign'],
  ['date', 'Fecha', 'calendar'], ['select', 'Lista desplegable', 'list'], ['multiselect', 'Selección múltiple', 'list-checks'], ['checkbox', 'Casilla Sí/No', 'square-check'],
  ['user', 'Usuario', 'user'], ['ncm', 'Posición NCM', 'barcode'], ['email', 'Correo', 'at-sign'], ['url', 'Enlace', 'link'], ['phone', 'Teléfono', 'phone']
]
const typeMeta = (t) => FIELD_TYPES.find(x => x[0] === t) || [t, t, 'square']
const ICONS = ['zap', 'droplets', 'cloud-hail', 'factory', 'tractor', 'hard-hat', 'paw-print', 'shapes', 'sun', 'wind', 'truck', 'warehouse', 'sprout', 'cpu', 'flame', 'waves', 'trees', 'package', 'wrench', 'building-2', 'folder']

export default async function (root) {
  if (state.user.system_role !== 'admin') { root.innerHTML = `<div class="card">${emptyState('lock', 'Acceso restringido', 'Sólo administradores.')}</div>`; return }
  const sec = location.hash.split('?')[0].split('/')[2] || 'overview'
  root.innerHTML = `<div class="page-head"><div><div class="eyebrow">Configuración de la plataforma</div><h1>Administración</h1><p class="sub">Personalizá empresas, usuarios, formularios, flujo de etapas y parámetros. Los cambios impactan en todo el portal al instante.</p></div></div>
    <div class="grid g-main-l" style="grid-template-columns:250px minmax(0,1fr)"><aside><nav class="card admin-nav">${SECTIONS.map(([k, l, ic]) => `<a href="#/admin/${k}" class="${k === sec ? 'active' : ''}">${icon(ic, 'i-sm')} ${l}</a>`).join('')}</nav></aside><section id="adm"></section></div>`
  paintIcons(root)
  const el = root.querySelector('#adm')
  const fn = { overview, companies, users, profiles, builder, workflow, roles, types, agenda, docs, appearance, integrations, audit }[sec] || overview
  await fn(el)
  paintIcons(el)
}
const reboot = async () => { await window.__reloadBoot() }
const rerender = () => window.dispatchEvent(new HashChangeEvent('hashchange'))

// ------------------------------------------------------------------ RESUMEN
async function overview(el) {
  const [{ users }, { settings, integrations: ig }] = await Promise.all([api.get('admin/users'), api.get('admin/settings')])
  const b = B()
  const cards = [
    ['companies', 'Empresas', b.companies.length, 'building-2', 'tone-green'], ['users', 'Usuarios activos', users.filter(u => u.active).length, 'users', 'tone-sky'],
    ['builder', 'Campos configurables', b.form_fields.length, 'blocks', 'tone-violet'], ['workflow', 'Etapas del flujo', b.stages.length, 'git-branch', 'tone-sun']
  ]
  el.innerHTML = `<div class="grid g-4 mb-3">${cards.map(([k, l, v, ic, t]) => `<a class="card kpi" href="#/admin/${k}"><div class="lbl">${l}</div><div class="val">${v}</div><span class="ico ${t}">${icon(ic)}</span></a>`).join('')}</div>
    <div class="grid g-2">
      <div class="card"><div class="card-head"><h3>Estado de integraciones</h3></div><div class="list">
        <div class="list-item"><span class="file-ico ${ig.microsoft.configured ? 'tone-green' : 'tone-sun'}">${icon('key-round', 'i-sm')}</span><div class="grow"><div class="t">SSO Microsoft 365 (Entra ID)</div><div class="s">${ig.microsoft.configured ? 'Configurado · tenant ' + esc(ig.microsoft.tenant) : 'Pendiente: cargar App Registration'}</div></div><a class="btn btn-sm" href="#/admin/integrations">Configurar</a></div>
        <div class="list-item"><span class="file-ico ${ig.storage.r2 ? 'tone-green' : 'tone-rose'}">${icon('hard-drive', 'i-sm')}</span><div class="grow"><div class="t">Almacenamiento de archivos (R2)</div><div class="s">${ig.storage.r2 ? 'Activo' : 'No configurado'}</div></div></div>
        <div class="list-item"><span class="file-ico tone-green">${icon('database', 'i-sm')}</span><div class="grow"><div class="t">Base de datos (D1)</div><div class="s">Activa</div></div></div>
      </div></div>
      <div class="card"><div class="card-head"><h3>Acciones rápidas</h3></div><div class="card-body stack" style="gap:8px">
        <button class="btn" id="qa-user">${icon('user-plus', 'i-sm')} Invitar usuario</button>
        <a class="btn" href="#/admin/builder">${icon('blocks', 'i-sm')} Agregar campos a la Ficha</a>
        <a class="btn" href="#/admin/companies">${icon('building-2', 'i-sm')} Agregar empresa (ej. Genética Incarí)</a>
        <button class="btn" id="qa-bc">${icon('megaphone', 'i-sm')} Enviar comunicado a todos</button>
      </div></div>
    </div>`
  el.querySelector('#qa-user').onclick = () => userModal(null, rerender)
  el.querySelector('#qa-bc').onclick = () => {
    const m = modal({ title: 'Comunicado general', icon: 'megaphone', body: `<div class="field"><label>Título</label><input class="input" id="t"></div><div class="field mt-2"><label>Mensaje</label><textarea class="textarea" id="b"></textarea></div>`, foot: `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">Enviar</button>` })
    m.$('#ok').onclick = async () => { try { const r = await api.post('admin/broadcast', { title: m.$('#t').value, body: m.$('#b').value }); toast(`Enviado a ${r.sent} usuarios`); m.close() } catch (e) { handleErr(e) } }
  }
}

// ------------------------------------------------------------------ EMPRESAS
async function companies(el) {
  const cats = { micro: 'Micro', pequena: 'Pequeña', mediana1: 'Mediana tramo 1', mediana2: 'Mediana tramo 2' }
  const { users } = await api.get('admin/users')
  el.innerHTML = `<div class="card"><div class="card-head"><div><h3>Empresas del grupo</h3><div class="sub">Cada empresa tiene sus zonas, fincas y proyectos. La categoría MiPyME define el monto mínimo de inversión.</div></div><div class="right"><button class="btn btn-primary btn-sm" id="add">${icon('plus', 'i-sm')} Nueva empresa</button></div></div>
    <div class="card-body grid g-2">${B().companies.map(c => `<div class="card card-pad" style="border-left:4px solid ${esc(c.color)}"><div class="row"><span class="company-dot" style="width:44px;height:44px;border-radius:13px;background:${esc(c.color)}">${esc(c.short_code || c.name.slice(0, 2))}</span><div class="grow"><h3>${esc(c.name)}</h3><div class="xs muted">${esc(c.legal_name || '')} ${c.cuit ? '· CUIT ' + esc(c.cuit) : ''}</div></div>${c.active ? '<span class="badge green">Activa</span>' : '<span class="badge">Inactiva</span>'}</div>
      <p class="small muted mt-2">${esc(c.description || '')}</p>
      <div class="row row-wrap mt-2 small" style="gap:14px"><span>${icon('gauge', 'i-xs')} ${esc(cats[c.mipyme_category] || c.mipyme_category)}</span><span>${icon('map-pin', 'i-xs')} ${B().zones.filter(z => z.company_id === c.id).length} zonas</span><span>${icon('users', 'i-xs')} ${users.filter(u => u.company_ids.includes(c.id)).length} usuarios</span></div>
      <div class="row mt-3"><button class="btn btn-sm" data-edit="${c.id}">${icon('pencil', 'i-sm')} Editar</button></div></div>`).join('')}</div></div>`
  const form = (c) => {
    const m = modal({ title: c ? `Editar ${esc(c.name)}` : 'Nueva empresa', icon: 'building-2', size: 'lg',
      body: `<div class="form-grid"><div class="field w-half"><label>Nombre <span class="req">*</span></label><input class="input" id="n" value="${esc(c?.name || '')}" placeholder="Genética Incarí"></div>
        <div class="field w-quarter"><label>Sigla</label><input class="input" id="s" maxlength="4" value="${esc(c?.short_code || '')}" placeholder="GK"></div>
        <div class="field w-quarter"><label>Color</label><input type="color" class="color-input" id="c" value="${esc(c?.color || '#0A88C9')}"></div>
        <div class="field w-half"><label>Razón social</label><input class="input" id="l" value="${esc(c?.legal_name || '')}"></div><div class="field w-half"><label>CUIT</label><input class="input" id="cu" value="${esc(c?.cuit || '')}"></div>
        <div class="field w-half"><label>Categoría MiPyME</label><select class="select" id="cat">${Object.entries(cats).map(([k, v]) => `<option value="${k}" ${k === c?.mipyme_category ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field w-half"><label>Estado</label><select class="select" id="a"><option value="1" ${c?.active !== 0 ? 'selected' : ''}>Activa</option><option value="0" ${c?.active === 0 ? 'selected' : ''}>Inactiva</option></select></div>
        <div class="field w-full"><label>Descripción</label><input class="input" id="d" value="${esc(c?.description || '')}"></div></div>`,
      foot: `${c ? `<button class="btn btn-danger" id="del">${icon('trash-2', 'i-sm')}</button>` : ''}<span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">Guardar</button>` })
    m.$('#ok').onclick = async () => {
      const body = { name: m.$('#n').value.trim(), short_code: m.$('#s').value.trim().toUpperCase(), color: m.$('#c').value, legal_name: m.$('#l').value, cuit: m.$('#cu').value, mipyme_category: m.$('#cat').value, active: Number(m.$('#a').value), description: m.$('#d').value }
      if (!body.name) return toast('Nombre obligatorio', 'warn')
      try { c ? await api.put(`companies/${c.id}`, body) : await api.post('companies', body); await reboot(); toast('Empresa guardada'); m.close(); rerender() } catch (e) { handleErr(e) }
    }
    m.$('#del')?.addEventListener('click', async () => { if (await confirmDialog({ title: 'Eliminar empresa', message: 'Sólo es posible si no tiene proyectos.', danger: true, confirm: 'Eliminar' })) try { await api.del(`companies/${c.id}`); await reboot(); m.close(); rerender() } catch (e) { handleErr(e) } })
  }
  el.querySelector('#add').onclick = () => form(null)
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => form(B().companies.find(c => c.id == b.dataset.edit)))
}

// ------------------------------------------------------------------ USUARIOS
const SYS_TONE = { admin: 'dark', rimi: 'green', lider_proyecto: 'green', compras: 'sky', impuestos: '', contabilidad: 'green', operativo: 'sky', viewer: '' }
const profBadge = (key) => { const p = profileOf(key); return `<span class="badge ${SYS_TONE[key] ?? ''}" style="${SYS_TONE[key] === undefined ? `background:${hexA(p.color, .14)};color:${p.color}` : ''}">${esc(p.name)}</span>` }
async function users(el) {
  const { users } = await api.get('admin/users')
  let f = ''
  const draw = () => {
    const list = users.filter(u => !f || (u.name + u.email).toLowerCase().includes(f.toLowerCase()))
    el.innerHTML = `<div class="card"><div class="card-head"><div><h3>Usuarios y accesos</h3><div class="sub">Con Microsoft 365 los usuarios ingresan con su cuenta corporativa; también podés crear usuarios locales con contraseña.</div></div>
      <div class="right"><input class="input input-sm" id="uf" placeholder="Buscar…" value="${esc(f)}" style="width:180px"><button class="btn btn-primary btn-sm" id="add">${icon('user-plus', 'i-sm')} Nuevo usuario</button></div></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Usuario</th><th>Perfil</th><th>Rol funcional</th><th>Empresas</th><th>Acceso</th><th class="num">Tareas</th><th>Último ingreso</th><th></th></tr></thead>
      <tbody>${list.map(u => `<tr style="${u.active ? '' : 'opacity:.5'}"><td><div class="row">${avatar(u.name, u.avatar_color, 'sm')}<div><div class="cell-title">${esc(u.name)}</div><div class="cell-sub">${esc(u.email)}</div></div></div></td>
        <td>${profBadge(u.system_role)}</td><td class="small">${esc(roleOf(u.functional_role).name)}</td>
        <td class="small">${u.company_ids.map(id => esc(B().companies.find(c => c.id === id)?.short_code || '')).join(', ') || '—'}</td>
        <td><div class="row" style="gap:4px">${u.has_ms ? `<span class="badge sky" title="Microsoft 365">M365</span>` : ''}${u.has_password ? `<span class="badge" title="Contraseña local">${icon('key-round', 'i-xs')}</span>` : ''}${u.must_change_password ? '<span class="badge sun">Clave temporal</span>' : ''}</div></td>
        <td class="num">${u.open_tasks}</td><td class="small">${u.last_login_at ? ago(u.last_login_at) : '<span class="muted">Nunca</span>'}</td>
        <td><button class="btn btn-ghost btn-xs" data-edit="${u.id}">${icon('pencil', 'i-xs')} Editar</button></td></tr>`).join('')}</tbody></table></div></div>`
    paintIcons(el)
    el.querySelector('#uf').oninput = (e) => { f = e.target.value; draw(); el.querySelector('#uf').focus(); el.querySelector('#uf').setSelectionRange(f.length, f.length) }
    el.querySelector('#add').onclick = () => userModal(null, rerender)
    el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => userModal(users.find(u => u.id == b.dataset.edit), rerender))
  }
  draw()
}
function userModal(u, done) {
  const m = modal({ title: u ? `Editar ${esc(u.name)}` : 'Nuevo usuario', icon: 'user-plus', tone: 'tone-sky', size: 'lg',
    body: `<div class="form-grid">
      <div class="field w-half"><label>Nombre completo <span class="req">*</span></label><input class="input" id="n" value="${esc(u?.name || '')}"></div>
      <div class="field w-half"><label>Correo corporativo <span class="req">*</span></label><input class="input" type="email" id="e" value="${esc(u?.email || '')}" ${u ? 'disabled' : ''}></div>
      <div class="field w-half"><label>Perfil (permisos)</label><select class="select" id="s">${(B().profiles || []).map(p => `<option value="${p.key}" ${p.key === (u?.system_role || 'viewer') ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select><span class="help">Define qué puede hacer. Se configura en <a href="#/admin/profiles">Perfiles y permisos</a>.</span></div>
      <div class="field w-half"><label>Rol funcional (área)</label><select class="select" id="r"><option value="">—</option>${B().roles.map(r => `<option value="${r.key}" ${r.key === u?.functional_role ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select><span class="help">Asigna las tareas automáticas y puede sumar permisos extra (ver <a href="#/admin/roles">Roles funcionales</a>).</span></div>
      <div class="field w-half"><label>Cargo</label><input class="input" id="p" value="${esc(u?.position || '')}"></div>
      <div class="field w-half"><label>Teléfono</label><input class="input" id="ph" value="${esc(u?.phone || '')}"></div>
      <div class="field w-full"><label>Empresas habilitadas</label><div class="row row-wrap">${B().companies.map(c => `<label class="check"><input type="checkbox" data-co="${c.id}" ${(u ? u.company_ids.includes(c.id) : c.id === state.company) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</div></div>
      ${u ? `<div class="field w-half"><label>Estado</label><select class="select" id="a"><option value="1" ${u.active ? 'selected' : ''}>Activo</option><option value="0" ${!u.active ? 'selected' : ''}>Desactivado</option></select></div>`
      : `<div class="field w-full"><label>Método de acceso</label><div class="row" style="gap:16px"><label class="check"><input type="radio" name="ap" value="local" checked> Usuario y contraseña (se genera una clave temporal)</label><label class="check"><input type="radio" name="ap" value="microsoft"> Sólo Microsoft 365</label></div></div>`}
    </div>`,
    foot: `${u ? `<button class="btn" id="rp">${icon('key-round', 'i-sm')} Restablecer contraseña</button>` : ''}<span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">${icon('save', 'i-sm')} Guardar</button>` })
  m.$('#ok').onclick = async () => {
    const body = { name: m.$('#n').value.trim(), system_role: m.$('#s').value, functional_role: m.$('#r').value || null, position: m.$('#p').value, phone: m.$('#ph').value, company_ids: m.$$('[data-co]').filter(x => x.checked).map(x => Number(x.dataset.co)) }
    if (!body.name) return toast('Nombre obligatorio', 'warn')
    try {
      if (u) { await api.put(`admin/users/${u.id}`, { ...body, active: Number(m.$('#a').value) }); toast('Usuario actualizado'); m.close() }
      else {
        const r = await api.post('admin/users', { ...body, email: m.$('#e').value.trim(), auth_provider: m.$('input[name=ap]:checked').value })
        m.close()
        if (r.temp_password) showTemp(m.$('#e')?.value || body.name, r.temp_password); else toast('Usuario creado: ingresará con Microsoft 365')
      }
      await reboot(); done && done()
    } catch (e) { handleErr(e) }
  }
  m.$('#rp')?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Restablecer contraseña', message: 'Se generará una clave temporal y se cerrarán sus sesiones activas.', confirm: 'Restablecer' }))) return
    try { const r = await api.post(`admin/users/${u.id}/reset-password`); m.close(); showTemp(u.email, r.temp_password) } catch (e) { handleErr(e) }
  })
}
function showTemp(email, pass) {
  const m = modal({ title: 'Clave temporal generada', icon: 'key-round', tone: 'tone-sun', size: 'sm',
    body: `<p class="small muted">Compartila de forma segura. El usuario deberá cambiarla en su primer ingreso.</p><div class="copy-field mt-2"><input class="input" readonly value="${esc(pass)}" id="tp"><button class="btn" id="cp">${icon('copy', 'i-sm')}</button></div><p class="xs muted mt-2">Usuario: ${esc(email)}</p>`,
    foot: '<button class="btn btn-primary" data-close>Listo</button>' })
  m.$('#cp').onclick = () => { navigator.clipboard?.writeText(pass); toast('Copiada') }
}


// ------------------------------------------------------------------ PERFILES Y PERMISOS
async function profiles(el) {
  const [{ profiles: list }, { permissions }] = await Promise.all([api.get('admin/profiles'), api.get('admin/permissions')])
  const groups = [...new Set(permissions.map(p => p.group))]
  const roles = B().roles
  const draw = () => {
    el.innerHTML = `<div class="card mb-3"><div class="card-head"><div><h3>${icon('shield-check', 'i-sm')} Perfiles y permisos</h3>
      <div class="sub">El <b>perfil</b> define qué puede hacer cada usuario. El <b>rol funcional</b> (área) puede sumar permisos extra y decide a quién se asignan las tareas automáticas. <b>Permisos efectivos = perfil + rol funcional.</b> Un perfil sin permisos es de sólo lectura.</div></div>
      <div class="right"><button class="btn btn-primary btn-sm" id="add">${icon('plus', 'i-sm')} Nuevo perfil</button></div></div>
      <div class="alert info" style="margin:0 20px 14px">${icon('info', 'i-sm')}<span><b>Activar o desactivar proyectos</b> (grupo Proyectos): permite marcar un proyecto como <b>Inactivo</b>, que queda en sólo lectura hasta reactivarlo. Está activado para <b>Administrador</b> y <b>Responsable RIMI</b>; tildalo en otros perfiles si corresponde.</span></div>
      <div class="table-wrap perm-wrap"><table class="table perm-table"><thead><tr><th style="min-width:260px">Permiso</th>${list.map(p => `<th class="perm-col"><div class="perm-h"><span class="perm-dot" style="background:${esc(p.color)}"></span><b>${esc(p.name)}</b><span class="xs muted">${p.users} usuario${p.users === 1 ? '' : 's'}</span>
        ${p.key === 'admin' ? '<span class="mchip mchip-lock">' + icon('lock', 'i-xs') + ' Total</span>' : `<button class="btn btn-ghost btn-xs" data-ep="${p.id}">${icon('pencil', 'i-xs')} Editar</button>`}</div></th>`).join('')}</tr></thead>
      <tbody>${groups.map(g => `<tr class="perm-group"><td colspan="${list.length + 1}">${esc(g)}</td></tr>${permissions.filter(x => x.group === g).map(x => `<tr><td><div class="cell-title">${esc(x.label)}</div><div class="cell-sub">${esc(x.help)}</div></td>
        ${list.map(p => { const on = p.key === 'admin' || p.permissions.includes(x.key); return `<td class="perm-col"><label class="perm-cell ${p.key === 'admin' ? 'locked' : ''}" title="${on ? 'Permitido' : 'No permitido'}"><input type="checkbox" data-p="${p.id}" data-k="${x.key}" ${on ? 'checked' : ''} ${p.key === 'admin' ? 'disabled' : ''}><span>${icon('check', 'i-xs')}</span></label></td>` }).join('')}</tr>`).join('')}`).join('')}
      <tr class="perm-group"><td colspan="${list.length + 1}">Administración</td></tr>
      <tr><td><div class="cell-title">Acceso a Administración</div><div class="cell-sub">Usuarios, perfiles, empresas, formularios, flujo, integraciones y auditoría. Exclusivo del perfil Administrador.</div></td>${list.map(p => `<td class="perm-col"><label class="perm-cell locked"><input type="checkbox" disabled ${p.key === 'admin' ? 'checked' : ''}><span>${icon('check', 'i-xs')}</span></label></td>`).join('')}</tr>
      </tbody></table></div>
      <div class="card-foot row between"><span class="xs muted">${icon('info', 'i-xs')} Los cambios se aplican en el próximo clic de cada usuario (no hace falta que cierre sesión).</span><button class="btn btn-primary btn-sm" id="save" disabled>${icon('save', 'i-sm')} Guardar cambios</button></div></div>

      <div class="card"><div class="card-head"><div><h3>${icon('id-card', 'i-sm')} Permisos extra por rol funcional</h3><div class="sub">Útil para dar una capacidad puntual a un área sin cambiar el perfil de todos. Ejemplo: el Responsable del Proyecto puede crear fincas aunque su perfil sea Colaborador.</div></div><div class="right"><a class="btn btn-sm" href="#/admin/roles">${icon('settings-2', 'i-sm')} Editar roles</a></div></div>
        <div class="card-body grid g-2" style="gap:10px">${roles.map(r => { const ps = parseRolePerms(r); return `<div class="row" style="padding:10px 12px;border:1px solid var(--line-2);border-radius:12px;align-items:flex-start"><span style="width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:${hexA(r.color, .14)};color:${r.color};flex-shrink:0">${icon(r.icon, 'i-xs')}</span><div class="grow"><div class="bold ink small">${esc(r.name)}</div><div class="row row-wrap mt-1" style="gap:4px">${ps.length ? ps.map(k => `<span class="mchip mchip-dom">+ ${esc(permissions.find(x => x.key === k)?.label || k)}</span>`).join('') : '<span class="xs muted">Sin permisos extra</span>'}</div></div></div>` }).join('')}</div></div>`
    paintIcons(el)
    const dirty = new Set()
    el.querySelectorAll('[data-p]').forEach(cb => cb.onchange = () => {
      const p = list.find(x => x.id == cb.dataset.p)
      p.permissions = cb.checked ? [...new Set([...p.permissions, cb.dataset.k])] : p.permissions.filter(k => k !== cb.dataset.k)
      dirty.add(p.id); el.querySelector('#save').disabled = false
    })
    el.querySelector('#save').onclick = async () => {
      try { for (const id of dirty) { const p = list.find(x => x.id === id); await api.put(`admin/profiles/${id}`, { permissions: p.permissions }) }
        dirty.clear(); el.querySelector('#save').disabled = true; await reboot(); toast('Permisos actualizados') } catch (e) { handleErr(e) }
    }
    el.querySelector('#add').onclick = () => profileModal(null, list, async () => { const r = await api.get('admin/profiles'); list.splice(0, list.length, ...r.profiles); await reboot(); draw() })
    el.querySelectorAll('[data-ep]').forEach(b => b.onclick = () => profileModal(list.find(x => x.id == b.dataset.ep), list, async () => { const r = await api.get('admin/profiles'); list.splice(0, list.length, ...r.profiles); await reboot(); draw() }))
  }
  draw()
}
const parseRolePerms = (r) => { try { return Array.isArray(r.permissions) ? r.permissions : JSON.parse(r.permissions || '[]') } catch { return [] } }
function profileModal(p, list, done) {
  const m = modal({ title: p ? `Perfil: ${esc(p.name)}` : 'Nuevo perfil', icon: 'shield-check', tone: 'tone-green',
    body: `<div class="form-grid">
      <div class="field w-two_thirds"><label>Nombre <span class="req">*</span></label><input class="input" id="n" value="${esc(p?.name || '')}" placeholder="Ej. Responsable de finca"></div>
      <div class="field w-third"><label>Color</label><input type="color" class="color-input" id="c" value="${esc(p?.color || '#0A88C9')}"></div>
      <div class="field w-full"><label>Descripción</label><input class="input" id="d" value="${esc(p?.description || '')}" placeholder="Para qué se usa este perfil"></div>
      ${p ? '' : `<div class="field w-full"><label>Copiar permisos de</label><select class="select" id="cp"><option value="">— Empezar sin permisos (sólo lectura) —</option>${list.filter(x => x.key !== 'admin').map(x => `<option value="${x.key}" ${x.key === 'operativo' ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><span class="help">Después ajustás cada permiso en la matriz.</span></div>`}
      ${p?.is_system ? `<div class="field w-full"><span class="xs muted">${icon('lock', 'i-xs')} Perfil base: se pueden cambiar nombre y permisos, pero no eliminarlo.</span></div>` : ''}
    </div>`,
    foot: `${p && !p.is_system ? `<button class="btn btn-danger" id="del">${icon('trash-2', 'i-sm')} Eliminar</button>` : ''}<span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">${icon('save', 'i-sm')} Guardar</button>` })
  m.$('#ok').onclick = async () => {
    const body = { name: m.$('#n').value.trim(), color: m.$('#c').value, description: m.$('#d').value }
    if (!body.name) return toast('El nombre es obligatorio', 'warn')
    try { p ? await api.put(`admin/profiles/${p.id}`, body) : await api.post('admin/profiles', { ...body, copy_from: m.$('#cp').value || null }); m.close(); toast('Perfil guardado'); await done() } catch (e) { handleErr(e) }
  }
  m.$('#del')?.addEventListener('click', async () => { if (await confirmDialog({ title: 'Eliminar perfil', message: 'Sólo se puede eliminar si ningún usuario lo tiene asignado.', danger: true, confirm: 'Eliminar' })) try { await api.del(`admin/profiles/${p.id}`); m.close(); toast('Perfil eliminado'); await done() } catch (e) { handleErr(e) } })
}

// ------------------------------------------------------------------ CONSTRUCTOR
async function builder(el) {
  let entity = sessionStorage.getItem('rimi_builder_entity') || 'project'
  const draw = () => {
    const secs = B().form_sections.filter(s => s.entity === entity).sort((a, b) => a.sort - b.sort)
    const all = B().form_fields.filter(f => f.entity === entity)
    const fields = all.filter(f => !f.deleted_at)
    const trash = all.filter(f => f.deleted_at)
    el.innerHTML = `<div class="card mb-3"><div class="card-head"><div><h3>${icon('blocks', 'i-sm')} Constructor de formularios</h3><div class="sub">Arrastrá para reordenar campos y secciones, agregá campos nuevos o cambiá etiquetas, ayudas, opciones y obligatoriedad. Con el ícono de papelera quitás un campo del formulario; queda en la <b>Papelera</b> y se puede restaurar. Los campos marcados como estructurales no se pueden quitar.</div></div>
      <div class="right"><div class="seg" id="ent"><button data-e="project" class="${entity === 'project' ? 'active' : ''}">${icon('notebook-pen', 'i-xs')} Ficha de proyecto</button><button data-e="investment" class="${entity === 'investment' ? 'active' : ''}">${icon('package', 'i-xs')} Inversión / bien</button></div></div></div></div>
    <div class="builder">
      <aside class="palette card card-pad"><div class="xs bold muted mb-2" style="text-transform:uppercase;letter-spacing:.1em">Agregar campo</div>${FIELD_TYPES.map(([k, l, ic]) => `<button class="palette-item" data-add="${k}" title="Clic para agregar a la ficha">${icon(ic, 'i-sm')} <span class="grow" style="text-align:left">${l}</span>${icon('plus', 'i-xs')}</button>`).join('')}
        <div class="divider"></div><button class="btn btn-sm btn-block" id="add-sec">${icon('plus', 'i-sm')} Nueva sección</button>
        <a class="btn btn-sm btn-block mt-1" href="#/projects">${icon('eye', 'i-sm')} Ver en un proyecto</a></aside>
      <div id="secs">${secs.map(s => `<div class="b-section" data-sec-id="${s.id}" style="${s.active ? '' : 'opacity:.55'}">
        <div class="b-section-head"><span class="handle sec-handle">${icon('grip-vertical', 'i-sm')}</span><span class="ficha-letter" style="width:28px;height:28px;font-size:12px;border-radius:9px;${s.restricted ? 'background:var(--sun-600)' : ''}">${esc(s.letter || '·')}</span>
          <div class="grow"><b class="ink">${esc(s.title)}</b> ${s.restricted ? `<span class="badge sun">${icon('lock', 'i-xs')} Sólo RIMI/Impuestos</span>` : ''}${!s.active ? '<span class="badge">Oculta</span>' : ''}<div class="xs muted">${esc(s.description || '')}</div></div>
          <span class="xs muted">${fields.filter(f => f.section_key === s.key).length} campos</span><button class="btn btn-ghost btn-xs" data-edit-sec="${s.id}">${icon('settings-2', 'i-xs')} Sección</button></div>
        <div class="b-fields" data-sec="${s.key}">${fields.filter(f => f.section_key === s.key).sort((a, b) => a.sort - b.sort).map(f => { const [, tl, ic] = typeMeta(f.type); return `<div class="b-field ${f.active ? '' : 'inactive'}" data-fid="${f.id}" style="grid-column:span ${({ full: 12, half: 6, third: 6, two_thirds: 8, quarter: 6 })[f.width] || 6}">
          <span class="f-grip" aria-hidden="true">${icon('grip-vertical', 'i-xs')}</span><span class="bt">${icon(ic, 'i-xs')}</span><div class="grow" style="min-width:0"><div class="bl clamp2">${esc(f.label)} ${f.required ? '<span style="color:var(--rose-600)">*</span>' : ''}</div><div class="bm"><span class="mchip">${tl}</span><span class="mchip">${({ full: 'Ancho completo', half: '1/2', third: '1/3', two_thirds: '2/3', quarter: '1/4' })[f.width] || ''}</span>${f.core ? `<span class="mchip mchip-lock">${icon('lock', 'i-xs')} Sistema</span>` : ''}${!f.active ? '<span class="mchip">Oculto</span>' : ''}</div></div>
          <button class="btn btn-ghost btn-xs btn-icon" data-edit-f="${f.id}" title="Configurar">${icon('pencil', 'i-xs')}</button>${STRUCT[entity].includes(f.key) ? `<span class="btn btn-ghost btn-xs btn-icon f-lock" title="Campo estructural: no se puede quitar">${icon('lock', 'i-xs')}</span>` : `<button class="btn btn-ghost btn-xs btn-icon f-del" data-del-f="${f.id}" title="Eliminar campo">${icon('trash-2', 'i-xs')}</button>`}</div>` }).join('') || '<div class="b-empty">Sección vacía · arrastrá campos acá</div>'}</div></div>`).join('')}
        <div class="b-section b-trash ${trash.length ? '' : 'is-empty'}"><div class="b-section-head"><span class="ficha-letter" style="width:28px;height:28px;border-radius:9px;background:#94A3A0">${icon('trash-2', 'i-xs')}</span><div class="grow"><b class="ink">Papelera</b><div class="xs muted">${trash.length ? `${trash.length} campo${trash.length === 1 ? '' : 's'} quitado${trash.length === 1 ? '' : 's'} del formulario. Los datos ya cargados se conservan y vuelven a verse si lo restaurás.` : 'Vacía. Los campos que elimines aparecen acá y se pueden restaurar.'}</div></div></div>
          ${trash.length ? `<div class="list">${trash.map(f => `<div class="list-item"><span class="bt" style="width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:var(--line-2);color:var(--muted)">${icon(typeMeta(f.type)[2], 'i-xs')}</span><div class="grow"><div class="t small">${esc(f.label)}</div><div class="s">${esc(typeMeta(f.type)[1])}${f.core ? ' · campo del sistema' : ' · campo personalizado'} · sección ${esc(secs.find(x => x.key === f.section_key)?.title || '(eliminada)')}</div></div><button class="btn btn-sm" data-restore="${f.id}">${icon('rotate-ccw', 'i-sm')} Restaurar</button>${f.core ? '' : `<button class="btn btn-ghost btn-sm btn-icon" data-purge="${f.id}" title="Borrar definitivamente">${icon('x', 'i-sm')}</button>`}</div>`).join('')}</div>` : ''}
        </div></div>
    </div>`
    paintIcons(el)
    el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { entity = b.dataset.e; sessionStorage.setItem('rimi_builder_entity', entity); draw() })
    el.querySelectorAll('[data-add]').forEach(b => b.onclick = () => fieldModal(null, entity, b.dataset.add, secs, draw))
    el.querySelectorAll('[data-edit-f]').forEach(b => b.onclick = (e) => { e.stopPropagation(); fieldModal(fields.find(f => f.id == b.dataset.editF), entity, null, secs, draw) })
    el.querySelectorAll('[data-edit-sec]').forEach(b => b.onclick = () => sectionModal(secs.find(s => s.id == b.dataset.editSec), entity, draw))
    el.querySelector('#add-sec').onclick = () => sectionModal(null, entity, draw)
    el.querySelectorAll('[data-del-f]').forEach(b => b.onclick = (e) => { e.stopPropagation(); deleteField(fields.find(f => f.id == b.dataset.delF), draw) })
    el.querySelectorAll('[data-restore]').forEach(b => b.onclick = async () => { try { await api.post(`admin/form-fields/${b.dataset.restore}/restore`); await reboot(); toast('Campo restaurado'); draw() } catch (e) { handleErr(e) } })
    el.querySelectorAll('[data-purge]').forEach(b => b.onclick = async () => { const f = trash.find(x => x.id == b.dataset.purge); if (await confirmDialog({ title: 'Borrar definitivamente', message: `"${f.label}" se eliminará para siempre y los datos cargados en ese campo dejarán de poder recuperarse desde el formulario.`, danger: true, confirm: 'Borrar' })) try { await api.del(`admin/form-fields/${f.id}?purge=1`); await reboot(); toast('Campo borrado'); draw() } catch (e) { handleErr(e) } })
    if (window.Sortable) {
      el.querySelectorAll('.b-fields').forEach(c => new Sortable(c, { group: 'fields-' + entity, animation: 160, ghostClass: 'sortable-ghost', filter: 'button, .f-lock, .b-empty', preventOnFilter: false,
        onEnd: async () => {
          const items = []
          el.querySelectorAll('.b-fields').forEach(col => [...col.children].filter(x => x.dataset.fid).forEach((x, i) => items.push({ id: Number(x.dataset.fid), sort: i + 1, section_key: col.dataset.sec })))
          try { await api.post('admin/reorder', { table: 'fields', items }); await reboot(); toast('Orden guardado') } catch (e) { handleErr(e) }
        } }))
      new Sortable(el.querySelector('#secs'), { handle: '.sec-handle', animation: 160, onEnd: async () => {
        const items = [...el.querySelectorAll('[data-sec-id]')].map((x, i) => ({ id: Number(x.dataset.secId), sort: i + 1 }))
        try { await api.post('admin/reorder', { table: 'sections', items }); await reboot(); toast('Secciones reordenadas') } catch (e) { handleErr(e) }
      } })
    }
  }
  draw()
}
function fieldModal(f, entity, newType, secs, done) {
  const type = f?.type || newType
  const hasOpts = ['select', 'multiselect'].includes(type)
  const m = modal({ title: f ? `Campo: ${esc(f.label)}` : `Nuevo campo · ${typeMeta(type)[1]}`, icon: typeMeta(type)[2], tone: 'tone-violet', size: 'lg',
    body: `<div class="form-grid">
      <div class="field w-two_thirds"><label>Etiqueta <span class="req">*</span></label><input class="input" id="l" value="${esc(f?.label || '')}" placeholder="Ej. Potencia instalada (kW)"></div>
      <div class="field w-third"><label>Tipo</label><select class="select" id="t" ${f?.core ? 'disabled' : ''}>${FIELD_TYPES.map(([k, l]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field w-half"><label>Sección</label><select class="select" id="s">${secs.map(s => `<option value="${s.key}" ${s.key === f?.section_key ? 'selected' : ''}>${esc(s.letter ? s.letter + '. ' : '')}${esc(s.title)}</option>`).join('')}</select></div>
      <div class="field w-half"><label>Ancho</label><select class="select" id="w">${[['full', 'Completo'], ['two_thirds', '2/3'], ['half', 'Mitad'], ['third', '1/3'], ['quarter', '1/4']].map(([k, v]) => `<option value="${k}" ${k === (f?.width || 'half') ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field w-full ${hasOpts ? '' : 'hidden'}" id="ow"><label>Opciones (una por línea)</label><textarea class="textarea" id="o" placeholder="Opción A&#10;Opción B">${esc(fieldOptions(f || {}).join('\n'))}</textarea></div>
      <div class="field w-half"><label>Texto de ayuda</label><input class="input" id="h" value="${esc(f?.help || '')}"></div>
      <div class="field w-half"><label>Placeholder</label><input class="input" id="p" value="${esc(f?.placeholder || '')}"></div>
      <div class="field w-full"><div class="row" style="gap:22px"><label class="check"><input type="checkbox" id="r" ${f?.required ? 'checked' : ''}> Obligatorio</label><label class="check"><input type="checkbox" id="a" ${f?.active !== 0 ? 'checked' : ''}> Visible</label><label class="check"><input type="checkbox" id="ro" ${f?.readonly ? 'checked' : ''}> Sólo lectura</label></div></div>
      ${f ? `<div class="field w-full"><span class="xs muted">Clave interna: <span class="mono">${esc(f.key)}</span>${f.core ? ' · Campo del sistema vinculado a reportes y lógica del flujo' : ''}</span></div>` : ''}
    </div>`,
    foot: `${f && !STRUCT[entity].includes(f.key) ? `<button class="btn btn-danger" id="del">${icon('trash-2', 'i-sm')} Eliminar campo</button>` : ''}<span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">${icon('save', 'i-sm')} Guardar</button>` })
  m.$('#t').onchange = (e) => m.$('#ow').classList.toggle('hidden', !['select', 'multiselect'].includes(e.target.value))
  m.$('#ok').onclick = async () => {
    const body = { label: m.$('#l').value.trim(), type: m.$('#t').value, section_key: m.$('#s').value, width: m.$('#w').value, options: m.$('#o').value.split('\n').map(x => x.trim()).filter(Boolean).join('|') || null,
      help: m.$('#h').value || null, placeholder: m.$('#p').value || null, required: m.$('#r').checked ? 1 : 0, active: m.$('#a').checked ? 1 : 0, readonly: m.$('#ro').checked ? 1 : 0, entity }
    if (!body.label) return toast('La etiqueta es obligatoria', 'warn')
    if (f?.core) delete body.type
    try { f ? await api.put(`admin/form-fields/${f.id}`, body) : await api.post('admin/form-fields', body); await reboot(); toast('Campo guardado'); m.close(); done() } catch (e) { handleErr(e) }
  }
  m.$('#del')?.addEventListener('click', () => deleteField(f, () => { m.close(); done() }))
}
const STRUCT = { project: ['name', 'company_id', 'zone_id', 'type_id', 'responsible_id', 'code'], investment: ['description'] }
async function deleteField(f, done) {
  if (!f) return
  const ok = await confirmDialog({ title: `Eliminar "${f.label}"`, message: `El campo deja de mostrarse en el formulario y pasa a la Papelera, desde donde podés restaurarlo. ${f.core ? 'Es un campo del sistema: puede figurar en reportes o en el Excel del Anexo I.' : 'Los datos ya cargados se conservan.'}`, danger: true, confirm: 'Eliminar' })
  if (!ok) return
  try { await api.del(`admin/form-fields/${f.id}`); await reboot(); toast('Campo enviado a la Papelera'); done() } catch (e) { handleErr(e) }
}
function sectionModal(s, entity, done) {
  const m = modal({ title: s ? 'Editar sección' : 'Nueva sección', icon: 'layout-list', tone: 'tone-violet',
    body: `<div class="form-grid"><div class="field w-quarter"><label>Letra</label><input class="input" id="lt" maxlength="2" value="${esc(s?.letter || '')}"></div><div class="field w-three"><label>Título <span class="req">*</span></label><input class="input" id="t" value="${esc(s?.title || '')}"></div>
      <div class="field w-full"><label>Descripción</label><input class="input" id="d" value="${esc(s?.description || '')}"></div>
      <div class="field w-full row" style="gap:20px"><label class="check"><input type="checkbox" id="r" ${s?.restricted ? 'checked' : ''}> Sólo editable por RIMI / Impuestos</label><label class="check"><input type="checkbox" id="a" ${s?.active !== 0 ? 'checked' : ''}> Visible</label></div></div>`,
    foot: `${s ? `<button class="btn btn-danger" id="del">${icon('trash-2', 'i-sm')}</button>` : ''}<span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">Guardar</button>` })
  m.$('.w-three').style.gridColumn = 'span 9'
  m.$('#ok').onclick = async () => {
    const body = { entity, letter: m.$('#lt').value || null, title: m.$('#t').value.trim(), description: m.$('#d').value, restricted: m.$('#r').checked ? 1 : 0, active: m.$('#a').checked ? 1 : 0 }
    if (!body.title) return toast('Título obligatorio', 'warn')
    try { s ? await api.put(`admin/form-sections/${s.id}`, body) : await api.post('admin/form-sections', body); await reboot(); m.close(); done(); toast('Sección guardada') } catch (e) { handleErr(e) }
  }
  m.$('#del')?.addEventListener('click', async () => { if (await confirmDialog({ title: 'Eliminar sección', message: 'Sus campos pasan a la Papelera (se pueden restaurar). Si contiene campos estructurales, primero movelos a otra sección.', danger: true, confirm: 'Eliminar' })) try { await api.del(`admin/form-sections/${s.id}`); await reboot(); m.close(); done() } catch (e) { handleErr(e) } })
}

// ------------------------------------------------------------------ FLUJO
async function workflow(el) {
  let { stage_tasks } = await api.get('admin/stage-tasks')
  let entity = 'project'
  const draw = () => {
    const stages = stagesFor(entity)
    el.innerHTML = `<div class="card mb-3"><div class="card-head"><div><h3>${icon('git-branch', 'i-sm')} Flujo de etapas</h3><div class="sub">Definí etapas, plazos de referencia (días hábiles), rol responsable y las tareas que se crean automáticamente al ingresar a cada etapa.</div></div>
      <div class="right"><div class="seg"><button data-e="project" class="${entity === 'project' ? 'active' : ''}">Proyecto</button><button data-e="investment" class="${entity === 'investment' ? 'active' : ''}">Inversión</button></div><button class="btn btn-primary btn-sm" id="add">${icon('plus', 'i-sm')} Etapa</button></div></div></div>
      <div id="stl">${stages.map((s, i) => `<div class="stage-card" data-sid="${s.id}"><span class="handle" style="padding-top:8px">${icon('grip-vertical', 'i-sm')}</span><span class="stage-num" style="background:${s.color}">${icon(s.icon, 'i-sm')}</span>
        <div class="grow"><div class="row row-wrap" style="gap:8px"><b class="ink">${i + 1}. ${esc(s.name)}</b>${s.phase ? `<span class="badge outline">${esc(s.phase)}</span>` : ''}${s.sla_days ? `<span class="badge sun">${s.sla_days} días háb.</span>` : ''}${s.role_key ? `<span class="badge green">${esc(roleOf(s.role_key).name)}</span>` : ''}${s.is_final ? '<span class="badge dark">Final</span>' : ''}</div>
        <p class="small muted mt-1">${esc(s.description || '')}</p>
        ${entity === 'project' ? `<div class="mt-2">${stage_tasks.filter(t => t.entity === entity && t.stage_key === s.key).map(t => `<div class="auto-task" style="${t.active ? '' : 'opacity:.5'}">${icon('sparkles', 'i-xs')}<span class="grow"><b class="ink">${esc(t.title)}</b> <span class="muted">· ${esc(roleOf(t.role_key).name)} · ${t.due_days} días háb. ${t.procedure_ref ? '· ' + esc(t.procedure_ref) : ''}</span></span><button class="btn btn-ghost btn-xs btn-icon" data-et="${t.id}">${icon('pencil', 'i-xs')}</button></div>`).join('')}
          <button class="btn btn-ghost btn-xs mt-1" data-nt="${s.key}">${icon('plus', 'i-xs')} Tarea automática</button></div>` : ''}</div>
        <button class="btn btn-ghost btn-sm" data-es="${s.id}">${icon('pencil', 'i-sm')}</button></div>`).join('')}</div>`
    paintIcons(el)
    el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { entity = b.dataset.e; draw() })
    el.querySelector('#add').onclick = () => stageModal(null, entity, draw)
    el.querySelectorAll('[data-es]').forEach(b => b.onclick = () => stageModal(stages.find(s => s.id == b.dataset.es), entity, draw))
    const reloadT = async () => { stage_tasks = (await api.get('admin/stage-tasks')).stage_tasks; draw() }
    el.querySelectorAll('[data-nt]').forEach(b => b.onclick = () => stageTaskModal(null, b.dataset.nt, reloadT))
    el.querySelectorAll('[data-et]').forEach(b => b.onclick = () => stageTaskModal(stage_tasks.find(t => t.id == b.dataset.et), null, reloadT))
    if (window.Sortable) new Sortable(el.querySelector('#stl'), { handle: '.handle', animation: 160, onEnd: async () => {
      const items = [...el.querySelectorAll('[data-sid]')].map((x, i) => ({ id: Number(x.dataset.sid), sort: i + 1 }))
      try { await api.post('admin/reorder', { table: 'stages', items }); await reboot(); draw(); toast('Orden de etapas guardado') } catch (e) { handleErr(e) }
    } })
  }
  draw()
}
function stageModal(s, entity, done) {
  const m = modal({ title: s ? `Etapa: ${esc(s.name)}` : 'Nueva etapa', icon: 'git-commit-horizontal', tone: 'tone-sun', size: 'lg',
    body: `<div class="form-grid"><div class="field w-half"><label>Nombre <span class="req">*</span></label><input class="input" id="n" value="${esc(s?.name || '')}"></div><div class="field w-quarter"><label>Nombre corto</label><input class="input" id="sn" value="${esc(s?.short_name || '')}"></div><div class="field w-quarter"><label>Fase</label><input class="input" id="ph" value="${esc(s?.phase || '')}" placeholder="Preliminar / Ejecución…"></div>
      <div class="field w-third"><label>Plazo (días hábiles)</label><input class="input" type="number" id="sla" value="${esc(s?.sla_days || '')}"></div><div class="field w-third"><label>Rol responsable</label><select class="select" id="r"><option value="">—</option>${B().roles.map(r => `<option value="${r.key}" ${r.key === s?.role_key ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
      <div class="field w-quarter" style="grid-column:span 2"><label>Color</label><input type="color" class="color-input" id="c" value="${esc(s?.color || '#4F8226')}"></div><div class="field" style="grid-column:span 2"><label>Ícono</label><input class="input" id="ic" value="${esc(s?.icon || 'circle')}"></div>
      <div class="field w-full"><label>Descripción / instrucciones</label><textarea class="textarea" id="d">${esc(s?.description || '')}</textarea></div>
      <div class="field w-full"><label class="check"><input type="checkbox" id="f" ${s?.is_final ? 'checked' : ''}> Etapa final (cierre)</label></div></div>`,
    foot: `${s ? `<button class="btn btn-danger" id="del">${icon('trash-2', 'i-sm')}</button>` : ''}<span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">Guardar</button>` })
  m.$('#ok').onclick = async () => {
    const body = { entity, name: m.$('#n').value.trim(), short_name: m.$('#sn').value || null, phase: m.$('#ph').value || null, sla_days: Number(m.$('#sla').value) || null, role_key: m.$('#r').value || null, color: m.$('#c').value, icon: m.$('#ic').value || 'circle', description: m.$('#d').value, is_final: m.$('#f').checked ? 1 : 0 }
    if (!body.name) return toast('Nombre obligatorio', 'warn')
    try { s ? await api.put(`admin/stages/${s.id}`, body) : await api.post('admin/stages', body); await reboot(); m.close(); done(); toast('Etapa guardada') } catch (e) { handleErr(e) }
  }
  m.$('#del')?.addEventListener('click', async () => { if (await confirmDialog({ title: 'Eliminar etapa', message: 'Sólo si no hay registros en ella.', danger: true, confirm: 'Eliminar' })) try { await api.del(`admin/stages/${s.id}`); await reboot(); m.close(); done() } catch (e) { handleErr(e) } })
}
function stageTaskModal(t, stage_key, done) {
  const m = modal({ title: t ? 'Tarea automática' : 'Nueva tarea automática', icon: 'sparkles', tone: 'tone-violet', size: 'lg',
    body: `<div class="form-grid"><div class="field w-full"><label>Título <span class="req">*</span></label><input class="input" id="t" value="${esc(t?.title || '')}"></div>
      <div class="field w-third"><label>Etapa</label><select class="select" id="s">${stagesFor('project').map(s => `<option value="${s.key}" ${s.key === (t?.stage_key || stage_key) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field w-third"><label>Rol asignado</label><select class="select" id="r">${B().roles.map(r => `<option value="${r.key}" ${r.key === t?.role_key ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
      <div class="field w-third"><label>Vence en (días hábiles)</label><input class="input" type="number" id="dd" value="${esc(t?.due_days || 5)}"></div>
      <div class="field w-two_thirds"><label>Descripción</label><textarea class="textarea" id="d">${esc(t?.description || '')}</textarea></div><div class="field w-third"><label>Referencia procedimiento</label><input class="input" id="pr" value="${esc(t?.procedure_ref || '')}" placeholder="5.1.3 · Paso 2"></div>
      <div class="field w-full"><label class="check"><input type="checkbox" id="a" ${t?.active !== 0 ? 'checked' : ''}> Activa</label></div></div>`,
    foot: `${t ? `<button class="btn btn-danger" id="del">${icon('trash-2', 'i-sm')}</button>` : ''}<span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">Guardar</button>` })
  m.$('#ok').onclick = async () => {
    const body = { entity: 'project', title: m.$('#t').value.trim(), stage_key: m.$('#s').value, role_key: m.$('#r').value, due_days: Number(m.$('#dd').value) || 5, description: m.$('#d').value, procedure_ref: m.$('#pr').value, active: m.$('#a').checked ? 1 : 0 }
    if (!body.title) return toast('Título obligatorio', 'warn')
    try { t ? await api.put(`admin/stage-tasks/${t.id}`, body) : await api.post('admin/stage-tasks', body); m.close(); done(); toast('Tarea automática guardada') } catch (e) { handleErr(e) }
  }
  m.$('#del')?.addEventListener('click', async () => { try { await api.del(`admin/stage-tasks/${t.id}`); m.close(); done() } catch (e) { handleErr(e) } })
}

// ------------------------------------------------------------------ ROLES
let PERM_CACHE = []
async function roles(el) {
  PERM_CACHE = (await api.get('admin/permissions')).permissions
  el.innerHTML = `<div class="card"><div class="card-head"><div><h3>Roles funcionales</h3><div class="sub">Áreas que intervienen en el procedimiento. Se usan para asignar tareas automáticas y responsables, y pueden sumar permisos extra al perfil del usuario.</div></div><div class="right"><button class="btn btn-primary btn-sm" id="add">${icon('plus', 'i-sm')} Rol</button></div></div>
    <div class="card-body grid g-2">${B().roles.map(r => `<div class="row" style="padding:12px;border:1px solid var(--line-2);border-radius:14px"><span style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:${hexA(r.color, .14)};color:${r.color}">${icon(r.icon, 'i-sm')}</span><div class="grow"><div class="bold ink">${esc(r.name)}</div><div class="xs muted">${esc(r.description || '')}</div>${parseRolePerms(r).length ? `<div class="row row-wrap mt-1" style="gap:4px">${parseRolePerms(r).map(k => `<span class="mchip mchip-dom">+ ${esc(PERM_CACHE.find(x => x.key === k)?.label || k)}</span>`).join('')}</div>` : ''}</div><button class="btn btn-ghost btn-xs" data-e="${r.id}">${icon('pencil', 'i-xs')}</button></div>`).join('')}</div></div>`
  const form = (r) => {
    const m = modal({ title: r ? 'Editar rol' : 'Nuevo rol', icon: 'id-card', body: `<div class="form-grid"><div class="field w-half"><label>Nombre</label><input class="input" id="n" value="${esc(r?.name || '')}"></div><div class="field w-half"><label>Clave interna</label><input class="input mono" id="k" value="${esc(r?.key || '')}" ${r ? 'disabled' : ''} placeholder="control_gestion"></div><div class="field w-full"><label>Descripción</label><input class="input" id="d" value="${esc(r?.description || '')}"></div><div class="field w-half"><label>Ícono (lucide)</label><input class="input" id="i" value="${esc(r?.icon || 'user')}"></div><div class="field w-half"><label>Color</label><input type="color" class="color-input" id="c" value="${esc(r?.color || '#4F8226')}"></div>
      <div class="field w-full"><label>Permisos extra que otorga este rol</label><span class="help" style="margin:-2px 0 6px">Se suman a los del perfil del usuario. Dejalo vacío si el rol sólo sirve para asignar tareas.</span><div class="perm-pick" id="pp">${PERM_CACHE.map(x => `<label class="check"><input type="checkbox" data-rp="${x.key}" ${parseRolePerms(r || {}).includes(x.key) ? 'checked' : ''}> <span><b class="small ink">${esc(x.label)}</b> <span class="xs muted">· ${esc(x.group)}</span></span></label>`).join('')}</div></div></div>`, size: 'lg',
      foot: `${r ? `<button class="btn btn-danger" id="del">${icon('trash-2', 'i-sm')}</button>` : ''}<span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">Guardar</button>` })
    m.$('#ok').onclick = async () => { try { const body = { name: m.$('#n').value, description: m.$('#d').value, icon: m.$('#i').value, color: m.$('#c').value, permissions: m.$$('[data-rp]').filter(x => x.checked).map(x => x.dataset.rp) }; r ? await api.put(`admin/roles/${r.id}`, body) : await api.post('admin/roles', { ...body, key: m.$('#k').value }); await reboot(); m.close(); rerender() } catch (e) { handleErr(e) } }
    m.$('#del')?.addEventListener('click', async () => { try { await api.del(`admin/roles/${r.id}`); await reboot(); m.close(); rerender() } catch (e) { handleErr(e) } })
  }
  el.querySelector('#add').onclick = () => form(null)
  el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => form(B().roles.find(r => r.id == b.dataset.e)))
}

// ------------------------------------------------------------------ TIPOS
async function types(el) {
  el.innerHTML = `<div class="card"><div class="card-head"><div><h3>Tipos de proyecto</h3><div class="sub">Energético, riego, malla antigranizo… Indicá si están exentos de monto mínimo (RG 5849).</div></div><div class="right"><button class="btn btn-primary btn-sm" id="add">${icon('plus', 'i-sm')} Tipo</button></div></div>
    <div class="card-body grid g-2">${B().project_types.map(t => `<div class="row" style="padding:12px;border:1px solid var(--line-2);border-radius:14px;${t.active ? '' : 'opacity:.5'}"><span style="width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:${hexA(t.color, .14)};color:${t.color}">${icon(t.icon, 'i-sm')}</span><div class="grow"><div class="bold ink">${esc(t.name)} ${t.min_exempt ? '<span class="badge green">Sin monto mínimo</span>' : ''}</div><div class="xs muted">${esc(t.description || '')}</div></div><button class="btn btn-ghost btn-xs" data-e="${t.id}">${icon('pencil', 'i-xs')}</button></div>`).join('')}</div></div>`
  const form = (t) => {
    const m = modal({ title: t ? 'Editar tipo' : 'Nuevo tipo de proyecto', icon: 'tags', size: 'lg', body: `<div class="form-grid"><div class="field w-half"><label>Nombre</label><input class="input" id="n" value="${esc(t?.name || '')}"></div><div class="field w-quarter"><label>Color</label><input type="color" class="color-input" id="c" value="${esc(t?.color || '#4F8226')}"></div><div class="field w-quarter"><label>Estado</label><select class="select" id="a"><option value="1">Activo</option><option value="0" ${t?.active === 0 ? 'selected' : ''}>Inactivo</option></select></div>
      <div class="field w-full"><label>Ícono</label><div class="row row-wrap" style="gap:6px" id="icons">${ICONS.map(i => `<button type="button" class="btn btn-sm btn-icon ${i === (t?.icon || 'folder') ? 'btn-primary' : ''}" data-i="${i}">${icon(i, 'i-sm')}</button>`).join('')}</div></div>
      <div class="field w-full"><label>Descripción</label><input class="input" id="d" value="${esc(t?.description || '')}"></div><div class="field w-full"><label class="check"><input type="checkbox" id="x" ${t?.min_exempt ? 'checked' : ''}> No sujeto a monto mínimo de inversión</label></div></div>`,
      foot: `${t ? `<button class="btn btn-danger" id="del">${icon('trash-2', 'i-sm')}</button>` : ''}<span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">Guardar</button>` })
    let ic = t?.icon || 'folder'
    m.$$('[data-i]').forEach(b => b.onclick = () => { ic = b.dataset.i; m.$$('[data-i]').forEach(x => x.classList.toggle('btn-primary', x === b)) })
    m.$('#ok').onclick = async () => { try { const body = { name: m.$('#n').value, color: m.$('#c').value, icon: ic, description: m.$('#d').value, min_exempt: m.$('#x').checked ? 1 : 0, active: Number(m.$('#a').value) }; t ? await api.put(`admin/project-types/${t.id}`, body) : await api.post('admin/project-types', body); await reboot(); m.close(); rerender() } catch (e) { handleErr(e) } }
    m.$('#del')?.addEventListener('click', async () => { try { await api.del(`admin/project-types/${t.id}`); await reboot(); m.close(); rerender() } catch (e) { handleErr(e) } })
  }
  el.querySelector('#add').onclick = () => form(null)
  el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => form(B().project_types.find(t => t.id == b.dataset.e)))
}

// ------------------------------------------------------------------ AGENDA
async function agenda(el) {
  const { recurring } = await api.get('admin/recurring')
  el.innerHTML = `<div class="card"><div class="card-head"><div><h3>Agenda mensual recurrente</h3><div class="sub">Obligaciones del procedimiento que se repiten cada mes y aparecen en la Agenda.</div></div><div class="right"><button class="btn btn-primary btn-sm" id="add">${icon('plus', 'i-sm')} Evento</button></div></div>
    <div class="list">${recurring.map(r => `<div class="list-item"><span class="badge" style="background:${hexA(r.color, .12)};color:${r.color};min-width:80px;justify-content:center">${r.day_to && r.day_to !== r.day_from ? `Días ${r.day_from}-${r.day_to}` : `Día ${r.day_from}`}</span><div class="grow"><div class="t">${esc(r.title)}</div><div class="s">${esc(r.description || '')} · ${esc(roleOf(r.role_key).name)} · ${esc(r.procedure_ref || '')}</div></div><button class="btn btn-ghost btn-xs" data-e="${r.id}">${icon('pencil', 'i-xs')}</button></div>`).join('')}</div></div>`
  const form = (r) => {
    const m = modal({ title: r ? 'Editar evento' : 'Nuevo evento recurrente', icon: 'calendar-range', size: 'lg', body: `<div class="form-grid"><div class="field w-full"><label>Título</label><input class="input" id="t" value="${esc(r?.title || '')}"></div><div class="field w-quarter"><label>Día desde</label><input class="input" type="number" min="1" max="31" id="f" value="${esc(r?.day_from || 1)}"></div><div class="field w-quarter"><label>Día hasta</label><input class="input" type="number" min="1" max="31" id="to" value="${esc(r?.day_to || '')}"></div><div class="field w-quarter"><label>Rol</label><select class="select" id="r">${B().roles.map(x => `<option value="${x.key}" ${x.key === r?.role_key ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div><div class="field w-quarter"><label>Color</label><input type="color" class="color-input" id="c" value="${esc(r?.color || '#4F8226')}"></div><div class="field w-two_thirds"><label>Descripción</label><input class="input" id="d" value="${esc(r?.description || '')}"></div><div class="field w-third"><label>Referencia</label><input class="input" id="p" value="${esc(r?.procedure_ref || '')}"></div></div>`,
      foot: `${r ? `<button class="btn btn-danger" id="del">${icon('trash-2', 'i-sm')}</button>` : ''}<span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">Guardar</button>` })
    m.$('#ok').onclick = async () => { try { const body = { title: m.$('#t').value, day_from: Number(m.$('#f').value), day_to: Number(m.$('#to').value) || null, role_key: m.$('#r').value, color: m.$('#c').value, description: m.$('#d').value, procedure_ref: m.$('#p').value }; r ? await api.put(`admin/recurring/${r.id}`, body) : await api.post('admin/recurring', body); m.close(); rerender() } catch (e) { handleErr(e) } }
    m.$('#del')?.addEventListener('click', async () => { try { await api.del(`admin/recurring/${r.id}`); m.close(); rerender() } catch (e) { handleErr(e) } })
  }
  el.querySelector('#add').onclick = () => form(null)
  el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => form(recurring.find(x => x.id == b.dataset.e)))
}

// ------------------------------------------------------------------ CARPETAS
async function docs(el) {
  el.innerHTML = `<div class="grid g-2"><div class="card"><div class="card-head"><div><h3>Estructura de carpetas · Anexo II</h3><div class="sub">Fija e igual para todos los proyectos.</div></div></div><div class="list">${B().folders.map(f => `<div class="list-item"><span class="file-ico tone-sun">${icon('folder', 'i-sm')}</span><div class="grow"><div class="t">${esc(f.name)}</div><div class="s">${esc(f.description || '')}</div></div>${f.per_investment ? '<span class="badge sun">Por inversión</span>' : ''}<button class="btn btn-ghost btn-xs" data-f="${f.id}">${icon('pencil', 'i-xs')}</button></div>`).join('')}</div></div>
    <div class="card"><div class="card-head"><h3>Tipos de documento</h3><div class="right"><button class="btn btn-primary btn-sm" id="add">${icon('plus', 'i-sm')} Tipo</button></div></div><div class="list">${B().doc_types.map(d => `<div class="list-item" style="padding:9px 20px">${icon(d.icon, 'i-sm')}<span class="grow small bold ink">${esc(d.name)}</span><span class="xs muted">${esc(B().folders.find(f => f.key === d.folder_key)?.name || '')}</span><button class="btn btn-ghost btn-xs btn-icon" data-d="${d.id}">${icon('x', 'i-xs')}</button></div>`).join('')}</div></div></div>`
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
    const f = B().folders.find(x => x.id == b.dataset.f)
    const m = modal({ title: 'Editar carpeta', icon: 'folder', body: `<div class="field"><label>Nombre</label><input class="input" id="n" value="${esc(f.name)}"></div><div class="field mt-2"><label>Descripción</label><input class="input" id="d" value="${esc(f.description || '')}"></div>`, foot: `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">Guardar</button>` })
    m.$('#ok').onclick = async () => { try { await api.put(`admin/folders/${f.id}`, { name: m.$('#n').value, description: m.$('#d').value }); await reboot(); m.close(); rerender() } catch (e) { handleErr(e) } }
  })
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { if (await confirmDialog({ title: 'Eliminar tipo', message: 'Los documentos existentes conservan su clasificación.', danger: true, confirm: 'Eliminar' })) try { await api.del(`admin/doc-types/${b.dataset.d}`); await reboot(); rerender() } catch (e) { handleErr(e) } })
  el.querySelector('#add').onclick = () => {
    const m = modal({ title: 'Nuevo tipo de documento', icon: 'file-plus', body: `<div class="field"><label>Nombre</label><input class="input" id="n"></div><div class="field mt-2"><label>Carpeta</label><select class="select" id="f">${B().folders.map(f => `<option value="${f.key}">${esc(f.name)}</option>`).join('')}</select></div>`, foot: `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">Crear</button>` })
    m.$('#ok').onclick = async () => { try { await api.post('admin/doc-types', { name: m.$('#n').value, folder_key: m.$('#f').value }); await reboot(); m.close(); rerender() } catch (e) { handleErr(e) } }
  }
}

// ------------------------------------------------------------------ APARIENCIA
async function appearance(el) {
  const { settings: s } = await api.get('admin/settings')
  el.innerHTML = `<form class="stack" id="ap">
    <div class="card"><div class="card-head"><h3>${icon('palette', 'i-sm')} Identidad</h3></div><div class="card-body form-grid">
      <div class="field w-third"><label>Nombre de la aplicación</label><input class="input" name="app_name" value="${esc(s.app_name || '')}"></div>
      <div class="field w-third"><label>Grupo</label><input class="input" name="group_name" value="${esc(s.group_name || '')}"></div>
      <div class="field w-third row" style="gap:16px;align-items:flex-end"><div class="field"><label>Color principal</label><input type="color" class="color-input" name="primary_color" value="${esc(s.primary_color || '#00322B')}"></div><div class="field"><label>Color de acento</label><input type="color" class="color-input" name="accent_color" value="${esc(s.accent_color || '#6FA137')}"></div></div>
      <div class="field w-full"><label>Bajada</label><input class="input" name="tagline" value="${esc(s.tagline || '')}"></div></div></div>
    <div class="card"><div class="card-head"><h3>${icon('calendar-clock', 'i-sm')} Parámetros del régimen</h3></div><div class="card-body form-grid">
      <div class="field w-third"><label>Arranque operativo</label><input type="date" class="input" name="program_start" value="${esc(s.program_start || '')}"></div>
      <div class="field w-third"><label>Ventana RIMI desde</label><input type="date" class="input" name="rimi_window_start" value="${esc(s.rimi_window_start || '')}"><span class="help">Vigencia Ley 27.802</span></div>
      <div class="field w-third"><label>Ventana RIMI hasta</label><input type="date" class="input" name="rimi_window_end" value="${esc(s.rimi_window_end || '')}"><span class="help">2 años desde la reglamentación</span></div>
      <div class="field w-quarter"><label>Mínimo Micro (USD)</label><input type="number" class="input" name="threshold_micro" value="${esc(s.threshold_micro || '')}"></div>
      <div class="field w-quarter"><label>Mínimo Pequeña</label><input type="number" class="input" name="threshold_pequena" value="${esc(s.threshold_pequena || '')}"></div>
      <div class="field w-quarter"><label>Mínimo Mediana T1</label><input type="number" class="input" name="threshold_mediana1" value="${esc(s.threshold_mediana1 || '')}"></div>
      <div class="field w-quarter"><label>Mínimo Mediana T2</label><input type="number" class="input" name="threshold_mediana2" value="${esc(s.threshold_mediana2 || '')}"></div>
      <div class="field w-third"><label>Moneda por defecto</label><select class="select" name="default_currency">${['USD', 'ARS', 'EUR'].map(c => `<option ${c === s.default_currency ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div></div>
    <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" type="submit">${icon('save', 'i-sm')} Guardar configuración</button></div></form>`
  el.querySelector('#ap').onsubmit = async (e) => {
    e.preventDefault()
    const body = Object.fromEntries(new FormData(e.target).entries())
    try { await api.put('admin/settings', body); await reboot(); toast('Configuración guardada') } catch (err) { handleErr(err) }
  }
}

// ------------------------------------------------------------------ INTEGRACIONES
async function integrations(el) {
  const { settings: s, integrations: ig } = await api.get('admin/settings')
  el.innerHTML = `<div class="stack">
    <div class="card"><div class="card-head"><span class="ms-logo" style="display:grid;grid-template-columns:10px 10px;gap:2px"><span style="width:10px;height:10px;background:#F25022"></span><span style="width:10px;height:10px;background:#7FBA00"></span><span style="width:10px;height:10px;background:#00A4EF"></span><span style="width:10px;height:10px;background:#FFB900"></span></span>
      <div><h3>Inicio de sesión con Microsoft 365 (Entra ID)</h3><div class="sub">SSO con las credenciales corporativas del grupo. Protocolo OAuth 2.0 / OpenID Connect con PKCE.</div></div>
      <div class="right">${ig.microsoft.configured ? `<span class="badge green">${icon('circle-check', 'i-xs')} Configurado</span>` : `<span class="badge sun">${icon('clock', 'i-xs')} Pendiente</span>`}</div></div>
      <div class="card-body grid g-2" style="gap:24px">
        <div><h4 class="mb-2">Pasos en el portal de Azure</h4><ol class="steps-v">
          <li><b class="ink">Entra ID → App registrations → New registration</b><div class="small muted">Nombre: "RIMI Hub". Cuentas: <i>sólo este directorio organizativo</i> (single tenant).</div></li>
          <li><b class="ink">Redirect URI (Web)</b><div class="copy-field mt-1"><div class="uri-box" id="ru">${esc(ig.microsoft.redirect_uri)}</div><button class="btn btn-icon" id="cp" title="Copiar">${icon('copy', 'i-sm')}</button></div>${/localhost|sandbox|novita|e2b/.test(ig.microsoft.redirect_uri) ? '<div class="xs muted mt-1">Esta es la URL del entorno de prueba. En producción será <span class="mono">https://&lt;dominio-definitivo&gt;/auth/microsoft/callback</span>.</div>' : '<div class="xs muted mt-1">URL de producción configurada (APP_URL).</div>'}</li>
          <li><b class="ink">API permissions</b><div class="small muted">Microsoft Graph · Delegated: <span class="mono">openid, profile, email, User.Read</span> → Grant admin consent.</div></li>
          <li><b class="ink">Certificates & secrets → New client secret</b><div class="small muted">Copiá el <i>Value</i> (no el ID).</div></li>
          <li><b class="ink">Cargar como secretos del servidor</b><div class="code-box mt-1">npx wrangler pages secret put MS_TENANT_ID
npx wrangler pages secret put MS_CLIENT_ID
npx wrangler pages secret put MS_CLIENT_SECRET
npx wrangler pages secret put APP_URL</div><div class="xs muted mt-1">Los secretos nunca se exponen en el navegador ni se guardan en la base de datos.</div></li>
        </ol></div>
        <form id="msf"><h4 class="mb-2">Políticas de acceso</h4><div class="stack" style="gap:14px">
          <label class="row" style="gap:12px"><span class="switch"><input type="checkbox" name="ms_enabled" ${s.ms_enabled === '1' ? 'checked' : ''}><span></span></span><span><b class="ink small">Mostrar botón "Ingresar con Microsoft 365"</b></span></label>
          <label class="row" style="gap:12px"><span class="switch"><input type="checkbox" name="ms_auto_provision" ${s.ms_auto_provision === '1' ? 'checked' : ''}><span></span></span><span><b class="ink small">Alta automática en el primer ingreso</b><div class="xs muted">Se crea con el perfil elegido abajo, con acceso a la primera empresa, y se notifica al administrador para completar rol y empresas.</div></span></label>
          <div class="field"><label>Perfil por defecto del alta automática</label><select class="select" name="ms_default_profile">${(B().profiles || []).filter(p => p.key !== 'admin').map(p => `<option value="${esc(p.key)}" ${(s.ms_default_profile || 'viewer') === p.key ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select><span class="help">Recomendado: Sólo lectura, si preferís habilitar permisos manualmente después de revisar a cada persona.</span></div>
          <label class="row" style="gap:12px"><span class="switch"><input type="checkbox" name="local_login_enabled" ${s.local_login_enabled !== '0' ? 'checked' : ''}><span></span></span><span><b class="ink small">Permitir usuario y contraseña local</b><div class="xs muted">Útil para asesores externos sin cuenta corporativa.</div></span></label>
          <div class="field"><label>Dominios permitidos (separados por coma)</label><input class="input" name="ms_allowed_domains" value="${esc(s.ms_allowed_domains || '')}" placeholder="solfrut.com.ar, geneticaincari.com.ar, phronesis.com.ar" id="dom-in"><div class="dom-chips" id="dom-chips"></div><span class="help">Separá con comas. Vacío = cualquier cuenta del tenant.</span></div>
          <button class="btn btn-primary" type="submit">${icon('save', 'i-sm')} Guardar políticas</button></div></form>
      </div></div>
    <div class="card"><div class="card-head"><span class="file-ico tone-sky">${icon('cloud', 'i-sm')}</span><div><h3>Etapa 2 · Integraciones Azure / Microsoft 365</h3><div class="sub">Hoja de ruta sugerida · no requiere acción ahora</div></div><div class="right"><span class="badge sky">Próximamente</span></div></div>
      <div class="card-body grid g-3">${[['folder-sync', 'SharePoint / OneDrive', 'Sincronizar el legajo digital con la estructura Anexo II en una biblioteca de SharePoint vía Microsoft Graph.'], ['mail', 'Notificaciones por correo', 'Enviar avisos de tareas y vencimientos por Outlook (Graph sendMail) además de la campana del portal.'], ['message-square-share', 'Microsoft Teams', 'Publicar cambios de etapa y menciones en un canal de Teams por proyecto.'], ['users-round', 'Grupos de Entra ID', 'Mapear grupos de seguridad a perfiles (Admin, RIMI, Impuestos, Compras).'], ['server', 'Hosting en Azure', 'La API es estándar (Hono/Web APIs) y puede migrarse a Azure Functions / Container Apps con Azure SQL + Blob Storage.'], ['file-spreadsheet', 'ERP / SGI', 'Importación del reporte de imputaciones contables e IVA Compras para conciliación automática.']].map(([ic, t, d]) => `<div class="card card-pad"><span class="file-ico tone-green">${icon(ic, 'i-sm')}</span><div class="bold ink mt-2">${t}</div><p class="small muted mt-1">${d}</p></div>`).join('')}</div></div>
  </div>`
  const drawDom = () => { const v = el.querySelector('#dom-in').value.split(',').map(x => x.trim()).filter(Boolean); el.querySelector('#dom-chips').innerHTML = v.map(d => `<span class="mchip mchip-dom">${icon('globe', 'i-xs')} ${esc(d)}</span>`).join(''); paintIcons(el.querySelector('#dom-chips')) }
  el.querySelector('#dom-in').oninput = drawDom; drawDom()
  el.querySelector('#cp').onclick = () => { navigator.clipboard?.writeText(el.querySelector('#ru').textContent); toast('Copiado') }
  el.querySelector('#msf').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target
    try { await api.put('admin/settings', { ms_enabled: f.ms_enabled.checked ? '1' : '0', ms_auto_provision: f.ms_auto_provision.checked ? '1' : '0', local_login_enabled: f.local_login_enabled.checked ? '1' : '0', ms_allowed_domains: f.ms_allowed_domains.value, ms_default_profile: f.ms_default_profile.value }); toast('Políticas guardadas') } catch (err) { handleErr(err) }
  }
}

// ------------------------------------------------------------------ AUDITORÍA
async function audit(el) {
  const { activity } = await api.get('admin/audit')
  el.innerHTML = `<div class="card"><div class="card-head"><div><h3>Auditoría global</h3><div class="sub">Últimas 300 acciones en la plataforma, incluidos intentos de ingreso fallidos.</div></div></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th><th>Proyecto</th></tr></thead><tbody>
    ${activity.map(a => `<tr><td class="small nowrap">${fdatetime(a.created_at)}</td><td class="small">${a.user_name ? `<div class="row" style="gap:6px">${avatar(a.user_name, a.avatar_color, 'xs')}${esc(a.user_name)}</div>` : '<span class="muted">—</span>'}</td><td><span class="badge ${a.action === 'login_failed' ? 'rose' : ''}">${esc(a.action)}</span></td><td class="small">${esc(a.summary || '')}</td><td class="small">${a.project_id ? `<a href="#/projects/${a.project_id}">${esc(a.project_name || '#' + a.project_id)}</a>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`
}
