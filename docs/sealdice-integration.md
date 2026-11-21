# 六维与海豹同步

网站提供管理端导出和供海豹适配器读取的快照。数值来源为网站员工档案，方向为网站到海豹。玩家的角色卡只有力量、意志、洞察、敏捷、智力、体质六项。

## 管理端操作

员工管理 → 登记员工 → 批量导入，提供两个导出按钮：

- **导出六维 CSV**：导出已完整登记六维的真实玩家与企划组成员，包含姓名、QQ 号和六项数值。UTF-8 BOM 和带引号单元格便于 Excel 打开。
- **导出海豹同步 JSON**：使用下述快照格式，供适配器批量读取。按登记 QQ 号唯一匹配账号，界面列出 QQ 待登记、匹配冲突与六维待完善的档案。

管理读取地址为 `GET /api/admin/employees/attributes/export`，使用管理员登录会话；返回同步快照，以及供 CSV 使用的 `exportRows`、管理清单 `issues` 和接口配置状态 `syncEnabled`。

## 海豹端拉取接口

部署环境设置 `SEALDICE_SYNC_TOKEN`，长度为 32–512 字符，建议使用 `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` 生成专用随机值。Compose 已通过 `env_file: .env` 读取配置，修改后重建服务。

配置为空时接口保持关闭。启用后，通过 HTTPS 请求：

```http
GET /api/integrations/sealdice/attributes
Authorization: Bearer <SEALDICE_SYNC_TOKEN>
```

接口只读，专用密钥仅放在服务端与海豹端配置中。响应沿用站点 `Cache-Control: no-store`。管理端会话和同步密钥各自校验。

```json
{
  "schema": "aved.six-attributes.v1",
  "direction": "website-to-sealdice",
  "labels": ["力量", "意志", "洞察", "敏捷", "智力", "体质"],
  "revision": "<整个快照的 SHA-256>",
  "records": [{
    "employeeId": 123,
    "name": "员工姓名",
    "qqNumber": "123456789",
    "attributes": {"力量": 60, "意志": 70, "洞察": 50, "敏捷": 40, "智力": 80, "体质": 60},
    "revision": "<该记录的 SHA-256>"
  }]
}
```

快照选择启用的真人员工、玩家收容物和企划组成员，排除 NPC、公司机器人和特殊账号 `AVED`。同步要求 QQ 为 5–12 位数字、唯一对应一份符合条件的档案，并已完整登记六维。数值保持原值，收容物超过 100 的数值同样保留。QQ 为字符串。

适配器可每 5 分钟拉取；整体 `revision` 相同则跳过处理，单条 `revision` 相同则保留海豹已有写入结果。首次连接时核对 QQ、角色卡名称与群绑定，写入网站六维后读回核对，并记录最后成功修订号。角色卡由海豹管理，网站快照中移除的记录由维护者核对其绑定关系。

## 海豹侧适配约定

[海豹核心指令](https://docs.sealdice.com/use/core.html)提供 `.st` 属性指令及角色卡管理；[官方 JavaScript API 列表](https://docs.sealdice.com/advanced/js_api_list.html)列出类型化变量接口和消息上下文相关接口。具体调用以部署版本的 `seal.d.ts` 与源码为准。

目前实际版本、QQ 接入方式及目标群尚待维护者确认，网站端接口和导出已经准备好。接入时按以下顺序完成：

1. 维护者提供海豹版本、QQ 平台账号标识格式、目标群与角色卡命名约定。
2. 在海豹插件中配置网站地址与专用密钥，将登记 QQ 映射到平台用户标识，并选择对应群的角色卡上下文。
3. 使用该版本支持的属性写入方式，依次写入六个中文属性。既有角色卡的其它资料由海豹维护。
4. 先对测试账号进行一次写入和读回，覆盖普通数值、收容物超限数值、改值、缺少 QQ、重复拉取及绑定变更，再启用定时同步。

QQ 接入器负责消息通道；角色卡的数值同步由海豹插件完成。这份 JSON 是 AVED 同步协议，配套适配器读取后写入海豹角色卡。
