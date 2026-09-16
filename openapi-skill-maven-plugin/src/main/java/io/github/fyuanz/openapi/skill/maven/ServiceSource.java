package io.github.fyuanz.openapi.skill.maven;

import java.io.File;
import java.util.List;

/** Explicit identity and local document sources for one member of a service set. */
public final class ServiceSource {
    private String serviceId;
    private String skillName;
    private File documentsDirectory;
    private List<DocumentSource> documents;

    public String getServiceId() { return serviceId; }
    public void setServiceId(String serviceId) { this.serviceId = serviceId; }
    public String getSkillName() { return skillName; }
    public void setSkillName(String skillName) { this.skillName = skillName; }
    public File getDocumentsDirectory() { return documentsDirectory; }
    public void setDocumentsDirectory(File documentsDirectory) { this.documentsDirectory = documentsDirectory; }
    public List<DocumentSource> getDocuments() { return documents; }
    public void setDocuments(List<DocumentSource> documents) { this.documents = documents; }
}
