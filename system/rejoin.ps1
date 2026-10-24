# agnes Linux 沙盒系统合并导入脚本（Ubuntu 24.04 官方 WSL rootfs，分块存储于本仓库 system/ 目录）
$dir = Join-Path $env:APPDATA 'agnes-chat-app\sandbox\linux'
New-Item -ItemType Directory -Force -Path "$dir\vm" | Out-Null
$parts = Get-ChildItem "$PSScriptRoot\ubuntu-rootfs.part*" | Sort-Object Name
$out = Join-Path $dir 'ubuntu-rootfs.tar.gz'
$fs = [System.IO.File]::Create($out)
foreach ($p in $parts) {
  $bytes = [System.IO.File]::ReadAllBytes($p.FullName)
  $fs.Write($bytes, 0, $bytes.Length)
}
$fs.Close()
wsl --import agnes-sandbox "$dir\vm" $out --version 2
Write-Host 'agnes-sandbox 导入完成（Ubuntu 24.04 完整系统）'
