# Guía de configuración — Kreditton Sistema de Preevaluación

## Requisitos previos

- Node.js 18+
- npm 9+
- (Opcional) API key de Anthropic para diagnóstico IA

---

## Instalación rápida

```bash
# 1. Instalar dependencias (backend + frontend)
npm run install:all

# 2. Configurar variables de entorno del backend
cp backend/.env.example backend/.env
# Editar backend/.env y agregar tu ANTHROPIC_API_KEY

# 3. Arrancar en modo desarrollo (ambos servidores)
npm run dev
```

- **Dashboard**: http://localhost:5173
- **API backend**: http://localhost:3001

---

## Configuración de la API key de Anthropic

Sin API key, el sistema funciona igual pero el diagnóstico narrativo mostrará
un mensaje de demo. Para activarlo:

1. Obtener una API key en https://console.anthropic.com
2. Editar `backend/.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```
3. Reiniciar el backend

---

## Estructura del proyecto

```
/
├── backend/             ← API Node.js + Express
│   ├── src/
│   │   ├── index.js     ← Servidor + rutas API
│   │   ├── scoring.js   ← Motor de preevaluación (reglas de negocio)
│   │   ├── aiDiagnosis.js  ← Integración Claude API
│   │   └── db.js        ← Base de datos SQLite
│   └── data/            ← Archivo kreditton.db (creado automáticamente)
├── frontend/            ← React + Vite + Tailwind
│   └── src/
│       ├── pages/       ← Dashboard + Formulario nuevo prospecto
│       ├── components/  ← Componentes reutilizables
│       └── lib/         ← Scoring preview + formateo
├── n8n/
│   └── workflow.json    ← Workflow exportable para n8n (arquitectura objetivo)
├── airtable/
│   └── schema.json      ← Esquema de la base Airtable (arquitectura objetivo)
└── prompts/
    └── perfilamiento.md ← Prompt documentado para Claude con ejemplos
```

---

## API Reference

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/stats` | Estadísticas generales |
| GET | `/api/parametros` | Parámetros del scoring |
| GET | `/api/prospectos` | Listar prospectos (filtros: `viabilidad`, `tipo_cliente`, `estado`) |
| POST | `/api/prospectos` | Registrar prospecto (corre scoring + IA) |
| GET | `/api/prospectos/:id` | Detalle completo |
| PATCH | `/api/prospectos/:id/estado` | Actualizar estado de gestión |

---

## Migración a arquitectura No-Code (producción)

El MVP en código simula la arquitectura objetivo No-Code descrita en:

1. **n8n** (`/n8n/workflow.json`): Importar en n8n Cloud o self-hosted.
   - Configurar credencial `ANTHROPIC_API_KEY` en n8n
   - Configurar credencial Airtable
   - Actualizar `YOUR_AIRTABLE_BASE_ID` con el ID real de tu base
   - Conectar el webhook al campo de JotForm

2. **Airtable** (`/airtable/schema.json`): Crear la base con los campos descritos.
   - Crear los campos según el schema
   - Agregar los registros de parámetros en la tabla `Parametros`
   - Configurar las vistas kanban y de pipeline

3. **JotForm**: Crear formulario con los campos del schema.
   - Mapear los campos al formato esperado por el nodo "Normalizar datos" de n8n
   - Configurar el webhook a la URL del n8n (`/webhook/kreditton-prospecto`)

---

## Reglas de negocio (cambiar en `backend/src/scoring.js`)

Los umbrales están en el objeto `PARAMETROS` al inicio de `scoring.js`.
También se documentan en `airtable/schema.json` tabla `Parametros`.

| Parámetro | Valor actual | Descripción |
|-----------|-------------|-------------|
| TASA_EA | 15.5% | Tasa de referencia del mercado |
| MAX_DEUDA_RATIO | 40% | Máximo endeudamiento sobre ingresos |
| ALTA_LTV_MAX | 80% | LTV máximo viabilidad Alta |
| ALTA_SCORE_MIN | 700 | Score mínimo viabilidad Alta |
| MEDIA_LTV_MAX | 90% | LTV máximo viabilidad Media |
| MEDIA_SCORE_MIN | 600 | Score mínimo viabilidad Media |
