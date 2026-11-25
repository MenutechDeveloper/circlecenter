// Reporte público de solo lectura para compartir con superiores.
const PUBLIC_DEFAULT_PROJECT_CONFIG = {
  yesLabel: "Sí",
  noLabel: "No",
  descriptionLabel: "Descripción",
  linkLabel: "Link",
  technologiesLabel: "Tecnologías / Frameworks",
  addLabel: "Agregar otro proyecto"
};
const DEFAULT_PROJECT_CONFIG = PUBLIC_DEFAULT_PROJECT_CONFIG;

document.addEventListener('DOMContentLoaded', async () => {
  const reportEl = document.getElementById('public-report');
  const statusEl = document.getElementById('public-status');
  const printBtn = document.getElementById('print-btn');
  const closeBtn = document.getElementById('close-btn');
  const params = new URLSearchParams(window.location.search);
  const resultId = params.get('id');

  function showError(message) {
    statusEl.textContent = message;
    statusEl.classList.remove('hidden');
    reportEl.classList.add('hidden');
    printBtn.classList.add('hidden');
  }

  printBtn.addEventListener('click', () => window.print());
  closeBtn.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.close();
  });

  if (!resultId) {
    showError('El enlace no incluye un identificador de reporte.');
    return;
  }
  if (!supabaseClient) {
    showError('No se pudo conectar con la base de datos.');
    return;
  }

  const { data: report, error } = await supabaseClient
    .from('results')
    .select('*')
    .eq('id', resultId)
    .single();

  if (error || !report) {
    console.error(error);
    showError('No se encontró el reporte o el enlace ya no es válido.');
    return;
  }

  renderPublicReport(report);
  reportEl.classList.remove('hidden');
  document.title = 'Reporte - ' + (report.candidate_name || 'Candidato');

  if (params.get('print') === '1') {
    setTimeout(() => window.print(), 700);
  }
});

function renderPublicReport(report) {
  const reportEl = document.getElementById('public-report');
  const score = calculateTechnicalScore(report.technical_answers);
  const info = report.candidate_info || {};
  const infoKeys = Object.keys(info);
  const aiHtml = buildAIDetectorHtml(report);

  reportEl.innerHTML = `
    <div class="report-header bg-blue-400 p-6 text-white">
      <div class="flex items-center gap-3">
        <div class="header-icon w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
          <i class="fa-solid fa-id-card text-xl"></i>
        </div>
        <div>
          <h1 class="text-xl font-bold break-words">${escapeHTML(report.candidate_name || 'Candidato')}</h1>
          <p class="text-xs text-blue-100 break-words">Vacante de Interés: ${escapeHTML(report.assigned_exam_name || 'General')}</p>
        </div>
      </div>
    </div>

    <div class="p-6 space-y-6">
      <div class="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
        <div>
          <span class="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Calificaciones</span>
          <span class="text-lg font-bold text-gray-800">${score.total > 0 ? `${score.correct} bien, ${score.incorrect} mal, ${score.empty} vacías de ${score.total}` : 'Evaluación cualitativa'}</span>
        </div>
        <div class="text-xs font-extrabold bg-emerald-200 text-emerald-800 px-2 py-1 rounded-full">${score.total > 0 ? `${score.scorePct}%` : '—'}</div>
      </div>

      <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <h2 class="text-sm font-bold text-gray-700 mb-3"><i class="fa-solid fa-circle-info mr-1 text-blue-400"></i> Información del Candidato</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600">
          ${infoKeys.length === 0
            ? '<span class="text-gray-400 col-span-2">No se capturó información adicional de formulario.</span>'
            : infoKeys.map(key => `
                <div class="bg-white p-2 rounded-xl border border-blue-50 shadow-sm">
                  <strong class="text-[9px] text-blue-400 uppercase block">${escapeHTML(key.replace(/_/g, ' ').toUpperCase())}</strong>
                  <span class="text-xs font-semibold text-gray-700 break-words">${escapeHTML(String(info[key] ?? ''))}</span>
                </div>
              `).join('')}
        </div>
      </div>

      <section>
        <h2 class="text-sm font-bold text-gray-700 mb-3"><i class="fa-solid fa-laptop-code mr-1 text-blue-400"></i> Respuestas de los Exámenes</h2>
        <div id="public-tech-answers" class="space-y-3"></div>
      </section>

      ${aiHtml ? `
        <section>
          <h2 class="text-sm font-bold text-gray-700 mb-3"><i class="fa-solid fa-file-shield mr-1 text-violet-500"></i> Detector de IA</h2>
          <div class="space-y-2">${aiHtml}</div>
        </section>
      ` : ''}
    </div>

    <div class="px-6 py-4 border-t border-gray-100 text-center text-[10px] text-gray-400">
      Reporte generado el ${new Date().toLocaleString('es-MX')} · CircleCenter
    </div>
  `;

  const techContainer = document.getElementById('public-tech-answers');
  if (techContainer) renderAnswers(techContainer, report.technical_answers);
  reportEl.querySelectorAll('details').forEach(details => { details.open = true; });
}

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

  function examOrderRank(name) {
    const t = String(name || '').toLowerCase();
    if (t.includes('acerca')) return 0;
    if (t.includes('program')) return 1;
    return 2;
  }

  function buildAIDetectorHtml(report) {
    const ai = report.ai_metrics;
    const exams = (ai && Array.isArray(ai.exams) ? ai.exams.filter(Boolean) : [])
      .sort((a, b) => examOrderRank(a.examName) - examOrderRank(b.examName));

    if (!ai || !ai.enabled || exams.length === 0) return '';

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

    return html;
  }

  function renderAnswers(container, answersData) {
    container.innerHTML = "";
    const parts = [...((answersData && answersData.parts) || [])].sort((a, b) => examOrderRank(a.title) - examOrderRank(b.title));
    if (parts.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-gray-400 text-xs">No hay respuestas cargadas para este bloque.</div>`;
      return;
    }

    parts.forEach(part => {
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
                  <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
                    <span class="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block mb-2">Código correcto</span>
                    <pre class="font-mono text-xs text-slate-800 whitespace-pre-wrap break-words max-h-72 overflow-auto custom-scroll">${escapeHTML(q.correct || 'Sin código')}</pre>
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
                <div class="bg-emerald-50/10 p-2 rounded-lg border border-emerald-100/10 text-xs">
                  <strong class="text-[8px] text-gray-400 block uppercase">Clave Esperada</strong>
                  <pre class="font-mono text-emerald-950 whitespace-pre-wrap">${escapeHTML(q.correct || 'Sin solución esperada')}</pre>
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
              <div class="bg-emerald-50/10 p-2 rounded-lg border border-emerald-100/10">
                <strong class="text-[8px] text-gray-400 block uppercase">Clave Esperada</strong>
                <span class="font-medium text-emerald-950">${escapeHTML(q.correct)}</span>
              </div>
            ` : ''}
          `;
        }

        partHtml += `
          <div class="pdf-question pt-2 space-y-1">
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

