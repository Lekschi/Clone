# Meridian

An isometric city builder made for iPad. Lay roads, zone land, keep the power and water flowing,
fund services, run buses and trains, shape the hills, balance the budget, and grow a settlement
into a skyline. Available in **English and German** (picked automatically from the device language,
switchable in Settings).

It is plain HTML/JavaScript with no build step and no downloaded assets. Every building, tree,
road and icon is drawn in code, so the whole game is about 400 KB.

## Play on your iPad

1. Host the folder over HTTPS. The easiest way is GitHub Pages: in the repository go to
   **Settings → Pages → Build and deployment → Source: GitHub Actions**. After that, every push
   to `main` deploys automatically (see `.github/workflows/pages.yml`). Your game will be at
   `https://<your-user>.github.io/<repo>/`.
2. Open that address in **Safari** on the iPad.
3. Tap **Share → Add to Home Screen**. Meridian then opens full screen from its own icon, works
   offline, and Safari will not clear your saved cities.

To run it locally: `python3 -m http.server` in this folder, then open `http://localhost:8000`.

## What's in it

**Launcher** (`index.html`)
- Live, animated city diorama behind the menu, cycling through day and night
- New city wizard: name generator, 5 terrain types (Riverlands, Coastline, Lake District, Bay,
  Open Plains), 3 landscapes (flat, rolling hills, mountains), 3 map sizes, 3 starting budgets,
  live terrain preview
- Saved cities with thumbnails, play / export / delete, import from file
- Settings (language, sound, lighting, autosave, graphics) and a field guide

**Game** (`game.html`)
- Zoning: residential, commercial and industrial lots in low, medium and high density. Buildings
  grow through 6 tiers; four adjacent high-density towers can merge into a 2×2 complex.
- Utilities: coal, wind, solar, gas and nuclear power; water pumps, towers and a water works.
  Power and water run along roads (mains under the streets), and power lines reach plants that
  are off the road network.
- Services: police, fire, clinics, hospitals, schools, library, high school, university, each
  with a coverage radius and a funding level.
- Terrain: hills and mountains with sloped roads and rail; buildings on slopes stand on stone
  foundations. Raise, lower and level tools. Hilltop views raise land value.
- Public transport: bus stops and depots (buses drive the streets), railways with bridges and level
  crossings, train stations and a freight yard (animated trains), and four-lane highways. Transit
  takes cars off the road; highway and rail links to the map edge raise demand.
- Parks and landmarks: pocket parks, playgrounds, squares, pond garden, central park, sports
  ground, city hall, museum, stadium, observation spire
- Simulation: demand for R/C/I, land value, pollution, crime, traffic, education, health,
  approval, unemployment, building fires, abandonment
- Economy: per-zone taxes, department budgets, monthly ledger, loans, history graphs
- Milestones (Settlement → Megacity) unlock buildings, denser zoning and cash grants
- Data views: power, water, land value, pollution, crime, traffic, transit and service coverage
- Advisors and a news ticker, a building inspector, and a minimap
- Day/night cycle with lit windows, street lights, headlights and aviation beacons. Animated
  traffic, smoke, steam, wind turbines and water.
- Saving: autosaves to IndexedDB every minute and whenever the app goes to the background;
  export/import as `.meridian.json` backup files

## Controls

| Touch | Mouse / keyboard |
| --- | --- |
| Two fingers: pan and pinch-zoom | Wheel: zoom · right-drag: pan · WASD/arrows: pan |
| One finger with **Look**: pan; tap to inspect | Click to inspect |
| One finger with a tool: drag roads/zones, place buildings (✓ to confirm) | Click/drag to build |
| | Space: pause · 1–3: speed · R: road · B: bulldoze · Esc: cancel |

## Code map

```
js/world/world.js     map data, terrain generation, build/zone/bulldoze ops, save format
js/world/sim.js       networks, coverage, growth, fires, demand, budget, advisors
js/render/art.js      isometric painting kit (boxes, roofs, cylinders, windows, shadows)
js/render/ground.js   terrain, water, roads, zones, trees, pylons
js/render/buildings.js all building art
js/render/sprites.js  lazy sprite cache with night and abandoned variants
js/render/renderer.js camera, chunked ground cache, depth-sorted objects, traffic, particles
js/ui/hud.js          toolbar, drawers, panels, inspector, ticker
js/i18n.js            translation helper, number/currency/date formatting
js/lang/de.js         German strings (keys are the English text)
js/game.js            game loop, input, tools, saving
js/launcher.js        launcher screens and backdrop
```
