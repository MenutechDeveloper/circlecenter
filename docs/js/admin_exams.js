// JS para el Creador Guiado de Exámenes (admin_exams.js)
document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAdminAuth()) return;

  // Elementos DOM de Pasos
  const stepIndicator1 = document.getElementById('step-indicator-1');
  const stepIndicator2 = document.getElementById('step-indicator-2');
  const stepIndicator3 = document.getElementById('step-indicator-3');
  const stepText1 = document.getElementById('step-text-1');
  const stepText2 = document.getElementById('step-text-2');
  const stepText3 = document.getElementById('step-text-3');

  const step1View = document.getElementById('step-1-view');
  const step2View = document.getElementById('step-2-view');
  const step3View = document.getElementById('step-3-view');

  // Botones y Navegación
  const btnStartWizard = document.getElementById('btn-start-wizard');
  const btnBackTo1 = document.getElementById('btn-back-to-1');
  const btnBackTo2 = document.getElementById('btn-back-to-2');
  const btnSaveExam = document.getElementById('btn-save-exam');
  const btnAddPart = document.getElementById('btn-add-part');

  const examInfoForm = document.getElementById('exam-info-form');
  const examNameInput = document.getElementById('exam-name-input');
  const examDescInput = document.getElementById('exam-desc-input');

  const examsList = document.getElementById('exams-list');
  const partsContainer = document.getElementById('parts-container');
  const alertBox = document.getElementById('alert-box');
  const alertMsg = document.getElementById('alert-msg');

  // Estado Local
  let allExams = [];
  let currentExamId = null; // null si es nuevo examen
  let partsData = []; // [{ id, title, questions: [] }]
  let lastActivePartIdx = 0; // Índice de la sección activa para añadir modos especiales

  // Alerta
  function showAlert(msg, isError = false) {
    showPastelAlert(msg, isError ? "Error" : "Éxito");
  }

  // Lógica de Pestañita Especiales Colapsable
  const specialsSidebar = document.getElementById('specials-sidebar');
  const specialsToggleBtn = document.getElementById('specials-toggle-btn');
  const sidebarAddCanvasBtn = document.getElementById('sidebar-add-canvas');

  if (specialsToggleBtn && specialsSidebar) {
    specialsToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = specialsSidebar.classList.contains('translate-x-0');
      if (isOpen) {
        specialsSidebar.classList.remove('translate-x-0');
        specialsSidebar.classList.add('-translate-x-[260px]');
      } else {
        specialsSidebar.classList.remove('-translate-x-[260px]');
        specialsSidebar.classList.add('translate-x-0');
      }
    });

    // Cerrar sidebar al hacer click fuera
    document.addEventListener('click', (e) => {
      if (specialsSidebar && !specialsSidebar.contains(e.target) && !specialsToggleBtn.contains(e.target)) {
        specialsSidebar.classList.remove('translate-x-0');
        specialsSidebar.classList.add('-translate-x-[260px]');
      }
    });
  }

  if (sidebarAddCanvasBtn) {
    sidebarAddCanvasBtn.addEventListener('click', () => {
      if (partsData.length === 0) {
        showPastelAlert("Por favor, agrega al menos una sección primero antes de insertar una pregunta especial.", "Aviso");
        return;
      }
      if (lastActivePartIdx >= partsData.length) {
        lastActivePartIdx = partsData.length - 1;
      }
      addQuestionToPart(lastActivePartIdx, 'canvas');
      showPastelAlert("¡Pregunta de tipo 'Lienzo Creativo (Canvas)' añadida con éxito a la sección activa!", "Modo Especial");

      // Cerrar sidebar después de agregar
      if (specialsSidebar) {
        specialsSidebar.classList.remove('translate-x-0');
        specialsSidebar.classList.add('-translate-x-[260px]');
      }
    });
  }

  // Cambio visual de pasos (Asistente/Wizard)
  function goToStep(stepNumber) {
    // Reset indicators
    [stepIndicator1, stepIndicator2, stepIndicator3].forEach(ind => {
      ind.className = "w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold text-sm";
    });
    [stepText1, stepText2, stepText3].forEach(txt => {
      txt.className = "text-xs font-semibold text-gray-500 hidden sm:inline";
    });
    [step1View, step2View, step3View].forEach(view => view.classList.add('hidden'));

    // Activar actual
    if (stepNumber === 1) {
      stepIndicator1.className = "w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm";
      stepText1.className = "text-xs font-bold text-blue-600 hidden sm:inline";
      step1View.classList.remove('hidden');
    } else if (stepNumber === 2) {
      stepIndicator2.className = "w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm";
      stepText2.className = "text-xs font-bold text-blue-600 hidden sm:inline";
      step2View.classList.remove('hidden');
    } else if (stepNumber === 3) {
      stepIndicator3.className = "w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm";
      stepText3.className = "text-xs font-bold text-blue-600 hidden sm:inline";
      step3View.classList.remove('hidden');
    }
  }

  // Cargar exámenes
  async function loadExams() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      allExams = data || [];
      renderExamsList();
    } catch (err) {
      console.error(err);
      showAlert("Error al obtener exámenes: " + err.message, true);
    }
  }

  function renderExamsList() {
    examsList.innerHTML = "";
    if (allExams.length === 0) {
      examsList.innerHTML = `
        <div class="text-center py-12 text-gray-400">
          <i class="fa-regular fa-folder-open text-4xl mb-2 text-blue-100 block"></i>
          Aún no se han creado exámenes. ¡Haz clic en "Nuevo Examen" para comenzar!
        </div>
      `;
      return;
    }

    allExams.forEach(exam => {
      const isPsy = exam.is_psychometric === true;
      const checkedAttr = isPsy ? 'checked' : '';
      const badgeHtml = isPsy ? `
        <span class="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-2.5 py-1 rounded-full border border-amber-200 shadow-sm flex items-center gap-1 shrink-0">
          <i class="fa-solid fa-star text-amber-500"></i> Obligatorio
        </span>
      ` : '';

      examsList.innerHTML += `
        <div class="p-5 bg-white hover:bg-blue-50/20 rounded-3xl border border-blue-100/50 flex flex-col md:flex-row md:items-center justify-between transition gap-4 shadow-sm ${isPsy ? 'ring-2 ring-amber-200 bg-amber-50/5 border-amber-200' : ''}">
          <div class="truncate flex-1 space-y-2">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-bold text-gray-800 text-sm truncate">${exam.name}</h3>
              ${badgeHtml}
            </div>
            <p class="text-xs text-gray-400 truncate">${exam.description || "Sin descripción"}</p>

            <!-- Checkbox de Obligatoriedad -->
            <label class="inline-flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" class="toggle-psychometric-chk rounded text-amber-500 border-amber-200 focus:ring-amber-400 w-4 h-4 transition" data-id="${exam.id}" ${checkedAttr}>
              <span class="text-[11px] font-bold text-amber-700 hover:text-amber-800 transition">Establecer como Obligatorio</span>
            </label>
          </div>
          <div class="flex gap-2 shrink-0 justify-end">
            <button class="edit-exam-btn px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-xs transition" data-id="${exam.id}">
              <i class="fa-solid fa-pencil"></i> Editar
            </button>
            <button class="delete-exam-btn px-3 py-1.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl font-bold text-xs transition" data-id="${exam.id}">
              <i class="fa-regular fa-trash-can"></i> Eliminar
            </button>
          </div>
        </div>
      `;
    });

    // Bind Edit/Delete
    document.querySelectorAll('.edit-exam-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const exam = allExams.find(e => e.id === id);
        if (exam) {
          currentExamId = exam.id;
          examNameInput.value = exam.name;
          examDescInput.value = exam.description || "";
          partsData = exam.parts || [];
          goToStep(2);
        }
      });
    });

    document.querySelectorAll('.delete-exam-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        showPastelConfirm("¿Estás seguro de que deseas borrar este examen?", async (accepted) => {
          if (accepted) {
            await deleteExam(id);
          }
        });
      });
    });

    // Toggle Obligatoriedad Psicométrica
    document.querySelectorAll('.toggle-psychometric-chk').forEach(chk => {
      chk.addEventListener('change', async () => {
        const examId = chk.getAttribute('data-id');
        const makePsychometric = chk.checked;

        try {
          if (makePsychometric) {
            // 1. Desmarcar todos los demás exámenes como psicométricos en Supabase
            const { error: resetError } = await supabaseClient
              .from('exams')
              .update({ is_psychometric: false })
              .neq('id', examId);

            if (resetError) throw resetError;

            // 2. Marcar este como psicométrico
            const { error: setSkewError } = await supabaseClient
              .from('exams')
              .update({ is_psychometric: true })
              .eq('id', examId);

            if (setSkewError) throw setSkewError;

            showPastelAlert("Este examen ahora está configurado como el examen Psicométrico Obligatorio y aparecerá primero para todos los candidatos.", "Configuración Guardada");
          } else {
            // Desmarcar este examen
            const { error: resetSingleError } = await supabaseClient
              .from('exams')
              .update({ is_psychometric: false })
              .eq('id', examId);

            if (resetSingleError) throw resetSingleError;

            showPastelAlert("El examen ya no es obligatorio.", "Configuración Guardada");
          }

          await loadExams();
        } catch (err) {
          console.error(err);
          showPastelAlert("Error al actualizar la configuración de obligatoriedad: " + err.message);
          chk.checked = !makePsychometric; // Revert checkbox state
        }
      });
    });
  }

  // Eliminar Examen
  async function deleteExam(id) {
    try {
      const { error } = await supabaseClient
        .from('exams')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showAlert("Examen eliminado correctamente.");
      loadExams();
    } catch (err) {
      showAlert("Error al borrar el examen: " + err.message, true);
    }
  }

  // Navegación Básica del Wizard
  btnStartWizard.addEventListener('click', () => {
    // Resetear formulario para nuevo examen
    currentExamId = null;
    examNameInput.value = "";
    examDescInput.value = "";
    partsData = [{
      id: "part_" + Date.now(),
      title: "Sección 1",
      questions: []
    }];
    goToStep(2);
  });

  btnBackTo1.addEventListener('click', () => goToStep(1));
  btnBackTo2.addEventListener('click', () => goToStep(2));

  // Enviar Formulario General de Examen (Paso 2 -> Paso 3)
  examInfoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    renderParts();
    goToStep(3);
  });

  // ==========================================
  // DISEÑO DE SECCIONES Y PREGUNTAS (PASO 3)
  // ==========================================
  btnAddPart.addEventListener('click', () => {
    partsData.push({
      id: "part_" + Date.now(),
      title: `Sección ${partsData.length + 1}`,
      questions: []
    });
    renderParts();
  });

  function renderParts() {
    partsContainer.innerHTML = "";
    if (partsData.length === 0) {
      partsContainer.innerHTML = `
        <div class="text-center py-6 text-gray-400 text-xs">
          Aún no hay secciones en este examen. Haz clic en "Agregar seccion" para comenzar.
        </div>
      `;
      return;
    }

    partsData.forEach((part, partIdx) => {
      const isPartActive = partIdx === lastActivePartIdx;
      const partHtml = `
        <div class="p-6 rounded-3xl border shadow-sm space-y-4 relative transition-all duration-300 cursor-pointer ${isPartActive ? 'bg-white border-purple-300 ring-4 ring-purple-100' : 'bg-white/80 border-blue-100/70'}" data-part-id="${part.id}" data-idx="${partIdx}">
          <button type="button" class="btn-delete-part absolute top-4 right-4 text-rose-400 hover:text-rose-600 text-xs font-bold transition" data-idx="${partIdx}">
            <i class="fa-regular fa-trash-can mr-1"></i> Eliminar Sección
          </button>

          <div class="w-2/3">
            <label class="block text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Nombre de la Sección</label>
            <input
              type="text"
              value="${part.title}"
              class="part-title-input px-3 py-2 w-full border border-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded-xl text-sm font-semibold"
              data-idx="${partIdx}"
            >
          </div>

          <div class="space-y-3 pt-2">
            <span class="text-xs font-bold text-gray-600 block"><i class="fa-solid fa-clipboard-question text-blue-400 mr-1"></i> Enunciados / Preguntas</span>

            <div class="part-questions-list space-y-3" data-idx="${partIdx}">
              ${renderQuestionsForPart(part.questions, partIdx)}
            </div>

            <!-- Acciones de Preguntas con un Selector Visual Muy Bonito -->
            <div class="bg-blue-50/30 p-4 rounded-xl border border-blue-50 space-y-2 mt-3">
              <span class="text-[10px] font-extrabold text-blue-500 uppercase tracking-wider block">Elige el tipo de pregunta a agregar:</span>
              <div class="grid grid-cols-3 gap-2">
                <button type="button" class="btn-add-question p-3 bg-white hover:bg-blue-100 border border-blue-100 rounded-xl transition flex flex-col items-center justify-center gap-1 group" data-idx="${partIdx}" data-type="multiple">
                  <i class="fa-solid fa-circle-dot text-blue-500 group-hover:scale-110 transition"></i>
                  <span class="text-[10px] font-bold text-gray-700">Opción Múltiple</span>
                </button>
                <button type="button" class="btn-add-question p-3 bg-white hover:bg-sky-100 border border-sky-100 rounded-xl transition flex flex-col items-center justify-center gap-1 group" data-idx="${partIdx}" data-type="boolean">
                  <i class="fa-solid fa-circle-half-stroke text-sky-500 group-hover:scale-110 transition"></i>
                  <span class="text-[10px] font-bold text-gray-700">Falso / Verdadero</span>
                </button>
                <button type="button" class="btn-add-question p-3 bg-white hover:bg-amber-100 border border-amber-100 rounded-xl transition flex flex-col items-center justify-center gap-1 group" data-idx="${partIdx}" data-type="short">
                  <i class="fa-solid fa-font text-amber-500 group-hover:scale-110 transition"></i>
                  <span class="text-[10px] font-bold text-gray-700">Abierta / Corta</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      `;
      partsContainer.innerHTML += partHtml;
    });

    // Inputs de Sección bindings
    document.querySelectorAll('.part-title-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = e.target.getAttribute('data-idx');
        partsData[idx].title = e.target.value;
      });
    });

    // Tracking de la sección activa para modos especiales al hacer click en el bloque
    document.querySelectorAll('[data-part-id]').forEach(block => {
      block.addEventListener('click', (e) => {
        const idx = parseInt(block.getAttribute('data-idx'));
        // Evitar re-renderizado molesto si el usuario hace click directo en inputs/selects/botones
        if (e.target.closest('input, select, textarea, button')) {
          lastActivePartIdx = idx;
          return;
        }
        if (lastActivePartIdx !== idx) {
          lastActivePartIdx = idx;
          renderParts();
        }
      });
    });

    document.querySelectorAll('.btn-delete-part').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.getAttribute('data-idx');
        partsData.splice(idx, 1);
        if (lastActivePartIdx >= partsData.length && partsData.length > 0) {
          lastActivePartIdx = partsData.length - 1;
        }
        renderParts();
      });
    });

    document.querySelectorAll('.btn-add-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const partIdx = btn.getAttribute('data-idx');
        const qType = btn.getAttribute('data-type');
        addQuestionToPart(partIdx, qType);
      });
    });

    bindQuestionInputs();
  }

  function renderQuestionsForPart(questions, partIdx) {
    if (questions.length === 0) {
      return `<div class="text-center py-4 bg-blue-50/10 rounded-xl border border-dashed border-blue-100 text-[11px] text-gray-400">No hay preguntas en esta sección.</div>`;
    }

    return questions.map((q, qIdx) => {
      let extraHtml = "";

      if (q.type === 'multiple') {
        extraHtml = `
          <div class="grid grid-cols-2 gap-2 mt-2">
            ${[0, 1, 2, 3].map(optIdx => `
              <div>
                <label class="text-[9px] text-gray-400 block font-semibold">Opción ${optIdx + 1}</label>
                <input
                  type="text"
                  value="${q.options[optIdx] || ''}"
                  class="q-opt-input w-full px-2 py-1 border border-blue-100 focus:outline-none rounded-lg text-xs"
                  data-part-idx="${partIdx}"
                  data-q-idx="${qIdx}"
                  data-opt-idx="${optIdx}"
                >
              </div>
            `).join('')}
          </div>
          <div class="mt-2">
            <label class="text-[10px] text-blue-600 block font-bold">Opción Correcta</label>
            <select
              class="q-correct-select px-2 py-1 border border-blue-200 focus:outline-none rounded-lg text-xs bg-white w-full max-w-xs mt-0.5"
              data-part-idx="${partIdx}"
              data-q-idx="${qIdx}"
            >
              <option value="">Selecciona la correcta...</option>
              ${[0, 1, 2, 3].map(optIdx => `
                <option value="${q.options[optIdx] || ''}" ${q.correct === q.options[optIdx] && q.correct ? 'selected' : ''}>
                  ${q.options[optIdx] || `Opción ${optIdx + 1}`}
                </option>
              `).join('')}
            </select>
          </div>
        `;
      } else if (q.type === 'boolean') {
        extraHtml = `
          <div class="mt-2">
            <label class="text-[10px] text-blue-600 block font-bold">Respuesta Correcta</label>
            <select
              class="q-correct-select px-2 py-1 border border-blue-200 focus:outline-none rounded-lg text-xs bg-white w-full max-w-xs mt-0.5"
              data-part-idx="${partIdx}"
              data-q-idx="${qIdx}"
            >
              <option value="">-- Selecciona --</option>
              <option value="Verdadero" ${q.correct === 'Verdadero' ? 'selected' : ''}>Verdadero</option>
              <option value="Falso" ${q.correct === 'Falso' ? 'selected' : ''}>Falso</option>
            </select>
          </div>
        `;
      } else if (q.type === 'short') {
        extraHtml = `
          <div class="mt-2 text-[10px] text-blue-400 bg-blue-50/40 p-2 rounded-lg border border-blue-100/30 flex items-center gap-1.5">
            <i class="fa-solid fa-circle-info"></i> Pregunta abierta. El reclutador analizará y evaluará la respuesta de forma libre.
          </div>
        `;
      } else if (q.type === 'canvas') {
        extraHtml = `
          <div class="mt-2 text-[10px] text-purple-600 bg-purple-50 p-3 rounded-xl border border-purple-100 flex flex-col gap-1">
            <span class="font-bold flex items-center gap-1"><i class="fa-solid fa-palette text-purple-500"></i> Lienzo Creativo Integrado (A4 + Herramientas de Dibujo)</span>
            <span class="text-gray-500 font-medium">El candidato dispondrá de un lienzo de dibujo a escala A4 con paleta de colores, trazos libres, círculos, rectángulos, estrellas, atajos de teclado (Ctrl+Z, Ctrl+C, Ctrl+V, Espacio para arrastrar y zoom de rueda) y un temporizador de 30 minutos. El diseño final se exportará como imagen para evaluación.</span>
          </div>
        `;
      }

      return `
        <div class="p-3 bg-blue-50/20 rounded-xl border border-blue-100/30 relative space-y-2">
          <button type="button" class="btn-delete-q absolute top-2 right-2 text-gray-400 hover:text-rose-500 transition" data-part-idx="${partIdx}" data-q-idx="${qIdx}" title="Borrar Pregunta">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>

          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase ${
                q.type === 'multiple' ? 'bg-blue-100 text-blue-700' : q.type === 'boolean' ? 'bg-sky-100 text-sky-700' : q.type === 'short' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'
              }">${q.type === 'multiple' ? 'Múltiple' : q.type === 'boolean' ? 'V / F' : q.type === 'short' ? 'Abierta' : 'Canvas (Ilustrador)'}</span>
              <span class="text-[10px] text-gray-400">Pregunta ${qIdx + 1}</span>
            </div>
            <input
              type="text"
              value="${q.text}"
              class="q-text-input px-3 py-1.5 w-full border border-blue-100 focus:outline-none rounded-lg text-xs"
              data-part-idx="${partIdx}"
              data-q-idx="${qIdx}"
            >
          </div>

          ${extraHtml}
        </div>
      `;
    }).join('');
  }

  function addQuestionToPart(partIdx, type) {
    const defaultOptions = type === 'multiple' ? ["", "", "", ""] : (type === 'boolean' ? ["Verdadero", "Falso"] : []);
    partsData[partIdx].questions.push({
      id: "q_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      type: type,
      text: "",
      options: defaultOptions,
      correct: ""
    });
    renderParts();
  }

  function bindQuestionInputs() {
    document.querySelectorAll('.q-text-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const partIdx = e.target.getAttribute('data-part-idx');
        const qIdx = e.target.getAttribute('data-q-idx');
        partsData[partIdx].questions[qIdx].text = e.target.value;
      });
    });

    document.querySelectorAll('.q-opt-input').forEach(input => {
      input.addEventListener('input', () => {
        const partIdx = input.getAttribute('data-part-idx');
        const qIdx = input.getAttribute('data-q-idx');
        const optIdx = input.getAttribute('data-opt-idx');
        partsData[partIdx].questions[qIdx].options[optIdx] = input.value;

        // No llamamos a renderParts() completo para no perder focus, pero actualizamos los dropdowns de correcta dinámicamente si es necesario
        const correctSelect = document.querySelector(`.q-correct-select[data-part-idx="${partIdx}"][data-q-idx="${qIdx}"]`);
        if (correctSelect) {
          const currentVal = correctSelect.value;
          correctSelect.innerHTML = '<option value="">Selecciona la correcta...</option>';
          partsData[partIdx].questions[qIdx].options.forEach((opt, idx) => {
            const optLabel = opt || `Opción ${idx + 1}`;
            const selectedStr = currentVal === opt && opt ? 'selected' : '';
            correctSelect.innerHTML += `<option value="${opt}" ${selectedStr}>${optLabel}</option>`;
          });
        }
      });
    });

    document.querySelectorAll('.q-correct-select').forEach(select => {
      select.addEventListener('change', () => {
        const partIdx = select.getAttribute('data-part-idx');
        const qIdx = select.getAttribute('data-q-idx');
        partsData[partIdx].questions[qIdx].correct = select.value;
      });
    });

    document.querySelectorAll('.btn-delete-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const partIdx = btn.getAttribute('data-part-idx');
        const qIdx = btn.getAttribute('data-q-idx');
        partsData[partIdx].questions.splice(qIdx, 1);
        renderParts();
      });
    });
  }

  // Guardar Examen Técnico definitivo (Paso 3)
  btnSaveExam.addEventListener('click', async () => {
    const name = examNameInput.value.trim();
    const description = examDescInput.value.trim();

    if (partsData.length === 0) {
      showAlert("Agrega al menos una sección al examen.", true);
      return;
    }

    // Validaciones
    for (const part of partsData) {
      if (!part.title.trim()) {
        showAlert("Todas las secciones deben de tener nombre.", true);
        return;
      }
      if (part.questions.length === 0) {
        showAlert(`La sección "${part.title}" no contiene preguntas.`, true);
        return;
      }
      for (const q of part.questions) {
        if (!q.text.trim()) {
          showAlert(`La sección "${part.title}" tiene enunciados vacíos.`, true);
          return;
        }
        if (q.type === 'multiple') {
          if (q.options.some(o => !o.trim())) {
            showAlert(`La pregunta "${q.text}" tiene opciones vacías.`, true);
            return;
          }
          if (!q.correct) {
            showAlert(`Selecciona la opción correcta para la pregunta: "${q.text}"`, true);
            return;
          }
        }
        if (q.type === 'boolean' && !q.correct) {
          showAlert(`Selecciona Verdadero o Falso para la pregunta: "${q.text}"`, true);
          return;
        }
      }
    }

    try {
      const payload = {
        name,
        description,
        is_psychometric: false,
        parts: partsData
      };

      if (currentExamId) {
        // UPDATE
        const { error } = await supabaseClient
          .from('exams')
          .update(payload)
          .eq('id', currentExamId);

        if (error) throw error;
        showAlert("¡Examen técnico actualizado correctamente!");
      } else {
        // INSERT
        const { error } = await supabaseClient
          .from('exams')
          .insert([payload]);

        if (error) throw error;
        showAlert("¡Examen guardado correctamente!");
      }

      goToStep(1);
      loadExams();
    } catch (err) {
      console.error(err);
      showAlert("Error al guardar examen: " + err.message, true);
    }
  });

  // Inicializar
  await loadExams();
  goToStep(1);
});
