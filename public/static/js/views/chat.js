import { state, api, esc, icon, paintIcons, ago, md, qs, setQS, hexA, emptyState } from '../lib.js'
import { mountChat } from '../components/chat.js'

export default async function (root) {
  const { conversations } = await api.get('conversations')
  let sel = Number(qs().get('project')) || conversations.find(c => c.total)?.project_id || conversations[0]?.project_id
  let chat = null

  root.innerHTML = `
  <div class="page-head"><div><div class="eyebrow">Chat interno</div><h1>Conversaciones</h1><p class="sub">Un canal por proyecto (y por inversión). Todo queda registrado entre los usuarios para que el equipo esté al tanto.</p></div></div>
  <div class="card" style="display:grid;grid-template-columns:330px minmax(0,1fr);overflow:hidden;height:calc(100vh - 220px);min-height:520px">
    <aside style="border-right:1px solid var(--line-2);display:flex;flex-direction:column;min-height:0">
      <div style="padding:12px"><input class="input input-sm" id="cf" placeholder="Filtrar proyectos…"></div>
      <div id="clist" style="overflow:auto;flex:1"></div>
    </aside>
    <section style="display:flex;flex-direction:column;min-height:0" id="cpane"></section>
  </div>`
  const list = root.querySelector('#clist')
  const drawList = (f = '') => {
    const items = conversations.filter(c => !f || (c.name + c.code).toLowerCase().includes(f.toLowerCase()))
    list.innerHTML = items.map(c => `<div class="conv-item ${c.project_id === sel ? 'active' : ''}" data-p="${c.project_id}">
      <span style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex-shrink:0;background:${hexA(c.type_color, .14)};color:${c.type_color}">${icon(c.type_icon || 'folder', 'i-sm')}</span>
      <div class="grow" style="min-width:0"><div class="row between"><b class="small ink truncate">${esc(c.name)}</b><span class="xs subtle nowrap">${c.last_at ? ago(c.last_at) : ''}</span></div>
      <div class="xs muted truncate">${c.last_body ? `${esc(c.last_user || '')}: ${esc(c.last_body.replace(/\*\*/g, ''))}` : 'Sin mensajes'}</div></div></div>`).join('') || emptyState('messages-square', 'Sin proyectos')
    paintIcons(list)
    list.querySelectorAll('[data-p]').forEach(i => i.onclick = () => { sel = Number(i.dataset.p); setQS({ project: sel }); drawList(root.querySelector('#cf').value); open() })
  }
  const open = () => {
    const c = conversations.find(x => x.project_id === sel)
    const pane = root.querySelector('#cpane')
    if (!c) { pane.innerHTML = emptyState('messages-square', 'Elegí una conversación'); paintIcons(pane); return }
    pane.innerHTML = `<div class="card-head"><div class="grow"><h3>${esc(c.name)}</h3><div class="sub mono">${esc(c.code || '')} · ${c.total} mensajes</div></div><a class="btn btn-sm" href="#/projects/${c.project_id}?tab=chat">${icon('external-link', 'i-sm')} Abrir proyecto</a></div><div id="cbox" style="flex:1;min-height:0"></div>`
    paintIcons(pane)
    chat?.destroy()
    chat = mountChat(pane.querySelector('#cbox'), { project_id: c.project_id, all: true }, { height: '100%' })
  }
  root.querySelector('#cf').oninput = (e) => drawList(e.target.value)
  drawList(); open()
}
