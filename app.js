const container = document.getElementById("destinations");
const thingsContainer = document.getElementById("things-to-do");
const tabBar = document.querySelector(".tab-bar");
const tabButtons = tabBar.querySelectorAll(".tab-btn");
const tabPanels = {
  reis: document.getElementById("tab-reis"),
  route: document.getElementById("tab-route"),
  todo: document.getElementById("tab-todo"),
  planning: document.getElementById("tab-planning"),
};

const VALID_TABS = ["reis", "route", "todo", "planning"];

let thingsData = null;
let pendingScrollLocationId = null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMapEmbed(destination) {
  let query;

  if (destination.lat != null && destination.lng != null) {
    query = `${destination.lat},${destination.lng}`;
  } else if (destination.address) {
    query = encodeURIComponent(destination.address);
  } else {
    return "";
  }

  const src = `https://www.google.com/maps?q=${query}&hl=nl&z=15&output=embed`;

  return `
    <div class="card-map">
      <iframe
        title="Kaart van ${destination.name}"
        src="${src}"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        allowfullscreen
      ></iframe>
    </div>
  `;
}

function buildGallery(destination) {
  if (!destination.photos?.length) {
    return "";
  }

  const slides = destination.photos
    .map(
      (photo, index) => `
        <div class="gallery-slide">
          <img
            src="${photo.src}"
            alt="${photo.alt || destination.name}"
            loading="${index === 0 ? "eager" : "lazy"}"
            data-fallback-label="Foto ${index + 1} — nog toevoegen"
          >
        </div>
      `
    )
    .join("");

  const dots = destination.photos
    .map(
      (_, index) => `
        <button
          type="button"
          class="gallery-dot${index === 0 ? " is-active" : ""}"
          data-index="${index}"
          aria-label="Foto ${index + 1}"
        ></button>
      `
    )
    .join("");

  return `
    <div class="gallery" data-gallery>
      <div class="gallery-viewport">
        <div class="gallery-track">${slides}</div>
        <button type="button" class="gallery-btn gallery-prev" aria-label="Vorige foto">‹</button>
        <button type="button" class="gallery-btn gallery-next" aria-label="Volgende foto">›</button>
      </div>
      <div class="gallery-dots">${dots}</div>
    </div>
  `;
}

function showImageFallback(image) {
  const slide = image.closest(".gallery-slide");
  if (!slide || slide.querySelector(".gallery-fallback")) {
    return;
  }

  image.hidden = true;

  const fallback = document.createElement("div");
  fallback.className = "gallery-fallback";
  fallback.textContent = image.dataset.fallbackLabel || "Foto — nog toevoegen";
  slide.appendChild(fallback);
}

function initGalleries(root) {
  root.querySelectorAll("[data-gallery]").forEach((gallery) => {
    const track = gallery.querySelector(".gallery-track");
    const dots = gallery.querySelectorAll(".gallery-dot");
    const prevBtn = gallery.querySelector(".gallery-prev");
    const nextBtn = gallery.querySelector(".gallery-next");
    const slideCount = gallery.querySelectorAll(".gallery-slide").length;
    let current = 0;
    let touchStartX = 0;

    gallery.querySelectorAll(".gallery-slide img").forEach((image) => {
      image.addEventListener("error", () => showImageFallback(image));
    });

    function goTo(index) {
      current = (index + slideCount) % slideCount;
      track.style.transform = `translateX(-${current * 100}%)`;

      dots.forEach((dot, dotIndex) => {
        dot.classList.toggle("is-active", dotIndex === current);
      });
    }

    prevBtn.addEventListener("click", () => goTo(current - 1));
    nextBtn.addEventListener("click", () => goTo(current + 1));

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        goTo(Number(dot.dataset.index));
      });
    });

    gallery.addEventListener(
      "touchstart",
      (event) => {
        touchStartX = event.changedTouches[0].screenX;
      },
      { passive: true }
    );

    gallery.addEventListener(
      "touchend",
      (event) => {
        const touchEndX = event.changedTouches[0].screenX;
        const distance = touchEndX - touchStartX;

        if (Math.abs(distance) < 50) {
          return;
        }

        if (distance < 0) {
          goTo(current + 1);
        } else {
          goTo(current - 1);
        }
      },
      { passive: true }
    );
  });
}

function buildTipsLink(destination) {
  return `
    <a class="tips-link" href="#todo/${destination.id}">
      Bekijk tips voor ${escapeHtml(destination.name)}
    </a>
  `;
}

function renderCard(destination) {
  const card = document.createElement("article");
  card.className = "card";

  const gallery = buildGallery(destination);
  const accommodation = destination.accommodation
    ? `<p class="accommodation">${destination.accommodation}</p>`
    : "";
  const address = destination.address
    ? `<p class="address">${destination.address}</p>`
    : "";
  const nights = destination.nights
    ? `<p class="nights">${destination.nights} nachten</p>`
    : "";
  const travel = destination.travel
    ? `<p class="travel">${destination.travel}</p>`
    : "";
  const map = buildMapEmbed(destination);
  const tipsLink = buildTipsLink(destination);

  card.innerHTML = `
    <h2>${destination.name}</h2>
    ${gallery}
    <p class="dates">${destination.dates}</p>
    ${accommodation}
    ${address}
    ${nights}
    ${travel}
    <p>${destination.description}</p>
    ${map}
    ${tipsLink}
  `;
  return card;
}

function getLocationTips(locationId) {
  if (!thingsData?.locations) {
    return null;
  }

  return thingsData.locations.find((location) => location.id === locationId) || null;
}

function hasLocationTips(locationData) {
  if (!locationData) {
    return false;
  }

  const tips = locationData.tips || {};

  for (const category of thingsData.categories || []) {
    if (tips[category.id]?.length) {
      return true;
    }
  }

  return Boolean(locationData.dayPlans?.length);
}

function renderTipItem(tip) {
  const title = tip.title ? `<h4 class="tip-title">${escapeHtml(tip.title)}</h4>` : "";
  const text = tip.text ? `<p class="tip-text">${escapeHtml(tip.text)}</p>` : "";
  const note = tip.note
    ? `<p class="tip-note">${escapeHtml(tip.note)}</p>`
    : "";
  const familyFriendly = tip.familyFriendly
    ? `<p class="tip-badge">Geschikt voor gezinnen</p>`
    : "";
  const url = tip.url
    ? `<p><a class="tip-link" href="${escapeHtml(tip.url)}" target="_blank" rel="noopener noreferrer">Meer info</a></p>`
    : "";
  const mapUrl = tip.mapUrl
    ? `<p><a class="tip-link" href="${escapeHtml(tip.mapUrl)}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a></p>`
    : "";

  return `
    <li class="tip-item">
      ${title}
      ${text}
      ${note}
      ${familyFriendly}
      ${url}
      ${mapUrl}
    </li>
  `;
}

function renderDayPlan(dayPlan) {
  const steps = (dayPlan.steps || [])
    .map(
      (step) => `
        <li class="day-step">
          ${step.time ? `<p class="day-step-time">${escapeHtml(step.time)}</p>` : ""}
          ${step.title ? `<h5 class="day-step-title">${escapeHtml(step.title)}</h5>` : ""}
          ${step.text ? `<p class="day-step-text">${escapeHtml(step.text)}</p>` : ""}
        </li>
      `
    )
    .join("");

  return `
    <article class="day-plan">
      ${dayPlan.title ? `<h4 class="day-plan-title">${escapeHtml(dayPlan.title)}</h4>` : ""}
      <ol class="day-steps">${steps}</ol>
    </article>
  `;
}

function renderLocationTipsSection(destination) {
  const locationData = getLocationTips(destination.id);
  const sectionId = `tips-${destination.id}`;

  if (!hasLocationTips(locationData)) {
    return `
      <section class="tips-section" id="${sectionId}">
        <h2 class="tips-section-title">${escapeHtml(destination.name)}</h2>
        <p class="tips-empty">Voor deze locatie worden de tips nog toegevoegd.</p>
      </section>
    `;
  }

  const tips = locationData.tips || {};
  const categoriesHtml = (thingsData.categories || [])
    .map((category) => {
      const items = tips[category.id] || [];
      if (!items.length) {
        return "";
      }

      const itemsHtml = items.map((tip) => renderTipItem(tip)).join("");

      return `
        <section class="tips-category">
          <h3 class="tips-category-title">${escapeHtml(category.title)}</h3>
          <ul class="tips-list">${itemsHtml}</ul>
        </section>
      `;
    })
    .filter(Boolean)
    .join("");

  const dayPlansHtml = (locationData.dayPlans || []).length
    ? `
        <section class="tips-category">
          <h3 class="tips-category-title">Mogelijke dagindelingen</h3>
          <div class="day-plans">
            ${locationData.dayPlans.map((dayPlan) => renderDayPlan(dayPlan)).join("")}
          </div>
        </section>
      `
    : "";

  return `
    <section class="tips-section" id="${sectionId}">
      <h2 class="tips-section-title">${escapeHtml(destination.name)}</h2>
      ${categoriesHtml}
      ${dayPlansHtml}
    </section>
  `;
}

function renderThingsToDo(destinations) {
  return destinations.map((destination) => renderLocationTipsSection(destination)).join("");
}

function normalizeTab(tab) {
  if (tab === "things-to-do") {
    return "todo";
  }

  if (VALID_TABS.includes(tab)) {
    return tab;
  }

  return "reis";
}

function parseHash() {
  const hash = window.location.hash.replace(/^#/, "");

  if (!hash || hash === "reis") {
    return { tab: "reis", locationId: null };
  }

  if (hash === "route") {
    return { tab: "route", locationId: null };
  }

  if (hash === "planning") {
    return { tab: "planning", locationId: null };
  }

  if (hash === "todo" || hash === "things-to-do") {
    return { tab: "todo", locationId: null };
  }

  if (hash.startsWith("todo/")) {
    return {
      tab: "todo",
      locationId: decodeURIComponent(hash.slice("todo/".length)),
    };
  }

  if (hash.startsWith("things-to-do/")) {
    return {
      tab: "todo",
      locationId: decodeURIComponent(hash.slice("things-to-do/".length)),
    };
  }

  return { tab: "reis", locationId: null };
}

function buildHash(tab, locationId) {
  const normalizedTab = normalizeTab(tab);

  if (normalizedTab === "todo" && locationId) {
    return `todo/${locationId}`;
  }

  return normalizedTab;
}

function setActiveTab(tab, { focusTab = false } = {}) {
  const normalizedTab = normalizeTab(tab);

  Object.entries(tabPanels).forEach(([name, panel]) => {
    if (!panel) {
      return;
    }

    panel.hidden = name !== normalizedTab;
  });

  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === normalizedTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  if (focusTab) {
    const activeButton = tabBar.querySelector(
      `.tab-btn[data-tab="${normalizedTab}"]`
    );
    activeButton?.focus();
  }
}

function scrollToLocation(locationId) {
  if (!locationId) {
    return;
  }

  const section = document.getElementById(`tips-${locationId}`);
  if (!section) {
    return;
  }

  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function applyRouteFromHash() {
  const route = parseHash();
  setActiveTab(route.tab);

  if (route.locationId) {
    pendingScrollLocationId = route.locationId;
    requestAnimationFrame(() => {
      if (pendingScrollLocationId) {
        scrollToLocation(pendingScrollLocationId);
        pendingScrollLocationId = null;
      }
    });
  } else {
    pendingScrollLocationId = null;
  }
}

function initTabNavigation() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextHash = buildHash(button.dataset.tab, null);
      if (window.location.hash.replace(/^#/, "") !== nextHash) {
        window.location.hash = nextHash;
      } else {
        applyRouteFromHash();
      }
    });
  });

  tabBar.addEventListener("keydown", (event) => {
    const tabs = [...tabButtons];
    const currentIndex = tabs.indexOf(document.activeElement);

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();

      const direction = event.key === "ArrowRight" ? 1 : -1;
      const startIndex = currentIndex >= 0 ? currentIndex : tabs.findIndex((tab) => tab.classList.contains("is-active"));
      const nextIndex = (startIndex + direction + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      if (event.target.matches(".tab-btn")) {
        event.preventDefault();
        event.target.click();
      }
    }
  });

  window.addEventListener("hashchange", applyRouteFromHash);
}

function showError(message) {
  container.innerHTML = `<p class="error">${message}</p>`;
}

function showThingsError(message) {
  thingsContainer.innerHTML = `<p class="error">${message}</p>`;
}

async function loadApp() {
  try {
    if (!window.location.hash) {
      history.replaceState(null, "", "#reis");
    }

    const [destinationsResponse, thingsResponse] = await Promise.all([
      fetch("data/destinations.json"),
      fetch("data/things-to-do.json"),
    ]);

    if (!destinationsResponse.ok) {
      throw new Error("Kon bestemmingen niet laden.");
    }

    if (!thingsResponse.ok) {
      throw new Error("Kon tips niet laden.");
    }

    const destinations = await destinationsResponse.json();
    thingsData = await thingsResponse.json();

    container.innerHTML = "";
    destinations.forEach((destination) => {
      container.appendChild(renderCard(destination));
    });
    initGalleries(container);

    thingsContainer.innerHTML = renderThingsToDo(destinations);

    initTabNavigation();
    applyRouteFromHash();
  } catch (error) {
    showError(error.message);
    showThingsError(error.message);
  }
}

loadApp();
