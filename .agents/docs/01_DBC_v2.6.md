# Especificación General del Producto (DBC v2.6) - PsicoAlivio

## 1. Nombre del Producto y Categoría de Mercado
*   **Nombre Oficial del Producto:** **PsicoAlivio** (Alternativa secundaria: *AlivioClínico*).
*   **Categoría de Mercado:** Asistente de Inteligencia Clínica, CRM Operacional y Sistema de Blindaje Legal para Psicólogos y Centros de Salud Mental en Chile.
*   **Modelo de Distribución:** Híbrido, ofreciendo autoservicio (SaaS) para profesionales independientes y planes adaptados para la administración multi-profesional de clínicas o centros de atención especializados.

## 2. Propuesta de Valor y Experiencia de Usuario Core
*   **CRM y Ciclo de Vida del Paciente:** El sistema gestiona el flujo completo del paciente, abarcando desde su registro inicial con datos de identidad, RUT e información demográfica estructurada, hasta su ficha clínica cronológica e interactiva, el seguimiento de síntomas, el control financiero y el proceso de alta o epicrisis.
*   **El "Ciclo de Alivio" con IA:** Al finalizar la consulta, el psicólogo dicta un resumen de voz de 3 a 5 minutos. La IA (Google Gemini 1.5 Flash) procesa el audio y genera de manera asíncrona un borrador clínico estructurado en formato SOAP o DAP.
*   **Protocolo HITL Obligatorio:** Cumpliendo con la ética médica y la normativa, el sistema prohíbe el guardado automático de la IA. El profesional debe utilizar de forma ineludible el *Editor de Validación Obligatoria* para revisar, modificar y firmar la nota clínica antes de su persistencia formal en la ficha.
*   **Destrucción Permanente de Audio:** Una vez que el psicólogo valida y firma el registro clínico, un trigger asíncrono ejecuta el *Hard Delete* irreversible del archivo de voz original en Supabase Storage, resguardando el secreto profesional y minimizando los costos de almacenamiento.
*   **Modo Privacidad Cosmético ($O(1)$):** Toggle en la interfaz de Next.js que activa una máscara por expresiones regulares (RegEx) en el cliente. Oculta de forma instantánea nombres (`J*** C*** P***`) y RUTs (`12.***.***-9`) en entornos públicos frente a miradas casuales (*Shoulder Surfing*), sin alterar el caché en memoria de React Query ni invalidar los datos íntegros que viajan de forma segura en el backend.

## 3. El Centro de Documentación Inteligente
*   **Generación de Informes por IA:** Módulo avanzado que consume los datos de la ficha y utiliza **Google Gemini 1.5 Pro** para redactar informes clínicos, evoluciones terapéuticas o epicrisis bajo demanda.
*   **Control del Contexto por Checkbox:** La interfaz del centro de documentación permite al psicólogo seleccionar mediante una lista de verificación (*checkboxes*) exactamente qué notas de sesión o antecedentes históricos de la base de datos debe leer la IA como contexto de análisis, garantizando un control granular del usuario sobre la redacción generada.
*   **Exportación:** Descarga limpia e inmediata de los documentos e informes clínicos generados en formatos DOCX (vía PHPWord/Next.js) y PDF foliados con validez legal.

---

# Directrices de Implementación y Protocolo de Provisionamiento

Para automatizar la construcción de este CRM y Sistema Clínico, se establece el manual de operaciones e instrucciones que el Agente Director procesará de forma autónoma en el entorno local (Windows/WSL2), interactuando con las herramientas de Model Context Protocol (MCP) de GitHub, Vercel y Supabase conectadas a la sesión:

## Estructura del Directorio de Documentación (`.agents/docs/`)
El enjambre debe crear y poblar la carpeta de conocimiento compartida en la raíz del espacio de trabajo con los siguientes archivos obligatorios:
1. `.agents/docs/01_DBC_v2.6.md`: Este documento de consolidación maestro, que incluye la arquitectura de información, lógica del empaquetado de IA por checkboxes y el Mode Privacidad.
2. `.agents/docs/02_esquema_completo.sql`: El script de base de datos extendido y particionado.

## Protocolo de Desacoplamiento y Re-vinculación en Vercel
- **Paso 1 (Unlink):** El agente ejecutará el comando `vercel unlink` para limpiar los metadatos obsoletos de `project.json`.
- **Paso 2 (Link Asistido):** El agente ejecutará `vercel link` e interactuará dinámicamente en la terminal con el usuario para designar el nuevo ID de organización, capturar el nuevo ID de proyecto de Vercel para **PsicoAlivio** y generar un archivo `project.json` limpio.
- **Paso 3 (Git-Ignore):** El agente validará la inyección automática de la carpeta `.vercel/` en el archivo `.gitignore` del proyecto para prevenir la filtración de tokens organizacionales hacia repositorios públicos.

## Descarga de Plugins y Reglas de Comportamiento Estrictas
El Director del enjambre clonará de forma asíncrona los repositorios de utilidades en directorios temporales de caché, extrayendo las habilidades hacia la ruta local `.agents/skills/`:
- `supabase-migration` y `saas-mvp-launcher` -> `.agents/skills/supabase-migration/` y `.agents/skills/saas-mvp-launcher/`.
- `frontend-performance` y `qa-automation` -> `.agents/skills/frontend-perf/` y `.agents/skills/qa-validation/`.
- Inyección de las reglas de comportamiento de Windsurf (`windsurf-antigravity-rules`) para forzar tipado estricto (TypeScript) en el renderizado de tablas Next.js y el bloqueo de logs abiertos (`console.log`) en producción.
