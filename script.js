const ITEMS = {
  stack20: { name: "20 Stack’d", price: 10 },
  stack25: { name: "25 Stack’d", price: 12 },
  stack30: { name: "30 Stack’d", price: 15 },
  your20: { name: "20 Your Way", price: 8 },
  your25: { name: "25 Your Way", price: 10 },
  your30: { name: "30 Your Way", price: 12 },
  bitestack: { name: "Bite Stack 10", price: 5 },
  dubai: { name: "Dubai Strawberries", price: 12 }
};

const ITEM_IDS = Object.keys(ITEMS);
const STORAGE_KEY = "miniPancakePosStateV2";
const tapSound = new Audio("sounds/tap.mp3");
tapSound.preload = "auto";

let state = loadState();

function createEmptyCounts() {
  const counts = {};
  ITEM_IDS.forEach((id) => {
    counts[id] = 0;
  });
  return counts;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return {
      todaySold: createEmptyCounts(),
      currentOrder: createEmptyCounts(),
      todayCash: 0,
      todayDigital: 0,
      history: [],
      actionStack: []
    };
  }

  const saved = JSON.parse(raw);

  return {
    todaySold: { ...createEmptyCounts(), ...(saved.todaySold || {}) },
    currentOrder: { ...createEmptyCounts(), ...(saved.currentOrder || {}) },
    todayCash: Number(saved.todayCash) || 0,
    todayDigital: Number(saved.todayDigital) || 0,
    history: Array.isArray(saved.history) ? saved.history : [],
    actionStack: Array.isArray(saved.actionStack) ? saved.actionStack : []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatMoney(amount) {
  return `$${amount.toFixed(2)}`;
}

function getTodayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayLabel() {
  return new Date().toLocaleDateString();
}

function getOrderSubtotal() {
  return ITEM_IDS.reduce((sum, id) => {
    return sum + state.currentOrder[id] * ITEMS[id].price;
  }, 0);
}

function getOrderItemCount() {
  return ITEM_IDS.reduce((sum, id) => sum + state.currentOrder[id], 0);
}

function getTodaySales() {
  return state.todayCash + state.todayDigital;
}

function getTodayItems() {
  return ITEM_IDS.reduce((sum, id) => sum + state.todaySold[id], 0);
}

function playTapSound() {
  tapSound.currentTime = 0;
  tapSound.play().catch(() => {});
}

function vibrateTap() {
  if ("vibrate" in navigator) {
    navigator.vibrate(25);
  }
}

function showFloatMoney(tileEl, amount) {
  const bubble = document.createElement("div");
  bubble.className = "float-money";
  bubble.textContent = `+$${amount}`;
  tileEl.appendChild(bubble);

  setTimeout(() => {
    bubble.remove();
  }, 900);
}

function animateTile(tileEl) {
  tileEl.classList.remove("pop");
  void tileEl.offsetWidth;
  tileEl.classList.add("pop");
}

function renderOrderList() {
  const orderList = document.getElementById("orderList");
  const subtotal = getOrderSubtotal();

  if (subtotal === 0) {
    orderList.innerHTML = `<div class="empty-order"><span>No items yet</span><span>Tap a box</span></div>`;
    return;
  }

  const rows = ITEM_IDS
    .filter((id) => state.currentOrder[id] > 0)
    .map((id) => {
      const qty = state.currentOrder[id];
      const total = qty * ITEMS[id].price;
      return `
        <div class="order-item-row">
          <span>${ITEMS[id].name} x${qty}</span>
          <strong>${formatMoney(total)}</strong>
        </div>
      `;
    })
    .join("");

  orderList.innerHTML = rows;
}

function renderWeeklyStats() {
  const weekEntries = getLast7DaysEntries();
  const weeklySales = weekEntries.reduce((sum, entry) => sum + (entry.grandTotal || 0), 0);

  const aggregate = {};
  ITEM_IDS.forEach((id) => {
    aggregate[id] = 0;
  });

  weekEntries.forEach((entry) => {
    ITEM_IDS.forEach((id) => {
      aggregate[id] += Number(entry.itemCounts?.[id] || 0);
    });
  });

  let bestId = null;
  let bestCount = 0;

  ITEM_IDS.forEach((id) => {
    if (aggregate[id] > bestCount) {
      bestCount = aggregate[id];
      bestId = id;
    }
  });

  document.getElementById("weeklySales").textContent = formatMoney(weeklySales);
  document.getElementById("weeklyTopSeller").textContent =
    bestId && bestCount > 0 ? `${ITEMS[bestId].name} (${bestCount})` : "None yet";
}

function getLast7DaysEntries() {
  const entries = [...state.history];
  const todayKey = getTodayKey();
  const hasTodaySaved = entries.some((entry) => entry.dateKey === todayKey);

  if (!hasTodaySaved && getTodaySales() > 0) {
    entries.push(buildDaySummary(false));
  }

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 6);

  return entries.filter((entry) => {
    const entryDate = new Date(entry.dateKey + "T00:00:00");
    return entryDate >= cutoff;
  });
}

function renderHistory() {
  const historyList = document.getElementById("historyList");

  if (state.history.length === 0) {
    historyList.innerHTML = "<p>No saved days yet.</p>";
    return;
  }

  const newestFirst = [...state.history].reverse();

  historyList.innerHTML = newestFirst
    .map((day) => {
      const itemLines = ITEM_IDS
        .filter((id) => (day.itemCounts?.[id] || 0) > 0)
        .map((id) => {
          const qty = day.itemCounts[id];
          const sales = qty * ITEMS[id].price;
          return `<p>${ITEMS[id].name}: ${qty} (${formatMoney(sales)})</p>`;
        })
        .join("");

      return `
        <div class="history-entry">
          <h3>${day.displayDate}</h3>
          ${itemLines || "<p>No items</p>"}
          <p><strong>Cash:</strong> ${formatMoney(day.cash)}</p>
          <p><strong>Digital:</strong> ${formatMoney(day.digital)}</p>
          <p><strong>Total Items:</strong> ${day.totalItems}</p>
          <p><strong>Total Sales:</strong> ${formatMoney(day.grandTotal)}</p>
        </div>
      `;
    })
    .join("");
}

function updateScreen() {
  ITEM_IDS.forEach((id) => {
    document.getElementById(`${id}Sold`).textContent = state.todaySold[id];
  });

  document.getElementById("orderItems").textContent = getOrderItemCount();
  document.getElementById("orderSubtotal").textContent = formatMoney(getOrderSubtotal());
  document.getElementById("todaySales").textContent = formatMoney(getTodaySales());
  document.getElementById("cashTotal").textContent = formatMoney(state.todayCash);
  document.getElementById("digitalTotal").textContent = formatMoney(state.todayDigital);
  document.getElementById("todayItems").textContent = getTodayItems();
  document.getElementById("todayDate").textContent = getTodayLabel();

  renderOrderList();
  renderWeeklyStats();
  renderHistory();
}

function addItem(itemId, tileEl) {
  state.currentOrder[itemId] += 1;
  state.actionStack.push(itemId);

  playTapSound();
  vibrateTap();
  animateTile(tileEl);
  showFloatMoney(tileEl, ITEMS[itemId].price);

  saveState();
  updateScreen();
}

function undoLastTap() {
  const last = state.actionStack.pop();

  if (!last) {
    alert("Nothing to undo.");
    return;
  }

  if (state.currentOrder[last] > 0) {
    state.currentOrder[last] -= 1;
  }

  saveState();
  updateScreen();
}

function clearCurrentOrder() {
  const subtotal = getOrderSubtotal();

  if (subtotal === 0) {
    return;
  }

  const confirmClear = confirm("Clear the current order?");
  if (!confirmClear) {
    return;
  }

  state.currentOrder = createEmptyCounts();
  state.actionStack = [];

  saveState();
  updateScreen();
}

function finalizeOrder(cashAmount, digitalAmount) {
  const subtotal = getOrderSubtotal();

  if (subtotal === 0) {
    alert("Tap items first.");
    return;
  }

  if (cashAmount < 0 || digitalAmount < 0) {
    alert("Payment amounts can't be negative.");
    return;
  }

  const combined = cashAmount + digitalAmount;
  if (Math.abs(combined - subtotal) > 0.009) {
    alert(`Payments must equal ${formatMoney(subtotal)}.`);
    return;
  }

  ITEM_IDS.forEach((id) => {
    state.todaySold[id] += state.currentOrder[id];
  });

  state.todayCash += cashAmount;
  state.todayDigital += digitalAmount;

  state.currentOrder = createEmptyCounts();
  state.actionStack = [];

  saveState();
  updateScreen();
}

function checkoutOrder(method) {
  const subtotal = getOrderSubtotal();

  if (subtotal === 0) {
    alert("Tap items first.");
    return;
  }

  if (method === "cash") {
    finalizeOrder(subtotal, 0);
  } else {
    finalizeOrder(0, subtotal);
  }
}

function splitPaymentHalf() {
  const subtotal = getOrderSubtotal();

  if (subtotal === 0) {
    alert("Tap items first.");
    return;
  }

  const halfCash = Number((subtotal / 2).toFixed(2));
  const halfDigital = Number((subtotal - halfCash).toFixed(2));

  finalizeOrder(halfCash, halfDigital);
}

function splitPaymentCustom() {
  const subtotal = getOrderSubtotal();

  if (subtotal === 0) {
    alert("Tap items first.");
    return;
  }

  const input = prompt(`Order total is ${formatMoney(subtotal)}.\nEnter CASH amount:`);

  if (input === null) {
    return;
  }

  const cashAmount = Number(input);

  if (Number.isNaN(cashAmount)) {
    alert("Enter a valid number.");
    return;
  }

  if (cashAmount < 0 || cashAmount > subtotal) {
    alert(`Cash amount must be between $0 and ${subtotal.toFixed(2)}.`);
    return;
  }

  const digitalAmount = Number((subtotal - cashAmount).toFixed(2));

  finalizeOrder(Number(cashAmount.toFixed(2)), digitalAmount);
}

function buildDaySummary(useDisplayLabel = true) {
  const itemCounts = {};
  ITEM_IDS.forEach((id) => {
    itemCounts[id] = state.todaySold[id];
  });

  return {
    dateKey: getTodayKey(),
    displayDate: useDisplayLabel ? getTodayLabel() : getTodayLabel(),
    cash: state.todayCash,
    digital: state.todayDigital,
    totalItems: getTodayItems(),
    grandTotal: getTodaySales(),
    itemCounts
  };
}

function launchConfetti() {
  const container = document.getElementById("confettiContainer");
  const colors = ["#ff6fa5", "#ffd166", "#7bd389", "#7aa7ff", "#ffffff"];

  for (let i = 0; i < 70; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = `${1100 + Math.random() * 700}ms`;
    piece.style.transform = `translateY(0) rotate(${Math.random() * 180}deg)`;
    container.appendChild(piece);

    setTimeout(() => {
      piece.remove();
    }, 2000);
  }
}

function saveDay() {
  if (getOrderSubtotal() > 0) {
    const continueSave = confirm("You still have items in the current order. Save the day anyway?");
    if (!continueSave) {
      return;
    }
  }

  if (getTodaySales() === 0) {
    alert("No finished sales to save yet.");
    return;
  }

  const todaySummary = buildDaySummary();
  state.history = state.history.filter((entry) => entry.dateKey !== todaySummary.dateKey);
  state.history.push(todaySummary);

  state.todaySold = createEmptyCounts();
  state.currentOrder = createEmptyCounts();
  state.todayCash = 0;
  state.todayDigital = 0;
  state.actionStack = [];

  saveState();
  updateScreen();
  launchConfetti();

  alert("Day saved and reset for tomorrow.");
}

function resetDay() {
  const confirmReset = confirm("Reset today's sales and current order without saving?");
  if (!confirmReset) {
    return;
  }

  state.todaySold = createEmptyCounts();
  state.currentOrder = createEmptyCounts();
  state.todayCash = 0;
  state.todayDigital = 0;
  state.actionStack = [];

  saveState();
  updateScreen();
}

updateScreen();
