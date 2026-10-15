# 本机 WeKnora 环境

部署目录：`/Users/stanley/Work/code/WeKnora`  
运行环境：Colima / Docker，ARM64  
镜像版本：`v0.8.2`（官方镜像标签带 `v`）

## 访问入口

- Web：<http://localhost:8081>
- 后端：<http://localhost:18080>
- 健康检查：<http://localhost:18080/health>

端口仅绑定 `127.0.0.1`。前端容器代理到后端容器内部的 8080，不使用被其他本机服务占用的宿主机 8080。

## 配置与数据

本地 `.env` 已生成独立数据库密码、Redis 密码、JWT 密钥和 32 字节 AES 密钥，文件仅当前用户可读写且被 Git 忽略。备份时保留 `.env` 中的 AES 密钥及数据卷；丢失密钥会影响已加密凭据的读取。

当前使用本地文件存储及 PostgreSQL 检索；没有安装 Ollama，也没有启用 MinIO、Neo4j、Langfuse 或 Agent Docker 沙箱。

`docker-compose.override.yml` 固定使用后端默认日志格式，避免宿主环境的 `LOG_FORMAT=json` 被解释为字面日志模板。Compose 会自动加载此本地覆盖文件。

容器数据卷包括 `weknora_postgres-data`、`weknora_data-files` 和 `weknora_docreader-tmp`。Redis 的持久化按仓库 Compose 配置；本说明不承诺停容器重建后保留所有队列状态。

## 使用

服务正常启动后，首次在页面注册自己的账号。创建知识库并配置远程对话模型和 Embedding 模型，通过连接测试后上传文档。环境部署不包含远程模型账号或 API Key。

使用发布镜像不会自动包含本地源码修改；二开后需要构建对应镜像再部署。

## 管理命令

本机已安装独立 `docker-compose` 命令，使用前进入上述部署目录：

```bash
# 启动已有镜像
docker-compose up -d --no-build

# 查看服务状态和日志
docker-compose ps
docker-compose logs --tail=100 app docreader

# 检查后端和前端代理
curl -f http://localhost:18080/health
curl -f http://localhost:8081/api/v1/auth/config

# 停止服务，保留命名数据卷
docker-compose down
```

不要在保留数据时使用 `docker-compose down -v`。Colima 需要处于运行状态；首次镜像下载及文档解析服务健康检查可能需要等待。
