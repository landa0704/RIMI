import { state, api, esc, icon, paintIcons, avatar, roleOf, qs, toast, handleErr, B, profileOf } from '../lib.js'

export default async function (root) {
  const u = state.user
  const force = qs().get('force') === '1' || u.must_change_password
  const companies = B().companies
  root.innerHTML = `
  <div class="page-head"><div><div class="eyebrow">Cuenta</div><h1>Mi perfil</h1></div></div>
  ${force ? `<div class="alert warn mb-3">${icon('key-round', 'i-sm')}<span>Por seguridad, definí una contraseña personal antes de continuar.</span></div>` : ''}
  <div class="grid g-2">
    <div class="card card-pad"><div class="row">${avatar(u.name, u.avatar_color, 'xl')}<div><h2>${esc(u.name)}</h2><div class="muted">${esc(u.email)}</div><div class="row mt-2" style="gap:6px"><span class="badge dark">${esc(profileOf(u.system_role).name)}</span>${u.functional_role ? `<span class="badge green">${esc(roleOf(u.functional_role).name)}</span>` : ''}</div></div></div>
      <div class="divider"></div>
      <div class="stack" style="gap:10px">
        <div class="row small"><span class="muted grow">Cargo</span><b class="ink">${esc(u.position || '—')}</b></div>
        <div class="row small"><span class="muted grow">Acceso</span><b class="ink">${u.auth_provider === 'microsoft' ? 'Microsoft 365 (SSO)' : 'Usuario y contraseña'}</b></div>
        <div class="row small"><span class="muted grow">Empresas habilitadas</span><b class="ink">${companies.map(c => esc(c.name)).join(', ')}</b></div>
      </div></div>
    <div class="card"><div class="card-head"><h3>${icon('key-round', 'i-sm')} Cambiar contraseña</h3></div>
      <form class="card-body stack" id="pw" style="gap:12px">
        ${force ? '' : `<div class="field"><label>Contraseña actual</label><input type="password" class="input" id="cur" autocomplete="current-password"></div>`}
        <div class="field"><label>Nueva contraseña</label><input type="password" class="input" id="n1" autocomplete="new-password"><span class="help">Mínimo 8 caracteres, combinando letras y números.</span></div>
        <div class="field"><label>Repetir nueva contraseña</label><input type="password" class="input" id="n2" autocomplete="new-password"></div>
        <button class="btn btn-primary" type="submit">${icon('save', 'i-sm')} Actualizar contraseña</button>
        ${u.auth_provider === 'microsoft' ? `<p class="xs muted">${icon('info', 'i-xs')} Ingresás con Microsoft 365; la contraseña local es opcional.</p>` : ''}
      </form></div>
  </div>`
  paintIcons(root)
  root.querySelector('#pw').onsubmit = async (e) => {
    e.preventDefault()
    const n1 = root.querySelector('#n1').value, n2 = root.querySelector('#n2').value
    if (n1 !== n2) return toast('Las contraseñas no coinciden', 'warn')
    try {
      await api.post('/api/auth/password', { current: root.querySelector('#cur')?.value || '', next: n1 })
      state.user.must_change_password = 0
      toast('Contraseña actualizada')
      if (force) location.hash = '#/'
      else root.querySelector('#pw').reset()
    } catch (err) { handleErr(err) }
  }
}
