-- ============================================================
-- Catálogos base derivados del PE-SF Inversiones RIMI + Anexo I / II
-- (todo es editable luego desde Administración)
-- ============================================================

INSERT OR IGNORE INTO settings (key, value) VALUES
 ('app_name', 'RIMI Hub'),
 ('group_name', 'Grupo Phronesis'),
 ('tagline', 'Gestión integral de inversiones del Régimen de Incentivo para Medianas Inversiones'),
 ('primary_color', '#00322B'),
 ('accent_color', '#6FA137'),
 ('program_start', '2026-12-01'),
 ('rimi_window_start', '2026-03-06'),
 ('rimi_window_end', '2028-05-19'),
 ('default_currency', 'USD'),
 ('ms_enabled', '1'),
 ('ms_allowed_domains', ''),
 ('ms_auto_provision', '1'),
 ('local_login_enabled', '1'),
 ('threshold_micro', '150000'),
 ('threshold_pequena', '600000'),
 ('threshold_mediana1', '3500000'),
 ('threshold_mediana2', '9000000');

-- Roles funcionales (diapositiva "Roles involucrados" + procedimiento §6)
INSERT OR IGNORE INTO functional_roles (key, name, description, color, icon, sort) VALUES
 ('direccion', 'Dirección / Gerencias', 'Designa al Responsable de Proyecto y recibe el estado mensual por proyecto.', '#B8860B', 'star', 1),
 ('resp_proyecto', 'Responsable del Proyecto', 'Completa la Ficha, valida recepciones y puesta en marcha, y acompaña auditorías.', '#4F8226', 'user-check', 2),
 ('resp_rimi', 'Responsable RIMI', 'Coordina el procedimiento: dictamina, monitorea, reporta y ordena la documentación.', '#00322B', 'shield-check', 3),
 ('compras', 'Compras', 'Gestiona contratación y proveedores, y respalda el avance de obra.', '#0A88C9', 'shopping-cart', 4),
 ('impuestos', 'Impuestos', 'Evalúa elegibilidad, concilia el IVA y monitorea condiciones y normativa.', '#C2410C', 'landmark', 5),
 ('contabilidad', 'Contabilidad', 'Define la imputación contable en el ERP y carga el proyecto en el SGI.', '#6FA137', 'calculator', 6),
 ('administracion', 'Administración local', 'Controla y registra los comprobantes en el ERP y archiva su documentación.', '#1F3A5F', 'building-2', 7),
 ('tesoreria', 'Tesorería', 'Controla al proveedor antes de pagar y adjunta los respaldos del pago.', '#A16207', 'wallet', 8),
 ('tecnico', 'Personal técnico', 'Emite el Informe Técnico firmado que acredita la puesta en marcha.', '#BE123C', 'wrench', 9),
 ('sistemas', 'Sistemas y TI', 'Administra la plataforma, accesos y estructura digital.', '#475569', 'monitor-cog', 10);

-- Tipos de proyecto (min_exempt = no sujeto a monto mínimo según RG 5849)
INSERT INTO project_types (name, icon, color, min_exempt, description, sort) VALUES
 ('Energético', 'zap', '#E0A100', 1, 'Generación renovable, transformadores, bienes de alta eficiencia energética.', 1),
 ('Riego', 'droplets', '#0A88C9', 1, 'Sistemas y equipos de riego: bombas, cañerías, reservorios, filtrado.', 2),
 ('Malla antigranizo', 'cloud-hail', '#64748B', 1, 'Mallas antigranizo para el sector agropecuario.', 3),
 ('Planta industrial', 'factory', '#BE123C', 0, 'Líneas de proceso, envasado y equipamiento industrial.', 4),
 ('Maquinaria agrícola', 'tractor', '#4F8226', 0, 'Tractores, implementos y maquinaria de campo.', 5),
 ('Obra civil / Infraestructura', 'hard-hat', '#A16207', 0, 'Galpones, caminos, obras e infraestructura productiva.', 6),
 ('Semovientes', 'paw-print', '#7C3AED', 1, 'Bienes semovientes.', 7),
 ('Otro', 'shapes', '#475569', 0, 'Otras inversiones productivas.', 8);

-- Flujo de etapas · PROYECTO
INSERT OR IGNORE INTO stages (entity, key, name, short_name, color, icon, phase, sort, sla_days, role_key, description, is_final) VALUES
 ('project','borrador','Ficha en preparación','Ficha','#94A3B8','file-pen-line','Preliminar',1,10,'resp_proyecto','El Responsable del Proyecto completa la Ficha (Anexo I) con apoyo de Compras. Plazo: 10 días hábiles.',0),
 ('project','evaluacion','Evaluación de elegibilidad','Elegibilidad','#0A88C9','scale','Preliminar',2,5,'resp_rimi','RIMI, Impuestos y Contaduría analizan elegibilidad, ventana temporal, NCM y monto mínimo. 5 días hábiles (10 si es controvertido).',0),
 ('project','contable','Tratamiento contable','Contable','#6FA137','calculator','Preliminar',3,3,'contabilidad','Contabilidad define cuenta e imputación / centro de costos en el ERP. 3 días hábiles desde el dictamen.',0),
 ('project','contratacion','Contratación','Contratación','#0A6FA6','handshake','Ejecución',4,NULL,'compras','Gestión de compra, selección de proveedor, control de apócrifos y órdenes de compra.',0),
 ('project','ejecucion','Recepción y comprobantes','Ejecución','#4F8226','package-check','Ejecución',5,NULL,'resp_proyecto','Recepción de bienes / avance de obra, comprobantes, registro ERP, conciliaciones y pagos.',0),
 ('project','puesta_marcha','Puesta en marcha','Puesta en marcha','#E0A100','rocket','Ejecución',6,NULL,'resp_proyecto','Acta, informe técnico firmado y aviso al Responsable RIMI. Hecho generador del beneficio.',0),
 ('project','sgi','Gestión en SGI','SGI','#00322B','landmark','SGI',7,10,'contabilidad','Carga del proyecto e inversiones, vinculación de comprobantes (10 días hábiles), puesta en marcha y selección de beneficios.',0),
 ('project','seguimiento','Control y permanencia','Permanencia','#7C3AED','shield-check','Control',8,NULL,'resp_rimi','Monitoreo de condiciones, conciliaciones, auditorías, bajas y reportes.',0),
 ('project','cerrado','Cerrado','Cerrado','#334155','archive','Control',9,NULL,'resp_rimi','Beneficio consolidado y legajo cerrado.',1);

-- Flujo de etapas · INVERSIÓN (bien / componente)
INSERT OR IGNORE INTO stages (entity, key, name, short_name, color, icon, phase, sort, sla_days, role_key, description, is_final) VALUES
 ('investment','identificada','Identificada','Identificada','#94A3B8','circle-dashed','Preliminar',1,NULL,'resp_proyecto','Componente cargado en la Ficha.',0),
 ('investment','dictaminada','Dictaminada','Dictamen','#0A88C9','scale','Preliminar',2,NULL,'resp_rimi','Elegibilidad y NCM evaluados.',0),
 ('investment','contratada','Contratada / OC','Contratada','#0A6FA6','handshake','Ejecución',3,NULL,'compras','Proveedor seleccionado y orden de compra / contrato emitido.',0),
 ('investment','recibida','Recibida / Avance','Recibida','#4F8226','package-check','Ejecución',4,2,'resp_proyecto','Acta de recepción con serie, estado y fotos (2 días hábiles).',0),
 ('investment','registrada','Registrada en ERP','ERP','#6FA137','file-check-2','Ejecución',5,3,'administracion','Comprobante registrado en ERP (3 días hábiles, máx. día 9).',0),
 ('investment','pagada','Pagada','Pagada','#A16207','wallet','Ejecución',6,2,'tesoreria','Orden de pago, transferencia y retenciones adjuntas.',0),
 ('investment','en_marcha','En marcha','En marcha','#E0A100','rocket','Ejecución',7,NULL,'resp_proyecto','Puesta en marcha acreditada con informe técnico.',0),
 ('investment','sgi','Vinculada en SGI','SGI','#00322B','landmark','SGI',8,10,'contabilidad','Comprobantes vinculados y beneficio seleccionado.',0),
 ('investment','baja','Baja / Venta / Siniestro','Baja','#BE123C','circle-off','Control',9,2,'resp_proyecto','Baja informada dentro de 2 días hábiles.',1);

-- Tareas automáticas por etapa (pasos del procedimiento §5)
INSERT INTO stage_tasks (entity, stage_key, title, description, role_key, due_days, procedure_ref, sort) VALUES
 ('project','borrador','Completar la Ficha de Proyecto (Anexo I)','Ubicación, objetivo productivo, memoria técnica, destino, presupuesto desagregado por componente, proveedores, fechas estimadas de compra y puesta en marcha.','resp_proyecto',10,'5.1.2 · Paso 1',1),
 ('project','borrador','Completar información de proveedores para cada componente','Gestionar con los proveedores la información técnica y económica necesaria para que la Ficha sea suficiente.','compras',7,'5.1.2 · Paso 2',2),
 ('project','borrador','Crear la carpeta digital del proyecto (Anexo II)','La carpeta se crea al completar la Ficha, no después del dictamen.','resp_proyecto',10,'5.2.3 · Paso 4',3),
 ('project','evaluacion','Analizar elegibilidad y emitir dictamen','Ventana temporal, naturaleza y destino productivo, exclusiones, monto mínimo, obras y acreditaciones. Asignar cada componente como general o específico según NCM.','resp_rimi',5,'5.1.3 · Pasos 1-4',1),
 ('project','evaluacion','Validar NCM, BK/BIT y elegibilidad por componente','Impuestos valida posiciones arancelarias propuestas por Operaciones.','impuestos',5,'5.1.3 · Paso 1',2),
 ('project','evaluacion','Comunicar dictamen y ruta de carpeta al Responsable del Proyecto','Dentro de 1 día hábil desde el dictamen.','resp_rimi',6,'5.1.3 · Paso 5',3),
 ('project','contable','Definir imputación contable y centro de costos en el ERP','La descripción contiene el nombre del proyecto y el tipo de inversión. 3 días hábiles desde el dictamen.','contabilidad',3,'5.1.4 · Pasos 1-2',1),
 ('project','contable','Informar imputación a Dirección, Responsable y áreas','Copia a Compras / Administración / Contabilidad / Control de Gestión.','resp_rimi',4,'5.1.4 · Paso 3',2),
 ('project','contratacion','Gestionar compra con facturación desagregada','Evitar conceptos mezclados (bienes, instalación, fletes, servicios). Anticipos con factura de "Anticipo" y luego NC.','compras',10,'5.2.1 · Paso 1',1),
 ('project','contratacion','Documentar selección de proveedor','Dejar documentado el proceso y los motivos. En proyectos relevantes, llamado a licitación.','compras',10,'5.2.1 · Paso 2',2),
 ('project','contratacion','Controlar proveedores en listado de Facturas Apócrifas (ARCA)','Si el proveedor figura en el listado, dejar evidencia y seleccionar otro.','compras',5,'5.2.1 · Paso 3',3),
 ('project','ejecucion','Acta de recepción de bienes / informe de avance de obra','Serie, estado, fotos y conformidad técnica dentro de 2 días hábiles.','resp_proyecto',2,'5.2.2 · Pasos 1-2',1),
 ('project','ejecucion','Guardar comprobantes en carpeta digital','Dentro de 2 días hábiles desde la recepción de comprobantes.','compras',2,'5.2.3 · Paso 1',2),
 ('project','ejecucion','Registrar comprobantes en el ERP','Dentro de 3 días hábiles y como máximo hasta el día 9 de cada mes. Control de apócrifos previo.','administracion',3,'5.2.4 · Pasos 1-2',3),
 ('project','ejecucion','Adjuntar orden de pago, transferencia y retenciones','Dentro de 2 días hábiles desde la emisión del pago.','tesoreria',2,'5.2.6 · Paso 2',4),
 ('project','puesta_marcha','Emitir Informe Técnico firmado de puesta en marcha','Enviar al Responsable del Proyecto dentro de las 24 h.','tecnico',2,'5.2.7 · Paso 2',1),
 ('project','puesta_marcha','Comunicar fecha cierta de puesta en marcha al Responsable RIMI','Acta firmada, fotos, habilitaciones, primera producción o facturación asociada.','resp_proyecto',1,'5.2.7 · Pasos 1-3',2),
 ('project','puesta_marcha','Avisar para registro en el SGI','Con la posición arancelaria confirmada, comunicar a RIMI y Contabilidad.','resp_proyecto',2,'5.2.8 · Paso 1',3),
 ('project','sgi','Cargar proyecto e inversiones en el SGI','A partir de la fecha coordinada con el Responsable RIMI.','contabilidad',5,'5.3.1 · Pasos 1-2',1),
 ('project','sgi','Vincular comprobantes en el SGI','Dentro de los 10 días hábiles desde el aviso de puesta en marcha.','contabilidad',10,'5.3.1 · Paso 3',2),
 ('project','sgi','Registrar puesta en marcha y seleccionar beneficios','Amortización acelerada y/o devolución de IVA.','contabilidad',12,'5.3.1 · Pasos 4-5',3),
 ('project','seguimiento','Verificar Certificado MiPyME y situación fiscal','Continuidad de beneficios: certificado vigente y ausencia de deuda firme, exigible e impaga.','impuestos',30,'5.4 · Paso 1',1),
 ('project','seguimiento','Verificar completitud de carpeta digital','Trimestral en ejecución, semestral para el resto.','resp_rimi',90,'5.4 · Paso 5',2);

-- Secciones del formulario · PROYECTO (Anexo I · hoja 01)
INSERT OR IGNORE INTO form_sections (entity, key, title, description, icon, letter, restricted, sort) VALUES
 ('project','A','Identificación del proyecto','Datos generales, ubicación y responsable.','id-card','A',0,1),
 ('project','B','Objeto y características técnicas','Objetivo, alcance, destino y clasificación sugerida.','cpu','B',0,2),
 ('project','C','Planificación y presupuesto','Presupuesto, fechas de compra y puesta en marcha.','calendar-range','C',0,3),
 ('project','D','Evidencias, riesgos y envío','Planos, permisos, pendientes y envío al Responsable RIMI.','send','D',0,4),
 ('project','E','Uso interno RIMI / Impuestos','Recepción, revisión y resultado de la clasificación. No completa Operaciones.','lock','E',1,5);

INSERT OR IGNORE INTO form_fields (entity, section_key, key, label, type, options, required, help, placeholder, width, core, readonly, sort) VALUES
 ('project','A','code','Código / ID de proyecto','text',NULL,1,'Se sugiere automáticamente: SF-ZONA-AAAA-NNN','SF-GUA-2026-001','half',1,0,1),
 ('project','A','name','Nombre del proyecto','text',NULL,1,NULL,'Finca El Camino · Energético','half',1,0,2),
 ('project','A','company_id','Unidad de negocio / sociedad','company',NULL,1,NULL,NULL,'third',1,0,3),
 ('project','A','zone_id','Zona','zone',NULL,1,NULL,NULL,'third',1,0,4),
 ('project','A','farm_id','Finca / establecimiento','farm',NULL,0,NULL,NULL,'third',1,0,5),
 ('project','A','type_id','Tipo de proyecto','project_type',NULL,1,NULL,NULL,'third',1,0,6),
 ('project','A','address','Domicilio del proyecto','text',NULL,1,NULL,'Ruta 40 km 3.250, Guandacol, La Rioja','two_thirds',0,0,7),
 ('project','A','responsible_id','Responsable del Proyecto','user',NULL,1,NULL,NULL,'half',1,0,8),
 ('project','A','contact','Correo / contacto','text',NULL,0,NULL,'nombre@solfrut.com.ar','half',0,0,9),
 ('project','A','prep_date','Fecha de preparación','date',NULL,0,NULL,NULL,'third',0,0,10),
 ('project','A','ficha_version','Versión de ficha','text',NULL,0,NULL,'01','third',1,0,11),
 ('project','B','objective','Objetivo productivo','textarea',NULL,1,NULL,'¿Qué capacidad productiva incorpora o mejora?','full',0,0,1),
 ('project','B','tech_description','Descripción técnica y alcance','textarea',NULL,1,NULL,NULL,'full',0,0,2),
 ('project','B','activity','Actividad / proceso beneficiado','text',NULL,0,NULL,'Cultivo de pistacho','half',0,0,3),
 ('project','B','destination','Destino y uso productivo previsto','text',NULL,0,NULL,NULL,'half',0,0,4),
 ('project','B','install_type','¿Instalación nueva o reemplazo?','select','Nueva|Reemplazo|Ampliación|No definido',1,NULL,NULL,'third',0,0,5),
 ('project','B','civil_work','¿Requiere obra civil / montaje?','select','Sí|No|Por definir',0,'Si la obra tiene avance < 30% se debe acreditar con facturas, informe técnico o contrato.',NULL,'third',0,0,6),
 ('project','B','grid_connected','¿Sistema conectado a red?','select','Sí|No - Off Grid|No aplica|Por definir',0,'Aplica a energía renovable. Off Grid se considera caso controvertido.',NULL,'third',0,0,7),
 ('project','B','classification','Clasificación sugerida por Operaciones','select','General (propuesta)|Específica (propuesta)|Mixta (propuesta)|No definida',0,NULL,NULL,'half',1,0,8),
 ('project','B','classification_reason','Justificación técnica de la sugerencia','textarea',NULL,0,NULL,NULL,'half',0,0,9),
 ('project','C','currency','Moneda del presupuesto','select','USD|ARS|EUR',1,NULL,NULL,'third',1,0,1),
 ('project','C','budget','Presupuesto total estimado','money',NULL,1,'Se recalcula con la suma de los componentes si se deja vacío.',NULL,'third',1,0,2),
 ('project','C','first_purchase_date','Fecha estimada primera compra / contratación','date',NULL,1,NULL,NULL,'third',1,0,3),
 ('project','C','startup_est_date','Fecha estimada puesta en marcha','date',NULL,1,NULL,NULL,'third',1,0,4),
 ('project','C','milestones','Duración / hitos relevantes','textarea',NULL,0,NULL,NULL,'two_thirds',0,0,5),
 ('project','D','plans_available','Planos / memoria técnica disponibles','select','Sí|Parcial|No',0,NULL,NULL,'third',0,0,1),
 ('project','D','permits','Permisos / habilitaciones / certificaciones','text',NULL,0,NULL,NULL,'two_thirds',0,0,2),
 ('project','D','pending_docs','Documentos pendientes y fecha prevista','textarea',NULL,0,NULL,NULL,'full',0,0,3),
 ('project','D','ficha_sent_at','Fecha de envío al Responsable RIMI','date',NULL,0,'Se completa automáticamente al enviar la Ficha a evaluación.',NULL,'third',1,1,4),
 ('project','D','sender','Nombre y cargo de quien remite','text',NULL,0,NULL,NULL,'two_thirds',0,0,5),
 ('project','D','observations','Observaciones adicionales','textarea',NULL,0,NULL,NULL,'full',0,0,6),
 ('project','E','reception_date','Fecha de recepción','date',NULL,0,NULL,NULL,'third',0,0,1),
 ('project','E','rimi_id','Responsable que revisa','user',NULL,0,NULL,NULL,'third',1,0,2),
 ('project','E','dictamen','Resultado de clasificación (dictamen)','select','General elegible|Específica elegible|No elegible|Pendiente de validación',0,'La conformidad no es aprobación del beneficio, del cupo ni de la inversión.',NULL,'third',1,0,3),
 ('project','E','dictamen_notes','Fundamento / observaciones','textarea',NULL,0,NULL,NULL,'full',1,0,4),
 ('project','E','extra_info_requested','Información adicional solicitada','textarea',NULL,0,NULL,NULL,'half',0,0,5),
 ('project','E','return_date','Fecha de devolución a Operaciones','date',NULL,0,NULL,NULL,'quarter',0,0,6),
 ('project','E','folder_path','Ruta / carpeta de respaldo documental','text',NULL,0,NULL,'RIMI-FINCA EL CAMINO ENERGÉTICO/','full',1,0,7);

-- Secciones del formulario · INVERSIÓN (Anexo I · hoja 02 + datos fiscales)
INSERT OR IGNORE INTO form_sections (entity, key, title, description, icon, letter, restricted, sort) VALUES
 ('investment','tech','Identificación técnica','Una fila por bien, equipo, componente, obra o servicio.','cpu','1',0,1),
 ('investment','eco','Proveedor y presupuesto','Proveedor previsto e importes.','receipt','2',0,2),
 ('investment','dates','Fechas clave','Compra, factura y puesta en marcha.','calendar','3',0,3),
 ('investment','fiscal','Clasificación fiscal','Validado por Impuestos / Responsable RIMI.','landmark','4',1,4);

INSERT OR IGNORE INTO form_fields (entity, section_key, key, label, type, options, required, help, placeholder, width, core, readonly, sort) VALUES
 ('investment','tech','component_type','Tipo de componente','select','Bien / equipo|Instalación|Obra / infraestructura|Servicio|Otro',1,NULL,NULL,'third',1,0,1),
 ('investment','tech','description','Descripción técnica precisa','text',NULL,1,'No agrupar conceptos que requieren distinta evaluación fiscal.','Transformador trifásico 630 kVA 13,2/0,4 kV','two_thirds',1,0,2),
 ('investment','tech','brand_model','Marca / modelo','text',NULL,0,NULL,NULL,'third',1,0,3),
 ('investment','tech','quantity','Cantidad','number',NULL,1,NULL,NULL,'quarter',1,0,4),
 ('investment','tech','unit','Unidad','select','u|m|m²|m³|kW|kWp|kVA|ha|gl|hs|kg|lote',0,NULL,NULL,'quarter',1,0,5),
 ('investment','tech','ncm','NCM propuesta','ncm',NULL,0,'Formato 0000.00.00 — completar si se conoce; si no, dejar "pendiente".','8504.23.00','third',1,0,6),
 ('investment','tech','serial_number','N° de serie','text',NULL,0,'Requerido en acta de recepción.',NULL,'third',1,0,7),
 ('investment','tech','is_new','¿Bien nuevo?','select','Sí|No',0,NULL,NULL,'third',1,0,8),
 ('investment','eco','supplier','Proveedor previsto','text',NULL,0,NULL,NULL,'half',1,0,1),
 ('investment','eco','supplier_cuit','CUIT proveedor','text',NULL,0,NULL,'30-00000000-0','half',1,0,2),
 ('investment','eco','currency','Moneda','select','USD|ARS|EUR',0,NULL,NULL,'third',1,0,3),
 ('investment','eco','unit_price','Importe unitario','money',NULL,0,NULL,NULL,'third',1,0,4),
 ('investment','eco','total','Presupuesto total','money',NULL,0,'Cantidad × importe unitario (automático).',NULL,'third',1,1,5),
 ('investment','dates','purchase_date','Fecha compra estimada','date',NULL,0,NULL,NULL,'third',1,0,1),
 ('investment','dates','invoice_date','Fecha factura estimada','date',NULL,0,NULL,NULL,'third',1,0,2),
 ('investment','dates','startup_date','Fecha puesta en marcha','date',NULL,0,NULL,NULL,'third',1,0,3),
 ('investment','dates','spec_doc','Especificación / documento soporte','text',NULL,0,NULL,NULL,'full',1,0,4),
 ('investment','fiscal','eligibility','Elegibilidad','select','General elegible|Específica elegible|No elegible|Pendiente de validación',0,NULL,NULL,'third',1,0,1),
 ('investment','fiscal','ncm_status','Estado NCM','select','Propuesta|Validada|Pendiente',0,NULL,NULL,'third',1,0,2),
 ('investment','fiscal','bk_bit','BK / BIT','select','BK|BIT|No aplica|Pendiente',0,NULL,NULL,'third',1,0,3);

-- Checklist de documentación (Anexo I · hoja 03)
INSERT OR IGNORE INTO checklist_templates (item_key, label, required_note, sort) VALUES
 ('memoria','Memoria descriptiva del proyecto','Requerido para evaluación',1),
 ('desglose','Desglose de bienes, obras y servicios','Requerido para evaluación',2),
 ('presupuesto','Presupuesto detallado / cotizaciones','Requerido para evaluación',3),
 ('ficha_tecnica','Ficha técnica, catálogos, marca y modelo','Según componente',4),
 ('planos','Planos / diagramas / layout','Cuando corresponda',5),
 ('cronograma','Cronograma de compras, obra y puesta en marcha','Requerido para evaluación',6),
 ('proveedores','Proveedores previstos e identificación','Si están definidos',7),
 ('ncm','NCM propuesta y respaldo técnico','Para bienes, si disponible',8),
 ('permisos','Permisos / habilitaciones / registros sectoriales','Según tipo de inversión',9),
 ('certificaciones','Certificaciones / informes técnicos especializados','Cuando corresponda',10),
 ('contratos','Contratos / órdenes de compra','Si ya existen; no son requisito previo universal',11),
 ('otros','Otra documentación relevante / dudas normativas','Según proyecto',12);

-- Estructura de carpetas digitales (Anexo II)
INSERT OR IGNORE INTO folders (key, name, description, per_investment, sort) VALUES
 ('00','00 · Índice y control','Índice del proyecto, versiones del legajo',0,0),
 ('01','01 · Ficha y elegibilidad','Ficha, dictamen, informes técnicos o profesionales previos',0,1),
 ('02','02 · Contratación','Cotizaciones, comparativo, OC, contratos, control de proveedor, cambios',0,2),
 ('03','03 · Recepción y obra','Remitos, actas, fotos, informes técnicos, certificados de obra',0,3),
 ('04','04 · Comprobantes','Una subcarpeta por inversión (se vinculan por inversión en el SGI)',1,4),
 ('05','05 · Pagos','Orden de pago, transferencia, retenciones',0,5),
 ('06','06 · Puesta en marcha','Aviso, acta, informe técnico firmado, habilitaciones',0,6),
 ('07','07 · SGI y beneficios','Constancias de carga, vinculación, presolicitud, solicitud, amortización',0,7),
 ('08','08 · Contabilidad y conciliaciones','Reportes de imputación, conciliaciones ERP / IVA / SGI',0,8),
 ('09','09 · Bajas y permanencia','Actas de baja, informes, permanencia',0,9),
 ('10','10 · Auditoría e intimaciones','Visitas, requerimientos y resultados de organismos de contralor',0,10);

INSERT OR IGNORE INTO doc_types (key, name, folder_key, icon, sort) VALUES
 ('memoria','Memoria técnica','01','file-text',1),
 ('dictamen','Dictamen de elegibilidad','01','stamp',2),
 ('informe_prof','Informe profesional','01','file-badge',3),
 ('presupuesto','Presupuesto / cotización','02','file-spreadsheet',4),
 ('comparativo','Comparativo de ofertas','02','scale',5),
 ('oc','Orden de compra','02','clipboard-check',6),
 ('contrato','Contrato','02','file-signature',7),
 ('control_apocrifos','Control de apócrifos ARCA','02','shield-alert',8),
 ('remito','Remito conformado','03','truck',9),
 ('despacho','Despacho de importación','03','ship',10),
 ('acta_recepcion','Acta de recepción','03','clipboard-list',11),
 ('certificado_obra','Certificado de avance de obra','03','hard-hat',12),
 ('foto','Fotografías','03','image',13),
 ('factura','Factura','04','receipt',14),
 ('nota_credito','Nota de crédito','04','receipt-text',15),
 ('orden_pago','Orden de pago','05','banknote',16),
 ('transferencia','Comprobante de transferencia','05','arrow-left-right',17),
 ('retenciones','Detalle de retenciones','05','percent',18),
 ('informe_tecnico','Informe técnico de puesta en marcha','06','badge-check',19),
 ('habilitacion','Habilitación / permiso','06','key-round',20),
 ('constancia_sgi','Constancia SGI','07','landmark',21),
 ('conciliacion','Conciliación','08','git-compare',22),
 ('acta_baja','Acta de baja','09','circle-off',23),
 ('auditoria','Documento de auditoría','10','search-check',24),
 ('otro','Otro','00','file',25);

-- Agenda mensual de obligaciones (procedimiento §5.2.5, 5.2.7, 5.4, 5.5)
INSERT INTO recurring_events (title, description, day_from, day_to, role_key, procedure_ref, color) VALUES
 ('Planificación de futuras puestas en marcha','Cada Responsable de Proyecto envía al Responsable RIMI la planificación (primeros 5 días hábiles).',1,7,'resp_proyecto','5.2.7 · Paso 5','#E0A100'),
 ('Límite registración de comprobantes en ERP','Administración local registra comprobantes, como máximo hasta el día 9.',9,9,'administracion','5.2.4 · Paso 2','#1F3A5F'),
 ('Reporte de imputaciones contables','Contabilidad envía al Responsable RIMI las imputaciones del mes precedente.',10,13,'contabilidad','5.2.5 · Paso 2','#6FA137'),
 ('Reporte IVA Compras','Impuestos envía el reporte con la clasificación de Bienes de Uso.',10,15,'impuestos','5.2.5 · Paso 1','#C2410C'),
 ('Límite corrección de comprobantes','Las correcciones de faltantes / sobrantes deben realizarse antes del día 18.',18,18,'administracion','5.2.5 · Paso 4','#BE123C'),
 ('Validación de correcciones · habilita DJ IVA','El Responsable RIMI valida las correcciones e informa a Impuestos.',19,19,'resp_rimi','5.2.5 · Paso 6','#00322B'),
 ('Reporte mensual de estado por inversión','Se emite cerrada la carga de comprobantes y antes de la DJ de IVA.',16,19,'resp_rimi','5.5 · Paso 1','#7C3AED');
