param(
    [string]$OutputPath = "tmp/phase0/synthetic-30fps.mp4"
)

$ffmpeg = Get-Command ffmpeg -ErrorAction Stop
$output = [System.IO.Path]::GetFullPath($OutputPath)
$directory = [System.IO.Path]::GetDirectoryName($output)
if (-not (Test-Path -LiteralPath $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
}

& $ffmpeg.Source -hide_banner -loglevel error `
    -f lavfi -i "testsrc=size=1280x720:rate=30" `
    -t 3 -c:v libx264 -pix_fmt yuv420p -movflags +faststart $output
if ($LASTEXITCODE -ne 0) {
    throw "FFmpeg fixture generation failed with exit code $LASTEXITCODE."
}

Get-Item -LiteralPath $output | Select-Object FullName, Length
