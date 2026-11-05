# Asset manifest

Third-party and derived assets used by the homepage 3D scene and the project exhibits.

| File | Used by | Source | Author | Licence | Changes | Size |
|---|---|---|---|---|---|---|
| `assets/env/studio_small_03_1k.jpg` | `home-scene.js` (reflections on the hero glass and ceramic forms) | https://polyhaven.com/a/studio_small_03 (tonemapped JPG) | Greg Zaal / Poly Haven | CC0 | Downscaled 8192×4096 → 1024×512, JPEG q84 | 63 KB |
| `assets/vendor/three-home.min.js` | `home-scene.js`, `demo-pane.js`, `demos/*.js` | three.js r186.1 (npm `three@0.186.1`) | three.js authors | MIT (`assets/vendor/three-LICENSE.txt`) | Tree-shaken + minified with esbuild; entry list in `three-home.entry.js` | ~151 KB gzip |
| `assets/portrait/reshad-headshot-*.webp`, `-720.png` | Hero portrait | Own studio photo (source file not published) | Reshad Ul Karim | Own | Local Apple Vision person mask, edge decontamination, shoulder/bottom fade; metadata stripped | 35–105 KB (WebP) |
| `assets/cursors/dot.svg`, `dot-action.svg` | Homepage cursor | Original | — | Own | — | <1 KB |

Not downloaded: Kenney kits (kenney.nl returned HTTP 403 to automated downloads). The CAMDet exhibit builds its car, road and camera rigs from primitives instead.
