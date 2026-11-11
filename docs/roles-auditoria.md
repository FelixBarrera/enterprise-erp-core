# Roles de revisión (auditoría por perspectivas)

Todo módulo se revisa desde estos roles **sobre el código implementado y con las pruebas en verde**, nunca sobre el plan. Un "Aprobado" sin código detrás no vale.

Si un rol obligatorio, o uno condicional que aplica, rechaza: **no se mergea**.

La revisión del **diseño** (antes de codificar) también se hace, en `docs/modulos/<modulo>.md`, pero no reemplaza la del código.

## Obligatorios (siempre)

| # | Rol | Qué revisa |
|---|---|---|
| 1 | Full Stack Senior | Coherencia entre API y pantallas; contratos y tipos; formato `{ success, data, message }`; regla de `null` en los dos lados |
| 2 | Arquitecto de Software | Hexagonal respetada; puertos bien definidos; `domain/` sin frameworks; value objects donde corresponde; fronteras entre módulos; nada duplicado que debería estar en `shared/` |
| 3 | DBA Senior | Tipos (`Decimal`, `timestamptz`); integridad referencial; FK con índice; índices solo los necesarios; únicos parciales; `CHECK`; consultas sin N+1; `EXPLAIN ANALYZE` en lo grande |
| 4 | Arquitecto de Seguridad | Argon2id; tokens (memoria y cookie); límites de peticiones; secretos; OWASP Top 10; ataques de tiempo; permisos por endpoint y sin escalada; nada sensible en `localStorage` ni en logs; datos personales (LOPDP) |
| 5 | Auditor / Contador | Trazabilidad (auditoría de cada cambio); retención 7 años; secuenciales sin huecos; registros inmutables; cumplimiento fiscal |
| 6 | DevOps / SRE | Despliegue reproducible; respaldos; logs; health check; CI; variables nuevas en `.env.example` y CI; comandos repetibles |
| 7 | QA Senior | Cobertura; casos borde; matriz de `null`; pruebas manuales del módulo al día |
| 8 | Especialista del dominio | Reglas del negocio, normativa del sector, catálogos oficiales, integraciones del rubro del proyecto. En la base, ver abajo |
| 9 | Product Owner / Analista | El modelo refleja el trabajo real; cada campo tiene un uso; menos pasos que el sistema anterior; rendimiento percibido |

## Condicionales (según el módulo)

| # | Rol | Aplica si… | Qué revisa |
|---|---|---|---|
| 10 | Arquitecto Fiscal SRI | toca facturación, firma, certificados, retenciones, ATS | Fichas técnicas vigentes, versiones por comprobante, clave de acceso de 49 dígitos, firma XAdES-BES, catálogos del SRI, RIDE, uso seguro de `sri-ec` |
| 11 | Arquitecto de Datos | crea o cambia tablas | Schema documentado, migraciones revisadas, una o varias empresas, estrategia de datos a largo plazo, registro de tablas al día |
| 12 | Arquitecto de Integraciones | toca servicios externos o colas | Todo detrás de puertos, errores de red, reintentos y tiempos máximos, colas para lo largo |
| 13 | Diseñador UX/UI | tiene pantallas | Jerarquía visual (una acción principal), molde común, estados completos (cargando, vacío, error, éxito, sin conexión), formularios, responsive con capturas en PC, tablet y celular, WCAG AA medida, textos simples, clics de la tarea frecuente |
| 14 | Cumplimiento regulatorio | el rubro tiene regulador | Reportes obligatorios al regulador, prevención de lavado de activos (debida diligencia, operaciones inusuales), conservación de documentos, datos personales. En la base, ver abajo |

## En los módulos de la base

La base (`health`, `empresas`, `auth`, `auditoria` y `shared/`, sección 1.1 del `CLAUDE.md`) sirve para cualquier negocio. Dos roles cambian lo que revisan en ella:

- **8 Especialista del dominio**: que **no haya nada del rubro dentro** (tablas, campos, reglas, textos o catálogos de un negocio en particular) y que lo que cambia de una instalación a otra esté en el `.env`. Si encuentra algo del rubro, **rechaza**. La única excepción es lo que el usuario ve con la marca (`docs/arquitectura-frontend.md`, 8.6).
- **14 Cumplimiento regulatorio**: solo lo que pide cualquier regulador a cualquier negocio (datos personales con la LOPDP, trazabilidad y conservación de la bitácora). Lo propio del regulador del rubro (reportes, lavado de activos) se revisa en los módulos del negocio.

## Formato del reporte

En el documento de diseño del módulo (`docs/modulos/<modulo>.md`, sección "Revisión"):

| # | Rol | Veredicto | Observaciones |
|---|---|---|---|
| 1 | Full Stack Senior | Aprobado / Rechazado / N/A | … |

- Un **N/A** explica por qué no aplica.
- Cada hallazgo lleva un código: `FS-01`, `ARQ-01`, `DBA-01`, `SEG-01`, `AUD-01`, `OPS-01`, `QA-01`, `DOM-01`, `PO-01`, `SRI-01`, `DAT-01`, `INT-01`, `UX-01`, `CUM-01`.
- Los hallazgos que se aplazan quedan anotados con **cuándo** se resuelven (por ejemplo, "antes de producción").

## Matriz por módulo

Qué roles condicionales aplican a cada módulo planificado. Se llena al planificar (paso 6 y paso 7).

| Módulo | 10 SRI | 11 Datos | 12 Integraciones | 13 UX/UI | 14 Cumplimiento |
|---|---|---|---|---|---|
| `health` (paso 5) | N/A | N/A | Sí (base y Redis) | N/A | N/A |
| `empresas` (paso 6) | N/A | Sí (varias empresas en la misma base) | N/A | Sí | N/A |
| `auth-usuarios` (paso 6) | N/A | Sí | Sí (Redis para el límite de peticiones) | Sí | Sí (datos personales, trazabilidad) |
| `auditoria` (paso 6) | N/A | Sí | N/A | Sí | Sí (conservación) |
| Módulos de negocio | se definen en el paso 7 | | | | |

## Revisión externa adicional

Al terminar un módulo con dinero o datos fiscales, y antes de producción, Claude **propone** al usuario `/code-review ultra` (revisión en la nube con varios agentes, con costo). La lanza el usuario, no Claude. No se usa para cambios menores.
