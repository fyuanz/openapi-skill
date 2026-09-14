package com.smartdoc.agent.runtime;

import org.springframework.core.env.Environment;

import java.util.Locale;

final class RuntimeSkillNames {
    private RuntimeSkillNames() {}

    static Names resolve(RuntimeSkillProperties properties, Environment environment) {
        String configuredService = text(properties.getServiceId());
        String serviceId = configuredService != null
                ? configuredService
                : safe(environment.getProperty("spring.application.name", "application"));
        String configuredSkill = text(properties.getSkillName());
        String skillName = configuredSkill != null ? configuredSkill : appendApi(serviceId);
        return new Names(serviceId, skillName);
    }

    static String safe(String value) {
        String candidate = value == null ? "" : value.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        if (candidate.isEmpty()) candidate = "application";
        if (candidate.length() > 63) candidate = candidate.substring(0, 63).replaceAll("-+$", "");
        if (candidate.matches("con|prn|aux|nul|com[0-9]|lpt[0-9]")) candidate = "app-" + candidate;
        return candidate;
    }

    private static String appendApi(String serviceId) {
        String base = serviceId.length() > 59 ? serviceId.substring(0, 59).replaceAll("-+$", "") : serviceId;
        return base + "-api";
    }

    private static String text(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    record Names(String serviceId, String skillName) {}
}
