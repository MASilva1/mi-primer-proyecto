# Manual operativo del prototipo

## Objetivo
Clasificar y gestionar solicitudes administrativas que ingresan por Gmail, registrar su evolución y proponer respuestas con IA sujetas a revisión humana obligatoria.

## Secuencia de operación

1. Enviar un correo de prueba cuyo asunto contenga `[IDEI]` desde una cuenta de pruebas autorizada.
2. El disparador de Gmail detecta el mensaje no leído; n8n normaliza el contenido.
3. La automatización crea el registro en Airtable y relaciona el solicitante.
4. GPT-4o-mini consulta los criterios de Notion y propone una salida con `categoria`, `prioridad`, `area_responsable`, `resumen`, `respuesta_sugerida` y `requiere_revision`.
5. El código validador comprueba formato, valores permitidos y correspondencia básica entre área y categoría.
6. Airtable almacena el borrador en estado `En revisión`.
7. Slack avisa al responsable; el flujo se detiene en un paso de espera de intervención humana.
8. Una persona evalúa el texto y marca o no `Aprobado` en Airtable.
9. Tras la reanudación, n8n lee nuevamente ese campo. Aprobado: responde desde Gmail en el hilo original y marca `Respondido`. No aprobado: marca `Rechazado` y no envía correo.
10. Los fallos registrados se derivan a la tabla `Errores`, con vinculación a la solicitud cuando es posible.

## Estados

| Estado | Significado |
| --- | --- |
| Pendiente | Registro recibido |
| Procesando | Procesamiento automatizado |
| En revisión | Borrador pendiente de verificación humana |
| Aprobado | Persona responsable autorizó la propuesta |
| Rechazado | Persona responsable no autoriza el envío |
| Respondido | Gmail confirmó el envío |
| Error | Falla registrada que necesita seguimiento |

## Buenas prácticas operativas

- Usar cuentas, canales y bases de prueba separados de los sistemas institucionales productivos.
- Comprobar remitente, asunto, prioridad, categoría y propuesta antes de aprobar.
- No aprobar respuestas que inventen plazos, normativas o autorizaciones.
- Analizar `Errores` antes de repetir un caso para evitar correos duplicados.
- Revisar historial de ejecuciones, métricas y autorizaciones humanas.
- Probar siempre las ramas de aprobación, rechazo y contingencia antes de activar una copia.

La automatización es un **prototipo académico**, no un sistema oficial de la UNSJ.

[Documentación completa en Notion](https://app.notion.com/p/3f3bc1d8040881b0b4b5fe992db0209e)
