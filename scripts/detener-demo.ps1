# Apaga lo que levantó levantar-demo.ps1: frontend, backend y los contenedores (los datos se conservan).
#   .\scripts\detener-demo.ps1            apaga todo (Docker Desktop queda abierto)
#   .\scripts\detener-demo.ps1 -BorrarDatos   además borra las bases de datos de la demostración

param([switch]$BorrarDatos)

$raiz = Split-Path -Parent $PSScriptRoot
foreach ($puerto in 3002, 3001) {
  Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "Detenido lo que escuchaba en el puerto $puerto"
  }
}
Push-Location $raiz
if ($BorrarDatos) { docker compose down -v } else { docker compose stop postgres mongo redis mailpit }
Pop-Location
Write-Host 'Listo. Docker Desktop queda abierto; ciérralo tú si quieres liberar memoria.'
