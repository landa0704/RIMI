import { state, api, esc, icon, paintIcons, money, B, qs, setQS, typeOf, stagePill, hexA, isRimi, can, emptyState, modal, toast, handleErr, confirmDialog, canWrite } from '../lib.js'
import { quickZone, quickFarm } from './project-new.js'

export default async function (root) {
  let tree = await api.get('tree')
  let sel = { zone: Number(qs().get('zone')) || null, farm: Number(qs().get('farm')) || null }
  const open = new Set(JSON.parse(localStorage.getItem('rimi_tree_open') || '[]'))
  const co = state.company

  const zones = () => tree.zones.filter(z => z.company_id == co)
  const farmsOf = (zid) => tree.farms.filter(f => f.zone_id == zid)
  const projOf = (pred) => tree.projects.filter(p => p.company_id == co && pred(p))
  const sum = (ps) => ps.reduce((a, p) => a + (p.budget || p.inv_total || 0), 0)
  if (!sel.zone && zones()[0]) sel.zone = [...zones()].sort((a, b) => projOf(p => p.zone_id == b.id).length - projOf(p => p.zone_id == a.id).length)[0].id

  function render() {
    const company = tree.companies.find(c => c.id == co)
    root.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Estructura geográfica</div><h1>Zonas, fincas y proyectos</h1>
      <p class="sub">Empresa → Zona → Finca → Proyecto → Inversión. Por ejemplo: Guandacol → Finca El Camino → Proyecto Energético → Transformador.</p></div>
      <div class="actions">${can('zones.manage') ? `<button class="btn" id="new-zone">${icon('map-pin-plus', 'i-sm')} Nueva zona</button>` : ''}${can('projects.create') ? `<a class="btn btn-primary" href="#/projects/new">${icon('plus', 'i-sm')} Nuevo proyecto</a>` : ''}</div></div>
    <div class="grid g-main-l">
      <aside class="card" style="align-self:start;position:sticky;top:calc(var(--topbar-h) + 18px)">
        <div class="card-head"><span class="company-dot" style="width:28px;height:28px;border-radius:8px;font-size:11px;background:${esc(company?.color)}">${esc(company?.short_code || '')}</span><h3>${esc(company?.name || '')}</h3></div>
        <div class="tree">${zones().map(z => {
          const isOpen = open.has('z' + z.id) || sel.zone === z.id
          const zp = projOf(p => p.zone_id == z.id)
          return `<div class="tree-node ${isOpen ? 'open' : ''} ${sel.zone === z.id && !sel.farm ? 'active' : ''}" data-zone="${z.id}">${icon('chevron-right', 'caret')}${icon('map-pin', 'i-sm')}<span class="truncate">${esc(z.name)}</span><span class="cnt">${zp.length}</span></div>
            ${isOpen ? `<div class="tree-children">${farmsOf(z.id).map(f => `<div class="tree-node ${sel.farm === f.id ? 'active' : ''}" data-farm="${f.id}" data-fz="${z.id}">${icon('trees', 'i-sm')}<span class="truncate">${esc(f.name)}</span><span class="cnt">${projOf(p => p.farm_id == f.id).length}</span></div>`).join('')}
            ${can('farms.manage') ? `<div class="tree-node" data-addfarm="${z.id}" style="color:var(--brand-600)">${icon('plus', 'i-sm')} Agregar finca</div>` : ''}</div>` : ''}`
        }).join('') || '<p class="small muted" style="padding:10px">Sin zonas. Creá la primera.</p>'}</div>
      </aside>
      <div id="detail"></div>
    </div>`
    paintIcons(root)
    root.querySelector('#new-zone')?.addEventListener('click', () => quickZone(co, async (id) => { tree = await api.get('tree'); sel = { zone: id, farm: null }; render() }))
    root.querySelectorAll('[data-zone]').forEach(n => n.onclick = () => {
      const id = Number(n.dataset.zone)
      if (sel.zone === id && !sel.farm) { open.has('z' + id) ? open.delete('z' + id) : open.add('z' + id) } else open.add('z' + id)
      localStorage.setItem('rimi_tree_open', JSON.stringify([...open]))
      sel = { zone: id, farm: null }; setQS({ zone: id, farm: null }); render()
    })
    root.querySelectorAll('[data-farm]').forEach(n => n.onclick = () => { sel = { zone: Number(n.dataset.fz), farm: Number(n.dataset.farm) }; setQS(sel); render() })
    root.querySelectorAll('[data-addfarm]').forEach(n => n.onclick = () => quickFarm(Number(n.dataset.addfarm), async (id) => { tree = await api.get('tree'); sel.farm = id; render() }))
    detail(root.querySelector('#detail'))
  }

  function projCard(p) {
    const t = typeOf(p.type_id)
    return `<a class="mini-proj" href="#/projects/${p.id}">
      <span style="width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:${hexA(t.color, .14)};color:${t.color}">${icon(t.icon, 'i-sm')}</span>
      <div class="grow" style="min-width:0"><div class="bold ink small truncate">${esc(p.name)}</div><div class="xs muted mono">${esc(p.code || '')} · ${p.inv_count} inversiones</div></div>
      ${stagePill(p.stage_key)}<b class="small ink nowrap" style="min-width:90px;text-align:right">${money(p.budget || p.inv_total, p.currency, true)}</b>${icon('chevron-right', 'i-sm')}</a>`
  }

  function detail(el) {
    const z = tree.zones.find(x => x.id === sel.zone)
    if (!z) { el.innerHTML = `<div class="card">${emptyState('map', 'Seleccioná una zona', 'O creá una nueva para empezar a organizar las fincas y proyectos.')}</div>`; paintIcons(el); return }
    const farms = farmsOf(z.id).filter(f => !sel.farm || f.id === sel.farm)
    const zp = projOf(p => p.zone_id == z.id)
    const loose = projOf(p => p.zone_id == z.id && !p.farm_id)
    el.innerHTML = `<div class="card zone-card">
      <div class="zone-banner"><div class="row" style="position:relative;z-index:1;align-items:flex-start">
        <div class="grow"><div class="xs bold" style="letter-spacing:.16em;text-transform:uppercase;color:#B9DB8E">${icon('map-pin', 'i-xs')} Zona · ${esc([z.locality, z.province].filter(Boolean).join(', '))}</div><h2 style="font-size:26px;margin-top:6px">${esc(z.name)}</h2><p style="color:#C9DCD2" class="small mt-1">${esc(z.description || '')}</p></div>
        ${can('zones.manage') ? `<button class="btn btn-sm" id="edit-zone" style="background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.2)">${icon('pencil', 'i-sm')} Editar</button>` : ''}</div>
        <div class="hero-stats" style="position:relative;z-index:1;padding-top:16px"><div class="hero-stat"><div class="v">${farmsOf(z.id).length}</div><div class="l">Fincas</div></div><div class="hero-stat"><div class="v">${zp.length}</div><div class="l">Proyectos</div></div><div class="hero-stat"><div class="v">${zp.reduce((a, p) => a + p.inv_count, 0)}</div><div class="l">Inversiones</div></div><div class="hero-stat accent"><div class="v">${money(sum(zp), 'USD', true)}</div><div class="l">Presupuesto</div></div></div>
      </div>
      <div class="card-body">
        ${farms.map(f => {
          const fp = projOf(p => p.farm_id == f.id)
          return `<div class="farm-block"><div class="row mb-2"><span class="file-ico tone-sun">${icon('trees', 'i-sm')}</span><div class="grow"><h3>${esc(f.name)}</h3><div class="xs muted">${esc(f.address || '')}${f.hectares ? ` · ${f.hectares} ha` : ''}</div></div>
            <span class="small muted">${fp.length} proyectos · <b class="ink">${money(sum(fp), 'USD', true)}</b></span>
            ${can('projects.create') ? `<a class="btn btn-sm" href="#/projects/new" data-newin="${f.id}">${icon('plus', 'i-sm')} Proyecto</a>` : ''}${can('farms.manage') ? `<button class="btn btn-ghost btn-sm btn-icon" data-editfarm="${f.id}">${icon('pencil', 'i-sm')}</button>` : ''}</div>
            <div class="stack" style="gap:8px">${fp.map(projCard).join('') || '<div class="small muted" style="padding:6px 2px">Sin proyectos en esta finca todavía.</div>'}</div></div>`
        }).join('')}
        ${!sel.farm && loose.length ? `<div class="farm-block"><div class="row mb-2"><span class="file-ico tone-green">${icon('map-pin', 'i-sm')}</span><h3 class="grow">Proyectos a nivel zona</h3></div><div class="stack" style="gap:8px">${loose.map(projCard).join('')}</div></div>` : ''}
        ${!farms.length && !loose.length ? emptyState('trees', 'Sin fincas en esta zona', 'Agregá la primera finca para organizar los proyectos.') : ''}
      </div></div>`
    paintIcons(el)
    el.querySelector('#edit-zone')?.addEventListener('click', () => editZone(z))
    el.querySelectorAll('[data-editfarm]').forEach(b => b.onclick = () => editFarm(tree.farms.find(f => f.id == b.dataset.editfarm)))
  }

  function editZone(z) {
    const m = modal({ title: 'Editar zona', icon: 'map-pin', body: `<div class="form-grid"><div class="field w-full"><label>Nombre</label><input class="input" id="n" value="${esc(z.name)}"></div><div class="field w-half"><label>Localidad</label><input class="input" id="l" value="${esc(z.locality || '')}"></div><div class="field w-half"><label>Provincia</label><input class="input" id="p" value="${esc(z.province || '')}"></div><div class="field w-full"><label>Descripción</label><input class="input" id="d" value="${esc(z.description || '')}"></div><div class="field w-third"><label>Color</label><input type="color" class="color-input" id="c" value="${esc(z.color || '#4F8226')}"></div></div>`,
      foot: `<button class="btn btn-danger" id="del">${icon('trash-2', 'i-sm')} Eliminar</button><span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">Guardar</button>` })
    m.$('#ok').onclick = async () => { try { await api.put(`zones/${z.id}`, { name: m.$('#n').value, locality: m.$('#l').value, province: m.$('#p').value, description: m.$('#d').value, color: m.$('#c').value }); await window.__reloadBoot(); tree = await api.get('tree'); m.close(); render(); toast('Zona actualizada') } catch (e) { handleErr(e) } }
    m.$('#del').onclick = async () => { if (await confirmDialog({ title: 'Eliminar zona', message: 'Sólo se puede eliminar si no tiene proyectos.', danger: true, confirm: 'Eliminar' })) try { await api.del(`zones/${z.id}`); await window.__reloadBoot(); tree = await api.get('tree'); sel = { zone: null, farm: null }; m.close(); render(); toast('Zona eliminada') } catch (e) { handleErr(e) } }
  }
  function editFarm(f) {
    const m = modal({ title: 'Editar finca', icon: 'trees', tone: 'tone-sun', body: `<div class="form-grid"><div class="field w-full"><label>Nombre</label><input class="input" id="n" value="${esc(f.name)}"></div><div class="field w-two_thirds"><label>Domicilio</label><input class="input" id="a" value="${esc(f.address || '')}"></div><div class="field w-third"><label>Hectáreas</label><input class="input" type="number" id="h" value="${esc(f.hectares || '')}"></div><div class="field w-full"><label>Notas</label><input class="input" id="o" value="${esc(f.notes || '')}"></div></div>`,
      foot: `<button class="btn btn-danger" id="del">${icon('trash-2', 'i-sm')} Eliminar</button><span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ok">Guardar</button>` })
    m.$('#ok').onclick = async () => { try { await api.put(`farms/${f.id}`, { name: m.$('#n').value, address: m.$('#a').value, hectares: Number(m.$('#h').value) || null, notes: m.$('#o').value }); await window.__reloadBoot(); tree = await api.get('tree'); m.close(); render(); toast('Finca actualizada') } catch (e) { handleErr(e) } }
    m.$('#del').onclick = async () => { if (await confirmDialog({ title: 'Eliminar finca', message: 'Sólo se puede eliminar si no tiene proyectos.', danger: true, confirm: 'Eliminar' })) try { await api.del(`farms/${f.id}`); await window.__reloadBoot(); tree = await api.get('tree'); sel.farm = null; m.close(); render(); toast('Finca eliminada') } catch (e) { handleErr(e) } }
  }
  render()
}
