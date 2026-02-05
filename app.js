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

  // Footer links (пока заглушки)
  const footerBtn = t.closest(".footerLink");
  if (footerBtn) {
    haptic("light");
    alert("Скоро добавим этот раздел 🙂");
    return;
  }

    const tabBtn = t.closest(".tab");
    if (tabBtn) { haptic("light"); setActiveTab(tabBtn.dataset.tab); return; }

    if (t.closest("#promoBtn")) { haptic("light"); alert("Промокод (скоро)"); return; }
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

// ===== DAILY BONUS (NO STREAK, WITH TIMER + 24H CLAIM WINDOW + RESET) =====
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

// закрывать по клику вне окна (внутри модалки)
if (dailyModal) {
  dailyModal.addEventListener("click", (e) => {
    if (!dailyHelpPopover?.classList.contains("open")) return;
    const inside = e.target.closest("#dailyHelpPopover") || e.target.closest("#dailyHelpBtn");
    if (!inside) closeDailyHelp();
  });
}

// ===== LOGIC =====

// награды по дням
const DAILY_REWARDS = [10, 20, 40, 50, 60, 70, 100];

// 24ч таймер до доступности
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

// 24ч окно чтобы забрать (таймер НЕ показываем)
const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;

// новый ключ, чтобы старые данные не ломали награды
const STORAGE_KEY = "dailyBonusStateV3";

function nowMs() { return Date.now(); }

// state.index = индекс НАГРАДЫ, которую получишь при следующем клике "Забрать"
function loadDailyState() {
  // опционально: снести старый ключ, если он был
  try { localStorage.removeItem("dailyBonusStateV2"); } catch (_) {}

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { index: 0, lastClaimTs: 0 };

  try {
    const s = JSON.parse(raw);
    return {
      index: Math.max(0, Math.min(DAILY_REWARDS.length - 1, Number(s.index ?? 0))),
      lastClaimTs: Number(s.lastClaimTs ?? 0)
    };
  } catch {
    return { index: 0, lastClaimTs: 0 };
  }
}

function saveDailyState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// когда станет доступно после клима
function nextAvailableTs(state) {
  if (!state.lastClaimTs) return 0;              // если ещё не забирал — доступно сразу
  return state.lastClaimTs + COOLDOWN_MS;        // конец cooldown
}

// когда “сгорит” окно забрать и надо сбросить прогресс
function expireTs(state) {
  const a = nextAvailableTs(state);
  if (!a) return 0;
  return a + CLAIM_WINDOW_MS;
}

// 3 состояния: "cooldown" | "available" | "expired"
function dailyPhase(state) {
  if (!state.lastClaimTs) return "available";

  const now = nowMs();
  const a = nextAvailableTs(state);
  const e = expireTs(state);

  if (now < a) return "cooldown";   // таймер тикает
  if (now < e) return "available";  // можно забрать (без таймера)
  return "expired";                 // не забрал — сброс
}

// таймер показываем ТОЛЬКО на cooldown
function msLeft(state) {
  if (dailyPhase(state) !== "cooldown") return 0;
  return Math.max(0, nextAvailableTs(state) - nowMs());
}

function canClaim(state) {
  return dailyPhase(state) === "available";
}

function fmt(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function resetDailyProgress() {
  const reset = { index: 0, lastClaimTs: 0 };
  saveDailyState(reset);
  return reset;
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

    const left = Math.random() * 100;
    const dx = (Math.random() * 160 - 80).toFixed(0) + "px";
    const rot = (Math.random() * 540 - 270).toFixed(0) + "deg";

    p.style.left = left + "%";
    p.style.background = colors[(Math.random() * colors.length) | 0];
    p.style.setProperty("--dx", dx);
    p.style.setProperty("--rot", rot);
    p.style.animationDelay = (Math.random() * 0.25).toFixed(2) + "s";
    p.style.opacity = (0.6 + Math.random() * 0.4).toFixed(2);

    confettiLayer.appendChild(p);
  }

  setTimeout(() => { if (confettiLayer) confettiLayer.innerHTML = ""; }, 2000);
}

function renderTrack(state) {
  if (!dailyTrack) return;
  dailyTrack.innerHTML = "";

  for (let i = 0; i < DAILY_REWARDS.length; i++) {
    const dayNum = i + 1;
    const done = i < state.index;      // пройденные
    const active = i === state.index;  // текущая “следующая к получению”

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

function renderDailyUI() {
  let state = loadDailyState();
  let phase = dailyPhase(state);

  // если пропустил окно забрать — сброс
  if (phase === "expired") {
    state = resetDailyProgress();
    phase = dailyPhase(state); // станет available (день 1)
  }

  const available = (phase === "available");
  const reward = DAILY_REWARDS[state.index] ?? DAILY_REWARDS[0];

  // текущая награда (та, что дастся при нажатии "Забрать")
  if (elDailyReward) elDailyReward.textContent = `${reward} ₽`;

  // следующая награда (после успешного клима)
  const nextIdx = (state.index + 1) % DAILY_REWARDS.length;
  const nextReward = DAILY_REWARDS[nextIdx];
  if (elNextRewardValue) elNextRewardValue.textContent = `${nextReward} ₽`;
  if (elNextRewardSub) elNextRewardSub.textContent = `Следующая награда`;

  // кнопка
  if (elDailyAction) {
    elDailyAction.textContent = available ? "Забрать" : "Получено";
    elDailyAction.classList.toggle("disabled", !available);
  }
  if (dailyClaimBtn) dailyClaimBtn.disabled = !available;

  // таймер:
  // cooldown -> показываем
  // available -> НЕ показываем
  const timerText = (phase === "cooldown") ? fmt(msLeft(state)) : "";

  if (elDailyTimer) {
    elDailyTimer.textContent = timerText;
    elDailyTimer.style.display = (phase === "cooldown") ? "" : "none";
  }
  if (elModalTimer) {
    elModalTimer.textContent = timerText;
    elModalTimer.style.display = (phase === "cooldown") ? "" : "none";
  }
  if (elModalTimerBig) {
    elModalTimerBig.textContent = timerText;
    elModalTimerBig.style.display = (phase === "cooldown") ? "" : "none";
  }

  renderTrack(state);
}

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

function claimDailyBonus() {
  const state = loadDailyState();
  if (!canClaim(state)) return;

  const reward = DAILY_REWARDS[state.index] ?? DAILY_REWARDS[0];

  // фиксируем факт забора
  state.lastClaimTs = nowMs();
  state.index = (state.index + 1) % DAILY_REWARDS.length;
  saveDailyState(state);

  spawnConfetti();
  showToast(`✅ Ежедневный бонус получен! +${reward} ₽`);
  renderDailyUI();
}

// events
if (dailyBonusBtn) dailyBonusBtn.addEventListener("click", () => { haptic("light"); openDailyModal(); });
if (dailyModalClose) dailyModalClose.addEventListener("click", () => { haptic("light"); closeDailyModal(); });
if (dailyModal) dailyModal.addEventListener("click", (e) => {
  if (e.target && e.target.matches('[data-close="daily"]')) closeDailyModal();
});
if (dailyClaimBtn) dailyClaimBtn.addEventListener("click", () => { haptic("medium"); claimDailyBonus(); });

// тик таймера
setInterval(renderDailyUI, 1000);
renderDailyUI();

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