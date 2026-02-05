(function () {
  const tg = window.Telegram?.WebApp;

  // ========= BOOT SPLASH =========
  const boot = document.getElementById("bootSplash");
  let bootTimer = null;
  let bootHidden = false;

  function hideBootSplash() {
    if (!boot || bootHidden) return;
    bootHidden = true;
    boot.classList.add("hide");
    setTimeout(() => boot.classList.add("gone"), 220);
    if (bootTimer) clearTimeout(bootTimer);
  }

  function showBootSplash(maxMs = 3000) {
    if (!boot) return;
    bootHidden = false;
    boot.classList.remove("hide", "gone");
    bootTimer = setTimeout(hideBootSplash, maxMs); // максимум 3 сек
  }

  // показываем сразу при старте
  showBootSplash(3000);

  // ========= HAPTIC =========
  function haptic(type = "light") {
    try { tg?.HapticFeedback?.impactOccurred?.(type); return; } catch (_) {}
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {}
  }

  // ========= DOM =========
  const elAvatar = document.getElementById("avatar");
  const elName = document.getElementById("name");
  const elBalance = document.getElementById("balance");
  const elTxList = document.getElementById("txList");
  const elDebug = document.getElementById("debug");

  const screens = Array.from(document.querySelectorAll(".screen"));
  const tabs = Array.from(document.querySelectorAll(".tab"));

// ========= FAKE ONLINE (каждые 5 минут) =========
function randInt(min, max) {
  min = Math.ceil(min); max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setFakeOnline() {
  const els = document.querySelectorAll("[data-online]");
  els.forEach(el => {
    el.textContent = randInt(50, 2500).toLocaleString("ru-RU");
  });
}

// первый раз сразу
setFakeOnline();
// потом каждые 5 минут
setInterval(setFakeOnline, 5 * 60 * 1000);

  // ========= STATE =========
  let balance = 0;
  let currentUserId = null;

  let activeTab = document.querySelector(".tab.active")?.dataset.tab || "home";
  let switching = false;
  let killTimer = null;

  // тайминги ДОЛЖНЫ совпадать с CSS:
  const OUT_MS = 180;  // .screen.leaving transition
  const IN_MS  = 240;  // .screen transition

  // ========= UI HELPERS =========
  const money = (v) =>
    `${Number(v || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;

  function renderBalance() {
    const txt = money(balance);
    if (elBalance) elBalance.textContent = txt;
    const heroAmount = document.getElementById("walletHeroAmount");
    if (heroAmount) heroAmount.textContent = txt;
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("ru-RU", {
        day: "2-digit", month: "2-digit", year: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return iso || "";
    }
  }

  function renderTxList(items) {
    if (!elTxList) return;

    if (!items || items.length === 0) {
      elTxList.innerHTML = `<div class="txDate">Пока нет операций</div>`;
      return;
    }

    elTxList.innerHTML = items.map(tx => {
      const amt = Number(tx.amount || 0);
      const signClass = amt >= 0 ? "plus" : "minus";
      const sign = amt >= 0 ? "+" : "";
      const type = tx.type || "unknown";
      const when = formatDate(tx.created_at);

      return `
        <div class="txItem">
          <div class="txLeft">
            <div class="txType">${type}</div>
            <div class="txDate">${when}</div>
          </div>
          <div class="txAmt ${signClass}">
            ${sign}${money(amt).replace(" ₽","")} ₽
          </div>
        </div>
      `;
    }).join("");
  }

  function setActiveTabUI(tab) {
    tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  }

  function getScreen(tab) {
    return document.querySelector(`.screen[data-screen="${tab}"]`);
  }

  function getActiveScreen() {
    return document.querySelector(".screen.active");
  }

  function hardScrollTop() {
    try { window.scrollTo(0, 0); } catch (_) {}
  }

  function setSwitching(on) {
    if (on) {
      switching = true;
      document.body.classList.add("switching");
      if (killTimer) clearTimeout(killTimer);
      killTimer = setTimeout(() => {
        document.body.classList.remove("switching");
        switching = false;
        killTimer = null;
      }, Math.max(OUT_MS, IN_MS) + 250);
    } else {
      document.body.classList.remove("switching");
      switching = false;
      if (killTimer) clearTimeout(killTimer);
      killTimer = null;
    }
  }

  // ========= NAV (идеальный кроссфейд) =========
  function setActiveTab(tab) {
    if (switching) return;

    const next = getScreen(tab);
    if (!next) return;

    const current = getActiveScreen();
    if (current === next) return;

    setSwitching(true);
    setActiveTabUI(tab);

    // если текущего нет — просто включаем следующий
    if (!current) {
      screens.forEach(s => s.classList.remove("active", "leaving"));
      next.classList.add("active");
      activeTab = tab;
      hardScrollTop();
      setSwitching(false);
      return;
    }

    // 1) ВКЛЮЧАЕМ следующий сразу (он relative и даёт высоту, плавно появляется)
    next.classList.add("active");

    // 2) Текущий делаем leaving, но НЕ снимаем active сразу:
    //    active+leaving => станет absolute (z=2) и плавно исчезнет поверх.
    current.classList.add("leaving");

    activeTab = tab;
    hardScrollTop();

    // 3) После fade-out убираем старый экран полностью
    setTimeout(() => {
      current.classList.remove("active", "leaving");
      setSwitching(false);
    }, OUT_MS + 30);
  }

  // ========= SUPABASE =========
  const SUPABASE_URL = "https://gtwozscjklqzegiwzqss.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0d296c2Nqa2xxemVnaXd6cXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTIxMTUsImV4cCI6MjA4NTY4ODExNX0.yLr6jAl13KuA1OzHrnMkX4VAKH6l40fFVqNik6uBlP4";

  if (!window.supabase) {
    if (elDebug) {
      elDebug.textContent =
        "❌ Supabase SDK не подключён. Проверь index.html:\n" +
        "<script src=\"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2\"></script>";
    }
    return;
  }

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function upsertUser(tgUser) {
    const r1 = await supabase.from("users").upsert({
      id: tgUser.id,
      username: tgUser.username || null,
      first_name: tgUser.first_name || null,
      last_name: tgUser.last_name || null,
      photo_url: tgUser.photo_url || null
    });
    if (r1.error) throw new Error("USERS UPSERT ERROR: " + JSON.stringify(r1.error));

    const r2 = await supabase.from("wallets").upsert({ user_id: tgUser.id });
    if (r2.error) throw new Error("WALLETS UPSERT ERROR: " + JSON.stringify(r2.error));
  }

  async function loadBalance(userId) {
    const res = await supabase.from("wallets").select("balance").eq("user_id", userId).single();
    if (res.error) {
      if (elDebug) elDebug.textContent += "\n\n❌ LOAD BALANCE ERROR:\n" + JSON.stringify(res.error, null, 2);
      return;
    }
    balance = Number(res.data?.balance || 0);
    renderBalance();
  }

  async function loadTransactions(userId) {
    const res = await supabase
      .from("transactions")
      .select("type, amount, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (res.error) {
      if (elDebug) elDebug.textContent += "\n\n❌ LOAD TX ERROR:\n" + JSON.stringify(res.error, null, 2);
      return;
    }
    renderTxList(res.data || []);
  }

  async function testAdd100() {
    if (!currentUserId) return;

    const getRes = await supabase.from("wallets").select("balance").eq("user_id", currentUserId).single();
    if (getRes.error) {
      if (elDebug) elDebug.textContent += "\n\n❌ GET WALLET ERROR:\n" + JSON.stringify(getRes.error, null, 2);
      return;
    }

    const oldBalance = Number(getRes.data?.balance || 0);
    const newBalance = oldBalance + 100;

    const updRes = await supabase
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", currentUserId);

    if (updRes.error) {
      if (elDebug) elDebug.textContent += "\n\n❌ UPDATE WALLET ERROR:\n" + JSON.stringify(updRes.error, null, 2);
      return;
    }

    const txRes = await supabase.from("transactions").insert({
      user_id: currentUserId,
      type: "test_credit",
      amount: 100
    });

    if (txRes.error && elDebug) {
      elDebug.textContent += "\n\n❌ INSERT TX ERROR:\n" + JSON.stringify(txRes.error, null, 2);
    }

    balance = newBalance;
    renderBalance();
    await loadTransactions(currentUserId);
  }

  // ========= EVENTS (делегация) =========
document.addEventListener("click", (e) => {
  const t = e.target;

  // Support card -> открыть чат @vegas_helps
  if (t.closest("#supportBtn")) {
    haptic("light");
    const url = "https://t.me/vegas_helps";

    try { tg?.openTelegramLink?.(url); return; } catch(_) {}
    try { tg?.openLink?.(url); return; } catch(_) {}
    window.open(url, "_blank");
    return;
  }

// Footer links -> инфо-экраны (О нас / Правила / Конфиденциальность / Ответственная игра)
const footerBtn = t.closest(".footerLink");
if (footerBtn) {
  haptic("light");

  // в HTML у кнопок должен быть data-go="about|rules|privacy|responsible"
  const go = footerBtn.dataset.go;
  if (go) setActiveTab(go);

  return;
}

// Назад с инфо-экранов
const backBtn = t.closest("[data-back]");
if (backBtn) {
  haptic("light");
  setActiveTab("home"); // или куда ты хочешь возвращать
  return;
}

    const tabBtn = t.closest(".tab");
    if (tabBtn) { haptic("light"); setActiveTab(tabBtn.dataset.tab); return; }

if (t.closest("#promoBtn") || t.closest("#promoCardBtn")) {
  haptic("light");
  openPromoModal();
  return;
}
    if (t.closest("#depositQuickBtn") || t.closest("#withdrawQuickBtn")) { haptic("light"); setActiveTab("wallet"); return; }
    
    // Topbar PLUS => как депозит
    if (t.closest("#topPlusBtn")) {
      haptic("light");
      setActiveTab("wallet");
      alert("Пополнение (пока заглушка).");
      return;
    }
    
        // Topbar BALANCE => как депозит (клик по плашке баланса)
    if (t.closest("#balancePill")) {
      haptic("light");
      setActiveTab("wallet");
      alert("Пополнение (пока заглушка).");
      return;
    }
    
    const gameBtn = t.closest(".gameCard");
    if (gameBtn) { haptic("medium"); alert(`Открыть игру: ${gameBtn.dataset.game} (пока заглушка)`); return; }

    if (t.closest("#depositBtn") || t.closest("#walletHeroDeposit")) { haptic("light"); alert("Пополнение (пока заглушка)."); return; }
    if (t.closest("#withdrawBtn") || t.closest("#walletHeroWithdraw")) { haptic("light"); alert("Вывод (пока заглушка)."); return; }

    if (t.closest("#testPlus100Btn")) { haptic("light"); testAdd100(); return; }
    if (t.closest("#spinBtn")) { haptic("light"); alert("Колесо фортуны (пока заглушка)"); return; }

    if (t.closest("button")) haptic("light");
  }, { passive: true });

// ===== DAILY BONUS (SUPABASE STATE, TIMER + 24H CLAIM WINDOW + RESET) =====
const dailyModal = document.getElementById("dailyModal");
const dailyModalClose = document.getElementById("dailyModalClose");
const dailyClaimBtn = document.getElementById("dailyClaimBtn");
const dailyBonusBtn = document.getElementById("dailyBonusBtn");
const toast = document.getElementById("toast");

const dailyTrack = document.getElementById("dailyTrack");
const confettiLayer = document.getElementById("confettiLayer");

const elDailyReward = document.getElementById("dailyReward");
const elDailyAction = document.getElementById("dailyAction");
const elDailyTimer = document.getElementById("dailyTimer");

const elModalTimer = document.getElementById("modalTimer");
const elModalTimerBig = document.getElementById("modalTimerBig");

const elNextRewardValue = document.getElementById("nextRewardValue");
const elNextRewardSub = document.getElementById("nextRewardSub");

const promoBtn = document.getElementById("promoBtn");
const promoCardBtn = document.getElementById("promoCardBtn");
const promoModal = document.getElementById("promoModal");
const promoModalClose = document.getElementById("promoModalClose");
const promoInput = document.getElementById("promoInput");
const promoActivateBtn = document.getElementById("promoActivateBtn");

const promoSuccessModal = document.getElementById("promoSuccessModal");
const promoSuccessClose = document.getElementById("promoSuccessClose");
const promoSuccessOk = document.getElementById("promoSuccessOk");
const promoSuccessAmount = document.getElementById("promoSuccessAmount");
const promoSuccessSub = document.getElementById("promoSuccessSub");

const promoFxLayer = document.getElementById("promoFxLayer");
const promoFlash = document.getElementById("promoFlash");

// ===== DAILY HELP POPOVER =====
const dailyHelpBtn = document.getElementById("dailyHelpBtn");
const dailyHelpPopover = document.getElementById("dailyHelpPopover");
const dailyHelpClose = document.getElementById("dailyHelpClose");

function openDailyHelp() {
  if (!dailyHelpPopover) return;
  dailyHelpPopover.classList.add("open");
  dailyHelpPopover.setAttribute("aria-hidden", "false");
}
function closeDailyHelp() {
  if (!dailyHelpPopover) return;
  dailyHelpPopover.classList.remove("open");
  dailyHelpPopover.setAttribute("aria-hidden", "true");
}

if (dailyHelpBtn) {
  dailyHelpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    haptic("light");
    if (dailyHelpPopover?.classList.contains("open")) closeDailyHelp();
    else openDailyHelp();
  });
}
if (dailyHelpClose) {
  dailyHelpClose.addEventListener("click", (e) => {
    e.stopPropagation();
    haptic("light");
    closeDailyHelp();
  });
}
if (dailyModal) {
  dailyModal.addEventListener("click", (e) => {
    if (!dailyHelpPopover?.classList.contains("open")) return;
    const inside = e.target.closest("#dailyHelpPopover") || e.target.closest("#dailyHelpBtn");
    if (!inside) closeDailyHelp();
  });
}

// ===== CONFIG =====
const DAILY_REWARDS = [10, 20, 40, 50, 60, 70, 100];
const COOLDOWN_MS = 24 * 60 * 60 * 1000;      // 24ч до доступности
const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;  // 24ч на забрать (таймер не показываем)

// ===== RUNTIME STATE =====
let dailyUserId = null;
let dailyState = { idx: 0, lastClaimTs: null }; // lastClaimTs: ms | null
let dailyTickTimer = null;
let dailyUiBound = false;
let lastPhaseSeen = null;

function nowMs() { return Date.now(); }

function parseTsToMs(ts) {
  if (!ts) return null;
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : null;
}

function nextAvailableMs(state) {
  if (!state.lastClaimTs) return 0;
  return state.lastClaimTs + COOLDOWN_MS;
}
function expireMs(state) {
  const a = nextAvailableMs(state);
  if (!a) return 0;
  return a + CLAIM_WINDOW_MS;
}

// "cooldown" -> таймер тикает
// "available" -> можно забрать, таймер не показываем
// "expired" -> не забрал в окне, сброс
function dailyPhase(state) {
  if (!state.lastClaimTs) return "available";
  const now = nowMs();
  const a = nextAvailableMs(state);
  const e = expireMs(state);
  if (now < a) return "cooldown";
  if (now < e) return "available";
  return "expired";
}

function msLeftCooldown(state) {
  if (dailyPhase(state) !== "cooldown") return 0;
  return Math.max(0, nextAvailableMs(state) - nowMs());
}

function fmt(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function showToast(text) {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  toast.setAttribute("aria-hidden", "false");
  setTimeout(() => {
    toast.classList.remove("show");
    toast.setAttribute("aria-hidden", "true");
  }, 2600);
}

function spawnConfetti() {
  if (!confettiLayer) return;
  confettiLayer.innerHTML = "";

  const colors = ["#5ad7ff", "#b36cff", "#ff5adc", "#63f2b6", "#ffd166"];
  const count = 60;

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "confettiPiece";

    p.style.left = (Math.random() * 100) + "%";
    p.style.background = colors[(Math.random() * colors.length) | 0];
    p.style.setProperty("--dx", (Math.random() * 160 - 80).toFixed(0) + "px");
    p.style.setProperty("--rot", (Math.random() * 540 - 270).toFixed(0) + "deg");
    p.style.animationDelay = (Math.random() * 0.25).toFixed(2) + "s";
    p.style.opacity = (0.6 + Math.random() * 0.4).toFixed(2);

    confettiLayer.appendChild(p);
  }

  setTimeout(() => { if (confettiLayer) confettiLayer.innerHTML = ""; }, 2000);
}

function renderTrack(state) {
  if (!dailyTrack) return;
  dailyTrack.innerHTML = "";

  const len = DAILY_REWARDS.length;
  const idx = Math.max(0, Math.min(len - 1, Number(state.idx || 0)));

  for (let i = 0; i < len; i++) {
    const dayNum = i + 1;
    const done = i < idx;
    const active = i === idx;

    const item = document.createElement("div");
    item.className = "dayItem";
    item.innerHTML = `
      <div class="dayIcon ${done ? "done" : ""} ${active ? "active" : ""}">${dayNum}</div>
      <div class="dayLabel">День ${dayNum}</div>
      <div class="dayReward">${DAILY_REWARDS[i]} ₽</div>
    `;
    dailyTrack.appendChild(item);
  }
}

function setTimerTextAndVisibility(phase, state) {
  // cooldown -> показываем таймер
  // available -> скрываем таймер (пусто + display none)
  const t = (phase === "cooldown") ? fmt(msLeftCooldown(state)) : "";

  if (elDailyTimer) {
    elDailyTimer.textContent = t;
    elDailyTimer.style.display = (phase === "cooldown") ? "" : "none";
  }
  if (elModalTimer) {
    elModalTimer.textContent = t;
    elModalTimer.style.display = (phase === "cooldown") ? "" : "none";
  }
  if (elModalTimerBig) {
    elModalTimerBig.textContent = t;
    elModalTimerBig.style.display = (phase === "cooldown") ? "" : "none";
  }
}

function animateTimer(el) {
  if (!el) return;
  el.classList.remove("timerAnim");
  void el.offsetWidth; // принудительный reflow
  el.classList.add("timerAnim");
}

function renderDailyUI() {
  if (!dailyUserId) return;

  let phase = dailyPhase(dailyState);

  // если окно забрать просрал — сбрасываем (но делаем это один раз)
  if (phase === "expired" && lastPhaseSeen !== "expired") {
    // async reset в фоне (без await), UI сейчас сразу покажем как день 1 доступен
    dailyState = { idx: 0, lastClaimTs: null };
    lastPhaseSeen = "expired";
    renderDailyUI();
    resetDailyProgressInDb().catch(() => {});
    return;
  }
  lastPhaseSeen = phase;

  const len = DAILY_REWARDS.length;
  const idx = Math.max(0, Math.min(len - 1, Number(dailyState.idx || 0)));

  const currentReward = DAILY_REWARDS[idx];

// ✅ Следующая награда:
// - если можно забрать сейчас -> показываем награду ПОСЛЕ клима (idx+1)
// - если таймер/ожидание -> показываем ближайшую награду (idx), которая станет доступна после таймера
const nextRewardToShow =
  (phase === "available")
    ? DAILY_REWARDS[(idx + 1) % len]
    : DAILY_REWARDS[idx];

if (elNextRewardValue) elNextRewardValue.textContent = `${nextRewardToShow} ₽`;
if (elNextRewardSub) elNextRewardSub.textContent = `Следующая награда`;
  if (elNextRewardSub) elNextRewardSub.textContent = `Следующая награда`;

  const available = (phase === "available");

  if (elDailyAction) {
if (available) {
    elDailyAction.textContent = "Забрать";
  } else {
    elDailyAction.textContent = "Доступно сегодня";
  }

    elDailyAction.classList.toggle("disabled", !available);
    elDailyAction.classList.toggle("ready", available);
  }
  if (dailyClaimBtn) dailyClaimBtn.disabled = !available;

  setTimerTextAndVisibility(phase, dailyState);
  renderTrack(dailyState);
}

// ===== SUPABASE I/O =====
// ВАЖНО: тут используется твой supabase-клиент из проекта (const supabase = window.supabase.createClient(...))
// То есть этот код должен быть НИЖЕ места, где ты создаёшь supabase.
async function ensureDailyRow(userId) {
  // если строки нет — создаём
  const { data, error } = await supabase
    .from("daily_bonus")
    .select("user_id, idx, last_claim_ts")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("DAILY select error: " + error.message);

  if (!data) {
    const ins = await supabase.from("daily_bonus").insert({ user_id: userId, idx: 0, last_claim_ts: null });
    if (ins.error) throw new Error("DAILY insert error: " + ins.error.message);
  }
}

async function loadDailyStateFromDb(userId) {
  await ensureDailyRow(userId);

  const { data, error } = await supabase
    .from("daily_bonus")
    .select("idx, last_claim_ts")
    .eq("user_id", userId)
    .single();

  if (error) throw new Error("DAILY load error: " + error.message);

  dailyState = {
    idx: Math.max(0, Math.min(DAILY_REWARDS.length - 1, Number(data?.idx ?? 0))),
    lastClaimTs: parseTsToMs(data?.last_claim_ts)
  };
}

async function saveDailyStateToDb(userId, patch) {
  const { error } = await supabase
    .from("daily_bonus")
    .update(patch)
    .eq("user_id", userId);

  if (error) throw new Error("DAILY update error: " + error.message);
}

async function resetDailyProgressInDb() {
  if (!dailyUserId) return;
  await saveDailyStateToDb(dailyUserId, { idx: 0, last_claim_ts: null });
}

async function creditWalletDailyBonus(userId, amount) {
  // как твой testAdd100: читаем -> апдейтим -> вставляем транзакцию
  const getRes = await supabase.from("wallets").select("balance").eq("user_id", userId).single();
  if (getRes.error) throw new Error("GET WALLET ERROR: " + getRes.error.message);

  const oldBalance = Number(getRes.data?.balance || 0);
  const newBalance = oldBalance + Number(amount || 0);

  const updRes = await supabase
    .from("wallets")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (updRes.error) throw new Error("UPDATE WALLET ERROR: " + updRes.error.message);

  const txRes = await supabase.from("transactions").insert({
    user_id: userId,
    type: "daily_bonus",
    amount: Number(amount || 0)
  });

  if (txRes.error) {
    // не валим всё из-за tx, но в дебаг можешь вывести
  }

  // обновим UI баланса если у тебя есть balance переменная в скоупе
  try {
    balance = newBalance;
    renderBalance();
    await loadTransactions(userId);
  } catch (_) {}
}

async function claimDailyBonus() {
  if (!dailyUserId) return;

  // обновим состояние из базы (на случай гонки)
  await loadDailyStateFromDb(dailyUserId);

  let phase = dailyPhase(dailyState);

  // если просрал окно — сбросим и дадим за день 1
  if (phase === "expired") {
    dailyState = { idx: 0, lastClaimTs: null };
    await resetDailyProgressInDb();
    phase = dailyPhase(dailyState); // станет available
  }

  if (phase !== "available") return;

  const len = DAILY_REWARDS.length;
  const idx = Math.max(0, Math.min(len - 1, Number(dailyState.idx || 0)));
  const reward = DAILY_REWARDS[idx];

  // фиксируем клейм: last_claim_ts = сейчас, idx = следующий
  const nextIdx = (idx + 1) % len;

  await saveDailyStateToDb(dailyUserId, {
    idx: nextIdx,
    last_claim_ts: new Date().toISOString()
  });

  // локально обновим, чтобы UI не лагал
  dailyState = { idx: nextIdx, lastClaimTs: nowMs() };

  spawnConfetti();
  showToast(`✅ Ежедневный бонус получен! +${reward} ₽`);

  // начислим деньги в кошелёк
  await creditWalletDailyBonus(dailyUserId, reward);

  renderDailyUI();
}

// ===== MODAL OPEN/CLOSE =====
function openDailyModal() {
  if (!dailyModal) return;
  renderDailyUI();
  dailyModal.classList.add("open");
  dailyModal.setAttribute("aria-hidden", "false");
}
function closeDailyModal() {
  if (!dailyModal) return;
  dailyModal.classList.remove("open");
  dailyModal.setAttribute("aria-hidden", "true");
  closeDailyHelp();
}

// ===== INIT =====
async function initDailyBonus(userId) {
  dailyUserId = userId;

  try {
    await loadDailyStateFromDb(userId);
  } catch (e) {
    // если хочешь — в elDebug вывести
    // if (elDebug) elDebug.textContent += "\n\n❌ DAILY: " + (e?.message || String(e));
  }

  if (!dailyUiBound) {
    dailyUiBound = true;

    if (dailyBonusBtn) dailyBonusBtn.addEventListener("click", async () => {
      haptic("light");
      try { await loadDailyStateFromDb(dailyUserId); } catch (_) {}
      openDailyModal();
    });

    if (dailyModalClose) dailyModalClose.addEventListener("click", () => {
      haptic("light");
      closeDailyModal();
    });

    if (dailyModal) dailyModal.addEventListener("click", (e) => {
      if (e.target && e.target.matches('[data-close="daily"]')) closeDailyModal();
    });

    if (dailyClaimBtn) dailyClaimBtn.addEventListener("click", async () => {
      haptic("medium");
      try { await claimDailyBonus(); } catch (e) {
        showToast("❌ Ошибка получения бонуса");
      }
    });
  }

  // тикаем UI (таймер на cooldown)
  if (dailyTickTimer) clearInterval(dailyTickTimer);
  dailyTickTimer = setInterval(() => {
    renderDailyUI();
  }, 1000);

  renderDailyUI();
}

function openPromoModal(){
  if (!promoModal) return;
  promoModal.classList.add("open");
  promoModal.setAttribute("aria-hidden", "false");
  setTimeout(() => promoInput?.focus(), 50);
}

function closePromoModal(){
  if (!promoModal) return;
  promoModal.classList.remove("open");
  promoModal.setAttribute("aria-hidden", "true");
}

function openPromoSuccess(amount, codeUpper) {
  if (!promoSuccessModal) return;

  if (promoSuccessAmount) promoSuccessAmount.textContent = `+${Number(amount || 0)} ₽`;
  if (promoSuccessSub) promoSuccessSub.textContent = `Промокод ${codeUpper} активирован`;

  promoSuccessModal.classList.add("open");
  promoSuccessModal.setAttribute("aria-hidden", "false");

  // FLASH
  if (promoFlash) {
    promoFlash.classList.add("on");
    setTimeout(() => promoFlash.classList.remove("on"), 120);
    setTimeout(() => promoFlash.classList.add("on"), 90);
    setTimeout(() => promoFlash.classList.remove("on"), 140);
  }

  spawnMegaConfetti(promoFxLayer);
  try { tg?.HapticFeedback?.notificationOccurred?.("success"); } catch(_) {}
}

function closePromoSuccess() {
  if (!promoSuccessModal) return;
  promoSuccessModal.classList.remove("open");
  promoSuccessModal.setAttribute("aria-hidden", "true");
  if (promoFxLayer) promoFxLayer.innerHTML = "";
}

function spawnMegaConfetti(layer) {
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

async function redeemPromo(codeRaw) {
  if (!currentUserId) throw new Error("no_user");

  const code = String(codeRaw || "").trim();
  if (!code) return { ok: false, reason: "empty" };

  // Supabase function: redeem_promo(p_code text, p_user_id bigint) -> jsonb
  const { data, error } = await supabase.rpc("redeem_promo", {
    p_code: code,
    p_user_id: currentUserId
  });

  if (error) throw error;
  return data;
}

async function creditWalletPromo(userId, amount) {
  const getRes = await supabase.from("wallets").select("balance").eq("user_id", userId).single();
  if (getRes.error) throw new Error("GET WALLET ERROR: " + getRes.error.message);

  const oldBalance = Number(getRes.data?.balance || 0);
  const add = Number(amount || 0);
  const newBalance = oldBalance + add;

  const updRes = await supabase
    .from("wallets")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (updRes.error) throw new Error("UPDATE WALLET ERROR: " + updRes.error.message);

  // фиксируем транзакцию (если у тебя только type/amount — так и пишем)
  const txRes = await supabase.from("transactions").insert({
    user_id: userId,
    type: "promo_bonus",
    amount: add
  });

  // не валим всё если tx не вставилась
  if (txRes.error) {}

  // обновим UI
  try {
    balance = newBalance;
    renderBalance();
    await loadTransactions(userId);
  } catch (_) {}
}

// открыть промо-модалку и с HOME-кнопки, и с карточки в "Бонусы"
if (promoBtn) promoBtn.addEventListener("click", () => { haptic("light"); openPromoModal(); });
if (promoCardBtn) promoCardBtn.addEventListener("click", () => { haptic("light"); openPromoModal(); });

if (promoModalClose) promoModalClose.addEventListener("click", () => { haptic("light"); closePromoModal(); });

if (promoModal) promoModal.addEventListener("click", (e) => {
  if (e.target && e.target.matches('[data-close="promo"]')) closePromoModal();
});

if (promoInput) {
  promoInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") promoActivateBtn?.click();
  });
}

// SUCCESS modal close
if (promoSuccessClose) promoSuccessClose.addEventListener("click", () => { haptic("light"); closePromoSuccess(); });
if (promoSuccessOk) promoSuccessOk.addEventListener("click", () => { haptic("light"); closePromoSuccess(); });
if (promoSuccessModal) promoSuccessModal.addEventListener("click", (e) => {
  if (e.target && e.target.matches('[data-close="promoSuccess"]')) closePromoSuccess();
});

// ACTIVATE
if (promoActivateBtn) {
  promoActivateBtn.addEventListener("click", async () => {
    haptic("medium");

    const raw = promoInput?.value || "";
    const codeUpper = String(raw).trim().toUpperCase();

    if (!codeUpper) {
      showToast("Введите промокод");
      return;
    }

    promoActivateBtn.disabled = true;

    try {
      const res = await redeemPromo(codeUpper);

      if (!res?.ok) {
        // если хочешь строго одну фразу — оставляем так:
        showToast("Промокод не верный");
        promoActivateBtn.disabled = false;
        return;
      }

      const amount = Number(res.amount || 0);

      // начисляем в кошелек + транзакция
      await creditWalletPromo(currentUserId, amount);

      // UI
      closePromoModal();
      if (promoInput) promoInput.value = "";
      openPromoSuccess(amount, codeUpper);

    } catch (e) {
      showToast("Промокод не верный");
    } finally {
      promoActivateBtn.disabled = false;
    }
  });
}

if (promoCardBtn) promoCardBtn.addEventListener("click", () => { haptic("light"); openPromoModal(); });
if (promoModalClose) promoModalClose.addEventListener("click", () => { haptic("light"); closePromoModal(); });
if (promoModal) promoModal.addEventListener("click", (e) => {
  if (e.target && e.target.matches('[data-close="promo"]')) closePromoModal();
});

  // ========= TELEGRAM INIT =========
  function initTelegram() {
    if (!tg) {
      if (elDebug) elDebug.textContent = "Открой через Telegram Mini App, чтобы появился window.Telegram.WebApp";
      return;
    }

    tg.ready();
    tg.expand();

    const user = tg.initDataUnsafe?.user;

    if (elDebug) {
      elDebug.textContent = JSON.stringify({
        platform: tg.platform,
        version: tg.version,
        user: user || null,
        initDataLength: (tg.initData || "").length
      }, null, 2);
    }

if (!user) {
  hideBootSplash();
  return;
}

currentUserId = user.id;

if (elName) elName.textContent = [user.first_name, user.last_name].filter(Boolean).join(" ");

// ✅ АВАТАР
if (elAvatar) {
  const photo = user.photo_url;

  if (photo) {
    elAvatar.style.background = `url("${photo}") center / cover no-repeat`;
  } else {
    // fallback — твой фирменный градиент
    elAvatar.style.background =
      "linear-gradient(135deg,#2b8cff,#3bb273)";
  }
}

(async () => {
  try {
    await upsertUser(user);
    await loadBalance(user.id);
    await loadTransactions(user.id);
    await initDailyBonus(user.id);
    if (elDebug) elDebug.textContent += "\n\n✅ Supabase OK";

    hideBootSplash(); // ✅ ВОТ СЮДА
  } catch (e) {
    if (elDebug) elDebug.textContent += "\n\n❌ " + (e?.message || String(e));

    hideBootSplash(); // ✅ И СЮДА (чтобы не зависало при ошибке)
  }
})();
}

  // ========= BOOT =========
  setActiveTabUI(activeTab);
  screens.forEach(s => s.classList.remove("active", "leaving"));
  getScreen(activeTab)?.classList.add("active");
  renderBalance();
  initTelegram();
})();