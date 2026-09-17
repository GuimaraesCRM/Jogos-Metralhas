$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $project
$tools = Join-Path $project '.tools'
$godot = Join-Path $tools 'Godot_v4.7.2-stable_win64_console.exe'
$build = Join-Path $project 'build'
$server = Join-Path $build 'server'

if (-not (Test-Path $godot)) { throw 'Godot 4.7.2 portátil não encontrado em godot/.tools.' }
New-Item -ItemType Directory -Force -Path $server, (Join-Path $server 'public') | Out-Null
& $godot --headless --path $project --export-release 'Windows Desktop' (Join-Path $build 'Metralhopole-Godot.exe')
if ($LASTEXITCODE -ne 0) { throw 'A exportação do Godot falhou.' }

$node = (Get-Command node.exe -ErrorAction Stop).Source
Copy-Item -LiteralPath $node -Destination (Join-Path $server 'node.exe') -Force
Copy-Item -LiteralPath (Join-Path $root 'server.js'), (Join-Path $root 'game.js') -Destination $server -Force
Copy-Item -LiteralPath (Join-Path $root 'public/board.js') -Destination (Join-Path $server 'public/board.js') -Force
Set-Content -LiteralPath (Join-Path $server 'package.json') -Value '{"type":"module"}' -Encoding ascii
Write-Host "Distribuição criada em $build"
