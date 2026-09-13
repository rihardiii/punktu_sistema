# Izmaiņu žurnāls / Changelog

Visas ievērojamās izmaiņas šajā projektā tiek dokumentētas šajā failā.
All notable changes to this project are documented in this file.

Versiju shēma / versioning: `0.01`, `0.02`, … — pieaugums par `.01` vai vairāk
atkarībā no izmaiņas apjoma. `package.json` atspoguļo to semver formātā
(`0.01` → `0.1.0`).

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
