# 收容档案与员工六维接口

## 收容档案

管理端新建、编辑卷宗支持以下字段，玩家端只展示已填写内容：

- `classification`：空值、SAFE、EUCLID、KETER；与自由填写的收容状态 `status` 分开。
- `summary`：档案描述，保留换行。
- `procedures`：可选特殊收容措施，最多 8000 字符。
- `sections`：最多 24 个有序模块。类型 `note`、`discovery`、`experiment`、`incident`、`interview`、`story`。
- 每个模块的 `title`、`author`、`date` 可留空；`date` 是文本，允许 20xx 等设定时间。`body` 最多 6000 字符，空正文不展示。模块文本总长最多 48000 字符。

管理端 `POST /api/admin/dossiers`、`PUT /api/admin/dossiers/:id` 保存这些字段；管理端与玩家端读取均返回 `sections` 数组。更新时省略新增字段会保留原值，显式空值用于清空。所有正文按纯文本转义，不执行 HTML。已有正文不自动拆分或改写。

首次升级会把原 `status` 恰好为 SAFE / EUCLID / KETER 的记录复制到独立分类，之后不再覆盖手动分类。图片仍仅管理端可查看。

## 员工六维

管理员专用：

- `GET /api/admin/employees/:id/attributes`
- `PUT /api/admin/employees/:id/attributes`，请求 `{"values":[68,85,57,91,44,76]}`；`{"values":null}` 清空。
- 返回 `{"labels":["力量","意志","洞察","敏捷","智力","体质"],"scale":100,"values":[...]}`。

六项均为 0–100 整数，从顶部顺时针为力量、意志、洞察、敏捷、智力、体质；未录入返回 null。员工登记、编辑接口也接受 `attributes` 数组或 null。玩家个人资料与员工名录读取同一份值，不提供玩家自行修改接口。空值显示空雷达图。

## 本地演示

独立预览数据库中的 DEMO-ARCHIVE 用咖啡机原文示范可选模块；预览账号六维为演示数值。它们不属于正式数据迁移。牌桌复用登录页 company-emblem-plain.svg，作为不可交互的浅色底纹。

## 可选文本效果

管理端可在档案描述、特殊收容措施和补充资料正文中选中文字，点击“插入遮盖”或“入场乱码”。保存为 `[遮盖]内容[/遮盖]`、`[乱码]内容[/乱码]`，仅这些受控标记会转换为显示效果，其他 HTML 仍转义。遮盖内容悬停或键盘聚焦可查阅；乱码在入场时切换两次并于 95ms 恢复，普通点击不重播。关闭特效或减少动态效果设置下不播放乱码。
