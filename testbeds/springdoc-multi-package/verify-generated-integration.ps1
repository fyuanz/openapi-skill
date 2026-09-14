$ErrorActionPreference = "Stop"

$testbedRoot = (Resolve-Path $PSScriptRoot).Path
$repositoryRoot = (Resolve-Path (Join-Path $testbedRoot "../..")).Path

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

function Assert-True([bool] $condition, [string] $message) {
    if (-not $condition) { throw $message }
}

Invoke-CheckedMaven $repositoryRoot @("-B", "-DskipTests", "install") | Out-Null
$buildLog = Invoke-CheckedMaven $testbedRoot @("-B", "clean", "verify")

$reports = @(Get-ChildItem -LiteralPath (Join-Path $testbedRoot "target/surefire-reports") -Filter "TEST-*.xml")
$tests = 0
$failures = 0
$errors = 0
foreach ($report in $reports) {
    [xml] $xml = Get-Content -LiteralPath $report.FullName -Raw
    $tests += [int] $xml.testsuite.tests
    $failures += [int] $xml.testsuite.failures
    $errors += [int] $xml.testsuite.errors
}
Assert-True ($tests -eq 6) "expected six runtime testbed tests, got $tests"
Assert-True ($failures -eq 0 -and $errors -eq 0) "runtime testbed tests failed"
Assert-True (-not (Test-Path -LiteralPath (Join-Path $testbedRoot "target/generated-openapi"))) `
        "build-time OpenAPI export directory must not be created"
Assert-True (-not (Test-Path -LiteralPath (Join-Path $testbedRoot "target/generated-resources/smartdoc"))) `
        "build-time Skill output directory must not be created"
Assert-True ((@($buildLog | Where-Object { "$_" -match "spring-boot:(start|stop)|springdoc-openapi-maven-plugin|smartdoc-agent-maven-plugin" })).Count -eq 0) `
        "build unexpectedly invoked an application start/export/Skill generation plugin"

Write-Host "Runtime SmartDoc integration verification passed without build-time application startup or OpenAPI capture."
