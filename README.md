# taipei-trash

Interactive map of garbage-truck collection points and schedules for Taipei, New Taipei, Taichung and Kaohsiung — live at https://garbage.yukai.dev.

React 19 + Vite + MapLibre PWA, hosted on GitHub Pages. Collection data is refreshed monthly from each city's open-data API into the `data` branch and shipped with every deploy.

## Development

```bash
bun install
bun run dev        # Vite dev server
bun run typecheck  # tsc --noEmit
bun run build      # production build -> dist/
```

Data files in `public/*.json` are dumped from the `data` branch (`bun run dump-data`, needs a local `data` branch).

See `AGENTS.md` for conventions and how to add a city, and `docs/` for data-fetching, routing (Valhalla) and tech-stack notes.

## Authors and Contributors

### Author
- [Yukaii](https://github.com/Yukaii)

### Contributors
- [PastLeo](https://github.com/pastleo)
