# 第三方项目、素材与音乐引用

更新：2026-11-19。本清单供开发维护、来源查询和许可核对使用。许可原文优先于本页摘要；音频、原始压缩包、购买凭证和账号凭据不随源码入库。

## 代码与字体

| 项目 | 用途 | 来源与许可记录 |
| --- | --- | --- |
| Node.js / SQLite | 服务端运行时与数据库 | Node.js 内置 SQLite；运行版本见 Dockerfile |
| Sharp 0.35.5 | 图片读取、缩放、压缩、头像处理 | package.json、package-lock.json；依赖内附 Apache-2.0 许可 |
| Tailwind CSS 3.4.17 | 构建既有工具类样式 | package.json；MIT |
| Quill 2.0.3 / Slab | 生活记录文字编辑，按需加载 | https://quilljs.com/ 、https://github.com/slab/quill ；public/vendor/quill-2.0.3/LICENSE，BSD-3-Clause |
| Masonry 4.2.2 / David DeSandro | 生活记录大小卡片自动布局，按需加载 | https://masonry.desandro.com/ ；public/vendor/masonry-layout-4.2.2/LICENSE.html，MIT；打包依赖版权声明保留在源码内 |
| pattern.css 1.0.0 / bansal | 生活记录页小型网格纹样 | https://github.com/bansal/pattern.css 、https://bansal.io/pattern-css ；原包 package.json 声明 MIT，见 public/vendor/pattern.css-1.0.0/NOTICE.txt |
| NFraw / Tongzhuo | 斗地主牌型分类参考，已适配本站四人规则 | public/ddz-rules.js 文件头记录原文件与 blob；[MIT 原文](../public/licenses/tongzhuo.txt) |
| Radix Colors | 既有调色与控件色彩基础 | [许可原文](../public/licenses/radix-colors.txt)；当前主题由本站配色配置维护 |
| emoji-picker-element 1.29.1 / emoji-picker-element-data | 论坛表情选择器与中文表情数据 | public/vendor/emoji-picker-element-1.29.1 中的 LICENSE、DATA-LICENSE，Apache-2.0 |
| IBM Plex | 拉丁字母、简中、希伯来文、等宽字体 | [来源记录](../public/assets/fonts/TYPOGRAPHY-SOURCES.md)、OFL-IBM-Plex.txt |
| Silkscreen | 像素字体 | [OFL 原文](../public/assets/fonts/OFL-Silkscreen.txt) |
| 既有设计与研究字体资源 | 设计试验、保留的历史字体资源 | public/assets/fonts/design、study；不将目录中存在等同于当前玩家页启用，具体字体见实际 @font-face 引用 |

## 酒吧图像与界面素材

| 作者或素材 | 接入范围 | 来源记录 |
| --- | --- | --- |
| ミキミキ建築（旧名 ミキ美術，@Mikiproject_4） | 用户购买的酩酊版、泥酔版、熟悉酒瓶套装，共 86 款可售饮品与原空 SHOT 杯 | [付费素材逐图索引](bar-paid-asset-index.json)、[原包说明与接入记录](bar-assets-source.md) |
| FFlann / Cocktail Bar — Free Pixel Icon Pack | 8 款瓶装酒与鸡尾酒 | [作者与项目链接、原包校验值](bar-assets-source.md#fflann-饮品素材2026-11-19) |
| Helm3t / Cocktail Pixel Asset Pack v1、v2 | 6 款鸡尾酒 | [接入记录](bar-assets-source.md#helm3t-免费鸡尾酒2026-11-19)、[v1 许可](licenses/helm3t-v1-free.txt)、[v2 许可](licenses/helm3t-v2-free.txt) |
| 用户提供的包装、角色、制服与界面图片 | 能量果冻、部门资料卡、制服、部分图标与论坛反应图片 | 保留原始用户资料与现有接入记录；未附来源的项目不虚构作者或授权 |
| 本站生成或自行绘制素材 | 临时调酒师、部分界面图、SVG 杯具、背景效果 | [酒吧生成与分层记录](bar-assets-source.md)；当前背景为原生 Canvas/CSS 实现 |

React Bits 的 Gradient ASCII 页面曾作为字符背景的效果参考。当前字符涌流、符号瀑流、相位点阵与制图网格使用本站 Canvas 代码，没有引入 React Bits 运行库。Kelano Studio、CydoniaX 等在素材记录中列为检索候选的项目，未因列举而视为已经购买或使用。

## 音乐专辑

| 作者 / 合辑 | 专辑 | 来源与记录 |
| --- | --- | --- |
| Purrple Cat | City Nights、Multiverse | [曲目与来源清单](music/purrple-cat-albums.json)、[CC BY 4.0 原文](licenses/purrple-cat-music-CC-BY-4.0.txt) |
| Tomality | Neon Reverie（原素材包 Free Game Music Sampler Vol. 1） | [项目来源与许可记录](licenses/tomality-free-sampler-20261119.txt)、[曲目清单](music/additional-free-albums.json) |
| Voltz Supreme | Analog Ambience | [项目来源与许可记录](licenses/voltz-supreme-analog-ambience-20261119.txt)、[曲目清单](music/additional-free-albums.json) |
| 用户提供合辑 / Various Artists | Nocturne for Dramoir，11 首 | [曲目、演奏者、时长和 SHA-256](music/nocturne-for-dramoir.json)；来自用户提供的“音乐文件.zip”，未附许可或来源网址，不标注为 CC 或免版权音乐 |

Nocturne for Dramoir 保留每首原有演奏者；专辑作者统一为 Various Artists。无署名的文件不推测演奏者。原始 ID3 专辑名称另存于清单，不覆盖用户指定的合辑名称。移除 macOS 资源叉文件，仅导入 11 个原始 MP3，音频未剪切、未转码、未归一化。

## 上传与播放维护

- 管理端：酒吧音乐 → 添加曲目 → 上传音频。支持 MP3、M4A、AAC、OGG、WAV，单文件上限 32 MiB，时长 30–900 秒；需管理会话，服务端校验格式头与大小。
- 上传接口：POST /api/admin/bar-music/upload。JSON 字段为 title、artist、albumArtist、album、trackNumber、durationSeconds、fileName、data（Base64）；许可与来源字段可选，未知时留空。后续仍可通过管理端编辑、启停和移除。
- 批量入口：tools/import-bar-albums.mjs <音频目录> <manifest路径>。按曲名、作者、专辑匹配，重复导入不新增相同记录；导入前校验清单中的文件 SHA-256。凭据通过 AVED_BAR_IMPORT_COOKIE 提供，不写入仓库。
- 音频进入 DATA_DIR/bar-music，数据库保存目录和元数据；Git 上传代码不会自动上传音频。
- 无人点歌时随机播放；有点播时按公共队列播放，并按服务器时间对齐进度。
- 点歌页面的“试听”仅在当前浏览器播放完整原文件，不收费、不加入公共队列、不改变他人播放。页面保持打开时可听完；关闭点歌页面后恢复公共音乐当前进度，遵守原静音设置。后续新歌不制作独立试听片段，已有文件不因本次修改删除。
- 数据备份继续采用每日一份、五日一份的既定规则，不生成更新前快照。

线上代理需要在管理域名的 HTTPS server 内接入 deploy/nginx-music-upload-location.conf，仅对音乐上传接口允许 48 MiB Base64 JSON 请求；其他路由继续原有大小限制。修改后先 nginx -t，再 reload。应用仍强制单个音频不超过 32 MiB，代理放宽不等于绕过管理身份或文件校验。

## 酒吧进门铃声

- 素材：Shop door bell，775noise / freesound_community。
- 来源：https://pixabay.com/sound-effects/film-special-effects-shop-door-bell-6405/
- 许可：https://pixabay.com/service/license-summary/ （Pixabay Content License）。
- 使用文件：public/assets/bar/shop-door-bell-short.mp3。
- 处理：取原件 0.30–1.50 秒的第一声门铃，保留约 1.2 秒；头部 10 ms 淡入、末尾 250 ms 淡出，音量乘 0.7。未加入其他来源音频。
- 仅对在座列表中新加入的其他客人播放；初次进入及相同快照不补响。
- 离线裁剪工具：FFmpeg（通过 npm ffmpeg-static 取得），仅用于开发时生成短门铃，不作为网页运行依赖或随网站分发。
