# Importación y despliegue seguro

> **Atención:** el archivo JSON de este repositorio es una **exportación sanitizada** para portfolio. Mantiene 24 nodos y sus conexiones, pero no es un desplegable listo para producción. **No se debe activar directamente.**

## Requisitos

- Instancia de **n8n** con soporte para nodos Gmail, Airtable, Notion, Slack y OpenAI LangChain.
- Cuentas y credenciales propias en cada plataforma.
- Base Airtable recreada conforme a [modelo-de-datos.md](modelo-de-datos.md).
- Tabla de conocimiento Notion con campos `Tema`, `Contenido validado` y `Palabras clave`.
- Canal de Slack exclusivo para las pruebas.

## Pasos

1. Importá [gestion-solicitudes-idei.sanitizado.json](../workflows/gestion-solicitudes-idei.sanitizado.json) desde **n8n → Import from file**.
2. Dejá el flujo **inactivo**.
3. Configurá las credenciales OAuth de Gmail, Airtable, Notion y Slack, más el acceso al modelo de OpenAI.
4. En los nodos, reemplazá los marcadores `REPLACE_WITH_AIRTABLE_BASE_ID`, `REPLACE_WITH_AIRTABLE_TABLE_ID`, `REPLACE_WITH_NOTION_DATA_SOURCE_ID` y `REPLACE_WITH_SLACK_CHANNEL_ID` por recursos **propios**. El marcador de tabla debe mapearse a la tabla correspondiente de cada nodo: `Solicitudes`, `Solicitantes`, `Áreas`, `Canales` o `Errores`.
5. Volvé a seleccionar recursos que n8n resuelve mediante listas (base, tabla, canal, Notion data source), regenerando automáticamente sus metadatos y mapeos de campos.
6. Revisá cuidadosamente los nombres de campo utilizados en expresiones n8n y las columnas de Airtable; algunos conectores requieren recomponer los mapeos y la asociación de credenciales tras importación.
7. Configurá el filtro de Gmail para actuar solo sobre mensajes de prueba etiquetados `[IDEI]`, no sobre un buzón de trabajo real.
8. Revisá la ruta de errores y el campo de aprobación antes de permitir cualquier envío de correo.
9. Ejecutá pruebas con datos ficticios de aprobación, rechazo, respuesta incompleta y JSON inválido. Comprobá que **sin aprobación no se envía** nada.
10. Únicamente después de validar los permisos, reanudación, idempotencia y manejo de incidentes, evaluá publicar una instancia controlada.

## Marcadores sanitizados

| Marcador | Sustitución esperada |
| --- | --- |
| `REPLACE_WITH_AIRTABLE_BASE_ID` | Base propia |
| `REPLACE_WITH_AIRTABLE_TABLE_ID` | ID específico según la tabla de cada nodo |
| `REPLACE_WITH_NOTION_DATA_SOURCE_ID` | Data source Notion propio |
| `REPLACE_WITH_SLACK_CHANNEL_ID` | Canal Slack de pruebas |

El archivo omite credenciales, identificadores reales, datos de ejecuciones y cualquier pin data. Su propósito es mostrar estructura y técnica, no conectar sistemas externos de un tercero.

## Seguridad

Nunca publiques valores de acceso, secretos OAuth, URLs de reanudación HITL, correos de solicitantes ni datos institucionales reales. No uses una URL de revisión pública como sustituto de autenticación. Las decisiones sensibles corresponden a responsables humanos.
