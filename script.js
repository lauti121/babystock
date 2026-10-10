import { firebaseConfig, firebaseIsConfigured } from "./firebase-config.js";

const DEMO_KEY = "babystock-demo-v1";
const icons = { "Pañales": "▣", "Toallitas": "≈", "Fórmula": "◉", "Higiene": "✦", "Otros": "◌" };
let mode = "demo";
let firebase = null;
let unsubscribe = [];
let creatingAccount = false;
let state = { user: null, family: null, babies: [], products: [], movements: [], activeBabyId: "", preferences: { theme: "rose", displayName: "", bio: "", avatar: "", background: "" } };
const themes = {
  rose: { accent: "#e66c91", dark: "#c34c70", soft: "#ffe4ec", quiet: "#fff3f6", heroA: "#fae2eb", heroB: "#eee2ff" },
  lilac: { accent: "#8d72d8", dark: "#674fb0", soft: "#ece6ff", quiet: "#f7f4ff", heroA: "#ebe5ff", heroB: "#e7f1ff" },
  sky: { accent: "#539fc5", dark: "#28789f", soft: "#dff3fc", quiet: "#f1faff", heroA: "#def2fb", heroB: "#e8ecff" },
  sage: { accent: "#5c9a83", dark: "#3f7662", soft: "#dff2e9", quiet: "#f1faf6", heroA: "#def3e9", heroB: "#e7f3ee" },
  sun: { accent: "#d98b57", dark: "#ac6334", soft: "#ffe8d8", quiet: "#fff7f1", heroA: "#ffe6d5", heroB: "#fff0d9" }
};

const $ = (id) => document.getElementById(id);
const authScreen = $("auth-screen"), appScreen = $("app"), toast = $("toast");

function uid(prefix = "id") { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function showToast(message) { toast.textContent = message; toast.classList.add("show"); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3200); }
function escapeHtml(value = "") { const div = document.createElement("div"); div.textContent = String(value); return div.innerHTML; }
function formatDate(timestamp) { if (!timestamp) return "recién"; return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp)); }
function productLabel(product) { return `${product.name}${product.size ? ` · talla ${product.size}` : ""}`; }
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
      { id: "p-wipes", babyId, name: "Toallitas húmedas", category: "Toallitas", size: "", quantity: 3, unit: "paquetes", minStock: 3, notes: "Sin perfume", createdAt: Date.now(), updatedAt: Date.now() }
    ],
    movements: [
      { id: "m-demo", babyId, productId: "p-g", productName: "Pañales Ultra", type: "consumo", delta: -2, createdAt: Date.now() - 1000 * 60 * 90, actor: "Demo" }
    ],
    activeBabyId: babyId, preferences: { theme: "rose", displayName: "", bio: "", avatar: "", background: "" }
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
  state.preferences = { ...state.preferences, ...(userSnapshot.data().preferences || {}) };
  const listen = (path, prop, order = "createdAt") => firebase.onSnapshot(firebase.query(firebase.collection(familyRef, path), firebase.orderBy(order, "desc")), (snapshot) => {
    state[prop] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (prop === "babies" && (!state.activeBabyId || !state.babies.some((b) => b.id === state.activeBabyId))) state.activeBabyId = state.babies[0]?.id || "";
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
  $("baby-select").innerHTML = state.babies.map((baby) => `<option value="${baby.id}" ${baby.id === state.activeBabyId ? "selected" : ""}>${escapeHtml(baby.name)}</option>`).join("");
  $("total-products").textContent = products.length;
  $("low-products").textContent = low.length;
  $("healthy-products").textContent = Math.max(products.length - low.length, 0);
  $("product-count-label").textContent = `${products.length} ${products.length === 1 ? "producto" : "productos"}`;
  renderAlerts(low); renderAssistant(products, low); renderProducts(products); renderShopping(low); renderMovements();
  const userEmail = state.user?.email || "Modo local";
  $("account-email").textContent = userEmail;
  $("profile-button").textContent = userEmail === "Modo local" ? "DE" : userEmail.slice(0, 2).toUpperCase();
}
function renderAssistant(products, low) {
  const now = Date.now(); const fortnight = now - 14 * 86400000; const insights = [];
  low.slice(0, 2).forEach((product) => insights.push({ icon: "!", title: `${product.name} necesita reposición`, text: `Tienes ${product.quantity} ${product.unit}. Compra al menos ${Math.max(product.minStock * 2 - product.quantity, product.minStock)} para recuperar un margen cómodo.` }));
  products.filter((product) => !isLow(product)).forEach((product) => { const used = state.movements.filter((move) => move.productId === product.id && move.type === "consumo" && move.createdAt >= fortnight).reduce((sum, move) => sum + Math.abs(move.delta), 0); if (used > 0) { const days = Math.floor(product.quantity / (used / 14)); if (days <= 7) insights.push({ icon: "⌁", title: `${product.name}: cobertura estimada de ${days} días`, text: `Según el consumo de las últimas dos semanas, considera agregarlo a tu próxima compra.` }); } });
  if (!insights.length) insights.push({ icon: "✓", title: "Inventario en equilibrio", text: "No hay productos urgentes. Registra los consumos para que las recomendaciones sean cada vez más precisas." });
  $("assistant-insights").innerHTML = insights.slice(0, 3).map((item) => `<div class="insight"><span class="insight-icon">${item.icon}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div></div>`).join("");
}
function applyPreferences() {
  const prefs = state.preferences || {}; const colors = themes[prefs.theme] || themes.rose; const root = document.documentElement;
  root.style.setProperty("--accent", colors.accent); root.style.setProperty("--accent-dark", colors.dark); root.style.setProperty("--accent-soft", colors.soft); root.style.setProperty("--accent-quiet", colors.quiet); root.style.setProperty("--hero-a", colors.heroA); root.style.setProperty("--hero-b", colors.heroB); root.style.setProperty("--user-bg", prefs.background ? `url('${prefs.background}')` : "none");
  const initials = (prefs.displayName || "BS").slice(0, 2).toUpperCase(); [$("profile-button"), $("profile-avatar-preview")].forEach((node) => { if (!node) return; node.textContent = initials; node.style.backgroundImage = prefs.avatar ? `url('${prefs.avatar}')` : ""; node.classList.toggle("has-image", !!prefs.avatar); });
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
    fragment.querySelector(".product-icon").textContent = icons[product.category] || icons.Otros;
    fragment.querySelector("h3").textContent = product.name;
    fragment.querySelector(".product-meta").textContent = [product.category, product.size ? `talla ${product.size}` : "", product.notes || ""].filter(Boolean).join(" · ");
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
function renderShopping(low) {
  $("shopping-list").innerHTML = low.length ? low.map((product) => `<div class="shopping-item"><span class="shopping-check"></span><div><strong>${escapeHtml(productLabel(product))}</strong><small>Quedan ${product.quantity} ${escapeHtml(product.unit)}</small></div><span class="shopping-amount">mín. ${product.minStock}</span></div>`).join("") : `<p class="empty-list">¡Todo bien! No hay productos que reponer.</p>`;
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
  const prefs = state.preferences || {}; $("profile-display-name").value = prefs.displayName || ""; $("profile-bio").value = prefs.bio || "";
  $("profile-name-preview").textContent = prefs.displayName || state.family?.name || "Familia BabyStock";
  const owner = state.family?.ownerId === state.user?.uid; const role = owner ? "Administrador" : (state.family?.roles?.[state.user?.uid] === "viewer" ? "Solo lectura" : "Colaborador");
  $("team-role-label").textContent = role; $("owner-invite-area").classList.toggle("hidden", !owner);
  document.querySelectorAll(".theme-swatch").forEach((button) => button.classList.toggle("selected", button.dataset.theme === (prefs.theme || "rose")));
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
  event.preventDefault(); const prefs = { ...state.preferences, displayName: $("profile-display-name").value.trim(), bio: $("profile-bio").value.trim() };
  try { const avatar = $("profile-image-input").files[0], background = $("background-image-input").files[0]; if (avatar) prefs.avatar = await resizeImage(avatar, 320); if (background) prefs.background = await resizeImage(background, 900); state.preferences = prefs; applyPreferences(); if (mode === "demo") saveDemo(); else await firebase.setDoc(firebase.doc(firebase.db, "users", state.user.uid), { preferences: prefs }, { merge: true }); closeModals(); render(); showToast("Tu estilo se guardó."); } catch { showToast("No se pudo procesar esa imagen. Prueba con otra más pequeña."); }
}
function openProductModal(product = null) {
  $("product-modal-title").textContent = product ? "Editar producto" : "Nuevo producto";
  $("product-id").value = product?.id || ""; $("product-name").value = product?.name || ""; $("product-category").value = product?.category || "Pañales"; $("product-size").value = product?.size || ""; $("product-quantity").value = product?.quantity ?? 0; $("product-unit").value = product?.unit || "unidades"; $("product-min").value = product?.minStock ?? 10; $("product-notes").value = product?.notes || ""; $("archive-product-button").classList.toggle("hidden", !product);
  openModal("product-modal"); $("product-name").focus();
}
async function saveProduct(event) {
  event.preventDefault(); const existing = state.products.find((product) => product.id === $("product-id").value); const now = Date.now();
  const product = { id: existing?.id || uid("product"), babyId: existing?.babyId || state.activeBabyId, name: $("product-name").value.trim(), category: $("product-category").value, size: $("product-size").value.trim(), quantity: Number($("product-quantity").value), unit: $("product-unit").value, minStock: Number($("product-min").value), notes: $("product-notes").value.trim(), archived: false, createdAt: existing?.createdAt || now, updatedAt: now };
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
  event.preventDefault(); const name = $("baby-name").value.trim(); if (!name) return; const baby = { id: uid("baby"), name, createdAt: Date.now() };
  try { if (mode === "demo") { state.babies.push(baby); state.activeBabyId = baby.id; saveDemo(); render(); } else await firebase.setDoc(firebase.doc(firebase.db, "families", state.family.id, "babies", baby.id), baby); $("baby-form").reset(); closeModals(); showToast("Bebé agregado."); } catch (error) { showToast(error.message || "No se pudo agregar."); }
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
$("baby-select").onchange = (event) => { state.activeBabyId = event.target.value; saveDemo(); render(); };
$("profile-button").onclick = openProfileModal; $("nav-profile").onclick = openProfileModal; $("profile-form").addEventListener("submit", saveProfile);
$("invite-form").addEventListener("submit", createInvite); $("join-form").addEventListener("submit", joinFamily);
$("notifications-button").onclick = requestNotifications;
document.querySelectorAll(".theme-swatch").forEach((button) => button.onclick = () => { state.preferences = { ...state.preferences, theme: button.dataset.theme }; applyPreferences(); document.querySelectorAll(".theme-swatch").forEach((item) => item.classList.toggle("selected", item === button)); });
document.querySelectorAll("[data-scroll]").forEach((button) => button.onclick = () => { const target = button.dataset.scroll === "shopping" ? $("shopping-list") : appScreen; target.scrollIntoView({ behavior: "smooth" }); });
$("logout-button").onclick = async () => { closeModals(); if (mode === "firebase" && firebase) await firebase.signOut(firebase.auth); else { appScreen.classList.add("hidden"); authScreen.classList.remove("hidden"); } };
document.querySelectorAll(".close-modal").forEach((button) => button.onclick = closeModals);
document.querySelectorAll(".modal").forEach((modal) => modal.addEventListener("click", (event) => { if (event.target === modal) closeModals(); }));
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch((error) => console.warn("PWA sin caché:", error)));
if (firebaseIsConfigured) initFirebase();
