# Spec Delta

## Purpose

定义 Node CLI 将同一份生成 Skill 安全分发到一个或多个 Agent 输出目录时的配置兼容性、校验边界、独立原子发布语义和可观测结果。

## ADDED Requirements

### Requirement: 配置一个或多个输出目录
系统 SHALL 允许顶层 `output` 为一个非空路径字符串或包含 1 至 8 个非空路径字符串的数组；省略 `output` 时 SHALL 使用 `.agents/skills` 作为唯一输出父目录。现有字符串配置的解析和发布行为 SHALL 保持兼容。

#### Scenario: 使用现有字符串配置
- **WHEN** 用户将 `output` 配置为 `.codex/skills`
- **THEN** 系统仅将生成的 Skill 发布到项目根目录下的 `.codex/skills/<skillName>`

#### Scenario: 使用多目录配置
- **WHEN** 用户将 `output` 配置为 `[".codex/skills", ".trae/skills"]`
- **THEN** 系统将两个条目按声明顺序解析为项目根目录下的两个输出父目录

#### Scenario: 省略输出配置
- **WHEN** 用户没有配置 `output`
- **THEN** 系统仅使用项目根目录下的 `.agents/skills` 作为输出父目录

#### Scenario: 拒绝无效数组
- **WHEN** `output` 是空数组、超过 8 个条目或包含非字符串或空白路径
- **THEN** 系统 SHALL 在读取 OpenAPI 输入或写入文件前报告配置错误

### Requirement: 输出目标必须安全且互不冲突
系统 SHALL 将每个相对路径基于 CLI 项目根目录解析为规范化绝对路径，并 SHALL 在任何发布前拒绝文件系统根目录、规范化后重复的目标以及互为祖先与后代的输出父目录。路径相等判断 SHALL 遵循运行平台的大小写语义。

#### Scenario: 拒绝重复目标
- **WHEN** 两个配置条目规范化后指向同一个输出父目录
- **THEN** 系统 SHALL 报告配置错误且不发布任何目标

#### Scenario: 拒绝嵌套目标
- **WHEN** 一个输出父目录是另一个输出父目录的祖先
- **THEN** 系统 SHALL 报告配置错误且不发布任何目标

#### Scenario: 接受互不冲突的目标
- **WHEN** 所有输出父目录规范化后唯一、非根目录且互不嵌套
- **THEN** 系统 SHALL 保留声明顺序供后续发布和结果报告使用

### Requirement: 生成一次并逐目标独立发布
系统 SHALL 对一次运行只读取一次完整 OpenAPI 输入并生成一次完整 Skill 文件集合，然后将该文件集合分别发布到每个已解析输出父目录。每个目标 SHALL 保持现有的完整树校验、独立暂存、备份和原子替换保障。

#### Scenario: 所有目标发布成功
- **WHEN** 同一份有效 Skill 文件集合可成功发布到全部配置目标
- **THEN** 每个目标的 `<skillName>` 目录 SHALL 包含相同的完整生成文件集合

#### Scenario: 更新时移除陈旧文件
- **WHEN** 一个目标中已有生成器拥有的旧 Skill 且新文件集合不再包含其中某个文件
- **THEN** 该目标 SHALL 通过完整目录替换移除陈旧文件而不产生新旧混合树

### Requirement: 多目标发布不构成整体事务
系统 SHALL 将每个输出目录视为独立原子发布单元，MUST NOT 承诺多个目录之间的整体原子性或跨目录回滚。系统 SHALL 按声明顺序尝试所有目标；若一个或多个目标失败，运行 SHALL 失败，成功目标 SHALL 保持已发布状态，失败目标 SHALL 保持其原有完整 Skill 或保持不存在。

#### Scenario: 后续目标失败
- **WHEN** 第一个目标发布成功而第二个目标在替换前失败
- **THEN** 运行 SHALL 报告失败，第一个目标保持新版本，第二个目标保持原有完整版本或不存在

#### Scenario: 中间目标失败后继续尝试
- **WHEN** 三个目标中的第二个目标发布失败且第三个目标可正常发布
- **THEN** 系统 SHALL 继续尝试第三个目标，并在最终失败结果中区分成功和失败目标

### Requirement: 报告全部输出结果并保持单目标兼容
程序化运行结果 SHALL 提供按声明顺序排列的全部成功 Skill 目录，并 SHALL 保留指向第一个目录的单数兼容字段。全部目标成功时，CLI SHALL 输出所有生成目录；存在失败时，诊断 SHALL 标识目标级成功、失败与错误摘要，且 MUST NOT 泄露 OpenAPI 文本、URL 凭据或其他源内容。

#### Scenario: 程序化多目标成功结果
- **WHEN** 两个输出目标均发布成功
- **THEN** 运行结果的复数目录字段包含两个最终 Skill 目录，单数兼容字段等于第一个目录

#### Scenario: CLI 多目标成功输出
- **WHEN** CLI 成功发布到多个目标
- **THEN** 标准输出列出每个最终 Skill 目录以及本次服务数、文档数和单份 Skill 文件数

#### Scenario: CLI 部分失败诊断
- **WHEN** 至少一个目标发布失败
- **THEN** CLI 使用失败退出码并报告各目标状态，而不输出源文档内容或带凭据的来源地址

### Requirement: 以补丁版本发布能力
包含该能力的 Node 包 SHALL 将版本设置为 `2.1.2`，并 SHALL 在面向用户的中英文配置文档中说明字符串和数组两种 `output` 形式及部分成功语义。

#### Scenario: 校验包元数据和文档
- **WHEN** 对候选发布包执行元数据与文档检查
- **THEN** 包版本为 `2.1.2`，且中英文文档均包含多输出示例和非整体原子性说明
