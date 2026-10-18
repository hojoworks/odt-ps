#Requires -Version 5.1
<#
.SYNOPSIS
    odt-ps - installs Microsoft Office / Microsoft 365 Apps through the
    official Office Deployment Tool, from settings given as parameters.

.DESCRIPTION
    A terminal installer built on top of Microsoft's official Office Deployment
    Tool (ODT). It downloads the ODT from Microsoft, builds a configuration.xml
    from the settings you give it, and runs the download and/or install steps for
    you.

    This tool only deploys Office files. Activation is the user's responsibility.
    Sign in with a licensed Microsoft 365 account, or use the volume licence
    (KMS/MAK) that your organisation provides.

.EXAMPLE
    irm https://hojoworks.github.io/odt-ps/get.ps1 | iex

.EXAMPLE
    $env:ODT_ARGS='-Product O365ProPlusRetail -Languages en-us -Arch 64 -Download -Install -Silent'; irm https://hojoworks.github.io/odt-ps/get.ps1 | iex

.EXAMPLE
    .\get.ps1 -Product ProPlus2024Volume -Languages en-us,de-de -ExportXml C:\temp\config.xml
#>
[CmdletBinding()]
param(
    # Product IDs to deploy (interactive wizard is skipped when this is set).
    [string[]]$Product,

    # Update channel, for example Current or MonthlyEnterprise.
    [string]$Channel,

    # Office edition: 64 or 32. The empty string is a member of the set on
    # purpose: `iex` evaluates this script as text, and validating the metadata
    # with nothing bound is what the empty default would otherwise fail.
    [ValidateSet('64', '32', '')]
    [string]$Arch = '',

    # Language culture codes, for example en-us,de-de.
    [string[]]$Languages,

    # ExcludeApp IDs, for example Publisher,Teams,Groove.
    [string[]]$Exclude,

    # Deployment folder (where setup.exe and configuration.xml live).
    [string]$OdtFolder,

    # Source folder for the installation files. Defaults to the deployment folder.
    [string]$SourcePath,

    # Pin an Office version, for example 16.0.17928.20156 or MatchInstalled.
    [string]$Version,

    # Run 'setup.exe /download'.
    [switch]$Download,

    # Run 'setup.exe /configure'.
    [switch]$Install,

    # Remove all Click-to-Run Office products.
    [switch]$RemoveAll,

    # Write the generated XML to this path and exit (no download, no install).
    [string]$ExportXml,

    # Never prompt. Useful for RMM or scripted runs.
    [switch]$Silent,

    # Do not try to relaunch elevated.
    [switch]$NoElevate,

    # Show Microsoft's setup window instead of installing silently. The site's
    # one-liner passes this when the display level is Full there.
    [switch]$ShowWindow,

    # Keep the downloaded files instead of removing them when the install is done.
    [switch]$KeepFiles
)

$ErrorActionPreference = 'Stop'

# Whether the caller named the folder: one they named is not ours to delete.
$script:FolderNamed = $PSBoundParameters.ContainsKey('OdtFolder')
$ProgressPreference = 'SilentlyContinue'

# ---------------------------------------------------------------------------
# Script state
# ---------------------------------------------------------------------------

$script:ToolVersion = '1.0.2'
$script:SiteUrl = 'https://hojoworks.github.io/odt-ps/'
$script:SilentMode = [bool]$Silent
# Whether the caller named the channel or the edition: if they did, an invalid
# combination is an error rather than something to quietly correct.
$script:ChannelExplicit = $false
$script:ArchExplicit = $false

# ---------------------------------------------------------------------------
# When the switches arrive in the environment
# ---------------------------------------------------------------------------

function Test-IsAdmin {
    try {
        $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
        return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch {
        return $false
    }
}

# `irm ... | iex` evaluates this script as text, and PowerShell cannot bind
# parameters to text. So when a line hands the settings over in $env:ODT_ARGS
# instead, this script fetches a copy of itself and starts that copy with those
# switches. A file can be given parameters, so PowerShell's own binder reads them:
# nothing here parses a switch by hand, where a typo would quietly install the
# wrong product.
if (-not $PSCommandPath -and $env:ODT_ARGS -and $env:ODT_ARGS.Trim()) {
    $base = $env:ODT_SETUP_URL
    if (-not $base) { $base = $script:SiteUrl }
    $base = $base.TrimEnd('/')
    $switches = @($env:ODT_ARGS.Trim() -split '\s+')

    Write-Host ''
    Write-Host '  odt-ps' -ForegroundColor Cyan
    Write-Host ('  Settings from: ' + $env:ODT_ARGS) -ForegroundColor DarkGray
    Write-Host ''

    # The installer is fetched first, and only then elevated. That way the window
    # that asks for administrator rights has nothing left to download, and it is
    # started as a file with ordinary switches on its command line. Nothing rides
    # on the environment being inherited across the elevation, which it is not
    # when Windows asks for a different account, and nothing rides on `iex`.
    $folder = Join-Path $env:TEMP 'OdtSetup'
    if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Force -Path $folder | Out-Null }
    $path = Join-Path $folder 'get.ps1'
    Write-Host '  Fetching the installer...' -ForegroundColor Cyan
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri ($base + '/get.ps1') -OutFile $path -UseBasicParsing
    } catch {
        Write-Host ('  Could not fetch ' + $base + '/get.ps1') -ForegroundColor Red
        Write-Host ('  ' + $_.Exception.Message) -ForegroundColor DarkGray
        exit 1
    }

    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $path) + $switches

    # Two doors to the same switch: the parameter, when this arrived as a file,
    # and the token, when a piped line handed its settings over in the environment.
    $noElevate = $NoElevate -or $switches.Contains('-NoElevate')

    if (-not $noElevate -and -not (Test-IsAdmin)) {
        Write-Host '  Administrator rights are needed to install Office.' -ForegroundColor Yellow
        Write-Host '  Restarting in an elevated window...' -ForegroundColor Yellow
        try {
            Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList (@('-NoExit') + $arguments) | Out-Null
            Write-Host '  Continuing in the new administrator window.' -ForegroundColor Green
        } catch {
            Write-Host '  Elevation was cancelled.' -ForegroundColor Red
            Write-Host ('  Re-run from an administrator PowerShell, or run ' + $path) -ForegroundColor DarkGray
        }
        return
    }

    & powershell.exe @arguments
    return
}

# Official Microsoft links. The direct Office Deployment Tool download is
# resolved from the download page at run time, so version bumps do not break us.
$script:OdtPageUrl = 'https://www.microsoft.com/en-us/download/details.aspx?id=49117'

# ---------------------------------------------------------------------------
# Console helpers
# ---------------------------------------------------------------------------

function Write-Banner {
    Write-Host ''
    Write-Host '  ======================================================================' -ForegroundColor DarkCyan
    Write-Host '    O D T - P S' -ForegroundColor Cyan
    Write-Host ('    Microsoft Office installer  v' + $script:ToolVersion) -ForegroundColor DarkGray
    Write-Host '    Powered by the official Microsoft Office Deployment Tool.' -ForegroundColor DarkGray
    Write-Host '    Deploys Office files only. Activation is up to you.' -ForegroundColor DarkGray
    Write-Host '  ======================================================================' -ForegroundColor DarkCyan
    Write-Host ''
}

function Write-Title {
    param([string]$Text)
    Write-Host ''
    Write-Host ('  ' + $Text) -ForegroundColor White
    Write-Host ('  ' + ''.PadRight([Math]::Min($Text.Length, 70), '-')) -ForegroundColor DarkGray
}

function Write-Ok { param([string]$Text) Write-Host ('  [ok]  ' + $Text) -ForegroundColor Green }
function Write-Info { param([string]$Text) Write-Host ('  [...] ' + $Text) -ForegroundColor Cyan }
function Write-Warn { param([string]$Text) Write-Host ('  [!!]  ' + $Text) -ForegroundColor Yellow }
function Write-Err { param([string]$Text) Write-Host ('  [xx]  ' + $Text) -ForegroundColor Red }
function Write-Dim { param([string]$Text) Write-Host ('  ' + $Text) -ForegroundColor DarkGray }

function Read-Pause {
    if ($script:SilentMode) { return }
    Write-Host ''
    [void](Read-Host '  Press Enter to continue')
}

function Read-Confirm {
    param([string]$Question, [bool]$Default = $true)
    if ($script:SilentMode) { return $Default }
    $suffix = ' [Y/n] '
    if (-not $Default) { $suffix = ' [y/N] ' }
    $answer = Read-Host ('  ' + $Question + $suffix)
    if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
    return $answer.Trim().ToLower().StartsWith('y')
}

# Whether progress can be written in place. A prompt needs a person, but progress
# only needs a console, and under -Silent there is still a person watching: that
# is the whole point of showing them something while Office downloads.
function Test-Console {
    try {
        return -not [Console]::IsOutputRedirected
    } catch {
        return $false
    }
}

function Get-FolderTotals {
    param([string]$Path)
    $files = @(Get-ChildItem -LiteralPath $Path -Recurse -File -ErrorAction SilentlyContinue)
    $bytes = 0
    foreach ($file in $files) { $bytes += $file.Length }
    return [pscustomobject]@{ Bytes = $bytes; Files = $files.Count }
}

function Format-Size {
    param([double]$Bytes)
    if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N0} MB' -f ($Bytes / 1MB)) }
    return ('{0:N0} KB' -f ($Bytes / 1KB))
}

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

$script:DefaultSession = [ordered]@{
    OdtFolder = (Join-Path $env:SystemDrive 'ODT')
    SourcePath = ''
    Products = @('O365ProPlusRetail')
    Channel = 'Current'
    Arch = '64'
    Languages = @('en-us')
    MatchOsFallback = ''
    MatchInstalledTarget = ''
    ExcludeApps = @()
    DisplayLevel = 'None'
    AcceptEula = $true
    RemoveMsi = $true
    RemoveMsiIgnore = ''
    RemoveExisting = $false
    ForceAppShutdown = $true
    KeepUpdated = $true
    UpdateChannel = ''
    UpdatePath = ''
    TargetVersion = ''
    AllowCdnFallback = $false
    OfficeMgmtCom = $false
    MigrateArch = $false
    Logging = $true
    SharedComputer = $false
    SCLCacheOverride = $false
    SCLCacheOverrideDirectory = ''
    DeviceBased = $false
    AutoActivate = ''
    TenantKey = ''
}

function Get-DefaultSession {
    $session = [ordered]@{}
    foreach ($key in $script:DefaultSession.Keys) { $session[$key] = $script:DefaultSession[$key] }
    $script:Session = $session
    return $session
}

function Get-RunningOfficeApps {
    $names = @('WINWORD', 'EXCEL', 'POWERPNT', 'OUTLOOK', 'MSACCESS', 'MSPUB', 'ONENOTE', 'VISIO', 'WINPROJ', 'LYNC')
    $found = New-Object System.Collections.Generic.List[string]
    foreach ($name in $names) {
        $process = Get-Process -Name $name -ErrorAction SilentlyContinue
        if ($process) { $found.Add($name) }
    }
    return @($found)
}

# ---------------------------------------------------------------------------
# Reference data (from Microsoft's ODT documentation)
# ---------------------------------------------------------------------------

$script:Channels = @(
    [pscustomobject]@{ Id = 'Current'; Name = 'Current Channel'; Note = 'New features as soon as they are ready (default).' },
    [pscustomobject]@{ Id = 'MonthlyEnterprise'; Name = 'Monthly Enterprise Channel'; Note = 'New features once a month.' },
    [pscustomobject]@{ Id = 'SemiAnnual'; Name = 'Semi-Annual Enterprise Channel'; Note = 'New features twice a year.' },
    [pscustomobject]@{ Id = 'SemiAnnualPreview'; Name = 'Semi-Annual Enterprise Channel (Preview)'; Note = 'Preview of the Semi-Annual channel.' },
    [pscustomobject]@{ Id = 'CurrentPreview'; Name = 'Current Channel (Preview)'; Note = 'Preview of the Current channel.' },
    [pscustomobject]@{ Id = 'BetaChannel'; Name = 'Beta Channel'; Note = 'Testing only, not supported for production.' },
    [pscustomobject]@{ Id = 'PerpetualVL2024'; Name = 'PerpetualVL2024'; Note = 'Required for Office LTSC 2024.' },
    [pscustomobject]@{ Id = 'PerpetualVL2021'; Name = 'PerpetualVL2021'; Note = 'Required for Office LTSC 2021.' },
    [pscustomobject]@{ Id = 'PerpetualVL2019'; Name = 'PerpetualVL2019'; Note = 'Required for Office 2019 volume products.' }
)

$script:ChannelMap = @{}
foreach ($channelEntry in $script:Channels) { $script:ChannelMap[$channelEntry.Id] = $channelEntry }

$script:Families = @{
    m365     = @{ Channels = @('Current', 'MonthlyEnterprise', 'SemiAnnual', 'SemiAnnualPreview', 'CurrentPreview', 'BetaChannel'); Arch = @('64', '32') }
    ltsc2024 = @{ Channels = @('PerpetualVL2024'); Arch = @('64') }
    ltsc2021 = @{ Channels = @('PerpetualVL2021'); Arch = @('64', '32') }
    ltsc2019 = @{ Channels = @('PerpetualVL2019'); Arch = @('64', '32') }
}

$script:ProductGroups = @(
    [pscustomobject]@{ Id = 'm365'; Label = 'Microsoft 365 subscriptions' },
    [pscustomobject]@{ Id = 'addon'; Label = 'Subscription add-ons (Visio / Project)' },
    [pscustomobject]@{ Id = 'ltsc2024'; Label = 'Volume licensing - Office LTSC 2024 (64-bit only)' },
    [pscustomobject]@{ Id = 'ltsc2021'; Label = 'Volume licensing - Office LTSC 2021' },
    [pscustomobject]@{ Id = 'ltsc2019'; Label = 'Volume licensing - Office 2019' }
)

$script:Products = @(
    [pscustomobject]@{ Id = 'O365ProPlusRetail'; Name = 'Microsoft 365 Apps for enterprise'; Family = 'm365'; Group = 'm365'; Suite = $true },
    [pscustomobject]@{ Id = 'O365ProPlusEEANoTeamsRetail'; Name = 'Microsoft 365 Apps for enterprise (no Teams, EEA)'; Family = 'm365'; Group = 'm365'; Suite = $true },
    [pscustomobject]@{ Id = 'O365BusinessRetail'; Name = 'Microsoft 365 Apps for business'; Family = 'm365'; Group = 'm365'; Suite = $true },
    [pscustomobject]@{ Id = 'O365BusinessEEANoTeamsRetail'; Name = 'Microsoft 365 Apps for business (no Teams, EEA)'; Family = 'm365'; Group = 'm365'; Suite = $true },
    [pscustomobject]@{ Id = 'O365HomePremRetail'; Name = 'Microsoft 365 Family / Personal'; Family = 'm365'; Group = 'm365'; Suite = $true },
    [pscustomobject]@{ Id = 'AccessRuntimeRetail'; Name = 'Microsoft Access Runtime'; Family = 'm365'; Group = 'm365'; Suite = $false },
    [pscustomobject]@{ Id = 'VisioProRetail'; Name = 'Visio Professional (subscription)'; Family = 'm365'; Group = 'addon'; Suite = $false },
    [pscustomobject]@{ Id = 'ProjectProRetail'; Name = 'Project Professional (subscription)'; Family = 'm365'; Group = 'addon'; Suite = $false },
    [pscustomobject]@{ Id = 'ProjectStdRetail'; Name = 'Project Standard'; Family = 'm365'; Group = 'addon'; Suite = $false },
    [pscustomobject]@{ Id = 'ProPlus2024Volume'; Name = 'Office LTSC Professional Plus 2024'; Family = 'ltsc2024'; Group = 'ltsc2024'; Suite = $true },
    [pscustomobject]@{ Id = 'Standard2024Volume'; Name = 'Office LTSC Standard 2024'; Family = 'ltsc2024'; Group = 'ltsc2024'; Suite = $true },
    [pscustomobject]@{ Id = 'VisioPro2024Volume'; Name = 'Visio LTSC Professional 2024'; Family = 'ltsc2024'; Group = 'ltsc2024'; Suite = $false },
    [pscustomobject]@{ Id = 'VisioStd2024Volume'; Name = 'Visio LTSC Standard 2024'; Family = 'ltsc2024'; Group = 'ltsc2024'; Suite = $false },
    [pscustomobject]@{ Id = 'ProjectPro2024Volume'; Name = 'Project Professional 2024'; Family = 'ltsc2024'; Group = 'ltsc2024'; Suite = $false },
    [pscustomobject]@{ Id = 'ProjectStd2024Volume'; Name = 'Project Standard 2024'; Family = 'ltsc2024'; Group = 'ltsc2024'; Suite = $false },
    [pscustomobject]@{ Id = 'ProPlus2021Volume'; Name = 'Office LTSC Professional Plus 2021'; Family = 'ltsc2021'; Group = 'ltsc2021'; Suite = $true },
    [pscustomobject]@{ Id = 'Standard2021Volume'; Name = 'Office LTSC Standard 2021'; Family = 'ltsc2021'; Group = 'ltsc2021'; Suite = $true },
    [pscustomobject]@{ Id = 'VisioPro2021Volume'; Name = 'Visio LTSC Professional 2021'; Family = 'ltsc2021'; Group = 'ltsc2021'; Suite = $false },
    [pscustomobject]@{ Id = 'VisioStd2021Volume'; Name = 'Visio LTSC Standard 2021'; Family = 'ltsc2021'; Group = 'ltsc2021'; Suite = $false },
    [pscustomobject]@{ Id = 'ProjectPro2021Volume'; Name = 'Project Professional 2021'; Family = 'ltsc2021'; Group = 'ltsc2021'; Suite = $false },
    [pscustomobject]@{ Id = 'ProjectStd2021Volume'; Name = 'Project Standard 2021'; Family = 'ltsc2021'; Group = 'ltsc2021'; Suite = $false },
    [pscustomobject]@{ Id = 'SkypeforBusiness2021Volume'; Name = 'Skype for Business LTSC 2021'; Family = 'ltsc2021'; Group = 'ltsc2021'; Suite = $false },
    [pscustomobject]@{ Id = 'ProPlus2019Volume'; Name = 'Office Professional Plus 2019'; Family = 'ltsc2019'; Group = 'ltsc2019'; Suite = $true },
    [pscustomobject]@{ Id = 'Standard2019Volume'; Name = 'Office Standard 2019'; Family = 'ltsc2019'; Group = 'ltsc2019'; Suite = $true },
    [pscustomobject]@{ Id = 'VisioPro2019Volume'; Name = 'Visio Professional 2019'; Family = 'ltsc2019'; Group = 'ltsc2019'; Suite = $false },
    [pscustomobject]@{ Id = 'ProjectPro2019Volume'; Name = 'Project Professional 2019'; Family = 'ltsc2019'; Group = 'ltsc2019'; Suite = $false }
)

$script:ProductMap = @{}
foreach ($productEntry in $script:Products) { $script:ProductMap[$productEntry.Id] = $productEntry }

$script:Apps = @(
    [pscustomobject]@{ Id = 'Access'; Name = 'Access'; Hint = '' },
    [pscustomobject]@{ Id = 'Excel'; Name = 'Excel'; Hint = '' },
    [pscustomobject]@{ Id = 'Groove'; Name = 'OneDrive'; Hint = 'ExcludeApp ID is Groove' },
    [pscustomobject]@{ Id = 'Lync'; Name = 'Skype for Business'; Hint = 'ExcludeApp ID is Lync' },
    [pscustomobject]@{ Id = 'OneNote'; Name = 'OneNote'; Hint = '' },
    [pscustomobject]@{ Id = 'Outlook'; Name = 'Outlook'; Hint = '' },
    [pscustomobject]@{ Id = 'OutlookForWindows'; Name = 'new Outlook for Windows'; Hint = '' },
    [pscustomobject]@{ Id = 'PowerPoint'; Name = 'PowerPoint'; Hint = '' },
    [pscustomobject]@{ Id = 'Publisher'; Name = 'Publisher'; Hint = '' },
    [pscustomobject]@{ Id = 'Teams'; Name = 'Microsoft Teams'; Hint = '' },
    [pscustomobject]@{ Id = 'Word'; Name = 'Word'; Hint = '' },
    [pscustomobject]@{ Id = 'OneDrive'; Name = 'OneDrive desktop'; Hint = 'the sync app' }
)

$script:AppMap = @{}
foreach ($app in $script:Apps) { $script:AppMap[$app.Id] = $app }

$script:LanguageList = @(
    'ar-sa|Arabic (Saudi Arabia)',
    'cs-cz|Czech',
    'da-dk|Danish',
    'de-de|German',
    'el-gr|Greek',
    'en-au|English (Australia)',
    'en-ca|English (Canada)',
    'en-gb|English (United Kingdom)',
    'en-in|English (India)',
    'en-us|English (United States)',
    'es-es|Spanish (Spain)',
    'es-mx|Spanish (Mexico)',
    'fi-fi|Finnish',
    'fr-ca|French (Canada)',
    'fr-fr|French (France)',
    'he-il|Hebrew',
    'hi-in|Hindi',
    'hu-hu|Hungarian',
    'id-id|Indonesian',
    'it-it|Italian',
    'ja-jp|Japanese',
    'ko-kr|Korean',
    'nb-no|Norwegian (Bokmal)',
    'nl-nl|Dutch',
    'pl-pl|Polish',
    'pt-br|Portuguese (Brazil)',
    'pt-pt|Portuguese (Portugal)',
    'ro-ro|Romanian',
    'ru-ru|Russian',
    'sk-sk|Slovak',
    'sv-se|Swedish',
    'th-th|Thai',
    'tr-tr|Turkish',
    'uk-ua|Ukrainian',
    'vi-vn|Vietnamese',
    'zh-cn|Chinese (Simplified)',
    'zh-tw|Chinese (Traditional)'
)

$script:SpecialLanguages = @(
    [pscustomobject]@{ Id = 'MatchOS'; Name = 'Same as the operating system'; Hint = 'fallback language used when the OS language is unavailable' },
    [pscustomobject]@{ Id = 'MatchInstalled'; Name = 'Same as the installed Office'; Hint = 'install only, cannot be used with /download' },
    [pscustomobject]@{ Id = 'MatchPreviousMSI'; Name = 'Same as the previous MSI version'; Hint = 'for upgrades from MSI Office' }
)

# ---------------------------------------------------------------------------
# Lookup helpers
# ---------------------------------------------------------------------------

function Get-AllowedChannels {
    param([string[]]$ProductIds)
    $families = New-Object System.Collections.Generic.List[string]
    foreach ($id in $ProductIds) {
        $productEntry = $script:ProductMap[$id]
        if ($productEntry -and -not $families.Contains($productEntry.Family)) { $families.Add($productEntry.Family) }
    }
    if ($families.Count -eq 0) {
        return ,@($script:Channels | ForEach-Object { $_.Id })
    }
    $allowed = @($script:Families[$families[0]].Channels)
    for ($i = 1; $i -lt $families.Count; $i++) {
        $allowed = @($allowed | Where-Object { $script:Families[$families[$i]].Channels -contains $_ })
    }
    return ,@($allowed)
}

function Get-AllowedArch {
    param([string[]]$ProductIds)
    $families = New-Object System.Collections.Generic.List[string]
    foreach ($id in $ProductIds) {
        $productEntry = $script:ProductMap[$id]
        if ($productEntry -and -not $families.Contains($productEntry.Family)) { $families.Add($productEntry.Family) }
    }
    if ($families.Count -eq 0) { return ,@('64', '32') }
    $allowed = @($script:Families[$families[0]].Arch)
    for ($i = 1; $i -lt $families.Count; $i++) {
        $allowed = @($allowed | Where-Object { $script:Families[$families[$i]].Arch -contains $_ })
    }
    return ,@($allowed)
}

function Expand-CommaList {
    param([string[]]$Values)
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($value in $Values) {
        foreach ($part in ([string]$value).Split(',')) {
            $trimmed = $part.Trim()
            if ($trimmed) { $out.Add($trimmed) }
        }
    }
    return ,@($out)
}

# Normalizes a value (string, array, list, null) into a clean string array.
function Test-ProductIds {
    param([string[]]$ProductIds)
    $bad = New-Object System.Collections.Generic.List[string]
    foreach ($id in $ProductIds) {
        if (-not $script:ProductMap.ContainsKey($id)) { $bad.Add($id) }
    }
    return ,@($bad)
}

function Test-AppIds {
    param([string[]]$AppIds)
    $bad = New-Object System.Collections.Generic.List[string]
    foreach ($id in $AppIds) {
        if (-not $script:AppMap.ContainsKey($id)) { $bad.Add($id) }
    }
    return ,@($bad)
}

function ConvertTo-XmlEscaped {
    param([string]$Value)
    return [System.Security.SecurityElement]::Escape($Value)
}

function Format-XmlOpenTag {
    param([string]$Name, [string[]]$Attributes, [int]$Indent, [switch]$SelfClosing)

    $pad = ''.PadRight($Indent * 2)
    $close = '>'
    if ($SelfClosing) { $close = ' />' }
    if (-not $Attributes -or $Attributes.Count -eq 0) { return ($pad + '<' + $Name + $close) }

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add($pad + '<' + $Name + ' ' + $Attributes[0])
    $continuationPad = ''.PadRight($pad.Length + 5)
    for ($i = 1; $i -lt $Attributes.Count; $i++) {
        $candidate = $lines[$lines.Count - 1] + ' ' + $Attributes[$i]
        if ($candidate.Length -le 96) { $lines[$lines.Count - 1] = $candidate }
        else { $lines.Add($continuationPad + $Attributes[$i]) }
    }
    $lines[$lines.Count - 1] = $lines[$lines.Count - 1] + $close
    return ($lines -join "`n")
}

function Get-ConfigurationXml {
    param($Config)

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('<Configuration>')

    $addAttributes = New-Object System.Collections.Generic.List[string]
    if ($Config.SourcePath) { $addAttributes.Add('SourcePath="' + (ConvertTo-XmlEscaped $Config.SourcePath) + '"') }
    $addAttributes.Add('OfficeClientEdition="' + $Config.Arch + '"')
    if ($Config.MigrateArch) { $addAttributes.Add('MigrateArch="TRUE"') }
    $addAttributes.Add('Channel="' + $Config.Channel + '"')
    if ($Config.Version) { $addAttributes.Add('Version="' + (ConvertTo-XmlEscaped $Config.Version) + '"') }
    if ($Config.AllowCdnFallback) { $addAttributes.Add('AllowCdnFallback="True"') }
    if ($Config.OfficeMgmtCom) { $addAttributes.Add('OfficeMgmtCOM="True"') }

    $lines.Add((Format-XmlOpenTag -Name 'Add' -Attributes @($addAttributes) -Indent 1))

    foreach ($productId in $Config.Products) {
        $productInfo = $script:ProductMap[$productId]
        $children = New-Object System.Collections.Generic.List[string]

        foreach ($languageId in $Config.Languages) {
            $languageAttributes = @('ID="' + $languageId + '"')
            if ($languageId -eq 'MatchOS' -and $Config.MatchOsFallback) {
                $languageAttributes += 'Fallback="' + (ConvertTo-XmlEscaped $Config.MatchOsFallback) + '"'
            }
            if ($languageId -eq 'MatchInstalled' -and $Config.MatchInstalledTarget) {
                $languageAttributes += 'TargetProduct="' + (ConvertTo-XmlEscaped $Config.MatchInstalledTarget) + '"'
            }
            $children.Add((Format-XmlOpenTag -Name 'Language' -Attributes $languageAttributes -Indent 3 -SelfClosing))
        }

        if ($productInfo -and $productInfo.Suite) {
            foreach ($appId in $Config.ExcludeApps) {
                $children.Add((Format-XmlOpenTag -Name 'ExcludeApp' -Attributes @('ID="' + $appId + '"') -Indent 3 -SelfClosing))
            }
        }

        if ($children.Count -eq 0) {
            $lines.Add((Format-XmlOpenTag -Name 'Product' -Attributes @('ID="' + $productId + '"') -Indent 2 -SelfClosing))
        } else {
            $lines.Add((Format-XmlOpenTag -Name 'Product' -Attributes @('ID="' + $productId + '"') -Indent 2))
            $lines.AddRange($children)
            $lines.Add('    </Product>')
        }
    }

    $lines.Add('  </Add>')

    if ($Config.RemoveExisting) {
        $lines.Add((Format-XmlOpenTag -Name 'Remove' -Attributes @('All="TRUE"') -Indent 1 -SelfClosing))
    }

    if ($Config.RemoveMsi) {
        $ignoreList = New-Object System.Collections.Generic.List[string]
        foreach ($part in ([string]$Config.RemoveMsiIgnore).Split(',')) {
            $trimmed = $part.Trim()
            if ($trimmed) { $ignoreList.Add($trimmed) }
        }
        if ($ignoreList.Count -eq 0) {
            $lines.Add((Format-XmlOpenTag -Name 'RemoveMSI' -Attributes @() -Indent 1 -SelfClosing))
        } else {
            $lines.Add((Format-XmlOpenTag -Name 'RemoveMSI' -Attributes @() -Indent 1))
            foreach ($ignore in $ignoreList) {
                $lines.Add((Format-XmlOpenTag -Name 'IgnoreProduct' -Attributes @('ID="' + (ConvertTo-XmlEscaped $ignore) + '"') -Indent 2 -SelfClosing))
            }
            $lines.Add('  </RemoveMSI>')
        }
    }

    $updateAttributes = New-Object System.Collections.Generic.List[string]
    if ($Config.KeepUpdated) { $updateAttributes.Add('Enabled="TRUE"') } else { $updateAttributes.Add('Enabled="FALSE"') }
    if ($Config.UpdateChannel -and $Config.UpdateChannel -ne $Config.Channel) {
        $updateAttributes.Add('Channel="' + $Config.UpdateChannel + '"')
    }
    if ($Config.UpdatePath) { $updateAttributes.Add('UpdatePath="' + (ConvertTo-XmlEscaped $Config.UpdatePath) + '"') }
    if ($Config.TargetVersion) { $updateAttributes.Add('TargetVersion="' + (ConvertTo-XmlEscaped $Config.TargetVersion) + '"') }
    $lines.Add((Format-XmlOpenTag -Name 'Updates' -Attributes @($updateAttributes) -Indent 1 -SelfClosing))

    $displayAttributes = @(
        'Level="' + $Config.DisplayLevel + '"',
        'AcceptEULA="' + ($(if ($Config.AcceptEula) { 'TRUE' } else { 'FALSE' })) + '"'
    )
    $lines.Add((Format-XmlOpenTag -Name 'Display' -Attributes $displayAttributes -Indent 1 -SelfClosing))

    $properties = New-Object System.Collections.Generic.List[string]
    if ($Config.ForceAppShutdown) { $properties.Add('FORCEAPPSHUTDOWN|TRUE') }
    if ($Config.SharedComputer) { $properties.Add('SharedComputerLicensing|1') }
    if ($Config.SCLCacheOverride) {
        $properties.Add('SCLCacheOverride|1')
        if ($Config.SCLCacheOverrideDirectory) { $properties.Add('SCLCacheOverrideDirectory|' + $Config.SCLCacheOverrideDirectory) }
    }
    if ($Config.DeviceBased) { $properties.Add('DeviceBasedLicensing|1') }
    if ($Config.AutoActivate) { $properties.Add('AUTOACTIVATE|' + $Config.AutoActivate) }
    if ($Config.TenantKey) { $properties.Add('TenantAssociationKey|' + $Config.TenantKey) }

    foreach ($property in $properties) {
        $pair = $property.Split('|')
        $lines.Add((Format-XmlOpenTag -Name 'Property' -Attributes @('Name="' + $pair[0] + '"', 'Value="' + (ConvertTo-XmlEscaped $pair[1]) + '"') -Indent 1 -SelfClosing))
    }

    if ($Config.Logging) {
        $lines.Add((Format-XmlOpenTag -Name 'Logging' -Attributes @('Level="Standard"', 'Path="%temp%"') -Indent 1 -SelfClosing))
    }

    $lines.Add('</Configuration>')
    return ($lines -join "`n")
}

function Get-RemoveAllXml {
    $lines = @(
        '<Configuration>',
        '  <Remove All="TRUE" />',
        '  <Display Level="None" AcceptEULA="TRUE" />',
        '  <Property Name="FORCEAPPSHUTDOWN" Value="TRUE" />',
        '</Configuration>'
    )
    return ($lines -join "`n")
}

function Save-XmlFile {
    param([string]$Path, [string]$Xml)
    $normalized = ($Xml -replace "`r?`n", "`r`n")
    $directory = Split-Path -Parent $Path
    if ($directory -and -not (Test-Path $directory)) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
    [System.IO.File]::WriteAllText($Path, $normalized, (New-Object System.Text.UTF8Encoding($false)))
}

# ---------------------------------------------------------------------------
# ODT acquisition and execution
# ---------------------------------------------------------------------------

function Get-OdtDownloadUrl {
    Write-Info 'Looking up the current Office Deployment Tool download...'
    try {
        $page = Invoke-WebRequest -Uri $script:OdtPageUrl -UseBasicParsing
    } catch {
        throw ('Could not reach the Microsoft download page (' + $script:OdtPageUrl + '). Check the internet connection or proxy, or download the tool manually.')
    }

    $found = @()
    foreach ($match in [regex]::Matches($page.Content, 'https://download\.microsoft\.com/[^"''\s\\<>]+\.exe')) {
        $found += $match.Value
    }
    $named = @($found | Where-Object { $_ -match 'officedeploymenttool' })
    if ($named.Count -gt 0) { $found = $named }
    if ($found.Count -eq 0) {
        throw ('Could not find the download link on ' + $script:OdtPageUrl + '. Download the tool manually from that page and extract setup.exe into your deployment folder.')
    }

    $best = ($found | Sort-Object -Descending | Select-Object -First 1)
    Write-Dim ('Found: ' + [System.IO.Path]::GetFileName($best))
    return $best
}

function Get-OdtSetup {
    param([string]$Folder)

    $setup = Join-Path $Folder 'setup.exe'
    if (Test-Path $setup) {
        Write-Ok ('Office Deployment Tool found in ' + $Folder)
        return $setup
    }

    if (-not (Test-Path $Folder)) { New-Item -ItemType Directory -Force -Path $Folder | Out-Null }
    $toolCache = Join-Path $env:TEMP 'OdtSetup'
    if (-not (Test-Path $toolCache)) { New-Item -ItemType Directory -Force -Path $toolCache | Out-Null }
    $extractor = Join-Path $toolCache 'officedeploymenttool.exe'

    Write-Info 'Downloading the Office Deployment Tool from Microsoft...'
    try {
        $downloadUrl = Get-OdtDownloadUrl
        Invoke-WebRequest -Uri $downloadUrl -OutFile $extractor -UseBasicParsing
    } catch {
        if (Test-Path $extractor) {
            Write-Warn ('Download failed, using the cached copy: ' + $_.Exception.Message)
        } else {
            throw
        }
    }

    Write-Info ('Extracting setup.exe into ' + $Folder + ' ...')
    $extractArgument = '/extract:"' + $Folder + '"'
    if (Test-IsAdmin) {
        Start-Process -FilePath $extractor -ArgumentList @($extractArgument, '/quiet') -Wait | Out-Null
    } else {
        Write-Dim 'Windows may ask for permission to extract the tool.'
        try {
            Start-Process -FilePath $extractor -ArgumentList @($extractArgument, '/quiet') -Wait -Verb RunAs | Out-Null
        } catch {
            Write-Warn ('Could not extract automatically: ' + $_.Exception.Message)
        }
    }

    if (-not (Test-Path $setup)) {
        Write-Warn 'Silent extraction did not produce setup.exe - opening the Microsoft extraction wizard.'
        Write-Dim 'Choose the same folder and finish the wizard.'
        Start-Process -FilePath $extractor -ArgumentList @($extractArgument) -Wait | Out-Null
    }

    if (-not (Test-Path $setup)) {
        throw ('Could not extract the Office Deployment Tool. Download it manually from ' + $script:OdtPageUrl + ' and extract setup.exe into ' + $Folder)
    }

    Write-Ok 'Office Deployment Tool ready.'
    return $setup
}

function Invoke-OdtSetup {
    param(
        [string]$SetupExe,
        [string]$Folder,
        [string[]]$Arguments,
        [string]$Message,
        # Count what the folder is collecting. Worth it for a download, where the
        # number is the only sign of life setup.exe ever gives; pointless for a
        # configure run, where the files are already there.
        [switch]$Measure
    )

    $start = Get-Date
    $startedAt = Get-FolderTotals -Path $Folder

    # .NET rather than Start-Process -PassThru: on this host the cmdlet hands back
    # a process whose ExitCode stays empty, and a deployment that cannot report its
    # exit code cannot say whether it worked.
    $quoted = foreach ($argument in $Arguments) {
        if ($argument -match '\s') { '"' + $argument + '"' } else { $argument }
    }
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $SetupExe
    $info.Arguments = ($quoted -join ' ')
    $info.WorkingDirectory = $Folder
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $process = [System.Diagnostics.Process]::Start($info)

    $progress = Test-Console
    $frames = @('\', '|', '/', '-')
    $frameIndex = 0
    $totals = $startedAt
    $nextMeasure = $start

    while (-not $process.HasExited) {
        if ($progress) {
            $elapsed = (Get-Date) - $start
            if ($Measure -and (Get-Date) -ge $nextMeasure) {
                $totals = Get-FolderTotals -Path $Folder
                $nextMeasure = (Get-Date).AddSeconds(1)
            }
            $text = '  [' + $frames[$frameIndex % 4] + '] ' + $Message
            if ($Measure) {
                $text += '   ' + (Format-Size -Bytes $totals.Bytes) + ' in ' +
                    $totals.Files + ' files'
                $seconds = [Math]::Max($elapsed.TotalSeconds, 0.5)
                $rate = ($totals.Bytes - $startedAt.Bytes) / 1MB / $seconds
                if ($rate -gt 0.05) { $text += '   ' + [Math]::Round($rate, 1) + ' MB/s' }
            }
            $text += '   ' + $elapsed.ToString('mm\:ss')
            Write-Host ("`r" + $text.PadRight(78)) -NoNewline -ForegroundColor Cyan
            $frameIndex++
        }
        Start-Sleep -Milliseconds 400
    }

    # HasExited can turn true a moment before the exit code is read into the
    # object, and an empty exit code is worse than none: this is what makes the
    # code reliable, and it returns at once because the process has finished.
    $process.WaitForExit()

    if ($progress) {
        Write-Host ("`r" + ''.PadRight(78)) -NoNewline
        Write-Host ''
    }

    $elapsed = (Get-Date) - $start
    $exitCode = $process.ExitCode
    # The handle behind a Process object lives until it is let go of, and this one
    # has been read for the last time.
    $process.Dispose()
    if ($Measure) { $totals = Get-FolderTotals -Path $Folder }
    $finished = 'Finished in ' + $elapsed.ToString('mm\:ss') + ' with exit code ' + $exitCode
    if ($Measure -and $exitCode -eq 0) {
        $finished = 'Finished in ' + $elapsed.ToString('mm\:ss') + ': ' +
            (Format-Size -Bytes $totals.Bytes) + ' in ' + $totals.Files + ' files, exit code 0'
    }
    Write-Dim $finished

    $log = Get-ChildItem -Path $env:TEMP -Filter '*.log' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($log -and $log.LastWriteTime -ge $start) {
        Write-Dim ('Log: ' + $log.FullName)
    }

    return $exitCode
}

# ---------------------------------------------------------------------------
# Wizard steps
# ---------------------------------------------------------------------------

# Removing what a successful install leaves behind. It stays when the caller asked
# for it, when the folder is one the caller named, when the run only exported or
# only downloaded, and when anything failed.
function Remove-OdtFiles {
    $folder = $script:Session.OdtFolder
    if ($KeepFiles) {
        Write-Dim ('Downloaded files kept in ' + $folder + ' because -KeepFiles was given.')
        return
    }
    if ($script:FolderNamed) {
        Write-Dim ('Downloaded files kept in ' + $folder + ' because you named that folder.')
        return
    }
    if (-not (Test-Path -LiteralPath (Join-Path $folder 'configuration.xml'))) {
        Write-Dim 'Nothing left to clean up.'
        return
    }
    if ($folder.TrimEnd('\').Length -le 3) {
        Write-Warn ('Not removing ' + $folder + ': that is a drive root.')
        return
    }
    try {
        Remove-Item -LiteralPath $folder -Recurse -Force -ErrorAction Stop
        Write-Ok ('Removed the downloaded files from ' + $folder + '.')
    } catch {
        Write-Warn ('Could not remove ' + $folder + ': ' + $_.Exception.Message)
        Write-Dim 'The install itself finished, so this is only about disk space.'
    }
}

function Invoke-Deploy {
    param([string]$Action)

    $session = $script:Session
    Clear-Host
    Write-Banner
    Write-Title 'Deploying Office'

    $isAdmin = Test-IsAdmin
    if ($Action -ne 'download' -and -not $isAdmin) {
        Write-Warn 'Office installs need an administrator console. This will likely fail.'
    }

    $running = Get-RunningOfficeApps
    if ($running.Count -gt 0) {
        Write-Warn ('Running Office apps: ' + ($running -join ', '))
        if ($session.ForceAppShutdown) {
            Write-Dim 'FORCEAPPSHUTDOWN is enabled, setup will close them (unsaved work is lost).'
        } elseif (-not $script:SilentMode -and (Read-Confirm -Question 'Close them now? (unsaved changes are lost)' -Default $true)) {
            foreach ($name in $running) { Stop-Process -Name $name -Force -ErrorAction SilentlyContinue }
            Start-Sleep -Seconds 2
        }
    }

    if ($Action -eq 'install' -or $Action -eq 'download+install') {
        if (-not (Test-Path $session.OdtFolder)) { New-Item -ItemType Directory -Force -Path $session.OdtFolder | Out-Null }
    }

    $setup = Get-OdtSetup -Folder $session.OdtFolder
    $xmlPath = Join-Path $session.OdtFolder 'configuration.xml'
    Save-XmlFile -Path $xmlPath -Xml (Get-ConfigurationXml -Config $session)
    Write-Ok ('Configuration written to ' + $xmlPath)

    $failed = $false

    if ($Action -eq 'download' -or $Action -eq 'download+install') {
        Write-Info 'Downloading Office installation files. This can take a while and use several GB.'
        $code = Invoke-OdtSetup -SetupExe $setup -Folder $session.OdtFolder -Arguments @('/download', 'configuration.xml') -Message 'Downloading Office files' -Measure
        if ($code -ne 0) {
            $failed = $true
            Write-Err ('Download failed with exit code ' + $code)
        } else {
            Write-Ok 'Download complete.'
        }
    }

    if (-not $failed -and ($Action -eq 'install' -or $Action -eq 'download+install')) {
        Write-Info 'Installing Office. This can take a while.'
        $code = Invoke-OdtSetup -SetupExe $setup -Folder $session.OdtFolder -Arguments @('/configure', 'configuration.xml') -Message 'Installing Office'
        if ($code -ne 0) {
            $failed = $true
            Write-Err ('Install failed with exit code ' + $code)
        } else {
            Write-Ok 'Office installed.'
        }
    }

    Write-Host ''
    if ($failed) {
        Write-Title 'Something went wrong'
        Write-Dim 'Check the newest log in %temp% for the error code, then look it up:'
        Write-Dim 'https://learn.microsoft.com/en-us/microsoft-365-apps/error-codes'
        if (-not $script:SilentMode) { Read-Pause }
        return 2
    }

    if ($Action -eq 'download') {
        Write-Title 'Files ready'
        Write-Dim ('Installation files are in ' + $session.OdtFolder + ' under Office\Data.')
        Write-Dim 'Copy the folder to other PCs and run: setup.exe /configure configuration.xml'
    } else {
        Write-Title 'Done'
        Write-Dim 'Office is installed.'
        Write-Dim 'Reminder: this tool does not activate Office - use the licence you own.'
        Write-Dim 'A reboot is recommended before first use.'
    }

    if (-not $script:SilentMode) { Read-Pause }
    return 0
}

function Invoke-Headless {
    $session = $script:Session

    $badProducts = Test-ProductIds -ProductIds $session.Products
    if ($badProducts.Count -gt 0) {
        throw ('Unknown product ID(s): ' + ($badProducts -join ', ') + '. Known IDs: ' + (($script:Products | ForEach-Object { $_.Id }) -join ', '))
    }
    $badApps = Test-AppIds -AppIds $session.ExcludeApps
    if ($badApps.Count -gt 0) {
        throw ('Unknown ExcludeApp ID(s): ' + ($badApps -join ', ') + '. Known IDs: ' + (($script:Apps | ForEach-Object { $_.Id }) -join ', '))
    }

    $channels = Get-AllowedChannels -ProductIds $session.Products
    if ($channels -notcontains $session.Channel) {
        if ($script:ChannelExplicit) {
            throw ('Channel ' + $session.Channel + ' is not valid for the selected products. Valid: ' + ($channels -join ', '))
        }
        $session.Channel = $channels[0]
    }
    $archs = Get-AllowedArch -ProductIds $session.Products
    if ($archs -notcontains $session.Arch) {
        if ($script:ArchExplicit) {
            throw ('The ' + $session.Arch + '-bit edition is not supported by the selected products. Valid: ' + ($archs -join ', '))
        }
        $session.Arch = $archs[0]
    }

    if ($ExportXml) {
        if ($RemoveAll) {
            Save-XmlFile -Path $ExportXml -Xml (Get-RemoveAllXml)
        } else {
            Save-XmlFile -Path $ExportXml -Xml (Get-ConfigurationXml -Config $session)
        }
        Write-Ok ('XML written to ' + $ExportXml)
        return 0
    }

    if ($RemoveAll) {
        $setup = Get-OdtSetup -Folder $session.OdtFolder
        $xmlPath = Join-Path $session.OdtFolder 'remove.xml'
        Save-XmlFile -Path $xmlPath -Xml (Get-RemoveAllXml)
        Write-Info 'Removing all Click-to-Run Office products...'
        return (Invoke-OdtSetup -SetupExe $setup -Folder $session.OdtFolder -Arguments @('/configure', 'remove.xml') -Message 'Removing Office')
    }

    $action = ''
    if ($Download -and $Install) { $action = 'download+install' }
    elseif ($Download) { $action = 'download' }
    elseif ($Install) { $action = 'install' }
    else { $action = 'download+install' }

    # A successful install has no further use for the files, so the folder goes,
    # unless the run was a download on its own, which means the files were the point.
    $installs = $Install -or (-not $Download -and -not $Install)
    $code = Invoke-Deploy -Action $action
    if ($code -eq 0 -and $installs) { Remove-OdtFiles }
    return $code
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

# Lets tests (or other scripts) load these functions without starting anything:
#   $env:ODT_IMPORT_ONLY = '1'; . .\get.ps1
if ($env:ODT_IMPORT_ONLY) { return }

$script:Session = Get-DefaultSession

try {
    # Every setting the setup screen can choose arrives as a parameter, so a run
    # is "start from the defaults, apply what was asked for".
    if ($Product -or $RemoveAll -or $ExportXml) {
        if ($Product) { $script:Session.Products = Expand-CommaList $Product }
        if ($Channel) { $script:Session.Channel = $Channel; $script:ChannelExplicit = $true }
        if ($Arch) { $script:Session.Arch = $Arch; $script:ArchExplicit = $true }
        if ($Languages) { $script:Session.Languages = Expand-CommaList $Languages }
        if ($Exclude) { $script:Session.ExcludeApps = Expand-CommaList $Exclude }
        if ($OdtFolder) { $script:Session.OdtFolder = $OdtFolder }
        if ($SourcePath) { $script:Session.SourcePath = $SourcePath }
        if ($Version) { $script:Session.Version = $Version }
        if ($ShowWindow) { $script:Session.DisplayLevel = 'Full' }
        exit (Invoke-Headless)
    }

    # Nothing to do: this is the express path, and the setup screen is where the
    # choices are made, so point at it rather than asking the same questions.
    Write-Banner
    Write-Dim 'This installer runs from the settings the setup screen writes for you:'
    Write-Host ''
    Write-Host ('  ' + $script:SiteUrl) -ForegroundColor Cyan
    Write-Host ''
    Write-Dim 'Or name them yourself, for example:'
    Write-Dim '  .\get.ps1 -Product O365ProPlusRetail -Languages en-us -Download -Install -Silent'
    exit 1
} catch {
    Write-Err $_.Exception.Message
    if ($env:ODT_DEBUG) { Write-Host ($_ | Out-String) -ForegroundColor DarkGray }
    exit 1
}
