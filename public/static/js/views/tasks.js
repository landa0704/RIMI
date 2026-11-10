import { state, api, esc, icon, paintIcons, avatar, qs, setQS, TASK_STATUS, dueBadge, daysUntil, toast, handleErr, roleOf, B, canWrite, emptyState, isRimi, can } from '../lib.js'
import { renderTaskList, openTask, newTaskModal } from '../components/tasks.js'

export default async function (root) {
  const p = qs()
  let scope = p.get('view') || (can('tasks.manage') ? 'all' : 'mine')          // mine | created | all
  let layout = localStorage.getItem('rimi_task_layout') || 'board'
  let statusF = p.get('status') || ''
  let tasks = []

  root.innerHTML = `
  <div class="page-head"><div><div class="eyebrow">Seguimiento</div><h1>Tareas y responsabilidades</h1><p class="sub">Cuando una tarea está en cabeza de alguien queda el seguimiento: estado, plazo, conversación y notificaciones.</p></div>
    <div class="actions"><div class="seg" id="layout"><button data-l="board">${icon('kanban', 'i-sm')} Tablero</button><button data-l="list">${icon('list', 'i-sm')} Lista</button></div>${can('tasks.create') ? `<button class="btn btn-primary" id="new">${icon('plus', 'i-sm')} Nueva tarea</button>` : ''}</div></div>
  <div class="row row-wrap mb-3" style="gap:8px" id="scopes">
    <button class="chip" data-s="mine">${icon('user', 'i-xs')} Asignadas a mí <span class="n" id="c-mine"></span></button>
    <button class="chip" data-s="created">${icon('send', 'i-xs')} Creadas por mí</button>
    <button class="chip" data-s="all">${icon('users', 'i-xs')} Todo el equipo</button>
    <span style="width:1px;height:22px;background:var(--line);margin:0 4px"></span>
    <button class="chip" data-st="overdue">${icon('alarm-clock', 'i-xs')} Vencidas</button>
    <select class="select input-sm" id="role-f" style="width:auto"><option value="">Todos los roles</option>${B().roles.map(r => `<option value="${r.key}">${esc(r.name)}</option>`).join('')}</select>
  </div>
  <div id="tbody"></div>`
  paintIcons(root)

  const sync = () => {
    root.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('active', b.dataset.s === scope))
    root.querySelector('[data-st=overdue]').classList.toggle('active', statusF === 'overdue')
    root.querySelectorAll('[data-l]').forEach(b => b.classList.toggle('active', b.dataset.l === layout))
  }

  async function load() {
    const q = new URLSearchParams()
    if (scope === 'mine') q.set('assignee', 'me')
    if (scope === 'created') q.set('created', 'me')
    const role = root.querySelector('#role-f').value
    if (role) q.set('role', role)
    tasks = (await api.get('tasks?' + q)).tasks
    if (statusF === 'overdue') tasks = tasks.filter(t => t.status !== 'completada' && t.due_date && daysUntil(t.due_date) < 0)
    if (scope === 'mine') root.querySelector('#c-mine').textContent = tasks.filter(t => t.status !== 'completada').length
    draw()
  }

  function draw() {
    sync()
    const body = root.querySelector('#tbody')
    if (layout === 'list') {
      const groups = [
        ['Vencidas', tasks.filter(t => t.status !== 'completada' && t.due_date && daysUntil(t.due_date) < 0), 'alarm-clock', 'var(--rose-600)'],
        ['Próximos 7 días', tasks.filter(t => t.status !== 'completada' && t.due_date && daysUntil(t.due_date) >= 0 && daysUntil(t.due_date) <= 7), 'calendar-clock', 'var(--sun-600)'],
        ['Más adelante / sin fecha', tasks.filter(t => t.status !== 'completada' && (!t.due_date || daysUntil(t.due_date) > 7)), 'calendar', 'var(--muted)'],
        ['Completadas', tasks.filter(t => t.status === 'completada').slice(0, 30), 'circle-check', 'var(--brand-600)']
      ]
      body.innerHTML = groups.map(([l, ts, ic, c], i) => ts.length || i < 3 ? `<div class="card mb-3"><div class="card-head"><span style="color:${c}">${icon(ic, 'i-sm')}</span><h3>${l}</h3><span class="badge">${ts.length}</span></div><div data-g="${i}"></div></div>` : '').join('')
      groups.forEach(([, ts], i) => { const el = body.querySelector(`[data-g="${i}"]`); if (el) renderTaskList(el, ts, load, { emptyTitle: 'Nada por acá' }) })
      paintIcons(body)
      return
    }
    const cols = Object.entries(TASK_STATUS)
    body.innerHTML = `<div class="kanban kanban-tasks">${cols.map(([k, v]) => {
      const ts = tasks.filter(t => t.status === k).slice(0, k === 'completada' ? 25 : 200)
      return `<div class="k-col" style="--col:${v.color}"><div class="k-col-head"><span style="color:${v.color}">${icon(v.icon, 'i-sm')}</span>${v.label}<span class="n">${tasks.filter(t => t.status === k).length}</span></div>
        <div class="k-list" data-status="${k}">${ts.length ? '' : `<div class="drop-hint">${icon('inbox', 'i-sm')}<br>Sin tareas<br><span class="xs subtle">Arrastrá una tarjeta acá</span></div>`}${ts.map(t => `<div class="k-card" data-id="${t.id}"><div class="row" style="gap:8px;align-items:flex-start"><div class="t grow">${esc(t.title)}</div>${['critica', 'alta'].includes(t.priority) && k !== 'completada' ? `<span class="prio-tag ${t.priority}">${t.priority === 'critica' ? 'Crítica' : 'Alta'}</span>` : ''}</div>
          <div class="p">${icon('folder', 'i-xs')} <span>${esc(t.project_name || '')}</span>${t.inv_code ? `<span class="badge sun" style="height:18px;font-size:10.5px">${esc(t.inv_code)}</span>` : ''}</div>
          <div class="f">${t.assignee_name ? avatar(t.assignee_name, t.assignee_color, 'xs') : ''}<span class="xs muted grow" style="line-height:1.25">${esc(t.role_key ? roleOf(t.role_key).name : '')}</span>${t.msg_count ? `<span class="xs muted row" style="gap:3px">${icon('message-circle', 'i-xs')}${t.msg_count}</span>` : ''}${dueBadge(t.due_date, k === 'completada')}</div></div>`).join('')}</div></div>`
    }).join('')}</div>`
    paintIcons(body)
    body.querySelectorAll('.k-card').forEach(c => c.addEventListener('click', () => { if (!c.classList.contains('dragging')) openTask(Number(c.dataset.id), load) }))
    if (window.Sortable && canWrite()) body.querySelectorAll('.k-list').forEach(col => new Sortable(col, {
      group: 'tasks', animation: 160, ghostClass: 'sortable-ghost', filter: '.drop-hint',
      onStart: (e) => e.item.classList.add('dragging'),
      onEnd: async (e) => {
        setTimeout(() => e.item.classList.remove('dragging'), 50)
        e.to.querySelector('.drop-hint')?.remove()
        if (e.from === e.to) return
        try { await api.put(`tasks/${e.item.dataset.id}`, { status: e.to.dataset.status }); toast(`Tarea → ${TASK_STATUS[e.to.dataset.status].label}`); window.__refreshTaskCount?.(); load() }
        catch (err) { handleErr(err); load() }
      }
    }))
  }

  root.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { scope = b.dataset.s; setQS({ view: scope }); load() })
  root.querySelector('[data-st=overdue]').onclick = () => { statusF = statusF === 'overdue' ? '' : 'overdue'; setQS({ status: statusF }); load() }
  root.querySelector('#role-f').onchange = load
  root.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { layout = b.dataset.l; localStorage.setItem('rimi_task_layout', layout); draw() })
  root.querySelector('#new')?.addEventListener('click', async () => {
    const { projects } = await api.get(`projects?company_id=${state.company}`)
    if (!projects.length) return toast('Primero creá un proyecto', 'warn')
    newTaskModal({ projects }, load)
  })
  await load()
  const open = p.get('open')
  if (open) openTask(Number(open), () => { setQS({ open: null }); load() })
}
