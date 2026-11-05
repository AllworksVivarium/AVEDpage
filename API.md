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
| GET | `/api/posts?announcementId=1` | 读取公告下的实名留言 |
| POST | `/api/posts` | 发布实名公告留言：`announcementId`、`body` |
| GET / POST | `/api/forum` | 读取/发布匿名帖子；发布字段：`title`、`body` |
| GET / POST | `/api/forum/{id}/replies` | 读取/发布论坛回复；发布字段：`body` |
| POST | `/api/games/scratch` | 服务器刮刮乐结算 |
| POST | `/api/games/slot` | 服务器老虎机结算 |
| GET | `/api/games/history` | 读取当前员工的游戏票据记录 |
| GET | `/api/music` | 读取管理员启用的音乐曲目 |

头像可以是 PNG/JPG/WEBP 上传图片（最多 1.5 MB，保存在数据库），或 HTTPS 图片链接。上传数据仅通过登录后的个人资料接口提交。

## 管理员接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET / POST | `/api/admin/employees` | 查看员工名册 / 新增员工 |
| PUT | `/api/admin/employees/{id}` | 修改姓名、QQ 号、部门、启用状态或重置密码 |
| POST | `/api/admin/employees/{id}/balance` | 记入余额变动流水：`delta`、`reason` |
| POST / DELETE | `/api/admin/dossiers`、`/api/admin/dossiers/{id}` | 新增 / 删除档案 |
| POST / DELETE | `/api/admin/announcements`、`/api/admin/announcements/{id}` | 发布 / 删除公告 |
| DELETE | `/api/admin/posts/{id}` | 移除公告留言并保留审计 |
| GET | `/api/admin/posts` | 查看完整的公告匿名留言审核队列（含发言员工映射） |
| GET | `/api/admin/forum` | 查看完整的匿名主题和回复审核队列（含发言员工映射） |
| GET | `/api/admin/speech-records` | 统一查询发言审计记录，可按员工、来源、日期和关键词筛选 |
| DELETE | `/api/admin/forum/threads/{id}`、`/api/admin/forum/replies/{id}` | 移除匿名主题或回复并保留原记录；主题移除后回复不再公开 |
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

## 社区与内容维护

登录修复：所有终端使用 public/http-client.js，HTTP 200 的截断/无效 JSON 仍视为失败。GET 在短暂网络错误后可重试，写请求不自动重发。POST /api/login 成功后须 GET /api/me 确认浏览器已建立同一身份的会话。

个人资料、员工名录及论坛/生活记录的 imageData、avatarUrl 可返回受登录保护的 `/api/media/avatar|thread|reply|life/:id?v=` 图片地址；登录资料包不再携带 Base64 图片。个人资料更新时可原样传回自己的头像地址，服务器保留原图。未审核图片仅管理员可读。

生产环境启用 COOKIE_SECURE 时，HTTP 页面重定向至 HTTPS，HTTP 登录请求返回 HTTPS_REQUIRED。TRUST_PROXY_IPS 必须按实际代理的精确地址配置，不能信任任意来源的转发头。失败次数限制以来源和账号组合为单位。

- 公告留言 GET /api/posts 返回 displayName 和 department，署名由服务器绑定。
- 玩家论坛返回当前匿名代号、canEdit、editedAt。PUT /api/player/forum/thread/:id 和 reply/:id 仅允许作者修订，保存完整前后版本；含图修订重新审核。玩家没有删除接口。
- GET /api/player/life?q=&department=&kind=article|art&order=newest|oldest&before= 读取生活记录，每页 20 项，返回 items,next。POST 接受 title,body,kind,tags,imageData；图片整条待审，纯文字直接归档。
- GET /api/admin/moderation 包括 life；POST /api/admin/moderation/life/:id 批准或拒绝生活图文。
- PUT /api/admin/dossiers/:id 修订编号、名称、部门、状态和正文。新增仍使用 POST；评论独立持久化。
- GET /api/admin/speech-records?from=&to=&keyword=&sourceType=&employeeId=&offset= 查询论坛、通告、卷宗、无线电及生活记录，每页最多 200 项，日期按上海自然日筛选。返回 QQ、实名、当前及历次代号、修订前后版本和删除人/时间。
- 管理员 DELETE 论坛主题、回复、通告留言及 /api/admin/speech/posts|dossier_comments|chat_messages|life_records/:id 为保留记录的移除，前台过滤删除内容，审计保留操作人。
- GET /api/terminology 读取启用规则；管理员使用 /api/admin/terminology 的 GET/POST、/:id 的 PUT/DELETE 管理。正则为受限模式，不允许重复量词、分组、反向引用；仅改变展示，不改写原始发言。
- 勾选记住凭证后会话最长 30 天；密码由浏览器密码管理器保管，页面不存储明文密码。注销撤销会话。
- 个人头像直接同步员工名录；头像更换不生成 profiles 审计快照，代号修改仍保存历史。



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

## 终端显示与证券行情

- POST /api/login 成功返回 `{ok:true,employee:{username,displayName}}`，允许连接框先显示员工称呼，再获取完整资料。
- GET /api/me、GET /api/player/state 返回 `serverTime`（毫秒时间戳），供前端校准相对时间。后端仍保留完整真实记录时间。
- GET /api/player/state 的 `market` 提供 KARMA 指数及默认 1 分钟 K 线。
- GET /api/player/stocks?code=KARMA&period=1 返回 `{items,balance,market,serverTime}`。code 为 KARMA 或已有证券代码，period 仅允许 1、5、15（分钟）。
- `market` 包含 code、period、index、quote、candles。每根 candle 包含 bucket（毫秒）、open、high、low、close、volume、turnover。
- POST /api/player/stocks?code=AVED.VIV&period=1 提交 `{code,action:"buy"|"sell",quantity:整数}`；quantity 可省略，默认 1，范围 1–10000。价格、总金额及成交量由后端确认；客户端 price/seed 参数不参与定价。
- 行情每 5 秒由服务器生成报价并合并为分钟 K 线；数据库保存 candle 与随机种子。刷新页面不会重新随机历史，初次运行不补造过去的 K 线。
- 这里是企划内部证券玩法，不连接现实交易所。红色上涨、绿色下跌。
- 系统日期在前端按 Asia/Shanghai 自然日显示今天、昨天、前天、N天前；聊天室仅显示时分，不输出真实或虚构年月日。
- “记住账号和密码”使用浏览器密码管理器；网页只可本地保存用户名，不保存明文密码或业务数据。
