(function () {
  const tg = window.Telegram?.WebApp;
  
  function haptic(type = "light") {
  try { tg?.HapticFeedback?.impactOccurred?.(type); return; } catch (_) {}
  try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {}
}


  const elName = document.getElementById("name");
  const elBalance = document.getElementById("balance");
  const elTxList = document.getElementById("txList");
  const elDebug = document.getElementById("debug");
  const closeBtn = document.getElementById("closeBtn");

  // Баланс по умолчанию (потом подтянем из Supabase)
  let balance = 0;
  let currentUserId = null;

  function render() {
    if (!elBalance) return;
    elBalance.textContent =
      `${balance.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
      
      const heroAmount = document.getElementById("walletHeroAmount");
if (heroAmount) {
  heroAmount.textContent =
    `${balance.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}
  }
  
  function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
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
          ${sign}${amt.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
        </div>
      </div>
    `;
  }).join("");
}
  
  // --- Supabase init ---
  const SUPABASE_URL = "https://gtwozscjklqzegiwzqss.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0d296c2Nqa2xxemVnaXd6cXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTIxMTUsImV4cCI6MjA4NTY4ODExNX0.yLr6jAl13KuA1OzHrnMkX4VAKH6l40fFVqNik6uBlP4";

  if (!window.supabase) {
    if (elDebug) {
      elDebug.textContent =
        "❌ Supabase SDK не подключён. Проверь, что в index.html есть:\n" +
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

    if (r1.error) {
      throw new Error("USERS UPSERT ERROR: " + JSON.stringify(r1.error));
    }

    const r2 = await supabase.from("wallets").upsert({
      user_id: tgUser.id
    });

    if (r2.error) {
      throw new Error("WALLETS UPSERT ERROR: " + JSON.stringify(r2.error));
    }

    return true;
  }

  async function loadBalance(userId) {
    const res = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (res.error) {
      if (elDebug) {
        elDebug.textContent +=
          "\n\n❌ LOAD BALANCE ERROR:\n" + JSON.stringify(res.error, null, 2);
      }
      return;
    }

    balance = Number(res.data?.balance || 0);
    render();

    if (elDebug) {
      elDebug.textContent += "\n\n✅ Balance loaded: " + balance;
    }
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
  if (!currentUserId) {
    if (elDebug) elDebug.textContent += "\n\n❌ No currentUserId yet";
    return;
  }

  // 1) получаем текущий баланс
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

  // 2) обновляем баланс
  const updRes = await supabase
    .from("wallets")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", currentUserId);

  if (updRes.error) {
    if (elDebug) elDebug.textContent += "\n\n❌ UPDATE WALLET ERROR:\n" + JSON.stringify(updRes.error, null, 2);
    return;
  }

await loadTransactions(currentUserId);

  // 3) пишем транзакцию (type можно назвать как угодно)
  const txRes = await supabase
    .from("transactions")
    .insert({
      user_id: currentUserId,
      type: "test_credit",
      amount: 100
    });

  if (txRes.error) {
    if (elDebug) elDebug.textContent += "\n\n❌ INSERT TX ERROR:\n" + JSON.stringify(txRes.error, null, 2);
    // баланс уже обновили — не критично, просто логируем
  }

  // 4) обновляем UI
  balance = newBalance;
  render();
  if (elDebug) elDebug.textContent += "\n\n✅ +100 added. New balance: " + newBalance;
}

function setActiveTab(tab) {
  const current = document.querySelector(".screen.active");
  const next = document.querySelector(`.screen[data-screen="${tab}"]`);
  if (!next || current === next) return;

  // табы
  document.querySelectorAll(".tab").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });

  // плавный уход
  if (current) {
    current.classList.add("leaving");
    current.classList.remove("active");
    setTimeout(() => current.classList.remove("leaving"), 190);
  }

  // плавный вход
  next.classList.add("active");

document.body.classList.add("switching");
setTimeout(() => document.body.classList.remove("switching"), 220);

window.scrollTo(0, 0);
}

// Один обработчик на все клики по кнопкам
let __lastTap = 0;

document.addEventListener("click", (e) => {
  // анти-дубль клика (iOS/webview иногда даёт двойной)
  const now = Date.now();
  if (now - __lastTap < 350) return;
  __lastTap = now;

  const tabBtn = e.target.closest(".tab");
  if (tabBtn) {
    haptic("light");
    setActiveTab(tabBtn.dataset.tab);
    return;
  }

  const gameBtn = e.target.closest(".gameCard");
  if (gameBtn) {
    haptic("medium");
    alert(`Открыть игру: ${gameBtn.dataset.game} (пока заглушка)`);
    return;
  }

  const promoBtn = e.target.closest("#promoBtn");
  if (promoBtn) {
    haptic("light");
    alert("Промокод (скоро)");
    return;
  }

  const depQuick = e.target.closest("#depositQuickBtn");
  const wdQuick = e.target.closest("#withdrawQuickBtn");
  if (depQuick || wdQuick) {
    haptic("light");
    setActiveTab("wallet");
    return;
  }

  const anyBtn = e.target.closest("button");
  if (anyBtn) haptic("light");
});

  // --- Telegram init ---
  if (tg) {
    tg.ready();
    tg.expand();

    const user = tg.initDataUnsafe?.user;

    if (elDebug) {
      elDebug.textContent = JSON.stringify(
        {
          platform: tg.platform,
          version: tg.version,
          user: user || null,
          initDataLength: (tg.initData || "").length
        },
        null,
        2
      );
    }

    if (user) {
      currentUserId = user.id;
      if (elName) {
        elName.textContent = [user.first_name, user.last_name].filter(Boolean).join(" ");
      }

      // Важно: сначала upsert, потом loadBalance
      (async () => {
        try {
          await upsertUser(user);
          if (elDebug) elDebug.textContent += "\n\n✅ Saved to Supabase (users + wallets)";
          await loadBalance(user.id);
          await loadTransactions(user.id);
        } catch (e) {
          if (elDebug) elDebug.textContent += "\n\n❌ " + (e?.message || String(e));
        }
      })();
    }
  } else {
    if (elDebug) {
      elDebug.textContent =
        "Открой через Telegram Mini App, чтобы появился window.Telegram.WebApp";
    }
  }

  render();

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (tg) tg.close();
      else alert("Закрытие доступно только внутри Telegram");
    });
  }

  const depositBtn = document.getElementById("depositBtn");
  if (depositBtn) {
    depositBtn.addEventListener("click", () => {
      alert("Пополнение (пока заглушка). Позже подключим провайдера и webhook.");
    });
  }

  const withdrawBtn = document.getElementById("withdrawBtn");
  if (withdrawBtn) {
    withdrawBtn.addEventListener("click", () => {
      alert("Вывод (пока заглушка). Позже подключим KYC/лимиты и провайдера.");
    });
  }
  
  const walletHeroDeposit = document.getElementById("walletHeroDeposit");
if (walletHeroDeposit) {
  walletHeroDeposit.addEventListener("click", () => {
    haptic("light");
    alert("Пополнение (пока заглушка). Позже подключим провайдера и webhook.");
  });
}

const walletHeroWithdraw = document.getElementById("walletHeroWithdraw");
if (walletHeroWithdraw) {
  walletHeroWithdraw.addEventListener("click", () => {
    haptic("light");
    alert("Вывод (пока заглушка). Позже подключим KYC/лимиты и провайдера.");
  });
}
  
  const testPlus100Btn = document.getElementById("testPlus100Btn");
if (testPlus100Btn) {
  testPlus100Btn.addEventListener("click", () => {
    testAdd100();
  });
}

  const spinBtn = document.getElementById("spinBtn");
  if (spinBtn) {
    spinBtn.addEventListener("click", () => {
      alert("Колесо фортуны (пока заглушка)");
    });
  }
  
  ["spinBtn","depositBtn","withdrawBtn","testPlus100Btn","promoBtn","depositQuickBtn","withdrawQuickBtn"].forEach(id=>{
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", ()=> haptic("light"));
});
  
  const promoBtn = document.getElementById("promoBtn");
if (promoBtn) promoBtn.addEventListener("click", () => alert("Промокод (скоро)"));

const depositQuickBtn = document.getElementById("depositQuickBtn");
if (depositQuickBtn) depositQuickBtn.addEventListener("click", () => setActiveTab("wallet"));

const withdrawQuickBtn = document.getElementById("withdrawQuickBtn");
if (withdrawQuickBtn) withdrawQuickBtn.addEventListener("click", () => setActiveTab("wallet"));
})();
