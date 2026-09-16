package io.github.fyuanz.openapi.skill.core;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Checks the complete in-memory Skill tree before it may be published. */
final class GeneratedSkillValidator {
    private static final int MAX_FILES = 10_000;
    private static final long MAX_BYTES = 64L * 1024 * 1024;
    private static final Pattern LINK = Pattern.compile("\\]\\(([^)]+)\\)");
    private final ObjectMapper mapper = new ObjectMapper()
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);

    void validate(Map<String, String> files, String serviceId, String skillName) {
        if (files == null || files.isEmpty()) throw invalid("generated file set is empty");
        if (files.size() > MAX_FILES) throw invalid("generated file count exceeds " + MAX_FILES);
        var normalized = new HashSet<String>();
        var caseInsensitive = new HashSet<String>();
        long bytes = 0;
        for (var entry : files.entrySet()) {
            String path = validatePath(entry.getKey());
            if (!normalized.add(path)) throw invalid("duplicate path " + path);
            if (!caseInsensitive.add(path.toLowerCase(Locale.ROOT)))
                throw invalid("case-insensitive path collision at " + path);
            if (entry.getValue() == null) throw invalid("null content at " + path);
            bytes += entry.getValue().getBytes(StandardCharsets.UTF_8).length;
            if (bytes > MAX_BYTES) throw invalid("generated content exceeds 64 MiB");
        }
        for (String path : normalized) {
            Path parent = Path.of(path).getParent();
            while (parent != null) {
                if (normalized.contains(parent.toString().replace('\\', '/')))
                    throw invalid("file and directory path conflict at " + path);
                parent = parent.getParent();
            }
        }
        validateEntrypoint(files.get("SKILL.md"), skillName);
        JsonNode source = validateSource(files.get("references/source.json"), serviceId, skillName);
        if ("openapi-skill-core/1".equals(source.path("generatorVersion").asText()) && !source.has("kind"))
            validateIndexes(files, source);
        validateLinks(files, normalized);
    }

    private String validatePath(String value) {
        if (value == null || value.isBlank() || value.contains("\\") || !value.matches("[A-Za-z0-9._/-]+"))
            throw invalid("unsafe generated path " + value);
        final Path path;
        try { path = Path.of(value); }
        catch (InvalidPathException error) { throw invalid("invalid generated path " + value); }
        Path normalized = path.normalize();
        String normalizedText = normalized.toString().replace('\\', '/');
        if (path.isAbsolute() || path.getRoot() != null || normalizedText.startsWith("../")
                || normalizedText.equals("..") || !normalizedText.equals(value))
            throw invalid("generated path escapes or is not normalized: " + value);
        return normalizedText;
    }

    private void validateEntrypoint(String content, String skillName) {
        if (content == null) throw invalid("SKILL.md is missing");
        String prefix = "---\nname: " + skillName + "\ndescription: ";
        if (!content.startsWith(prefix)) throw invalid("SKILL.md frontmatter does not match the configured Skill");
        int close = content.indexOf("\n---\n", prefix.length());
        if (close < 0) throw invalid("SKILL.md frontmatter is not closed");
        String description = content.substring(prefix.length(), close);
        if (description.isBlank() || description.length() > 1024)
            throw invalid("SKILL.md description is missing or too long");
    }

    private JsonNode validateSource(String content, String serviceId, String skillName) {
        if (content == null) throw invalid("references/source.json is missing");
        final JsonNode source;
        try { source = mapper.readTree(content); }
        catch (Exception error) { throw invalid("references/source.json is invalid JSON"); }
        if (!source.isObject()) throw invalid("references/source.json must be an object");
        String owner = source.path("serviceId").asText();
        if (!serviceId.equals(owner))
            throw invalid("output is owned by service " + (owner.isBlank() ? "<unknown>" : owner));
        if (!skillName.equals(source.path("skillName").asText()))
            throw invalid("source metadata Skill name does not match " + skillName);
        if (!source.path("generatorVersion").isTextual() || source.path("generatorVersion").asText().isBlank())
            throw invalid("source metadata generatorVersion is missing");
        if (!source.path("documents").isArray() || source.path("documents").isEmpty())
            throw invalid("source metadata documents are missing");
        return source;
    }

    private void validateIndexes(Map<String, String> files, JsonNode source) {
        if (!files.containsKey("references/conventions.md")) throw invalid("references/conventions.md is missing");
        int operations = 0;
        int schemas = 0;
        for (JsonNode document : source.path("documents")) {
            operations += document.path("operations").asInt();
            schemas += document.path("schemas").asInt();
        }
        validateIndex(files, "references/operations.jsonl", "operation:", operations);
        validateIndex(files, "references/schemas.jsonl", "schema:", schemas);
    }

    private void validateIndex(Map<String, String> files, String path, String prefix, int expectedCount) {
        String content = files.get(path);
        if (content == null) throw invalid(path + " is missing");
        var ids = new HashSet<String>();
        String previous = null;
        int count = 0;
        for (String line : content.split("\\R", -1)) {
            if (line.isBlank()) continue;
            final JsonNode row;
            try { row = mapper.readTree(line); }
            catch (Exception error) { throw invalid(path + " contains invalid JSONL"); }
            if (!row.isObject()) throw invalid(path + " row must be an object");
            String id = row.path("id").asText();
            String file = row.path("file").asText();
            if (!id.startsWith(prefix) || !ids.add(id)) throw invalid(path + " contains an invalid or duplicate id");
            if (previous != null && previous.compareTo(id) >= 0) throw invalid(path + " is not sorted by id");
            if (file.isBlank() || !files.containsKey("references/" + file))
                throw invalid(path + " points to a missing contract file");
            previous = id;
            count++;
        }
        if (count != expectedCount) throw invalid(path + " count does not match source metadata");
    }

    private void validateLinks(Map<String, String> files, Set<String> paths) {
        files.forEach((source, content) -> {
            if (!source.endsWith(".md")) return;
            boolean fenced = false;
            for (String line : content.split("\\R", -1)) {
                if (line.stripLeading().startsWith("```")) {
                    fenced = !fenced;
                    continue;
                }
                if (fenced) continue;
                var matcher = LINK.matcher(line);
                while (matcher.find()) {
                    String target = matcher.group(1);
                    if (target.isBlank() || target.contains("\\") || target.contains(":") || target.startsWith("/"))
                        throw invalid("unsafe link in " + source + ": " + target);
                    Path parent = Path.of(source).getParent();
                    String resolved = (parent == null ? Path.of(target) : parent.resolve(target))
                            .normalize().toString().replace('\\', '/');
                    if (resolved.startsWith("../") || !paths.contains(resolved))
                        throw invalid("unresolved link in " + source + ": " + target);
                }
            }
            if (fenced) throw invalid("unclosed code fence in " + source);
        });
    }

    private IllegalArgumentException invalid(String message) {
        return new IllegalArgumentException("OUTPUT: " + message);
    }
}
