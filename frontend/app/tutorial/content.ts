export type TutorialMedia = {
  type: "image";
  label: string;
  src: string;
  alt: string;
  placeholder: string;
};

export type TutorialPageContent = {
  hero: {
    title: string;
    subtitle: string;
    summary: string;
  };
  featuredVideo: {
    title: string;
    caption: string;
    placeholder: string;
  };
  rules: {
    title: string;
    badge: string;
    sections: {
      title: string;
      intro: string;
      bullets: string[];
    }[];
  };
  lobby: {
    title: string;
    body: string[];
    bullets: string[];
  };
  layouts: {
    title: string;
    body: string[];
    guideItems: {
      label: string;
      description: string;
    }[];
    desktopFeatures: {
      label: string;
      description: string;
    }[];
  };
};

export const tutorialContent: TutorialPageContent = {
  hero: {
    title: "How to Play Nash Hunger",
    subtitle: "Stay fed, trade fast, and learn the market one screen at a time.",
    summary:
      "If you are new, start with the basics below and focus on one goal: keep the foods you need in stock long enough to outlast the table.",
  },
  featuredVideo: {
    title: "See a round before you jump in",
    caption:
      "A short walkthrough here can show how quickly the market moves, what the screens look like, and why survival decisions matter more than perfect prices.",
    placeholder:
      "A short gameplay video belongs here: joining a room, opening trades on mobile, and reacting before a food shortage turns fatal.",
  },
  rules: {
    title: "Core Rules",
    badge: "Stay alive first",
    sections: [
      {
        title: "Food, production, and survival",
        intro:
          "Every player produces one food type, but that does not feed them. Survival depends on keeping enough of the other foods in stock at all times.",
        bullets: [
          "You produce 1 unique food and do not need to eat that one yourself.",
          "You must keep the other 3 foods available, because those are the foods your player needs to survive.",
          "One cycle happens every 1 second.",
          "Each cycle gives you +2 of the food you produce.",
          "That same cycle removes -1 of each of the 3 foods you need, so you lose 3 total food every cycle if you are still alive.",
          "If even 1 required food is missing when the survival check hits, you die immediately.",
          "A round lasts 3 minutes unless only 1 player is still alive first.",
          "If multiple players survive to the end, the survivor with the most cash wins.",
        ],
      },
      {
        title: "Buying and selling",
        intro:
          "Trading is how you turn your own surplus into the foods you actually need. You can buy food with bids and sell food with asks, but every order locks resources while it stays open.",
        bullets: [
          "Post a bid when you want to buy food and set the most you are willing to pay per unit.",
          "Post an ask when you want to sell food and set the least you are willing to accept per unit.",
          "Cash tied up in bids is reserved, so you cannot spend it somewhere else until the order fills or you cancel it.",
          "Food tied up in asks is reserved too, which means it cannot save you from starvation while that ask is still open.",
          "You can cancel stale orders to free up reserved cash or food before the next survival check.",
          "Good trading usually means selling your produced food and using that cash to buy back the 3 foods you need most urgently.",
        ],
      },
    ],
  },
  lobby: {
    title: "Lobby Setup",
    body: [
      "The lobby is where everyone gets into the same game and the host gets the table ready to start.",
    ],
    bullets: [
      "Create a room or join one with a display name, then share the room code or invite link.",
      "If you are hosting, you can add bots or use Fill with bots to fill empty seats quickly.",
      "Only the host can change bot difficulty or start the game.",
      "The game begins once all 4 seats are filled.",
    ],
  },
  layouts: {
    title: "Mobile and Desktop Layouts",
    body: [],
    guideItems: [
      {
        label: "Time",
        description: "Shows the time remaining in the round.",
      },
      {
        label: "Cash",
        description: "Shows how much cash you can spend on bidding for food.",
      },
      {
        label: "Your food",
        description: "Shows what you currently hold, including the food you produce yourself. The food you produce will be highlighted.",
      },
      {
        label: "Players",
        description: "Helps you see who is still alive and who may be under pressure.",
      },
      {
        label: "Best prices",
        description: "Shows the top bid, top ask, and recent trade prices you can act on.",
      },
      {
        label: "Scroll wheel",
        description: "Changes your order price quickly before you tap buy or ask.",
      },
      {
        label: "Buy / Ask",
        description: "Posts a bid to buy food or posts an ask to sell food.",
      },
    ],
    desktopFeatures: [
      {
        label: "Open orders",
        description:
          "Shows what is still live on the book so you can cancel stale bids or asks before they trap your cash or food.",
      },
      {
        label: "Trade history",
        description:
          "Shows who just bought, who sold, and what price the market most recently cleared at.",
      },
      {
        label: "Event log",
        description:
          "Tracks public state changes like round start, player deaths, and the end of the game.",
      },
    ],
  },
};
