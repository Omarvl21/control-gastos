const KEY = "control_gastos_full_v1";
// ===== PIN =====
const PIN_KEY = "control_gastos_pin";
const PIN_UNLOCK_KEY = "control_gastos_pin_unlocked";
const REMINDER_ALERT_KEY = "control_gastos_reminder_alert";
const CATEGORY_COLORS = {
  Pasajes: "#ef4444",    // rojo
  Agua: "#eab308",       // amarillo
  Material: "#22c55e",   // verde
  Herramienta: "#06b6d4",
  Ropa: "#6366f1",
  Comida: "#f97316",
  Otros: "#a855f7",
  Internet: "#f00202"
};


function getSavedPin() {
  return localStorage.getItem(PIN_KEY); // string o null
}

function setSavedPin(pin) {
  localStorage.setItem(PIN_KEY, pin);
}

function isUnlocked() {
  return localStorage.getItem(PIN_UNLOCK_KEY) === "1";
}

function setUnlocked(val) {
  localStorage.setItem(PIN_UNLOCK_KEY, val ? "1" : "0");
}

function showPinOverlay() {
  $("pinOverlay").classList.add("active");
  $("pinInput").value = "";
  updatePinDots();
  $("pinInput").focus();
}

function hidePinOverlay() {
  $("pinOverlay").classList.remove("active");
}

function updatePinDots() {
  const v = ($("pinInput").value || "").slice(0, 4);
  $("pinInput").value = v;

  const dots = $("pinDots").querySelectorAll(".dot");
  dots.forEach((d, i) => {
    if (i < v.length) d.classList.add("filled");
    else d.classList.remove("filled");
  });
}

function pinFlowText() {
  const pin = getSavedPin();
  if (!pin) {
    $("pinTitle").textContent = "Crear PIN";
    $("pinSubtitle").textContent = "Crea un PIN de 4 dígitos para proteger tu app";
    $("btnPinEnter").textContent = "Guardar PIN";
  } else {
    $("pinTitle").textContent = "Bloqueado";
    $("pinSubtitle").textContent = "Ingresa tu PIN para continuar";
    $("btnPinEnter").textContent = "Entrar";
  }
}

function tryUnlockOrCreatePin() {
  const input = ($("pinInput").value || "").trim();

  if (!/^\d{4}$/.test(input)) {
    alert("El PIN debe ser de 4 dígitos.");
    return;
  }

  const saved = getSavedPin();

  // Crear PIN si no existe
  if (!saved) {
    setSavedPin(input);
    setUnlocked(true);
    hidePinOverlay();
    alert("✅ PIN creado.");
    renderAll();
    return;
  }

  // Validar PIN
  if (input === saved) {
    setUnlocked(true);
    hidePinOverlay();
    renderAll();
  } else {
    $("pinInput").value = "";
    updatePinDots();
    alert("❌ PIN incorrecto.");
  }
}

function lockApp() {
  setUnlocked(false);
  pinFlowText();
  showPinOverlay();
}

const $ = (id) => document.getElementById(id);

const money = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n || 0));

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ===== DATA =====
function defaultData() {
  return {
    activeCutId: null,
    activeScope: "personal",
    cuts: [],
    categorias: [
      "Agua", "Luz", "Internet", "Pasajes", "Comida",
      "Entretenimiento", "Cine", "Ropa", "Apoyo a mamá",
      "Material", "Herramienta", "Pago deuda", "Ahorro", "Inversión", "Otros", "Venta"
    ],
    presupuestos: { personal: {}, negocio: {} },
    autoGastos: { personal: { apoyoMamaActivo: true, apoyoMamaMonto: 0 } },
    cuentas: [
      { id: uid(), scope: "personal", nombre: "Efectivo", saldoInicial: 0 },
      { id: uid(), scope: "personal", nombre: "BBVA Débito", saldoInicial: 0 },
      { id: uid(), scope: "negocio", nombre: "Caja (Efectivo)", saldoInicial: 0 },
      { id: uid(), scope: "negocio", nombre: "Banco Negocio", saldoInicial: 0 },
    ],
    tarjetas: [],
    deudas: [],
    recordatorios: [],
    metas: [],
  };
}

function load() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return defaultData();
  try {
    const parsed = JSON.parse(raw);

    parsed.presupuestos = parsed.presupuestos || { personal: {}, negocio: {} };
    parsed.autoGastos = parsed.autoGastos || { personal: { apoyoMamaActivo: true, apoyoMamaMonto: 0 } };
    parsed.categorias = parsed.categorias || defaultData().categorias;
    ["Ahorro", "Inversión"].forEach(categoria => {
      if (!parsed.categorias.includes(categoria)) parsed.categorias.push(categoria);
    });
    parsed.cuentas = parsed.cuentas || defaultData().cuentas;
    parsed.tarjetas = parsed.tarjetas || [];
    parsed.deudas = parsed.deudas || [];
    parsed.recordatorios = parsed.recordatorios || [];
    parsed.metas = parsed.metas || [];
    parsed.cuts = parsed.cuts || [];
    parsed.cuts.forEach(cut => {
      cut.planQuincenal = cut.planQuincenal || {};
      ["personal", "negocio"].forEach(scope => {
        cut.planQuincenal[scope] = {
          pasajes: 0, comida: 0, deudas: 0, ahorro: 0, inversion: 0,
          ...(cut.planQuincenal[scope] || {})
        };
      });
    });
    parsed.activeScope = parsed.activeScope || "personal";

    parsed.tarjetas.forEach(t => { if (t.usado == null) t.usado = 0; });
    parsed.deudas.forEach(d => { if (d.pendiente == null) d.pendiente = Number(d.total || 0); });

    return parsed;
  } catch {
    return defaultData();
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

let state = load();

// ===== CUTS =====
function getQuincenaPeriod(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const day = date.getDate();

  let start, end;
  if (day <= 15) {
    start = new Date(y, m, 1);
    end = new Date(y, m, 15);
  } else {
    start = new Date(y, m, 16);
    end = new Date(y, m + 1, 0);
  }

  return {
    startISO: start.toISOString().slice(0, 10),
    endISO: end.toISOString().slice(0, 10),
  };
}

function getPeriodKey(period) {
  return `${period.startISO}|${period.endISO}`;
}

function getCutKey(cut) {
  return `${cut.startISO}|${cut.endISO}`;
}

function createCut(date = new Date(), period = getQuincenaPeriod(date)) {
  const currentKey = getPeriodKey(period);
  const existing = state.cuts.find(c => getCutKey(c) === currentKey);

  if (existing) {
    state.activeCutId = existing.id;
    save();
    return existing;
  }

  const cut = {
    id: uid(),
    createdAt: date.toISOString(),
    startISO: period.startISO,
    endISO: period.endISO,
    personal: { movimientos: [] },
    negocio: { movimientos: [] },
    planQuincenal: {
      personal: { pasajes: 0, comida: 0, deudas: 0, ahorro: 0, inversion: 0 },
      negocio: { pasajes: 0, comida: 0, deudas: 0, ahorro: 0, inversion: 0 },
    },
  };

  const apoyo = Number(state.autoGastos?.personal?.apoyoMamaMonto || 0);
  if (apoyo > 0) {
    const cuentaPersonal = state.cuentas.find(c => c.scope === "personal")?.id || "";
    cut.personal.movimientos.push({
      id: uid(),
      tipo: "gasto",
      metodo: "cuenta",
      cuentaId: cuentaPersonal,
      tarjetaId: null,
      categoria: "Apoyo a mamá",
      monto: apoyo,
      descripcion: "Apoyo quincenal automático",
      fecha: period.startISO,
      auto: true
    });
  }

  state.cuts.unshift(cut);
  state.activeCutId = cut.id;
  save();
  return cut;
}

function ensureCurrentCut() {
  const now = new Date();
  const period = getQuincenaPeriod(now);
  const current = state.cuts.find(c => getCutKey(c) === getPeriodKey(period));
  if (current) {
    state.activeCutId = current.id;
    save();
    return current;
  }
  return createCut(now, period);
}

ensureCurrentCut();

// ===== HELPERS =====
function activeCut() {
  return state.cuts.find(c => c.id === state.activeCutId) || state.cuts[0];
}

function getScope() {
  return state.activeScope || "personal";
}

function scopeData() {
  return activeCut()[getScope()];
}

function cuentasScope() {
  return state.cuentas.filter(c => c.scope === getScope());
}

function tarjetasScope() {
  return state.tarjetas.filter(t => t.scope === getScope());
}

function deudasScope() {
  return state.deudas.filter(d => d.scope === getScope());
}

function sumMovs(movs, tipo) {
  return movs.filter(m => m.tipo === tipo).reduce((a, m) => a + Number(m.monto || 0), 0);
}

function saldoCuenta(cuentaId) {
  const cuenta = state.cuentas.find(c => c.id === cuentaId);
  if (!cuenta) return 0;

  const movs = scopeData().movimientos.filter(m => m.metodo === "cuenta" && m.cuentaId === cuentaId);
  const ingresos = sumMovs(movs, "ingreso");
  const salidas = sumMovs(movs, "gasto") + sumMovs(movs, "egreso");
  return Number(cuenta.saldoInicial || 0) + ingresos - salidas;
}

function saldoPeriodoCuentas() {
  const scope = getScope();
  const movs = scopeData().movimientos.filter(m => m.metodo === "cuenta");
  const ingresos = sumMovs(movs, "ingreso");
  const salidas = sumMovs(movs, "gasto") + sumMovs(movs, "egreso");

  const saldoInicial = state.cuentas
    .filter(c => c.scope === scope)
    .reduce((acc, c) => acc + Number(c.saldoInicial || 0), 0);

  return saldoInicial + ingresos - salidas;
}

function gastoPorCategoria(cat) {
  return scopeData().movimientos
    .filter(m => m.tipo !== "ingreso" && m.categoria === cat)
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);
}

function getPresupuesto(cat) {
  return Number(state.presupuestos?.[getScope()]?.[cat] || 0);
}

function getPlanQuincenal() {
  const cut = activeCut();
  cut.planQuincenal = cut.planQuincenal || {};
  cut.planQuincenal[getScope()] = {
    pasajes: 0, comida: 0, deudas: 0, ahorro: 0, inversion: 0,
    ...(cut.planQuincenal[getScope()] || {})
  };
  const plan = cut.planQuincenal[getScope()];
  plan.real = { pasajes: 0, comida: 0, deudas: 0, ahorro: 0, inversion: 0, ...(plan.real || {}) };
  plan.extras = Array.isArray(plan.extras) ? plan.extras : [];
  return plan;
}

function deudaSugeridaQuincenal() {
  return deudasScope().reduce((total, deuda) => {
    const pendiente = Number(deuda.pendiente ?? deuda.total ?? 0);
    return total + Math.min(pendiente, Number(deuda.pago || 0));
  }, 0);
}

function renderPlanQuincenal() {
  const plan = getPlanQuincenal();
  const disponible = saldoPeriodoCuentas();
  const campos = {
    planPasajes: plan.pasajes,
    planPasajesReal: plan.real.pasajes,
    planComida: plan.comida,
    planComidaReal: plan.real.comida,
    planDeudas: plan.deudas,
    planDeudasReal: plan.real.deudas,
    planAhorro: plan.ahorro,
    planAhorroReal: plan.real.ahorro,
    planInversion: plan.inversion,
    planInversionReal: plan.real.inversion,
  };

  Object.entries(campos).forEach(([id, valor]) => {
    const input = $(id);
    if (input && document.activeElement !== input) input.value = Number(valor || 0) || "";
  });

  const asignado = [plan.pasajes, plan.comida, plan.deudas, plan.ahorro, plan.inversion]
    .reduce((total, valor) => total + Number(valor || 0), 0)
    + plan.extras.reduce((total, item) => total + Number(item.estimado || 0), 0);
  const restante = disponible - asignado;
  $("planDisponible").textContent = money(disponible);
  $("planAsignado").textContent = money(asignado);
  $("planRestante").textContent = money(restante);
  $("planRestante").className = restante < 0 ? "red" : "green";
  $("planDeudaSugerida").textContent = `Pago sugerido según tus deudas: ${money(deudaSugeridaQuincenal())}`;

  const resumen = $("planResumen");
  const filas = [
    ["Pasajes", plan.pasajes, plan.real.pasajes],
    ["Comidas", plan.comida, plan.real.comida],
    ["Deudas", plan.deudas, plan.real.deudas],
    ["Ahorro", plan.ahorro, plan.real.ahorro],
    ["Inversión", plan.inversion, plan.real.inversion],
    ...plan.extras.map(item => [item.nombre, item.estimado, item.real]),
  ];
  resumen.innerHTML = "";
  filas.forEach(([nombre, reservado, gastado]) => {
    const falta = Number(reservado || 0) - Number(gastado || 0);
    const div = document.createElement("div");
    div.className = "item planItem";
    div.innerHTML = `<div><b>${nombre}</b><br><small class="muted">Estimado: ${money(reservado)} · Real: ${money(gastado)}</small></div><span class="tag ${falta < 0 ? "red" : ""}">${falta < 0 ? "Excedido " : "Diferencia "}${money(Math.abs(falta))}</span>`;
    resumen.appendChild(div);
  });

  const extras = $("planExtras");
  extras.innerHTML = "";
  plan.extras.forEach(item => {
    const row = document.createElement("div");
    row.className = "planInputRow planExtraRow";
    row.innerHTML = `<b>${item.nombre}</b><input type="number" min="0" step="1" data-extra-est="${item.id}" value="${Number(item.estimado || 0) || ""}" placeholder="Estimado"><input type="number" min="0" step="1" data-extra-real="${item.id}" value="${Number(item.real || 0) || ""}" placeholder="Real"><button type="button" class="btn" data-extra-del="${item.id}">Eliminar</button>`;
    extras.appendChild(row);
  });
  extras.querySelectorAll("[data-extra-del]").forEach(btn => btn.onclick = () => {
    plan.extras = plan.extras.filter(item => item.id !== btn.dataset.extraDel);
    save(); renderAll();
  });

  const consejo = $("planConsejo");
  if (restante < 0) {
    consejo.textContent = `Tu plan supera el saldo por ${money(Math.abs(restante))}. Reduce primero ahorro, inversión o gastos no urgentes.`;
    consejo.className = "planAdvice danger";
  } else if (restante > 0) {
    consejo.textContent = `Aún tienes ${money(restante)} sin destino. Puedes dejarlo como colchón, adelantar una deuda o reforzar ahorro.`;
    consejo.className = "planAdvice";
  } else {
    consejo.textContent = "Todo tu saldo quedó asignado. Registra cada pago o compra para mantener el control real.";
    consejo.className = "planAdvice";
  }
}

// ===== UI NAV =====
function switchTab(tabId) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelector(`.tab[data-tab="${tabId}"]`)?.classList.add("active");
  $(tabId)?.classList.add("active");
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ===== RENDER =====
function renderPeriod() {
  const cut = activeCut();
  $("periodLabel").textContent = `Periodo actual: ${cut.startISO} → ${cut.endISO}`;
}

function renderCategorias() {
  const sel = $("categoria");
  sel.innerHTML = "";
  state.categorias.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  });

  const pSel = $("pCategoria");
  pSel.innerHTML = "";
  state.categorias.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    pSel.appendChild(opt);
  });

  const list = $("listaCategorias");
  list.innerHTML = "";
  state.categorias.forEach(cat => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div><b>${cat}</b><br/><small class="muted">Categoría</small></div>
      <button class="btn" data-del="${cat}">Eliminar</button>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = () => {
      const cat = btn.getAttribute("data-del");
      if (cat === "Apoyo a mamá") return alert("No puedes eliminar 'Apoyo a mamá'.");
      state.categorias = state.categorias.filter(x => x !== cat);
      delete state.presupuestos.personal[cat];
      delete state.presupuestos.negocio[cat];
      save();
      renderAll();
    };
  });
}

function renderPresupuestos() {
  const list = $("listaPresupuestos");
  list.innerHTML = "";

  const obj = state.presupuestos[getScope()] || {};
  const cats = Object.keys(obj);

  if (cats.length === 0) {
    list.innerHTML = `<div class="item"><small class="muted">No hay presupuestos.</small></div>`;
    return;
  }

  cats.forEach(cat => {
    const pres = Number(obj[cat] || 0);
    const gastado = gastoPorCategoria(cat);
    const restante = pres - gastado;

    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <b>${cat}</b><br/>
        <small class="muted">Presupuesto: ${money(pres)} · Gastado: ${money(gastado)} · Restante: ${money(restante)}</small>
      </div>
      <button class="btn" data-del="${cat}">Eliminar</button>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = () => {
      const cat = btn.getAttribute("data-del");
      delete state.presupuestos[getScope()][cat];
      save();
      renderAll();
    };
  });
}

function renderCuentas() {
  const list = $("listaCuentas");
  list.innerHTML = "";

  state.cuentas.forEach(c => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <b>${c.scope === "personal" ? "👤" : "🏪"} ${c.nombre}</b><br/>
        <small class="muted">Saldo inicial: ${money(c.saldoInicial)}</small>
      </div>
      <button class="btn" data-del="${c.id}">Eliminar</button>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-del");
      state.cuentas = state.cuentas.filter(x => x.id !== id);
      save();
      renderAll();
    };
  });
}

function renderMovimientoOrigen() {
  const metodo = $("mMetodo").value;
  const sel = $("mOrigen");
  sel.innerHTML = "";

  if (metodo === "cuenta") {
    cuentasScope().forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.nombre} · ${money(saldoCuenta(c.id))}`;
      sel.appendChild(opt);
    });
  } else {
    tarjetasScope().forEach(t => {
      const usado = Number(t.usado || 0);
      const limite = Number(t.limite || 0);
      const disponible = limite - usado;

      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${t.nombre} · Disponible: ${money(disponible)}`;
      sel.appendChild(opt);
    });
  }
}

function renderPagarDeudaOrigen() {
  const metodo = $("pdMetodo").value;
  const sel = $("pdOrigen");
  sel.innerHTML = "";

  if (metodo === "cuenta") {
    cuentasScope().forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.nombre} · ${money(saldoCuenta(c.id))}`;
      sel.appendChild(opt);
    });
  } else {
    tarjetasScope().forEach(t => {
      const usado = Number(t.usado || 0);
      const limite = Number(t.limite || 0);
      const disponible = limite - usado;

      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${t.nombre} · Disponible: ${money(disponible)}`;
      sel.appendChild(opt);
    });
  }
}

function renderPagarTarjetaSelects() {
  const selTarjeta = $("ptTarjeta");
  const selCuenta = $("ptCuenta");

  selTarjeta.innerHTML = "";
  tarjetasScope().forEach(t => {
    const usado = Number(t.usado || 0);
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `${t.nombre} · Usado: ${money(usado)}`;
    selTarjeta.appendChild(opt);
  });

  selCuenta.innerHTML = "";
  cuentasScope().forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.nombre} · ${money(saldoCuenta(c.id))}`;
    selCuenta.appendChild(opt);
  });
}

function renderDashboard() {
  const movs = scopeData().movimientos;
  const ingresos = sumMovs(movs, "ingreso");
  const gastos = sumMovs(movs, "gasto") + sumMovs(movs, "egreso");

  $("saldoActual").textContent = money(saldoPeriodoCuentas());
  $("totalIngresos").textContent = money(ingresos);
  $("totalGastos").textContent = money(gastos);
  $("resultado").textContent = money(ingresos - gastos);

  const top = $("topGastos");
  top.innerHTML = "";

  const map = {};
  movs.filter(m => m.tipo !== "ingreso").forEach(m => {
    map[m.categoria] = (map[m.categoria] || 0) + Number(m.monto || 0);
  });

  const topData = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,6);
  if (topData.length === 0) {
    top.innerHTML = `<div class="item"><small class="muted">No hay gastos aún.</small></div>`;
    return;
  }

  topData.forEach(([cat, val]) => {
    const pres = getPresupuesto(cat);
    const excedido = pres > 0 && val > pres;

    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <b>${cat}</b><br/>
        <small class="muted">Total: ${money(val)} ${pres>0?`· Presupuesto: ${money(pres)}`:""}</small>
      </div>
      <span class="tag">${excedido ? "🚨 Excedido" : "Top"}</span>
    `;
    top.appendChild(div);
  });
}

function renderMovimientos(filter="") {
  const list = $("listaMovimientos");
  list.innerHTML = "";

  let movs = [...scopeData().movimientos].sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));

  if (filter.trim()) {
    const f = filter.toLowerCase();
    movs = movs.filter(m => `${m.descripcion} ${m.categoria} ${m.tipo}`.toLowerCase().includes(f));
  }

  if (movs.length === 0) {
    list.innerHTML = `<div class="item"><small class="muted">No hay movimientos.</small></div>`;
    return;
  }

  movs.forEach(m => {
    const div = document.createElement("div");
    div.className = "item";

    const sign = m.tipo === "ingreso" ? "+" : "-";
    const color = m.tipo === "ingreso" ? "green" : "red";
    const metodoTxt = m.metodo === "tarjeta" ? "💳 Tarjeta" : "🏦 Cuenta";

    div.innerHTML = `
      <div>
        <b>${m.categoria}</b> <small class="muted">(${m.tipo})</small><br/>
        <small class="muted">${m.fecha} · ${m.descripcion || "—"} · ${metodoTxt}</small>
      </div>
      <div style="text-align:right;">
        <b class="${color}">${sign}${money(m.monto)}</b><br/>
        <button class="btn" data-del="${m.id}">Eliminar</button>
      </div>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-del");
      const mov = scopeData().movimientos.find(x => x.id === id);
      if (!mov) return;

      // Revertir tarjeta si aplica
      if (mov.metodo === "tarjeta" && mov.tarjetaId) {
        const tarjeta = state.tarjetas.find(t => t.id === mov.tarjetaId);
        if (tarjeta) {
          tarjeta.usado = Number(tarjeta.usado || 0) - Number(mov.monto || 0);
          if (tarjeta.usado < 0) tarjeta.usado = 0;
        }
      }

      scopeData().movimientos = scopeData().movimientos.filter(x => x.id !== id);
      save();
      renderAll();
    };
  });
}

function renderTarjetas() {
  const list = $("listaTarjetas");
  list.innerHTML = "";

  const tarjetas = tarjetasScope();
  if (tarjetas.length === 0) {
    list.innerHTML = `<div class="item"><small class="muted">No hay tarjetas aún.</small></div>`;
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "cardsWrap";

  tarjetas.forEach(t => {
    const limite = Number(t.limite || 0);
    const usado = Number(t.usado || 0);
    const disponible = limite - usado;
    const percent = limite > 0 ? Math.min(100, Math.max(0, (usado / limite) * 100)) : 0;

    const card = document.createElement("div");
    card.className = "creditCard";
    card.innerHTML = `
      <div class="ccTop">
        <div class="ccBrand">
          <span class="ccIcon">💳</span>
          <div>
            <div class="ccName">${t.nombre}</div>
            <div class="ccMeta">Crédito · Corte ${t.corte} · Pago ${t.pago}</div>
          </div>
        </div>
        <button class="ccDelete" data-del="${t.id}" title="Eliminar">✕</button>
      </div>

      <div class="ccNumbers">
        <div class="ccRow"><span class="ccLabel">Límite</span><b>${money(limite)}</b></div>
        <div class="ccRow"><span class="ccLabel">Usado</span><b class="red">${money(usado)}</b></div>
        <div class="ccRow"><span class="ccLabel">Disponible</span><b class="green">${money(disponible)}</b></div>
      </div>

      <div class="ccBar">
        <div class="ccBarFill" style="width:${percent}%;"></div>
      </div>

      <div class="ccFooter">
        <small>Uso: ${percent.toFixed(0)}%</small>
        <small>${disponible < 0 ? "🚨 Sin crédito" : "Disponible"}</small>
      </div>
    `;

    wrap.appendChild(card);
  });

  list.appendChild(wrap);

  list.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-del");
      state.tarjetas = state.tarjetas.filter(x => x.id !== id);
      save();
      renderAll();
    };
  });
}

function renderDeudas() {
  const list = $("listaDeudas");
  list.innerHTML = "";

  const deudas = deudasScope();
  if (deudas.length === 0) {
    list.innerHTML = `<div class="item"><small class="muted">No hay deudas.</small></div>`;
    return;
  }

  deudas.forEach(d => {
    const pendiente = Number(d.pendiente ?? d.total ?? 0);

    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <b>${d.nombre}</b><br/>
        <small class="muted">Total: ${money(d.total)} · Pendiente: ${money(pendiente)}</small><br/>
        <small class="muted">Pago sugerido: ${money(d.pago || 0)} · Día ${d.diaPago || "-"}</small>
      </div>
      <button class="btn" data-del="${d.id}">Eliminar</button>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-del");
      state.deudas = state.deudas.filter(x => x.id !== id);
      save();
      renderAll();
    };
  });

  const sel = $("pdDeuda");
  sel.innerHTML = "";
  deudas.forEach(d => {
    const pendiente = Number(d.pendiente ?? d.total ?? 0);
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${d.nombre} · Pendiente: ${money(pendiente)}`;
    sel.appendChild(opt);
  });
}

function renderAll() {
  $("scopeSelect").value = getScope();

  ensureCurrentCut();
  renderPeriod();
  renderCategorias();
  renderPresupuestos();
  renderCuentas();
  renderMovimientoOrigen();
  renderPagarDeudaOrigen();
  renderPagarTarjetaSelects();

  renderDashboard();
  renderPlanQuincenal();
  renderMovimientos($("searchMov").value || "");
  renderTarjetas();
  renderDeudas();
  renderRecordatorios();
  renderMetas();
  renderReportes();
  renderEstadoResultados();
  checkReminderAlerts();
}

// ===== EVENTS =====
$("scopeSelect").addEventListener("change", (e) => {
  state.activeScope = e.target.value;
  save();
  renderAll();
});

$("btnNewCut").addEventListener("click", () => {
  if (!confirm("¿Crear o activar un nuevo corte quincenal?")) return;
  createCut();
  renderAll();
});

$("btnQuickAdd").addEventListener("click", () => {
  switchTab("movimientos");
});

$("btnClearForm").addEventListener("click", () => {
  $("tipo").value = "gasto";
  $("mMetodo").value = "cuenta";
  renderMovimientoOrigen();
  $("monto").value = "";
  $("descripcion").value = "";
  $("fecha").value = todayISO();
});

$("mMetodo").addEventListener("change", renderMovimientoOrigen);
$("pdMetodo").addEventListener("change", renderPagarDeudaOrigen);

$("searchMov").addEventListener("input", (e) => {
  renderMovimientos(e.target.value);
});

$("fecha").value = todayISO();
$("pdFecha").value = todayISO();
$("ptFecha").value = todayISO();

$("repRango")?.addEventListener("change", () => {
  renderReportes();
});

$("repVista")?.addEventListener("change", () => {
  renderReportes();
});

window.addEventListener("resize", () => {
  renderReportes();
});

// ===== Eventos PIN =====
$("pinInput").addEventListener("input", updatePinDots);

$("btnPinClear").addEventListener("click", () => {
  $("pinInput").value = "";
  updatePinDots();
  $("pinInput").focus();
});

$("btnPinEnter").addEventListener("click", () => {
  tryUnlockOrCreatePin();
});

$("pinInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryUnlockOrCreatePin();
});

$("btnLock").addEventListener("click", () => {
  lockApp();
});

// Reset total si olvidas PIN
$("btnPinResetAll").addEventListener("click", () => {
  if (!confirm("⚠️ Esto borrará TODO (datos + PIN).\n¿Deseas continuar?")) return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(PIN_UNLOCK_KEY);
  location.reload();
});

// Guardar movimiento
$("formMovimiento").addEventListener("submit", (e) => {
  e.preventDefault();

  const tipo = $("tipo").value;
  const categoria = $("categoria").value;
  const monto = Number($("monto").value || 0);
  const descripcion = $("descripcion").value.trim();
  const fecha = $("fecha").value || todayISO();

  const metodo = $("mMetodo").value;
  const origenId = $("mOrigen").value;

  if (monto <= 0) return alert("Monto inválido.");

  // Ingreso solo a cuenta
  if (tipo === "ingreso" && metodo === "tarjeta") {
    alert("Un ingreso no entra directo a tarjeta. Selecciona Cuenta.");
    $("mMetodo").value = "cuenta";
    renderMovimientoOrigen();
    return;
  }

  if (metodo === "cuenta") {
    const saldo = saldoCuenta(origenId);
    if (tipo !== "ingreso" && monto > saldo) return alert("No tienes saldo suficiente.");

    scopeData().movimientos.push({
      id: uid(),
      tipo,
      metodo: "cuenta",
      cuentaId: origenId,
      tarjetaId: null,
      categoria,
      monto,
      descripcion,
      fecha
    });
  } else {
    const tarjeta = state.tarjetas.find(t => t.id === origenId);
    if (!tarjeta) return alert("Tarjeta no encontrada.");

    tarjeta.usado = Number(tarjeta.usado || 0);
    const disponible = Number(tarjeta.limite || 0) - tarjeta.usado;

    if (tipo === "ingreso") return;
    if (monto > disponible) return alert("No tienes crédito disponible.");

    tarjeta.usado += monto;

    scopeData().movimientos.push({
      id: uid(),
      tipo,
      metodo: "tarjeta",
      cuentaId: null,
      tarjetaId: origenId,
      categoria,
      monto,
      descripcion,
      fecha
    });
  }

  save();

  // alerta presupuesto
  if (tipo !== "ingreso") {
    const pres = getPresupuesto(categoria);
    if (pres > 0) {
      const gastado = gastoPorCategoria(categoria);
      if (gastado > pres) {
        alert(`🚨 Te pasaste del presupuesto en "${categoria}".\nGastado: ${money(gastado)} / Presupuesto: ${money(pres)}`);
      }
    }
  }

  $("monto").value = "";
  $("descripcion").value = "";
  renderAll();
});

// Guardar tarjeta
$("formTarjeta").addEventListener("submit", (e) => {
  e.preventDefault();

  const limite = Number($("tLimite").value || 0);
  const usado = Number($("tUsado").value || 0);

  if (usado > limite) return alert("El usado no puede ser mayor que el límite.");

  state.tarjetas.push({
    id: uid(),
    scope: getScope(),
    nombre: $("tNombre").value.trim(),
    limite,
    usado,
    corte: Number($("tCorte").value || 1),
    pago: Number($("tPago").value || 1),
  });

  save();

  $("tNombre").value = "";
  $("tLimite").value = "";
  $("tUsado").value = "";
  $("tCorte").value = "";
  $("tPago").value = "";

  renderAll();
});

// Pagar tarjeta (desde cuenta)
$("formPagarTarjeta").addEventListener("submit", (e) => {
  e.preventDefault();

  const tarjetaId = $("ptTarjeta").value;
  const cuentaId = $("ptCuenta").value;
  const monto = Number($("ptMonto").value || 0);
  const fecha = $("ptFecha").value || todayISO();

  if (monto <= 0) return alert("Monto inválido.");

  const tarjeta = state.tarjetas.find(t => t.id === tarjetaId);
  if (!tarjeta) return alert("Tarjeta no encontrada.");

  const saldo = saldoCuenta(cuentaId);
  if (monto > saldo) return alert("No tienes saldo suficiente en esa cuenta.");

  tarjeta.usado = Number(tarjeta.usado || 0);
  if (monto > tarjeta.usado) return alert("No puedes pagar más de lo usado.");

  // Registrar egreso en cuenta
  scopeData().movimientos.push({
    id: uid(),
    tipo: "egreso",
    metodo: "cuenta",
    cuentaId,
    tarjetaId: null,
    categoria: "Pago tarjeta",
    monto,
    descripcion: `Pago a tarjeta ${tarjeta.nombre}`,
    fecha
  });

  // Bajar usado
  tarjeta.usado -= monto;

  save();
  $("ptMonto").value = "";
  renderAll();
  alert("✅ Pago de tarjeta aplicado.");
});

// Guardar deuda
$("formDeuda").addEventListener("submit", (e) => {
  e.preventDefault();

  const total = Number($("dTotal").value || 0);
  const deuda = {
    id: uid(),
    scope: getScope(),
    nombre: $("dNombre").value.trim(),
    total,
    pendiente: total,
    pago: Number($("dPago").value || 0),
    diaPago: Number($("dDiaPago").value || 1),
    fechaPago: $("dFechaPago").value || "",
    alertaDias: Number($("dAlertaDias").value || 0),
  };

  state.deudas.push(deuda);
  syncReminderFromDeuda(deuda);
  save();

  $("dNombre").value = "";
  $("dTotal").value = "";
  $("dPago").value = "";
  $("dDiaPago").value = "";
  $("dFechaPago").value = "";
  $("dAlertaDias").value = "";

  renderAll();
});

// Pagar deuda
$("formPagarDeuda").addEventListener("submit", (e) => {
  e.preventDefault();

  const deudaId = $("pdDeuda").value;
  const monto = Number($("pdMonto").value || 0);
  const metodo = $("pdMetodo").value;
  const origenId = $("pdOrigen").value;
  const fecha = $("pdFecha").value || todayISO();

  const deuda = state.deudas.find(d => d.id === deudaId);
  if (!deuda) return alert("Deuda no encontrada.");

  deuda.pendiente = Number(deuda.pendiente ?? deuda.total ?? 0);

  if (monto <= 0) return alert("Monto inválido.");
  if (monto > deuda.pendiente) return alert("El monto es mayor que lo pendiente.");

  if (metodo === "cuenta") {
    const saldo = saldoCuenta(origenId);
    if (monto > saldo) return alert("No tienes saldo suficiente.");

    scopeData().movimientos.push({
      id: uid(),
      tipo: "egreso",
      metodo: "cuenta",
      cuentaId: origenId,
      tarjetaId: null,
      categoria: "Pago deuda",
      monto,
      descripcion: `Pago a ${deuda.nombre}`,
      fecha,
    });
  } else {
    const tarjeta = state.tarjetas.find(t => t.id === origenId);
    if (!tarjeta) return alert("Tarjeta no encontrada.");

    tarjeta.usado = Number(tarjeta.usado || 0);
    const disponible = Number(tarjeta.limite || 0) - tarjeta.usado;
    if (monto > disponible) return alert("No tienes crédito disponible.");

    tarjeta.usado += monto;
  }

  deuda.pendiente -= monto;

  if (deuda.pendiente <= 0) {
    state.recordatorios = state.recordatorios.filter(r => !(r.tipo === "deuda" && r.refId === deuda.id));
  }

  save();
  $("pdMonto").value = "";
  renderAll();
  alert("✅ Pago de deuda aplicado.");
});

// Guardar cuenta
$("formCuenta").addEventListener("submit", (e) => {
  e.preventDefault();

  const scope = $("cScope").value;
  const nombre = $("cNombre").value.trim();
  const saldo = Number($("cSaldo").value || 0);

  state.cuentas.push({ id: uid(), scope, nombre, saldoInicial: saldo });
  save();

  $("cNombre").value = "";
  $("cSaldo").value = "";

  renderAll();
});

// Guardar categoría
$("formCategoria").addEventListener("submit", (e) => {
  e.preventDefault();

  const nueva = $("catNueva").value.trim();
  if (!nueva) return;

  if (state.categorias.includes(nueva)) return alert("Esa categoría ya existe.");

  state.categorias.push(nueva);
  save();

  $("catNueva").value = "";
  renderAll();
});

// Guardar presupuesto
$("formPresupuesto").addEventListener("submit", (e) => {
  e.preventDefault();

  const cat = $("pCategoria").value;
  const monto = Number($("pMonto").value || 0);

  state.presupuestos[getScope()][cat] = monto;

  if (getScope() === "personal" && cat === "Apoyo a mamá") {
    state.autoGastos.personal.apoyoMamaMonto = monto;
  }

  save();
  $("pMonto").value = "";
  renderAll();
});

// Guardar meta
$("formMeta").addEventListener("submit", (e) => {
  e.preventDefault();

  state.metas.push({
    id: uid(),
    nombre: $("metaNombre").value.trim(),
    montoMeta: Number($("metaMonto").value || 0),
    montoAhorrado: 0,
    fechaMeta: $("metaFecha").value || "",
  });

  save();
  $("metaNombre").value = "";
  $("metaMonto").value = "";
  $("metaFecha").value = "";
  renderAll();
});

// Reset
$("btnReset").addEventListener("click", () => {
  if (!confirm("¿Seguro que deseas borrar todo?")) return;
  localStorage.removeItem(KEY);
  state = defaultData();
  createCut();
  renderAll();
});


//reportes 

function getRangeDates(rango) {
  const now = new Date();
  const end = new Date(now);

  let start = new Date(now);

  if (rango === "semana") {
    start.setDate(now.getDate() - 6);
  } else if (rango === "mes") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    // quincena actual
    const p = getQuincenaPeriod(now);
    start = new Date(p.startISO);
  }

  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);
  return { startISO, endISO };
}

function inRange(dateISO, startISO, endISO) {
  return dateISO >= startISO && dateISO <= endISO;
}

function getMovimientosEnRango(rango) {
  const { startISO, endISO } = getRangeDates(rango);

  // junta movimientos de TODOS los cortes, no solo el actual
  const scope = getScope();
  const all = [];
  state.cuts.forEach(cut => {
    const movs = (cut[scope]?.movimientos || []);
    movs.forEach(m => {
      if (m.fecha && inRange(m.fecha, startISO, endISO)) all.push(m);
    });
  });

  return all;
}

function drawDonut(canvasId, dataMap) {
  const canvas = $(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  // Ajuste real de tamaño (para que se vea en móvil)
  const w = canvas.offsetWidth || 320;
  const h = 260;

  canvas.width = Math.floor(w * window.devicePixelRatio);
  canvas.height = Math.floor(h * window.devicePixelRatio);
  canvas.style.height = h + "px";
  canvas.style.width = w + "px";

  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const entries = Object.entries(dataMap).filter(([, v]) => v > 0);
  const total = entries.reduce((a, [, v]) => a + v, 0);

  if (entries.length === 0 || total <= 0) {
    ctx.fillStyle = "rgba(255,255,255,.65)";
    ctx.font = "14px system-ui";
    ctx.fillText("Sin datos para graficar.", 14, 30);
    return;
  }

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.32;
  const rInner = r * 0.60;

  let startAngle = -Math.PI / 2;

  // Dibujo porciones
  entries.forEach(([label, value], i) => {
    const angle = (value / total) * (Math.PI * 2);
    const endAngle = startAngle + angle;

    const color = CATEGORY_COLORS[label] || "#64748b";
    ctx.fillStyle = color;


    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();

    startAngle = endAngle;
  });

  // Hueco
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Texto centro
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.textAlign = "center";
  ctx.font = "bold 16px system-ui";
  ctx.fillText("Gastos", cx, cy - 8);
  ctx.font = "bold 14px system-ui";
  ctx.fillText(money(total), cx, cy + 16);
}


function renderRecordatorios() {
  const list = $("listaRecordatorios");
  list.innerHTML = "";

  if (state.recordatorios.length === 0) {
    list.innerHTML = `<div class="item"><small class="muted">No hay recordatorios asignados.</small></div>`;
    return;
  }

  state.recordatorios.filter(r => !r.completado).forEach(reminder => {
    const status = getReminderStatus(reminder);
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <b>${reminder.nombre}</b><br/>
        <small class="muted">Fecha: ${reminder.fecha || "—"} · Alerta: ${reminder.diasAlerta || 0} días antes</small>
      </div>
      <span class="tag ${status.tone === "danger" ? "danger" : status.tone === "warning" ? "warning" : ""}">${status.label}</span>
    `;
    list.appendChild(div);
  });
}

function renderMetas() {
  const list = $("listaMetas");
  list.innerHTML = "";

  if (state.metas.length === 0) {
    list.innerHTML = `<div class="item"><small class="muted">No hay metas registradas.</small></div>`;
    return;
  }

  state.metas.forEach(meta => {
    const porcentaje = meta.montoMeta > 0 ? Math.min(100, (meta.montoAhorrado / meta.montoMeta) * 100) : 0;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div style="flex:1">
        <b>${meta.nombre}</b><br/>
        <small class="muted">${money(meta.montoAhorrado)} de ${money(meta.montoMeta)} · Meta: ${meta.fechaMeta || "Sin fecha"}</small>
        <div class="progressBar"><div class="progressFill" style="width:${porcentaje}%"></div></div>
      </div>
      <button class="btn" data-add="${meta.id}">Añadir</button>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll("[data-add]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-add");
      const meta = state.metas.find(m => m.id === id);
      if (!meta) return;
      const valor = Number(prompt(`¿Cuánto deseas agregar a ${meta.nombre}?`, "100"));
      if (!Number.isFinite(valor) || valor <= 0) return;
      meta.montoAhorrado += valor;
      save();
      renderAll();
    };
  });
}

function syncReminderFromDeuda(deuda) {
  const existing = state.recordatorios.find(r => r.tipo === "deuda" && r.refId === deuda.id);
  if (!deuda.fechaPago || !Number(deuda.alertaDias || 0)) {
    state.recordatorios = state.recordatorios.filter(r => !(r.tipo === "deuda" && r.refId === deuda.id));
    return;
  }

  const reminder = {
    id: existing?.id || uid(),
    tipo: "deuda",
    refId: deuda.id,
    nombre: `${deuda.nombre} · Pago`,
    fecha: deuda.fechaPago,
    diasAlerta: Number(deuda.alertaDias || 3),
    completado: false,
  };

  if (existing) {
    Object.assign(existing, reminder);
  } else {
    state.recordatorios.push(reminder);
  }
}

function checkReminderAlerts() {
  const today = new Date().toISOString().slice(0, 10);
  const last = sessionStorage.getItem(REMINDER_ALERT_KEY);
  if (last === today) return;

  const proximos = state.recordatorios.filter(r => !r.completado && r.fecha).map(r => {
    const diff = Math.ceil((new Date(`${r.fecha}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
    return { ...r, diff };
  }).filter(r => r.diff <= Number(r.diasAlerta || 3));

  if (proximos.length > 0) {
    const texto = proximos.map(r => `• ${r.nombre}: ${r.diff < 0 ? "vencido" : `en ${r.diff} día(s)`}`).join("\n");
    sessionStorage.setItem(REMINDER_ALERT_KEY, today);
    alert(`🔔 Recordatorios próximos:\n${texto}`);
  }
}

function renderEstadoResultados() {
  const contenedor = $("estadoResultados");
  if (!contenedor) return;

  const movimientos = getMovimientosEnRango("mes");
  const ingresos = movimientos.filter(m => m.tipo === "ingreso").reduce((total, m) => total + Number(m.monto || 0), 0);
  const ahorro = movimientos.filter(m => m.tipo !== "ingreso" && m.categoria === "Ahorro").reduce((total, m) => total + Number(m.monto || 0), 0);
  const inversion = movimientos.filter(m => m.tipo !== "ingreso" && m.categoria === "Inversión").reduce((total, m) => total + Number(m.monto || 0), 0);
  const gastos = movimientos.filter(m => m.tipo !== "ingreso" && !["Ahorro", "Inversión"].includes(m.categoria)).reduce((total, m) => total + Number(m.monto || 0), 0);
  const resultadoOperativo = ingresos - gastos;
  const resultadoNeto = resultadoOperativo - ahorro - inversion;
  const mes = new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  contenedor.innerHTML = `
    <div class="item"><div><b>Periodo</b><br><small class="muted">${mes}</small></div><span class="tag">Mensual</span></div>
    <div class="item"><b>Ingresos</b><b class="green">${money(ingresos)}</b></div>
    <div class="item"><b>Gastos operativos</b><b class="red">-${money(gastos)}</b></div>
    <div class="item"><b>Ahorro e inversión</b><b>-${money(ahorro + inversion)}</b></div>
    <div class="item estadoFinal"><b>Resultado neto del mes</b><b class="${resultadoNeto < 0 ? "red" : "green"}">${money(resultadoNeto)}</b></div>
  `;
}

function renderReportes() {
  const rango = $("repRango")?.value || "quincena";
  const vista = $("repVista")?.value || "dia";
  const movs = getMovimientosEnRango(rango);

  const ingresos = movs.filter(m => m.tipo === "ingreso").reduce((a,m)=>a+Number(m.monto||0),0);
  const gastos = movs.filter(m => m.tipo !== "ingreso").reduce((a,m)=>a+Number(m.monto||0),0);

  $("repIngresos").textContent = money(ingresos);
  $("repGastos").textContent = money(gastos);
  $("repResultado").textContent = money(ingresos - gastos);

  const map = {};
  movs.filter(m => m.tipo !== "ingreso").forEach(m => {
    map[m.categoria] = (map[m.categoria] || 0) + Number(m.monto || 0);
  });

  const top = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const list = $("repTopCats");
  list.innerHTML = "";

  if (top.length === 0) {
    list.innerHTML = `<div class="item"><small class="muted">Sin gastos en este rango.</small></div>`;
  } else {
    top.forEach(([cat, val]) => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div><b>${cat}</b><br/><small class="muted">${money(val)}</small></div>
        <span class="tag">Top</span>
      `;
      list.appendChild(div);
    });
  }

  const detalle = buildPeriodSummary(movs, vista);
  const detalleList = $("repDetalle");
  detalleList.innerHTML = "";

  if (detalle.length === 0) {
    detalleList.innerHTML = `<div class="item"><small class="muted">Sin datos para esta vista.</small></div>`;
  } else {
    detalle.forEach(item => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div>
          <b>${item.label}</b><br/>
          <small class="muted">Ingresos: ${money(item.ingresos)} · Gastos: ${money(item.gastos)}</small>
        </div>
        <span class="tag">${money(item.gastos)}</span>
      `;
      detalleList.appendChild(div);
    });
  }

  drawDonut("repChart", map);
  const legend = $("repLegend");
  if (legend) {
    legend.innerHTML = "";

    const entries = Object.entries(map).filter(([, v]) => v > 0);
    const total = entries.reduce((a, [, v]) => a + v, 0);

    if (entries.length === 0 || total <= 0) {
      legend.innerHTML = `<div class="item"><small class="muted">Sin gastos para mostrar.</small></div>`;
    } else {
      entries.sort((a,b)=>b[1]-a[1]);

      entries.forEach(([cat, val]) => {
        const pct = (val / total) * 100;
        const color = CATEGORY_COLORS[cat] || "#64748b";

        const row = document.createElement("div");
        row.className = "legendItem";
        row.innerHTML = `
          <div class="legendLeft">
            <span class="legendDot" style="background:${color}"></span>
            <div>
              <div class="legendName">${cat}</div>
              <div class="legendSub">${money(val)}</div>
            </div>
          </div>
          <div class="legendRight">
            <div class="legendPct">${pct.toFixed(0)}%</div>
          </div>
        `;
        legend.appendChild(row);
      });
    }
  }
}

pinFlowText();

if (!isUnlocked()) {
  showPinOverlay();
} else {
  hidePinOverlay();
}

renderAll();

/*bloqueo de pantalla*/
let lockTimer;
function resetAutoLock(){
  clearTimeout(lockTimer);
  lockTimer = setTimeout(lockApp, 3 * 60 * 1000); // 3 minutos
}
["click","touchstart","keydown"].forEach(e =>
  document.addEventListener(e, resetAutoLock)
);

// ===============================
// GUARDAR AUTOMÁTICO
// ===============================
function guardarLocal(){

    const datos = {
        raw: document.getElementById("inputData").value,
        dieselInicial: document.getElementById("dieselInicial").value,
        precios: preciosPorDia
    };

    localStorage.setItem(
        "diesel_pro_backup",
        JSON.stringify(datos)
    );
}

// ===============================
// CARGAR BACKUP
// ===============================
function cargarLocal(){

    let backup = localStorage.getItem("diesel_pro_backup");

    if(!backup) return;

    let data = JSON.parse(backup);

    document.getElementById("inputData").value =
        data.raw || "";

    document.getElementById("dieselInicial").value =
        data.dieselInicial || "";

    preciosPorDia = data.precios || {};
}

// ===============================
// IMPRIMIR REPORTES
// ===============================
function imprimirReportes(){

    showSection("reportes");

    setTimeout(()=>{
        window.print();
    },500);
}

// ===============================
// CAMBIAR PRECIOS
// ===============================
function resetPrecios(){

    preciosPorDia = {};

    renderReportes();

    guardarLocal();
}

// ===============================
// EVENTOS AUTO GUARDADO
// ===============================
document.addEventListener("DOMContentLoaded",()=>{

    cargarLocal();

    document.getElementById("inputData")
    .addEventListener("input",guardarLocal);

    document.getElementById("dieselInicial")
    .addEventListener("input",guardarLocal);

});

$("formPlan").addEventListener("submit", (e) => {
  e.preventDefault();
  const plan = getPlanQuincenal();
  plan.pasajes = Math.max(0, Number($("planPasajes").value || 0));
  plan.comida = Math.max(0, Number($("planComida").value || 0));
  plan.deudas = Math.max(0, Number($("planDeudas").value || 0));
  plan.ahorro = Math.max(0, Number($("planAhorro").value || 0));
  plan.inversion = Math.max(0, Number($("planInversion").value || 0));
  plan.real.pasajes = Math.max(0, Number($("planPasajesReal").value || 0));
  plan.real.comida = Math.max(0, Number($("planComidaReal").value || 0));
  plan.real.deudas = Math.max(0, Number($("planDeudasReal").value || 0));
  plan.real.ahorro = Math.max(0, Number($("planAhorroReal").value || 0));
  plan.real.inversion = Math.max(0, Number($("planInversionReal").value || 0));
  $("planExtras").querySelectorAll("[data-extra-est]").forEach(input => {
    const item = plan.extras.find(extra => extra.id === input.dataset.extraEst);
    if (item) item.estimado = Math.max(0, Number(input.value || 0));
  });
  $("planExtras").querySelectorAll("[data-extra-real]").forEach(input => {
    const item = plan.extras.find(extra => extra.id === input.dataset.extraReal);
    if (item) item.real = Math.max(0, Number(input.value || 0));
  });

  const asignado = [plan.pasajes, plan.comida, plan.deudas, plan.ahorro, plan.inversion]
    .reduce((total, valor) => total + Number(valor || 0), 0)
    + plan.extras.reduce((total, item) => total + Number(item.estimado || 0), 0);
  const disponible = saldoPeriodoCuentas();
  if (asignado > disponible && !confirm(`El plan supera tu saldo por ${money(asignado - disponible)}. ¿Deseas guardarlo de todos modos?`)) return;

  save();
  renderAll();
});

$("btnSugerirPlan").addEventListener("click", () => {
  const plan = getPlanQuincenal();
  const disponible = Math.max(0, saldoPeriodoCuentas());
  const pasajes = Number($("planPasajes").value || plan.pasajes || 0);
  const comida = Number($("planComida").value || plan.comida || 0);
  const deudas = Number($("planDeudas").value || deudaSugeridaQuincenal());
  const esenciales = pasajes + comida + deudas;
  const libre = Math.max(0, disponible - esenciales);

  $("planPasajes").value = pasajes || "";
  $("planComida").value = comida || "";
  $("planDeudas").value = deudas || "";
  $("planAhorro").value = Math.round(libre * 0.6) || "";
  $("planInversion").value = Math.round(libre * 0.4) || "";
});

$("btnAgregarPlanItem").addEventListener("click", () => {
  const nombre = $("nuevoPlanConcepto").value.trim();
  if (!nombre) return alert("Escribe el nombre del concepto.");
  const plan = getPlanQuincenal();
  plan.extras.push({
    id: uid(), nombre,
    estimado: Math.max(0, Number($("nuevoPlanEstimado").value || 0)),
    real: Math.max(0, Number($("nuevoPlanReal").value || 0)),
  });
  save();
  $("nuevoPlanConcepto").value = "";
  $("nuevoPlanEstimado").value = "";
  $("nuevoPlanReal").value = "";
  renderAll();
});

$("btnLimpiarPlan").addEventListener("click", () => {
  if (!confirm("¿Reiniciar las cantidades planeadas de esta quincena?")) return;
  const plan = getPlanQuincenal();
  ["pasajes", "comida", "deudas", "ahorro", "inversion"].forEach(key => { plan[key] = 0; plan.real[key] = 0; });
  plan.extras = [];
  save();
  renderAll();
});

$("btnEstadoResultados").addEventListener("click", () => {
  renderEstadoResultados();
  switchTab("reportes");
});
