# Spanish Card Game

Clean Expo + Socket.IO implementation for the Sticks, Cups, Swords, and Gold card game.

## Card Assets

Put card images in:

```txt
resources/cards/
```

The server maps suits to Spanish deck keys:

```txt
bastos-1.png
bastos-2.png
bastos-3.png
bastos-4.png
bastos-5.png
bastos-6.png
bastos-7.png
bastos-10.png
bastos-11.png
bastos-12.png

copas-1.png
espadas-1.png
oros-1.png
```

Repeat the same numbers for `copas`, `espadas`, and `oros`.

The default extension is `png`. To use another extension:

```bash
cd server
$env:CARD_IMAGE_EXT="jpg"
npm run dev
```

## Run The Server

```bash
cd server
npm run dev
```

Server URL:

```txt
http://localhost:3001
```

## Run The Expo App

In another terminal:

```bash
npm run web
```

Expo URL:

```txt
http://localhost:8081
```

For a physical phone, replace `localhost` in the app connection field with your computer IP address, for example:

```txt
http://192.168.1.20:3001
```

## Rules Implemented

- 2 to 4 players.
- 4 cards dealt to each player.
- 1 card starts in the middle.
- Play by matching suit or number.
- If you cannot play, draw until you can.
- `1` gives the next player 10 seconds to answer with another `1` or lose their turn.
- `2` gives the next player 10 seconds to stack another `2` or draw the full penalty and lose their turn.
- `7` lets the player choose the next suit.
- First player with no cards wins.
