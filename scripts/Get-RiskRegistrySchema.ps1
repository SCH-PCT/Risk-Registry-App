<#
.SYNOPSIS
    Discovers the live schema of the Risk Registry SharePoint lists and library.

.DESCRIPTION
    Connects to a SharePoint Online site and emits a full schema report for the
    lists/library the Risk Registry solution depends on. Produces BOTH:
      - schema-report.json  (machine-readable, consumed when authoring listSchema.ts)
      - schema-report.md    (human-reviewable)

    This script is READ-ONLY. It creates, updates and deletes nothing.

    It exists because the solution is forbidden from guessing column internal
    names. Nothing in src/data may be implemented until this has been run
    against the target site and its output reviewed. See SCHEMA-TODO.md.

.PARAMETER SiteUrl
    Absolute URL of the site collection that hosts the Risk Registry lists.

.PARAMETER ClientId
    Entra ID application (client) ID of a PnP PowerShell registration.
    PnP.PowerShell 2.x+ requires this for interactive login.

.PARAMETER OutputPath
    Directory to write the reports into. Defaults to ../docs relative to this script.

.PARAMETER IncludeHidden
    Include hidden fields in the report. Off by default to keep the report readable.

.PARAMETER FolderSampleSize
    Maximum number of top-level folders to sample from RiskRegistryDocuments, to
    confirm the RiskId folder-naming convention without enumerating every folder on
    a large library. Default 25.

.EXAMPLE
    .\Get-RiskRegistrySchema.ps1 -SiteUrl "https://contoso.sharepoint.com/sites/RiskRegistry" -ClientId "00000000-0000-0000-0000-000000000000"

.NOTES
    Requires PnP.PowerShell. Requires read access to the target site.
    Verified present on this machine: PnP.PowerShell 3.1.0, 2.4.0, 1.12.0.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://')]
    [string] $SiteUrl,

    [Parameter(Mandatory = $false)]
    [string] $ClientId,

    [Parameter(Mandatory = $false)]
    [string] $OutputPath = (Join-Path $PSScriptRoot '..\docs'),

    [Parameter(Mandatory = $false)]
    [switch] $IncludeHidden,

    [Parameter(Mandatory = $false)]
    [int] $FolderSampleSize = 25
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# The lists/library the Risk Registry solution reads. Titles are configuration:
# they are the ONLY identifiers allowed to be checked into source. GUIDs are
# resolved at runtime and must never be hard-coded.
$RiskRegistryTargets = @(
    @{ Title = 'appTopNavigation';          Purpose = 'Top navigation configuration for the application customizer'; Type = 'List' },
    @{ Title = 'RiskRegistryData';           Purpose = 'Risk registry data — the parent entity for every child list'; Type = 'List' },
    @{ Title = 'RiskRegistryDataColumns';    Purpose = 'Columns of risk registry (assumed: grid configuration for the List web part — confirm)'; Type = 'List' },
    @{ Title = 'RiskActions';                Purpose = 'Actions related to risks, linked by RiskId'; Type = 'List' },
    @{ Title = 'RiskActivities';             Purpose = 'Activities related to risks, linked by RiskId'; Type = 'List' },
    @{ Title = 'RiskUpdates';                Purpose = 'Updates related to risks, linked by RiskId'; Type = 'List' },
    @{ Title = 'RiskAssignments';            Purpose = 'Risk registry assignments, linked by RiskId'; Type = 'List' },
    @{ Title = 'RiskRegistryDocuments';      Purpose = 'Documents related to risks, grouped by folders named by RiskId'; Type = 'Library' }
)

function Resolve-FieldTypeDetail {
    param([Parameter(Mandatory)] $Field)

    $detail = [ordered]@{}

    switch -Regex ($Field.TypeAsString) {
        '^Lookup|^LookupMulti$' {
            # Lookup targets matter: they drive $expand and the mapper layer, and
            # directly answer the RiskId join-mechanism question in SCHEMA-TODO.
            $detail['lookupListId']    = $Field.LookupList
            $detail['lookupFieldName'] = $Field.LookupField
            $detail['allowMultiple']   = [bool]$Field.AllowMultipleValues
            break
        }
        '^Choice|^MultiChoice$' {
            # Choice values are enumerated so the UI never invents a status token.
            $detail['choices']         = @($Field.Choices)
            $detail['allowFillIn']     = [bool]$Field.FillInChoice
            break
        }
        '^User|^UserMulti$' {
            $detail['allowMultiple']   = [bool]$Field.AllowMultipleValues
            $detail['selectionMode']   = "$($Field.SelectionMode)"
            break
        }
        '^DateTime$' {
            $detail['displayFormat']   = "$($Field.DisplayFormat)"
            break
        }
        '^Number|^Currency$' {
            $detail['minimumValue']    = $Field.MinimumValue
            $detail['maximumValue']    = $Field.MaximumValue
            break
        }
        '^Calculated$' {
            $detail['formula']         = $Field.Formula
            $detail['outputType']      = "$($Field.OutputType)"
            break
        }
    }

    return $detail
}

function Get-RiskRegistryListReport {
    param([Parameter(Mandatory)][hashtable] $TargetDefinition)

    $title = $TargetDefinition.Title

    $list = Get-PnPList -Identity $title -ErrorAction SilentlyContinue
    if ($null -eq $list) {
        Write-Warning "List/library '$title' was NOT FOUND on $SiteUrl."
        return [ordered]@{
            title   = $title
            purpose = $TargetDefinition.Purpose
            type    = $TargetDefinition.Type
            found   = $false
            error   = 'Not found. Verify the title, or that the account has read access.'
            fields  = @()
        }
    }

    Write-Host "  Reading '$title' ..." -ForegroundColor DarkGray

    $fields = Get-PnPField -List $title

    $fieldReport = @()
    foreach ($f in $fields) {
        if (-not $IncludeHidden -and $f.Hidden) { continue }

        $fieldReport += [ordered]@{
            displayName  = $f.Title
            internalName = $f.InternalName
            type         = $f.TypeAsString
            required     = [bool]$f.Required
            unique       = [bool]$f.EnforceUniqueValues
            indexed      = [bool]$f.Indexed
            readOnly     = [bool]$f.ReadOnlyField
            hidden       = [bool]$f.Hidden
            description  = $f.Description
            typeDetail   = Resolve-FieldTypeDetail -Field $f
        }
    }

    $result = [ordered]@{
        title       = $list.Title
        purpose     = $TargetDefinition.Purpose
        type        = $TargetDefinition.Type
        found       = $true
        id          = $list.Id.ToString()
        itemCount   = $list.ItemCount
        rootFolder  = $list.RootFolder.ServerRelativeUrl
        baseType    = "$($list.BaseType)"
        fieldCount  = $fieldReport.Count
        fields      = $fieldReport
        folderSample = @()
    }

    # For the document library, sample top-level folder names so the RiskId
    # folder-naming convention can be confirmed without enumerating every folder.
    if ($TargetDefinition.Type -eq 'Library') {
        Write-Host "    Sampling up to $FolderSampleSize top-level folders ..." -ForegroundColor DarkGray
        try {
            $folders = Get-PnPFolderItem -FolderSiteRelativeUrl $list.RootFolder.ServerRelativeUrl -ItemType Folder -ErrorAction SilentlyContinue |
                Select-Object -First $FolderSampleSize
            $result.folderSample = @($folders | ForEach-Object {
                [ordered]@{ name = $_.Name; serverRelativeUrl = $_.ServerRelativeUrl }
            })
        }
        catch {
            Write-Warning "    Could not enumerate folders in '$title': $($_.Exception.Message)"
        }
    }

    return $result
}

function Write-MarkdownReport {
    param(
        [Parameter(Mandatory)] $Report,
        [Parameter(Mandatory)][string] $Path
    )

    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine('# Risk Registry - Discovered List/Library Schema')
    [void]$sb.AppendLine()
    [void]$sb.AppendLine('> Generated by `scripts/Get-RiskRegistrySchema.ps1`. Do not edit by hand.')
    [void]$sb.AppendLine('> Site URL is intentionally omitted from this report so it can be committed.')
    [void]$sb.AppendLine()
    [void]$sb.AppendLine("Generated (UTC): $($Report.generatedUtc)")
    [void]$sb.AppendLine()

    foreach ($list in $Report.lists) {
        [void]$sb.AppendLine("## $($list.title) ($($list.type))")
        [void]$sb.AppendLine()
        [void]$sb.AppendLine("_$($list.purpose)_")
        [void]$sb.AppendLine()

        if (-not $list.found) {
            [void]$sb.AppendLine('**NOT FOUND.** ' + $list.error)
            [void]$sb.AppendLine()
            continue
        }

        [void]$sb.AppendLine("- List/library GUID: ``$($list.id)`` (runtime-resolved; never hard-code)")
        [void]$sb.AppendLine("- Item count: $($list.itemCount)")
        [void]$sb.AppendLine("- Fields reported: $($list.fieldCount)")
        [void]$sb.AppendLine()
        [void]$sb.AppendLine('| Display name | Internal name | Type | Required | Indexed | Unique | Notes |')
        [void]$sb.AppendLine('| --- | --- | --- | --- | --- | --- | --- |')

        foreach ($f in $list.fields) {
            $notes = @()
            if ($f.typeDetail.Count -gt 0) {
                foreach ($k in $f.typeDetail.Keys) {
                    $v = $f.typeDetail[$k]
                    if ($v -is [array]) { $v = ($v -join '; ') }
                    if ($null -ne $v -and "$v" -ne '') { $notes += "$k=$v" }
                }
            }
            if ($f.readOnly) { $notes += 'read-only' }

            $noteText = if ($notes.Count -gt 0) { ($notes -join ', ') -replace '\|', '\|' } else { '' }

            [void]$sb.AppendLine("| $($f.displayName) | ``$($f.internalName)`` | $($f.type) | $($f.required) | $($f.indexed) | $($f.unique) | $noteText |")
        }
        [void]$sb.AppendLine()

        if ($list.type -eq 'Library') {
            [void]$sb.AppendLine('### Top-level folder sample (RiskId naming-convention check)')
            [void]$sb.AppendLine()
            if ($list.folderSample.Count -eq 0) {
                [void]$sb.AppendLine('No folders found, or folder enumeration failed. See console warnings.')
            }
            else {
                [void]$sb.AppendLine('| Folder name | Server-relative URL |')
                [void]$sb.AppendLine('| --- | --- |')
                foreach ($folder in $list.folderSample) {
                    [void]$sb.AppendLine("| $($folder.name) | $($folder.serverRelativeUrl) |")
                }
            }
            [void]$sb.AppendLine()
            [void]$sb.AppendLine('Review whether folder names are a raw numeric RiskId, a formatted value, or something')
            [void]$sb.AppendLine('else entirely, and update SCHEMA-TODO.md question #27 accordingly.')
            [void]$sb.AppendLine()
        }
    }

    $sb.ToString() | Set-Content -Path $Path -Encoding UTF8
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    throw 'PnP.PowerShell is not installed. Run: Install-Module PnP.PowerShell -Scope CurrentUser'
}

if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null
}
$OutputPath = (Resolve-Path $OutputPath).Path

Write-Host "Connecting to $SiteUrl ..." -ForegroundColor Cyan

$connectArgs = @{ Url = $SiteUrl; Interactive = $true }
if ($ClientId) { $connectArgs['ClientId'] = $ClientId }

try {
    Connect-PnPOnline @connectArgs
}
catch {
    Write-Error "Connection failed: $($_.Exception.Message)"
    Write-Host ''
    Write-Host 'PnP.PowerShell 2.x and later require an app registration for interactive login.' -ForegroundColor Yellow
    Write-Host 'If you do not have one, register it once with:' -ForegroundColor Yellow
    Write-Host '  Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PnP Risk Registry Schema" -Tenant <tenant>.onmicrosoft.com' -ForegroundColor Yellow
    exit 1
}

$web = Get-PnPWeb
Write-Host "Connected to: $($web.Title)" -ForegroundColor Green
Write-Host ''

$report = [ordered]@{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    webTitle     = $web.Title
    lists        = @()
}

foreach ($target in $RiskRegistryTargets) {
    $report.lists += Get-RiskRegistryListReport -TargetDefinition $target
}

Disconnect-PnPOnline

$jsonPath = Join-Path $OutputPath 'schema-report.json'
$mdPath   = Join-Path $OutputPath 'schema-report.md'

$report | ConvertTo-Json -Depth 10 | Set-Content -Path $jsonPath -Encoding UTF8
Write-MarkdownReport -Report $report -Path $mdPath

Write-Host ''
Write-Host 'Schema report written:' -ForegroundColor Green
Write-Host "  $jsonPath"
Write-Host "  $mdPath"

$missing = @($report.lists | Where-Object { -not $_.found })
if ($missing.Count -gt 0) {
    Write-Host ''
    Write-Warning "$($missing.Count) of $($RiskRegistryTargets.Count) lists/library were not found: $(($missing | ForEach-Object { $_.title }) -join ', ')"
    Write-Host 'Resolve these before implementing any repository.' -ForegroundColor Yellow
}
