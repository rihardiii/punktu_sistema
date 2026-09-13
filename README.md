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
  Punktu sistēma v0.02
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
| `PUNKTI_DB` | `data/punkti.sqlite` | Datubāzes faila atrašanās vieta        |

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

Jebkurš dators mājās der. Ja gribi, lai darbojas visu laiku, Raspberry Pi ir
lēts un kluss variants:

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
```

### Testi

```bash
PUNKTI_DB=/tmp/test.sqlite PORT=4199 npm run dev:server &
BASE=http://localhost:4199 bash server/test/smoke.sh
```

### Versijas

Versiju shēma ir `0.01`, `0.02`, … kā aprakstīts [`CHANGELOG.md`](CHANGELOG.md).
`package.json` to atspoguļo semver formātā (`0.02` → `0.2.0`).

---

## Licence

MIT
