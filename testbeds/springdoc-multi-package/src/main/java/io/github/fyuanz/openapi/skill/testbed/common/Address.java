package io.github.fyuanz.openapi.skill.testbed.common;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "用户与订单共用的地址")
public record Address(
        @NotBlank @Schema(description = "城市", example = "示例市") String city,
        @NotBlank @Schema(description = "街道", example = "示例路") String street) {
}
