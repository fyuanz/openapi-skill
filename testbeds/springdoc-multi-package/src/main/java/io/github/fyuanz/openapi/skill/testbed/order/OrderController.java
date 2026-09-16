package io.github.fyuanz.openapi.skill.testbed.order;

import io.github.fyuanz.openapi.skill.testbed.common.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@Tag(name = "订单管理")
public class OrderController {
    @PostMapping(value = "/orders", consumes = "application/json", produces = "application/json")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "createOrder", summary = "创建示例订单", description = "校验后回显请求，不持久化；鉴权仅为文档示例。")
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponse(responseCode = "201", description = "订单已创建", useReturnTypeSchema = true)
    @ApiResponse(responseCode = "400", description = "请求无效", content = @Content(schema = @Schema(implementation = ApiError.class)))
    public CreateOrder create(@Valid @RequestBody CreateOrder request) {
        return request;
    }
}
