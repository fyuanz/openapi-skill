package io.github.fyuanz.openapi.skill.core;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.nio.charset.StandardCharsets;
import static org.junit.jupiter.api.Assertions.*;

class OpenApiInputTest {
    private final OpenApiInput input = new OpenApiInput();

    @Test void acceptsExactVersion() throws Exception {
        try (var stream = getClass().getResourceAsStream("/minimal.json")) {
            assertNotNull(stream);
            assertEquals("Example", input.parse(stream.readAllBytes()).path("info").path("title").asText());
        }
    }

    @ParameterizedTest @ValueSource(strings = {"\"3.0.0\"", "\"3.0.3\"", "\"3.1.0\"", "\"3.1.1\""})
    void acceptsDeclaredVersions(String version) {
        var json = ("{\"openapi\":" + version + ",\"info\":{\"title\":\"Example\"}}").getBytes(StandardCharsets.UTF_8);
        assertEquals("Example", input.parse(json).path("info").path("title").asText());
    }

    @ParameterizedTest @ValueSource(strings = {"{}", "{\"openapi\":null}"})
    void reportsMissingVersion(String json) { rejects(json, "MISSING_VERSION"); }

    @ParameterizedTest @ValueSource(strings = {"\"3.2.0\"", "\"3.2.1\"", "\"2.0\"", "\"4.0.0\"", "\"3.1\"", "\" 3.1.0\"", "3.1", "true", "[]", "\"\""})
    void reportsUnsupportedVersion(String version) { rejects("{\"openapi\":" + version + "}", "UNSUPPORTED_VERSION"); }

    @ParameterizedTest @ValueSource(strings = {"", "{", "null", "[]", "true", "{\"openapi\":\"3.1.0\"} {}", "{\"openapi\":\"3.1.0\",\"openapi\":\"3.0.0\"}", "{\"openapi\":\"3.1.0\",}"})
    void reportsInvalidJson(String json) { rejects(json, "INVALID_JSON"); }

    private void rejects(String json, String code) {
        var error = assertThrows(IllegalArgumentException.class,
                () -> input.parse(json.getBytes(StandardCharsets.UTF_8)));
        assertTrue(error.getMessage().startsWith(code + ":"), error.getMessage());
    }
}
