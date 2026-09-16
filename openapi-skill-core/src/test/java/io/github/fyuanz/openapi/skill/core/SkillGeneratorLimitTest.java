package io.github.fyuanz.openapi.skill.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SkillGeneratorLimitTest {
    private final SkillGenerator generator = new SkillGenerator();
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void rejectsMoreThanThirtyTwoDocuments() {
        var documents = new LinkedHashMap<String, byte[]>();
        byte[] empty = bytes("{\"openapi\":\"3.1.0\",\"paths\":{}}");
        for (int i = 0; i < 33; i++) documents.put("doc-" + i, empty);

        var error = assertThrows(IllegalArgumentException.class,
                () -> generator.generate("service", "service-api", documents));
        assertTrue(error.getMessage().contains("LIMIT"));
    }

    @Test
    void rejectsNestingBeyondTheTraversalBound() throws Exception {
        var root = mapper.createObjectNode().put("openapi", "3.1.0");
        root.putObject("paths");
        var value = root.putObject("components").putObject("schemas").putObject("Deep");
        for (int i = 0; i < 130; i++) value = value.putObject("items");

        var error = assertThrows(IllegalArgumentException.class,
                () -> generator.generate("service", "service-api", Map.of("public", mapper.writeValueAsBytes(root))));
        assertTrue(error.getMessage().contains("nesting"), error.getMessage());
    }

    @Test
    void rejectsACompleteResultThatWouldExceedTheFileBound() throws Exception {
        var root = mapper.createObjectNode().put("openapi", "3.1.0");
        root.putObject("paths");
        var schemas = root.putObject("components").putObject("schemas");
        for (int i = 0; i < 5000; i++) schemas.putObject("Schema" + i).put("type", "string");
        byte[] document = mapper.writeValueAsBytes(root);

        var error = assertThrows(IllegalArgumentException.class,
                () -> generator.generate("service", "service-api", Map.of("first", document, "second", document)));
        assertTrue(error.getMessage().contains("output"), error.getMessage());
    }

    private byte[] bytes(String source) {
        return source.getBytes(StandardCharsets.UTF_8);
    }
}
