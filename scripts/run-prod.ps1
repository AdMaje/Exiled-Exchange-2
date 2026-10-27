# MT: fork-owned production build + launch helper (not an upstream file).
#
# Builds the renderer, then the main process, copies the renderer build into
# main\dist (where the production static handler expects it) and launches the app
# with the Electron binary from main\node_modules.
#
# Usage:
#   .\scripts\run-prod.ps1            # overlay attached, game should be running
#   .\scripts\run-prod.ps1 -NoGame    # no overlay, fixed port, prints the URLs
#
# Both modes block until the app quits and exit with a non-zero code plus an
# "ERROR:" line when a build, the copy step or the launch fails.
[CmdletBinding()]
param(
  [switch]$NoGame
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Host ""
  Write-Host "ERROR: $Message" -ForegroundColor Red
  exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$rendererDir = Join-Path $repoRoot "renderer"
$mainDir = Join-Path $repoRoot "main"
$rendererDist = Join-Path $rendererDir "dist"
$mainDist = Join-Path $mainDir "dist"
$electronExe = Join-Path $mainDir "node_modules\electron\dist\electron.exe"
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue

if (-not (Test-Path -LiteralPath $rendererDir) -or -not (Test-Path -LiteralPath $mainDir)) {
  Fail "Cannot find renderer\ and main\ next to the script (looked in '$repoRoot')."
}
if (-not $npm) {
  Fail "npm.cmd was not found on PATH. Install Node.js and re-open the terminal."
}
if (-not (Test-Path -LiteralPath $electronExe)) {
  Fail "Electron binary not found at '$electronExe'. Run 'npm.cmd ci' in '$mainDir' first."
}

function Invoke-NpmBuild([string]$Directory, [string]$Label) {
  Write-Host "==> Building $Label" -ForegroundColor Cyan
  Push-Location -LiteralPath $Directory
  try {
    & $npm.Source run build
    if ($LASTEXITCODE -ne 0) {
      Fail "Building $Label failed ('npm.cmd run build' exited with $LASTEXITCODE)."
    }
  } finally {
    Pop-Location
  }
}

function Invoke-CopyRendererBuild {
  $rendererIndex = Join-Path $rendererDist "index.html"
  if (-not (Test-Path -LiteralPath $rendererIndex)) {
    Fail "Renderer build is missing '$rendererIndex'."
  }

  Write-Host "==> Copying renderer build into main\dist" -ForegroundColor Cyan
  # Drop only the hashed renderer assets so renamed chunks do not pile up;
  # main's own bundles (main.js, vision.js) are left alone.
  $mainAssets = Join-Path $mainDist "assets"
  if (Test-Path -LiteralPath $mainAssets) {
    Remove-Item -LiteralPath $mainAssets -Recurse -Force
  }
  Copy-Item -Path (Join-Path $rendererDist "*") -Destination $mainDist -Recurse -Force

  if (-not (Test-Path -LiteralPath (Join-Path $mainDist "index.html"))) {
    Fail "Copying the renderer build into '$mainDist' failed."
  }
}

Invoke-NpmBuild $rendererDir "renderer"
Invoke-NpmBuild $mainDir "main"
Invoke-CopyRendererBuild

$electronArgs = @(".")
if ($NoGame) {
  $electronArgs += @(
    "--no-overlay",
    "--listen=127.0.0.1:8584",
    "--no-updates"
  )
  Write-Host ""
  Write-Host "Starting without the game (server on http://127.0.0.1:8584):" -ForegroundColor Green
  Write-Host "  Hub:     http://localhost:8584/index.html?mt=hub"
  Write-Host "  Overlay: http://localhost:8584/index.html"
  Write-Host "Quit from the tray icon; Ctrl+C stops the process."
} else {
  Write-Host ""
  Write-Host "Starting with the overlay attached - Path of Exile 2 should be running." -ForegroundColor Green
  Write-Host "Use tray -> Open in Browser for the web UI; tray -> Quit to stop."
}

Write-Host "==> Launching $electronExe" -ForegroundColor Cyan
$exitCode = 0
Push-Location -LiteralPath $mainDir
try {
  try {
    & $electronExe @electronArgs
    $exitCode = $LASTEXITCODE
  } catch {
    Fail "Failed to launch Electron: $($_.Exception.Message)"
  }
} finally {
  Pop-Location
}

if ($exitCode -ne 0) {
  Write-Host "WARN: Electron exited with code $exitCode." -ForegroundColor Yellow
}
exit $exitCode
