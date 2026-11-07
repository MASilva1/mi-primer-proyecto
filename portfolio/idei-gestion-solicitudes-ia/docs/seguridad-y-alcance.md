# Seguridad, privacidad, límites y alcance

## Principio rector: IA asistida, decisión humana

La IA está diseñada para **clasificar, resumir y redactar un borrador**. No aprueba pagos, trámites, licencias, compras ni actos institucionales. El envío externo queda condicionado a un control humano explícito.

## Salvaguardas incluidas

- Validación de JSON y valores permitidos, incluidos criterios de coherencia de área.
- Pausa **HITL** y consulta posterior del campo `Aprobado`.
- Rama de rechazo sin correo externo.
- Registro de incidentes en Airtable.
- Mitigación de reanudaciones automáticas de Slackbot mediante **Ignore bots**.
- Instrucciones al modelo para no inventar normativa, requisitos, plazos ni procedimientos.
- Marcado de mensajes como leídos para reducir reprocesamiento.
- Exportación de portfolio sin credenciales, registros operativos ni identificadores internos.

## Riesgos residuales y oportunidades de mejora

1. **Autenticación HITL:** las URLs de reanudación deben mantenerse privadas y protegerse con controles apropiados. `Ignore bots` no reemplaza autenticación.
2. **Idempotencia:** usar mensajes no leídos reduce duplicados, pero no garantiza procesamiento exactamente una vez. Puede ampliarse con una clave única basada en el ID de Gmail.
3. **Calidad de IA:** los borradores pueden ser incompletos o inexactos y requieren validación humana.
4. **Privacidad:** aplicar minimización, acceso por roles, retención limitada y datos de prueba. No añadir identificadores de personas a Slack innecesariamente.
5. **Contingencias:** monitorear errores, reintentos y estados terminales para prevenir envíos duplicados después de un fallo.
6. **Trazabilidad:** añadir auditoría independiente de identidad del aprobador, fecha, resultado y versión del borrador.

## Alcance documentado

Este es un **prototipo académico de demostración** aplicado al contexto administrativo universitario. No representa un producto oficial de la Universidad Nacional de San Juan. El flujo final verificado comprende Gmail, n8n, OpenAI, Notion, Airtable y Slack. **WhatsApp Cloud API no se implementó en esta versión.**

La recuperación de conocimiento se basa en consultar entradas estructuradas de Notion. No hay evidencia de índice vectorial, embeddings ni base vectorial, por lo que no se describirá como tal.

## Información no publicada

Se excluyen credenciales, tokens, identificadores internos de integraciones, correo de solicitantes, mensajes de producción y material cuya autorización de distribución no se haya comprobado.
