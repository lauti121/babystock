import { firebaseConfig, firebaseIsConfigured } from "./firebase-config.js";

const DEMO_KEY = "babystock-demo-v1";
const icons = { "Pañales": "▣", "Toallitas": "≈", "Fórmula": "◉", "Comida": "◒", "Higiene": "✦", "Otros": "◌" };
let mode = "demo";
let firebase = null;
let unsubscribe = [];
let creatingAccount = false;
let state = { user: null, family: null, babies: [], products: [], movements: [], activeBabyId: "", preferences: { theme: "rose", accent: "", font: "friendly", scale: "normal", surface: "soft", backgroundOpacity: 22, displayName: "", bio: "", avatar: "", background: "" } };
const themes = {
  rose: { accent: "#e66c91", dark: "#c34c70", soft: "#ffe4ec", quiet: "#fff3f6", heroA: "#fae2eb", heroB: "#eee2ff" },
  lilac: { accent: "#8d72d8", dark: "#674fb0", soft: "#ece6ff", quiet: "#f7f4ff", heroA: "#ebe5ff", heroB: "#e7f1ff" },
  sky: { accent: "#539fc5", dark: "#28789f", soft: "#dff3fc", quiet: "#f1faff", heroA: "#def2fb", heroB: "#e8ecff" },
  sage: { accent: "#5c9a83", dark: "#3f7662", soft: "#dff2e9", quiet: "#f1faf6", heroA: "#def3e9", heroB: "#e7f3ee" },
  sun: { accent: "#d98b57", dark: "#ac6334", soft: "#ffe8d8", quiet: "#fff7f1", heroA: "#ffe6d5", heroB: "#fff0d9" }
};
const defaultPreferences = () => ({ theme: "rose", accent: "", font: "friendly", scale: "normal", surface: "soft", backgroundOpacity: 22, displayName: "", bio: "", avatar: "", background: "" });

const $ = (id) => document.getElementById(id);
const authScreen = $("auth-screen"), appScreen = $("app"), toast = $("toast");

function uid(prefix = "id") { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function showToast(message) { toast.textContent = message; toast.classList.add("show"); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3200); }
function escapeHtml(value = "") { const div = document.createElement("div"); div.textContent = String(value); return div.innerHTML; }
function formatDate(timestamp) { if (!timestamp) return "recién"; return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp)); }
function productLabel(product) { return `${product.name}${product.size ? ` · talla ${product.size}` : ""}`; }
function unitLabel(quantity, unit) { const singular = { unidades: "unidad", tarros: "tarro", paquetes: "paquete", cajas: "caja", bolsas: "bolsa" }; return `${quantity} ${Number(quantity) === 1 ? (singular[unit] || unit) : unit}`; }
function isLow(product) { return Number(product.quantity) <= Number(product.minStock); }
function activeProducts() { return state.products.filter((p) => p.babyId === state.activeBabyId && !p.archived); }

function sampleData() {
  const babyId = "baby-sofia";
  return {
    family: { id: "demo-family", name: "Familia Demo" },
    babies: [{ id: babyId, name: "Sofía", createdAt: Date.now() }],
    products: [
      { id: "p-m", babyId, name: "Pañales Premium", category: "Pañales", size: "M", quantity: 24, unit: "unidades", minStock: 20, notes: "", createdAt: Date.now(), updatedAt: Date.now() },
      { id: "p-g", babyId, name: "Pañales Ultra", category: "Pañales", size: "G", quantity: 8, unit: "unidades", minStock: 15, notes: "", createdAt: Date.now(), updatedAt: Date.now() },
      { id: "p-wipes", babyId, name: "Toallitas húmedas", category: "Toallitas", size: "", quantity: 3, unit: "paquetes", minStock: 3, unitPrice: 2790, notes: "Sin perfume", createdAt: Date.now(), updatedAt: Date.now() },
      { id: "p-formula", babyId, name: "Fórmula infantil", category: "Fórmula", size: "Etapa 1", quantity: 2, unit: "tarros", minStock: 1, unitPrice: 23990, unitContent: 800, notes: "800 g por tarro", createdAt: Date.now(), updatedAt: Date.now() }
    ],
    movements: [
      { id: "m-demo", babyId, productId: "p-g", productName: "Pañales Ultra", type: "consumo", delta: -2, createdAt: Date.now() - 1000 * 60 * 90, actor: "Demo" },
      { id: "m-formula-1", babyId, productId: "p-formula", productName: "Fórmula infantil", type: "consumo", delta: -1, createdAt: Date.now() - 1000 * 60 * 60 * 24 * 12, actor: "Demo" },
      { id: "m-formula-2", babyId, productId: "p-formula", productName: "Fórmula infantil", type: "consumo", delta: -1, createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5, actor: "Demo" }
    ],
    activeBabyId: babyId, preferences: defaultPreferences()
  };
}

function loadDemo() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY));
    state = saved && saved.babies ? { ...state, ...saved, user: { email: "Modo local" } } : { ...state, ...sampleData(), user: { email: "Modo local" } };
  } catch { state = { ...state, ...sampleData(), user: { email: "Modo local" } }; }
  mode = "demo";
}
function saveDemo() {
  if (mode !== "demo") return;
  const { family, babies, products, movements, activeBabyId, preferences } = state;
  localStorage.setItem(DEMO_KEY, JSON.stringify({ family, babies, products, movements, activeBabyId, preferences }));
}

async function initFirebase() {
  try {
    const [{ initializeApp }, authModule, firestoreModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")
    ]);
    const app = initializeApp(firebaseConfig);
    firebase = { auth: authModule.getAuth(app), db: firestoreModule.getFirestore(app), ...authModule, ...firestoreModule };
    firebase.googleProvider = new authModule.GoogleAuthProvider();
    $("firebase-hint").textContent = "Accede con la cuenta de tu familia. Ambos teléfonos pueden usar la misma cuenta.";
    firebase.onAuthStateChanged(firebase.auth, async (user) => {
      if (user) {
        mode = "firebase";
        state.user = user;
        if (creatingAccount) return;
        await openFirebaseFamily(user);
      } else if (mode === "firebase") showAuth();
    });
  } catch (error) {
    console.error(error);
    showToast("No fue posible conectar Firebase. Puedes usar el modo local.");
  }
}

async function createFirebaseFamily(user, familyName) {
  const familyRef = firebase.doc(firebase.collection(firebase.db, "families"));
  await firebase.setDoc(familyRef, { name: familyName, ownerId: user.uid, members: { [user.uid]: true }, roles: { [user.uid]: "owner" }, createdAt: Date.now() });
  const babyRef = firebase.doc(firebase.collection(familyRef, "babies"));
  await firebase.setDoc(babyRef, { name: "Mi bebé", createdAt: Date.now() });
  await firebase.setDoc(firebase.doc(firebase.db, "users", user.uid), { familyId: familyRef.id, email: user.email, createdAt: Date.now() });
}

async function openFirebaseFamily(user) {
  clearSubscriptions();
  const userSnapshot = await firebase.getDoc(firebase.doc(firebase.db, "users", user.uid));
  if (!userSnapshot.exists()) {
    await createFirebaseFamily(user, "Mi familia");
    return openFirebaseFamily(user);
  }
  const familyId = userSnapshot.data().familyId;
  const familyRef = firebase.doc(firebase.db, "families", familyId);
  const familySnapshot = await firebase.getDoc(familyRef);
  if (!familySnapshot.exists()) throw new Error("No se encontró la familia asociada a esta cuenta.");
  state.family = { id: familyId, ...familySnapshot.data() };
  if (!state.family.roles && state.family.ownerId === user.uid) {
    await firebase.updateDoc(familyRef, { roles: { [user.uid]: "owner" } });
    state.family.roles = { [user.uid]: "owner" };
  }
  state.preferences = { ...defaultPreferences(), ...(userSnapshot.data().preferences || {}) };
  const listen = (path, prop, order = "createdAt") => firebase.onSnapshot(firebase.query(firebase.collection(familyRef, path), firebase.orderBy(order, "desc")), (snapshot) => {
    state[prop] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (prop === "babies" && (!state.activeBabyId || !state.babies.some((b) => b.id === state.activeBabyId && !b.archived))) state.activeBabyId = state.babies.find((b) => !b.archived)?.id || "";
    render();
  }, (error) => { console.error(error); showToast("No se pudieron actualizar los datos. Revisa las reglas de Firestore."); });
  unsubscribe = [listen("babies", "babies"), listen("products", "products", "updatedAt"), listen("movements", "movements")];
  showApp();
}
function clearSubscriptions() { unsubscribe.forEach((stop) => stop()); unsubscribe = []; }

function showAuth() { clearSubscriptions(); appScreen.classList.add("hidden"); authScreen.classList.remove("hidden"); }
function showApp() { authScreen.classList.add("hidden"); appScreen.classList.remove("hidden"); render(); }

function render() {
  if (appScreen.classList.contains("hidden")) return;
  const products = activeProducts();
  const low = products.filter(isLow);
  applyPreferences();
  const babyName = state.babies.find((baby) => baby.id === state.activeBabyId)?.name || "Mi bebé";
  $("family-title").textContent = state.preferences.displayName ? `Hola, ${state.preferences.displayName}` : "Hola";
  $("today-label").textContent = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase();
  $("baby-welcome-name").textContent = babyName;
  $("welcome-copy").textContent = state.preferences.bio || "Un vistazo rápido a lo que necesitan hoy.";
  const visibleBabies = state.babies.filter((baby) => !baby.archived);
  $("baby-select").innerHTML = visibleBabies.map((baby) => `<option value="${baby.id}" ${baby.id === state.activeBabyId ? "selected" : ""}>${escapeHtml(baby.name)}</option>`).join("");
  $("total-products").textContent = products.length;
  $("low-products").textContent = low.length;
  $("healthy-products").textContent = Math.max(products.length - low.length, 0);
  $("product-count-label").textContent = `${products.length} ${products.length === 1 ? "producto" : "productos"}`;
  renderAlerts(low); renderAssistant(products, low); renderStats(products); renderProducts(products); renderShopping(products, low); renderMovements();
  const userEmail = state.user?.email || "Modo local";
  $("account-email").textContent = userEmail;
  $("profile-button").textContent = userEmail === "Modo local" ? "DE" : userEmail.slice(0, 2).toUpperCase();
}
function purchaseRecommendation(product, data = productConsumption(product)) {
  if (data.status === "ready") {
    const target = Math.max(Number(product.minStock || 0), Math.ceil(data.dailyRate * 14 * 1.2));
    return { target, buy: Math.max(0, target - Number(product.quantity)), daysLeft: data.daysLeft, confidence: data.observedDays >= 21 ? "alta" : "media" };
  }
  const target = Number(product.minStock || 0);
  return { target, buy: Math.max(0, target - Number(product.quantity)), daysLeft: null, confidence: "aprendiendo" };
}
function renderAssistant(products, low) {
  const analyses = products.map((product) => ({ product, data: productConsumption(product), plan: null }));
  analyses.forEach((item) => { item.plan = purchaseRecommendation(item.product, item.data); });
  const candidates = analyses.filter(({ product, data, plan }) => isLow(product) || (data.status === "ready" && data.daysLeft <= 7) || plan.buy > 0)
    .sort((a, b) => (a.plan.daysLeft ?? 99) - (b.plan.daysLeft ?? 99) || b.plan.buy - a.plan.buy);
  const insights = candidates.slice(0, 2).map(({ product, data, plan }) => {
    if (data.status === "ready") {
      const urgency = data.daysLeft <= 3 ? "Urgente" : data.daysLeft <= 7 ? "Planifica esta compra" : "Mantén tu cobertura";
      const cost = Number(product.unitPrice || 0) && plan.buy ? ` Presupuesto estimado: ${formatCLP(plan.buy * Number(product.unitPrice))}.` : "";
      return { icon: data.daysLeft <= 3 ? "!" : "⌁", title: `${urgency}: ${product.name}`, text: `Cobertura aproximada: ${Math.max(0, Math.floor(data.daysLeft))} días. Para 14 días con margen, compra ${unitLabel(plan.buy || 0, product.unit)}.${cost}` };
    }
    return { icon: "⌛", title: `${product.name}: modelo en aprendizaje`, text: `Por ahora usa el mínimo configurado (${product.minStock} ${product.unit}). Registra consumos durante una semana para obtener una recomendación personalizada.` };
  });
  const reliable = analyses.filter(({ data }) => data.status === "ready").length;
  if (!insights.length && products.length) insights.push({ icon: reliable ? "✓" : "⌛", title: reliable ? "Inventario bajo control" : "Comenzamos a aprender", text: reliable ? `${reliable} producto${reliable === 1 ? "" : "s"} ya tiene${reliable === 1 ? "" : "n"} una proyección basada en consumo real.` : "Registra los consumos diarios y las recomendaciones se activarán con datos reales." });
  if (!products.length) insights.push({ icon: "＋", title: "Construye tu primera recomendación", text: "Agrega un producto y define el nivel mínimo para empezar a planificar compras." });
  $("assistant-insights").innerHTML = insights.slice(0, 3).map((item) => `<div class="insight"><span class="insight-icon">${item.icon}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div></div>`).join("");
}
function mixHex(hex, mixWith, amount) { const clean = String(hex || "").replace("#", ""); if (!/^[0-9a-f]{6}$/i.test(clean)) return ""; const target = String(mixWith).replace("#", ""); const values = [0, 2, 4].map((i) => Math.round(parseInt(clean.slice(i, i + 2), 16) * (1 - amount) + parseInt(target.slice(i, i + 2), 16) * amount).toString(16).padStart(2, "0")); return `#${values.join("")}`; }
function applyPreferences() {
  const prefs = { ...defaultPreferences(), ...(state.preferences || {}) }; const baseColors = themes[prefs.theme] || themes.rose; const accent = mixHex(prefs.accent, "ffffff", 0) || baseColors.accent; const colors = prefs.accent ? { accent, dark: mixHex(accent, "241b31", .35), soft: mixHex(accent, "ffffff", .84), quiet: mixHex(accent, "ffffff", .94), heroA: mixHex(accent, "ffffff", .72), heroB: mixHex(accent, "eef1ff", .62) } : baseColors; const root = document.documentElement;
  root.style.setProperty("--accent", colors.accent); root.style.setProperty("--accent-dark", colors.dark); root.style.setProperty("--accent-soft", colors.soft); root.style.setProperty("--accent-quiet", colors.quiet); root.style.setProperty("--hero-a", colors.heroA); root.style.setProperty("--hero-b", colors.heroB); root.style.setProperty("--user-bg", prefs.background ? `url('${prefs.background}')` : "none"); root.style.setProperty("--user-bg-opacity", String(Math.min(45, Math.max(8, Number(prefs.backgroundOpacity || 22))) / 100)); root.dataset.font = prefs.font; root.dataset.scale = prefs.scale; root.dataset.surface = prefs.surface;
  appScreen.dataset.density = prefs.scale === "compact" ? "compact" : "cozy";
  const initials = (prefs.displayName || "BS").slice(0, 2).toUpperCase(); [$("profile-button"), $("profile-avatar-preview")].forEach((node) => { if (!node) return; node.textContent = initials; node.style.backgroundImage = prefs.avatar ? `url('${prefs.avatar}')` : ""; node.classList.toggle("has-image", !!prefs.avatar); });
}
function formatCLP(value) { return `$${Math.round(value || 0).toLocaleString("es-CL")}`; }
function productConsumption(product, now = Date.now()) {
  const windowStart = now - 30 * 86400000;
  const movements = state.movements.filter((movement) => movement.babyId === state.activeBabyId && movement.productId === product.id && movement.type === "consumo" && movement.createdAt >= windowStart);
  const used = movements.reduce((sum, movement) => sum + Math.abs(Number(movement.delta) || 0), 0);
  if (!used) return { status: "empty", movements, used: 0, observedDays: 0 };
  const first = Math.min(...movements.map((movement) => movement.createdAt));
  // Nunca se inventan siete días de uso: se mide solo el tiempo que efectivamente lleva registrado.
  const observedDays = Math.min(30, Math.max(1, Math.ceil((now - first) / 86400000) + 1));
  const needsSeveralReadings = ["Pañales", "Toallitas"].includes(product.category);
  const hasEnoughHistory = observedDays >= 7 && (!needsSeveralReadings || movements.length >= 3);
  if (!hasEnoughHistory) return { status: "learning", movements, used, observedDays, neededReadings: needsSeveralReadings ? Math.max(0, 3 - movements.length) : 0 };
  const dailyRate = used / observedDays;
  return { status: "ready", movements, used, observedDays, dailyRate, weekly: dailyRate * 7, daysLeft: Number(product.quantity) / dailyRate };
}
function renderStats(products) {
  const now = Date.now();
  const baby = state.babies.find((item) => item.id === state.activeBabyId) || {};
  const analyses = products.map((product) => ({ product, data: productConsumption(product, now) }));
  const recordedConsumption = analyses.filter((item) => item.data.status !== "empty");
  const allConsumption = analyses.filter((item) => item.data.status === "ready");
  const spent30 = recordedConsumption.reduce((sum, item) => sum + item.data.used * Number(item.product.unitPrice || 0), 0);
  const projected4Weeks = allConsumption.reduce((sum, item) => sum + item.data.weekly * 4 * Number(item.product.unitPrice || 0), 0);
  $("stats-grid").innerHTML = `<article><strong>${baby.ageMonths || "—"}</strong><small>meses</small></article><article><strong>${baby.weightKg || "—"}</strong><small>kg</small></article><article><strong>${baby.heightCm || "—"}</strong><small>cm</small></article>`;
  const plans = analyses.map(({ product, data }) => ({ product, data, plan: purchaseRecommendation(product, data) }));
  const reliable = plans.filter(({ data }) => data.status === "ready");
  const shortest = reliable.length ? Math.max(0, Math.floor(Math.min(...reliable.map(({ data }) => data.daysLeft)))) : null;
  const shoppingBudget = plans.reduce((sum, { product, plan }) => sum + plan.buy * Number(product.unitPrice || 0), 0);
  const learning = analyses.filter((item) => item.data.status === "learning");
  $("decision-strip").innerHTML = `<article class="decision-card"><span>Modelo</span><strong>${reliable.length}/${products.length || 0}</strong><small>productos con datos suficientes</small></article><article class="decision-card"><span>Menor cobertura</span><strong>${shortest === null ? "—" : `${shortest}d`}</strong><small>${shortest === null ? "aún recopilando datos" : "producto más cercano a agotarse"}</small></article><article class="decision-card"><span>Compra planificada</span><strong>${shoppingBudget ? formatCLP(shoppingBudget) : "—"}</strong><small>para alcanzar cobertura objetivo</small></article>`;
  $("spending-summary").innerHTML = `<article><strong>${formatCLP(spent30)}</strong><small>consumo valorizado · últimos 30 días</small></article><article><strong>${formatCLP(projected4Weeks)}</strong><small>proyección de gasto · próximas 4 semanas</small></article>`;

  const categoryTotals = new Map();
  recordedConsumption.forEach(({ product, data }) => {
    const current = categoryTotals.get(product.category) || { units: 0, spent: 0 };
    current.units += data.used; current.spent += data.used * Number(product.unitPrice || 0); categoryTotals.set(product.category, current);
  });
  $("category-breakdown").innerHTML = categoryTotals.size ? [...categoryTotals.entries()].sort((a, b) => b[1].spent - a[1].spent).map(([category, total]) => `<div class="category-stat"><strong>${escapeHtml(category)}</strong><span>${total.units.toLocaleString("es-CL")} usados · ${formatCLP(total.spent)}</span></div>`).join("") : `<p class="stats-note">Agrega el precio y registra consumos para convertir tu inventario en estadísticas de gasto reales.</p>`;

  const forecasts = allConsumption.sort((a, b) => (a.product.category === "Fórmula" ? -1 : 0) - (b.product.category === "Fórmula" ? -1 : 0) || a.data.daysLeft - b.data.daysLeft).slice(0, 5);
  const formulaWithoutData = analyses.filter((item) => item.product.category === "Fórmula" && item.data.status === "empty").map((item) => item.product);
  const forecastLines = forecasts.map(({ product, data }) => {
    const safeDays = Math.max(0, Math.floor(data.daysLeft));
    const recommended = Math.max(Number(product.minStock || 0), Math.ceil(data.weekly * 1.2));
    const formulaDetail = product.category === "Fórmula" && Number(product.unitContent) > 0 ? ` Equivale a ${(Number(product.quantity) * Number(product.unitContent)).toLocaleString("es-CL")} g/ml disponibles; consumo estimado: ${(data.weekly * Number(product.unitContent)).toLocaleString("es-CL", { maximumFractionDigits: 0 })} g/ml por semana.` : "";
    const confidence = data.observedDays < 14 ? ` Muestra inicial: ${data.observedDays} días registrados.` : "";
    return `<div class="insight"><span class="insight-icon">⌁</span><div><strong>${escapeHtml(product.name)}: aprox. ${safeDays} días (${(data.daysLeft / 7).toLocaleString("es-CL", { maximumFractionDigits: 1 })} semanas)</strong><p>Recomendación semanal: ${recommended} ${escapeHtml(product.unit)} (incluye 20% de margen).${formulaDetail}${confidence}</p></div></div>`;
  });
  learning.forEach(({ product, data }) => { const extraReadings = data.neededReadings ? ` y ${data.neededReadings} registro${data.neededReadings === 1 ? "" : "s"} más` : ""; forecastLines.push(`<div class="insight"><span class="insight-icon">⌛</span><div><strong>${escapeHtml(product.name)}: aprendiendo tu consumo</strong><p>Llevamos ${data.observedDays} de 7 días reales registrados${extraReadings}. No mostraremos una duración todavía para evitar una estimación engañosa.</p></div></div>`); });
  formulaWithoutData.forEach((product) => forecastLines.push(`<div class="insight"><span class="insight-icon">◉</span><div><strong>${escapeHtml(product.name)}: lista para medir</strong><p>${Number(product.unitContent) ? `Tienes ${(Number(product.quantity) * Number(product.unitContent)).toLocaleString("es-CL")} g/ml disponibles. ` : ""}Descuenta un tarro al terminarlo: luego de 7 días reales de registro calcularemos cuánto rinde.</p></div></div>`));
  $("forecast-list").innerHTML = forecastLines.length ? forecastLines.join("") : `<p class="empty-list">Registra consumos para generar proyecciones reales.</p>`;

  $("chile-reference").innerHTML = `<span class="source-chip">REFERENCIA NACIONAL · INE</span><h3>Contexto de precios en Chile</h3><p>En septiembre de 2026 el IPC nacional subió 0,4% y la división “alimentos y bebidas no alcohólicas” aumentó 0,6%. Es una variación oficial de precios, no un gasto promedio recomendado para bebés.</p><p>Tu gasto y tu duración de fórmula se calculan con los precios y consumos que registra tu familia. Así no se mezclan datos reales de tu hogar con una estimación nacional.</p><a href="https://www.ine.gob.cl/sala-de-prensa/prensa/general/noticia/2026/10/08/%C3%ADndice-de-precios-al-consumidor-%28ipc%29-de-septiembre-present%C3%B3-una-variaci%C3%B3n-mensual-de-0-4" target="_blank" rel="noopener noreferrer">Ver publicación del INE ↗</a><br /><a href="https://www.sernac.cl/observatorio/" target="_blank" rel="noopener noreferrer">Cotizar precios en Observatorio SERNAC ↗</a>`;
}
function renderAlerts(low) {
  const section = $("alerts-section"), list = $("alerts-list");
  section.classList.toggle("hidden", !low.length);
  list.innerHTML = low.map((product) => `<div class="alert"><span>!</span><div><strong>${escapeHtml(productLabel(product))}</strong>: quedan ${product.quantity} ${escapeHtml(product.unit)}. Mínimo: ${product.minStock}.</div></div>`).join("");
}
function renderProducts(products) {
  const list = $("product-list"), empty = $("empty-products"), template = $("product-template");
  list.innerHTML = ""; empty.classList.toggle("hidden", products.length > 0);
  products.sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.name.localeCompare(b.name, "es")).forEach((product) => {
    const fragment = template.content.cloneNode(true); const card = fragment.querySelector(".product-card");
    card.dataset.id = product.id; card.classList.toggle("low", isLow(product));
    const icon = fragment.querySelector(".product-icon"); icon.textContent = product.image ? "" : (icons[product.category] || icons.Otros); if (product.image) { icon.style.backgroundImage = `url('${product.image}')`; icon.style.backgroundSize = "cover"; icon.style.backgroundPosition = "center"; }
    fragment.querySelector("h3").textContent = product.name;
    fragment.querySelector(".product-meta").textContent = [product.category, product.size ? `talla ${product.size}` : "", product.unitContent ? `${product.unitContent} g/ml` : "", product.notes || ""].filter(Boolean).join(" · ");
    fragment.querySelector(".badge").textContent = isLow(product) ? "REPONER" : "";
    fragment.querySelector(".stock-number").textContent = product.quantity;
    fragment.querySelector(".stock-unit").textContent = product.unit;
    fragment.querySelector(".stock-status").textContent = isLow(product) ? "Bajo el mínimo" : "Stock saludable";
    fragment.querySelector(".minus").onclick = () => changeQuantity(product.id, -1, "consumo");
    fragment.querySelector(".plus").onclick = () => changeQuantity(product.id, 1, "compra");
    fragment.querySelector(".consume-button").onclick = () => changeQuantity(product.id, -1, "consumo");
    fragment.querySelector(".more-button").onclick = () => openProductModal(product);
    list.append(fragment);
  });
}
function renderShopping(products, low) {
  const candidates = products.map((product) => { const data = productConsumption(product); const plan = purchaseRecommendation(product, data); return { product, data, plan }; }).filter(({ product, data, plan }) => isLow(product) || plan.buy > 0 || (data.status === "ready" && data.daysLeft <= 14)).sort((a, b) => (a.data.daysLeft ?? 99) - (b.data.daysLeft ?? 99));
  $("shopping-list").innerHTML = candidates.length ? candidates.map(({ product, data, plan }) => { const coverage = data.status === "ready" ? `Cobertura: ${Math.max(0, Math.floor(data.daysLeft))} días` : `Quedan ${unitLabel(product.quantity, product.unit)}`; const suggested = plan.buy ? `comprar ${unitLabel(plan.buy, product.unit)}` : `mín. ${unitLabel(product.minStock, product.unit)}`; return `<div class="shopping-item"><span class="shopping-check"></span><div><strong>${escapeHtml(productLabel(product))}</strong><small>${coverage}</small></div><span class="shopping-amount">${suggested}</span></div>`; }).join("") : `<p class="empty-list">¡Todo bien! No hay compras planificadas por ahora.</p>`;
}
function renderMovements() {
  const current = state.movements.filter((movement) => movement.babyId === state.activeBabyId).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  $("movement-list").innerHTML = current.length ? current.map((movement) => { const positive = movement.delta > 0; return `<div class="movement-item"><span class="movement-symbol ${positive ? "" : "negative"}">${positive ? "+" : "−"}</span><div><strong>${escapeHtml(movement.productName)}</strong><small>${movement.type} · ${formatDate(movement.createdAt)}</small></div><span class="movement-delta ${positive ? "" : "negative"}">${positive ? "+" : ""}${movement.delta}</span></div>`; }).join("") : `<p class="empty-list">Aún no hay movimientos para este bebé.</p>`;
}

async function persistProduct(product, movement = null) {
  if (mode === "demo") {
    const index = state.products.findIndex((item) => item.id === product.id);
    if (index >= 0) state.products[index] = product; else state.products.push(product);
    if (movement) state.movements.push(movement); saveDemo(); render(); return;
  }
  const familyRef = firebase.doc(firebase.db, "families", state.family.id);
  await firebase.setDoc(firebase.doc(familyRef, "products", product.id), product, { merge: true });
  if (movement) await firebase.setDoc(firebase.doc(familyRef, "movements", movement.id), movement);
}
async function changeQuantity(productId, delta, type) {
  const original = state.products.find((product) => product.id === productId); if (!original) return;
  const quantity = Math.max(0, Number(original.quantity) + delta); const actualDelta = quantity - Number(original.quantity);
  if (!actualDelta) return showToast("La cantidad no puede ser menor que cero.");
  const now = Date.now(); const product = { ...original, quantity, updatedAt: now };
  const movement = { id: uid("move"), babyId: product.babyId, productId, productName: productLabel(product), type, delta: actualDelta, createdAt: now, actor: state.user?.email || "Modo local" };
  try {
    if (mode === "firebase") {
      const ref = firebase.doc(firebase.db, "families", state.family.id, "products", productId);
      await firebase.runTransaction(firebase.db, async (transaction) => {
        const fresh = await transaction.get(ref); if (!fresh.exists()) throw new Error("El producto ya no existe.");
        const freshData = fresh.data(); const next = Math.max(0, Number(freshData.quantity) + delta); const applied = next - Number(freshData.quantity);
        if (!applied) throw new Error("La cantidad no puede ser menor que cero.");
        transaction.update(ref, { quantity: next, updatedAt: now });
        transaction.set(firebase.doc(firebase.db, "families", state.family.id, "movements", movement.id), { ...movement, delta: applied });
      });
    } else await persistProduct(product, movement);
  } catch (error) { showToast(error.message || "No se pudo actualizar el producto."); }
}

function openModal(id) { $(id).classList.remove("hidden"); }
function closeModals() { document.querySelectorAll(".modal").forEach((modal) => modal.classList.add("hidden")); }
function openProfileModal() {
  const prefs = { ...defaultPreferences(), ...(state.preferences || {}) }; $("profile-display-name").value = prefs.displayName || ""; $("profile-bio").value = prefs.bio || ""; $("profile-font").value = prefs.font; $("profile-scale").value = prefs.scale; $("profile-accent").value = prefs.accent || (themes[prefs.theme] || themes.rose).accent; $("accent-value").textContent = $("profile-accent").value.toUpperCase(); $("background-opacity").value = prefs.backgroundOpacity; $("background-opacity-value").textContent = `${prefs.backgroundOpacity}%`;
  $("profile-name-preview").textContent = prefs.displayName || state.family?.name || "Familia BabyStock";
  const owner = state.family?.ownerId === state.user?.uid; const role = owner ? "Administrador" : (state.family?.roles?.[state.user?.uid] === "viewer" ? "Solo lectura" : "Colaborador");
  $("team-role-label").textContent = role; $("owner-invite-area").classList.toggle("hidden", !owner);
  document.querySelectorAll(".theme-swatch").forEach((button) => button.classList.toggle("selected", button.dataset.theme === (prefs.theme || "rose")));
  document.querySelectorAll(".surface-option").forEach((button) => button.classList.toggle("selected", button.dataset.surface === prefs.surface));
  applyPreferences(); openModal("profile-modal");
}
function invitationCode(inviteId) { return `${state.family.id}:${inviteId}`; }
async function createInvite(event) {
  event.preventDefault(); if (mode !== "firebase") return showToast("Las invitaciones requieren Firebase.");
  const email = $("invite-email").value.trim().toLowerCase(); const role = $("invite-role").value; const inviteRef = firebase.doc(firebase.collection(firebase.db, "families", state.family.id, "invitations"));
  try { await firebase.setDoc(inviteRef, { email, role, status: "pending", createdAt: Date.now(), createdBy: state.user.uid }); const code = invitationCode(inviteRef.id); $("invite-result").textContent = `Comparte este código con ${email}: ${code}`; showToast("Invitación creada."); } catch (error) { showToast(error.message || "No se pudo crear la invitación."); }
}
async function joinFamily(event) {
  event.preventDefault(); if (mode !== "firebase") return showToast("Crea una cuenta Firebase para unirte a una familia.");
  const [familyId, inviteId] = $("invite-code").value.trim().split(":"); if (!familyId || !inviteId) return showToast("El código no es válido.");
  try { const familyRef = firebase.doc(firebase.db, "families", familyId); const inviteRef = firebase.doc(familyRef, "invitations", inviteId); const invite = await firebase.getDoc(inviteRef); if (!invite.exists() || invite.data().status !== "pending" || invite.data().email !== state.user.email.toLowerCase()) throw new Error("La invitación no corresponde a este correo o ya fue usada."); const batch = firebase.writeBatch(firebase.db); batch.update(familyRef, { [`members.${state.user.uid}`]: true, [`roles.${state.user.uid}`]: invite.data().role, pendingInvitationId: inviteId }); batch.update(firebase.doc(firebase.db, "users", state.user.uid), { familyId }); batch.update(inviteRef, { status: "accepted", acceptedAt: Date.now(), acceptedBy: state.user.uid }); await batch.commit(); closeModals(); await openFirebaseFamily(state.user); showToast("Ya formas parte de la familia."); } catch (error) { showToast(error.message || "No se pudo aceptar la invitación."); }
}
function resizeImage(file, maxSize = 520) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = reject; reader.onload = () => { const image = new Image(); image.onload = () => { const scale = Math.min(1, maxSize / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", .78)); }; image.onerror = reject; image.src = reader.result; }; reader.readAsDataURL(file); });
}
async function saveProfile(event) {
  event.preventDefault(); const prefs = { ...defaultPreferences(), ...state.preferences, displayName: $("profile-display-name").value.trim(), bio: $("profile-bio").value.trim(), accent: $("profile-accent").value, font: $("profile-font").value, scale: $("profile-scale").value, surface: state.preferences.surface || "soft", backgroundOpacity: Number($("background-opacity").value) };
  try { const avatar = $("profile-image-input").files[0], background = $("background-image-input").files[0]; if (avatar) prefs.avatar = await resizeImage(avatar, 320); if (background) prefs.background = await resizeImage(background, 900); state.preferences = prefs; applyPreferences(); if (mode === "demo") saveDemo(); else await firebase.setDoc(firebase.doc(firebase.db, "users", state.user.uid), { preferences: prefs }, { merge: true }); closeModals(); render(); showToast("Tu estilo se guardó."); } catch { showToast("No se pudo procesar esa imagen. Prueba con otra más pequeña."); }
}
function openProductModal(product = null) {
  $("product-modal-title").textContent = product ? "Editar producto" : "Nuevo producto";
  $("product-id").value = product?.id || ""; $("product-name").value = product?.name || ""; $("product-category").value = product?.category || "Pañales"; $("product-size").value = product?.size || ""; $("product-quantity").value = product?.quantity ?? 0; $("product-unit").value = product?.unit || "unidades"; $("product-min").value = product?.minStock ?? 10; $("product-price").value = product?.unitPrice ?? 0; $("product-content").value = product?.unitContent ?? ""; $("product-image").value = ""; $("product-notes").value = product?.notes || ""; $("archive-product-button").classList.toggle("hidden", !product);
  openModal("product-modal"); $("product-name").focus();
}
async function saveProduct(event) {
  event.preventDefault(); const existing = state.products.find((product) => product.id === $("product-id").value); const now = Date.now();
  const product = { id: existing?.id || uid("product"), babyId: existing?.babyId || state.activeBabyId, name: $("product-name").value.trim(), category: $("product-category").value, size: $("product-size").value.trim(), quantity: Number($("product-quantity").value), unit: $("product-unit").value, minStock: Number($("product-min").value), unitPrice: Number($("product-price").value || 0), unitContent: Number($("product-content").value || 0), image: existing?.image || "", notes: $("product-notes").value.trim(), archived: false, createdAt: existing?.createdAt || now, updatedAt: now };
  if ($("product-image").files[0]) product.image = await resizeImage($("product-image").files[0], 300);
  if (!product.name) return; let movement = null;
  if (existing && product.quantity !== Number(existing.quantity)) movement = { id: uid("move"), babyId: product.babyId, productId: product.id, productName: productLabel(product), type: "ajuste", delta: product.quantity - Number(existing.quantity), createdAt: now, actor: state.user?.email || "Modo local" };
  try { await persistProduct(product, movement); closeModals(); showToast(existing ? "Producto actualizado." : "Producto agregado."); } catch (error) { showToast(error.message || "No se pudo guardar."); }
}
async function archiveProduct() {
  const id = $("product-id").value; const product = state.products.find((item) => item.id === id); if (!product) return;
  if (!window.confirm(`¿Archivar “${product.name}”? No se borrará el historial.`)) return;
  try { await persistProduct({ ...product, archived: true, archivedAt: Date.now(), updatedAt: Date.now() }); closeModals(); showToast("Producto archivado. El historial se conserva."); } catch (error) { showToast(error.message || "No se pudo archivar."); }
}
async function addBaby(event) {
  event.preventDefault(); const name = $("baby-name").value.trim(); if (!name) return; const baby = { id: uid("baby"), name, ageMonths: Number($("baby-age").value || 0), weightKg: Number($("baby-weight").value || 0), heightCm: Number($("baby-height").value || 0), createdAt: Date.now() };
  try { if (mode === "demo") { state.babies.push(baby); state.activeBabyId = baby.id; saveDemo(); render(); } else await firebase.setDoc(firebase.doc(firebase.db, "families", state.family.id, "babies", baby.id), baby); $("baby-form").reset(); closeModals(); showToast("Bebé agregado."); } catch (error) { showToast(error.message || "No se pudo agregar."); }
}
async function archiveBaby() {
  const baby = state.babies.find((item) => item.id === state.activeBabyId); if (!baby) return showToast("No hay un bebé activo para archivar.");
  if (!window.confirm(`¿Archivar a “${baby.name}”? Sus productos e historial se conservarán.`)) return;
  try { const update = { ...baby, archived: true, archivedAt: Date.now() }; if (mode === "demo") { state.babies = state.babies.map((item) => item.id === baby.id ? update : item); state.activeBabyId = state.babies.find((item) => !item.archived)?.id || ""; saveDemo(); render(); } else await firebase.setDoc(firebase.doc(firebase.db, "families", state.family.id, "babies", baby.id), update, { merge: true }); showToast("Bebé archivado. Sus datos no se borraron."); } catch (error) { showToast(error.message || "No se pudo archivar."); }
}

let registering = false;
async function handleAuth(event) {
  event.preventDefault(); if (!firebase || !firebaseIsConfigured) return showToast("Primero configura Firebase para usar cuentas reales.");
  const email = $("email").value.trim(), password = $("password").value, button = $("auth-submit"); if (!email || !password) return;
  button.disabled = true; button.textContent = registering ? "Creando cuenta..." : "Ingresando...";
  try { if (registering) { creatingAccount = true; const credential = await firebase.createUserWithEmailAndPassword(firebase.auth, email, password); await createFirebaseFamily(credential.user, $("family-name").value.trim() || "Mi familia"); await openFirebaseFamily(credential.user); } else await firebase.signInWithEmailAndPassword(firebase.auth, email, password); } catch (error) { const friendly = { "auth/email-already-in-use": "Este correo ya tiene una cuenta.", "auth/invalid-credential": "Correo o contraseña incorrectos.", "auth/weak-password": "La contraseña debe tener al menos 6 caracteres." }; showToast(friendly[error.code] || "No se pudo acceder. Inténtalo nuevamente."); } finally { creatingAccount = false; button.disabled = false; button.textContent = registering ? "Crear cuenta" : "Ingresar"; }
}
async function handleGoogleLogin() {
  if (!firebase || !firebaseIsConfigured) return showToast("Primero configura Firebase para usar Google.");
  try { await firebase.signInWithPopup(firebase.auth, firebase.googleProvider); } catch (error) { const messages = { "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo otra vez.", "auth/account-exists-with-different-credential": "Ya existe una cuenta con este correo. Ingresa con correo y contraseña primero." }; showToast(messages[error.code] || "No se pudo iniciar sesión con Google."); }
}
async function requestNotifications() {
  if (!("Notification" in window)) return showToast("Este navegador no admite notificaciones.");
  const permission = await Notification.requestPermission(); const status = $("notifications-status");
  if (permission === "granted") { localStorage.setItem("babystock-notifications", "enabled"); status.textContent = "Alertas activadas en este dispositivo."; showToast("Recibirás avisos al detectar stock bajo mientras uses la app."); } else { status.textContent = "No se concedió permiso. Puedes activarlo desde la configuración del navegador."; }
}

$("auth-form").addEventListener("submit", handleAuth);
$("google-login-button").onclick = handleGoogleLogin;
$("auth-toggle").onclick = () => { registering = !registering; $("name-field").classList.toggle("hidden", !registering); $("auth-submit").textContent = registering ? "Crear cuenta" : "Ingresar"; $("auth-toggle").textContent = registering ? "¿Ya tienes cuenta? Ingresar" : "¿No tienes cuenta? Crear una"; };
$("demo-button").onclick = () => { clearSubscriptions(); loadDemo(); showApp(); };
$("add-product-button").onclick = () => openProductModal(); $("product-form").addEventListener("submit", saveProduct);
$("archive-product-button").onclick = archiveProduct;
$("add-baby-button").onclick = () => openModal("baby-modal"); $("baby-form").addEventListener("submit", addBaby);
$("archive-baby-button").onclick = archiveBaby;
$("baby-select").onchange = (event) => { state.activeBabyId = event.target.value; saveDemo(); render(); };
$("profile-button").onclick = openProfileModal; $("nav-profile").onclick = openProfileModal; $("profile-form").addEventListener("submit", saveProfile);
$("invite-form").addEventListener("submit", createInvite); $("join-form").addEventListener("submit", joinFamily);
$("notifications-button").onclick = requestNotifications;
document.querySelectorAll(".theme-swatch").forEach((button) => button.onclick = () => { const theme = themes[button.dataset.theme] || themes.rose; state.preferences = { ...defaultPreferences(), ...state.preferences, theme: button.dataset.theme, accent: "" }; $("profile-accent").value = theme.accent; $("accent-value").textContent = theme.accent.toUpperCase(); applyPreferences(); document.querySelectorAll(".theme-swatch").forEach((item) => item.classList.toggle("selected", item === button)); });
document.querySelectorAll(".surface-option").forEach((button) => button.onclick = () => { state.preferences = { ...defaultPreferences(), ...state.preferences, surface: button.dataset.surface }; applyPreferences(); document.querySelectorAll(".surface-option").forEach((item) => item.classList.toggle("selected", item === button)); });
$("profile-accent").oninput = (event) => { state.preferences = { ...defaultPreferences(), ...state.preferences, accent: event.target.value }; $("accent-value").textContent = event.target.value.toUpperCase(); applyPreferences(); };
$("background-opacity").oninput = (event) => { state.preferences = { ...defaultPreferences(), ...state.preferences, backgroundOpacity: Number(event.target.value) }; $("background-opacity-value").textContent = `${event.target.value}%`; applyPreferences(); };
$("profile-font").onchange = (event) => { state.preferences = { ...defaultPreferences(), ...state.preferences, font: event.target.value }; applyPreferences(); };
$("profile-scale").onchange = (event) => { state.preferences = { ...defaultPreferences(), ...state.preferences, scale: event.target.value }; applyPreferences(); };
document.querySelectorAll("[data-scroll]").forEach((button) => button.onclick = () => { const target = button.dataset.scroll === "shopping" ? $("shopping-list") : appScreen; target.scrollIntoView({ behavior: "smooth" }); });
$("logout-button").onclick = async () => { closeModals(); if (mode === "firebase" && firebase) await firebase.signOut(firebase.auth); else { appScreen.classList.add("hidden"); authScreen.classList.remove("hidden"); } };
document.querySelectorAll(".close-modal").forEach((button) => button.onclick = closeModals);
document.querySelectorAll(".modal").forEach((modal) => modal.addEventListener("click", (event) => { if (event.target === modal) closeModals(); }));
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js?v=20261011-pro2").catch((error) => console.warn("PWA sin caché:", error)));
if (firebaseIsConfigured) initFirebase();
