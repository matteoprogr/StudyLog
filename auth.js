// auth.js – Gestione autenticazione + notifiche OneSignal

let currentUser = null;
let isLoginMode = true;

// ---------------- SUPABASE CLIENT ----------------
const { createClient } = supabase;
const supabaseClient = createClient(
  "https://mwfyrjedrqgtprcgtgti.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZnlyamVkcnFndHByY2d0Z3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MTk0NjQsImV4cCI6MjA4MzI5NTQ2NH0.uwA7ifZSKw-ZA7QpbcOkLHodHc9YTgezzexTc5A25TI"
);

// ---------------- UTILITY ONESIGNAL ----------------
function isPermissionGranted(permission) {
  return permission === true || permission === "granted";
}

async function enablePushForUser(userId) {
  if (!window.OneSignalDeferred) return;

  OneSignalDeferred.push(async (OneSignal) => {
    const permission = OneSignal.Notifications.permission;

    if (isPermissionGranted(permission)) {
      console.log("🔔 Notifiche già attive");
    } else if (permission === "denied") {
      console.warn("🚫 Hai bloccato le notifiche. Riattivale nelle impostazioni del browser.");
      return;
    } else {
      try {
        await OneSignal.Notifications.requestPermission();
        console.log("✅ Permesso notifiche concesso");
      } catch (err) {
        console.error("❌ Errore richiesta permessi:", err);
        return;
      }
    }

    // Collega l'utente OneSignal (external_id)
    try {
      await OneSignal.login(userId);
      console.log("✅ Utente OneSignal collegato:", userId);
      console.log("📬 Subscription:", OneSignal.User.PushSubscription);
    } catch (err) {
      console.error("❌ Errore login OneSignal:", err);
    }
  });
}

// ---------------- CHECK AUTH ----------------
async function checkAuth() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error("❌ Errore controllo sessione:", error);
      return;
    }

    if (session && session.user) {
      console.log("✅ Utente già autenticato:", session.user.email);
      currentUser = session.user;
      showUserSection(session.user);
    } else {
      console.log("ℹ️ Nessun utente autenticato (modalità offline)");
      showAuthSection();
    }
  } catch (err) {
    console.error("❌ Errore inaspettato:", err);
  }
}

// ---------------- UI SECTIONS ----------------
function showAuthSection() {
  const authSection = document.getElementById("auth-section");
  const userSection = document.getElementById("user-section");

  if (authSection) authSection.classList.remove("hidden");
  if (userSection) userSection.classList.add("hidden");
}

async function showUserSection(user) {
  const authSection = document.getElementById("auth-section");
  const userSection = document.getElementById("user-section");
  const userEmail = document.getElementById("user-email");

  if (authSection) authSection.classList.add("hidden");
  if (userSection) userSection.classList.remove("hidden");
  if (userEmail) userEmail.textContent = user.email;

  // Mostra bottone per attivare notifiche
  const pushBtn = document.getElementById("enable-push-btn");
  if (pushBtn) {
    pushBtn.classList.remove("hidden");
    pushBtn.onclick = () => enablePushForUser(user.id);
  }
}

// ---------------- LOGIN ----------------
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  const submitBtn = e.target.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  submitBtn.textContent = "Accesso in corso...";
  errorEl.textContent = "";
  errorEl.classList.add("hidden");

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    console.log("✅ Login effettuato:", data.user.email);
    currentUser = data.user;
    showUserSection(data.user);

  } catch (error) {
    console.error("❌ Errore login:", error);
    errorEl.textContent = getErrorMessage(error);
    errorEl.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Accedi";
  }
}

// ---------------- REGISTRAZIONE ----------------
async function handleRegister(e) {
  e.preventDefault();

  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;
  const confirmPassword = document.getElementById("register-confirm-password").value;
  const errorEl = document.getElementById("register-error");
  const successEl = document.getElementById("register-success");
  const submitBtn = e.target.querySelector('button[type="submit"]');

  errorEl.textContent = "";
  errorEl.classList.add("hidden");
  successEl.classList.add("hidden");

  if (password !== confirmPassword) {
    errorEl.textContent = "Le password non coincidono";
    errorEl.classList.remove("hidden");
    return;
  }

  if (password.length < 6) {
    errorEl.textContent = "La password deve essere di almeno 6 caratteri";
    errorEl.classList.remove("hidden");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Registrazione in corso...";

  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;

    console.log("✅ Registrazione effettuata:", data);

    if (data.user && !data.session) {
      successEl.textContent = "Registrazione completata! Controlla la tua email per confermare l'account.";
      successEl.classList.remove("hidden");
    } else {
      currentUser = data.user;
      showUserSection(data.user);
    }
  } catch (error) {
    console.error("❌ Errore registrazione:", error);
    errorEl.textContent = getErrorMessage(error);
    errorEl.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Registrati";
  }
}

// ---------------- LOGOUT ----------------
async function handleLogout() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;

    console.log("✅ Logout effettuato");
    currentUser = null;

    showAuthSection();
  } catch (error) {
    console.error("❌ Errore logout:", error);
    alert("Errore durante il logout");
  }
}

// ---------------- TOGGLE LOGIN/REGISTER ----------------
function toggleAuthForm() {
  isLoginMode = !isLoginMode;

  const loginContainer = document.getElementById("login-container");
  const registerContainer = document.getElementById("register-container");

  if (isLoginMode) {
    loginContainer.classList.remove("hidden");
    registerContainer.classList.add("hidden");
  } else {
    loginContainer.classList.add("hidden");
    registerContainer.classList.remove("hidden");
  }
}

// ---------------- ERROR MESSAGES ----------------
function getErrorMessage(error) {
  const errorMessages = {
    "Invalid login credentials": "Email o password non validi",
    "Email not confirmed": "Email non confermata. Controlla la tua casella di posta.",
    "User already registered": "Email già registrata",
    "Password should be at least 6 characters": "La password deve essere di almeno 6 caratteri",
    "Unable to validate email address": "Indirizzo email non valido",
    "Signup requires a valid password": "Inserisci una password valida",
  };

  return errorMessages[error.message] || error.message || "Si è verificato un errore";
}

// ---------------- AUTH STATE CHANGE ----------------
supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log("🔄 Auth state changed:", event);

  if (event === "SIGNED_IN" && session) {
    currentUser = session.user;
    showUserSection(session.user);
  } else if (event === "SIGNED_OUT") {
    currentUser = null;
    showAuthSection();
  }
});

// ---------------- EVENT LISTENERS ----------------
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const logoutBtn = document.getElementById("logout-btn");
  const toggleAuthMode = document.getElementById("toggle-auth-mode");
  const toggleLoginMode = document.getElementById("toggle-login-mode");

  if (loginForm) loginForm.addEventListener("submit", handleLogin);
  if (registerForm) registerForm.addEventListener("submit", handleRegister);
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
  if (toggleAuthMode) toggleAuthMode.addEventListener("click", toggleAuthForm);
  if (toggleLoginMode) toggleLoginMode.addEventListener("click", toggleAuthForm);

  // Controlla autenticazione all'avvio
  checkAuth();
});

// ---------------- EXPORT CURRENT USER ----------------
window.getCurrentUser = () => currentUser;
