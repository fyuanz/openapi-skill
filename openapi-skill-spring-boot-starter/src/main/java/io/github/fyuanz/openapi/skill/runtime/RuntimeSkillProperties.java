package io.github.fyuanz.openapi.skill.runtime;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Optional overrides for the zero-configuration runtime Skill endpoint. */
@ConfigurationProperties("openapi.skill.runtime")
public final class RuntimeSkillProperties {
    private boolean enabled = true;
    private String path = "/openapi-skill/skill.zip";
    private String serviceId;
    private String skillName;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getServiceId() {
        return serviceId;
    }

    public void setServiceId(String serviceId) {
        this.serviceId = serviceId;
    }

    public String getSkillName() {
        return skillName;
    }

    public void setSkillName(String skillName) {
        this.skillName = skillName;
    }
}
