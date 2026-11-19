# 论坛回复与演绎身份

论坛使用按页加载和版本号更新检查，不引入外部论坛服务。显示方式参考 Discourse 的平铺讨论与引用定位，保留站点主题变量。

## 接口

所有接口要求员工登录，并受现有同源请求校验保护。

- `GET /api/player/forum/notifications`：当前员工的未读通知项数量、最近 20 项未读及 5 项已读。普通帖子回复按帖子合并，直接回复评论逐条保留；每项含 `kind`、`count`、定位楼层和快照 `through`。
- `POST /api/player/forum/:thread/read`：`{through}` 只确认该快照内可见的普通帖子回复；`{replyIds}` 只确认指定楼层，不能跨账号或跨帖清除。
- 原有发帖与回帖接口增加可选 `personaId`；回帖增加可选 `replyToId`，必须指向同一主题内已公开的回复。
- `GET /api/player/forum/personas`：返回 `canManage`；仅有权限的员工取得已绑定公司机器人的身份列表，每项含 `id`、`robotId`、`name` 和账本 `balance`。
- `POST /api/player/forum/personas`：已停用新增身份，提示到管理端的公司机器人维护。
- `GET /api/player/forum/workshop`：按需调阅最近 30 个主题供编排选择。
- `POST /api/player/forum/workshop`，`{requestId,threadId,title,lines:[{personaId,body}]}`：一次发布 1 至 12 条角色发言，`threadId=null` 时第一条成为新主题正文。

## 权限与提醒

服务端每次从员工表验证启用状态及 `role=admin` 或 `identity_kind=planning_member`。

论坛内容的 `employee_id` 始终保存实际操作者，`persona_id` 单独保存公开身份。既有审计触发器记录两者；管理端通讯追溯支持按角色名称检索，并显示实际员工身份。机器人改名、调余额后，既有演绎帖同步显示新名字和余额。未使用的旧身份不补建账号。

新公开的回复通知主题作者以及被直接回复的人，同一条回复对同一员工只提醒一次，排除自己的操作。通知以 `is_read INTEGER CHECK(is_read IN (0,1))` 保存二值状态（0 未读，1 已读），不打包跨通知位图。启动时一次性继承旧时间戳和阅读游标，旧字段保留供历史兼容。`kind` 保存生成时的直接回复关系，避免原评论删除后改变提醒类型。

打开消息弹窗、轮询和楼层进入可视区域均不确认已读。点击通知并成功加载原帖／目标楼层后才提交确认。帖子普通回复合并一项，直接回复优先且不重复计入汇总；汇总只清除点击时的快照，新到达或稍后获准公开的回复仍未读。直接回复仅确认点击的那条。隐藏、删除的内容不进入提醒及未读计数。

浏览器在登录且页面可见时每 30 秒检查一次提醒，防止重复请求；离开窗口时暂停。帖子回复只保留当前页，版本未变化时返回 `notModified`，避免重复传输正文。编排脚本只在打开编排窗口时加载。没有新增第三方运行依赖、推送服务或后台定时任务。

## 验证

`tests/forum-social.test.mjs` 覆盖权限伪造、实名头像与匿名隔离、跨帖引用拒绝、自己的回复不提醒、直接回复与主题提醒、阅读时的并发新回复、删除与延迟审核、事务编排和重复发布、机器人改名与余额同步、伪造余额拒绝、删除后的历史保留，以及操作者审计记录。

`tests/forum-persona-migration.test.mjs` 覆盖历史建表约束、仅回复身份、同名绑定、零余额补建、未使用身份跳过、账本与原帖保留，以及重启和删除后的幂等迁移。

## 浏览与回复分页

- `GET /api/player/forum?page=1&sort=newest&q=`：每页 10 个主题；`activity` 按最后公开回复时间排序，编辑不顶帖。搜索覆盖全部公开主题的标题与正文（最多 100 字检索词）。列表只返回最多 100 字摘要，详情点击后读取。图片继续懒加载。
- `GET /api/player/forum/:id?page=1`：每页 20 条回复，返回 `page/pages/total/pageSize/changesCursor`。传 `revision` 可检查变化。
- `GET /api/player/forum/:id?reply=42`：定位该回复所在页；加 `context=1` 只返回该楼层，用于原地展开引用。
- 楼层号在同一主题内按插入顺序计算，软删除及审核隐藏不重排既有楼层。
- 发帖编辑区默认收起，收起保留当前页面草稿。未进入视口的回复不标为已读。
- `tests/forum-pagination.test.mjs` 覆盖跨页搜索、排序、精准定位、回复非贴主的评论、逐条已读、账号隔离和删除目标。`tests/forum-pagination-ui.test.mjs` 覆盖可见楼层回执和过期请求隔离。
