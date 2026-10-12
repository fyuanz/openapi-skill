# Spec Delta

## ADDED Requirements

### Requirement: 本地 CLI 调用不依赖全局命令

Node 生成的 SKILL.md SHALL 说明 CLI 随 npm 包安装而非随 Skill 生成，指导从安装包的项目根目录调用本地脚本，并以当前 Skill 的绝对目录作为搜索目标。MUST NOT 仅因裸命令不在 PATH 中而断言 CLI 不可用。指引 SHALL 区分命令工作目录与 Skill 文件相对路径，保留工具缺失时的文件搜索。

#### Scenario: 本地包存在但未全局安装
- **WHEN** 项目已安装 openapi-skill，而普通 shell 找不到同名命令
- **THEN** 模型按指引调用项目本地脚本获得分页结果，无需全局安装或下载包

#### Scenario: Skill 输出位于自定义目录
- **WHEN** 当前 Skill 目录位于项目之外且路径包含空格
- **THEN** 指引中的绝对目标路径能定位正确 Skill，结果文件路径仍相对该 Skill 目录
