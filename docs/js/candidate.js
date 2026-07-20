// JS para el portal del candidato (candidate.js) con soporte para formulario dinámico
document.addEventListener('DOMContentLoaded', async () => {
  if (!supabaseClient) {
    console.error("No se detectó el cliente de Supabase.");
    return;
  }

  // Elementos DOM
  const stepSelectCandidate = document.getElementById('step-select-candidate');
  const stepInfoForm = document.getElementById('step-info-form');
  const stepPsychometric = document.getElementById('step-psychometric');
  const stepTechnical = document.getElementById('step-technical');
  const stepCompleted = document.getElementById('step-completed');

  const statusBar = document.getElementById('status-bar');
  const currentCandidateDisplay = document.getElementById('current-candidate-display');

  const selectCand = document.getElementById('select-cand');
  const noCandidatesAlert = document.getElementById('no-candidates-alert');
  const btnConfirmCand = document.getElementById('btn-confirm-cand');

  const candInfoForm = document.getElementById('cand-info-form');
  const dynamicFormFields = document.getElementById('dynamic-form-fields');

  const psyQuestionsContainer = document.getElementById('psy-questions-container');
  const psyProgressText = document.getElementById('psy-progress-text');
  const btnSubmitPsy = document.getElementById('btn-submit-psy');

  const techExamTitle = document.getElementById('tech-exam-title');
  const techExamDesc = document.getElementById('tech-exam-desc');
  const techQuestionsContainer = document.getElementById('tech-questions-container');
  const techProgressText = document.getElementById('tech-progress-text');
  const btnSubmitTech = document.getElementById('btn-submit-tech');

  const btnRestart = document.getElementById('btn-restart');

  // Estado Local del Candidato
  let activeCandidates = [];
  let selectedCandidate = null; // { id, name, assigned_exams: [...] }
  let psychometricExam = null;

  // Flujo multi-examen técnico
  let assignedTechnicalExamsList = []; // Arreglo de exámenes completos traídos de Supabase
  let currentTechnicalExamIndex = 0; // Índice en assignedTechnicalExamsList

  let dynamicFormStructure = []; // Campos cargados dinámicamente
  let candidateInfoAnswers = {}; // { fieldId: value }
  let psychometricAnswers = {};

  // Guardaremos las respuestas técnicas indexadas por el id del examen para soportar múltiples exámenes independientes
  // { [examId]: { [questionId]: answerValue } }
  let technicalAnswersByExam = {};

  function showStep(stepElement) {
    [stepSelectCandidate, stepInfoForm, stepPsychometric, stepTechnical, stepCompleted].forEach(step => {
      step.classList.add('hidden');
    });
    stepElement.classList.remove('hidden');
  }

  // ==========================================
  // PASO 1: CARGAR CANDIDATOS HABILITADOS
  // ==========================================
  async function loadActiveCandidates() {
    try {
      const { data, error } = await supabaseClient
        .from('candidates')
        .select('*')
        .eq('status', 'pending')
        .order('name', { ascending: true });

      if (error) throw error;
      activeCandidates = data || [];

      selectCand.innerHTML = '<option value="">-- Elige tu Nombre Completo --</option>';
      if (activeCandidates.length === 0) {
        selectCand.innerHTML = '<option value="">No hay aspirantes habilitados hoy</option>';
        noCandidatesAlert.classList.remove('hidden');
      } else {
        noCandidatesAlert.classList.add('hidden');
        activeCandidates.forEach(cand => {
          let examsLabel = "Sin exámenes asignados";
          if (cand.assigned_exams && Array.isArray(cand.assigned_exams) && cand.assigned_exams.length > 0) {
            examsLabel = cand.assigned_exams.map(e => e.name).join(', ');
          } else if (cand.assigned_exam_name) {
            examsLabel = cand.assigned_exam_name;
          }
          selectCand.innerHTML += `<option value="${cand.id}">${cand.name} (${examsLabel})</option>`;
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Confirmar Selección del Aspirante
  btnConfirmCand.addEventListener('click', async () => {
    const candId = selectCand.value;
    if (!candId) {
      alert("Por favor, selecciona tu nombre de la lista para iniciar.");
      return;
    }

    selectedCandidate = activeCandidates.find(c => c.id === candId);
    if (!selectedCandidate) return;

    currentCandidateDisplay.textContent = selectedCandidate.name;
    statusBar.classList.remove('hidden');

    // Cargar estructura de exámenes y formulario
    await loadRequiredResources();
    renderDynamicForm();

    showStep(stepInfoForm);
  });

  // Carga paralela de base de datos
  async function loadRequiredResources() {
    try {
      // 1. Asegurar examen psicométrico por defecto y cargarlo
      await ensureDefaultPsychometricExam();
      const { data: psyData } = await supabaseClient
        .from('exams')
        .select('*')
        .eq('is_psychometric', true)
        .limit(1);

      if (psyData && psyData.length > 0) {
        psychometricExam = psyData[0];
      }

      // 2. Obtener exámenes profesionales asignados (pueden ser múltiples)
      assignedTechnicalExamsList = [];
      const examIdsToFetch = [];

      if (selectedCandidate.assigned_exams && Array.isArray(selectedCandidate.assigned_exams)) {
        selectedCandidate.assigned_exams.forEach(e => {
          if (e.id) examIdsToFetch.push(e.id);
        });
      } else if (selectedCandidate.assigned_exam_id) {
        examIdsToFetch.push(selectedCandidate.assigned_exam_id);
      }

      if (examIdsToFetch.length > 0) {
        const { data: techData } = await supabaseClient
          .from('exams')
          .select('*')
          .in('id', examIdsToFetch);

        if (techData && techData.length > 0) {
          // Mantener el orden original que eligió el reclutador
          examIdsToFetch.forEach(id => {
            const match = techData.find(t => t.id === id);
            if (match) assignedTechnicalExamsList.push(match);
          });
        }
      }

      // 3. Obtener estructura del Formulario de Registro Dinámico
      await ensureDefaultRegistrationForm();
      const { data: formStructureData } = await supabaseClient
        .from('registration_forms')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      if (formStructureData && formStructureData.length > 0) {
        dynamicFormStructure = formStructureData[0].fields || [];
      } else {
        dynamicFormStructure = DEFAULT_REGISTRATION_FORM.fields;
      }

    } catch (err) {
      console.error(err);
    }
  }

  // Renderizar dinámicamente el Formulario de Registro
  function renderDynamicForm() {
    dynamicFormFields.innerHTML = "";
    if (dynamicFormStructure.length === 0) {
      dynamicFormFields.innerHTML = `<p class="col-span-2 text-center text-gray-400 text-xs">No se requieren datos para iniciar. Puedes continuar.</p>`;
      return;
    }

    dynamicFormStructure.forEach(field => {
      const isRequired = field.required ? 'required' : '';
      const reqMarker = field.required ? '<span class="text-rose-500 ml-0.5">*</span>' : '';
      let fieldWidget = "";

      if (field.type === 'select') {
        fieldWidget = `
          <select id="field_${field.id}" ${isRequired} class="cand-custom-input w-full px-4 py-3 rounded-2xl border border-blue-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
            <option value="">-- Elige una opción --</option>
            ${(field.options || []).map(opt => `<option value="${opt}">${opt}</option>`).join('')}
          </select>
        `;
      } else if (field.type === 'textarea') {
        fieldWidget = `
          <textarea id="field_${field.id}" rows="3" ${isRequired} class="cand-custom-input w-full px-4 py-3 rounded-2xl border border-blue-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 custom-scroll"></textarea>
        `;
      } else {
        fieldWidget = `
          <input type="${field.type}" id="field_${field.id}" ${isRequired} class="cand-custom-input w-full px-4 py-3 rounded-2xl border border-blue-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
        `;
      }

      // Columnas responsivas
      const colSpan = field.type === 'textarea' ? 'md:col-span-2' : '';

      dynamicFormFields.innerHTML += `
        <div class="${colSpan} space-y-1">
          <label class="block text-gray-600 text-sm font-semibold" for="field_${field.id}">
            ${field.label}${reqMarker}
          </label>
          ${fieldWidget}
        </div>
      `;
    });
  }

  // Guardar respuestas del Formulario de Registro
  candInfoForm.addEventListener('submit', (e) => {
    e.preventDefault();

    candidateInfoAnswers = {};
    dynamicFormStructure.forEach(field => {
      const el = document.getElementById(`field_${field.id}`);
      if (el) {
        candidateInfoAnswers[field.id] = el.value.trim();
      }
    });

    renderPsychometricExam();
    showStep(stepPsychometric);
  });

  // ==========================================
  // PASO 3: EXAMEN PSICOMÉTRICO GENERAL
  // ==========================================
  function renderPsychometricExam() {
    psyQuestionsContainer.innerHTML = "";
    if (!psychometricExam || !psychometricExam.parts || psychometricExam.parts.length === 0) {
      psyQuestionsContainer.innerHTML = `<div class="text-center py-8 text-gray-400 text-sm">No hay preguntas configuradas para este bloque. Haz clic en continuar.</div>`;
      psyProgressText.textContent = "0 / 0 Respondidas";
      return;
    }

    let qCount = 0;
    psychometricAnswers = {};

    psychometricExam.parts.forEach(part => {
      let partHtml = `
        <div class="bg-blue-50/30 p-5 rounded-2xl border border-blue-100 shadow-sm space-y-4">
          <h3 class="text-sm font-bold text-blue-700 flex items-center gap-1.5 border-b border-blue-100 pb-2">
            <i class="fa-solid fa-folder text-blue-400"></i> ${part.title}
          </h3>
          <div class="space-y-4">
      `;

      part.questions.forEach(q => {
        qCount++;
        let widget = "";

        if (q.type === 'multiple') {
          widget = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              ${q.options.map(opt => `
                <label class="flex items-center gap-2 p-2.5 rounded-xl border border-blue-50 bg-white hover:bg-blue-50/50 cursor-pointer transition text-xs font-semibold text-gray-700">
                  <input type="radio" name="psy_q_${q.id}" value="${opt}" class="psy-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                  <span>${opt}</span>
                </label>
              `).join('')}
            </div>
          `;
        } else if (q.type === 'boolean') {
          widget = `
            <div class="grid grid-cols-2 gap-3 mt-2 max-w-xs">
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-blue-50 bg-white hover:bg-blue-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="psy_q_${q.id}" value="Verdadero" class="psy-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                Verdadero
              </label>
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-blue-50 bg-white hover:bg-blue-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="psy_q_${q.id}" value="Falso" class="psy-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                Falso
              </label>
            </div>
          `;
        } else if (q.type === 'short') {
          widget = `
            <textarea rows="2" class="psy-textarea-input w-full mt-2 px-3 py-2 rounded-xl border border-blue-100 text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none" data-q-id="${q.id}"></textarea>
          `;
        }

        partHtml += `
          <div class="space-y-1">
            <span class="text-xs font-bold text-gray-700 block">Pregunta: ${q.text}</span>
            ${widget}
          </div>
        `;
      });

      partHtml += `
          </div>
        </div>
      `;
      psyQuestionsContainer.innerHTML += partHtml;
    });

    updateProgress(psyProgressText, 0, qCount);

    // Binds
    document.querySelectorAll('.psy-radio-input').forEach(radio => {
      radio.addEventListener('change', () => {
        const qId = radio.getAttribute('data-q-id');
        psychometricAnswers[qId] = radio.value;
        const total = countAnswers(psychometricAnswers, '.psy-textarea-input');
        updateProgress(psyProgressText, total, qCount);
      });
    });

    document.querySelectorAll('.psy-textarea-input').forEach(ta => {
      ta.addEventListener('input', () => {
        const qId = ta.getAttribute('data-q-id');
        const val = ta.value.trim();
        if (val) {
          psychometricAnswers[qId] = val;
        } else {
          delete psychometricAnswers[qId];
        }
        const total = countAnswers(psychometricAnswers, '.psy-textarea-input');
        updateProgress(psyProgressText, total, qCount);
      });
    });
  }

  function countAnswers(ansObj, taSelector) {
    return Object.keys(ansObj).length;
  }

  function updateProgress(element, answered, total) {
    element.textContent = `${answered} / ${total} Respondidas`;
  }

  // Enviar psicométrico
  btnSubmitPsy.addEventListener('click', () => {
    let totalQuestions = 0;
    if (psychometricExam && psychometricExam.parts) {
      psychometricExam.parts.forEach(p => totalQuestions += p.questions.length);
    }

    if (Object.keys(psychometricAnswers).length < totalQuestions) {
      showPastelAlert("Por favor, responde todo el examen psicométrico para poder avanzar.");
      return;
    }

    if (assignedTechnicalExamsList.length > 0) {
      currentTechnicalExamIndex = 0;
      renderTechnicalExam();
      showStep(stepTechnical);
    } else {
      saveAndFinish();
    }
  });


  // ==========================================
  // PASO 4: EXAMEN TÉCNICO / PROFESIONAL (SOPORTE MULTI-EXAMEN SEQUENCIAL)
  // ==========================================
  function renderTechnicalExam() {
    const exam = assignedTechnicalExamsList[currentTechnicalExamIndex];
    if (!exam) return;

    // Actualizar tags de encabezado
    const techHeaderTag = document.getElementById('tech-header-tag');
    if (techHeaderTag) {
      techHeaderTag.textContent = `Examen Técnico ${currentTechnicalExamIndex + 1} de ${assignedTechnicalExamsList.length}`;
    }

    techExamTitle.innerHTML = `<i class="fa-solid fa-award mr-2 text-blue-400"></i>Examen Profesional: <span class="text-blue-600 font-extrabold">${exam.name}</span>`;
    techExamDesc.textContent = exam.description || "Evaluación práctica de profesión.";

    // Inicializar respuestas para este examen si no existen
    if (!technicalAnswersByExam[exam.id]) {
      technicalAnswersByExam[exam.id] = {};
    }
    const currentAnswers = technicalAnswersByExam[exam.id];

    techQuestionsContainer.innerHTML = "";
    if (!exam.parts || exam.parts.length === 0) {
      techQuestionsContainer.innerHTML = `<div class="text-center py-8 text-gray-400 text-sm">Este examen no contiene preguntas aún. Puedes finalizar el proceso.</div>`;
      techProgressText.textContent = "0 / 0 Respondidas";
      return;
    }

    let qCount = 0;

    exam.parts.forEach(part => {
      let partHtml = `
        <div class="bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100/50 shadow-sm space-y-4">
          <h3 class="text-sm font-bold text-indigo-700 flex items-center gap-1.5 border-b border-indigo-100 pb-2">
            <i class="fa-solid fa-folder text-indigo-400"></i> ${part.title}
          </h3>
          <div class="space-y-4">
      `;

      part.questions.forEach(q => {
        qCount++;
        let widget = "";
        const savedVal = currentAnswers[q.id] || "";

        if (q.type === 'multiple') {
          widget = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              ${q.options.map(opt => {
                const checked = savedVal === opt ? 'checked' : '';
                return `
                  <label class="flex items-center gap-2 p-2.5 rounded-xl border border-blue-50 bg-white hover:bg-blue-50/50 cursor-pointer transition text-xs font-semibold text-gray-700">
                    <input type="radio" name="tech_q_${q.id}" value="${opt}" ${checked} class="tech-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                    <span>${opt}</span>
                  </label>
                `;
              }).join('')}
            </div>
          `;
        } else if (q.type === 'boolean') {
          widget = `
            <div class="grid grid-cols-2 gap-3 mt-2 max-w-xs">
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-indigo-50 bg-white hover:bg-indigo-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="tech_q_${q.id}" value="Verdadero" ${savedVal === 'Verdadero' ? 'checked' : ''} class="tech-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                Verdadero
              </label>
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-indigo-50 bg-white hover:bg-indigo-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="tech_q_${q.id}" value="Falso" ${savedVal === 'Falso' ? 'checked' : ''} class="tech-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                Falso
              </label>
            </div>
          `;
        } else if (q.type === 'short') {
          widget = `
            <textarea rows="3" class="tech-textarea-input w-full mt-2 px-3 py-2 rounded-xl border border-indigo-100 text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none" data-q-id="${q.id}">${savedVal}</textarea>
          `;
        } else if (q.type === 'canvas') {
          widget = `
            <div class="illustrator-container mt-3 bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col gap-4 text-white relative select-none overflow-hidden" data-q-id="${q.id}">

              <!-- Header Bar (Timer and Info) -->
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                  <span class="text-xs font-bold text-rose-400 uppercase tracking-widest animate-pulse" id="canvas-timer-${q.id}">Tiempo Restante: 30:00</span>
                </div>
                <div class="text-[10px] text-slate-400 flex items-center gap-2">
                  <span class="bg-purple-950/80 px-2 py-0.5 rounded text-purple-300 font-extrabold uppercase text-[9px] border border-purple-800">Lienzo A4 (Illustrator Mode)</span>
                  <span class="hidden md:inline">Atajos: <strong class="text-purple-300">Ctrl+Z</strong> (Deshacer) &bull; <strong class="text-purple-300">Ctrl+C/V</strong> (Duplicar) &bull; <strong class="text-purple-300">Espacio+Arrastrar</strong></span>
                </div>
              </div>

              <!-- Main Workspace Grid -->
              <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 relative">

                <!-- Left Toolbar -->
                <div class="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
                  <!-- Tool selectors -->
                  <div class="space-y-3">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Herramientas</span>
                    <div class="grid grid-cols-2 gap-2">
                      <button type="button" id="tool-select-${q.id}" class="canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 active bg-purple-600 text-white" data-tool="select" data-q-id="${q.id}">
                        <i class="fa-solid fa-arrow-pointer"></i>
                        <span class="text-[9px]">Puntero</span>
                      </button>
                      <button type="button" id="tool-draw-${q.id}" class="canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 bg-slate-900 text-slate-400 hover:bg-slate-800" data-tool="draw" data-q-id="${q.id}">
                        <i class="fa-solid fa-pencil"></i>
                        <span class="text-[9px]">Lápiz</span>
                      </button>
                      <button type="button" id="tool-rect-${q.id}" class="canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 bg-slate-900 text-slate-400 hover:bg-slate-800" data-tool="rect" data-q-id="${q.id}">
                        <i class="fa-regular fa-square"></i>
                        <span class="text-[9px]">Rectángulo</span>
                      </button>
                      <button type="button" id="tool-circle-${q.id}" class="canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 bg-slate-900 text-slate-400 hover:bg-slate-800" data-tool="circle" data-q-id="${q.id}">
                        <i class="fa-regular fa-circle"></i>
                        <span class="text-[9px]">Círculo</span>
                      </button>
                    </div>

                    <!-- Line Width -->
                    <div class="space-y-1">
                      <label class="text-[9px] text-slate-400 font-bold block uppercase">Grosor de Trazo</label>
                      <input type="range" id="brush-size-${q.id}" min="1" max="40" value="5" class="w-full accent-purple-500">
                    </div>

                    <!-- Add Text tool -->
                    <div class="space-y-1 pt-1 border-t border-slate-800/60">
                      <label class="text-[9px] text-slate-400 font-bold block uppercase">Añadir Texto al Lienzo</label>
                      <div class="flex gap-1.5">
                        <input type="text" id="text-input-${q.id}" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none" placeholder="Escribe aquí..." value="Hola Mundo">
                        <button type="button" id="btn-add-text-${q.id}" class="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-bold" data-q-id="${q.id}"><i class="fa-solid fa-plus"></i></button>
                      </div>
                    </div>
                  </div>

                  <!-- Actions / Clear -->
                  <div class="space-y-2 pt-2 border-t border-slate-800/60">
                    <button type="button" id="btn-undo-${q.id}" class="w-full py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-300 transition flex items-center justify-center gap-1.5" data-q-id="${q.id}">
                      <i class="fa-solid fa-rotate-left"></i> Deshacer (Ctrl+Z)
                    </button>
                    <button type="button" id="btn-clear-${q.id}" class="w-full py-1.5 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-900/40 text-rose-300 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1.5" data-q-id="${q.id}">
                      <i class="fa-regular fa-trash-can"></i> Limpiar Lienzo
                    </button>
                  </div>
                </div>

                <!-- Center Canvas Area (A4 Sheet layout) -->
                <div class="lg:col-span-2 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden relative" style="height: 480px;" id="canvas-container-${q.id}">
                  <!-- Scaled A4 workspace board -->
                  <div id="a4-board-${q.id}" class="bg-white relative shadow-2xl origin-center" style="width: 310px; height: 438px; transform: scale(1); min-width: 310px; min-height: 438px;">
                    <canvas id="canvas-element-${q.id}" width="310" height="438" class="absolute inset-0 z-10 block cursor-crosshair"></canvas>
                  </div>

                  <!-- Floating zoom indicator -->
                  <div class="absolute bottom-3 right-3 bg-slate-900/90 border border-slate-800 text-[10px] px-2 py-1 rounded-lg text-slate-300 pointer-events-none font-bold z-20">
                    Zoom: <span id="zoom-label-${q.id}">100%</span>
                  </div>
                </div>

                <!-- Right Assets & Color Panel -->
                <div class="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-col space-y-4">

                  <!-- Color Palette -->
                  <div class="space-y-2">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Paleta de Colores</span>
                    <div class="grid grid-cols-6 gap-1.5" id="color-palette-${q.id}">
                      <!-- Populated dynamically -->
                    </div>
                    <div class="flex items-center justify-between pt-1.5 border-t border-slate-800/60">
                      <span class="text-[9px] text-slate-400 font-bold uppercase">Personalizado</span>
                      <input type="color" id="color-picker-${q.id}" value="#a855f7" class="w-6 h-6 rounded-lg bg-transparent border-none cursor-pointer">
                    </div>
                  </div>

                  <!-- Assets Drawer -->
                  <div class="flex-1 flex flex-col min-h-0 space-y-1.5">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block shrink-0">Biblioteca de Assets (Ilustraciones)</span>
                    <div class="flex-1 overflow-y-auto custom-scroll pr-1 space-y-1.5" id="assets-drawer-${q.id}">
                      <!-- Populated with click-to-add items -->
                    </div>
                  </div>

                </div>

              </div>

            </div>
          `;
        }

        partHtml += `
          <div class="space-y-1">
            <span class="text-xs font-bold text-gray-700 block">Pregunta: ${q.text}</span>
            ${widget}
          </div>
        `;
      });

      partHtml += `
          </div>
        </div>
      `;
      techQuestionsContainer.innerHTML += partHtml;
    });

    const answeredCount = Object.keys(currentAnswers).length;
    updateProgress(techProgressText, answeredCount, qCount);

    // Activar los canvas interactivos tipo Illustrator renders
    exam.parts.forEach(part => {
      part.questions.forEach(q => {
        if (q.type === 'canvas') {
          initIllustratorCanvas(q.id, exam.id);
        }
      });
    });

    // Actualizar texto del botón según si hay más exámenes después
    if (currentTechnicalExamIndex < assignedTechnicalExamsList.length - 1) {
      btnSubmitTech.innerHTML = `Siguiente Examen (${currentTechnicalExamIndex + 2}/${assignedTechnicalExamsList.length}) <i class="fa-solid fa-chevron-right ml-1"></i>`;
    } else {
      btnSubmitTech.innerHTML = `Finalizar Todo el Proceso <i class="fa-solid fa-circle-check ml-1"></i>`;
    }

    // Binds
    document.querySelectorAll('.tech-radio-input').forEach(radio => {
      radio.addEventListener('change', () => {
        const qId = radio.getAttribute('data-q-id');
        currentAnswers[qId] = radio.value;
        const total = Object.keys(currentAnswers).length;
        updateProgress(techProgressText, total, qCount);
      });
    });

    document.querySelectorAll('.tech-textarea-input').forEach(ta => {
      ta.addEventListener('input', () => {
        const qId = ta.getAttribute('data-q-id');
        const val = ta.value.trim();
        if (val) {
          currentAnswers[qId] = val;
        } else {
          delete currentAnswers[qId];
        }
        const total = Object.keys(currentAnswers).length;
        updateProgress(techProgressText, total, qCount);
      });
    });
  }

  btnSubmitTech.addEventListener('click', () => {
    const exam = assignedTechnicalExamsList[currentTechnicalExamIndex];
    if (!exam) return;

    let totalQuestions = 0;
    if (exam.parts) {
      exam.parts.forEach(p => totalQuestions += p.questions.length);
    }

    const currentAnswers = technicalAnswersByExam[exam.id] || {};
    if (Object.keys(currentAnswers).length < totalQuestions) {
      showPastelAlert("Por favor, responde todas las preguntas de este examen técnico para poder avanzar.");
      return;
    }

    // Si hay más exámenes técnicos en la lista, pasar al siguiente
    if (currentTechnicalExamIndex < assignedTechnicalExamsList.length - 1) {
      showPastelConfirm("¿Deseas guardar tus respuestas de este examen y continuar al siguiente?", (accepted) => {
        if (accepted) {
          currentTechnicalExamIndex++;
          renderTechnicalExam();
          techQuestionsContainer.scrollTop = 0;
        }
      }, "Siguiente Examen");
    } else {
      showPastelConfirm("¿Estás seguro de enviar tus respuestas y finalizar todo el proceso?", (accepted) => {
        if (accepted) {
          saveAndFinish();
        }
      }, "Finalizar Evaluación");
    }
  });


  // ==========================================
  // GUARDAR EN SUPABASE
  // ==========================================
  async function saveAndFinish() {
    try {
      // Si el candidato hizo múltiples exámenes, guardaremos un registro consolidado de resultados
      // donde 'technical_answers' unifica las respuestas de todos los exámenes, y guardaremos el score acumulado.
      let consolidatedScore = 0;
      let consolidatedMaxScore = 0;
      let consolidatedExamNames = [];

      // Estructuraremos un JSON unificado para 'technical_answers' con las partes de todos los exámenes realizados
      const consolidatedTechnical = {
        name: assignedTechnicalExamsList.map(e => e.name).join(' + '),
        parts: []
      };

      assignedTechnicalExamsList.forEach(exam => {
        consolidatedExamNames.push(exam.name);
        const examAnswers = technicalAnswersByExam[exam.id] || {};

        // Copiar las secciones y añadir las respuestas del usuario
        const partsCopy = JSON.parse(JSON.stringify(exam.parts || []));
        partsCopy.forEach(part => {
          // Diferenciar el título de la sección por el nombre del examen para mayor claridad en perfiles
          part.title = `${exam.name} - ${part.title}`;
          part.questions.forEach(q => {
            q.userAnswer = examAnswers[q.id] || "";
            if (q.type !== 'short') {
              consolidatedMaxScore++;
              if (q.userAnswer === q.correct) {
                consolidatedScore++;
              }
            }
          });
        });

        consolidatedTechnical.parts = consolidatedTechnical.parts.concat(partsCopy);
      });

      // Estructurar psicométrico
      const structuredPsychometric = {
        name: psychometricExam ? psychometricExam.name : "N/A",
        parts: psychometricExam ? JSON.parse(JSON.stringify(psychometricExam.parts)) : []
      };

      structuredPsychometric.parts.forEach(p => {
        p.questions.forEach(q => {
          q.userAnswer = psychometricAnswers[q.id] || "";
        });
      });

      // Extraer campos clave para el registro histórico
      const candidateEmail = candidateInfoAnswers['email'] || "";
      const candidatePhone = candidateInfoAnswers['phone'] || "";
      const positionLabel = consolidatedExamNames.length > 0 ? consolidatedExamNames.join(', ') : "Evaluación General";

      // Guardar en results
      const { error: insertError } = await supabaseClient
        .from('results')
        .insert([{
          candidate_name: selectedCandidate.name,
          candidate_email: candidateEmail,
          candidate_phone: candidatePhone,
          candidate_info: candidateInfoAnswers,
          position: positionLabel,
          psychometric_answers: structuredPsychometric,
          technical_answers: consolidatedTechnical,
          assigned_exam_name: positionLabel,
          score: consolidatedScore,
          max_score: consolidatedMaxScore
        }]);

      if (insertError) throw insertError;

      // Actualizar a completado para sacarlo de la cola activa
      const { error: updateError } = await supabaseClient
        .from('candidates')
        .update({ status: 'completed' })
        .eq('id', selectedCandidate.id);

      if (updateError) throw updateError;

      statusBar.classList.add('hidden');
      showStep(stepCompleted);

    } catch (err) {
      console.error(err);
      showPastelAlert("Error al finalizar la evaluación: " + err.message);
    }
  }

  btnRestart.addEventListener('click', () => {
    candInfoForm.reset();
    psyQuestionsContainer.innerHTML = "";
    techQuestionsContainer.innerHTML = "";
    selectedCandidate = null;
    candidateInfoAnswers = {};
    psychometricAnswers = {};
    technicalAnswersByExam = {};
    assignedTechnicalExamsList = [];
    currentTechnicalExamIndex = 0;
    loadActiveCandidates();
    showStep(stepSelectCandidate);
  });

  // ==========================================
  // ADOBE ILLUSTRATOR MODE (CUSTOM CANVAS LOGIC)
  // ==========================================
  function initIllustratorCanvas(qId, examId) {
    const canvas = document.getElementById(`canvas-element-${qId}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = document.getElementById(`canvas-container-${qId}`);
    const board = document.getElementById(`a4-board-${qId}`);
    const zoomLabel = document.getElementById(`zoom-label-${qId}`);
    const brushSizeInput = document.getElementById(`brush-size-${qId}`);
    const colorPicker = document.getElementById(`color-picker-${qId}`);
    const textInput = document.getElementById(`text-input-${qId}`);
    const addTextBtn = document.getElementById(`btn-add-text-${qId}`);
    const undoBtn = document.getElementById(`btn-undo-${qId}`);
    const clearBtn = document.getElementById(`btn-clear-${qId}`);
    const timerLabel = document.getElementById(`canvas-timer-${qId}`);

    let layers = [];
    let undoHistory = [];
    let currentTool = 'select'; // select, draw, rect, circle
    let brushSize = 5;
    let strokeColor = '#a855f7';
    let selectedObject = null;
    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let currentStrokePoints = [];
    let zoomScale = 1.0;

    // Inicializar respuestas para este examen
    if (!technicalAnswersByExam[examId]) {
      technicalAnswersByExam[examId] = {};
    }

    // Configurar temporizador (30 Minutos)
    let timeRemainingSeconds = 30 * 60;
    const timerInterval = setInterval(() => {
      if (document.getElementById(`canvas-timer-${qId}`) === null) {
        clearInterval(timerInterval);
        return;
      }
      if (timeRemainingSeconds <= 0) {
        clearInterval(timerInterval);
        saveCanvasToAnswers();
        showPastelAlert("¡El tiempo límite de 30 minutos para tu examen ha concluido! Tus respuestas del lienzo se han guardado automáticamente.", "Tiempo Agotado");
        return;
      }
      timeRemainingSeconds--;
      const min = String(Math.floor(timeRemainingSeconds / 60)).padStart(2, '0');
      const sec = String(timeRemainingSeconds % 60).padStart(2, '0');
      timerLabel.textContent = `Tiempo Restante: ${min}:${sec}`;
    }, 1000);

    // Paleta de Colores Pastel & Estándar
    const colors = [
      '#000000', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#10b981',
      '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'
    ];
    const paletteContainer = document.getElementById(`color-palette-${qId}`);
    if (paletteContainer) {
      paletteContainer.innerHTML = '';
      colors.forEach(color => {
        const borderStyle = color === '#ffffff' ? 'border-gray-300' : 'border-transparent';
        paletteContainer.innerHTML += `
          <button type="button" class="w-5 h-5 rounded-full border ${borderStyle} transition transform hover:scale-115 active:scale-95" style="background-color: ${color};" data-color="${color}"></button>
        `;
      });
      // Click handlers para la paleta
      paletteContainer.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          strokeColor = btn.getAttribute('data-color');
          if (colorPicker) colorPicker.value = strokeColor;
          updateSelectedObjectStyle();
        });
      });
    }

    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        strokeColor = e.target.value;
        updateSelectedObjectStyle();
      });
    }

    if (brushSizeInput) {
      brushSizeInput.addEventListener('input', (e) => {
        brushSize = parseInt(e.target.value);
        updateSelectedObjectStyle();
      });
    }

    function updateSelectedObjectStyle() {
      if (selectedObject && currentTool === 'select') {
        if (selectedObject.type === 'rect' || selectedObject.type === 'circle' || selectedObject.type === 'text') {
          selectedObject.color = strokeColor;
        }
        if (selectedObject.type === 'rect' || selectedObject.type === 'circle') {
          selectedObject.width = brushSize;
        }
        saveCanvasState();
        drawWorkspace();
      }
    }

    // Biblioteca de 10 Assets
    const assets = [
      { name: "👑 Corona Real", type: "emoji", value: "👑" },
      { name: "⚡ Rayo", type: "emoji", value: "⚡" },
      { name: "⭐ Estrella Dorada", type: "emoji", value: "⭐" },
      { name: "💡 Idea Genial", type: "emoji", value: "💡" },
      { name: "🔥 Fuego Intenso", type: "emoji", value: "🔥" },
      { name: "🛡️ Escudo de Éxito", type: "emoji", value: "🛡️" },
      { name: "📢 Megáfono Oferta", type: "emoji", value: "📢" },
      { name: "🎯 Tiro al Blanco", type: "emoji", value: "🎯" },
      { name: "🚀 Cohete Alza", type: "emoji", value: "🚀" },
      { name: "🍀 Trébol Suerte", type: "emoji", value: "🍀" }
    ];
    const assetsContainer = document.getElementById(`assets-drawer-${qId}`);
    if (assetsContainer) {
      assetsContainer.innerHTML = '';
      assets.forEach((asset, idx) => {
        assetsContainer.innerHTML += `
          <button type="button" class="w-full text-left p-1.5 bg-slate-900 hover:bg-purple-900/40 rounded-xl transition text-[11px] font-bold text-slate-300 flex items-center gap-2 border border-slate-800 hover:border-purple-800" data-asset-idx="${idx}">
            <span class="text-base">${asset.value}</span>
            <span>${asset.name}</span>
          </button>
        `;
      });
      assetsContainer.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-asset-idx'));
          const asset = assets[idx];
          addAssetToCanvas(asset);
        });
      });
    }

    function addAssetToCanvas(asset) {
      const newObj = {
        id: "layer_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        type: 'text',
        text: asset.value,
        fontSize: 50,
        x: 130,
        y: 200,
        color: '#000000'
      };
      saveStateToUndo();
      layers.push(newObj);
      selectedObject = newObj;
      currentTool = 'select';
      updateToolUI();
      drawWorkspace();
      saveCanvasToAnswers();
    }

    // Cambiar Herramientas
    document.querySelectorAll(`.canvas-tool-btn[data-q-id="${qId}"]`).forEach(btn => {
      btn.addEventListener('click', () => {
        // Remover clases activas de todas las del grupo de esta pregunta
        document.querySelectorAll(`.canvas-tool-btn[data-q-id="${qId}"]`).forEach(b => {
          b.className = "canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 bg-slate-900 text-slate-400 hover:bg-slate-800";
        });
        btn.className = "canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 active bg-purple-600 text-white";
        currentTool = btn.getAttribute('data-tool');
        if (currentTool !== 'select') {
          selectedObject = null;
        }
        drawWorkspace();
      });
    });

    function updateToolUI() {
      document.querySelectorAll(`.canvas-tool-btn[data-q-id="${qId}"]`).forEach(b => {
        const t = b.getAttribute('data-tool');
        if (t === currentTool) {
          b.className = "canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 active bg-purple-600 text-white";
        } else {
          b.className = "canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 bg-slate-900 text-slate-400 hover:bg-slate-800";
        }
      });
    }

    // Añadir texto
    if (addTextBtn) {
      addTextBtn.addEventListener('click', () => {
        const val = textInput.value.trim();
        if (!val) return;
        saveStateToUndo();
        const newObj = {
          id: "layer_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
          type: 'text',
          text: val,
          fontSize: 24,
          x: 50,
          y: 200,
          color: strokeColor
        };
        layers.push(newObj);
        selectedObject = newObj;
        currentTool = 'select';
        updateToolUI();
        drawWorkspace();
        saveCanvasToAnswers();
      });
    }

    // Deshacer / Limpiar
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        if (undoHistory.length > 0) {
          layers = undoHistory.pop();
          selectedObject = null;
          drawWorkspace();
          saveCanvasToAnswers();
        } else {
          showPastelAlert("No hay más acciones para deshacer.", "Lienzo");
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        showPastelConfirm("¿Deseas vaciar completamente el lienzo de dibujo?", (accepted) => {
          if (accepted) {
            saveStateToUndo();
            layers = [];
            selectedObject = null;
            drawWorkspace();
            saveCanvasToAnswers();
          }
        }, "Limpiar Lienzo");
      });
    }

    function saveStateToUndo() {
      // Guardar clon en historial de deshacer
      undoHistory.push(JSON.parse(JSON.stringify(layers)));
      if (undoHistory.length > 15) {
        undoHistory.shift();
      }
    }

    function saveCanvasState() {
      saveCanvasToAnswers();
    }

    function saveCanvasToAnswers() {
      technicalAnswersByExam[examId][qId] = canvas.toDataURL('image/png');
      const total = Object.keys(technicalAnswersByExam[examId]).length;
      const qCount = assignedTechnicalExamsList[currentTechnicalExamIndex].parts.reduce((acc, p) => acc + p.questions.length, 0);
      updateProgress(techProgressText, total, qCount);
    }

    // Soporte para Zoom con Rueda del Mouse + Tecla Espacio
    let isSpacePressed = false;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        isSpacePressed = true;
        container.style.cursor = 'grab';
        e.preventDefault();
      }
      // Ctrl + Z
      if (e.ctrlKey && e.code === 'KeyZ') {
        if (undoHistory.length > 0) {
          layers = undoHistory.pop();
          selectedObject = null;
          drawWorkspace();
          saveCanvasToAnswers();
        }
        e.preventDefault();
      }
      // Suprimir o Borrar elemento seleccionado
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedObject && document.activeElement.tagName !== 'INPUT') {
        saveStateToUndo();
        layers = layers.filter(l => l.id !== selectedObject.id);
        selectedObject = null;
        drawWorkspace();
        saveCanvasToAnswers();
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        isSpacePressed = false;
        container.style.cursor = 'default';
      }
    });

    // Control de zoom por rueda
    container.addEventListener('wheel', (e) => {
      if (isSpacePressed || e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        zoomScale = Math.min(Math.max(zoomScale + delta, 0.5), 2.5);
        board.style.transform = `scale(${zoomScale})`;
        zoomLabel.textContent = `${Math.round(zoomScale * 100)}%`;
      }
    }, { passive: false });

    // Dibujado del Workspace
    function drawWorkspace() {
      // Limpiar lienzo
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Dibujar cuadrícula tenue para dar aspecto de diseño profesional
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      const gridSize = 20;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Dibujar cada objeto/capa
      layers.forEach(layer => {
        if (layer.type === 'stroke') {
          if (layer.points.length < 2) return;
          ctx.beginPath();
          ctx.strokeStyle = layer.color;
          ctx.lineWidth = layer.width;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.moveTo(layer.points[0].x, layer.points[0].y);
          for (let i = 1; i < layer.points.length; i++) {
            ctx.lineTo(layer.points[i].x, layer.points[i].y);
          }
          ctx.stroke();
        } else if (layer.type === 'rect') {
          ctx.beginPath();
          ctx.strokeStyle = layer.color;
          ctx.lineWidth = layer.width;
          ctx.strokeRect(layer.x, layer.y, layer.w, layer.h);
        } else if (layer.type === 'circle') {
          ctx.beginPath();
          ctx.strokeStyle = layer.color;
          ctx.lineWidth = layer.width;
          ctx.arc(layer.x, layer.y, layer.r, 0, Math.PI * 2);
          ctx.stroke();
        } else if (layer.type === 'text') {
          ctx.fillStyle = layer.color;
          ctx.font = `bold ${layer.fontSize}px 'Quicksand', sans-serif`;
          ctx.textBaseline = 'top';
          ctx.fillText(layer.text, layer.x, layer.y);
        }
      });

      // Dibujar caja de selección si estamos en herramienta select
      if (currentTool === 'select' && selectedObject) {
        ctx.save();
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);

        let bx = 0, by = 0, bw = 0, bh = 0;
        if (selectedObject.type === 'stroke') {
          // Obtener límites del stroke
          const xs = selectedObject.points.map(p => p.x);
          const ys = selectedObject.points.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          bx = minX - 4;
          by = minY - 4;
          bw = (maxX - minX) + 8;
          bh = (maxY - minY) + 8;
        } else if (selectedObject.type === 'rect') {
          bx = selectedObject.x - 4;
          by = selectedObject.y - 4;
          bw = selectedObject.w + 8;
          bh = selectedObject.h + 8;
        } else if (selectedObject.type === 'circle') {
          bx = selectedObject.x - selectedObject.r - 4;
          by = selectedObject.y - selectedObject.r - 4;
          bw = (selectedObject.r * 2) + 8;
          bh = (selectedObject.r * 2) + 8;
        } else if (selectedObject.type === 'text') {
          ctx.font = `bold ${selectedObject.fontSize}px 'Quicksand', sans-serif`;
          const textMetrics = ctx.measureText(selectedObject.text);
          bx = selectedObject.x - 4;
          by = selectedObject.y - 2;
          bw = textMetrics.width + 8;
          bh = selectedObject.fontSize + 4;
        }

        ctx.strokeRect(bx, by, bw, bh);

        // Esquinas de selección
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(bx - 3, by - 3, 6, 6);
        ctx.fillRect(bx + bw - 3, by - 3, 6, 6);
        ctx.fillRect(bx - 3, by + bh - 3, 6, 6);
        ctx.fillRect(bx + bw - 3, by + bh - 3, 6, 6);

        ctx.restore();
      }
    }

    // Obtener coordenadas de mouse relativas a la hoja A4
    function getMouseCoords(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
      };
    }

    // Eventos de Mouse en el lienzo
    canvas.addEventListener('mousedown', (e) => {
      const coords = getMouseCoords(e);
      startX = coords.x;
      startY = coords.y;

      if (currentTool === 'draw') {
        isDrawing = true;
        saveStateToUndo();
        currentStrokePoints = [{ x: startX, y: startY }];
        layers.push({
          id: "layer_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
          type: 'stroke',
          color: strokeColor,
          width: brushSize,
          points: currentStrokePoints
        });
      } else if (currentTool === 'rect') {
        isDrawing = true;
        saveStateToUndo();
        layers.push({
          id: "layer_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
          type: 'rect',
          color: strokeColor,
          width: brushSize,
          x: startX,
          y: startY,
          w: 1,
          h: 1
        });
      } else if (currentTool === 'circle') {
        isDrawing = true;
        saveStateToUndo();
        layers.push({
          id: "layer_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
          type: 'circle',
          color: strokeColor,
          width: brushSize,
          x: startX,
          y: startY,
          r: 1
        });
      } else if (currentTool === 'select') {
        // Encontrar colisión de abajo hacia arriba (último pintado)
        let found = null;
        for (let i = layers.length - 1; i >= 0; i--) {
          const l = layers[i];
          if (l.type === 'rect') {
            if (startX >= l.x && startX <= l.x + l.w && startY >= l.y && startY <= l.y + l.h) {
              found = l;
              break;
            }
          } else if (l.type === 'circle') {
            const dist = Math.sqrt((startX - l.x)**2 + (startY - l.y)**2);
            if (dist <= l.r + 4) {
              found = l;
              break;
            }
          } else if (l.type === 'text') {
            ctx.font = `bold ${l.fontSize}px 'Quicksand', sans-serif`;
            const textMetrics = ctx.measureText(l.text);
            if (startX >= l.x && startX <= l.x + textMetrics.width && startY >= l.y && startY <= l.y + l.fontSize) {
              found = l;
              break;
            }
          } else if (l.type === 'stroke') {
            // Distancia mínima a cualquier punto del trazo
            for (let p of l.points) {
              const d = Math.sqrt((startX - p.x)**2 + (startY - p.y)**2);
              if (d <= l.width + 5) {
                found = l;
                break;
              }
            }
            if (found) break;
          }
        }

        if (found) {
          selectedObject = found;
          // Guardar offset de arrastre inicial
          selectedObject.offsetX = startX - selectedObject.x;
          selectedObject.offsetY = startY - selectedObject.y;
          if (selectedObject.type === 'stroke') {
            selectedObject.startPoints = JSON.parse(JSON.stringify(selectedObject.points));
          }
          isDrawing = true;
        } else {
          selectedObject = null;
        }
        drawWorkspace();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const coords = getMouseCoords(e);
      currentX = coords.x;
      currentY = coords.y;

      const activeLayer = layers[layers.length - 1];

      if (currentTool === 'draw') {
        activeLayer.points.push({ x: currentX, y: currentY });
        drawWorkspace();
      } else if (currentTool === 'rect') {
        activeLayer.w = currentX - startX;
        activeLayer.h = currentY - startY;
        drawWorkspace();
      } else if (currentTool === 'circle') {
        const radius = Math.sqrt((currentX - startX)**2 + (currentY - startY)**2);
        activeLayer.r = radius;
        drawWorkspace();
      } else if (currentTool === 'select' && selectedObject) {
        if (selectedObject.type === 'stroke') {
          const dx = currentX - startX;
          const dy = currentY - startY;
          selectedObject.points = selectedObject.startPoints.map(p => ({
            x: p.x + dx,
            y: p.y + dy
          }));
        } else {
          selectedObject.x = currentX - selectedObject.offsetX;
          selectedObject.y = currentY - selectedObject.offsetY;
        }
        drawWorkspace();
      }
    });

    canvas.addEventListener('mouseup', () => {
      if (isDrawing) {
        isDrawing = false;
        saveCanvasToAnswers();
      }
    });

    canvas.addEventListener('mouseleave', () => {
      if (isDrawing) {
        isDrawing = false;
        saveCanvasToAnswers();
      }
    });

    // Dibujar inicialización
    drawWorkspace();
  }

  // Inicializar
  await loadActiveCandidates();
});
