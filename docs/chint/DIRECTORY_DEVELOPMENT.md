# CHINT 第一批开发：组织人员主数据导入

日期：2026-10-11。开发分支 `chint`；源码增量，尚未部署到现有 localhost:8081 环境。

## 已实现范围

- 系统管理员入口：“设置 → 系统管理 → 集团组织与人员”。
- JSON 上传/粘贴、校验预览、正式导入、分页组织/人员/批次/账号绑定/飞书身份/人工停用列表。
- 组织父子关系、人员归属、状态、重复 ID、飞书身份冲突检查。
- 全批事务写入，失败回滚；按 source_id + batch_id 幂等，按 source_id + sequence 防止旧批次覆盖。
- 现有本地普通账号与集团人员显式绑定；不自动创建账号或授予空间角色。
- 每日从部署管理员指定的本地文件读取主数据，默认上海时间 02:00；可单独关闭定时任务。
- 人工紧急停用与恢复独立保存，不被每日导入清除；记录操作者和操作原因。
- 已绑定普通用户的后续受保护请求检查当前人员、所属组织及人工停用状态；旧 JWT 也受检查。数据库校验失败时拒绝该请求。

组织人员表、批次表、飞书身份、账号绑定、人工停用和操作记录均使用 `chint_directory_*` 独立表，不写入上游 organizations 表，不改变既有用户密码和角色。系统管理员账号不允许绑定，并保留管理员恢复入口。

## 启用及配置

现有官方镜像不包含本次源码。需要构建并运行此分支后端和前端；不要仅在旧镜像中添加配置就期望出现新功能。当前开发未替换原环境。

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| CHINT_ENABLED | false | 开启后初始化独立 CHINT 表并开放管理 API |
| CHINT_DIRECTORY_IMPORT_FILE | 空 | 容器/服务器内绝对路径；为空时只允许手动导入 |
| CHINT_DIRECTORY_IMPORT_CRON | `0 2 * * *` | 五字段 cron；设置为空关闭自动导入 |
| CHINT_DIRECTORY_IMPORT_TIMEZONE | Asia/Shanghai | 调度时区 |

Docker 部署须在自建镜像服务的 environment 中显式传入上述变量，并只读挂载导入目录；仅编辑 .env 不会使当前 Compose 自动传入新增变量。

文件来源与集团中台导出协议待确认。首版以受控本地文件作为适配入口，不支持让普通 API 客户端指定任意服务器文件路径。生产者先写临时文件，完成后原子重命名覆盖目标文件；只读挂载所在目录可以接收文件替换，单文件 bind mount 需验证宿主替换后的可见性。

默认关闭时不创建 CHINT 表，也不启用人员状态检查。首次启用采用独立表的 additive AutoMigrate 引导；后续数据结构升级需显式 CHINT 版本化迁移，不复用上游迁移编号。

## 导入契约

[合成样例](./samples/directory.json) 仅供开发验证，使用独立 demo-masterdata 来源，不能当真实人员导入。

- source_id：权威数据来源稳定 ID；batch_id：本批稳定 ID。
- sequence：来源内递增正整数；不得因导出进程重启而重置。
- mode：full 或 delta；complete 必须为 true。
- organizations：完整组织记录，含 id/name/parent_id/status。
- people：完整人员基本记录，含 id/name/org_id/status。
- status 只允许 active/inactive。标识最长 128 位，支持字母、数字及 `_ . : @ / -`，必须以字母或数字开头。
- feishu_identities：租户 ID + 租户内用户 ID；同租户身份在同一来源内不能属于多人。一个人可以在三个租户有不同账号。
- 省略 feishu_identities 或为 null 时保留旧映射；显式 `[]` 清空；提供数组时替换该人员映射。
- full 也不会按缺失记录自动删除或停用。离职及组织停用需明确记录；停用组织时，有效子组织/人员必须同时调整。
- 首版每人单个主归属组织。多组织任职、用户组和复杂岗位关系需要后续模型扩展。
- 最多 20,000 条组织+人员记录、10 MiB JSON，每人最多 32 个飞书身份。暂不支持 Excel/CSV。

校验不通过整批拒绝，不部分生效；有效来源及批次 ID 的拒绝报告会保存。更正拒绝批次时使用新 batch_id；失败批次不推进已应用 sequence。校验预览不写库，正式导入重新校验，预览不能替代事务提交时的检查。

批次内容是规范化结构的摘要，数组顺序变化会产生不同摘要。同 batch_id 不同摘要返回 409；同批次同内容返回原报告，不重写数据。同步文件未变化时每日任务只重放原报告。

## 管理接口

统一前缀：`/api/v1/system/admin/chint/directory`。沿用现有 Bearer 认证，必须是系统管理员；API Key 不开放本组管理功能，普通组织管理员不能管理全集团主数据。

| 方法与路径 | 功能 |
| --- | --- |
| GET /status | 启用、调度、最近文件任务状态；不暴露服务器文件路径 |
| POST /imports?dry_run=true | 预览，返回 validated/rejected 报告 |
| POST /imports?dry_run=false | 正式导入，返回 applied/rejected 或原批次报告 |
| GET /imports | 批次及最多前 200 项校验问题 |
| GET /organizations、/people | 目录列表，可按 source_id 过滤 |
| GET /identities | 飞书身份，可按 source_id、tenant_id 过滤 |
| GET /bindings | 本地账号绑定 |
| PUT /bindings | source_id、person_id、user_id 显式绑定 |
| GET /suspensions | 人工停用状态 |
| PUT /suspensions | source_id、person_id、active、reason；active=true 停用，false 解除人工停用 |

列表支持 limit（1–200，默认 50）及 offset；首版后台每页 50 条。合法的校验请求返回 HTTP 200，通过 data.status/issue_count 判断结果；格式/参数错误 400、超大请求 413、批次冲突 409、权限拒绝 403、内部错误 500。

绑定及停用操作写入独立操作记录表；统一系统审计 UI 和保留策略尚待接入。定时文件无法读取或 JSON 无效时在状态与服务器日志反映，因无法识别可靠批次 ID，不创建虚假业务批次记录。

## 权限边界及未实现事项

本批仅是组织人员底座，不代表集团资产权限体系已完成。目录导入不会创建知识空间或共享关系；飞书身份登记不会自动采集文档或授予源 ACL 权限。

状态检查覆盖经过现有 Auth 中间件的本地用户后续请求。匿名/签名下载、已开始的流、外部 API Key 主体、IM 入口及已交付下游副本，需要后续统一授权与撤权阶段分别接入，不能据此宣称所有知识出口已撤权。登录/刷新端点仍沿用本地认证，可能签发令牌，但被停用的已绑定普通账号后续受保护请求会拒绝。

系统管理员保留恢复入口；未绑定的本地账号维持现有行为。OAuth2 后补；三租户飞书凭据、采集范围、连接检查和同步任务后台管理属于下一批开发。当前并未实现集团跨组织内容共享、ELT、发布及集团 Open API。

## 验证

- 独立模块：`go test -race ./internal/chint/directory`。
- 权限接入：`go test ./internal/router -run '^TestCHINT'`。
- 注入容器编译：`go test ./internal/container -run '^$'`。
- PostgreSQL 并发验证：向临时数据库设置 CHINT_TEST_POSTGRES_DSN 后，运行 `go test -race ./internal/chint/directory -run '^TestPostgresConcurrentImport$'`；不可指向生产数据库。
- 前端：设置权限与路由回归、新页面类型检查及独立构建；完整前端仍需取得锁定的 XLSX 包。

具体执行结果见 [本批验证记录](./DIRECTORY_VALIDATION.md)。
