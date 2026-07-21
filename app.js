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

function renderCard(destination) {
  const card = document.createElement("article");
  card.className = "card";

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
  } catch (error) {
    showError(error.message);
  }
}

loadDestinations();
