// Launcher: animated diorama backdrop, new-city wizard, saved cities, settings, field guide.
import { World } from './world/world.js';
import { SpriteBank } from './render/sprites.js';
import { Renderer } from './render/renderer.js';
import { buildDemoCity, drawMapPreview } from './demo.js';
import { icon } from './ui/icons.js';
import { LOGO, dateStr, fmt, money } from './ui/hud.js';
import { MAP_TYPES, MAP_SIZES, DIFFICULTY, MILESTONES, HILLS } from './data/defs.js';
import { cityName } from './util/rng.js';
import * as store from './storage.js';
import { sfx, setSound, unlock } from './audio.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VERSION = '1.0';

// ---------- backdrop ----------
const bank = new SpriteBank();
const demo = buildDemoCity(7);
const cv = $('#bg');
const R = new Renderer(cv, demo, bank);
R.cam.zoom = window.innerWidth < 800 ? 0.62 : 0.9;
R.timeOfDay = 0.36;
let t0 = performance.now();
const settings = store.getSettings();
setSound(settings.sound);
R.dayNight = true;
function loop(t) {
  const k = (t - t0) / 1000;
  const cx = 30 + Math.cos(k * 0.035) * 7, cy = 28 + Math.sin(k * 0.035) * 6;
  R.centerOn(cx, cy);
  // keep the city off to the right of the menu panel on landscape screens
  if (window.innerWidth > 820) R.cam.x -= 200 / R.cam.zoom;
  else R.cam.y += 140 / R.cam.zoom;
  R.timeOfDay = (0.36 + k / 140) % 1;
  R.draw(t);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.addEventListener('resize', () => { R.resize(); R.cam.zoom = window.innerWidth < 800 ? 0.62 : 0.9; });

// ---------- screens ----------
const lp = $('#lp');
lp.innerHTML = `
  <header><div class="wm">${LOGO}<h1>Meridian</h1></div>
  <p class="tag">Lay the streets, zone the blocks, keep the lights on — and watch a town become a skyline.</p></header>
  <div class="screens" id="screens"></div>
  <footer><span>Version ${VERSION}</span><span id="storeNote">Progress saves on this device</span></footer>`;
const screens = $('#screens');
let current = null;

function show(name, back) {
  const el = document.createElement('section');
  el.className = 'screen ' + (back ? 'off-l' : 'off-r');
  const html = SCREENS[name]();
  el.innerHTML = html.html;
  screens.appendChild(el);
  const old = current;
  requestAnimationFrame(() => {
    el.classList.remove('off-l', 'off-r');
    if (old) { old.classList.add(back ? 'off-r' : 'off-l'); setTimeout(() => old.remove(), 340); }
  });
  current = el;
  el.querySelectorAll('[data-back]').forEach((b) => b.onclick = () => { sfx.close(); show('home', true); });
  html.bind && html.bind(el);
}

const SCREENS = {
  home() {
    return {
      html: `<div id="homeList"></div>`,
      async bind(el) {
        const list = await store.listCities().catch(() => []);
        const last = list[0];
        const items = [];
        if (last) items.push({ id: 'continue', t: 'Continue', s: `${esc(last.name)} · ${fmt(last.pop)} residents · ${dateStr(last.day)}`, primary: true });
        items.push({ id: 'new', t: 'New city', s: 'Choose terrain, size and starting budget', primary: !last });
        items.push({ id: 'cities', t: 'Your cities', s: list.length ? `${list.length} saved` : 'Import a city file', dis: false });
        items.push({ id: 'settings', t: 'Settings', s: 'Sound, lighting, autosave, install' });
        items.push({ id: 'guide', t: 'Field guide', s: 'How cities grow, and the touch controls' });
        $('#homeList', el).innerHTML = items.map((it, k) => `<button class="mi ${it.primary ? 'primary' : ''}" data-go="${it.id}"><span class="n">${String(k + 1).padStart(2, '0')}</span><span><div class="t">${it.t}</div><div class="s">${it.s}</div></span>${icon('arrow')}</button>`).join('');
        el.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => {
          unlock(); sfx.open();
          const g = b.dataset.go;
          if (g === 'continue') location.href = `game.html?id=${encodeURIComponent(last.id)}`;
          else show(g);
        });
      },
    };
  },

  new() {
    const st = { name: cityName(), type: 'river', size: 'medium', diff: 'normal', hills: 'rolling', seed: (Math.random() * 1e9) | 0 };
    return {
      html: `<div class="sh"><button data-back aria-label="Back">${icon('back')}</button><h2>Found a new city</h2></div>
        <div class="field"><span class="cap">City name</span><div class="namebox"><input id="nm" maxlength="28" value="${esc(st.name)}" autocomplete="off" spellcheck="false"><button id="nmDice" aria-label="Random name">${icon('dice')}</button></div></div>
        <div class="field"><span class="cap">Terrain</span><div class="types" id="types">${Object.entries(MAP_TYPES).map(([k, v]) => `<button data-t="${k}" class="${k === st.type ? 'on' : ''}">${v.name}</button>`).join('')}</div></div>
        <div class="preview"><canvas id="pv" width="760" height="380"></canvas><div class="pd" id="pd"></div><button class="reroll" id="reroll">${icon('dice')}New land</button></div>
        <div class="field"><span class="cap">Landscape</span><div class="seg full" id="hl">${Object.entries(HILLS).map(([k, v]) => `<button data-v="${k}" class="${k === st.hills ? 'on' : ''}">${v}</button>`).join('')}</div></div>
        <div class="field"><span class="cap">Map size</span><div class="seg full" id="sz">${Object.entries(MAP_SIZES).map(([k, v]) => `<button data-v="${k}" class="${k === st.size ? 'on' : ''}">${k[0].toUpperCase() + k.slice(1)} · ${v}²</button>`).join('')}</div></div>
        <div class="field"><span class="cap">Starting budget</span><div class="seg full" id="df">${Object.entries(DIFFICULTY).map(([k, v]) => `<button data-v="${k}" class="${k === st.diff ? 'on' : ''}">${v.name}<br><small style="font-weight:500;opacity:.75">${money(v.funds)}</small></button>`).join('')}</div></div>
        <button class="found" id="found">${icon('landmark')}Found ${esc(st.name)}</button>`,
      bind(el) {
        let world = null;
        const regen = () => {
          world = new World(MAP_SIZES[st.size], MAP_SIZES[st.size]);
          world.generate({ seed: st.seed, mapType: st.type, difficulty: st.diff, name: st.name, hills: st.hills });
          drawMapPreview(world, $('#pv', el));
          $('#pd', el).textContent = MAP_TYPES[st.type].desc;
        };
        const label = () => { $('#found', el).innerHTML = `${icon('landmark')}Found ${esc(st.name || 'city')}`; };
        regen();
        $('#nm', el).oninput = (e) => { st.name = e.target.value.trim() || 'Unnamed'; label(); };
        $('#nmDice', el).onclick = () => { st.name = cityName(); $('#nm', el).value = st.name; label(); sfx.tap(); };
        $('#reroll', el).onclick = () => { st.seed = (Math.random() * 1e9) | 0; regen(); sfx.tap(); };
        el.querySelectorAll('#types button').forEach((b) => b.onclick = () => { st.type = b.dataset.t; el.querySelectorAll('#types button').forEach((x) => x.classList.toggle('on', x === b)); regen(); sfx.tap(); });
        const seg = (id, key, re) => el.querySelectorAll(`#${id} button`).forEach((b) => b.onclick = () => { st[key] = b.dataset.v; el.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle('on', x === b)); if (re) regen(); sfx.tap(); });
        seg('sz', 'size', true); seg('df', 'diff', false); seg('hl', 'hills', true);
        $('#found', el).onclick = async () => {
          unlock(); sfx.build();
          world.name = st.name || 'Unnamed';
          const D = DIFFICULTY[st.diff]; world.difficulty = st.diff; world.funds = D.funds; world.costMul = D.costMul;
          world.settings.disasters = settings.disasters;
          const id = store.newId();
          try { await store.saveCity(id, world, null); }
          catch (e) { alert('Storage is not available in this browser mode. Progress cannot be saved.'); }
          location.href = `game.html?id=${encodeURIComponent(id)}`;
        };
      },
    };
  },

  cities() {
    return {
      html: `<div class="sh"><button data-back aria-label="Back">${icon('back')}</button><h2>Your cities</h2></div>
        <div class="citylist" id="cl"></div>
        <div class="btnrow" style="margin-top:16px"><label class="btn ghost" style="cursor:pointer">${icon('import')}Import city file<input type="file" id="imp" accept=".json,application/json" hidden></label></div>
        <div class="note">Cities are stored in this browser on this device. Use <b>Export</b> to keep a backup file in the Files app.</div>`,
      async bind(el) {
        const render = async () => {
          const list = await store.listCities().catch(() => []);
          $('#cl', el).innerHTML = list.length ? list.map((c) => `<div class="city">
              ${c.thumb ? `<img src="${c.thumb}" alt="">` : '<div class="noimg"></div>'}
              <div><div class="cn">${esc(c.name)}</div><div class="cs">${MILESTONES[c.milestone || 0].name} · ${fmt(c.pop)} residents<br>${dateStr(c.day)} · ${money(c.funds)} · saved ${new Date(c.updated).toLocaleDateString()}</div></div>
              <div class="ca"><button class="play" data-play="${c.id}">${icon('play')}Play</button><button data-exp="${c.id}">${icon('export')}Export</button><button data-del="${c.id}" aria-label="Delete">${icon('trash')}</button></div>
            </div>`).join('') : `<div class="empty">No cities yet. Found your first one from the main menu.</div>`;
          el.querySelectorAll('[data-play]').forEach((b) => b.onclick = () => { location.href = `game.html?id=${encodeURIComponent(b.dataset.play)}`; });
          el.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
            const c = list.find((x) => x.id === b.dataset.del);
            if (!confirm(`Delete “${c.name}” permanently?`)) return;
            await store.deleteCity(c.id); sfx.bulldoze(); render();
          });
          el.querySelectorAll('[data-exp]').forEach((b) => b.onclick = async () => {
            const c = list.find((x) => x.id === b.dataset.exp);
            const txt = await store.exportCity(c.id);
            const name = c.name.replace(/[^\w-]+/g, '_') + '.meridian.json';
            const file = new File([txt], name, { type: 'application/json' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: c.name }); return; } catch (e) { /* fall back */ } }
            const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
          });
        };
        await render();
        $('#imp', el).onchange = async (e) => {
          const f = e.target.files[0]; if (!f) return;
          try { await store.importCity(await f.text()); sfx.cash(); render(); }
          catch (err) { alert('Could not import: ' + err.message); }
        };
      },
    };
  },

  settings() {
    const st = store.getSettings();
    const tg = (k, label, sub) => `<label class="toggle"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="sw"><input type="checkbox" data-set="${k}" ${st[k] ? 'checked' : ''}><i></i></span></label>`;
    const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    return {
      html: `<div class="sh"><button data-back aria-label="Back">${icon('back')}</button><h2>Settings</h2></div>
        ${tg('sound', 'Sound effects')}
        ${tg('dayNight', 'Day & night cycle', 'Windows and street lights come on after dusk.')}
        ${tg('confirmBuild', 'Confirm placements', 'Shows ✓ / ✕ before a building is placed by touch.')}
        ${tg('disasters', 'Building fires', 'Random fires that fire stations fight.')}
        <label class="toggle"><span>Autosave</span><span class="seg" id="as">${[30, 60, 120, 300].map((v) => `<button data-v="${v}" class="${st.autosave === v ? 'on' : ''}">${v < 60 ? v + 's' : v / 60 + 'm'}</button>`).join('')}</span></label>
        <label class="toggle"><span>Graphics</span><span class="seg" id="q">${['high', 'low'].map((v) => `<button data-v="${v}" class="${st.quality === v ? 'on' : ''}">${v === 'high' ? 'High' : 'Battery saver'}</button>`).join('')}</span></label>
        <div class="note">${standalone ? '<b>Installed.</b> Meridian is running as a home-screen app, so your saves are kept.' :
          '<b>Install on iPad:</b> tap the Share button in Safari, then <b>Add to Home Screen</b>. Meridian then opens full-screen, works offline, and Safari will not clear your saved cities.'}</div>`,
      bind(el) {
        el.querySelectorAll('[data-set]').forEach((c) => c.onchange = () => { st[c.dataset.set] = c.checked; store.setSettings(st); setSound(st.sound); Object.assign(settings, st); sfx.tap(); });
        const seg = (id, key, num) => el.querySelectorAll(`#${id} button`).forEach((b) => b.onclick = () => { st[key] = num ? +b.dataset.v : b.dataset.v; store.setSettings(st); el.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle('on', x === b)); sfx.tap(); });
        seg('as', 'autosave', true); seg('q', 'quality', false);
      },
    };
  },

  guide() {
    return {
      html: `<div class="sh"><button data-back aria-label="Back">${icon('back')}</button><h2>Field guide</h2></div>
      <div class="guide">
        <h3>Touch controls</h3>
        <div class="gest"><div><b>Two fingers</b>Pan and pinch-zoom, any time</div><div><b>One finger</b>Draw roads, paint zones, place buildings</div>
        <div><b>Look tool</b>One finger pans; tap a building to inspect it</div><div><b>Data views</b>Power, water, land value, crime and more</div></div>
        <h3>Your first ten minutes</h3>
        <ol>
          <li><b>Road</b> — drag a road in from the edge of the map. That edge link brings new residents in.</li>
          <li><b>Zone</b> — paint residential (green), commercial (blue) and industrial (amber) lots within 3 tiles of a road.</li>
          <li><b>Power</b> — place a coal plant or wind turbines. Power flows along roads and through neighbouring lots; use power lines to reach a distant plant.</li>
          <li><b>Water</b> — build a pump beside water. Mains run under your roads. Medium and high density need it.</li>
          <li><b>Services</b> — police, fire, clinics and schools raise approval and land value.</li>
        </ol>
        <h3>Reading the city</h3>
        <ul>
          <li>The <b>R C I</b> bars show demand. Zone more of whatever is high.</li>
          <li>Buildings upgrade when <b>land value</b> and services are good, and decline near pollution and crime.</li>
          <li>Four high-density towers side by side can merge into a landmark complex.</li>
          <li>Growing population unlocks new buildings, denser zoning and grants.</li>
          <li>Taxes above 9% slow growth; the Budget panel shows next month’s balance.</li>
        </ul>
        <h3>Saving</h3>
        <p>Your city saves automatically every minute and whenever you leave the app. Export a file from <b>Your cities</b> for a backup.</p>
      </div>`,
    };
  },
};

show('home');
store.requestPersistence().then((p) => { if (p) $('#storeNote').textContent = 'Saves are kept on this device'; });
