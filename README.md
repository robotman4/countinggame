# Count & Build

A building site game for kids aged 4–8, for iPad (landscape) and iPhone. Works offline once installed.

The sign shows what the house needs, with pictures and a number: 4 beams + 2 rocks. Drive the machine to the right piles (tap a pile, or hold a finger where to go), drag or tap the pieces into the truck, and drive back. The truck tips its load and the house grows block by block. Every piece counts out loud with a big number and a rising note.

- 24 levels, from "2 bricks" up to four kinds of material and more than one trip.
- Three machines: the dump truck carries anything, the forklift carries bricks, beams, pipes and logs, and the excavator scoops sand, gravel, soil, coal and rocks. Later levels give you several machines, and picking the right one for each job is part of the plan.
- 1–3 stars, never 0. Extra pieces land on a leftover heap and cost a star; nothing is ever lost.
- Blocky 3D look drawn on a plain 2D canvas (`src/iso.js`, `src/models.js`), no images and no 3D library.
- Chiptune music and sounds, all synthesized.

Built from the kids game template. `CLAUDE.md` has the design rules and lessons.

## Develop

```bash
npm install
npm run dev      # dev server reachable from a tablet on the same network
npm run build    # production build into dist/
npm run preview  # serve the built version
python3 scripts/make_icons.py   # regenerate the app icons (needs Pillow)
```

To install on iPad or iPhone, open the GitHub Pages link in Safari and choose Share → Add to Home Screen.
