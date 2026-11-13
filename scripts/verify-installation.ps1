param([string]$Directory = (Join-Path $PSScriptRoot '..\release'))
$ErrorActionPreference = 'Stop'
Get-Content (Join-Path $Directory 'SHA256SUMS.txt') | ForEach-Object {
  if ($_ -notmatch '^([a-f0-9]{64})  (.+)$') { throw 'Invalid checksum line' }
  $expected = $Matches[1]; $name = $Matches[2]
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $Directory $name)).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw "Checksum mismatch: $name" }
  Write-Host "Verified: $name"
}
