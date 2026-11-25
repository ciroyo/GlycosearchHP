# Glycosearch website (redesign 2026)

Static research website for glycosearch.com. No framework and no runtime dependency: a Node script renders
HTML from one structured content base; the browser gets plain HTML, one stylesheet and two small ES modules.

## Start the preview

```bash
cd site                     # from the repository root
node scripts/build.mjs      # writes dist/ (about 360 MB incl. all original PDFs, images and page renders)
node scripts/serve.mjs      # http://127.0.0.1:4173/
```

`npm run preview` does both. Requirements: Node 20 or newer, macOS (`sips` creates the web-sized image copies).

## Checks

```bash
node scripts/check.mjs --url http://127.0.0.1:4173 \
  --inventory check-data/linkinventar.json \
  --manifest check-data/dateimanifest.json
node scripts/check-links.mjs   # external link status -> content/link-status.json (network needed)
```

`check-data/` holds unchanged copies of the two independent reference files (link inventory of the old live site of 24 Nov 2026, file manifest of the files supplied on 25 Nov 2026), so a fresh checkout can run the full check. `--url` needs the running preview server.

`check.mjs` verifies (state 25 Nov 2026, fourth round: 4595 checks without the optional arguments, 4731 with inventory, manifest and URL): 19 papers (14 from the live site, 5 added) and 4 projects,
every action of the 2026-11-24 link inventory, PDFs and images byte-identical to the originals and to the Brain
manifest, old URLs redirecting, the seven navigation entries, the icon-link rules (name, tooltip, no written URLs,
no archive notes), the Protein ORIGAMI attribution, the glycan data model and its rendering (every residue, bond and
linkage in the text view and both symbol drawings), the profile, internal links, encoding, both chats on every page
and 30+ search questions. Since the second round also: complete page viewers of the five added papers, home video
markup and player script, the one-line footer, brand mark and favicons, the theme boot script and the contrast of
the light and dark colour tokens, the patent, the book chapter, the two filter groups, the profile links and logos,
the updated CV (texts of the DOCX and of the PDF print source) and the Thr/Ser button. Deliberate deviations from the old inventory are listed in `CHANGED` / `REMOVED` at the
top of the script. It does not judge layout, real pointer or touch input, or external availability.

## Fourth round of 25 Nov 2026

- **SPAAC (Learning):** one player (local archive video). Below it two compact source buttons, "Related paper" (paper-01, internal page) and "Video reference" (https://youtu.be/62UcawMOqnc), and the method note. Data: `content/site.json` → `learning.spaac`. The method text is the description of the referenced YouTube video (read on 25 Nov 2026: "Super Shiny Version of a Strain-Promoted Alkyne Azide Cycloaddition", channel Click Chemist, 7 s). The page does not claim that the local file is that video.
- **Accent buttons are quiet:** surface, orange outline and icon, normal text colour. Tokens `--btn-accent-*` and `--btn-disabled-*` in `src/styles.css`; the palette itself is unchanged. `check.mjs` computes the contrast of every pair in both themes.
- **Experience:** period and institution mark are one unit, centred on the axis of the date column; below 760 px the unit sits above the text.
- **Profile wording** (career paragraphs 2-5, four experience texts) edited without dropping content; the first career sentence is fixed (since the evening of 25 Nov 2026 with the title "researcher in biochemistry and molecular biology" instead of "biochemist", owner request; the About headline says just "Researcher" to stay short; the CV files were not regenerated). `check.mjs` lists the protected content items per entry. The CV has its own wording and was not rebuilt.
- **Home card "Symbol nomenclature"** renders all 18 symbols (6 x 3).
- **Chat entry:** one 44 px button in the sticky header (`[data-chat-toggle]`) opens a menu with "Ask Glycosearch" and "Support chat" (status in the menu, dot on the button). The dock and the wide header button are gone. Keyboard: Enter/Space, arrow keys, Home/End, Escape (focus returns to the button); closes on an outside press.
- **In vivo section (Learning):** the name "Dr. Bettina Weigelin (Ph.D.)" with two icon links (research group, LinkedIn) under the figure, from `learning.inVivo` in `content/site.json`; owner request, no statement about who took the image.
- **Tab title:** the Tawk widget switched `document.title` to "1 new message" and back while hidden. `src/app.js` keeps the page's own title and shows the unread count at the chat entry instead. Whether this was the reason for the "1" in the owner's browser tab is not proven; the real tab could not be inspected. Favicon links carry `?v=4`.
- **About:** "Nanoscale Glycoscience" links to https://www.kicnano.cornell.edu/ (was an archive copy of the dead `/fellows/` page).

## Third round of 25 Nov 2026 (design feedback)

- **Accent is orange.** Reference: the orange of the fox mark the owner supplied (median of its saturated pixels
  `#f96627`). Tokens in `src/styles.css`: `--brand` (the reference orange: logo mark, favicon), `--accent-fill`
  (buttons; dark text on it, because white reaches only about 3:1), `--accent` / `--accent-ink` (darker steps for
  text and outlines), `--accent-soft`, `--focus`. Nomenclature colours, institution colours and pictures are not touched.
- **Favicon**: the sugar ring in white on an orange tile (since the evening of 25 Nov 2026, owner request: easier to see in a tab; before: orange ring on transparent). `ICON_V` is 5. One shared definition (`FAVICON_LINKS` in `build.mjs`) for every page type
  incl. 404 and redirect stubs: ICO (16/32/48), PNG 16 and 32, SVG, touch icon, mask icon; a version query (`ICON_V`)
  makes browsers drop icons they cached earlier. Raster files: `scripts/make-icons.py`.
- **Experience icons**: image marks only, no plate or frame, one variant per theme (`.on-light` / `.on-dark`).
  `scripts/make-logos.py` derives them from the supplied files in `additions/logos/source/` (never modified):
  Cornell seal red / white (white from the alpha mask of the red seal, because the supplied white PNG is opaque with a
  baked-in checkerboard), Radboud University emblem red / white (paths of the supplied SVG, red from the official RU
  logo file), Vaionex symbol (cropped). Details: `additions/logos/derivatives.json`.
- **Learning figures without white boxes or frames**:
  - “Find a symbol”: 18 vector symbols generated from `content/glycans.json` → `chart` (`chartSymbol` in
    `scripts/glycan.mjs`). White halves are drawn white (content); outlines use the text colour of the theme.
  - Text nomenclature: vector text from `content/glycans.json` → `textFigure`.
  - N-/O-linked examples: the interactive drawings are the figure.
  - Glycome, Glycomics and the SPAAC preview frame: `scripts/make-learning-figures.py` writes
    `additions/learning/derived/*-light.png` and `*-dark.png` (background connected to the border and enclosed
    paper-white pockets become transparent; tinted highlights stay; in the dark variant black lettering and lines
    become light). Statistics in `derived/report.json`. The originals stay served and are linked next to each figure.
- **Home video**: still the YouTube video (no film file was supplied), now without YouTube's control bar; own
  play/pause, sound and replay buttons; after the end the player is taken out of view and a poster with Replay is
  shown. YouTube's own title and logo inside its frame cannot be controlled. When a film file arrives, replace the
  block by an HTML5 `<video>` (the control code in `src/app.js` is written around play / pause / mute / ended states).

Python for the derived files: `pip install pymupdf pillow python-docx numpy`.

## Second round of 25 Nov 2026 (owner feedback after the first revision)

- **Paper preview = the whole paper.** Papers 15–19 show every PDF page in order (`additions/pages/`, rendered by
  `scripts/render-pages.py` with PyMuPDF at 160 dpi, full page rectangle, nothing cropped). The viewer has previous/next,
  page count, a horizontal page strip (lazy thumbnails), full screen with “Actual size”, a link to the same page in
  the PDF and the PDF download. The build refuses to run if the page images do not belong to the current PDF (sha256).
  The earlier figure cut-outs stay in `additions/papers/` and are only used as list thumbnails.
- **Home**: hero video (YouTube `3NX8KXaOdgk`, IFrame API, starts muted and inline; the sound button mirrors the
  player state; if the API or the video cannot be loaded the plain video link stays). Introduction without a personal
  name, no Ask button in the hero, fact “1 patent”.
- **Learning**: the SPAAC section shows the local archive video only. The general core button of the O-glycan reads
  `GalNAcα-Thr/Ser` (`content/glycans.json`: `aglycon` = example, `aglyconGeneral` = general label).
- **Footer** is one centred line. Brand mark, `favicon.svg`, `favicon.ico`, touch icons: `scripts/make-icons.py`.
- **Patent** EP 3 360 891 B1: `content/site.json` → `patents`; own list on Publications, own detail page, own kind in
  the search index; never counted among the 19 publications. **Paper 06** is typed as book chapter
  (`papers.paper-06.addCategories`, book data in `content/bibliography.json`).
- **Filters**: Type and Category only. Old `role=` parameters are ignored and removed from the address.
- **Profile**: twelve profile links in the owner's order (X instead of Twitter), institution logos under the periods
  (`additions/logos/`, sources and brand notes in `additions/logos/SOURCES.md`), no support button under the portrait.
- **CV**: `content/cv.json` → `scripts/build-cv.py` → `additions/cv/CV.docx` (editable) and `CV.pdf` (printed with
  headless Chrome from `CV.html`). The build serves these at `/assets/CV.pdf` and `/assets/CV.docx`; the historical
  CV in `../assets/` and in the mirror is untouched and intentionally no longer served.
- **Themes**: light and dark from one token set in `src/styles.css`. A script in `<head>` applies the stored choice or
  the system setting before the first paint; without JavaScript a media query does the same. Figures, PDF pages,
  photos, logos and glycan colours are never recoloured.

Python is only needed to regenerate derived files (page images, icons, CV): `pip install pymupdf pillow python-docx`.

## Revision of 25 Nov 2026 (owner feedback)

- Navigation: Home, Research, Publications, Software, Projects, Learning, About. Learning replaces Resources
  (`/resources/` redirects); project pages moved from `/software/<slug>/` to `/projects/<slug>/` (redirects kept).
- External links are icon buttons with an accessible name and tooltip; no written URLs. Unreachable targets use
  their archived copy as a normal link, or show text only (`content/link-notes.json`, `noLink` for Respora).
- Five papers added from PDFs (`content/additions.json`, files in `additions/`): figures were cut from the PDF
  pages (PyMuPDF, 216 dpi; clip rectangles in `additions/papers/figures.json`). Superseded as preview by the
  whole-page viewer of the second round.
- Protein ORIGAMI is an applied application by Reißer et al. (2018), shown under “Applied applications” on paper 13
  and on the Software page (`content/site.json` → `tools`, `papers.paper-13.applied`), never as own software.
- Learning: interactive N-/O-glycan examples generated from `content/glycans.json` by `scripts/glycan.mjs`.
- Mouse pointer `assets/site/cursor.svg` (mouse devices only), support link (coffee icon) in the header.

## Layout

| Path | Purpose |
| --- | --- |
| `../legacy-live-2026-11-24/` | Mirror of the live site (24 Nov 2026): originals, never edited. `_mirror-report.json` lists every file with hash. |
| `content/legacy-extract.json` | Papers/projects extracted verbatim from the mirror (`scripts/extract-legacy.py`). |
| `content/site.json` | Curated content: slugs, themes, profile, resources, labels, support and chat settings. |
| `content/bibliography.json` | Journal/year/DOI read from the PDFs themselves. |
| `content/fulltext.json` | Machine-extracted PDF text, used only for search matching. |
| `content/link-notes.json` | External targets found unreachable: archived copy used as the link, or text only. Internal record, nothing of it is shown. |
| `content/additions.json`, `additions/` | The five papers added on 25 Nov 2026 (PDF originals byte-identical, figures cut from the PDFs) and the four learning figures. |
| `additions/pages/`, `additions/cv/`, `additions/logos/` | Page renders of papers 15–19, the updated CV, the institution logos with their sources. |
| `content/cv.json` | Content of the CV (bibliography from Crossref records, patent data from the EPO specification). |
| `content/glycans.json` | Residue-level data model of the N- and O-glycan examples (sugar, parent, anomer, linkage, branch, position). |
| `src/` | `styles.css`, `app.js` (UI), `search.js` (search engine shared by browser and server). |
| `scripts/` | `build.mjs`, `serve.mjs`, `check.mjs`, `check-links.mjs`, `extract-legacy.py`, `render-pages.py`, `build-cv.py`, `make-icons.py`, `make-logos.py`, `make-learning-figures.py`. |
| `MIGRATION-MAP.md` | Generated: old URL → new page → PDF/media → actions → check status. |
| `dist/` | Build output (git-ignored). This folder is what gets deployed. |

## Content rules built into the site

- Every paper/project has a stable id (`paper-01` … `paper-19`, `project-01` … `project-04`) used by pages, search and chat.
- Titles, authors and abstracts are verbatim from the old site (papers 1–14) or from the PDF (papers 15–19).
  Year/journal/DOI appear only when read from the PDF; volume, issue, pages and issue year were aligned with the
  Crossref record of each DOI on 25 Nov 2026; the two SSRN DOIs come from Crossref (title and authors matched).
- All original files keep their old path (`/papers_pdfs/…`, `/projects_pdfs/…`, `/manuals/…`, `/papers/…`).
  `/assets/CV.pdf` and `/assets/CV.docx` keep their address but serve the updated edition (second round).
- Old pages (`papers.html`, `ajax-lightbox-gallery/projectN.html`, …) are redirect stubs to the new pages.

## Support chat (Tawk.to)

The existing account is used unchanged (`content/site.json` → `support.embedUrl`). The default Tawk bubble is hidden;
the labelled “Support chat” button opens the widget and shows Tawk's real status. `support.load`: `"idle"` loads the
widget after page load (as before), `"click"` loads it only when a visitor asks for support. If Tawk is blocked, the
button offers email instead.

## Ask Glycosearch

- Without a server: a real in-browser search over the published index (`dist/assets/site/index.json`), clearly
  labelled “Website search”. Answers are templates filled from the index; nothing is generated.
- With a server: `scripts/serve.mjs` exposes `GET /api/ask/status` and `POST /api/ask`. It retrieves entries from the
  same public index and lets a Claude model write a short answer; the browser renders link cards from the index only.

```bash
npm install                      # installs the optional @anthropic-ai/sdk
export ANTHROPIC_API_KEY=...     # server side only; never put a key into site.json or the browser
ASK_MODEL=claude-opus-5-5 node scripts/serve.mjs
```

Limits: `ASK_RATE_PER_MIN` (default 8 per IP), `ASK_RATE_PER_DAY` (default 400), questions capped at 300 characters.
Status 24 Nov 2026: the AI path is implemented but NOT tested with a real key. The live host is static Apache; the
AI mode needs a small Node host or serverless function that serves `/api/ask`. Until then the site runs in search mode.

## Deployment (not done — needs the owner's approval)

Upload the contents of `dist/` to the web root. `htaccess.example` contains optional Apache 301 rules; activate it
only after confirming the host allows `.htaccess` overrides. The HTML stubs work without it.
