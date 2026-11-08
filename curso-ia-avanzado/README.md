# IdeI SmartDesk AI | Laboratorio de automatización avanzada

**n8n · OpenAI · Airtable · Gmail · Slack · Agent workflows · Human-in-the-loop**

Este directorio reúne ejercicios y prototipos desarrollados durante una formación en automatización e IA. El objetivo fue **aprender a orquestar flujos reutilizables** aplicables a procesos administrativos: clasificación, búsqueda de información, redacción, memoria de contexto, contactos CRM y supervisión humana.

**Naturaleza:** prácticas académicas progresivas, no un servicio institucional productivo.

## Progresión de las entregas

| Etapa | Tema | Evidencia |
|---|---|---|
| [Checkpoint 1](checkpoint-1/) | Primer workflow y bases de automatización | [JSON](checkpoint-1/checkpoint1_matias_silva.json) |
| [Checkpoint 2](checkpoint-2/README.md) | Orquestación Manager–Worker, clasificación y subflujos | README + 3 JSON exportados |
| [Checkpoint 3](checkpoint-3/README.md) | Memoria por sesión, resumen contextual y Airtable | README + workflow JSON |
| [Checkpoint 4](checkpoint-4/README.md) | Integración de CRM, correo y Slack; validación, anti-bucles y borradores HITL | README + JSON + evidencias |

## Habilidades evidenciadas

- Diseñar **arquitecturas de agentes** con responsabilidades diferenciadas (Manager y Workers).
- Utilizar JSON estructurado para intercambio entre etapas y validación de salidas.
- Integrar servicios externos con n8n: Gmail, Airtable y Slack.
- Mantener estado de conversaciones y condensar contexto en memoria persistente.
- Prevenir bucles de auto-respuesta y controlar errores de entradas.
- Restringir el envío automático de correos con un **paso explícito de revisión humana**.
- Documentar limitaciones y pruebas, distinguiendo simulaciones de operaciones reales.

## Proyecto complementario aplicado

[**Gestión inteligente de solicitudes administrativas — caso de uso IDEI**](../portfolio/idei-gestion-solicitudes-ia/README.md): documentación consolidada de un prototipo de clasificación y seguimiento con evidencia de ejecuciones controladas.

## Seguridad y honestidad técnica

Los JSON son material educativo. **No deben activarse directamente en una cuenta de producción**: revisar identificadores, credenciales, scopes de OAuth, destinatarios, permisos, lógica anti-bucles y fallos antes de cualquier despliegue. Algunos archivos pueden contener referencias a IDs o endpoints de la instancia de práctica; dichos valores no son instrucciones de instalación.

Las pruebas y los alcances de cada checkpoint se documentan en sus README individuales. Un flujo configurado no equivale necesariamente a un proceso validado extremo a extremo.

---

[**Volver al portfolio principal**](../README.md) · [LinkedIn](https://www.linkedin.com/in/matysilv/)
