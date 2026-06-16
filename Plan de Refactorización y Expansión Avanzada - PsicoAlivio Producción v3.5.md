---
autor: Director Maestro de Proyecto SaaS
fecha: 2026-06-16
destinatario: Usuario / Engineering Manager AI (Antigravity 2.0)
asunto: Plan de Refactorización y Expansión Avanzada - PsicoAlivio Producción v3.5
descripcion: Consolidación técnico-arquitectónica definitiva para migrar del andamiaje básico a una plataforma funcional completa, integrando validación estricta de datos (RUT/Email), persistencia multi-tenant y las convenciones de los especialistas.
estado: listo-para-ejecucion
---
# 1. EVALUACIÓN DE ARQUITECTURA Y DIAGNÓSTICO DE VACÍOS (Ficha de Control)

Tras analizar el estado real del repositorio actual de **PsicoAlivio** (Next.js 15, TypeScript, Tailwind CSS), felicito al enjambre por lograr la estética visual vanguardista, el sidebar colapsable multi-tenant y la estructura cosmética del *Modo Privacidad*. Sin embargo, el software se encuentra actualmente en un estado de *mock funcional estático*: los modales no persisten datos reales, múltiples botones carecen de manejadores de eventos y el motor de validación previa es inexistente.

Para transicionar de un MVP visual a una **plataforma productiva de grado clínico**, el Director del Enjambre (Antigravity 2.0) debe guiar a sus subagentes bajo las siguientes convenciones de hierro establecidas previamente con nuestro equipo de especialistas:

### 1.1 Brechas Técnicas y Funcionales Críticas Detectadas
* **Ausencia de Persistencia Activa:** El cliente interactúa con componentes locales (`useState`), pero las mutaciones no invocan al cliente de Supabase ni manejan la variable de sesión multi-tenant `app.current_tenant` para el aislamiento relacional por organización.
* **Falta de Validación Estricta (Pre-Save Hooks):** Campos sumamente sensibles como el **RUT chileno** (tanto de pacientes como de profesionales) y los **correos electrónicos** se guardan de forma directa sin comprobación de módulo 11 o sintaxis formal, arriesgando la degradación de la consistencia y violando las normas de interoperabilidad de la Ley N° 21.668.
* **Desconexión del Flujo Multimodal de IA:** Las interfaces de notas de sesión presentan los campos de texto, pero las API de Google Gemini (Flash y Pro) se encuentran declaradas sin orquestación de consumo real ni control transaccional del *Credit Ledger* (Append-only).

---

# 2. MAPA DE REFACTORIZACIÓN Y CÓDIGO CORE OBLIGATORIO

El Diseñador de Base de Datos y el Arquitecto Técnico inyectan las siguientes soluciones de ingeniería definitivas para resolver las brechas de datos del repositorio.

### 2.1 Utilidad de Validación de Identidad Fiscal Chilena (`src/utils/validators.ts`)
Se establece de forma mandatoria la creación del validador de RUT y Email en el frontend que bloqueará el envío de formularios si el formato es inválido:

```typescript
// src/utils/validators.ts
export const validateRut = (rut: string): boolean => {
  if (!/^[0-9]+-[0-9kK]{1}$/.test(rut)) return false;
  const [num, dv] = rut.split('-');
  let total = 0;
  let factor = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    total += parseInt(num[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const expectedDv = 11 - (total % 11);
  const calculatedDv = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : expectedDv.toString();
  return calculatedDv.toUpperCase() === dv.toUpperCase();
};

export const validateEmail = (email: string): boolean => {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
};
````

### 2.2 Re-Modelado de los Modales para Persistencia Activa (`src/components/NewPatientModal.tsx`)

El subagente Frontend reescribirá los manejadores de envío para conectar de forma reactiva los componentes con el cliente de Supabase, forzando la generación algorítmica del código de ficha `ficha_id_num` con formato `YYMMDDXX` e inyectando las validaciones previas:

TypeScript

```
// src/components/NewPatientModal.tsx (Extracto de Lógica de Persistencia Completa)
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { validateRut, validateEmail } from '@/utils/validators';

export default function NewPatientModal({ isOpen, onClose, onRefresh }: { isOpen: boolean, onClose: () => void, onRefresh: () => void }) {
  const [formData, setFormData] = useState({
    rut_patient: '',
    full_name: '',
    birth_date: '',
    email: '',
    health_system: 'Fonasa',
    status: 'activo'
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. VALIDACIÓN ESTRICTA DE ENTORNO ANTES DE GUARDAR
    if (!validateRut(formData.rut_patient)) {
      setError('El RUT ingresado no es válido o no cumple con el formato (ej: 12345678-9).');
      return;
    }
    if (!validateEmail(formData.email)) {
      setError('El formato del correo electrónico ingresado es incorrecto.');
      return;
    }

    try {
      // 2. OBTENER CORRELATIVO E INYECTAR PARÁMETRO DE ORGANIZACIÓN
      const tenantId = localStorage.getItem('app.current_tenant');
      if (!tenantId) throw new Error('Sesión multi-tenant no inicializada.');

      const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
      
      const { data: countData } = await supabase
        .from('patients')
        .select('ficha_id_num')
        .like('ficha_id_num', `${todayStr}%`);
        
      const nextIndex = String((countData?.length || 0) + 1).padStart(2, '0');
      const generatedFichaId = `${todayStr}${nextIndex}`; // Formato YYMMDDXX

      // 3. MUTACIÓN DIRECTA EN LA BASE DE DATOS OPERATIVA
      const { error: insertError } = await supabase.from('patients').insert([{
        organization_id: tenantId,
        ficha_id_num: generatedFichaId,
        rut_patient: formData.rut_patient,
        full_name: formData.full_name,
        birth_date: formData.birth_date,
        email: formData.email,
        health_system: formData.health_system,
        status: formData.status
      }]);

      if (insertError) throw insertError;
      
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error transaccional al persistir el paciente.');
    }
  };

  if (!isOpen) return null;
  // (Pintado del Formulario Tailwind e inyección del banner moderno e indicador de Error en la UI)
}
```

# 3. CONSTITUCIÓN DE COMPORTAMIENTO Y NAVEGACIÓN COMPLETA

Para evitar que el enjambre de Antigravity 2.0 omita pantallas, modifique archivos de forma desorganizada o sature la ventana de contexto, el archivo de gobernanza `.agents/agents.md` se expande con instrucciones granulares que obligan a respetar el diseño vanguardista y las convenciones del sistema:

# Constitución y Mapa de Navegación del Enjambre - PsicoAlivio

## Reglas de Comportamiento del Director (Engineering Manager)
- **Misión:** Tomar la interfaz visual estática del repositorio y delegar en subtareas paralelas su conexión relacional transaccional completa.
- **Evitar Amnesia:** Divide el desarrollo por sub-vistas atómicas. No permitas que un agente asuma el frontend y el backend en el mismo prompt para mitigar la compactación de contexto.

## Mapeo de Tareas por Pantalla y Subagente de Código

### 1. Vista de Pacientes y CRUD Integral (.src/pages/pacientes.tsx)
- **Asignación:** Subagente Frontend + Subagente Database.
- **Acción:** Conectar la tabla del CRM con Supabase. Implementar filtros interactivos por estado (`activo`, `seguimiento`, `alta`, `archivado`, `inactivo`). Inyectar el botón de exportación CSV utilizando las librerías nativas sin llamadas interactivas de terminal.

### 2. Vista Calendario Clínico (.src/pages/calendario.tsx)
- **Asignación:** Subagente Integraciones + Subagente Frontend.
- **Acción:** Reemplazar el mock por la suite FullCalendar. Conectar el modal de agendamiento con la tabla `public.sessions`, mapeando la leyenda por colores de estado (`Programada` = Azul, `Completa` = Verde, `Cancelada` = Rojo, `Personal` = Gris). Codificar la Edge Function de Next.js para sincronizar asíncronamente las citas con Google Calendar.

### 3. Centro de Documentación y Checkboxes de IA (.src/pages/documentos.tsx)
- **Asignación:** Subagente Core AI + Subagente Frontend.
- **Acción:** Programar el listado de selección de sesiones previas. Al marcar los checkboxes, el array de IDs de `clinical_notes` debe enviarse como contexto inyectado en el prompt hacia la API de Gemini 1.5 Pro en `/api/ai/report` para estructurar la evolución sin alucinaciones, consumiendo transaccionalmente el crédito negativo en el ledger.

### 4. Detalles de Sesión y Carga Multimodal (.src/pages/sesiones/[id].tsx)
- **Asignación:** Subagente Core AI + Subagente UI.
- **Acción:** Activar las tres pestañas físicas. Conectar el cargador de archivos para el procesamiento de audio (Voz a SOAP) e integrar la biblioteca OCR de procesamiento de imágenes para capturar y digitalizar notas manuscritas tomadas por cámara.
