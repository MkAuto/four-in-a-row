# Four in a Row

A pixel-art game where two players take turns dropping discs into a 7×6 board. The first
to line up four discs (horizontally, vertically or diagonally) wins. Play against a friend
on the same screen, or against an AI that uses minimax search with alpha-beta pruning.

It's a rebuild for the web of a C# / Windows Forms game I made in school in 2019, using the
same art and sound.

## Features

- **1 player** against the AI, with three difficulty levels: Easy, Normal and Hard
- **2 players** on the same device
- Player names and color choice (red always plays first)
- **Ghost disc**: hovering a column (or focusing it with the keyboard) shows where the disc will land
- **Scoreboard** for each matchup (wins and draws), saved in the browser, with a reset button
- Winning line highlighted, move counter, end-of-game dialog with a rematch option
- Drop sound, which can be muted
- **English and French**, switchable at any time (the choice is remembered)
- Works with mouse, touch and keyboard (Tab to a column, Enter to drop)

## Getting started

Requires [Node.js](https://nodejs.org/) 22.12 or newer.

```sh
npm install
npm run dev        # start the dev server and open the URL it prints
npm test           # run the unit tests
npm run build      # type-check and build the site into dist/
npm run preview    # serve the built site locally
```

`dist/` contains only static files, so it can be hosted anywhere (GitHub Pages, GitLab Pages,
Netlify...). The build uses relative paths, so it also works from a sub-folder.

## Docker

The [`Dockerfile`](Dockerfile) runs the tests, builds the game, and serves it with Caddy on
port 8080 as an unprivileged user. HTTPS is left to a reverse proxy in front of it.

```sh
docker build -t four-in-a-row .
docker run --rm -p 8080:8080 four-in-a-row   # then open http://localhost:8080
```

Each push to `master` publishes the image as `ghcr.io/mkauto/four-in-a-row:latest`
([GitHub Actions workflow](.github/workflows/image.yml)). A version tag such as `1.2.0` also
publishes `:1.2.0`. If a test fails, no image is published.

## How the AI works

The AI ([`src/ai/minimax.ts`](src/ai/minimax.ts)) looks ahead with **minimax**: it tries
each of its moves, then each reply, and so on. It assumes the opponent always picks the reply
that is worst for the AI, and keeps the move with the best guaranteed outcome.

- **Alpha-beta pruning** skips moves that cannot change the result. Trying the center columns
  first makes it skip far more.
- Positions where the game is over get an exact score. Faster wins score higher, and slower
  losses are less bad. Positions at the depth limit get a heuristic score: discs in the center
  column, and groups of four cells that only one player can still complete.
- Speed-ups:
  - If the player to move can win right away, the search stops there.
  - If the opponent threatens to win, only the blocking move is searched.
  - Two threats at once count as a loss.
  - A transposition table remembers positions already searched.
  - Iterative deepening searches one move ahead, then two, and so on, until it reaches the
    depth or the time limit.
- The search runs in a **Web Worker**, so the page stays responsive while the AI thinks.

| Level  | Looks ahead | Notes                                              |
| ------ | ----------- | -------------------------------------------------- |
| Easy   | 2 moves     | plays a random column 30% of the time              |
| Normal | 5 moves     |                                                    |
| Hard   | 10 moves    | stops at the deepest search finished within 2 s    |

The levels are defined in [`src/ai/levels.ts`](src/ai/levels.ts).

## Project structure

```
src/
  game/board.ts      board, moves, win detection
  game/match.ts      one game: players, turns, winner or draw
  ai/minimax.ts      minimax with alpha-beta pruning
  ai/levels.ts       difficulty settings
  ai/ai.worker.ts    runs the AI in a background thread
  ai/aiPlayer.ts     talks to the worker (falls back to the main thread if needed)
  ui/menu.ts         menu screens
  ui/gameView.ts     game screen: board, ghost disc, scoreboard, end-of-game dialog
  app.ts             screen switching, language and sound toggles
  i18n.ts            English and French texts
  scoreboard.ts      scores saved in the browser
  sound.ts           drop sound
  style.css          pixel-art styles
```

The tests sit next to the code (`*.test.ts`). Among other things, they check the win detection
against a full-board scan over thousands of random games, and check the AI against an exhaustive
search on 100 endgames.

## Credits

- Pixel art (sky background, discs) and drop sound: from the original 2019 school project.
- Font: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) by CodeMan38,
  under the SIL Open Font License, bundled through `@fontsource/press-start-2p`.

## License

[MIT](LICENSE). The Press Start 2P font keeps its own license (SIL Open Font License).
