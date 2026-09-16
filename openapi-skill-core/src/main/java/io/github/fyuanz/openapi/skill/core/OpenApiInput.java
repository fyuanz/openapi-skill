package io.github.fyuanz.openapi.skill.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.core.JsonParser;
import java.io.IOException;

/** Exact OpenAPI 3.1.0 JSON input boundary; not a full specification validator. */
public final class OpenApiInput {
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
        if (!version.isTextual() || !"3.1.0".equals(version.textValue()))
            throw new IllegalArgumentException("UNSUPPORTED_VERSION: expected exact OpenAPI 3.1.0");
        return root;
    }
}
