import { esc, icon, paintIcons, B, stagesFor, roleOf, hexA, api } from '../lib.js'

export default async function (root) {
  let tasks = []
  try { tasks = (await api.get('admin/stage-tasks')).stage_tasks } catch { }
  const stages = stagesFor('project')
  const roles = B().roles
  let recurring = []
  try { recurring = (await api.get('admin/recurring')).recurring } catch { }

  root.innerHTML = `
  <div class="page-head"><div><div class="eyebrow">PE-SF · Gestión de inversiones RIMI</div><h1>Procedimiento interactivo</h1>
    <p class="sub">Metodología, responsabilidades y controles de las operaciones RIMI. Cada etapa del portal replica un paso del procedimiento y genera sus tareas automáticamente.</p></div></div>

  <section class="hero" style="min-height:180px;margin-bottom:22px">
    <div class="hero-content" style="max-width:70%"><div class="eyebrow">Qué es el RIMI</div>
      <h1 style="font-size:24px">Régimen de Incentivo para Medianas Inversiones</h1>
      <p>Fomenta las inversiones productivas de MiPyMEs con amortización acelerada en Ganancias y devolución de créditos fiscales de IVA. Los beneficios proceden con la <b style="color:#fff">puesta en marcha</b>. Se tramitan en el <b style="color:#fff">SGI</b> (Sistema de Gestión de Inversiones de ARCA).</p></div>
    <div class="hero-img" style="background-image:url('/static/img/hero.webp');width:38%"></div>
  </section>

  <div class="grid g-3 mb-3">${roles.map(r => `<div class="card card-pad"><div class="row"><span style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:${hexA(r.color, .14)};color:${r.color}">${icon(r.icon, 'i-sm')}</span><div class="grow"><div class="bold ink">${esc(r.name)}</div><div class="xs muted">${esc(r.description || '')}</div></div></div></div>`).join('')}</div>

  <article class="card mb-3"><div class="card-head"><h3>${icon('git-branch', 'i-sm')} Flujo de etapas y pasos</h3></div><div class="card-body">
    ${stages.map((s, i) => `<div class="stage-card"><span class="stage-num" style="background:${s.color}">${icon(s.icon, 'i-sm')}</span>
      <div class="grow"><div class="row row-wrap" style="gap:8px"><span class="xs bold muted" style="text-transform:uppercase;letter-spacing:.1em">${esc(s.phase || '')} · Etapa ${i + 1}</span>${s.sla_days ? `<span class="badge sun">${icon('clock', 'i-xs')} ${s.sla_days} días hábiles</span>` : ''}${s.role_key ? `<span class="badge green">${esc(roleOf(s.role_key).name)}</span>` : ''}</div>
      <h3 class="mt-1">${esc(s.name)}</h3><p class="small muted mt-1">${esc(s.description || '')}</p>
      ${tasks.filter(t => t.entity === 'project' && t.stage_key === s.key && t.active).map(t => `<div class="auto-task mt-2">${icon('sparkles', 'i-xs')}<span class="grow"><b class="ink">${esc(t.title)}</b> <span class="muted">· ${esc(roleOf(t.role_key).name)} · ${t.due_days} días háb.</span></span><span class="xs mono muted">${esc(t.procedure_ref || '')}</span></div>`).join('')}</div></div>`).join('')}
  </div></article>

  <div class="grid g-2">
    <article class="card"><div class="card-head"><h3>${icon('calendar-range', 'i-sm')} Calendario mensual de control</h3></div>
      <div class="list">${recurring.map(r => `<div class="list-item"><span class="badge" style="background:${hexA(r.color, .12)};color:${r.color};min-width:70px;justify-content:center">${r.day_to && r.day_to !== r.day_from ? `Días ${r.day_from}-${r.day_to}` : `Día ${r.day_from}`}</span><div class="grow"><div class="t small">${esc(r.title)}</div><div class="s">${esc(r.description || '')}</div></div></div>`).join('')}</div></article>
    <article class="card"><div class="card-head"><h3>${icon('shield-alert', 'i-sm')} Controles clave</h3></div><div class="card-body">
      <ul class="steps-v">
        <li><b class="ink">Facturas apócrifas ARCA</b><div class="small muted">Compras, Administración y Tesorería controlan al proveedor antes de contratar, registrar y pagar.</div></li>
        <li><b class="ink">Facturación desagregada</b><div class="small muted">Bienes, obra, instalación, fletes y servicios por separado; marca, modelo, serie, bien nuevo, IVA discriminado.</div></li>
        <li><b class="ink">Avance de obra &lt; 30%</b><div class="small muted">Acreditar con facturas, informe técnico con firma certificada o contrato de locación.</div></li>
        <li><b class="ink">Puesta en marcha</b><div class="small muted">Hecho generador del beneficio: acta, informe técnico firmado y aviso a RIMI en 24 h.</div></li>
        <li><b class="ink">Bajas y permanencia</b><div class="small muted">Venta, reemplazo, siniestro o baja: informar en 2 días hábiles con acta e informe.</div></li>
        <li><b class="ink">Conciliación ERP · IVA · SGI</b><div class="small muted">Mensual tras el cierre de IVA; antes de Ganancias se verifica SGI vs. DJ.</div></li>
      </ul></div></article>
  </div>`
  paintIcons(root)
}
