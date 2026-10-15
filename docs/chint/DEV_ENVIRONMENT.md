# CHINT 本地开发验证环境

入口：http://127.0.0.1:5174/chint-dev.html

后端：http://127.0.0.1:18081；独立 PostgreSQL：127.0.0.1:15433。

该入口是组织人员模块的开发工作台，使用正式后端接口及实际 Directory 组件，并非完整平台首页。已启用组织人员导入、账号绑定、人工停用及查询功能。原 localhost:8081 环境保持独立，模型配置和业务数据没有复制。

开发管理员凭据保存于本机 `.local/chint-dev/LOGIN.txt`，该目录已忽略，不应提交到仓库。

验证导入：下载合成示例 → 选择 JSON 文件或粘贴内容 → 校验批次 → 正式导入 → 查看组织、人员和导入记录。

账号绑定需要已有普通账号的 ID，系统管理员不可绑定。飞书身份页目前用于查看主数据中的身份映射，不包含飞书文档连接器。

定时导入配置为每天 02:00（Asia/Shanghai），读取 `.local/chint-dev/imports/directory.json`。需先提供该文件；页面上的手动导入无需此文件。

完整前端安装仍受锁定的 SheetJS 下载地址访问失败影响，本入口避开未涉及的表格预览模块，未修改 SheetJS 版本。

本次已验证真实后端登录、管理员权限、模块状态接口，并在浏览器实际打开组织人员页面。后端日志位于 `.local/chint-dev/backend.log`。数据库使用 Docker 卷 `chint-dev-postgres-data` 保存。

## CHINT 方案 A 实际前端（2026-10-15）

完整 Vue 平台入口：http://127.0.0.1:5175/platform/knowledge-bases 。使用相同开发管理员账号，连接独立 CHINT 后端 18081。原 8081 部署保持不变。

启动完整前端：在 frontend 目录执行 `VITE_DEV_PROXY_TARGET=http://127.0.0.1:18081 npm run dev -- --host 127.0.0.1 --port 5175 --strictPort`。后端和开发数据库也需要运行。

此入口已接入品牌蓝顶栏、白色侧栏、品牌 Token 与 TDesign 主题映射、主导航本地图标，以及知识库卡片和列表容器样式。保留上游路由及业务组件，不将静态预览的示例数据接入真实系统。组织人员管理在「设置 → 集团组织与人员」。

CHINT Token 本地副本：frontend/src/assets/chint/tokens.css；TDesign 适配集中在同目录 theme.css；图标使用 public/chint 下的本地 Remix Icon 4.5.0。深浅色沿用现有主题偏好。

此前 SheetJS 下载阻塞已解除：已从官方地址取得 package-lock 锁定的 0.20.2 包并校验 SHA512，未更换依赖版本。
