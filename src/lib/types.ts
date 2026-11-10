export type Bindings = {
  DB: D1Database
  FILES?: R2Bucket
  // Microsoft Entra ID (Azure AD) — configurar como secrets
  MS_TENANT_ID?: string
  MS_CLIENT_ID?: string
  MS_CLIENT_SECRET?: string
  APP_URL?: string
}

export type SessionUser = {
  id: number
  email: string
  name: string
  system_role: string // clave de profiles (admin | rimi | lider_proyecto | compras | impuestos | contabilidad | operativo | viewer | personalizados)
  functional_role: string | null
  position: string | null
  avatar_color: string | null
  auth_provider: string
  must_change_password: number
  perms?: string[]
}

export type Variables = {
  user: SessionUser
  companyIds: number[]
  perms: string[]
}

export type AppEnv = { Bindings: Bindings; Variables: Variables }
