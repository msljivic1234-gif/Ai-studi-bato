# USKOČI — PRODUCT + UX MASTER

**Jedini glavni radni dokument.** Operativni presek: **29. oktobar 2026.**  
**Faza:** FINAL VISUAL PRODUCT PASS → specifikacija za Figma / prototip / React Native; **ne** pixel-final implementacija.  
**Obim ove izmene:** Product/UX/UI ugovori, hijerarhija, ponašanje i implementation delta. **GitHub kod, Supabase, migracije, Edge Functions i produkcijski podaci nisu menjani.**  
**Izvor koda — NAJNOVIJA PROVERA 29.10.2026:** Jedini aktuelni repo: **`uskocibusiness-boop/USKOCI-EAN`**, grana **`work/rev14-review-f17`**, PR **#43**; fiksirani HEAD u ovoj proveri **`4f6fc4f1f9358926195af356b6dfcdc7464f1a17`**. U odnosu na prethodni Master-pin `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25`: **3 nova commita / 5 izmenjenih fajlova**, pretežno `AgreementVoiceControls`, `MyApplicationsPresentation`, njihovi testovi i `docs/plan/CODEX_PLAN_RADA.md`. Pinned auditi A–E ostaju relevantni za neizmenjene fajlove; svaki stariji SHA u nastavku predstavlja **datirani trag**, ne paralelni aktuelni HEAD. `AGENTS.md` i `docs/implementation/design-system/PREMIUM_WHITE_CANON.md` **nisu pronađeni na navedenim putanjama na ovom SHA (404)**; komentar u kodu koji ih pominje nije dokaz postojećeg fajla. Izvršni izvor za boje, tipografiju, dimenzije i animacije su stvarni `src/theme/*`, `src/ui/system/*` i konkretne RN komponente sa blob SHA. **Airbnb 2026 je visual benchmark, nikad izvor implementacionog identiteta.** Nema aktuelnog APK rendera, poređenja pixel-by-pixel, novog build SHA ni dokazano završenog vizuelnog freeze-a. GitHub/baza/produkcija ostaju strogo read-only. Obnovljen je samo ovaj Master.

> **Kako koristiti ovaj dokument:** za svaki vizuelni zadatak AI/dizajner prvo čita **B0 (kratki vizuelni i pokretni brief)**, **B1–B4 (stvarni tokeni)** i **samo relevantan S01–S18**, zatim E/J gate. Deo ispod `ISTORIJSKA EVIDENCIJA I DOKAZI` služi samo za proveru porekla i **ne prosleđuje se kao design prompt**. Od ovog zaglavlja do **J. FINAL VISUAL QA** ostaje jedina važeća izvršna product/UX/UI specifikacija. Ispod oznake **ISTORIJSKA EVIDENCIJA I DOKAZI** sačuvan je dosadašnji istraživački materijal, originalne numerisane sekcije, route audit, test matrice i raniji preseci. Služi za obrazloženje i implementacionu proveru, **ne** za ponovno biranje između zastarelih i novih rešenja. Ako tekst iz stare sekcije ne odgovara ovom kanonu, važi ovaj kanon; relevantne superseded oblasti dodatno su označene na mestu starog teksta. Nova odluka se od sada menja u odgovarajućem kanonskom odeljku, ne dopisuje kao nova glava na kraj dnevnika.

> **VAŽEĆA ODLUKA VLASNIKA, 31.10.2026:** jedan nalog ima **jednu zajedničku reputaciju**, zasnovanu na potvrđenim objavljenim ocenama iz oba smera saradnje. „Kao naručilac” i „Kao uskočer” mogu označavati kontekst pojedinačne saradnje ili javni prikaz, ali **nisu dve reputacije**. U S13/E/H/I/J važi ovo pravilo; stari istorijski role-rating predlozi su SUPERSEDED. Privacy i blind-publication ostaju obavezni.
>
> **Način rada:** funkcionalni ugovori, navigacija, prava, recovery i filteri koji traže API/DB promenu definišu se pre kodiranja zavisnog backend dela. **Vizuelni polish radi se ekran po ekran posle funkcionalnog povezivanja**, sa realnim RN/Android prikazom, 360dp/1,3× proverom, dostupnošću i vlasničkim korekcijama. Čisto prezentacioni raspored filtera/kartica/ikonica može se usavršavati kasnije. „LOCKED” je trenutna usvojena osnova, ne zabrana budućih ciljnih ispravki.

## Brzo snalaženje

> **READ-ONLY VISUAL SOURCE PASS — 29.10.2026, ažurirano:** `uskocibusiness-boop/USKOCI-EAN` na fiksiranom **`de8f838e56f96d29b99d2a1aaba1f9889b4e1a25`** (PR #43). Prethodni vizuelni krugovi A–E izvršeni su na `8987900ca3a21d61c4032b9dc66cb7399264b58a`; compare potvrđuje da su intervenišuće izmene usko vezane za voice/UI, voice runtime, voice testove i tehnički plan. U ovoj sesiji ponovo su pročitane primarne RN prezentacije, postojeći Design Lab fajlovi, i otvoreni su **istorijski** snimci iz REV14 ZIP-a; u S01–S18 i J9 svaki nalaz nosi oznaku `CODE INSPECTED`, `HISTORICAL SCREENSHOT` ili `UNVERIFIED`. **Fixture scena nije fizički render.** GitHub/Supabase/Edge/APK/Figma nisu menjani.


- **A.** Principi i autoritet; **B.** Design system; **C.** Navigacija i struktura;
- **D.** Konačni screen contracts S01–S18 (vrh → dno, states, 360dp, veliki font, tap/Back);
- **E.** Pravila preko ekrana; **F.** Završni korisnički tokovi;
- **G.** Otvorene odluke / pitanja koja ne treba izmišljati; **H.** Final product naspram poslednjeg poznatog koda;
- **I.** P0/P1/P2; **J.** status i finalni visual QA.

---

# A. PRODUCT PRINCIPLES — KANON

1. **USKOČI = „Živa mreža ljudi za životne stvari.“** Moto je **MENI TREBA. JA MOGU.** Nije oglasnik, imenik, staffing/HR platforma, messenger bez zadatka ni project-management sistem.
2. **Jedan nalog, obe mogućnosti.** Korisnik može da objavi zadatak i da uskoči na tuđi; uloga se zaključuje iz **konkretnog zadatka/prijave/Dogovora**, nikad iz globalnog mode switch-a.
3. **Put od namere do dogovora je kratak:** opišite zadatak → ljudi se prijavljuju → izaberite konkretnu prijavu → nastaje konkretan Dogovor → saradnja/poruke/termin → završetak/ocena.
4. **Na ekranu je prvo ono što korisniku treba sada.** Ne praviti feed na Početnoj, detaljan dashboard od Dogovora niti po jednu karticu za svaku činjenicu.
5. **Jedna korisnička činjenica ima jedno ime i jedno prirodno mesto.** Istorija je lokalna domenu; izmene aktivne saradnje su u Dogovoru; novi task se kreira iz glavne namere; korisničke sve legitimno objavljene ocene iz oba smera saradnje ulaze u jednu zajedničku reputaciju naloga.
6. **Prava akcija ili nikakva akcija.** Primary CTA postoji kada je radnja dozvoljena i smislena. Nikad zelena potvrda radi dekoracije; ne nuditi radnju koju server ne može da potvrdi.
7. **Server je autoritet za poslovna stanja, AI je saradnik.** AI predlaže; čovek potvrđuje; nova ili promenjena canonical objava, profil, prijava ili Dogovor ne nastaje kao samostalni AI side-effect.
8. **Istinitost i privatnost pre efekta.** Public zadatak pokazuje samo približnu lokaciju; tačna lokacija je posebna autorizovana razmena u bilateralnom Dogovoru. Ne izmišljati nepročitane, ocene, dostupnost, prijave, potvrđene termine ni ishod slanja.
9. **Formalni srpski UI:** Vi, Vam, Vas, Vaš; „Pogledajte“, „Otvorite“, „Izaberite“, „Pošaljite“. Brend slogan i first-person nazivi maskota su izuzeci.
10. **Visual contract ≠ pixel-final.** Konačna kompozicija može biti **LOCKED/CONTRACT** dok realni komponentni rendering, screenshot matrica i visual freeze ostaju nezavršeni.

**Autoritet:** (1) ovaj kanonski deo Mastera, (2) stvarni dosadašnji USKOČI vizuelni DNK, (3) postojeće RN presentation komponente i Design Lab scene kao dokaz/gradivni materijal, (4) finalni Figma/prototip nakon prihvatanja. Legacy HTML i screenshot bez novije odluke ne postaju nezavisni product autoriteti. Kodni limit koji se sudara sa finalnim UX-om vodi se u H/I kao DELTA; ne menja se idealni UX da bi se opravdao legacy.

# B. GLOBAL DESIGN SYSTEM — ODLUČENA PRAVILA


## B0. VISUAL + MOTION BRIEF — AIRBNB 2026 KVALITET, ORIGINALNI USKOČI (PRVO PROČITATI)

**Jedna rečenica identiteta:** **USKOČI je topao, samouveren, ljudski prostor gde se potreba pretvara u stvarnu saradnju** — kao kvalitetan editorial prikaz stvarnog zadatka, a ne admin dashboard, chat bot konzola ili oglasni katalog. **Airbnb 2026 je nivo jasnoće, prostranosti, materijala i taktilnosti; nije šablon za preslikavanje.** Referentni izvor: zvanični [Airbnb 2026 Summer Release, 20.05.2026](https://news.airbnb.com/product-releases/airbnb-2026-summer-release) i [Airbnb 2025 all-new app release](https://news.airbnb.com/product-releases/airbnb-2025-summer-release), pregledano 29.10.2026; ovo su javne referentne publikacije, **ne snimci našeg APK-a, specifikacija Airbnb tokena ili potvrda njihovih internih animacionih trajanja**.

### B0.1. Prepoznatljivost, bez kopiranja

- **USKOČI potpis:** trenutak „MENI TREBA. JA MOGU.“ predstavljen kao dve komplementarne namere i diskretan znak **U**; postojeće narandžasto i ivory brend-lice pripadaju velikim *intent/entry* ilustracijama, dok se stvarne osobe, njihov posao i njihove fotografije nalaze u centru radnih ekrana. Ne preuzimati Airbnb ikone, fotografije, tipografsku marku, crvene akcije, ilustracije ili identičan raspored njihovih tabova.
- **Jedna dominantna sadržinska stvar po viewportu:** velika dobra fotografija zadatka **samo kada postoji stvarna fotografija**, ili lepo postavljen naslov i činjenice bez lažnog placeholder heroa; prirodan razmak ispred teksta, jedan jasan naslov, informacija na mestu na kom korisnik očekuje da je nađe. Ne pretvarati listu bez fotografija u praznu galeriju da bi ličila na travel app.
- **Boje po ulozi, ne dekoraciji:** bela čitalačka podloga `#FFFFFF`, najuvučeniji kontrolni ton `#F5F7F4`, ink `#17221D`. **Forest `#006B4F`** je stabilan primarni CTA i potvrđen status. **Narandžasta `#FF7A1A`** je brend-energija u ilustraciji i jednom tačno relevantnom trenutku pažnje, ne pozadina svake kartice; za sitni tekst koristiti kontrastni `orangeInk=#C23C00`, ne svetlu narandžastu na beloj. Ako nema proverene potrebe za pažnjom, nema narandžastog chip-a. Jedan „važan“ akcenat po viewportu; ne praviti šareni katalog.
- **Dva sloja ikona, ne sukob pravila:** (1) sitne funkcionalne kontrole/navigacija = ista čista **2D linijska** ikona (postojeći `Glyph`); (2) pažljivo odabrane *semantičke ilustracije* uz početne namere, kategorije, edukaciju, prazno stanje i AI trenutak = postojeći **2.5D materijal** (`FactArt`/`HomeLaunchArt`), sa toplom prirodnom dubinom. *Nema* 2.5D svuda, posebno ne za svaku činjenicu, dugme ili avatar; postojeći AI assistant art je funkcionalna oznaka govornika, ne treća nezavisna brend-maskota. Ovaj princip ima prednost nad apsolutnim starim „2.5D samo na ulazu“; nezavisni `AGENTS.md` nije potvrđen na trenutnom SHA.
- **Površine i dubina:** glavna čitalačka ravan je skoro ravna. Tappability je jasan kroz zajedničku geometriju, sadržaj i pressed state; **ne** siva linija i identična velika senka na svemu. Jedan uzdignut sloj istovremeno: izabrani map preview, aktivan sheet ili dijalog; list rows u pravilu bez zasebne senke. Ne dodavati „glassmorphism“, staklenu tab traku, gradient-heavier cover ili 3D kartice ako ne objašnjavaju značenje.

### B0.2. Optički ritam i tipografija — konkretnije od „lep UI“

- **Izvor tipografije je Inter preko `withInter`** (ne uvoditi nov display font bez zasebne provere srpske latinice i ćirilice). Primarni naslov detalja `hero 30/35, weight 600`; naslov chrome-a `21/26, 600`; međunaslov `18/24, 600`; tekst `16/24, 400`; AI govor `16/26`; konkretne činjenice `14/20`; mini-oznake `13/18`; cene tabularne i sa jasno napisanim osnovom „ukupno / po osobi / po satu“. Jedan snažan naslov po ekranu, do dva nivoa sekundarne hijerarhije; ne koristiti tri ogromne cifre i više podebljanja da bi sve bilo važno.
- **Srpski test je obavezan**, ne dekorativan: `Čišćenje stana u Đurđevu`, `Šišanje žive ograde`, `Pomoć oko selidbe — još četiri čoveka`, `Cena: 2.400 RSD po osobi`, `Želim da uskočim`, `Sačuvajte nacrt`; proveriti `č ć š ž đ Č Ć Š Ž Đ`, prelome, line-height i mešavinu font weight-a na 360dp i 1,3×; talkback mora izgovoriti celu cenu, osnovu i status. Testirati i ćirilicu kao ulazni korisnički sadržaj bez obaveze da se menja zaključani srpski UI.
- **Ritam iz stvarnog sistema:** horizontalni gutter 20dp, sekcije 24dp, male unutargrupne pauze 12dp, veće zone 32dp; card 24dp, medija okvir 20dp, sheet 28dp, controls 12dp; sadržaj/komande imaju ≥48dp touch. Ne štelovati nezavisne vrednosti po ekranu: proveriti `sys`, `layout`, `theme/tokens` i `motionTokens` iz stvarnog SHA. Optičko poravnanje fotografije, naslova i podataka važnije je od doslovnog guranja svega u zasebnu karticu.

### B0.3. Pokret je gramatika, ne ukras — implementacioni ugovor

| Stvarni okidač | Ciljni vizuelni odgovor | Trenutni RN preset / vreme | Reduce Motion / zabrana |
|---|---|---|---|
| Kratak tap primarne akcije | pod prstom diskretno smanji → vrati, odmah izvrši radnju | `press.button` 120ms, scale `0.97`; release spring (400ms) | bez uslovljavanja akcije animacijom; statičan pressed/focus |
| Tap celog reda/kartice | jedva primetno taktilno popuštanje | `press.row` 100ms, scale `0.985` | ne pomerati listu, ne duplirati CTA |
| **Nova** poruka ili potvrđena činjenica | opacity 0→1 + pomak **8dp**, iz pravog smera; kada više zapisa stiže: max 6, 40ms razmaka | `content.reveal` / `Appear`: **240ms**, easing `sys.motion.easeOut`; sopstveni sadržaj odozdo, tuđe novo saznanje odozgo | ne animirati istoriju, re-fetch, Back, sort ili stare poruke; trenutno vidljivo |
| Asistent čeka odgovor servisa | tri diskretne pulsirajuće tačke uz isti AI znak, vidljiv tekst „Stiže odgovor…“ | `assistant.thinking` / `loop.typing`: **520ms half-cycle**; aktivan ekran | za accessibility/reduced: stabilne tačke + razumljiva statusna rečenica; bez beskonačne „konfeti“ petlje |
| Potvrđena nova stavka u „Šta smo razumeli“ | samo **jedan novi/izmenjeni red** ulazi odozgo; ostatak kartice se mirno prelama | `content.reveal` **240ms**, 8dp, bez preskakanja fokusa | ako podatak nije potvrđen, nema „popunjeno“; pri ponovnom read-u nema replay-a |
| Pin → preview / HALF→FULL mapa | jedan sheet sa mirnim zaustavljanjem, bez bounca/duplog sloja; camera ostaje ista | `sheet.spring`: stiffness 300 / damping 30 / mass 1 / clamp | odmah u ciljnu poziciju; vratiti pin, sheet i filtere pri Back |
| Potvrđen uspeh | tih status i jedno kratko pojavljivanje **tek posle stvarnog server readback-a** | `feedback.success` **220ms** | nikada ne animirati „Objavljeno“ za unknown/pending |
| Novi ulaz / veliki brand art | jedinstveno nenametljivo pojavljivanje, ne zadržava dugme za početak | `welcome.entrance` **450ms**; art float samo kad je foreground i dozvoljen | bez loop-a i bez odlaganja namere |

**Granice:** svi prelazi moraju čuvati ID razgovora/zadatka, sadržaj nacrta, scroll anchor i fokus. Animacija nije dokaz backend ishoda. Ne animirati svako slovo lažnim „typewriter“ efektom. Ako backend zaista isporučuje `streamingText`, tekst se može prikazivati po stvarno pristiglim segmentima bez veštačkog usporavanja; zatim ostaje stabilan kao kanonska poruka. Nema perpetual parallax-a, skakanja svih ikona, ponavljanja card entrance na refresh, niti animiranih boja koje zamene labelu. Svi motion parametri u jedinstvenom postojećem `src/ui/system/motionTokens.ts` i `sys.motion`; ništa ne implementirati paralelnim setom magic brojeva.

### B0.4. Chat — precizan vizuelni storyboard, ne samo „levo/desno“

1. **Ulaz:** čisto belo platno, kompaktan naslov `Novi zadatak` / `Radni profil`, jedna ljudska uvodna rečenica i postojeća velika AI ilustracija samo dok je razgovor prazan. Kompozitor je siguran u dnu, iznad keyboard/safe-area, attachment i voice imaju stvarne interaktivne ciljeve. Nema chat dashboard-a, duplih oblačića sa istom informacijom ili ogromnog dekorativnog robota uz svaku rečenicu.
2. **Poruka korisnika:** jasno odvojena desno, blago zatamnjena neutralno-zelena površina, 16/26 Inter, širina raste prema tekstu i najviše oko **85% dostupnog prostora** (cilj za vizuelnu probu, ne verifikovana sadašnja mera); prikaz odmah posle lokalnog dozvoljenog slanja u okviru postojećeg journala, bez lažne server potvrde. Na „ishod nepoznat“ zadržati poruku i ponuditi readback umesto novog dup-slanja.
3. **AI prisustvo:** levo mali stabilan `AiAssistantArt` marker, odgovor prvenstveno **tipografija na otvorenoj beloj ravni**, ne velika obojena monolitna bubble; duži odlomci imaju čitljiv `16/26` i pauze po smislu. Kada zahtevi stižu, jedna preview linija `Stiže odgovor…` + tri tačke; kada postoje realni stream fragmenti, ne izmišljati tekst ili simulirati „razmišljanje“ nakon server otveta. Dolazak **nove** poruke 240ms / 8dp i screen reader najava **jednom po committed message ID-u**, nikad za svaki token.
4. **„Šta smo razumeli“:** **jedna** kompaktna kartica u pravom okviru razgovora, ne stalno zakačena preko četa i ne druga identična lista pri dnu. Pojavljuje se tek kada postoji bar jedna korisna *potvrđena* činjenica; inicijalno `Šta smo razumeli` → potvrđeni redovi `Šta`, `Gde`, `Kada`, `Koliko ljudi`, `Cena/ponude` samo ako imaju stvarnu vrednost. Svaki novi red može ući **jednom** sa 240ms/8dp; za nepotvrđeno se navodi „Još treba“ umesto lažno popunjenog check-a. Tap **Ispravite** vraća u isti konkretni AI kontekst; opis koji AI sastavi je **predlog**, ne automatska publikacija.
5. **Završetak:** poslednje pitanje i završni facts ne smeju se vizuelno takmičiti sa akcijom `Pregledajte zadatak`. Review je druga, mirna full-screen površina sa jednim dozvoljenim završnim CTA-om. `U toku`, `Ne znamo da li je poslato` i `Objavljeno` imaju tri različita teksta i ishoda; samo po stvarno potvrđenom readback-u ide kratak success.

**STATUS:** postojeće `AiConversationShell`, `useConversationArrival`, `TypingDot`, `Appear`, `AiAssistantArt`, `motionTokens` i RN Preview/Review daju osnovu (**CODE INSPECTED**, ref na HEAD u zaglavlju), ali **nije potvrđeno** da progressive facts, konačna optika, predložena 85%-širina, editor/preskakanje fokusa i sve trajanje rade piksel-po-piksel na uređaju. Ovo su **TARGET VISUAL DELTA**, ne lažan opis gotove APK scene.

### B0.5. Referentni ekrani za vizuelni freeze

**Ne izmišljati nove ekrane:** B0.1–B0.4 primeniti na **S01 Početna**, **S02 Zadaci mapa/list sheet**, **S03 javni/owner detalj**, **S08–S11 Dogovori/Poruke** i **S16 AI razgovor/review**. Svaki od tih screen contract-a ima svoju `VISUAL SIGNATURE` dopunu (ili detaljan B0 storyboard) koja navodi gde veličina, fotografije, 2.5D i pokret imaju smisla. Na ostalih S04–S18 preneti istu hijerarhiju, bez generičkog redizajna toka i bez heroa na radnim ekranima.

**ZABRANJENO / odbijanje vizuelnog predloga:** sve u karticama; ponavljajuće sive senke; tri CTA-a iste težine; veliki prazan hero na svakom ekranu; generički AI neon/gradient; animirani placeholderi koji liče na potvrđene podatke; kopirani Airbnb raspored/ikone; prazne slike kada korisnik nije dodao fotografiju; widgeti nalik kontrolnoj tabli; dvojni 2.5D sistem u kom svako dugme ima svoju umetnost; dve kartice „Šta smo razumeli“; neformalno „ti/tebe/tvoj“; naglašena proslava uspeha pre stvarne potvrde servera.

**Acceptance bez nagađanja:** za **S01, S02, S03, S11, S16** obavezno prvo normal/empty/attention/long, 360dp, 1,3×, keyboard+safe-area, reduced-motion, TalkBack, dark-text contrast i stvarni Android render **sa build SHA**; potom ostali S01–S18. Stvarni screenshot se upoređuje sa ovom hijerarhijom; screenshot i code-inspected nisu ista kategorija dokaza. Dokument je **design direction + motion contract**, a ne proof da je API/GUI već implementirao ovu optiku.

---

## B1. Vizuelni jezik

- Podloga: **warm white / ivory**; površine svetle, mirne; **forest/deep teal** primarna akcija/potvrđeno; **narandžasta** štedljivo za zaista relevantno „Čeka Vas“; **crvena** samo stvarni problem/destrukcija; muted za sekundarno. Ne izmišljati nove heks vrednosti ako već postoje tokeni u realnoj aplikaciji.
- Tipografija: **Inter**; naslovi i glavna cena mogu biti snažni, sekundarni facts mirniji. Tekst ima prostor da poraste do 1,3× bez gubitka smisla ili CTA-a.
- Mreža: dokazani RN `layout.gutter=20dp`, sekcija `24dp`, unutrašnja grupa `12dp`, zone `32dp`; **card radius 24dp** i sheet/hero `28dp`, uz compact 20dp. Ovo su postojeći **centralni tokeni** B4, ne novo arbitrarno nametanje vrednosti; ekran diše kroz SECTION/ROW i ograničeno CARD, a finalna optika se proverava na telefonu.
- Ikone i ilustracije (**B0.1 nadređen ovom sažetku**): jedna funkcionalna **2D** porodica za UI kontrole; već postojeći **2.5D FactArt/HomeLaunchArt** može da objašnjava veliku početnu nameru, kategoriju ili redak smislen empty/education trenutak, **ne** da preplavi svaki red. Fotografije ljudi, fotografije zadataka i stvarna mapa nose značenje. Nema 2.5D avatara u inbox-u, gradient-heavy/AI-neon interfejsa ni dark dashboard-a.
- **Samo tri nivoa kompozicije:** **CARD/SURFACE** = konkretan tappable record, stanje, osoba/trust, selektovan preview, review; **SECTION** = opis, zahtevi, Q&A, mapa, aktivnost, lista; **ROW** = kratke činjenice, podešavanja, sekundarne akcije. Ne duplirati činjenicu kao chip + heading + posebnu karticu.
- Card vizuelno mora da razlikuje **tappable celinu** od pasivne sekcije, bez potrebe za stalnim dugmetom „Pogledajte“ na svakoj kartici. Obeležiti fokus/pressed/touch target **najmanje 48dp** i obezbediti jasan screen reader label.

## B2. Globalni layout i adaptacija

- Root header i tab bar koriste realne safe-area insets; **bottom nav samo na četiri root taba**. Pushed detail/review/form/full chat/profile deca kriju bottom nav; sticky CTA poštuje keyboard i gesture insets.
- Na **360dp**: velika dva početna intention card-a idu jedan ispod drugog ako tekst/ilustracija ne stanu; 2×2 facts postaju vertikalni; nijedan CTA ne postaje mikro-dugme niti pada ispod **48dp** interaktivnog cilja. Sheet ide više na visinu po potrebi, bez horizontalnog skrola sadržaja.
- Na **~430dp i 1,3× tekstu**: naslov, cena, broj ljudi, vreme i labela dugmeta mogu da se prelome; sekundarni datum sme da se skrati bez menjanja značenja. Nikad „3/3“ bez labela šta je dogovoreno; nikad sakrivanje važnog iznosa kroz ellipsis.
- Sticky footer je rezervisan za **jednu** dozvoljenu primarnu radnju, ne imitira root tab i ne sakriva sadržaj pri otvorenoj tastaturi. Dok keyboard zauzima ekran, sadržaj se može skrolovati do fokusa; ne prekrivati input.
- Loading bez lažnih rezultata; partial failure zadržava poslednji dokazani prikaz uz oznaku **„Prikazano je poslednje učitano.“** i Osvežite/Pokušajte ponovo. Full failure nije isto što i empty.
- Motion: **tačan okidač/parametri/smer/Reduce Motion su zaključani u B0.3 i postojećem `motionTokens.ts`**; 120/100ms tap, 240ms/8dp jednom za nov sadržaj, 520ms AI typing half-cycle dok je razgovor aktivan, spring sheet bez overdrag-a; root tab odmah; **Reduce Motion** uklanja nepotrebno pomeranje; bez loop animacija na radnim ekranima osim pristupačnog AI pending indikatora kada je aktivan.

## B3. Tačan UI rečnik

| Značenje | Finalno korisničko ime |
|---|---|
| Need/Task | Zadatak |
| Response | Prijava |
| OFFERS amount | Vaša ponuda / iznos ponude |
| Selection | Izbor / Izaberite |
| Agreement | Dogovor; konkretni odnos = saradnja |
| Parent collaboration | Saradnje na zadatku |
| Calendar | Raspored |
| Worker preference | Dostupnost |
| Terminalni pregledi | Prethodne saradnje / Prethodni zadaci / Prethodne prijave |
| Public location | Približno mesto/područje |
| Bilateralni grant | Tačna lokacija/adresa |
| Support ticket | Zahtev |

U consumer copy-ju nema RPC, response, hash, canonical, occurrence, projection, ID-a objekta, „Otkažite Dogovor“ ili neformalnog „Čeka te“. Nema izmišljenog telefonskog kontakta kao MVP obećanja.

## B4. Konkretni dizajn tokeni — autoritet izvora

**REVALIDIRANO NA FIKSIRANOM HEAD-u `4f6fc4f1f9358926195af356b6dfcdc7464f1a17`, 29.10.2026:** `uskocibusiness-boop/USKOCI-EAN`. Source blob SHA: `src/theme/colorTokens.ts` `394b1add`, `src/theme/tokens.ts` `41ec4bf7`, `src/ui/system/tokens.ts` `2c535872`, `src/ui/system/layout.ts` `a32db149`; dodatno `src/ui/system/motionTokens.ts` `02f00915`, `src/ui/system/Appear.tsx` `1069965a` i `src/ui/aiFirst/useConversationArrival.ts` `dd65f72a`. Stari `45815814...` je samo datirani pinned presek; komentari u kodu pominju nepostojeći `docs/implementation/design-system/PREMIUM_WHITE_CANON.md` (404 na ovom SHA), zato je **stvarni token/module source** iznad autoritet, a ne nedostupna Markdown referenca. Vrednosti ispod su **stvarni trenutni RN tokeni**, ne pretpostavljeni heks i ne garantuju da je svaka pojedinačna scena već vizuelno odobrena.

| Uloga | Trenutni dokazani RN token |
|---|---|
| White reading canvas / surface | `sys.color.ground = #FFFFFF`, `surface = #FFFFFF` |
| Tiha uvučena podloga / controls | `wash = #F5F7F4`, `control = #E5EBE6`, `line = #E2E8E3` |
| Glavni tekst / cena | `ink = #17221D`, `money = #17221D`; sekundarno `muted = #52605A` |
| Primarna brand akcija | `green = #006B4F`, `greenSoft = #E8F4ED` |
| Pažnja | `orange = #FF7A1A`, `orangeSoft = #FFF5E9`, `orangeInk = #C23C00` za čitljiv tekst |
| Opasnost / problem | `danger = #A43832`, uz `dangerSoft = #FCEEEB` |
| Boje ilustracija, ne UI statusa | `artRole.location`, `artRole.ai`, `artRole.people`, `artRole.time` (definisane posebno) |
| Spacing | `layout.gutter=20dp`, `chatList=16dp`, `chatComposer=12dp`, `section=24dp`, `group=12dp`, `zone=32dp` |
| Radijusi | `cardCompact=20dp`, `card=24dp`, `sheet=28dp`, `hero=28dp`, `control/primary=12dp` |
| Minimum interaktivnog cilja | **48dp** (`theme/tokens.touch.min`, `layout.touch`) |
| Tipografija | Inter preko `withInter`; body 16/24, heading 18/24, screen title 21/26, hero 30/35, speech 16/26, price tabular |

**Važeće pravilo (B0 + stvarni `sys` tokeni su autoritet, ne nedostajući Markdown fajl):** ne uvoditi nezavisnu „AI paletu“, plutajuće radijuse ili poseban sistem za Profile/Task/Dogovori. `sys` je jedinstvena centralna komponentna skala; sav user-visible AI, mapa, Review i Profile uzimaju svoje vrednosti iz tog sistema, a specifična 2.5D/brand umetnost ostaje umetnost, ne statusna boja. Pojedinačne ekrane ne *prebojiti* u toplu ivory samo zato što je istorijski brend to koristio: aktuelni Premium White white canvas je provereni radni vizuelni DNK; topao identitet ostaje u akcentima i Entry. `card=24` i 48dp touch su sada stvarne reference, umesto ranijih orijentacionih 18–22 i 44. Realni finalni razmaci, font scaling i kontrast još traže screenshot/Design Lab pregled.

**Retrakcija:** stari brojevi `ground=#FFFFFF`, `wash=#F2F7F4`, `green=#176B55`, `orange=#FF850F` bili su uzeti iz **pogrešnog** repozitorijuma `Uskoci1/USKOCI-CLEAN`; ne koristiti ih kao autoritet za aktuelni product. Nema izmene ni jednog stvarnog token fajla u ovom Product/UX chatu.

# C. NAVIGATION / INFORMATION ARCHITECTURE

## C1. Jedan shell

**Početna · Zadaci · Dogovori · Poruke** — jedini bottom nav. **Bell → Obaveštenja; Avatar → Moj profil.** Nema centralnog FAB-a i globalnog „Treba mi / Ja mogu“ switch-a. Root tab tap menja root odmah i ne pravi niz lažnih Back koraka. Pushed ekrani pamte stvarni entry source i skrol/sheet kontekst; hladni deep-link koristi eksplicitni fallback.

## C2. Mapa destinacija i Back-a

| Odakle → tap | Destination | Back kada postoji stack / cold fallback |
|---|---|---|
| Početna → Objavite zadatak | AI Need | Početna / Početna |
| Početna → Uskočite i zaradite | Zadaci (root) | root tab; nema novog pushed duplikata |
| Početna → Moji zadaci / Moje prijave | odgovarajuća privatna lista | izvor / Početna |
| Početna → „Prikažite sve što Vas čeka“ | uslovni pregled svih potvrđenih akcija kao sheet preko Početne; nije novi root/domen | zatvaranje sheet-a → isti Home scroll, izbor reda → tačan domenski ekran |
| Zadaci list card ili pin preview | Public Task | sačuvan list/sheet/pin / Zadaci |
| Task → Pošaljite prijavu/ponudu | Application | Task / Task |
| Owner Task → Prijave | Candidates | Owner Task / Owner Task |
| Owner Task → Saradnje | task-group ako postoji više odnosa; inače bilateralni Dogovor | Owner Task / Owner Task |
| Dogovori → saradnja | bilateralni Dogovor ili task-group | Dogovori / Dogovori |
| Task-group → osoba | bilateralni Dogovor | Task-group / Dogovori |
| Bilateralni Dogovor → Poruke tab | isti Dogovor, drugi tab | prethodni tab/ekran; cold Dogovori |
| Poruke → privatni row | bilateralni Dogovor sa Poruke tabom | Poruke / Poruke |
| Poruke → grupni row | group chat vezan za task-group | Poruke / Poruke |
| Dogovori → Raspored | Raspored | Dogovori / Dogovori |
| Profil → Radni profil / Settings / Podrška | odgovarajuće dete | Profil / Početna |
| Settings → Privatnost / AI razgovori | odgovarajući poddomen | Settings / Profil |
| AI Need → Pregledajte zadatak | Review | isti AI razgovor / AI razgovor |
| Publish success | Owner Task za tačan objavljeni zadatak | nema vraćanja na pre-publish draft / Owner Task |
| Obaveštenje / push | tačno autorizovan objekat i stanje | stvarni izvor / Obaveštenja |

**Princip:** nikad ne hardkodovati fallback ako prethodni validni izvor postoji. Posle prijave / auth prekida povratak na isti `returnTarget` **tek nakon ponovne autorizacije**. Neuspešan deep link ne otvara drugi korisnički objekat „otprilike“; prikazuje „Sadržaj trenutno nije dostupan“ uz bezbedan izlaz.

## C3. Domenska istorija

**Dogovori → Prethodne saradnje; Moji zadaci → Prethodni zadaci; Moje prijave → Prethodne; Poruke → read-only terminalni razgovori u recency inbox-u.** `Arhiva` nije product površina; postojeća ruta je samo compatibility redirect do bezbednog konteksta. Prethodne saradnje grupisati Juče / Ove nedelje / Mesec+godina, optional sticky header meseca; search po naslovu zadatka i osobi kada korisno. Nijedan history entry ne menja svoj izvorni, već prihvaćeni Dogovor.

---

## C4. POTPUNOST FUNKCIJA → MESTO NA EKRANU (77 REV14 površina → S01–S18)

**Svrha:** proveriti da svaka korisnička i sistemska mogućnost ima razumljivo mesto, a ne izmišljati nove glavne tabove. Indeks ispod je napravljen iz postojeće istorijske mape `USKOCI_SURFACE_MAP_REV14.json` (77 površina, source REV13/REV14), upoređene sa kanonskim S01–S18 i prethodno proverenim RN prikazima na `USKOCI-EAN` / pinned HEAD `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25`. **Ovo je PRODUCT PLACEMENT AUDIT, nije dokaz svih 77 aktuelnih ruta, implementacija niti instaliranog APK-a.** Konačni popis dostupnih akcija tek treba uskladiti sa pinovanim source route/action owner-ima i stvarnim build SHA; zastarela istorijska površina ne mora biti izložena u aktuelnom proizvodu.

**Legenda:** `MAPIRANO` = postoji određena porodica S i ulazna putanja, ali to nije potvrda realnog tap-a/E2E. `MIKROTOK DOPUNITI` = domensko mesto postoji, ali još nema dovoljno preciznog kanonskog toka za jednu ili više sporednih radnji/stanja; nije automatski CODE GAP. `INTERNI GATE` = samo autorizovani interni owner, nikad consumer navigacija. Veći deo javnog/privatnog prikaza ostaje `PIXEL-FINAL UNVERIFIED` do stvarnog Android snimka i funkcionalnih provera.

| REV14 ID | Površina / funkcija | Jedino kanonsko mesto / ulaz | Status UX pokrivenosti |
|---:|---|---|---|
| 01 | Pokretanje i obnova | S17/S18: Pokretanje → obnovljeni dozvoljeni cilj | MAPIRANO |
| 02 | Dobro došli | S17: Entry → dve namere → Auth | MAPIRANO |
| 03 | Prijavi se | S17: Entry/ReturnTarget → Prijava | MAPIRANO |
| 04 | Napravi nalog | S17: Entry → Registracija | MAPIRANO |
| 05 | Potvrdi kontakt | S17: Registracija/Prijava → Potvrda kontakta | MAPIRANO |
| 06 | Obnova pristupa | S17: Prijava → Oporavak pristupa | MAPIRANO |
| 07 | Nova lozinka | S17: Oporavak → Nova lozinka | MAPIRANO |
| 08 | Nalog trenutno nije dostupan | S17/S18: Auth/deep link → Nedostupan nalog + bezbedan izlaz | MAPIRANO |
| 09 | Početna | S01: Root Početna | MAPIRANO |
| 10 | Opiši zadatak | S16: Početna → Objavite zadatak → AI Need | MAPIRANO |
| 11 | Fotografija ili glas u razgovoru | S16: AI Need → kontekstno fotografija/glas | MAPIRANO |
| 12 | Potvrdi mesto u razgovoru | S16: AI Need → kontekstno mesto | MAPIRANO |
| 13 | Pregledaj zadatak | S16: AI Need → Pregledajte zadatak | MAPIRANO |
| 14 | Izmeni mesto u pregledu | S16: Pregled → Izmenite mesto | MAPIRANO |
| 15 | Zadatak je objavljen | S16/S03: Objava → potvrđen ishod → Moj zadatak | MAPIRANO |
| 16 | Opiši šta radite | S14/S16: Profil → Radni profil → AI opis ponude | MAPIRANO |
| 17 | Pregledaj ponudu | S14/S16: Radni profil → Pregledajte i potvrdite | MAPIRANO |
| 18 | Zadaci | S02: Root Zadaci | MAPIRANO |
| 19 | Pretraga i filteri | S02/S18: Zadaci → Pretraga/Filteri | MAPIRANO |
| 20 | Detalji zadatka | S03: Zadaci → kartica zadatka → Javni detalj | MAPIRANO |
| 21 | Nova prijava | S04: Javni detalj → Prijavite se → Nova prijava | MAPIRANO |
| 22 | Prijava je poslata | S04/S06: Prijava → Potvrđen ishod → Moje prijave | MAPIRANO |
| 23 | Moje prijave | S06: Početna/Profil → Moje prijave | MAPIRANO |
| 24 | Tvoja prijava | S06: Moje prijave → konkretna prijava/revizija | MAPIRANO |
| 25 | Moji zadaci | S05: Početna/Profil → Moji zadaci | MAPIRANO |
| 26 | Moj zadatak | S03: Moji zadaci → Moj zadatak | MAPIRANO |
| 27 | Status zadatka | S03/S05/S18: Moj zadatak → status/sekundarne akcije | MIKROTOK DOPUNITI |
| 28 | Prijave na zadatak | S07: Moj zadatak → Prijave | MAPIRANO |
| 29 | Ponuda osobe | S07: Prijave → Ponuda određene osobe | MAPIRANO |
| 30 | Potvrdi izbor | S07: Ponuda → Pregled izbora → Potvrda | MAPIRANO |
| 31 | Dogovori | S08: Root Dogovori | MAPIRANO |
| 32 | Dogovor | S10: Dogovori/Task-group → pojedinačni Dogovor | MAPIRANO |
| 33 | Završetak posla | S10/S18: Dogovor → Završetak posla | MAPIRANO |
| 34 | Predloži izmenu | S10/S18: Dogovor → Predložite izmenu | MAPIRANO |
| 35 | Pregled izmene | S10/S18: Predlog → pregled → prihvatanje/odbijanje | MAPIRANO |
| 36 | Otkaži Dogovor | S10/S18: Dogovor → Otkažite saradnju | MAPIRANO |
| 37 | Poruke | S11: Root Poruke | MAPIRANO |
| 38 | Privatne poruke | S11/S10: Poruke/Dogovor → privatni razgovor | MAPIRANO |
| 39 | Grupni razgovor | S11/S09: Poruke/Task-group → grupni razgovor | MAPIRANO |
| 40 | Učesnici grupe | S09/S11: Grupni razgovor → članovi grupe | MIKROTOK DOPUNITI |
| 41 | Oceni saradnju | S10/S18: Završen bilateralni Dogovor → Ocena | MAPIRANO |
| 42 | Ocene | S13/S18: Profil/partnerov profil → ocene po ulozi | MIKROTOK DOPUNITI |
| 43 | Pitanja o zadatku | S03/S18: Javni/Moj zadatak → Pitanja i odgovori | MAPIRANO |
| 44 | Pitanje ili odgovor | S03/S18: Pitanja → jedan odgovor ili nova objava | MIKROTOK DOPUNITI |
| 45 | Raspored | S12: Dogovori → Raspored | MAPIRANO |
| 46 | Arhiva | S05/S06/S08/S11: Istorija u svakom domenu; bez root Arhive | MAPIRANO |
| 47 | Profil | S13: Avatar → Moj profil | MAPIRANO |
| 48 | Lični podaci | S13/S15: Profil → Lični podaci | MAPIRANO |
| 49 | Fotografija profila | S13/S15: Profil/Lični podaci → fotografija profila | MIKROTOK DOPUNITI |
| 50 | Radni profil | S14: Profil → Radni profil | MAPIRANO |
| 51 | Područje rada | S14: Radni profil → Područje rada (AI) | MAPIRANO |
| 52 | Dostupnost | S14/S12: Radni profil/Raspored → Dostupnost | MAPIRANO |
| 53 | Podešavanja | S15: Profil → Podešavanja | MAPIRANO |
| 54 | Promeni lozinku | S15/S17: Podešavanja → Pristup nalogu → lozinka | MIKROTOK DOPUNITI |
| 55 | Dozvole uređaja | S15/S17: Podešavanja/permission request → dozvole uređaja | MIKROTOK DOPUNITI |
| 56 | Obaveštenja | S17: Zvono → Obaveštenja | MAPIRANO |
| 57 | Obaveštenja — podešavanja | S17/S15: Obaveštenja/Podešavanja → preference i push | MIKROTOK DOPUNITI |
| 58 | Privatnost i podaci | S15: Podešavanja → Privatnost i podaci | MAPIRANO |
| 59 | Ko šta vidi | S15: Privatnost → Ko šta vidi | MAPIRANO |
| 60 | Rokovi čuvanja | S15: Privatnost → Rokovi čuvanja | MIKROTOK DOPUNITI |
| 61 | Pravila i saglasnosti | S15: Podešavanja/Privatnost → Pravila | MAPIRANO |
| 62 | Pregled i prihvatanje dokumenta | S15: Pravila → pregled tačne verzije → saglasnost | MIKROTOK DOPUNITI |
| 63 | Kopija Tvojih podataka | S15: Privatnost → Izvoz podataka | MAPIRANO |
| 64 | Zatvaranje naloga | S15: Privatnost → Zatvaranje naloga | MAPIRANO |
| 65 | Blokirane osobe | S15: Privatnost → Blokirane osobe | MIKROTOK DOPUNITI |
| 66 | Prijavi ili blokirajte | S18/S15: Kontekstni meni → Prijavite/blokirajte | MIKROTOK DOPUNITI |
| 67 | Podrška | S15: Profil/Podešavanja → Podrška | MAPIRANO |
| 68 | Novi zahtev | S15: Podrška → Novi zahtev | MAPIRANO |
| 69 | Zahtev podršci | S15: Podrška → konkretan zahtev i dopune | MAPIRANO |
| 70 | Rad podrške | S15 (interni): Interni support owner, ne potrošački root | INTERNI GATE |
| 71 | O aplikaciji | S15: Podešavanja → O aplikaciji | MAPIRANO |
| 72 | AI razgovori | S16: Podešavanja → AI razgovori | MAPIRANO |
| 73 | Sačuvani razgovor | S16: AI razgovori → postojeći transcript | MAPIRANO |
| 74 | Fotografije zadatka | S16/S03: AI Need/Review/Task → fotografije zadatka | MIKROTOK DOPUNITI |
| 75 | Profil saradnika | S13/S07: Task/Candidates → javni profil saradnika | MAPIRANO |
| 76 | Mesto Dogovora | S10: Dogovor → dozvoljena lokacija | MAPIRANO |
| 77 | Otvaranje dozvoljenog odredišta | S17/S18: Deep link/notification → autorizovan konkretan cilj | MAPIRANO |

**Šta ovaj indeks dokazuje:** nijedna od 77 *istorijski popisanih* površina nije ostala bez dodeljene kanonske porodice i predviđenog korisničkog ulaza. To **ne dokazuje** da 77 pokriva sve danas izvršive RN akcije, da svaka istorijska funkcija postoji ili sme da bude omogućena, niti da su svi mikro-tokovi završeni. `S18` nije prikriveno novo mesto; svaka njegova akcija živi na tačnom roditeljskom ekranu.

## C5. MIKROUGOVORI KOJE TREBA ZAKLJUČATI PRE „SVE FUNKCIJE SU POKRIVENE“

1. **Moj zadatak / status (REV14 #27, P0 za štetne tranzicije):** vlasnik otvara *jedan* kontekstni `⋯`/status, a ne stalna tri velika dugmeta. Prikazati samo serverom dozvoljeno `Zatvorite potragu`, `Ponovo otvorite` i eventualno `Obrišite`/`Obrišite nacrt` prema stvarnom status/action guard-u; u potvrdi jasno razdvojiti zatvaranje potrage od otkazivanja već prihvaćenih bilateralnih Dogovora. Unknown ishod → `Proverite stanje`, ne ponoviti opasan write. **Ne tvrditi da sve tranzicije danas postoje**: proveriti owner route, action, server eligibility i ćirilica/latinica copy consistency.
2. **Grupa/članovi (#40, P0 privatnost):** `Task-group → Učesnici` pokazuje isključivo autorizovane javne podatke i tačan scope. `Privatne poruke` ili profil je vidljiv samo kada postoji dozvoljen bilateralni Dogovor/target; group chat ne otkriva privatnu cenu niti telefon.
3. **Ocene i Q&A (#42, #44, P0 authority/P1 kompozicija):** prikazati `Primljene / Date` kao pregled pojedinačnih recenzija, gde naručilac/uskočer može označavati kontekst saradnje, a **jedan verifikovan zbir i prosek svih objavljenih ocena** čine reputaciju naloga. `Pitanja` imaju pitanje, odgovor, stanje objavljivanja i verifikovan put za odgovor. Ako javni account aggregate nije autorizovan ili je nepotvrđen, ne prikazivati izmišljeni broj; nema dva role-skora.
4. **Profilna fotografija (#49, P1):** `Moj profil/Lični podaci → fotografija` otvara `Dodajte/Zamenite/Uklonite` sa potvrdom uklanjanja; upload/provera uspeha je eksplicitna, a permissions/error čuvaju prethodnu sigurnu sliku. Koristiti isti identitet naloga, ne poseban avatar uskočera.
5. **Lozinka i uređaj (#54, #55, P0 pristup/P1 UX):** `Podešavanja → Pristup nalogu` prikazuje promenu lozinke samo za stvarno podržanu metodu; platform OS permission status (`dozvoljeno/odbijeno/nepoznato`) prikazati kao različit od dostupnosti provider-a, sa `Otvori podešavanja telefona` kada sistem zahteva. Odbijanje ne blokira tok koji ima podržanu alternativu.
6. **Push preference (#57, P1):** event-level opcije i status povezanosti uređaja predstavljaju različite stvari. `Sačuvano` se pokazuje tek nakon readback-a; nema lažno uključenog push-a kada telefon odbija dozvolu.
7. **Rokovi i saglasnosti (#60, #62, P0):** navesti samo stvarno objavljene retention činjenice i tačnu verziju dokumenta; otvoriti pun dokument pre `Prihvatite`; unknown acceptance koristi proveru stanja. Nikad izmišljeno obećanje momentalnog brisanja.
8. **Blokiranje/bezbednost (#65, #66, P0):** `Prijavite ili blokirajte` je kontekstna sekundarna radnja sa jasnim objašnjenjem posledica i odvojenim report/block potvrdama; `Blokirane osobe` je jedno mesto za `Odblokirajte` sa stvarnim auth/readback-om. Ne mešati prijavu problema u Dogovoru sa globalnom prijavom profila.
9. **Fotografije zadatka (#74, P1):** postojeća AI/Review foto-akcija je izvor; pregled, dodavanje, uklanjanje i ograničenja zavise od dozvoljene verzije zadatka i server/storage stanja. Javni detail nema vlasničke edit komande; permission/error ne brišu druge potvrđene fotografije.
10. **Rad podrške (#70, P0):** istorijska administrativna površina nije peti root tab niti deo javnog APK-a ako ne postoji izričit staff contract i role-based auth. Korisnik vidi `Podrška → Zahtev`, ne internu obradu; pristup proveriti na router i server nivou pre bilo kakve consumer scene.

**Finalni acceptance uslov za tvrdnju „svaka postojeća funkcija ima mesto“:** za svaku akciju iz **stvarnog pinovanog koda** postoji identitet owner-a i korisnički trigger (`screen → control → server guard → success/unknown/failure → Back/state`); provereni su slučajevi sa nulom, delimičnim read-om, 360dp, 1.3× tekstom, tastaturom, safe-area, TalkBack i stvarnim Android build SHA. Feature iz starog inventara nije automatski obaveza za novi UI niti dokaz implementacije. A–J/S01–S18 ostaju jedini kanon; R01–R12 se ovde ne izvršavaju.

---
# D. SCREEN CONTRACTS — KONAČNA KOMPOZICIJA

**Zajednički zapis:** „Redosled“ je obavezan od vrha ka dnu. „Normalno“ znači ekran sa stvarnim sadržajem; „Čeka Vas“ samo autoritativno potvrđenu radnju; „Prazno“ stvarno potvrđenu nulu; „Nedostupno“ nepoznat ishod čitanja. Veličine su organizaciona pravila, ne odobren render. Definicije u ovom odeljku su **LOGIC LOCKED / VISUAL CONTRACT** osim gde piše drugačije.

## S01 — POČETNA / jedinstvena polazna tačka

**VISUAL SIGNATURE (B0 / Airbnb 2026 kvalitet):** urednički ritam, jedan stvarni `Sledeće` događaj kada ga ima, dve namere sa doslednim originalnim 2.5D mikro-objektom i jasnim naslovima; bela podloga bez hero-dashboard-a, redovi bez jednakih senki. Dve namere su jedine veće obojene/ilustrovane površine, ali nisu `role toggle`. Koristiti stvarni Inter 21/26 header, 20dp gutter i touch ≥48dp; proveriti da na 360dp ilustracija ne gura CTA ispod pregiba. **Motion:** nova obaveza može 240ms/8dp jednom, ali povratak na Home ne animira već poznate redove. **Status:** TARGET, ne phone screenshot.

**Zašto se otvara:** videti šta sledi, šta zahteva odgovor, i krenuti jednim od dva jednostavna puta. **Nije feed.**

**Redosled vrh → dno:** (1) USKOČI logo levo; bell (samo provereni unread dot) i avatar desno. (2) **Sledeće** — jedna najbliža potvrđena saradnja sa vremenom, naslovom, osobom/„N saradnji“ i lokalnim područjem; ceo red otvara odgovarajući Dogovor ili task-group. Prikazati samo kada postoji potvrđen termin. (3) **Čeka Vas** — najviše tri kompaktna attention reda (izbor prijave, predlog izmene, completion, promenjena prijava, ocena); tap vodi na **tačno** potrebnu radnju, za više → „Prikažite sve što Vas čeka“ u uslovnom pregledu preko Početne (S01 dodatni contract), bez novog root taba. (4) **Objavite zadatak** i **Uskočite i zaradite** — dve velike, ravnopravne intention površine sa jednom kratkom podlinijom i postojećim diskretnim brend art-om. (5) **Nastavite razgovor o zadatku / nastavite radni profil** samo kada stvarni resumable draft postoji; ako su oba, dva obična reda, ne dva nova hero-a. (6) **Moji zadaci** i **Moje prijave** kao kratki rows sa proverljivom summary vrednošću. (7) **Dostupnost** kada postoji aktivan radni profil i autoritativno stanje; **Podesite radni profil** kada je korisnik iskazao worker nameru ali profil nije spreman. Ako nije relevantno, oba reda su skrivena; nikada oba istovremeno. (8) root bottom nav.

**Normalno (primer wireframe):** `USKOČI                         [bell] [avatar]` → `Sledeće / Danas 17–20 • Selidba stana • 2 saradnje` → `Čeka Vas / 2 prijave traže izbor` → `[Objavite zadatak] [Uskočite i zaradite]` → `Moji zadaci →` / `Moje prijave →` / `Dostupnost →`. Nema marketplace/own-task/application carousela ni stalnog „Moj raspored“ reda.

**Attention:** samo po autoritativnom pending signal-u; najvažnija stvar prva, narandžasta kratka oznaka, ne alarm ploča. **Prazno / prvi dolazak:** nema praznih „Sledeće“ ni „Čeka Vas“ naslova; dve namere na vrhu, zatim sažet „Kako USKOČI radi“ sa po tri ljudska koraka, bez tutorijala od 10 slajdova. **Dug sadržaj:** naslov taska u „Sledeće“ do prirodne dve/tri linije, dodatne pending akcije iza „Prikažite sve“; nema beskonačnog početnog skrola. **360dp:** intention kartice jedna ispod druge ako je neophodno; 1,3× tekst se prelama, bell i avatar ostaju dostupni. **Nedostupno:** statične namere uvek ostaju; nepoznat read ne znači „nemate Dogovora“, poslednji verifikovan snapshot može da ostane uz stale oznaku. **Tap/Back:** bell→Obaveštenja; avatar→Profil; namere→AI Need/Zadaci; summary redovi→svoje domene. Povratak sa podstranice čuva Home skrol.

### S01 — vizuelni zaključak, ulazi i pravila koja Figma/RN moraju da ponove

**Normalan ekran nije hero landing.** Header je miran i ostaje dostupan izvan skrola. U naseljenom stanju **ne prikazivati veliki „Šta rešavamo danas?“ dekorativni hero** iz starije default-grane: gura konkretne sledeće obaveze ispod pregiba. Brand art je dovoljan na dve intention površine; veliki ilustrativni blok sme postojati samo kao smislen prvi empty/education trenutak, bez dodatnog skrolovanja. Ne praviti ni paralelnu „Moje aktivnosti“ zbirnu listu na Home-u; finalno postoje **Moji zadaci** i **Moje prijave** kao zasebni redovi.

| Red | Tačno šta se crta | Tip | Tap / pojavljivanje |
|---|---|---|---|
| Header | logo; bell sa dokazanim unread signalom; zajednički avatar/inicijali | global chrome | bell → Obaveštenja; avatar → Moj profil |
| 1. Sledeće | **jedna** najbliža saradnja: vreme, zadatak, osoba ili broj saradnji; nema cene | jedna tanka tappable surface | samo potvrđen termin; → bilateralni ili task-group |
| 2. Čeka Vas | do tri action reda, jedno narandžasto upozorenje uz konkretan razlog; bez dekorativnog alarm bloka | SECTION + ROW | samo authoritative pending; red → konkretna akcija |
| 3. Dve namere | **Objavite zadatak** („Opišite šta Vam treba.“) i **Uskočite i zaradite** („Pronađite zadatak.“) | dve ravnopravne vizuelne surface | → AI Need / Zadaci root |
| 4. Nastavak | AI Need draft ili worker AI setup koji se zaista može nastaviti | po jedan običan row | ako oba postoje, dva reda, ne dva hero-a |
| 5. Aktivnosti | **Moji zadaci →** i **Moje prijave →**; jedan dokazani sažetak ili bez broja | grouped ROW | → dve odvojene liste; ne otvara generički feed |
| 6. Radni kontekst | **Dostupnost →** *ili* **Podesite radni profil →** | uslovni ROW | nikad oba istovremeno |
| Footer | Početna · Zadaci · Dogovori · Poruke | root bar | samo root, sakriva se u pushed flow-u |

**Tri konkretne scene bez nagađanja:**

- **S01-NORMAL:** ima jednu sledeću potvrđenu saradnju i dve potrebe koje traže odgovor. Header → Sledeće → Čeka Vas (2 reda) → namere → eventualni draft → dve privatne liste → dostupnost ako relevantno; nema praznih sekcija. Kada postoje 3 saradnje sa istim taskom i istim terminom, prikazuje se jedna sa oznakom „3 saradnje“ samo ako server razlikuje task-group.
- **S01-FIRST-EMPTY:** header → dve namere → kratak tekst „Objavite ono što Vam treba ili pronađite zadatak u koji možete da uskočite.“ → eventualno edukativna 2.5D ilustracija samo ako odgovara accepted vizuelnom uzoru → redovi Moji zadaci / Moje prijave; ne lažne prazne Sledeće/Čeka Vas kartice.
- **S01-PARTIAL/UNKNOWN:** header i dve namere su interaktivni; neuspešni read ne sme ispisati „Nemate Dogovora“. Dinamički deo je ili poslednji pouzdani snapshot sa „Prikazano je poslednje učitano.“ ili jedan recovery row „Pregled trenutno nije u potpunosti dostupan. Osvežite.“; nema broja `+N` dok izvori za N nisu potpuni.

**`Čeka Vas` >3:** tekst **„Prikažite sve što Vas čeka“** postoji samo ako postoji dokaz da ima još radnji. Tap otvara **jedan prolazni pregled/sheet** sa listom potvrđenih action redova, ne peti root tab, ne poseban marketplace i ne „Moje aktivnosti“ feed. Tap akcije zatvara pregled i otvara exact Task/Candidates/Application/Dogovor/Rating; Back iz cilja vraća izvorni Home kontekst. Kod parcijalnog učitavanja ne tvrditi „sve“ i ne prikazivati nepouzdan ukupni broj.

**Adaptacija:** na 390–430dp normalni dve namere mogu stajati u dva stupca **samo ako tekst i dodirne površine stanu bez stezanja**; na 360dp ili pri 1,3× bezbedno stack vertikalno, bez horizontalnog skrola. `Sledeće` dugačak naslov dobija 2–3 reda, vreme ostaje istaknuto. Root header ne sme prekriti sadržaj kada Android poveća font; broj redova na Home-u ostaje kontrolisan. **Back:** iz AI resume se vraća na isti Home, bez kreiranja drugog drafta; iz Root tab-a Back po platformskom pravilu, ne kroz lažni niz prethodnih tabova.

**Reuse / retire — dokaz iz prave grane:** `HomePresentation.tsx` (`c309383b`) je pročitan na `USKOCI-EAN@work/rev14-review-f17`: sačuvati već postojeću pažnju, najbliži dogovor, `Press` i recovery ponašanje. Sadrži i `Aktuelni zadaci` carousel, neformalni `Čeka te` i glavnu nameru `Objavi zadatak`; **DELTA:** ukloniti redundantni carousel, formalizovati copy i poštovati konačni redosled S01. Nije dokazan stvarni pixel-render; komponentu ne prepisivati iz drugog repozitorijuma.



### S01 — PINNED RN + Design Lab visual reality (29.10, read-only)

**Stvarni redosled izvornog RN-a je već dobar:** `HomePresentation.tsx` (`c309383b`) crta `Sledeće` → `Čeka te` → `StartActions` → sopstvene preglede. Zadržati `RasporedCard` (jedna najbliža potvrđena saradnja, istaknuto vreme), `WaitingRow`, recovery, dve ravnopravne namere i grouped `MineRow`. **Ne proglašavati ponovo pogrešno da je „StartActions“ iznad obaveza**: to važi za drugi stari repo, ne za ovaj pinovani source.

**Jedan konkretan P1 visual delta:** `myActiveTasks.slice(0,5)` i `myActiveApplications.slice(0,5)` crtaju dva horizontalna `ScrollView`-a sa karticama širine **290dp**, a `ExploreTasksAction` dodaje treći `Aktuelni zadaci` carousel (do tri prilike) ispod njih. Na 360dp to postaje nepotrebno skrolovanje u tri pravca i konkurencija root-u `Zadaci`. Product contract zaključava **Moji zadaci → / Moje prijave →** kao dva čitljiva reda sa dokazanim summary-jem, a discovery ostaje u `Zadaci`; *ne* reimplementirati njihove kartice, samo ukloniti višak sa Home površine kada dođe UI implementacija. `intakeResume` i setup/dostupnost ostaju samo uz stvaran nalog/stanje.

**Copy delte:** `Čeka te` → `Čeka Vas`, `Objavi zadatak` → `Objavite zadatak`, `Opiši šta ti treba` → `Opišite šta Vam treba`, `Uskoči i zaradi` → `Uskočite i zaradite`, `Učitavamo tvoj pregled` → `Učitavamo Vaš pregled`. **Ne menjati** prva lica u sloganu. Ne uvoditi neproverene brojače. Header i bottom bar zadržavaju svoje postojeće safe-area i fokus ponašanje.

**Stvarne galerie (ne screenshot dokazi):** `dizajn-pocetna?scene=upcoming`, `waits`, `owner`, `long`, `empty`, `quiet`, `stale`, `unavailable`, `worker`, `loading`; `?text=1.3` demonstrira složeni layout. Za realni 360dp i veće slovo proveriti da dve intent površine postanu vertikalne, `Sledeće` zadrži vidljivo vreme i da „Čeka Vas“ ima najviše tri reda bez zasebnog horizontalnog scrolla.



### S01 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `src/ui/home/HomePresentation.tsx` `c309383b`; `src/designLab/dizajn-pocetna.tsx` `b01b5826`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Header → stvarno `Sledeće` → `Čeka te` → dve namere → do pet mojih zadataka (horizontalno) → do pet mojih prijava (horizontalno) → do tri `Aktuelni zadaci` (treći carousel), uz uslovni AI/dostupnost.

**KEEP:** Autoritativna sledeća saradnja i pending, `WaitingRow`, `RasporedCard`, realna resume/dozvola, odvojeni recovery mehanizmi, postojeće 2 namere.

**DELTA:** P1: horizontalne kartice svesti na 2 domenska reda; ukloniti treći preview feed; copy `Čeka Vas`, `Objavite`, `Uskočite`, ne dirati korisne stanje/AI handoff.

**Finalna kompozicija, vrh → dno:** Header → Sledeće (0–1) → Čeka Vas (0–3) → dve namere → validan nastavak → Moji zadaci / Moje prijave → dostupnost po uslovu → root 4-tab.

**Tap / Back / state / recovery:** Bell/Avatar i tačni domenski ulazi; nakon child Back ostaje scroll; kod partial drži dve namere i nikad ne glumi nulu. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp: namere jedna ispod druge; 1,3×: 2–3 linije; bez horizontalnog Home feed-a; root bottom safe-area; TalkBack redosled i 48dp. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-pocetna`: `upcoming`, `waits`, `long`, `empty`, `stale`, `worker`, `loading`.

**Prioritet:** P1 copy/karuseli; P0 samo lažna pending/success stanja. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S02 — ZADACI / Discovery: Na lokaciji i Na daljinu

**VISUAL SIGNATURE (B0):** čista search kapsula i kontrola filtera, široka stvarna mapa, jedan list sheet bez sivog vela i bez nerazumno podignutih kartica. U HALF je lista ugodan red naslova i uporedivih činjenica; na pin tap samo jedna preview površina. Semantička narandžasta nikada ne služi za svaki marker; zadržati proverenu verziju PEEK/HALF/FULL, snapping i error recovery. **Motion:** postojeći `SHEET_SPRING`, bez oscilacija; realna camera/Back memorija. Ne imitiraj Airbnb cenovne pinove — naš PIN ne otkriva cenu/identitet. Vizuelni gate: greška+retry na 360dp iznad donje navigacije (istorijski potvrđen problem).

**Zašto:** brzo pronaći odgovarajući posao. Nije poseban „Za mene“ tab niti mapa sa cenama na pinovima.

**Redosled local:** (1) floating, lagan **Pretražite zadatke [područje]** + Filter; (2) horizontalni quick chips **Na lokaciji | Na daljinu | Za mene | Danas | Ovaj vikend** bez višestrukih ikonica; (3) mapa sa approximate TASK/PLACE/cluster pinovima, *bez cene i requester imena na pinovima*; (4) beli list sheet sa handle-om i count-om **PEEK / HALF / FULL**; (5) obične kartice rezultata unutar HALF/FULL; (6) bottom nav u običnom discovery-ju. `PEEK` = handle + „N zadataka u ovom području“ bez odsečene kartice. `HALF` = mapa gore, prava lista dole. `FULL` = lista dominantna, mapa ostaje pozadina. Swipe po karticama ne pomera mapu. Pin tap → izabrani marker/preview, dok preview postoji bottom nav je sakriven; tap preview→Task. Tap list card→Task direktno.

**Dense Task card:** naslov (može 2 reda), **uporediva cena** (`po osobi`, `sat / osoba`, `Traži ponude`), vreme/rok, mesto i samo pouzdana distanca, broj ljudi ako relevantno, odnos (`Vaš zadatak`, `Prijava poslata`) samo kada je potvrđen. Nema requester identiteta, alata/vozila, broja javnih prijava, full opisa ni dodatnog `Pogledajte` dugmeta. **Remote:** isti search/filter/chips, zatim **Zadaci na daljinu** i puna lista; *nema mape, udaljenosti ni lokalnih pinova*, ali rok se jasno vidi.

**Attention:** ako `Za mene` zahteva profil, mali contextual sheet „Podesite radni profil“ sa akcijom, bez lažnog uključenog filtera; ako je filter aktivan, zeleni indikator na Filter. **Prazno:** local zadržava mapu i kaže „Nema zadataka u ovom području“ + „Pomerite mapu ili promenite filtere“; remote prikazuje miran first-empty + „Očistite filtere“ samo ako su uključeni. **Dug sadržaj:** kartice ne rastu u mini-detail, naslov max čitljive dve/tri linije; desetine rezultata virtuelizovati. **360dp / 1,3×:** filter i search ostaju fizički odvojeni, chips skroluju horizontalno, sheet koristi punu raspoloživu visinu, CTA ničim nije skriven. **Nedostupno:** mapa bez rezultata nije dokaz „0“; stale list/pin dataset ostaje zajedno, bez mešanja starog i novog scope-a. **Tap/Back:** search→poseban Search (šta/gde mogu nezavisno); Filter→sheet; Na daljinu→remote full-list uz pamćenje local kamere/sheet-a; pin→preview, list→detail; Back iz detail-a vraća tačan pin/scroll/filters. **Bez „Map/List“ prekidača i bez „Pretražite ovo područje“.**

### S02 — vizuelni detalj: jedna mapa, jedna lista, jedna istina

| Element | LOCAL / Na lokaciji | REMOTE / Na daljinu |
|---|---|---|
| Gornja kontrola | jedan search entry „Pretražite zadatke“ + zaseban Filter, bez dodatnog FAB-a preko pina | isti search + Filter; natpis „Zadaci na daljinu“ |
| Quick controls | horizontalni kratki chips: Na lokaciji, Na daljinu, Za mene, Danas, Ovaj vikend (samo podržani) | način je jasno označen; filteri prilagođeni remote roku |
| Glavni sadržaj | približna mapa, TASK/PLACE/CLUSTER pinovi, sheet PEEK/HALF/FULL | puna skrol lista; nema prazne mape, distance, pinova |
| Kartica | naslov; cena/basis; vreme; približno mesto i stvarna udaljenost samo ako je dokazana; ljudi; moj odnos samo kad poznat | naslov; cena/basis; rok; „Na daljinu“; ljudi ako bitno; moj odnos |
| Root chrome | četiri taba samo dok nije izabran pin | četiri taba stalno na discovery root-u |

**Kretanje mape:** pomeranje kamere nije novi zahtev za user klik „Pretražite ovo područje“. Posle smirivanja mape automatski proveriti isti server scope za **count, listu i pinove**, uz jasno stanje učitavanja. Dok rezultat za novi scope nije potvrđen, prethodni prikaz sme ostati samo sa stale/scope objašnjenjem; ne kombinovati pinove jednog scope-a, broj drugog i listu trećeg. Ako backend trenutno isporučuje samo globalni spisak, UI ne sme tvrditi „N zadataka u ovom području“ kao da je broj verifikovan za viewport; to je implementation P0, ne razlog da se doda stari search-area taster. Bez automatskog traženja GPS dozvole samo radi pregledanja.

**Sheet:** `PEEK` = handle + autoritativni count i najmanje jedno objašnjenje filtera/scope-a; ne odsečena kartica. `HALF` = vidljiva mapa gore, vertikalna lista dole; mapa i lista ne dele gesture ownership u istoj zoni. `FULL` = dominantna lista, mali kontekst gde se pretražuje, moguć povratak swipe-om. Na malom telefonu snap visine prilagoditi dostupnoj visini i tastaturi, ne koristiti fiksnu visinu koja sakriva tabove.

**Pin:** običan TASK tap istakne tačan pin i otvori **jedan** kompaktan preview sa naslovom, cenom/basis-om, vremenom, coarse lokacijom i ljudima; link u detalj je ceo preview. Ne dodavati i veliki „Otvori detalj“ button i posebni „Zatvori pin“ button uz istu karticu. Zatvaranje preko Back/X ili tap van preview-a vraća isti sheet snap i map camera. PLACE tap pokazuje zadatke na istoj približnoj tački; CLUSTER samo zumira/otvara skup, bez izmišljanja identiteta. Pin ne prikazuje cenu/requester. Selected preview krije root nav samo tokom selekcije.

**Empty i failure su različiti:** potvrđeno local 0 → mapa ostaje i sheet kaže „Nema zadataka u ovom području“ + „Pomerite mapu ili promenite filtere“. Potvrđeno remote 0 → „Trenutno nema zadataka na daljinu“ + „Promenite filtere“ samo ako su uključeni. Failed map tiles ≠ task-list read error; ako lista uspe, korisnik može čitati rezultate uz pošteno objašnjenje da mapa nije dostupna. Failed dataset ≠ 0. `Za mene` bez Radnog profila ne aktivira filter već otvara kontekstni put do S14.

**Dugačak naslov / 360dp / 1,3×:** dense card najviše 2–3 čitljiva reda naslov + cena kao zaseban jasan blok; kratki facts se prirodno prelamaju. Search i Filter imaju najmanje **48dp** dodirne mete i ne preklapaju map gestures; chips imaju horizontalni pomak sa vidljivom sledećom opcijom. Na 1,3× FULL sheet je punopravna lista, ne niz visoko naslaganih chipa. Back iz detail-a zadržava query, filter, local/remote, list offset, map position i selected pin.

**Reuse / delta — ispravljena identifikacija komponente:** `src/app/(app)/zadaci.tsx` (`ee3f5813`) na pravoj `work/rev14-review-f17` grani već vodi lokalni **map + sheet** u `PEEK/HALF/FULL`. Stara `MarketplacePresentation` varijanta sa `Lista | Mapa` bila je iz **pogrešnog repozitorijuma** i nije current discovery; aktuelni `MarketplacePresentation.tsx` (`60011641`) služi **Mojim zadacima**. **KEEP** stvarnu discovery infrastrukturu, server relation guard i privacy; **PROVERITI** kartice, realni spatial scope, remote/full-list, pin preview i UX na uređaju pre označavanja bilo koje konkretne stavke kao regresije.



### S02 — precizna vizuelna provera postojeće Discovery galerije

**KEEP:** stvarni `DiscoveryPresentation.tsx`, `TaskCard.tsx` (`c96fec9f`) i `DiscoveryPeek.tsx` (`a1e61652`) već koriste **isti** `TaskRecordBody` na kartici i na izabranom pinu; ne dizajnirati dve različite kartice. `DiscoveryPeek` već meri dostupnu visinu, ima X/zatvaranje, jedno preview odredište i PLACE listu do tri stavke sa „Prikaži sve u listi“. `zadaci.tsx` čuva `peek/half/full` stanje i source već razdvaja MAP/PAGE/relations; stvarna mrežna usaglašenost nije time potvrđena.

**Composition LOCK:** search i relevantni filteri iznad mape; local approximate pins bez cena/identiteta; sheet PEEK samo izbroji scope, HALF otkriva jednu upotrebljivu karticu, FULL postaje lista; pin preview ne uvodi drugo „Otvori detalj“ primarno dugme. Remote-full list ne otvara praznu geografsku mapu. Place pin i group/cluster nisu običan individualni zadatak. „Za mene“ bez radnog profila nudi tačan izlaz, ne prikazuje lažno uključeni filter.

**Design Lab tačni ulazi:** `dizajn-zadaci?scene=kartice`, `kartice-veliki`, `lista&n=8&sheet=half`, `lista&n=8&sheet=full`, `lista-prazno`, `lista-ucitavanje`, `lista-greska`, `lista-za-mene`, `lista-za-mene-odbijeno`, `pretraga`, `pretraga-sta`, `filteri`, `filteri-izabrano`, `kartica-na-mapi`, `kartica-na-mapi-dugo`. Galerija koristi **skicu geografije** i svoje statične podatke; stvarnu mapu/pin/pan/attribution/Back i Android tab-bar insets treba proveriti na ruti `/zadaci` sa stvarnim renderer-om. U toj proveri count/list/pins moraju pripadati istom filter scope-u; semantika „Na daljinu“ i hidden pin je P0.



### S02 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `src/ui/v2/DiscoveryPresentation.tsx` `842f0b7d`; `discovery/DiscoveryListState.tsx` `b34e0a75`; `DiscoveryListSheet.tsx` `aabff658`; `DiscoveryPeek.tsx` `a1e61652`; `dizajn-zadaci.tsx` `2dcf0339`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Search/filters/chips nad mapom → mapa → BottomSheet PEEK/HALF/FULL, `DiscoveryListState` unutar liste; izabrani pin otvara poseban `PeekSheet` i privremeno sklanja root tab; remote ima listu.

**KEEP:** Map/list jedan dataset i tri snap pozicije; separate page/map/retry; safe-insets i dinamičko merenje, bottom padding `sys.space.xxl + barHeight`, `Reduced Motion`, pin preview.

**DELTA:** **P0 VISUAL GATE**: istorijski `02-mapa-panel.jpg` pokazuje error/Retry delimično prekriven root nav; ne proglašavati aktuelnu granu popravljenom samo iz koda. P1: `LIST_STATE_WORDS` još koristi `tebe/vidiš/Objavi`; formalizovati i proveriti PEEK/HALF neodsecanje i nezavisan tile/list failure.

**Finalna kompozicija, vrh → dno:** Search/Filter → chips → local mapa → sheet handle/count → HALF/FULL kartice; remote bez mape; pin preview jedna kartica bez dodatnog CTA.

**Tap / Back / state / recovery:** Back task→tačan filter/kamera/sheet/list offset; X/Back zatvara pin pre prelaska na root; potvrđen empty ≠ read error; retries ne resetuju drugi nezavisni read. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** Proveriti 360dp, font 1.3×, prelom error tekst/dugme iznad root nav, landscape i Android gesture; 48dp Filter/Retry, TalkBack title + recovery, disabled beneath pin, Reduced Motion. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-zadaci`: `lista`, `lista-greska`, `lista-prazno`, `kartica-na-mapi`, `detalj`; **real `/zadaci` ruta je obavezna**.

**Prioritet:** P0 error/footer/nav geometrija i javna privatnost; P1 formal copy/scope. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S03 — TASK DETAIL / Javni i moj zadatak, jedan vizuelni kostur

**VISUAL SIGNATURE (B0):** velika originalna fotografija **samo ako postoji**; jedan glavni naslov 30/35, zatim sažeta cena/basis + mesto + vreme + ljudi u činjenicama bez četiri druge kartice, opis i realne zahteve, Q&A/poverenje, mapa i **jedna** action oblast. Bez slike: naslov kreće odmah posle headera, ne generička ilustracija radnika. Isti optički ritam i sadržinska hijerarhija na javnom/owner detalju, uz različita prava. Motion: nova slika iz galerije nema carousel autoplay, Back čuva izvorni pin/sheet.

**Zašto:** razumeti jedan posao i odlučiti o prijavi (worker) ili upravljati istim poslom (owner). Ne praviti dva različita vizuelna sveta.

**Zajednički kostur vrh → dno:** (1) Back + `⋯` samo kontekstne sekundarne akcije; naslov u chrome-u se pojavljuje tek posle scroll-a; (2) **fotografije kao prvi sadržaj** kada postoje, hero + thumbnails (bez praznog foto bloka); (3) veliki pun naslov; (4) kratak summary — **cena/basis**, vreme/rok, približno mesto, potreban broj ljudi i samo proverena pokrivenost; (5) **O zadatku** i pun opis / „Prikažite ceo opis“; (6) **Važno za zadatak** — samo stvarni zahtevi; (7) **Objavio** / samo dokazani zajednički reputacioni skor naloga autora za javni pogled; (8) **Pitanja i odgovori**, prvo koristan answer preview, zatim „Prikažite sva pitanja“ i „Postavite pitanje“ ako dozvoljeno; (9) **Mesto** sa približnom mini mapom samo za local, sa tekstom „Tačnu adresu naručilac deli u Dogovoru“; (10) diskretna bezbednosna akcija za javni zadatak; (11) sticky prijava/ponuda samo ako je worker eligible.

**Owner varijanta:** posle summary-a (fotografije ostaju gore, bez ponavljanja) dodati **stanje + coverage** (npr. „2/3 dogovoreno“), **šta sada treba**, **Prijave** ako ih ima i **Saradnje** kada postoje; edit olovka u headeru vraća u **AI izmenu postojećeg zadatka**, ne novu paralelnu formu. Owner ne vidi self-report ni requester trust kao da je druga osoba. Redosled owner radnog sloja je `stanje → sledeći korak → prijave → saradnje`, zatim opis, Q&A i mesto. Fotografije su već prikazane na vrhu ako postoje. Parent task činjenice ne smeju zameniti pojedinačne prihvaćene cene iz Dogovora.

**Normalno:** javni detail ima čitljiv naslov, informisanu cenu `npr. 4.000 RSD / osoba`, photo-first pa opis; owner ima kompaktnu coverage surface, ne 12 KPI kartica. **Attention:** neodgovorena owner pitanja ili stvarne prijave daju jedan relevantan CTA; promenjen ili zatvoren task jasno ograničava worker prijavu. **Prazno:** bez fotografija nema praznog placeholdera; 0 javnih pitanja je „Još nema objavljenih odgovora“; 0 owner prijava je mirno „Čekate prijave“. **Dugačak sadržaj:** naslov i opis ne skraćivati do nečitljivosti, accordion za dugačak opis, razmak između sekcija; Q&A izdvojiti na svoj screen. **360dp / 1,3×:** facts se vertikalizuju, mapa po širini, sticky CTA jedno jasno dugme. **Nedostupno:** kada relation/eligibility nije autoritativno proverena, **ne dozvoliti submit kao da može**; stale/unknown recovery sa Osvežite. **Tap/Back:** fotografija→viewer; osoba→public role profile; Q&A→task QA; mini mapa→samo približni kontekst; prijava→S04; owner prijave→S07; saradnje→S09/S10; Back vraća izvorni Discovery/owner list context.

### S03 — vizuelni detalj: public i owner dele isti kostur

**Javni zadatak, Figma normal scene — strogo odozgo nadole (JEDAN KANON):**

1. **Mirni top bar**: Back, eventualno `⋯` samo za zaista dostupne sekundarne radnje. Naslov u chrome-u tek pri skrolu.
2. **Fotografije PRVE**, *ako ih ima*: velika upotrebljiva fotografija i jasan ulaz u ostale; tap → viewer → Back na isti scroll. Bez fotografija nema praznog image-hero prostora.
3. **Pun naziv zadatka**: čitljiv, do prirodnog preloma, uz HITNO samo ako je server to zaista odobrio.
4. **Kratke ključne činjenice**: cena sa osnovicom (`po osobi`, `po osobi/satu` ili `Traže se ponude`), vreme/rok, približno mesto/`Na daljinu`, broj potrebnih ljudi. Jedan grouped facts sklop, ne četiri podignute kartice.
5. **O zadatku**: pun opis, uz smisleno širenje dugog teksta; ne ponavljati opis kao „Detalji“.
6. **Važno za zadatak**: samo stvarni zahtevi koji utiču na odluku.
7. **Objavio**: shared identitet i samo proverena *zajednička reputacija naloga*; nema lažnih ili neobjavljenih ocena.
8. **Pitanja i odgovori**: korisni odgovori, dalje čitanje i pitanje samo kad server to dozvoljava.
9. **Mesto**: samo gruba javna lokacija i mini mapa za local, nikada privatna adresa; remote nema mapu.
10. **Bezbednost i sekundarne radnje**: diskretno, stvarno dostupno.
11. **Sticky CTA**: jedna stvarna prijava/ponuda ili objašnjen zabranjen/stale/unknown status; iznad gesture/keyboard insets-a, ne preko root bar-a.

**Owner isti vizuelni jezik:** top bar → fotografije ako postoje → naslov/facts; neposredno posle facts dolazi **jedna** funkcionalna state/coverage površina (`2 od 3 mesta dogovoreno`) i relevantni ulazi `Prijave` i `Saradnje` **samo kada postoje**, potom opis, zahtevi, Q&A i approximate mapa; fotografije se **ne prikazuju ponovo** ispod statusa. Owner ne vidi sopstvenu ulogu kao tuđi requester public trust. Edit u header-u otvara **AI izmenu istog zadatka**; ako je potrebno potvrditi relevantne promene, nastavlja se kroz Review i server-gated objavu revizije.

**Attention scene:** task ima prijave → jedan naglašen `Pogledajte prijave` entry u owner bloku, ne četiri status kartice; pokrivenost i broj prijava ostaju različite veličine. Promena taska/istek roka kod worker-a → umesto prijave prikazati stvaran razlog i recovery, bez zaključivanja iz cached datuma. **Empty:** nema fotosekcije kada fotografija nema, Q&A pokazuje miran jedan red bez placeholder odgovora, owner bez prijava kaže „Čekate prijave“; ako server read ne uspe, ne glumiti empty. **Long/360/1,3×:** četvorodelni facts prelaze na 1/2 kolone ili redove, cena i vreme se ne seku; mapa ide pune širine; sticky footer je jedan, iznad navigacionog insets-a i tastature.

**Reuse / delta — aktuelni izvor:** stvarni `PublicNeedPresentation.tsx` (`24900dc6`) pročitan je iz `USKOCI-EAN@work/rev14-review-f17`, ali **njegov kompletan vizuelni redosled i prikaz dodatnih delova nisu još detaljno potvrđeni**. Primer redosleda `state → facts → opis → mapa → photo` poticao je iz **pogrešnog** `USKOCI-CLEAN` repozitorijuma i povučen je kao trenutni nalaz. Sačuvati postojeće privacy/relation/recovery mehanizme kada se potvrde na novoj grani; tek po stvarnom read-u i screenshot-u odrediti photo-first, trust i Q&A konkretni CODE delta prema S03.



### S03 — potvrđena vizuelna razlika u REDOSLEDU javnog detalja i pregleda za objavu

**DIREKTNO PROČITANO:** `PublicNeedPresentation.tsx` (`24900dc6`) trenutno renderuje `status → TaskDecisionTitle → TaskDetailSummary → fit → opis → photos → zahtevi → naručilac → Q&A → mesto/mapa → safety`. Nasuprot tome, `ReviewDetail.tsx` (`6cf7a43b`) već počinje sa **fotografijama**, zatim naslovom, činjenicama i opisom. To su dve stvarno različite kompozicije iste potrebe; ovo nije hipotetički problem stare grane.

**Final layout LOCK:** javni i owner/publish preview koriste jedinstven skeleton sa **fotografijama na vrhu samo kada ih zaista ima**, zatim naslov, cenu/osnovicu, mesto, vreme, ljude, opis, uslove, odgovarajuću osobu/pitanja i po potrebi mapu. Kada **nema** fotografija, ne ostavljati prazan image hero ili visoku belu prazninu. Kontrolu statusa, broj slobodnih mesta i sticky CTA prikazivati prema istinitoj ulozi (`OWNER`, `APPLIED`, `UNRELATED`, `UNKNOWN`) i starosti read-a; kod UNKNOWN nema lažnog „Pošalji prijavu“. Owner-private tačna adresa iz `OwnerAddress` nikada ne ulazi u javni map/preview sloj.

**Već postoje scene:** `dizajn-zadaci?scene=detalj`, `detalj-veliki`, `detalj-prijavljen`, `detalj-moj`, `detalj-zatvoren`, `detalj-uklapanje`, `detalj-ponude`, `detalj-ucitavanje`, `detalj-greska`, `detalj-nedostupan`; a owner/review u `dizajn-objava?scene=pregled-spremno`, `pregled-dugo`, `pregled-bez-fotografija`, `pregled-daljina`, `pregled-ruta`. P0 privacy i P1 redosled odvojiti: visual order je cilj, ali bez pregleda native scene ne pisati PIXEL VERIFIED.



### S03 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `PublicNeedPresentation.tsx` `24900dc6`; `NeedPresentation.tsx` `8c6ba47b`; `ReviewDetail.tsx` `6cf7a43b` (raniji potvrđeni blob); `dizajn-zadaci.tsx` `2dcf0339`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Public: status → TaskDecisionTitle → TaskDetailSummary → fit → opis → fotografije → zahtevi → naručilac → Q&A → mapa/safety. Review već renderuje fotografije pre summary-ja.

**KEEP:** Role/relation guards, privacy, public coarse mesto, pitanja, fit, postojeći `ReviewDetail` photo-first i states.

**DELTA:** P1 **isti photo-first skeleton** za javni/owner/review kada foto ima; ne sakriti status/eligibility; P0 requester trust je autorizovan zajednički account rating i nema private adrese.

**Finalna kompozicija, vrh → dno:** Back → fotke (ako postoje) → naslov → osnovica/cena/vreme/mesto/ljudi → opis → zahtevi → osoba → Q&A → coarse mapa → safety → uslovni sticky CTA; owner state+coverage/prijave/saradnje odmah posle facts.

**Tap / Back / state / recovery:** Back čuva izvorni pin ili privatnu listu; detail → prijava/kandidati/Dogovor; relation unknown ne dozvoljava submit; stale i empty različiti. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp činjenice vertikalno, naslov i puna cena vidljivi na 1.3×; foto viewer i keyboard Q&A ne preklapaju CTA; TalkBack alt za stvarno učitane slike. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-zadaci`: `detalj`, `detalj-veliki`, `detalj-prijavljen`, `detalj-moj`, `detalj-greska`; `dizajn-objava`: `pregled-spremno`.

**Prioritet:** P0 privacy/relation; P1 photo order. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S04 — APPLICATION / Vaša prijava i review

**Zašto:** poslati jednu konkretnu prijavu za jedan konkretan zadatak. **Jedna mirna forma, ne wizard.**

**Redosled vrh → dno:** (1) Back + **Vaša prijava** i diskretno „Šta vidi druga strana“; (2) compact task title + mesto + termin/rok, ne ponavljanje foto/mape/requester Q&A; (3) **Koliko Vas dolazi?** stepper samo ako više od 1 mesta uopšte može da se prihvati, inače „Dolazite sami“; broj je svojstvo *ove prijave*; (4) **Vaša ponuda** input samo kada task traži OFFERS — unosi se **ukupna cena za sve ljude**, sa izvedenim po-osobi gde relevantno; MY_PRICE nije editable; (5) **Termin / rok koji prihvatate** read-only, fixed/flexible/remote odgovarajući tekst; (6) opciona **Poruka**; (7) iznos/ljudi sa sažetkom i CTA **Pregledajte prijavu**; (8) **Proverite prijavu** kao review sheet sa svim prihvaćenim uslovima; završni **Pošaljite prijavu** ili **Pošaljite ponudu**.

**Fiksna cena:** PER_PERSON × ljudi; TOTAL budžet se raspodeljuje po zauzetim mestima uz verifikovanu server formulu; HOURLY po osobi × ljudi daje stopu za ovu prijavu, **ne** lažni jednokratni total. **Alternativni termin se NE predlaže u novoj prijavi**: flexible tačan termin dolazi kasnije kroz Dogovor. Prijava ne menja trajni radni profil. **Odluka vlasnika 03.11.2026:** posle potvrđene prijave ponuditi odvojeno dodavanje te usluge u profil. Preciziranje vlasnika istog dana: jedna kratka ponuda „Dodajte ovu vrstu posla u radni profil” i dugme „Dodaj”; nema dodatnog pregleda, druge potvrde ili objašnjenja ID-jeva, servera i povezivanja. Taj klik odobrava uslugu i način rada iz već poznatog zadatka. Server koristi njegov potvrđeni ID usluge bez novog AI poziva; ne izmišlja dodatni mode/handoff i ne menja ostale usluge, područja ili dostupnost. Interna priprema i postojeći Save izvršavaju se iza tog jednog klika. Povratak ostaje dostupan iz Mojih prijava. Kratko „Dodato u radni profil” zahteva potvrđen rezultat; tokom obrade samo „Dodavanje je u toku”, a greška ima kratak način oporavka. Bez tehničkog objašnjenja ili obećanja push isporuke.

**Normalno:** jedna skrolabilna forma, jedan pregled pre slanja, zatim verifikovan success receipt i „Otvorite moje prijave“. **Attention:** promena revision-a, ostatka mesta, neaktivan radni profil ili potvrđeni calendar conflict daju konkretan razlog i jedan recovery CTA; invalidiran review ne šalje prethodne uslove. **Prazno:** opcioni note bez sadržaja nije greška; OFFERS bez cene objašnjava šta treba uneti. **Dugačko:** poruka skroluje u polju, limit i counter tek kada relevantno. **360dp / 1,3×:** stepper, ukupna cena i hint raspoređeni vertikalno; review sheet raste; keyboard ne prekriva ponudu ili dugme. **Nedostupno / nepoznat ishod:** frozen intent, „Ne znamo da li je prijava poslata“ → **Proverite da li je poslato**; nikada automatski drugi submit. **Tap/Back:** pre slanja→Task sa sačuvanim nepredatim inputom; posle potvrđenog uspeha→Moje prijave / Task; izmenite u review-u→isti form; neproduktivni Back ne kreira novu prijavu.

**Obavezna implementation kontradikcija:** zatečeni backend guard još pominje `team_capacity` (prema korisničkom izveštaju; nije ponovo live provereno), dok je FINAL PRODUCT „broj ljudi je isključivo na prijavi; remaining slots + sigurnosni maksimum“. Implementation mora uskladiti server guard i payload, **ne** vraćati trajni team-size u Radni profil.

### S04 — konkretan miran formular i obavezni završni pregled

**Normalni mali telefon — sekcije u jednoj koloni:** `Back + Vaša prijava` → jedna **tanka Task summary** (`Selidba stana · Liman · sutra, 10–13`) → `Koliko Vas dolazi?` (default **1**, stepper/izbor do preostalih mesta i validnog limita) → **samo za OFFERS** `Ukupna ponuda za ovu prijavu` (RSD, po-osobi pokazano kao mirna izračunata činjenica kada je dobro definisana) → `Termin/rok zadatka` **read-only bez chevron-a** → `Poruka uz prijavu` opciono → jedan sticky **Pregledajte prijavu**. Za fiksno MY_PRICE prikazuje se prihvaćeni iznos/basis kao read-only rečenica, **ne** prazno zaključano input polje.

**Review je zasebna potvrda, ne drugi editor:** bottom sheet koji bez novih inputa navodi *tačan zadatak, poznatu reviziju, broj ljudi, cenu i jedinicu, termin/rok koji se prihvata, poruku koja će biti poslata*. Primarna akcija **Pošaljite prijavu / Pošaljite ponudu** i sekundarna **Vratite se na izmenu**. Pre slanja ponovo proveriti scope, preostala mesta, radni profil i revision; ako je task izmenjen, zatvoriti stari review i ponuditi aktuelan pregled. Nema potvrde bez autoritativnog write/readback dokaza.

**Cena kao korisnička istina, ne jedna formula za sve:** MY_PRICE/PER_PERSON prikazuje cenu za **odabrani broj ljudi**; TOTAL govori šta znači iznos celog zadatka i **ne deli se na pamet** bez potvrđenog server ugovora; HOURLY navodi stopu za celu prijavu `RSD/sat za N osoba` i nikad ne glumi konačan jednokratan iznos. OFFERS unosi **jedan ukupni ponuđeni iznos za ljude koje prijava pokriva**, a per-person se koristi za fer poređenje kod Candidates. Dogovor čuva prihvaćeni bilateralni snapshot, nezavisno od kasnije izmenjene cene taska.

**Termin:** fixed/flexible/remote info prikazuje se bez edit affordance-a. Kod fleksibilnog zadatka pisati „Tačan termin dogovarate nakon izbora.“; bez novog `Predlog termina`, `start/end`, kalendarskog picker-a niti promene profile skills tokom slanja. U aktivnom Dogovoru postoji posebno mesto za predlog izmene uslova.

**Attention:** preostalo 0 mesta / nedostupan worker profil / promenjena revizija / potvrđeni hard calendar conflict → jedan jasan razlog i recovery, **ne** omogućiti `Pošaljite`. **Empty:** prazna opciona poruka je uredno stanje; OFFERS bez cene ima inline validaciju. **Unknown write:** zadržati sačuvan, immutable idempotent intent i pokazati „Nije potvrđeno da je prijava poslata. Proverite stanje.“ → **Proverite ishod**, nikad „Pošaljite opet“ kao drugi novi zahtev. **Success:** tek posle potvrđenog receipt-a `Prijava je poslata` → **Otvorite moje prijave**. **360/1,3×/tastatura:** people i cena postaju vertikalni, price basis uvek vidljiv, CTA ne prekriva polje; Back sa neprosleđenom izmenjenom formom potvrđuje napuštanje samo kada bi izgubio stvarno unete podatke.

**Reuse / delta — proveriti pravi modul:** raniji nalaz `ApplicationSelectionPresentation` sa `IntervalEditor` i `Predlog termina` poticao je iz **pogrešnog** `USKOCI-CLEAN` snapshot-a. U `USKOCI-EAN@work/rev14-review-f17` `ApplicationSelectionPresentation.tsx` (`7148130c`) pokriva pretežno **Candidates/Selection**, a nova prijava ima zaseban composer. **Nije opravdano** tvrditi da trenutna prijava i dalje nudi alternativni termin ili nema review pre nego što se otvori odgovarajući stvarni RN modul i pregledaju scene. Product contract S04 ostaje zaključan; sačuvati dokazano idempotentni journal/recovery ako je prisutan na aktuelnom toku.



### S04 — ispravljena činjenica: pregled prijave VEĆ POSTOJI, alternativni termin je stvarni DELTA

**KEEP, direktan source:** `ApplicationComposerPresentation.tsx` (`d6540699`) već ima `Pregledaj prijavu` → `ProductSheet title="Ovo šalješ"` → `Pošalji ovu prijavu` / `Izmeni prijavu`, s review ključem vezanim za trenutni Need, reviziju, cenu/osnovicu i polja prijave. Postoji `SentReceipt`, `Proveri da li je poslato` za nepoznat ishod, `ApplicationPeopleInput` sa granicom preostalih mesta, TOTAL/HOURLY osnovica i zaštita komande. **Ne praviti ponovo review ili odvojeni „drugi formular“.** Ranije tvrdnje da nema završnog pregleda su za trenutni pinovani kod netačne.

**VERIFIED UX CONFLICT:** u istom formularu ostaje sekcija `Kada možeš` sa tekstom `Termin zadatka. Možeš da predložiš drugi`, a `ExactTimeSheet` traži poseban datum/početak/kraj. To je protiv konačne S04 odluke **prijava se odnosi na objavljeni termin, bez predloga alternativnog termina u NOVOJ prijavi**. U ciljnom UI to zamenjuje **jedan read-only red „Termin zadatka“**, sa jasnim objašnjenjem kada je fleksibilan; vremenski pregovori idu u već potvrđen Dogovor kao predlog izmene. Ne izbrisati postojeći request/receipt podatak bez prethodno potvrđenog kompatibilnog ugovora; ovo je UI contract, ne izvršna server izmena.

**Smer jednostavnosti:** hero sa naslovom i približnim mestom, cena/ponuda (samo po relevantnom cenovnom modu), jedan broj ljudi, prikazan objavljeni termin, opciona kratka poruka, jedna sticky akcija `Pregledajte prijavu`. Opciono dopunjavanje profila prikazuje se tek uz potvrdu poslate prijave ili kroz Moje prijave, prema odluci 03.11.2026. Stari `skillOptIn` u formi i tekstualni append iz submit-a zamenjuje jedna odvojena akcija „Dodaj”, sa internom pripremom i postojećim signed Save/binder-om; uspeh ili neuspeh dopune ne menja prijavu. Na review-u jasno ponoviti **jedinicu cene** (RSD ukupno za ovu prijavu / po osobi / po osobi po satu) i odgovarajući broj ljudi; ne izmišljati konačnu ukupnu cenu satnice.

**Stvarne scene:** `dizajn-prijava-forma?scene=prazna`, `ponuda`, `pregled`, `pregled-veliko`, `po-osobi`, `cela-ekipa`, `zaokruzena`, `profil`, `ishod`, `poslato`, `poslato-dugo`; i `dizajn-prijava?scene=termin`, `pregled`, `odbijeno`, `dugacko`. `termin` je **legacy conflict specimen**, ne acceptance target. Na 360dp/1,3× finalni pregled mora imati vidljivo „Pošaljite ovu prijavu“ iznad gesture area i Back koji vraća isti nenaplaćen/nedostavljen tekst.



### S04 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `ApplicationComposerPresentation.tsx` `d6540699`; `dizajn-prijava-forma.tsx` `d8cacd5e`; `dizajn-prijava.tsx` `9187fa02`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Task context → broj ljudi / cena / termin → opciona poruka → `Ovo šalješ` review sheet → odvojeni explicit submit/receipt/recovery; još postoji zaseban alternate-time (`ExactTimeSheet`) u novoj prijavi.

**KEEP:** Existing edit + review before final write, idempotent protected send/readback, status `ishod nije poznat`, immutable unit and one-application people.

**DELTA:** P1: ne nuditi drugi termin u *novom* formularu; `Ovo šaljete`/formal Vi; legacy pending intent ne prepisivati. HOURLY kao stopa po osobi na sat, ne jednokratni zbir.

**Finalna kompozicija, vrh → dno:** Back/title → task context → ljudi → OFFERS cena ili read-only accepted basis → termin read-only → poruka → `Pregledajte prijavu` → `Ovo šaljete` → `Pošaljite` → receipt.

**Tap / Back / state / recovery:** Back sa review→forma s očuvanim unosom; unknown outcome blokira novi write i nudi Proverite stanje; changed revision invalidira review. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp input/stepper ne stiskati; 1.3× review i duga poruka skroluju, keyboard-safe sticky; 48dp i TalkBack total/people/HOURLY izgovor. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-prijava-forma`: `prazna`, `pregled`, `pregled-veliko`, `ishod`, `poslato`; `dizajn-prijava`: `ponovi`, `termin`.

**Prioritet:** P0 send idempotency/accepted units; P1 alt-time/copy. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S05 — MOJI ZADACI / privatni owner pregled

**Zašto:** na jednom mestu videti zadatke koje sam objavio i njihove stvarne sledeće korake. Otvara se iz Početne/Profila; **nije peti root tab**.

**Redosled:** (1) Back + **Moji zadaci**, diskretni Filter; (2) grupa **Čeka Vas** samo za taskove sa stvarnim owner attention-om; (3) **Objavljeni** (traže ljude, nema akcije za izbor); (4) **Dogovoreno / U toku**; (5) row **Nacrti →**; (6) row **Prethodni zadaci →**. Grupe bez rezultata uopšte ne zauzimaju prostor. Svaka card: title, task price basis, datum, mesto, **coverage** i samo jedna sledeća informacija („3 prijave čekaju pregled“); celina otvara owner detail. Inline „Pogledajte prijave“ kada zaista postoje prijave za izbor.

**Normalno:** kratke cards, bez ponavljanja group statusa unutar svake kartice, bez dupliranog fab-a. **Attention:** card sa prijavama ili promenjenim stanjem ide gore samo kada server ima dokaz; ne brojati prijave kao pokrivena mesta. **Prazno prvi put:** mali postojeći publish art, „Još nemate zadatak“ + **Objavite zadatak**. **Prazno aktivno, sa istorijom:** „Nema aktivnih zadataka“, zatim Nacrti/Prethodni, ne first-run art. **Dugačko:** naslovi max čitljivih redova, lazy/pagination, sticky samo naslov grupe ako značajno pomaže. **360dp / 1,3×:** cena, mesto, vreme i coverage raspoređeni na više linija, bez sitnog teksta. **Nedostupno:** posebno obaveštenje i retry; ne prikazivati 0 kao punu istinu. **Tap/Back:** cela card→Owner Task; footer prijave→Candidates; Nacrti→draft collection→AI/Review; Prethodni→domenska istorija; Back→Početna ili stvarni izvor.

### S05 — dodatno zaključan ritam prikaza

`Moji zadaci` je **lista sa grupama**, ne mešana `Sve / Objavio sam / Prijavio sam se` arhiva. Header + kontekstni Filter → samo ako server potvrdi `Čeka Vas` group → `Objavljeni` → `Dogovoreno / U toku` → dva obična reda `Nacrti →` i `Prethodni zadaci →`. Celina kartice je tap; ako nove prijave postoje, `N prijava traži pregled` je jedan mali action-cue, ne poseban narandžasti CTA na svakom zapisu. `N/M` znači mesta dogovorena, a `N prijava` broj pristiglih prijava — nikada ista mera. Kada nema taskova, prikazuje se poziv **Objavite zadatak**; kada nema aktivnih, ali istorija postoji, ne prikazivati početničku ilustraciju. Back → pravi Home source, bez generičnog „Moje aktivnosti“ zaobilaznog ekrana.



### S05 — Moji zadaci: stvarna kartica i galerije, bez novog paralelnog pregleda

**KEEP:** postojeći `MarketplacePresentation` i `dizajn-moji-zadaci.tsx` (`c340dfa6`) već imaju funkcionalne fixture scene `lista`, `puno`, `dugi`, `nacrti`, `istorija`, `prazno`, `prazan-skup`, `ucitavanje`, `greska`, `veliki`, `stranice`. Sadržaj je **privatna lista zadataka**, ne discovery. Za svaki task jedan status, broj prijava/izabranih na autoritativnim podacima, jedna odgovarajuća akcija; dugačka imena prelamaju, ne skupljati status u 9 minijaturnih čipova.

**P1 visual delta:** grupisanje `Aktivni / Nacrti / Prethodni` čuva istoriju bez dodatne „aktivnosti“ početne; jedan veći task sa više bilateralnih saradnji može da otvori **S09 task-group**, a ne da duplira isti task u horizontalnim Home karuselima. Na `stranice` i `greska` potvrditi da neuspeh naredne strane ne briše prethodno učitanu listu. `Nacrti` nikad nisu `Objavljeno` dok server nije potvrdio PUBLISHED.



### S05 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `MarketplacePresentation.tsx` `60011641`; `dizajn-moji-zadaci.tsx` `c340dfa6`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Privatna owner lista kroz `FlatList` → grupisani statusi/row taskovi → filter sheet sa Pretraga, Način cene, Čeka izbor → load-more i retry; copy `tvoj` i `Pokušaj` i dalje postoji.

**KEEP:** Paginacija, filteri, pull-to-refresh, owner-only statusi, pristupi nacrtu/objavljenom i delimično učitavanje.

**DELTA:** P1 jednostavan redosled „Čeka Vas / Objavljeni / Dogovoreno ili u toku / Nacrti / Prethodni“ bez konkurentskih root tabova i bez ponovljenih badge-ova; formal copy.

**Finalna kompozicija, vrh → dno:** Header Moji zadaci → Search/Filter → relevantna `Čeka Vas` → aktivni statusi → Nacrti → `Prethodni zadaci` ulaz → lista/empty; bez feed-a.

**Tap / Back / state / recovery:** Tap→owner Task sa povratkom filter/query/scroll; partial page ne tvrdi da je ukupan rezultat kompletan; filter reset ne briše server status. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp title+status 2–3 reda; 1.3× row visina prirodna; keyboard filter-sheet iznad system/nav; 48dp i TalkBack status odvojen od broja prijava. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-moji-zadaci`: `puno`, `nacrti`, `istorija`, `stranice`, `prazno`, `greska`, `veliki`.

**Prioritet:** P1 grouping/copy; P0 correctness on owner-only data. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S06 — MOJE PRIJAVE / worker privatni pregled

**Zašto:** videti na šta sam se prijavio i šta treba da uradim dok izbor ne postane Dogovor. **Nije kopija Dogovora.**

**Redosled:** (1) Back + **Moje prijave**; (2) tri ljudska taba **Čekaju odgovor | Čeka Vas | Prethodne**; (3) vertikalne application cards: task title, provereni status, moja ukupna/po-osobi ponuda, ljudi, termin/rok i mesto, jedan sledeći cue; (4) paginacija/refresh. `Sve` nije četvrti stalni tab; ostaje interna mogućnost za exact deep-link retrieval.

**Normalno:** „Poslata“, „Viđena“, „U užem izboru“ u prvom tabu; izabrana prijava prirodno vodi u novi Dogovor. **Attention:** task changed → **Zadatak je izmenjen** + pregled aktuelnih uslova, sa odlukama **Zadržite / Izmenite / Povucite prijavu**, bez novog alternativnog termina; unknown command → readback. **Prazno:** svaki tab ima svoj konkretan empty copy; prvi tab bez prijava može da ponudi **Pogledajte zadatke**, bez imitacije DM-a. **Dugačko:** notu ne prikazivati u celosti u listi, paginirati; terminalne prijave imaju poseban tab. **360dp / 1,3×:** iznos i vreme ispod title-a, status ne zauzima celu liniju ako ne mora. **Nedostupno:** ostaviti poslednju poznatu listu sa stale oznakom; bez lažnog terminalnog statusa. **Tap/Back:** card→prijava detail/status ili izabrani Dogovor; promena taska→review current vs previous samo ako diff postoji; Povucite→confirmation; Back→stvarni source / Početna.

### S06 — dodatno zaključana razlika između prijave i Dogovora

**Čekaju odgovor:** naslov zadatka, vlastita ponuda + jedinica, broj ljudi, datum i stanje poslate prijave; čitljiv row/card → njen detail. **Čeka Vas:** samo task revision ili druga *server potvrđena* radnja koju worker mora preduzeti; u detail-u pre/posle poređenje uslova kad postoji, zatim **Zadržite / Izmenite / Povucite** uz potvrdu. **Prethodne:** povučena/zatvorena/terminalna prijava sa istinitim stanjem, bez aktivnog `Pošaljite`. Izabrana prijava sa konkretnim Dogovorom pokazuje **Otvorite Dogovor**, ne duplirani radni prostor u Moje prijave. Home vodi direktno u ovu listu, a deep-link na prijavu može je otvoriti nezavisno od trenutnog taba i vratiti se u safe fallback.



### S06 — Moje prijave: stvarna forma liste i kontinuitet posle slanja

**KEEP:** `dizajn-prijave.tsx` (`14421da1`) za stvarni `MyApplicationsPresentation` nudi `lista`, `nova`, `dugi`, `pregled`, `izmena`, `ceka`, `ucitava`, `greska`, `prazno`, `strane`, `veliki`. Uvesti **nula** novih statusnih tabova ako postojeći list-scope/odnos radi; korisniku jasno treba: ono što čeka, ono što je izabrano/pretvoreno u Dogovor i istorija. Iz istog task ID-ja sa kartice prijave otvara se **javna prilika**, nikada owner private pregled.

**Visual contract:** recenzija/izmena ima svoje confirmation/unknown mesto; jedna jedina prepoznatljiva karta prijave sa naslovom, dogovorenom cenom/jedinicom, brojem ljudi i statusom. Pri `nova` potvrdni red ne treba animirati ponovo po povratku iz profila; `strane` ne uklanja ranije pročitane stavke. `ceka` nije sinonim za neuspeli upis.



### S06 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `MyApplicationsPresentation.tsx` `acc92635`; `dizajn-prijave.tsx` `14421da1`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Privatna lista i status/red prijave → changed-task pregled sa `Zadrži / Izmeni / Povuci`, editor za novu cenu/ljude/poruku → paging/retry/readback.

**KEEP:** Revision-aware changed application, lokalan draft, refresh, no duplicate write unknown, paged older entries.

**DELTA:** P1 terminologija „Čekaju odgovor / Čeka Vas / Prethodne“, odabrana prijava ulazi u Dogovor; copy `Pokušaj`, `tvoju`, `Ponuđeni termin` legacy ne treba nuditi kao novo podešavanje.

**Finalna kompozicija, vrh → dno:** Header Moje prijave → istinski action attention → čekaju odgovor → prethodne → selected Dogovor link; changed-task kao fokusiran child sheet, ne paralelan tab.

**Tap / Back / state / recovery:** Back iz changed sheet vraća isti red; KEEP/UPDATE/WITHDRAW na unknown → readback; paged load failure ne briše učitane prijave. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp editor jedna kolona; 1.3× dugi naslov i poruka skrol, keyboard-safe footer; price unit TalkBack, 48dp i ne oslanjati se samo na boju. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-prijave`: `nova`, `ceka`, `strane`, `dugi`, `veliki`, `greska`.

**Prioritet:** P0 changed-version/recovery; P1 labels/layout. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S07 — CANDIDATES / Prijave za moj zadatak

**Zašto:** izabrati konkretnu prijavu sa jasnom cenom, ljudima, terminom i poverenjem, a ne „CV kandidata“.

**Redosled:** (1) Back + **Prijave**, `Uporedite` samo ako ima najmanje dve relevantne; (2) compact strip task title + **N/M dogovoreno** i preostala mesta; (3) broj primljenih/izbornih + Sort **Pristigle**, **Cena po osobi** samo ako menja odluku (naročito OFFERS), **Ocena**; (4) candidate card: avatar, ime, **jedinstvena zajednička ocena naloga** samo kada je javni aggregate potvrđen i dostupan, iznos ukupno + po osobi gde relevantno, people count, prihvaćen schedule, kratka note; (5) tap card → full **Pregled prijave** sheet sa public worker profile link-om, punom porukom, uslovima i CTA **Izaberite**; (6) poseban confirmation „Izabrati Marka?“ sa celom prijavom; (7) verifikovan success → owner coverage / Dogovor.

**Normalno:** čista, ljudska lista, **whole application selected as a unit**, nikad delimični izbor ljudi. **Attention:** prijava više nije izbirljiva jer se promenio task, remaining places ili conflict → reason i recovery, ne aktivno Izaberite. **Prazno:** „Još nema prijava“ + povratak na Owner Task, bez lažnih profila. **Dugačko:** paginacija; poruka u sheet-u, ne na dense card-u; Uporedite do dva kandidata i porediti cenu **po osobi/slotu**. **360dp / 1,3×:** ukupna i uporediva cena na odvojenim linijama; bottom sheet može preći na full-screen ako je previše podataka. **Nedostupno:** pending Selection intent čuva se i proverava, ne birati ponovo drugu osobu dok ne znamo ishod. **Tap/Back:** task strip→Owner Task; osoba→public worker profile; Izaberite→confirm→readback; Back iz comparison-a vraća isti kandidatski skup/filter.

### S07 — karta kandidata protiv selekcione greške

**Kandidat nije CV, nego konkretna prijava.** Kartica: fotografija/ime + **dokazana zajednička reputacija naloga**, `Ukupno X RSD`, `Y RSD po osobi` **samo kad je matematički i pravno uporedivo**, `N osoba`, prihvaćen task termin/rok i jedna kratka poruka. Nema status badža „Poslata prijava“ na svakoj kartici; celina je tap. U full sheet-u su puna poruka, tačni uslovi, javni radni profil i **Izaberite prijavu**. Tap → zasebna potvrda koja proverava `N osoba` i **preostala mesta**; whole application je nedeljiva. Potvrda nije automatski uspeh — server selection/readback vodi na konkretnu saradnju. Ako 3 mesta ostaju i prijava dolazi sa 4 osobe, UI jasno kaže **„Prijava pokriva više mesta nego što je preostalo“**, nema lažnog izbora dela ekipe. Prvo dokazati dostupnost ocena po ulozi; ako nema, izostaviti broj, ne prikazivati account-blended score. Na 360dp cenu i broj ljudi pustiti u više redova, ne skrivati važnu osnovicu poređenja.



### S07 — Kandidati: proverena scena izbora, ne improvizovani modal

**KEEP:** `dizajn-kandidati.tsx` (`d81a4886`) koristi stvarne `CandidateListPresentation` / `CandidateSelectionPresentation`, a ima `lista`, `strane`, `prazno`, `ucitavanje`, `greska`, `dugacka`, `veliki`, `ponuda`, `ne-moze`, `izabrana`, `ishod`, `ponovi`, `sklopljen`, `profil`. Finalni prikaz ističe osobu i ono **što ta prijava stvarno nudi**: broj ljudi, iznos **po osobi** za uporedivi OFFERS, ukupan iznos gde je relevantan, jedinicu, termin koji je deo važećeg ugovora i poruku. Ne pretpostaviti da jedna prijava predstavlja jednu osobu.

**Selection visual:** u pregledu jedna `Izaberite ovu prijavu` sa potvrdom celog skupa ljudi/novca; pri nepoznatom ishodu **Proverite da li je izabrano** za **isti** pokušaj; potvrđen izbor otvara stvarni Dogovor ili task-group. Privatni profil kandidata u sheet-u ne otkriva neodobrene kontakte/adrese. Vizuelna QA: `ponuda` naspram `ponuda-veliki`, `ne-moze`, `ishod` i `sklopljen` sa uvećanim brojevima ljudi.



### S07 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `ApplicationSelectionPresentation.tsx` `7148130c`; `dizajn-kandidati.tsx` `d81a4886`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Header Prijave → count/sort i kandidat rows → full offer sheet (osoba, cena, ljudi, termin) → explicit selection confirm → pending/unknown/receipt; compare postoji.

**KEEP:** Whole application/seat guard, multi-seat counts, pagination, compare, public profile sheet, unknown selection verification.

**DELTA:** P0 OFFERS sortiranje je po uporedivoj ceni **po osobi**; HOURLY po jedinici; ne mešati broj prijava i ljudi; `Predloženi termin` iz legacy prijava ne vraćati u novi S04.

**Finalna kompozicija, vrh → dno:** Header + task/remaining → tačan sort/filter → kartice kandidata → details → potvrda cene/ljudi/uslova → potvrđen Dogovor.

**Tap / Back / state / recovery:** Back iz comparison vraća listu bez gubitka selekcije; unknown write → samo `Proverite Dogovor`; overfill → konkretan razlog + refresh, ne fake success. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp side-by-side compare samo ako fit, inače stack; 1.3× cena i broj ljudi bez truncation; dialog keyboard/safe-area, 48dp/announcement. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-kandidati`: `lista`, `ponuda`, `ponuda-veliki`, `ne-moze`, `ishod`, `sklopljen`.

**Prioritet:** P0 price/selection; P1 visual compare. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S08 — DOGOVORI / root lični raspored saradnji

**Zašto:** u par sekundi razumeti šta čeka mene, šta je danas i šta sledi. **Nema `Aktivni | Istorija`.**

**Redosled:** (1) **Dogovori** header, desno **Raspored** (search/filter ako obim opravdava); (2) **Čeka Vas** samo kada je potrebna radnja, do tri reda + „Prikažite sve“; (3) **Danas**, primarno vremenski orijentisane compact collaboration cards; (4) **Sledeće**, grupisano Sutra / datum; (5) **Bez tačnog termina** ako takvi aktivni Dogovori postoje; (6) samo jedan tihi ulaz **Prethodne saradnje →**; (7) root bottom nav.

**Kartica:** vreme, task title, osoba ili avatar stack sa „N saradnji“, coarse mesto i po potrebi jedna attention oznaka. *Ne* prikazivati cenu, tekst poslednje poruke, profile rating, sve statuse. Više worker-a na istom tasku u istoj vremenskoj celini → **jedan task-group card**; worker gleda samo svoj bilateralni odnos. Saradnje na istom tasku ali različitih intervala ne stapati lažno u jedan identičan vremenski događaj; task-group ostaje zajednički parent.

**Normalno:** „Selidba stana · Danas 17–20 · 2 saradnje · Liman“; tap→task-group. **Attention:** narandžasti tihi red, npr. „Potvrdite završetak“, vodi u tačan Dogovor. **Prazno:** „Još nemate Dogovora“ + jedna jasna akcija **Pogledajte zadatke** (ili Objavite zadatak ako je jasno korisniji kontekst, ali bez oba kao ista primary). **Dugačko:** danas ograničiti na razuman prikaz sa otvaranjem celog rasporeda; istorija ostaje van root-a. **360dp / 1,3×:** veliki naslov taska u najviše nekoliko redova, vreme vidljivo čak i kad mesto ide u novu liniju. **Nedostupno:** Dogovori read failed ≠ nema Dogovora; stale/retry. **Tap/Back:** Raspored→S12; jedna saradnja→S10; više→S09; Prethodne→history sa vremenskim grupama, search po title/person; bottom tab→odgovarajući root.

### S08 — dopuna kompozicije i dokaz iz RN-a

**Figma canvas (normal populated):** **Dogovori** top bar sa tihim `Raspored` linkom; nema horizontalnog `Aktivni | Istorija`. Prvi pogled pokazuje `Čeka Vas` **samo ako postoje stvarne radnje**. Za `Danas` koristiti odvojive vremenske redove: levo veliki sat ili „Tokom dana“, desno zadatak, ko dolazi i mesto; za `Sledeće` prvo „Sutra“, zatim dan/datum, ne zid jednakih kartica. `Bez tačnog termina` je kompaktna grupa bez izmišljenog vremena. `Prethodne saradnje →` pri dnu je **jedan** domain history entry. Svaka saradnja u root listi je interaktivna površina, ne ponavljati `Otvori` na svakoj kartici. Vreme je glavna vizuelna osovina, a **ne cena**. Ako requester za isti task ima više saradnji sa različitim vremenom, prikazati zasebne vremenske stavke koje mogu voditi u isti task-group; ne sabijati ih lažno u jedan termin.

**State scene:** `Čeka Vas` ima red „Potvrdite završetak · Selidba stana“ sa diskretnim narandžastim cue-om; tap vodi u **tačnu bilateralnu saradnju**, ne nasumično u task-group. Kada su dogovori prešli u prošlost, čitav root ne postaje history feed; ulaz u history ostaje vidljiv i tamo su vremenska poglavlja. Prazna potvrđena lista kaže „Još nemate saradnji“ i nudi `Pogledajte zadatke`. Nepotpuno čitanje **ne sme** izgledati kao potvrđena prazna lista.

**Direktno provereno u pravoj radnoj grani** `uskocibusiness-boop/USKOCI-EAN@work/rev14-review-f17`: `AgreementCollectionPresentation.tsx` blob `8739b315` već grupiše aktivne Dogovore po pažnji i danima, ali i dalje ima **root segment `Aktivni | Istorija`** i istorijske filtere. **Tačan DELTA** je ukloniti root segment i dati korisniku jedinstven redosled `Čeka Vas / Danas / Sledeće / Bez tačnog termina / Prethodne saradnje`, uz očuvanje postojeće logike vremenskih grupa i autoritativne pažnje. Nije potrebno ponovo osmišljavati sortiranje i validne predloge završetka. Provera važi za taj commit, ne dokazuje identitet instaliranog APK-a.


### S08 — ODOBRENO: uloga, pretraga mesta i Raspored nisu tri zasebna režima (29.10.2026.)

**Potvrda vlasnika u nastavku razgovora, 29.10.2026:** Predlog **Sve uloge / Tražim pomoć / Uskačem**, jedinstvena pretraga **naslov zadatka / ime saradnika / već prikazano mesto**, poseban **Raspored** umesto dodatnog datuma-filtera i ulaz u **Prethodne saradnje** je **ODOBREN**. Ovo nije otvoreno product pitanje, ne tražiti novu odluku za iste četiri stvari. Filter prema fizičkoj udaljenosti/GPS-u i posebna stalna traka gradova **nisu** odobreni za MVP. Status odobrenja = LOGIC LOCKED; CODE implementaciju i pixel-final dokaz voditi zasebno.

**Konačna product odluka:** Dogovori se OTVARAJU kao jedna zajednička, pregledna lista saradnji (`Čeka Vas / Danas / Sledeće / Bez tačnog termina / Prethodne saradnje`), ne kao `Aktivni | Istorija` niti kao obavezno filtriran ekran. Korisnik na jednom nalogu istovremeno može da traži pomoć i da uskače; *filter ne prebacuje identitet niti menja aktivni tab*. Postojeći filter po ulozi je korisna funkcija i mora biti SAČUVAN tokom redizajna root-a.

**Finalni vidljivi nivo (kad postoje obe uloge):** ispod naslova ili prve komandne linije jedna tiha, horizontalno dostupna rail traka `Sve uloge | Tražim pomoć | Uskačem`. Default = **Sve uloge**; `Tražim pomoć` = Dogovori zadataka koje je korisnik objavio, `Uskačem` = saradnje na tuđim zadacima u kojima je učesnik. Prikazati traku samo ako potvrđeni podaci sadrže obe uloge **ili je uključen raniji filter koji mora ostati poništiv**. Ako postoji samo jedna uloga, nema beskorisnih tri prekidača. Na 360dp i fontu 1,3× rail može horizontalno da se pomera bez smanjivanja slova i dodirne mete; odabrani izbor se automatski dovodi u kadar. Nema kartice ili drugog reda za svaku ulogu.

**Pretraga (jedno lupa dugme, bez feed-a):** dostupna iz headera kada postoje provereni Dogovori; otvara lagan Search sa jednom tekstualnom pretragom. Tekst se traži među **naslovom zadatka**, **imenom druge strane** i **prikazanim gradom/područjem** *ako te informacije postoje i korisnik već ima pravo da ih vidi*. Primeri upita: `Selidba`, `Marko`, `Liman`, `Novi Sad`. Početna pretraga je prazna. Upit sužava trenutni domenski pregled, a ne ceo USKOČI marketplace. U rezultatima ostaju ljudske vremenske grupe; one bez pogodaka se ne crtaju. `Obrišite pretragu` vraća prethodne grupe i ne menja izabranu ulogu. Isti mehanizam može se koristiti i u `Prethodne saradnje`, gde pretraga važi za history set, bez prebacivanja u aktivne Dogovore. **Backend authority:** ako čitanje nije kompletno, ne prikazivati lažnu poruku „Nema rezultata“; prikazati upozorenje da je pretraga ograničena na dostupne podatke ili ponuditi ponovno učitavanje/server search kada bude podržan.

**Lokacija:** *ne praviti odmah posebnu stalnu traku gradova, GPS/radius mapu ili „Dogovori u blizini“*. U Dogovorima korisnik već ima saradnju, ne istražuje prilike; pretraga prikazanog mesta rešava primarnu potrebu (`Novi Sad`, `Liman`, `Na daljinu` gde je autorizovano i jasno označeno). Ako realni test sa mnogo saradnji pokaže potrebu, sekundarni `Filteri` sheet može dodati **Mesto (prikazani grad/oblast)** i **Na lokaciji / Na daljinu** kao precizne filtere, bez preslikavanja mogućnosti iz Zadataka. Taj napredni filter *nije deo launch-obaveze i nije potvrđen kao implementiran*. Tačna privatna adresa, geografska distanca bez pouzdane lokacije i implicitni GPS nikada nisu filter metapodaci.

**Vreme / kalendar:** Dogovori root VEĆ čita vreme kroz grupe, pa se **ne dodaje još jedan veliki kalendarski filter ili datum od–do**. Jedna jasna akcija `Raspored` (calendar ikona sa pristupačnim nazivom) vodi na postojeći `Mesec | Nedelja | Dan`; izabrani datum tamo otvara tačan Dogovor ili task-group. Raspored je prikaz termina, **ne promena uloge**, i ne skriva grupu `Bez tačnog termina`. Povratak vraća na Dogovore sa očuvanim lokalnim izborom i scroll položajem, ako je stanje validno.

**Istorija:** root ima samo red `Prethodne saradnje →` (nema stalnog `Aktivni | Istorija`). U history prikazu postoje `Sve | Završeni | Otkazani` kao **filter ishoda**, uz istu ulogu i kontekstnu pretragu; razvrstavanje po mesecima i sa jasnim nazivom osobe/zadatka. Na root-u se ne dupliraju ova tri status filtera. Izbor uloge ostaje važeći pri prelasku u istoriju i nazad, dok reset na `Sve uloge` mora biti dostupan jednim dodirom.

**Attention/empty/error/long:** `Čeka Vas` nije filter boje nego stvarna serverom potvrđena radnja. Isti prihvaćeni Dogovor se ne duplira u više grupnih kartica zbog izabranog filtera. Kada filter ili pretraga daju 0 uz kompletne podatke: `Nema Dogovora za ovaj izbor` + `Prikažite sve uloge` ili `Obrišite pretragu` (tačno prema aktivnom ograničenju), bez kreiranja lažnog praznog naloga. Ako je čitanje nepotpuno, oznaka `Nismo učitali sve Dogovore` i `Pokušajte ponovo`; ne tvrditi da nema rezultata. Kod velikog broja Dogovora grupisanje/sortiranje ostaju stabilni, nema automatskog otvaranja dugih opisa i nema šest kartica za jedan isti zadatak. Back iz Dogovora vraća odgovarajuće izabrane filtre, pretragu i scroll; cold deep link pada na bezbedni root default.

**Postojeća implementacija potvrđena na `uskocibusiness-boop/USKOCI-EAN@work/rev14-review-f17`:**
- `src/ui/agreements/agreementListModel.ts`: `AGREEMENT_ROLE_FILTERS` sadrži **Sve uloge / Tražim pomoć / Uskačem**, `filterAgreementRole()` filtrira po ulozi *tog* Dogovora; `HISTORY_FILTERS` sadrži **Sve / Završeni / Otkazani**; grupe `Čeka tebe`, `Danas`, `Sutra`, `Ove nedelje`, `Kasnije`, `Termin još nije dogovoren` već postoje u modelu. **KEEP logiku**; copy na svim potrošačkim ekranima treba formalizovati u `Čeka Vas`.
- `src/ui/agreements/AgreementRoleRail.tsx`: postojeći horizontalni role rail ima dostupne tri opcije, minimalnu dodirnu metu i otkriva izabranu pri skučenoj širini. **KEEP** i stilski uklopiti u S08 bez dodatne paralelne kontrole.
- `src/ui/v2/AgreementCollectionPresentation.tsx`: već sadrži `roleFilter`, `historyFilter`, `AgreementRoleRail`, kalendarsku akciju `Raspored` i prikazuje role rail ako postoje obe uloge ili je uključen filter; još drži root `Aktivni | Istorija`. **KEEP filtre, kalendar i osnovne grupe; RETIRE samo nepoželjni root switch** i popravi formalni copy.
- `src/app/(app)/dogovori.tsx`: `roleFilter` i `historyFilter` su lokalno stanje koje se prosleđuje prezentaciji, a otvaranje `Raspored` već vodi na `/raspored`. **KEEP** bez globalnog role moda.
- **NIJE PROVERENO KAO IMPLEMENTIRANO:** Search po imenu/naslovu/prikazanom mestu na root Dogovorima i izdvojeni finalni `Prethodne saradnje` history screen. **DELTA za implementaciju:** napraviti jedan bezbedan search ulaz i finalnu history destinaciju *bez prepisivanja postojećih filtera*. Izbor mesta kao zaseban napredni filter je **DEFER**, ne lažni postojeći feature.

**Status S08 filter pass:** LOGIC **LOCKED** / VISUAL **CONTRACT** / CODE **PARTIAL** (role, history outcome, calendar već implementirani; root history switch i final Search ostaju neusaglašeni) / PIXEL FINAL **NOT YET**.


### S08 — novi read-only vizuelni nalaz za odobren filter, na stvarnom ROOT-u

`AgreementCollectionPresentation.tsx` (`8739b315`) direktno potvrđuje **postojeći** `AgreementRoleRail`, `HISTORY_FILTERS` i `Raspored` dugme. Stvarna početna segmentacija je još `Aktivni | Istorija`, sa dodatnim filter redovima `Uloga` i `Ishod` / `Čeka tvoju potvrdu`. **Čuvati filtere i njihovu kontrolu stanja; menjati organizaciju, ne implementirati ih od nule.**

**Konačni root visual:** u gornjem chrome-u `Dogovori` + ikone **Pretražite** i **Raspored**, odmah ispod **jedan diskretan filter** `Sve uloge / Tražim pomoć / Uskačem` (ostaje izabran u povratku sa detalja). Zatim akcijsko-vremenske SECTION grupe `Čeka Vas` → `Danas` → `Sledeće` → `Bez tačnog termina` → `Prethodne saradnje`. Kada je lista prazna, prikazati samo jednu tačnu poruku i dozvoljen izlaz, bez praznih pet naslova. U `Prethodne saradnje` se zadržava postojeći outcome izbor `Sve / Završeni / Otkazani`. Kontekstna pretraga je **naslov zadatka / ime poznate osobe / već prikazano mesto**; ne otvara novu lokacijsku mapu i ne tvrdi da pretražuje privatne adrese.

**Read-only galerie:** `dizajn-dogovori?scene=list`, `grouped-list`, `history`, `long`, `empty`, `loading`, `error`; to je testni materijal sa sadašnjom `Aktivni | Istorija` kontrolom, **ne finalno odobren root render**. Realna reprodukcija mora proveriti 360dp, filter-chips wrap i povratak sa Dogovora. Ovaj ekran nema potrebu za dodatnim kalendarskim filterom: `Raspored` već postoji.



### S08 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `AgreementCollectionPresentation.tsx` `8739b315`; `src/ui/agreements/agreementListModel.ts` (raniji provereni model); `dizajn-dogovori.tsx` `0c3c7bb0`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Header/root controls → **`Aktivni | Istorija`** segmented → `AgreementRoleRail` → attention/status → grupisana `FlatList`; već postoje role filter, history outcome, Raspored; search još nije potvrđen.

**KEEP:** Role rail `Sve uloge/Tražim pomoć/Uskačem`, grupe po vremenu, attention, Raspored, outcome filtri i partial refresh.

**DELTA:** P1 izbaciti root `Aktivni | Istorija`; jedna Search po naslovu, saradniku i već dozvoljenom mestu; nema GPS/novog location filter moda; formal copy `Čeka Vas`.

**Finalna kompozicija, vrh → dno:** Dogovori + Search/Raspored → role rail (samo gde smislen) → Čeka Vas → Danas → Sledeće → Bez tačnog termina → `Prethodne saradnje` child.

**Tap / Back / state / recovery:** Ista uloga/search/scroll čuva se posle Dogovora i Rasporeda; history `Sve/Završeni/Otkazani` samo u history; incomplete search ≠ nema rezultata. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp rail horizontalno skroluje, 1.3× naslovi i sat u više redova; Raspored ime i ikonica 48dp; root 4-tab, no second persistent bottom bar. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-dogovori`: `list`, `grouped-list`, `history`, `long`, `empty`, `error`.

**Prioritet:** P1 root grouping/search/copy; P0 accuracy/authoritative action. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S09 — TASK-GROUP / više saradnji na istom zadatku

**Zašto:** osoba koja je objavila zadatak sa više uskočera vidi **jedan zajednički kontekst**, bez gubljenja odvojenih bilateralnih Dogovora. **Nije novi project manager.**

**Redosled:** (1) Back + naslov **Selidba stana** / overflow samo za parent-task akcije; (2) state surface **3/3 dogovoreno** i kratko „2 saradnje pokrivaju 3 osobe“; (3) **Saradnje** — svaki row druga osoba/portret, broj ljudi, human status i strelica ka svom Dogovoru; (4) **Zajednički razgovor** ako postoji pravi grupni thread, sa jednim poslednjim sažetkom i ulazom; (5) **Lokacija** — shared task context, ali privatni exact access se i dalje rešava po dozvolama za konkretan odnos/grupu; (6) **Raspored** kao quiet link/section sa provereno dogovorenim terminima; (7) **Prethodne saradnje na ovom zadatku** samo ako postoje, bez mešanja sa aktivnim; (8) sekundarno otvaranje Owner Task-a/remaining-search akcija samo kada dozvoljeno.

**Normalno:** „Selidba stana · 3/3 dogovoreno“, rows Marko (2 osobe) i Nikola (1 osoba), zatim grupni thread i mesto. **Attention:** samo konkretna osoba/saradnja dobija „Čeka Vas“ cue; grupa ne generiše izmišljeni zajednički completion ili zbir privatnih iznosa. **Prazno:** ne otvarati lažni empty task-group ako samo jedan Dogovor postoji — ide se direktno na bilateralni ekran; ako se broj smanji, prethodni kontekst ostaje dostupan ako autoritativno postoji. **Dugačko:** lista saradnji skroluje, po potrebi group rows bez mini-widgeta za svaku osobu; naslov parent taska može preći u header pri skrolu. **360dp / 1,3×:** avatar stack ne gura naziv, svaki relationship row 2–3 teksta po hijerarhiji. **Nedostupno:** jedan nedostupan bilateralni odnos ne kompromituje ostale; svi proveravaju access grant na otvaranju. **Tap/Back:** osoba→S10, grupna poruka→S11 group thread, mesto→samo dozvoljena mapa, raspored→S12 u task kontekstu, Back→Dogovori/Owner Task prema stvarnom izvoru. **Privacy:** worker ne vidi cene ni privatne poruke drugih worker-a; jedina zajednička komunikacija je eksplicitni group thread sa potvrđenim članstvom.

### S09 — kompozicija owner task-group bez mešanja privatnih odnosa

**Task-group je jedna puna stranica, ne chat sa ugrađenom administracijom.** Na 360dp: header `Selidba stana` + diskretni link `Zadatak →` → **jedna** coverage oznaka `3 od 3 ljudi dogovoreno` → naslov `Saradnje` → svaki worker kao **jedan tappable row** sa realnim portretom, imenom, dogovorenim brojem ljudi, jednim ljudskim statusom i chevron-om. Tek posle stvarnih saradnji dolaze mirni redovi `Zajednički razgovor`, `Lokacija`, `Raspored`, a zatim po potrebi `Prethodne saradnje`. Uobičajeni group screen **nema** listu privatnih cena, broj prijava na mestu broja Dogovora ili četiri razdvojene coverage kartice.

**Čeka Vas** staviti na konkretan worker red, ne kao zajednički „Svi čekaju potvrdu“ CTA bez istog server događaja. Ukoliko je worker otkazao, prikazati stvarni terminalni odnos u prethodnim saradnjama, uz odgovarajući status coverage; aktivni odnos ne sme magično nestati samo zato što je grupa promenila broj članova. Owner ima granice pristupa do svojih pojedinačnih Dogovora; worker ne dobija tuđi iznos ili privatni thread. Grupa nije autoritet za izmene bilateralnih uslova.

**Zatečeni code proof:** `GroupConversationScreen.tsx` blob `635c7a62` već ima članove, grupni unread, grupni tekst i requester-only podlistu za otvaranje pojedinačnih Dogovora *unutar grupnog razgovora*. To je korisno kao bezbedan ulaz, ali nije dokaz da postoji **zaseban owner task-group workspace** po ovom kanonu. **Delta:** requester pregled saradnji treba da živi u S09 **pre chata**, a grupni thread treba da ostane komunikacija (bez privatnog administrativnog panela kao glavnog sadržaja). Ne premeštati podatke između bilateralnih i grupnih server ovlašćenja samo zbog rasporeda UI-a.


### S09 — grupni zadatak, jedna koordinacija i više privatnih odnosa

**Direktni čitaoci:** `AgreementOverview.tsx` (`7a87b777`) već razlikuje grupni naslov i pojedinačni Dogovor; `GroupConversationEntry.tsx` (`67910c75`) već zna za grupne učesnike, odvojeni privatni prelaz i stanje kada grupa još nema dovoljan broj izabranih. `dizajn-dogovori?scene=grouped-list` i `group` pokrivaju reprezentativne primere, **ne** stvarni full task-group kroz dva naloga.

**Finalna kompozicija:** parent task hero (jednom), `Izabrano N od M` samo iz autoritativnog seat count-a, redovi svake izabrane prijave/pojedinačne saradnje (status, odgovorni ljudi, kratak sledeći korak), grupne Poruke samo ako stvarno postoji pravo pristupa, a pojedinačna cena/uslovi i tačna lokacija isključivo kroz bilateralni Dogovor. Ne praviti mešavinu grupnog razgovora i privatne izmene. Brojač `N` nije broj tapova ili broj prijava — koristi server covered slots/kapacitet. Scene su dokaz pokrivenosti fixture-a, ne pravo server priznanje.



### S09 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `AgreementPresentation.tsx` `13879ed3`; `src/ui/groups/GroupConversationPresentation.tsx` `3c623216`; `src/ui/agreements/GroupHeader.tsx` `d92e036c`; `dizajn-dogovori.tsx` `0c3c7bb0`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Task-group pregled/`GroupHeader` → zajednički kontekst/učesnici → zasebni bilateralni redovi → grupni koordinacioni razgovor (kada autorizovan). Postoje različiti route i scope, ali isti realni native stack nije renderovan.

**KEEP:** Postojeća parent/child veza, group thread, privatni zasebni Dogovori; group bez sabiranja privatnih iznosa.

**DELTA:** P1 jedna smirena task-group kompozicija, nijedan privatni uslov/cena u zajedničkom kanalu; group media **samo** uz stvaran server contract.

**Finalna kompozicija, vrh → dno:** Back + task identity/termin → zajednički status → saradnici pojedinačno → `Grupni razgovor` → relevantne shared informacije → tihi safe actions.

**Tap / Back / state / recovery:** Tap osobe→njen bilateralni S10 samo ako requester/autorizovan; Back vraća grupu; closed group read-only, incomplete membership = guarded state. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp tri+ saradnika kao rows, ne avatar-gomila; 1.3× prelom; chat composer keyboard-safe i bez root bottom nav; TalkBack privacy announcement. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-dogovori`: `group`, `grouped-list`, `shared`, `long-detail`.

**Prioritet:** P0 privacy/authorization; P1 group density. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S10 — BILATERALNI DOGOVOR / full detail jedne saradnje

**Zašto:** jedna osoba, jedan posao, jedni dogovoreni uslovi. **Nije ogromna kartica** niti četiri-tab workspace.

**Redosled:** (1) Back, avatar + ime druge osobe / korisnički odnos („Uskače · 2 osobe“ ili „Traži pomoć“), `⋯` sa sekundarnim kontekstnim akcijama; (2) **samo dva taba `Pregled | Poruke`**; (3) u Pregledu **current state** („Dogovoreno“, „Predlog izmene čeka odgovor“, „Završetak čeka potvrdu“, „Saradnja je otkazana“); (4) compact **Zadatak →** link ka parent detail-u; (5) **Dogovoreni uslovi** — prihvaćena cena, ljudi, termin/rok, mesto/obim, u jednoj grupisanoj sekciji; (6) **Mesto i dolazak** — približno pre private grant-a, mini mapa + tačna adresa *samo nakon odgovarajućeg ovlašćenja*; (7) **Zajednički kontekst** samo ako postoji task-group i relevantan access; (8) **Aktivnost**: poslednja 2–3 događaja i „Prikažite sve“, ne trajni Tok tab; (9) secondary rows: **Izmenite uslove**, **Prijavite problem**, **Otkažite saradnju** ako status dozvoljava; (10) state-dependent sticky: **Predložite termin**, **Zadatak je gotov**, **Potvrdite završetak** ili **Ocenite saradnju** kada je radnja dopuštena. U neutralnom „Dogovoreno“ **nema** podrazumevanog zelenog CTA-a.

**Poruke tab:** isti avatar/header; mali strip „Selidba stana · Danas 17–20 · Liman“ i chat, uz *dozvoljeni* prelaz `Svi učesnici | Privatno` samo kada parent zaista ima group i membership. **Ne** ponavljati ogromnu task karticu. Cena i dogovoreni uslovi ostaju u Pregledu; poruke nisu izvor promene cene ili termina.

**Normalno:** state „Dogovoreno“, 1 fact section, mjesto, aktivnost, mirne akcije, bez sticky. **Attention:** inkoming predlog otvara predlog sa „Trenutno / Predlog“ i **Prihvatite/Odbijte**, bez automatske promene; completion/ratings imaju svoj precizan CTA. **Prazno:** nema istorije događaja → izostaviti praznu aktivnost, ne lažni „Nema podataka“ panel. **Dugačko:** opis uslova i tok skroluju; sticky CTA ne preklapa read-only facts. **360dp / 1,3×:** 2×2 facts postaju stacked, dugi naziv osobe i termin ne klipuju. **Nedostupno:** nepoznat ishod prihvatanja/otkazivanja → „Proveravamo stanje“ i **Proverite stanje**; ne omogućavati drugi konfliktni write. **Tap/Back:** avatar→public profil prave uloge; task link→owner ili public Task; izmene→Agreement change flow; problem→support; otkazivanje→konkretan confirm „Otkažite saradnju“; Back→task-group/Dogovori/Poruke kao stvarni entry source.

### S10 — jedna osoba i jedan prihvaćen Dogovor, bez lažnog glavnog koraka

**Finаlni primer normalne kompozicije:** top header portret + `Marko P.` i `Uskače · 2 osobe` → uski segment `Pregled | Poruke` → **mirni status** `Dogovoreno` (običan tekst sa diskretnim indikatorom, nije velika zelena kartica koja zahteva odgovor) → `Selidba stana →` → jedna sekcija `Dogovoreni uslovi` (vreme, cena, broj ljudi i dogovoreni scope) → `Mesto i dolazak` (tačni podaci samo uz grant) → `Zajednički razgovor →` **samo ako zaista postoji relevantna grupa** → `Aktivnost` sa poslednja 2–3 događaja → mirne sekundarne akcije (`Predložite izmenu`, `Prijavite problem`, `Otkažite saradnju`), samo koje server dopušta. **Nema stalnog sticky dugmeta u običnom CONFIRMED stanju.**

**Dve bitne scenе:** kada druga strana predloži promenu, *trenutno važeći uslovi ostaju na ekranu*, a posebno se otvara `Predlog izmene` sa vidljivom razlikom i eksplicitnim prihvatanjem/odbijanjem; sticky CTA može biti „Pogledajte predlog“. Nakon završetka sticky `Potvrdite završetak` ili `Ocenite saradnju` samo za dokazivo dozvoljen životni ciklus. Dugi private chat nema velike duplicirane uslovne kartice; iznad poruka stoji jedan compact task context sa linkom ka `Pregled`. Back iz privatnog chata vraća izvor (root Poruke ili Dogovori/task-group) i ne briše draft ako je legalno sačuvati ga.

**Read-only source evidence:** `AgreementPresentation.tsx` blob `a9549bd5` već ima dobra dva taba `Pregled/Poruke` — **KEEP**; `dogovor/[id].tsx` blob `b67040b7` gradi `AgreementHero` u `WorkspaceCard`, `NextStepCard` i `AgreementPeople`, sekcije `Kontakt`, `Lokacija`, `Tok Dogovora` i u normalnom `CONFIRMED` stanju bira **permanentni footer `Otvori poruke`**. Ovo je konkretan LEGACY CONFLICT s finalnim tiho-confirmed prikazom. **Delta:** poruke ostaju **tab**, ne trajno osnovno dugme; skupljaju se kartice u sekcije/redove; `Izmene i otkazivanje Dogovora` razdvojiti u ljudske, zaista dostupne stavke. Zadržati readback i privatni access, ne dirati pravila servera.


### S10 — bilateralni Dogovor: šta galerija dokazuje, a šta je stari vizuelni ostatak

**KEEP:** `AgreementTabs` (`AgreementPresentation.tsx`, `13879ed3`) zaista ima samo `Pregled | Poruke`. `AgreementWorkspace` (`e0d9ded0`) kroz `WorkspaceFooter` prikazuje **jednu** stvarno dopuštenu glavnu akciju ili običnu quiet statusnu rečenicu; nema potrebe za univerzalnim footer dugmetom. `AgreementOverviewParts` (`c1f2965a`) već ima `Izmeni uslove`, `Prijavi problem`, `Tok Dogovora`, private contact/location granicu i obaveštenje za nedogovoren termin.

**Vizuelno čist redosled:** identitet druge osobe i `Dogovor` → `Pregled | Poruke` → jedna jasno imenovana sledeća radnja ili miran status → prihvaćeni uslovi (jedinica novca, datum i zona, mesto, broj ljudi, obim) → povezana lokacija/poruke/tok → ređe izmene/problem/otkazivanje. `Otkaži Dogovor` iz postojećeg `AgreementDangerActions` treba formalizovati u korisničko `Otkažite Dogovor` i držati u zasebnom danger-delu, ne izjednačiti sa primarnom akcijom.

**Design Lab scenariji:** `dizajn-dogovori?scene=one`, `worker`, `worker-done`, `worker-term`, `waiting`, `recovery`, `no-term`, `problem`, `form`, `done`, `cancelled`, `long-detail`, `chat`, `chat-empty`, `chat-loading`, `chat-unknown`. U galeriji `chat` fixture ponekad dodatno postavlja `brand="Otvori poruke"` iako je već izabran tab `poruke`; **to je stale fixture/scenska kontradikcija, ne dokaz da je aktivni route zadržao dupli CTA**. Final QA traži da chat tab ne nudi `Otvori poruke` kao primarno kada je već otvoren. Group-contact `shared` fixture je istorijski oblik — ne vraćati PHONE grant u korisnički UI; „samo Poruke“ ostaje važeće pravilo.



### S10 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `AgreementPresentation.tsx` `13879ed3`; `src/ui/media/AgreementVoiceControls.tsx` **`43b61012`**; `useAgreementVoice.ts` `1e57dc0e`; `dizajn-dogovori.tsx` `0c3c7bb0`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Header/task context → Pregled sa frozen facts, status i akcijama; Poruke child je druga površina. Novi voice composer dodao sistem haptike na stvarno snimanje/otkaz i aksesibilne mikrofon/preview kontrole; **nije native proof**.

**KEEP:** Frozen accepted price/units, bilateral amendment/complete/cancel, readback/unknown, zaseban private thread, voice recording state.

**DELTA:** P0 nema lažnih action/price/success; P1 ukloniti višak stalnih CTA i neformalan tekst `Snimaš / Pusti`; potvrditi voice cancellation vs release, Voice review-first preference i TalkBack; nema spajanja group/private.

**Finalna kompozicija, vrh → dno:** Back + task/title/status → tab `Pregled | Poruke` → status/frozen facts → konkretna sledeća akcija i activity; Poruke imaju stvarni composer samo kad je thread writable.

**Tap / Back / state / recovery:** Back iz private chata vraća task ili Poruke entry; unknown send/upload/change ostaje Pending+Proverite; zaključan terminal thread bez composer-a. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp/1.3× audio controls i recorder state staju iznad keyboard/footer, mikrofonski 48dp, screen-reader tap vs press/hold, Reduced Motion bez nevoljnog gesture-a. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-dogovori`: `one`, `worker`, `waiting`, `chat-unknown`, `no-term`, `problem`.

**Prioritet:** P0 voice/price/privacy/unknown; P1 copy/visual. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S11 — PORUKE / task-first inbox + privatni i grupni razgovor

**VISUAL SIGNATURE (B0):** miran task-first inbox koji razaznaje osobu, zadatak, poslednju dozvoljenu poruku i stvarni unread; bez slaganja zasebnih 3D kartica. U razgovoru postoji jedan identitet posla i jedan composer; medija/voice modal i unknown-status nikad ne smeju glumiti isporučenu poruku. Tek nakon nove potvrđene poruke može jednokratni 240ms/8dp ulaz; stari thread je statičan. Po uzoru na prostranost Airbnb poruka, **bez kopiranja njegovog chata** ili mešanja privatnog i grupnog razgovora.

**Zašto:** razgovarati o konkretnom poslu. **Nema stalnog `Aktivni | Istorija`** i nema izmišljanja slobodnog DM-a sa bilo kim.

**Root redosled:** (1) **Poruke** header, pretraga tek ako volumen opravda; (2) ravna skrol lista row-ova po potvrđenoj recency; (3) svaki row: avatar osobe ili group icon, **bold task title**, desno relevantno vreme, drugi red last-message preview, treći tihi qualifier **Privatno · Marko P.** ili **Grupa · 3 učesnika**; (4) potvrđeni terminalni razgovori ostaju u istoj listi po vremenu, sa oznakom **„Završeno · samo za čitanje“**; (5) root nav. Nema velikog contact-centric konverzacionog feeda, nema novog compose `+`.

**Privatni row** otvara S10 sa aktivnim Poruke tabom, ne nezavisan kontakt chat. **Grupni row** otvara group chat tačnog taska, sa članovima i granicom vidljivosti. Grupa je po zatečenom code audit-u **text-only**; ne crtati attachment dugme za group photos dok server nema dovršenu autorizovanu podršku. Private unread broj ne izmišljati; group unread samo kada je potvrđen authority.

**Normalno:** dva row-a istog taska mogu stajati jedan do drugog — Privatno i Grupa — jer su dva različita thread-a. **Attention:** unread dot/broj samo po stvarnom signalu; poslednja poruka je sažetak, nije zahtev za akciju ako nema takav status. **Prazno:** mali chat empty art, „Još nema razgovora“, „Razgovor započinjete iz Dogovora“ i **Otvorite Dogovore**. **Dugačko:** skrol + paginacija, preview 1–2 reda, full text tek unutra; terminalni razgovori ne otvaraju compose. **360dp / 1,3×:** title dobija prostor, vreme se kratko formatira (`Juče`, `26. okt`), qualifier sme u novi red. **Nedostupno:** bez loaded conversations ne tvrditi da nema razgovora; zadržati prethodni read i retry. **Tap/Back:** private→S10 Poruke; group→group thread; chat→nazad na Poruke ili task-group, uz zadržan scroll; svaka nova poruka pre prikaza uspeha zahteva potvrđen outcome ili recovery.

### S11 — konkretna kompozicija inbox-a, a ne sporednog dugmeta u Dogovoru

**Za početni ekran sa razgovorima:** `Poruke` → jednostavna lista do dna, bez uvodnog hero-a; jedan row je `Selidba stana` **podebljano**, `Marko: Stižemo oko 16:55.` i tiho `Privatno · Marko P.`; drugi row istog zadatka može biti `Gde se parkiramo?` / `Grupa · 3 učesnika`. Vreme, ako je potvrđeno, stoji desno ali nikad ne gura duži task title u odsečenu širinu. Avatar je vizuelni orijentir, ne glavni naslov. Svi redovi su tappable; **nema dugmeta „Nova poruka“** i nema `Aktivni/Istorija` segmenta. Terminalni row je sivlja forma sa `Završeno · samo za čitanje`, bez inputa na cilju.

**Group chat:** gornji red pokazuje task context, grupnu prirodu i **stvarni** broj učesnika; članovi su sekundarni disclosure. Tekst poruka i stvarno potvrđeni unread; cena, privatni uslovi, tabele Dogovora i `Prijavite problem` nisu glavni deo chat canvasa. Problemi ostaju u konkretnom Dogovoru ili Podršci, uz kontekstni ulaz ako je potreban. Kada grupni membership istekne, ne pretpostavljati pravo na nove poruke; zadržati samo istoriju za koju postoji autorizacija.

**Read-only RN dokaz iz prave grane:** `src/app/(app)/poruke.tsx` (`97035a7d`) direktno postoji na `USKOCI-EAN@work/rev14-review-f17` i otvara stvarni inbox privatnih i grupnih razgovora. Stari 404 iz `USKOCI-CLEAN` je povučen, nije CODE gap. Dodatni visual QA treba da proveri dva thread-a istog zadatka, 1,3× font, terminalni read-only, privacy granice i neizmišljene private/group unread signale.


### S11 — Poruke: postojeći task-first prikaz je već dobar, ne dodavati novi tab sistem

**KEEP:** `ConversationInboxPresentation.tsx` (`482f0de8`) ima `conversationTitle` vezan za zadatak, stavke `AGREEMENT`/`GROUP`, avatar osobe, preview, vreme, broj nepročitanih samo ako je poznat, closed/read-only status, `FlatList` i paged/refresh recovery. Root `poruke.tsx` (`97035a7d`) postoji. **Nema stvarne stalne `Aktivni | Istorija` segmentacije na ovom live inbox-u** — to što Design Lab `dizajn-poruke` sadrži `sets`/`owner` nije razlog da je uvedemo.

**Finalna kompozicija:** root chrome → naziv `Poruke` / jedna kratka objašnjavajuća linija samo ako treba → task-first redovi sa parom `zadatak + osoba/grupa` → datum i poslednja dozvoljena poruka, unread broj. Grupni thread označiti kao grupni i ne proslediti njegov preview osobama bez pristupa. Na dugim naslovima 1,3× raspored u dva reda; na praznom prikazu jedna direktna veza ka Dogovorima. Photo/voice preview ima vrstu sadržaja, bez lažnog read/delivery statusa.

**Galerija:** `dizajn-poruke?scene=list`, `long`, `sets`, `owner`, `empty`, `loading`, `error`, `stale`. `sets`/`owner` služe da proverimo različite vrste konverzacija, **nisu naredba za nove root tabove**. Zadržati već postojeći inbox, promeniti samo neformalni tekst `Razgovori o tvojim zadacima` u `Razgovori o Vašim zadacima` i dodatni microcopy prema B3.



### S11 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `ConversationInboxPresentation.tsx` `482f0de8`; `GroupConversationPresentation.tsx` `3c623216`; `AgreementVoiceControls.tsx` `43b61012`; `dizajn-poruke.tsx` `a0838995`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Task-first `FlatList` private/group rows → vreme/unread/status/preview → exact child private/group thread; nema stvarnog root `Aktivni|Istorija` segmenta.

**KEEP:** Task-first records, private/group scope razdvojen, pagination/stale/terminal i server unread, audio preview zasebno od teksta.

**DELTA:** P1 jedna formalna terminologija, vidljiva oznaka Privatno/Grupa, ne udvajati messages sa Dogovori; P0 audio attach ne sme zameniti nenapisan tekst/foto draft; ni grupa ne deli private poruke.

**Finalna kompozicija, vrh → dno:** Poruke → vremenski sortirani task-first rows → exact private Dogovor Poruke ili autorizovani group thread; nema new chat CTA ili drugog history root-a.

**Tap / Back / state / recovery:** Back vraća originalni inbox scroll, cold link authz, failed message read ≠ empty; unknown send ne nuditi duplikat. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp 2-line title i recency, 1.3× unread i statuses nisu color only; voice play/pause i review preko TalkBack; keyboard-safe composer + safe bottom. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-poruke`: `list`, `long`, `sets`, `owner`, `stale`, `empty`; `dizajn-dogovori`: `chat-unknown`.

**Prioritet:** P0 privacy/voice/outcome; P1 copy/rows. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S12 — RASPORED / Mesec · Nedelja · Dan

**Zašto:** vremenski pregled stvarnih Dogovora i meke dostupnosti, **ne** druga Dogovori lista i **ne** Arhiva.

**Redosled:** (1) Back + **Raspored**, tihi `Danas` control gde staje; (2) `Mesec | Nedelja | Dan` kao tri pogleda istih podataka; default **Mesec** i očuvanje selected datuma pri promeni; (3) kada postoje aktivni flexible Dogovori, kompaktan row **N Dogovora bez tačnog termina →**; (4) sam kalendar — potvrđene obaveze vizuelno dominantne, worker availability svetli pozadinski pojas; (5) za odabrani datum sažetak stvarnih Dogovora; (6) remote deadlines odvojena, jasno nazvana deadline sekcija, **nikad busy interval**; (7) quiet **Moja dostupnost →** samo ako relevantan worker profil postoji.

**Model:** više saradnji za isti requester task i isti tačni interval predstavljati kao **jedan** calendar event „Selidba stana · 2 saradnje“; različite intervale ne preklapati niti lažno objediniti. Worker hard overlap sprečava server; requester paralelne saradnje nisu automatski greška. „Mogu odmah“ signal nije dogovor i ne sme delovati kao busy event.

**Normalno:** month dots/agenda, week/day kratki blokovi i kompaktnost. **Attention:** konflikt „Termin se preklapa sa drugim Dogovorom“ samo kad ga server potvrdi, sa **Otvorite Raspored**; flexible no-term row pruža pravi ulaz u predlaganje termina. **Prazno:** prazan kalendarski period sa tekstom „U ovom periodu nemate dogovorene termine“; nije isto kao „Nemate Dogovora“. **Dugačko:** više događaja u istom satu prikazati side-by-side ili „Još termina“. **360dp / 1,3×:** jedna kolona agenda/day i povećana visina blokova; views ostaju čitljivi bez sitnih slotova. **Nedostupno:** kalendar ostaje na poslednjem pouzdanom snapshot-u, availability failure se ne skriva kao nula; partial read informacija razdvaja slojeve. **Tap/Back:** kalendar event→S10/S09; no-term→konkretni Dogovor/predlog; dostupnost→S14; Back→Dogovori ili source.

### S12 — mesečni izbor datuma i razlikovanje rada od dostupnosti

**Vizuelna kompozicija bez admin kalendara:** header `Raspored` + tihi `Danas` → segment `Mesec | Nedelja | Dan` → izabrani period/datum → sam kalendar sa **potvrđenim terminima kao jasno vidljivim događajima** i **raspoloživošću kao svetlim slojem** koji ne glumi rezervaciju → listа stvarnih događaja izabranog dana. `Bez tačnog termina · 2 Dogovora →` je mali zaseban ulaz. Rok za remote rad, ako postoji, ide kao jedna jasna `Rokovi` stavka, ne kao zauzeto vreme na satnici. Owner za isti task i isti interval vidi **jedan calendar event sa N saradnji** i može iz njega na task-group; worker vidi svoju konkretnu saradnju.

**Prikaz 360dp:** mesec nije 42 sićušne kartice nego mirna kalendarska mreža sa tačkama; detalji stoje ispod za izabrani dan. Nedelja na 1.3× može preći u kompaktne kolone, dan prikazuje punu listu vremena; uski device ne sme skratiti `Mesec/Nedelja/Dan` do nečitljivosti. Kada `calendar` read padne, ne prikazivati čist prazan mesec sa `0 Dogovora`, već stari pouzdan prikaz uz jasnu oznaku stale i retry.

**Read-only source — prava radna grana:** `src/app/(app)/raspored.tsx` (`33f96c58`) na `USKOCI-EAN@work/rev14-review-f17` već ima **tri pogleda Mesec/Nedelja/Dan**, kao i kontekst obe strane Dogovora. Prethodna tvrdnja „samo sedmodnevni worker kalendar“ dolazila je iz **drugog repozitorijuma** i ne sme stajati kao aktuelni gap. **KEEP** tri pogleda; **PROVERITI** korisnički vizuelni rezultat, owner same-task grouping, soft availability i remote deadline. Ovo i dalje nije dokaz da instalirani APK koristi taj tačan commit.


### S12 — proverene TRI stvarne kalendarske kompozicije i testne scene

**KEEP:** `AgendaScreen.tsx` (`adaff1c7`) stvarno koristi `MonthView`, `WeekStrip + WeekDays`, `DayView` i segment `Mesec | Nedelja | Dan`. `raspored.tsx` (`33f96c58`) čita raspored za širok period, a calendar status i Dogovori lista imaju zasebno stanje; čak i delimičan read ne sme reći da nema termina. Worker availability je **meko obojena pozadina**, ne potvrđen Dogovor. Lista bez tačnog termina ima svoju traku/ulaz, ne lažni dan.

**Visual QA iz postojećih scena:** `dizajn-kalendar?scene=dan` (mesečni default), `nedeljaDogovori`, `danDogovori`, `bezTermina`, `danPreklapanje`, `danNoc`, `zona`, `delimicno`, `prazno`, `greska`, `mesecBezProfila`, `bezVremena`, `dugi`, `nedeljaPrazna`, `nepoznato`. Na 360dp sa 1,3× kontrola Mesec/Nedelja/Dan ostaje čitljiva; 23/25h datum i preklapanje blokova ne smeju dobiti lažnu lokalnu satnicu. `Raspored` nije četvrti tab. Nema razloga za novo pravljenje kalendara od nule.



### S12 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `src/ui/calendar/AgendaScreen.tsx` `adaff1c7`; `dizajn-kalendar.tsx` `7e35cdd4`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Header Raspored → `Mesec|Nedelja|Dan` → MonthView ili WeekStrip/WeekDays ili DayView → datum i Dogovori → bez-term i availability se prikazuju zavisno od stanja.

**KEEP:** Tri već implementirana pogleda, no-term i availability kao odvojeni slojevi, partial calendar data.

**DELTA:** P1 razlikovati busy confirmed, soft availability i remote rok vizuelno; ne mešati requester paralelne saradnje sa worker konfliktom.

**Finalna kompozicija, vrh → dno:** Raspored → Today/tri pogleda → bez termina link → kalendar → događaji odabranog dana → rokovi/dostupnost po kontekstu.

**Tap / Back / state / recovery:** Back→Dogovori sa kontekstom; day/week/month čuvaju datum; unknown calendar = last good + retry, a ne prazan mesec. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp month dots i agenda, week može kompaktnije; 1.3× events u više redova; 23h/25h timezone i velike mete/announcements. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-kalendar`: `dan`, `nedeljaDogovori`, `danDogovori`, `bezTermina`, `zona`, `delimicno`.

**Prioritet:** P0 correct conflict/time; P1 visual slots. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S13 — MOJ PROFIL / jedan identitet i JEDNA zajednička reputacija

**Zašto:** profil je identitet jednog naloga; osoba može i da objavi zadatak i da uskoči. Profil nije peti bottom tab niti zamena za Podešavanja.

**Kompozicija, vrh → dno:** Back → Moj profil → jedna fotografija i ime → **Reputacija naloga: jedan potvrđen prosek + ukupan broj ocena** → jedan ulaz u **Ocene** → opcioni „Pogledajte kako Vas drugi vide” (javni pregled u kontekstu naručioca ili uskočera, ali u oba **isti skor**) → Radni profil → Moji zadaci / Moje prijave / Raspored → Podešavanja / Pomoć i podrška. Ne praviti zasebne role-ocenske blokove niti šest velikih izdignutih kartica.

**Poslovna istina:** svaka pravilno završena saradnja može proizvesti ocenu po važećem bilateralnom pravilu. Sve dopuštene objavljene ocene iz obe uloge hrane **jednu reputaciju naloga**. Vrsta saradnje može biti obeležena na pojedinačnoj recenziji; nije drugi aggregate. Blind publication, rok objave, authorize/revoke i privacy ostaju. Nema prikazivanja neobjavljenih ocena na javnoj kartici.

**Stanja i oporavak:** normalno = identitet + jedna stvarno potvrđena reputacija + grupisane aktivnosti; empty = „Još nema ocena”, ne lažno 0,0; loading/partial/error/stale/unknown = odvojene poruke i bezbedan retry. Kada javni skor nije potvrđen, prikazati „Ocene trenutno nisu dostupne”; ne izmišljati rezultat. DRAFT/SUSPENDED radni profil daje svoje objašnjenje samo u svom redu. Logout ili promena naloga nikada ne prikazuje tuđi prethodni state.

**Tap / Back:** avatar→fotografija; ime→Lični podaci; ocena→jedne Ocene; public preview bira samo kontekst uloge, ne menja reputacioni broj; radni profil→S14, ostale aktivnosti→svoje domene. Back čuva izvorni ekran/scroll; cold link ima bezbedan povratak na Početnu.

**Tačan istorijski source pin 29.10:** ProfileHubPresentation.tsx (173fcf2b), profil.tsx (3fe1c96a), AccountReputation.tsx (68d4319f), profil/ocene.tsx (25722a86), ProfileWorkSummary.tsx (ca5b00dd). **Postojeći account aggregate je KEEP, ne code conflict.** Role-specific completed counts nisu dve različite ocene. Otvoreno: realan public-read/visibility i blind rating, invalidacija po novoj oceni, javni preview i native vizuelni QA. Nije live DEV/backend dokaz.

**Design Lab:** dizajn-profil hub-active, hub-new, hub-long, hub-stats-error, hub-requester, hub-loading, hub-error, hub-large; ratings-comments, ratings-none, ratings-stars-only, ratings-given, ratings-loading, ratings-error. Fixture nije fizički Android screenshot. Na 360dp/1,3× proveriti jedan ocenski blok, puno ime, velike touch mete, TalkBack prosek/broj i fokuse. Vizuelni P1/P2 mogu se polirati ekran po ekran posle funkcionalnih gate-ova.

**Prioritet:** P0 sigurnost i vernost zajedničkog javnog rejtinga; P1 pregledna hijerarhija i kontekst profila; P2 ikonice, razmaci, pokret i copy Vi. **PIXEL FINAL = NOT YET.**

## S14 — RADNI PROFIL / AI-first, lagan i praktičan

**Zašto:** reći šta mogu da uradim, gde i kada. Nije HR profil, inventory alata ni deklaracija stalne ekipe.

**Prvi ulazak:** malo razgovorno/education art, **Ispričajte čime se bavite**, tekst „Koje zadatke želite da preuzimate, gde i kada Vam odgovara“, CTA **Započnite razgovor**. Samo otvaranje ne aktivira profil. AI pita i predlaže strukturu; korisnik vrši review i potvrđuje.

**Saved redosled:** (1) Back + **Radni profil**; (2) state „Nacrt“, „Profil je aktivan“ ili „Profil je trenutno suspendovan“ uz realni razlog/akciju ako postoji; (3) **Pogledajte javni prikaz** sa oznakom ako profil nije aktivan; (4) **Usluge koje nudite** kao kratki chips + Još N; (5) **Način rada** (na lokaciji / na daljinu / oba); (6) **Područje rada** samo za on-site (city/radius, coarse center, **ne kućna adresa**); (7) **Dostupnost** kao meka preference i **nedeljni raspored**, bez kontrole „Mogu odmah“ na običnom sačuvanom profilu (nasleđeni podatak i kompatibilni ugovori ostaju dok se njihova upotreba zasebno ne proveri); (8) **O Vama** i relevantne potvrđene licence/faktovi ako postoje; (9) CTA **Nastavite razgovor / Izmenite profil / Aktivirajte** samo ako realni state dozvoljava. Alati/vozila samo legacy dodatne informacije bez hard matching authority-ja.

**Normalno:** nekoliko sekcija, ne 20 polja. **Attention:** draft navodi tačno šta nedostaje, bez traženja remote-only lokalnog grada; suspended otvara Podršku; „Mogu odmah“ ne prikazivati u običnom sačuvanom radnom profilu, bez obzira na postojeći serverski TTL podatak. **Prazno:** first setup, jedan jasan CTA. **Dugačko:** usluge collapse, opis može u svoj pregled; radno područje jedna kompaktna stavka. **360dp / 1,3×:** chips se prelamaju i tekst se širi, bez beskonačnog horizontalnog reda. **Nedostupno:** AI down → dati „Sačuvano je ono što ste potvrdili“, retry i pristup sačuvanom profilu; nikad lažni ACTIVE. **Tap/Back:** edit sekcije→odgovarajući AI correction topic / kontrolisan place/availability editor; javni prikaz→role-specific safe preview; aktivirajte→human confirm, server readback; Back→Profil/source.

**Activation minimum:** jedno shared account ime, jedna stvarna capability/usluga, on-site područje samo kada je potrebno, eksplicitan pregled/potvrda. Nema trajnog `team_capacity`, obaveznog vozila/alata ni weekly availability uslova; remote-only aktivacija ne sme tražiti lažni grad.

### S14 — finalna saved/empty scena + razlika iz stvarnog RN-a (29.10.2026.)

**Saved vizuelna scena (vrh → dno):** header `Radni profil` sa tihim informacijama o privatnosti; jedna realna state rečenica `Profil je aktivan / Profil je još nacrt / Profil je suspendovan`; **jedan** account identitet/fotografija bez drugog javnog imena; kratka grupa `Šta radite` (najvažnije veštine i `Prikažite sve` za dug spisak), `Način rada` (na lokaciji/na daljinu/oba), `Područje dolaska` **samo za on-site**, `Kada možete` (nedeljna dostupnost i `Mogu odmah` isključivo uz potvrđen server expiry), `O Vama` skraćeno sa otkrivanjem; tihi `Pogledajte javni prikaz` (role-specific), aktivni CTA samo ako postoji sledeći stvarni korak. Ime i fotografiju ne prikazivati kao drugu stalnu ocenu naloga. Alati/vozila nisu glavni inventar i `N osoba` se ne prenosi kao trajni profile capacity.

**First-run:** mali razgovorni art, naslov `Ispričajte čime se bavite`, tekst `Koje zadatke želite da preuzimate, gde i kada Vam odgovara.`, jedan `Započnite razgovor`. **Draft:** vidljivo tačno šta nedostaje, jedno `Nastavite razgovor`/`Pregledajte profil`, bez lažnog aktivnog zelenog statusa. **Suspended:** red stanja + `Obratite se podršci`; postojeće potvrđene činjenice mogu se čitati bez mogućnosti zabranjenog edit-a. **AI unavailable:** sadržaj koji je zaista sačuvan ostaje čitljiv uz retry, bez aktivacije preko lokalnog optimizma. **360dp i 1,3×:** usluge idu u više redova, status i podaci ne izlaze preko ekrana, footer povučen dok je otvorena tastatura (sačuvati postojeću keyboard zaštitu).

**DIREKTNO PROČITANO:** `src/ui/workerProfile/WorkerProfileSaved.tsx` blob `ed1c92d4` već prikazuje saved identity, **Kako radiš** (skills/mode/area), **Kada** (Mogu odmah/nedeljni raspored) i AI editing, bez nove potrebe za velikim manual formularom. `src/ui/workerProfile/WorkerProfilePresentation.tsx` blob `6f38a575` već ima first-run art, keyboard-safe footer i stanje ACTIVE/DRAFT/SUSPENDED, ali više copy-ja koristi `ti/tvoj/Ispričaj`. `src/app/(app)/profil/radnik.tsx` blob `b79b6bc3` u jednom direktnom activation pathway-u izračunava `locationReady` iz **obaveznog grada i radijusa 1–200 km** čak pre prikaza CTA-a; to je **realan client conflict** sa finalnim pravom remote-only korisnika da ne navede grad. Ne zaključivati da isti uslov postoji u svakom AI/backend putu bez posebnog dokaza. `src/ui/profile/RatingLine.tsx` blob `6f4863f5` dodatno koristi account agregat kao rating line na radnom profilu, pa se **ne sme predstavljati kao uloga-uskočer ocena**. `Mogu odmah` je u saved UI-u prikazan, ali TTL istinitost još nije potvrđena ovim čitanjem.

**DELTA:** P0 remote-only admission i za radni profil i AI-activation sve do server readback-a; P0 proverena zajednička account reputacija ili sakriven nepouzdan skor; P1 retention/TTL za `Mogu odmah` ako je server garantuje; P2 formalni copy, ublažavanje identitet-kartica ponavljanja, pregled svih modal edit/unknown/warnings na realnom telefonu. **KEEP** sadašnju strukturu saved facts, ulogu AI-a, recovery journal i keyboard mehaniku. Pixel-final NOT YET.


### S14 — radni profil ima bogatije postojeće scene nego što sugeriše stari status

**KEEP:** `WorkerProfileSaved.tsx` (`ed1c92d4`) već grupiše `Kako radiš` (veštine, način, uslovno područje) i `Kada` (dostupnost, nedeljni raspored), sa jednom AI izmenom. `WorkerProfilePresentation` (`6f38a575`) ima normalan read/first/draft/active/suspended/unknown i keyboard-safe footer. Sačuvati ove komponente, ne vraćati manuelni inventar.

**Galerija:** `dizajn-profil?scene=worker-first`, `worker-missing`, `worker-ready`, `worker-active`, `worker-suspended`, `worker-unknown`, `worker-retry`, `worker-long`, `worker-read-large`, `worker-read-none`, `worker-review`, `worker-name-different`, `worker-read-switch-failed`; `worker-full` je stres scena, ne potreba da se svi alati/vozila stalno prikazuju u hero-u. **P0 attention:** client aktivacija i dalje proverava `grad/radius` kroz jedan branch čak i kada modalitet može biti REMOTE; ne pisati da je bezuslovna remote-only aktivacija rešena. Jedna shared account fotografija/ime ostaje normativni cilj.



### S14 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `WorkerProfilePresentation.tsx` `6f38a575`; `WorkerAiPresentation.tsx` `d3585523`; `dizajn-profil.tsx` `77a5e744`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Prvi AI setup ili sačuvani profil → osnovni identitet → `Kako radiš` (usluge/mode/area) → `Kada` (dostupnost) → Edit AI/activation status. Jedan client route i dalje uslovljava grad/radijus.

**KEEP:** AI-first prikupljanje, human review, save/retry, saved worker facts i keyboard-safe footer.

**DELTA:** P0 remote-only ne sme zahtevati grad ako tržišni model to podržava; status ACTIVE tek stvarno potvrđen; role-only score ne blend; P1 kratki opis radnika može biti **ponuđen iz potvrđenih činjenica**, bez automatskog upisa/duplog AI panela.

**Finalna kompozicija, vrh → dno:** Radni profil → status → usluge → način/područje samo ako local → dostupnost → alati/vozila po potrebi → jedna AI Izmeni/Pregled/Potvrdite.

**Tap / Back / state / recovery:** Back čuva razgovor i nepotvrđeni unos; unknown activation/readback bez fake uspeha; public worker preview samo autorizovani podaci. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp multi-line usluge; 1.3× availability bez preklapanja, sticky save keyboard-safe, TalkBack state i 48dp. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-profil`: `worker-first`, `worker-ready`, `worker-active`, `worker-review`, `worker-unknown`, `worker-long`.

**Prioritet:** P0 remote-only activation/trust; P1 copy/description. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S15 — PODEŠAVANJA, PRIVATNOST I PODRŠKA / funkcionalni poddomeni

**Podešavanja root — redosled:** Back + **Podešavanja**; sekcija **Nalog** (`Lični podaci`, `Pristup nalogu`); **Obaveštenja** (`Obaveštenja` → stvarne per-channel/per-event preference); **Privatnost i podaci**; **Pomoć i podrška**; **Pravila i saglasnosti**; **O aplikaciji**; na dnu **Odjavite se**; **Zatvorite nalog** pripada bezbednom toku **Privatnost i podaci → Zatvaranje naloga**, ne dva puta na Settings root-u. Sve kao grouped rows, ne dashboard tiles. Provider-aware access: ne nuditi promenu lozinke kao da je dostupna kod naloga bez te metode prijave. Ne prikazivati debug identifikatore u consumer Settings-u.

**Privatnost i podaci:** otvara poseban hub sa **Ko šta vidi**, **Izvoz podataka**, **Blokirane osobe**, pravila o čuvanju/AI razgovorima i **Zatvaranje naloga**. Istinito objasniti: pre izbora osoba vidi samo public projekciju, posle konkretnog Dogovora private podaci se dele po grant-u; telefonski kontakt se **ne** podrazumeva. Izvoz je zahtev sa proverljivim statusom, ne instant izmišljeni download. Zatvaranje naloga: review blokera/aktivnih Dogovora → potvrda posledica i dostupnih izvoznih opcija → final irreversible confirm → server status `processing/terminal` sa recovery-jem za unknown; **nikad univerzalno obećanje da su svi podaci odmah obrisani** mimo objavljene retention politike.

**Podrška:** Back + **Podrška**; kratke korisne FAQ teme samo ako postoje; **Vaši zahtevi** kao rows sa ljudskim statusom `Primljen / U obradi / Čeka Vaš odgovor / Rešeno / Zatvoreno`; CTA **Novi zahtev**. Form: Tema → Naslov → Opis → Pošaljite zahtev, task/Agreement context se dodaje interno kada postoji, bez vidljivog UUID-a. Zahtev otvara thread sa odgovorima i relevantnim dokazima, a ne jednokratni email launcher. Safety/appeal odvojeno kada postoji proces.

**Normalno:** malo redova, čist redosled i bez blanket upozorenja. **Attention:** „Čeka Vaš odgovor“ samo iz pravog support case-a, privacy/closure prepreka sa konkretnim razlogom; notification permissions status ne predstavljati kao uključen ako OS blokira. **Prazno:** bez zahteva → „Još nemate zahteva“ i **Novi zahtev**; bez blokiranih osoba → „Nema blokiranih osoba“ bez izmišljenih primeraka. **Dugačko:** pristup i policy tekstovi su podskrinovi, request conversation skroluje. **360dp / 1,3×:** redovi mogu biti viši, legal tekst pristupačan čitanju i skrolovanju. **Nedostupno / unknown:** sačuvati intent i server-side readback za export/closure/support, ne potvrđivati obrisan/poslat zahtev dok nije dokazano. **Tap/Back:** svaka stavka tačno jednom vodi u svoj subdomain; Back vraća roditelja, zatim Profil/source; closure final ekran ne vraća korisnika u aktivni nalog ako je autoritativno zatvoren.

### S15 — stvarno postojeće rute i konačni hierarchy pass (29.10.2026.)

**Podešavanja, normal:** header `Podešavanja`; bliske grouped rows: `Nalog` → Lični podaci, Pristup nalogu (samo metoda koju identitet pruža); `Iskustvo` → AI razgovori, Obaveštenja; `Privatnost i podaci`; `Pomoć` → Pomoć i podrška, Prijavi grešku, Pravila i saglasnosti, O aplikaciji; na dnu odvojena `Odjavite se`. Ne duplirati `Pomoć i podrška` kao više jakih ulaza na istom ekranu; sekundarne rows su obične površine, ne 12 statusnih kartica. `Zatvaranje naloga` ostaje u Privatnosti, **ne** kao impulsivno istaknuto crveno dugme pored Odjave.

**Privatnost, normal:** `Ko šta vidi` običan red sa čitljivim explanation sheet-om; `Rokovi čuvanja` otvara istinite pravne factove, ne pun policy zid u root-u; `Izvoz podataka` → status zahteva/dostupan download samo kada potvrđeno; `Blokirane osobe` → lista sa odblokiranjem i opreznim copy-jem o dozvolama; `Pravila i saglasnosti`; `Zatvaranje naloga` na dnu sa pravim rizikom/confirm tokovima. Ako policy ili rokovi nisu objavljeni, prikazati baš `Trenutno nije dostupno`, ne računati vreme brisanja ili obećati rezultate.

**Podrška, normal:** header `Podrška`; jedna lista `Vaši zahtevi` (tema + stvarni status + datum poslednje aktivnosti); FAQ ispod samo kada je provereno i korisno; sticky `Novi zahtev` kao jedna stvarna akcija; dodatni `Bezbednost i podaci` rows dostupni, ali ne preuzimaju primarni fokus. `Nema Vaših zahteva` je inline empty, **ista** akcija `Novi zahtev` u footer-u, bez dva primary dugmeta. Kada novi zahtev nije dozvoljen, footer je disabled sa razlogom; pri read failure retry i ne prikazivati potvrđen prazni inbox. Detalj zahteva vodi u thread, ne u anonimni email.

**DIREKTNO PROČITANO na pravoj grani:** `src/ui/settings/AccountSettingsPresentation.tsx` blob `e1d2c065` ima odgovarajuće postojeće grupe i rute, ali stalno crta `Pristup nalogu → /profil/lozinka` kao `Promena lozinke`, bez proverenog provider-aware gating-a, i copy `Tvoje iskustvo`. `src/app/(app)/profil/privatnost.tsx` blob `df67fe7d` i `src/ui/privacy/PrivacyPresentation.tsx` već imaju proveru retention policy/execution i redove Ko šta vidi, Rokovi, Izvoz, Blokirani, Pravila, closure, pa **nema osnova ponovo graditi Privacy hub od nule**. `src/app/(app)/profil/izvoz.tsx` blob `befd626a` već ima request/prepare/download status i provere tačnog receipt-a. `src/ui/support/SupportInboxScreen.tsx` blob `58c3c628` ima funkcionalan case inbox, paginaciju, FAQ, footer Novi zahtev i zasebne sigurnosne ulaze; ne proglašavati Podršku nepostojećom. `src/ui/settings/SettingsPresentation.tsx` blob `02e7bd93` već ima jedinstvenu grouped row/keyboard/footer osnovu.

**DELTA:** KEEP već postojeće rute, retention/status/closure i Support read+recovery; proveriti login-provider capability pre obećanja promene lozinke; formalni copy Vi/Vam/Vaš; preurediti samo dupliranja u grouped-row hijerarhiji bez novih funkcija. Real screenshot/360dp/1,3× nije pregledan. CODE = PARTIAL sa više dobrih podloga; PIXEL FINAL = NOT YET.


### S15 — existing Privacy/Support galerija već pokriva ključna stanja

**KEEP:** `dizajn-privatnost.tsx` (`58158897`) koristi stvarne `PrivacyBody`, export, terms, closure i Support prezentacije u fixture režimu. Scenska lista već sadrži `privatnost-cvoriste`, `privatnost-nije-objavljeno`, `privatnost-objavljeno`, `izvoz-bez-zahteva`, `izvoz-spremno`, `izvoz-isteklo`, `pravila-prihvatanje`, `pravila-ishod`, `zatvaranje-nepotvrdjeno`, `zatvaranje-u-toku`, `podrska-lista`, `podrska-prazno`, `novi-forma`, `novi-nepotvrdjeno`, `zahtev-razgovor`, `podrska-veliki`. To su stvarni reader-independent scenariji, ne dokaz uspešnog live export/closure upisa.

**Finalna redukcija:** grouped rows i statusi imaju jednu kompoziciju, bez ponovljenih velikih hero-a; pravne i destruktivne opcije su niže i imaju zasebnu potvrdu. `Pristup nalogu` mora opisati stvarno podržani način prijave (lozinka ≠ univerzalan nalog). `Podrška` nudi `Novi zahtev` jednom i ne prikazuje internu ID oznaku. Gornji hub ne sme tvrditi da je export READY ako retention/closure read to ne potvrđuje. Preostalo: formalni copy, native dugački statusi, zatvaranje sheet-a i stvarni pomoćni servis gate.



### S15 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `SettingsPresentation.tsx` `02e7bd93`; `PrivacyPresentation.tsx` `109f9a0a`; `SupportPresentation.tsx` `129b824a`; `dizajn-privatnost.tsx` `58158897`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Account Settings grouped rows → Privacy hub/retention/export/block/closure → Support inbox/request/status; stariji provider-agnostic `Promena lozinke` je potrebno capability-gate.

**KEEP:** Postojeći Settings, Privacy i Support child tokovi, realni read/unknown/closure/export/safety statusi.

**DELTA:** P1 provider-aware `Pristup nalogu`, formalno `Vi`, bez duplog closure entry; P0 retention/download/status samo uz policy i server receipt.

**Finalna kompozicija, vrh → dno:** Settings → Nalog / Obaveštenja / Privatnost / Pomoć / Pravila → Odjava; Privacy → export/closure; Support → zahtevi → novi zahtev → thread.

**Tap / Back / state / recovery:** Back u izvornu settings sekciju; closure terminal ne vraća u aktivni nalog; support send/export unknown = Proverite stanje. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp long policy scroll, 1.3× grouped rows; keyboard safe case body; 48dp i TalkBack status/term umesto same boje. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-privatnost`: `privatnost-cvoriste`, `izvoz-spremno`, `zatvaranje-nepotvrdjeno`, `podrska-lista`, `podrska-veliki`.

**Prioritet:** P0 privacy/closure/exports; P1 provider/copy. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S16 — AI NEED, REVIEW, PUBLISH I AI HISTORY

**VIZUELNI UGOVOR KOJI JE NEDOSTAJAO:** čitati **B0.3 (motion table)** i **B0.4 (chat storyboard)** pre postojećih S16.1–S16.10. Nov unos AI odgovora: samo realni stream fragmenti, `useConversationArrival` čuva identitet i jednom najavljuje committed reply; pending `TypingDot` 520ms half-cycle, ulazak 240ms/8dp. Jedna `Šta smo razumeli` kartica pokazuje *samo potvrđene* činjenice, red se po potvrdi pojavljuje jednom, svaki tap na ispravku ostaje u istoj AI sesiji. To su **TARGET DELTA** za progressive UI, nisu dokaz stvarnog Android rendera. Ljudski final review i nepoznat ishod ostaju nepromenjeni.

**Status ove porodice (29.10.2026):** PRODUCT **LOCKED**; VISUAL **CONTRACT**; CODE **PARTIAL/ALIGNED po oblastima, tačno naveden ispod**; stvarni APK/Design Lab screenshot i pixel-final **NOT YET**. Autoritativno pročitano na `uskocibusiness-boop/USKOCI-EAN@work/rev14-review-f17` (provereni HEAD ovog prolaza `45815814ee1826901ed51ed3ae7cc79bdf20d38e`). **Ne menjati produkcijski kod u ovom product chatu.**

### S16.1 — Zašto postoje ova tri povezana ekrana

**Dopuna vlasničke odluke 02.11.2026 — automatski katalog tokom razgovora:** Gemini interno bira postojeći ID, proširenje načina rada, novu potkategoriju ili novu granu. Server može da razreši/upiše kategoriju već pri trajnom čuvanju odgovora i veže njen ID za nacrt, bez korisničkog izbora ili odobrenja kategorije. Korisnik i dalje potvrđuje svoj zadatak/profil kroz Objavi/Sačuvaj; upis kategorije ne objavljuje zadatak, ne aktivira radnika i ne šalje push. Ispravka ili uklanjanje usluge menja vezu tekućeg nacrta, ne premešta niti briše zajedničko stablo. Nejasnoća se razjašnjava pitanjem o poslu, bez prikaza internih grana. Ovo je ugovor ponašanja; lokalni izvorni status i neizvršene provere vodi CODEX master §11.2a.

Korisnik **izgovara ili napiše ljudski zahtev**, USKOČI ga postepeno razjasni, **čovek pregleda**, a **jedino potvrđena server akcija** objavljuje zadatak. AI nije vlasnik objave niti uređuje canonical task bez ljudske potvrde. Tri razgraničenja ostaju vidljiva: (1) **razgovor** nije objava; (2) **predlog/nacrt** nije već objavljen zadatak; (3) **potvrda objave** nije samo odgovor AI-ja ili uspešno poslata HTTP komanda. Radni profil koristi isti dizajnerski jezik razgovora, ali drugi set činjenica i poseban ljudski aktivacioni tok.

Kanon toka: `Početna / Objavite zadatak` → **Novi zadatak / AI razgovor** → **Pregledajte zadatak** → **Sačuvajte nacrt** ili **Objavite zadatak** → tek po server-confirmed publish readback-u **Owner Task**. Drugi ulaz: `Podešavanja → AI razgovori → Zadaci / Radni profil` → nastavak samo istog stvarnog otvorenog razgovora ili zatvoren tekstualni zapis bez pisanja. Za uređivanje već objavljenog zadatka postojeći conversation i `Pregled izmena` pripadaju tom task-u, a trenutni objavljeni snapshot ostaje važeći dok nova verzija nije potvrđena.

### S16.2 — Novi zadatak / AI razgovor: normalan prvi ulazak (odozgo nadole)

1. **Zaglavlje**: Back levo, naslov **„Novi zadatak“**, eventualno jedan diskretan kontekstni meni sa *stvarno dozvoljenim* akcijama (ponovo učitaj, novi razgovor uz potvrdu, napusti uz upozorenje). Nema prebacivanja na globalni requester/worker režim; bottom tab bar nije vidljiv.
2. **Prvi sadržaj**: mala postojeća ilustracija/asistent samo kao dobrodošlica; naslov **„Opišite šta Vam treba“**; jedna kratka rečenica **„Možete napisati ili reći svojim rečima. Pitaćemo samo ono što nedostaje.“** Nema kategorija koje korisnik mora ručno da izabere, ni velike kartice pre prvog podatka.
3. **Primeri**, najviše nekoliko kratkih ljudskih primera, kao opcioni obični redovi. Tap **upisuje** primer u composer da korisnik može da ga dopuni; **ne šalje ga sam** i ne kreira objavu. Po pojavi prve prave poruke primeri nestaju.
4. **Composer** uz donju safe-area: polje **„Opišite šta Vam treba“**, send aktivan samo za validan unos; `+` otvara postojeći izbor **Galerija / Kamera** kada je stvarno dostupan; mikrofon samo uz stvarni voice controller, pravila dozvole i povratne informacije. Akcija nije skrivena ispod tastature. Ako mikrofon ne radi, tekst ostaje korisna, nezavisna mogućnost.
5. **Bez server side-effect-a pri praznom otvaranju**: samo gledanje prvog ekrana, upisivanje ili biranje primera **nije** nova `ai_conversation`. Postoji tek po prvoj prihvaćenoj tekstualnoj/voice/photo radnji koja po pravilima toka zahteva razgovor.

**Normalan popunjen razgovor:** stvarne poruke korisnika desno; USKOČI neutralna leva strana; sledeće jedno jasno AI pitanje istaknuto bez ukrašavanja svake stare poruke. Predlozi kratkih odgovora mogu se pojaviti **samo kada su stvarno generisani/dozvoljeni** i kada štede unos; nisu obavezna stalna traka. U porukama se ne prikazuju JSON, model confidence, ID, interna safety šifra ili neproverena poslovna činjenica kao potvrđena. Jedno slanje ima jedan vidljiv ishod; pri dužem radu sme da piše **„Stiže odgovor…“** samo dok stvarno postoji živ pokušaj, ne zauvek posle neuspeha.

**Završna kartica tek kada je spremna — novija odluka vlasnika 02.11.2026, važi i za S14/S16.7:** tokom nepotpunog razgovora nema parcijalne završne kartice ni poziva na pregled. AI postavlja jedno stvarno potrebno pitanje o poslu. Kartica/akcija „Pregledajte zadatak/profil” dolazi tek uz potpune poslovne činjenice, potrebne potvrđene tačke/područja, razjašnjen način rada i aktuelan serverski review sa `canAccept` i klasifikacijom `READY`. „To je to” prekida opciona pitanja, ne zamenjuje te uslove. Priprema review-a ide posle readback-a, bez drugog modela i bez automatskog Objavi/Sačuvaj/Aktiviraj. Kategorije i ID-jevi ostaju interni. Tehnički neuspeh nije dokaz da je korisnik nešto propustio: sačuvati razgovor, ponuditi proveru stanja, ne zahtevati ponavljanje poznatog. Istek ili promenjena revizija povlače poziv na finalni pregled; postojeći ishod objave/čuvanja ostaje dostupan za oporavak. Ovim je prethodna dozvola za live karticu posle samo dve činjenice **SUPERSEDED**; galerijske i testne scene tog pravila zahtevaju kasnije usklađivanje.

**Fotografije** su vezane za stvarni zadatak, prikazuju se uz poruku/momenat dodavanja, sa stvarnim upload, success, cancel, error, retry i *unknown outcome* stanjem. Preporuka 1–3 ako pomažu, ali zadržati postojeći potvrđeni tehnički limit do šest; ne obećavati dodatnu fotografiju kada storage nije spreman. `+` ne otvara novi globalni medija centar; review ima samo specifičan put „Dodajte/Izmenite fotografije“. Obrisana/neudovršena fotografija ne sme ostati kao objavljena slika.

**Lokacija:** ako je **na lokaciji**, AI razjašnjava mesto, a osoba na stvarnoj mapi **potvrđuje** približnu javnu tačku; više tačaka samo u već podržanom route/multi-stop modelu. Mapa je kontekst jedne poruke/koraka, nije nova konkurentska stranica za celokupan chat. Zatvaranje nedovršene mape ne znači da je mesto potvrđeno; mora postojati „Prikažite mesto na mapi“ za povratak. Ako je **na daljinu**, nema javne adrese i pina niti izmišljene radne zone. **Tačna adresa i napomene za pristup su privatni owner-only podaci**, public se prikazuje samo coarse/područje posle potvrde. Dozvola lokacije, geocoder unavailable, nepotpuna tačka i neuspešno čuvanje imaju objašnjenje i jedno smisleno ponovno otvaranje, bez automatske objave.

**Glas:** jedan controller i jedan mikrofon, jasno stanje `pritisnite/držite → slušamo → obrađujemo → pregledajte sačuvani tekst ili pošaljite`; pristupačni tap način za screen reader. Denied/interrupted/cancelled ne pretvara nepotpun govor u potvrđenu poruku. Objasniti govor i privatnost iz info ulaza; nema dva paralelna voice UI-ja, nema priče da se snimak čuva kao javni prilog. Nepotvrđen transcript ostaje u tekstu za korisničku korekciju samo kada server/voice povrat dozvoljava.

### S16.3 — AI razgovor: attention, empty, long, 360dp, 1,3×, recovery

| Situacija | Tačna vidljiva odluka | Dozvoljena sledeća radnja |
|---|---|---|
| Nema poruka | Jedan naslov i composer, opcioni primeri; nema nacrta, nema pozadinske kreacije conversation | Unesite/izgovorite opis, dodajte fotografiju ako dostupno |
| Delimično razjašnjeno | Poslednje pitanje je glavno, mali niz poznatih činjenica bez lažnog kompletiranja | Odgovorite, ispravite činjenicu, potvrdite mesto |
| Spremno za review | Jedan čitljiv summary + **„Pregledajte zadatak“**; poslednji tekst koji korisnik tek piše nije sačuvan podatak | Otvorite review sa tačnom conversation identity |
| AI odgovor u toku | Postojeći razgovor ostaje čitljiv; jedna pending oznaka, send zaključan za dupliranje | Sačekajte samo dok postoji in-flight; ako nije potvrđeno → proverite |
| Neznan ishod poruke | Sačuvani nacrt i tekst, izričito **„Ne znamo da li je poruka poslata“** | **„Proverite razgovor“**; retry samo kad server dozvoli isti identitet |
| AI servis nije dostupan | Stare proverene činjenice ostaju; tiha greška uz jednu mogućnost osvežavanja, bez lažnog „gotovo“ | **„Pokušajte ponovo“** ili Back, nacrt se ne briše |
| Safety `CLARIFY/REVIEW/BLOCK` | Objašnjenje ljudskim rečima, ne sirovi kod; blokiran send/review kada to server nalaže | Dopunite/ispravite; pošaljite podršku **samo** ako stvarno postoji prijem |
| Napušten/terminalni razgovor | Read-only status i dozvoljeni prelaz na novi zadatak ili postojeći owner task | Nema slanja stare poruke niti oživljavanja završene sesije |
| Dug thread | Stari tekst se čita bez automatskog skakanja dok korisnik skroluje; „novije poruke“ ako postoji, composer ne zaklanja tekst | Vratite se na novo pitanje ili nastavite razgovor |
| 360dp / font 1,3× | Dugačak naslov, mikrofonski status, attach i send postaju stabilan prelom/vertikalna kompozicija; tap ciljevi ≥48dp | Nema horizontalnog odsecanja i nema dugmeta ispod tastature |

**Back i kontekst:** pritisak Back-a iz običnog razgovora vraća na **tačnu prethodnu rutu** (Home/History/Owner Task) bez brisanja dozvoljenog unosa. Back dok je otvorena mapa prvo zatvara njen editor; pending write ne čini da stari send bude automatski ponovljen. „Novi razgovor“ i „Napustite razgovor“ su dve **različite** posledice i traže potvrdu kada već postoji stvaran conversation; napuštanje nije brisanje istorijskih podataka. Pri povratku na review ili sa review-a, sačuvani scroll i unsent text pripadaju istom razgovoru; nikad se ne otvara druga sesija zbog zamene ekrana.

### S16.4 — PREGLEDAJTE ZADATAK: jedna konačna full-screen kompozicija

**Svrha:** ono što će drugi korisnici dobiti kao zadatak mora biti razumljivo u jednom mirnom pregledu. **Ne praviti alternativni veliki editor.** Svi normalni factovi su čitljivi, a korekcije idu u *isti kontekstni AI razgovor*; mapa i fotografije imaju legitimne posebne editore. Ne prikazivati kategorički interni taksonomski izbor kao korisničko polje.

**Vrh → dno normalnog populated stanja:** (1) Back **„Nazad u razgovor“**, naslov **„Pregledajte zadatak“** kada je to nova objava, odnosno **„Pregled izmena“** za postojeći zadatak; (2) jedna kratka **„Još treba“** sekcija *samo* ako postoji stvarni blocker, inače ništa; (3) **fotografije** kao jedinstvena galerija ako ih ima, a kada ih nema diskretni `Dodajte fotografije`, bez prazne foto-kartice; (4) glavni **naslov**; (5) opis **„Šta treba uraditi“**, pun sadržaj ili jasna eksplicitna kontrola otvaranja dugog; (6) **cena i način obračuna** (MY_PRICE vs OFFERS, TOTAL vs po osobi / po satu samo kada realni ugovor i revidirani iznos to dopuštaju); (7) **broj ljudi** samo sa jasnim značenjem „Potrebno“, čak i kada je jedan u kontrolnom review-u; (8) **termin/rok izvršenja** i odvojeno **rok za prijave** samo ako postoji verifikovan fact; (9) **približno javno mesto ili „Na daljinu“**, mapa i više tačaka samo kada ih stvarni geography model potvrđuje; (10) **zahtevi** (alati/uslovi) samo kada postoje; (11) **naručilac**, identitet i samo stvarno dostupna reputacija/role-trust; (12) po potrebi odvojena, mirna **„Tačna adresa — samo Vi vidite“** owner-private površina koja nije public preview; (13) **jedan sticky CTA** sa jasnim razlogom ako je disabled, sekundarno **„Sačuvajte nacrt“** samo kada to stvarni server može. Ispod nema ponovljenog hero-a, bedževa za svaki status niti još jedne kartice za svaku činjenicu.

**Edit mapa:** olovka na naslovu/opisu/ceni/ljudima/terminu/vremenskim uslovima vraća u **isti AI razgovor**, sa exact correction contextom; `Izmenite fotografije` otvara postojeći photo editor; `Potvrdite/Proverite tačke na mapi` otvara postojeću mapu. Vraćanje iz izmene formira **novi autoritativni pregled**, ne tiho menja raniji snapshot na ekranu. **Neposlati composer tekst nije deo pregleda** i ne dobija se implicitno kao potvrđen fact. Pravi user tap na pregled je čin pregleda, ne čin objave. Broj ljudi nije trajna veličina ekipe radnika.

**Jasnoća dva pogleda u istom review-u:** public preview = ono što drugi stvarno vide; owner-private blok = samo ono što vlasnik vidi, bez javne tačne adrese/telefona. Ne stavljati privatnu mapu među public fakta kao da je javna; owner blok nosi eksplicitnu oznaku. Fizička lokacija iz razgovora mora biti potvrđena pre javne objave; remote task nema adresu/pin.

### S16.5 — REVIEW / PUBLISH: vidljivi ishodi bez lažnih potvrda

| Stvarni ishod | Ekran i CTA | Šta se nikada ne radi |
|---|---|---|
| Review učitan, spreman | Mirna preview strana + **„Objavite zadatak“**; opcioni **„Sačuvajte nacrt“** sekundarno | Nema automatskog publish-a posle AI poruke |
| Nedostaju required facts / potvrđena mapa | `Još treba` *ispred sadržaja*, tačno imenovani nedostaci; disabled publish sa kratkim razlogom | Nema lažnog „spremno“, nema skrivene klasične mega-forme |
| AI classification/semantic proposal nije potvrđen | Kratko „Značenje usluge još proveravamo“ + korekcija u AI; nacrt može ostati privatan | Nema obećanja da će matcher već poslati zadatak worker-ima |
| Safety `CLARIFY`, `REVIEW`, `BLOCK` ili identity-policy nije dostupna | Ljudski razlog; dalje samo dozvoljena korekcija/privatni draft; support samo ako realno dostupan | Ne nuditi zaobilazni Publish koji server odbija |
| `Sačuvajte nacrt` potvrđen | „Sačuvano kao privatan nacrt. Zadatak nije objavljen.“ + **„Otvorite moje zadatke“** / nastavak kad može | Ne prikazivati ga u javnoj Discovery listi |
| Publish u toku | Jedan disabled/loading brand CTA sa istim idempotentnim identitetom | Nema drugog publish na ponovljen tap |
| Neznan ishod publish-a | „Ne znamo da li je zadatak objavljen.“ + **„Proverite stanje“**; ostali writes zaključani do readback-a | Nema kreiranja nove objave ili lažnog success moment-a |
| Server odbio/nije spreman | Istinita ograničenja, privatni nacrt gde postoji i jasna korekcija | Nema fantomskog `Objavljeno` |
| PUBLISHED + potvrđen odgovarajući owner task/revision | Jedan miran **„Zadatak je objavljen“** success momenat + **„Otvorite zadatak“** → konkretan **Owner Task** | Nikad prelaz u generički feed Zadaci |
| Objavljene izmene postojećeg task-a | „Izmene su objavljene“ tek po potvrdi; raniji objavljeni task važi dotad | Nema primene predloga izmene preko važećeg task-a pre potvrde |

**Success motion:** postojeći `PublishedMoment` sa jednim pečatom i prelazom u Owner Task je KEEP. Trenutni kod ima vremenski auto-prelaz, ali ga **isključuje kada je screen reader aktivan**; nema product razloga da uvodimo dodatnu success stranicu. Pre pixel-freeze proveriti korisničko čitanje poruke, Reduce Motion, dostupnost CTA-a i da transition ne preskoči potrebnu informaciju na sporijem telefonu.

**Review edge slučajevi:** `loading` skeleton bez lažnih factova; `stale` pregled eksplicitno čeka novi server read; `unknown` samo Check/Refresh; naslov 3 reda i opis >2000 znakova ne sakrivaju cenu/primarnu akciju; cena s dužim basis tekstom prelama redove, a kod 360dp i 1,3× cena ne odlazi u ellipsis. Tastatura map/edit ne sme da prekriva potvrdu. P0 kada price/unit ili rok nemaju dovoljnu server authority, ne prikazivati kao zaključanu činjenicu.

### S16.6 — AI ISTORIJA: stari razgovori nisu paralelni chatbot

**Ulaz:** `Podešavanja → AI razgovori` (ili bezbedan deep link uz isti session/ownership). Jedan ekran **„AI razgovori“**, odmah dve domenske opcije **„Zadaci | Radni profil“**. Nema dodatnog root taba ni mešanja istih razgovora između svrha. Normalan populated view: (1) Back → Podešavanja ili stvarni ulaz; (2) segment dve svrhe; (3) ravni, tappable redovi: **naslov**, stvarni status u ljudskim rečima (**„Započet“, „Razgovor završen“, „Napušten“, „Profil sačuvan“** samo prema serveru), datum kada je kreiran ili zatvoren (ne tvrditi da je „poslednja aktivnost“ bez podatka), diskretna akcija **„Nastavite“** ili **„Pročitajte razgovor“** samo ako dozvoljena. Bez ekrana sa deset statusnih kartica i bez novog chat pretraživača kao launch obaveze.

**Tap pravila:** `OPEN + canContinue` → **identično ID** istog `/nova` ili `/profil/razgovor` sa njegovim journal/recovery pravilima; `COMPLETED/ABANDONED + canRead` → tekstualni **read-only transcript**; ako nema dozvole, red ostaje čitljiv sa objašnjenjem **„Pregled razgovora trenutno nije dostupan“**, ali nije lažno tappable. `No data` nije greška, `offline/read error` nije „nemate razgovora“. `Prikažite još` učitava sledeću server stranu i ne duplira razgovore; sačuvati odabranu svrhu nakon povratka iz njenog ekrana, osim eksplicitnog novog deep-link targeta.

**Transcript (vrh → dno):** Back **„Nazad na AI razgovore“**, kratak naslov razgovora i datum/realni status, jedna tiha rečenica **„Prikazan je sačuvan tekst poruka. Fotografije, nacrt i pregled nisu deo ovog zapisa.“**, zatim tekstualne poruke (Vi/USKOČI); `Učitajte starije poruke` samo kada server cursor postoji. **Nema** composer-a, mikrofon-kontrole, alternativnog „Nastavi“ za zatvoren razgovor, niti ponovnog slanja istorijskih poruka. User-authored tekst iz istorije ne menja se retroaktivno radi formalnog copy-ja; formalna pravila važe za UI chrome i nova objašnjenja. H1 list admission i H2 readback/ownership moraju ostati zaštita privatne istorije; URL sam nije dozvola. Back vraća AI razgovore sa zapamćenom svrhom i razumnim list offsetom.

**AI History scene:** normal sa tri reda, samo otvoreni, samo zatvoreni, empty svake svrhe, `canContinue=false`, `canRead=false`, 20+ redova i „Prikažite još“, offline first load, offline more, transcript bez poruka, transcript 100+ poruka / starije, Account A→B switch, cold deep-link bez admission, large font 1,3× i mali 360dp. Za visinu redova nema fiksne jedne linije za naslov; ceo tap cilj najmanje 44dp.

### S16.7 — Worker AI: isti razgovor, drugi ljudski završetak

`Profil → Radni profil → Uredite kroz razgovor` otvara isti `AiConversationShell` tipografiju, status pending/unknown, voice/privacy i kontekstni povratak. AI izdvaja usluge, *način rada* (na lokaciji/na daljinu), područje **samo gde je potrebno**, dostupnost, opis i opcione informacije, bez trajnog broja članova ekipe kao stalnog prvog pitanja. **Pregledajte profil** pokazuje stvarno sačuvane i predložene činjenice pre čuvanja; **Aktivirajte profil** tek kad stvarni server profil može da postane ACTIVE i osoba potvrdi. Remote-only ne sme biti blokiran bez razloga za mapu/gradski radijus; ovo je već evidentiran zaseban P0/P1 client/server delta S14, ne AI vizuelna motivacija za novi registracioni tok.

### S16.8 — FINAL VISUAL QA: kompletan set scena, bez lažnog pixel-final statusa

**`dizajn-ai`** (najpre potraga za stvarnim scenama u aktuelnoj RN grani): first-open bez poruka, kucanje, poruka + odgovor, 2+ korisne činjenice u kompaktnoj preview, ready summary, awaiting, streaming, unknown send, retry, safety `REVIEW/BLOCK`, photo add/upload/error, map unresolved/confirmed/remote, voice idle/listen/denied/interrupted, edit task, terminal/completed/abandoned, worker AI initial/draft/activate, 360dp, 430dp, font 1×/1,15×/1,3×, keyboard i Reduce Motion.

**`dizajn-objava`**: prvi review sa fotografijama i bez njih, dugačak naslov i opis, OFFERS/MY_PRICE i hour/person basis, 1/više ljudi, fixed/flexible/rok prijava, local/remote/multi-stop, public/owner-private privacy, missing place, classification pending, identity unavailable, safety block, editing via original conversation, draft success, publish in flight, outcome unknown, verified published moment, published edit, stale/error/large text, sticky footer vs keyboard. **`dizajn-ai-mesto`**: mapa predloga, neodređeno mesto, više tačaka, spremljena tačka, greška resolvera, Back bez čuvanja i potvrda owner-only adrese.

**`AI history`**: dve svrhe, normal/empty/loading/offline/pagination, read-only, disabled, long/360/large and deep-link. Imena Design Lab galerija u istorijskom delu Mastera su **kandidati za pregled**, ne dokaz da su stvarne scene na ovom HEAD-u otvorene, renderovane ili pixel-odobrene. U ovoj sesiji provereni su **source komponentni ugovori**, **ne** RN screenshotovi niti QA snimci; svaki real-visual atribut ostaje **UNVERIFIED** do build/Design Lab proof-a.

### S16.9 — Direktan READ-ONLY audit, KEEP / DELTA / GATE (29.10.2026)

**Kontekst dokaza:** repo `uskocibusiness-boop/USKOCI-EAN`, `ref=work/rev14-review-f17`, HEAD u proveri `45815814ee1826901ed51ed3ae7cc79bdf20d38e`; SHA ispod su **blob SHA**, nisu commit HEAD. Nema implementacionih promena.

| Moduli / blob SHA | Stvarno pročitano | Konačna presuda |
|---|---|---|
| `src/app/(app)/nova.tsx` `86822acd`, `src/ui/v2/IntakePresentation.tsx` `7032ab15` | Lazy conversation, journal/recovery, pending turn, voice, photos, location; compact draft se trenutno prikazuje uglavnom pri finalnoj spremnosti (`showSummary`), chrome title je `USKOČI Asistent` | **KEEP** guards/i/o; **P1 DELTA** human `Novi zadatak` header, rani *smisleni* compact summary, formal copy bez ponovljenih panela |
| `src/ui/aiFirst/AiConversationShell.tsx` `f90b6542`, `src/ui/aiFirst/VoiceComposer.tsx` `41fb2d0b` | Jedinstven conversation layout, adaptivni composer, speech phases i accessibility; stari/novi turn anchoring | **KEEP**, ali realni voice runtime i 360/keyboard/1,3× screenshot tek dokazati |
| `src/ui/location/ConversationPointAsk.tsx` `d0ed743b` | Potvrda i revision-aware save mesta, kontekstni map editor i recovery | **KEEP**, remote/locale/permission/privacy proof pre finala |
| `src/app/(app)/pregled-zadatka.tsx` `39549cee`, `src/ui/objava/ReviewDetail.tsx` `6cf7a43b` | Photo-first postoji i private OwnerAddress razlikuje public map. **Redosled sadašnjeg `ReviewDetail`**: fotografije → naslov → **termin, mesto, ljudi, cena** → opis → naručilac → zahtevi → mapa → owner address → prijave; ne odgovara punom finalnom S16.4 | **KEEP** photo-first/owner-only/command guards; **P1 DELTA** isti konačni pregled sa opisom, cenom/basis, ljudima, vremenom, područjem, zahtevima i trust tačnim redom; omogućiti *contextual fact-edit* ulaze (sada su title/time/price/description uglavnom read-only sa jednim generičkim „Izmeni“), ne uvoditi redundantne kartice; `semanticReviewCandidates` trenutno pokazuje tehnički `categoryLabel` i mora biti preveden u razumljivu uslugu/proveru, bez korisničkog izbora interne kategorije |
| `src/data/aiTaskReviewClientService.ts` `ea64e298`, `src/data/publicationHandoff.ts` `2da5331b` | Signed review, accept-as-draft i accept-and-publish, outcome check + verified readback → `/potrebe/[id]/pregled` | **KEEP P0**; production runtime/evaluator/category correctness nije dokazan iz TS deklaracija |
| `src/ui/objava/PublishedMoment.tsx` `f4edbdbb` | Success scena i CTA, vremenski prelaz koji ne radi kada je screen reader uključen | **KEEP**, target+timing+Reduce Motion vizuelno validirati |
| `src/app/(app)/ai-istorija/index.tsx` `4910796f`, `src/ui/aiHistory/AiHistoryListScreen.tsx` `e3200492` | Dve svrhe, OPEN continue gated, pagination/server authority, read/offline/empty; `Tvoji razgovori`, `Nastavi`, `Prikaži još` imaju informal copy | **KEEP** strukturu, **P1** formalni UI chrome, pregled dužih naslova/scroll povratka |
| `src/app/(app)/ai-istorija/[conversationId].tsx` `ee822160`, `src/ui/aiHistory/AiHistoryTranscriptScreen.tsx` `40c59f17`, `historyUiModel.ts` `4c7db86b` | Closed canRead admission, account scope, paged TEXT-ONLY transcript, bez composera i slanja | **KEEP P0** privatnost/read-only; **P1** formalni UI i bolji read-only status, **NE** dodavati media bez nove server authority |
| `src/app/(app)/profil/razgovor.tsx` `71665e17`, `src/ui/workerProfile/WorkerAiPresentation.tsx` `d3585523` | AI-first radni profil, correctable review, human save/activation; shared shell | **KEEP**, align 1-name/mode/remote-only i scene sa task AI-jem; runtime/approval proof pre finala |

**Razlika koju ne treba pogrešno prijaviti:** current `IntakePresentation` već ima galeriju, editor lokacije i voice; `ReviewDetail` već ima photo-first; `AI History` već radi osnovni routing/closed transcript. To nisu „missing features“ koje treba ponovo graditi. S druge strane, code reader **nije** EAS/APK runtime proof, niti je normalni screenshot; pixel-final ostaje neproveren.


### S16.10 — stvarne AI i OBJAVA galerije kao precizan vizuelni materijal

**Intervju:** `dizajn-ai.tsx` (`23a6b460`) crta **stvarni** `AiConversationShell` / `IntakePresentation` sa statičnim slučajevima `welcome`, `thread`, `ready`, `ready-large`, `pending`, `stream`, `error`, `long`, `listen`, `denied`, `kept`, `done`, `abandoned`, `edit-thread`, `edit-done`, `block`, `worker`, `loading`, `unavailable`. Ta galerija **ne montira pravi lokacijski čitač, AI backend, govor ili upis**, pa su voice/location/stream fixture samo visual probe. Produkcioni `IntakePresentation` prikazuje završnu `DraftCard` tek kada ima dovoljno potvrđenih činjenica; naš raniji progressive summary pre finalnog review-a ostaje **product DELTA**, ne opis postojeće implementacije. `WorkerAiCard` iz galerije **nije** dokaz da postoji stalna live radnička kartica; aktivni worker review već ima svoj finalni pregled.

**Pregled i objava:** `dizajn-objava.tsx` (`98a1ed43`) pokriva `pregled-spremno`, `pregled-ponude`, `pregled-jos-treba`, `pregled-objavljuje`, `pregled-objavljeno`, `pregled-nacrt`, `pregled-ishod`, `pregled-dugo`, `pregled-ruta`, `pregled-daljina`, `pregled-bez-fotografija`, `pregled-veliki`, `trenutak`, `mesto-forma`, `foto-nepotvrdjeno`, `foto-puno`, `moj-prijave`, `moj-delimicno`. To je **velika već postojeća Design Lab podloga** za finalizaciju, ne razlog za nov prototip od nule. `ReviewDetail.tsx` već prikazuje fotografije na vrhu, a opis/cena/termin/ljudi imaju jedne stvarne fact čitaoce. Odvojiti status `NACRT` od `PUBLISHED`, i „Ne znamo ishod“ od „Objavljeno“.

**Visual DELTA samo kada je opravdano:** razgovorni header za novu objavu jasno `Novi zadatak` umesto samo generičkog `USKOČI Asistent` (posebno razlikovati `Izmena zadatka`); sažeti korisne potvrđene činjenice tokom razgovora bez trajno zakucane duple kartice; ne izlagati kategoriju/taksonomski kod korisniku, ni AI predlog predstavljati kao priznatu poslovnu činjenicu. `dizajn-ai?scene=ready-large` i `dizajn-objava?scene=pregled-veliki` treba zajedno proveriti na 360dp/1,3× sa otvorenom tastaturom, tačnim Back-om i jednim sticky CTA.

**AI istorija:** `AiHistoryListScreen.tsx` (`e3200492`) je stvarni task/profile dvodomeni pregled sa OPEN/COMPLETED/ABANDONED i read-only transcript-om, nije nov chatbot. Formalizovati copy i proveriti da `Pročitaj razgovor` ne izlaže zatvoren tuđ thread. Review/Save/publish gates ostaju autoritet servera, ne animacije. R08/F09 novi courtesy-finish source je zaseban tehnički proof, ne vizuelni razlog za novu strukturu.



### S16 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `AiConversationShell.tsx` `f90b6542`; `ReviewPresentation.tsx` `d06ed4f0`; `AiHistoryListScreen.tsx` `e3200492`; `dizajn-ai.tsx` `23a6b460`; `dizajn-objava.tsx` `98a1ed43`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** AI thread/known facts/proposal → Review → explicit save draft or publish → authoritative receipt; AI History list sa OPEN/resume i read-only terminal transcript.

**KEEP:** Jedan isti AI razgovor, human correction/approval, durable journal/readback, known facts i ReviewDetail photo-first, worker AI poseban domen.

**DELTA:** P1 jedno ime `Novi zadatak`, **nenametljiv** facts progress bez dupliranja, ponuda AI-generated opisa samo uz ljudsku potvrdu; P0 zadržati signed review/verziju i safety/block pre canonical save.

**Finalna kompozicija, vrh → dno:** Novi zadatak → razgovor + kompaktni potvrđeni facts → Pregled → Save/Publish (jasni ishodi) → Owner Task; istorija je list/readonly child.

**Tap / Back / state / recovery:** Back Review→isti thread; unknown publish Proverite stanje, bez drugog publish; stale transcript bez edit; returnTarget i scroll sačuvani. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp/1.3× voice/status/thread/facts i sticky footer bez keyboard preklapanja; 48dp, TalkBack stream status, reduced motion. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-ai`: `welcome`, `ready-large`, `error`, `worker`; `dizajn-objava`: `pregled-veliki`, `pregled-ishod`, `pregled-spremno`.

**Prioritet:** P0 signed review/privacy/unknown; P1 summary/copy. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S17 — ENTRY/AUTH I OBAVEŠTENJA / globalni ulazi, bez novog paralelnog rešenja

**Entry/Auth (sačuvani ranije zaključani contract):** existing accepted warm/forest Entry vizuelni identitet, male 2.5D scene gde imaju svrhu; jasne dve namere bez globalnog role moda; auth modal/flow with return target; signup shared account name + credentials, **bez obaveznog grada** (mesto dolazi u Need/Worker Area), email/OTP/recovery i dostupni provider sign-in samo kada stvarno konfigurisan. Text i states formalni. Error/restricted/recovery imaju jasno objašnjenje i izlaz; no bogus successful login. Na 360dp i large text dugmad/statički art ne prekrivaju email form. Auth Back se vraća u pozvani kontekst, a posle uspeha nastavlja autorizovani target.

**Obaveštenja:** header **Obaveštenja**; redovi vremenski organizovani, sa **jednom** pravom radnjom i provenance (task/person/thread) koju server dopušta. Badge dot/count samo po autoritativnom unread state-u. Tap čita opaque event target, ponovo autorizuje i vodi na tačan Task / Prijavu / Dogovor / predlog izmene / completion / ocenu / Q&A, ne generički zadatak. Ako target više nije dostupan: „Sadržaj trenutno nije dostupan“, sigurni povratak na Obaveštenja. Push payload ne sadrži privatnu adresu/poruku/route. Prazno: „Još nema obaveštenja“; stale/error: retry, ne lažna nula. Formal copy kao u celoj aplikaciji.


### S17 — stvarne galerije Auth + Obaveštenja, bez dodavanja nepostojećih ulaza

**Auth vizuelni materijal:** `ui/auth/AuthGallery.tsx` (`ca488365`) preko `dizajn-prijava?scene=ulaz-prijava`, `ulaz-registracija`, `ulaz-greska-polja`, `ulaz-nepotvrdjen-email`, `ulaz-oporavak`, `ulaz-tastatura`, `ulaz-nova-lozinka-link`, `ulaz-proveri-email`, `ulaz-dozvola-mikrofon`, `ulaz-dozvola-lokacija`. To su različite **kompozicije stvarnog Auth sheet-a**, ne dokaz da su Google/Apple/phone OTP pružaoci svi u produkciji dostupni. Cilj je zaključani clean Auth, bez globalne promene uloge i sa povratkom na izvornu nameru; odvojiti opcionalni grad od obaveznih account kredencijala. Vizuelne scene ne smeju otkriti nepostojeću metodu ulaska.

**Notifications vizuelni materijal:** `dizajn-obavestenja.tsx` (`cbfeceb0`) ima stvarne `inbox`, `inbox-empty`, `inbox-failed`, `inbox-page`, `inbox-action`, `push`, `push-unlinked`, `push-off`, `push-mixed`, `push-denied`, `push-uncertain`, `push-emulator`, `blocked-empty`, `blocked-uncertain`. **KEEP** postojeći prikaz settings/stanja i njegovu razliku `push uključen u nalogu` ≠ `telefon dozvoljava` ≠ `provider je stvarno isporučio`. Ne pisati da su push realni uređaj i queue već verifikovani. Na 360dp status/labela ne smeju biti samo boja; bell otvara ovaj jedan domen, bez novog petog taba.



### S17 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `src/ui/auth/AuthPresentation.tsx` `37c3732b`; `AuthGallery.tsx` `ca488365`; `src/ui/notifications/InboxPresentation.tsx` `351b71a0`; `dizajn-obavestenja.tsx` `cbfeceb0`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Auth accepted sheet i email/OTP/recovery fixturi; notifications inbox time-based rows/event destination + permission/push states; galerija nije live provider dokaz.

**KEEP:** Shared account, returnTarget, permission distinctions, notification target re-authz i error/stale/empty.

**DELTA:** P0 AUTH credential/identity admission bez obaveznog grada i exact target-only push (bez private data); P1 formal copy i OS/provider real availability.

**Finalna kompozicija, vrh → dno:** Entry → razlog/način ulaska → validacija email/code → povratak nameri; bell→Obaveštenja→autorizovan event child.

**Tap / Back / state / recovery:** Back auth→izvor bez gubljenja nacrta; push deep link ponovo autorizuje; target gone safe fallback; read fail ≠ empty. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp/1.3× Auth sheet iznad tastature, CTA scroll; notification rows 48dp, TalkBack unread vs not-read, reduced motion. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `AuthGallery`/`dizajn-prijava`: `ulaz-prijava`, `ulaz-tastatura`, `ulaz-oporavak`; `dizajn-obavestenja`: `inbox`, `push-denied`, `push-uncertain`, `inbox-failed`.

**Prioritet:** P0 auth/private target; P1 copy/layout. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

## S18 — POVEZANI CHILD FLOW-OVI / bez novog root mesta

- **Search / Filters:** čist full Search sa `Šta tražite?` i `Gde` (nezavisni), Apply vraća u isti Zadaci mode; filter panel sa jasnim aktivnim brojem i Poništite. Empty after filters nije prazan server.
- **Task Q&A:** public odgovorena pitanja, owner pending odgovori, anti-leak i server-readback posle slanja; završeni odgovor javni samo kada policy dozvoljava. U detail-u ostaje preview sekcija, ne glavni treći tab.
- **Agreement change:** `Trenutno → Predlog`, potvrda druge strane pre prihvaćenih novih uslova, hard calendar conflict blokira, unknown outcome freeze/readback; samo jedan pending proposal koji se zaista može procesirati; nema implicitnog rewrite-a trenutno važećih uslova.
- **Completion:** worker „Zadatak je gotov“ → confirmation; requester „Potvrdite završetak“ → potvrda/problemi. Kod više saradnji završetak je **bilateralan**, ne jedan globalni „gotovo“ za ceo task bez stvarnih server događaja.
- **Ratings:** tek posle završene konkretne bilateralne saradnje. Sve verifikovano objavljene ocene iz oba smera ulaze u jednu zajedničku reputaciju naloga; kontekst uloge je deo pojedinačne recenzije, ne odvojen prosek. Blind publication do obe ocene ili server deadline ostaje; nema javnog prikaza neobjavljenog skora.
- **Safety/report/block:** kontekstna i dostupna akcija, ne javni profil kao jedini kanal za prijavu problema; report pretvara autoritativno stanje u jasan user response, nikad ne otkriva interne identifikatore.
- **History:** završeni Dogovor može biti read-only, terminalni conversation je read-only, ranije prihvaćena cena ostaje verna snapshot-u; nema globalnog finalnog „Arhiva“.
- **Long/error/large:** child flow koristi ista B2/E pravila; ako server ne zna ishod `send/change/cancel/complete/review` ne simulirati success i ne nuditi opasni dupli write.

---


### S18 — KRUG A–E / PINNED CODE → FINAL CONTRACT / 29.10.2026

**Izvor (CODE INSPECTED):** `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` · `src/ui/system/tokens.ts` `2c535872`; `src/ui/system/layout.ts` `a32db149`; `dizajn-sistem.tsx` `b24ebb90`. Ranije zaključani nalazi na `8987900ca3a21d61c4032b9dc66cb7399264b58a` prenose se samo kad compare pokazuje da fajl nije menjan. Navedene galerije su **SCENE SOURCE**, ne pokrenut ekran.

**Sadašnji redosled (iz koda/ranijeg pinovanog audita):** Child modal/sheet/form dele `Screen`, `ProductSheet`, `StateView`, `ListRow`, `Section`, `FlowFooter`; specifični tokovi su iznad tih primitiva, ne nova arhitektura.

**KEEP:** Centralni white/forest/orange Inter sistem i 48dp, validne modal/back/keyboard/unknown konvencije.

**DELTA:** P0 child flow ne sme uvesti drugi implicitni write, private address, unsafe redirection; P1 jedan copy/contrast/states contract za sve child površine.

**Finalna kompozicija, vrh → dno:** Child header → tačan kontekst → jedno od: search/filter, pitanja, izmena, completion, ocena, report ili history → jedan relevantan CTA i safe exit.

**Tap / Back / state / recovery:** Modal X/Back zatvara svoj nivo i vraća isti parent state; partial/unknown čuva validni unos; recovery readback pre ponovnog write. Empty pokazati samo nakon potvrđenog potpunog read-a; loading, stale, partial, error i unknown moraju se razlikovati rečima i funkcionalnim oporavkom.

**360dp / 1,3× / keyboard / safe-area / accessibility:** 360dp, 1.3×, keyboard, sticky footer i root nav; TalkBack focus order 48dp, contrast i reduced motion kao zajednički dokaz. Za svaki proveriti fokus, govor ekrana, 48dp, dugačke nazive, sticky footer, tab nav samo na root-u i Reduce Motion bez lažnog prelaza.

**Design Lab / potrebne scene:** `dizajn-sistem`: `normalno`, `redovi`, `podnozje`, `dugi`, `veliki`, `stanja`; relevantan child scene iz S02–S17.

**Prioritet:** P0 privacy/transaction; P1 systematic visual QA. **Status dokaza:** `CODE INSPECTED` (file/fixture; nije renderer), `HISTORICAL SCREENSHOT` = samo stari S01/S02/identitet iz J9, NE ovaj HEAD; `CURRENT APK PIXEL FINAL = UNVERIFIED`; font/360dp/interakcija/realna server operacija = `UNVERIFIED` dok ne postoji snimak i test poznatog build SHA.

# E. CROSS-SCREEN RULES — JEDNA ISTINA

| Tema | Konačno pravilo i posledica na ekranima |
|---|---|
| **Uloga i identitet** | Jedan shared avatar/ime za nalog; requester/worker je kontekst objekta; jedna zajednička reputacija naloga i kontekstni javni prikaz profila po ulozi, bez dva proseka. |
| **Cena** | Task: task price basis; Application: total za konkretan broj ljudi i izvedena per-person/HOURLY stopa; Candidates OFFERS porede `total ÷ covered people`; Dogovor prikazuje **accepted bilateral frozen** cenu; grupa **ne sabira** privatne iznose. |
| **People/coverage** | `required`, `covered`, `remaining` su različiti od broja prijava i broja worker naloga. Broj ljudi pripada prijavi, izbor prihvata celu prijavu, server štiti overfill. Nema trajnog worker team capacity-ja kao finalnog UX-a. |
| **Vreme** | Application prihvata task fixed/flexible/deadline, ne predlaže svoj interval. Dogovor je mesto za kasniju bilateralnu izmenu termina. Raspored razlikuje exact confirmed busy, soft availability i remote deadline. |
| **Lokacija** | Public only coarse; exact/private samo kroz dokazani bilateralni grant i reauthorization. Ne izmišljati geografsku distancu; ne tražiti GPS automatski za browse. |
| **Poruke** | Task-first; private i group nisu ista poruka; unread samo kad autoritativan; terminalni thread read-only; group photo/voice samo uz gotov server contract. |
| **Attention** | Prava pending akcija, nikad samo mnogo notifikacija. Root Home do 3; domenska lista može sve. Jedna uočljiva narandžasta oznaka je dovoljna. |
| **Glavni CTA** | Ne postoji bez prave naredne akcije. Form review pa send; Candidate sheet pa confirmation; Dogovor state-dependent; no generic „Potvrdite“ u neutralnom state-u. |
| **Read freshness** | Empty samo ako imamo autoritativno 0; loading/partial/stale/full error su različiti. Zadržati last valid snapshot i objasniti refresh. |
| **Unknown write outcome** | Durable intent → exact readback/reconciliation → tek tada success/refusal. Dok unknown: bez konfliktnog duplog action-a. |
| **Dogovori filteri** | Jedan nalog i dve moguće uloge; `Sve uloge / Tražim pomoć / Uskačem` je lokalni filter konkretnih saradnji, ne režim naloga. Pretraga naslov/osoba/prikazano mesto bez private podataka. `Raspored` otvara Mesec/Nedelja/Dan umesto duplog date filtera; history outcome samo u `Prethodne saradnje`. |
| **Back/deep link** | Back source-first, cold fallback iz C2; svaka zaštićena destinacija reautorizuje target; retarget „nearest“ nije dozvoljen. |
| **Scroll / snapposition** | Povratak iz detail-a vraća query/filters/list offset/map camera/sheet snap i selected pin; tab switch ne pravi history stack. |
| **Formal copy** | Vi/Vam/Vas/Vaš, imperativi u množini, jasni ljudski statusi; jedan naziv po objektu. |
| **Accessibility** | Screen reader čita naziv kartice, vremenski period, status i cilj radnje; min touch target u skladu sa postojećim platformskim standardom; large text i contrast nisu opcioni. |
| **Privatnost i safety** | Nikakvi private data/telefon/tačna adresa u public kartici/push; group membership ne daje dozvolu za tuđe bilateralne cene. |

## E1. FINAL CROSS-SCREEN CONSISTENCY CHECK — product contract, ne izmišljeni screenshot

Ova provera je urađena nad kanonskim S01–S18 i aktualno pročitanim RN *izabranim* komponentama, **ne** nad svim živim APK ekranima. `LOCK` znači da postoji jedna nesporna product odluka; `CODE DELTA` samo kada je navedena stvarno pročitana komponenta; `VISUAL QA` znači da render na telefonu nedostaje. Ne pretvarati ovu proveru u novu navigaciju ili listu funkcija.

| Prelaz / zajednička činjenica | Jedina product istina na oba mesta | Rezultat ove provere |
|---|---|---|
| `Početna → AI Need → Review → Owner Task` | Jedan task, jedan razgovor; publish završava u sopstvenom zadatku po readback-u | **LOCK**; AI journal/owner handoff KEEP; P1 formalna kompozicija, screenshot UNVERIFIED |
| `AI Need → AI History → Resume` | Otvoren razgovor nastavlja se po ID-u; zatvoren transcript samo čitanje | **LOCK + CODE ALIGNED** za osnovni reader/admission; formal copy i offset QA |
| `AI proposal → Review` | Predlog strukturiranih factova nije objava, user potvrđuje; privatna adresa nije public mapa | **LOCK**; Review layout/P1 edit-context, classification copy i visual QA |
| `Review → Save Draft / Publish` | Sačuvan nacrt nije public; unknown publish znači check, ne dupliranje | **LOCK + CORE KEEP**; P0 runtime/evaluator E2E proof |
| `Public Task → Application → Candidates` | Isti task revision/price basis, ljudi pripadaju prijavi, selection celog broja ljudi | **LOCK**; App/backend handoff P0 i current Application reader ne pretpostavljati |
| `Candidates → Dogovori / Task-group` | Izbor daje konkretan bilateralni Dogovor; owner vidi objedinjeni task, tuđe cene ostaju privatne | **LOCK**; Task-group screen/read gap i visual QA, ne nove globalne uloge |
| `Dogovor → Poruke → Raspored` | Jedan bilateralni state; Poruke task-first, kalendar exact busy vs soft availability | **LOCK**; root Poruke i tri calendar pogleda već postoje, detaljna vizuelna provera nedostaje |
| `Profil → Radni profil → Worker AI` | Jedno ime i fotografija, AI priprema radni profil, human activation; remote-only nije fizički radijus | **LOCK**; current remote guard CODE DELTA, saved profile KEEP |
| Profil → Ocene → Public trust | **Jedan verifikovan account prosek i ukupan broj ocena**; uloge su kontekst recenzije | **LOCK 31.10**: zadržati zajednički aggregate, proveriti public read, blind i unauthorized stanja; bez novih role agregata |
| `Obaveštenja → bilo koji detail` | Event je poziv za novi scoped read, ne korisnički nalog za privatne podatke | **LOCK**, event-resolver runtime proof nedostaje |
| `Dugačak sadržaj / 360dp / 1,3×` | Jedan `sys` design system, section/row/card razlika, 48dp dodir, jedan primarni CTA | **LOCK**; tokeni direktno čitani, konkretna render matrica **UNVERIFIED** |
| `Read failure / unknown write` | Ne prikazivati grešku kao prazno; ne koristiti animation/optimistic copy kao server potvrdu | **LOCK**, proveriti svaki specifični realni E2E recovery |

**Završni horizontalni zaključak:** mentalni model i preslikavanje glavnih tokova su dosledni; ostaju *ciljana* usaglašavanja i stvarna vizuelna provera, ne potreba za dodatnim glavnim planom. Posebno ne menjati odobreni S08 role/Search/Raspored raspored ili S16 AI/history ulaze samo zato što starija komponenta ima drugo ime. **Bez priloženih stvarnih slika i build SHA ne može se tvrditi da su spacing, scene, status boje i mali telefoni visual-freeze završeni.**

# F. FINAL USER JOURNEYS / IMPLEMENTACIJA BEZ NAGAĐANJA

### F1. Requester — jedan saradnik
`Početna / Objavite zadatak` → AI razgovor → ljudska potvrda facts → Pregledajte zadatak → Objavite → **Owner Task** → pristigla prijava → **Prijave** → Candidate sheet → poseban **Izaberite** confirm → **Dogovor** → po potrebi tačna lokacija, izmene uslova, poruke → bilateralni completion → ocena → **Prethodne saradnje**. Ako nema prijava, Owner Task jasno kaže „Čekate prijave“, ne navodi korisnika da izmisli sledeću radnju.

### F2. Requester — više saradnika
Isti tok do izbora; prva prijava pokriva npr. 2 od 3 mesta, druga 1 od 3. **Moji zadaci** pokazuje `3/3 dogovoreno`, **Dogovori** jedan grupisani vremenski record za isti task/window; otvara se **Task-group** sa Markom i Nikolom, grupnim razgovorom i lokacijom. Tap Marko→njegov **bilateralni** Dogovor i njegova cena, tap Nikola→drugi. Završetak/otkazivanje jednog ne automatski završava drugog. Worker Marko ne vidi Nikolinu cenu.

### F3. Worker — od pretrage do saradnje
`Početna / Uskočite i zaradite` → Zadaci mapa/lista ili Na daljinu → Task detail → **Vaša prijava** (ljudi, ponuda samo OFFERS, prihvaćen task termin/rok, note) → review → pošiljka sa readback-om → **Moje prijave** → čekanje/izmena taska → izabrano → **Dogovor** → komunikacija, tačna lokacija samo kad podeljena → potvrda posla, ocena → **Prethodne**. Worker profile setup iz S14 je precondition kada server tako zahteva, ne globalni role-switch.

### F4. Promena zadatka posle prijave
Server označi da prijava zahteva pregled → **Moje prijave / Čeka Vas** → korisnik vidi trenutne činjenice i staru prijavu, proverljiv diff kada postoji → **Zadržite / Izmenite / Povucite**. Ne dopuštati autosačuvani pristanak na nepoznati novi termin niti alternativni termin u novom Application-u.

### F5. Predlog izmene, conflict i cancellation
Dogovor → **Izmenite uslove** → drugi korisnik vidi jasnu razliku trenutnog i predloženog → **Prihvatite/Odbijte** → server potvrđuje ili objašnjava konflikt; tek tada novi prihvaćeni snapshot. `Otkažite saradnju` je pojedinačna, sa posledicama za coverage i potvrdom; nije `Otkažite ceo task` i ne prekida ostale odnose.

### F6. Ponovni ulazak, notification, greška
Push je samo poziv da se učita i autorizuje tačan objekat; deep link može da otvori drugačiji stvarni source nego normalni browse, pa Back ima cold fallback. Delimično neuspeo read ostavlja valjane sekcije i refresh; nepoznat outcome šalje u proveru, ne dupliranje. Terminalni razgovori i Dogovori ostaju pregledni u svojim domenima.

---

### F7. AI istorija, izmena i neizvestan ishod objave

`Podešavanja → AI razgovori → Zadaci / Radni profil` → *server-authorized* OPEN `canContinue` otvara **isti** conversation editor (ne novi ID); terminal `canRead` samo tekstualni read-only transcript → Back u iste tab/filter i list poziciju. `Novi zadatak → Pregledajte zadatak` zahteva novu signed review verziju po korekciji; `Sačuvajte nacrt` ga ne objavljuje; `Objavite zadatak` pri **unknown outcome** nudi samo **Proverite stanje**, tek potvrđeni published receipt/readback vodi na **Owner Task**, ne na discovery. Napuštanje razgovora nije trajno brisanje istorije. Worker AI završava u **Pregledajte radni profil → Potvrdite aktivaciju** ako stvarno dozvoljeno.

# G. OTVORENE PRODUCT ODLUKE — SAMO REALNE

**Osnovni mentalni model, shell, hijerarhija i glavne interakcije S01–S18: ZAKLJUČANI su kao product contract.** Nema potrebe ponovo odlučivati o tabovima, arhivi, globalnoj ulozi, Application alternativnom terminu, kalendaru, kartici kandidata ili strukturi Dogovora.

**Nije otvorena product odluka, već dokaz koji nedostaje:** konačni RN tokeni za svaku meru/boju/font weight, tačan 360/430 rendering, asset mapping i screenshot comparatives. To je **VISUAL QA / PIXEL-FINAL NOT YET**. HTML prototip ne sme preuzeti autoritet bez poređenja sa realnim RN/Design Lab.

**Implementacioni dependency, ne razlog da se menja UX:** `team_capacity` guard vs per-application people; jedna zajednička reputacija naloga + blind ratings, HOURLY × people, OFFERS price sort, auth bez grada, push exact routing, remote-only profile activation, dostupnost sa TTL, AI runtime, group attachments, export/closure policy and service. Zatečeni audit nije live potvrđen u ovoj sesiji.

**Dva neuslovna guard-a pre finalnog UI obećanja:** (1) ako backend nema `group photos`, group chat ostaje text-only — nema lažnog attachment dugmeta; (2) ako nema javno autorizovanog zajedničkog rating agregata, javne ocene se ne predstavljaju kao finalni trust. Pitanja o dokumentovanoj retention politici ili budućem plaćenom režimu nisu blokatori ovog osnovnog visual contract-a i ne treba nagađati njihove uslove.

**Jedina opcionalna estetska odluka za korisnički pregled u Figma fazi:** koji od postojećih 2.5D asseta najbolje radi u prvom empty stanju Početne/Poruka/Radnog profila, **bez menjanja strukture**. Ovo nije izgovor za novu funkciju ili paralelan plan.

### G1. Ispravljen source-of-truth, bez nove product odluke

Radni izvor: **`uskocibusiness-boop/USKOCI-EAN`** → **`work/rev14-review-f17`**, novi direktno potvrđeni HEAD **`de8f838e56f96d29b99d2a1aaba1f9889b4e1a25`**, PR #43. Prethodni potvrđeni HEAD **`8987900ca3a21d61c4032b9dc66cb7399264b58a`** je za **4 commita iza** istog branch HEAD-a, uz **6 stvarno promenjenih fajlova**: `docs/plan/CODEX_PLAN_RADA.md`, `src/data/__tests__/agreement-chat-voice.test.tsx`, `src/features/voiceMessages/__tests__/voice-message-composer.test.ts`, `src/features/voiceMessages/voiceMessageComposer.ts`, `src/hooks/useAgreementVoice.ts`, `src/ui/media/AgreementVoiceControls.tsx`. Stari `Uskoci1/USKOCI-CLEAN` i default `clean-alpha-backend` nisu trenutni UX izvor. Prethodna tvrdnja o **163 commita** bila je stariji presek prema drugoj bazi i ne koristi se kao novi broj za ovu verziju.

**Ne ponavljati grešku:** u svakoj narednoj CODE tabeli mora stajati `repo / branch / commit SHA / putanja / dokaz` i jasno odvojiti **provereni fajl**, **istorijski feature audit** i **neprovereno sadašnje stanje**. Pre povezivanja sa APK-om potreban je **EAS/APK build commit proof**; branch HEAD sam po sebi ne dokazuje koji je APK instaliran. Ovo nije novo product pitanje niti razlog da se menja zaključana navigacija sa četiri taba.

# H. IMPLEMENTATION DELTA — FINAL PRODUCT vs POSLEDNJI POZNATI KOD

**NOVI PIN / VIZUELNI DELTA (29.10.2026):** HEAD `4f6fc4f1f9358926195af356b6dfcdc7464f1a17` je +3 commit-a u odnosu na `de8f838e...`; izmenjeni su `src/ui/media/AgreementVoiceControls.tsx`, `src/ui/v2/MyApplicationsPresentation.tsx`, dva njihova testa i `docs/plan/CODEX_PLAN_RADA.md` (samo READ-ONLY compare). Ne tretirati tekstualne animacione ideje B0 kao već potvrđen APK. `AGENTS.md` i `docs/implementation/design-system/PREMIUM_WHITE_CANON.md` ne postoje na navedenim putevima na ovom ref-u; njihov istorijski citat u komentarima nije stvaran izvor. `src/ui/system/motionTokens.ts`, `Appear.tsx`, `AiConversationShell.tsx`, `useConversationArrival.ts` i `FactArt.tsx` jesu provereni izvori. Pre korišćenja nekog starog SHA iz H1/H2 čitati tačnu napomenu da je to istorijski pin.

**Važno:** ovo je *handoff*, **nije komanda da se sada menja kod**. U tabeli „CURRENT CODE“ pojedine funkcije potiču iz **ranijeg** `feature/uskoci-cisto` audita; za potvrđene fajlove iz novije radne grane `work/rev14-review-f17` izričito se pozivamo na H1. Stariji dokaz *nije* automatski dokaz najnovijeg stanja; promenu označenu samo istorijskim izvorom treba ponovo proveriti pre implementacije. Sačuvati ispravnu autoritativnu infrastrukturu (idempotency/reconciliation, server-scoped reads, router auth).

| Oblast | FINAL PRODUCT | Poslednji poznati CURRENT CODE / dokaz | DELTA za implementation chat |
|---|---|---|---|
| Shell | Četiri root taba; avatar/bell; no role switch | `_layout.tsx` već odgovara; Reduce Motion i push transitions postoje | **KEEP**; vizuelni i formal copy QA |
| Početna | Action hub, bez feeda i ponavljanja | **Aktivna grana**: `HomePresentation.tsx` (`c309383b`) još sadrži `Aktuelni zadaci` carousel i neformalno `Čeka te` / `Objavi zadatak` | Ukloniti nepotrebni marketplace carousel, zadržati server pažnju/aktuelan termin/resume i poštovati zaključani redosled; formalni tekstovi |
| Zadaci | Local map + PEEK/HALF/FULL, remote lista, jedan scope | **Aktivna grana** `zadaci.tsx` (`ee3f5813`) već ima mapu sa list sheet-om `peek/half/full`; stari `Lista / Mapa` nalaz je iz drugog repozitorijuma | **KEEP** postojeći map/sheet model; proveriti prostorni scope, remote punu listu, count/cache, realni device UX |
| Task card/detail | Minimalna dense card; detail photo-first i verifikovani zajednički account trust | `TaskFace` ima suvišan sadržaj; detail architecture uglavnom dobra | Očistiti card, photos ispred opisa, privacy/account trust, zero/unavailable jasno |
| Application | Jedan form, people per application, no alternative term | `ExactTimeSheet`, predloženi `start/end`, `skillOptIn` u novom toku | Ukloniti iz **novog** submit flow-a; legacy replay samo za već neraspletan intent. Odvojena dobrovoljna dopuna posle potvrđenog slanja ostaje po odluci 03.11.2026; ne mutirati profil u submitu |
| People/slots | Ne postoji permanentni team capacity; whole application selected | U prethodnim test/navodima backend guard upućuje na `team_capacity`, nije novo provereno | Uskladiti server eligibility/constraints sa people-per-application i remaining slots; sačuvati overfill i idempotency |
| Fixed / hourly | HOURLY znači **RSD po osobi po satu**, uz jasno naznačen broj ljudi i period kada je poznat | Raniji audit navodi pogrešno tumačenje u `fixedApplicationPrice`; PR #43 sada opisuje čuvanje jedinice kroz više tokova, ali REV/SQL candidate ≠ live release dokaz | **Ne tvrditi da je raniji problem i dalje reprodukovan**; tražiti current signed preview/accept + server readback i backward compatibility, bez aktiviranja nedokazanog modela |
| Moje prijave | Čekaju odgovor / Čeka Vas / Prethodne | `MyApplicationsPresentation.tsx` na fiksiranom HEAD-u (`acc92635`) direktno pročitan; ima listu, changed-request review/editor, učitavanje stranica, re-read i recovery | **KEEP** unchanged application/changed contract; **P1** grupisati i formalizovati copy; 360dp/keyboard/unknown QA, bez lažnog success-a |
| Candidates | Whole application, sorted OFFERS `total/people`, confirm | price sort sada koristi total; sheet ima suvišne facts | Per-person comparator, očistiti card/sheet, 2-candidate compare, idempotent Selection |
| Owner Task | State/coverage + prijave + saradnje ispred opisa | `onAgreements` vodi na opšti Dogovori | Voditi u task-filtered task-group ili direktan bilateralni Dogovor; share photo-first skeleton |
| Dogovori | Čeka Vas / Danas / Sledeće / Bez termina / Prethodne; sekundarni **Sve uloge / Tražim pomoć / Uskačem**, search title/person/coarse place, Raspored | **Aktivna grana** `AgreementCollectionPresentation.tsx` (`8739b315`) već ima role rail, history outcome filtre, kalendarsku akciju i vremenske grupe; ostaje root `Aktivni | Istorija`; root search nije potvrđen | **KEEP** role/outcome/calendar/grupisanje; **RETIRE** root segment; dodati jedan bezbedan Search i izdvojene `Prethodne saradnje`; dedicated location filter **DEFER** |
| Task-group | Jedna roditeljska saradnička površina + odvojeni Dogovori | parent/child model postoji, ali final screen treba polirati | Završiti relation rows, group thread, privacy i task-level status; ne sabirati cene |
| Bilateralni Dogovor | Pregled / Poruke, no fixed CTA | underlying agreement change/completion logic prisutna | Pojednostaviti hijerarhiju, „Otkažite saradnju“, exact grants i sticky action rules |
| Poruke | Task-first, no history switch; group text-only | **Aktivna grana** ima stvarni `src/app/(app)/poruke.tsx` (`97035a7d`), sa konverzacionim inbox-om; staro 404 se povlači | **KEEP** inbox; proveriti stvarni task-first row, recency, autorizovani unread i group-photo scope, bez stvaranja lažnih funkcija |
| Raspored | Mesec/Nedelja/Dan; busy ≠ availability ≠ remote deadline | **Aktivna grana** `raspored.tsx` (`33f96c58`) već integriše **tri kalendarska pogleda** i dve strane Dogovora | **KEEP** Mesec/Nedelja/Dan, dalje proveriti group same-task window, soft availability, remote deadline i vizuelni QA |
| Profil | Jedan identitet i **jedna zajednička reputacija naloga** | hub već čita AccountReputation; javni preview bira kontekst uloge | KEEP account aggregate; proveriti public visibility, blind objavu i pregled; nema dva role proseka |
| Radni profil | AI-first, remote bez grada, people per prijava | worker edit dobar, ai parts zahtevaju country+city; `dostupanOdmah` bez TTL | Remote-only activation, area conditional, server TTL signal, bez inventory/team capacity glavnog UX-a |
| Settings / Privacy / Support | Mirni rows, provider-aware access, exact policy/recovery | osnovna recovery arhitektura dobra; copy / phone/role assumptions delom stari | Formal copy, istinite permission/phone/privacy činjenice; proveriti retention/export/closure proof |
| AI Need / Review / AI istorija | AI je predlog → ljudski pregled → autoritativna objava; istorija je gated po svrsi | **Potvrđena aktivna grana**: `nova.tsx` + `IntakePresentation`/`AiConversationShell`, `pregled-zadatka.tsx` + `ReviewDetail`, History list/transcript i verified publication handoff (S16.9) | **KEEP** existing readers, journal, voice/media/location, photo-first, draft, publish readback i history; **P1** `Novi zadatak` header, smisleni raniji preview, final fact order, formal chrome; **P0** runtime/evaluator/media/privacy/readback proof, bez auto publish-a |
| Notifications | Exact event target i ponovna autorizacija, bez private push metadata | parser mali set event tipova; Inbox resolver širi | Sigurne javne mappings za selection/changes/completion/rating/Q&A; formal copy |
| Ratings | **Jedna zajednička reputacija** + blind publication | postojeći account-oriented model | KEEP zajednički aggregate; public/visibility i invalidaciju nove ocene proveriti, netačan javni skor sakriti |
| Auth | Shared ime/prezime + email/credentials, bez grada; returnTarget | signup ima obavezni Grad | Izbaciti grad iz auth-a; sačuvati provider/recovery security, ne izmišljati password policy |
| Arhiva | Nema finalnog standalone producta | `/arhiva` je još full screen | Retire→safe redirect ka domenskom history kontekstu, uz legacy deeplink kompatibilnost |

**Pozitivan dokaz koji se čuva:** tačna prijava verzija/revision, whole selection i overfill zaštita, agreed terms frozen, grant revoke, completion readback, recovery journaling, odvojene conversation vrste, server paged sets, publish→Owner Task. Ne „prepisivati sve ispočetka“ dok ne postoji dokaz da je jezgro pogrešno.

## H1. ISPRAVLJEN READ-ONLY SOURCE TRACE — prava radna grana, 29.10.2026.

**Napomena o vremenu dokaza:** H1 ispod čuva ranije direktno čitane SHA-ove kao datirani izvor; novi potvrđeni HEAD i delta od `8987900…` nalaze se u **H2**. Ne čitati stare HEAD brojeve kao aktuelne, niti izvlačiti pixel-final iz blob SHA.

**Izvor i dokaz:** `uskocibusiness-boop/USKOCI-EAN`, `work/rev14-review-f17`, HEAD `b91adfd4d98e1e4b810866c8fa94155ecdf529e2`. Fajlovi dole su čitani direktno sa `ref=work/rev14-review-f17`; kratki SHA su **blob SHA konkretnog fajla**, ne HEAD SHA. Poređenje sa `feature/uskoci-cisto` (base `a9692e11942609bab9406215c3e407d79589dafa`) pokazuje `ahead_by=163, behind_by=0` za radnu granu. Isti RN tab-layout je direktno pročitan i na `feature/uskoci-cisto`, gde već postoje sva **četiri** taba.

**Retrakcija pogrešnog read-a:** prethodni H1 je proveravao `Uskoci1/USKOCI-CLEAN` default `clean-alpha-backend`, koji **nije stvarni oktobarski integracioni repo**. Njegovi zaključci `3 taba`, `Lista/Mapa`, `Poruke ne postoji` i `Raspored samo nedelja` ne važe kao CURRENT CODE nalazi i ne smeju se prosleđivati kao implementacioni backlog. Stari SHA i tekst ostaju u istorijskoj građi i/ili prethodnim verzijama dokumenta radi porekla greške, ali nisu produktni autoritet.

| Stvarno pročitani RN fajl na radnoj grani | Blob SHA | Dokazana činjenica / finalna delta |
|---|---|---|
| `src/app/(app)/_layout.tsx` | `c00b4da3` | **ALIGNED:** `Početna · Zadaci · Dogovori · Poruke`; bez globalnog mode-a, stari `/mapa` i `/prilike` su compatibility redirects, dinamični tab bar. **Ne menjati tab arhitekturu.** |
| `src/ui/home/HomePresentation.tsx` | `c309383b` | Pravi Home sadrži aktuelan appointment / attention, ali i `Aktuelni zadaci` carousel i neformalni `Čeka te`, `Objavi zadatak`; **DELTA:** ukloniti redundantni feed/carousel i formalizovati copy/hijerarhiju prema S01. |
| `src/app/(app)/zadaci.tsx` | `ee3f5813` | **ALIGNED u osnovi:** mapa i list sheet u `peek / half / full`, bez potrebe za starim globalnim `Mapa/Lista` prekidačem. **DELTA:** dokaz spatial dataset-a, remote, preview i 360dp behavior. |
| `src/ui/v2/MarketplacePresentation.tsx` | `60011641` | Ovaj fajl sada služi **Moji zadaci** prikazu, sa aktivnim grupama i odvojenim nacrtima/istorijom. Nije dokaz za stari Discovery toggle. **DELTA:** samo realno uočena odstupanja nakon daljeg UI QA. |
| `src/ui/v2/ApplicationSelectionPresentation.tsx` | `7148130c` | Vidljiva je Candidate/selection kompozicija sa sortiranjem i izborom konkretnog podnosioca; **nova Application forma je u drugom modulu**, tako da se stari nalaz o alternative-time modal-u **ne sme prenositi bez direktnog pregleda te forme na ovoj grani**. |
| `src/ui/v2/AgreementCollectionPresentation.tsx` | `8739b315` | Potvrđeni role rail, history outcome filteri, akcija `Raspored` i attention/days grouping; **KEEP**. Ostaje root `Aktivni | Istorija`, a novi search naslov/osoba/mesto nije potvrđen → **DELTA:** `Čeka Vas / Danas / Sledeće / Bez tačnog termina / Prethodne saradnje` + diskretna kontekstna pretraga, bez dupliranja filtera. |
| `src/app/(app)/raspored.tsx` | `33f96c58` | **Tri pogleda Mesec/Nedelja/Dan već postoje** i čitaju Dogovore; **nije** week-only prikaz iz pogrešnog repozitorijuma. Ostaje realni QA za group event/availability/deadline. |
| `src/app/(app)/poruke.tsx` | `97035a7d` | **Poruke root postoji** i otvara konverzacione thread-ove/ Dogovore; stari 404 nalaz je nevažeći. Potrebna dodatna provera svakog task-first inbox stanja i dozvoljenih oznaka. |
| `src/ui/v2/PublicNeedPresentation.tsx` | `24900dc6` | Komponenta Public Task stvarno postoji; ovim read-om još nije potvrđena kompletna foto/Q&A/section struktura u odnosu na S03. **Ne prepisivati stari redosled iz drugog repoa kao trenutno stanje.** |
| `src/ui/profile/ProfileHubPresentation.tsx` + `src/app/(app)/profil.tsx` | `173fcf2b` / `3fe1c96a` | Shared account identity i navigacija postoje. `AccountReputation` još prikazuje account rating, a public preview bira jednu ulogu automatski. **KEEP:** jedna zajednička account ocena; **DELTA:** autorizovan javni read i eksplicitni requester/worker preview izbor. |
| `src/ui/workerProfile/WorkerProfileSaved.tsx` + `src/app/(app)/profil/radnik.tsx` | `ed1c92d4` / `b79b6bc3` | Već postoje saved skills/mode/area/time i AI edit. Jedan activation branch traži grad/radijus bez uslova o ON_SITE. **DELTA:** remote-only activation; `Mogu odmah` expiry i formalni copy proveriti. |
| `src/ui/settings/AccountSettingsPresentation.tsx` + `src/ui/privacy/PrivacyPresentation.tsx` | `e1d2c065` / (direktno pročitano) | Settings groups i policy/privacy/closure postoje. **DELTA:** provider-aware password entry; sitni formalni copy i dokaz runtime prava. |
| `src/ui/support/SupportInboxScreen.tsx` + `src/app/(app)/profil/izvoz.tsx` | `58c3c628` / `befd626a` | Support inbox + FAQ, new-case CTA, paginacija i export request/download/recovery već postoje. **KEEP**; ne planirati ih ponovo od nule. |

**S16 DIRECT CODE PROOF (29.10.2026, isti repo/grana, aktuelni HEAD pri proveri `45815814ee1826901ed51ed3ae7cc79bdf20d38e`):** AI Need `nova.tsx` `86822acd`, `IntakePresentation.tsx` `7032ab15`, `AiConversationShell.tsx` `f90b6542`, `VoiceComposer.tsx` `41fb2d0b`, `ConversationPointAsk.tsx` `d0ed743b`; Review `pregled-zadatka.tsx` `39549cee`, `ReviewDetail.tsx` `6cf7a43b`, `aiTaskReviewClientService.ts` `ea64e298`, `publicationHandoff.ts` `2da5331b`, `PublishedMoment.tsx` `f4edbdbb`; History `index.tsx` `4910796f`, `AiHistoryListScreen.tsx` `e3200492`, transcript route `ee822160`, transcript screen `40c59f17`, `historyUiModel.ts` `4c7db86b`. Evidencija je **read-only code**, ne screenshot ili runtime potvrda. Razlozi za KEEP/DELTA/GATE su precizirani u kanonskom S16.9.

**Pravilo za nastavak:** ne ispravljati kod prema lažnoj staroj slici. Sva otvorena CODE pitanja koja nisu eksplicitno pokrivena novim read-om ostaju `NEEDS CURRENT-BRANCH VERIFICATION`, a ne automatski `GAP` ili `LEGACY CONFLICT`. Zadržati kanonski UX S01–S18 i razdvojiti produkcioni APK build SHA od GitHub HEAD-a; nikakve produkcijske izmene u ovom chatu.

## H2. AKTUELNI CODE TRACE / DELTA ODNOS NA PRETHODNI PIN — 29.10.2026.

**Samo read-only.** PR #43 `work/rev14-review-f17` ima HEAD **`de8f838e56f96d29b99d2a1aaba1f9889b4e1a25`**; compare prema **`8987900ca3a21d61c4032b9dc66cb7399264b58a`** daje `ahead=4`, `behind=0`, **6 changed files**. Sledeća četiri commita **nisu promenila** primarne presentation komponente S01–S09 i S12–S18, što je potvrđeno compare listom; novo direktno čitanje file/ref je dodatna nezavisna provera. **Source je pinovani commit, a ne podrazumevana grana.**

| Izmenjeni fajl od prethodnog pina | Korisnički uticaj / granica dokaza |
|---|---|
| `src/features/voiceMessages/voiceMessageComposer.ts` + test | Voice lifecycle, upload i oporavak su menjani; source/test nisu dokaz uspešnog OS mikrofon, network ili stvarnog dispatch-a. |
| `src/ui/media/AgreementVoiceControls.tsx` (`43b61012`) | Dodat haptic signal za stvarni početak i prestanak/cancel snimanja; screen-reader alternate tap, opt-in review i progress već postoje. Konkretnu gestiku proveriti na telefonu; neformalno `Snimaš`, `Pusti` ostaje copy DELTA. |
| `src/hooks/useAgreementVoice.ts` + `src/data/__tests__/agreement-chat-voice.test.tsx` | UI/controller integracija i testovi; nema zaključka da su podaci slati u live razgovoru. |
| `docs/plan/CODEX_PLAN_RADA.md` | Zaseban tehnički status. Isključivo čitati, ne mešati sa ovim Product/UX contract-om. |

**Source trace po domenima:** S01 `HomePresentation c309383b`; S02 `DiscoveryPresentation 842f0b7d`, `DiscoveryListState b34e0a75`, `DiscoveryListSheet aabff658`, `DiscoveryPeek a1e61652`; S03 `PublicNeedPresentation 24900dc6`, `NeedPresentation 8c6ba47b`; S04 `ApplicationComposerPresentation d6540699`; S05 `MarketplacePresentation 60011641`; S06 `MyApplicationsPresentation acc92635`; S07 `ApplicationSelectionPresentation 7148130c`; S08 `AgreementCollectionPresentation 8739b315`; S09 `GroupConversationPresentation 3c623216`, `GroupHeader d92e036c`; S10 `AgreementPresentation 13879ed3`, **voice controls 43b61012**; S11 `ConversationInboxPresentation 482f0de8`; S12 `AgendaScreen adaff1c7`; S13 `ProfileHubPresentation 173fcf2b`; S14 `WorkerProfilePresentation 6f38a575`, `WorkerAiPresentation d3585523`; S15 `SettingsPresentation 02e7bd93`, `PrivacyPresentation 109f9a0a`, `SupportPresentation 129b824a`; S16 `AiConversationShell f90b6542`, `ReviewPresentation d06ed4f0`, `AiHistoryListScreen e3200492`; S17 `AuthPresentation 37c3732b`, `AuthGallery ca488365`, `InboxPresentation 351b71a0`; S18 `system/tokens 2c535872`, `system/layout a32db149`. Sve identifikatore ovde čitati kao početke **Git blob SHA**, ne build SHA.

**Handoff samo za kasniju implementaciju:** zadržati proverenu infrastrukturu, P0 na trenutno neodređenom ishodu, privatnosti i slotovima; P1 na stvarnom visual order-u/copy-ju; nikakav R01–R12 tehnički tok nije ovim pregledom izvršen. Pritisak na dugme iz fixture scene, snapshot/test ili statičan kod **nisu** end-to-end potvrda.

# I. PRIORITETI — P0 / P1 / P2

Ovaj prioritet nije procenat rada na dizajnu; to je minimalni redosled da UI ne obećava nešto što implementacija ne zna. Tehnički tim dodatno proverava aktuelnu bazu/repo pre zahvata.

### P0 — correctness, privacy, trust, release gating

1. **Application:** HOURLY × application people; korektna TOTAL/PER_PERSON semantika; OFFERS total po prijavi; readback/preview/server usaglašenost.
2. **Multi-seat:** ukinuti logičku zavisnost od trajnog `team_capacity` na Radnom profilu uz zadržan **remaining slots**, bezbedni maksimum, whole-application selection i overfill guard.
3. **Application UX:** više se ne šalje proposed time pri novoj prijavi i nema implicitne kategorije/skill mutation; stare unresolved komande se odmotavaju exact journal/replay pravilima.
4. **Candidates:** OFFERS rangiranje po **ceni po osobi**, ne totalu; selection i accepted terms proveriti pod konkurencijom i changed revision-om.
5. **Identity/ratings:** shared identity; jedan zajednički account trust; blind publish policy ili hide/gate nedokazane public ocene.
6. **Discovery/privacy:** public approximate location i spatial dataset count/list/pins bez lažnog scope-a; grant-based exact location, bez public/private leak-a.
7. **Calendar correctness:** confirmed busy vs soft availability vs remote deadline; requester same-task grouping ne sme sakriti različite intervale; worker hard conflict authority.
8. **AI/publish:** produkciona dostupnost AI provider-a/evaluator-a, human review, blocked/unknown outcome, signed revision i verified Owner Task readback; voice/media/location i pristup AI istoriji samo uz stvarnu autorizaciju. Postojeći idempotentni tok čuvati, ne prepisivati niti zaobilaziti. 
9. **Account safety:** export/close processing/retention copy i permissions moraju odgovarati stvarnoj politici; unknown writes freeze/recheck.
10. **Release E2E:** od entry/auth do task, application, selection, agreement, completion, rating, recovery, private data i deep-link ulaza; bez izmišljenih uspeha.

### P1 — jedinstvena organizacija, manje legacy prostora

1. Home: ukloniti carousels i feed, formalni copy, attention i resume samo kada postoje.
2. Dogovori: novi vremensko-akcijski root i jedan task-group; **sačuvati već postojeći role filter i history outcome**, dodati Search naslov/osoba/prikazano mesto tek uz proverljiv autoritet podataka i direktan ulaz u Raspored; nema posebnog kalendarskog filtera na root-u; Poruke bez stalnog Aktivan/Istorija.
3. Owner Task→pravi task-filtered saradnički workspace; prethodni `/arhiva` → compatibility redirect.
4. Push: autorizovana event→target mapping za izbor, izmene, završetak, problem, ocene i dozvoljeni Q&A; permissions status istinit.
5. Worker remote-only activation; dostupnost `Mogu odmah` sa TTL i tačnim gašenjem.
6. Role-aware own public preview i pažljivo read-only ponašanje nerešenih role profila.
7. Group photo attachments samo nakon server storage/membership/cleanup proof; group voice defer.
8. Puno dosledno formalno „Vi“ kroz client, server template i obaveštenja.

**AI S16 — konkretan P1 uz postojeći radni sistem:** finalizovati jedan `Novi zadatak` header, smislene kompaktne factove pre full-review (bez prazne kartice), usaglasiti Review fact order i public/owner-private vizuelnu granicu, formalni copy `Vi/Vam/Vaš` u AI chat/Review/AI History/worker AI, user-visible Disabled/Unknown/Review reason i ispravan povratak u isti conversation. Ne planirati ponovo voice, photos, location, history routing, publication journaling, ni signed review infrastrukturu koje već postoje na grani. **Design Lab/real APK QA je zahtev za dokaz, a ne automatski CODE GAP.**

### P2 — visual production polish

1. Validacija realnih `ScreenHeader`, `TabBarItem`, TaskFace, preview, Candidate, Agreement, message rows i existing Design Lab asseta.
2. Finalni konkretni spacing/radius/weight tokeni, 2D ikone, date/time/prelamanje, empty-state art selection.
3. Device snapshots: **360dp, ~430dp, 1×/1,15×/1,3×** font, active/pending/empty/long/error/stale/recovery, landscape samo gde ima podršku.
4. Reduce Motion, keyboard/insets, screen reader/touch targets/contrast, dynamic selected pin/sheet snapping.
5. Figma final i kompletan klikabilni prototip tek posle visual contract QA; prototip ne postaje autoritet kada odstupa od realnog RN sistema.

# J. STATUS MATRIX I FINAL VISUAL QA — IZVRŠNA KONTROLA

**Airbnb-2026 benchmark / original USKOČI, novi visual-freeze gate:** B0 je obavezni kratki vizuelni brief pre svake Figma/RN scene. V1 proof set: S01 Home normal/empty, S02 PEEK/HALF/FULL + error nav collision, S03 sa/bez fotografije, S11 inbox + voice/private/group, S16 welcome/typing/stream/facts/review/unknown; za svaki 360dp i ~430dp, 1,3×, keyboard, TalkBack i Reduce Motion na **jednom poznatom Android APK build SHA-u**. Uporediti precizan screenshot sa B0, nema `pixel-final` dok ne postoji snimak + pregled. Reference fotografije Airbnb-a služe samo kao benchmark javnog dizajna, ne kao prihvaćen USKOČI render.

### J1. Status rečnik

**LOGIC:** `LOCKED` = product odluka zaključana, `NEEDS DECISION` = stvarno nerešena vlasnička odluka, `GAP` = nema jasnog ponašanja. **VISUAL:** `DIRECTION` = stil/smer, `CONTRACT` = definisana kompozicija i stanja, `PIXEL-FINAL NOT YET` = nema odobrene realne finalne scene. **CODE:** `ALIGNED` = dokumentovano odgovara, `PARTIAL` = deo postoji/treba dorada, `GAP` = nedostaje važna capability, `LEGACY CONFLICT` = postojeći UI/backend radi suprotno finalnoj odluci. **CODE statusi su kombinacija istorijskog `feature/uskoci-cisto` audita i direktnih čitanja navedenih u H1 iz `work/rev14-review-f17` (tačno provereni fajlovi imaju prednost). Ako je CODE delta samo iz istorije, potrebno je ponovno očitavanje aktuelne grane, ne tretira se kao utvrđena greška najnovijeg APK-a. `Zadaci` map/sheet, `Poruke` root i tri pogleda `Raspored` postoje na novijoj grani. Instalirani APK i vizuelne scene/screenshot nisu pregledani — sve ostaje PIXEL FINAL: NOT YET.**

| Surface/familija | LOGIC | VISUAL | CODE (poslednji poznati) | PIXEL FINAL |
|---|---|---|---|---|
| S01 Početna / shell | LOCKED | CONTRACT | LEGACY CONFLICT (feed/carousels/copy); shell ALIGNED | NOT YET |
| S02 Zadaci local/remote/search/filter | LOCKED | CONTRACT | PARTIAL (map/sheet exists; spatial/remote proof to verify) | NOT YET |
| S03 Public Task detail | LOCKED | CONTRACT | PARTIAL (photo order, trust) | NOT YET |
| S03 Owner Task detail | LOCKED | CONTRACT | PARTIAL (group destination/order) | NOT YET |
| S04 Application/review/receipt | LOCKED | CONTRACT | LEGACY CONFLICT (time, team guard, hourly) | NOT YET |
| S05 Moji zadaci/nacrti/prethodni | LOCKED | CONTRACT | PARTIAL | NOT YET |
| S06 Moje prijave / changed task | LOCKED | CONTRACT | PARTIAL | NOT YET |
| S07 Candidates/selection/compare | LOCKED | CONTRACT | LEGACY CONFLICT (price sort) | NOT YET |
| S08 Dogovori root/history + uloga/search/kalendar | LOCKED | CONTRACT | PARTIAL (role/outcome/Raspored već postoje; root switch legacy, Search gap) | NOT YET |
| S09 Task-group | LOCKED | CONTRACT | PARTIAL | NOT YET |
| S10 Bilateralni Dogovor/change/complete | LOCKED | CONTRACT | PARTIAL | NOT YET |
| S11 Poruke/private/group | LOCKED | CONTRACT | PARTIAL (root exists; group photos/authority to verify) | NOT YET |
| S12 Raspored | LOCKED | CONTRACT | PARTIAL (3 views present; grouping/QA to verify) | NOT YET |
| S13 Profil/ocene/public preview | LOCKED | CONTRACT | PARTIAL: zajednička ocena ALIGNED; public reader/preview QA otvoren | NOT YET |
| S14 Radni profil/AI setup | LOCKED | CONTRACT | PARTIAL / VERIFIED CLIENT CONFLICT (remote-only lokacijski guard; TTL pending) | NOT YET |
| S15 Podešavanja/Privatnost/Podrška | LOCKED | CONTRACT | PARTIAL (Privacy/Support/export routes present; provider-aware access/copy) | NOT YET |
| S16 AI Need/Review/History/Worker AI | LOCKED | CONTRACT (S16.1–S16.9 prošireni) | PARTIAL/ALIGNED: chat/history/voice/photo/review/readback postoje; copy, progressive draft, review ordering DELTA; production runtime GATE | NOT YET |
| S17 Entry/Auth | LOCKED | CONTRACT (ranije) | LEGACY CONFLICT (signup grad) | NOT YET |
| S17 Obaveštenja/push | LOCKED | CONTRACT (ranije) | GAP (exact event mappings) | NOT YET |
| S18 Q&A/ratings/safety children | LOCKED | CONTRACT | PARTIAL; ratings authority GAP | NOT YET |

### J2. QA MATRIX — šta je definisano, a šta **nije** provereno u ovoj sesiji

Oznaka **SPEC** = Master sada propisuje kako scena *mora* da radi. **UNVERIFIED** = nemamo screenshot/realnu RN scene verifikaciju u ovom radu; ne podrazumeva grešku, ali zabranjuje `pixel-final` tvrdnju. U ovom pass-u *nijedna* porodica nije fizički renderovana, pa su ćelije verifikacije **UNVERIFIED**. Potreban je set iz stvarnih Design Lab scena i RN app build-a.

| Familija | Normal populated | Attention | Empty | Long content | 360dp | 1.3× tekst | Loading/stale/unknown | Real visual QA |
|---|---|---|---|---|---|---|---|---|
| Početna | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Zadaci + remote | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Task public/owner | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Application/review | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Moji zadaci | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Moje prijave | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Candidates | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Dogovori/history | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Task-group | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Bilateralni / Poruke tab | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Poruke / group chat | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Raspored | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Profil / ocene | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Radni profil | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Settings / Privacy / Support | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| AI Need (tekst / glas / foto / mapa) | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Review / Draft / Publish success & unknown | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| AI History / read-only transcript | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Worker AI / human activate | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |
| Auth / Notifications / children | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | SPEC | UNVERIFIED |

### J2a. Provera aktuelne RN grane — dokaz ne menjati u screenshot tvrdnju

| Porodica | Finalni product anatomija | Direktno pročitano iz `USKOCI-EAN@work/rev14-review-f17` | Vizuelni dokaz | CODE status |
|---|---|---|---|---|
| S01 Početna | Sledeće/Čeka Vas/namere, bez feeda | `HomePresentation.tsx` (`c309383b`), carousel/informal-copy još prisutni | **NEMA screenshot-a novog pinned builda** | PARTIAL, konkretan copy/carousel delta |
| S02 Zadaci | local map+PEEK/HALF/FULL, remote list | `zadaci.tsx` (`ee3f5813`), tri sheet pozicije već postoje | **NEMA screenshot-a novog pinned builda** | PARTIAL; spatial/remote detail QA |
| S03 Public/Owner Task | jedan photo-first skeleton, privacy | `PublicNeedPresentation.tsx` (`24900dc6`) **opis pre fotografija**; `ReviewDetail.tsx` (`6cf7a43b`) **fotografije prve**; S03 pinned delta opisan | **NEMA screenshot-a novog pinned builda** | VERIFIED VISUAL ORDER DELTA, KEEP shared facts/privacy |
| S04 Application/review | people, accepted time, OFFERS cena, note, review | `ApplicationComposerPresentation.tsx` (`d6540699`) već ima kompletan `Ovo šalješ` sheet i `SentReceipt`; `ExactTimeSheet` za drugi termin je konfliktnа opcija | **NEMA screenshot-a novog pinned builda** | KEEP REVIEW; VERIFIED ALTERNATIVE-TIME DELTA |
| S05 Moji zadaci | aktivno/nacrti/prethodni bez kartica-suplus | `dizajn-moji-zadaci.tsx` (`c340dfa6`) sada direktno pročitane owner list/stranice/stanja | **NEMA screenshot-a novog pinned builda** | EXISTING GALLERY VERIFIED; NATIVE QA UNVERIFIED |
| S06 Moje prijave | čekaju/pažnja/prethodne | `dizajn-prijave.tsx` (`14421da1`) i `MyApplicationsPresentation` scenariji, uključujući novo/izmena/strane/veliki | **NEMA screenshot-a novog pinned builda** | EXISTING GALLERY VERIFIED; NATIVE QA UNVERIFIED |
| S07 Candidates | osoba + konkretna prijava, izbor sa potvrdom | `dizajn-kandidati.tsx` (`d81a4886`) sa real CandidateList/Selection prezentacijom i unknown/confirmed fixture-ima | **NEMA screenshot-a novog pinned builda** | EXISTING GALLERY VERIFIED; REAL SEAT/PRICE QA UNVERIFIED |
| S08 Dogovori | Čeka Vas/Danas/Sledeće/bez termina/prethodne | `AgreementCollectionPresentation.tsx` (`8739b315`), grouping postoji, `Aktivni | Istorija` još postoji | **NEMA screenshot-a novog pinned builda** | LEGACY CONFLICT samo u root segmentu |
| S09 Task-group | parent centralni workspace, privatne saradnje | `GroupConversationEntry.tsx` (`67910c75`), `AgreementOverview.tsx` (`7a87b777`) i `dizajn-dogovori?scene=group` | **NEMA screenshot-a novog pinned builda** | PARTIAL; FULL GROUP DEVICE QA UNVERIFIED |
| S10 Bilateralni | dva taba, nema neutralnog sticky | `AgreementPresentation.tsx` (`13879ed3`) + `AgreementWorkspace.tsx` (`e0d9ded0`), galerija `dizajn-dogovori` | **NEMA screenshot-a novog pinned builda** | CORE ALIGNED; STALE FIXTURE/COPY DELTA |
| S11 Poruke | task-first inbox, privatni i grupni thread | `ConversationInboxPresentation.tsx` (`482f0de8`) **task-first, bez root active/history tabova**, galerija `dizajn-poruke` | **NEMA screenshot-a novog pinned builda** | CORE ALIGNED; COPY/PRIVACY NATIVE QA |
| S12 Raspored | Mesec/Nedelja/Dan, worker busy vs soft availability | `AgendaScreen.tsx` (`adaff1c7`) i `dizajn-kalendar.tsx` (`7e35cdd4`), tri pogleda i duga/zona scenariji | **NEMA screenshot-a novog pinned builda** | CODE EXISTING; REAL NATIVE/TZ QA UNVERIFIED |
| S13 Profil | Shared identitet i **jedna zajednička reputacija** | `ProfileHubPresentation.tsx` (`173fcf2b`), `profil.tsx` (`3fe1c96a`), `AccountReputation.tsx` (`68d4319f`), `ProfileWorkSummary.tsx` (`ca5b00dd`) | **NEMA screenshot-a novog pinned builda** | PUBLIC READER/role preview QA; shared identity/role finished counts KEEP |
| S14 Radni profil | AI-first skills/mode/conditional area/time | `WorkerProfileSaved.tsx` (`ed1c92d4`), `WorkerProfilePresentation.tsx` (`6f38a575`), `profil/radnik.tsx` (`b79b6bc3`) | **NEMA screenshot-a novog pinned builda** | REMOTE CLIENT GUARD CONFLICT; rest partial, formal copy delta |
| S15 Settings/Privacy/Support | Grouped rows, privacy, support inbox and status | `AccountSettingsPresentation.tsx` (`e1d2c065`), `PrivacyPresentation.tsx`, `SupportInboxScreen.tsx` (`58c3c628`), `profil/izvoz.tsx` (`befd626a`) | **NEMA screenshot-a novog pinned builda** | major subflows exist; provider-aware access and formal copy P1/P2 |
| S16 AI Need / Review / History / Worker AI | Jedan razgovor → ljudski review → verified publish → Owner Task; odvojena read-only istorija | `nova.tsx` (`86822acd`), `IntakePresentation.tsx` (`7032ab15`), `AiConversationShell.tsx` (`f90b6542`); `pregled-zadatka.tsx` (`39549cee`), `ReviewDetail.tsx` (`6cf7a43b`), `PublishedMoment.tsx` (`f4edbdbb`); History list/transcript (`e3200492` / `40c59f17`); Worker AI route (`71665e17`) | **NEMA screenshot-a novog pinned builda** | KEEP architecture; P1 title/progressive summary/Review ordering/formal copy; P0 runtime & E2E authority, pixel not verified |

**Zajednički RN DESIGN-SYSTEM dokaz:** `src/theme/colorTokens.ts` (`394b1add`), `src/theme/tokens.ts` (`41ec4bf7`), `src/ui/system/tokens.ts` (`2c535872`), `src/ui/system/layout.ts` (`a32db149`) na istoj eksplicitnoj radnoj grani. Centralni white canvas, forest green `#006B4F`, orange `#FF7A1A`, Inter, 20dp gutter, 24dp section/card radius, 28dp sheet, 48dp touch **već postoje**. **Ne graditi paralelan AI/Figma token set.** Token proof nije screenshot proof. Detalji: B4 i E1.

**Pouka ovog source-check-a:** postojeći četiri taba, Zadaci map/sheet, Poruke i tri kalendarska pogleda **nisu novi implementation zadaci** samo zato što su nedostajali u nevažnoj default grani drugog repozitorijuma. Za pixel-final i dalje treba stvarni APK/Design Lab screenshot uz potvrđen build SHA.

### J3. Final visual freeze gate (po svakoj familiji)

Ekran sme iz `CONTRACT` u **PIXEL-FINAL** tek kada su urađeni **svi** sledeći dokazi: realni RN presentation screen ili Design Lab scena odgovara kanonu; pregledane 360dp i ~430dp; font 1× / 1,15× / 1,3×; normal/attention/empty/long; keyboard/scroll/CTA; loading/stale/unknown; back/source/deep-link; privacy/accessibility; konkretni screenshots odobreni; nema suprotnih tekstova u Masteru. **Tek tada** izraditi/ažurirati high-fidelity Figma i kompletan klikabilni prototip koji verno prati isti komponentni sistem. Implementacija i puštanje u prodavnicu ostaju zaseban dokazni posao.

### J4. Izvršni zapis i korekcija izvora — 29.10.2026.

**Hronološka napomena:** sledeći pasusi beleže ranije trenutke 29.10. (stari HEAD `b91adfd4…`, `45815814…`, `116bc977…`). Za najnoviju proveru ovog dana važe zaglavlje, G1 i H2 sa `de8f838e…`.

**Ispravljeno:** prethodno preuzeti default branch `Uskoci1/USKOCI-CLEAN@clean-alpha-backend` **nije bio oktobarska radna grana**. Pogrešni zaključci o tri taba, odsustvu Poruka, starom Mapa/Lista izboru i nedeljnom kalendaru povučeni su iz kanonskog CURRENT CODE dela. Pravi repo/grana/HEAD i direktno potvrđeni RN fajlovi su opisani u H1. `feature/uskoci-cisto` na **pravom** repozitorijumu postoji, ali radna `work/rev14-review-f17` ima **163 commita više**.

**Sačuvano:** kanonski S01–S18 product/UX/visual contract, stara istraživanja kao historical evidence, ranije pozitivne backend zaštite. **Nije dirano:** GitHub source, Supabase, Edge, baza, APK ili Figma. **Nije potvrđeno:** kojem EAS build commit-u odgovara instalirani APK i kako 360dp/1.3×/long/error/empty izgledaju u realnom renderu.

**Odobrenje filtera i nastavak S13–S15 (29.10.2026):** korisnik je odgovorio „Može“ na konačan predlog filtera Dogovora; stanje je zapisano u S08 bez otvaranja novog product pitanja. S13–S15 sada imaju dodatne READ-ONLY provere baš na `USKOCI-EAN@work/rev14-review-f17`: shared identity i postojeće UI podloge su sačuvane, a zajednički account rating (KEEP), public preview, remote-only activation condition i provider-aware password su jasno imenovani DELTA, ne izmišljeni nepostojeći ekrani. **Nijedna Design Lab ili APK scena nije u ovom pass-u direktno renderovana.**

**Nastavak bez nagađanja:** uvek čitati `uskocibusiness-boop/USKOCI-EAN@work/rev14-review-f17` ili noviji eksplicitno verifikovan HEAD (ne implicitni default), uz runtime/Design Lab scene. Po svakoj porodici: istiniti KEEP/DELTA nalazi → ažurirati isti Master → realni screenshot i visual freeze. Ne stvarati paralelan master ni revizije.

**FINAL VISUAL PASS — AI S16, 29.10.2026:** nastavljeno posle S13–S15 i odobrenog Dogovori filtriranja. **S16.1–S16.9 sada sadrže finalnu, upotrebljivu anatomiju AI Need, Review/Publish i AI istorije**, uključujući photo/location/voice/retained text, server-gated safety & unknown, 360dp/1,3× i Back. Direktno pročitani relevantni RN moduli u pravom repo-u na eksplicitnom `work/rev14-review-f17`, potvrđen HEAD `45815814ee1826901ed51ed3ae7cc79bdf20d38e`, navedeni sa blob SHA. Razgraničeni KEEP/DELTA/GATE nalazi; F7, H, H1, I, J1/J2/J2a ažurirani. Istorijski materijal netaknut; **ne menjati produkcioni kod, Supabase, migracije, APK ili Figma**. Nisu potvrđeni EAS build SHA, AI provider live runtime, Design Lab screenshot i pixel-final.

**Konzistentnost posle AI faze — 29.10.2026:** dodat E1 horizontalni contract pass preko S01–S18, sa jasno odvojenim LOCK, samo direktno dokazanim CODE delta i neproverenim vizuelnim scenama. Prvi put direktno potvrđeni *pravi* RN `colorTokens`, `theme/tokens`, `system/tokens` i `layout`; B4 sada navodi stvarne kanonske vrednosti i odbacuje staru paletu iz pogrešnog repozitorijuma. Identifikovani posebni AI Review delta za neizložene contextual edit ulaze i tehnički `categoryLabel` u semantic-review poruci. Nema druge datoteke, nema produkcionih izmena; Design Lab/realni APK freeze ostaju NOT YET.


### J5. READ-ONLY VISUAL AUDIT — stvarne RN galerije, isti branch, PINNED SHA

**Ovaj J5 je datirani vizuelni source audit na `116bc977…`.** Sve izmenjene/istačne file trace provere preko novog `de8f838e…` navedene su u H2 i lokalnim završnim pasusima S01–S18. Scenario ime ne predstavlja screenshot.

**Pročitano:** `uskocibusiness-boop/USKOCI-EAN@116bc9770d72638e6fd57cbe702a8af2ca52605f`, PR #43. Postojeće galerije koriste **stvarne produkcijske prezentacione komponente**, ali napajane fixture podacima i inertnim callback-ovima; većinom su interno dostupne kroz `uskociapp://dizajn-...` samo na DEV/internom buildu. To nije screenshot, pokrenut APK ni test stvarnog UI-a na 360dp. Ne preuzimati njihove istorijske tekstove kao novu korisničku odluku. Ovaj J5 je *vizuelni audit iz izvornog koda*, ne novi paralelni master.

| Porodica | Stvarni `src/designLab` izvor / tačne scene (uz `?scene=`) | KEEP već postoji | Sadašnji visual delta / QA status |
|---|---|---|---|
| **S01 Početna** | `dizajn-pocetna`: `upcoming`, `waits`, `empty`, `long`, `stale`, `owner` | Sledeće/Čeka/namere + recovery i sticky header | Horizontalni own-task, application i discovery karuseli su **P1 EXCESS**, ne menjati do UI implementacije. Copy Vi. **PIXEL = UNVERIFIED** |
| **S02 Zadaci** | `dizajn-zadaci`: `kartice`, `lista`, `lista-greska`, `pretraga`, `filteri`, `kartica-na-mapi` | `TaskRecordBody`, map+list+Peek, scope/filteri | Native pan, PEEK/HALF/FULL insets, remote-full-list, isti server count/list/pins **UNVERIFIED** |
| **S03 javni detalj** | `dizajn-zadaci`: `detalj`, `detalj-prijavljen`, `detalj-moj`, `detalj-veliki` | realan status/footer, QA, fit, mapa | **Provereni konflikt:** u public-u opis pre foto; owner review foto prvo. TARGET skeleton S03; privacy gate |
| **S04 nova prijava** | `dizajn-prijava-forma`: `pregled`, `po-osobi`, `cela-ekipa`, `ishod`, `poslato`, `pregled-veliko` | **Završni pregled i receipt već postoje!** | `ExactTimeSheet`/predlog drugog termina u novoj prijavi je **potvrđeni DELTA**, ne izmišljati drugi pregled |
| **S05 Moji zadaci** | `dizajn-moji-zadaci`: `lista`, `nacrti`, `puno`, `dugi`, `stranice` | postojeća owner lista i statusi | grupisanje i paged partial recovery na 360dp/1,3× **UNVERIFIED** |
| **S06 Moje prijave** | `dizajn-prijave`: `lista`, `nova`, `izmena`, `ceka`, `strane`, `veliki` | postojeća worker prijava/lista | posebna statusna jasnoća i public task destination, mobile QA **UNVERIFIED** |
| **S07 kandidati** | `dizajn-kandidati`: `lista`, `ponuda`, `ne-moze`, `ishod`, `sklopljen`, `veliki` | ceo confirmation/unknown izbor i sheet osobe | poređenje **po osobi**, tačan seat/role proof, dugačak sadržaj **UNVERIFIED** |
| **S08 Dogovori root** | `dizajn-dogovori`: `list`, `grouped-list`, `history`, `long`, `empty`, `error` | role filter, outcome history, Calendar već postoje | `Aktivni | Istorija` root i dalje **LEGACY UI**; finalne vremenske grupe + Search nisu implementirane |
| **S09 task-group** | `dizajn-dogovori`: `grouped-list`, `group` | GroupConversationEntry/ljudi i privatne saradnje | pun parent/child ekran sa privatnim granicama treba potvrditi u stvarnoj ruti |
| **S10 bilateralni** | `dizajn-dogovori`: `one`, `worker`, `waiting`, `recovery`, `no-term`, `problem`, `chat-unknown` | Pregled/Poruke i one-action/quiet footer | stare fixture „Otvori poruke“/PHONE su superseded; realni route i formalni copy **UNVERIFIED** |
| **S11 Poruke** | `dizajn-poruke`: `list`, `long`, `owner`, `empty`, `stale` | task-first inbox i GROUP/private rows; **bez root istorijskih tabova** | copy Vi, long/unread/closed i privacy screenshot **UNVERIFIED** |
| **S12 Raspored** | `dizajn-kalendar`: `dan`, `nedeljaDogovori`, `danDogovori`, `bezTermina`, `zona`, `delimicno` | tri istinska pogleda i soft availability | 360dp/1,3×/timezone/24h day layout **UNVERIFIED** |
| **S13 Profil** | `dizajn-profil`: `hub-active`, `hub-new`, `hub-long`, `hub-large`, `ratings-comments` | shared identitet, avatar, statistike, child routes | public validacija zajedničke ocene i previše podignutih row surfaces **DELTA** |
| **S14 Radni profil** | `dizajn-profil`: `worker-first`, `worker-ready`, `worker-active`, `worker-review`, `worker-unknown` | AI-first saved mode/area/time i pregledi | remote-only activation client guard + veliki font, nije dovoljno gallery fixture PASS |
| **S15 Settings/Privacy/Support** | `dizajn-privatnost`: `privatnost-cvoriste`, `izvoz-spremno`, `podrska-lista`, `zatvaranje-nepotvrdjeno` | stvarne grouped rows, retention, export/support/closure | provider-aware nalog, legal/privacy copy, real save/closure proof **UNVERIFIED** |
| **S16 AI Need + objava** | `dizajn-ai`: `welcome`, `thread`, `ready`, `done`, `error`, `worker`; `dizajn-objava`: `pregled-spremno`, `pregled-nacrt`, `pregled-ishod`, `trenutak` | realan shared chat/review/publish UI, voice/photo/mape controls | progressive summary, review copy i real provider/native **DELTA / UNVERIFIED** |
| **S17 Auth/Notifications** | `dizajn-prijava` + `AuthGallery`: `ulaz-prijava`, `ulaz-registracija`, `ulaz-tastatura`; `dizajn-obavestenja`: `inbox`, `push-denied`, `push-uncertain` | mnoštvo stvarnih read/permission/notification UI states | stvarni provider/OS/push delivery i 360dp **UNVERIFIED** |
| **S18 cross-screen primitives** | `dizajn-sistem`: `normalno`, `redovi`, `zapisi`, `uslovi`, `izbor`, `podnozje`, `dugi`, `veliki`, `stanja` | centralni `Section`, `ListRow`, `Surface`, `FlowFooter`, `FactRow`, `StateView` | proveriti jednom svaku 48dp metu, semantics, contrast i reduced motion; nema razloga za drugi UI framework |

**Važno:** `dizajn-profil` je opsežan (ocene, public profile, oblast, fotografija, lični podaci, radni profil), a `dizajn-privatnost` već sadrži Podršku i zatvaranje. Odsustvo posebnog fajla `dizajn-podrska.tsx` **nije** dokaz nedostajuće podrške. U statusima J1 i J2a nadređeni su ovi noviji direktni čitaoci kada stari zapis govori da nije pročitan.

### J6. Komponentna geometrija i jedan vizuelni jezik — potvrđeni tokeni, ne proizvoljna maketa

| Element | Potvrđen stvarni RN source | Konačna upotreba / upozorenje |
|---|---|---|
| Podloga | `colorTokens.color.ground/surface = #FFFFFF`, `wash = #F5F7F4` | **Premium White** je trenutna stvarna osnova. Ranija zamisao warm ivory ostaje tonalni brend smer, ali blanket ivory zamena nije odobrena kao kodna promena. Proveriti vizuelno pre promene boje. |
| Brand | green `#006B4F`, orange `#FF7A1A`, ink `#17221D` | primarna pozitivna akcija zeleno; narandžasta samo attention/brand, ne tekst sa nedovoljnim kontrastom; cena u ink |
| Tip | `Inter`, body 16/24, title 21/26, pageTitle 28/33, note 14/20 | jedna tipografska lestvica kroz ekran; dugačka imena i finansijske osnovice prelome se, ne mikroskala |
| Mreža | `layout.gutter=20dp`, section 24dp, group 12dp, zone 32dp | poravnati prvu ivicu teksta; različiti chat/map edge-i imaju svoj dokazani token |
| Površine | radius control 12dp, compact card 20dp, card 24dp, sheet 28dp | kartica samo za nešto što je entitet/akcija; ordinary facts kao redovi, bez kartice u kartici |
| Dodir | `touch.min=48dp`, `layout.maxWidth=640` | male ikonice imaju punu dostupnu ciljnu zonu; tablet čita centriranu kolonu |
| Animacije | centralni `sys.motion`, `useReducedMotion` | animirati uspešan *potvrđen* prelaz, ne lažni „Poslato“ tokom nepoznatog ishoda; bez petlji na radnim ekranima |

**Vizuelna formula:** jedna jaka namera/akcija, jedan jasan status, realna fotografija ili mapa kada zaista pomažu, izbegavanje karusel-smicanja i istog naslova u header-u, hero-u i kartici. Boje nisu dokaz success/error bez reči. Design Lab „normalno“ nije pixel-final dok se ne vidi stvarno Android renderovanje istog source-a.

### J7. Konkretna matrica snimanja — vizuelni freeze po sekvenci, bez novog plana

| Red | Tačno otvoriti u internom DEV/Design Lab buildu | Minimum stanja za upoređivanje | Obavezan dokaz |
|---|---|---|---|
| V1 | `/dizajn-sistem?scene=normalno`, `veliki`, `stanja` | 360dp/1,3×, duge reči, CTA/keyboard, sheet insets | stvarna slika/položaj kontrola i 48dp hit test, ne samo izvor |
| V2 | `/dizajn-pocetna?scene=upcoming`, `waits`, `empty`, `long`, `stale` | populirano/attention/first-run/long/offline | jedan ekran bez horizontalnog Home feeda; V1 root chrome sa 4 taba |
| V3 | `/dizajn-zadaci?scene=lista&n=8&sheet=half`, `kartica-na-mapi`, `lista-greska`, `detalj`, `detalj-prijavljen` | local PEEK/HALF/FULL; filter, jedan pin, 360dp/1,3× | map/list/preview gesture, CTA, public photo order + privacy; prava `/zadaci` ruta za mapu |
| V4 | `/dizajn-prijava-forma?scene=pregled`, `pregled-veliko`, `ishod`, `poslato`; `/dizajn-kandidati?scene=ponuda` | form/review/unknown/confirmation/selection | **sačuvati postojeći review**, ukloniti alternativni termin iz new application design target-a |
| V5 | `/dizajn-dogovori?scene=grouped-list`, `one`, `waiting`, `chat-unknown`; `/dizajn-poruke?scene=long`; `/dizajn-kalendar?scene=danPreklapanje` | root/role, group/1:1, chat, calendar month-week-day | nezavisni privatni odnosi, CTA samo kada dopušten, nema skrivenih time/gesture controls |
| V6 | `/dizajn-profil?scene=hub-long`, `worker-ready`, `worker-review`, `hub-large`; `/dizajn-privatnost?scene=podrska-veliki` | shared name/reputation, worker setup/unknown, settings | jedan zajednički verifikovan account skor, formalno, jedan role-safe public preview |
| V7 | `/dizajn-ai?scene=welcome`, `ready-large`, `error`, `done`; `/dizajn-objava?scene=pregled-veliki`, `pregled-ishod`, `trenutak` | keyboard/voice, final review, publish success/unknown | čovek potvrđuje, progress feedback je autoritativan; ne testirati pravi model kroz inertnu galeriju |
| V8 | `/dizajn-prijava?scene=ulaz-tastatura-registracija`; `/dizajn-obavestenja?scene=push-denied`, `push-uncertain` | auth sheet keyboard + notification denied/read unknown | safe-area, razumljiv oporavak i stvarno OS stanje bez lažnog „uključeno“ |

Svaki red prolazi **prvo fixture scenu**, zatim dostupnu **stvarnu root/pushed RN rutu**, pa sačuvanu sliku u 360dp i na referentnoj većoj širini, 1× i 1,3×. Za dobiti `PIXEL-FINAL` mora postojati odobren video/screenshot vezan za poznati build SHA. U ovom read-only prolazu nijedan takav snimak nije izvršen; svi ostaju `PIXEL FINAL = NOT YET`.

### J8. REZULTAT OVOG PROLAZA — šta je stvarno urađeno i šta nije

**IZVRŠENO kao read-only pregled:** uvid u source i postojećih **16 potvrđenih Design Lab galerija** (`dizajn-pocetna`, `dizajn-zadaci`, `dizajn-moji-zadaci`, `dizajn-prijave`, `dizajn-kandidati`, `dizajn-prijava-forma`, `dizajn-prijava`, `dizajn-dogovori`, `dizajn-poruke`, `dizajn-profil`, `dizajn-ai`, `dizajn-kalendar`, `dizajn-obavestenja`, `dizajn-objava`, `dizajn-privatnost`, `dizajn-sistem` — ukupno **16 navedenih fajlova**); ovo su potvrđene putanje, nisu svi njihovi fixture slučajevi zasebno izvršeni u renderer-u. Ujednačeni su KEEP/DELTA opis S01–S17; odbijene ranije lažne tvrdnje da nema prijavnog review-a, da Dogovori nemaju role filter, da postoji samo nedeljni kalendar ili da Poruke moraju dobiti drugi root tab.

**IZMENE:** samo ova postojeća Library datoteka Master. **Bez promene** GitHub koda, PR-a, Supabase/Edge baze, Figma fajla, EAS konfiguracije, APK-a ili Design Lab komponenti. **Nije potvrđeno:** realni fizički RN screenshot, app/build SHA instaliran na telefonu, live provider, prava servera ili nova dizajnerska odobrenja. PR #43 i `docs/plan/CODEX_PLAN_RADA.md` ostaju zaseban operativni i tehnički tok, ovaj Product/UX Master ne postaje konkurentski R01–R12 plan.

**Neposredni vizuelni fokus narednog izvršnog prolaza:** V1 `dizajn-sistem` → V2 Početna (uklanjanje carousel-soup iz target prikaza) → V3 Zadaci/javni detalj (ujednačen photo-first) → V4 Prijava (postojeći review KEEP, samo alt-time DELTA), pa ostale porodice. Ne potrošiti novi prolaz na ponovno dokazivanje već proverenog četvorotabnog shell-a ili izmišljanje novih modula.

### J9. ZATVARANJE KRUGOVA A–E, ISTORIJSKI VIZUELNI DOKAZ I PREOSTALI GATE — 29.10.2026.

**Istorijski checkpoint prethodnog prolaza:** verzija **39** bila je stanje *pre* ranijeg uspešnog upisa; nakon toga su **verzije 40 i 41** potvrđene Library metadata/readback-om za isti stabilni identitet `libfile_c237612b68bc8191887e6c1028dd8edd`. **Za ovaj vizuelni brief izvor je originalna verzija 41**, ne lokalna niti konkurentska `(7)` kopija. Kandidat sam po sebi **nije dokaz novog broja verzije**; naredni upis mora uspeti sa `expected_current_version=41`, pa zatim biti proveren nezavisnim čitanjem. Istorijska evidencija ispod granice ostaje doslovno očuvana.

**VIZUELNI IZVORI — stvarno otvoreni istorijski JPG-ovi iz `/USKOCI_KOMPLETAN_PLAN_DOKAZI_I_UX_REV14_FULL_2026-10-27.zip`:**

| Datoteka | Šta se vidi | Izvorni status / valjanost |
|---|---|---|
| `dokazi/slike/01-zadaci-greska.jpg` | Zadaci failure-state sa velikim obaveštenjem „Ne možemo da učitamo zadatke“ i CTA „Pokušaj ponovo“, četiri root taba na dnu | **HISTORICAL SCREENSHOT**, ne aktuelni RN render; potvrđuje staru full-screen kompoziciju |
| `dokazi/slike/02-mapa-panel.jpg` | Lokalna mapa, Filter/Chips i error/empty panel; tekst i donje `Pokušaj ponovo` nalaze se toliko nisko da dolaze ispod/iza nav zone; korisna retry akcija nije pouzdano vidljiva | **HISTORICAL SCREENSHOT / P0 regression probe**; stvarno UI preklapanje na starom APK-u, **ne** tvrdnja da ga sadašnji source zadržava |
| `dokazi/slike/03-identitet-aplikacije.jpg` | `O aplikaciji` identifikuje USKOČI 1.0.0, source `fcef803e719ba5663f6cfd8fbd5a601e08a3479b` i preview/OTA kanal | **HISTORICAL BUILD ID** — nije commit `de8f838e56f96d29b99d2a1aaba1f9889b4e1a25` |
| `dokazi/ui_ux_rev11/slike/01-15989.jpg` | Početna sa već postojećim 4 taba, dve namere, resume, Moji zadaci, Moje prijave, dostupnost; stari neformalni copy i gustina | **HISTORICAL SCREENSHOT**; stvarni dizajn-smer, nije nov code proof |

**Zadatak za pixel-freeze, ne nova product odluka:** Pokrenuti pravi Android build sa dokumentovanim source SHA i proveriti Zadaci u realnom route `PEEK/HALF/FULL`, prazan/filter-empty, error, retry, root nav, izabrani pin i keyboard. Pritom posebno proveriti scroll-end padding iz `DiscoveryPresentation.tsx`, `DiscoveryListSheet` i `DiscoveryListState` **na 360dp i pri 1,3×**. Retry mora biti skroz vidljiv i najmanje 48dp; `TalkBack` čita grešku i put dalje; bez root nav preko CTA. Pravi screenshot iz builda novog pina `4f6fc4f1f9358926195af356b6dfcdc7464f1a17` **nije dostupan**; `UNVERIFIED` ostaje.

**Presjek 18 screen contract-a:** S01–S18 sada imaju pored već postojeće kompozicije i naznačen trenutni redosled, KEEP, DELTA, Back/state/recovery, 360dp/keyboard/safe-area/TalkBack, Design Lab izvor, P0/P1 i stvaran nivo dokaza. To je **PRODUCT CONTRACT COMPLETED / CODE INSPECTED PARTIAL**, a **PIXEL FINAL NOT YET**, jer nije dokazano 360dp/1,3×/OS/touch/native/post-render stanje. Prethodni Library upisi 40/41 jesu potvrđeni; svaka sledeća verzija ovog Mastera mora ponovo proći očekivanu verziju i readback originalnog Library ID-a.

---

# ISTORIJSKA EVIDENCIJA I DOKAZI — OČUVANO, ALI NIJE DRUGI PRODUCT AUTORITET

> **Normativna napomena za sve stare sekcije ispod:** ovo je dosadašnji kontinuirani rad, uključujući nekada otvorene odluke, ranije predloge, stare screenshot scene, proveru koda, test scenarije i kasnija zatvaranja odluka. Zadržava se radi dokazivosti i traceability-ja. Kada neki stari deo govori drugačije od A–J/S01–S18, on je **SUPERSEDED**; ne zadovoljava finalni contract i nije dozvoljeno da implementation tim iz njega izabere drugu opciju. Za aktivnu listu otvorenih stvari koristi **G**, za code delta **H/I**, za status **J**. Stari „FINAL“ u dokazima znači tadašnji presek, **ne** automatsku pixel-final verifikaciju.

**Izvorni naslov:** USKOČI — PRODUCT + UX MASTER. **Izvorni presek:** 28. oktobar 2026. Originalni uvodni status i njegov tadašnji metod rada nalaze se u originalnim odeljcima 1–2; svi njihovi iskazi o „jedinoj istini“ sada se tumače kroz kanonske A–J iznad.

# 1. ČEMU SLUŽI OVAJ DOKUMENT

Ovo je jedina radna istina za završno osmišljavanje USKOČI aplikacije.

Dokument mora u svakom trenutku da odgovori na četiri pitanja:

1. Šta je USKOČI i kako proizvod radi?
2. Gde smo trenutno stigli?
3. Šta je već odlučeno, a šta još nije?
4. Koji je sledeći korak i zašto?

Finalni vizuelni dizajn se NE zaključava pre nego što su funkcija, stanje, akcije i korisnički tok jasni.

---

# 2. METOD RADA

Za svaku oblast radimo istim redosledom:

## 2.1 Domain truth
Prvo utvrđujemo stvarnu poslovnu logiku iz:
- REV10;
- REV14;
- aktuelnog koda;
- stvarnih server/RPC pravila;
- ranije potvrđenih vlasničkih odluka.

## 2.2 State model
Utvrđujemo sva realna stanja objekta i dozvoljene prelaze.

## 2.3 User action model
Za svaku situaciju definišemo:
- šta korisnik vidi;
- šta može da uradi;
- šta se menja;
- šta druga strana vidi;
- šta se dešava ako radnja uspe;
- šta ako ne uspe;
- šta ako ne znamo ishod.

## 2.4 Navigation
Odakle ekran dolazi, gde vodi, šta radi Back, kako rade deep-link i push ulazi.

## 2.5 Information hierarchy
Odlučujemo šta korisnik mora da vidi prvo, šta sekundarno, a šta tek po potrebi.

## 2.6 Wireframe
Tek tada pravimo raspored elemenata.

## 2.7 Visual system
Tek na kraju:
- font;
- veličine;
- radius;
- shadow;
- ikonice;
- 2.5D ilustracije;
- boje;
- motion;
- finalni izgled.

## 2.8 Implementation
HTML/prototip i stvarna aplikacija dolaze posle zaključane logike i dizajna.

---

# 3. GLAVNA ARHITEKTURA PROIZVODA

## 3.1 Jedan nalog, jedan shell

USKOČI nema globalni režim u kome korisnik mora da bude ili “requester” ili “worker”.

Ista osoba može istovremeno:
- imati svoj zadatak;
- biti prijavljena na tuđi zadatak;
- imati Dogovor kao naručilac;
- imati drugi Dogovor kao uskočer.

Zato uloga pripada konkretnom objektu, ne celom nalogu.

## 3.2 Glavna navigacija

Zaključani smer:

**Početna · Zadaci · Dogovori · Poruke**

Profil, Podešavanja, Obaveštenja, Podrška, Privatnost i slične oblasti nisu glavni tabovi.

## 3.3 Početna

Početna kasnije mora da bude dinamična, a ne meni sa deset dugmadi.

Glavne namere mogu biti:
- Treba Vam neko?
- Želite da uskočite?

Ali to su akcije, ne promena globalnog režima aplikacije.

---

# 4. GLAVNI DOMENI — AKTUELNI STATUS

Svi glavni funkcionalni domeni su sada prošli dubinski product/UX pass:

1. TASK + DISCOVERY
2. APPLICATION + SELECTION
3. AGREEMENT + GROUP + MESSAGES
4. CALENDAR + COMPLETION + RATINGS
5. PROFILE + ACCOUNT + SAFETY
6. CROSS-PRODUCT NAVIGATION / NOTIFICATIONS / PERMISSIONS / COPY
7. FINALNI VISUAL SYSTEM

Nismo više u fazi u kojoj tek otkrivamo osnovnu logiku proizvoda.

Aktuelni posao je:
**screen-by-screen finalizacija postojećeg USKOČI vizuelnog jezika**, uz proveru stvarnog koda i svih realnih stanja.

Posle toga:
1. kompletan high-fidelity klikabilni prototip;
2. E2E pregled na telefonu;
3. production implementacija po vertical slice-ovima;
4. release proof.

---

> **ISTORIJSKI PRESEK — ne aktuelna status tabla.** Aktivna status matrica je J1, realni visual proof J2/J3. Ovo poglavlje čuva nekadašnji opseg analize.

# 5. TRENUTNI STATUS

## 5.1 Šta je dubinski obrađeno

Na nivou product logike i UX ponašanja dubinski su obrađeni:
- Task lifecycle;
- Discovery mapa/lista/remote;
- Application i Selection;
- bilateralni Dogovor;
- više worker-a i group coordination;
- private/group Poruke;
- exact location grants;
- Agreement changes;
- cancellation;
- Raspored i conflict pravila;
- completion;
- ratings target model;
- Profile / worker profile;
- Safety / block / report;
- Support;
- Privacy / export / closure;
- global navigation, Back, deep links i push smer;
- loading / error / stale / unknown-outcome standardi.

## 5.2 Šta još nije završeno

Nije završena **finalna UI kompozicija svakog ekrana i svakog realnog stanja**.

Posebno još treba:
- pixel-level layout po screen porodicama;
- finalni task/card/pin sistem;
- finalni sheet/dialog standard na svim površinama;
- kompletna auth state matrica;
- populated Poruke/Dogovori/Raspored finalni izgled;
- role-scoped ratings/profile finalni izgled;
- AI history / transcript finalni UI;
- worker area/location finalni UI;
- notification populated/deep-link state UI;
- export/closure/support lifecycle vizuelna stanja;
- permissions/recovery states;
- accessibility i large-text proof;
- jedan kompletan high-fidelity E2E prototip.

Dakle:
**product logika je već jaka; sada se završava visual/interaction contract ekran po ekran.**

---

# 6. TASK — KANONSKA LOGIKA

## 6.1 Stanja zadatka

Aktuelni proizvod razlikuje:
- NACRT;
- OBJAVLJENA;
- ČEKA PRIJAVE;
- DELIMIČNO POPUNJENA;
- POPUNJENA;
- ZATVORENA.

Završeni zadatak dodatno može imati stvarni razlog završetka:
- COMPLETED;
- CANCELLED;
- EXPIRED;
- ARCHIVED.

“Zatvoren” nije dovoljno precizan korisnički opis. UI treba, gde je moguće, da kaže kako je stvar završena.

## 6.2 Tri odvojene istine

Ne smeju se mešati:

### A. stanje zadatka
npr. delimično popunjen;

### B. stanje potrage
OPEN ili CLOSED;

### C. popunjenost
npr. 2/3.

Primer:

**2/3 dogovoreno + potraga otvorena**

nije isto što i:

**2/3 dogovoreno + preostala potraga zatvorena**.

## 6.3 Više ljudi

Jedna prijava može pokriti više mesta.

Primer:
- potrebno 3 osobe;
- Marko dolazi sa još jednom osobom;
- njegova prijava pokriva 2 mesta;
- Nikola pokriva 1 mesto.

Posle izbora Marka:
**2/3 potvrđeno**

Posle Nikole:
**3/3 potvrđeno**

## 6.4 Zadatak i Dogovor nisu isto

Objava zadatka se posle izbora ne sme tiho pretvarati u Dogovor.

Prihvaćeni Dogovor zadržava svoju verziju uslova.

Kasnija izmena javnog zadatka ne sme da promeni postojeći Dogovor.

---

# 7. CENA — TRENUTNI PRODUCT SMER

## 7.1 Worker poredi cenu po osobi

Za worker Discovery prikaz prioritet je cena **po osobi**.

Ako requester navede ukupni budžet:
- sistem ga deli prema originalnom broju potrebnih ljudi;
- worker vidi vrednost po osobi.

Primer:
12.000 RSD ukupno / 3 osobe
→ 4.000 RSD / osoba.

## 7.2 Prijava sa više ljudi

Ako worker dolazi sa 2 osobe:
4.000 RSD / osoba
→ 8.000 RSD ukupno za njegovu prijavu.

## 7.3 Satnica

Trenutna vlasnička odluka:
**satnica je po osobi.**

Prikaz mora to jasno da kaže, npr:
**1.200 RSD / sat / osoba**

## 7.4 Minimalni budžet u filteru

Fiksni budžet i satnica ne treba slepo porediti istim filterom.

Radni smer:
- minimum fiksno po osobi;
- zaseban minimum satnice po osobi.

Tačan UI još nije zaključan.

## 7.5 Valute

Za MVP Srbija osnovni smer ostaje RSD.

Više valuta / EUR normalizacija je budući zahtev, ne zaključani MVP scope.
Ako se uvede:
- čuva se originalna valuta;
- za search/filter se čuva normalizovana RSD vrednost;
- Dogovor ne menja cenu svakog dana zbog kursa.

---

# 8. DISCOVERY — GLAVNA ODLUKA

Tab **Zadaci** ima dva browsing režima:

## A. Na lokaciji
- mapa je osnova;
- lista je sheet preko mape;
- lista ima PEEK / HALF / FULL.

## B. Na daljinu
- nema mape;
- nema bottom-sheet-a preko prazne bele površine;
- prikazuje se normalna puna lista.

To nisu dva taba.
To su dva pogleda istog Discovery sistema.

---

# 9. NA LOKACIJI — MAPA + LISTA

## 9.1 PEEK

Mapa je glavna.

Dole se vidi samo mali gornji deo liste:
- handle;
- broj lokalnih rezultata.

Primer:
**12 zadataka**

Broj znači samo zadatke relevantne za trenutno vidljivo područje mape.

## 9.2 HALF

Otprilike deo ekrana mapa, deo lista.

Korisnik može istovremeno:
- da vidi gde su zadaci;
- da pregleda nekoliko kartica.

## 9.3 FULL

Lista je glavna.

Mapa je gotovo potpuno prekrivena, ali korisnik je i dalje u istom Discovery kontekstu.

Nema posebnog “Lista / Mapa” dugmeta.

---

# 10. KRITIČNO PRAVILO: MAPA I LISTA MORAJU PRIČATI ISTU PRIČU

Dok je korisnik u lokalnom map prikazu:

**donja lista prikazuje samo zadatke koji pripadaju području koje korisnik trenutno gleda.**

Ne sme:
- da prikazuje remote zadatke;
- da ih računa u broj;
- da prikazuje zadatke van trenutnog map scope-a kao da pripadaju toj mapi.

Zato:
Mapa Novi Sad → 12 lokalnih zadataka → lista govori o istih 12.

---

# 11. POMERANJE MAPE

Korisnik pomera mapu.

Aplikacija ne menja listu na svakom pikselu.

Kada se kamera smiri:
- novi vidljivi region postaje scope liste;
- lista se tiho ažurira;
- broj zadataka se ažurira;
- nema dodatnog dugmeta “Pretražite ovo područje”.

Ovo je već blisko aktuelnoj kodnoj logici.

---

# 12. CACHE PRETHODNO GLEDANIH PODRUČJA

Ovo je nova UX/tehnička obaveza.

Primer:
1. Liman → 12 taskova.
2. Korisnik ode na Detelinaru → 18 taskova.
3. Vrati se na Liman.

Očekivanje:
- prethodno učitani Liman rezultati pojavljuju se odmah;
- ne pravi se veliki loading za nešto što je korisnik upravo video;
- po potrebi se podaci tiho osveže u pozadini.

Vizuelno lista pokazuje samo trenutni region.
Interno aplikacija može pamtiti prethodno učitane regione u sesiji.

---

# 13. REMOTE / „NA DALJINU“

## 13.1 Ulaz
Quick kapsula:
**globus + Na daljinu**

U kodu već postoji `remote` glyph sa globus ikonom.

## 13.2 Prikaz
Kad je “Na daljinu” aktivno:
- mapa nestaje;
- nema sheet handle-a;
- nema PEEK/HALF/FULL;
- prikazuje se puna lista remote zadataka.

## 13.3 Povratak na mapu
Tap “Na lokaciji” vraća:
- prethodni centar mape;
- prethodni zoom;
- prethodni sheet položaj;
- prethodni cache.

---

# 14. PIN SYSTEM — FUNKCIONALNA ANATOMIJA

Ovo poglavlje zaključava kako pinovi treba da se ponašaju i šta znače.
Finalni crtež, boje i precizne dimenzije tek dolaze u vizuelnom pass-u.

## 14.1 Četiri stanja koja korisnik mora da razume

Postoje samo četiri osnovna prikaza:

1. **TASK** — jedan zadatak na toj tački.
2. **PLACE** — više zadataka deli isto približno mesto.
3. **CLUSTER** — više različitih tačaka je preblizu na trenutnom zoom-u.
4. **SELECTED** — bilo koji od prethodnih koji je korisnik upravo izabrao.

PLACE i CLUSTER se vizuelno moraju razlikovati jer ne rade istu stvar.

## 14.2 TASK pin

TASK znači:
**jedan zadatak, jedno javno približno mesto.**

Pin treba da bude:
- mali;
- lako prepoznatljiv kao USKOČI;
- približno iste fizičke veličine na ekranu kroz zoom;
- bez cene;
- bez naslova;
- bez broja prijava;
- bez dodatnih statusnih oznaka.

Tap:
- pin postaje selected;
- lista se skloni iz donje zone;
- otvara se preview kartica tog zadatka.

Kartica, ne pin, nosi:
- naslov;
- cenu;
- vreme;
- mesto/udaljenost;
- kapacitet.

## 14.3 PLACE pin — više zadataka na istom mestu

PLACE znači:
**više zadataka ima isto približno javno mesto i zoom ih ne može razdvojiti.**

Primer:
`U + 3`

Broj znači:
**3 zadatka na ovom mestu.**

Tap ne zoomira mapu.

Tap:
- PLACE pin postaje selected;
- dole se otvara carousel;
- prvi zadatak se prikazuje kao jedna velika preview kartica;
- swipe levo/desno menja zadatak;
- pin ostaje selected.

Carousel može diskretno da pokaže:
- `1 od 3`;
- male tačke.

Cela aktivna kartica otvara baš taj task detail.

Ako PLACE ima mnogo zadataka:
- ne moraju svi članovi da se učitaju unapred;
- prvi paket se prikazuje odmah;
- sledeći se mogu učitati kada korisnik priđe kraju carousela;
- trenutno gledana kartica ne sme da skoči ili promeni indeks kada u pozadini stignu novi članovi.

## 14.4 CLUSTER — više različitih tačaka

CLUSTER znači:
**više različitih lokacija je preblizu da bi svaka imala svoj čitljiv pin na trenutnom zoom-u.**

Vizuelno treba da bude drugačiji od PLACE pina.

Radni smer:
- jednostavan kružni ili vrlo kompaktan marker sa brojem;
- broj je glavni sadržaj;
- ne izgleda kao konkretan task pin.

Primer:
`12`

Tap:
- ne otvara karticu;
- mapa se približava tako da obuhvati članove;
- cluster se razlaže na manje clustere, PLACE pinove ili TASK pinove;
- lista se zatim usklađuje sa novim vidljivim područjem.

Cluster je navigacija kroz gustinu, ne zadatak.

## 14.5 SELECTED

Selected pin treba da bude očigledan, ali ne dramatičan.

Funkcionalni smer:
- isti osnovni oblik;
- oko 5–8% veći;
- diskretan halo / jača ivica;
- iznad ostalih pinova;
- ne pomera geografsku tačku.

Ne:
- ogromno povećanje;
- pulsirajuća animacija bez razloga;
- skakanje pina;
- lebdeća cena ispod pina.

### Važna korekcija postojećeg koda
Trenutni marker sistem ume da prikaže cenu ispod izabranog TASK pina.

Radna product odluka:
**cenu uklanjamo sa pina.**

Razlog:
preview kartica se pojavljuje odmah i već nosi cenu.
Pin ostaje jednostavan geografski signal.

## 14.6 Veličina kroz zoom

Pin je screen-space element.

Znači:
- na nivou cele Srbije ne treba da izgleda kao da pokriva 100 km;
- na nivou ulice ne treba da postane ogroman.

Radni vizuelni opseg, za kasniji test:
- normalni TASK/PLACE: oko 30–34 dp vizuelne mase;
- selected: približno 5–8% više;
- touch zona: najmanje oko 48 dp;
- cluster može biti nešto širi/veći kada broj zahteva prostor.

Ovo nisu finalne pixel vrednosti.
Princip je zaključan:
**zoom ne rešavamo rastom pina, nego clusteringom.**

## 14.7 Daleki zoom

Kada je korisnik udaljen:
- individualni pinovi se grupišu;
- mapa ostaje čista;
- korisnik vidi distribuciju, ne šumu markera.

Na nivou cele Srbije očekujemo više cluster-a i vrlo malo pojedinačnih task pinova.

## 14.8 Srednji zoom

Kako se približava gradu:
- veliki clusteri se razbijaju;
- pojavljuju se manji clusteri;
- zatim PLACE i TASK pinovi.

Prelaz treba da bude prirodan, bez naglog „eksplodiranja“ stotina markera.

## 14.9 Bliski zoom

Na nivou kvarta/ulice:
- zadaci koji imaju različite javne tačke dobijaju zasebne pinove;
- zadaci na potpuno istoj javnoj tački ostaju PLACE pin sa brojem.

Ne izmišljamo lažne pomerene pozicije samo da bi se pinovi razdvojili.

## 14.10 Preklapanje pinova

Prioritet prikaza:

1. SELECTED
2. konkretan TASK
3. PLACE
4. CLUSTER

Selected je uvek iznad.

Ako se dva obična elementa vizuelno preklapaju:
- mapa može sakriti niži prioritet;
- korisnik ih dobija pri promeni zoom-a/položaja;
- ne pokušavamo da prikažemo sve po svaku cenu.

Cilj je čitljiva mapa, ne maksimalan broj simbola.

## 14.11 Tap zona

Vizuelni pin može biti mali, ali prst ne sme da mora da pogodi 28 px precizno.

Touch target mora biti veći od samog crteža.

Aktuelni kod već koristi proširenu hit zonu oko server markera.
To treba sačuvati.

## 14.12 Pin i donja lista

Mapa i lista moraju ostati sinhronizovane.

Tap TASK pina:
- selected pin;
- task preview.

Tap PLACE pina:
- selected PLACE;
- carousel.

Tap cluster:
- zoom;
- bez preview kartice.

Tap prazne mape dok je TASK/PLACE selected:
- zatvara preview;
- vraća prethodni PEEK/HALF/FULL položaj liste.

## 14.13 Povratak iz detail-a

Scenario:
Mapa → PLACE sa 3 zadatka → korisnik je na kartici 2 od 3 → otvori detail.

Back treba da vrati:
- isti centar;
- isti zoom;
- isti PLACE selected;
- isti carousel indeks `2 od 3`;
- prethodni položaj mape/list scene.

Ako task 2 više nije dostupan:
- vraća se isto PLACE mesto;
- prikazuje se najbliži preostali član;
- ako više nema nijednog, preview se zatvara.

## 14.14 Refresh dok je PLACE carousel otvoren

Novi podaci ne smeju da istrgnu korisniku karticu iz ruke.

Ako se lista članova promeni:
- isti task ostaje aktivan ako još postoji;
- njegov indeks se može promeniti samo numerički, ne vizuelno skokom na drugi task;
- ako je uklonjen, bira se sledeći ili prethodni preostali član;
- ako nema članova, preview se zatvara.

## 14.15 Odnos korisnika prema tasku ne kodiramo na pin

Pin ne treba dodatno da objašnjava:
- Vaš;
- Prijava poslata;
- Dogovoreno.

To se vidi na kartici/detailu.

Razlog:
mapa bi brzo postala zbir obojenih statusnih varijanti koje korisnik mora da uči.

Pin govori gde je posao.
Kartica govori šta je posao i kakav je moj odnos prema njemu.

## 14.16 Lokalni zadaci bez upotrebljive javne tačke

Glavno pravilo:
**ne mešamo ih u broj i listu koji tvrde da predstavljaju ono što je na mapi.**

Dakle:
- lokalni map broj = samo taskovi koji pripadaju map prikazu;
- donja map lista = isti map scope;
- ne prikazujemo badge/poruku „N zadataka nisu na mapi“ u glavnom Discovery prikazu.

Ako proizvod kasnije želi poseban način da se pregledaju lokalni zadaci bez tačke, to mora biti zasebno jasno osmišljeno.
Ne ubacujemo ih krišom u map-listu.

## 14.17 Remote zadaci

Remote nema pin.

Remote nema cluster.

Remote nema PLACE.

Kapsula sa globusom `Na daljinu` prelazi na punu remote listu.

Povratak na `Na lokaciji` vraća map scene stanje.

## 14.18 Motion pinova

Motion mora samo da objasni promenu.

Dozvoljeno:
- mali scale/halo kada pin postane selected;
- kratko, kontrolisano približavanje na cluster;
- prirodna promena cluster → pin kada zoom završi.

Ne:
- stalno pulsiranje;
- bouncing;
- dekorativno lebdenje;
- animacija svakog pina pri svakom malom pan-u.

Reduced Motion:
- state se menja odmah ili sa minimalnim fade-om.

## 14.19 Šta zadržavamo iz aktuelnog koda

Dobar temelj koji treba sačuvati:
- server razlikuje TASK / PLACE / CLUSTER;
- selected marker je odvojen iznad ostalih;
- selected je samo malo veći;
- postoji prošireni hitbox;
- PLACE zna tačan broj taskova;
- cluster nosi bounds svojih članova;
- map marker limit je kontrolisan;
- pinovi su native map layer, ne teške React kartice na mapi.

## 14.20 Šta menjamo u odnosu na trenutni prikaz

1. selected TASK pin više ne dobija cenu ispod sebe;
2. PLACE i CLUSTER moraju vizuelno jasnije da se razlikuju;
3. PLACE tap vodi na carousel, ne na zoom;
4. cluster tap vodi na zoom, ne na card;
5. odnos korisnika prema tasku se ne kodira u pin;
6. lokalni broj/lista ne pominju point-free/remote taskove;
7. pin ostaje veoma jednostavan, dok informativna težina prelazi na karticu.

## 14.21 Šta još nije finalno

Vizuelni pass tek treba da odluči:
- tačan oblik TASK pina;
- da li osnovni znak stoji u krugu, kapsuli ili stilizovanom markeru;
- tačan oblik PLACE pina;
- tačan cluster oblik;
- boju selected halo-a;
- precizne dp dimenzije;
- shadow/edge;
- da li pin koristi puni USKOČI znak ili pojednostavljeni U znak.

Ali funkcionalna semantika ovog poglavlja je sada radni kanon.
# 15. TASK PREVIEW SA MAPE

Tap na TASK pin:
- selected pin;
- lista se skloni;
- floating task preview izlazi odozdo.

Cela preview kartica je klikabilna.

**Nema dugmeta “Pogledaj zadatak”.**

Tap kartice → detalj zadatka.

---

# 16. TASK CARD SYSTEM — FUNKCIONALNA ANATOMIJA

Ovo je sada zaključani prvi product pass kartica. Finalni font, senka, radius, boja i pixel dimenzije još nisu zaključani.

Cilj kartice nije da prepriča ceo zadatak.
Cilj je da korisnik za 1–2 sekunde odluči:
- da li me posao zanima;
- da li mi odgovaraju cena, vreme i mesto;
- da li ima smisla da otvorim detalj.

## 16.1 Princip: mala kartica ne sme da bude mini-detail

Sa dense Discovery kartice uklanjamo:
- avatar requestera;
- ime requestera;
- ocenu requestera;
- starost objave;
- alat;
- vozilo;
- listu uslova;
- broj drugih prijavljenih;
- duga objašnjenja statusa;
- CTA „Pogledaj zadatak“.

Sve navedeno što je zaista relevantno može da postoji na detalju.

Cela kartica je jedan tap target:
**tap kartice → detalj zadatka**.

## 16.2 Worker local list card — osnovna anatomija

Redosled:

1. opcioni mali odnos prema zadatku;
2. naslov;
3. cena;
4. vreme + mesto/udaljenost;
5. diskretan kapacitet, samo kada ima smisla.

Radna kompozicija:

┌────────────────────────────────────┐
│ [opciono: Prijava poslata]         │
│                                    │
│ Selidba stana                      │
│                                    │
│ 4.000 RSD / osoba                  │
│ Danas 17–19 · Liman · oko 2 km     │
│                                👥2/6│
└────────────────────────────────────┘

Nije obavezno da svaka kartica ima svih pet redova.
Ako nema odnosa prema zadatku, prvi red ne postoji.
Ako treba jedna osoba, kapacitet se ne prikazuje.

## 16.3 Naslov

- najviše 2 vizuelne linije u dense listi;
- ne skraćivati agresivno na jednu liniju;
- ne smanjivati font samo zato što je naslov dug;
- cena ne sme da gura naslov u nečitljivu usku kolonu;
- ako naslov zauzme dve linije, ostali elementi idu normalno ispod.

Naslov je primarni identitet kartice.

## 16.4 Cena

Za worker-a je primarni uporedivi prikaz cena po osobi.

Primer:
- requester postavi 12.000 RSD ukupno za 3 osobe;
- worker kartica prikazuje **4.000 RSD / osoba**.

Ako je cena već po osobi:
- prikazuje se kako jeste.

Satnica:
- **1.200 RSD / sat / osoba**.

Ponude:
- umesto iznosa stoji **Traži ponude**.

Cena je drugi najjači element kartice posle naslova.

Ne prikazivati tehničku reč „Budžet“ iznad svake cene ako samo povećava visinu kartice.
Osnova cene mora biti jasna uz sam iznos.

## 16.5 Vreme + mesto

Local kartica prikazuje:
- termin;
- javno bezbedno mesto;
- udaljenost ako je stvarno dostupna.

Radni oblik:
**Danas 17–19 · Liman · oko 2 km**

Ako ne stane lepo:
- vreme i mesto se prelamaju u dve mirne meta-linije;
- ne smanjujemo font do nečitljivosti.

Ne prikazuje se puna adresa.

## 16.6 Kapacitet

Kapacitet je diskretan element pri dnu/desno.

Primeri:
- `👥 0/4`
- `👥 2/6`
- `👥 1/3`

Značenje:
**izabrano / ukupno potrebno**.

Pravila:
- `0/1` se ne prikazuje na običnoj worker kartici;
- kod više potrebnih ljudi prikazuje se i kada je `0/N`, jer govori da je ovo grupni zadatak;
- puni kapacitet može da se prikaže samo u kontekstu gde kartica i dalje postoji zbog odnosa korisnika ili istorije;
- accessibility tekst objašnjava punim rečima šta broj znači.

Kapacitet nije veliki status pill.
To je mali sekundarni pokazatelj.

## 16.7 Odnos korisnika prema zadatku

Ako nema posebnog odnosa:
- ništa se ne prikazuje.

Ako je zadatak moj:
- mali `Vaš zadatak` / kraće `Tvoj`, zavisno od finalnog vizuelnog testa.

Ako je prijava poslata:
- mali `Prijava poslata`.

Ako je prijava već dovela do Dogovora:
- kartica treba da kaže `Dogovoreno` ili drugi jasan izraz, a ne da ostane na generičkom „Prijava poslata“.

Aktuelni relation model već zna da li postoji povezani Dogovor (`agreementId`), pa finalni UI treba da iskoristi tu razliku.

Ako odnos trenutno nije moguće proveriti:
- dense karticu ne zatrpavamo tehničkim upozorenjem tipa „Vaš status nije potvrđen“;
- browsing ostaje miran;
- detalj/CTA rešava bezbedno ponovno proveravanje pre radnje.

Radni položaj markera:
- u donjoj levoj zoni kartice;
- kapacitet ostaje desno.

Primer:

┌────────────────────────────────────┐
│ Selidba stana                      │
│ 4.000 RSD / osoba                  │
│ Danas 17–19 · Liman                │
│                                    │
│ Prijava poslata                👥2/6│
└────────────────────────────────────┘

Tačan vizuelni tretman markera tek sledi.

## 16.8 Requester identitet na dense kartici

Zaključani smer:
**ne prikazujemo avatar, ime i ocenu requestera na maloj Discovery kartici.**

Razlozi:
- guši brzo listanje;
- task je primarna stvar koju korisnik bira;
- poverenje se procenjuje na detalju, jedan tap dalje;
- manje ponavljanja lica i sitnog teksta;
- kartica ostaje mirna i premium.

Na public Task detailu requester i reputacija ostaju važna sekcija.

## 16.9 Starost objave

`pre 2 dana`, `pre 3 sata` i slično ne ide na osnovnu dense karticu.

Može kasnije da se koristi:
- u sortiranju;
- u detailu;
- u specifičnom kontekstu gde je vreme objave stvarno relevantno.

Ne zauzima stalno mesto u kartici.

## 16.10 Tool / vehicle / requirements

Ne prikazuju se na dense task kartici.

Ne pravimo:
- „Kombi“
- „Aku bušilica“
- druge tehničke fact redove

samo zato što postoje u modelu.

Ako je uslov presudan za posao:
- treba da bude razumljiv iz opisa/detalja;
- AI može interno da ga strukturira;
- matcher ga može koristiti;
- ali kartica ostaje laka.

## 16.11 Map selected preview card

Selected pin preview koristi isti vizuelni jezik kao dense kartica, ali ima malo više vazduha.

Ne dodajemo tehnički naslov:
**„ZADATAK NA MAPI“**.

Mapa je već očigledna.

Radni sadržaj:

╭────────────────────────────────────╮
│                              ×     │
│ Selidba stana                      │
│ 4.000 RSD / osoba                  │
│ Danas 17–19 · Liman · oko 2 km     │
│                                👥2/6│
╰────────────────────────────────────╯

Cela kartica → detail.

`×` samo zatvara preview.

Ne postoji posebno dugme „Pogledaj zadatak“.

## 16.12 PLACE preview — više zadataka na istoj lokaciji

Ista kartica dobija carousel kontekst.

Primer:

╭────────────────────────────────────╮
│                              ×     │
│ Selidba stana                      │
│ 4.000 RSD / osoba                  │
│ Danas · Liman                  👥2/6│
│                                    │
│             ● ○ ○                  │
│             1 od 3                 │
╰────────────────────────────────────╯

Swipe levo/desno menja task.

Pravila:
- indikator je diskretan;
- aktivna kartica je stabilna;
- cela kartica otvara baš aktivni task;
- ne prikazivati tri kartice istovremeno na malom telefonu;
- može se dozvoliti mali vizuelni „peek“ sledeće kartice samo ako finalni test pokaže da ne kvari širinu.

## 16.13 Remote list card

Remote lista koristi isti osnovni card sistem.

Pošto je ceo ekran već u režimu **Na daljinu**, ne ponavljamo „Na daljinu“ na svakoj kartici bez potrebe.

Primer:

┌────────────────────────────────────┐
│ Prevod prezentacije                │
│ 3.500 RSD / osoba                  │
│ Rok: petak do 18:00            👥1/3│
└────────────────────────────────────┘

Ako treba jedna osoba:
- nema `0/1`.

Ako je vremenska informacija „bilo kada“ ili fleksibilna:
- prikazuje se njen stvarni ljudski opis;
- ne izmišljamo datum.

## 16.14 Task sa ponudama

Isti prostor u kome inače stoji cena kaže:

**Traži ponude**

Primer:

┌────────────────────────────────────┐
│ Fotografisanje proizvoda           │
│ Traži ponude                       │
│ Ove nedelje · Novi Sad             │
└────────────────────────────────────┘

Ne crtamo „0 RSD“.
Ne crtamo izmišljenu procenu.

## 16.15 Owner task card

Owner card pripada istoj porodici, ali odgovara na druga pitanja.

Owner želi da zna:
- šta je trenutno stanje;
- koliko je ljudi izabrano;
- da li nešto čeka njegovu odluku;
- gde treba da tapne.

Radni primer bez prijava:

┌────────────────────────────────────┐
│ Objavljen                          │
│ Montaža polica                     │
│ 12.000 RSD ukupno                  │
│ Danas · Liman                      │
│ Još nema prijava                   │
└────────────────────────────────────┘

Sa prijavama:

┌────────────────────────────────────┐
│ Bira se · 3                        │
│ Selidba stana                      │
│ 12.000 RSD ukupno                  │
│ Danas · Liman                  👥0/3│
├────────────────────────────────────┤
│ Pogledaj prijave                   │
└────────────────────────────────────┘

Delimično popunjeno:

┌────────────────────────────────────┐
│ Dogovoreno · 2 od 3                │
│ Selidba stana                      │
│ 12.000 RSD ukupno                  │
│ Danas · Liman                  👥2/3│
└────────────────────────────────────┘

Owner vidi originalno značenje svoje cene:
- ukupno;
- po osobi;
- po satu;
- ponude.

Ne normalizujemo njegov sopstveni budžet samo zato što worker kartica koristi cenu po osobi za poređenje.

## 16.16 Kartica i velike veličine teksta

Kartica mora da preživi veliki sistemski font.

Prioritet:
1. naslov ostaje čitljiv;
2. cena se ne seče;
3. termin/mesto se prelama;
4. sekundarni marker i kapacitet mogu preći u novi red.

Ne:
- smanjivati font;
- skrivati ključne činjenice;
- forsirati fiksnu visinu koja seče tekst.

## 16.17 Tap ponašanje

Worker dense card:
tap → public Task detail.

Selected map preview:
tap → public Task detail.

Remote card:
tap → public Task detail.

Owner card:
tap tela → owner Task detail.

Ako owner card ima zaseban action foot „Pogledaj prijave“:
- samo taj foot vodi direktno na Candidates;
- ostatak kartice i dalje vodi na Task detail.

## 16.18 Šta još nije finalno u Task Card System-u

Još treba vizuelno odlučiti:
- tačan radius;
- tačna senka;
- visina i unutrašnji padding;
- da li meta red koristi male ikonice ili samo tekst + separatore;
- tačan izgled `👥 2/6`;
- tačan stil `Vaš / Prijava poslata / Dogovoreno`;
- da li selected map card ima mali side-peek sledeće kartice;
- precizna tipografska skala.

Ali informaciona hijerarhija iz ovog poglavlja je sada radni kanon.
# 17. JAVNI BROJ PRIJAVA

Zaključano:

**worker ne vidi broj drugih prijavljenih na zadatak.**

To nije informacija potrebna za njegovu odluku i može da stvori loš herd effect.

Requester vidi:
- ukupan broj prijava;
- broj prijava koje još mogu da se izaberu, kada server daje taj podatak.

---

# 18. HITNO

Zaključano za MVP:

**HITNO se ne prikazuje i ne koristi kao Discovery režim.**

Backend može da zadrži postojeću infrastrukturu, ali finalni MVP UX ga ne uvodi dok se posebno ne osmisle:
- poslovno pravilo;
- trajanje;
- cena;
- dispatch;
- kategorije;
- ponašanje.

---

# 19. ALATI I VOZILA

Vlasnička odluka za MVP:

**ne prikazujemo niti posebno pominjemo alate i vozila kao obavezne UI činjenice zadatka.**

Ako je nešto bitno za posao, korisnik ga može opisati prirodno u tekstu zadatka.

Interni model može kasnije da koristi strukturirane podatke, ali baza ne diktira UI.

---

# 20. SEARCH + FILTERI — RADNI SMER

Još nije finalno vizuelno zaključano.

## 20.1 Pretraga
Treba omogućiti:
- tekstualnu pretragu;
- grad/područje;
- remote;
- nedavne pretrage.

Izbor grada treba da pomeri mapu na taj grad.

## 20.2 Quick kapsule
Radni smer:
- Na lokaciji;
- Na daljinu;
- Za mene;
- Danas;
- Ovaj vikend;
- Sa cenom.

Ne prikazivati sve kriterijume kao kapsule.

## 20.3 Full filteri
Treba da odgovore na ljudska pitanja:
- Gde?
- Kada?
- Koliko se plaća?
- Koliko ljudi?
- Za mene?

Tačan finalni filter UI još nije zaključan.

---

# 21. PUBLIC TASK DETAIL — FUNKCIONALNI SADRŽAJ

Finalni vizuelni raspored još nije zaključan, ali sadržaj je uglavnom jasan.

Treba da bude čist i kratak.

Redosled radnog smera:
1. naziv;
2. cena po osobi;
3. vreme;
4. približna lokacija/udaljenost ili “Na daljinu”;
5. multi-person kapacitet ako je relevantan;
6. opis;
7. fotografije ako postoje;
8. requester i reputacija;
9. pitanja i odgovori;
10. približna mapa samo za lokalni task;
11. CTA za prijavu.

Ne prikazivati:
- broj drugih prijava;
- HITNO;
- alate/vozila kao posebne tehničke sekcije;
- internu logiku;
- punu adresu;
- privatni kontakt.

Remote detail:
- nema mape;
- nema prazne Mesto sekcije.

---

# 22. OWNER TASK DETAIL — FUNKCIONALNI SMER

Owner ne treba istu informaciju kao worker.

Glavni fokus:
- trenutno stanje;
- broj prijava;
- broj popunjenih mesta;
- sledeća akcija;
- povezani Dogovori.

Primeri:

## 22.1 Nema prijava
Objavljen
Još nema prijava.

## 22.2 Ima prijava
Bira se · 3
3 prijave čekaju odluku.
CTA: Pogledajte prijave.

## 22.3 Delimično popunjen
Dogovoreno · 2 od 3
Potrebna je još jedna osoba.

## 22.4 Preostala potraga zatvorena
2 od 3 dogovoreno
Preostala potraga je zatvorena.

Ako server dozvoljava:
Ponovo otvorite potragu.

## 22.5 Sva mesta popunjena
3/3
Primarno: Otvori Dogovore.

---

# 23. LIFECYCLE AKCIJE ZADATKA

## Nacrt
Obriši nacrt.

## Objavljen bez potvrđenih ljudi
Otkaži zadatak.

## Delimično popunjen
Ne nuditi “otkaži zadatak” kao prečicu preko postojećih Dogovora.

Može:
Zatvori preostalu potragu.

## Ponovno otvaranje
Kada server dozvoli:
Ponovo otvori potragu za preostalim mestima.

Postojeći Dogovori ostaju nepromenjeni.

---

# 24. Q&A

Pitanja pripadaju konkretnom zadatku.

Svrha:
dopuna informacija pre prijave/izbora.

Ne praviti community forum.

Pre Dogovora identitet osobe koja postavlja pitanje nije javno eksponiran kao društveni element.

---

# 25. FOTOGRAFIJE

Prva verzija koristi ograničen broj fotografija.

Ako fotografija nema:
- ne prikazuje se prazna galerija na public detailu.

Ako ih ima:
- lep grid/carousel;
- tap otvara pregled.

Fotografije su pomoć pri razumevanju zadatka, ne dekoracija.

---

# 26. ERROR / STALE / LOADING PRINCIPI

USKOČI ne sme da prazni ekran bez potrebe.

Ako poslednji uspešan prikaz postoji:
- ostaje na ekranu;
- diskretno se kaže da nije osvežen.

Map error:
- lista može ostati dostupna.

List error:
- mapa i poslednji rezultati mogu ostati.

Povratak iz task detaila:
- mapa, zoom, selected state i list pozicija treba da ostanu koliko god je moguće.

---

> **SUPERSEDED kao vremenska ocena.** Vizuelni smer je sada odlučen u B, a kompozicije u D; pixel-final je i dalje J: NOT YET.

# 27. VIZUELNI PRAVAC — JOŠ NIJE FINALAN

Radni smer:
- premium white / vrlo svetao canvas;
- mirna hijerarhija;
- bele površine;
- mekane senke;
- veliki ali kontrolisani radius;
- duboko zelen primarni action ton;
- narandžasti karakteristični akcenat;
- 2D semantičke ikonice u funkcionalnim površinama;
- 2.5D ilustracije samo za hero/empty/success trenutke;
- bez generičkog AI izgleda;
- bez gradient preopterećenja;
- bez “card around everything”.

Finalni font, dimenzije, radius, shadow, icon set i motion još nisu zaključani.

---

# 28. ŠTA JE SADA SLEDEĆE

Ne prelazimo još na Application + Selection.

Sledeća aktivna faza unutar TASK + DISCOVERY je:

## KORAK 1 — TASK CARD SYSTEM
**Funkcionalna anatomija završena.**
Sledeći put kada se vratimo na karticu radićemo njen vizuelni pass, ne ponovo osnovnu logiku.

## KORAK 2 — PIN SYSTEM
**Funkcionalna anatomija završena.**
Vizuelni oblik pinova ide u Discovery visual pass-u.

## KORAK 3 — 6 KLJUČNIH DISCOVERY KOMPOZICIJA
**Kompozicioni pass završen.**
PEEK, HALF, FULL, Selected PLACE + carousel, Remote lista i Public Task detail imaju definisan raspored i ponašanje.

## KORAK 4 — DISCOVERY VISUAL PASS
**Radni vizuelni kanon definisan.**
Finalne vrednosti sada treba proveriti na stvarnom vizuelnom prototipu šest kompozicija, umesto daljom teorijom.

## KORAK 5 — APPLICATION + SELECTION
Tek tada prelazimo na sledeći domen.

---

> **ISTORIJSKI BACKLOG.** Za zaista otvorene product odluke koristite G. Stavka ne ostaje otvorena samo zato što se ovde pominjala pre kasnijeg zatvaranja.

# 29. OTVORENE ODLUKE KOJE SE NE SMEJU TIHO IZMIŠLJATI

1. Konačna task-card anatomija.
2. Da li requester i njegova ocena idu na dense karticu.
3. Tačan izgled multi-seat `2/6`.
4. Tačan Search/Filter top chrome.
5. Finalni min-budget UX za satnicu.
6. Da li i kada uvodimo više valuta.
7. Finalni vizuelni crtež pinova (funkcionalna semantika je zaključana).
8. Finalni font/motion/iconografija.

Sve ove odluke se donose kroz sledeće korake i dopisuju u ovaj isti Master.

---


# 31. DISCOVERY — 6 KLJUČNIH KOMPOZICIJA

Ovo nije finalni visual design.
Ovo je kompozicioni pass: gde šta stoji i kako se ekran menja između najvažnijih stanja.

Cilj je da svih šest prikaza deluju kao ISTI proizvod.

---

## 31.1 KOMPOZICIJA A — MAPA / PEEK

### Šta korisnik treba da oseti
„Vidim gde ima poslova oko mene i mogu jednim potezom da podignem listu.“

### Raspored

[status bar]

16–20 dp vazduha

╭────────────────────────────────────╮
│ 🔍  Šta tražite?             [filter]│
│     Novi Sad                       │
╰────────────────────────────────────╯

8–10 dp

[📍 Na lokaciji] [🌐 Na daljinu] [Za mene] [Danas] ...

                 MAPA

       task pin          place 3
                 cluster 8

                         [moja lokacija]

╭────────────────────────────────────╮
│               ━━                   │
│             12 zadataka            │
╰────────────────────────────────────╯

[Početna] [Zadaci] [Dogovori] [Poruke]

### Pravila
- mapa zauzima najveći deo ekrana;
- search/filter zona je floating;
- kapsule su horizontalne i mogu da se skroluju;
- PEEK je jedna zaobljena bela površina, ne obična ravna traka;
- broj „12 zadataka“ govori samo o trenutnom lokalnom map scope-u;
- nema „N zadataka nisu na mapi“;
- remote zadaci ne ulaze u broj.

### Gestovi
- tap PEEK zaglavlja → HALF;
- swipe gore → HALF;
- tap pin → selected preview;
- pan/zoom mape → nakon smirivanja lista se tiho prilagođava;
- tap Na daljinu → Remote kompozicija.

---

## 31.2 KOMPOZICIJA B — MAPA / HALF

### Šta korisnik treba da oseti
„Mogu istovremeno da razumem prostor i da listam zadatke.“

### Raspored

[search/filter]
[quick kapsule]

             MAPA
       ●             [4]
             ●
                    [moja lokacija]

╭────────────────────────────────────╮
│               ━━                   │
│             12 zadataka            │
│                                    │
│  Selidba stana                     │
│  4.000 RSD / osoba                 │
│  Danas 17–19 · Liman · oko 2 km    │
│                                👥2/6│
│                                    │
│  Montaža televizora                │
│  3.500 RSD / osoba                 │
│  Sutra · Grbavica                  │
│                                    │
│  ...                               │
╰────────────────────────────────────╯

[bottom navigation]

### Pravila
- sheet ima mekano zaobljen vrh;
- karta i lista su jedan kontinuirani ekran;
- kartice imaju dovoljno razmaka da ne deluju kao tabela;
- nema nepotrebnih divider linija između svake činjenice;
- lista pokazuje samo taskove koji pripadaju trenutnom map području;
- karta ne skače dok korisnik samo skroluje listu.

### Gestovi
- swipe sheet gore → FULL;
- swipe sheet dole → PEEK;
- tap kartice → Task detail;
- tap novog pina na vidljivom delu mape → Selected preview.

---

## 31.3 KOMPOZICIJA C — MAPA / FULL

### Šta korisnik treba da oseti
„Sada samo želim da pregledam poslove, ali i dalje sam u istom map kontekstu.“

### Raspored

[search/filter]
[quick kapsule]

╭────────────────────────────────────╮
│               ━━                   │
│             12 zadataka            │
│                                    │
│  Selidba stana                     │
│  4.000 RSD / osoba                 │
│  Danas 17–19 · Liman · oko 2 km    │
│                                👥2/6│
│                                    │
│  Montaža televizora                │
│  3.500 RSD / osoba                 │
│  Sutra · Grbavica                  │
│                                    │
│  Dostava paketa                    │
│  Traži ponude                      │
│  Petak · Centar                    │
│                                    │
│  ...                               │
╰────────────────────────────────────╯

[bottom navigation]

### Pravila
- FULL nije novi ekran;
- mapa ostaje iza scene i čuva svoj centar/zoom;
- vrh sheet-a ostaje zaobljen i vizuelno prepoznatljiv;
- sheet staje direktno ispod search/filter zone;
- ne ostavljamo beskoristan tanak komad mape između gornjih kontrola i liste;
- search i filteri su i dalje dostupni.

### Povratak
- drag naniže → HALF / PEEK;
- mapa se vraća tačno gde je bila;
- list scroll se čuva koliko god je moguće.

---

## 31.4 KOMPOZICIJA D — SELECTED PLACE + CAROUSEL

### Scenario
Tri zadatka dele isto približno mesto.

### Šta korisnik treba da oseti
„Na ovom mestu ima više poslova; mogu da ih prelistam bez izlaska sa mape.“

### Raspored

[search/filter]

              MAPA

                 [U 3]
                selected

         ostali pinovi ostaju mirni

╭────────────────────────────────────╮
│                               ×    │
│ Selidba stana                      │
│ 4.000 RSD / osoba                  │
│ Danas · Liman · oko 2 km       👥2/6│
│                                    │
│              ● ○ ○                 │
│              1 od 3                │
╰────────────────────────────────────╯

### Šta se privremeno sklanja
- quick kapsule mogu da se povuku dok preview stoji, da mapa ne postane pretrpana;
- donji list sheet se spušta iza preview-a;
- bottom navigation može privremeno da se skloni ako je potrebno da preview dobije čist donji prostor.

### Gestovi
- swipe levo/desno → drugi task na istom mestu;
- tap kartice → detail aktivnog taska;
- tap × ili praznu mapu → zatvara preview i vraća prethodni sheet položaj;
- tap drugi TASK/PLACE pin → preview se prebacuje na njega;
- tap cluster → zatvara preview i zoomira.

### Važno
Nema:
- „Pogledaj zadatak“ dugmeta;
- cene na pinu;
- tri male kartice istovremeno;
- lažnog pomeranja pinova oko iste tačke.

---

## 31.5 KOMPOZICIJA E — NA DALJINU / PUNA LISTA

### Šta korisnik treba da oseti
„Sada gledam samo poslove koje mogu da radim bez odlaska na lokaciju.“

### Raspored

[status bar]

╭────────────────────────────────────╮
│ 🔍  Šta tražite?             [filter]│
╰────────────────────────────────────╯

[📍 Na lokaciji] [✓ 🌐 Na daljinu] [Za mene] [Danas] ...

28 zadataka

┌────────────────────────────────────┐
│ Prevod prezentacije                │
│ 3.500 RSD / osoba                  │
│ Rok: petak do 18:00            👥1/3│
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ Obrada fotografija                 │
│ 5.000 RSD / osoba                  │
│ Ove nedelje                        │
└────────────────────────────────────┘

...

[bottom navigation]

### Pravila
- nema mape;
- nema PEEK/HALF/FULL;
- nema handle-a;
- nema prazne bele površine iza liste;
- lista je normalan sadržaj ekrana;
- ne ponavljamo „Na daljinu“ na svakoj kartici ako aktivna kapsula već jasno govori kontekst;
- remote task nema red za lokaciju.

### Povratak na Na lokaciji
- vraća prethodni map centar;
- zoom;
- map sheet položaj;
- cache;
- selected stanje ako je još smisleno.

---

## 31.6 KOMPOZICIJA F — PUBLIC TASK DETAIL

### Šta korisnik treba da oseti
„Za nekoliko sekundi razumem posao i mogu da odlučim da li želim da se prijavim.“

### Raspored

[←]                              [⋯]

Montaža zidnih polica

4.000 RSD / osoba

Danas · 17:00–19:00
Liman · oko 2 km                       👥2/3

O ZADATKU
Potrebno montirati tri zidne police u dnevnoj sobi.
Zid je betonski. Police su već kupljene.

[FOTOGRAFIJE — samo ako postoje]

NARUČILAC
[avatar] Ana M.
★ 4,9 · 23 ocene
[red se tapne → javni profil]

PITANJA
Da li postoji parking u dvorištu?
Da.

[Postavite pitanje]

MESTO
[približna mapa]
Tačna adresa se deli tek kada nastane Dogovor.

--------------------------------------
[        Pošaljite prijavu          ]

### Pravila
- detail nije formular;
- nema broja drugih prijavljenih;
- nema HITNO u MVP-u;
- nema posebnih tehničkih blokova za alat/vozilo;
- nema pune adrese pre Dogovora;
- nema kontakta;
- nema internog matcher score-a;
- nema suvišnog „status dashboarda“.

### Remote varijanta
Kod remote taska:
- nema Mesto sekcije;
- nema mape;
- činjenica „Na daljinu“ stoji uz vreme/način rada;
- ostatak strukture ostaje isti.

---

# 32. DISCOVERY KOMPOZICIONA PRAVILA

## 32.1 Jedan ekran, jedan dominantan zadatak

PEEK:
dominantna je mapa.

HALF:
mapa i lista su ravnopravne.

FULL:
dominantna je lista.

Selected:
dominantni su pin + jedna preview kartica.

Remote:
dominantna je lista.

Detail:
dominantan je konkretan zadatak.

Ne pokušavamo da sve bude jednako glasno u svakom stanju.

## 32.2 Search/filter zona je stabilan orijentir

Korisnik ne treba da uči novi vrh ekrana kada prelazi:
PEEK → HALF → FULL.

Kod remote prikaza zadržavamo isti jezik pretrage/filtera, ali bez mape ispod.

## 32.3 Zaobljenja

Radni smer:
- map sheet ima jasno zaobljen gornji rub;
- preview kartica je zasebna floating površina;
- dense task kartica je mekša i jednostavnija;
- full list ne postaje potpuno ravna administrativna tabela.

Tačan radius tek ide u visual pass.

## 32.4 Bela površina nije problem sama po sebi

Problem je kada beli prostor nema funkciju.

Na map prikazu:
bela površina = list sheet.

Na remote prikazu:
cela stranica je normalna list površina.

Ne pravimo „sheet preko belog“ samo zato što isti component postoji u drugom režimu.

## 32.5 Motion

Transition između PEEK/HALF/FULL:
- spring/drag prati prst;
- bez overshoot-a;
- bez bounce-a.

Selected pin:
- mali scale + halo.

Preview:
- ulazi iz donje zone kratko i mirno.

Remote ↔ Local:
- kratka promena scene;
- map state se ne resetuje.

Cluster:
- kamera animirano približava bounds.

Sve mora poštovati Reduce Motion.

---

# 33. STATUS DISCOVERY DOMENA POSLE OVOG PASS-A

Funkcionalno su sada obrađeni:

- Task lifecycle;
- Search state;
- Capacity;
- Price semantics;
- Local vs Remote;
- Map/List PEEK-HALF-FULL;
- Spatial cache zahtev;
- Task Card System;
- Pin System;
- PLACE carousel;
- Cluster ponašanje;
- Public detail sadržaj;
- Owner detail logika;
- Q&A;
- Photos;
- Location privacy;
- Error/stale ponašanje;
- 6 ključnih kompozicija.

Još NIJE finalno zaključano:

- tačan visual design;
- font;
- finalni spacing;
- radius;
- shadow;
- tačan icon family;
- tačan crtež pinova;
- finalna boja selected stanja;
- micro-motion vrednosti;
- finalni izgled filter panela;
- finalni izgled Search ekrana.

Sledeći korak u Discovery-ju je:
**napraviti prvi stvarni vizuelni prototip šest zaključanih kompozicija prema ovom Masteru**, pa ga pregledati na nivou telefona pre Application + Selection.


# 34. DISCOVERY VISUAL SYSTEM — RADNI KANON

Ovo je prvi zajednički vizuelni sistem za šest zaključanih Discovery kompozicija.
Još nije pixel-perfect final, ali od sada novi Discovery elementi treba da prate ova pravila dok ih realan prikaz na telefonu ne ospori.

---

## 34.1 Osnovni osećaj

Cilj:
**miran, čist, topao, premium, fizički razumljiv interfejs.**

Ne:
- generički AI dashboard;
- gradijenti svuda;
- velike 3D ikonice na svakoj kartici;
- status badževi na svakoj činjenici;
- siva administrativna tabela;
- previše zelenog teksta.

USKOČI treba da deluje:
- ljudski;
- lako;
- pouzdano;
- savremeno;
- dovoljno karakteristično da nije kopija Airbnb-a.

---

## 34.2 Tipografija

Radni smer:
**zadržavamo Inter kao osnovni UI font.**

Razlog:
- već je ugrađen u aktuelni sistem;
- čist je i neutralan;
- odgovara i gustim listama i detaljnim ekranima;
- nema dovoljno jak razlog da sada uvodimo novi font samo radi promene.

Promena fonta ostaje dozvoljena samo ako pravi vizuelni prototip pokaže jasan problem.

### Radna hijerarhija

Task card naslov:
- približno 18–20;
- semibold;
- maksimalno 2 linije.

Cena na kartici:
- približno 20–23;
- bold/semibold;
- tabularni brojevi;
- boja osnovnog teksta, ne zelena.

Meta činjenice:
- približno 14;
- mirnija boja;
- dovoljno čitljive za brzo skeniranje.

Detail naslov:
- približno 28–30;
- semibold.

Section naslov:
- približno 18;
- semibold.

Ne smanjujemo tekst da bismo ga „ugurali“.
Layout se prilagođava tekstu.

---

## 34.3 Canvas i površine

### Lokalna mapa
Mapa je stvarna pozadina.
Preko nje:
- search/filter float;
- kapsule;
- list sheet;
- selected preview.

### Remote puna lista
Radni smer:
- vrlo svetla neutralna / topla podloga;
- bele task kartice.

Time kartice imaju dubinu bez jake senke.

### Detail
Čist svetao canvas.
Ne pravimo svaku sekciju posebnom karticom.
Većina sadržaja je otvoren tekst sa prostorom između sekcija.

---

## 34.4 Radius sistem

Postojeći radius sistem je dobar osnov.

Radni smer:

- mala kapsula / filter: pill;
- task kartica: oko 20–24;
- selected map preview: oko 24–28;
- map list sheet: oko 28 na gornjim uglovima;
- glavni CTA: oko 12–14, ne mora da bude ogromna kapsula;
- fotografije: oko 16–20.

Važno:
sve ne sme imati isti radius.

Mala kontrola, task kartica i veliki sheet treba da imaju različitu vizuelnu težinu.

---

## 34.5 Senke

Senka služi da objasni sloj.

### Task kartica
Veoma blaga:
- kratka prva senka;
- šira, skoro nevidljiva druga.

Kartica treba da izgleda kao da je malo podignuta, ne da lebdi 2 cm iznad telefona.

### Search/filter
Malo više od task kartice jer stvarno lebdi preko mape.

### Map sheet
Upward shadow samo uz gornju ivicu.

### Selected preview
Može imati najjaču od Discovery senki jer je privremena površina iznad mape.

Ne koristiti jaku senku na svakoj unutrašnjoj sekciji.

---

## 34.6 Boje

Postojeći brand smer ostaje dobar:

- duboka zelena = glavna brand/action boja;
- narandžasta = karakterističan akcenat;
- tamno zeleno-crni ink = tekst i cena;
- svetlo zelena = odabrano/pozitivno;
- svetle neutralne = podloge i kontrole.

### Cena
Cena ostaje tamna/ink.
Ne bojimo je zeleno samo zato što je važna.

### Narandžasta
Koristi se selektivno:
- selected map fokus;
- specifičan brand akcenat;
- pažnja kada semantika to stvarno zahteva.

Ne bojimo ceo interfejs narandžasto-zeleno.

---

## 34.7 Ikonice — tri nivoa

### A. Sistemske 2D ikonice
Koristimo Phosphor-style funkcionalne simbole:
- back;
- close;
- search;
- filters;
- more;
- location;
- remote;
- people;
- calendar;
- send.

Ove ikonice su ravne i jasne.

### B. Semantičke male ikonice
Na task kartici:
- lokacija;
- remote/globus;
- ljudi;
- eventualno kalendar ako kompozicija to traži.

Ne moramo staviti ikonicu pored svake činjenice.
Ako jedan meta-red bolje čita bez njih, koristimo tekst + separatore.

### C. 2.5D ilustracije
Ne idu u dense Discovery kartice niti u pinove.

Koriste se kasnije za:
- Home hero;
- empty state;
- success;
- onboarding;
- veliki intent moment.

Tako 2.5D ostaje poseban i kvalitetan, umesto da izgleda kao set emoji-ja.

---

## 34.8 Search + Filter vizuelni smer

Jedna glavna floating bela površina preko mape.

Radna anatomija:

╭────────────────────────────────────╮
│ 🔍  Šta tražite?             [≡] 2 │
│     Novi Sad                       │
╰────────────────────────────────────╯

Glavni deo:
- search.

Desni deo:
- filter.

Ako postoje aktivni filteri:
- mali broj uz filter ikonu.

Ne:
- veliki naslov „FILTERI“ kao glavni sadržaj;
- dva odvojena velika bela dugmeta koja se takmiče.

Visina oko postojećih 56 dp je dobar polazni nivo.

---

## 34.9 Quick kapsule

Visina:
otprilike 36–40 vizuelno, uz pun touch target.

Inactive:
- bela;
- tanka neutralna ivica;
- vrlo blaga senka ili bez nje ako je map kontrast dovoljan.

Active:
- blaga zelena podloga;
- zelena ivica;
- check ili odgovarajuća ikona.

Remote:
`🌐 Na daljinu` je dopušten primer u dokumentu; u aplikaciji koristimo pravi 2D globe glyph, ne emoji.

Local:
može koristiti pin glyph ako finalna kompozicija ne postane previše ikonična.

Kapsule horizontalno skroluju.
Ne pokušavamo da sve stane u jedan red.

---

## 34.10 Task kartica — radni visual treatment

### Shape
- bela kartica;
- radius oko 20–24;
- blaga ivica;
- veoma meka senka;
- unutrašnji padding oko 16.

### Hijerarhija
1. naslov;
2. cena;
3. meta;
4. odnos levo / kapacitet desno, kada postoje.

Primer:

┌────────────────────────────────────┐
│ Selidba stana                      │
│                                    │
│ 4.000 RSD / osoba                  │
│ Danas 17–19 · Liman · oko 2 km     │
│                                    │
│ Prijava poslata                👥2/6│
└────────────────────────────────────┘

### Kapacitet
Ne mora biti pravi „badge“.
Radni smer:
- people glyph;
- `2/6`;
- muted/ink boja;
- mali, ali čitljiv.

### Status odnosa
Radni smer:
- tekst + mala ikonica ili mala tiha oznaka;
- ne veliki filled chip.

Na primer:
paper-plane glyph + `Prijava poslata`.

---

## 34.11 Owner task kartica

Ista porodica, ali status dobija malo veći prioritet.

Primer:

┌────────────────────────────────────┐
│ Bira se · 3                        │
│ Selidba stana                      │
│ 12.000 RSD ukupno                  │
│ Danas · Liman                  👥0/3│
├────────────────────────────────────┤
│ Pogledaj prijave                   │
└────────────────────────────────────┘

Status nije ogroman banner.

Foot postoji samo kada postoji jedna jasna sledeća akcija.

---

## 34.12 Map pin visual family — radni smer

### TASK
Radni smer:
- mala bela oznaka;
- jednostavan USKOČI/U znak u dubokoj zelenoj;
- tanka ivica;
- mala senka.

Ne klasični veliki „Google pin“ ako na testu deluje previše generički.

### PLACE
Ista porodica kao TASK, ali šira kapsula:

`[ U | 3 ]`

Korisnik odmah vidi:
- ovo je jedno mesto;
- na njemu su 3 taska.

### CLUSTER
Namerno drugačiji oblik:
- kompaktan puni krug ili jednostavan puni marker;
- broj u centru;
- bez U znaka.

Primer:
`[12]`

Tako PLACE i CLUSTER ne mogu da se zamene u glavi korisnika.

### SELECTED
Zadržava osnovni oblik:
- približno +6% scale;
- narandžasta/akcentna ivica ili halo;
- iznad svih ostalih.

Nema price labela ispod pina.

---

## 34.13 Map palette

Postojeća karta već ima dobar pravac:
- topao neutralan ground;
- bele ulice;
- žuti glavni putevi;
- zeleni parkovi;
- plava voda.

To je dobar kontrast za bele/zelene USKOČI markere.

Cilj nije da mapa izgleda dekorativno.
Ulice, kvartovi i mesta moraju ostati lako čitljivi.

---

## 34.14 PEEK/HALF/FULL material

### PEEK
- bela zaobljena površina;
- 28-ish radius na vrhu;
- mali centralni handle;
- `12 zadataka` kao jasna mirna linija.

### HALF
Isti sheet se samo podigne.
Ne nastaje nova kartica/panel.

### FULL
Isti sheet ide do vrha ispod search/kapsula.
Radius može ostati vidljiv.
Ne pretvara se u potpuno drugu stranicu.

Kada se sheet približi search zoni:
- shadows treba da se vizuelno smire;
- slojevi ne smeju izgledati kao tri bele kutije jedna na drugoj.

---

## 34.15 Selected preview material

Preview je zasebna detached površina.

Treba da deluje kao:
**„ovo je trenutno izabrani task“**.

Radni smer:
- radius oko 24–28;
- nešto jača senka od dense kartice;
- × gore desno;
- bez dodatnog CTA dugmeta;
- carousel indikator pri dnu ako je PLACE.

Ne dodajemo „ZADATAK NA MAPI“.

---

## 34.16 Remote list material

Remote ekran nema sheet.

Radni smer:
- svetla neutralna podloga;
- search/filter na vrhu;
- kapsule;
- mali count;
- task kartice.

Aktivna `Na daljinu` kapsula je dovoljan kontekst.
Ne pišemo „Na daljinu“ na svakoj kartici.

---

## 34.17 Public detail visual rhythm

Detail nije niz kartica.

Radni ritam:
- veliki naslov;
- dominantna cena;
- kompaktne činjenice;
- veliki razmak;
- opis;
- slike;
- requester;
- Q&A;
- mapa;
- sticky CTA.

Sekcije razdvaja:
- prostor;
- eventualno vrlo blaga hairline linija samo gde stvarno pomaže.

Ne razdvaja ih 7 sivih kartica.

---

## 34.18 Motion — koristimo ono što već dobro postoji

Postojeći motion sistem je dobar polazni kanon:

- tap kartice: veoma mali scale (~0.985);
- button press: malo jači;
- selection: oko 180 ms;
- content reveal: oko 240 ms;
- sheet: clamped spring bez bounce-a;
- camera: oko 360 ms;
- dialog enter: oko 200 ms.

### Discovery primena
PEEK/HALF/FULL:
- prati prst;
- clamped spring;
- bez overshoot-a.

TASK selected:
- 180 ms scale + halo.

Preview:
- 200–240 ms rise/fade.

PLACE carousel:
- direktno prati horizontalni swipe;
- ne dodajemo teatralnu animaciju.

Cluster:
- ~360 ms camera transition.

Remote ↔ Local:
- kratka content replacement tranzicija;
- bez resetovanja scene.

Reduce Motion:
- sve se smiruje na statičan prelaz.

---

## 34.19 Šta namerno NE koristimo u Discovery-ju

- velike 2.5D ilustracije na task karticama;
- gradient card backgrounds;
- glassmorphism;
- jarke obojene senke;
- lebdeće cene na svakom pinu;
- tri različita fonta;
- previše rounded pills;
- animirane pinove koji stalno pulsiraju;
- status boje bez teksta;
- AI robot na map ekranu.

---

## 34.20 Šta ostaje da se vizuelno testira na stvarnom telefonu

1. 20 vs 24 radius task kartice.
2. Da li dense kartica treba 14 ili 15/16 meta tekst.
3. Da li meta red ima ikonice ili samo tekstualne separatore.
4. Tačna širina PLACE pina.
5. Da li selected halo treba narandžast ili brand zelen.
6. Koliko FULL sheet treba da bude inset od leve/desne ivice, ako uopšte.
7. Da li remote list canvas treba da bude čisto beo ili blago neutralan.
8. Da li relation marker ima ikonicu ili samo tekst.

Ovo se ne rešava daljom teorijom.
Rešava se vizuelnim prototipom šest zaključanih kompozicija.


# 35. APPLICATION + SELECTION — PRVI KANONSKI PASS

Ovo poglavlje počinje sledeći veliki domen posle Discovery-ja.

Još NE zaključava finalni izgled.
Prvo zaključava:
- šta prijava zapravo znači;
- šta worker šalje;
- šta requester vidi;
- kako se bira;
- šta se dešava kada zadatak ili prijava više nisu isti;
- kako nastaje Dogovor;
- kako radi više potrebnih ljudi.

---

# 36. GLAVNA MENTALNA SLIKA

## 36.1 Prijava nije Dogovor

Prijava je ponuda worker-a da uradi konkretan zadatak pod konkretnim uslovima.

Može sadržati:
- koliko ljudi worker dovodi;
- cenu, kada zadatak prima ponude;
- termin / vremenski okvir / rok zadatka koji worker prijavom prihvata;
- kratku poruku.

Tek kada requester izabere prijavu:
**nastaje Dogovor.**

Zato dugme za izbor mora jasno da kaže posledicu.

## 36.2 Jedna prijava je celina

Ako prijava kaže:
- Marko;
- dolaze 2 osobe;
- ukupno 8.000 RSD;
- termin subota 10–14;

requester ne bira samo Marka kao ime.
Bira **celu tu prijavu**.

Ako je izabere:
- zauzimaju se 2 mesta;
- prihvata se cena te prijave;
- prihvata se termin koji važi za prijavu;
- nastaje jedan Dogovor vezan za tu prijavu.

Ne biramo proizvoljno samo 1 od 2 mesta iz iste prijave.

---

# 37. WORKER FLOW — OD TASK DETAIL-A DO POSLATE PRIJAVE

Osnovni tok:

**Task detail → Prijavi se → Sastavi prijavu → Pregled → Pošalji → Potvrda**

Ne pravimo višekoračni wizard ako četiri kratke stvari mogu da stanu na jedan prirodan ekran.

---

# 38. EKRAN „VAŠA PRIJAVA“ — ŠTA KORISNIK ZAISTA POPUNJAVA

Cilj:
worker treba da završi prijavu za nekoliko desetina sekundi, bez osećaja formulara.

Na vrhu:
- naslov zadatka;
- osnovni termin;
- lokalno mesto ili Na daljinu;
- kratka cena zadatka.

Ispod najviše četiri stvari:

1. **Koliko vas dolazi** — samo kada task traži više ljudi
2. **Vaša ponuda** — samo ako requester traži ponude
3. **Poruka** — opciono

Termin se ne unosi. Prijavom se prihvata termin/period zadatka.

---

# 39. BROJ LJUDI U PRIJAVI

## 39.1 Jedna osoba

Ako task ima samo jedno preostalo mesto:
- ne prikazujemo veliki stepper samo da bi pisalo `1`;
- worker prijava podrazumeva 1 osobu;
- review jasno potvrđuje „1 osoba“.

## 39.2 Više mesta

Ako je ostalo više mesta i worker može da dovede više ljudi:

**Koliko vas dolazi?**

[-]  2  [+]

Ispod:
`Na zadatku su slobodna još 3 mesta.`

Ako profil ima potvrđen kapacitet tima:
- UI ne nudi više od tog kapaciteta.

Server je i dalje poslednja provera.

## 39.3 Ne može više ljudi nego što je ostalo

Ako su ostala 2 mesta:
worker ne može da pošalje prijavu za 3.

Ako se broj slobodnih mesta promeni dok worker sastavlja prijavu:
- forma se ne pretvara da je sve u redu;
- pre slanja se proverava aktuelno stanje;
- korisnik dobija ljudsku poruku i novi dozvoljeni maksimum.

---

# 40. CENA U PRIJAVI

Postoje dva potpuno različita slučaja.

## 40.1 Requester je već odredio cenu

Worker cenu ne upisuje.

Aplikacija samo jasno pokazuje šta će ova prijava vredeti.

### PER_PERSON

Task:
4.000 RSD / osoba

Worker dovodi 2 osobe:

**4.000 RSD / osoba**
**8.000 RSD za vašu prijavu**

### TOTAL

Task:
12.000 RSD ukupno
3 potrebne osobe

Worker dovodi 2:

**4.000 RSD / osoba**
**8.000 RSD za vašu prijavu**

Račun se vezuje za originalni broj potrebnih ljudi, ne za trenutni broj preostalih mesta.

### HOURLY — vlasnička odluka

Satnica je **po osobi**.

Primer:
1.200 RSD / sat / osoba

Ako worker dovodi 2 osobe:

**1.200 RSD / sat / osoba**
**2.400 RSD / sat za vašu prijavu**

### VAŽAN IMPLEMENTACIONI GAP

Aktuelna helper logika za HOURLY trenutno vraća istu satnicu bez množenja brojem ljudi.

To nije u skladu sa potvrđenom product odlukom da je satnica po osobi.

Pre implementacije finalnog toka mora se uskladiti:
**application hourly total = hourly per person × broj ljudi u prijavi.**

## 40.2 Requester traži ponude

Worker upisuje:
**Koliko tražite ukupno?**

Primer:
`8.000 RSD`

Ako dolaze 2 osobe, odmah ispod:
`4.000 RSD po osobi`

Time worker razume šta šalje, a requester kasnije može pošteno da poredi prijave različite veličine.

---

# 41. TERMIN U PRIJAVI

Zaključano: **worker u prijavi ne predlaže drugi termin.**

## 41.1 Tačan termin

Ako zadatak ima tačan termin, prijava znači da worker taj termin prihvata.

Primer:
**Subota, 10:00–14:00**

Nema dugmeta „Predložite drugi termin“.

Ako termin ne odgovara, worker se ne prijavljuje na taj zadatak.

## 41.2 Fleksibilan period

Ako requester navede fleksibilan okvir, npr:
- danas;
- ove nedelje;
- od petka do nedelje;

worker se prijavljuje zato što može da radi u tom okviru.

Ne tražimo od njega da u prijavi bira tačan sat.

Ako želi da naglasi nešto važno, može to da napiše u opcionoj poruci, npr:
„Mogu u subotu posle 15h.“

Precizan termin se dogovara kasnije kroz Dogovor.

## 41.3 Remote / rok

Ako je zadatak remote i ima rok:
**Rok: petak do 18h**

worker se prijavljuje zato što može da završi do tog roka.

Ne bira poseban termin rada.

## 41.4 Posledica za UX

Application forma više nema:
- izbor početka;
- izbor kraja;
- sheet za „tačan termin“;
- alternativni predlog termina.

Termin je informacija zadatka koju worker prijavom prihvata.

---

# 42. PORUKA UZ PRIJAVU

Opciono polje.

Placeholder treba da pomogne, ali ne da tera korisnika na roman.

Primer:
`Kratko napišite nešto što je važno za ovaj posao.`

Nema obaveznog eseja.

Poruka može da posluži za:
- kratko relevantno iskustvo;
- praktičnu napomenu;
- dodatno objašnjenje termina;
- šta worker konkretno nudi.

Ne koristimo poruku za privatni telefon, adresu ili zaobilaženje Dogovora.

---

# 43. ŠTA IZBACUJEMO IZ GLAVNOG APPLICATION FORM-A

Aktuelni kod ima dobar zaštitni temelj, ali UX ne treba da pokaže sve što sistem zna.

Ne stavljamo u glavni tok:
- tehničke revizije;
- hash;
- profile eligibility kodove;
- idempotency;
- interne kategorije;
- alat/vozilo kao obavezne redove;
- automatsko menjanje radnog profila kao deo osnovne prijave.

## 43.1 „Dodaj kategoriju u radni profil“

Aktuelni composer može da prikaže toggle:
`Dodaj ovu kategoriju u radni profil`.

Radni product smer:
**ne stavljati ovo u samo sastavljanje prijave.**

Razlog:
korisnik je došao da se prijavi na posao, ne da uređuje profil.

Ako želimo tu pomoć:
- ponuditi je posle uspešno poslate prijave;
- ili u Radnom profilu.

Prijava i promena profila ne treba da deluju kao jedna ista radnja.

---

# 44. REVIEW PRE SLANJA

Pre konačnog slanja otvara se kratak review sheet.

Naslov:
**Proverite prijavu**

Prikazuje:

Zadatak  
Selidba stana

Vaša prijava  
2 osobe  
8.000 RSD ukupno · 4.000 RSD po osobi  
Subota 10–14  
„Mogu da dođem sa kolegom...“

Na dnu:
**Pošaljite prijavu**

Sekundarno:
**Izmenite**

I jedna mirna rečenica:

`Ako Vas izaberu, odmah nastaje Dogovor pod ovim uslovima.`

To je važno i mora ostati.

---

# 45. POSLE SLANJA

Posle potvrđenog uspeha:

**Prijava je poslata**

Kratko:
`Requester sada može da je pregleda. Ako Vas izabere, nastaje Dogovor.`

Prikazati sažetak onoga što je poslato:
- cena;
- ljudi;
- termin;
- poruka.

Glavni sledeći korak:
**Moje prijave**

Sekundarni:
**Nazad na zadatak**

Ne ostavljamo korisnika u staroj editable formi.

---

# 46. AKO NE ZNAMO DA LI JE PRIJAVA POSLATA

Ovo je zaštita koja u postojećem kodu već ima dobar temelj.

Korisnički prikaz:

**Nismo uspeli da potvrdimo da li je prijava poslata.**

Primarno:
**Proverite da li je poslato**

Dok se to ne razreši:
- ne otvaramo novu različitu prijavu;
- ne savetujemo korisniku da klikće deset puta;
- čuvamo identitet iste radnje.

Tek kada znamo da nije primljena:
- korisnik može ponovo da sastavi/pošalje.

---

# 47. WORKER — „MOJE PRIJAVE“

Worker-u ne treba prikaz svih sirovih server statusa.

Korisnički život prijave svodimo na nekoliko razumljivih stanja.

## 47.1 Čeka odgovor

Obuhvata:
- Poslata;
- Viđena;
- interna shortlist stanja koja ne menjaju stvarnu akciju korisnika.

`SHORTLISTED` ne treba workeru predstavljati kao veliko obećanje ako requester još ništa nije prihvatio.

## 47.2 Čeka Vas

Prijava zahteva akciju worker-a.

Najvažniji slučaj:
task se promenio i stara prijava više ne može automatski da se tretira kao potvrđena za nove uslove.

## 47.3 Izabrana

Odmah vodi na:
**Dogovor**.

Prijava tada više nije glavni radni prostor.

## 47.4 Povučena

Istorija.

Ako task još prima prijave i pravila dozvoljavaju:
worker kasnije može da pošalje novu prijavu.

## 47.5 Zatvorena

Ako server ne daje pouzdan razlog:
UI ne treba da tvrdi „Niste izabrani“ kada to nije dokazano.

Koristiti neutralno:
**Zatvorena**

sve dok imamo samo taj podatak.

---

# 48. TASK JE PROMENJEN POSLE PRIJAVE

Ovo je važna realna situacija.

Worker dobija jasno:

**Zadatak je izmenjen. Pregledajte nove uslove.**

Prikaz:
- trenutni task uslovi;
- njegova postojeća prijava.

Akcije:

**Zadržite prijavu**  
Ako server dozvoljava da ista prijava važi uz nove uslove.

**Izmenite prijavu**  
Cena / broj ljudi / poruka; termin ostaje tačno onaj koji aplikacija može pouzdano da pročita i izmeni.

**Povucite prijavu**

Ne pravimo četiri jednako velika zelena dugmeta.

Jedna preporučena radnja ima primarni tretman; druge su mirnije.

## Buduće poboljšanje

Najbolje rešenje bi bilo da server može da kaže tačan diff:
- termin promenjen;
- cena promenjena;
- opis promenjen;
- broj ljudi promenjen.

Dok taj pouzdan diff ne postoji, UI ne sme da izmisli šta je promenjeno.

---

# 49. POVLAČENJE PRIJAVE

Povlačenje je destruktivna radnja i traži potvrdu.

Primer:

**Povući prijavu?**

`Requester više neće videti Vašu aktivnu ponudu za ovaj zadatak. Ako zadatak i dalje prima prijave, kasnije ćete možda moći da pošaljete novu.`

Akcije:
- Odustani;
- Povuci prijavu.

Nema obaveznog razloga za povlačenje u MVP-u.

---

# 50. REQUESTER — LISTA PRIJAVA

Requester ulazi iz svog zadatka:

`3 prijave čekaju Vašu odluku`

→ **Prijave**

Na vrhu ostaje kontekst:
- naziv taska;
- popunjenost, npr. `1/3`;
- koliko prijava postoji / koliko je trenutno moguće izabrati.

Zatim kartice ljudi.

Ne prikazujemo prijave kao tabelu sa tehničkim kolonama.

---

# 51. CANDIDATE CARD — ŠTA TREBA DA ODGOVORI

Requester za 2–3 sekunde treba da vidi:

1. ko je osoba;
2. kakvu reputaciju ima;
3. koliko traži;
4. koliko ljudi dovodi;
5. kada može;
6. kratku poruku ako je poslao;
7. da li prijava trenutno može da se izabere.

Radna anatomija:

┌────────────────────────────────────┐
│ [avatar] Marko                     │
│          ★ 4,9 · 23 ocene          │
│                             8.000 RSD│
│                       4.000 / osoba │
│                                    │
│ Subota 10–14 · dolaze 2 osobe      │
│ „Dolazim sa kolegom...“            │
│                                    │
│                         Izaberi →   │
└────────────────────────────────────┘

Cela kartica otvara punu prijavu.

Foot `Izaberi` postoji samo kada prijava zaista može trenutno da se izabere.

---

# 52. CANDIDATE CARD — ŠTA NE STAVLJAMO

Ne prikazujemo na kompaktnoj kartici:
- hash/verziju;
- matcher procenat;
- tehnički eligibility;
- alat;
- vozilo;
- sve veštine;
- internu shortlist oznaku;
- gomilu status čipova.

Po ranijoj product odluci, alat i vozilo ne postaju opšti dekorativni fact redovi.

Ako worker želi da naglasi nešto praktično:
- može kroz poruku;
- detalj/public profil može kasnije dobiti specifičan relevantan podatak ako za to postoji jasan proizvodni razlog.

---

# 53. CENA KANDIDATA — KLJUČNA KOREKCIJA ZA MULTI-PERSON

Aktuelni kandidat model nosi ukupnu cenu prijave.

To je važno, ali nije dovoljno za pošteno poređenje.

Primer:

A:
8.000 RSD za 2 osobe
= 4.000 RSD/osoba

B:
5.000 RSD za 1 osobu
= 5.000 RSD/osoba

Ako sortiramo samo po ukupnom iznosu:
B izgleda jeftinije, iako je po mestu skuplji.

## Radni kanon

Candidate card prikazuje:
- **ukupno za prijavu** kao glavni ugovorni iznos;
- **po osobi** kao sekundarni uporedivi iznos kada pokriva više ljudi.

Za fixed hourly:
- prikazuje se satnica po osobi;
- i ukupna satnica za celu prijavu kada dolazi više ljudi.

## Sortiranje po ceni

Aktuelni kod sortira po ukupnom iznosu prijave.

To treba promeniti za multi-person scenario.

Radni smer:
**sort „Cena“ poredi uporedivu cenu po osobi / mestu**, ne slepo ukupan iznos.

Ukupan iznos i dalje ostaje ono što će konkretna prijava koštati.

---

# 54. SORTIRANJE PRIJAVA

Dozvoljena pomoć:

- **Redosled prijava**
- **Cena**
- **Ocena**

Ne koristimo izraz „Najbolji kandidat“.

Ne postoji dovoljno pouzdan jedinstveni skor da bi aplikacija donosila tu odluku umesto requestera.

Ako server stvarno vrati ljudski `razlogPreporuke`:
- može se diskretno prikazati;
- bez procenta;
- bez tvrdnje da je osoba „najbolja“.

## „Najniža cena“ / „Najbolja ocena“ markeri

Ne moraju stalno da stoje na karticama.

Radni smer:
- sort je dovoljan;
- eventualni marker koristimo vrlo diskretno i samo kada ceo set prijava zaista znamo.

---

# 55. MOBILE „UPOREDI“ MOD

Aktuelni kod ima mogućnost dve kandidat kartice jednu pored druge.

Za MVP telefon:
**ne bih ga stavio u prvi plan.**

Razlog:
- na normalnom telefonu kolone postaju preuske;
- informacije su dovoljno uporedive u vertikalnoj listi;
- sortiranje rešava glavni problem.

Možemo:
- ostaviti arhitekturu;
- kasnije koristiti na tabletu / širokom ekranu;
- ili vratiti kada realan test pokaže da zaista pomaže.

---

# 56. PUNA PRIJAVA KANDIDATA

Tap kandidat kartice otvara sheet/detail.

Redosled:

1. ime + avatar;
2. ocena / broj ocena;
3. ukupan iznos + cena po osobi kada je relevantno;
4. koliko ljudi dolazi;
5. termin;
6. puna poruka;
7. status samo ako stvarno menja mogućnost izbora;
8. primarna akcija `Izaberi`.

Ime/profilni red može da otvori javni profil.

Public profil je mesto za:
- bio;
- reputaciju;
- završene poslove;
- potvrde koje server stvarno sme da pokaže.

Ne pokušavamo da ceo profil uguramo u prijavu.

---

# 57. PRIJAVA KOJA TRENUTNO NE MOŽE DA SE IZABERE

Primeri:
- promenjeni uslovi;
- previše ljudi za preostala mesta;
- termin u konfliktu;
- task je popunjen;
- prijava je već izabrana;
- prijava je zatvorena.

UI kaže ljudski razlog koji server može pouzdano da potvrdi.

Primer:

**Ova prijava trenutno ne može da se izabere.**

`Prijava pokriva 2 osobe, a ostalo je 1 mesto.`

Ne nudimo zeleno `Izaberi`.

Ako osveženje može da promeni sliku:
- `Osvežite prijave`.

Ako je već izabrana:
- `Otvori Dogovor`.

---

# 58. IZBOR KANDIDATA — ŠTA TAČNO REQUESTER PRIHVATA

Tap `Izaberi` ne treba odmah da izvrši radnju bez potvrde.

Confirm:

**Izabrati Marka?**

Prihvatate:
- 8.000 RSD ukupno;
- 2 osobe;
- subota 10–14.

**Izbor odmah stvara Dogovor za obe strane.**

Akcije:
- Odustani;
- **Izaberi**

Ovo je jedna od najvažnijih potvrda u celoj aplikaciji.

---

# 59. ŠTA SE DEŠAVA POSLE IZBORA

Ako izbor uspe:

**Dogovoreno!**

Prikaz:
- requester;
- izabrani worker;
- task;
- prihvaćena cena;
- prihvaćen termin;
- broj mesta koje ova prijava pokriva.

Primarno:
**Otvorite Dogovor**

Ako još ima slobodnih mesta:
sekundarno:
**Izaberite sledeću osobu · još 1 mesto**

Ovo već ima dobar temelj u aktuelnom kodu.

---

# 60. MULTI-PERSON SELECTION

Primer:
task traži 3 osobe.

### Kandidat A
dolaze 2 osobe.

Requester izabere A:
- nastaje Dogovor sa A;
- task postaje 2/3;
- ostaje još 1 mesto.

### Kandidat B
dolazi 1 osoba.

Requester izabere B:
- nastaje drugi bilateralni Dogovor;
- task postaje 3/3;
- potraga se zatvara jer je popunjeno.

Requester kasnije u Dogovorima vidi oba odnosa grupisana pod istim izvornim taskom.

---

# 61. OVERFILL POSLE PRETHODNOG IZBORA

Primer:
ostala su 2 mesta.

Kandidat A pokriva 2.
Kandidat B pokriva 2.

Requester izabere A.

Sada više nema mesta za B.

B se ne sme tiho izabrati iz stare kartice.

Server revalidira stanje.

UI:
**Sva mesta su popunjena**
ili odgovarajuće pouzdano stanje.

Drugi primer:
ostalo je 1 mesto, a B pokriva 2.

UI:
`Ova prijava pokriva 2 osobe, a ostalo je 1 mesto.`

Ne delimo njegovu prijavu na pola.

---

# 62. NEPOZNAT ISHOD IZBORA

Ako je requester tapnuo Izaberi, a mreža pukne:

Ne prikazujemo:
`Nije uspelo`

ako to ne znamo.

Prikaz:

**Proveravamo da li je Dogovor nastao.**

Primarno:
**Proveri da li je izabrano**

Ako server potvrdi Dogovor:
→ Dogovoreno.

Ako server pouzdano potvrdi da izbor nije prihvaćen:
→ kandidat se ponovo prikazuje prema aktuelnom stanju.

Ne pravimo drugi različiti izbor dok prethodni nije razrešen.

---

# 63. PRIVATNOST PRE IZBORA

Pre Dogovora:
- nema pune adrese;
- nema privatnog telefona;
- nema privatnog chata između requestera i konkretnog worker-a, osim sistema koji je posebno projektovan kao anoniman Q&A na tasku;
- javni profil daje samo public-safe podatke.

Izbor je trenutak u kome nastaje poverljiviji bilateralni odnos.

---

# 64. ŠTA JE DOBRO U AKTUELNOM KODU I ZADRŽAVAMO

- prijava se veže za tačnu reviziju taska;
- prijava ima verziju/hash;
- submit ima zaštitu od duplog slanja;
- nepoznat ishod ima recovery;
- fixed price nije editable;
- OFFERS ima editable cenu;
- broj ljudi je deo prijave;
- termin zadatka se nosi kroz prijavu bez dodatnog unosa;
- selection ponovo proverava eligibility i raspored;
- izbor atomski vodi u Dogovor;
- selected prijava može direktno da otvori Dogovor;
- multi-seat nastavak „izaberi sledećeg“ već postoji kao smer;
- worker može da povuče prijavu;
- promenjen task može zahtevati ponovni pregled prijave.

To su važni temelji i ne menjaju se zbog vizuelnog pojednostavljenja.

---

# 65. ŠTA MENJAMO U ODNOSU NA TRENUTNI UX

1. Application forma postaje vizuelno jednostavnija.
2. Jedna osoba ne dobija nepotreban people stepper.
3. Profil-skill opt-in se izbacuje iz osnovne prijave.
4. Tool/vehicle redovi ne zatrpavaju candidate cards.
5. Candidate kartica jasno razlikuje ukupno i po osobi.
6. Sortiranje po ceni mora biti pošteno za prijave sa različitim brojem ljudi.
7. HOURLY multi-person račun mora da prati vlasničku odluku: satnica po osobi × broj ljudi.
8. Side-by-side compare nije glavni MVP phone UX.
9. `SHORTLISTED` se workeru ne pretvara u lažno obećanje.
10. Selection confirmation jasno kaže da izbor odmah pravi Dogovor.
11. Ne prikazujemo tehničke statuse ako korisnik od njih nema akciju.

---

# 66. APPLICATION + SELECTION — OTVORENE STVARI PRE WIREFRAME-A

Još treba pažljivo zaključati:

1. Tačno kako se na candidate card-u prikazuje cena kod HOURLY.
2. Da li worker kod OFFERS unosi samo ukupno ili mu nudimo i alternativni način „po osobi“ pa sistem računa total.
3. Tačan izgled `Čeka odgovor / Čeka Vas / Istorija` u Moje prijave.
4. Da li `Viđena` treba uvek da se vidi workeru ili samo kao diskretna informacija u detailu.
5. Da li public profil kandidata otvaramo kao sheet ili full detail.
6. Kako vizuelno prikazujemo task-change review.
7. Da li candidate list u MVP-u ima samo sort ili i search/filter kada prijava bude mnogo.

Osnovna poslovna logika više nije nejasna.
Sledeći korak je:
**wireframe Application + Selection toka ekran po ekran.**


# 67. APPLICATION + SELECTION — ZAKLJUČENE OTVORENE ODLUKE

Da bi wireframe mogao da se crta bez stalnog vraćanja unazad, zaključavamo sledeće:

## 67.1 OFFERS unos

Za MVP worker kod „Tražim ponude“ unosi:
**ukupan iznos za celu svoju prijavu.**

Ako dovodi više ljudi:
aplikacija odmah prikazuje izvedeno:
**X RSD po osobi.**

Ne nudimo dva paralelna input režima „ukupno / po osobi“ jer povećavaju zabunu.

## 67.2 HOURLY

Satnica je po osobi.

Worker i requester oba vide:
- satnicu po osobi;
- ukupnu satnicu za celu prijavu ako je više ljudi.

## 67.3 Moje prijave

Radni MVP navigation unutar liste:
- **Aktivne**
- **Čeka Vas**
- **Istorija**

`Sve` nije potreban kao primarni tab.
Ako kasnije pokaže vrednost, može biti sekundarni filter.

## 67.4 „Viđena“

Worker može da vidi `Viđena`, ali samo kao tiho stanje unutar aktivne prijave.
Ne pravimo od toga poseban tab niti veliku uspešnu oznaku.

## 67.5 Public profil kandidata

Otvara se kao sheet preko prijave.
Ne šaljemo korisnika na novu duboku full-screen granu samo da proveri reputaciju.

## 67.6 Candidate list filteri

MVP:
- sort;
- nema search polja;
- nema dodatnog filter panela.

Ako task dobija veoma mnogo prijava, kasnije se može dodati.

## 67.7 Price sort

Ako task ima **MY_PRICE**:
- kandidat nije birao cenu;
- sort po ceni se ne prikazuje.

Ako task ima **OFFERS**:
- sort `Cena` poredi cenu po osobi/mestu, ne slepo ukupan iznos.

---

# 68. WIREFRAME A — FIXED PRICE, JEDNA OSOBA

Scenario:
task traži 1 osobu i requester je već odredio cenu.

[←] Vaša prijava

Selidba manjeg stana
Danas 17–19 · Liman
4.000 RSD / osoba

────────────────────────

TERMIN ZADATKA

Danas, 17:00–19:00

Prijavom prihvatate ovaj termin.

────────────────────────

PORUKA UZ PRIJAVU

[ Kratko napišite nešto što je važno... ]

Opciono

────────────────────────

                4.000 RSD ukupno

[       Pregledajte prijavu       ]

### Namerno nema
- people steppera;
- editable cene;
- profila;
- alata;
- automatskog dodavanja kategorije.

---

# 69. WIREFRAME B — FIXED PRICE, VIŠE LJUDI

Scenario:
task traži 3 osobe.
Cena je 4.000 RSD po osobi.
Slobodna su 3 mesta.

[←] Vaša prijava

Selidba stana
Subota · Liman
4.000 RSD / osoba

────────────────────────

KOLIKO VAS DOLAZI

[-]        2        [+]

Slobodna su još 3 mesta.

Vaša prijava:
8.000 RSD ukupno
4.000 RSD / osoba

────────────────────────

TERMIN ZADATKA

Subota 10–14

Prijavom prihvatate ovaj termin.

────────────────────────

PORUKA UZ PRIJAVU

[ Dolazim sa kolegom... ]

────────────────────────

[       Pregledajte prijavu       ]

### Važno
Broj ljudi odmah menja ukupnu vrednost prijave.

---

# 70. WIREFRAME C — TRAŽIM PONUDE

[←] Vaša prijava

Fotografisanje proizvoda
Ove nedelje · Novi Sad
Traži ponude

────────────────────────

KOLIKO VAS DOLAZI

[-]        2        [+]

────────────────────────

VAŠA PONUDA

[          8.000          ] RSD

Ukupno za 2 osobe
4.000 RSD po osobi

────────────────────────

TERMIN

Ove nedelje · fleksibilno

Precizan termin dogovara se ako nastane Dogovor.

────────────────────────

PORUKA

[ Mogu u sredu ili četvrtak... ]

────────────────────────

[       Pregledajte prijavu       ]

### Pravilo
Input je total.
Per-person se računa i prikazuje automatski.

---

# 71. WIREFRAME D — PREGLED PRE SLANJA

Sheet preko forme:

╭────────────────────────────────────╮
│ Proverite prijavu              ×   │
│                                    │
│ Selidba stana                      │
│                                    │
│ VAŠA PRIJAVA                       │
│ 8.000 RSD ukupno                   │
│ 4.000 RSD / osoba                  │
│ 2 osobe                            │
│ Subota 10–14                       │
│                                    │
│ PORUKA                             │
│ „Dolazim sa kolegom...“            │
│                                    │
│ Ako Vas izaberu, odmah nastaje     │
│ Dogovor pod ovim uslovima.         │
│                                    │
│ [      Pošaljite prijavu      ]    │
│         Izmenite prijavu           │
╰────────────────────────────────────╯

### Zašto review ostaje
Izbor requestera odmah pravi Dogovor.
Worker mora jednom jasno da potvrdi šta šalje.

---

# 72. WIREFRAME E — PRIJAVA POSLATA

[←]

              [success art]

        Prijava je poslata

Requester sada može da je pregleda.
Ako Vas izabere, nastaje Dogovor.

╭────────────────────────────────────╮
│ Selidba stana                      │
│ 8.000 RSD ukupno                   │
│ 2 osobe                            │
│ Subota 10–14                       │
│ „Dolazim sa kolegom...“            │
╰────────────────────────────────────╯

[          Moje prijave          ]

          Nazad na zadatak

### Profil suggestion
Ako želimo da ponudimo:
`Dodajte Selidbe u svoj radni profil`

to ide ovde kao sekundarna preporuka ili kasnije u Profilu.
Ne blokira uspeh i nije unapred uključena promena profila.

---

# 73. WIREFRAME F — MOJE PRIJAVE

[←] Moje prijave

[ Aktivne ] [ Čeka Vas 1 ] [ Istorija ]

AKTIVNE

┌────────────────────────────────────┐
│ Selidba stana                      │
│ Poslata                            │
│ 8.000 RSD · 2 osobe                │
│ Subota 10–14                       │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ Prevod dokumenta                   │
│ Viđena                             │
│ 3.000 RSD · 1 osoba                │
│ Rok: petak                         │
└────────────────────────────────────┘

### Tap
Otvara detalj/prijavu.

### Čeka Vas
Tu ulazi samo ono gde worker stvarno treba nešto da uradi.

### Istorija
- Povučena;
- Zatvorena;
- završena prijavna istorija.

Izabrana prijava vodi ka Dogovoru i može stajati u `Čeka Vas` dok je korisno da je worker otvori.

---

# 74. WIREFRAME G — ZADATAK JE IZMENJEN

[←] Pregled prijave

Zadatak je izmenjen

Pregledajte trenutne uslove pre nego što
odlučite šta će biti sa Vašom prijavom.

TRENUTNI ZADATAK
Selidba stana
Subota 12–16
4.000 RSD / osoba
Još 2 slobodna mesta

VAŠA PRIJAVA
2 osobe
8.000 RSD ukupno
Vaš predlog: subota 10–14
„Dolazim sa kolegom...“

[       Zadrži prijavu        ]

[       Izmeni prijavu        ]

         Povuci prijavu

### Važno
Ako ne znamo tačno šta se promenilo, ne pišemo lažni diff.

Ako server kasnije dobije pouzdan diff:
prikazujemo samo stvarne promene.

---

# 75. WIREFRAME H — REQUESTER LISTA PRIJAVA

[←] Prijave

Selidba stana
👥 1/3 izabrano

5 prijava · 4 mogu da se izaberu

[ Redosled prijava ▾ ]

┌────────────────────────────────────┐
│ [M] Marko                          │
│     ★ 4,9 · 23 ocene               │
│                                    │
│ 8.000 RSD ukupno                   │
│ 4.000 RSD / osoba                  │
│                                    │
│ Subota 10–14 · 2 osobe             │
│ „Dolazim sa kolegom...“            │
│                                    │
│                         Izaberi →   │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ [A] Ana                            │
│     ★ 5,0 · 8 ocena                │
│                                    │
│ 5.000 RSD ukupno                   │
│ 5.000 RSD / osoba                  │
│                                    │
│ Subota 10–14 · 1 osoba             │
│                         Izaberi →   │
└────────────────────────────────────┘

### Sort za OFFERS
- Redosled prijava
- Cena po osobi
- Ocena

### Sort za MY_PRICE
- Redosled prijava
- Ocena

Nema `Cena`, jer svi slede requester-ovu cenu.

---

# 76. WIREFRAME I — PRIJAVA KANDIDATA

Sheet:

╭────────────────────────────────────╮
│ Marko                          ×   │
│                                    │
│ [avatar]  ★ 4,9 · 23 ocene         │
│           Pogledajte profil        │
│                                    │
│ PONUDA                             │
│ 8.000 RSD ukupno                   │
│ 4.000 RSD / osoba                  │
│                                    │
│ DOLAZI                             │
│ 2 osobe                            │
│                                    │
│ TERMIN                             │
│ Subota 10–14                       │
│                                    │
│ PORUKA                             │
│ Dolazim sa kolegom i možemo...     │
│                                    │
│ [        Izaberi osobu        ]    │
╰────────────────────────────────────╯

### Ako nije izbirljiva
Nema zelenog dugmeta.

Umesto njega:
jasan razlog + eventualno `Osvežite prijave`.

---

# 77. WIREFRAME J — CONFIRM IZBORA

Centered confirm:

╭────────────────────────────────────╮
│ Izabrati Marka?                    │
│                                    │
│ Prihvatate:                        │
│ 8.000 RSD ukupno                   │
│ 2 osobe                            │
│ Subota 10–14                       │
│                                    │
│ Izbor odmah stvara Dogovor za obe  │
│ strane.                            │
│                                    │
│ Odustani          [ Izaberi ]      │
╰────────────────────────────────────╯

Nema dodatnog drugog confirmation ekrana.

---

# 78. WIREFRAME K — DOGOVORENO

              [Vi]   [Marko]

               Dogovoreno!

Selidba stana

8.000 RSD ukupno
2 osobe
Subota 10–14

[          Otvori Dogovor          ]

Ako task još nije pun:

Izaberi sledeću osobu · još 1 mesto

### Ako je task popunjen
Sekundarna akcija za sledećeg kandidata ne postoji.

---

# 79. WIREFRAME L — OVERFILL / VIŠE NE MOŽE

Marko

Ova prijava više ne može da se izabere.

Prijava pokriva 2 osobe,
a na zadatku je ostalo 1 mesto.

8.000 RSD ukupno
Subota 10–14

[ Osvežite prijave ]

Nema zelenog `Izaberi`.

---

# 80. WIREFRAME M — NEPOZNAT ISHOD IZBORA

Ne znamo da li je izbor potvrđen.

Ne birajte drugu prijavu dok ovo ne proverimo.

[      Proverite da li je izabrano      ]

Sačuvani izbor:
Marko · 2 osobe · 8.000 RSD · Subota 10–14

### Ako readback nađe Dogovor
→ Dogovoreno.

### Ako potvrdi odbijanje
→ vraćamo se na aktuelnu prijavu/listu.

---

# 81. APPLICATION + SELECTION — KOMPOZICIONI PRINCIPI

## 81.1 Worker prijava
Forma je mirna i kratka.
Jedna vertikalna kolona.
Jedan dominantan green CTA na dnu.

## 81.2 Candidate list
Ljudi vode vizuelnu hijerarhiju:
avatar + ime + reputacija.

Cena je druga velika odluka.
Termin i broj ljudi su treći nivo.

## 81.3 Candidate detail
Sheet, ne nova stranica.
Lista ostaje ispod njega i vraća se na isto mesto kada se zatvori.

## 81.4 Selection
Jedan confirm.
Jedan rezultat.
Bez višestrukih modalnih slojeva.

## 81.5 Dogovoreno
Success moment sme da ima malo više karaktera/ilustracije jer je to važan prelaz u novi domen:
**Agreement**.

---

# 82. APPLICATION + SELECTION — STATUS POSLE WIREFRAME PASS-A

Funkcionalno i kompoziciono sada su obrađeni:

- Application form;
- fixed price;
- offers price;
- multi-person;
- hourly semantics;
- fixed/flexible/remote time semantics without alternate-term input;
- optional message;
- review;
- send success;
- unknown submit outcome;
- My Applications;
- changed-task recovery;
- withdrawal;
- Candidate list;
- candidate price normalization;
- sorting;
- candidate detail;
- selection confirm;
- multi-seat selection;
- overfill;
- unknown selection outcome;
- Dogovoreno success.

Još NIJE finalno:
- vizuelni stil ovih ekrana;
- motion;
- tačne dimenzije;
- finalni copy na svakoj grešci;
- server/code izmene za hourly multi-person;
- code izmena za per-person price sort;
- konačan notification ulaz u ove tokove.

Sledeći korak:
**vizuelni pass za Application + Selection, koristeći isti USKOČI sistem koji smo postavili za Discovery.**


# 83. PRAVILO RADA OD OVOG TRENUTKA — PRVO CELINA, ONDA PROTOTIP, ONDA KOD

Od ovog trenutka ne pravimo više pojedinačne mockup slike kao glavni način rada.

Redosled rada je:

## 83.1 Prvo završavamo kompletan Master dokument

U jednom dokumentu moraju biti do kraja osmišljeni:
- svi glavni ekrani;
- svi tokovi;
- sve uloge;
- sve akcije;
- sva stanja;
- šta se vidi kada nešto uspe;
- šta se vidi kada ne uspe;
- šta se dešava kada je ishod nepoznat;
- šta se dešava kada se podaci promene;
- gde vodi Back;
- šta otvara push/deep link;
- kako rade poruke, Dogovori, profil, bezbednost, kalendar, ocene;
- šta korisnik vidi, a šta sistem radi u pozadini;
- konačni tekstovi i pravila tamo gde su bitni.

Cilj:
pre nego što počne finalno crtanje ili kodiranje, vlasnik proizvoda treba da može iz ovog jednog dokumenta da razume celu aplikaciju od početka do kraja.

## 83.2 Tek kada je aplikacija funkcionalno kompletno osmišljena pravimo interaktivni prototip

Preporučeni format:
**HTML/CSS/JavaScript prototip koji se ponaša kao mobilna aplikacija.**

Zašto:
- može da se otvori u browseru na telefonu;
- može stvarno da se klikće;
- mogu da se testiraju Back, sheet, tabovi, kartice, filteri, modalni prozori i tokovi;
- može da se vidi realna visina ekrana i količina sadržaja;
- mnogo je korisniji od statične slike;
- promene su jeftine pre nego što diramo produkcioni kod.

HTML prototip nije finalna aplikacija i ne glumi backend.
On je interaktivna maketa kompletne aplikacije.

## 83.3 U prototipu prolazimo celu aplikaciju

Primer:
Početna
→ Zadaci
→ mapa/lista
→ detalj
→ prijava
→ poslata prijava
→ requester prijave
→ izbor
→ Dogovor
→ poruke
→ izmene
→ završetak
→ ocena
→ profil/podešavanja.

Tek tada vidimo da li proizvod stvarno „teče“.

## 83.4 Posle odobrenog prototipa radimo implementaciju u stvarnom kodu

Tek tada postojeći React Native / Expo / Supabase kod usklađujemo sa odobrenim proizvodom.

Redosled implementacije:
1. postojeće dobre funkcije zadržati;
2. stare i kontradiktorne tokove ukloniti;
3. ekrane uskladiti sa Masterom;
4. backend pravila popraviti gde su u konfliktu sa odlukama;
5. testirati ceo tok;
6. tek na kraju polish.

## 83.5 Slike

Statične slike koristimo samo kada treba:
- proveriti vizuelni pravac;
- napraviti ilustraciju;
- uporediti dve estetske varijante.

Ne koristimo ih kao glavni način projektovanja funkcionalne aplikacije.

## 83.6 Trenutni prioritet

Dok Master nije kompletan:
**nastavljamo da osmišljavamo domene redom i ne prelazimo na finalni kod.**

Trenutno:
- Discovery: duboko obrađen;
- Application + Selection: duboko obrađeni i pojednostavljuju se;
- sledeće: Agreement + Group + Messages;
- zatim Calendar + Completion + Ratings;
- zatim Profile + Account + Safety;
- zatim finalno povezivanje cele aplikacije;
- tek onda interaktivni HTML prototip;
- tek posle njegovog odobrenja implementacija u produkcioni kod.


# 84. AGREEMENT + GROUP + MESSAGES — PRVI KANONSKI PASS

Ovaj domen počinje u trenutku kada je prijava izabrana.

Osnovno pravilo:
**izbor prijave stvara jedan bilateralni Dogovor između requestera i tog workera.**

Ako je na istom tasku izabrano više različitih worker naloga:
- postoje zasebni bilateralni Dogovori;
- svi pripadaju istom izvornom tasku;
- nastaje zajednički grupni razgovor za koordinaciju tog taska.

Korisnik ne treba da razume baze, Agreement ID-jeve ili unutrašnju strukturu.
UI to predstavlja kao:
- jedan zajednički zadatak;
- ljudi sa kojima je requester napravio Dogovor;
- jedan zajednički razgovor kada ih ima više;
- poseban privatni Dogovor/razgovor sa svakim workerom.

---

# 85. TRI STVARI KOJE NE SMEJU DA SE POMEŠAJU

## 85.1 Task

Zajednički kontekst:
„Selidba stana“.

Može imati više worker-a.

## 85.2 Bilateralni Dogovor

Jedan requester + jedna izabrana prijava / worker.

Nosi baš njihove prihvaćene uslove:
- cenu;
- broj mesta koje ta prijava pokriva;
- prihvaćen termin;
- prihvaćen obim.

Cena i uslovi jednog worker-a nisu automatski isti kao drugog.

## 85.3 Grupni razgovor

Koordinacija svih trenutno relevantnih učesnika istog taska.

Ne sme da postane mesto u kome se javno prikazuju bilateralne cene ili privatni uslovi.

Aktuelni backend već pravilno ne kopira cene i uslove u grupnu memoriju.

---

# 86. KADA GRUPA POSTOJI

Zaključani smer prati dobar postojeći tehnički model.

## 86.1 Jedan worker

Ako je izabran samo jedan worker nalog:
- nema potrebe za posebnom grupom;
- requester i worker imaju svoj Dogovor;
- Poruke su privatne.

Čak i ako taj worker u svojoj prijavi dovodi 2 ili 3 osobe:
to je i dalje jedan worker nalog i jedan bilateralni Dogovor.

Ne pravimo lažnu „grupu“ od članova tima koji nemaju zasebne USKOČI naloge/Dogovore.

## 86.2 Dva ili više različitih worker naloga

Kada task dobije najmanje dva nezavisno izabrana worker naloga:
- nastaje zajednički grupni razgovor;
- requester + aktivni izabrani worker-i su članovi.

Postojeći kod već radi po ovom principu.

---

# 87. PRIVATNOST ISTORIJE GRUPE

Ovo je vrlo dobro rešeno u postojećoj server logici i mora ostati.

## Novi worker

Ako novi/replacement worker bude izabran kasnije:
- ulazi u grupu od trenutka svog prijema;
- ne dobija stare grupne poruke iz vremena kada nije bio član.

## Otkazani worker

Kada njegov bilateralni Dogovor bude otkazan:
- prestaje da bude aktivni član;
- više ne može da šalje nove grupne poruke;
- ne vidi buduće poruke grupe;
- zadržava samo istoriju kojoj je već imao pristup.

## Važno

Ne vraćamo staru istoriju naknadno pri ponovnom ulasku/unblock-u.
Vidljivost poruka je vezana za stvarni trenutak članstva.

To je kanonsko privacy pravilo.

---

> **RANIJI ITERATIVNI DOGOVORI PASS.** Konačni root i history su S08; bilateralni S10; svi modeli sa stalnim `Aktivni | Istorija` su SUPERSEDED.

# 88. DOGOVORI — KAKO KORISNIK TREBA DA GA RAZUME

Glavni tab:
**Dogovori**

Finalni root više nema stalni veliki switch:
`Aktivni | Istorija`.

Razlog:
to je administrativna podela, a korisnik dolazi da vidi:
- šta ga čeka;
- šta ima danas;
- šta dolazi sledeće;
- šta još nema termin;
- gde su prethodne saradnje kada mu zatrebaju.

Default Dogovori root je zato **action/time centered**.

Redosled:

1. **Čeka Vas** — samo ako postoji stvarna akcija;
2. **Danas** — današnji Dogovori;
3. **Sledeće** — naredni potvrđeni Dogovori;
4. **Bez tačnog termina** — aktivni flexible Dogovori;
5. **Prethodne saradnje** — miran sekundarni ulaz u završene/otkazane Dogovore.

Role filter može sekundarno:
- Sve uloge
- Tražim pomoć
- Uskačem

To je filter sadržaja, ne globalni režim naloga.

Status filteri `Završeni / Otkazani` pripadaju površini Prethodne saradnje, ne root Dogovori ekranu.


# 89. REQUESTER — VIŠE DOGOVORA ZA ISTI TASK

Ako requester ima:

Selidba stana  
Marko — 2 mesta  
Nikola — 1 mesto

ne treba da vidi dve potpuno nepovezane kartice kao da su dva različita posla.

Prvi nivo je task:

┌────────────────────────────────────┐
│ Selidba stana                      │
│ Danas 17–20 · Liman                │
│ 3/3 dogovoreno                     │
│ [Marko] [Nikola]                   │
│                                    │
│ 2 saradnje                         │
└────────────────────────────────────┘

Tap/expand:
prikazuje pojedinačne saradnje.

Marko  
2 osobe · 8.000 RSD  
Dogovoreno

Nikola  
1 osoba · 4.000 RSD  
Dogovoreno

Svaka pojedinačna saradnja otvara svoj bilateralni Dogovor.

## Zašto

Requester misli:
„Imam jednu selidbu sa više ljudi.“

Ne misli:
„Imam dva nepovezana Agreement ID-ja.“

---

# 90. WORKER — DOGOVORI LISTA

Worker vidi svoj konkretan odnos.

Primer:

Selidba stana
Ana
Danas 17–20 · Liman
8.000 RSD ukupno
Dogovoreno

Ako na tasku postoji i grupa:
to nije drugi Dogovor.
To je samo dodatni kanal za koordinaciju istog taska.

---

# 91. AKTIVNI DOGOVORI — PRIORITET

Lista ne treba da bude samo hronološka arhiva.

Na vrhu su stvari koje čekaju korisnikovu akciju:

- predlog izmene čeka odgovor;
- završetak čeka potvrdu;
- završena saradnja čeka ocenu.

Zatim:
- danas;
- sutra;
- ove nedelje;
- kasnije;
- bez tačnog termina.

Postojeći list model već ima dobar temelj za ovu logiku.

---

# 92. BILATERALNI DOGOVOR — GLAVNI WORKSPACE

Dogovor ima samo dva glavna pogleda:

**Pregled | Poruke**

Ne vraćamo četiri-pet tabova tipa:
Pregled / Poruke / Tok / Dokazi / Ostalo.

Hronologija, dokazi i akcije pripadaju Pregledu kada su potrebni.

---

# 93. DOGOVOR / PREGLED — REDOSLED INFORMACIJA

Od vrha do dna:

1. ko je druga strana;
2. naziv taska;
3. trenutno stanje / šta je sledeće;
4. prihvaćena cena;
5. prihvaćen termin;
6. prihvaćen obim;
7. koliko ljudi ova prijava pokriva;
8. komunikacija i mesto;
9. relevantna hronologija;
10. dodatne akcije;
11. glavni sledeći CTA, ako ga ima.

Najvažnije:
**uvek se prikazuju prihvaćeni uslovi Dogovora, ne trenutno izmenjeni parent task.**

---

# 94. STANJE DOGOVORA — LJUDSKI PRIKAZ

Glavna korisnička stanja:

## Dogovoreno

Aktivna saradnja.
Ništa trenutno ne čeka odgovor.

## Predlog izmene čeka

Ako sam ja predložio:
`Vaš predlog čeka odgovor.`

Ako je druga strana predložila:
`Predlog izmene čeka Vaš odgovor.`

## Čeka potvrdu završetka

Worker je označio posao gotov.

Requester:
`Završetak čeka Vašu potvrdu.`

Worker:
`Čeka se potvrda druge strane.`

## Završen

Saradnja završena.

Ako ocena čeka:
to je sledeća jasna radnja.

## Otkazan

Bilateralni Dogovor je otkazan.

Ako server pouzdano daje:
- kada;
- ko;
- razlog;

to se prikazuje.

Ako ne daje:
ne izmišljamo.

---

# 95. PORUKE U BILATERALNOM DOGOVORU

Privatni chat je vezan za konkretan Dogovor.

To znači:
isti čovek može da se pojavi u više zasebnih razgovora ako sa njim postoje različiti taskovi/Dogovori.

Ne pravimo jedan beskonačan DM po osobi.

Razlog:
poruke, dogovoreni uslovi i kontekst moraju ostati vezani za konkretan posao.

---

# 96. PRIVATE CHAT — SADRŽAJ

Postojeći tehnički sistem već podržava:
- tekst;
- fotografije;
- glasovne poruke;
- recovery kada ne znamo da li je poruka poslata.

Tekst:
do 2.000 znakova.

Fotografije:
postojeći command model podržava do 6 fotografija u poruci.

Glas:
trenutni voice sloj postoji, ali nije još potpuno isti na svim platformama.

## Product pravilo

Korisnik ne vidi tehnički „outbox“.

Ako slanje nije potvrđeno:
poruka ostaje vezana za istu radnju i UI kaže da treba proveriti / ponoviti istu poruku.

Ne dupliramo poruke zbog loše mreže.

---

# 97. READ RECEIPTS

Ne prikazujemo nešto što server ne zna.

Privatni chat trenutno nema pouzdan autoritativni unread/read podatak za sve poruke.

Zato:
- jedna kvačica može značiti da je server poruku sačuvao;
- dve kvačice / „pročitano“ prikazujemo samo kada server to stvarno potvrdi;
- ako server vraća unknown/null, ne glumimo read receipt.

Grupni razgovor već ima precizniju vidljivost/read infrastrukturu.

---

# 98. GRUPNI RAZGOVOR — MENTALNI MODEL

Ako grupa postoji:

Poruke dobijaju dva kanala:

**Svi učesnici | Privatno**

## Svi učesnici

Vide svi aktivno relevantni članovi koji imaju pravo na tu poruku.

Koristi se za:
- koordinaciju dolaska;
- zajedničke informacije;
- praktične promene;
- stvari koje svi treba da znaju.

Ne koristi se za prikaz:
- Markove cene;
- Nikoline cene;
- privatnih bilateralnih predloga;
- privatnog kontakta.

## Privatno

Bilateralni chat.

Worker:
- privatno priča samo sa requesterom.

Requester:
- bira sa kojim workerom želi privatni razgovor.

Worker-i nemaju privatne međusobne DM-ove kroz ovaj task.

---

# 99. REQUESTER — IZBOR PRIVATNOG RAZGOVORA

Ako requester ima više worker-a:

Tap `Privatno`

otvara jednostavan izbor:

Marko
Nikola
Jelena

Tap osobe:
otvara baš njen bilateralni Dogovor chat.

Ako postoji samo jedna privatna saradnja:
nema nepotrebnog pickera — otvara se direktno.

Postojeći kod već ima ovu osnovnu logiku.

---

# 100. GROUP CHAT — MEDIA GAP

Aktuelni grupni backend danas podržava tekstualne poruke.

Privatni Dogovor chat je bogatiji i podržava fotografije/glas.

## Product smer

Za stvarni grupni rad fotografije imaju veliku vrednost:
- ulaz u zgradu;
- parking;
- predmet koji se prenosi;
- dokaz situacije;
- instrukcija za sve.

Zato ciljni grupni chat treba najmanje da podrži:
- tekst;
- fotografije.

Glasovna poruka je poželjna radi konzistentnosti, ali može biti implementaciona faza posle grupnih fotografija ako povećava scope.

Ovo je stvarni tehnički gap, ne razlog da promenimo mentalni model chata.

---

# 101. PORUKE TAB — INBOX

Glavni tab:
**Poruke**

Jedan red = jedan razgovor.

Ne:
jedan red = jedna osoba.

Razlog:
ista osoba može biti vezana za više različitih taskova.

Task je prvi orijentir.

Primer:

Selidba stana
Vi: Krećemo u 17h
Privatno · Marko                         16:42

Selidba stana
Gde se parkiramo?
Grupa · 3 osobe                          16:37

Montaža TV-a
Poslao sam fotografiju
Privatno · Nikola                        Juče

---

# 102. INBOX — GROUP I PRIVATE OSTAJU ODVOJENI

Group i private razgovor nisu dva prikaza iste poruke.

To su dva odvojena konteksta i dobijaju svoje redove.

Red uvek jasno pokazuje:
- task;
- poslednju poruku;
- `Grupa` ili `Privatno · Ime`;
- vreme;
- unread samo kada je autoritativno poznat.

Ne grupišemo conversation rows po osobi.

---

# 103. NOTIFIKACIJA O PORUCI

Tap push/notifikacije ne vodi na opšti Dogovor ekran ako znamo tačnu poruku.

Treba da otvori:
- pravi razgovor;
- pravi task/Dogovor;
- što bliže konkretnoj poruci.

Postojeći routing već ima dobar temelj za direct message target i group target.

---

# 104. TAČNA ADRESA / LOKACIJA

Javna task mapa pokazuje samo približnu bezbednu lokaciju.

Posle Dogovora:
requester je vlasnik tačne fizičke lokacije.

## Bilateralni grant

Tačna lokacija se deli konkretnoj drugoj strani.

Worker je ne vidi samo zato što postoji Dogovor.

Requester eksplicitno bira:
**Podelite lokaciju**

Worker zatim može:
**Prikaži privatnu lokaciju**

Requester može:
**Opozovi deljenje**

Pristup prestaje kada Dogovor više nije aktivan.

Aktuelni backend ovo već radi po bilateralnom Agreement-u.

---

# 105. ZATRAŽI ADRESU

Ako worker još nema tačnu adresu:

**Zatražite adresu**

ne šalje poruku automatski.

Otvori privatni razgovor sa već pripremljenom porukom, npr:
`Možete li da podelite tačnu adresu?`

Worker je pročita i sam pošalje.

To je dobro pravilo:
aplikacija ne govori drugoj osobi u korisnikovo ime bez potvrde.

---

# 106. VIŠE WORKER-A — DELJENJE ADRESE

Trenutno je dozvola tehnički bilateralna, po Dogovoru.

To je dobro za privatnost, ali requester sa 4 aktivna worker-a ne treba ručno da ponavlja istu radnju četiri puta ako želi da svi dođu na isto mesto.

## Ciljni UX

Na task/group nivou requester može da dobije:

**Podeli adresu aktivnim učesnicima**

Pre potvrde vidi kome se deli.

I dalje:
- svaki recipient dobija svoj bilateralni grant;
- pojedinačno deljenje/opoziv ostaje moguće;
- otkazani worker ne zadržava aktivan pristup.

## Tehnički gap

Current RPC je agreement-scoped.

Za robustan „podeli svima“ najbolje je kasnije imati server-owned batch radnju ili pažljivo journalovan multi-command flow.

Ne rešavati to običnom petljom bez recovery-ja.

---

# 107. TELEFON — POSTOJEĆA KONTRADIKCIJA

Backend/client još imaju funkcije za eksplicitno deljenje telefona.

Međutim aktuelni Agreement UI je već projektovan sa pravilom:
**komunikacija ostaje unutar USKOČI aplikacije i privatni broj se ne prikazuje.**

## Preporučeni MVP kanon

Ne prikazivati privatni broj telefona.

Razlozi:
- chat već postoji;
- fotografije i glas mogu ostati u aplikaciji;
- bolja privatnost;
- bolji dokaz komunikacije kod problema;
- manje zaobilaženja platforme.

Postojeći PHONE grant ostaje tehnička legacy/dormant mogućnost dok vlasnik proizvoda izričito ne odluči da ga vrati.

---

# 108. IZMENE DOGOVORA

Dogovor može da se menja tek posle izbora.

Ovo je pravo mesto za dogovaranje promene termina, a ne Application forma.

Moguća promena prihvaćenih uslova:
- Cena
- Termin
- Obim

## Pravilo

Predlog NE menja aktivni Dogovor odmah.

Dok druga strana ne prihvati:
**stari prihvaćeni uslovi ostaju važeći.**

UI mora jasno da razlikuje:

SADA
8.000 RSD

PREDLOG
9.000 RSD

ili:

SADA
Subota 10–14

PREDLOG
Subota 12–16

---

# 109. FLEKSIBILAN TASK → PRECIZAN TERMIN POSLE IZBORA

Ovo direktno prati odluku iz Application dela.

Ako je task bio:
`Od petka do nedelje`

worker se prijavio bez predlaganja sata.

Posle izbora, ako strane žele da zaključaju tačan termin:
jedna strana u Dogovoru predlaže:

`Subota 12:00–15:00`

druga:
- Prihvati
- Odbij

Tek prihvatanjem taj termin postaje novi važeći uslov Dogovora.

To je čistije nego cenkanje terminima pre izbora.

---

# 110. JEDAN PREDLOG IZMENE — JEDAN ODGOVOR

Radni kanon:
jedan aktivan predlog izmene u isto vreme.

Ako ja predložim:
- mogu da ga povučem dok nije prihvaćen;
- čekam drugu stranu.

Ako druga strana predloži:
- mogu da prihvatim;
- mogu da odbijem.

Ne pravimo grananje sa pet paralelnih predloga i verzija koje korisnik mora da razume.

Tehnički sistem već radi sa verzijama i pending proposal-om i dobro je osnova za ovo.

---

# 111. IZMENA I ZAVRŠETAK

Ako postoji predlog izmene na čekanju:
završetak Dogovora je blokiran dok se predlog:
- ne prihvati;
- ne odbije;
- ili ne povuče.

To je postojeće server pravilo i ima smisla.

Korisniku se kaže jednostavno:
`Najpre rešite predlog izmene.`

---

# 112. OTKAZIVANJE JEDNOG DOGOVORA

Otkazivanje je bilateralno.

Primer:
task traži 3 osobe.

Marko pokriva 2.
Nikola pokriva 1.

Ako se otkaže Markov Dogovor:
- Nikola ostaje;
- Markov Dogovor postaje Otkazan;
- njegova 2 mesta više nisu pokrivena;
- task ponovo ima 2 slobodna mesta;
- task može da nastavi potragu prema svojim pravilima.

Ne otkazujemo ceo task zato što je jedan odnos prestao.

Postojeći server već vraća Need iz ACTIVE ka SELECTION kada cancellation spusti pokrivenost ispod potrebnog broja.

---

# 113. OTKAZIVANJE I GRUPA

Kada jedan worker-ov Dogovor bude otkazan:

- njegova aktivna grupna membership prestaje;
- ne dobija buduće grupne poruke;
- ne može da šalje nove grupne poruke;
- zadržava samo prethodno dozvoljenu istoriju;
- preostala grupa nastavlja da radi.

Ako se kasnije izabere zamena:
novi worker ulazi od tog trenutka i ne dobija staru grupnu istoriju.

Ovo je već dobro implementirano u postojećem V5 group modelu.

---

# 114. RAZLOG OTKAZIVANJA

Postojeći server zahteva razlog.

Product smer:
zadržati kratak obavezan razlog jer obe strane treba da znaju zašto je aktivna saradnja prestala.

UI:

**Otkažite saradnju sa Markom?**

Otkazujete samo ovu saradnju.
Ostali Dogovori na zadatku ostaju aktivni.
Njegova 2 mesta ponovo postaju slobodna.

Razlog
[ __________________________________ ]

[ Odustani ]

[ Otkažite saradnju ]

Ne koristiti dvosmisleno:
`Otkaži zadatak`
ako se zapravo otkazuje samo jedan worker.

---

# 115. POSLE OTKAZIVANJA

Requester na task grupi vidi npr:

Selidba stana
1/3 i dalje pokriveno
2 mesta slobodna

Nikola — aktivan
Marko — otkazan

Ako je potraga otvorena:
može da nastavi da prima/bira zamenu.

Ako je preostala potraga zatvorena:
server authority odlučuje da li može ponovo da se otvori.

---

# 116. PRIVATE CHAT POSLE OTKAZIVANJA / ZAVRŠETKA

Kada Dogovor postane terminalan:
chat istorija ostaje.

Composer se sklanja.

Poruka:
`Dogovor je zatvoren. Poruke možete samo da čitate.`

Ne brišemo istoriju samo zato što je saradnja završena.

---

# 117. GROUP CHAT POSLE ZAVRŠETKA TASKA

Kada parent task postane terminalan:
grupni razgovor postaje read-only.

Istorija ostaje onima koji imaju pravo na nju.

Nema novih grupnih poruka.

---

# 118. PROBLEM / SAFETY

`Prijavi problem` nije isto što i obična poruka.

Problem:
- pripada konkretnom bilateralnom Dogovoru;
- može da blokira automatski završetak;
- ima formalnije posledice.

`Prijavi ili blokiraj osobu` je zasebna safety radnja.

Ne mešamo:
- problem sa izvršenjem posla;
- abuse/report/block korisnika;
- običan chat.

---

# 119. PORUKE I PROBLEM SA VIŠE WORKER-A

Ako requester ima problem samo sa Markom:
problem pripada Markovom Dogovoru.

Nikolin Dogovor se ne menja automatski.

Isto važi za:
- izmene;
- otkazivanje;
- završetak;
- ocenu.

Group je koordinacija.
Pravne/poslovne radnje ostaju bilateralne.

---

# 120. ŠTA ZADRŽAVAMO IZ POSTOJEĆEG KODA

Dobri temelji:

- Dogovori su bilateralni;
- Dogovori se grupišu po izvornom tasku + mojoj ulozi;
- jedna osoba može istovremeno biti requester u jednom i worker u drugom;
- grupni chat nastaje tek sa najmanje dva nezavisna worker naloga;
- članovi grupe imaju vremenski ograničenu istoriju prema stvarnom članstvu;
- cancel jednog Agreement-a ne ruši ostale;
- cancellation vraća slobodnu pokrivenost tasku;
- group/private kanali već postoje;
- requester može da izabere konkretnog workera za privatni chat;
- participant privatno ide requester-u;
- inbox je conversation-first, ne person-first;
- privatni chat ima text/photo/voice i recovery;
- group chat ima durable send/recovery i read tracking;
- tačna lokacija se deli eksplicitnim grantom;
- accepted Agreement terms ne menjaju se zato što parent task kasnije promeni podatke;
- predlog izmene nije aktivan dok ga druga strana ne prihvati;
- pending change blokira completion;
- message notification može da otvori direktan conversation target.

---

# 121. TEHNIČKI GAPOVI / STVARI ZA IMPLEMENTACIJU KASNIJE

1. **Group media**
   - grupni backend sada je text-only;
   - ciljni UX treba group photo podršku;
   - voice odluka može da ide posle photo podrške.

2. **Share location to all**
   - lokacijski grant je agreement-scoped;
   - ciljni task-level „podeli aktivnim učesnicima“ traži pouzdan batch/recovery dizajn.

3. **PHONE legacy**
   - servis postoji;
   - MVP UI ga ne treba izlagati ako ostajemo na in-app komunikaciji.

4. **Private unread/read**
   - privatni conversation inbox nema autoritativan unread count;
   - UI ne treba da ga izmišlja.

5. **Group lifecycle display u inbox-u**
   - inbox projekcija ne nosi uvek eksplicitno da li je group conversation terminalan;
   - mora se dopuniti autoritativnim witness-om pre nego što se group row pouzdano razdvaja Aktivni/Istorija.

6. **Task-level batch cancellation**
   - backend je namerno bilateralni;
   - ako kasnije želimo „otkaži ceo task i sve aktivne saradnje“, to mora biti posebna atomska ili oporavljiva product/server radnja, ne obična klijentska petlja.

---

# 122. AGREEMENT + GROUP + MESSAGES — ŠTA JOŠ TREBA OSMISLITI PRE WIREFRAME-A

Osnovna logika je sada jasna.

Pre wireframe-a još treba zaključiti:

1. Tačan requester izgled task grupe u Dogovori listi.
2. Da li group conversation ima poseban shortcut direktno na task-group kartici.
3. Kako izgleda `Pregled | Poruke` kada grupa postoji, da channel switch ne napravi tri nivoa navigacije.
4. Tačan target za group photos i voice.
5. Kako requester dobija „Podeli adresu aktivnim učesnicima“.
6. Kako task grupa vizuelno prikazuje aktivne, završene i otkazane saradnike bez pretrpavanja.
7. Kako izgleda predlog izmene na samom Pregledu.
8. Kako se najjasnije upozori da „Otkaži Dogovor“ otkazuje samo tog čoveka, ne ceo task.

Sledeći korak:
**rešiti tih osam product odluka i zatim napraviti tekstualni wireframe Dogovori + Group + Messages domena ekran po ekran.**


# 123. AGREEMENT + GROUP + MESSAGES — ZAKLJUČENE PRODUCT ODLUKE

Ovim odlukama zatvaramo glavne nejasnoće pre wireframe-a.

---

# 124. REQUESTER TASK GROUP U DOGOVORI LISTI

Ako task ima samo jedan bilateralni Dogovor:
- kartica može direktno da otvori taj Dogovor.

Ako task ima više bilateralnih Dogovora:
- prvi nivo je task grupa;
- tap širi saradnike unutar liste;
- ne otvara nasumično jednog workera.

Collapsed primer:

┌────────────────────────────────────┐
│ Selidba stana                      │
│ Danas 17–20 · Liman                │
│ 3/3 dogovoreno                     │
│ Marko · Nikola                     │
│                         2 saradnje  │
└────────────────────────────────────┘

Expanded:

Selidba stana
3/3 dogovoreno

[ Poruke grupi ]

Marko
2 osobe · 8.000 RSD
Dogovoreno
→

Nikola
1 osoba · 4.000 RSD
Dogovoreno
→

Ako postoje završene/otkazane saradnje:
ne mešamo ih ravnopravno sa aktivnim.

Ispod:
**Ranije saradnje (1)**

tap po potrebi prikazuje:
Marko · Otkazan

---

# 125. GROUP CHAT SHORTCUT

Kada postoji prava grupa:
expanded requester task grupa dobija jednu jasnu akciju:

**Poruke grupi**

Ne stavljamo tri chat ikonice po kartici.

Worker ne treba poseban shortcut u Dogovori listi:
otvara svoj Dogovor, pa kroz Poruke bira Svi učesnici / Privatno.

---

# 126. PREGLED | PORUKE + CHANNEL SWITCH

Dogovor i dalje ima:

**Pregled | Poruke**

Ako grupa NE postoji:
Poruke = bilateralni privatni chat.

Ako grupa postoji:
u Poruke se pojavljuje još jedan mali izbor:

**Svi učesnici | Privatno**

To nije novi nivo aplikacije.
To je samo izbor kome pišem unutar Poruke taba.

Hijerarhija:

Dogovor
→ Pregled / Poruke
→ unutar Poruke: Svi učesnici / Privatno

Ne pravimo:
Dogovor → Poruke → nova stranica → novi tab → picker → chat.

---

# 127. GROUP MEDIA — MVP ODLUKA

Za grupnu koordinaciju MVP ciljno podržava:

- tekst;
- fotografije.

Glasovne poruke nisu obavezne za prvi group-chat release.

Razlog:
fotografija je veoma korisna za zajednički fizički posao, a group voice bi dodatno proširio backend/media scope.

Privatni chat može zadržati postojeću voice mogućnost tamo gde je stabilna.

Dugoročni cilj:
isti chat composer svuda.

Tehnički:
group photo podrška još ne postoji i predstavlja implementacioni gap.

---

# 128. SHARE ADDRESS TO ACTIVE PARTICIPANTS

Requester sa više aktivnih worker-a dobija na task-group nivou:

**Podeli adresu aktivnim učesnicima**

Tap otvara confirm:

Podeliti adresu ovim učesnicima?

✓ Marko
✓ Nikola
✓ Jelena

[ Podeli adresu ]

Default su aktivni učesnici.
Otkazani i završeni kojima više ne treba pristup nisu automatski uključeni.

Posle toga svaki worker ima sopstveni bilateralni grant.

Requester i dalje može iz individualnog Dogovora:
- podeliti;
- opozvati;

samo toj osobi.

---

# 129. AKTIVNI I ZAVRŠENI SARADNICI U TASK GRUPI

Dok je task aktivan:

Glavni prikaz pokazuje samo aktivne saradnike kao primarne redove.

Završeni/otkazani:
- ne nestaju;
- idu u sekundarnu „Ranije saradnje“ zonu.

Primer:

AKTIVNI
Nikola · Dogovoreno
Jelena · Čeka potvrdu

RANIJE SARADNJE
Marko · Otkazan

Na collapsed task kartici eventualno:
`2 aktivna · 1 ranije`

ali samo kada je korisno.
Ne guramo sve statuse u jednu liniju.

---

# 130. PREDLOG IZMENE NA PREGLEDU

Predlog izmene ne sme da bude sakriven iza menija ako čeka moj odgovor.

Ako druga strana predloži:

╭────────────────────────────────────╮
│ Predlog izmene čeka Vaš odgovor   │
│                                    │
│ TERMIN                             │
│ Sada:    Subota 10–14             │
│ Predlog: Subota 12–16             │
│                                    │
│ Važe stari uslovi dok ne odgovorite.│
│                                    │
│ [ Prihvatite ]                       │
│   Odbijte                          │
╰────────────────────────────────────╯

Ako sam ja predložio:

╭────────────────────────────────────╮
│ Vaš predlog čeka odgovor           │
│                                    │
│ TERMIN                             │
│ Sada:    Subota 10–14             │
│ Predlog: Subota 12–16             │
│                                    │
│ [ Povucite predlog ]                 │
╰────────────────────────────────────╯

Kompletno uređivanje novih uslova može i dalje da se otvori kao poseban flow.

---

# 131. NAZIV OTKAZIVANJA

U UX-u preferiramo:

**Otkažite saradnju**

umesto hladnog:
**Otkaži Dogovor**

Kada postoji više worker-a:
naziv uključuje osobu:

**Otkažite saradnju sa Markom**

Confirm jasno kaže:

`Ovo otkazuje samo saradnju sa Markom. Ostali Dogovori na zadatku ostaju aktivni.`

Ako Marko pokriva 2 mesta:
`Ponovo će biti slobodna 2 mesta.`

Tehnički entitet ostaje Agreement.
Korisnički tekst može biti prirodniji.

---

# 132. WIREFRAME A — DOGOVORI / REQUESTER / VIŠE WORKER-A

Dogovori

DOGOVORI                              [Raspored] [Filter]

ČEKA VAS · DANAS · SLEDEĆE
(prema stvarnom sadržaju; sekcije bez sadržaja se ne prikazuju)

DANAS

┌────────────────────────────────────┐
│ Selidba stana                      │
│ 17:00–20:00 · Liman                │
│                                    │
│ 👥 3/3 dogovoreno                  │
│ Marko · Nikola                     │
│                         2 saradnje  │
└────────────────────────────────────┘

Tap:

Selidba stana
17:00–20:00 · Liman
3/3 dogovoreno

[ Poruke grupi ]

┌────────────────────────────────────┐
│ Marko                              │
│ 2 osobe · 8.000 RSD                │
│ Dogovoreno                     →   │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ Nikola                             │
│ 1 osoba · 4.000 RSD                │
│ Dogovoreno                     →   │
└────────────────────────────────────┘

---

# 133. WIREFRAME B — DOGOVORI / WORKER

Dogovori

ČEKA VAS / DANAS / SLEDEĆE
(sekcije se prikazuju samo kada imaju sadržaj)

DANAS

┌────────────────────────────────────┐
│ Selidba stana                      │
│ Ana                                │
│ 17:00–20:00 · Liman                │
│ 8.000 RSD ukupno                   │
│ Dogovoreno                         │
└────────────────────────────────────┘

Tap → bilateralni Dogovor.

---

# 134. WIREFRAME C — INDIVIDUALNI DOGOVOR / PREGLED

[←] Selidba stana                    [⋯]

Marko
Uskače · 2 osobe

[ Pregled ] [ Poruke ]

Dogovoreno
Kada završite, označite da je zadatak gotov.

VAŽEĆI USLOVI

8.000 RSD ukupno

Subota 10:00–14:00

Obim
Prenos nameštaja iz stana do kombija...

KOMUNIKACIJA I MESTO

Poruke u aplikaciji                     →

Adresa još nije podeljena.
[ Podeli lokaciju ]

HRONOLOGIJA
Dogovor sklopljen · 28. okt

[ Zadatak je gotov ]

⋯ meni:
Izmeni uslove
Otkaži saradnju
Prijavi problem
Prijavi/blokiraj osobu

### Requester varijanta
Nema `Zadatak je gotov` ako je to worker-ova radnja.
Footer kaže šta se trenutno čeka od druge strane.

---

# 135. WIREFRAME D — PORUKE / NEMA GRUPE

[←] Selidba stana

Marko
[ Pregled ] [ Poruke ]

────────────────────────

        Ćao, krećem oko 16:45.
                                  ✓

Odlično, vidimo se.

[ + ]  Poruka...              [mikrofon]

Nema `Svi učesnici / Privatno`
jer grupa ne postoji.

---

# 136. WIREFRAME E — PORUKE / GRUPA POSTOJI

[←] Selidba stana

[ Pregled ] [ Poruke ]

[ Svi učesnici ] [ Privatno ]

Svi učesnici
Ana · Marko · Nikola

────────────────────────

Ana
Parking je u dvorištu.

Marko
Stižem u 16:55.

          Ja
          Važi, vidimo se tamo.

[ + ]  Poruka grupi...

Mala pomoć:
`Ove poruke vide svi učesnici zadatka.`

---

# 137. WIREFRAME F — REQUESTER / PRIVATNO

[ Svi učesnici ] [ Privatno ]

Privatno sa Markom                    [Promeni]

────────────────────────

Marko
Da li treba da ponesem kolica?

          Ja
          Ne treba, imamo ih.

[ + ]  Poruka...

Tap `Promeni`:

Privatna poruka

Marko
Nikola
Jelena

---

# 138. WIREFRAME G — PORUKE TAB / INBOX

Poruke

Razgovori o Vašim zadacima

┌────────────────────────────────────┐
│ Selidba stana                 16:42│
│ Vi: Krećemo u 17h                  │
│ Privatno · Marko                   │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ Selidba stana                 16:37│
│ Gde se parkiramo?               3  │
│ Grupa · 3 osobe                    │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ Montaža TV-a                   Juče│
│ Fotografija                        │
│ Privatno · Nikola                  │
└────────────────────────────────────┘

Unread broj samo tamo gde server stvarno daje pouzdan broj.

---

# 139. WIREFRAME H — PODELI ADRESU SVIMA

Podeliti adresu aktivnim učesnicima?

Ovu lokaciju će moći da vide dok imaju
aktivan pristup kroz svoj Dogovor.

✓ Marko
✓ Nikola

21000 Novi Sad
Liman 3
Ulaz iz dvorišta

[ Podeli adresu ]

Odustani

Posle uspeha:
`Adresa je podeljena sa 2 učesnika.`

---

# 140. WIREFRAME I — WORKER TRAŽI ADRESU

Dogovor / Pregled

Adresa još nije podeljena.

[ Zatraži adresu ]

Tap:

Poruke / Privatno

Draft je već upisan:
`Možete li da podelite tačnu adresu?`

[ Pošalji ]

Aplikacija ništa nije poslala bez worker-ovog tapa.

---

# 141. WIREFRAME J — PREDLOG IZMENE

Dogovor / Pregled

Predlog izmene čeka Vaš odgovor

Cena
Sada:     8.000 RSD
Predlog:  9.000 RSD

Termin
Sada:     Subota 10–14
Predlog:  Subota 12–16

Važeći uslovi ostaju na snazi dok ne odgovorite.

[ Prihvati predlog ]

Odbij predlog

Završetak je privremeno nedostupan dok
se predlog ne reši.

---

# 142. WIREFRAME K — OTKAZIVANJE JEDNE SARADNJE

Otkaži saradnju sa Markom?

Ovo otkazuje samo ovu saradnju.

Ostali Dogovori na zadatku ostaju aktivni.

Marko trenutno pokriva 2 mesta.
Ta 2 mesta će ponovo biti slobodna.

Razlog
[ Ne mogu više da organizujem ovaj termin... ]

Odustani

[ Otkaži saradnju ]

---

# 143. WIREFRAME L — POSLE OTKAZIVANJA

Selidba stana

1/3 dogovoreno
2 mesta slobodna

AKTIVNO

Nikola
1 osoba · Dogovoreno

RANIJE SARADNJE

Marko
Otkazan · Vi
„Ne mogu više da organizujem ovaj termin.“

Ako server dozvoljava preostalu potragu:
task može nastaviti da traži zamenu.

---

# 144. WIREFRAME M — ZATVOREN CHAT

Selidba stana
Marko

[ Pregled ] [ Poruke ]

...istorija poruka...

────────────────────────

Dogovor je zatvoren.
Poruke možete samo da čitate.

Nema composer-a.

---

# 145. AGREEMENT + GROUP + MESSAGES — STATUS POSLE WIREFRAME PASS-A

Sada su funkcionalno i kompoziciono definisani:

- Dogovori lista;
- requester task-group logika;
- worker list;
- bilateralni Dogovor;
- Pregled | Poruke;
- private conversation;
- group conversation;
- group/private channel switching;
- requester private picker;
- Poruke inbox;
- message recovery;
- group membership privacy;
- exact location sharing;
- address request;
- multi-worker address share target;
- accepted terms;
- agreement change proposal;
- flexible task → exact term inside Agreement;
- cancellation jednog workera;
- capacity reopening posle cancellation-a;
- group membership posle cancellation-a;
- read-only terminal chat;
- problem/safety separation.

Još nije finalno:
- finalni visual design;
- group photo backend;
- address batch RPC;
- finalni notification copy;
- full completion/rating flow, koji se obrađuje u sledećem domenu.

Sledeći veliki domen:
**CALENDAR + COMPLETION + RATINGS**

Prelazimo na njega tek pošto je ovaj blok sačuvan u Masteru kao kanonski smer.


# 146. CALENDAR + COMPLETION + RATINGS — PRVI KANONSKI PASS

Ovaj domen povezuje tri stvari koje korisniku izgledaju kao jedna životna celina:

1. **Kada imam nešto dogovoreno?**
2. **Kako posao zvanično završavamo?**
3. **Kako ocenjujemo saradnju?**

Tehnički su to odvojeni podsistemi.
Korisniku moraju da deluju kao jedan prirodan tok.

---

# 147. RASPORED — ČEMU SLUŽI

Raspored prikazuje:
**stvarno dogovorene obaveze iz Dogovora.**

Ne meša:
- objavljene zadatke;
- prijave koje još nisu izabrane;
- prilike;
- draftove.

To ostaje zaključano.

Raspored odgovara na pitanje:
**„Šta je stvarno dogovoreno u mom kalendaru?“**

---

# 148. GDE SE OTVARA RASPORED

Raspored nije novi glavni bottom tab.

Ulazi:
- iz Dogovori ekrana;
- iz Početne, kada postoji predstojeći Dogovor;
- iz profila/dostupnosti gde ima smisla;
- iz upozorenja o konfliktu termina.

Glavna navigacija i dalje ostaje:
**Početna · Zadaci · Dogovori · Poruke**

---

# 149. TRI POGLEDA RASPOREDA

Zadržavamo postojeći dobar model:

**Mesec | Nedelja | Dan**

## Mesec

Za brzo snalaženje:
- koji dani imaju Dogovore;
- koji dan je izabran;
- diskretne tačke/oznake.

Ispod meseca:
Dogovori iz izabranog dana.

## Nedelja

Za pregled narednih dana bez ulaska u svaki pojedinačno.

## Dan

Pravi vremenski raspored po satima.

Ovo je najkorisnije kada korisnik stvarno radi više poslova.

Ne dodajemo četvrti/peti pogled.

---

# 150. DVE VRSTE INFORMACIJA U RASPOREDU

## 150.1 Dogovoreni termin

To je tvrda činjenica.

Ako sam worker i imam:
10:00–12:00 Montaža TV-a

to je stvarna zauzetost.

## 150.2 Moja dostupnost

To je moja želja/podešavanje:
`Mogu da radim 14–20h`.

Dostupnost se može prikazati kao blago obojena pozadina/band.

Ne sme da izgleda kao Dogovor.

Dogovor > dostupnost.

---

# 151. HARD CONFLICT — KADA SISTEM BLOKIRA

Hard konflikt važi za **moje potvrđene worker obaveze sa tačnim terminom**.

Primer:

Imam Dogovor:
10:00–12:00 kao worker.

Novi Dogovor / promena termina pokušava:
11:00–13:00.

Sistem odbija prihvatanje tog termina.

Korisnički:

**Termin se preklapa sa drugim Dogovorom.**

[ Otvori Raspored ]

Ne dopuštamo da isti worker potvrdi dva fizički nemoguća rada u isto vreme.

Postojeći backend već ima `worker_calendar_conflict` autoritet i ovo treba zadržati.

---

# 152. REQUESTER PREKLAPANJE NIJE AUTOMATSKI KONFLIKT

Ako sam requester:
- Marko dolazi 17–20;
- Nikola dolazi 17–20;

to nije greška.
To može biti potpuno normalno jer rade isti task zajedno.

Ako sam requester jednog taska i u isto vreme requester drugog:
ne blokiramo automatski.

Razlog:
requester ne mora fizički da radi posao.

Raspored može vizuelno pokazati preklapanje, ali ga ne naziva konfliktom bez stvarnog razloga.

---

# 153. KORISNIK JE REQUESTER I WORKER U ISTO VREME

Ako korisnik ima:
- svoj requester Dogovor;
- svoj worker Dogovor;

worker obaveza je stvarno blokirajuća za nove worker termine.

Requester događaj ostaje informacija.

Ne pravimo globalni „zauzet sam“ samo zato što je korisnik negde requester.

---

# 154. FLEXIBLE DOGOVOR BEZ TAČNOG TERMINA

Ako je originalni task bio:
`Od petka do nedelje`

i izbor je napravljen bez tačnog sata:

Dogovor postoji,
ali ne zauzima sat u kalendaru.

Na vrhu Rasporeda:

**Dogovori bez tačnog termina · 2**

Tap:
- lista tih Dogovora;
- svaki otvara Dogovor;
- ako je dozvoljeno, akcija `Predloži termin`.

Ovo je pravo mesto za preciziranje fleksibilnog taska posle izbora.

---

# 155. NOVI KANON ZA TAČAN TERMIN

Za nove tokove ciljamo samo dva stanja:

1. **tačan početak + tačan kraj**
2. **nema još tačnog termina**

Ne kreiramo novi kanonski „samo početak bez kraja“.

Postojeći kod ume da pročita legacy start-only Dogovor.
To zadržavamo radi kompatibilnosti, ali novi UX ne treba da ga proizvodi.

---

# 156. REMOTE ROK NIJE ISTO ŠTO I RADNI TERMIN

Važna razlika:

`Završi do petka 18h`

nije isto što i:
`Radi petak 16–18h`.

Remote deadline:
- ne treba da blokira dva sata u worker kalendaru;
- treba da se vidi kao rok.

## Ciljni prikaz

U Rasporedu može da postoji:

**Rokovi**
Prevod prezentacije · Petak do 18h

ali ne crtamo blok 16–18h ako to niko nije dogovorio.

## Tehnički gap

Current Agreement calendar projection prvenstveno razume exact interval.

Za čist finalni proizvod treba odvojena deadline činjenica od exact work window-a.

MVP Srbija može prvo da prikaže remote rok u listi/agenda delu, bez busy bloka.

---

# 157. REQUESTER — VIŠE DOGOVORA ISTOG TASKA U KALENDARU

Trenutni calendar model može prikazati svaki bilateralni Dogovor posebno.

To bi za requestera moglo dati:

Selidba stana — Marko  
Selidba stana — Nikola  
Selidba stana — Jelena

sve 17–20.

To je previše.

## Ciljni kanon

Ako više requester Dogovora:
- pripada istom tasku;
- ima isti prihvaćeni exact interval;

Raspored ih prikazuje kao **jedan task događaj**:

**Selidba stana**
17–20 · 3 saradnje

Tap:
otvara task-group kontekst / listu saradnji.

## Ako se termini razlikuju

Ne grupišemo lažno.

Primer:
Marko 17–20
Nikola 18–21

prikazuju se kao dva odvojena termina.

## Tehnički gap

Aktuelni agenda model je Agreement-per-entry.
Potrebna je requester-side task/time agregacija u presentation modelu.

---

# 158. STATUSI U KALENDARU

Kalendar ne treba da ponavlja celu Dogovor logiku.

Dovoljno:

- Dogovoreno
- U toku
- Čeka potvrdu
- Završen
- Problem

Ako nešto stvarno čeka moju akciju:
diskretna attention oznaka.

Tap uvek vodi na Dogovor gde se radnja izvršava.

Kalendar nije action center.

---

# 159. ŠTA SE DEŠAVA KAD SE DOGOVOR OTKAŽE

Otkazani Dogovor prestaje da bude aktivna busy obaveza.

Istorijski podatak ostaje u odgovarajućoj Istoriji.

Ne ostavljamo otkazani termin kao da i dalje blokira worker-a.

Backend calendar projection već ima BLOCKING / RELEASED model i to je dobar temelj.

---

# 160. PROMENA TERMINA DOGOVORA

Kada jedna strana predloži novi exact termin:

- stari termin ostaje važeći dok druga strana ne prihvati;
- novi termin još nije busy commitment.

Pri prihvatanju:
server ponovo proverava worker calendar conflict.

Ako konflikt postoji:
predlog se ne može prihvatiti.

To sprečava race:
dok je predlog čekao, worker je možda prihvatio drugi posao.

---

# 161. ZAVRŠETAK JE BILATERALAN

Završava se **pojedinačni Dogovor**, ne cela grupa jednim klikom.

Worker A može završiti svoj deo danas.
Worker B možda sutra.

Svaki bilateralni Dogovor prolazi kroz svoj completion flow.

Parent task se završava tek kada završeni Dogovori pokriju sva potrebna mesta.

---

# 162. WORKER — „ZADATAK JE GOTOV“

Samo worker na tom bilateralnom Dogovoru može da označi:

**Zadatak je gotov**

Tap prvo otvara kratak pregled.

Prikazuje isključivo prihvaćene uslove:
- task;
- druga strana;
- dogovorena cena;
- dogovoreni broj ljudi;
- dogovoreni termin.

Pitanje:

**Zadatak je gotov?**

`Requester će dobiti zahtev da potvrdi završetak ili prijavi problem.`

[ Da, zadatak je gotov ]

Ne završavamo Dogovor odmah.

---

# 163. POSLE WORKER OZNACI „GOTOVO“

Dogovor prelazi u:

**Čeka potvrdu**

Requester dobija rok od **48 sati**.

Rok je server-owned.
Klijent ga ne računa iz telefonskog vremena.

Worker vidi:

**Čeka se potvrda druge strane**

Requester vidi:

**Završetak čeka Vašu potvrdu**

i tačan rok.

---

# 164. 48 SATI SE NE PRODUŽAVA RETRY-JEM

Ako worker zbog loše mreže ponovi istu radnju:
ne sme da dobije novih 48 sati.

Postojeći P0E server guard već čuva originalni deadline pri replay-u.

To zadržavamo kao kanonsko tehničko pravilo.

---

# 165. REQUESTER — POTVRDA ZAVRŠETKA

Requester vidi:

**Marko je označio da je posao završen.**

Prihvaćeni uslovi:
8.000 RSD
2 osobe
Subota 10–14

Akcije:

[ Potvrdi završetak ]

Prijavi problem

Potvrda otvara još jedan kratak review:

**Potvrditi završetak?**

`Potvrđujete da je ova saradnja završena po prihvaćenim uslovima.`

[ Da, potvrdi ]

Ne tražimo dodatni tekst ako je sve u redu.

---

# 166. AKO REQUESTER NE ODGOVORI

Ako:
- prođe server deadline;
- nema otvorenog problema;

server automatski završava Dogovor.

Ne zavisi od toga da li je aplikacija otvorena.

Scheduler/tick je autoritet.

Korisnički posle toga:

**Dogovor je automatski završen nakon isteka roka za potvrdu.**

Ako server projekcija ne nosi razlog auto završetka:
UI ne izmišlja tu rečenicu.
Tada samo kaže `Dogovor je završen`.

## Tehnički smer

Ako želimo eksplicitni „automatski završeno“ copy, completion projection treba da nosi terminal source/reason.

---

# 167. PROBLEM BLOKIRA AUTO-ZAVRŠETAK

Ako requester ili druga ovlašćena strana prijavi problem:

- problem ostaje vezan za konkretni bilateralni Dogovor;
- automatski completion se zaustavlja;
- rok sam po sebi više ne zatvara Dogovor.

Postojeći server već koristi:
`problem_opened_at is null`
kao uslov auto-completion-a.

To je kanonsko pravilo.

---

# 168. PROBLEM NE ZNAČI AUTOMATSKI KRIVICU

`Prijavi problem` znači:
**postoji spor / nešto treba proveriti.**

Ne znači:
- worker je kriv;
- requester je kriv;
- refund;
- kazna;
- automatski loša ocena.

Problem je stanje saradnje i potencijalni support/safety ulaz.

---

# 169. MANUELNA POTVRDA IAKO JE PROBLEM OTVOREN

Ako su strane problem u međuvremenu rešile:

requester može i dalje svesno da potvrdi završetak, ako server dozvoli.

Review mora jasno reći:

`Problem ostaje evidentiran, ali ovom potvrdom završavate Dogovor.`

To odgovara postojećem completion UX smeru.

---

# 170. PENDING IZMENA BLOKIRA COMPLETION

Ako postoji predlog izmene na čekanju:

worker ne može da označi završetak,
a requester ne može da potvrdi završetak.

Prvo:
- prihvati;
- odbij;
- ili povuci predlog.

Copy:
**Najpre rešite predlog izmene.**

To je postojeće server pravilo.

---

# 171. UNKNOWN OUTCOME — WORKER MARK DONE

Ako worker tapne „Zadatak je gotov“, a mreža prekine:

ne kažemo:
`Nije uspelo`.

Prikaz:

**Proveravamo da li je završetak označen.**

[ Proveri stanje ]

Ista radnja se ne pretvara u drugi completion intent.

---

# 172. UNKNOWN OUTCOME — REQUESTER CONFIRM

Isto pravilo.

Ako nismo sigurni da li je potvrda stigla:

**Ne znamo da li je Dogovor završen.**

[ Proveri stanje ]

Tek readback stanja `COMPLETED` potvrđuje uspeh.

---

# 173. PARENT TASK COMPLETION

Ovo je posebno važno za multi-person.

Task traži 3 mesta.

Marko pokriva 2.
Nikola pokriva 1.

Markov Dogovor → COMPLETED.
Nikolin → još aktivan.

Parent task:
**nije završen.**

Tek kada COMPLETED Dogovori iza SELECTED prijava pokrivaju sva 3 mesta:
parent task postaje COMPLETED.

Postojeći `sync_need_completion` već radi upravo ovaj zbir.

Zadržavamo.

---

# 174. AKO JEDAN DOGOVOR BUDE OTKAZAN TOKOM IZVRŠENJA

Primer:
Marko 2 mesta — completed.
Nikola 1 mesto — cancelled.

Parent task nije kompletno završen.

Pokrivenost completion-om je 2/3.

Task može, prema search authority pravilima:
- tražiti zamenu za 1 mesto;
- ili ostati sa preostalom potragom zatvorenom ako je tako odlučeno.

Ne proglašavamo task završen samo zato što su preostali aktivni Dogovori završeni.

---

# 175. OCENA JE VEZANA ZA ZAVRŠEN BILATERALNI DOGOVOR

Svaka strana ocenjuje drugu stranu svog Dogovora.

Requester ocenjuje worker-a.
Worker ocenjuje requestera.

Kod taska sa 3 worker-a:
requester može imati tri zasebne ocene za tri saradnje.

Grupa se ne ocenjuje kao jedna osoba.

---

# 176. KO MOŽE DA OCENI

Samo učesnik COMPLETED Dogovora.

Ne:
- običan applicant;
- neko ko je samo bio u grupi;
- otkazani Dogovor u MVP review modelu;
- korisnik van Dogovora.

Current review service već zahteva completed Agreement.

To zadržavamo.

---

# 177. REVIEW WINDOW — CILJNI KANON

Nakon completion-a obe strane imaju:

**14 dana da ostave ocenu.**

Ako obe strane ocene ranije:
obe ocene se objavljuju tada.

Ako samo jedna oceni:
njena ocena se objavljuje kada istekne 14 dana.

Posle 14 dana:
novu ocenu više nije moguće poslati.

## Zašto

Dvosmerni marketplace ima rizik osvetničkih ocena.

Airbnb i Airtasker koriste isti osnovni princip: review postaje javna kada obe strane pošalju ili po isteku 14-dnevnog roka.

## Tehnički gap

Current review backend dozvoljava submit posle completion-a, ali nema ovaj blind publication window kao kanonski model.

Potrebni su:
- review deadline;
- unpublished/submitted stanje;
- publish-at/both-submitted logic;
- public aggregates koji koriste samo publishable reviews.

---

# 178. OCENA SE NE MENJA POSLE SLANJA

USKOČI smer ostaje:

**jedan submit, finalna ocena.**

Pre slanja postoji review/warning.

Posle potvrđenog submit-a:
ocena se ne uređuje.

To je jednostavnije i već odgovara trenutnom kodu.

Ako review krši pravila:
moderation/support može da ga ukloni po pravilima, ali korisnik ne piše novu zamenu automatski.

---

# 179. RATING SCREEN — OSNOVNI SADRŽAJ

Na vrhu:
- osoba koju ocenjujem;
- njena uloga u toj saradnji;
- naziv taska.

Zatim:

**Kako je prošla saradnja?**

★ ★ ★ ★ ★

1 = Loše  
2 = Ispod očekivanja  
3 = Dobro  
4 = Vrlo dobro  
5 = Odlično

Ocena 1–5 je obavezna.

---

# 180. TAGOVI

Current tag catalog:

- Po dogovoru
- Pažljivo
- Jasna komunikacija
- Na vreme
- Pouzdano
- Uz poštovanje

Najviše 3.
Nisu obavezni.

## Product pravilo

Ovi tagovi su pozitivni.
Kod niske ocene ih ne guramo kao obavezno pitanje.

Naslov treba biti neutralan:

**Ako nešto od ovoga važi**

a ne:
`Šta je bilo odlično?`

Korisnik sa 1–3 zvezdice može:
- preskočiti tagove;
- napisati komentar ako želi.

Kasnije možemo uvesti strukturirane problem-tagove kao poseban katalog, ali ne uvodimo ih bez moderation/abuse dizajna.

---

# 181. KOMENTAR

Opciono.

Najviše 500 znakova kada comment funkcija postoji.

Primer:
`Napišite kratko iskustvo koje može pomoći drugima.`

Ne:
- privatni telefon;
- tačna adresa;
- lični podaci;
- uvrede/pretnje.

Current comment gate već ima deo zaštite od objavljivanja kontakta i to treba zadržati.

---

# 182. BLIND REVIEW — ŠTA KORISNIK VIDI POSLE SLANJA

Posle save-a:

**Ocena je sačuvana.**

Ako druga strana još nije ocenila:

`Vaša ocena će biti objavljena kada druga strana pošalje svoju ocenu ili kada istekne rok za ocenjivanje.`

Ne prikazujemo šta je druga strana dala pre nego što se blind period otključa.

Ako obe strane već ocenile:
`Ocene su objavljene.`

---

# 183. ROLE-SCOPED REPUTATION

Zaključano:

**reputacija requestera i reputacija workera nisu ista stvar.**

Ako me Marko oceni dok sam requester:
to utiče na moj REQUESTER profil.

Ako Ana mene oceni za posao koji sam radio kao worker:
to utiče na moj WORKER profil.

Ne sabiramo ta dva identiteta u jednu zvezdicu.

## Dobar postojeći temelj

Received review projekcija već nosi:
`receivedAs: WORKER | REQUESTER`.

Public profile takođe ima role-aware projekciju.

## Tehnički rizik/gap

`reviewsClientService.reputation(accountId)` je generički account aggregate helper.

Finalni UI ne sme da ga koristi kao jedinu reputaciju za obe uloge.

Worker trust već ima poseban WORKER trust model.
Requester trust/public aggregate treba da bude jednako jasno definisan.

---

# 184. RELIABILITY NIJE ISTO ŠTO I STAR RATING

Worker profil može imati dve različite vrste poverenja:

## Ocena
Kako su ljudi ocenili saradnju.

## Pouzdanost
Npr. koliko vezanih Dogovora je završeno u odnosu na worker-ova otkazivanja.

Ne spajamo ih u jedan magični skor.

Primer:

★ 4,8 · 27 ocena  
92% završeno kako je dogovoreno

samo ako server dozvoljava da je reliability javna.

Current Work Trust već ima minimum uzorka pre prikaza procenta.

To je dobar smer.

---

# 185. REQUESTER REPUTATION

Requester public profil treba analogno da odgovori na pitanja koja worker-a zanimaju:

- prosečna ocena kao requester;
- broj requester ocena;
- završene saradnje / relevantan trust signal;
- eventualno member since.

Ne kopiramo worker reliability formulu na requester bez posebnog smisla.

Ovo pripada sledećem Profile domenu, ali review pipeline mora sačuvati ulogu.

---

# 186. OCENA NE SME DA BUDE USLOV DA SE NASTAVI

Posle completion-a:
korisnik može da nastavi da koristi aplikaciju bez ocenjivanja.

Ocena je poziv, ne blokada.

Može biti:
- `Čeka Vas` na Početnoj;
- attention u Dogovori listi;
- CTA u završenom Dogovoru.

Ne zaključavamo aplikaciju modalom.

---

# 187. NOTIFIKACIJE COMPLETION + REVIEW

Ciljni događaji:

Worker označio gotovo:
→ requester dobija „Marko je označio da je zadatak završen.“

Pred istek 48h:
→ requester reminder, ako je smislen i nije otvoren problem.

Auto completion:
→ obe strane dobijaju informaciju da je Dogovor završen.

Review available:
→ obe strane dobijaju poziv za ocenu.

Review window nearing end:
→ diskretan reminder ako još nije ocenio.

Both reviews published:
→ opciona informacija / nema potrebe za agresivnim push-om.

Notification transport se rešava u finalnom cross-product pass-u.

---

# 188. WIREFRAME A — RASPORED / MESEC

[←] Raspored                         Danas

[ Mesec ] [ Nedelja ] [ Dan ]

Dogovori bez tačnog termina · 1

          Oktobar 2026
Po Ut Sr Če Pe Su Ne
...
19 20 21 22 23 24 25
26 27 28 29 30 31

28. oktobar

┌────────────────────────────────────┐
│ Selidba stana                      │
│ 17:00–20:00 · Liman                │
│ Vaš zadatak · 2 saradnje          │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ Montaža TV-a                       │
│ 20:30–21:30 · Grbavica             │
│ Uskačeš · Ana                      │
└────────────────────────────────────┘

Na dnu:
Moja dostupnost →

---

# 189. WIREFRAME B — RASPORED / DAN

Raspored
[ Mesec ] [ Nedelja ] [ Dan ]

Sreda, 28. oktobar

07:00 ──────────────────────
08:00
...
17:00        ╭─────────────────────╮
             │ Selidba stana      │
             │ Vaš zadatak       │
             │ 2 saradnje         │
20:00        ╰─────────────────────╯

20:30        ╭─────────────────────╮
             │ Montaža TV-a       │
21:30        │ Uskačeš · Ana      │
             ╰─────────────────────╯

Blaga pozadina pored sata:
`Mogu da radim`

Availability je pozadina, Dogovori su stvarni blokovi.

---

# 190. WIREFRAME C — BEZ TAČNOG TERMINA

Dogovori bez tačnog termina

┌────────────────────────────────────┐
│ Prenos stvari                      │
│ Od petka do nedelje                │
│ Termin još nije dogovoren          │
│                                    │
│ [ Predloži termin ]                │
└────────────────────────────────────┘

Tap `Predloži termin`
→ Agreement change flow.

Ne vraća korisnika u prijavu.

---

# 191. WIREFRAME D — KONFLIKT TERMINA

Ne možete da prihvatite ovaj termin.

Predlog:
Subota 11:00–13:00

Već imate Dogovor:
Montaža TV-a
Subota 10:00–12:00

[ Otvori Raspored ]

Nazad

Ne nudimo „Prihvati ipak“.

---

# 192. WIREFRAME E — WORKER ZAVRŠETAK

Sheet:

Zadatak je gotov?

Selidba stana
Ana

Dogovoreni termin
Subota 10–14

Dogovoreni broj ljudi
2 osobe

Dogovoreno ukupno
8.000 RSD

Druga strana će dobiti zahtev da potvrdi
završetak ili prijavi problem.

[ Da, zadatak je gotov ]

---

# 193. WIREFRAME F — REQUESTER ČEKA POTVRDA

Dogovor / Pregled

Završetak čeka Vašu potvrdu

Marko je označio da je posao završen.

Potvrdite do:
30. oktobar · 14:32

[ Potvrdi završetak ]

Prijavi problem

Ako ne reagujete do roka i nema prijavljenog
problema, Dogovor se završava automatski.

---

# 194. WIREFRAME G — PROBLEM OTVOREN

Dogovor / Pregled

Problem je prijavljen

Automatski završetak je zaustavljen.

Opis problema
„Jedan deo posla nije završen...“

[ Poruke ]

Ako je situacija rešena i želite da završite saradnju:

[ Potvrdi završetak ]

Podrška / dalje rešavanje problema →

---

# 195. WIREFRAME H — ZAVRŠENO

Dogovor je završen

Selidba stana
Marko

8.000 RSD
2 osobe
Subota 10–14

[ Oceni saradnju ]

Poruke ostaju dostupne za čitanje.

---

# 196. WIREFRAME I — OCENA

[←] Ocena saradnje

[avatar]
Marko
Uskočer · Selidba stana

Kako je prošla saradnja?

☆ ☆ ☆ ☆ ☆

Vrlo dobro

Ako nešto od ovoga važi
[ Po dogovoru ] [ Na vreme ]
[ Pouzdano ] [ Jasna komunikacija ]
[ Pažljivo ] [ Uz poštovanje ]

Nije obavezno · najviše 3

Komentar
[ Napišite kratko iskustvo... ]

Ocenu posle slanja ne možete da menjate.

[ Sačuvaj ocenu ]

---

# 197. WIREFRAME J — OCENA SAČUVANA / BLIND

              ★★★★★

        Ocena je sačuvana.

Vaša ocena: 5 od 5
Po dogovoru · Na vreme · Pouzdano

Ocena će biti objavljena kada i druga strana
pošalje svoju, ili po isteku roka za ocenjivanje.

Rok za ocenjivanje:
11. novembar

[ Nazad na Dogovore ]

---

# 198. WIREFRAME K — OBE OCENE OBJAVLJENE

Saradnja je ocenjena

Vaša ocena za Marka
★★★★★

Ocena druge strane za Vas
★★★★☆

Ako review privacy pravila dozvoljavaju:
komentar se prikazuje u odgovarajućem profilu/reviews delu.

Ovaj ekran nije obavezan zaseban page.
Može biti stanje završenog Dogovora.

---

# 199. CALENDAR + COMPLETION + RATINGS — TEHNIČKI GAPOVI

1. **Requester calendar grouping**
   - current agenda je Agreement-per-entry;
   - treba task + same-window presentation agregacija za requester ulogu.

2. **Remote deadline**
   - exact interval i deadline moraju biti različite činjenice;
   - deadline ne sme da pravi busy interval.

3. **New canonical schedule**
   - novi Dogovori proizvode exact start+end ili no-exact-term;
   - start-only ostaje samo legacy read compatibility.

4. **Blind review window**
   - current reviews se čuvaju direktno;
   - treba 14-day deadline i publish gating.

5. **Role-scoped public reputation**
   - review already knows received role;
   - final aggregates/public surfaces moraju striktno razlikovati REQUESTER i WORKER.

6. **Requester trust**
   - worker Work Trust ima razvijeniji model;
   - requester trust treba poseban kanon, ne kopiju worker reliability-ja.

7. **Auto-completion source**
   - ako UI treba da kaže da je završeno automatski, projection mora nositi razlog/source; status COMPLETED sam nije dovoljan.

8. **Notifications**
   - event emission/transport za completion/review treba proveriti u završnom notifications pass-u.

---

# 200. ŠTA ZADRŽAVAMO IZ POSTOJEĆEG KODA

- Raspored čita samo Dogovore;
- Month / Week / Day;
- worker availability je odvojena od busy calendar-a;
- confirmed exact worker Agreements su autoritativni busy termini;
- calendar conflict se proverava na serveru;
- Dogovor bez exact termina ne zauzima sat;
- termin se može predložiti iz Agreement change flow-a;
- worker jedini označava posao gotov;
- requester jedini potvrđuje završetak;
- 48h deadline je server-owned;
- replay ne produžava deadline;
- problem blokira auto completion;
- pending change blokira completion;
- auto completion radi serverski, ne iz otvorene aplikacije;
- parent Need completion sabira COMPLETED coverage;
- review je dozvoljen tek za COMPLETED Agreement;
- ocena je 1–5;
- do 3 taga;
- optional komentar kada backend/build podržava;
- successful review se ne menja;
- review submit ima unknown-outcome readback zaštitu;
- received review već nosi `receivedAs: WORKER | REQUESTER`.

---

# 201. STATUS POSLE OVOG DOMENA

Funkcionalno i kompoziciono sada su obrađeni:

- šta ulazi u Raspored;
- Mesec/Nedelja/Dan;
- availability;
- worker busy authority;
- conflict;
- requester overlaps;
- flexible Agreement bez termina;
- remote deadline pravilo;
- requester task grouping u kalendaru;
- termin change;
- worker completion;
- requester confirmation;
- 48h auto completion;
- problem;
- multi-worker parent completion;
- rating eligibility;
- star rating;
- tags;
- comment;
- blind review;
- review deadline;
- role-scoped reputation.

Sledeći veliki domen:
**PROFILE + ACCOUNT + SAFETY**

Tu treba konačno povezati:
- jedan nalog / dve javne uloge;
- worker profil;
- requester profil;
- reputaciju po ulozi;
- dostupnost;
- javni profil;
- podešavanja;
- privatnost;
- blokiranje/prijave;
- zatvaranje naloga;
- podršku;
- legal/account flows.

Tek kada i taj domen završimo, radi se završni cross-product pass cele aplikacije.


# 202. PROFILE + ACCOUNT + SAFETY — PRVI KANONSKI PASS

Ovaj domen zaključava kako jedna osoba postoji u USKOČI-ju kada može istovremeno:
- da traži pomoć;
- da uskače drugima;
- da ima različitu reputaciju u te dve uloge;
- da upravlja privatnošću, bezbednošću i nalogom.

Osnovni princip:
**jedan nalog, jedna ličnost, dve moguće javne uloge.**

Ne pravimo dva naloga.
Ne pravimo globalni prekidač „sada sam requester / sada sam worker“.

---

# 203. TRI NIVOA PROFILA

Da proizvod ostane razumljiv, razlikujemo tri stvari.

## 203.1 Nalog / lični identitet

Zajedničko za celu osobu:
- ime;
- profilna fotografija;
- autentifikacija;
- email/login;
- podešavanja;
- privatnost;
- blokirane osobe;
- izvoz;
- zatvaranje naloga.

Ovo nije „requester profil“ niti „worker profil“.
Ovo je osoba.

## 203.2 Profil „Kao naručilac“

Kako druga strana vidi korisnika kada on traži pomoć.

Nosi requester reputaciju i činjenice relevantne za tu ulogu.

## 203.3 Profil „Kao uskočer“

Kako druga strana vidi korisnika kada on želi da radi.

Pored zajedničkog identiteta nosi:
- radne sposobnosti/kategorije;
- područje rada;
- remote/on-site mogućnosti;
- dostupnost;
- kapacitet tima;
- licence kada su relevantne;
- radni opis;
- worker reputaciju i worker trust.

---

# 204. IME I FOTOGRAFIJA — JEDAN IZVOR ISTINE

Ciljni product kanon:

**ime i glavna profilna fotografija pripadaju nalogu, ne svakoj ulozi posebno.**

Ako je osoba:
- Marko kao requester;
- Marko kao worker;

ne treba da uređuje dva različita imena i dve različite fotografije.

Role profil može imati:
- drugačiji naslov;
- drugačiji opis;
- drugačije činjenice;

ali ne drugi identitet.

## Tehnički gap

Aktuelna arhitektura i dalje ima odvojene REQUESTER/WORKER profile i istorijski može nositi različita display name polja.

Finalni kod treba da:
- definiše shared account identity kao autoritet;
- role profile projections referenciraju taj identitet;
- postojeće različite vrednosti se bezbedno migriraju/usaglase;
- nijedan ekran ne traži da korisnik održava dva imena.

Current worker UI već ide ka ovome kroz „ime naloga“.

---

# 205. MOJ PROFIL — GLAVNI HUB

Moj profil nije kontrolna tabla od dvadeset kartica.

Na vrhu:

[profilna fotografija]

Miloš Šljivić

Jedan nalog · obe mogućnosti

Novi Sad / područje, samo ako zaista postoji kao account-safe podatak.

Ispod:
kratak pregled dve uloge.

---

# 206. REPUTACIJA NA MOM PROFILU — NEMA JEDNE ZVEZDICE NALOGA

Ne prikazujemo jednu mešanu ocenu tipa:

`★ 4,8`

ako ona sabira requester i worker iskustvo.

Umesto toga:

REPUTACIJA

Kao naručilac  
★ 4,9 · 12 ocena

Kao uskočer  
★ 4,8 · 23 ocene  
92% pouzdanost

Ako neka uloga još nema ocene:
`Još nema ocena`

Ako worker profil nije aktivan:
ne prikazujemo lažne worker brojke.

## Tehnički gap

Aktuelni `AccountReputation` helper je account-oriented.
Finalni hub mora da koristi role-scoped projekcije.

---

# 207. MOJ PROFIL — PREDLOŽENA STRUKTURA

Posle identiteta:

## Reputacija
Kao naručilac
Kao uskočer

## Uskačem
Radni profil
`Aktivan · Selidbe, dostava · Novi Sad + 20 km`

ili:
`Još nije podešen`

## Moje aktivnosti
- Moji zadaci
- Moje prijave
- Moj raspored

## Nalog i pomoć
- Podešavanja
- Pomoć i podrška

Ne moramo da držimo šest velikih odvojenih kartica ako se mogu organizovati u dve mirne sekcije.

---

# 208. „POGLEDAJ KAKO ME DRUGI VIDE“

Ako korisnik ima samo requester javni profil:
otvara se requester javni profil.

Ako ima aktivan worker profil:
ne biramo worker profil automatski i ne skrivamo requester lice.

Tap:
**Pogledajte kako Vas drugi vide**

otvara izbor:

**Kao naručioca**
**Kao uskočera**

Ako postoji samo jedna aktivna javna uloga:
otvara je direktno.

Ovo je jasnije od trenutnog ponašanja koje preferira worker profil čim je aktivan.

---

# 209. PUBLIC REQUESTER PROFIL — SADRŽAJ

Requester profil treba da bude kratak.

Primer:

[avatar]
Ana M.

Kao naručilac

★ 4,9 · 18 ocena
23 završene saradnje

Na USKOČI-ju od oktobra 2026

[Identitet potvrđen] — samo kada server to zaista kaže.

O meni
— samo ako u budućnosti uvedemo zajednički account opis ili requester opis.

Na dnu:
**Prijavite ili blokirajte osobu**

## Ne prikazivati
- privatni email;
- telefon;
- tačnu kućnu adresu;
- njene worker sposobnosti ako gledam requester profil;
- worker reliability.

---

# 210. PUBLIC WORKER PROFIL — SADRŽAJ

[avatar]
Marko P.

Kao uskočer

Selidbe · Dostava · Pomoć u kući

Novi Sad i okolina
Na lokaciji · Na daljinu ako profil to podržava

★ 4,8 · 27 ocena
42 završena Dogovora
92% pouzdanost — samo kada je javno i ima dovoljan uzorak

O meni
„Radim selidbe i dostavu...“

Relevantne potvrde/licence
— samo ono što server može bezbedno da potvrdi.

Na USKOČI-ju od...

Na dnu:
**Prijavite ili blokirajte osobu**

## Ne prikazivati
- broj prijava koje je slao;
- procenat prihvaćenih prijava ako nije kanonski definisan;
- privatni radijus kao preciznu kućnu lokaciju;
- tehničke profile state kodove;
- alat/vozila kao listu u MVP-u.

---

# 211. REQUESTER PROFIL NE TREBA POSEBAN SETUP FLOW

Za traženje pomoći korisnik ne treba da prolazi kroz veliki „napravite requester profil“.

Dovoljno:
- nalog;
- ime;
- fotografija opciono;
- legal/required consents.

Requester javna reputacija nastaje korišćenjem.

Trenutni requester writer koji praktično uređuje samo display name treba da se u finalnom proizvodu preseli iza zajedničkog `Lični podaci` iskustva, a ne da izgleda kao zaseban profilni proizvod.

---

# 212. RADNI PROFIL — ČEMU SLUŽI

Radni profil odgovara na pitanje:

**„Za koje zadatke USKOČI sme da me uzme u obzir i šta naručilac treba da zna o meni?“**

On nije CV od pet stranica.

MVP činjenice:

- radne kategorije / sposobnosti;
- kratak radni opis;
- područje rada;
- on-site / remote mogućnosti;
- dostupnost;
- „dostupan sada“ ako se koristi;
- kapacitet tima;
- licence/potvrde gde su stvarno relevantne.

Ne:
- inventar alata;
- inventar vozila;
- gomila polja bez uticaja na matching ili odluku.

Aktuelni worker service već je počeo da penzioniše tools/vehicles write putanju, što se poklapa sa ovim smerom.

---

# 213. AI INTERVJU ZA RADNI PROFIL

Zadržavamo dobar koncept:

**„Ispričajte čime se bavite“**

Asistent vodi razgovor i izvlači:
- kategorije;
- radni opis;
- način rada;
- područje;
- dostupnost.

Ali:
AI ne aktivira profil sam.

Tok:
AI predloži
→ korisnik pregleda
→ korisnik potvrdi
→ canonical saved
→ profil se aktivira tek kada obavezne stvari postoje.

---

# 214. AKTIVACIJA RADNOG PROFILA

Minimalno za aktivaciju:

- zajedničko ime naloga postoji;
- najmanje jedna radna sposobnost/kategorija;
- područje rada ili odgovarajući remote scope je definisan.

Broj ljudi nije trajna činjenica Radnog profila.

Ako worker za konkretan zadatak obezbeđuje više ljudi:
broj navodi u toj prijavi.

Dostupnost može da bude prazna bez zabrane profila ako korisnik ručno pretražuje zadatke, ali matching `Za mene` tada mora biti oprezan.

## Trenutni kod
Postojeća aktivacija već traži ime + grad/oblast + bar jednu veštinu.
Finalni model treba uskladiti sa novim geography/remote pravilima, ne slepo sa starim poljem `city`.

---

# 215. PODRUČJE RADA

Ne pitamo korisnika za „grad“ samo zato što tabela ima grad.

Treba ljudski:

**Gde želite da uskačete?**

Primer:
Novi Sad + 20 km

Moguće:
- na lokaciji;
- na daljinu;
- oba.

Za on-site:
područje/radijus.

Za remote:
lokacija nije uslov za remote zadatke.

Ne prikazujemo javno tačnu kućnu adresu workera.

---

# 216. DOSTUPNOST

Dostupnost nije isto što i Dogovor.

Korisnik može da kaže:
- ponedeljak 17–21;
- subota 09–18;
- dostupan sada;
- privremeno nisam dostupan.

To pomaže:
- `Za mene`;
- notifications/dispatch;
- konflikt logici.

Potvrđeni Dogovor ima veći autoritet.

Ako availability kaže slobodan, a Dogovor ga zauzima:
Dogovor pobeđuje.

---

# 217. „DOSTUPAN SADA“

Ako ga zadržimo u MVP-u:

to je privremeni signal, ne večni toggle.

Mora imati:
- jasno trajanje/expiry;
- lako gašenje;
- bez pretvaranja da je korisnik zauvek online za rad.

Ako backend nema pouzdan expiry:
bolje ga ne isticati dok se ne definiše.

---

> **SUPERSEDED za finalni product:** nema trajnog `team_capacity` u Radnom profilu; broj ljudi pripada prijavi (S04/E), server guard je implementation DELTA H/I. Ovaj deo je istorijski dokaz starog modela.

# 218. TEAM CAPACITY

Radni profil nosi:
**Koliko ljudi realno možete da obezbedite u jednoj prijavi?**

Default:
1

Primer:
do 3 osobe

Application stepper nikad ne nudi više od:
- preostalih task mesta;
- potvrđenog team capacity-ja.

Server ostaje finalni autoritet.

---

# 219. LICENCE I VERIFIKOVANE ČINJENICE

Razlikujemo:

**Korisnik je naveo**
i
**USKOČI/partner je potvrdio**

Ne prikazujemo samodeklarisanu licencu kao verifikovanu.

Ako verification infrastruktura nije aktivna:
UI ne kaže „potvrđeno“.

MVP može da čuva licence kao podatak uz jasno poreklo, ali verified badge samo kad server potvrdi.

---

# 220. IDENTITET — MVP PRAVILO

Ako identitetska verifikacija još nije stvarno puštena:
- ne blokiramo obične MVP zadatke njome;
- ne prikazujemo „verifikacija nedostupna“ po ekranima;
- badge se pojavljuje samo kada postoji stvarna potvrda.

Kasnije određene kategorije mogu zahtevati potvrđen identitet.

To mora biti posebno product/policy pravilo, ne slučajna posledica tehničkog flag-a.

---

# 221. PODEŠAVANJA — INFORMACIONA ARHITEKTURA

Predlog jednostavniji od trenutnog rasutog profila:

## Nalog
- Lični podaci
- Pristup i bezbednost naloga

## Iskustvo
- Obaveštenja
- Razgovori sa asistentom

## Privatnost i podaci
- Privatnost
- Blokirane osobe
- Izvoz podataka
- Pravila i saglasnosti

## Pomoć
- Pomoć i podrška
- Prijavi grešku
- O aplikaciji

Na dnu:
- Odjavi se

Unutar Privatnost i podaci, na dnu:
- Zatvori nalog

Ne stavljamo destructive account closure među svakodnevna podešavanja.

---

# 222. LIČNI PODACI

Jedno mesto za:
- ime;
- profilnu fotografiju;
- eventualni shared account opis ako ga kasnije uvedemo.

Ne tražimo:
- dupliranje requester/worker imena;
- radne sposobnosti;
- availability.

Radni podaci ostaju u Radnom profilu.

---

# 223. EMAIL / LOGIN / LOZINKA

Ovo je nalog, ne javni profil.

Email:
- nikada javno;
- ne koristi se kao kontakt između učesnika.

Promena lozinke / auth provider:
- u `Pristup nalogu`.

Ako je nalog Google/Apple-only i nema lokalnu lozinku:
UI ne treba da nudi neupotrebljivu „Promeni lozinku“ radnju.

Auth surface treba da prati stvarni provider.

---

# 224. OBAVEŠTENJA — PODEŠAVANJA

Korisnik ne treba 30 tehničkih event type toggle-a.

Grupe:

## Zadatci i prilike
- nove prilike koje mi odgovaraju;
- odgovori/prijave na moje zadatke.

## Dogovori
- izbor / novi Dogovor;
- izmene;
- završetak;
- otkazivanje;
- problem.

## Poruke
- privatne poruke;
- grupne poruke.

## Podsetnici
- predstojeći Dogovor;
- completion confirmation;
- ocena pre isteka roka.

Email/push kanali se prikazuju samo ako zaista postoje i rade.

---

# 225. PRIVATNOST — GLAVNI EKRAN

Korisniku treba da odgovori:

- šta je javno;
- šta se deli tek posle Dogovora;
- koga sam blokirao;
- kako da dobijem kopiju svojih podataka;
- koliko se šta čuva;
- kako da zatvorim nalog.

Ne prikazujemo interne dataset nazive bez prevoda.

---

# 226. ŠTA JE JAVNO

Javno, zavisno od konteksta i uloge:

- ime;
- profilna fotografija;
- role-specific javni profil;
- role-specific ocena;
- broj ocena ako je dozvoljen;
- završeni relevantni Dogovori/count;
- worker capabilities koje smo odlučili da budu javne;
- približan grad/područje kada je product-safe.

Nije javno:
- email;
- telefon;
- puna adresa;
- tačna kućna lokacija;
- auth account id;
- interni matching podaci;
- privatne prijave;
- privatne poruke.

---

# 227. BLOKIRANJE — ŠTA TAČNO ZNAČI

Blokiranje:
- zaustavlja običan kontakt;
- sprečava nova povezivanja;
- par se ne pojavljuje jedno drugom tamo gde safety policy to zahteva.

Ali ako postoji aktivan Dogovor:
moraju i dalje moći da:
- završe;
- otkažu saradnju;
- prijave problem;
- koriste potrebne formalne radnje.

Blokiranje ne sme da zarobi aktivnu saradnju u stanju koje niko ne može da reši.

Ovo već odgovara postojećem safety modelu.

---

# 228. ODBLOKIRANJE

Odblokiranje:
- ponovo dopušta buduće interakcije kada druga pravila to dozvole;

ali NE vraća:
- staru dozvolu za tačnu lokaciju;
- stare kontakt grantove;
- poruke koje osoba nije smela da vidi tokom blokade;
- retroaktivnu group history.

To je važno privacy pravilo i već odgovara postojećem sistemu.

---

# 229. PRIJAVA OSOBE

`Prijavi osobu` i `Blokiraj` nisu ista radnja.

Report:
- ide privatno USKOČI podršci/safety sistemu;
- druga osoba ne dobija sadržaj prijave;
- može biti vezan za Task, Dogovor ili konkretan kontekst.

Kategorije u MVP-u:
- Uznemiravanje
- Prevara
- Nebezbedan rad
- Diskriminacija
- Drugo

Forma:

Razlog
[kratko]

Šta se dogodilo?
[opciono/detaljnije]

[ Pošaljite prijavu ]

Zatim odvojeno:
`Blokiraj ovu osobu` ako korisnik to želi.

Ne blokiramo automatski samo zato što je report poslat, osim ako buduća safety politika izričito zahteva.

---

# 230. REPORT PRIVATNOST

Druga osoba:
- ne vidi da ste je prijavili kroz običan product UI;
- ne vidi kategoriju;
- ne vidi razlog/narativ.

Safety/support operator ima odgovarajući pristup.

Ako proceduralno/legalno kasnije mora postojati obaveštenje:
to je zasebna policy odluka, ne nešto što UI sada obećava apsolutno za sva vremena.

---

# 231. BLOCK CONFIRM

**Blokirati Marka?**

`Nećete moći normalno da kontaktirate jedno drugo niti da pravite nova povezivanja.`

`Ako već imate aktivan Dogovor, završetak, otkazivanje saradnje i prijava problema ostaju dostupni.`

[ Odustani ]

[ Blokiraj osobu ]

---

# 232. BLOKIRANE OSOBE

Podešavanja → Privatnost → Blokirane osobe

Marko P.  
[ Odblokiraj ]

Ana M.  
[ Odblokiraj ]

Tap osobe može da otvori ograničeni public-safe profil samo ako server to dozvoli.

Ne prikazujemo:
- „oni su blokirali Vas“;
- incoming block list.

Postojeći safety service namerno ne otkriva incoming blocks.
Zadržavamo.

---

# 233. POMOĆ I PODRŠKA — MENTALNI MODEL

USKOČI ima pravi support case sistem.

To je bolje od:
„Pošaljite email supportu“.

Korisnik može:
- pročitati FAQ;
- otvoriti novi zahtev;
- videti svoje zahteve;
- odgovoriti u postojećem zahtevu;
- dobiti odluku;
- kada je podržano, tražiti ponovni pregled.

---

# 234. PODRŠKA — JEDNOSTAVNE TEME

Ne prikazujemo interne channel/topic kodove.

Korisnik bira ljudski:

- Tehnički problem
- Problem sa saradnjom
- Osoba se nije pojavila
- Problem sa objavom zadatka
- Privatnost i podaci
- Drugo

Safety prijava osobe ide primarno kroz Safety flow, ne kroz generičan support form.

---

# 235. SUPPORT KONTEKST

Velika prednost sadašnjeg sistema:

support case može biti vezan za:
- Task;
- Dogovor;
- konkretnu privatnu poruku;
- grupnu poruku;
- review/publikaciju;
- safety report.

To zadržavamo.

Primer:
u Dogovoru → `Pomoć za ovu saradnju`

support forma već zna:
`Selidba stana · Dogovor sa Markom`

Korisnik ne kopira ID-jeve.

---

# 236. SUPPORT ODLUKA NE MENJA TIHO DOMAIN OBJEKAT

Current support decision model ima `effect: NONE`.

To znači:
sama tekstualna odluka supporta ne sme magično:
- promeniti cenu;
- završiti Dogovor;
- promeniti rating;
- izbrisati Task.

Ako support odluka treba da proizvede stvarnu domain radnju:
mora postojati zasebna autorizovana izvršna radnja/servis i jasan audit.

Ovo je važno tehničko pravilo.

---

# 237. SUPPORT SLA

Ne obećavamo:
`Odgovaramo za 24h`

dok takva operativna obaveza stvarno ne postoji.

UI može reći:
`Pratite odgovor u Mojim zahtevima.`

Bez lažnog roka.

---

# 238. PRAVILA I SAGLASNOSTI

Korisnik može da vidi:
- Uslove korišćenja;
- Politiku privatnosti;
- verziju/datum kada je relevantno.

Ako se objavi nova obavezna verzija:
korisnik mora da pregleda/prihvati aktuelni bundle pre radnji koje to zahtevaju.

Acceptance je:
- vezan za tačnu verziju/hash;
- replay-safe;
- ne prihvatamo stari dokument ako se u međuvremenu promenio.

Postojeći legal servis je dobar temelj.

---

# 239. IZVOZ PODATAKA

Zadržavamo realan lifecycle:

Nije traženo
→ Zahtev poslat
→ U pripremi
→ Spremno
→ Isteklo / nije dostupno / neuspeh / otkazano

Korisnik može:
- zatražiti kopiju;
- pratiti stanje;
- sačuvati kada je spremna;
- otkazati zahtev pre obrade kada pravila dozvoljavaju;
- opozvati spremnu kopiju kada je dostupna.

Ne obećavamo da je fajl spreman dok server to ne potvrdi.

---

# 240. ROKOVI ČUVANJA

Privacy ekran može da objasni:
- koju vrstu podataka čuvamo;
- zašto;
- koliko;
- kada se brišu;
- izuzetke.

Ali korisniku prikazujemo ljudske nazive:
`Poruke`, `Dogovori`, `Podaci naloga`, `Podrška`, itd.

Ne:
`AGREEMENT_MESSAGES_V5`.

Ako retention policy nije objavljena/ready:
ne izmišljamo rok.

---

# 241. ZATVARANJE NALOGA — NIJE „OBRIŠI ODMAH“

Zatvaranje je ozbiljan proces.

Pre početka sistem proverava da li postoji:

- aktivan Dogovor;
- otvoren zadatak;
- aktivna prijava;
- radnja sa nepoznatim ishodom / pending workflow;
- pravni retention hold.

Ako postoji:
nalog ne može još da se zatvori.

Korisnik dobija listu:
**Šta prvo treba da rešite**

svaka stavka vodi na pravo mesto.

---

# 242. BLOCKER COPY PRI ZATVARANJU

Primer:

Pre zatvaranja naloga završite:

**Aktivni Dogovori**  
Imate 2 aktivne saradnje.  
[ Otvori Dogovore ]

**Otvoreni zadaci**  
Imate 1 objavljen zadatak.  
[ Otvori Moje zadatke ]

**Aktivne prijave**  
Imate prijave koje još čekaju odgovor.  
[ Otvori Moje prijave ]

Ne:
`ACTIVE_AGREEMENT`
`PENDING_WORKFLOW`.

---

# 243. IZVOZ PRE ZATVARANJA

Pre irreverzibilnog početka nudimo:

**Preuzmite kopiju svojih podataka**

To je preporuka, ne obavezna prepreka osim ako zakon/policy kasnije nalaže.

Zatvaranje ekran linkuje na Izvoz.

---

# 244. POČETAK ZATVARANJA

Final confirm mora biti vrlo jasan:

**Pokrenuti zatvaranje naloga?**

`Nakon pokretanja pristup običnim funkcijama biće ograničen. Proces uklanjanja podataka ne možete opozvati iz aplikacije.`

`Neki minimalni zapisi mogu ostati onoliko dugo koliko zahtevaju objavljena pravila čuvanja ili zakonske obaveze.`

[ Odustani ]

[ Pokreni zatvaranje naloga ]

Ne koristimo neprecizno:
`Sve će odmah biti zauvek obrisano.`

---

# 245. ZATVARANJE U TOKU

Korisnik vidi stvarno stanje:

**Zatvaranje je u toku**

- završeni koraci;
- preostale provere;
- eventualni izuzeci;
- retention informacije.

Ako mrežni odgovor nije potvrđen:
ne tvrdimo da je obrisano.

Unknown outcome mora da se proveri istim retained intentom.

Postojeći closure journal je dobar tehnički temelj.

---

# 246. TERMINALNO ZATVOREN NALOG

Tek kada server autoritativno potvrdi terminalno stanje:

**Nalog je zatvoren**

Tada:
- aktivne sesije završene;
- login podatak/obični privatni sadržaj uklonjen prema policy-ju;
- fajlovi očišćeni prema execution receipt-u;
- minimalni pseudonimni zapisi ostaju samo ako pravila to zahtevaju.

UI ne koristi reč „obrisano“ za ono što je zapravo samo ograničeno/retained.

---

# 247. PROFILNA FOTOGRAFIJA

Jedna account fotografija.

Moguće radnje:
- dodaj;
- promeni;
- ukloni.

Public role profil koristi isti portret.

Ako upload ishod nije poznat:
stara potvrđena fotografija ostaje prikazana dok se nova ne potvrdi.

---

# 248. JAVNI PROFIL — SHEET ILI PAGE

Za kontekstualni pregled druge osobe:
**sheet** je pravi default.

Primer:
Candidate → tap ime/avatar → public profile sheet.

Agreement → tap osoba → public profile sheet.

Ne napuštamo glavni tok samo da bismo proverili reputaciju.

Za sopstveni preview iz Moj profil:
može koristiti isti sheet, sa role selectorom pre otvaranja.

---

# 249. PROFILE + ACCOUNT + SAFETY — WIREFRAME A / MOJ PROFIL

Moj profil

              [avatar]

           Miloš Šljivić
      Jedan nalog · obe mogućnosti

REPUTACIJA

┌────────────────────────────────────┐
│ Kao naručilac                      │
│ ★ 4,9 · 12 ocena                   │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ Kao uskočer                        │
│ ★ 4,8 · 23 ocene · 92% pouzdanost │
└────────────────────────────────────┘

USKAČEM
Radni profil
Aktivan · Selidbe, dostava · 20 km     →

MOJE
Moji zadaci                            →
Moje prijave                           →
Moj raspored                           →

NALOG
Podešavanja                            →

Pomoć i podrška                        →

[ Pogledajte kako Vas drugi vide ]

---

# 250. WIREFRAME B — ROLE PREVIEW

Kako Vas drugi vide?

[ Kao naručioca ]

[ Kao uskočera ]

Ako worker profil nije aktivan:
`Kao uskočera` kaže:
**Radni profil još nije javno aktivan.**

[ Otvori radni profil ]

---

# 251. WIREFRAME C — RADNI PROFIL

[←] Radni profil

Profil je aktivan ✓

ČIME USKAČETE
Selidbe · Dostava · Pomoć u kući
[ Izmeni kroz razgovor ]

PODRUČJE
Novi Sad + 20 km
Na lokaciji
[ Izmeni ]

DOSTUPNOST
Pon–Pet 17–21
Sub 09–18
[ Izmeni ]

KAPACITET
Do 2 osobe u prijavi
[ Izmeni ]

O MENI
Radim selidbe i dostavu...

LICENCE
B kategorija — navedeno
[ upravljanje ako relevantno ]

[ Pogledaj javni profil kao uskočer ]

---

# 252. WIREFRAME D — JAVNI REQUESTER PROFIL

Ana M.

[avatar]

Kao naručilac

★ 4,9
18 ocena

23 završene saradnje

Identitet je potvrđen ✓
— samo ako postoji potvrda

Na USKOČI-ju od oktobra 2026

Prijavi ili blokiraj osobu                →

---

# 253. WIREFRAME E — JAVNI WORKER PROFIL

Marko P.

[avatar]

Kao uskočer

Selidbe · Dostava

★ 4,8
27 ocena

42 završena
92% pouzdanost

O MENI
Radim selidbe...

PODRUČJE
Novi Sad i okolina

POTVRDE
Identitet je potvrđen
B kategorija — ako je verifikovano

Na USKOČI-ju od...

Prijavi ili blokiraj osobu                →

---

# 254. WIREFRAME F — BEZBEDNOST

Bezbednost
Marko P.

PRIJAVI OSOBU

Kategorija
[ Uznemiravanje              ▾ ]

Kratak razlog
[ __________________________ ]

Dodatni opis
[ __________________________ ]
[ __________________________ ]

[ Pošaljite privatnu prijavu ]

────────────────────────

BLOKIRANJE

Blokiranje zaustavlja običan kontakt i nova
povezivanja. Postojeći Dogovor i dalje možete
da završite ili otkažete.

[ Blokiraj osobu ]

---

# 255. WIREFRAME G — PODEŠAVANJA

Podešavanja

NALOG
Lični podaci                           →
Pristup nalogu                         →

ISKUSTVO
Obaveštenja                            →
Razgovori sa asistentom                →

PRIVATNOST I PODACI
Privatnost i podaci                    →

POMOĆ
Pomoć i podrška                        →
Prijavi grešku                         →
Pravila i saglasnosti                  →
O aplikaciji                           →

              Odjavi se
          korisnik@example.com

---

# 256. WIREFRAME H — PRIVATNOST I PODACI

Privatnost i podaci

ŠTA JE JAVNO
[ Pročitaj šta drugi mogu da vide ]

ROKOVI ČUVANJA
[ Otvori pravila ]

MOJI PODACI
Izvoz podataka                         →
Blokirane osobe                        →
Pravila i saglasnosti                  →

────────────────────────

ZATVARANJE NALOGA
[ Zatvori nalog ]

---

# 257. WIREFRAME I — ZATVARANJE BLOKIRANO

Zatvaranje naloga

Pre zatvaranja naloga završite sledeće:

Aktivni Dogovori
Imate 2 aktivne saradnje.
[ Otvori Dogovore ]

Otvoreni zadaci
Imate 1 otvoren zadatak.
[ Otvori Moje zadatke ]

Aktivne prijave
2 prijave još čekaju odgovor.
[ Otvori Moje prijave ]

[ Proveri ponovo ]

Pokreni zatvaranje naloga
— disabled dok postoje blockers.

---

# 258. WIREFRAME J — ZATVARANJE READY

Zatvaranje naloga

Posle pokretanja:
- pristup nalogu se ograničava;
- obični privatni podaci i fajlovi se uklanjaju
  kroz provereni proces;
- određeni minimalni zapisi mogu ostati prema
  objavljenim pravilima čuvanja;
- proces se ne može opozvati iz aplikacije.

Tvoji podaci
[ Izvoz podataka ]

[ Osveži pregled ]

[ Pokreni zatvaranje naloga ]

---

# 259. WIREFRAME K — POMOĆ

Pomoć i podrška

Najčešća pitanja
[ Kako biram osobu?                  ]
[ Kako rade poruke?                  ]
[ Šta ako saradnja ne ide dobro?     ]

MOJI ZAHTEVI
#1042 · Problem sa saradnjom
Čeka Vaš odgovor                         →

#1038 · Tehnički problem
Zatvoren                                 →

[ Novi zahtev ]

---

# 260. PROFILE + ACCOUNT + SAFETY — ŠTA ZADRŽAVAMO IZ KODA

- jedan profilni hub bez globalnog role moda;
- requester + worker profile rows kao server granice dok se shared identity ne usaglasi;
- revision-bound requester name write;
- worker profile activation i AI interview;
- worker availability odvojena od Dogovora;
- public-safe profile projection;
- public profile sheet;
- optional verified identity fact;
- worker Work Trust sa minimum sample pravilom;
- safety report sa kontekstom;
- revision/idempotency za block;
- incoming blocks se ne otkrivaju;
- block ne sprečava rešavanje postojećeg Dogovora;
- unblock ne vraća stare grantove;
- paged blocked list;
- support cases sa Task/Agreement/Message referencama;
- support history / decisions / appeal model;
- legal bundle version/hash acceptance;
- data export lifecycle;
- published retention policy read;
- account closure blockers;
- closure intent journal / unknown outcome recovery;
- staged erasure/retention semantics.

---

# 261. PROFILE + ACCOUNT + SAFETY — TEHNIČKI GAPOVI

1. **Shared identity**
   - backend i dalje ima profile-scoped display values;
   - target je jedno account ime + jedna account fotografija.

2. **Role-scoped own reputation**
   - own Profile hub ne sme koristiti jedan blended AccountReputation.

3. **Requester trust**
   - treba definisati requester public trust/reputation projection jednako ozbiljno kao worker.

4. **Public role preview**
   - current own preview bira worker kada je active;
   - target daje izbor Requester / Worker.

5. **Worker geography**
   - activation ne treba zauvek zavisiti od legacy `city` ako novi area/remote model ima bolju istinu.

6. **Available now expiry**
   - mora biti vremenski ograničen ako ga javno koristimo.

7. **Identity verification**
   - feature/policy mora biti stvarno aktivan pre nego što bude hard requirement.

8. **Support effects**
   - support decision `effect: NONE` ne menja domain objekat;
   - gde support treba da izvrši korekciju, treba autorizovan execution flow.

9. **Closure authority consolidation**
   - u kodu postoje istorijski preparation + noviji execution slojevi;
   - finalni UI koristi samo aktuelni policy-bound closure authority i njegove terminalne receipts.

10. **FAQ copy drift**
   - postojeći FAQ još koristi staro `Otkaži Dogovor`;
   - target copy koristi `Otkaži saradnju`;
   - adresa se ne „vidi automatski posle izbora“, već tek po grant-u.

11. **Notifications preferences**
   - finalne grupe moraju biti vezane za stvarno emitovane evente i push transport, ne samo UI toggle-e.

---

# 262. STATUS POSLE PROFILE DOMENA

Sada su dubinski obrađeni svi glavni funkcionalni domeni:

1. TASK + DISCOVERY
2. APPLICATION + SELECTION
3. AGREEMENT + GROUP + MESSAGES
4. CALENDAR + COMPLETION + RATINGS
5. PROFILE + ACCOUNT + SAFETY

Sledeća faza više nije novi izolovani domen.

Sledeće radimo:
**CROSS-PRODUCT FINAL PASS**

Cilj:
proći celu aplikaciju od prve prijave do zatvaranja naloga i povezati sve što je do sada definisano.

Obavezne teme:
- Početna;
- globalna navigacija;
- Back pravila;
- notification/deep-link ulazi;
- badge/count pravila;
- empty/loading/error/unknown standardi;
- permissions;
- globalni copy;
- screen/action matrix;
- kompletan navigation graph;
- tehnički gap backlog;
- šta tačno ulazi u MVP;
- šta ostaje posle MVP-a.

Tek nakon tog prolaza Master postaje kandidat za:
**COMPLETE PRODUCT SPEC**.

Posle toga:
1. finalni visual system;
2. interaktivni HTML prototip kompletne aplikacije;
3. pregled na telefonu;
4. tek onda produkcioni kod.


# 263. CROSS-PRODUCT FINAL PASS — CELA APLIKACIJA KAO JEDAN PROIZVOD

Svi glavni domeni su sada zasebno razrađeni.

Ovaj prolaz zaključava kako oni rade ZAJEDNO:
- prvi ulaz;
- prijava/registracija;
- Početna;
- globalna navigacija;
- Back;
- obaveštenja;
- deep link/push;
- dozvole telefona;
- badge pravila;
- loading/error/unknown standard;
- komercijalni trenutak;
- MVP granice;
- tehnički backlog.

Cilj:
korisnik ne treba da oseća da prelazi između pet različitih podsistema.

---

# 264. PRVI ULAZ — DVE NAMERE, NE DVE VRSTE NALOGA

Welcome može da ima dve velike početne namere:

**Treba Vam pomoć**
Objavite zadatak

**Želite da uskočite**
Pronađite zadatak

Brand može vizuelno koristiti:
**MENI TREBA. JA MOGU.**

Ali izbor na welcome-u:
- NE pravi trajni requester/worker mod;
- samo pamti šta je korisnik prvo želeo da uradi;
- posle prijave vraća ga u taj tok.

Ispod:
- Prijavite se
- Napravite nalog

Jedan nalog za obe uloge.

Postojeći Entry Intent koncept je dobar temelj upravo zato što je namera, a ne app mode.

---

# 265. POVRATAK POSLE AUTH-A

Ako korisnik tapne:

`Objavite zadatak`

pa mora da napravi nalog:

posle uspešne prijave/registracije nastavlja:
**Nova potreba**

Ne šaljemo ga na generičnu Početnu da ponovo traži istu radnju.

Ako je tapnuo:
`Pronađite zadatak`

nastavlja:
**Zadaci**

Isto važi za zaštićeni deep link:
posle auth-a se vraća na bezbedan originalni cilj kada je i dalje validan.

`returnTarget` je product pravilo, ne samo router detalj.

---

# 266. AUTH — CILJNI MVP

Za prvi Android/Google Play proizvod:

Obavezno:
- email + lozinka;
- potvrda emaila kada server zahteva;
- oporavak lozinke.

Ciljni dodatak:
- Google prijava na Androidu.

Phone OTP:
- prikazuje se samo ako je stvarno uključen na serveru i potpuno podržan.

Apple:
- pripada iOS izdanju, ne Android MVP-u.

## Tehnički gap

Aktuelni klijent implementira:
- email/password;
- optional phone OTP.

OAuth provider flag trenutno namerno ne crta Google/Apple jer klijentski OAuth flow još nije implementiran.

Google Sign-In je implementacioni zadatak ako ostaje u MVP cilju.

---

# 267. REGISTRACIJA — NE TRAŽI PODATKE PRE NEGO ŠTO TREBAJU

Account creation ne treba da traži radne podatke.

Minimalni cilj:
- ime/prezime ili jedno zajedničko prikazno ime;
- email;
- lozinka.

`Grad` ne treba da bude auth uslov samo zato što worker legacy profil ima city.

Grad/područje se pita:
- pri objavi lokalnog taska;
- pri podešavanju worker područja.

Remote-only korisnik ne treba izmišljati grad da bi napravio nalog.

## Tehnički gap
Aktuelni signup forma još traži grad.

---

# 268. PRAVNI DOKUMENTI PRI ULAZU

Korisnik može da vidi linkove ka:
- Uslovima korišćenja;
- Politici privatnosti.

Ako current bundle zahteva eksplicitno prihvatanje:
radnje koje zahtevaju prihvaćene uslove ne prolaze dok ono nije potvrđeno.

Ne prihvatamo u korisnikovo ime.

Ako se bundle promeni:
novu verziju treba pregledati/prihvatiti kada policy to zahteva.

---

# 269. GLAVNA NAVIGACIJA — KONAČNO

Bottom navigation:

**Početna · Zadaci · Dogovori · Poruke**

To ostaje stabilno.

Ne dodajemo:
- Profil;
- Kalendar;
- Obaveštenja;
- Mapa;
- Prilike;

kao dodatne root tabove.

## Zašto

Početna = sada i sledeće  
Zadaci = discovery / task svet  
Dogovori = prihvaćene saradnje  
Poruke = razgovori

Ostalo je kontekst ili podešavanje.

---

# 270. PROFIL

Profil se otvara kroz avatar/header.

Nije bottom tab.

Razlog:
koristi se povremeno, a četiri bottom taba su svakodnevni radni prostor.

---

# 271. OBAVEŠTENJA

Bell u headeru otvara:
**Aktivnost / Obaveštenja**

To nije isto što i `Poruke`.

Poruke:
razgovori ljudi.

Obaveštenja:
događaji proizvoda:
- stigla prijava;
- izabrani ste;
- predlog izmene;
- završetak;
- problem;
- ocena;
- sistemska informacija.

---

# 272. KALENDAR

Raspored se otvara iz:
- Dogovori;
- Početna / sledeći Dogovor;
- Profile/work availability gde je relevantno.

Nije root tab.

---

# 273. FULL-SCREEN FLOW I BOTTOM BAR

Bottom bar je samo za četiri root ekrana.

Sakriva se na:
- Task detailu;
- AI objavi;
- application formi;
- candidate detailu;
- Dogovor detailu;
- razgovoru;
- profilu/podešavanjima;
- supportu;
- ratingu;
- kalendaru.

Razlog:
dok korisnik rešava konkretnu stvar, dno ekrana pripada toj stvari.

Postojeći navigator već prati ovaj smer.

---

# 274. BACK — OPŠTE PRAVILO

Back znači:
**vrati me tamo odakle sam stvarno došao, sa stanjem koje sam ostavio.**

Ne:
`vrati na hardkodovanu Početnu`

osim kada je ekran otvoren hladnim deep linkom i nema prethodni kontekst.

---

# 275. BACK — DISCOVERY

Mapa/lista → Task detail → Back:

vrati:
- centar mape;
- zoom;
- PEEK/HALF/FULL;
- filtere;
- list scroll;
- selected pin/carousel indeks kada je još validan.

---

# 276. BACK — ZAVRŠENA OBJAVA

Nova potreba
→ Review
→ Objavljeno
→ novi Task

Back ne vraća:
- završeni AI intervju;
- finalni review koji je već potvrđen.

Vraća na smisleni prethodni product kontekst:
Početna / Zadaci / Moji zadaci, prema mestu odakle je flow počeo.

Aktuelni custom navigation već ima deo ove zaštite.

---

# 277. BACK — POSLATA PRIJAVA

Application form
→ Review
→ Poslata

Receipt ima jasne puteve:
- Moje prijave
- Nazad na zadatak

Posle potvrđenog slanja Back ne treba da oživi editable pre-send form kao da prijava nije poslata.

---

# 278. BACK — IZBOR I DOGOVOR

Candidates
→ Candidate
→ Izaberi
→ Dogovoreno
→ Dogovor

Ako korisnik otvori Dogovor:
Back ga vraća na task/candidate kontekst iz kog je došao kada je ta scena još relevantna.

Ako je ceo task već popunjen:
lista kandidata može biti istorijski kontekst, ali ne sme ponovo nuditi stari `Izaberi`.

---

# 279. BACK — PORUKE

Poruke inbox
→ conversation
→ Back
= Poruke inbox na istoj poziciji.

Dogovor
→ Poruke tab
→ Back
= Dogovor / prethodni tab ili prethodni ekran.

Push cold start
→ conversation
→ Back
= Poruke root, ne izlazak iz aplikacije u prazno.

---

# 280. BACK — NOTIFIKACIJA / DEEP LINK

Ako aplikacija već radi:
Back vraća prethodni ekran.

Ako je aplikacija hladno otvorena:
Back vodi na root oblast kojoj cilj pripada:

- task/opportunity → Zadaci;
- application/candidates → Zadaci ili owner task kontekst;
- Agreement/completion/change/rating → Dogovori;
- conversation → Poruke;
- account/support → Profil/odgovarajući settings kontekst.

Ne pokušavamo da izmišljamo ekran koji korisnik nikad nije posetio.

---

# 281. POČETNA — ULOGA

Početna nije feed.

Početna odgovara na:

1. Šta trenutno čeka mene?
2. Šta mi je sledeće stvarno dogovoreno?
3. Želim li sada da tražim pomoć ili da uskočim?
4. Gde su moje glavne aktivnosti?

---

> **SUPERSEDED REDOSLED:** finalno S01 je `Sledeće` (ako postoji) → `Čeka Vas` (ako postoji) → dve intention cards. Stariji tekst ispod ima drugačiji redosled i ne koristiti ga za raspored.

# 282. POČETNA — KONAČNI REDOSLED

Header:
USKOČI / avatar / bell

## 1. Čeka Vas
Samo kada nešto stvarno traži akciju.

Najviše nekoliko redova:
- 3 prijave čekaju Vaš izbor;
- Potvrdite završetak;
- Predlog izmene čeka odgovor;
- Zadatak je izmenjen — pregledajte prijavu;
- Ocena čeka.

Najurgentnije prvo.

## 2. Sledeće
Sledeći Dogovor sa tačnim terminom.

Ako ništa nema:
sekcija ne postoji.

## 3. Dve glavne namere

**Treba Vam pomoć**
Objavite zadatak

**Želite da uskočite**
Pronađite zadatak

## 4. Nastavite započeto
Samo ako postoji AI draft / worker setup koji ima smisla nastaviti.

## 5. Moje
Kompaktni redovi:
- Moji zadaci · 2 aktivna
- Moje prijave · 3 čekaju odgovor
- Dostupnost, samo kada je relevantna za aktivni Radni profil

`Moj raspored` nije stalni Home red; puni Raspored se otvara iz Dogovora i Profila.

Ne prikazujemo pune horizontalne karusele task kartica i application kartica na Početnoj.

## Zašto
Te kartice već imaju svoje prave liste.
Home ostaje miran i akcijski.

---

# 283. FIRST RUN POČETNA

Ako nema:
- taska;
- prijave;
- Dogovora;
- attention-a;

Početna naglašava dve namere i kratko:
**Kako USKOČI radi**

3 koraka, ne tutorijal od deset slajdova.

Primer:

Treba Vam pomoć:
Opišite → izaberite → Dogovorite

Želite da uskočite:
Pronađite → prijavite se → uradite

---

# 284. HOME PARTIAL FAILURE

Ako jedan read ne uspe:
ne rušimo celu Početnu.

Primer:
Dogovori nisu osveženi.

I dalje se vide:
- dve glavne namere;
- Moji zadaci ako su učitani;
- druge potvrđene sekcije.

Current Home već ima dobar partial-read pristup.
Zadržavamo.

---

# 285. OBAVEŠTENJA VS „ČEKA VAS“

Isti događaj može:
- imati notification zapis;
- dati Home attention.

Ali ne mora zauvek da se pojavljuje na oba mesta kao dva zadatka.

Home attention:
**samo trenutno nerešena akcija.**

Notification inbox:
**istorija događaja** dok se ne očisti/arhivira po pravilima.

Kad korisnik reši radnju:
Home row nestaje.
Notification može ostati kao pročitana istorija.

---

# 286. ROOT BADGE PRAVILO

Badge se prikazuje samo kada imamo autoritativan broj.

Ne sabiramo nagađanja iz više parcijalnih read-ova.

## Početna
nema badge.

## Zadaci
nema badge.

## Dogovori
može imati mali attention badge samo ako server daje pouzdan broj Dogovora koji čekaju baš moju radnju.

Ako takav agregat nije autoritativan:
bez badge-a.

## Poruke
numeric badge samo kada server može pouzdano da izbroji unread kroz SVE tipove razgovora.

Trenutno private conversation unread nije potpuno autoritativan.

Zato za MVP:
**ne prikazujemo lažan ukupan numeric badge Poruka.**

Bell/notification inbox može imati svoj autoritativni unread badge ako reader to daje.

---

# 287. NOTIFICATION TARGETS — PRAVILO

Svako obaveštenje koje vodi negde ima:
- opaque event id;
- server resolver;
- authorization check;
- tačan product target.

Push metadata ne nosi:
- tekst privatne poruke;
- privatnu adresu;
- telefon;
- proizvoljnu route putanju sa servera.

Provider metadata je samo bezbedan događaj koji aplikacija razreši posle auth-a.

Postojeći `publicPushTarget` radi upravo po ovom principu.

---

# 288. PUSH / DEEP LINK TARGET MAP

## Nova prilika za workera
→ Task detail / Discovery context.

## Nova prijava na moj task
→ konkretan task → Prijave.

Ako resolver zna konkretnu prijavu:
može je fokusirati.

## Prijava je ažurirana
→ candidates / konkretna application.

## Izabrani ste
→ novi Dogovor.

## Privatna poruka
→ konkretan bilateralni conversation + message.

## Grupna poruka
→ konkretna group conversation + message.

## Predlog izmene
→ Dogovor, direktno stanje predloga.

## Završetak čeka potvrdu
→ Dogovor / completion state.

## Problem
→ Dogovor / problem state.

## Dogovor je završen
→ Dogovor.

## Ocena je dostupna
→ rating flow za konkretan Dogovor.

## Account/legal/support
→ konkretan settings/support ekran.

---

# 289. TRENUTNI PUSH TARGET GAP

Aktuelni public push resolver eksplicitno podržava:
- MESSAGE_RECEIVED;
- OPPORTUNITY_AVAILABLE;
- RESPONSE_RECEIVED;
- RESPONSE_UPDATED;
- generic INBOX.

Još nema isti exact-target model za:
- Selection / izabran;
- Agreement change;
- Completion;
- Problem;
- Rating;
- account/support događaje.

Do javnog launch-a:
kritični događaji moraju dobiti:
- event emission;
- provider delivery;
- exact server target resolver;
- cold/warm navigation test.

Ne rešavati push slanjem sirove route putanje.

---

# 290. STALE NOTIFICATION

Korisnik tapne staro obaveštenje.

Primer:
„Marko je poslao prijavu“
ali je prijava već povučena.

Aplikacija ne otvara polomljen ekran.

Resolver odgovara:
`UNAVAILABLE`

UI:
**Ova prijava više nije dostupna.**

Putevi:
- Otvori zadatak
ili
- Nazad na obaveštenja

samo ako ti targeti mogu bezbedno da se potvrde.

Ne izmišljamo stari sadržaj.

---

# 291. NOTIFICATION SETTINGS — JEDAN NALOG, NE ROLE MODE

Backend može interno imati REQUESTER/WORKER preference kontekst.

UI ne treba da pita:
`Koji ste režim?`

Prikaz je po vrstama događaja:

ZADACI I PRILIKE
- Prilike za Vas
- Prijave na Vaše zadatke

DOGOVORI
- Izbor i novi Dogovor
- Izmene i problemi
- Završetak i ocene

PORUKE
- Privatne poruke
- Grupne poruke

PODSETNICI
- Predstojeći Dogovori

Aplikacija može iza scene zapisati odgovarajuća role-context podešavanja.

---

# 292. QUIET HOURS

Dozvoliti:
**Ne uznemiravaj od 22:00 do 07:00**

Po lokalnoj zoni korisnika.

MVP HITNO je isključen.

Zato:
`urgent overrides quiet hours`
ne prikazujemo u MVP settings-u.

Kasnije, ako HITNO postane stvaran proizvodni mod:
pravilo se ponovo dizajnira.

---

# 293. KADA TRAŽIMO PUSH DOZVOLU

Ne na prvom launch-u.

Najbolji trenutak:
posle prve korisne radnje koja jasno objašnjava vrednost.

Primer:
- korisnik objavi prvi task;
- ili pošalje prvu prijavu.

Pre sistemskog popup-a:

**Želite obaveštenja?**

`Javićemo Vam kada stigne prijava, poruka ili promena Dogovora.`

[ Nastavi ]
Ne sada

Tek `Nastavi` otvara sistemsku dozvolu.

Aktuelni helper već ima upravo ovu product ideju, ali još nije wired u pravi trenutak.

---

# 294. LOCATION DOZVOLA

Ne tražimo lokaciju na launch-u.

Tek kada korisnik izabere:
- `Moja lokacija`;
- `U blizini`;
- `Koristi gde sam`.

Pre sistemskog prozora:
kratko objasniti zašto.

Ako odbije:
manual city/map search i dalje radi.

Nema dead-end-a.

---

# 295. CAMERA / PHOTOS

Dozvola se traži tek kada korisnik:
- izabere Kameru;
- dodaje fotografiju.

Ako odbije kameru:
Galerija/Files mogu ostati dostupni gde platforma dozvoljava.

Ne tražimo sve media dozvole unapred.

---

# 296. MIKROFON

Tek kada korisnik prvi put želi:
- voice message;
- voice AI input;

tražimo mikrofon.

Ako odbije:
text flow ostaje potpuno funkcionalan.

---

# 297. PERMISSION RECOVERY

Ako sistem više ne dozvoljava novi popup:

UI kaže:
**Dozvola je isključena u podešavanjima telefona.**

[ Otvori podešavanja ]

Ne prikazujemo mrtvo dugme koje ponavlja request koji OS više neće pokazati.

---

# 298. GLOBALNI READ STATE STANDARD

Svaki screen razlikuje:

## FIRST LOAD
Još nema potvrđenih podataka.

Mirna loading struktura.
Bez izmišljene vrednosti.

## REFRESH
Stari potvrđeni podaci ostaju.
Diskretan refresh.

## REFRESH FAILED
Stari podaci ostaju.
`Nije osveženo.`

## HARD ERROR
Nema korisnih podataka.
Error state + retry.

## EMPTY
Read je uspeo i zaista nema stavki.

Empty nije isto što i error.

---

# 299. GLOBALNI WRITE STATE STANDARD

Svaka ozbiljna write radnja prolazi:

## EDITABLE
korisnik još bira.

## REVIEW
vidi šta će poslati.

## SENDING
konfliktne kontrole zaključane.

## CONFIRMED
server receipt / autoritativni read potvrđuje.

## KNOWN REFUSAL
server pouzdano kaže da nije prihvaćeno.

## UNKNOWN OUTCOME
mreža/receipt nije potvrdio ni uspeh ni neuspeh.

Tada:
- zamrzavamo isti intent;
- ne pravimo novi različiti;
- nudimo `Proveri stanje`;
- retry koristi isti idempotent intent samo kada je to bezbedno.

Ovo je jedna od najjačih tehničkih osobina sadašnjeg koda.
Zadržavamo je svuda.

---

# 300. GLOBALNI DESTRUCTIVE STANDARD

Destruktivne radnje:
- povuci prijavu;
- otkaži saradnju;
- block;
- revoke location;
- closure;
- delete draft;

imaju confirmation kada posledica nije trivijalno reverzibilna.

Confirm kaže:
1. šta se tačno menja;
2. šta se NE menja;
3. da li se može vratiti.

Ne:
`Da li ste sigurni?`

bez objašnjenja.

---

# 301. COPY STANDARD

Korisniku ne prikazujemo:
- RPC;
- revision;
- hash;
- SQLSTATE;
- entitlement;
- projection;
- stale snapshot;
- UUID;
- canonical.

Prevodi:

`stale`
→ `Podaci su se promenili. Pregledajte ponovo.`

`unknown outcome`
→ `Ne znamo da li je radnja potvrđena. Proverite stanje.`

`overfill`
→ `Prijava pokriva 2 osobe, a ostalo je 1 mesto.`

`grant`
→ `Podeli lokaciju`

`Agreement`
interno može ostati tehnički naziv; UI koristi `Dogovor`.

---

# 302. „VI“ STANDARD

Celokupan finalni UI:
**Vi / Vam / Vas / Vaš**

Stari neformalni copy iz aktuelnog koda, npr. `Tvoja prijava`, `Tvoj zadatak`, `Čeka te`, nije finalni proizvodni copy.

Finalni primeri:
- `Vaša prijava`
- `Vaš zadatak`
- `Čeka Vas`

Trenutni kod ima dosta `ti/tvoj` istorijskog teksta.
To je globalni copy backlog koji mora biti zatvoren pre release-a.

Brand/marketing slogan može ostati:
`MENI TREBA. JA MOGU.`

---

# 303. JEDAN TASK — JEDNA KORISNIČKA PRIČA

Sistem kroz različite tabove ne sme menjati ime istog koncepta.

Primer:

Discovery:
`Selidba stana`

Moja prijava:
`Selidba stana`

Dogovori:
`Selidba stana`

Poruke:
`Selidba stana`

Kalendar:
`Selidba stana`

Support:
`Selidba stana`

Ne stvaramo tehničke naslove iz ID-ja ili različite skraćenice po modulu.

---

# 304. SCREEN / ACTION MATRIX — GLAVNA KIČMA

| Kontekst | Korisnik vidi | Glavna akcija | Sledeće |
|---|---|---|---|
| Welcome | dve namere | Treba pomoć / Uskočite | auth ili cilj |
| Početna | šta čeka + sledeće | reši akciju | konkretan objekat |
| Zadaci local | mapa + lokalna lista | otvori task | Task detail |
| Zadaci remote | puna lista | otvori task | Task detail |
| Public Task | činjenice | Prijavite se | Application |
| Application | ljudi/cena/poruka | Pregledajte | Review |
| Application Review | šta šaljem | Pošaljite | Receipt |
| Owner Task | status + prijave | Pogledajte prijave | Candidates |
| Candidates | ljudi/ponude | otvori kandidat | Candidate detail |
| Candidate | puna prijava | Izaberi | Confirm |
| Selection Confirm | prihvaćeni uslovi | Izaberi | Dogovoreno |
| Dogovori | saradnje | otvori Dogovor | Agreement |
| Agreement Pregled | važeći uslovi | sledeća radnja | change/completion/etc |
| Agreement Poruke | razgovor | pošalji | ostaje chat |
| Group Poruke | svi / privatno | pošalji | ostaje chat |
| Raspored | Dogovori po vremenu | otvori | Agreement |
| Completion worker | accepted facts | Gotovo | AWAITING_REQUESTER |
| Completion requester | zahtev za potvrdu | Potvrdi | COMPLETED |
| Rating | ocena | Sačuvaj | blind waiting/published |
| Profil | nalog + uloge | upravljaj | profile/settings |
| Safety | report/block | pošalji/promeni | receipt |
| Support | zahtev | pošalji/odgovori | case thread |
| Privacy | podaci | izvoz/closure | konkretan flow |

Ovo je product matrica.
Detaljne server komande ostaju u tehničkim poglavljima.

---

# 305. NAVIGATION GRAPH — GLAVNE GRANE

## REQUESTER

Početna
→ Treba Vam pomoć
→ AI Need
→ Review
→ Objavi
→ Moj Task
→ Prijave
→ Izaberi
→ Dogovor
→ Poruke / izvršenje
→ Potvrdi završetak
→ Ocena

## WORKER

Početna / Zadaci
→ Discovery
→ Task
→ Prijava
→ Poslata
→ Moje prijave
→ Izabran
→ Dogovor
→ Poruke / izvršenje
→ Zadatak je gotov
→ Čeka potvrdu
→ Ocena

## SHARED

avatar
→ Moj profil
→ Radni profil / Podešavanja / Privatnost / Support

bell
→ Obaveštenja
→ tačan target

---

# 306. KOMERCIJALNI SLOJ — TRENUTNO STANJE

Aktuelni server ima stvarnu immutable `connection activation` evidenciju pri Selection-u.

Ali policy V1 je eksplicitno:

**PROMOTIONAL_FREE**
**0 RSD**

To znači:
- svaki Selection → Agreement ima platform activation receipt;
- ali korisniku se sada ništa ne naplaćuje;
- cena rada i platform fee su strogo odvojeni.

Ovo je dobra arhitektonska osnova.

---

# 307. POVEZIVANJE — MVP

Za funkcionalni MVP/pilot:

**Povezivanje je promotivno besplatno.**

Ne crtamo lažni payment ekran.

Ne prikazujemo:
`0 RSD checkout`.

Selection ostaje:
Izaberite → Dogovor.

Platforma iza scene zapisuje zero-cost activation.

---

# 308. PAID CONNECTION — BUDUĆA AKTIVACIJA

Raniji poslovni plan predviđa naplatu povezivanja, bez naplate same prijave.

Osnovni princip ostaje:

**Worker ne plaća da bi se prijavio.**

Kada se paid policy aktivira:
platform fee je zaseban od cene rada.

Primer:

Ponuda Marka
8.000 RSD

USKOČI povezivanje
499 RSD

Ne prikazivati:
8.499 RSD kao da je to Markova cena.

---

# 309. PAID SELECTION — CILJNI FLOW

Ako policy za konkretan izbor kaže da je platform fee > 0:

Candidate
→ Izaberi

Confirm prikazuje:

Marko  
8.000 RSD za rad

USKOČI povezivanje  
499 RSD

[ Nastavite na plaćanje ]

Tek kada server potvrdi entitlement/payment:
isti izbor može da nastavi ka Agreement-u.

Ne pravimo Agreement pre nego što paid policy bude zadovoljen.

Retry mora biti vezan za isti selection/payment intent.

---

# 310. MY_PRICE MONETIZATION — OTVORENA POSLOVNA STAVKA

Raniji koncept je imao drugačiji trenutak naplate za `Imam cenu` nego za `Tražim ponude`.

Aktuelni server nema potpuno implementiran paid entitlement model za taj režim.

Zato:
**ne zaključavamo lažni paid MY_PRICE flow u MVP UI.**

Pre paid launch-a treba posebno odlučiti:
- tačan charge trigger;
- šta korisnik dobija za naknadu;
- refund/recovery;
- fiskalni/pravni tretman;
- payment provider;
- invoice/receipt;
- šta ako Task ne dobije dovoljno prijava.

Business ideja ostaje u planu, ali nije produkcioni UI dok nije izvršiva.

---

# 311. MVP RELEASE SCOPE — TRENUTNI KANON

Prvi javni cilj:

- Srbija;
- Google Play / Android;
- srpski UI;
- RSD;
- jedan nalog;
- lokalni + remote zadaci;
- AI objava;
- Discovery mapa/lista;
- prijave;
- multi-person;
- izbor;
- Dogovori;
- privatne poruke;
- grupna koordinacija;
- tačna lokacija kroz grant;
- Raspored;
- completion;
- ocene;
- public profili;
- safety;
- support;
- privacy/export/closure;
- promotivno besplatno povezivanje.

---

# 312. NE ULAZI U PRVI MVP / GATED

- HITNO;
- više valuta;
- više država/market currency;
- iOS/Apple Sign-In;
- plaćeno povezivanje dok checkout/entitlement nije spreman;
- javno deljenje privatnog telefona;
- obavezna identity verification za obične zadatke;
- group voice ako group media backend nije spreman;
- napredni jedinstveni AI ranking kandidata;
- staffing/smene;
- prodaja predmeta.

---

# 313. MVP GAP KOJI MORA BITI ZATVOREN ILI SVESNO DEGRADIRAN

## Group photos

Target MVP ih želi.
Ako backend ne bude spreman:
group chat MVP može privremeno biti text-only,
ALI UI i dokumentacija moraju to jasno tretirati kao privremeno ograničenje.

Ne glumimo da se slike šalju ako server ne podržava.

## Share address to all

Ako batch nije spreman:
requester može deliti adresu pojedinačno po Agreement-u.

Task-level `Podeli svima` se ne prikazuje dok nema recovery-safe server flow.

---

# 314. FINALNI TEHNIČKI BACKLOG — P0 PRE PRODUKCIJE

P0 = greška bi menjala smisao, novac, privatnost ili integritet.

1. **Application termin**
   - client više ne šalje user-proposed alternate term iz application UX-a;
   - fixed task term se prihvata;
   - flexible se rešava kasnije u Agreement-u.

2. **HOURLY multi-person**
   - satnica po osobi × people.

3. **OFFERS price comparison**
   - owner sort ne sme slepo da poredi total kada headcount nije isti.

4. **Role-scoped reputation**
   - nema blended account zvezdice.

5. **Shared identity**
   - jedan name/photo izvor u finalnom UI-ju.

6. **Local Discovery truth**
   - broj/lista ispod mape samo map scope;
   - remote/point-free se ne mešaju.

7. **Spatial cache**
   - povratak na skoro gledanu oblast bez blank refetch-a.

8. **Remote deadline**
   - ne pretvarati rok u lažni calendar busy interval.

9. **Requester calendar grouping**
   - isti task + isti term ne prikazivati kao 3 identična requester bloka.

10. **Blind ratings**
    - ako ratings idu u public MVP, publication window mora biti usklađen sa konačnom 14-day policy odlukom.

11. **Notification target integrity**
    - selection/change/completion/problem/rating događaji dobijaju exact safe target ili se push za njih ne uključuje.

12. **Closure**
    - finalni production route koristi aktuelni policy-bound closure executor, bez mešanja sa starim preparation-only autoritetom.

---

# 315. FINALNI TEHNIČKI BACKLOG — P1

P1 = proizvod radi, ali iskustvo nije kompletno/premium.

1. Google Sign-In Android.
2. Group photo messages.
3. Batch share exact location to active task participants.
4. Requester trust projection.
5. Public role preview selector.
6. New signup bez obaveznog legacy grada.
7. Available-now expiry.
8. Authoritative all-conversation unread count.
9. Group lifecycle status u Poruke inbox-u.
10. Explicit auto-completion source/reason.
11. Precizniji task-change diff za worker applications.
12. Notification permission ask wired posle prvog publish/application uspeha.
13. final notification preference grouping.
14. final FAQ copy.
15. final `Vi/Vam/Vas` copy pass.

---

# 316. FINALNI TEHNIČKI BACKLOG — P2 / POSLE MVP

1. Paid monetization policy + checkout.
2. Multi-currency / NBS normalization.
3. Multi-market.
4. iOS.
5. Apple Sign-In.
6. HITNO.
7. Group voice.
8. richer requester trust.
9. verified identity tiers / category policies.
10. advanced recommendation models.
11. richer review taxonomy.
12. task-wide atomic multi-cancellation ako se ikada pokaže potrebnim.

---

# 317. GLOBALNI VISUAL SYSTEM — ŠTA JE VEĆ ZAKLJUČANO

Pre interaktivnog prototipa imamo dovoljan globalni smer:

- Inter;
- gotovo bela / topla svetla podloga;
- duboka forest/teal brand zelena;
- narandžasta kao karakterističan akcenat;
- bele površine;
- meke, retke senke;
- radius hijerarhija, ne pill svuda;
- 2D funkcionalne ikonice;
- 2.5D samo hero / empty / success;
- bez generičkih AI gradijenata;
- bez card-around-everything;
- jedan dominantan CTA po ekranu;
- sistemske akcije i stanje imaju isti vizuelni jezik kroz celu aplikaciju.

Finalne px/dp vrednosti proveravaju se u prototipu na realnom telefonu.

---

# 318. MOTION — GLOBALNI KANON

Root tab:
instant.

Pushed detail:
kratak directional entrance.

Sheet:
prati prst / kontrolisan settle.

Card press:
vrlo mali physical scale.

Success:
jedan kratak moment, ne konfete svuda.

Map:
camera motion samo kad objašnjava promenu.

Reduce Motion:
svaki flow radi bez dekorativnog kretanja.

---

# 319. ACCESSIBILITY — GLOBALNO

- minimum touch target ~44–48 dp;
- large text ne seče ključne činjenice;
- ne smanjujemo font da bi stao;
- status nikad samo bojom;
- screen reader dobija ljudski naziv stanja;
- interactive card je jedan focus target;
- modal/sheet pravilno preuzima focus;
- slike zadatka imaju smislen opis gde ga imamo, inače su dekorativne;
- dynamic text može povećati visinu kartice.

---

# 320. PRIVATNOST — GLOBALNA LINIJA

Pre Agreement-a:
- približno mesto;
- public-safe profile;
- no phone/address.

Posle Agreement-a:
- bilateralni chat;
- exact location samo uz grant;
- grupa vidi samo group-safe sadržaj;
- bilateralni uslovi ostaju bilateralni.

Posle terminala:
- istorija čitljiva prema pravilima;
- novi privatni grantovi/poruke se zatvaraju.

---

# 321. MASTER — STATUS POSLE CROSS-PRODUCT PASS-A

Ovim je kompletna FUNKCIONALNA produkt arhitektura prvi put povezana od:

Welcome
→ Auth
→ Početna
→ Task
→ Application
→ Selection
→ Agreement
→ Messages
→ Calendar
→ Completion
→ Ratings
→ Profile
→ Safety/Support
→ Privacy
→ Account closure.

Master više nije samo zbir analiza domena.

Sada predstavlja:
**candidate COMPLETE PRODUCT SPEC pre finalnog prototipa.**

---

# 322. ŠTA JOŠ RADIMO PRE HTML PROTOTIPA

Ne počinjemo još production kod.

Pre HTML-a ostaju tri završna dokumentaciona prolaza, U ISTOM MASTERU:

## A. CONSISTENCY PASS
Traži kontradikcije:
- stari `ti` vs `Vi`;
- stari naziv akcije;
- application predlog termina koji je penzionisan;
- HITNO ostatke;
- phone share ostatke;
- tools/vehicles UI ostatke;
- blended rating;
- stare role-mode pretpostavke.

## B. SCREEN INVENTORY + NAVIGATION MAP
Jedna konačna lista:
- koji ekran zaista postoji;
- šta je screen;
- šta sheet;
- šta dialog;
- odakle se otvara;
- šta radi Back.

## C. IMPLEMENTATION DELTA
Za svaki postojeći ekran:
- KEEP;
- MODIFY;
- RETIRE;
- NEW.

I za backend:
- KEEP;
- FIX;
- ADD;
- DEFER.

Tek nakon ta tri prolaza:
**pravimo interaktivni HTML prototip cele aplikacije.**

---

# 323. ŠTA HTML PROTOTIP MORA DA BUDE

Ne galerija nepovezanih ekrana.

Mora biti jedna klikabilna mobilna aplikacija sa mock podacima.

Mora moći da se prođe:

Welcome
→ registracija simulacija
→ Početna
→ objava taska
→ Discovery
→ Application
→ Requester Candidates
→ Selection
→ Dogovor
→ Group/Private Poruke
→ promena termina
→ completion
→ rating
→ Profile
→ Safety
→ Settings
→ Support.

Mora imati i:
- local/remote;
- multi-person;
- error/empty;
- unknown outcome demo;
- cancelled worker/replacement;
- large task group.

Na telefonu treba da izgleda i ponaša se dovoljno blizu finalu da možemo da kažemo:
**„ovo je proizvod koji želimo“**
pre nego što promenimo production kod.


# 324. CONSISTENCY PASS — REZULTAT

Master je prošao prvi globalni consistency pregled posle povezivanja svih domena.

## 324.1 Odluke koje su sada jedinstvene i ne smeju imati staru paralelnu varijantu

### Uloga naloga
Kanon:
**jedan nalog, bez globalnog requester/worker moda.**

### Discovery
Kanon:
- local = mapa + ista lokalna lista;
- remote = puna lista bez mape;
- remote se ne računa u broj ispod mape;
- point-free rezultat se ne ubacuje krišom u map-listu.

### Application termin
Kanon:
**u prijavi nema predlaganja drugog termina.**
- fixed → prihvata se prijavom;
- flexible → prihvata se okvir;
- remote rok → prihvata se rok;
- exact time se, ako treba, dogovara posle Selection-a kroz Agreement change.

### HITNO
Kanon:
**nije MVP funkcija.**
Backend trag može ostati dormant.
Nema:
- quick filtera;
- badge-a;
- posebne cene;
- quiet-hours override UI-ja.

### Tools / vehicles
Kanon:
**nisu opšti MVP UI facts.**
Ne prikazuju se kao Discovery/candidate/public-profile inventar.
Legacy/backend podatak ne diktira UI.

### Public applicant count
Kanon:
worker ne vidi broj drugih prijava.
Requester vidi svoje application count podatke kada su autoritativni.

### Telefon
Kanon:
**privatni broj se ne izlaže u MVP UI-ju.**
Komunikacija ostaje u aplikaciji.
Legacy PHONE grant nije target funkcija.

### Reputacija
Kanon:
**REQUESTER i WORKER reputacija su odvojene.**
Nema jedne blended zvezdice naloga.

### Ratings
Kanon:
- Completed Agreement only;
- 1–5;
- optional tags/comment;
- final after submit;
- ciljni blind period 14 dana;
- objava kada obe strane ocene ili rok istekne.

### Monetizacija
Kanon za MVP:
**PROMOTIONAL_FREE, 0 RSD platform fee.**
Paid connection je kasnija aktivacija posebne policy/payment infrastrukture.
Cena rada i platform fee nikad nisu ista stvar.

---

# 325. FINALNI TERMINOLOŠKI KANON

Finalni UI koristi srpske, ljudske termine.

| Interno / tehnički | Finalni UI |
|---|---|
| Need / Potreba | Zadatak |
| Response / Application | Prijava |
| Selection | Izbor |
| Agreement | Dogovor |
| Worker | Uskočer / osoba koja uskače, prema kontekstu |
| Requester | Naručilac samo gde je jasno; češće „Vi“ / „osoba koja traži pomoć“ |
| Covered slots | Popunjena mesta / broj ljudi |
| Remaining slots | Slobodna mesta |
| Grant | Podeljena dozvola / Podelite lokaciju |
| Stale | Podaci su se promenili |
| Unknown outcome | Ne znamo da li je radnja potvrđena |
| Overfill | Prijava pokriva više ljudi nego što je ostalo mesta |
| Terminal | Završen / Otkazan, prema stvarnom razlogu |

Finalni obraćaj:
**Vi / Vam / Vas / Vaš**

Stari `ti/tvoj` tekst u produkcionom kodu je implementation copy backlog, ne dizajn autoritet.

---

# 326. KONAČNI SCREEN INVENTORY

Ovo nije broj React ruta.
Ovo je broj površina koje korisnik stvarno razume kao ekran, sheet ili dialog.

## 326.1 ENTRY + AUTH

| Površina | Tip | Svrha |
|---|---|---|
| Welcome | Screen | dve početne namere + login/signup |
| Auth login/signup | Sheet/flow | nalog |
| Email confirmation | State | potvrda registracije |
| Password recovery request | Flow | zahtev |
| Password recovery | Screen/flow | nova lozinka |
| Restricted account | State | nalog ograničen |

---

## 326.2 ROOT

| Površina | Tip | Svrha |
|---|---|---|
| Početna | Root screen | šta čeka + sledeće + dve namere |
| Zadaci | Root screen | Discovery |
| Dogovori | Root screen | aktivne saradnje / istorija |
| Poruke | Root screen | conversation inbox |
| Obaveštenja | Pushed screen | istorija događaja |
| Moj profil | Pushed screen | nalog + dve uloge |

---

## 326.3 TASK + DISCOVERY

| Površina | Tip | Svrha |
|---|---|---|
| Local Discovery PEEK/HALF/FULL | One root screen/state | mapa + lokalna lista |
| Remote Discovery | Same root state | puna remote lista |
| Search | Full-screen/search surface | tekst + grad/područje |
| Filters | Sheet | Discovery kriterijumi |
| Selected TASK preview | Floating card | brz pregled pina |
| Selected PLACE carousel | Floating carousel | više taskova na istom mestu |
| Public Task detail | Pushed screen | odluka da li se prijaviti |
| Owner Task detail | Pushed screen | upravljanje sopstvenim taskom |
| Task Q&A | Pushed/detail surface | anonimna pitanja |
| Task photos/viewer | Sheet/viewer | task fotografije |
| Task place editor/viewer | Flow/sheet | lokacija pri objavi/upravljanju |
| Moji zadaci | Pushed list | owned tasks |
| AI Need conversation | Full-screen flow | kreiranje/izmena taska |
| Need review | Full-screen flow | ljudska potvrda pre save/publish |
| Publish success/task landing | Result state | potvrda objave |

---

## 326.4 APPLICATION + SELECTION

| Površina | Tip | Svrha |
|---|---|---|
| Application form | Pushed flow | ljudi + offer + optional note |
| Application review | Sheet | finalna provera |
| Application sent | Result state | potvrda |
| Moje prijave | Pushed list | Aktivne / Čeka Vas / Istorija |
| Changed application review | Expanded/detail state | Keep/Edit/Withdraw |
| Candidate list | Pushed screen | requester bira |
| Candidate detail | Sheet | puna prijava + public profile entry |
| Public profile from candidate | Sheet | trust |
| Selection confirm | Dialog | prihvaćeni uslovi |
| Dogovoreno | Success state | novi Agreement |
| Unknown application/selection | Recovery state | readback iste radnje |

---

## 326.5 AGREEMENT + MESSAGES

| Površina | Tip | Svrha |
|---|---|---|
| Dogovori task-group expanded | Inline state | requester više saradnji |
| Agreement Pregled | Pushed screen/tab | prihvaćeni uslovi + sledeće |
| Agreement Poruke | Same screen/tab | bilateral/group conversation |
| Group channel | Chat state | svi učesnici |
| Private channel | Chat state | bilateralno |
| Private-person picker | Sheet | requester bira worker-a |
| Agreement change form | Pushed flow/sheet | cena/termin/obim |
| Change response | Inline high-priority state | accept/reject |
| Cancellation confirm | Dialog/flow | otkazivanje jedne saradnje |
| Problem report | Sheet/flow | formalni problem |
| Exact location | Section/sheet | grant/reveal |
| Share location to participants | Future sheet | batch grant kada backend postoji |
| Group people/context | Sheet | ko je u grupi |
| Terminal read-only chat | Chat state | istorija bez composer-a |

---

## 326.6 CALENDAR + COMPLETION + RATINGS

| Površina | Tip | Svrha |
|---|---|---|
| Raspored Mesec | Pushed screen/state | dani sa Dogovorima |
| Raspored Nedelja | Same screen/state | naredni dani |
| Raspored Dan | Same screen/state | satnica |
| Bez tačnog termina | Section/list | flexible Agreements |
| Availability editor | Flow | worker raspoloživost |
| Calendar conflict | Blocking state | objasni konflikt |
| Worker completion review | Sheet | „Zadatak je gotov“ |
| Requester completion | Agreement state | potvrdi/problem |
| Problem-open completion state | Agreement state | auto-close blokiran |
| Completed state | Agreement state | završeno |
| Rating form | Pushed flow | ocena |
| Rating saved/blind wait | Result state | čeka objavu |
| Published reviews state | Agreement/profile state | obe ocene / javna reputacija |

---

## 326.7 PROFILE + ACCOUNT + SAFETY

| Površina | Tip | Svrha |
|---|---|---|
| Public requester profile | Sheet | requester trust |
| Public worker profile | Sheet | worker trust |
| Own role preview selector | Sheet | pogled kao requester/worker |
| Worker profile | Pushed screen | work facts |
| Worker AI interview | Full-screen flow | profile AI edit |
| Work area | Flow | geography |
| Availability | Flow | worker availability |
| Personal data | Pushed screen | shared identity |
| Profile photo | Flow | shared portrait |
| Settings | Pushed screen | settings hub |
| Account access/password | Flow | auth settings |
| Notification preferences | Pushed screen | event preferences |
| Privacy & data | Pushed screen | privacy hub |
| Blocked accounts | Pushed list | unblock |
| Safety report/block | Pushed/sheet | report + block |
| Legal & consents | Pushed screen | legal bundle |
| Data export | Pushed flow | export lifecycle |
| Account closure | Pushed flow | blockers + execution |
| About | Pushed screen | build/product info |

---

## 326.8 SUPPORT

| Površina | Tip | Svrha |
|---|---|---|
| Support home | Pushed screen | FAQ + cases |
| New support case | Flow | new case |
| Support case | Conversation screen | history/replies |
| Support decision/appeal | In-case state | decision/review |
| Bug report | Flow | technical report |

---

# 327. POVRŠINE KOJE NISU POSEBAN EKRAN

Ne pravimo rutu samo zato što postoji komponenta.

Primeri:
- PEEK/HALF/FULL = stanja jednog Discovery ekrana;
- TASK/PLACE/CLUSTER = map states;
- application review = sheet;
- candidate detail = sheet;
- selection confirm = dialog;
- group/private = channel state jednog Poruke pogleda;
- Agreement pending change = state Pregleda;
- completion waiting = state Agreement-a;
- role public preview = isti Public Profile sheet sa drugim role source-om;
- error/loading/empty/unknown = states, ne nove rute.

Ovo je važno da HTML i produkcioni kod ne eksplodiraju u stotine „ekrana“.

---

# 328. FINALNI NAVIGATION MAP

## Root
`Početna | Zadaci | Dogovori | Poruke`

## Entry
Welcome
→ Auth ako treba
→ remembered intent

## Requester creation
Početna
→ Treba Vam pomoć
→ AI Need
→ Review
→ Publish
→ Owner Task

## Worker discovery
Početna / Zadaci
→ Discovery
→ Task detail
→ Application
→ Review
→ Sent
→ Moje prijave

## Requester selection
Owner Task
→ Candidates
→ Candidate sheet
→ Confirm
→ Dogovoreno
→ Agreement

## Agreement
Dogovori / Home / Push
→ Agreement
→ Pregled / Poruke

Agreement Pregled može da otvori:
- Change
- Exact location
- Problem
- Cancel
- Completion
- Rating posle završetka
- Public profile

Agreement Poruke može da menja:
- Svi učesnici
- Privatno
- private target picker

## Calendar
Home / Dogovori
→ Raspored
→ Agreement

## Account
Avatar
→ Moj profil
→ Worker profile / Settings / Support

Settings
→ Privacy
→ Export / Blocked / Legal / Closure

## Bell
→ Obaveštenja
→ exact resolved product target

---

# 329. BACK FALLBACK MAP ZA COLD ENTRY

Ako nema stvarne prethodne istorije:

| Cilj | Back fallback |
|---|---|
| Task detail | Zadaci |
| Owner Task | Početna ili Moji zadaci |
| Application detail | Moje prijave |
| Candidate/candidates | Owner Task |
| Agreement | Dogovori |
| Agreement chat | Poruke ako je došlo iz inbox/push-a, inače Agreement |
| Group chat | Poruke ili Agreement prema entry source-u |
| Rating | Dogovori |
| Raspored | Dogovori |
| Public profile | zatvara sheet |
| Support case | Support home |
| Settings child | Settings |
| Privacy child | Privacy |
| Closure | Privacy |
| Notification target unavailable | Obaveštenja |

Navigation source treba da se sačuva kada je poznat.
Fallback se koristi samo kada stvarna istorija ne postoji.

---

# 330. FINALNI GLOBALNI COPY PASS — PRAVILO

Pre HTML prototipa:
- svi user-facing primeri u prototipu biće formalni;
- aktuelni neformalni React Native copy ne kopira se slepo;
- Master je autoritet.

Primeri:

`Tvoja prijava`
→ `Vaša prijava`

`Tvoj zadatak`
→ `Vaš zadatak`

`Čeka te`
→ `Čeka Vas`

`Izaberi`
→ `Izaberite`

`Otvori Dogovor`
→ `Otvorite Dogovor`

`Prijavi problem`
→ `Prijavite problem`

`Otkaži Dogovor`
→ prema kontekstu `Otkažite saradnju`.

Brand slogani i first-person mascots nisu deo ovog grammar pravila.


# 331. IMPLEMENTATION DELTA — PRAVILO

Kada dođe vreme za production kod, ne prepisujemo aplikaciju slepo od nule.

Za svaki postojeći deo koristimo jednu od četiri odluke:

**KEEP**  
Logika/arhitektura je dobra. Čuvati i ne rušiti.

**MODIFY**  
Temelj je dobar, ali UX/copy/pravilo mora da se uskladi sa Masterom.

**RETIRE**  
Ne koristiti više kao proizvodnu površinu. Po potrebi zadržati compatibility redirect za stare linkove.

**NEW**  
Nedostaje pravi capability i treba ga napraviti.

---

# 332. IMPLEMENTATION DELTA — NAVIGACIJA I ENTRY

| Postojeći deo | Odluka | Šta znači |
|---|---|---|
| `src/app/(app)/_layout.tsx` | KEEP + MODIFY | zadržati jedan shell i 4 taba; formal copy/polish |
| `EntryWelcome` | MODIFY | iste dve namere, ali finalni formalni UI + brand copy |
| `auth.tsx` | MODIFY | shared identity, signup bez obaveznog grada, Google Android target |
| `+native-intent.tsx` | KEEP | auth/recovery callback ne sme da curi token u Router |
| return-intent sistem | KEEP + EXTEND | posle auth-a vratiti tačan product cilj |
| `/mapa` redirect | KEEP COMPAT | stari link → Zadaci |
| `/prilike` root redirect | KEEP COMPAT | stari link → Zadaci |
| `/moje-aktivnosti` redirect | KEEP COMPAT | stari link → Početna |
| `/prijave` context-free redirect | KEEP COMPAT | ne vraćati staru candidate površinu |
| `/pregled-nacrta` legacy shim | KEEP COMPAT / kasnije RETIRE URL | nema drugog product review ekrana |
| `/arhiva` | RETIRE PRODUCT SURFACE | histories ostaju u svojim domenima; stari link eventualno → Dogovori/Istorija |

---

# 333. IMPLEMENTATION DELTA — POČETNA

## Home route / presentation
**MODIFY**

Zadržati:
- partial reads;
- server attention;
- next Agreement;
- dve namere;
- draft/setup continuation.

Izmeniti:
- formalni copy;
- `Čeka Vas`;
- Početna nije feed;
- ukloniti horizontalne carousele mojih Taskova i Prijava;
- ukloniti feed aktuelnih prilika sa Početne;
- kompaktni redovi `Moji zadaci / Moje prijave`; kontekstualno `Dostupnost` ili setup radnog profila. `Moj raspored` nije stalni Home red.

## Home attention RPC
**KEEP + EXTEND**

Zadržati server-owned attention.

Dodati kada backend bude spreman:
- exact review/blind deadline facts;
- kompletne Agreement attention vrste;
- bez rekonstruisanja iz klijentskih listi.

---

# 334. IMPLEMENTATION DELTA — TASK + DISCOVERY

| Deo | Odluka |
|---|---|
| `zadaci.tsx` | MODIFY |
| `DiscoveryPresentation` / bottom sheet | KEEP + MODIFY |
| PEEK/HALF/FULL engine | KEEP |
| map clear-band logic | KEEP |
| 450ms settle / auto area follow | KEEP |
| TASK / PLACE / CLUSTER server buckets | KEEP |
| selected marker own layer | KEEP |
| pin price label | RETIRE |
| PLACE member read | KEEP + UI carousel |
| Search | MODIFY visual/information hierarchy |
| Filters | MODIFY |
| Local/Remote split | MODIFY client presentation |
| Discovery spatial page behavior | NEW/FIX cache |
| `TaskCard` / `TaskFace` | MODIFY |
| Public Task detail | MODIFY |
| Owner Task detail | MODIFY |
| Task Q&A | KEEP + MODIFY copy |
| Task photos | KEEP |
| task map/place privacy | KEEP |
| HITNO UI | RETIRE/GATED |
| tools/vehicles Discovery facts | RETIRE |
| public application count | RETIRE worker-side |

### Obavezne tehničke izmene
- map list/count = exact current spatial scope;
- remote rows se ne mešaju;
- session spatial cache + stale-while-revalidate;
- selected pin bez price labela;
- formal user copy.

---

# 335. IMPLEMENTATION DELTA — AI NEED / OBJAVA

| Deo | Odluka |
|---|---|
| `nova.tsx` AI conversation | KEEP + MODIFY |
| structured facts / human confirmation | KEEP |
| safety ALLOW/CLARIFY/REVIEW/BLOCK | KEEP |
| `pregled-zadatka.tsx` | KEEP + MODIFY |
| draft save | KEEP |
| publication evaluator | KEEP |
| legacy duplicate review | RETIRE product surface |
| final screen/copy | MODIFY |

Ne menjati osnovno pravilo:
**AI predlaže → čovek potvrđuje → canonical save.**

---

# 336. IMPLEMENTATION DELTA — APPLICATION

| Deo | Odluka |
|---|---|
| `prilike/[id]/prijava.tsx` command journal | KEEP |
| idempotent submit | KEEP |
| unknown outcome recovery | KEEP |
| application revision/hash binding | KEEP |
| people count | KEEP + simplify UI |
| fixed price derivation | FIX |
| OFFERS total input | KEEP + clearer per-person derivation |
| proposed start/end input | RETIRE from new application UX |
| ExactTimeSheet in application | RETIRE from application flow |
| skill-opt-in toggle in application | MOVE/RETIRE here |
| application review sheet | KEEP + simplify |
| success receipt | KEEP + formal copy |
| current `ti/tvoj` copy | MODIFY |

### P0 fix
`HOURLY`:
**rate per person × people**
u svim application totals/receipts.

### Termin
New application command cilj:
- fixed schedule uses task schedule;
- flexible/remote application does not invent proposed interval.

Backend compatibility fields mogu ostati nullable dok se migration plan ne potvrdi.

---

# 337. IMPLEMENTATION DELTA — MOJE PRIJAVE

`moje-prijave.tsx`  
**KEEP + MODIFY**

Zadržati:
- paged reads;
- active/attention/finished truth;
- withdrawal/update journals;
- stale task review;
- links back to Task/Dogovor.

Target UI:
- Aktivne
- Čeka Vas
- Istorija

`SHORTLISTED` ne izlagati kao veliko obećanje.

Stale task:
- pregled novih current facts;
- Zadržite / Izmenite / Povucite;
- bez izmišljenog diff-a.

---

# 338. IMPLEMENTATION DELTA — CANDIDATES + SELECTION

| Deo | Odluka |
|---|---|
| `potrebe/[id]/kandidati.tsx` | KEEP + MODIFY |
| Candidate projection | KEEP |
| candidate version/hash | KEEP |
| `mozeIzabrati` server authority | KEEP |
| Candidate card | MODIFY |
| candidate tools/vehicles facts | RETIRE UI |
| side-by-side phone compare | DEFER / tablet optional |
| Arrival sort | KEEP |
| Rating sort | KEEP |
| Price sort | FIX |
| `Najniža cena` based on total | RETIRE/FIX |
| Candidate detail sheet | KEEP + simplify |
| Selection confirm | KEEP + formal copy |
| selection idempotency | KEEP |
| selection → Agreement atomic flow | KEEP |
| overfill revalidation | KEEP |
| selected Agreement link | KEEP |

### P0 price sort
OFFERS:
sort by **comparable per-person/per-slot amount**.

MY_PRICE:
price sort nije potreban jer candidate ne bira cenu.

---

# 339. IMPLEMENTATION DELTA — MONETIZATION

`connection_policy_versions`  
**KEEP**

`connection_activations` immutable ledger  
**KEEP**

Current `PROMOTIONAL_FREE / 0 RSD`  
**KEEP FOR MVP**

Paid checkout:
**DEFER / NEW**

Ne menjati Selection u lažni paid flow dok nema:
- payment provider;
- entitlement receipt;
- retry/recovery;
- invoice/fiscal decision;
- refund policy.

---

# 340. IMPLEMENTATION DELTA — DOGOVORI

| Deo | Odluka |
|---|---|
| bilateral Agreement model | KEEP |
| accepted versioned terms | KEEP |
| Agreement list grouping by task+role | KEEP + improve UI |
| requester task-group presentation | MODIFY |
| worker single Agreement card | MODIFY visual/copy |
| current/history data scopes | KEEP backend; MODIFY UI |
| role filters | KEEP, secondary |
| mixed global Arhiva | RETIRE |
| Agreement `Pregled | Poruke` | KEEP |
| old extra conceptual tabs | RETIRE |
| next-step authority | KEEP |
| cancellation info read | KEEP |

Requester group:
- active collaborators first;
- earlier cancelled/completed secondary;
- group chat shortcut.

---

# 341. IMPLEMENTATION DELTA — AGREEMENT CHANGES + CANCELLATION

| Deo | Odluka |
|---|---|
| versioned proposal | KEEP |
| old accepted terms while pending | KEEP |
| accept/reject/withdraw | KEEP |
| pending change blocks completion | KEEP |
| exact term proposal here | KEEP + make canonical for flexible tasks |
| cancellation one Agreement | KEEP |
| cancel reason required | KEEP |
| client command journal/recovery | KEEP |
| user label `Otkaži Dogovor` | MODIFY → `Otkažite saradnju` |
| whole-task multi-cancel | DEFER |

Cancellation mora ostati bilateralna.
Task coverage/search state se ponovo računa server-side.

---

# 342. IMPLEMENTATION DELTA — GROUP + MESSAGES

| Deo | Odluka |
|---|---|
| V5 group membership model | KEEP |
| admission-from-now privacy | KEEP |
| ended member no future messages | KEEP |
| no retroactive visibility | KEEP |
| `Svi učesnici | Privatno` | KEEP + polish |
| requester private picker | KEEP |
| worker private→requester | KEEP |
| worker-worker private DM | NEVER ADD for task group |
| group text messages | KEEP |
| group read tracking | KEEP |
| group photos | NEW P1 |
| group voice | DEFER |
| private text/photo | KEEP |
| private voice | KEEP where build stable |
| private unknown-send outbox recovery | KEEP |
| terminal read-only thread | KEEP |
| conversation-first inbox | KEEP |

### Inbox gap
Private unread count nije autoritativan kroz ceo inbox.
Ne crtati lažni root numeric badge.

---

# 343. IMPLEMENTATION DELTA — EXACT LOCATION / CONTACT

| Deo | Odluka |
|---|---|
| approximate public task point | KEEP |
| bilateral exact-location grant | KEEP |
| reveal only after active grant | KEEP |
| revoke | KEEP |
| expire/terminal concealment | KEEP |
| worker request address → draft | KEEP |
| PHONE grant backend | DEFER/DORMANT |
| public phone UI | RETIRE |
| share to all active participants | NEW P1 batch capability |

Dok batch ne postoji:
requester deli lokaciju pojedinačno po Dogovoru.

---

# 344. IMPLEMENTATION DELTA — KALENDAR

| Deo | Odluka |
|---|---|
| `raspored.tsx` | KEEP + MODIFY |
| Month/Week/Day | KEEP |
| Agreements-only calendar source | KEEP |
| worker availability | KEEP |
| worker exact conflict authority | KEEP |
| requester overlaps not blocked | KEEP |
| flexible Agreements section | KEEP + polish |
| exact start+end new canon | MODIFY creation/change flows |
| legacy start-only read | KEEP COMPAT |
| requester same-task same-window grouping | NEW presentation model |
| remote deadline as busy interval | RETIRE if currently inferred |
| remote deadline list/fact | NEW/EXTEND |

---

# 345. IMPLEMENTATION DELTA — COMPLETION

| Deo | Odluka |
|---|---|
| worker mark done | KEEP |
| requester confirm | KEEP |
| server 48h deadline | KEEP |
| retry does not extend | KEEP |
| problem blocks auto close | KEEP |
| server scheduler auto completion | KEEP |
| pending change guard | KEEP |
| unknown outcome readback | KEEP |
| parent Task completion by completed coverage | KEEP |
| completion visual/copy | MODIFY |
| explicit auto-completed source copy | ADD only with authoritative source fact |

---

# 346. IMPLEMENTATION DELTA — RATINGS

| Deo | Odluka |
|---|---|
| completed Agreement eligibility | KEEP |
| 1–5 | KEEP |
| max 3 tags | KEEP |
| optional comment | KEEP |
| immutable submit | KEEP |
| unknown outcome recovery | KEEP |
| `receivedAs` role fact | KEEP |
| immediate public aggregate | FIX for blind model |
| 14-day deadline | NEW |
| hidden/unpublished review state | NEW |
| publish both-or-deadline | NEW |
| role-scoped public aggregate | FIX/ADD |
| requester trust aggregate | NEW/P1 |
| worker Work Trust | KEEP |

Ako blind backend nije spreman:
ratings ne treba javno lansirati sa drugačijim pravilom samo zato što je stariji kod jednostavniji.

---

# 347. IMPLEMENTATION DELTA — PROFILE

| Deo | Odluka |
|---|---|
| Profile hub | MODIFY |
| one account / both roles copy | KEEP |
| blended AccountReputation display | RETIRE |
| shared account name/photo | NEW/FIX authority |
| requester public profile | KEEP + MODIFY |
| worker public profile | KEEP + MODIFY |
| own role preview selector | NEW |
| PublicProfileSheet | KEEP |
| worker AI interview | KEEP |
| worker manual old editor | RETIRE where AI flow supersedes |
| skills/categories | KEEP |
| work area | KEEP + modernize geography |
| availability | KEEP |
| capacity | KEEP |
| tools/vehicles UI | RETIRE |
| licenses provenance | KEEP + clarify |
| identity verified badge | GATED |

---

# 348. IMPLEMENTATION DELTA — SETTINGS / SAFETY / SUPPORT

## Settings
**KEEP + REORGANIZE**
- Nalog
- Iskustvo
- Privatnost i podaci
- Pomoć

## Notifications
**MODIFY**
- event-family UI;
- quiet hours;
- hide urgent override MVP;
- only expose channels that work.

## Safety
**KEEP**
- context-bound report;
- block/unblock;
- no incoming block disclosure;
- active Agreement remains resolvable.

**MODIFY**
- formal copy;
- clearer report vs block separation.

## Support
**KEEP**
- real case system;
- context references;
- replies;
- decisions;
- appeal structure.

**MODIFY**
- human topic names;
- final FAQ copy.

---

# 349. IMPLEMENTATION DELTA — PRIVACY / EXPORT / CLOSURE

| Deo | Odluka |
|---|---|
| Privacy hub | KEEP + MODIFY |
| retention reader | KEEP |
| data export lifecycle | KEEP |
| export delivery | KEEP |
| legal bundle acceptance | KEEP |
| closure blockers | KEEP |
| closure journal | KEEP |
| staged erasure | KEEP |
| old/preparation-only closure authority | RETIRE from final UI |
| policy-bound execution receipt | KEEP as final authority |
| human blocker copy | MODIFY |
| claim `deleted` before terminal receipt | FORBIDDEN |

---

# 350. IMPLEMENTATION DELTA — NOTIFICATIONS / PUSH

## KEEP
- events/deliveries/preferences/devices architecture;
- opaque provider event ids;
- server target resolution pattern;
- message/opportunity/application exact-target work;
- notification inbox;
- stale target `UNAVAILABLE` behavior.

## FIX / ADD P0
Exact safe targets for:
- selection / selected;
- Agreement change;
- completion;
- problem;
- rating;
- critical account/support events if pushed.

## MODIFY
- permission ask wired after first useful action;
- formal copy;
- target-specific navigation fallback.

## FORBIDDEN
- private message body in provider metadata;
- raw address/phone;
- server-supplied arbitrary route path.

---

# 351. IMPLEMENTATION DELTA — AUTH

## KEEP
- email/password;
- confirmation;
- recovery;
- optional phone gating;
- restricted account screen;
- callback sanitization.

## MODIFY P0/P1
- final formal copy;
- signup no longer requires legacy city;
- shared account identity;
- remembered intent return.

## NEW P1
- Google Sign-In Android.

## DEFER
- Apple until iOS;
- phone OTP unless product explicitly wants it and provider is configured.

---

# 352. ROUTE-LEVEL TARGET PRESEK

### Root KEEP/MODIFY
- `/`
- `/zadaci`
- `/dogovori`
- `/poruke`

### Important pushed KEEP/MODIFY
- `/potrebe`
- `/potrebe/[id]/pregled`
- `/prilike/[id]`
- `/prilike/[id]/prijava`
- `/potrebe/[id]/kandidati`
- `/moje-prijave`
- `/nova`
- `/pregled-zadatka`
- `/dogovor/[id]`
- `/dogovor/[id]/izmene`
- `/dogovor/[id]/grupa`
- `/raspored`
- `/oceni-dogovor`
- `/profil`
- profile/settings/privacy/support/safety child routes
- `/obavestenja`
- `/auth`
- `/oporavak`

### Compatibility-only
- `/mapa`
- `/prilike` root
- `/moje-aktivnosti`
- `/prijave`
- `/pregled-nacrta`

### Retire as primary product route
- `/arhiva`

---

# 353. ŠTA NE RADIMO KAD KRENE IMPLEMENTACIJA

Ne:
- menjati backend koji je već ispravno idempotentan samo radi „čistijeg“ koda;
- brisati legacy route pre nego što postoji safe redirect/migration;
- spajati bilateralne Dogovore u jedan database Agreement;
- kopirati group terms/cene;
- pretvoriti client u authority za availability/conflict;
- optimistično tvrditi uspeh write-a bez receipt/readback-a;
- otvoriti private podatke da bi UX bio „lakši“;
- menjati sve odjednom bez vertical end-to-end testova.

---

# 354. PREPORUČEN REDOSLED PRODUKCIONE IMPLEMENTACIJE POSLE PROTOTIPA

Tek posle odobrenog HTML-a:

1. **Copy + navigation cleanup**
2. **Discovery truth + remote + cache**
3. **Task cards/details**
4. **Application simplified flow + hourly/price fixes**
5. **Candidate/Selection fixes**
6. **Agreement group presentation + terminology**
7. **Messages/group photos if MVP**
8. **Calendar grouping/deadline**
9. **Completion**
10. **Blind ratings + role reputation**
11. **Profile/shared identity**
12. **Safety/Support/Privacy polish**
13. **Push exact targets**
14. **Auth Google/signup geography**
15. **Final accessibility/performance**
16. **End-to-end release proof**

Svaki korak mora ostaviti aplikaciju u konzistentnom stanju.
Ne pravimo „veliki rewrite commit“ bez međukoraka.

---

# 355. MASTER STATUS — PRE HTML-A

Posle:
- domain pass-ova;
- cross-product pass-a;
- consistency pass-a;
- screen inventory-ja;
- navigation map-e;
- implementation delta-e;

Master je spreman da bude:
**jedini proizvodni input za interaktivni prototip.**

Sledeći posao više nije dodavanje još teorijskih dokumenata.

Sledeći posao je:
**iz ovog istog Mastera napraviti jednu klikabilnu HTML mobilnu aplikaciju sa mock podacima, koja pokriva kompletan glavni životni ciklus USKOČI-ja.**

# 30. PRAVILO ZA NASTAVAK

Novi zaključak se ne zapisuje u novi dokument.

Ažurira se ovaj fajl:
**USKOCI_PRODUCT_UX_MASTER.md**

Ako nova odluka menja staru:
- stara formulacija se menja ili jasno označava kao superseded;
- ne ostavljamo dve kontradiktorne “istine”.

Cilj je da na kraju ovaj jedan dokument bude dovoljan dizajneru, developeru i vlasniku proizvoda da razumeju kako kompletan USKOČI treba da radi i izgleda.


# 356. PROTOTIP — AKTUELNI STATUS I PRAVILO

Glavni radni fajl ostaje:

`USKOCI_CLICKABLE_PRODUCT_PROTOTYPE.html`

Raniji široki HTML koji je pokušao da pokrije celu aplikaciju bio je koristan za proveru toka, ali **nije vizuelni autoritet** i ne tretira se kao finalni high-fidelity dizajn.

Od sada prototip nastaje fazno:
- prvo se finalizuje jedna screen porodica;
- koristi stvarni screenshot trenutne aplikacije + aktuelni kod + ovaj Master;
- ne menja se postojeći USKOČI DNK bez razloga;
- tek kada porodica ima kompletan state/interaction/visual contract prelazi se na sledeću.

Trenutno je prototip fokusiran na:
**ENTRY + AUTH**.

Kada sve screen porodice prođu ovaj proces, isti fajl se ponovo širi u kompletan E2E high-fidelity prototip.


# 357. HOME — FINALNI KANON POSLE STVARNOG SCREENSHOT-A

Vizuelni autoritet za ovaj pass:
- stvarni aktuelni Home screenshot `15989.jpg`;
- aktuelni `HomePresentation.tsx` i `index.tsx`;
- zaključci iz ovog Mastera.

Ključna odluka:
**Home ne redizajniramo u novi proizvod.**
Zadržavamo njegov beli, mirni, prepoznatljiv DNK i unapređujemo ga.

## 357.1 Vizuelni DNK koji ostaje

- bela pozadina;
- pravi USKOČI logo gore levo;
- bell + avatar gore desno;
- dve velike početne akcije u istom redu;
- topla narandžasto-ivory kartica za traženje pomoći;
- svetlo zelena kartica za uskočera;
- 2.5D ilustracije samo na te dve primarne akcije;
- jednostavni list redovi ispod;
- postojeća četvorodelna bottom navigacija;
- aktivni tab ima pale-green fizičku površinu.

Ne uvodimo:
- veliki tamni hero;
- feed zadataka;
- dashboard sa KPI karticama;
- gomilu status badge-eva;
- generički AI gradient izgled.

## 357.2 Konačna osnovna kompozicija

Kada nema hitnije stvari iz Dogovora:

1. Header
2. Dve glavne akcije
3. Nastavak AI razgovora — samo ako draft postoji
4. Moji zadaci
5. Moje prijave
6. Dostupnost — samo kada aktivni worker profil postoji
7. Bottom navigation

Finalni copy:
- `Objavite zadatak`
- `Opišite šta Vam treba.`
- `Uskočite i zaradite`
- `Pronađite zadatak.`
- `Nastavite razgovor o zadatku`
- `Izaberite započeti razgovor.`

## 357.3 Kada postoji nešto važnije od početnih akcija

Home je action-first, ali ne feed.

Ako postoji sledeći potvrđeni Dogovor:
**Sledeće** ide iznad dve početne akcije.

Prikazuje se samo jedan naredni Dogovor:
- dan/vreme;
- task title;
- druga strana ili broj saradnji kada je requester group;
- mesto ako je relevantno.

Tap otvara Dogovor.

Ako postoji radnja koja čeka korisnika:
**Čeka Vas** ide iznad dve početne akcije, iza `Sledeće` kada oba postoje.

Najviše 3 stavke:
- kandidat čeka izbor;
- Agreement change čeka odgovor;
- završetak čeka potvrdu;
- prijava zahteva pregled;
- ocena čeka.

Više od 3:
`I još N...`

Ne crtamo beskonačnu listu.

## 357.4 Prioritet Home-a

1. Sledeći vremenski blizak Dogovor
2. Radnje koje čekaju korisnika
3. Objavite zadatak / Uskočite i zaradite
4. Nastavite draft
5. Moje liste i dostupnost

Ako `Sledeće` ne postoji:
ne ostavljamo praznu sekciju.

Ako `Čeka Vas` ne postoji:
ne ostavljamo praznu sekciju.

## 357.5 Moje liste

Home prikazuje samo redove i broj/stanje:

`Moji zadaci`
`6 aktivnih`

`Moje prijave`
`1 prijava` / `2 čekaju odgovor` / relevantan autoritativni broj

Ne prikazujemo horizontalne carousele TaskCard/ApplicationCard na Home-u.

Razlog:
njihove pune liste već postoje i Home mora ostati miran.

## 357.6 Aktuelni zadaci drugih ljudi

Penzionišemo `Aktuelni zadaci` carousel sa Home-a.

Discovery ostaje jedino mesto za live marketplace browsing.

`Uskočite i zaradite` vodi direktno u Zadaci.

## 357.7 Dostupnost

Ako je worker profil ACTIVE:
Home može prikazati:
`Dostupnost`
`Mogu odmah` ili `Mogu odmah: isključeno`

Tap ide u odgovarajući worker availability/AI edit flow.

Ako worker profil nije aktivan:
umesto dostupnosti može se prikazati:
`Podesite radni profil`

Ne prikazujemo oba reda istovremeno.

## 357.8 Raspored

Home nema stalni `Moj raspored` red u ovoj finalnoj kompoziciji.

Raspored ostaje dostupan kroz:
- Dogovori;
- `Sledeće` kontekst;
- druge kontekstualne ulaze.

Time Home ostaje bliži sadašnjem dobrom rasporedu i nije prenatrpan.

## 357.9 First run

Potpuno nov korisnik:

- dve velike glavne akcije ostaju centralne;
- nema prazne sekcije `Sledeće`;
- nema prazne sekcije `Čeka Vas`;
- nema prazne `Dostupnost` ako worker profil ne postoji;
- može se prikazati vrlo kratak `Kako USKOČI radi` ispod glavnih akcija.

Ne prikazujemo deset praznih redova.

## 357.10 Loading / partial error

Prvi load:
- stabilni header i dve glavne akcije mogu ostati dostupni;
- dinamičke sekcije ne glume podatke.

Partial failure:
- poslednji potvrđeni snapshot ostaje;
- jedna tiha rečenica `Prikazano je poslednje učitano.`
- retry ne ruši ostatak Home-a.

Aktuelna partial-read arhitektura se čuva.

## 357.11 Veliki tekst / mali telefon

Kada font scale zahteva:
- dve glavne kartice prelaze u vertikalni stack;
- tekst se ne smanjuje da bi stao;
- row visina raste;
- bottom nav zadržava minimum touch target.

Aktuelni `useLayoutClass()` temelj ostaje.

## 357.12 Ikonografija

2.5D:
- samo primarne Home akcije;
- eventualno first-run/empty/success scene.

2D line icons:
- Nastavite razgovor;
- Moji zadaci;
- Moje prijave;
- Dostupnost;
- bottom navigation;
- attention rows.

Cilj:
sačuvati karakter bez utiska „emoji aplikacije“.

## 357.13 HOME implementation delta

KEEP:
- `index.tsx` read architecture;
- one account / no role mode;
- server attention;
- next Agreement logic;
- `IntakeResume`;
- counts;
- partial read recovery;
- available-now fact;
- focus/account guards;
- pull refresh;
- accessibility structure.

MODIFY:
- sav user-facing copy → Vi/Vam/Vas;
- `StartActions` final spacing/typography;
- header ostaje logo-led, ne generic dashboard title;
- row icons → 2D functional icon set;
- waiting title `Čeka Vas`;
- recovery copy formal;
- first-run copy formal.

RETIRE FROM HOME:
- horizontal `myActiveTasks` carousel;
- horizontal `myActiveApplications` carousel;
- `ExploreTasksAction` / `Aktuelni zadaci` carousel.

CONDITIONAL:
- worker setup row OR Availability row.

## 357.14 Vizuelni review artefakt

Aktuelni Home-only review prototip:
`USKOCI_CLICKABLE_PRODUCT_PROTOTYPE.html`

Render za brzu proveru:
`USKOCI_HOME_FINAL_REVIEW.png`

Ovaj Home je sada jedini vizuelni pravac za sledeću iteraciju.
Dok vlasnik proizvoda ne odobri Home, ne finalizujemo Zadaci.


# 357A. FINALNI VIZUELNI PASS — NE MENJAMO STIL, DOVODIMO GA DO KRAJA

Ovaj deo je zasnovan na stvarnim screenshotovima trenutne aplikacije `15989.jpg`–`16049.jpg`.

Važna korekcija terminologije:
- **HOME / ULAZ** = ekran pre prijave/registracije (`16049`) + auth (`16048`);
- **POČETNA** = glavni ekran posle prijave (`15989`).

Screenshotovi `16039`–`16047` nisu product UI nego razvojni/ChatGPT/Codex prikazi i ne koriste se kao vizuelni uzor.

Glavni cilj:
**ne praviti novi vizuelni identitet.**
Trenutni UI već ima dobru osnovu.
Problem nije „pogrešan stil“, nego to što nije prošao završni art-direction i consistency pass.

---

# 358. ŠTA JE DOBRO U SADAŠNJEM STILU I MORA DA OSTANE

## 358.1 Svetao, miran proizvod

Zadržati:
- bela / vrlo svetla topla podloga;
- puno vazduha;
- nema agresivnih gradijenata;
- nema tamnog admin/dashboard osećaja;
- sadržaj je lako razumljiv.

USKOČI treba da deluje:
- jednostavno;
- prijateljski;
- pouzdano;
- ozbiljno dovoljno da korisnik poveri stvarni posao.

## 358.2 Zelena kao glavna radna boja

Sadašnja zelena dobro funkcioniše za:
- primarni CTA;
- aktivni tab;
- potvrđena/pozitivna stanja;
- role akcije.

Ne uvoditi deset novih boja.

## 358.3 Narandžasta kao brend akcenat

Narandžasta ostaje:
- logo;
- mali attention trenuci;
- 2.5D detalji;
- success/brand moments.

Ne koristiti je kao još jednu primarnu CTA boju.

## 358.4 2.5D ilustracije

Sadašnji 2.5D je karakter proizvoda.

Koristi se:
- HOME/Entry hero;
- dve glavne namere;
- empty states;
- first-run;
- veliki success;
- support/help momenti.

Ne koristi se:
- uz svaku list row;
- uz svaki status;
- uz svaku činjenicu.

Funkcionalni UI koristi mirne 2D ikonice.

## 358.5 Beli cardovi i soft surfaces

Sadašnji white-card je dobar osnovni jezik.

Problem:
trenutno ga ima previše i različito je tretiran.

Kanon:
- card samo kada grupiše stvarno povezane stvari;
- ne stavljati card unutar carda bez potrebe;
- row lista često treba samo separator, ne još jedan box.

## 358.6 Bottom navigation

Sadašnji bottom bar vizuelno je dobar DNK:
- 4 stavke;
- jasna aktivna zelena;
- zaobljen container;
- lagan i ne dominira.

Finalno:
`Početna · Zadaci · Dogovori · Poruke`

Ne treba potpuno nov bottom nav.

---

# 359. ZAŠTO TRENUTNI UI DELUJE „OK, ALI NIJE FINALAN“

Najveći problemi nisu idejni nego završni:

1. **razmaci nisu dovoljno sistemski**;
2. kartice nemaju jednu jasnu hijerarhiju;
3. screen header se razlikuje više nego što treba;
4. prazna stanja često ostavljaju previše mrtvog prostora;
5. 2.5D ilustracije nisu uvek iste vizuelne težine;
6. functional icons su mešani po stilu;
7. neke stranice imaju previše boxeva;
8. neke stranice su previše prazne;
9. sticky CTA-i nemaju isti sistem;
10. tabovi/chipovi se razlikuju od ekrana do ekrana;
11. copy i dalje meša `ti/tvoj` i `Vi/Vaš`;
12. information hierarchy nije svuda dovoljno jaka;
13. statusi ponekad izgledaju kao forma, a ne kao stanje;
14. nedostaje dosledan pressed/loading/success/error motion;
15. na nekim ekranima se vidi tehnička istorija proizvoda umesto finalne kompozicije.

---

# 360. FINALNI VIZUELNI TOKENI — IZ POSTOJEĆEG STILA

Ovo nisu nove boje nego standardizacija postojećeg jezika.

## Boje

### Ground
`#F7F8F5` približno

Vrlo blago zelenkasto/sivo, ne čisto sivo.

### Surface
`#FFFFFF`

### Primary forest
`#0F7657` do `#126D54`

Jedna finalna vrednost iz stvarnog brand seta se zaključava u implementaciji.

### Primary soft
`#E9F3ED`

### Orange
brand orange iz logotipa.

### Orange soft
`#FFF3E7`

### Ink
`#17221D`

### Muted
`#67736D`

### Line
`#E5E8E4`

### Danger
prigušena crvena, samo za destructive/safety.

## Radius

- large hero / major surface: 26–30
- standard card: 18–22
- input: 14–16
- CTA: 13–16
- chip: pill
- bottom navigation shell: 24–28

Ne koristiti 28 radius na svemu.

## Shadows

Tri nivoa:

### 0
obične rows / inline sections:
bez shadow-a.

### 1
card:
vrlo blag shadow + hairline.

### 2
floating sheet / sticky preview:
izraženiji ali neutralan shadow.

Bez obojenih shadow-a.

## Spacing

Osnovna skala:
4 / 8 / 12 / 16 / 20 / 24 / 32

Horizontalni screen inset:
**20 dp** kao osnovni cilj.

Section gap:
24–28.

Card internal:
14–16.

Row height:
minimum 52–56.

---

# 361. TIPOGRAFIJA — OSTAJE ISTI OSEĆAJ, ALI SISTEMSKI

Font:
**Inter**

## Screen hero
30–34 / 800–850

## Screen title
20–22 / 750–800

## Section title
17–18 / 700–750

## Card title
16–17 / 650–750

## Body
15–16 / 400–500

## Meta
13–14 / 400–500

## Caption
12

## Price
18–22 / 700–800 / tabular nums

Nikada ne smanjivati font samo da stane.

Ako tekst ne stane:
- veća visina;
- max 2 linije;
- bolja kompozicija.

---

# 362. ICON SYSTEM

## Funkcionalne ikonice

Jedna porodica:
Phosphor-like / rounded linear.

Ista:
- debljina;
- proporcija;
- stroke;
- optička veličina.

Ne mešati emoji, outline, filled i 3D ikonice u istom redu.

## 2.5D

Samo:
- Home/Entry;
- glavne namere;
- empty states;
- success;
- support.

Sadašnje ilustracije su deo brenda i zadržavaju se, ali:
- uniformna perspektiva;
- ista svetlost;
- ista materijalnost;
- ista približna vizuelna masa.

---

# 363. HEADER KANON

## Root posle prijave

Levo:
USKOČI logo ili naziv konteksta prema ekranu.

Desno:
- bell kada ima smisla;
- avatar/profile.

## Pushed screen

Levo:
Back u malom circular touch targetu.

Centar/levo:
jasan title.

Desno:
samo jedna kontekstualna radnja kada je stvarno potrebna.

Problem danas:
neki headeri izgledaju kao potpuno različiti proizvodi.

Cilj:
jedna fizička visina, isti inset, isti back control.

---

# 364. PRIMARY CTA KANON

Primarni CTA:
- jedna zelena;
- jedna visina;
- isti radius;
- isti horizontalni inset.

Ako je flow ekran:
sticky footer je dozvoljen.

Ako nije:
CTA stoji u prirodnom toku sadržaja.

Ne stavljati veliki sticky green button na ekran gde nema potrebe.

Destructive:
crvena samo kad radnja stvarno ima ozbiljnu posledicu.

---

# 365. SHEET / DIALOG KANON

## Sheet
Za:
- filtere;
- kandidat detalj;
- public profil;
- kontekstualne izbore;
- pomoćne detalje.

Top radius 26–30.
Handle diskretan.
Jedan jasni title.
Footer action po potrebi.

## Center dialog
Samo za:
- potvrdu destruktivne radnje;
- selection confirmation;
- kritičnu odluku.

Ne koristiti center modal za velike forme.

---

# 366. EMPTY STATE KANON

Sadašnji empty states su uglavnom dobri u ideji ali često imaju previše praznog prostora.

Finalno:

1. jedna 2.5D ilustracija 80–120 dp;
2. naslov;
3. jedna kratka rečenica;
4. CTA samo kada prirodno postoji sledeća radnja.

Primer:
Dogovori prazni:
- ilustracija;
- `Još nemate aktivne Dogovore`;
- `Kada izaberete ili budete izabrani, pojaviće se ovde.`;
- bez velikog sekundarnog „Pogledaj istoriju“ ako istorija takođe nema ništa.

---

# 367. HOME / ULAZ — `16049`

Ovo je **Home u vlasnikovoj terminologiji**.

Trenutno ima dobar DNK i ne treba ga rušiti.

## Zadržati

- svetlu pozadinu;
- veliki beli hero-card;
- pravi USKOČI 3D logo;
- veliki headline;
- dve 2.5D namere;
- veliki `Prijavi se`;
- sekundarni `Napravi nalog`;
- `Jedan nalog za obe uloge`.

## Problem danas

1. Hero-card je vizuelno malo previše „marketing web page“.
2. Logo je vrlo veliki u odnosu na headline.
3. Ilustracije dole deluju kao dva odvojena banera umesto jedne jasne priče.
4. Vertical rhythm između hero-a i dugmadi može biti finiji.
5. CTA/button elevation je malo pretežak.
6. `Prijavi se` i `Napravi nalog` nisu dovoljno vezani za dve namere iz hero-a.
7. Nema dovoljno osećaja da se isti nalog koristi za obe strane proizvoda osim jedne rečenice na dnu.

## Finalni izgled

### Gornja polovina

Logo:
malo manji i više vazduha oko njega.

Headline:
`Za svaki zadatak, prava osoba.`

Ostaje.
To je dobar brand statement.

Body:
kraći, jedna do dve linije:
`Objavite šta Vam treba ili uskočite svojim vremenom i znanjem.`

### Namere

Ne praviti dva CTA dugmeta.

Ostaju kao vizuelna demonstracija:
- Objava zadatka
- Uskačete i zarađujete

Malo jasnije povezati ilustraciju i label.

### Auth actions

Primary:
`Prijavite se`

Secondary:
`Napravite nalog`

Ispod:
`Jedan nalog za obe uloge`

### Motion

Na prvom prikazu:
- logo miran;
- hero card fade/slide 180–240 ms;
- dva 2.5D elementa mali stagger;
- bez looping animacija.

## Stanja

- normal;
- loading auth config;
- account restricted;
- deep-link intent returning user.

Home sam po sebi ne prikazuje formu.

---

# 368. AUTH / PRIJAVA — `16048`

Dobar minimalistički smer.

## Zadržati

- belo;
- veliki naslov `Prijavi se`;
- podnaslov;
- tab `Napravi nalog | Prijava`;
- veliki inputi;
- sticky primary CTA.

## Popraviti

### Back
Trenutni circle je vizuelno prevelik.
Target ostaje ≥48 dp, ali border/krug treba biti tiši.

### Naslov
Odličan.
Zadržati.

### Segment
Smanjiti ukupnu visinu.
Active state:
bela površina + vrlo blag shadow.
Inactive:
soft green.

### Input
Sada border deluje tamno.
Finalno:
- 1px neutral;
- focus green;
- error red;
- 56 dp target height;
- label 14;
- placeholder muted.

### Empty vertical space
Na screenshotu između `Zaboravljena lozinka?` i CTA ima previše praznog prostora.

Sticky footer jeste dobar, ali sadržaj treba da diše prirodnije:
- auth forma zauzima kompaktni gornji deo;
- footer ostaje stabilan;
- keyboard stanje mora da podigne CTA.

### Google

Android target:
kada Google auth bude implementiran,
posle separatora:
`Nastavite uz Google`

Ne izmišljati pre nego što radi.

---

# 369. REGISTRACIJA

Isti ekran/familija kao Login.

Ne praviti drugi vizuelni proizvod.

Target polja:
- ime;
- email;
- lozinka.

Grad ne treba više da bude obavezni auth field.

Područje se pita tek kada:
- objavljujem lokalni task;
- pravim worker profil.

## Struktura

`Napravite nalog`

`Jedan nalog koristite i kada tražite pomoć i kada uskačete.`

Fields.

Legal quiet copy.

Primary:
`Napravite nalog`

---

# 370. POČETNA POSLE PRIJAVE — `15989`

Ovo je druga površina od HOME/Entry.

Vizuelno je već među boljim ekranima.

## Zadržati

- pravi logo gore;
- bell;
- avatar;
- dve glavne kartice:
  - Objavi zadatak
  - Uskoči i zaradi
- pale orange / pale green;
- AI resume row;
- Moji zadaci;
- Moje prijave;
- Dostupnost;
- bottom nav.

## Šta mora da se popravi

### 1. Ne praviti feed

Current code danas ispod tih rows može da renderuje:
- horizontalne kartice mojih zadataka;
- horizontalne kartice prijava;
- aktuelne zadatke.

To vizuelno preopterećuje Home.

Final:
Početna ostaje kratka.

### 2. `Sledeće` i `Čeka Vas`

Kada postoje:
idu IZNAD dve glavne kartice.

Ali samo stvarne akcije.

Primer:
`Sledeće`
jedan Dogovor card.

`Čeka Vas`
do 3 kratka reda.

Kada nema ničega:
sekcija se ne prikazuje.

### 3. Dve namere

Ne menjati izgled radikalno.
Current 15989 je dobar.

Samo:
- isti internal padding;
- isti art size;
- isti baseline title-a;
- formalni copy:
  - `Objavite zadatak`
  - `Uskočite i zaradite`
  - `Opišite šta Vam treba.`
  - `Pronađite zadatak.`

### 4. Moje rows

Zadržati sadašnji list-row stil.
Ne praviti još kartica.

Moji zadaci
Moje prijave
Dostupnost ili setup Radnog profila, kada je relevantno.

`Moj raspored` nije stalni Home red.

---

# 371. FILTERI — `15990` / `15991`

Stil:
dobar.

## Zadržati

- white sheet;
- title + X;
- chip choices;
- sticky footer;
- green apply CTA.

## Popraviti

1. grupa `Mesto na mapi` treba više vizuelno da se razlikuje od filtera;
2. selected chip treba biti jasniji;
3. disabled fields manje sivilo, više jasno objašnjenje;
4. spacing između sekcija standardizovati na 22–24;
5. footer:
   - `Očisti`
   - `Prikažite X zadataka`
   da ima isti sistem kao svaki drugi sheet.

Ne širiti filter listu u beskonačnost.

---

# 372. DOGOVORI — `15992`

Aktivni / Istorija je dobar model.

## Empty state

Sada:
dobra ideja,
ali ilustracija i CTA deluju previše daleko od header-a.

Final:
- empty art 96–112;
- naslov;
- jedna rečenica;
- eventualno `Pogledajte istoriju` samo ako istorija stvarno ima sadržaj.

Kad Dogovori postoje:
task-group model iz Mastera, ali u istom white/green stilu.

---

# 373. RASPORED — `15993` / `15994`

Osnova je dobra.
Ne menjati u potpuno drugi kalendar.

## Zadržati

- Mesec / Nedelja / Dan;
- month grid;
- green selected day;
- rows `Moja dostupnost`.

## Popraviti

1. header + segment moraju vizuelno biti bliži;
2. month title i arrow controls u jednu jasnu liniju;
3. selected day:
   green circle;
4. event dots pod datumom uloga/status sistem;
5. prazni dan:
   manje „mrtvog“ prostora;
6. `Arhiva` ukloniti kao poseban produkt pravac;
7. kada postoji event:
   card ispod kalendara mora imati istu porodicu kao Dogovor card;
8. Day view:
   timeline ne sme izgledati kao office calendar;
   ostaje vrlo miran.

---

# 374. PORUKE — `15995`

Empty state je čist.

## Zadržati

- centralni empty art;
- miran vizuelni ton;
- task-first conversation rows.

## Finalno

Root inbox nema stalni `Aktivni | Istorija` switch.

Kad postoje razgovori:
- conversation-first;
- task title primaran;
- Group / Private sekundarno;
- last message;
- time;
- terminal conversation se diskretno označava;
- unread samo ako je server autoritativan.

Ne menjati ekran u WhatsApp klon.

---

# 375. MOJ PROFIL — `15996` / `15997`

Ovo ima dobar card sistem, ali može da bude elegantnije.

## Problem

- previše box-within-box osećaja;
- public preview sheet ima dobar sadržaj ali je gust;
- role-specific reputation još nije finalno razdvojena.

## Finalno

Top identity card:
- avatar;
- ime;
- shared identity;
- dve role reputacije u jednostavnom dvokolonskom fact redu.

Ispod:
- Radni profil;
- moje aktivnosti;
- settings/support.

Manje cardova, više grouped rows.

---

# 376. RADNI PROFIL — `15998` / `15999`

Ovo je funkcionalno dobro postavljeno.

## Zadržati

- identity top;
- `Profil je aktivan`;
- veliki `Uredi kroz razgovor`;
- sections:
  - Šta radiš
  - Način rada
  - Područje dolaska
  - Dostupnost

## Finalni polish

- `Kako radiš` može biti jedan miran grouped surface;
- labels manje tehničke;
- team capacity dodati prirodno;
- tools/vehicles ne vraćati kao UI inventar;
- on-site/remote staviti kao jasne mini pills.

---

# 377. MOJE PRIJAVE — `16000` / `16001`

## Empty

Dobar smer:
- plane art;
- naslov;
- jedno objašnjenje;
- CTA.

Final copy formal.

## Sa sadržajem

Current card je dobra osnova.

Poboljšati:
- task title;
- stanje kao mali chip;
- price dominant;
- people;
- term;
- jasan `Otvorite Dogovor` samo kada je selected.

Tabs:
`Aktivne | Čeka Vas | Istorija`

Ne držati pet filtera odjednom.

---

# 378. PODEŠAVANJA — `16002` / `16003`

Jedan od najzrelijih delova trenutnog UI-ja.

**Ne redizajnirati.**

Zadržati:
- grouped white sections;
- male leading ikonice;
- title/subtitle;
- arrow.

Finalno samo:
- standardizovati section gap;
- 2D icon family;
- formal copy;
- destructive item izdvojiti;
- `Odjavi se` tiho na dnu.

---

# 379. LIČNI PODACI / PASSWORD / AI RAZGOVORI — `16004`–`16007`

## Lični podaci

Dobar jednostavan form layout.

Final:
- shared name/photo authority;
- label spacing;
- Save CTA tek kada ima change;
- `Područje rada` ne držati u account identity ako pripada worker profilu.

## Password

Trenutno previše praznog prostora.
Form compact + sticky Save only when valid.

## AI razgovori

Kartice su dobre.
Treba:
- jača razlika `Zadaci / Radni profil`;
- date/meta sekundarno;
- continue action u whole-card tap.

---

# 380. OBAVEŠTENJA SETTINGS — `16008` / `16009`

Sada su previše granularna i tekstualno tehnička.

Finalno:
grupisati po porodicama:

- Zadaci i prilike
- Dogovori
- Poruke
- Podsetnici

Quiet hours zasebno.

Ne prikazivati HITNO override u MVP-u.

---

# 381. PRIVATNOST / EXPORT / BLOCK / LEGAL — `16010`–`16017`

Vizuelni stil je dobar i treba ostati.

## Privacy
Zadržati grouped rows + info modal.

## Retention
Expandable row može ostati.
Copy treba biti ljudski, ne policies jargon.

## Export
Empty illustration + CTA dobar.
State screens:
isti layout, samo status menja sadržaj.

## Blocked
Odličan simple empty state.

## Legal
Ne koristi large warning surface ako samo još nije publishovan bundle.
Neutral empty/info.

## Closure
Current blocker review je dobar mental model.
Samo jasnija severity hijerarhija.

---

# 382. SUPPORT — `16018`–`16023`

Dobar smer.

## Support home

Zadržati:
- Moji zahtevi;
- FAQ;
- Bezbednost i podaci;
- bottom `Novi zahtev`.

## New request

Trenutna forma je funkcionalna ali izgleda previše formularski.

Finalno:
- topic kao selector card;
- title;
- description;
- desired outcome hidden/secondary unless really needed.

Bug report može automatski prefille-ovati version/context.

Sticky `Pošaljite privatni zahtev`.

---

# 383. O APLIKACIJI — `16025` / `16026`

Sada je dosta dobar brand info ekran.

Zadržati:
- logo;
- kratko objašnjenje proizvoda;
- dve uloge;
- pravila/privacy links;
- build/version u tihoj meta zoni.

Ne praviti developer/debug info vizuelno dominantnim.

---

# 384. TASK / SELECTED / AGREEMENT ENTRY — `16027`–`16030`

Ovo je jedna od jačih postojećih porodica.

## Zadržati

- status na vrhu;
- veliki task title;
- budget kao green soft card;
- term/location facts;
- owner identity card;
- Q&A;
- map;
- safety row;
- sticky `Otvorite Dogovor`.

## Popraviti

- budget card ne treba da bude jedini veliki obojeni blok;
- fakta ujednačiti;
- map vizuelno kvalitetnija;
- media/photos kada postoje iznad description;
- top status više product, manje debug.

---

# 385. AI TASK FLOW — `16031`–`16034`

Ovo treba da ostane chat-first.

## Zadržati

- normalan razgovor;
- quick examples;
- bottom composer;
- privacy note;
- `Opcije razgovora`.

## Finalno

- assistant identity suptilno, ne robot;
- AI bubble i user bubble konzistentni;
- quick responses kao chips;
- final review se ne meša u chat;
- conversation list modal može biti jednostavniji.

---

# 386. AI WORKER PROFILE FLOW — `16035`–`16038`

Dobar koncept, trenutno malo previše modal-heavy.

Final:
- jedan jasan „razgovor o radnom profilu“;
- info modal samo prvi put / na info tap;
- `Novi razgovor` confirmation ako bi postojeći izgubio kontekst;
- preview `Pregledajte radni profil` sticky samo kada ima material changes.

---

# 387. GLOBALNI SCREEN COMPOSITION CONTRACT

Svaki finalni screen treba da prođe isti checklist.

## Header
- 56–64 dp;
- isti inset;
- back/close ista porodica.

## First meaningful content
ne više od ~16–20 dp ispod headera, osim hero/empty scene.

## Section
- title;
- 8–12 do contenta;
- 24–28 do sledeće sekcije.

## Card
- max jedan glavni nivo cards;
- bez nepotrebnog nesting-a.

## Footer
sticky samo kada postoji glavna flow akcija.

## Bottom nav
samo na root screenovima.

---

> **REFINED:** stari test checklist ostaje koristan; jedina aktivna matrica i status dokaza su J2/J3.

# 388. FINALNI VISUAL QA ZA SVAKI EKRAN

Pre nego što ekran smatramo završenim, proveriti:

1. 360 dp širina;
2. ~430 dp širina;
3. large font;
4. text overflow;
5. keyboard open;
6. empty;
7. loading;
8. error;
9. stale/refresh;
10. one item;
11. many items;
12. disabled CTA;
13. long Serbian copy;
14. dark system status/nav bars where relevant;
15. Reduce Motion.

---

# 389. REDOSLED FINALNOG VIZUELNOG RADA

Ne radimo opet 60 ekrana odjednom.

## Faza 1 — ulaz
1. HOME / Entry
2. Login
3. Register
4. Forgot/reset
5. Account restricted

## Faza 2 — shell
6. Početna
7. Bottom navigation
8. notifications
9. common header

## Faza 3 — marketplace
10. Zadaci / mapa / remote
11. Filters/search
12. Task card
13. Task detail
14. Application
15. Candidates

## Faza 4 — collaboration
16. Dogovori
17. Agreement
18. Private/Group Poruke
19. Calendar
20. Completion
21. Ratings

## Faza 5 — account
22. Profile
23. Worker profile
24. Settings
25. Privacy/export/closure
26. Support
27. Legal/about

## Faza 6 — AI
28. Need conversation
29. Need review
30. Worker profile conversation

Tek kada jedna faza ima završni visual contract, ide sledeća.

---

# 390. ŠTA JE FINALNI CILJ

Nije da korisnik kaže:
„ovo je potpuno druga aplikacija.“

Cilj je da kaže:
**„Ovo izgleda kao USKOČI koji već znam — samo kao da ga je završio vrhunski product/design tim.“**

Dakle:
- isti karakter;
- isti brend;
- isti osnovni layout mental model;
- mnogo bolja disciplina;
- bolja hijerarhija;
- manje vizuelnog šuma;
- profesionalna završna obrada.


# 391. ENTRY + AUTH — PRVI FINALNI VIZUELNI PROTOTIP

Aktuelni klikabilni prototip `USKOCI_CLICKABLE_PRODUCT_PROTOTYPE.html` sada je privremeno fokusiran samo na prvu vizuelnu fazu:

1. HOME / Entry
2. Login
3. Registracija
4. Oporavak lozinke
5. Restricted-account stanje

Vizuelni autoritet:
- `16049.jpg` za Entry;
- `16048.jpg` za Login;
- postojeći `EntryWelcome.tsx` / `auth.tsx` za stvarno ponašanje i responsive granice.

## Šta je namerno zadržano

Entry:
- svetla ground pozadina;
- veliki beli rounded hero;
- postojeći 3D USKOČI logo;
- headline `Za svaki zadatak, prava osoba.`;
- dve postojeće 2.5D namere;
- zeleni primary login;
- beli secondary signup;
- `Jedan nalog za obe uloge`.

Auth:
- isti beli minimalni ekran;
- back circle;
- veliki title/subtitle;
- `Napravite nalog | Prijava` segmented control;
- veliki inputi;
- sticky green footer CTA.

## Šta je unapređeno

- finalni formalni copy `Vi/Vam/Vas`;
- ujednačen radius/spacing;
- intention click pamti REQUESTER/WORKER nameru;
- posle auth-a copy jasno kaže gde se korisnik vraća;
- registracija koristi minimalni shared identity bez geografije:
  - ime;
  - prezime;
  - email;
  - lozinka;
- legacy `grad` je izbačen iz auth cilja;
- area/city se traži kasnije kada stvarno treba za task/worker scope;
- recovery je isti visual family, ne novi proizvod;
- restricted state je zasebno jasno stanje.

## Šta još nije production implementacija

Ovo je high-fidelity product prototip, ne izmena React Native koda.

Kada vlasnik odobri ovu Entry/Auth porodicu:
- postojeći `EntryWelcome.tsx` ostaje osnova;
- uglavnom MODIFY, ne rewrite;
- `auth.tsx` zadržava auth availability/recovery/restricted guards;
- signup field schema/copy se usklađuje;
- Google Android se dodaje tek kada stvarni OAuth flow radi.


# 392. ENTRY + AUTH — KANONSKI STATE / INTERACTION CONTRACT

Ovo poglavlje je finalni product/UX autoritet za prvu screen porodicu.
Zasnovano je na:
- screenshotu `16049` za Entry;
- screenshotu `16048` za Login;
- aktuelnom `EntryWelcome.tsx`;
- `auth.tsx`;
- `AuthFormStep.tsx`;
- `AuthFlowFrame.tsx`;
- `AuthSheet.tsx`;
- password-recovery i restricted-account komponentama.

## 392.1 ENTRY — normalno stanje

Prikazuje:
- postojeći 3D USKOČI logo;
- `Za svaki zadatak, prava osoba.`;
- kratak opis;
- dve vizuelne namere:
  - `Objavite zadatak`
  - `Uskočite i zaradite`
- `Prijavite se`;
- `Napravite nalog`;
- `Jedan nalog za obe uloge`.

Namere su action intent, ne role mode.

## 392.2 ENTRY — intent selection

Tap na `Objavite zadatak` pamti REQUESTER intent.

Tap na `Uskočite i zaradite` pamti WORKER intent.

Ako auth treba, intent se prenosi kroz auth.

Po uspešnom auth-u:
- REQUESTER → Nova potreba / AI Need;
- WORKER → Zadaci.

Ako originalni target više nije validan:
bezbedan fallback prema navigation pravilima.

## 392.3 ENTRY — preparing state

Dok se intent zapisuje / proverava:
- površina ne prima ponovljene intent tapove;
- jedan miran progress state;
- `Pripremamo objavu…` ili `Pripremamo zadatke…`;
- cancel samo ako radnja stvarno može bezbedno da se otkaže.

## 392.4 ENTRY — error

Ako intent ne može da se sačuva:
- Entry ostaje;
- izbor se vraća u normalno stanje;
- jedna mirna error poruka;
- korisnik može ponovo da izabere.

## 392.5 ENTRY motion

Current `EntryWelcome.tsx` ima beskonačni 1.0 → 1.025 pulse na izboru.

Finalni smer:
**RETIRE continuous pulse.**

Dozvoljeno:
- jedan entrance fade/translate;
- blagi stagger ilustracija;
- press scale/haptic;
- kratka transition animacija pri izboru.

Reduce Motion:
bez dekorativnog kretanja.

---

# 393. LOGIN — FINALNI CONTRACT

## 393.1 Sadržaj

- Back;
- `Prijavite se`;
- `Nastavite tamo gde ste stali.`;
- segmented:
  - `Napravite nalog`
  - `Prijava`
- intent context ako postoji;
- Email;
- Lozinka;
- `Zaboravljena lozinka?`;
- sticky CTA `Prijavite se`.

## 393.2 Intent context

Ako je korisnik došao iz Entry namere:

Requester:
`Posle prijave nastavljate objavu zadatka.`

Worker:
`Posle prijave otvaramo Zadaci.`

Može da promeni intent ako postojeći auth flow to podržava.

## 393.3 Validation

Client:
- prazan email;
- neispravan email format;
- prazna lozinka.

Login ne odbija staru lozinku zbog nove password-length politike.
Server answer stoji uz formu, ne kao field validation ako nije field greška.
Prvi neispravan field dobija fokus.

## 393.4 Auth capability check

Ako capability check dodatnih metoda padne:
email/password forma ostaje upotrebljiva ako je dostupna.

Quiet note:
`Dodatne načine prijave trenutno nismo uspeli da proverimo.`

Retry ne blokira osnovni form.

---

# 394. REGISTRACIJA — FINALNI CONTRACT

## 394.1 Polja

Target ostaje kompatibilan sa trenutnim account modelom i ne pravi nepotrebnu migraciju:

1. Ime
2. Prezime
3. Email
4. Lozinka

**Grad se uklanja iz registracije.**

Geografija se traži tek kada korisnik:
- objavljuje lokalni task;
- podešava worker područje.

## 394.2 Lozinka

Aktuelni code policy:
**minimum 6 znakova.**

Dok security/product odluka ne promeni policy, UI ne izmišlja 8.

Hint:
`Najmanje 6 znakova.`

## 394.3 Shared identity

Ime + prezime pripadaju nalogu.
Requester/worker profil ne traže zasebna javna imena.

## 394.4 Legal copy

Dva stanja:

### Legal bundle još nije objavljen
Ne prikazivati lažni checkbox.

### Legal bundle objavljen i acceptance je potreban
Prikazati linkove i stvarno zabeležiti acceptance version/hash.

UI ne tvrdi da je acceptance snimljen ako backend to nije uradio.

## 394.5 Email confirmation

Ako server zahteva confirmation:
posle signup-a prikazuje se `Proverite email`.

Akcije:
- `Pošaljite ponovo potvrdu`;
- `Promenite email` kada je bezbedno;
- `Nazad na prijavu`.

Validan confirmation return:
Login sa jasnim success contextom.

Invalid/expired link:
nudi novu potvrdu.

---

# 395. PASSWORD RECOVERY — FINALNI CONTRACT

## 395.1 Zahtev za link

Iz Login-a:
`Zaboravljena lozinka?`

- title `Oporavak lozinke`;
- Email;
- `Pošaljite link`.

Success:
`Link je poslat.`

Ne otkrivati postojanje naloga ako auth/security politika to ne dozvoljava.

## 395.2 Recovery link

Faze iz postojećeg koda ostaju:
- verifying;
- form;
- saving;
- success;
- error.

Form:
- Nova lozinka;
- Potvrdite novu lozinku;
- `Sačuvajte novu lozinku`.

Success:
`Lozinka je promenjena.`

Unknown write:
ne tvrditi uspeh.

Invalid link:
`Link ne važi` → novi link.

Verify unavailable:
retry + novi link kada je dozvoljeno.

Restricted account:
ne tretirati kao expired link.

---

# 396. RESTRICTED ACCOUNT — FINALNI CONTRACT

Poseban screen, ne error banner unutar login forme.

Vizuelno:
- belo;
- mali neutral lock art;
- bez alarmantnog crvenog hero panela;
- `Pristup nalogu je ograničen`;
- jedna kratka činjenica.

Ako support action postoji:
primary `Obratite se podršci`
quiet `Nazad na prijavu`.

Ako support nije dostupan:
jedan primary izlaz.

Ne izmišljati razlog ili trajanje.

---

# 397. AUTH PRESENTATION — RESPONSIVE / KEYBOARD / ACCESSIBILITY

## Small phone / short window
Full-height forma; nema clipping-a.

## Large text
Full-height auth; font se ne smanjuje; scroll ostaje.

## Keyboard
Sticky footer ostaje dostupan.
Focused field se otkriva iznad tastature.

## Screen reader
- svaki field ima label;
- error se čita uz field;
- busy je označen;
- decorative 2.5D nije dodatni govor.

## Back
- Login/Signup → Entry;
- Recovery request → Login;
- Recovery link → Login ili app prema session-u;
- Restricted → Login.

## Auth sheet vs screen

Zadržava se adaptive presentation:
- dugi Login/Signup je praktično full-screen;
- kraća pomoćna stanja mogu biti sheet kada ima dovoljno prostora;
- keyboard / short height / large text forsiraju full-height.

---

# 398. ENTRY + AUTH — IMPLEMENTATION DELTA PRE PRODUKCIJE

## KEEP
- `EntryWelcome` osnovna kompozicija;
- premium Entry asseti;
- intent model;
- account/session guards;
- `AuthFlowFrame`;
- sticky footer;
- keyboard reveal;
- auth capability checks;
- optional phone gating;
- email confirmation return;
- recovery lifecycle;
- restricted-account screen;
- callback/token sanitization;
- large-text / short-window behavior.

## MODIFY
- sav user-facing copy → Vi/Vam/Vas;
- signup: KEEP ime, KEEP prezime, REMOVE grad;
- validation order bez grad-a;
- signup service payload bez obaveznog city;
- shared account identity kao autoritet;
- Entry continuous pulse ukloniti;
- intent context formalizovati;
- legal copy vezati za stvarni bundle state.

## NEW / P1
- Google Sign-In Android tek kada kompletan provider flow radi.

## DEFER / GATED
- Phone OTP ako provider nije stvarno spreman;
- Apple do iOS izdanja.

## TEST PROOF
- requester intent → signup → confirmation → login → AI Need;
- worker intent → login → Zadaci;
- login bad password;
- signup duplicate account;
- resend confirmation;
- recovery request;
- invalid recovery link;
- recovery unknown write;
- restricted account;
- keyboard;
- large font;
- Android hardware Back;
- app background/foreground tokom auth komande.


# 399. PHASE 2 — POČETNA + SHELL KANONSKI CONTRACT

Ovo poglavlje zaključava osnovni shell posle prijave:
- Početna;
- root header;
- bottom navigation;
- Obaveštenja;
- push/pushed-screen ponašanje na nivou prezentacije.

Vizuelni autoritet za Početnu:
**`15989.jpg`**

Kodni autoritet:
- `src/app/(app)/_layout.tsx`;
- `src/app/(app)/index.tsx`;
- `src/ui/home/HomePresentation.tsx`;
- `src/ui/system/ScreenHeader.tsx`;
- `src/ui/system/TabBarItem.tsx`;
- `src/app/obavestenja.tsx`;
- `src/ui/notifications/InboxPresentation.tsx`.

Cilj:
ne menjati ono što 15989 već radi dobro.
Početna treba da izgleda kao ista aplikacija, samo završena.

---

# 400. ROOT SHELL — FINALNI CONTRACT

## 400.1 Bottom navigation

Finalne stavke:

**Početna · Zadaci · Dogovori · Poruke**

Zadržati trenutni vizuelni DNK:
- beli rounded navigation shell;
- blago zeleni selected capsule;
- jedna familija 2D ikonica;
- tekst ispod;
- bez shadow spektakla;
- bez centralnog FAB-a.

Aktuelni `TabBarItem` temelj se **KEEP**.

## 400.2 Root tab transition

Root tabovi se menjaju odmah.
Nema velikog slide-a između:
Početna ↔ Zadaci ↔ Dogovori ↔ Poruke.

Aktuelni instant switch ostaje.

## 400.3 Pushed screen transition

Detalji i flow ekrani jesu „ulazak dublje“.

Zadržati:
- kratku push/shift animaciju;
- ease-out;
- Reduce Motion → bez animacije.

Ne koristiti istu transition logiku za tab switch i pushed flow.

## 400.4 Kada bottom bar nestaje

Bottom bar se prikazuje samo na četiri root screen-a.

Nestaje na:
- Task detail;
- Application;
- Candidates;
- Agreement detail;
- Agreement change;
- group conversation;
- AI Need;
- review/publish flow;
- Raspored;
- rating;
- Profile children;
- Settings/Privacy/Support;
- auth flow.

To aktuelni `_layout.tsx` već uglavnom pravilno radi.

---

# 401. ROOT HEADER — FINALNI CONTRACT

## 401.1 Početna

Zadržati screenshot `15989`:

Levo:
**USKOČI brand mark / logo**

Desno:
- bell;
- avatar.

Ne prikazivati veliki tekst `Početna` pored loga samo zato što je route naziv Početna.

Aktuelni `ScreenHeader` / `ScreenChrome` brand-led smer je dobar.

## 401.2 Ostali root screenovi

Zadaci može imati discovery-specific chrome.

Dogovori i Poruke mogu imati:
- section title;
- relevantan secondary control;
- profil/bell samo ako ne pretrpava screen.

Ne moraju sva četiri root ekrana doslovno imati isti header sadržaj.
Moraju imati istu:
- visinu;
- horizontalni inset;
- control size;
- icon familiju.

## 401.3 Bell

Bell vodi na:
**Obaveštenja**

Bell badge:
- diskretna tačka kada postoji autoritativan unread signal;
- ne crtati izmišljeni broj.

## 401.4 Avatar

Avatar vodi na:
**Moj profil**

Ako slika ne postoji:
- inicijali / canonical fallback;
- ne placeholder osoba iz druge uloge.

---

# 402. POČETNA — FINALNI COMPOSITION CONTRACT

## 402.1 Default state — kao `15989`

Kada nema `Sledeće` i nema `Čeka Vas`:

1. root header;
2. dve glavne namere;
3. AI conversation resume ako postoji;
4. `Moji zadaci`;
5. `Moje prijave`;
6. `Dostupnost` ili `Podesite radni profil`;
7. bottom nav.

Ovo je osnovna kompozicija i treba da ostane vizuelno vrlo bliska trenutnom screenshotu.

## 402.2 Dve glavne namere

Dve kartice ostaju ravnopravne:

### Objavite zadatak
`Opišite šta Vam treba.`

Orange-soft surface + postojeći 2.5D task art.

### Uskočite i zaradite
`Pronađite zadatak.`

Green-soft surface + postojeći 2.5D work art.

Normal width:
2 kolone.

Large text / uska širina:
stack.

Nema dodatnog globalnog role toggle-a.

## 402.3 `Sledeće`

Ako postoji stvarni naredni Dogovor:

sekcija ide **iznad dve glavne namere**.

Prikazuje samo jedan najbliži potvrđeni termin:
- `Danas / Sutra / datum`;
- vreme;
- task title;
- druga strana ili `N saradnji`;
- mesto kada je relevantno.

Tap:
tačan Dogovor / requester task-group.

Ako Dogovori read nije dostupan:
ne prikazivati lažno prazno `Sledeće`.

## 402.4 `Čeka Vas`

Ako postoje stvarne pending akcije:

sekcija ide:
- ispod `Sledeće` kada oba postoje;
- iznad dve namere.

Max:
**3 akcije**

Moguće vrste:
- prijave čekaju izbor;
- promena Dogovora čeka odgovor;
- completion čeka potvrdu;
- application zahteva pregled;
- rating čeka;
- worker profile/setup zahteva relevantnu akciju samo kada server attention to tako tretira.

Ako više:
`I još N…`

Nema beskonačne attention liste na Home-u.

## 402.5 AI resume

Current `IntakeResume` koncept ostaje.

Copy formal:
`Nastavite razgovor o zadatku`
`Izaberite započeti razgovor.`

Ako postoji više razgovora:
otvara njihov izbor/history kontekst.

Ne prikazivati row ako nema ničega za nastavak.

## 402.6 Moji zadaci / Moje prijave

Ostaju obični grouped rows, ne horizontalni feed.

`Moji zadaci`
autoritative summary.

`Moje prijave`
autoritative summary.

Current horizontal `OwnTaskCard` i `ApplicationCard` carouseli na Home-u:
**RETIRE FROM HOME.**

Pune kartice pripadaju svojim listama.

## 402.7 Availability / worker setup

Ako worker profile ACTIVE:
prikaz:
`Dostupnost`
`Mogu odmah` / `Mogu odmah: isključeno`

Tap:
worker availability/edit flow.

Ako worker profile NONE/DRAFT:
umesto toga:
`Podesite radni profil`

Ne prikazivati oba istovremeno.

## 402.8 Aktuelni zadaci feed

`ExploreTasksAction / Aktuelni zadaci` carousel:
**RETIRE FROM HOME.**

Marketplace browse je `Zadaci`.

Razlog:
Početna ostaje action/continuation hub, ne drugi Discovery.

---

# 403. POČETNA — READ / ERROR / MOTION CONTRACT

## 403.1 First load

Stabilne stvari mogu odmah:
- header;
- dve glavne namere.

Dinamički podaci se ne izmišljaju dok read traje.

Ne crtati skeleton koji sugeriše da postoji Dogovor ili pending akcija ako to nije poznato.

## 403.2 Partial failure

Ako poslednji snapshot postoji:
ostaje na ekranu.

Quiet banner:
`Prikazano je poslednje učitano.`

Retry osvežava.
Ne briše trenutni pregled.

## 403.3 Full read failure

Glavne namere ostaju dostupne ako auth/session jeste validan.

Dynamic overview jasno kaže da nije učitan.

## 403.4 Pull refresh

Spinner samo kada korisnik stvarno povuče refresh.

Background refresh ne treba da iskače kao veliki loading.

## 403.5 Motion

Dozvoljeno:
- novi attention row kratko appear;
- tab selection capsule/glyph;
- press scale.

Ne:
- looping dekorativni motion;
- pomeranje cele Početne svaki put kada se vrati iz detail-a.

---

# 404. OBAVEŠTENJA — FINALNI CONTRACT

## 404.1 Uloga ekrana

Bell otvara:
**istoriju događaja**

Poruke nisu isto što i Obaveštenja.

Home `Čeka Vas`:
trenutna unresolved akcija.

Obaveštenja:
istorija onoga što se desilo.

## 404.2 Header

- Back;
- title `Obaveštenja`;
- settings icon.

Settings icon vodi na notification preferences.

## 404.3 Filteri

Zadržati postojeći model:

**Sve | Moji zadaci | Moje prijave**

To su samo filteri inbox-a.

Ne menjaju app role.

## 404.4 Event row

Jedan row:
- 32dp relevantna 2D/fact ilustracija;
- unread dot ako je autoritativno unread;
- event title;
- task/context line;
- vreme;
- mali destination cue kada je target poznat.

Whole row tap target.

Ne izmišljati actor avatar ako contract nema actor podatak.

## 404.5 Day grouping

Zadržati:
- `Danas`;
- `Juče`;
- datum/day groups.

`Označite sve` stoji uz prvi day heading kada unread postoji.

## 404.6 Read without open

Swipe `Pročitano` može ostati.

Ali swipe nikada nije jedini način:
screen reader action mora postojati.

## 404.7 Push ingress state

Ako app upravo rešava push event:
- `Otvaramo obaveštenje…`

Ako target više nije dostupan:
`Ovo obaveštenje više nije dostupno.`

Ako resolver/read padne:
retry.

Nikada ne koristiti raw route iz provider metadata.

---

# 405. SHELL + HOME — IMPLEMENTATION DELTA

## KEEP

- jedan Tabs shell;
- 4 root taba;
- `backBehavior=history`;
- retired-route cleanup;
- flow history cleanup;
- publication landing cleanup;
- current tab capsule;
- responsive nav labels;
- Reduce Motion support;
- pushed-screen animation;
- `ScreenHeader` brand-led root;
- Inbox bell;
- ActualUserAvatar;
- Home partial read architecture;
- server `paznjaZaPocetnu`;
- next Agreement authority;
- IntakeResume;
- availability/setup conditional.

## MODIFY

- sav copy formal;
- `Čeka te` → `Čeka Vas`;
- recovery copy formal;
- primary Home action labels formal;
- row copy formal;
- Notification empty/error copy formal;
- header/logo spacing final visual pass.

## RETIRE FROM HOME

- horizontal my task carousel;
- horizontal application carousel;
- `ExploreTasksAction`;
- permanent `Moj raspored` row.

## DO NOT ADD

- global requester/worker switch;
- numeric Poruke badge without authoritative cross-conversation unread;
- Home feed duplicating Discovery.

---

# 406. PHASE 2 — TEST PROOF

Obavezni scenariji:

1. potpuno nov nalog;
2. nalog sa 6 taskova, 1 prijavom, active worker profilom;
3. `Sledeće` only;
4. `Čeka Vas` only;
5. oba istovremeno;
6. >3 attention items;
7. partial Home read failure sa starim snapshotom;
8. full Home read failure;
9. large text → intent cards stack;
10. tab switch;
11. pushed screen hides bottom bar;
12. Back vraća pravi root context;
13. bell → populated notifications;
14. notification exact target;
15. unavailable notification target;
16. mark one notification read;
17. mark all read;
18. role filter `Sve / Moji zadaci / Moje prijave`.


# 407. PHASE 3 — MARKETPLACE FINALNI CONTRACT

Ova faza zaključava:
- Zadaci / Discovery;
- Search;
- Filters;
- Task Card;
- selected map preview;
- Public Task detail;
- Application;
- Moje prijave;
- Candidates;
- Selection.

Kodni autoritet:
- `DiscoveryPresentation.tsx`;
- `DiscoveryV1Screen.tsx`;
- `DiscoverySearchPanel.tsx`;
- `TaskCard.tsx`;
- `TaskFace.tsx`;
- `PublicNeedPresentation.tsx`;
- `prilike/[id]/prijava.tsx`;
- `CandidateFace.tsx`;
- `potrebe/[id]/kandidati.tsx`.

Vizuelni/QA autoritet iz koda:
**`src/designLab/dizajn-zadaci.tsx`**

Design lab već ima fixture scene za:
- dense cards;
- large-text cards;
- map/list sa 1/6/8/40/1000 taskova;
- PEEK/HALF/FULL;
- selected pin card;
- empty/loading/error;
- public detail;
- applied/own/full task;
- task-fit;
- `Za mene`;
- Search;
- Filters;
- selected map preview;
- fixed price / offers.

To treba koristiti kao obavezni visual regression set tokom implementacije.

---

# 408. ZADACI / DISCOVERY — FINALNI SCREEN CONTRACT

## 408.1 Na lokaciji

Mapa je osnovna pozadina ekrana.

Preko nje:
1. top search/filter chrome;
2. quick chips;
3. server-owned pin layer;
4. PEEK/HALF/FULL list sheet;
5. bottom navigation dok nema selected pina.

Ne pravimo poseban `Mapa / Lista` toggle.

## 408.2 Na daljinu

Kada je `Na daljinu` aktivno:
- mapa se povlači;
- nema PEEK/HALF/FULL bottom sheeta;
- puna lista postaje sadržaj root screena;
- isti Task Card family;
- bottom navigation ostaje.

Povratak na `Na lokaciji` vraća:
- map camera;
- sheet snap;
- list offset;
- filter/search context;
- session cache kada je još validan.

## 408.3 PEEK

Prikazuje:
- handle;
- broj zadataka u aktuelnom map scope-u.

Ne prikazuje mini horizontalni feed preko mape.

## 408.4 HALF

Mapa + nekoliko kartica.
Ovo je glavni mixed browsing položaj.

## 408.5 FULL

Lista prekriva skoro celu mapu.
Top controls ostaju razumljivi.
Korisnik je i dalje u istom Discovery kontekstu.

## 408.6 Selected pin

Kada korisnik izabere TASK/PLACE:
- bottom navigation se skloni;
- list sheet se skloni iza preview-a;
- selected marker dobije jasno selected stanje;
- preview stoji uz safe bottom edge;
- Back/close prvo vraća prethodni map/list state.

Aktuelni bar-hide i retained map session temelj se **KEEP**.

---

# 409. DISCOVERY TOP CHROME / SEARCH / FILTERS

## 409.1 Search entry

Discovery ima jednu jasnu top kontrolu.

Tap ulazi u full search surface.

Search nije mali input uguran u mapu sa pet paralelnih akcija.

## 409.2 Search — full surface

Zadržati postojeći model iz design lab-a:

- `Šta tražite?`;
- `Gde`;
- server gradovi / područja sa count-om;
- `Na daljinu · N`;
- popularna mesta;
- recent searches;
- tekstualna pretraga;
- rezultat se potvrđuje i vraća na Discovery.

Search ne duplira Filters.

## 409.3 Filters — bottom sheet

Screenshotovi `15990` / `15991` i current SearchPanel su dobar osnovni smer.

Finalne grupe:

### Mesto
- potvrđeno mesto / map area;
- promena mesta otvara pravi place search;
- ne držati nefunkcionalni grad input.

### Način rada
- Na lokaciji
- Na daljinu
- Oba

### Cena
- prema stvarnom price-mode contractu;
- fiksno / ponude;
- minimum samo kada se može pošteno porediti.

### Kada
- Danas
- Sutra
- Ovaj vikend
- datum/range kada je podržano.

Footer:
- `Očistite`
- `Prikažite N zadataka`

Result count mora biti server-authoritative za filter draft kada backend to podržava.

## 409.4 Quick chips

Quick chips su samo stvarno korisni prečaci.

MVP kandidati:
- Na lokaciji / Na daljinu;
- Za mene;
- Danas;
- Ovaj vikend;
- Sa cenom / price-mode shortcut ako je jasno.

Ne:
- HITNO;
- tools;
- vehicle;
- applicant count.

---

# 410. PIN SYSTEM — FINALNI VISUAL AUTHORITY

Aktuelni repo već ima stvarne USKOČI pin materijale:

- `p6-pin-task.png`;
- `p6-pin-task-chosen.png`;
- `p6-pin-count-N.png`;
- `p6-pin-count-N-chosen.png`;
- `uskoci-place-material.*`;
- `uskoci-cluster-material.*`.

## 410.1 TASK

Koristi postojeći round USKOČI mark.

Selected:
**orange outline/ring** iz postojećeg chosen asseta.

Ne dodavati:
- cenu;
- naslov;
- status;
- broj prijava.

## 410.2 PLACE

Više taskova na istoj javnoj tački.

Aktuelni count-pin family ostaje osnova:
USKOČI mark + broj.

Tap:
carousel taskova na tom mestu.

Ne zoomira samo zato što je broj >1.

## 410.3 CLUSTER

Više različitih geografskih tačaka u istom vizuelnom bucketu.

Mora ostati vizuelno različit od PLACE-a.

Tap:
zoom/fit bounds.

Ne otvara lažni carousel različitih lokacija.

## 410.4 Marker scale

Marker ne raste beskonačno sa map zoom-om.
Optički ostaje stabilna UI veličina.

Selected može dobiti mali scale/halo, ali ne novi veliki pin.

---

# 411. TASK CARD — FINALNI INFORMATION CONTRACT

Ovo poglavlje supersede-uje gušće current `TaskFace` ponašanje tamo gde ono prikazuje više činjenica nego finalni Discovery treba.

## 411.1 Dense worker card

Prikazuje samo:

1. opcioni relation marker;
2. naslov;
3. cenu / `Traži ponude`;
4. vreme;
5. bezbedno mesto + distance kada postoji;
6. capacity samo kada je >1 ili delimično popunjena.

Ne prikazuje:
- requester avatar;
- requester ime;
- requester rating;
- publication age;
- skills;
- tool;
- vehicle;
- condition rows;
- public applicant count;
- poseban CTA button.

Cela kartica je tap target.

## 411.2 Važan code delta

Current `TaskFace.tsx` ima capability za:
- publisher person;
- rating;
- requirement row;
- vehicle/tool;
- task age;
- razne status wordove.

Za finalni dense Discovery:
**presentation mora biti pojednostavljena.**

Te činjenice se ne brišu iz modela.
Samo se ne crtaju na dense kartici.

## 411.3 Cena

Worker list:
uporediva cena po osobi kada se može izračunati.

TOTAL:
original total / original required people.

PER_PERSON:
kako je zadato.

HOURLY:
`RSD / sat / osoba`.

OFFERS:
`Traži ponude`.

No price:
`Cena nije navedena`.

## 411.4 Capacity

1 osoba:
nema 0/1.

Više:
mali:
`0/3`, `1/3`, `2/3`

Accessibility:
puna rečenica.

## 411.5 Relation

Moguće:
- `Vaš zadatak`;
- `Prijava poslata`;
- `Dogovoreno`.

Ako relation read nije pouzdan:
dense card ne prikazuje tehnički `status nije potvrđen`.
Detail/retry rešava autoritet.

## 411.6 Large text

Title i price ne smeju da se bore za istu usku liniju.

Large layout:
- title full width;
- price sledeći red;
- meta raste;
- capacity/relation prelaze u novu liniju.

---

# 412. SELECTED MAP PREVIEW / PLACE CAROUSEL

## 412.1 TASK preview

Isti language kao dense card, sa malo više air-a.

Sadrži:
- close;
- title;
- price;
- time/place/distance;
- optional capacity/relation.

Cela kartica:
→ Public Task detail.

Nema:
`Pogledajte zadatak` dugmeta.

## 412.2 PLACE carousel

Jedna aktivna kartica.

Dole:
- dots;
- `1 od N`.

Swipe menja task.
Tap otvara aktivni task.

Ne prikazivati tri pune kartice istovremeno na malom telefonu.

Lazy-load članova ne sme da promeni trenutni indeks.

---

# 413. PUBLIC TASK DETAIL — FINALNI COMPOSITION CONTRACT

Current `PublicNeedPresentation` ima dobar functional skeleton.

Finalni redosled:

1. Back / rare menu;
2. optional relation state;
3. veliki task title;
4. decision summary:
   - price;
   - people/capacity;
   - when;
   - place;
5. task photos kada postoje;
6. `O zadatku`;
7. relevant requirements;
8. requester/public trust;
9. Q&A;
10. approximate place / route;
11. safety/report;
12. sticky footer.

## 413.1 Requester identity

Ovde, za razliku od dense kartice, requester trust je važan.

Prikaz:
- avatar;
- ime;
- rating + count;
- public worker/requester trust fact samo ako odgovara ulozi i server ga autoritativno daje.

Tap:
public requester profile sheet.

## 413.2 Requirements

Detail može da prikaže relevantne requirements.

Ali:
- ne praviti inventar server polja;
- tools/vehicles ne postaju globalni worker-profile facts;
- samo task-specific requirement ako zaista pomaže odluci.

## 413.3 Photos

Ako postoje:
iznad description ili odmah posle decision summary.

Viewer:
- swipe;
- count;
- bez download affordance kao glavne UI funkcije.

## 413.4 Q&A

Pre selection:
anonimna task pitanja.

Task detail prikazuje postojeća pitanja inline/section.
Full Q&A surface za širi razgovor.

## 413.5 Map

Local:
approximate public pin.

Remote:
nema prazne map sekcije.

Tačna adresa nikada ovde.

## 413.6 Sticky CTA state

NONE:
- fixed price → `Pošaljite prijavu`;
- OFFERS → `Pošaljite ponudu`.

OWNER:
`Otvorite svoj zadatak`.

APPLIED:
`Pogledajte svoju prijavu` ili `Otvorite Dogovor`.

UNKNOWN:
`Proverite ponovo`.

Full/closed:
state reason + `Drugi zadaci`.

---

# 414. APPLICATION — FINALNI VISUAL / INTERACTION CONTRACT

## 414.1 Jedan ekran, ne wizard

Top compact task context.

Ispod:

### Ljudi
samo ako >1 može imati smisla.

### Vaša ponuda
samo OFFERS.

### Termin
read-only accepted fact, ne editor.

### Poruka
optional.

Footer:
`Pregledajte prijavu`

## 414.2 Fixed-price application

Cena nije input.

Prikazuje derivaciju:
- po osobi;
- total ove prijave.

HOURLY mora koristiti:
**rate × people**.

## 414.3 OFFERS

Input:
`Koliko tražite ukupno?`

Ako people >1:
ispod live:
`N RSD po osobi`.

## 414.4 Review sheet

`Proverite prijavu`

Jedan compact summary:
- people;
- price;
- time/window/deadline;
- note.

Line:
`Ako Vas izaberu, nastaje Dogovor pod ovim uslovima.`

Primary:
`Pošaljite prijavu`

Secondary:
`Izmenite`

## 414.5 Success

`Prijava je poslata`

Sažetak receipt-a.

Primary:
`Moje prijave`

Secondary:
`Nazad na zadatak`

## 414.6 Unknown outcome

Freeze same intent.

`Ne znamo da li je prijava poslata.`

Primary:
`Proverite stanje`

Ne nuditi novi submit dok readback ne kaže da original nije primljen.

---

# 415. MOJE PRIJAVE — FINALNI CONTRACT

Tabs:

**Aktivne | Čeka Vas | Istorija**

Ne pet paralelnih filter chipova.

Card:
- task title;
- state chip;
- comparable price / my application total;
- people;
- term/deadline;
- one relevant next action.

Selected:
`Otvorite Dogovor`.

Changed task:
high-priority state:
`Zadatak je izmenjen.`

Detail/review:
- current task facts;
- current application facts;
- `Zadržite`;
- `Izmenite`;
- `Povucite`.

Bez izmišljenog diff-a ako backend nema pouzdan old/new fact mapping.

---

# 416. CANDIDATES — FINALNI CONTRACT

## 416.1 List

Candidate je osoba + njena cela prijava.

Card:
- avatar;
- ime;
- rating/count;
- total offer;
- per-person comparable value kada treba;
- people count;
- term compatibility;
- short note preview;
- selectability only when meaningful.

## 416.2 Sort

MVP:
- Redosled prijava;
- Cena;
- Ocena.

Cena:
**comparable per-person/per-slot**, ne total.

MY_PRICE:
price sort nema smisla ako svi imaju isti price basis.

## 416.3 Ne prikazivati

- tools/vehicles profile inventory;
- AI rank;
- acceptance rate;
- applicant competitiveness;
- lažni `Najbolji kandidat`.

## 416.4 Candidate detail sheet

- large person header;
- public profile entry;
- rating/trust;
- full offer;
- people;
- accepted task schedule;
- full note;
- server refusal reason ako nije selectable.

Primary:
`Izaberite`

## 416.5 Public profile

Sheet iz candidate detail-a.
Ne navigacija u drugi paralelni app world.

---

# 417. SELECTION — FINALNI CONTRACT

Confirm dialog:

`Izabrati Marka?`

Prikazuje tačno ono što se prihvata:
- people;
- price;
- schedule;
- relevant scope.

Copy:
`Prihvatanjem ove prijave nastaje Dogovor.`

Primary:
`Izaberite`

Success:
`Dogovoreno!`

Ako application pokriva više mesta:
jasno:
`Markova prijava pokriva 2 mesta.`

Ako task nije pun:
`Ostalo je još 1 slobodno mesto.`

Actions:
- `Otvorite Dogovor`;
- `Izaberite sledeću osobu` samo kada coverage i search stvarno dozvoljavaju.

Unknown selection:
`Ne znamo da li je izbor potvrđen.`
→ `Proverite stanje`.

---

# 418. PHASE 3 — CODE GAPS KOJI MORAJU BITI REŠENI

## P0

1. HOURLY application total:
   `rate per person × people`.

2. Candidate price sort:
   comparable per-person/per-slot.

3. Dense Task Card:
   ukloniti publisher identity/rating, age i requirement inventory iz Discovery prikaza.

4. Application:
   ne proizvoditi alternative exact-time proposal u new flow.

5. Map/list:
   list/count moraju biti exact current spatial scope.

6. Remote:
   ne mešati remote u local map count/list.

## P1

7. session spatial cache / stale-while-revalidate;
8. final PLACE lazy carousel behavior;
9. final exact task media storage/cleanup lifecycle gde backend još ima gap.

---

# 419. PHASE 3 — DESIGN LAB / QA MATRIX

Pre odobrenja moraju se pregledati najmanje scene:

### Cards
- `kartice`
- `kartice-veliki`

### Discovery
- `lista?n=1`
- `lista?n=6`
- `lista?n=40`
- `lista?n=1000`
- `lista&sheet=peek`
- `lista&sheet=half`
- `lista&sheet=full`
- `lista-prazno`
- `lista-ucitavanje`
- `lista-greska`
- `lista-za-mene`
- `lista-za-mene-odbijeno`

### Search / filters
- `pretraga`
- `pretraga-sta`
- `filteri`
- `filteri-izabrano`

### Map preview
- `kartica-na-mapi`
- `kartica-na-mapi-dugo`

### Detail
- `detalj`
- `detalj-veliki`
- `detalj-prijavljen`
- `detalj-moj`
- `detalj-zatvoren`
- `detalj-ucitavanje`
- `detalj-greska`
- `detalj-nedostupan`
- `detalj-uklapanje`
- `detalj-ponude`

Finalni visual review treba da koristi ove stvarne komponente, ne ručno nacrtan HTML map placeholder kao autoritet.


# 420. PHASE 4 — SARADNJA / PORUKE / RASPORED / OCENE

Ova faza zaključava:
- Dogovori listu;
- requester task-group;
- bilateralni Dogovor;
- private/group Poruke;
- Agreement changes;
- cancellation;
- problem;
- exact location;
- Raspored;
- completion;
- ratings.

Kodni autoritet:
- `AgreementCollectionPresentation.tsx`;
- `AgreementListCard.tsx`;
- `agreementListModel.ts`;
- `AgreementPresentation.tsx`;
- `AgreementOverview.tsx`;
- `AgreementOverviewParts.tsx`;
- private chat presentation/service;
- `GroupConversationPresentation.tsx`;
- `groupConversationService.ts`;
- `ConversationInboxPresentation.tsx`;
- `AgendaScreen.tsx`;
- Month/Week/Day calendar presentations;
- `AgreementCompletionReview.tsx`;
- `AgreementReviewScreen.tsx`;
- `AgreementReviewPresentation.tsx`.

Vizuelni/QA autoritet:
- `src/designLab/dizajn-dogovori.tsx`;
- `src/designLab/dizajn-poruke.tsx`;
- `src/designLab/dizajn-kalendar.tsx`.

---

# 421. DOGOVORI ROOT — FINALNI CONTRACT

## 421.1 Nema stalnog `Aktivni | Istorija` switch-a

Finalni root Dogovori ekran je organizovan po korisnikovom vremenu i akcijama.

Header:
**Dogovori**

Desno:
- `Raspored` ikonica/akcija;
- optional filter.

Ispod nema obaveznog segmented control-a.

## 421.2 Čeka Vas

Ako postoje akcije:
sekcija ide prva.

Primeri:
- `Odgovorite na predlog termina`
- `Potvrdite završetak`
- `Ocenite saradnju`
- `Proverite stanje radnje`

Najviše 3 kompaktna reda.

Ako više:
`I još N…`

Tap otvara tačno stanje konkretnog Dogovora.

## 421.3 Danas

Prikazuje današnje potvrđene Dogovore.

Kartica prioritizuje:
- vreme;
- task title;
- drugu stranu / broj saradnji;
- mesto;
- jedan state cue.

Ne ponavlja celu cenu/status tabelu iz detail-a.

Requester sa više worker-a za isti task i isti kontekst vidi task-group card.

Worker vidi svoj bilateralni Dogovor.

## 421.4 Sledeće

Naredni Dogovori posle danas.

Grupisanje po:
- Sutra;
- dan/datumu;
- kasnije.

Ne prikazivati beskonačan kalendar na ovom ekranu.
Za puni vremenski pregled postoji `Raspored`.

## 421.5 Bez tačnog termina

Aktivni flexible Dogovori bez exact intervala.

Compact section:
`Bez tačnog termina · N`

Ako je samo jedan:
može se prikazati direktan row.

Ako ih je više:
tap otvara list/sheet.

Dogovor sam nosi akciju `Predložite termin` kada je dozvoljeno.

## 421.6 Prethodne saradnje

Na dnu root Dogovori ekrana:

`Prethodne saradnje` →

To je sekundarni ulaz, ne stalni tab.

Otvara završene/otkazane saradnje sa filterima:

- Sve
- Završene
- Otkazane

Sekundarno:
- Tražio/la sam pomoć
- Uskočio/la sam

Search po task title/person može da postoji kada količina opravdava.

## 421.7 Zašto

Korisnik ne treba da razmišlja:
`Da li je ovo aktivno ili istorija?`

Treba odmah da razume:
`Šta treba da uradim i šta mi sledi?`

## 421.8 Requester task grouping

Ako više bilateralnih Dogovora pripada istom tasku:

prvi nivo:
**jedan task record**

Primer:

`Selidba stana`
`Danas 17–20 · Liman`
`3/3 dogovoreno`
`2 saradnje`

Tap otvara task collaboration workspace:
- zajednički task kontekst;
- aktivne saradnje;
- group chat kada postoji;
- svaki worker row vodi u svoj bilateralni Dogovor.

Ne sabirati njihove bilateralne cene u jednu lažnu grupnu cenu.

## 421.9 Worker card

Worker vidi konkretan odnos:

`Selidba stana`
`Danas 17–20`
`Ana M.`
`Liman`

Optional:
price ako pomaže skeniranju.

Tap:
bilateralni Dogovor.

## 421.10 Empty

Ako nema current Dogovora:

2.5D agreements illustration.

`Još nemate tekuće saradnje.`

`Kada izaberete nekoga ili Vas neko izabere, pojaviće se ovde.`

Ako postoje prethodne:
secondary:
`Pogledajte prethodne saradnje`

Ako nema ni prethodnih:
bez nepotrebnog secondary CTA-a.


# 422. DOGOVOR — GLAVNI WORKSPACE

Dogovor ima samo:

**Pregled | Poruke**

Ovo ostaje zaključano.

Header:
- Back;
- lice druge strane;
- ime;
- uloga u odnosu na mene;
- eventualno jedan contextual action.

Ne prikazivati rating u headeru samo zato što public profil ima ocenu.
Trust se otvara iz profila, ne ponavlja na svakom chrome-u.

## 422.1 Pregled — redosled

1. header osobe;
2. `Pregled | Poruke`;
3. next-step / current-state card;
4. izvorni task link;
5. prihvaćeni uslovi;
6. group context kada postoji;
7. komunikacija i privatno mesto;
8. problem state ako postoji;
9. vidljive akcije;
10. destructive/safety actions;
11. glavni completion/rating CTA kada pripada state-u.

## 422.2 Accepted terms

Section:
**Uslovi**

- Dogovoreno ukupno;
- Mesto;
- Termin;
- Ljudi;
- Obim.

To su Agreement facts, ne current Task facts.

Ako verzija >1:
quiet:
`Uslovi su izmenjeni.`

## 422.3 Termin

Aktivni bez exact termina:
`Termin nije dogovoren`

Completed/cancelled bez exact termina:
`Bez tačnog termina`

Ne ostavljati terminalni Dogovor sa tekstom koji zvuči kao buduća akcija.

## 422.4 Group participants

`Ko je u Dogovoru` se prikazuje samo kada stvarno dodaje informaciju.

1:1:
header već daje drugu osobu; nema nepotrebne duple liste.

Multi-person:
prikaz relevantan.

---

# 423. NEXT STEP / STATE HIERARCHY U DOGOVORU

Jedan najvažniji state block na vrhu.

Moguća stanja:

## Dogovoreno
nema pending odluke.

## Predlog izmene čeka
Ako druga strana:
`Predlog izmene čeka Vaš odgovor.`

Ako moj:
`Vaš predlog čeka odgovor.`

## Termin nije dogovoren
Ako je flexible Agreement i korisnik može:
`Predložite termin`

## Čeka potvrdu završetka
Requester:
`Završetak čeka Vašu potvrdu.`

Worker:
`Čeka se potvrda druge strane.`

## Problem prijavljen
neutralno upozorenje.

## Završen
Ako rating čeka:
ocena je sledeća radnja.

Ako rated:
`Završen · ocena sačuvana`

## Otkazan
read-only terminal state.

## Unknown/recovery
ne krije sadržaj:
`Proveravamo da li je radnja potvrđena.`

---

# 424. AGREEMENT CHANGES

Change flow je mesto za:
- cenu;
- obim;
- termin.

Ne Application.

## 424.1 Predlog

Review pre slanja:
- trenutno prihvaćeni uslovi;
- predložena promena;
- šta ostaje isto.

Po slanju:
stari accepted terms ostaju authority dok druga strana ne prihvati.

## 424.2 One pending proposal

Finalni proizvod tretira jedan pending proposal kao canonical.

Ne crtati paralelne conflicting proposal cards.

## 424.3 Response

Druga strana:
- `Prihvatite`;
- `Odbijte`.

Pri accept-u:
server ponovo proverava worker calendar conflict za exact term.

## 424.4 Pending blocks completion

Dogovor jasno kaže:
`Najpre rešite predlog izmene.`

Ne ostaviti completion dugme sivo bez razloga.

---

# 425. CANCELLATION

Finalni user-facing termin:

**Otkažite saradnju**

ne `Otkažite Dogovor` kao primarna radnja.

Razlog:
korisnik otkazuje odnos sa konkretnom osobom, ne celu parent potrebu.

## 425.1 Flow

1. tap `Otkažite saradnju`;
2. razlog je obavezan;
3. review;
4. potvrda;
5. receipt / unknown readback.

Copy mora objasniti:
- otkazuje se samo ova saradnja;
- druge saradnje na tasku ostaju;
- coverage/search se može ponovo otvoriti.

## 425.2 Current code delta

`AgreementDangerActions` i problem exits još koriste `Otkaži Dogovor`.

**MODIFY → `Otkažite saradnju`.**

---

# 426. PROBLEM U DOGOVORU

`Prijavite problem` je formalno bilateralno stanje.

Ne znači:
- krivicu;
- refund;
- automatsku kaznu;
- lošu ocenu.

## 426.1 Forma

- kratak title;
- multiline opis;
- max iz current server contracta;
- `Pošaljite prijavu problema`;
- `Odustanite`.

Unknown outcome:
tekst se zamrzava;
readback iste radnje.

## 426.2 Posle prijave

Warn-soft note:
- ko je prijavio;
- kada;
- opis;
- info: auto completion je zaustavljen.

Ispod realni putevi:
- Poruke;
- Otkažite saradnju;
- No-show / support ako postoji autoritativan tok.

## 426.3 Manual completion

Requester može svesno potvrditi završetak ako server to dozvoli.

Review:
`Problem ostaje evidentiran, ali potvrdom završavate saradnju.`

---

# 427. EXACT LOCATION / CONTACT

## 427.1 Mesto u Agreement-u

Public/coarse task place ostaje vidljiv kao kontekst.

Privatna lokacija je odvojena dozvola.

## 427.2 Grant

Requester:
`Podelite lokaciju`

Worker:
`Prikažite privatnu lokaciju`

Requester:
`Opozovite deljenje`

Terminal Agreement:
grant više ne daje aktivan pristup.

## 427.3 Request address

Worker:
`Zatražite adresu`

To otvara private chat sa draft porukom.
Ne šalje automatski.

## 427.4 Telefon

Current design lab ima legacy scene tipa:
- `broj podeljen`;
- `nalog bez broja`.

Finalni MVP:
**PHONE grant / privatni broj nije product surface.**

Te scene ostaju samo regression/historical reference dok legacy backend postoji.

Ne koristimo ih kao finalni UI autoritet.

## 427.5 Batch share

Future P1:
`Podelite adresu aktivnim učesnicima`

Server-owned batch/recovery capability poželjan.

Dok ga nema:
pojedinačno po Dogovoru.

---

# 428. PORUKE TAB — CONVERSATION INBOX

Current `ConversationInboxPresentation` ima dobar temelj.

Finalno:

Jedan row = jedan razgovor.

Task title je primarni orijentir.

Line 2:
last message.

Line 3:
`Privatno · Ime`
ili
`Grupa · N osoba` kada member count postoji.

Vreme:
danas → sat;
drugi dan → `Juče` / datum.

## 428.1 Unread

Group unread count može da se prikaže kada autoritativan.

Private V1 unread:
unknown.

Zato:
**nema lažnog numeric root Poruke badge-a.**

## 428.2 Terminalni razgovori

Root inbox nema stalni `Aktivni | Istorija` segment.

Ako lifecycle autoritativno zna da je razgovor terminalan:
row dobija:
`Završeno · samo za čitanje`

Ako lifecycle nije poznat:
ne klasifikovati silom.

Sekundarni filter `Prethodni razgovori` može se uvesti tek kada količina i server data to opravdaju.

## 428.3 Empty

`Još nema razgovora`
`Razgovor započinjete iz Dogovora.`

CTA:
`Otvorite Dogovore`

## 428.4 Stale/error

Ako postoje poslednji rows:
ostaju.

`Razgovori nisu osveženi.`

Retry.

Ne brišemo listu.

---

# 429. PRIVATE AGREEMENT CHAT

Private chat je vezan za bilateralni Dogovor.

Podržava:
- tekst;
- fotografije;
- voice gde je build stabilan;
- unknown-send recovery.

## 429.1 Header/context

Ista druga osoba kao Agreement header.

Compact task context:
- task;
- mesto;
- termin;
- cena;
- people samo kada dodaje informaciju.

Ne prikazivati group terms u private chatu.

## 429.2 Media

Photos:
thumbnail + viewer.

Voice:
jedan stabilan player state.

Upload/send pending:
jasno local state, bez duplog send-a.

## 429.3 Terminal

Composer nestaje.

`Razgovor je završen. Poruke možete samo da čitate.`

Formal copy.

---

# 430. GROUP CHAT

Group postoji samo kada task ima najmanje 2 različita izabrana worker naloga.

Worker koji u jednoj prijavi dovodi kolegu:
nije zaseban group member.

## 430.1 Channels

**Svi učesnici | Privatno**

Requester Privatno:
picker osobe kada ih je >1.

Worker Privatno:
direktno requester.

Nema worker-worker private DM-a.

## 430.2 Group privacy

KEEP postojeći model:
- novi član vidi poruke od prijema;
- ended member ne vidi buduće;
- stara authorized history ostaje;
- nema retroactive access.

## 430.3 Group content

Current backend:
**TEXT ONLY**

`GroupMessage` danas nosi `body` i service šalje samo tekst.

Target:
- TEXT — KEEP;
- PHOTO — **NEW P1**;
- VOICE — DEFER.

Group photo je posebno korisna za:
- parking;
- ulaz;
- predmet;
- zajedničke instrukcije.

Ne crtati photo composer dok backend capability ne postoji.

## 430.4 People sheet

Prikazuje:
- aktivne relevantne članove;
- requester management rows kada treba.

Ne prikazuje bilateralne cene grupe.

---

# 431. RASPORED — FINALNI CONTRACT

Vizuelni autoritet:
`dizajn-kalendar.tsx`.

Glavni pogledi:

**Mesec | Nedelja | Dan**

Zadržati.

## 431.1 Month

- period header;
- weekday grid;
- selected day;
- dots/event signal;
- availability tint samo kada worker profile ima podatak;
- lista selected-day Dogovora ispod.

Ne pretvarati month view u gust booking kalendar.

## 431.2 Week

- strip dana;
- Dogovori grupisani po danu;
- dugi nazivi rastu, ne trunciraju do besmisla.

## 431.3 Day

Pravi timeline.

Current `DayView` je dobar temelj:
- satnice;
- availability soft band;
- Agreement blocks;
- now line;
- overlap columns;
- overflow `Još termina`.

Zadržati.

## 431.4 Availability

Soft band:
`Mogu da radim`

Dogovor block vizuelno ima veći autoritet.

## 431.5 Dogovori bez exact termina

Top bar:
`N Dogovora bez tačnog termina`

Ako samo jedan i može proposal:
tap može direktno u predlog termina.

Inače sheet/list.

## 431.6 Requester same-task grouping

Ako više requester bilateralnih Dogovora ima:
- isti parent task;
- isti exact interval;

calendar presentation treba jedan event:

`Selidba stana`
`17–20 · 3 saradnje`

Tap:
task-group context.

Ako termini nisu isti:
odvojeni eventovi.

**NEW presentation aggregation.**

## 431.7 Remote deadline

Deadline nije busy block.

Target:
posebna deadline/rok činjenica u agenda/list delu.

Ne crtati lažni interval.

## 431.8 Archive

Current `AgendaScreen` još ima `onArchive → /arhiva`.
Design lab ima `Arhiva` scene.

Finalni product:
**RETIRE standalone Arhiva.**

Raspored footer:
- `Moja dostupnost` može ostati;
- `Arhiva` row ukloniti.

Finished/cancelled:
Dogovori → Istorija.

Arhiva design-lab scene ostaju samo compatibility regression dok route ne bude povučen.

---

# 432. CALENDAR CONFLICT

Worker exact commitment je blocking authority.

Ako accept/proposal conflict:

`Termin se preklapa sa drugim Dogovorom.`

Primary:
`Otvorite Raspored`

Ne nuditi `Svejedno prihvatite`.

Requester overlaps:
ne blokirati samo zato što se vreme preklapa.

---

# 433. COMPLETION — FINALNI CONTRACT

Completion je po bilateralnom Dogovoru.

## 433.1 Worker

Action:
`Zadatak je gotov`

Otvara `Pregled završetka`.

Sheet:
- task;
- other person;
- dogovoreni termin;
- ljudi;
- ukupno.

Primary:
`Da, zadatak je gotov`

Formal copy:
`Druga strana će dobiti zahtev da potvrdi završetak ili prijavi problem.`

## 433.2 Requester

State:
`Završetak čeka Vašu potvrdu`

Prikazuje server deadline.

Actions:
- `Potvrdite završetak`
- `Prijavite problem`

Review:
`Potvrditi završetak?`

Primary:
`Da, potvrdite završetak`

## 433.3 48h

Server-owned.

Retry iste komande ne produžava.

## 433.4 Timeout

Ako deadline prođe i nema open problema:
server auto-complete.

Ako projection nema terminal source:
UI kaže samo:
`Dogovor je završen.`

Ako ga dobije:
može:
`Automatski završeno nakon isteka roka.`

## 433.5 Unknown outcome

Worker mark done / requester confirm:
zamrzni isti intent.

`Ne znamo da li je radnja potvrđena.`

`Proverite stanje`

---

# 434. RATINGS — FINALNI UI CONTRACT

Current rating UI je vizuelno među zrelijim flow-ovima.

KEEP:
- person face;
- centered name/role/task;
- 5 large stars;
- orange kao jedini accent;
- max 3 optional tags;
- optional comment do 500 kada supported;
- sticky save;
- immutable submit;
- unknown-outcome recovery;
- success moment.

MODIFY:
sav copy formal.

## 434.1 Form

`Kako je prošla saradnja?`

1–5.

Label:
- Loše
- Ispod očekivanja
- Dobro
- Vrlo dobro
- Odlično

Tags:
`Šta je obeležilo saradnju?`
`Nije obavezno · najviše 3`

Comment:
optional.

Warning:
`Ocenu posle čuvanja ne možete da menjate.`

## 434.2 Saved

`Ocena je sačuvana.`

Prikaži:
- stars;
- rating;
- tags;
- own comment.

**Ne govoriti odmah da ocena “pomaže drugima da biraju” ako još nije published.**

Current `SACUVANO_NOTE`:
`Ocena pomaže drugima da biraju i ne može da se menja.`

To nije dovoljno precizno za blind model.

Target:
`Ocenu posle čuvanja ne možete da menjate. Biće objavljena kada druga strana pošalje svoju ocenu ili kada istekne rok za ocenjivanje.`

## 434.3 Blind publication target

Window:
**14 dana**

Rules:
- obe submit pre roka → publish tada;
- jedna submit → publish na deadline;
- posle deadline nema novog submit-a.

UI state:
- `Sačuvana · čeka objavu`;
- `Objavljena`.

Current backend to još nema.

---

# 435. RATINGS / REPUTATION — TEHNIČKI GAP

Current `reviewsClientService`:
- review receipt;
- completed eligibility;
- account-level `rpc_get_account_reputation`.

Nedostaje target model:

1. review deadline;
2. hidden/unpublished state;
3. publish timestamp;
4. bilateral both-or-deadline release;
5. role of reviewed party in aggregate;
6. requester aggregate;
7. worker aggregate;
8. role-scoped public/read-own reputation.

Zato:
**blind ratings + role-scoped reputation su P0 pre nego što ratings postanu javni trust authority.**

Može postojati private/internal rating flow ranije, ali ne sme javno tvrditi drugi publication model.

---

# 436. PHASE 4 — LEGACY / NON-TARGET SCENES

Design labs namerno čuvaju istorijske/recovery scene.

Ne znači da sve ulazi u finalni MVP.

Legacy-only/reference:

- Calendar `Arhiva` scenes;
- Agreement phone-number/shared-phone scenes;
- old `Otkaži Dogovor` copy;
- old informal `ti/tvoj` copy;
- immediate-public rating semantics.

Koriste se da ne razbijemo compatibility dok se kod migrira, ali nisu design authority finalnog proizvoda.

---

# 437. PHASE 4 — IMPLEMENTATION DELTA

## KEEP

- bilateral Agreement model;
- task grouping model;
- accepted versioned terms;
- Active/History;
- Agreement `Pregled | Poruke`;
- one pending change authority;
- completion guards;
- group privacy;
- private message command recovery;
- exact-location bilateral grant;
- calendar worker conflict;
- Month/Week/Day;
- availability layer;
- 48h completion;
- problem blocking auto-completion;
- rating editor mechanics;
- immutable review save.

## MODIFY

- formal copy everywhere;
- cancel language → `Otkažite saradnju`;
- remove standalone Calendar Arhiva entry;
- requester calendar same-task grouping;
- remote deadlines distinct;
- saved-rating publication copy;
- public reputation display role-scoped.

## NEW P0/P1

- blind review publication backend;
- role-scoped reputation;
- requester trust;
- group photos P1;
- batch exact-location grant P1.

## DEFER

- group voice;
- public/private phone grant UI;
- task-wide bulk cancellation.

---

# 438. PHASE 4 — DESIGN LAB QA MATRIX

## Dogovori

Obavezno pregledati:
- `list`
- `grouped-list`
- `history`
- `long`
- `empty`
- `loading`
- `error`
- `one`
- `group`
- `worker`
- `worker-done`
- `worker-term`
- `waiting`
- `no-term`
- `problem`
- `form`
- `recovery`
- `done`
- `cancelled`
- `cancelled-me`
- `status-loading`
- `status-error`
- `status-unavailable`
- rating scenes
- chat scenes
- chat media/unknown states

Legacy phone scenes nisu target UI.

## Poruke
- `list`
- `long`
- `sets`
- `owner`
- `empty`
- `loading`
- `error`
- `stale`

## Raspored
Target scenes:
- mesec with Dogovori;
- empty;
- selected empty day;
- no-term;
- many;
- week;
- day timeline;
- overlap;
- overnight;
- long names;
- loading/error;
- partial;
- timezone;
- availability states;
- new/special/copy term flows.

Standalone Arhiva scenes:
legacy regression only.

## Ratings
- empty/unavailable;
- eligible no stars;
- chosen rating;
- max tags;
- comment;
- unknown submit;
- saved/waiting-publication;
- read failure after saved.


# 439. PHASE 5 — PROFIL / NALOG / PRIVATNOST / PODRŠKA

Ova faza zaključava:
- Moj profil;
- public requester/worker profil;
- Radni profil;
- worker area/location;
- Availability;
- Lični podaci / profilna fotografija;
- Ocene kao profile history;
- Podešavanja;
- Obaveštenja preferences;
- Privatnost;
- blokirane osobe;
- export;
- legal;
- account closure;
- Safety;
- Support;
- About;
- AI history kao account destination.

Kodni autoritet:
- `ProfileHubPresentation.tsx`;
- `profil.tsx`;
- worker profile presentation/service;
- worker area/location;
- account settings presentation;
- privacy/export/legal/closure surfaces;
- safety screen;
- support case system;
- ratings profile surfaces;
- AI history routes.

Vizuelni/QA autoritet:
- `src/designLab/dizajn-profil.tsx`;
- `src/designLab/dizajn-privatnost.tsx`.

---

# 440. SHARED IDENTITY — FINALNI ACCOUNT CONTRACT

Jedan nalog ima:
- jedno ime/prezime odnosno jedan canonical display identitet;
- jednu glavnu profilnu fotografiju;
- jedan login/auth account.

Role profile-i ne održavaju duplirani identitet.

## 440.1 Current code problem

`profil.tsx` trenutno primarno čita requester profile row za identity i pada na worker row ako requester row ne postoji.

Target:
**account identity postaje poseban autoritet.**

Requester/worker projections referenciraju shared identity.

## 440.2 Migration rule

Dok migration traje:
- postojeći requester/worker names se ne brišu naslepo;
- jedno canonical account ime se izvodi/migrira;
- conflict slučajevi traže deterministic rule ili owner/admin migration;
- novi UI više ne dozvoljava nezavisno menjanje dva imena.

## 440.3 Fotografija

Jedna shared account portrait.

Public requester i public worker face koriste isti portrait.

Role facts se menjaju; lice ne.

---

# 441. MOJ PROFIL — FINALNI HUB

Visual authority:
`15996 / 15997` + current `ProfileHubPresentation`.

Sadašnji card DNK je dobar, ali finalno treba manje velikih odvojenih boxeva.

## 441.1 Top identity

- shared portrait;
- ime;
- `Jedan nalog · obe mogućnosti`;
- mesto samo kada je stvarno account-safe/shared podatak.

Ne prikazivati worker city kao da je obavezno mesto prebivališta.

## 441.2 Reputacija

Finalno:
dve role figure, ne blended account aggregate.

### Kao naručilac
`★ 4,9 · 12 ocena`
ili `Još nema ocena`.

### Kao uskočer
`★ 4,8 · 23 ocene`
+ reliability ako je public/available.

Ne prikazivati jednu veliku `AccountReputation`.

## 441.3 Activity facts

Mogu:
- završene saradnje kao naručilac;
- završene saradnje kao uskočer.

Ne sabirati ih u jednu brojku bez role labela.

## 441.4 Main rows

Predloženi redosled:

### Uskačem
- Radni profil

### Moje aktivnosti
- Moji zadaci
- Moje prijave
- Moj raspored

### Nalog i pomoć
- Podešavanja
- Pomoć i podrška

Manje elevated cardova; više grouped rows.

## 441.5 Public preview

Current route bira worker public profile automatski ako je worker ACTIVE.

Finalno:
tap:
**Pogledajte kako Vas drugi vide**

Ako obe javne uloge postoje:
sheet:
- `Kao naručioca`
- `Kao uskočera`

Ako samo jedna:
otvori direktno.

**NEW own-role preview selector.**

---

# 442. PUBLIC REQUESTER PROFILE

Prikazuje samo requester-relevant trust.

- shared avatar;
- shared name;
- label `Kao naručilac`;
- requester rating + count;
- completed requester collaborations;
- member since kada authoritative;
- identity verified samo kada stvarno verified.

Ne:
- worker capabilities;
- worker reliability;
- worker radius;
- email/phone/address.

Safety:
`Prijavite ili blokirajte osobu`.

---

# 443. PUBLIC WORKER PROFILE

- shared avatar;
- shared name;
- label `Kao uskočer`;
- categories/capabilities;
- general work area;
- on-site/remote modes;
- worker rating + count;
- completed worker collaborations;
- reliability samo ako public + minimum sample;
- work description;
- verified licenses only with provenance;
- member since.

Ne:
- application count;
- acceptance rate;
- exact home point;
- private radius origin;
- tools/vehicles inventory;
- technical profile status codes.

---

# 444. PROFILE RATINGS HISTORY

Current `/profil/ocene` ima:
- Primljene;
- Date;
- account-level aggregate.

Final:
**role-scoped view.**

## 444.1 Primljene

Pre nego što se prikaže aggregate/lista:
role selector ili clear role grouping:

- Kao naručilac
- Kao uskočer

Review row već nosi `receivedAs` i to je dobar temelj.

## 444.2 Date

Moje poslate ocene:
task + druga osoba + moja rating value.

Ne meša se u moju javnu reputaciju.

## 444.3 Publication awareness

Unpublished/blind review:
ne prikazivati drugoj strani/public listi pre release-a.

Moj own history može da kaže:
`Sačuvana · čeka objavu`.

---

# 445. RADNI PROFIL — FINALNI CONTRACT

Current `WorkerProfilePresentation` je funkcionalno snažan.

KEEP:
- status;
- AI-first editing;
- availability;
- execution modes;
- work area;
- activation checks;
- sticky footer/recovery;
- keyboard behavior.

## 445.1 First setup

Hero:
conversation art.

Title:
`Ispričajte čime se bavite`

Body:
`Koje zadatke želite da preuzimate, gde i kada Vam odgovara.`

AI predlaže.
Čovek pregleda.
Čovek aktivira.

## 445.2 Saved profile

Sections:

### Čime uskačete
categories/skills + short description.

### Način rada
- Na lokaciji;
- Na daljinu;
- oba.

### Područje rada
general area + radius where relevant.

### Dostupnost
weekly availability + available now when supported.

### Kapacitet
`Do N osoba u prijavi`

Relevant licenses separately.

Ne:
tools/vehicles general inventory.

## 445.3 Activation

Minimalno:
- shared account name exists;
- ≥1 capability;
- area for on-site OR remote execution scope.

Team capacity default 1.

Legacy `city` nije finalni activation truth.

## 445.4 Suspended

Neutral-serious state:
`Radni profil je trenutno suspendovan`

Support path.

Ne sakrivati reason ako server authoritatively gives one.
Ne izmišljati ako nema.

---

# 446. WORKER AREA / LOCATION

Current `/profil/lokacija` ima dobar privacy-first temelj.

Final screen:

`Područje rada`

Facts:
- država/market kada zaista treba;
- grad/mesto rada;
- radius chips;
- approximate center map.

Privacy:
`Kućna adresa i GPS dozvola nisu potrebni.`

## 446.1 Map

Approximate center, not home location.

Stored point remains coarse.

No precise-public home marker.

## 446.2 Remote-only

Remote-only worker ne mora da unese lažni grad samo da bi aktivirao profil.

Execution mode controls whether local area is mandatory.

## 446.3 Confirmation

Save:
`Sačuvajte područje rada`

Unknown:
same form remains, readback replaces blind resubmit.

---

# 447. AVAILABILITY / AVAILABLE NOW

## 447.1 Weekly availability

Separate from Agreement calendar.

User defines reusable preference windows.

Confirmed Dogovor overrides availability.

## 447.2 Available now

Ako ostaje:
mora biti temporary signal sa expiry.

Target UI:
`Dostupni ste sada`
+ `Do HH:MM` ili drugi authoritative expiry.

Bez expiry:
ne isticati public/matching signal kao trajan.

## 447.3 Calendar integration

Availability editor ostaje reachable from:
- worker profile;
- Raspored.

Ne sa Account Settings-a.

---

# 448. LIČNI PODACI / PROFILNA FOTOGRAFIJA

## Lični podaci

Shared identity:
- Ime;
- Prezime;
- eventualni shared display name rule ako ga backend uvede.

Ne:
- worker area;
- skills;
- availability.

Save samo kada postoji change.

## Fotografija

- current photo;
- Gallery;
- Camera;
- remove with confirm;
- upload/process states;
- unknown outcome recovery.

One portrait authority.

---

# 449. SETTINGS — FINALNI CONTRACT

Current `AccountSettingsPresentation` je vizuelno među najboljim screenovima.

**KEEP composition.**

Final groups:

## Nalog
- Lični podaci
- Pristup nalogu

## Iskustvo
- AI razgovori
- Obaveštenja
- Privatnost i podaci

## Pomoć
- Pomoć i podrška
- Prijavite grešku
- Pravila i saglasnosti
- O aplikaciji

Bottom:
- Odjavite se
- account email quiet.

## 449.1 Copy

Current:
`Tvoje iskustvo`
→ final `Vaše iskustvo`

`Tvoji zahtevi`
→ `Vaši zahtevi`

Sve user-facing formal.

## 449.2 Password/provider behavior

Ako nalog nema local password:
ne nuditi neupotrebljivu `Promena lozinke`.

Pristup nalogu treba da prikazuje stvarno povezane auth providere.

---

# 450. AI HISTORY — ACCOUNT SURFACE KOJI JE NEDOVOLJNO BIO OPISAN

Current routes:
- `/ai-istorija`
- `/ai-istorija/[conversationId]`

Ovo mora ostati u finalnom screen inventory-ju.

## 450.1 List

Title:
`AI razgovori`

Tabs / grouping:
- Zadaci
- Radni profil

Row:
- short human topic/title;
- datum;
- stanje:
  - može da se nastavi;
  - završen/read-only.

Whole row tap.

Open conversation:
nastavlja pravi editor.

Closed:
read-only transcript.

## 450.2 Transcript

Read-only historical conversation.

Header:
`AI razgovori`

Context:
- Zadatak
ili
- Radni profil.

No composer.

If not admitted:
`Razgovor nije dostupan za pregled.`

Back:
AI history.

## 450.3 Privacy

AI history is private account data.

No public/share affordance by default.

Retention behavior follows published policy.

---

# 451. NOTIFICATION PREFERENCES

Final user-facing families:

- Zadaci i prilike
- Dogovori
- Poruke
- Podsetnici

Quiet hours separately.

Do not expose 20 raw event codes.

Do not expose HITNO override in MVP.

Channel switches only for actually working channels.

Push permission itself is OS capability, not just another business-event toggle.

---

# 452. PRIVATNOST I PODACI

Current `PrivacyPresentation` already has a strong architecture.

Final hub:

- Ko šta vidi
- Rokovi čuvanja
- Izvoz podataka
- Blokirane osobe
- Pravila i saglasnosti
- Zatvaranje naloga

No everyday primary CTA.

## 452.1 Ko šta vidi

Info lines:
- public task + approximate point;
- exact private location only by grant;
- remote task no map address;
- public profile role facts;
- email/login never public.

Current text that says `kontakt` is shared by collaboration rules should be reviewed because MVP target does not expose phone.

Prefer explicit:
`Tačna privatna lokacija se deli samo kada je Vi podelite u aktivnom Dogovoru. Kontakt ostaje kroz poruke u aplikaciji.`

## 452.2 Retention

If unpublished:
one calm sentence.

If published:
human data-class names, expandable details.

Do not expose engine names / dataset codes.

## 452.3 Automatic AI cleanup

Only claim what policy/execution receipt proves.

Never say specific conversation was deleted unless receipt proves it.

---

# 453. DATA EXPORT

Lifecycle remains:

- no request;
- requested;
- preparing;
- ready;
- unavailable;
- expired;
- cancelled;
- failed;
- read error.

Visual pattern:
same screen, same structure, status changes.

Ready:
one clear save/download action through supported file flow.

No fake progress percent if backend does not give it.

---

# 454. BLOCKED ACCOUNTS

Shows only **people I blocked**.

Never reveal:
- who blocked me;
- incoming block reason.

Rows:
- name if authoritative;
- neutral fallback if name unavailable;
- `Odblokirajte` via confirm.

Unblock:
does not restore old location grants/messages/access.

Paged list remains.

---

# 455. SAFETY REPORT + BLOCK

Report and Block are separate.

## Report

Categories:
- Uznemiravanje
- Prevara
- Nebezbedan rad
- Diskriminacija
- Drugo

Private to support/safety.

Bind context:
- Task;
- Agreement;
- message where applicable.

## Block

Stops ordinary contact/new matching.

Does not prevent:
- finishing active Agreement;
- cancelling it;
- reporting problem;
- safety/support.

Copy must make this clear.

---

# 456. LEGAL / CONSENTS

Screen has:
- current published documents;
- acceptance state;
- version/effective date if useful;
- open document;
- actual accept action only when needed.

Unpublished:
neutral `Dokumenti još nisu objavljeni.`

Do not use alarm/error visual for a normal unpublished development state.

Unknown acceptance write:
readback.

---

# 457. ACCOUNT CLOSURE

Current closure architecture is strong and stays staged.

## 457.1 Entry

`Zatvorite nalog`

Placed at bottom of Privacy, not everyday Settings.

## 457.2 Blockers

Read first.

Human rows:
- aktivni Dogovori;
- otvoreni zadaci;
- pending applications/workflows;
- required legal/retention holds where relevant.

Each blocker has contextual way to resolve it.

## 457.3 Export

Offer data export before irreversible closure.

## 457.4 Review

Clear:
what closes;
what may be retained by published policy;
what becomes unavailable.

Irreversible confirm.

## 457.5 Unknown outcome

Do not say `Nalog je zatvoren` without terminal receipt.

State:
`Proveravamo stanje zatvaranja naloga.`

## 457.6 Terminal

Only terminal receipt may produce:
`Nalog je zatvoren.`

No premature `deleted` claim.

---

# 458. SUPPORT — FINALNI CONSUMER CONTRACT

Current support system is much stronger than a simple email form.

KEEP:
- private case list;
- new case;
- case conversation;
- replies;
- decision;
- appeal;
- context references;
- paging;
- unknown-send recovery.

## 458.1 Support home

Title:
`Podrška`

Sections:
- Vaši zahtevi;
- FAQ;
- Bezbednost i podaci.

Footer:
`Novi zahtev`

If none:
`Nemate još zahteva.`

## 458.2 New case

Human topics.

Minimal form:
- tema;
- naslov;
- opis.

Context can prefill:
- Task;
- Agreement;
- message;
- bug/build info.

Do not show internal support fields.

## 458.3 Case

Conversation-like history.

Decision is clearly differentiated from ordinary support reply.

Appeal only where backend/policy offers it.

No fake response SLA.

---

# 459. OPERATOR / SAFETY SUPPORT INBOX — INTERNAL SURFACE

Current route:
`/podrska/operator`

Current code correctly requires operator capability to expose its entry from consumer support.

Product classification:
**INTERNAL / AUTHORIZED STAFF SURFACE**

It is not part of ordinary consumer screen inventory.

Requirements:
- no discoverable consumer navigation;
- route must remain server-authorized;
- consumer cannot infer operator status of another account;
- store build may contain code, but access remains capability-gated;
- internal design lab scenes are not consumer UI authority.

Operator/Safety switch is staff-only.

---

# 460. O APLIKACIJI

Current screen style is good.

Keep:
- USKOČI mark;
- one-sentence vision;
- two possibilities;
- legal/privacy links;
- version/build quiet.

Do not make:
- commit hash;
- backend target;
- update channel

prominent consumer content.

Debug identity may be internal/dev-only.

---

# 461. PROFILE / SETTINGS — VISUAL SYSTEM RULE

This family already has a mature visual language.

Do NOT redesign into dashboard cards.

Use:

- one identity surface at top where needed;
- grouped white panels;
- 2D icon wells in Settings;
- simple rows;
- no extra shadows on every row;
- section gaps 20–24;
- destructive action separated.

Public profile sheet:
slightly richer trust surface, but still same system.

---

# 462. PHASE 5 — MAIN CODE GAPS

## P0 / architecture

1. shared account identity authority;
2. role-scoped reputation;
3. requester trust projection;
4. own role public-preview selector;
5. signup/account identity migration with no required city;
6. privacy copy remove implied public/private phone sharing if MVP phone is dormant.

## P1

7. available-now expiry;
8. worker geography activation modernization;
9. provider-aware account access screen;
10. role-aware Ratings screen aggregate/filter.

## KEEP

- worker AI editor;
- location privacy;
- closure workflow;
- export;
- legal;
- blocked list;
- safety model;
- support case system.

---

# 463. PHASE 5 — DESIGN LAB QA MATRIX

## Profile

Use `dizajn-profil` for:
- hub loading/error/ready;
- active/draft/suspended/no worker profile;
- work stats/reliability;
- ratings received/given;
- public profile trust visible/hidden/too-few;
- password states;
- worker profile setup/edit;
- profile photo states;
- large text / owner text scale.

Final review must override:
- blended AccountReputation;
- auto-worker public preview;
- informal copy.

## Privacy

Use `dizajn-privatnost` scenes:

### Privacy
- hub states;
- retention loading/unpublished/published/error.

### Export
- every lifecycle state.

### Legal
- loading/unpublished/accept/pending/unknown/accepted/public docs.

### Closure
- loading/error/blockers/preparation/review/unknown/processing/closed.

### Support
- consumer list/empty/loading/error;
- new case variants;
- case conversation/decision/closed/error.

### Blocked
- empty/list/long/paged/loading/error/recovery.

### Accessibility
- large text 1.3;
- owner 1.15 fixtures.

Operator scenes:
staff-only regression, not consumer product.


# 464. PHASE 6 — AI NEED / OBJAVA / AI PROFIL

Ova faza zaključava:
- AI razgovor za novi zadatak;
- AI edit postojećeg zadatka;
- voice input;
- contextual location confirmation;
- task photos;
- review pre objave;
- draft save/delete;
- publish/replacement;
- publish success;
- AI radni profil conversation;
- AI history.

Kodni autoritet:
- `/nova`;
- `IntakePresentation.tsx`;
- AI turn journal/recovery;
- location dialogue;
- task photo upload system;
- `/pregled-zadatka`;
- review preparation/publication service;
- `ReviewDetail.tsx`;
- task photo editor;
- worker AI profile conversation.

Vizuelni/QA autoritet:
- `dizajn-ai.tsx`;
- `dizajn-objava.tsx`;
- `dizajn-ai-mesto.tsx`.

---

# 465. AI NEED — MENTALNI MODEL

Korisnik ne popunjava veliku formu.

On:
1. prirodno kaže šta mu treba;
2. AI postavlja samo potrebna pitanja;
3. structured facts nastaju u pozadini;
4. korisnik vidi živ sažetak kada ima smisla;
5. korisnik pregleda sve pre save/publish;
6. tek ljudska potvrda proizvodi canonical state.

Kanon:
**AI_PROPOSED → HUMAN_CONFIRMED → CANONICAL_SAVED**

AI nikada samostalno ne objavljuje ili menja task.

---

# 466. NOVI ZADATAK — POČETAK RAZGOVORA

Screen:
- header `Novi zadatak`;
- welcome:
  `Opišite šta Vam treba.`
- composer;
- attach photos;
- optional hold-to-talk;
- privacy/help note po potrebi.

Ne kreirati praznu server conversation samo zato što je screen otvoren.
Current code to već pravilno radi:
conversation nastaje tek prvom stvarnom radnjom.

---

# 467. AI CHAT — FINALNI VISUAL CONTRACT

Chat-first.

## Assistant
- suptilan USKOČI assistant identity;
- neutral bubble/surface;
- ne robot mascot koji dominira.

## User
- jasna druga strana conversation-a;
- isti message system kroz ceo AI flow.

## Quick replies
Chips kada zaista ubrzavaju odgovor.

Ne:
- 5 CTA dugmadi ispod svakog AI odgovora.

## Structured draft

Živa task kartica se pojavljuje kada postoje korisni strukturirani facts.

Ne posle prve rečenice sa skoro praznim podacima.

Kada ready:
card postaje miran final summary + `Pregledajte zadatak`.

---

# 468. AI SAFETY STATES

Server safety:
- ALLOW
- CLARIFY
- REVIEW
- BLOCK

## ALLOW
normalan conversation.

## CLARIFY
AI traži relevantno pojašnjenje.

Ne prikazivati safety label korisniku samo zato što je interno state CLARIFY.

## REVIEW
Korisnik može:
- sačuvati/pregledati draft kada je dozvoljeno;
- dobija neutralan notice da objava zahteva dodatnu proveru.

Ne tvrditi da je zahtev zabranjen.

## BLOCK
Conversation se zaustavlja.

Composer odlazi.

Jedna jasna safety poruka.

Ne nuditi publish.

Ne objašnjavati interne classifier kodove.

---

# 469. UNKNOWN AI TURN / RECOVERY

Current AI journal/recovery model je dobar i mora ostati.

Ako ne znamo da li je poruka stigla:
- thread ostaje;
- typed content se ne gubi;
- ista request identity se proverava;
- korisnik ne dobija drugi novi razgovor.

Copy:
`Ne znamo da li je poruka poslata.`

Action:
`Proverite ishod`

Ako je safe known retry:
ponavlja se ista radnja.

Ne `Pošaljite ponovo` kao novi command dok outcome nije poznat.

---

# 470. VOICE INPUT

Hold-to-talk može ostati.

States:
- idle;
- listening;
- processing;
- answer;
- permission denied;
- interrupted but text retained;
- error.

## Permission

Microphone se traži tek na prvi voice gesture.

Denied:
- objasniti;
- text input ostaje;
- ako permanently denied:
  `Otvorite podešavanja`.

Voice je alternativni input, nikada blocker.

## Motion

Voice level može kratko reagovati dok sluša.
Reduce Motion / accessibility ne sme zavisiti od animacije.

---

# 471. LOCATION U AI RAZGOVORU

AI može razumeti:
- grad;
- area;
- route/stops;
- remote/local intent.

Ali physical point confirmation ostaje ljudska.

## 471.1 Contextual map question

Kad je local task i nedostaje potvrđena approximate tačka:
conversation može inline da zatraži:
`Pokažite približno mesto na mapi`.

To je dobro current ponašanje.

## 471.2 Confirmation

AI location proposal nije canonical samo zato što zvuči tačno.

Korisnik potvrđuje map point.

Stored point ostaje safe/coarse za public projection.

Exact private address ostaje odvojena činjenica.

## 471.3 Remote

Remote task:
nema map point requirement.

Ne praviti mapu samo zato što account ima grad.

## 471.4 Multi-stop

Current route/stops presentation postoji.

MVP treba da prikaže confirmed route jasno.

Ako full `NeedPlan/MULTI_STOP` domain model nije potpuno spreman:
ne otvarati složeni route-planning product iznad onoga što canonical geography podržava.

---

# 472. TASK PHOTOS — FINALNI CONTRACT

Current server/client hard limit:
**6 fotografija**

To je tehnička istina i ne treba je razbiti samo radi starijeg koncepta.

Product recommendation:
- podstaći 1–3 za običan zadatak;
- dozvoliti do 6 kada stvarno pomaže.

UI copy:
`Dodajte nekoliko jasnih fotografija ako pomažu da se zadatak razume. Možete dodati do 6.`

## 472.1 Add

Sources:
- Galerija
- Kamera

Permission se traži on demand.

## 472.2 Processing

Photo states:
- local/pending;
- uploading;
- processing;
- ready;
- failed;
- unknown outcome.

Ne nestaje pri uncertain send-u.

## 472.3 Privacy

Current processing notice kaže da se task photos šalju Google Gemini servisu radi content check-a i da obrada može biti van Evrope.

To mora ostati **policy/legal-review item**, ne sakriven tehnički detail.

Final copy mora biti usklađen sa stvarnim provider/data-processing dokumentima pre launch-a.

## 472.4 Metadata

Current policy:
remove metadata, resize.

Good privacy behavior — keep.

## 472.5 Removal

Saved photo removal asks confirm.

Unknown remove/send:
readback.

---

# 473. DRAFT CARD U AI RAZGOVORU

Draft card je **live summary**, ne objavljeni Task Card.

Može pokazati:
- title;
- price mode/value;
- time/window/deadline;
- area/remote;
- people;
- small fact icons.

Ne prikazuje:
- publication status;
- applicant count;
- requester public rating kao da je task već javno objavljen.

## 473.1 Ready

Kada complete:
facts kao mirni rows.

Primary:
`Pregledajte zadatak`

Edit existing:
`Pregledajte izmene`

## 473.2 Missing

Kaže samo human missing facts.

Ne prikazivati hidden category/matcher facts.

## 473.3 Unsent text

Ako typed text nije poslat:
review mora jasno:
`Neposlati tekst nije deo pregleda. Ostaje u razgovoru.`

Good current rule — keep.

---

# 474. PREGLED PRE OBJAVE — FINALNI COMPOSITION CONTRACT

Current `ReviewDetail` je odlična baza.

Redosled treba da imitira kako će task izgledati drugima:

1. task photos kada postoje;
2. title;
3. description;
4. price;
5. place;
6. time/deadline;
7. people;
8. relevant requirements;
9. requester identity/trust preview;
10. approximate map/route;
11. response deadline ako postoji;
12. `Dodajte još podataka` samo za stvarno optional facts.

Svaki editable deo:
jedan pencil/entry point.

Ne praviti dupli semantic editor za location.
AI conversation owns semantic correction; map owns coordinate confirmation.

---

# 475. REVIEW — EDITING MODEL

Tap pencil ne otvara novu paralelnu formu gde nije potrebno.

Target:
- title/description/price/time/people → vrati se u AI conversation sa correction intent;
- photos → photo manager;
- approximate point → map confirmation;
- optional factual extras → appropriate AI topic/controlled editor.

Return:
isti conversation / isti unsent draft ostaje.

---

# 476. PRICE / TIME IN REVIEW

Review je poslednji ljudski dokaz pre publish-a.

## MY_PRICE

Jasno:
- TOTAL / PER_PERSON / HOURLY basis.

HOURLY:
`RSD / sat / osoba`.

## OFFERS

`Tražite ponude`

Nema lažnog 0 RSD.

## Time

Fixed:
exact start + exact end.

Flexible:
window words.

Remote:
deadline, not busy interval.

## Application deadline

Ako feature postoji:
nazvati ga:
`Prijave do...`

Ne mešati sa work completion deadline.

---

# 477. SAVE DRAFT / PUBLISH

Dve radnje nad istim confirmed review contractom:

### Sačuvajte nacrt
private state.

### Objavite zadatak
evaluation + publication.

Ne stvarati dve različite verzije istog review-a samo zato što je CTA drugi.

## 477.1 Draft

Može se nastaviti kasnije.

Delete:
`Obrišite nacrt`

Irreversible confirm.

## 477.2 Publish

Primary:
`Objavite zadatak`

During:
`Objavljujemo…`

Unknown:
`Ne znamo da li je zadatak objavljen.`
→ `Proverite stanje`

Ne objaviti drugi task naslepo.

---

# 478. PUBLISH SUCCESS

Moment:
`Objavljeno`

Kratan brand success, ne veliki onboarding.

Automatski/CTA vodi na:
**Owner Task detail**

Ne:
generic Discovery mapa.

Razlog:
owner prvo treba da vidi šta se dešava sa njegovim taskom.

Current code već ide u ovom smeru.

---

# 479. EDIT OBJAVLJENOG TASKA

Published task edit je replacement/version flow, ne mutiranje postojećih bilateralnih Dogovora.

Review mora objasniti kada je relevantno:

- nova objava/novi uslovi ne menjaju već prihvaćene Dogovore;
- stare prijave se ne prenose ako server replacement contract tako kaže;
- current accepted Agreements ostaju frozen.

Ne praviti edit flow koji izgleda kao običan text save ako zapravo zatvara/replaces search state.

---

# 480. OWNER TASK — POSLE OBJAVE

Owner task je radni prostor taska.

States:
- published/no applications;
- applications waiting;
- partially filled;
- fully filled;
- search closed;
- Agreements active;
- completed/terminal;
- unavailable/loading/error.

Prioritet:
1. šta sada treba uraditi;
2. coverage;
3. task facts;
4. candidates/applications;
5. active collaborations;
6. lifecycle actions.

Ne koristiti publication age kao veliki status osim ako server ima authoritative fact i korisniku stvarno pomaže.

---

# 481. WORKER PROFILE AI CONVERSATION

Isti razgovorni sistem kao Need AI, ali drugi domain.

Welcome:
`Ispričajte čime se bavite`

Extract:
- capabilities;
- description;
- work modes;
- area;
- availability;
- team capacity;
- license facts where relevant.

AI predlaže.
User review.
Canonical save.

Ne:
- tools/vehicles inventory;
- auto activate without confirmation;
- global role switch.

Corrections from saved profile:
open exact AI topic.

---

# 482. AI HISTORY — FINAL INTEGRATION

`AI razgovori` u Settings je pravi destination, ne debug istorija.

Two purposes:
- Zadaci;
- Radni profil.

Open:
continue if current/open and allowed.

Closed:
read-only transcript.

Abandoned:
read-only or hidden according to canonical history policy.

Retention:
published privacy policy.

---

# 483. PHASE 6 — CODE / PRODUCT GAPS

## P0/P1

1. AI runtime must be healthy in production.
2. Voice/transcription path only enabled when actual runtime/provider works.
3. Location dialogue capability gated by real resolver availability.
4. Photo provider/privacy/legal copy reviewed and published.
5. Publish evaluator/category registry fully ready.
6. No identity-required fact unless identity feature/policy is active.
7. Replacement/edit semantics proven E2E.
8. Media storage cleanup lifecycle proven.

## Product cleanup

9. final photo recommendation:
   - encourage 1–3;
   - technical max remains 6.
10. optional response-deadline UI only where server fact exists.
11. multi-stop only within supported canonical geography model.

---

# 484. PHASE 6 — DESIGN LAB QA MATRIX

## AI
Use `dizajn-ai`:
- welcome;
- large welcome;
- thread;
- ready;
- large ready;
- AI unavailable with saved draft;
- pending;
- streaming;
- unknown message outcome;
- long;
- microphone listen/denied/interrupted;
- completed;
- abandoned;
- edit thread/completed;
- safety BLOCK;
- voice idle/listen/thinking/answer/error;
- worker conversation;
- loading/unavailable.

## Publish / owner
Use `dizajn-objava`:

### Review
- ready;
- offers;
- missing;
- publishing;
- published;
- draft;
- unknown outcome;
- edit;
- long;
- route;
- remote;
- no photos;
- price correction;
- term correction;
- application deadline;
- more facts;
- loading/error/large.

### Owner
- draft;
- missing place;
- photo processing;
- no applications;
- applications;
- offers;
- partially filled;
- search closed;
- agreed;
- long/loading/error/large.

### Location
- stationary;
- route;
- multiple points;
- remote;
- locked;
- saved/legacy;
- loading/large.

### Photos
- grid;
- upload;
- unknown;
- full six;
- empty;
- loading;
- error;
- large;
- remove confirm.

## AI location dialogue
Use `dizajn-ai-mesto`:
- proposal;
- ambiguous;
- unavailable;
- saved.


> **ISTORIJSKI CLAIM:** da su porodice planirane nije dokaz vizuelno odobrene realne RN scene. Aktualni visual status = CONTRACT / PIXEL-FINAL NOT YET (J1/J2).

# 485. MASTER COVERAGE — DA LI JE SVAKI EKRAN SADA ISPLANIRAN

Posle faza 1–6:
**svaka glavna consumer screen porodica ima product/UX contract.**

To ne znači da je svaki ekran već pixel-final implementiran.

Status legenda:

- **LOGIC FINAL** — domain/state/akcije/navigation zaključani;
- **VISUAL CONTRACT** — finalna kompozicija/stil pravila zaključani;
- **CODE GAP** — current code mora da se promeni;
- **VISUAL IMPLEMENTATION** — tek treba odraditi u realnim komponentama.

---

> **ISTORIJSKA COVERAGE MATRICA:** `FINAL` je tadašnji logical/contract progress, ne odobren pixel-final. Kanonski statusi su J1 i J2.

# 486. COVERAGE MATRIX

| Porodica | Logic | Visual contract | Glavni preostali gap |
|---|---|---|---|
| Entry | FINAL | FINAL | formal copy + remove loop pulse |
| Login | FINAL | FINAL | formal copy |
| Signup | FINAL | FINAL | remove city + shared identity |
| Email confirmation | FINAL | FINAL | production polish |
| Recovery | FINAL | FINAL | production polish |
| Restricted | FINAL | FINAL | neutral final copy |
| Početna | FINAL | FINAL | retire feed carousels |
| Root nav/header | FINAL | FINAL | visual consistency |
| Obaveštenja | FINAL | FINAL | exact lifecycle push targets |
| Zadaci local | FINAL | FINAL | exact spatial scope + cache |
| Zadaci remote | FINAL | FINAL | final presentation |
| Search | FINAL | FINAL | production polish |
| Filters | FINAL | FINAL | server count / final groups |
| Task Card | FINAL | FINAL | simplify current TaskFace |
| Map pins | FINAL | FINAL | wire real assets consistently |
| TASK preview | FINAL | FINAL | final component |
| PLACE carousel | FINAL | FINAL | lazy/cache P1 |
| Public Task | FINAL | FINAL | final component polish |
| Owner Task | FINAL | FINAL | final component polish |
| Q&A | FINAL | DIRECTION+ | final visual pass |
| Task photos | FINAL | FINAL | storage/privacy proof |
| AI Need | FINAL | FINAL | runtime health |
| Need review/publish | FINAL | FINAL | runtime/evaluator proof |
| Application | FINAL | FINAL | HOURLY fix |
| Moje prijave | FINAL | FINAL | tabs/copy cleanup |
| Candidates | FINAL | FINAL | price sort fix |
| Selection | FINAL | FINAL | final UI/copy |
| Dogovori list | FINAL | FINAL | copy/group polish |
| Agreement | FINAL | FINAL | copy/action naming |
| Agreement changes | FINAL | FINAL | final visual pass |
| Cancellation | FINAL | FINAL | terminology |
| Problem | FINAL | FINAL | formal copy |
| Exact location | FINAL | FINAL | batch share P1 |
| Poruke inbox | FINAL | FINAL | private unread authority |
| Private chat | FINAL | FINAL | platform voice stability |
| Group chat | FINAL | FINAL | photos P1 |
| Raspored | FINAL | FINAL | requester grouping/deadline |
| Availability | FINAL | FINAL | expiry for available-now |
| Completion | FINAL | FINAL | source/reason optional |
| Rating form | FINAL | FINAL | blind backend |
| Rating publication | FINAL | FINAL | NEW backend |
| Moj profil | FINAL | FINAL | shared identity + role ratings |
| Public requester | FINAL | FINAL | requester trust |
| Public worker | FINAL | FINAL | role rating aggregate |
| Radni profil | FINAL | FINAL | geography activation |
| Worker area | FINAL | FINAL | remote-only rule |
| Personal data/photo | FINAL | FINAL | identity migration |
| Profile ratings | FINAL | FINAL | role-scoped redesign |
| Settings | FINAL | FINAL | formal copy/provider-aware |
| AI history | FINAL | FINAL | production polish |
| Notification prefs | FINAL | FINAL | bind to real events |
| Privacy | FINAL | FINAL | final public-phone wording |
| Retention | FINAL | FINAL | publish policy |
| Export | FINAL | FINAL | delivery proof |
| Blocked | FINAL | FINAL | polish |
| Safety | FINAL | FINAL | polish |
| Legal | FINAL | FINAL | publish actual docs |
| Closure | FINAL | FINAL | final live proof |
| Support home | FINAL | FINAL | formal copy |
| New support case | FINAL | FINAL | simplify form |
| Support case | FINAL | FINAL | polish |
| Support decision/appeal | FINAL | FINAL | policy/execution proof |
| About | FINAL | FINAL | hide debug metadata |
| Worker AI | FINAL | FINAL | runtime |
| Internal operator inbox | INTERNAL | INTERNAL | capability gating |

`DIRECTION+` za Q&A znači:
funkcija/state/navigation su jasni, ali nije potreban novi poseban vizuelni jezik — koristi isti task/detail/list system. Final component pass ipak ostaje.

---

# 487. ŠTA JOŠ MORA BITI ODLUČENO PRE PRODUKCIONOG FREEZE-A

Ovo su stvarne preostale vlasničke/policy odluke, ne detalji koji se mogu improvizovati u kodu.

## 487.1 Shared identity storage
Tačan backend authority/migration za:
- ime;
- prezime;
- display name;
- portrait.

UX je definisan; data migration nije.

## 487.2 Ratings launch policy
Da li javni launch čeka:
- blind 14-day model,
ili
- ratings privremeno ostaju non-public dok blind backend ne bude gotov.

Ne preporučuje se javno pustiti staro immediate-public pravilo pa kasnije menjati očekivanja.

## 487.3 Requester trust
Koje public činjenice osim rating/count:
- completed collaborations;
- member since;
- eventualno cancellation/reliability signal.

Ne izmišljati reliability dok formula/policy nije definisana.

## 487.4 Group photos
Da li ulazi u MVP launch ili P1 odmah posle launch-a.

Product value je visoka; tehnički backend nedostaje.

## 487.5 Available-now expiry
Tačno trajanje:
npr. 2h / 4h / do ručnog isteka sa hard maximum.

Mora biti server-owned.

## 487.6 Task photo product recommendation
Backend max ostaje 6.
UX preporuka je 1–3 za običan zadatak.
Ako vlasnik želi hard max 3, to zahteva server/client policy promenu; trenutno nije potrebno.

## 487.7 Google Android auth
Ako je deo prvog Google Play launch-a:
mora biti implementiran/proveren pre Store release-a.
Ako nije, email/password je dovoljan funkcionalni MVP.

---

# 488. TEHNIČKI BLOCKERI / P0 PRE JAVNOG LAUNCH-A

Na osnovu Mastera + current repo:

1. HOURLY price × people.
2. Candidate comparable-price sort.
3. signup no required city + shared identity path.
4. role-scoped reputation.
5. blind review/publication backend ili gate public ratings.
6. push exact targets za Selection / Agreement change / Completion / Problem / Rating.
7. Discovery exact spatial scope + remote separation.
8. worker requester-side calendar grouping where duplicate UI becomes misleading.
9. remote deadline distinct from busy work interval.
10. remove/redirect standalone `Arhiva` product entry.
11. formal copy pass.
12. AI runtime/evaluator health for AI-dependent publish.
13. identity requirement remains OFF/gated until real feature.
14. photo/storage cleanup and provider privacy/legal proof.
15. final closure/export/live policy proof.
16. release E2E across main vertical flow.

---

# 489. FINAL VISUAL IMPLEMENTATION METHOD

Od ovog trenutka ne pišemo novi teorijski UX dokument za svaku komponentu.

Rad je:

1. otvori stvarni design-lab scene set;
2. proveri ga protiv finalnog contracta u ovom Masteru;
3. promeni realnu presentation komponentu;
4. ponovo pregledaj sve scene;
5. proveri 1.0 / 1.15 / 1.3 text scale;
6. proveri 360 i ~430 dp;
7. tek onda screen porodica dobija `VISUAL IMPLEMENTED`.

HTML služi:
- E2E klikabilnom pregledu;
- flow handoff-u;
- telefonu.

Ali actual production presentation + design lab je autoritet za pixel-final izgled.

---

> **SUPERSEDED REDOSLED RADA:** važi redosled S01–S16 iz J4, uz S17/S18 kao horizontalne provere; Entry/Auth ne vraća rad na početak projekta.

# 490. NEXT EXECUTION ORDER

## Visual implementation
1. Entry/Auth
2. Početna/Shell/Notifications
3. Discovery/Task/Application/Candidates
4. Dogovori/Poruke/Raspored/Completion/Ratings
5. Profile/Settings/Privacy/Support
6. AI/Review/Publish

## Then
7. kompletan E2E clickable prototype;
8. user review na telefonu;
9. implementation deltas/backend gaps;
10. full tests;
11. Play Store release proof.

Nema više potrebe za još jednim “master planom”.
Ovaj dokument je sada dovoljno kompletan da se pređe sa planiranja na finalnu implementaciju UI porodica.


# 491. DOGOVORI — KONKRETAN FINALNI PRIMER ROOT EKRANA

Finalni root kada korisnik ima aktivnost:

DOGOVORI                                    [Raspored] [Filter]

ČEKA VAS
• Potvrdite završetak
  Montaža TV-a · Marko                         →

• Odgovorite na predlog termina
  Selidba stana · Nikola                       →

DANAS

17:00–20:00
Selidba stana
Liman · 2 saradnje · 3/3
[Marko] [Nikola]                               →

20:30–21:30
Montaža TV-a
Ana M. · Grbavica                              →

SLEDEĆE

Sutra · 10:00–12:00
Dostava paketa
Petar M. · Centar                              →

BEZ TAČNOG TERMINA · 1
Prevod prezentacije
Ove nedelje                                     →

PRETHODNE SARADNJE                              →

Bottom:
Početna · Zadaci · **Dogovori** · Poruke

Vizuelno:
- ista bela/svetla USKOČI podloga;
- bez velikog dashboard hero-a;
- compact rows/cards;
- vreme je snažan orijentir;
- attention koristi mali orange accent, ne veliki warning panel;
- task-group card koristi avatar stack;
- nema tehničkih status kodova;
- nema stalnog `Aktivni | Istorija` segmenta.


# 492. BILATERALNI DOGOVOR — FINALNI EKRAN OD VRHA DO DNA

Ovo je ekran koji se otvara kada korisnik iz task-group konteksta pritisne konkretnu osobu, npr:

Dogovori
→ Selidba stana
→ Marko P.
→ **bilateralni Dogovor**

Ako na tasku postoji samo jedna saradnja, Dogovori card može odmah otvoriti ovaj ekran.

Mentalni model:
**ovo je radni prostor između Vas i jedne konkretne osobe za jedan konkretan posao.**

Ne mešati ga sa:
- parent Task-om;
- grupnim razgovorom;
- javnim profilom;
- istorijom svih događaja naloga.

---

# 493. DOGOVOR — HEADER

## 493.1 Levo

Back.

Back vraća:
- requester task-group ako se došlo kroz grupisani Dogovori card;
- Dogovori root ako je bilateralni card otvoren direktno;
- Poruke ako se došlo iz inbox-a i otvoren je chat context;
- pravi source kada je došlo iz push/deep link-a.

Cold fallback:
`Dogovori`.

## 493.2 Centar

Mali avatar + ime druge strane.

Primer:

[avatar] **Marko P.**
`Uskače · 2 osobe`

Ako gledate kao worker:

[avatar] **Ana M.**
`Traži pomoć`

Ne prikazivati internu reč REQUESTER/WORKER.

## 493.3 Tap na osobu

Otvara:
**Public profile sheet**

Uloga profila odgovara ovoj saradnji:
- Marko → worker profil;
- Ana → requester profil.

Ne šalje korisnika u novi full-screen navigation world.

## 493.4 Desno

Jedan `⋯` overflow.

U njemu samo sekundarne/rizične akcije koje pripadaju trenutnom state-u.

Primer aktivnog Dogovora:
- Izmenite uslove
- Prijavite problem
- Otkažite saradnju

Safety:
- Prijavite osobu
- Blokirajte osobu

Safety akcije mogu da budu u public-profile sheet-u umesto dupliranja u overflow-u, ali moraju biti lako dostupne.

Ne stavljati glavnu completion akciju u `⋯`.

---

# 494. DOGOVOR — DVA POGLEDA

Odmah ispod header-a:

**Pregled | Poruke**

To je jedini glavni switch.

## Pregled
Sve što korisnik treba da zna i uradi u vezi sa saradnjom.

## Poruke
Komunikacija u kontekstu ovog konkretnog Dogovora / taska.

Ne dodavati:
- Tok
- Dokazi
- Dokumenti
- Ostalo

Ako istorija ili dokaz treba da se vidi, stoji kao sekundarni blok u Pregledu.

---

# 495. PREGLED — TAČAN REDOSLED BLOKOVA

Finalni redosled:

1. **Šta sada treba da uradite / trenutno stanje**
2. **Zadatak**
3. **Dogovoreni uslovi**
4. **Mesto i dolazak**
5. **Zajednički kontekst**, samo ako postoji grupa
6. **Aktivnost saradnje**, kompaktno i po potrebi
7. **Sekundarne akcije**
8. sticky primary action samo kada trenutni state ima jednu jasnu glavnu radnju

Ako određeni blok nema sadržaj:
ne ostavljati prazan naslov/sekciju.

---

# 496. BLOK 1 — TRENUTNO STANJE / SLEDEĆA RADNJA

Ovo je najvažniji blok ekrana.

Ne treba da bude veliki status-badge koji samo kaže `CONFIRMED`.

Treba da odgovori:
**„Šta se sada dešava?“**

## 496.1 Normalno aktivan Dogovor

Miran green-soft blok:

**Dogovoreno**

`Sve je potvrđeno. Sledeće je dogovoreni termin.`

Ako exact termin postoji:
`Danas · 17:00–20:00`

Ako termin još nije exact:
`Termin još nije dogovoren.`

Primary action se ne prikazuje samo zato što ekran mora da ima dugme.

## 496.2 Druga strana je predložila izmenu

Orange-soft attention:

**Predlog izmene čeka Vaš odgovor**

`Marko predlaže novi termin.`

Summary:
`18:00–21:00 umesto 17:00–20:00`

Primary:
**Pregledajte predlog**

Tap:
otvara Change response surface.

## 496.3 Vi ste poslali predlog

Quiet orange-soft:

**Vaš predlog čeka odgovor**

`Predložili ste 18:00–21:00.`

Secondary:
`Povucite predlog`

Nema `Prihvatite` jer ste ga Vi poslali.

## 496.4 Worker je označio zadatak gotovim — requester

Orange attention:

**Završetak čeka Vašu potvrdu**

`Marko je označio da je posao završen.`

Deadline:
`Odgovorite do 30. oktobra u 18:20.`

Primary:
**Potvrdite završetak**

Secondary:
**Prijavite problem**

## 496.5 Worker čeka requester-a

Worker vidi:

**Čeka se potvrda druge strane**

`Zadatak ste označili kao gotov.`

`Ako ne bude prijavljen problem, Dogovor može biti automatski završen po isteku roka.`

Nema ponovno `Zadatak je gotov`.

## 496.6 Problem otvoren

Warn-neutral, ne crveni guilt state:

**Problem je prijavljen**

`Automatski završetak je zaustavljen dok se situacija ne razreši.`

Ako postoji opis koji sme da vidi druga strana:
prikazati ga.

Akcije:
- Poruke
- Podrška, kada je relevantna
- Potvrdite završetak, samo ako server dozvoljava requester-u posle rešenja
- Otkažite saradnju

## 496.7 Završen

Green/neutral:

**Saradnja je završena**

Ako rating čeka:
`Kako je prošla saradnja?`

Primary:
**Ocenite saradnju**

Ako je moja ocena poslata, a blind publication čeka:
`Ocena je sačuvana · čeka objavu`

Ako je sve završeno:
nema velikog CTA-a.

## 496.8 Otkazan

Neutral grey:

**Saradnja je otkazana**

Ako server zna:
- datum;
- ko je otkazao;
- razlog;

prikazati.

Ako ne zna:
ne izmišljati.

Screen je read-only osim:
- Poruke read-only;
- Support/Safety;
- public profile.

## 496.9 Unknown outcome

Miran recovery block:

**Proveravamo stanje**

`Ne znamo da li je poslednja radnja potvrđena.`

Primary:
**Proverite stanje**

Dok outcome nije razrešen:
ne nuditi novu različitu write akciju koja bi mogla da duplira intent.

---

# 497. BLOK 2 — ZADATAK

Compact context card / row.

Naslov:
**Zadatak**

Primer:

**Selidba stana**

`Liman · Danas 17:00–20:00`

Tap:
otvara parent Task kontekst.

Requester:
owner Task detail.

Worker:
public Task detail u read-only/relationship stanju.

Važno:
ovo je **link ka izvornom zadatku**, ali Dogovoreni uslovi ispod ostaju frozen accepted terms.

Ako je parent Task kasnije promenjen:
ne prepisuje Agreement facts.

---

# 498. BLOK 3 — DOGOVORENI USLOVI

Naslov:
**Dogovoreni uslovi**

Ne `Detalji`.

Korisnik mora jasno da vidi šta je prihvatio.

Predloženi prikaz:

**8.000 RSD ukupno**
glavni finansijski fact

Ispod 2×2 / stacked fact grid:

**Termin**
Danas · 17:00–20:00

**Ljudi**
2 osobe

**Mesto**
Liman

**Obim**
Pomoć pri iznošenju nameštaja

Ako je HOURLY:
`1.200 RSD / sat / osoba`
i, gde je poznato:
`2.400 RSD / sat za ovu prijavu`

Ako je OFFERS:
prikazuje se prihvaćena application cena.

## 498.1 Uslovi su menjani

Ako Agreement revision > original:
quiet line:

`Uslovi su izmenjeni 28. oktobra.`

Tap:
`Pogledajte prethodne uslove`

Optional small sheet/history.

Ne praviti ceo „Tok“ tab.

---

# 499. BLOK 4 — MESTO I DOLAZAK

Naslov:
**Mesto i dolazak**

## 499.1 Pre exact-location grant-a

Requester vidi:

`Liman`
`Tačna lokacija još nije podeljena.`

Primary/secondary row action:
**Podelite lokaciju**

Worker vidi:

`Liman`
`Tačna lokacija još nije podeljena.`

Action:
**Zatražite adresu**

## 499.2 Requester deli lokaciju

Tap `Podelite lokaciju`:

sheet:

**Podeliti tačnu lokaciju Marku?**

Prikazuje:
- kome;
- koja lokacija;
- da je dostupna samo kroz aktivni Dogovor.

Primary:
**Podelite**

Success:
section odmah menja stanje.

## 499.3 Worker posle grant-a

Prikazuje:

**Tačna lokacija je podeljena**

[ mini map / address ]

**Otvorite mapu**

Adresa je privatna bilateralna činjenica.

Ne pojavljuje se u group chatu automatski.

## 499.4 Opoziv

Requester:
`Opozovite deljenje`

Confirm sheet.

Po opozivu:
worker više ne može da reveal-uje privatnu lokaciju.

## 499.5 Zatražite adresu

Worker tap:
otvara private Poruke sa draftom:

`Možete li da podelite tačnu adresu?`

Draft se ne šalje automatski.

---

# 500. BLOK 5 — ZAJEDNIČKI KONTEKST

Prikazuje se samo ako parent Task ima group conversation / više nezavisnih saradnji.

Naslov:
**Zajedno na zadatku**

Primer:

`Još 1 aktivna saradnja na ovom zadatku`

[Marko] [Nikola]

Action:
**Otvorite razgovor sa svima**

Requester dodatno može:
**Pogledajte sve saradnje**

Worker ne vidi bilateralne uslove drugih worker-a.

Ne prikazivati njihove cene, probleme ili privatne predloge.

---

# 501. BLOK 6 — AKTIVNOST SARADNJE

Ne praviti veliki timeline po default-u.

Compact row:

**Aktivnost**

`Dogovoreno · 28. okt`
`Termin izmenjen · 28. okt`
`Lokacija podeljena · 28. okt`

Prikazati poslednja 2–3 relevantna događaja.

Action:
`Prikažite sve`

Otvara sheet sa hronologijom.

Ovaj sheet služi za:
- accepted term revisions;
- location grant/revoke;
- completion mark;
- problem opened;
- cancellation;
- completion.

Ne prikazuje:
- tehničke RPC kodove;
- hash;
- message spam;
- svaku notification delivery.

---

# 502. SEKUNDARNE AKCIJE

Na aktivnom normalnom Dogovoru:

- **Izmenite uslove**
- **Prijavite problem**
- **Otkažite saradnju**

Mogu stajati:
- u `⋯`;
- ili kao quiet rows pri dnu Pregleda.

Ne tri velika CTA dugmeta.

---

# 503. STICKY PRIMARY CTA — KADA POSTOJI

Dogovor nema stalni zeleni footer.

Sticky primary CTA postoji samo kada je jedna radnja očigledno sledeća i važna.

Primeri:

### Worker, active, posao je završen
`Zadatak je gotov`

### Requester, awaiting confirmation
`Potvrdite završetak`

### Completed, rating due
`Ocenite saradnju`

### Flexible no-term i korisnik može da predloži
`Predložite termin`

U normalnom `Dogovoreno` state-u:
**nema sticky CTA-a**.

To ostavlja ekran mirnim.

---

# 504. PORUKE TAB — BILATERALNI DOGOVOR

Tap `Poruke`.

Header osobe ostaje isti.

Tabs ostaju:
`Pregled | Poruke`

Ispod chat.

## 504.1 Task context strip

Compact:

**Selidba stana**
`Danas 17–20 · Liman`

Tap:
parent Task/Dogovor overview.

Ne ponavljati sve uslove iz Pregleda.

## 504.2 Private conversation

Message list.

Podržano:
- tekst;
- fotografije;
- voice gde je build stabilan.

Mine/right.
Other/left.

Date separators.

Server-saved mark.
Read receipt samo kada autoritativan.

## 504.3 Group switch

Ako postoji grupa:

u Poruke prikazu stoji:

**Svi učesnici | Privatno**

Ako gledamo bilateralni Dogovor i kliknemo `Svi učesnici`:
prelazimo u group thread istog taska.

Requester u `Privatno` može birati worker-a kada je u group contextu.

Worker `Privatno` vodi na requester-a.

## 504.4 Composer

Pill composer:

[＋] `Poruka...` [send]

`＋`:
- fotografija;
- voice samo ako je capability stabilan.

Group:
photo tek kada group-photo backend postoji.

## 504.5 Terminal

Completed/cancelled:
poruke ostaju vidljive.

Ako conversation više ne prima nove poruke:
composer nestaje.

Quiet:
`Razgovor je završen. Poruke možete samo da čitate.`

---

# 505. CHANGE FLOW — TAČNO ŠTA SE OTVARA

Tap:
`Izmenite uslove`

Full pushed flow ili large sheet, zavisno od količine contenta.

Title:
**Predložite izmenu**

Prikazuje current accepted facts.

Editable samo ono što user menja:

- Cena
- Termin
- Obim

Ne pitati sva tri obavezno.

## 505.1 Termin

Fixed:
date + start + end.

Flexible task:
ovde se prvi put može predložiti exact interval.

Conflict check pri accept-u.

## 505.2 Cena

Shows current + proposed.

HOURLY jasno po osobi.

## 505.3 Obim

Short structured/free-text scope.

## 505.4 Review

Pre send:

**Proverite predlog**

`Trenutno`
vs
`Predlog`

Primary:
**Pošaljite predlog**

## 505.5 Pending state

Posle slanja:
Dogovor overview block postaje:
`Vaš predlog čeka odgovor.`

---

# 506. INCOMING CHANGE RESPONSE

Tap `Pregledajte predlog`.

Sheet/full flow:

**Predlog izmene**

Prikazuje samo šta se menja i dovoljno current contexta.

Primer:

Termin

Trenutno:
17:00–20:00

Predlog:
18:00–21:00

Akcije:
**Prihvatite**
**Odbijte**

Ako conflict:
accept ne prolazi;
prikazuje:
`Termin se preklapa sa drugim Dogovorom.`

Action:
`Otvorite Raspored`

Ne menja stari accepted term.

---

# 507. CANCELLATION — EKRAN/SHEET

Title:
**Otkažite saradnju**

Body zavisi od uloge i coverage-a.

Requester:
`Otkazujete samo saradnju sa Markom. Ostali Dogovori na zadatku ostaju aktivni.`

Ako njegova prijava pokriva 2 mesta:
`Ponovo će biti slobodna 2 mesta.`

Reason:
obavezno.

Final confirm:
**Otkažite saradnju**

Unknown outcome:
freeze + readback.

Success:
Dogovor state → Otkazan.
Parent task coverage/search refresh.

---

# 508. COMPLETION — WORKER FLOW

Sticky:
**Zadatak je gotov**

Tap:
review sheet.

Title:
**Zadatak je gotov?**

Facts:
- task;
- requester;
- price;
- people;
- accepted term.

Copy:
`Druga strana će dobiti zahtev da potvrdi završetak ili prijavi problem.`

Primary:
**Da, zadatak je gotov**

Posle:
state → `Čeka se potvrda druge strane.`

---

# 509. COMPLETION — REQUESTER FLOW

State:
**Završetak čeka Vašu potvrdu**

Sticky:
**Potvrdite završetak**

Secondary in state card:
`Prijavite problem`

Tap confirm:
sheet:

**Potvrditi završetak?**

Facts:
- osoba;
- price;
- people;
- accepted term.

Primary:
**Da, potvrdite završetak**

Success:
state → Završen.
Rating CTA appears.

---

# 510. RATING IZ DOGOVORA

Completed + rating due:

state block:

**Saradnja je završena**

`Kako je prošla saradnja sa Markom?`

Primary:
**Ocenite saradnju**

Tap:
separate Rating flow.

Po povratku:
Dogovor pokazuje:
`Ocena je sačuvana`

Ako blind:
`Čeka objavu`

Ne ponavljati rating form inline unutar Agreement-a.

---

# 511. BILATERALNI DOGOVOR — EMPTY / LOADING / ERROR

## Loading

Header neutral.
Ne izmišljati status ili cenu.

## Read error bez prethodnog data

State:
`Dogovor trenutno nije učitan.`

Actions:
- `Pokušajte ponovo`
- `Nazad na Dogovore`

## Stale sa prethodnim data

Content ostaje.

Quiet:
`Prikazano je poslednje učitano.`

Retry.

## Access unavailable

Ako Agreement više nije dostupan korisniku:
ne prikazivati stare private facts iz cache-a posle authoritative denial.

State:
`Ovaj Dogovor više nije dostupan.`

Back:
Dogovori.

---

# 512. DOGOVOR — VIZUELNI STANDARD

Ovaj ekran treba da bude mirniji od Task detail-a.

Nema velikog marketing hero-a.

Koristi:
- belo / warm ground;
- person header;
- segmented `Pregled | Poruke`;
- jedan state card;
- grouped fact surfaces;
- 2D icons;
- orange samo za attention;
- green za positive/primary;
- red samo destructive.

2.5D ilustracije:
samo u empty/success states, ne u normalnom Dogovoru.

Najvažniji osećaj:
**„Ovo je moj konkretan dogovor sa ovom osobom i odmah znam šta sada važi.“**


# 513. REQUESTER TASK-GROUP WORKSPACE — CENTRALNI EKRAN VIŠE SARADNJI

Ovo je ekran između:
**Dogovori root**
i
**pojedinačnog bilateralnog Dogovora**.

Primer:

Dogovori
→ **Selidba stana · 2 saradnje**
→ Marko P.
→ bilateralni Dogovor

Mentalni model:
**jedan moj zadatak + više konkretnih saradnji koje ga zajedno pokrivaju.**

Requester treba da misli:
`Imam jednu selidbu i na njoj rade Marko i Nikola.`

Ne:
`Imam dva odvojena Agreement ID-ja.`

Ovaj ekran je requester-only organizational workspace.

Worker nema ekvivalent koji mu pokazuje druge worker-e kao saradnike sa njihovim bilateralnim uslovima.

---

# 514. TASK-GROUP — HEADER

## 514.1 Levo

Back.

Vraća na:
**Dogovori**

ili pravi source ako je došlo iz push/notification konteksta.

## 514.2 Centar

Naslov taska:

**Selidba stana**

Subline:
`Danas · 17:00–20:00`
ili
`Termin još nije dogovoren`

Ne koristiti title:
`Grupa`
ili
`Dogovor #...`

## 514.3 Desno

Moguće dve male radnje:

- group chat icon, kada grupa postoji;
- `⋯` za task-level secondary actions.

`⋯` može imati samo ono što pripada parent task-u, ne pojedinačnom worker-u.

Primer:
- Otvorite zadatak
- Zatvorite preostalu potragu, kada je dozvoljeno
- Ponovo otvorite potragu, kada je dozvoljeno

Ne:
- otkaži Marka;
- prijavi problem sa Nikolom;
- izmeni Markovu cenu.

To se radi u bilateralnom Dogovoru.

---

# 515. TASK-GROUP — PRVI BLOK: COVERAGE / STANJE ZADATKA

Na vrhu se vidi stanje celog zadatka, ne stanje jednog worker-a.

Primer:

**3/3 dogovoreno**

Progress vizuelno:
`● ● ●`

Ispod:
`2 saradnje pokrivaju 3 osobe.`

Marko:
2 osobe

Nikola:
1 osoba

## 515.1 Delimično popunjen

Primer:

**2/3 dogovoreno**

`Nedostaje još 1 osoba.`

Ako potraga radi:
Primary:
**Pogledajte prijave**

ili:
**Pronađite još nekoga**
prema tome da li postoje kandidati.

Ako nema novih prijava:
status:
`Potraga je otvorena.`

Ne crtati `2/3` kao tehnički status bez sledeće korisne radnje.

## 515.2 Potpuno popunjen

**3/3 dogovoreno**

Nema primary action za izbor.

Može quiet:
`Sva potrebna mesta su pokrivena.`

## 515.3 Potraga zatvorena pre potpune popunjenosti

Primer:

**2/3 dogovoreno**

`Preostala potraga je zatvorena.`

Ako owner može ponovo:
**Ponovo otvorite potragu**

Važno:
coverage i search state su odvojene istine.

## 515.4 Završene saradnje

Coverage se ne računa iz CANCELLED.

Parent completion koristi samo COMPLETED bilateralne saradnje koje pokrivaju required slots.

Na active task-group ekranu:
- active;
- awaiting completion;
- completed;
- cancelled

svaki worker ima svoj bilateralni status.

---

# 516. TASK-GROUP — DRUGI BLOK: ČEKA VAS

Ako bilo koja saradnja traži owner akciju:

sekcija:
**Čeka Vas**

Primer:

**Marko**
`Završetak čeka Vašu potvrdu` →

**Nikola**
`Predlog termina čeka Vaš odgovor` →

Tap:
direktno otvara baš taj bilateralni Dogovor u odgovarajućem state-u.

Max:
3 rows.

Ako više:
`I još N saradnji traži Vašu pažnju`

Ne duplirati iste akcije i u svakom worker card-u i u ovoj sekciji agresivno.

Worker card može imati mali attention marker.

---

# 517. TASK-GROUP — TREĆI BLOK: SARADNJE

Naslov:
**Saradnje**

To je srce ekrana.

Svaka saradnja je kompaktna, ali dovoljno informativna.

Primer:

[Marko avatar]
**Marko P.**
★ 4,9 · 23 ocene
2 osobe
8.000 RSD ukupno
`Dogovoreno`
→

[Nikola avatar]
**Nikola S.**
★ 5,0 · 8 ocena
1 osoba
4.000 RSD ukupno
`Dogovoreno`
→

Tap celog row/card-a:
otvara bilateralni Dogovor.

## 517.1 Šta se vidi

- avatar;
- ime;
- role-trust summary;
- broj ljudi koje njegova prijava pokriva;
- njegova prihvaćena bilateralna cena;
- njegov bilateralni status;
- attention marker samo ako on čeka owner akciju.

## 517.2 Šta se NE vidi

Ne prikazivati:
- tools/vehicles;
- ceo application note;
- private message preview;
- njegov private problem tekst drugom worker-u;
- internal IDs;
- worker application rank.

## 517.3 Ako jedna saradnja pokriva više ljudi

Jasno:
`2 osobe`

Ne prikazivati dva lažna profila za jednog worker naloga.

---

# 518. STATUS PO SARADNJI

Mali human status chip/line.

Moguće:

- Dogovoreno
- Predlog čeka
- Čeka potvrdu završetka
- Problem
- Završeno
- Otkazano

Ako owner mora da reaguje:
orange attention dot.

Ako je worker samo waiting:
quiet orange/neutral.

Ne koristiti mnogo različitih boja.

---

# 519. GROUP CHAT — CENTRALNI ULAZ

Ako task ima najmanje dva različita aktivna worker naloga:

pojavi se:

**Zajednički razgovor**

[Marko] [Nikola] [+ Ana requester]

`3 učesnika`

Last message preview:
`Marko: Stižemo oko 16:55.`

Time:
`16:42`

Action:
**Otvorite razgovor**

Whole block tap.

## 519.1 Zašto je ovo task-group nivo

Group conversation pripada celom tasku.

Ne treba da deluje kao Markov private chat.

## 519.2 Kada nema grupe

Ako postoji samo jedan worker nalog:
blok ne postoji.

Ako Marko dovodi još jednu osobu ali samo Marko ima account:
i dalje nema group chat.

---

# 520. GROUP CHAT — ŠTA REQUESTER MOŽE

U group thread-u:

**Svi učesnici | Privatno**

### Svi učesnici

Requester šalje poruku svima.

### Privatno

Requester dobija picker:
- Marko
- Nikola

Tap:
otvara bilateralni private channel.

Ne kreira requester-worker DM izvan taska.

## 520.1 People sheet

Group header:
people icon.

Sheet:
**Učesnici**

Ana M. · Naručilac

Marko P. · 2 osobe

Nikola S. · 1 osoba

Requester može:
tap worker-a → njegov bilateralni Dogovor.

Ne prikazivati:
- cenu;
- private status;
- problem details.

---

# 521. TASK-GROUP — TERMIN

Parent task može imati zajednički okvir, ali bilateralni Agreement-i mogu kasnije imati različite exact termine.

Zato task-group ne sme da laže.

## 521.1 Svi isti exact termin

Prikaz:

**Termin**
Danas · 17:00–20:00
`2 saradnje`

Jedan shared fact.

## 521.2 Različiti termini

Prikaz:

**Termini saradnji**

Marko
17:00–20:00

Nikola
18:00–21:00

Ne prikazivati jednu lažnu zajedničku satnicu.

## 521.3 Neko bez exact termina

Primer:

Marko
17:00–20:00

Nikola
Termin još nije dogovoren

Attention/action:
`Dogovorite termin sa Nikolom`

Tap:
Nikolin bilateralni Agreement change flow.

---

# 522. TASK-GROUP — MESTO / ADRESA

Parent task ima public/coarse place.

Requester može imati jednu exact task address činjenicu.

Ali access se deli bilateralno.

## 522.1 Summary

**Mesto**
Liman

`Tačna lokacija podeljena sa 1 od 2 saradnje.`

Action:
**Upravljajte deljenjem**

Tap otvara sheet:

Marko
✓ Podeljeno
[Opozovite]

Nikola
Nije podeljeno
[Podelite]

## 522.2 Future batch

Ako backend batch capability postoji:

**Podelite aktivnim učesnicima**

Pre potvrde:
prikazuje listu ljudi.

Server i dalje pravi bilateralne grants.

## 522.3 Bez batch capability-a

Sheet i dalje može centralno da prikazuje stanje,
ali izvršava pojedinačne grant/revoke radnje sa recovery modelom.

Ne raditi slepu client petlju bez journal/recovery-ja.

---

# 523. TASK-GROUP — ZAJEDNIČKE FOTOGRAFIJE / TASK MEDIA

Task-group može prikazati parent task photos u compact preview-u samo ako to pomaže koordinaciji.

Primer:
`Fotografije zadatka · 3`

Tap:
task photo viewer.

Ne dozvoljavati worker-u da kroz ovaj blok menja requester task photos.

Group chat photos su zasebne message media kada budu implementirane.

---

# 524. TASK-GROUP — RASPORED SHORTCUT

Ako postoje exact termini:

compact row:

**Raspored**

`Danas · 17:00–21:00`

`2 saradnje`

Tap:
otvara Raspored fokusiran na taj task/day.

Ako saradnje imaju različite termine:
row kaže:
`2 termina danas`

Ne pokušavati da bude mini calendar.

---

# 525. TASK-GROUP — PREOSTALA POTRAGA

Ako task nije potpuno popunjen:

sekcija:
**Još je potrebno**

`1 osoba`

Ako postoje nove prijave:
`3 prijave čekaju pregled`

Primary:
**Pogledajte prijave**

Ako nema:
`Potraga je otvorena`

Secondary:
**Podelite zadatak** može biti buduća growth funkcija, ali nije MVP obavezna.

Ne dodavati „pozovite prijatelja“ samo radi engagement-a.

---

# 526. TASK-GROUP — SEARCH CLOSED / REOPEN

Ako owner ručno zatvori potragu pre punog coverage-a:

state:
**Potraga je zatvorena**

`Dogovorene saradnje ostaju aktivne.`

Action:
**Ponovo otvorite potragu**

ako lifecycle server dozvoljava.

Ovo ne menja postojeće Dogovore.

---

# 527. TASK-GROUP — KADA SE SARADNJA OTKAŽE

Ako Marko otkaže ili owner otkaže Marka:

Marko više nije u aktivnim saradnjama.

Active section:
Nikola

History/earlier collaborations subsection može pokazati:
**Ranije na ovom zadatku**

Marko P.
`Otkazano`

Ali ne mora da zauzima primarni prostor.

Coverage:
ponovo se računa.

Ako je Marko pokrivao 2 mesta:
`1/3 dogovoreno`
i potraga se može ponovo otvoriti / ostati otvorena prema server state-u.

Group membership:
Marko ne vidi buduće group poruke.

---

# 528. TASK-GROUP — COMPLETION SA VIŠE WORKER-A

Ne postoji jedno:
**Završi ceo task**

dok bilateralni Dogovori nisu svi stvarno završeni prema pravilima.

Primer:

Marko
`Završeno`

Nikola
`Čeka potvrdu`

Parent:
**2/3 saradnje završene po coverage-u**
ili ljudskije:
`Markov deo je završen. Nikola još čeka potvrdu.`

Kada COMPLETED coverage dostigne required slots:
parent task može preći u completed.

Requester ne potvrđuje sva tri worker-a jednim klikom.

---

# 529. TASK-GROUP — RATINGS

Ocena je bilateralna.

Task-group može da pokaže:

**Ocene**

Marko
`Ocenite saradnju` →

Nikola
`Ocena je sačuvana` ✓

Ne postoji jedna zajednička ocena „Selidbe“.

Tap:
pojedinačni Rating flow.

Ako blind period traje:
`Sačuvana · čeka objavu`.

---

# 530. TASK-GROUP — PROBLEMI

Ako problem postoji samo sa Markom:

task-group summary:

Marko
🟠 `Problem prijavljen`

Nikola
`Dogovoreno`

Ne praviti parent task crvenim kao da je ceo task „problematičan“.

Tap Marko:
bilateralni Problem state.

Ako problem utiče na parent coverage/search:
server parent state to odražava, ali blame ostaje bilateralno.

---

# 531. TASK-GROUP — PRETHODNE SARADNJE NA ISTOM TASKU

Ako je worker zamenjen:

Active:
Nikola

Ranije:
Marko · Otkazano

To je korisno za:
- razumevanje šta se desilo;
- support;
- audit;
- replacement context.

Ali raniji worker ne ostaje u avatar stack-u kao aktivan član.

Group:
istorija visibility ostaje po admission intervalima.

---

# 532. TASK-GROUP — OVERFLOW / SECONDARY TASK ACTIONS

Task-level `⋯` može:

- Otvorite zadatak
- Izmenite javni zadatak, ako lifecycle dozvoljava
- Zatvorite potragu
- Ponovo otvorite potragu
- Otkažite preostalu potrebu/task, samo ako server pravilo to podržava bez rušenja aktivnih Dogovora
- Support/Safety contextual entry

Ali:
**nikada ne otkazuje bilateralne Dogovore implicitno** bez eksplicitnog zasebnog flow-a.

Ako owner zatvori potragu:
active Agreements ostaju.

Ako owner želi da prekine saradnje:
svaka bilateralno.

---

# 533. TASK-GROUP — LOADING / ERROR / STALE

## Loading

Header task title samo ako već poznat iz navigation contexta.

Ne izmišljati worker rows.

## Partial

Ako jedan child Agreement read padne:
ostali ostaju.

Row:
`Ova saradnja trenutno nije osvežena.`

## Stale

Last snapshot remains.

Quiet:
`Prikazano je poslednje učitano.`

## Parent unavailable

Ako parent task više nije dostupan:
ali authorized Agreement-i jesu:
ne skrivati bilateralne Dogovore.

Task-group može pasti na:
`Zadatak više nije dostupan, ali Vaše saradnje ostaju dostupne.`

Individual Agreement links ostaju.

---

# 534. TASK-GROUP — VIZUELNI STANDARD

Ovaj ekran nije dashboard sa mnogo KPI kartica.

Redosled vizuelne težine:

1. task title;
2. coverage;
3. attention;
4. collaborations;
5. group chat;
6. schedule/location utilities;
7. previous collaborations.

Koristi:
- white/warm ground;
- green coverage;
- orange attention;
- avatar stack;
- simple worker rows;
- minimal shadows;
- 2D icons.

Nema 2.5D ilustracije u normalnom populated state-u.

2.5D samo empty state:
`Još nema aktivnih saradnji na ovom zadatku.`

---

# 535. TASK-GROUP — KONKRETAN PRIMER EKRANA

HEADER

←  **Selidba stana**                         [💬] [⋯]
   Danas · 17:00–20:00

------------------------------------------------

**3/3 dogovoreno**
● ● ●
2 saradnje pokrivaju 3 osobe.

------------------------------------------------

**Čeka Vas**

🟠 Nikola S.
Predlog termina čeka Vaš odgovor               →

------------------------------------------------

**Saradnje**

[Marko]
**Marko P.**                         `Dogovoreno`
★ 4,9 · 23 ocene
2 osobe · 8.000 RSD                             →

[Nikola]
**Nikola S.**                    🟠 `Predlog čeka`
★ 5,0 · 8 ocena
1 osoba · 4.000 RSD                             →

------------------------------------------------

**Zajednički razgovor**

[Marko] [Nikola] [Vi]
3 učesnika

Marko: Stižemo oko 16:55.
16:42

**Otvorite razgovor**                            →

------------------------------------------------

**Mesto i dolazak**

Liman

Tačna lokacija podeljena sa 1 od 2 saradnje.

**Upravljajte deljenjem**                        →

------------------------------------------------

**Raspored**

Danas · 17:00–21:00
2 termina

**Otvorite Raspored**                            →

------------------------------------------------

**Prethodne saradnje na ovom zadatku**
— prikazuje se samo ako postoje.

Bottom bar nije prikazan ako je task-group pushed screen.
Back vraća na Dogovori root.


# 536. PORUKE ROOT — FINALNI EKRAN

Ovo je ekran koji se dobija pritiskom na donji tab:

**Poruke**

Mentalni model:
**inbox razgovora vezanih za konkretne zadatke i Dogovore.**

Ne:
- globalni DM imenik ljudi;
- WhatsApp klon;
- lista notification eventova;
- još jedna verzija Dogovora.

Jedan red = **jedan razgovor u jednom konkretnom task kontekstu**.

---

# 537. PORUKE — ROOT HEADER

## 537.1 Levo / centar

Title:
**Poruke**

Root screen nema Back.

## 537.2 Desno

Avatar/profile kao na drugim root ekranima.

Search icon može da se uvede tek kada realna količina razgovora opravda search.

Ne dodavati:
- compose new message;
- plus za novi DM.

Korisnik ne može da započne proizvoljan razgovor sa bilo kim.

Razgovor nastaje iz Dogovora / task relationship-a.

## 537.3 Bottom navigation

Ostaje:

Početna · Zadaci · Dogovori · **Poruke**

Selected Poruke koristi isti green capsule sistem.

---

# 538. PORUKE — NEMA STALNOG `AKTIVNI | ISTORIJA`

Finalni root inbox **nema veliki segmented switch `Aktivni | Istorija`**.

Razlog:
korisnik dolazi da vidi:
- ko mu je pisao;
- o kom zadatku;
- šta je poslednje rečeno;
- gde treba da nastavi razgovor.

Server već vraća conversation rows po recency order-u.

Završeni/read-only razgovor se samo diskretno označi:
`Završeno · samo za čitanje`

Ako količina stare istorije postane velika:
sekundarni ulaz:
**Prethodni razgovori**
može postojati na dnu ili u filteru.

Ne treba da bude prvi mentalni izbor.

---

# 539. RED RAZGOVORA — TASK JE PRVI ORIJENTIR

Red ne počinje imenom čoveka kao u običnom messengeru.

Počinje **task naslovom**.

Primer:

[Marko avatar]  
**Selidba stana**                         16:42  
`Marko: Stižemo oko 16:55.`  
`Privatno · Marko P.`

Drugi red istog taska:

[group icon / avatar stack]  
**Selidba stana**                         16:37  
`Gde se parkiramo?`  
`Grupa · 3 učesnika`   **2**

Treći task:

[Nikola avatar]  
**Montaža TV-a**                          Juče  
`Vi: Važi, vidimo se.`  
`Privatno · Nikola S.`

Zašto task prvi:
ista osoba može biti u više različitih Dogovora.
Jedan globalni `Marko` razgovor bi izgubio kontekst posla.

---

# 540. RED — TAČNA ANATOMIJA

## 540.1 Leading

### Privatno
avatar druge strane.

Ako nema photo:
inicijali.

### Grupa
group icon ili mali avatar-stack kada backend/model to bezbedno podrži.

Ne koristiti random 2.5D illustration u svakom conversation row-u.

## 540.2 Prva linija

**Task title**

Desno:
time stamp.

Danas:
`16:42`

Juče:
`Juče`

Starije:
`26. okt`

Ne i datum i sat zajedno u dense inbox-u.

## 540.3 Druga linija

Last message preview.

Text:
`Stižemo oko 16:55.`

Moja poruka:
`Vi: Važi, vidimo se.`

Photo:
`Fotografija`
ili
`Fotografija · Ovo je ulaz`

Voice:
`Glasovna poruka`

Ne izmišljati duration ako inbox projection nema duration.

## 540.4 Treća linija

Context:

`Privatno · Marko P.`

ili:

`Grupa · 3 učesnika`

Ako member count nije authoritative:
samo:
`Grupa`

Ako conversation terminal:
`Završeno · Privatno · Marko P.`

## 540.5 Whole row tap

Privatni row:
→ bilateralni Dogovor, tab `Poruke`

Group row:
→ group conversation.

Nema chevron-a ako ceo row već izgleda očigledno tappable.

---

# 541. UNREAD — ŠTA SME DA SE PRIKAŽE

## 541.1 Group

Current group context ima authoritative unread count.

Ako >0:
small dark/green count pill:
`2`

Može se prikazati.

## 541.2 Private

Current `MY_CONVERSATIONS_PAGE_V1` namerno vraća:

`unreadMessageCount = null`

za private conversation.

Zato finalni inbox:
**ne prikazuje numeric private unread badge.**

Ne izmišljati:
- `1`;
- bold row kao dokaz unread;
- dve kvačice;
- root total unread number.

Ako kasnije server uvede authoritative private unread:
UI može da ga prihvati bez promene mentalnog modela.

## 541.3 Bottom-tab badge

Dok nema authoritative unread za sve conversation vrste:
**nema numeric Poruke badge-a.**

Može postojati samo platform-approved generic attention dot kada imamo bezbedan autoritativan signal za `nešto novo`, ali ne ako to opet znači nagađanje.

---

# 542. PRIVATE + GROUP OSTAJU ODVOJENI REDOVI

Ako isti task ima:

- group conversation;
- private Marko;
- private Nikola;

to su tri različita conversation konteksta.

Ne spajati ih u jedan row:

`Selidba stana · 3 razgovora`

jer bi korisnik morao još jednom da bira pre nego što pročita novu poruku.

Inbox recency treba da vodi direktno u konkretan conversation.

Task title se zato može ponoviti više puta.

Context line jasno razlikuje:
- Grupa
- Privatno · Marko
- Privatno · Nikola

---

# 543. ORDERING

Server order ostaje authoritative:
**najnovija poslednja poruka prva.**

Ne sortirati ponovo na klijentu po:
- osobi;
- task title-u;
- group/private tipu.

Ne grupisati po tasku ako bi to razbilo recency.

Ako tri conversation-a sa istog taska prirodno stoje blizu jer su sveže:
to je u redu.

---

# 544. PORUKE — EMPTY STATE

Ako nema nijednog conversation-a:

2.5D chat illustration.

**Još nema razgovora**

`Razgovor započinjete iz Dogovora.`

Primary:
**Otvorite Dogovore**

Ne:
`Nova poruka`

jer ne postoji proizvoljan novi DM.

Ako conversation inbox capability u buildu nije dostupan:
state može reći:

**Razgovori su u Dogovorima**

`Otvorite Dogovor da nastavite dopisivanje.`

To je capability fallback, ne normalno empty stanje.

---

# 545. LOADING / ERROR / STALE

## 545.1 First loading

Jedan miran loading row/card.

`Učitavamo razgovore…`

Ne 6 skeleton message bubbles.

## 545.2 Full error bez data

**Razgovori nisu učitani**

`Proverite vezu pa pokušajte ponovo.`

Primary:
`Pokušajte ponovo`

## 545.3 Refresh error sa postojećim rows

Rows ostaju.

Quiet note:
**Razgovori nisu osveženi.**

`Poslednji učitani razgovori ostaju prikazani.`

Action:
`Osvežite razgovore`

## 545.4 Pagination error

Stari rows ostaju.

Na dnu:
`Stariji razgovori nisu učitani.`

`Pokušajte ponovo`

---

# 546. OTVARANJE RAZGOVORA — AUTHORITY / RECOVERY

Tap row ne veruje samo route ID-u.

Destination ponovo autorizuje:
- Agreement;
- group membership/history.

Ako row više nije dostupan:

u inbox-u:
`Razgovor trenutno nije dostupan.`

Ne crash / blank screen.

Ako open read padne:
`Razgovor nije otvoren. Pokušajte ponovo.`

Cold push/deep link takođe mora ponovo autorizovati conversation.

---

# 547. PRIVATE CHAT — OTVARANJE IZ ROOT PORUKE

Primer row:

**Selidba stana**
`Marko: Stižemo oko 16:55.`
`Privatno · Marko P.`

Tap.

Otvara:
**bilateralni Dogovor → Poruke tab**

Header:

← [Marko] Marko P.  
   `Uskače · 2 osobe`

Tabs:
`Pregled | Poruke`

Task strip:
**Selidba stana**
`Danas 17–20 · Liman`

Ispod thread.

Zašto ne poseban global chat route:
poruka pripada konkretnom accepted Agreement kontekstu.

---

# 548. GROUP CHAT — OTVARANJE IZ ROOT PORUKE

Primer:

**Selidba stana**
`Gde se parkiramo?`
`Grupa · 3 učesnika`

Tap:

Header:
← **Grupni razgovor**
`Selidba stana · 3 učesnika`

People icon desno.

Ispod channel switch:

**Svi učesnici | Privatno**

Default:
Svi učesnici.

Task anchor:
`Selidba stana` →

Thread.

---

# 549. GROUP THREAD — PORUKE

Message anatomy:

## Tuđa poruka

[avatar] **Marko**  
bubble/message  
time / sent fact only when needed

Sender name ne ponavljati uz svaku uzastopnu poruku istog sender-a.

## Moja poruka

right aligned.

Ne stavljati moje ime.

## Date separators

`Danas`
`Juče`
`26. okt`

## Delivery/read

Group nema jedno `pročitano` jer postoji više čitalaca.

Moja group message može imati:
`Poslato`

Ne:
`Pročitano` kao jedna globalna činjenica.

---

# 550. GROUP PEOPLE SHEET

Tap people icon:

Sheet:
**Učesnici razgovora**

Requester:
Ana M. · Naručilac

Marko P. · Uskače · 2 osobe

Nikola S. · Uskače · 1 osoba

Tap worker-a:
→ njegov bilateralni Dogovor.

Requester može dobiti:
`Još pojedinačnih Dogovora`
ako management page ima više.

Ne prikazivati bilateralne:
- cene;
- private problems;
- private change proposals.

---

# 551. PRIVATNO IZ GROUP CHAT-A

Tap:
**Privatno**

## Requester

Ako više worker-a:
sheet/picker:

**Izaberite razgovor**

Marko P.  
Nikola S.

Tap:
private bilateralni conversation.

Ako samo jedan:
direktno.

## Worker

Direktno:
private conversation sa requesterom.

Ne prikazivati ostale worker-e kao private DM targets.

---

# 552. COMPOSER — PRIVATE

Bottom composer:

[ + ]  `Napišite poruku…`  [send]

## Plus

- Fotografija
- Kamera, ako je deo istog photo attach sistema
- Glasovna poruka, samo gde build/runtime stabilno podržava

Permissions on demand.

## Sending

Message row local pending.

Ako server potvrdi:
normal sent state.

## Unknown outcome

Isti draft/message identity ostaje.

UI:
`Ne znamo da li je poruka poslata.`

Action:
`Proverite stanje`

Ako retry zahteva isti payload:
text ne sme da se promeni.

Ne šalje se nova kopija.

---

# 553. COMPOSER — GROUP

Current backend:
**text-only**

Zato finalni MVP group composer trenutno:

[ `Poruka grupi…` ] [send]

Bez fake photo button-a.

Target P1:
group photos.

Kad backend dobije media support:
plus button se dodaje istim patternom kao private.

Group voice:
DEFER.

---

# 554. TERMINAL / READ-ONLY RAZGOVORI

Kada bilateralni Agreement ili group context više ne prima nove poruke:

thread ostaje.

Composer odlazi.

Quiet footer:

**Razgovor je završen. Poruke možete samo da čitate.**

Root inbox row može imati:

`Završeno · Privatno · Marko P.`

ili:

`Završeno · Grupa`

Ali terminal conversation ne nestaje odmah samo zato što nije aktivan.

Recent relevant history može ostati u recency inbox-u.

Starije history rows se paginacijom prirodno pomeraju dole.

---

# 555. PORUKE ROOT — DA LI TREBA SEARCH

MVP:
**ne mora.**

Server page je recency list.

Search se dodaje tek kada:
- korisnici realno imaju mnogo conversation-a;
- postoji server/query support.

Ako se uvede:
search po:
- task title;
- counterpart display name.

Ne lokalno filtriranje samo učitane prve stranice, jer bi delovalo kao kompletna pretraga a nije.

---

# 556. PORUKE ROOT — DA LI TREBA FILTER

MVP default:
bez stalnih filter chipova.

Ako kasnije postane potrebno:
filter sheet može imati:

- Sve
- Grupni
- Privatni
- Završeni

Ali ne pre nego što lifecycle group conversation-a ima authoritative status.

Current V1 ne zna pouzdano closure za svaku group row.

Zato:
ne crtati control koji obećava savršenu podelu dok data model to ne zna.

---

# 557. PORUKE ROOT — VIZUELNI STANDARD

Treba da deluje lakše od Dogovori screen-a.

White surface.

Rows:
- bez teških kartica ako separator sistem izgleda bolje;
- avatar 44–48;
- task title bold;
- message preview muted;
- context third line;
- time aligned right;
- unread pill samo group authoritative.

Sadašnji `ConversationInboxPresentation` ima card border oko svakog row-a.

Final visual pass treba probati:
**flatter grouped list sa separatorima**
kao primarni smer.

Razlog:
chat inbox sa mnogo cardova brzo postaje `card soup`.

Zadržati rounded cards samo ako realni screenshot/design-lab comparison pokaže da bez njih gubi USKOČI identitet.

---

# 558. PORUKE ROOT — KONKRETAN PRIMER

PORUKE                                      [avatar]

Razgovori o Vašim zadacima

[Marko]
**Selidba stana**                          16:42
Marko: Stižemo oko 16:55.
Privatno · Marko P.

[group]
**Selidba stana**                          16:37
Gde se parkiramo?
Grupa · 3 učesnika                         [2]

[Nikola]
**Montaža TV-a**                           Juče
Vi: Važi, vidimo se.
Privatno · Nikola S.

[Petar]
**Dostava paketa**                         26. okt
Fotografija · Ovo je paket.
Završeno · Privatno · Petar M.

Bottom:
Početna · Zadaci · Dogovori · **Poruke**

Nema:
- `Aktivni | Istorija`;
- `Nova poruka`;
- contact directory;
- fake private unread counts.


# 559. RASPORED — FINALNI EKRAN OD VRHA DO DNA

Raspored nije još jedna lista Dogovora.

Mentalni model:
**vremenski pogled na potvrđene saradnje i moje worker raspoloživo vreme.**

Prikazuje:
- potvrđene Dogovore sa exact intervalom;
- moje worker availability prozore kao mekani sloj;
- Dogovore bez tačnog termina kao poseban ulaz;
- remote rokove odvojeno od busy intervala.

Ne prikazuje kao busy:
- moje objavljene taskove bez Dogovora;
- moje prijave;
- remote deadline kao da je radni termin;
- draftove.

---

# 560. RASPORED — HEADER

Levo:
Back.

Cold fallback:
**Dogovori**

Centar:
**Raspored**

Desno:
po potrebi:
- `Danas`
- ili jedna utility akcija, ali ne oba ako ekran postane pretrpan.

Ne prikazivati:
`Arhiva`

kao root-level shortcut.

Prethodne saradnje ostaju u Dogovori → Prethodne saradnje.

---

# 561. GLAVNI SWITCH

Odmah ispod headera:

**Mesec | Nedelja | Dan**

To su tri pogleda istog Rasporeda.

Ne:
- Agenda
- Lista
- Timeline
- Arhiva
- peti pogled.

Default:
**Mesec**

Korisnik može swipe-om:
- Mesec → prethodni/sledeći mesec;
- Nedelja → prethodna/sledeća nedelja;
- Dan → prethodni/sledeći dan.

Switch view ne gubi selected date.

---

# 562. DOGOVORI BEZ TAČNOG TERMINA

Ako postoje aktivni Dogovori bez exact intervala:

odmah ispod Mesec/Nedelja/Dan:

**2 Dogovora bez tačnog termina** →

To nije error.

Tap:

ako je jedan i može se odmah predložiti termin:
→ direktno `Predložite termin`

ako ih je više:
→ sheet/list:

**Bez tačnog termina**

Selidba stana  
Marko P.  
`Dogovoreno`  
**Predložite termin** →

Prevod prezentacije  
Ana M.  
`Ove nedelje`  
**Otvorite Dogovor** →

Ne stavljati ove Dogovore na izmišljeni datum u kalendaru.

---

# 563. MESEC — FINALNI POGLED

Redosled:

1. Mesec/Nedelja/Dan switch
2. loose-term bar ako postoji
3. period header:
   `<  Oktobar 2026  >`
4. weekday labels
5. month grid
6. selected-day detail lista
7. optional `Moja dostupnost`

## 563.1 Dan u gridu

Prikazuje:
- broj dana;
- today ring;
- selected day green circle;
- do 2 mala event dots;
- soft availability tint samo kada worker profile ACTIVE i availability read postoji.

Ne:
- task title unutar ćelije;
- cenu;
- broj ljudi;
- tri status badga.

## 563.2 Event dots

Dots su samo signal:
`ovog dana ima nešto`.

Ne koriste deset boja.

Predlog:
- green/forest za moje worker commitments;
- orange/secondary accent za requester-side task events samo ako razlika stvarno pomaže.

Ako dva ili više:
najviše 2 dots + overflow implicitno kroz selected-day listu.

## 563.3 Selected day

Tap dana:
ne otvara novi ekran.

Ispod grid-a osvežava se lista:

**Danas, 28. oktobar**

17:00–20:00  
**Selidba stana**  
Liman · 2 saradnje →

20:30–21:30  
**Montaža TV-a**  
Ana M. · Grbavica →

Ako nema:
`Nema Dogovora ovog dana.`

Ali samo ako svi relevantni reads za taj dan jesu završeni.

---

# 564. REQUESTER GROUPING U MESECU

Requester sa:
- Markom 17–20;
- Nikolom 17–20;
- isti parent task `Selidba stana`;

ne vidi dva identična reda.

Finalni presentation agregat:

**Selidba stana**
17:00–20:00
`2 saradnje`

Tap:
task-group workspace.

Ako:
- Marko 17–20;
- Nikola 18–21;

ne grupišemo.

Prikazuju se dva termina jer korisniku stvarno nisu isti.

Ovo je presentation aggregation.
Database bilateralni Agreement-i ostaju odvojeni.

---

# 565. NEDELJA — FINALNI POGLED

Top:
week strip:
Pon 26 · Uto 27 · **Sre 28** · Čet 29...

Svaki dan može imati:
- dots;
- selected state;
- today state.

Ispod:
sedam dana kao pregled narednog/izabranog perioda.

Primer:

**SREDA 28. OKT**

17:00–20:00  
Selidba stana  
Liman · 2 saradnje →

20:30–21:30  
Montaža TV-a  
Ana M. →

**ČETVRTAK 29. OKT**

Slobodno

**PETAK 30. OKT**

10:00–12:00  
Dostava paketa →

`Slobodno` se kaže samo kada read authority potvrđuje da nema termina.

Ako read nije kompletan:
ne reći `Slobodno`.

---

# 566. DAN — FINALNI POGLED

Ovo je pravi timeline.

Levo:
satnice.

Desno:
Dogovor blocks.

Default visible range:
otprilike **07:00–22:00**

Ali ako Dogovor počinje ranije/kasnije:
range se proširi.

## 566.1 Dogovor block

Primer:

**Selidba stana**
17:00–20:00
`2 saradnje`

ili worker:

**Montaža TV-a**
Ana M.
20:30–21:30

Block:
- title;
- one secondary fact;
- state cue samo ako je relevantan.

Ne gurati:
- punu cenu;
- sve učesnike;
- ceo status;
- adresu.

Tap:
- requester grouped event → task-group workspace;
- bilateral worker event → konkretni Dogovor.

## 566.2 Now line

Danas:
crvena/tanka `sada` linija.

Ne animirati kontinuirano.
Pozicija se osvežava na minut.

## 566.3 Overlap

Ako se requester events preklapaju:
to nije automatski konflikt.

Prikaz:
side-by-side columns.

Ako ih ima previše:
`Još termina`

Ne prikazivati crveni conflict badge samo zato što se preklapaju.

---

# 567. AVAILABILITY — MEKANI SLOJ

Availability je:
**kada worker želi/može da radi.**

Dogovor je:
**potvrđena obaveza.**

Vizuelno zato:

Availability:
- soft pale band/tint;
- label `Mogu da radim`

Dogovor:
- pun card/block;
- mnogo jača vizuelna težina.

Ne sme da izgleda kao dva ista eventa.

## 567.1 Mesec

Dan može dobiti soft tint ako availability postoji.

## 567.2 Dan

Vertical pale band kroz dostupne sate.

Primer:
14:00–20:00
`Mogu da radim`

Confirmed Agreement preko njega vizuelno pobeđuje.

## 567.3 Draft/non-active worker profile

Ako worker profile nije ACTIVE:
availability se ne prikazuje kao aktivni matching signal.

Current code to već uglavnom poštuje.

---

# 568. `MOJA DOSTUPNOST`

Na dnu Rasporeda ili kao header utility:

**Moja dostupnost** →

Tap:
worker availability editor.

Ako korisnik nema worker profile:
row se ne pojavljuje.

Ne stavljati:
`Arhiva`

pored njega.

Raspored footer time postaje:
- Moja dostupnost

i ništa više, osim ako postoji druga stvarno korisna calendar utility akcija.

---

# 569. HARD WORKER CONFLICT

Ako worker već ima:

10:00–12:00  
Montaža TV-a

i pokušava da prihvati:

11:00–13:00  
Dostava

server odbija.

User-facing:

**Termin se preklapa sa drugim Dogovorom**

`Već imate potvrđenu obavezu od 10:00 do 12:00.`

Primary:
**Otvorite Raspored**

Secondary:
`Nazad`

Ne:
- `Prihvatite ipak`;
- optimistični override.

Conflict authority ostaje server.

---

# 570. REQUESTER OVERLAP

Requester može imati:

Marko · 17–20  
Nikola · 17–20

isti task.

To je normalno.

Može imati i dva različita requester taska u isto vreme.

Raspored može vizuelno pokazati preklapanje.

Ne blokira automatski.

Reason:
requester nije nužno fizički worker na tim poslovima.

---

# 571. USER JE REQUESTER I WORKER U ISTO VREME

Primer:

Requester:
Selidba stana
17–20

Worker:
Dostava
18–19

Worker commitment je authority za worker conflict.

Requester event:
informativan.

Novi worker posao koji se preklapa sa Dostavom:
blokira se.

Ne blokira se samo zato što korisnik ima requester task u isto vreme.

---

# 572. REMOTE DEADLINE — POSEBNA SEKCIJA

Remote:

`Završiti do petka 18:00`

nije:
`Raditi petak 16–18`.

Zato ne crtamo busy block na timeline-u.

Target:

u Rasporedu može da postoji:

**Rokovi**

Petak do 18:00  
**Prevod prezentacije** →

Sutra do 12:00  
**Obrada fotografija** →

## 572.1 Mesec

Deadline day može imati mali deadline marker/dot ako ne zbunjuje event dots.

## 572.2 Nedelja

Deadline stoji kao `Rok` row pod tim danom.

## 572.3 Dan

Može biti top/all-day style row:
`Rok do 18:00`

Ne zauzima 2 sata u time rail-u.

## 572.4 Technical requirement

Calendar presentation mora dobiti deadline fact odvojen od exact accepted work intervala.

Ne inferovati interval iz deadline-a.

---

# 573. MULTI-DAY / OVERNIGHT DOGOVOR

Ako Dogovor traje:

23:00–06:00

Raspored mora da ga pokaže kroz dve kalendarske date.

Mesec:
dots na oba relevantna dana ili projection po overlap pravilima.

Nedelja:
full range words.

Dan:
odgovarajući deo intervala na svakom danu.

Ne truncate na prvi datum.

Current `agendaWindow` / Serbian-time helpers već imaju dobar temelj.

---

# 574. TIMEZONE

Kanon:
Dogovoreni termini se prikazuju po:
**Europe/Belgrade / vremenu u Srbiji**

Ako telefon koristi drugu zonu:
quiet note:
`Po vremenu u Srbiji`

Ne menjati ugovoreni termin prema phone timezone-u kao da je lokalni događaj putnika.

DST overlap:
ako je potrebno, current helpers već čuvaju offsets.

---

# 575. STANJA DOGOVORA U RASPOREDU

Raspored ne postaje action center.

Calendar block može diskretno razlikovati:

- Dogovoreno
- Čeka potvrdu završetka
- Završen
- Problem

Ako čeka moju akciju:
small orange dot/edge.

Tap:
Dogovor.

Radnja se izvršava u Dogovoru, ne u calendar block-u.

---

# 576. COMPLETED / CANCELLED U RASPOREDU

Cancelled:
ne blokira worker future availability.

Ne ostaje kao active busy block.

Completed:
može ostati u istorijskom prikazu izabranog ranijeg dana ako Dogovori read kaže da je completed.

Ali:
Raspored nije arhiva.

Za pretraživanje prošlih saradnji:
Dogovori → Prethodne saradnje.

Ne dodajemo `Arhiva` route.

---

# 577. PAST / FUTURE NAVIGATION

Korisnik može pregledati prethodni mesec/nedelju/dan.

To ne znači da se svi stari Dogovori učitavaju beskonačno.

Calendar koristi bounded range.

Kada korisnik ode van učitanog prozora:
read new window.

Current five-month cache window je dobar UX temelj:
middle month ±2.

Zadržati.

Ne pokazivati prazno dok read za novi range još nije potvrđen.

---

# 578. RASPORED — FIRST LOAD

Na first load:

Header + view switch ostaju stabilni.

Body:
`Učitavamo raspored…`

`Proveravamo dogovorene termine za izabrani period.`

Ne crtati lažne dots/empty days dok schedule authority nije read.

---

# 579. PARTIAL READ

Current Raspored ima dve istine:

1. worker calendar authority
2. Dogovori list

Ako worker schedule stigne, a Dogovori list padne:
možemo da pokažemo worker commitments.

Ali ne smemo reći:
`Nema drugih termina`

jer requester Dogovori možda nisu učitani.

Final copy formal:

`Prikazani su samo potvrđeni termini u kojima uskačete.`

`Ostali Dogovori trenutno nisu učitani.`

Primary:
`Pokušajte ponovo`

To je dobar current architectural behavior.

---

# 580. RASPORED — EMPTY

Ako svi relevantni reads potvrde da nema termina:

Month:
normalan kalendar bez dots.

Selected day:
`Nema Dogovora ovog dana.`

Ako nema nijednog u celom periodu:
može ispod perioda:

**Još nemate dogovorene termine u ovom periodu.**

Ne velika 2.5D scena usred svakog praznog meseca.

Raspored je utility screen i prazan calendar je sam po sebi validno stanje.

---

# 581. RASPORED — ERROR

Full schedule error:

2.5D/fact calendar art mala.

**Raspored nije učitan**

`Proverite vezu pa pokušajte ponovo.`

Primary:
`Pokušajte ponovo`

Back:
Dogovori.

Ako last snapshot postoji:
snapshot ostaje + quiet stale note.

---

# 582. RASPORED — TOUCH / NAVIGATION

Tap Dogovor event:
→ exact context.

Requester grouped:
→ task-group workspace.

Worker:
→ bilateralni Dogovor.

Tap loose no-term:
→ Dogovor ili propose-term flow.

Tap availability:
ne menja event.

`Moja dostupnost`:
→ availability editor.

Swipe:
period navigation.

Arrows:
period navigation.

Tap `Danas`:
- selected=today;
- period jumps to today;
- view ostaje isti.

---

# 583. MESec/Nedelja/DAN — RESPONSIVE

## Large text

Segmented control ostaje čitljiv.

Period controls mogu da se wrap-uju.

Month cell ne pokušava da prikaže više teksta.

Day event block raste po visini samo gde može bez gubitka interval meaning-a.

Ako title ne stane:
2 lines ili event detail on tap.

## 320–360dp

`Danas` control može preći u drugi red.

Legend se ne gura u isti horizontalni red ako nema prostora.

Current code već ima `narrow` behavior i to treba zadržati.

---

# 584. RASPORED — LEGEND

Legend je optional/helpful, ne stalni veliki blok.

Tap info/legend:
small sheet:

- Dogovor
- Moja dostupnost
- Čeka Vašu akciju
- Rok

Ne stavljati legendu kao četiri velika chips-a na screen.

Ako color coding ostane dovoljno intuitivan:
legend može biti quiet info icon.

---

# 585. RASPORED — FINALNI PRIMER MESEC

HEADER

←  **Raspored**                           [Danas]

**Mesec | Nedelja | Dan**

`2 Dogovora bez tačnog termina` →

<   **Oktobar 2026**   >

PON UTO SRE ČET PET SUB NED

      1   2   3   4   5   6
      ·           ·
 7   8   9  10  11  12  13
        ...
 26  27 [28] 29  30  31

Selected day:
green circle around 28.

Availability:
soft background on available days.

------------------------------------------------

**Danas, 28. oktobar**

17:00–20:00
**Selidba stana**
Liman · 2 saradnje                              →

20:30–21:30
**Montaža TV-a**
Ana M. · Grbavica                              →

------------------------------------------------

**Moja dostupnost**                             →

Nema:
`Arhiva`.

---

# 586. RASPORED — FINALNI PRIMER DAN

←  **Raspored**                           [Danas]

**Mesec | Nedelja | Dan**

`1 Dogovor bez tačnog termina` →

**Sreda, 28. oktobar**
<                                      >

07:00  ─────────────────────

08:00  ─────────────────────

...

14:00  │ Mogu da radim
15:00  │
16:00  │

17:00      ┌─────────────────────┐
           │ Selidba stana       │
           │ 2 saradnje          │
18:00      │                     │
19:00      │                     │
20:00      └─────────────────────┘

20:30               ┌─────────────┐
                    │ Montaža TV-a│
21:30               └─────────────┘

red `sada` linija samo ako je danas.

Remote deadline:
iznad ili ispod timeline-a kao:
`Rok danas do 18:00 · Prevod prezentacije`

Ne kao busy block.

---

# 587. RASPORED — IMPLEMENTATION DELTA

## KEEP

- `workerCalendarClientService` kao worker busy authority;
- source `AGREEMENT`;
- month range prefetch ±2;
- Serbian-time helpers;
- Month / Week / Day;
- swipes;
- exact interval rendering;
- overlap columns;
- now line;
- availability soft shade;
- loose-term list;
- partial-read honesty;
- pull refresh;
- large-text/narrow handling.

## MODIFY

- formal copy;
- `Tvoj zadatak` → formal/contextual wording;
- remove `Arhiva` row/route entry;
- requester same-task/same-window presentation grouping;
- task-group navigation from grouped requester event;
- remote deadline presentation;
- attention cue without turning calendar into action center.

## NEW

- requester calendar aggregation presentation;
- deadline projection/presentation if backend does not expose it yet.

## COMPAT

- legacy start-only reads can remain;
- new writes should target exact start+end or no exact term.

---

# 588. RASPORED — OBAVEZNI TEST SCENARIJI

1. empty month;
2. selected empty day;
3. one worker Agreement;
4. one requester Agreement;
5. 3 requester Agreements same task/same time → one grouped event;
6. same task/different times → separate events;
7. worker hard conflict;
8. requester overlap;
9. requester + worker overlap;
10. one no-term Dogovor;
11. multiple no-term Dogovori;
12. availability ACTIVE;
13. availability draft/non-active;
14. overnight 23–06;
15. DST edge;
16. phone timezone not Serbia;
17. remote deadline;
18. completed past event;
19. cancelled releases busy;
20. partial Dogovori read error;
21. full schedule error;
22. stale snapshot;
23. 320dp width;
24. text scale 1.3;
25. period outside current prefetch range.


# 589. ZADACI ROOT — FINALNI EKRAN OD VRHA DO DNA

Ovo je ekran koji korisnik dobija kada dole pritisne:

**Zadaci**

Mentalni model:
**„Pokažite mi gde mogu da uskočim i šta mi odgovara.“**

Ovo nije:
- feed na Početnoj;
- imenik ljudi;
- oglasnik sa hiljadu filtera;
- odvojeni „Mapa“ i „Lista“ ekran.

Lokalni Discovery je:
**jedan ekran = mapa + lista kao sheet preko mape.**

Remote Discovery je:
**isti tab, ali puna lista bez mape.**

---

# 590. ZADACI — ROOT CHROME

Na vrhu, preko mape / iznad remote liste:

## 590.1 Search control

Velika jasna kontrola:

🔍 **Pretražite zadatke**

Ispod/unutra može da se vidi aktivno područje:

`Novi Sad`

ili:
`Liman`

Tap:
otvara full Search surface.

Ne držati permanentno veliki text input preko mape.

## 590.2 Filter

Desno od search-a:

**Filter** icon/button.

Ako filteri jesu aktivni:
mali green dot/count indicator.

Ne stavljati pet odvojenih filter ikonica gore.

## 590.3 Quick chips

Ispod search-a horizontalno:

- **Na lokaciji**
- **Na daljinu**
- **Za mene**
- Danas
- Ovaj vikend

Moguće dodatno:
- Sa cenom

Ne:
- HITNO;
- alat;
- vozilo;
- broj prijava.

`Na lokaciji` i `Na daljinu` su work-mode filter/pogled, ne dva root taba.

## 590.4 `Za mene`

Finalni UI koristi **jedan chip `Za mene`**, ne veliki dodatni `Svi zadaci | Za mene` segmented switch.

OFF:
Discovery normalno.

ON:
server filtrira/rangira samo ono što odgovara potvrđenom worker profile-u, području i dostupnosti prema stvarnim capability pravilima.

Ako worker profil nije spreman:
ne uključuje se lažno.

Prikazuje miran sheet/notice:

**Podesite radni profil**

`Da bismo prikazali zadatke koji Vam odgovaraju, prvo definišite šta radite i gde uskačete.`

Action:
**Podesite profil**

---

# 591. LOCAL DISCOVERY — MAPA KAO OSNOVA

Mapa zauzima gotovo ceo ekran.

Na njoj:
- TASK pinovi;
- PLACE pinovi;
- CLUSTER markeri;
- selected marker.

Preko nje:
- top chrome;
- bottom list sheet.

Bottom navigation ostaje vidljiv dok korisnik normalno pretražuje.

Ne koristiti veliki floating `+` jer Novi zadatak već ima Početna/Entry action.

---

# 592. PEEK — POČETNO STANJE LISTE

Sheet u dnu:

[handle]

**12 zadataka u ovom području**

Može quiet subline:
`Pomerite mapu ili povucite listu nagore.`

To je sve.

PEEK ne prikazuje polovičnu task karticu koja viri ispod ivice.

Razlog:
korisnik odmah razume:
- mapa je sada glavni kontekst;
- lista postoji i može se povući.

Swipe up:
→ HALF.

---

# 593. HALF — GLAVNO KOMBINOVANO STANJE

Približno:
- gornja polovina mapa;
- donja polovina lista.

Na vrhu sheeta:

[handle]

**12 zadataka**

Ispod pune Task kartice.

Korisnik istovremeno:
- vidi gde su zadaci;
- može da skenira nekoliko rezultata.

Scroll kartica ne pomera mapu.

Drag handle/sheet menja snap.

Tap kartice:
→ Public Task detail.

Ne prvo select pin pa još jedan tap.

---

# 594. FULL — LISTA JE GLAVNA

Sheet ide skoro do vrha.

Mapa ostaje iza kao context, ali nije dominantna.

Search/filter chrome i list state ostaju.

Kartice se normalno skroluju.

Pull refresh:
osvežava current scope.

Swipe sheet down:
→ HALF/PEEK.

Back u FULL:
prvo vraća prethodni sheet snap ako je to prirodno Android ponašanje u current implementation-u; ako route history zahteva Back, ne praviti nestandardnu zamku. Gesture/handle ostaje primarni način za sheet.

---

# 595. MAPA I LISTA — ISTI DATASET

Ovo je hard product pravilo.

Ako mapa trenutno pokazuje:
Liman + Grbavica

i server za taj spatial scope zna 12 taskova:

PEEK:
**12 zadataka**

HALF/FULL:
lista je tih istih 12.

Ne:
- remote taskovi;
- taskovi sa druge strane grada;
- ukupni Serbia count;
- cached rows iz starog regiona predstavljeni kao current.

Cache može interno postojati.
Vizuelna istina mora biti current scope.

---

# 596. POMERANJE MAPE

Korisnik drag-uje mapu.

Tok:

1. mapa se kreće odmah;
2. pinovi starih podataka mogu kratko ostati dok kamera nije settled;
3. nakon približno **450 ms bez novog pomeranja** novi bounds postaju query scope;
4. server/read se pokreće;
5. sheet/list se osvežava;
6. count se menja kada novi scope bude potvrđen.

Nema dugmeta:

`Pretražite ovo područje`

Auto-follow je finalni smer.

## 596.1 Tokom refresh-a

Ne prazniti mapu odmah.

Ako imamo prethodni snapshot:
ostaje uz diskretan loading cue.

Kada stignu novi podaci:
replace bez velikog flash-a.

---

# 597. SPATIAL CACHE

Primer:

1. Liman → 12
2. Detelinara → 18
3. nazad Liman

Treći korak:
Liman rezultati treba da se vrate odmah iz session cache-a.

Background:
refresh.

Ako refresh padne:
last cached rows ostaju uz:
`Podaci za ovo područje nisu osveženi.`

Cache key mora uključiti:
- normalized bounds/bucket;
- query;
- filtere;
- mode;
- relevantan profile/matching scope.

Ne mešati filtered/unfiltered rezultate.

---

# 598. TASK PIN — TAČNO PONAŠANJE

TASK pin:
jedan task na toj javnoj približnoj tački.

Visual:
postojeći USKOČI task pin asset.

Nema:
- title;
- price;
- applicant count.

Tap:

1. marker → selected state;
2. sheet/list se povlači iz donje zone;
3. bottom nav se privremeno sakrije;
4. pojavljuje se selected task preview card pri dnu.

Tap preview:
→ Task detail.

Close preview / Back:
→ prethodni:
- map camera;
- sheet snap;
- list offset.

To je veoma bitno.

---

# 599. SELECTED TASK PREVIEW

Floating card iznad safe bottom edge-a.

Sadržaj:

**Unos ormara na treći sprat**

**3.000 RSD / osoba**

Danas · 17:00–19:00  
Liman · oko 2 km  
2 mesta

Ako relation:
small:
`Prijava poslata`
ili
`Vaš zadatak`

Cela kartica tap target.

Close X:
gasi selected state.

Ne:
- requester avatar;
- rating;
- tools;
- vehicle;
- age;
- dodatni CTA button.

---

# 600. PLACE PIN — VIŠE TASKOVA NA ISTOM MESTU

PLACE znači:
više taskova imaju istu/ekvivalentnu javnu približnu tačku.

Visual:
USKOČI count pin:
`U · 3` / postojeći count material.

Tap:

- pin selected;
- ne zoomira;
- otvara bottom carousel.

Prvi card:
Task 1.

Swipe:
Task 2 → Task 3.

Indicators:
`1 od 3`
+ dots.

Tap active card:
detail.

Close:
nazad na map/list context.

Ako više članova lazy-load:
current card index se ne menja kada novi paket stigne.

---

# 601. CLUSTER — VIŠE RAZLIČITIH TAČAKA

CLUSTER nije PLACE.

Visual:
kompaktan marker sa count-om, drugačiji od USKOČI place pin-a.

Primer:
`24`

Tap:
mapa zoom/fit bounds.

Ne:
- carousel;
- task detail;
- count pin kao da su svi na istoj adresi.

Kada zoom razdvoji:
pojavljuju se TASK/PLACE pinovi.

---

# 602. TASK CARD — FINALNA DENSE VERZIJA

Current `TaskFace` može da prikaže:
- publisher;
- rating;
- requirement;
- tool;
- vehicle;
- age;
- status.

Finalni Discovery card to **ne radi**.

## 602.1 Prikazuje

### Naslov
max 2–3 linije gde treba.

### Cena
primer:
`4.000 RSD / osoba`

ili:
`Traži ponude`

ili:
`Cena nije navedena`

### Vreme
`Danas · 17:00–19:00`
`Ove nedelje`
`Rok: petak do 18:00`

### Mesto
`Liman, Novi Sad · oko 3 km`

ili:
`Na daljinu`

### Ljudi
samo kada relevantno:
`2/3 mesta`
ili
`Traže se 3 osobe`

### Relation
small optional:
- `Vaš zadatak`
- `Prijava poslata`
- `Dogovoreno`

## 602.2 Ne prikazuje

- avatar requestera;
- ime requestera;
- rating requestera;
- starost oglasa;
- alat;
- vozilo;
- skill/category kao još jedan row;
- public applicant count;
- `Pogledajte` dugme.

Cela kartica otvara detail.

---

# 603. ZAŠTO REQUESTER TRUST NIJE NA DENSE CARD-U

Discovery treba da bude brz.

Requester trust je bitan **pre prijave**, ali ne mora biti na svakoj kartici.

Public Task detail pokazuje:
- avatar;
- requester ime;
- requester rating/count;
- trust.

Tako:
list ostaje čista,
a odluka i dalje ima trust informacije na pravom mestu.

---

# 604. CENA NA KARTICI

Cilj:
worker može da poredi poslove.

## TOTAL

Task:
12.000 RSD total / 3 required.

Worker-list comparable:
**4.000 RSD / osoba**

Full detail može dodatno:
`12.000 RSD ukupno`

## PER_PERSON

**4.000 RSD / osoba**

## HOURLY

**1.200 RSD / sat / osoba**

Ne samo `/ sat`.

## OFFERS

**Traži ponude**

## Unknown/unpriced

`Cena nije navedena`

Ne formatirati kao 0 RSD.

---

# 605. DISTANCE

Distance se prikazuje samo kada postoji bezbedan i stvaran reference context.

Primer:
`Liman, Novi Sad · oko 3 km`

Reference može biti:
- potvrđeno worker work area / chosen search origin;
- explicit location action.

Ne tražiti precise GPS permission automatski pri ulasku u Zadaci.

Ako korisnik tapne:
**Moja lokacija**
tada se može tražiti permission.

Denied:
Discovery i dalje radi preko:
- grada/područja;
- manual search;
- worker area.

GPS nikada nije blocker.

---

# 606. SEARCH — FULL SCREEN

Tap top search.

Otvara čist full screen:

← **Pretraga**

Polje:
**Šta tražite?**

Primer:
`selidba`

Ispod:
**Gde**

Current chosen:
`Novi Sad`

Results/place suggestions:

Novi Sad · 23  
Beograd · 13  
Subotica · 4  
Niš · 2

Remote:
**Na daljinu · 41**

Recent:
**Nedavne pretrage**

`selidba · Novi Sad`  
`farbanje`  
`Beograd`

## 606.1 Query + place

User može:
- samo šta;
- samo gde;
- oba.

Ne tražiti oba obavezno.

## 606.2 Place drill-down

Tap Novi Sad:
može prikazati:
- Liman;
- Grbavica;
- Detelinara;
- itd.

samo ako server/search source stvarno ima te partove.

## 606.3 Apply

Izbor pretrage vraća na:
- map local ako place/local;
- remote list ako remote.

Current map context se čuva kao prior local context za kasniji povratak.

---

# 607. FILTER SHEET — FINALNO

Tap filter.

Bottom sheet:

**Filteri**

## Kada

chips:
- Danas
- Sutra
- Ovaj vikend

Optional:
datum/range.

## Način rada

- Na lokaciji
- Na daljinu
- Oba

Ako quick chip već menja mode:
ovde je isto stanje, ne drugo duplicate truth.

## Cena

Price mode:
- Cena navedena
- Traži ponude

Minimum:
samo ako basis može pošteno da se poredi.

Ako uvodimo odvojeno:
- min fiksno / osoba;
- min satnica / osoba.

Ne jedan broj koji poredi fiksnu cenu i satnicu kao isto.

## Mesto

Current chosen place/map area.

Action:
`Promenite područje`

Ne još jedan slobodan city input u sheet-u.

## Footer

Levo:
**Očistite**

Desno primary:
**Prikažite 12 zadataka**

Count samo kada filter preview read to autoritativno zna.

Ako count nije dostupan:
`Prikažite zadatke`

---

# 608. QUICK CHIP `DANAS`

Tap:
filter state `Danas`.

Map/list:
isti Discovery.

Chip selected.

Tap ponovo:
uklanja filter.

Ako selected task više ne pripada novom filteru:
selected preview se zatvara i dataset se osvežava.

Ne ostaviti card taska koji filter više ne uključuje.

---

# 609. QUICK CHIP `ZA MENE`

ON zahteva dovoljno worker contexta.

Može uzeti u obzir:
- capabilities;
- local/remote mode;
- work area;
- availability kada autoritativno;
- exact busy conflicts.

Ne sme:
- da obeća „ovo sigurno možete“ samo zbog keyword match-a.

Copy u listi:
**Za Vas**

Ne:
`98% match`
dok nemamo definisan i objašnjiv score.

Ako neki task nije eligible:
on se u `Za mene` view-u ne prikazuje.

Ako profile read padne:
ne zameniti sa svim taskovima i zadržati selected `Za mene` kao da filter radi.

State:
`Zadatke za Vas trenutno ne možemo da proverimo.`

Retry / open work profile.

---

# 610. REMOTE MODE

Tap:
**Na daljinu**

Transition:
- mapa se uklanja;
- selected pin se zatvara;
- sheet nestaje;
- puna lista zauzima content;
- search/filter/chips ostaju;
- bottom nav ostaje.

Header quiet line:
`Zadaci na daljinu`

Task card:
place:
`Na daljinu`

Ako deadline:
`Rok: petak do 18:00`

Ne prikazivati distance.

## 610.1 Povratak local

Tap:
**Na lokaciji**

Restores:
- prethodni local map center;
- zoom;
- sheet snap;
- list offset;
- local spatial cache.

Remote scroll pozicija može se posebno pamtiti u session-u.

---

# 611. LOCAL TASK BEZ MAP POINT-A

Postoje taskovi koji imaju public area text ali nemaju mappable point.

Ne smeju:
- da naprave pin na [0,0];
- da se izmisli centar grada;
- da budu countovani kao da su u current map bounds ako server spatial scope to nije potvrdio.

Finalni local map list:
samo exact current spatial dataset.

Task bez point-a može biti:
- dostupan kroz text search/full local list model ako backend ima odgovarajući place scope;
- ali ne lažni map pin.

Ovo mora biti jasno definisano u reader/projection sloju.

---

# 612. EMPTY LOCAL AREA

Map remains.

Sheet:

**Nema zadataka u ovom području**

`Pomerite mapu ili promenite filtere.`

Ako filteri aktivni:
secondary:
**Očistite filtere**

Ne:
velika 2.5D ilustracija preko cele mape.

Map je korisna čak i kada je rezultat 0.

---

# 613. EMPTY REMOTE

Full-list empty state.

2.5D/fact art može:

**Trenutno nema zadataka na daljinu**

Ako filteri:
`Pokušajte da uklonite neki filter.`

Primary po potrebi:
**Očistite filtere**

Ne nuditi `Objavite zadatak` jer user je u worker discovery intent-u.

---

# 614. LOADING DISCOVERY

## Initial local

Map/chrome render.

Sheet:
`Učitavamo zadatke…`

Bez 6 lažnih cards.

## Refresh current area

Last confirmed pins/list ostaju.

Small progress cue.

## Initial remote

Clean centered/loading row:
`Učitavamo zadatke na daljinu…`

---

# 615. ERROR DISCOVERY

## Full initial error

Local:
map može ostati, ali bez tvrdnje da je prazna.

Sheet:
**Zadaci nisu učitani**

`Proverite vezu pa pokušajte ponovo.`

Primary:
`Pokušajte ponovo`

## Stale

Last dataset remains.

Quiet:
`Prikazano je poslednje učitano.`

## Relations error

Public tasks ostaju.

Samo relation labels:
`Vaš zadatak / Prijava poslata`
mogu privremeno nestati.

Ne rušiti ceo Discovery zato što overlay read nije uspeo.

Current architecture već to dobro radi.

---

# 616. TAP TASK CARD IZ LISTE

Tap list card:
**direktno Task detail.**

Ne:
list card → select marker → preview → još jedan tap.

Preview postoji za map pin.

List card je već dovoljno jasan target.

Back iz detail-a:
restores:
- mode;
- map camera;
- sheet snap;
- list offset;
- query/filter;
- selected pin ako je detail otvoren iz pin preview-a.

---

# 617. PUBLIC TASK DETAIL — POVRATAK

Entry source se pamti.

Ako iz:
- list card → Back vraća list na isti offset/sheet;
- selected pin preview → Back vraća selected pin/preview;
- notification → Back fallback Zadaci kada nema history;
- Home opportunity ne postoji finalno, jer Home feed retire.

Ne resetovati mapu na default grad.

---

# 618. BOTTOM NAV I SELECTED PIN

Normal Discovery:
bottom nav visible.

Selected pin/PLACE carousel:
bottom nav hidden da:
- preview dobije dovoljno prostora;
- ne postoje dva competing bottom surfaces.

Close:
bottom nav se vraća.

Task detail:
bottom nav hidden, pushed screen.

Remote normal list:
bottom nav visible.

---

# 619. MAP PRIVACY

Public map:
samo approximate/coarse task point.

Ne:
- exact private address;
- requester home;
- worker home.

Pin tap ne može da otkrije više preciznosti nego public task projection.

Map provider analytics/privacy configuration mora pratiti policy, ali UI ne prikazuje technical coordinate precision.

---

# 620. ZADACI ROOT — FINALNI VIZUELNI STANDARD

Ne menjati trenutni svetli USKOČI stil.

Top controls:
white, floating but light.

Map:
neutral, dovoljno mirna da orange/green pinovi budu čitljivi.

List sheet:
white;
top radius 26–30;
hairline/shadow;
handle.

Cards:
minimalno elevation;
više grouped-list osećaj nego „marketplace card wall“.

Functional icons:
2D.

2.5D:
samo empty/error/education moments.

Selected marker:
postojeći chosen asset + mali halo.

No gradients.

---

# 621. KONKRETAN LOCAL ZADACI SCREEN

TOP:

[ 🔍 Pretražite zadatke · Novi Sad        ] [Filter]

[Na lokaciji ✓] [Na daljinu] [Za mene] [Danas] [Ovaj vikend]

MAPA:

        [U]
                 [U·3]

  [24 cluster]

                         [U]

BOTTOM SHEET — PEEK:

──────── handle

**12 zadataka u ovom području**

Bottom nav:
Početna · **Zadaci** · Dogovori · Poruke

---

# 622. KONKRETAN HALF SCREEN

Top chrome ostaje.

Mapa gore.

Sheet:

──────── handle
**12 zadataka**

**Unos ormara na treći sprat**
4.000 RSD / osoba
Danas · 17:00–19:00
Liman · oko 3 km
2 mesta

────────────────

**Košenje travnjaka**
Traži ponude
Ove nedelje
Telep · oko 5 km

────────────────

...

Ne:
Marija Ilić ★4,7
pre 2 dana
Trake za nošenje
Kombi

To ide tek u detail tamo gde je relevantno.

---

# 623. KONKRETAN PIN PREVIEW

Tap [U]:

MAP remains.

Selected pin ring.

Bottom nav nestaje.

Preview:

[X]

**Unos ormara na treći sprat**

**4.000 RSD / osoba**

Danas · 17:00–19:00  
Liman · oko 3 km  
2 mesta

Tap card:
Task detail.

---

# 624. KONKRETAN REMOTE SCREEN

[ 🔍 Pretražite zadatke                  ] [Filter]

[Na lokaciji] [Na daljinu ✓] [Za mene] [Danas] [...]

**Zadaci na daljinu**

**Prevod kratkog uputstva**
2.500 RSD
Rok: Petak do 18:00
Na daljinu

────────────────

**Unos podataka u tabelu**
Traži ponude
Do nedelje
Na daljinu

Bottom nav visible.

Nema prazne mape.

---

# 625. ZADACI — IMPLEMENTATION DELTA IZ STVARNOG KODA

## KEEP

- root `/zadaci`;
- old `/mapa` / `/prilike` redirects;
- one account, no role mode;
- map+list one-screen concept;
- focus/account navigation guards;
- work-area initial targeting;
- map/list view memory;
- relation overlay separate from public dataset;
- relation error does not destroy list;
- selected preview architecture;
- design lab fixture matrix;
- TaskCard as whole press target;
- public approximate point model.

## MODIFY

- current `TaskFace` dense content → simplify;
- `Za mene` segmented control → quick chip;
- formal copy;
- map/list count exact spatial semantics;
- remote presentation;
- quick chips hierarchy;
- current public-card requirement/vehicle/tool presentation remove from dense list;
- price basis HOURLY wording `/ sat / osoba`;
- selected state visual from real pin assets.

## NEW/FIX

- spatial cache + stale-while-revalidate;
- exact local/remote dataset separation;
- PLACE carousel lazy behavior;
- server/search handling for local area tasks without point;
- final distance reference rules.

## DO NOT ADD

- `Pretražite ovo područje`;
- Map/List toggle;
- price labels on pins;
- public applicant count;
- AI ranking score;
- requester avatar/rating on dense card;
- HITNO MVP chip.

---

# 626. ZADACI — OBAVEZNI TEST SCENARIJI

1. local, 1 result;
2. local, 6 results;
3. 40;
4. 1000;
5. PEEK;
6. HALF;
7. FULL;
8. map move + 450ms update;
9. move back → cache;
10. TASK pin;
11. selected TASK preview;
12. PLACE 3;
13. PLACE lazy load;
14. CLUSTER;
15. remote mode;
16. local restore from remote;
17. `Za mene` success;
18. `Za mene` no worker profile;
19. `Za mene` read failure;
20. search query only;
21. place only;
22. query + place;
23. recent search;
24. filters none;
25. filters chosen;
26. count unavailable;
27. empty local;
28. empty remote;
29. loading local;
30. loading remote;
31. full error;
32. stale;
33. relation overlay error;
34. applied relation;
35. own task relation;
36. 360dp;
37. ~430dp;
38. text scale 1.3;
39. GPS denied;
40. task without map point.


# 627. PUBLIC TASK DETAIL — FINALNI EKRAN OD VRHA DO DNA

Ovo je ekran koji se otvara kada korisnik iz Zadaci:
- pritisne Task Card iz liste;
- pritisne selected map preview;
- otvori task iz deep link/push-a.

Mentalni model:
**„Da li želim da se prijavim na ovaj konkretan zadatak?“**

Zato ekran mora da odgovori redom:

1. Šta treba da se radi?
2. Koliko se plaća / da li se traže ponude?
3. Kada?
4. Gde?
5. Koliko ljudi treba?
6. Šta tačno podrazumeva zadatak?
7. Ko ga je objavio i da li mu verujem?
8. Ima li već pitanja/odgovora?
9. Kako izgleda približno mesto?
10. Da li nešto u ovom zadatku ne odgovara mom rasporedu/profilu?
11. Mogu li da se prijavim i šta se dešava ako kliknem?

---

# 628. TASK DETAIL — HEADER

## 628.1 Levo

Back.

Vraća:
- list card → isti Discovery list/sheet/offset;
- map preview → isti selected pin/preview;
- push/deep link → fallback `Zadaci`.

## 628.2 Naslov u header-u

Na početku scroll-a:
header nema duplirani task title.

Veliki title je u body-ju.

Kada veliki title skroluje ispod chrome-a:
isti title se pojavljuje u headeru.

Current `useDetailScrollTitle()` je dobar temelj.

## 628.3 Desno

`⋯`

U MVP-u:
- Podelite zadatak

Safety/report nije sakriven samo u `⋯`; ostaje jasan pri dnu profila/page-a.

Ne stavljati:
- Prijavite se
- Sačuvajte
- Favorite
u overflow ako nisu stvarne target funkcije.

---

# 629. HERO — ODNOS PREMA ZADATKU

Ako nema relation:
nema badge-a.

Ako je moj task:
small:
**Vaš zadatak**

Ako sam već poslao prijavu:
**Prijava poslata**

Ako je prijava izabrana:
**Dogovoreno**

Ako relation read padne:
ne prikazivati `UNKNOWN`.

Sticky footer tada preuzima recovery:
`Ne možemo da proverimo Vaš odnos prema ovom zadatku.`

---

# 630. HERO — NASLOV

Veliki title, maksimalno koliko treba da bude razumljiv.

Primer:

**Unos ormara na treći sprat**

Ne truncirati title do jedne linije samo radi estetike.

Large font:
više linija.

Ne stavljati category kao ogroman heading iznad.

Category može biti quiet metadata ako stvarno pomaže.

---

# 631. ODLUČUJUĆI SUMMARY — PRVI BLOK

Odmah ispod title-a:

## 631.1 Cena

Najvizuelno jača činjenica posle title-a.

### TOTAL
**12.000 RSD ukupno**

Ispod:
`4.000 RSD / osoba` kada task traži 3 osobe i to je relevantna worker comparison činjenica.

### PER_PERSON
**4.000 RSD / osoba**

### HOURLY
**1.200 RSD / sat / osoba**

### OFFERS
**Traži ponude**

Ispod info:
`U prijavi predlažete ukupan iznos.`

### No price
`Cena nije navedena`

Nikada:
0 RSD.

## 631.2 Ljudi / capacity

Primer:
**2 od 3 mesta slobodna**

ili:
**Traže se 3 osobe**

Ako ostalo 1:
`Još 1 mesto`

Worker mora odmah razumeti koliko ljudi može prijavom da pokrije.

## 631.3 Termin

Fixed:
**Danas · 17:00–19:00**

Flexible:
**Ove nedelje**

Remote:
**Rok: petak do 18:00**

Ako schedule zone treba:
quiet:
`Po vremenu u Srbiji`

## 631.4 Mesto

Local:
**Liman, Novi Sad**

Ako distance pouzdano postoji:
`oko 3 km od Vašeg područja rada`

Remote:
**Na daljinu**

Ne prikazivati exact adresu.

---

# 632. SUMMARY — VIZUELNA KOMPOZICIJA

Ne praviti četiri odvojene velike kartice.

Predlog:

- price kao jedan slightly-prominent block;
- ostali facts u jednoj grouped surface:
  - ljudi;
  - termin;
  - mesto.

Current `TaskDetailSummary` je dobra baza.

MODIFY:
- formal copy;
- HOURLY wording;
- capacity rewording za worker decision;
- remote deadline semantics;
- requester/worker contextual wording.

---

# 633. TASK PHOTOS — RANIJE NA EKRANU

Ako task ima fotografije:
**idu odmah posle decision summary-a, pre dugog opisa.**

Razlog:
fotografija često odgovori na pitanje šta treba da se radi brže od 20 redova teksta.

Prikaz:
- hero/first image;
- još 1–2 thumbnails;
- count:
  `3 fotografije`

Tap:
full-screen viewer.

Swipe.

No fake download CTA.

Ako nema photos:
nema prazne `Fotografije` sekcije.

## 633.1 Current code delta

Current `PublicNeedPresentation` sada prikazuje:
description → photos.

Final:
**photos → description**

kada photos postoje.

---

# 634. O ZADATKU — OPIS

Section:
**O zadatku**

Body.

Ako je opis veoma dug:
prvih do ~8 linija.

Quiet:
**Prikažite ceo opis**

Tap:
expand inline.

Ne otvarati poseban screen samo za description.

Current `DetailDescription` je dobar temelj.

---

# 635. VAŽNO ZA OVAJ ZADATAK

Requirements postoje samo ako su stvarno relevantni.

Section:
**Važno za ovaj zadatak**

Primer:

`Zgrada nema lift`

`Potrebna vozačka dozvola B kategorije`

`Potrebno 2 godine iskustva`

## 635.1 Šta NE radimo

Ne pretvarati backend inventory u dugačku listu:

Veštine  
Alat  
Vozilo  
Dozvole  
Bitni uslovi  
Identitet  
...

ako je pola prazno ili samo ponavlja category.

## 635.2 Task-specific tool/vehicle

Ako requester zaista kaže:
`Potreban kombi`

to može biti **task-specific requirement** na detail-u.

Ali to ne znači da worker public profile mora imati inventar vozila.

## 635.3 Identity required

Prikazati samo ako:
- policy stvarno aktivan;
- server autoritativno kaže da je requirement.

MVP obični taskovi:
ne izmišljati verified identity blocker.

---

# 636. FIT / LIČNI KONTEKST — SAMO AKO POMAŽE

Current detail može da zna:

- distance od worker area;
- overlap sa drugim Dogovorom.

To je korisno, ali treba biti diskretno.

Section ili quiet facts pre CTA-a:

### Distance
`Oko 8 km od Vašeg područja rada`

### Conflict
🟠 `Termin se preklapa sa Vašim Dogovorom „Montaža police“`

Action:
`Otvorite Raspored`

## 636.1 Ne koristiti kao AI score

Ne:
`Odgovara Vam 92%`

Ne:
`Odličan match`

dok nemamo transparentan scoring model.

---

# 637. KO JE OBJAVIO — TRUST CARD

Section:
**Objavio**

Card:

[avatar 56]

**Marija Ilić**

★ **4,7 · 23 ocene**

optional, samo ako server policy dozvoljava:
`Dolazi kako je dogovoreno · 90%`

ili drugi requester trust fact kada finalno definišemo requester trust.

Tap:
**public requester profile sheet**

## 637.1 Zašto ovde

Pre finalne prijave worker treba da zna:
**sa kim ulazi u potencijalni Dogovor.**

Zato requester trust pripada detail-u, ne dense list card-u.

## 637.2 Ako nema ocena

`Još nema ocena`

Ne prikazivati praznu zvezdu + 0,0.

## 637.3 Ako trust read padne

Task i dalje ostaje.

Ne blokirati apply zbog failure-a reputacije.

---

# 638. PUBLIC REQUESTER PROFILE SHEET IZ TASK-A

Tap requester card.

Sheet:

[large avatar]

**Marija Ilić**

`Kao naručilac`

★ 4,7 · 23 ocene

12 završenih saradnji

Na USKOČI-ju od...

Verified identity samo ako stvarno verified.

Actions:
- zatvori;
- prijavite ili blokirajte osobu.

Ne:
- email;
- telefon;
- exact address;
- worker skills;
- worker radius.

---

# 639. PITANJA I ODGOVORI — INLINE

Section:
**Pitanja i odgovori**

Ne samo link:
`Pogledaj pitanja`.

Worker treba da vidi javne odgovore dok čita task.

Primer:

**Da li zgrada ima lift?**

Odgovor osobe koja je objavila zadatak · pre 2 sata

> Nema lift, treći sprat je.

Divider.

**Da li ormar može da se rasklopi?**

> Da, već je rasklopljen.

Ako više:
**Prikažite sva pitanja (6)** →

Ako worker može pitati:
secondary:
**Postavite pitanje**

## 639.1 Anonymous preselection

Ne prikazivati ime askera.

Q&A je task-level public clarification.

## 639.2 Ako nema pitanja

`Još nema objavljenih odgovora.`

Ako mogu da pitam:
`Postavite pitanje`

Ako ne mogu:
samo quiet state.

## 639.3 Active worker requirement

Current Q&A policy može zahtevati active Worker profile za postavljanje pitanja.

Ako nije active:
`Za postavljanje pitanja potreban je aktivan Radni profil.`

Action:
`Dopunite radni profil`

Ne sakriti razlog.

---

# 640. FULL Q&A SCREEN

Tap:
`Prikažite sva pitanja`

Full pushed screen.

Header:
← **Pitanja o zadatku**

Subline:
task title.

Public viewer:
- answered public questions;
- ask composer ako može;
- older-version note ako task changed.

Owner:
- pending questions first;
- answer action;
- answered;
- ignored/reported history po pravilima.

Unknown send:
journal/readback.

Ne izmišljati uspeh pitanja.

---

# 641. MESTO — APPROXIMATE MAP

Local task:

Section:
**Mesto**

Mini map height oko 180–200dp.

Pin:
**Približno mesto**

Ispod:

🔒 `Tačnu adresu naručilac deli u Dogovoru.`

Info:
`Izbor prijave sam po sebi ne otkriva adresu.`

Ako route task:
public route facts ispod map-a.

## 641.1 Remote

Remote:
nema `Mesto` sekcije.

Ne prikazivati empty grey map.

---

# 642. ROUTE / POINT-TO-POINT TASK

Ako task ima kretanje:

Section Mesto:

**Od**
Liman, Novi Sad

→

**Do**
Petrovaradin

ili compact route:
`Liman → Petrovaradin`

Ako multi-stop:
prikazati samo canonical public stops.

Ne duplirati:
area text + route + map + još jednu location karticu sa istim rečima.

---

# 643. SAFETY

Na kraju page-a:

shield icon.

**Prijavite ili blokirajte osobu**

Danger tone, ali ne ogroman red panel.

Tap:
Safety sheet.

Opcije:
- Prijavite
- Blokirajte

Report:
categories iz safety modela.

Block:
jasno šta se dešava.

Ako je moj task:
nema report-self akcije.

---

# 644. STICKY FOOTER — SRCE TASK DETAIL-A

Jedan primary outcome.

## 644.1 Mogu da se prijavim / MY_PRICE

**Pošaljite prijavu**

Ako application deadline:
quiet iznad:
`Prijave do 30. oktobra · 18:00`

## 644.2 OFFERS

**Pošaljite ponudu**

Ne `Pošaljite prijavu` kada user treba da unese cenu.

## 644.3 Moj task

**Otvorite svoj zadatak**

## 644.4 Već sam se prijavio

**Pogledajte svoju prijavu**

Ako selected:
**Otvorite Dogovor**

## 644.5 Relation unknown

Reason:
`Ne možemo da proverimo da li ste se već prijavili.`

Primary:
**Proverite ponovo**

Ne nuditi drugi submit.

## 644.6 Task full

Reason:
**Sva mesta su popunjena**

Secondary:
`Drugi zadaci`

## 644.7 Deadline passed

`Rok za prijave je prošao 28. oktobra.`

`Drugi zadaci`

## 644.8 Closed/gate

`Nove prijave trenutno nisu dostupne.`

`Drugi zadaci`

Nema disabled green button bez objašnjenja.

---

# 645. TAP `POŠALJITE PRIJAVU`

Ne šalje ništa odmah.

Otvara:
**Vaša prijava**

Application form.

To je važno:
Task detail je decision screen.
Application form je write flow.

Back iz Application:
vraća ovaj isti Task detail.

---

# 646. SHARE TASK

Overflow:
**Podelite zadatak**

System share.

Share content:
- task title;
- public area;
- safe public link.

Ne:
- exact address;
- private notes;
- worker data.

Dismiss share:
nije error.

---

# 647. TASK DETAIL — LOADING

Header + Back.

Body:
small calm:
**Učitavamo zadatak…**

`Proveravamo najnovije uslove i dostupnost prijave.`

Ne skeletonuje:
- cenu;
- requester;
- map;
- fake photos.

---

# 648. TASK DETAIL — ERROR

Bez cached data:

**Ne možemo da učitamo zadatak**

`Proverite internet vezu i pokušajte ponovo.`

Primary:
**Pokušajte ponovo**

Back:
Zadaci/current source.

---

# 649. TASK DETAIL — MISSING / UNAVAILABLE

Server kaže task nije dostupan:

**Ovaj zadatak više nije dostupan**

`Zadatak je možda zatvoren ili više nije javno dostupan.`

Primary:
**Nazad na zadatke**

Optional:
`Pokušajte ponovo` samo ako route smatra da recovery ima smisla.

Ne prikazivati poslednji cached description ako authoritative server kaže user više nema pravo da ga vidi.

---

# 650. TASK DETAIL — STALE

Imamo prethodni snapshot, refresh failed.

Content ostaje.

Top quiet warn:

**Prikazani su poslednji učitani podaci.**

`Osvežite zadatak pre slanja prijave.`

Action:
**Pokušajte ponovo**

Sticky application CTA:
može biti blokiran dok current version nije potvrđen, ako server rules to zahtevaju.

Ne šaljemo prijavu na staru verziju.

---

# 651. TASK VERSION CHANGE DOK GLEDAM

Ako detail refresh otkrije novu revision:

Content se ažurira.

Ako worker već sastavlja Application:
application flow ima revision/hash guard.

Ako je application već poslat:
`Moje prijave` stale-task flow rešava pregled promena.

Task detail ne pokušava da mutira postojeću prijavu u pozadini.

---

# 652. DEADLINE CLOCK

Ako task ima application deadline:

Page zna server deadline.

Kada deadline prođe dok je ekran otvoren:
CTA se menja iz:

`Pošaljite prijavu`

u:

`Rok za prijave je prošao...`

bez potrebe da user ručno refreshuje.

Current route ima timer do deadline-a — KEEP.

Ne koristi phone date string za business authority osim za display of server timestamp.

---

# 653. LONG TEXT / LARGE FONT

## Title
više linija.

## Price
ne deli se neprirodno.

## Summary
stackuje se.

## Requester card
avatar + content mogu preći u vertical layout ako treba.

## Q&A
question/answer full width.

## Sticky footer
button label može wrap ili dobiti veću visinu.

Nikada:
smanji font na 11 samo da stane.

---

# 654. TASK DETAIL — KONKRETAN FINALNI PRIMER

HEADER

←                                            [⋯]

**Unos ormara na treći sprat**

**4.000 RSD / osoba**

2 od 3 mesta slobodna

📅 Danas · 17:00–19:00

📍 Liman, Novi Sad · oko 3 km

------------------------------------------------

[photo hero]
[thumb] [thumb]      `3 fotografije`

------------------------------------------------

**O zadatku**

Ormar je rasklopljen u kutijama, u prizemlju
zgrade. Treba ga uneti na treći sprat...

**Prikažite ceo opis**

------------------------------------------------

**Važno za ovaj zadatak**

ⓘ Zgrada nema lift

------------------------------------------------

**Objavio**

[Marija]
**Marija Ilić**
★ 4,7 · 23 ocene
Dolazi kako je dogovoreno · 90%                →

------------------------------------------------

**Pitanja i odgovori**

**Da li zgrada ima lift?**
Odgovor osobe koja je objavila zadatak · pre 2 sata
Nema lift, treći sprat je.

**Prikažite sva pitanja (4)** →
**Postavite pitanje**

------------------------------------------------

**Mesto**

[approx map]

🔒 Tačnu adresu naručilac deli u Dogovoru.

------------------------------------------------

🛡 **Prijavite ili blokirajte osobu**

STICKY FOOTER

`Prijave do danas · 22:00`

**Pošaljite prijavu →**

---

# 655. TASK DETAIL — CODE DELTA

## KEEP

- `PublicNeedPresentation`;
- scroll-title handoff;
- relation overlay;
- deadline timer;
- public photos;
- approximate map;
- Q&A inline;
- requester public profile sheet;
- safety entry;
- share action;
- fit context;
- stale cached display;
- sticky footer state machine.

## MODIFY

- formal copy;
- order: summary → photos → description;
- price basis HOURLY `/ sat / osoba`;
- capacity language;
- current description/photo order;
- requester trust role-scoped when backend ready;
- compact requirements;
- stale copy;
- apply/offer labels formal;
- map/privacy copy formal.

## RETIRE FROM DENSE DETAIL WHERE REDUNDANT

- repeated location wording;
- redundant requirement groups;
- technical status labels;
- any phone/contact exposure.

## NEW / P1

- requester trust projection final;
- blind/role reputation integration;
- richer media gallery polish if needed.

---

# 656. TASK DETAIL — OBAVEZNI TEST SCENARIJI

1. fixed price;
2. offers;
3. no price;
4. TOTAL;
5. PER_PERSON;
6. HOURLY;
7. 1 person;
8. 3 people, partially filled;
9. full;
10. fixed schedule;
11. flexible;
12. remote deadline;
13. no photos;
14. 1 photo;
15. 3 photos;
16. 6 photos;
17. long description;
18. requirements;
19. no requirements;
20. requester rated;
21. no requester ratings;
22. trust unavailable;
23. Q&A none;
24. Q&A answered;
25. Q&A many;
26. cannot ask / inactive worker profile;
27. local map;
28. route;
29. remote no map;
30. task-fit distance;
31. calendar overlap;
32. relation NONE;
33. OWNER;
34. APPLIED;
35. SELECTED / Agreement link;
36. UNKNOWN relation;
37. deadline passes while open;
38. loading;
39. full error;
40. missing;
41. stale cached;
42. 360dp;
43. ~430dp;
44. text scale 1.3;
45. safety/report flow.


# 657. VAŠA PRIJAVA — FINALNI EKRAN OD VRHA DO DNA

Ovo je ekran koji se otvara iz Public Task detail-a kada korisnik pritisne:
- **Pošaljite prijavu** za MY_PRICE;
- **Pošaljite ponudu** za OFFERS.

Mentalni model:
**„Kažem koliko nas dolazi, koliko tražim ako task traži ponude, eventualno ostavim kratku poruku i proverim sve pre slanja.“**

Prijava:
- prihvata raspored / vremenski okvir / rok taska;
- ne predlaže alternativni termin;
- ne menja task;
- ne pravi Dogovor dok requester ne izabere prijavu.

# 658. PRIJAVA — HEADER

Levo: Back, sa labelom **Nazad na zadatak**.

Title: **Vaša prijava**

Desno: `ⓘ` → **Šta vidi druga strana**

Final copy:
`Osoba koja traži pomoć vidi Vaše ime i fotografiju, ocenu, iznos prijave, broj ljudi, prihvaćeni termin/rok i poruku.`

# 659. TASK CONTEXT NA VRHU

Compact, ne ponavlja ceo Task detail.

**Unos ormara na treći sprat**

Liman, Novi Sad  
Danas · 17:00–19:00

Ako OFFERS:
`Traži ponude`

Ne ponavljati requester profil, Q&A, mapu, opis i fotografije.

# 660. PRIJAVA — REDOSLED INPUTA

1. **Koliko Vas dolazi** — samo kada može biti >1;
2. **Vaša ponuda** — samo OFFERS;
3. **Termin / rok koji prihvatate** — read-only;
4. **Poruka** — opciono;
5. review CTA.

Jedan miran form screen, ne wizard.

# 661. KOLIKO VAS DOLAZI

Ako task traži samo 1 osobu:
`Dolazite sami`
i people=1.

Ako task ima više preostalih mesta:

**Koliko Vas dolazi?**

[-] **2** [+]

`Još 3 mesta su slobodna.`

Maksimum prijave:
**broj preostalih mesta na zadatku**, uz opšti server limit za jednu prijavu.

Broj ljudi je činjenica konkretne prijave, ne trajnog Radnog profila.

Server proverava:
- `people >= 1`;
- `people <= remaining`;
- sistemski bezbedan maksimum po prijavi.

Ne postoji permanentni worker team-capacity limit.

# 662. MY_PRICE — CENA NIJE INPUT

## PER_PERSON

4.000 RSD / osoba × 2 osobe:

**8.000 RSD ukupno**

`4.000 RSD / osoba · 2 osobe`

## TOTAL

12.000 RSD ukupno / 3 required, application 2:

**8.000 RSD ukupno**

`Vaš deo za 2 od 3 mesta`

Formula:
`round(total_budget × application_people / required_people)`

## HOURLY

1.200 RSD / sat / osoba × 2 osobe:

**2.400 RSD / sat za Vašu prijavu**

`1.200 RSD / sat / osoba · 2 osobe`

Current `fixedApplicationPrice()` za HOURLY trenutno vraća samo amount.

**P0: mora biti hourly_per_person × people.**

# 663. OFFERS — WORKER UNOSI UKUPNU PONUDU

Field:

**Koliko tražite ukupno?**

`[ 8000 ] RSD`

Helper:
`Unesite ukupan iznos za sve ljude iz Vaše prijave.`

Ako people >1:
live derived:
**4.000 RSD / osoba**

Server šalje total application offer.

Input je whole RSD integer.

# 664. TERMIN — READ-ONLY ACCEPTANCE

Ovo supersede-uje current `ExactTimeSheet` u novom Application flow-u.

Application više ne nudi:
- drugi početak;
- drugi kraj;
- `Tačan termin`;
- `Koristi termin zadatka`.

## Fixed

**Termin**

`Danas · 17:00–19:00`

`Prihvatate termin zadatka.`

## Flexible

**Vreme**

`Ove nedelje`

`Prijavom prihvatate ovaj vremenski okvir. Tačan termin dogovarate kasnije u Dogovoru.`

## Remote

**Rok**

`Petak · do 18:00`

`Prijavom prihvatate ovaj rok.`

Alternative time proposal pripada Agreement change flow-u nakon Selection-a.

Legacy `start/end` mogu ostati u type/reader-u.
Novi UI šalje null/null, osim exact replay-a starog unresolved command-a.

# 665. PORUKA — OPCIONO

**Poruka**

Placeholder:
`Dodajte kratku napomenu ako je korisna…`

Current technical max: 4000 karaktera.

Guidance:
`Kratka poruka je dovoljna.`

Counter tek blizu limita.

Poruka nije mesto za strukturisanu cenu, alternativni termin, telefon ili adresu.

# 666. CATEGORY / WORKER PROFILE — NE MEŠATI SA PRIJAVOM

Current Application route ima skill/category opt-in koji može menjati worker profil tokom submit flow-a.

Finalno:
**RETIRE iz Application form-a.**

Prijava na jedan task ne sme usput da menja trajni matching profil.

Ako ikada nudimo dodavanje kategorije:
to je odvojeni post-success suggestion ili Worker Profile edit, ne deo application command-a i ne default-on switch.

# 667. FOOTER PRE REVIEW-A

Ako validno:

**8.000 RSD ukupno**
`Dolaze 2 osobe`

Primary:
**Pregledajte prijavu**

Ako OFFERS cena prazna:
`Unesite svoju cenu da pregledate prijavu.`

Ako people invalid:
`Izaberite koliko ljudi dolazi.`

Ako profil nije ACTIVE:
`Radni profil još nije aktivan.`
→ **Dopunite radni profil**

Ako task više ne prima:
`Zadatak više ne prima prijave.`
→ **Pogledajte druge zadatke**

Nema disabled CTA bez razloga.

# 668. REVIEW — BOTTOM SHEET

**Proverite prijavu**

Task:
**Unos ormara na treći sprat**

**8.000 RSD ukupno**

`2 osobe`

`Danas · 17:00–19:00`

Poruka:
`Dolazimo kombijem.`

Ako nema:
`Bez dodatne poruke.`

Quiet:
**Ako Vas izaberu, nastaje Dogovor pod ovim uslovima.**

Primary:
**Pošaljite prijavu**

Secondary:
**Izmenite**

Za OFFERS:
Primary **Pošaljite ponudu**.

# 669. REVIEW INVALIDATION

Ako se promeni:
- people;
- offer;
- note;
- task revision;

stari review više ne može da pošalje.

Current `reviewKey` pristup je dobar — KEEP.

# 670. SLANJE — DURABLE INTENT

Pre write-a command identity se durable čuva.

Current journal architecture — KEEP.

Ako journal ne može da se sačuva:
ništa se ne šalje.

User:
`Prijava nije sačuvana na telefonu. Pokušajte ponovo.`

# 671. SLANJE — BUSY

Posle final confirm-a:
form više nije editable.

CTA:
**Slanje…**

Frozen command:
- need id/revision;
- worker profile id;
- people;
- price;
- note;
- null new-flow term proposal;
- client request id.

Double tap se ne prima.

# 672. SUCCESS — PRIJAVA JE POSLATA

**Prijava je poslata**

Receipt:

**Zadatak**
Unos ormara na treći sprat

**Ljudi**
2 osobe

**Cena**
8.000 RSD ukupno

**Termin**
Danas · 17:00–19:00

**Poruka**
Dolazimo kombijem.

Copy:
`Ako Vas izaberu, nastaje Dogovor.`

Primary:
**Otvorite moje prijave**

Quiet:
**Nazad na zadatak**

Ne govoriti `Dogovoreno` pre Selection-a.

# 673. UNKNOWN OUTCOME

**Ne znamo da li je prijava poslata.**

Prikazuje frozen intent:
- Task;
- People;
- Price;
- Accepted term;
- Message.

Primary:
**Proverite da li je poslato**

Ne nuditi potpuno novi submit.

Ako readback nađe receipt → Success.

Ako conclusive refusal:
**Prijava nije primljena.**
Tek tada **Sastavite novu prijavu** ako task i dalje dozvoljava.

Ako i dalje unknown:
frozen state ostaje.

# 674. TASK SE PROMENIO TOKOM PRIJAVE

Command nosi exact need revision.

Ako task promenjen:
**Zadatak je u međuvremenu izmenjen.**

`Pregledajte nove uslove pre slanja prijave.`

Primary:
**Osvežite zadatak**

Draft people/note može ostati ako ima smisla.
Fixed price se re-derivira.
Review invalidira.

# 675. PREOSTALA MESTA SE PROMENE

Ako remaining 2 → 1, a draft people=2:

`Sada je slobodno još 1 mesto.`

Stepper max →1.
Stari review invalid.

Ako 0:
`Sva mesta su u međuvremenu popunjena.`
→ **Pogledajte druge zadatke**

# 676. CALENDAR CONFLICT PRI APPLICATION-U

Fixed task: prijavom worker prihvata exact interval.

Ako hard worker conflict znači ineligible:

**Termin se preklapa sa Vašim Dogovorom**

`Već imate potvrđenu obavezu u ovom terminu.`

→ **Otvorite Raspored**

Ne nuditi alternativni termin u Application-u.

Flexible nema hard exact conflict dok exact term ne postoji.

Remote deadline nije busy interval.

# 677. SERVER AUTHORITY

Server nezavisno proverava:
- need revision;
- open/eligible;
- remaining slots;
- people >=1;
- people <= remaining;
- MY_PRICE derivaciju;
- OFFERS price range;
- schedule acceptance;
- ACTIVE worker profile;
- identity gate samo ako policy active.

MY_PRICE deterministic total server re-derivira, ne veruje client totalu.

# 678. VISUAL STANDARD

Miran flow screen.

White/warm ground.

Task context na vrhu.

Sections:
- people;
- offer if needed;
- accepted schedule;
- message.

Bez 2.5D hero-a, marketplace card-a, AI assistant-a ili gomile chipova.

Review = bottom sheet.
Success = kratak brand moment.

# 679. KONKRETAN PRIMER — FIXED PER_PERSON

←  **Vaša prijava**                            [ⓘ]

**Unos ormara na treći sprat**

Liman, Novi Sad  
Danas · 17:00–19:00

**Koliko Vas dolazi?**

[ – ]      **2**      [ + ]

Još 3 mesta su slobodna.

**Cena**

**8.000 RSD ukupno**

4.000 RSD / osoba · 2 osobe

**Termin**

Danas · 17:00–19:00

Prihvatate termin zadatka.

**Poruka** · opciono

[ Dodajte kratku napomenu ako je korisna... ]

FOOTER

**8.000 RSD ukupno** · Dolaze 2 osobe

**Pregledajte prijavu**

# 680. KONKRETAN PRIMER — OFFERS

←  **Vaša prijava**                            [ⓘ]

**Košenje travnjaka**

Telep, Novi Sad  
Ove nedelje  
Traži ponude

**Koliko Vas dolazi?**

Dolazite sami.

**Koliko tražite ukupno?**

[ 3.500 ] RSD

**Vreme**

Ove nedelje

Prijavom prihvatate ovaj vremenski okvir.
Tačan termin dogovarate kasnije u Dogovoru.

**Poruka** · opciono

[ Imam svoju kosilicu. ]

**Pregledajte prijavu**

Review primary:
**Pošaljite ponudu**

> **IMPLEMENTACIONI DELTA — proveriti kao istorijski snapshot:** user-facing people cap je per-application + remaining slots + safe limit, ne trajni worker team capacity (S04/H/I).

# 681. IMPLEMENTATION DELTA — APPLICATION

## KEEP
- durable command journal;
- client request id;
- recovery-first architecture;
- draft memory;
- Need revision binding;
- ACTIVE profile guard;
- task-open/deadline guard;
- readback on uncertain;
- conclusive refusal;
- one-screen composer;
- review;
- success receipt;
- keyboard-safe flow.

## MODIFY
- formal copy;
- remove new-flow exact-time editor;
- start/end not editable;
- review uses accepted task schedule;
- HOURLY price × people;
- OFFERS per-person helper;
- error/recovery copy formal.

## RETIRE FROM APPLICATION UI
- ExactTimeSheet for new applications;
- `Koristi termin zadatka`;
- alternative-time proposal;
- category/skill auto-add switch;
- worker-profile mutation inside submit flow.

## LEGACY COMPAT
- unresolved old journal command with start/end retains exact frozen payload for replay/readback.

## P0
2. fix HOURLY fixedApplicationPrice;
3. server verify deterministic MY_PRICE;
4. flexible/remote new applications do not depend on proposal start/end.

> **LEGACY TEST INTERPRETACIJA:** testove sa `team capacity` prevesti u `people per application / remaining slots / systemic max` posle server usaglašavanja. Ne uvoditi stari UX.

# 682. APPLICATION — OBAVEZNI TEST SCENARIJI

1. single person;
2. multi-person;
3. team capacity smaller than remaining;
4. default capacity 1;
5. PER_PERSON ×1/×2;
6. TOTAL proportional/rounding;
7. HOURLY ×1/×2;
8. OFFERS ×1/×2;
9. invalid offer;
10. no/long note;
11. fixed schedule;
12. flexible;
13. remote deadline;
14. fixed conflict;
15. task revision changes;
16. remaining shrinks;
17. task fills;
18. profile deactivates;
19. deadline expires;
20. review invalidation;
21. double tap;
22. journal save fails;
23. network unknown;
24. readback success;
25. conclusive refusal;
26. repeated unknown;
27. success receipt;
28. legacy unresolved time proposal;
29. background/account switch;
30. 360dp + text scale 1.3.


# 683. MOJE PRIJAVE — FINALNI ROOT EKRAN

Mentalni model:
**„Na koje sam se zadatke prijavio, ko još odlučuje, šta sada traži mene i šta je završeno.“**

Ovo nije drugi Dogovori ekran.

Prijava živi ovde dok je:
- poslata;
- viđena;
- u užem izboru;
- promenjeni task traži moj pregled;
- povučena / zatvorena kao istorija.

Kada je prijava izabrana i Dogovor nastane:
glavni sledeći destination je **Dogovor**.

# 684. HEADER

← **Moje prijave**

Detail-level screen, zato ima Back.

Cold fallback:
Početna ili Profil/izvor koji ga je otvorio; ako nema istorije, Početna je bezbedan fallback.

Nema novog `+` dugmeta.
Nova prijava se pokreće iz Task detail-a.

# 685. FINALNI TABOVI

Finalni vidljivi tabovi:

**Čekaju odgovor | Čeka Vas | Prethodne**

Ne prikazivati stalni četvrti tab `Sve`.

## Čekaju odgovor
- Poslata
- Viđena
- U užem izboru

## Čeka Vas
- Zadatak je izmenjen i prijava traži pregled
- Izabrana prijava koja još treba da vodi korisnika u Dogovor / attention state
- recovery state koji zahteva proveru

## Prethodne
- Povučena
- Nije izabrana / task zatvoren
- drugi terminalni application states

`Sve` ostaje samo internal/deep-link read scope kada notification treba da pronađe konkretnu prijavu koja nije u trenutno vidljivom setu.

# 686. ZAŠTO NE `AKTIVNE | ISTORIJA`

Za Moje prijave korisnik ima vrlo jasnu razliku:
- čekam drugu stranu;
- nešto čeka mene;
- završeno je.

Zato tri ljudska taba daju više smisla od generičkog `Aktivne | Istorija`.

# 687. APPLICATION CARD — FINALNA ANATOMIJA

Jedna kartica prikazuje:

1. status;
2. task title;
3. moju cenu / ponudu;
4. broj ljudi;
5. trenutni task termin/rok;
6. mesto;
7. jedan relevantan next-action cue.

Primer:

`VIĐENA`

**Unos ormara na treći sprat**

8.000 RSD ukupno · 2 osobe

Danas · 17:00–19:00  
Liman, Novi Sad

`Čeka odgovor`

Whole card tap.

Ne prikazivati:
- requester avatar u svakoj dense card kartici;
- tools/vehicles;
- full message;
- application hash/version;
- redundant CTA dugmad.

# 688. HUMAN STATUSI

Server state → user-facing:

SUBMITTED → **Poslata**

VIEWED → **Viđena**

SHORTLISTED → **U užem izboru**

STALE_REVIEW_REQUIRED → **Zadatak je izmenjen**

SELECTED → **Dogovoreno**

WITHDRAWN → **Povučena**

CLOSED → **Nije izabrana** kada server contract to zaista znači; ako terminal reason nije dovoljno precizan, koristiti neutralnije **Zatvorena** dok projection ne dobije razlog.

Ne prikazivati raw state kod.

# 689. TAP OBIČNE AKTIVNE PRIJAVE

Tap na `Poslata / Viđena / U užem izboru` otvara **Application detail sheet**.

Title:
**Vaša prijava**

Facts:

**Zadatak**
Unos ormara na treći sprat

**Status**
Viđena

**Cena**
8.000 RSD ukupno

**Ljudi**
2 osobe

**Termin koji ste prihvatili**
Danas · 17:00–19:00

**Poruka**
Dolazimo kombijem.

Actions:
- **Otvorite zadatak**
- **Povucite prijavu** kada server dozvoljava

Nema editovanja obične aktivne prijave samo zato što se korisnik predomislio; UPDATE flow je vezan za changed-task review gde backend to podržava.

# 690. IZABRANA PRIJAVA

Card:

`DOGOVORENO`

**Unos ormara na treći sprat**

8.000 RSD · 2 osobe

Primary cue:
**Otvorite Dogovor →**

Tap card ili cue:
direktno bilateralni Dogovor.

Ne zadržavati izabranu prijavu kao paralelni aktivni workspace.

Dogovor je novi authority.

# 691. TASK JE IZMENJEN — ATTENTION CARD

Tab:
**Čeka Vas**

Card:

🟠 **Zadatak je izmenjen**

**Košenje travnjaka**

`Pregledajte nove uslove pre nego što odlučite šta ćete sa prijavom.`

Tap:
otvara **Pregled izmene prijave**.

# 692. PREGLED IZMENJENOG TASKA

Full pushed review ili large sheet ako sadržaj staje.

Title:
**Zadatak je izmenjen**

Na vrhu:
task title.

Prikazuje **trenutne authoritative uslove zadatka**.

Ako backend može pouzdano da prikaže old/new diff:
prikaži `Pre / Sada`.

Ako ne može:
ne izmišljati diff.
Prikaži current task facts + moju trenutnu prijavu.

Section:
**Trenutni uslovi zadatka**

- cena/basis;
- people requirement;
- vreme/rok;
- mesto;
- važni requirement facts.

Section:
**Vaša prijava**

- moja cena;
- people;
- note.

Copy:
`Prijava je poslata pre ove izmene. Izaberite šta želite da uradite.`

# 693. TRI ODLUKE NA IZMENJENOM TASKU

## Zadržite prijavu

Znači:
prihvatam aktuelne task uslove;
moja application cena/people/note ostaju koliko server dozvoljava.

Ako task sada ima novi fixed termin:
zadržavanje znači prihvatanje **novog current task termina**.

Ne čuvati legacy alternative proposed interval kao novi authority.

## Izmenite prijavu

Otvara kratki editor samo za application-owned facts:

- people;
- OFFERS cena;
- note.

MY_PRICE se re-derivira iz novog taska.

Schedule:
read-only current task schedule.

## Povucite prijavu

Destructive.

Confirm.

# 694. CHANGED APPLICATION EDITOR

**Izmenite prijavu**

Ako multi-seat:
people stepper sa max:
`current remaining`, uz sistemski maksimum po prijavi prema server contractu.

OFFERS:
total offer input.

MY_PRICE:
read-only recalculated amount.

Schedule:
**Prihvatate aktuelni termin/rok zadatka.**

Note:
editable.

Primary:
**Pregledajte izmenu**

Review:
old application facts vs proposed new application facts samo tamo gde imamo pouzdan current/original data.

Final:
**Sačuvajte izmenjenu prijavu**

# 695. LEGACY PROPOSED TIME U STAROJ PRIJAVI

Current code može imati `start/end` sa starom prijavom.

Prikaz istorijski može reći:
`Ranije je uz prijavu bio sačuvan predlog termina.`

Ali finalni changed-application editor:
**ne nudi menjanje tog termina**.

Ako zadržavanje/update zahteva migraciju:
server contract mora jasno odlučiti kako legacy interval prelazi u novi model.

Ne silently preserve-ovati nešto što bi postalo aktivni Agreement term bez nove potvrde.

# 696. POVLAČENJE PRIJAVE

Tap:
**Povucite prijavu**

Confirm sheet:

**Povući prijavu?**

`Više nećete biti u izboru za ovaj zadatak.`

Ako je task već selection-in-flight ili application nije withdrawable:
server odbija i UI refreshuje current state.

Primary destructive:
**Povucite prijavu**

Secondary:
**Odustanite**

Unknown outcome:
freeze exact withdrawal intent;
readback pre nove radnje.

# 697. SUCCESS POVLAČENJA

Toast/banner:
**Prijava je povučena.**

Card prelazi u:
Prethodne.

Ne nuditi Undo ako backend nema stvarni undo.

# 698. `ČEKA VAS` NE SME BITI SVE I SVAŠTA

U ovaj tab ulazi samo application-level radnja korisnika.

Primeri:
- changed task review;
- selected → open Dogovor attention;
- unknown command state → check outcome.

Ne:
- rating Dogovora;
- completion Dogovora;
- poruka.

To pripada Dogovorima/Porukama.

# 699. PRETHODNE

Cards su mirnije.

Status:
- Povučena
- Nije izabrana / Zatvorena

Facts:
task, moja cena, people, original/last accepted task time ako projection to zna.

Tap:
read-only detail sheet.

Može:
**Otvorite zadatak**
samo ako task i dalje postoji i authorized.

Ne nuditi reapply shortcut koji preskače current Task detail.

# 700. EMPTY STATES

## Nema nijedne prijave

2.5D application art.

**Još nemate prijava**

Primary:
**Pronađite zadatak**

## Čekaju odgovor prazno

**Ništa trenutno ne čeka odgovor.**

Ako `Čeka Vas` ima count:
secondary:
**Pogledajte šta Vas čeka**

Ako Prethodne imaju:
secondary:
**Pogledajte prethodne**

## Čeka Vas prazno

**Ništa Vas trenutno ne čeka.**

## Prethodne prazno

**Još nema prethodnih prijava.**

# 701. DEEP LINK / NOTIFICATION DO KONKRETNE PRIJAVE

Ako notification zna applicationId:

screen ne ostavlja korisnika da je ručno traži.

Flow:
1. otvori Moje prijave;
2. pronađi row kroz server paging/scope;
3. dovedi u fokus;
4. otvori relevantni detail/review ako je to notification intent.

Ako application nije na prvoj strani:
pager nastavlja dok je ne pronađe ili server potvrdi da nije dostupna.

Current code već ima dobar destination/focus koncept — KEEP.

# 702. PAGINATION

Server counts su authority.

Tab badge/count ne sme biti broj trenutno učitanih rows ako postoji još strana.

`Prikažite još` ili infinite fetch može da ostane.

Ako next-page read padne:
postojeći rows ostaju.

`Ne možemo da učitamo ostale prijave.`
→ **Pokušajte ponovo**

# 703. REFRESH

Pull refresh:
stari rows ostaju.

Quiet:
`Osvežavamo Vaše prijave…`

Dok command write/recovery traje:
ne dozvoliti paralelnu mutaciju iste prijave.

# 704. UNKNOWN UPDATE / KEEP / WITHDRAW

Current architecture sa:
- pending immutable command;
- exact readback;
- same request retry;

je dobra.

Final copy:

**Proveravamo da li je radnja sačuvana.**

Action:
**Proverite stanje prijave**

Ako exact safe retry allowed:
**Ponovite istu radnju**

Ne:
nova drugačija komanda dok prva nije razrešena.

# 705. MOJE PRIJAVE — VISUAL STANDARD

Root list:
light ground.

Tabs:
jedan horizontal segmented control:
- Čekaju odgovor
- Čeka Vas
- Prethodne

Attention tab može imati small orange count.

Cards:
white/record surface;
status chip small;
task title strong;
price + people compact;
schedule/place muted.

Ne group headings + tabs istovremeno.
Final UI bira **tabs**, pa unutar taba nema ponovnog `Čeka odgovor · 2` heading-a osim ako pagination/section semantika to stvarno zahteva.

Time smanjujemo duplu navigaciju current UI-a.

# 706. KONKRETAN ROOT PRIMER

← **Moje prijave**

[ Čekaju odgovor  3 ] [ Čeka Vas  1 ] [ Prethodne ]

`3 prijave`

`VIĐENA`

**Unos ormara na treći sprat**

8.000 RSD ukupno · 2 osobe

Danas · 17:00–19:00  
Liman, Novi Sad

────────────────

`U UŽEM IZBORU`

**Selidba kancelarije**

6.000 RSD ukupno · 1 osoba

Sutra · 09:00–12:00  
Centar

# 707. KONKRETAN `ČEKA VAS`

← **Moje prijave**

[ Čekaju odgovor ] [ **Čeka Vas 1** ] [ Prethodne ]

🟠 **Zadatak je izmenjen**

**Košenje travnjaka**

Traži ponude · Vaša ponuda 3.500 RSD

`Pregledajte aktuelne uslove.`

→

# 708. CODE DELTA — MOJE PRIJAVE

## KEEP
- owned reads;
- exact application identity;
- server-set paging;
- destination by applicationId;
- pending command recovery;
- readback;
- withdraw guards;
- changed-task resolution;
- stale editor protection;
- server counts;
- ApplicationCard reusable face.

## MODIFY
- visible tabs 4 → 3;
- `Čeka te` → `Čeka Vas`;
- `Istorija` → `Prethodne`;
- hide `Sve` as normal UI tab;
- formal copy;
- regular application detail as clean sheet;
- changed-task review as dedicated review surface, ne veliki inline editor u listi;
- remove time edit from changed-application editor;
- MY_PRICE HOURLY/multi-seat fixes shared with new Application;
- selected application routes strongly to Dogovor.

## RETIRE
- simultaneous group headings + tab categorization where redundant;
- legacy proposed-term editing;
- informal `tvoj/te` copy.

> **LEGACY TEST INTERPRETACIJA:** svaki test koji podrazumeva trajni worker team capacity kontradiktoran je S04 i mora biti preformulisan pre produkcionog sign-off-a.

# 709. MOJE PRIJAVE — TEST MATRIX

1. no applications;
2. 1 submitted;
3. viewed;
4. shortlisted;
5. 20 waiting + paging;
6. changed task;
7. changed task no reliable diff;
8. keep;
9. update OFFERS;
10. update MY_PRICE;
11. update people > team capacity;
12. withdraw;
13. withdraw unknown;
14. keep unknown;
15. update unknown;
16. selected → Dogovor;
17. withdrawn history;
18. closed/not selected;
19. notification destination first page;
20. destination later page;
21. missing destination;
22. refresh failure with rows;
23. paging failure;
24. app background during edit;
25. account switch;
26. large text;
27. 360dp.


# 710. KANDIDATI / PRIJAVE ZA MOJ ZADATAK — FINALNI ROOT

Ovo je requester ekran koji se otvara iz Owner Task-a kada postoje prijave.

Mentalni model:
**„Ko se prijavio, šta mi nudi, koliko ljudi pokriva i koga želim da izaberem?“**

Ne:
- AI ranking tabela;
- HR applicant tracking system;
- spisak worker profila nevezan za konkretnu prijavu.

Svaki kandidat = **osoba + jedna konkretna prijava**.

# 711. HEADER

← **Prijave**

Desno:
**Uporedite** samo kada ima najmanje 2 relevantne prijave.

Back:
Owner Task detail.

Cold fallback:
owner Task.

# 712. TASK CONTEXT NA VRHU

Compact:

**Selidba stana**

`2/3 dogovoreno`

Ako task još traži ljude:
`Još 1 mesto`

Tap:
Owner Task detail.

Ne ponavljati ceo task description.

# 713. TOOLBAR

Levo:
**5 prijava**
ili:
`5 prijava · 3 dostupne za izbor`

Desno:
sort.

Default:
**Pristigle**

Final sort opcije:

- Pristigle
- Cena po osobi
- Ocena

## 713.1 MY_PRICE

Ako task koristi MY_PRICE i sve prijave nose determinističku cenu iz istog task basis-a:
**ne prikazivati Cena po osobi sort** ako ne može da promeni informisanu odluku.

Requester je cenu već odredio.

## 713.2 OFFERS

Cena sort ima smisla.

Poredi:
`application total / covered people`

Ne total application offer.

# 714. P0 — CANDIDATE PRICE SORT

Current `sortCandidates(... PRICE)` radi:
`candidate.cena.iznos`

To je total prijave.

Primer:

Marko:
8.000 RSD · 2 osobe
= 4.000/osoba

Nikola:
5.000 RSD · 1 osoba
= 5.000/osoba

Current total sort bi stavio Nikolu ispred Marka.

Final:
Marko je jeftiniji po pokrivenom mestu.

P0:
**sort + comparative mark moraju koristiti comparable per-person/per-slot value.**

Formula OFFERS:
`total_offer / covered_slots`

Tie:
arrival order.

# 715. `NAJNIŽA CENA` MARK

Ako se prikazuje:
odnosi se na comparable price.

Copy:
**Najniža cena po osobi**

Ne samo:
`Najniža cena`

jer bi korisnik mogao pomisliti total.

Prikazati samo kada:
- svi relevantni kandidati za poređenje imaju validnu cenu;
- ceo candidate set je učitan;
- najmanje 2 selectable prijave imaju cenu;
- basis je uporediv.

# 716. `NAJBOLJA OCENA`

Može mali comparative mark:
**Najbolja ocena**

Samo ako:
- ceo relevantni set učitan;
- najmanje 2 kandidata imaju stvarnu ocenu;
- role-scoped worker reputation backend je authority.

Dok je reputation blended/account-level:
ne tretirati ga kao finalni trust authority.

# 717. CANDIDATE CARD — FINALNA ANATOMIJA

Primer:

[Marko]

**Marko P.**

★ 4,9 · 23 ocene

**8.000 RSD ukupno**
`4.000 RSD / osoba · 2 osobe`

Danas · 17:00–19:00

`„Dolazimo kombijem.“`

optional mark:
`Najniža cena po osobi`

Whole card tap.

Ako selectable:
small bottom action može:
**Pregledajte prijavu**

Ne `Izaberite` direktno iz dense card-a.
Izbor se potvrđuje tek u full offer sheet-u.

# 718. ŠTA CARD NE PRIKAZUJE

Ne prikazivati:
- tools inventory;
- vehicles inventory;
- self-declared skill labels;
- AI score;
- acceptance rate;
- public applicant rank;
- alternative time za new-flow application;
- full note.

Task-specific relevant profile trust ide u candidate detail/public profile.

# 719. TERMIN NA CARD-U

Za novu finalnu Application:
candidate prihvata task schedule.

Card zato kaže:

Fixed:
`Danas · 17:00–19:00`

Flexible:
`Ove nedelje`

Remote:
`Rok: petak do 18:00`

Ne:
`Može: drugi termin`

za novi flow.

## Legacy compatibility

Stara application može imati proposed start/end.

Tada:
card može jasno označiti:
`Stara prijava · predložen termin 18:00–21:00`

Pre selection-a taj legacy termin mora biti eksplicitno prikazan u confirmation-u.

Ne sakriti ga i ne pretvarati u task termin bez potvrde.

# 720. STANJE PRIJAVE NA REQUESTER STRANI

Selectable new:
`Poslata`

Ako viewed write potvrđen:
`Viđena`

Selected:
`Izabrana`

Withdrawn:
`Povučena`

Full/not selected:
`Nije izabrana` kada projection to autoritativno zna.

Stale:
`Trenutno nije dostupna za izbor`

Overfill:
`Pokriva više mesta nego što je preostalo`

Calendar conflict:
`Termin se preklapa sa drugim Dogovorom`

Ne prikazivati raw server states.

# 721. TAP CANDIDATE — FULL OFFER SHEET

Tap Marko:

ProductSheet title:
**Marko P.**

Top person row:
[avatar 56]
★ 4,9 · 23 ocene
**Pogledajte profil →**

Ispod status.

Then:

**8.000 RSD ukupno**
`4.000 RSD / osoba · 2 osobe`

Grouped facts:

**Dolazi**
2 osobe

**Termin**
Danas · 17:00–19:00

Section:
**Poruka**
Dolazimo kombijem.

Ne tools/vehicle block u finalnom new-flow sheet-u.

# 722. PUBLIC WORKER PROFILE IZ CANDIDATE SHEET-A

Tap `Pogledajte profil`.

Public worker sheet:

- avatar;
- ime;
- worker rating/count;
- completed worker collaborations;
- reliability ako public + dovoljno uzorka;
- capabilities;
- general area / remote;
- description;
- verified license facts.

Ne:
- email;
- phone;
- exact location;
- application-specific price;
- other task applications.

Safety:
report/block.

Close:
vraća candidate offer sheet.

# 723. CANDIDATE NIJE SELECTABLE

Sheet i dalje može da se otvori.

Reason na vrhu:

🟠 `Prijava trenutno nije dostupna za izbor.`

ili:
`Pokriva više mesta nego što je još potrebno.`

Action:
**Osvežite prijave**

Ako server daje actionable reason:
Raspored / task state / profile info može biti explained.

Nema zelenog `Izaberite` dugmeta ako server ne dozvoljava izbor.

# 724. MULTI-SEAT — IZBOR CELE PRIJAVE

Final hard rule:
**prijava se bira cela.**

Marko se prijavio za:
2 osobe.

Requester ne može na Selection confirmation-u da kaže:
`Uzeću samo 1 od njegove 2`.

Ako treba 1, worker mora imati prijavu koja pokriva 1.

Razlog:
cena, scope i njegov tim čine jednu immutable application ponudu.

# 725. PREOSTALA MESTA SE PROMENE

Task:
3 mesta.

Marko:
2 osobe.

Nikola već selected:
2 mesta.

Remaining:
1.

Markova application za 2:
ne može biti izabrana.

Status:
`Pokriva 2 osobe, a ostalo je 1 mesto.`

Ne nuditi partial selection.

# 726. SELECTION CONFIRM — CENTRIRANI DIALOG

Candidate sheet primary:
**Izaberite**

Tap ne šalje odmah.

Dialog:

# Izabrati Marka?

Prihvatate:

**8.000 RSD ukupno**

**2 osobe**

**Danas · 17:00–19:00**

Quiet:
**Prihvatanjem ove prijave nastaje Dogovor.**

Ako fixed worker conflict mora da se recheckuje:
`Pre potvrde proveravamo da li termin i dalje može da se prihvati.`

Primary:
**Izaberite**

Secondary:
**Odustanite**

# 727. OFFERS SELECTION CONFIRM

Marko:
8.000 total, 2 people.

Dialog:

**8.000 RSD ukupno**
`4.000 RSD / osoba · 2 osobe`

Ne prihvatati samo derived per-person.
Canonical Agreement price ostaje exact accepted application total/basis semantics.

# 728. LEGACY PROPOSED TERM CONFIRM

Ako je stara application imala alternative proposed exact term:

Dialog mora reći:

**Predloženi termin prijave**
18:00–21:00

**Termin zadatka**
17:00–20:00

I vrlo jasno:
`Ovom starijom prijavom izbor prihvata predloženi termin 18:00–21:00.`

Ako product/backend želi da legacy proposal više ne bude selectable:
onda server mora prevesti je u stale review, ne UI da ga prećuti.

# 729. SELECTION WRITE

Command se veže za:
- need id;
- exact need revision;
- response id;
- response version;
- response hash;
- exact covered slots;
- idempotent client request id.

Current architecture — KEEP.

Server atomically:
- rechecks selectability;
- rechecks remaining slots;
- rechecks worker calendar;
- creates Selection;
- creates bilateral Agreement from exact application snapshot.

# 730. SELECTION UNKNOWN OUTCOME

Ako write ishod nije potvrđen:

Candidate sheet se zaključava.

**Ne znamo da li je izbor potvrđen.**

Frozen terms ostaju.

Primary:
**Proverite da li je izabrano**

Ne birati drugog kandidata dok isti coverage može biti u nepoznatom stanju.

Ne šalje se novi selection id.

# 731. SELECTION CONFLICT / REFUSAL

Ako server vrati:
worker calendar conflict:

**Termin više nije slobodan**

`Ova prijava trenutno ne može da se izabere.`

→ Osvežite prijave

Ako Need full:
**Sva mesta su u međuvremenu popunjena.**

Ako stale revision:
**Zadatak ili prijava su promenjeni.**
→ Osvežite prijave.

Ako overfill:
jasno remaining vs application people.

# 732. SUCCESS — DOGOVORENO

Po potvrđenom server receipt-u:

full moment:

[Vi]      [Marko]

**Dogovoreno!**

**Selidba stana**

Danas · 17:00–19:00

8.000 RSD ukupno

2 osobe

Primary:
**Otvorite Dogovor**

Ako task i dalje ima remaining coverage:

Secondary:
**Izaberite još nekoga**

Copy:
`Još 1 mesto je slobodno.`

Ne:
`Izaberi sledećeg pomoćnika (još 1 mesto)` kao preduga tehnička CTA.

# 733. POSLE SUCCESS-A — TASK COVERAGE

Primer:
required 3;
Marko covers 2;
pre toga 0.

After success:
2/3.

Candidate list/Owner task osvežavaju authoritative coverage.

Ako remaining 1:
candidate applications covering 2 postaju non-selectable.

Group chat još ne nastaje dok nema najmanje dva distinct selected worker accounts.

# 734. UPORedI — FINALNI MODEL

Current code pokušava da prikazuje comparison columns nad celom listom.

Final UX na telefonu:
**Uporedite** treba da bude deliberate comparison, ne drugi layout svih cards.

Flow:

1. tap `Uporedite`;
2. izaberite do 2 kandidata;
3. otvori comparison surface.

Razlog:
na 360dp dve pune kandidat kolone su previše guste;
na jednom stupcu `Uporedi` više nema smisla.

## 734.1 Compare picker

Rows:
☐ Marko
☐ Nikola
☐ Petar

Max 2.

Primary:
**Uporedite 2 prijave**

## 734.2 Compare screen/sheet

Dve kolone kada širina dozvoljava;
na narrow phone:
vertikalne sekcije sa istim row labels.

Rows:

- Ocena
- Cena ukupno
- Cena po osobi
- Ljudi
- Termin
- Poruka

Ne:
tools/vehicles;
AI score.

Each candidate:
**Otvorite prijavu**

# 735. COMPARISON NA MY_PRICE TASKU

Cena je requester-defined.

Zato compare ne treba da ističe:
`Najniža cena`

ako je svima deterministička.

Fokus:
- people coverage;
- rating/trust;
- note;
- availability/term acceptance;
- public profile.

# 736. EMPTY CANDIDATES

**Još nema prijava**

No primary CTA.

Requester je već objavio task.

Quiet:
`Nove prijave će se pojaviti ovde.`

Pull refresh ostaje.

Ne nuditi da requester sam pravi prijavu.

# 737. PAGINATION I SORT

Default server order:
arrival.

Dok nisu sve relevantne prijave učitane:
- ne tvrditi `Najniža cena`;
- ne tvrditi `Najbolja ocena`;
- ne raditi client global sort po samo prvoj strani.

Ako user traži price/rating sort:
ili:
1. učitati bounded complete set kao current code,
ili
2. kasnije server-side sort.

UI tokom toga:
`Učitavamo prijave za poređenje…`

# 738. VIEWED STATE

Otvaranje candidate offer sheet-a može serveru zapisati viewed.

Tek kada receipt potvrdi:
chip može `Viđena`.

Ako mark-view unknown:
ne mora da blokira izbor.
`Poslata` je i dalje istinito.

Ne izmišljati viewed samo zato što je lokalni sheet otvoren.

# 739. SAFETY

Candidate public profile:
**Prijavite ili blokirajte osobu**

Safety context nosi task id.

Blocking kandidata:
ne treba automatski da znači selection/cancellation write.

Ako već postoji Agreement:
active Agreement resolution rules imaju prioritet.

# 740. KANDIDATI — VISUAL STANDARD

Root:
light surface.

Candidate cards:
person-first.

Avatar:
48.

Name + rating.

Price strong on right / next line on large text.

Term + people as simple facts.

Note preview max 2 lines.

One optional comparative mark.

No card soup:
12dp rhythm, minimal elevation.

Candidate detail:
sheet over list.

Selection:
centered confirm dialog.

Success:
short branded Dogovoreno moment.

# 741. KONKRETAN ROOT PRIMER

← **Prijave**                              [Uporedite]

**Selidba stana**
2/3 dogovoreno · još 1 mesto                →

**5 prijava**                    [Pristigle ▾]

[Marko]
**Marko P.**
★ 4,9 · 23 ocene

**8.000 RSD ukupno**
4.000 RSD / osoba · 2 osobe

Danas · 17:00–19:00

„Dolazimo kombijem.“

● Najniža cena po osobi

────────────────

[Nikola]
**Nikola S.**
★ 5,0 · 8 ocena

**5.000 RSD ukupno**
5.000 RSD / osoba · 1 osoba

Danas · 17:00–19:00

# 742. KONKRETAN CANDIDATE SHEET

×  **Marko P.**

[avatar]
★ 4,9 · 23 ocene
**Pogledajte profil →**

`POSLATA`

**8.000 RSD ukupno**
4.000 RSD / osoba · 2 osobe

**Dolazi**
2 osobe

**Termin**
Danas · 17:00–19:00

**Poruka**
Dolazimo kombijem.

FOOTER:
**Izaberite**

# 743. CODE DELTA — CANDIDATES / SELECTION

## KEEP
- requester-owned candidate read;
- need revision coherence;
- application version/hash;
- viewed receipt;
- paging;
- destination by response id;
- public profile sheet;
- optional work-trust read;
- safety;
- idempotent selection;
- readback unknown outcome;
- atomic Agreement creation;
- success moment.

## MODIFY
- price sort → per-person/per-slot;
- price comparative mark → `Najniža cena po osobi`;
- MY_PRICE hides meaningless price ranking;
- candidate cards remove tool/vehicle row;
- new-flow term always task accepted schedule;
- formal copy;
- `Izaberi` → `Izaberite`;
- cleaner success secondary CTA;
- comparison flow becomes explicit max-2 compare;
- role-scoped worker reputation.

## LEGACY
- old proposed interval stays visible and explicit until migrated/resolved.

## P0
1. candidate comparable price sort;
2. multi-seat whole-application selection preserved;
3. multi-seat application validity is rechecked against remaining slots and the exact application snapshot;
4. role-scoped reputation before ratings become trust authority.

# 744. CANDIDATES / SELECTION — TEST MATRIX

1. no candidates;
2. one;
3. 20+paged;
4. OFFERS 1 vs 2 people price sort;
5. price ties;
6. MY_PRICE no price sort;
7. no rating;
8. rating tie/count tie;
9. selectable;
10. viewed;
11. stale;
12. overfill;
13. calendar conflict;
14. withdrawn;
15. selected;
16. full;
17. candidate detail;
18. public profile;
19. safety;
20. compare 2;
21. compare large text;
22. selection confirm;
23. selection double tap;
24. selection unknown;
25. readback selected;
26. stale need during select;
27. remaining shrinks;
28. whole application covers 2;
29. legacy proposed term;
30. success remaining >0;
31. success task full;
32. 360dp;
33. text scale 1.3.

# 745. PRAVILO OD SADA — SVAKI EKRAN SE ZAKLJUČAVA TEK POSLE 4 PROVERE

Od ovog mesta Master više nije samo spisak ideja.

Svaki naredni screen contract mora proći četiri izvora istine:

## 1. Stvarni kod
Proveriti:
- šta stvarno postoji;
- koje state-ove backend autoritativno zna;
- koji write ima recovery/idempotency;
- šta je legacy;
- šta je već dobro i treba KEEP.

## 2. Stvarni UI / screenshot / Design Lab
Proveriti:
- postojeći USKOČI vizuelni DNK;
- trenutni spacing/hierarchy;
- realne device scene;
- large-text / empty / error / loading / long-content fixtures.

Ne izmišljati novi vizuelni jezik ako postojeći sistem već ima dobru osnovu.

## 3. Product logika celog APK-a
Svaki ekran mora da se uklapa u:
- jedan nalog / dve mogućnosti;
- Početna / Zadaci / Dogovori / Poruke;
- Task → Application → Selection → Agreement → Completion → Rating;
- privacy / support / recovery;
- nema duplih mentalnih modela.

## 4. Krajnji korisnički cilj
Za svaki ekran mora se odgovoriti:
- Zašto je korisnik ovde?
- Šta prvo treba da vidi?
- Šta može da uradi?
- Šta se otvara posle svakog tapa?
- Kako izlazi?
- Šta ako nema podataka?
- Šta ako read padne?
- Šta ako write ishod nije poznat?
- Šta se menja na malom telefonu / large text?

Tek tada ekran dobija oznaku:
**FINALNI PRODUCT/UX CONTRACT**

# 746. FINALIZACIJA CELOG APK-A — ŠTA ZNAČI GOTOV PLAN

Plan nije gotov samo kada su nabrojani screenovi.

Gotov je kada za svaku consumer surface imamo:
1. svrhu;
2. sadržaj od vrha do dna;
3. hijerarhiju;
4. sve akcije;
5. navigation destination;
6. Back behavior;
7. loading;
8. empty;
9. error;
10. stale;
11. unknown outcome;
12. permissions;
13. responsive/large text;
14. code delta KEEP/MODIFY/RETIRE/NEW;
15. relevantni server authority;
16. visual QA scene.

Na kraju se pravi jedna APK coverage matrica:
- ekran;
- route;
- design source;
- server/read authority;
- write authority;
- final visual status;
- blocker;
- test proof.

Nijedan consumer ekran ne ostaje „videćemo kasnije“.

# 747. OWNER TASK — MOJ ZADATAK POSLE OBJAVE

Ovo je centralni requester ekran njegovog sopstvenog zadatka.

Otvara se:
- odmah posle uspešne objave;
- iz `Moji zadaci`;
- iz relation state-a `Vaš zadatak`;
- iz notification-a;
- iz Candidate/Agreement konteksta kada treba parent task.

Mentalni model:
**„Šta se trenutno dešava sa mojim zadatkom i šta treba sledeće da uradim?“**

Ne:
- kopija Public Task detail-a;
- dashboard sa 12 KPI kartica;
- spisak backend statusa.

# 748. OWNER TASK — HEADER

Levo: Back.

Title u chrome-u tek kada veliki task title skroluje van ekrana.

Desno:
- edit icon kada je task zaista editable;
- draft može imati delete icon uz potvrdu.

Rare/lifecycle radnje ne stoje sve stalno na vrhu.

## 748.1 Edit

Tap edit:
otvara AI razgovor za izmenu.

Za published task:
`Izmene pripremate u razgovoru. Trenutna objava ostaje aktivna dok novu verziju ne potvrdite.`

Ne direktan paralelni form.

# 749. OWNER TASK — FINALNI REDOSLED

Od vrha:
1. status / current state;
2. veliki task title;
3. task decision summary;
4. šta sada treba uraditi;
5. coverage + applications;
6. saradnje/Dogovori;
7. task photos;
8. opis i requirements;
9. Q&A;
10. mapa/place;
11. management/lifecycle.

# 750. OWNER TASK — HUMAN STATE

## Nacrt
**Nacrt**

## Objavljen i čeka prijave
**Tražite ljude**

## Ima prijave
**Stigle su prijave**

## Delimično pokriven
**2/3 dogovoreno**

## Potpuno pokriven
**3/3 dogovoreno**

## Preostala potraga zatvorena
**Potraga za preostalim mestima je zatvorena**

## Saradnje u toku
**Saradnje su u toku**

## Završeno
**Zadatak je završen**

## Otkazano
**Zadatak je otkazan**

Ne prikazivati internal Need state kod.

# 751. OWNER TASK — SUMMARY

Isti task facts kao javni detail, ali owner wording.

Primer:

**12.000 RSD ukupno**

**3 osobe**

**Danas · 17:00–20:00**

**Liman, Novi Sad**

To su Task facts, ne zbir Agreement cena.

Ako OFFERS:
**Tražite ponude**

# 752. OWNER TASK — GLAVNI STATE BLOCK

Jedan block odmah posle summary-a odgovara:
**„Šta treba sada da uradim?“**

## 752.1 Objavljen, 0 prijava

**Čekate prijave**

`Zadatak je objavljen i vidljiv odgovarajućim korisnicima.`

Nema lažnog primary CTA-a.

Ako >24h i server zna, prikazuje se help block sa stvarnim akcijama.

## 752.2 Ima prijave

**3 prijave čekaju pregled**

Primary:
**Pogledajte prijave**

Applicant faces mogu da se vide kada owner read to stvarno ima.

## 752.3 Delimično pokriven

**2/3 dogovoreno**

`Još je potrebna 1 osoba.`

Ako postoje prijave:
**Pogledajte prijave**

Ako nema:
`Potraga je otvorena.`

## 752.4 Potpuno pokriven

**3/3 dogovoreno**

`Sva potrebna mesta su pokrivena.`

Primary:
**Otvorite saradnje**

## 752.5 Preostala potraga zatvorena

**Potraga je zatvorena**

`Postojeći Dogovori ostaju aktivni.`

Ako server dozvoljava:
**Ponovo tražite ljude**

## 752.6 Recovery

Ako reopen/close/cancel ishod nije potvrđen:
exact recovery state ostaje na vrhu.

Ne dozvoljavati novu konfliktnu lifecycle komandu.

# 753. COVERAGE — JASNO, ALI NE KPI DASHBOARD

Primer:

**2/3 dogovoreno**

● ● ○

`Još 1 mesto`

Coverage nije isto što i:
- broj prijava;
- broj worker naloga;
- broj saradnji.

Ove stvari se ne sabiraju i ne prikazuju kao jedna metrika.

Cancelled saradnja ne ostaje kao pokrivena.

# 754. PRIJAVE BLOK

Ako ima selectable prijava:

**Prijave**

`3 prijave za izbor · ukupno 5`

[avatar stack]

**Pogledajte prijave**

Tap:
Candidates screen.

Ako nema:
ne prikazivati mrtav row `Prijave · 0` samo zato što komponenta postoji.

# 755. SARADNJE / DOGOVORI BLOK

Ako coverage >0:

**Saradnje**

[Marko] [Nikola]

`2 aktivne saradnje`

**Otvorite saradnje**

Tap:
task-group workspace.

Ako postoji tačno jedna saradnja i nema potrebe za group management interstitial-om:
može direktno bilateralni Dogovor.

## Code gap

Current owner screen uglavnom vodi ka globalnim `Moji Dogovori`.

Finalno treba task-filtered destination za saradnje ovog konkretnog zadatka.

# 756. OWNER TASK — FOTOGRAFIJE

Fotografije idu rano, posle state/coverage dela i pre dugog opisa.

Owner može imati:
**Fotografije · 3**
`Upravljajte`

Tap:
task photo manager.

Published-task media edit mora poštovati version/publish contract, ne mutirati javnu verziju iza leđa review-u.

# 757. OPIS / REQUIREMENTS

**O zadatku**

opis.

**Važno za ovaj zadatak**

samo relevantni requirement facts.

Owner view ne prikazuje dodatna tehnička polja koja javni korisnik nikad ne razume.

# 758. Q&A

Owner prvo vidi pending:

🟠 `2 pitanja čekaju odgovor`

**Odgovorite**

Ispod answered public questions.

`Prikažite sva pitanja` → full owner Q&A.

Ako odgovor menja material task uslov, product ne sme da zaobiđe task edit/version flow.

# 759. MESTO

**Mesto zadatka**

Approximate public map + privacy note.

Owner mora jasno da vidi šta javnost vidi.

Tačna privatna adresa se ne prikazuje kao public map fact.

# 760. MANAGEMENT ACTIONS

Prikazuju se samo kada trenutni lifecycle state to dozvoljava:

- Izmenite zadatak
- Zatvorite preostalu potragu
- Ponovo otvorite potragu
- Otkažite zadatak
- Obrišite nacrt

Ne sva odjednom.

# 761. ZATVARANJE PREOSTALE POTRAGE

Samo kada:
- bar jedan slot već pokriven;
- postoje preostala mesta;
- search nije već zatvoren.

Confirm:

**Ne tražiti više nikoga?**

`Zatvorićemo potragu za preostalim mestima. Postojeći Dogovori i prihvaćeni uslovi ostaju nepromenjeni.`

Success:
coverage ostaje ista.
Search closed.

# 762. PONOVO OTVARANJE POTRAGE

Ako postoje missing slots:

**Nedostaje još 1 osoba**

Primary:
**Ponovo tražite ljude**

Review:
`Ponovo ćemo otvoriti potragu samo za nedostajućim mestima. Postojeći Dogovori ostaju nepromenjeni.`

Current `NeedSearchRecoveryController` — KEEP.

# 763. OTKAZIVANJE CELOG TASKA

Dozvoljeno samo kada lifecycle pravila ne bi implicitno prekinula postojeće Agreement obaveze.

Ako coverage=0:
**Otkažite zadatak**

Posledice:
- više ne prima prijave;
- pending applications se zatvaraju;
- task ostaje u previous history.

Ako coverage>0:
ne nuditi task cancel kao shortcut za prekid saradnji.

Saradnje se otkazuju bilateralno.

# 764. DRAFT

Draft Owner Task:

**Nacrt**

State block koristi stvarni publication readiness.

Primary prema readiness-u:
- Nastavite razgovor
- Pregledajte zadatak
- Osvežite zadatak
- bez CTA-a kada je jedino ispravno čekati processing.

Edit → AI conversation.
Delete → confirm.

# 765. NO APPLICATIONS 24H HELP

Current koncept ima smisla.

Finalno:

**Nema prijava već 24 sata**

Moguće stvarne akcije:
- Dodajte fotografiju
- Proširite termin
- Podelite zadatak
- Izmenite zadatak

Ne tvrditi da će to garantovano doneti više prijava.

# 766. SEARCH CLOSED + EXISTING AGREEMENTS

Primer:

**2/3 dogovoreno**

`Potraga za preostalim mestom je zatvorena.`

**Saradnje**
Marko · 1
Nikola · 1

**Otvorite saradnje**

Secondary:
**Ponovo tražite 1 osobu**

# 767. POSLE OTKAZANE SARADNJE

Pre:
3/3.

Marko pokriva 2.
Nikola 1.

Marko otkazan:
1/3.

Owner Task:

**1/3 dogovoreno**

`Nedostaju još 2 osobe.`

Ako server auto-reopens search:
`Potraga je ponovo otvorena.`

Ako manual:
**Ponovo tražite ljude**

Nikolin Agreement ostaje.

# 768. COMPLETION

Parent Task nema veliko `Završi zadatak` dugme.

Bilateralne saradnje se završavaju pojedinačno.

Summary može:

**Završetak**

Marko
✓ Završeno

Nikola
🟠 Čeka Vašu potvrdu

**Otvorite saradnje**

Parent završen tek kada completed coverage dostigne pravilo required slots.

# 769. RATINGS

Owner Task može imati samo summary:
`1 saradnja čeka ocenu`
→ **Otvorite saradnje**

Rating ostaje bilateralni flow.

# 770. LOADING / ERROR / STALE

## First load
**Učitavamo zadatak…**
`Proveravamo stanje zadatka i sačuvane radnje.`

## Error
**Zadatak nije dostupan**
`Pokušajte ponovo.`

## Stale
Content ostaje.
`Prikazani su poslednji učitani podaci.`

## Lifecycle recovery
Retained cancel/delete/reopen command ostaje vidljiv i kada parent read privremeno padne.

# 771. OWNER TASK — PRIMER 0 PRIJAVA

`OBJAVLJEN`

**Unos ormara na treći sprat**

**12.000 RSD ukupno**
3 osobe
Danas · 17:00–20:00
Liman, Novi Sad

**Čekate prijave**

0/3 dogovoreno
○ ○ ○

[photos]

**O zadatku**
...

**Pitanja i odgovori**
Još nema pitanja.

**Mesto zadatka**
[map]

**Izmenite zadatak**
**Otkažite zadatak**

# 772. OWNER TASK — PRIMER PRIJAVE

**STIGLE SU PRIJAVE**

**Selidba stana**

**3 prijave čekaju pregled**

[Marko] [Nikola] [Petar]

**Pogledajte prijave**

0/3 dogovoreno
○ ○ ○

# 773. OWNER TASK — PRIMER PARTIAL

**2/3 dogovoreno**

● ● ○

`Još je potrebna 1 osoba.`

**2 prijave čekaju pregled**
→ **Pogledajte prijave**

**Saradnje**
[Marko] [Nikola]

2 aktivne saradnje

**Otvorite saradnje**

# 774. OWNER TASK — PRIMER FULL

**3/3 dogovoreno**

● ● ●

`Sva potrebna mesta su pokrivena.`

**Otvorite saradnje**

Nema Candidates CTA-a ako više nema mesta za izbor.

# 775. OWNER TASK — CODE DELTA IZ STVARNOG KODA

## KEEP
- owner-only read;
- focus/account fences;
- refresh timeout;
- publication readiness;
- edit through AI conversation;
- Need version authority;
- Q&A inline;
- approximate map;
- task photos;
- durable lifecycle controller;
- durable remaining-search recovery;
- no-applications 24h helper;
- close remaining search semantics;
- cancel/delete distinction;
- stale-data behavior;
- scroll-title handoff.

## MODIFY
- hierarchy around current state/coverage;
- photos earlier;
- applications and collaborations stronger;
- global `Moji Dogovori` link → task-filtered collaboration workspace;
- formal copy;
- clearer coverage;
- lifecycle rows only when relevant.

## NEW / P1
- task-filtered Agreement/group destination where current read/navigation is insufficient.

## RETIRE
- standalone Arhiva mental model;
- app-mode assumptions;
- duplicated task status facts;
- management clutter unrelated to current lifecycle.

# 776. OWNER TASK — TEST MATRIX

1. draft ready;
2. draft blocked;
3. photos processing;
4. publish success;
5. published 0 applications;
6. 24h helper;
7. 1 application;
8. 5 applications;
9. partial coverage;
10. full coverage;
11. remaining search closed;
12. reopen;
13. close unknown;
14. reopen unknown;
15. one Agreement cancelled;
16. multiple Agreements;
17. child completion pending;
18. parent completed;
19. Q&A none/pending/answered;
20. task photos;
21. route geography;
22. remote;
23. lifecycle cancel;
24. delete draft;
25. lifecycle unknown;
26. stale snapshot;
27. full error;
28. large text;
29. 360dp.

> **PRETVORENO U KANON:** cilj i vredne smernice očuvani; za finalnu izvršnu kompoziciju v. S01–S18 iznad.

# 777. KRAJNJI CILJ — FINALNA IDEJA CELOG APK-A

Kada screen-by-screen pass završi, radi se završni horizontalni pass kroz ceo APK.

## Navigacija
Da li svaki Back vodi gde korisnik očekuje.

## Dupliranje
Da li ista funkcija postoji na dva mesta bez razloga.

## Terminologija
Jedna ista stvar se svuda zove isto:
- Dogovor;
- saradnja;
- prijava;
- ponuda;
- zadatak;
- raspored.

## CTA
Jedna glavna radnja po stanju.

## Trust
Rating/reputation samo tamo gde backend stvarno zna.

## Privacy
Approximate/public vs exact/private strogo razdvojeno.

## Recovery
Svaki write ima:
- pending;
- success;
- conclusive failure;
- unknown outcome/readback.

## Visual
Isti:
- spacing;
- radii;
- icons;
- headers;
- sheets;
- cards;
- states;
- bottom nav.

## Accessibility
- 360dp;
- ~430dp;
- text scale 1.0 / 1.15 / 1.3;
- screen reader;
- Reduce Motion;
- keyboard.

Tek tada imamo:
**krajnju ideju i finalni plan kompletnog APK-a**, dovoljno precizan da production tim ne mora da izmišlja UX tokom kodiranja.

# 778. MOJI ZADACI — FINALNI ROOT EKRAN

Ovo je owner lista sopstvenih zadataka.

Otvara se iz:
- Početna → Moji zadaci;
- Profil → Moji zadaci;
- lifecycle success / prethodni task;
- notification fallback kada je owner context.

Mentalni model:
**„Šta se dešava sa mojim zadacima?“**

Ne:
- još jedan marketplace;
- još jedna Dogovori lista;
- dashboard svih status kodova.

# 779. HEADER

← **Moji zadaci**

Ako ekran dođe kao pushed surface:
Back.

Ako se koristi kao root-style owner collection iz Početne:
profil avatar može ostati prema postojećem shell patternu.

Filter control:
**Filteri**

Nema floating `+` preko kartica.

Nova objava ostaje:
- Početna → Objavite zadatak;
- empty state inline CTA.

# 780. GLAVNI PRIKAZ — GRUPE, NE TABOVI

Current `MarketplacePresentation` ide u dobrom smeru:
**grupe po trenutnoj fazi**, bez glavnih tabova.

Finalne grupe:

## Čeka Vas
Taskovi gde owner ima konkretnu akciju:
- prijave čekaju izbor;
- možda task-level recovery koje traži owner potvrdu.

## Objavljeni
Taskovi koji traže ljude i trenutno ne čekaju owner izbor.

## Dogovoreno / U toku
Taskovi sa pokrivenim mestima / aktivnim saradnjama.

Grupe se prikazuju samo kada imaju sadržaj.

Nema praznog heading-a.

# 781. REDOSLED GRUPA

1. **Čeka Vas**
2. **Objavljeni**
3. **Dogovoreno / U toku**

Razlog:
owner prvo vidi radnju koju treba da uradi.

Ne sortirati prvo po backend enum-u.

Unutar grupe:
server/list order ostaje authority osim ako finalni product contract definiše drugačije.

# 782. NACRTI / PRETHODNI ZADACI

Na dnu aktivne liste ostaju dva sekundarna ulaza:

**Nacrti** →

**Prethodni zadaci** →

Final user-facing reč:
**Prethodni zadaci**

ne generičko `Istorija` gde god možemo biti konkretniji.

Prethodni sadrže:
- završene;
- otkazane;
- istekle.

Drafts i previous nisu glavni tabovi aplikacije.

# 783. OWN TASK CARD — FINALNA ANATOMIJA

Current `OwnTaskCard` ima dobar temelj i ostaje mnogo toga.

Kartica:

status / attention samo ako group heading već ne kaže isto;

**Selidba stana**

**12.000 RSD ukupno**

Liman, Novi Sad

Danas · 17:00–20:00

`2/3 dogovoreno`

I jedna sledeća relevantna činjenica:
- `3 prijave čekaju pregled`
- `Još nema prijava`
- `Potraga je zatvorena`

Cela kartica:
→ Owner Task.

Ako prijave zaista čekaju izbor:
card footer:
**Pogledajte prijave · 3**

Tap footer:
Candidates.

# 784. ŠTA OWN TASK CARD NE TREBA DA RADI

Ne prikazivati:
- full description;
- requester identity — to sam ja;
- task-specific requirement inventory;
- tools/vehicles;
- Q&A count ako nije sledeća važna radnja;
- duplicate state chip + duplicate group title;
- više CTA dugmadi.

Current `sectionSays` princip je dobar:
ako group već kaže state, card ga ne ponavlja.

# 785. `ČEKA VAS` GRUPA

Primer:

**Čeka Vas · 2**

**Selidba stana**
12.000 RSD ukupno
Danas · 17–20
0/3 dogovoreno

**3 prijave čekaju pregled** →

---

**Košenje dvorišta**
Traži ponude
Ove nedelje

**1 prijava čeka pregled** →

Final copy formal:
`Čeka Vas`, ne `Čeka tvoj izbor`.

# 786. OBJAVLJENI

Primer:

**Objavljeni · 2**

**Unos ormara**
6.000 RSD ukupno
Liman
Sutra · 10–12

`Još nema prijava`

Task sa >24h no applications i realnim helper akcijama može imati small attention cue, ali ne prelazi automatski u `Čeka Vas` ako nijedna akcija nije obavezna.

# 787. DOGOVORENO / U TOKU

Primer:

**Dogovoreno · 1**

**Selidba stana**
2/3 dogovoreno
Danas · 17–20

`2 aktivne saradnje`

Tap:
Owner Task.

Ako current time i exact task window daju pošten `U toku` signal:
može heading/state `U toku`.

Ali task-level window nije uvek Agreement-level termin, zato flexible task ne postaje `U toku` samo na osnovu parent schedule-a.

Current `ownTaskStanding` ovo već pažljivo tretira — KEEP.

# 788. NACRTI

Tap `Nacrti`:
header:
← **Nacrti**

Cards:
- title;
- draft price/basis;
- place/mode;
- schedule;
- people requirement.

Card tap:
Owner Task draft.

Empty:
**Nemate nacrt.**

No new-task CTA required ovde; Početna/Back već nude pravi ulaz.

# 789. PRETHODNI ZADACI

Tap `Prethodni zadaci`:
header:
← **Prethodni zadaci**

Mogući filter chips/sheet:
- Sve
- Završeni
- Otkazani
- Istekli

Ne mora od prvog MVP-a ako količina mala.

Cards nose jasan terminal status:
- Završen
- Otkazan
- Istekao

Tap:
read-only/terminal Owner Task.

Ne vraćati staru standalone `Arhiva` navigaciju.

# 790. FILTERI — MOJI ZADACI

Current filter sheet ima:
- search;
- price mode;
- attention checkbox.

Finalno ostaje, ali copy i funkcija se pojednostavljuju.

## Pretraga
`Pretražite svoje zadatke`

## Cena
- Svi načini
- Navedena cena
- Traži ponude

## Attention
Final label:
**Samo ono što čeka mene**

Ne:
`Čeka tvoj izbor`.

Kada je uključeno:
server scope `WAITING` ostaje dobar authority.

# 791. FILTERI — APPLY

Footer:
**Prikažite N zadataka**

ako exact count poznat.

Ako paging/refinement nije kompletan:
**Prikažite zadatke**

Secondary:
**Poništite filtere**

Ne obećavati count samo iz trenutno učitane prve strane.

# 792. FIRST EMPTY STATE

Ako nalog nikad nije objavio task:

2.5D publish art.

**Još nemate zadatak**

`Recite šta Vam treba. Zadatak ćete pregledati pre objave.`

Primary:
**Objavite zadatak**

Quiet:
**Pogledajte zadatke**

To je dobar current first-encounter koncept, samo formalizovati copy.

# 793. NEMA AKTIVNIH, ALI IMA NACRTA/PRETHODNIH

Ne veliki first-time empty.

Compact:
**Nema aktivnih zadataka**

Ispod:
- Nacrti · N
- Prethodni zadaci · N

Primary `Objavite novi zadatak` može postojati samo ako ne gura postojeće destinations ispod fold-a.

# 794. PAGINATION

Current server paging/count architecture — KEEP.

Važno:
- group count se prikazuje samo kada exact;
- drafts/previous counts dolaze iz server counts;
- `Prikažite još` pre secondary set rows;
- page error ne briše već učitane cards.

Final copy formal.

# 795. REFRESH / STALE

Pull refresh:
lista ostaje.

Ne dizati veliki global spinner preko cards.

Ako refresh padne i snapshot postoji:
`Prikazani su poslednji učitani zadaci.`

Filter/search state ostaje.

# 796. DEEP LINK / NOTIFICATION

Notification za owner task:
otvara exact Owner Task.

Notification za application:
može da otvori Candidates i exact application.

Back:
Owner Task → Moji zadaci ili source context.

Ne resetovati kolekciju/filter state bez razloga.

# 797. MOJI ZADACI — VISUAL STANDARD

Light warm ground.

Group heading:
17–18 strong.

Cards:
~200dp current compact density je dobar smer.

One card look sa Discovery family, ali owner card ima:
- task state/coverage;
- owner next action.

12dp card gap.
24dp group gap.

No floating FAB.

# 798. KONKRETAN PRIMER

← **Moji zadaci**                              [Filteri]

**Čeka Vas · 2**

**Selidba stana**
12.000 RSD ukupno
Liman · Danas 17–20
0/3 dogovoreno

**3 prijave čekaju pregled**                   →

--------------------------------

**Košenje dvorišta**
Traži ponude
Telep · Ove nedelje

**1 prijava čeka pregled**                     →


**Objavljeni · 1**

**Unos ormara**
6.000 RSD ukupno
Liman · Sutra 10–12

Još nema prijava


**Dogovoreno · 1**

**Montaža TV-a**
1/1 dogovoreno
Danas · 20:30–21:30

1 aktivna saradnja


**Nacrti · 2**                                 →
**Prethodni zadaci · 8**                       →

# 799. MOJI ZADACI — CODE DELTA

## KEEP
- current route/read guards;
- server paging;
- server counts;
- grouped active presentation;
- `OwnTaskCard` compact architecture;
- card footer direct-to-candidates;
- no floating +;
- first-time empty state;
- draft/history secondary sets concept;
- filters as sheet;
- exact counts only when complete;
- stale-card open guard.

## MODIFY
- `Čeka tvoj izbor` → `Čeka Vas` / `Samo ono što čeka mene`;
- `Istorija` → `Prethodni zadaci`;
- formal copy;
- active group naming/order aligned with whole APK;
- card next-line wording aligned with Owner Task;
- task collaboration summary when coverage>0.

## RETIRE
- standalone Arhiva;
- informal copy;
- duplicate state text between group and card.

# 800. MOJI ZADACI — TEST MATRIX

1. first user no tasks;
2. drafts only;
3. previous only;
4. no active + drafts/previous;
5. waiting applications;
6. published no applications;
7. partial coverage;
8. full coverage;
9. current exact window in progress;
10. flexible task not falsely in-progress;
11. closed search partial;
12. finished;
13. cancelled;
14. expired;
15. paging first page;
16. paging more;
17. paging error;
18. filter search;
19. price filter;
20. attention filter;
21. filter empty;
22. refresh error;
23. large text;
24. 360dp.


# 778. MOJ PROFIL — FINALNI EKRAN OD VRHA DO DNA

Ovo je account hub.

Mentalni model:
**„Ko sam na USKOČI-ju, kako me drugi vide, kako uskačem, šta sam radio i gde menjam nalog.“**

Profil ne sme da bude:
- drugi Settings ekran;
- worker-only ekran;
- requester-only ekran;
- zbir nepovezanih velikih kartica.

Jedan nalog ima obe mogućnosti.

---

# 779. PROFIL — HEADER

Header:
**Moj profil**

Back vraća na source:
- avatar sa Početne → Početna;
- avatar iz drugog root contexta → taj context;
- cold fallback → Početna.

Profil nije root bottom-nav tab, zato ima Back.

---

# 780. IDENTITY SURFACE

Na vrhu jedna identity surface.

Prikazuje:

[shared portrait]

**Miloš Šljivić**

`Jedan nalog · obe mogućnosti`

Mesto samo ako je zaista shared/account-safe činjenica.

Ne koristiti worker work-area grad kao da automatski znači mesto stanovanja.

## 780.1 Fotografija

Tap portrait:
**Profilna fotografija**

- Galerija
- Kamera
- Uklonite fotografiju

Jedna fotografija za requester i worker public face.

## 780.2 Ime

Shared account identity.

Menja se samo u:
**Lični podaci**

Radni profil ne održava drugo nezavisno ime.

Aktuelni Worker Profile kod već ide u ovom smeru — KEEP.

## 780.3 Current code gap

Profile hub i dalje primarno čita requester identity row i tek pada na worker row ako requester row ne postoji.

Final authority:
**account-level shared identity**.

To zahteva data migration/projection cleanup.

---

# 781. REPUTACIJA — DVE ULOGE, NE JEDAN PROSEK

Ispod identiteta ne prikazujemo jedan `AccountReputation`.

Finalno:

## Kao naručilac
★ 4,9
`12 ocena`

## Kao uskočer
★ 4,8
`23 ocene`

Ako role nema ocene:
`Još nema ocena`

Tap svake figure:
Ocene otvorene na toj ulozi.

## 781.1 Current code gap — P0 pre javnog trust authority-ja

Current hub koristi account-level reputation.

To je semantički pogrešno za marketplace sa dve uloge.

Requester ponašanje i worker ponašanje nisu ista reputacija.

Potrebno:
- role-scoped aggregate;
- role-scoped count;
- role-scoped public projection;
- blind-publication model pre javnog oslanjanja na rating.

---

# 782. PUBLIC PREVIEW

Action:
**Pogledajte kako Vas drugi vide**

Ako postoje obe javne uloge:
sheet:

**Kako želite da pogledate profil?**

- Kao naručioca
- Kao uskočera

Ako samo requester public profile postoji:
otvori direktno requester public sheet.

Ako worker profil nije ACTIVE:
worker public preview može biti:
- preview-only ako product želi da pokaže budući izgled;
- ili sakriven dok nije public.

Final recommendation:
**preview saved worker profile je dozvoljen owner-u i pre aktivacije**, ali jasno:
`Ovaj profil još nije javno aktivan.`

---

# 783. PROFIL — GROUPING UMESTO CARD SOUP-A

Current hub ima više velikih elevated destination kartica.

Finalno grupišemo.

## Uskačem

**Radni profil**
`Usluge, područje i dostupnost`

Attention dot ako:
- nema profila;
- DRAFT;
- required setup incomplete.

## Moje aktivnosti

**Moji zadaci**
`Objave i izbor saradnika`

**Moje prijave**
`Status prijava i odgovori`

**Moj raspored**
`Dogovori i dostupnost`

## Nalog i pomoć

**Podešavanja**
`Nalog, privatnost i obaveštenja`

**Pomoć i podrška**
`Odgovori i Vaši zahtevi`

Ne treba šest velikih floating kartica sa istom vizuelnom težinom.

---

# 784. RADNI PROFIL — MENTALNI MODEL

Mentalni model:
**„Šta nudim, gde mogu da uskočim i kada mi odgovara.“**

Radni profil nije CV.

Ne pravimo:
- inventar svakog alata;
- spisak vozila kao hard matching;
- stalnu veličinu ekipe;
- HR biografiju.

AI-first setup ostaje.

---

# 785. RADNI PROFIL — FIRST SETUP

Ako profil ne postoji:

[conversation art]

**Ispričajte čime se bavite**

`Koje zadatke želite da preuzimate, gde i kada Vam odgovara.`

`Razgovor možete nastaviti kasnije. Profil aktivirate tek kada pregledate podatke.`

Primary:
**Započnite razgovor**

AI conversation skuplja:
- usluge/capabilities;
- kratak opis;
- način rada;
- područje;
- dostupnost;
- relevantne licence/fakte.

Čovek pregleda pre aktivacije.

---

# 786. RADNI PROFIL — SAVED SCREEN

Redosled:

1. activation/status;
2. own public worker preview;
3. Usluge koje nudite;
4. Način rada;
5. Područje rada;
6. Dostupnost;
7. O Vama;
8. licence/verified facts kada postoje;
9. quiet info o tome na šta profil utiče;
10. edit through AI.

---

# 787. ACTIVATION STATUS

## Ne postoji
**Radni profil još nije podešen**

`Bez njega ne možete da se prijavite na zadatak.`

## Draft
**Radni profil je još nacrt**

Checklist:
- Usluge i ime naloga
- Područje rada ili Remote mode

Dostupnost nije obavezna za samo postojanje profila, ali poboljšava `Za mene` i notifications.

## Active
✓ **Profil je aktivan**

## Suspended
**Profil je trenutno suspendovan**

`Dok traje suspenzija, zadaci Vam se ne nude.`

Action:
**Obratite se podršci**

Ne izmišljati razlog ako server nije dao razlog.

---

# 788. ACTIVATION MINIMUM

Finalno:

1. shared account name postoji;
2. najmanje jedna capability/usluga;
3. ako ON_SITE → područje rada;
4. ako samo REMOTE → lokalni grad nije obavezan;
5. korisnik je pregledao i potvrdio profil.

Ne zahtevati:
- vozilo;
- alat;
- stalni broj članova ekipe;
- weekly availability;
- verified identity za obične taskove dok feature nije aktivan.

## Current code gap

Aktuelni AI `capturedParts` još kaže da area ima country+city kao obavezno.

To treba uskladiti sa remote-only profile pravilom.

---

# 789. USLUGE KOJE NUDITE

Section:

**Usluge koje nudite**

Chips:
Selidbe · Montaža · Dostava · ...

Ako mnogo:
prvih nekoliko + `Još N`

Tap section:
AI correction topic `skills`.

Ne direktan manual mega-picker kao glavni edit.

AI predlaže strukturirane capabilities.
User potvrđuje.

---

# 790. NAČIN RADA

Section:

**Način rada**

Moguća stanja:
- Na lokaciji
- Na daljinu
- Na lokaciji i na daljinu

Tap:
AI edit ili controlled setting kroz isti profile flow.

Ako ON_SITE:
Područje rada postaje relevantno.

Ako REMOTE-only:
ne tražiti fake local area.

---

# 791. PODRUČJE RADA

Section:

**Područje rada**

Primer:
`Novi Sad · do 15 km`

Tap:
**Područje rada**

Tu korisnik vidi:
- grad/područje rada;
- radius chips;
- approximate center;
- map confirmation.

Privacy:
`Kućna adresa i precizan GPS nisu potrebni.`

Map point je coarse operating center.

Ne public home marker.

---

# 792. DOSTUPNOST

Section:

**Dostupnost**

Ako available-now:
`Mogu odmah`

Ispod:
weekly preference summary ako postoji.

Tap:
AI topic `time`.

Ne drugi scheduler koji liči na Dogovor calendar.

Availability je preference.
Raspored je confirmed commitments.

---

# 793. `MOGU ODMAH`

Ako product zadrži signal:
mora imati server-owned expiry.

Final presentation:

**Mogu odmah**
`Do 14:30`

ili:
`Još 2 sata`

Bez expiry backend-a:
ne koristiti ovaj signal za public matching kao da je večan.

## Current code gap

Current saved profile ima boolean-like `dostupanOdmah`.

Potrebno:
- expiry timestamp / TTL;
- authoritative active state.

P1 pre ozbiljnog matching reliance-a.

---

# 794. ALATI I VOZILA

Aktuelni code direction:
**informacija, ne hard matching condition.**

Final ordinary Radni profil:
ne daje im zasebne velike sekcije.

Ako legacy data postoji:
može biti dostupno iza:
`Dodatne informacije`

Ali:
- ne utiče na eligibility;
- ne pravi permanent inventory product;
- ne mora u MVP public profil.

Task-specific zahtev poput `Potreban kombi` pripada konkretnom Task detail-u.

---

# 795. BROJ LJUDI U PRIJAVI

Ne postoji permanent `team_capacity` na Radnom profilu.

Final rule:

**Ako za neki zadatak obezbeđujete više ljudi, broj navodite u toj konkretnoj prijavi.**

To je već smer u current `workerProfileFacts`.

Application server proverava:
- ≥1;
- <= preostala mesta;
- sistemski maksimum.

Profil se ne menja zbog privremene ekipe.

---

# 796. PUBLIC WORKER PREVIEW U RADNOM PROFILU

Na saved profile ekranu:

small worker face summary:

[portrait]
**Miloš Šljivić**

★ worker rating/count

`Selidbe · Montaža · Dostava +2`

`Novi Sad · do 15 km`

Action:
**Pogledajte javni profil**

Ako DRAFT:
badge:
`Još nije javno aktivan`

---

# 797. PUBLIC WORKER PROFILE — FINALNO

Prikazuje:

- shared portrait;
- shared name;
- `Kao uskočer`;
- worker rating/count;
- completed worker collaborations;
- reliability ako public + dovoljno uzorka;
- usluge/capabilities;
- general work area;
- local/remote;
- description;
- verified licenses samo sa provenance;
- member-since ako authoritative.

Ne prikazuje:
- login email;
- telefon;
- exact lokaciju;
- current weekly availability detail;
- application history;
- tools/vehicles inventory;
- requester rating u worker figure-u.

---

# 798. PUBLIC REQUESTER PROFILE — FINALNO

Prikazuje:

- shared portrait;
- shared name;
- `Kao naručilac`;
- requester rating/count;
- completed requester collaborations;
- member-since kada postoji;
- verified identity samo ako stvarno verified.

Ne prikazuje:
- worker capabilities;
- worker radius;
- worker reliability;
- exact location;
- email/phone.

---

# 799. OCENE — FINALNI PROFIL SCREEN

Header:
**Ocene**

Glavni izbor:

**Primljene | Date**

Unutar `Primljene` mora postojati role context:

**Kao naručilac | Kao uskočer**

ili dve jasno odvojene sections ako je UX bolji.

Ne jedan account-level aggregate.

## Primljene

Header:
★ 4,9 · 12 ocena

Review rows:
- task;
- rating;
- tags/comment kada published;
- role context.

Blind pending own rating može vlasniku profila reći:
`Sačuvana · čeka objavu`,
ali ne objaviti je drugoj strani.

## Date

Moje ocene koje sam dao:
- druga osoba;
- task;
- moja rating value;
- publication state gde relevantno.

---

# 800. PROFILE HUB — CURRENT CODE DELTA

## KEEP

- one-account hub;
- shared avatar direction;
- no global role switch;
- worker status attention;
- public profile sheet concept;
- separate Settings;
- support path;
- Raspored/Tasks/Applications destinations;
- focus/account navigation guards.

## MODIFY

- account identity authority umesto requester-row-first identity;
- account reputation → two role reputations;
- `Pogledaj javni profil` → role-aware preview;
- hub destination cards → grouped rows;
- formal copy;
- city under identity samo ako shared-safe;
- `Tvoje objave` → formal;
- finished work figure role-aware where shown.

## RETIRE

- blended account rating as public trust;
- auto choosing worker public profile just because worker ACTIVE;
- implicit worker city as account city;
- informal `tvoje/te`.

---

# 801. WORKER PROFILE — CURRENT CODE DELTA

## KEEP

- AI-first setup/edit;
- one account name;
- save/readback confirmation;
- uncertainty recovery;
- keyboard-safe footer;
- activation status;
- execution modes;
- location map confirmation;
- suspended read-only state;
- info-only tools/vehicles direction;
- `Za mene` integration;
- availability as separate concept.

## MODIFY

- formal copy;
- remote-only activation must not require city;
- simplify saved presentation;
- hide legacy equipment from ordinary profile;
- available-now TTL;
- role-scoped worker rating;
- account-name migration becomes true shared identity, not sync between two profile rows.

## RETIRE

- independent worker name ownership;
- permanent team size;
- tools/vehicles hard matching;
- manual sprawling profile editor as primary UX.

---

# 802. PROFIL — KONKRETAN FINALNI PRIMER

← **Moj profil**

              [portrait + camera]

             **Miloš Šljivić**
        Jedan nalog · obe mogućnosti

     Kao naručilac       Kao uskočer
        ★ 4,9               ★ 4,8
        12 ocena             23 ocene

**Pogledajte kako Vas drugi vide**

--------------------------------

**Uskačem**

Radni profil
Selidbe · Montaža · Novi Sad                 →

--------------------------------

**Moje aktivnosti**

Moji zadaci
Objave i izbor saradnika                     →

Moje prijave
Status prijava i odgovori                    →

Moj raspored
Dogovori i dostupnost                        →

--------------------------------

**Nalog i pomoć**

Podešavanja                                  →

Pomoć i podrška                              →

---

# 803. RADNI PROFIL — KONKRETAN SAVED PRIMER

← **Radni profil**                          [ⓘ]

✓ Profil je aktivan

[portrait]
**Miloš Šljivić**
★ 4,8 · 23 ocene

**Usluge koje nudite**
Selidbe · Montaža · Dostava +2               →

**Način rada**
Na lokaciji i na daljinu                     →

**Područje rada**
Novi Sad · do 15 km                          →

**Dostupnost**
Mogu odmah · do 14:30                        →

**O Vama**
Pomažem oko selidbi, montaže i lakšeg prevoza. →

**Pogledajte javni profil**

Primary edit:
**Izmenite kroz razgovor**

---

# 804. PROFIL / RADNI PROFIL — TEST MATRIX

1. requester-only account;
2. worker draft;
3. worker active;
4. worker suspended;
5. both public roles;
6. no photo;
7. photo;
8. no ratings;
9. requester ratings only;
10. worker ratings only;
11. both role ratings;
12. identity read fails;
13. optional worker read fails;
14. shared name migration mismatch;
15. public requester preview;
16. public worker preview;
17. remote-only worker;
18. local-only worker;
19. both modes;
20. no area;
21. location coarse point;
22. available-now active/expired;
23. long skills;
24. large text;
25. 360dp;
26. account switch during read.


> **KANONSKI HANDOFF:** finalna hijerarhija i status dokazivanja sada su S15/J; detalji ispod ostaju referentni dok se ne sukobe sa njima.

# 805. PODEŠAVANJA — FINALNI EKRAN

Mentalni model:
**„Ovde menjam nalog, obaveštenja, privatnost i pomoć — ne svoje marketplace aktivnosti.“**

Aktuelni `AccountSettingsPresentation` je vizuelno dobar i treba ga zadržati kao osnovu.

Grupisanje:

## Nalog
- Lični podaci
- Pristup nalogu

## Vaše iskustvo
- AI razgovori
- Obaveštenja
- Privatnost i podaci

## Pomoć
- Pomoć i podrška
- Prijavite grešku
- Pravila i saglasnosti
- O aplikaciji

Bottom:
- Odjavite se
- account email quiet

Ne prebacivati:
- Moje zadatke
- Moje prijave
- Raspored
u Settings.

To ostaje Profile / activity domain.

---

# 806. LIČNI PODACI

Screen:
**Lični podaci**

Finalno shared identity fields:

- Ime
- Prezime
- Profilna fotografija kao link/editor
- eventualni display-name rule ako backend uvede odvojeni public display

Ne:
- grad rada
- radius
- skills
- availability

Save:
**Sačuvajte izmene**

Unknown write:
ne tvrditi uspeh;
readback.

Ako name migracija još koristi requester/worker profile rows:
UI i dalje predstavlja **jedno ime**, a adapter rešava compatibility.

---

# 807. PRISTUP NALOGU

Ne treba uvek da znači samo:
`Promena lozinke`.

Screen mora biti provider-aware.

Ako email/password postoji:
- Email
- Promenite lozinku

Ako Google provider povezan:
- Google · povezano

Phone:
samo ako stvarno enabled/configured.

Apple:
tek iOS.

Ne nuditi password flow nalogu koji nema local password bez provider-supported načina da ga postavi.

---

# 808. OBAVEŠTENJA — FINALNI SETTINGS SCREEN

Ovo je settings površina, odvojena od notification inbox-a koji bell otvara.

Jedan ekran, bez requester/worker tabova.

Finalne ljudske grupe:

## Zadaci i prilike
- Novi zadaci koji Vam odgovaraju
- Promene relevantnih zadataka

## Prijave
- Nova prijava na Vaš zadatak
- Status Vaše prijave
- Izbor / Dogovor

## Dogovori
- Promena uslova
- Završetak
- Problem / važan state
- Ocena

## Poruke
- Nove poruke

## Podsetnici
- termini i relevantni reminders

## Tihi sati
- uključeno/isključeno
- od–do

Ne izlagati raw event kodove.

## 808.1 Phone/push permission

OS permission nije isti business setting.

Ako push permission nije dat:
screen jasno:
`Obaveštenja na telefonu nisu dozvoljena.`

Action:
**Otvorite podešavanja telefona**

Business toggles mogu ostati sačuvani za trenutak kada OS permission bude vraćen.

## 808.2 HITNO

Nema HITNO bypass/toggle dok HITNO feature nije aktivan.

## 808.3 Unsaved changes

Current Back confirmation:
**KEEP.**

Ako ima izmene:
`Odbaciti izmene?`

---

# 809. PRIVATNOST I PODACI — FINALNI HUB

Mentalni model:
**„Šta drugi vide, koliko čuvamo podatke i kako ja kontrolišem svoj nalog.“**

Redosled:

1. **Ko šta vidi**
2. **Rokovi čuvanja**
3. **Izvoz podataka**
4. **Blokirane osobe**
5. **Pravila i saglasnosti**
6. **Zatvaranje naloga**

Zatvaranje naloga ostaje na dnu.

Nije crveni banner na vrhu.

---

# 810. KO ŠTA VIDI

Human summary:

## Zadatak
`Javni zadatak prikazuje približno područje, ne tačnu adresu.`

## Dogovor
`Tačnu privatnu lokaciju delite samo u aktivnom Dogovoru kada Vi to izaberete.`

## Kontakt
`Komunikacija ostaje kroz Poruke u aplikaciji.`

MVP ne tvrdi da se telefon deli.

## Profil
`Javni profil prikazuje samo podatke vezane za ulogu u kojoj Vas druga osoba gleda.`

## Nalog
`Email i podaci za prijavu nisu javni.`

Ne koristiti nejasnu reč „kontakt“ ako to može da zvuči kao automatsko deljenje telefona.

---

# 811. ROKOVI ČUVANJA

Current code već čita objavljenu retention policy i execution status.

Final UX zadržava tu iskrenost.

Ako politika nije objavljena:
**Rokovi čuvanja još nisu objavljeni.**

Ne prikazivati fake default rokove.

Ako jeste:
expandable human rows:

- Podaci naloga
- Zadatak i Dogovor
- Poruke
- Fotografije
- AI razgovori
- Safety/support evidencija

Svaki row može otvoriti:
- svrhu;
- rok;
- trigger brisanja;
- izuzetak;
- pravni osnov.

Tehnički dataset/code ne prikazivati korisniku.

---

# 812. AUTOMATSKO BRISANJE AI RAZGOVORA

Ako execution nije confirmed:
**Dostupnost automatskog brisanja nije potvrđena.**

Ako jeste:
objasniti scope.

Nikad:
`Ovaj razgovor je obrisan`
bez per-item authoritative receipt-a.

Current code to dobro poštuje — KEEP.

---

# 813. IZVOZ PODATAKA — FINALNI FLOW

Current export lifecycle je dobar i treba ga očuvati.

Faze:

1. Nije traženo
2. Zahtev zabeležen
3. U pripremi
4. Spremno
5. Nije dostupno
6. Isteklo
7. Nije uspelo
8. Otkazano

## 813.1 Pre prvog zahteva

Ne crtati tri siva fake koraka.

Jedna jasna poruka:

**Preuzmite kopiju podataka svog naloga**

Primary:
**Zatražite izvoz**

## 813.2 Kada postoji zahtev

Tek tada stepper:

Zahtev
↓
Priprema kopije
↓
Preuzimanje

## 813.3 Spremno

Prikaz:
- JSON / budući format;
- veličina;
- dostupno do;
- Save/Share sistemski file flow.

Ne lažan procentualni progress.

## 813.4 Opoziv

`Opozovite kopiju`

Objašnjenje:
server copy više neće biti dostupna.
Već sačuvani lokalni fajl na korisnikovom telefonu ostaje njegov.

---

# 814. BLOKIRANE OSOBE

Screen prikazuje samo:
**osobe koje sam ja blokirao.**

Ne prikazuje:
- ko je blokirao mene;
- incoming block razlog.

Row:
[avatar/name ako authorized]
**Odblokirajte**

Confirm:

**Odblokirati Marka?**

`Odblokiranje ne vraća ranije dozvole za deljenje tačne lokacije niti druge ranije grantove.`

Važno:
MVP copy ne pominje vraćanje „kontakta“ kao da phone grant postoji.

Unblock success:
person row nestaje.
Nema implicit restore drugih prava.

---

# 815. PRAVILA I SAGLASNOSTI

Screen:

- Uslovi korišćenja
- Politika privatnosti
- ostala relevantna pravila
- trenutno prihvaćena verzija gde applicable
- effective date
- otvorite dokument

Ako nema published document:
`Dokument još nije objavljen.`

Acceptance action postoji samo ako:
- dokument published;
- acceptance stvarno zapisuje version/hash;
- account ga mora prihvatiti.

Ne checkbox koji ništa ne snima.

---

# 816. ZATVARANJE NALOGA — MENTALNI MODEL

Ovo je full-screen flow preko Privacy huba.

Nije običan destructive row + jedan confirm.

Redosled:

1. pregled posledica;
2. blocker check;
3. ponudite export;
4. priprema za zatvaranje;
5. final review;
6. irreversible confirm;
7. processing/recovery;
8. terminal receipt.

Current architecture je vrlo dobra osnova.

---

# 817. CLOSURE — REVIEW PRE ZATVARANJA

Header:
**Zatvaranje naloga**

Prvo:

**Pregled pre zatvaranja**

Objašnjava:
- pristup nalogu će prestati;
- šta se uklanja prema published policy;
- koji minimum podataka može biti zadržan zbog zakona/safety/računovodstva ako je policy tako definisana.

Ne univerzalno:
`Svi podaci se brišu`

ako retention policy kaže drugačije.

## Current code delta

Current final confirmation copy:
`nalog se zaključava i podaci se uklanjaju`

treba precizirati:

`Nalog će biti trajno zatvoren. Podaci se uklanjaju ili zadržavaju u skladu sa prikazanim pravilima čuvanja. Ovu radnju ne možete da poništite.`

---

# 818. CLOSURE BLOCKERS

Pre finalnog zatvaranja:

## Aktivni Dogovori
`Najpre završite ili otkažite aktivne saradnje.`
→ **Otvorite Dogovore**

## Otvoreni zadaci
→ **Moji zadaci**

## Aktivne prijave
→ **Moje prijave**

Drugi blockers:
human label + action samo ako postoji destination.

Nema raw:
`ACTIVE_AGREEMENT`
`OPEN_TASK`

---

# 819. CLOSURE + EXPORT

Pre irreversible start-a:

**Želite li prvo kopiju svojih podataka?**

Action:
**Izvezite podatke**

Nije blocker ako policy ne zahteva.
Korisnik može da nastavi closure bez export-a posle jasnog objašnjenja.

---

# 820. FINAL IRREVERSIBLE CONFIRM

Centered danger sheet:

**Trajno zatvoriti nalog?**

`Posle ovog koraka nalog više nećete moći da koristite. Podaci se obrađuju prema prikazanim pravilima čuvanja.`

Primary destructive:
**Da, trajno zatvorite nalog**

Secondary:
**Odustanite**

Ne filled giant red page.

---

# 821. CLOSURE UNKNOWN OUTCOME

Durable intent ostaje.

Copy:

**Ne znamo da li je zahtev za zatvaranje potvrđen.**

Primary:
**Proverite stanje zahteva**

Same-key replay samo posle read-first provere.

Ne dozvoliti drugi closure start.

Current journal/readback architecture — KEEP.

---

# 822. CLOSURE PROCESSING

Ako execution počeo:

**Zahtev je pokrenut**

`Pristup nalogu je ograničen dok se zahtev obrađuje.`

Prikaži:
- phase;
- exceptions/retained classes u ljudskim rečima;
- refresh.

Ne tvrditi `Nalog je zatvoren` pre terminal state-a.

---

# 823. CLOSURE TERMINAL

Samo authoritative:
state=CLOSED

može prikazati:

**Nalog je zatvoren**

Ispod:
- potvrda izvršenih koraka;
- šta je zadržano prema policy;
- datum;
- eventualna referenca receipt-a u human formi.

Action:
**Odjavite se**

Ne vraćati običan app shell.

---

# 824. PODRŠKA — FINALNI HOME

Mentalni model:
**„Imam problem ili pitanje i mogu da vidim šta se dešava sa mojim zahtevom.“**

Header:
**Podrška**

Top:
FAQ / quick answers samo ako stvarno postoje.

Glavna sekcija:
**Vaši zahtevi**

Case rows:
- topic;
- status;
- #case;
- updated time;
- unread dot.

Primary:
**Novi zahtev**

Ne običan support email kao jedini model.

---

# 825. SUPPORT CASE STATUSI

Human labels:

- Primljen
- U obradi
- Čeka Vaš odgovor
- Odgovoreno / Rešeno
- Zatvoreno
- Odluka doneta
- Ponovni pregled gde postoji

Ne prikazivati internal codes.

Unread:
orange dot + screen reader `novo`.

---

# 826. NOVI ZAHTEV PODRŠCI

Flow:

**Novi zahtev**

## Tema
human radio options.

Primer:
- Problem sa zadatkom
- Problem sa Dogovorom
- Nalog i privatnost
- Bezbednost
- Drugo

## Naslov
kratko.

## Opis
multiline.

Context može automatski da bude priložen:
- task id;
- Agreement id;
- message id;
- build info za bug.

Ali korisniku se ne pokazuje kao raw UUID polje.

Primary:
**Pošaljite zahtev**

Unknown:
frozen payload + readback.

---

# 827. SUPPORT CASE — THREAD

Header:
**Zahtev #71**

Status chip.

Thread:
- moje poruke desno;
- podrška levo;
- system state lines center;
- decision block kao jasno izdvojena činjenica.

Composer:
`Napišite odgovor…`

Terminal/closed:
composer nestaje ako replies više nisu dozvoljeni.

---

# 828. SUPPORT DECISION / APPEAL

Odluka nije obična chat poruka.

Block:

**Odluka o zahtevu**

status/outcome

explanation

date

Quiet:
`Ova odluka sama ne menja zadatak, Dogovor, novčani iznos ili ocenu.`

Ako appeal/reconsideration stvarno postoji:
**Zatražite ponovni pregled**

Posle:
originalna odluka ostaje u istoriji.
Nova odluka dobija:
`Odluka posle ponovnog pregleda`

---

# 829. OPERATOR SUPPORT INBOX

Current `/podrska/operator`:
**INTERNAL / STAFF-ONLY**

Ne consumer navigation.

Access:
server capability gated.

Consumer ne vidi da route postoji.

Store build može imati code, ali nije public UX surface.

---

# 830. PRIJAVA GREŠKE

Može biti posebna shortcut surface iz Settings-a.

Treba da prefill:
- app version;
- build/channel;
- device/platform basics;
- current route samo ako privacy-safe.

User opis:
obavezan.

Ne slati:
- full conversation dump;
- tokens;
- private media;
- exact location

bez eksplicitnog razloga/consent-a.

Finalno može da kreira Support case tip `BUG`.

Ne održavati potpuno drugi help backend ako Support cases već rešavaju lifecycle.

---

# 831. O APLIKACIJI

Keep:

- USKOČI mark
- vizija u jednoj rečenici
- `MENI TREBA. JA MOGU.`
- version
- legal/privacy shortcuts

Debug metadata:
- commit;
- backend target;
- channel

dev/internal only.

Consumer build ne mora da vidi deployment internals.

---

# 832. SETTINGS / PRIVACY / SUPPORT — CODE DELTA

## KEEP

- current AccountSettings grouping;
- logout confirmation;
- notification unsaved-change protection;
- retention policy read;
- retention execution honesty;
- export lifecycle;
- blocks revision/idempotency;
- legal state;
- full closure review/blockers/journal/readback;
- support cases;
- case decisions;
- support conversation composer;
- operator capability gate.

## MODIFY

- formal copy everywhere;
- `Tvoje iskustvo` → `Vaše iskustvo`;
- `tvoj/te` across privacy/export/closure/support → Vi/Vam/Vas;
- provider-aware Account Access;
- Privacy phone/contact wording;
- closure final confirmation legally precise;
- closure blocker labels fully human;
- bug report folds into/supports Support case lifecycle;
- notification event grouping humanized.

## RETIRE / GATE

- any phone-grant wording in ordinary privacy until phone sharing exists;
- raw internal retention/data-class codes;
- debug metadata consumer-side;
- separate duplicated support backend for bug reporting;
- HITNO notification setting until feature active.

---

# 833. SETTINGS / PRIVACY / SUPPORT — TEST MATRIX

1. Settings normal;
2. logout confirm;
3. logout error;
4. password account;
5. provider-only account;
6. notification permission denied;
7. notification dirty Back;
8. quiet hours;
9. retention unpublished;
10. retention published;
11. retention read error;
12. execution not admitted;
13. export none;
14. requested;
15. processing;
16. ready;
17. expired;
18. failed;
19. cancel export;
20. revoke export;
21. save file;
22. blocked empty;
23. blocked list;
24. unblock;
25. unblock unknown;
26. legal unpublished;
27. legal accepted;
28. legal acceptance pending;
29. closure blockers;
30. closure export detour;
31. closure prepare;
32. closure unknown;
33. closure processing;
34. closure terminal;
35. support empty;
36. support multiple cases;
37. new case;
38. case reply;
39. reply unknown;
40. decision;
41. appeal;
42. closed case;
43. large text;
44. 360dp.


# 834. AI NEED — FINALNI TOK OD IDEJE DO OBJAVE

Ovo je jedan od dva glavna requester ulaza u proizvod:

Početna
→ **Objavite zadatak**
→ AI Need razgovor
→ Review
→ Publish
→ Owner Task

Mentalni model:
**„Kažem šta mi treba kao čoveku; aplikacija mi pomaže da to pretvorim u jasan zadatak; ja na kraju proveravam i objavljujem.“**

AI ne sme da deluje kao:
- chatbot radi chatbota;
- autonomni agent koji sam objavljuje;
- velika forma sakrivena iza balončića.

---

# 835. NOVI ZADATAK — FIRST OPEN

Header:
**Novi zadatak**

Body:

conversation art

**Opišite šta Vam treba**

`Možete napisati ili reći svojim rečima. Pitaćemo samo ono što nedostaje.`

Composer:
`Opišite zadatak…`

Actions:
- send
- voice
- photo attach

Važno:
**samo otvaranje ekrana ne kreira server conversation.**

Current code to već radi — KEEP.

Conversation nastaje tek:
- prvom stvarnom porukom;
- eksplicitnom dozvoljenom voice/photo radnjom koja zahteva conversation context.

---

# 836. AI NEED — THREAD

User messages:
desno.

USKOČI assistant:
levo / neutral-soft.

Ne koristiti veliki robot avatar uz svaku poruku.

Assistant pita samo sledeću potrebnu stvar.

Primer:

**Vi**
Treba mi sutra neko da unese veliki ormar na treći sprat.

**USKOČI**
Koliko ljudi Vam je potrebno?

Quick replies:
`1`
`2`
`3+`

**Vi**
Dvojica.

**USKOČI**
Da li zgrada ima lift?

...

---

# 837. LIVE DRAFT SUMMARY

Kada postoji dovoljno korisnih structured facts:

iznad composera ili inline posle relevantnog assistant turn-a:

**Nacrt zadatka**

Unos ormara na treći sprat

👥 2 osobe  
📅 Sutra  
📍 Liman  
💰 Cena još nije određena

Kako činjenice postaju kompletne:
card se ažurira.

Ne prikazivati skoro prazan card posle prve reči.

Ne prikazivati:
- raw JSON;
- confidence percentages;
- classifier codes.

---

# 838. STRUKTURISANE ČINJENICE — KO JE AUTORITET

AI može da predloži.

Kanon:

**AI_PROPOSED → HUMAN_CONFIRMED → CANONICAL_SAVED**

Za facts koji mogu da budu opasni ako su pogrešni:
- cena;
- broj ljudi;
- tačan vremenski okvir;
- lokacija;
- public/private karakter;
- photos;
- publish;

čovek ih pregleda pre canonical write-a.

---

# 839. LOCATION U AI FLOW-U

Ako task nije remote i AI razume opis mesta:

Assistant može:
`Razumeo sam Liman. Potvrdite približno mesto na mapi.`

Inline location prompt.

Tap:
map confirmation.

Stored/public:
coarse/approximate point.

Private exact address:
nije public task fact.

## 839.1 Location resolution

Current location-dialogue runtime je capability-gated.

Ako resolver nije dostupan:
AI ne sme da tvrdi da je mesto potvrđeno.

Fallback:
manual map/place selection.

## 839.2 Multi-point

Point-to-point:
- Od
- Do

Multi-stop:
samo kada canonical domain stvarno podržava sve stanice.

Ne graditi bogat route planner iznad polovičnog backend modela.

---

# 840. VOICE

Hold-to-talk / voice input ostaje alternativni način unosa.

States:
- spremno;
- slušamo;
- obrađujemo;
- odgovor;
- denied;
- interrupted;
- error.

Permission:
tek na prvi voice gesture.

Denied:
text composer ostaje potpuno funkcionalan.

Permanent denied:
**Otvorite podešavanja**

Ne dozvoliti voice da bude uslov za AI flow.

---

# 841. PHOTOS U CONVERSATION-U

`+`:
- Galerija
- Kamera

Task photos pripadaju istom draft conversation-u.

Current photo controller/journal — KEEP.

## 841.1 Limit

Technical current limit:
**6**

Final product copy:
`Dodajte nekoliko jasnih fotografija ako pomažu da se zadatak razume. Možete dodati do 6.`

Ne forsirati tačno 1–3 kao hard limit.

## 841.2 Processing

States:
- dodata;
- šalje se;
- proverava se;
- spremna;
- neuspešno;
- unknown.

Publish readiness može da blokira dok public media nije spremna.

## 841.3 Privacy

Provider processing notice mora biti usklađen sa stvarnom produkcionom politikom.

Ne skrivati external AI/media provider processing ako policy zahteva disclosure.

---

# 842. AI TURN — DURABLE RECOVERY

Current architecture:
AI turn intent journal + exact request id.

**KEEP.**

Ako pošaljemo poruku i ishod nije poznat:

thread ostaje.

User text se ne gubi.

State:

**Ne znamo da li je poruka stigla.**

Primary:
**Proverite ishod**

Safe retry:
samo isti request / isti payload kada contract dozvoljava.

Ne praviti drugi AI turn kao novu poruku pre readback-a.

---

# 843. AI SERVICE DOWN / STALE

Ako postoji last good conversation:
ostaje na ekranu.

Notice:
**Razgovor trenutno nije osvežen.**

Ako AI provider down, ali draft postoji:
`Nacrt je sačuvan. Pokušajte kasnije.`

Ne blank screen.

Ako potpuno novi razgovor ne može da se pokrene:
error state sa Back i Retry.

---

# 844. SAFETY OUTCOMES

Internal:
ALLOW / CLARIFY / REVIEW / BLOCK.

User-facing:

## ALLOW
normalno.

## CLARIFY
AI postavlja pitanje.

Ne prikazivati reč CLARIFY.

## REVIEW
`Objava trenutno zahteva dodatnu proveru.`

Draft ostaje.

## BLOCK
Composer se zaključava.

Jasna poruka:
`Ovaj zahtev ne možemo da objavimo.`

Bez internog classifier razloga ako nije user-safe.

---

# 845. READY FOR REVIEW

Kada AI review kaže da su required facts spremni:

live draft card:

✓ `Spremno za pregled`

Primary:
**Pregledajte zadatak**

Optional:
`Nastavite razgovor`

ako user želi još da doda.

Klik Review:
ne objavljuje.

---

# 846. REVIEW — FINALNI PURPOSE

Review je:
**poslednja ljudska kontrola pre save/publish.**

Ne novi form world.

Redosled:

1. Fotografije
2. Naslov
3. Opis
4. Cena
5. Broj ljudi
6. Vreme/rok
7. Mesto/route
8. Requirements
9. Public requester preview
10. optional application deadline
11. missing/blocked readiness
12. Save Draft / Publish

---

# 847. REVIEW — EDIT

Pencil na fact-u:

## Semantic facts
title/description/price/time/people
→ vraća u isti AI conversation sa correction contextom.

## Photos
→ Fotografije zadatka.

## Map point
→ location confirmation.

Ne graditi zasebnu drugu mega-formu za iste facts.

---

# 848. REVIEW — UNSENT TEXT

Ako user u conversation-u ima tekst u composer-u koji nije poslat:

Review mora reći:

**Neposlati tekst nije deo pregleda.**

`Ostaje sačuvan u razgovoru.`

Ne uključiti ga u publish payload.

---

# 849. PUBLICATION READINESS

Current server gate:
**KEEP.**

Review može da prikaže samo ono što gate autoritativno kaže.

Examples:

## LOCATION_INCOMPLETE
**Još nedostaje mesto na mapi**

→ vratite u conversation/location.

## PUBLIC_MEDIA_NOT_READY
**Fotografije se još obrađuju**

→ Osvežite.

## POLICY_NOT_READY
**Pravila objave nisu spremna**

`Nacrt je sačuvan. Pokušajte kasnije.`

## EVALUATOR_UNAVAILABLE
**Provera objave trenutno ne radi**

Ne user fault.

---

# 850. SAVE DRAFT

Action:
**Sačuvajte nacrt**

Private Need.

Receipt:
**Nacrt je sačuvan**

Primary:
**Otvorite Moj zadatak**

ili:
**Nastavite kasnije**

Draft se pojavljuje u:
Moji zadaci → Nacrti.

---

# 851. PUBLISH

Primary:
**Objavite zadatak**

Pre network write:
review fact/revision bound.

Busy:
**Objavljujemo…**

Unknown:
**Ne znamo da li je zadatak objavljen.**

Primary:
**Proverite stanje**

Ne kreirati novi Need naslepo.

---

# 852. PUBLISH SUCCESS

Kratak success:

✓

**Objavljeno**

`Zadatak je sada dostupan odgovarajućim korisnicima.`

Destination:
**Owner Task detail**

Ne Discovery.

Razlog:
requester posle objave želi:
- da vidi task;
- status;
- prijave;
- search state.

Current product direction — KEEP.

---

# 853. PUBLISHED EDIT

Owner Task → Edit:

otvara isti AI conversation model vezan za taj Need.

Nova draft revision.

Current published task ostaje live dok user:
- završi AI correction;
- Review;
- potvrdi novu verziju.

Existing Agreement terms:
ostaju frozen.

Update task ne mutira bilateralni Agreement.

---

# 854. PHOTOS SCREEN — FINALNO

Header:
**Fotografije zadatka**

Grid:
`3 od 6`

Tile status:
- processing;
- error;
- ready.

Add:
**Dodajte fotografije**

Photo source sheet:
- Galerija
- Kamera

Privacy note.

Footer:
**Gotovo**

Unknown photo upload:
recovery block uz exact tile.

Current screen architecture je dobra — KEEP.

---

# 855. AI HISTORY — FINALNI ROOT

Settings → **AI razgovori**

Screen:

**AI razgovori**

Tabs:

**Zadaci | Radni profil**

Rows:

**Selidba stana**
`Nastavite razgovor`
28. okt

**Montaža TV-a**
`Završen razgovor`
25. okt

Whole row tap.

## Open
ako canContinue:
→ real editor.

## Closed
ako canRead:
→ read-only transcript.

Ne kreirati novu conversation kopiju.

---

# 856. AI HISTORY — TRANSCRIPT

Header:
**AI razgovori**

Context:
`Zadatak`
ili
`Radni profil`

Read-only messages.

No composer.

No retry-send of old turns.

Back:
AI History.

If closed history admission missing:
**Razgovor nije dostupan za pregled.**

Current H1→H2 admission model — KEEP.

---

# 857. WORKER PROFILE AI — ISTI JEZIK, DRUGI DOMAIN

Profil → Radni profil → AI conversation.

Assistant:

**Ispričajte čime se bavite**

Extract:
- usluge;
- opis;
- execution mode;
- work area;
- availability;
- optional information.

Review:
saved profile facts.

Activation only on human confirmation.

Ne automatski activate iz AI turn-a.

---

# 858. AI UX — VISUAL CONSISTENCY

Need AI i Worker AI koriste isti:
- assistant voice;
- bubble geometry;
- composer;
- voice control;
- pending/error/recovery;
- quick replies;
- review transition.

Ali:
- Need uses task facts;
- Worker uses profile facts.

Ne dva različita chatbot design systema.

---

# 859. AI / PUBLISH — CODE DELTA

## KEEP

- lazy conversation creation;
- owned conversation;
- turn journal;
- exact recovery;
- last-good thread;
- safety states;
- location-dialogue capability gate;
- voice controller;
- photo journal/recovery;
- review return contract;
- correction intents;
- publication readiness gate;
- versioned Need;
- publish success to Owner Task;
- AI History admission.

## MODIFY

- formal copy;
- final live draft card hierarchy;
- photo-first Review ordering;
- semantic edit routes cleaned;
- remote/local location rules;
- provider/privacy copy production-ready;
- one visual language Need/Worker AI.

## GATE

- voice only with production runtime;
- location resolver only if healthy;
- evaluator only if healthy;
- identity requirement only if feature active;
- multi-stop only if canonical model ready.

---

# 860. AI / PUBLISH — TEST MATRIX

1. blank open creates nothing;
2. first text creates conversation;
3. first photo;
4. voice first;
5. text turn success;
6. turn unknown;
7. safe retry;
8. restored pending journal;
9. provider terminal failure;
10. last-good stale thread;
11. safety clarify;
12. safety review;
13. safety block;
14. location proposed;
15. location confirmation;
16. location resolver unavailable;
17. remote;
18. point-to-point;
19. photo 1;
20. photo 6;
21. processing photo;
22. photo unknown;
23. ready review;
24. unsent text;
25. correction return;
26. readiness location missing;
27. media not ready;
28. policy not ready;
29. evaluator unavailable;
30. save draft;
31. publish success;
32. publish unknown;
33. published edit;
34. Agreement unaffected by edit;
35. AI History open;
36. closed transcript;
37. inaccessible history;
38. worker AI setup;
39. worker AI activation;
40. 360dp / large text / keyboard.


# ROUTE AUDIT — STVARNI APK NASPRAM FINALNOG UX-A

Ovo poglavlje je nastalo proverom stvarnog `src/app` route tree-a na branch-u `feature/uskoci-cisto`.

Cilj:
nijedan route u kodu ne sme slučajno da postane drugi konkurentski UX.

Route može biti samo:

1. **FINAL CONSUMER SURFACE**
2. **COMPATIBILITY REDIRECT**
3. **INTERNAL / STAFF**
4. **SYSTEM / ROUTER INFRASTRUCTURE**
5. **RETIRE / CONVERT TO REDIRECT**

---

# FINAL CONSUMER SURFACES — ROOT / AUTH

## `/auth`
FINAL:
Entry/Auth flow.

## `/oporavak`
FINAL:
password recovery link flow.

## `/(app)/`
FINAL:
Početna.

## `/(app)/zadaci`
FINAL:
Discovery root.

## `/(app)/dogovori`
FINAL:
Dogovori root.

## `/(app)/poruke`
FINAL:
Poruke root.

## `/obavestenja`
FINAL:
notification inbox.

---

# FINAL CONSUMER SURFACES — TASK / DISCOVERY

## `/prilike/[id]`
FINAL:
Public Task detail.

## `/prilike/[id]/prijava`
FINAL:
Application composer/review/recovery.

## `/potrebe`
FINAL:
Moji zadaci.

## `/potrebe/[id]/pregled`
FINAL:
Owner Task.

## `/potrebe/[id]/kandidati`
FINAL:
Candidates + Selection.

## `/nova`
FINAL:
AI Need conversation.

## `/pregled-zadatka`
FINAL:
Review / draft save / publish.

## `/fotografije-zadatka`
FINAL:
task photo manager.

## `/pitanja-zadatka`
FINAL:
full task Q&A.

---

# FINAL CONSUMER SURFACES — AGREEMENT / MESSAGES

## `/dogovor/[id]`
FINAL:
bilateral Agreement.

## `/dogovor/[id]/grupa`
FINAL:
group conversation.

## `/dogovor/[id]/izmene`
FINAL:
Agreement change proposal/response.

## `/raspored`
FINAL:
Month/Week/Day schedule.

## `/oceni-dogovor`
FINAL:
Rating flow.

---

# FINAL CONSUMER SURFACES — PROFILE

## `/profil`
FINAL:
Moj profil.

## `/profil/radnik`
FINAL:
Worker Profile.

## `/profil/razgovor`
FINAL:
Worker Profile AI conversation.

## `/profil/lokacija`
FINAL:
worker work-area / map confirmation.

## `/profil/dostupnost`
FINAL entry:
opens worker AI availability topic.

## `/profil/fotografija`
FINAL:
shared profile photo editor.

## `/profil/podaci`
FINAL:
shared personal identity.

## `/profil/ocene`
FINAL after redesign:
role-scoped received/given ratings.

## `/profil/podesavanja`
FINAL:
Settings hub.

## `/profil/obavestenja`
FINAL:
notification preferences.

## `/profil/privatnost`
FINAL:
Privacy & Data hub.

## `/profil/blokirani`
FINAL:
outbound blocked accounts.

## `/profil/izvoz`
FINAL:
data export lifecycle.

## `/profil/pravna`
FINAL:
legal docs/consents.

## `/profil/lozinka`
FINAL concept:
provider-aware account access/password.

## `/profil/prijava-greske`
FINAL concept:
bug-report shortcut integrated with Support lifecycle.

## `/profil/o-aplikaciji`
FINAL:
About.

---

# FINAL CONSUMER SURFACES — SUPPORT / SAFETY

## `/bezbednost`
FINAL:
report/block surface with contextual target.

## `/podrska`
FINAL:
Support home.

## `/podrska/novi`
FINAL:
new support case.

## `/podrska/[id]`
FINAL:
support case conversation/decision/appeal.

---

# FINAL CONSUMER SURFACES — AI HISTORY

## `/ai-istorija`
FINAL:
AI History.

## `/ai-istorija/[conversationId]`
FINAL:
read-only closed transcript.

---

# COMPATIBILITY REDIRECTS — KEEP UNTIL SAFE RETIREMENT

## `/mapa`
Current:
redirect → `/zadaci`

Final:
KEEP compatibility redirect.

No second map screen.

## `/prilike`
Current:
redirect → `/zadaci`

Final:
KEEP compatibility redirect.

No second Discovery list.

## `/mesto-zadatka`
Current:
redirect → `/pregled-zadatka` with conversationId,
or `/nova`.

Final:
KEEP compatibility shim until old links are retired.

No second location writer.

## `/moje-aktivnosti`
Current:
redirect → `/`

Final:
KEEP compatibility redirect for old links.

No consumer screen.

## `/pregled-nacrta`
Current:
redirect → `/pregled-zadatka`

Final:
KEEP until explicit route retirement approval / old-link horizon.

No second Review product.

## root `/prijave`
Current:
context-free legacy candidate URL → Home/Auth.

Final:
KEEP as retired compatibility route or remove once old external links are proven absent.

It is not the current Candidates screen.

---

# ROUTE KOJI MORA DA SE PROMENI

## `/arhiva`

Current:
pun live screen koji kombinuje:
- stare Dogovore;
- stare zadatke;
- stare prijave.

Final product:
**RETIRE AS CONSUMER SURFACE.**

Razlog:
vraća generičku „arhivu“ koja poništava finalnu information architecture:

- Dogovori → Prethodne saradnje;
- Moji zadaci → Prethodni zadaci;
- Moje prijave → Prethodne.

Final code action:
pretvoriti `/arhiva` u compatibility redirect.

Preporučeni fallback:
**Dogovori → Prethodne saradnje**

jer je stari route istorijski pripadao Rasporedu/Dogovorima.

Stari deep link ostaje funkcionalan, ali ne postoji četvrto mesto gde korisnik traži prošle stvari.

---

# INTERNAL / STAFF SURFACE

## `/podrska/operator`

Classification:
**INTERNAL STAFF ONLY**

- nema consumer navigation;
- server capability required;
- ne ulazi u Store UX inventory;
- consumer ne može da otkrije staff role drugog naloga.

---

# SYSTEM / INFRASTRUCTURE

## `/_layout`
router/session/app infrastructure.

## `/(app)/_layout`
authenticated shell/tab infrastructure.

## `/+native-intent`
native/deep-link ingress sanitization.

Nisu consumer screenovi.

---

# ROUTE AUDIT — GLAVNI ZAKLJUČAK

Stvarni route tree je sada uglavnom kompatibilan sa finalnim product smerom.

Najvažnije:

- Mapa i root Prilike su već pravilno spojeni u Zadaci.
- Moje aktivnosti su već retired.
- Mesto zadatka ne održava drugi location editor.
- Pregled nacrta ne održava drugi review.
- Candidate route zahteva pravi Need context.
- Operator Support je odvojen od consumer UX-a.
- **Arhiva je jedini očigledan pun consumer ekran koji treba pretvoriti u compatibility redirect.**

Ovo je primer pravila za ostatak finalizacije:
**jedna funkcija = jedno prirodno mesto u aplikaciji.**

---

# FINAL APK NAVIGATION MAP

## Pre auth

Entry
→ Login / Signup
→ Confirmation / Recovery
→ remembered intent

## Posle auth — root

Početna  
Zadaci  
Dogovori  
Poruke

Bell:
Obaveštenja

Avatar:
Moj profil

## Requester main journey

Početna
→ Objavite zadatak
→ AI Need
→ Review
→ Publish
→ Owner Task
→ Candidates
→ Selection
→ Task-group / Agreement
→ Completion
→ Rating

## Worker main journey

Zadaci
→ Task detail
→ Application
→ Moje prijave
→ Selected
→ Agreement
→ Completion
→ Rating

## Coordination

Dogovori
→ task-group when requester has multiple collaborations
→ bilateral Agreement

Poruke
→ exact private/group conversation

Raspored
→ exact accepted time context

## Account

Profil
→ Radni profil
→ Activities
→ Settings
→ Privacy / Support / Legal / Export / Closure

## AI

Need AI
Worker Profile AI
AI History

Ne postoji globalni role switch.
Ne postoji zaseban Mapa world.
Ne postoji generična Arhiva kao finalni product.


# CONSISTENCY PASS — JEDNA ISTINA KROZ CEO APK

Ovaj pass uklanja ranije superseded odluke tako da implementation tim ne bira između starih i novih pravila.

Zaključano:

## Dogovori
Nema stalnog `Aktivni | Istorija` root switch-a.
Root je:
Čeka Vas → Danas → Sledeće → Bez tačnog termina → Prethodne saradnje.

## Poruke
Nema stalnog `Aktivni | Istorija` root switch-a.
Inbox je recency/task-first.
Terminalni row se samo označava.

## Arhiva
Nije finalni consumer surface.
Current `/arhiva` treba da postane compatibility redirect.

## Application termin
Novi Application ne predlaže alternativni termin.
Prihvata task schedule/window/deadline.
Exact dogovor se menja kasnije u Agreement-u.

## Broj ljudi
Nema permanentnog `team_capacity` u Radnom profilu.
Broj ljudi se bira u konkretnoj prijavi.
Server proverava remaining slots i sistemski maksimum.

## HOURLY
Cena je po osobi:
`hourly rate × people`
za application hourly amount/rate semantics.

## Reputacija
Nema blended account reputation kao finalnog public trust-a.
Requester i Worker reputacija su odvojene.

## Shared identity
Jedno ime i jedna fotografija naloga.
Requester/Worker profil ne održavaju dva nezavisna identiteta.

## Lokacija
Public = approximate/coarse.
Exact/private = grant u bilateralnom Dogovoru.

## Telefon
Nije public/contact MVP surface.
Privacy i profile copy ne smeju da podrazumevaju automatsko deljenje broja.

## Tools/vehicles
Informacija/legacy, ne hard matching i ne glavni public profile inventory.

## AI
AI predlaže.
Čovek potvrđuje.
AI ne objavljuje niti menja canonical state sam.

## Copy
Final UI koristi:
**Vi / Vam / Vas / Vaš**
osim brand slogana i first-person maskota.

Sve starije neformalne rečenice u istorijskim komentarima/kodu predstavljaju implementation backlog, ne finalni copy.


# MOJI ZADACI — CURRENT CODE VERIFIED DELTA

Provereno direktno protiv:

- `src/app/(app)/potrebe.tsx`
- `src/ui/v2/MarketplacePresentation.tsx`
- `src/ui/v2/OwnTaskCard.tsx`
- `src/data/needClientService.ts`

## Šta je već dobro

### Server scope / paging
Paged build već ima server-owned scope i counts.

KEEP.

### Stale card guard
Task se otvara samo ako pripada poslednjem uspešnom read-u.

KEEP.

### Direct candidate action
Card foot može direktno otvoriti prijave za taj task.

KEEP.

### Groups instead of main tabs
Current presentation već grupiše active tasks po phase-u.

To je ispravan mentalni model.

### Nacrti / history kao secondary sets
Dobar smer.

Final label history:
**Prethodni zadaci**

### No floating create button over list
KEEP.

Nova objava:
Početna / empty-state action.

---

# MOJI ZADACI — ŠTA MENJAMO U CURRENT UI

## Header

Current route daje:
`ScreenHeader title="Moji zadaci"` + profile avatar.

Ali Moji zadaci nije jedan od četiri root bottom tabs.

Finalno:
**detail/pushed header sa Back-om**

Back vraća:
- Početna ako je odatle otvoreno;
- Profil ako je odatle otvoreno;
- safe fallback Početna.

Profile avatar ovde nije potreban.

## Group copy

Current:
`Čeka tvoj izbor`

Final:
**Čeka Vas**

ili, u filteru:
**Samo ono što čeka mene**

## History

Current:
`Istorija`

Final:
**Prethodni zadaci**

## Capacity copy

Current card:
`2/3 izabrano`

Final recommendation:
**2/3 dogovoreno**

Razlog:
„izabrano“ je implementation događaj.
Requester mentalno vidi koliko ljudi je već dogovoreno.

Screen-reader može detaljnije:
`Dogovoreno 2 od potrebne 3 osobe.`

## Active phase labels

Final groups:

1. Čeka Vas
2. Objavljeni
3. Dogovoreno / U toku

Ne izlagati više backend phase nijansi nego što korisniku pomaže.

---

# MOJI ZADACI — FILTERI IZ CURRENT KODA

Current sheet već ima:

- search;
- price mode;
- attention only.

To je dovoljno za MVP.

Final:

## Pretraga
`Pretražite svoje zadatke`

## Cena
- Svi načini
- Navedena cena
- Traži ponude

## Attention
**Samo ono što čeka mene**

Footer:
**Prikažite N zadataka**
samo kada count kompletan/authoritative.

Inače:
**Prikažite zadatke**

Secondary:
**Poništite filtere**

Ne dodavati filtere samo zato što backend ima još state-ova.

---

# MOJI ZADACI — FIRST ENCOUNTER

Current empty concept je dobar.

Final:

2.5D task/need art.

**Još nemate zadatak**

`Kada Vam nešto zatreba, opišite to kroz kratak razgovor.`

Primary:
**Objavite zadatak**

Quiet:
**Pogledajte zadatke**
→ Zadaci

Formal copy.

---

# MOJI ZADACI — CURRENT CODE ACTION LIST

## KEEP
- owner paging;
- server counts;
- grouped active list;
- secondary draft/history sets;
- filter sheet;
- direct candidates action;
- stale-card guard;
- pull refresh;
- relation to Owner Task.

## MODIFY
- header → pushed/detail Back;
- formal copy;
- `Čeka tvoj izbor` → `Čeka Vas`;
- `Istorija` → `Prethodni zadaci`;
- `2/3 izabrano` → `2/3 dogovoreno`;
- final phase names aligned with Owner Task;
- task with coverage >0 gets clear collaboration summary.

## RETIRE
- generic standalone Arhiva destination;
- duplicate state wording between group heading and card;
- root-like profile avatar on this pushed activity screen.

---

# GLAVNI REQUESTER KRUG — SADA JE ZATVOREN U MASTERU

Requester journey ima jasno mesto za svaku fazu:

Početna  
→ Objavite zadatak  
→ AI Need  
→ Review  
→ Publish  
→ Owner Task  
→ Moji zadaci collection  
→ Candidates  
→ Selection  
→ task-group / bilateralni Dogovor  
→ Poruke / Raspored  
→ Completion  
→ Rating  
→ Prethodne saradnje / Prethodni zadaci

Nema potrebe za:
- Moje aktivnosti;
- Mapa kao posebnim svetom;
- root Prilike listom;
- generičnom Arhivom;
- drugim Review ekranom.


# FINALNI HORIZONTALNI PASS — AUTORITET POSLE NORMALIZACIJE

Ovo poglavlje je završni cross-app autoritet kada stariji istorijski primer u Masteru izgleda drugačije.

## Root shell

Bottom nav:
**Početna · Zadaci · Dogovori · Poruke**

Bell:
Obaveštenja

Avatar:
Moj profil

Nema globalnog role switch-a.

## Početna

Redosled:
1. Sledeće — samo ako postoji;
2. Čeka Vas — samo ako postoji;
3. Objavite zadatak / Uskočite i zaradite;
4. AI resume/setup resume samo kada postoji;
5. Moji zadaci;
6. Moje prijave;
7. Dostupnost ili setup radnog profila kada relevantno.

Nema:
- marketplace carousel;
- own task/application carousel;
- stalni `Moj raspored` row.

## Zadaci

Local:
mapa + PEEK/HALF/FULL sheet.

Remote:
full list bez mape.

Nema:
- Map/List toggle;
- `Pretražite ovo područje`;
- requester identity na dense task card-u.

## Dogovori

Root:
Čeka Vas → Danas → Sledeće → Bez tačnog termina → Prethodne saradnje.

Nema stalnog:
`Aktivni | Istorija`.

## Poruke

Task-first recency inbox.

Nema stalnog:
`Aktivni | Istorija`.

Private unread count se ne izmišlja.

## Raspored

Mesec | Nedelja | Dan.

Availability = soft preference.
Agreement = confirmed commitment.

Nema standalone Arhiva.

## Application

Broj ljudi je application-specific.

Nema permanentnog team capacity polja.

Novi Application:
prihvata task schedule/window/deadline.
Ne predlaže alternativni termin.

## Agreement

`Pregled | Poruke`

Cancellation user copy:
**Otkažite saradnju**

Ne `Otkažite Dogovor`.

## Profile

Jedan shared identity:
ime + portrait.

Dve reputacije:
requester / worker.

Radni profil nema drugi identitet niti stalni broj članova ekipe.

## Settings / Privacy

Formalni Vi/Vam/Vas.

Phone sharing nije MVP assumption.

Closure terminal truth samo iz authoritative state-a.

## AI

AI predlaže.
Čovek potvrđuje.
Canonical write nije autonoman AI side effect.

## History

Nema generičnog finalnog `/arhiva` producta.

Istorija živi tamo gde pripada:
- Dogovori → Prethodne saradnje;
- Moji zadaci → Prethodni zadaci;
- Moje prijave → Prethodne.


# HORIZONTALNI AUDIT — VERIFIED CURRENT CODE BASELINE

Direktno provereno protiv branch-a:

`feature/uskoci-cisto`

Verified HEAD tokom ovog passa:

`a9692e11942609bab9406215c3e407d79589dafa`

Ovaj odeljak ne menja product odluke.
On kaže gde se **stvarni trenutni kod razlikuje od finalnog UX-a**.

---

# ROOT SHELL — VERIFIED

Current `_layout.tsx` već ima:

- Početna
- Zadaci
- Dogovori
- Poruke

bez globalnog requester/worker moda.

Pushed screens kriju bottom nav.
Root tab switch je instant.
Pushed flow ima transition.
Reduce Motion postoji.
Retired `mapa`, `prilike`, `moje-aktivnosti` se čiste iz history-ja.

**KEEP.**

## Legacy cleanup

`publicationLanding()` u router-u još sadrži stari compatibility slučaj za publication handoff na `Zadaci`.

Stvarni novi publish flow više ga ne koristi:
`publishedTaskRoute()` vodi na:

`/potrebe/[id]/pregled`

To je finalno ispravno.

Router helper može:
- ostati kratko kao compatibility;
- ili biti uklonjen kada testovi potvrde da stari linkovi više ne zavise od njega.

Ne predstavlja finalni UX.

---

# HOME — VERIFIED DELTA

Current `HomePresentation.tsx` i dalje renderuje:

- horizontalni `OwnTaskCard` carousel;
- horizontalni `ApplicationCard` carousel;
- `ExploreTasksAction`;
- `Aktuelni zadaci` carousel.

Final Master:
**RETIRE sa Home-a.**

Current Home copy i dalje koristi:
- `Čeka te`
- `tvojim`
- `Podesi`
- `Pogledaj`

Final:
formalni Vi/Vam/Vas pass.

KEEP:
- `Sledeće`;
- server attention;
- ratings-due logic;
- partial/stale honesty;
- StartActions;
- IntakeResume;
- Moji zadaci / Moje prijave;
- conditional worker setup/availability.

---

# PUBLISH — VERIFIED

Current `pregled-zadatka.tsx` posle authoritative PUBLISHED readback-a:

`publishedTaskRoute(handoff)`

Current `publicationHandoff.ts` vraća:

`/potrebe/[id]/pregled`

Dakle:
**Publish → Owner Task je već ispravno implementiran.**

KEEP.

Ne vraćati Discovery landing.

---

# ARCHIVE — VERIFIED P0/P1 PRODUCT CLEANUP

Current `/arhiva.tsx` je još pun live screen.

Čita:
- Dogovore;
- Moje zadatke;
- Moje prijave;

i meša ih u jednu arhivu.

Final:
**RETIRE FULL SCREEN.**

Pretvoriti u compatibility redirect.

Preporučeni target:
`Dogovori → Prethodne saradnje`

Stara specifična istorija ostaje u:
- Dogovori;
- Moji zadaci;
- Moje prijave.

`Raspored` više ne nudi Arhivu.

---

# PUSH / NOTIFICATIONS — VERIFIED GAP

Current public push metadata parser zna samo:

- MESSAGE_RECEIVED
- OPPORTUNITY_AVAILABLE
- RESPONSE_RECEIVED
- RESPONSE_UPDATED
- generic INBOX

To je bezbedno, ali nedovoljno za finalni UX.

Notification Inbox resolver već ume više destination tipova:
- Agreement;
- Agreement change;
- completion;
- review;
- selected response;
- Q&A;
- cancelled/revised Need;
- candidates;
- application.

## Final gap

Dodati bezbedne public push mappings za relevantne high-value events, npr:

- RESPONSE_SELECTED
- AGREEMENT_CHANGE_PROPOSED
- AGREEMENT_VERSION_CHANGED
- AGREEMENT_CANCELLED
- COMPLETION_REQUIRED
- EXECUTION_STATE_CHANGED
- REVIEW_RECEIVED
- CLARIFICATION_CREATED / ANSWERED gde policy dozvoljava

Pravilo ostaje:
provider metadata nosi **opaque event ID**, ne raw route i ne privatni sadržaj.

Target se server-side/owned resolverom ponovo autorizuje.

## Copy

Current Notification UI i `inboxCopy.ts` i dalje imaju:
- `tvoj`
- `tvoje`
- `Pogledaj`
- `Otvori`

Final formal pass:
- Vaš/Vaše
- Pogledajte
- Otvorite
- Pregledajte

---

# AUTH — VERIFIED GAP

Current Signup još traži:

- Ime
- Prezime
- Grad
- Email
- Lozinka

Final:
- Ime
- Prezime
- Email
- Lozinka

`Grad` RETIRE iz auth-a.

Geografija:
- Need flow;
- Worker Area.

Password current minimum:
6 znakova.

UI ne izmišlja 8.

---

# DISCOVERY — VERIFIED DELTA

Current route architecture:
- one `/zadaci`;
- `/mapa` redirect;
- `/prilike` redirect;
- retained MarketplaceView;
- relation overlay independent;
- route/focus/account guards.

KEEP.

Current `TaskFace` je bogatiji nego finalni dense card i može crtati:
- publisher;
- rating;
- requirement;
- tool/vehicle;
- age.

Final dense Discovery:
REMOVE iz kartice.

KEEP te facts u data modelu/detail-u gde imaju smisla.

Need:
- exact spatial map/list dataset;
- local/remote separation;
- session spatial cache;
- final PLACE carousel behavior.

---

# PUBLIC TASK DETAIL — VERIFIED DELTA

Current `PublicNeedPresentation` već ima:
- large title;
- summary;
- description;
- photos;
- requirements;
- requester trust;
- Q&A;
- approximate map;
- privacy;
- safety;
- sticky relationship CTA;
- stale/read error handling.

KEEP architecture.

MODIFY order:
**summary → photos → description**

Formal copy.
HOURLY basis formalized `/ sat / osoba`.

Requester public trust prelazi na role-scoped model kada backend bude spreman.

---

# APPLICATION — VERIFIED P0

Current new application UI još ima:

`ExactTimeSheet`

i `start/end` edit.

Final:
**RETIRE iz novog Application flow-a.**

New application prihvata task schedule/window/deadline.
Exact term changes kasnije kroz Agreement.

Legacy unresolved command sa start/end:
exact replay only.

## Current skill mutation

Current route ima `skillOptIn` i može nakon application success-a dodati task category u worker profile.

Final, dopunjeno odlukom vlasnika 03.11.2026:
RETIRE iz osnovnog Application submit-a. Posle potvrđenog slanja ponuditi dodavanje jednim klikom, dostupno i iz Mojih prijava, prema S04 iznad. Nema zasebnog pregleda dopune ili druge potvrde.

Prijava ne menja trajni worker profile kao side effect. Dopuna koristi poznati category ID + mode/handoff već prihvaćenog zadatka i postojeći owned review/Save/outbox/binder u pozadini, bez ponovnog Gemini poziva ili tehničkih detalja na ekranu. Novi izvorni paket je LOCAL_ONLY / NOT_TESTED / NOT_DEPLOYED; prikaz uspeha zahteva readback stvarnog povezivanja.

## Current HOURLY bug

`fixedApplicationPrice()`:

HOURLY → current amount unchanged.

Final:
hourly-per-person × application people.

P0.

## Multi-seat

Final application people:
application-specific.

No permanent Worker Profile team capacity.

Server:
- >=1;
- <= remaining;
- safe max;
- exact whole application selection later.

---

# MOJE PRIJAVE — VERIFIED DELTA

Current paged model je jak:
- server scopes;
- server counts;
- target by application ID;
- pending recovery;
- changed-task resolution;
- withdraw recovery.

KEEP.

Final visible sets:
- Čekaju odgovor
- Čeka Vas
- Prethodne

`Sve` internal/deep-link scope only.

Formal copy.

Changed-application editor:
no new alternative term.

Selected:
strong transition to Dogovor.

---

# CANDIDATES — VERIFIED P0

Current candidate route already keeps:
- Need revision coherence;
- response version/hash;
- idempotent Selection;
- exact readback;
- public profile;
- safety;
- viewed write;
- paged set.

KEEP.

## Price sort

Current price sort uses total application amount.

Final OFFERS comparison:
**total / covered slots**

P0.

## Dense candidate UI

Remove:
- tools/vehicles;
- legacy clutter.

Use:
- person;
- worker trust;
- total;
- comparable per-person;
- people;
- schedule;
- short note.

## Comparison

Current compare mode should become explicit choose-up-to-2 comparison rather than an overloaded always-on alternate list layout.

---

# OWNER TASK — VERIFIED DELTA

Current `NeedPresentation` already has:
- state block;
- applications;
- Q&A;
- photos;
- approximate map;
- edit through AI;
- remaining-search close;
- search recovery;
- lifecycle cancel/delete recovery.

KEEP.

MODIFY hierarchy:
- state/coverage first;
- applications strong;
- task-filtered collaboration destination;
- photos before long description;
- final formal copy.

Current `onAgreements` opens general Dogovori list.

Final:
task-filtered task-group / bilateral destination.

---

# DOGOVORI — VERIFIED FINAL DELTA

Current underlying Agreement architecture remains strong.

Final root UI changes:
- no `Aktivni | Istorija`;
- action/time sections.

Bilateral:
- `Pregled | Poruke`.

User wording:
`Otkažite saradnju`.

Not:
`Otkažite Dogovor`.

Keep technical entity:
Agreement.

---

# PORUKE — VERIFIED DELTA

Current Inbox is already:
- one row per conversation;
- task-first;
- server recency;
- group/private distinct;
- private unread intentionally unknown;
- group unread allowed when authoritative.

KEEP.

Final:
- no permanent `Aktivni | Istorija`;
- formal copy;
- flatter visual list candidate in visual pass.

Group backend today:
**TEXT ONLY.**

Group photo:
P1.
Group voice:
DEFER.

---

# RASPORED — VERIFIED DELTA

Current:
- authoritative worker calendar;
- Month/Week/Day;
- availability shade;
- overlap rendering;
- no-term Dogovori;
- Serbian time;
- partial-read honesty;
- ±2 month prefetch.

KEEP.

MODIFY:
- remove `/arhiva` row;
- requester same-task/same-window presentation aggregation;
- remote deadlines distinct from busy intervals;
- formal copy.

---

# PROFILE — VERIFIED P0

Current Worker Profile already follows:
**ONE NAME**

and AI-first edit.

GOOD.

But Profile hub identity still:
- primarily requester-profile row;
- fallback worker row.

Final:
account-level shared identity authority.

## Reputation

Current hub:
`AccountReputation`

Final:
two role-scoped aggregates.

P0 before public ratings become marketplace trust authority.

## Public preview

Current code chooses worker public profile automatically if worker ACTIVE.

Final:
role-aware preview selector.

---

# WORKER PROFILE — VERIFIED CONSISTENCY FIX

Current code already says:

`Ako za neki zadatak obezbeđuješ više ljudi, njihov broj navodiš u toj ponudi.`

Therefore final product correctly has:
**no permanent team capacity field.**

Earlier contrary Master wording has been removed.

Current tools/vehicles are already treated as information-only by the profile facts layer.

Final ordinary Worker Profile further de-emphasizes them.

Remote-only activation still needs geography rule cleanup:
city cannot be mandatory when only REMOTE.

Available-now still needs expiry/TTL if matching depends on it.

---

# SETTINGS / PRIVACY — VERIFIED DELTA

Current Settings composition:
strong.

KEEP.

MODIFY:
- formal copy;
- provider-aware Account Access;
- privacy wording without implied phone sharing;
- debug metadata internal only.

Current Privacy/Export/Closure architecture:
strong recovery-first model.

KEEP.

Closure final copy must match published retention policy:
do not universally promise deletion.

---

# RATINGS — VERIFIED P0

Current reputation/read model remains account-oriented.

Final requires:
- requester aggregate;
- worker aggregate;
- reviewed role;
- blind unpublished state;
- publish when both submitted OR 14-day deadline;
- no new submit after deadline.

Until backend exists:
public ratings must be gated or clearly not treated as final marketplace trust authority.

---

# CROSS-APP COPY — VERIFIED BACKLOG

Current code still contains substantial informal Serbian:

- Tvoj
- Tvoja
- Tvoje
- te
- ti
- Podesi
- Pogledaj
- Otvori
- Izaberi
- Pošalji
- Odustani

Final UI target:
formal:
**Vi / Vam / Vas / Vaš**

Imperatives:
- Podesite
- Pogledajte
- Otvorite
- Izaberite
- Pošaljite
- Odustanite

Brand slogans / first-person mascots are exempt.

Server-stored notification copy may need:
- migration;
- display normalization where safe;
- new templates formal going forward.

---

# HORIZONTALNI AUDIT — PRIORITETI

## P0 — correctness / contract

1. HOURLY application price × people.
2. Candidate OFFERS sort by comparable per-person/per-slot.
3. Remove new-flow Application alternative-term editor.
4. Shared identity account authority.
5. Role-scoped reputation.
6. Blind rating publication or gate public rating authority.
7. Exact spatial Discovery semantics.
8. Remote deadline not busy interval.
9. Formal server/client event copy where it affects meaning.
10. Keep Selection whole-application / multi-seat integrity.

## P1 — product consistency

11. Retire `/arhiva` full screen.
12. Remove Home carousels + ExploreTasksAction.
13. Task-filtered owner collaboration destination.
14. Push exact mappings beyond current 4 event types.
15. Role-aware own public-profile preview.
16. Remote-only Worker activation.
17. Available-now TTL.
18. Group photos.

## P2 — visual/polish

19. Flatten Poruke rows if visual QA confirms.
20. Exact spacing/radii/icon family final pass.
21. Photo-first Task/Owner detail ordering.
22. Final empty-state illustration allocation.
23. Final animation/reduced-motion review.


# ROUTE COVERAGE — 56/56 KLASIFIKOVANO

Direktno pregledan stvarni Expo Router tree na `feature/uskoci-cisto`.

Ukupno:
**56 TS/TSX route/infrastructure fajlova u `src/app`**

Nijedan route više nije bez product klasifikacije.

Legenda:

- **FINAL** — finalni consumer surface
- **REDIRECT** — compatibility shim, nema zaseban UX
- **INTERNAL** — staff/dev-only
- **SYSTEM** — router/shell/deep-link infrastruktura
- **RETIRE→REDIRECT** — još je live screen, finalno se gasi kao zaseban product

---

## Root / system

| Route | Klasa | Finalna uloga |
|---|---|---|
| `src/app/_layout.tsx` | SYSTEM | auth/session/root routing |
| `src/app/+native-intent.tsx` | SYSTEM | bezbedan deep-link ingress |
| `src/app/auth.tsx` | FINAL | Entry/Auth |
| `src/app/oporavak.tsx` | FINAL | password recovery |
| `src/app/obavestenja.tsx` | FINAL | Notifications inbox |
| `src/app/prijave.tsx` | REDIRECT/legacy | context-free stari candidate entry |

---

## Authenticated shell

| Route | Klasa | Finalna uloga |
|---|---|---|
| `src/app/(app)/_layout.tsx` | SYSTEM | 4-tab shell |
| `src/app/(app)/index.tsx` | FINAL | Početna |
| `src/app/(app)/zadaci.tsx` | FINAL | Discovery |
| `src/app/(app)/dogovori.tsx` | FINAL | Dogovori |
| `src/app/(app)/poruke.tsx` | FINAL | Poruke |

---

## Compatibility discovery/activity routes

| Route | Klasa | Finalna uloga |
|---|---|---|
| `src/app/(app)/mapa.tsx` | REDIRECT | → Zadaci |
| `src/app/(app)/prilike.tsx` | REDIRECT | → Zadaci |
| `src/app/(app)/moje-aktivnosti.tsx` | REDIRECT | → Početna |
| `src/app/(app)/mesto-zadatka.tsx` | REDIRECT | → AI/Review location flow |
| `src/app/(app)/pregled-nacrta.tsx` | REDIRECT | → Pregled zadatka |

---

## Task / requester

| Route | Klasa | Finalna uloga |
|---|---|---|
| `src/app/(app)/potrebe.tsx` | FINAL | Moji zadaci |
| `src/app/(app)/potrebe/[id]/pregled.tsx` | FINAL | Owner Task |
| `src/app/(app)/potrebe/[id]/kandidati.tsx` | FINAL | Candidates + Selection |
| `src/app/(app)/nova.tsx` | FINAL | AI Need |
| `src/app/(app)/pregled-zadatka.tsx` | FINAL | Review / Draft / Publish |
| `src/app/(app)/fotografije-zadatka.tsx` | FINAL | Task photos |
| `src/app/(app)/pitanja-zadatka.tsx` | FINAL | Full Q&A |

---

## Task / worker

| Route | Klasa | Finalna uloga |
|---|---|---|
| `src/app/(app)/prilike/[id].tsx` | FINAL | Public Task detail |
| `src/app/(app)/prilike/[id]/prijava.tsx` | FINAL | Application |
| `src/app/(app)/moje-prijave.tsx` | FINAL | Moje prijave |

---

## Agreement / coordination

| Route | Klasa | Finalna uloga |
|---|---|---|
| `src/app/dogovor/[id].tsx` | FINAL | Bilateralni Dogovor |
| `src/app/dogovor/[id]/grupa.tsx` | FINAL | Group conversation |
| `src/app/dogovor/[id]/izmene.tsx` | FINAL | Agreement change |
| `src/app/(app)/raspored.tsx` | FINAL | Raspored |
| `src/app/(app)/oceni-dogovor.tsx` | FINAL | Rating |

---

## Profile

| Route | Klasa | Finalna uloga |
|---|---|---|
| `src/app/(app)/profil.tsx` | FINAL | Moj profil |
| `src/app/(app)/profil/radnik.tsx` | FINAL | Radni profil |
| `src/app/(app)/profil/razgovor.tsx` | FINAL | Worker AI |
| `src/app/(app)/profil/lokacija.tsx` | FINAL | Područje rada / map confirm |
| `src/app/(app)/profil/dostupnost.tsx` | FINAL | Availability AI entry |
| `src/app/(app)/profil/fotografija.tsx` | FINAL | Shared profile photo |
| `src/app/(app)/profil/podaci.tsx` | FINAL | Lični podaci |
| `src/app/(app)/profil/ocene.tsx` | FINAL | Ocene |
| `src/app/(app)/profil/podesavanja.tsx` | FINAL | Settings |
| `src/app/(app)/profil/obavestenja.tsx` | FINAL | Notification prefs |
| `src/app/(app)/profil/privatnost.tsx` | FINAL | Privacy hub |
| `src/app/(app)/profil/blokirani.tsx` | FINAL | Blocked people |
| `src/app/(app)/profil/izvoz.tsx` | FINAL | Data export |
| `src/app/(app)/profil/pravna.tsx` | FINAL | Legal / consents |
| `src/app/(app)/profil/lozinka.tsx` | FINAL | Account access / password |
| `src/app/(app)/profil/prijava-greske.tsx` | FINAL | Bug report / support shortcut |
| `src/app/(app)/profil/o-aplikaciji.tsx` | FINAL | About |

---

## AI history

| Route | Klasa | Finalna uloga |
|---|---|---|
| `src/app/(app)/ai-istorija/index.tsx` | FINAL | AI History |
| `src/app/(app)/ai-istorija/[conversationId].tsx` | FINAL | Read-only transcript |

---

## Support / safety

| Route | Klasa | Finalna uloga |
|---|---|---|
| `src/app/(app)/bezbednost.tsx` | FINAL | Safety report/block |
| `src/app/(app)/podrska/index.tsx` | FINAL | Support home |
| `src/app/(app)/podrska/novi.tsx` | FINAL | New case |
| `src/app/(app)/podrska/[id].tsx` | FINAL | Case conversation |
| `src/app/(app)/podrska/operator.tsx` | INTERNAL | staff-only inbox |

---

## Route koji se povlači kao pun UX

| Route | Klasa | Finalna odluka |
|---|---|---|
| `src/app/(app)/arhiva.tsx` | RETIRE→REDIRECT | više nije zaseban consumer ekran |

Finalna istorija:
- Dogovori → Prethodne saradnje
- Moji zadaci → Prethodni zadaci
- Moje prijave → Prethodne

---

# ROUTE COVERAGE — ZAKLJUČAK

Nema neklasifikovanog consumer route-a.

Finalna information architecture je zatvorena:

## Root
Početna · Zadaci · Dogovori · Poruke

## Global
Obaveštenja · Profil

## Requester
AI Need → Review → Owner Task → Candidates → Selection

## Worker
Discovery → Task detail → Application → Moje prijave

## Collaboration
Task-group → Bilateral Agreement → Group/Private Poruke → Raspored → Completion → Rating

## Account
Profile → Worker Profile → Settings → Privacy / Support / Legal / Export / Closure

Sve ostalo je:
- redirect;
- internal;
- system infrastructure.

---

# FINALNI BACK MAP — CROSS-APP

Back se prvo vraća na stvarni source kada history postoji.

Cold fallback:

| Ekran | Fallback |
|---|---|
| Auth child | Entry/Auth |
| Task detail | Zadaci |
| Application | Task detail |
| Moje prijave | Početna |
| Owner Task | Moji zadaci / Početna |
| Candidates | Owner Task |
| Task-group | Dogovori |
| Bilateral Agreement | Dogovori |
| Private chat opened from Poruke | Poruke |
| Group chat | Poruke ili task-group |
| Agreement change | Agreement |
| Raspored | Dogovori |
| Rating | Dogovori |
| Profil | Početna |
| Worker Profile child | Radni profil |
| Settings child | Settings |
| Privacy child | Privacy |
| Support case | Support home |
| AI Review | AI conversation |
| Published success | Owner Task |
| Notification unavailable target | Obaveštenja |

Ne hardkodovati fallback kada source/history postoji.

---

# FINALNI CTA PASS — JEDNA GLAVNA RADNJA

## Entry
Objavite zadatak / Uskočite i zaradite

## Task detail
Pošaljite prijavu / Pošaljite ponudu

## Application
Pregledajte prijavu → Pošaljite prijavu

## Candidate
Izaberite

## Agreement
state-dependent:
- Predložite termin
- Zadatak je gotov
- Potvrdite završetak
- Ocenite saradnju

Normalno `Dogovoreno`:
nema silom dodan primary CTA.

## Owner Task
state-dependent:
- Pregledajte prijave
- Otvorite saradnje
- Ponovo tražite ljude
- Review/Publish za draft

## Worker Profile
Započnite/Nastavite razgovor ili Aktivirajte kada je spremno

## Closure
samo finalni irreversible confirm na poslednjem koraku

Pravilo:
**ekran nema primary CTA samo zato što dizajn traži zeleno dugme.**

---

# FINALNI TERMINOLOGY PASS

Jedna stvar = jedno ime:

- Task → **Zadatak**
- Response → **Prijava**
- OFFERS amount → **Ponuda / iznos ponude**
- Selection → korisnički **Izbor**
- Agreement → **Dogovor**
- bilateral lifecycle → **saradnja**
- calendar → **Raspored**
- worker availability → **Dostupnost**
- ended history → **Prethodne...**
- support request → **Zahtev**
- public approximate location → **Približno mesto/područje**
- private exact location → **Tačna lokacija/adresa**

Ne koristiti:
- Agreement ID
- response
- occurrence
- canonical
- projection
- RPC
u consumer copy-u.


# VISUAL-FIRST FAZA — KONAČAN PRODUCT/UX IZGLED

Od ovog mesta primarni cilj Mastera je:
**osmisliti kako idealan USKOČI izgleda i kako se oseća u korišćenju.**

Tehnička činjenica se proverava samo kada menja:
- šta korisnik sme da uradi;
- stanje ekrana;
- privacy/safety;
- da li neka akcija postoji.

Za svaki ekran zaključavamo:
1. šta korisnik prvo vidi;
2. šta je kartica, red, sekcija ili full surface;
3. šta je dominantno, a šta sekundarno;
4. koliko ekran diše;
5. šta ostaje sticky;
6. kako izgleda normalno, prazno, attention i long-content stanje;
7. kako se vraća u prethodni kontekst.

Pravilo:
**ne pravimo dashboard ako je dovoljan miran pregled jednog konkretnog posla.**

---

# DOGOVORI — KONAČNA VIZUELNA IDEJA

Dogovori treba da izgledaju kao:
**lični raspored saradnji sa ljudima.**

Mentalno:
`Šta imam danas, šta sledi i šta je prošlo.`

## Header

**Dogovori**

desno:
- Raspored
- Search/Filter tek kada treba.

Nema velikog `Aktivni | Istorija` switch-a.

## Čeka Vas

Samo ako postoji akcija.

**Čeka Vas**

🟠 **Selidba stana**  
Marko P. · Završetak čeka Vašu potvrdu  
`Potvrdite završetak →`

Max 2–3, zatim `Prikažite sve što Vas čeka`.

## Danas

Najvažnija sekcija.

Dogovor je kompaktna collaboration card, ne velika marketplace kartica.

17:00–20:00  
**Selidba stana**  
[Marko] Marko P. · 2 osobe  
Liman →

Ako requester ima više saradnji na istom tasku:

17:00–20:00  
**Selidba stana**  
[M][N] 2 saradnje  
Liman · 3/3 dogovoreno →

Tap:
- jedna saradnja → bilateralni Dogovor;
- više saradnji → task-group workspace.

## Sledeće

Grupiše se po danima:

**Sutra**

09:00–11:00  
**Montaža police**  
Nikola S. · Grbavica →

**Subota, 31. okt**

14:00–16:00  
**Pomoć pri selidbi**  
Marko P. · Detelinara →

Ako ima mnogo:
`Pogledajte ceo raspored`

## Bez tačnog termina

Samo ako postoji.

**Prevod prezentacije**  
Ana M. · Ove nedelje  
`Dogovorite termin →`

## Prethodne saradnje

Na rootu samo jedan miran ulaz:

**Prethodne saradnje →**

Ne prikazujemo šest meseci istorije na glavnom ekranu.

---

# PRETHODNE SARADNJE — HISTORY MODEL

Header:
**Prethodne saradnje**

Search gore.

Optional filter:
- Sve
- Završene
- Otkazane

Sadržaj se grupiše po vremenu:

**Juče**

Selidba stana  
Marko P.  
Završeno

**Ove nedelje**

Montaža televizora  
Nikola S.  
Završeno

**Oktobar 2026**

Dostava paketa  
Petar M.  
Otkazano

Pomoć pri selidbi  
Jelena S.  
Završeno

**Septembar 2026**

...

Section header meseca može ostati sticky dok korisnik skroluje unazad.

Search:
- task title;
- ime osobe.

---

# DOGOVOR ROOT CARD — ŠTA PRIKAZUJE

Obavezno:
- vreme / datum;
- task title;
- druga osoba ili broj saradnji;
- mesto ako je local;
- attention cue samo kada postoji.

Ne prikazuje:
- cenu u svakoj root kartici;
- full status;
- message preview;
- rating;
- kompletne uslove.

Cena i puni uslovi pripadaju unutrašnjem Dogovoru.

---

# BILATERALNI DOGOVOR — KADA SE UĐE

Full detail screen, ne jedna ogromna kartica.

Header:

←  [avatar] **Marko P.**                 [⋯]
   Uskače · 2 osobe

Tabovi:

**Pregled | Poruke**

## Pregled

### 1. State surface

Jedina vizuelno jača površina.

Normalno:

**Dogovoreno**

Danas · 17:00–20:00

`Sve je potvrđeno.`

Attention:
orange-soft.

Problem:
danger-soft.

Completed:
green/wash.

### 2. Zadatak

Flat row:

**Selidba stana**  
Liman →

### 3. Dogovoreni uslovi

Jedan grouped panel:

**8.000 RSD ukupno**

Termin  
17:00–20:00

Ljudi  
2 osobe

Mesto  
Liman

Ne četiri odvojene kartice.

### 4. Mesto i dolazak

Ako exact nije podeljen:

🔒 **Tačna lokacija još nije podeljena**

Requester:
`Podelite lokaciju`

Worker:
`Zatražite adresu`

Ako jeste:
mini map + address.

### 5. Aktivnost

Miran compact list:

Dogovoreno · 28. okt  
Lokacija podeljena · 28. okt  
Termin izmenjen · 29. okt

`Prikažite sve`

Ne veliki `Tok` tab.

### 6. Secondary actions

Plain rows:
- Izmenite uslove
- Prijavite problem
- Otkažite saradnju

Nisu tri velika dugmeta.

## Sticky CTA

Samo kada postoji jasan sledeći korak:

Worker:
**Zadatak je gotov**

Requester:
**Potvrdite završetak**

Rating:
**Ocenite saradnju**

Flexible:
**Predložite termin**

Normalno `Dogovoreno`:
**nema sticky green dugmeta.**

---

# DOGOVOR — PORUKE TAB

Isti header sa osobom.

Small task strip:

**Selidba stana**  
Danas 17–20 · Liman

Ispod chat.

Ako ima group:
`Svi učesnici | Privatno`

Ne dodatni veliki task card.

---

# TASK DETAIL — ISTI VIZUELNI JEZIK, DVE ULOGE

Worker gleda tuđi task:

1. naslov;
2. cena / ljudi / vreme / mesto;
3. fotografije;
4. opis;
5. važni uslovi;
6. ko je objavio;
7. pitanja i odgovori;
8. približna mapa;
9. sticky prijava.

Owner gleda svoj task:

isti vizuelni skeleton,
ali odmah posle summary-ja dobija:
- stanje zadatka;
- prijave;
- saradnje.

Edit:
jedna mirna olovka gore.

Retke/destruktivne radnje:
pri dnu / overflow.

---

# VISUAL RHYTHM — CEO APK

USKOČI ne treba da izgleda kao `sve je kartica`.

Koristimo 3 nivoa:

## Card / surface
Samo za:
- state;
- tappable record;
- trust/person;
- selected preview;
- review summary.

## Section
Za:
- opis;
- Q&A;
- requirements;
- activity;
- map.

Odvojeno vazduhom + hairline.

## Row
Za:
- secondary action;
- settings;
- navigation;
- short fact.

To sprečava `card soup`.

Screen inset ~20dp.

Velike sekcije 24–32dp.

Grouped facts 12–16dp.

Radius card 18–22.

Orange = attention.  
Green = primary/confirmed.  
Red = destructive/problem.

2.5D samo:
Entry, empty, success, onboarding.

Working screens:
2D icons + fotografije + mapa.
