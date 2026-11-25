# Glycosearch

Website of glycosearch.com (Dr. Samuel Schmidt).

| Path | Content |
| --- | --- |
| `site/` | The redesigned website (2026): sources, content data, build and check scripts. Start with `site/README.md`. |
| `legacy-live-2026-11-24/` | Unchanged mirror of the live site of 24 Nov 2026. Build input for `site/`; never edited. |
| everything else in the root | The previous website as it was kept in this repository. A few media files are still read from here by the build. |

Build and preview (Node 20 or newer, macOS because of `sips`):

```bash
cd site
node scripts/build.mjs
node scripts/serve.mjs
```

The build writes `site/dist/`, which is not versioned. Uploading `dist/` to the web server is a separate step.
