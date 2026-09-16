$ErrorActionPreference = "Stop"

$testbedRoot = (Resolve-Path $PSScriptRoot).Path
$repositoryRoot = (Resolve-Path (Join-Path $testbedRoot "../..")).Path
$outputRoot = Join-Path $testbedRoot "target/generated-resources/openapi-skill"

function Invoke-CheckedMaven([string] $workingDirectory, [string[]] $arguments) {
    Push-Location $workingDirectory
    try {
        $previousErrorAction = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $lines = @(& mvn @arguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorAction
        Pop-Location
    }
    $lines | ForEach-Object { Write-Host $_ }
    if ($exitCode -ne 0) {
        throw "Maven failed with exit code ${exitCode}: mvn $($arguments -join ' ')"
    }
    return ,$lines
}

function Invoke-FailingMaven([string] $workingDirectory, [string[]] $arguments) {
    Push-Location $workingDirectory
    try {
        $previousErrorAction = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $lines = @(& mvn @arguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorAction
        Pop-Location
    }
    $lines | ForEach-Object { Write-Host $_ }
    if ($exitCode -eq 0) {
        throw "Maven unexpectedly succeeded: mvn $($arguments -join ' ')"
    }
    return ,$lines
}

function Assert-True([bool] $condition, [string] $message) {
    if (-not $condition) { throw $message }
}

function Read-Status([string] $serviceId, [string] $root = $outputRoot) {
    $path = Join-Path $root ".openapi-skill/status/$serviceId.json"
    return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
}

function Get-TreeDigest([string] $root) {
    $builder = [System.Text.StringBuilder]::new()
    $absoluteRoot = (Resolve-Path -LiteralPath $root).Path.TrimEnd('\') + '\'
    Get-ChildItem -LiteralPath $root -File -Recurse | Sort-Object FullName | ForEach-Object {
        $relative = $_.FullName.Substring($absoluteRoot.Length).Replace('\', '/')
        $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        [void] $builder.AppendLine("$relative=$hash")
    }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($builder.ToString())
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        return -join ($sha256.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") })
    } finally {
        $sha256.Dispose()
    }
}

Invoke-CheckedMaven $repositoryRoot @("-B", "-DskipTests", "install") | Out-Null
$initialLog = Invoke-CheckedMaven $testbedRoot @("-B", "clean", "compile")
Assert-True (Test-Path -LiteralPath (Join-Path $outputRoot "orders-api/SKILL.md") -PathType Leaf) "orders Skill missing"
Assert-True (Test-Path -LiteralPath (Join-Path $outputRoot "billing-api/SKILL.md") -PathType Leaf) "billing Skill missing"
Assert-True ((@($initialLog | Where-Object { "$_" -match 'OpenAPI Skill \[orders\] SUCCESS' })).Count -eq 1) "orders must update once"
Assert-True ((@($initialLog | Where-Object { "$_" -match 'OpenAPI Skill \[billing\] SUCCESS' })).Count -eq 1) "billing must update once"

$ordersFirst = (Read-Status "orders").attemptedAt
$billingFirst = (Read-Status "billing").attemptedAt
Invoke-CheckedMaven $testbedRoot @("-B", "compile") | Out-Null
$ordersSecond = (Read-Status "orders").attemptedAt
$billingSecond = (Read-Status "billing").attemptedAt
Assert-True ($ordersSecond -ne $ordersFirst) "repeated compile did not attempt orders update"
Assert-True ($billingSecond -ne $billingFirst) "repeated compile did not attempt billing update"
Assert-True ((Read-Status "orders").outcome -eq "SUCCESS") "repeated compile orders update failed"
Assert-True ((Read-Status "billing").outcome -eq "SUCCESS") "repeated compile billing update failed"

Invoke-CheckedMaven $testbedRoot @("-B", "-DskipTests", "package") | Out-Null
$ordersPackaged = (Read-Status "orders").attemptedAt
$billingPackaged = (Read-Status "billing").attemptedAt
Assert-True ($ordersPackaged -ne $ordersSecond) "package did not traverse orders compile update"
Assert-True ($billingPackaged -ne $billingSecond) "package did not traverse billing compile update"
Assert-True ((Read-Status "orders").outcome -eq "SUCCESS") "package orders update failed"
Assert-True ((Read-Status "billing").outcome -eq "SUCCESS") "package billing update failed"

$billingBeforeTargeted = (Read-Status "billing").attemptedAt
Invoke-CheckedMaven $testbedRoot @("-B", "-pl", "orders-service", "compile") | Out-Null
Assert-True ((Read-Status "orders").attemptedAt -ne $ordersPackaged) "targeted orders compile did not update"
Assert-True ((Read-Status "orders").outcome -eq "SUCCESS") "targeted orders update failed"
Assert-True ((Read-Status "billing").attemptedAt -eq $billingBeforeTargeted) "targeted orders compile touched billing"

Invoke-CheckedMaven $testbedRoot @("-B", "-T", "2", "compile") | Out-Null
Assert-True ((Read-Status "orders").outcome -eq "SUCCESS") "parallel orders update failed"
Assert-True ((Read-Status "billing").outcome -eq "SUCCESS") "parallel billing update failed"

$changedInput = Join-Path $testbedRoot "target/changed-account.json"
Set-Content -LiteralPath $changedInput -Encoding UTF8 -Value @'
{"openapi":"3.1.0","info":{"title":"Changed account API","version":"2"},
 "paths":{"/profiles":{"get":{"operationId":"listProfiles","responses":{"200":{"description":"Profiles returned"}}}}}}
'@
Invoke-CheckedMaven $testbedRoot @("-B", "-pl", "orders-service", "-Dorders.account.path=$changedInput", "compile") | Out-Null
Assert-True ((Read-Status "orders").outcome -eq "SUCCESS") "changed document update failed"
$ordersText = (Get-ChildItem -LiteralPath (Join-Path $outputRoot "orders-api") -File -Recurse |
        Sort-Object FullName | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }) -join "`n"
Assert-True ($ordersText.Contains("/profiles")) "changed operation was not published"
Assert-True (-not $ordersText.Contains("/users")) "deleted operation remained after successful replacement"

$ordersDigest = Get-TreeDigest (Join-Path $outputRoot "orders-api")
$billingBeforeFailure = (Read-Status "billing").attemptedAt
$invalidInput = Join-Path $testbedRoot "target/invalid-account.json"
Set-Content -LiteralPath $invalidInput -Value "{not-json" -Encoding UTF8
$failureLog = Invoke-CheckedMaven $testbedRoot @("-B", "-T", "2", "-Dorders.account.path=$invalidInput", "compile")
Assert-True ((Read-Status "orders").outcome -eq "FAILED") "invalid orders document did not report failure"
Assert-True ((Get-TreeDigest (Join-Path $outputRoot "orders-api")) -eq $ordersDigest) "orders Skill changed after failure"
Assert-True ((Read-Status "billing").outcome -eq "SUCCESS") "billing did not succeed beside orders failure"
Assert-True ((Read-Status "billing").attemptedAt -ne $billingBeforeFailure) "billing was not attempted beside orders failure"
Assert-True ((@($failureLog | Where-Object { "$_" -match 'OpenAPI Skill \[orders\] FAILED' })).Count -eq 1) "orders warning missing"

$firstFailureRoot = Join-Path $testbedRoot "target/first-failure"
Invoke-CheckedMaven $testbedRoot @("-B", "-pl", "orders-service", "-Dopenapi.skill.output=$firstFailureRoot", "-Dorders.account.path=$invalidInput", "compile") | Out-Null
Assert-True (-not (Test-Path -LiteralPath (Join-Path $firstFailureRoot "orders-api"))) "first failure published a Skill"
Assert-True ((Read-Status "orders" $firstFailureRoot).outcome -eq "FAILED") "first failure status missing"

$missingInput = Join-Path $testbedRoot "target/absent.json"
Invoke-CheckedMaven $testbedRoot @("-B", "-pl", "orders-service", "-Dorders.account.path=$missingInput", "compile") | Out-Null
Assert-True ((Read-Status "orders").outcome -eq "FAILED") "missing input did not report failure"
Assert-True ((Get-TreeDigest (Join-Path $outputRoot "orders-api")) -eq $ordersDigest) "orders Skill changed after missing input"

$invalidConfigRoot = Join-Path $testbedRoot "target/invalid-config"
$configLog = Invoke-CheckedMaven $testbedRoot @("-B", "-pl", "orders-service", "-Dopenapi.skill.output=$invalidConfigRoot", "-Dorders.service.id=INVALID", "compile")
Assert-True (-not (Test-Path -LiteralPath (Join-Path $invalidConfigRoot "orders-api"))) "invalid configuration published a Skill"
Assert-True ((@($configLog | Where-Object { "$_" -match 'OpenAPI Skill \[INVALID\] FAILED: CONFIG:' })).Count -eq 1) "configuration warning missing"

$emptyConfigRoot = Join-Path $testbedRoot "target/empty-config"
$emptyConfigLog = Invoke-CheckedMaven $testbedRoot @("-B", "-pl", "orders-service", "-Dopenapi.skill.output=$emptyConfigRoot", "-Dorders.service.id=", "compile")
Assert-True (-not (Test-Path -LiteralPath (Join-Path $emptyConfigRoot "orders-api"))) "missing serviceId published a Skill"
Assert-True ((@($emptyConfigLog | Where-Object { "$_" -match 'OpenAPI Skill \[<unconfigured>\] FAILED: CONFIG:' })).Count -eq 1) "missing serviceId warning missing"

$blockedOutput = Join-Path $testbedRoot "target/blocked-output"
Set-Content -LiteralPath $blockedOutput -Value "do not replace" -Encoding UTF8
$writeLog = Invoke-CheckedMaven $testbedRoot @("-B", "-pl", "orders-service", "-Dopenapi.skill.output=$blockedOutput", "compile")
Assert-True ((Get-Content -LiteralPath $blockedOutput -Raw).Contains("do not replace")) "blocked output file was modified"
Assert-True ((@($writeLog | Where-Object { "$_" -match 'OpenAPI Skill \[orders\] FAILED' })).Count -eq 1) "write warning missing"

$brokenLog = Invoke-FailingMaven $testbedRoot @("-B", "-Pbroken-business-build", "-pl", "broken-service", "compile")
Assert-True ((@($brokenLog | Where-Object { "$_" -match 'COMPILATION ERROR|Compilation failure' })).Count -gt 0) "expected Java compilation error was not reported"

Write-Host "Maven plugin integration verification passed."
