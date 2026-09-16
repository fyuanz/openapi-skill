package io.github.fyuanz.openapi.skill.testbed.file;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@Tag(name = "文件管理")
public class FileController {
    @PostMapping(value = "/files", consumes = "multipart/form-data", produces = "application/json")
    @Operation(operationId = "uploadFile", summary = "上传示例文件", description = "只返回文件大小，不保存文件。")
    public UploadReceipt upload(@Parameter(description = "待上传文件") @RequestPart MultipartFile file) {
        return new UploadReceipt(file.getSize());
    }

    @Schema(description = "上传结果")
    public record UploadReceipt(@Schema(description = "文件字节数", example = "3") long size) {
    }
}
