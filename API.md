# 网站数据接口约定

接口使用同源 `/api/...`。认证使用服务端设置的 HttpOnly 会话 Cookie。登录和 GET /api/health 无需登录；其他业务接口都要求登录；写请求会检查来源。前端不能指定余额、签到奖励或游戏开奖结果。

## 员工接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/login` | 使用唯一用户名或员工姓名和密码登录 |
| POST | `/api/logout` | 退出并撤销会话 |
| GET | `/api/me` | 当前员工和服务器计算的余额 |
| GET / PUT | `/api/profile` | 读取/保存匿名名、简介和头像 |
| GET / POST | `/api/checkin` | 查询/领取每日签到；每天一次 |
| GET | `/api/dossiers` | 读取收容物档案 |
| GET | `/api/announcements` | 读取公告 |
| GET | `/api/posts?announcementId=1` | 读取公告下的匿名留言 |
| POST | `/api/posts` | 发布公告留言：`announcementId`、`anonymousName`、`body` |
| GET / POST | `/api/forum` | 读取/发布匿名帖子；发布字段：`title`、`body` |
| GET / POST | `/api/forum/{id}/replies` | 读取/发布论坛回复；发布字段：`body` |
| POST | `/api/games/scratch` | 服务器刮刮乐结算 |
| POST | `/api/games/slot` | 服务器老虎机结算 |
| GET | `/api/games/history` | 读取当前员工的游戏票据记录 |
| GET | `/api/music` | 读取管理员启用的音乐曲目 |

头像可以是 PNG/JPG/WEBP 上传图片（最多 1.6 MB，保存在数据库），或 HTTPS 图片链接。上传数据仅通过登录后的个人资料接口提交。

## 管理员接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET / POST | `/api/admin/employees` | 查看员工名册 / 新增员工 |
| PUT | `/api/admin/employees/{id}` | 修改姓名、QQ 号、部门、启用状态或重置密码 |
| POST | `/api/admin/employees/{id}/balance` | 记入余额变动流水：`delta`、`reason` |
| POST / DELETE | `/api/admin/dossiers`、`/api/admin/dossiers/{id}` | 新增 / 删除档案 |
| POST / DELETE | `/api/admin/announcements`、`/api/admin/announcements/{id}` | 发布 / 删除公告 |
| DELETE | `/api/admin/posts/{id}` | 永久删除公告下的匿名留言 |
| GET | `/api/admin/posts` | 查看完整的公告匿名留言审核队列（含发言员工映射） |
| GET | `/api/admin/forum` | 查看完整的匿名主题和回复审核队列（含发言员工映射） |
| GET | `/api/admin/speech-records` | 统一查询发言审计记录，可按员工、来源、日期和关键词筛选 |
| DELETE | `/api/admin/forum/threads/{id}`、`/api/admin/forum/replies/{id}` | 永久删除匿名主题或回复；删除主题会同时删除其回复 |
| GET / POST / DELETE | `/api/admin/music`、`/api/admin/music/{id}` | 查看 / 添加 / 删除音乐曲目 |

新增员工字段：`username`（唯一登录用户名）、`password`（至少 6 位）、`displayName`（员工姓名）、`qqNumber`、`department`、可选 `initialBalance`。密码只保存 PBKDF2 哈希。QQ 号仅在管理员名册接口返回。登录时可以填写唯一用户名或员工姓名；如员工姓名重复，则使用唯一用户名登录。

管理员发言审核接口返回匿名名与真人映射字段：`employeeId`、`username`、`displayName`、`department`。`/api/admin/speech-records` 额外支持筛选参数：`employeeId`、`sourceType`（`comment`/`thread`/`reply`）、`username`（模糊匹配）、`from`、`to`（`YYYY-MM-DD`）和 `keyword`，可选 `limit`（1-500，默认 200）。

## 服务端结算和存储

- 余额保存在不可由前端覆盖的流水表中，展示余额由服务器求和计算。
- 签到使用员工编号和上海日期作为唯一键；重复签到会被拒绝。
- 每次游戏由 Node.js `crypto.randomBytes(32)` 生成 256 位随机种子，开奖结果通过 HMAC 派生。种子、SHA-256 校验值、玩法、开奖结果和对应的余额流水写入数据库；游戏请求不接受客户端的结果参数。
- 公告、留言、个人资料、论坛主题/回复、收容物档案、曲目和员工账户均保存在服务器 SQLite 数据库中。
- 前端仅展示 API 返回的数据；页面刷新后重新从服务器读取，不以 localStorage/sessionStorage 作为业务数据存储。

修改 API 字段时应同步调整此文档和前端。视觉重做可以独立进行，但请保留以上路径、认证和字段约定。



## 玩家原版页面专用接口

所有 `/api/player/*` 均要求登录，使用与管理员相同的 HttpOnly Cookie。不是 Bearer Token。

- `GET /api/player/state`：当前员工、余额、资料、永久成就、签到、公告、档案、部门、目录、论坛首 10 条、持仓、音乐。
- `GET /api/player/forum?before=id`：后续 10 条论坛主题。`POST /api/player/forum`：`{title,body,imageData?}`。
- `GET/POST /api/player/forum/:id`：查看回复 / 新回复 `{body,imageData?}`。图文整体待审；文本直接发布。
- `GET /api/admin/moderation`、`POST /api/admin/moderation/thread/:id` 或 `reply/:id`：完整图文审核；提交 `{action:"approve"|"reject"}`。
- `GET /api/admin/activity?before=id`：每页 100 条历史快照和操作记录。不会返回密码哈希或会话密钥。
- `POST /api/player/games/scratch`：`{tier,type}`；服务器根据有效票种生成种子、票面、奖额并结算。
- `POST /api/player/games/slot`：`{bet}`；返回完整五轮盘面与结算。
- `POST /api/player/games/derby`：`{bet,runner}`。
- `POST /api/player/games/sky/start`：`{bet}`；`GET /api/player/games/sky/current`；`POST /api/player/games/sky/jump`：`{round}`。高度与结算依服务器时间。
- `POST /api/player/games/cards`：`{action:"start"|"bid"|"play"|"pass",round?,cards?:number[]}`。简化电脑对手牌局，服务器持有完整牌堆。
- `GET/POST /api/player/stocks`：查询 / `{code,action:"buy"|"sell"}`。
- `GET /api/player/chat/stream?room=sky|derby`：SSE 实时聊天推送。`POST /api/player/chat`：`{room,body}`。
- `POST /api/player/balance/zero`：主动归零；`POST /api/player/relief`：每日最多领取一次补贴，资格由服务器检查。

API 不接收玩家指定的奖金、余额增量、牌堆或游戏种子。用于管理的接口在后端核验管理员身份。

## 运维

GET /api/health 返回 {"ok":true,"service":"aved"}，检查应用与数据库连接，不返回员工数据。COOKIE_SECURE=true 时登录/退出 Cookie 增加 Secure，只有 HTTPS 可用于登录；默认 false 兼容 HTTP 本地预览。
