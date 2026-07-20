// Script de Login y Registro administrativo para RH con Supabase Auth
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const errorAlert = document.getElementById('error-alert');
  const errorMsg = document.getElementById('error-msg');
  const successAlert = document.getElementById('success-alert');
  const successMsg = document.getElementById('success-msg');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');

  // Elementos del Header para cambiar textos dinámicamente
  const headerIcon = document.getElementById('header-icon');
  const loginTitle = document.getElementById('login-title');
  const loginSubtitle = document.getElementById('login-subtitle');
  const submitBtn = document.getElementById('submit-btn');

  let isRegisterMode = false;

  // Toggle para ver la contraseña
  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
    togglePasswordBtn.innerHTML = isPassword
      ? '<i class="fa-regular fa-eye-slash"></i>'
      : '<i class="fa-regular fa-eye"></i>';
  });

  // Toggle de modo (Login <-> Registro)
  if (toggleAuthModeBtn) {
    toggleAuthModeBtn.addEventListener('click', () => {
      isRegisterMode = !isRegisterMode;
      errorAlert.classList.add('hidden');
      successAlert.classList.add('hidden');

      if (isRegisterMode) {
        // Cambiar a modo Registro
        loginTitle.textContent = "Registro Administrativo";
        loginSubtitle.textContent = "Crear nueva cuenta de administrador";
        headerIcon.className = "fa-solid fa-user-plus text-2xl";
        submitBtn.innerHTML = `Registrarse y Entrar <i class="fa-solid fa-user-check ml-2"></i>`;
        toggleAuthModeBtn.textContent = "Ya tengo cuenta, Iniciar Sesión";
      } else {
        // Cambiar a modo Login
        loginTitle.textContent = "Recursos Humanos";
        loginSubtitle.textContent = "Acceso Administrativo al Panel";
        headerIcon.className = "fa-solid fa-user-tie text-2xl";
        submitBtn.innerHTML = `Ingresar al Panel <i class="fa-solid fa-arrow-right ml-2"></i>`;
        toggleAuthModeBtn.textContent = "Registrar nuevo administrador";
      }
    });
  }

  // Manejo de envío del formulario
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorAlert.classList.add('hidden');
    successAlert.classList.add('hidden');

    const email = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!supabaseClient) {
      errorMsg.textContent = "El cliente de Supabase no está configurado. Por favor, verifica la configuración.";
      errorAlert.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = `Procesando... <i class="fa-solid fa-spinner animate-spin ml-2"></i>`;

    try {
      if (isRegisterMode) {
        // MODO REGISTRO
        const { data, error } = await supabaseClient.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              role: 'admin'
            }
          }
        });

        if (error) throw error;

        // Registrar en la tabla company_users para visibilidad en el módulo "Usuarios"
        try {
          await supabaseClient.from('company_users').insert([
            {
              name: email.split('@')[0],
              role: 'Admin'
            }
          ]);
        } catch (dbErr) {
          console.warn("No se pudo agregar a la tabla company_users (puede ser por políticas de RLS), pero el usuario auth fue creado exitosamente:", dbErr);
        }

        // Si la sesión ya se inició automáticamente
        if (data.session) {
          const sessionData = {
            username: email,
            isLoggedIn: true,
            loginTime: new Date().getTime()
          };
          localStorage.setItem('rh_admin_session', JSON.stringify(sessionData));

          successMsg.textContent = "¡Registro exitoso! Iniciando sesión...";
          successAlert.classList.remove('hidden');
          setTimeout(() => {
            window.location.href = 'admin.html';
          }, 1500);
        } else {
          // Si requiere confirmación por correo electrónico
          successMsg.textContent = "¡Registro iniciado! Por favor, verifica tu correo electrónico para confirmar la cuenta, o intenta iniciar sesión si no está activada la confirmación.";
          successAlert.classList.remove('hidden');
        }

      } else {
        // MODO LOGIN
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (error) throw error;

        // Guardar sesión en localStorage
        const sessionData = {
          username: email,
          isLoggedIn: true,
          loginTime: new Date().getTime()
        };
        localStorage.setItem('rh_admin_session', JSON.stringify(sessionData));

        successMsg.textContent = "Sesión iniciada correctamente. Redirigiendo...";
        successAlert.classList.remove('hidden');
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 1000);
      }
    } catch (err) {
      console.error(err);
      errorMsg.textContent = err.message || "Ocurrió un error en la autenticación.";
      errorAlert.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
    }
  });
});
