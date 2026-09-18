@echo off
::
:: Testi un lokāls serveris / tests and a local server.
::
:: Palaid ar dubultklikšķi vai `test.cmd`. Izvēlies, ko palaist, un pēc testiem
:: lietotne paliek atvērta uz localhost, lai jaunās funkcijas var aptaustīt ar
:: roku. Ctrl+C aizver.
::
:: Izvēli var padot arī kā argumentu, lai izlaistu izvēlni: `test.cmd 2`.
::
:: Run this by double-clicking it, or `test.cmd`. Pick what to run; afterwards
:: the app stays up on localhost for hand testing. Ctrl+C closes it.
::
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

:: Testu serveri dabū savu datubāzi %TEMP%, jo abas komplektācijas prasa tukšu
:: datubāzi — tās pašas izveido pirmo vecāku. Rokas testēšanai ir atsevišķa
:: datubāze data\ mapē, kas starp palaišanām saglabājas, tāpēc izdomātā ģimene
:: nav jāveido no jauna katru reizi. Īstā data\punkti.sqlite netiek aiztikta.
set "API_PORT=4199"
set "UI_PORT=4230"
set "APP_PORT=4173"
set "API_DB=%TEMP%\punkti-test-api.sqlite"
set "UI_DB=%TEMP%\punkti-test-ui.sqlite"
set "APP_DB=%CD%\data\test.sqlite"
set "FAILED=0"
set "RAN=0"

echo.
echo   ===============================================
echo    Punktu sistēma — testi / tests
echo   ===============================================
echo.

:: --- izvēlne / menu --------------------------------------------------------
set "PICK=%~1"
if not defined PICK (
  echo     0. Visi testi            / All tests        ^(noklusējums^)
  echo     1. Tikai typecheck       / Typecheck only
  echo     2. API testi             / API tests
  echo     3. Pārlūka testi         / Browser tests
  echo     4. Tikai uzbūvēt         / Just build and open
  echo.
  set /p "PICK=  Izvēle / choice [0]: "
)
if not defined PICK set "PICK=0"
echo.

if "%PICK%"=="0" goto pick_all
if "%PICK%"=="1" goto pick_typecheck
if "%PICK%"=="2" goto pick_api
if "%PICK%"=="3" goto pick_ui
if "%PICK%"=="4" goto pick_open
echo   Nezināma izvēle "%PICK%" — der 0, 1, 2, 3 vai 4.
echo   Unknown choice "%PICK%" — use 0, 1, 2, 3 or 4.
exit /b 1

:pick_all
call :typecheck
call :build
call :api_tests
call :ui_tests
goto done

:pick_typecheck
call :typecheck
goto done

:pick_api
call :build
call :api_tests
goto done

:pick_ui
call :build
call :ui_tests
goto done

:: Neko nepārbauda — uzbūvē un atver. Tas ir ātrais ceļš uz "gribu paskatīties
:: ar acīm": pārējās izvēles pirms tam nostrādā testus, un, ja vajag tikai
:: apskatīties jauno ekrānu, tā ir pāris minūšu gaidīšana bez iemesla.
:: Kopsavilkums tiek izlaists, jo nav ko apkopot.
:pick_open
call :build
if not "%FAILED%"=="0" goto done
goto serve

:: --- kopsavilkums / summary ------------------------------------------------
:done
echo.
echo   -----------------------------------------------
if "%FAILED%"=="0" (
  if "%RAN%"=="0" (
    echo    Nekas netika palaists / nothing ran
  ) else (
    echo    VISS KĀRTĪBĀ / ALL PASSED
  )
) else (
  echo    TESTI KRITA / SOME TESTS FAILED
)
echo   -----------------------------------------------
echo.

:: Bez iekavām apzināti: `%GOON%` iekavu blokā tiktu izvērsts jau pirms `set /p`
:: nolasa atbildi, tāpēc atbilde "y" nekad netiktu pamanīta.
:: Deliberately not a parenthesised block: %GOON% inside one is expanded before
:: `set /p` ever reads the answer, so "y" would never be seen.
if "%FAILED%"=="0" goto serve
set "GOON="
set /p "GOON=  Tomēr palaist serveri? / Start the server anyway? [y/N]: "
echo.
if /i "%GOON%"=="y" goto serve
exit /b 1

:: ---------------------------------------------------------------- typecheck
:typecheck
set "RAN=1"
echo   === Typecheck ===
call npm run typecheck
if errorlevel 1 set "FAILED=1"
echo.
exit /b 0

:: -------------------------------------------------------------------- build
:: Abas testu komplektācijas un serveris strādā ar server\dist, nevis ar
:: pirmkodu, tāpēc bez būvēšanas testētu iepriekšējo versiju.
:build
echo   === Būvē / building ===
call npm run build
if errorlevel 1 (
  set "FAILED=1"
  echo   Būve neizdevās — tālāk nav jēgas. / Build failed.
)
echo.
exit /b 0

:: ---------------------------------------------------------------- API tests
:api_tests
if not "%FAILED%"=="0" exit /b 0
set "RAN=1"
echo   === API testi / API tests ===

call :find_bash
if not defined BASH (
  echo   Netika atrasts Git Bash — smoke.sh ir bash skripts.
  echo   Git Bash not found; run it from a Git Bash window instead:
  echo       BASE=http://localhost:%API_PORT% bash server/test/smoke.sh
  set "FAILED=1"
  echo.
  exit /b 0
)

call :start_server "%API_DB%" %API_PORT%
if errorlevel 1 (
  set "FAILED=1"
  echo.
  exit /b 0
)

set "BASE=http://localhost:%API_PORT%"
"%BASH%" server/test/smoke.sh
if errorlevel 1 set "FAILED=1"
set "BASE="

call :kill_port %API_PORT%
echo.
exit /b 0

:: ------------------------------------------------------------ browser tests
:ui_tests
if not "%FAILED%"=="0" exit /b 0
set "RAN=1"
echo   === Pārlūka testi / browser tests ===

:: Playwright apzināti nav projekta atkarība — ģimenei, kas lietotni hostē, nav
:: jālejupielādē pārlūks, lai to uzinstalētu.
if not exist "node_modules\playwright" (
  echo   Playwright nav uzinstalēts, izlaiž šo soli.
  echo   Playwright is not installed; skipping. To enable it:
  echo       npm install --no-save playwright
  echo       npx playwright install chromium
  echo.
  exit /b 0
)

call :start_server "%UI_DB%" %UI_PORT%
if errorlevel 1 (
  set "FAILED=1"
  echo.
  exit /b 0
)

set "BASE=http://localhost:%UI_PORT%"
node web\test\ui.mjs
if errorlevel 1 set "FAILED=1"
set "BASE="

call :kill_port %UI_PORT%
echo.
exit /b 0

:: -------------------------------------------------------------------- serve
:serve
if not exist "web\dist\index.html" call :build
call :kill_port %APP_PORT%

echo   ===============================================
echo    Lietotne / the app:  http://localhost:%APP_PORT%
echo    Datubāze / database: data\test.sqlite
echo                         ^(testa, nevis ģimenes — izdzēs, lai sāktu no gala^)
echo.
echo    Ctrl+C aizver serveri / closes the server
echo   ===============================================
echo.

:: Pārlūks tiek atvērts ar nelielu nokavēšanos atsevišķā procesā, jo serveris
:: vēl nav paspējis sākt klausīties — citādi lapa atvērtos ar kļūdu.
start /min "" cmd /c ping -n 3 127.0.0.1 ^>nul ^&^& explorer "http://localhost:%APP_PORT%"

:: Serveris priekšplānā, lai Ctrl+C tiešām to apturētu.
set "PUNKTI_DB=%APP_DB%"
set "PORT=%APP_PORT%"
node server\dist\index.js
exit /b 0

:: ------------------------------------------------------------------ helpers

:: Startē serveri fonā ar tukšu datubāzi un nogaida, līdz tas atbild.
:: call :start_server <db-path> <port>
:start_server
set "_DB=%~1"
set "_PORT=%~2"
call :kill_port %_PORT%
del /q "%_DB%" "%_DB%-wal" "%_DB%-shm" >nul 2>&1

set "PUNKTI_DB=%_DB%"
set "PORT=%_PORT%"
start /b "" node server\dist\index.js > "%TEMP%\punkti-test-%_PORT%.log" 2>&1
set "PUNKTI_DB="
set "PORT="

for /l %%I in (1,1,40) do (
  curl -sf "http://localhost:%_PORT%/api/health" >nul 2>&1
  if not errorlevel 1 exit /b 0
  ping -n 2 127.0.0.1 >nul
)
echo   Serveris nestartējās uz porta %_PORT% / server did not come up.
echo   Žurnāls / log: %TEMP%\punkti-test-%_PORT%.log
exit /b 1

:: Nogalina to, kas klausās uz porta. Testu serveri turētu datubāzes failu
:: aizņemtu, un nākamā palaišana to nevarētu izdzēst.
:: call :kill_port <port>
:kill_port
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /c:":%~1 " ^| findstr /c:"LISTENING"') do taskkill /F /PID %%P >nul 2>&1
exit /b 0

:: Git Bash, nevis WSL bash: smoke.sh vajag curl un python, kas ir Git Bash.
:: `where bash` netiek lietots — Windows System32 mapē ir savs bash.exe, kas ir
:: WSL palaidējs, un tas šo skriptu nenostrādātu.
::
:: Katra pārbaude ir iekavās, nevis `if exist X set Y & exit /b`: tajā rindā
:: `&` atdala komandas, tāpēc `exit /b` nostrādātu arī tad, kad `if` neizdevās,
:: un pārējie ceļi nekad netiktu pārbaudīti.
:find_bash
if defined BASH exit /b 0
if exist "%ProgramFiles%\Git\bin\bash.exe" (
  set "BASH=%ProgramFiles%\Git\bin\bash.exe"
  exit /b 0
)
if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" (
  set "BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
  exit /b 0
)
if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" (
  set "BASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
  exit /b 0
)
:: Pēdējā cerība: atrod git.exe un paskatās blakus mapē.
for /f "delims=" %%G in ('where git 2^>nul') do (
  for %%D in ("%%~dpG..") do (
    if exist "%%~fD\bin\bash.exe" set "BASH=%%~fD\bin\bash.exe"
  )
)
exit /b 0
