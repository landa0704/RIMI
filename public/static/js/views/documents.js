import { state, api, esc, icon, paintIcons, B, debounce, canWrite, can, toast } from '../lib.js'
import { docTable, bindDocTable, uploadModal } from '../components/documents.js'

export default async function (root) {
  let folder = '', q = ''
  root.innerHTML = `
  <div class="page-head"><div><div class="eyebrow">Repositorio documental</div><h1>Legajo digital</h1><p class="sub">Presupuestos, contratos, facturas, remitos, actas e informes de todos los proyectos, organizados con la estructura fija del Anexo II.</p></div>
    <div class="actions">${can('documents.upload') ? `<button class="btn btn-primary" id="up">${icon('upload', 'i-sm')} Subir documento</button>` : ''}</div></div>
  <div class="grid g-main-l" style="grid-template-columns:280px minmax(0,1fr)">
    <aside class="card" style="padding:8px;align-self:start" id="folders"></aside>
    <div class="card"><div class="card-head"><div class="search" style="max-width:360px">${icon('search')}<input class="input" id="dq" style="height:38px;padding-left:40px;padding-right:12px" placeholder="Nombre, N° comprobante o proveedor…"></div><div class="right small muted" id="dcount"></div></div><div id="dlist"></div></div>
  </div>`
  paintIcons(root)
  let all = []
  async function load() {
    const p = new URLSearchParams(); if (q) p.set('q', q)
    all = (await api.get('documents?' + p)).documents
    draw()
  }
  function draw() {
    const list = folder ? all.filter(d => d.folder_key === folder) : all
    root.querySelector('#folders').innerHTML = `<div class="folder-item ${!folder ? 'active' : ''}" data-f="">${icon('folders', 'i-sm')} Todos<span class="cnt">${all.length}</span></div>` +
      B().folders.map(f => `<div class="folder-item ${folder === f.key ? 'active' : ''}" data-f="${f.key}" title="${esc(f.description || '')}">${icon(folder === f.key ? 'folder-open' : 'folder', 'i-sm')}<span class="truncate">${esc(f.name)}</span><span class="cnt">${all.filter(d => d.folder_key === f.key).length || ''}</span></div>`).join('')
    root.querySelector('#dlist').innerHTML = docTable(list, { showProject: true })
    root.querySelector('#dcount').textContent = `${list.length} documento(s)`
    paintIcons(root)
    root.querySelectorAll('[data-f]').forEach(x => x.onclick = () => { folder = x.dataset.f; draw() })
    bindDocTable(root.querySelector('#dlist'), list, load)
  }
  root.querySelector('#dq').oninput = debounce((e) => { q = e.target.value.trim(); load() }, 300)
  root.querySelector('#up')?.addEventListener('click', async () => {
    const { projects } = await api.get(`projects?company_id=${state.company}`)
    if (!projects.length) return toast('Primero creá un proyecto', 'warn')
    const { modal } = await import('../lib.js')
    const m = modal({ title: 'Elegí el proyecto', icon: 'folder', size: 'sm', body: `<select class="select" id="pp">${projects.map(p => `<option value="${p.id}">${esc(p.code || '')} · ${esc(p.name)}</option>`).join('')}</select>`, foot: '<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="go">Continuar</button>' })
    m.$('#go').onclick = async () => { const pid = Number(m.$('#pp').value); m.close(); const d = await api.get(`projects/${pid}`); uploadModal({ project_id: pid, investments: d.investments, folder_key: folder || null }, load) }
  })
  await load()
}
