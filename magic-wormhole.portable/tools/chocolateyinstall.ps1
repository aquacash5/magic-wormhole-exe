$ErrorActionPreference = 'Stop'
$packageName = '$env:ChocolateyPackageName'
$url = ''
$checksum = ''
$checksumType = 'sha256'
$toolsDir = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
$installFile = Join-Path $toolsDir "wormhole.exe"
try {
  Get-ChocolateyWebFile -PackageName "$packageName" `
    -FileFullPath "$installFile" `
    -Url "$url" `
    -Checksum "$checksum" `
    -ChecksumType "$checksumType"
}
catch {
  throw $_.Exception
}
