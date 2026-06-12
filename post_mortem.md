# Post-Mortem: Advanced Features Reversion (v1.2.x -> v1.1.1)

## Resumen
Se intentó implementar un monitor de contexto avanzado ("Brain Health"), un Dashboard visual y un sistema de síntesis de memoria. Aunque las ideas eran sólidas, la implementación técnica enfrentó barreras insuperables relacionadas con la arquitectura interna de Antigravity (VS Code), lo que llevó a revertir a la versión estable 1.1.1.

## Funcionalidades Intentadas y Fallas

### 1. Monitor de Contexto (Context Pie/Donut)
**Objetivo**: Mostrar en tiempo real el % de uso de la ventana de contexto (ej. 128k tokens).
**Implementación**: Lectura de logs en `%APPDATA%/Antigravity/logs/`.
**Falla Técnica**: 
- **Ambigüedad de Logs**: Antigravity crea múltiples carpetas de sesión (`window1`, `window2`, `window3`) que no se limpian inmediatamente.
- **Port Matching**: Intentamos correlacionar el puerto del servidor LSP con el contenido del log, pero los logs no siempre contienen el puerto de manera fiable o a tiempo.
- **Latencia de Escritura**: El log no se actualiza en tiempo real. Antigravity escribe en ráfagas, lo que hacía que el indicador mostrara datos obsoletos (ej. 99% del chat anterior) por minutos.

### 2. Dashboard Visual (Webview)
**Objetivo**: Panel con gráficas de uso histórico y gestión de cuentas.
**Falla Técnica**:
- **Consumo de Recursos**: Renderizar un panel completo de React/HTML añadía overhead innecesario.
- **Datos Incompletos**: El dashboard dependía de los mismos datos de logs inestables, mostrando información contradictoria con la barra de estado.

### 3. Síntesis de Memoria (Synthesize Memory)
**Objetivo**: Guardar el estado del "cerebro" en un JSON y facilitar la migración a un nuevo chat.
**Falla Técnica**:
- **Falta de Contexto Real**: Al no poder leer el contenido del chat (por privacidad/arquitectura), la "síntesis" era solo metadata (archivos modificados, git log).
- **Utilidad Limitada**: Sin el resumen real de la conversación, el "Golden Prompt" no aportaba mucho valor sobre simplemente copiar y pegar los archivos abiertos.

## Lecciones Aprendidas
1. **No confiar en Logs para UI**: Usar archivos de log para manejar indicadores de UI en tiempo real es fundamentalmente frágil.
2. **Arquitectura Opaca**: Antigravity no expone una API pública para su estado interno (tokens usados), lo que obliga a usar métodos "hacky" (log scraping) que son inestables.
3. **Simplicidad > Funcionalidad Rota**: Es mejor tener una extensión ligera que funcione al 100% que una suite completa que falle el 20% de las veces.

## Estado Actual (v1.1.1)
- Monitor de Cuota (Polling a API interna): **Estable**.
- Detección de cuentas múltiples: **Estable**.
- UI ligera en Status Bar: **Estable**.
- Sin dependencias de lectura de disco pesado o dashboards complejos.
