import {
  state, api, esc, icon, paintIcons, money, num, avatar, ago, fdate, fdatetime, stagesFor, stageOf, stagePill, typeOf, typeIcon, roleOf, eligBadge,
  qs, setQS, B, modal, toast, handleErr, isRimi, isAdmin, canWrite, canFiscal, can, isOwner, confirmDialog, emptyState, hexA, ringSVG, daysUntil,
  sectionsFor, fieldsFor, renderField, readForm, validateForm, bindNcmMask, projectValue, downloadBlob, toCSV, ensureXLSX
} from '../lib.js'
import { mountChat } from '../components/chat.js'
import { renderTaskList, newTaskModal } from '../components/tasks.js'
import { uploadModal, docTable, bindDocTable } from '../components/documents.js'
import { moveStage } from './projects.js'
import { duplicateProjectModal } from './project-new.js'
import { openInvestment, investmentForm } from '../components/investment.js'

const TABS = [
  ['overview', 'Resumen', 'layout-dashboard'], ['ficha', 'Ficha · Anexo I', 'notebook-pen'], ['investments', 'Inversiones', 'boxes'],
  ['tasks', 'Tareas', 'list-checks'], ['chat', 'Conversación', 'messages-square'], ['docs', 'Legajo digital', 'folder-open'],
  ['checklist', 'Checklist', 'clipboard-check'], ['team', 'Equipo', 'users'], ['history', 'Historial', 'history']
]

const isInactive = (p) => p?.status === 'inactivo'
const mayEdit = (p) => !isInactive(p) && (can('projects.edit') || isOwner(p))
const mayInv = (p) => !isInactive(p) && (can('investments.edit') || isOwner(p))
const eligDot = (e) => { const c = { 'General elegible': 'var(--brand-600)', 'Específica elegible': 'var(--sky-600, #0A6FA6)', 'No elegible': 'var(--rose-600)' }[e] || 'var(--sun-600, #B7791F)'; return `<span class="elig-dot"><i style="background:${c}"></i>${esc(e || 'Sin dictamen')}</span>` }
export default async function (root, { params }) {
  const id = Number(params[0])
  let data, tab = qs().get('tab') || 'overview', chat = null

  async function load() { data = await api.get(`projects/${id}`) }
  await load()

  function render() {
    const p = data.project
    const stages = stagesFor()
    const cur = stageOf(p.stage_key)
    const t = typeOf(p.type_id)
    const total = data.investments.reduce((a, i) => a + (i.total || 0), 0)
    const days = Math.floor((Date.now() - new Date(String(p.stage_changed_at).replace(' ', 'T') + 'Z')) / 86400000)
    const slaWarn = cur.sla_days && days > cur.sla_days * 1.4
    const counts = { investments: data.investments.length, tasks: p.open_tasks, docs: p.doc_count, team: data.members.length, checklist: `${p.chk_done}/${p.chk_total}` }

    root.innerHTML = `
    <div class="crumbs"><a href="#/projects">Proyectos</a>${icon('chevron-right')}<a href="#/explorer?zone=${p.zone_id}">${esc(p.zone_name || 'Zona')}</a>${p.farm_name ? `${icon('chevron-right')}<a href="#/explorer?zone=${p.zone_id}&farm=${p.farm_id}">${esc(p.farm_name)}</a>` : ''}${icon('chevron-right')}<span>${esc(p.code || '')}</span></div>
    <header class="card" style="padding:22px 24px;margin-bottom:18px;overflow:hidden;position:relative">
      <div style="position:absolute;right:-80px;top:-120px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle, ${hexA(t.color, .14)}, transparent 70%)"></div>
      <div class="row" style="align-items:flex-start;gap:16px;position:relative;flex-wrap:wrap">
        <span class="ph-ico">${typeIcon(p, 56)}</span>
        <div class="grow" style="min-width:260px">
          <div class="row row-wrap" style="gap:8px"><span class="mono xs muted">${esc(p.code || '')}</span>${isInactive(p) ? `<span class="badge rose" title="Proyecto inactivo: sólo lectura">${icon('pause-circle', 'i-xs')} Inactivo</span>` : `<span class="badge green">${icon('circle-check', 'i-xs')} Activo</span>`}${stagePill(p.stage_key)}${p.dictamen ? eligBadge(p.dictamen) : ''}</div>
          <h1 style="margin-top:6px">${esc(p.name)}</h1>
          <div class="row row-wrap small muted mt-1" style="gap:16px"><span class="row" style="gap:5px">${icon('building-2', 'i-xs')} ${esc(p.company_name)}</span><span class="row" style="gap:5px">${icon('map-pin', 'i-xs')} ${esc(p.zone_name || '—')}</span>${p.farm_name ? `<span class="row" style="gap:5px">${icon('trees', 'i-xs')} ${esc(p.farm_name)}</span>` : ''}<span class="row" style="gap:5px">${icon('tag', 'i-xs')} ${esc(t.name)}${t.min_exempt ? ' <span class="badge green" style="margin-left:4px">Sin monto mínimo</span>' : ''}</span><span class="row" style="gap:5px">${icon('user-check', 'i-xs')} ${esc(p.responsible_name || 'Sin responsable')}</span></div>
        </div>
        <div class="row proj-head-stats" style="gap:22px;align-items:flex-start">
          <div><div class="xs muted bold" style="text-transform:uppercase;letter-spacing:.08em">Presupuesto</div><div style="font-size:24px;font-weight:800;color:var(--ink);letter-spacing:-.02em">${money(p.budget || total, p.currency)}</div><div class="xs muted">${data.investments.length} componentes</div></div>
          <div><div class="xs muted bold" style="text-transform:uppercase;letter-spacing:.08em">Puesta en marcha</div><div style="font-size:18px;font-weight:800;color:var(--ink);margin-top:3px">${fdate(p.startup_est_date)}</div><div class="xs muted">${p.startup_est_date ? (daysUntil(p.startup_est_date) >= 0 ? `en ${daysUntil(p.startup_est_date)} días` : 'fecha superada') : 'sin definir'}</div></div>
          <div class="row" style="gap:6px">
            ${!isInactive(p) && (can('projects.stage') || isOwner(p) || (cur.role_key && cur.role_key === state.user.functional_role)) ? `<button class="btn btn-accent" id="advance">${icon('arrow-right-circle', 'i-sm')} Avanzar etapa</button>` : ''}
            <button class="btn btn-icon" id="more" aria-label="Más acciones">${icon('ellipsis-vertical')}</button>
          </div>
        </div>
      </div>
      <div class="pipe-mobile mt-3"><div class="row between small"><b class="ink">${esc(cur.name)}</b><span class="muted">Etapa ${stages.findIndex(s => s.key === p.stage_key) + 1} de ${stages.length}</span></div><div class="progress mt-1"><span style="width:${(stages.findIndex(s => s.key === p.stage_key) + 1) / stages.length * 100}%"></span></div></div>
      <div class="pipeline mt-3" id="pipeline">${stages.map(s => {
        const cls = s.key === p.stage_key ? 'current' : s.sort < cur.sort ? 'done' : ''
        return `<div class="pipe-step ${cls} ${isRimi() ? 'clickable' : ''}" data-stage="${s.key}" title="${esc(s.description || '')}"><div class="ph">${esc(s.phase || '')}</div><div class="nm">${icon(cls === 'done' ? 'check' : s.icon, 'i-xs')} ${esc(s.short_name || s.name)}</div></div>`
      }).join('')}</div>
      <div class="row row-wrap xs muted mt-2" style="gap:14px"><span>${icon('clock', 'i-xs')} En "${esc(cur.name)}" desde hace <b class="${slaWarn ? '' : 'ink'}" style="${slaWarn ? 'color:var(--rose-600)' : ''}">${days} días</b>${cur.sla_days ? ` · plazo de referencia ${cur.sla_days} días hábiles` : ''}</span>${cur.role_key ? `<span>${icon('user-cog', 'i-xs')} Responsable de etapa: <b class="ink">${esc(roleOf(cur.role_key).name)}</b></span>` : ''}</div>
    </header>
    ${isInactive(p) ? `<div class="alert warn mb-3" id="inactive-banner">${icon('pause-circle', 'i-sm')}<span><b>Proyecto inactivo.</b> Está en sólo lectura: no se pueden editar la ficha, los componentes, las etapas, las tareas, la conversación ni los documentos. ${can('projects.status') ? 'Reactivalo desde el menú "Más acciones".' : 'Pedí a un administrador que lo reactive.'}</span></div>` : ''}
    <nav class="tabs" id="tabs">${TABS.map(([k, l, ic]) => `<button class="tab ${tab === k ? 'active' : ''}" data-tab="${k}">${icon(ic, 'i-sm')} ${l}${counts[k] !== undefined ? ` <span class="n">${counts[k]}</span>` : ''}</button>`).join('')}</nav>
    <section id="tab-body"></section>`
    paintIcons(root)
    root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; setQS({ tab, inv: null }); render() })
    root.querySelector('#advance')?.addEventListener('click', advance)
    root.querySelector('#more').onclick = (e) => moreMenu(e.currentTarget)
    if (isRimi()) root.querySelectorAll('.pipe-step').forEach(s => s.onclick = async () => {
      if (s.dataset.stage === p.stage_key) return
      if (!(await confirmDialog({ title: 'Cambiar etapa', message: `¿Mover el proyecto a <b>${esc(stageOf(s.dataset.stage).name)}</b>? Se generarán las tareas automáticas de esa etapa.`, confirm: 'Mover' }))) return
      try { await moveStage(id, s.dataset.stage); await load(); render() } catch { }
    })
    chat?.destroy(); chat = null
    renderTab()
  }

  async function advance() {
    const stages = stagesFor(); const cur = stageOf(data.project.stage_key)
    const next = stages.find(s => s.sort > cur.sort)
    if (!next) return toast('El proyecto ya está en la etapa final', 'warn')
    const m = modal({
      title: `Avanzar a "${esc(next.name)}"`, icon: next.icon, subtitle: esc(next.description || ''),
      body: `<div class="alert info mb-3">${icon('sparkles', 'i-sm')}<span>Al avanzar se generan automáticamente las tareas del procedimiento para esta etapa y se notifica a todo el equipo del proyecto.</span></div>
        <div class="field"><label>Comentario (opcional)</label><textarea class="textarea" id="adv-note" placeholder="Ej. Ficha completa y razonable, se envía a evaluación."></textarea></div>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn btn-accent" id="adv-ok">${icon('arrow-right', 'i-sm')} Avanzar</button>`
    })
    m.$('#adv-ok').onclick = async () => {
      const note = m.$('#adv-note').value
      m.close()
      try {
        const r = await api.post(`projects/${id}/stage`, { stage_key: next.key, note })
        toast(`Proyecto en "${next.name}"${r.tasks_created ? ` · ${r.tasks_created} tareas generadas` : ''}`)
        window.__refreshTaskCount?.()
      } catch (e) {
        if (e.status === 422) {
          const ok = await confirmDialog({ title: 'Requisitos pendientes', message: `<ul style="padding-left:18px;margin:0">${e.data.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul><p class="mt-2">Podés completar la ficha primero o avanzar igualmente (queda registrado).</p>`, confirm: 'Avanzar igual', danger: true })
          if (ok) await api.post(`projects/${id}/stage`, { stage_key: next.key, note, force: true }).catch(handleErr)
          else { tab = 'ficha'; setQS({ tab }) }
        } else handleErr(e)
      }
      await load(); render()
    }
  }

  async function toggleStatus() {
    const next = isInactive(data.project) ? 'activo' : 'inactivo'
    const ok = await confirmDialog({
      title: next === 'inactivo' ? 'Desactivar proyecto' : 'Activar proyecto',
      message: next === 'inactivo'
        ? `<b>${esc(data.project.name)}</b> pasará a <b>Inactivo</b> y quedará en sólo lectura hasta que lo reactives. No se pierde información.`
        : `<b>${esc(data.project.name)}</b> volverá a estar <b>Activo</b> y se podrá editar nuevamente.`,
      confirm: next === 'inactivo' ? 'Desactivar' : 'Activar', danger: next === 'inactivo'
    })
    if (!ok) return
    try { await api.put(`projects/${id}/status`, { status: next }); toast(next === 'inactivo' ? 'Proyecto desactivado' : 'Proyecto activado'); await load(); render() } catch (e) { handleErr(e) }
  }

  function moreMenu(anchor) {
    import('../lib.js').then(({ popover, closePopover }) => {
      popover(anchor, `<div class="menu">
        <button class="menu-item" data-a="xlsx">${icon('file-spreadsheet', 'i-sm')} Exportar Ficha (Anexo I · Excel)</button>
        <button class="menu-item" data-a="print">${icon('printer', 'i-sm')} Imprimir / PDF</button>
        <button class="menu-item" data-a="task">${icon('list-plus', 'i-sm')} Nueva tarea</button>
        <button class="menu-item" data-a="upload">${icon('file-up', 'i-sm')} Subir documento</button>
        ${can('projects.create') ? `<button class="menu-item" data-a="dup">${icon('copy', 'i-sm')} Duplicar proyecto</button>` : ''}
        ${can('projects.status') ? `<div class="menu-sep"></div><button class="menu-item" data-a="status">${icon(isInactive(data.project) ? 'play-circle' : 'pause-circle', 'i-sm')} ${isInactive(data.project) ? 'Activar proyecto' : 'Desactivar proyecto'}</button>` : ''}
        ${can('projects.delete') ? `<div class="menu-sep"></div><button class="menu-item danger" data-a="delete">${icon('trash-2', 'i-sm')} Eliminar proyecto</button>` : ''}
      </div>`, { onMount: (el) => el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
        closePopover()
        const a = b.dataset.a
        if (a === 'xlsx') exportFicha(data)
        if (a === 'print') { tab = 'ficha'; render(); setTimeout(() => print(), 300) }
        if (a === 'task') newTaskModal({ project_id: id, investments: data.investments }, async () => { await load(); render() })
        if (a === 'upload') uploadModal({ project_id: id, investments: data.investments }, async () => { await load(); tab = 'docs'; render() })
        if (a === 'status') toggleStatus()
        if (a === 'dup') duplicateProjectModal({ id, name: data.project.name, code: data.project.code, company_id: data.project.company_id, zone_id: data.project.zone_id })
        if (a === 'delete' && await confirmDialog({ title: 'Eliminar proyecto', message: `Se eliminará <b>${esc(data.project.name)}</b> con todas sus inversiones, tareas, mensajes y documentos. Esta acción no se puede deshacer.`, confirm: 'Eliminar definitivamente', danger: true })) {
          try { await api.del(`projects/${id}`); toast('Proyecto eliminado'); location.hash = '#/projects' } catch (e) { handleErr(e) }
        }
      }) })
    })
  }

  function renderTab() {
    const body = root.querySelector('#tab-body')
    const p = data.project
    if (tab === 'overview') overview(body)
    else if (tab === 'ficha') ficha(body)
    else if (tab === 'investments') investments(body)
    else if (tab === 'tasks') tasks(body)
    else if (tab === 'chat') {
      body.innerHTML = `<div class="grid g-main"><div class="card" style="overflow:hidden"><div class="card-head"><h3>${icon('messages-square', 'i-sm')} Conversación del proyecto</h3><div class="right"><select class="select input-sm" id="chat-scope" style="width:auto"><option value="">Canal general</option>${data.investments.map(i => `<option value="${i.id}" ${qs().get('inv') == i.id ? 'selected' : ''}>${esc(i.code)} · ${esc(i.description.slice(0, 40))}</option>`).join('')}</select></div></div><div id="chat-box" style="height:clamp(440px, calc(100vh - 500px), 760px)"></div></div>
        <aside class="stack"><div class="card"><div class="card-head"><h3>Participantes</h3></div><div class="list">${data.members.filter(m => !m.investment_id).map(m => `<div class="list-item">${avatar(m.name, m.avatar_color, 'sm')}<div class="grow"><div class="t small">${esc(m.name)}</div><div class="s">${esc(roleOf(m.role_key).name)}</div></div></div>`).join('')}</div></div>
        <div class="card card-pad small muted">${icon('info', 'i-sm')} Usá <b>@nombre</b> para mencionar y notificar a alguien. Todas las conversaciones quedan registradas con autor y fecha para la trazabilidad del legajo.</div></aside></div>`
      paintIcons(body)
      const mount = () => { chat?.destroy(); const inv = Number(body.querySelector('#chat-scope').value) || null; chat = mountChat(body.querySelector('#chat-box'), { project_id: id, investment_id: inv }); setQS({ inv }) }
      body.querySelector('#chat-scope').onchange = mount
      mount()
    }
    else if (tab === 'docs') docs(body)
    else if (tab === 'checklist') checklist(body)
    else if (tab === 'team') team(body)
    else if (tab === 'history') history(body)
  }

  // ---------------------------------------------------------------- RESUMEN
  function overview(body) {
    const p = data.project
    const invs = data.investments
    const elig = invs.filter(i => ['General elegible', 'Específica elegible'].includes(i.eligibility)).reduce((a, i) => a + (i.total || 0), 0)
    const pend = invs.filter(i => i.eligibility === 'Pendiente de validación').length
    const total = invs.reduce((a, i) => a + (i.total || 0), 0)
    const invStages = stagesFor('investment')
    const fields = fieldsFor('project').filter(f => f.required && !['E'].includes(f.section_key))
    const filled = fields.filter(f => { const v = projectValue(p, f); return v !== null && v !== undefined && v !== '' }).length
    const fichaPct = fields.length ? filled / fields.length : 1
    body.innerHTML = `<div class="grid g-main">
      <div class="stack">
        <div class="grid g-4">
          <div class="card kpi"><div class="lbl">Ficha completa</div><div class="val">${Math.round(fichaPct * 100)}%</div><div class="foot"><div class="progress sm grow"><span style="width:${fichaPct * 100}%"></span></div></div></div>
          <div class="card kpi"><div class="lbl">Elegible</div><div class="val" style="font-size:22px">${money(elig, p.currency, true)}</div><div class="foot">${total ? Math.round(elig / total * 100) : 0}% del total</div></div>
          <div class="card kpi"><div class="lbl">Pendientes dictamen</div><div class="val">${pend}</div><div class="foot">de ${invs.length} componentes</div></div>
          <div class="card kpi"><div class="lbl">Checklist</div><div class="val">${p.chk_done}/${p.chk_total}</div><div class="foot">documentos presentados</div></div>
        </div>
        <article class="card"><div class="card-head"><h3>Componentes por estado</h3><div class="right"><button class="btn btn-ghost btn-sm" data-go="investments">Ver detalle ${icon('arrow-right', 'i-sm')}</button></div></div>
          <div class="card-body">${invs.length ? `<div class="comp-summary">${invStages.filter(s => !s.is_final).map(s => { const n = invs.filter(i => i.stage_key === s.key).length; return n ? `<span class="comp-chip"><i style="background:${s.color}"></i>${esc(s.short_name)} <b>${n}</b></span>` : '' }).join('')}<span class="xs muted">${invs.length} componentes en total</span></div>
            <div class="table-wrap mt-2"><table class="table"><thead><tr><th>Ítem</th><th>Descripción</th><th>NCM</th><th>Elegibilidad</th><th class="num">Total</th></tr></thead><tbody>${invs.slice(0, 6).map(i => `<tr class="clickable" data-inv="${i.id}"><td class="mono bold">${esc(i.code)}</td><td><div class="cell-title">${esc(i.description)}</div><div class="cell-sub">${esc(i.supplier || 'Proveedor a definir')}</div></td><td class="mono">${esc(i.ncm || 'pendiente')}</td><td>${eligDot(i.eligibility)}</td><td class="num bold">${money(i.total, i.currency)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('boxes', 'Sin componentes', 'Agregá los bienes, obras y servicios del proyecto.', mayInv(data.project) ? `<button class="btn btn-primary" data-go="investments">${icon('plus', 'i-sm')} Agregar componentes</button>` : '')}</div></article>
        <article class="card"><div class="card-head"><h3>Objeto del proyecto</h3><div class="right"><button class="btn btn-ghost btn-sm" data-go="ficha">${icon('pencil', 'i-sm')} Editar ficha</button></div></div>
          <div class="card-body grid g-2" style="gap:16px">
            <div><div class="xs bold muted" style="text-transform:uppercase;letter-spacing:.08em">Objetivo productivo</div><p class="mt-1">${esc(p.data.objective || '—')}</p></div>
            <div><div class="xs bold muted" style="text-transform:uppercase;letter-spacing:.08em">Descripción técnica y alcance</div><p class="mt-1">${esc(p.data.tech_description || '—')}</p></div>
            <div><div class="xs bold muted" style="text-transform:uppercase;letter-spacing:.08em">Instalación</div><p class="mt-1">${esc(p.data.install_type || '—')} · Obra civil: ${esc(p.data.civil_work || '—')} · Conexión a red: ${esc(p.data.grid_connected || '—')}</p></div>
            <div><div class="xs bold muted" style="text-transform:uppercase;letter-spacing:.08em">Clasificación sugerida</div><p class="mt-1">${esc(p.classification || '—')}</p></div>
          </div></article>
      </div>
      <aside class="stack">
        <article class="card"><div class="card-head"><h3>Dictamen RIMI</h3></div><div class="card-body">
          ${p.dictamen ? `<div class="row">${eligBadge(p.dictamen)}<span class="xs muted">${fdate(p.dictamen_date)}</span></div>${p.dictamen_notes ? `<p class="small mt-2">${esc(p.dictamen_notes)}</p>` : ''}` : `<p class="small muted">Aún sin dictamen. El Responsable RIMI dispone de 5 días hábiles desde la Ficha completa.</p>`}
          ${canFiscal() ? `<button class="btn btn-sm mt-3" id="dictamen">${icon('stamp', 'i-sm')} ${p.dictamen ? 'Actualizar' : 'Registrar'} dictamen</button>` : ''}
          <p class="xs muted mt-2">La conformidad no es aprobación del beneficio, del cupo ni de la inversión.</p></div></article>
        <article class="card"><div class="card-head"><h3>Fechas clave</h3></div><div class="card-body stack" style="gap:10px">
          ${[['Ficha enviada a RIMI', p.ficha_sent_at, 'send'], ['Dictamen', p.dictamen_date, 'stamp'], ['Primera compra (est.)', p.first_purchase_date, 'shopping-cart'], ['Puesta en marcha (est.)', p.startup_est_date, 'rocket'], ['Puesta en marcha (real)', p.startup_real_date, 'badge-check']].map(([l, d, ic]) => `<div class="row small">${icon(ic, 'i-sm')}<span class="grow muted">${l}</span><b class="ink">${fdate(d)}</b></div>`).join('')}
        </div></article>
        <article class="card"><div class="card-head"><h3>Equipo</h3><div class="right"><button class="btn btn-ghost btn-sm" data-go="team">Gestionar</button></div></div>
          <div class="list">${data.members.filter(m => !m.investment_id).slice(0, 7).map(m => `<div class="list-item" style="padding:9px 20px">${avatar(m.name, m.avatar_color, 'sm')}<div class="grow"><div class="t small">${esc(m.name)}</div></div><span class="badge" style="background:${hexA(roleOf(m.role_key).color, .12)};color:${roleOf(m.role_key).color}">${esc(roleOf(m.role_key).name)}</span></div>`).join('')}</div></article>
        ${p.folder_path ? `<article class="card card-pad"><div class="xs bold muted" style="text-transform:uppercase;letter-spacing:.08em">Carpeta de respaldo</div><div class="mono small mt-1 ink">${esc(p.folder_path)}</div></article>` : ''}
      </aside></div>`
    paintIcons(body)
    body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { tab = b.dataset.go; setQS({ tab }); render() })
    body.querySelectorAll('[data-inv]').forEach(r => r.onclick = () => openInvestment(Number(r.dataset.inv), data, async () => { await load(); render() }))
    body.querySelector('#dictamen')?.addEventListener('click', () => dictamenModal())
  }

  function dictamenModal() {
    const p = data.project
    const m = modal({
      title: 'Dictamen de elegibilidad', icon: 'stamp', tone: 'tone-sun', size: 'lg', subtitle: 'Paso 5.1.3 · Se deja registro del resultado en la Ficha y se comunica al Responsable del Proyecto.',
      body: `<div class="form-grid">
        <div class="field w-half"><label>Resultado del proyecto</label><select class="select" id="d-res"><option value="">—</option>${['General elegible', 'Específica elegible', 'No elegible', 'Pendiente de validación'].map(o => `<option ${o === p.dictamen ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
        <div class="field w-half"><label>Fecha del dictamen</label><input type="date" class="input" id="d-date" value="${esc(p.dictamen_date || new Date().toISOString().slice(0, 10))}"></div>
        <div class="field w-full"><label>Fundamento / observaciones</label><textarea class="textarea" id="d-notes" placeholder="Ventana temporal, destino productivo, exclusiones, monto mínimo, casos controvertidos (ej. Off Grid)…">${esc(p.dictamen_notes || '')}</textarea></div></div>
        <h4 class="mt-3 mb-2">Elegibilidad por componente</h4>
        <div class="table-wrap"><table class="table"><thead><tr><th>Ítem</th><th>Descripción</th><th>NCM</th><th style="width:200px">Elegibilidad</th><th style="width:120px">BK/BIT</th></tr></thead><tbody>
        ${data.investments.map(i => `<tr><td class="mono bold">${esc(i.code)}</td><td class="small">${esc(i.description)}</td><td><input class="input input-sm mono" data-ncm="1" data-inv-ncm="${i.id}" value="${esc(i.ncm || '')}" placeholder="0000.00.00"></td>
          <td><select class="select input-sm" data-inv-el="${i.id}">${['Pendiente de validación', 'General elegible', 'Específica elegible', 'No elegible'].map(o => `<option ${o === i.eligibility ? 'selected' : ''}>${o}</option>`).join('')}</select></td>
          <td><select class="select input-sm" data-inv-bk="${i.id}"><option value="">—</option>${['BK', 'BIT', 'No aplica', 'Pendiente'].map(o => `<option ${o === i.bk_bit ? 'selected' : ''}>${o}</option>`).join('')}</select></td></tr>`).join('') || '<tr><td colspan="5" class="muted small">Sin componentes</td></tr>'}</tbody></table></div>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="d-save">${icon('save', 'i-sm')} Guardar dictamen</button>`
    })
    bindNcmMask(m.el)
    m.$('#d-save').onclick = async () => {
      try {
        const ops = data.investments.map(i => {
          const el = m.$(`[data-inv-el="${i.id}"]`).value, bk = m.$(`[data-inv-bk="${i.id}"]`).value || null, ncm = m.$(`[data-inv-ncm="${i.id}"]`).value || null
          if (el !== i.eligibility || bk !== i.bk_bit || ncm !== i.ncm) return api.put(`investments/${i.id}`, { eligibility: el, bk_bit: bk, ncm, ncm_status: ncm ? 'Validada' : i.ncm_status, stage_key: i.stage_key === 'identificada' && el !== 'Pendiente de validación' ? 'dictaminada' : undefined })
        }).filter(Boolean)
        await Promise.all(ops)
        await api.put(`projects/${id}`, { dictamen: m.$('#d-res').value || null, dictamen_date: m.$('#d-date').value || null, dictamen_notes: m.$('#d-notes').value })
        toast('Dictamen registrado y comunicado'); m.close(); await load(); render()
      } catch (e) { handleErr(e) }
    }
  }

  // ---------------------------------------------------------------- FICHA
  function ficha(body) {
    const p = data.project
    const secs = sectionsFor('project')
    const editable = mayEdit(p)
    const ctx = { company_id: p.company_id, zone_id: p.zone_id, currency: p.currency }
    body.innerHTML = `<div class="grid g-main-l" style="grid-template-columns:240px minmax(0,1fr)">
      <aside><nav class="card toc" style="padding:8px">${secs.map(s => {
        const fs = fieldsFor('project', s.key); const req = fs.filter(f => f.required)
        const done = req.every(f => { const v = projectValue(p, f); return v !== null && v !== undefined && v !== '' })
        return `<a href="javascript:void 0" data-toc="${s.key}" class="${done ? 'done' : ''}"><span class="tl">${done ? icon('check', 'i-xs') : esc(s.letter || '·')}</span><span class="grow">${esc(s.title)}</span>${s.restricted ? icon('lock', 'i-xs') : ''}</a>`
      }).join('')}
      <div class="divider" style="margin:8px 4px"></div>
      <a href="javascript:void 0" id="toc-xlsx">${icon('file-spreadsheet', 'i-sm')} Exportar Anexo I</a>
      ${isAdmin() ? `<a href="#/admin/builder">${icon('blocks', 'i-sm')} Personalizar campos</a>` : ''}</nav></aside>
      <form id="ficha-form" novalidate>
        <div class="alert warn mb-3">${icon('triangle-alert', 'i-sm')}<span><b>IMPORTANTE</b> · La clasificación definitiva, la elegibilidad y los requisitos documentales serán evaluados por el Responsable RIMI / Impuestos. Completar antes de la primera compra o contratación.</span></div>
        ${secs.map(s => {
          const fs = fieldsFor('project', s.key)
          const locked = s.restricted && !canFiscal()
          const req = fs.filter(f => f.required); const done = req.filter(f => { const v = projectValue(p, f); return v !== null && v !== undefined && v !== '' }).length
          return `<section class="ficha-section ${s.restricted ? 'restricted' : ''}" id="sec-${s.key}">
            <div class="ficha-head"><span class="ficha-letter">${esc(s.letter || '·')}</span><div class="grow"><h3>${esc(s.title)}</h3><p>${esc(s.description || '')}</p></div>
            ${locked ? `<span class="badge sun">${icon('lock', 'i-xs')} Uso interno RIMI / Impuestos</span>` : req.length ? `<span class="ficha-progress">${ringSVG(done / req.length)} ${done}/${req.length}</span>` : ''}</div>
            <div class="ficha-body"><div class="form-grid">${fs.map(f => renderField(f, projectValue(p, f), { disabled: !editable || locked, ctx })).join('')}</div></div></section>`
        }).join('')}
        ${editable ? `<div class="ficha-savebar no-print"><span class="small muted grow" id="dirty">${icon('info', 'i-xs')} Los cambios se guardan al presionar Guardar.</span><button type="button" class="btn" id="ficha-reset">Descartar</button><button type="submit" class="btn btn-primary">${icon('save', 'i-sm')} Guardar ficha</button></div>` : ''}
      </form></div>`
    paintIcons(body)
    bindNcmMask(body)
    const form = body.querySelector('#ficha-form')
    body.querySelectorAll('[data-toc]').forEach(a => a.onclick = () => body.querySelector('#sec-' + a.dataset.toc).scrollIntoView({ behavior: 'smooth', block: 'start' }))
    body.querySelector('#toc-xlsx').onclick = () => exportFicha(data)
    form.addEventListener('input', () => { const d = body.querySelector('#dirty'); if (d) { d.innerHTML = `${icon('circle-dot', 'i-xs')} <b style="color:var(--sun-600)">Hay cambios sin guardar</b>`; paintIcons(d) } })
    // cascada empresa → zona → finca
    const zoneSel = form.querySelector('[data-field=zone_id]'), farmSel = form.querySelector('[data-field=farm_id]'), coSel = form.querySelector('[data-field=company_id]')
    coSel?.addEventListener('change', () => { if (zoneSel) zoneSel.innerHTML = `<option value="">Seleccionar zona…</option>` + B().zones.filter(z => z.company_id == coSel.value).map(z => `<option value="${z.id}">${esc(z.name)}</option>`).join('') })
    zoneSel?.addEventListener('change', () => { if (farmSel) farmSel.innerHTML = `<option value="">Sin finca específica</option>` + B().farms.filter(f => f.zone_id == zoneSel.value).map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('') })
    body.querySelector('#ficha-reset')?.addEventListener('click', () => ficha(body))
    form.onsubmit = async (e) => {
      e.preventDefault()
      const all = fieldsFor('project')
      const errs = validateForm(form, all.filter(f => f.type === 'ncm'))
      if (errs.length) return toast('Revisá: ' + errs.join(', '), 'warn')
      const vals = readForm(form, all)
      const payload = { data: {} }
      for (const f of all) { if (!(f.key in vals)) continue; if (f.core) payload[f.key] = vals[f.key]; else payload.data[f.key] = vals[f.key] }
      try { await api.put(`projects/${id}`, payload); toast('Ficha guardada'); await load(); render() } catch (err) { handleErr(err) }
    }
  }

  // ---------------------------------------------------------------- INVERSIONES
  function investments(body) {
    const p = data.project
    const invs = data.investments
    const total = invs.reduce((a, i) => a + (i.total || 0), 0)
    body.innerHTML = `<div class="card">
      <div class="card-head"><div><h3>Desglose técnico y presupuestario · hoja 02</h3><div class="sub">Una fila por bien, equipo, componente, obra o servicio. Cada inversión puede tener su propio responsable, documentos, tareas y conversación.</div></div>
      <div class="right">${mayInv(p) ? `<button class="btn btn-sm" id="inv-import">${icon('clipboard-paste', 'i-sm')} Importar desde Excel</button><button class="btn btn-primary btn-sm" id="inv-add">${icon('plus', 'i-sm')} Agregar componente</button>` : ''}</div></div>
      ${invs.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Ítem</th><th>Tipo</th><th>Descripción técnica</th><th>Marca / modelo</th><th class="num">Cant.</th><th>NCM</th><th>Proveedor</th><th class="num">Unitario</th><th class="num">Total</th><th>Elegibilidad</th><th>Estado</th><th></th></tr></thead>
      <tbody>${invs.map(i => `<tr class="clickable" data-inv="${i.id}"><td class="mono bold ink">${esc(i.code)}</td><td class="small">${esc(i.component_type || '—')}</td>
        <td><div class="cell-title">${esc(i.description)}</div><div class="cell-sub row" style="gap:8px">${i.doc_count ? `<span>${icon('paperclip', 'i-xs')} ${i.doc_count}</span>` : ''}${i.open_tasks ? `<span>${icon('list-checks', 'i-xs')} ${i.open_tasks}</span>` : ''}${i.msg_count ? `<span>${icon('message-circle', 'i-xs')} ${i.msg_count}</span>` : ''}${i.responsible_name ? `<span>${icon('user', 'i-xs')} ${esc(i.responsible_name)}</span>` : ''}</div></td>
        <td class="small">${esc(i.brand_model || '—')}</td><td class="num">${num(i.quantity, 2)} <span class="xs muted">${esc(i.unit || '')}</span></td>
        <td><span class="mono">${esc(i.ncm || 'pendiente')}</span>${i.ncm ? `<div class="xs ${i.ncm_status === 'Validada' ? '' : 'muted'}" style="${i.ncm_status === 'Validada' ? 'color:var(--brand-600);font-weight:700' : ''}">${esc(i.ncm_status || '')}</div>` : ''}</td>
        <td class="small">${esc(i.supplier || '—')}</td><td class="num small">${money(i.unit_price, i.currency)}</td><td class="num bold ink">${money(i.total, i.currency)}</td>
        <td>${eligBadge(i.eligibility)}</td><td>${stagePill(i.stage_key, 'investment')}</td><td>${icon('chevron-right', 'i-sm')}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="8">TOTAL PRESUPUESTADO · ${invs.length} componentes</td><td class="num">${money(total, p.currency)}</td><td colspan="3"></td></tr></tfoot></table></div>`
        : emptyState('boxes', 'Todavía no hay componentes', 'Ejemplo: el proyecto energético lleva un transformador, paneles, inversores y obra civil — cada uno es una inversión con su posición arancelaria.', mayInv(data.project) ? `<button class="btn btn-primary" id="inv-add2">${icon('plus', 'i-sm')} Agregar el primero</button>` : '')}
      <div class="card-foot xs muted">${icon('info', 'i-xs')} NCM: completar si se conoce; de lo contrario indicar "pendiente".</div></div>`
    paintIcons(body)
    const refresh = async () => { await load(); render() }
    body.querySelectorAll('[data-inv]').forEach(r => r.onclick = () => openInvestment(Number(r.dataset.inv), data, refresh))
    const add = () => investmentForm(null, data, refresh)
    body.querySelector('#inv-add')?.addEventListener('click', add)
    body.querySelector('#inv-add2')?.addEventListener('click', add)
    body.querySelector('#inv-import')?.addEventListener('click', () => importModal(refresh))
    const invParam = qs().get('inv')
    if (invParam) openInvestment(Number(invParam), data, refresh)
  }

  function importModal(done) {
    const m = modal({
      title: 'Importar componentes desde Excel', icon: 'clipboard-paste', size: 'lg',
      subtitle: 'Copiá las filas de la hoja "02 Detalle componentes" (desde la columna Tipo hasta Fecha puesta en marcha) y pegalas acá, o subí el archivo Anexo I.',
      body: `<div class="field"><label>Pegar filas (separadas por tabulación)</label><textarea class="textarea mono" id="paste" style="min-height:160px;font-size:12px" placeholder="Bien / equipo\tTransformador 630 kVA\tTadeo Czerweny\t1\tu\t8504.23.00\tProveedor\t48500\t…"></textarea></div>
        <div class="row mt-2 row-wrap" style="gap:10px"><a class="btn btn-sm" href="/static/plantillas/plantilla-inversiones.xlsx" download>${icon('download', 'i-sm')} Descargar plantilla</a><span class="small muted">o</span><label class="btn btn-sm">${icon('file-spreadsheet', 'i-sm')} Subir Anexo I (.xlsx)<input type="file" id="xls" accept=".xlsx,.xls" hidden></label></div>
        <div id="preview" class="mt-3"></div>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="imp-ok" disabled>${icon('download', 'i-sm')} Importar</button>`
    })
    let rows = []
    const cols = ['component_type', 'description', 'brand_model', 'quantity', 'unit', 'ncm', 'supplier', 'unit_price', null, 'purchase_date', 'invoice_date', 'startup_date', 'spec_doc']
    const toISO = (v) => { if (!v) return null; if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10) } const m2 = String(v).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/); if (m2) return `${m2[3].length === 2 ? '20' + m2[3] : m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`; return /^\d{4}-\d{2}-\d{2}/.test(v) ? String(v).slice(0, 10) : null }
    // Número: si tiene coma, la coma es el decimal (formato AR) y los puntos son miles.
    // Sin coma, el punto ya es decimal: "48500.5" queda en 48500.5 (antes quedaba 485005).
    const toNum = (v) => {
      if (typeof v === 'number') return Number.isFinite(v) ? v : null
      const t = String(v ?? '').trim()
      if (!t) return null
      const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t)
      return Number.isFinite(n) ? n : null
    }
    const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    // Encabezado de la plantilla (prefijo normalizado) -> campo de inversión
    const HEADERS = [['tipo de componente', 'component_type'], ['descripcion tecnica', 'description'], ['marca', 'brand_model'], ['cantidad', 'quantity'], ['unidad', 'unit'], ['ncm', 'ncm'], ['proveedor', 'supplier'], ['importe unitario', 'unit_price'], ['fecha compra', 'purchase_date'], ['fecha factura', 'invoice_date'], ['fecha puesta', 'startup_date'], ['especificacion', 'spec_doc']]
    const setRows = (objs) => {
      rows = objs.filter(o => String(o.description ?? '').trim() && !norm(o.description).startsWith('descripcion tecnica'))
        .map(o => ({ ...o, quantity: toNum(o.quantity), unit_price: toNum(o.unit_price), purchase_date: toISO(o.purchase_date), invoice_date: toISO(o.invoice_date), startup_date: toISO(o.startup_date), ncm: o.ncm && String(o.ncm).trim().toLowerCase() !== 'pendiente' ? String(o.ncm).trim() : null, currency: data.project.currency }))
      m.$('#preview').innerHTML = rows.length ? `<div class="alert success">${icon('check', 'i-sm')} ${rows.length} componente(s) detectados</div><div class="table-wrap mt-2" style="max-height:220px"><table class="table"><thead><tr><th>Tipo</th><th>Descripción</th><th>Cant.</th><th>NCM</th><th class="num">Unitario</th></tr></thead><tbody>${rows.map(r => `<tr><td class="small">${esc(r.component_type)}</td><td class="small bold">${esc(r.description)}</td><td>${esc(r.quantity ?? '')}</td><td class="mono">${esc(r.ncm || '')}</td><td class="num">${money(r.unit_price)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="alert warn">No se detectaron filas válidas</div>'
      paintIcons(m.$('#preview')); m.$('#imp-ok').disabled = !rows.length
    }
    const parse = (matrix) => setRows(matrix.map(r => { const o = {}; cols.forEach((k, i) => { if (k) o[k] = r[i] ?? '' }); return o }))
    m.$('#paste').oninput = (e) => parse(e.target.value.split(/\r?\n/).filter(Boolean).map(l => l.split('\t')))
    m.$('#xls').onchange = async (e) => {
      try {
        const XLSX = await ensureXLSX()
        const wb = XLSX.read(await e.target.files[0].arrayBuffer())
        const ws = wb.Sheets[wb.SheetNames.find(n => n.includes('02')) || wb.SheetNames[0]]
        const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
        const hi = grid.findIndex(r => r.some(c => norm(c).startsWith('descripcion tecnica')))
        if (hi < 0) throw new Error('No encontré la fila de encabezados "Descripción técnica precisa". Usá la plantilla de importación.')
        const idx = {}
        grid[hi].forEach((h, i) => { const n = norm(h); const hit = HEADERS.find(([pre]) => n.startsWith(pre)); if (hit && !(hit[1] in idx)) idx[hit[1]] = i })
        setRows(grid.slice(hi + 1).map(r => { const o = {}; Object.entries(idx).forEach(([k, i]) => { o[k] = r[i] ?? '' }); return o }))
      } catch (ex) { toast(ex.message || 'No se pudo leer el archivo', 'warn') }
    }
    m.$('#imp-ok').onclick = async () => { try { const r = await api.post(`projects/${id}/investments/bulk`, { rows }); toast(`${r.imported} componentes importados`); m.close(); done() } catch (e) { handleErr(e) } }
  }

  // ---------------------------------------------------------------- TAREAS
  async function tasks(body) {
    body.innerHTML = `<div class="card"><div class="card-head"><div><h3>Tareas del proyecto</h3><div class="sub">Las tareas del procedimiento se generan automáticamente al cambiar de etapa.</div></div>
      <div class="right"><div class="seg" id="tf"><button data-f="open" class="active">Abiertas</button><button data-f="completada">Completadas</button><button data-f="">Todas</button></div>${can('tasks.create') || isOwner(data.project) ? `<button class="btn btn-primary btn-sm" id="nt">${icon('plus', 'i-sm')} Nueva tarea</button>` : ''}</div></div><div id="tl"></div></div>`
    paintIcons(body)
    let f = 'open'
    const loadT = async () => { const { tasks } = await api.get(`tasks?project_id=${id}${f ? '&status=' + f : ''}`); renderTaskList(body.querySelector('#tl'), tasks, loadT, { showProject: false, emptyTitle: f === 'open' ? 'Sin tareas abiertas' : 'Sin tareas' }) }
    body.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { f = b.dataset.f; body.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('active', x === b)); loadT() })
    body.querySelector('#nt')?.addEventListener('click', () => newTaskModal({ project_id: id, investments: data.investments }, loadT))
    await loadT()
  }

  // ---------------------------------------------------------------- DOCUMENTOS
  async function docs(body) {
    const { documents, storage } = await api.get(`documents?project_id=${id}`)
    let folder = qs().get('folder') || ''
    const draw = () => {
      const list = folder ? documents.filter(d => d.folder_key === folder) : documents
      body.innerHTML = `<div class="grid g-main-l" style="grid-template-columns:280px minmax(0,1fr)">
        <aside class="card" style="padding:8px;align-self:start"><div class="xs bold muted" style="padding:8px 12px;text-transform:uppercase;letter-spacing:.1em">RIMI-${esc((data.project.name || '').toUpperCase())}/</div>
          <div class="folder-item ${!folder ? 'active' : ''}" data-folder="">${icon('folders', 'i-sm')} Todo el legajo<span class="cnt">${documents.length}</span></div>
          ${B().folders.map(f => `<div class="folder-item ${folder === f.key ? 'active' : ''}" data-folder="${f.key}" title="${esc(f.description || '')}">${icon(folder === f.key ? 'folder-open' : 'folder', 'i-sm')} <span class="truncate">${esc(f.name)}</span><span class="cnt">${documents.filter(d => d.folder_key === f.key).length || ''}</span></div>`).join('')}
        </aside>
        <div class="card"><div class="card-head"><div><h3>${folder ? esc(B().folders.find(f => f.key === folder)?.name) : 'Legajo digital completo'}</h3><div class="sub">${folder ? esc(B().folders.find(f => f.key === folder)?.description || '') : 'Estructura fija igual para todos los proyectos (Anexo II)'}</div></div>
          <div class="right">${can('documents.upload') ? `<button class="btn btn-primary btn-sm" id="up">${icon('upload', 'i-sm')} Subir</button>` : ''}</div></div>
          ${!storage ? `<div class="alert warn" style="margin:12px 16px 0">${icon('triangle-alert', 'i-sm')}<span>Almacenamiento de archivos no configurado: se registran sólo referencias.</span></div>` : ''}
          ${docTable(list)}</div></div>`
      paintIcons(body)
      body.querySelectorAll('[data-folder]').forEach(f => f.onclick = () => { folder = f.dataset.folder; setQS({ folder }); draw() })
      body.querySelector('#up')?.addEventListener('click', () => uploadModal({ project_id: id, investments: data.investments, folder_key: folder || null }, async () => { await load(); render() }))
      bindDocTable(body, list, async () => { await load(); render() })
    }
    draw()
  }

  // ---------------------------------------------------------------- CHECKLIST
  function checklist(body) {
    const items = data.checklist
    const opts = ['Adjunto', 'Pendiente', 'En elaboración', 'No aplica']
    const tone = { Adjunto: 'green', Pendiente: 'rose', 'En elaboración': 'sun', 'No aplica': '' }
    const done = items.filter(i => ['Adjunto', 'No aplica'].includes(i.status)).length
    body.innerHTML = `<div class="grid g-main"><div class="card"><div class="card-head"><div><h3>Checklist de documentación para evaluación RIMI</h3><div class="sub">Anexo I · hoja 03 — remitir con sus respaldos antes de la primera compra/contratación.</div></div><div class="right">${ringSVG(items.length ? done / items.length : 0, '#4F8226', 36)}<b class="ink">${done}/${items.length}</b></div></div>
      <div>${items.map((it, i) => `<div class="chk-row ${['Adjunto', 'No aplica'].includes(it.status) ? 'ok' : ''}"><span class="chk-num">${['Adjunto', 'No aplica'].includes(it.status) ? icon('check', 'i-xs') : i + 1}</span>
        <div><div class="bold ink small">${esc(it.label)}</div><div class="xs muted">${esc(it.required_note || '')}</div></div>
        <select class="select input-sm" data-chk="${it.id}" ${mayEdit(data.project) ? '' : 'disabled'}>${opts.map(o => `<option ${o === it.status ? 'selected' : ''}>${o}</option>`).join('')}</select>
        <input class="input input-sm" data-chk-ref="${it.id}" value="${esc(it.reference || it.notes || '')}" placeholder="Archivo / referencia / fecha estimada" ${mayEdit(data.project) ? '' : 'disabled'}></div>`).join('')}</div></div>
      <aside class="stack"><div class="card card-pad"><h4>Estado</h4><div class="stack mt-2" style="gap:8px">${opts.map(o => `<div class="row small"><span class="badge ${tone[o]}">${o}</span><span class="grow"></span><b class="ink">${items.filter(i => i.status === o).length}</b></div>`).join('')}</div></div>
      <div class="card card-pad small muted">${icon('info', 'i-sm')} Los documentos aún no generados se identifican con su fecha prevista. Contratos / OC no son requisito previo universal.</div></aside></div>`
    paintIcons(body)
    body.querySelectorAll('[data-chk]').forEach(s => s.onchange = async () => { try { await api.put(`checklist/${s.dataset.chk}`, { status: s.value }); const it = items.find(i => i.id == s.dataset.chk); it.status = s.value; data.project.chk_done = items.filter(i => ['Adjunto', 'No aplica'].includes(i.status)).length; checklist(body); toast('Checklist actualizado') } catch (e) { handleErr(e) } })
    body.querySelectorAll('[data-chk-ref]').forEach(s => s.onchange = async () => { try { await api.put(`checklist/${s.dataset.chkRef}`, { reference: s.value }); toast('Referencia guardada') } catch (e) { handleErr(e) } })
  }

  // ---------------------------------------------------------------- EQUIPO
  function team(body) {
    const p = data.project
    const canManage = can('members.manage') || isOwner(p)
    const byRole = {}
    for (const m of data.members) (byRole[m.role_key] ||= []).push(m)
    body.innerHTML = `<div class="grid g-main"><div class="card"><div class="card-head"><div><h3>Responsables e intervinientes</h3><div class="sub">Cada proyecto —e incluso cada inversión— puede tener distintos usuarios por rol.</div></div><div class="right">${canManage ? `<button class="btn btn-primary btn-sm" id="add-m">${icon('user-plus', 'i-sm')} Sumar participante</button>` : ''}</div></div>
      <div class="card-body grid g-2" style="gap:14px">${B().roles.map(r => {
        const ms = byRole[r.key] || []
        return `<div style="border:1px solid var(--line-2);border-radius:14px;padding:14px;${ms.length ? '' : 'opacity:.65'}"><div class="row" style="gap:10px"><span style="width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:${hexA(r.color, .14)};color:${r.color}">${icon(r.icon, 'i-sm')}</span><div class="grow"><div class="bold ink small">${esc(r.name)}</div><div class="xs muted">${esc(r.description || '')}</div></div></div>
          <div class="stack mt-2" style="gap:6px">${ms.map(m => `<div class="row" style="gap:8px;padding:6px 8px;border-radius:10px;background:var(--bg)">${avatar(m.name, m.avatar_color, 'xs')}<span class="small bold ink grow truncate">${esc(m.name)}</span>${m.inv_code ? `<span class="badge sun">${esc(m.inv_code)}</span>` : ''}${canManage ? `<button class="btn btn-ghost btn-xs btn-icon" data-rm="${m.id}" title="Quitar">${icon('x', 'i-xs')}</button>` : ''}</div>`).join('') || '<span class="xs muted">Sin asignar</span>'}</div></div>`
      }).join('')}</div></div>
      <aside class="card card-pad small muted">${icon('info', 'i-sm')} Los participantes reciben notificaciones de cambios de etapa, mensajes del proyecto y documentos nuevos. Las tareas automáticas se asignan según el rol.</aside></div>`
    paintIcons(body)
    body.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { try { await api.del(`members/${b.dataset.rm}`); toast('Participante quitado'); await load(); render() } catch (e) { handleErr(e) } })
    body.querySelector('#add-m')?.addEventListener('click', () => {
      const m = modal({
        title: 'Sumar participante', icon: 'user-plus', tone: 'tone-sky',
        body: `<div class="form-grid"><div class="field w-full"><label>Usuario</label><select class="select" id="m-user">${B().users.filter(u => u.active).map(u => `<option value="${u.id}" data-role="${u.functional_role || ''}">${esc(u.name)} · ${esc(u.email)}</option>`).join('')}</select></div>
          <div class="field w-half"><label>Rol en el proyecto</label><select class="select" id="m-role">${B().roles.map(r => `<option value="${r.key}">${esc(r.name)}</option>`).join('')}</select></div>
          <div class="field w-half"><label>Alcance</label><select class="select" id="m-inv"><option value="">Todo el proyecto</option>${data.investments.map(i => `<option value="${i.id}">${esc(i.code)} · ${esc(i.description.slice(0, 40))}</option>`).join('')}</select></div></div>`,
        foot: `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="m-ok">Sumar</button>`
      })
      const sync = () => { const r = m.$('#m-user').selectedOptions[0]?.dataset.role; if (r) m.$('#m-role').value = r }
      m.$('#m-user').onchange = sync; sync()
      m.$('#m-ok').onclick = async () => { try { await api.post(`projects/${id}/members`, { user_id: Number(m.$('#m-user').value), role_key: m.$('#m-role').value, investment_id: Number(m.$('#m-inv').value) || null }); toast('Participante agregado y notificado'); m.close(); await load(); render() } catch (e) { handleErr(e) } }
    })
  }

  // ---------------------------------------------------------------- HISTORIAL
  async function history(body) {
    const { activity } = await api.get(`projects/${id}/activity`)
    const ic = { create: 'folder-plus', stage: 'git-commit-horizontal', dictamen: 'stamp', update: 'pencil', investment: 'package', task: 'list-checks', document: 'file-up', member: 'user-plus', checklist: 'clipboard-check' }
    body.innerHTML = `<div class="card"><div class="card-head"><div><h3>Historial de auditoría</h3><div class="sub">Registro inmutable de cada acción: quién, qué y cuándo. Útil ante inspecciones de organismos de contralor.</div></div><div class="right"><button class="btn btn-sm" id="exp-h">${icon('download', 'i-sm')} Exportar CSV</button></div></div>
      <div class="feed" style="padding:12px 24px">${activity.map(a => `<div class="feed-item"><span class="avatar sm" style="background:var(--brand-50);color:var(--brand-600)">${icon(ic[a.action] || 'circle-dot', 'i-xs')}</span><div class="grow"><div class="txt"><b>${esc(a.user_name || 'Sistema')}</b> · ${esc(a.summary)}</div><div class="when">${fdatetime(a.created_at)}</div></div></div>`).join('') || emptyState('history', 'Sin actividad')}</div></div>`
    paintIcons(body)
    body.querySelector('#exp-h').onclick = () => downloadBlob(toCSV(activity, [{ label: 'Fecha', key: 'created_at' }, { label: 'Usuario', key: 'user_name' }, { label: 'Acción', key: 'action' }, { label: 'Detalle', key: 'summary' }]), `historial-${data.project.code}.csv`)
  }

  render()
}

// Exportación de la Ficha con la estructura del Anexo I (3 hojas)
export async function exportFicha(data) {
  try {
    const XLSX = await ensureXLSX()
    const p = data.project
    const wb = XLSX.utils.book_new()
    const rows1 = [[`${(p.company_name || 'SOLFRUT').toUpperCase()}  |  FICHA DE APERTURA DE PROYECTO RIMI`], [], ['Completa Operaciones / Proyectos ANTES de la primera compra o contratación. No implica aprobación ni elegibilidad fiscal.'], []]
    for (const s of sectionsFor('project')) {
      rows1.push([`${s.letter ? s.letter + '. ' : ''}${s.title.toUpperCase()}`])
      for (const f of fieldsFor('project', s.key)) {
        let v = projectValue(p, f)
        if (f.type === 'user') v = B().users.find(u => u.id == v)?.name || ''
        if (f.type === 'company') v = p.company_name
        if (f.type === 'zone') v = p.zone_name
        if (f.type === 'farm') v = p.farm_name
        if (f.type === 'project_type') v = p.type_name
        rows1.push([f.label, v ?? ''])
      }
      rows1.push([])
    }
    const ws1 = XLSX.utils.aoa_to_sheet(rows1); ws1['!cols'] = [{ wch: 48 }, { wch: 80 }]
    XLSX.utils.book_append_sheet(wb, ws1, '01 Ficha Operaciones')
    const head = ['Ítem', 'Tipo de componente', 'Descripción técnica precisa', 'Marca / modelo', 'Cantidad', 'Unidad', 'NCM propuesta*', 'Proveedor previsto', 'Importe unitario', 'Presupuesto total', 'Fecha compra estimada', 'Fecha factura estimada', 'Fecha puesta en marcha', 'Especificación / documento soporte', 'Elegibilidad', 'BK/BIT']
    const rows2 = [[`${(p.company_name || 'SOLFRUT').toUpperCase()}  |  DESGLOSE TÉCNICO Y PRESUPUESTARIO DEL PROYECTO`], [], ['Una fila por bien, equipo, componente, obra o servicio.'], [], head,
      ...data.investments.map(i => [i.seq, i.component_type, i.description, i.brand_model, i.quantity, i.unit, i.ncm || 'pendiente', i.supplier, i.unit_price, i.total, i.purchase_date, i.invoice_date, i.startup_date, i.spec_doc, i.eligibility, i.bk_bit]),
      [], ['', '', '', '', '', '', '', '', 'TOTAL PRESUPUESTADO', data.investments.reduce((a, i) => a + (i.total || 0), 0)]]
    const ws2 = XLSX.utils.aoa_to_sheet(rows2); ws2['!cols'] = head.map((h, i) => ({ wch: i === 2 ? 46 : 16 }))
    XLSX.utils.book_append_sheet(wb, ws2, '02 Detalle componentes')
    const rows3 = [[`${(p.company_name || 'SOLFRUT').toUpperCase()}  |  CHECKLIST DE DOCUMENTACIÓN PARA EVALUACIÓN RIMI`], [], ['N°', 'Documento / evidencia', 'Estado', 'Archivo / enlace / referencia', 'Observaciones / fecha estimada'],
      ...data.checklist.map((c, i) => [i + 1, c.label, c.status, c.reference || '', c.required_note || '']), [], ['USO INTERNO DEL RESPONSABLE RIMI / IMPUESTOS'],
      ['1', 'Fecha de recepción:', p.data.reception_date || ''], ['2', 'Responsable que revisa:', p.rimi_name || ''], ['3', 'Resultado de clasificación:', p.dictamen || ''], ['4', 'Fundamento / observaciones:', p.dictamen_notes || ''], [], ['', 'Ruta / carpeta de respaldo documental', p.folder_path || '']]
    const ws3 = XLSX.utils.aoa_to_sheet(rows3); ws3['!cols'] = [{ wch: 6 }, { wch: 52 }, { wch: 18 }, { wch: 36 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, ws3, '03 Documentación y envío')
    XLSX.writeFile(wb, `Anexo I - Ficha ${p.code || p.name}.xlsx`)
    toast('Ficha exportada')
  } catch (e) { handleErr(e) }
}
