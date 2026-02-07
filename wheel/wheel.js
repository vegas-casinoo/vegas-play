let wheelOverlay, wheelEl, spinBtn, timerEl, closeBtn;
let resultOverlay, resultValueEl, resultBtn, confettiEl;

let spinning = false;
let cooldownTimer = null;

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Призы + шансы (как ты дал)
const PRIZES = [
  { label: "+30% к пополнению", kind: "dep_boost", value: 30, weight: 10 },
  { label: "+20% к пополнению", kind: "dep_boost", value: 20, weight: 10 },
  { label: "+10% к пополнению", kind: "dep_boost", value: 10, weight: 35 },
  { label: "+5% к пополнению",  kind: "dep_boost", value: 5,  weight: 40 },
  { label: "1000 ₽",           kind: "money",    value: 1000, weight: 2 },
  { label: "500 ₽",            kind: "money",    value: 500,  weight: 3 },
];

function supa() { return window.VEGAS?.supabase || null; }
function userId() { return window.VEGAS?.getUserId?.() || null; }

function $(id){ return document.getElementById(id); }

function ensureInjected(cb){
  wheelOverlay = $("wheelOverlay");
  if (wheelOverlay) return cb();

  fetch("/wheel/wheel.html")
    .then(r => r.text())
    .then(html => {
      document.body.insertAdjacentHTML("beforeend", html);
      bindDom();
      cb();
    })
    .catch(() => alert("Не смог загрузить /wheel/wheel.html"));
}

function bindDom(){
  wheelOverlay = $("wheelOverlay");
  wheelEl = $("wheel");
  spinBtn = $("wheelSpinMain");
  timerEl = $("wheelTimer");
  closeBtn = $("wheelClose");

  resultOverlay = $("wheelResult");
  resultValueEl = $("wheelResultValue");
  resultBtn = $("wheelResultBtn");
  confettiEl = $("wheelConfetti");

  // close
  closeBtn?.addEventListener("click", closeWheel);
  wheelOverlay?.addEventListener("click", (e) => {
    if (e.target === wheelOverlay) closeWheel();
  });

  // spin
  spinBtn?.addEventListener("click", spinWheel);

  // result accept
  resultBtn?.addEventListener("click", hideResult);
  resultOverlay?.addEventListener("click", (e) => {
    if (e.target === resultOverlay) hideResult();
  });
}

function openWheel(){
  ensureInjected(async () => {
    wheelOverlay.classList.add("open");
    wheelOverlay.setAttribute("aria-hidden", "false");
    await refreshAvailabilityUI(); // сразу обновляем кнопку/таймер
  });
}

function closeWheel(){
  if (!wheelOverlay) return;
  wheelOverlay.classList.remove("open");
  wheelOverlay.setAttribute("aria-hidden", "true");
}

function nowMs(){ return Date.now(); }

function fmt(ms){
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

async function getWheelState(){
  const sb = supa();
  const uid = userId();
  if (!sb || !uid) return { lastSpinTs: null };

  const { data, error } = await sb
    .from("wheel_state")
    .select("last_spin_ts")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) return { lastSpinTs: null };

  return { lastSpinTs: data?.last_spin_ts ? Date.parse(data.last_spin_ts) : null };
}

async function setWheelState(tsIso){
  const sb = supa();
  const uid = userId();
  if (!sb || !uid) return;

  // upsert
  await sb.from("wheel_state").upsert({
    user_id: uid,
    last_spin_ts: tsIso
  });
}

function canSpinFromState(lastSpinTs){
  if (!lastSpinTs) return { can: true, leftMs: 0 };
  const next = lastSpinTs + COOLDOWN_MS;
  const left = next - nowMs();
  return { can: left <= 0, leftMs: Math.max(0, left) };
}

function setSpinEnabled(can, leftMs){
  // modal button
  if (spinBtn){
    spinBtn.disabled = !can;
  }
  if (timerEl){
    timerEl.style.display = can ? "none" : "";
    timerEl.textContent = can ? "" : `Доступно через ${fmt(leftMs)}`;
  }

  // HOME-кнопка (на карточке) — если есть
  const homeBtn = document.getElementById("wheelSpinBtn");
  if (homeBtn){
    homeBtn.disabled = !can;
    if (can){
      homeBtn.classList.remove("disabled");
      homeBtn.textContent = "Крутить";
    } else {
      homeBtn.classList.add("disabled");
      homeBtn.textContent = fmt(leftMs);
    }
  }
}

async function refreshAvailabilityUI(){
  const st = await getWheelState();
  const { can, leftMs } = canSpinFromState(st.lastSpinTs);

  setSpinEnabled(can, leftMs);

  // таймер тикает только когда нельзя
  if (cooldownTimer) clearInterval(cooldownTimer);
  if (!can){
    cooldownTimer = setInterval(async () => {
      const st2 = await getWheelState();
      const p = canSpinFromState(st2.lastSpinTs);
      setSpinEnabled(p.can, p.leftMs);
      if (p.can && cooldownTimer){
        clearInterval(cooldownTimer);
        cooldownTimer = null;
      }
    }, 1000);
  }
}

function pickWeightedIndex(){
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

  // стрелка сверху. центр сектора = i*step + step/2
  const centerAngle = index * step + step/2;
  const target = 360 - centerAngle;

  const spins = 6;
  const finalDeg = spins*360 + target;

  wheelEl.style.transition = "none";
  wheelEl.style.transform = "translateZ(0) rotate(0deg)";
  void wheelEl.offsetWidth;

  wheelEl.style.transition = "transform 3.9s cubic-bezier(.12,.85,.18,1)";
  wheelEl.style.transform = `translateZ(0) rotate(${finalDeg}deg)`;
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
    d.className = "wc";
    d.style.left = (Math.random()*100) + "%";
    d.style.background = colors[(Math.random()*colors.length)|0];
    d.style.animationDelay = (Math.random()*0.12).toFixed(2) + "s";
    d.style.transform = `translateY(0) rotate(${(Math.random()*180)|0}deg)`;
    confettiEl.appendChild(d);
  }

  setTimeout(()=>{ if(confettiEl) confettiEl.innerHTML=""; }, 1200);
}

function showResult(text){
  if (!resultOverlay) return;
  if (resultValueEl) resultValueEl.textContent = text;
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

async function spinWheel(){
  if (spinning || !wheelEl) return;

  // проверка доступности
  const st = await getWheelState();
  const p = canSpinFromState(st.lastSpinTs);
  if (!p.can){
    setSpinEnabled(false, p.leftMs);
    return;
  }

  spinning = true;
  spinBtn && (spinBtn.disabled = true);

  const index = pickWeightedIndex();
  spinToIndex(index);

  try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium"); } catch(_){}
  try { navigator.vibrate?.(18); } catch(_){}

  setTimeout(async () => {
    // фиксируем время спина в БД
    await setWheelState(new Date().toISOString());

    spinning = false;

    // обновляем UI (и на HOME, и в модалке)
    await refreshAvailabilityUI();

    const prizeText = PRIZES[index]?.label || "Приз";
    showResult(prizeText);
  }, 4100);
}

// global export
window.openWheel = openWheel;

// авто-обновление HOME-кнопки (если есть)
document.addEventListener("DOMContentLoaded", () => {
  refreshAvailabilityUI().catch(()=>{});
});