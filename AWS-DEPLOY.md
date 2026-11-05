# AWS 东京部署指南

所有命令在 AWS 东京实例的 Ubuntu 终端执行，不是在 Windows PowerShell。每段执行完再进行下一段；遇到报错先停止。统一使用 `/home/ubuntu/AVED`，不创建 AVED-new，不删除数据库。

## 1. 两个域名都要修改解析

2026-11-05 外部查询：aved.space 指向 18.183.74.118，authority.aved.space 仍指向旧 IP 32.236.49.115。查询有缓存，修改后以最新结果为准。

在域名 DNS 管理里设置两条 A 记录：

- 主机记录 `@`：`18.183.74.118`。
- 主机记录 `authority`：`18.183.74.118`。

如果有 AAAA 记录，应指向新服务器实际配置好的 IPv6；没有 IPv6 服务就移除旧 AAAA。www 若需要使用也单独配置，并在 Nginx 和证书中添加。本指南先配置上面两个域名。

AWS 东京实例的安全组允许公网 TCP 80、443。网站访问者不需要固定 IP。SSH 使用新实例对应的密钥和登录方式；4173 暂保留现有公开设置，最终使用域名访问。

DNS 不会搬运代码、数据库、Nginx 或证书。正常入口是 https://aved.space 和 https://authority.aved.space，不是 https://18.183.74.118。

## 2. 检查并准备 Docker

```bash
docker --version
docker compose version
```

两个命令都有版本号就跳过安装。缺失时参照 [Docker 官方 Ubuntu 安装说明](https://docs.docker.com/engine/install/ubuntu/)。已存在 docker.io 等其他版本时，不要混装。

仅全新且未安装 Docker 的 Ubuntu 使用：

```bash
sudo apt update
sudo apt install -y ca-certificates curl git nginx
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

```bash
sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

## 3. 拉取共同仓库

**还没有 ~/AVED 文件夹时**执行：

```bash
git clone https://github.com/AllworksVivarium/AVEDpage.git ~/AVED
cd ~/AVED
```

**~/AVED 已存在时**，先执行：

```bash
cd ~/AVED
git remote -v
git status --short --branch
```

origin 应为 AllworksVivarium/AVEDpage。仍是旧地址时执行：

```bash
git remote set-url origin https://github.com/AllworksVivarium/AVEDpage.git
```

然后更新：

```bash
git pull --ff-only origin main
```

如果提示本地改动、冲突或分叉，停止并把输出发给维护者，不要强制覆盖。

GitHub 不包含真实员工和帖子。保留悉尼数据需要另外迁移 `.env` 和整个 `data/`，不能靠克隆恢复。先停旧服务再复制数据，不要覆盖东京已经使用的数据库。

## 4. 配置首个管理员并启动

```bash
cd ~/AVED
test -f .env || cp .env.example .env
openssl rand -hex 32
nano .env
```

随机串填写 SESSION_SECRET，用于识别登录会话，不是管理员登录密码。编辑示例（中文说明必须换成自己的值）：

```dotenv
NODE_ENV=production
PORT=4173
HOST=0.0.0.0
DATA_DIR=/app/data
BOOTSTRAP_ADMIN_USERNAME=AVED
BOOTSTRAP_ADMIN_NAME=系统管理员
BOOTSTRAP_ADMIN_PASSWORD=这里改成自己的至少6位密码
SESSION_SECRET=这里粘贴生成的64字符随机串
COOKIE_SECURE=false
```

值中有空格、# 或 $ 时用英文单引号包住，避免被配置解析器误解。保存：Ctrl+O → 回车 → Ctrl+X。

```bash
chmod 600 .env
sudo install -d -o 1000 -g 1000 -m 750 data
sudo docker compose up -d --build
sudo docker compose ps
curl -fsS http://127.0.0.1:4173/api/health
```

最后应显示 `{"ok":true,"service":"aved"}`。如果日志有数据库 EACCES，先确认项目目录为 /home/ubuntu/AVED，再修复迁移数据权限：

```bash
sudo chown -R 1000:1000 /home/ubuntu/AVED/data
sudo docker compose restart web
```

**BOOTSTRAP 配置仅在数据库没有员工时创建第一位管理员。已有员工后，改 .env 不会重置数据库密码。**

## 5. 已有管理员忘记密码

查看管理员用户名（不显示密码）：

```bash
cd ~/AVED
sudo docker compose exec web node admin-account.mjs list
```

交互式重置：

```bash
sudo docker compose exec web node admin-account.mjs reset
```

依次输入管理员用户名、新密码、新密码。密码输入时不显示字符是正常的。重置恢复该账号启用状态并注销旧会话，保留员工、帖子和余额；不会创建新管理员或提升普通员工权限。然后在网站用新密码登录。

## 6. Nginx：两个域名转发到同一个后端

没有安装时：`sudo apt install -y nginx`。先查看已有配置：

```bash
sudo nginx -T 2>/dev/null | grep -n -A18 -B3 'server_name.*aved'
```

### 新服务器没有 aved 域名配置

```bash
cd ~/AVED
sudo cp deploy/nginx-http.conf /etc/nginx/sites-available/aved
sudo ln -s /etc/nginx/sites-available/aved /etc/nginx/sites-enabled/aved
sudo nginx -t
```

如果 ln 提示文件已存在，停止，按下一小节处理。只有 nginx 检查 successful 后才执行：

```bash
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

### 已经有 aved/authority 配置

不要增加重复 server_name。打开上述输出中的配置文件，保留 server_name、443 和证书行，把两个站点各自的 `location / { ... }` 替换成 `deploy/nginx-location.conf` 内容。原来的静态 try_files 应被替换。

保留 `proxy_set_header Host $host;`，应用靠 Host 选择玩家/管理员页面；保留 `proxy_buffering off;` 用于聊天实时推送。不要把 $host 改成公网 IP。

```bash
sudo nginx -t
```

成功后才执行 `sudo systemctl reload nginx`。旧证书文件不存在时先恢复 HTTP 配置再申请证书，不要重载失败配置。

新 HTTP 配置检查：

```bash
curl -fsS -H 'Host: aved.space' http://127.0.0.1/api/health
curl -fsS -H 'Host: authority.aved.space' http://127.0.0.1/api/health
```

应返回 ok。已有 HTTPS 配置可能返回跳转，改用下一节 HTTPS 检查。两个网站不能继续使用 /var/www/html 中的旧静态首页。

## 7. 在东京申请 HTTPS

先确保两个域名都指向东京，公网 HTTP 可访问，80/443 已开放。已有 Certbot 使用现有安装，不要混装。全新 Ubuntu 按 [Certbot 官方指南](https://certbot.eff.org/instructions?ws=nginx&os=snap)：

```bash
sudo snap install --classic certbot
sudo /snap/bin/certbot --nginx -d aved.space -d authority.aved.space
```

如没有 snap，先安装 snapd。按提示输入邮箱、同意条款并启用 HTTP 跳转 HTTPS。命令报错先停止。

```bash
curl -fsS https://aved.space/api/health
curl -fsS https://authority.aved.space/api/health
sudo /snap/bin/certbot renew --dry-run
```

两个 HTTPS 地址正常后，编辑 .env 将 COOKIE_SECURE=false 改成 COOKIE_SECURE=true：

```bash
cd ~/AVED
nano .env
sudo docker compose up -d --force-recreate
```

此后使用域名 HTTPS 登录；HTTP 公网 IP 无法保存 Secure 登录 Cookie，属于预期。不要发送 .env、SESSION_SECRET 或密码。

## 8. 在网页录入员工

1. 打开 https://authority.aved.space，用管理员用户名和密码登录。
2. “登记员工”填写唯一用户名、初始密码（至少 6 位）、员工姓名/角色名、QQ、部门、初始余额，点保存。
3. 用户名用于稳定识别账号，角色名用于显示；同名员工必须用用户名登录。QQ 只是内部登记，不是 QQ 授权登录。
4. 名册点“编辑”，修改姓名、QQ、部门、启用状态或密码。密码不改就留空。
5. 玩家打开 https://aved.space，使用已录入账号登录，连接同一数据库。
6. 图文在“图文审核”查看完整文字与图片后批准；纯文字直接发布；活动记录可追溯。
7. 公告、档案、音乐在管理端内容模块维护；音频外链必须有使用权。

日常维护不需要手改数据库，更不能将员工名单和数据库上传 GitHub。

## 9. 手动更新和每两分钟自动更新

手动更新：

```bash
cd ~/AVED
git pull --ff-only origin main
sudo docker compose up -d --build
```

网站可用后再启用自动更新。以下服务只适用于 Ubuntu 用户 ubuntu、目录 /home/ubuntu/AVED，给该后台进程 Docker 权限，每两分钟检查 main。未上传到 GitHub main 的改动不会上线。

```bash
cd ~/AVED
sudo install -m 644 deploy/aved-update.service /etc/systemd/system/aved-update.service
sudo install -m 644 deploy/aved-update.timer /etc/systemd/system/aved-update.timer
sudo systemctl daemon-reload
sudo systemctl start aved-update.service
sudo systemctl enable --now aved-update.timer
sudo systemctl list-timers aved-update.timer
```

查看日志：

```bash
sudo journalctl -u aved-update.service -n 60 --no-pager
```

暂停：`sudo systemctl disable --now aved-update.timer`。

不是零停机部署：代码改变后重启容器，聊天短暂断开再重连。多人开发在分支中进行，准备上线才合并 main。遇到本地代码改动或分叉，自动更新停止，不强制覆盖；.env 和 data 保留。仓库变私有后需给服务器单独配置只读访问凭据。

## 10. 空白页面的定位

将以下输出提供给维护者（日志有员工信息先遮盖）：

```bash
cd ~/AVED
git remote -v
git log -1 --oneline
sudo docker compose ps
sudo docker compose logs --tail=60 web
curl -i --max-time 10 http://127.0.0.1:4173/api/health
sudo nginx -t
sudo nginx -T 2>/dev/null | grep -n -A18 -B3 'server_name.*aved'
```

- 4173 health 不通：先查容器启动日志和数据目录权限。
- 4173 正常、域名不正常：查 DNS、安全组、Nginx、证书。
- 域名 health 正常、主页旧版：查重复域名配置和旧静态目录，再强制刷新。
- login 成功而 me 401：查是否 HTTP 使用 Secure Cookie、是否混用域名。两个域名的 Cookie 独立，需分别登录。

## 11. 数据迁移

GitHub 保存程序，data 保存员工等真实业务数据，.env 保存服务器配置。只克隆代码无法恢复旧员工和帖子。

迁移时先暂停自动更新、停旧服务，然后复制完整 data 和 .env，设置权限再启动新服务。恢复前确认目标数据可以替换。在线备份应使用 SQLite 一致性备份接口，不要分别热拷贝正在写入的 DB/WAL/SHM 文件。不要用删除数据库来解决页面版本问题。
