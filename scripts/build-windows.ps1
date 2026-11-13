$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
foreach ($command in @("ci", "run setup:ocr", "test", "run typecheck", "run lint", "run dist:win")) {
  & npm.cmd ($command.Split(" "))
  if ($LASTEXITCODE -ne 0) { throw "npm $command failed" }
}
node scripts/checksums.mjs
if ($LASTEXITCODE -ne 0) { throw "Checksum generation failed" }
