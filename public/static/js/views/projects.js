import { state, api, esc, icon, money, avatar, stagesFor, stageOf, stagePill, typeOf, typeIcon, qs, setQS, emptyState, paintIcons, hexA, B, canWrite, can, handleErr, toast, ringSVG, fdate, debounce } from '../lib.js'

export default async function (root) {
  const p = qs()
  let view = p.get('view') || localStorage.getItem('rimi_proj_view') || 'cards'
  const filters = { stage: p.get('stage') || '', zone_id: p.get('zone') || '', type_id: p.get('type') || '', mine: p.get('mine') || '', q: p.get('q') || '', status: p.get('status') || '' }
  const co = state.company

  root.innerHTML = `
  <div class="page-head">
    <div><div class="eyebrow">Cartera de inversiones</div><h1>Proyectos RIMI</h1><p class="sub">Cada proyecto agrupa los bienes, obras y servicios que se evalúan, contratan y vinculan en el SGI.</p></div>
    <div class="actions">
      <div class="seg" id="view-seg">
        <button data-v="cards">${icon('layout-grid', 'i-sm')} Tarjetas</button>
        <button data-v="table">${icon('table-2', 'i-sm')} Tabla</button>
        <button data-v="board">${icon('kanban', 'i-sm')} Tablero</button>
      </div>
      ${can('projects.create') ? `<a class="btn btn-primary" href="#/projects/new">${icon('plus', 'i-sm')} Nuevo proyecto</a>` : ''}
    </div>
  </div>
  <div class="card card-pad mb-3 filter-bar">
    <div class="row row-wrap" style="gap:10px">
      <div class="search" style="max-width:300px;flex:1 1 220px">${icon('search')}<input id="f-q" class="input" style="height:38px;padding-left:40px;padding-right:12px" placeholder="Nombre o código…" value="${esc(filters.q)}"></div>
      <select class="select" id="f-zone" style="width:auto;height:38px"><option value="">Todas las zonas</option>${B().zones.filter(z => z.company_id == co).map(z => `<option value="${z.id}" ${z.id == filters.zone_id ? 'selected' : ''}>${esc(z.name)}</option>`).join('')}</select>
      <select class="select" id="f-type" style="width:auto;height:38px"><option value="">Todos los tipos</option>${B().project_types.map(t => `<option value="${t.id}" ${t.id == filters.type_id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      <select class="select" id="f-stage" style="width:auto;height:38px"><option value="">Todas las etapas</option>${stagesFor().map(s => `<option value="${s.key}" ${s.key === filters.stage ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <select class="select" id="f-status" style="width:auto;height:38px" aria-label="Estado del proyecto"><option value="">Activos e inactivos</option><option value="activo" ${filters.status === 'activo' ? 'selected' : ''}>Sólo activos</option><option value="inactivo" ${filters.status === 'inactivo' ? 'selected' : ''}>Sólo inactivos</option></select>
      <label class="check filter-check"><input type="checkbox" id="f-mine" ${filters.mine ? 'checked' : ''}> Sólo donde participo</label>
      <span class="grow"></span><span class="small muted" id="count"></span>
    </div>
  </div>
  <div id="list"></div>`

  const seg = root.querySelector('#view-seg')
  const setSeg = () => seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === view))
  setSeg()
  seg.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; view = b.dataset.v; localStorage.setItem('rimi_proj_view', view); setQS({ view }); setSeg(); load() }

  async function load() {
    const q = new URLSearchParams({ company_id: co || '' })
    for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v)
    const { projects } = await api.get('projects?' + q)
    root.querySelector('#count').textContent = `${projects.length} proyecto${projects.length === 1 ? '' : 's'}`
    const list = root.querySelector('#list')
    if (!projects.length) {
      list.innerHTML = `<div class="card">${emptyState('folder-plus', 'No hay proyectos con estos filtros', 'Creá el primer proyecto para comenzar con la Ficha de Apertura (Anexo I).', canWrite() ? `<a class="btn btn-primary" href="#/projects/new">${icon('plus', 'i-sm')} Nuevo proyecto</a>` : '')}</div>`
    } else if (view === 'table') list.innerHTML = table(projects)
    else if (view === 'board') list.innerHTML = board(projects)
    else list.innerHTML = `<div class="grid g-3">${projects.map(card).join('')}</div>`
    paintIcons(list)
    if (view === 'board') { bindBoard(list); list.querySelectorAll('[data-bscroll]').forEach(b => b.onclick = () => list.querySelector('.kanban-proj').scrollBy({ left: Number(b.dataset.bscroll) * 560, behavior: 'smooth' })) }
    root.querySelector('#f-stage').classList.toggle('hidden', view === 'board')
  }

  const reload = () => { setQS({ stage: filters.stage, zone: filters.zone_id, type: filters.type_id, mine: filters.mine, q: filters.q, status: filters.status }); load().catch(handleErr) }
  root.querySelector('#f-zone').onchange = (e) => { filters.zone_id = e.target.value; reload() }
  root.querySelector('#f-type').onchange = (e) => { filters.type_id = e.target.value; reload() }
  root.querySelector('#f-stage').onchange = (e) => { filters.stage = e.target.value; reload() }
  root.querySelector('#f-mine').onchange = (e) => { filters.mine = e.target.checked ? '1' : ''; reload() }
  root.querySelector('#f-status').onchange = (e) => { filters.status = e.target.value; reload() }
  root.querySelector('#f-q').oninput = debounce((e) => { filters.q = e.target.value.trim(); reload() }, 300)
  await load()
}

function card(p) {
  const s = stageOf(p.stage_key)
  const chk = p.chk_total ? p.chk_done / p.chk_total : 0
  return `<a class="card p-card" href="#/projects/${p.id}" style="--accent:${p.type_color || '#4F8226'}">
    <div class="row" style="align-items:flex-start">${typeIcon(p)}<div class="grow"><div class="xs mono muted">${esc(p.code || '')}</div><h3>${esc(p.name)}</h3></div></div>
    <div class="meta"><span>${icon('map-pin', 'i-xs')} ${esc(p.zone_name || '—')}</span>${p.farm_name ? `<span>${icon('trees', 'i-xs')} ${esc(p.farm_name)}</span>` : ''}<span>${icon('tag', 'i-xs')} ${esc(p.type_name || '—')}</span></div>
    <div class="row between"><div><div class="xs muted bold" style="text-transform:uppercase;letter-spacing:.08em">Presupuesto</div><div class="amount">${money(p.budget || p.inv_total, p.currency)}</div></div>
    <div class="row" style="gap:6px" title="Checklist documental ${p.chk_done}/${p.chk_total}">${ringSVG(chk, '#4F8226', 38)}<span class="xs muted bold">${Math.round(chk * 100)}%<br>docs</span></div></div>
    <div class="row between">${stagePill(p.stage_key)}${p.status === 'inactivo' ? '<span class="badge rose">Inactivo</span>' : ''}${p.dictamen ? `<span class="badge ${p.dictamen.includes('elegible') && !p.dictamen.startsWith('No') ? 'green' : p.dictamen.startsWith('No') ? 'rose' : 'sun'}">${esc(p.dictamen)}</span>` : '<span class="badge">Sin dictamen</span>'}</div>
    <div class="row between" style="border-top:1px solid var(--line-2);padding-top:12px">
      <div class="row" style="gap:8px">${avatar(p.responsible_name || '?', p.responsible_color, 'sm')}<span class="xs"><span class="muted">Responsable</span><br><b class="ink">${esc(p.responsible_name || 'Sin asignar')}</b></span></div>
      <div class="row xs muted" style="gap:10px"><span title="Inversiones">${icon('package', 'i-xs')} ${p.inv_count}</span><span title="Tareas abiertas" style="${p.overdue_tasks ? 'color:var(--rose-600);font-weight:800' : ''}">${icon('list-checks', 'i-xs')} ${p.open_tasks}</span><span title="Documentos">${icon('paperclip', 'i-xs')} ${p.doc_count}</span></div>
    </div>
  </a>`
}

function table(ps) {
  const total = ps.reduce((a, p) => a + (p.budget || p.inv_total || 0), 0)
  return `<div class="card"><div class="table-wrap"><table class="table">
    <thead><tr><th>Proyecto</th><th>Zona / finca</th><th>Tipo</th><th>Etapa</th><th>Dictamen</th><th>Responsable</th><th class="num">Ítems</th><th class="num">Presupuesto</th><th>Puesta en marcha</th></tr></thead>
    <tbody>${ps.map(p => `<tr class="clickable" onclick="location.hash='#/projects/${p.id}'">
      <td><div class="cell-title">${esc(p.name)}</div><div class="cell-sub mono">${esc(p.code || '')}</div></td>
      <td><div>${esc(p.zone_name || '—')}</div><div class="cell-sub">${esc(p.farm_name || '')}</div></td>
      <td><span class="row" style="gap:6px;color:${p.type_color}">${icon(p.type_icon || 'folder', 'i-sm')}<span style="color:var(--text)">${esc(p.type_name || '—')}</span></span></td>
      <td>${stagePill(p.stage_key)} ${p.status === 'inactivo' ? '<span class="badge rose">Inactivo</span>' : ''}</td><td>${p.dictamen ? esc(p.dictamen) : '<span class="muted">—</span>'}</td>
      <td><div class="row" style="gap:8px">${avatar(p.responsible_name || '?', p.responsible_color, 'xs')}${esc(p.responsible_name || '—')}</div></td>
      <td class="num">${p.inv_count}</td><td class="num bold ink">${money(p.budget || p.inv_total, p.currency)}</td><td>${fdate(p.startup_est_date)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="7">Total (${ps.length})</td><td class="num">${money(total)}</td><td></td></tr></tfoot>
  </table></div></div>`
}

function board(ps) {
  const stages = stagesFor()
  return `<div class="board-tools"><span class="small muted">${icon('columns-3', 'i-xs')} ${stages.length} etapas · las vacías se muestran compactas · arrastrá una tarjeta para moverla</span><span class="grow"></span><button class="btn btn-icon btn-sm" data-bscroll="-1" aria-label="Etapas anteriores">${icon('chevron-left', 'i-sm')}</button><button class="btn btn-icon btn-sm" data-bscroll="1" aria-label="Etapas siguientes">${icon('chevron-right', 'i-sm')}</button></div><div class="board-shell"><div class="kanban kanban-proj">${stages.map(s => {
    const items = ps.filter(p => p.stage_key === s.key)
    return `<div class="k-col ${items.length ? '' : 'is-empty'}" style="--col:${s.color}"><div class="k-col-head" title="${esc(s.name)}"><span style="color:${s.color}">${icon(s.icon, 'i-sm')}</span><span class="kh-t">${esc(s.name)}</span><span class="n">${items.length}</span></div>
      <div class="k-list" data-stage="${s.key}">${items.length ? '' : `<div class="drop-hint">${icon('arrow-down-to-line', 'i-sm')}<br>Soltá un proyecto acá</div>`}${items.map(p => `<div class="k-card" data-id="${p.id}"><div class="row" style="gap:8px;align-items:flex-start">${typeIcon(p, 28)}<div class="grow"><div class="t">${esc(p.name)}</div><div class="p">${icon('map-pin', 'i-xs')} ${esc(p.zone_name || '—')}${p.farm_name ? ' · ' + esc(p.farm_name) : ''}</div><div class="k-code mono">${esc(p.code || '')}</div></div></div>
        <div class="f">${avatar(p.responsible_name || '?', p.responsible_color, 'xs')}<span class="xs bold ink grow">${money(p.budget || p.inv_total, p.currency, true)}</span>${p.overdue_tasks ? `<span class="badge rose">${p.overdue_tasks} venc.</span>` : ''}</div></div>`).join('')}</div></div>`
  }).join('')}</div></div>`
}

function bindBoard(list) {
  list.querySelectorAll('.k-card').forEach(c => c.addEventListener('click', () => { if (!c.classList.contains('dragging')) location.hash = `#/projects/${c.dataset.id}` }))
  if (!window.Sortable || !(can('projects.stage') || canWrite())) return
  list.querySelectorAll('.k-list').forEach(col => new Sortable(col, {
    group: 'projects', animation: 180, ghostClass: 'sortable-ghost', filter: '.drop-hint',
    onStart: (e) => e.item.classList.add('dragging'),
    onEnd: async (e) => {
      setTimeout(() => e.item.classList.remove('dragging'), 50)
      if (e.from === e.to) return
      const id = e.item.dataset.id, stage_key = e.to.dataset.stage
      try {
        await moveStage(id, stage_key)
      } catch (err) { e.from.insertBefore(e.item, e.from.children[e.oldIndex] || null) }
    }
  }))
}

export async function moveStage(id, stage_key, force = false) {
  try {
    const r = await api.post(`projects/${id}/stage`, { stage_key, force })
    toast(`Etapa actualizada${r.tasks_created ? ` · ${r.tasks_created} tareas generadas` : ''}`)
    window.__refreshTaskCount && window.__refreshTaskCount()
    return r
  } catch (e) {
    if (e.status === 422 && e.data?.warnings) {
      const { confirmDialog } = await import('../lib.js')
      const ok = await confirmDialog({ title: 'Faltan requisitos del procedimiento', message: `<ul style="padding-left:18px;margin:0">${e.data.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul><p class="mt-2">¿Querés avanzar igualmente? Quedará registrado como avance forzado.</p>`, confirm: 'Avanzar igual', danger: true })
      if (ok) return moveStage(id, stage_key, true)
      throw e
    }
    handleErr(e); throw e
  }
}
