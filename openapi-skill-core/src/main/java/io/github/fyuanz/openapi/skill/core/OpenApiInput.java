package io.github.fyuanz.openapi.skill.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.core.JsonParser;
import java.io.IOException;
import java.util.regex.Pattern;

/** OpenAPI 3.0.x and 3.1.x JSON input boundary; not a full specification validator. */
public final class OpenApiInput {
    /** Accepted dialects: every declared 3.0.x and 3.1.x patch, and nothing else. */
    private static final Pattern SUPPORTED_VERSION = Pattern.compile("3\\.[01]\\.\\d+");
    private final ObjectMapper mapper = new ObjectMapper()
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);

    public JsonNode parse(byte[] bytes) {
        if (bytes == null) throw new IllegalArgumentException("INVALID_JSON: input is null");
        final JsonNode root;
        try {
            root = mapper.readTree(bytes);
        } catch (IOException e) {
            throw new IllegalArgumentException("INVALID_JSON: expected a single JSON object", e);
        }
        if (root == null || !root.isObject())
            throw new IllegalArgumentException("INVALID_JSON: expected a single JSON object");
        JsonNode version = root.get("openapi");
        if (version == null || version.isNull())
            throw new IllegalArgumentException("MISSING_VERSION: root openapi is required");
        if (!version.isTextual() || !SUPPORTED_VERSION.matcher(version.textValue()).matches())
            throw new IllegalArgumentException("UNSUPPORTED_VERSION: expected OpenAPI 3.0.x or 3.1.x");
        return root;
    }
}
