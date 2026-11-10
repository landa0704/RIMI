-- ============================================================
-- 0003 · Perfiles configurables, permisos por rol funcional y papelera de campos
-- ============================================================

-- Perfiles de sistema (users.system_role referencia profiles.key)
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#4F8226',
  permissions TEXT DEFAULT '[]',
  is_system INTEGER DEFAULT 0,
  sort INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO profiles (key, name, description, color, permissions, is_system, sort) VALUES
 ('admin', 'Administrador', 'Acceso total y a Administración (usuarios, perfiles, formularios, flujo, integraciones).', '#00322B',
  '["zones.manage","farms.manage","projects.create","projects.edit","projects.stage","projects.dictamen","members.manage","projects.delete","investments.edit","investments.delete","documents.upload","documents.validate","documents.delete","tasks.create","tasks.manage","chat.write","config.workflow"]', 1, 1),
 ('rimi', 'Responsable RIMI', 'Coordina el régimen: dictamina, mueve etapas, valida documentos y administra la estructura de zonas y fincas.', '#4F8226',
  '["zones.manage","farms.manage","projects.create","projects.edit","projects.stage","projects.dictamen","members.manage","investments.edit","investments.delete","documents.upload","documents.validate","documents.delete","tasks.create","tasks.manage","chat.write","config.workflow"]', 1, 2),
 ('member', 'Colaborador', 'Trabaja en los proyectos: carga fichas, bienes, documentos, tareas y conversa con el equipo.', '#0A88C9',
  '["projects.create","projects.edit","investments.edit","documents.upload","tasks.create","chat.write"]', 1, 3),
 ('viewer', 'Sólo lectura', 'Consulta toda la información de sus empresas sin modificar nada (Dirección, auditoría).', '#64748B',
  '[]', 1, 4);

-- Permisos adicionales que otorga el rol funcional (se suman a los del perfil)
ALTER TABLE functional_roles ADD COLUMN permissions TEXT DEFAULT '[]';
UPDATE functional_roles SET permissions = '["farms.manage"]' WHERE key = 'resp_proyecto';
UPDATE functional_roles SET permissions = '["projects.dictamen","documents.validate"]' WHERE key = 'impuestos';
UPDATE functional_roles SET permissions = '["documents.validate"]' WHERE key = 'contabilidad';

-- Papelera de campos del constructor (quitar / restaurar)
ALTER TABLE form_fields ADD COLUMN deleted_at DATETIME;

-- Perfil con el que se crean los usuarios que ingresan por primera vez con Microsoft 365
INSERT OR IGNORE INTO settings (key, value) VALUES ('ms_default_profile', 'member');
