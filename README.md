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
- No deck plan (`image_url` null or 404), fetch failure and image load failure
  each show a message in `#deckSchematic`; `render()` never rejects.
- Default styles are injected once (`#a21-deck-plan-styles`). Colours are CSS
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
`test/fixtures/deck_plan_24444.json` uses the real RezMagic image for 24444 with
an image map generated from the cabin cells in that image. It deliberately mixes
attribute order, whitespace and case, three `poly` areas, and a `circle` and a
`default` area that must be skipped.

Results (2026-11-05):

| Scenario | Result |
| --- | --- |
| 24444 fixture | 42 shapes (39 rect, 3 poly) on top of the cabins; circle/default skipped |
| available/reserved | 28 available / 14 reserved, matching `cabin/24444` exactly; 0 unmatched shapes |
| click | clicking 507 selects it (blue) and fills category + price ($29,795 pp) |
| in-basket | seeded 511 shows `.in-basket` (amber) |
| resize | overlay tracks the image at desktop and 375px mobile width |
| no plan / broken image / fetch error | each shows a message in `#deckSchematic` |
| 24444 / 23452 live | **not verified**: `deck_plan/{id}` still returned 404 |

## Webflow changes needed

1. Quote request page: delete every per-season deck plan SVG embed inside
   `#deckSchematic` and the Wized visibility conditions that pick one by
   ship/season. Keep the empty `#deckSchematic` element (any wrapper, legend or
   heading must sit **outside** it, since the script replaces its contents).
2. Add the script **before** `quote-request.js`, in the page's custom code:
   `<script src="https://cdn.jsdelivr.net/gh/MonicaRandriamialy/a21@main/deck-plan.js"></script>`
   (pin a tag or commit instead of `@main` if the site pins `quote-request.js`).
   If it is missing, `quote-request.js` skips rendering, as it did before.
3. CSS: rules aimed at the old SVGs (e.g. `#deckSchematic path`, `.cabin path`,
   `.cabin.available path`) no longer match. Cabin shapes are now
   `rect.deck-plan__shape` / `polygon.deck-plan__shape` with the same state
   classes. Either delete those rules and use the defaults, or retarget them to
   `.deck-plan__shape.cabin.available` etc., or set the `--deck-plan-*` custom
   properties on `#deckSchematic`. Make sure `#deckSchematic` has no fixed height
   or `overflow: hidden` that would crop the taller images.
4. Purge the jsDelivr cache for both files after merging.
