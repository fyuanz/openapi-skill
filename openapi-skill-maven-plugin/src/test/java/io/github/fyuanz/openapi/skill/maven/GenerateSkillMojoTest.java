package io.github.fyuanz.openapi.skill.maven;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.maven.execution.DefaultMavenExecutionRequest;
import org.apache.maven.execution.DefaultMavenExecutionResult;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.plugin.logging.Log;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.TreeMap;

import static org.junit.jupiter.api.Assertions.*;

class GenerateSkillMojoTest {
    @TempDir Path temporary;
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void defaultsOutputToMavenGeneratedResources() throws Exception {
        String descriptor;
        try (var input = GenerateSkillMojo.class.getResourceAsStream("/META-INF/maven/plugin.xml")) {
            assertNotNull(input);
            descriptor = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertTrue(descriptor.contains(
                "default-value=\"${project.build.directory}/generated-resources/openapi-skill\""));
        assertFalse(descriptor.contains("<phase>"), "target POM must explicitly select the producer-dependent phase");
    }

    @Test
    void publishesAllConfiguredDocumentsAndReportsSuccess() throws Exception {
        Path account = write("account.json", document("/users", "listUsers"));
        Path business = write("business.json", document("/orders", "createOrder"));
        var log = new RecordingLog();

        mojo(log, List.of(source("account", account), source("business", business))).execute();

        Path skill = temporary.resolve("output/orders-api");
        assertTrue(Files.isRegularFile(skill.resolve("SKILL.md")));
        var source = mapper.readTree(Files.readString(skill.resolve("references/source.json")));
        assertEquals(List.of("account", "business"), source.path("documents").findValuesAsText("documentId"));
        assertTrue(log.infos.stream().anyMatch(message -> message.contains("orders") && message.contains("SUCCESS")));
        assertTrue(log.warnings.isEmpty());
    }

    @Test
    void discoversTopLevelJsonDocumentsFromConfiguredDirectory() throws Exception {
        Path input = Files.createDirectory(temporary.resolve("generated-openapi"));
        Files.writeString(input.resolve("business.json"), document("/orders", "createOrder"));
        Files.writeString(input.resolve("account.json"), document("/users", "listUsers"));
        Files.writeString(input.resolve("capture.log"), "ignored");
        var log = new RecordingLog();
        GenerateSkillMojo mojo = mojo(log, null);
        mojo.documentsDirectory = input.toFile();

        mojo.execute();

        var source = mapper.readTree(Files.readString(
                temporary.resolve("output/orders-api/references/source.json")));
        assertEquals(List.of("account", "business"), source.path("documents").findValuesAsText("documentId"));
        assertTrue(log.infos.stream().anyMatch(message -> message.contains("SUCCESS")));
        assertTrue(log.warnings.isEmpty());
    }

    @Test
    void emptyDocumentsDirectorySkipsGeneration() throws Exception {
        Path input = Files.createDirectory(temporary.resolve("generated-openapi"));
        var log = new RecordingLog();
        GenerateSkillMojo mojo = mojo(log, null);
        mojo.documentsDirectory = input.toFile();

        mojo.execute();

        assertFalse(Files.exists(temporary.resolve("output/orders-api")));
        assertTrue(log.infos.stream().anyMatch(message -> message.contains("SKIPPED")
                && message.contains(input.toAbsolutePath().toString())));
        assertTrue(log.warnings.isEmpty());
    }

    @Test
    void invalidDocumentWarnsAndPreservesThePreviousCompleteSkill() throws Exception {
        Path account = write("account.json", document("/users", "listUsers"));
        var log = new RecordingLog();
        GenerateSkillMojo mojo = mojo(log, List.of(source("account", account)));
        mojo.execute();
        Path skill = temporary.resolve("output/orders-api");
        var before = tree(skill);
        Files.writeString(account, "{not-json");

        assertDoesNotThrow(mojo::execute);

        assertEquals(before, tree(skill));
        assertTrue(log.warnings.stream().anyMatch(message -> message.contains("orders")
                && message.contains("FAILED") && message.contains("account")));
        assertEquals("FAILED", mapper.readTree(Files.readString(
                temporary.resolve("output/.openapi-skill/status/orders.json"))).path("outcome").asText());
    }

    @Test
    void missingDocumentAndInvalidConfigurationRemainNonBlocking() {
        var missingLog = new RecordingLog();
        GenerateSkillMojo missing = mojo(missingLog,
                List.of(source("account", temporary.resolve("missing.json"))));
        assertDoesNotThrow(missing::execute);
        assertTrue(missingLog.warnings.stream().anyMatch(message -> message.contains("account")));

        var configLog = new RecordingLog();
        GenerateSkillMojo invalid = mojo(configLog, List.of());
        invalid.serviceId = null;
        assertDoesNotThrow(invalid::execute);
        assertTrue(configLog.warnings.stream().anyMatch(message -> message.contains("CONFIG")));
    }

    @Test
    void currentBuildModeRejectsOldDocumentsAndPreservesThePublishedSkill() throws Exception {
        Path account = write("account.json", document("/users", "listUsers"));
        GenerateSkillMojo initial = mojo(new RecordingLog(), List.of(source("account", account)));
        initial.execute();
        Path skill = temporary.resolve("output/orders-api");
        var before = tree(skill);
        Instant buildStartedAt = Instant.now();
        Files.setLastModifiedTime(account, FileTime.from(buildStartedAt.minusSeconds(5)));
        var log = new RecordingLog();
        GenerateSkillMojo stale = mojo(log, List.of(source("account", account)));
        stale.requireCurrentBuildDocuments = true;
        stale.session = session(buildStartedAt);

        assertDoesNotThrow(stale::execute);

        assertEquals(before, tree(skill));
        assertTrue(log.warnings.stream().anyMatch(message -> message.contains("account")
                && message.contains("current Maven build")));
        assertEquals("FAILED", mapper.readTree(Files.readString(
                temporary.resolve("output/.openapi-skill/status/orders.json"))).path("outcome").asText());
    }

    @Test
    void currentBuildModeAcceptsARewrittenDocumentEvenWhenItsContentIsUnchanged() throws Exception {
        Path account = write("account.json", document("/users", "listUsers"));
        Instant buildStartedAt = Instant.now().minusSeconds(1);
        Files.setLastModifiedTime(account, FileTime.from(buildStartedAt.plusMillis(100)));
        var log = new RecordingLog();
        GenerateSkillMojo mojo = mojo(log, List.of(source("account", account)));
        mojo.requireCurrentBuildDocuments = true;
        mojo.session = session(buildStartedAt);

        mojo.execute();

        assertTrue(Files.isRegularFile(temporary.resolve("output/orders-api/SKILL.md")));
        assertTrue(log.infos.stream().anyMatch(message -> message.contains("SUCCESS")));
    }

    private GenerateSkillMojo mojo(RecordingLog log, List<DocumentSource> documents) {
        var mojo = new GenerateSkillMojo();
        mojo.setLog(log);
        mojo.serviceId = "orders";
        mojo.skillName = "orders-api";
        mojo.outputDirectory = temporary.resolve("output").toFile();
        mojo.timeoutSeconds = 2;
        mojo.documents = documents;
        return mojo;
    }

    @SuppressWarnings("deprecation")
    private MavenSession session(Instant startedAt) {
        var request = new DefaultMavenExecutionRequest();
        request.setStartTime(Date.from(startedAt));
        return new MavenSession(null, null, request, new DefaultMavenExecutionResult());
    }

    private DocumentSource source(String id, Path path) {
        var source = new DocumentSource();
        source.setId(id);
        source.setPath(path.toFile());
        return source;
    }

    private Path write(String name, String content) throws Exception {
        Path path = temporary.resolve(name);
        Files.writeString(path, content);
        return path;
    }

    private String document(String path, String operationId) {
        return """
                {"openapi":"3.1.0","info":{"title":"Test","version":"1"},
                 "paths":{"%s":{"get":{"operationId":"%s","responses":{"200":{"description":"ok"}}}}}}
                """.formatted(path, operationId);
    }

    private TreeMap<String, String> tree(Path root) throws Exception {
        var result = new TreeMap<String, String>();
        try (var paths = Files.walk(root)) {
            paths.filter(Files::isRegularFile).forEach(path -> {
                try { result.put(root.relativize(path).toString().replace('\\', '/'), Files.readString(path)); }
                catch (Exception error) { throw new AssertionError(error); }
            });
        }
        return result;
    }

    private static final class RecordingLog implements Log {
        private final List<String> infos = new ArrayList<>();
        private final List<String> warnings = new ArrayList<>();

        @Override public boolean isDebugEnabled() { return false; }
        @Override public void debug(CharSequence content) {}
        @Override public void debug(CharSequence content, Throwable error) {}
        @Override public void debug(Throwable error) {}
        @Override public boolean isInfoEnabled() { return true; }
        @Override public void info(CharSequence content) { infos.add(content.toString()); }
        @Override public void info(CharSequence content, Throwable error) { info(content); }
        @Override public void info(Throwable error) { infos.add(error.toString()); }
        @Override public boolean isWarnEnabled() { return true; }
        @Override public void warn(CharSequence content) { warnings.add(content.toString()); }
        @Override public void warn(CharSequence content, Throwable error) { warn(content); }
        @Override public void warn(Throwable error) { warnings.add(error.toString()); }
        @Override public boolean isErrorEnabled() { return true; }
        @Override public void error(CharSequence content) { warnings.add(content.toString()); }
        @Override public void error(CharSequence content, Throwable error) { error(content); }
        @Override public void error(Throwable error) { warnings.add(error.toString()); }
    }
}
