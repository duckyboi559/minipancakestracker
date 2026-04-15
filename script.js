import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  remove,
  onValue,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMhniu1SEmiIWoXzwJy6zVSOZkHELhfLc",
  authDomain: "family-sales.firebaseapp.com",
  databaseURL: "https://family-sales-default-rtdb.firebaseio.com",
  projectId: "family-sales",
  storageBucket: "family-sales.firebasestorage.app",
  messagingSenderId: "590845027956",
  appId: "1:590845027956:web:676df074fe6150e8d39321"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const STACKED_BUILDS = {
  "Classic #1": ["Strawberries", "Bananas", "Powder Sugar", "Syrup"],
  "Classic #2": ["Strawberries", "Bananas", "Lechera", "Nutella", "Powder Sugar"],
  "Churro Overload": ["Cinnamon Sugar", "Cajeta", "Lechera", "Strawberries"],
  "Oreo Banana Dulce": ["Bananas", "Oreos", "Cajeta", "Lechera"],
  "Dubai Chocolate": ["Strawberries", "Crushed Pistachio", "Pistachio Cream", "Chocolate Drizzle", "Kataifi"],
  "Oreo Overload": ["Oreos", "Lechera", "Nutella", "Strawberries"],
  "Tres Leches": ["Tres Leches", "Nutella", "Lechera", "Strawberries", "Pecans"],
  "S'mores": ["Hershey Syrup", "Graham Cracker", "Mini Marshmallows", "Chocolate Chunks"]
};

const TOPPINGS = [
  "Powder Sugar",
  "Almonds",
  "Mazapan",
  "Fruity Pebbles",
  "Oreos",
  "Coconut Flakes",
  "Pecans",
  "M&M's",
  "Sprinkles",
  "Chocolate Chips",
  "English Toffee Bits",
  "Crushed Pistachio",
  "Kataifi"
];

const DRIZZLES = [
  "Cajeta",
  "Lechera",
  "Nutella",
  "Syrup",
  "Strawberry",
  "Hershey",
  "Pistachio Cream",
  "Chocolate Drizzle",
  "Tres Leches"
];

const FRUITS = [
  "Strawberries",
  "Bananas"
];

let trackerState = {
  sales: {},
  days: {}
};

let draftItems = [];
let builder = { data: {} };
let editingDraftIndex = null;
let selectedHistoryDay = null;

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function escapeForSingleQuote(str) {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayLabel() {
  return new Date().toLocaleDateString();
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function topLabel(counts) {
  let best = "—";
  let bestCount = 0;

  Object.entries(counts || {}).forEach(([name, count]) => {
    if (count > bestCount) {
      best = `${name} (${count})`;
      bestCount = count;
    }
  });

  return bestCount ? best : "—";
}

function totalsFromSales(salesObject) {
  let cash = 0;
  let cashApp = 0;
  let applePay = 0;
  let square = 0;

  Object.values(salesObject || {}).forEach(sale => {
    if (sale.payment?.type === "cash") {
      cash += Number(sale.payment.total || 0);
    }
    if (sale.payment?.type === "digital") {
      if (sale.payment.method === "Cash App") cashApp += Number(sale.payment.total || 0);
      if (sale.payment.method === "Apple Pay") applePay += Number(sale.payment.total || 0);
      if (sale.payment.method === "Square") square += Number(sale.payment.total || 0);
    }
    if (sale.payment?.type === "split") {
      cash += Number(sale.payment.cashAmount || 0);
      if (sale.payment.digitalMethod === "Cash App") cashApp += Number(sale.payment.digitalAmount || 0);
      if (sale.payment.digitalMethod === "Apple Pay") applePay += Number(sale.payment.digitalAmount || 0);
      if (sale.payment.digitalMethod === "Square") square += Number(sale.payment.digitalAmount || 0);
    }
  });

  return {
    cash,
    cashApp,
    applePay,
    square,
    dayTotal: cash + cashApp + applePay + square
  };
}

function getCountsFromSales(salesObject) {
  const itemCounts = {};
  const builtCounts = {};

  Object.values(salesObject || {}).forEach(sale => {
    (sale.items || []).forEach(item => {
      const qty = Number(item.quantity || 0);
      itemCounts[item.name] = (itemCounts[item.name] || 0) + qty;

      if (item.builtName) {
        builtCounts[item.builtName] = (builtCounts[item.builtName] || 0) + qty;
      }
    });
  });

  return { itemCounts, builtCounts };
}

function choiceButtons(items, key, isMulti = false) {
  return `
    <div class="choice-grid">
      ${items.map(item => {
        const selected = isMulti
          ? (Array.isArray(builder.data[key]) && builder.data[key].includes(item))
          : builder.data[key] === item;

        const safe = escapeForSingleQuote(item);
        const cls = selected
          ? `choice-btn selected ${isMulti ? "multi-selected" : ""}`
          : "choice-btn";

        const click = isMulti
          ? `toggleBuilderArray('${key}', '${safe}')`
          : `setBuilderValue('${key}', '${safe}')`;

        return `<button type="button" class="${cls}" onclick="${click}">${item}</button>`;
      }).join("")}
    </div>
  `;
}

function renderScreen() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");

  document.getElementById("mainScreen").classList.toggle("hidden", view === "history");
  document.getElementById("historyScreen").classList.toggle("hidden", view !== "history");

  if (view === "history") {
    selectedHistoryDay = params.get("day") || null;
    renderHistoryScreen();
  } else {
    renderMainScreen();
  }
}

window.goHome = function () {
  history.pushState({}, "", window.location.pathname);
  renderScreen();
};

window.goHistory = function () {
  history.pushState({}, "", `${window.location.pathname}?view=history`);
  renderScreen();
};

window.selectHistoryDay = function (dayKey) {
  history.pushState({}, "", `${window.location.pathname}?view=history&day=${encodeURIComponent(dayKey)}`);
  renderScreen();
};

window.addEventListener("popstate", renderScreen);

window.startBuilder = function () {
  builder = { data: {} };
  editingDraftIndex = null;
  renderBuilder();
  renderReview();
};

window.clearBuilder = function () {
  builder = { data: {} };
  editingDraftIndex = null;
  renderBuilder();
  renderReview();
};

window.setBuilderValue = function (key, value) {
  builder.data[key] = value;
  renderBuilder();
  renderReview();
};

window.toggleBuilderArray = function (key, value) {
  if (!Array.isArray(builder.data[key])) builder.data[key] = [];
  const arr = builder.data[key];
  const idx = arr.indexOf(value);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(value);
  renderBuilder();
  renderReview();
};

function renderBuilder() {
  const el = document.getElementById("builderStage");
  if (!el) return;

  let html = `
    <h3>Jessica Menu</h3>
    <h4>1. Choose item</h4>
    ${choiceButtons([
      "Stack'd",
      "Your Way",
      "Bite Stack",
      "Dubai Strawberries"
    ], "itemType")}
  `;

  const type = builder.data.itemType;

  if (type === "Stack'd") {
    html += `
      <h4>2. Size</h4>
      ${choiceButtons(["20 Minis", "25 Minis", "30 Minis"], "stackedSize")}
    `;
    if (builder.data.stackedSize) {
      html += `
        <h4>3. Choose Build</h4>
        ${choiceButtons(Object.keys(STACKED_BUILDS), "stackedBuild")}
      `;
      if (builder.data.stackedBuild) {
        html += `
          <h4>Ingredients</h4>
          <div class="review-card">
            ${STACKED_BUILDS[builder.data.stackedBuild].map(i => `<p>${i}</p>`).join("")}
          </div>
        `;
      }
      html += `
        <h4>4. Quantity</h4>
        ${choiceButtons(["1", "2", "3", "4"], "quantity")}
      `;
    }
  }

  if (type === "Your Way") {
    html += `
      <h4>2. Size</h4>
      ${choiceButtons(["20 Minis", "25 Minis", "30 Minis"], "yourWaySize")}
    `;
    if (builder.data.yourWaySize) {
      html += `
        <h4>3. Toppings</h4>
        ${choiceButtons(TOPPINGS, "yourWayToppings", true)}
        <h4>4. Drizzles</h4>
        ${choiceButtons(DRIZZLES, "yourWayDrizzles", true)}
        <h4>5. Fruits</h4>
        ${choiceButtons(FRUITS, "yourWayFruits", true)}
        <h4>6. Quantity</h4>
        ${choiceButtons(["1", "2", "3", "4"], "quantity")}
        <p class="helper">No hard limit. Tap as many as needed.</p>
      `;
    }
  }

  if (type === "Bite Stack") {
    html += `
      <h4>2. Toppings</h4>
      ${choiceButtons(TOPPINGS, "biteToppings", true)}
      <h4>3. Drizzles</h4>
      ${choiceButtons(DRIZZLES, "biteDrizzles", true)}
      <h4>4. Fruits</h4>
      ${choiceButtons(FRUITS, "biteFruits", true)}
      <h4>5. Quantity</h4>
      ${choiceButtons(["1", "2", "3", "4"], "quantity")}
      <p class="helper">No hard limit. Tap as many as needed.</p>
    `;
  }

  if (type === "Dubai Strawberries") {
    html += `
      <h4>2. Included</h4>
      <div class="review-card">
        <p>Strawberries</p>
        <p>Pistachio Cream</p>
        <p>Chocolate Drizzle</p>
        <p>Kataifi</p>
        <p>Crushed Pistachio</p>
      </div>
      <h4>3. Quantity</h4>
      ${choiceButtons(["1", "2", "3", "4"], "quantity")}
    `;
  }

  el.innerHTML = html;
}

function buildPreviewItem() {
  const d = builder.data;
  const qty = Number(d.quantity || 0);
  const type = d.itemType;

  if (!type || !qty) return null;

  if (type === "Stack'd") {
    if (!d.stackedSize || !d.stackedBuild) return null;
    const priceMap = { "20 Minis": 10, "25 Minis": 12, "30 Minis": 15 };
    const unit = priceMap[d.stackedSize];
    return {
      kind: "stacked",
      name: `${d.stackedSize} ${d.stackedBuild}`,
      quantity: qty,
      unitPrice: unit,
      totalPrice: unit * qty,
      lines: [`Quantity: ${qty}`, `Build: ${d.stackedBuild}`, ...STACKED_BUILDS[d.stackedBuild]],
      builtName: d.stackedBuild
    };
  }

  if (type === "Your Way") {
    if (!d.yourWaySize) return null;
    const priceMap = { "20 Minis": 8, "25 Minis": 10, "30 Minis": 12 };
    const unit = priceMap[d.yourWaySize];
    return {
      kind: "yourWay",
      name: `${d.yourWaySize} Your Way`,
      quantity: qty,
      unitPrice: unit,
      totalPrice: unit * qty,
      lines: [`Quantity: ${qty}`, ...(d.yourWayToppings || []), ...(d.yourWayDrizzles || []), ...(d.yourWayFruits || [])]
    };
  }

  if (type === "Bite Stack") {
    return {
      kind: "biteStack",
      name: "Bite Stack",
      quantity: qty,
      unitPrice: 5,
      totalPrice: 5 * qty,
      lines: [`Quantity: ${qty}`, ...(d.biteToppings || []), ...(d.biteDrizzles || []), ...(d.biteFruits || [])]
    };
  }

  if (type === "Dubai Strawberries") {
    return {
      kind: "dubaiStrawberries",
      name: "Dubai Strawberries",
      quantity: qty,
      unitPrice: 12,
      totalPrice: 12 * qty,
      lines: [`Quantity: ${qty}`, "Strawberries", "Pistachio Cream", "Chocolate Drizzle", "Kataifi", "Crushed Pistachio"]
    };
  }

  return null;
}

function renderReview() {
  const card = document.getElementById("reviewCard");
  const preview = buildPreviewItem();

  if (!preview) {
    card.innerHTML = `<p>No item being built yet.</p>`;
    return;
  }

  card.innerHTML = `
    <p><strong>${preview.name}</strong></p>
    ${preview.lines.map(line => `<p>${line}</p>`).join("")}
    <p><strong>Total:</strong> ${formatMoney(preview.totalPrice)}</p>
  `;
}

window.addBuiltItemToDraft = function () {
  const preview = buildPreviewItem();
  if (!preview) {
    alert("Finish building the item first.");
    return;
  }

  const itemToStore = {
    ...preview,
    builderData: clone(builder.data)
  };

  if (editingDraftIndex !== null) {
    draftItems[editingDraftIndex] = itemToStore;
  } else {
    draftItems.push(itemToStore);
  }

  editingDraftIndex = null;
  builder = { data: {} };
  renderBuilder();
  renderReview();
  renderDraft();
};

window.editDraftItem = function (index) {
  const item = draftItems[index];
  if (!item) return;
  builder = { data: clone(item.builderData) };
  editingDraftIndex = index;
  renderBuilder();
  renderReview();
};

window.removeDraftItem = function (index) {
  draftItems.splice(index, 1);
  renderDraft();
};

window.clearDraft = function () {
  if (!draftItems.length) return;
  if (!confirm("Clear the current draft?")) return;
  draftItems = [];
  builder = { data: {} };
  editingDraftIndex = null;
  renderBuilder();
  renderReview();
  renderDraft();
};

function renderDraft() {
  const list = document.getElementById("draftOrderList");
  const total = draftItems.reduce((sum, item) => sum + item.totalPrice, 0);
  document.getElementById("draftTotal").textContent = formatMoney(total);
  document.getElementById("editingNotice").classList.toggle("hidden", editingDraftIndex === null);

  if (!draftItems.length) {
    list.innerHTML = `<p>No items in draft yet.</p>`;
    return;
  }

  list.innerHTML = draftItems.map((item, index) => `
    <div class="order-item">
      <div class="order-item-head">
        <div>
          <p><strong>${item.name}</strong></p>
          ${item.lines.map(line => `<p>${line}</p>`).join("")}
          <p><strong>${formatMoney(item.totalPrice)}</strong></p>
        </div>
      </div>
      <div class="order-actions">
        <button type="button" class="action-btn" onclick="editDraftItem(${index})">Edit Item</button>
        <button type="button" class="action-btn delete-btn" onclick="removeDraftItem(${index})">Remove</button>
      </div>
    </div>
  `).join("");
}

window.addDraftToToday = async function () {
  if (!draftItems.length) {
    alert("Add at least one item first.");
    return;
  }

  const subtotal = draftItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const mode = prompt("Payment type:\nEnter exactly:\nCash\nDigital\nSplit");
  if (mode === null) return;

  const cleanedMode = mode.trim().toLowerCase();
  let payment = null;

  if (cleanedMode === "cash") {
    payment = { type: "cash", total: subtotal };
  } else if (cleanedMode === "digital") {
    const method = prompt("Enter digital method exactly:\nCash App\nApple Pay\nSquare");
    if (method === null) return;
    const m = method.trim();
    if (!["Cash App", "Apple Pay", "Square"].includes(m)) {
      alert("Enter Cash App, Apple Pay, or Square exactly.");
      return;
    }
    payment = { type: "digital", method: m, total: subtotal };
  } else if (cleanedMode === "split") {
    const cashInput = prompt(`Sale total is ${formatMoney(subtotal)}.\nEnter CASH amount only:`);
    if (cashInput === null) return;
    const cashAmount = Number(cashInput);
    if (Number.isNaN(cashAmount) || cashAmount < 0 || cashAmount > subtotal) {
      alert("Invalid cash amount.");
      return;
    }
    const digitalAmount = Number((subtotal - cashAmount).toFixed(2));
    const method = prompt(`Digital amount is ${formatMoney(digitalAmount)}.\nEnter digital method exactly:\nCash App\nApple Pay\nSquare`);
    if (method === null) return;
    const m = method.trim();
    if (!["Cash App", "Apple Pay", "Square"].includes(m)) {
      alert("Enter Cash App, Apple Pay, or Square exactly.");
      return;
    }

    payment = {
      type: "split",
      total: subtotal,
      cashAmount,
      digitalAmount,
      digitalMethod: m
    };
  } else {
    alert("Enter Cash, Digital, or Split.");
    return;
  }

  const saleRef = push(ref(db, "jessicaTracker/current/sales"));
  await set(saleRef, {
    createdAt: Date.now(),
    createdLabel: nowLabel(),
    subtotal,
    payment,
    items: clone(draftItems)
  });

  draftItems = [];
  builder = { data: {} };
  editingDraftIndex = null;
  renderBuilder();
  renderReview();
  renderDraft();
};

window.removeSale = async function (saleKey) {
  if (!confirm("Remove this sale?")) return;
  await remove(ref(db, `jessicaTracker/current/sales/${saleKey}`));
};

function renderTodaySales() {
  const box = document.getElementById("todaySalesList");
  const entries = Object.entries(trackerState.sales || {}).sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));

  box.innerHTML = entries.length
    ? entries.map(([key, sale]) => `
      <div class="sale-card">
        <p><strong>${sale.createdLabel}</strong> — ${formatMoney(sale.subtotal)}</p>
        ${sale.items.map(item => `
          <div class="order-item">
            <p><strong>${item.name}</strong></p>
            ${item.lines.map(line => `<p>${line}</p>`).join("")}
          </div>
        `).join("")}
        <p><strong>Payment:</strong> ${sale.payment?.type || "—"} ${sale.payment?.method || sale.payment?.digitalMethod || ""}</p>
        <div class="order-actions">
          <button type="button" class="action-btn delete-btn" onclick="removeSale('${key}')">Remove</button>
        </div>
      </div>
    `).join("")
    : "<p>No sales yet.</p>";
}

function renderMainScreen() {
  renderBuilder();
  renderReview();
  renderDraft();
  renderTodaySales();

  const totals = totalsFromSales(trackerState.sales);
  const { itemCounts, builtCounts } = getCountsFromSales(trackerState.sales);
  const itemsSold = Object.values(itemCounts).reduce((sum, n) => sum + n, 0);

  document.getElementById("dayTotal").textContent = formatMoney(totals.dayTotal);
  document.getElementById("cashTotal").textContent = formatMoney(totals.cash);
  document.getElementById("cashAppTotal").textContent = formatMoney(totals.cashApp);
  document.getElementById("applePayTotal").textContent = formatMoney(totals.applePay);
  document.getElementById("squareTotal").textContent = formatMoney(totals.square);

  document.getElementById("topSeller").textContent = topLabel(itemCounts);
  document.getElementById("topBuilt").textContent = topLabel(builtCounts);
  document.getElementById("itemsSoldCount").textContent = itemsSold;
  document.getElementById("dubaiSoldCount").textContent = itemCounts["Dubai Strawberries"] || 0;

  const itemCountsBox = document.getElementById("itemCountsBox");
  const countEntries = Object.entries(itemCounts).filter(([, count]) => count > 0);
  itemCountsBox.innerHTML = countEntries.length
    ? countEntries.map(([name, count]) => `<p><strong>${name}:</strong> ${count}</p>`).join("")
    : "<p>No sales yet.</p>";

  renderWeeklyStats();
}

function renderWeeklyStats() {
  const start = getWeekStart();
  let weekTotal = 0;
  const weekItemCounts = {};
  const weekBuiltCounts = {};

  Object.values(trackerState.days || {}).forEach(day => {
    const created = new Date(day.createdAt || 0);
    if (created >= start) {
      weekTotal += Number(day.totals?.dayTotal || 0);

      Object.entries(day.itemCounts || {}).forEach(([k, v]) => {
        weekItemCounts[k] = (weekItemCounts[k] || 0) + v;
      });

      Object.entries(day.builtCounts || {}).forEach(([k, v]) => {
        weekBuiltCounts[k] = (weekBuiltCounts[k] || 0) + v;
      });
    }
  });

  document.getElementById("weekTotal").textContent = formatMoney(weekTotal);
  document.getElementById("weekTopSeller").textContent = topLabel(weekItemCounts);
  document.getElementById("weekTopBuilt").textContent = topLabel(weekBuiltCounts);
}

window.saveDay = async function () {
  const totals = totalsFromSales(trackerState.sales);
  const { itemCounts, builtCounts } = getCountsFromSales(trackerState.sales);

  if (!Object.keys(trackerState.sales || {}).length) {
    alert("No sales to save yet.");
    return;
  }

  await set(ref(db, `jessicaTracker/days/${todayKey()}`), {
    label: todayLabel(),
    createdAt: Date.now(),
    sales: clone(trackerState.sales || {}),
    totals,
    itemCounts,
    builtCounts
  });

  await set(ref(db, "jessicaTracker/current/sales"), {});

  draftItems = [];
  builder = { data: {} };
  editingDraftIndex = null;
  renderBuilder();
  renderReview();
  renderDraft();
  alert("Day saved.");
};

window.resetDay = async function () {
  if (!confirm("Reset today without saving?")) return;

  await set(ref(db, "jessicaTracker/current/sales"), {});

  draftItems = [];
  builder = { data: {} };
  editingDraftIndex = null;
  renderBuilder();
  renderReview();
  renderDraft();
  alert("Day reset.");
};

function renderHistoryScreen() {
  const daysList = document.getElementById("historyDaysList");
  const detail = document.getElementById("historyDetail");
  const detailTitle = document.getElementById("historyDetailTitle");

  const dayEntries = Object.entries(trackerState.days || {}).sort((a, b) => b[0].localeCompare(a[0]));

  if (!dayEntries.length) {
    daysList.innerHTML = "<p>No saved days yet.</p>";
    detail.innerHTML = "<p>Select a day.</p>";
    detailTitle.textContent = "Day Details";
    return;
  }

  daysList.innerHTML = dayEntries.map(([dayKey, day]) => `
    <div class="history-day-card">
      <p><strong>${day.label || dayKey}</strong></p>
      <p>Total: ${formatMoney(day.totals?.dayTotal || 0)}</p>
      <p>Top Seller: ${topLabel(day.itemCounts || {})}</p>
      <div class="order-actions">
        <button type="button" class="action-btn" onclick="selectHistoryDay('${dayKey}')">View Day</button>
      </div>
    </div>
  `).join("");

  if (!selectedHistoryDay || !trackerState.days[selectedHistoryDay]) {
    detail.innerHTML = "<p>Select a day.</p>";
    detailTitle.textContent = "Day Details";
    return;
  }

  const day = trackerState.days[selectedHistoryDay];
  detailTitle.textContent = `Day Details — ${day.label || selectedHistoryDay}`;

  detail.innerHTML = `
    <div class="totals-box">
      <div class="line"><span>Total</span><strong>${formatMoney(day.totals?.dayTotal || 0)}</strong></div>
      <div class="line"><span>Cash</span><strong>${formatMoney(day.totals?.cash || 0)}</strong></div>
      <div class="line"><span>Cash App</span><strong>${formatMoney(day.totals?.cashApp || 0)}</strong></div>
      <div class="line"><span>Apple Pay</span><strong>${formatMoney(day.totals?.applePay || 0)}</strong></div>
      <div class="line"><span>Square</span><strong>${formatMoney(day.totals?.square || 0)}</strong></div>
      <div class="line"><span>Top Seller</span><strong>${topLabel(day.itemCounts || {})}</strong></div>
      <div class="line"><span>Top Built</span><strong>${topLabel(day.builtCounts || {})}</strong></div>
    </div>
    ${Object.values(day.sales || {}).map(sale => `
      <div class="history-order-card">
        <p><strong>${sale.createdLabel}</strong> — ${formatMoney(sale.subtotal)}</p>
        ${sale.items.map(item => `
          <div class="order-item">
            <p><strong>${item.name}</strong></p>
            ${item.lines.map(line => `<p>${line}</p>`).join("")}
          </div>
        `).join("")}
        <p><strong>Payment:</strong> ${sale.payment?.type || "—"} ${sale.payment?.method || sale.payment?.digitalMethod || ""}</p>
      </div>
    `).join("")}
  `;
}

function attachListeners() {
  onValue(ref(db, "jessicaTracker/current/sales"), snap => {
    trackerState.sales = snap.val() || {};
    renderScreen();
  });

  onValue(ref(db, "jessicaTracker/days"), snap => {
    trackerState.days = snap.val() || {};
    renderScreen();
  });
}

attachListeners();
renderScreen();
