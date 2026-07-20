// JS de control para la configuración de formularios dinámicos (admin_forms.js)
document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAdminAuth()) return;

  // Elementos DOM
  const fieldsContainer = document.getElementById('fields-container');
  const previewContainer = document.getElementById('preview-container');
  const btnSaveForm = document.getElementById('btn-save-form');
  const alertBox = document.getElementById('alert-box');
  const alertMsg = document.getElementById('alert-msg');

  let activeFormId = null;
  let formFields = []; // [{ id, label, type, required, options: [] }]

  function showAlert(msg, isError = false) {
    alertMsg.textContent = msg;
    if (isError) {
      alertBox.className = "bg-rose-100 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl flex items-center justify-between text-sm shadow-sm";
    } else {
      alertBox.className = "bg-emerald-100 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-sm shadow-sm";
    }
    alertBox.classList.remove('hidden');
    setTimeout(() => {
      alertBox.classList.add('hidden');
    }, 4500);
  }

  // Cargar Estructura del Formulario desde Supabase
  async function loadFormStructure() {
    if (!supabaseClient) return;
    try {
      await ensureDefaultRegistrationForm(); // Asegura existencia de registro por defecto

      const { data, error } = await supabaseClient
        .from('registration_forms')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        activeFormId = data[0].id;
        formFields = data[0].fields || [];
      } else {
        formFields = JSON.parse(JSON.stringify(DEFAULT_REGISTRATION_FORM.fields));
      }

      renderConfigFields();
      renderLivePreview();
    } catch (err) {
      console.error(err);
      showAlert("Error al cargar la estructura: " + err.message, true);
    }
  }

  // Renderizar la lista de controles configurables
  function renderConfigFields() {
    fieldsContainer.innerHTML = "";
    if (formFields.length === 0) {
      fieldsContainer.innerHTML = `
        <div class="text-center py-8 text-gray-400 text-xs border border-dashed border-blue-200 rounded-2xl">
          El formulario está vacío. Inserta tu primer campo para comenzar.
        </div>
      `;
      return;
    }

    formFields.forEach((field, idx) => {
      let optionsWidget = "";
      if (field.type === 'select') {
        const optsText = (field.options || []).join(', ');
        optionsWidget = `
          <div class="mt-2">
            <label class="text-[10px] text-blue-500 font-bold uppercase block">Opciones de Selección (Separadas por Comas)</label>
            <input
              type="text"
              value="${optsText}"
              class="field-opts-input w-full px-3 py-1.5 border border-blue-100 rounded-xl text-xs mt-0.5"
              data-idx="${idx}"
            >
          </div>
        `;
      }

      fieldsContainer.innerHTML += `
        <div class="p-4 bg-white hover:bg-blue-50/20 rounded-2xl border border-blue-100 relative space-y-3 shadow-sm">
          <button type="button" class="btn-delete-field absolute top-4 right-4 text-rose-400 hover:text-rose-600 transition" data-idx="${idx}">
            <i class="fa-regular fa-trash-can text-sm"></i>
          </button>

          <div class="grid grid-cols-1 sm:grid-cols-1 gap-3">
            <div>
              <label class="text-[10px] text-gray-400 font-bold uppercase block">Etiqueta o Nombre del Campo</label>
              <input
                type="text"
                value="${field.label}"
                class="field-label-input w-full px-3 py-2 border border-blue-100 focus:outline-none rounded-xl text-xs mt-0.5"
                data-idx="${idx}"
              >
            </div>
          </div>

          <div class="flex items-center gap-4 text-xs">
            <label class="flex items-center gap-1.5 cursor-pointer font-bold text-gray-600">
              <input type="checkbox" class="field-required-checkbox text-blue-500 focus:ring-blue-400 rounded" ${field.required ? 'checked' : ''} data-idx="${idx}">
              ¿Campo Obligatorio?
            </label>
            <span class="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded uppercase">${field.type}</span>
          </div>

          ${optionsWidget}
        </div>
      `;
    });

    bindConfigInputs();
  }

  // Vincular eventos interactivos del Diseñador
  function bindConfigInputs() {
    // Cambiar etiquetas
    document.querySelectorAll('.field-label-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = e.target.getAttribute('data-idx');
        const cleanVal = e.target.value.trim();
        formFields[idx].label = cleanVal;

        // Auto-generar ID única para guardar en results JSON
        formFields[idx].id = cleanVal.toLowerCase().replace(/[^a-z0-9]/g, '_');
        renderLivePreview();
      });
    });


    // Cambiar estatus de requerido
    document.querySelectorAll('.field-required-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const idx = e.target.getAttribute('data-idx');
        formFields[idx].required = e.target.checked;
        renderLivePreview();
      });
    });

    // Cambiar opciones de selects
    document.querySelectorAll('.field-opts-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = e.target.getAttribute('data-idx');
        const splitOpts = e.target.value.split(',').map(o => o.trim()).filter(o => o.length > 0);
        formFields[idx].options = splitOpts;
        renderLivePreview();
      });
    });

    // Eliminar campo
    document.querySelectorAll('.btn-delete-field').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.getAttribute('data-idx');
        formFields.splice(idx, 1);
        renderConfigFields();
        renderLivePreview();
      });
    });
  }

  // Insertar un nuevo campo de tipo dinámico
  document.querySelectorAll('.btn-add-field').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      const defaultOpts = type === 'select' ? ["Opción A", "Opción B"] : [];

      formFields.push({
        id: "field_" + Date.now(),
        label: `Nuevo Campo de ${type}`,
        type: type,
        required: true,
        options: defaultOpts
      });

      renderConfigFields();
      renderLivePreview();
    });
  });

  // Renderizar la Vista Previa (Simulación Interactiva)
  function renderLivePreview() {
    previewContainer.innerHTML = "";
    if (formFields.length === 0) {
      previewContainer.innerHTML = `
        <div class="text-center py-12 text-gray-400 text-xs">
          Sin campos. Agrega campos en el panel izquierdo para visualizarlos aquí.
        </div>
      `;
      return;
    }

    formFields.forEach(field => {
      const requiredMarker = field.required ? '<span class="text-rose-500 ml-0.5">*</span>' : '';
      let inputWidget = "";

      if (field.type === 'select') {
        inputWidget = `
          <select class="w-full px-3 py-2 rounded-xl border border-blue-100 text-xs bg-white focus:outline-none">
            <option value="">-- Elige una opción --</option>
            ${(field.options || []).map(opt => `<option value="${opt}">${opt}</option>`).join('')}
          </select>
        `;
      } else if (field.type === 'textarea') {
        inputWidget = `
          <textarea rows="2" class="w-full px-3 py-2 rounded-xl border border-blue-100 text-xs focus:outline-none"></textarea>
        `;
      } else {
        inputWidget = `
          <input type="${field.type}" class="w-full px-3 py-2 rounded-xl border border-blue-100 text-xs focus:outline-none">
        `;
      }

      previewContainer.innerHTML += `
        <div class="space-y-1">
          <label class="block text-xs font-semibold text-gray-600">${field.label}${requiredMarker}</label>
          ${inputWidget}
        </div>
      `;
    });
  }

  // Guardar Formulario Dinámico en Supabase
  btnSaveForm.addEventListener('click', async () => {
    if (formFields.length === 0) {
      showAlert("Por favor, agrega al menos un campo de datos.", true);
      return;
    }

    // Validar nombres vacíos
    if (formFields.some(f => !f.label.trim())) {
      showAlert("Todos los campos configurados deben tener una etiqueta.", true);
      return;
    }

    try {
      const { error } = await supabaseClient
        .from('registration_forms')
        .update({
          fields: formFields
        })
        .eq('id', activeFormId);

      if (error) throw error;
      showAlert("¡Estructura de formulario dinámico guardada exitosamente!");
    } catch (err) {
      showAlert("No se pudo guardar la configuración: " + err.message, true);
    }
  });

  // Inicializar
  await loadFormStructure();
});
