# Asset manifest

Third-party, original and derived assets used by the homepage (hero 3D and backdrop) and the project pages.

| File | Used by | Source | Author | Licence | Changes | Size |
|---|---|---|---|---|---|---|
| `assets/env/studio_small_03_1k.jpg` | `home-scene.js` (reflections on the hero glass and ceramic forms) | https://polyhaven.com/a/studio_small_03 (tonemapped JPG) | Greg Zaal / Poly Haven | CC0 | Downscaled 8192×4096 → 1024×512, JPEG q84 | 63 KB |
| `assets/vendor/three-home.min.js` | `home-scene.js`, `demo-pane.js`, `demos/*.js` | three.js r186.1 (npm `three@0.186.1`) | three.js authors | MIT (`assets/vendor/three-LICENSE.txt`) | Tree-shaken + minified with esbuild; entry list in `three-home.entry.js` | ~151 KB gzip |
| `assets/portrait/reshad-headshot-*.webp`, `-720.png` | Hero portrait | Own studio photo (source file not published) | Reshad Ul Karim | Own | Local Apple Vision person mask, edge decontamination, shoulder/bottom fade; metadata stripped | 35–105 KB (WebP) |
| `assets/models/*` (security_camera_01, magnifying_glass_01, classic_laptop, circuit_board, marble_bust_01) | No longer loaded by the homepage (the research cards and awards use SVG motifs); kept for reference | https://polyhaven.com/models | Poly Haven artists (see each asset page) | CC0 | glTF 1k set; textures downscaled to 512 px JPEG q85 | 2.8 MB total, lazy-loaded |
| `assets/cursors/dot.svg`, `dot-action.svg` | Homepage cursor | Original | — | Own | — | <1 KB |
| `assets/motion/hero-contours-{640,1280}.{webm,mp4}`, `hero-contours-poster.webp` | Hero backdrop (`hero-motion.js`, `home.css`) | Original procedural render (`tools/make_hero_motion.py`) | Reshad Ul Karim | Own | 12 s seamless greyscale loop, tinted by CSS; VP9 + H.264 | 267–588 KB per file; poster 12 KB |
| `assets/images/project-cards/*-640w.webp` | Project cards (`render.js`) | Derived from the card images beside them (`tools/make_card_thumbs.py`) | — | as source | Resized to 640 px wide, WebP q74 | 7–60 KB |

Not downloaded: Kenney kits (kenney.nl returned HTTP 403 to automated downloads). The CAMDet exhibit builds its car, road and camera rigs from primitives instead.
