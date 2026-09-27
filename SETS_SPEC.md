# Brick set file format

One file per set: `sets/<id>.json`. Everything about a set — the box, the price, the
brick list, the build steps — is derived from this one file by `tools/pack.js`.

```json
{
  "id": "city-fire-truck",
  "name": "Fire Truck",
  "theme": "City",
  "ages": "5+",
  "pieces": null,
  "blurb": "One short shelf-talker sentence. Under 90 characters.",
  "boxColor": "red",
  "legend": { "r": "red", "w": "white", "k": "black", "c": "glassClear" },
  "layers": [
    ["rrrrrrrr", "rrrrrrrr", "kk....kk"],
    ["r......r", "r.wwww.r", "........"]
  ]
}
```

## Fields
- `id` — lower-case letters, digits and dashes. Must match the filename.
- `name` — what is printed on the box. 1-3 words.
- `theme` — one of: `City`, `Space`, `Castle`, `Creatures`, `Vehicles`, `Hangout`, `Dino`, `Pirates`, `Holiday`, `Machines`.
- `ages` — `"4+"`, `"5+"`, `"6+"`, `"8+"` or `"9+"`.
- `blurb` — the shelf-talker sentence shown in the aisle and on the box back.
- `boxColor` — a palette key; the box art background.
- `legend` — maps one character to a palette colour name.
- `layers` — the model as voxel layers, **bottom layer first**. `layers[z][y]` is a row string,
  `layers[z][y][x]` is one 1x1 cell. `.` is empty.

## Hard rules (the validator enforces all of these)
1. Every layer has the same number of rows, and every row the same length. Footprint between 3x3 and 16x16, at most 14 layers.
2. Every character in a row is `.` or a key in `legend`. Every legend value is a real palette colour.
3. **Nothing floats.** In every layer above the bottom, each connected island of cells must have at
   least one cell directly above a filled cell in the layer below. This is what makes the model
   buildable brick by brick. (A one-cell overhang is fine as long as the island it belongs to is
   connected to something that does rest on the layer below.)
4. At least 40 filled cells. Aim for a packed brick count of 30-320; the sweet spot is 45-140.

## Palette colour names
white, lightGray, darkGray, black, red, orange, yellow, lime, green, darkGreen, cyan, blue,
darkBlue, purple, magenta, pink, brown, tan, darkTan, sand, gold, silver, glassClear, glassBlue, glassRed

## Reading the axes
`x` runs left-to-right, `y` runs **back-to-front** (row 0 is the far side of the model, the last row
is nearest the viewer), `z` runs bottom-to-top. The renderer draws the model isometrically, so the
front rows and the top layers are what a player actually sees — put the detail there.

## What makes a good set
- It should read as the thing it is named after from across the room. Silhouette first, detail second.
- Use `.` generously. A solid rectangular block of cells is boring and expensive in bricks.
- Colour changes are free — a stripe, a window row, a contrasting roof all cost nothing.
- `glassClear` / `glassBlue` render as translucent, so use them for windscreens and canopies.
- Layers 0 and 1 are usually the chassis/base; the interesting shape belongs in layers 2+.

## Validating
```
cd ~/Desktop/sprites/BRICKS && node tools/validate.js sets/<id>.json
```
Prints `OK <id> "<name>" [<theme>] N bricks, M build steps, WxDxH, $P`, or `INVALID` plus the reasons.
A set is not finished until this prints OK.
