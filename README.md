# AVED 玩家终端与管理员管理端

东京 AWS 部署、管理员设置、域名和自动更新的分步说明见 [AWS-DEPLOY.md](AWS-DEPLOY.md)。本次版本改动见 [LOCAL-CHANGES.md](LOCAL-CHANGES.md)。GitHub 是共同源码；服务器更新后才会生效。

这是可部署到 Linux 或其他支持 Docker 的服务器上的全栈项目。`server.mjs` 提供登录、员工资料、帖子及管理接口；`public/` 存放网页文件；SQLite 数据库存放在服务器的 `data/` 目录。

仓库保存程序和部署文件。员工账号、QQ 号、密码哈希、余额、帖子、头像和游戏记录只保存于服务器数据库，**不要把数据库或真实 `.env` 文件上传到 GitHub**。`.gitignore` 会忽略这些数据文件。

## 服务器首次部署

Ubuntu 安装 Docker Engine 和 Docker Compose 插件后：

```sh
git clone https://github.com/AllworksVivarium/AVEDpage.git ~/AVED
cd ~/AVED
cp .env.example .env
sudo install -d -o 1000 -g 1000 -m 750 data
```

`.env.example` 是公开模板，不含真实密码。复制为 `.env` 后，务必修改管理员初始账号密码和 `SESSION_SECRET`；`.env`、数据库与真实用户数据不会上传到 GitHub。

编辑 `.env`：把管理员账号和至少 6 位的密码改成自己的值，并设置至少 32 个字符的 `SESSION_SECRET`。然后启动：

```sh
docker compose up -d --build
docker compose ps
```

服务监听公网 4173 端口。AWS 安全组也需要允许 TCP 4173 入站。玩家入口是 `public/player-terminal.html`，管理入口是 `public/admin-terminal.html`。`aved.space` / `www.aved.space` 的根路径显示玩家页，`authority.aved.space` 和公网 IP 的根路径显示管理页；本机根路径显示玩家页。两者均通过同域 `/api/` 使用后端。

## 更新代码

```sh
cd ~/AVED
git pull origin main
docker compose up -d --build
```

容器重建会保留 `data/` 数据目录。若迁移服务器，请先停止服务，备份 `.env` 和整个 `data/` 目录，再在新服务器恢复它们。数据库和 `.env` 不需要、也不应上传 GitHub。

## 管理员功能

管理员登录后进入管理工作台，可以录入和修改员工账号、姓名、QQ 号、部门和初始余额等信息，并查看完整的公告留言、论坛主题和回复记录。删除帖子会弹出二次确认并从数据库删除；删除论坛主题时，其回复也会随之删除。

玩家页面保留原来的黑色开屏和艺术布局。管理页面只允许管理员使用，包含员工、帖子、公告、档案、音乐、图文审核和活动记录。

## Windows 本机预览

安装 Node.js 24 或更新版本后，可使用 `启动预览.bat`，再打开 `http://127.0.0.1:4173`。首次运行会在本地生成独立管理员，用户名和初始密码显示在启动窗口；配置保存在忽略上传的 `.env.local`，数据库保存在 `data-local/`。本地数据与 AWS 完全独立。

API 路径和请求字段见 [API.md](API.md)。美工可编辑 `public/` 下的 HTML、CSS 和 JavaScript；只要保留 API 路径和字段约定，服务器数据接口就能继续使用。

开发维护说明见 [DEVELOPER.md](DEVELOPER.md)。


## 日后部署时的域名设置

`deploy/nginx-location.conf` 提供共同代理段，分别用于两个域名现有的 HTTPS server 块。保留原来的域名与证书配置，将旧的静态 `location /` 替换为代理段。不要把两个域名都指向旧 `/var/www/html`。

`deploy/update.sh` 可供服务器已有的定时更新服务调用。它只接受 main 分支、干净的跟踪文件和快进更新；不修改 `.env` 和数据目录。定时任务模板与安装步骤见 AWS-DEPLOY.md；需要在服务器安装后才生效。
