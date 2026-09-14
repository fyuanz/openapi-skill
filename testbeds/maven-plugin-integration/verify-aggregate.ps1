$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$probeRoot = Join-Path $PSScriptRoot 'target/aggregate-verification'
$null = New-Item -ItemType Directory -Force -Path $probeRoot

function Invoke-Maven([string] $name, [string] $directory, [string[]] $arguments) {
    Push-Location $directory
    try {
        & mvn @arguments > (Join-Path $probeRoot "$name.log") 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Maven failed: $name; see $probeRoot/$name.log" }
    } finally { Pop-Location }
}
function Assert-That([bool] $condition, [string] $message) {
    if (-not $condition) { throw $message }
}
function Status([string] $root, [string] $id) {
    return (Get-Content -Raw -LiteralPath (Join-Path $root ".smartdoc/status/$id.json") | ConvertFrom-Json)
}
function Tree([string] $root) {
    return (@(Get-ChildItem -LiteralPath $root -Recurse -File | Sort-Object FullName | ForEach-Object {
        $_.FullName.Substring($root.Length) + ':' + (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }) -join "`n")
}

Invoke-Maven 'install' $repositoryRoot @('-B', '-DskipTests', 'install')
$reactorOutput = Join-Path $probeRoot 'reactor'
Invoke-Maven 'reactor' $PSScriptRoot @('-B', '-Paggregate-skills', '-T', '2', "-Dsmartdoc.output=$reactorOutput", 'compile')
foreach ($id in @('orders', 'billing', 'platform')) {
    Assert-That ((Status $reactorOutput $id).outcome -eq 'SUCCESS') "$id reactor update failed"
}
$reactorLog = Get-Content -Raw -LiteralPath (Join-Path $probeRoot 'reactor.log')
Assert-That ($reactorLog.IndexOf('SmartDoc [platform] SUCCESS') -gt $reactorLog.IndexOf('SmartDoc [orders] SUCCESS')) 'aggregate ran before orders'
Assert-That ($reactorLog.IndexOf('SmartDoc [platform] SUCCESS') -gt $reactorLog.IndexOf('SmartDoc [billing] SUCCESS')) 'aggregate ran before billing'

$ordersInput = Join-Path $probeRoot 'inputs/orders'
$billingInput = Join-Path $probeRoot 'inputs/billing'
foreach ($id in @('orders', 'billing')) {
    $destination = Join-Path $probeRoot "inputs/$id"
    $null = New-Item -ItemType Directory -Force -Path $destination
    Copy-Item -Path (Join-Path $PSScriptRoot "$id-service/src/main/openapi/*.json") -Destination $destination -Force
}
$bothOutput = Join-Path $probeRoot 'both'
$common = @('-B', '-f', 'skill-set/pom.xml', "-Dsmartdoc.output=$bothOutput",
    "-Daggregate.orders.directory=$ordersInput", "-Daggregate.billing.directory=$billingInput")
Invoke-Maven 'both' $PSScriptRoot ($common + @('-Dsmartdoc.output.mode=both', 'compile'))
foreach ($id in @('orders', 'billing', 'platform')) {
    Assert-That ((Status $bothOutput $id).outcome -eq 'SUCCESS') "$id coexistence update failed"
}
$source = Get-Content -Raw -LiteralPath (Join-Path $bothOutput 'platform-api/references/source.json') | ConvertFrom-Json
Assert-That ($source.services.Count -eq 2 -and $source.documents.Count -eq 3) 'aggregate membership/document count mismatch'
$attempt = (Status $bothOutput 'platform').attemptedAt
Invoke-Maven 'repeat' $PSScriptRoot ($common + @('-Dsmartdoc.output.mode=both', 'compile'))
Assert-That ((Status $bothOutput 'platform').attemptedAt -ne $attempt) 'repeat build did not update aggregate'

$previousAggregate = Tree (Join-Path $bothOutput 'platform-api')
$previousBilling = Tree (Join-Path $bothOutput 'billing-api')
Set-Content -LiteralPath (Join-Path $billingInput 'public.json') -Value '{invalid-json' -Encoding UTF8
Invoke-Maven 'failed-member' $PSScriptRoot ($common + @('-Dsmartdoc.output.mode=both', 'compile'))
Assert-That ((Status $bothOutput 'platform').outcome -eq 'FAILED') 'partial aggregate was accepted'
Assert-That ((Status $bothOutput 'orders').outcome -eq 'SUCCESS') 'valid peer was blocked'
Assert-That ((Tree (Join-Path $bothOutput 'platform-api')) -eq $previousAggregate) 'aggregate changed on failure'
Assert-That ((Tree (Join-Path $bothOutput 'billing-api')) -eq $previousBilling) 'failed member changed'

Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'billing-service/src/main/openapi/public.json') -Destination $billingInput -Force
Invoke-Maven 'recovered' $PSScriptRoot ($common + @('-Dsmartdoc.output.mode=both', 'compile'))
foreach ($id in @('orders', 'billing', 'platform')) {
    Assert-That ((Status $bothOutput $id).outcome -eq 'SUCCESS') "$id did not recover after input repair"
}
$aggregateOutput = Join-Path $probeRoot 'aggregate-only'
Invoke-Maven 'aggregate-only' $PSScriptRoot @('-B', '-f', 'skill-set/pom.xml', "-Dsmartdoc.output=$aggregateOutput", 'compile')
Assert-That ((Status $aggregateOutput 'platform').outcome -eq 'SUCCESS') 'aggregate-only update failed'
Assert-That (-not (Test-Path (Join-Path $aggregateOutput 'orders-api'))) 'aggregate-only generated individual output'
$serviceOutput = Join-Path $probeRoot 'service-only'
Invoke-Maven 'service-only' $PSScriptRoot @('-B', '-f', 'skill-set/pom.xml', "-Dsmartdoc.output=$serviceOutput", '-Dsmartdoc.output.mode=service', 'compile')
Assert-That ((Status $serviceOutput 'orders').outcome -eq 'SUCCESS') 'service-only orders update failed'
Assert-That ((Status $serviceOutput 'billing').outcome -eq 'SUCCESS') 'service-only billing update failed'
Assert-That (-not (Test-Path (Join-Path $serviceOutput 'platform-api'))) 'service-only generated aggregate output'
Write-Output 'PASS: parallel reactor order, both outputs, repeat execution, member failure isolation, aggregate-only and service-only Maven configuration'
