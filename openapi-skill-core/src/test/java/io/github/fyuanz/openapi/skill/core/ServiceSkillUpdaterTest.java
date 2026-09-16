package io.github.fyuanz.openapi.skill.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import static org.junit.jupiter.api.Assertions.*;

class ServiceSkillUpdaterTest {
    @TempDir Path temporary;
    private final ServiceSkillUpdater updater = new ServiceSkillUpdater();
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void replacesTheCompleteOwnedSkillAndRemovesStaleFilesOnly() throws Exception {
        Path output = temporary.resolve("skills");
        Files.createDirectories(output);
        Files.writeString(output.resolve("manual.txt"), "keep me");
        Map<String, String> first = with(skill("orders", "orders-api", "old"),
                "references/obsolete.md", "old file");

        var initial = updater.update("orders", "orders-api", output, Duration.ofSeconds(2), () -> first);
        var replacement = updater.update("orders", "orders-api", output, Duration.ofSeconds(2),
                () -> skill("orders", "orders-api", "new"));

        assertEquals(ServiceSkillUpdater.Outcome.SUCCESS, initial.outcome());
        assertEquals(ServiceSkillUpdater.Outcome.SUCCESS, replacement.outcome());
        assertFalse(Files.exists(output.resolve("orders-api/references/obsolete.md")));
        assertEquals("keep me", Files.readString(output.resolve("manual.txt")));
        assertTrue(Files.readString(operation(output.resolve("orders-api"))).contains("new"));
        assertEquals("SUCCESS", mapper.readTree(Files.readString(replacement.statusFile())).path("outcome").asText());
        assertFalse(replacement.statusFile().startsWith(replacement.skillDirectory()));
        assertNoAttemptDirectories(output);
    }

    @Test
    void generationFailureRetainsThePreviousTreeAndWritesExternalStatus() throws Exception {
        Path output = temporary.resolve("skills");
        assertEquals(ServiceSkillUpdater.Outcome.SUCCESS,
                updater.update("orders", "orders-api", output, Duration.ofSeconds(2),
                        () -> skill("orders", "orders-api", "old")).outcome());
        Map<String, String> before = tree(output.resolve("orders-api"));

        var result = updater.update("orders", "orders-api", output, Duration.ofSeconds(2), () -> {
            throw new IllegalArgumentException("business: INVALID_JSON: broken input");
        });

        assertEquals(ServiceSkillUpdater.Outcome.FAILED, result.outcome());
        assertTrue(result.skillAvailable());
        assertTrue(result.previousRetained());
        assertTrue(result.message().contains("business"));
        assertEquals(before, tree(output.resolve("orders-api")));
        var status = mapper.readTree(Files.readString(result.statusFile()));
        assertEquals(1, status.path("statusVersion").asInt());
        assertEquals("orders", status.path("serviceId").asText());
        assertEquals("orders-api", status.path("skillName").asText());
        assertEquals("FAILED", status.path("outcome").asText());
        assertTrue(status.path("skillAvailable").asBoolean());
        assertTrue(status.path("previousRetained").asBoolean());
        assertFalse(status.path("attemptedAt").asText().isBlank());
        assertNoAttemptDirectories(output);
    }

    @Test
    void firstRunFailureReportsThatNoValidSkillExists() {
        Path output = temporary.resolve("skills");

        var result = updater.update("orders", "orders-api", output, Duration.ofSeconds(2), () -> {
            throw new IllegalStateException("generation failed");
        });

        assertEquals(ServiceSkillUpdater.Outcome.FAILED, result.outcome());
        assertFalse(result.skillAvailable());
        assertFalse(result.previousRetained());
        assertFalse(Files.exists(output.resolve("orders-api")));
    }

    @Test
    void invalidGeneratedTreeNeverReplacesThePreviousSkill() throws Exception {
        Path output = temporary.resolve("skills");
        updater.update("orders", "orders-api", output, Duration.ofSeconds(2),
                () -> skill("orders", "orders-api", "old"));
        Map<String, String> before = tree(output.resolve("orders-api"));

        for (Map<String, String> invalid : List.of(
                Map.of("SKILL.md", "---\nname: orders-api\n---\n"),
                with(skill("orders", "orders-api", "new"), "../escape.txt", "escape"),
                with(skill("orders", "orders-api", "new"), "References/catalog.md", "collision"),
                with(skill("orders", "orders-api", "new"), "references/broken.md", "[missing](absent.md)")
        )) {
            var result = updater.update("orders", "orders-api", output, Duration.ofSeconds(2), () -> invalid);
            assertEquals(ServiceSkillUpdater.Outcome.FAILED, result.outcome());
            assertTrue(result.previousRetained());
            assertEquals(before, tree(output.resolve("orders-api")));
        }
    }

    @Test
    void explicitDocumentAndOperationRemovalLeavesNoStaleFiles() throws Exception {
        Path output = temporary.resolve("skills");
        Map<String, byte[]> initialDocuments = Map.of(
                "account", document("/users", "listUsers", "old users"),
                "business", document("/orders", "listOrders", "old orders"));
        Map<String, byte[]> replacementDocuments = Map.of(
                "account", document("/profiles", "listProfiles", "new profiles"));

        assertEquals(ServiceSkillUpdater.Outcome.SUCCESS,
                updater.update("orders", "orders-api", output, Duration.ofSeconds(2),
                        () -> new SkillGenerator().generate("orders", "orders-api", initialDocuments)).outcome());
        assertTrue(Files.isDirectory(output.resolve("orders-api/references/documents/business")));
        assertTrue(tree(output.resolve("orders-api")).values().stream().anyMatch(value -> value.contains("/users")));

        var result = updater.update("orders", "orders-api", output, Duration.ofSeconds(2),
                () -> new SkillGenerator().generate("orders", "orders-api", replacementDocuments));

        Map<String, String> after = tree(output.resolve("orders-api"));
        assertEquals(ServiceSkillUpdater.Outcome.SUCCESS, result.outcome());
        assertFalse(Files.exists(output.resolve("orders-api/references/documents/business")));
        assertTrue(after.values().stream().anyMatch(value -> value.contains("/profiles")));
        assertFalse(after.values().stream().anyMatch(value -> value.contains("/users") || value.contains("/orders")));
    }

    @Test
    void oneMissingRequiredDocumentRejectsTheWholeUpdate() throws Exception {
        Path output = temporary.resolve("skills");
        Map<String, byte[]> complete = Map.of(
                "account", document("/users", "listUsers", "old users"),
                "business", document("/orders", "listOrders", "old orders"));
        updater.update("orders", "orders-api", output, Duration.ofSeconds(2),
                () -> new SkillGenerator().generate("orders", "orders-api", complete));
        Map<String, String> before = tree(output.resolve("orders-api"));
        var incomplete = new TreeMap<String, byte[]>();
        incomplete.put("account", document("/users", "listUsers", "new users"));
        incomplete.put("business", null);

        var result = updater.update("orders", "orders-api", output, Duration.ofSeconds(2),
                () -> new SkillGenerator().generate("orders", "orders-api", incomplete));

        assertEquals(ServiceSkillUpdater.Outcome.FAILED, result.outcome());
        assertTrue(result.previousRetained());
        assertTrue(result.message().contains("business"));
        assertEquals(before, tree(output.resolve("orders-api")));
    }

    @Test
    void existingManualDirectoryIsNeverClaimedOrModified() throws Exception {
        Path output = temporary.resolve("skills");
        Path manual = output.resolve("orders-api");
        Files.createDirectories(manual);
        Files.writeString(manual.resolve("README.md"), "owned by a person");
        var invoked = new java.util.concurrent.atomic.AtomicBoolean();

        var result = updater.update("orders", "orders-api", output, Duration.ofSeconds(2), () -> {
            invoked.set(true);
            return skill("orders", "orders-api", "new");
        });

        assertEquals(ServiceSkillUpdater.Outcome.FAILED, result.outcome());
        assertFalse(invoked.get());
        assertEquals(Map.of("README.md", "owned by a person"), tree(manual));
    }

    static Map<String, String> skill(String serviceId, String skillName, String marker) {
        byte[] document = document("/items", "listItems", marker);
        return new SkillGenerator().generate(serviceId, skillName,
                Map.of("public", document));
    }

    static byte[] document(String path, String operationId, String marker) {
        String document = """
                {"openapi":"3.1.0","info":{"title":"Test","version":"1"},
                 "paths":{"%s":{"get":{"operationId":"%s","description":"%s","responses":{"200":{"description":"ok"}}}}}}
                """.formatted(path, operationId, marker);
        return document.getBytes(StandardCharsets.UTF_8);
    }

    static Map<String, String> with(Map<String, String> source, String path, String content) {
        var copy = new TreeMap<>(source);
        copy.put(path, content);
        return copy;
    }

    static Map<String, String> tree(Path root) throws Exception {
        var result = new TreeMap<String, String>();
        try (var paths = Files.walk(root)) {
            paths.filter(Files::isRegularFile).forEach(path -> {
                try { result.put(root.relativize(path).toString().replace('\\', '/'), Files.readString(path)); }
                catch (Exception error) { throw new AssertionError(error); }
            });
        }
        return result;
    }

    static Path operation(Path skill) throws Exception {
        try (var paths = Files.walk(skill.resolve("references/documents"))) {
            return paths.filter(path -> path.toString().contains("operations"))
                    .filter(Files::isRegularFile).findFirst().orElseThrow();
        }
    }

    private void assertNoAttemptDirectories(Path output) throws Exception {
        for (String name : new String[]{"staging", "backups"}) {
            Path directory = output.resolve(".openapi-skill").resolve(name);
            if (!Files.isDirectory(directory)) continue;
            try (var entries = Files.list(directory)) { assertEquals(0, entries.count(), name); }
        }
    }
}
