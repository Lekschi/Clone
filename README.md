# Neustadt

Ein Städtebauspiel für iPad und Browser in 3D. Du baust Straßen und Wohngebiete, stellst in Fabriken
Rohstoffe her, verarbeitest sie in Läden zu Waren und baust damit die Häuser deiner Bürger aus –
vom Einfamilienhaus bis zum Wolkenkratzer. Strom, Wasser, Abwasser, Müllabfuhr, Feuerwehr, Polizei
und Gesundheit wollen geplant sein; Parks, Schulen, Kinos und Wahrzeichen lassen die Stadt wachsen.

Alles – Gebäude, Landschaft, Texturen, Icons und Töne – wird im Code erzeugt. Es gibt **keine
Echtgeld-Käufe**: Kristalle verdienst du durch Stufenaufstiege, Aufgaben, Tagesbonus und Lieferungen.

## Spielinhalte

- **Wohngebiete** mit 8 Ausbaustufen; jeder Ausbau verlangt Material, bringt Einwohner, Münzen, Erfahrung
  und manchmal Bauteile
- **Versorgung**: Windrad, Kohle-, Solar-, Gas- und Kernkraftwerk; Wasserturm, Pumpwerk, Wasserwerk;
  Kläranlagen; Mülldeponie, Müllheizkraftwerk, Recyclingzentrum
- **Dienste** mit Einzugsradius: Feuerwehr, Polizei, Gesundheit. Ungeschützte Häuser können brennen.
- **Industrie**: Fabrik, Großfabrik, Öko-Fabrik mit parallelen Produktionsplätzen (10 Rohstoffe)
- **Handel**: 8 Läden mit Warteschlange und 40 Waren in Produktionsketten, Marktplatz zum Kaufen und
  Verkaufen, Güterbahnhof mit Lieferaufträgen
- **Freizeit**: Parks, Bildung, Unterhaltung und Wahrzeichen erhöhen die Einwohnerzahl im Umkreis
- **Lager** mit Ausbau über Bauteile, **Landerweiterung** in 8×8-Grundstücken
- **Aufgaben**, Stufen bis 40, Tagesbonus, Steuern im Rathaus, Zufriedenheit, Abgase, Ansichten für
  Abdeckung und Versorgung
- Realistische Darstellung: Umgebungsverdeckung (AO), Bloom, physikalischer Himmel mit Sonnenauf- und
  -untergang, Sternen und Mond, spiegelnde Glasfassaden mit Oberflächenrelief, animiertes Wasser,
  Wetter (Wolken, Regen, nasse Straßen), im Wind wiegende Bäume
- Leben in der Stadt: Autos, Lieferwagen und Busse mit Scheinwerfern und Bremsverhalten, Fußgänger,
  Vogelschwärme, Schiffe, Flugzeuge mit Kondensstreifen, Springbrunnen, Baustellen mit Gerüst und Kran
- Grafikstufen Ultra / Hoch / Schnell; Kamera mit Schwung, Neigung (zwei Finger hoch/runter)
- Gebäude verschieben, abreißen, drehen; Touch-Steuerung (ziehen, zoomen, mit zwei Fingern drehen)

## Speichern

- **Automatisch lokal**: jede Änderung wird sofort im Browser gespeichert.
- **Online**: Läuft das Spiel über den mitgelieferten Server (`server/server.js`), wird der Spielstand
  zusätzlich online gesichert. Jedes Gerät bekommt ein Konto; mit dem **Sync-Code** (Einstellungen)
  spielst du auf einem anderen Gerät weiter. Beim Start gewinnt automatisch der neuere Stand.
- Export/Import als Datei in den Einstellungen.

## Starten

```bash
npm install
npm run dev            # Entwicklung: http://localhost:5173
npm run build          # Produktions-Build nach dist/
npm run server         # Spiel + Online-Speicher: http://localhost:8080
```

### Online stellen

- **Kostenlos auf claude.ai (empfohlen)**: `npm run artifact` erzeugt `artifact/` (Seite + Dateien); veröffentlicht
  als Claude-Artifact speichert das Spiel jeden Spielstand privat im Claude-Konto des Spielers, und der
  Weltmarkt läuft über die gemeinsame Datenbank des Artifacts. Mitspieler brauchen Zugriff mindestens als
  „Mitwirkende/r“ (Contributor), um online zu speichern; wer nur ansehen darf, spielt mit lokalem Speicher.

- **Mit Online-Speicherung**: den Ordner auf einem Node-Host (z. B. Render, Railway, Fly.io, eigener
  Server) mit `npm ci && npm run build && npm run server` starten, oder das `Dockerfile` verwenden.
  Spielstände liegen in `server/data/` (bzw. `DATA_DIR`).
- **Nur statisch** (GitHub Pages): Unter *Settings → Pages → Source: GitHub Actions* einschalten; jeder
  Push auf `main` baut und veröffentlicht das Spiel. Ohne Server wird lokal gespeichert. In den
  Einstellungen des Spiels kann eine Server-Adresse eingetragen werden, um trotzdem online zu sichern.

Auf dem iPad in Safari öffnen und über *Teilen → Zum Home-Bildschirm* als App installieren.

## Code-Überblick

| Ordner | Inhalt |
| --- | --- |
| `src/data` | Gebäude, Waren, Rezepte, Fortschritt und Balancing |
| `src/game` | Spielregeln, Wirtschaft, Stadtsimulation, Aufgaben |
| `src/render` | Three.js-Szene, prozedurale Gebäude, Landschaft, Verkehr, Effekte |
| `src/ui` | HUD, Baumenü, Fenster, Sprechblasen, Touch-Steuerung |
| `src/save` | lokales Speichern und Online-Synchronisierung |
| `server` | Speicher-Server ohne Abhängigkeiten |
