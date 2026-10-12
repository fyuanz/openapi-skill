# Proposal

## Why

生成的 Skill 直接使用裸 openapi-skill 命令，项目本地安装未加入普通 shell PATH 时，模型误判 CLI 不存在并退回文件检索。

## What Changes

- 指引区分项目根目录与 Skill 目录，优先通过本地包脚本调用 CLI。
- 明确绝对 Skill 路径和相对返回路径的基准，保留无 CLI 时文件检索。
- 验证本地安装与带空格的外部 Skill 目录，版本从 2.2.1 升至 2.2.2。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `catalog-interface-discovery`: 本地 CLI 的定位与调用指引。

## Impact

仅修改 Node 入口模板、回归测试和文档、包版本。无新依赖，不修改用户实际项目，不发布 npm。
