let wheelOverlay, wheelEl, wheelLabelsEl;
let spinMainBtn, centerBtn, closeBtn;
let spinning = false;

// временные призы (пока не пришлёшь свои)
const PRIZES = [
  { label: "+10₽" },
  { label: "+20₽" },
  { label: "+50₽" },
  { label: "+100₽" },
  { label: "+200₽" },
  { label: "+500₽" },
];

// базовые цвета по кругу (чтобы не выглядело “дёшево”)
const SEG_COLORS = ["#ffd166","#06d6a0","#118ab2","#ef476f","#8338ec","#ffa6d6"];

function buildWheelGradient() {
  const n = PRIZES.length;
  const step = 360 / n;

  const parts = [];
  for (let i = 0; i < n; i++) {
    const a0 = i * step;
    const a1 = (i + 1) * step;
    const c = SEG_COLORS[i % SEG_COLORS.length];
    parts.push(`${c} ${a0}deg ${a1}deg`);
  }
  wheelEl.style.background = `conic-gradient(${parts.join(",")})`;
}

function renderLabels() {
  const n = PRIZES.length;
  const step = 360 / n;

  wheelLabelsEl.innerHTML = "";

  for (let i = 0; i < n; i++) {
    const angle = i * step + step / 2; // центр сектора

    const item = document.createElement("div");
    item.className = "wheelLabel";
    // ставим текст радиально: сначала поворачиваем, потом смещаем вправо
    item.style.transform = `rotate(${angle}deg) translateX(8px)`;

    const text = document.createElement("div");
    text.className = "wheelLabelText";
    text.textContent = PRIZES[i].label;

    // чтобы текст не был “вверх ногами” на левой стороне:
    // если угол в диапазоне 90..270 — разворачиваем на 180
    if (angle > 90 && angle < 270) {
      text.style.transform = "rotate(180deg)";
    }

    item.appendChild(text);
    wheelLabelsEl.appendChild(item);
  }
}

function ensureInjected(cb) {
  wheelOverlay = document.getElementById("wheelOverlay");
  if (wheelOverlay) return cb();

  fetch("/wheel/wheel.html")
    .then(r => r.text())
    .then(html => {
      document.body.insertAdjacentHTML("beforeend", html);
      bindWheelDom();
      cb();
    })
    .catch(() => {
      alert("Не смог загрузить wheel.html (проверь путь /wheel/wheel.html)");
    });
}

function bindWheelDom() {
  wheelOverlay = document.getElementById("wheelOverlay");
  wheelEl = document.getElementById("wheel");
  wheelLabelsEl = document.getElementById("wheelLabels");

  spinMainBtn = document.getElementById("wheelSpinMain");
  centerBtn = document.getElementById("wheelCenterBtn");
  closeBtn = document.getElementById("wheelClose");

  if (!wheelOverlay || !wheelEl || !wheelLabelsEl) {
    console.error("wheel DOM not found");
    return;
  }

  buildWheelGradient();
  renderLabels();

  closeBtn?.addEventListener("click", closeWheel);

  // закрытие по клику мимо
  wheelOverlay.addEventListener("click", (e) => {
    if (e.target === wheelOverlay) closeWheel();
  });

  spinMainBtn?.addEventListener("click", spinWheel);
  centerBtn?.addEventListener("click", spinWheel);
}

function openWheel() {
  ensureInjected(() => {
    wheelOverlay.classList.add("open");
    wheelOverlay.setAttribute("aria-hidden", "false");
  });
}

function closeWheel() {
  if (!wheelOverlay) return;
  wheelOverlay.classList.remove("open");
  wheelOverlay.setAttribute("aria-hidden", "true");
}

function pickIndex() {
  // пока просто random; потом ты дашь шансы — сделаем weighted
  return Math.floor(Math.random() * PRIZES.length);
}

function spinWheel() {
  if (spinning || !wheelEl) return;

  spinning = true;
  spinMainBtn && (spinMainBtn.disabled = true);

  const n = PRIZES.length;
  const step = 360 / n;

  const index = pickIndex();

  // ВАЖНО:
  // стрелка сверху (0deg). Нам нужно, чтобы выигрышный сектор пришёл под стрелку.
  // центр сектора = index*step + step/2
  // значит вращаем так, чтобы этот угол оказался на 0deg => вращение = 360 - centerAngle
  const centerAngle = index * step + step / 2;
  const target = 360 - centerAngle;

  const spins = 6; // сколько полных оборотов
  const finalDeg = spins * 360 + target;

  // сброс transition для чистого повторного спина
  wheelEl.style.transition = "none";
  wheelEl.style.transform = "rotate(0deg)";
  // reflow
  void wheelEl.offsetWidth;

  wheelEl.style.transition = "transform 3.8s cubic-bezier(.12,.85,.18,1)";
  wheelEl.style.transform = `rotate(${finalDeg}deg)`;

  // лёгкая вибрация
  try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium"); } catch (_) {}
  try { navigator.vibrate?.(18); } catch (_) {}

  setTimeout(() => {
    spinning = false;
    spinMainBtn && (spinMainBtn.disabled = false);

    const prize = PRIZES[index]?.label || "Приз";
    // пока просто алерт — дальше подключим твою “плашку выигрыша” + конфетти
    alert(`Вы выиграли: ${prize}`);
  }, 3900);
}

// делаем глобально доступным (app.js вызывает window.openWheel?.())
window.openWheel = openWheel;

// также повесим на карточку, если она есть
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest("#wheelCard") || t.closest("#wheelOpenBtn") || t.closest("#wheelSpinBtn")) {
    // если нажали на маленькую кнопку — не даём кликнуть “насквозь”
    if (t.closest("#wheelSpinBtn")) e.stopPropagation();
    openWheel();
  }
}, { passive: false });