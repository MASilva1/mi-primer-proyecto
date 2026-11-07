# Modelo de datos — Airtable

Esquema descriptivo contrastado con la base del prototipo el **7/11/2026**. Se publican nombres y tipos de campos, **no** registros con datos personales ni identificadores internos.

## Solicitudes

| Campo | Tipo |
| --- | --- |
| Asunto | Texto |
| Descripción | Texto largo |
| Fecha de ingreso | Fecha y hora |
| Estado | Selección |
| Prioridad | Selección |
| Categoría | Selección |
| Resumen generado por IA | Texto largo |
| Respuesta sugerida | Texto largo |
| Aprobado | Booleano |
| Fecha de aprobación | Fecha |
| Fecha de respuesta | Fecha |
| Solicitante relacionado | Relación |
| Área responsable | Relación |
| Canal de salida | Relación |
| Error relacionado | Relación |
| Aprobación KPI, Salida KPI, Error KPI | Fórmulas |

Estados empleados: **Pendiente**, **Procesando**, **En revisión**, **Aprobado**, **Rechazado**, **Respondido** y **Error**.

## Tablas relacionadas

| Tabla | Campos principales | Finalidad |
| --- | --- | --- |
| Solicitantes | Nombre, Email, Teléfono, Área o procedencia, Solicitudes relacionadas | Evitar perder trazabilidad del remitente |
| Áreas | Nombre del área, Responsable, Email, Solicitudes relacionadas | Proponer derivaciones y relacionar el área |
| Canales | Nombre del canal, Tipo, Activo, Solicitudes | Registrar el canal Gmail |
| Errores | Workflow, Fecha, Nodo, Tipo de error, Descripción, Estado del error, Solicitud relacionada | Auditoría y seguimiento de contingencias |

La base incluye una tabla adicional llamada Contenido, no esencial para el flujo central aquí documentado.

## Base de conocimiento de Notion

Propiedades: **Tema**, **Contenido validado**, **Palabras clave**. Contiene criterios orientativos del prototipo sobre categorías, tono, derivación, privacidad, borradores y estados. Su contenido **no** reemplaza normativa oficial.

## Relaciones simplificadas

~~~mermaid
erDiagram
    SOLICITANTES ||--o{ SOLICITUDES : presenta
    AREAS ||--o{ SOLICITUDES : gestiona
    CANALES ||--o{ SOLICITUDES : recibe
    SOLICITUDES ||--o{ ERRORES : registra
~~~

Los tipos de relación describen el propósito lógico; el modelo real utiliza campos enlazados nativos de Airtable.
