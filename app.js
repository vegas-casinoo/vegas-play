(function () {
  const tg = window.Telegram?.WebApp;

  // ========= HAPTIC =========
  function haptic(type = "light") {
    try { tg?.HapticFeedback?.impactOccurred?.(type); return; } catch (_) {}
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {}
  }

  // ========= DOM =========
  const elName = document.getElementById("name");
  const elBalance = document.getElementById("balance");
  const elTxList = document.getElementById("txList");
  const elDebug = document.getElementById("debug");

  const screens = Array.from(document.querySelectorAll(".screen"));
  const tabs = Array.from(document.querySelectorAll(".tab"));

  // ========= STATE =========
  let balance = 0;
  let currentUserId = null;

  let activeTab = (document.querySelector(".tab.active")?.dataset.tab) || "home";
  let switching = false;
  let switchingKillTimer = null;

  // ========= RENDER =========
  function money(v) {
    return `${Number(v || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
  }

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

  // ========= SWITCH PERF (важно для iOS WebView) =========
  function setSwitching(on) {
    if (on) {
      switching = true;
      document.body.classList.add("switching");
      if (switchingKillTimer) clearTimeout(switchingKillTimer);
      // страховка: если transitionend не прилетит
      switchingKillTimer = setTimeout(() => {
        document.body.classList.remove("switching");
        switching = false;
      }, 600);
    } else {
      document.body.classList.remove("switching");
      switching = false;
      if (switchingKillTimer) clearTimeout(switchingKillTimer);
      switchingKillTimer = null;
    }
  }

  function onceTransitionEnd(el, cb) {
    let called = false;
    const done = () => {
      if (called) return;
      called = true;
      el.removeEventListener("transitionend", onEnd);
      cb();
    };
    const onEnd = (e) => {
      // ловим только opacity/transform, а не все подряд
      if (e.propertyName === "opacity" || e.propertyName === "transform") done();
    };
    el.addEventListener("transitionend", onEnd);
    // страховка на случай если transitionend не сработал
    setTimeout(done, 420);
  }

  // ========= NAV =========
  function getScreen(tab) {
    return document.querySelector(`.screen[data-screen="${tab}"]`);
  }

  function getActiveScreen() {
    return document.querySelector(".screen.active");
  }

  function setActiveTabUI(tab) {
    tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  }

  function hardScrollTop() {
    // smooth в iOS webview часто режет FPS
    try { window.scrollTo(0, 0); } catch (_) {}
  }

  /**
   * Главный фикс лагов:
   * 1) включаем switching
   * 2) на следующем кадре меняем классы экранов
   * 3) выключаем switching по transitionend
   */
function setActiveTab(tab) {
  if (!tab || tab === activeTab) return;
  if (switching) return;

  const current = getActiveScreen();
  const next = getScreen(tab);
  if (!next || current === next) return;

  activeTab = tab;

  setSwitching(true);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setActiveTabUI(tab);

      // фикс высоты, чтобы не прыгало
      const content = document.querySelector(".content");
      if (content && current) {
        const h = current.getBoundingClientRect().height;
        content.style.minHeight = Math.max(0, Math.ceil(h)) + "px";
      }

      // 1) уводим текущий
      if (current) {
        current.classList.add("leaving");
        current.classList.remove("active");
      }

      hardScrollTop();

      // 2) ждём завершения ухода текущего → показываем следующий
      const afterLeave = () => {
        if (current) current.classList.remove("leaving");

        // теперь включаем следующий (он сам сыграет screenIn)
        next.classList.add("active");

        // отпускаем minHeight после появления нового
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (content) content.style.minHeight = "";

            // blur возвращаем уже после стабилизации
            requestAnimationFrame(() => {
              requestAnimationFrame(() => setSwitching(false));
            });
          });
        });
      };

      if (current) {
        onceTransitionEnd(current, afterLeave);
      } else {
        // если вдруг текущего нет — просто показываем
        afterLeave();
      }
    });
  });
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
    const res = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();

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

    const getRes = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", currentUserId)
      .single();

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

    const txRes = await supabase
      .from("transactions")
      .insert({ user_id: currentUserId, type: "test_credit", amount: 100 });

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

    // Tabs
    const tabBtn = t.closest(".tab");
    if (tabBtn) {
      haptic("light");
      setActiveTab(tabBtn.dataset.tab);
      return;
    }

    // Quick buttons
    if (t.closest("#promoBtn")) {
      haptic("light");
      alert("Промокод (скоро)");
      return;
    }
    if (t.closest("#depositQuickBtn") || t.closest("#withdrawQuickBtn")) {
      haptic("light");
      setActiveTab("wallet");
      return;
    }

    // Game cards
    const gameBtn = t.closest(".gameCard");
    if (gameBtn) {
      haptic("medium");
      alert(`Открыть игру: ${gameBtn.dataset.game} (пока заглушка)`);
      return;
    }

    // Wallet buttons
    if (t.closest("#depositBtn") || t.closest("#walletHeroDeposit")) {
      haptic("light");
      alert("Пополнение (пока заглушка). Позже подключим провайдера и webhook.");
      return;
    }
    if (t.closest("#withdrawBtn") || t.closest("#walletHeroWithdraw")) {
      haptic("light");
      alert("Вывод (пока заглушка). Позже подключим KYC/лимиты и провайдера.");
      return;
    }

    // Test +100
    if (t.closest("#testPlus100Btn")) {
      haptic("light");
      testAdd100();
      return;
    }

    // Spin
    if (t.closest("#spinBtn")) {
      haptic("light");
      alert("Колесо фортуны (пока заглушка)");
      return;
    }

    // Close
    if (t.closest("#closeBtn")) {
      haptic("light");
      if (tg) tg.close();
      else alert("Закрытие доступно только внутри Telegram");
      return;
    }

    if (t.closest("button")) haptic("light");
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

    if (user) {
      currentUserId = user.id;
      if (elName) elName.textContent = [user.first_name, user.last_name].filter(Boolean).join(" ");

      (async () => {
        try {
          await upsertUser(user);
          await loadBalance(user.id);
          await loadTransactions(user.id);
          if (elDebug) elDebug.textContent += "\n\n✅ Supabase OK";
        } catch (e) {
          if (elDebug) elDebug.textContent += "\n\n❌ " + (e?.message || String(e));
        }
      })();
    }
  }

  // ========= BOOT =========
  // выставим начальный таб корректно
  setActiveTabUI(activeTab);
  screens.forEach(s => s.classList.toggle("active", s.dataset.screen === activeTab));
  renderBalance();
  initTelegram();
})();