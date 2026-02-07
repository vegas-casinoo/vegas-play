// wheel/wheel.js

let wheelModal = null;
let wheelCircle = null;
let spinBtn = null;
let closeBtn = null;
let backdrop = null;

let spinning = false;

// открыть модалку (и при первом запуске подгрузить wheel.html)
function openWheel() {
  // если модалки ещё нет в DOM — подгружаем wheel.html
  wheelModal = document.getElementById("wheelModal");

  if (!wheelModal) {
    fetch("/wheel/wheel.html")
      .then(r => r.text())
      .then(html => {
        document.body.insertAdjacentHTML("beforeend", html);
        initWheel();
        openWheel(); // повторно откроем после инициализации
      })
      .catch(() => alert("❌ wheel.html не найден по пути /wheel/wheel.html"));
    return;
  }

  wheelModal.classList.add("open");
  wheelModal.setAttribute("aria-hidden", "false");
}

function closeWheel() {
  if (!wheelModal) return;
  wheelModal.classList.remove("open");
  wheelModal.setAttribute("aria-hidden", "true");
}

function initWheel() {
  wheelModal  = document.getElementById("wheelModal");
  backdrop   = document.getElementById("wheelBackdrop");
  wheelCircle = document.getElementById("wheelCircle");
  spinBtn    = document.getElementById("wheelSpinMain");
  closeBtn   = document.getElementById("wheelClose");

  if (!wheelModal || !wheelCircle || !spinBtn || !closeBtn || !backdrop) {
    console.error("Wheel init failed:", {
      wheelModal, wheelCircle, spinBtn, closeBtn, backdrop
    });
    alert("❌ Wheel init failed: проверь wheel.html id");
    return;
  }

  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeWheel();
  });

  backdrop.addEventListener("click", () => {
    closeWheel();
  });

  spinBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    spinWheel();
  });
}

function spinWheel() {
  if (spinning) return;
  spinning = true;

  // пока просто "крутилка"
  const angle = 360 * 6 + Math.floor(Math.random() * 360);
  wheelCircle.style.transition = "transform 3.6s cubic-bezier(.15,.85,.2,1)";
  wheelCircle.style.transform = `rotate(${angle}deg)`;

  setTimeout(() => {
    spinning = false;
    alert("🎉 Тут будет результат + анимации");
  }, 3600);
}

// делаем глобально доступным
window.openWheel = openWheel;
window.closeWheel = closeWheel;