package com.smartdoc.agent.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.TreeMap;

import static org.junit.jupiter.api.Assertions.*;

class AggregateSkillGeneratorTest {
    @TempDir Path temporary;
    private final AggregateSkillGenerator generator = new AggregateSkillGenerator();

    @Test void keepsCollidingContractsSeparateAndPublishesASelfContainedSkill() throws Exception {
        var orders = service("orders", "string");
        var billing = service("billing", "integer");
        var inputs = Map.of("orders", orders, "billing", billing);
        var files = generator.generate("platform", "platform-api", inputs);
        new GeneratedSkillValidator().validate(files, "platform", "platform-api");
        assertEquals(1, files.keySet().stream().filter(p -> p.endsWith("SKILL.md")).count());
        for (var service : inputs.entrySet()) {
            for (var file : service.getValue().entrySet()) {
                if (file.getKey().startsWith("references/"))
                    assertEquals(file.getValue(), files.get("references/services/" + service.getKey() + "/" + file.getKey()));
            }
        }
        assertTrue(files.get("references/catalog.md").contains("services/billing/references/catalog.md"));
        assertFalse(files.get("SKILL.md").contains("UNTRUSTED DESCRIPTION"));
        var metadata = new ObjectMapper().readTree(files.get("references/source.json"));
        assertEquals("aggregate", metadata.path("kind").asText());
        assertEquals(2, metadata.path("services").size());
        assertEquals(2, metadata.path("documents").size());
        assertEquals("billing", metadata.path("documents").get(0).path("serviceId").asText());
        assertEquals("common", metadata.path("documents").get(1).path("documentId").asText());
        var reordered = new TreeMap<>(inputs);
        assertEquals(files, generator.generate("platform", "platform-api", reordered));
        assertThrows(UnsupportedOperationException.class, () -> files.put("x", "x"));
        var result = new ServiceSkillUpdater().update("platform", "platform-api", temporary,
                Duration.ofSeconds(2), () -> files);
        assertEquals(ServiceSkillUpdater.Outcome.SUCCESS, result.outcome(), result.message());
    }

    @Test void rejectsMissingForeignAndInvalidServiceTrees() {
        assertThrows(IllegalArgumentException.class, () -> generator.generate("platform", "platform-api", Map.of()));
        assertThrows(IllegalArgumentException.class, () -> generator.generate("../bad", "platform-api", Map.of("orders", service("orders", "string"))));
        assertThrows(IllegalArgumentException.class, () -> generator.generate("platform", "platform-api", Map.of("billing", service("orders", "string"))));
        var broken = new TreeMap<>(service("orders", "string"));
        broken.remove("references/catalog.md");
        assertThrows(IllegalArgumentException.class, () -> generator.generate("platform", "platform-api", Map.of("orders", broken)));
    }

    @Test void boundsTheNumberOfServices() {
        var services = new TreeMap<String, Map<String, String>>();
        for (int i = 0; i < 33; i++) services.put("service-" + i, service("service-" + i, "string"));
        assertThrows(IllegalArgumentException.class, () -> generator.generate("platform", "platform-api", services));
    }

    @Test void rejectsCombinedOutputThatExceedsTheSharedFileBudget() {
        var root = new ObjectMapper().createObjectNode().put("openapi", "3.1.0");
        root.putObject("paths");
        var schemas = root.putObject("components").putObject("schemas");
        for (int i = 0; i < 5000; i++) schemas.putObject("Item" + i).put("type", "string");
        var documents = Map.of("common", root.toString().getBytes(StandardCharsets.UTF_8));
        var first = new SkillGenerator().generate("orders", "orders-api", documents);
        var second = new SkillGenerator().generate("billing", "billing-api", documents);
        var error = assertThrows(IllegalArgumentException.class,
                () -> generator.generate("platform", "platform-api", Map.of("orders", first, "billing", second)));
        assertTrue(error.getMessage().contains("LIMIT"));
    }

    @Test void removalReplacesTheAggregateWithoutTouchingStandaloneSkills() throws Exception {
        var updater = new ServiceSkillUpdater();
        var orders = service("orders", "string");
        assertEquals(ServiceSkillUpdater.Outcome.SUCCESS, updater.update("orders", "orders-api", temporary,
                Duration.ofSeconds(2), () -> orders).outcome());
        assertEquals(ServiceSkillUpdater.Outcome.SUCCESS, updater.update("platform", "platform-api", temporary,
                Duration.ofSeconds(2), () -> generator.generate("platform", "platform-api",
                        Map.of("orders", orders, "billing", service("billing", "integer")))).outcome());
        assertEquals(ServiceSkillUpdater.Outcome.SUCCESS, updater.update("platform", "platform-api", temporary,
                Duration.ofSeconds(2), () -> generator.generate("platform", "platform-api", Map.of("orders", orders))).outcome());
        assertFalse(Files.exists(temporary.resolve("platform-api/references/services/billing")));
        assertEquals(orders.get("SKILL.md"), Files.readString(temporary.resolve("orders-api/SKILL.md")));
    }

    private Map<String, String> service(String id, String type) {
        String json = """
                {"openapi":"3.1.0","info":{"title":"UNTRUSTED DESCRIPTION","version":"1"},
                 "servers":[{"url":"https://%s.example"}],
                 "paths":{"/users":{"get":{"responses":{"200":{"description":"ok","content":{
                 "application/json":{"schema":{"$ref":"#/components/schemas/User"}}}}}}}},
                 "components":{"schemas":{"User":{"type":"object","properties":{"id":{"type":"%s"},
                 "next":{"$ref":"#/components/schemas/User"}}}}}}
                """.formatted(id, type);
        return new SkillGenerator().generate(id, id + "-api", Map.of("common", json.getBytes(StandardCharsets.UTF_8)));
    }
}
