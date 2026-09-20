package io.github.fyuanz.openapi.skill.testbed.user;

import io.github.fyuanz.openapi.skill.testbed.common.Address;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "含递归下级关系的用户")
public record UserView(
        @Schema(description = "用户编号", example = "1") Long id,
        @Schema(description = "用户显示名称", example = "示例用户") String name,
        // The value domain lives in the description only: the type stays Integer, so the document
        // carries no `enum` keyword. A consumer has to read the stated values out of the prose.
        @Schema(description = "用户角色：1 超级管理员，2 普通管理员，3 开发者", example = "1") Integer role,
        @Schema(description = "联系地址") Address address,
        @Schema(description = "下级用户，允许递归") List<UserView> children) {
}
