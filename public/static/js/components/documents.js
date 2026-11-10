import { state, api, esc, icon, paintIcons, modal, toast, handleErr, B, fdate, fsize, fileIcon, money, isRimi, can, confirmDialog, emptyState, canWrite, avatar } from '../lib.js'

export function uploadModal({ project_id, investments = [], investment_id = null, folder_key = null }, onDone) {
  const folders = B().folders
  const m = modal({
    title: 'Subir documentación', icon: 'file-up', tone: 'tone-sun', size: 'lg',
    subtitle: 'Se guarda en el legajo digital del proyecto con la estructura del Anexo II. Los comprobantes van por inversión porque en el SGI se vinculan por inversión.',
    body: `<div class="dropzone" id="dz"><div class="ill" style="width:56px;height:56px;border-radius:18px;margin:0 auto 10px;display:grid;place-items:center;background:#fff;color:var(--brand-600)">${icon('cloud-upload', 'i-lg')}</div>
        <div class="bold ink">Arrastrá archivos acá o hacé clic para elegir</div><div class="small muted">PDF, imágenes, Excel, Word · hasta 25 MB por archivo</div>
        <input type="file" id="file" multiple hidden></div>
      <div id="file-list" class="mt-2"></div>
      <div class="form-grid mt-3">
        <div class="field w-half"><label>Tipo de documento</label><select class="select" id="u-type">${B().doc_types.map(d => `<option value="${d.key}" data-folder="${d.folder_key}">${esc(d.name)}</option>`).join('')}</select></div>
        <div class="field w-half"><label>Carpeta (Anexo II)</label><select class="select" id="u-folder">${folders.map(f => `<option value="${f.key}" ${f.key === folder_key ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div>
        <div class="field w-full"><label>Inversión asociada</label><select class="select" id="u-inv"><option value="">Documento general del proyecto</option>${investments.map(i => `<option value="${i.id}" ${i.id == investment_id ? 'selected' : ''}>${esc(i.code)} · ${esc(i.description)}</option>`).join('')}</select></div>
        <div class="field w-third"><label>N° comprobante</label><input class="input" id="u-num" placeholder="A-0001-00001234"></div>
        <div class="field w-third"><label>Fecha</label><input type="date" class="input" id="u-date"></div>
        <div class="field w-third"><label>Importe</label><input type="number" step="0.01" class="input" id="u-amount"></div>
        <div class="field w-half"><label>Proveedor</label><input class="input" id="u-supplier"></div>
        <div class="field w-half"><label>Notas</label><input class="input" id="u-notes"></div>
      </div>
      ${state.boot?.storage === false ? '' : ''}`,
    foot: `<span class="xs muted grow">${icon('shield-check', 'i-xs')} Queda registrado quién subió cada archivo y cuándo.</span><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="u-save">${icon('upload', 'i-sm')} Subir</button>`
  })
  let files = []
  const dz = m.$('#dz'), input = m.$('#file')
  const renderFiles = () => {
    m.$('#file-list').innerHTML = files.map((f, i) => { const [ic, tone] = fileIcon(f.type, f.name); return `<div class="row" style="padding:8px 10px;border:1px solid var(--line-2);border-radius:10px;margin-top:6px"><span class="file-ico ${tone}" style="width:30px;height:30px">${icon(ic, 'i-sm')}</span><span class="grow small bold ink truncate">${esc(f.name)}</span><span class="xs muted">${fsize(f.size)}</span><button class="btn btn-ghost btn-xs btn-icon" data-rm="${i}">${icon('x', 'i-xs')}</button></div>` }).join('')
    paintIcons(m.$('#file-list'))
    m.$$('[data-rm]').forEach(b => b.onclick = () => { files.splice(Number(b.dataset.rm), 1); renderFiles() })
  }
  const add = (list) => { for (const f of list) { if (f.size > 25 * 1024 * 1024) { toast(`${f.name} supera 25 MB`, 'warn'); continue } files.push(f) } renderFiles() }
  dz.onclick = () => input.click()
  input.onchange = () => add(input.files)
  dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('over') }
  dz.ondragleave = () => dz.classList.remove('over')
  dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('over'); add(e.dataTransfer.files) }
  m.$('#u-type').onchange = (e) => { const f = e.target.selectedOptions[0].dataset.folder; if (f) m.$('#u-folder').value = f }
  if (!folder_key) m.$('#u-type').dispatchEvent(new Event('change'))
  m.$('#u-save').onclick = async () => {
    if (!files.length) return toast('Elegí al menos un archivo', 'warn')
    const btn = m.$('#u-save'); btn.disabled = true; btn.textContent = 'Subiendo…'
    let ok = 0, stored = true
    for (const f of files) {
      const fd = new FormData()
      fd.append('file', f); fd.append('project_id', project_id)
      fd.append('doc_type', m.$('#u-type').value); fd.append('folder_key', m.$('#u-folder').value)
      if (m.$('#u-inv').value) fd.append('investment_id', m.$('#u-inv').value)
      for (const [k, id] of [['doc_number', 'u-num'], ['doc_date', 'u-date'], ['amount', 'u-amount'], ['supplier', 'u-supplier'], ['notes', 'u-notes']]) if (m.$('#' + id).value) fd.append(k, m.$('#' + id).value)
      try { const r = await api('documents', { method: 'POST', body: fd }); ok++; if (!r.stored) stored = false } catch (e) { handleErr(e) }
    }
    if (ok) { toast(`${ok} archivo(s) subidos${stored ? '' : ' (sólo referencia: almacenamiento no configurado)'}`, stored ? 'ok' : 'warn'); m.close(); onDone && onDone() }
    else { btn.disabled = false; btn.textContent = 'Subir' }
  }
}

const STATUS = { cargado: ['Cargado', ''], en_revision: ['En revisión', 'sky'], validado: ['Validado', 'green'], observado: ['Observado', 'rose'] }

export function docTable(docs, { showProject = false } = {}) {
  if (!docs.length) return emptyState('folder-open', 'Sin documentos en esta carpeta', 'Subí cotizaciones, contratos, facturas, remitos, actas o informes técnicos.')
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Documento</th>${showProject ? '<th>Proyecto</th>' : ''}<th>Inversión</th><th>Tipo</th><th>Fecha</th><th class="num">Importe</th><th>Estado</th><th>Subido por</th><th></th></tr></thead><tbody>
  ${docs.map(d => {
    const [ic, tone] = fileIcon(d.mime, d.name); const [sl, sc] = STATUS[d.status] || STATUS.cargado
    return `<tr data-doc="${d.id}"><td><div class="row"><span class="file-ico ${tone}">${icon(ic, 'i-sm')}</span><div style="min-width:0"><div class="cell-title truncate" style="max-width:320px">${esc(d.name)}</div><div class="cell-sub">${d.doc_number ? esc(d.doc_number) + ' · ' : ''}${fsize(d.size)}${!d.r2_key ? ' · referencia' : ''}</div></div></div></td>
    ${showProject ? `<td><a href="#/projects/${d.project_id}?tab=docs" class="small bold">${esc(d.project_code || d.project_name)}</a></td>` : ''}
    <td>${d.inv_code ? `<span class="badge sun">${esc(d.inv_code)}</span>` : '<span class="muted xs">General</span>'}</td>
    <td class="small">${esc(d.type_name || d.doc_type || '—')}</td><td class="small nowrap">${fdate(d.doc_date || d.created_at)}</td><td class="num small">${d.amount ? money(d.amount, d.currency || 'USD') : '—'}</td>
    <td><span class="badge ${sc}">${sl}</span></td><td class="small">${esc(d.uploader_name || '—')}</td>
    <td class="nowrap"><button class="btn btn-ghost btn-xs btn-icon" data-dl="${d.id}" ${d.r2_key ? '' : 'disabled'} title="Descargar">${icon('download', 'i-xs')}</button><button class="btn btn-ghost btn-xs btn-icon" data-more="${d.id}" title="Acciones">${icon('ellipsis', 'i-xs')}</button></td></tr>`
  }).join('')}</tbody></table></div>`
}

export function bindDocTable(root, docs, reload) {
  root.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => window.open(`/api/documents/${b.dataset.dl}/file`, '_blank'))
  root.querySelectorAll('[data-more]').forEach(b => b.onclick = async (e) => {
    const { popover, closePopover } = await import('../lib.js')
    const d = docs.find(x => x.id == b.dataset.more)
    const canVal = can('documents.validate')
    popover(b, `<div class="menu">${d.r2_key ? `<button class="menu-item" data-a="view">${icon('eye', 'i-sm')} Ver en el navegador</button>` : ''}
      ${canVal ? Object.entries(STATUS).map(([k, [l]]) => `<button class="menu-item" data-a="st:${k}">${icon(k === 'validado' ? 'badge-check' : k === 'observado' ? 'circle-alert' : 'circle-dot', 'i-sm')} Marcar ${l.toLowerCase()}</button>`).join('') : ''}
      ${(can('documents.delete') || d.uploaded_by === state.user.id) ? `<div class="menu-sep"></div><button class="menu-item danger" data-a="del">${icon('trash-2', 'i-sm')} Eliminar</button>` : ''}</div>`, { onMount: (el) => {
      el.querySelectorAll('[data-a]').forEach(x => x.onclick = async () => {
        closePopover(); const a = x.dataset.a
        try {
          if (a === 'view') window.open(`/api/documents/${d.id}/file?inline=1`, '_blank')
          else if (a.startsWith('st:')) { await api.put(`documents/${d.id}`, { status: a.slice(3) }); toast('Estado actualizado'); reload() }
          else if (a === 'del') { if (await confirmDialog({ title: 'Eliminar documento', message: `¿Eliminar "${esc(d.name)}" del legajo?`, confirm: 'Eliminar', danger: true })) { await api.del(`documents/${d.id}`); toast('Documento eliminado'); reload() } }
        } catch (err) { handleErr(err) }
      })
    } })
  })
}
