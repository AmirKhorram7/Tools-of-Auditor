# Knowledge — business logic

Personal notes, the way Notion or Obsidian keep a tree of pages. Each person owns their own tree. There is no sharing and no company tenancy.

The API is `/api/v1/knowledge/`. “Today” is the date in Asia/Tehran.

## Tree

A node is a folder or a page. Folders hold children. A page cannot be a parent.

- Depth is not limited by the product. The server refuses a branch deeper than 40, so a bad client cannot create an endless chain.
- Order among siblings is an integer `position`. Moving a node rewrites that order and the path of everything under it.
- A node cannot be moved under itself or under one of its descendants.
- The tree call returns one flat list: id, parent, type, title, icon, path, depth, position. It does not return page bodies.
- Path is the chain of ids, including the node itself, such as `5/8/`.

## Pages

A page body is one JSON document (`type: doc` and a list of blocks). The server does not care which editor produced it. It reads `type`, `text`, `content`, and `attrs`.

- Saving a title or a body requires the `version` the client last read. If the page has moved on, the save is rejected with 409 and the current version. Renaming a folder or changing an icon does not use the version.
- A body cannot be larger than 200 KB.
- On every save the server stores a plain-text copy (`content_text`) for search, and rebuilds the page’s outgoing links.

## Trash

Delete is soft, and it takes the children with it. Restore works for 30 days and brings back descendants that were deleted in the same action. After 30 days restore is refused. If the parent is still in the trash, the restored node is placed at the root.

## Links

A link is a row from one page to another, unique per pair.

- A block `type: wikilink` with `attrs.id` or `attrs.nodeId` is a link.
- `[[123]]` in text is a link to that id. `[[Title]]` resolves to the owner’s page with that title, ignoring case. The oldest match wins.
- A page does not link to itself. A link to someone else’s page is dropped.
- The row keeps the target id. Renaming the target does not break the link. Deleting the target leaves the row, and the API marks it broken.

## Search

- Full search needs at least 2 characters. It matches title and `content_text`, case-insensitive, and can be limited to one folder and its descendants.
- Rank is exact title, then title prefix, then title contains, then body.
- Title search is a prefix match for the wikilink picker. It does not search the body.

## Daily note

`GET /daily/?date=YYYY-MM-DD` returns the page for that date, or creates it. The page lives under a root folder titled `Daily`. The page title is the ISO date. One daily page per owner per date.

## Study plan

A plan has a title, a start date, and a number of days (default 30, at most 366). Creating it writes one row per day, status `todo`.

- A day may be assigned a course folder owned by the same person. A page is not a course.
- Status is `todo`, `doing`, or `done`.
- The first time a day becomes `done`, and it has a course folder, three reviews are created on that folder: 1, 3, and 7 days after the day’s date. Marking it done again does not add more. Moving it back to `todo` leaves the reviews in place. A done day with no folder creates no reviews.
- Shift moves every remaining day (today or later, and not done) by N days, from 1 to 60 in either direction. Open reviews on those days move with them, keeping the same 1 / 3 / 7 gap from the new date. Finished reviews stay.
- Progress is days done, overdue days (before today and not done), and the streak of consecutive done days ending today, or yesterday if today is not done.
- Today returns the plan days dated today, reviews that are due on or before today and not finished, and today’s daily note (created if missing).

## Templates

Each owner gets a Course template the first time templates are listed, if they do not already have one with that title. Its sections are Goal, Key facts, Questions, and Summary. Creating a page with `template_id` copies that body. Templates are private to the owner.

## Ink and files

- Ink is strokes on a page: a list of points, plus width and height. At most 500 KB, 8,000 points, and coordinates inside 8,000.
- A file on a page is an image (jpeg, png, webp, gif) or a PDF, up to 8 MB. The response includes the file URL.

## Export

- A page exports as Markdown. Wikilinks become `[[Title]]`. Each drawing is referenced as `ink-{id}.svg` (the file is not generated).
- A folder exports as a zip of Markdown files in the same tree.

## Appearance

The Knowledge screen has its own themes. They are stored in the browser under `ta_knowledge_theme` and painted only on that screen. The platform light/dark switch is left alone.

Text colour and highlight use seven named tokens (red, orange, gold, green, blue, purple, gray). The document stores the token name, not a hex value. Each theme paints the token with a light or dark value so the same note stays readable. Callouts use the same tokens and always show a label. Font, size, and line height are chosen in Look and stored in the browser.

Five are dark: Platform (navy and orange, the default), Amir Dark Mode (warm ink and gold), Obsidian, VS Code Dark, and Nord. Two are light: Paper and Daylight.

## Left out on purpose

Configurable review gaps, thumbnail generation, OCR, a link graph, realtime collaboration, sharing, offline sync, AI, and custom properties.
