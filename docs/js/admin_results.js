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
  const modalCandName = document.getElementById('modal-cand-name');
  const modalCandPos = document.getElementById('modal-cand-pos');
  const modalCandEmail = document.getElementById('modal-cand-email');
  const modalCandPhone = document.getElementById('modal-cand-phone');
  const modalCandScore = document.getElementById('modal-cand-score');
  const modalCandPercentage = document.getElementById('modal-cand-percentage');
  const modalCandInfoFields = document.getElementById('modal-cand-info-fields');
  const modalTabPsyBtn = document.getElementById('modal-tab-psy-btn');
  const modalTabTechBtn = document.getElementById('modal-tab-tech-btn');
  const modalAnswersPsy = document.getElementById('modal-answers-psy');
  const modalAnswersTech = document.getElementById('modal-answers-tech');

  let allResults = [];
  let distinctVacancies = new Set();
  let activeReport = null; // Guardar reporte actual abierto en el modal
  let allAvailableExams = []; // Todos los exámenes disponibles para asignar extra

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
      const scoreText = res.max_score > 0 ? `${res.score} / ${res.max_score}` : 'Libre / Abierto';
      const scorePercent = res.max_score > 0 ? Math.round((res.score / res.max_score) * 100) : 100;

      let badgeColor = "bg-emerald-50 text-emerald-700 border border-emerald-100";
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
            <button class="view-report-btn px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-xs transition" data-id="${res.id}">
              <i class="fa-regular fa-id-card mr-1"></i> Ver Reporte
            </button>
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
  }

  function showReportModal(report) {
    activeReport = report;
    modalCandName.textContent = report.candidate_name;
    modalCandPos.textContent = `Vacante de Interés: ${report.assigned_exam_name || 'General'}`;
    modalCandEmail.textContent = report.candidate_email || 'No especificado';
    modalCandPhone.textContent = report.candidate_phone || 'No especificado';

    // Contar correctas, incorrectas y vacías en examen técnico
    let correct = 0;
    let incorrect = 0;
    let empty = 0;
    let totalQuestions = 0;

    const techParts = (report.technical_answers && report.technical_answers.parts) || [];
    techParts.forEach(part => {
      part.questions.forEach(q => {
        if (q.type !== 'short') {
          totalQuestions++;
          const ans = (q.userAnswer || "").trim();
          if (ans === "") {
            empty++;
          } else if (ans === q.correct) {
            correct++;
          } else {
            incorrect++;
          }
        } else {
          totalQuestions++;
          if ((q.userAnswer || "").trim() === "") {
            empty++;
          }
        }
      });
    });

    const scorePct = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 100;
    modalCandScore.textContent = `${correct} bien, ${incorrect} mal, ${empty} vacías de ${totalQuestions}`;
    modalCandPercentage.textContent = `${scorePct}%`;

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
    renderAnswers(modalAnswersTech, report.technical_answers);

    // Resetear Tabs
    modalTabPsyBtn.className = "pb-2 px-4 border-b-2 border-blue-500 text-blue-600 font-bold text-sm";
    modalTabTechBtn.className = "pb-2 px-4 border-b-2 border-transparent text-gray-500 font-bold text-sm hover:text-blue-600";
    modalAnswersPsy.classList.remove('hidden');
    modalAnswersTech.classList.add('hidden');

    resultModal.classList.remove('hidden');
  }

  function renderAnswers(container, answersData) {
    container.innerHTML = "";
    const parts = answersData.parts || [];
    if (parts.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-gray-400 text-xs">No hay respuestas cargadas para este bloque.</div>`;
      return;
    }

    parts.forEach(part => {
      let partHtml = `
        <div class="bg-blue-50/30 p-4 rounded-xl border border-blue-100/50 space-y-3">
          <h5 class="text-xs font-bold text-blue-700 border-b border-blue-100/50 pb-1.5"><i class="fa-solid fa-folder-open mr-1"></i> ${part.title}</h5>
          <div class="space-y-3 divide-y divide-blue-50/50">
      `;

      part.questions.forEach((q, idx) => {
        const hasCorrect = q.type !== 'short' && q.type !== 'canvas';
        const isCorrect = hasCorrect && (q.userAnswer === q.correct);

        let badge = "";
        if (q.type === 'canvas') {
          badge = `<span class="text-[9px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-100"><i class="fa-solid fa-palette text-purple-500"></i> Diseño Canvas</span>`;
        } else if (hasCorrect) {
          badge = isCorrect
            ? `<span class="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100"><i class="fa-solid fa-check"></i> Correcto</span>`
            : `<span class="text-[9px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100"><i class="fa-solid fa-xmark"></i> Incorrecto</span>`;
        } else {
          badge = `<span class="text-[9px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">Abierta</span>`;
        }

        let answerWidget = "";
        if (q.type === 'canvas') {
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
        } else {
          answerWidget = `
            <div class="bg-blue-50/20 p-2 rounded-lg border border-blue-100/20">
              <strong class="text-[8px] text-gray-400 block uppercase">Respuesta del Aspirante</strong>
              <span class="font-medium text-blue-900">${q.userAnswer || '<em class="text-gray-300">Sin responder</em>'}</span>
            </div>
            ${hasCorrect ? `
              <div class="bg-emerald-50/10 p-2 rounded-lg border border-emerald-100/10">
                <strong class="text-[8px] text-gray-400 block uppercase">Clave Esperada</strong>
                <span class="font-medium text-emerald-950">${q.correct}</span>
              </div>
            ` : ''}
          `;
        }

        partHtml += `
          <div class="pt-2 space-y-1">
            <div class="flex justify-between items-start gap-4">
              <span class="text-xs font-bold text-gray-700">${idx + 1}. ${q.text}</span>
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

  modalPrintBtn.addEventListener('click', () => {
    window.print();
  });

  resultsSearch.addEventListener('input', renderResults);
  filterVacancy.addEventListener('change', renderResults);
  refreshResultsBtn.addEventListener('click', loadResults);

  // Inicializar
  await loadResults();
});
