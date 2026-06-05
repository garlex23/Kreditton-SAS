# Guía de configuración — Kreditton Sistema de Preevaluación v3

## Requisitos previos

- Node.js 18+
- npm 9+
- (Opcional) API key de Anthropic para diagnóstico IA narrativo

---

## Instalación rápida

```bash
# 1. Instalar dependencias (backend + frontend)
npm run install:all

# 2. Configurar variables de entorno del backend
cp backend/.env.example backend/.env
# Editar backend/.env y agregar tu ANTHROPIC_API_KEY si la tienes

# 3. Arrancar en modo desarrollo (ambos servidores en paralelo)
npm run dev
```

| Servicio | URL |
|----------|-----|
| Dashboard (frontend) | http://localhost:5173 |
| API REST (backend) | http://localhost:3001 |

La base de datos SQLite se crea automáticamente en `backend/data/kreditton.db` en el primer arranque.
Si ya existía una versión anterior (v1 o v2), la migración se ejecuta automáticamente sin perder datos.

---

## Configuración de la API key de Anthropic

Sin API key el sistema funciona completo; el diagnóstico IA mostrará un texto de demo.
Para activar diagnósticos reales:

1. Obtener una API key en https://console.anthropic.com
2. Editar `backend/.env`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```
3. Reiniciar el backend (`Ctrl+C` y `npm run dev` de nuevo)

---

## Flujo de trabajo

### 1. Registro de prospecto

El cliente o aliado llena el formulario externo (en producción: Tally).
En el MVP: menú **"+ Nuevo prospecto"** en el dashboard.

Campos que llena el cliente:
- Origen (B2B/B2C), datos personales y de contacto
- Perfil laboral, empresa, ingresos principales y otros ingresos
- Obligaciones financieras mensuales actuales
- Datos del inmueble y crédito deseado (valor, monto, plazo)
- Documentos disponibles (checkboxes de los 4 tipos)

Al registrar, el sistema detecta duplicados por número de documento. Si ya existe, muestra enlace al expediente.

### 2. Validación interna (Kreditton)

El equipo recibe un email de notificación con enlace al expediente.
En el panel interno (tab **"Expediente"**) el asesor puede:
- Ver todos los datos del cliente
- Editar cualquier campo
- Consultar el score Datacrédito/TransUnion y anotarlo

### 3. Preevaluación

Tab **"Preevaluar"** del expediente. El analista completa:
- Score crediticio (Datacrédito/TransUnion)
- Estado de la documentación (completa/parcial/incompleta)
- Si tiene reportes negativos en centrales de riesgo
- Confirma/ajusta ingresos, obligaciones y datos del crédito

Vista previa en tiempo real muestra cuota, carga total vs tope del 40%.

Al ejecutar, el sistema calcula:
- Score interno 0–100
- Viabilidad Alta / Media / Baja con factores explicados
- Diagnóstico narrativo IA + recomendación para el asesor

El estado avanza automáticamente de `pendiente_validacion` → `en_revision`.

### 4. Recálculo

Si el cliente cambia condiciones (aumenta cuota inicial, mejora score, etc.),
tab **"Recalcular"**. Cada recálculo se guarda como nueva evaluación en el historial.
Ninguna evaluación anterior se elimina.

---

## Migración de base de datos

La migración es automática al arrancar el backend:
- **Instalación nueva**: crea tablas `prospectos` + `evaluaciones` desde cero
- **v1 → v2**: convierte tabla única `prospectos` a esquema de dos tablas
- **v2 → v3**: agrega columnas `empresa_actual`, `otros_ingresos`, `obligaciones_mensuales`, `cuota_inicial_disponible`, `documentos_adjuntos`; cambia estado `nuevo` → `pendiente_validacion`

No se requiere intervención manual.

---

## Migración a arquitectura No-Code (producción)

### n8n

1. Importar `n8n/workflow.json` en n8n Cloud o self-hosted
2. Configurar credenciales:
   - **Airtable**: token de API personal con acceso a la base
   - **SMTP / email**: cuenta de envío de notificaciones
   - **Anthropic** (opcional): para diagnóstico IA
3. Reemplazar `YOUR_AIRTABLE_BASE_ID` con el ID real de la base Airtable
4. Configurar el webhook de Tally apuntando a `https://tu-n8n/webhook/kreditton-prospecto`

### Airtable

1. Crear base siguiendo `airtable/schema.json`
2. Crear tabla `Prospectos` con todos los campos del schema (incluyendo los nuevos v3: `Empresa actual`, `Otros ingresos`, `Obligaciones mensuales`, `Cuota inicial`, `Documentos adjuntos`)
3. Agregar registros de parámetros en la tabla `Parametros`
4. Configurar vistas: kanban por estado, pipeline, sin evaluar

### Tally

1. Crear formulario con los 5 secciones del flujo externo
2. Mapear cada campo al nombre esperado por el nodo "Normalizar datos Tally" en n8n:
   - `tipo_cliente`, `nombre_aliado`, `tipo_documento`, `numero_documento`
   - `nombre_completo`, `telefono`, `email`, `perfil_financiero`, `empresa_actual`
   - `ingresos`, `otros_ingresos`, `obligaciones_mensuales`
   - `valor_inmueble`, `monto_solicitado`, `cuota_inicial_disponible`
   - `tipo_inmueble`, `subtipo_inmueble`, `plazo_meses`
   - `documentos_adjuntos` (array de valores: `cedula_ciudadania`, `certificado_ingresos`, `extractos_bancarios`, `compromiso_compraventa`)

---

## Reglas de negocio

Ajustables en el objeto `PARAMETROS` al inicio de `backend/src/scoring.js`:

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `TASA_EA` | 15.5% | Tasa efectiva anual de referencia |
| `MAX_DEUDA_RATIO` | 40% | Carga máxima: (hipoteca + obligaciones) / (ingresos + otros) |
| `ALTA_LTV_MAX` | 80% | LTV máximo para viabilidad Alta |
| `ALTA_SCORE_CREDITO_MIN` | 700 | Score mínimo para viabilidad Alta |
| `MEDIA_LTV_MAX` | 90% | LTV máximo para viabilidad Media |
| `MEDIA_SCORE_CREDITO_MIN` | 600 | Score mínimo para viabilidad Media |
| `SEGURO_VIDA_FACTOR` | 1800/10M | Factor de seguro de vida sobre monto |
| `SEGURO_INCENDIO_APTO_FACTOR` | 130×0.95/1M | Factor seguro incendio apartamentos |
| `SEGURO_INCENDIO_CASA_FACTOR` | 150×0.85/1M | Factor seguro incendio casas |

---

## API Reference

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/stats` | Estadísticas del dashboard |
| `GET` | `/api/parametros` | Parámetros del motor de scoring |
| `GET` | `/api/prospectos` | Listar con filtros opcionales |
| `POST` | `/api/prospectos` | Crear prospecto (datos externos) |
| `GET` | `/api/prospectos/buscar?numero_documento=` | Buscar por documento |
| `GET` | `/api/prospectos/:id` | Detalle con evaluación activa |
| `PATCH` | `/api/prospectos/:id` | Actualizar campos del prospecto |
| `POST` | `/api/prospectos/:id/evaluar` | Ejecutar o recalcular preevaluación |
| `GET` | `/api/prospectos/:id/evaluaciones` | Historial de evaluaciones |
| `PATCH` | `/api/prospectos/:id/estado` | Cambiar estado + asesor + notas |

**Filtros disponibles en `GET /api/prospectos`:**
- `viabilidad` — `Alta`, `Media`, `Baja`
- `tipo_cliente` — `B2B`, `B2C`
- `estado` — `pendiente_validacion`, `en_revision`, `asignado`, `cerrado`
- `buscar` — búsqueda por nombre o número de documento
- `sin_evaluar` — `true` para mostrar solo los que no tienen evaluación
