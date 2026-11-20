# 论坛加载占位

复用现有原生 JavaScript 控制器、`aved-personal` 样式层及 `--inner-card-bg`、`--inner-text-main`、`--inner-border-soft` 主题变量。

- 首次进入论坛、搜索/排序/翻页、打开主题与回复分页接入同一个骨架屏组件。
- 180ms 后才显示占位，不人为延长请求；已有内容的普通刷新保留原内容。键盘焦点处于内容中，或在延迟显示前移入内容时，不隐藏被聚焦的内容。
- 占位包含圆形头像、标题、两条正文和底部元信息，使用现有卡片间距；已知卡片的高度会被测量并复用。主题列表长标题最多两行，摘要最多一行，详情保留全文。
- `aria-busy` 标记加载区域；`role=status` 提示加载、完成或失败；占位 `aria-hidden=true`，不包含可聚焦控件。搜索失败提供重试；回复失败提供重试；重试及迟到响应遵循原有账号/请求序号隔离。
- 微光使用单个卡片伪元素的 transform 动画；`prefers-reduced-motion: reduce` 和网站关闭特效时关闭该伪元素。

参考：<https://atlas.gongfpp.icu/patterns/skeleton-loading?mode=default&requirements=dark%2CreducedMotion%2CnoDeps%2CrunChecks#playground>。已在浏览器中对照加载态的结构与轻微微光效果。

本地验收：1024px 桌面、390×844 手机、长中文标题与连续英文链接、键盘可见焦点、加载完成、失败、重试和导航取消。200% 使用隔离预览中的 CSS zoom:2 检查布局；减少动态效果通过同一媒体规则的等效静态样式检查。模拟慢网通过隔离代理增加响应延迟。

测试：`node --test tests/forum-skeleton.test.mjs tests/forum-pagination-ui.test.mjs tests/forum-notification-ui.test.mjs tests/forum-reactions-ui.test.mjs tests/player-startup.test.mjs tests/performance-safety.test.mjs`。
