# Creator Guard — dev on port 3005 (PowerShell / Windows)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "Starting dev server on http://localhost:3005"
$env:PORT = "3005"
npm run dev
