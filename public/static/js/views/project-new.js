import { state, api, esc, icon, paintIcons, B, typeOf, hexA, toast, handleErr, money, isRimi, can, modal, fieldOptions, bindNcmMask } from '../lib.js'

export default async function (root) {
  const s = {
    step: 1, company_id: state.company, zone_id: null, farm_id: null, type_id: null,
    name: '', code: '', responsible_id: state.user.id, currency: 'USD', first_purchase_date: '', startup_est_date: '', objective: '', install_type: '',
    items: [{ component_type: 'Bien / equipo', description: '', quantity: 1, unit: 'u', unit_price: '', ncm: '' }]
  }

  const render = () => {
    root.innerHTML = `
    <div class="crumbs"><a href="#/projects">Proyectos</a>${icon('chevron-right')}<span>Nuevo proyecto</span></div>
    <div class="page-head"><div><div class="eyebrow">Ficha de apertura · Anexo I</div><h1>Alta de proyecto RIMI</h1>
      <p class="sub">Completá antes de la primera compra o contratación. Este alta no implica aprobación ni elegibilidad fiscal: la clasificación definitiva la evalúa el Responsable RIMI / Impuestos.</p></div></div>
    <div class="row mb-3"><button class="btn btn-sm" id="from-existing">${icon('copy', 'i-sm')} Partir de un proyecto existente</button></div>
    <div class="steps">
      ${[['Ubicación y tipo', 'map-pin'], ['Identificación', 'id-card'], ['Componentes', 'boxes']].map(([l], i) => `<div class="st ${s.step === i + 1 ? 'active' : s.step > i + 1 ? 'done' : ''}"><span class="n">${s.step > i + 1 ? icon('check', 'i-xs') : i + 1}</span>${l}</div>`).join('')}
    </div>
    <div class="grid g-main">
      <div class="card"><div class="card-body" id="step-body" style="padding:24px"></div>
        <div class="card-foot"><button class="btn" id="back" ${s.step === 1 ? 'disabled' : ''}>${icon('arrow-left', 'i-sm')} Atrás</button><span class="grow"></span>
        ${s.step < 3 ? `<button class="btn btn-primary" id="next">Continuar ${icon('arrow-right', 'i-sm')}</button>` : `<button class="btn btn-accent" id="create">${icon('check', 'i-sm')} Crear proyecto</button>`}</div>
      </div>
      <aside class="stack">${summary()}</aside>
    </div>`
    const body = root.querySelector('#step-body')
    if (s.step === 1) step1(body); else if (s.step === 2) step2(body); else step3(body)
    root.querySelector('#back').onclick = () => { s.step--; render() }
    root.querySelector('#next')?.addEventListener('click', next)
    root.querySelector('#create')?.addEventListener('click', () => create(true))
    root.querySelector('#from-existing')?.addEventListener('click', pickExisting)
    paintIcons(root)
  }

  async function pickExisting() {
    try {
      const { projects } = await api.get('projects')
      if (!projects.length) return toast('Todavía no hay proyectos para partir', 'warn')
      const m = modal({
        title: 'Partir de un proyecto existente', icon: 'copy', subtitle: 'Se copian la ficha y los componentes. No se copian datos fiscales, documentos, tareas ni conversaciones.',
        body: `<div class="field"><label>Proyecto de origen <span class="req">*</span></label><select class="select" id="src">${projects.map(p => `<option value="${p.id}">${esc(p.code || '')} · ${esc(p.name)}</option>`).join('')}</select></div>`,
        foot: `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="src-ok">Continuar</button>`
      })
      m.$('#src-ok').onclick = () => {
        const src = projects.find(p => p.id == m.$('#src').value)
        m.close()
        duplicateProjectModal(src)
      }
    } catch (e) { handleErr(e) }
  }

  function summary() {
    const z = B().zones.find(z => z.id == s.zone_id), f = B().farms.find(f => f.id == s.farm_id), t = typeOf(s.type_id)
    const total = s.items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0)
    return `<div class="card"><div class="card-head"><h3>Resumen</h3></div><div class="card-body stack" style="gap:12px">
      <div class="row">${icon('building-2', 'i-sm')}<span class="muted small grow">Empresa</span><b class="small ink">${esc(B().companies.find(c => c.id == s.company_id)?.name || '—')}</b></div>
      <div class="row">${icon('map-pin', 'i-sm')}<span class="muted small grow">Zona</span><b class="small ink">${esc(z?.name || '—')}</b></div>
      <div class="row">${icon('trees', 'i-sm')}<span class="muted small grow">Finca</span><b class="small ink">${esc(f?.name || '—')}</b></div>
      <div class="row">${icon('tag', 'i-sm')}<span class="muted small grow">Tipo</span><b class="small ink">${esc(s.type_id ? t.name : '—')}</b></div>
      ${s.type_id ? `<div class="alert ${t.min_exempt ? 'success' : 'info'}" style="font-size:12px">${icon(t.min_exempt ? 'badge-check' : 'info', 'i-sm')}<span>${t.min_exempt ? 'Tipo no sujeto a monto mínimo de inversión (RG 5849).' : 'Sujeto a monto mínimo según categoría MiPyME de la empresa.'}</span></div>` : ''}
      ${s.name ? `<div class="divider" style="margin:4px 0"></div><div class="bold ink">${esc(s.name)}</div><div class="mono xs muted">${esc(s.code)}</div>` : ''}
      ${total ? `<div class="row"><span class="muted small grow">Presupuesto componentes</span><b class="ink">${money(total, s.currency)}</b></div>` : ''}
    </div></div>
    <div class="card card-pad" style="background:var(--brand-50);border-color:var(--brand-200)"><div class="row bold ink small">${icon('clock', 'i-sm')} Plazos del procedimiento</div>
      <ul class="small muted" style="padding-left:18px;margin:8px 0 0;line-height:1.7"><li>Ficha completa: <b>10 días hábiles</b></li><li>Dictamen RIMI: <b>5 días hábiles</b> (10 si es controvertido)</li><li>Imputación contable: <b>3 días hábiles</b></li></ul></div>`
  }

  function step1(body) {
    const zones = B().zones.filter(z => z.company_id == s.company_id)
    const farms = B().farms.filter(f => f.zone_id == s.zone_id)
    body.innerHTML = `
      ${B().companies.length > 1 ? `<div class="field mb-3"><label>Empresa / unidad de negocio</label><div class="option-grid">${B().companies.filter(c => c.active).map(c => `<button class="option ${c.id == s.company_id ? 'sel' : ''}" data-co="${c.id}"><span class="oi" style="background:${hexA(c.color, .15)};color:${c.color}">${icon('building-2', 'i-sm')}</span><span class="on">${esc(c.name)}</span><span class="od">${esc(c.legal_name || '')}</span></button>`).join('')}</div></div>` : ''}
      <div class="field mb-3"><label class="row between">Zona geográfica <span class="req">*</span>${can('zones.manage') ? `<button class="btn btn-ghost btn-xs" id="add-zone">${icon('plus', 'i-xs')} Nueva zona</button>` : ''}</label>
        <div class="option-grid">${zones.map(z => `<button class="option ${z.id == s.zone_id ? 'sel' : ''}" data-zone="${z.id}"><span class="oi tone-green" style="${z.color ? `background:${hexA(z.color, .15)};color:${z.color}` : ''}">${icon('map-pin', 'i-sm')}</span><span class="on">${esc(z.name)}</span><span class="od">${esc([z.locality, z.province].filter(Boolean).join(', '))}</span></button>`).join('') || '<p class="muted small">No hay zonas para esta empresa.</p>'}</div></div>
      ${s.zone_id ? `<div class="field mb-3"><label class="row between">Finca / establecimiento${can('farms.manage') ? `<button class="btn btn-ghost btn-xs" id="add-farm">${icon('plus', 'i-xs')} Nueva finca</button>` : ''}</label>
        <div class="option-grid">${farms.map(f => `<button class="option ${f.id == s.farm_id ? 'sel' : ''}" data-farm="${f.id}"><span class="oi tone-sun">${icon('trees', 'i-sm')}</span><span class="on">${esc(f.name)}</span><span class="od">${f.hectares ? f.hectares + ' ha' : esc(f.address || '')}</span></button>`).join('')}
        <button class="option ${s.farm_id === 0 ? 'sel' : ''}" data-farm="0"><span class="oi" style="background:var(--line-2);color:var(--muted)">${icon('circle-slash', 'i-sm')}</span><span class="on">Sin finca</span><span class="od">Proyecto a nivel zona</span></button></div></div>` : ''}
      <div class="field"><label>Tipo de proyecto <span class="req">*</span></label>
        <div class="option-grid">${B().project_types.filter(t => t.active).map(t => `<button class="option ${t.id == s.type_id ? 'sel' : ''}" data-type="${t.id}"><span class="oi" style="background:${hexA(t.color, .15)};color:${t.color}">${icon(t.icon, 'i-sm')}</span><span class="on">${esc(t.name)}</span><span class="od">${esc(t.description || '')}</span></button>`).join('')}</div></div>`
    body.querySelectorAll('[data-co]').forEach(b => b.onclick = () => { s.company_id = Number(b.dataset.co); s.zone_id = null; s.farm_id = null; render() })
    body.querySelectorAll('[data-zone]').forEach(b => b.onclick = () => { s.zone_id = Number(b.dataset.zone); s.farm_id = null; render() })
    body.querySelectorAll('[data-farm]').forEach(b => b.onclick = () => { s.farm_id = Number(b.dataset.farm); render() })
    body.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { s.type_id = Number(b.dataset.type); render() })
    body.querySelector('#add-zone')?.addEventListener('click', () => quickZone(s.company_id, (id) => { s.zone_id = id; render() }))
    body.querySelector('#add-farm')?.addEventListener('click', () => quickFarm(s.zone_id, (id) => { s.farm_id = id; render() }))
  }

  async function step2(body) {
    if (!s.name) {
      const f = B().farms.find(f => f.id == s.farm_id), z = B().zones.find(z => z.id == s.zone_id)
      s.name = `${f ? f.name : z?.name || ''} · ${typeOf(s.type_id).name}`
    }
    if (!s.code) try { s.code = (await api.get(`projects/suggest-code?company_id=${s.company_id}&zone_id=${s.zone_id}`)).code } catch { }
    const installOpts = fieldOptions(B().form_fields.find(f => f.entity === 'project' && f.key === 'install_type') || { options: 'Nueva|Reemplazo|Ampliación|No definido' })
    body.innerHTML = `<div class="form-grid">
      <div class="field w-two_thirds"><label>Nombre del proyecto <span class="req">*</span></label><input class="input" id="name" value="${esc(s.name)}"></div>
      <div class="field w-third"><label>Código / ID</label><input class="input mono" id="code" value="${esc(s.code)}"><span class="help">Sugerido automáticamente · editable</span></div>
      <div class="field w-half"><label>Responsable del Proyecto <span class="req">*</span></label><select class="select" id="resp">${B().users.filter(u => u.active).map(u => `<option value="${u.id}" ${u.id == s.responsible_id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select><span class="help">Designado por Dirección / Gerencias (paso 5.1.1)</span></div>
      <div class="field w-quarter"><label>¿Nueva o reemplazo?</label><select class="select" id="install"><option value="">—</option>${installOpts.map(o => `<option ${o === s.install_type ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
      <div class="field w-quarter"><label>Moneda</label><select class="select" id="cur">${['USD', 'ARS', 'EUR'].map(c => `<option ${c === s.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="field w-full"><label>Objetivo productivo</label><textarea class="textarea" id="obj" placeholder="¿Qué capacidad productiva incorpora o mejora este proyecto?">${esc(s.objective)}</textarea></div>
      <div class="field w-half"><label>Fecha estimada primera compra / contratación</label><input type="date" class="input" id="fpd" value="${esc(s.first_purchase_date)}"></div>
      <div class="field w-half"><label>Fecha estimada de puesta en marcha</label><input type="date" class="input" id="sed" value="${esc(s.startup_est_date)}"></div>
    </div>
    <div class="alert info mt-3">${icon('info', 'i-sm')}<span>El resto de la Ficha (características técnicas, evidencias, permisos) se completa luego en la pestaña <b>Ficha</b> del proyecto. Se generarán automáticamente las tareas de la etapa inicial.</span></div>`
    paintIcons(body)
  }

  function readStep2() {
    const g = (id) => root.querySelector('#' + id)?.value?.trim() ?? ''
    Object.assign(s, { name: g('name'), code: g('code'), responsible_id: Number(g('resp')), install_type: g('install'), currency: g('cur'), objective: g('obj'), first_purchase_date: g('fpd'), startup_est_date: g('sed') })
  }

  function step3(body) {
    const units = ['u', 'm', 'm²', 'm³', 'kW', 'kWp', 'kVA', 'ha', 'gl', 'hs', 'kg', 'lote']
    const types = ['Bien / equipo', 'Instalación', 'Obra / infraestructura', 'Servicio', 'Otro']
    body.innerHTML = `<div class="row between mb-2"><div><h3>Desglose de componentes (hoja 02)</h3><p class="small muted">Una fila por bien, equipo, obra o servicio. No agrupar conceptos que requieren distinta evaluación fiscal.</p></div>
      <button class="btn btn-sm" id="add-row">${icon('plus', 'i-sm')} Agregar fila</button></div>
      <div class="table-wrap"><table class="table" id="items"><thead><tr><th style="width:150px">Tipo</th><th>Descripción técnica</th><th style="width:80px">Cant.</th><th style="width:80px">Unidad</th><th style="width:120px">NCM</th><th style="width:120px">Unitario</th><th class="num" style="width:110px">Total</th><th></th></tr></thead>
      <tbody>${s.items.map((it, i) => `<tr data-i="${i}">
        <td><select class="select input-sm" data-k="component_type">${types.map(t => `<option ${t === it.component_type ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td><input class="input input-sm" data-k="description" value="${esc(it.description)}" placeholder="Ej. Transformador 630 kVA"></td>
        <td><input class="input input-sm" type="number" data-k="quantity" value="${esc(it.quantity)}"></td>
        <td><select class="select input-sm" data-k="unit">${units.map(u => `<option ${u === it.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
        <td><input class="input input-sm mono" data-k="ncm" data-ncm="1" value="${esc(it.ncm)}" placeholder="0000.00.00"></td>
        <td><input class="input input-sm" type="number" data-k="unit_price" value="${esc(it.unit_price)}" placeholder="0"></td>
        <td class="num bold ink" data-total>${money((Number(it.quantity) || 0) * (Number(it.unit_price) || 0), s.currency)}</td>
        <td><button class="btn btn-ghost btn-xs btn-icon" data-del="${i}" title="Quitar">${icon('trash-2', 'i-xs')}</button></td></tr>`).join('')}</tbody></table></div>
      <p class="xs muted mt-2">${icon('info', 'i-xs')} NCM: completar si se conoce; de lo contrario dejar vacío ("pendiente").</p>`
    bindNcmMask(body)
    body.querySelectorAll('tr[data-i]').forEach(tr => tr.querySelectorAll('[data-k]').forEach(el => el.addEventListener('input', () => {
      const it = s.items[tr.dataset.i]; it[el.dataset.k] = el.value
      tr.querySelector('[data-total]').textContent = money((Number(it.quantity) || 0) * (Number(it.unit_price) || 0), s.currency)
      root.querySelector('aside').innerHTML = summary(); paintIcons(root.querySelector('aside'))
    })))
    body.querySelector('#add-row').onclick = () => { s.items.push({ component_type: 'Bien / equipo', description: '', quantity: 1, unit: 'u', unit_price: '', ncm: '' }); render(); setTimeout(() => root.querySelector(`tr[data-i="${s.items.length - 1}"] [data-k=description]`)?.focus(), 50) }
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { s.items.splice(Number(b.dataset.del), 1); if (!s.items.length) s.items.push({ component_type: 'Bien / equipo', description: '', quantity: 1, unit: 'u', unit_price: '', ncm: '' }); render() })
  }

  function next() {
    if (s.step === 1) {
      if (!s.zone_id) return toast('Elegí una zona geográfica', 'warn')
      if (!s.type_id) return toast('Elegí el tipo de proyecto', 'warn')
    }
    if (s.step === 2) { readStep2(); if (!s.name) return toast('El nombre es obligatorio', 'warn') }
    s.step++; render()
  }

  async function create(withItems) {
    const btn = root.querySelector('#create'); btn.disabled = true
    try {
      const items = withItems ? s.items.filter(i => i.description.trim()) : []
      const r = await api.post('projects', {
        company_id: s.company_id, zone_id: s.zone_id, farm_id: s.farm_id || null, type_id: s.type_id, name: s.name, code: s.code,
        responsible_id: s.responsible_id, currency: s.currency, first_purchase_date: s.first_purchase_date || null, startup_est_date: s.startup_est_date || null,
        data: { objective: s.objective, install_type: s.install_type, prep_date: new Date().toISOString().slice(0, 10), address: B().farms.find(f => f.id == s.farm_id)?.address || '' }
      })
      if (items.length) await api.post(`projects/${r.id}/investments/bulk`, { rows: items.map(i => ({ ...i, quantity: Number(i.quantity) || null, unit_price: i.unit_price === '' ? null : Number(i.unit_price), currency: s.currency, ncm: i.ncm || null })) })
      toast(`Proyecto ${r.code} creado`)
      window.__refreshTaskCount && window.__refreshTaskCount()
      location.hash = `#/projects/${r.id}?tab=ficha`
    } catch (e) { handleErr(e); btn.disabled = false }
  }

  render()
}

/** Duplica un proyecto existente (ficha + componentes). src: { id, name, code, company_id, zone_id } */
export async function duplicateProjectModal(src, done) {
  let code = ''
  try { code = (await api.get(`projects/suggest-code?company_id=${src.company_id}&zone_id=${src.zone_id || ''}`)).code } catch { }
  const m = modal({
    title: 'Duplicar proyecto', icon: 'copy', subtitle: `Origen: ${esc(src.code || '')} · ${esc(src.name)}. Se copian ficha y componentes; el estado queda Activo.`,
    body: `<div class="form-grid">
      <div class="field w-two_thirds"><label>Nombre del nuevo proyecto <span class="req">*</span></label><input class="input" id="d-name" value="${esc(src.name)} (copia)"></div>
      <div class="field w-third"><label>Código <span class="req">*</span></label><input class="input mono" id="d-code" value="${esc(code)}"><span class="help">Debe ser distinto a los existentes</span></div>
      <div class="field w-half"><label>Responsable del Proyecto</label><select class="select" id="d-resp">${B().users.filter(u => u.active).map(u => `<option value="${u.id}" ${u.id == state.user.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>
      <div class="field w-quarter"><label>1ª compra (est.)</label><input type="date" class="input" id="d-fpd"></div>
      <div class="field w-quarter"><label>Puesta en marcha (est.)</label><input type="date" class="input" id="d-sed"></div>
    </div>
    <div class="alert info mt-3">${icon('info', 'i-sm')}<span>Los datos fiscales (elegibilidad, NCM validada, BK/BIT) no se copian: el equipo RIMI / Impuestos los vuelve a evaluar.</span></div>`,
    foot: `<button class="btn" data-close>Cancelar</button><button class="btn btn-accent" id="d-ok">${icon('copy', 'i-sm')} Duplicar</button>`
  })
  m.$('#d-ok').onclick = async () => {
    const name = m.$('#d-name').value.trim(), newCode = m.$('#d-code').value.trim()
    if (!name) return toast('El nombre es obligatorio', 'warn')
    if (!newCode) return toast('El código es obligatorio', 'warn')
    const btn = m.$('#d-ok'); btn.disabled = true
    try {
      const r = await api.post(`projects/${src.id}/duplicate`, {
        name, code: newCode, responsible_id: Number(m.$('#d-resp').value) || undefined,
        first_purchase_date: m.$('#d-fpd').value || null, startup_est_date: m.$('#d-sed').value || null
      })
      m.close(); toast(`Proyecto ${r.code} creado · ${r.copied} componentes copiados`)
      window.__refreshTaskCount && window.__refreshTaskCount()
      if (done) done(r); else location.hash = `#/projects/${r.id}?tab=ficha`
    } catch (e) { handleErr(e); btn.disabled = false }
  }
}

export function quickZone(company_id, done) {
  const m = modal({
    title: 'Nueva zona geográfica', icon: 'map-pin', subtitle: 'Ej.: Guandacol, Chilecito, Valle Fértil',
    body: `<div class="form-grid"><div class="field w-full"><label>Nombre <span class="req">*</span></label><input class="input" id="z-name"></div>
      <div class="field w-half"><label>Localidad</label><input class="input" id="z-loc"></div><div class="field w-half"><label>Provincia</label><input class="input" id="z-prov" value="La Rioja"></div>
      <div class="field w-full"><label>Descripción</label><input class="input" id="z-desc"></div></div>`,
    foot: `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="z-save">Crear zona</button>`
  })
  m.$('#z-save').onclick = async () => {
    try {
      const name = m.$('#z-name').value.trim(); if (!name) return toast('Ingresá el nombre', 'warn')
      const r = await api.post('zones', { company_id, name, locality: m.$('#z-loc').value, province: m.$('#z-prov').value, description: m.$('#z-desc').value })
      await window.__reloadBoot(); m.close(); toast('Zona creada'); done(r.id)
    } catch (e) { handleErr(e) }
  }
}
export function quickFarm(zone_id, done) {
  const m = modal({
    title: 'Nueva finca / establecimiento', icon: 'trees', tone: 'tone-sun',
    body: `<div class="form-grid"><div class="field w-full"><label>Nombre <span class="req">*</span></label><input class="input" id="f-name" placeholder="Finca El Camino"></div>
      <div class="field w-two_thirds"><label>Domicilio</label><input class="input" id="f-addr"></div><div class="field w-third"><label>Hectáreas</label><input class="input" type="number" id="f-ha"></div>
      <div class="field w-full"><label>Notas</label><input class="input" id="f-notes"></div></div>`,
    foot: `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="f-save">Crear finca</button>`
  })
  m.$('#f-save').onclick = async () => {
    try {
      const name = m.$('#f-name').value.trim(); if (!name) return toast('Ingresá el nombre', 'warn')
      const r = await api.post('farms', { zone_id, name, address: m.$('#f-addr').value, hectares: Number(m.$('#f-ha').value) || null, notes: m.$('#f-notes').value })
      await window.__reloadBoot(); m.close(); toast('Finca creada'); done(r.id)
    } catch (e) { handleErr(e) }
  }
}
