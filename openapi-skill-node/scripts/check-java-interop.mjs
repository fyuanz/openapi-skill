// Run after the core Maven tests. Build-only files stay under the ignored target directory.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateSkill } from '../dist/index.js';

const target = fileURLToPath(new URL('../../openapi-skill-core/target/node-interop/', import.meta.url));
const report = await readFile(new URL('../../openapi-skill-core/target/surefire-reports/TEST-io.github.fyuanz.openapi.skill.core.CatalogDiscoveryTest.xml', import.meta.url), 'utf8');
const classpath = report.match(/name="java.class.path" value="([^"]+)"/)[1].replaceAll('&amp;', '&').replaceAll('&quot;', '"');
const input = await readFile(new URL('../../openapi-skill-core/src/test/resources/catalog-discovery.json', import.meta.url));
const service = generateSkill({ serviceId: 'node', skillName: 'node-api', documents: new Map([['business', input]]) });
await mkdir(target, { recursive: true });
await writeFile(join(target, 'services.json'), JSON.stringify({ node: Object.fromEntries(service) }));
const java = join(target, 'NodeInterop.java');
await writeFile(java, `
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import io.github.fyuanz.openapi.skill.core.AggregateSkillGenerator;
import java.nio.file.*;
import java.util.*;
public class NodeInterop {
  public static void main(String[] args) throws Exception {
    var services = new ObjectMapper().readValue(Files.readString(Path.of(args[0])),
        new TypeReference<Map<String, Map<String, String>>>() {});
    var aggregate = new AggregateSkillGenerator().generate("combined", "combined-api", services);
    if (!aggregate.get("references/index.md").contains("POST /files")) throw new AssertionError("missing operation");
    System.out.println("Current Java validator and aggregate generator accept optimized Node service output");
  }
}
`);
execFileSync('java', ['-cp', classpath, java, join(target, 'services.json')], { stdio: 'inherit' });
