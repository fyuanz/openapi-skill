package io.github.fyuanz.openapi.skill.testbed.common;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "统一错误响应")
public record ApiError(
        @Schema(description = "错误码", example = "NOT_FOUND") String code,
        @Schema(description = "错误说明", example = "未找到示例资源") String message) {
}
