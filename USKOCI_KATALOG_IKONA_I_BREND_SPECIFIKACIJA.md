# USKOČI — Zvanična vizuelna specifikacija, navigacija i katalog svih ikona (V2.5)

Ovaj dokument predstavlja jedinstveni izvor istine (Source of Truth) za sve grafičke elemente, navigaciju, vektorske simbole, ilustracije, logo i ikone mobilne aplikacije **USKOČI**.

Katalog objedinjuje:
1. **Glavnu donju navigaciju (Bottom Tab Bar)** sa svim stanjima i tokenima.
2. **Svih 45 sistemskih vektorskih ikonica (Phosphor Glyphs)** iz `src/ui/system/Glyph.tsx`.
3. **21 autentičnu 2.5D glinenu ilustraciju** iz `assets/illustrations/natural-v1/`.
4. **Ulazna vrata i onboarding vizuale** (`EntryWelcome` i `HomeLaunchArt`).
5. **Brend identitet i Google Play launcher resurse**.
6. **Mape, pinove i klastere na terenu**.
7. **Anatomiju kartice zadatka (kako se svi vizuali sklapaju)**.
8. **Gotove prompte za ChatGPT / DALL-E / Midjourney**.

Prateći izvezeni fajlovi:
* **Glavni PDF dokument (sa ugrađenim slikama):** [USKOCI_VIZUELNI_KATALOG_SVIH_IKONA.pdf](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/USKOCI_VIZUELNI_KATALOG_SVIH_IKONA.pdf)
* **Interaktivna samostalna HTML galerija:** [USKOCI_VIZUELNI_KATALOG_SVIH_IKONA.html](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/USKOCI_VIZUELNI_KATALOG_SVIH_IKONA.html)

---

## 1. Globalna stilska pravila za Image Generation (Prompt Master Template)

Sve ilustracije i ikone u aplikaciji USKOČI moraju delovati kao **jedinstven, koherentan set iz iste dizajnerske radionice**.

### Ključne vizuelne odlike stila:
* **Stil**: 2.5D taktilni meki glineni reljef (matte claymorphism / tactile minimal 3D).
* **Tekstura**: Glatka, polumat prirodna glina/guma bez sjajne plastike, bez stakla, bez kiča i bez generičkih 3D crtaća.
* **Ugao kamere**: Izometrijski blagi nagib (oko 15°–20° odozgo) sa prednje strane, centrirana kompozicija.
* **Osvetljenje**: Meko difuzno studijsko svetlo sa gornje-leve strane, blaga kontaktna senka (drop shadow) na dnu.
* **Pozadina**: **Isključivo izolovan objekat na potpuno providnoj pozadini (pure transparent background / alpha channel)**.
* **Paleta boja USKOČI**:
  - **Smaragdno zelena (Primarna)**: `#006B4F` / tamnija `#163D2B`
  - **Topla akcent narandžasta**: `#FF7A1A` / tamnija `#D95A00`
  - **Prirodna bela i krem**: `#FFFFFF` / meka `#F4F6F4`
  - **Ugljen grafit (Neutralna)**: `#102A1E` / siva `#7B887E`

> [!TIP]
> **ChatGPT / DALL-E Master Prompt Sufiks**:
> Svakom pojedinačnom promptu dodajte:
> `3D tactile matte clay illustration, soft ambient occlusion, minimalist modern product design, studio lighting, smooth clay texture, isolated on pure white background (transparent PNG style), premium clean mobile app asset, no text, no words, high resolution.`

---

## 2. Glavna donja navigacija (Bottom Tab Bar — `ZadaciNavigationBar`)

Plutajuća navigaciona traka (`ZadaciNavigationBar.tsx`) nalazi se na dnu ekrana u beloj kapsuli sa radijusom `sys.radius.hero` (28dp). Visina trake je 56dp + safe area inset telefona. Prelazak između tabova je trenutan (0ms), a odabrani tab ima mekanu animaciju kapsule (`sys.motion.toggle`).

| Tab | Zvanična ikona | Stanje: Neaktivan | Stanje: Aktivan (Odabran) | Svrha i funkcionalnost |
|---|---|---|---|---|
| **1. Početna** | `House` (Phosphor) / `home.webp` (2.5D) | Sivi glif (`#667085`), tekst 11sp regular | Smaragdni glif (`#006B4F`) bold, meka zelena podloga (`rgba(0,107,79,0.1)`), tekst 11sp bold | Glavna vrata, brze prečice („Objavite zadatak” i „Uskočite i zaradite”), pregled mojih aktivnosti. |
| **2. Zadaci** | `MapTrifold` (Phosphor) / `map.webp` (2.5D) | Sivi glif (`#667085`), tekst 11sp regular | Smaragdni glif (`#006B4F`) bold, zelena podloga kapsule, tekst 11sp bold | Interaktivna mapa cele Srbije i lista zadataka. Pinovi, klasteri, radijus pretrage i filteri. |
| **3. Dogovori** | `Handshake` (Phosphor) / `agreements.webp` (2.5D) | Sivi glif (`#667085`), tekst 11sp regular | Smaragdni glif (`#006B4F`) bold, zelena podloga kapsule, tekst 11sp bold | Sklopljene saradnje, direktan kontakt, status izvršenja i obostrano ocenjivanje. |
| **4. Poruke** | `ChatText` (Phosphor) / `chat.webp` (2.5D) | Sivi glif (`#667085`), tekst 11sp regular, opcioni narandžasti bedž | Smaragdni glif (`#006B4F`) bold, zelena podloga kapsule, tekst 11sp bold | Sanduče za razgovor sa kandidatima i naručiocima pre i tokom realizacije posla. |

---

## 3. Registar svih 45 sistemskih vektorskih ikonica (Phosphor Glyphs — `src/ui/system/Glyph.tsx`)

Ove ikonice upravljaju svim interakcijama na ekranu, dugmadima, filterima i statusima:

### 3.1. Navigacija i kretanje kroz ekrane
1. `back` (`ArrowLeft`): Povratak na prethodni ekran ili zatvaranje toka.
2. `close` (`X`): Zatvaranje modala, dijaloga ili napuštanje pretrage.
3. `caret-right` (`CaretRight`): Strelica u listama koja označava prelazak na detalje stavke.
4. `caret-left` (`CaretLeft`): Prethodni korak u višekoračnim obrascima.
5. `caret-down` (`CaretDown`): Otvaranje padajućeg menija ili izbora kategorije/grane.
6. `caret-up` (`CaretUp`): Zatvaranje padajućeg menija.
7. `arrow-right` (`ArrowRight`): Nastavak akcije, dugme „Dalje”.
8. `arrow-up` (`ArrowUp`): Pomeranje liste nagore ili skrolovanje na vrh.
9. `arrow-up-right` (`ArrowUpRight`): Izlazni spoljni link ili otvaranje dokumenta.
10. `refresh` (`ArrowClockwise`): Ponovno osvežavanje podataka ili ponovni pokušaj.
11. `expand` (`ArrowsOutSimple`): Prikaz mape ili fotografije preko celog ekrana.
12. `external` (`ArrowSquareOut`): Otvaranje eksternog veb pregledača.

### 3.2. Akcije, upravljanje i unos
13. `plus` (`Plus`): Dodavanje nove stavke, veštine ili radnika.
14. `minus` (`Minus`): Smanjivanje broja radnika ili vrednosti.
15. `check` (`Check`): Potvrda unosa, uspešno sačuvano, označena opcija.
16. `send` (`PaperPlaneTilt`): Slanje poruke u četu ili slanje zvanične ponude.
17. `search` (`MagnifyingGlass`): Pretraga zadataka, lokacija i kategorija poslova.
18. `filters` (`SlidersHorizontal`): Otvaranje filtera (cena, hitnost, udaljenost, ocena).
19. `more` (`DotsThree`): Meni sa dodatnim opcijama i akcijama.
20. `trash` (`Trash`): Brisanje nacrta, poruke ili otkazivanje prijave.
21. `edit` (`PencilSimpleLine`): Izmena podataka profila, cene ili opisa zadatka.
22. `settings` (`GearSix`): Glavna podešavanja aplikacije, naloga i notifikacija.
23. `cancel` (`Prohibit`): Odbijanje kandidata ili prekid toka.

### 3.3. Multimedija, glas i unos
24. `camera` (`Camera`): Pokretanje kamere za slikanje kvara ili završenog posla.
25. `image` (`Image`): Izbor slike iz galerije telefona.
26. `mic` (`Microphone`): Snimanje glasovne poruke i AI glasovni intervju sa Čistom.
27. `wave` (`Waveform`): Indikator audio zapisa i reprodukcija glasovne poruke.
28. `keyboard` (`Keyboard`): Prebacivanje sa glasovnog moda na unos tastaturom.

### 3.4. Nalog, bezbednost i profil
29. `eye` (`Eye`): Prikazivanje sakrivene lozinke ili broja telefona.
30. `eye-off` (`EyeSlash`): Sakrivanje osetljivih podataka.
31. `shield` (`ShieldCheck`): Verifikovan profil majstora, sigurnost saradnje.
32. `profile` (`User`): Profil korisnika, podaci o majstoru, recenzije.
33. `logout` (`SignOut`): Bezbedna odjava sa naloga.

### 3.5. Činjenice o zadatku (Task Facts)
34. `location` (`MapPin`): Ulica, opština i udaljenost od korisnika.
35. `remote` (`GlobeHemisphereWest`): Zadatak koji se radi na daljinu (onlajn).
36. `people` (`Users`): Broj potrebnih izvršilaca za zadatak.
37. `tool` (`Wrench`): Zahtevan specifičan alat za obavljanje posla.
38. `vehicle` (`Truck`): Potrebno prevozno vozilo (auto, kombi, kamion).
39. `calendar` (`CalendarBlank`): Kalendarski datum početka i rok.
40. `notifications` (`Bell`): Notifikacije o novim zadacima i ponudama.
41. `info` (`Info`): Informativni savet AI asistenta ili sistemsko objašnjenje.
42. `home` (`House`): Glavni tab Početna.
43. `map` (`MapTrifold`): Glavni tab Zadaci.
44. `agreements` (`Handshake`): Glavni tab Dogovori.
45. `messages` (`ChatText`): Glavni tab Poruke.

---

## 4. 2.5D Glinene Ilustracije — Natural V1 (384×384 WebP)

| # | Naziv fajla | Uloga u aplikaciji | Opis trenutnog izgleda | ChatGPT / DALL-E Prompt |
|---|---|---|---|---|
| **1** | `money.webp` | **„Uskočite i zaradite“ / Budžet i ponude** | Kaskada zelenih novčanica sa dva reljefna zlatno-mesingana novčića u prvom planu. | `A tactile 2.5D clay illustration of a neat stack of crisp paper banknotes in soft emerald green tones, accompanied by two thick minted metallic golden coins resting in front. Smooth matte clay texture, rounded edges, warm studio lighting, cast shadow below, isolated on pure white background.` |
| **2** | `publish.webp` | **„Objavite zadatak“ / Nova potreba** | Čist beli dokument/list sa zaobljenim uglovima, linijama teksta i istaknutim zelenim krugom sa belim plusom (+). | `A 2.5D matte clay illustration of a clean white sheet of paper or task card with soft rounded corners and subtle grey placeholder lines, featuring a vibrant emerald green circular badge with a bold white plus sign (+) on the bottom right corner. Minimalist, tactile, isolated on white background.` |
| **3** | `workbag.webp` | **Zanati / Alat radnika** | Meka kožna majstorska torba sa ručkom, kaišem i mesinganom kopčom u tonovima gline i terakote. | `A minimalist 2.5D tactile clay craftsman workbag or leather tool satchel, warm earthy clay brown with smooth rounded straps and a tiny brass buckle. Friendly, handmade artisan feel, soft shadows, isolated on pure white background.` |
| **4** | `agreements.webp` | **Tab „Dogovori“ / Potvrda posla** | Dve stilizovane apstraktne glinene ruke u čvrstom i prijateljskom stisku ruke (handshake). | `A 2.5D clay illustration of two friendly abstract hands shaking in agreement (handshake). One hand in warm soft cream clay, the other in muted terracotta clay. Smooth organic forms, rounded wrists, studio lighting, isolated on pure white background.` |
| **5** | `applications.webp` | **Tab „Prijave“ / Poslate ponude** | Papirni aviončić od zelene i bele gline u dinamičnom uzletu pod uglom od 45°. | `A 2.5D tactile clay paper airplane soaring upwards towards the right at a 45-degree angle. Clean geometric facets in emerald green and crisp white matte clay, smooth lighting, soft ground shadow, isolated on pure white background.` |
| **6** | `tasks.webp` | **Tab „Moji zadaci“ / Objavljeni poslovi** | Glineni clipboard sa metalnom štipaljkom i listom papira na kome su tri reda sa zelenim kvačicama. | `A 2.5D matte clay clipboard with a silver metal clip holding a clean white checklist with three neat rounded task lines and soft green checkmarks. Tactile, friendly, rounded bevels, isolated on pure white background.` |
| **7** | `offers.webp` | **Pregled pristiglih ponuda** | Bela kartica zadatka sa novčićem i indikatorom ponude kandidata. | `A 2.5D tactile clay task card showing an emerald coin and badge representing worker job bids and offers, rounded geometry, soft ambient light, isolated on white background.` |
| **8** | `calendar.webp` | **Datum i fleksibilni rokovi** | Stoni blok-kalendar od bele gline sa narandžastim spiralama i označenim datumom. | `A 2.5D tactile clay desk calendar with soft rounded corners, orange-accent top binding with white spiral rings, showing a clear numeric page. Smooth matte finish, clean drop shadow, isolated on pure white background.` |
| **9** | `clock.webp` | **Vreme početka i trajanje** | Okrugli zidni sat sa smaragdno zelenim okvirom, belim brojčanikom i crnim kazaljkama. | `A 2.5D clay alarm clock or wall clock with a soft emerald green bezel, clean white dial face, and simple rounded hands pointing at 10:10. Tactile claymorphism, friendly round proportions, isolated on pure white background.` |
| **10** | `users.webp` | **Broj potrebnih radnika** | Dve minimalističke biste ljudi mekih kontura (sage-zelena i topla bež glina). | `A 2.5D matte clay illustration of two abstract minimalist people busts side by side. Smooth organic geometric heads and shoulders in complementary tones of sage green and warm cream. Soft studio lighting, isolated on pure white background.` |
| **11** | `pin.webp` | **Tačna lokacija na mapi** | Kapljičasti smaragdno-zeleni pin sa blago udubljenim belim krugom u centru. | `A 2.5D tactile clay map location pin in bold emerald green, standing upright with a soft cast shadow below and an indented white circular center. Plump, smooth rounded bevels, isolated on pure white background.` |
| **12** | `map.webp` | **Zadaci i pretraga teritorije** | Presavijena topografska mapa sa ucrtanom zelenom putanjom i zastavicom. | `A 2.5D matte clay folded map unfolding gracefully, featuring subtle pastel contour lines and an emerald green route line with a tiny flag marker. Clean paper-like clay folds, isolated on pure white background.` |
| **13** | `home.webp` | **Početna i radovi u kući** | Mala glinena kućica sa zelenim kosim krovom, belim zidovima i vratima. | `A charming 2.5D clay house with an emerald green gable roof, clean white clay walls, a small door, and a tiny square window. Friendly geometric architectural toy style, isolated on pure white background.` |
| **14** | `chat.webp` | **Razgovor i poruke u dogovoru** | Dva preklopljena govorna oblačića — veći smaragdno zeleni i manji beli sa tačkicama. | `A 2.5D tactile clay illustration of two overlapping chat speech bubbles: a prominent emerald green message bubble in front with rounded corners, and a smaller soft white bubble behind with three debossed dots. Isolated on pure white background.` |
| **15** | `bell.webp` | **Notifikacije i upozorenja** | Zlatno-narandžasto glineno zvonce sa zaobljenim klatnom i prstenom na vrhu. | `A 2.5D matte clay notification bell in warm amber orange (#FF7A1A) with a rounded clapper and smooth circular top ring. Friendly, tactile, soft cast shadow, isolated on pure white background.` |
| **16** | `tool.webp` | **Alat i zanatske popravke** | Kutija za alat od crvene terakota gline sa ručkom i bravicom. | `A 2.5D tactile clay toolbox with a sturdy top handle, clean horizontal seam, and a tiny chrome latch in the center. Minimalist workman craft aesthetic, smooth clay bevels, isolated on pure white background.` |
| **17** | `vehicle.webp` | **Transport, selidbe i kombi** | Zeleni dostavni kombi sa zaobljenim prozorima i tamnim točkovima. | `A 2.5D clay utility van or delivery truck seen from side profile, with rounded emerald green body, white pill-shaped windows, and thick dark charcoal clay wheels. Cute, sturdy, isolated on pure white background.` |
| **18** | `remote.webp` | **Poslovi na daljinu (Remote)** | Desktop monitor na postolju sa apstraktnim video-poziv avatarom na ekranu. | `A 2.5D matte clay desktop computer monitor resting on a small stand, displaying an abstract friendly video call avatar on its screen. Smooth rounded bezel, clean minimalist workspace feel, isolated on pure white background.` |
| **19** | `support.webp` | **Korisnička podrška i pomoć** | Glineni spasilački pojas za vodu u beloj boji sa četiri smaragdne trake. | `A 2.5D tactile clay rescue lifebuoy ring in clean white with four emerald green wrap bands. Plump, smooth toroidal shape, soft lighting, isolated on pure white background.` |
| **20** | `document.webp` | **Pravila, uslovi i ugovor** | Formalni dokument sa presavijenim gornjim desnim uglom i okruglim pečatom. | `A 2.5D matte clay formal document sheet with a crisply dog-eared top-right corner, embossed text lines, and a small round official clay stamp seal at the bottom. Isolated on pure white background.` |

---

## 5. Ulazna vrata i onboarding vizuali (`EntryDoors`)

Dva glavna toka ulaza u aplikaciju vode preko vizuelno raskošnih kartica:
1. **Objavite zadatak (`requester.webp`)**: Za naručioce kojima je potrebna pomoć majstora, prevoz, popravka ili čišćenje.
2. **Uskočite i zaradite (`worker.jpg`)**: Za majstore, studente, radnike i slobodnjake koji nude svoje usluge i zarađuju.
3. **Panorama grada USKOČI (`uskoci-entry-city.webp`)**: Ilustrovana silueta srpskih gradova sa brdima i krovovima, koja komunicira dostupnost poslova širom cele Srbije.

---

## 6. Mape, pinovi i terenske oznake (`MapDiscovery`)

* `p6-pin-task.png`: Pojedinačni zadatak na mapi (smaragdni kapljičasti pin sa čekićem).
* `p6-pin-task-chosen.png`: Aktivno izabrani zadatak (pin sa belim koncentričnim prstenom).
* `p6-pin-count-1..4.png`: Pinovi sa brojem dostupnih kandidata na lokaciji.
* `uskoci-cluster-material.png`: Klaster krug koji objedinjuje poslove kada je mapa odzumirana.
* `resolved-location-pin.png`: Oznaka tačne adrese na mapi u detaljima zadatka.

---

## 7. Anatomija kartice zadatka (Kako se vizuelni sistem sklapa)

Na svakoj kartici zadatka na mapi ili u listi poslova, elementi se hijerarhijski sklapaju:
1. **Zaglavlje**: Kategorija posla (npr. Moleraj) sa zelenom tačkom i statusni bedž (npr. *Hitno danas* sa narandžastom munjom).
2. **Naslov i opis**: Čist i čitljiv tekst zadatka bez suvišnih oznaka.
3. **Činjenice (Facts Grid)**:
   - **Budžet / Zarada**: Prikazuje `money.webp` (snop novčanica i kovanice) uz iznos (npr. *12.000 RSD*).
   - **Rok završetka**: Prikazuje `clock.webp` (sat) uz datum/satnicu (npr. *Danas do 18:00*).
   - **Potrebno radnika**: Prikazuje `users.webp` (biste radnika) uz broj (npr. *2 radnika*).
   - **Lokacija**: Prikazuje `pin.webp` (lokacijski pin) uz opštinu i distancu (npr. *Novi Sad, Liman*).
4. **Glavno dugme akcije**: Smaragdno zeleno dugme punog kontrasta: *„Uskoči i pošalji ponudu”*.
