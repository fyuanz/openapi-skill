$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    # Never accept old target files after a failed build.
    & mvn -B clean test
    if ($LASTEXITCODE -ne 0) { throw "Fixture validation failed (exit $LASTEXITCODE); snapshots were not refreshed." }

    # One producer, two dialects. 3.1 is the default group; the 3.0 group comes from the opt-in test class.
    $dialects = @(
        [ordered]@{
            name = '3.1'
            version = '^3\.1\.\d+$'
            directory = 'target/openapi'
            suffix = ''
            capture = 'OpenApiContractTest; springdoc.api-docs.version defaults to OPENAPI_3_1'
        },
        [ordered]@{
            name = '3.0'
            version = '^3\.0\.\d+$'
            directory = 'target/openapi30'
            suffix = '-v30'
            capture = 'OpenApi30ContractTest; property springdoc.api-docs.version=OPENAPI_3_0'
        }
    )
    New-Item -ItemType Directory -Path fixtures -Force | Out-Null
    $documents = @()
    foreach ($dialect in $dialects) {
        foreach ($group in @('account', 'business')) {
            $source = Join-Path $PSScriptRoot "$($dialect.directory)/$group.json"
            $document = Get-Content -LiteralPath $source -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($document.openapi -notmatch $dialect.version) {
                throw "Unexpected OpenAPI version $($document.openapi) in $group (dialect $($dialect.name))"
            }
            $operations = 0
            foreach ($path in $document.paths.PSObject.Properties) {
                foreach ($method in $path.Value.PSObject.Properties.Name) {
                    if ($method -in @('get','post','put','patch','delete','head','options','trace')) { $operations++ }
                }
            }
            $file = "$group$($dialect.suffix).json"
            $documents += [ordered]@{
                documentId = "$group$($dialect.suffix)"
                dialect = $dialect.name
                endpoint = "/v3/api-docs/$group"
                file = $file
                openapi = $document.openapi
                sha256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
                operations = $operations
                schemas = @($document.components.schemas.PSObject.Properties).Count
            }
            Copy-Item -LiteralPath $source -Destination "fixtures/$file" -Force
        }
    }
    $sourceHashes = [ordered]@{}
    $sourceFiles = @(Get-Item pom.xml) + @(Get-ChildItem src/main -File -Recurse)
    foreach ($source in ($sourceFiles | Sort-Object FullName)) {
        $relative = $source.FullName.Substring($PSScriptRoot.Length + 1).Replace('\', '/')
        $sourceHashes[$relative] = (Get-FileHash -LiteralPath $source.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    $dialectCaptures = [ordered]@{}
    foreach ($dialect in $dialects) { $dialectCaptures[$dialect.name] = $dialect.capture }
    $metadata = [ordered]@{
        serviceId = 'springdoc-multi-package'
        skillName = 'springdoc-multi-package-api'
        java = '17'
        springBoot = '3.5.9'
        springdoc = '2.8.15'
        captureCommand = 'powershell -NoProfile -File testbeds/springdoc-multi-package/refresh-fixtures.ps1'
        capture = 'SpringBootTest random loopback port; HTTP connect 5s/request 20s; test 60s; fork 120s; context closed after test'
        dialects = $dialectCaptures
        sanitization = 'All data authored as fictional samples; no external API data. Pretty printing only; no semantic rewrite.'
        documents = $documents
        sourceSha256 = $sourceHashes
    }
    $json = $metadata | ConvertTo-Json -Depth 12
    [System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'fixtures/metadata.json'), $json + "`n", [System.Text.UTF8Encoding]::new($false))
    Write-Output 'Refreshed all validated fixture documents and metadata across both dialects.'
} finally {
    Pop-Location
}
