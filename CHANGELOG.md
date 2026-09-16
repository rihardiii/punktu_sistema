# Izmaiņu žurnāls / Changelog

Visas ievērojamās izmaiņas šajā projektā tiek dokumentētas šajā failā.
All notable changes to this project are documented in this file.

Versiju shēma / versioning: `0.01`, `0.02`, … — pieaugums par `.01` vai vairāk
atkarībā no izmaiņas apjoma. `package.json` atspoguļo to semver formātā
(`0.01` → `0.1.0`).

---

## [0.10] — 2026-09-16

### Pievienots / Added

- **PIN uzminēšanas ierobežojums.** Pieci nepareizi PIN pēc kārtas noslēdz
  kontu uz 5 minūtēm. Slēdzene ir uz konta, nevis uz IP adreses: visa ģimene
  sēž aiz viena maršrutētāja, tāpēc IP slēdzene izmestu no sistēmas visus, tiklīdz
  viens bērns piecas reizes kļūdītos.

  Tas atrisina arī otru problēmu: `scrypt` aizņem ~80 ms bloķējoša CPU laika
  katram mēģinājumam, un desmit vienlaicīgi pieteikšanās pieprasījumi
  aizkavēja visu serveri (`/api/health` no ~10 ms uz 700 ms). Slēdzene tiek
  pārbaudīta **pirms** jaukšanas, tāpēc noslēgts konts vairs nemaksā neko.

- **"Aizmirsi PIN?" pieteikums.** Pieteikšanās ekrānā zem cipariem. Bērna
  pieteikums nonāk pie jebkura vecāka, vecāka — pie administratora. Vecāks to
  redz kā kartīti sadaļā **Ģimene** un var uzreiz iestatīt jaunu PIN.
  Viens atvērts pieteikums uz cilvēku, lai cik reizes pogu nospiestu.

- **Administratora loma.** Viens vecāks — tas, kurš iestatīja lietotni —, kurš
  vienīgais var atiestatīt cita vecāka aizmirsto PIN. Līdz šim to nevarēja
  neviens, tāpēc vecāks ar aizmirstu PIN bija ārpusē uz visiem laikiem.

  Tā ir karodziņš uz vecāka konta (`is_admin`), nevis trešā loma, tāpēc visas
  esošās `role === 'parent'` pārbaudes paliek neskartas. Administratoru nevar
  dzēst vai deaktivizēt, un lomu var nodot citam aktīvam vecākam.

- **Drošības galvenes:** `Content-Security-Policy` (viss tikai no paša
  servera), `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`.

- **`LICENSE` fails (MIT).** README un `package.json` jau apgalvoja MIT, bet
  bez faila GitHub to neatpazīst.

### Labots / Fixed

- **Nederīgs JSON atgrieza 500, nevis 400.** `express.json()` kļūda krita cauri
  vispārīgajam apstrādātājam. Tagad `{"error":"invalid_json"}` ar 400.

- **Versiju nesakritība `docker-compose.yml`.** Bija `punktu-sistema:0.09`,
  kamēr CI publicē `0.10.0` no `package.json`. Tagad abi ir semver.

### Mainīts / Changed

- **Produkcijas būvē vairs nav sourcemap failu.** Tie pievienoja ~1.7 MB katram
  attēlam un katra telefona kešatmiņai. `web/vite.config.ts` — viena rinda atpakaļ.

- **Izvietošana pieņem publisku GHCR pakotni.** Ar publisku repozitoriju arī
  pakotni var padarīt publisku, un tad pazūd viss `docker login` / žetona /
  manuālās vilkšanas cikls — Dockge **Update** poga ir viss, kas vajadzīgs.
  README TrueNAS sadaļa saīsināta no četriem soļiem ar žetoniem uz trim bez.

- **Izņemts "nokopē mapi uz NAS" ceļš** (`deploy/standalone/`). Tas pastāvēja
  tikai tāpēc, lai izvairītos no GHCR žetoniem; ar publisku pakotni tam vairs
  nav jēgas, un tas uzturēja otru, atšķirīgi nosauktu steku (`scoreboard`).

---

## [0.09] — 2026-09-14

### Labots / Fixed

- **`docker login` pamācība bija nepareiza TrueNAS čaulai.** README apgalvoja,
  ka žetons nonāk `/root/.docker/config.json`, bet TrueNAS čaula bieži darbojas
  ar `HOME=/var/empty`, un komanda beidzas ar:

  ```
  Error saving credentials: mkdir /var/empty/.docker: operation not permitted
  ```

  Tagad aprakstīts `DOCKER_CONFIG` uz rakstāmu mapi baseinā
  (`/mnt/apps/.docker`), un vispirms — kā pārbaudīt `whoami` un `$HOME`.

- **Žetons vairs netiek likts komandrindā.** Iepriekšējā `echo "<TOKEN>" |
  docker login --password-stdin` forma atstāj žetonu čaulas vēsturē.
  Tagad tiek izmantota interaktīvā paroles ievade.

### Pievienots / Added

- **Skaidrojums, kāpēc Dockge "Update" poga nestrādā ar privātu attēlu.**
  Dockge darbojas savā konteinerī un izpilda `docker compose pull` ar savu
  akreditācijas datu krātuvi, tāpēc tas neredz čaulā izveidotos datus.
  Pareizā secība ir: `docker pull` no čaulas, tad Dockge → **Restart**.
  `docker compose up` neko nevelk, ja attēls jau ir lejupielādēts.

- **Sadaļa par pakotnes publiskošanu** kā vienkāršāko alternatīvu: repozitorijs
  paliek privāts, bet attēls kļūst publisks, un tad ne `docker login`, ne
  `DOCKER_CONFIG` nav vajadzīgs un Dockge **Update** strādā. Aprakstīts arī,
  ko tas nozīmē (attēlā ir kompilētais kods; noslēpumu tur nav).

- **Trīs jaunas rindas problēmu meklēšanas tabulā** par šīm kļūdām.

### Piezīme

Šīs izmaiņas ir tikai dokumentācijā un komentāros — lietotnes kods nav mainīts.
Uz izstrādes datora nav TrueNAS un Docker, tāpēc komandas nav izpildītas tajā
vidē; tās ir izsecinātas no kļūdas ziņojuma un Docker CLI uzvedības.

## [0.08] — 2026-09-14

### Pievienots / Added

- **Izvietošana bez git** — [`deploy/standalone/compose.yml`](deploy/standalone/compose.yml).
  Lietotni var palaist tieši no nokopētas mapes, izmantojot standarta
  `node:24-bookworm` attēlu. Uz NAS nav vajadzīgs ne git, ne konteineru
  reģistrs, ne GitHub žetons.

  Uzbūvē uz sava datora (`npm run build`), nokopē mapi uz NAS koplietoto
  mapi un palaid steku. Atjaunināšana: pārkopē un restartē.

  `server/dist` un `web/dist` ir tīrs JavaScript un HTML, tāpēc tie ir
  pārnesami starp Windows un Linux. Vienīgā platformai specifiskā daļa ir
  `better-sqlite3` kompilētais binārfails, tāpēc `node_modules` netiek kopēts —
  konteiners to uzstāda pats. Ja `node_modules` tomēr tiek nokopēts no Windows,
  konteiners to pamana (`require('better-sqlite3')` pārbaude) un pārinstalē.

  Atkarības tiek pārinstalētas tikai tad, ja mainījies `package-lock.json`
  (`.deps-stamp` ar kontrolsummu), tāpēc parasts restarts ir dažas sekundes,
  nevis minūtes.

  Palaišanas skripts ir ierakstīts tieši `compose.yml` failā, nevis atsevišķā
  `.sh` failā: no Windows nokopēts skripts nonāk ar CRLF rindu beigām un
  neizpildās ar maldinošu kļūdu "no such file or directory".

- **README tabula**, kas salīdzina abus ceļus (nokopē mapi / GHCR attēls), un
  norāde, ka failus var lejupielādēt arī ar GitHub **Download ZIP**, ja git
  nestrādā.

### Pārbaudīts / Verified

Nokopēšanas ceļš ir pārbaudīts pilnībā, lokāli:

- sagatavota tīra kopija (bez `node_modules`, `.git`, `data`) — 3 MB;
- `npm ci --omit=dev` tajā; serveris startē un apkalpo lietotni;
- `smoke.sh` 30/30 pret šo kopiju;
- palaišanas skripts izpildīts divreiz: pirmajā reizē uzstāda atkarības un
  ieraksta kontrolsummu, otrajā to izlaiž un startē dažās sekundēs;
- pārbaudīta arī kļūdas apstrāde, kad `dist` nav nokopēts.

## [0.07] — 2026-09-14

### Mainīts / Changed

- **Atjaunināšana vairs nav automātiska.** Watchtower ir izņemts no
  `deploy/dockge-stack.yml`. Attēls joprojām tiek uzbūvēts un publicēts pēc
  katra `git push`, bet NAS to paņem tikai tad, kad pats nospied **Update**
  Dockge saskarnē (vai `docker compose pull && docker compose up -d`).

  Līdz ar to uz NAS vairs nedarbojas konteiners ar piekļuvi `docker.sock`.

- **Attēls paliek privāts.** README vairs nepiedāvā padarīt GHCR pakotni
  publisku; vienīgais ceļš ir vienreizējs `docker login ghcr.io` uz NAS ar
  `read:packages` žetonu.

- **README papildināts ar atgriešanos uz iepriekšējo versiju.** Katrs attēls ir
  marķēts arī ar versijas numuru un commit SHA, tāpēc stekā pietiek nomainīt
  tagu uz, piemēram, `:0.6.0`. Aprakstīts arī, kā turēt steku uz konkrēta taga
  `latest` vietā, ja negribi negaidītas izmaiņas.

## [0.06] — 2026-09-14

Automātiska piegāde uz NAS / Continuous delivery to the NAS.

### Pievienots / Added

- **`.github/workflows/ci.yml`** — pēc katra `git push` uz `main` tiek palaisti
  testi un, ja tie iziet, uzbūvēts un publicēts attēls uz
  `ghcr.io/rihardiii/punktu_sistema`.

  Publicēšana ir atkarīga no testiem (`needs: test`): ja `typecheck`, `build`
  vai `smoke.sh` krīt, jauns attēls **netiek** publicēts un NAS turpina
  darbināt iepriekšējo strādājošo versiju. Tas ir būtiski, jo atjaunināšana ir
  automātiska — bez šī sliktu commit varētu automātiski aizpildīt ģimenes NAS.

  Attēls tiek marķēts ar `latest`, versijas numuru (`0.6.0`) un commit SHA,
  tāpēc atgriezties uz iepriekšējo versiju var, nomainot tagu.

- **`deploy/dockge-stack.yml`** — gatavs steks Dockge ar Watchtower, kas
  atjaunina **tikai** `punkti` konteineru (`WATCHTOWER_LABEL_ENABLE`), tāpēc
  pārējie konteineri uz tā paša NAS netiek aiztikti.

- **README sadaļa par TrueNAS** pārrakstīta: GHCR + Watchtower plūsma,
  privāta attēla autorizācija ar `read:packages` žetonu, datu mapes izveide,
  atgriešanās uz iepriekšējo versiju un problēmu meklēšanas tabula.

### Labots / Fixed

- **README rezerves kopijas komanda nestrādāja.** `better-sqlite3` metode
  `.backup()` atgriež `Promise`, bet komandā tas netika gaidīts, tāpēc process
  beidzās, pirms fails bija uzrakstīts — rezerves kopija klusi nesanāca.
  Pārbaudīts: izlabotā komanda izveido kopiju, kuras `pragma integrity_check`
  ir `ok` un kurā ir visas septiņas tabulas.

### Piezīme par pārbaudi / Testing note

Uz izstrādes datora nav ne Docker, ne GitHub Actions izpildvides, tāpēc
**attēla būve un darbplūsma nav izpildīta**. Pārbaudīts tika:

- visi YAML faili (`ci.yml`, `dockge-stack.yml`, `docker-compose.yml` un
  README ielīmējamais bloks) korekti parsējas;
- visas izmantotās GitHub darbības eksistē norādītajās versijās;
- rezerves kopijas komanda (palaista lokāli, pārbaudīta integritāte);
- `npm run typecheck`, `npm run build`, `smoke.sh` 30/30 un `web/test/ui.mjs`
  — tie paši soļi, ko izpilda `test` darbs.

## [0.05] — 2026-09-13

Darbināšana uz NAS / Running it on a NAS.

### Pievienots / Added

- **`Dockerfile`** — divpakāpju build. Būvēšanas rīki (TypeScript, Vite) paliek
  pirmajā pakāpē un nenonāk gatavajā attēlā. Datubāze atrodas `/data` sējumā,
  nekad attēlā, tāpēc lietotnes atjaunināšana nekad neaiztiek ģimenes punktus.
- **`docker-compose.yml`** — gatavs gan TrueNAS SCALE *Custom App* ekrānam, gan
  parastam `docker compose up -d`. Ar `healthcheck` un `no-new-privileges`.
- **`docker-entrypoint.sh`** — sakārto `/data` īpašnieku un nomet privilēģijas
  uz nepriviliģētu lietotāju. Ja konteiners jau palaists kā `user: "568:568"`
  (TrueNAS `apps` konts), tas vienkārši nodod vadību tālāk.
- **README sadaļas** par TrueNAS SCALE 24.10+ (datu kopas sagatavošana, attēla
  pārnešana bez reģistra, *Install via YAML*, ZFS momentuzņēmumi, problēmu
  meklēšanas tabula) un par parastu Docker.

### Piezīme par pārbaudi / Testing note

Uz izstrādes datora nav Docker, tāpēc **attēls nav uzbūvēts un palaists**.
Pārbaudīts tika viss, ko bez Docker var pārbaudīt:

- serveris startē un apkalpo lietotni, kad uzstādītas **tikai** ražošanas
  atkarības (`npm ci --omit=dev`) — tieši tā, kā to dara `Dockerfile`;
- `server/test/smoke.sh` — 30/30 pret šo ražošanas uzstādījumu;
- `healthcheck` komanda atgriež `0`, kad serveris strādā, un `1`, kad ne;
- `docker-entrypoint.sh` sintakse (`sh -n`).

## [0.04] — 2026-09-13

### Labots / Fixed

- **Teksta lauki dialoglodziņos zaudēja fokusu pēc katra nospiestā taustiņa.**
  Pievienojot ģimenes locekli, vārdā, lietotājvārdā un PIN laukā varēja ievadīt
  tikai vienu rakstzīmi — tālāk fokuss pārlēca uz dialoglodziņu. Tas skāra visus
  dialoglodziņus: darbu un balvu labošanu, punktu korekcijas un noraidīšanas
  piezīmi.

  Cēlonis: `Modal` komponentes efekts bija atkarīgs no `onClose`, ko katrs
  izsaucējs padod kā jaunu funkciju katrā renderēšanas reizē. Tāpēc efekts
  izpildījās no jauna pēc katra taustiņa nospiešanas un tajā esošais
  `focus()` izrāva fokusu no ievades lauka. Tagad atsauce tiek glabāta `ref`,
  un efekts izpildās tikai vienreiz.

- **`autoFocus` dialoglodziņos beidzot darbojas.** Tas pats `focus()` izsaukums
  klusi atcēla to uzreiz pēc atvēršanas. Tagad fokuss tiek pārvietots uz
  dialoglodziņu tikai tad, ja tajā jau kaut kas nav fokusēts.

### Pievienots / Added

- **`web/test/ui.mjs`** — pārlūka regresijas testi. Tie raksta tekstu pa vienam
  taustiņam (`pressSequentially`), nevis ar `fill()`; tieši tāpēc iepriekšējie
  testi šo kļūdu nepamanīja — `fill()` ieraksta vērtību vienā solī un nekad
  nepakļauj sevi fokusa zaudēšanai starp taustiņiem.
  Playwright apzināti nav projekta atkarība; skat. faila komentāru.

---

## [0.03] — 2026-09-13

### Labots / Fixed

- **Datubāzes atrašanās vieta vairs nav atkarīga no palaišanas mapes.** Agrāk
  `data/punkti.sqlite` tika meklēts attiecībā pret procesa darba mapi, tāpēc
  `npm start` no projekta saknes to izveidoja `server/data/`, nevis `data/`, kā
  aprakstīts README. Sliktākajā gadījumā pakalpojums (piem., `systemd`), kas
  palaists no citas mapes, būtu izveidojis otru, tukšu datubāzi, un visi punkti
  būtu "pazuduši". Tagad ceļš tiek noteikts attiecībā pret projekta sakni.
  `PUNKTI_DB` joprojām pārraksta to pilnībā.

> **Ja jau esi palaidis 0.02:** pārbaudi, vai `server/data/punkti.sqlite`
> eksistē, un pārvieto to uz `data/punkti.sqlite` (kopā ar `-wal` un `-shm`
> failiem, ja tādi ir).

---

## [0.02] — 2026-09-13

Lietotāja saskarne / The web app.

### Pievienots / Added

- **React 19 + Vite PWA**, ko serveris pasniedz kopā ar API. Instalējama kā
  īsta lietotne uz Android, Windows un Linux (*Pievienot sākuma ekrānam*).
- **Pieteikšanās ar sejām** — bērns uzspiež uz sava attēla un ievada PIN uz
  liela cipartaustiņa. Nav jāatceras un jāraksta lietotājvārds.
- **Bērna ekrāni:**
  - Sākums — lielā punktu bilance, labo darbu režģis ar ikonām, savi pieteikumi.
  - Balvas — balvu veikals; pārāk dārgās ir aizslēgtas ar norādi, cik vēl trūkst.
  - Vēsture — pilna punktu virsgrāmata ar pamatojumiem.
  - Konfetti, kad vecāks apstiprina darbu.
- **Vecāka ekrāni:**
  - Pārskats — cik gaida lēmumu, katra bērna bilance un nedēļas rezultāts.
  - Jāizskata — apstiprināšanas rinda ar pogām «Apstiprināt» / «Noraidīt» un
    iespēju pierakstīt, kāpēc noraidīts.
  - Darbi un balvas — katalogu pārvaldība ar emocijzīmju izvēlni.
  - Ģimene — bērnu un vecāku pievienošana, PIN atiestatīšana, punktu korekcijas.
- **Tēmas** — gaišā, tumšā, sistēmas, plus brīvi izvēlama akcenta krāsa. Teksta
  krāsa uz akcenta tiek aprēķināta no spilgtuma, tāpēc arī gaiša pielāgota
  krāsa paliek salasāma.
- **Valodas** — latviešu (noklusējums) un angļu, pārslēdzamas iestatījumos.
  Labajiem darbiem un balvām var ievadīt abus nosaukumus.
- **Bērniem draudzīgs dizains** — lieli pieskāriena mērķi (48 px), apaļas
  formas, emocijzīmes ikonu vietā, apakšējā navigācija īkšķa sniedzamībā.
- **README** ar uzstādīšanu, telefona pieslēgšanu, rezerves kopijām un
  `systemd` pakalpojumu Raspberry Pi.

### Labots / Fixed

- Pogu grupas (tēmas izvēle, krāsas, emocijzīmes) vairs nav ietvertas `<label>`
  elementā. Ekrānlasītājam katras pogas nosaukums bija visa lauka teksts —
  «Tēma 🌙 Tumšā ⚙️ Sistēmas» vietā «Tumšā». Tagad tās ir `role="group"`.
- Trīs skaitļu lauciņi vēstures ekrānā ietilpst vienā rindā arī uz šaura
  telefona.

---

## [0.01] — 2026-09-13

Pirmā versija: servera puse / First release: the backend.

### Pievienots / Added

- **Projekta pamati** — npm darbvietas (`server`, `web`), Node 24, TypeScript.
- **Datubāze** — SQLite (`better-sqlite3`) ar migrāciju sistēmu, kas izmanto
  `user_version`. Dati glabājas vienā failā (`data/punkti.sqlite`), ko var
  vienkārši nokopēt kā rezerves kopiju.
- **Lietotāji un lomas** — `parent` (Mamma/Tētis, administratori) un `kid`.
  Vecākiem var būt vairāki bērni.
- **Autentifikācija** — PIN kods (4–10 cipari), `scrypt` jaukšana, sesijas
  sīkdatnē. Pirmās palaišanas iestatīšana izveido pirmo vecāku.
- **Labo darbu katalogs** (`deeds`) — nosaukums LV/EN, ikona, punktu svars,
  kategorija. Vecāki var pievienot, labot un dzēst.
- **Balvu katalogs** (`rewards`) — konsoles laiks, nauda, u.c., ar cenu punktos.
- **Pieteikumi** (`submissions`) — bērns piesaka padarītu darbu, vecāks apstiprina
  vai noraida. Punkti tiek pieskaitīti tikai pēc apstiprinājuma.
- **Balvu pieprasījumi** (`redemptions`) — bērns pieprasa balvu, vecāks lemj.
  Punkti tiek *rezervēti* pieprasījuma brīdī un norakstīti tikai pēc
  apstiprinājuma, tāpēc bērns nevar pieprasīt vairāk, nekā viņam ir.
- **Punktu virsgrāmata** (`ledger`) — tikai papildināms ieraksts. Bilance vienmēr
  ir `SUM(delta)`, nekad saglabāts skaitītājs, tāpēc to var pārrēķināt un audidēt.
- **Manuālas korekcijas** — vecāks var pievienot vai atņemt punktus ar obligātu
  pamatojumu.
- **Sākuma katalogs** — 12 labie darbi un 8 balvas latviski, lai lietotni varētu
  sākt lietot uzreiz.
- **Automātiskie testi** — `server/test/smoke.sh`, 30 pārbaudes, kas aptver visu
  plūsmu un aizsargmehānismus.

### Drošība / Security

- Bērns redz tikai savus punktus un vēsturi — ne brāļa vai māsas.
- Dubulta apstiprinājuma aizsargs: tikai `pending` ierakstu var izskatīt, tāpēc
  divreiz nospiesta poga nepieskaita punktus divreiz.
- Pēdējo aktīvo vecāku nevar deaktivizēt vai dzēst.
- Vecāks nevar nomainīt cita vecāka PIN.
- PIN nekad netiek atgriezts API atbildēs.
