// Configuración e Inicialización de Supabase con Tema Azul Pastel
const SUPABASE_URL = "https://bdehwaxjhxfyzmfdnzmh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZWh3YXhqaHhmeXptZmRuem1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDQxODgsImV4cCI6MjA5OTEyMDE4OH0.zxpENvN_-pTzknh5baF8rY9vtyW8TST7a0U96FiS1Mk";

let supabaseClient = null;

if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.error("La librería de Supabase no se cargó correctamente desde el CDN.");
}

// Función auxiliar para verificar si estamos autenticados como Admin en el localStorage
function checkAdminAuth() {
  const session = localStorage.getItem('rh_admin_session');
  if (!session) {
    window.location.href = 'login.html';
    return false;
  }
  try {
    const sessionData = JSON.parse(session);
    if (sessionData.username && sessionData.isLoggedIn) {
      return true;
    }
  } catch (e) {
    // Error al parsear sesión
  }
  window.location.href = 'login.html';
  return false;
}

// Configuración de formulario de registro por defecto
const DEFAULT_REGISTRATION_FORM = {
  name: "Formulario Estándar",
  fields: [
    { id: "email", label: "Correo Electrónico", type: "email", required: true },
    { id: "phone", label: "Teléfono / Celular", type: "tel", required: true },
    { id: "experiencia_anos", label: "Años de Experiencia", type: "number", required: true },
    { id: "grado_estudios", label: "Último Grado de Estudios", type: "select", required: true, options: ["Preparatoria", "Licenciatura", "Maestría", "Doctorado", "Otro"] },
    { id: "resumen_profesional", label: "Breve Resumen Profesional", type: "textarea", required: false }
  ],
  is_active: true
};

const DEFAULT_PSYCHOMETRIC_EXAM = {
  name: "Examen Psicométrico Estándar",
  description: "Examen psicométrico general obligatorio para todas las vacantes.",
  is_psychometric: true,
  parts: [
    {
      title: "Sección 1: Razonamiento Lógico y Aptitudes",
      questions: [
        {
          id: "p1",
          type: "multiple",
          text: "¿Cuál es el número que sigue en la serie: 2, 4, 8, 16, ...?",
          options: ["20", "24", "32", "64"],
          correct: "32"
        },
        {
          id: "p2",
          type: "multiple",
          text: "Si todos los hombres son mortales y Sócrates es un hombre, entonces:",
          options: ["Sócrates es inmortal", "Sócrates es mortal", "Sócrates es inteligente", "Sócrates no es un hombre"],
          correct: "Sócrates es mortal"
        },
        {
          id: "p3",
          type: "boolean",
          text: "El agua hierve a 100 grados Celsius a nivel del mar.",
          options: ["Verdadero", "Falso"],
          correct: "Verdadero"
        }
      ]
    },
    {
      title: "Sección 2: Competencias Laborales y Comportamiento",
      questions: [
        {
          id: "p4",
          type: "multiple",
          text: "Cuando se presenta un problema inesperado en un proyecto, usted suele:",
          options: [
            "Esperar a recibir instrucciones de su superior.",
            "Analizar opciones de solución e implementarlas de inmediato reportando el avance.",
            "Preocuparse y buscar a quién culpar.",
            "Dejar el proyecto de lado hasta que se calme la situación."
          ]
        },
        {
          id: "p5",
          type: "short",
          text: "Describa brevemente cómo maneja usted la frustración cuando las cosas no salen como planeaba:"
        }
      ]
    }
  ]
};

// Asegurar que exista el examen psicométrico por defecto en Supabase
async function ensureDefaultPsychometricExam() {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient
      .from('exams')
      .select('id')
      .eq('is_psychometric', true)
      .limit(1);

    if (error) {
      console.error("Error al buscar examen psicométrico:", error);
      return null;
    }

    if (!data || data.length === 0) {
      const { data: inserted, error: insertError } = await supabaseClient
        .from('exams')
        .insert([DEFAULT_PSYCHOMETRIC_EXAM])
        .select();

      if (insertError) {
        console.error("Error al insertar examen psicométrico por defecto:", insertError);
        return null;
      }
      return inserted[0];
    }
    return data[0];
  } catch (err) {
    console.error("Fallo inesperado al asegurar examen psicométrico:", err);
    return null;
  }
}

// Funciones personalizadas de diálogos hermosos con colores pastel
function showPastelAlert(message, title = "Aviso") {
  // Eliminar cualquier modal existente
  const existing = document.getElementById('pastel-alert-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'pastel-alert-modal';
  modal.className = 'fixed inset-0 z-[999] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300';
  modal.innerHTML = `
    <div class="bg-white rounded-3xl p-6 max-w-sm w-full border border-blue-100 shadow-2xl transform scale-95 transition-all duration-300 space-y-4">
      <div class="flex items-center gap-3 border-b border-blue-50 pb-2">
        <div class="w-9 h-9 bg-blue-100 text-blue-500 rounded-xl flex items-center justify-center text-sm">
          <i class="fa-solid fa-circle-info"></i>
        </div>
        <h4 class="text-base font-bold text-gray-800">${title}</h4>
      </div>
      <p class="text-sm text-gray-600 leading-relaxed">${message}</p>
      <div class="flex justify-end">
        <button id="pastel-alert-ok" class="px-5 py-2 bg-blue-400 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-100 transition duration-300">
          Entendido
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Focus and action
  setTimeout(() => {
    const okBtn = document.getElementById('pastel-alert-ok');
    if (okBtn) {
      okBtn.focus();
      okBtn.addEventListener('click', () => {
        modal.remove();
      });
    }
  }, 50);
}

function showPastelConfirm(message, callback, title = "Confirmar Acción") {
  const existing = document.getElementById('pastel-confirm-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'pastel-confirm-modal';
  modal.className = 'fixed inset-0 z-[999] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300';
  modal.innerHTML = `
    <div class="bg-white rounded-3xl p-6 max-w-sm w-full border border-blue-100 shadow-2xl transform scale-95 transition-all duration-300 space-y-4">
      <div class="flex items-center gap-3 border-b border-blue-50 pb-2">
        <div class="w-9 h-9 bg-amber-100 text-amber-500 rounded-xl flex items-center justify-center text-sm">
          <i class="fa-solid fa-circle-question"></i>
        </div>
        <h4 class="text-base font-bold text-gray-800">${title}</h4>
      </div>
      <p class="text-sm text-gray-600 leading-relaxed">${message}</p>
      <div class="flex justify-end gap-2">
        <button id="pastel-confirm-cancel" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-xs transition">
          Cancelar
        </button>
        <button id="pastel-confirm-yes" class="px-5 py-2 bg-blue-400 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-100 transition">
          Aceptar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  setTimeout(() => {
    const yesBtn = document.getElementById('pastel-confirm-yes');
    const noBtn = document.getElementById('pastel-confirm-cancel');

    if (yesBtn && noBtn) {
      yesBtn.focus();
      yesBtn.addEventListener('click', () => {
        modal.remove();
        if (callback) callback(true);
      });
      noBtn.addEventListener('click', () => {
        modal.remove();
        if (callback) callback(false);
      });
    }
  }, 50);
}

// Asegurar que exista el formulario de registro por defecto en Supabase
async function ensureDefaultRegistrationForm() {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient
      .from('registration_forms')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    if (error) {
      console.error("Error al buscar formulario de registro:", error);
      return null;
    }

    if (!data || data.length === 0) {
      const { data: inserted, error: insertError } = await supabaseClient
        .from('registration_forms')
        .insert([DEFAULT_REGISTRATION_FORM])
        .select();

      if (insertError) {
        console.error("Error al insertar formulario de registro por defecto:", insertError);
        return null;
      }
      return inserted[0];
    }
    return data[0];
  } catch (err) {
    console.error("Fallo inesperado al asegurar formulario de registro:", err);
    return null;
  }
}
