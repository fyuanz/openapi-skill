package io.github.fyuanz.openapi.skill.testbed.user;

import io.github.fyuanz.openapi.skill.testbed.common.Address;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "含递归下级关系的用户")
public record UserView(
        @Schema(description = "用户编号", example = "1") Long id,
        @Schema(description = "用户显示名称", example = "示例用户") String name,
        @Schema(description = "联系地址") Address address,
        @Schema(description = "下级用户，允许递归") List<UserView> children) {
}
