const container = document.getElementById("destinations");

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
  `;
  return card;
}

function showError(message) {
  container.innerHTML = `<p class="error">${message}</p>`;
}

async function loadDestinations() {
  try {
    const response = await fetch("data/destinations.json");

    if (!response.ok) {
      throw new Error("Kon bestemmingen niet laden.");
    }

    const destinations = await response.json();
    container.innerHTML = "";

    destinations.forEach((destination) => {
      container.appendChild(renderCard(destination));
    });

    initGalleries(container);
  } catch (error) {
    showError(error.message);
  }
}

loadDestinations();
