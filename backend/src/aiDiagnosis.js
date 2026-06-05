const Anthropic = require('@anthropic-ai/sdk');
const { formatCOP } = require('./scoring');

const SYSTEM_PROMPT = `Eres un analista financiero experto de Kreditton SAS, una empresa intermediaria de créditos hipotecarios en Colombia.

Tu rol es redactar diagnósticos financieros preliminares de prospectos de crédito. Kreditton NO aprueba créditos directamente — actúa como puente entre compradores de vivienda y entidades bancarias.

REGLAS IMPORTANTES:
- No inventes cifras. Usa exactamente los datos y resultados que te proporcionan.
- La clasificación de viabilidad (Alta/Media/Baja) y el score ya fueron calculados por el sistema. Solo redacta el narrativo.
- Sé objetivo, profesional y conciso. Sin adornos ni redundancias.
- Siempre en español colombiano formal.
- Tu respuesta DEBE ser un JSON válido con la estructura indicada.`;

function buildUserPrompt(prospecto, evaluacion) {
  return `Genera el diagnóstico financiero para el siguiente prospecto:

DATOS DEL PROSPECTO:
- Nombre: ${prospecto.nombre_completo}
- Perfil financiero: ${prospecto.perfil_financiero}
- Ingresos mensuales: ${formatCOP(prospecto.ingresos)}
- Score crediticio externo: ${prospecto.score_credito}
- Reportes negativos: ${prospecto.reportes_negativos ? 'Sí' : 'No'}
- Tipo de cliente: ${prospecto.tipo_cliente}${prospecto.nombre_aliado ? ` (Aliado: ${prospecto.nombre_aliado})` : ''}

DATOS DEL CRÉDITO:
- Valor del inmueble: ${formatCOP(prospecto.valor_inmueble)}
- Monto solicitado: ${formatCOP(prospecto.monto_solicitado)}
- LTV: ${(evaluacion.ltv * 100).toFixed(1)}%
- Tipo de inmueble: ${prospecto.tipo_inmueble} – ${prospecto.subtipo_inmueble}
- Plazo: ${prospecto.plazo_meses} meses (${(prospecto.plazo_meses / 12).toFixed(0)} años)
- Documentación: ${prospecto.documentacion}

RESULTADOS DE PREEVALUACIÓN:
- Cuota total estimada: ${formatCOP(evaluacion.cuota_total)} (sin seguro: ${formatCOP(evaluacion.cuota_sin_seguro)}, seguro vida: ${formatCOP(evaluacion.seguro_vida)}, seguro incendio: ${formatCOP(evaluacion.seguro_incendio)})
- Cuota máxima permitida (40% ingresos): ${formatCOP(evaluacion.cuota_maxima)}
- Ingreso mínimo requerido: ${formatCOP(evaluacion.ingreso_minimo_requerido)}
- Score interno Kreditton: ${evaluacion.score_interno}/100
- VIABILIDAD FINAL: ${evaluacion.viabilidad}
- Factores de clasificación: ${evaluacion.factores_clasificacion.join('; ')}

Responde ÚNICAMENTE con este JSON (sin texto adicional):
{
  "diagnostico": "3-4 oraciones. Análisis objetivo de la situación financiera del prospecto: capacidad de pago, calidad crediticia, nivel de endeudamiento y valor del activo.",
  "recomendacion": "2-3 oraciones. Qué debe hacer el asesor comercial con este caso: si priorizar, qué documentos solicitar, qué ajustes plantear, o por qué no avanzar."
}`;
}

async function generarDiagnostico(prospecto, evaluacion) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      diagnostico: `[MODO DEMO] El prospecto ${prospecto.nombre_completo} presenta una viabilidad ${evaluacion.viabilidad} con un score interno de ${evaluacion.score_interno}/100. Configure ANTHROPIC_API_KEY para activar el análisis con IA.`,
      recomendacion: `[MODO DEMO] Configure la variable de entorno ANTHROPIC_API_KEY en el archivo .env del backend para habilitar las recomendaciones automáticas del asesor comercial.`,
    };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(prospecto, evaluacion) }],
  });

  const texto = message.content[0].text.trim();
  const json = JSON.parse(texto);
  return { diagnostico: json.diagnostico, recomendacion: json.recomendacion };
}

module.exports = { generarDiagnostico };
