<#
.SYNOPSIS
    Starts N dummy VDO.Ninja camera streams for overlay testing — no real people needed.

.DESCRIPTION
    Launches a Chromium browser (Edge or Chrome) with Chromium's fake-webcam flags
    (--use-fake-device-for-media-stream + --use-file-for-fake-video-capture feed a
    generated moving test pattern instead of a real camera — recent Chrome on
    Windows no longer synthesizes a fake video device without the file flag —
    and --use-fake-ui-for-media-stream suppresses the permission prompt)
    and opens public/camera-test/publisher.html, which pushes one VDO.Ninja stream
    per camera: <Prefix>1 .. <Prefix>N.

    View the streams with:
      - the overlay:  http://localhost:5173/?camtest=<Prefix>&camcount=<Count>
      - the test grid: http://localhost:5173/camera-test/viewer.html?prefix=<Prefix>&count=<Count>

    The publisher page must be served over http(s) (vite dev/preview or the deployed
    overlay) — file:// will not work, VDO.Ninja requires a secure context.

.EXAMPLE
    # npm run dev is running, publish 10 dummy cameras:
    .\tools\start-dummy-cameras.ps1

.EXAMPLE
    .\tools\start-dummy-cameras.ps1 -Count 10 -Prefix myTestCam -Headless
#>
param(
    [int]$Count = 10,
    [string]$Prefix = "broadcastCam$(Get-Random -Minimum 100 -Maximum 999)",
    [string]$Server = "https://vdo.ninja",
    [string]$BaseUrl = "http://localhost:5173",
    [ValidateSet("auto", "msedge", "chrome")]
    [string]$Browser = "auto",
    [switch]$Headless,
    # Publish over standard RTP instead of the default &chunked transport.
    # Chunked is what lets the overlay's ?camdelay buffer hold past Chromium's ~4s cap.
    [switch]$NoChunked
)

$ErrorActionPreference = "Stop"

function Find-Browser {
    param([string]$Preference)
    $candidates = [ordered]@{
        chrome = @(
            "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
            "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
        )
        msedge = @(
            "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
            "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
        )
    }
    $order = if ($Preference -eq "auto") { @("chrome", "msedge") } else { @($Preference) }
    foreach ($name in $order) {
        foreach ($path in $candidates[$name]) {
            if (Test-Path $path) { return $path }
        }
    }
    throw "No Chromium browser found (looked for: $($order -join ', '))."
}

$browserPath = Find-Browser -Preference $Browser
$userDataDir = Join-Path $env:TEMP "vdo-dummy-cams"
$url = "$BaseUrl/camera-test/publisher.html?prefix=$Prefix&count=$Count&server=$([uri]::EscapeDataString($Server))"

# Generate the fake webcam video (moving test pattern) if it doesn't exist yet.
$fakeVideo = Join-Path $env:TEMP "fake-camera.y4m"
if (-not (Test-Path $fakeVideo)) {
    node (Join-Path $PSScriptRoot "make-fake-camera-video.mjs") $fakeVideo
}

$flags = @(
    "--user-data-dir=`"$userDataDir`"",
    "--use-fake-device-for-media-stream",
    "--use-file-for-fake-video-capture=`"$fakeVideo`"",
    "--use-fake-ui-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window"
)
if ($Headless) { $flags += "--headless=new" }

Write-Host "Browser:    $browserPath"
Write-Host "Publishing: $Count dummy cameras as '$Prefix<1..$Count>' via $Server"
Write-Host "Publisher:  $url"
Write-Host ""
Write-Host "View them with:"
Write-Host "  Overlay:   $BaseUrl/?camtest=$Prefix&camcount=$Count"
Write-Host "  Test grid: $BaseUrl/camera-test/viewer.html?prefix=$Prefix&count=$Count"
Write-Host ""
Write-Host "Keep the spawned browser window open while testing. Close it to stop all streams."

Start-Process -FilePath $browserPath -ArgumentList ($flags + "`"$url`"")
