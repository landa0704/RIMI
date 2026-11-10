import { state, api, esc, icon, paintIcons, money, num, fdate, stagePill, eligBadge, downloadBlob, toCSV, ensureXLSX, handleErr, toast, B, daysUntil, emptyState } from '../lib.js'

export default async function (root) {
  let tab = 'status'
  const [sum, invs] = await Promise.all([api.get('reports/summary'), api.get('reports/investments')])
  const co = state.company
  const projects = sum.projects.filter(p => p.company_id == co)
  const investments = invs.investments.filter(i => projects.some(p => p.id === i.project_id))

  function render() {
    root.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Control y monitoreo · §5.4 / §5.5</div><h1>Reportes y tablero</h1><p class="sub">Reporte mensual de estado por inversión, tablero trimestral de monto mínimo y exportaciones para Dirección / Gerencias.</p></div>
      <div class="actions"><button class="btn" id="x-csv">${icon('file-down', 'i-sm')} CSV inversiones</button><button class="btn btn-primary" id="x-xlsx">${icon('file-spreadsheet', 'i-sm')} Excel completo</button><button class="btn btn-icon" onclick="print()" title="Imprimir">${icon('printer', 'i-sm')}</button></div></div>
    <nav class="tabs">${[['status', 'Estado por proyecto', 'clipboard-list'], ['threshold', 'Monto mínimo', 'gauge'], ['ncm', 'Inversiones y NCM', 'barcode'], ['dates', 'Fechas críticas', 'calendar-clock']].map(([k, l, ic]) => `<button class="tab ${tab === k ? 'active' : ''}" data-t="${k}">${icon(ic, 'i-sm')} ${l}</button>`).join('')}</nav>
    <div id="rb"></div>`
    paintIcons(root)
    root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; render() })
    root.querySelector('#x-csv').onclick = () => downloadBlob(toCSV(investments, [
      { label: 'Proyecto', key: 'project_code' }, { label: 'Nombre proyecto', key: 'project_name' }, { label: 'Zona', key: 'zone_name' }, { label: 'Finca', key: 'farm_name' }, { label: 'Ítem', key: 'code' },
      { label: 'Tipo', key: 'component_type' }, { label: 'Descripción', key: 'description' }, { label: 'Marca/modelo', key: 'brand_model' }, { label: 'Cantidad', key: 'quantity' }, { label: 'Unidad', key: 'unit' },
      { label: 'NCM', key: 'ncm' }, { label: 'Estado NCM', key: 'ncm_status' }, { label: 'Proveedor', key: 'supplier' }, { label: 'Moneda', key: 'currency' }, { label: 'Unitario', key: 'unit_price' }, { label: 'Total', key: 'total' },
      { label: 'Elegibilidad', key: 'eligibility' }, { label: 'BK/BIT', key: 'bk_bit' }, { label: 'Estado', key: 'stage_key' }, { label: 'Compra', key: 'purchase_date' }, { label: 'Factura', key: 'invoice_date' }, { label: 'Puesta en marcha', key: 'startup_date' }
    ]), `RIMI-inversiones-${new Date().toISOString().slice(0, 10)}.csv`)
    root.querySelector('#x-xlsx').onclick = exportAll
    const rb = root.querySelector('#rb')
    if (tab === 'status') status(rb); else if (tab === 'threshold') threshold(rb); else if (tab === 'ncm') ncm(rb); else dates(rb)
    paintIcons(rb)
  }

  function status(el) {
    const tot = projects.reduce((a, p) => a + (p.inv_total || p.budget || 0), 0), elig = projects.reduce((a, p) => a + p.eligible_total, 0)
    el.innerHTML = `<div class="grid g-4 mb-3">
      <div class="card kpi"><div class="lbl">Proyectos</div><div class="val">${projects.length}</div></div>
      <div class="card kpi"><div class="lbl">Presupuesto</div><div class="val" style="font-size:22px">${money(tot, 'USD', true)}</div></div>
      <div class="card kpi"><div class="lbl">Elegible dictaminado</div><div class="val" style="font-size:22px">${money(elig, 'USD', true)}</div><div class="foot">${tot ? Math.round(elig / tot * 100) : 0}%</div></div>
      <div class="card kpi"><div class="lbl">Tareas vencidas</div><div class="val" style="color:${projects.some(p => p.overdue) ? 'var(--rose-600)' : 'inherit'}">${projects.reduce((a, p) => a + p.overdue, 0)}</div></div></div>
    <div class="card"><div class="card-head"><div><h3>Reporte mensual de estado</h3><div class="sub">Se emite cerrada la carga de comprobantes y antes de la DJ de IVA · ${fdate(new Date().toISOString().slice(0, 10))}</div></div></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Proyecto</th><th>Zona</th><th>Etapa</th><th>Dictamen</th><th class="num">Ítems</th><th class="num">Pend.</th><th class="num">Presupuesto</th><th class="num">Elegible</th><th>Docs</th><th class="num">Vencidas</th><th>Responsable</th></tr></thead>
    <tbody>${projects.map(p => `<tr class="clickable" onclick="location.hash='#/projects/${p.id}'"><td><div class="cell-title">${esc(p.name)}</div><div class="cell-sub mono">${esc(p.code || '')}</div></td><td class="small">${esc(p.zone_name || '—')}</td><td>${stagePill(p.stage_key)}</td><td>${p.dictamen ? eligBadge(p.dictamen) : '<span class="muted small">—</span>'}</td>
      <td class="num">${p.inv_count}</td><td class="num">${p.pending_count ? `<span class="badge sun">${p.pending_count}</span>` : '<span class="badge">0</span>'}</td><td class="num bold">${money(p.inv_total || p.budget, p.currency)}</td><td class="num">${money(p.eligible_total, p.currency)}</td>
      <td><div class="row" style="gap:6px"><div class="progress sm" style="width:60px"><span style="width:${p.chk_total ? p.chk_done / p.chk_total * 100 : 0}%"></span></div><span class="xs muted">${p.chk_done}/${p.chk_total}</span></div></td>
      <td class="num">${p.overdue ? `<span class="badge rose">${p.overdue}</span>` : '<span class="badge green">0</span>'}</td><td class="small">${esc(p.responsible_name || '—')}</td></tr>`).join('') || `<tr><td colspan="11">${emptyState('folder', 'Sin proyectos')}</td></tr>`}</tbody>
    <tfoot><tr><td colspan="6">Total</td><td class="num">${money(tot)}</td><td class="num">${money(elig)}</td><td colspan="3"></td></tr></tfoot></table></div></div>`
  }

  function threshold(el) {
    el.innerHTML = `<div class="alert info mb-3">${icon('info', 'i-sm')}<span>Tablero trimestral (§5.4 paso 2): monto mínimo acumulado por inversión y consolidado por proyecto. Riego, alta eficiencia energética, mallas antigranizo y semovientes <b>no están sujetos a monto mínimo</b>. Umbrales configurables en Administración: Micro ${money(sum.thresholds.micro)} · Pequeña ${money(sum.thresholds.pequena)} · Mediana T1 ${money(sum.thresholds.mediana1)} · Mediana T2 ${money(sum.thresholds.mediana2)}.</span></div>
      <div class="grid g-2">${projects.map(p => {
        const amt = p.eligible_total || 0, th = p.threshold
        const pct = th ? Math.min(100, amt / th * 100) : 100
        const risk = th && pct < 100
        return `<div class="card card-pad"><div class="row"><div class="grow"><div class="bold ink">${esc(p.name)}</div><div class="xs muted">${esc(p.type_name || '')} · ${esc(p.company_name)} (${esc(p.mipyme_category || '')})</div></div>${th ? (risk ? '<span class="badge rose">Riesgo de no alcanzar</span>' : '<span class="badge green">Umbral alcanzado</span>') : '<span class="badge green">Sin monto mínimo</span>'}</div>
          <div class="row between mt-3 small"><span class="muted">Acumulado elegible</span><b class="ink">${money(amt, p.currency)}</b></div>
          <div class="progress mt-1 ${risk ? (pct < 50 ? 'bad' : 'warn') : ''}" style="height:10px"><span style="width:${pct}%"></span></div>
          <div class="row between xs muted mt-1"><span>${th ? Math.round(pct) + '% del mínimo' : 'No aplica'}</span><span>${th ? 'Mínimo ' + money(th) : ''}</span></div>
          ${risk ? `<p class="xs mt-2" style="color:var(--rose-600)">${icon('triangle-alert', 'i-xs')} Faltan ${money(th - amt)} · evaluar agrupar o reprogramar compras.</p>` : ''}</div>`
      }).join('') || emptyState('gauge', 'Sin proyectos')}</div>`
  }

  function ncm(el) {
    el.innerHTML = `<div class="card"><div class="card-head"><h3>Inversiones por posición arancelaria</h3><div class="right small muted">${investments.length} ítems · ${investments.filter(i => !i.ncm).length} sin NCM</div></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Proyecto</th><th>Ítem</th><th>Descripción</th><th>NCM</th><th>Estado NCM</th><th>BK/BIT</th><th>Elegibilidad</th><th class="num">Total</th></tr></thead>
      <tbody>${investments.map(i => `<tr class="clickable" onclick="location.hash='#/projects/${i.project_id}?tab=investments&inv=${i.id}'"><td class="small mono">${esc(i.project_code || '')}</td><td class="mono bold">${esc(i.code)}</td><td><div class="cell-title">${esc(i.description)}</div><div class="cell-sub">${esc(i.supplier || '')}</div></td>
        <td class="mono">${i.ncm ? esc(i.ncm) : '<span class="badge sun">pendiente</span>'}</td><td class="small">${esc(i.ncm_status || '—')}</td><td class="small">${esc(i.bk_bit || '—')}</td><td>${eligBadge(i.eligibility)}</td><td class="num bold">${money(i.total, i.currency)}</td></tr>`).join('')}</tbody></table></div></div>`
  }

  function dates(el) {
    const rows = projects.map(p => ({ ...p, d: daysUntil(p.startup_est_date) })).sort((a, b) => (a.d ?? 9999) - (b.d ?? 9999))
    el.innerHTML = `<div class="card"><div class="card-head"><div><h3>Fechas críticas</h3><div class="sub">Monitoreo de fechas propuestas, informadas y reales de puesta en marcha (§5.2.7 paso 6).</div></div></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Proyecto</th><th>Ficha enviada</th><th>Dictamen</th><th>1ª compra est.</th><th>Puesta en marcha est.</th><th>Puesta en marcha real</th><th class="num">Días</th></tr></thead>
      <tbody>${rows.map(p => `<tr class="clickable" onclick="location.hash='#/projects/${p.id}'"><td><div class="cell-title">${esc(p.name)}</div><div class="cell-sub mono">${esc(p.code || '')}</div></td><td>${fdate(p.ficha_sent_at)}</td><td>${fdate(p.dictamen_date)}</td><td>${fdate(p.first_purchase_date)}</td><td class="bold ink">${fdate(p.startup_est_date)}</td><td>${fdate(p.startup_real_date)}</td>
        <td class="num">${p.d === null ? '—' : `<span class="badge ${p.d < 0 ? 'rose' : p.d < 60 ? 'sun' : 'green'}">${p.d} d</span>`}</td></tr>`).join('')}</tbody></table></div></div>`
  }

  async function exportAll() {
    try {
      const XLSX = await ensureXLSX()
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projects.map(p => ({ Código: p.code, Proyecto: p.name, Empresa: p.company_name, Zona: p.zone_name, Finca: p.farm_name, Tipo: p.type_name, Etapa: p.stage_key, Dictamen: p.dictamen, Ítems: p.inv_count, Presupuesto: p.inv_total || p.budget, Elegible: p.eligible_total, 'Monto mínimo': p.threshold || 'No aplica', 'Primera compra': p.first_purchase_date, 'Puesta en marcha est.': p.startup_est_date, Responsable: p.responsible_name, 'Checklist': `${p.chk_done}/${p.chk_total}`, 'Tareas vencidas': p.overdue }))), 'Proyectos')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(investments.map(i => ({ Proyecto: i.project_code, Zona: i.zone_name, Finca: i.farm_name, Ítem: i.code, Tipo: i.component_type, Descripción: i.description, 'Marca/modelo': i.brand_model, Cantidad: i.quantity, Unidad: i.unit, NCM: i.ncm || 'pendiente', 'Estado NCM': i.ncm_status, Proveedor: i.supplier, Moneda: i.currency, Unitario: i.unit_price, Total: i.total, Elegibilidad: i.eligibility, 'BK/BIT': i.bk_bit, Estado: i.stage_key, Compra: i.purchase_date, Factura: i.invoice_date, 'Puesta en marcha': i.startup_date }))), 'Inversiones')
      XLSX.writeFile(wb, `RIMI-reporte-${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast('Reporte exportado')
    } catch (e) { handleErr(e) }
  }
  render()
}
