import { CONFIG } from "./config.js";
import { BREAKFAST_IDEAS, PRODUCTS as FALLBACK_PRODUCTS } from "./catalog.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const views = ["#loadingView", "#setupView", "#authView", "#appView"];
const state = {
  session: null,
  profile: null,
  products: [],
  quantities: new Map(),
  activeCategory: "Wszystkie",
  activePanel: "skipper",
  report: null,
  demo: false,
  dirty: false,
};

const DEMO_REPORT = {
  target_date: tomorrowDate(),
  total_boats: 8,
  submitted_boats: 6,
  missing_boats: ["Mewa", "Perkoz"],
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
    { boat_name: "Bajka", skipper_name: "Maciek", submitted_at: new Date().toISOString(), diet_notes: "", special_requests: "Woda smakowa, bułki hot dog", breakfast_choices: ["Hot dogi śniadaniowe"], items: [["Parówki", 14, "szt."], ["Jajka", 20, "szt."], ["Mleko", 1, "l"]] },
    { boat_name: "Bryza", skipper_name: "Kuba", submitted_at: new Date().toISOString(), diet_notes: "1 osoba bez laktozy", special_requests: "Cytryny, woda gazowana", breakfast_choices: ["Płatki z mlekiem"], items: [["Bułki kajzerki", 7, "szt."], ["Jajka", 10, "szt."], ["Banany", 4, "szt."]] },
    { boat_name: "Czapla", skipper_name: "Oliwka", submitted_at: new Date().toISOString(), diet_notes: "2 wege", special_requests: "Kawa rozpuszczalna", breakfast_choices: ["Naleśniki"], items: [["Jajka", 13, "szt."], ["Parówki", 10, "szt."], ["Mleko", 2, "l"]] },
    { boat_name: "Delfin", skipper_name: "Rafał", submitted_at: new Date().toISOString(), diet_notes: "", special_requests: "", breakfast_choices: ["Owsianka/Granola z jogurtem i owocami"], items: [["Jajka", 20, "szt."], ["Banany", 7, "szt."], ["Skyr owocowy", 7, "szt."]] },
    { boat_name: "Foka", skipper_name: "Olga", submitted_at: new Date().toISOString(), diet_notes: "1 wege", special_requests: "Brzoskwinie", breakfast_choices: ["Jajka sadzone"], items: [["Bułki kajzerki", 7, "szt."], ["Banany", 7, "szt."], ["Skyr owocowy", 7, "szt."]] },
    { boat_name: "Goplana", skipper_name: "Krzysiu", submitted_at: new Date().toISOString(), diet_notes: "", special_requests: "Kawa rozpuszczalna", breakfast_choices: ["Jajecznica"], items: [["Bułki kajzerki", 7, "szt."], ["Awokado", 2, "szt."], ["Mleko", 1, "l"]] },
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

function isCutoffPassed() {
  const { hour } = localParts();
  return Number(hour) >= CONFIG.CUTOFF_HOUR;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: CONFIG.TIMEZONE, weekday: "long", day: "numeric", month: "long",
  }).format(new Date(`${dateString}T12:00:00Z`));
}

async function api(path, { method = "GET", body, auth = true, headers = {} } = {}) {
  if (!state.session && auth) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  const response = await fetch(`${CONFIG.SUPABASE_URL}${path}`, {
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
    api(`/rest/v1/profiles?select=id,full_name,role,boat_id,boats(name)&id=eq.${userId}`),
    api("/rest/v1/products?select=id,name,category,unit,sort_order&active=eq.true&order=sort_order.asc"),
  ]);
  if (!profiles[0]) throw new Error("Brak profilu użytkownika. Uruchom ponownie skrypt schema.sql.");
  state.profile = profiles[0];
  state.products = products;
}

function enterDemo() {
  state.demo = true;
  state.profile = { full_name: "Daniel (demo)", role: "admin", boat_id: "demo-boat", boats: { name: "Bajka" } };
  state.products = FALLBACK_PRODUCTS;
  state.report = DEMO_REPORT;
  openApp();
}

function openApp() {
  showView("#appView");
  $("#userMenu").classList.remove("hidden");
  $("#userLabel").textContent = `${state.profile.full_name} · ${state.profile.boats?.name || roleName(state.profile.role)}`;
  renderNavigation();
  setupOrderPanel();
  updateDeadline();
  const role = state.profile.role;
  switchPanel(role === "supplier" ? "supplier" : "skipper");
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
    canReport ? `<button data-panel="supplier">Raport zaopatrzenia</button>` : "",
  ].join("");
  nav.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => switchPanel(button.dataset.panel)));
}

function switchPanel(panel) {
  state.activePanel = panel;
  $("#skipperPanel").classList.toggle("hidden", panel !== "skipper");
  $("#supplierPanel").classList.toggle("hidden", panel !== "supplier");
  $$("#appNav button").forEach((button) => button.classList.toggle("active", button.dataset.panel === panel));
  if (panel === "skipper") {
    $("#roleEyebrow").textContent = "Panel sternika";
    $("#heroTitle").textContent = "Zamówienie na jutro";
    $("#heroSubtitle").textContent = `${state.profile.boats?.name || "Twój jacht"} · wydanie ${formatDate(tomorrowDate())}`;
    loadMyOrder();
  } else {
    $("#roleEyebrow").textContent = "Panel zaopatrzeniowca";
    $("#heroTitle").textContent = "Jedna lista. Cała flotylla.";
    $("#heroSubtitle").textContent = "Zakupy zbiorcze i osobne paczki dla każdego jachtu.";
    $("#reportDate").value ||= tomorrowDate();
    loadReport();
  }
}

function updateDeadline() {
  const closed = isCutoffPassed();
  $("#deadlineCard").classList.toggle("closed", closed);
  $("#deadlineTime").textContent = `dziś, ${String(CONFIG.CUTOFF_HOUR).padStart(2, "0")}:00`;
  $("#deadlineStatus").textContent = closed ? "Przyjmowanie zamówień zakończone" : "Czas warszawski";
  $("#submitOrderButton").disabled = closed && state.profile.role === "skipper";
  $("#submitHeadline").textContent = closed ? "Termin składania zamówień minął" : "Zamówienie można jeszcze edytować";
}

function setupOrderPanel() {
  $("#breakfastSelect").innerHTML = BREAKFAST_IDEAS.map((idea) => `<option>${escapeHtml(idea)}</option>`).join("");
  renderCategoryFilters();
  renderProducts();
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
  if (state.demo) {
    [["demo-34", 20], ["demo-5", 7], ["demo-64", 8], ["demo-47", 2]].forEach(([id, qty]) => state.quantities.set(id, qty));
    $("#dietNotes").value = "1 osoba bez laktozy";
    $("#specialRequests").value = "Zgrzewka wody gazowanej";
    [...$("#breakfastSelect").options].forEach((option) => option.selected = option.value === "Jajecznica");
    state.dirty = false;
    renderProducts();
    return;
  }
  try {
    const rows = await api(`/rest/v1/orders?select=id,diet_notes,special_requests,breakfast_choices,submitted_at,order_items(product_id,quantity)&target_date=eq.${tomorrowDate()}&limit=1`);
    const order = rows[0];
    if (order) {
      order.order_items.forEach((item) => state.quantities.set(item.product_id, Number(item.quantity)));
      $("#dietNotes").value = order.diet_notes || "";
      $("#specialRequests").value = order.special_requests || "";
      [...$("#breakfastSelect").options].forEach((option) => option.selected = (order.breakfast_choices || []).includes(option.value));
    }
    state.dirty = false;
    renderProducts();
  } catch (error) {
    toast(error.message, true);
  }
}

async function submitOrder() {
  if (isCutoffPassed() && state.profile.role === "skipper") {
    toast("Termin minął o 18:00. Skontaktuj się z zaopatrzeniowcem.", true);
    return;
  }
  const items = [...state.quantities].map(([product_id, quantity]) => ({ product_id, quantity }));
  const payload = {
    p_target_date: tomorrowDate(),
    p_diet_notes: $("#dietNotes").value.trim(),
    p_special_requests: $("#specialRequests").value.trim(),
    p_breakfast_choices: [...$("#breakfastSelect").selectedOptions].map((option) => option.value),
    p_items: items,
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
    button.disabled = isCutoffPassed() && state.profile.role === "skipper";
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
  const productsCount = report.consolidated?.length || 0;
  const itemSum = (report.consolidated || []).reduce((sum, item) => sum + Number(item.total_quantity), 0);
  $("#reportStats").innerHTML = [
    [report.submitted_boats || 0, "Jachty z zamówieniem"],
    [report.total_boats || 0, "Wszystkie aktywne jachty"],
    [productsCount, "Różne produkty"],
    [formatNumber(itemSum), "Łączna liczba jednostek"],
  ].map(([value, label]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");

  const query = $("#reportSearch").value.trim().toLocaleLowerCase("pl");
  const consolidated = (report.consolidated || []).filter((item) => item.product_name.toLocaleLowerCase("pl").includes(query));
  $("#consolidatedList").innerHTML = consolidated.length ? `<table>
    <thead><tr><th>Produkt</th><th>Rozpiska</th><th>Ilość</th></tr></thead>
    <tbody>${consolidated.map((item) => `<tr>
      <td><strong>${escapeHtml(item.product_name)}</strong></td>
      <td>${escapeHtml((item.boats || []).join(" · "))}</td>
      <td class="qty">${formatNumber(item.total_quantity)} ${escapeHtml(item.unit)}</td>
    </tr>`).join("")}</tbody>
  </table>` : `<div class="empty">Brak pozycji dla wybranego dnia.</div>`;

  const missing = report.missing_boats || [];
  $("#boatPackages").innerHTML = [
    ...((report.boats || []).map((boat) => `<details class="boat-card" open>
      <summary><strong>${escapeHtml(boat.boat_name)}</strong><span>${escapeHtml(boat.skipper_name || "")} · ${boat.items?.length || 0} pozycji</span></summary>
      <div class="boat-body">
        <ul>${(boat.items || []).map(([name, qty, unit]) => `<li>${escapeHtml(name)} — <strong>${formatNumber(qty)} ${escapeHtml(unit)}</strong></li>`).join("")}</ul>
        ${boat.breakfast_choices?.length ? `<div class="boat-note"><strong>Śniadanie:</strong> ${escapeHtml(boat.breakfast_choices.join(", "))}</div>` : ""}
        ${boat.diet_notes ? `<div class="boat-note"><strong>Diety:</strong> ${escapeHtml(boat.diet_notes)}</div>` : ""}
        ${boat.special_requests ? `<div class="boat-note"><strong>Specjalne:</strong> ${escapeHtml(boat.special_requests)}</div>` : ""}
      </div>
    </details>`)),
    ...(missing.length ? [`<div class="boat-note missing"><strong>Brak zamówienia:</strong> ${escapeHtml(missing.join(", "))}</div>`] : []),
  ].join("") || `<div class="empty">Żaden jacht jeszcze nie wysłał zamówienia.</div>`;
}

function exportCsv() {
  if (!state.report) return;
  const rows = [["Produkt", "Ilość", "Jednostka", "Jachty"]];
  state.report.consolidated.forEach((item) => rows.push([item.product_name, item.total_quantity, item.unit, (item.boats || []).join("; ")]));
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
  $("#reportSearch").addEventListener("input", renderReport);
  $("#refreshReportButton").addEventListener("click", loadReport);
  $("#reportDate").addEventListener("change", loadReport);
  $("#submitOrderButton").addEventListener("click", submitOrder);
  $("#exportCsvButton").addEventListener("click", exportCsv);
  $("#printButton").addEventListener("click", () => window.print());
  ["#dietNotes", "#specialRequests", "#breakfastSelect"].forEach((selector) => $(selector).addEventListener("input", () => {
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
