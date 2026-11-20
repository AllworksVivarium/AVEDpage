# 第三方项目、素材与音乐引用

更新：2026-11-20。本清单供开发维护、来源查询和许可核对使用。许可条款见各项目原文；音频、原始压缩包、购买凭证和账号凭据通过专用存储管理。

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
| 既有设计与研究字体资源 | 设计试验、保留的历史字体资源 | public/assets/fonts/design、study；页面启用字体见 @font-face 引用 |

## 酒吧图像与界面素材

| 作者或素材 | 接入范围 | 来源记录 |
| --- | --- | --- |
| ミキミキ建築（旧名 ミキ美術，@Mikiproject_4） | 用户购买的酩酊版、泥酔版、熟悉酒瓶套装，共 86 款可售饮品与原空 SHOT 杯 | [付费素材逐图索引](bar-paid-asset-index.json)、[原包说明与接入记录](bar-assets-source.md) |
| FFlann / Cocktail Bar — Free Pixel Icon Pack | 8 款瓶装酒与鸡尾酒 | [作者与项目链接、原包校验值](bar-assets-source.md#fflann-饮品素材2026-11-19) |
| Helm3t / Cocktail Pixel Asset Pack v1、v2 | 6 款鸡尾酒 | [接入记录](bar-assets-source.md#helm3t-免费鸡尾酒2026-11-19)、[v1 许可](licenses/helm3t-v1-free.txt)、[v2 许可](licenses/helm3t-v2-free.txt) |
| 用户提供的包装、角色、制服与界面图片 | 能量果冻、部门资料卡、制服、部分图标与论坛反应图片 | 原始用户资料与接入记录 |

React Bits 的 Gradient ASCII 页面为字符背景的效果参考。

## 音乐专辑

| 作者 / 合辑 | 专辑 | 来源与记录 |
| --- | --- | --- |
| Purrple Cat | City Nights、Multiverse | [曲目与来源清单](music/purrple-cat-albums.json)、[CC BY 4.0 原文](licenses/purrple-cat-music-CC-BY-4.0.txt) |
| Tomality | Neon Reverie（原素材包 Free Game Music Sampler Vol. 1） | [项目来源与许可记录](licenses/tomality-free-sampler-20261119.txt)、[曲目清单](music/additional-free-albums.json) |
| Voltz Supreme | Analog Ambience | [项目来源与许可记录](licenses/voltz-supreme-analog-ambience-20261119.txt)、[曲目清单](music/additional-free-albums.json) |
| 用户提供合辑 / Various Artists | Nocturne for Dramoir，11 首 | [曲目、演奏者、时长和 SHA-256](music/nocturne-for-dramoir.json)；用户提供的“音乐文件.zip” |

Nocturne for Dramoir 使用每首录音已有的演奏者信息，专辑作者统一为 Various Artists。原始 ID3 专辑名称另存于清单。导入内容为 11 个完整原始 MP3。

## 上传与播放维护

- 管理端：酒吧音乐 → 添加曲目 → 上传音频。支持 MP3、M4A、AAC、OGG、WAV，单文件上限 32 MiB，时长 30–900 秒；需管理会话，服务端校验格式头与大小。
- 上传接口：POST /api/admin/bar-music/upload。JSON 字段为 title、artist、albumArtist、album、trackNumber、durationSeconds、fileName、data（Base64）；许可与来源字段可选，未知时留空。后续仍可通过管理端编辑、启停和移除。
- 批量入口：tools/import-bar-albums.mjs <音频目录> <manifest路径>。按曲名、作者、专辑匹配并去重；导入前校验清单中的文件 SHA-256。凭据通过 AVED_BAR_IMPORT_COOKIE 提供。
- 音频通过上传或导入进入 DATA_DIR/bar-music，数据库保存目录和元数据；代码通过 Git 发布。
- 无人点歌时随机播放；有点播时按公共队列播放，并按服务器时间对齐进度。
- 点歌页面的“试听”为免费的本地完整播放。页面保持打开时可听完；关闭点歌页面后恢复公共音乐当前进度，遵守原静音设置。新歌直接使用完整音频，已有试听文件继续保留。
- 数据备份采用每日一份、五日一份的滚动快照。

线上代理在管理域名的 HTTPS server 内接入 deploy/nginx-music-upload-location.conf，音乐上传接口的 Base64 JSON 请求上限为 48 MiB；其他路由沿用各自限额。修改后先 nginx -t，再 reload。应用校验管理身份、文件格式及 32 MiB 的单音频限额。

## 酒吧进门铃声

- 素材：Shop door bell，775noise / freesound_community。
- 来源：https://pixabay.com/sound-effects/film-special-effects-shop-door-bell-6405/
- 许可：https://pixabay.com/service/license-summary/ （Pixabay Content License）。
- 使用文件：public/assets/bar/shop-door-bell-short.mp3。
- 处理：取原件 0.30–1.50 秒的第一声门铃，保留约 1.2 秒；头部 10 ms 淡入、末尾 250 ms 淡出，音量乘 0.7。
- 播放条件：初始在座列表加载完成后，有其他客人新加入。
- 开发时使用 FFmpeg（通过 npm ffmpeg-static 取得）离线裁剪，网页播放裁剪后的 MP3。
