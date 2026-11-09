# Forum terminal status

Forum authors have a small green pixel indicator while their terminal is active, a short activity label, and a viewer-only “我的发言” label for their own non-persona posts. Anonymous authors keep a generic NOINFO avatar; real posts retain uploaded/preset avatars. No status picker or invisibility mode is added. Activities describe the open section, not a server-certified game action.

The existing reminder poll now uses `POST /api/player/forum/notifications` every 30 seconds, combining reminders, a tab heartbeat, up to 64 rendered author status keys, and the current thread's reply revision check. It fetches the reply page only when a reply changes. The former 10-second forum page poll is removed. Navigation updates are debounced; hidden tabs stop polling and send one inactive update. An inactive tab does not hide another active tab belonging to the same employee.

Presence is memory-only and expires after 75 seconds without a heartbeat. It stores no balances, browsing history or post content. Public keys are HMACs scoped separately for anonymous and real posts; employee IDs are stripped from public author rows. Personas use the linked robot employee rather than the operator's status. The database is not written for heartbeats. Existing GET notification clients remain supported.

This release also includes the completed card-table drag selection, persistent last-player indicator, named computer reactions and room-specific settlement explanations. Existing monetary rules and saved-round settlement snapshots remain authoritative.
