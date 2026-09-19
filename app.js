// ============================================================================
// Frostwave — baut alle drei Seiten aus daten/shop.json und reagiert auf Klicks.
//
// Es gibt drei Seiten: index.html (Home), product.html und contact.html.
// Jede sagt im <body data-seite="…">, wer sie ist — start() ruft dann nur die
// Teile auf, die es auf dieser Seite gibt. Kopf, Fuß und Warenkorb laufen
// überall; der Korb liegt im Browser und bleibt beim Seitenwechsel erhalten.
//
// Inhaltliches (Preise, Farben, Texte) steht NICHT hier, sondern in
// daten/shop.json. Diese Datei musst du nur anfassen, wenn sich das Verhalten
// der Seite ändern soll.
//
// Alle Zahlen, die Druck machen (Live-Besucher, Verkäufe, Countdown,
// Lieferdatum, Ersparnis), werden aus echten Daten gerechnet. Erfundene Zähler
// und Bestseller-Behauptungen sind in der EU verboten (UWG-Anhang).
// ============================================================================

const $ = (id) => document.getElementById(id);
const seite = document.body.dataset.seite;

let daten = null;
let auswahl = { variante: null, menge: 1 };
let korb = [];            // [{ variante: "black", anzahl: 2 }]

// Zum Ausprobieren: ?datum=2026-11-20 an die Adresse hängen, dann tut die
// Seite so, als wäre dieser Tag (für Lieferdatum und Weihnachts-Countdown).
const testDatum = new URLSearchParams(location.search).get('datum');
const jetzt = () => {
  if (!testDatum) return new Date();
  const d = new Date(`${testDatum}T${new Date().toTimeString().slice(0, 8)}`);
  return isNaN(d) ? new Date() : d;
};

// ---------- Hilfen -----------------------------------------------------------

const euro = (cent) =>
  (cent / 100).toLocaleString('en-IE', { style: 'currency', currency: 'EUR' });

const datumKurz = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Baut ein Element. Text wird immer als Text gesetzt, nie als HTML.
function el(tag, eigenschaften = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(eigenschaften)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const kind of kinder) if (kind != null) e.append(kind);
  return e;
}

const variante = (id) => daten.produkt.varianten.find((v) => v.id === id);

// ---------- Preise (in Cent, damit nichts krumm rundet) ----------------------

const einzelCent = () => Math.round(daten.produkt.einzelpreis * 100);
const rabatt = () => daten.produkt.zweitesStueckRabatt;
const zweitesCent = () => Math.round(einzelCent() * (100 - rabatt()) / 100);

// Jedes zweite Stück im Korb bekommt den Rabatt — auch bei gemischten Farben.
function preisFuer(stueck) {
  return Math.ceil(stueck / 2) * einzelCent() + Math.floor(stueck / 2) * zweitesCent();
}
const ohneRabatt = (stueck) => stueck * einzelCent();

// ---------- Werktage ---------------------------------------------------------

function werktageVerschieben(datum, tage) {
  const d = new Date(datum);
  const schritt = Math.sign(tage);
  let rest = Math.abs(tage);
  while (rest > 0) {
    d.setDate(d.getDate() + schritt);
    if (d.getDay() !== 0 && d.getDay() !== 6) rest--;
  }
  return d;
}

// ---------- Start ------------------------------------------------------------

async function start() {
  // Ganz zuerst, noch vor dem Laden der Daten: sonst blitzt der Schriftzug
  // beim Neuladen mitten auf der Seite kurz auf.
  kopfScrollen();

  daten = await fetch('daten/shop.json').then((r) => r.json());
  const bew = await fetch('daten/bewertungen.json').then((r) => r.json()).catch(() => ({ bewertungen: [] }));

  auswahl.variante = daten.produkt.varianten[0].id;
  korb = korbLaden();

  // Überall
  marke();
  leiste();
  fuss();
  korbEinrichten();
  korbZeichnen();

  if (seite === 'home') {
    held();
    homePreis();
    homeKaufleiste();
    weihnachten();
    verkauftAbzeichen();
    vorteile();
    vergleich();
    bewertungen(bew.bewertungen || []);
  }

  if (seite === 'product') {
    held();
    galerie();
    farben();
    mengen();
    preisAnzeigen();
    lieferdatum();
    weihnachten();
    verkauftAbzeichen();
    liveZaehler();
    kaufpunkte();
    fakten();
    faq();
    kaufleiste();
  }

  if (seite === 'contact') {
    kontakt();
    faq();
  }
}

// Der Markenname steht nur in shop.json. Überall, wo data-marke steht, wird
// er eingesetzt — im Logo klein geschrieben, sonst wie in shop.json.
function marke() {
  const name = daten.shop.name;
  document.querySelectorAll('[data-marke]').forEach((e) => {
    e.textContent = e.closest('.marke') ? name.toLowerCase() : name;
  });
}

// Beim Runterscrollen soll nur die Navigation samt Warenkorb oben kleben
// bleiben — der Schriftzug blendet sich aus und scrollt mit dem Inhalt weg.
function kopfScrollen() {
  const kopf = document.querySelector('.kopf');
  if (!kopf) return;

  // Ein unsichtbarer Fühler von 60 Pixeln Höhe ganz oben auf der Seite:
  // sobald er aus dem Bild ist, ist genug gescrollt. Zuverlässiger als das
  // Mitzählen der Scroll-Position — greift auch, wenn jemand die Seite
  // mitten im Text neu lädt oder über den Zurück-Knopf kommt.
  const fuehler = el('div');
  fuehler.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:60px;pointer-events:none;';
  fuehler.setAttribute('aria-hidden', 'true');
  document.body.prepend(fuehler);

  new IntersectionObserver(([e]) => {
    kopf.classList.toggle('gescrollt', !e.isIntersecting);
  }).observe(fuehler);
}

// ---------- Ankündigungsleiste ----------------------------------------------

function leiste() {
  const s = daten.shop;
  const botschaften = [
    `Free shipping to ${s.versandLaender}`,
    `Buy 2 — the 2nd headband is ${rabatt()}% off`,
    'Up to 10 hours of music — a full ski day',
    'Fits under your helmet or beanie',
  ];
  const text = $('leiste-text');
  let i = 0;
  text.textContent = botschaften[0];
  setInterval(() => {
    text.classList.add('weg');
    setTimeout(() => {
      i = (i + 1) % botschaften.length;
      text.textContent = botschaften[i];
      text.classList.remove('weg');
    }, 350);
  }, 4000);
}

// ---------- Held -------------------------------------------------------------

// Setzt Text nur, wenn es das Element auf dieser Seite gibt.
function text(id, inhalt) {
  const e = $(id);
  if (e) e.textContent = inhalt;
}

function held() {
  const p = daten.produkt;
  text('beschreibung', p.beschreibung);
  text('pass-name', p.name);
  text('pass-untertitel', p.untertitel);
  text('galerie-abzeichen', `−${rabatt()}% on the 2nd`);
  text('band-rabatt', `The 2nd headband is ${rabatt()}% off.`);
  text('zusage-rueckgabe', `${daten.shop.rueckgabeTage}-day returns`);
}

// Startseite: Preis und Angebot als Anreiz, gekauft wird auf der Produktseite.
function homePreis() {
  text('vergleich-preis', euro(einzelCent()));
  for (const stelle of ['home', 'schluss']) {
    text(`${stelle}-preis`, euro(einzelCent()));
    text(`${stelle}-angebot`, `2nd headband −${rabatt()}%`);
  }
}

// Startseite am Handy: Leiste unten mit Preis und Knopf, sobald die Knöpfe im
// Startfoto weggescrollt sind. Verschwindet wieder beim Abschluss-Aufruf unten,
// damit dort nicht zwei Knöpfe übereinander stehen.
function homeKaufleiste() {
  const leiste = $('kaufleiste');
  const knopf = $('kaufleiste-knopf');
  text('kaufleiste-preis', euro(einzelCent()));
  text('kaufleiste-hinweis', `2nd headband −${rabatt()}%`);

  let obenWeg = false;
  let untenDa = false;
  const setzen = () => {
    const zeigen = obenWeg && !untenDa;
    leiste.classList.toggle('sichtbar', zeigen);
    leiste.setAttribute('aria-hidden', String(!zeigen));
    knopf.tabIndex = zeigen ? 0 : -1;
  };
  new IntersectionObserver(([e]) => {
    obenWeg = !e.isIntersecting && e.boundingClientRect.top < 0;
    setzen();
  }).observe($('held-knoepfe'));
  new IntersectionObserver(([e]) => {
    untenDa = e.isIntersecting;
    setzen();
  }).observe(document.querySelector('.schluss'));
}

// Produktseite: die wichtigsten Gründe als Häkchen direkt über dem Kaufknopf.
function kaufpunkte() {
  const box = $('kaufpunkte');
  if (!box) return;
  for (const punkt of daten.produkt.kaufpunkte || []) box.append(el('li', { text: punkt }));
}

function galerie() {
  const bilder = daten.produkt.galerie;
  const leiste = $('galerie-leiste');
  bilder.forEach((b, i) => {
    leiste.append(
      el('button', {
        class: 'galerie-daumen',
        type: 'button',
        'aria-label': `Show photo: ${b.text}`,
        'aria-current': i === 0 ? 'true' : 'false',
        onclick: () => galerieZeigen(b.bild),
      }, el('img', { src: b.bild, alt: '', loading: 'lazy' })),
    );
  });
  galerieZeigen(bilder[0].bild, true);
}

function galerieZeigen(bild, sofort = false) {
  const eintrag = daten.produkt.galerie.find((b) => b.bild === bild);
  const gross = $('galerie-gross');

  document.querySelectorAll('.galerie-daumen').forEach((d, i) => {
    d.setAttribute('aria-current', daten.produkt.galerie[i].bild === bild ? 'true' : 'false');
  });

  const setzen = () => {
    gross.src = bild;
    gross.alt = eintrag ? `Headband: ${eintrag.text}` : '';
    $('galerie-text').textContent = eintrag ? eintrag.text : '';
    gross.classList.remove('wechselt');
  };
  if (sofort || gross.getAttribute('src') === bild) return setzen();
  gross.classList.add('wechselt');
  setTimeout(setzen, 180);
}

// ---------- Skipass-Karte ----------------------------------------------------

function farben() {
  const box = $('farben');
  for (const v of daten.produkt.varianten) {
    box.append(el('button', {
      class: 'farbe',
      type: 'button',
      style: `background:${v.farbe}`,
      'aria-label': v.name,
      'aria-pressed': String(v.id === auswahl.variante),
      'data-id': v.id,
      onclick: () => {
        auswahl.variante = v.id;
        box.querySelectorAll('.farbe').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === v.id)));
        $('farbe-name').textContent = v.name;
        galerieZeigen(v.bild);
      },
    }));
  }
  $('farbe-name').textContent = variante(auswahl.variante).name;
}

function mengen() {
  const optionen = [
    { menge: 1, name: '1 headband', hinweis: null, abzeichen: [] },
    {
      menge: 2,
      name: '2 headbands',
      hinweis: `2nd one −${rabatt()}% · ${euro(preisFuer(2) / 2)} each`,
      abzeichen: [['BEST VALUE', ''], [`−${rabatt()}%`, 'rabatt']],
    },
  ];

  const box = $('mengen');
  for (const o of optionen) {
    const preis = preisFuer(o.menge);
    const vorher = ohneRabatt(o.menge);
    box.append(el('button', {
      class: 'menge',
      type: 'button',
      'aria-pressed': String(o.menge === auswahl.menge),
      'data-menge': o.menge,
      onclick: () => {
        auswahl.menge = o.menge;
        box.querySelectorAll('.menge').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.menge) === o.menge)));
        preisAnzeigen();
      },
    },
      o.abzeichen.length
        ? el('span', { class: 'menge-abzeichen' }, ...o.abzeichen.map(([t, k]) => el('span', { class: k, text: t })))
        : null,
      el('span', { class: 'menge-punkt', 'aria-hidden': 'true' }),
      el('span', { class: 'menge-name', text: o.name }, o.hinweis ? el('span', { class: 'menge-hinweis', text: o.hinweis }) : null),
      el('span', { class: 'menge-preis' }, vorher > preis ? el('s', { text: euro(vorher) }) : null, euro(preis)),
    ));
  }

  $('pass').addEventListener('submit', (e) => {
    e.preventDefault();
    inDenKorb(auswahl.variante, auswahl.menge);
  });
}

function preisAnzeigen() {
  const preis = preisFuer(auswahl.menge);
  const vorher = ohneRabatt(auswahl.menge);
  const gespart = vorher - preis;

  $('preis').textContent = euro(preis);
  $('preis-vorher').textContent = gespart > 0 ? euro(vorher) : '';
  $('preis-ersparnis').textContent = `You save ${euro(gespart)}`;
  $('preis-ersparnis').hidden = gespart <= 0;

  $('kaufleiste-preis').textContent = euro(preis);
  $('kaufleiste-hinweis').textContent = gespart > 0
    ? `2 headbands · you save ${euro(gespart)}`
    : `Add a 2nd for −${rabatt()}%`;
}

// „Order today — arrives Sep 24 – Oct 2", aus der Lieferzeit gerechnet.
function lieferdatum() {
  const { lieferzeitMin, lieferzeitMax } = daten.shop;
  const heute = jetzt();
  const text = $('lieferung-text');
  text.replaceChildren(
    'Order today, arrives ',
    el('strong', { text: `${datumKurz(werktageVerschieben(heute, lieferzeitMin))} – ${datumKurz(werktageVerschieben(heute, lieferzeitMax))}` }),
  );
}

// Countdown bis zum letzten Bestelltag für Lieferung vor Weihnachten.
// Nur zwischen weihnachtenAktivAb und diesem Tag sichtbar — die Frist ist echt.
function weihnachten() {
  const { weihnachtenAktivAb, lieferzeitMax } = daten.shop;
  const klein = $('weihnachten');
  const gross = $('weihnachten-gross');

  const aktualisieren = () => {
    const heute = jetzt();
    const jahr = heute.getFullYear();
    const [monat, tag] = weihnachtenAktivAb.split('-').map(Number);
    const ab = new Date(jahr, monat - 1, tag);
    const frist = werktageVerschieben(new Date(jahr, 11, 24), -lieferzeitMax);
    frist.setHours(23, 59, 59, 999);

    const rest = frist - heute;
    const aktiv = heute >= ab && rest > 0;
    if (klein) klein.hidden = !aktiv;
    if (gross) gross.hidden = !aktiv;
    if (!aktiv) return;

    const t = Math.floor(rest / 86_400_000);
    const h = Math.floor(rest / 3_600_000) % 24;
    const m = Math.floor(rest / 60_000) % 60;
    const s = Math.floor(rest / 1000) % 60;
    const zwei = (n) => String(n).padStart(2, '0');
    const uhr = `${t}d ${zwei(h)}h ${zwei(m)}m ${zwei(s)}s`;

    klein?.replaceChildren('🎁 Order within ', el('strong', { text: uhr }), ' to get it before Christmas');
    gross?.replaceChildren('🎁 Last day to order for Christmas: ', el('strong', { text: datumKurz(frist) }), ` — ${t} days left`);
  };

  aktualisieren();
  setInterval(aktualisieren, 1000);
}

// „250+ sold" — nur wenn die echte Zahl in shop.json die Schwelle erreicht.
function verkauftAbzeichen() {
  const { verkauft, verkauftAnzeigenAb } = daten.shop;
  if (!$('verkauft') || !verkauft || verkauft < verkauftAnzeigenAb) return;
  const stufen = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  const stufe = stufen.filter((s) => s <= verkauft).pop();
  $('verkauft').textContent = `🔥 ${stufe.toLocaleString('en-US')}+ sold`;
  $('verkauft').hidden = false;
}

// Echte Besucher, gezählt vom Server (server.mjs). Ab zwei Personen sichtbar —
// „1 person is viewing this" wäre ja nur man selbst.
function liveZaehler() {
  if (location.hostname.endsWith('github.io')) return;   // dort gibt es keinen Server
  let id;
  try {
    id = sessionStorage.getItem('frostwave-besuch');
    if (!id) sessionStorage.setItem('frostwave-besuch', (id = crypto.randomUUID()));
  } catch {
    id = crypto.randomUUID();
  }

  const box = $('live');
  let takt;
  const melden = async () => {
    try {
      const antwort = await fetch('api/live', { method: 'POST', body: id });
      if (!antwort.ok) throw new Error();
      const { jetzt: anzahl } = await antwort.json();
      box.hidden = anzahl < 2;
      $('live-text').replaceChildren(el('strong', { text: String(anzahl) }), ' people are looking at this right now');
    } catch {
      // Kein Server mit Zähler (z. B. GitHub Pages) → Anzeige bleibt weg,
      // und wir hören auf, alle 15 Sekunden vergeblich zu fragen.
      box.hidden = true;
      clearInterval(takt);
    }
  };
  melden();
  takt = setInterval(melden, 15_000);
}

// ---------- Vorteile und Vergleich ------------------------------------------

const SYMBOLE = {
  ohr: '<path d="M8 10a4 4 0 1 1 8 0c0 2.8-3 3.3-3 6a2.5 2.5 0 0 1-5 0"/><path d="M10.5 10a1.5 1.5 0 0 1 3 0"/>',
  helm: '<path d="M4 16a8 8 0 0 1 16 0z"/><path d="M12 8v3.5M8 10l1.5 2.5M16 10l-1.5 2.5"/>',
  sturz: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>',
  akku: '<rect x="3" y="7" width="16" height="10" rx="3"/><path d="M21.5 11v2M7 10.5v3M10.5 10.5v3M14 10.5v3"/>',
};

function vorteile() {
  const box = $('vorteile');
  if (!box) return;   // auf der Startseite seit 2026-09-15 weg (doppelt zur Tabelle)
  for (const v of daten.produkt.vorteile) {
    const symbol = el('span', { class: 'vorteil-symbol', 'aria-hidden': 'true' });
    symbol.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SYMBOLE[v.symbol] || SYMBOLE.sturz}</svg>`;
    box.append(el('article', { class: 'vorteil' }, symbol, el('h3', { text: v.titel }), el('p', { text: v.text })));
  }
}

function vergleich() {
  const v = daten.produkt.vergleich;
  const zelle = (wert, klasse) => {
    if (wert === '{einzelpreis}') wert = euro(einzelCent());
    if (wert === true) return el('td', { class: klasse }, el('span', { class: 'haken', 'aria-label': 'Yes', text: '✓' }));
    if (wert === false) return el('td', { class: klasse }, el('span', { class: 'kreuz', 'aria-label': 'No', text: '✕' }));
    return el('td', { class: `${klasse} preis-zelle`, text: wert });
  };
  $('vergleich').append(
    el('thead', {}, el('tr', {},
      el('th', { scope: 'col' }),
      el('th', { scope: 'col', class: 'wir', text: v.wir }),
      el('th', { scope: 'col', text: v.die }),
    )),
    el('tbody', {}, ...v.zeilen.map((z) => el('tr', {},
      el('td', { text: z.was }),
      zelle(z.wir, 'wir'),
      zelle(z.die, ''),
    ))),
  );
}

// ---------- Fakten, Bewertungen, Fragen, Fuß --------------------------------

function fakten() {
  const box = $('fakten');
  for (const f of daten.produkt.fakten) {
    box.append(el('div', {}, el('dt', { text: f.was }), el('dd', { text: f.wert })));
  }
}

function bewertungen(liste) {
  if (!liste.length) return;
  const schnitt = liste.reduce((s, b) => s + b.sterne, 0) / liste.length;
  $('bewertungen-schnitt').textContent =
    `${schnitt.toLocaleString('en-US', { maximumFractionDigits: 1 })} out of 5 from ${liste.length} ${liste.length === 1 ? 'review' : 'reviews'}`;
  const box = $('bewertungen');
  for (const b of liste) {
    box.append(el('article', { class: 'bewertung' },
      el('div', { class: 'bewertung-sterne', 'aria-label': `${b.sterne} out of 5 stars`, text: '★'.repeat(b.sterne) + '☆'.repeat(5 - b.sterne) }),
      el('p', { text: b.text }),
      el('footer', { text: [b.name, b.ort].filter(Boolean).join(', ') }),
    ));
  }
  $('bewertungen-abschnitt').hidden = false;
}

function faq() {
  const box = $('faq');
  if (!box) return;
  for (const f of daten.faq) {
    box.append(el('details', {}, el('summary', { text: f.frage }), el('p', { text: f.antwort })));
  }
}

function fuss() {
  const mail = daten.shop.mail;
  $('fuss-mail').textContent = mail;
  $('fuss-mail').href = `mailto:${mail}`;
}

// ---------- Kontaktseite -----------------------------------------------------

// Das Formular schickt nichts an einen Server: Es öffnet das Mailprogramm mit
// fertig ausgefüllter Nachricht an die Adresse aus shop.json. So landet jede
// Anfrage als normale E-Mail im Postfach, und man antwortet einfach darauf.
function kontakt() {
  const s = daten.shop;
  text('antwortzeit', s.antwortzeit);
  text('kontakt-mail', s.mail);
  $('kontakt-mail').href = `mailto:${s.mail}`;
  text('info-versand', `${s.versandLaender}, ${s.lieferzeitMin}–${s.lieferzeitMax} business days.`);
  text('info-rueckgabe', `Within ${s.rueckgabeTage} days of delivery.`);

  const formular = $('kontakt-formular');
  const hinweis = $('kontakt-hinweis');
  formular.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(formular));
    const fehlt = ['name', 'email', 'nachricht'].find((feld) => !String(f[feld] || '').trim());
    if (fehlt || !formular.email.checkValidity()) {
      hinweis.textContent = fehlt === 'name' ? 'Please tell us your name.'
        : fehlt === 'nachricht' ? 'Please write a short message.'
        : 'Please enter a valid email address.';
      hinweis.classList.add('fehler');
      formular[fehlt || 'email'].focus();
      return;
    }
    hinweis.classList.remove('fehler');

    const betreff = `${f.thema}${f.bestellung ? ` (order ${f.bestellung})` : ''} — ${f.name}`;
    const inhalt = [
      f.nachricht,
      '',
      '—',
      `Name: ${f.name}`,
      `Email: ${f.email}`,
      f.bestellung ? `Order: ${f.bestellung}` : null,
    ].filter((z) => z != null).join('\n');

    location.href = `mailto:${s.mail}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(inhalt)}`;
    hinweis.textContent = `Your email app should open now. If not, write to ${s.mail}.`;
  });
}

// ---------- Kaufleiste am Handy ---------------------------------------------

function kaufleiste() {
  const leiste = $('kaufleiste');
  const knopf = $('kaufleiste-knopf');
  knopf.addEventListener('click', () => inDenKorb(auswahl.variante, auswahl.menge));

  // Sichtbar, sobald die Skipass-Karte nach oben aus dem Bild gescrollt ist.
  new IntersectionObserver(([eintrag]) => {
    const weg = !eintrag.isIntersecting && eintrag.boundingClientRect.top < 0;
    leiste.classList.toggle('sichtbar', weg);
    leiste.setAttribute('aria-hidden', String(!weg));
    knopf.tabIndex = weg ? 0 : -1;
  }).observe($('pass'));
}

// ---------- Warenkorb --------------------------------------------------------

// Der Korb liegt im Browser des Besuchers. Kein Tracking, keine Cookies.
function korbLaden() {
  try {
    const roh = JSON.parse(localStorage.getItem('frostwave-korb') || '[]');
    return roh.filter((z) => variante(z.variante) && z.anzahl > 0);
  } catch {
    return [];
  }
}
function korbSpeichern() {
  try { localStorage.setItem('frostwave-korb', JSON.stringify(korb)); } catch { /* privates Fenster */ }
}

const stueckImKorb = () => korb.reduce((s, z) => s + z.anzahl, 0);

function hinzufuegen(id, anzahl) {
  const zeile = korb.find((z) => z.variante === id);
  if (zeile) zeile.anzahl += anzahl;
  else korb.push({ variante: id, anzahl });
  korbSpeichern();
  korbZeichnen();
}

function inDenKorb(id, anzahl) {
  hinzufuegen(id, anzahl);
  korbOeffnen();
  const zahl = $('korb-zahl');
  zahl.classList.remove('huepft');
  void zahl.offsetWidth;
  zahl.classList.add('huepft');
}

function anzahlAendern(id, delta) {
  const zeile = korb.find((z) => z.variante === id);
  if (!zeile) return;
  zeile.anzahl += delta;
  if (zeile.anzahl <= 0) korb = korb.filter((z) => z !== zeile);
  korbSpeichern();
  korbZeichnen();
}

function korbZeichnen() {
  const stueck = stueckImKorb();
  const zahl = $('korb-zahl');
  zahl.textContent = stueck;
  zahl.hidden = stueck === 0;

  const inhalt = $('korb-inhalt');
  const fuss = $('korb-fuss');
  inhalt.replaceChildren();
  fuss.replaceChildren();

  if (!stueck) {
    inhalt.append(el('p', { class: 'korb-leer', text: 'Your cart is empty — your ears are getting cold.' }));
    fuss.append(seite === 'product'
      ? el('button', { class: 'knopf knopf-still', type: 'button', text: 'Pick a colour', onclick: korbSchliessen })
      : el('a', { class: 'knopf knopf-still', href: 'product.html', text: 'Pick a colour' }));
    return;
  }

  for (const z of korb) {
    const v = variante(z.variante);
    inhalt.append(el('div', { class: 'korb-zeile' },
      el('img', { src: v.bild, alt: '' }),
      el('div', {},
        el('div', { class: 'korb-zeile-name', text: daten.produkt.name }),
        el('div', { class: 'korb-zeile-farbe', text: v.name }),
        el('div', { class: 'zaehler' },
          el('button', { type: 'button', 'aria-label': `One less ${v.name}`, text: '−', onclick: () => anzahlAendern(v.id, -1) }),
          el('span', { 'aria-live': 'polite', text: String(z.anzahl) }),
          el('button', { type: 'button', 'aria-label': `One more ${v.name}`, text: '+', onclick: () => anzahlAendern(v.id, 1) }),
        ),
      ),
      el('button', { class: 'korb-entfernen', type: 'button', text: 'Remove', onclick: () => anzahlAendern(v.id, -z.anzahl) }),
    ));
  }

  // Ungerade Anzahl: das nächste Stück ist das rabattierte.
  if (stueck % 2 === 1) {
    inhalt.append(el('div', { class: 'korb-angebot' },
      el('strong', { text: `Add a 2nd headband for just ${euro(zweitesCent())}` }),
      el('div', { class: 'korb-angebot-knoepfe' }, ...daten.produkt.varianten.map((v) =>
        el('button', { type: 'button', onclick: () => hinzufuegen(v.id, 1) },
          el('i', { style: `background:${v.farbe}`, 'aria-hidden': 'true' }), `Add ${v.name.toLowerCase()}`),
      )),
    ));
  }

  const gesamt = preisFuer(stueck);
  const vorher = ohneRabatt(stueck);
  fuss.append(...[
    el('div', { class: 'korb-summe' }, el('span', { text: `Subtotal (${stueck})` }), el('span', { text: euro(vorher) })),
    vorher > gesamt
      ? el('div', { class: 'korb-summe korb-summe-rabatt' }, el('span', { text: `2nd headband −${rabatt()}%` }), el('span', { text: '−' + euro(vorher - gesamt) }))
      : null,
    el('div', { class: 'korb-summe' }, el('span', { text: 'Shipping' }), el('span', { text: 'Free' })),
    el('div', { class: 'korb-summe korb-summe-gesamt' }, el('span', { text: 'Total' }), el('span', { text: euro(gesamt) })),
    el('button', { class: 'knopf knopf-signal', type: 'button', text: 'Checkout', onclick: kasse }),
    el('p', { id: 'korb-hinweis', class: 'korb-hinweis', 'aria-live': 'polite' }),
  ].filter(Boolean));
}

// HIER KOMMT SPÄTER DIE BEZAHLUNG REIN (z. B. Stripe Checkout oder Shopify).
function kasse() {
  $('korb-hinweis').textContent = 'Orders open soon. Your cart is saved.';
}

function korbEinrichten() {
  $('knopf-korb').addEventListener('click', korbOeffnen);
  $('korb-zu').addEventListener('click', korbSchliessen);
  $('korb-schatten').addEventListener('click', korbSchliessen);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') korbSchliessen(); });
}

function korbOeffnen() {
  $('korb-schatten').hidden = false;
  $('korb').classList.add('offen');
  $('korb').setAttribute('aria-hidden', 'false');
  $('korb-zu').focus();
}

function korbSchliessen() {
  $('korb-schatten').hidden = true;
  $('korb').classList.remove('offen');
  $('korb').setAttribute('aria-hidden', 'true');
}

start();
