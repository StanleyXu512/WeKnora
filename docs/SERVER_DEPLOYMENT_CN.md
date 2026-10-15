# WeKnora 开源版服务器部署与试用指南

更新日期：2026-10-15

适用场景：在一台 Linux 服务器上部署 WeKnora 开源版，体验文档知识库、RAG 问答和智能体功能。本指南面向 openEuler 24.03 LTS x86_64，采用 Docker Compose 部署核心服务和扩展组件，统一使用独立版 `docker-compose` 命令。应用和扩展组件均在容器内运行，MCP 与增强解析服务在 Docker 中构建；优先使用远程模型 API。部署平台本身不需要 GPU；模型服务、账号和调用费用需另行准备。

## 1. 部署方案与资源准备

| 项目 | 要求或建议 |
| --- | --- |
| 操作系统 | 受 Docker 支持的 Linux 发行版；使用受维护版本 |
| CPU / 内存 | 建议至少 4 核 / 8GB；不包含本地模型推理资源 |
| 磁盘 | 试用建议预留 50GB，可按镜像、文件和数据库规模扩容 |
| 软件 | Git、Docker Engine 20.10+、Docker Compose v2、OpenSSL、curl |
| 网络 | 能访问 GitHub、镜像仓库及模型 API；能从客户端访问服务器前端 |
| 模型 | 至少准备对话模型和 Embedding 向量模型；确认各自模型名、API 地址及 API Key |

磁盘 50GB 是试用建议，不是项目规定的最低值。增加知识图谱、追踪等组件需要额外资源。购买 ARM 服务器前，应核对所选 release 中所有镜像的架构支持。

默认架构：浏览器 → frontend（Nginx）→ app → PostgreSQL / Redis / docreader。PostgreSQL 同时承担默认检索功能，上传文件保存在 Docker 命名数据卷中。

| 服务 | 用途 | 默认宿主机访问 |
| --- | --- | --- |
| frontend | Web 界面、API 反向代理 | 80 |
| app | 后端 API | 本指南使用 18080，容器内部仍为 8080 |
| postgres | 数据库与检索 | 不发布端口 |
| redis | 异步任务、流管理 | 不发布端口 |
| docreader | 文档解析 | 不发布端口 |

## 2. 安装并检查基础软件

使用服务器发行版对应的 Docker 官方安装方法，安装 Engine 和 Compose 插件，不需要安装宿主机 Go、Node.js 或 Python。

- Docker 安装：https://docs.docker.com/engine/install/
- Compose 插件：https://docs.docker.com/compose/install/linux/

安装完成后执行：

```bash
docker --version
docker-compose version
git --version
openssl version
docker info
```

后续命令使用有 Docker 权限的账户执行；若当前账户没有权限，可按服务器管理规范使用 `sudo docker ...`。Docker 权限等同高权限主机访问，应只授予可信管理员。

### 2.1 当前服务器的安装注意事项

已知 node02 为 openEuler 24.03 LTS x86_64，原 Docker 为 19.03.5，未安装 Compose，软件源中没有 Compose 包。Docker 19.03.5 低于本仓库要求，且不支持当前编排使用的 `host-gateway`；部署前须升级 Docker，安装 Compose 本身不会升级 Engine。

升级前先执行只读检查，记录已有容器、安装来源和服务定义：

```bash
docker ps -a
docker version
command -v docker
rpm -qf "$(command -v docker)"
systemctl show docker -p FragmentPath -p ExecStart
```

根据 Docker 是 RPM 安装还是静态安装选择对应升级方法，并安排已有业务的维护窗口。不要直接卸载未知来源的容器引擎或删除 `/var/lib/docker`。openEuler 不能直接假定兼容任意 CentOS RPM；升级方案须按实际包来源确认。本指南不提供会覆盖已有运行环境的一键升级脚本。

若已升级 Engine、但仍没有 Compose，可安装固定版本的独立二进制（以下是 root 命令）：

```bash
curl -fL --retry 3 \
  https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 \
  -o /tmp/docker-compose
install -m 0755 /tmp/docker-compose /usr/local/bin/docker-compose
/usr/local/bin/docker-compose version
```

下载失败时在能访问官方 Releases 的机器下载同一文件，通过组织允许的渠道传入服务器再安装。此二进制需自行维护更新。若安装的是 Compose 插件，可将本文 `docker-compose` 等价替换为 `docker compose`。

## 3. 下载部署文件并选择版本

在计划长期保留的部署目录中执行：

```bash
git clone https://github.com/Tencent/WeKnora.git
cd WeKnora
cp .env.example .env
chmod 600 .env
```

为了可复现，建议从官方 Releases 选择一个稳定 release，检出该 release 的源码，并将 `.env` 中 `WEKNORA_VERSION` 设为其实际镜像标签。标签是否带 `v` 应以对应 release 为准，不要自行省略前缀。临时体验可以先使用模板的 `latest`。

如果要体验本仓库的本地修改，需要将修改后的部署文件或镜像交付服务器。官方镜像仅包含对应发布版本，不会包含本地尚未发布的代码。

## 4. 配置环境变量

编辑复制出的完整模板：

```bash
nano .env
```

以下是需要检查的关键字段，不要用此片段替换整个模板：

```dotenv
WEKNORA_VERSION=latest
GIN_MODE=release
LOG_LEVEL=info
TZ=Asia/Shanghai

FRONTEND_PORT=80
APP_PORT=18080
APP_HOST=app
DOCREADER_ADDR=docreader:50051

DB_DRIVER=postgres
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=REPLACE_WITH_DATABASE_PASSWORD
DB_NAME=WeKnora

REDIS_ADDR=redis:6379
REDIS_PASSWORD=REPLACE_WITH_REDIS_PASSWORD

RETRIEVE_DRIVER=postgres
STORAGE_TYPE=local
OLLAMA_OPTIONAL=true

JWT_SECRET=REPLACE_WITH_JWT_SECRET
SYSTEM_AES_KEY=REPLACE_WITH_AES_KEY
DISABLE_REGISTRATION=false
```

分别生成四个值并填入上述对应字段：

```bash
# DB_PASSWORD：将本次输出填入数据库密码
openssl rand -hex 24

# REDIS_PASSWORD：将本次输出填入 Redis 密码
openssl rand -hex 24

# JWT_SECRET：将本次输出填入 JWT_SECRET
openssl rand -hex 32

# SYSTEM_AES_KEY：将本次输出填入 SYSTEM_AES_KEY
openssl rand -hex 16
```

`SYSTEM_AES_KEY` 需要 32 字节字符串，上面的命令输出 32 个十六进制字符，符合这一要求。首次生成后妥善保存，升级时沿用原值，否则已有加密凭据无法解密。不要把 `.env`、API Key 或密钥提交到版本库。

`DB_HOST=postgres`、`REDIS_ADDR=redis:6379` 和 `APP_HOST=app` 是 Compose 内部服务地址，单机部署保持这些值。使用远程模型时，无需安装 Ollama；模型连接信息可在 Web 界面填写。

若 80 端口已被占用，可设置 `FRONTEND_PORT=8090`，相应访问地址变为 `http://服务器IP:8090`。服务器 8080 已被其他服务占用，本指南统一设置 `APP_PORT=18080`。修改它只改变宿主机映射，前端仍代理到 app 容器内部的 8080，`APP_BACKEND_PORT` 保持 8080。

## 5. 配置访问网络

在云安全组和服务器防火墙中允许客户端访问前端端口，试用时建议限制为自己的 IP 或内网访问。SSH 管理端口按原有运维规则保留。

浏览器通过 frontend 访问 API，通常不需要向公网开放 8080。不要向公网开放数据库、Redis、docreader 等内部服务。Docker 发布端口可能绕过部分主机防火墙规则，应同时核对云安全组及 Docker 网络规则。默认 Compose 的 app 端口发布在宿主机，若仅需本机诊断，可将 app 的端口映射改为 `127.0.0.1:18080:8080`。

长期使用或多人使用时，建议通过反向代理接入域名和 HTTPS。域名解析指向服务器，代理转发到前端端口；若使用聊天流式响应，应核对代理缓冲和超时设置。仅试用且无需公网入口时，可使用内网或 SSH 隧道访问。

## 6. 拉取并启动服务

在项目根目录执行：

```bash
# 检查配置能否解析，避免把包含密钥的完整配置打印出来
docker-compose config --quiet

# 下载镜像并启动，使用发布镜像，不触发源码构建
docker-compose pull
docker-compose up -d --no-build

# 等待核心服务进入 running / healthy 状态
docker-compose ps
```

首次下载镜像及 docreader 启动可能需要几分钟。验证后端和前端代理：

```bash
curl -f http://127.0.0.1:18080/health
curl -f http://127.0.0.1/api/v1/auth/config
```

若改了端口，请相应修改命令。健康接口预期返回 `{"status":"ok"}`，前端接口应返回正常的注册配置响应。

服务未就绪时查看日志：

```bash
docker-compose logs --tail=100 app docreader postgres redis
docker-compose logs --tail=100 frontend
```

## 7. 注册与设置管理员

浏览器打开 `http://服务器IP`（或修改后的前端端口），注册并登录。系统没有默认登录账号。

默认注册会创建个人工作空间，用户成为该空间 Owner。空间 Owner 与系统管理员是独立权限；如需体验平台管理功能，设置首个系统管理员：

1. 先注册目标账号。
2. 在 `.env` 中添加 `WEKNORA_BOOTSTRAP_SYSTEM_ADMIN_EMAIL=该账号邮箱`。
3. 执行 `docker-compose up -d --no-build app`，重新创建后端容器。
4. 重新登录，在设置中确认平台管理入口可用。

该引导只提升已存在账号，并且仅在部署尚无系统管理员时生效。确认完成后可以删除这项引导配置并重新应用；删除变量不会撤销已授予的管理员身份。

自己的账号准备完成后，可设置 `DISABLE_REGISTRATION=true` 并重新创建 app，关闭公开注册，后续通过邀请添加成员。

## 8. 配置模型并完成首次问答

### 8.1 准备模型连接信息

| 模型 | 是否必需 | 用途 | 需准备的信息 |
| --- | --- | --- | --- |
| 对话 LLM | 必需 | 生成回答、智能体推理 | 模型名、Base URL、API Key |
| Embedding | 必需 | 文档向量化与语义检索 | 模型名、Base URL、API Key、向量维度 |
| Rerank | 可选 | 检索结果重排 | 对应服务连接信息 |
| VLM / OCR | 按需 | 图片、扫描件识别 | 对应视觉模型或解析服务配置 |
| ASR | 按需 | 音频转写 | 对应语音模型配置 |

对话模型和向量模型可以来自不同供应商，不能假定同一个 API Key 同时提供两者。Base URL 按供应商说明及页面要求填写，避免重复添加 `/v1`。模型请求由服务器后端发起，连接测试通过才能说明部署侧可用。更换 Embedding 模型后需重新建立知识库索引。

### 8.2 功能验证

1. 新建普通文档知识库。
2. 在初始化向导中选择远程模型，填写对话模型和 Embedding 配置。
3. 分别点击连接测试，通过后保存。
4. 上传一份小型、含可复制文字的 PDF、Word 或 Markdown。
5. 等待文档状态变为“已完成”，确认有解析分块。
6. 打开对话，选择该知识库，询问一个文档中有明确答案的问题。
7. 确认回答正常、引用能打开并定位原文。

通过这一流程，表示登录、文件上传、文档解析、向量化、检索和问答链路正常。首次验证建议不用大文件或扫描件，以便先确认基础链路。

## 9. 完整扩展环境：全部通过 Docker 部署

### 9.1 范围与资源

本章开启仓库提供的全部可选 Compose profile：`full,milvus,weaviate,doris,odl-hybrid`。其中 `full` 包含 Neo4j、MinIO、SearXNG、Qdrant、Dex、Langfuse、沙箱镜像和 MCP，但不包含另外四个 profile。

完整组合建议从 16 核 / 64GB 内存 / 200GB 可用磁盘评估起步，属于本指南容量规划建议，不是保证值；本地模型、并发沙箱和文档处理会继续增加资源需求。仅 8GB 内存的服务器不适合同时运行全部组件。

“组件全部启动”和“每个业务功能可用”分别验收。多个检索引擎是可替代后端；均启动后仍需注册存储并选择使用。模型、IM 渠道、外部数据源需要各自凭据。当前 Docker 沙箱不支持图形桌面；要体验该能力需另行部署并接入 Cube/E2B 控制面与数据面，仓库未提供这两套平台的一键 Compose，因此本章不承诺纯本机 Docker 能覆盖图形桌面。

### 9.2 固定 profile 与 Docker socket 配置

在 `.env` 中新增或修改以下配置，同名字段保留一份：

```dotenv
COMPOSE_PROFILES=full,milvus,weaviate,doris,odl-hybrid
APP_PORT=18080
APP_BACKEND_PORT=8080
WEKNORA_SANDBOX_DOCKER_ENABLED=true

STORAGE_TYPE=minio
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY_ID=weknoraadmin
MINIO_SECRET_ACCESS_KEY=REPLACE_WITH_RANDOM_PASSWORD
MINIO_BUCKET_NAME=weknora
MINIO_USE_SSL=false

NEO4J_ENABLE=true
NEO4J_URI=bolt://neo4j:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=REPLACE_WITH_RANDOM_PASSWORD

SEARXNG_BIND=127.0.0.1
SEARXNG_PORT=8888
SEARXNG_SECRET=REPLACE_WITH_RANDOM_SECRET

# 保留默认检索；其他后端在设置中注册、验证后选择
RETRIEVE_DRIVER=postgres
QDRANT_HOST=qdrant
QDRANT_PORT=6334
MILVUS_ADDRESS=milvus:19530
WEAVIATE_HOST=weaviate:8080
WEAVIATE_GRPC_ADDRESS=weaviate:50051
WEAVIATE_SCHEME=http
DORIS_ADDR=doris-fe:9030
DORIS_HTTP_PORT=8030
DORIS_DATABASE=weknora
DORIS_USERNAME=root
DORIS_PASSWORD=

DOCREADER_ODL_HYBRID=docling-fast
DOCREADER_ODL_HYBRID_URL=http://odl-hybrid:5002
DOCREADER_ODL_HYBRID_MODE=auto
ODL_HYBRID_EXTRA_ARGS=--no-ocr

MCP_PORT=8082
MCP_SERVER_AUTH_TOKEN=REPLACE_WITH_RANDOM_TOKEN
# 第 9.7 节取得真实的工作空间 API Key 后填写
WEKNORA_API_KEY=
```

随机密码和 token 可分别运行 `openssl rand -hex 24`，SearXNG 密钥可用 `openssl rand -hex 32`；不要把占位符直接用于部署。Doris 与 Weaviate 当前示例属于内网测试配置，不能公开暴露未鉴权接口。

编辑 `docker-compose.yml` 的 app → volumes，取消下面这一行的注释；已有卷保持原样：

```yaml
      - /var/run/docker.sock:/var/run/docker.sock
```

实际 socket 不在该路径时，使用真实路径。此挂载授予应用控制宿主机 Docker 的权限，只用于可信、隔离的试用服务器。不要使用 `chmod 666` 修改 socket。入口脚本会处理应用用户的 socket 组权限。

`COMPOSE_PROFILES` 会让后续 Compose 命令沿用全部 profile。已部署环境保持原目录和项目名，避免误用新数据卷。操作前可运行 `ss -lntp` 核对端口占用；其他服务占用的端口只修改宿主机映射，不改变容器间地址。

### 9.3 Langfuse 完整配置

在 `.env` 中填写：

```dotenv
LANGFUSE_HOST=http://langfuse-web:3000
# 初次先留空；进入 Langfuse 项目生成真实密钥后填写
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_WEB_PORT=3000
LANGFUSE_NEXTAUTH_URL=http://SERVER_IP:3000
LANGFUSE_S3_MEDIA_UPLOAD_ENDPOINT=http://SERVER_IP:9100
LANGFUSE_DB_NAME=langfuse
LANGFUSE_REDIS_DB=1
LANGFUSE_CLICKHOUSE_USER=clickhouse
LANGFUSE_CLICKHOUSE_PASSWORD=REPLACE_WITH_RANDOM_PASSWORD
LANGFUSE_MINIO_USER=langfuseminio
LANGFUSE_MINIO_PASSWORD=REPLACE_WITH_RANDOM_PASSWORD
LANGFUSE_SALT=REPLACE_WITH_RANDOM_SECRET
LANGFUSE_ENCRYPTION_KEY=REPLACE_WITH_64_HEX_CHARACTERS
LANGFUSE_NEXTAUTH_SECRET=REPLACE_WITH_RANDOM_SECRET
```

将 `SERVER_IP` 换为客户端可达的服务器 IP 或使用对应 HTTPS 域名。`LANGFUSE_HOST` 是 app 使用的容器内部地址；`NEXTAUTH_URL` 和媒体上传 endpoint 是浏览器使用的地址，不能保留 localhost。Langfuse 的专用 MinIO 与业务 MinIO 是两套服务、独立卷和凭据。

`LANGFUSE_ENCRYPTION_KEY` 使用 `openssl rand -hex 32` 生成；SALT、NEXTAUTH_SECRET 可分别使用 `openssl rand -base64 32`。生成后保存，已有环境不要重新生成。其余密码可分别使用 `openssl rand -hex 24`。

启动后在 `http://服务器IP:3000` 注册 Langfuse 管理员，创建组织、项目和项目 API Keys。将真实的 Public Key / Secret Key 填入上述字段，执行 `docker-compose up -d --no-build app`。完成一次问答后，在 Langfuse 中确认产生 trace；只打开页面不算接入成功。

### 9.4 构建与启动所有组件

MCP 在本仓库只有 build 配置，ODL hybrid 只有本地镜像，不能对全部服务直接 `pull` 后就使用 `--no-build`。以下命令明确分开拉取与构建，不要求宿主机安装 Python、Java 或 Node.js：

```bash
# 检查包含全部 profile 的配置
docker-compose config --quiet
docker-compose config --services

# 拉取发布镜像，避免尝试拉取本地构建服务
docker-compose pull frontend app docreader postgres redis sandbox \
  searxng-init searxng minio neo4j qdrant milvus weaviate \
  doris-fe doris-be dex langfuse-db-init langfuse-clickhouse \
  langfuse-minio langfuse-worker langfuse-web

# 在 Docker 内构建这两个组件
docker-compose build mcp odl-hybrid

# 启动所有激活的 profile
docker-compose up -d --no-build
docker-compose ps -a
```

MCP 应在第 9.7 节填入 API Key 后再次重建应用配置。镜像构建需要访问基础镜像、Python 包仓库及解析模型制品源。Neo4j 首次加载 APOC 等组件也可能需要出网；以容器日志为准。

`sandbox` 是镜像准备服务，执行 `true` 后以状态 0 退出；`searxng-init`、`langfuse-db-init` 正常执行后同样退出。它们不要求持续 running。实际沙箱在会话触发时创建，不是启动一个常驻的 sandbox 服务就代表功能可用。

### 9.5 MinIO、知识图谱与联网搜索

**MinIO：** 打开 `http://服务器IP:9001`，使用配置的访问账号登录，确认或创建 `weknora` 桶（与 `MINIO_BUCKET_NAME` 一致）。上传新文件并检查桶中有对象。已有 local 存储文件不会因为修改 `STORAGE_TYPE` 自动迁移；保留原文件卷，旧数据需按实际存储配置迁移。使用 IM 外链时，另设 `APP_EXTERNAL_URL` 为客户端可达的 WeKnora 前端地址，并确认前端代理 `/r/`。

**Neo4j：** 打开 `http://服务器IP:7474`，验证账号与数据库就绪；在知识库启用实体/关系抽取，对测试文档重新解析，再验证图谱节点、关系及相关检索。已有数据卷中的数据库密码不会仅因修改环境变量而自动更新。

**SearXNG：** 在搜索服务设置中选择 SearXNG，Instance URL 填 `http://searxng:8080`，在智能体启用联网搜索。先测试：

```bash
curl -f 'http://127.0.0.1:8888/search?q=WeKnora&format=json'
```

再让智能体执行一次联网搜索并检查结果。容器启动不代表上游搜索引擎可达，需检查出网、代理及限流。无需将 8888 对公网开放。

### 9.6 检索后端与增强文档解析

在工作空间的检索引擎/向量存储设置中分别添加并测试：

| 引擎 | 容器内连接地址 |
| --- | --- |
| PostgreSQL | 默认已有，保持原配置 |
| Qdrant | `qdrant:6334`（gRPC），REST 为 `http://qdrant:6333` |
| Milvus | `milvus:19530` |
| Weaviate | HTTP `http://weaviate:8080`，gRPC `weaviate:50051` |
| Doris | MySQL `doris-fe:9030`，HTTP 端口 8030 |

地址按界面对应字段拆分填写。为各后端分别创建测试知识库、选择存储、上传文档并验证检索。仅设置连接地址不会自动切换知识库。不要将 `RETRIEVE_DRIVER` 一次设为所有引擎来代替逐个验收；该配置支持多驱动但写入会广播，任一后端异常都会增加排查难度。已有知识库切换存储后应重新入库或按对应迁移流程处理。

Doris FE/BE 首次启动可能需要较长时间，确认 BE 已加入集群并可用；失败时查看 `docker-compose logs --tail=150 doris-fe doris-be`，不要仅凭 FE 端口开放判断就绪。

ODL hybrid 已通过 Dockerfile 构建并启用，在知识库解析选项/解析规则选择 `opendataloader` 后，用一个版式复杂的 PDF 验证并检查 docreader、odl-hybrid 日志。当前 `--no-ocr` 面向数字 PDF，扫描件还需配置可用的 VLM/OCR 或按增强解析镜像要求启用 OCR，不能假定启动 hybrid 后自动具备所有识别能力。

### 9.7 MCP Server 与 Agent Docker 沙箱

**MCP Server：** 登录 WeKnora，在目标工作空间创建 API Key，填入 `.env` 的 `WEKNORA_API_KEY`；`MCP_SERVER_AUTH_TOKEN` 是另一枚独立 token，用来认证外部 MCP 客户端，不能混为一谈。执行：

```bash
docker-compose up -d --no-build mcp
docker-compose logs --tail=100 mcp
```

在支持 Streamable HTTP 的 MCP 客户端中添加 `http://服务器IP:8082/mcp`，认证头填写 `Authorization: Bearer <MCP_SERVER_AUTH_TOKEN>`。验证列出工具并查询一个有权限的知识库。外部客户端经 HTTPS 或可信内网访问该接口。文件上传工具默认禁用，若需要上传必须额外配置目录白名单和容器目录挂载。

**Docker 沙箱：** 确认 socket 已挂载、开关已启用，标准沙箱镜像已拉取。在空间的沙箱配置中选 Docker，daemon 使用 `unix:///var/run/docker.sock`，镜像填 `wechatopenai/weknora-sandbox:<与部署匹配的实际标签>`。保存并测试，再为智能体选择此配置，安装一个技能。若此前在系统设置中保存过关闭值，要先在系统设置开启，数据库值优先于环境变量。

验证一次文件生成、下载、后续对话读取同一文件，以及交互终端。用 `docker ps` 确认真实会话容器创建。此后端支持终端，不支持图形桌面。监控 `docker system df`，技能安装会产生快照镜像，清理前确认引用，不要直接批量 prune 所有镜像。

### 9.8 Dex 单点登录试用

Dex 已由 `full` 启动，但仓库 `misc/dex-config.yaml` 是开发示例，issuer 和 callback 的回环地址不能直接用于远程浏览器。要完成 SSO 验收，编辑该挂载文件：

- `issuer` 改为浏览器与 app 都能访问的同一地址，例如 `http://SERVER_IP:5556/dex`。
- `staticClients` 使用 id `weknora`，添加随机 `secret`。
- `redirectURIs` 改为实际前端地址加 `/api/v1/auth/oidc/callback`。
- 通过 Dex 的连接器接入实际身份源，或为其 password DB 添加测试用户；默认示例没有可直接登录的测试账号。
- 测试数据不需保留时可使用示例 memory storage；需长期保留身份状态时应按 Dex 支持的方式配置持久存储。

在 `.env` 增加：

```dotenv
OIDC_AUTH_ENABLE=true
OIDC_AUTH_ISSUER_URL=http://SERVER_IP:5556/dex
OIDC_AUTH_DISCOVERY_URL=http://SERVER_IP:5556/dex/.well-known/openid-configuration
OIDC_AUTH_PROVIDER_DISPLAY_NAME=Dex
OIDC_AUTH_CLIENT_ID=weknora
OIDC_AUTH_CLIENT_SECRET=REPLACE_WITH_DEX_CLIENT_SECRET
```

将地址及 secret 替换为真实配置，执行 `docker-compose restart dex`、`docker-compose up -d --no-build app`，验证 OIDC discovery、登录跳转和回调。HTTP 仅用于受控内网试用，长期使用配置 HTTPS。实际第三方身份源仍需账号和凭据，启动 Dex 容器不会自动接入企业 SSO。

### 9.9 端口与扩展验收

| 用途 | 宿主机端口 | 访问策略 |
| --- | --- | --- |
| Web / 后端诊断 | 80 / 18080 | Web 向试用用户开放，后端限制访问 |
| 业务 MinIO | 9000 / 9001 | S3 API / 控制台，限制可信客户端 |
| Neo4j | 7474 / 7687 | 管理界面 / Bolt，限制访问 |
| SearXNG | 127.0.0.1:8888 | 保持本机绑定 |
| Langfuse | 3000 | 向试用用户开放 |
| Langfuse MinIO | 9100 / 9101 | 9100 需浏览器上传可达，9101 为管理控制台 |
| MCP | 8082 | 鉴权并限制可信客户端 |
| Dex | 5556 | 浏览器与 app 均需可达 |
| Qdrant | 6333 / 6334 | 仅受控内网 |
| Milvus | 19530 / 9091 | 仅受控内网 |
| Weaviate | 9035 / 50052 | 仅受控内网 |
| Doris | 8030 / 9030 / 8040 | 仅受控内网 |
| ODL hybrid | 不发布宿主机端口 | docreader 访问 `odl-hybrid:5002` |

Neo4j、Milvus、Weaviate、Dex 部分宿主机端口在 Compose 中写死，冲突时编辑对应 `ports` 左侧值；不要修改右侧容器端口。涉及 issuer、浏览器 URL 的配置也要同步修改。

- [ ] 所有常驻扩展服务正常，一次性初始化容器退出码为 0。
- [ ] MinIO 可上传并读取新文件，旧存储数据仍可访问。
- [ ] 图谱有节点与关系，图谱相关检索正常。
- [ ] 智能体实际执行 SearXNG 联网搜索。
- [ ] Langfuse 项目收到问答 trace，媒体上传地址从浏览器可达。
- [ ] MCP 客户端能鉴权、列工具、访问指定知识库。
- [ ] Agent 创建真实 Docker 会话容器，技能、终端、文件下载可用。
- [ ] 各检索后端分别通过文档入库和检索测试。
- [ ] 增强 PDF 解析成功；扫描件 OCR 按需另行配置并验证。
- [ ] Dex 的身份源、登录跳转和回调完成验证。

本指南中远程模型 API 是推理来源，平台运行组件均容器化。如要求模型服务也完全本地部署，需另行确定 GPU、显存、模型及许可证，再提供对应容器编排；现有服务器信息不足以给出可运行的本地多模态模型组合。

## 10. 日常维护与数据保留

```bash
# 查看服务状态
docker-compose ps

# 跟踪后端日志，按 Ctrl+C 退出，不影响服务
docker-compose logs -f --tail=100 app

# 修改 .env 或 Compose 后应用配置
docker-compose up -d --no-build

# 仅重启现有后端，不重新读取修改后的 .env
docker-compose restart app

# 停止服务并保留命名数据卷
docker-compose down
```

完整扩展环境通过 `.env` 的 `COMPOSE_PROFILES` 保持激活项；后续维护在相同项目目录使用同一 `.env`。MCP 和 ODL hybrid 的更新需重新构建，不能只执行全局 pull。不要在需要保留数据时执行 `docker-compose down -v`，它会删除命名数据卷。

备份应至少覆盖：`.env` 中的密钥、部署配置、PostgreSQL 数据、本地文件存储卷，以及启用的可选存储服务。备份文件应放在服务器之外并限制访问。数据库使用 PostgreSQL 的备份工具；不要将运行中数据库卷的直接复制视为可靠备份。需要整套一致快照时，先停止应用写入，结合数据库备份和文件卷备份，并验证恢复流程。

升级步骤：

1. 阅读目标 release 的升级说明并完成备份。
2. 获取该 release 的部署文件，检查与现有配置的差异。
3. 将 `WEKNORA_VERSION` 修改为对应实际镜像标签，保留原密钥及数据卷。
4. 核心环境执行 `docker-compose pull` 和 `docker-compose up -d --no-build`；完整扩展环境按第 9.4 节分别拉取、构建，再启动。
5. 再次验证健康接口、登录、文档上传及问答。

数据库扩展升级可能有额外操作，应遵循对应版本说明。迁移后不要假定只换回旧应用镜像即可回滚，必要时按已验证的备份恢复方案处理。

## 11. 常见问题

| 现象 | 排查方法 |
| --- | --- |
| 镜像拉取失败 | 检查 DNS、镜像仓库访问、服务器出网及 release 标签是否存在；国内或企业内网使用组织认可的镜像代理 |
| 前端打不开 | 检查 frontend 状态、前端端口占用、安全组、防火墙及客户端地址 |
| 页面 502 | 查看 app 健康状态和日志；检查 `APP_HOST` 与容器内部目标端口，单机默认 `app:8080` |
| app 无法启动 | 检查数据库和 Redis 是否就绪、密码是否匹配、JWT 与 AES 密钥是否填写，以及迁移日志 |
| 更改数据库密码后连接失败 | 已初始化的 PostgreSQL 卷不会因修改初始化环境变量而自动修改数据库用户密码，需同步调整真实用户密码 |
| 注册入口消失 | 检查 `DISABLE_REGISTRATION` 和系统设置中的注册模式 |
| 修改环境变量未生效 | 使用 `up -d` 重建而非仅 `restart`；部分系统设置存在数据库覆盖值，应在系统管理页检查 |
| 模型测试失败 | 检查模型名、地址、Key、额度及服务器出网；区分 LLM 与 Embedding 接口 |
| 文档解析失败或长期处理中 | 查看 docreader / app 日志，检查内存、文件类型、模型请求及队列状态；先用小型纯文本文件复测 |
| 扫描 PDF 没有内容 | 按解析引擎要求配置 OCR / VLM；普通文本解析不能保证识别扫描图片 |
| 重建后数据消失 | 检查是否删除数据卷、修改 Compose 项目名或切换到另一部署目录，从而使用了新卷 |

如果使用宿主机 Ollama：当前 Compose 提供 `host.docker.internal` 到宿主机网关的映射，容器内连接使用 `http://host.docker.internal:11434`。Ollama 需监听容器可达接口，并允许 Docker 网络访问；不要把未鉴权的模型端口暴露到公网。容器内的 `localhost` 指向该容器自身。

## 12. 部署验收清单

- [ ] 核心服务 running / healthy，后端健康接口正常。
- [ ] 客户端可访问前端并注册、登录。
- [ ] 对话模型、Embedding 模型连接测试通过。
- [ ] 小型测试文档解析完成并生成分块。
- [ ] 知识库问答正常，引用可打开。
- [ ] 需要平台管理功能时，首个系统管理员已配置。
- [ ] 密钥已保存，内部服务端口访问已限制。
- [ ] 已记录使用的 release、镜像标签、部署目录和备份位置。

## 13. 参考资料

- [官方仓库](https://github.com/Tencent/WeKnora)
- [官方 Releases](https://github.com/Tencent/WeKnora/releases)
- [官方中文 README](https://github.com/Tencent/WeKnora/blob/main/README_CN.md)
- [本仓库安装说明](../website-docs/01-getting-started/02-installation.md)
- [配置详解](../website-docs/01-getting-started/04-configuration.md)
- [快速上手](../website-docs/01-getting-started/03-quickstart.md)
- [系统管理员配置](../website-docs/03-features/20-platform-admin.md)
- [沙箱部署](../website-docs/06-development/04-sandbox-deployment.md)

本指南依据当前仓库配置编写，未在目标服务器上实际执行。部署时以所选 release 的模板、镜像标签和升级说明为准。
