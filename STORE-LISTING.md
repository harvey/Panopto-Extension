# Chrome Web Store listing copy

Three fields, two very different costs:

| Field | Where | Cost to change |
|---|---|---|
| **Overview** (16,000 max) | Developer dashboard → Store listing | **Instant, no review** |
| Title (75 max) | `manifest.json` `name` | **Package review** |
| Short description (132 max) | `manifest.json` `description` | **Package review** |

The Overview is the long body on your listing page — everything from
"SET CUSTOM SPEED ON PANOPTO VIDEOS" down to the GitHub link. **The replacement
below is the whole thing; paste it over the entire current Overview.** It goes
live as soon as you save.

Note that your Overview currently opens with the same sentence as the manifest
short description ("Allows you to set custom speeds on Panopto. New AI features
available."). Those are two separate fields that happen to hold the same text.
The Overview copy is yours to change today; the manifest one needs a release.

There is **no keyword field** on the Chrome Web Store. Relevance comes from the
title and the two descriptions, and ranking also weighs ratings and installs.

---

## Overview — paste this over the whole current Overview, today

> Panopto caps playback at 2x. This removes the cap, and then turns the lecture
> you just watched into notes you can actually revise from.
>
> SPEED
> • Any speed from 0.5x to 3x, typed in or dragged — not just the presets.
> • Silence Skipper cuts the dead air between sentences. A rambling 60-minute
>   lecture finishes in closer to 35.
> • Your speed is remembered between lectures.
> • Picture-in-picture, so the lecture follows you to another tab.
>
> AI STUDY TOOLS
> • Lecture notes generated from the transcript in about 30 seconds, with
>   screenshots of the slides pulled in at the right moments.
> • Flashcards exported straight to Anki as a .apkg file. Import and revise.
> • Ask questions about the lecture and get answers with timestamps, so you can
>   jump back to the moment it was explained.
> • Live caption translation and dubbing, for lectures that aren't in your first
>   language.
> • Transcripts and lecture downloads for offline revision.
>
> MADE FOR HEAVY LECTURE LOADS
> If your course records everything and you revise from Anki, the flashcard
> export is the whole reason this exists — lecture in, deck out, no retyping.
>
> If lectures aren't in your first language, the translation and dubbing turn
> a second listen into a first one.
>
> HOW TO START
> 1. Install, then refresh your Panopto page.
> 2. Open any recorded lecture.
> 3. The speed control appears in the player's settings menu. Everything else
>    is behind the extension icon in your toolbar.
>
> FREE AND PAID
> Custom speed, Silence Skipper, picture-in-picture, dark mode and the
> time-saved leaderboard are free forever. AI notes, flashcards, chat and
> translation are limited on the free plan and unlimited on premium, from £12
> a year with a free trial.
>
> IF IT DOESN'T WORK ON YOUR UNIVERSITY'S PANOPTO, EMAIL ME AND I WILL FIX IT.
> I'm a student who built this for my own lectures and I reply the same day.
>
> Privacy: lecture text is sent to the AI provider only when you ask for notes,
> flashcards, chat or translation. Nothing is recorded or sold.
> Full policy: https://harveychandler.dev/Panopto-Extension/panopto-privacy-policy.txt
>
> Not affiliated with or endorsed by Panopto, Inc. Panopto is a trademark of
> its owner.
>
> https://github.com/harvey/Panopto-Extension

---

## Short description — 132 max, ships with the next release

```
Watch Panopto lectures past the 2x cap, then turn any lecture into AI notes, Anki flashcards, transcripts or translation.
```
121 characters. The current one is 70, so this recovers 51 characters of the
second-most-weighted field on the listing.

## Title — 75 max, ships with the next release

Keep it. `Panopto Custom Speed - AI Notes, Flashcards & Translation` (57) is
already good: the head term is first, and you rank #1 for "panopto" in every
locale tested, so there is nothing to gain and an existing anchor to lose.

Do **not** put "download" or "downloader" in the title. Panopto shipped a native
download in Aug 2026, and it is the feature most likely to attract a complaint
from a university IT department.

---

## What changed and why

**Dropped "Gemini & Claude powered".** Nobody searches for the model, it dates
the listing every time you switch, and it spends the most valuable line in the
description on an implementation detail. Also: free users are Gemini-only, so
naming Claude up front oversells what most installers get.

**Lead with the 2x cap, not "allows you to set custom speeds".** The cap is the
thing people are annoyed about and the thing they describe when they search.

**Anki promoted out of parentheses.** It was in brackets inside a sub-bullet.
It is the single strongest hook you have for the audience you already have.

**Audience stated without a discipline list.** The first version named seven
disciplines in one sentence and the store rejected it as keyword spam
(violation "Yellow Argon", 6 Sept 2026). The audience is now implied by the
behaviour ("if your course records everything and you revise from Anki") rather
than enumerated. Do not reintroduce a list of subjects, universities, or
product names — that is exactly the pattern the reviewer flags.

**Removed "Added Edge & Other Chromium Browser Support" and "Language support
added".** Changelog lines, not reasons to install. The Edge line is also
misleading — the Edge listing is on v2.2 from Feb 2025.

**Kept the shouty support line.** It reads as a real person and your reviews
show people value it. Moved it lower so it isn't competing with the pitch.

**Added a privacy line and a trademark disclaimer.** The extension ships lecture
transcripts to a server and on to an AI provider, and the package contains no
privacy disclosure at all. Both are overdue and both reduce takedown risk.

---

## Rejection history

- **6 Sept 2026 — "Keyword spam" (ref Yellow Argon).** Flagged line: *"Medical,
  pharmacy, dentistry, optometry, nursing, veterinary and law students"*. Removed,
  along with the Recap/uRewind rebrand sentence as the same category of risk.
  Resubmit the Overview above as-is.
