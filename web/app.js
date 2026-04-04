const config = window.SHOLAT_APP_CONFIG || {};
const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-query");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const scheduleCard = document.getElementById("schedule-card");
const scheduleTitle = document.getElementById("schedule-title");
const scheduleDate = document.getElementById("schedule-date");
const scheduleTimezone = document.getElementById("schedule-timezone");
const telegramLink = document.getElementById("telegram-link");
const timingsEl = document.getElementById("timings");

const prayerOrder = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const LAST_CITY_STORAGE_KEY = "sholat:last-city";

telegramLink.href = config.TELEGRAM_BOT_URL || "#";

if (!config.API_BASE_URL || !config.TELEGRAM_BOT_URL) {
  setStatus("Complete `web/config.js` before deploying the site.", true);
}

searchForm.addEventListener("submit", async event => {
  event.preventDefault();

  const query = cityInput.value.trim();
  if (!query) {
    setStatus("Please enter a city name first.", true);
    return;
  }

  setStatus("Looking up matching cities...");
  hideSchedule();
  resultsEl.innerHTML = "";

  try {
    const response = await fetchJson(
      `${config.API_BASE_URL}/api/public/search-city?q=${encodeURIComponent(query)}`
    );
    const results = response.results || [];

    if (!results.length) {
      setStatus("No matching city found. Try a more specific search.", true);
      return;
    }

    setStatus("Choose the city that matches you best.");
    renderResults(results);
  } catch (error) {
    setStatus(readError(error), true);
  }
});

function renderResults(results) {
  resultsEl.innerHTML = "";

  for (const result of results) {
    const item = document.createElement("article");
    item.className = "result-item";

    const copy = document.createElement("div");
    copy.innerHTML = `<h3>${escapeHtml(result.title)}</h3><p>${escapeHtml(result.description)}</p>`;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "View Times";
    button.addEventListener("click", () => loadPrayerTimes(result.query, { persistCity: true }));

    item.append(copy, button);
    resultsEl.appendChild(item);
  }
}

async function loadPrayerTimes(city, options = {}) {
  const { persistCity = false, initialStatus = "Loading today's prayer times..." } = options;

  setStatus(initialStatus);
  cityInput.value = city;
  hideSchedule();

  try {
    const response = await fetchJson(
      `${config.API_BASE_URL}/api/public/prayer-times?city=${encodeURIComponent(city)}&method=3`
    );

    if (persistCity) {
      localStorage.setItem(LAST_CITY_STORAGE_KEY, city);
    }

    scheduleTitle.textContent = response.city;
    scheduleDate.textContent = formatLongDate(response.day_local);
    scheduleTimezone.textContent = `Timezone: ${response.tz}`;
    timingsEl.innerHTML = "";

    for (const prayer of prayerOrder) {
      const item = document.createElement("div");
      item.className = "timing-item";
      item.innerHTML =
        `<span class="timing-label">${prayer}</span>` +
        `<span class="timing-value">${escapeHtml(response.timings[prayer])}</span>`;
      timingsEl.appendChild(item);
    }

    showSchedule();
    setStatus(`Prayer times for ${response.city} are ready.`);
  } catch (error) {
    setStatus(readError(error), true);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "The request could not be completed.");
  }

  return payload;
}

function showSchedule() {
  scheduleCard.classList.remove("hidden");
}

function hideSchedule() {
  scheduleCard.classList.add("hidden");
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "";
}

function readError(error) {
  if (error instanceof Error && error.message) return error.message;
  return "An unknown error occurred.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatLongDate(dayLocal) {
  const safeDate = new Date(`${dayLocal}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(safeDate);
}

const lastCity = localStorage.getItem(LAST_CITY_STORAGE_KEY);
if (lastCity) {
  cityInput.value = lastCity;
  loadPrayerTimes(lastCity, {
    initialStatus: "Refreshing your saved city..."
  });
}
