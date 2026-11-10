import { state, api, esc, icon, paintIcons, avatar, md, fdate, parseDate, roleOf, B, handleErr, canWrite, can } from '../lib.js'

/**
 * Chat embebible. scope: { project_id, investment_id?, task_id? }
 * Devuelve { destroy } — hace polling cada 8s mientras está montado.
 */
export function mountChat(container, scope, { placeholder = 'Escribí un mensaje… usá @ para mencionar', height = '' } = {}) {
  container.innerHTML = `<div class="chat" style="${height ? `height:${height}` : ''}">
    <div class="chat-scroll" id="chat-scroll"><div class="empty small">Cargando conversación…</div></div>
    ${can('chat.write') ? `<form class="composer" id="composer">
      <textarea id="chat-input" rows="1" placeholder="${esc(placeholder)}" aria-label="Mensaje"></textarea>
      <button class="btn btn-primary btn-icon" style="height:42px;width:42px" type="submit" title="Enviar (Enter)">${icon('send-horizontal', 'i-sm')}</button>
    </form>` : '<div class="composer muted small">Perfil de sólo lectura</div>'}
  </div>`
  paintIcons(container)
  const scroll = container.querySelector('#chat-scroll')
  const input = container.querySelector('#chat-input')
  let lastId = 0, msgs = [], alive = true

  const q = new URLSearchParams({ project_id: scope.project_id })
  if (scope.task_id) q.set('task_id', scope.task_id)
  else if (scope.investment_id) q.set('investment_id', scope.investment_id)
  else if (scope.all) q.set('scope', 'all')

  function render(stick = true) {
    if (!msgs.length) { scroll.innerHTML = `<div class="empty"><div class="ill">${icon('messages-square')}</div><h4>Sin mensajes todavía</h4><p class="small">Iniciá la conversación. Todo queda registrado con fecha y autor.</p></div>`; paintIcons(scroll); return }
    let lastDay = ''
    const nearBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 120
    scroll.innerHTML = msgs.map(m => {
      const d = parseDate(m.created_at)
      const day = d.toDateString()
      const sep = day !== lastDay ? `<div class="day-sep">${fdate(m.created_at)}</div>` : ''
      lastDay = day
      const tm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      if (m.kind === 'system') return `${sep}<div class="msg system"><div class="sys">${icon('sparkle', 'i-xs')} ${md(m.body)} <span class="subtle">· ${tm}</span></div></div>`
      const me = m.user_id === state.user.id
      return `${sep}<div class="msg ${me ? 'me' : ''}">${avatar(m.user_name, m.avatar_color, 'sm')}<div class="bubble"><div class="who">${me ? 'Vos' : esc(m.user_name)}<span class="rl">${esc(roleOf(m.functional_role).name !== '—' ? roleOf(m.functional_role).name : '')}</span>${m.inv_code && !scope.investment_id ? `<span class="inv-tag">${esc(m.inv_code)}</span>` : ''}<span class="tm">${tm}</span></div><div class="body">${md(m.body)}</div></div></div>`
    }).join('')
    paintIcons(scroll)
    if (stick || nearBottom) scroll.scrollTop = scroll.scrollHeight
  }

  async function load(initial = false) {
    try {
      const qq = new URLSearchParams(q); if (!initial && lastId) qq.set('after', lastId)
      const { messages } = await api.get('messages?' + qq)
      if (initial) msgs = messages; else if (messages.length) msgs = msgs.concat(messages.filter(m => !msgs.some(x => x.id === m.id)))
      if (msgs.length) lastId = msgs[msgs.length - 1].id
      if (initial || messages.length) render(initial)
    } catch (e) { if (initial) scroll.innerHTML = `<div class="empty small">${esc(e.message)}</div>` }
  }
  load(true)
  const timer = setInterval(() => { if (!alive || !document.body.contains(container)) { clearInterval(timer); return } if (!document.hidden) load() }, 8000)

  // Composer + menciones
  if (input) {
    const form = container.querySelector('#composer')
    let pop = null, hl = 0, matches = []
    const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(160, input.scrollHeight) + 'px' }
    const closePop = () => { pop?.remove(); pop = null }
    const showPop = () => {
      const caret = input.selectionStart
      const before = input.value.slice(0, caret)
      const m = before.match(/@([\wÁÉÍÓÚÑáéíóúñ]*)$/)
      if (!m) return closePop()
      const term = m[1].toLowerCase()
      matches = B().users.filter(u => u.active && u.id !== state.user.id && u.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(term.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))).slice(0, 6)
      if (!matches.length) return closePop()
      hl = Math.min(hl, matches.length - 1)
      if (!pop) { pop = document.createElement('div'); pop.className = 'mention-pop'; form.appendChild(pop) }
      pop.innerHTML = matches.map((u, i) => `<div class="opt ${i === hl ? 'hl' : ''}" data-i="${i}">${avatar(u.name, u.avatar_color, 'xs')}<span class="grow"><b>${esc(u.name)}</b><div class="xs muted">${esc(roleOf(u.functional_role).name)}</div></span></div>`).join('')
      pop.querySelectorAll('.opt').forEach(o => o.onmousedown = (e) => { e.preventDefault(); pick(matches[o.dataset.i]) })
    }
    const pick = (u) => {
      const caret = input.selectionStart
      const before = input.value.slice(0, caret).replace(/@([\wÁÉÍÓÚÑáéíóúñ]*)$/, '@' + u.name.replace(/^(Ing\.|Lic\.)\s*/, '').split(' ')[0] + ' ')
      input.value = before + input.value.slice(caret)
      input.focus(); input.selectionStart = input.selectionEnd = before.length
      closePop()
    }
    input.addEventListener('input', () => { autosize(); showPop() })
    input.addEventListener('keydown', (e) => {
      if (pop) {
        if (e.key === 'ArrowDown') { hl = (hl + 1) % matches.length; showPop(); e.preventDefault(); return }
        if (e.key === 'ArrowUp') { hl = (hl - 1 + matches.length) % matches.length; showPop(); e.preventDefault(); return }
        if (e.key === 'Enter' || e.key === 'Tab') { pick(matches[hl]); e.preventDefault(); return }
        if (e.key === 'Escape') { closePop(); return }
      }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit() }
    })
    input.addEventListener('blur', () => setTimeout(closePop, 150))
    form.onsubmit = async (e) => {
      e.preventDefault()
      const body = input.value.trim(); if (!body) return
      input.value = ''; autosize()
      try {
        await api.post('messages', { project_id: scope.project_id, investment_id: scope.investment_id || null, task_id: scope.task_id || null, body })
        await load()
      } catch (err) { handleErr(err); input.value = body }
    }
  }
  return { destroy: () => { alive = false; clearInterval(timer) }, reload: () => load(true) }
}
