# Maven Central 发布与使用

发布坐标为 `io.github.fyuanz`，最新正式版本为 `1.1.0`，许可证为 MIT。
Java 包名继续使用 `com.smartdoc.agent`；Maven 坐标迁移不改变 Java API。

`1.1.0`（2026-09-14 发布）包含 `outputMode=service|aggregate|both` 多服务汇总配置。
`1.0.0`（2026-09-11 发布）只支持单服务配置；两个正式版本均不可覆盖。
当前 Git 源码即为 `1.1.0` 发布版本；后续变更需要新版本和对应 Git 标签。配置见[中文 README](../README.md)。

| 构件 | 用途 |
| --- | --- |
| `io.github.fyuanz:smart-doc-agent:1.1.0` | 父 POM，提供公共版本和发布元数据 |
| `io.github.fyuanz:smartdoc-agent-core:1.1.0` | 离线 OpenAPI 转 Skill、汇总装配与安全发布 |
| `io.github.fyuanz:smartdoc-agent-maven-plugin:1.1.0` | Maven `generate-skill` 目标（含单服务/汇总/共存） |

## 在服务中使用

发布到 Central 后无需添加额外仓库。将插件配置在服务的唯一生成责任模块；下面沿用本仓库
SpringDoc 测试项目的身份和目录。实际服务应调整身份、路径和 phase。

```xml
<plugin>
    <groupId>io.github.fyuanz</groupId>
    <artifactId>smartdoc-agent-maven-plugin</artifactId>
    <version>1.1.0</version>
    <inherited>false</inherited>
    <executions>
        <execution>
            <id>update-generated-skill</id>
            <phase>verify</phase>
            <goals><goal>generate-skill</goal></goals>
        </execution>
    </executions>
    <configuration>
        <serviceId>springdoc-multi-package</serviceId>
        <skillName>springdoc-multi-package-api</skillName>
        <documentsDirectory>${project.build.directory}/generated-openapi</documentsDirectory>
        <requireCurrentBuildDocuments>true</requireCurrentBuildDocuments>
    </configuration>
</plugin>
```

该片段消费已有 JSON。SpringDoc 导出必须在同次构建的更早阶段完成；完整的启动、导出、停止配置见
[测试项目 POM](../testbeds/springdoc-multi-package/pom.xml) 和
[构建/Skill 使用说明](../testbeds/springdoc-multi-package/README.md)。运行时样例使用 `mvn verify`，
普通 `compile`、`package` 不会执行到这个目标。输出默认在
`target/generated-resources/smartdoc/<skillName>/`。

## 维护者发布

只发布根 reactor 的父 POM、core 和 Maven plugin。测试项目保持独立，不能部署到 Central。
普通构建不激活发布 profile：

```powershell
mvn -B clean test
```

`central-release` profile 绑定源码包、Javadoc 包、PGP 签名和 Central Publishing 插件。
GPG 插件使用 Java BC 签名器，从 `MAVEN_GPG_KEY` 读取导出的私钥，
从 `MAVEN_GPG_PASSPHRASE` 读取口令；可用 `MAVEN_GPG_KEY_FINGERPRINT` 指定密钥。
认证使用 Maven settings 中的 `central` server：

```xml
<settings xmlns="http://maven.apache.org/SETTINGS/1.2.0">
    <servers>
        <server>
            <id>central</id>
            <username>${env.CENTRAL_USERNAME}</username>
            <password>${env.CENTRAL_PASSWORD}</password>
        </server>
    </servers>
</settings>
```

配置好环境变量和项目外的 settings 后，先执行签名构建、检查产物，再发布：

```powershell
mvn -B -Pcentral-release -s <private-settings.xml> clean install
mvn -B -Pcentral-release -s <private-settings.xml> deploy
```

`deploy` 会上传、自动发布并等待 `PUBLISHED`；成功本地构建或上传成功均不等于已经公开发布。
请求超时后先用已有 deployment ID 查询状态，避免重复上传。
Central 正式版本不可覆盖；后续改动需要新版本和对应 Git 标签。

本机已经在用户目录 `.m2/smartdoc-central/` 建立 settings、Windows DPAPI 加密凭据、加密口令和
`invoke-release.ps1` 辅助脚本。它支持 `-Phase install`、`-Phase deploy` 和可选的 `-Clean`，
从本机密钥环临时导出密钥至进程环境，退出时清理相关环境变量。文件不属于 Git 项目。
DPAPI 文件绑定当前 Windows 用户；迁移机器时应单独安全备份密钥和可恢复的口令。

发布公钥指纹：`B8EDC9D7B1AEBDCA56A1DA28FD9316D8966A3116`，身份
`fyuan <624728873@qq.com>`，已上传 `keyserver.ubuntu.com`，有效期至 2028-09-10。

参考：[Central 发布要求](https://central.sonatype.org/publish/requirements/)、
[Central Maven 插件](https://central.sonatype.org/publish/publish-portal-maven/)、
[Maven GPG 签名器](https://maven.apache.org/plugins/maven-gpg-plugin/sign-mojo.html)。
