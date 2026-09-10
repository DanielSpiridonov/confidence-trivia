# Confidence Trivia Moderation Policy

## Report workflow

1. New reports enter `player_reports` with status `pending`.
2. Review the reported name and incident description without revealing the reporter.
3. Change the report to `reviewed` while investigating.
4. Finish it as `resolved` when action is taken, or `dismissed` when no violation can be established.
5. Keep `resolution_note` short and factual; do not add unnecessary personal information.

## Version-one actions

- First confirmed offensive-name violation: set `moderation_status` to `rename_required`. A successful rename restores `active` status and bypasses the normal 30-day cooldown.
- Repeated offensive-name violation: set `moderation_status` to `suspended` and `suspended_until` to 24 hours after the action.
- Harassment or cheating: review manually before applying a penalty.
- Severe or repeated abuse: set `moderation_status` to `banned`.
- Clearly false reports: dismiss them. Repeated malicious reporting may be treated as abuse.

## Enforcement and access

Players marked `rename_required`, currently `suspended`, or `banned` cannot enter games or use protected social/economy endpoints. They retain access to their profile, the required rename action, sign-out, and account deletion. An elapsed temporary suspension permits access again without deleting its audit state.

Only trusted project administrators may update report or moderation fields. The reporter's identity must never be disclosed to the reported player.
