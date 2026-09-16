package io.github.fyuanz.openapi.skill.testbed.order;

import io.github.fyuanz.openapi.skill.testbed.common.Address;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

@Schema(description = "创建订单请求")
public record CreateOrder(
        @NotNull @Schema(description = "下单用户编号", example = "1") Long userId,
        @NotNull @Min(1) @Schema(description = "购买数量", example = "2") Integer quantity,
        @NotNull @Valid @Schema(description = "收货地址") Address shippingAddress) {
}
