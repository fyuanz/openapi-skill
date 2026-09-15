package com.smartdoc.agent.core;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;

/** Human-readable generated paths with a short deterministic collision discriminator. */
final class SemanticNames {
    private static final int MAX_SLUG = 48;

    private SemanticNames() {}

    static String operationFile(String method, String path) {
        return operationFile(method, path, Set.of());
    }

    static String operationFile(String method, String path, Set<String> used) {
        String readablePath = path.replaceAll("\\{([^{}]+)}", " by $1 ");
        return file(slug(method + " " + readablePath), method + "\u0000" + path, used);
    }

    static String pointerFile(String pointer) {
        return pointerFile(pointer, Set.of());
    }

    static String pointerFile(String pointer, Set<String> used) {
        if (pointer.isEmpty()) return file("root", pointer, used);
        String readable = pointer.replace("~1", "/").replace("~0", "~");
        return file(slug(readable), pointer, used);
    }

    static String file(String readable, String identity) {
        return file(readable, identity, Set.of());
    }

    static String file(String readable, String identity, Set<String> used) {
        String slug = slug(readable);
        String digest = DocumentReferences.digest(identity.getBytes(StandardCharsets.UTF_8));
        for (int length = 6; ; length = Math.min(length + 4, digest.length())) {
            String candidate = slug + "--" + digest.substring(0, length) + ".md";
            if (!used.contains(candidate.toLowerCase(Locale.ROOT))) return candidate;
            if (length == digest.length()) break;
        }
        throw new IllegalArgumentException("IDENTITY: cannot allocate a unique semantic file name");
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
