package io.github.fyuanz.openapi.skill.core;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.*;
import java.util.function.UnaryOperator;

/** Human-readable generated paths with a deterministic discriminator only for real collisions. */
final class SemanticNames {
    /** One shared bound for generated stems: long enough to keep a complete path tail, short enough for any filesystem. */
    private static final int MAX_SLUG = 72;
    private static final int MAX_STEM_BYTES = 72;
    private static final String UNTAGGED = "untagged";

    private SemanticNames() {}

    static Map<String, String> operationFiles(Collection<Map.Entry<String, String>> operations) {
        var readable = new TreeMap<String, String>();
        for (var operation : operations) {
            String identity = operationIdentity(operation.getKey(), operation.getValue());
            readable.put(identity, operationReadable(operation.getKey(), operation.getValue()));
        }
        return files(readable);
    }

    static String file(String readable, String identity) {
        return files(Map.of(identity, readable)).get(identity);
    }

    /**
     * Group file names keep the OpenAPI tag text itself, including non-ASCII scripts. A Chinese tag such as
     * 航线任务 therefore stays readable instead of collapsing onto a shared ASCII stem.
     */
    static Map<String, String> tagFiles(Map<String, String> readableByIdentity) {
        return files(readableByIdentity, SemanticNames::tagStem);
    }

    /** Allocates all names together so every member of a collision group is treated consistently. */
    static Map<String, String> files(Map<String, String> readableByIdentity) {
        return files(readableByIdentity, SemanticNames::slug);
    }

    private static Map<String, String> files(Map<String, String> readableByIdentity, UnaryOperator<String> stemOf) {
        var groups = new TreeMap<String, List<String>>();
        var stems = new TreeMap<String, String>();
        for (var entry : new TreeMap<>(readableByIdentity).entrySet()) {
            String stem = stemOf.apply(entry.getValue());
            stems.put(entry.getKey(), stem);
            groups.computeIfAbsent(stem.toLowerCase(Locale.ROOT), ignored -> new ArrayList<>()).add(entry.getKey());
        }
        var result = new TreeMap<String, String>();
        var used = new HashSet<String>();
        for (var group : groups.values()) {
            if (group.size() != 1) continue;
            String identity = group.get(0);
            if (needsFallback(readableByIdentity.get(identity), stems.get(identity))) continue;
            String candidate = stems.get(identity) + ".md";
            result.put(identity, candidate);
            used.add(candidate.toLowerCase(Locale.ROOT));
        }
        for (var group : groups.values()) {
            if (group.size() == 1) {
                String identity = group.get(0);
                if (!needsFallback(readableByIdentity.get(identity), stems.get(identity))) continue;
            }
            for (String identity : group) {
                String digest = DocumentReferences.digest(identity.getBytes(StandardCharsets.UTF_8));
                boolean allocated = false;
                for (int length = 6; ; length = Math.min(length + 4, digest.length())) {
                    String candidate = stems.get(identity) + "--" + digest.substring(0, length) + ".md";
                    if (used.add(candidate.toLowerCase(Locale.ROOT))) {
                        result.put(identity, candidate);
                        allocated = true;
                        break;
                    }
                    if (length == digest.length()) break;
                }
                if (!allocated) throw new IllegalArgumentException("IDENTITY: cannot allocate a unique semantic file name");
            }
        }
        return Collections.unmodifiableMap(result);
    }

    private static boolean needsFallback(String readable, String stem) {
        boolean hasAscii = readable != null && readable.matches(".*[A-Za-z0-9].*");
        return (!hasAscii && stem.equals("item"))
                || stem.matches("(?i)con|prn|aux|nul|com[0-9]|lpt[0-9]");
    }

    static String operationIdentity(String method, String path) { return method + "\u0000" + path; }

    private static String operationReadable(String method, String path) {
        String readablePath = path.replaceAll("\\{([^{}]+)}", " by $1 ");
        return method + " " + readablePath;
    }

    static String slug(String value) {
        String separated = value.replaceAll("([a-z0-9])([A-Z])", "$1-$2");
        var result = new StringBuilder();
        boolean separator = false;
        for (int i = 0; i < separated.length(); i++) {
            char c = separated.charAt(i);
            if (c >= 'A' && c <= 'Z') c = Character.toLowerCase(c);
            if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
                if (separator && !result.isEmpty()) result.append('-');
                result.append(c);
                separator = false;
            } else {
                separator = !result.isEmpty();
            }
            if (result.length() >= MAX_SLUG) break;
        }
        while (!result.isEmpty() && result.charAt(result.length() - 1) == '-') result.deleteCharAt(result.length() - 1);
        return result.isEmpty() ? "item" : result.toString().toLowerCase(Locale.ROOT);
    }

    /** Tag stems keep letters, digits, underscores and hyphens of any script; every other character separates. */
    static String tagStem(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFC);
        var result = new StringBuilder();
        boolean separator = false;
        int bytes = 0;
        for (int offset = 0; offset < normalized.length();) {
            int codePoint = normalized.codePointAt(offset);
            offset += Character.charCount(codePoint);
            if (Character.isLetterOrDigit(codePoint) || codePoint == '_' || codePoint == '-') {
                int addition = (separator && !result.isEmpty() ? 1 : 0) + utf8Width(codePoint);
                if (bytes + addition > MAX_STEM_BYTES) break;
                if (separator && !result.isEmpty()) result.append('-');
                result.appendCodePoint(codePoint);
                bytes += addition;
                separator = false;
            } else {
                separator = !result.isEmpty();
            }
        }
        while (!result.isEmpty() && result.charAt(result.length() - 1) == '-') result.deleteCharAt(result.length() - 1);
        return result.isEmpty() ? UNTAGGED : result.toString();
    }

    private static int utf8Width(int codePoint) {
        if (codePoint < 0x80) return 1;
        if (codePoint < 0x800) return 2;
        if (codePoint < 0x10000) return 3;
        return 4;
    }
}
