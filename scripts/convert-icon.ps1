Add-Type -AssemblyName System.Drawing

$SourceJpg = "C:\Users\lukab\.gemini\antigravity\brain\d1995a13-d5aa-4077-91f8-2daa1f25d8fa\laptop_magic_icon_1791674991587.jpg"
$TargetPng = Join-Path $PSScriptRoot "..\app-icon.png"
$TargetIco = Join-Path $PSScriptRoot "..\app.ico"

Write-Host "Source image: $SourceJpg"

$srcBmp = [System.Drawing.Bitmap]::FromFile($SourceJpg)
$srcBmp.Save($TargetPng, [System.Drawing.Imaging.ImageFormat]::Png)

# Multi-resolution ICO: 256, 128, 64, 48, 32, 16
$sizes = @(256, 128, 64, 48, 32, 16)
$pngList = New-Object System.Collections.ArrayList

foreach ($size in $sizes) {
    $resized = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($srcBmp, 0, 0, $size, $size)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $resized.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $ms.Dispose()
    $resized.Dispose()

    [void]$pngList.Add(@{ Size = $size; Bytes = $bytes })
}
$srcBmp.Dispose()

# Build ICO
$fs = [System.IO.File]::Create($TargetIco)
$bw = New-Object System.IO.BinaryWriter($fs)

$bw.Write([uint16]0) # Reserved
$bw.Write([uint16]1) # Type 1 = ICO
$bw.Write([uint16]$pngList.Count) # Count

$offset = 6 + ($pngList.Count * 16)
foreach ($item in $pngList) {
    $s = $item.Size
    $bytes = $item.Bytes
    $w = if ($s -ge 256) { 0 } else { [byte]$s }
    $h = if ($s -ge 256) { 0 } else { [byte]$s }

    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0)   # Colors
    $bw.Write([byte]0)   # Reserved
    $bw.Write([uint16]1) # Planes
    $bw.Write([uint16]32) # BPP
    $bw.Write([uint32]$bytes.Length) # Image bytes
    $bw.Write([uint32]$offset) # Offset
    $offset += $bytes.Length
}

foreach ($item in $pngList) {
    $bw.Write($item.Bytes)
}

$bw.Flush()
$bw.Close()
$fs.Close()

Write-Host "Success: Generated $TargetIco ($(Get-Item $TargetIco).Length bytes)"
Write-Host "Success: Generated $TargetPng ($(Get-Item $TargetPng).Length bytes)"
