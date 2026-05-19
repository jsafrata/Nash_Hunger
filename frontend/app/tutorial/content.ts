export type TutorialMedia = {
  type: "image";
  label: string;
  src: string;
  alt: string;
  placeholder: string;
};

export type TutorialSection = {
  id: string;
  eyebrow: string;
  title: string;
  body: string[];
  bullets?: string[];
  callout?: string;
  media?: TutorialMedia;
};

export type TutorialPageContent = {
  hero: {
    title: string;
    subtitle: string;
    summary: string;
  };
  quickStart: {
    title: string;
    steps: string[];
  };
  rules: {
    title: string;
    bullets: string[];
  };
  sections: TutorialSection[];
  tips: {
    title: string;
    items: string[];
  };
};

export const tutorialContent: TutorialPageContent = {
  hero: {
    title: "How to Play Nash Hunger",
    subtitle: "Manage your food cycle, trade faster than the room, and stay alive.",
    summary:
      "This guide matches the current Nash_Hunger client: the lobby, the desktop trading rows, and the mobile-first quick trading screen.",
  },
  quickStart: {
    title: "Quick Start",
    steps: [
      "Enter a display name, create a room, and share the room code or invite link.",
      "Fill empty seats with bots or wait until all 4 seats are occupied.",
      "When the round starts, learn which food you produce and which three foods you must keep eating.",
      "Watch your cash, inventory, and reserved amounts before posting bids or asks.",
      "Trade for the foods you are missing and survive longer than everyone else, or finish with the most cash among survivors.",
    ],
  },
  rules: {
    title: "Core Rules",
    bullets: [
      "There are 4 players and 4 food types. Each player produces exactly one food.",
      "You do not need to eat the food you produce. You must keep the other three foods in stock.",
      "On each consumption cycle, you produce +2 of your own food and consume -1 of each required food.",
      "If a required food is missing when a cycle resolves, you die immediately.",
      "Food reserved in open asks cannot be eaten, and cash reserved in open bids cannot be spent elsewhere.",
      "The round ends after 3 minutes or sooner if only one player is still alive.",
      "If multiple players survive the full timer, the surviving player with the most cash wins.",
    ],
  },
  sections: [
    {
      id: "lobby",
      eyebrow: "Before The Round",
      title: "Lobby and Room Setup",
      body: [
        "The lobby is where the host assembles the table, copies the invite link, manages bots, and starts the round once all 4 seats are full.",
        "Every player stays visible in seat order, with clear labels for YOU, BOT, and HOST. The difficulty buttons control how quickly bots react once the market opens.",
      ],
      bullets: [
        "The room code is the easiest way to confirm everyone joined the right match.",
        "Only the host can add bots, fill the room, change difficulty, or start the game.",
        "The start button stays locked until all 4 seats are filled.",
      ],
      media: {
        type: "image",
        label: "Lobby screenshot",
        src: "",
        alt: "Lobby screen placeholder",
        placeholder:
          "Capture the lobby with the room code, player list, bot controls, and the start button visible.",
      },
    },
    {
      id: "status",
      eyebrow: "Always Visible",
      title: "Top Status Bar",
      body: [
        "The top bar anchors the whole round. It shows the room code, connection status, remaining time, and how many players are still alive.",
        "Once the match is active, the progress bar and timer colors become your fastest warning that the round is entering its final stretch.",
      ],
      bullets: [
        "Room code stays visible for reconnects and late joins to the game page.",
        "The connection indicator tells you whether the client is live or trying to recover.",
        "Alive count matters because a round can end early when only one player remains.",
      ],
      media: {
        type: "image",
        label: "Status bar screenshot",
        src: "",
        alt: "Top status bar placeholder",
        placeholder:
          "Capture the timer bar with the room code, remaining time, alive count, and connection status visible.",
      },
    },
    {
      id: "desktop-hand",
      eyebrow: "Desktop Overview",
      title: "Your Banner and Opponent Row",
      body: [
        "On desktop, the first thing under the timer is your hand banner. It shows your current cash, each food count, and any inventory already reserved in asks.",
        "Below that, the opponent row summarizes recent trade flow. Each box shows the foods another player has been gaining or losing in the last few seconds, which helps you spot pressure and desperation quickly.",
      ],
      bullets: [
        "Your produced food is highlighted in the banner because it is the one you naturally replenish.",
        "Reserved inventory appears next to the total so you can see when posted asks are putting survival at risk.",
        "Positive and negative opponent deltas hint at who is buying aggressively and who is unloading inventory.",
      ],
      callout:
        "Do not trust the total number in a food pile by itself. If part of it is reserved in an ask, it is not available to keep you alive.",
      media: {
        type: "image",
        label: "Banner and opponents screenshot",
        src: "",
        alt: "Desktop hand banner and opponents row placeholder",
        placeholder:
          "Capture the desktop view with your hand banner and the opponent row visible together.",
      },
    },
    {
      id: "desktop-market",
      eyebrow: "Desktop Trading",
      title: "Food Rows and Trading Actions",
      body: [
        "The desktop market is organized as one row per food. Each row shows the best bid on the left, the best ask on the right, the last trade in the middle, and fast buttons for posting or crossing the market.",
        "You can post a bid using the left BUY button and its price stepper, post an ask using the right ASK button and its stepper, or trade instantly against the best visible price with the other side's market button.",
      ],
      bullets: [
        "Each row is for one unit of food at a time, so speed matters more than building a large order ticket.",
        "The center label shows the food emoji, name, last trade, and hotkey.",
        "Hotkeys select foods with `g`, `v`, `m`, and `k`, and `c` cancels all open orders.",
      ],
      callout:
        "Instant fills are often worth more than a perfect price when one of your required foods is close to running out.",
      media: {
        type: "image",
        label: "Food row screenshot",
        src: "",
        alt: "Desktop food row placeholder",
        placeholder:
          "Capture one or more desktop food rows with best bid, best ask, last trade, buttons, and price steppers visible.",
      },
    },
    {
      id: "orders-and-tape",
      eyebrow: "Desktop Tracking",
      title: "Open Orders, Trade History, and Event Log",
      body: [
        "After you post, the lower panels tell you whether your plan still makes sense. Your open orders list shows what is live, the trade history shows who is hitting whom, and the event log calls out public state changes like deaths and the round ending.",
        "These panels are where you catch stale quotes. If your order is still sitting while the tape moves away from you, it is usually time to cancel or repost.",
      ],
      bullets: [
        "Cancel individual orders when they become dangerous or overpriced.",
        "Use Cancel all when you need to free reserved cash or food immediately.",
        "Trade history is public, so it is also a read on what other players need right now.",
      ],
      media: {
        type: "image",
        label: "Orders and log screenshot",
        src: "",
        alt: "Open orders and market log placeholder",
        placeholder:
          "Capture the open orders panel alongside the trade history and event log.",
      },
    },
    {
      id: "mobile",
      eyebrow: "Mobile Layout",
      title: "Quick Trading on Mobile",
      body: [
        "The mobile layout is a separate fast-trading screen built for short vertical scans. It keeps the timer and cash at the top, your inventory strip underneath, a compact player strip, a bid/ask/last table, and then one buy button plus one ask button for each food.",
        "Each mobile action button has its own price control, so you can nudge prices up or down and fire orders rapidly without switching into a larger form.",
      ],
      bullets: [
        "The food you produce is outlined in the inventory strip.",
        "Buy buttons are limited by available cash, and ask buttons are limited by available inventory.",
        "The mobile screen is optimized for speed, not for the full desktop market context.",
      ],
      media: {
        type: "image",
        label: "Mobile game screenshot",
        src: "",
        alt: "Mobile trading layout placeholder",
        placeholder:
          "Capture the mobile game screen with the timer, inventory strip, player strip, bid/ask/last table, and action buttons visible.",
      },
    },
  ],
  tips: {
    title: "Practical Tips",
    items: [
      "The most dangerous state is not being poor. It is being short one specific required food on the next cycle.",
      "Posted asks can kill you by locking food you thought you still had.",
      "If you survive to the end with others, cash breaks the tie, so late-game spending should be deliberate.",
      "Recent trade flow is often the best clue to who is panicking and what food is suddenly scarce.",
    ],
  },
};
