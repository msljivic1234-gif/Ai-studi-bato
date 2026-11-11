const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\9910a7c2-afe2-47a8-869e-6bf36b85f57c';

// Mock react-native-svg & jsx-runtime to extract phosphor vector SVGs natively
const origRequire = Module.prototype.require;
Module.prototype.require = function(modPath) {
  if (modPath === 'react/jsx-runtime') {
    return {
      jsx: (t, p) => typeof t === 'function' ? t(p) : (Array.isArray(p?.children) ? p.children.join('') : (p?.children || '')),
      jsxs: (t, p) => typeof t === 'function' ? t(p) : (Array.isArray(p?.children) ? p.children.join('') : (p?.children || '')),
      Fragment: ({ children }) => Array.isArray(children) ? children.join('') : (children || '')
    };
  }
  if (modPath === 'react-native-svg') {
    return {
      Path: (p) => `<path d="${p.d}" ${p.fill ? `fill="${p.fill}"` : ''} ${p.opacity ? `opacity="${p.opacity}"` : ''} />`,
      Circle: (p) => `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" ${p.fill ? `fill="${p.fill}"` : ''} />`,
      Line: (p) => `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" />`,
      Rect: (p) => `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" />`
    };
  }
  return origRequire.apply(this, arguments);
};

function toBase64Uri(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return '';
  const ext = path.extname(full).toLowerCase().replace('.', '');
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  const data = fs.readFileSync(full).toString('base64');
  return `data:${mime};base64,${data}`;
}

// Phosphor icon defs mapping from src/ui/system/Glyph.tsx
const GLYPH_MAP = {
  // Navigacija & kretanje
  'back': { file: 'ArrowLeft', sr: 'Nazad / Povratak', cat: 'Navigacija' },
  'close': { file: 'X', sr: 'Zatvori / Odbaci', cat: 'Navigacija' },
  'caret-right': { file: 'CaretRight', sr: 'Sledeće / Detalji', cat: 'Navigacija' },
  'caret-left': { file: 'CaretLeft', sr: 'Prethodno', cat: 'Navigacija' },
  'caret-down': { file: 'CaretDown', sr: 'Otvori padajući meni', cat: 'Navigacija' },
  'caret-up': { file: 'CaretUp', sr: 'Zatvori padajući meni', cat: 'Navigacija' },
  'arrow-right': { file: 'ArrowRight', sr: 'Kreni napred / Nastavi', cat: 'Navigacija' },
  'arrow-up': { file: 'ArrowUp', sr: 'Pomeri nagore', cat: 'Navigacija' },
  'arrow-up-right': { file: 'ArrowUpRight', sr: 'Eksterni link / Izlaz', cat: 'Navigacija' },
  'refresh': { file: 'ArrowClockwise', sr: 'Osveži podatke / Ponovo', cat: 'Navigacija' },
  'expand': { file: 'ArrowsOutSimple', sr: 'Prikaz preko celog ekrana', cat: 'Navigacija' },
  'external': { file: 'ArrowSquareOut', sr: 'Otvori spoljni pregledač', cat: 'Navigacija' },

  // Akcije & upravljanje
  'plus': { file: 'Plus', sr: 'Dodaj / Novi unos', cat: 'Akcije' },
  'minus': { file: 'Minus', sr: 'Oduzmi / Smanji', cat: 'Akcije' },
  'check': { file: 'Check', sr: 'Potvrdi / Završeno', cat: 'Akcije' },
  'send': { file: 'PaperPlaneTilt', sr: 'Pošalji poruku / Ponudu', cat: 'Akcije' },
  'search': { file: 'MagnifyingGlass', sr: 'Pretraga poslova i gradova', cat: 'Akcije' },
  'filters': { file: 'SlidersHorizontal', sr: 'Filteri i sortiranje', cat: 'Akcije' },
  'more': { file: 'DotsThree', sr: 'Više opcija / Dodatni meni', cat: 'Akcije' },
  'trash': { file: 'Trash', sr: 'Obriši zadatak ili nacrt', cat: 'Akcije' },
  'edit': { file: 'PencilSimpleLine', sr: 'Izmeni profil ili detalje', cat: 'Akcije' },
  'settings': { file: 'GearSix', sr: 'Podešavanja naloga i notifikacija', cat: 'Akcije' },
  'cancel': { file: 'Prohibit', sr: 'Otkaži / Blokiraj', cat: 'Akcije' },

  // Multimedija & Unos
  'camera': { file: 'Camera', sr: 'Slikaj kamerom telefona', cat: 'Mediji i Unos' },
  'image': { file: 'Image', sr: 'Izaberi sliku iz galerije', cat: 'Mediji i Unos' },
  'mic': { file: 'Microphone', sr: 'Glasovni AI unos (mikrofon)', cat: 'Mediji i Unos' },
  'wave': { file: 'Waveform', sr: 'Audio talas / Glasovna poruka', cat: 'Mediji i Unos' },
  'keyboard': { file: 'Keyboard', sr: 'Prebaci na unos tastaturom', cat: 'Mediji i Unos' },

  // Bezbednost & Nalog
  'eye': { file: 'Eye', sr: 'Prikaži lozinku / podatak', cat: 'Nalog & Sigurnost' },
  'eye-off': { file: 'EyeSlash', sr: 'Sakrij lozinku / podatak', cat: 'Nalog & Sigurnost' },
  'shield': { file: 'ShieldCheck', sr: 'Verifikovan profil / Sigurnost', cat: 'Nalog & Sigurnost' },
  'profile': { file: 'User', sr: 'Korisnički profil / Majstor', cat: 'Nalog & Sigurnost' },
  'logout': { file: 'SignOut', sr: 'Odjava sa naloga', cat: 'Nalog & Sigurnost' },

  // Tab & Kontekst
  'home': { file: 'House', sr: 'Glavni tab: Početna', cat: 'Glavna Navigacija' },
  'map': { file: 'MapTrifold', sr: 'Glavni tab: Zadaci (Mapa)', cat: 'Glavna Navigacija' },
  'agreements': { file: 'Handshake', sr: 'Glavni tab: Dogovori', cat: 'Glavna Navigacija' },
  'messages': { file: 'ChatText', sr: 'Glavni tab: Poruke (Inbox)', cat: 'Glavna Navigacija' },

  // Činjenice o zadatku
  'location': { file: 'MapPin', sr: 'Lokacija i udaljenost', cat: 'Činjenice Zadatka' },
  'remote': { file: 'GlobeHemisphereWest', sr: 'Rad na daljinu (Remote)', cat: 'Činjenice Zadatka' },
  'people': { file: 'Users', sr: 'Broj potrebnih radnika', cat: 'Činjenice Zadatka' },
  'tool': { file: 'Wrench', sr: 'Potreban alat majstora', cat: 'Činjenice Zadatka' },
  'vehicle': { file: 'Truck', sr: 'Potreban prevoz ili kombi', cat: 'Činjenice Zadatka' },
  'calendar': { file: 'CalendarBlank', sr: 'Datum i fleksibilni rokovi', cat: 'Činjenice Zadatka' },
  'notifications': { file: 'Bell', sr: 'Notifikacije i obaveštenja', cat: 'Činjenice Zadatka' },
  'info': { file: 'Info', sr: 'Informativni savet i vodič', cat: 'Činjenice Zadatka' }
};

function getPhosphorSvg(defFileName, weight = 'regular', color = 'currentColor') {
  const defPath = path.join(ROOT, 'node_modules', 'phosphor-react-native', 'lib', 'commonjs', 'defs', `${defFileName}.js`);
  if (!fs.existsSync(defPath)) return '';
  try {
    const def = require(defPath).default;
    const body = def.get(weight) || def.get('regular') || '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="100%" height="100%" fill="${color}">${body}</svg>`;
  } catch (err) {
    return '';
  }
}

const ITEMS_BRAND = [
  {
    name: 'USKOČI App Ikona (icon.png)',
    file: 'assets/brand/app-icon/icon.png',
    role: 'Google Play Store i ikona aplikacije na telefonu (1024x1024 / 512x512)',
    desc: 'Smaragdno-zeleni squircle sa belim reljefnim skakačkim U simbolom i diskretnom senkom.',
    prompt: 'Mobile app icon, squircle shape with deep rich emerald green matte clay background (#006B4F). In the center, an embossed clean white tactile minimalist symbol: an energetic jumping U curve representing local work and helping hands. Subtle soft 3D depth, clean edges, premium App Store / Google Play icon design, 4k.'
  },
  {
    name: 'USKOČI Android Adaptivni Prednji Sloj (android-icon-foreground.png)',
    file: 'assets/brand/app-icon/android-icon-foreground.png',
    role: 'Android dinamicki lanser sloj sa providnom pozadinom',
    desc: 'Beli taktilni U simbol sa zelenim akcentom dizajniran za Android paralašku animaciju ikona.',
    prompt: 'Android adaptive app icon foreground layer, centered minimalist white tactile jumping U curve symbol with gentle rounded bevels on 100% transparent background.'
  },
  {
    name: 'USKOČI Monohromatska Ikona (android-icon-monochrome.png)',
    file: 'assets/brand/app-icon/android-icon-monochrome.png',
    role: 'Android Themed Icons (Material You) podrška',
    desc: 'Monohromatska maska prilagodljiva sistemskoj temi telefona (Material You).',
    prompt: 'Pure white minimalist silhouette of the jumping U symbol on 100% transparent background, vector precision, monochrome mask.'
  },
  {
    name: 'USKOČI AI Asistent (uskoci-assistant.png)',
    file: 'assets/ai/uskoci-assistant.png',
    role: 'Avatar AI pomoćnika u razgovoru i sastavljanju zadatka (Čisto / Danilo)',
    desc: 'Prijateljski 3D robot/asistent od gline u belim i smaragdnim tonovima sa toplim izrazom.',
    prompt: 'Friendly 3D matte clay AI assistant robot character mascot, cute minimalist rounded proportions, smooth white and soft emerald green clay body, expressive friendly glowing dot eyes, warm helpful posture, isolated on transparent pure white background.'
  },
  {
    name: 'USKOČI Splash Mark (entry-splash-mark.png)',
    file: 'assets/entry-splash-mark.png',
    role: 'Splash ekran pri pokretanju aplikacije',
    desc: 'Veliki reljefni brend amblem koji se pojavljuje pre učitavanja početnog ekrana.',
    prompt: 'Embossed 3D tactile brand emblem for USKOČI app, geometric jumping arc in emerald green and crisp white matte clay, elegant drop shadow, isolated on pure white background.'
  },
  {
    name: 'USKOČI Brend Logo (logo.png)',
    file: 'assets/brand/premium-entry/logo.png',
    role: 'Puni logotip aplikacije sa brend amblemom',
    desc: 'Puni USKOČI logotip sa karakterističnim skakačkim znakom i modernom tipografijom.',
    prompt: 'Modern clean tech logo for USKOČI app, emerald green and charcoal ink branding, minimalist aesthetic.'
  }
];

const ITEMS_NATURAL = [
  {
    name: 'money.webp (Novac & Zarada)',
    file: 'assets/illustrations/natural-v1/money.webp',
    role: 'Vrata „Uskočite i zaradite“ (Home & Welcome), Budžet, Ponude (umesto aktovke)',
    desc: 'Snop smaragdnih novčanica sa dva reljefna zlatno-mesingana novčića u prvom planu.',
    prompt: 'A tactile 2.5D clay illustration of a neat stack of crisp paper banknotes in soft emerald green tones, accompanied by two thick minted metallic golden coins resting in front. Smooth matte clay texture, rounded edges, warm studio lighting, cast shadow below, isolated on pure white background.'
  },
  {
    name: 'publish.webp (Objava zadatka)',
    file: 'assets/illustrations/natural-v1/publish.webp',
    role: 'Vrata „Objavite zadatak“ (Home & Welcome), Nova objava zadatka',
    desc: 'Beli list sa zaobljenim uglovima, linijama i zelenim krugom sa belim plusom (+).',
    prompt: 'A 2.5D matte clay illustration of a clean white sheet of paper or task card with soft rounded corners and subtle grey placeholder lines, featuring a vibrant emerald green circular badge with a bold white plus sign (+) on the bottom right corner. Minimalist, tactile, isolated on white background.'
  },
  {
    name: 'workbag.webp (Zanati & Majstori)',
    file: 'assets/illustrations/natural-v1/workbag.webp',
    role: 'Radnički profil, zanatski alati i oprema',
    desc: 'Meka kožna zanatska torba sa ručkom, kaišem i mesinganom kopčom u toplim tonovima gline.',
    prompt: 'A minimalist 2.5D tactile clay craftsman workbag or leather tool satchel, warm earthy clay brown with smooth rounded straps and a tiny brass buckle. Friendly, handmade artisan feel, soft shadows, isolated on pure white background.'
  },
  {
    name: 'agreements.webp (Dogovori & Saradnja)',
    file: 'assets/illustrations/natural-v1/agreements.webp',
    role: 'Tab „Dogovori“, potvrđene saradnje i rukovanje',
    desc: 'Dve stilizovane apstraktne glinene ruke u čvrstom i prijateljskom stisku ruke.',
    prompt: 'A 2.5D clay illustration of two friendly abstract hands shaking in agreement (handshake). One hand in warm soft cream clay, the other in muted terracotta clay. Smooth organic forms, rounded wrists, studio lighting, isolated on pure white background.'
  },
  {
    name: 'applications.webp (Moje prijave)',
    file: 'assets/illustrations/natural-v1/applications.webp',
    role: 'Tab „Prijave“, slanje ponude na zadatak',
    desc: 'Geometrijski papirni aviončić od zelene i bele gline u poletu pod uglom od 45°.',
    prompt: 'A 2.5D tactile clay paper airplane soaring upwards towards the right at a 45-degree angle. Clean geometric facets in emerald green and crisp white matte clay, smooth lighting, soft ground shadow, isolated on pure white background.'
  },
  {
    name: 'tasks.webp (Moji zadaci)',
    file: 'assets/illustrations/natural-v1/tasks.webp',
    role: 'Pregled objavljenih zadataka korisnika',
    desc: 'Glineni clipboard sa štipaljkom i listom sa urednim kvačicama.',
    prompt: 'A 2.5D matte clay clipboard with a silver metal clip holding a clean white checklist with three neat rounded task lines and soft green checkmarks. Tactile, friendly, rounded bevels, isolated on pure white background.'
  },
  {
    name: 'offers.webp (Pregled ponuda)',
    file: 'assets/illustrations/natural-v1/offers.webp',
    role: 'Pristigle ponude radnika na zadatak',
    desc: 'Bela kartica sa novčićem i indikatorom ponude za dogovor.',
    prompt: 'A 2.5D tactile clay task card showing an emerald coin and badge representing worker job bids and offers, rounded geometry, soft ambient light, isolated on white background.'
  },
  {
    name: 'calendar.webp (Datum & Rokovi)',
    file: 'assets/illustrations/natural-v1/calendar.webp',
    role: 'Izbor datuma, fleksibilni rokovi, vreme izvršenja',
    desc: 'Stoni blok-kalendar od bele gline sa narandžastim zaglavljem i spiralama.',
    prompt: 'A 2.5D tactile clay desk calendar with soft rounded corners, orange-accent top binding with white spiral rings, showing a clear numeric page. Smooth matte finish, clean drop shadow, isolated on pure white background.'
  },
  {
    name: 'clock.webp (Sat & Vreme)',
    file: 'assets/illustrations/natural-v1/clock.webp',
    role: 'Satnica zadatka, vreme početka i trajanje',
    desc: 'Okrugli analogni sat sa zelenim prstenom, belim brojčanikom i crnim kazaljkama.',
    prompt: 'A 2.5D clay alarm clock or wall clock with a soft emerald green bezel, clean white dial face, and simple rounded hands pointing at 10:10. Tactile claymorphism, friendly round proportions, isolated on pure white background.'
  },
  {
    name: 'users.webp (Kandidati & Broj radnika)',
    file: 'assets/illustrations/natural-v1/users.webp',
    role: 'Prijavljeni kandidati, izbor radnika, potreban broj ljudi',
    desc: 'Dve minimalističke apstraktne biste ljudi mekih kontura.',
    prompt: 'A 2.5D matte clay illustration of two abstract minimalist people busts side by side. Smooth organic geometric heads and shoulders in complementary tones of sage green and warm cream. Soft studio lighting, isolated on pure white background.'
  },
  {
    name: 'pin.webp (Lokacija na terenu)',
    file: 'assets/illustrations/natural-v1/pin.webp',
    role: 'Tačna lokacija zadatka na mapi',
    desc: 'Kapljičasti 3D pin u smaragdnoj boji sa belom tačkom.',
    prompt: 'A 2.5D tactile clay map location pin in bold emerald green, standing upright with a soft cast shadow below and an indented white circular center. Plump, smooth rounded bevels, isolated on pure white background.'
  },
  {
    name: 'map.webp (Pretraga & Mapa)',
    file: 'assets/illustrations/natural-v1/map.webp',
    role: 'Radijus pretrage i kretanje po celoj Srbiji',
    desc: 'Presavijena topografska mapa sa zelenom linijom putanje.',
    prompt: 'A 2.5D matte clay folded map unfolding gracefully, featuring subtle pastel contour lines and an emerald green route line with a tiny flag marker. Clean paper-like clay folds, isolated on pure white background.'
  },
  {
    name: 'home.webp (Početna & Kućni poslovi)',
    file: 'assets/illustrations/natural-v1/home.webp',
    role: 'Tab „Početna“, kućni poslovi i radovi na objektu',
    desc: 'Simpatična glinena kućica sa zelenim krovom, belim zidovima i vratima.',
    prompt: 'A charming 2.5D clay house with an emerald green gable roof, clean white clay walls, a small door, and a tiny square window. Friendly geometric architectural toy style, isolated on pure white background.'
  },
  {
    name: 'chat.webp (Poruke & Razgovor)',
    file: 'assets/illustrations/natural-v1/chat.webp',
    role: 'Direktan čet u Dogovoru i AI intervju',
    desc: 'Dva preklopljena govorna oblačića — smaragdni i beli sa tri tačkice.',
    prompt: 'A 2.5D tactile clay illustration of two overlapping chat speech bubbles: a prominent emerald green message bubble in front with rounded corners, and a smaller soft white bubble behind with three debossed dots. Isolated on pure white background.'
  },
  {
    name: 'bell.webp (Obaveštenja)',
    file: 'assets/illustrations/natural-v1/bell.webp',
    role: 'Push obaveštenja, zvonce za nove ponude i promene statusa',
    desc: 'Zlatno-narandžasto glineno zvonce sa klatnom i obručem.',
    prompt: 'A 2.5D matte clay notification bell in warm amber orange (#FF7A1A) with a rounded clapper and smooth circular top ring. Friendly, tactile, soft cast shadow, isolated on pure white background.'
  },
  {
    name: 'tool.webp (Alat & Majstorski radovi)',
    file: 'assets/illustrations/natural-v1/tool.webp',
    role: 'Veštine majstora, popravke, zanatske usluge',
    desc: 'Kutija za alat od terakota-crvene gline sa drškom i bravicom.',
    prompt: 'A 2.5D tactile clay toolbox with a sturdy top handle, clean horizontal seam, and a tiny chrome latch in the center. Minimalist workman craft aesthetic, smooth clay bevels, isolated on pure white background.'
  },
  {
    name: 'vehicle.webp (Vozilo & Transport)',
    file: 'assets/illustrations/natural-v1/vehicle.webp',
    role: 'Prevoz robe, selidbe, kombi i auto usluge',
    desc: 'Kompaktni glineni kombi u profilu sa belim prozorima i tamnim točkovima.',
    prompt: 'A 2.5D clay utility van or delivery truck seen from side profile, with rounded emerald green body, white pill-shaped windows, and thick dark charcoal clay wheels. Cute, sturdy, isolated on pure white background.'
  },
  {
    name: 'remote.webp (Rad na daljinu)',
    file: 'assets/illustrations/natural-v1/remote.webp',
    role: 'Online poslovi, programiranje, instrukcije, dizajn',
    desc: 'Monitor na postolju sa apstraktnim video-poziv avatarom.',
    prompt: 'A 2.5D matte clay desktop computer monitor resting on a small stand, displaying an abstract friendly video call avatar on its screen. Smooth rounded bezel, clean minimalist workspace feel, isolated on pure white background.'
  },
  {
    name: 'support.webp (Korisnička podrška)',
    file: 'assets/illustrations/natural-v1/support.webp',
    role: 'Pomoć, prijava problema, centar za podršku',
    desc: 'Pojas za spasavanje od bele gline sa četiri smaragdne trake.',
    prompt: 'A 2.5D tactile clay rescue lifebuoy ring in clean white with four emerald green wrap bands. Plump, smooth toroidal shape, soft lighting, isolated on pure white background.'
  },
  {
    name: 'document.webp (Dokument & Pravila)',
    file: 'assets/illustrations/natural-v1/document.webp',
    role: 'Pravila privatnosti, uslovi korišćenja, ugovor',
    desc: 'Pravni list sa presavijenim uglom, linijama i glinenim pečatom.',
    prompt: 'A 2.5D matte clay formal document sheet with a crisply dog-eared top-right corner, embossed text lines, and a small round official clay stamp seal at the bottom. Isolated on pure white background.'
  }
];

const ITEMS_DOORS = [
  {
    name: 'Objavite zadatak — Vrata za naručioce (requester.webp)',
    file: 'assets/brand/entry-v49/requester.webp',
    role: 'Kartica dobrodošlice i ulazna vrata za naručioca posla',
    desc: 'Fotorealistična/3D ilustracija naručioca sa planom zadatka.',
    prompt: 'Clean modern friendly illustration of a home owner or project requester holding a clipboard with task notes, warm ambient daylight, emerald green accent palette.'
  },
  {
    name: 'Uskočite i zaradite — Vrata za majstore i radnike (worker.jpg)',
    file: 'assets/brand/entry-v49/worker.jpg',
    role: 'Kartica dobrodošlice i ulazna vrata za izvršioce poslova',
    desc: 'Fotorealistična/3D ilustracija profesionalnog majstora spremnog za rad.',
    prompt: 'Friendly confident skilled Serbian craftsman or local worker with toolbox and clean work attire, warm optimistic look, professional lighting.'
  },
  {
    name: 'Panorama grada USKOČI (uskoci-entry-city.webp)',
    file: 'assets/brand/reference-entry/uskoci-entry-city.webp',
    role: 'Hero pozadina pri izboru grada i pokrivanju cele Srbije',
    desc: 'Stilizovana urbana panorama grada sa zgradama i lokalnom zajednicom.',
    prompt: 'Stylized modern city skyline with gentle hills, warm sunrise lighting, clean architectural silhouettes representing Serbian towns and neighborhoods.'
  }
];

const ITEMS_DISCOVERY = [
  {
    name: 'p6-pin-task.png (Zadatak Pin)',
    file: 'assets/discovery/p6-pin-task.png',
    role: 'Oznaka pojedinačnog zadatka na mapi',
    desc: 'Smaragdni kapljičasti pin sa reljefnim simbolom čekića i posla.'
  },
  {
    name: 'p6-pin-task-chosen.png (Izabrani Zadatak Pin)',
    file: 'assets/discovery/p6-pin-task-chosen.png',
    role: 'Pin zadatka kada korisnik klikne na njega na mapi',
    desc: 'Uvećani smaragdni pin sa aktivnim belim prstenom i senkom.'
  },
  {
    name: 'p6-pin-count-1.png (Kandidat Pin 1)',
    file: 'assets/discovery/p6-pin-count-1.png',
    role: 'Pin na mapi sa 1 dostupnim kandidatom',
    desc: 'Smaragdni pin sa kružnom oznakom broja 1.'
  },
  {
    name: 'p6-pin-count-2.png (Kandidat Pin 2)',
    file: 'assets/discovery/p6-pin-count-2.png',
    role: 'Pin na mapi sa 2 kandidata',
    desc: 'Smaragdni pin sa kružnom oznakom broja 2.'
  },
  {
    name: 'p6-pin-count-3.png (Kandidat Pin 3)',
    file: 'assets/discovery/p6-pin-count-3.png',
    role: 'Pin na mapi sa 3 kandidata',
    desc: 'Smaragdni pin sa kružnom oznakom broja 3.'
  },
  {
    name: 'p6-pin-count-4.png (Kandidat Pin 4+)',
    file: 'assets/discovery/p6-pin-count-4.png',
    role: 'Pin na mapi sa 4 ili više kandidata',
    desc: 'Smaragdni pin sa oznakom 4+ za grupe radnika.'
  },
  {
    name: 'uskoci-cluster-material.png (Klaster poslova)',
    file: 'assets/discovery/uskoci-cluster-material.png',
    role: 'Kada se mapa odzumira, grupiše više zadataka u jedan krug',
    desc: 'Taktilni reljefni smaragdni krug sa belim prstenom i brojem poslova u regiji.'
  },
  {
    name: 'resolved-location-pin.png (Precizna tačka adrese)',
    file: 'assets/resolved-location-pin.png',
    role: 'Potvrđena adresa izvršenja u detaljima zadatka',
    desc: 'Geolokacijska tačka verifikovane ulice i broja.'
  }
];

function generateCard(item) {
  const b64 = toBase64Uri(item.file);
  const promptHtml = item.prompt ? `
    <div class="mt-3 bg-neutral-900 text-neutral-100 p-3 rounded-lg text-xs font-mono select-all relative group">
      <div class="text-[10px] uppercase tracking-wider text-emerald-400 font-sans font-bold mb-1">ChatGPT / Midjourney Prompt:</div>
      ${item.prompt}
    </div>
  ` : '';

  return `
    <div class="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between break-inside-avoid">
      <div>
        <div class="w-full h-44 rounded-xl bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:12px_12px] bg-neutral-50 flex items-center justify-center p-3 border border-neutral-100 mb-3 relative overflow-hidden">
          <img src="${b64}" alt="${item.name}" class="max-h-36 max-w-full object-contain filter drop-shadow-md hover:scale-105 transition-transform" />
          <span class="absolute top-2 right-2 bg-neutral-900/80 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">${item.file.split('.').pop().toUpperCase()}</span>
        </div>
        <h3 class="font-bold text-neutral-900 text-base mb-1">${item.name}</h3>
        <div class="text-xs font-semibold text-emerald-700 mb-2">${item.role}</div>
        <p class="text-xs text-neutral-600 leading-relaxed">${item.desc}</p>
      </div>
      ${promptHtml}
    </div>
  `;
}

// Generate the 45 UI Glyphs grouped by category
function generateGlyphGrid() {
  const categories = {};
  for (const [key, meta] of Object.entries(GLYPH_MAP)) {
    if (!categories[meta.cat]) categories[meta.cat] = [];
    categories[meta.cat].push({ key, ...meta });
  }

  let html = '';
  for (const [catName, list] of Object.entries(categories)) {
    html += `
      <div class="mb-8 break-inside-avoid">
        <h3 class="text-lg font-bold text-neutral-800 border-b border-neutral-200 pb-2 mb-4 flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
          ${catName} (${list.length} ikonica)
        </h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
    `;

    for (const item of list) {
      const regularSvg = getPhosphorSvg(item.file, 'regular', '#102A1E');
      const boldSvg = getPhosphorSvg(item.file, 'bold', '#006B4F');
      const fillSvg = getPhosphorSvg(item.file, 'fill', '#006B4F');

      html += `
        <div class="bg-white border border-neutral-200 rounded-xl p-3 flex flex-col items-center justify-between text-center shadow-xs hover:border-emerald-300 transition-all">
          <div class="w-12 h-12 rounded-lg bg-neutral-50 flex items-center justify-center p-2.5 mb-2 border border-neutral-100">
            <div class="w-7 h-7 text-neutral-900">${boldSvg || regularSvg}</div>
          </div>
          <div class="font-mono text-xs font-bold text-neutral-900 mb-0.5 truncate w-full" title="${item.key}">${item.key}</div>
          <div class="text-[10px] text-neutral-500 font-sans line-clamp-2 leading-tight">${item.sr}</div>
          <div class="mt-2 pt-1 border-t border-neutral-100 w-full flex items-center justify-center gap-1.5 text-[9px] font-mono text-neutral-400">
            <span>20/24dp</span> • <span>Phosphor</span>
          </div>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }
  return html;
}

const html = `<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="UTF-8">
  <title>USKOČI — Zvanična vizuelna specifikacija i katalog svih ikona</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      body { background: white !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .page-break { page-break-after: always; }
      .break-inside-avoid { break-inside: avoid; }
    }
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
    body { font-family: 'Inter', sans-serif; }
    code, pre { font-family: 'JetBrains+Mono', monospace; }
  </style>
</head>
<body class="bg-neutral-100 text-neutral-900 p-4 sm:p-8">
  <div class="max-w-7xl mx-auto">

    <!-- HEADER / HERO -->
    <header class="bg-white rounded-3xl p-6 sm:p-10 border border-neutral-200 shadow-sm mb-10">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-neutral-200">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-bold tracking-wide uppercase mb-3 border border-emerald-200">
            <span class="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            Zvanični vizuelni standard • USKOČI Srbija
          </div>
          <h1 class="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">Kompletan Katalog Svih Ikona i Vizuelnih Elemenata</h1>
          <p class="text-neutral-600 text-sm sm:text-base mt-2 max-w-3xl">
            Jedinstveni referentni katalog koji objedinjuje glavnu donju navigaciju (Tab Bar), svih 45 sistemskih Phosphor vektorskih ikonica,
            21 autentičnu 2.5D glinenu ilustraciju, ulazna vrata, brend elemente i pinove za mapu.
          </p>
        </div>
        <div class="no-print flex flex-col gap-2 w-full md:w-auto">
          <button onclick="window.print()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-sm transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            Štampaj / Snimi kao PDF
          </button>
        </div>
      </div>

      <!-- DESIGN TOKENS QUICK BAR -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-2">
        <div class="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
          <div class="flex items-center gap-2 mb-1">
            <div class="w-4 h-4 rounded-md bg-[#006B4F]"></div>
            <span class="text-xs font-bold text-neutral-700">Primarna Smaragdna</span>
          </div>
          <div class="text-[11px] font-mono text-neutral-500">#006B4F (sys.color.green)</div>
        </div>
        <div class="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
          <div class="flex items-center gap-2 mb-1">
            <div class="w-4 h-4 rounded-md bg-[#FF7A1A]"></div>
            <span class="text-xs font-bold text-neutral-700">Akcentna Narandžasta</span>
          </div>
          <div class="text-[11px] font-mono text-neutral-500">#FF7A1A (sys.color.orangeInk)</div>
        </div>
        <div class="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
          <div class="flex items-center gap-2 mb-1">
            <div class="w-4 h-4 rounded-md bg-[#102A1E]"></div>
            <span class="text-xs font-bold text-neutral-700">Duboka Mastilo</span>
          </div>
          <div class="text-[11px] font-mono text-neutral-500">#102A1E (sys.color.ink)</div>
        </div>
        <div class="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
          <div class="flex items-center gap-2 mb-1">
            <div class="w-4 h-4 rounded-md bg-[#F4EFEA] border border-neutral-200"></div>
            <span class="text-xs font-bold text-neutral-700">Krem Pozadina</span>
          </div>
          <div class="text-[11px] font-mono text-neutral-500">#F4EFEA (sys.color.ground)</div>
        </div>
      </div>
    </header>

    <!-- SECTION 1: GLAVNA NAVIGACIJA (BOTTOM TAB BAR) -->
    <section class="mb-14 break-inside-avoid">
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">Sekcija 1</span>
          <h2 class="text-2xl font-extrabold text-neutral-900">Glavna Donja Navigacija (ZadaciNavigationBar)</h2>
          <p class="text-xs text-neutral-600 mt-1">
            Plutajuća bela kapsula na dnu ekrana sa 4 primarne destinacije. Svaki tab ima izabrano (aktivno smaragdno sa mekom kapsulom) i neaktivno stanje.
          </p>
        </div>
      </div>

      <!-- LIVE TAB BAR VISUALIZATION -->
      <div class="bg-neutral-900 text-white rounded-3xl p-6 sm:p-8 mb-6 shadow-md border border-neutral-800">
        <div class="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-6 flex items-center justify-between">
          <span>Stvarni izgled na telefonu (Plutajući Tab Bar):</span>
          <span class="text-[10px] bg-neutral-800 px-2.5 py-1 rounded-full text-emerald-400 font-mono">Visina: 56dp + safe area</span>
        </div>

        <div class="max-w-md mx-auto bg-white text-neutral-900 rounded-3xl p-1.5 shadow-xl border border-neutral-200 flex items-center justify-between gap-1">
          <!-- TAB 1: Početna (Aktivan) -->
          <div class="flex-1 bg-emerald-50 rounded-2xl py-2 px-1 flex flex-col items-center justify-center border border-emerald-100">
            <div class="w-6 h-6 text-[#006B4F] mb-1">
              ${getPhosphorSvg('House', 'bold', '#006B4F')}
            </div>
            <span class="text-[11px] font-bold text-[#006B4F]">Početna</span>
          </div>

          <!-- TAB 2: Zadaci (Neaktivan) -->
          <div class="flex-1 py-2 px-1 flex flex-col items-center justify-center text-neutral-500 hover:text-neutral-800 transition-colors">
            <div class="w-6 h-6 mb-1 text-neutral-500">
              ${getPhosphorSvg('MapTrifold', 'regular', '#667085')}
            </div>
            <span class="text-[11px] font-medium text-neutral-600">Zadaci</span>
          </div>

          <!-- TAB 3: Dogovori (Neaktivan) -->
          <div class="flex-1 py-2 px-1 flex flex-col items-center justify-center text-neutral-500 hover:text-neutral-800 transition-colors">
            <div class="w-6 h-6 mb-1 text-neutral-500">
              ${getPhosphorSvg('Handshake', 'regular', '#667085')}
            </div>
            <span class="text-[11px] font-medium text-neutral-600">Dogovori</span>
          </div>

          <!-- TAB 4: Poruke (Neaktivan) -->
          <div class="flex-1 py-2 px-1 flex flex-col items-center justify-center text-neutral-500 hover:text-neutral-800 transition-colors relative">
            <div class="w-6 h-6 mb-1 text-neutral-500 relative">
              ${getPhosphorSvg('ChatText', 'regular', '#667085')}
              <span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FF7A1A] rounded-full border-2 border-white"></span>
            </div>
            <span class="text-[11px] font-medium text-neutral-600">Poruke</span>
          </div>
        </div>

        <!-- SPECS TABLE BELOW TAB BAR -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-6 text-xs text-neutral-300">
          <div class="bg-neutral-800/60 p-3 rounded-xl border border-neutral-700/50">
            <div class="font-bold text-white mb-1">1. Početna (House)</div>
            <p class="text-[11px] text-neutral-400">Ulazna vrata, brze prečice („Objavite zadatak” & „Uskočite i zaradite”), moji poslovi.</p>
          </div>
          <div class="bg-neutral-800/60 p-3 rounded-xl border border-neutral-700/50">
            <div class="font-bold text-white mb-1">2. Zadaci (MapTrifold)</div>
            <p class="text-[11px] text-neutral-400">Interaktivna mapa Srbije + lista zadataka. Klasteri, pinovi, radijus pretrage i filteri.</p>
          </div>
          <div class="bg-neutral-800/60 p-3 rounded-xl border border-neutral-700/50">
            <div class="font-bold text-white mb-1">3. Dogovori (Handshake)</div>
            <p class="text-[11px] text-neutral-400">Sklopljene saradnje između naručioca i majstora, status izvršenja i ocenjivanje.</p>
          </div>
          <div class="bg-neutral-800/60 p-3 rounded-xl border border-neutral-700/50">
            <div class="font-bold text-white mb-1">4. Poruke (ChatText)</div>
            <p class="text-[11px] text-neutral-400">Direktni razgovori sa kandidatima, dogovori oko cene i vremena, push notifikacije.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 2: 45 VEKTORSKIH SISTEMSKIH IKONICA (PHOSPHOR GLYPHS) -->
    <section class="mb-14">
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">Sekcija 2</span>
          <h2 class="text-2xl font-extrabold text-neutral-900">Sve 45 Sistemske Vektorske Ikonice (Phosphor Icons Registry)</h2>
          <p class="text-xs text-neutral-600 mt-1">
            Kompletan registar funkcionalnih ikonica iz <code class="bg-neutral-200 px-1 py-0.5 rounded text-neutral-800 font-mono">src/ui/system/Glyph.tsx</code>.
            Prikazane u tačnim SVG linijama, sa optičkim dimenzijama (20dp/24dp) i srpskim značenjem.
          </p>
        </div>
      </div>

      ${generateGlyphGrid()}
    </section>

    <!-- SECTION 3: 2.5D GLINENE ILUSTRACIJE (NATURAL-V1) -->
    <section class="mb-14">
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">Sekcija 3</span>
          <h2 class="text-2xl font-extrabold text-neutral-900">2.5D Glinene Ilustracije — Natural V1 (384x384 WebP)</h2>
          <p class="text-xs text-neutral-600 mt-1">
            Glavni set taktilnih ikonica od mat gline (claymorphism) sa čistom transparentnom pozadinom.
            Sada uključuje <strong class="text-emerald-700 font-bold">money.webp</strong> (novac i novčiće) na svim vratima zarade umesto aktovke.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        ${ITEMS_NATURAL.map(generateCard).join('')}
      </div>
    </section>

    <!-- SECTION 4: ULAZNA VRATA I ONBOARDING VIZUALI -->
    <section class="mb-14 break-inside-avoid">
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">Sekcija 4</span>
          <h2 class="text-2xl font-extrabold text-neutral-900">Ulazna Vrata i Referentni Vizuali (Entry Doors & Hero)</h2>
          <p class="text-xs text-neutral-600 mt-1">
            Dva glavna toka aplikacije: naručilac koji objavljuje zadatak i majstor/izvršilac koji zarađuje.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
        ${ITEMS_DOORS.map(generateCard).join('')}
      </div>
    </section>

    <!-- SECTION 5: BREND IDENTITET I IKONE APLIKACIJE -->
    <section class="mb-14">
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">Sekcija 5</span>
          <h2 class="text-2xl font-extrabold text-neutral-900">Brend Identitet, Logo i Launcher Ikone</h2>
          <p class="text-xs text-neutral-600 mt-1">
            Zvanični brend resursi za Google Play Store, Splash ekran i AI asistenta u razgovoru.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        ${ITEMS_BRAND.map(generateCard).join('')}
      </div>
    </section>

    <!-- SECTION 6: MAPA, PINOVI I KLASTERI -->
    <section class="mb-14">
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">Sekcija 6</span>
          <h2 class="text-2xl font-extrabold text-neutral-900">Mape, Pinovi i Terenske Oznake (Map Discovery)</h2>
          <p class="text-xs text-neutral-600 mt-1">
            Vizuelni markeri na interaktivnoj mapi Srbije za zadatke, broj kandidata i grupisanje u klastere.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        ${ITEMS_DISCOVERY.map(generateCard).join('')}
      </div>
    </section>

    <!-- SECTION 7: ANATOMIJA KARTICE ZADATKA (ASSEMBLY BLUEPRINT) -->
    <section class="mb-14 break-inside-avoid">
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">Sekcija 7</span>
          <h2 class="text-2xl font-extrabold text-neutral-900">Anatomija Kartice Zadatka (Kako se vizuali sklapaju u aplikaciji)</h2>
          <p class="text-xs text-neutral-600 mt-1">
            Prikaz stvarne kartice zadatka na mapi ili u listi poslova koja demonstrira usklađenost svih ikonica.
          </p>
        </div>
      </div>

      <div class="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-sm">
        <div class="max-w-lg mx-auto bg-neutral-50 rounded-2xl p-5 border border-neutral-200 shadow-md">
          <!-- TOP TAGS -->
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
              Moleraj & Krečenje
            </span>
            <span class="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold flex items-center gap-1">
              <svg class="w-3.5 h-3.5 fill-amber-600" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Hitno danas
            </span>
          </div>

          <!-- TITLE & DESCRIPTION -->
          <h4 class="font-extrabold text-neutral-900 text-lg mb-1 leading-snug">Krečenje stana od 65m² u Novom Sadu</h4>
          <p class="text-xs text-neutral-600 mb-4 line-clamp-2">Potrebna dva iskusna molera za pripremu zidova i krečenje u belo. Materijal i boje su već obezbeđeni na lokaciji.</p>

          <!-- FACTS GRID WITH 2.5D ASSETS -->
          <div class="grid grid-cols-2 gap-2.5 pt-3 border-t border-neutral-200 mb-4">
            <!-- BUDGET (MONEY.WEBP) -->
            <div class="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-neutral-100 shadow-xs">
              <img src="${toBase64Uri('assets/illustrations/natural-v1/money.webp')}" class="w-7 h-7 object-contain" alt="Novac" />
              <div>
                <div class="text-[10px] text-neutral-500 font-medium">Budžet / Zarada</div>
                <div class="text-xs font-bold text-emerald-700">12.000 RSD</div>
              </div>
            </div>

            <!-- TIME / DEADLINE (CLOCK.WEBP) -->
            <div class="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-neutral-100 shadow-xs">
              <img src="${toBase64Uri('assets/illustrations/natural-v1/clock.webp')}" class="w-7 h-7 object-contain" alt="Rok" />
              <div>
                <div class="text-[10px] text-neutral-500 font-medium">Rok završetka</div>
                <div class="text-xs font-bold text-neutral-900">Danas do 18:00</div>
              </div>
            </div>

            <!-- PEOPLE (USERS.WEBP) -->
            <div class="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-neutral-100 shadow-xs">
              <img src="${toBase64Uri('assets/illustrations/natural-v1/users.webp')}" class="w-7 h-7 object-contain" alt="Ljudi" />
              <div>
                <div class="text-[10px] text-neutral-500 font-medium">Potrebno ljudi</div>
                <div class="text-xs font-bold text-neutral-900">2 radnika</div>
              </div>
            </div>

            <!-- LOCATION (PIN.WEBP) -->
            <div class="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-neutral-100 shadow-xs">
              <img src="${toBase64Uri('assets/illustrations/natural-v1/pin.webp')}" class="w-7 h-7 object-contain" alt="Lokacija" />
              <div>
                <div class="text-[10px] text-neutral-500 font-medium">Lokacija</div>
                <div class="text-xs font-bold text-neutral-900">Novi Sad (Liman)</div>
              </div>
            </div>
          </div>

          <!-- ACTION BUTTON -->
          <div class="w-full bg-[#006B4F] text-white font-bold py-2.5 rounded-xl text-center text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer">
            <span>Uskoči i pošalji ponudu</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 8: PROMPT ENGINEERING VODIČ ZA CHATGPT / DALL-E -->
    <footer class="bg-neutral-900 text-neutral-100 rounded-3xl p-6 sm:p-10 border border-neutral-800 shadow-xl mb-12">
      <div class="max-w-4xl">
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-emerald-950 text-emerald-400 rounded-full text-xs font-bold tracking-wide uppercase mb-3 border border-emerald-800">
          Uputstvo za ChatGPT / Midjourney generisanje
        </div>
        <h3 class="text-2xl font-extrabold text-white mb-2">Kako da generišete nove ili izmenjene ikonice za USKOČI?</h3>
        <p class="text-neutral-400 text-sm leading-relaxed mb-6">
          Kada u ChatGPT unesete zahtev za novom ikonicom (npr. čišćenje snega, baštovanstvo, električar, transport klavira),
          iskopirajte sledeću univerzalnu formulu kako bi se nova ikonica savršeno stopila sa postojećim 2.5D glinenim stilom aplikacije:
        </p>

        <div class="bg-neutral-950 p-4 sm:p-6 rounded-2xl border border-neutral-800 font-mono text-xs text-neutral-200 select-all relative mb-6">
          <div class="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-2 font-sans">Univerzalni Master Prompt:</div>
          A tactile 2.5D claymorphism icon representing [OPIS OBJEKTA, npr. an electric drill and screwdriver / garden shears].<br>
          Smooth matte clay texture with soft rounded bevels and friendly tactile proportions.<br>
          Color palette: rich emerald green (#006B4F), warm amber orange (#FF7A1A), crisp soft white and muted warm stone gray.<br>
          Lighting: gentle studio key light from top-left, soft ambient occlusion, subtle grounded contact shadow underneath.<br>
          Angle: isometric 30-degree perspective tilt.<br>
          Strict requirement: isolated on a clean 100% transparent background (alpha channel), no background square, no frame, centered, 4k render.
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-neutral-400">
          <div class="bg-neutral-800/60 p-4 rounded-xl border border-neutral-700/50">
            <span class="text-emerald-400 font-bold block mb-1">✓ Šta uvek naglasiti:</span>
            2.5D claymorphism, matte clay texture, rounded smooth bevels, soft ambient light, transparent background, emerald & orange accents.
          </div>
          <div class="bg-neutral-800/60 p-4 rounded-xl border border-neutral-700/50">
            <span class="text-rose-400 font-bold block mb-1">✗ Šta strogo izbegavati (Negativni prompt):</span>
            Glossy glass, shiny chrome reflections, harsh neon colors, sharp knife-like edges, photorealistic human faces, solid colored backgrounds.
          </div>
        </div>
      </div>
    </footer>

  </div>
</body>
</html>
`;

// Save HTML to workspace and artifact
const workspaceHtmlPath = path.join(ROOT, 'USKOCI_VIZUELNI_KATALOG_SVIH_IKONA.html');
const artifactHtmlPath = path.join(ARTIFACT_DIR, 'USKOCI_VIZUELNI_KATALOG_SVIH_IKONA.html');

fs.writeFileSync(workspaceHtmlPath, html, 'utf8');
console.log('Saved HTML to workspace:', workspaceHtmlPath);

try {
  fs.writeFileSync(artifactHtmlPath, html, 'utf8');
  console.log('Saved HTML to artifact:', artifactHtmlPath);
} catch (e) {
  console.warn('Could not write to artifact dir:', e.message);
}

// Generate PDF using headless Edge or Chrome
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserExe = fs.existsSync(edgePath) ? edgePath : fs.existsSync(chromePath) ? chromePath : null;

if (browserExe) {
  const workspacePdfPath = path.join(ROOT, 'USKOCI_VIZUELNI_KATALOG_SVIH_IKONA.pdf');
  const artifactPdfPath = path.join(ARTIFACT_DIR, 'USKOCI_VIZUELNI_KATALOG_SVIH_IKONA.pdf');
  console.log('Generating PDF using:', browserExe);

  try {
    execFileSync(browserExe, [
      '--headless',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--print-to-pdf=${workspacePdfPath}`,
      workspaceHtmlPath
    ]);
    console.log('Generated PDF in workspace:', workspacePdfPath);

    if (fs.existsSync(workspacePdfPath)) {
      fs.copyFileSync(workspacePdfPath, artifactPdfPath);
      console.log('Copied PDF to artifact:', artifactPdfPath);
    }
  } catch (err) {
    console.error('PDF generation error:', err.message);
  }
} else {
  console.log('No Chromium browser found for headless PDF generation.');
}
