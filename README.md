# Kreditton SAS — Sistema de Preevaluación Hipotecaria

Sistema interno de gestión y preevaluación de crédito hipotecario para Kreditton SAS. Permite registrar prospectos desde un formulario externo (Tally), gestionar expedientes en un panel interno y ejecutar evaluaciones de viabilidad con score 0–100.

---

## Arquitectura v3

El flujo se divide en dos partes claramente separadas:

```
CLIENTE/ALIADO                         KREDITTON (interno)
──────────────                         ────────────────────
Formulario Tally                       Panel web interno
  ↓                                      ↓
Datos personales, laborales,           Consulta score Datacrédito
ingresos, inmueble, documentos   →     Verifica reportes negativos
  ↓                                    Revisa documentación
n8n webhook                            Ejecuta preevaluación
  ↓                                      ↓
Airtable + email notificación          Resultado viabilidad (Alta/Media/Baja)
+ expediente creado en sistema         Diagnóstico IA + recomendación asesor
```

**El cliente nunca accede al panel interno de Kreditton.**

---

## Características

- **Formulario externo** — 5 secciones: origen, identidad, perfil laboral, finanzas (ingresos + otros ingresos + obligaciones + cuota inicial), inmueble y documentos disponibles
- **Detección de duplicados** — verificación en tiempo real por número de documento; alerta si ya existe expediente
- **Panel interno** — expediente editable con campos del cliente + campos internos (score, reportes, documentación, asesor, estado, notas)
- **Motor de preevaluación** — cálculo con DTI sobre carga total (hipoteca + obligaciones existentes) vs ingresos totales (principal + otros)
- **Score 0–100** — 4 componentes: capacidad de pago (40 pts), LTV (30 pts), score crediticio (20 pts), documentación (10 pts); penalización −15 por reportes negativos
- **Viabilidad Alta / Media / Baja** — clasificación automática con factores explicados
- **Historial inmutable** — cada recálculo crea una nueva evaluación; ninguna se elimina
- **Diagnóstico IA** — narrativa generada por Claude con diagnóstico + recomendación para el asesor (requiere API key Anthropic)
- **Dashboard** — filtros por viabilidad, estado, tipo de cliente, búsqueda por nombre/documento
- **Estados del expediente** — `pendiente_validacion` → `en_revision` → `asignado` → `cerrado`
- **Automatización n8n** — workflow listo para importar: Tally → Airtable + email + expediente

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Backend | Node.js 18 + Express |
| Base de datos | SQLite (better-sqlite3) con migración automática |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| IA | Claude API (Anthropic) — opcional |
| Automatización | n8n (workflow exportado) |
| No-code destino | Airtable + Tally + n8n |

---

## Instalación rápida

**Requisitos:** Node.js 18+, npm 9+

```bash
# 1. Instalar dependencias (backend + frontend)
npm run install:all

# 2. Configurar variables de entorno
cp backend/.env.example backend/.env
# Editar backend/.env — agregar ANTHROPIC_API_KEY si quiere diagnóstico IA

# 3. Arrancar en desarrollo (ambos servidores en paralelo)
npm run dev
```

| Servicio | URL |
|----------|-----|
| Dashboard (frontend) | http://localhost:5173 |
| API REST (backend) | http://localhost:3001 |

Sin API key de Anthropic el sistema funciona completo; el diagnóstico IA muestra modo demo.

---

## Estructura del proyecto

```
/
├── backend/
│   ├── src/
│   │   ├── index.js        ← Servidor Express + todas las rutas API
│   │   ├── scoring.js      ← Motor de preevaluación (puro JS, sin dependencias)
│   │   ├── aiDiagnosis.js  ← Integración Claude API
│   │   └── db.js           ← SQLite con migración automática v1→v2→v3
│   └── data/               ← kreditton.db (creado automáticamente)
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx       ← Lista prospectos, filtros, stats
│       │   ├── NewProspect.tsx     ← Formulario externo (simula Tally)
│       │   └── ProspectDetail.tsx  ← Expediente + Preevaluar + Historial
│       ├── components/
│       │   ├── ProspectModal.tsx   ← Vista rápida en modal
│       │   ├── StatsBar.tsx        ← Tarjetas de estadísticas
│       │   ├── StateBadge.tsx      ← Badge de estado
│       │   ├── ViabilityBadge.tsx  ← Badge Alta/Media/Baja
│       │   └── ScoreGauge.tsx      ← Indicador visual del score
│       ├── lib/
│       │   ├── scoring.ts          ← Espejo del motor para preview en tiempo real
│       │   └── format.ts           ← Formateo COP, %, fechas
│       ├── api.ts                  ← Capa de llamadas al backend
│       └── types.ts                ← Interfaces TypeScript
├── n8n/
│   └── workflow.json       ← Workflow importable (Tally → Airtable + email)
├── airtable/
│   └── schema.json         ← Esquema de la base Airtable
└── docs/
    └── setup.md            ← Guía detallada de instalación y configuración
```

---

## API Reference

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/stats` | Estadísticas del dashboard |
| `GET` | `/api/parametros` | Parámetros del motor de scoring |
| `GET` | `/api/prospectos` | Listar con filtros (`viabilidad`, `tipo_cliente`, `estado`, `buscar`, `sin_evaluar`) |
| `POST` | `/api/prospectos` | Crear prospecto (formulario externo) |
| `GET` | `/api/prospectos/buscar?numero_documento=` | Buscar por documento (detección de duplicados) |
| `GET` | `/api/prospectos/:id` | Detalle completo con evaluación activa |
| `PATCH` | `/api/prospectos/:id` | Actualizar campos del prospecto |
| `POST` | `/api/prospectos/:id/evaluar` | Ejecutar o recalcular preevaluación |
| `GET` | `/api/prospectos/:id/evaluaciones` | Historial de evaluaciones |
| `PATCH` | `/api/prospectos/:id/estado` | Cambiar estado + asesor + notas |

---

## Campos del formulario externo (Tally / cliente)

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| `tipo_cliente` | B2B o B2C | ✓ |
| `nombre_aliado` | Aliado o constructora | Solo B2B |
| `tipo_documento` | CC / CE / PA | ✓ |
| `numero_documento` | Número único (detecta duplicados) | ✓ |
| `nombre_completo` | Nombre y apellidos | ✓ |
| `telefono` | Teléfono de contacto | ✓ |
| `email` | Correo electrónico | ✓ |
| `perfil_financiero` | empleado / independiente / pensionado | ✓ |
| `empresa_actual` | Empresa o empleador | — |
| `ingresos` | Ingresos mensuales principales (COP) | ✓ |
| `otros_ingresos` | Otros ingresos mensuales (arriendos, honorarios…) | — |
| `obligaciones_mensuales` | Deudas mensuales actuales (créditos, tarjetas…) | — |
| `valor_inmueble` | Valor del inmueble a comprar (COP) | — |
| `monto_solicitado` | Valor del crédito solicitado (COP) | — |
| `cuota_inicial_disponible` | Cuota inicial disponible (COP) | — |
| `tipo_inmueble` | nuevo / usado | — |
| `subtipo_inmueble` | apartamento / casa | — |
| `plazo_meses` | Plazo deseado (60–240 meses) | — |
| `documentos_adjuntos` | Lista de documentos disponibles | — |

## Campos internos (solo Kreditton)

| Campo | Descripción |
|-------|-------------|
| `score_credito` | Score Datacrédito/TransUnion (300–900) |
| `reportes_negativos` | Reportes en centrales de riesgo |
| `documentacion` | completa / parcial / incompleta |
| `observaciones` | Notas del analista |
| `asesor_asignado` | Asesor comercial responsable |
| `estado` | pendiente_validacion → en_revision → asignado → cerrado |
| `notas_internas` | Notas de gestión interna |

---

## Reglas del motor de scoring

El motor usa los siguientes parámetros (ajustables en `backend/src/scoring.js`):

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `TASA_EA` | 15.5% | Tasa efectiva anual de referencia |
| `MAX_DEUDA_RATIO` | 40% | Carga máxima sobre ingresos totales |
| `ALTA_LTV_MAX` | 80% | LTV máximo para viabilidad Alta |
| `ALTA_SCORE_MIN` | 700 | Score mínimo para viabilidad Alta |
| `MEDIA_LTV_MAX` | 90% | LTV máximo para viabilidad Media |
| `MEDIA_SCORE_MIN` | 600 | Score mínimo para viabilidad Media |

**DTI:** `(cuota_hipoteca + obligaciones_actuales) / (ingresos + otros_ingresos) ≤ 40%`

**Score 0–100:**
- Capacidad de pago (40 pts): basado en `carga_total / ingresos_totales`
- LTV (30 pts): `monto_solicitado / valor_inmueble`
- Score crediticio externo (20 pts): rangos 750+, 700+, 650+, 600+
- Documentación (10 pts): completa = 10, parcial = 5, incompleta = 0
- Penalización reportes negativos: −15 pts

---

## Automatización n8n (arquitectura objetivo)

Importar `n8n/workflow.json` en n8n Cloud o self-hosted:

1. Conectar credenciales: Airtable, SMTP (email), Anthropic (opcional)
2. Reemplazar `YOUR_AIRTABLE_BASE_ID` con el ID real de la base
3. Apuntar el webhook de Tally a `https://tu-n8n/webhook/kreditton-prospecto`
4. El workflow detecta duplicados, crea el expediente y notifica al equipo con enlace directo

---

## Variables de entorno

```env
# backend/.env
ANTHROPIC_API_KEY=sk-ant-api03-...   # Opcional — diagnóstico IA
PORT=3001                             # Puerto del servidor (default: 3001)
```
