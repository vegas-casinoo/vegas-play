// wheel.js

let overlay, backBtn, wheelEl, spinBtn, timerEl;
let resultOverlay, resultValueEl, resultBtn, confettiEl;

let spinning = false;
let tick = null;

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

// пока так: позже подключим supabase (следующим шагом заменим эти 2 функции)
function getLastSpinMs() {
  const v = localStorage.getItem("wf_last_spin_ms");
  return v ? Number(v) : null;
}
function setLastSpinMs(ms) {
  localStorage.setItem("wf_last_spin_ms", String(ms));
}

function $(id){ return document.getElementById(id); }

function bindDom(){
  overlay = $("wfOverlay");
  backBtn = $("wfBack");
  wheelEl = $("wfWheel");
  spinBtn = $("wfSpin");
  timerEl = $("wfTimer");

  resultOverlay = $("wfResult");
  resultValueEl = $("wfResultValue");
  resultBtn = $("wfResultBtn");
  confettiEl = $("wfConfetti");

  backBtn?.addEventListener("click", closeWheel);
  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) closeWheel();
  });

  spinBtn?.addEventListener("click", spin);

  resultBtn?.addEventListener("click", hideResult);
  resultOverlay?.addEventListener("click", (e) => {
    if (e.target === resultOverlay) hideResult();
  });
}

function ensureInjected(cb){
  // если wheel.html уже вставлен в DOM — просто биндим
  if ($("wfOverlay")) { bindDom(); cb(); return; }

  fetch("/wheel/wheel.html")
    .then(r => r.text())
    .then(html => {
      document.body.insertAdjacentHTML("beforeend", html);
      bindDom();
      cb();
    })
    .catch(() => alert("Не смог загрузить /wheel/wheel.html"));
}

function openWheel(){
  ensureInjected(() => {
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    refreshUI();
  });
}

function closeWheel(){
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
}

function fmt(ms){
  const total = Math.max(0, Math.floor(ms/1000));
  const h = String(Math.floor(total/3600)).padStart(2,"0");
  const m = String(Math.floor((total%3600)/60)).padStart(2,"0");
  const s = String(total%60).padStart(2,"0");
  return `${h}:${m}:${s}`;
}

function canSpin(){
  const last = getLastSpinMs();
  if (!last) return { can:true, leftMs:0 };
  const next = last + COOLDOWN_MS;
  const left = next - Date.now();
  return { can: left <= 0, leftMs: Math.max(0,left) };
}

function setEnabled(can, leftMs){
  if (spinBtn){
    spinBtn.disabled = !can;
  }
  if (timerEl){
    timerEl.style.display = can ? "none" : "";
    timerEl.textContent = can ? "" : `Доступно через ${fmt(leftMs)}`;
  }
}

function refreshUI(){
  const st = canSpin();
  setEnabled(st.can, st.leftMs);

  if (tick) clearInterval(tick);
  if (!st.can){
    tick = setInterval(() => {
      const p = canSpin();
      setEnabled(p.can, p.leftMs);
      if (p.can){
        clearInterval(tick);
        tick = null;
      }
    }, 1000);
  }
}

/* ===== visuals ===== */
function confettiBurst(){
  if (!confettiEl) return;
  confettiEl.innerHTML = "";

  const colors = ["#67ffa9","#5ad7ff","#b36cff","#ff6ed2","#ffffff"];
  const count = 70;

  for (let i=0;i<count;i++){
    const d = document.createElement("div");
    d.className = "wc";
    d.style.left = (Math.random()*100) + "%";
    d.style.background = colors[(Math.random()*colors.length)|0];
    d.style.animationDelay = (Math.random()*0.10).toFixed(2) + "s";
    confettiEl.appendChild(d);
  }

  setTimeout(()=>{ if(confettiEl) confettiEl.innerHTML=""; }, 1000);
}

function hapticSuccess(){
  try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success"); } catch(_){}
  try { navigator.vibrate?.([18, 40, 18]); } catch(_){}
}

function showResult(text){
  if (!resultOverlay) return;
  resultValueEl && (resultValueEl.textContent = text);
  resultOverlay.classList.add("open");
  resultOverlay.setAttribute("aria-hidden","false");
  confettiBurst();
  hapticSuccess();
}

function hideResult(){
  if (!resultOverlay) return;
  resultOverlay.classList.remove("open");
  resultOverlay.setAttribute("aria-hidden","true");
}

/* ===== spin (пока random result) ===== */
function spin(){
  if (spinning || !wheelEl) return;

  const st = canSpin();
  if (!st.can){
    setEnabled(false, st.leftMs);
    return;
  }

  spinning = true;
  spinBtn && (spinBtn.disabled = true);

  // крутилка: 6 оборотов + случайный оффсет
  const spins = 6;
  const rand = Math.floor(Math.random() * 360);
  const final = spins*360 + rand;

  // reset
  wheelEl.style.transition = "none";
  wheelEl.style.transform = "translateZ(0) rotate(0deg)";
  void wheelEl.offsetWidth;

  wheelEl.style.transition = "transform 3.9s cubic-bezier(.12,.85,.18,1)";
  wheelEl.style.transform = `translateZ(0) rotate(${final}deg)`;

  try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium"); } catch(_){}
  try { navigator.vibrate?.(18); } catch(_){}

  setTimeout(() => {
    setLastSpinMs(Date.now());
    spinning = false;
    refreshUI();

    // пока заглушка приза
    showResult("+500 ₽");
  }, 4100);
}

/* expose */
window.openWheel = openWheel;