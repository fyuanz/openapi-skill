# node-local-document-sources Specification

## Purpose

定义 `openapi-skill` Node CLI 从显式配置的本地 JSON 文件读取 OpenAPI 文档，并将其纳入项目 Skill 生成流程的行为边界。

## Requirements

### Requirement: 配置项接受本地 JSON 文件路径

`services[].documents[].url` SHALL 在 HTTP(S) URL 之外接受本地 JSON 文件路径。相对路径 SHALL 以运行 CLI 时的项目根目录 `cwd` 为基准解析，绝对路径 SHALL 直接按给定路径读取。

#### Scenario: 相对路径从项目根目录解析

- **WHEN** 配置中的 `url` 值为 `./openapi/account.json`
- **THEN** 系统 SHALL 从运行 CLI 时的项目根目录下读取 `openapi/account.json`，而不是从配置文件所在位置或进程其它目录解析

#### Scenario: 绝对路径直接读取

- **WHEN** 配置中的 `url` 值为 `F:/foo/account.json` 或 `/abs/account.json`
- **THEN** 系统 SHALL 直接读取该绝对路径指向的本地 JSON 文件

### Requirement: 本地文档受输入大小限制约束

本地 JSON 文件 SHALL 与 HTTP(S) 下载文档使用相同的输入大小限制：单个文档不得超过 8 MiB，整个项目的所有文档合计不得超过 32 MiB。

#### Scenario: 单个本地文件超过限制

- **WHEN** 某个本地 JSON 文件读取后的字节数超过 8 MiB
- **THEN** 系统 SHALL 使本次生成失败，且不得发布部分结果或替换已有 Skill

#### Scenario: 项目本地输入总量超过限制

- **WHEN** 本地文件与其它文档的合计输入字节数超过 32 MiB
- **THEN** 系统 SHALL 使本次生成失败，并保留此前已发布的项目 Skill

### Requirement: 本地文件失败必须保持原子发布

本地文件读取、JSON 解析、OpenAPI 版本校验或后续生成中任一步失败时，系统 SHALL 不替换已有 Skill，不发布部分目录，并应返回包含 service/document 上下文的本地读取错误。

#### Scenario: 本地文件缺失

- **WHEN** 配置指向不存在的本地 JSON 文件
- **THEN** 系统 SHALL 报告 `<serviceId>/<documentId>: LOCAL: ...` 类错误，并保留旧 Skill 不变

#### Scenario: 本地文件不是支持的 OpenAPI 文档

- **WHEN** 本地 JSON 文件内容没有 `openapi: 3.0.x` 或 `3.1.x` 根标记
- **THEN** 系统 SHALL 复用现有 OpenAPI 版本校验失败路径，使本次生成失败，并保留旧 Skill 不变

### Requirement: 本地文件参与现有生成与校验流程

成功读取的本地 JSON 文件 SHALL 作为普通文档字节参与现有 OpenAPI 解析、引用校验、项目文件生成、来源摘要和目录发布流程。HTTP(S) 文档生成行为 SHALL 保持不变。

#### Scenario: 合法本地文件生成项目 Skill

- **WHEN** 配置包含一个或多个合法的本地 OpenAPI JSON 文件
- **THEN** 系统 SHALL 像读取 HTTP(S) 文档一样生成并原子发布包含这些文档的项目 Skill

#### Scenario: HTTP 下载行为不被破坏

- **WHEN** 配置中的 `url` 仍为 `http://` 或 `https://`
- **THEN** 系统 SHALL 继续执行现有下载、超时、重定向拒绝和内容类型校验，不将其误判为本地路径
