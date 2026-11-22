# 维护工具

命令从仓库根目录运行，Node.js 版本与网站服务保持一致。

| 工具 | 用途 |
| --- | --- |
| `admin-account.mjs` | 查看管理员与交互式重置主密码；使用服务器 `DATA_DIR` |
| `import-bar-albums.mjs` | 音乐专辑导入函数，由受控维护脚本调用 |
| `optimize-images.mjs` | 处理图片并输出优化素材 |
| `local-type-design.mjs` | 排版预览辅助 |
| `player-text-source.mjs` | 管理端文字定制的共享源码解析器 |
| `bench.mjs`、`bench-probe.mjs` | 本地性能测量 |
| `terminal-utilities.css` | Tailwind 构建输入，使用 `npm run build:css` |
| `vendor/` | 解析工具依赖及对应许可 |

本地启动入口为根目录 `local-preview.mjs`；部署与定时维护入口见 `deploy/`。
