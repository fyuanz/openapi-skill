package io.github.fyuanz.openapi.skill.runtime;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;

/** Read-only runtime endpoint for downloading a Skill generated from the current SpringDoc model. */
@RestController
public final class RuntimeSkillEndpoint {
    private static final MediaType ZIP = MediaType.parseMediaType("application/zip");
    private final RuntimeSkillArchive archive;

    public RuntimeSkillEndpoint(RuntimeSkillArchive archive) {
        this.archive = archive;
    }

    @Operation(hidden = true)
    @GetMapping(value = "${openapi.skill.runtime.path:/openapi-skill/skill.zip}", produces = "application/zip")
    public ResponseEntity<byte[]> download(HttpServletRequest request, Locale locale) {
        RuntimeSkillArchive.Archive generated = archive.generate(request, locale);
        byte[] content = generated.content();
        return ResponseEntity.ok()
                .contentType(ZIP)
                .contentLength(content.length)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + generated.fileName())
                .body(content);
    }
}
