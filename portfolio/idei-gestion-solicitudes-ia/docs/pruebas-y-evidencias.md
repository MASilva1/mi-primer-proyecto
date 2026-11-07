# Pruebas y evidencias — 7 de noviembre de 2026

Validación controlada del workflow n8n mediante solicitudes de prueba y consulta cruzada de Gmail, Airtable, Slack y Notion. Se verificaron cinco ejecuciones consecutivas relevantes.

| Ejecución | Escenario | Resultado observado |
| --- | --- | --- |
| **#53** | Rechazo humano | Solicitud en `Rechazado`; Gmail no envió respuesta |
| **#54** | Aprobación de solicitud de compras | Clasificada como Compras y contrataciones, prioridad Baja; respuesta en hilo de Gmail y estado `Respondido` |
| **#55** | Salida inválida controlada | Validador activó contingencia, registró error y marcó la solicitud `Error`; no hubo respuesta por Gmail |
| **#56** | Solicitud urgente con vencimiento | Categoría Proyectos, subsidios y becas, prioridad Alta; revisión, aprobación y estado `Respondido` |
| **#57** | Consulta con información incompleta | El borrador evitó inventar requisitos; tras revisión y aprobación, respuesta Gmail y estado `Respondido` |

## Riesgo identificado y corrección

Durante la validación se observó que la previsualización automática del enlace de reanudación en Slack podía reactivar la espera. Se habilitó **Ignore bots** en el nodo Wait y se comprobó el comportamiento corregido.

## Métricas del tablero (corte histórico)

| Métrica | Valor |
| --- | ---: |
| Solicitudes registradas | 10 |
| Solicitudes respondidas | 3 |
| Registros con error | 1 |
| Aprobaciones humanas / decisiones registradas | 3 / 5 |
| Tasa de aprobación HITL | 60 % |

Estas cifras corresponden al corte documentado; **no** son indicadores de producción continua ni un benchmark de rendimiento empresarial.

## Demostraciones

- [Video de demostración (2:57)](https://youtu.be/qwjR3EYyDpg)
- [Página de evidencias, diagramas, manual y JSON original de la entrega](https://app.notion.com/p/3f3bc1d8040881b0b4b5fe992db0209e)
- [Vista pública de Airtable](https://airtable.com/appmKVYGezlFiIqUG/shrlgs0EJV8Bf9xiZ)

Se omiten logs y capturas que pudieran exponer direcciones de correo, tokens o información de terceros.
