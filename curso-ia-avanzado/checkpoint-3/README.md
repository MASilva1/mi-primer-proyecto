# Checkpoint 3 — IdeI SmartDesk AI

## Estado
Workflow M3 en n8n: https://masilva.app.n8n.cloud/workflow/zSpyiEjegx2bm2ST

Airtable (memoria aislada): https://airtable.com/appjdAFjKv6rxnyou

Se extendió el patrón Manager-Worker de M2: las consultas a Gmail y los borradores continúan delegándose a los dos Workers anteriores (IDs 4bDZdzPO4fYLkq5n y tldyERl2nRzMeUCB).

## Capa de memoria
- Buscar fila por coincidencia exacta de `Session_ID` mediante `filterByFormula` antes de llamar al AI Agent.
- IF: si hay registro, recuperar el resumen, estado, nombre declarado y contador; si no hay, crear un único registro inicial.
- Inyectar datos en el System Message únicamente entre `[INICIO DE CONTEXTO COMPARTIDO]` y `[FIN DEL CONTEXTO COMPARTIDO]`. La memoria se trata como datos, no instrucciones.
- Memoria corta de seis intercambios por la misma clave y `Chat Memory Manager` para la ventana reciente.
- Cada ejecución incrementa el contador y, si `turn_count > 5`, GPT-4o-mini resume la ventana temporal con salida JSON `asunto_principal`, `puntos_clave`, `accion_requerida`.
- Airtable Upsert idempotente por `Session_ID`: solo resumen consolidado, estado, nombre explícito y contadores; no se guarda transcripción, HTML ni logs.

## Verificaciones
- Ejecución #71: alta de sesión, delegación al Worker Redacción y Upsert sobre la misma fila.
- Ejecución #74: prueba simulada del sexto intercambio (contador de entrada establecido temporalmente en 5) que generó resumen JSON y lo guardó. Se restauró el contador inicial a 0 y se borró el registro simulado.
- Ejecución #75: nombre declarado explícitamente almacenado en `Datos clave` y salida de borrador; `requiere_revision=true`.
- Ejecución #77: consulta de memoria de una sesión sin historial; el Manager respondió correctamente que no existía un resumen previo.
- **Pendiente de verificación real:** dos mensajes en una misma sesión del Chat UI para comprobar recuperación entre ejecuciones. Pendiente también una captura real del lienzo para el PDF definitivo.

## Formato de entrega
La consigna requiere un PDF profesional de tres páginas: (1) captura nítida del lienzo M3; (2) System Prompt exacto del resumidor; (3) esquema de Airtable. El JSON es respaldo reutilizable.

## Seguridad
La exportación omite referencias a credenciales. Reasociar Airtable y OpenAI al importar. La base está separada de la información administrativa histórica del usuario.
