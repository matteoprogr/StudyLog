// auth.js - Gestione autenticazione opzionale
//import { registerPushSubscription } from "./main.js";

let currentUser = null;
let isLoginMode = true;

const { createClient } = supabase;
const supabaseClient = createClient(
  "https://mwfyrjedrqgtprcgtgti.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13ZnlyamVkcnFndHByY2d0Z3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MTk0NjQsImV4cCI6MjA4MzI5NTQ2NH0.uwA7ifZSKw-ZA7QpbcOkLHodHc9YTgezzexTc5A25TI"
);

// Verifica se l'utente è già loggato all'avvio
async function checkAuth() {
  try {
    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();

    if (error) {
      console.error("❌ Errore controllo sessione:", error);
      return;
    }

    if (session && session.user) {
      console.log("✅ Utente già autenticato:", session.user.email);
      currentUser = session.user;
      showUserSection(session.user);

      // Registra automaticamente le push notifications
      if ("serviceWorker" in navigator) {
        registerPushSubscription();
      }
    } else {
      console.log("ℹ️ Nessun utente autenticato (modalità offline)");
      showAuthSection();
    }
  } catch (err) {
    console.error("❌ Errore inaspettato:", err);
  }
}

// Mostra sezione login/registrazione
function showAuthSection() {
  const authSection = document.getElementById("auth-section");
  const userSection = document.getElementById("user-section");

  if (authSection) authSection.classList.remove("hidden");
  if (userSection) userSection.classList.add("hidden");
}

// Mostra sezione utente loggato
function showUserSection(user) {
  const authSection = document.getElementById("auth-section");
  const userSection = document.getElementById("user-section");
  const userEmail = document.getElementById("user-email");

  if (authSection) authSection.classList.add("hidden");
  if (userSection) userSection.classList.remove("hidden");
  if (userEmail) userEmail.textContent = user.email;
}

// Gestisci il LOGIN
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
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    console.log("✅ Login effettuato:", data.user.email);
    currentUser = data.user;
    showUserSection(data.user);

    // Registra push notifications
    if ("serviceWorker" in navigator) {
      await registerPushSubscription();
    }
  } catch (error) {
    console.error("❌ Errore login:", error);
    errorEl.textContent = getErrorMessage(error);
    errorEl.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Accedi";
  }
}

// Gestisci la REGISTRAZIONE
async function handleRegister(e) {
  e.preventDefault();

  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;
  const confirmPassword = document.getElementById(
    "register-confirm-password"
  ).value;
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
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    console.log("✅ Registrazione effettuata:", data);

    if (data.user && !data.session) {
      successEl.textContent =
        "Registrazione completata! Controlla la tua email per confermare l'account.";
      successEl.classList.remove("hidden");
    } else {
      console.log("✅ Utente registrato e loggato:", data.user.email);
      currentUser = data.user;
      showUserSection(data.user);

      // Registra push notifications
      if ("serviceWorker" in navigator) {
        await registerPushSubscription();
      }
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

// Gestisci il LOGOUT
async function handleLogout() {
  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) throw error;

    console.log("✅ Logout effettuato");
    currentUser = null;

    // Rimuovi la push subscription
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        console.log("✅ Push subscription rimossa");
      }
    }

    showAuthSection();
  } catch (error) {
    console.error("❌ Errore logout:", error);
    alert("Errore durante il logout");
  }
}

// Cambia tra modalità login e registrazione
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

// Traduci errori Supabase
function getErrorMessage(error) {
  const errorMessages = {
    "Invalid login credentials": "Email o password non validi",
    "Email not confirmed":
      "Email non confermata. Controlla la tua casella di posta.",
    "User already registered": "Email già registrata",
    "Password should be at least 6 characters":
      "La password deve essere di almeno 6 caratteri",
    "Unable to validate email address": "Indirizzo email non valido",
    "Signup requires a valid password": "Inserisci una password valida",
  };

  return (
    errorMessages[error.message] || error.message || "Si è verificato un errore"
  );
}

// Ascolta i cambiamenti di stato dell'autenticazione
if (typeof supabaseClient !== "undefined") {
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
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const logoutBtn = document.getElementById("logout-btn");
  const toggleAuthMode = document.getElementById("toggle-auth-mode");
  const toggleLoginMode = document.getElementById("toggle-login-mode");

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  if (registerForm) {
    registerForm.addEventListener("submit", handleRegister);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  if (toggleAuthMode) {
    toggleAuthMode.addEventListener("click", toggleAuthForm);
  }

  if (toggleLoginMode) {
    toggleLoginMode.addEventListener("click", toggleAuthForm);
  }

  // Controlla autenticazione all'avvio
  if (typeof supabaseClient !== "undefined") {
    checkAuth();
  }
});

// Esporta per uso in altri moduli
window.getCurrentUser = () => currentUser;

async function registerPushSubscription() {
  // Controlla se l'utente è loggato
  const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;

  if (!currentUser) {
    console.log("ℹ️ Push notifications disponibili solo con account");
    return;
  } else {
    console.log("currentUser:", currentUser);
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("❌ Push notifications non supportate");
    return;
  }

  try {
    // Verifica se l'utente è autenticato
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("⚠️ Utente non autenticato. Effettua il login prima.");
      return;
    }

    console.log("📬 Registrazione push notification per utente:", user.id);

    const registration = await navigator.serviceWorker.ready;

    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      console.log("✅ Push subscription già esistente");
      return existingSub;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("⚠️ Permesso notifiche negato");
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        "BAYBaa5RHouKeRnhTeVb06ki3MW7gKs8DJoUiqS7BBmeGPoLsTw1_zqBShfsx_fVswBYpcq835w1Ylhttw0dldI"
      ),
    });

    const subscriptionJSON = subscription.toJSON();

    let clientUUID = localStorage.getItem("client_uuid");
    if (!clientUUID) {
      clientUUID = crypto.randomUUID();
      localStorage.setItem("client_uuid", clientUUID);
    }

    // Salva con user_id
    const { data, error } = await supabaseClient
      .from("push_subscriptions")
      .insert({
        subscription: subscriptionJSON,
        // client_uuid: clientUUID,
        user_id: user.id, // Associa all'utente autenticato
      });

    if (error) {
      console.error("❌ Errore Supabase:", error);
    } else {
      console.log("✅ Subscription salvata per utente", user.id);
    }

    return subscription;
  } catch (error) {
    console.error("❌ Errore:", error);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
