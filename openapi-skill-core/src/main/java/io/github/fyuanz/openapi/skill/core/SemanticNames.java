package io.github.fyuanz.openapi.skill.core;

import java.nio.charset.StandardCharsets;
import java.util.*;

/** Human-readable generated paths with a deterministic discriminator only for real collisions. */
final class SemanticNames {
    private static final int MAX_SLUG = 48;

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

    /** Allocates all names together so every member of a collision group is treated consistently. */
    static Map<String, String> files(Map<String, String> readableByIdentity) {
        var groups = new TreeMap<String, List<String>>();
        var stems = new TreeMap<String, String>();
        for (var entry : new TreeMap<>(readableByIdentity).entrySet()) {
            String stem = slug(entry.getValue());
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
}
