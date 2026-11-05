// Deck plan renderer for the A21 quote request page.
//
// Replaces the hand-made per-season SVG deck plans. For a product it fetches the
// RezMagic deck plan (image + HTML image map) from Xano and renders, inside
// #deckSchematic:
//
//   <div class="deck-plan">
//     <img class="deck-plan__img" src="{image_url}">
//     <svg class="deck-plan__overlay" viewBox="0 0 {naturalWidth} {naturalHeight}">
//       <rect|polygon class="deck-plan__shape" data-cabin-code="{area href}">
//     </svg>
//   </div>
//
// The overlay scales with the image, and each shape carries data-cabin-code (the
// area's href, which equals the cabin item_code), so quote-request.js styles and
// selects them exactly like the old SVG cabins (.cabin.available/.reserved/
// .selected/.in-basket).
//
// API (window.A21DeckPlan):
//   render(productId, container?) -> Promise<{ status, productId, shapes }>
//     status: "ok" | "no_plan" | "error". Never rejects: on "no_plan"/"error" a
//     message is shown in the container instead of the plan.
//   ready      -> the promise of the latest render() call (null before the first)
//   parseImageMap(html) -> [{ shape: "rect"|"poly", code, points }]
//
// Optional config, set before render() is called:
//   window.A21_DECK_PLAN_ENDPOINT = "https://.../deck_plan/{product_id}"
(function () {
  "use strict";

  const DEFAULT_ENDPOINT =
    "https://xdtz-oh4i-3nzx.n7d.xano.io/api:XeSy1hTp/deck_plan/{product_id}";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const STYLE_ID = "a21-deck-plan-styles";

  // Default look. Every colour is a custom property so Webflow can theme it
  // (e.g. set --deck-plan-available-fill on #deckSchematic) without fighting
  // specificity.
  const DEFAULT_CSS = `
#deckSchematic .deck-plan {
  position: relative;
  display: block;
  width: 100%;
  max-width: 100%;
  line-height: 0;
}
#deckSchematic .deck-plan__img {
  display: block;
  width: 100%;
  height: auto;
  max-width: none;
  user-select: none;
  -webkit-user-drag: none;
}
#deckSchematic .deck-plan__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
#deckSchematic .deck-plan__shape {
  fill: transparent;
  stroke: transparent;
  stroke-width: 2px;
  vector-effect: non-scaling-stroke;
  transition: fill 0.12s ease, stroke 0.12s ease;
}
#deckSchematic .deck-plan__shape.cabin.available {
  fill: var(--deck-plan-available-fill, rgba(34, 160, 90, 0.22));
  stroke: var(--deck-plan-available-stroke, #1f9d55);
  cursor: pointer;
}
#deckSchematic .deck-plan__shape.cabin.available:hover {
  fill: var(--deck-plan-hover-fill, rgba(34, 160, 90, 0.45));
}
#deckSchematic .deck-plan__shape.cabin.reserved {
  fill: var(--deck-plan-reserved-fill, rgba(90, 90, 90, 0.5));
  stroke: var(--deck-plan-reserved-stroke, rgba(60, 60, 60, 0.8));
  cursor: not-allowed;
}
#deckSchematic .deck-plan__shape.cabin.in-basket {
  fill: var(--deck-plan-basket-fill, rgba(230, 150, 20, 0.45));
  stroke: var(--deck-plan-basket-stroke, #d98a00);
}
#deckSchematic .deck-plan__shape.cabin.selected {
  fill: var(--deck-plan-selected-fill, rgba(0, 92, 200, 0.45));
  stroke: var(--deck-plan-selected-stroke, #005cc8);
  stroke-width: 3px;
}
#deckSchematic .deck-plan-message {
  line-height: 1.4;
  padding: 1rem;
}
`;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = DEFAULT_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function endpointFor(productId) {
    const template = window.A21_DECK_PLAN_ENDPOINT || DEFAULT_ENDPOINT;
    return template.replace("{product_id}", encodeURIComponent(productId));
  }

  function parseNumbers(coords) {
    return String(coords || "")
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
  }

  // Parse RezMagic's <area> tags into plain shape descriptors. DOMParser builds
  // an inert document (no scripts run, nothing is attached to the page); only
  // the shape/coords/href attributes are read from it.
  function parseImageMap(html) {
    if (!html || typeof html !== "string") return [];
    const doc = new DOMParser().parseFromString(
      `<!doctype html><body><map>${html}</map></body>`,
      "text/html",
    );
    const shapes = [];
    doc.querySelectorAll("area").forEach((area) => {
      const code = (area.getAttribute("href") || "").trim().replace(/^#/, "");
      if (!code) return;
      const shape = (area.getAttribute("shape") || "rect").trim().toLowerCase();
      const n = parseNumbers(area.getAttribute("coords"));
      if (n.some((v) => !Number.isFinite(v))) return;

      if ((shape === "rect" || shape === "rectangle") && n.length >= 4) {
        shapes.push({
          shape: "rect",
          code,
          points: [
            Math.min(n[0], n[2]),
            Math.min(n[1], n[3]),
            Math.max(n[0], n[2]),
            Math.max(n[1], n[3]),
          ],
        });
      } else if (
        (shape === "poly" || shape === "polygon") &&
        n.length >= 6 &&
        n.length % 2 === 0
      ) {
        shapes.push({ shape: "poly", code, points: n });
      } else {
        console.warn("[deck-plan] skipping unsupported area", shape, code);
      }
    });
    return shapes;
  }

  function createShape(desc) {
    let el;
    if (desc.shape === "rect") {
      const [x1, y1, x2, y2] = desc.points;
      el = document.createElementNS(SVG_NS, "rect");
      el.setAttribute("x", x1);
      el.setAttribute("y", y1);
      el.setAttribute("width", x2 - x1);
      el.setAttribute("height", y2 - y1);
    } else {
      el = document.createElementNS(SVG_NS, "polygon");
      const pairs = [];
      for (let i = 0; i < desc.points.length; i += 2) {
        pairs.push(`${desc.points[i]},${desc.points[i + 1]}`);
      }
      el.setAttribute("points", pairs.join(" "));
    }
    el.setAttribute("class", "deck-plan__shape");
    el.setAttribute("data-cabin-code", desc.code);
    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = `Cabin ${desc.code}`;
    el.appendChild(title);
    return el;
  }

  function showMessage(container, text) {
    const div = document.createElement("div");
    div.className = "deck-plan-message";
    div.textContent = text;
    container.replaceChildren(div);
  }

  function loadImage(img, src) {
    return new Promise((resolve, reject) => {
      img.onload = () =>
        img.naturalWidth && img.naturalHeight
          ? resolve(img)
          : reject(new Error("Deck plan image has no size"));
      img.onerror = () => reject(new Error("Deck plan image failed to load"));
      img.src = src;
      // Cached images may already be complete before handlers fire.
      if (img.complete && img.naturalWidth) resolve(img);
    });
  }

  async function fetchDeckPlan(productId) {
    const response = await fetch(endpointFor(productId));
    if (response.status === 404) {
      // Unknown product: treat like a product without a deck plan.
      return { product_id: productId, image_url: null, image_map_html: null };
    }
    if (!response.ok) {
      throw new Error(`Deck plan request failed (HTTP ${response.status})`);
    }
    return response.json();
  }

  let renderSeq = 0;

  async function render(productId, container) {
    const seq = ++renderSeq;
    container = container || document.getElementById("deckSchematic");
    if (!container) {
      console.warn("[deck-plan] #deckSchematic not found");
      return { status: "error", productId, shapes: 0 };
    }
    injectStyles();
    container.setAttribute("aria-busy", "true");

    try {
      if (!productId) throw new Error("No product ID provided");

      const data = await fetchDeckPlan(productId);
      if (seq !== renderSeq) return { status: "stale", productId, shapes: 0 };

      if (!data || !data.image_url) {
        showMessage(
          container,
          "A deck plan is not available for this voyage yet. Please contact us to choose a cabin.",
        );
        return { status: "no_plan", productId, shapes: 0 };
      }

      const wrapper = document.createElement("div");
      wrapper.className = "deck-plan";

      const img = document.createElement("img");
      img.className = "deck-plan__img";
      img.alt = `Deck plan${data.image_name ? `: ${data.image_name}` : ""}`;
      img.decoding = "async";
      img.draggable = false;
      await loadImage(img, data.image_url);
      if (seq !== renderSeq) return { status: "stale", productId, shapes: 0 };

      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("class", "deck-plan__overlay");
      svg.setAttribute(
        "viewBox",
        `0 0 ${img.naturalWidth} ${img.naturalHeight}`,
      );
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("role", "group");
      svg.setAttribute("aria-label", "Cabins");

      const shapes = parseImageMap(data.image_map_html);
      shapes.forEach((desc) => svg.appendChild(createShape(desc)));

      wrapper.append(img, svg);
      container.replaceChildren(wrapper);

      if (!shapes.length) {
        console.warn("[deck-plan] image map has no usable areas", productId);
      }
      return { status: "ok", productId, shapes: shapes.length };
    } catch (error) {
      console.error("[deck-plan]", error);
      if (seq === renderSeq) {
        showMessage(
          container,
          "Unable to load the deck plan. Please refresh the page or contact us.",
        );
      }
      return { status: "error", productId, shapes: 0, error };
    } finally {
      if (seq === renderSeq) container.removeAttribute("aria-busy");
    }
  }

  const api = window.A21DeckPlan || {};
  api.render = function (productId, container) {
    api.ready = render(productId, container);
    return api.ready;
  };
  api.parseImageMap = parseImageMap;
  api.fetchDeckPlan = fetchDeckPlan;
  if (!("ready" in api)) api.ready = null;
  window.A21DeckPlan = api;
})();
