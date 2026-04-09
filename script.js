let data = {
  stack20: { count: Number(localStorage.getItem("stack20Count")) || 0, price: 10 },
  stack25: { count: Number(localStorage.getItem("stack25Count")) || 0, price: 12 },
  stack30: { count: Number(localStorage.getItem("stack30Count")) || 0, price: 15 },
  your20: { count: Number(localStorage.getItem("your20Count")) || 0, price: 8 },
  your25: { count: Number(localStorage.getItem("your25Count")) || 0, price: 10 },
  your30: { count: Number(localStorage.getItem("your30Count")) || 0, price: 12 }
};

let history = JSON.parse(localStorage.getItem("pancakeSalesHistory")) || [];

const ids = ["stack20", "stack25", "stack30", "your20", "your25", "your30"];

function formatMoney(amount) {
  return `$${amount.toFixed(2)}`;
}

function getTodayLabel() {
  return new Date().toLocaleDateString();
}

function saveCurrentData() {
  ids.forEach((id) => {
    localStorage.setItem(`${id}Count`, data[id].count);
  });
  localStorage.setItem("pancakeSalesHistory", JSON.stringify(history));
}

function getGrandTotal() {
  return ids.reduce((sum, id) => sum + data[id].count * data[id].price, 0);
}

function getTotalItems() {
  return ids.reduce((sum, id) => sum + data[id].count, 0);
}

function updateScreen() {
  ids.forEach((id) => {
    document.getElementById(`${id}Count`).textContent = data[id].count;
  });

  document.getElementById("grandTotal").textContent = formatMoney(getGrandTotal());
  document.getElementById("totalItems").textContent = getTotalItems();
  document.getElementById("todayDate").textContent = getTodayLabel();
}

function renderHistory() {
  const historyListEl = document.getElementById("historyList");

  if (history.length === 0) {
    historyListEl.innerHTML = "<p>No saved days yet.</p>";
    return;
  }

  historyListEl.innerHTML = "";

  const newestFirst = [...history].reverse();

  newestFirst.forEach((day) => {
    const entry = document.createElement("div");
    entry.className = "history-entry";

    entry.innerHTML = `
      <h3>${day.date}</h3>
      <p>Stack’d 20: ${day.stack20Count} (${formatMoney(day.stack20Sales)})</p>
      <p>Stack’d 25: ${day.stack25Count} (${formatMoney(day.stack25Sales)})</p>
      <p>Stack’d 30: ${day.stack30Count} (${formatMoney(day.stack30Sales)})</p>
      <p>Your Way 20: ${day.your20Count} (${formatMoney(day.your20Sales)})</p>
      <p>Your Way 25: ${day.your25Count} (${formatMoney(day.your25Sales)})</p>
      <p>Your Way 30: ${day.your30Count} (${formatMoney(day.your30Sales)})</p>
      <p><strong>Total Orders:</strong> ${day.totalItems}</p>
      <p><strong>Total Sales:</strong> ${formatMoney(day.grandTotal)}</p>
    `;

    historyListEl.appendChild(entry);
  });
}

function changeCount(item, amount) {
  data[item].count += amount;

  if (data[item].count < 0) {
    data[item].count = 0;
  }

  saveCurrentData();
  updateScreen();
}

function resetDay() {
  const confirmReset = confirm("Are you sure you want to reset today's counts without saving?");
  if (!confirmReset) return;

  ids.forEach((id) => {
    data[id].count = 0;
  });

  saveCurrentData();
  updateScreen();
}

function saveDay() {
  const totalItems = getTotalItems();

  if (totalItems === 0) {
    alert("You have nothing to save yet for today.");
    return;
  }

  const today = getTodayLabel();

  const alreadySaved = history.find((entry) => entry.date === today);
  if (alreadySaved) {
    const overwrite = confirm("Today's numbers were already saved. Do you want to replace them?");
    if (!overwrite) return;

    history = history.filter((entry) => entry.date !== today);
  }

  const daySummary = {
    date: today,
    stack20Count: data.stack20.count,
    stack20Sales: data.stack20.count * data.stack20.price,
    stack25Count: data.stack25.count,
    stack25Sales: data.stack25.count * data.stack25.price,
    stack30Count: data.stack30.count,
    stack30Sales: data.stack30.count * data.stack30.price,
    your20Count: data.your20.count,
    your20Sales: data.your20.count * data.your20.price,
    your25Count: data.your25.count,
    your25Sales: data.your25.count * data.your25.price,
    your30Count: data.your30.count,
    your30Sales: data.your30.count * data.your30.price,
    totalItems: totalItems,
    grandTotal: getGrandTotal()
  };

  history.push(daySummary);

  ids.forEach((id) => {
    data[id].count = 0;
  });

  saveCurrentData();
  updateScreen();
  renderHistory();

  alert("Day saved and reset for tomorrow.");
}

updateScreen();
renderHistory();
updateScreen();
renderHistory();
