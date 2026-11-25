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
  const sectionsToggle = document.getElementById('toggle-sections');

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

  function normalizeUrl(url) {
    const trimmed = String(url || '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[\w-]+(\.[\w-]+)+([\/?#].*)?$/.test(trimmed)) return 'https://' + trimmed;
    return '';
  }

  const DEFAULT_PROJECT_CONFIG = {
    yesLabel: "Sí",
    noLabel: "No",
    descriptionLabel: "Descripción",
    linkLabel: "Link",
    technologiesLabel: "Tecnologías / Frameworks",
    addLabel: "Agregar otro proyecto"
  };

  function getProjectConfig(q) {
    const raw = (q && q.proyectosConfig) || {};
    const config = {};
    Object.keys(DEFAULT_PROJECT_CONFIG).forEach(key => {
      const value = typeof raw[key] === 'string' ? raw[key].trim() : '';
      config[key] = value || DEFAULT_PROJECT_CONFIG[key];
    });
    return config;
  }

  function normalizeQuestionData(q) {
    if (!q) return q;
    if (q.type === 'proyectos') {
      if (!String(q.text || '').trim()) q.text = "¿Has desarrollado proyectos?";
      q.proyectosConfig = getProjectConfig(q);
      if (!Array.isArray(q.options)) q.options = [];
      if (typeof q.correct !== 'string') q.correct = '';
    }
    if (q.type === 'programacion') {
      if (!q.responseType || q.responseType === 'ide') q.responseType = 'code';
      if (q.responseType === 'multiple' && (!Array.isArray(q.options) || q.options.length === 0)) {
        q.options = ["", "", "", ""];
      }
      if (typeof q.correct !== 'string') q.correct = '';
      if (typeof q.questionCode !== 'string') q.questionCode = '';
    }
    return q;
  }

  function normalizeSimProjectAnswer(raw) {
    const value = raw && typeof raw === 'object' ? raw : {};
    let projects = [];
    if (Array.isArray(value.projects)) {
      projects = value.projects;
    } else if (value.description || value.link || value.technologies) {
      projects = [value];
    }
    const hasProject = value.hasProject === true || value.hasProject === false ? value.hasProject : null;
    return {
      hasProject,
      projects: projects.length > 0 ? projects : [{ description: '', link: '', technologies: '' }]
    };
  }

  function simProjectRowHtml(qId, project = {}, config = DEFAULT_PROJECT_CONFIG) {
    return `
      <div class="sim-proj-row grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
        <textarea rows="1" class="sim-proj-description md:col-span-5 w-full min-h-[38px] px-3 py-2 rounded-xl border border-blue-100 text-xs focus:ring-2 focus:ring-blue-300 focus:outline-none resize-y text-black" placeholder="${escapeHTML(config.descriptionLabel)}" data-q-id="${qId}">${escapeHTML(project.description || '')}</textarea>
        <input type="url" class="sim-proj-link md:col-span-3 w-full h-[38px] px-3 py-2 rounded-xl border border-blue-100 text-xs focus:ring-2 focus:ring-blue-300 focus:outline-none text-black" placeholder="${escapeHTML(config.linkLabel)}" data-q-id="${qId}" value="${escapeHTML(project.link || '')}">
        <input type="text" class="sim-proj-tech md:col-span-3 w-full h-[38px] px-3 py-2 rounded-xl border border-blue-100 text-xs focus:ring-2 focus:ring-blue-300 focus:outline-none text-black" placeholder="${escapeHTML(config.technologiesLabel)}" data-q-id="${qId}" value="${escapeHTML(project.technologies || '')}">
        <button type="button" class="sim-proj-remove md:col-span-1 w-9 h-[38px] rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center justify-self-end md:justify-self-auto transition" title="Quitar proyecto">
          <i class="fa-solid fa-xmark text-xs"></i>
        </button>
      </div>
    `;
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
  const sidebarAddProyectosBtn = document.getElementById('sidebar-add-proyectos');

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

  if (sidebarAddProyectosBtn) {
    sidebarAddProyectosBtn.addEventListener('click', () => {
      if (partsData.length === 0) {
        showPastelAlert("Por favor, agrega al menos una sección primero antes de insertar una pregunta especial.", "Aviso");
        return;
      }
      if (lastActivePartIdx >= partsData.length) {
        lastActivePartIdx = partsData.length - 1;
      }
      addQuestionToPart(lastActivePartIdx, 'proyectos');

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
          partsData = (exam.parts || []).map(p => ({
            ...p,
            title: p.title || "",
            questions: (p.questions || []).map(normalizeQuestionData)
          }));
          if (partsData.length === 0) {
            partsData = [{ id: "part_" + Date.now(), title: "", questions: [] }];
          }
          lastActivePartIdx = 0;
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
      title: "",
      questions: []
    }];
    lastActivePartIdx = 0;
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
  function isSectionsMode() {
    if (partsData.length === 0) return false;
    return partsData.length > 1 || String(partsData[0].title || '').trim() !== '';
  }

  function ensureParts() {
    if (partsData.length === 0) {
      partsData = [{ id: "part_" + Date.now(), title: "", questions: [] }];
      lastActivePartIdx = 0;
    }
  }

  function enableSections() {
    ensureParts();
    partsData.forEach((part, idx) => {
      if (!String(part.title || '').trim()) part.title = `Sección ${idx + 1}`;
    });
    lastActivePartIdx = 0;
    renderParts();
  }

  function disableSections() {
    const flatten = () => {
      const questions = partsData.flatMap(p => p.questions || []);
      partsData = [{ id: "part_" + Date.now(), title: "", questions }];
      lastActivePartIdx = 0;
      renderParts();
    };
    if (partsData.length > 1) {
      showPastelConfirm("Al quitar las secciones, todas las preguntas se unirán en una sola lista. ¿Deseas continuar?", (accepted) => {
        if (accepted) {
          flatten();
        } else if (sectionsToggle) {
          sectionsToggle.checked = true;
        }
      }, "Quitar secciones");
    } else {
      flatten();
    }
  }

  if (sectionsToggle) {
    sectionsToggle.addEventListener('change', () => {
      if (sectionsToggle.checked) {
        enableSections();
      } else {
        disableSections();
      }
    });
  }

  btnAddPart.addEventListener('click', () => {
    ensureParts();
    if (!isSectionsMode()) {
      partsData[0].title = "Sección 1";
    }
    partsData.push({
      id: "part_" + Date.now(),
      title: `Sección ${partsData.length + 1}`,
      questions: []
    });
    lastActivePartIdx = partsData.length - 1;
    renderParts();
  });

  function renderParts() {
    ensureParts();
    const sectionsMode = isSectionsMode();
    if (!sectionsMode) lastActivePartIdx = 0;
    if (sectionsToggle) sectionsToggle.checked = sectionsMode;
    if (btnAddPart) btnAddPart.classList.toggle('hidden', !sectionsMode);

    partsContainer.innerHTML = "";

    partsData.forEach((part, partIdx) => {
      const isPartActive = partIdx === lastActivePartIdx;
      const sectionHeader = sectionsMode ? `
          <button type="button" class="btn-delete-part absolute top-4 right-4 text-rose-400 hover:text-rose-600 text-xs font-bold transition" data-idx="${partIdx}">
            <i class="fa-regular fa-trash-can mr-1"></i> Eliminar Sección
          </button>

          <div class="w-2/3">
            <label class="block text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Nombre de la Sección</label>
            <input
              type="text"
              value="${escapeHTML(part.title || '')}"
              class="part-title-input px-3 py-2 w-full border border-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded-xl text-sm font-semibold"
              data-idx="${partIdx}"
            >
          </div>
      ` : '';

      const partHtml = `
        <div class="p-6 rounded-3xl border shadow-sm space-y-4 relative transition-all duration-300 cursor-pointer ${isPartActive ? 'bg-white border-purple-300 ring-4 ring-purple-100' : 'bg-white/80 border-blue-100/70'}" data-part-id="${part.id}" data-idx="${partIdx}">
          ${sectionHeader}

          <div class="space-y-3 ${sectionsMode ? 'pt-2' : ''}">
            <span class="text-xs font-bold text-gray-600 block"><i class="fa-solid fa-clipboard-question text-blue-400 mr-1"></i> ${sectionsMode ? 'Enunciados / Preguntas' : 'Preguntas'}</span>

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
        if (e.target.closest('input, select, textarea, button, .drag-question-handle')) {
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
        const idx = parseInt(btn.getAttribute('data-idx'));
        partsData.splice(idx, 1);
        if (partsData.length === 0) {
          partsData = [{ id: "part_" + Date.now(), title: "", questions: [] }];
          lastActivePartIdx = 0;
        } else if (lastActivePartIdx >= partsData.length) {
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
      return `<div class="text-center py-4 bg-blue-50/10 rounded-xl border border-dashed border-blue-100 text-[11px] text-gray-400">No hay preguntas todavía.</div>`;
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
      } else if (q.type === 'proyectos') {
        const cfg = getProjectConfig(q);
        extraHtml = `
          <div class="mt-2 space-y-3">
            <div class="bg-blue-50/40 p-3 rounded-xl border border-blue-100 space-y-2">
              <span class="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">Personalizar etiquetas del candidato</span>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[9px] text-gray-500 block font-semibold">Botón "Sí"</label>
                  <input type="text" class="q-proj-config-input w-full px-2 py-1 border border-blue-100 focus:outline-none rounded-lg text-xs" data-part-idx="${partIdx}" data-q-idx="${qIdx}" data-config-key="yesLabel" value="${escapeHTML(cfg.yesLabel)}">
                </div>
                <div>
                  <label class="text-[9px] text-gray-500 block font-semibold">Botón "No"</label>
                  <input type="text" class="q-proj-config-input w-full px-2 py-1 border border-blue-100 focus:outline-none rounded-lg text-xs" data-part-idx="${partIdx}" data-q-idx="${qIdx}" data-config-key="noLabel" value="${escapeHTML(cfg.noLabel)}">
                </div>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="text-[9px] text-gray-500 block font-semibold">Etiqueta: Descripción</label>
                  <input type="text" class="q-proj-config-input w-full px-2 py-1 border border-blue-100 focus:outline-none rounded-lg text-xs" data-part-idx="${partIdx}" data-q-idx="${qIdx}" data-config-key="descriptionLabel" value="${escapeHTML(cfg.descriptionLabel)}">
                </div>
                <div>
                  <label class="text-[9px] text-gray-500 block font-semibold">Etiqueta: Link</label>
                  <input type="text" class="q-proj-config-input w-full px-2 py-1 border border-blue-100 focus:outline-none rounded-lg text-xs" data-part-idx="${partIdx}" data-q-idx="${qIdx}" data-config-key="linkLabel" value="${escapeHTML(cfg.linkLabel)}">
                </div>
                <div>
                  <label class="text-[9px] text-gray-500 block font-semibold">Etiqueta: Tecnologías</label>
                  <input type="text" class="q-proj-config-input w-full px-2 py-1 border border-blue-100 focus:outline-none rounded-lg text-xs" data-part-idx="${partIdx}" data-q-idx="${qIdx}" data-config-key="technologiesLabel" value="${escapeHTML(cfg.technologiesLabel)}">
                </div>
              </div>
              <div>
                <label class="text-[9px] text-gray-500 block font-semibold">Texto del botón para agregar otro proyecto</label>
                <input type="text" class="q-proj-config-input w-full px-2 py-1 border border-blue-100 focus:outline-none rounded-lg text-xs" data-part-idx="${partIdx}" data-q-idx="${qIdx}" data-config-key="addLabel" value="${escapeHTML(cfg.addLabel)}">
              </div>
            </div>

            <div class="space-y-2">
              <span class="text-[9px] font-bold text-blue-400 uppercase tracking-wider block">Vista previa</span>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2.5 py-0.5 rounded-lg bg-blue-500 text-white text-[9px] font-bold" data-preview-key="yesLabel">${escapeHTML(cfg.yesLabel)}</span>
                <span class="px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-500 text-[9px] font-bold" data-preview-key="noLabel">${escapeHTML(cfg.noLabel)}</span>
              </div>
              <div class="grid grid-cols-12 gap-2 items-start">
                <div class="col-span-5 h-9 rounded-lg border border-dashed border-blue-100 bg-blue-50/30 px-2 py-1.5 text-[9px] text-blue-500 truncate" data-preview-key="descriptionLabel">${escapeHTML(cfg.descriptionLabel)}</div>
                <div class="col-span-3 h-9 rounded-lg border border-dashed border-blue-100 bg-blue-50/30 px-2 py-1.5 text-[9px] text-blue-500 truncate" data-preview-key="linkLabel">${escapeHTML(cfg.linkLabel)}</div>
                <div class="col-span-3 h-9 rounded-lg border border-dashed border-blue-100 bg-blue-50/30 px-2 py-1.5 text-[9px] text-blue-500 truncate" data-preview-key="technologiesLabel">${escapeHTML(cfg.technologiesLabel)}</div>
                <div class="col-span-1 h-9 rounded-lg border border-dashed border-rose-100 bg-rose-50/30"></div>
              </div>
              <span class="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600"><i class="fa-solid fa-plus"></i> <span data-preview-key="addLabel">${escapeHTML(cfg.addLabel)}</span></span>
            </div>
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
        const respType = q.responseType === 'multiple' || q.responseType === 'short' ? q.responseType : 'code';
        extraHtml = `
          <div class="mt-2 text-[10px] text-indigo-600 bg-indigo-50 p-3 rounded-xl border border-indigo-100 space-y-3">
            <span class="font-bold flex items-center gap-1"><i class="fa-solid fa-code text-indigo-500"></i> Pregunta de Programación</span>

            <div class="space-y-1">
              <label class="block text-[9px] font-bold text-indigo-500 uppercase">Código en la Pregunta (opcional)</label>
              <textarea
                class="q-question-code-input font-mono w-full px-3 py-2 border border-indigo-200 focus:outline-none rounded-lg text-xs bg-slate-900 text-sky-400 h-20 custom-scroll"
                data-part-idx="${partIdx}"
                data-q-idx="${qIdx}"
                placeholder="Escribe aquí el código que verá el candidato..."
              >${q.questionCode || ''}</textarea>
            </div>

            <div class="space-y-1">
              <label class="block text-[9px] font-bold text-indigo-500 uppercase">Tipo de Respuesta</label>
              <select
                class="q-response-type-select px-2 py-1.5 border border-indigo-200 focus:outline-none rounded-lg text-xs bg-white w-full text-indigo-700 font-bold"
                data-part-idx="${partIdx}"
                data-q-idx="${qIdx}"
              >
                <option value="multiple" ${respType === 'multiple' ? 'selected' : ''}>Opción Múltiple (yo escribo el código)</option>
                <option value="code" ${respType === 'code' ? 'selected' : ''}>El candidato escribe código</option>
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
                  <label class="block text-[9px] font-bold text-indigo-500 uppercase">${respType === 'code' ? 'Código Correcto' : 'Respuesta Correcta'}</label>
                  <textarea
                    class="q-correct-code-input font-mono w-full px-3 py-1.5 border border-indigo-200 focus:outline-none rounded-lg text-xs bg-slate-900 text-emerald-400 h-16 custom-scroll"
                    data-part-idx="${partIdx}"
                    data-q-idx="${qIdx}"
                    placeholder="${respType === 'code' ? 'Escribe el código correcto...' : 'Escribe la respuesta exacta esperada...'}"
                  >${q.correct || ''}</textarea>
                </div>
              `}
            </div>

          </div>
        `;
      }

      return `
        <div class="q-card p-5 bg-blue-50/30 rounded-2xl border border-blue-100/40 relative space-y-3 shadow-sm hover:shadow transition duration-200" data-part-idx="${partIdx}" data-q-idx="${qIdx}">
          <!-- Move and Delete Actions -->
          <div class="absolute top-3 right-3 flex items-center gap-2 text-gray-400">
            <span class="drag-question-handle cursor-grab active:cursor-grabbing p-1 hover:text-indigo-600 transition" draggable="true" data-part-idx="${partIdx}" data-q-idx="${qIdx}" title="Arrastrar y soltar para reordenar">
              <i class="fa-solid fa-grip-vertical text-xs"></i>
            </span>
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
                q.type === 'multiple' ? 'bg-blue-100 text-blue-700' : q.type === 'boolean' ? 'bg-sky-100 text-sky-700' : q.type === 'short' ? 'bg-amber-100 text-amber-800' : q.type === 'canvas' ? 'bg-purple-100 text-purple-800' : q.type === 'proyectos' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'
              }">${q.type === 'multiple' ? 'Múltiple' : q.type === 'boolean' ? 'V / F' : q.type === 'short' ? 'Abierta' : q.type === 'canvas' ? 'Canvas (Ilustrador)' : q.type === 'proyectos' ? 'Proyectos' : 'Programación'}</span>
              <span class="text-xs text-gray-400 font-bold">Pregunta ${qIdx + 1}</span>
              <span class="text-[9px] text-gray-300 font-semibold hidden sm:inline"><i class="fa-solid fa-grip-vertical mr-0.5"></i> arrastra para mover</span>
            </div>
            <input
              type="text"
              value="${escapeHTML(q.text)}"
              class="q-text-input px-4 py-2.5 w-full border border-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded-xl text-sm font-semibold text-gray-800"
              data-part-idx="${partIdx}"
              data-q-idx="${qIdx}"
              placeholder="${q.type === 'proyectos' ? 'Escribe la pregunta que verá el candidato...' : 'Escribe el enunciado de la pregunta aquí...'}"
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
      qObj.responseType = "multiple";
      qObj.options = ["", "", "", ""];
    }
    if (type === 'proyectos') {
      qObj.text = "¿Has desarrollado proyectos?";
      qObj.proyectosConfig = { ...DEFAULT_PROJECT_CONFIG };
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

    document.querySelectorAll('.q-proj-config-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const partIdx = e.target.getAttribute('data-part-idx');
        const qIdx = e.target.getAttribute('data-q-idx');
        const key = e.target.getAttribute('data-config-key');
        const question = partsData[partIdx].questions[qIdx];
        question.proyectosConfig = question.proyectosConfig || { ...DEFAULT_PROJECT_CONFIG };
        question.proyectosConfig[key] = e.target.value;

        const card = e.target.closest('.q-card');
        if (card) {
          const fallback = DEFAULT_PROJECT_CONFIG[key] || '';
          card.querySelectorAll(`[data-preview-key="${key}"]`).forEach(el => {
            el.textContent = e.target.value.trim() || fallback;
          });
        }
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

    bindQuestionDragAndDrop();
  }

  let draggedQuestion = null;

  function moveQuestion(srcPartIdx, srcQIdx, dstPartIdx, dstQIdx, insertAfter) {
    const srcPart = partsData[srcPartIdx];
    const dstPart = partsData[dstPartIdx];
    if (!srcPart || !dstPart || !srcPart.questions[srcQIdx]) return;
    if (srcPartIdx === dstPartIdx && srcQIdx === dstQIdx) return;

    const [question] = srcPart.questions.splice(srcQIdx, 1);
    let insertAt = dstQIdx;
    if (srcPartIdx === dstPartIdx && srcQIdx < dstQIdx) insertAt--;
    if (insertAfter) insertAt++;
    insertAt = Math.max(0, Math.min(insertAt, dstPart.questions.length));
    dstPart.questions.splice(insertAt, 0, question);

    lastActivePartIdx = dstPartIdx;
    renderParts();
  }

  function moveQuestionToPartEnd(srcPartIdx, srcQIdx, dstPartIdx) {
    const srcPart = partsData[srcPartIdx];
    const dstPart = partsData[dstPartIdx];
    if (!srcPart || !dstPart || !srcPart.questions[srcQIdx]) return;

    const [question] = srcPart.questions.splice(srcQIdx, 1);
    dstPart.questions.push(question);
    lastActivePartIdx = dstPartIdx;
    renderParts();
  }

  function clearDragStyles() {
    document.querySelectorAll('.q-card').forEach(card => {
      card.classList.remove('opacity-40', 'ring-2', 'ring-purple-400', 'ring-offset-2');
    });
  }

  function bindQuestionDragAndDrop() {
    document.querySelectorAll('.drag-question-handle').forEach(handle => {
      handle.addEventListener('dragstart', (e) => {
        draggedQuestion = {
          partIdx: parseInt(handle.getAttribute('data-part-idx')),
          qIdx: parseInt(handle.getAttribute('data-q-idx'))
        };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(draggedQuestion));
        const card = handle.closest('.q-card');
        if (card) setTimeout(() => card.classList.add('opacity-40'), 0);
      });

      handle.addEventListener('dragend', () => {
        draggedQuestion = null;
        clearDragStyles();
      });
    });

    document.querySelectorAll('.q-card').forEach(card => {
      card.addEventListener('dragover', (e) => {
        if (!draggedQuestion) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('ring-2', 'ring-purple-400', 'ring-offset-2');
      });

      card.addEventListener('dragleave', (e) => {
        if (!card.contains(e.relatedTarget)) {
          card.classList.remove('ring-2', 'ring-purple-400', 'ring-offset-2');
        }
      });

      card.addEventListener('drop', (e) => {
        if (!draggedQuestion) return;
        e.preventDefault();
        e.stopPropagation();
        const dstPartIdx = parseInt(card.getAttribute('data-part-idx'));
        const dstQIdx = parseInt(card.getAttribute('data-q-idx'));
        const rect = card.getBoundingClientRect();
        const insertAfter = (e.clientY - rect.top) > (rect.height / 2);
        const source = draggedQuestion;
        draggedQuestion = null;
        clearDragStyles();
        moveQuestion(source.partIdx, source.qIdx, dstPartIdx, dstQIdx, insertAfter);
      });
    });

    document.querySelectorAll('.part-questions-list').forEach(list => {
      list.addEventListener('dragover', (e) => {
        if (!draggedQuestion) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      list.addEventListener('drop', (e) => {
        if (!draggedQuestion) return;
        e.preventDefault();
        const dstPartIdx = parseInt(list.getAttribute('data-idx'));
        const source = draggedQuestion;
        draggedQuestion = null;
        clearDragStyles();
        moveQuestionToPartEnd(source.partIdx, source.qIdx, dstPartIdx);
      });
    });
  }

  // Guardar Examen Técnico definitivo (Paso 3)
  btnSaveExam.addEventListener('click', async () => {
    const name = examNameInput.value.trim();
    const description = examDescInput.value.trim();

    ensureParts();
    const sectionsMode = isSectionsMode();
    partsData.forEach(part => (part.questions || []).forEach(normalizeQuestionData));

    // Validaciones
    for (const part of partsData) {
      if (sectionsMode && !String(part.title || '').trim()) {
        showAlert("Todas las secciones deben de tener nombre.", true);
        return;
      }
      if (part.questions.length === 0) {
        showAlert(sectionsMode ? `La sección "${part.title}" no contiene preguntas.` : "El examen no contiene preguntas.", true);
        return;
      }
      for (const q of part.questions) {
        if (q.type !== 'proyectos' && !(q.text || '').trim()) {
          showAlert(sectionsMode ? `La sección "${part.title}" tiene enunciados vacíos.` : "Hay enunciados vacíos en el examen.", true);
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
        if (q.type === 'programacion' && (q.responseType || 'code') === 'multiple') {
          if (!Array.isArray(q.options) || q.options.some(o => !String(o || '').trim())) {
            showAlert(`La pregunta "${q.text}" tiene opciones vacías.`, true);
            return;
          }
          if (!q.correct) {
            showAlert(`Selecciona la opción correcta para la pregunta: "${q.text}"`, true);
            return;
          }
        }
        if (q.type === 'programacion' && (q.responseType || 'code') === 'code' && !String(q.correct || '').trim()) {
          showAlert(`Escribe el código correcto para la pregunta: "${q.text}"`, true);
          return;
        }
      }
    }

    try {
      const existingExam = currentExamId ? allExams.find(e => e.id === currentExamId) : null;
      const payload = {
        name,
        description,
        is_psychometric: existingExam ? existingExam.is_psychometric === true : false,
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
          ${part.title ? `<h3 class="text-sm font-bold text-indigo-700 flex items-center gap-1.5 border-b border-indigo-100 pb-2">
            ${escapeHTML(part.title)}
          </h3>` : ''}
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
        } else if (q.type === 'proyectos') {
          const cfg = getProjectConfig(q);
          const projectState = normalizeSimProjectAnswer(null);
          const rowsHtml = projectState.projects.map(p => simProjectRowHtml(q.id, p, cfg)).join('');
          widget = `
            <div class="mt-2 space-y-2 sim-proj-block" data-q-id="${q.id}" data-has-project="">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-semibold text-gray-700">${escapeHTML(q.text || '¿Has desarrollado proyectos?')}</span>
                <button type="button" class="sim-proj-yes px-3 py-1 rounded-lg border text-[11px] font-bold transition bg-white text-gray-600 border-blue-100 hover:bg-blue-50" data-q-id="${q.id}">${escapeHTML(cfg.yesLabel)}</button>
                <button type="button" class="sim-proj-no px-3 py-1 rounded-lg border text-[11px] font-bold transition bg-white text-gray-600 border-slate-200 hover:bg-slate-50" data-q-id="${q.id}">${escapeHTML(cfg.noLabel)}</button>
              </div>
              <div class="sim-proj-list space-y-2 hidden" data-q-id="${q.id}">
                ${rowsHtml}
              </div>
              <button type="button" class="sim-proj-add hidden inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 mt-1" data-q-id="${q.id}">
                <i class="fa-solid fa-plus"></i> ${escapeHTML(cfg.addLabel)}
              </button>
            </div>
          `;
        } else if (q.type === 'programacion') {
          const respType = q.responseType === 'multiple' || q.responseType === 'short' ? q.responseType : 'code';

          let questionCodeHtml = "";
          if (q.questionCode && q.questionCode.trim()) {
            questionCodeHtml = `
              <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-sky-300 max-h-80 overflow-y-auto whitespace-pre-wrap relative shadow-inner no-scrollbar">
                <div class="flex items-center border-b border-slate-800 pb-1.5 mb-2 select-none">
                  <span class="text-slate-500 text-[10px] uppercase font-extrabold tracking-wider">Código</span>
                </div>
                <code>${highlightCode(q.questionCode)}</code>
              </div>
            `;
          }

          if (respType === 'multiple') {
            widget = `
              ${questionCodeHtml ? `
                <div class="programacion-container mt-3 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col text-white relative mb-4" data-q-id="${q.id}">
                  ${questionCodeHtml}
                </div>
              ` : ''}

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
                ${questionCodeHtml}

                <div class="space-y-1">
                  <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Escribe tu respuesta:</label>
                  <textarea rows="3" class="sim-tech-textarea-input w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 focus:ring-1 focus:ring-indigo-500 focus:outline-none custom-scroll" data-q-id="${q.id}"></textarea>
                </div>
              </div>
            `;
          } else {
            widget = `
              <div class="programacion-container mt-3 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col gap-4 text-white relative" data-q-id="${q.id}">
                ${questionCodeHtml}

                <div class="space-y-1">
                  <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Escribe tu código:</label>
                  <textarea rows="10" class="sim-tech-code-input w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 focus:ring-1 focus:ring-indigo-500 focus:outline-none custom-scroll" data-q-id="${q.id}" spellcheck="false"></textarea>
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
            ${q.type === 'proyectos' ? '' : `<span class="text-sm font-semibold text-gray-800 block mb-1.5 leading-relaxed">Pregunta: ${escapeHTML(q.text)}</span>`}
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

    document.querySelectorAll('.sim-tech-code-input').forEach(ta => {
      ta.addEventListener('input', () => {
        const qId = ta.getAttribute('data-q-id');
        const val = ta.value;
        if (val.trim()) {
          simAnswers[qId] = val;
        } else {
          delete simAnswers[qId];
        }
        const total = Object.keys(simAnswers).length;
        updateSimProgress(total, qCount);
      });
    });

    document.querySelectorAll('.sim-proj-block').forEach(block => {
      const qId = block.getAttribute('data-q-id');
      const list = block.querySelector('.sim-proj-list');
      const addBtn = block.querySelector('.sim-proj-add');
      const projectQuestion = partsData.flatMap(p => p.questions || []).find(item => item.id === qId);
      const projectConfig = getProjectConfig(projectQuestion);

      const sync = () => {
        const hasProject = block.getAttribute('data-has-project');
        if (hasProject === 'false') {
          simAnswers[qId] = { hasProject: false, projects: [] };
        } else if (hasProject === 'true') {
          const projects = [...list.querySelectorAll('.sim-proj-row')].map(row => ({
            description: row.querySelector('.sim-proj-description').value.trim(),
            link: row.querySelector('.sim-proj-link').value.trim(),
            technologies: row.querySelector('.sim-proj-tech').value.trim()
          })).filter(p => p.description || p.link || p.technologies);
          if (projects.length > 0) {
            simAnswers[qId] = { hasProject: true, projects };
          } else {
            delete simAnswers[qId];
          }
        } else {
          delete simAnswers[qId];
        }
        updateSimProgress(Object.keys(simAnswers).length, qCount);
      };

      const updateRemoveButtons = () => {
        const rows = [...list.querySelectorAll('.sim-proj-row')];
        rows.forEach(row => {
          const btn = row.querySelector('.sim-proj-remove');
          if (btn) btn.classList.toggle('invisible', rows.length <= 1);
        });
      };

      const applyChoice = (choice) => {
        block.setAttribute('data-has-project', choice === 'yes' ? 'true' : 'false');
        const yesBtn = block.querySelector('.sim-proj-yes');
        const noBtn = block.querySelector('.sim-proj-no');
        yesBtn.className = choice === 'yes'
          ? 'sim-proj-yes px-3 py-1 rounded-lg border text-[11px] font-bold transition bg-blue-500 text-white border-blue-500 shadow-sm'
          : 'sim-proj-yes px-3 py-1 rounded-lg border text-[11px] font-bold transition bg-white text-gray-600 border-blue-100 hover:bg-blue-50';
        noBtn.className = choice === 'no'
          ? 'sim-proj-no px-3 py-1 rounded-lg border text-[11px] font-bold transition bg-slate-600 text-white border-slate-600 shadow-sm'
          : 'sim-proj-no px-3 py-1 rounded-lg border text-[11px] font-bold transition bg-white text-gray-600 border-slate-200 hover:bg-slate-50';
        list.classList.toggle('hidden', choice !== 'yes');
        addBtn.classList.toggle('hidden', choice !== 'yes');
        if (choice === 'yes' && !list.querySelector('.sim-proj-row')) {
          list.insertAdjacentHTML('beforeend', simProjectRowHtml(qId, {}, projectConfig));
        }
        updateRemoveButtons();
        sync();
      };

      block.querySelector('.sim-proj-yes').addEventListener('click', () => applyChoice('yes'));
      block.querySelector('.sim-proj-no').addEventListener('click', () => applyChoice('no'));

      addBtn.addEventListener('click', () => {
        list.insertAdjacentHTML('beforeend', simProjectRowHtml(qId, {}, projectConfig));
        updateRemoveButtons();
        sync();
        const rows = list.querySelectorAll('.sim-proj-row');
        const last = rows[rows.length - 1];
        if (last) last.querySelector('.sim-proj-description').focus();
      });

      list.addEventListener('input', sync);

      list.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.sim-proj-remove');
        if (!removeBtn) return;
        if (list.querySelectorAll('.sim-proj-row').length <= 1) return;
        removeBtn.closest('.sim-proj-row').remove();
        updateRemoveButtons();
        sync();
      });

      updateRemoveButtons();
    });

    // Initialize Interactive Canvas and Programming environments
    partsData.forEach(part => {
      part.questions.forEach(q => {
        if (q.type === 'canvas') {
          initSimIllustratorCanvas(q.id);
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

  if (btnSimSubmit) {
    btnSimSubmit.addEventListener('click', () => {
      const missingRequired = partsData.reduce((acc, p) =>
        acc + p.questions.filter(q => {
          const ans = simAnswers[q.id];
          if (q.type === 'proyectos') {
            if (!ans || typeof ans !== 'object' || (ans.hasProject !== true && ans.hasProject !== false)) return true;
            if (ans.hasProject === true) {
              const projects = Array.isArray(ans.projects)
                ? ans.projects.filter(p => p.description || p.link || p.technologies)
                : [];
              return projects.length === 0;
            }
            return false;
          }
          return !ans;
        }).length, 0);
      if (missingRequired > 0) {
        showPastelAlert("Por favor, responde todas las preguntas del examen simulado para ver tus resultados de prueba.", "Aviso");
        return;
      }

      // Evaluar respuestas
      let correctCount = 0;
      let gradableCount = 0;
      let reportHtml = "";

      partsData.forEach((part) => {
        reportHtml += `
          ${part.title ? `<div class="border-b border-indigo-100 pb-2 mb-2 mt-4 text-black">
            <h4 class="text-sm font-bold text-indigo-700">${escapeHTML(part.title)}</h4>
          </div>` : ''}
          <div class="space-y-4">
        `;

        part.questions.forEach((q) => {
          const ans = simAnswers[q.id];
          let statusBadge = "";
          let comparisonDetails = "";
          let simProgrammingSimilarity = null;

          if (q.type === 'short') {
            statusBadge = `
              <span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                <i class="fa-solid fa-circle-info"></i> Evaluación Manual
              </span>
            `;
            comparisonDetails = `
              <p class="text-xs text-gray-600 mt-1"><strong>Tu respuesta:</strong> ${escapeHTML(ans || "Sin respuesta")}</p>
            `;
          } else if (q.type === 'proyectos') {
            const cfg = getProjectConfig(q);
            const raw = ans && typeof ans === 'object' ? ans : {};
            let projects = [];
            if (Array.isArray(raw.projects)) {
              projects = raw.projects;
            } else if (raw.description || raw.link || raw.technologies) {
              projects = [raw];
            }
            projects = projects.filter(p => p && (p.description || p.link || p.technologies));
            statusBadge = `
              <span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                <i class="fa-solid fa-folder-open"></i> Evaluación Manual
              </span>
            `;
            if (raw.hasProject === false) {
              comparisonDetails = `<p class="text-xs text-gray-600 mt-1">Respuesta: <strong>${escapeHTML(cfg.noLabel)}</strong></p>`;
            } else if (projects.length === 0) {
              comparisonDetails = `<p class="text-xs text-gray-400 mt-1">Sin respuesta</p>`;
            } else {
              comparisonDetails = projects.map((project, pIdx) => {
                const linkUrl = normalizeUrl(project.link);
                return `
                  <div class="mt-2 bg-blue-50/40 p-2.5 rounded-xl border border-blue-100 space-y-1">
                    <span class="text-[9px] font-bold text-blue-500 uppercase tracking-wide block">Proyecto ${pIdx + 1}</span>
                    <p class="text-xs text-gray-600"><strong>${escapeHTML(cfg.descriptionLabel)}:</strong> ${escapeHTML(project.description || "Sin respuesta")}</p>
                    <p class="text-xs text-gray-600"><strong>${escapeHTML(cfg.linkLabel)}:</strong> ${linkUrl ? `<a href="${escapeHTML(linkUrl)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline break-all">${escapeHTML(project.link)}</a>` : escapeHTML(project.link || "Sin respuesta")}</p>
                    <p class="text-xs text-gray-600"><strong>${escapeHTML(cfg.technologiesLabel)}:</strong> ${escapeHTML(project.technologies || "Sin respuesta")}</p>
                  </div>
                `;
              }).join('');
            }
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
              if (ans && typeof ans === 'object') {
                const compiledMatch = ans.compiledOutput && ans.compiledOutput.trim() === (q.correct || "").trim();
                const sqlMatch = ans.sql && ans.sql.trim() === (q.correct || "").trim();
                const jsMatch = ans.js && ans.js.trim() === (q.correct || "").trim();
                const htmlMatch = ans.html && ans.html.trim() === (q.correct || "").trim();
                const cssMatch = ans.css && ans.css.trim() === (q.correct || "").trim();

                isCorrect = compiledMatch || sqlMatch || jsMatch || htmlMatch || cssMatch || (String(ans) === String(q.correct));

                const expectedCode = String(q.correct || '').trim();
                const candidateCodes = [ans.sql, ans.js, ans.html, ans.css, ans.compiledOutput]
                  .filter(c => c && String(c).trim());
                if (expectedCode && candidateCodes.length) {
                  simProgrammingSimilarity = Math.max(...candidateCodes.map(c => window.calculateCodeSimilarity(expectedCode, c)));
                } else if (expectedCode || candidateCodes.length) {
                  simProgrammingSimilarity = 0;
                }

                const fullCodeParts = [];
                if (ans.html) fullCodeParts.push(`HTML:\n${ans.html}`);
                if (ans.css) fullCodeParts.push(`CSS:\n${ans.css}`);
                if (ans.js) fullCodeParts.push(`JS:\n${ans.js}`);
                if (ans.sql) fullCodeParts.push(`SQL:\n${ans.sql}`);
                const fullCode = fullCodeParts.join('\n\n');
                const similarityValue = simProgrammingSimilarity ?? 0;
                comparisonDetails = `
                  <div class="mt-2 bg-indigo-50 p-2.5 rounded-xl border border-indigo-100">
                    <div class="flex items-center justify-between">
                      <span class="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Similitud de sintaxis</span>
                      <span class="text-sm font-extrabold text-indigo-700">${similarityValue}%</span>
                    </div>
                    <div class="w-full bg-indigo-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                      <div class="bg-indigo-500 h-1.5 rounded-full" style="width: ${similarityValue}%"></div>
                    </div>
                  </div>
                  <p class="text-xs text-gray-600 mt-1"><strong>Tu código:</strong></p>
                  <pre class="bg-slate-900 text-slate-300 p-2 rounded text-[10px] font-mono mt-1 overflow-x-auto max-w-full">${escapeHTML(fullCode || "Sin código")}</pre>
                  <p class="text-xs text-gray-600 mt-1"><strong>Código correcto esperado:</strong></p>
                  <pre class="bg-slate-900 text-emerald-400 p-2 rounded text-[10px] font-mono mt-1 overflow-x-auto max-w-full">${escapeHTML(q.correct || "Sin código")}</pre>
                `;
              } else {
                const answerText = typeof ans === 'string' ? ans.trim() : '';
                isCorrect = answerText !== '' && answerText === String(q.correct || '').trim();
                const expectedCode = String(q.correct || '').trim();
                if (expectedCode && answerText) {
                  simProgrammingSimilarity = window.calculateCodeSimilarity(expectedCode, answerText);
                } else if (expectedCode || answerText) {
                  simProgrammingSimilarity = 0;
                }
                const similarityValue = simProgrammingSimilarity ?? 0;
                comparisonDetails = `
                  <div class="mt-2 bg-indigo-50 p-2.5 rounded-xl border border-indigo-100">
                    <div class="flex items-center justify-between">
                      <span class="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Similitud de sintaxis</span>
                      <span class="text-sm font-extrabold text-indigo-700">${similarityValue}%</span>
                    </div>
                    <div class="w-full bg-indigo-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                      <div class="bg-indigo-500 h-1.5 rounded-full" style="width: ${similarityValue}%"></div>
                    </div>
                  </div>
                  <p class="text-xs text-gray-600 mt-1"><strong>Tu código:</strong></p>
                  <pre class="bg-slate-900 text-slate-300 p-2 rounded text-[10px] font-mono mt-1 overflow-x-auto max-w-full">${escapeHTML(answerText || "Sin código")}</pre>
                  <p class="text-xs text-gray-600 mt-1"><strong>Código correcto esperado:</strong></p>
                  <pre class="bg-slate-900 text-emerald-400 p-2 rounded text-[10px] font-mono mt-1 overflow-x-auto max-w-full">${escapeHTML(q.correct || "Sin código")}</pre>
                `;
              }
            }

            const isCodeLike = q.type === 'programacion' && q.responseType !== 'multiple' && q.responseType !== 'short';
            if (isCodeLike) {
              if (isCorrect) correctCount++;
              statusBadge = `
                <span class="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  <i class="fa-solid fa-code"></i> Similitud ${simProgrammingSimilarity ?? 0}%
                </span>
              `;
            } else if (isCorrect) {
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
                <span class="text-xs font-semibold text-gray-700">Pregunta: ${escapeHTML(q.text || (q.type === 'proyectos' ? '¿Has desarrollado proyectos?' : ''))}</span>
                ${statusBadge}
              </div>
              ${comparisonDetails}
            </div>
          `;
        });

        reportHtml += `</div>`;
      });

      const scorePercent = gradableCount > 0 ? Math.round((correctCount / gradableCount) * 100) : 0;
      const scoreHtml = gradableCount > 0 ? `
        <div class="text-center bg-indigo-50/60 p-5 rounded-2xl border border-indigo-100 mb-6 text-black">
          <p class="text-xs text-indigo-500 font-bold uppercase tracking-wider">Calificación Calificable</p>
          <p class="text-5xl font-extrabold text-indigo-700 mt-1">${correctCount} <span class="text-2xl text-indigo-400">/ ${gradableCount}</span></p>
          <p class="text-xs text-gray-500 mt-2 font-medium">Porcentaje de acierto: <strong class="text-indigo-600 font-bold">${scorePercent}%</strong></p>
        </div>
        <div class="space-y-4">
          ${reportHtml}
        </div>
      ` : `
        <div class="text-center bg-indigo-50/60 p-5 rounded-2xl border border-indigo-100 mb-6 text-black">
          <p class="text-xs text-indigo-500 font-bold uppercase tracking-wider">Evaluación cualitativa</p>
          <p class="text-sm text-gray-500 mt-2 font-medium">Este examen no tiene preguntas calificables.</p>
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
