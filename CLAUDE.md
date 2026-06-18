# Do-A-Dot Art — Dawn Theme

This is the Shopify theme for **dotart.com**, forked from `Shopify/dawn` (v15.4.1) and customized for the Do-A-Dot Art brand.

- **Fork:** `Steeders/dad-dawn-theme`
- **Upstream:** `Shopify/dawn` (added as `upstream` remote — `git fetch upstream` to pull future Dawn updates)
- **Live store:** dotart.com (unpublished theme during build phase)
- **GitHub integration: LIVE (connected 2026-06-17).** `main` branch ↔ theme **`dad-dawn-theme/main`** (id **157094641896**, unpublished). This is the working/preview theme. Old dev theme `156830204136` is redundant (deletable). Live published theme = `140409831656` ("ZM | PDP Update"). **Workflow is now git-only — see Workflow section. Do NOT `shopify theme push`.**
- **Design source:** `clients/do-a-dot/design/dad-dawn-theme-customization/` (Claude Design bundle, do not modify)

## Project context

The Do-A-Dot brand is a 30-year-old kids' dot-marker company expanding into a "full craft closet" (chunky crayons, watercolors, bundles) for the DTC launch. Tone: **fun, airy, welcoming, minimal — dialed and premium. Never corporate-stiff or cheesy.** Designed by Russell's Claude Design session — see `../design/dad-dawn-theme-customization/chats/chat1.md` for the full intent.

## Hard rules — do not violate

1. **NEVER edit `assets/base.css`.** It's Dawn-shipped; we need it pristine so future `git merge upstream/main` is clean. All custom styles go in `assets/custom.css`.
2. **NEVER edit Dawn's stock sections** (`sections/header.liquid`, `sections/footer.liquid`, `sections/main-product.liquid`, etc.) unless absolutely necessary. Build new sections in `sections/` or theme blocks in `blocks/` instead. Same reason: clean upstream merges.
3. **NEVER hardcode hex colors or font sizes** in CSS. Use the design tokens in `assets/dad-tokens.css` (`var(--dad-hot-pink)`, `var(--fs-h2)`, etc.). The tokens ARE the design system; the design only stays coherent if every component drinks from them.
4. **NEVER add `@font-face` declarations to `dad-tokens.css`.** Fonts are declared inline in `layout/theme.liquid` so the `{{ 'X.ttf' | asset_url }}` filter resolves to Shopify CDN URLs. Adding them to plain `.css` won't work — relative paths break on the CDN.
5. **Theme blocks first.** New reusable UI modules go in `blocks/` as theme blocks (`{% content_for 'blocks' %}` pattern). One-off page sections go in `sections/`.
6. **Custom settings go in `config/settings_schema.json` extensions** — not hardcoded values in sections.

## After every non-trivial change

Run `shopify theme check` and fix anything it flags before moving on. This catches Liquid syntax errors, deprecated tags, broken section schemas, etc.

```bash
cd /Users/russellsteed/Claude\ Code/clients/do-a-dot/dad-dawn-theme
shopify theme check
```

## Design token reference

The full design system lives in `assets/dad-tokens.css`. Quick reference:

**Colors — never invent new hues.** Use:
- Primary brand: `--dad-hot-pink` `#df1883` (default accent)
- Marker palette (the "conversation through color" hook): `--dad-pink` `--dad-red` `--dad-orange` `--dad-yellow` `--dad-green` `--dad-dark-green` `--dad-teal` `--dad-blue` `--dad-dark-blue` `--dad-purple` `--dad-dark-purple`
- Surfaces: `--dad-cream` `#fff8e8` (page bg), `--dad-white`, `--dad-yellow-tint` (sticker yellow)
- Ink: `--dad-ink` `#2b2a2d` (never pure black), `--dad-ink-muted`, `--dad-ink-soft`
- Semantic aliases: `--fg` `--bg` `--accent` `--accent-2` `--link` `--success` `--warning` `--danger` `--border`

**Type** — Headers sentence-case (never ALL CAPS), subheads often lowercase. Quicksand body bottoms out at 16px for adult readability.
- `--font-display` (Dimbo) — heroes, H1–H3
- `--font-script` (Kids Script) — sign-off accents, "hi, friends!" moments
- `--font-body` (Quicksand 500/700) — everything else
- Scale: `--fs-display` `--fs-h2` `--fs-h3` `--fs-h4` `--fs-lead` `--fs-body` `--fs-small` `--fs-micro`

**Shape language** — chunky, never sharp. Radii: `--r-xs` 6 → `--r-pill` 999. Shadow vocabulary:
- `--shadow-sticker` — primary CTA only
- `--shadow-card` — product cards in "sticker" mode
- `--shadow-soft` — subtle lift
- `--shadow-pop` — chunky offset
- `--shadow-focus` — sky-blue accessibility ring

**Spacing** — 4px base: `--s-1` 4 → `--s-24` 96.

## Brand voice non-negotiables

(Lifted directly from the design chat — these decisions are settled.)

- **CTAs say "shop all"**, never "shop the launch." Launch-specific CTAs get layered in via Shopify campaigns post-launch, not baked into the theme.
- **Footer location:** "Made for little hands in San Clemente, CA." Phone is 949-DOT-ARTS. No Bloomington / Indiana / 812 / 47404 references — Russell swept those out of the design.
- **Color names are content, not just hex codes.** Piggy Pink, Flamingo Fuchsia, Tiger Tail Orange, Froggy Green, Butterfly Blue, Lavender, Octopus Purple, Lady Bug Red — these surface on the homepage color-strip section, in the PDP color picker, and in the PDP color-story accordion.
- **Sticker shadow is reserved for the primary CTA only.** Don't sprinkle it across product cards / nav / chrome — pulls the design toward the chunky-sticker territory we explicitly moved away from.

## Design → Liquid porting map (Pass 4)

The Claude Design bundle's Pass 4 ("Dawn module library") was built as a 1:1 handoff doc. Each module maps to a Dawn `.liquid` file. Port these first — they're the building blocks every page composes from.

**Chrome (3 modules)**
- Announcement bar → `sections/announcement-bar.liquid` (Dawn stock — extend, don't replace)
- Header → `sections/header.liquid` (Dawn stock — restyle via custom.css)
- Footer → `sections/footer.liquid` (Dawn stock — needs the redesigned spruce: dot-scan strip, marker-color bullets, "made in the USA" pill, ghost wordmark watermark)

**Banners & storytelling (7 modules)**
- Image banner → `sections/image-banner.liquid`
- Image with text → `sections/image-with-text.liquid`
- Multirow → `sections/multirow.liquid`
- Rich text → `sections/rich-text.liquid`
- Slideshow → `sections/slideshow.liquid`
- Video → `sections/video.liquid`
- Collage → `sections/collage.liquid`

**Commerce & utility (9 modules)**
- Featured collection → `sections/featured-collection.liquid`
- Featured product → `sections/featured-product.liquid`
- Collection list → `sections/collection-list.liquid`
- Multicolumn → `sections/multicolumn.liquid`
- Email signup → `sections/email-signup.liquid`
- Contact form → `sections/contact-form.liquid`
- **Product spotlight (NEW)** → `blocks/product-spotlight.liquid` — one configurable block, two layouts (full-bleed + compact card) via a setting

## Workflow — git-only (GitHub integration is LIVE)

**🚫 NEVER run `shopify theme push`.** The theme is GitHub-connected; pushing from the CLI bypasses git and overwrites the user's theme-editor content (the JSON config/template files). All theme updates flow through git.

**The loop:**
1. **`git pull --rebase origin main` FIRST** — every session and before any commit. The user edits in the Shopify theme editor; those edits auto-commit to `main` as `Update from Shopify...` bot commits. Rebasing absorbs them so you never clobber editor content.
2. Make code changes locally (new `sections/`/`blocks/`/`assets/`; never stock Dawn files).
3. Preview: `shopify theme dev --store do-a-dot-art.myshopify.com --theme 157094641896 --port <free>` (Chrome; theme dev serves local files against live data — reflects uncommitted edits).
4. `shopify theme check` before committing.
5. Commit, then `git push origin main` → Shopify auto-syncs into the connected theme. (Small changes go straight to `main`; use a feature branch + ff-merge for larger work.)

**Which files are whose:** Code = `.liquid`/`.css`/`.js` (you own these via git). Content/settings = `config/settings_data.json`, `templates/*.json`, `sections/*-group.json` (the user owns these via the editor; they auto-commit back). When you must change a content JSON (e.g. add a section to `index.json`), pull-rebase first, edit minimally, push.

**Important Shopify GitHub-integration quirks:**
- The integration is **bidirectional and cannot be turned off.** Customizer edits in Shopify admin commit back to the connected branch as bot commits.
- **Duplicating a connected theme severs the connection on the copy.** Don't think "duplicate the theme" — think "branch the repo."
- A theme that has been GitHub-connected loses Shopify's one-click Dawn-update button. We're accepting that trade — upstream Dawn updates happen via `git merge upstream/main`.
- Each connected branch counts against the theme limit (20 on Standard plans).

**Post-launch:**
Disconnect GitHub via Shopify admin. The theme reverts to a normal Shopify theme that Russell can edit directly in the admin. Trade-off: no more git-tracked changes, but matches Russell's solo-operator workflow long-term.

## Repo conventions

- One section at a time. Scoped requests produce clean ports; "make Dawn look like this" produces mush.
- Commit before every non-trivial Claude Code run.
- Branch names: `feature/<section-name>` (e.g. `feature/home-hero`, `feature/pdp-color-picker`).
- Commit style: short imperative ("Add hot-pink accent to product card hover"), reference the Pass + module if relevant ("Pass 4: port image-banner section").
