package io.github.fyuanz.openapi.skill.testbed.user;

import io.github.fyuanz.openapi.skill.testbed.common.Address;
import io.github.fyuanz.openapi.skill.testbed.common.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping(value = "/users", produces = "application/json")
@Tag(name = "用户管理")
public class UserController {
    private static final UserView SAMPLE = new UserView(1L, "示例用户", new Address("示例市", "示例路"), List.of());

    @GetMapping
    @Operation(operationId = "listUsers", summary = "搜索用户")
    public List<UserView> list(@Parameter(description = "按显示名称过滤")
                              @RequestParam(required = false) String keyword) {
        return keyword == null || SAMPLE.name().contains(keyword) ? List.of(SAMPLE) : List.of();
    }

    @GetMapping("/{id}")
    @Operation(operationId = "getUser", summary = "查询用户")
    @ApiResponse(responseCode = "200", description = "用户详情", content = @Content(schema = @Schema(implementation = UserView.class)))
    @ApiResponse(responseCode = "404", description = "用户不存在", content = @Content(schema = @Schema(implementation = ApiError.class)))
    public ResponseEntity<?> get(@Parameter(description = "用户编号", example = "1") @PathVariable Long id,
                                 @Parameter(description = "调用链请求标识")
                                 @RequestHeader(name = "X-Request-Id", required = false) String requestId) {
        return id == 1L ? ResponseEntity.ok(SAMPLE)
                : ResponseEntity.status(404).body(new ApiError("NOT_FOUND", "未找到示例资源"));
    }
}
