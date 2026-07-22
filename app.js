const container = document.getElementById("destinations");
const thingsContainer = document.getElementById("things-to-do");
const reisContainer = document.getElementById("reis");
const tabBar = document.querySelector(".tab-bar");
const tabButtons = tabBar.querySelectorAll(".tab-btn");
const tabPanels = {
  reis: document.getElementById("tab-reis"),
  route: document.getElementById("tab-route"),
  todo: document.getElementById("tab-todo"),
  planning: document.getElementById("tab-planning"),
};

const VALID_TABS = ["reis", "route", "todo", "planning"];
const DUTCH_MONTHS = {
  januari: 0,
  februari: 1,
  maart: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  augustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  december: 11,
};

let thingsData = null;
let pendingScrollLocationId = null;
let photoViewer = null;

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

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(start, end) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(end) - startOfDay(start)) / msPerDay);
}

function parseDestinationRange(dates) {
  const normalized = String(dates)
    .replace(/–/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  let match = normalized.match(
    /^(\d{1,2})\s*-\s*(\d{1,2})\s+([a-z]+)\s+(\d{4})$/
  );

  if (match) {
    const month = DUTCH_MONTHS[match[3]];
    const year = Number(match[4]);

    if (month == null) {
      return null;
    }

    return {
      start: new Date(year, month, Number(match[1])),
      end: new Date(year, month, Number(match[2])),
    };
  }

  match = normalized.match(
    /^(\d{1,2})\s+([a-z]+)\s*-\s*(\d{1,2})\s+([a-z]+)\s+(\d{4})$/
  );

  if (match) {
    const startMonth = DUTCH_MONTHS[match[2]];
    const endMonth = DUTCH_MONTHS[match[4]];
    const year = Number(match[5]);

    if (startMonth == null || endMonth == null) {
      return null;
    }

    return {
      start: new Date(year, startMonth, Number(match[1])),
      end: new Date(year, endMonth, Number(match[3])),
    };
  }

  return null;
}

function withDateRanges(destinations) {
  return destinations.map((destination) => {
    const range = parseDestinationRange(destination.dates);
    return {
      ...destination,
      startDate: range?.start || null,
      endDate: range?.end || null,
    };
  });
}

function getTripBounds(destinations) {
  const dated = destinations.filter((item) => item.startDate && item.endDate);

  if (!dated.length) {
    return null;
  }

  return {
    start: dated[0].startDate,
    end: dated[dated.length - 1].endDate,
  };
}

function getActiveDestination(destinations, today) {
  const current = startOfDay(today);

  return (
    destinations.find((destination) => {
      if (!destination.startDate || !destination.endDate) {
        return false;
      }

      return current >= destination.startDate && current < destination.endDate;
    }) || null
  );
}

function getNextDestination(destinations, today) {
  const current = startOfDay(today);

  return (
    destinations.find((destination) => {
      if (!destination.startDate) {
        return false;
      }

      return destination.startDate > current;
    }) || null
  );
}

function getTripStatus(destinations, today = new Date()) {
  const bounds = getTripBounds(destinations);

  if (!bounds) {
    return {
      label: "Portugal Familievakantie",
      progress: 0,
      currentId: null,
    };
  }

  const current = startOfDay(today);
  const totalDays = Math.max(daysBetween(bounds.start, bounds.end), 1);

  if (current < bounds.start) {
    const daysUntil = daysBetween(current, bounds.start);

    if (daysUntil === 1) {
      return { label: "Morgen vertrek", progress: 0, currentId: null };
    }

    return {
      label: `Nog ${daysUntil} dagen tot vertrek`,
      progress: 0,
      currentId: null,
    };
  }

  if (current >= bounds.end) {
    return {
      label: "Reis afgerond — tot de volgende",
      progress: 1,
      currentId: null,
    };
  }

  const active = getActiveDestination(destinations, current);

  if (active) {
    const elapsed = daysBetween(bounds.start, current);
    return {
      label: `Vandaag in ${active.name}`,
      progress: Math.min(Math.max(elapsed / totalDays, 0.05), 0.95),
      currentId: active.id,
    };
  }

  const next = getNextDestination(destinations, current);

  if (next) {
    const daysUntil = daysBetween(current, next.startDate);
    const elapsed = daysBetween(bounds.start, current);
    const label =
      daysUntil <= 1 ? `Morgen naar ${next.name}` : `Onderweg naar ${next.name}`;

    return {
      label,
      progress: Math.min(Math.max(elapsed / totalDays, 0.05), 0.95),
      currentId: null,
    };
  }

  return {
    label: "Onderweg in Portugal",
    progress: 0.5,
    currentId: null,
  };
}

function getHeroDestination(destinations, status) {
  if (status.currentId) {
    return destinations.find((item) => item.id === status.currentId) || destinations[0];
  }

  const next = getNextDestination(destinations, new Date());
  return next || destinations[0];
}

function buildJourneyStops(destinations) {
  const first = destinations[0];
  const monthNames = Object.keys(DUTCH_MONTHS);
  const arrivalMeta = first?.startDate
    ? `Aankomst ${first.startDate.getDate()} ${monthNames[first.startDate.getMonth()]}`
    : "Aankomst";

  const stops = [
    {
      id: "arrival-lisbon",
      name: "Lissabon",
      meta: arrivalMeta,
      destinationId: null,
    },
  ];

  destinations.forEach((destination) => {
    const nightsLabel =
      destination.nights === 1
        ? "1 nacht"
        : `${destination.nights} nachten`;

    stops.push({
      id: destination.id,
      name: destination.name,
      meta: `${destination.dates} · ${nightsLabel}`,
      destinationId: destination.id,
    });
  });

  return stops;
}

function collectHighlights(destinations, limit = 4) {
  const preferred = [];
  const fallback = [];

  destinations.forEach((destination, destinationIndex) => {
    const tips = getLocationTips(destination.id)?.tips?.highlights || [];

    tips.forEach((tip, tipIndex) => {
      const photos = destination.photos || [];
      const photo = photos[(tipIndex + 1) % Math.max(photos.length, 1)] || photos[0];
      const entry = {
        tip,
        destination,
        photo,
        sortKey: destinationIndex * 10 + tipIndex,
      };

      if (/korte testtip/i.test(tip.text || "")) {
        fallback.push(entry);
      } else {
        preferred.push(entry);
      }
    });
  });

  return [...preferred, ...fallback].slice(0, limit);
}

function collectFeaturePhotos(destinations, heroSrc) {
  return destinations
    .map((destination, index) => {
      const photos = destination.photos || [];
      if (!photos.length) {
        return null;
      }

      const preferred =
        photos.find((photo) => photo.src !== heroSrc) ||
        photos[Math.min(index, photos.length - 1)];

      return {
        src: preferred.src,
        alt: preferred.alt || destination.name,
        label: destination.name,
      };
    })
    .filter(Boolean);
}

function buildPlanningPreviewItems(destinations, status) {
  const today = startOfDay(new Date());
  const active = getActiveDestination(destinations, today);
  const next = getNextDestination(destinations, today);
  const first = destinations[0];

  if (status.progress === 0 && first) {
    return [
      {
        label: "Eerstvolgend",
        text: first.travel
          ? first.travel.split(".")[0] + "."
          : `Vertrek naar ${first.name}`,
      },
      {
        label: "Eerste stop",
        text: `${first.name} · ${first.accommodation || first.dates}`,
      },
    ].slice(0, 2);
  }

  if (active) {
    const items = [
      {
        label: "Nu",
        text: `${active.name} · ${active.accommodation || active.dates}`,
      },
    ];

    if (next) {
      items.push({
        label: "Daarna",
        text: `${next.name} · ${next.dates}`,
      });
    } else if (active.travel) {
      items.push({
        label: "Let op",
        text: active.travel.split(".")[0] + ".",
      });
    }

    return items.slice(0, 2);
  }

  if (next) {
    return [
      {
        label: "Volgende stop",
        text: `${next.name} · ${next.dates}`,
      },
      next.accommodation
        ? {
            label: "Verblijf",
            text: next.accommodation,
          }
        : null,
    ].filter(Boolean);
  }

  return [
    {
      label: "Terugblik",
      text: "Bekijk de volledige planning van de reis.",
    },
  ];
}

function renderReisHero(destinations, status) {
  const heroDestination = getHeroDestination(destinations, status);
  const photo = heroDestination?.photos?.[0];
  const progressPercent = Math.round(status.progress * 100);

  return `
    <header class="reis-hero">
      ${
        photo
          ? `<img
              class="reis-hero-image"
              src="${escapeHtml(photo.src)}"
              alt="${escapeHtml(photo.alt || heroDestination.name)}"
              fetchpriority="high"
            >`
          : ""
      }
      <div class="reis-hero-scrim" aria-hidden="true"></div>
      <div class="reis-hero-content">
        <h1 class="reis-title">Portugal Familievakantie 2026</h1>
        <p class="reis-subtitle">17-daagse rondreis</p>
        <p class="reis-status">${escapeHtml(status.label)}</p>
        <div
          class="reis-progress"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${progressPercent}"
          aria-label="Voortgang van de reis"
        >
          <div class="reis-progress-track">
            <span
              class="reis-progress-value"
              style="width: ${progressPercent}%"
            ></span>
          </div>
        </div>
      </div>
    </header>
  `;
}

function renderReisJourney(destinations, status) {
  const stops = buildJourneyStops(destinations);
  const currentIndex = status.currentId
    ? destinations.findIndex((item) => item.id === status.currentId)
    : -1;

  const items = stops
    .map((stop) => {
      let stateClass = "";

      if (stop.id === "arrival-lisbon") {
        if (status.progress > 0) {
          stateClass = " is-past";
        }
      } else if (status.currentId && stop.destinationId === status.currentId) {
        stateClass = " is-current";
      } else if (status.progress >= 1) {
        stateClass = " is-past";
      } else if (currentIndex > -1 && stop.destinationId) {
        const stopIndex = destinations.findIndex(
          (item) => item.id === stop.destinationId
        );

        if (stopIndex > -1 && stopIndex < currentIndex) {
          stateClass = " is-past";
        }
      }

      return `
        <li class="reis-journey-item${stateClass}">
          <p class="reis-journey-name">${escapeHtml(stop.name)}</p>
          <p class="reis-journey-meta">${escapeHtml(stop.meta)}</p>
        </li>
      `;
    })
    .join("");

  return `
    <section class="reis-section" aria-labelledby="reis-journey-title">
      <div class="reis-section-header">
        <h2 class="reis-section-title" id="reis-journey-title">Route</h2>
        <a class="reis-section-link" href="#route">Bekijk</a>
      </div>
      <ol class="reis-journey">${items}</ol>
    </section>
  `;
}

function renderReisPhotos(photos) {
  if (!photos.length) {
    return "";
  }

  const items = photos
    .map(
      (photo) => `
        <figure class="reis-photo-wrap">
          <button
            type="button"
            class="reis-photo"
            data-reis-photo
            data-src="${escapeHtml(photo.src)}"
            data-alt="${escapeHtml(photo.alt)}"
            aria-label="Bekijk foto van ${escapeHtml(photo.label)}"
          >
            <img
              src="${escapeHtml(photo.src)}"
              alt="${escapeHtml(photo.alt)}"
              loading="lazy"
            >
          </button>
          <figcaption class="reis-photo-label">${escapeHtml(photo.label)}</figcaption>
        </figure>
      `
    )
    .join("");

  return `
    <section class="reis-section" aria-labelledby="reis-photos-title">
      <div class="reis-section-header">
        <h2 class="reis-section-title" id="reis-photos-title">Foto&apos;s</h2>
      </div>
      <div class="reis-photos">${items}</div>
    </section>
  `;
}

function renderReisHighlights(highlights) {
  if (!highlights.length) {
    return "";
  }

  const items = highlights
    .map((item) => {
      const text = item.tip.text || "";
      const photo = item.photo;

      return `
        <a
          class="reis-highlight"
          href="#todo/${encodeURIComponent(item.destination.id)}"
        >
          ${
            photo
              ? `<span class="reis-highlight-media">
                  <img
                    src="${escapeHtml(photo.src)}"
                    alt=""
                    loading="lazy"
                  >
                </span>`
              : ""
          }
          <span>
            <h3 class="reis-highlight-title">${escapeHtml(item.tip.title)}</h3>
            ${
              text
                ? `<p class="reis-highlight-text">${escapeHtml(text)}</p>`
                : ""
            }
            <p class="reis-highlight-meta">${escapeHtml(item.destination.name)}</p>
          </span>
        </a>
      `;
    })
    .join("");

  return `
    <section class="reis-section" aria-labelledby="reis-highlights-title">
      <div class="reis-section-header">
        <h2 class="reis-section-title" id="reis-highlights-title">Hoogtepunten</h2>
        <a class="reis-section-link" href="#todo">Meer</a>
      </div>
      <div class="reis-highlights">${items}</div>
    </section>
  `;
}

function renderReisPlanningPreview(destinations, status) {
  const items = buildPlanningPreviewItems(destinations, status)
    .map(
      (item) => `
        <div class="reis-preview-item">
          <p class="reis-preview-label">${escapeHtml(item.label)}</p>
          <p class="reis-preview-text">${escapeHtml(item.text)}</p>
        </div>
      `
    )
    .join("");

  return `
    <section class="reis-section" aria-labelledby="reis-preview-title">
      <div class="reis-section-header">
        <h2 class="reis-section-title" id="reis-preview-title">Planning</h2>
      </div>
      <div class="reis-preview">
        ${items}
        <a class="reis-preview-cta" href="#planning">Bekijk planning</a>
      </div>
    </section>
  `;
}

function ensurePhotoViewer() {
  if (photoViewer) {
    return photoViewer;
  }

  photoViewer = document.createElement("div");
  photoViewer.className = "reis-photo-viewer";
  photoViewer.hidden = true;
  photoViewer.innerHTML = `
    <button type="button" class="reis-photo-viewer-close" aria-label="Sluiten">×</button>
    <img alt="">
  `;
  document.body.appendChild(photoViewer);

  const close = () => closePhotoViewer();

  photoViewer
    .querySelector(".reis-photo-viewer-close")
    .addEventListener("click", close);

  photoViewer.addEventListener("click", (event) => {
    if (event.target === photoViewer) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && photoViewer?.classList.contains("is-open")) {
      close();
    }
  });

  return photoViewer;
}

function openPhotoViewer(src, alt) {
  const viewer = ensurePhotoViewer();
  const image = viewer.querySelector("img");
  image.src = src;
  image.alt = alt || "";
  viewer.hidden = false;
  requestAnimationFrame(() => {
    viewer.classList.add("is-open");
  });
}

function closePhotoViewer() {
  if (!photoViewer) {
    return;
  }

  photoViewer.classList.remove("is-open");
  window.setTimeout(() => {
    if (!photoViewer.classList.contains("is-open")) {
      photoViewer.hidden = true;
      photoViewer.querySelector("img").removeAttribute("src");
    }
  }, 220);
}

function initReisInteractions(root) {
  root.querySelectorAll("[data-reis-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      openPhotoViewer(button.dataset.src, button.dataset.alt);
    });
  });
}

function renderReis(destinations) {
  const datedDestinations = withDateRanges(destinations);
  const status = getTripStatus(datedDestinations);
  const heroDestination = getHeroDestination(datedDestinations, status);
  const heroSrc = heroDestination?.photos?.[0]?.src || "";
  const highlights = collectHighlights(datedDestinations, 4);
  const photos = collectFeaturePhotos(datedDestinations, heroSrc);

  return `
    ${renderReisHero(datedDestinations, status)}
    ${renderReisJourney(datedDestinations, status)}
    ${renderReisPhotos(photos)}
    ${renderReisHighlights(highlights)}
    ${renderReisPlanningPreview(datedDestinations, status)}
  `;
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

function showReisError(message) {
  reisContainer.innerHTML = `<p class="error">${message}</p>`;
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

    reisContainer.innerHTML = renderReis(destinations);
    reisContainer.classList.add("reis-animate");
    initReisInteractions(reisContainer);

    container.innerHTML = "";
    destinations.forEach((destination) => {
      container.appendChild(renderCard(destination));
    });
    initGalleries(container);

    thingsContainer.innerHTML = renderThingsToDo(destinations);

    initTabNavigation();
    applyRouteFromHash();
  } catch (error) {
    showReisError(error.message);
    showError(error.message);
    showThingsError(error.message);
  }
}

loadApp();
