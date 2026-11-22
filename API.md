# 网站数据接口约定

接口使用同源 `/api/...`。认证使用服务端设置的 HttpOnly 会话 Cookie。

## 员工接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/login` | 使用唯一用户名或员工姓名和密码登录 |
| POST | `/api/logout` | 退出并撤销会话 |
| GET | `/api/me` | 当前员工和服务器计算的余额 |
| GET / PUT | `/api/profile` | 读取/保存内网 ID、简介、头像及登录信息；更改账号或密码须验证当前密码，新密码留空保留原密码 |
| GET / POST | `/api/checkin` | 查询/领取每日签到；每天一次，固定 8,000 |
| GET | `/api/dossiers` | 读取收容物档案 |
| GET | `/api/announcements` | 读取公告 |
| GET | `/api/posts?announcementId=1` | 读取公告下的实名留言 |
| POST | `/api/posts` | 发布实名公告留言：`announcementId`、`body` |
| GET / POST | `/api/player/forum` | 检索/发布论坛主题，单个分类归属 |
| GET / POST | `/api/player/forum/{id}` | 读取/发布主题下的回复 |
| POST | `/api/player/games/scratch` | 当前票种的服务器刮刮乐结算 |
| POST | `/api/player/games/slot` | 五轮五线转轮结算 |
| GET | `/api/games/history` | 读取当前员工的游戏票据记录 |

头像可以是 PNG/JPG/WEBP 上传图片（最多 1.5 MB，保存在数据库），或 HTTPS 图片链接。上传数据仅通过登录后的个人资料接口提交。

## 管理员接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET / POST | `/api/admin/employees` | 查看员工名册 / 新增员工 |
| PUT | `/api/admin/employees/{id}` | 修改姓名、QQ 号、归属、六维属性或重置主密码 |
| POST | `/api/admin/employees/{id}/balance` | 记入余额变动流水：`delta`、`reason` |
| POST / DELETE | `/api/admin/dossiers`、`/api/admin/dossiers/{id}` | 新增 / 删除档案 |
| POST / DELETE | `/api/admin/announcements`、`/api/admin/announcements/{id}` | 发布 / 删除公告 |
| DELETE | `/api/admin/posts/{id}` | 移除公告留言并保留审计 |
| GET | `/api/admin/forum` | 分页读取论坛主题，含分类及实名映射；`/{id}` 读取主题下的回复 |
| GET / POST | `/api/admin/forum/categories` | 读取/新增分类；`/{id}` 的 PUT 修改名称与排序 |
| GET | `/api/admin/speech-records` | 统一查询发言审计记录，可按员工、来源、日期和关键词筛选 |

新增员工字段：`username`（唯一登录用户名）、`password`（至少 6 位）、`displayName`（员工姓名）、`qqNumber`、`department`、可选 `initialBalance`。密码只保存 PBKDF2 哈希。QQ 号仅在管理员名册接口返回。登录时可以填写唯一用户名或员工姓名；如员工姓名重复，则使用唯一用户名登录。

管理员发言审核接口返回匿名名与真人映射字段：`employeeId`、`username`、`displayName`、`department`。`/api/admin/speech-records` 额外支持筛选参数：`employeeId`、`sourceType`（`comment`/`thread`/`reply`）、`username`（模糊匹配）、`from`、`to`（`YYYY-MM-DD`）和 `keyword`，可选 `limit`（1-500，默认 200）。

## 服务端结算和存储

- 签到使用员工编号和上海日期作为唯一键；重复签到会被拒绝。
历史已领取金额保留。
- 每次游戏由 Node.js `crypto.randomBytes(32)` 生成 256 位随机种子，开奖结果通过 HMAC 派生。
- 公告、留言、个人资料、论坛主题/回复、收容物档案、曲目和员工账户均保存在服务器 SQLite 数据库中。
- 前端仅展示 API 返回的数据；页面刷新后重新从服务器读取，不以 localStorage/sessionStorage 作为业务数据存储。

修改 API 字段时同步调整此文档和前端。已移除的旧接口 `/api/forum`、`/api/forum/{id}/replies`、`/api/games/scratch`、`/api/games/slot`、`/api/admin/posts`（GET）和 `/api/admin/achievements` 返回 404。自动成就继续由服务器授予，既有成就和游戏票据保留。

## 社区与内容维护

登录修复：所有终端使用 public/http-client.js，HTTP 200 的截断/无效 JSON 仍视为失败。POST /api/login 成功后须 GET /api/me 确认浏览器已建立同一身份的会话。

个人资料更新时可原样传回自己的头像地址，服务器保留原图。未审核图片仅管理员可读。

生产环境启用 COOKIE_SECURE 时，HTTP 页面重定向至 HTTPS，HTTP 登录请求返回 HTTPS_REQUIRED。失败次数限制以来源和账号组合为单位。

- 公告留言 GET /api/posts 返回 displayName、department、positionTitle 和 createdAt，署名与职务由服务器绑定；按创建时间升序、相同时按 id 升序排列。
- 玩家论坛返回当前匿名代号、canEdit、editedAt。PUT /api/player/forum/thread/:id 和 reply/:id 仅允许作者修订，保存完整前后版本；含图修订重新审核。AVED 账号发言的玩家接口返回空 editedAt，后台保留修订时间及版本。
- GET /api/player/life 支持搜索、标签、归属、作品类型、随机展出及日期排序。玩家提交、编辑后直接公开，管理员可软删除；格式、图片与分页参数见 [生活记录](docs/life-archive.md)。
- PUT /api/admin/dossiers/:id 修订编号、名称、部门、状态和正文。新增仍使用 POST；评论独立持久化。
- GET /api/admin/speech-records?from=&to=&keyword=&sourceType=&employeeId=&offset= 查询论坛、通告、卷宗、无线电及生活记录，每页最多 200 项，日期按上海自然日筛选。返回 QQ、实名、当前及历次代号、修订前后版本和删除人/时间。
- 管理员 DELETE 论坛主题、回复、通告留言及 /api/admin/speech/posts|dossier_comments|chat_messages|life_records/:id 为保留记录的移除，前台过滤删除内容，审计保留操作人。
- GET /api/terminology 读取启用规则；管理员使用 /api/admin/terminology 的 GET/POST、/:id 的 PUT/DELETE 管理。
注销撤销会话。

## 玩家原版页面专用接口

所有 `/api/player/*` 均要求登录，使用与管理员相同的 HttpOnly Cookie。

- `GET /api/player/state`：当前员工、余额、资料、永久成就、签到、公告、档案、部门、目录、论坛首 10 条、持仓。
- `GET /api/player/forum?page=1&sort=activity&q=&category=`：每页 10 条，默认按最后公开回复排序，支持 `newest`。返回 `items,page,pages,pageSize,total,sort,q,categoryId,categories,next`。`POST /api/player/forum`：`{title,body,categoryId,imageData?}`；每帖归属一个分类，标题保持原文。
- `GET/POST /api/player/forum/:id`：查看回复 / 新回复 `{body,imageData?,replyToId?}`。图文整体待审；文本直接发布。GET 的 `?page=1` 分页读取，每页 20 条，`?reply=id` 定位目标楼层；`?since=changesCursor` 增量读取变更，返回 `items,removed,changesCursor,moreChanges`。旧游标读取 `?after=id` 保留；主帖须公开且通过审核。
- `GET /api/player/forum/mentions?mode=anonymous|real&q=`：按内网 ID 或角色名独立检索，返回 `{items:[{key,label,mode}],ambiguous}`。同名候选提示改用另一种名字检索；玩家入口位于跟帖回复框。
- 论坛发布、修订及编排行可附 `mentions:[{key,start,end}]`；位置按去除首尾空白后的正文 UTF-16 索引，必须完整对应 `@label`。返回的 `mentions` 保留名字快照及账号绑定，改名后仍指向原账号。
- 提及提醒并入 `/api/player/forum/notifications`，使用 `kind:"mention"`、`mentionId`，同一来源对同一收件人提醒一次；审核通过后送达。`POST /api/player/forum/:id/read` 的 `{mentionIds:[id]}` 只读取本人已经公开的对应提醒，与回复提醒去重。
- `GET /api/admin/moderation`、`POST /api/admin/moderation/thread/:id` 或 `reply/:id`：完整图文审核；提交 `{action:"approve"|"reject"}`。
- `GET /api/admin/activity?before=id`：每页 100 条历史快照和操作记录。
- `POST /api/player/games/scratch`：`{tier,type,cost,revision,requestKey?}`；服务器根据有效票种生成种子、票面、奖额并结算，重试沿用请求标识。
- `POST /api/player/games/slot`：`{bet,requestKey}`；返回完整五轮盘面与结算，同一请求重复提交沿用原票据。
- `GET /api/player/games/derby/current`、`POST /api/player/games/derby/bet`：读取共享赛程 / 提交 `{round,bet,runner,market?}`。
- `POST /api/player/games/sky/start`：`{bet}`；`GET /api/player/games/sky/current`；`POST /api/player/games/sky/jump`：`{round}`。高度与结算依服务器时间。
- `POST /api/player/games/sky/input-sync`：`{round,token}`；`POST /api/player/card-table/input-sync`：`{room,scope,token}`。令牌由本人服务器快照签发，返回 `{serverTime,compensationMs}`，最多补偿 250 ms，不接收客户端时间或深度。
- 联机牌桌采用 `/api/player/card-table/*`，详见 [牌桌](docs/CARD-TABLE-PREVIEW.md)。旧电脑牌局 `/api/player/games/cards` 返回 410，既有记录沿用历史查询。
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
- GET /api/player/stocks?code=KARMA&period=1 返回 `{items,balance,market,serverTime}`。code 为 KARMA 或已有证券代码，period 支持 1、5、15（分钟 K 线）及 `24h`、`72h`（最近 24/72 小时走势）。后两者按 30/90 分钟聚合真实行情，包含当前未完周期，返回 `candleMinutes,from,to`；保留缺失时段。
- `market` 包含 code、period、index、quote、candles。每根 candle 包含 bucket（毫秒）、open、high、low、close、volume、turnover。
- POST /api/player/stocks?code=AVED.VIV&period=1 提交 `{code,action:"buy"|"sell",quantity:整数}`；quantity 可省略，默认 1，范围 1–10000。
- 行情每 5 秒由服务器生成报价并合并为分钟 K 线；数据库保存 candle 与随机种子。
- 这里是企划内部证券玩法，不连接现实交易所。红色上涨、绿色下跌。
- 系统日期在前端按 Asia/Shanghai 自然日显示今天、昨天、前天、N天前；聊天室仅显示时分，不输出真实或虚构年月日。

### 爱心账户交易税费与记录保留

- GET /api/player/welfare 的 fund 增加 stockFees、stockFeeTrades：全体证券成交的累计手续费及对应成交笔数。fund.balance 包含手续费收入，donated 与爱心榜仅统计主动捐款。
- GET /api/player/stocks/history 增加 marketFees: {total,trades}；summary.totalFees 继续表示本人的累计手续费。没有额外扣税，现有成交费通过同事务触发器转入爱心账户。
- 首次启动补入现存 stock_trades.fee 正值，一次性迁移防止重启重复入账。
- 普通运行日志保留 30 天，可核对原始流水的旧余额日志副本保留 90 天；真实流水、交易、游戏及发言审核记录保留。无线电仍保留 3 天。
