# Portugal Familievakantie 2026

Eenvoudige statische webapp om onze vakantiebestemmingen te tonen.

## Bestanden

| Bestand | Functie |
|---------|---------|
| `index.html` | Paginastructuur: titel en container voor de kaarten |
| `styles.css` | Opmaak van de pagina en bestemmingskaarten |
| `app.js` | Laadt `data/destinations.json` en tekent de kaarten |
| `data/destinations.json` | Gegevens van alle bestemmingen (naam, datums, beschrijving) |

## Lokaal openen

Open `index.html` via een lokale webserver (nodig voor `fetch`):

```bash
python3 -m http.server 8000
```

Ga daarna naar [http://localhost:8000](http://localhost:8000).
