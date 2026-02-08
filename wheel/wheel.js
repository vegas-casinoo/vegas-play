let overlay, wheelEl, backBtn, spinBtn, timerEl;
let resultEl, resultValueEl, resultBtn, confettiEl;

let spinning = false;
let tick = null;

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

// твои призы + веса
const PRIZES = [
  { label: "+30% к пополнению", kind: "dep_boost", value: 30, weight: 10 },
  { label: "+20% к пополнению", kind: "dep_boost", value: 20, weight: 10 },
  { label: "+10% к пополнению", kind: "dep_boost", value: 10, weight: 35 },
  { label: "+5% к пополнению",  kind: "dep_boost", value: 5,  weight: 40 },
  { label: "1000 ₽",           kind: "money",    value: 1000, weight: 2 },
  { label: "500 ₽",            kind: "money",    value: 500,  weight: 3 },
];

const $ = (id) => document.getElementById(id);
const supa = () => window.VEGAS?.supabase || null;
const uid = () => window.VEGAS?.getUserId?.() || null;

function nowMs(){ return Date.now(); }

function fmt(ms){
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function canSpin(lastSpinMs){
  if (!lastSpinMs) return { can: true, leftMs: 0 };
  const next = lastSpinMs + COOLDOWN_MS;
  const left = next - nowMs();
  return { can: left <= 0, leftMs: Math.max(0, left) };
}

async function getState(){
  const sb = supa();
  const user = uid();
  if (!sb || !user) return { lastSpinMs: null };

  const { data } = await sb
    .from("wheel_state")
    .select("last_spin_ts")
    .eq("user_id", user)
    .maybeSingle();

  return { lastSpinMs: data?.last_spin_ts ? Date.parse(data.last_spin_ts) : null };
}

async function setState(iso){
  const sb = supa();
  const user = uid();
  if (!sb || !user) return;
  await sb.from("wheel_state").upsert({ user_id: user, last_spin_ts: iso });
}

function setCardUI(can, leftMs){
  const btn = $("wheelSpinBtn");
  const hint = $("wheelHint");
  if (!btn) return;

  btn.disabled = !can;
  btn.classList.toggle("isReady", can);
  btn.classList.toggle("isLocked", !can);

  if (can){
    btn.textContent = "Крутить";
    if (hint) hint.textContent = " ";
  } else {
    btn.textContent = fmt(leftMs);
    if (hint) hint.textContent = "Доступно через";
  }
}

function setModalUI(can, leftMs){
  if (spinBtn) spinBtn.disabled = !can;

  if (timerEl){
    timerEl.style.display = can ? "none" : "";
    timerEl.textContent = can ? "" : `Доступно через ${fmt(leftMs)}`;
  }
}

async function refreshUI(){
  const st = await getState();
  const p = canSpin(st.lastSpinMs);

  setCardUI(p.can, p.leftMs);
  setModalUI(p.can, p.leftMs);

  if (tick) clearInterval(tick);
  if (!p.can){
    tick = setInterval(async () => {
      const st2 = await getState();
      const p2 = canSpin(st2.lastSpinMs);
      setCardUI(p2.can, p2.leftMs);
      setModalUI(p2.can, p2.leftMs);
      if (p2.can && tick){ clearInterval(tick); tick = null; }
    }, 1000);
  }
}

function pickWeighted(){
  const total = PRIZES.reduce((s,p)=>s + (p.weight||0), 0);
  let r = Math.random() * total;
  for (let i=0;i<PRIZES.length;i++){
    r -= (PRIZES[i].weight||0);
    if (r <= 0) return i;
  }
  return PRIZES.length - 1;
}

function spinToIndex(index){
  const n = PRIZES.length;
  const step = 360 / n;

  // pointer сверху: нам надо центр сектора под стрелку
  const center = index * step + step/2;
  const target = 360 - center;

  const spins = 7;
  const deg = spins*360 + target;

  wheelEl.style.transition = "none";
  wheelEl.style.transform = "translateZ(0) rotate(0deg)";
  void wheelEl.offsetWidth;

  wheelEl.style.transition = "transform 3.9s cubic-bezier(.12,.85,.18,1)";
  wheelEl.style.transform = `translateZ(0) rotate(${deg}deg)`;
}

function hapticSuccess(){
  try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success"); } catch(_){}
  try { navigator.vibrate?.([18, 40, 18]); } catch(_){}
}

function confettiBurst(){
  if (!confettiEl) return;
  confettiEl.innerHTML = "";

  const colors = ["#67ffa9","#5ad7ff","#b36cff","#ff6ed2","#ffffff"];
  const count = 70;

  for (let i=0;i<count;i++){
    const d = document.createElement("div");
    d.className = "c";
    d.style.left = (Math.random()*100) + "%";
    d.style.background = colors[(Math.random()*colors.length)|0];
    d.style.animationDelay = (Math.random()*0.12).toFixed(2) + "s";
    confettiEl.appendChild(d);
  }

  setTimeout(()=>{ if(confettiEl) confettiEl.innerHTML=""; }, 1200);
}

function showResult(text){
  if (!resultEl) return;
  if (resultValueEl) resultValueEl.textContent = text;
  resultEl.classList.add("open");
  resultEl.setAttribute("aria-hidden","false");
  confettiBurst();
  hapticSuccess();
}

function hideResult(){
  if (!resultEl) return;
  resultEl.classList.remove("open");
  resultEl.setAttribute("aria-hidden","true");
}

function bind(){
  overlay = $("wfOverlay");
  wheelEl = $("wfWheel");
  backBtn = $("wfBack");
  spinBtn = $("wfSpinBtn");
  timerEl = $("wfTimer");

  resultEl = $("wfResult");
  resultValueEl = $("wfResultValue");
  resultBtn = $("wfResultBtn");
  confettiEl = $("wfConfetti");

  backBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  resultBtn?.addEventListener("click", hideResult);
  resultEl?.addEventListener("click", (e) => { if (e.target === resultEl) hideResult(); });

  spinBtn?.addEventListener("click", spin);

  // открытие из бонусов
document.addEventListener("click", (e) => {
  const t = e.target;

  // клик по кнопке справа
  if (t.closest("#wheelSpinBtn")) {
    e.stopPropagation();
    open();
    return;
  }

  // клик по всей карточке
  if (t.closest("#wheelBonusOpen")) {
    open();
    return;
  }
}, { passive: false });

async function spin(){
  if (spinning || !wheelEl) return;

  const st = await getState();
  const p = canSpin(st.lastSpinMs);
  if (!p.can){
    setModalUI(false, p.leftMs);
    setCardUI(false, p.leftMs);
    return;
  }

  spinning = true;
  spinBtn && (spinBtn.disabled = true);

  const idx = pickWeighted();
  spinToIndex(idx);

  try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium"); } catch(_){}
  try { navigator.vibrate?.(18); } catch(_){}

  setTimeout(async () => {
    await setState(new Date().toISOString());
    spinning = false;

    await refreshUI();

    const prizeText = PRIZES[idx]?.label || "Приз";
    showResult(prizeText);
  }, 4100);
}

function open(){
  if (!overlay) return;
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden","false");
  refreshUI().catch(()=>{});
}

function close(){
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden","true");
}

window.openWheel = open;

document.addEventListener("DOMContentLoaded", () => {
  bind();
  refreshUI().catch(()=>{});
});