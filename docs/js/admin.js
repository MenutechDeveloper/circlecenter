// JS de la Página Principal Administrativa y Cola de Espera (admin.html)
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verificar sesión
  if (!checkAdminAuth()) return;

  // Set dynamic admin name
  const adminNameEl = document.getElementById('admin-name');
  if (adminNameEl) {
    try {
      const sessionData = JSON.parse(localStorage.getItem('rh_admin_session'));
      if (sessionData && sessionData.username) {
        adminNameEl.textContent = sessionData.username.split('@')[0];
      }
    } catch (e) {}
  }

  // Asegurar que existan datos obligatorios en Supabase
  await ensureDefaultPsychometricExam();
  await ensureDefaultRegistrationForm();

  // Elementos DOM
  const candidateForm = document.getElementById('candidate-form');
  const candNameInput = document.getElementById('cand-name');
  const candExamsDropdownBtn = document.getElementById('cand-exams-dropdown-btn');
  const candExamsDropdownMenu = document.getElementById('cand-exams-dropdown-menu');
  const selectedExamsText = document.getElementById('selected-exams-text');
  const dropdownChevron = document.getElementById('dropdown-chevron');
  const pendingCandidatesList = document.getElementById('pending-candidates-list');
  const refreshCandidatesBtn = document.getElementById('refresh-candidates-btn');
  const alertBox = document.getElementById('alert-box');
  const alertMsg = document.getElementById('alert-msg');

  let allExams = [];
  let pendingCandidates = [];
  let selectedExams = []; // [{id, name}]

  // LOGOUT
  document.getElementById('logout-btn').addEventListener('click', async () => {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      try {
        await supabaseClient.auth.signOut();
      } catch (err) {
        console.error("Error signing out from Supabase Auth:", err);
      }
    }
    localStorage.removeItem('rh_admin_session');
    window.location.href = 'login.html';
  });

  // Mostrar mensaje de alerta
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
    }, 4000);
  }

  // Toggle Custom Dropdown Menu
  if (candExamsDropdownBtn) {
    candExamsDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      candExamsDropdownMenu.classList.toggle('hidden');
      dropdownChevron.classList.toggle('rotate-180');
    });
  }

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (candExamsDropdownMenu && !candExamsDropdownMenu.contains(e.target) && e.target !== candExamsDropdownBtn) {
      candExamsDropdownMenu.classList.add('hidden');
      dropdownChevron.classList.remove('rotate-180');
    }
  });

  // Cargar Exámenes Técnicos para Asignar
  async function loadExams() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('exams')
        .select('*')
        .eq('is_psychometric', false)
        .order('name', { ascending: true });

      if (error) throw error;
      allExams = data || [];

      candExamsDropdownMenu.innerHTML = '';
      if (allExams.length === 0) {
        candExamsDropdownMenu.innerHTML = '<div class="text-center py-4 text-gray-400 text-xs">No hay exámenes creados.</div>';
        return;
      }

      allExams.forEach(exam => {
        candExamsDropdownMenu.innerHTML += `
          <label class="flex items-center gap-2.5 p-2 rounded-xl hover:bg-blue-50/50 cursor-pointer transition duration-150 text-xs font-semibold text-gray-700">
            <input type="checkbox" name="cand-exam-check" value="${exam.id}" data-name="${exam.name}" class="cand-exam-checkbox rounded text-blue-400 border-blue-200 focus:ring-blue-400 w-4 h-4 transition">
            <span>${exam.name}</span>
          </label>
        `;
      });

      // Bind checking changes
      document.querySelectorAll('.cand-exam-checkbox').forEach(chk => {
        chk.addEventListener('change', () => {
          updateSelectedExamsText();
        });
      });

    } catch (err) {
      console.error(err);
      showAlert("Error al obtener exámenes técnicos: " + err.message, true);
    }
  }

  function updateSelectedExamsText() {
    selectedExams = [];
    document.querySelectorAll('.cand-exam-checkbox:checked').forEach(chk => {
      selectedExams.push({
        id: chk.value,
        name: chk.getAttribute('data-name')
      });
    });

    if (selectedExams.length === 0) {
      selectedExamsText.textContent = '-- Seleccionar Examen --';
      selectedExamsText.className = 'text-gray-400 text-sm';
    } else {
      selectedExamsText.textContent = selectedExams.map(e => e.name).join(', ');
      selectedExamsText.className = 'text-gray-700 text-sm font-semibold truncate max-w-[90%]';
    }
  }

  // Cargar Candidatos Activos/Pendientes
  async function loadPendingCandidates() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('candidates')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      pendingCandidates = data || [];
      renderPendingCandidates();
    } catch (err) {
      console.error(err);
      showAlert("Error al cargar candidatos activos: " + err.message, true);
    }
  }

  // Renderizar Candidatos en Espera
  function renderPendingCandidates() {
    pendingCandidatesList.innerHTML = "";
    if (pendingCandidates.length === 0) {
      pendingCandidatesList.innerHTML = `
        <div class="text-center py-12 text-gray-400">
          <i class="fa-solid fa-users-slash text-4xl mb-2 text-blue-100 block"></i>
          Aún no hay candidatos en espera hoy.
        </div>
      `;
      return;
    }

    pendingCandidates.forEach(cand => {
      // Un candidato puede tener assigned_exams como JSONB array, o el viejo formato
      let examText = "Sin examen técnico";
      if (cand.assigned_exams && Array.isArray(cand.assigned_exams) && cand.assigned_exams.length > 0) {
        examText = cand.assigned_exams.map(e => e.name).join(', ');
      } else if (cand.assigned_exam_name) {
        examText = cand.assigned_exam_name;
      }

      pendingCandidatesList.innerHTML += `
        <div class="p-4 bg-blue-50/20 hover:bg-blue-50 rounded-2xl border border-blue-100/50 flex items-center justify-between gap-4 transition shadow-sm">
          <div class="flex items-center gap-3 max-w-[80%]">
            <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold shrink-0">
              ${cand.name.charAt(0).toUpperCase()}
            </div>
            <div class="truncate">
              <h3 class="font-bold text-gray-800 text-sm truncate">${cand.name}</h3>
              <p class="text-xs text-gray-400 truncate">Exámenes: <strong class="text-blue-500">${examText}</strong></p>
            </div>
          </div>
          <button class="delete-cand-btn text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-xl transition" data-id="${cand.id}">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      `;
    });

    // Vincular botón de inhabilitar
    document.querySelectorAll('.delete-cand-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        showPastelConfirm("¿Deseas inhabilitar y retirar a este candidato de la lista de espera?", async (accepted) => {
          if (accepted) {
            await deleteCandidate(id);
          }
        });
      });
    });
  }

  // Eliminar Candidato de Espera
  async function deleteCandidate(id) {
    try {
      const { error } = await supabaseClient
        .from('candidates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showPastelAlert("Candidato retirado de la lista correctamente.");
      loadPendingCandidates();
    } catch (err) {
      console.error(err);
      showPastelAlert("Error al inhabilitar candidato: " + err.message);
    }
  }

  // Enviar Formulario de Candidato
  candidateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = candNameInput.value.trim();

    if (!name) {
      showPastelAlert("Por favor, ingresa el nombre del candidato.");
      return;
    }

    try {
      let { error } = await supabaseClient
        .from('candidates')
        .insert([{
          name,
          assigned_exams: selectedExams,
          status: 'pending'
        }]);

      if (error) {
        // Fallback robusto en caso de que la columna 'assigned_exams' no exista en el caché de Supabase del usuario
        const isColumnError = error.message && (
          error.message.includes('assigned_exams') ||
          error.message.includes('column') ||
          error.message.includes('schema cache')
        );

        if (isColumnError) {
          console.warn("La columna 'assigned_exams' no está disponible en la base de datos de Supabase. Iniciando fallback con 'assigned_exam_id' y 'assigned_exam_name'...");
          const singleExamId = selectedExams.length > 0 ? selectedExams[0].id : null;
          const singleExamName = selectedExams.length > 0 ? selectedExams.map(ex => ex.name).join(', ') : '';

          const fallbackResult = await supabaseClient
            .from('candidates')
            .insert([{
              name,
              assigned_exam_id: singleExamId,
              assigned_exam_name: singleExamName,
              status: 'pending'
            }]);

          if (fallbackResult.error) {
            throw fallbackResult.error;
          }
        } else {
          throw error;
        }
      }

      showPastelAlert(`¡Candidato ${name} habilitado con éxito!`);
      candidateForm.reset();

      // Desmarcar todos los checkboxes del dropdown
      document.querySelectorAll('.cand-exam-checkbox').forEach(chk => chk.checked = false);
      updateSelectedExamsText();

      loadPendingCandidates();
    } catch (err) {
      console.error(err);
      showPastelAlert("Error al habilitar acceso: " + err.message);
    }
  });

  refreshCandidatesBtn.addEventListener('click', loadPendingCandidates);

  // Inicializar
  await loadExams();
  await loadPendingCandidates();
});
