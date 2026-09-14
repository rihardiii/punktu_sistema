# ⭐ Punktu sistēma

**Ģimenes punktu sistēma par labiem darbiem.** Bērni piesaka padarītos darbus,
vecāki tos apstiprina, un punktus var apmainīt pret balvām — konsoles laiku,
kabatas naudu, filmu vakaru.

Lietotne darbojas **tavā mājas tīklā**. Nav publiska servera, nav mākoņa, nav
konta pie kādas firmas. Visi dati glabājas vienā failā uz tavas ierīces.

*A self-hosted family points system. Kids submit good deeds, parents approve
them, points buy rewards. Runs on your home network — no public server, no
cloud account. Latvian interface with English built in.*

---

## Saturs / Contents

- [Ātrais sākums](#ātrais-sākums--quick-start)
- [Kā to lieto ģimene](#kā-to-lieto-ģimene--how-a-family-uses-it)
- [Piekļuve no telefona](#piekļuve-no-telefona--access-from-a-phone)
- [TrueNAS SCALE](#truenas-scale)
- [Docker (jebkur)](#docker-jebkur)
- [Automātiskā atjaunināšana](#kā-izskatās-atjaunināšana)
- [Rezerves kopijas](#rezerves-kopijas--backups)
- [Drošība](#drošība--security)
- [Izstrādei](#izstrādei--development)

---

## Ātrais sākums / Quick start

Nepieciešams **Node.js 20 vai jaunāks** ([nodejs.org](https://nodejs.org)).

```bash
git clone https://github.com/rihardiii/punktu_sistema.git
cd punktu_sistema
npm install
npm run build
npm start
```

Serveris parādīs adreses, kuras atvērt pārlūkā:

```
  Punktu sistēma v0.06
  Datubāze / database: C:\...\punktu_sistema\data\punkti.sqlite
  Lokāli / local:      http://localhost:4173
  Tīklā / on the LAN:  http://192.168.1.132:4173
```

Atver **lokālo** adresi, izveido pirmo vecāka kontu — un viss. Lietotne uzreiz
ir aizpildīta ar 12 labajiem darbiem un 8 balvām latviski, ko vari brīvi labot.

### Iestatījumi / Configuration

| Mainīgais   | Noklusējums          | Apraksts                               |
| ----------- | -------------------- | -------------------------------------- |
| `PORT`      | `4173`               | Servera ports                          |
| `HOST`      | `0.0.0.0`            | `127.0.0.1`, lai atļautu tikai lokāli  |
| `PUNKTI_DB` | `<projekts>/data/punkti.sqlite` | Datubāzes faila atrašanās vieta |

```bash
PORT=8080 PUNKTI_DB=/mnt/usb/punkti.sqlite npm start
```

---

## Kā to lieto ģimene / How a family uses it

**Bērns** atver lietotni, uzspiež uz sava attēla, ievada PIN, un redz savus
punktus. Viņš izvēlas padarīto darbu no režģa, pieliek piezīmi un piesaka to.

**Vecāks** redz pieteikumu sarakstā "Jāizskata" un vienā pieskārienā apstiprina
vai noraida. Punkti tiek pieskaitīti tikai pēc apstiprinājuma.

**Balvas:** bērns pieprasa balvu, punkti tiek *rezervēti*, un vecāks lemj. Ja
vecāks atsaka, punkti atgriežas — bērns neko nezaudē.

### Punktu grāmatvedība

Bilance vienmēr ir **visu virsgrāmatas ierakstu summa**, nekad atsevišķi
saglabāts skaitlis. Tas nozīmē, ka katram punktam ir izsekojama izcelsme, un
bilanci vienmēr var pārrēķināt no vēstures.

```
  Bērns piesaka darbu   →  gaida  →  vecāks apstiprina  →  virsgrāmata  +punkti
  Bērns grib balvu      →  gaida  →  vecāks apstiprina  →  virsgrāmata  −cena
                            (punkti rezervēti)
```

Kad darbs ir apstiprināts, tā nosaukums, ikona un punktu vērtība tiek
**iesaldēti** ierakstā. Vēlāka darba cenas maiņa katalogā nekad nepārraksta
vēsturi.

---

## Piekļuve no telefona / Access from a phone

Serveris jau klausās visā tīklā. Telefonā (tajā pašā Wi-Fi) atver **tīkla
adresi**, ko serveris izdrukāja, piemēram `http://192.168.1.132:4173`.

Lietotne ir PWA, tāpēc to var uzinstalēt kā īstu aplikāciju:

- **Android (Chrome):** ⋮ → *Add to Home screen* / *Pievienot sākuma ekrānam*
- **iPhone (Safari):** Share → *Add to Home Screen*
- **Windows / Linux (Chrome, Edge):** adreses joslā instalēšanas ikona

Pēc tam tā atveras pilnekrānā, bez pārlūka joslām, ar savu ikonu.

> **Padoms:** lai adrese nemainītos, maršrutētājā piešķir servera datoram
> fiksētu IP (*DHCP reservation*).

### Kur to turēt ieslēgtu

Jebkurš dators mājās der. Ja mājās ir NAS, tas ir labākais variants — tas jau
darbojas visu diennakti un tam ir rezerves kopijas.

---

## TrueNAS SCALE

TrueNAS SCALE 24.10+ darbina lietotnes ar Docker. Ieteicamais veids ir
publicēts attēls no GitHub + **Watchtower**, kas to automātiski atjaunina —
tad pietiek ar `git push`, un pēc dažām minūtēm NAS jau darbina jauno versiju.

```
  git push  →  GitHub Actions (testi + build)  →  ghcr.io  →  Watchtower  →  NAS
```

Ja testi krīt, attēls netiek publicēts un ģimene turpina lietot iepriekšējo
strādājošo versiju.

### 1. Ieslēdz attēla publicēšanu

`.github/workflows/ci.yml` jau ir repozitorijā. Pēc pirmā `git push` uz `main`
tas uzbūvē un publicē `ghcr.io/rihardiii/punktu_sistema:latest`.

Skaties **GitHub → Actions**. Pirmā reize aizņem pāris minūtes.

### 2. Ļauj NAS lejupielādēt attēlu

Ja repozitorijs ir privāts, arī attēls ir privāts. Izvēlies vienu:

**a) Paliec pie privāta** (ieteicams) — vienreiz pieraksties NAS terminālī:

```bash
# GitHub → Settings → Developer settings → Personal access tokens
# → Tokens (classic) → Generate, atzīmē tikai `read:packages`
echo "<TOKEN>" | docker login ghcr.io -u rihardiii --password-stdin
```

Tas izveido `/root/.docker/config.json`, ko Watchtower izmanto.

**b) Padari attēlu publisku** — GitHub → repozitorijs → **Packages** →
`punktu_sistema` → *Package settings* → *Change visibility* → Public.
Tad `docker login` nav vajadzīgs, un no `dockge-stack.yml` var izdzēst rindu ar
`/root/.docker/config.json`. Pievērs uzmanību: tad attēls (un līdz ar to
kompilētais kods) ir publiski pieejams, pat ja repozitorijs paliek privāts.

### 3. Izveido datu mapi

NAS terminālī:

```bash
mkdir -p /mnt/apps/punkti/data
```

Šeit glabāsies `punkti.sqlite` — vienīgais, ko nevar atjaunot no jauna.
Konteiners startē kā `root`, pats sakārto mapes īpašnieku un tad nomet
privilēģijas, tāpēc mapes īpašnieks uz resursdatora nav svarīgs.

### 4. Pievieno steku Dockge

Dockge → **Compose** → jauns steks ar nosaukumu `punkti`. Ielīmē saturu no
[`deploy/dockge-stack.yml`](deploy/dockge-stack.yml) un nospied **Deploy**.

Īsumā tas satur:

```yaml
services:
  punkti:
    image: ghcr.io/rihardiii/punktu_sistema:latest
    container_name: punkti
    restart: unless-stopped
    ports:
      - 4173:4173
    volumes:
      - /mnt/apps/punkti/data:/data
    environment:
      PUNKTI_DB: /data/punkti.sqlite
      TZ: Europe/Riga
    labels:
      com.centurylinklabs.watchtower.enable: "true"

  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /root/.docker/config.json:/config.json:ro
    environment:
      WATCHTOWER_LABEL_ENABLE: "true"
      WATCHTOWER_POLL_INTERVAL: "300"
      WATCHTOWER_CLEANUP: "true"

networks: {}
```

Watchtower ir ierobežots ar `WATCHTOWER_LABEL_ENABLE`, tāpēc tas atjaunina
**tikai** `punkti` konteineru un nekad neaiztiek AdGuard Home vai citus
konteinerus uz tā paša NAS.

Atver `http://<nas-ip>:4173` un izveido pirmo vecāka kontu.

### Kā izskatās atjaunināšana

1. Izdari izmaiņas un `git push`.
2. GitHub Actions palaiž testus un publicē jaunu `:latest`.
3. Watchtower to pamana (līdz 5 min), pārlādē konteineru — parasti dažas
   sekundes dīkstāves.
4. Telefonos PWA atjaunina sevi pati (`registerType: 'autoUpdate'`).

Datubāze ir pievienotajā mapē, nevis attēlā, tāpēc atjaunināšana nekad
neaiztiek punktus.

Ja negribi automātisku atjaunināšanu, izdzēs `watchtower` servisu un spied
**Update** Dockge saskarnē, kad pats vēlies.

> **Par Watchtower:** `containrrr/watchtower` pēdējo reizi tika publicēts
> 2023. gada novembrī — projekts vairs netiek aktīvi uzturēts. Tas joprojām
> strādā un ir visizplatītākais risinājums, bet tam ir piekļuve
> `docker.sock`, tāpēc der zināt, ka tas ir "iesaldēts".
>
> Divas alternatīvas, ja tas traucē:
>
> - uzturēts atzars: `nickfedor/watchtower` tā vietā (tie paši iestatījumi);
> - bez papildu dēmona vispār — cron uzdevums uz NAS:
>
>   ```bash
>   # katru stundu: pavelk jaunu attēlu un pārstartē, ja tas ir mainījies
>   0 * * * * cd /opt/stacks/punkti && docker compose pull -q && docker compose up -d
>   ```

### Rezerves kopijas

**Data Protection → Periodic Snapshot Tasks** uz datu kopu, kurā ir
`/mnt/apps/punkti`. Ar ieslēgtu WAL režīmu parasts ZFS momentuzņēmums praksē
der; garantēti konsistentu kopiju var iegūt ar:

```bash
docker exec punkti node -e "
const D=require('better-sqlite3');
const out='/data/backup-'+new Date().toISOString().slice(0,10)+'.sqlite';
new D(process.env.PUNKTI_DB,{readonly:true}).backup(out)
  .then(()=>{console.log('saved '+out);process.exit(0)})
  .catch(e=>{console.error(e.message);process.exit(1)});
"
```

> `.backup()` atgriež `Promise` — bez `.then()` process beidzas, pirms fails ir
> pilnībā uzrakstīts, un rezerves kopija klusi nesanāk.

### Problēmu meklēšana

| Simptoms | Iemesls |
| -------- | ------- |
| `denied` / `unauthorized`, velkot attēlu | Attēls ir privāts un NAS nav pierakstījies. Skat. 2. soli. |
| `SQLITE_CANTOPEN` | `/mnt/apps/punkti/data` neeksistē. Skat. 3. soli. |
| Lietotne nestartē pēc atjaunināšanas | `docker logs punkti`; atgriezies uz iepriekšējo tagu, nomainot `:latest` uz versijas numuru, piem. `:0.6.0`. |
| Watchtower neko nedara | Pārbaudi, vai `punkti` ir `com.centurylinklabs.watchtower.enable` iezīme. |
| Lapa atveras, bet telefonā ne | Pārbaudi portu un TrueNAS ugunsmūri. |

```bash
docker logs -f punkti
docker logs -f watchtower
```

### Ja gribi būvēt pats, bez GitHub

```bash
docker build -t punktu-sistema:local .
docker save punktu-sistema:local | gzip > punkti.tar.gz
scp punkti.tar.gz truenas.local:/mnt/apps/
ssh truenas.local "gunzip -c /mnt/apps/punkti.tar.gz | docker load"
```

Tad stekā norādi `image: punktu-sistema:local` un izdzēs `watchtower`.

---

## Docker (jebkur)

Uz jebkura datora ar Docker pietiek ar:

```bash
git clone https://github.com/rihardiii/punktu_sistema.git
cd punktu_sistema
# nomaini ceļu sadaļā `volumes:` uz savu mapi
docker compose up -d
```

Lietotne būs pieejama uz `http://<datora-ip>:4173`.

```bash
docker compose logs -f     # žurnāli
docker compose down        # apturēt
docker compose up -d --build   # atjaunināt pēc git pull
```

Datubāze ir pievienotajā mapē, nevis attēlā, tāpēc konteinera pārbūve nekad
neaiztiek ģimenes punktus.

---

### Uz Raspberry Pi vai cita Linux datora

Ja NAS nav, Raspberry Pi ir lēts un kluss variants:

```bash
# Raspberry Pi / Linux — palaist automātiski
sudo tee /etc/systemd/system/punkti.service > /dev/null <<'EOF'
[Unit]
Description=Punktu sistema
After=network.target

[Service]
WorkingDirectory=/home/pi/punktu_sistema
ExecStart=/usr/bin/npm start
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now punkti
```

---

## Rezerves kopijas / Backups

Visa ģimenes vēsture ir vienā SQLite failā — `data/punkti.sqlite`. Rezerves
kopija ir faila kopēšana.

```bash
# Drošākais veids (arī tad, ja serveris darbojas)
sqlite3 data/punkti.sqlite ".backup 'backup-2026-09-13.sqlite'"

# Vienkāršākais: apturi serveri un nokopē visu mapi
cp -r data/ /mnt/backup/punkti/
```

Ja mapi `data/` novieto Seafile, Syncthing vai Dropbox mapē, kopijas veidojas
pašas. Faili `-wal` un `-shm` ir SQLite darba faili; kopē tos līdzi.

---

## Drošība / Security

Šī lietotne ir domāta **uzticamam mājas tīklam**, un tās izvēles to atspoguļo:

- PIN kodi tiek glabāti jaukti (`scrypt` ar individuālu sāli), nekad atklātā
  tekstā, un nekad netiek atgriezti API atbildēs.
- Sesijas ir `httpOnly` sīkdatnēs ar 30 dienu derīgumu.
- Bērns nevar redzēt brāļa vai māsas punktus, vēsturi vai pieteikumus.
- Bērns nevar apstiprināt savu pieteikumu, mainīt darbu vērtības vai piešķirt
  sev punktus.
- Pēdējo aktīvo vecāku nevar deaktivizēt vai dzēst.
- Vecāks nevar nomainīt cita vecāka PIN (tikai savu un bērnu).

**Ko tā apzināti nedara:** nav HTTPS, nav aizsardzības pret PIN uzminēšanu
brutālā spēkā, un pieteikšanās ekrāns rāda ģimenes vārdus ikvienam, kas atver
adresi. Tas ir apzināts kompromiss lietojamībai mājās. **Nepublicē šo lietotni
internetā** un neatver tai portu maršrutētājā. Ja vajag piekļuvi no ārpuses,
izmanto VPN (piemēram, WireGuard vai Tailscale).

---

## Izstrādei / Development

```bash
npm run dev:server   # API ar automātisku pārlādi, ports 4173
npm run dev:web      # Vite, ports 5173, ar starpniekserveri uz /api
npm run typecheck    # TypeScript pārbaude abām daļām
```

Atver `http://localhost:5173`.

### Uzbūve / Architecture

```
server/          Node + Express + SQLite (better-sqlite3), TypeScript
  src/schema.ts    Migrācijas — pievieno jaunu, nekad nelabo veco
  src/points.ts    Bilances aprēķins no virsgrāmatas
  src/routes/      REST API
  test/smoke.sh    30 pārbaudes visai plūsmai
web/             React 19 + Vite, PWA
  src/i18n.tsx     Latviešu un angļu valoda
  src/theme.tsx    Gaišā / tumšā / pielāgota tēma
  src/styles/      Dizaina mainīgie un komponentes
  test/ui.mjs      Pārlūka testi (Playwright, nav obligāta atkarība)
Dockerfile         Divpakāpju build; datubāze /data sējumā
docker-compose.yml Parastam Docker (ar `build:`)
deploy/            Gatavs Dockge steks TrueNAS ar Watchtower
.github/workflows/ Testi un attēla publicēšana uz ghcr.io
```

### Testi

API testi (30 pārbaudes, nav vajadzīgas papildu atkarības):

```bash
PUNKTI_DB=/tmp/test.sqlite PORT=4199 npm run dev:server &
BASE=http://localhost:4199 bash server/test/smoke.sh
```

Pārlūka testi (vajadzīgs Playwright; jāpalaiž pret tukšu datubāzi):

```bash
npm install --no-save playwright && npx playwright install chromium
npm run build
PUNKTI_DB=/tmp/uitest.sqlite PORT=4230 node server/dist/index.js &
BASE=http://localhost:4230 node web/test/ui.mjs
```

### Versijas

Versiju shēma ir `0.01`, `0.02`, … kā aprakstīts [`CHANGELOG.md`](CHANGELOG.md).
`package.json` to atspoguļo semver formātā (`0.04` → `0.4.0`).

---

## Licence

MIT
