// =====================================================================
// RIMI Hub · librería de UI (sin dependencias de framework)
// =====================================================================

export const state = { boot: null, user: null, company: null, unread: 0, cache: {} }

// ------------------------------------------------------------------ API
export async function api(path, opts = {}) {
  const init = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' }
  if (opts.body instanceof FormData) init.body = opts.body
  else if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body) }
  const res = await fetch(path.startsWith('/') ? path : '/api/' + path, init)
  let data = null
  try { data = await res.json() } catch { data = {} }
  if (res.status === 401 && !path.includes('/auth/')) { location.hash = '#/login'; throw new Error('Sesión vencida') }
  if (!res.ok) {
    const e = new Error(data?.error || `Error ${res.status}`)
    e.status = res.status; e.data = data
    throw e
  }
  return data
}
api.get = (p) => api(p)
api.post = (p, body) => api(p, { method: 'POST', body })
api.put = (p, body) => api(p, { method: 'PUT', body })
api.del = (p) => api(p, { method: 'DELETE' })

// ------------------------------------------------------------------ helpers
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const $ = (sel, root = document) => root.querySelector(sel)
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
export const icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}"></i>`
export function paintIcons(root) { if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 }, nameAttr: 'data-lucide', ...(root ? { root } : {}) }) }

export function initials(name = '') {
  const parts = name.replace(/^(Ing\.|Lic\.|Cr\.|Dr\.)\s*/i, '').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}
export function avatar(name, color, size = '') {
  return `<span class="avatar ${size}" style="background:${esc(color || '#4F8226')}" title="${esc(name)}">${esc(initials(name))}</span>`
}

export function money(v, cur = 'USD', compact = false) {
  if (v === null || v === undefined || v === '' || isNaN(v)) return '—'
  const n = Number(v)
  if (compact && Math.abs(n) >= 1000) {
    const units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']]
    for (const [d, s] of units) if (Math.abs(n) >= d) return `${cur === 'ARS' ? '$' : cur === 'EUR' ? '€' : 'US$'} ${(n / d).toLocaleString('es-AR', { maximumFractionDigits: 1 })}${s}`
  }
  return `${cur === 'ARS' ? '$' : cur === 'EUR' ? '€' : 'US$'} ${n.toLocaleString('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 })}`
}
export const num = (v, d = 0) => v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('es-AR', { maximumFractionDigits: d })

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
export function parseDate(s) {
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T12:00:00')
  return new Date(s.replace(' ', 'T') + (s.includes('Z') || s.includes('+') ? '' : 'Z'))
}
export function fdate(s, withYear = true) {
  const d = parseDate(s); if (!d || isNaN(d)) return '—'
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`
}
export function fdatetime(s) {
  const d = parseDate(s); if (!d || isNaN(d)) return '—'
  return `${fdate(s)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function ago(s) {
  const d = parseDate(s); if (!d) return ''
  const sec = (Date.now() - d.getTime()) / 1000
  if (sec < 60) return 'recién'
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} min`
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)} h`
  if (sec < 86400 * 7) return `hace ${Math.floor(sec / 86400)} d`
  return fdate(s)
}
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export function daysUntil(s) { const d = parseDate(s); if (!d) return null; const t = parseDate(todayISO()); return Math.round((d - t) / 86400000) }
export function dueBadge(s, done = false) {
  if (!s) return '<span class="due">Sin fecha</span>'
  if (done) return `<span class="due">${icon('calendar-check', 'i-xs')} ${fdate(s, false)}</span>`
  const n = daysUntil(s)
  const cls = n < 0 ? 'over' : n <= 2 ? 'soon' : ''
  const txt = n < 0 ? `Vencida ${-n}d` : n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : fdate(s, false)
  return `<span class="due ${cls}">${icon(n < 0 ? 'alarm-clock' : 'calendar', 'i-xs')} ${txt}</span>`
}

export function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) } }
export function qs() { const h = location.hash; const i = h.indexOf('?'); return new URLSearchParams(i >= 0 ? h.slice(i + 1) : '') }
export function setQS(params) {
  const h = location.hash.split('?')[0]
  const p = qs(); for (const [k, v] of Object.entries(params)) { if (v === null || v === undefined || v === '') p.delete(k); else p.set(k, v) }
  const s = p.toString()
  history.replaceState(null, '', h + (s ? '?' + s : ''))
}

// Markdown mínimo seguro (negrita, citas, menciones)
export function md(s) {
  let h = esc(s)
  h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  h = h.replace(/(^|\n)&gt; ?(.*)/g, '$1<blockquote>$2</blockquote>')
  h = h.replace(/(^|\s)@([\wÁÉÍÓÚÑáéíóúñ.]+)/g, '$1<span class="mention">@$2</span>')
  return h
}

// ------------------------------------------------------------------ catálogos
export const B = () => state.boot
export const stageOf = (key, entity = 'project') => B().stages.find(s => s.entity === entity && s.key === key) || { name: key || '—', color: '#94A3B8', icon: 'circle' }
export const stagesFor = (entity = 'project') => B().stages.filter(s => s.entity === entity).sort((a, b) => a.sort - b.sort)
export const roleOf = (key) => B().roles.find(r => r.key === key) || { name: key || '—', color: '#64748B', icon: 'user' }
export const typeOf = (id) => B().project_types.find(t => t.id == id) || { name: '—', color: '#64748B', icon: 'folder' }
export const userOf = (id) => B().users.find(u => u.id == id)
export const zoneOf = (id) => B().zones.find(z => z.id == id)
export const farmOf = (id) => B().farms.find(f => f.id == id)
export const companyOf = (id) => B().companies.find(c => c.id == id)
export const isAdmin = () => state.user?.system_role === 'admin'
/** Permiso efectivo (perfil ∪ rol funcional). Admin = todos. */
export const can = (perm) => isAdmin() || (state.user?.perms || []).includes(perm)
/** Responsable del proyecto: siempre puede editar su proyecto aunque su perfil no tenga el permiso general */
export const isOwner = (p) => !!p && p.responsible_id === state.user?.id
export const canWrite = () => isAdmin() || (state.user?.perms || []).length > 0
export const isRimi = () => can('projects.stage')
export const canFiscal = () => can('projects.dictamen')
export const profileOf = (key) => (B()?.profiles || []).find(p => p.key === key) || { key, name: key || '—', color: '#64748B' }

export function hexA(hex, a) {
  const h = (hex || '#4F8226').replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
export function stagePill(key, entity = 'project') {
  const s = stageOf(key, entity)
  return `<span class="stage-pill" style="background:${hexA(s.color, .14)};color:${s.color === '#94A3B8' ? '#5E6E6A' : s.color}">${icon(s.icon, 'i-xs')} ${esc(s.short_name || s.name)}</span>`
}
export function eligBadge(e) {
  const map = { 'General elegible': 'green', 'Específica elegible': 'sky', 'No elegible': 'rose', 'Pendiente de validación': 'sun' }
  if (!e) return '<span class="badge">Sin dictamen</span>'
  return `<span class="badge ${map[e] || ''}"><span class="d"></span>${esc(e)}</span>`
}
export function typeIcon(t, size = 44) {
  return `<span class="type-ico" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * .3)}px;display:grid;place-items:center;background:${hexA(t.color || t.type_color, .14)};color:${t.color || t.type_color}">${icon(t.icon || t.type_icon || 'folder')}</span>`
}
export const TASK_STATUS = {
  pendiente: { label: 'Pendiente', color: '#64748B', icon: 'circle' },
  en_curso: { label: 'En curso', color: '#0A88C9', icon: 'loader' },
  bloqueada: { label: 'Bloqueada', color: '#BE123C', icon: 'octagon-pause' },
  completada: { label: 'Completada', color: '#4F8226', icon: 'circle-check' }
}
export const PRIORITY = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' }

// ------------------------------------------------------------------ toasts
export function toast(msg, type = 'ok') {
  const el = document.createElement('div')
  el.className = `toast ${type === 'error' ? 'error' : type === 'warn' ? 'warn' : ''}`
  el.innerHTML = `<span class="ti">${icon(type === 'error' ? 'circle-alert' : type === 'warn' ? 'triangle-alert' : 'check')}</span><span>${esc(msg)}</span>`
  $('#toasts').appendChild(el); paintIcons(el)
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300) }, type === 'error' ? 5200 : 3200)
}
export function handleErr(e) { console.error(e); toast(e.message || 'Ocurrió un error', 'error') }

// ------------------------------------------------------------------ modal / drawer
const openModals = new Set()
/** Cierra todos los modales sin ejecutar onClose (se usa al cambiar de ruta) */
export function closeAllModals() { for (const m of [...openModals]) m.silentClose() }

export function modal({ title, subtitle, icon: ic, tone = 'tone-green', body, size = '', foot, onMount, drawer = false, onClose }) {
  const root = $('#modal-root')
  const ov = document.createElement('div')
  ov.className = 'overlay' + (drawer ? ' drawer-overlay' : '')
  ov.innerHTML = drawer
    ? `<aside class="drawer ${size}" role="dialog" aria-modal="true"><header class="drawer-head">${ic ? `<span class="modal-head mi ${tone}" style="padding:0;width:42px;height:42px;border-radius:13px;display:grid;place-items:center">${icon(ic)}</span>` : ''}<div class="grow"><h2 style="font-size:18px">${title || ''}</h2>${subtitle ? `<p class="muted small mt-1">${subtitle}</p>` : ''}</div><button class="btn btn-ghost btn-icon x" data-close aria-label="Cerrar">${icon('x')}</button></header><div class="drawer-body">${body || ''}</div>${foot ? `<footer class="modal-foot" style="border-radius:0">${foot}</footer>` : ''}</aside>`
    : `<div class="modal ${size}" role="dialog" aria-modal="true"><header class="modal-head">${ic ? `<span class="mi ${tone}">${icon(ic)}</span>` : ''}<div class="grow"><h2>${title || ''}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div><button class="btn btn-ghost btn-icon x" data-close aria-label="Cerrar">${icon('x')}</button></header><div class="modal-body">${body || ''}</div>${foot ? `<footer class="modal-foot">${foot}</footer>` : ''}</div>`
  root.appendChild(ov)
  const entry = {}
  const teardown = () => { ov.remove(); document.removeEventListener('keydown', onKey); openModals.delete(entry) }
  const close = () => { if (!ov.isConnected) return; teardown(); onClose && onClose() }
  entry.silentClose = teardown
  openModals.add(entry)
  const onKey = (e) => { if (e.key === 'Escape' && root.lastElementChild === ov) close() }
  document.addEventListener('keydown', onKey)
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close() })
  ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close))
  paintIcons(ov)
  const api = { el: ov, close, $: (s) => ov.querySelector(s), $$: (s) => [...ov.querySelectorAll(s)] }
  onMount && onMount(api)
  setTimeout(() => ov.querySelector('[autofocus], .modal-body input:not([type=hidden]):not([readonly]), .modal-body select, .modal-body textarea')?.focus(), 60)
  return api
}

export function confirmDialog({ title = '¿Confirmar?', message = '', confirm = 'Confirmar', danger = false }) {
  return new Promise(resolve => {
    let done = false
    const m = modal({
      title, icon: danger ? 'triangle-alert' : 'circle-help', tone: danger ? 'tone-rose' : 'tone-green', size: 'sm',
      body: `<p class="muted">${message}</p>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${confirm}</button>`,
      onClose: () => { if (!done) resolve(false) }
    })
    m.$('[data-ok]').addEventListener('click', () => { done = true; m.close(); resolve(true) })
  })
}

export function promptDialog({ title, label, value = '', placeholder = '', confirm = 'Guardar', textarea = false }) {
  return new Promise(resolve => {
    let done = false
    const m = modal({
      title, icon: 'pencil', size: 'sm',
      body: `<div class="field"><label>${esc(label)}</label>${textarea ? `<textarea class="textarea" id="pd">${esc(value)}</textarea>` : `<input class="input" id="pd" value="${esc(value)}" placeholder="${esc(placeholder)}">`}</div>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" data-ok>${confirm}</button>`,
      onClose: () => { if (!done) resolve(null) }
    })
    const ok = () => { done = true; const v = m.$('#pd').value; m.close(); resolve(v) }
    m.$('[data-ok]').addEventListener('click', ok)
    if (!textarea) m.$('#pd').addEventListener('keydown', e => { if (e.key === 'Enter') ok() })
  })
}

// ------------------------------------------------------------------ popover
let openPop = null
export function popover(anchor, html, { align = 'right', width, onMount } = {}) {
  closePopover()
  const el = document.createElement('div')
  el.className = 'popover'
  el.innerHTML = html
  if (width) el.style.width = width + 'px'
  document.body.appendChild(el)
  const r = anchor.getBoundingClientRect()
  const w = el.offsetWidth, h = el.offsetHeight
  let left = align === 'right' ? r.right - w : r.left
  left = Math.max(10, Math.min(left, innerWidth - w - 10))
  let top = r.bottom + 8
  if (top + h > innerHeight - 10) top = Math.max(10, r.top - h - 8)
  el.style.left = left + 'px'; el.style.top = top + 'px'
  paintIcons(el)
  const off = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover() }
  setTimeout(() => document.addEventListener('mousedown', off), 0)
  openPop = { el, off }
  onMount && onMount(el)
  return el
}
export function closePopover() {
  if (openPop) { openPop.el.remove(); document.removeEventListener('mousedown', openPop.off); openPop = null }
}

// ------------------------------------------------------------------ formulario dinámico (constructor)
const NCM_RE = /^\d{4}\.\d{2}\.\d{2}$/

export function fieldOptions(f) {
  return (f.options || '').split('|').map(s => s.trim()).filter(Boolean)
}

export function renderField(f, value, { disabled = false, ctx = {} } = {}) {
  const id = `f_${f.key}`
  const ro = disabled || f.readonly
  const req = f.required ? '<span class="req">*</span>' : ''
  const v = value ?? ''
  let input = ''
  const common = `id="${id}" name="${esc(f.key)}" data-field="${esc(f.key)}" ${ro ? 'disabled' : ''} ${f.required ? 'data-required="1"' : ''}`
  switch (f.type) {
    case 'textarea':
      input = `<textarea class="textarea" ${common} placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`; break
    case 'select':
      input = `<select class="select" ${common}><option value="">Seleccionar…</option>${fieldOptions(f).map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; break
    case 'multiselect': {
      const arr = Array.isArray(v) ? v : String(v || '').split('|').filter(Boolean)
      input = `<div class="row row-wrap" data-multi="${esc(f.key)}">${fieldOptions(f).map(o => `<label class="check"><input type="checkbox" value="${esc(o)}" ${arr.includes(o) ? 'checked' : ''} ${ro ? 'disabled' : ''}> ${esc(o)}</label>`).join('')}</div>`; break
    }
    case 'checkbox':
      input = `<label class="check"><input type="checkbox" ${common} ${v === true || v === 1 || v === '1' || v === 'Sí' ? 'checked' : ''}> ${esc(f.placeholder || 'Sí')}</label>`; break
    case 'number':
      input = `<input type="number" step="any" class="input" ${common} value="${esc(v)}" placeholder="${esc(f.placeholder || '')}">`; break
    case 'money':
      input = `<div class="input-group"><span class="prefix">${esc(ctx.currency || 'USD')}</span><input type="number" step="0.01" min="0" class="input" ${common} value="${esc(v)}" placeholder="0,00"></div>`; break
    case 'date':
      input = `<input type="date" class="input" ${common} value="${esc(v)}">`; break
    case 'email': input = `<input type="email" class="input" ${common} value="${esc(v)}" placeholder="${esc(f.placeholder || '')}">`; break
    case 'url': input = `<input type="url" class="input" ${common} value="${esc(v)}" placeholder="${esc(f.placeholder || 'https://')}">`; break
    case 'phone': input = `<input type="tel" class="input" ${common} value="${esc(v)}" placeholder="${esc(f.placeholder || '')}">`; break
    case 'ncm':
      input = `<input class="input mono" ${common} value="${esc(v)}" placeholder="${esc(f.placeholder || '0000.00.00')}" maxlength="14" data-ncm="1">`; break
    case 'user':
      input = `<select class="select" ${common}><option value="">Sin asignar</option>${B().users.filter(u => u.active || u.id == v).map(u => `<option value="${u.id}" ${u.id == v ? 'selected' : ''}>${esc(u.name)}${u.functional_role ? ' · ' + esc(roleOf(u.functional_role).name) : ''}</option>`).join('')}</select>`; break
    case 'company':
      input = `<select class="select" ${common}>${B().companies.filter(c => c.active || c.id == v).map(c => `<option value="${c.id}" ${c.id == v ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`; break
    case 'zone': {
      const zs = B().zones.filter(z => !ctx.company_id || z.company_id == ctx.company_id)
      input = `<select class="select" ${common}><option value="">Seleccionar zona…</option>${zs.map(z => `<option value="${z.id}" ${z.id == v ? 'selected' : ''}>${esc(z.name)}${z.province ? ' · ' + esc(z.province) : ''}</option>`).join('')}</select>`; break
    }
    case 'farm': {
      const fs = B().farms.filter(x => !ctx.zone_id || x.zone_id == ctx.zone_id)
      input = `<select class="select" ${common}><option value="">Sin finca específica</option>${fs.map(x => `<option value="${x.id}" ${x.id == v ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`; break
    }
    case 'project_type':
      input = `<select class="select" ${common}><option value="">Seleccionar…</option>${B().project_types.filter(t => t.active || t.id == v).map(t => `<option value="${t.id}" ${t.id == v ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`; break
    default:
      input = `<input class="input" ${common} value="${esc(v)}" placeholder="${esc(f.placeholder || '')}">`
  }
  return `<div class="field w-${f.width || 'half'}"><label for="${id}">${esc(f.label)} ${req}</label>${input}${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`
}

export function readForm(root, fields) {
  const out = {}
  for (const f of fields) {
    if (f.type === 'multiselect') {
      const box = root.querySelector(`[data-multi="${f.key}"]`)
      if (box) out[f.key] = [...box.querySelectorAll('input:checked')].map(i => i.value).join('|')
      continue
    }
    const el = root.querySelector(`[data-field="${f.key}"]`)
    if (!el || el.disabled) continue
    if (f.type === 'checkbox') out[f.key] = el.checked ? 'Sí' : ''
    else if (['number', 'money'].includes(f.type)) out[f.key] = el.value === '' ? null : Number(el.value)
    else if (['user', 'company', 'zone', 'farm', 'project_type'].includes(f.type)) out[f.key] = el.value === '' ? null : Number(el.value)
    else out[f.key] = el.value.trim()
  }
  return out
}

export function validateForm(root, fields) {
  const errors = []
  root.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid'))
  for (const f of fields) {
    const el = root.querySelector(`[data-field="${f.key}"]`)
    if (!el || el.disabled) continue
    const v = el.value?.trim?.() ?? ''
    if (f.required && !v) { errors.push(f.label); el.classList.add('invalid') }
    if (f.type === 'ncm' && v && v.toLowerCase() !== 'pendiente' && !NCM_RE.test(v)) { errors.push(`${f.label} (formato 0000.00.00)`); el.classList.add('invalid') }
  }
  if (errors.length) root.querySelector('.invalid')?.focus()
  return errors
}

export function bindNcmMask(root) {
  root.querySelectorAll('[data-ncm]').forEach(el => el.addEventListener('input', () => {
    if (/[a-z]/i.test(el.value)) return
    const d = el.value.replace(/\D/g, '').slice(0, 8)
    el.value = d.length > 6 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}` : d.length > 4 ? `${d.slice(0, 4)}.${d.slice(4)}` : d
  }))
}

export const fieldsFor = (entity, section) => B().form_fields.filter(f => f.entity === entity && f.active && !f.deleted_at && (!section || f.section_key === section)).sort((a, b) => a.sort - b.sort)
export const sectionsFor = (entity) => B().form_sections.filter(s => s.entity === entity && s.active).sort((a, b) => a.sort - b.sort)

// Valor de campo de proyecto: core → columna; extra → data JSON
export function projectValue(p, f) {
  if (f.core) return p[f.key]
  return p.data?.[f.key]
}

export function ringSVG(pct, color = '#4F8226', size = 30) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(1, pct)))
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#EDF1EB" stroke-width="4"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`
}

export function emptyState(ic, title, text = '', action = '') {
  return `<div class="empty"><div class="ill">${icon(ic)}</div><h4>${esc(title)}</h4>${text ? `<p class="small">${text}</p>` : ''}${action ? `<div class="mt-3">${action}</div>` : ''}</div>`
}

export function fileIcon(mime = '', name = '') {
  const n = name.toLowerCase()
  if (mime.includes('pdf') || n.endsWith('.pdf')) return ['file-text', 'tone-rose']
  if (mime.includes('sheet') || n.match(/\.(xlsx?|csv)$/)) return ['file-spreadsheet', 'tone-green']
  if (mime.includes('image') || n.match(/\.(png|jpe?g|webp|gif)$/)) return ['image', 'tone-violet']
  if (mime.includes('word') || n.match(/\.docx?$/)) return ['file-type', 'tone-sky']
  return ['file', 'tone-sun']
}
export function fsize(b) { if (!b) return ''; const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let n = b; while (n >= 1024 && i < 3) { n /= 1024; i++ } return `${n.toFixed(n < 10 && i ? 1 : 0)} ${u[i]}` }

export function downloadBlob(content, filename, type = 'text/csv;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1500)
}
export function toCSV(rows, cols) {
  const e = v => { const s = String(v ?? ''); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return '\uFEFF' + [cols.map(c => e(c.label)).join(';'), ...rows.map(r => cols.map(c => e(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(';'))].join('\n')
}
export async function ensureXLSX() {
  if (window.XLSX) return window.XLSX
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s) })
  return window.XLSX
}
