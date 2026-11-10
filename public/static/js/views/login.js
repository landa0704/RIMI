import { api, esc, icon, paintIcons, qs, toast, daysUntil } from '../lib.js'

const DEMO = [
  ['Administrador', [['admin@phronesis.com.ar', 'Admin Phronesis', '#00322B']]]
]

export async function renderLogin(root) {
  let cfg = { microsoft: { enabled: true, configured: false }, local_login: true, program_start: '2026-12-01', app_name: 'RIMI Hub', group_name: 'Grupo Phronesis' }
  try { cfg = await api.get('/api/auth/config') } catch { }
  const error = qs().get('error')
  const d = Math.max(0, daysUntil(cfg.program_start) ?? 0)
  const isDemo = location.hostname.includes('sandbox') || location.hostname === 'localhost' || location.hostname.includes('e2b')

  root.innerHTML = `
  <div class="login">
    <section class="login-left">
      <div class="brand row"><img src="/static/img/solfrut-logo.png" alt="Solfrut"><span class="badge outline" style="margin-left:6px">${esc(cfg.group_name)}</span></div>
      <div class="login-form">
        <div class="xs bold" style="letter-spacing:.18em;color:var(--brand-600);text-transform:uppercase;margin-bottom:14px">Régimen de Incentivo para Medianas Inversiones</div>
        <h1>RIMI<span>.</span>Hub</h1>
        <p class="lead">Centralizá fichas, inversiones, documentación y responsables de cada proyecto, desde la ficha de apertura hasta la consolidación del beneficio en el SGI.</p>
        ${error ? `<div class="alert error mb-3">${icon('circle-alert', 'i-sm')} <span>${esc(error)}</span></div>` : ''}
        ${cfg.microsoft.enabled ? `
        <a class="btn btn-ms btn-block" href="/auth/microsoft" id="ms-btn">
          <span class="ms-logo"><span style="background:#F25022"></span><span style="background:#7FBA00"></span><span style="background:#00A4EF"></span><span style="background:#FFB900"></span></span>
          Ingresar con Microsoft 365
        </a>
        ${!cfg.microsoft.configured ? `<p class="xs muted mt-1" style="text-align:center">${icon('lock', 'i-xs')} Inicio corporativo disponible cuando Sistemas lo habilite.</p>` : ''}` : ''}
        ${cfg.local_login ? `
        ${cfg.microsoft.enabled ? '<div class="sep">o con tu usuario</div>' : ''}
        <form id="login-form" class="stack" style="gap:12px" novalidate>
          <div class="field"><label for="email">Correo corporativo</label><input class="input" id="email" type="email" autocomplete="username" placeholder="nombre@solfrut.com.ar" required></div>
          <div class="field"><label for="password">Contraseña</label>
            <div class="input-group"><input class="input" id="password" type="password" autocomplete="current-password" placeholder="••••••••" required style="padding-left:12px;padding-right:44px">
            <button type="button" class="btn btn-ghost btn-xs btn-icon" id="toggle-pw" style="position:absolute;right:8px" aria-label="Mostrar contraseña">${icon('eye', 'i-sm')}</button></div>
          </div>
          <button class="btn btn-primary btn-block" style="height:46px" type="submit" id="login-submit">${icon('log-in', 'i-sm')} Ingresar</button>
        </form>` : ''}
        ${isDemo && cfg.local_login ? `
        <details class="demo-toggle"><summary>${icon('flask-conical', 'i-xs')} Accesos de demostración (clave <span class="mono">Rimi2026!</span>)</summary>
        <div class="demo-groups">${DEMO.map(([g, list]) => `<div class="demo-group"><div class="demo-group-t">${g}</div><div class="demo-users">${list.map(([e, l, c]) => `<button type="button" data-demo="${e}" title="${e}"><span class="avatar xs" style="background:${c}">${l[0]}</span>${l}</button>`).join('')}</div></div>`).join('')}</div></details>` : ''}
              </div>
      <div class="login-foot">${icon('shield-check', 'i-xs')} Acceso identificado · Trazabilidad completa de cada acción · Procedimiento interno SolFrut</div>
    </section>
    <section class="login-right" aria-hidden="true">
      <div class="img" style="background-image:url('/static/img/hero.webp')"></div>
      <svg class="curve" viewBox="0 0 160 1000" preserveAspectRatio="none"><path d="M0,0 L70,0 C150,180 30,330 90,520 C140,690 60,840 120,1000 L0,1000 Z" fill="#FAFBF7"/></svg>
      <div class="glass">
        <h3>${icon('calendar-clock', 'i-sm')} Arranque operativo · 1 de diciembre</h3>
        <p>Alta de proyectos, fichas de apertura y desglose de inversiones por zona y finca.</p>
        <div class="countdown"><div><b>${d}</b><span>días</span></div><div><b>5</b><span>días háb. dictamen</span></div><div><b>10</b><span>días háb. ficha</span></div></div>
      </div>
    </section>
  </div>`
  paintIcons(root)

  const form = root.querySelector('#login-form')
  if (form) {
    root.querySelector('#toggle-pw').onclick = () => { const p = root.querySelector('#password'); p.type = p.type === 'password' ? 'text' : 'password' }
    form.onsubmit = async (e) => {
      e.preventDefault()
      const btn = root.querySelector('#login-submit')
      btn.disabled = true; btn.innerHTML = 'Ingresando…'
      try {
        await api.post('/api/auth/login', { email: root.querySelector('#email').value, password: root.querySelector('#password').value })
        const { loadBoot, route } = await import('../main.js')
        await loadBoot()
        history.replaceState(null, '', '#/')
        route()
      } catch (err) {
        toast(err.message, 'error')
        btn.disabled = false; btn.innerHTML = `${icon('log-in', 'i-sm')} Ingresar`; paintIcons(btn)
      }
    }
    root.querySelectorAll('[data-demo]').forEach(b => b.onclick = () => {
      root.querySelector('#email').value = b.dataset.demo
      root.querySelector('#password').value = 'Rimi2026!'
      form.requestSubmit()
    })
  }
}
