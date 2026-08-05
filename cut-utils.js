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

function getReminderStatus(reminder, now = new Date()) {
  if (!reminder?.fecha) {
    return { label: "Sin fecha", tone: "muted", diffDays: null };
  }

  const fecha = new Date(`${reminder.fecha}T00:00:00`);
  const diffDays = Math.ceil((fecha - now) / 86400000);

  if (diffDays < 0) {
    return { label: "Vencido", tone: "danger", diffDays };
  }

  if (diffDays === 0) {
    return { label: "Hoy", tone: "danger", diffDays };
  }

  if (diffDays <= Number(reminder.diasAlerta || 3)) {
    return { label: `En ${diffDays} día(s)`, tone: "warning", diffDays };
  }

  return { label: `En ${diffDays} día(s)`, tone: "muted", diffDays };
}

function buildPeriodSummary(movs, vista) {
  const groups = {};

  movs.forEach((mov) => {
    if (!mov?.fecha) return;

    const date = new Date(`${mov.fecha}T00:00:00`);
    let key = "";
    let label = mov.fecha;

    if (vista === "semana") {
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(date);
      start.setDate(diff);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      key = `${start.toISOString().slice(0, 10)}|${end.toISOString().slice(0, 10)}`;
      label = `${start.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} - ${end.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}`;
    } else if (vista === "mes") {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      label = date.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    } else {
      key = mov.fecha;
      label = mov.fecha;
    }

    if (!groups[key]) {
      groups[key] = { label, ingresos: 0, gastos: 0, total: 0 };
    }

    const amount = Number(mov.monto || 0);
    if (mov.tipo === "ingreso") {
      groups[key].ingresos += amount;
    } else {
      groups[key].gastos += amount;
    }
    groups[key].total += amount;
  });

  return Object.entries(groups)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

if (typeof window !== "undefined") {
  window.getQuincenaPeriod = getQuincenaPeriod;
  window.getPeriodKey = getPeriodKey;
  window.getReminderStatus = getReminderStatus;
  window.buildPeriodSummary = buildPeriodSummary;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getQuincenaPeriod,
    getPeriodKey,
    getReminderStatus,
    buildPeriodSummary,
  };
}
