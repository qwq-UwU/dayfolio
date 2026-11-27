$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$cache = Join-Path $root '.build'
$output = Join-Path $root 'dist/Dayfolio'
$ui = Join-Path $PSScriptRoot 'ui'
$sdkVersion = '1.0.3537.50'
$sdkHash = '5EA526BBD728ADDA0DA4D31219267E96460494A427E4894C4E09D9F320F4B9AA'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
New-Item -ItemType Directory -Force -Path $cache,$output | Out-Null
$package = Join-Path $cache 'webview2.zip'
if (!(Test-Path $package) -or (Get-FileHash $package).Hash -ne $sdkHash) {
    $uri = "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$sdkVersion/microsoft.web.webview2.$sdkVersion.nupkg"
    Invoke-WebRequest -UseBasicParsing -Uri $uri -OutFile $package
}
if ((Get-FileHash $package).Hash -ne $sdkHash) { throw 'WebView2 SDK checksum mismatch.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($package)
try {
    foreach ($file in @('lib/net462/Microsoft.Web.WebView2.Core.dll','lib/net462/Microsoft.Web.WebView2.WinForms.dll',
                         'build/native/x64/WebView2Loader.dll','LICENSE.txt','NOTICE.txt')) {
        $entry = $archive.GetEntry($file)
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $output $entry.Name), $true)
    }
} finally { $archive.Dispose() }
$core = Join-Path $output 'Microsoft.Web.WebView2.Core.dll'
$forms = Join-Path $output 'Microsoft.Web.WebView2.WinForms.dll'
$exe = Join-Path $output 'Dayfolio.exe'
$resources = foreach ($file in Get-ChildItem -LiteralPath $ui -File) {
    "/resource:$($file.FullName),Dayfolio.UI.$($file.Name)"
}
& $compiler /nologo /target:winexe /platform:x64 /optimize+ /codepage:65001 "/out:$exe" "/reference:$core" "/reference:$forms" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll @resources (Join-Path $PSScriptRoot 'Program.cs')
if ($LASTEXITCODE -ne 0) { throw 'Desktop compilation failed.' }
$bundle = Join-Path $root 'dist/Dayfolio-Windows-x64.zip'
$files = @($exe,$core,$forms) + @('WebView2Loader.dll','LICENSE.txt','NOTICE.txt').ForEach({Join-Path $output $_})
Compress-Archive -LiteralPath $files -DestinationPath $bundle -Force
Write-Output $bundle
