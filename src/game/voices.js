// "Stimmen der Stadt": what residents say about their home and the city. Quotes depend on the
// actual state of the house (utilities, services, pollution, fire, happiness, wishes) so they
// double as gentle hints. Picks are stable for a while so a panel does not flicker.
import { BUILDINGS } from '../data/buildings.js';

const FIRST = ['Anna', 'Ben', 'Clara', 'David', 'Emma', 'Felix', 'Greta', 'Hannes', 'Ida', 'Jonas', 'Karla', 'Leon', 'Mia', 'Noah', 'Olga', 'Paul', 'Rosa', 'Sami', 'Tilda', 'Umut', 'Vera', 'Willi', 'Yara', 'Zoe', 'Aylin', 'Bruno', 'Ella', 'Finn', 'Hedi', 'Ole', 'Pia', 'Theo'];
const LAST = ['B.', 'K.', 'M.', 'S.', 'W.', 'H.', 'R.', 'T.', 'L.', 'N.', 'F.', 'Ö.'];
const AGES = [8, 12, 17, 23, 29, 34, 41, 47, 55, 63, 71, 79];
const COLORS = ['#e8794a', '#4a9be8', '#58b368', '#c45ab3', '#e2b23a', '#3fb0a9', '#d8574f', '#7a6fd8'];

const Q = {
  noRoad: ['Wie sollen wir hier überhaupt hinkommen? Es gibt nicht mal eine Straße!', 'Ohne Straße liefert uns nicht mal der Pizzadienst.'],
  power: ['Wir sitzen schon wieder im Dunkeln. Strom wäre schön!', 'Mein Kühlschrank ist warm und mein Handy leer. Wo bleibt der Strom?'],
  water: ['Kein Wasser aus dem Hahn – ich kann mir nicht mal die Zähne putzen.', 'Duschen fällt heute wieder aus. Wir brauchen dringend Wasser.'],
  sewage: ['Hier riecht es nicht gut. Ein Abwasseranschluss wäre angebracht.', 'Die Toilette spült, aber wohin eigentlich? Wir brauchen eine Kanalisation.'],
  waste: ['Die Mülltonnen quellen über. Wann kommt endlich die Müllabfuhr?', 'Die Waschbären feiern jede Nacht an unseren Mülltonnen.'],
  fire: ['Es brennt!! Schnell, holt die Feuerwehr!', 'Unsere Wohnung steht in Flammen – bitte helft uns!'],
  fireOk: ['Gut zu wissen, dass die Feuerwache gleich um die Ecke ist.', 'Die Sirene war laut, aber die Feuerwehr war in zwei Minuten da!'],
  noFire: ['Ich schlafe schlecht – im Viertel gibt es keine Feuerwache.', 'Wenn es hier brennt, wer kommt dann eigentlich?'],
  noPolice: ['Abends traue ich mich nicht mehr allein raus. Mehr Polizei bitte!', 'Bei Nachbarn wurde eingebrochen. Wo ist die Polizei?'],
  noHealth: ['Bis zum nächsten Arzt fahre ich eine halbe Stunde.', 'Mit meinem Knie würde ich mich über ein Ärztehaus in der Nähe freuen.'],
  smog: ['Die Luft hier schmeckt nach Fabrik. Ich hätte gern einen Park statt Schornsteinen.', 'Meine Wäsche wird draußen grau. Die Fabriken sind zu nah!'],
  noFun: ['Hier gibt es nichts zu tun. Ein Park oder ein Kino wäre toll.', 'Meine Kinder langweilen sich. Ein Spielplatz oder Park in der Nähe?'],
  wish: ['Wir würden so gern anbauen! Hast du die Materialien?', 'Die Familie wächst – ein Stockwerk mehr wäre perfekt.', 'Wir lieben es hier. Lass uns das Haus ausbauen!'],
  happy: ['Schönste Straße der Stadt, finde ich.', 'Morgens ein Kaffee auf dem Balkon, die Vögel zwitschern – herrlich.', 'Ich ziehe hier nie wieder weg.', 'Unser Bürgermeister macht einen tollen Job!', 'So eine saubere, ruhige Gegend.', 'Die Nachbarn sind nett und alles ist in der Nähe.'],
  park: ['Ich jogge jeden Morgen durch den Park nebenan.', 'Der Park vor der Tür ist einfach ein Traum.'],
  max: ['Ein Penthouse mit Aussicht über ganz {city} – besser geht es nicht.', 'Von hier oben sehe ich bis zum Meer.'],
  okay: ['Ganz nett hier, aber es geht noch besser.', 'Eigentlich gefällt es mir, nur fehlt noch ein bisschen was.', 'Ich bin zufrieden. Meistens.'],
  workers: ['Nach der Schicht freue ich mich auf mein kleines Reihenhaus.', 'Die Fabrik ist nah – ich bin in fünf Minuten bei der Arbeit.'],
  villa: ['Der Pool ist frisch gereinigt, der Rasen gemäht. Was will man mehr?', 'Ruhe und Grün – genau deswegen sind wir in die Villa gezogen.'],
  eco: ['Unsere Solarzellen liefern heute mehr Strom, als wir brauchen.', 'Wir bauen Tomaten auf dem Dach an. Bio, natürlich!'],
  rain: ['Bei dem Regen bleibe ich lieber drinnen mit einem Buch.'],
  night: ['Die Stadt sieht nachts mit all den Lichtern wunderschön aus.', 'Psst, die Kinder schlafen schon.'],
};

function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = Math.imul(n, 9); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); return (n ^ (n >>> 15)) >>> 0; }

export function resident(seed) {
  const h = hash(seed);
  return { name: `${FIRST[h % FIRST.length]} ${LAST[(h >>> 5) % LAST.length]}`, age: AGES[(h >>> 9) % AGES.length], color: COLORS[(h >>> 13) % COLORS.length] };
}

// pick the most pressing topic for a house, then a quote from it
export function residentVoice(game, b, inf, opts = {}) {
  const S = game.state;
  const lvl = S.level;
  const topics = [];
  if (b.fire) topics.push('fire');
  else if (!inf.road) topics.push('noRoad');
  else if (inf.missing?.length) topics.push(...inf.missing.filter((k) => Q[k]));
  else {
    if (inf.polluted) topics.push('smog');
    if (lvl >= BUILDINGS.firesmall.level && !inf.services?.fire) topics.push('noFire');
    if (lvl >= BUILDINGS.policesmall.level && !inf.services?.police) topics.push('noPolice');
    if (lvl >= BUILDINGS.clinic.level && !inf.services?.health) topics.push('noHealth');
    if (!topics.length) {
      if (!(inf.boostPct > 0)) topics.push('noFun');
      else if (b.level >= 8) topics.push('max', 'happy');
      else if (b.wish) topics.push('wish');
      else if (inf.happy >= 65) topics.push('happy', b.type in Q ? b.type : 'happy', inf.boost?.park ? 'park' : 'happy', inf.services?.fire ? 'fireOk' : 'happy');
      else topics.push('okay');
      if (opts.night) topics.push('night');
      if (opts.rain) topics.push('rain');
    }
  }
  const bucket = Math.floor(Date.now() / 25000);
  const h = hash(b.id * 7919 + bucket);
  const topic = topics[h % topics.length];
  const list = Q[topic] || Q.okay;
  const text = list[(h >>> 7) % list.length].replace('{city}', S.name || 'Neustadt');
  const who = resident(b.id * 31 + (bucket % 3));
  const mood = ['fire', 'noRoad', 'power', 'water', 'sewage', 'waste'].includes(topic) ? 'bad' : ['smog', 'noFire', 'noPolice', 'noHealth', 'noFun', 'okay'].includes(topic) ? 'meh' : 'good';
  return { ...who, text, topic, mood };
}

// a handful of voices from across the city for the overview panel
export function cityVoices(game, n = 3, opts = {}) {
  const houses = game.state.buildings.filter((b) => BUILDINGS[b.type].cat === 'res' && b.built <= Date.now());
  if (!houses.length) return [];
  const bucket = Math.floor(Date.now() / 25000);
  const out = [];
  const seen = new Set();
  for (let k = 0; k < houses.length * 2 && out.length < n; k++) {
    const b = houses[hash(bucket * 131 + k) % houses.length];
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    const inf = game.info.get(b.id);
    if (!inf) continue;
    out.push({ ...residentVoice(game, b, inf, opts), bid: b.id });
  }
  return out;
}

export function voiceHTML(v, extra = '') {
  const initials = v.name.split(' ').map((p) => p[0]).join('');
  return `<div class="voice ${v.mood}"${extra}>
    <div class="voice-av" style="background:${v.color}">${initials}</div>
    <div class="voice-body"><p>„${v.text}“</p><span>${v.name}, ${v.age} Jahre</span></div>
  </div>`;
}
