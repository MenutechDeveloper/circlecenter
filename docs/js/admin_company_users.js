// JS para el control de Usuarios de la Empresa (admin_company_users.js)
document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAdminAuth()) return;

  // Elementos DOM
  const formTitle = document.getElementById('form-title');
  const companyUserForm = document.getElementById('company-user-form');
  const userIdInput = document.getElementById('user-id-input');
  const userNameInput = document.getElementById('user-name');
  const userRoleSelect = document.getElementById('user-role');
  const usersList = document.getElementById('users-list');
  const refreshUsersBtn = document.getElementById('refresh-users-btn');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  const alertBox = document.getElementById('alert-box');
  const alertMsg = document.getElementById('alert-msg');

  let companyUsers = [];

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

  // Cargar Usuarios de la Empresa
  async function loadCompanyUsers() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('company_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      companyUsers = data || [];
      renderUsers();
    } catch (err) {
      console.error(err);
      showAlert("Error al cargar colaboradores: " + err.message, true);
    }
  }

  function renderUsers() {
    usersList.innerHTML = "";
    if (companyUsers.length === 0) {
      usersList.innerHTML = `
        <div class="text-center py-12 text-gray-400">
          <i class="fa-solid fa-users-slash text-4xl mb-2 text-blue-100 block"></i>
          No hay usuarios registrados. ¡Agrega el primero en el panel izquierdo!
        </div>
      `;
      return;
    }

    companyUsers.forEach(user => {
      let roleBadgeColor = "bg-blue-100 text-blue-700 border-blue-200";
      if (user.role === 'Admin') roleBadgeColor = "bg-rose-100 text-rose-700 border-rose-200";
      else if (user.role === 'RH') roleBadgeColor = "bg-emerald-100 text-emerald-700 border-emerald-200";

      usersList.innerHTML += `
        <div class="p-4 bg-white hover:bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center justify-between gap-4 transition shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold">
              ${user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 class="font-bold text-gray-800 text-sm">${user.name}</h3>
              <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase border ${roleBadgeColor}">${user.role}</span>
            </div>
          </div>

          <div class="flex gap-2">
            <button class="edit-user-btn text-blue-500 hover:bg-blue-50 p-2 rounded-xl transition" data-id="${user.id}">
              <i class="fa-solid fa-pencil"></i>
            </button>
            <button class="delete-user-btn text-rose-400 hover:text-rose-600 p-2 rounded-xl transition" data-id="${user.id}">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;
    });

    // Event listeners
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const user = companyUsers.find(u => u.id === id);
        if (user) {
          formTitle.innerHTML = `editar usuario`;
          userIdInput.value = user.id;
          userNameInput.value = user.name;
          userRoleSelect.value = user.role;
          btnCancelEdit.classList.remove('hidden');
        }
      });
    });

    document.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm("¿Estás seguro de que deseas eliminar a este usuario de la empresa?")) {
          await deleteUser(id);
        }
      });
    });
  }

  // Borrar usuario
  async function deleteUser(id) {
    try {
      const { error } = await supabaseClient
        .from('company_users')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showAlert("Usuario eliminado.");
      loadCompanyUsers();
    } catch (err) {
      showAlert("Error al borrar usuario: " + err.message, true);
    }
  }

  // Cancelar edición
  function resetForm() {
    formTitle.innerHTML = `registrar usuarios`;
    userIdInput.value = "";
    userNameInput.value = "";
    userRoleSelect.value = "";
    btnCancelEdit.classList.add('hidden');
  }

  btnCancelEdit.addEventListener('click', resetForm);

  // Enviar formulario
  companyUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = userIdInput.value;
    const name = userNameInput.value.trim();
    const role = userRoleSelect.value;

    if (!name || !role) {
      showAlert("Por favor, llena todos los campos.", true);
      return;
    }

    try {
      const payload = { name, role };

      if (id) {
        // UPDATE
        const { error } = await supabaseClient
          .from('company_users')
          .update(payload)
          .eq('id', id);

        if (error) throw error;
        showAlert("Usuario actualizado correctamente.");
      } else {
        // INSERT
        const { error } = await supabaseClient
          .from('company_users')
          .insert([payload]);

        if (error) throw error;
        showAlert("¡Usuario guardado con éxito!");
      }

      resetForm();
      loadCompanyUsers();
    } catch (err) {
      showAlert("Error al guardar: " + err.message, true);
    }
  });

  refreshUsersBtn.addEventListener('click', loadCompanyUsers);

  // Inicializar
  await loadCompanyUsers();
});
