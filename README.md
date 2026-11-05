# a21
Code repo used for the A21 website

## Deck plan (`deck-plan.js`)

Renders the RezMagic deck plan for the current product inside `#deckSchematic`,
replacing the hand-made per-season SVG embeds.

- Fetches `GET api:XeSy1hTp/deck_plan/{product_id}` →
  `{ product_id, image_url, image_name, image_map_html }`.
- Draws an `<img>` of `image_url` with an absolutely positioned `<svg>` overlay
  (`viewBox` = the image's natural size, so it scales with the image).
- Parses `image_map_html` with `DOMParser` (never `innerHTML`); each `rect` /
  `poly` area becomes a `<rect>` / `<polygon>` with `data-cabin-code` = the area
  `href` (= cabin `item_code`). Other shapes are skipped.
- `quote-request.js` calls `window.A21DeckPlan.render(productId)` in parallel with
  the cabin fetch and waits for it before `initializeCabinStates()`. Selection,
  basket and click delegation are unchanged: the shapes get the same
  `.cabin.available/.reserved/.selected/.in-basket` classes.
- No deck plan (`image_url` null, which the endpoint returns for unknown products too; a 404 is treated the same), fetch failure and image load failure
  each show a message in `#deckSchematic`; `render()` never rejects.
- Default styles match the old SVGs: available cabins keep the image's category
  colour (outline on hover), reserved cabins are greyed out, selected / in-basket
  cabins get a solid / dashed dark outline. They are injected once (`#a21-deck-plan-styles`). Colours are CSS
  custom properties (`--deck-plan-available-fill`, `--deck-plan-reserved-fill`,
  `--deck-plan-selected-fill`, `--deck-plan-basket-fill`, `--deck-plan-hover-fill`
  and matching `-stroke`), so Webflow can theme them on `#deckSchematic`.

### Testing

```
python3 -m http.server 8421
open http://localhost:8421/test/deck-plan.html?product_id=24444&mock=fixture
```

`test/deck-plan.html` stubs `window.Wized` and loads both scripts against the
**live** cabin API. Its header comment lists the scenarios.
`test/fixtures/deck_plan_24444.json` and `deck_plan_23452.json` are the real
RezMagic responses (same shape as the endpoint, live Xano image URLs).
`deck_plan_parser_edge_cases.json` (`mock=edge_cases`) reuses the 24444 image with
a generated map that mixes attribute order, whitespace and case, has three `poly`
areas, and a `circle` and a `default` area that must be skipped.

Results (2026-11-05):

| Scenario | Result |
| --- | --- |
| 24444 real map | 42 rect shapes on top of the cabins, 0 unmatched |
| available/reserved | 28 available / 14 reserved, matching `cabin/24444` exactly |
| click | clicking 507 / 423 selects it (dark outline) and fills category + price ($29,795 pp) |
| in-basket | seeded 511 shows `.in-basket` (dashed dark outline) |
| resize | overlay tracks the image at desktop and 375px mobile width |
| 23452 real map | 798x1380 JPEG, 38 rect + 3 L-shaped poly (409, 411, 414), all aligned; every cabin is reserved in `cabin/23452`, so selection can't be exercised there |
| 23452 data mismatch | map areas `407` and `512` have no cabin in `cabin/23452`, and cabin `502` has no area, so those stay unstyled/unclickable (RezMagic data, not this script) |
| parser edge cases | 42 shapes (39 rect, 3 poly); circle/default skipped |
| no plan / broken image / fetch error | each shows a message in `#deckSchematic` |
| live endpoint | `deck_plan/24444` and `/23452` byte-identical to the fixtures; harness without `mock` gives the same results (24444: 42 shapes, 28/14, 417 selectable; 23452: 41 shapes, 3 poly); unknown product 999999 (200 with nulls) shows the no-plan message |

## Webflow changes needed

Checked against the live page `/booking/quote-request` on 2026-11-05.

1. **Deck plan embeds.** The page has six booking sections (`quote-request_grid`),
   one per ship/season, each with its own `#deckSchematic` (four directly on the
   page, two inside the components "Magellan Explorer Air Cruises 24-25 / 25-26
   Actual"). Wized shows one by `get_product` venue/brand/season, and its
   visibility setting **removes** the others from the DOM, so after load there is
   exactly one `#deckSchematic` (checked on the live page: 24444 leaves only
   `magellan_discoverer`). The script replaces whatever is inside it, so the
   sections can stay as they are. Optional clean-up: delete the old SVG
   drawings inside each `#deckSchematic` (keep the empty box, ID unchanged).
   Note: a product whose season matches no section's rule (e.g. 2027-28) shows
   no booking section at all; that is existing behaviour, not caused by this.
2. **Scripts.** Add `deck-plan.js` before `quote-request.js` in the page's custom
   code. For testing, point both at the `deck-plan` branch commit:
   `https://cdn.jsdelivr.net/gh/MonicaRandriamialy/a21@76736db/deck-plan.js`
   `https://cdn.jsdelivr.net/gh/MonicaRandriamialy/a21@76736db/quote-request.js`
   After merging, switch both to `@main` (and purge the jsDelivr cache).
   Without `deck-plan.js`, `quote-request.js` skips rendering as before.
3. **CSS.** These existing rules apply to the new shapes too:
   - `.cabin { cursor: pointer; transition: opacity .2s }` and
     `.cabin:hover { opacity: .85 }` (Webflow class styles): harmless.
   - `.cabin.reserved { filter: grayscale(); pointer-events: none; ... }`:
     still works; reserved shapes ignore clicks.
   - `.cabin.reserved rect { fill: #c0c0c0 }` (page embed): written for the old
     `<g class="cabin"><rect>` structure. It does not match the new shapes, which
     are the `rect` itself. It can be deleted.
   - `.deck-schematic { display: flex; flex-direction: column; gap: 2rem }`:
     fine, there is no fixed height or overflow clipping.
   The new shapes are `rect.deck-plan__shape` / `polygon.deck-plan__shape`.
   Their colours come from the injected defaults and can be changed with the
   `--deck-plan-*` custom properties on `#deckSchematic`.
