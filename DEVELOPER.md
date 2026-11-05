# AVED 开发者说明

本版本以 AllworksVivarium/AVEDpage 的 main 为共同源码。域名已购买，部署目标为东京 AWS Ubuntu。部署步骤见 [AWS-DEPLOY.md](AWS-DEPLOY.md)。功能清单描述代码实现，不代表已通过浏览器、AWS 或多人压力测试。

## 两个页面与文件归属

- 玩家：public/player-terminal.html、public/player.js、public/player-layout.css。保留下载原版黑色开屏和 Logo，后续美工从这些文件继续修改。
- 管理员：public/admin-terminal.html、public/app.js、public/admin-extra.js、public/admin-layout.css、public/style.css。
- 后端：server.mjs 处理鉴权与基础业务；player-service.mjs 处理玩家业务、审核、聊天和活动记录；server-content.mjs、server-ticket.mjs、server-cards.mjs 保存玩法配置与结算逻辑。
- 部署：Dockerfile、compose.yaml、deploy/；管理员恢复工具：admin-account.mjs。
- 数据：服务器 data/wanyehui.db（含运行时 WAL/SHM）。代码仓库不保存真实数据。Windows 预览使用独立 data-local/。

Node.js 24 + 原生 HTTP + SQLite WAL；无需 npm 安装。两个域名均反代同一个 4173 应用，并保留 Host。aved.space 显示玩家端，authority.aved.space 显示管理员端，后端接口仍按登录权限检查。域名本身不赋予管理员权限。

## 已有代码能力

- 用户名唯一，角色名不重复时也可登录，密码至少 6 位。浏览器密码管理器可记账号密码；网页仅保存用户名偏好，余额、帖子和个人资料不作为本地业务数据保存。
- 同源 HttpOnly 会话；管理员 API 校验角色。HTTPS 就绪后可显式设置 COOKIE_SECURE=true，HTTP 预览保持 false。
- 员工录入、资料修改、停用、密码重置、删除；后台余额调整接口与流水；匿名发言对应真人查询接口。删除操作有确认。
- 公告、档案、论坛、头像、匿名名、签到、余额与成就从数据库读取。
- 图文主题/回复整条待审，管理员看到文字和图片，批准后公开；纯文字直接发布。
- activity_logs 保存数据库变更快照、登录及管理请求记录。删帖/删除账号不会清空历史审计快照；不记录明文密码或会话令牌。这是业务操作审计，不是所有鼠标点击的录像。
- 刮刮乐、老虎机、竞速、空投、牌桌由服务端生成随机种子、结算并写流水；玩家不能提交自己计算的奖金。
- 聊天使用 SSE 推送，消息持久化；Nginx 必须关闭代理缓冲。
- 音乐曲目由后台录入 HTTPS 外链。待办已移除。
- /api/health 检查应用和数据库连接，未登录 /api/me 返回 401 属于预期。

## 尚未完成或需要验收

1. 本轮已完成隔离数据库下的登录/证券 API 测试、慢连接登录和三端布局浏览器检查；头像、审核、重复点击和多人并发仍需继续验收。
2. 牌桌目前是简化规则的两位电脑对手，不是完整规则的三人联机斗地主；空投是个人架次，聊天共享。
3. 还需并发与断线恢复测试、游戏请求幂等键、完整奖励数值审核。随机性本身不等于公平性或可公开验证的抽奖承诺。
4. 登录已有进程内失败次数限制，但 Nginx 后面的连接可能共用代理 IP；应在可信代理配置完善后按账号及来源细化。密码哈希当前同步计算，高峰集中登录可能短暂阻塞事件循环。
5. 审计快照可能重复保存图片，数据库会较快增长。后续迁移图片到对象存储并在数据库保存引用；增加必要索引和分页。不要擅自删除历史审计。
6. 数据库备份恢复、监控告警、部署回滚演练尚未自动完成。备份必须用 SQLite 一致性备份或停服务后复制整个数据目录，不能分别热拷贝正在变化的 DB/WAL/SHM 当作可靠备份。
7. 当前 SSE 广播仅在单 Node 进程内。单机 20–30 在线可先观察；多实例前需要共享消息通道与数据库方案，不能直接多开 SQLite 容器当成扩容。

## 下一步顺序

1. 东京服务器启动容器；两个域名解析到同一东京 IP；Nginx 转发与 HTTPS 恢复。
2. 登录管理员，登记一位玩家，验收玩家登录、发帖、图文审核和余额持久化。
3. 完成备份、活动记录及多人聊天室验收，再逐步调整 UI、交互、美术。
4. 按真实 CPU、内存、延迟和数据库增长评估是否升级，而非仅按注册人数购买更大服务器。

## 多人协作约定

- UI 开发改玩家 HTML/CSS/JS；管理员页面单独维护，禁止用玩家页面覆盖它。
- API.md 是接口约定；后端改字段时同步文档和调用方。美工修改必须保留 API 调用和登录状态处理。
- 功能分支提交 PR，团队合并 main 后才部署。服务器自动更新只跟踪 main，不代表每次保存文件立即上线。
- 服务器不编辑被 Git 跟踪的代码；环境配置放 .env，真实内容通过管理端录入。
- 自动更新遇到本地改动或分叉会停止，不强制覆盖。更新重启会暂时断开聊天，浏览器 SSE 会重连，不是零停机部署。
- 后续数据库结构升级必须保留旧数据并设计迁移；迁移前做一致性备份。

## 参考

- [Docker Ubuntu 安装](https://docs.docker.com/engine/install/ubuntu/)
- [Nginx 反向代理](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [AWS EC2 CloudWatch 指标](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/viewing_metrics_with_cloudwatch.html)

## 本轮界面与行情调整

- 侧边栏按钮固定在目录标题上方，移除底部重复收起操作；窄屏目录使用遮罩展开。
- 保留原版黑色开屏主元素；用户提交登录立即显示连接框，完成认证、资料读取和界面准备后才进入公司内页。
- public/terminal-time.js 统一日期显示规则；完整时间仍保存在后端，不修改审计原始时间。
- server-market.mjs 保存分钟行情；public/market-chart.js 绘制响应式 SVG K 线、成交量和键盘可访问的报价。
- 提示文本使用公司内语境；已有系统默认通告仅按完整旧文案匹配更新，不覆盖员工撰写的通告。
- `node --test tests/terminal-market.test.mjs` 覆盖自然日边界、K 线持久化/合并、服务端定价和持仓、登录、部分遮蔽恢复。
