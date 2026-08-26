// ======================
// Calculadora de Ganancias - PWA
// Copyright © 2026
// Oscar Antonio Alvarez Collado
// ======================

const STORAGE_KEY = "calculadora_ganancias_v2";

let store = { sesiones: [], sesionActivaId: null };
let chartGanancias = null;
let chartProducto = null;
let modalSesionModo = "crear";
let modalPrecioProducto = null;
let productoDetalle = null;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
function dinero(n) { return "$" + Number(n || 0).toFixed(2); }
function formatearFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}
function sesionActiva() {
  return store.sesiones.find(s => s.id === store.sesionActivaId) || store.sesiones[0];
}

// ---------- Persistencia ----------
function cargar() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { store = JSON.parse(raw); } catch (e) { console.error(e); }
  }
  if (!store.sesiones || store.sesiones.length === 0) {
    const old = localStorage.getItem("calculadora_ganancias_v1");
    if (old) {
      try {
        const oldData = JSON.parse(old);
        const s = { id: uid(), nombre: "Principal", lotes: oldData.lotes || [], ventas: oldData.ventas || [], precios: {} };
        store = { sesiones: [s], sesionActivaId: s.id };
        guardar();
      } catch (e) {}
    }
  }
  if (!store.sesiones || store.sesiones.length === 0) {
    const s = { id: uid(), nombre: "Principal", lotes: [], ventas: [], precios: {} };
    store = { sesiones: [s], sesionActivaId: s.id };
    guardar();
  }
  if (!store.sesionActivaId || !store.sesiones.find(s => s.id === store.sesionActivaId)) {
    store.sesionActivaId = store.sesiones[0].id;
  }
  store.sesiones.forEach(s => { if (!s.precios) s.precios = {}; });
}
function guardar() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// ---------- Navegación ----------
function irA(nombre) {
  document.querySelectorAll(".pantalla").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const pant = document.getElementById("pantalla-" + nombre);
  if (pant) pant.classList.add("active");
  const nav = document.querySelector(`.nav-item[data-pantalla="${nombre}"]`);
  if (nav) nav.classList.add("active");
  // mostrar resumen global excepto en detalle
  document.getElementById("resumen-bar").style.display = nombre === "detalle" ? "none" : "grid";
  if (nombre === "grafico") setTimeout(renderGrafico, 60);
  if (nombre === "venta") { actualizarSelectProductos(); actualizarSelectPrecios(); }
  if (nombre === "inventario") renderInventario();
}

// ---------- Sesiones ----------
function renderSesionesSelect() {
  const sel = document.getElementById("sesion-select");
  sel.innerHTML = "";
  store.sesiones.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.nombre;
    if (s.id === store.sesionActivaId) opt.selected = true;
    sel.appendChild(opt);
  });
}
function cambiarSesion(id) {
  store.sesionActivaId = id;
  guardar();
  actualizarTodo();
}
function abrirModalSesion() {
  modalSesionModo = "crear";
  document.getElementById("modal-sesion-titulo").textContent = "Nueva sesión";
  document.getElementById("modal-sesion-nombre").value = "";
  document.getElementById("modal-sesion-ok").textContent = "Crear";
  document.getElementById("modal-sesion").classList.remove("oculto");
  setTimeout(() => document.getElementById("modal-sesion-nombre").focus(), 100);
}
function editarSesionActual() {
  const s = sesionActiva();
  if (!s) return;
  modalSesionModo = "editar";
  document.getElementById("modal-sesion-titulo").textContent = "Renombrar sesión";
  document.getElementById("modal-sesion-nombre").value = s.nombre;
  document.getElementById("modal-sesion-ok").textContent = "Guardar";
  document.getElementById("modal-sesion").classList.remove("oculto");
}
function cerrarModalSesion() {
  document.getElementById("modal-sesion").classList.add("oculto");
}
function guardarSesionModal() {
  const nombre = document.getElementById("modal-sesion-nombre").value.trim();
  if (!nombre) return alert("Escribe un nombre.");
  if (modalSesionModo === "crear") {
    const s = { id: uid(), nombre, lotes: [], ventas: [], precios: {} };
    store.sesiones.push(s);
    store.sesionActivaId = s.id;
  } else {
    const s = sesionActiva();
    if (s) s.nombre = nombre;
  }
  guardar();
  cerrarModalSesion();
  actualizarTodo();
}
function eliminarSesionActual() {
  if (store.sesiones.length <= 1) return alert("No puedes eliminar la única sesión.");
  const s = sesionActiva();
  if (!confirm(`¿Eliminar la sesión "${s.nombre}" y TODOS sus datos?`)) return;
  store.sesiones = store.sesiones.filter(x => x.id !== s.id);
  store.sesionActivaId = store.sesiones[0].id;
  guardar();
  actualizarTodo();
  alert("Sesión eliminada.");
}

// ---------- Cálculos ----------
function calcularResumen() {
  const s = sesionActiva();
  let invertido = 0, vendido = 0, ganancia = 0, stockActual = 0;
  s.lotes.forEach(l => { invertido += l.costoTotal; stockActual += l.cantidadRestante; });
  s.ventas.forEach(v => { vendido += v.ingreso; ganancia += v.ganancia; });
  return { invertido, vendido, ganancia, stockActual };
}

function calcProducto(nombre) {
  const s = sesionActiva();
  const lotes = s.lotes.filter(l => l.nombre === nombre);
  const ventas = s.ventas.filter(v => v.nombre === nombre);

  let stockActual = 0, stockTotal = 0, invertido = 0, costoRestante = 0;
  lotes.forEach(l => {
    stockActual += l.cantidadRestante;
    stockTotal += l.cantidadInicial;
    invertido += l.costoTotal;
    costoRestante += l.costoUnitario * l.cantidadRestante;
  });

  let vendidas = 0, ganancia = 0, ingresos = 0, costoVendido = 0;
  ventas.forEach(v => {
    vendidas += v.cantidad;
    ganancia += v.ganancia;
    ingresos += v.ingreso;
    costoVendido += v.costo;
  });

  // Costo promedio del stock restante (o histórico si no queda)
  const costoProm = stockActual > 0
    ? costoRestante / stockActual
    : (stockTotal > 0 ? invertido / stockTotal : 0);

  const precioVenta = s.precios[nombre];

  // Ganancia pendiente = solo stock restante × margen
  let gananciaPendiente = 0;
  if (precioVenta != null && stockActual > 0) {
    gananciaPendiente = stockActual * (precioVenta - costoProm);
  }
  const gananciaProyectada = ganancia + gananciaPendiente;

  // Margen
  const margenUnit = precioVenta != null ? precioVenta - costoProm : null;
  const margenPct = precioVenta != null && precioVenta > 0
    ? ((precioVenta - costoProm) / precioVenta) * 100
    : null;

  // Valor del stock
  const valorCosto = costoRestante;
  const valorVenta = precioVenta != null ? stockActual * precioVenta : null;

  // ROI sobre lo invertido (ganancia ya realizada / invertido)
  const roi = invertido > 0 ? (ganancia / invertido) * 100 : null;

  // Ingreso si vendes TODAS las unidades al precio establecido
  const ingresoTotal = precioVenta != null ? stockTotal * precioVenta : null;

  // Última venta
  let ultimaVenta = null;
  if (ventas.length > 0) {
    const ord = [...ventas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    ultimaVenta = ord[0].fecha;
  }

  return {
    nombre,
    lotesList: lotes,
    lotes: lotes.length,
    stockActual, stockTotal, invertido,
    costoProm, precioVenta, vendidas,
    ganancia, gananciaPendiente, gananciaProyectada,
    ingresos, costoVendido,
    margenUnit, margenPct,
    valorCosto, valorVenta, roi,
    ingresoTotal,
    numVentas: ventas.length,
    ultimaVenta,
    ventas
  };
}

// ---------- Render ----------
function renderResumen() {
  const r = calcularResumen();
  document.getElementById("res-invertido").textContent = dinero(r.invertido);
  document.getElementById("res-vendido").textContent = dinero(r.vendido);
  const gEl = document.getElementById("res-ganancia");
  gEl.textContent = dinero(r.ganancia);
  gEl.className = "value" + (r.ganancia < 0 ? " negativo" : "");
  document.getElementById("res-stock").textContent = r.stockActual + " uds";
}

function renderInventario() {
  const cont = document.getElementById("lista-inventario");
  const s = sesionActiva();
  if (s.lotes.length === 0) {
    cont.innerHTML = `<div class="empty">No hay productos.<br>Agrega un lote desde Inicio.</div>`;
    return;
  }
  const productos = {};
  s.lotes.forEach(lote => {
    if (!productos[lote.nombre]) {
      productos[lote.nombre] = { nombre: lote.nombre, stockActual: 0, stockTotal: 0, lotes: 0 };
    }
    productos[lote.nombre].stockActual += lote.cantidadRestante;
    productos[lote.nombre].stockTotal += lote.cantidadInicial;
    productos[lote.nombre].lotes++;
  });

  let html = "";
  Object.values(productos).forEach(p => {
    const agotado = p.stockActual === 0;
    const safe = p.nombre.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    html += `
      <div class="inv-item ${agotado ? 'agotado' : ''}" onclick="abrirDetalle('${safe}')">
        <div class="inv-left">
          <div class="inv-nombre">${p.nombre}</div>
          <div class="inv-meta">
            <span>Stock: <strong>${p.stockActual}/${p.stockTotal}</strong></span>
            <span>Lotes: <strong>${p.lotes}</strong></span>
          </div>
        </div>
        <svg class="inv-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    `;
  });
  cont.innerHTML = html;
}

function abrirDetalle(nombre) {
  productoDetalle = nombre;
  const p = calcProducto(nombre);

  document.getElementById("detalle-nombre").textContent = nombre;
  document.getElementById("det-stock").textContent = p.stockActual + "/" + p.stockTotal;
  document.getElementById("det-invertido").textContent = dinero(p.invertido);

  const gEl = document.getElementById("det-ganancia");
  gEl.textContent = dinero(p.ganancia);
  gEl.className = "value" + (p.ganancia < 0 ? " negativo" : "");

  const pEl = document.getElementById("det-ganancia-full");
  pEl.textContent = dinero(p.gananciaPendiente);
  pEl.className = "value" + (p.gananciaPendiente < 0 ? " negativo" : "");

  const ingTot = document.getElementById("det-ingreso-total");
  if (ingTot) ingTot.textContent = p.ingresoTotal != null ? dinero(p.ingresoTotal) : "—";

  document.getElementById("det-costo-prom").textContent = dinero(p.costoProm);
  document.getElementById("det-precio-venta").textContent = p.precioVenta != null ? dinero(p.precioVenta) : "—";
  document.getElementById("det-margen-unit").textContent = p.margenUnit != null ? dinero(p.margenUnit) : "—";
  document.getElementById("det-margen-pct").textContent = p.margenPct != null ? p.margenPct.toFixed(1) + "%" : "—";
  document.getElementById("det-ingresos").textContent = dinero(p.ingresos);
  document.getElementById("det-costo-vendido").textContent = dinero(p.costoVendido);
  document.getElementById("det-valor-costo").textContent = dinero(p.valorCosto);
  document.getElementById("det-valor-venta").textContent = p.valorVenta != null ? dinero(p.valorVenta) : "—";
  document.getElementById("det-proyectado").textContent = dinero(p.gananciaProyectada);
  document.getElementById("det-roi").textContent = p.roi != null ? p.roi.toFixed(1) + "%" : "—";

  document.getElementById("det-lotes").textContent = p.lotes;
  document.getElementById("det-vendidas").textContent = p.vendidas;
  document.getElementById("det-num-ventas").textContent = p.numVentas;
  document.getElementById("det-ultima-venta").textContent = p.ultimaVenta ? formatearFecha(p.ultimaVenta) : "—";

  // Lista de lotes
  const contLotes = document.getElementById("det-lista-lotes");
  if (!p.lotesList || p.lotesList.length === 0) {
    contLotes.innerHTML = `<div class="empty" style="padding:12px">Sin lotes</div>`;
  } else {
    const ordL = [...p.lotesList].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    contLotes.innerHTML = `<ul class="lista">` + ordL.map(l => `
      <li class="${l.cantidadRestante === 0 ? 'agotado' : ''}">
        <div class="item-header">
          <span class="item-nombre">${l.cantidadRestante}/${l.cantidadInicial} uds</span>
          <span class="item-fecha">${formatearFecha(l.fecha)}</span>
        </div>
        <div class="item-detalle">
          Costo total: ${dinero(l.costoTotal)} · Unit: ${dinero(l.costoUnitario)}
        </div>
      </li>
    `).join("") + `</ul>`;
  }

  // Últimas ventas (máx 8)
  const contVentas = document.getElementById("det-lista-ventas");
  if (!p.ventas || p.ventas.length === 0) {
    contVentas.innerHTML = `<div class="empty" style="padding:12px">Sin ventas</div>`;
  } else {
    const ordV = [...p.ventas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 8);
    contVentas.innerHTML = `<ul class="lista">` + ordV.map(v => `
      <li class="venta">
        <div class="item-header">
          <span class="item-nombre">${v.cantidad} uds × ${dinero(v.precioUnitario)}</span>
          <span class="item-fecha">${formatearFecha(v.fecha)}</span>
        </div>
        <div class="item-detalle">
          Ingreso: ${dinero(v.ingreso)} · Ganancia: ${dinero(v.ganancia)}
        </div>
      </li>
    `).join("") + `</ul>`;
  }

  irA("detalle");
  setTimeout(() => renderChartProducto(p), 50);
}

function ventaRapidaDesdeDetalle() {
  if (!productoDetalle) return;
  irA("venta");
  const sel = document.getElementById("venta-producto");
  actualizarSelectProductos();
  for (const opt of sel.options) {
    if (opt.value === productoDetalle) {
      sel.value = productoDetalle;
      onProductoVentaChange();
      break;
    }
  }
}

function cerrarDetalle() {
  productoDetalle = null;
  if (chartProducto) { chartProducto.destroy(); chartProducto = null; }
  irA("inventario");
}

function renderChartProducto(p) {
  const canvas = document.getElementById("chartProducto");
  const vacio = document.getElementById("detalle-chart-vacio");
  if (!canvas) return;

  if (!p.ventas || p.ventas.length === 0) {
    vacio.classList.remove("oculto");
    canvas.style.display = "none";
    if (chartProducto) { chartProducto.destroy(); chartProducto = null; }
    return;
  }
  vacio.classList.add("oculto");
  canvas.style.display = "block";

  const ord = [...p.ventas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const labels = [], data = [], acum = [];
  let sum = 0;
  ord.forEach(v => {
    const d = new Date(v.fecha);
    labels.push(d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }));
    data.push(Number(v.ganancia.toFixed(2)));
    sum += v.ganancia;
    acum.push(Number(sum.toFixed(2)));
  });

  if (chartProducto) chartProducto.destroy();
  chartProducto = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Ganancia",
          data,
          borderColor: "#00e676",
          backgroundColor: "rgba(0,230,118,0.1)",
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: "#00e676",
          tension: 0.3,
          fill: true
        },
        {
          label: "Acumulada",
          data: acum,
          borderColor: "#40c4ff",
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: "#40c4ff",
          tension: 0.3,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: "#ccc", font: { size: 11 } } },
        tooltip: { callbacks: { label: c => c.dataset.label + ": $" + c.raw.toFixed(2) } }
      },
      scales: {
        x: { ticks: { color: "#888", font: { size: 9 } }, grid: { color: "#2a2a2a" } },
        y: { ticks: { color: "#888", callback: v => "$" + v }, grid: { color: "#2a2a2a" } }
      }
    }
  });
}

function abrirModalPrecioDesdeDetalle() {
  if (productoDetalle) abrirModalPrecio(productoDetalle);
}
function eliminarProductoDetalle() {
  if (productoDetalle) {
    eliminarProducto(productoDetalle);
    cerrarDetalle();
  }
}

function renderHistorial() {
  const cont = document.getElementById("lista-historial");
  const s = sesionActiva();
  const items = [];
  s.lotes.forEach(l => {
    items.push({
      tipo: "compra", id: l.id, fecha: l.fecha, nombre: l.nombre,
      texto: `Compraste ${l.cantidadInicial} uds por ${dinero(l.costoTotal)} (unit: ${dinero(l.costoUnitario)}) · Quedan ${l.cantidadRestante}`
    });
  });
  s.ventas.forEach(v => {
    items.push({
      tipo: "venta", id: v.id, fecha: v.fecha, nombre: v.nombre,
      texto: `Vendiste ${v.cantidad} uds a ${dinero(v.precioUnitario)} → Ganancia: ${dinero(v.ganancia)}`
    });
  });
  items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  if (items.length === 0) {
    cont.innerHTML = `<div class="empty">Aún no hay movimientos.</div>`;
    return;
  }
  let html = `<ul class="lista">`;
  items.forEach(item => {
    html += `
      <li class="${item.tipo === 'venta' ? 'venta' : ''}">
        <div class="item-header">
          <span class="item-nombre">${item.nombre}</span>
          <span class="item-fecha">${formatearFecha(item.fecha)}</span>
        </div>
        <div class="item-detalle">${item.texto}</div>
        <button class="btn-eliminar" onclick="eliminarMovimiento('${item.id}', '${item.tipo}')">Eliminar</button>
      </li>`;
  });
  html += `</ul>`;
  cont.innerHTML = html;
}

function renderGrafico() {
  const canvas = document.getElementById("chartGanancias");
  const vacio = document.getElementById("grafico-vacio");
  const s = sesionActiva();
  if (!canvas) return;

  if (s.ventas.length === 0) {
    vacio.classList.remove("oculto");
    canvas.style.display = "none";
    document.getElementById("stats-grafico").style.display = "none";
    if (chartGanancias) { chartGanancias.destroy(); chartGanancias = null; }
    return;
  }
  vacio.classList.add("oculto");
  canvas.style.display = "block";
  document.getElementById("stats-grafico").style.display = "grid";

  const ord = [...s.ventas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const labels = [], ganancias = [], acumulado = [];
  let suma = 0;
  ord.forEach(v => {
    const d = new Date(v.fecha);
    labels.push(d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) + " " +
      d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
    ganancias.push(Number(v.ganancia.toFixed(2)));
    suma += v.ganancia;
    acumulado.push(Number(suma.toFixed(2)));
  });

  const nums = ord.map(v => v.ganancia);
  const promedio = nums.reduce((a, b) => a + b, 0) / nums.length;
  document.getElementById("stat-num-ventas").textContent = nums.length;
  document.getElementById("stat-promedio").textContent = dinero(promedio);
  document.getElementById("stat-mejor").textContent = dinero(Math.max(...nums));
  const peorEl = document.getElementById("stat-peor");
  peorEl.textContent = dinero(Math.min(...nums));
  peorEl.className = "stat-value" + (Math.min(...nums) < 0 ? " neg" : "");

  if (chartGanancias) chartGanancias.destroy();
  chartGanancias = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Ganancia por venta",
          data: ganancias,
          borderColor: "#00e676",
          backgroundColor: "rgba(0,230,118,0.12)",
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: "#00e676",
          tension: 0.35,
          fill: true
        },
        {
          label: "Ganancia acumulada",
          data: acumulado,
          borderColor: "#40c4ff",
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: "#40c4ff",
          tension: 0.35,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: "#ccc", font: { size: 11 } } },
        tooltip: { callbacks: { label: c => c.dataset.label + ": $" + c.raw.toFixed(2) } }
      },
      scales: {
        x: { ticks: { color: "#888", maxRotation: 45, minRotation: 30, font: { size: 9 } }, grid: { color: "#2a2a2a" } },
        y: { ticks: { color: "#888", callback: v => "$" + v }, grid: { color: "#2a2a2a" } }
      }
    }
  });
}

function actualizarSelectProductos() {
  const select = document.getElementById("venta-producto");
  const s = sesionActiva();
  const conStock = s.lotes.filter(l => l.cantidadRestante > 0);
  const nombres = [...new Set(conStock.map(l => l.nombre))];
  select.innerHTML = `<option value="">-- Selecciona producto --</option>`;
  nombres.forEach(n => {
    const total = conStock.filter(l => l.nombre === n).reduce((sum, l) => sum + l.cantidadRestante, 0);
    select.innerHTML += `<option value="${n}">${n} (${total} uds)</option>`;
  });
}
function actualizarSelectPrecios() {
  const select = document.getElementById("precio-producto");
  const s = sesionActiva();
  const nombres = [...new Set(s.lotes.map(l => l.nombre))];
  select.innerHTML = `<option value="">-- Selecciona --</option>`;
  nombres.forEach(n => {
    const p = s.precios[n];
    select.innerHTML += `<option value="${n}">${n}${p != null ? " (" + dinero(p) + ")" : ""}</option>`;
  });
}
function onProductoVentaChange() {
  const nombre = document.getElementById("venta-producto").value;
  const box = document.getElementById("precio-auto-info");
  const inputPrecio = document.getElementById("venta-precio");
  const s = sesionActiva();
  if (nombre && s.precios[nombre] != null) {
    inputPrecio.value = s.precios[nombre];
    box.textContent = "Precio predeterminado: " + dinero(s.precios[nombre]);
    box.classList.add("visible");
  } else {
    box.classList.remove("visible");
  }
}

// ---------- Acciones ----------
function agregarLote() {
  const nombre = document.getElementById("lote-nombre").value.trim();
  const costo = parseFloat(document.getElementById("lote-costo").value);
  const cantidad = parseInt(document.getElementById("lote-cantidad").value);
  if (!nombre) return mostrarMensaje("lote-msg", "Escribe el nombre del producto.", "error");
  if (isNaN(costo) || costo < 0) return mostrarMensaje("lote-msg", "Costo inválido.", "error");
  if (isNaN(cantidad) || cantidad <= 0) return mostrarMensaje("lote-msg", "Cantidad debe ser mayor a 0.", "error");
  const s = sesionActiva();
  s.lotes.push({
    id: uid(), nombre, cantidadInicial: cantidad, cantidadRestante: cantidad,
    costoTotal: costo, costoUnitario: costo / cantidad, fecha: new Date().toISOString()
  });
  guardar();
  document.getElementById("lote-nombre").value = "";
  document.getElementById("lote-costo").value = "";
  document.getElementById("lote-cantidad").value = "";
  mostrarMensaje("lote-msg", "Lote de " + nombre + " agregado.", "exito");
  actualizarTodo();
}

function registrarVenta() {
  const nombre = document.getElementById("venta-producto").value;
  const cantidad = parseInt(document.getElementById("venta-cantidad").value);
  const precio = parseFloat(document.getElementById("venta-precio").value);
  if (!nombre) return mostrarMensaje("venta-msg", "Selecciona un producto.", "error");
  if (isNaN(cantidad) || cantidad <= 0) return mostrarMensaje("venta-msg", "Cantidad inválida.", "error");
  if (isNaN(precio) || precio < 0) return mostrarMensaje("venta-msg", "Precio inválido.", "error");

  const s = sesionActiva();
  const lotesDisp = s.lotes.filter(l => l.nombre === nombre && l.cantidadRestante > 0)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  let pendiente = cantidad, costoTotalVenta = 0;
  const detalles = [];
  for (const lote of lotesDisp) {
    if (pendiente <= 0) break;
    const tomar = Math.min(pendiente, lote.cantidadRestante);
    costoTotalVenta += tomar * lote.costoUnitario;
    lote.cantidadRestante -= tomar;
    pendiente -= tomar;
    detalles.push({ loteId: lote.id, cantidad: tomar });
  }
  if (pendiente > 0) return mostrarMensaje("venta-msg", "No hay suficiente stock. Faltan " + pendiente + " uds.", "error");

  const ingreso = precio * cantidad;
  const ganancia = ingreso - costoTotalVenta;
  s.ventas.push({
    id: uid(), nombre, cantidad, precioUnitario: precio, ingreso,
    costo: costoTotalVenta, ganancia, fecha: new Date().toISOString(), detalles
  });
  guardar();
  document.getElementById("venta-cantidad").value = "";
  document.getElementById("venta-precio").value = "";
  document.getElementById("precio-auto-info").classList.remove("visible");
  mostrarMensaje("venta-msg", "Venta registrada. Ganancia: " + dinero(ganancia), "exito");
  actualizarTodo();
}

function guardarPrecioDefault() {
  const nombre = document.getElementById("precio-producto").value;
  const valor = parseFloat(document.getElementById("precio-valor").value);
  if (!nombre) return mostrarMensaje("precio-msg", "Selecciona un producto.", "error");
  if (isNaN(valor) || valor < 0) return mostrarMensaje("precio-msg", "Precio inválido.", "error");
  sesionActiva().precios[nombre] = valor;
  guardar();
  document.getElementById("precio-valor").value = "";
  mostrarMensaje("precio-msg", "Precio de " + nombre + " guardado: " + dinero(valor), "exito");
  actualizarSelectPrecios();
  renderInventario();
}

function abrirModalPrecio(nombre) {
  modalPrecioProducto = nombre;
  const s = sesionActiva();
  document.getElementById("modal-precio-producto").textContent = nombre;
  document.getElementById("modal-precio-valor").value = s.precios[nombre] != null ? s.precios[nombre] : "";
  document.getElementById("modal-precio").classList.remove("oculto");
}
function cerrarModalPrecio() {
  document.getElementById("modal-precio").classList.add("oculto");
  modalPrecioProducto = null;
}
function confirmarPrecioModal() {
  if (!modalPrecioProducto) return;
  const valor = parseFloat(document.getElementById("modal-precio-valor").value);
  if (isNaN(valor) || valor < 0) return alert("Precio inválido.");
  sesionActiva().precios[modalPrecioProducto] = valor;
  guardar();
  cerrarModalPrecio();
  renderInventario();
  actualizarSelectPrecios();
  if (productoDetalle === modalPrecioProducto || productoDetalle) {
    // refresh detail if open
    if (productoDetalle) abrirDetalle(productoDetalle);
  }
}

function eliminarProducto(nombre) {
  const s = sesionActiva();
  const nLotes = s.lotes.filter(l => l.nombre === nombre).length;
  const tieneVentas = s.ventas.some(v => v.nombre === nombre);
  if (!confirm("¿Eliminar \"" + nombre + "\"?\nSe borrarán " + nLotes + " lote(s)" + (tieneVentas ? " y sus ventas" : "") + ".")) return;
  s.lotes = s.lotes.filter(l => l.nombre !== nombre);
  s.ventas = s.ventas.filter(v => v.nombre !== nombre);
  delete s.precios[nombre];
  guardar();
  actualizarTodo();
}

function eliminarMovimiento(id, tipo) {
  const s = sesionActiva();
  if (tipo === "venta") {
    const venta = s.ventas.find(v => v.id === id);
    if (!venta) return alert("No se encontró la venta.");
    if (!confirm("¿Eliminar venta de \"" + venta.nombre + "\"?\nSe devolverán " + venta.cantidad + " uds al stock.")) return;
    if (venta.detalles && venta.detalles.length > 0) {
      venta.detalles.forEach(d => {
        const lote = s.lotes.find(l => l.id === d.loteId);
        if (lote) lote.cantidadRestante += d.cantidad;
      });
    } else {
      let pendiente = venta.cantidad;
      const lotesP = s.lotes.filter(l => l.nombre === venta.nombre).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      for (const lote of lotesP) {
        if (pendiente <= 0) break;
        const espacio = lote.cantidadInicial - lote.cantidadRestante;
        const dev = Math.min(pendiente, espacio);
        lote.cantidadRestante += dev;
        pendiente -= dev;
      }
    }
    s.ventas = s.ventas.filter(v => v.id !== id);
    guardar();
    actualizarTodo();
    alert("Venta eliminada.");
  } else if (tipo === "compra") {
    const lote = s.lotes.find(l => l.id === id);
    if (!lote) return alert("No se encontró el lote.");
    if (lote.cantidadRestante !== lote.cantidadInicial) {
      return alert("No se puede eliminar: ya se vendieron unidades de este lote.\nQuedan " + lote.cantidadRestante + " de " + lote.cantidadInicial + ".");
    }
    if (!confirm("¿Eliminar este lote de \"" + lote.nombre + "\"?")) return;
    s.lotes = s.lotes.filter(l => l.id !== id);
    guardar();
    actualizarTodo();
    alert("Lote eliminado.");
  }
}

function borrarTodo() {
  if (!confirm("¿Borrar TODOS los datos de esta sesión?")) return;
  const s = sesionActiva();
  s.lotes = []; s.ventas = []; s.precios = {};
  guardar();
  actualizarTodo();
  alert("Datos borrados.");
}

// ---------- CSV (sesión actual) ----------
function exportarCSV() {
  const s = sesionActiva();
  if (s.lotes.length === 0 && s.ventas.length === 0) return alert("No hay datos.");
  const filas = [];
  filas.push(["TIPO","FECHA","PRODUCTO","CANTIDAD","COSTO_UNITARIO","COSTO_TOTAL","PRECIO_VENTA_UNIT","INGRESO","GANANCIA","STOCK_RESTANTE","ID"]);
  s.lotes.forEach(l => {
    filas.push(["COMPRA", l.fecha, l.nombre, l.cantidadInicial, l.costoUnitario.toFixed(4), l.costoTotal.toFixed(2), "", "", "", l.cantidadRestante, l.id]);
  });
  s.ventas.forEach(v => {
    filas.push(["VENTA", v.fecha, v.nombre, v.cantidad, (v.costo/v.cantidad).toFixed(4), v.costo.toFixed(2), v.precioUnitario.toFixed(2), v.ingreso.toFixed(2), v.ganancia.toFixed(2), "", v.id]);
  });
  filas.push([]); filas.push(["=== RESUMEN ==="]);
  const r = calcularResumen();
  filas.push(["Total Invertido", r.invertido.toFixed(2)]);
  filas.push(["Total Vendido", r.vendido.toFixed(2)]);
  filas.push(["Ganancia Neta", r.ganancia.toFixed(2)]);
  filas.push(["Stock Actual", r.stockActual]);
  filas.push(["Sesion", s.nombre]);
  filas.push(["Exportado", new Date().toISOString()]);

  const csv = filas.map(f => f.map(c => {
    const str = String(c ?? "");
    return (str.includes(",") || str.includes('"') || str.includes("\n")) ? '"' + str.replace(/"/g, '""') + '"' : str;
  }).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ganancias_" + s.nombre.replace(/\s+/g, "_") + "_" + new Date().toISOString().slice(0,10) + ".csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

function parseCSVLine(line) {
  const result = []; let current = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) { result.push(current); current = ""; }
    else current += char;
  }
  result.push(current);
  return result;
}

function importarCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!confirm("¿Importar este CSV?\nSe REEMPLAZARÁN los datos de la sesión actual.")) {
    event.target.value = ""; return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      let text = e.target.result;
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const lineas = text.split(/\r?\n/).filter(l => l.trim());
      if (lineas.length < 2) throw new Error("Vacío");
      const nuevosLotes = [], nuevasVentas = [];
      for (let i = 1; i < lineas.length; i++) {
        const linea = lineas[i].trim();
        if (!linea || linea.startsWith("===") || linea.startsWith("Total") || linea.startsWith("Exportado") || linea.startsWith("Sesion") || linea.startsWith("Ganancia") || linea.startsWith("Stock") || linea.startsWith("Calculadora")) continue;
        const cols = parseCSVLine(linea);
        if (cols.length < 3) continue;
        const tipo = (cols[0] || "").toUpperCase().trim();
        if (tipo === "COMPRA") {
          const cantidad = parseInt(cols[3]) || 0;
          nuevosLotes.push({
            id: cols[10] || uid(), nombre: cols[2] || "Sin nombre",
            cantidadInicial: cantidad, cantidadRestante: parseInt(cols[9]) || cantidad,
            costoTotal: parseFloat(cols[5]) || 0, costoUnitario: parseFloat(cols[4]) || 0,
            fecha: cols[1] || new Date().toISOString()
          });
        } else if (tipo === "VENTA") {
          const cantidad = parseInt(cols[3]) || 0;
          const costoTotal = parseFloat(cols[5]) || 0;
          const precioUnitario = parseFloat(cols[6]) || 0;
          const ingreso = parseFloat(cols[7]) || precioUnitario * cantidad;
          nuevasVentas.push({
            id: cols[10] || uid(), nombre: cols[2] || "Sin nombre", cantidad, precioUnitario,
            ingreso, costo: costoTotal, ganancia: parseFloat(cols[8]) || (ingreso - costoTotal),
            fecha: cols[1] || new Date().toISOString(), detalles: []
          });
        }
      }
      const s = sesionActiva();
      s.lotes = nuevosLotes; s.ventas = nuevasVentas;
      guardar(); actualizarTodo();
      alert("Importado.\nLotes: " + nuevosLotes.length + "\nVentas: " + nuevasVentas.length);
    } catch (err) {
      console.error(err);
      alert("Error al importar. Usa un CSV de esta app.");
    }
    event.target.value = "";
  };
  reader.readAsText(file, "UTF-8");
}

// ---------- Exportar / Importar TODO (JSON) ----------
function exportarTodo() {
  const data = {
    version: 2,
    exportado: new Date().toISOString(),
    app: "Calculadora de Ganancias",
    autor: "Oscar Antonio Alvarez Collado",
    store: store
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ganancias_backup_completo_" + new Date().toISOString().slice(0,10) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importarTodo(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!confirm("¿Importar TODO el respaldo?\nSe REEMPLAZARÁN todas las sesiones y datos actuales.")) {
    event.target.value = ""; return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.store || !data.store.sesiones || !Array.isArray(data.store.sesiones)) {
        throw new Error("Formato inválido");
      }
      store = data.store;
      if (!store.sesionActivaId || !store.sesiones.find(s => s.id === store.sesionActivaId)) {
        store.sesionActivaId = store.sesiones[0].id;
      }
      store.sesiones.forEach(s => { if (!s.precios) s.precios = {}; });
      guardar();
      actualizarTodo();
      alert("Respaldo completo restaurado.\nSesiones: " + store.sesiones.length);
    } catch (err) {
      console.error(err);
      alert("Error al importar. Usa un archivo JSON exportado desde esta app.");
    }
    event.target.value = "";
  };
  reader.readAsText(file, "UTF-8");
}

// ---------- UI ----------
function mostrarMensaje(id, texto, tipo) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto;
  el.className = "mensaje " + tipo;
  el.classList.remove("oculto");
  setTimeout(() => el.classList.add("oculto"), 4000);
}

function actualizarTodo() {
  renderSesionesSelect();
  renderResumen();
  renderInventario();
  renderHistorial();
  actualizarSelectProductos();
  actualizarSelectPrecios();
  renderGrafico();
}

document.addEventListener("DOMContentLoaded", () => {
  cargar();
  actualizarTodo();
});
