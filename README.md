# RIMI Hub · Grupo Phronesis (Solfrut / Genética Incarí)

Portal para gestionar los proyectos del **Régimen de Incentivo para Medianas Inversiones (RIMI)** según el procedimiento PE-SF, la Ficha de Apertura (Anexo I) y la estructura de carpetas del Anexo II.


## Usuarios iniciales (carga desde "usuarios iniciales.xlsx", al 6-11-2026)
Los 26 usuarios están en `seed.sql` (base inicial limpia: empresas Solfrut y Genética Incarí, admin de la plataforma y los 26 usuarios, acceso por Microsoft 365). Sin zonas, fincas, proyectos ni historial.

| Perfil | Quiénes | Usuarios cargados |
|---|---|---|
| Administrador | Sistemas y TI | 2 (Landaburu, Barberio) |
| Responsable RIMI | Responsable RIMI | 1 (Merlina Gottlieb) |
| Líder de proyecto | Responsables del Proyecto | 5 (Balmaceda, Monllor, Elizondo, Ledo, Berrocal) |
| Compras | Compras | 3 (Alberghini, Puello, Paz) |
| Impuestos | Impuestos | 1 (Sandra Lozano) |
| Contabilidad | Contabilidad | 2 (Pereira, Moreno P.) |
| Administración, tesorería y técnico | Adm. local · Tesorería | 4 (Moreno A.M., Cassinelli, Nazer, Udrizard) |
| Sólo lectura | Dirección / Gerencias / Finanzas | 8 |

> Pendientes de confirmar: Salvador Guadagnino (sin correo en el Excel, no se cargó) y Sandra Lozano figura dos veces (Responsable RIMI e Impuestos); se cargó sólo como Impuestos.
> La cuenta local de prueba es admin@phronesis.com.ar (clave `Rimi2026!`). Cambiarla antes de producción.

## Almacenamiento de archivos
- **Hoy (prototipo):** archivos en un almacenamiento de objetos (R2) simulado localmente en el sandbox; los metadatos van en la base SQLite (D1).
- **Producción recomendada:** SharePoint (biblioteca "RIMI" con la estructura Anexo II) vía Microsoft Graph, o Azure Blob Storage. Se resuelve con Sistemas; el código abstrae el almacenamiento en `src/routes/work.ts` (subida/descarga).

## Estado
- Diseño: revisión independiente, media 8,1/10 (11 pantallas).
- Tests API: 59/59.
- Sin publicación: corre sólo en el sandbox de desarrollo.

## Estructura de datos
Empresa → Zona → Finca → Proyecto (energético, riego, etc.) → Inversión (bien unitario con NCM)

## Funcionalidades
- **Ingreso**: SSO con Microsoft 365 / Entra ID (OAuth2 + PKCE, se activa con secrets) + usuarios locales con clave temporal y cambio obligatorio en el primer ingreso. Bloqueo tras 8 intentos fallidos.
- **Perfiles**: Administrador, Responsable RIMI, Líder de proyecto, Compras, Impuestos, Contabilidad, Administración/Tesorería/Técnico y Sólo lectura (el perfil Colaborador fue reemplazado en la migración 0005), más 10 roles funcionales. Cada usuario ve sólo las empresas que tiene habilitadas.
- **Proyectos**: alta guiada en 3 pasos, Ficha Anexo I dinámica con secciones A-E (la E es de uso restringido), exportación a Excel con las 3 hojas del Anexo, importación de componentes desde Excel.
- **Flujo de 9 etapas**: Ficha → Elegibilidad → Contable → Contratación → Ejecución → Puesta en marcha → SGI → Permanencia → Cierre. Cada etapa genera automáticamente las tareas del procedimiento, con plazos en días hábiles y feriados de Argentina.
- **Inversiones**: cada una tiene su propio estado (9 etapas), su elegibilidad/NCM/BK-BIT validados por Impuestos, y sus propios documentos, tareas, chat y responsables.
- **Tareas**: tablero kanban y lista, con asignación, vencimientos, prioridad y conversación por tarea.
- **Chat interno**: por proyecto y por inversión, con menciones @ y notificaciones.
- **Legajo digital**: archivos guardados en R2 con las 11 carpetas del Anexo II; estados de validación.
- **Agenda**: calendario con las fechas recurrentes del procedimiento (ERP día 9, IVA días 10-15, correcciones día 18, validación día 19).
- **Reportes**: estado mensual, tablero de monto mínimo por categoría MiPyME, NCM, fechas críticas, exportación CSV/Excel.
- **Administración**: empresas, usuarios, constructor de formularios con arrastrar y soltar, flujo de etapas y tareas automáticas, roles, tipos de proyecto, agenda, carpetas, apariencia, integración con M365 y auditoría.

## Servicios y almacenamiento
Hono + Cloudflare Pages · D1 (`webapp-production`) · R2 (`FILES`) · SPA en JS vanilla (Lucide, Chart.js, SortableJS, SheetJS)

## Desarrollo
```
npx wrangler d1 migrations apply webapp-production --local
npx wrangler d1 execute webapp-production --local --file=./seed.sql   # base inicial limpia (empresas, admin y 26 usuarios)
npm run build && pm2 start ecosystem.config.cjs
node tests/api.test.mjs   # 59 pruebas E2E de la API
```

## Activar el SSO con Microsoft 365
En Administración → Microsoft 365 están los pasos. Hay que registrar la app en Entra ID y cargar los secrets `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` (y `APP_URL` si se usa un dominio propio).

## Pendiente (etapa 2)
Sincronización con SharePoint/OneDrive, envío de correos por Graph, avisos en Teams, mapeo de grupos de Entra ID, conciliación con el ERP, y eventual migración a Azure.

## Estado del despliegue
Funciona en el sandbox; todavía no está desplegado en producción.

## Perfiles, permisos y manual del administrador (nov 2026)
- **Permisos efectivos = perfil + permisos extra del rol funcional.** Admin = todo + Administración. Perfil sin permisos = sólo lectura. El Responsable de un proyecto siempre edita el suyo.
- Configuración: Administración → **Perfiles y permisos** (matriz, perfiles nuevos), **Roles funcionales** (permisos extra), **Usuarios y accesos**, **Microsoft 365 / Azure** (incluye perfil por defecto del alta automática).
- 17 permisos en `src/lib/permissions.ts`; tabla `profiles` y `functional_roles.permissions` (migración 0003).
- Constructor: eliminar campo → Papelera (restaurable); borrado definitivo sólo para personalizados; campos estructurales protegidos.
- Manual del administrador: `/static/manual` (menú de usuario → "Manual del administrador").
- Tests: 81/81 (`node tests/api.test.mjs`); revisión del flujo completo 34/34.
