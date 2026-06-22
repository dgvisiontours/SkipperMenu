import { CONFIG } from "./config.js";
import { BREAKFAST_RECIPES, PRODUCTS as FALLBACK_PRODUCTS } from "./catalog.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const views = ["#loadingView", "#setupView", "#authView", "#appView"];
const state = {
  session: null,
  profile: null,
  products: [],
  quantities: new Map(),
  activeCategory: "Wszystkie",
  activeRecipeCategory: "Wszystkie",
  activePanel: "skipper",
  report: null,
  demo: false,
  dirty: false,
  dietSetupRequired: false,
  newTurnusMode: false,
};

const DEMO_REPORT = {
  target_date: tomorrowDate(),
  total_boats: 8,
  total_people: 58,
  submitted_boats: 6,
  missing_boats: ["Mewa", "Perkoz"],
  diet_totals: [
    { label: "Wegetariańska", count: 7 },
    { label: "Bez laktozy", count: 4 },
    { label: "Bez glutenu", count: 3 },
    { label: "Bez orzechów", count: 1 },
  ],
  consolidated: [
    { product_name: "Jajka", unit: "szt.", total_quantity: 63, boats: ["Bajka: 20", "Bryza: 10", "Czapla: 13", "Delfin: 20"] },
    { product_name: "Parówki", unit: "szt.", total_quantity: 44, boats: ["Bajka: 14", "Bryza: 20", "Czapla: 10"] },
    { product_name: "Banany", unit: "szt.", total_quantity: 22, boats: ["Bryza: 4", "Czapla: 4", "Delfin: 7", "Foka: 7"] },
    { product_name: "Skyr owocowy", unit: "szt.", total_quantity: 14, boats: ["Delfin: 7", "Foka: 7"] },
    { product_name: "Bułki kajzerki", unit: "szt.", total_quantity: 21, boats: ["Bajka: 7", "Delfin: 7", "Foka: 7"] },
    { product_name: "Awokado", unit: "szt.", total_quantity: 8, boats: ["Bryza: 4", "Czapla: 2", "Foka: 2"] },
    { product_name: "Mleko", unit: "l", total_quantity: 4, boats: ["Bajka: 1", "Czapla: 2", "Foka: 1"] },
  ],
  boats: [
    { boat_name: "Bajka", skipper_name: "Maciek", location: "cruise", crew_profile: { total: 8 }, submitted_at: new Date().toISOString(), diet_notes: "", special_requests: "Woda smakowa, bułki hot dog", items: [["Parówki", 14, "szt."], ["Jajka", 20, "szt."], ["Mleko", 1, "l"]] },
    { boat_name: "Bryza", skipper_name: "Kuba", location: "zofiowka", crew_profile: { total: 7 }, submitted_at: new Date().toISOString(), diet_notes: "1 osoba bez laktozy", special_requests: "Cytryny, woda gazowana", items: [["Bułki kajzerki", 7, "szt."], ["Jajka", 10, "szt."], ["Banany", 4, "szt."]] },
    { boat_name: "Czapla", skipper_name: "Oliwka", location: "cruise", crew_profile: { total: 7 }, submitted_at: new Date().toISOString(), diet_notes: "2 wege", special_requests: "Kawa rozpuszczalna", items: [["Jajka", 13, "szt."], ["Parówki", 10, "szt."], ["Mleko", 2, "l"]] },
    { boat_name: "Delfin", skipper_name: "Rafał", location: "cruise", crew_profile: { total: 8 }, submitted_at: new Date().toISOString(), diet_notes: "", special_requests: "", items: [["Jajka", 20, "szt."], ["Banany", 7, "szt."], ["Skyr owocowy", 7, "szt."]] },
    { boat_name: "Foka", skipper_name: "Olga", location: "zofiowka", crew_profile: { total: 7 }, submitted_at: new Date().toISOString(), diet_notes: "1 wege", special_requests: "Brzoskwinie", items: [["Bułki kajzerki", 7, "szt."], ["Banany", 7, "szt."], ["Skyr owocowy", 7, "szt."]] },
    { boat_name: "Goplana", skipper_name: "Krzysiu", location: "cruise", crew_profile: { total: 7 }, submitted_at: new Date().toISOString(), diet_notes: "", special_requests: "Kawa rozpuszczalna", items: [["Bułki kajzerki", 7, "szt."], ["Awokado", 2, "szt."], ["Mleko", 1, "l"]] },
  ],
};

function showView(selector) {
  views.forEach((view) => $(view).classList.toggle("hidden", view !== selector));
}

function toast(message, isError = false) {
  const element = $("#toast");
  element.textContent = message;
  element.style.background = isError ? "#8d3d34" : "#173f45";
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 3200);
}

function configured() {
  return !CONFIG.SUPABASE_URL.includes("TWOJ-PROJEKT") && !CONFIG.SUPABASE_ANON_KEY.includes("TU_WKLEJ");
}

function supabaseBaseUrl() {
  return CONFIG.SUPABASE_URL
    .trim()
    .replace(/\/+(?:rest|auth)\/v1\/?$/i, "")
    .replace(/\/+$/, "");
}

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function todayDate() {
  const p = localParts();
  return `${p.year}-${p.month}-${p.day}`;
}

function tomorrowDate() {
  const [year, month, day] = todayDate().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
}

function orderWindowState() {
  const { hour } = localParts();
  const currentHour = Number(hour);
  if (currentHour < CONFIG.ORDER_OPEN_HOUR) return "before";
  if (currentHour >= CONFIG.CUTOFF_HOUR) return "after";
  return "open";
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: CONFIG.TIMEZONE, weekday: "long", day: "numeric", month: "long",
  }).format(new Date(`${dateString}T12:00:00Z`));
}

async function api(path, { method = "GET", body, auth = true, headers = {} } = {}) {
  if (!state.session && auth) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  const response = await fetch(`${supabaseBaseUrl()}/${path.replace(/^\/+/, "")}`, {
    method,
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${auth ? state.session.access_token : CONFIG.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error_description || error.hint || `Błąd ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function saveSession(session) {
  state.session = session;
  if (session) localStorage.setItem("proviant-session", JSON.stringify(session));
  else localStorage.removeItem("proviant-session");
}

async function restoreSession() {
  const saved = JSON.parse(localStorage.getItem("proviant-session") || "null");
  if (!saved) return false;
  if (saved.expires_at && saved.expires_at * 1000 > Date.now() + 60_000) {
    state.session = saved;
    return true;
  }
  if (!saved.refresh_token) return false;
  try {
    const refreshed = await api("/auth/v1/token?grant_type=refresh_token", {
      method: "POST", auth: false, body: { refresh_token: saved.refresh_token },
    });
    refreshed.expires_at = Math.floor(Date.now() / 1000) + refreshed.expires_in;
    saveSession(refreshed);
    return true;
  } catch {
    saveSession(null);
    return false;
  }
}

async function loadProfileAndProducts() {
  const userId = state.session.user.id;
  const [profiles, products] = await Promise.all([
    api(`/rest/v1/profiles?select=id,full_name,role,boat_id,diet_preferences,boats(name,crew_profile)&id=eq.${userId}`),
    api("/rest/v1/products?select=id,name,category,unit,sort_order&active=eq.true&order=sort_order.asc"),
  ]);
  if (!profiles[0]) throw new Error("Brak profilu użytkownika. Uruchom ponownie skrypt schema.sql.");
  state.profile = profiles[0];
  state.products = products;
}

function enterDemo() {
  state.demo = true;
  state.profile = {
    full_name: "Daniel (demo)", role: "admin", boat_id: "demo-boat", boats: { name: "Bajka" },
    diet_preferences: null,
  };
  state.products = FALLBACK_PRODUCTS;
  state.report = DEMO_REPORT;
  openApp();
}

function openApp() {
  showView("#appView");
  $("#userMenu").classList.remove("hidden");
  $("#userLabel").textContent = `${state.profile.full_name} · ${state.profile.boats?.name || roleName(state.profile.role)}`;
  $("#newTurnusButton").classList.toggle(
    "hidden",
    !["skipper", "admin"].includes(state.profile.role) || !state.profile.boat_id,
  );
  renderNavigation();
  setupOrderPanel();
  renderDietSummary();
  renderRecipeFilters();
  renderRecipes();
  updateDeadline();
  const role = state.profile.role;
  switchPanel(role === "supplier" ? "supplier" : "skipper");
  if (
    ["skipper", "admin"].includes(role)
    && state.profile.boat_id
    && (!state.profile.diet_preferences || !state.profile.boats?.crew_profile)
  ) {
    openDietModal(true);
  }
}

function roleName(role) {
  return ({ skipper: "sternik", supplier: "zaopatrzenie", admin: "administrator" })[role] || role;
}

function renderNavigation() {
  const nav = $("#appNav");
  const canOrder = ["skipper", "admin"].includes(state.profile.role);
  const canReport = ["supplier", "admin"].includes(state.profile.role);
  nav.innerHTML = [
    canOrder ? `<button data-panel="skipper">Zamówienie jachtu</button>` : "",
    `<button data-panel="breakfast">Baza śniadań</button>`,
    canReport ? `<button data-panel="supplier">Raport zaopatrzenia</button>` : "",
  ].join("");
  nav.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => switchPanel(button.dataset.panel)));
}

function switchPanel(panel) {
  state.activePanel = panel;
  $("#skipperPanel").classList.toggle("hidden", panel !== "skipper");
  $("#breakfastPanel").classList.toggle("hidden", panel !== "breakfast");
  $("#supplierPanel").classList.toggle("hidden", panel !== "supplier");
  $("#deadlineCard").classList.toggle("hidden", panel === "breakfast");
  $$("#appNav button").forEach((button) => button.classList.toggle("active", button.dataset.panel === panel));
  if (panel === "skipper") {
    $("#roleEyebrow").textContent = "Panel sternika";
    $("#heroTitle").textContent = "Zamówienie na jutro";
    $("#heroSubtitle").textContent = `${state.profile.boats?.name || "Twój jacht"} · wydanie ${formatDate(tomorrowDate())}`;
    loadMyOrder();
  } else if (panel === "breakfast") {
    $("#roleEyebrow").textContent = "Baza śniadań";
    $("#heroTitle").textContent = "Pomysły do jachtowego kambuzu";
    $("#heroSubtitle").textContent = "Przepisy stworzone z myślą o małej kuchni, jednej patelni i głodnej załodze.";
    renderRecipes();
  } else {
    $("#roleEyebrow").textContent = "Panel zaopatrzeniowca";
    $("#heroTitle").textContent = "Jedna lista. Cała flotylla.";
    $("#heroSubtitle").textContent = "Zakupy zbiorcze i osobne paczki dla każdego jachtu.";
    $("#reportDate").value ||= tomorrowDate();
    loadReport();
  }
}

function updateDeadline() {
  const windowState = orderWindowState();
  const closed = windowState !== "open";
  $("#deadlineCard").classList.toggle("closed", closed);
  $("#deadlineTime").textContent = `${String(CONFIG.ORDER_OPEN_HOUR).padStart(2, "0")}:00–${String(CONFIG.CUTOFF_HOUR).padStart(2, "0")}:00`;
  $("#deadlineStatus").textContent = windowState === "before"
    ? `Zamówienia otwierają się o ${String(CONFIG.ORDER_OPEN_HOUR).padStart(2, "0")}:00`
    : windowState === "after"
      ? "Przyjmowanie zamówień zakończone"
      : "Zamówienia są otwarte";
  $("#submitOrderButton").disabled = closed && state.profile.role === "skipper";
  $("#submitHeadline").textContent = windowState === "before"
    ? `Zamówienia można zmieniać od ${String(CONFIG.ORDER_OPEN_HOUR).padStart(2, "0")}:00`
    : windowState === "after"
      ? "Termin składania zamówień minął"
      : "Zamówienie można jeszcze edytować";
}

function setupOrderPanel() {
  renderCategoryFilters();
  renderProducts();
}

function emptyDietPreferences() {
  return {
    no_diets: false,
    vegetarian: { enabled: false, count: 1 },
    lactose_free: { enabled: false, count: 1 },
    gluten_free: { enabled: false, count: 1 },
    other: { enabled: false, count: 1, description: "" },
  };
}

function dietPreferencesText(preferences = state.profile?.diet_preferences) {
  if (!preferences) return "Profil nie został jeszcze uzupełniony";
  if (preferences.no_diets) return "Brak diet i alergii";
  const items = [];
  if (preferences.vegetarian?.enabled) items.push(`${preferences.vegetarian.count} wege`);
  if (preferences.lactose_free?.enabled) items.push(`${preferences.lactose_free.count} bez laktozy`);
  if (preferences.gluten_free?.enabled) items.push(`${preferences.gluten_free.count} bez glutenu`);
  if (preferences.other?.enabled) items.push(`${preferences.other.count} inne: ${preferences.other.description}`);
  return items.join(" · ") || "Brak diet i alergii";
}

function renderDietSummary() {
  const summary = $("#dietSummary");
  if (!summary) return;
  const preferences = state.profile?.diet_preferences;
  const crew = state.profile?.boats?.crew_profile;
  if (!preferences || !crew) {
    summary.innerHTML = `<span class="diet-pill warning">Wymaga uzupełnienia</span>`;
    return;
  }
  const typeLabel = crew.boat_type === "training" ? "jacht szkoleniowy" : "jacht rekreacyjny";
  const crewPills = [
    `<span class="diet-pill crew">${escapeHtml(typeLabel)}</span>`,
    `<span class="diet-pill crew">${crew.total} osób · ${crew.women} K · ${crew.men} M</span>`,
  ];
  if (preferences.no_diets) {
    summary.innerHTML = `${crewPills.join("")}<span class="diet-pill neutral">Brak diet i alergii</span>`;
    return;
  }
  const pills = [];
  if (preferences.vegetarian?.enabled) pills.push(`${preferences.vegetarian.count} × wege`);
  if (preferences.lactose_free?.enabled) pills.push(`${preferences.lactose_free.count} × bez laktozy`);
  if (preferences.gluten_free?.enabled) pills.push(`${preferences.gluten_free.count} × bez glutenu`);
  if (preferences.other?.enabled) pills.push(`${preferences.other.count} × ${preferences.other.description}`);
  summary.innerHTML = crewPills.join("") + pills.map((text) => `<span class="diet-pill">${escapeHtml(text)}</span>`).join("");
}

function syncDietFormState() {
  const form = $("#dietForm");
  const noDiets = form.elements.noDiets.checked;
  ["vegetarian", "lactoseFree", "glutenFree", "other"].forEach((key) => {
    const enabled = form.elements[`${key}Enabled`];
    const count = form.elements[`${key}Count`];
    if (noDiets) enabled.checked = false;
    enabled.disabled = noDiets;
    count.disabled = noDiets || !enabled.checked;
  });
  form.elements.otherDescription.disabled = noDiets || !form.elements.otherEnabled.checked;
  $$(".diet-option").forEach((row) => {
    const checkbox = row.querySelector('input[type="checkbox"]');
    row.classList.toggle("selected", checkbox.checked);
    row.classList.toggle("disabled", checkbox.disabled);
  });
}

function openDietModal(required = false) {
  state.newTurnusMode = false;
  state.dietSetupRequired = required;
  const preferences = state.profile?.diet_preferences || emptyDietPreferences();
  const form = $("#dietForm");
  form.elements.vegetarianEnabled.checked = Boolean(preferences.vegetarian?.enabled);
  form.elements.vegetarianCount.value = preferences.vegetarian?.count || 1;
  form.elements.lactoseFreeEnabled.checked = Boolean(preferences.lactose_free?.enabled);
  form.elements.lactoseFreeCount.value = preferences.lactose_free?.count || 1;
  form.elements.glutenFreeEnabled.checked = Boolean(preferences.gluten_free?.enabled);
  form.elements.glutenFreeCount.value = preferences.gluten_free?.count || 1;
  form.elements.otherEnabled.checked = Boolean(preferences.other?.enabled);
  form.elements.otherCount.value = preferences.other?.count || 1;
  form.elements.otherDescription.value = preferences.other?.description || "";
  form.elements.noDiets.checked = Boolean(preferences.no_diets);
  const crew = state.profile?.boats?.crew_profile || {};
  const boatType = form.querySelector(`input[name="boatType"][value="${crew.boat_type || ""}"]`);
  form.querySelectorAll('input[name="boatType"]').forEach((input) => { input.checked = false; });
  if (boatType) boatType.checked = true;
  form.elements.crewTotal.value = crew.total ?? "";
  form.elements.womenCount.value = crew.women ?? "";
  form.elements.menCount.value = crew.men ?? "";
  $("#dietFormError").classList.add("hidden");
  $("#closeDietModalButton").classList.toggle("hidden", required);
  $("#newTurnusBoatField").classList.add("hidden");
  form.elements.newBoatName.value = "";
  $("#dietModalTitle").textContent = required ? "Najpierw ustaw profil załogi" : "Profil jachtu i załogi";
  $("#dietModalDescription").textContent = "Zaznacz występujące diety i podaj liczbę osób.";
  $("#dietModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
  syncDietFormState();
}

function openNewTurnusModal() {
  state.newTurnusMode = true;
  state.dietSetupRequired = false;
  const form = $("#dietForm");
  const preferences = emptyDietPreferences();
  form.elements.vegetarianEnabled.checked = preferences.vegetarian.enabled;
  form.elements.vegetarianCount.value = 1;
  form.elements.lactoseFreeEnabled.checked = preferences.lactose_free.enabled;
  form.elements.lactoseFreeCount.value = 1;
  form.elements.glutenFreeEnabled.checked = preferences.gluten_free.enabled;
  form.elements.glutenFreeCount.value = 1;
  form.elements.otherEnabled.checked = preferences.other.enabled;
  form.elements.otherCount.value = 1;
  form.elements.otherDescription.value = "";
  form.elements.noDiets.checked = false;
  form.querySelectorAll('input[name="boatType"]').forEach((input) => { input.checked = false; });
  form.elements.crewTotal.value = "";
  form.elements.womenCount.value = "";
  form.elements.menCount.value = "";
  form.elements.newBoatName.value = "";
  $("#newTurnusBoatField").classList.remove("hidden");
  $("#closeDietModalButton").classList.remove("hidden");
  $("#dietModalTitle").textContent = "Rozpocznij nowy turnus";
  $("#dietModalDescription").textContent = "Podaj nowy jacht i ustaw diety jego załogi. Historia poprzedniego turnusu pozostanie bez zmian.";
  $("#dietFormError").classList.add("hidden");
  $("#saveDietsButton").textContent = "Rozpocznij nowy turnus";
  $("#dietModal").classList.remove("hidden");
  document.body.classList.add("modal-open");
  syncDietFormState();
}

function closeDietModal() {
  if (state.dietSetupRequired) return;
  $("#dietModal").classList.add("hidden");
  document.body.classList.remove("modal-open");
  state.newTurnusMode = false;
  $("#saveDietsButton").textContent = "Zapisz profil załogi";
}

function collectDietPreferences() {
  const form = $("#dietForm");
  return {
    no_diets: form.elements.noDiets.checked,
    vegetarian: {
      enabled: form.elements.vegetarianEnabled.checked,
      count: Number(form.elements.vegetarianCount.value) || 0,
    },
    lactose_free: {
      enabled: form.elements.lactoseFreeEnabled.checked,
      count: Number(form.elements.lactoseFreeCount.value) || 0,
    },
    gluten_free: {
      enabled: form.elements.glutenFreeEnabled.checked,
      count: Number(form.elements.glutenFreeCount.value) || 0,
    },
    other: {
      enabled: form.elements.otherEnabled.checked,
      count: Number(form.elements.otherCount.value) || 0,
      description: form.elements.otherDescription.value.trim(),
    },
  };
}

function collectCrewProfile() {
  const form = $("#dietForm");
  return {
    boat_type: form.querySelector('input[name="boatType"]:checked')?.value || "",
    total: Number(form.elements.crewTotal.value) || 0,
    women: Number(form.elements.womenCount.value) || 0,
    men: Number(form.elements.menCount.value) || 0,
  };
}

function validateCrewProfile(crew) {
  if (!["recreational", "training"].includes(crew.boat_type)) return "Wybierz, czy jacht jest rekreacyjny, czy szkoleniowy.";
  if (crew.total < 1) return "Podaj liczbę wszystkich osób w załodze.";
  if (crew.women < 0 || crew.men < 0 || crew.women + crew.men !== crew.total) {
    return "Liczba kobiet i mężczyzn musi być równa liczbie wszystkich osób.";
  }
  return "";
}

function validateDietPreferences(preferences, crewTotal = 0) {
  const enabled = [preferences.vegetarian, preferences.lactose_free, preferences.gluten_free, preferences.other]
    .filter((diet) => diet.enabled);
  if (!preferences.no_diets && enabled.length === 0) return "Wybierz przynajmniej jedną dietę albo zaznacz brak diet.";
  if (preferences.no_diets && enabled.length) return "Nie można jednocześnie wybrać diet i braku diet.";
  if (enabled.some((diet) => diet.count < 1)) return "Podaj liczbę osób dla każdej zaznaczonej diety.";
  if (crewTotal > 0 && enabled.some((diet) => diet.count > crewTotal)) {
    return "Liczba osób na diecie nie może przekraczać liczby osób w załodze.";
  }
  if (preferences.other.enabled && !preferences.other.description) return "Wpisz nazwę innej diety lub alergii.";
  return "";
}

async function saveDietPreferences(event) {
  event.preventDefault();
  const preferences = collectDietPreferences();
  const crewProfile = collectCrewProfile();
  let error = validateCrewProfile(crewProfile) || validateDietPreferences(preferences, crewProfile.total);
  const newBoatName = $("#dietForm").elements.newBoatName.value.trim();
  if (state.newTurnusMode && newBoatName.length < 2) error = "Podaj nazwę jachtu na nowy turnus.";
  const errorElement = $("#dietFormError");
  if (error) {
    errorElement.textContent = error;
    errorElement.classList.remove("hidden");
    return;
  }
  const button = $("#saveDietsButton");
  button.disabled = true;
  button.textContent = state.newTurnusMode ? "Tworzenie turnusu…" : "Zapisywanie…";
  try {
    if (state.newTurnusMode) {
      const currentBoatName = state.profile.boats?.name || "obecny jacht";
      const confirmed = window.confirm(
        `Czy na pewno rozpocząć nowy turnus na jachcie „${newBoatName}”?\n\n`
        + `Jacht „${currentBoatName}” zostanie zdezaktywowany, a bieżąca lista zamówienia zostanie wyczyszczona. Historii poprzedniego turnusu nie usuniemy.`,
      );
      if (!confirmed) {
        button.disabled = false;
        button.textContent = "Rozpocznij nowy turnus";
        return;
      }
      let result;
      if (state.demo) {
        result = {
          boat_id: `demo-${Date.now()}`, boat_name: newBoatName,
          diet_preferences: preferences, crew_profile: crewProfile,
        };
      } else {
        result = await api("/rest/v1/rpc/start_new_turnus", {
          method: "POST",
          body: { p_boat_name: newBoatName, p_preferences: preferences, p_crew_profile: crewProfile },
        });
      }
      state.profile.boat_id = result.boat_id;
      state.profile.boats = { name: result.boat_name };
      state.profile.diet_preferences = result.diet_preferences;
      state.profile.boats.crew_profile = result.crew_profile;
      state.quantities.clear();
      $("#specialRequests").value = "";
      $$('input[name="orderLocation"]').forEach((input) => { input.checked = false; });
      $("#userLabel").textContent = `${state.profile.full_name} · ${result.boat_name}`;
      $("#heroSubtitle").textContent = `${result.boat_name} · wydanie ${formatDate(tomorrowDate())}`;
      renderProducts();
      renderDietSummary();
      closeDietModal();
      toast(`Nowy turnus na jachcie „${result.boat_name}” jest gotowy.`);
      return;
    }
    if (!state.demo) {
      await api("/rest/v1/rpc/save_crew_profile", {
        method: "POST", body: { p_preferences: preferences, p_crew_profile: crewProfile },
      });
    }
    state.profile.diet_preferences = preferences;
    state.profile.boats.crew_profile = crewProfile;
    state.dietSetupRequired = false;
    renderDietSummary();
    closeDietModal();
    toast("Profil jachtu i załogi został zapisany.");
  } catch (saveError) {
    errorElement.textContent = saveError.message;
    errorElement.classList.remove("hidden");
  } finally {
    button.disabled = false;
    button.textContent = state.newTurnusMode ? "Rozpocznij nowy turnus" : "Zapisz profil załogi";
  }
}

function renderRecipeFilters() {
  const categories = ["Wszystkie", ...new Set(BREAKFAST_RECIPES.map((recipe) => recipe.category))];
  $("#recipeFilters").innerHTML = categories.map((category) =>
    `<button class="chip ${category === state.activeRecipeCategory ? "active" : ""}" data-recipe-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  ).join("");
  $$("#recipeFilters button").forEach((button) => button.addEventListener("click", () => {
    state.activeRecipeCategory = button.dataset.recipeCategory;
    renderRecipeFilters();
    renderRecipes();
  }));
}

function renderRecipes() {
  const query = $("#recipeSearch").value.trim().toLocaleLowerCase("pl");
  const recipes = BREAKFAST_RECIPES.filter((recipe) => {
    const searchable = [recipe.name, recipe.category, ...recipe.ingredients].join(" ").toLocaleLowerCase("pl");
    return (state.activeRecipeCategory === "Wszystkie" || recipe.category === state.activeRecipeCategory)
      && searchable.includes(query);
  });
  $("#recipeList").innerHTML = recipes.length ? recipes.map((recipe, index) => `
    <details class="recipe-card" ${index === 0 && !query ? "open" : ""}>
      <summary>
        <div>
          <span class="recipe-category">${escapeHtml(recipe.category)}</span>
          <h3>${escapeHtml(recipe.name)}</h3>
        </div>
        <div class="recipe-meta">
          <span>${escapeHtml(recipe.time)}</span>
          <span>${escapeHtml(recipe.difficulty)}</span>
          <b aria-hidden="true">+</b>
        </div>
      </summary>
      <div class="recipe-body">
        <section>
          <h4>Składniki</h4>
          <ul>${recipe.ingredients.map((ingredient) => `<li>${escapeHtml(ingredient)}</li>`).join("")}</ul>
        </section>
        <section>
          <h4>Przygotowanie</h4>
          <ol>${recipe.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
        </section>
        <aside><strong>Wskazówka na jacht:</strong> ${escapeHtml(recipe.tip)}</aside>
      </div>
    </details>
  `).join("") : `<div class="empty">Nie znaleziono takiego przepisu ani składnika.</div>`;
}

function renderCategoryFilters() {
  const categories = ["Wszystkie", ...new Set(state.products.map((product) => product.category))];
  $("#categoryFilters").innerHTML = categories.map((category) =>
    `<button class="chip ${category === state.activeCategory ? "active" : ""}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  ).join("");
  $$("#categoryFilters button").forEach((button) => button.addEventListener("click", () => {
    state.activeCategory = button.dataset.category;
    renderCategoryFilters();
    renderProducts();
  }));
}

function renderProducts() {
  const query = $("#productSearch").value.trim().toLocaleLowerCase("pl");
  const filtered = state.products.filter((product) =>
    (state.activeCategory === "Wszystkie" || product.category === state.activeCategory)
    && product.name.toLocaleLowerCase("pl").includes(query)
  );
  $("#productList").innerHTML = filtered.length ? filtered.map((product) => {
    const quantity = state.quantities.get(product.id) || 0;
    return `<article class="product-row ${quantity > 0 ? "selected" : ""}" data-product="${product.id}">
      <div class="product-name"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)} · ${escapeHtml(product.unit)}</small></div>
      <div class="stepper">
        <button type="button" data-step="-1" aria-label="Zmniejsz">−</button>
        <input type="number" inputmode="decimal" min="0" step="0.5" value="${quantity || ""}" placeholder="0" aria-label="Ilość ${escapeHtml(product.name)}" />
        <button type="button" data-step="1" aria-label="Zwiększ">+</button>
      </div>
    </article>`;
  }).join("") : `<div class="empty">Nie znaleziono produktu. Możesz dopisać prośbę w polu „Specjalne prośby”.</div>`;

  $$(".product-row").forEach((row) => {
    const input = row.querySelector("input");
    row.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
      setQuantity(row.dataset.product, Math.max(0, (Number(input.value) || 0) + Number(button.dataset.step)));
    }));
    input.addEventListener("input", () => {
      const quantity = Math.max(0, Number(input.value) || 0);
      if (quantity > 0) state.quantities.set(row.dataset.product, quantity);
      else state.quantities.delete(row.dataset.product);
      state.dirty = true;
      row.classList.toggle("selected", quantity > 0);
      updateOrderSummary();
    });
    input.addEventListener("change", renderProducts);
  });
  updateOrderSummary();
}

function setQuantity(productId, quantity) {
  if (quantity > 0) state.quantities.set(productId, quantity);
  else state.quantities.delete(productId);
  state.dirty = true;
  renderProducts();
}

function updateOrderSummary() {
  $("#selectedCount").textContent = state.quantities.size;
  $("#saveState").textContent = state.dirty ? "Zmiany niezapisane" : "Wersja zapisana";
}

async function loadMyOrder() {
  state.quantities.clear();
  $$('input[name="orderLocation"]').forEach((input) => { input.checked = false; });
  if (state.demo) {
    [["demo-34", 20], ["demo-5", 7], ["demo-64", 8], ["demo-47", 2]].forEach(([id, qty]) => state.quantities.set(id, qty));
    $("#specialRequests").value = "Zgrzewka wody gazowanej";
    $('input[name="orderLocation"][value="cruise"]').checked = true;
    state.dirty = false;
    renderProducts();
    return;
  }
  try {
    const rows = await api(`/rest/v1/orders?select=id,special_requests,location,submitted_at,order_items(product_id,quantity)&target_date=eq.${tomorrowDate()}&limit=1`);
    const order = rows[0];
    if (order) {
      order.order_items.forEach((item) => state.quantities.set(item.product_id, Number(item.quantity)));
      $("#specialRequests").value = order.special_requests || "";
      const locationInput = $(`input[name="orderLocation"][value="${order.location || ""}"]`);
      if (locationInput) locationInput.checked = true;
    }
    state.dirty = false;
    renderProducts();
  } catch (error) {
    toast(error.message, true);
  }
}

async function submitOrder() {
  if (!state.profile.diet_preferences || !state.profile.boats?.crew_profile) {
    openDietModal(true);
    toast("Przed pierwszym zamówieniem uzupełnij profil jachtu i załogi.", true);
    return;
  }
  const windowState = orderWindowState();
  if (windowState !== "open" && state.profile.role === "skipper") {
    const message = windowState === "before"
      ? `Zamówienia można zmieniać od ${String(CONFIG.ORDER_OPEN_HOUR).padStart(2, "0")}:00.`
      : `Termin minął o ${String(CONFIG.CUTOFF_HOUR).padStart(2, "0")}:00. Skontaktuj się z zaopatrzeniowcem.`;
    toast(message, true);
    return;
  }
  const items = [...state.quantities].map(([product_id, quantity]) => ({ product_id, quantity }));
  const location = $('input[name="orderLocation"]:checked')?.value;
  if (!location) {
    toast("Wybierz: W Rejsie albo W Zofiówce.", true);
    $(".location-card").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const payload = {
    p_target_date: tomorrowDate(),
    p_diet_notes: dietPreferencesText(),
    p_special_requests: $("#specialRequests").value.trim(),
    p_breakfast_choices: [],
    p_items: items,
    p_location: location,
  };
  const button = $("#submitOrderButton");
  button.disabled = true;
  button.textContent = "Zapisywanie…";
  try {
    if (!state.demo) await api("/rest/v1/rpc/submit_order", { method: "POST", body: payload });
    await new Promise((resolve) => setTimeout(resolve, state.demo ? 450 : 0));
    state.dirty = false;
    updateOrderSummary();
    toast("Zamówienie zapisane. Zaopatrzeniowiec widzi już nową wersję.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = orderWindowState() !== "open" && state.profile.role === "skipper";
    button.textContent = "Zapisz zamówienie";
  }
}

async function loadReport() {
  try {
    const date = $("#reportDate").value || tomorrowDate();
    state.report = state.demo ? { ...DEMO_REPORT, target_date: date } : await api("/rest/v1/rpc/get_supplier_report", {
      method: "POST", body: { p_target_date: date },
    });
    renderReport();
  } catch (error) {
    toast(error.message, true);
  }
}

function renderReport() {
  const report = state.report || { consolidated: [], boats: [], missing_boats: [] };
  const missing = report.missing_boats || [];
  const standardStats = [
    [report.submitted_boats || 0, "Jachty z zamówieniem"],
    [report.total_boats || 0, "Wszystkie aktywne jachty"],
    [report.total_people || 0, "Osoby na jachtach"],
  ].map(([value, label]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
  $("#reportStats").innerHTML = `${standardStats}
    <div class="stat missing-stat">
      <strong>${missing.length}</strong>
      <span>Jachty bez zamówienia</span>
      <small>${missing.length ? escapeHtml(missing.join(", ")) : "Wszystkie jachty złożyły zamówienie"}</small>
    </div>`;
  const dietTotals = report.diet_totals || [];
  $("#dietReportSummary").innerHTML = dietTotals.length
    ? dietTotals.map((diet) => `<div class="diet-total"><strong>${formatNumber(diet.count)}</strong><span>${escapeHtml(diet.label)}</span></div>`).join("")
    : `<span class="empty-inline">Brak zgłoszonych diet na aktywnych jachtach.</span>`;

  const query = $("#reportSearch").value.trim().toLocaleLowerCase("pl");
  const consolidated = (report.consolidated || []).filter((item) => item.product_name.toLocaleLowerCase("pl").includes(query));
  $("#consolidatedList").innerHTML = consolidated.length ? `<table>
    <thead><tr><th>Produkt</th><th>Ilość całkowita</th></tr></thead>
    <tbody>${consolidated.map((item) => `<tr>
      <td><strong>${escapeHtml(item.product_name)}</strong></td>
      <td class="qty">${formatNumber(item.total_quantity)} ${escapeHtml(item.unit)}</td>
    </tr>`).join("")}</tbody>
  </table>` : `<div class="empty">Brak pozycji dla wybranego dnia.</div>`;

  $("#boatPackages").innerHTML = [
    ...((report.boats || []).map((boat) => `<details class="boat-card" open>
      <summary><strong>${escapeHtml(boat.boat_name)}</strong><span>${escapeHtml(boat.skipper_name || "")} · ${boat.crew_profile?.total || 0} osób · ${boat.items?.length || 0} pozycji</span></summary>
      <div class="boat-body">
        <div class="location-badge ${boat.location || "unknown"}">${
          boat.location === "zofiowka" ? "W Zofiówce"
            : boat.location === "cruise" ? "W Rejsie"
              : "Brak informacji o miejscu"
        }</div>
        <ul>${(boat.items || []).map(([name, qty, unit]) => `<li>${escapeHtml(name)} — <strong>${formatNumber(qty)} ${escapeHtml(unit)}</strong></li>`).join("")}</ul>
        ${boat.diet_notes ? `<div class="boat-note"><strong>Diety:</strong> ${escapeHtml(boat.diet_notes)}</div>` : ""}
        ${boat.special_requests ? `<div class="boat-note"><strong>Specjalne:</strong> ${escapeHtml(boat.special_requests)}</div>` : ""}
      </div>
    </details>`)),
  ].join("") || `<div class="empty">Żaden jacht jeszcze nie wysłał zamówienia.</div>`;
  $("#toggleBoatPackagesButton").setAttribute("aria-expanded", "true");
  $("#toggleBoatPackagesLabel").textContent = "Zwiń wszystkie";
}

function exportCsv() {
  if (!state.report) return;
  const rows = [["Produkt", "Ilość całkowita", "Jednostka"]];
  state.report.consolidated.forEach((item) => rows.push([item.product_name, item.total_quantity, item.unit]));
  const csv = "\ufeff" + rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `proviant-${state.report.target_date}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function formatNumber(value) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function bindEvents() {
  $$("[data-auth-tab]").forEach((button) => button.addEventListener("click", () => {
    $$("[data-auth-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
    $("#loginForm").classList.toggle("hidden", button.dataset.authTab !== "login");
    $("#signupForm").classList.toggle("hidden", button.dataset.authTab !== "signup");
  }));
  $("#enterDemoButton").addEventListener("click", enterDemo);
  $("#productSearch").addEventListener("input", renderProducts);
  $("#recipeSearch").addEventListener("input", renderRecipes);
  $("#reportSearch").addEventListener("input", renderReport);
  $("#refreshReportButton").addEventListener("click", loadReport);
  $("#reportDate").addEventListener("change", loadReport);
  $("#toggleBoatPackagesButton").addEventListener("click", () => {
    const boatCards = $$("#boatPackages .boat-card");
    const shouldOpen = boatCards.some((card) => !card.open);
    boatCards.forEach((card) => { card.open = shouldOpen; });
    $("#toggleBoatPackagesButton").setAttribute("aria-expanded", String(shouldOpen));
    $("#toggleBoatPackagesLabel").textContent = shouldOpen ? "Zwiń wszystkie" : "Rozwiń wszystkie";
  });
  $("#submitOrderButton").addEventListener("click", submitOrder);
  $("#editDietsButton").addEventListener("click", () => openDietModal(false));
  $("#newTurnusButton").addEventListener("click", openNewTurnusModal);
  $("#closeDietModalButton").addEventListener("click", closeDietModal);
  $("#dietForm").addEventListener("submit", saveDietPreferences);
  $$("#dietForm input[type='checkbox']").forEach((input) => input.addEventListener("change", () => {
    if (input.name !== "noDiets" && input.checked) $("#dietForm").elements.noDiets.checked = false;
    syncDietFormState();
  }));
  $("#exportCsvButton").addEventListener("click", exportCsv);
  $("#printButton").addEventListener("click", () => window.print());
  ["#specialRequests"].forEach((selector) => $(selector).addEventListener("input", () => {
    state.dirty = true;
    updateOrderSummary();
  }));
  $$('input[name="orderLocation"]').forEach((input) => input.addEventListener("change", () => {
    state.dirty = true;
    updateOrderSummary();
  }));
  $("#logoutButton").addEventListener("click", () => {
    saveSession(null);
    state.demo = false;
    state.profile = null;
    $("#userMenu").classList.add("hidden");
    showView(configured() && !CONFIG.DEMO_MODE ? "#authView" : "#setupView");
  });
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await api("/auth/v1/token?grant_type=password", {
        method: "POST", auth: false, body: { email: data.get("email"), password: data.get("password") },
      });
      result.expires_at = Math.floor(Date.now() / 1000) + result.expires_in;
      saveSession(result);
      await loadProfileAndProducts();
      openApp();
    } catch (error) { toast(error.message, true); }
  });
  $("#signupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await api("/auth/v1/signup", {
        method: "POST", auth: false,
        body: {
          email: data.get("email"), password: data.get("password"),
          data: { full_name: data.get("fullName"), boat_name: data.get("boatName") },
        },
      });
      if (result.access_token) {
        result.expires_at = Math.floor(Date.now() / 1000) + result.expires_in;
        saveSession(result);
        await loadProfileAndProducts();
        openApp();
      } else {
        toast("Konto utworzone. Potwierdź adres e-mail i zaloguj się.");
        $("[data-auth-tab='login']").click();
      }
    } catch (error) { toast(error.message, true); }
  });
}

async function init() {
  bindEvents();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  if (!configured() || CONFIG.DEMO_MODE) {
    showView("#setupView");
    return;
  }
  if (await restoreSession()) {
    try {
      await loadProfileAndProducts();
      openApp();
      return;
    } catch (error) {
      saveSession(null);
      toast(error.message, true);
    }
  }
  showView("#authView");
}

init();
