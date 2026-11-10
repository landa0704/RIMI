// =====================================================================
// Catálogo de permisos configurables (Administración → Perfiles y permisos)
// Permisos efectivos de un usuario = permisos del PERFIL ∪ permisos de su ROL FUNCIONAL
// El perfil "admin" tiene siempre todos los permisos y acceso a Administración.
// Un perfil sin ningún permiso es de "sólo lectura".
// =====================================================================
export type PermissionDef = { key: string; group: string; label: string; help: string }

export const PERMISSIONS: PermissionDef[] = [
  { key: 'zones.manage', group: 'Estructura', label: 'Crear y editar zonas', help: 'Alta, edición y baja de zonas geográficas (ej. Guandacol).' },
  { key: 'farms.manage', group: 'Estructura', label: 'Crear y editar fincas', help: 'Alta, edición y baja de fincas / establecimientos dentro de una zona.' },

  { key: 'projects.create', group: 'Proyectos', label: 'Crear proyectos', help: 'Iniciar un proyecto nuevo con el asistente (Ficha de apertura).' },
  { key: 'projects.edit', group: 'Proyectos', label: 'Editar fichas de proyecto', help: 'Modificar la ficha (Anexo I) y el checklist de cualquier proyecto de sus empresas. El Responsable del Proyecto siempre puede editar el suyo.' },
  { key: 'projects.stage', group: 'Proyectos', label: 'Mover cualquier etapa', help: 'Avanzar o retroceder etapas aunque no sea el responsable de la etapa actual.' },
  { key: 'projects.dictamen', group: 'Proyectos', label: 'Dictamen y validación fiscal', help: 'Registrar el dictamen y editar campos fiscales: elegibilidad, estado NCM, BK/BIT.' },
  { key: 'projects.status', group: 'Proyectos', label: 'Activar o desactivar proyectos', help: 'Marcar un proyecto como Activo o Inactivo. Un proyecto inactivo queda en sólo lectura (ficha, bienes, etapas y tareas) hasta reactivarlo.' },
  { key: 'members.manage', group: 'Proyectos', label: 'Gestionar el equipo de cualquier proyecto', help: 'Sumar o quitar participantes. El Responsable del Proyecto siempre puede gestionar el suyo.' },
  { key: 'projects.delete', group: 'Proyectos', label: 'Eliminar proyectos', help: 'Borra el proyecto con sus inversiones, tareas, mensajes y documentos.' },

  { key: 'investments.edit', group: 'Inversiones', label: 'Cargar y editar bienes', help: 'Alta, edición e importación de inversiones / componentes y cambio de su estado.' },
  { key: 'investments.delete', group: 'Inversiones', label: 'Eliminar bienes en cualquier estado', help: 'Sin este permiso sólo se eliminan bienes en estado "Identificada".' },

  { key: 'documents.upload', group: 'Documentos', label: 'Subir documentos', help: 'Cargar facturas, presupuestos, contratos y otros archivos al legajo.' },
  { key: 'documents.validate', group: 'Documentos', label: 'Validar documentos', help: 'Cambiar el estado del documento (validado / observado).' },
  { key: 'documents.delete', group: 'Documentos', label: 'Eliminar documentos de otros', help: 'Sin este permiso cada usuario sólo elimina lo que subió.' },

  { key: 'tasks.create', group: 'Colaboración', label: 'Crear tareas', help: 'Crear tareas manuales y asignarlas.' },
  { key: 'tasks.manage', group: 'Colaboración', label: 'Gestionar cualquier tarea', help: 'Editar, reasignar o eliminar tareas creadas por otros.' },
  { key: 'chat.write', group: 'Colaboración', label: 'Escribir en conversaciones', help: 'Enviar mensajes en el chat del proyecto y de cada inversión.' },

  { key: 'config.workflow', group: 'Configuración', label: 'Configurar tareas automáticas y agenda', help: 'Editar las plantillas de tareas por etapa y la agenda recurrente.' }
]

export const ALL_PERMS = PERMISSIONS.map(p => p.key)

/** Campos que no se pueden quitar del formulario porque sostienen la estructura de datos */
export const STRUCTURAL_FIELDS: Record<string, string[]> = {
  project: ['name', 'company_id', 'zone_id', 'type_id', 'responsible_id', 'code'],
  investment: ['description']
}

export function parsePerms(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter(x => ALL_PERMS.includes(String(x))).map(String)
  if (typeof v === 'string' && v) { try { return parsePerms(JSON.parse(v)) } catch { return [] } }
  return []
}
