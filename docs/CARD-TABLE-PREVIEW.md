# 员工牌桌

更新：2026-11-15。

从娱乐空间进入智斗太姥，可选择三人或四人牌桌，创建联机房间、加入其他玩家、使用电脑补位。

三人模式使用一副 54 张牌，四人模式使用两副 108 张牌。服务端处理叫分、合法出牌、轮次、托管、胜负与账户结算，房间状态保存于 SQLite，通过 SSE 推送玩家视图。

## 战绩榜

最近 5 天的胜场分别进入「最强太姥榜」和「最强少姥榜」，各展示前 5 名。联机对局至少有两位真人时计入战绩：地主获胜记录真人地主，农民获胜记录胜方真人农民。新记录从榜单功能启用后累计。

榜单采用墨绿色像素表头，第一名及并列第一带「榜首」标记。

## 维护入口

牌桌逻辑见 `server-card-table.mjs`，账户结算见 `server-card-wallet.mjs`，战绩记录见 `server-card-rankings.mjs`，前端规则与交互见 `public/ddz-rules.js`、`public/ddz-ui.js`。

牌型识别部分改编自 [NFraw/Tongzhuo](https://github.com/NFraw/Tongzhuo/blob/main/games/landlord/hand.ts)，采用 MIT 许可证。授权文本见 `third-party/tongzhuo-LICENSE.txt`，上游参考文件保留于 `tools/vendor/tongzhuo-hand.ts`。
