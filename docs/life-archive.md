# 生活记录

玩家自行上传、查看与编辑作品。生活记录以展示、检索与完整阅读为主，不包含讨论区或收藏；作者署名使用员工真实名称。点赞数量仅作者本人可见，公开接口不会返回他人作品的赞数或点赞者身份。

- `server-life.mjs`：旧表增量迁移、归属与修订校验、文字格式白名单、随机展出与图片处理。保留旧投稿与管理端审核接口。
- `public/life-content.js`：服务端和客户端共用的受限 Quill Delta 模型；最多 100000 字，不接受 HTML 或内嵌对象。图片走独立上传入口。
- `public/life-archive.js/css`：玩家投稿、我的作品、编辑、预览、模板选择、Masonry 展示板、完整阅读页。单件作品支持正文与一张附图，可以上传文字长图。
- `GET /api/player/life`：支持 q、kind、department、tag、order（random/newest/oldest）、mine、before。随机模式使用 seed、snapshot、offset 保持翻页稳定；先分散作者，再轮换各作者作品。没有按互动热度排序。
- `GET /api/player/life/:id`：公开作品或本人作品详情。列表仅返回节选与图片地址，完整文档在点开后读取。
- `POST /api/player/life`、`PUT /api/player/life/:id`：标题、kind、content（Delta）、template、paperTone、presentation、excerpt、tags、previewPosition、可选 imageData；修改需携带当前 revision。省略 imageData 保留图片，空字符串移除。带图作品保存后重新核验。
- `DELETE /api/player/life/:id`：本人软删除接口。玩家 UI 当前只提供编辑。
- 模板：plain、ruled、grid、archive、photo；纸色：ivory、white、sage、blue、rose。纸色随作品保存，不随阅读者主题反转。横线与网格只绘制在正文书写区，依据实际字体基线与行距重复；标题、署名、标签和图片不叠线。
- 呈现方式 presentation：text / image。文字作品可用排版正文（正文在前、附图在后）或文字长图（图片在前、可选配文在后）；图片作品固定以图片为主体。切换编辑模式保留正文、附图和纸张设置。文字长图仍按 article 筛选。旧投稿缺少此字段时，仅图片且无正文推断为 image，其余 article 为 text。
- 图片：PNG/JPEG/WebP，客户端原件不超过 20 MB / 3200 万像素；按宽 1600、高 24000 上限等比处理，服务端再次解码、旋转、编码并要求结果不超过 1.5 MB。缩略图保留长条比例，最长高 12000、宽 600；展示卡裁剪位置可选。`/api/media/life/:id?preview=1` 读取缩略图，原地址读取清晰版。待核验图片仅作者与管理员可读。
- 编辑保留文字修订记录；附图更换沿用图片审核归档，活动日志中不复制原图和缩略图字节。
- Quill 和 Masonry 首次使用时按需加载本站静态文件。来源与许可见第三方引用清单，预览数据不写入生产数据库。

不需要额外的数据库备份步骤；沿用每日一份与五日一份规则。

## 标签与点赞

- `server-life-social.mjs`：独立标签目录、每日点赞、作者消息与自动补充点赞。默认标签为所有部门及日常、活动、主线；历史自定义标签迁移保留。默认标签只初始化一次，管理员改名后不会在重启时复活旧标签。
- `GET /api/player/life/catalog` 返回可选标签。投稿仅接受启用的已登记标签；旧作品仍可保留已停用的标签。后台 `GET/POST /api/admin/life/tags`、`PUT /api/admin/life/tags/:id` 支持新建、改名和停用；改名同步作品并递增 revision，防止旧编辑页覆盖。
- `POST /api/player/life/:id/like`：北京时间自然日，每人每件公开作品限一次，数据库复合唯一键保证重复请求不累计；不能赞本人、未公开或已删除作品。只返回本人今日操作状态。作者详情和本人列表才有 likeCount，管理员查看他人作品也不返回数量。
- `GET /api/player/life/notifications` 仅返回本人作品的新增赞数；`POST` 携带作品 id、through，按读取快照确认，期间收到的新赞保留未读。无点赞者名字、账号或机器人字段。消息入口保留未读，前台可见时每 30 秒检查一次并轻提示。
- `GET/PUT /api/admin/life/settings` 配置自动点赞开关、最短/最长间隔和低赞阈值；默认启用、3～5 天、低于 10 赞。每件作品只随机安排 1～3 次自动点赞，每次独立发生；达到阈值或用完次数即停止。
- `server.mjs` 每分钟运行一次补充检查，单次最多触发一件作品，下一次安排在未来随机 3～5 天。重启时把过期任务分散重排，不集中补齐离线期间的赞。修改设置也从当前时刻重新安排，已用次数不会重置。机器人无需员工账户，内部只存次数，不对玩家披露具体身份。

- 作品缩略图默认居中裁切。`preview_position_set` 区分旧版默认顶部与明确保存的位置；旧作品默认位置按居中展示，已有非零位置保留，后续仍可明确选顶部或底部。展示板标题旁不再绘制易被误认作缺字的网格装饰。
