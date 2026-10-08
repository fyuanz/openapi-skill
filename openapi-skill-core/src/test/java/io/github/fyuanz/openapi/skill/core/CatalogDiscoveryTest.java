package io.github.fyuanz.openapi.skill.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class CatalogDiscoveryTest {
    @TempDir Path temporary;
    private static byte[] fixture() throws Exception {
        try (var input = CatalogDiscoveryTest.class.getResourceAsStream("/catalog-discovery.json")) {
            return Objects.requireNonNull(input).readAllBytes();
        }
    }
    private Map<String, String> service(String id) throws Exception {
        return new SkillGenerator().generate(id, id + "-api", Map.of("business", fixture(), "empty",
                "{\"openapi\":\"3.1.0\",\"paths\":{}}".getBytes(StandardCharsets.UTF_8)));
    }
    private void check(String catalog) {
        for (String text : List.of("上传文件", "uploadFile", "POST /files", "DELETE /files/{id}", "GET /health",
                "附件", "untagged", "文件管理", "No operations are documented."))
            assertTrue(catalog.contains(text), "missing " + text);
        assertFalse(catalog.contains("[run](outside.md)"));
        assertFalse(catalog.contains("<script>"));
        String unsafe = catalog.lines().filter(l -> l.contains("GET /unsafe")).findFirst().orElseThrow();
        assertTrue(unsafe.contains("operationId=duplicate"));
        assertFalse(catalog.contains("```json"));
    }
    @Test void exposesActionsInFlatIndexAndKeepsContractsSeparate() throws Exception {
        var single = service("files");
        check(single.get("references/index.md"));
        var aggregate = new AggregateSkillGenerator().generate("platform", "platform-api",
                Map.of("files", single, "other", service("other")));
        check(aggregate.get("references/index.md"));
        assertEquals(2, aggregate.get("references/index.md").split("POST /files", -1).length - 1);
        for (String id : List.of("files", "other")) {
            assertTrue(aggregate.get("references/index.md").contains("service=" + id));
            assertTrue(aggregate.get("references/operations/" + id + "--business--post-files.md").contains("https://files.example"));
        }
        new GeneratedSkillValidator().validate(aggregate, "platform", "platform-api");
    }
    @Test void followsIndexDirectlyWithoutTrustingSourceInstructions() throws Exception {
        var files = new AggregateSkillGenerator().generate("platform", "platform-api", Map.of("files", service("files")));
        String skill = files.get("SKILL.md");
        assertTrue(skill.contains("multiple candidates"));
        assertTrue(skill.contains("broaden keywords and service/document scope"));
        assertFalse(skill.contains("IGNORE_INSTRUCTIONS"));
        assertTrue(files.get("references/index.md").contains("](operations/files--business--post-files.md)"));
        assertTrue(files.get("references/operations/files--business--post-files.md").contains("uploadFile"));
    }
    @Test void projectsOldMembersAndPreservesEffectiveFacts() throws Exception {
        var old = new SkillGenerator().generateServiceTree("files", "files-api", Map.of("business", fixture(), "empty",
                "{\"openapi\":\"3.1.0\",\"paths\":{}}".getBytes(StandardCharsets.UTF_8)));
        var generator = new AggregateSkillGenerator();
        var migrated = generator.generate("platform", "platform-api", Map.of("files", old));
        var current = generator.generate("platform", "platform-api", Map.of("files", service("files")));
        assertEquals(current, migrated);
        check(migrated.get("references/index.md"));
        assertTrue(migrated.get("references/operations/files--business--post-files.md").contains("https://files.example"));
    }
    @Test void keepsDuplicateActionsInSeparateDocumentsAndSortsInputs() throws Exception {
        var root = new ObjectMapper().readTree(fixture());
        var reversed = new ObjectMapper().createObjectNode();
        var names = new ArrayList<String>();
        root.path("paths").fieldNames().forEachRemaining(names::add);
        Collections.reverse(names);
        names.forEach(n -> reversed.set(n, root.path("paths").get(n)));
        ((com.fasterxml.jackson.databind.node.ObjectNode)root).set("paths", reversed);
        var first = new SkillGenerator().generate("files", "files-api", Map.of("a", fixture(), "b", root.toString().getBytes(StandardCharsets.UTF_8)));
        var second = new SkillGenerator().generate("files", "files-api", Map.of("b", fixture(), "a", fixture()));
        assertEquals(first.get("references/index.md"), second.get("references/index.md"));
        assertEquals(2, first.get("references/index.md").split("POST /files", -1).length - 1);
    }
    @Test void expandedCatalogBudgetFailureRetainsPreviousPublishedTree() throws Exception {
        var updater = new ServiceSkillUpdater();
        var generator = new AggregateSkillGenerator();
        var previous = generator.generate("platform", "platform-api", Map.of("files", service("files")));
        assertEquals(ServiceSkillUpdater.Outcome.SUCCESS, updater.update("platform", "platform-api", temporary,
                Duration.ofSeconds(30), () -> previous).outcome());
        var root = new ObjectMapper().createObjectNode().put("openapi", "3.1.0");
        root.putObject("paths").putObject("/large").putObject("get").put("summary", "x".repeat(5 * 1024 * 1024)).putObject("responses");
        byte[] bytes = root.toString().getBytes(StandardCharsets.UTF_8);
        var members = new TreeMap<String, Map<String, String>>();
        for (int i = 0; i < 5; i++) members.put("svc-" + i, new SkillGenerator().generate("svc-" + i, "svc-" + i + "-api", Map.of("public", bytes)));
        var result = updater.update("platform", "platform-api", temporary, Duration.ofSeconds(60),
                () -> generator.generate("platform", "platform-api", members));
        assertEquals(ServiceSkillUpdater.Outcome.FAILED, result.outcome());
        assertTrue(result.message().contains("LIMIT") || result.message().contains("64 MiB"), result.message());
        for (var entry : previous.entrySet())
            assertEquals(entry.getValue(), Files.readString(temporary.resolve("platform-api").resolve(entry.getKey())));
    }

    @Test void supportsLegacyIndexRowsWithoutGroupColumns() throws Exception {
        var old = new TreeMap<>(new SkillGenerator().generateServiceTree("files", "files-api", Map.of("business", fixture(), "empty", "{\"openapi\":\"3.1.0\",\"paths\":{}}".getBytes(StandardCharsets.UTF_8))));
        var mapper = new ObjectMapper();
        var source = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(old.get("references/source.json"));
        source.put("generatorVersion", "openapi-skill-core/2");
        old.put("references/source.json", source.toString());
        var rows = new StringBuilder();
        for (String line : old.get("references/operations.jsonl").split("\n")) {
            var row = (com.fasterxml.jackson.databind.node.ObjectNode)mapper.readTree(line);
            row.remove(List.of("group", "groupFile"));
            rows.append(row).append('\n');
        }
        old.put("references/operations.jsonl", rows.toString());
        old.put("references/catalog.md", "# Legacy files\n\n[Business](documents/business/context.md)\n");
        var files = new AggregateSkillGenerator().generate("platform", "platform-api", Map.of("files", old));
        check(files.get("references/index.md"));
    }

    @Test void exportsVerifiedSharedFixtureAndLargeCatalogForCrossImplementationCheck() throws Exception {
        var generator = new AggregateSkillGenerator();
        var files = generator.generate("platform", "platform-api", Map.of("files", service("files"), "other", service("other")));
        var root = new ObjectMapper().createObjectNode().put("openapi", "3.1.0");
        var paths = root.putObject("paths");
        for (int i = 0; i < 124; i++) {
            var operation = paths.putObject("/items/" + i).putObject("get").put("summary", "动作" + i);
            operation.putArray("tags").add("分组" + i % 19);
            operation.putObject("responses");
        }
        var service = new SkillGenerator().generate("files", "files-api", Map.of("business", root.toString().getBytes(StandardCharsets.UTF_8)));
        var large = generator.generate("platform", "platform-api", Map.of("files", service));
        for (String path : List.of("references/index.md")) {
            String catalog = large.get(path);
            assertEquals(124, catalog.split("GET /items/", -1).length - 1);
            System.out.println(path + ": " + catalog.getBytes(StandardCharsets.UTF_8).length + " bytes, 124 operations");
        }
        new GeneratedSkillValidator().validate(large, "platform", "platform-api");
        for (var example : Map.of("shared", files, "large", large).entrySet()) {
            Path output = Path.of("target", "catalog-discovery", example.getKey());
            for (var entry : example.getValue().entrySet()) {
                Path target = output.resolve(entry.getKey());
                Files.createDirectories(target.getParent());
                Files.writeString(target, entry.getValue());
            }
        }
    }
}
