# Wired as tauri.conf.json's bundle.windows.signCommand (build-sessions/encoder/S11.md).
# Tauri invokes this with the path of the .exe/.msi it just built as the sole
# argument. Safe to run on every Windows build regardless of whether the
# SSL.com eSigner cert has arrived (X0 item 3, ordered 2026-09-05): with no
# ES_USERNAME env var this is a no-op and the artifact stays exactly as
# `tauri build` produced it — unsigned, same as before S11. The workflow's
# "Configure Windows signing" step only exports ES_* when the
# SSL_COM_ESIGNER_* secrets are non-empty, and "Install SSL.com CodeSignTool"
# only downloads the tool in that same case.
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$FilePath
)

if (-not $env:ES_USERNAME) {
    Write-Host "No ES_USERNAME (SSL_COM_ESIGNER_USERNAME secret absent) — leaving $FilePath UNSIGNED."
    exit 0
}

$ToolDir = Join-Path $env:RUNNER_TEMP "CodeSignTool"
$ToolBat = Join-Path $ToolDir "CodeSignTool.bat"
if (-not (Test-Path $ToolBat)) {
    Write-Error "ES_USERNAME is set but CodeSignTool.bat is missing at $ToolBat — the 'Install SSL.com CodeSignTool' CI step must run before signing."
    exit 1
}

$OutDir = Join-Path $env:RUNNER_TEMP "codesign-out"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Push-Location $ToolDir
try {
    & $ToolBat sign `
        "-username=$env:ES_USERNAME" `
        "-password=$env:ES_PASSWORD" `
        "-credential_id=$env:ES_CREDENTIAL_ID" `
        "-totp_secret=$env:ES_TOTP_SECRET" `
        "-input_file_path=$FilePath" `
        "-output_dir_path=$OutDir" `
        "-override=true"
    $ExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

if ($ExitCode -ne 0) {
    Write-Error "CodeSignTool exited $ExitCode signing $FilePath."
    exit $ExitCode
}

$SignedFile = Join-Path $OutDir (Split-Path $FilePath -Leaf)
if (-not (Test-Path $SignedFile)) {
    Write-Error "CodeSignTool reported success but $SignedFile does not exist."
    exit 1
}

Copy-Item -Force $SignedFile $FilePath
Write-Host "Signed $FilePath via SSL.com eSigner."
exit 0
