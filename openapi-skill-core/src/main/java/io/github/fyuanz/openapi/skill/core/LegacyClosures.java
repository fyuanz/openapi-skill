package io.github.fyuanz.openapi.skill.core;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Path;
import java.util.*;
import java.util.regex.Pattern;

/** Recover the reachable contract set from validated legacy Markdown links, without reading source JSON as instructions. */
final class LegacyClosures {
    private static final Pattern LINK = Pattern.compile("\\]\\(([^)]+)\\)");
    private record Frame(String path, Iterator<String> edges) {}

    static void complete(Map<String, String> files, Map<String, String> paths, List<ObjectNode> rows) {
        for (ObjectNode row : rows) {
            String operation = "references/" + row.path("file").asText();
            if (row.path("closureFiles").isArray() && row.path("recursiveEdges").isArray()
                    && files.get(operation).contains("## Complete referenced contracts")) continue;
            var direct = edges(files, paths, operation);
            var all = new TreeSet<String>();
            var recursive = new TreeSet<String>();
            var active = new HashSet<String>();
            var expanded = new HashSet<String>();
            var stack = new ArrayDeque<Frame>();
            active.add(operation);
            stack.push(new Frame(operation, direct.iterator()));
            while (!stack.isEmpty()) {
                Frame frame = stack.peek();
                if (!frame.edges.hasNext()) { active.remove(frame.path); expanded.add(frame.path); stack.pop(); continue; }
                String child = frame.edges.next();
                all.add(child);
                if (active.contains(child)) recursive.add(paths.get(frame.path) + " -> " + paths.get(child));
                else if (!expanded.contains(child)) {
                    active.add(child);
                    stack.push(new Frame(child, edges(files, paths, child).iterator()));
                }
            }
            var closure = row.putArray("closureFiles");
            all.forEach(file -> closure.add(file.substring("references/".length())));
            var cycles = row.putArray("recursiveEdges");
            recursive.forEach(cycles::add);
            String content = files.get(operation);
            int existing = content.indexOf("\n## Complete referenced contracts");
            if (existing >= 0) content = content.substring(0, existing);
            var appendix = new StringBuilder("\n## Complete referenced contracts\n\n");
            if (all.isEmpty()) appendix.append("No document-local references.\n");
            for (String target : all) {
                String relative = Path.of(operation).getParent().relativize(Path.of(target)).toString().replace('\\', '/');
                appendix.append("- [").append(DocumentReferences.label(target)).append("](").append(relative)
                        .append(") — ").append(direct.contains(target) ? "direct" : "transitive").append('\n');
            }
            files.put(operation, content + appendix);
        }
    }

    private static SortedSet<String> edges(Map<String, String> files, Map<String, String> paths, String source) {
        var result = new TreeSet<String>();
        boolean fenced = false;
        for (String line : files.get(source).split("\n")) {
            if (line.stripLeading().startsWith("```")) { fenced = !fenced; continue; }
            if (fenced) continue;
            var matcher = LINK.matcher(line);
            while (matcher.find()) {
                String target = Path.of(source).getParent().resolve(matcher.group(1)).normalize().toString().replace('\\', '/');
                if (paths.containsKey(target) && !target.equals("references/conventions.md")) result.add(target);
            }
        }
        return result;
    }
}
