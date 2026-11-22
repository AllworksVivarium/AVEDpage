# 服务器部署与迁移

本指南适用于支持 Docker Compose 的 Linux 服务器。操作在目标服务器的终端执行；路径、域名与服务名称按部署环境配置。

## 准备

- 安装 Docker Engine、Docker Compose 和反向代理服务。
- 准备玩家域名、管理域名和 HTTPS 证书。
- 在防火墙或云平台安全组开放 HTTP、HTTPS，并设置运维访问来源。
- 为程序、数据库、上传素材和备份预留空间。

## 首次安装

```sh
git clone https://github.com/AllworksVivarium/AVEDpage.git AVED
cd AVED
cp .env.example .env
sudo install -d -o 1000 -g 1000 -m 750 data
```

按 `.env.example` 的字段填写运行配置。管理员初始化凭据与会话密钥通过部署环境单独配置，文件权限设置为仅运维账号可读。

```sh
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:4173/api/health
```

仓库 Compose 配置将服务发布至服务器回环地址 `127.0.0.1:4173`，数据库目录挂载到 `data/`。

## 域名与 HTTPS

将域名 DNS 记录更新为目标服务器地址，配置反向代理到本地服务。现有代理片段可参考 `deploy/nginx-location.conf`，根据实际域名检查玩家入口和管理入口。

申请或迁移 HTTPS 证书，检查自动续期。启用 HTTPS 后按环境设置安全 Cookie 和可信代理地址，再检查两类账号的登录流程。

## 更新

发布前确认提交范围、现有每日及五日滚动快照和数据库完整性检查结果，并记录当前代码版本。快照由 `deploy/daily-maintenance.py` 管理，发布复用已有滚动快照。

```sh
git pull --ff-only origin main
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:4173/api/health
```

`deploy/update.sh` 提供带进程锁、快进更新和健康检查的更新入口。自动更新服务的工作目录与权限按目标机器配置。

发布核验包括部署提交、容器状态、玩家和管理入口、接口响应及变更静态资源的版本。

## 迁移

1. 记录代码提交、运行配置、域名、反向代理和定时任务。
2. 在维护窗口暂停写入，使用 SQLite backup 或 `VACUUM INTO` 创建一致性备份，执行完整性检查。
3. 通过受控渠道迁移运行配置、数据目录、上传素材和备份。
4. 在目标服务器恢复文件权限，启动对应代码版本并检查数据。
5. 验证登录、内容读取、账户流水和主要交互。
6. 切换 DNS，检查 HTTPS 与定时任务，保留旧环境快照用于回滚。

## 日常维护

定期检查磁盘、备份可恢复性、容器日志和数据库完整性。日志与备份采用明确的保留期限；报警收件方式通过部署环境配置。
