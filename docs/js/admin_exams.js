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

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function beautifyCode(code) {
    if (!code) return "";
    let lines = code.split('\n');
    let indentLevel = 0;
    const indentString = "  "; // 2 spaces
    let formattedLines = [];

    // Self-closing tags list
    const selfClosingTags = ['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'data', 'col', 'embed', 'param', 'track', 'wbr'];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      // 1. Calculate indent adjustments based on closing elements at the start of the line
      // Check if line starts with a closing tag or closing curly/square brace
      const startsWithCloseTag = line.match(/^<\/([a-zA-Z0-9:-]+)>/i);
      const startsWithCloseBrace = line.startsWith('}') || line.startsWith(']');

      if (startsWithCloseTag) {
        const tagName = startsWithCloseTag[1].toLowerCase();
        if (!selfClosingTags.includes(tagName)) {
          indentLevel = Math.max(0, indentLevel - 1);
        }
      } else if (startsWithCloseBrace) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Add current line with proper indentation
      formattedLines.push(indentString.repeat(indentLevel) + line);

      // 2. Adjust indentation level for the NEXT lines
      // Count opening vs closing tags in this line
      const openTags = [...line.matchAll(/<([a-zA-Z0-9:-]+)(?![^>]*\/>)/g)].map(m => m[1].toLowerCase());
      const closeTags = [...line.matchAll(/<\/([a-zA-Z0-9:-]+)>/g)].map(m => m[1].toLowerCase());

      let netIndent = 0;
      openTags.forEach(tag => {
        if (!selfClosingTags.includes(tag)) {
          netIndent++;
        }
      });
      closeTags.forEach(tag => {
        if (!selfClosingTags.includes(tag)) {
          netIndent--;
        }
      });

      // Count curly and square braces
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      const openBrackets = (line.match(/\[/g) || []).length;
      const closeBrackets = (line.match(/\]/g) || []).length;

      netIndent += (openBraces - closeBraces);
      netIndent += (openBraces - closeBraces) ? 0 : 0; // dummy
      netIndent += (openBrackets - closeBrackets);

      if (startsWithCloseTag && !selfClosingTags.includes(startsWithCloseTag[1].toLowerCase())) {
        indentLevel = Math.max(0, indentLevel + netIndent + 1);
      } else if (startsWithCloseBrace) {
        indentLevel = Math.max(0, indentLevel + netIndent + 1);
      } else {
        indentLevel = Math.max(0, indentLevel + netIndent);
      }
    }

    return formattedLines.join('\n');
  }

  function highlightCode(code) {
    if (!code) return "";
    let beautified = beautifyCode(code);
    let escaped = escapeHTML(beautified);
    // 1. Strings: green
    escaped = escaped.replace(/(&quot;.*?&quot;|&#039;.*?&#039;|`.*?`)/g, '<span class="text-emerald-400">$1</span>');
    // 2. Comments: gray/slate
    escaped = escaped.replace(/(\/\/.*|#.*|&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-slate-500">$1</span>');
    // 3. Keywords / tags: pink/amber/purple
    const keywords = /\b(const|let|var|function|return|if|else|for|while|import|from|class|select|from|where|order|by|insert|into|values|delete|update|set|and|or|true|false)\b(?![^<]*>)/gi;
    escaped = escaped.replace(keywords, '<span class="text-pink-400 font-bold">$1</span>');
    // 4. HTML tags inside:
    escaped = escaped.replace(/(&lt;\/?\w+.*?&gt;)/g, '<span class="text-amber-300 font-bold">$1</span>');
    return escaped;
  }

  // Alerta
  function showAlert(msg, isError = false) {
    showPastelAlert(msg, isError ? "Error" : "Éxito");
  }

  // Lógica de Pestañita Especiales Colapsable
  const specialsSidebar = document.getElementById('specials-sidebar');
  const specialsToggleBtn = document.getElementById('specials-toggle-btn');
  const sidebarAddCanvasBtn = document.getElementById('sidebar-add-canvas');
  const sidebarAddProgramacionBtn = document.getElementById('sidebar-add-programacion');

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

  if (sidebarAddProgramacionBtn) {
    sidebarAddProgramacionBtn.addEventListener('click', () => {
      if (partsData.length === 0) {
        showPastelAlert("Por favor, agrega al menos una sección primero antes de insertar una pregunta especial.", "Aviso");
        return;
      }
      if (lastActivePartIdx >= partsData.length) {
        lastActivePartIdx = partsData.length - 1;
      }
      addQuestionToPart(lastActivePartIdx, 'programacion');

      // Cerrar sidebar después de agregar
      if (specialsSidebar) {
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
              class="q-correct-select px-2 py-1 border border-blue-200 focus:outline-none rounded-lg text-xs bg-white w-full max-w-xs mt-0.5 text-black"
              data-part-idx="${partIdx}"
              data-q-idx="${qIdx}"
            >
              <option value="" class="text-black">Selecciona la correcta...</option>
              ${[0, 1, 2, 3].map(optIdx => `
                <option value="${escapeHTML(q.options[optIdx] || '')}" ${q.correct === q.options[optIdx] && q.correct ? 'selected' : ''} class="text-black">
                  ${escapeHTML(q.options[optIdx]) || `Opción ${optIdx + 1}`}
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
      } else if (q.type === 'programacion') {
        const respType = q.responseType || 'ide';
        extraHtml = `
          <div class="mt-2 text-[10px] text-indigo-600 bg-indigo-50 p-3 rounded-xl border border-indigo-100 space-y-3">
            <span class="font-bold flex items-center gap-1"><i class="fa-solid fa-code text-indigo-500"></i> Pregunta de Programación</span>

            <div class="space-y-1">
              <label class="block text-[9px] font-bold text-indigo-500 uppercase">Código Inicial de la Pregunta</label>
              <textarea
                class="q-question-code-input font-mono w-full px-3 py-2 border border-indigo-200 focus:outline-none rounded-lg text-xs bg-slate-900 text-sky-400 h-20 custom-scroll"
                data-part-idx="${partIdx}"
                data-q-idx="${qIdx}"
                placeholder="Escribe el código de la pregunta aquí (ej. esquema de tablas, plantilla o snippet)..."
              >${q.questionCode || ''}</textarea>
            </div>

            <div class="space-y-1">
              <label class="block text-[9px] font-bold text-indigo-500 uppercase">Tipo de Respuesta</label>
              <select
                class="q-response-type-select px-2 py-1.5 border border-indigo-200 focus:outline-none rounded-lg text-xs bg-white w-full text-indigo-700 font-bold"
                data-part-idx="${partIdx}"
                data-q-idx="${qIdx}"
              >
                <option value="ide" ${respType === 'ide' ? 'selected' : ''}>Código en Pestañas (IDE HTML/CSS/JS/SQL)</option>
                <option value="multiple" ${respType === 'multiple' ? 'selected' : ''}>Opción Múltiple</option>
                <option value="short" ${respType === 'short' ? 'selected' : ''}>Texto Abierto / Corto</option>
              </select>
            </div>

            <div id="prog-details-container-${partIdx}-${qIdx}" class="space-y-2">
              ${respType === 'multiple' ? `
                <div class="grid grid-cols-2 gap-2">
                  ${[0, 1, 2, 3].map(optIdx => `
                    <div>
                      <label class="text-[8px] text-gray-400 block font-semibold">Opción ${optIdx + 1}</label>
                      <input
                        type="text"
                        value="${(q.options && q.options[optIdx]) || ''}"
                        class="q-prog-opt-input w-full px-2 py-1 border border-indigo-100 focus:outline-none rounded-lg text-xs bg-white text-gray-700"
                        data-part-idx="${partIdx}"
                        data-q-idx="${qIdx}"
                        data-opt-idx="${optIdx}"
                      >
                    </div>
                  `).join('')}
                </div>
                <div>
                  <label class="text-[9px] text-indigo-600 block font-bold">Opción Correcta</label>
                  <select
                    class="q-prog-correct-select px-2 py-1 border border-indigo-200 focus:outline-none rounded-lg text-xs bg-white w-full mt-0.5 text-black"
                    data-part-idx="${partIdx}"
                    data-q-idx="${qIdx}"
                  >
                    <option value="" class="text-black">Selecciona la correcta...</option>
                    ${[0, 1, 2, 3].map(optIdx => {
                      const optVal = (q.options && q.options[optIdx]) || '';
                      return `
                        <option value="${escapeHTML(optVal)}" ${q.correct === optVal && q.correct ? 'selected' : ''} class="text-black">
                          ${escapeHTML(optVal) || `Opción ${optIdx + 1}`}
                        </option>
                      `;
                    }).join('')}
                  </select>
                </div>
              ` : `
                <div>
                  <label class="block text-[9px] font-bold text-indigo-500 uppercase">${respType === 'ide' ? 'Resultado / Output Esperado' : 'Respuesta Correcta'}</label>
                  <textarea
                    class="q-correct-code-input font-mono w-full px-3 py-1.5 border border-indigo-200 focus:outline-none rounded-lg text-xs bg-slate-900 text-emerald-400 h-16 custom-scroll"
                    data-part-idx="${partIdx}"
                    data-q-idx="${qIdx}"
                    placeholder="${respType === 'ide' ? 'Escribe la respuesta esperada o el output compilado exacto...' : 'Escribe la respuesta exacta esperada...'}"
                  >${q.correct || ''}</textarea>
                </div>
              `}
            </div>

          </div>
        `;
      }

      return `
        <div class="p-5 bg-blue-50/30 rounded-2xl border border-blue-100/40 relative space-y-3 shadow-sm hover:shadow transition duration-200">
          <!-- Move and Delete Actions -->
          <div class="absolute top-3 right-3 flex items-center gap-2 text-gray-400">
            <button type="button" class="btn-move-q-up p-1 hover:text-indigo-600 transition" data-part-idx="${partIdx}" data-q-idx="${qIdx}" title="Subir Pregunta (Reordenar)">
              <i class="fa-solid fa-arrow-up text-xs"></i>
            </button>
            <button type="button" class="btn-move-q-down p-1 hover:text-indigo-600 transition" data-part-idx="${partIdx}" data-q-idx="${qIdx}" title="Bajar Pregunta (Reordenar)">
              <i class="fa-solid fa-arrow-down text-xs"></i>
            </button>
            <button type="button" class="btn-delete-q p-1 hover:text-rose-500 transition ml-1" data-part-idx="${partIdx}" data-q-idx="${qIdx}" title="Borrar Pregunta">
              <i class="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>

          <div>
            <div class="flex items-center gap-2 mb-1.5 select-none">
              <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                q.type === 'multiple' ? 'bg-blue-100 text-blue-700' : q.type === 'boolean' ? 'bg-sky-100 text-sky-700' : q.type === 'short' ? 'bg-amber-100 text-amber-800' : q.type === 'canvas' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
              }">${q.type === 'multiple' ? 'Múltiple' : q.type === 'boolean' ? 'V / F' : q.type === 'short' ? 'Abierta' : q.type === 'canvas' ? 'Canvas (Ilustrador)' : 'Programación'}</span>
              <span class="text-xs text-gray-400 font-bold">Pregunta ${qIdx + 1}</span>
            </div>
            <input
              type="text"
              value="${q.text}"
              class="q-text-input px-4 py-2.5 w-full border border-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded-xl text-sm font-semibold text-gray-800"
              data-part-idx="${partIdx}"
              data-q-idx="${qIdx}"
              placeholder="Escribe el enunciado de la pregunta aquí..."
            >
          </div>

          ${extraHtml}
        </div>
      `;
    }).join('');
  }

  function addQuestionToPart(partIdx, type) {
    const defaultOptions = type === 'multiple' ? ["", "", "", ""] : (type === 'boolean' ? ["Verdadero", "Falso"] : []);
    const qObj = {
      id: "q_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      type: type,
      text: "",
      options: defaultOptions,
      correct: ""
    };
    if (type === 'programacion') {
      qObj.questionCode = "";
      qObj.responseType = "ide";
    }
    partsData[partIdx].questions.push(qObj);
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

    document.querySelectorAll('.q-question-code-input').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const partIdx = e.target.getAttribute('data-part-idx');
        const qIdx = e.target.getAttribute('data-q-idx');
        partsData[partIdx].questions[qIdx].questionCode = e.target.value;
      });
    });

    document.querySelectorAll('.q-correct-code-input').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const partIdx = e.target.getAttribute('data-part-idx');
        const qIdx = e.target.getAttribute('data-q-idx');
        partsData[partIdx].questions[qIdx].correct = e.target.value;
      });
    });

    document.querySelectorAll('.q-response-type-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const partIdx = select.getAttribute('data-part-idx');
        const qIdx = select.getAttribute('data-q-idx');
        partsData[partIdx].questions[qIdx].responseType = e.target.value;
        if (e.target.value === 'multiple' && (!partsData[partIdx].questions[qIdx].options || partsData[partIdx].questions[qIdx].options.length === 0)) {
          partsData[partIdx].questions[qIdx].options = ["", "", "", ""];
        }
        renderParts();
      });
    });

    document.querySelectorAll('.q-prog-opt-input').forEach(input => {
      input.addEventListener('input', () => {
        const partIdx = input.getAttribute('data-part-idx');
        const qIdx = input.getAttribute('data-q-idx');
        const optIdx = input.getAttribute('data-opt-idx');
        partsData[partIdx].questions[qIdx].options[optIdx] = input.value;

        const correctSelect = document.querySelector(`.q-prog-correct-select[data-part-idx="${partIdx}"][data-q-idx="${qIdx}"]`);
        if (correctSelect) {
          const currentVal = correctSelect.value;
          correctSelect.innerHTML = '<option value="" class="text-black">Selecciona la correcta...</option>';
          partsData[partIdx].questions[qIdx].options.forEach((opt, idx) => {
            const optLabel = opt ? escapeHTML(opt) : `Opción ${idx + 1}`;
            const selectedStr = currentVal === opt && opt ? 'selected' : '';
            correctSelect.innerHTML += `<option value="${escapeHTML(opt)}" ${selectedStr} class="text-black">${optLabel}</option>`;
          });
        }
      });
    });

    document.querySelectorAll('.q-prog-correct-select').forEach(select => {
      select.addEventListener('change', () => {
        const partIdx = select.getAttribute('data-part-idx');
        const qIdx = select.getAttribute('data-q-idx');
        partsData[partIdx].questions[qIdx].correct = select.value;
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
          correctSelect.innerHTML = '<option value="" class="text-black">Selecciona la correcta...</option>';
          partsData[partIdx].questions[qIdx].options.forEach((opt, idx) => {
            const optLabel = opt ? escapeHTML(opt) : `Opción ${idx + 1}`;
            const selectedStr = currentVal === opt && opt ? 'selected' : '';
            correctSelect.innerHTML += `<option value="${escapeHTML(opt)}" ${selectedStr} class="text-black">${optLabel}</option>`;
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

    document.querySelectorAll('.btn-move-q-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const partIdx = parseInt(btn.getAttribute('data-part-idx'));
        const qIdx = parseInt(btn.getAttribute('data-q-idx'));
        if (qIdx > 0) {
          const temp = partsData[partIdx].questions[qIdx];
          partsData[partIdx].questions[qIdx] = partsData[partIdx].questions[qIdx - 1];
          partsData[partIdx].questions[qIdx - 1] = temp;
          renderParts();
        }
      });
    });

    document.querySelectorAll('.btn-move-q-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const partIdx = parseInt(btn.getAttribute('data-part-idx'));
        const qIdx = parseInt(btn.getAttribute('data-q-idx'));
        if (qIdx < partsData[partIdx].questions.length - 1) {
          const temp = partsData[partIdx].questions[qIdx];
          partsData[partIdx].questions[qIdx] = partsData[partIdx].questions[qIdx + 1];
          partsData[partIdx].questions[qIdx + 1] = temp;
          renderParts();
        }
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

  // ==========================================
  // SINOPSIS Y MODO SIMULACIÓN DE EXAMEN (TEST)
  // ==========================================
  const testExamModal = document.getElementById('test-exam-modal');
  const btnTestExam = document.getElementById('btn-test-exam');
  const btnCloseTest = document.getElementById('btn-close-test');
  const simTechExamTitle = document.getElementById('sim-tech-exam-title');
  const simTechExamDesc = document.getElementById('sim-tech-exam-desc');
  const simTechProgressText = document.getElementById('sim-tech-progress-text');
  const simTechQuestionsContainer = document.getElementById('sim-tech-questions-container');
  const btnSimSubmit = document.getElementById('btn-sim-submit');
  const simTechSection = document.getElementById('sim-tech-section');
  const simCompletedSection = document.getElementById('sim-completed-section');
  const simResultsReport = document.getElementById('sim-results-report');
  const btnSimRestart = document.getElementById('btn-sim-restart');

  let simAnswers = {}; // { [qId]: answerValue }
  let simActiveIntervals = []; // Store any active canvas timers

  if (btnTestExam && testExamModal) {
    btnTestExam.addEventListener('click', () => {
      // Validar si hay secciones y preguntas para simular
      if (partsData.length === 0 || partsData.every(p => p.questions.length === 0)) {
        showPastelAlert("Por favor, agrega al menos una sección con preguntas para poder iniciar la simulación de prueba.", "Aviso");
        return;
      }

      // Reiniciar estado
      simAnswers = {};
      clearSimActiveIntervals();

      // Mostrar modal
      testExamModal.classList.remove('hidden');
      simTechSection.classList.remove('hidden');
      simCompletedSection.classList.add('hidden');

      // Configurar título y descripción
      const examName = examNameInput.value.trim() || "Examen Técnico de Prueba";
      const examDesc = examDescInput.value.trim() || "Simulación del examen actualmente en desarrollo.";
      simTechExamTitle.innerHTML = `Examen: <span class="text-blue-600 font-extrabold">${escapeHTML(examName)}</span>`;
      simTechExamDesc.textContent = examDesc;

      renderSimulatedExam();
    });
  }

  if (btnCloseTest && testExamModal) {
    btnCloseTest.addEventListener('click', () => {
      testExamModal.classList.add('hidden');
      clearSimActiveIntervals();
    });
  }

  function clearSimActiveIntervals() {
    simActiveIntervals.forEach(clearInterval);
    simActiveIntervals = [];
  }

  function updateSimProgress(answered, total) {
    if (simTechProgressText) {
      simTechProgressText.textContent = `${answered} / ${total} Respondidas`;
    }
  }

  function renderSimulatedExam() {
    simTechQuestionsContainer.innerHTML = "";
    let qCount = 0;

    partsData.forEach((part, partIdx) => {
      let partHtml = `
        <div class="bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100/50 shadow-sm space-y-4">
          <h3 class="text-sm font-bold text-indigo-700 flex items-center gap-1.5 border-b border-indigo-100 pb-2">
            ${escapeHTML(part.title)}
          </h3>
          <div class="space-y-4">
      `;

      part.questions.forEach((q, qIdx) => {
        qCount++;
        let widget = "";

        if (q.type === 'multiple') {
          widget = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              ${q.options.map(opt => `
                <label class="flex items-center gap-2 p-2.5 rounded-xl border border-blue-50 bg-white hover:bg-blue-50/50 cursor-pointer transition text-xs font-semibold text-gray-700">
                  <input type="radio" name="sim_tech_q_${q.id}" value="${opt}" class="sim-tech-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                  <span>${escapeHTML(opt)}</span>
                </label>
              `).join('')}
            </div>
          `;
        } else if (q.type === 'boolean') {
          widget = `
            <div class="grid grid-cols-2 gap-3 mt-2 max-w-xs">
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-indigo-50 bg-white hover:bg-indigo-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="sim_tech_q_${q.id}" value="Verdadero" class="sim-tech-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                Verdadero
              </label>
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-indigo-50 bg-white hover:bg-indigo-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="sim_tech_q_${q.id}" value="Falso" class="sim-tech-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                Falso
              </label>
            </div>
          `;
        } else if (q.type === 'short') {
          widget = `
            <textarea rows="3" class="sim-tech-textarea-input w-full mt-2 px-3 py-2 rounded-xl border border-indigo-100 text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none text-black" data-q-id="${q.id}"></textarea>
          `;
        } else if (q.type === 'programacion') {
          const respType = q.responseType || 'ide';

          let questionConsoleHtml = "";
          if (q.questionCode && q.questionCode.trim()) {
            questionConsoleHtml = `
              <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-sky-300 max-h-80 overflow-y-auto whitespace-pre-wrap relative shadow-inner no-scrollbar">
                <div class="flex items-center border-b border-slate-800 pb-1.5 mb-2 select-none">
                  <span class="text-slate-500 text-[10px] uppercase font-extrabold tracking-wider">Consola</span>
                </div>
                <code>${highlightCode(q.questionCode)}</code>
              </div>
            `;
          }

          if (respType === 'multiple') {
            widget = `
              <div class="programacion-container mt-3 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col text-white relative mb-4" data-q-id="${q.id}">
                ${questionConsoleHtml}
              </div>

              <div class="bg-white p-3 rounded-xl border border-blue-100/50 space-y-2 text-black">
                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Selecciona la opción correcta:</span>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  ${(q.options || []).map(opt => `
                    <label class="flex items-center gap-2.5 p-3 rounded-xl border border-blue-50 bg-white hover:bg-blue-50/50 cursor-pointer transition text-xs font-semibold text-gray-700 shadow-sm">
                      <input type="radio" name="sim_tech_q_${q.id}" value="${opt}" class="sim-tech-radio-input focus:ring-blue-400 text-blue-500 bg-white border-blue-200" data-q-id="${q.id}">
                      <span>${escapeHTML(opt)}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
            `;
          } else if (respType === 'short') {
            widget = `
              <div class="programacion-container mt-3 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col gap-4 text-white relative" data-q-id="${q.id}">
                ${questionConsoleHtml}

                <div class="space-y-1">
                  <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Escribe tu respuesta:</label>
                  <textarea rows="3" class="sim-tech-textarea-input w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 focus:ring-1 focus:ring-indigo-500 focus:outline-none custom-scroll" data-q-id="${q.id}" placeholder="Escribe tu código o respuesta aquí..."></textarea>
                </div>
              </div>
            `;
          } else {
            widget = `
              <div class="programacion-container mt-3 bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col gap-4 text-white relative" data-q-id="${q.id}">
                ${questionConsoleHtml}

                <!-- Tab selector -->
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div class="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
                    ${['html', 'css', 'js', 'sql'].map(tab => {
                      const isActive = tab === 'html';
                      const uppercaseTab = tab.toUpperCase();
                      return `
                        <button type="button" class="sim-tab-btn-${q.id} px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 ${isActive ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}" data-tab="${tab}" data-q-id="${q.id}">
                          ${uppercaseTab}
                        </button>
                      `;
                    }).join('')}
                  </div>
                  <div class="text-[9px] text-slate-400 font-bold uppercase tracking-wider bg-slate-950/60 px-2.5 py-1 rounded border border-slate-800">
                    Modo Programación
                  </div>
                </div>

                <!-- Editors and Preview Workspace Grid -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

                  <!-- Code Editors Column -->
                  <div class="space-y-3">
                    <!-- HTML Editor -->
                    <div class="sim-editor-pane-${q.id}" id="sim-pane-html-${q.id}">
                      <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-semibold">
                        <span>Código HTML5</span>
                        <span class="text-orange-400">index.html</span>
                      </div>
                      <textarea id="sim-code-html-${q.id}" class="w-full h-44 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 custom-scroll" placeholder="<!-- Escribe tu HTML aquí -->"></textarea>
                    </div>

                    <!-- CSS Editor -->
                    <div class="sim-editor-pane-${q.id} hidden" id="sim-pane-css-${q.id}">
                      <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-semibold">
                        <span>Código CSS3</span>
                        <span class="text-blue-400">styles.css</span>
                      </div>
                      <textarea id="sim-code-css-${q.id}" class="w-full h-44 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 custom-scroll" placeholder="/* Escribe tu CSS aquí */"></textarea>
                    </div>

                    <!-- JS Editor -->
                    <div class="sim-editor-pane-${q.id} hidden" id="sim-pane-js-${q.id}">
                      <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-semibold">
                        <span>Código JavaScript</span>
                        <span class="text-yellow-400">app.js</span>
                      </div>
                      <textarea id="sim-code-js-${q.id}" class="w-full h-44 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 custom-scroll" placeholder="// Escribe tu JS aquí (usa console.log para ver resultados)"></textarea>
                    </div>

                    <!-- SQL Editor -->
                    <div class="sim-editor-pane-${q.id} hidden" id="sim-pane-sql-${q.id}">
                      <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-semibold">
                        <span>Consulta SQL (Tablas: users, vacancies)</span>
                        <span class="text-cyan-400">query.sql</span>
                      </div>
                      <textarea id="sim-code-sql-${q.id}" class="w-full h-44 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 custom-scroll" placeholder="SELECT * FROM users; -- Prueba aquí tus consultas SQL"></textarea>
                    </div>

                    <!-- Compile Button -->
                    <button type="button" id="sim-btn-compile-${q.id}" class="sim-btn-compile-class w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-950/50 flex items-center justify-center gap-2 transition duration-200" data-q-id="${q.id}">
                      Compilar y Guardar Código
                    </button>
                  </div>

                  <!-- Live Preview / Terminal Column -->
                  <div class="space-y-3 flex flex-col justify-between">
                    <!-- Output Console -->
                    <div class="flex-1 flex flex-col min-h-0">
                      <span class="text-[10px] text-slate-400 font-semibold mb-1 block">Consola de Ejecución</span>
                      <div class="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-emerald-400 overflow-y-auto max-h-48 custom-scroll relative shadow-inner flex flex-col justify-between" style="min-height: 120px;">
                        <pre id="sim-output-console-${q.id}" class="whitespace-pre-wrap font-mono">Sube/Compila tu código para ver el resultado aquí...</pre>
                        <div class="flex justify-between items-center text-[8px] text-slate-500 mt-2 pt-1 border-t border-slate-900 select-none">
                          <span>Compilador V1.0.0</span>
                          <span>Listo</span>
                        </div>
                      </div>
                    </div>

                    <!-- Live Web Preview Box (Only relevant for HTML/CSS/JS) -->
                    <div class="h-28 flex flex-col min-h-0" id="sim-preview-box-container-${q.id}">
                      <span class="text-[10px] text-slate-400 font-semibold mb-1 block">Vista Previa Web</span>
                      <div class="flex-1 bg-white rounded-xl overflow-hidden border border-slate-800 relative">
                        <iframe id="sim-preview-frame-${q.id}" class="w-full h-full bg-white block" sandbox="allow-scripts"></iframe>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            `;
          }
        } else if (q.type === 'canvas') {
          widget = `
            <div class="illustrator-container mt-3 bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col gap-4 text-white relative select-none overflow-hidden" data-q-id="${q.id}">

              <!-- Header Bar (Timer and Info) -->
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                  <span class="text-xs font-bold text-rose-400 uppercase tracking-widest animate-pulse" id="sim-canvas-timer-${q.id}">Tiempo Restante: 30:00</span>
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
                      <button type="button" id="sim-tool-select-${q.id}" class="sim-canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 active bg-purple-600 text-white" data-tool="select" data-q-id="${q.id}">
                        <i class="fa-solid fa-arrow-pointer"></i>
                        <span class="text-[9px]">Puntero</span>
                      </button>
                      <button type="button" id="sim-tool-draw-${q.id}" class="sim-canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 bg-slate-900 text-slate-400 hover:bg-slate-800" data-tool="draw" data-q-id="${q.id}">
                        <i class="fa-solid fa-pencil"></i>
                        <span class="text-[9px]">Lápiz</span>
                      </button>
                      <button type="button" id="sim-tool-rect-${q.id}" class="sim-canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 bg-slate-900 text-slate-400 hover:bg-slate-800" data-tool="rect" data-q-id="${q.id}">
                        <i class="fa-regular fa-square"></i>
                        <span class="text-[9px]">Rectángulo</span>
                      </button>
                      <button type="button" id="sim-tool-circle-${q.id}" class="sim-canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 bg-slate-900 text-slate-400 hover:bg-slate-800" data-tool="circle" data-q-id="${q.id}">
                        <i class="fa-regular fa-circle"></i>
                        <span class="text-[9px]">Círculo</span>
                      </button>
                    </div>

                    <!-- Line Width -->
                    <div class="space-y-1">
                      <label class="text-[9px] text-slate-400 font-bold block uppercase">Grosor de Trazo</label>
                      <input type="range" id="sim-brush-size-${q.id}" min="1" max="40" value="5" class="w-full accent-purple-500">
                    </div>

                    <!-- Add Text tool -->
                    <div class="space-y-1 pt-1 border-t border-slate-800/60">
                      <label class="text-[9px] text-slate-400 font-bold block uppercase">Añadir Texto al Lienzo</label>
                      <div class="flex gap-1.5">
                        <input type="text" id="sim-text-input-${q.id}" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none" placeholder="Escribe aquí..." value="Hola Mundo">
                        <button type="button" id="sim-btn-add-text-${q.id}" class="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-bold" data-q-id="${q.id}"><i class="fa-solid fa-plus"></i></button>
                      </div>
                    </div>
                  </div>

                  <!-- Actions / Clear -->
                  <div class="space-y-2 pt-2 border-t border-slate-800/60">
                    <button type="button" id="sim-btn-undo-${q.id}" class="w-full py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-300 transition flex items-center justify-center gap-1.5" data-q-id="${q.id}">
                      <i class="fa-solid fa-rotate-left"></i> Deshacer (Ctrl+Z)
                    </button>
                    <button type="button" id="sim-btn-clear-${q.id}" class="w-full py-1.5 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-900/40 text-rose-300 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1.5" data-q-id="${q.id}">
                      <i class="fa-regular fa-trash-can"></i> Limpiar Lienzo
                    </button>
                  </div>
                </div>

                <!-- Center Canvas Area (A4 Sheet layout) -->
                <div class="lg:col-span-2 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden relative" style="height: 480px;" id="sim-canvas-container-${q.id}">
                  <!-- Scaled A4 workspace board -->
                  <div id="sim-a4-board-${q.id}" class="bg-white relative shadow-2xl origin-center" style="width: 310px; height: 438px; transform: scale(1); min-width: 310px; min-height: 438px;">
                    <canvas id="sim-canvas-element-${q.id}" width="310" height="438" class="absolute inset-0 z-10 block cursor-crosshair"></canvas>
                  </div>

                  <!-- Floating zoom indicator -->
                  <div class="absolute bottom-3 right-3 bg-slate-900/90 border border-slate-800 text-[10px] px-2 py-1 rounded-lg text-slate-300 pointer-events-none font-bold z-20">
                    Zoom: <span id="sim-zoom-label-${q.id}">100%</span>
                  </div>
                </div>

                <!-- Right Assets & Color Panel -->
                <div class="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-col space-y-4">

                  <!-- Color Palette -->
                  <div class="space-y-2">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Paleta de Colores</span>
                    <div class="grid grid-cols-6 gap-1.5" id="sim-color-palette-${q.id}">
                      <!-- Populated dynamically -->
                    </div>
                    <div class="flex items-center justify-between pt-1.5 border-t border-slate-800/60">
                      <span class="text-[9px] text-slate-400 font-bold uppercase">Personalizado</span>
                      <input type="color" id="sim-color-picker-${q.id}" value="#a855f7" class="w-6 h-6 rounded-lg bg-transparent border-none cursor-pointer">
                    </div>
                  </div>

                  <!-- Assets Drawer -->
                  <div class="flex-1 flex flex-col min-h-0 space-y-1.5">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block shrink-0">Biblioteca de Assets (Ilustraciones)</span>
                    <div class="flex-1 overflow-y-auto custom-scroll pr-1 space-y-1.5" id="sim-assets-drawer-${q.id}">
                      <!-- Populated with click-to-add items -->
                    </div>
                  </div>

                </div>

              </div>

            </div>
          `;
        }

        partHtml += `
          <div class="space-y-1 bg-white p-5 rounded-2xl border border-blue-50 shadow-sm text-black">
            <span class="text-sm font-semibold text-gray-800 block mb-1.5 leading-relaxed">Pregunta: ${escapeHTML(q.text)}</span>
            ${widget}
          </div>
        `;
      });

      partHtml += `
          </div>
        </div>
      `;
      simTechQuestionsContainer.innerHTML += partHtml;
    });

    updateSimProgress(0, qCount);

    // Binds
    document.querySelectorAll('.sim-tech-radio-input').forEach(radio => {
      radio.addEventListener('change', () => {
        simAnswers[radio.getAttribute('data-q-id')] = radio.value;
        const total = Object.keys(simAnswers).length;
        updateSimProgress(total, qCount);
      });
    });

    document.querySelectorAll('.sim-tech-textarea-input').forEach(ta => {
      ta.addEventListener('input', () => {
        const qId = ta.getAttribute('data-q-id');
        const val = ta.value.trim();
        if (val) {
          simAnswers[qId] = val;
        } else {
          delete simAnswers[qId];
        }
        const total = Object.keys(simAnswers).length;
        updateSimProgress(total, qCount);
      });
    });

    // Initialize Interactive Canvas and Programming environments
    partsData.forEach(part => {
      part.questions.forEach(q => {
        if (q.type === 'canvas') {
          initSimIllustratorCanvas(q.id);
        } else if (q.type === 'programacion') {
          initSimProgramacionIDE(q.id, q);
        }
      });
    });
  }

  function initSimIllustratorCanvas(qId) {
    const canvas = document.getElementById(`sim-canvas-element-${qId}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = document.getElementById(`sim-canvas-container-${qId}`);
    const board = document.getElementById(`sim-a4-board-${qId}`);
    const zoomLabel = document.getElementById(`sim-zoom-label-${qId}`);
    const brushSizeInput = document.getElementById(`sim-brush-size-${qId}`);
    const colorPicker = document.getElementById(`sim-color-picker-${qId}`);
    const textInput = document.getElementById(`sim-text-input-${qId}`);
    const addTextBtn = document.getElementById(`sim-btn-add-text-${qId}`);
    const undoBtn = document.getElementById(`sim-btn-undo-${qId}`);
    const clearBtn = document.getElementById(`sim-btn-clear-${qId}`);
    const timerLabel = document.getElementById(`sim-canvas-timer-${qId}`);

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

    // Configurar temporizador (30 Minutos)
    let timeRemainingSeconds = 30 * 60;
    const timerInterval = setInterval(() => {
      if (document.getElementById(`sim-canvas-timer-${qId}`) === null) {
        clearInterval(timerInterval);
        return;
      }
      if (timeRemainingSeconds <= 0) {
        clearInterval(timerInterval);
        saveCanvasToAnswers();
        return;
      }
      timeRemainingSeconds--;
      const min = String(Math.floor(timeRemainingSeconds / 60)).padStart(2, '0');
      const sec = String(timeRemainingSeconds % 60).padStart(2, '0');
      timerLabel.textContent = `Tiempo Restante: ${min}:${sec}`;
    }, 1000);
    simActiveIntervals.push(timerInterval);

    // Paleta de Colores
    const colors = [
      '#000000', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#10b981',
      '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'
    ];
    const paletteContainer = document.getElementById(`sim-color-palette-${qId}`);
    if (paletteContainer) {
      paletteContainer.innerHTML = '';
      colors.forEach(color => {
        const borderStyle = color === '#ffffff' ? 'border-gray-300' : 'border-transparent';
        paletteContainer.innerHTML += `
          <button type="button" class="w-5 h-5 rounded-full border ${borderStyle} transition transform hover:scale-115 active:scale-95" style="background-color: ${color};" data-color="${color}"></button>
        `;
      });
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
        drawWorkspace();
        saveCanvasToAnswers();
      }
    }

    // Biblioteca de Assets
    const assets = [
      { name: "👑 Corona Real", value: "👑" },
      { name: "⚡ Rayo", value: "⚡" },
      { name: "⭐ Estrella Dorada", value: "⭐" },
      { name: "💡 Idea Genial", value: "💡" },
      { name: "🔥 Fuego Intenso", value: "🔥" },
      { name: "🛡️ Escudo de Éxito", value: "🛡️" },
      { name: "📢 Megáfono Oferta", value: "📢" },
      { name: "🎯 Tiro al Blanco", value: "🎯" },
      { name: "🚀 Cohete Alza", value: "🚀" },
      { name: "🍀 Trébol Suerte", value: "🍀" }
    ];
    const assetsContainer = document.getElementById(`sim-assets-drawer-${qId}`);
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
          addAssetToCanvas(assets[idx]);
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
    document.querySelectorAll(`.sim-canvas-tool-btn[data-q-id="${qId}"]`).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`.sim-canvas-tool-btn[data-q-id="${qId}"]`).forEach(b => {
          b.className = "sim-canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 bg-slate-900 text-slate-400 hover:bg-slate-800";
        });
        btn.className = "sim-canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 active bg-purple-600 text-white";
        currentTool = btn.getAttribute('data-tool');
        if (currentTool !== 'select') {
          selectedObject = null;
        }
        drawWorkspace();
      });
    });

    function updateToolUI() {
      document.querySelectorAll(`.sim-canvas-tool-btn[data-q-id="${qId}"]`).forEach(b => {
        const t = b.getAttribute('data-tool');
        if (t === currentTool) {
          b.className = "sim-canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 active bg-purple-600 text-white";
        } else {
          b.className = "sim-canvas-tool-btn p-2 rounded-xl transition text-xs font-bold flex flex-col items-center gap-1 bg-slate-900 text-slate-400 hover:bg-slate-800";
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
        saveStateToUndo();
        layers = [];
        selectedObject = null;
        drawWorkspace();
        saveCanvasToAnswers();
      });
    }

    function saveStateToUndo() {
      undoHistory.push(JSON.parse(JSON.stringify(layers)));
      if (undoHistory.length > 15) {
        undoHistory.shift();
      }
    }

    function saveCanvasToAnswers() {
      simAnswers[qId] = canvas.toDataURL('image/png');
      const total = Object.keys(simAnswers).length;
      const qCount = partsData.reduce((acc, p) => acc + p.questions.length, 0);
      updateSimProgress(total, qCount);
    }

    // Zoom and Space drag keyboard support
    let isSpacePressed = false;
    const keydownHandler = (e) => {
      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        isSpacePressed = true;
        container.style.cursor = 'grab';
        e.preventDefault();
      }
      if (e.ctrlKey && e.code === 'KeyZ') {
        if (undoHistory.length > 0) {
          layers = undoHistory.pop();
          selectedObject = null;
          drawWorkspace();
          saveCanvasToAnswers();
        }
        e.preventDefault();
      }
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedObject && document.activeElement.tagName !== 'INPUT') {
        saveStateToUndo();
        layers = layers.filter(l => l.id !== selectedObject.id);
        selectedObject = null;
        drawWorkspace();
        saveCanvasToAnswers();
        e.preventDefault();
      }
    };

    const keyupHandler = (e) => {
      if (e.code === 'Space') {
        isSpacePressed = false;
        container.style.cursor = 'default';
      }
    };

    window.addEventListener('keydown', keydownHandler);
    window.addEventListener('keyup', keyupHandler);

    // Remove keyboard listener when modal closes
    btnCloseTest.addEventListener('click', () => {
      window.removeEventListener('keydown', keydownHandler);
      window.removeEventListener('keyup', keyupHandler);
    }, { once: true });

    container.addEventListener('wheel', (e) => {
      if (isSpacePressed || e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        zoomScale = Math.min(Math.max(zoomScale + delta, 0.5), 2.5);
        board.style.transform = `scale(${zoomScale})`;
        zoomLabel.textContent = `${Math.round(zoomScale * 100)}%`;
      }
    }, { passive: false });

    function drawWorkspace() {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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

      if (currentTool === 'select' && selectedObject) {
        ctx.save();
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);

        let bx = 0, by = 0, bw = 0, bh = 0;
        if (selectedObject.type === 'stroke') {
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
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(bx - 3, by - 3, 6, 6);
        ctx.fillRect(bx + bw - 3, by - 3, 6, 6);
        ctx.fillRect(bx - 3, by + bh - 3, 6, 6);
        ctx.fillRect(bx + bw - 3, by + bh - 3, 6, 6);
        ctx.restore();
      }
    }

    function getMouseCoords(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
      };
    }

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

    const stopDrawing = () => {
      if (isDrawing) {
        isDrawing = false;
        saveCanvasToAnswers();
      }
    };

    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    drawWorkspace();
  }

  function initSimProgramacionIDE(qId, q) {
    if (q.responseType && q.responseType !== 'ide') {
      return;
    }
    const htmlCodeArea = document.getElementById(`sim-code-html-${qId}`);
    const cssCodeArea = document.getElementById(`sim-code-css-${qId}`);
    const jsCodeArea = document.getElementById(`sim-code-js-${qId}`);
    const sqlCodeArea = document.getElementById(`sim-code-sql-${qId}`);
    const compileBtn = document.getElementById(`sim-btn-compile-${qId}`);
    const consoleOutput = document.getElementById(`sim-output-console-${qId}`);
    const previewFrame = document.getElementById(`sim-preview-frame-${qId}`);

    let activeTab = "html";

    document.querySelectorAll(`.sim-tab-btn-${qId}`).forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedTab = btn.getAttribute('data-tab');
        activeTab = selectedTab;

        document.querySelectorAll(`.sim-tab-btn-${qId}`).forEach(b => {
          b.className = `sim-tab-btn-${qId} px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 text-slate-400 hover:text-slate-200 hover:bg-slate-900`;
        });
        btn.className = `sim-tab-btn-${qId} px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 bg-indigo-600 text-white shadow`;

        document.querySelectorAll(`.sim-editor-pane-${qId}`).forEach(pane => {
          pane.classList.add('hidden');
        });
        const activePane = document.getElementById(`sim-pane-${selectedTab}-${qId}`);
        if (activePane) activePane.classList.remove('hidden');

        saveCurrentCodeState();
      });
    });

    function saveCurrentCodeState(compiledOutputValue = "") {
      const htmlVal = htmlCodeArea ? htmlCodeArea.value : "";
      const cssVal = cssCodeArea ? cssCodeArea.value : "";
      const jsVal = jsCodeArea ? jsCodeArea.value : "";
      const sqlVal = sqlCodeArea ? sqlCodeArea.value : "";

      const newAnswerObj = {
        html: htmlVal,
        css: cssVal,
        js: jsVal,
        sql: sqlVal,
        compiledOutput: compiledOutputValue || (simAnswers[qId] && simAnswers[qId].compiledOutput) || "",
        activeTab: activeTab
      };

      simAnswers[qId] = newAnswerObj;

      const total = Object.keys(simAnswers).length;
      const qCount = partsData.reduce((acc, p) => acc + p.questions.length, 0);
      updateSimProgress(total, qCount);
    }

    if (compileBtn) {
      compileBtn.addEventListener('click', () => {
        const htmlVal = htmlCodeArea ? htmlCodeArea.value : "";
        const cssVal = cssCodeArea ? cssCodeArea.value : "";
        const jsVal = jsCodeArea ? jsCodeArea.value : "";
        const sqlVal = sqlCodeArea ? sqlCodeArea.value : "";

        let outputStr = "";

        if (activeTab === 'js') {
          outputStr = executeSimJS(jsVal);
        } else if (activeTab === 'sql') {
          outputStr = executeSimMockSQL(sqlVal);
        } else {
          outputStr = "Páginas cargadas y compiladas con éxito.";
        }

        if (previewFrame) {
          const combinedSrc = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>${cssVal}</style>
            </head>
            <body style="margin:8px;font-family:sans-serif;color:black;">
              ${htmlVal}
              <script>
                try {
                  ${jsVal}
                } catch(e) {
                  document.body.innerHTML += '<div style="color:red;font-family:monospace;margin-top:10px;">Error: ' + e.message + '</div>';
                }
              </script>
            </body>
            </html>
          `;
          previewFrame.srcdoc = combinedSrc;
        }

        if (consoleOutput) {
          consoleOutput.textContent = outputStr;
        }

        saveCurrentCodeState(outputStr);
        showPastelAlert("¡Código compilador ejecutado y resultado guardado en simulación!", "Compilador");
      });
    }

    [htmlCodeArea, cssCodeArea, jsCodeArea, sqlCodeArea].forEach(area => {
      if (area) {
        area.addEventListener('input', () => {
          saveCurrentCodeState();
        });
      }
    });
  }

  function executeSimJS(code) {
    let logs = [];
    const originalLog = console.log;
    console.log = function(...args) {
      logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    };

    try {
      const result = eval(code);
      console.log = originalLog;
      if (logs.length > 0) {
        return logs.join('\n');
      }
      return result !== undefined ? String(result) : "Code executed successfully with no output.";
    } catch (err) {
      console.log = originalLog;
      return `Error de Ejecución: ${err.message}`;
    }
  }

  function executeSimMockSQL(sql) {
    const query = sql.trim().replace(/\s+/g, ' ');
    const selectMatch = query.match(/^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?$/i);
    if (!selectMatch) {
      return "Error SQL: Solo consultas SELECT son soportadas en este compilador de simulación (Tablas: users, vacancies).";
    }
    const fieldsStr = selectMatch[1].trim();
    const tableName = selectMatch[2].trim().toLowerCase();
    const whereStr = selectMatch[3] ? selectMatch[3].trim() : null;
    const orderByStr = selectMatch[4] ? selectMatch[4].trim() : null;

    const mockDB = {
      users: [
        { id: 1, name: "Ana Lopez", role: "Developer", score: 95 },
        { id: 2, name: "Carlos Ruiz", role: "Designer", score: 88 },
        { id: 3, name: "Sofia Perez", role: "Developer", score: 92 }
      ],
      vacancies: [
        { id: 1, title: "Frontend Dev", status: "Open" },
        { id: 2, title: "UI/UX Designer", status: "Closed" }
      ]
    };

    if (!mockDB[tableName]) {
      return `Error SQL: Table "${tableName}" not found. Tables available: users, vacancies`;
    }

    let rows = [...mockDB[tableName]];

    if (whereStr) {
      const whereMatch = whereStr.match(/(\w+)\s*(=|!=|>|<)\s*(.+)/);
      if (whereMatch) {
        const field = whereMatch[1].trim();
        const op = whereMatch[2].trim();
        let val = whereMatch[3].trim().replace(/['"]/g, '');
        rows = rows.filter(row => {
          let rowVal = row[field];
          if (typeof rowVal === 'number') {
            val = parseFloat(val);
          }
          if (op === '=') return rowVal == val;
          if (op === '!=') return rowVal != val;
          if (op === '>') return rowVal > val;
          if (op === '<') return rowVal < val;
          return true;
        });
      }
    }

    if (orderByStr) {
      const orderParts = orderByStr.split(' ');
      const field = orderParts[0].trim();
      const desc = orderParts[1] && orderParts[1].toUpperCase() === 'DESC';
      rows.sort((a, b) => {
        if (a[field] < b[field]) return desc ? 1 : -1;
        if (a[field] > b[field]) return desc ? -1 : 1;
        return 0;
      });
    }

    let fields = fieldsStr.split(',').map(f => f.trim());
    if (fields.length === 1 && fields[0] === '*') {
      fields = Object.keys(mockDB[tableName][0]);
    }

    const colWidths = {};
    fields.forEach(f => {
      colWidths[f] = f.length;
      rows.forEach(r => {
        const cellVal = String(r[f] !== undefined ? r[f] : '');
        if (cellVal.length > colWidths[f]) {
          colWidths[f] = cellVal.length;
        }
      });
    });

    let output = '';
    let border = '+';
    fields.forEach(f => {
      border += '-'.repeat(colWidths[f] + 2) + '+';
    });
    output += border + '\n';

    let headerRow = '|';
    fields.forEach(f => {
      headerRow += ' ' + f.toUpperCase().padEnd(colWidths[f]) + ' |';
    });
    output += headerRow + '\n' + border + '\n';

    if (rows.length === 0) {
      let emptyRow = '|';
      const totalW = fields.reduce((sum, f) => sum + colWidths[f] + 3, 0) - 1;
      emptyRow += ' No rows returned '.padEnd(totalW) + '|';
      output += emptyRow + '\n' + border + '\n';
    } else {
      rows.forEach(r => {
        let rowStr = '|';
        fields.forEach(f => {
          const cellVal = String(r[f] !== undefined ? r[f] : '');
          rowStr += ' ' + cellVal.padEnd(colWidths[f]) + ' |';
        });
        rowStr += '\n';
        output += rowStr;
      });
      output += border + '\n';
    }

    return output.trim();
  }

  if (btnSimSubmit) {
    btnSimSubmit.addEventListener('click', () => {
      let qCount = partsData.reduce((acc, p) => acc + p.questions.length, 0);
      if (Object.keys(simAnswers).length < qCount) {
        showPastelAlert("Por favor, responde todas las preguntas del examen simulado para ver tus resultados de prueba.", "Aviso");
        return;
      }

      // Evaluar respuestas
      let correctCount = 0;
      let gradableCount = 0;
      let reportHtml = "";

      partsData.forEach((part) => {
        reportHtml += `
          <div class="border-b border-indigo-100 pb-2 mb-2 mt-4 text-black">
            <h4 class="text-sm font-bold text-indigo-700">${escapeHTML(part.title)}</h4>
          </div>
          <div class="space-y-4">
        `;

        part.questions.forEach((q) => {
          const ans = simAnswers[q.id];
          let statusBadge = "";
          let comparisonDetails = "";

          if (q.type === 'short') {
            statusBadge = `
              <span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                <i class="fa-solid fa-circle-info"></i> Evaluación Manual
              </span>
            `;
            comparisonDetails = `
              <p class="text-xs text-gray-600 mt-1"><strong>Tu respuesta:</strong> ${escapeHTML(ans || "Sin respuesta")}</p>
            `;
          } else if (q.type === 'canvas') {
            statusBadge = `
              <span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                <i class="fa-solid fa-palette"></i> Evaluación Manual
              </span>
            `;
            comparisonDetails = `
              <div class="mt-2">
                <p class="text-xs text-gray-600"><strong>Tu lienzo:</strong></p>
                ${ans ? `<img src="${ans}" class="w-32 h-44 border border-gray-300 rounded shadow-sm mt-1 bg-white animate-pulse" />` : '<span class="text-xs text-rose-500">No dibujado</span>'}
              </div>
            `;
          } else {
            gradableCount++;
            let isCorrect = false;

            if (q.type === 'multiple' || q.type === 'boolean') {
              isCorrect = (String(ans).trim() === String(q.correct || "").trim());
              comparisonDetails = `
                <p class="text-xs text-gray-600 mt-1"><strong>Tu respuesta:</strong> ${escapeHTML(ans)}</p>
                <p class="text-xs text-gray-600"><strong>Respuesta correcta:</strong> ${escapeHTML(q.correct)}</p>
              `;
            } else if (q.type === 'programacion') {
              const respType = q.responseType || 'ide';
              if (respType === 'multiple' || respType === 'short') {
                isCorrect = (String(ans).trim() === String(q.correct || "").trim());
                comparisonDetails = `
                  <p class="text-xs text-gray-600 mt-1"><strong>Tu respuesta:</strong> ${escapeHTML(ans)}</p>
                  <p class="text-xs text-gray-600"><strong>Respuesta correcta:</strong> ${escapeHTML(q.correct)}</p>
                `;
              } else {
                // IDE mode
                if (ans && typeof ans === 'object') {
                  const compiledMatch = ans.compiledOutput && ans.compiledOutput.trim() === (q.correct || "").trim();
                  const sqlMatch = ans.sql && ans.sql.trim() === (q.correct || "").trim();
                  const jsMatch = ans.js && ans.js.trim() === (q.correct || "").trim();
                  const htmlMatch = ans.html && ans.html.trim() === (q.correct || "").trim();
                  const cssMatch = ans.css && ans.css.trim() === (q.correct || "").trim();

                  isCorrect = compiledMatch || sqlMatch || jsMatch || htmlMatch || cssMatch || (String(ans) === String(q.correct));
                } else if (ans) {
                  isCorrect = (String(ans).trim() === String(q.correct || "").trim());
                }

                const userRepr = ans && typeof ans === 'object' ? (ans.compiledOutput || ans.sql || ans.js || ans.html || "") : String(ans || "");
                comparisonDetails = `
                  <p class="text-xs text-gray-600 mt-1"><strong>Tu output o código:</strong></p>
                  <pre class="bg-slate-900 text-slate-300 p-2 rounded text-[10px] font-mono mt-1 overflow-x-auto max-w-full">${escapeHTML(userRepr || "Sin output compilado")}</pre>
                  <p class="text-xs text-gray-600 mt-1"><strong>Output o código correcto esperado:</strong></p>
                  <pre class="bg-slate-900 text-emerald-400 p-2 rounded text-[10px] font-mono mt-1 overflow-x-auto max-w-full">${escapeHTML(q.correct)}</pre>
                `;
              }
            }

            if (isCorrect) {
              correctCount++;
              statusBadge = `
                <span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  <i class="fa-solid fa-circle-check"></i> Correcto
                </span>
              `;
            } else {
              statusBadge = `
                <span class="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  <i class="fa-solid fa-circle-xmark"></i> Incorrecto
                </span>
              `;
            }
          }

          reportHtml += `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1 text-black">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <span class="text-xs font-semibold text-gray-700">Pregunta: ${escapeHTML(q.text)}</span>
                ${statusBadge}
              </div>
              ${comparisonDetails}
            </div>
          `;
        });

        reportHtml += `</div>`;
      });

      const scorePercent = gradableCount > 0 ? Math.round((correctCount / gradableCount) * 100) : 100;
      const scoreHtml = `
        <div class="text-center bg-indigo-50/60 p-5 rounded-2xl border border-indigo-100 mb-6 text-black">
          <p class="text-xs text-indigo-500 font-bold uppercase tracking-wider">Calificación Calificable</p>
          <p class="text-5xl font-extrabold text-indigo-700 mt-1">${correctCount} <span class="text-2xl text-indigo-400">/ ${gradableCount}</span></p>
          <p class="text-xs text-gray-500 mt-2 font-medium">Porcentaje de acierto: <strong class="text-indigo-600 font-bold">${scorePercent}%</strong></p>
        </div>
        <div class="space-y-4">
          ${reportHtml}
        </div>
      `;

      simResultsReport.innerHTML = scoreHtml;

      // Cambiar secciones visualmente
      simTechSection.classList.add('hidden');
      simCompletedSection.classList.remove('hidden');
    });
  }

  if (btnSimRestart) {
    btnSimRestart.addEventListener('click', () => {
      simAnswers = {};
      clearSimActiveIntervals();
      simTechSection.classList.remove('hidden');
      simCompletedSection.classList.add('hidden');
      renderSimulatedExam();
    });
  }

  // Inicializar
  await loadExams();
  goToStep(1);
});
