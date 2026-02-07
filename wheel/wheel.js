// wheel/wheel.js

let wheelModal, wheelCircle, spinBtn, closeBtn, backdrop;
let spinning = false;

function bindWheelDom() {
  wheelModal   = document.getElementById("wheelModal");
  wheelCircle  = document.getElementById("wheelCircle");
  spinBtn      = document.getElementById("wheelSpinMain");
  closeBtn     = document.getElementById("wheelClose");
  backdrop     = document.getElementById("wheelBackdrop");
}

function ensureWheelInjected() {
  bindWheelDom();
  if (wheelModal) return Promise.resolve(true);

  return fetch("/wheel/wheel.html")
    .then(r => {
      if (!r.ok) throw new Error("wheel.html not found");
      return r.text();
    })
    .then(html => {
      document.body.insertAdjacentHTML("beforeend", html);
      bindWheelDom();

      if (!wheelModal) throw new Error("wheelModal missing after inject");

      // кнопки закрытия
      closeBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeWheel();
      });

      backdrop?.addEventListener("click", () => closeWheel());

      // кнопка крутить в модалке
      spinBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        spinWheel();
      });

      return true;
    })
    .catch(err => {
      alert("❌ Колесо: не могу загрузить /wheel/wheel.html");
      console.error(err);
      return false;
    });
}

function openWheel() {
  ensureWheelInjected().then(ok => {
    if (!ok) return;
    wheelModal.classList.add("open");
    wheelModal.setAttribute("aria-hidden", "false");
  });
}

function closeWheel() {
  if (!wheelModal) return;
  wheelModal.classList.remove("open");
  wheelModal.setAttribute("aria-hidden", "true");
}

function spinWheel() {
  if (!wheelCircle || spinning) return;
  spinning = true;

  const angle = 360 * 6 + Math.floor(Math.random() * 360);
  wheelCircle.style.transition = "transform 3.6s cubic-bezier(.15,.85,.2,1)";
  wheelCircle.style.transform = `rotate(${angle}deg)`;

  setTimeout(() => {
    spinning = false;
    alert("🎉 Тут будет результат + анимации");
  }, 3600);
}

// экспортируем глобально (если захочешь дергать из app.js)
window.openWheel = openWheel;
window.closeWheel = closeWheel;

// ВАЖНО: вешаем клики на карточку и кнопку в карточке САМИ
document.addEventListener("click", (e) => {
  const t = e.target;

  // карточка целиком
  if (t.closest("#wheelOpenBtn")) {
    // если кликнули по "Крутить" внутри — тоже ок
    openWheel();
    return;
  }

  // на всякий: если где-то отдельно есть wheelSpinBtn
  if (t.closest("#wheelSpinBtn")) {
    e.preventDefault();
    e.stopPropagation();
    openWheel();
    return;
  }
});