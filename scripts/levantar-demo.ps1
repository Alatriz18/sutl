# Levanta TODO SUTL para presentarlo: bases de datos, correo de prueba, backend, frontend y datos de ejemplo.
#
#   .\scripts\levantar-demo.ps1              (primera vez o cuando quieras todo limpio y listo)
#   .\scripts\levantar-demo.ps1 -Reconstruir (vuelve a compilar el frontend, por si cambiaste código)
#
# Al terminar: http://localhost:3002 (la aplicación) y http://localhost:8025 (los correos que envía el sistema).
# Para apagar todo: .\scripts\detener-demo.ps1

param([switch]$Reconstruir)

# Los programas externos (docker, npm) escriben avisos normales por el canal de errores: no se tratan como fallo;
# se revisa su código de salida donde importa.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $raiz '.demo-logs'
New-Item -ItemType Directory -Force $logs | Out-Null

function Paso($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
function Esperar($nombre, $prueba, $segundos = 120) {
  $fin = (Get-Date).AddSeconds($segundos)
  while ((Get-Date) -lt $fin) {
    try { if (& $prueba) { Write-Host "    $nombre listo" -ForegroundColor Green; return } } catch { }
    Start-Sleep -Seconds 2
  }
  throw "$nombre no respondió en $segundos segundos. Revisa $logs"
}
function PuertoLibre($p) { -not (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) }

Paso 'Docker'
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host '    Docker no está abierto: lo abro (puede tardar un minuto)...'
  Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  Esperar 'Docker' { docker info *> $null; $LASTEXITCODE -eq 0 } 240
}

Paso 'Bases de datos y correo de prueba (Postgres, MongoDB, Redis, Mailpit)'
Push-Location $raiz
docker compose up -d postgres mongo redis mailpit
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron levantar los contenedores' }
Pop-Location
Esperar 'Postgres' { (docker exec sutl_postgres pg_isready -U postgres 2>$null) -match 'accepting' } 90

Paso 'Base de datos: migraciones y datos de la empresa de demostración'
Push-Location (Join-Path $raiz 'backend')
if (-not (Test-Path 'node_modules')) { npm install }
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw 'Fallaron las migraciones' }
npm run seed
if ($LASTEXITCODE -ne 0) { throw 'Falló la carga de datos de ejemplo' }
Pop-Location

Paso 'Backend (puerto 3001)'
if (PuertoLibre 3001) {
  Push-Location (Join-Path $raiz 'backend')
  Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run start > ..\.demo-logs\backend.log 2>&1'
  Pop-Location
} else { Write-Host '    ya estaba corriendo' }
Esperar 'Backend' {
  try { Invoke-WebRequest -Uri 'http://localhost:3001/api/auth/login' -Method Post -ContentType 'application/json' -Body '{}' -UseBasicParsing -ErrorAction Stop | Out-Null; $true }
  catch { $_.Exception.Response -ne $null }
} 180

Paso 'Frontend (puerto 3002)'
Push-Location (Join-Path $raiz 'frontend')
if (-not (Test-Path 'node_modules')) { npm install }
if ($Reconstruir -or -not (Test-Path '.next\BUILD_ID')) {
  Write-Host '    compilando el frontend (1-3 minutos)...'
  if (-not (PuertoLibre 3002)) { Get-NetTCPConnection -LocalPort 3002 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación del frontend' }
}
if (PuertoLibre 3002) {
  Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' -ArgumentList '/c', 'npx next start -p 3002 > ..\.demo-logs\frontend.log 2>&1'
} else { Write-Host '    ya estaba corriendo' }
Pop-Location
Esperar 'Frontend' { (Invoke-WebRequest -Uri 'http://localhost:3002/login' -UseBasicParsing -ErrorAction Stop).StatusCode -eq 200 } 120

Paso 'Escenario de presentación (usuarios y casos de ejemplo)'
Push-Location (Join-Path $raiz 'backend')
node scripts/preparar-demo.mjs
if ($LASTEXITCODE -ne 0) { throw 'Falló la preparación del escenario' }
Pop-Location

Write-Host @"

============================================================
 SUTL está listo para presentar
   Aplicación        : http://localhost:3002
   Correos enviados  : http://localhost:8025   (Mailpit)
   API y documentación: http://localhost:3001/api/docs
 Guía de flujos      : docs\DEMO_PRESENTACION.md
 Para apagar todo    : .\scripts\detener-demo.ps1
============================================================
"@ -ForegroundColor Green
