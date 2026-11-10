import { state, api, esc, icon, paintIcons, money, num, avatar, fdate, stagesFor, stageOf, stagePill, eligBadge, roleOf, modal, toast, handleErr, isRimi, canWrite, canFiscal, can, isOwner, confirmDialog, emptyState, hexA, B, sectionsFor, fieldsFor, renderField, readForm, validateForm, bindNcmMask, setQS } from '../lib.js'
import { mountChat } from './chat.js'
import { renderTaskList, newTaskModal } from './tasks.js'
import { uploadModal, docTable, bindDocTable } from './documents.js'

const invValue = (inv, f) => (f.core ? inv?.[f.key] : inv?.data?.[f.key])

/** Formulario de alta / edición de una inversión (campos del constructor) */
export function investmentForm(inv, data, done) {
  const p = data.project
  const secs = sectionsFor('investment')
  const ctx = { currency: inv?.currency || p.currency }
  const m = modal({
    title: inv ? `Editar ${esc(inv.code)}` : 'Nuevo componente de inversión', icon: 'package-plus', tone: 'tone-sun', size: 'xl',
    subtitle: 'Bien mueble / inversión unitaria. Identificalo con todos los datos requeridos: posición arancelaria (NCM), marca, modelo y proveedor.',
    body: `<form id="inv-form" novalidate>${secs.map(s => {
      const locked = s.restricted && !canFiscal()
      return `<section class="mb-3"><div class="row mb-2" style="gap:10px"><span class="ficha-letter" style="width:28px;height:28px;border-radius:9px;font-size:12px;${s.restricted ? 'background:var(--sun-600)' : ''}">${esc(s.letter || '·')}</span><h4 class="grow">${esc(s.title)}</h4>${locked ? `<span class="badge sun">${icon('lock', 'i-xs')} Valida Impuestos / RIMI</span>` : ''}</div>
        <div class="form-grid">${fieldsFor('investment', s.key).map(f => renderField(f, invValue(inv, f) ?? (f.key === 'currency' ? p.currency : f.key === 'is_new' ? 'Sí' : f.key === 'component_type' ? 'Bien / equipo' : undefined), { disabled: locked, ctx })).join('')}
        ${s.key === 'tech' ? `<div class="field w-third"><label>Responsable del componente</label><select class="select" id="inv-resp"><option value="">Mismo que el proyecto</option>${B().users.filter(u => u.active).map(u => `<option value="${u.id}" ${u.id == inv?.responsible_id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>` : ''}</div></section>`
    }).join('')}</form>`,
    foot: `<span class="xs muted grow">${icon('calculator', 'i-xs')} El total se calcula como cantidad × importe unitario y recalcula el presupuesto del proyecto.</span><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="inv-save">${icon('save', 'i-sm')} ${inv ? 'Guardar cambios' : 'Agregar componente'}</button>`
  })
  bindNcmMask(m.el)
  const form = m.$('#inv-form')
  const q = form.querySelector('[data-field=quantity]'), up = form.querySelector('[data-field=unit_price]'), tot = form.querySelector('[data-field=total]')
  const calc = () => { if (tot && q && up && q.value && up.value) tot.value = Math.round(Number(q.value) * Number(up.value) * 100) / 100 }
  q?.addEventListener('input', calc); up?.addEventListener('input', calc)
  m.$('#inv-save').onclick = async () => {
    const all = fieldsFor('investment')
    const errs = validateForm(form, all)
    if (errs.length) return toast('Revisá: ' + errs.join(', '), 'warn')
    const vals = readForm(form, all)
    const payload = { data: {} }
    for (const f of all) { if (!(f.key in vals)) continue; if (f.core) payload[f.key] = vals[f.key]; else payload.data[f.key] = vals[f.key] }
    delete payload.total
    payload.responsible_id = Number(m.$('#inv-resp').value) || null
    try {
      if (inv) await api.put(`investments/${inv.id}`, payload)
      else await api.post(`projects/${p.id}/investments`, payload)
      toast(inv ? 'Componente actualizado' : 'Componente agregado'); m.close(); done && done()
    } catch (e) { handleErr(e) }
  }
}

/** Drawer de detalle de una inversión */
export async function openInvestment(id, data, onChange) {
  let inv, members
  try { ({ investment: inv, members } = await api.get(`investments/${id}`)) } catch (e) { return handleErr(e) }
  setQS({ inv: id })
  let chat = null, tab = 'detail', changed = false
  const p = data.project
  const m = modal({
    drawer: true, icon: 'package', tone: 'tone-sun',
    title: `<span class="mono" style="font-size:14px;color:var(--muted)">${esc(inv.code)}</span> ${esc(inv.description)}`,
    subtitle: `${esc(p.name)} · ${esc(inv.component_type || '')}`,
    body: `<div style="padding:16px 24px 0"><div class="inv-pipe" id="inv-pipe"></div></div>
      <nav class="tabs" style="padding:0 24px;margin:14px 0 0" id="inv-tabs">${[['detail', 'Ficha del bien', 'file-text'], ['docs', 'Documentos', 'paperclip'], ['tasks', 'Tareas', 'list-checks'], ['chat', 'Conversación', 'message-circle'], ['team', 'Responsables', 'users']].map(([k, l, ic]) => `<button class="tab ${k === tab ? 'active' : ''}" data-t="${k}">${icon(ic, 'i-sm')} ${l}</button>`).join('')}</nav>
      <div id="inv-body" style="padding:20px 24px"></div>`,
    foot: `${can('investments.delete') || ((can('investments.edit') || isOwner(p)) && inv.stage_key === 'identificada') ? `<button class="btn btn-danger btn-sm" id="inv-del">${icon('trash-2', 'i-sm')} Eliminar</button>` : ''}<span class="grow"></span><button class="btn" data-close>Cerrar</button>${(can('investments.edit') || isOwner(p)) ? `<button class="btn btn-primary" id="inv-edit">${icon('pencil', 'i-sm')} Editar ficha</button>` : ''}`,
    onClose: () => { chat?.destroy(); setQS({ inv: null }); if (changed) onChange && onChange() }
  })

  const drawPipe = () => {
    const st = stagesFor('investment'); const cur = stageOf(inv.stage_key, 'investment')
    m.$('#inv-pipe').innerHTML = st.map(s => `<div class="pipe-step ${s.key === inv.stage_key ? 'current' : s.sort < cur.sort && !s.is_final ? 'done' : ''} ${(can('investments.edit') || isOwner(p)) ? 'clickable' : ''}" data-st="${s.key}" title="${esc(s.description || '')}" style="${s.is_final && s.key !== inv.stage_key ? 'opacity:.6' : ''}"><div class="nm" style="margin:0">${icon(s.key === inv.stage_key ? s.icon : (s.sort < cur.sort && !s.is_final ? 'check' : s.icon), 'i-xs')}<span class="lbl">${esc(s.short_name)}</span></div></div>`).join('')
    paintIcons(m.$('#inv-pipe'))
    if (can('investments.edit') || isOwner(p)) m.$$('#inv-pipe [data-st]').forEach(b => b.onclick = async () => {
      if (b.dataset.st === inv.stage_key) return
      if (b.dataset.st === 'baja' && !(await confirmDialog({ title: 'Registrar baja', message: 'Venta, reemplazo, siniestro o baja deben informarse dentro de 2 días hábiles con acta e informe. El Responsable RIMI evaluará el impacto en los beneficios.', confirm: 'Registrar baja', danger: true }))) return
      try { await api.put(`investments/${inv.id}`, { stage_key: b.dataset.st }); inv.stage_key = b.dataset.st; changed = true; drawPipe(); toast(`Estado: ${stageOf(b.dataset.st, 'investment').name}`) } catch (e) { handleErr(e) }
    })
  }

  const draw = async () => {
    chat?.destroy(); chat = null
    const body = m.$('#inv-body')
    m.$$('#inv-tabs [data-t]').forEach(b => b.classList.toggle('active', b.dataset.t === tab))
    if (tab === 'detail') {
      const rows = (pairs) => pairs.map(([l, v, mono]) => `<div><div class="xs bold muted" style="text-transform:uppercase;letter-spacing:.07em">${l}</div><div class="${mono ? 'mono' : ''} ink bold mt-1" style="font-size:13.5px">${v ?? '—'}</div></div>`).join('')
      const extras = fieldsFor('investment').filter(f => !f.core)
      body.innerHTML = `<div class="inv-summary">
          <div><span class="lbl">Total</span><b>${money(inv.total, inv.currency)}</b><small>${num(inv.quantity, 2)} ${esc(inv.unit || '')} × ${money(inv.unit_price, inv.currency)}</small></div>
          <div><span class="lbl">Posición arancelaria</span><b class="mono">${esc(inv.ncm || 'pendiente')}</b><small>${esc(inv.ncm_status || '')} ${inv.bk_bit ? '· ' + esc(inv.bk_bit) : ''}</small></div>
          <div><span class="lbl">Elegibilidad</span><b style="font-size:14px">${esc(inv.eligibility || 'Sin dictamen')}</b><small>Etapa: ${esc(stageOf(inv.stage_key, 'investment')?.short_name || '')}</small></div>
        </div>
        <div class="card card-pad mt-3"><div class="grid g-3" style="gap:18px">${rows([
          ['Tipo de componente', esc(inv.component_type)], ['Marca / modelo', esc(inv.brand_model || '—')], ['N° de serie', esc(inv.serial_number || '—'), true],
          ['¿Bien nuevo?', esc(inv.is_new || '—')], ['Proveedor', esc(inv.supplier || '—')], ['CUIT proveedor', esc(inv.supplier_cuit || '—'), true],
          ['Compra estimada', fdate(inv.purchase_date)], ['Factura estimada', fdate(inv.invoice_date)], ['Puesta en marcha', fdate(inv.startup_date)],
          ['Responsable', esc(inv.responsible_name || p.responsible_name || '—')], ['Especificación / soporte', esc(inv.spec_doc || '—')], ['Moneda', esc(inv.currency)],
          ...extras.map(f => [esc(f.label), esc(inv.data?.[f.key] || '—')])
        ])}</div></div>
        ${canFiscal() ? `<div class="card card-pad mt-3 quick-fiscal"><div class="row row-wrap"><span class="grow"><b class="ink">${icon('landmark', 'i-sm')} Validación fiscal rápida</b><div class="xs muted">Impuestos / Responsable RIMI</div></span>
          <select class="select input-sm" id="q-el" style="width:200px">${['Pendiente de validación', 'General elegible', 'Específica elegible', 'No elegible'].map(o => `<option ${o === inv.eligibility ? 'selected' : ''}>${o}</option>`).join('')}</select>
          <select class="select input-sm" id="q-ncm" style="width:130px">${['Propuesta', 'Validada', 'Pendiente'].map(o => `<option ${o === inv.ncm_status ? 'selected' : ''}>${o}</option>`).join('')}</select>
          <button class="btn btn-sm btn-primary" id="q-save">Aplicar</button></div></div>` : ''}
        <div class="note-subtle mt-3">${icon('lightbulb', 'i-sm')}<span><b class="ink">Buenas prácticas de compra · </b>Incluir en cotizaciones, contratos y OC: facturación desagregada de bienes, obra y servicios; marca, modelo y serie; indicación de bien nuevo; IVA discriminado y referencia al proyecto. Facilita la vinculación en el SGI.</span></div>`
      paintIcons(body)
      body.querySelector('#q-save')?.addEventListener('click', async () => {
        try { const el = body.querySelector('#q-el').value; await api.put(`investments/${inv.id}`, { eligibility: el, ncm_status: body.querySelector('#q-ncm').value, ...(inv.stage_key === 'identificada' && el !== 'Pendiente de validación' ? { stage_key: 'dictaminada' } : {}) }); Object.assign(inv, (await api.get(`investments/${inv.id}`)).investment); changed = true; drawPipe(); draw(); toast('Validación registrada') } catch (e) { handleErr(e) }
      })
    } else if (tab === 'docs') {
      const { documents } = await api.get(`documents?investment_id=${inv.id}&project_id=${p.id}`)
      body.innerHTML = `<div class="row between mb-2"><p class="small muted">Comprobantes, remitos, despachos, actas y fotos de esta inversión (carpeta 04/${esc(inv.code)}).</p>${can('documents.upload') ? `<button class="btn btn-primary btn-sm" id="up">${icon('upload', 'i-sm')} Subir</button>` : ''}</div><div class="card">${docTable(documents)}</div>`
      paintIcons(body)
      bindDocTable(body, documents, draw)
      body.querySelector('#up')?.addEventListener('click', () => uploadModal({ project_id: p.id, investments: data.investments, investment_id: inv.id, folder_key: '04' }, () => { changed = true; draw() }))
    } else if (tab === 'tasks') {
      body.innerHTML = `<div class="row between mb-2"><p class="small muted">Tareas específicas de este componente.</p>${(can('tasks.create') || isOwner(p)) ? `<button class="btn btn-primary btn-sm" id="nt">${icon('plus', 'i-sm')} Nueva tarea</button>` : ''}</div><div class="card" id="tl"></div>`
      paintIcons(body)
      const loadT = async () => { const { tasks } = await api.get(`tasks?investment_id=${inv.id}`); renderTaskList(body.querySelector('#tl'), tasks, loadT, { showProject: false }) }
      body.querySelector('#nt')?.addEventListener('click', () => newTaskModal({ project_id: p.id, investment_id: inv.id, investments: data.investments }, () => { changed = true; loadT() }))
      await loadT()
    } else if (tab === 'chat') {
      body.innerHTML = `<div class="card" style="overflow:hidden"><div id="cb" style="height:calc(100vh - 360px);min-height:360px"></div></div>`
      chat = mountChat(body.querySelector('#cb'), { project_id: p.id, investment_id: inv.id }, { placeholder: `Comentario sobre ${inv.code}…` })
    } else if (tab === 'team') {
      body.innerHTML = `<div class="card"><div class="card-head"><h3>Responsables específicos</h3><div class="right">${can('members.manage') || isOwner(p) ? `<button class="btn btn-sm btn-primary" id="am">${icon('user-plus', 'i-sm')} Asignar</button>` : ''}</div></div>
        <div class="list">${members.map(x => `<div class="list-item">${avatar(x.name, x.avatar_color, 'sm')}<div class="grow"><div class="t small">${esc(x.name)}</div><div class="s">${esc(x.email)}</div></div><span class="badge" style="background:${hexA(roleOf(x.role_key).color, .12)};color:${roleOf(x.role_key).color}">${esc(roleOf(x.role_key).name)}</span></div>`).join('') || emptyState('users', 'Sin responsables específicos', 'Se aplican los responsables del proyecto.')}</div></div>`
      paintIcons(body)
      body.querySelector('#am')?.addEventListener('click', () => {
        const mm = modal({ title: `Asignar responsable a ${esc(inv.code)}`, icon: 'user-plus', size: 'sm', body: `<div class="field"><label>Usuario</label><select class="select" id="u">${B().users.filter(u => u.active).map(u => `<option value="${u.id}" data-r="${u.functional_role || ''}">${esc(u.name)}</option>`).join('')}</select></div><div class="field mt-2"><label>Rol</label><select class="select" id="r">${B().roles.map(r => `<option value="${r.key}">${esc(r.name)}</option>`).join('')}</select></div>`, foot: `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">Asignar</button>` })
        const sync = () => { const r = mm.$('#u').selectedOptions[0]?.dataset.r; if (r) mm.$('#r').value = r }; mm.$('#u').onchange = sync; sync()
        mm.$('#ok').onclick = async () => { try { await api.post(`projects/${p.id}/members`, { user_id: Number(mm.$('#u').value), role_key: mm.$('#r').value, investment_id: inv.id }); members = (await api.get(`investments/${inv.id}`)).members; changed = true; mm.close(); draw(); toast('Responsable asignado') } catch (e) { handleErr(e) } }
      })
    }
  }
  m.$$('#inv-tabs [data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; draw() })
  m.$('#inv-edit')?.addEventListener('click', () => investmentForm(inv, data, async () => { inv = (await api.get(`investments/${inv.id}`)).investment; changed = true; drawPipe(); draw() }))
  m.$('#inv-del')?.addEventListener('click', async () => {
    if (!(await confirmDialog({ title: `Eliminar ${esc(inv.code)}`, message: 'Se eliminará el componente, sus tareas y su conversación. Los documentos quedan en el legajo general.', confirm: 'Eliminar', danger: true }))) return
    try { await api.del(`investments/${inv.id}`); changed = true; toast('Componente eliminado'); m.close() } catch (e) { handleErr(e) }
  })
  drawPipe(); draw()
}
