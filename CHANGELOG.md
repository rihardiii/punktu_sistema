# Izmaiņu žurnāls / Changelog

Visas ievērojamās izmaiņas šajā projektā tiek dokumentētas šajā failā.
All notable changes to this project are documented in this file.

Versiju shēma / versioning: `0.01`, `0.02`, … — pieaugums par `.01` vai vairāk
atkarībā no izmaiņas apjoma. `package.json` atspoguļo to semver formātā
(`0.01` → `0.1.0`).

---

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
