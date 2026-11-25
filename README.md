# Aer

A live weather window with an Apple-inspired glass interface. The full-bleed sky is generated from the real sun and real conditions; the data sits in frosted cards with SF-style typography, colorful weather glyphs, and quiet spring motion.

Default location: **Round Rock, Texas**.

The live sky engine, time-scrub interaction, and behavior from the original editorial version remain. The visual layer was rebuilt toward the Apple Weather language: a centered current-conditions hero, one 24-hour graph, a 7-day glass card, a sun/moon path card, and a six-tile details grid.

## Run

No build step. From this folder:

```powershell
python -m http.server 5173
```

Open [http://localhost:5173](http://localhost:5173). A local server is recommended for geolocation and clean API access.

## Use

- **Search** — click **Search**, press `/`, or `Ctrl/⌘ K`. Arrow keys navigate results, Enter selects.
- **Preview the sky** — drag across the 24-hour graph. Release to return to now; click or tap to pin an hour. Press `Esc` or **Back to now** to reset.
- **Units** — °F / °C in the segmented control. The choice persists; wind, visibility, and dew point follow the same system.
- **Locate** — the crosshair control uses your browser location, with a quiet fallback if permission is denied.
- **Refresh** — click the updated timestamp; it also refreshes every 10 minutes while visible.

On a wide screen the composition is a single 1440×900 dashboard. Below 940px it becomes a scrollable stack; the solar card, details grid, and 7-day list remain intact.

## Data

- Forecast: [Open-Meteo](https://open-meteo.com/) — current, 24-hour, 7-day, 15-minute nowcast, and yesterday at this hour. No API key.
- Air quality: Open-Meteo Air Quality API.
- Geocoding: Open-Meteo Geocoding API; reverse geocoding on location uses BigDataCloud.
- Solar position and day/night transitions are calculated locally from the returned sunrise/sunset and timezone.
- Last successful payload is cached in `localStorage`; the app shows the last sky with an offline note if the network disappears.
- Weather data by Open-Meteo, licensed CC BY 4.0.

## Structure

- `index.html` — semantic shell, SVG icon sprite, search dialog.
- `styles.css` — tokens, atmospheric sky, layout, responsive behaviour, reduced-motion and contrast modes.
- `app.js` — theme engine, particles, solar arc, chart scrubbing, search, caching, units, and state.
- `BRIEF.md` — the full design brief and rationale.

## Notes

- The interface is Apple-inspired, not affiliated with Apple. It uses an SF-style stack: native SF Pro when available, and Inter on other platforms.
- The hourly chart is readable without hovering: a permanent right-side temperature axis, a visible now line, and a small glass badge carrying the current-hour temperature. Hovering or pinning still reveals exact time, condition, rain chance, and wind.
- The chart is keyboard accessible; a visually hidden table mirrors all 24 hours.
- Six detail cards: wind, humidity, UV index, air quality (which becomes precipitation chance while previewing), visibility, and pressure. Each turns into a forecast card during a time scrub.
- A sky-level sun or moon follows the solar day: left horizon at sunrise, high through midday, right horizon at sunset; the moon crosses the night sky. It updates during scrubs and every minute, and the star field gives it space.
- The sky body dims behind overcast, rain, snow, and storms. Cloud layers drift in front of it — darker in rain and storm — and rain is wind-slanted. Storms add a screen flash and a randomly generated branched lightning bolt.
- Colorful weather glyphs change with day/night; the hourly graph, week bars, and details stay legible through the frosted material.
- `prefers-reduced-motion` removes particles, cursor light, lightning, and long transitions; the sun/moon remains as a static positional cue.
- `prefers-contrast: more` deepens the floor scrim, card tint, and text contrast.
- The particle canvas pauses when hidden and respects `save-data`.
- Lighthouse (live data, light and dark sky states): Accessibility 100, Best Practices 100, SEO 100.

### Debug states

Force a palette and its sky effects without changing the live weather:

`/?theme=rain&phase=day` — also `snow`, `fog`, `storm`, `clear`, `partly`, `cloudy`, `drizzle`.
Phases: `day`, `golden`, `night`.

Append them to the live URL with `&` to see rain on a clear day, a storm at night, or snow in the afternoon. These parameters are only for design review.
