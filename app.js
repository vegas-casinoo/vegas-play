(function () {
  const tg = window.Telegram?.WebApp;

  const elName = document.getElementById("name");
  const elBalance = document.getElementById("balance");
  const elDebug = document.getElementById("debug");
  const closeBtn = document.getElementById("closeBtn");

  // Мок-баланс для старта UI
  let balance = 12682.10;

  function render() {
    elBalance.textContent = `${balance.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
  }
  
  const SUPABASE_URL = "https://XXXX.supabase.co";
const SUPABASE_ANON_KEY = "XXXX";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

  function setActiveTab(tab) {
    document.querySelectorAll(".tab").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
  }

  // Telegram init
  if (tg) {
    tg.ready();
    tg.expand();

    const user = tg.initDataUnsafe?.user;
    if (user) {
      elName.textContent = [user.first_name, user.last_name].filter(Boolean).join(" ");
    }

    elDebug.textContent = JSON.stringify(
      {
        platform: tg.platform,
        version: tg.version,
        user: tg.initDataUnsafe?.user || null,
        initDataLength: (tg.initData || "").length
      },
      null,
      2
    );
  } else {
    elDebug.textContent =
      "Открой через Telegram Mini App, чтобы появился window.Telegram.WebApp";
  }

  render();

  closeBtn.addEventListener("click", () => {
    if (tg) tg.close();
    else alert("Закрытие доступно только внутри Telegram");
  });

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  document.querySelectorAll(".gameCard").forEach((btn) => {
    btn.addEventListener("click", () => {
      alert(`Открыть игру: ${btn.dataset.game} (пока заглушка)`);
    });
  });

  document.getElementById("depositBtn").addEventListener("click", () => {
    alert("Пополнение (пока заглушка). Позже подключим провайдера и webhook.");
  });

  document.getElementById("withdrawBtn").addEventListener("click", () => {
    alert("Вывод (пока заглушка). Позже подключим KYC/лимиты и провайдера.");
  });

  document.getElementById("spinBtn").addEventListener("click", () => {
    alert("Колесо фортуны (пока заглушка)");
  });
})();