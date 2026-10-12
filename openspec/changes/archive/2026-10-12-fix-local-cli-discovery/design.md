# Design

## Context

CLI 随 npm 包分发，生成目录只包含 Skill 和 references。项目本地安装的 bin 不必在普通 shell PATH 中。

## Goals / Non-Goals

提供不依赖全局 PATH、包管理器或在线安装的本地调用路径。不给 Skill 复制脚本，不假设输出目录深度或包管理器，不自动安装依赖。

## Decisions

从安装了 openapi-skill 的项目根目录调用 node node_modules/openapi-skill/dist/cli.js，--skill 使用当前 Skill 的绝对目录。pnpm 项目可使用 pnpm exec openapi-skill 替代相同前缀。查找本地包后才判断工具缺失；文件检索与返回路径始终相对 Skill 目录。此规则适用自定义输出、外部 Skill 和含空格路径。

## Risks / Trade-offs

项目包缺失或 Node 不可用时仍使用文件索引。新模板需升级包后重新生成 Skill 才能生效。

## Migration Plan

先新增失败测试，再修正模板；完整测试和打包预检后同步规格、归档、提交 main。版本为 2.2.2，维护者发布 npm。
