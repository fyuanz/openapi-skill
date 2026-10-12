# Verification

- 新增本地安装回归测试先失败：旧 Skill 没有项目本地调用示例。
- 修正后 npm test：96/96 通过。
- 测试清空 PATH，使用 Node 绝对可执行路径执行生成指引中的包脚本；项目和外部 Skill 路径均含空格，成功找到上传接口并核对返回文件。
- npm pack --dry-run：openapi-skill 2.2.2，59 个发布文件。
- OpenSpec 变更严格校验通过。
- 不执行 npm publish；用户升级后重新生成 Skill 应用新指引。
