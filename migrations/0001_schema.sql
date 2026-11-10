-- ============================================================
-- RIMI Hub · Esquema principal
-- Jerarquía: Empresa > Zona > Finca > Proyecto > Inversión
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  short_code TEXT,
  legal_name TEXT,
  cuit TEXT,
  mipyme_category TEXT DEFAULT 'pequena',
  color TEXT DEFAULT '#4F8226',
  logo_url TEXT,
  description TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  province TEXT,
  locality TEXT,
  description TEXT,
  color TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS farms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  hectares REAL,
  lat REAL,
  lng REAL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#4F8226',
  min_exempt INTEGER DEFAULT 0,
  description TEXT,
  sort INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS functional_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#4F8226',
  icon TEXT DEFAULT 'user',
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT,
  auth_provider TEXT DEFAULT 'local',
  ms_oid TEXT,
  system_role TEXT DEFAULT 'member',   -- admin | rimi | viewer | member
  functional_role TEXT,                -- key de functional_roles (área principal)
  position TEXT,
  phone TEXT,
  avatar_color TEXT,
  active INTEGER DEFAULT 1,
  must_change_password INTEGER DEFAULT 0,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_companies (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, company_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at DATETIME NOT NULL,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  verifier TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Flujo de etapas configurable (proyecto / inversión)
CREATE TABLE IF NOT EXISTS stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL DEFAULT 'project',
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT,
  color TEXT DEFAULT '#4F8226',
  icon TEXT DEFAULT 'circle',
  phase TEXT,
  sort INTEGER DEFAULT 0,
  sla_days INTEGER,
  role_key TEXT,
  description TEXT,
  is_final INTEGER DEFAULT 0,
  UNIQUE(entity, key)
);

-- Tareas automáticas al ingresar a una etapa (pasos del procedimiento)
CREATE TABLE IF NOT EXISTS stage_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL DEFAULT 'project',
  stage_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  role_key TEXT,
  due_days INTEGER DEFAULT 5,
  procedure_ref TEXT,
  sort INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

-- Constructor de formularios
CREATE TABLE IF NOT EXISTS form_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'layout-list',
  letter TEXT,
  restricted INTEGER DEFAULT 0,  -- sólo RIMI / Impuestos
  sort INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  UNIQUE(entity, key)
);

CREATE TABLE IF NOT EXISTS form_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  section_key TEXT NOT NULL,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  options TEXT,
  required INTEGER DEFAULT 0,
  help TEXT,
  placeholder TEXT,
  width TEXT DEFAULT 'half',
  core INTEGER DEFAULT 0,
  readonly INTEGER DEFAULT 0,
  sort INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  UNIQUE(entity, key)
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  zone_id INTEGER REFERENCES zones(id),
  farm_id INTEGER REFERENCES farms(id),
  type_id INTEGER REFERENCES project_types(id),
  code TEXT,
  name TEXT NOT NULL,
  stage_key TEXT DEFAULT 'borrador',
  status TEXT DEFAULT 'activo',
  responsible_id INTEGER REFERENCES users(id),
  rimi_id INTEGER REFERENCES users(id),
  currency TEXT DEFAULT 'USD',
  budget REAL,
  first_purchase_date TEXT,
  startup_est_date TEXT,
  startup_real_date TEXT,
  classification TEXT,
  dictamen TEXT,
  dictamen_date TEXT,
  dictamen_notes TEXT,
  ficha_sent_at TEXT,
  ficha_version TEXT DEFAULT '01',
  folder_path TEXT,
  data TEXT DEFAULT '{}',
  created_by INTEGER,
  stage_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS investments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  seq INTEGER,
  code TEXT,
  component_type TEXT,
  description TEXT NOT NULL,
  brand_model TEXT,
  quantity REAL,
  unit TEXT,
  ncm TEXT,
  ncm_status TEXT DEFAULT 'Propuesta',
  supplier TEXT,
  supplier_cuit TEXT,
  unit_price REAL,
  currency TEXT DEFAULT 'USD',
  total REAL,
  purchase_date TEXT,
  invoice_date TEXT,
  startup_date TEXT,
  spec_doc TEXT,
  eligibility TEXT DEFAULT 'Pendiente de validación',
  bk_bit TEXT,
  stage_key TEXT DEFAULT 'identificada',
  responsible_id INTEGER REFERENCES users(id),
  serial_number TEXT,
  is_new TEXT DEFAULT 'Sí',
  data TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Participantes por proyecto o por inversión, con rol funcional
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  investment_id INTEGER REFERENCES investments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  investment_id INTEGER REFERENCES investments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id INTEGER REFERENCES users(id),
  role_key TEXT,
  created_by INTEGER REFERENCES users(id),
  due_date TEXT,
  status TEXT DEFAULT 'pendiente',   -- pendiente | en_curso | bloqueada | completada
  priority TEXT DEFAULT 'media',     -- baja | media | alta | critica
  stage_key TEXT,
  procedure_ref TEXT,
  auto INTEGER DEFAULT 0,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  investment_id INTEGER REFERENCES investments(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  kind TEXT DEFAULT 'user',  -- user | system
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  actor_id INTEGER,
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Estructura de carpetas (Anexo II)
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  per_investment INTEGER DEFAULT 0,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS doc_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  folder_key TEXT,
  icon TEXT DEFAULT 'file-text',
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  investment_id INTEGER REFERENCES investments(id) ON DELETE SET NULL,
  folder_key TEXT,
  doc_type TEXT,
  name TEXT NOT NULL,
  r2_key TEXT,
  size INTEGER,
  mime TEXT,
  status TEXT DEFAULT 'cargado',
  doc_number TEXT,
  doc_date TEXT,
  amount REAL,
  currency TEXT,
  supplier TEXT,
  notes TEXT,
  uploaded_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Checklist de documentación (Anexo I · hoja 03)
CREATE TABLE IF NOT EXISTS checklist_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  required_note TEXT,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_key TEXT,
  label TEXT NOT NULL,
  required_note TEXT,
  status TEXT DEFAULT 'Pendiente',
  reference TEXT,
  notes TEXT,
  sort INTEGER DEFAULT 0,
  updated_by INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agenda de obligaciones recurrentes (procedimiento)
CREATE TABLE IF NOT EXISTS recurring_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  day_from INTEGER NOT NULL,
  day_to INTEGER,
  role_key TEXT,
  procedure_ref TEXT,
  color TEXT,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  investment_id INTEGER,
  user_id INTEGER,
  action TEXT NOT NULL,
  summary TEXT,
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_zones_company ON zones(company_id);
CREATE INDEX IF NOT EXISTS idx_farms_zone ON farms(zone_id);
CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_zone ON projects(zone_id);
CREATE INDEX IF NOT EXISTS idx_inv_project ON investments(project_id);
CREATE INDEX IF NOT EXISTS idx_members_project ON members(project_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id, investment_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_docs_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_project ON activity(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
