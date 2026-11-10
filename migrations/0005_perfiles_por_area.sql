-- ============================================================
-- 0005 · Perfiles por área (según "usuarios iniciales", al 6-11-2026)
-- Se elimina el perfil "Colaborador" (member) y se reemplaza por perfiles
-- específicos: Líder de proyecto, Compras, Impuestos, Contabilidad y
-- Administración/Tesorería/Técnico. Administrador, Responsable RIMI y
-- Sólo lectura se mantienen.
-- ============================================================

INSERT OR IGNORE INTO profiles (key, name, description, color, permissions, is_system, sort) VALUES
 ('lider_proyecto', 'Líder de proyecto', 'Responsable del Proyecto: crea fincas y proyectos, edita su proyecto completo, sube documentos, crea tareas y escribe en el chat.', '#4F8226',
  '["farms.manage","projects.create","projects.edit","investments.edit","documents.upload","tasks.create","chat.write"]', 1, 3),
 ('compras', 'Compras', 'Proyectos y bienes (proveedores, órdenes de compra), sube documentos y avanza desde Contratación.', '#0A88C9',
  '["projects.create","projects.edit","investments.edit","documents.upload","tasks.create","chat.write"]', 1, 4),
 ('impuestos', 'Impuestos', 'Lo del líder de proyecto más dictamen fiscal (elegibilidad, NCM, BK/BIT) y validación de documentos.', '#C2410C',
  '["projects.create","projects.edit","investments.edit","documents.upload","tasks.create","chat.write","projects.dictamen","documents.validate"]', 1, 5),
 ('contabilidad', 'Contabilidad', 'Lo del líder de proyecto más validación de documentos. No dictamina ni cierra proyectos.', '#6FA137',
  '["projects.create","projects.edit","investments.edit","documents.upload","tasks.create","chat.write","documents.validate"]', 1, 6),
 ('operativo', 'Administración, tesorería y técnico', 'Sube comprobantes e informes, completa sus tareas y escribe en el chat. No valida documentos ni mueve etapas.', '#1F3A5F',
  '["documents.upload","chat.write"]', 1, 7);

UPDATE profiles SET sort = 8 WHERE key = 'viewer';

-- Reasigna a los usuarios que estaban en el perfil Colaborador según su rol funcional
UPDATE users SET system_role = CASE
    WHEN functional_role = 'resp_rimi' THEN 'rimi'
    WHEN functional_role = 'resp_proyecto' THEN 'lider_proyecto'
    WHEN functional_role = 'compras' THEN 'compras'
    WHEN functional_role = 'impuestos' THEN 'impuestos'
    WHEN functional_role = 'contabilidad' THEN 'contabilidad'
    WHEN functional_role IN ('administracion', 'tesoreria', 'tecnico') THEN 'operativo'
    ELSE 'viewer'
  END
WHERE system_role = 'member';

-- El alta automática por Microsoft 365 ahora entra como Sólo lectura (criterio más seguro)
UPDATE settings SET value = 'viewer' WHERE key = 'ms_default_profile' AND value = 'member';

DELETE FROM profiles WHERE key = 'member' AND is_system = 1;
