import { api, esc, icon, paintIcons, MONTHS_FULL, todayISO, qs, setQS, modal, roleOf, fdate, emptyState, hexA } from '../lib.js'

const KIND = {
  task: { label: 'Tareas', color: '#0A88C9' },
  purchase: { label: 'Compras', color: '#0A6FA6' },
  invoice: { label: 'Facturas', color: '#A16207' },
  startup: { label: 'Puestas en marcha', color: '#E0A100' },
  recurring: { label: 'Agenda del procedimiento', color: '#00322B' }
}

export default async function (root) {
  const t = new Date()
  let y = Number(qs().get('y')) || t.getFullYear(), m = qs().get('m') ? Number(qs().get('m')) : t.getMonth()
  const hidden = new Set()
  let view = 'month'

  async function render() {
    const first = new Date(y, m, 1), startDow = (first.getDay() + 6) % 7
    const gridStart = new Date(y, m, 1 - startDow)
    const gridEnd = new Date(gridStart); gridEnd.setDate(gridEnd.getDate() + 41)
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const { events } = await api.get(`calendar?from=${iso(gridStart)}&to=${iso(gridEnd)}`)
    const ev = events.filter(e => !hidden.has(e.kind))
    const today = todayISO()
    const monthEv = ev.filter(e => e.date.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`))

    root.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Plazos y vencimientos</div><h1>Agenda RIMI</h1><p class="sub">Tareas, compras, facturas, puestas en marcha y el calendario mensual del procedimiento.</p>
      <ol class="month-track mt-2" aria-label="Ciclo mensual del procedimiento">${[['9', 'Registro ERP'], ['10–15', 'IVA Compras'], ['18', 'Correcciones'], ['19', 'Validación RIMI']].map(([d, l]) => `<li><b>Día ${d}</b><span>${l}</span></li>`).join('')}</ol></div>
      <div class="actions"><div class="seg"><button data-v="month" class="${view === 'month' ? 'active' : ''}">${icon('calendar-days', 'i-sm')} Mes</button><button data-v="agenda" class="${view === 'agenda' ? 'active' : ''}">${icon('list', 'i-sm')} Agenda</button></div></div></div>
    <div class="card">
      <div class="card-head" style="flex-wrap:wrap">
        <button class="btn btn-icon btn-sm" id="prev" aria-label="Mes anterior">${icon('chevron-left', 'i-sm')}</button>
        <h2 style="min-width:200px;text-align:center">${MONTHS_FULL[m]} ${y}</h2>
        <button class="btn btn-icon btn-sm" id="next" aria-label="Mes siguiente">${icon('chevron-right', 'i-sm')}</button>
        <button class="btn btn-sm" id="today">Hoy</button>
        <div class="right row row-wrap" style="gap:6px"><span class="xs bold muted" style="margin-right:2px">Filtrar:</span>${Object.entries(KIND).map(([k, v]) => `<button type="button" class="cal-legend-chip ${hidden.has(k) ? 'off' : ''}" data-k="${k}" aria-pressed="${!hidden.has(k)}" title="Mostrar / ocultar"><span class="cb" style="--c:${v.color}">${icon('check', 'i-xs')}</span>${v.label}</button>`).join('')}</div>
      </div>
      ${view === 'month' ? `<div class="cal">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
        ${Array.from({ length: Math.ceil((startDow + new Date(y, m + 1, 0).getDate()) / 7) * 7 }, (_, i) => {
          const d = new Date(gridStart); d.setDate(d.getDate() + i)
          const ds = iso(d), es = ev.filter(e => e.date === ds)
          const cls = [d.getMonth() !== m ? 'other' : '', ds === today ? 'today' : '', d.getDay() % 6 === 0 ? 'weekend' : ''].join(' ')
          return `<div class="cal-day ${cls}"><span class="dn">${d.getDate()}</span>${ds === today ? '<span class="today-tag">Hoy</span>' : ''}${es.slice(0, 3).map((e, j) => { const c = e.color || KIND[e.kind].color; return `<div class="cal-ev" data-ev="${ds}|${j}" style="background:${hexA(c, .12)};border-color:${c};" title="${esc(e.title)}">${esc(e.title)}</div>` }).join('')}${es.length > 3 ? `<div class="cal-more" data-day="${ds}">+${es.length - 3} más</div>` : ''}</div>`
        }).join('')}</div>`
        : `<div class="list">${monthEv.length ? monthEv.map((e, j) => { const c = e.color || KIND[e.kind].color; return `<div class="list-item clickable" data-ev="${e.date}|${ev.filter(x => x.date === e.date).indexOf(e)}"><div style="width:54px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--ink);line-height:1">${Number(e.date.slice(8))}</div><div class="xs muted">${['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][new Date(e.date + 'T12:00').getDay()]}</div></div><span style="width:4px;align-self:stretch;border-radius:4px;background:${c}"></span><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${esc(e.sub || '')}${e.who ? ' · ' + esc(e.who) : ''}</div></div><span class="badge" style="background:${hexA(c, .12)};color:${c}">${KIND[e.kind].label}</span></div>` }).join('') : emptyState('calendar', 'Sin eventos este mes')}</div>`}
    </div>`
    paintIcons(root)
    root.querySelector('#prev').onclick = () => { m--; if (m < 0) { m = 11; y-- } setQS({ y, m }); render() }
    root.querySelector('#next').onclick = () => { m++; if (m > 11) { m = 0; y++ } setQS({ y, m }); render() }
    root.querySelector('#today').onclick = () => { y = t.getFullYear(); m = t.getMonth(); setQS({ y: null, m: null }); render() }
    root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; render() })
    root.querySelectorAll('[data-k]').forEach(c => c.onclick = () => { hidden.has(c.dataset.k) ? hidden.delete(c.dataset.k) : hidden.add(c.dataset.k); render() })
    root.querySelectorAll('[data-ev]').forEach(el => el.onclick = () => { const [d, j] = el.dataset.ev.split('|'); showEvent(ev.filter(e => e.date === d)[j]) })
    root.querySelectorAll('[data-day]').forEach(el => el.onclick = () => showDay(el.dataset.day, ev.filter(e => e.date === el.dataset.day)))
  }

  function showEvent(e) {
    if (!e) return
    if (e.link) { location.hash = e.link; return }
    modal({ title: esc(e.title), icon: 'calendar-clock', size: 'sm', subtitle: `${fdate(e.date)} · ${esc(e.sub || '')}`,
      body: `<p>${esc(e.description || '')}</p>${e.role ? `<div class="mt-2"><span class="badge green">${esc(roleOf(e.role).name)}</span></div>` : ''}`, foot: '<button class="btn" data-close>Cerrar</button>' })
  }
  function showDay(d, es) {
    const mm = modal({ title: fdate(d), icon: 'calendar-days', body: `<div class="list">${es.map((e, j) => `<div class="list-item clickable" data-j="${j}" style="padding:10px 4px"><span style="width:4px;align-self:stretch;border-radius:4px;background:${e.color || KIND[e.kind].color}"></span><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${esc(e.sub || '')}</div></div></div>`).join('')}</div>`, foot: '<button class="btn" data-close>Cerrar</button>' })
    mm.$$('[data-j]').forEach(x => x.onclick = () => { mm.close(); showEvent(es[x.dataset.j]) })
  }
  await render()
}
