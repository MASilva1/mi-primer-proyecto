# Arquitectura técnica

## Componentes y flujo implementado

1. **Gmail Trigger:** monitorea correos no leídos cuyo asunto contiene [IDEI].
2. **Preparar datos del correo:** normaliza asunto, descripción, fecha y datos del remitente.
3. **Airtable:** registra el expediente en Solicitudes, vincula Solicitantes y consulta tablas auxiliares de Áreas y Canales.
4. **Agente GPT-4o-mini:** consulta la herramienta Notion de conocimiento y produce una salida estructurada con categoría, prioridad, área, resumen y borrador.
5. **Validar salida IA:** comprueba parseo JSON, categorías, prioridades y combinaciones de área; si falla, detiene el recorrido normal.
6. **Guardar borrador:** actualiza el estado **En revisión**.
7. **Slack + Wait:** notifica la revisión y espera reanudación por una persona. El nodo de espera utiliza **Ignore bots** para evitar activaciones por previsualizaciones automáticas.
8. **Consultar aprobación:** vuelve a leer en Airtable el campo Aprobado.
9. **Decisión:** si está aprobado, registra la aprobación, responde en el hilo Gmail y cambia a Respondido; de lo contrario marca Rechazado sin enviar.
10. **Ruta de contingencia:** registra un incidente en Errores y marca Error cuando identifica la solicitud vinculada.

## Decisiones de ingeniería

- **Human-in-the-loop (HITL)** obligatorio antes de cualquier correo saliente.
- **Fuente de contexto controlada:** los registros de Notion limitan las afirmaciones del modelo. Este uso de Notion es recuperación de contexto, **sin índice vectorial**.
- **Salida validada:** la IA no controla de forma directa la rama de envío; la decisión se consulta en Airtable.
- **Observabilidad:** estados y registro de errores permiten inspección posterior.
- **Filtro básico contra reprocesamiento:** el trigger opera sobre no leídos y el correo se marca como leído cuando procede. Esto **reduce** duplicados; no equivale a idempotencia transaccional garantizada.
- **Prevención de auto-reanudación:** Wait ignora bots.
- **Prototipo reproducible:** valores reales y credenciales fueron retirados del archivo publicado.

## Inventario

- 24 nodos n8n, 1 trigger Gmail, integración con Gmail, Airtable, Notion, Slack y modelo OpenAI.
- Tablas centrales: Solicitudes, Solicitantes, Áreas, Canales y Errores.
- Entrada basada en correo; no hay webhook público de recepción de solicitudes.

## Referencia

Versión observada del entorno n8n: **7/11/2026**. El artefacto público se exporta desactivado y requiere reconfiguración. Ver [guía de despliegue](despliegue.md) y [pruebas](pruebas-y-evidencias.md).
