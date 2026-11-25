# AER — Weather as environment

> A weather window, not a weather dashboard. The sky is the interface; the data is etched into it.

Working title: **aer.** (pronounced "air"). Easy to rename later; the design does not depend on it.

**Status:** v1 built in `index.html`, `styles.css`, and `app.js`; see `README.md` for running it.

> **v1.1 visual revision — Apple-inspired.** The interface was reworked toward Apple's weather-app language: an SF-style type stack (SF Pro / Inter), frosted glass cards, rounded depth, colorful weather glyphs, iOS-blue controls, a centered current-conditions hero, and spring motion. The environment engine, data model, feature set, behavior, accessibility, and time-scrub interaction described in this brief still apply. The original editorial typography, no-card composition, and palette notes document the first pass and are superseded by the current build.

---

## 1. The idea

Most weather dashboards are a grid of white cards with a blue gradient behind them. This should feel like walking into a room where the weather is already happening.

- **The full viewport is the sky.** No card containers. Content sits directly in the atmosphere, separated by light, type, and 1px hairlines.
- **The environment is data.** The sky is generated from the actual weather and the actual position of the sun — not from a static "rain theme."
- **Premium comes from restraint.** One accent, one grain layer, one particle canvas, one orchestrated load. Every effect earns its place.
- **The interface is an instrument.** A giant temperature, a continuous forecast line, a sun arc, and a 7-day range chart. It should feel calibrated, not decorative.

### Design principles

1. **Weather first.** The atmosphere is the product, not a background image.
2. **Never white.** Depth comes from tinted dusk colors. Light is an event at the horizon, not a page background.
3. **One continuous surface.** Hierarchy through typography, spacing, and thin rules. No cards, no glass tiles, no drop shadows.
4. **Slow weather, fast interface.** Atmospheric transitions take 1.2–2s. Controls respond in 120–200ms.
5. **Solar amber is light, not ink.** The accent is used for glow, the "now" marker, and small highlights. Body text stays ivory.
6. **Motion means something.** Every animation maps to time, weather, or an interaction. No decoration loops competing for attention.
7. **Grace under failure.** Cached data, quiet errors, no blank screens, no layout shift.

---

## 2. The environment engine

The sky is not a set of fixed themes. It is a **solar base × weather modifier**, so it can represent any combination of time and conditions.

### Solar base

Derived from the sun's altitude and azimuth at the location:

| Phase | Sun altitude | Character |
|---|---|---|
| Night | < −6° | near-black indigo, stars, moon |
| Twilight | −6° to 6° | muted rose/plum, horizon still luminous |
| Low sun | 6° to 15° | amber horizon, long light, warm ink |
| Day | > 15° | deep petrol/teal, high pale-gold sun |

The **azimuth** shifts the horizon glow left or right across the screen. At sunrise the light blooms from the left; at sunset from the right. This one detail makes the page feel physically connected to the sun.

### Weather modifier

The current WMO weather code, cloud cover, precipitation, visibility, wind, and temperature adjust the solar base:

- **Clear:** higher saturation, clean gradient, warm sun disc.
- **Partly cloudy / overcast:** sun glow diffuses, horizon flattens, clouds drift.
- **Rain:** drops luminance, pulls hue toward teal/slate, desaturates the glow, adds rain streaks and a wet sheen.
- **Storm:** lower and darker, violet undertone, rare backlight flashes; no white strobe.
- **Snow:** cools the entire field, brightens the horizon, adds drifting flakes and a faint frost texture at the edges when below freezing.
- **Fog:** lifts a pale veil over the horizon, reduces contrast, adds slow low-lying layers.

### Color tokens

Five tokens per state, plus constants:

- `--sky-zenith` — top of the screen, darkest
- `--sky-mid` — body of the sky
- `--sky-horizon` — luminous band
- `--glow` — sun/moon haze, positioned by azimuth
- `--ink` — foreground text, a warm ivory, never pure white
- `--accent` — constant solar amber (light, not text)
- `--line` — ink at low alpha
- `--scrim` — a tinted foreground shadow for legibility

### Palette studies (hex approximations)

| State | Zenith | Mid | Horizon | Glow | Ink |
|---|---|---|---|---|---|
| Clear day — "Petrol" | `#082F3A` | `#0E5966` | `#2E8C84` | `#F0BA72` | `#F3EEE2` |
| Golden hour — "Ember" | `#241A33` | `#6B3F4E` | `#B96A55` | `#F6B678` | `#FFF0DF` |
| Clear night — "Ink" | `#04070E` | `#0A1220` | `#152A3A` | `#7C98B0` | `#E7EDF2` |
| Overcast / fog — "Lichen" | `#2A332F` | `#4A5550` | `#77817A` | `#D6D3BF` | `#F4F0E4` |
| Rain — "Slate" | `#071A20` | `#123039` | `#264A4C` | `#7FA79E` | `#E8EFE9` |
| Storm — "Ozone" | `#0B0912` | `#1B1626` | `#2C2538` | `#8C86A4` | `#EFEAF0` |
| Snow — "Glacier" | `#182932` | `#34505B` | `#6F9299` | `#D9E5E2` | `#F5F1E8` |
| Dusk — "Vesper" | `#171A33` | `#3A3555` | `#8A5A63` | `#F1A96E` | `#F8EDE4` |

**Why these are safe:** every text-bearing area sits over the zenith/mid field, not the bright horizon. A bottom foreground-shadow gradient deepens the lowest ~25% of the screen where the forecast rail lives. This is also physically believable — the foreground sits in shadow. Contrast is validated against the *composited* gradient, not the raw tokens. All functional text targets 4.5:1; the horizon is allowed to be pure atmosphere because no small text sits directly on it.

**Never:** pure `#000` or `#FFF`. Shadows are tinted, not grey. Semantic colors (AQI, UV) are labeled, never color-only.

### Transition

Two stacked sky layers crossfade over **1.4–1.8s** with a 1.03 scale drift. No hard theme swap, no gradient tweening. Content ink transitions in 400–600ms. Particles fade independently. Theme changes are debounced and quantized (e.g. cloud-cover bands) so a 2% cloud change does not cause a visible repaint.

---

## 3. Composition

### Desktop (≥ 1200px)

One viewport, no page scroll. 12-column grid, 56px gutters, max width 1680px.

```
┌ aer.                                        search   °C °F ┐
│                                                            │
│  REYKJAVÍK · 14:32                                         │
│                                                            │
│  18°                         light rain, easing            │
│  feels 16°                                                 │
│  "Rain eases by 15:10."                    sun arc          │
│  wind 7  ·  humidity 82  ·  uv 1  ·  aqi 24                │
│                                                            │
│  24 HOURS  ─────────────────────────────────────────────   │
│  [temperature line · precipitation bars · now marker]      │
│                                                            │
│  7 DAYS  ───────────────────────     AGI / RAIN / PRESSURE │
└────────────────────────────────────────────────────────────┘
```

- **Hero left (7 cols):** location + local time, enormous temperature, condition in serif italic, feels-like, sky note, microdata.
- **Instrument right (4 cols):** sun/moon arc with actual path, sunrise/sunset, daylight remaining. At night it becomes a moon arc with a quiet star field.
- **Bottom left (8 cols):** continuous 24-hour temperature line with precipitation probability bars and a fine amber "now" marker.
- **Bottom right (4 cols):** 7-day list with a shared-scale min/max range bar per day. Hovering expands the row and reveals condition + precipitation.
- **Footer line:** data credit in 9px mono, low contrast but legible. No social icons, no clutter.

### Mobile (< 720px)

- Sky remains full-bleed and fixed.
- Top bar compresses to wordmark + search + units.
- Temperature 104–120px, condition below.
- Sun arc moves under the hero or collapses to a single line ("Sunset 16:48 · 2h 14m left").
- Hourly chart becomes a horizontally scrollable band with snap; scrubbing still works.
- 7-day list stacks under. Details become a 2-column list.
- Page scrolls naturally; background remains atmospheric.

### Typography

- **Display:** Instrument Serif (regular + italic). Hero temperature, place name, sky note.
- **UI / data:** Instrument Sans. Forecast numbers, labels, body copy. Use tabular numerals.
- **Micro-labels:** DM Mono. Uppercase 9–10px, tracking 0.14em, timestamps, units, credits.
- Temperature: `clamp(7rem, 17vw, 15rem)`, line-height 0.8, letter-spacing −0.05em.
- Condition: Instrument Serif italic, 28–36px.
- Hairlines: 1px at 12–16% ink. No borders around groups.
- Corners: 0px for structure; full radius only for dots and the sun/moon marker. No card stacks.

### Copy voice

Calm, specific, lowercase, no exclamation marks.

- "light rain, easing"
- "Rain eases by 15:10."
- "3° warmer than this hour yesterday."
- "Gusts to 17 m/s after dark."
- Error: "The sky went quiet. Showing the last reading from 14:20." / action: "Try again."

Sky notes are generated from deterministic rules (precip nowcast, clearing time, temperature delta vs. yesterday, wind threshold), never invented prose.

---

## 4. Motion & interaction

### Timing tokens

- `--t-weather: 1600ms` — sky, particles, large reveals. Ease: `cubic-bezier(.22,.61,.36,1)`.
- `--t-enter: 700ms` — content entrances. Ease: `cubic-bezier(.16,1,.3,1)`.
- `--t-ui: 180ms` — buttons, hovers. Ease: `cubic-bezier(.2,.8,.2,1)`.
- Stagger: 60–80ms. No bounce, no elastic, no spinning loaders.

### Load choreography (once, ~2.4s total)

1. 0ms — deep sky field fades up from near-black.
2. 200ms — horizon glow blooms and settles.
3. 500ms — cloud/fog layer becomes visible.
4. 600ms — wordmark and meta line fade in.
5. 750ms — temperature digits roll upward with a 2px blur that clears.
6. 950ms — condition and sky note fade in.
7. 1100ms — hourly line draws left to right; precipitation bars grow.
8. 1300ms — 7-day rows stagger in; range bars expand from the center.
9. 1500ms — sun arc marker settles; microdata rules draw.

The UI is usable after ~1s; the choreography never blocks input.

### Signature interactions

**1. Scrub the sky (the memorable one).**
Drag along the 24-hour chart and the entire environment previews that hour: palette, sun position, clouds, rain, hero temperature, condition. The chart gets a fine crosshair and a preview label. Release eases back to now; a deliberate click pins the hour and shows a small "back to now" affordance. Keyboard arrows scrub when the chart is focused; Esc returns.

This turns a forecast chart into a time machine. It is the feature people will remember.

**2. Sun-azimuth light.**
The horizon glow, subtle vignette, and shadow direction follow the actual sun azimuth. Sunrise light comes from the left; sunset light from the right. The page changes without any obvious "animation."

**3. Weather materials.**
- Rain: faint condensation at the screen edges; clears slightly around the cursor on fine-pointer devices.
- Cold: a very low-opacity frost crystal texture creeps in from corners below 0°C.
- Heat/haze: horizon shimmer and a warm dust veil above 30°C.
- Storm: rare backlight flashes that briefly lift the hairline contrast; never a full white flash.
These are edge treatments at 3–6% opacity, not overlays that obscure data.

**4. Time-of-day moments.**
- Clear night: irregular star twinkle; one shooting star every few minutes at most.
- Thunderstorm: a double flash every 8–15s, with a minimum 6s gap; disabled for reduced motion.
- Golden hour: long, low sun bloom that slowly travels.
- Rain nowcast: a thin strip of minute ticks that fill in sequence when rain is imminent.

**5. Micro-interactions.**
- Unit toggle: digits roll; the degree glyph rotates a few degrees; no page re-render.
- Search: `<dialog>` with a blurred sky behind; results stagger 30ms; full keyboard navigation.
- Wind compass: needle eases to real direction; gust ring pulses once on reveal.
- Daily rows: range bar thickens, condition label reveals, hairline brightens.
- Temperature refresh: only changed digits move. Everything else stays still.
- Hover on the updated-time: reveals a small refresh affordance; no permanent button.

### Ambient behavior

- Clouds drift 0.01–0.03 px/frame, with 6–10px pointer parallax on fine pointers.
- Horizon glow "breathes" at 8–12s, amplitude under 2%.
- Film grain is static or animated at 8fps, 3–4% opacity, soft-light.
- Cursor light: 400px radial amber glow at 5–7%, lerped, hidden on touch.
- No scroll-triggered animations on desktop; mobile uses entrance-only, not parallax.

### Performance and motion safety

- One `<canvas>` for particles, DPR capped at 2; pause on `visibilitychange`.
- Particle budget scales with viewport area and `deviceMemory`; degrade at < 45fps.
- `prefers-reduced-motion`: no particles, no cursor light, no parallax, no lightning; 150ms crossfades.
- `navigator.connection.saveData`: static sky + no particles.
- Animate transform/opacity only. Never animate layout or filters on full-screen layers during interaction.
- No motion after initial load except atmosphere and direct responses.

---

## 5. Features

### v1 — the window

**Data**
- Current temperature, feels-like, condition, high/low, local time.
- 24-hour forecast (temperature, precipitation probability, condition).
- 7-day forecast (min/max, condition, precipitation chance, sunrise/sunset).
- Details: wind speed/direction/gusts, humidity, UV, pressure + trend, visibility, air quality.
- 60-minute precipitation nowcast at 15-minute resolution.
- "Warmer/cooler than yesterday at this hour" using one past day.

**Controls**
- City search with keyboard navigation.
- Use my location, with graceful denial handling.
- Celsius/Fahrenheit toggle. Conversion client-side; no refetch.
- Auto-refresh every 10 minutes when visible; manual refresh on the timestamp.
- Persist place and units. Optional deep link with coordinates + name.

**Environment**
- Solar × weather theme engine.
- Rain, snow, fog, cloud, star, and lightning layers (as conditions require).
- Sky crossfades, load choreography, weather materials.
- Sun/moon arc.

**Signature**
- Scrub-the-sky hourly preview and pin.
- Animated 7-day range bars.
- Digit-roll temperature updates.

**Resilience**
- Cached last payload (localStorage), stale-while-revalidate.
- Offline state: "offline · last sky 14:20."
- Error state with last known data, not a blank page.
- Skeletons that match final geometry; no layout shift.
- Full keyboard support, screen-reader chart summaries, visible focus.
- Responsive 360px → 1680px.

### v1.5 — polish

- Optional ambient soundscape (generated rain/wind, off by default, never autoplay).
- "Replay the day" sky timelapse button.
- Hover a day to preview its noon palette without changing the data.
- Shareable "sky card" export.
- PWA install + offline shell.

### Later

- Saved places as small horizon thumbnails; switching crossfades the sky.
- Moon phase and local daylight milestones.
- Official weather alerts (only from a real alert provider — do not invent warnings).
- Pollen where data is available.
- Multiple layout modes (focus / full instrument).

### Explicit non-goals

- No map, radar tiles, ads, or news feed.
- No emoji icons.
- No white cards or generic dashboard grid.
- No fake "AI weather summaries"; copy is rule-based and factual.
- No sound on by default.
- No infinite particle effects at the cost of battery.

---

## 6. Behavior details

### First visit
Open on **Round Rock, Texas** with a quiet "Use my location" action. Fahrenheit is the first-visit default for US places; the choice persists. Do not trigger the browser permission prompt on load. If permission is denied, keep the default and show a one-line note; never block the app.

### Search
- Debounce 250–300ms; minimum 2 characters.
- Open with `/` or ⌘K / Ctrl+K; close with Esc or backdrop click.
- Show city, region, country; arrow keys + Enter; focus trapped.
- Escape user-supplied names before rendering.
- No result: "No place by that name. Try a nearby city."

### Refresh
- Automatic every 10 minutes while visible and online.
- On return to tab, refetch if older than 10 minutes.
- Keep stale data visible; show a 1px progress line at the top of the screen.
- Never replay the load choreography on refresh.
- Abort in-flight requests when the place changes.

### Location / time
- API timezone `auto`; render the *location's* local time.
- If the location is not in the user's timezone, label it "local" once.
- Solar calculations use the location's coordinates and timezone offset.

### Errors
- Network failure with cache: cached view + "Last sky 14:20" + retry.
- Network failure without cache: atmospheric empty state with a single retry; no error card.
- Geocoding failure: inline message inside the search dialog.
- Air quality failure: hide the AQI metric; do not show a broken tile.

### Accessibility
- All information available as text; charts include a hidden table and a summary.
- `aria-live="polite"` for refreshed conditions, not per-second time.
- 4.5:1 contrast for functional text against the composited background.
- `prefers-contrast: more`: deepen the scrim, raise ink and hairline opacity, reduce horizon brightness.
- 44px touch targets; no hover-only actions.
- Reduced motion and save-data modes are first-class, not afterthoughts.
- Attribution to Open-Meteo in the footer.

---

## 7. Data & technical plan

### APIs (no keys)

- **Forecast:** Open-Meteo `/v1/forecast` with `current`, `hourly`, `daily`, `minutely_15`, `past_days=1`, `timezone=auto`.
  - current: temperature, apparent temperature, humidity, weather code, cloud cover, precipitation, wind speed/direction/gusts, pressure, is_day.
  - hourly: temperature, apparent temperature, precipitation probability, precipitation, weather code, cloud cover, visibility, UV, wind.
  - daily: weather code, min/max, sunrise, sunset, daylight duration, UV max, precipitation sum/probability max, wind max.
  - minutely_15: precipitation for the nowcast.
- **Air quality:** Open-Meteo Air Quality API (`european_aqi`, `us_aqi`, PM2.5, PM10, ozone) — optional, hidden on failure.
- **Geocoding:** Open-Meteo Geocoding API (`name`, `count=8`, `language=en`, `format=json`).
- **Reverse geocode for "my location":** BigDataCloud client endpoint or fallback label "My location."
- **Solar position:** compact local NOAA calculation; no library. Use it for the arc and twilight phase.

### Stack

Plain HTML/CSS/JS. No framework, no build step.

Recommended file split:
- `index.html` — structure, inline SVG symbol sprite, font links.
- `styles.css` — tokens, layout, motion, media queries, preferences.
- `app.js` — state, API, theme engine, render, chart, particles, interactions.

A single-file version is possible once stable; during development, split files are easier to reason about. Fonts: Instrument Serif, Instrument Sans, DM Mono (Google Fonts, preconnect + swap).

### State

```
place, units, weather, airQuality, nowcast,
previewHour | null, pinnedHour | null,
theme, loading, stale, error, reducedMotion, saveData
```

Theme is computed, never stored as a fixed class. Render is idempotent: refresh updates data, not the whole DOM.

### Theme pipeline

1. Solar altitude/azimuth from coordinates + timestamp.
2. Base palette from solar phase.
3. Weather modifiers from code/cloud/precip/visibility.
4. Quantize + debounce; compute a theme hash.
5. If hash changes, crossfade sky layers and update tokens.
6. Update particle mode/intensity with the same transition.
7. On preview, compute the theme at the preview time and run the same pipeline.

### Performance budget

- LCP < 2.5s on a mid-range phone; initial sky is CSS and paints immediately.
- No CLS: fixed chart height, reserved numeral widths, font fallback metrics.
- 60fps on desktop; graceful degradation on low-power devices.
- One canvas; no more than ~220 active particles on mobile.
- Avoid full-screen `backdrop-filter` during interaction; only the search dialog uses it.

### Pillars to test

- 360px, 768px, 1440px, 1920px.
- Slow 3G, offline, API error, geolocation denied, no AQI.
- Reduced motion, high contrast, keyboard-only, screen reader.
- Clear day, golden hour, night, rain, storm, snow, fog.
- Unit toggle, place switch, hour scrub, refresh during scrub.

---

## 8. Taste guardrails

- **Effect budget:** one particle canvas + one grain layer + one cursor light. Anything more is a bug.
- **No white, no pure black.** Every neutral is tinted.
- **No card containers.** If a group needs separation, use space or a hairline.
- **No glassmorphism except the search overlay.**
- **No emoji.** Custom 1.25px line glyphs or text only.
- **No animating body copy.** Animate instruments and numbers, not paragraphs.
- **No constant motion at high contrast.** Atmosphere should be felt, not watched.
- **No false precision.** Round temperatures; label times; don't show 14 decimal places.
- **No fake safety advice.** Weather notes are descriptive, not authoritative alerts.

---

## 9. Decisions locked

1. **Atmosphere:** always-deep, color-forward. Light lives at the horizon; white is the text system.
2. **v1 scope:** one place + search + geolocation, with units, nowcast, details, and sky scrubbing.
3. **Build format:** split plain HTML/CSS/JS. No framework, no build step.
4. **Default location:** Round Rock, Texas; Fahrenheit for the first US visit. The place and unit choice persist.
5. **Signature interaction:** scrub the 24-hour chart to preview the sky; release to return, click to pin.
6. **Visual language (v1.1):** Apple-inspired glass. Centered hero; one continuous surface of sky with frosted cards; SF Pro / Inter; colorful weather glyphs; iOS-blue controls; quiet spring motion.
