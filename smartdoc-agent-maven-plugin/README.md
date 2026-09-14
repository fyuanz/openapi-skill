# SmartDoc Agent Maven Plugin

The `generate-skill` goal reads one complete set of local OpenAPI 3.1.0 JSON documents and publishes one
service-owned Skill through the core updater. It has no default lifecycle phase: configure the execution explicitly
after SpringDoc / NextDoc4j in the one module that owns generation for the service.

```xml
<plugin>
  <groupId>io.github.fyuanz</groupId>
  <artifactId>smartdoc-agent-maven-plugin</artifactId>
  <version>1.1.0</version>
  <inherited>false</inherited>
  <executions>
    <execution>
      <id>update-orders-skill</id>
      <phase>verify</phase>
      <goals><goal>generate-skill</goal></goals>
    </execution>
  </executions>
  <configuration>
    <serviceId>orders</serviceId>
    <skillName>orders-api</skillName>
    <outputDirectory>${project.build.directory}/generated-resources/smartdoc</outputDirectory>
    <timeoutSeconds>30</timeoutSeconds>
    <documentsDirectory>${project.build.directory}/generated-openapi</documentsDirectory>
  </configuration>
</plugin>
```

`documentsDirectory` discovers regular top-level `*.json` files in deterministic filename order. The filename stem
becomes `documentId`, so names must use safe lowercase words separated by hyphens, such as `openapi.json` or
`account-admin.json`. An absent or empty directory logs `SKIPPED` and produces nothing. Non-JSON files are ignored.
Explicit `<documents>` entries remain available when paths and IDs cannot follow this convention; do not configure
both modes.

"Documents" means the OpenAPI JSON files/groups found in that directory or explicitly listed by the target project,
not a second checklist of required operations or schemas. In directory mode, the files present define the service's
current input set; content and groups absent from that set are not generated. All discovered files are frozen and
validated together. Explicit entries use stricter semantics: every listed path must exist, which is useful when a
fixed group set must never be published partially.
Configuration, read, conversion, timeout, locking, validation, and
publication failures are logged as service-specific warnings; they do not throw a Maven build failure. Once the
service, Skill, and output configuration is valid, each update attempt also writes its outcome to the status file.
Ordinary Java compilation and other Maven failures keep their normal exit status. The output parent contains
`<skillName>/` and updater state under `.smartdoc/`.

Local files under `src/main/openapi/` can be authoritative inputs and are read on every invocation. A generated
document must be produced earlier in the same build. Bind the goal after that producer and set
`<requireCurrentBuildDocuments>true</requireCurrentBuildDocuments>`; every configured document must then have been
rewritten no earlier than the current Maven session start and must remain unchanged while its bytes are read. An old
file left by a failed producer causes a warning and a failed update. The plugin does not start an application or
implement springdoc scanning. Bind the execution only in the service's generation-owner module so plugin inheritance
cannot create duplicate writers.

Runtime springdoc export requires compiled application classes, so the verified sample binds springdoc export to
`integration-test` and this goal to `verify`. It is a separate entry point from the static-document `compile` mode.
The testbed also shows that a springdoc HTTP capture failure can remain non-blocking; Spring Boot startup failure is
still a normal failure of the Spring Boot Maven plugin.

The default output parent is `${project.build.directory}/generated-resources/smartdoc`; `clean` removes it. Never
point `outputDirectory` at a source root or a directory containing manual files.

Run the standalone lifecycle verification from the repository root:

```powershell
powershell -NoProfile -File testbeds/maven-plugin-integration/verify.ps1
powershell -NoProfile -File testbeds/springdoc-multi-package/verify-generated-integration.ps1
```
