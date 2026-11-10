-- ============================================================
-- 0004 · Proyectos Activo / Inactivo y código único
-- ============================================================

-- Estado del proyecto (columna ya existía con default 'activo'; sólo normalizamos valores vacíos)
UPDATE projects SET status = 'activo' WHERE status IS NULL OR status = '';

-- Nuevo permiso: activar / desactivar proyectos. Lo reciben el Admin y el Responsable RIMI por defecto.
UPDATE profiles SET permissions = json_insert(COALESCE(permissions, '[]'), '$[#]', 'projects.status')
  WHERE key IN ('admin', 'rimi') AND COALESCE(permissions, '') NOT LIKE '%"projects.status"%';

-- Búsqueda rápida para validar códigos únicos al dar de alta o duplicar
CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(code);
