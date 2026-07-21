const container = document.getElementById("destinations");

function renderCard(destination) {
  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `
    <h2>${destination.name}</h2>
    <p class="dates">${destination.dates}</p>
    <p>${destination.description}</p>
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
