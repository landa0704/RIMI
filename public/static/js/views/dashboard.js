import { state, api, esc, icon, money, num, avatar, ago, stagesFor, stageOf, dueBadge, fdate, daysUntil, hexA, emptyState, B, typeIcon, stagePill } from '../lib.js'

export default async function (root) {
  const d = await api.get('dashboard')
  const u = state.user
  const t = d.totals || {}
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  const start = daysUntil(d.settings.program_start)
  const stages = stagesFor('project')
  const byStage = Object.fromEntries(d.by_stage.map(s => [s.stage_key, s]))
  const maxStage = Math.max(1, ...d.by_stage.map(s => s.n))
  const eligible = t.eligible_amount || 0
  const pctElig = t.budget ? Math.round(eligible / t.budget * 100) : 0

  root.innerHTML = `
  <section class="hero" id="hero-section">
    <div class="hero-content">
      <div class="eyebrow">${esc(B().settings.group_name)} · Régimen RIMI</div>
      <h1>${greet}, ${esc(u.name.split(' ')[0])}.</h1>
      <p>${start > 0 ? `Faltan <b style="color:#fff">${start} días</b> para el arranque operativo del 1 de diciembre. Priorizá completar las fichas de apertura y el desglose de inversiones.` : 'El programa está en marcha. Seguimiento de fichas, dictámenes, contrataciones y puestas en marcha en un solo lugar.'}</p>
      <div class="hero-stats">
        <div class="hero-stat"><div class="v">${num(t.projects)}</div><div class="l">Proyectos activos</div></div>
        <div class="hero-stat"><div class="v">${num(t.investments)}</div><div class="l">Inversiones / bienes</div></div>
        <div class="hero-stat accent"><div class="v">${money(t.budget, 'USD', true)}</div><div class="l">Presupuesto total</div></div>
        <div class="hero-stat"><div class="v">${pctElig}%</div><div class="l">Dictaminado elegible</div></div>
      </div>
    </div>
    <div class="hero-img" style="background-image:url('/static/img/hero.webp')"></div>
  </section>

  <section class="grid g-4 mt-3" id="kpi-section">
    <a class="card kpi" href="#/tasks">
      <div class="lbl">Mis tareas abiertas</div><div class="val">${d.my_tasks.length}</div>
      <div class="foot">${d.my_tasks.filter(x => x.due_date && daysUntil(x.due_date) < 0).length ? `<span class="badge rose">${d.my_tasks.filter(x => x.due_date && daysUntil(x.due_date) < 0).length} vencidas</span>` : '<span class="badge green">Al día</span>'}</div>
      <span class="ico tone-sky">${icon('list-checks')}</span>
    </a>
    <a class="card kpi" href="#/tasks?view=all&status=overdue">
      <div class="lbl">Vencidas · equipo</div><div class="val" style="color:${d.overdue ? 'var(--rose-600)' : 'inherit'}">${d.overdue}</div>
      <div class="foot">${d.upcoming} vencen en los próximos 7 días</div>
      <span class="ico tone-rose">${icon('alarm-clock')}</span>
    </a>
    <a class="card kpi" href="#/reports">
      <div class="lbl">Monto elegible</div><div class="val">${money(eligible, 'USD', true)}</div>
      <div class="foot"><div class="progress sm grow"><span style="width:${pctElig}%"></span></div>${pctElig}%</div>
      <span class="ico tone-green">${icon('badge-check')}</span>
    </a>
    <a class="card kpi" href="#/documents">
      <div class="lbl">Documentos en legajo</div><div class="val">${num(t.documents)}</div>
      <div class="foot">Estructura Anexo II · 11 carpetas</div>
      <span class="ico tone-sun">${icon('folder-open')}</span>
    </a>
  </section>

  <section class="grid g-main mt-3">
    <div class="stack">
      <article class="card" id="pipeline-card">
        <div class="card-head"><span class="kpi-ico tone-dark" style="width:32px;height:32px;border-radius:10px;display:grid;place-items:center">${icon('git-branch', 'i-sm')}</span><div><h3>Embudo del procedimiento</h3><div class="sub">Proyectos por etapa · de la ficha al SGI</div></div><div class="right"><a class="btn btn-sm" href="#/projects?view=board">${icon('kanban', 'i-sm')} Tablero</a></div></div>
        <div class="card-body">
          ${stages.filter(s => byStage[s.key]?.n).map(s => {
            const v = byStage[s.key]; const n = v?.n || 0
            return `<a class="funnel-row" href="#/projects?stage=${s.key}" style="color:inherit">
              <div class="row" style="gap:8px"><span style="width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:${hexA(s.color, .14)};color:${s.color}">${icon(s.icon, 'i-xs')}</span><span class="small bold ink truncate">${esc(s.name)}</span></div>
              <div class="funnel-bar">${n ? `<span style="width:${Math.max(12, n / maxStage * 100)}%;background:${s.color}">${n} proy.</span>` : '<i class="fz">0</i>'}</div>
              <div class="small muted num" style="text-align:right">${v ? money(v.amount, 'USD', true) : '—'}</div>
            </a>`
          }).join('')}
          ${(() => { const empty = stages.filter(s => !byStage[s.key]?.n); return empty.length ? `<div class="funnel-empty"><span class="xs bold muted">Sin proyectos todavía en ${empty.length} etapas</span><div class="funnel-empty-list">${empty.map(s => `<span class="mchip" title="${esc(s.name)}">${icon(s.icon, 'i-xs')} ${esc(s.short_name || s.name)}</span>`).join('')}</div></div>` : '' })()}
        </div>
      </article>

      <div class="grid g-2">
        <article class="card">
          <div class="card-head"><h3>Por tipo de proyecto</h3><div class="right"><span class="sub">Presupuesto</span></div></div>
          <div class="card-body" style="height:260px;position:relative"><canvas id="chart-type"></canvas></div>
        </article>
        <article class="card">
          <div class="card-head"><h3>Elegibilidad de inversiones</h3><div class="right"><span class="sub">Por monto</span></div></div>
          <div class="card-body" style="height:260px;position:relative"><canvas id="chart-elig"></canvas></div>
        </article>
      </div>

      <article class="card">
        <div class="card-head"><h3>Próximas puestas en marcha</h3><div class="sub">Hecho generador del beneficio</div><div class="right"><a class="btn btn-ghost btn-sm" href="#/calendar">Ver agenda ${icon('arrow-right', 'i-sm')}</a></div></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Proyecto</th><th>Etapa</th><th>1ª compra</th><th>Puesta en marcha</th><th class="num">Faltan</th></tr></thead>
          <tbody>${d.deadlines.length ? d.deadlines.map(p => {
            const n = daysUntil(p.startup_est_date)
            return `<tr class="clickable" onclick="location.hash='#/projects/${p.id}'"><td><div class="row">${typeIcon(p, 32)}<div><div class="cell-title">${esc(p.name)}</div><div class="cell-sub mono">${esc(p.code || '')}</div></div></div></td>
            <td>${stagePill(p.stage_key)}</td><td>${fdate(p.first_purchase_date)}</td><td class="bold ink">${fdate(p.startup_est_date)}</td>
            <td class="num">${n === null ? '—' : `<span class="badge ${n < 30 ? 'rose' : n < 90 ? 'sun' : 'green'}">${n} d</span>`}</td></tr>`
          }).join('') : `<tr><td colspan="5">${emptyState('rocket', 'Sin fechas cargadas')}</td></tr>`}</tbody></table></div>
      </article>
    </div>

    <aside class="stack">
      <article class="card">
        <div class="card-head"><h3>Mis pendientes</h3><div class="right"><a class="btn btn-ghost btn-sm" href="#/tasks">Ver todas</a></div></div>
        <div class="list">${d.my_tasks.length ? d.my_tasks.map(k => `
          <a class="list-item" href="#/tasks?open=${k.id}"><span class="prio ${k.priority}"></span><div class="grow"><div class="t truncate">${esc(k.title)}</div><div class="s truncate">${esc(k.project_name)}${k.inv_code ? ' · ' + esc(k.inv_code) : ''}</div></div>${dueBadge(k.due_date)}</a>`).join('')
          : `<div class="empty-compact"><span class="ec-ico">${icon('check-check', 'i-sm')}</span><div><b class="ink">¡Nada pendiente!</b><div class="xs muted">No tenés tareas asignadas abiertas.</div></div></div>`}
        </div>
      </article>

      <article class="card">
        <div class="card-head"><h3>Inversión por zona</h3></div>
        <div class="card-body stack" style="gap:14px">${d.by_zone.map(z => {
          const max = Math.max(1, ...d.by_zone.map(x => x.amount))
          return `<a href="#/explorer?zone=${z.id}" style="color:inherit"><div class="row between small"><span class="bold ink row" style="gap:6px">${icon('map-pin', 'i-xs')} ${esc(z.name)}</span><span class="muted">${z.n} proy. · <b class="ink">${money(z.amount, 'USD', true)}</b></span></div><div class="progress mt-1"><span style="width:${z.amount / max * 100}%;background:var(--brand-600)"></span></div></a>`
        }).join('') || '<p class="muted small">Sin zonas</p>'}</div>
      </article>

      <article class="card">
        <div class="card-head"><h3>Actividad reciente</h3></div>
        <div class="feed">${d.activity.map(a => `
          <div class="feed-item">${avatar(a.user_name || 'Sistema', a.avatar_color, 'sm')}<div class="grow"><div class="txt"><b>${esc(a.user_name || 'Sistema')}</b> ${esc(a.summary.charAt(0).toLowerCase() + a.summary.slice(1))}</div><div class="when"><a href="#/projects/${a.project_id}">${esc(a.project_name || '')}</a> · ${ago(a.created_at)}</div></div></div>`).join('') || '<p class="muted small">Sin actividad</p>'}
        </div>
      </article>
    </aside>
  </section>`

  // Gráficos
  if (window.Chart) {
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif"
    Chart.defaults.color = '#5E6E6A'
    const ct = document.getElementById('chart-type')
    if (ct && d.by_type.length) new Chart(ct, {
      type: 'doughnut',
      data: { labels: d.by_type.map(x => x.name), datasets: [{ data: d.by_type.map(x => x.amount), backgroundColor: d.by_type.map(x => x.color), borderWidth: 3, borderColor: '#fff', hoverOffset: 8 }] },
      options: { maintainAspectRatio: false, cutout: '68%', layout: { padding: 4 }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, boxWidth: 8, font: { weight: 600 } } }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${money(c.raw)}` } } } }
    })
    const ce = document.getElementById('chart-elig')
    const order = ['General elegible', 'Específica elegible', 'Pendiente de validación', 'No elegible']
    const colors = { 'General elegible': '#4F8226', 'Específica elegible': '#0A88C9', 'Pendiente de validación': '#E0A100', 'No elegible': '#BE123C' }
    const rows = order.map(o => d.inv_by_eligibility.find(x => x.eligibility === o) || { eligibility: o, n: 0, amount: 0 })
    if (ce) new Chart(ce, {
      type: 'bar',
      data: { labels: rows.map(r => r.eligibility.replace(' de validación', '')), datasets: [{ data: rows.map(r => r.amount), backgroundColor: rows.map(r => colors[r.eligibility]), borderRadius: 8, maxBarThickness: 30 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, layout: { padding: { right: 8 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${money(c.raw)} · ${rows[c.dataIndex].n} ítems` } } }, scales: { x: { ticks: { callback: (v) => money(v, 'USD', true), maxTicksLimit: 5 }, grid: { color: '#EDF1EB' }, border: { display: false } }, y: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: 700 }, color: '#22312D' } } } }
    })
  }
}
