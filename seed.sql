-- ============================================================
-- Base inicial limpia (sin datos de demostración).
-- Contiene: empresas, administrador de la plataforma y los 26 usuarios
-- del Excel 'usuarios iniciales.xlsx' (hoja Usuarios, al 6-11-2026).
-- Usuarios Microsoft 365: no tienen contraseña local.
-- El administrador local conserva la clave de prueba Rimi2026!
-- ============================================================

INSERT OR IGNORE INTO companies (id, name, short_code, legal_name, cuit, mipyme_category, color, description) VALUES
 (1,'Solfrut','SF','Solfrut S.A.','30-71234567-8','mediana1','#4F8226','Producción frutícola, pistacho y procesamiento industrial.'),
 (2,'Genética Incarí','GI','Genética Incarí S.A.','30-71876543-2','pequena','#0A88C9','Genética y viveros. (Se habilitará en una etapa posterior).');

INSERT OR IGNORE INTO users (id,email,name,password_hash,system_role,functional_role,position,avatar_color) VALUES
 (1,'admin@phronesis.com.ar','Administrador Phronesis','pbkdf2$100000$/AcdkxwYbcE7W42oqRySUw==$xiNgtltjlEoxdz9W8ylcXhQqunAiZ2czUDvWufgc39w=','admin','sistemas','Administrador de la plataforma','#00322B');

-- Usuarios del Excel (Microsoft 365)
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('clandaburu@phronesis.com.ar', 'Christian Landaburu', 'microsoft', 'admin', 'sistemas', 'Gerente Auditoría, Procedimientos y Seguros', '#00322B', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('pbarberio@phronesis.com.ar', 'Pablo Barberio', 'microsoft', 'admin', 'sistemas', 'Sistemas', '#4F8226', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('mgotlieb@phronesis.com.ar', 'Merlina Gottlieb', 'microsoft', 'rimi', 'resp_rimi', 'Jefa', '#0A88C9', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('mbalmaceda@solfrut.com.ar', 'Martín Balmaceda', 'microsoft', 'lider_proyecto', 'resp_proyecto', 'Mantenimiento Local', '#0A6FA6', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('nmonllor@solfrut.com.ar', 'Nicolás Monllor', 'microsoft', 'lider_proyecto', 'resp_proyecto', 'Producción Local', '#C2410C', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('celizondo@solfrut.com.ar', 'Claudio Elizondo', 'microsoft', 'lider_proyecto', 'resp_proyecto', 'Producción Local', '#6FA137', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('cledo@solfrut.com.ar', 'Alejandro Ledo', 'microsoft', 'lider_proyecto', 'resp_proyecto', 'Producción Local Agro', '#B8860B', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('aberrocal@solfrut.com.ar', 'Agustin Berrocal', 'microsoft', 'lider_proyecto', 'resp_proyecto', 'Producción Local Area Tecnica', '#1F3A5F', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('ealberghini@solfrut.com.ar', 'Emiliano Alberghini', 'microsoft', 'compras', 'compras', 'Administración local - Compras', '#A16207', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('apuello@solfrut.com.ar', 'Alexis Puello', 'microsoft', 'compras', 'compras', 'Administración local - Compras', '#BE123C', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('mpaz@solfrut.com.ar', 'Matías Paz', 'microsoft', 'compras', 'compras', 'Administración local - Compras', '#7C3AED', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('slozano@phronesis.com.ar', 'Sandra Lozano', 'microsoft', 'impuestos', 'impuestos', 'Jefa de Impuestos', '#0F766E', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('dpereira@phronesis.com.ar', 'Daniel Pereira', 'microsoft', 'contabilidad', 'contabilidad', 'Analista Contable de Gestión', '#00322B', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('pmoreno@phronesis.com.ar', 'Patricio Moreno', 'microsoft', 'contabilidad', 'contabilidad', 'Analista Contable de Balances', '#4F8226', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('amoreno@solfrut.com.ar', 'Ana María Moreno', 'microsoft', 'operativo', 'tesoreria', 'Tesorera Local', '#0A88C9', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('vcassinelli@phronesis.com.ar', 'Valeria Cassinelli', 'microsoft', 'operativo', 'tesoreria', 'Tesorería PH', '#0A6FA6', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('ggnazer@phronesis.com.ar', 'Guido Nazer', 'microsoft', 'operativo', 'tesoreria', 'Tesorería PH', '#C2410C', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('audrizard@phronesis.com.ar', 'Ayelén Udrizard', 'microsoft', 'operativo', 'tesoreria', 'Tesorería PH', '#6FA137', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('fciribeni@solfrut.com.ar', 'Federico Ciribeni', 'microsoft', 'viewer', 'direccion', 'Analista de Control de Gestión local', '#B8860B', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('aaguilera@solfrut.com.ar', 'Alberto Aguilera', 'microsoft', 'viewer', 'direccion', 'Gerente Agro', '#1F3A5F', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('gsarzetti@solfrut.com.ar', 'Gabriel Sarzetti', 'microsoft', 'viewer', 'direccion', 'Gerente Industria', '#A16207', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('dlapitz@phronesis.com.ar', 'Daniel Lapitz', 'microsoft', 'viewer', 'direccion', 'Gerente Planeamiento y Control de Gestión', '#BE123C', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('amichaliczka@phronesis.com.ar', 'Agustin Michaliczka', 'microsoft', 'viewer', 'direccion', 'Jefe Planeamiento y Control de Gestión', '#7C3AED', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('fpicullo@phronesis.com.ar', 'Francisco Picullo', 'microsoft', 'viewer', 'direccion', 'Jefe de Presupuesto y Control Presupuestario', '#0F766E', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('adicarlo@phronesis.com.ar', 'Adrián Di Carlo', 'microsoft', 'viewer', 'direccion', 'Director Finanzas', '#00322B', 1);
INSERT OR IGNORE INTO users (email, name, auth_provider, system_role, functional_role, position, avatar_color, active) VALUES ('hdumanjo@phronesis.com.ar', 'Hernán Dumanjó', 'microsoft', 'viewer', 'direccion', 'Director Administración', '#4F8226', 1);

INSERT OR IGNORE INTO user_companies (user_id, company_id) VALUES (1,1),(1,2);
INSERT OR IGNORE INTO user_companies (user_id, company_id) SELECT id, 1 FROM users WHERE id > 1 AND (email LIKE '%@solfrut.com.ar' OR email LIKE '%@phronesis.com.ar');
