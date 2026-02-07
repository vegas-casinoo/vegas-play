let wheelOverlay;
let wheel;
let spinBtn;
let spinning = false;

function openWheel() {
  if (!wheelOverlay) {
    fetch("/wheel/wheel.html")
      .then(r => r.text())
      .then(html => {
        document.body.insertAdjacentHTML("beforeend", html);
        initWheel();
        openWheel();
      });
    return;
  }

  wheelOverlay.classList.add("open");
}

function closeWheel() {
  wheelOverlay.classList.remove("open");
}

function initWheel() {
  wheelOverlay = document.getElementById("wheelOverlay");
  wheel = document.getElementById("wheel");
  spinBtn = document.getElementById("wheelSpinBtn");

  document.getElementById("wheelClose").onclick = closeWheel;
  wheelOverlay.onclick = (e) => {
    if (e.target === wheelOverlay) closeWheel();
  };

  spinBtn.onclick = spinWheel;
}

function spinWheel() {
  if (spinning) return;
  spinning = true;

  const angle = 360 * 5 + Math.floor(Math.random() * 360);
  wheel.style.transform = `rotate(${angle}deg)`;

  setTimeout(() => {
    spinning = false;
    alert("Тут будет результат + анимации");
  }, 3600);
}

// делаем глобально доступным
window.openWheel = openWheel;