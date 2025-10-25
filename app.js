// ========== Helper Functions ==========
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

// ========== Core App Logic ==========
const testDateInput = document.getElementById('testDate');
const materialsInput = document.getElementById('materials');
const generateBtn = document.getElementById('generate');
const scheduleList = document.getElementById('scheduleList');
const cardList = document.getElementById('cardList');

let appState = {
  testDate: null,
  cards: [],
};

// Load saved data
window.addEventListener('load', () => {
  const saved = localStorage.getItem('studyPlanner.v1');
  if (saved) {
    appState = JSON.parse(saved);
    testDateInput.value = appState.testDate || '';
    renderSchedule();
  }
});

// Save to localStorage
function saveState() {
  localStorage.setItem('studyPlanner.v1', JSON.stringify(appState));
}

// Generate cards and schedule
generateBtn.addEventListener('click', () => {
  const testDate = new Date(testDateInput.value);
  if (isNaN(testDate)) {
    alert('Please enter a valid test date.');
    return;
  }

  const lines = materialsInput.value.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length === 0) {
    alert('Please enter some study materials.');
    return;
  }

  const today = new Date();
  const cards = lines.map((text, i) => ({
    id: `card-${i}`,
    prompt: text,
    ef: 2.5,
    reps: 0,
    interval: 0,
    nextReview: iso(today)
  }));

  // Create simple schedule: reviews at 0,1,3,7,14 days if before testDate
  const offsets = [0, 1, 3, 7, 14];
  const scheduleMap = {};

  for (let offset of offsets) {
    const d = addDays(today, offset);
    if (d > testDate) continue;
    const key = iso(d);
    scheduleMap[key] = lines.map((text, i) => ({
      id: `card-${i}`,
      prompt: text
    }));
  }

  appState = { testDate: iso(testDate), cards, schedule: scheduleMap };
  saveState();
  renderSchedule();
});

// Render schedule list
function renderSchedule() {
  scheduleList.innerHTML = '';
  if (!appState.schedule) return;
  const dates = Object.keys(appState.schedule).sort();
  dates.forEach(date => {
    const li = document.createElement('li');
    const count = appState.schedule[date].length;
    li.textContent = `${date} — ${count} cards`;
    li.addEventListener('click', () => renderCardsForDate(date));
    scheduleList.appendChild(li);
  });
}

// Render cards for a selected date
function renderCardsForDate(date) {
  cardList.innerHTML = '';
  const cards = appState.schedule[date];
  if (!cards) return;

  cards.forEach((c, index) => {
    const li = document.createElement('li');
    li.textContent = c.prompt;

    if (c.done) {
      li.style.textDecoration = 'line-through';
      li.style.color = 'gray';
    }

    li.addEventListener('click', () => {
      c.done = !c.done; // flip true/false
      saveState(); // persist
      renderCardsForDate(date); // re-render this day’s cards
    });

    cardList.appendChild(li);
  });
}

