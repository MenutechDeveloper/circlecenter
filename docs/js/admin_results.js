// JS para la visualización de resultados e historial (admin_results.js)
document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAdminAuth()) return;

  // Elementos DOM
  const resultsTableBody = document.getElementById('results-table-body');
  const resultsSearch = document.getElementById('results-search');
  const filterVacancy = document.getElementById('filter-vacancy');
  const refreshResultsBtn = document.getElementById('refresh-results-btn');

  // Modal Detail DOM
  const resultModal = document.getElementById('result-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCloseBottomBtn = document.getElementById('modal-close-bottom-btn');
  const modalPrintBtn = document.getElementById('modal-print-btn');
  const modalDeleteBtn = document.getElementById('modal-delete-btn');
  const modalCandName = document.getElementById('modal-cand-name');
  const modalCandPos = document.getElementById('modal-cand-pos');
  const modalCandScore = document.getElementById('modal-cand-score');
  const modalCandPercentage = document.getElementById('modal-cand-percentage');
  const modalCandInfoFields = document.getElementById('modal-cand-info-fields');
  const modalAIDetector = document.getElementById('modal-ai-detector');
  const modalTabPsyBtn = document.getElementById('modal-tab-psy-btn');
  const modalTabTechBtn = document.getElementById('modal-tab-tech-btn');
  const modalAnswersPsy = document.getElementById('modal-answers-psy');
  const modalAnswersTech = document.getElementById('modal-answers-tech');

  let allResults = [];
  let distinctVacancies = new Set();
  let activeReport = null; // Guardar reporte actual abierto en el modal
  let allAvailableExams = []; // Todos los exámenes disponibles para asignar extra

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

  function getQuestionText(q) {
    if (!q) return '';
    if (q.type === 'programacion' && q.questionCode && String(q.questionCode).trim()) {
      const text = String(q.text || '').trim();
      const code = String(q.questionCode).trim();
      if (!text.includes(code)) return [text, code].filter(Boolean).join('\n\n');
    }
    return String(q.text || '');
  }

  // Cargar resultados
  async function loadResults() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('results')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      allResults = data || [];

      // Extraer filtros de vacante
      distinctVacancies.clear();
      allResults.forEach(r => {
        if (r.assigned_exam_name) distinctVacancies.add(r.assigned_exam_name);
      });

      populateVacancyFilter();
      renderResults();
      await loadAvailableExamsForAssign();
    } catch (err) {
      console.error(err);
    }
  }

  // Cargar exámenes para el selector modal de asignación extra
  async function loadAvailableExamsForAssign() {
    try {
      const { data, error } = await supabaseClient
        .from('exams')
        .select('*')
        .eq('is_psychometric', false)
        .order('name', { ascending: true });

      if (error) throw error;
      allAvailableExams = data || [];

      const select = document.getElementById('modal-assign-extra-select');
      if (select) {
        select.innerHTML = '<option value="">-- Elige Examen Técnico --</option>';
        allAvailableExams.forEach(exam => {
          select.innerHTML += `<option value="${exam.id}">${exam.name}</option>`;
        });
      }
    } catch (err) {
      console.error("Error al obtener exámenes:", err);
    }
  }

  function populateVacancyFilter() {
    filterVacancy.innerHTML = '<option value="">Todas las vacantes</option>';
    distinctVacancies.forEach(vac => {
      filterVacancy.innerHTML += `<option value="${vac}">${vac}</option>`;
    });
  }

  function renderResults() {
    resultsTableBody.innerHTML = "";

    const query = resultsSearch.value.toLowerCase().trim();
    const vacancySel = filterVacancy.value;

    const filtered = allResults.filter(res => {
      const matchesSearch = res.candidate_name.toLowerCase().includes(query) ||
                            (res.candidate_email && res.candidate_email.toLowerCase().includes(query)) ||
                            (res.assigned_exam_name && res.assigned_exam_name.toLowerCase().includes(query));

      const matchesVacancy = vacancySel === "" || res.assigned_exam_name === vacancySel;

      return matchesSearch && matchesVacancy;
    });

    if (filtered.length === 0) {
      resultsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-12 text-gray-400">
            <i class="fa-solid fa-filter text-4xl mb-2 text-blue-100 block"></i>
            No se encontraron aspirantes con los filtros configurados.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(res => {
      const date = new Date(res.created_at).toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const scoreText = res.max_score > 0 ? `${res.score} / ${res.max_score}` : 'Cualitativa';
      const scorePercent = res.max_score > 0 ? Math.round((res.score / res.max_score) * 100) : 100;

      let badgeColor = res.max_score > 0
        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
        : "bg-blue-50 text-blue-700 border border-blue-100";
      if (res.max_score > 0) {
        if (scorePercent < 60) badgeColor = "bg-rose-50 text-rose-700 border border-rose-100";
        else if (scorePercent < 80) badgeColor = "bg-amber-50 text-amber-700 border border-amber-100";
      }

      resultsTableBody.innerHTML += `
        <tr class="hover:bg-blue-50/20 transition">
          <td class="py-4 px-4 font-bold text-gray-800">
            ${res.candidate_name}
          </td>
          <td class="py-4 px-4 text-xs">
            <div class="text-gray-700">${res.candidate_email || 'N/A'}</div>
            <div class="text-gray-400">${res.candidate_phone || 'N/A'}</div>
          </td>
          <td class="py-4 px-4">
            <span class="font-semibold text-blue-600 text-xs">${res.assigned_exam_name || 'Examen Técnico'}</span>
          </td>
          <td class="py-4 px-4 text-center">
            <span class="text-xs px-2 py-1 font-bold rounded-full ${badgeColor}">
              ${scoreText} ${res.max_score > 0 ? `(${scorePercent}%)` : ''}
            </span>
          </td>
          <td class="py-4 px-4 text-center text-xs text-gray-400">
            ${date}
          </td>
          <td class="py-4 px-4 text-right">
            <div class="flex items-center justify-end gap-2">
              <button class="view-report-btn px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-xs transition" data-id="${res.id}">
                <i class="fa-regular fa-id-card mr-1"></i> Ver Reporte
              </button>
              <button class="delete-report-btn px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition" data-id="${res.id}" title="Eliminar registro">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    // Bind Detail view click
    document.querySelectorAll('.view-report-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const report = allResults.find(r => r.id === id);
        if (report) showReportModal(report);
      });
    });

    // Bind Delete click
    document.querySelectorAll('.delete-report-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const report = allResults.find(r => r.id === id);
        if (!report) return;
        showPastelConfirm(
          `¿Eliminar el registro de "${escapeHTML(report.candidate_name)}"? Esta acción no se puede deshacer.`,
          (confirmed) => { if (confirmed) deleteResult(id); },
          "Eliminar Registro"
        );
      });
    });
  }

  async function deleteResult(id) {
    try {
      const { error } = await supabaseClient
        .from('results')
        .delete()
        .eq('id', id);

      if (error) throw error;

      allResults = allResults.filter(r => r.id !== id);
      distinctVacancies.clear();
      allResults.forEach(r => {
        if (r.assigned_exam_name) distinctVacancies.add(r.assigned_exam_name);
      });
      populateVacancyFilter();
      renderResults();
      showPastelAlert("Registro eliminado correctamente.");
    } catch (err) {
      console.error(err);
      showPastelAlert("No se pudo eliminar el registro: " + err.message);
    }
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round((ms || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    try {
      return date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return date.toLocaleString();
    }
  }

  function renderAIDetector(report) {
    if (!modalAIDetector) return;

    const ai = report.ai_metrics;
    const exams = ai && Array.isArray(ai.exams) ? ai.exams.filter(Boolean) : [];

    if (!ai || !ai.enabled || exams.length === 0) {
      modalAIDetector.classList.add('hidden');
      modalAIDetector.innerHTML = '';
      return;
    }

    let html = '';

    exams.forEach(exam => {
      const copiedQuestions = Array.isArray(exam.copiedQuestions) ? exam.copiedQuestions.filter(Boolean) : [];
      const questionTimes = Array.isArray(exam.questionTimes) ? exam.questionTimes.filter(Boolean) : [];

      html += `
        <div class="bg-white rounded-xl border border-violet-100 border-l-4 border-l-violet-400 p-3 space-y-2">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <h5 class="text-[11px] font-bold text-gray-800"><i class="fa-solid fa-file-shield text-violet-500 mr-1"></i> ${escapeHTML(exam.examName || 'Examen')}</h5>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[9px] font-bold text-gray-400">Tiempo total: ${formatDuration(exam.totalMs)}</span>
              ${exam.lastAbandonAt && formatDateTime(exam.lastAbandonAt) ? `<span class="text-[9px] font-bold text-violet-500"><i class="fa-solid fa-door-open mr-1"></i>Última salida: ${escapeHTML(formatDateTime(exam.lastAbandonAt))}</span>` : ''}
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
            <div class="bg-gray-50 rounded-lg p-2">
              <span class="block text-gray-400 font-bold uppercase text-[8px]">Pestañas</span>
              <span class="font-extrabold text-gray-700">${exam.tabSwitches || 0}</span>
            </div>
            <div class="bg-gray-50 rounded-lg p-2">
              <span class="block text-gray-400 font-bold uppercase text-[8px]">Salidas</span>
              <span class="font-extrabold text-gray-700">${exam.pageAbandons || 0}</span>
            </div>
            <div class="bg-gray-50 rounded-lg p-2">
              <span class="block text-gray-400 font-bold uppercase text-[8px]">Copias</span>
              <span class="font-extrabold text-gray-700">${exam.copyCount || 0}</span>
            </div>
            <div class="bg-gray-50 rounded-lg p-2">
              <span class="block text-gray-400 font-bold uppercase text-[8px]">Pegados bloqueados</span>
              <span class="font-extrabold text-gray-700">${exam.pasteAttempts || 0}</span>
            </div>
          </div>

          ${copiedQuestions.length > 0 ? `
            <div class="bg-amber-50 rounded-lg p-2 text-[10px] text-amber-800">
              <span class="font-bold">Preguntas copiadas (${copiedQuestions.length}):</span>
              <ul class="list-disc pl-4 mt-1 space-y-0.5">
                ${copiedQuestions.map(item => `<li>${escapeHTML((item.questionText || 'Pregunta').slice(0, 100))} <span class="text-amber-500">(${item.count || 1}x)</span></li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${questionTimes.length > 0 ? `
            <details class="text-[10px]">
              <summary class="cursor-pointer font-bold text-blue-600 select-none">Ver tiempo por pregunta</summary>
              <div class="mt-2 overflow-x-auto custom-scroll">
                <table class="w-full text-left">
                  <thead>
                    <tr class="text-gray-400 border-b border-blue-50">
                      <th class="py-1 pr-2 font-bold">#</th>
                      <th class="py-1 pr-2 font-bold">Pregunta</th>
                      <th class="py-1 pr-2 font-bold whitespace-nowrap">En pantalla</th>
                      <th class="py-1 font-bold whitespace-nowrap">Hasta responder</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${questionTimes.map(item => `
                      <tr class="border-b border-blue-50/60 align-top">
                        <td class="py-1 pr-2 text-gray-400 font-bold">${item.questionNumber}</td>
                        <td class="py-1 pr-2 text-gray-600">${escapeHTML((item.questionText || '').slice(0, 80))}</td>
                        <td class="py-1 pr-2 text-gray-700 whitespace-nowrap">${formatDuration(item.visibleMs)}</td>
                        <td class="py-1 text-gray-700 whitespace-nowrap">${item.timeToAnswerMs !== null && item.timeToAnswerMs !== undefined ? formatDuration(item.timeToAnswerMs) : '<span class="text-gray-400">Sin responder</span>'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </details>
          ` : ''}
        </div>
      `;
    });

    modalAIDetector.innerHTML = html;
    modalAIDetector.classList.remove('hidden');
  }

  function isTechnicalAnswerCorrect(q) {
    if (q.type === 'programacion') {
      if (q.userAnswer && typeof q.userAnswer === 'object') {
        const ansObj = q.userAnswer;
        const compiledMatch = ansObj.compiledOutput && ansObj.compiledOutput.trim() === (q.correct || "").trim();
        const sqlMatch = ansObj.sql && ansObj.sql.trim() === (q.correct || "").trim();
        const jsMatch = ansObj.js && ansObj.js.trim() === (q.correct || "").trim();
        const htmlMatch = ansObj.html && ansObj.html.trim() === (q.correct || "").trim();
        const cssMatch = ansObj.css && ansObj.css.trim() === (q.correct || "").trim();
        return compiledMatch || sqlMatch || jsMatch || htmlMatch || cssMatch || (String(q.userAnswer) === String(q.correct));
      }
      const ans = typeof q.userAnswer === 'string' ? q.userAnswer.trim() : "";
      if (ans === "") return null;
      return ans === (q.correct || "").trim();
    }
    const ans = typeof q.userAnswer === 'string' ? q.userAnswer.trim() : "";
    if (ans === "") return null;
    return ans === q.correct;
  }

  function calculateTechnicalScore(technicalAnswers) {
    let correct = 0;
    let incorrect = 0;
    let empty = 0;
    let total = 0;
    const parts = (technicalAnswers && technicalAnswers.parts) || [];
    parts.forEach(part => {
      (part.questions || []).forEach(q => {
        const isGradable = q.type === 'multiple' || q.type === 'boolean' || q.type === 'programacion';
        if (!isGradable) return;
        total++;
        const result = isTechnicalAnswerCorrect(q);
        if (result === null) empty++;
        else if (result) correct++;
        else incorrect++;
      });
    });
    return {
      correct,
      incorrect,
      empty,
      total,
      scorePct: total > 0 ? Math.round((correct / total) * 100) : 100
    };
  }

  function showReportModal(report) {
    activeReport = report;
    modalCandName.textContent = report.candidate_name;
    modalCandPos.textContent = `Vacante de Interés: ${report.assigned_exam_name || 'General'}`;

    const score = calculateTechnicalScore(report.technical_answers);
    if (score.total > 0) {
      modalCandScore.textContent = `${score.correct} bien, ${score.incorrect} mal, ${score.empty} vacías de ${score.total}`;
      modalCandPercentage.textContent = `${score.scorePct}%`;
    } else {
      modalCandScore.textContent = "Evaluación cualitativa";
      modalCandPercentage.textContent = "—";
    }

    // Métricas del Detector de IA (si aplica)
    renderAIDetector(report);

    // Formulario de Registro Dinámico render
    modalCandInfoFields.innerHTML = "";
    const info = report.candidate_info || {};
    const infoKeys = Object.keys(info);

    if (infoKeys.length === 0) {
      modalCandInfoFields.innerHTML = '<span class="text-gray-400 col-span-2">No se capturó información adicional de formulario.</span>';
    } else {
      infoKeys.forEach(key => {
        const cleanKey = key.replace(/_/g, ' ').toUpperCase();
        modalCandInfoFields.innerHTML += `
          <div class="bg-white p-2 rounded-xl border border-blue-50 shadow-sm">
            <strong class="text-[9px] text-blue-400 uppercase block">${cleanKey}</strong>
            <span class="text-xs font-semibold text-gray-700">${info[key]}</span>
          </div>
        `;
      });
    }

    // Renderizar secciones de examen
    renderAnswers(modalAnswersPsy, report.psychometric_answers);
    renderAnswers(modalAnswersTech, report.technical_answers, { editable: true });

    // Resetear Tabs
    modalTabPsyBtn.className = "pb-2 px-4 border-b-2 border-blue-500 text-blue-600 font-bold text-sm";
    modalTabTechBtn.className = "pb-2 px-4 border-b-2 border-transparent text-gray-500 font-bold text-sm hover:text-blue-600";
    modalAnswersPsy.classList.remove('hidden');
    modalAnswersTech.classList.add('hidden');

    resultModal.classList.remove('hidden');
  }

  function renderAnswers(container, answersData, options = {}) {
    const editable = !!options.editable;
    container.innerHTML = "";
    const parts = (answersData && answersData.parts) || [];
    if (parts.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-gray-400 text-xs">No hay respuestas cargadas para este bloque.</div>`;
      return;
    }

    parts.forEach((part, partIdx) => {
      const partTitle = part.title && String(part.title).trim() ? part.title : 'Preguntas';
      let partHtml = `
        <div class="bg-blue-50/30 p-4 rounded-xl border border-blue-100/50 space-y-3">
          <h5 class="text-xs font-bold text-blue-700 border-b border-blue-100/50 pb-1.5"><i class="fa-solid fa-folder-open mr-1"></i> ${escapeHTML(partTitle)}</h5>
          <div class="space-y-3 divide-y divide-blue-50/50">
      `;

      part.questions.forEach((q, idx) => {
        const hasCorrect = q.type !== 'short' && q.type !== 'canvas' && q.type !== 'proyectos';
        let isCorrect = hasCorrect && (q.userAnswer === q.correct);
        let programmingSimilarity = null;
        if (q.type === 'programacion') {
          if (q.userAnswer && typeof q.userAnswer === 'object') {
            const ansObj = q.userAnswer;
            const compiledMatch = ansObj.compiledOutput && ansObj.compiledOutput.trim() === (q.correct || "").trim();
            const sqlMatch = ansObj.sql && ansObj.sql.trim() === (q.correct || "").trim();
            const jsMatch = ansObj.js && ansObj.js.trim() === (q.correct || "").trim();
            const htmlMatch = ansObj.html && ansObj.html.trim() === (q.correct || "").trim();
            const cssMatch = ansObj.css && ansObj.css.trim() === (q.correct || "").trim();

            isCorrect = compiledMatch || sqlMatch || jsMatch || htmlMatch || cssMatch || (String(q.userAnswer) === String(q.correct));

            const expectedCode = String(q.correct || '').trim();
            const candidateCodes = [ansObj.sql, ansObj.js, ansObj.html, ansObj.css, ansObj.compiledOutput]
              .filter(c => c && String(c).trim());
            if (expectedCode && candidateCodes.length) {
              programmingSimilarity = Math.max(...candidateCodes.map(c => window.calculateCodeSimilarity(expectedCode, c)));
            } else if (expectedCode || candidateCodes.length) {
              programmingSimilarity = 0;
            }
          } else {
            const ans = typeof q.userAnswer === 'string' ? q.userAnswer.trim() : "";
            isCorrect = ans !== '' && ans === (q.correct || "").trim();
            const expectedCode = String(q.correct || '').trim();
            if (expectedCode && ans) {
              programmingSimilarity = window.calculateCodeSimilarity(expectedCode, ans);
            } else if (expectedCode || ans) {
              programmingSimilarity = 0;
            }
          }
        }

        let badge = "";
        if (q.type === 'proyectos') {
          badge = `<span class="text-[9px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100"><i class="fa-solid fa-folder-open text-blue-500"></i> Proyectos</span>`;
        } else if (q.type === 'canvas') {
          badge = `<span class="text-[9px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-100"><i class="fa-solid fa-palette text-purple-500"></i> Diseño Canvas</span>`;
        } else if (q.type === 'programacion') {
          const isCode = q.responseType !== 'multiple' && q.responseType !== 'short';
          const similarityBadge = isCode
            ? `<span class="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100"><i class="fa-solid fa-code"></i> Similitud ${programmingSimilarity ?? 0}%</span>`
            : (isCorrect
              ? '<span class="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100"><i class="fa-solid fa-check"></i> Correcto</span>'
              : '<span class="text-[9px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100"><i class="fa-solid fa-xmark"></i> Incorrecto</span>');
          badge = `<span class="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100"><i class="fa-solid fa-code text-indigo-500"></i> Programación</span> ${similarityBadge}`;
        } else if (hasCorrect) {
          badge = isCorrect
            ? `<span class="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100"><i class="fa-solid fa-check"></i> Correcto</span>`
            : `<span class="text-[9px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100"><i class="fa-solid fa-xmark"></i> Incorrecto</span>`;
        } else {
          badge = `<span class="text-[9px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">Abierta</span>`;
        }

        const editButton = editable ? `
          <button type="button" class="edit-correct-btn text-[9px] font-bold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-100 px-2 py-0.5 rounded-full transition" data-part-idx="${partIdx}" data-q-idx="${idx}">
            <i class="fa-solid fa-pen mr-1"></i>Editar clave
          </button>
        ` : '';

        let answerWidget = "";
        if (q.type === 'proyectos') {
          const cfg = getProjectConfig(q);
          const raw = q.userAnswer && typeof q.userAnswer === 'object' ? q.userAnswer : {};
          let projects = [];
          if (Array.isArray(raw.projects)) {
            projects = raw.projects;
          } else if (raw.description || raw.link || raw.technologies) {
            projects = [raw];
          }
          projects = projects.filter(p => p && (p.description || p.link || p.technologies));

          if (raw.hasProject === false) {
            answerWidget = `
              <div class="col-span-2 mt-1 bg-blue-50/40 p-3 rounded-xl border border-blue-100 text-xs font-semibold text-gray-600">
                Respuesta: ${escapeHTML(cfg.noLabel)}
              </div>
            `;
          } else if (projects.length === 0) {
            answerWidget = `
              <div class="col-span-2 mt-1 bg-blue-50/40 p-3 rounded-xl border border-blue-100 text-xs font-semibold text-gray-400">
                Sin responder
              </div>
            `;
          } else {
            answerWidget = `
              <div class="col-span-2 mt-1 space-y-2">
                ${projects.map((project, pIdx) => {
                  const linkUrl = normalizeUrl(project.link);
                  return `
                    <div class="bg-blue-50/40 p-3 rounded-xl border border-blue-100 text-xs space-y-2">
                      <span class="text-[9px] font-bold text-blue-500 uppercase tracking-wide block">Proyecto ${pIdx + 1}</span>
                      <div>
                        <strong class="text-[9px] text-blue-500 block uppercase tracking-wide">${escapeHTML(cfg.descriptionLabel)}</strong>
                        <span class="font-medium text-gray-700 whitespace-pre-wrap">${escapeHTML(project.description || 'Sin responder')}</span>
                      </div>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <strong class="text-[9px] text-blue-500 block uppercase tracking-wide">${escapeHTML(cfg.linkLabel)}</strong>
                          ${linkUrl
                            ? `<a href="${escapeHTML(linkUrl)}" target="_blank" rel="noopener noreferrer" class="font-semibold text-blue-600 hover:text-blue-700 underline break-all inline-flex items-center gap-1"><i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>${escapeHTML(project.link)}</a>`
                            : `<span class="font-medium text-gray-400">${escapeHTML(project.link || 'Sin responder')}</span>`}
                        </div>
                        <div>
                          <strong class="text-[9px] text-blue-500 block uppercase tracking-wide">${escapeHTML(cfg.technologiesLabel)}</strong>
                          <span class="font-medium text-gray-700">${escapeHTML(project.technologies || 'Sin responder')}</span>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }
        } else if (q.type === 'canvas') {
          if (q.userAnswer && q.userAnswer.startsWith('data:image/')) {
            answerWidget = `
              <div class="col-span-2 bg-slate-900 p-3 rounded-2xl border border-slate-800 flex flex-col items-center gap-2 max-w-sm mx-auto shadow-inner mt-1">
                <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Diseño Final Exportado (Hoja A4)</span>
                <div class="bg-white rounded-xl overflow-hidden border border-slate-700 shadow-md">
                  <img src="${q.userAnswer}" class="max-w-full h-auto object-contain block max-h-[300px]" alt="Diseño de Candidato">
                </div>
                <a href="${q.userAnswer}" download="diseño_candidato_${Date.now()}.png" class="px-3 py-1 bg-purple-900/40 hover:bg-purple-900 text-purple-300 font-bold text-[10px] rounded-lg transition border border-purple-800 flex items-center gap-1">
                  <i class="fa-solid fa-download"></i> Descargar Imagen A4
                </a>
              </div>
            `;
          } else {
            answerWidget = `
              <div class="col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 text-center text-xs text-slate-400 mt-1">
                <i class="fa-regular fa-image text-lg mb-1 block"></i> El candidato no realizó ningún dibujo en el lienzo.
              </div>
            `;
          }
        } else if (q.type === 'programacion') {
          const respType = q.responseType === 'multiple' || q.responseType === 'short' ? q.responseType : 'code';
          if (respType === 'code') {
            const ansObj = q.userAnswer && typeof q.userAnswer === 'object' ? q.userAnswer : null;
            const candidateCode = ansObj
              ? [ansObj.html, ansObj.css, ansObj.js, ansObj.sql].filter(Boolean).join('\n\n')
              : (typeof q.userAnswer === 'string' ? q.userAnswer : '');
            const similarityValue = programmingSimilarity ?? 0;
            answerWidget = `
              <div class="col-span-2 space-y-3 mt-1">
                <div class="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                  <div class="flex items-center justify-between">
                    <span class="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Similitud de sintaxis</span>
                    <span class="text-lg font-extrabold text-indigo-700">${similarityValue}%</span>
                  </div>
                  <div class="w-full bg-indigo-100 rounded-full h-2 mt-2 overflow-hidden">
                    <div class="bg-indigo-500 h-2 rounded-full" style="width: ${similarityValue}%"></div>
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                    <span class="text-[9px] font-bold text-amber-700 uppercase tracking-wider block mb-2">Código del candidato</span>
                    <pre class="font-mono text-xs text-slate-800 whitespace-pre-wrap break-words max-h-72 overflow-auto custom-scroll">${escapeHTML(candidateCode || 'Sin código')}</pre>
                  </div>
                  <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3" data-correct-wrap data-part-idx="${partIdx}" data-q-idx="${idx}">
                    <div class="flex items-center justify-between gap-2 mb-2">
                      <span class="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block">Código correcto</span>
                      ${editButton}
                    </div>
                    <div data-correct-display>
                      <pre class="font-mono text-xs text-slate-800 whitespace-pre-wrap break-words max-h-72 overflow-auto custom-scroll">${escapeHTML(q.correct || 'Sin código')}</pre>
                    </div>
                    <div data-correct-editor class="hidden mt-2"></div>
                  </div>
                </div>
              </div>
            `;
          } else {
            answerWidget = `
              <div class="col-span-2 space-y-2 mt-1">
                <div class="bg-blue-50/20 p-2 rounded-lg border border-blue-100/20 text-xs">
                  <strong class="text-[8px] text-gray-400 block uppercase">Respuesta del Aspirante (${respType === 'multiple' ? 'Opción Múltiple' : 'Respuesta Corta'})</strong>
                  <span class="font-medium text-blue-900 whitespace-pre-wrap">${escapeHTML(q.userAnswer || 'Sin responder')}</span>
                </div>
                <div class="bg-emerald-50/10 p-2 rounded-lg border border-emerald-100/10 text-xs" data-correct-wrap data-part-idx="${partIdx}" data-q-idx="${idx}">
                  <div class="flex items-center justify-between gap-2">
                    <strong class="text-[8px] text-gray-400 block uppercase">Clave Esperada</strong>
                    ${editButton}
                  </div>
                  <div data-correct-display>
                    <pre class="font-mono text-emerald-950 whitespace-pre-wrap">${escapeHTML(q.correct || 'Sin solución esperada')}</pre>
                  </div>
                  <div data-correct-editor class="hidden mt-2"></div>
                </div>
              </div>
            `;
          }
        } else {
          answerWidget = `
            <div class="bg-blue-50/20 p-2 rounded-lg border border-blue-100/20">
              <strong class="text-[8px] text-gray-400 block uppercase">Respuesta del Aspirante</strong>
              <span class="font-medium text-blue-900">${q.userAnswer || '<em class="text-gray-300">Sin responder</em>'}</span>
            </div>
            ${hasCorrect ? `
              <div class="bg-emerald-50/10 p-2 rounded-lg border border-emerald-100/10" data-correct-wrap data-part-idx="${partIdx}" data-q-idx="${idx}">
                <div class="flex items-center justify-between gap-2">
                  <strong class="text-[8px] text-gray-400 block uppercase">Clave Esperada</strong>
                  ${editButton}
                </div>
                <div data-correct-display>
                  <span class="font-medium text-emerald-950">${escapeHTML(q.correct)}</span>
                </div>
                <div data-correct-editor class="hidden mt-2"></div>
              </div>
            ` : ''}
          `;
        }

        partHtml += `
          <div class="pdf-question pt-2 space-y-1" data-part-idx="${partIdx}" data-q-idx="${idx}">
            <div class="flex justify-between items-start gap-4">
              <span class="text-xs font-bold text-gray-700 whitespace-pre-wrap" style="white-space: pre-wrap;">${idx + 1}. ${escapeHTML(getQuestionText(q) || (q.type === 'proyectos' ? '¿Has desarrollado proyectos?' : 'Pregunta'))}</span>
              ${badge}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              ${answerWidget}
            </div>
          </div>
        `;
      });

      partHtml += `
          </div>
        </div>
      `;
      container.innerHTML += partHtml;
    });
  }

  function openCorrectEditor(btn) {
    if (!activeReport) return;
    const partIdx = Number(btn.dataset.partIdx);
    const qIdx = Number(btn.dataset.qIdx);
    const q = activeReport.technical_answers &&
      activeReport.technical_answers.parts &&
      activeReport.technical_answers.parts[partIdx] &&
      activeReport.technical_answers.parts[partIdx].questions
      ? activeReport.technical_answers.parts[partIdx].questions[qIdx]
      : null;
    if (!q) return;

    const wrap = btn.closest('[data-correct-wrap]');
    if (!wrap) return;
    const display = wrap.querySelector('[data-correct-display]');
    const editor = wrap.querySelector('[data-correct-editor]');
    if (!display || !editor || !editor.classList.contains('hidden')) return;

    modalAnswersTech.querySelectorAll('[data-correct-editor]:not(.hidden)').forEach(openEditor => {
      openEditor.classList.add('hidden');
      openEditor.innerHTML = '';
      const openWrap = openEditor.closest('[data-correct-wrap]');
      const openDisplay = openWrap ? openWrap.querySelector('[data-correct-display]') : null;
      if (openDisplay) openDisplay.classList.remove('hidden');
    });

    const respType = q.type === 'programacion'
      ? (q.responseType === 'multiple' || q.responseType === 'short' ? q.responseType : 'code')
      : null;

    let inputHtml = '';
    if (q.type === 'multiple' || (q.type === 'programacion' && respType === 'multiple')) {
      const options = (Array.isArray(q.options) ? q.options : [])
        .filter(opt => opt !== undefined && opt !== null && String(opt).trim() !== '');
      inputHtml = options.length > 0
        ? `
          <select data-correct-input class="w-full px-3 py-2 border border-violet-200 rounded-xl text-xs bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-300">
            <option value="">Selecciona la correcta...</option>
            ${options.map(opt => `<option value="${escapeHTML(opt)}" ${String(opt) === String(q.correct) ? 'selected' : ''}>${escapeHTML(opt)}</option>`).join('')}
          </select>
        `
        : `
          <input data-correct-input type="text" value="${escapeHTML(q.correct || '')}" class="w-full px-3 py-2 border border-violet-200 rounded-xl text-xs bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-300" placeholder="Escribe la respuesta correcta...">
        `;
    } else if (q.type === 'boolean') {
      inputHtml = `
        <select data-correct-input class="w-full px-3 py-2 border border-violet-200 rounded-xl text-xs bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-300">
          <option value="Verdadero" ${q.correct === 'Verdadero' ? 'selected' : ''}>Verdadero</option>
          <option value="Falso" ${q.correct === 'Falso' ? 'selected' : ''}>Falso</option>
        </select>
      `;
    } else if (q.type === 'programacion' && respType === 'code') {
      inputHtml = `
        <textarea data-correct-input rows="7" class="w-full px-3 py-2 border border-violet-200 rounded-xl text-xs bg-violet-50/30 text-slate-800 font-mono resize-y custom-scroll focus:outline-none focus:ring-1 focus:ring-violet-300">${escapeHTML(q.correct || '')}</textarea>
      `;
    } else if (q.type === 'programacion' && respType === 'short') {
      inputHtml = `
        <input data-correct-input type="text" value="${escapeHTML(q.correct || '')}" class="w-full px-3 py-2 border border-violet-200 rounded-xl text-xs bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-300">
      `;
    } else {
      return;
    }

    editor.innerHTML = `
      <div class="space-y-2">
        ${inputHtml}
        <div class="flex items-center justify-end gap-2">
          <button type="button" class="cancel-correct-btn px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-bold text-[10px] transition">Cancelar</button>
          <button type="button" class="save-correct-btn px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-[10px] transition" data-part-idx="${partIdx}" data-q-idx="${qIdx}">
            <i class="fa-solid fa-check mr-1"></i>Guardar
          </button>
        </div>
      </div>
    `;
    display.classList.add('hidden');
    editor.classList.remove('hidden');
    const input = editor.querySelector('[data-correct-input]');
    if (input) input.focus();
  }

  function cancelCorrectEditor(btn) {
    const wrap = btn.closest('[data-correct-wrap]');
    if (!wrap) return;
    const display = wrap.querySelector('[data-correct-display]');
    const editor = wrap.querySelector('[data-correct-editor]');
    if (display) display.classList.remove('hidden');
    if (editor) {
      editor.classList.add('hidden');
      editor.innerHTML = '';
    }
  }

  function refreshActiveReport() {
    if (!activeReport) return;
    const score = calculateTechnicalScore(activeReport.technical_answers);
    if (score.total > 0) {
      modalCandScore.textContent = `${score.correct} bien, ${score.incorrect} mal, ${score.empty} vacías de ${score.total}`;
      modalCandPercentage.textContent = `${score.scorePct}%`;
    } else {
      modalCandScore.textContent = "Evaluación cualitativa";
      modalCandPercentage.textContent = "—";
    }
    renderAnswers(modalAnswersPsy, activeReport.psychometric_answers);
    renderAnswers(modalAnswersTech, activeReport.technical_answers, { editable: true });
    modalTabTechBtn.className = "pb-2 px-4 border-b-2 border-blue-500 text-blue-600 font-bold text-sm";
    modalTabPsyBtn.className = "pb-2 px-4 border-b-2 border-transparent text-gray-500 font-bold text-sm hover:text-blue-600";
    modalAnswersTech.classList.remove('hidden');
    modalAnswersPsy.classList.add('hidden');
  }

  async function saveCorrectAnswer(btn) {
    if (!activeReport) return;
    const partIdx = Number(btn.dataset.partIdx);
    const qIdx = Number(btn.dataset.qIdx);
    const part = activeReport.technical_answers &&
      activeReport.technical_answers.parts &&
      activeReport.technical_answers.parts[partIdx];
    const q = part && part.questions ? part.questions[qIdx] : null;
    if (!q) return;

    const wrap = btn.closest('[data-correct-wrap]');
    const input = wrap ? wrap.querySelector('[data-correct-input]') : null;
    if (!input) return;

    const newValue = typeof input.value === 'string' ? input.value.trim() : '';
    if (!newValue) {
      showPastelAlert('La respuesta correcta no puede estar vacía.');
      return;
    }
    if (String(newValue) === String(q.correct || '')) {
      cancelCorrectEditor(btn);
      return;
    }

    const originalValue = q.correct;
    const originalScore = activeReport.score;
    const originalMaxScore = activeReport.max_score;
    q.correct = newValue;
    const score = calculateTechnicalScore(activeReport.technical_answers);

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Guardando...';

    try {
      const { error } = await supabaseClient
        .from('results')
        .update({
          technical_answers: activeReport.technical_answers,
          score: score.correct,
          max_score: score.total
        })
        .eq('id', activeReport.id);
      if (error) throw error;

      activeReport.score = score.correct;
      activeReport.max_score = score.total;
      refreshActiveReport();
      renderResults();
    } catch (err) {
      q.correct = originalValue;
      activeReport.score = originalScore;
      activeReport.max_score = originalMaxScore;
      console.error(err);
      showPastelAlert('No se pudo guardar la corrección: ' + err.message);
      cancelCorrectEditor(btn);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check mr-1"></i>Guardar';
    }
  }

  modalAnswersTech.addEventListener('click', (event) => {
    const editBtn = event.target.closest('.edit-correct-btn');
    if (editBtn) {
      event.preventDefault();
      openCorrectEditor(editBtn);
      return;
    }
    const saveBtn = event.target.closest('.save-correct-btn');
    if (saveBtn) {
      event.preventDefault();
      saveCorrectAnswer(saveBtn);
      return;
    }
    const cancelBtn = event.target.closest('.cancel-correct-btn');
    if (cancelBtn) {
      event.preventDefault();
      cancelCorrectEditor(cancelBtn);
    }
  });

  // Acción de asignar examen adicional en cualquier momento
  const assignExtraBtn = document.getElementById('modal-btn-assign-extra');
  if (assignExtraBtn) {
    assignExtraBtn.addEventListener('click', async () => {
      const select = document.getElementById('modal-assign-extra-select');
      const examId = select.value;
      if (!examId || !activeReport) {
        showPastelAlert("Selecciona un examen técnico de la lista.");
        return;
      }

      const examObj = allAvailableExams.find(e => e.id === examId);
      if (!examObj) return;

      try {
        // Habilitar en lista de espera de candidatos (como "pending")
        // con la lista de exámenes asignados (este nuevo examen)
        const { error } = await supabaseClient
          .from('candidates')
          .insert([{
            name: activeReport.candidate_name,
            assigned_exams: [{ id: examObj.id, name: examObj.name }],
            status: 'pending'
          }]);

        if (error) throw error;
        showPastelAlert(`¡Examen "${examObj.name}" asignado con éxito! El candidato ya puede ingresar en su equipo para realizarlo.`);
        closeModal();
      } catch (err) {
        console.error(err);
        showPastelAlert("No se pudo asignar el examen adicional: " + err.message);
      }
    });
  }

  // Cerrar Modal
  const closeModal = () => {
    resultModal.classList.add('hidden');
    activeReport = null;
  };
  modalCloseBtn.addEventListener('click', closeModal);
  modalCloseBottomBtn.addEventListener('click', closeModal);

  modalTabPsyBtn.addEventListener('click', () => {
    modalTabPsyBtn.className = "pb-2 px-4 border-b-2 border-blue-500 text-blue-600 font-bold text-sm";
    modalTabTechBtn.className = "pb-2 px-4 border-b-2 border-transparent text-gray-500 font-bold text-sm hover:text-blue-600";
    modalAnswersPsy.classList.remove('hidden');
    modalAnswersTech.classList.add('hidden');
  });

  modalTabTechBtn.addEventListener('click', () => {
    modalTabTechBtn.className = "pb-2 px-4 border-b-2 border-blue-500 text-blue-600 font-bold text-sm";
    modalTabPsyBtn.className = "pb-2 px-4 border-b-2 border-transparent text-gray-500 font-bold text-sm hover:text-blue-600";
    modalAnswersTech.classList.remove('hidden');
    modalAnswersPsy.classList.add('hidden');
  });

  window.addEventListener('beforeprint', () => {
    document.querySelectorAll('#modal-ai-detector details').forEach(details => { details.open = true; });
  });

  modalPrintBtn.addEventListener('click', async () => {
    if (!activeReport) return;
    const originalHtml = modalPrintBtn.innerHTML;
    modalPrintBtn.disabled = true;
    modalPrintBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Generando PDF...';
    let pdfWrapper = null;

    try {
      if (typeof html2pdf === 'undefined') throw new Error('html2pdf no está disponible');

      const modalContent = document.querySelector('#result-modal > div');
      if (!modalContent) throw new Error('No se encontró el reporte');

      const clone = modalContent.cloneNode(true);
      clone.classList.add('pdf-report');
      clone.querySelectorAll('#modal-footer, #modal-tabs, #modal-assign-extra-section, #modal-close-btn, .edit-correct-btn').forEach(el => el.remove());
      clone.querySelectorAll('[data-correct-editor]').forEach(el => el.remove());
      clone.querySelectorAll('[data-correct-display]').forEach(el => el.classList.remove('hidden'));

      const psy = clone.querySelector('#modal-answers-psy');
      const tech = clone.querySelector('#modal-answers-tech');
      if (psy) {
        psy.classList.remove('hidden');
        const psyTitle = document.createElement('h3');
        psyTitle.className = 'text-sm font-bold text-gray-700 mt-4 mb-2';
        psyTitle.textContent = 'Respuestas Psicométricas';
        psy.parentNode.insertBefore(psyTitle, psy);
      }
      if (tech) {
        tech.classList.remove('hidden');
        const techTitle = document.createElement('h3');
        techTitle.className = 'text-sm font-bold text-gray-700 mt-6 mb-2';
        techTitle.textContent = 'Respuestas de los Exámenes';
        tech.parentNode.insertBefore(techTitle, tech);
      }

      clone.querySelectorAll('details').forEach(details => { details.open = true; });
      clone.querySelectorAll('[class*="max-h-"], [class*="overflow-"]').forEach(el => {
        el.style.maxHeight = 'none';
        el.style.overflow = 'visible';
      });
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'hidden';
      clone.style.display = 'block';
      const cloneBody = clone.querySelector('.p-6.overflow-y-auto');
      if (cloneBody) {
        cloneBody.style.flex = 'none';
        cloneBody.style.overflow = 'visible';
        cloneBody.style.maxHeight = 'none';
      }

      const pdfFooter = document.createElement('div');
      pdfFooter.className = 'mt-6 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400';
      pdfFooter.textContent = `Reporte generado el ${new Date().toLocaleString('es-MX')} · CircleCenter`;
      clone.appendChild(pdfFooter);

      const pdfStyle = document.createElement('style');
      pdfStyle.textContent = `
        .pdf-report .bg-white.rounded-xl,
        .pdf-report .bg-emerald-50,
        .pdf-report .pdf-question {
          break-inside: avoid;
        }
      `;
      clone.appendChild(pdfStyle);

      pdfWrapper = document.createElement('div');
      pdfWrapper.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;background:#ffffff;padding:24px;';
      pdfWrapper.appendChild(clone);
      document.body.appendChild(pdfWrapper);

      const safeName = String(activeReport.candidate_name || 'candidato')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/gi, '_')
        .replace(/^_+|_+$/g, '') || 'candidato';

      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `reporte_${safeName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollY: 0, windowWidth: 900 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      }).from(clone).save();
    } catch (err) {
      console.error(err);
      showPastelAlert('No se pudo generar el PDF automáticamente. Se abrirá el diálogo de impresión para guardarlo como PDF.');
      window.print();
    } finally {
      if (pdfWrapper) pdfWrapper.remove();
      modalPrintBtn.disabled = false;
      modalPrintBtn.innerHTML = originalHtml;
    }
  });

  modalDeleteBtn.addEventListener('click', () => {
    if (!activeReport) return;
    const report = activeReport;
    showPastelConfirm(
      `¿Eliminar el registro de "${escapeHTML(report.candidate_name)}"? Esta acción no se puede deshacer.`,
      (confirmed) => {
        if (!confirmed) return;
        closeModal();
        deleteResult(report.id);
      },
      "Eliminar Registro"
    );
  });

  resultsSearch.addEventListener('input', renderResults);
  filterVacancy.addEventListener('change', renderResults);
  refreshResultsBtn.addEventListener('click', loadResults);

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

  // Inicializar
  await loadResults();
});
