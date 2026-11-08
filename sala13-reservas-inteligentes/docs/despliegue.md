# Uso del código publicado

Este proyecto es un **caso demostrativo de portfolio** basado en una implementación institucional real. No está destinado a controlar el servicio público actual mediante una copia.

## Estructura

```text
sala13-reservas-inteligentes/
├── README.md
├── src/
│   ├── Code.gs
│   └── Index.html
└── docs/
    ├── arquitectura.md
    ├── caso-de-negocio.md
    └── despliegue.md
```

## Para una instalación de prueba en una cuenta autorizada

1. Crear un proyecto en Google Apps Script.
2. Crear el archivo `Code.gs` y un HTML llamado `Index`; copiar el contenido respectivo de `src/`.
3. Usar una cuenta de prueba sin datos reales; revisar permisos de Calendar, Sheets y MailApp.
4. Configurar las propiedades de script y el correo administrador mediante las funciones de configuración.
5. Configurar el disparador temporal de recordatorios si se necesita probar ese flujo.
6. Desplegar como Web App con permisos acordes al entorno de prueba.
7. Verificar altas, conflictos, feriados, recurrencias, confirmaciones y cancelaciones con datos ficticios.

**Precaución:** no ejecutar `configurarSala13` ni activar disparadores en una cuenta institucional sin autorización. Evitar la duplicación de calendarios o envíos de correo reales.

**Versionado:** el código corresponde al snapshot disponible en septiembre de 2026. Las mejoras posteriores del despliegue real pueden no estar reflejadas. En la copia pública se reemplazó la URL fija del despliegue por `ScriptApp.getService().getUrl()`.

## Sobre IA

La IA asistió al desarrollo y al refinamiento del código. El sistema no incorpora inferencia mediante un modelo de lenguaje en tiempo de ejecución. Esto diferencia claramente las habilidades de **AI-assisted coding** de las soluciones con IA generativa integrada.
