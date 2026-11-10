import { state, api, esc, icon, paintIcons, avatar, modal, toast, handleErr, B, roleOf, TASK_STATUS, PRIORITY, dueBadge, fdatetime, isRimi, can, confirmDialog, emptyState, canWrite } from '../lib.js'
import { mountChat } from './chat.js'

export function taskRow(t, { showProject = true } = {}) {
  const st = TASK_STATUS[t.status] || TASK_STATUS.pendiente
  const done = t.status === 'completada'
  return `<div class="list-item clickable" data-task="${t.id}">
    <button class="btn btn-ghost btn-xs btn-icon" data-toggle="${t.id}" title="${done ? 'Reabrir' : 'Marcar completada'}" style="color:${st.color}">${icon(done ? 'circle-check-big' : st.icon, 'i-sm')}</button>
    <div class="grow" style="min-width:0">
      <div class="t truncate" style="${done ? 'text-decoration:line-through;color:var(--subtle)' : ''}">${esc(t.title)}</div>
      <div class="s row row-wrap" style="gap:8px;margin-top:2px">
        ${showProject ? `<span class="row" style="gap:4px">${icon('folder', 'i-xs')} ${esc(t.project_name || '')}</span>` : ''}
        ${t.inv_code ? `<span class="badge sun" style="height:19px">${esc(t.inv_code)}</span>` : ''}
        ${t.procedure_ref ? `<span class="row" style="gap:4px">${icon('book-open', 'i-xs')} ${esc(t.procedure_ref)}</span>` : ''}
        ${t.role_key ? `<span>${esc(roleOf(t.role_key).name)}</span>` : ''}
        ${t.msg_count ? `<span class="row" style="gap:3px">${icon('message-circle', 'i-xs')} ${t.msg_count}</span>` : ''}
      </div>
    </div>
    <span class="prio ${t.priority}" title="Prioridad ${PRIORITY[t.priority]}"></span>
    ${t.status === 'bloqueada' ? '<span class="badge rose">Bloqueada</span>' : t.status === 'en_curso' ? '<span class="badge sky">En curso</span>' : ''}
    ${dueBadge(t.due_date, done)}
    ${t.assignee_name ? avatar(t.assignee_name, t.assignee_color, 'sm') : `<span class="avatar sm" style="background:var(--line)" title="Sin asignar">${icon('user', 'i-xs')}</span>`}
  </div>`
}

export function bindTaskRows(root, reload) {
  root.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async (e) => {
    e.stopPropagation()
    const row = b.closest('[data-task]')
    const done = row.querySelector('.t').style.textDecoration.includes('line-through')
    try { await api.put(`tasks/${b.dataset.toggle}`, { status: done ? 'pendiente' : 'completada' }); toast(done ? 'Tarea reabierta' : 'Tarea completada'); window.__refreshTaskCount?.(); reload() } catch (err) { handleErr(err) }
  }))
  root.querySelectorAll('[data-task]').forEach(r => r.addEventListener('click', () => openTask(Number(r.dataset.task), reload)))
}

export async function openTask(id, onChange) {
  let t
  try { t = (await api.get(`tasks/${id}`)).task } catch (e) { return handleErr(e) }
  const canEdit = can('tasks.manage') || t.created_by === state.user.id || t.assignee_id === state.user.id || t.project_responsible_id === state.user.id
  const canAll = can('tasks.manage') || t.created_by === state.user.id || t.project_responsible_id === state.user.id
  let chat
  const m = modal({
    drawer: true, size: 'md', icon: 'list-checks', tone: 'tone-sky', title: esc(t.title),
    subtitle: `<a href="#/projects/${t.project_id}">${esc(t.project_name)}</a>${t.inv_code ? ` · ${esc(t.inv_code)} ${esc(t.inv_description || '')}` : ''}`,
    body: `<div style="padding:20px 24px;border-bottom:1px solid var(--line-2)">
      <div class="seg mb-3" id="st-seg">${Object.entries(TASK_STATUS).map(([k, v]) => `<button data-st="${k}" class="${t.status === k ? 'active' : ''}" ${canEdit ? '' : 'disabled'}>${icon(v.icon, 'i-xs')} ${v.label}</button>`).join('')}</div>
      <div class="form-grid">
        <div class="field w-half"><label>Asignado a</label><select class="select" id="t-ass" ${canAll ? '' : 'disabled'}><option value="">Sin asignar</option>${B().users.filter(u => u.active).map(u => `<option value="${u.id}" ${u.id == t.assignee_id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>
        <div class="field w-quarter"><label>Vence</label><input type="date" class="input" id="t-due" value="${esc(t.due_date || '')}" ${canAll ? '' : 'disabled'}></div>
        <div class="field w-quarter"><label>Prioridad</label><select class="select" id="t-pri" ${canAll ? '' : 'disabled'}>${Object.entries(PRIORITY).map(([k, v]) => `<option value="${k}" ${k === t.priority ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field w-full"><label>Descripción</label><textarea class="textarea" id="t-desc" ${canAll ? '' : 'disabled'} style="min-height:70px">${esc(t.description || '')}</textarea></div>
      </div>
      <div class="row row-wrap xs muted mt-2" style="gap:14px">
        ${t.procedure_ref ? `<span class="row" style="gap:4px">${icon('book-open', 'i-xs')} Procedimiento ${esc(t.procedure_ref)}</span>` : ''}
        ${t.role_key ? `<span class="row" style="gap:4px">${icon('user-cog', 'i-xs')} Rol: ${esc(roleOf(t.role_key).name)}</span>` : ''}
        ${t.auto ? `<span class="badge violet">${icon('sparkles', 'i-xs')} Generada por el flujo</span>` : ''}
        <span>Creada por ${esc(t.creator_name || 'Sistema')} · ${fdatetime(t.created_at)}</span>
        ${t.completed_at ? `<span class="badge green">Completada ${fdatetime(t.completed_at)}</span>` : ''}
      </div>
    </div>
    <div style="padding:14px 24px 0" class="row between"><h4>${icon('messages-square', 'i-sm')} Seguimiento y conversación</h4></div>
    <div id="task-chat" style="height:calc(100vh - 470px);min-height:300px"></div>`,
    foot: `${can('tasks.manage') || t.created_by === state.user.id || t.project_responsible_id === state.user.id ? `<button class="btn btn-danger btn-sm" id="t-del">${icon('trash-2', 'i-sm')} Eliminar</button>` : ''}<span class="grow"></span><button class="btn" data-close>Cerrar</button>${canAll ? `<button class="btn btn-primary" id="t-save">${icon('save', 'i-sm')} Guardar cambios</button>` : ''}`,
    onClose: () => { chat?.destroy(); onChange && onChange() }
  })
  chat = mountChat(m.$('#task-chat'), { project_id: t.project_id, task_id: t.id }, { placeholder: 'Comentá avances, bloqueos o pedí información…' })
  m.$$('[data-st]').forEach(b => b.onclick = async () => {
    try { await api.put(`tasks/${t.id}`, { status: b.dataset.st }); t.status = b.dataset.st; m.$$('[data-st]').forEach(x => x.classList.toggle('active', x === b)); chat.reload(); toast(`Estado: ${TASK_STATUS[b.dataset.st].label}`); window.__refreshTaskCount?.() } catch (e) { handleErr(e) }
  })
  m.$('#t-save')?.addEventListener('click', async () => {
    try {
      await api.put(`tasks/${t.id}`, { assignee_id: Number(m.$('#t-ass').value) || null, due_date: m.$('#t-due').value || null, priority: m.$('#t-pri').value, description: m.$('#t-desc').value })
      toast('Tarea actualizada'); m.close()
    } catch (e) { handleErr(e) }
  })
  m.$('#t-del')?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Eliminar tarea', message: 'Se eliminará la tarea y su conversación.', confirm: 'Eliminar', danger: true }))) return
    try { await api.del(`tasks/${t.id}`); toast('Tarea eliminada'); m.close() } catch (e) { handleErr(e) }
  })
}

export function newTaskModal({ project_id = null, investment_id = null, projects = null, investments = [] } = {}, onDone) {
  const m = modal({
    title: 'Nueva tarea', icon: 'list-plus', tone: 'tone-sky', subtitle: 'Asigná una responsabilidad con fecha límite. El asignado recibe una notificación.',
    body: `<div class="form-grid">
      <div class="field w-full"><label>Título <span class="req">*</span></label><input class="input" id="nt-title" placeholder="Ej. Pedir factura desagregada al proveedor"></div>
      ${projects ? `<div class="field w-full"><label>Proyecto <span class="req">*</span></label><select class="select" id="nt-proj">${projects.map(p => `<option value="${p.id}">${esc(p.code || '')} · ${esc(p.name)}</option>`).join('')}</select></div>` : ''}
      ${investments.length ? `<div class="field w-full"><label>Inversión (opcional)</label><select class="select" id="nt-inv"><option value="">Proyecto completo</option>${investments.map(i => `<option value="${i.id}" ${i.id == investment_id ? 'selected' : ''}>${esc(i.code)} · ${esc(i.description)}</option>`).join('')}</select></div>` : ''}
      <div class="field w-half"><label>Rol responsable</label><select class="select" id="nt-role"><option value="">—</option>${B().roles.map(r => `<option value="${r.key}">${esc(r.name)}</option>`).join('')}</select></div>
      <div class="field w-half"><label>Asignar a</label><select class="select" id="nt-ass"><option value="">Sin asignar</option>${B().users.filter(u => u.active).map(u => `<option value="${u.id}" data-role="${u.functional_role || ''}">${esc(u.name)}</option>`).join('')}</select></div>
      <div class="field w-half"><label>Fecha límite</label><input type="date" class="input" id="nt-due"></div>
      <div class="field w-half"><label>Prioridad</label><select class="select" id="nt-pri">${Object.entries(PRIORITY).map(([k, v]) => `<option value="${k}" ${k === 'media' ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field w-full"><label>Descripción</label><textarea class="textarea" id="nt-desc"></textarea></div>
    </div>`,
    foot: `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="nt-save">${icon('plus', 'i-sm')} Crear tarea</button>`
  })
  m.$('#nt-role').onchange = (e) => {
    const opt = [...m.$('#nt-ass').options].find(o => o.dataset.role === e.target.value)
    if (opt && !m.$('#nt-ass').value) m.$('#nt-ass').value = opt.value
  }
  m.$('#nt-save').onclick = async () => {
    const title = m.$('#nt-title').value.trim()
    if (!title) { m.$('#nt-title').classList.add('invalid'); return toast('El título es obligatorio', 'warn') }
    try {
      await api.post('tasks', {
        project_id: projects ? Number(m.$('#nt-proj').value) : project_id, investment_id: m.$('#nt-inv') ? Number(m.$('#nt-inv').value) || null : investment_id,
        title, description: m.$('#nt-desc').value, assignee_id: Number(m.$('#nt-ass').value) || null, role_key: m.$('#nt-role').value || null,
        due_date: m.$('#nt-due').value || null, priority: m.$('#nt-pri').value
      })
      toast('Tarea creada'); m.close(); window.__refreshTaskCount?.(); onDone && onDone()
    } catch (e) { handleErr(e) }
  }
}

export function renderTaskList(container, tasks, reload, opts = {}) {
  container.innerHTML = tasks.length ? `<div class="list">${tasks.map(t => taskRow(t, opts)).join('')}</div>` : emptyState('list-checks', opts.emptyTitle || 'Sin tareas', opts.emptyText || '')
  paintIcons(container)
  bindTaskRows(container, reload)
}
