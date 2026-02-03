(function () {
  const tg = window.Telegram?.WebApp;

  const elName = document.getElementById("name");
  const elBalance = document.getElementById("balance");
  const elDebug = document.getElementById("debug");
  const closeBtn = document.getElementById("closeBtn");

  // Баланс по умолчанию (потом подтянем из Supabase)
  let balance = 0;

  function render() {
    if (!elBalance) return;
    elBalance.textContent =
      `${balance.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
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

  function setActiveTab(tab) {
    document.querySelectorAll(".tab").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
  }

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
      if (elName) {
        elName.textContent = [user.first_name, user.last_name].filter(Boolean).join(" ");
      }

      // Важно: сначала upsert, потом loadBalance
      (async () => {
        try {
          await upsertUser(user);
          if (elDebug) elDebug.textContent += "\n\n✅ Saved to Supabase (users + wallets)";
          await loadBalance(user.id);
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

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  document.querySelectorAll(".gameCard").forEach((btn) => {
    btn.addEventListener("click", () => {
      alert(`Открыть игру: ${btn.dataset.game} (пока заглушка)`);
    });
  });

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

  const spinBtn = document.getElementById("spinBtn");
  if (spinBtn) {
    spinBtn.addEventListener("click", () => {
      alert("Колесо фортуны (пока заглушка)");
    });
  }
})();