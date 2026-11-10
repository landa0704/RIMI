import { state, api, esc, icon, paintIcons, avatar, toast, handleErr, popover, closePopover, closeAllModals, debounce, ago, roleOf, isAdmin, isRimi, can, profileOf, $, modal, B, daysUntil, fdate } from './lib.js'
import { renderLogin } from './views/login.js'

// Vistas cargadas bajo demanda
const routes = [
  { re: /^#\/?$/, view: () => import('./views/dashboard.js'), nav: 'dashboard' },
  { re: /^#\/explorer/, view: () => import('./views/explorer.js'), nav: 'explorer' },
  { re: /^#\/projects\/new/, view: () => import('./views/project-new.js'), nav: 'projects' },
  { re: /^#\/projects\/(\d+)/, view: () => import('./views/project.js'), nav: 'projects' },
  { re: /^#\/projects/, view: () => import('./views/projects.js'), nav: 'projects' },
  { re: /^#\/tasks/, view: () => import('./views/tasks.js'), nav: 'tasks' },
  { re: /^#\/chat/, view: () => import('./views/chat.js'), nav: 'chat' },
  { re: /^#\/calendar/, view: () => import('./views/calendar.js'), nav: 'calendar' },
  { re: /^#\/documents/, view: () => import('./views/documents.js'), nav: 'documents' },
  { re: /^#\/reports/, view: () => import('./views/reports.js'), nav: 'reports' },
  { re: /^#\/guide/, view: () => import('./views/guide.js'), nav: 'guide' },
  { re: /^#\/profile/, view: () => import('./views/profile.js'), nav: '' },
  { re: /^#\/admin/, view: () => import('./views/admin.js'), nav: 'admin' }
]

async function boot() {
  try {
    const me = await fetch('/api/auth/me', { credentials: 'same-origin' })
    if (!me.ok) { state.user = null; return route() }
    await loadBoot()
  } catch (e) { console.error(e) }
  route()
}

export async function loadBoot() {
  const b = await api.get('bootstrap')
  state.boot = b; state.user = b.user; state.unread = b.unread
  const saved = Number(localStorage.getItem('rimi_company'))
  state.company = b.companies.find(c => c.id === saved) ? saved : (b.companies[0]?.id || null)
  applyTheme()
}
window.__reloadBoot = async () => { await loadBoot(); renderShellChrome() }

function applyTheme() {
  const s = state.boot?.settings || {}
  if (s.primary_color) document.documentElement.style.setProperty('--brand-900', s.primary_color)
  if (s.accent_color) document.documentElement.style.setProperty('--brand-500', s.accent_color)
  document.title = `${s.app_name || 'RIMI Hub'} · ${s.group_name || 'Grupo Phronesis'}`
}

let shellMounted = false
let currentNav = ''
let pollTimer = null

async function route() {
  document.body.classList.toggle('admin-route', location.hash.startsWith('#/admin'))
  const hash = location.hash || '#/'
  closePopover()
  closeAllModals()
  if (hash.startsWith('#/login') || !state.user) {
    shellMounted = false
    if (pollTimer) clearInterval(pollTimer)
    if (state.user && hash.startsWith('#/login')) { location.hash = '#/'; return }
    return renderLogin($('#app'))
  }
  if (state.user.must_change_password && !hash.startsWith('#/profile')) { location.hash = '#/profile?force=1'; return }
  const r = routes.find(r => r.re.test(hash.split('?')[0])) || routes[0]
  if (!shellMounted) mountShell()
  currentNav = r.nav
  highlightNav()
  document.body.classList.toggle('hide-quick', /^#\/(projects|explorer)(\?|$|\/new)/.test(hash) || hash.startsWith('#/projects/new'))
  const view = $('#view')
  view.classList.remove('view'); void view.offsetWidth; view.classList.add('view')
  view.innerHTML = `<div class="row" style="justify-content:center;padding:80px"><div class="boot-mark" style="width:40px;height:40px;border-radius:12px"></div></div>`
  try {
    const mod = await r.view()
    const m = hash.split('?')[0].match(r.re)
    await mod.default(view, { params: m ? m.slice(1) : [] })
    paintIcons(view)
  } catch (e) {
    console.error(e)
    view.innerHTML = `<div class="card card-pad"><div class="empty"><div class="ill">${icon('circle-alert')}</div><h4>No se pudo cargar la vista</h4><p class="small">${esc(e.message)}</p><button class="btn mt-3" onclick="location.reload()">Reintentar</button></div></div>`
    paintIcons(view)
  }
  $('.sidebar')?.classList.remove('open'); $('.sb-backdrop')?.classList.remove('open')
  window.scrollTo({ top: 0 })
}

function navLink(key, href, ic, label, extra = '') {
  return `<a href="${href}" data-nav="${key}">${icon(ic)}<span>${label}</span>${extra}</a>`
}

function mountShell() {
  shellMounted = true
  $('#app').innerHTML = `
  <div class="app-shell">
    <aside class="sidebar" id="sidebar"></aside>
    <div class="sb-backdrop"></div>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-toggle" id="menu-toggle" aria-label="Menú">${icon('menu')}</button>
        <div class="search" id="global-search">
          ${icon('search')}
          <input id="search-input" placeholder="Buscar proyectos, inversiones, NCM, proveedores, documentos…" autocomplete="off" aria-label="Búsqueda global">
          <kbd>Ctrl K</kbd>
          <div class="search-results" id="search-results"></div>
        </div>
        <div class="topbar-actions">
          <a class="btn btn-accent btn-sm" href="#/projects/new" id="quick-new">${icon('plus', 'i-sm')} <span>Nuevo proyecto</span></a>
          <button class="icon-btn" id="notif-btn" aria-label="Notificaciones">${icon('bell')}<span class="dot hidden" id="notif-dot"></span></button>
          <button class="user-chip" id="user-btn"></button>
        </div>
      </header>
      <main id="view" class="view"></main>
    </div>
  </div>`
  renderShellChrome()
  $('#menu-toggle').onclick = () => { $('.sidebar').classList.toggle('open'); $('.sb-backdrop').classList.toggle('open') }
  $('.sb-backdrop').onclick = () => { $('.sidebar').classList.remove('open'); $('.sb-backdrop').classList.remove('open') }
  $('#notif-btn').onclick = openNotifications
  $('#user-btn').onclick = openUserMenu
  bindSearch()
  if (innerWidth < 720) $('#search-input').placeholder = 'Buscar…'
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(pollNotifications, 25000)
  paintIcons()
}

function renderShellChrome() {
  const b = state.boot, u = state.user
  const co = b.companies.find(c => c.id === state.company) || b.companies[0]
  const s = b.settings
  // Ventana temporal RIMI
  const ws = new Date(s.rimi_window_start + 'T12:00:00'), we = new Date(s.rimi_window_end + 'T12:00:00')
  const pct = Math.max(0, Math.min(100, (Date.now() - ws) / (we - ws) * 100))
  const left = daysUntil(s.rimi_window_end)
  const start = daysUntil(s.program_start)
  $('#sidebar').innerHTML = `
    <div class="sidebar-brand"><img src="/static/img/solfrut-logo-white.png" alt="Solfrut"><span class="brand-badge">RIMI</span></div>
    <button class="company-switch" id="company-switch">
      <span class="company-dot" style="background:${esc(co?.color || '#4F8226')}">${esc(co?.short_code || co?.name?.slice(0, 2) || '—')}</span>
      <span class="grow"><div class="lbl">${esc(s.group_name || 'Grupo')}</div><div class="val truncate">${esc(co?.name || 'Sin empresa')}</div></span>
      ${icon('chevrons-up-down', 'i-sm')}
    </button>
    <nav class="nav">
      ${navLink('dashboard', '#/', 'layout-dashboard', 'Panel general')}
      ${navLink('explorer', '#/explorer', 'map', 'Zonas y fincas')}
      ${navLink('projects', '#/projects', 'folder-kanban', 'Proyectos')}
      <div class="nav-section">Colaboración</div>
      ${navLink('tasks', '#/tasks', 'list-checks', 'Mis tareas', '<span class="count" id="nav-tasks"></span>')}
      ${navLink('chat', '#/chat', 'messages-square', 'Conversaciones')}
      ${navLink('calendar', '#/calendar', 'calendar-days', 'Agenda y plazos')}
      ${navLink('documents', '#/documents', 'folder-open', 'Legajo digital')}
      <div class="nav-section">Control</div>
      ${navLink('reports', '#/reports', 'chart-column-big', 'Reportes y tablero')}
      ${navLink('guide', '#/guide', 'book-open-text', 'Procedimiento')}
      ${isAdmin() ? navLink('admin', '#/admin', 'settings-2', 'Administración') : ''}
    </nav>
    <div class="sidebar-foot">
      <div class="window-card">
        <div class="row between"><span>Ventana RIMI</span><b>${left > 0 ? left + ' días' : 'Cerrada'}</b></div>
        <div class="window-bar"><span style="width:${pct}%"></span></div>
        <div class="row between xs" style="color:#8FB0A2"><span>${fdate(s.rimi_window_start)}</span><span>${fdate(s.rimi_window_end)}</span></div>
        ${start > 0 ? `<div class="xs mt-1" style="color:#B9DB8E;font-weight:700">${icon('rocket', 'i-xs')} Arranque operativo en ${start} días</div>` : ''}
      </div>
    </div>`
  $('#user-btn').innerHTML = `${avatar(u.name, u.avatar_color, 'sm')}<span><div class="n">${esc(u.name)}</div><div class="r">${esc(roleOf(u.functional_role).name !== '—' ? roleOf(u.functional_role).name : profileOf(u.system_role).name)}</div></span>${icon('chevron-down', 'i-sm')}`
  $('#company-switch').onclick = (e) => openCompanyMenu(e.currentTarget)
  updateBadge()
  highlightNav()
  paintIcons($('#sidebar')); paintIcons($('#user-btn'))
  if (!can('projects.create')) $('#quick-new')?.classList.add('hidden')
  refreshTaskCount()
}

async function refreshTaskCount() {
  try {
    const { tasks } = await api.get('tasks?assignee=me&status=open')
    const el = $('#nav-tasks'); if (!el) return
    const over = tasks.filter(t => t.due_date && daysUntil(t.due_date) < 0).length
    el.textContent = tasks.length || ''
    el.classList.toggle('alert', over > 0)
    el.style.display = tasks.length ? '' : 'none'
  } catch { }
}
window.__refreshTaskCount = refreshTaskCount

function highlightNav() {
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.nav === currentNav))
}

function openCompanyMenu(anchor) {
  const b = state.boot
  popover(anchor, `<div class="menu">
    <div class="xs bold muted" style="padding:8px 10px;text-transform:uppercase;letter-spacing:.1em">Empresas del grupo</div>
    ${b.companies.map(c => `<button class="menu-item" data-co="${c.id}"><span class="company-dot" style="width:26px;height:26px;border-radius:8px;font-size:10px;background:${esc(c.color)}">${esc(c.short_code || c.name.slice(0, 2))}</span><span class="grow">${esc(c.name)}${!c.active ? ' <span class="badge">Inactiva</span>' : ''}</span>${c.id === state.company ? icon('check', 'i-sm') : ''}</button>`).join('')}
    ${isAdmin() ? `<div class="menu-sep"></div><a class="menu-item" href="#/admin/companies">${icon('building-2', 'i-sm')} Gestionar empresas</a>` : ''}
  </div>`, { align: 'left', width: 260, onMount: (el) => {
    el.querySelectorAll('[data-co]').forEach(btn => btn.onclick = () => {
      state.company = Number(btn.dataset.co); localStorage.setItem('rimi_company', state.company)
      closePopover(); renderShellChrome(); route()
      toast(`Empresa activa: ${b.companies.find(c => c.id === state.company).name}`)
    })
  } })
}

function openUserMenu() {
  const u = state.user
  popover($('#user-btn'), `<div class="menu" style="min-width:260px">
    <div class="row" style="padding:10px 10px 12px">${avatar(u.name, u.avatar_color, 'lg')}<div class="grow"><div class="bold ink">${esc(u.name)}</div><div class="xs muted truncate">${esc(u.email)}</div><div class="mt-1"><span class="badge ${u.system_role === 'admin' ? 'dark' : 'green'}">${esc(profileOf(u.system_role).name)}</span></div></div></div>
    <div class="menu-sep"></div>
    <a class="menu-item" href="#/profile">${icon('user-round-cog', 'i-sm')} Mi perfil y contraseña</a>
    <a class="menu-item" href="#/tasks">${icon('list-checks', 'i-sm')} Mis tareas</a>
    <a class="menu-item" href="#/guide">${icon('book-open-text', 'i-sm')} Guía del procedimiento</a>${B().user?.system_role === 'admin' ? `<a class="menu-item" href="/static/manual" target="_blank">${icon('book-key', 'i-sm')} Manual del administrador</a>` : ''}
    ${isAdmin() ? `<a class="menu-item" href="#/admin">${icon('settings-2', 'i-sm')} Administración</a>` : ''}
    <div class="menu-sep"></div>
    <button class="menu-item danger" id="logout">${icon('log-out', 'i-sm')} Cerrar sesión</button>
  </div>`, { onMount: (el) => {
    el.querySelectorAll('a').forEach(a => a.addEventListener('click', closePopover))
    el.querySelector('#logout').onclick = async () => { await api.post('/api/auth/logout'); state.user = null; state.boot = null; closePopover(); location.hash = '#/login' }
  } })
}

// ------------------------------------------------------------------ notificaciones
const NOTIF_ICON = { task: ['list-checks', 'tone-sky'], message: ['message-circle', 'tone-green'], mention: ['at-sign', 'tone-violet'], stage: ['git-commit-horizontal', 'tone-sun'], document: ['file-up', 'tone-orange'], project: ['folder-plus', 'tone-green'], member: ['user-plus', 'tone-sky'], user: ['user-round-plus', 'tone-violet'], info: ['info', 'tone-dark'] }

function updateBadge() {
  const d = $('#notif-dot'); if (!d) return
  d.textContent = state.unread > 9 ? '9+' : state.unread
  d.classList.toggle('hidden', !state.unread)
}

let lastNotif = 0
async function pollNotifications() {
  if (!state.user || document.hidden) return
  try {
    const r = await api.get('notifications/count')
    if (r.last > lastNotif && lastNotif && r.unread > state.unread) toast('Tenés notificaciones nuevas')
    lastNotif = r.last; state.unread = r.unread; updateBadge()
  } catch { }
}

async function openNotifications() {
  const el = popover($('#notif-btn'), `<div class="notif-panel"><div class="card-head"><h3>Notificaciones</h3><div class="right"><button class="btn btn-ghost btn-xs" id="mark-all">${icon('check-check', 'i-xs')} Marcar todo leído</button></div></div><div id="notif-list" style="overflow:auto;flex:1"><div class="empty small">Cargando…</div></div></div>`, { width: 400 })
  try {
    const { notifications, unread } = await api.get('notifications')
    state.unread = unread; updateBadge()
    const list = el.querySelector('#notif-list')
    list.innerHTML = notifications.length ? notifications.map(n => {
      const [ic, tone] = NOTIF_ICON[n.type] || NOTIF_ICON.info
      return `<div class="notif-item ${n.read_at ? '' : 'unread'}" data-id="${n.id}" data-link="${esc(n.link || '')}"><span class="notif-ico ${tone}">${icon(ic, 'i-sm')}</span><div class="grow"><div class="bold ink small">${esc(n.title)}</div>${n.body ? `<div class="xs muted" style="margin-top:2px">${esc(n.body)}</div>` : ''}<div class="xs subtle mt-1">${n.actor_name ? esc(n.actor_name) + ' · ' : ''}${ago(n.created_at)}</div></div></div>`
    }).join('') : `<div class="empty"><div class="ill">${icon('bell-off')}</div><h4>Todo al día</h4><p class="small">No tenés notificaciones.</p></div>`
    paintIcons(list)
    list.querySelectorAll('.notif-item').forEach(it => it.onclick = async () => {
      api.post('notifications/read', { id: Number(it.dataset.id) }).catch(() => { })
      if (!it.classList.contains('read') && it.classList.contains('unread')) { state.unread = Math.max(0, state.unread - 1); updateBadge() }
      closePopover()
      if (it.dataset.link) location.hash = it.dataset.link
    })
    el.querySelector('#mark-all').onclick = async () => { await api.post('notifications/read', {}); state.unread = 0; updateBadge(); list.querySelectorAll('.unread').forEach(x => x.classList.remove('unread')) }
  } catch (e) { handleErr(e) }
}

// ------------------------------------------------------------------ búsqueda
function bindSearch() {
  const input = $('#search-input'), box = $('#search-results')
  let items = [], hl = -1
  const render = () => {
    box.innerHTML = items.length ? items.map((r, i) => `<a class="sr-item ${i === hl ? 'hl' : ''}" href="${r.link}"><span class="file-ico tone-green" style="width:32px;height:32px;border-radius:9px">${icon(r.icon, 'i-sm')}</span><span class="grow"><div class="t truncate">${esc(r.title)}</div><div class="s truncate">${esc({ project: 'Proyecto', investment: 'Inversión', document: 'Documento', zone: 'Zona' }[r.type])} · ${esc(r.sub || '')}</div></span></a>`).join('')
      : `<div class="empty small" style="padding:20px">Sin resultados para “${esc(input.value)}”</div>`
    box.classList.add('open'); paintIcons(box)
    box.querySelectorAll('a').forEach(a => a.onclick = () => { box.classList.remove('open'); input.value = '' })
  }
  const run = debounce(async () => {
    const q = input.value.trim()
    if (q.length < 2) { box.classList.remove('open'); return }
    try { items = (await api.get('search?q=' + encodeURIComponent(q))).results; hl = -1; render() } catch { }
  }, 220)
  input.addEventListener('input', run)
  input.addEventListener('keydown', (e) => {
    if (!box.classList.contains('open')) return
    if (e.key === 'ArrowDown') { hl = Math.min(items.length - 1, hl + 1); render(); e.preventDefault() }
    if (e.key === 'ArrowUp') { hl = Math.max(0, hl - 1); render(); e.preventDefault() }
    if (e.key === 'Enter' && items[hl >= 0 ? hl : 0]) { location.hash = items[hl >= 0 ? hl : 0].link; box.classList.remove('open'); input.value = ''; input.blur() }
    if (e.key === 'Escape') { box.classList.remove('open'); input.blur() }
  })
  document.addEventListener('mousedown', (e) => { if (!$('#global-search')?.contains(e.target)) box.classList.remove('open') })
}
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#search-input')?.focus() }
})

window.addEventListener('hashchange', route)
export { route }
boot()
