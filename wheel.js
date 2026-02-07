(function(){
  // ===== helpers =====
  const tg = window.Telegram?.WebApp;

  function haptic(type="light"){
    try { tg?.HapticFeedback?.impactOccurred?.(type); return; } catch(_){}
    try { if (navigator.vibrate) navigator.vibrate(12); } catch(_){}
  }

  function nowMs(){ return Date.now(); }

  function fmtHMS(ms){
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  function money(v){
    return `${Number(v||0).toLocaleString("ru-RU", {minimumFractionDigits:0, maximumFractionDigits:0})} ₽`;
  }

  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

  // ===== config from your file =====
  // 10 prizes total:
  // 1x +30% (10%), 2x +20% (10%), 2x +10% (35%), 3x +5% (40%), 1x 1000₽ (2%), 1x 500₽ (3%)
  // Source: текст.txt [oai_citation:0‡текст.txt](sediment://file_000000007ce871f4aeb7004f999b0bb7)
  const WHEEL_SEGMENTS = [
    { key:"dep30", label:"+30% к пополнению", kind:"deposit_boost", value:30 },
    { key:"dep20a", label:"+20% к пополнению", kind:"deposit_boost", value:20 },
    { key:"dep20b", label:"+20% к пополнению", kind:"deposit_boost", value:20 },
    { key:"dep10a", label:"+10% к пополнению", kind:"deposit_boost", value:10 },
    { key:"dep10b", label:"+10% к пополнению", kind:"deposit_boost", value:10 },
    { key:"dep5a",  label:"+5% к пополнению",  kind:"deposit_boost", value:5 },
    { key:"dep5b",  label:"+5% к пополнению",  kind:"deposit_boost", value:5 },
    { key:"dep5c",  label:"+5% к пополнению",  kind:"deposit_boost", value:5 },
    { key:"rub1000",label:"1000 ₽", kind:"money", value:1000 },
    { key:"rub500", label:"500 ₽",  kind:"money", value:500 },
  ];

  const WHEEL_WEIGHTS = [
    { prize:"dep30",  weight:10 },
    { prize:"dep20",  weight:10 },
    { prize:"dep10",  weight:35 },
    { prize:"dep5",   weight:40 },
    { prize:"rub1000",weight:2  },
    { prize:"rub500", weight:3  },
  ];

  const COOLDOWN_MS = 24 * 60 * 60 * 1000;

  // ===== state =====
  let supabase = null;
  let getUserId = null;

  let wheelLastSpinMs = null;
  let wheelAngle = 0;
  let wheelSpinning = false;
  let tickTimer = null;

  // DOM
  let mount, wheelEntryBtn, wheelEntrySub;
  let wheelModal, wheelCloseBtn, wheelCanvas, wheelSpinBtn, wheelSubHint;
  let wheelWinModal, wheelWinClose, wheelWinOk, wheelWinAmount, wheelWinSub, wheelFxLayer;

  // ===== init mount html =====
  function injectHTML(){
    mount = document.getElementById("wheelMount");
    if (!mount) return;

    mount.innerHTML = `
      <div class="modal" id="wheelModal" aria-hidden="true">
        <div class="modalBackdrop" data-close="wheel"></div>

        <div class="wheelSheet" role="dialog" aria-modal="true">
          <button class="wheelClose" id="wheelCloseBtn" aria-label="Закрыть">✕</button>

          <div class="wheelStage">
            <div class="wheelPointer" aria-hidden="true"></div>
            <canvas id="wheelCanvas" width="720" height="720" class="wheelCanvas"></canvas>

            <button class="wheelSpinBtn" id="wheelSpinBtn" type="button">
              <span class="wheelSpinIcon">⟲</span>
              <span class="wheelSpinText">Крутить</span>
            </button>
          </div>

          <div class="wheelSubHint" id="wheelSubHint"></div>
        </div>
      </div>

      <div class="modal" id="wheelWinModal" aria-hidden="true">
        <div class="modalBackdrop" data-close="wheelWin"></div>

        <div class="wheelWinSheet" role="dialog" aria-modal="true">
          <div class="promoFxLayer" id="wheelFxLayer" aria-hidden="true"></div>

          <button class="modalClose" id="wheelWinClose" aria-label="Закрыть">✕</button>

          <div class="wheelWinIcon">🎉</div>
          <div class="wheelWinTitle">Вы выиграли!</div>
          <div class="wheelWinAmount" id="wheelWinAmount">+0 ₽</div>
          <div class="wheelWinSub" id="wheelWinSub">Награда начислена</div>

          <button class="wheelWinBtn" id="wheelWinOk">Принять</button>
        </div>
      </div>
    `;

    // bind DOM refs
    wheelEntryBtn = document.getElementById("wheelEntryBtn");
    wheelEntrySub = document.getElementById("wheelEntrySub");
    const wheelEntry = document.getElementById("wheelEntry");
const wheelEntryMeta = document.getElementById("wheelEntryMeta");
    
    wheelModal = document.getElementById("wheelModal");
    wheelCloseBtn = document.getElementById("wheelCloseBtn");
    wheelCanvas = document.getElementById("wheelCanvas");
    wheelSpinBtn = document.getElementById("wheelSpinBtn");
    wheelSubHint = document.getElementById("wheelSubHint");

    wheelWinModal = document.getElementById("wheelWinModal");
    wheelWinClose = document.getElementById("wheelWinClose");
    wheelWinOk = document.getElementById("wheelWinOk");
    wheelWinAmount = document.getElementById("wheelWinAmount");
    wheelWinSub = document.getElementById("wheelWinSub");
    wheelFxLayer = document.getElementById("wheelFxLayer");
  }

  // ===== supabase helpers =====
  async function ensureRow(userId){
    const { data, error } = await supabase
      .from("wheel_fortune")
      .select("user_id,last_spin_ts,last_prize_key")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    if (!data){
      const ins = await supabase.from("wheel_fortune").insert({
        user_id: userId,
        last_spin_ts: null,
        last_prize_key: null
      });
      if (ins.error) throw ins.error;
    }
  }

  async function loadState(userId){
    await ensureRow(userId);

    const { data, error } = await supabase
      .from("wheel_fortune")
      .select("last_spin_ts,last_prize_key")
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    wheelLastSpinMs = data?.last_spin_ts ? Date.parse(data.last_spin_ts) : null;
  }

  async function saveSpin(userId, prizeKey){
    const { error } = await supabase
      .from("wheel_fortune")
      .update({
        last_spin_ts: new Date().toISOString(),
        last_prize_key: prizeKey,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId);

    if (error) throw error;
  }

  async function creditMoney(userId, amount){
    // wallets.balance + transactions
    const getRes = await supabase.from("wallets").select("balance").eq("user_id", userId).single();
    if (getRes.error) throw getRes.error;

    const oldBal = Number(getRes.data?.balance || 0);
    const add = Number(amount || 0);
    const newBal = oldBal + add;

    const updRes = await supabase
      .from("wallets")
      .update({ balance: newBal, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updRes.error) throw updRes.error;

    await supabase.from("transactions").insert({
      user_id: userId,
      type: "wheel_win",
      amount: add
    });
  }

  // ===== availability =====
  function availableAt(){
    if (!wheelLastSpinMs) return 0;
    return wheelLastSpinMs + COOLDOWN_MS;
  }
  function isAvailable(){
    return !wheelLastSpinMs || nowMs() >= availableAt();
  }
  function leftMs(){
    if (isAvailable()) return 0;
    return Math.max(0, availableAt() - nowMs());
  }

function renderEntry(){
  if (!wheelEntryBtn || !wheelEntrySub) return;

  if (isAvailable()){
    wheelEntryBtn.classList.remove("disabled");
    wheelEntryBtn.textContent = "Крутить";
    wheelEntrySub.textContent = "Выигрывайте призы каждый день";
    const meta = document.getElementById("wheelEntryMeta");
    if (meta) meta.textContent = "1 прокрутка / 24 часа";
  } else {
    wheelEntryBtn.classList.add("disabled");
    wheelEntryBtn.textContent = fmtHMS(leftMs());
    wheelEntrySub.textContent = "До следующей прокрутки";
    const meta = document.getElementById("wheelEntryMeta");
    if (meta) meta.textContent = "Доступно скоро";
  }

  if (wheelSubHint){
    wheelSubHint.textContent = isAvailable()
      ? "Нажмите «Крутить»"
      : `Доступно через ${fmtHMS(leftMs())}`;
  }

  if (wheelSpinBtn){
    wheelSpinBtn.disabled = !isAvailable() || wheelSpinning;
  }
}

  // ===== wheel drawing =====
  function drawWheel(){
    if (!wheelCanvas) return;
    const ctx = wheelCanvas.getContext("2d");
    const W = wheelCanvas.width, H = wheelCanvas.height;
    const cx = W/2, cy = H/2;
    const r = Math.min(W,H)*0.46;

    ctx.clearRect(0,0,W,H);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wheelAngle);

    const n = WHEEL_SEGMENTS.length;
    const step = (Math.PI*2)/n;

    for (let i=0;i<n;i++){
      const a0 = i*step;
      const a1 = a0 + step;

      const hue = (i*360/n);

      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0,r,a0,a1);
      ctx.closePath();
      ctx.fillStyle = `hsla(${hue}, 85%, 55%, 0.95)`;
      ctx.fill();

      ctx.strokeStyle = "rgba(0,0,0,.35)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.save();
      ctx.rotate(a0 + step/2);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(10,11,16,.92)";
      ctx.font = "900 26px system-ui,-apple-system";
      ctx.fillText(WHEEL_SEGMENTS[i].label, r - 18, 10);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0,0, r*0.22, 0, Math.PI*2);
    ctx.fillStyle = "rgba(10,11,16,.85)";
    ctx.fill();

    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx,cy,r+6,0,Math.PI*2);
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.lineWidth = 10;
    ctx.stroke();
  }

  function easeOutCubic(t){ return 1 - Math.pow(1-t,3); }

  async function spinToIndex(targetIndex){
    const n = WHEEL_SEGMENTS.length;
    const step = (Math.PI*2)/n;

    const targetAngle = (targetIndex * step) + step/2;
    const pointerAngle = -Math.PI/2;
    const desired = pointerAngle - targetAngle;

    const spins = 6 + Math.floor(Math.random()*3);
    const start = wheelAngle;
    const end = desired + spins * Math.PI*2;

    const dur = 4200;
    const t0 = performance.now();

    return new Promise((resolve)=>{
      function frame(now){
        const p = Math.min(1, (now - t0)/dur);
        const k = easeOutCubic(p);
        wheelAngle = start + (end - start)*k;
        drawWheel();
        if (p < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  // ===== prize pick =====
  function pickByWeights(){
    const total = WHEEL_WEIGHTS.reduce((s,x)=>s+x.weight,0);
    let roll = Math.random()*total;
    for (const x of WHEEL_WEIGHTS){
      roll -= x.weight;
      if (roll <= 0) return x.prize;
    }
    return WHEEL_WEIGHTS[WHEEL_WEIGHTS.length-1].prize;
  }

  function pickSegmentIndexForPrize(prize){
    let keys = [];
    if (prize === "dep30") keys = ["dep30"];
    if (prize === "dep20") keys = ["dep20a","dep20b"];
    if (prize === "dep10") keys = ["dep10a","dep10b"];
    if (prize === "dep5")  keys = ["dep5a","dep5b","dep5c"];
    if (prize === "rub1000") keys = ["rub1000"];
    if (prize === "rub500")  keys = ["rub500"];

    const candidates = WHEEL_SEGMENTS
      .map((s,idx)=>({s,idx}))
      .filter(x => keys.includes(x.s.key))
      .map(x => x.idx);

    return candidates[(Math.random()*candidates.length)|0];
  }

  // ===== confetti (reuse your class names to look same) =====
  function spawnMegaConfetti(layer){
    if (!layer) return;
    layer.innerHTML = "";

    const colors = ["#5ad7ff", "#b36cff", "#ff5adc", "#63f2b6", "#ffd166", "#ffffff"];
    const count = 140;

    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "confettiPiece";
      p.style.left = (Math.random() * 100) + "%";
      p.style.background = colors[(Math.random() * colors.length) | 0];
      p.style.setProperty("--dx", (Math.random() * 240 - 120).toFixed(0) + "px");
      p.style.setProperty("--rot", (Math.random() * 720 - 360).toFixed(0) + "deg");
      p.style.animationDuration = (1.2 + Math.random() * 0.9).toFixed(2) + "s";
      p.style.animationDelay = (Math.random() * 0.12).toFixed(2) + "s";
      p.style.opacity = (0.65 + Math.random() * 0.35).toFixed(2);
      p.style.width = (6 + Math.random() * 6).toFixed(0) + "px";
      p.style.height = (10 + Math.random() * 10).toFixed(0) + "px";
      layer.appendChild(p);
    }

    setTimeout(() => { if (layer) layer.innerHTML = ""; }, 2400);
  }

  // ===== modal open/close =====
  function openWheel(){
    if (!wheelModal) return;
    wheelModal.classList.add("open");
    wheelModal.setAttribute("aria-hidden","false");
    drawWheel();
    renderEntry();
  }
  function closeWheel(){
    if (!wheelModal) return;
    wheelModal.classList.remove("open");
    wheelModal.setAttribute("aria-hidden","true");
  }

  function openWin(amountText, subText){
    if (wheelWinAmount) wheelWinAmount.textContent = amountText;
    if (wheelWinSub) wheelWinSub.textContent = subText;

    wheelWinModal?.classList.add("open");
    wheelWinModal?.setAttribute("aria-hidden","false");

    spawnMegaConfetti(wheelFxLayer);
    try { tg?.HapticFeedback?.notificationOccurred?.("success"); } catch(_){}
  }
  function closeWin(){
    wheelWinModal?.classList.remove("open");
    wheelWinModal?.setAttribute("aria-hidden","true");
    if (wheelFxLayer) wheelFxLayer.innerHTML = "";
  }

  // ===== spin handler =====
  async function handleSpin(){
    if (wheelSpinning) return;

    const userId = getUserId?.();
    if (!userId) return;

    if (!isAvailable()){
      haptic("light");
      renderEntry();
      return;
    }

    wheelSpinning = true;
    renderEntry();

    const prize = pickByWeights();
    const idx = pickSegmentIndexForPrize(prize);
    const seg = WHEEL_SEGMENTS[idx];

    haptic("medium");
    await spinToIndex(idx);

    // фиксируем результат в базе
    await saveSpin(userId, seg.key);
    wheelLastSpinMs = nowMs();

    // награда
    if (seg.kind === "money"){
      await creditMoney(userId, seg.value);
      openWin(`+${money(seg.value)}`, "Награда зачислена на баланс");
    } else {
      // депозитный буст — пока просто “активирован”
      openWin(seg.label, "Бонус активирован (применим при пополнении)");
    }

    wheelSpinning = false;
    renderEntry();
  }

  // ===== bind events =====
  function bindEvents(){
    const wheelEntry = document.getElementById("wheelEntry");

if (wheelEntry){
  wheelEntry.addEventListener("click", async (e)=>{
    // если нажали на правую кнопку — не даём событию улететь дважды
    const btn = e.target.closest("#wheelEntryBtn");
    if (btn) e.stopPropagation();

    haptic("light");
    const userId = getUserId?.();
    if (!userId) return;

    try { await loadState(userId); } catch(_){}
    openWheel();
  });
}
    }

    if (wheelCloseBtn) wheelCloseBtn.addEventListener("click", ()=>{ haptic("light"); closeWheel(); });

    if (wheelModal){
      wheelModal.addEventListener("click", (e)=>{
        if (e.target && e.target.matches('[data-close="wheel"]')) closeWheel();
      });
    }

    if (wheelSpinBtn){
      wheelSpinBtn.addEventListener("click", async ()=>{
        try { await handleSpin(); } catch(e){
          wheelSpinning = false;
          renderEntry();
        }
      });
    }

    if (wheelWinClose) wheelWinClose.addEventListener("click", ()=>{ haptic("light"); closeWin(); });
    if (wheelWinOk) wheelWinOk.addEventListener("click", ()=>{ haptic("light"); closeWin(); });
    if (wheelWinModal){
      wheelWinModal.addEventListener("click", (e)=>{
        if (e.target && e.target.matches('[data-close="wheelWin"]')) closeWin();
      });
    }
  }

  // ===== wait for bridge + user =====
  async function waitForBridge(){
    // ждём, пока app.js создаст window.VEGAS и supabase
    for (let i=0;i<200;i++){
      const V = window.VEGAS;
      if (V?.supabase && typeof V.getUserId === "function"){
        supabase = V.supabase;
        getUserId = V.getUserId;
        return true;
      }
      await sleep(50);
    }
    return false;
  }

  async function init(){
    injectHTML();
    bindEvents();

    const ok = await waitForBridge();
    if (!ok) return;

    // ждём логина (userId)
    for (let i=0;i<200;i++){
      const uid = getUserId?.();
      if (uid){
        try { await loadState(uid); } catch(_){}
        renderEntry();

        if (tickTimer) clearInterval(tickTimer);
        tickTimer = setInterval(renderEntry, 1000);

        drawWheel();
        return;
      }
      await sleep(100);
    }
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();