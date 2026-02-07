let wheelOverlay, wheelEl;
let spinMainBtn, closeBtn;
let wheelTimerEl, wheelTopSubEl;
let winToastEl, winAmountEl, winCloseEl;

let spinning = false;
let tickTimer = null;

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

// временные призы (потом привяжем к твоей логике/супабейзу)
const PRIZES = [
  { amount: 10, label: "+10 ₽" },
  { amount: 20, label: "+20 ₽" },
  { amount: 50, label: "+50 ₽" },
  { amount: 100, label: "+100 ₽" },
  { amount: 200, label: "+200 ₽" },
  { amount: 500, label: "+500 ₽" },
];

function userKey() {
  // чтобы у каждого юзера был свой кулдаун
  const uid =
    window.VEGAS?.getUserId?.() ||
    window.Telegram?.WebApp?.initDataUnsafe?.user?.id ||
    "guest";
  return `vegas_wheel_last_spin_${uid}`;
}

function nowMs() { return Date.now(); }

function fmt(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function getLastSpin() {
  const raw = localStorage.getItem(userKey());
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function setLastSpin(ts) {
  localStorage.setItem(userKey(), String(ts));
}

function setSpinDisabled(disabled, timerText = "") {
  spinMainBtn.classList.toggle("disabled", disabled);
  spinMainBtn.disabled = disabled;

  if (disabled) {
    wheelTimer.style.display = "block";
    wheelTimer.textContent = timerText;
  } else {
    wheelTimer.style.display = "none";
  }
}

function canSpin() {
  const last = getLastSpin();
  if (!last) return true;
  return (nowMs() - last) >= COOLDOWN_MS;
}

function msLeft() {
  const last = getLastSpin();
  if (!last) return 0;
  const left = (last + COOLDOWN_MS) - nowMs();
  return Math.max(0, left);
}

function setSpinUi() {
  const ok = canSpin();

  if (!spinMainBtn || !wheelTimerEl || !wheelTopSubEl) return;

  if (ok) {
    spinMainBtn.disabled = false;
    spinMainBtn.classList.remove("is-disabled");
    wheelTimerEl.style.display = "none";
    wheelTimerEl.textContent = "";
    wheelTopSubEl.textContent = "1 прокрутка в день";
  } else {
    spinMainBtn.disabled = true;
    spinMainBtn.classList.add("is-disabled");

    const left = msLeft();
    wheelTimerEl.style.display = "";
    wheelTimerEl.textContent = `Доступно через ${fmt(left)}`;
    wheelTopSubEl.textContent = "Прокрутка уже использована";
  }
}

function startTick() {
  stopTick();
  tickTimer = setInterval(() => setSpinUi(), 1000);
}

function stopTick() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
}

function showWin(amountText) {
  if (!winToastEl || !winAmountEl) return;
  winAmountEl.textContent = amountText;
  winToastEl.classList.add("show");
  winToastEl.setAttribute("aria-hidden", "false");

  // авто-скрытие
  setTimeout(() => {
    winToastEl?.classList.remove("show");
    winToastEl?.setAttribute("aria-hidden", "true");
  }, 2600);
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
    .catch(() => alert("Не смог загрузить /wheel/wheel.html"));
}

function bindWheelDom() {
  wheelOverlay = document.getElementById("wheelOverlay");
  wheelEl = document.getElementById("wheel");
  spinMainBtn = document.getElementById("wheelSpinMain");
  closeBtn = document.getElementById("wheelClose");
  wheelTimerEl = document.getElementById("wheelTimer");
  wheelTopSubEl = document.getElementById("wheelTopSub");

  winToastEl = document.getElementById("wheelWinToast");
  winAmountEl = document.getElementById("wheelWinAmount");
  winCloseEl = document.getElementById("wheelWinClose");

  closeBtn?.addEventListener("click", closeWheel);

  wheelOverlay?.addEventListener("click", (e) => {
    if (e.target === wheelOverlay) closeWheel();
  });

  spinMainBtn?.addEventListener("click", spinWheel);

  winCloseEl?.addEventListener("click", () => {
    winToastEl?.classList.remove("show");
    winToastEl?.setAttribute("aria-hidden", "true");
  });

  setSpinUi();
}

function openWheel() {
  ensureInjected(() => {
    wheelOverlay.classList.add("open");
    wheelOverlay.setAttribute("aria-hidden", "false");
    setSpinUi();
    startTick();
  });
}

function buildWheelGradient() {
  wheelEl.style.background = `
    conic-gradient(
      from 0deg,
      #6a5cff,
      #3fa9f5,
      #7b5cff,
      #ff5ad6,
      #6a5cff
    )
  `;
}

function closeWheel() {
  if (!wheelOverlay) return;
  wheelOverlay.classList.remove("open");
  wheelOverlay.setAttribute("aria-hidden", "true");
  stopTick();

  // убираем плашку если была
  winToastEl?.classList.remove("show");
  winToastEl?.setAttribute("aria-hidden", "true");
}

function pickIndex() {
  const total = PRIZES.reduce((s,p)=>s+p.weight,0);
  let r = Math.random() * total;

  for (let i = 0; i < PRIZES.length; i++) {
    r -= PRIZES[i].weight;
    if (r <= 0) return i;
  }
  return 0;
}

function spinWheel() {
  if (spinning || !wheelEl) return;
  if (!canSpin()) return;

  spinning = true;
  spinMainBtn.disabled = true;

  const n = PRIZES.length;
  const step = 360 / n;
  const index = pickIndex();

  // центр сектора
  const centerAngle = index * step + step / 2;
  // стрелка сверху, колесо крутится по часовой => чтобы центр сектора оказался под стрелкой
  const target = 360 - centerAngle;

  const spins = 7;
  const finalDeg = spins * 360 + target;

  // важный сброс, чтобы анимация повторялась одинаково и без артефактов
  wheelEl.style.transition = "none";
  wheelEl.style.transform = "translateZ(0) rotate(0deg)";
  void wheelEl.offsetWidth;

  wheelEl.style.transition = "transform 3.8s cubic-bezier(.12,.85,.18,1)";
  wheelEl.style.transform = `translateZ(0) rotate(${finalDeg}deg)`;

  try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium"); } catch (_) {}
  try { navigator.vibrate?.(18); } catch (_) {}

  setTimeout(() => {
    // фиксируем “прокрутил” сразу после результата
    setLastSpin(nowMs());

    const prize = PRIZES[index];
    showWin(prize?.label || "Приз");

    spinning = false;
    setSpinUi();      // сделает кнопку серой + таймер
  }, 3900);
}

// глобально
window.openWheel = openWheel;

// на карточку HOME (чтобы работало даже без app.js-делегации)
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest("#wheelOpenBtn") || t.closest("#wheelSpinBtn")) {
    if (t.closest("#wheelSpinBtn")) e.stopPropagation();
    openWheel();
  }
}, { passive: false });