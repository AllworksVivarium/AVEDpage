# AVED typography ownership

The terminal topbar (`.compact-terminal-header`, including its brand and actions) retains its existing fonts, weights and sizes. Do not change inherited type variables on `body` or `#inner-app-view` when updating page typography.

`public/typography.css` supplies shared font resources and named font stacks. Each page and each named window opts into its own text roles. Window chrome owns geometry and color, not a universal `dialog *` font override. The early CSS layer bridges older component layers; use narrowly scoped selectors when replacing old rules, not additional wildcard overrides.

| Role | Family | Size / weight |
| --- | --- | --- |
| Page heading | Noto Serif SC with Plex Sans for Latin/Hebrew | 32px desktop, 28px mobile / 700 |
| Section / card heading | Same heading stack | 18px / 700; forum cards 16px |
| Archive and notice prose | Jinghua Old Song, with Plex Sans for Latin/Hebrew | 16px / 400, 1.85 leading |
| Conversation prose | IBM Plex Sans Latin + SC + Hebrew | 14px / 400, 1.75 leading |
| Author | Plex Sans | 13px / 600 |
| Explanations / labels | Plex Sans | 12px / 400 |
| Window header / button | Plex Sans | 12px / 600 |
| Editable text | Plex Sans | 16px / 400 |
| Time / secondary label | Plex Sans | 11px / 400 |
| Short decorative HUD label | Plex Sans | 10px / 400; four profile key subtitles use 9px at <=380px; never use for essential instructions |
| Numeric readout / identifier | IBM Plex Mono | Component-specific size, tabular numbers |
| Game illustrations | Existing pixel faces | Retain artwork; rules and forms use readable UI text |

Latin UI text uses proportional Plex Sans, rather than mixing Courier, JetBrains Mono and italic labels. Hebrew uses the matching Plex Sans Hebrew, with no artificial letter spacing; retain RTL/isolation on Hebrew labels. Semibold resource files supply the UI emphasis range (600–700), so browsers do not synthesize a heavier outline. The existing archived Song font stays at its native regular weight.

Window sizes: small 360px; form/reminder 440px; long rules/workshop 580px; management editor 680px. Mobile widths leave 20px on each side (16px below 360px); content scrolls within a height limit and headers remain 30px. Existing award illustrations retain their own scale.

Review adjustments: the sidebar retains its original serif/mono navigation treatment. Its sound console is removed; the hidden shared sound state still drives the personal home switch. The casino heading/navigation use 愉乐空间. Scratch tickets have no nested play-table frames or repeated heading: quick-reveal and next-ticket buttons share a single row above the ticket. All three ticket hero headers use 164px minimum height, with reduced kicker/title/ribbon spacing. The local bomb preview is available only from the local confirmation window.

The release integrates `codex/typography-20261109`, the completed window work from `codex/window-consistency-20261109`, and the completed forum/stake changes captured from the original workspace. Window behavior and the shared popup helper are included; component-owned fonts take precedence over the removed universal font-family override. New forum search/sort controls explicitly own their field spacing and borders so legacy reset rules cannot flatten them.

Local preview: port 14234, isolated `data-local` database with synthetic discussion examples. `public/typography-preview.local.html` is ignored and provides 360/390/430px frame previews. No production account, balance or discussion data was changed.

Validation on 2026-11-09: inspected desktop and 360/390px previews, light/dark appearance, profile editor, forum/reminder, notice reading, card rules and management editor. The topbar's computed font families, sizes, weights and spacing match the pre-change baseline. Four changed stylesheets parse successfully; `reading-style`, `community-polish` and `card-display` pass (9 tests). Proof images are in the parent workspace's `outputs/typography-20261109/` directory. These are scoped typography checks, not a full gameplay regression.
