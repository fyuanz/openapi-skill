package io.github.fyuanz.openapi.skill.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.*;

/** Document-local graph: retain edges instead of expanding recursive schemas. */
final class DocumentReferences {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> DATA = Set.of("example", "default", "enum", "const");
    private final JsonNode root;
    private final String base;
    private final Map<String, String> targets = new TreeMap<>();
    private final Map<String, String> schemaNames = new TreeMap<>();
    private final Set<String> exampleOnlyTargets = new HashSet<>();
    private final Set<String> regularTargets = new HashSet<>();

    record ReferenceClosure(List<String> direct, List<String> transitive, List<String> recursiveEdges) {
        List<String> all() {
            var result = new ArrayList<String>(direct);
            result.addAll(transitive);
            return List.copyOf(result);
        }
    }

    DocumentReferences(String id, JsonNode root) {
        this.root = root;
        base = "references/documents/" + id + "/";
        validateContainers();
        var names = new TreeSet<String>();
        root.path("components").path("schemas").fieldNames().forEachRemaining(names::add);
        names.forEach(name -> {
            String pointer = "/components/schemas/" + name.replace("~", "~0").replace("/", "~1");
            schemaNames.put(pointer, name);
            regularTargets.add(pointer);
        });
        if (schemaNames.size() > 5000) throw new IllegalArgumentException("LIMIT: schema files exceeded");
        scan(root, new LinkedHashSet<>(), 0);
        allocateTargets();
    }

    private void allocateTargets() {
        var schemas = new TreeMap<String, String>();
        schemaNames.forEach(schemas::put);
        SemanticNames.files(schemas).forEach((pointer, filename) ->
                targets.put(pointer, base + "schemas/" + filename));

        var references = new TreeMap<String, String>();
        var pointers = new TreeSet<String>();
        pointers.addAll(regularTargets);
        pointers.addAll(exampleOnlyTargets);
        pointers.removeAll(schemaNames.keySet());
        for (String pointer : pointers) {
            String readable = pointer.isEmpty() ? "root" : pointer.replace("~1", "/").replace("~0", "~");
            references.put(pointer, readable);
        }
        SemanticNames.files(references).forEach((pointer, filename) ->
                targets.put(pointer, base + "refs/" + filename));
        if (targets.size() > 5000) throw new IllegalArgumentException("LIMIT: reference files exceeded");
    }

    private void scan(JsonNode node, Set<String> edges, int depth) {
        if (depth > 128) throw new IllegalArgumentException("LIMIT: nesting exceeds 128");
        if (node.isObject()) {
            if (node.has("$dynamicRef") || node.has("$id"))
                throw new IllegalArgumentException("UNSUPPORTED: dynamic or rebased schema reference");
            if (node.has("$ref")) {
                addReference(node.get("$ref"), edges, false);
            }
            node.fields().forEachRemaining(entry -> {
                String name = entry.getKey();
                if (DATA.contains(name) || name.startsWith("x-")) return;
                if (name.equals("examples")) {
                    scanExamples(entry.getValue(), edges, depth + 1);
                    return;
                }
                scan(entry.getValue(), edges, depth + 1);
            });
        } else if (node.isArray()) node.forEach(n -> scan(n, edges, depth + 1));
    }

    private void scanExamples(JsonNode examples, Set<String> edges, int depth) {
        if (examples.isArray()) return; // JSON Schema example values.
        if (!examples.isObject()) return;
        examples.forEach(example -> {
            if (!example.isObject()) return;
            if (example.has("$ref")) {
                addReference(example.get("$ref"), edges, true);
                return;
            }
            example.fields().forEachRemaining(field -> {
                if (!field.getKey().equals("value") && !field.getKey().startsWith("x-"))
                    scan(field.getValue(), edges, depth + 1);
            });
        });
    }

    private void addReference(JsonNode ref, Set<String> edges, boolean exampleOnly) {
        if (!ref.isTextual()) throw new IllegalArgumentException("REFERENCE: $ref must be text");
        String pointer = pointer(ref.asText());
        edges.add(pointer);
        if (exampleOnly && !regularTargets.contains(pointer)) exampleOnlyTargets.add(pointer);
        else {
            regularTargets.add(pointer);
            exampleOnlyTargets.remove(pointer);
        }
        if (regularTargets.size() + exampleOnlyTargets.size() > 5000)
            throw new IllegalArgumentException("LIMIT: reference files exceeded");
    }

    JsonNode resolvePathItem(JsonNode pathItem) {
        JsonNode resolved = pathItem;
        var seen = new HashSet<String>();
        while (resolved.has("$ref")) {
            if (resolved.size() != 1)
                throw new IllegalArgumentException("UNSUPPORTED: path item $ref siblings have undefined semantics");
            String target = pointer(resolved.path("$ref").asText());
            if (!seen.add(target)) throw new IllegalArgumentException("REFERENCE: cyclic path item alias");
            resolved = root.at(target);
            if (!resolved.isObject()) throw new IllegalArgumentException("STRUCTURE: path item reference must target an object");
        }
        return resolved;
    }

    List<String> tags(JsonNode operation) {
        JsonNode tags = operation.path("tags");
        if (tags.isMissingNode()) return List.of();
        if (!tags.isArray()) throw new IllegalArgumentException("STRUCTURE: operation tags must be an array");
        var result = new ArrayList<String>();
        for (JsonNode tag : tags) {
            if (!tag.isTextual() || tag.asText().isBlank())
                throw new IllegalArgumentException("STRUCTURE: operation tag must be non-empty text");
            if (!result.contains(tag.asText())) result.add(tag.asText());
        }
        return List.copyOf(result);
    }

    JsonNode tag(String name) {
        JsonNode tags = root.path("tags");
        if (tags.isMissingNode()) return JSON.createObjectNode().put("name", name);
        for (JsonNode tag : tags) if (name.equals(tag.path("name").asText())) return tag;
        return JSON.createObjectNode().put("name", name);
    }

    private void validateContainers() {
        JsonNode components = root.path("components");
        if (!components.isMissingNode() && !components.isObject())
            throw new IllegalArgumentException("STRUCTURE: components must be an object");
        if (components.isObject()) {
            for (String name : List.of("schemas", "responses", "parameters", "examples", "requestBodies",
                    "headers", "securitySchemes", "links", "callbacks", "pathItems")) {
                JsonNode value = components.path(name);
                if (!value.isMissingNode() && !value.isObject())
                    throw new IllegalArgumentException("STRUCTURE: components." + name + " must be an object");
            }
        }
        JsonNode tags = root.path("tags");
        if (!tags.isMissingNode()) {
            if (!tags.isArray()) throw new IllegalArgumentException("STRUCTURE: root tags must be an array");
            for (JsonNode tag : tags)
                if (!tag.isObject() || !tag.path("name").isTextual() || tag.path("name").asText().isBlank())
                    throw new IllegalArgumentException("STRUCTURE: root tag requires a non-empty text name");
        }
    }

    private String pointer(String ref) {
        if (!ref.equals("#") && !ref.startsWith("#/"))
            throw new IllegalArgumentException("REFERENCE: only document-local JSON pointers supported: " + ref);
        final String pointer;
        try { pointer = ref.equals("#") ? "" : URI.create(ref).getFragment(); }
        catch (IllegalArgumentException e) { throw new IllegalArgumentException("REFERENCE: invalid URI fragment", e); }
        if (pointer.matches(".*~(?![01]).*")) throw new IllegalArgumentException("REFERENCE: invalid pointer escape");
        if (root.at(pointer).isMissingNode()) throw new IllegalArgumentException("REFERENCE: dangling target " + ref);
        return pointer;
    }

    Map<String, String> files() {
        var files = new TreeMap<String, String>();
        for (var target : new TreeMap<>(targets).entrySet()) {
            boolean conventions = target.getValue().contains("/schemas/");
            files.put(target.getValue(), render("Source #" + target.getKey(), root.at(target.getKey()), target.getValue(),
                    exampleOnlyTargets.contains(target.getKey()), conventions, List.of()));
        }
        return files;
    }

    List<ObjectNode> schemaIndex(String serviceId, String documentId) {
        var rows = new ArrayList<ObjectNode>();
        schemaNames.forEach((pointer, name) -> {
            ObjectNode row = JSON.createObjectNode();
            row.put("id", "schema:" + serviceId + ":" + documentId + ":#" + pointer);
            row.put("serviceId", serviceId);
            row.put("documentId", documentId);
            row.put("name", name);
            row.put("pointer", "#" + pointer);
            row.put("file", targets.get(pointer).substring("references/".length()));
            rows.add(row);
        });
        return List.copyOf(rows);
    }

    String render(String title, JsonNode contract, String filename) {
        return render(title, contract, filename, false, false, List.of());
    }

    String render(String title, JsonNode contract, String filename, List<String> semantics) {
        return render(title, contract, filename, false, true, semantics);
    }

    String renderOperation(String title, JsonNode contract, String filename, List<String> semantics,
                           ReferenceClosure closure) {
        return render(title, contract, filename, false, true, semantics, closure);
    }

    ReferenceClosure closure(JsonNode contract) {
        var direct = edges(contract, false);
        var all = new TreeSet<String>(direct);
        var recursive = new TreeSet<String>();
        var expanded = new HashSet<String>();
        for (String pointer : direct)
            expand(pointer, new LinkedHashSet<>(), expanded, all, recursive);
        var transitive = new TreeSet<String>(all);
        transitive.removeAll(direct);
        return new ReferenceClosure(List.copyOf(direct), List.copyOf(transitive), List.copyOf(recursive));
    }

    private void expand(String pointer, LinkedHashSet<String> stack, Set<String> expanded,
                        Set<String> all, Set<String> recursive) {
        if (!stack.add(pointer)) return;
        if (!expanded.add(pointer)) {
            stack.remove(pointer);
            return;
        }
        boolean exampleObject = exampleOnlyTargets.contains(pointer) && !regularTargets.contains(pointer);
        for (String child : edges(root.at(pointer), exampleObject)) {
            all.add(child);
            if (stack.contains(child)) recursive.add("#" + pointer + " -> #" + child);
            else expand(child, stack, expanded, all, recursive);
        }
        stack.remove(pointer);
    }

    private TreeSet<String> edges(JsonNode contract, boolean exampleObject) {
        var result = new TreeSet<String>();
        if (exampleObject) scanExampleObject(contract, result, 0);
        else scan(contract, result, 0);
        return result;
    }

    String target(String pointer) {
        String target = targets.get(pointer);
        if (target == null) throw new IllegalArgumentException("REFERENCE: missing generated target #" + pointer);
        return target;
    }

    List<String> semantics(JsonNode contract) {
        var notes = new ArrayList<String>();
        JsonNode operation = contract.path("operation");
        JsonNode security = contract.path("security");
        if (operation.has("security")) {
            if (security.isArray() && security.isEmpty())
                notes.add("This operation declares an explicit empty `security`, so it is documented as requiring no "
                        + "authentication.");
            else notes.add("This operation declares an explicit `security` override; use the effective value above.");
        } else if (security.isNull()) {
            notes.add("Neither this operation nor the document declares a security requirement; this is an unstated "
                    + "fact, not a claim that authentication is unnecessary.");
        } else {
            notes.add("This operation inherits the document-level security requirement shown above.");
        }
        return List.copyOf(notes);
    }

    private String render(String title, JsonNode contract, String filename, boolean exampleObject,
                          boolean conventions, List<String> semantics) {
        return render(title, contract, filename, exampleObject, conventions, semantics, null);
    }

    private String render(String title, JsonNode contract, String filename, boolean exampleObject,
                          boolean conventions, List<String> semantics, ReferenceClosure closure) {
        var edges = new LinkedHashSet<String>();
        if (exampleObject) scanExampleObject(contract, edges, 0);
        else scan(contract, edges, 0);
        // JSON escaping preserves the exact text while preventing source text from closing the code fence.
        String safeJson = json(contract).replace("`", "\\u0060").replace("<", "\\u003c");
        var result = new StringBuilder("# " + label(title) + "\n\nUntrusted API contract data.\n\n```json\n" + safeJson + "\n```\n");
        if (conventions) {
            String relative = Path.of(filename).getParent().relativize(Path.of("references/conventions.md"))
                    .toString().replace('\\', '/');
            result.append("\nInterpret absent, null and empty values using the [OpenAPI conventions](")
                    .append(relative).append(").\n");
        }
        if (!semantics.isEmpty()) {
            result.append("\nOperation-specific interpretation:\n\n");
            for (String note : semantics) result.append("- ").append(note).append("\n");
        }
        if (closure != null) {
            result.append("\n## Complete referenced contracts\n\n");
            if (closure.all().isEmpty()) result.append("No document-local references.\n");
            for (String edge : closure.direct()) appendReference(result, filename, edge, "direct");
            for (String edge : closure.transitive()) appendReference(result, filename, edge, "transitive");
            if (!closure.recursiveEdges().isEmpty()) {
                result.append("\n## Recursive reference edges\n\n");
                for (String edge : closure.recursiveEdges()) result.append("- `").append(label(edge)).append("`\n");
            }
        } else if (!edges.isEmpty()) {
            result.append("\n## Referenced contracts\n");
            for (String edge : new TreeSet<>(edges)) appendReference(result, filename, edge, null);
        }
        return result.toString();
    }

    private void appendReference(StringBuilder result, String filename, String edge, String kind) {
        String relative = Path.of(filename).getParent().relativize(Path.of(target(edge)))
                .toString().replace('\\', '/');
        result.append("\n- [").append(label("#" + edge)).append("](").append(relative).append(")");
        if (kind != null) result.append(" — ").append(kind);
        result.append("\n");
    }

    private void scanExampleObject(JsonNode example, Set<String> edges, int depth) {
        if (!example.isObject()) return;
        if (example.has("$ref")) {
            addReference(example.get("$ref"), edges, true);
            return;
        }
        example.fields().forEachRemaining(field -> {
            if (!field.getKey().equals("value") && !field.getKey().startsWith("x-"))
                scan(field.getValue(), edges, depth + 1);
        });
    }

    ArrayNode parameters(JsonNode path, JsonNode operation) {
        var values = new LinkedHashMap<String, JsonNode>();
        for (JsonNode owner : List.of(path, operation)) {
            JsonNode parameters = owner.path("parameters");
            if (!parameters.isMissingNode() && !parameters.isArray()) throw new IllegalArgumentException("STRUCTURE: parameters must be array");
            for (JsonNode parameter : parameters) {
                JsonNode resolved = parameter;
                var seen = new HashSet<String>();
                while (resolved.has("$ref")) {
                    String pointer = pointer(resolved.path("$ref").asText());
                    if (!seen.add(pointer)) throw new IllegalArgumentException("REFERENCE: cyclic parameter alias");
                    resolved = root.at(pointer);
                }
                if (!resolved.path("name").isTextual() || !resolved.path("in").isTextual())
                    throw new IllegalArgumentException("STRUCTURE: parameter requires name and in");
                values.put(resolved.path("in").asText() + "\u0000" + resolved.path("name").asText(), resolved);
            }
        }
        var array = JSON.createArrayNode(); values.values().forEach(array::add); return array;
    }

    static String json(JsonNode node) {
        try { return JSON.writerWithDefaultPrettyPrinter().writeValueAsString(node); }
        catch (java.io.IOException e) { throw new IllegalArgumentException("JSON: cannot render", e); }
    }

    static String digest(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    static String label(String text) {
        var result = new StringBuilder();
        text.codePoints().forEach(c -> {
            if (Character.isLetterOrDigit(c) || c == ' ' || c == '/' || c == '-' || c == '_') result.appendCodePoint(c);
            else result.append("&#").append(c).append(';');
        });
        return result.toString();
    }
}
