# Checkpoint 2 · IdeI SmartDesk AI · Orquestación Manager-Worker

## Arquitectura
Evolución del Checkpoint 1 sin modificar el flujo original.

- [Manager](https://masilva.app.n8n.cloud/workflow/vjZyr64pN2ncxF5b): Chat Trigger → AI Agent triaje + OpenAI + Structured Output Parser → Switch de taxonomía cerrada → Set de datos mínimos → Execute Sub-workflow (Wait for child to finish = true) → fusión → observabilidad Gmail → respuesta de chat.
- [Worker 1](https://masilva.app.n8n.cloud/workflow/4bDZdzPO4fYLkq5n): Execute Workflow Trigger → consulta Gmail de solo lectura → validación → JSON success/not_found/error.
- [Worker 2](https://masilva.app.n8n.cloud/workflow/tldyERl2nRzMeUCB): Execute Workflow Trigger → comprobación de entrada → AI Agent redactor + OpenAI → JSON success/error. No envía correos.

## Taxonomía cerrada
1. `BUSCAR_CORREO`: búsquedas de evidencia en mensajes existentes.
2. `REDACTAR_BORRADOR`: redacción de textos administrativos; no se envían.
3. `ESCALAR`: solicitudes ambiguas, peligrosas o fuera del ámbito de los Workers.

## Contrato de entrada a cada Worker
```json
{
  "request_id": "62",
  "session_id": "session-de-n8n",
  "intent": "BUSCAR_CORREO",
  "payload": "subject:\"Prueba 4 - Subsidio con vencimiento\""
}
```
El Manager usa un nodo Set antes de cada llamada y excluye metadatos y datos binarios.

## Contrato de salida
```json
{
  "request_id": "62",
  "session_id": "session-de-n8n",
  "worker": "CONSULTA_GMAIL",
  "status": "success",
  "message": "Se localizó un mensaje.",
  "data": {"asunto": "Ejemplo", "remitente": "Ejemplo"}
}
```
`status` puede ser `success`, `not_found`, `needs_review` o `error`. El Manager integra los datos con el motivo de enrutamiento y prepara la respuesta final.

## Resiliencia
- Worker Gmail: sin coincidencias → `not_found`; error del nodo → `error`.
- Worker redactor: entrada incompleta o falla del modelo → `error`.
- Manager: si un Execute Sub-workflow falla, un nodo de contingencia devuelve `error`.
- Timeouts: Manager 180 s, Worker Gmail 75 s, Worker redactor 90 s.
- Observabilidad: Gmail registra ID de ejecución, sesión, Worker, estado y motivo. Se minimizan datos del usuario.

## Pruebas reales verificadas
| Ejecución | Escenario | Resultado |
|---|---|---|
| #62 | Consulta Gmail | success, Worker 1 |
| #64 | Redacción de borrador | success, Worker 2 |
| #65 | Acción no autorizada | needs_review, sin Worker |
| #68 | Correo inexistente | not_found, Worker 1 |

Las pruebas son ejecuciones manuales del Manager con salida verificada. Las rutas de error técnico están configuradas y requieren un fallo real para validar su activación extremo a extremo.

## Entrega formal de Coderhouse
El archivo evaluado es un único PDF: `preentrega_modulo2_silva_matias.pdf`, con capturas reales del lienzo Manager, ambos Workers, configuración del Execute Sub-workflow, panel de ejecución y ruta de error/fallback. Estos JSON se conservan adicionalmente para reproducibilidad y siguientes módulos.

## Seguridad
Los JSON no contienen secretos ni identificadores de credenciales. Al importarlos en otra instancia hay que volver a asociar las credenciales y verificar IDs de sub-workflows.
