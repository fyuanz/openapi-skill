package io.github.fyuanz.openapi.skill.maven;

import java.io.File;

/** One configured OpenAPI document belonging to the service Skill. */
public final class DocumentSource {
    private String id;
    private File path;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public File getPath() {
        return path;
    }

    public void setPath(File path) {
        this.path = path;
    }
}
