export type FoodType = "A" | "B" | "C" | "D";

export const FOOD_TYPES: FoodType[] = ["A", "B", "C", "D"];

export const FOOD_DISPLAY_NAMES: Record<FoodType, string> = {
  A: "Grain",
  B: "Veggie",
  C: "Meat",
  D: "Milk",
};

export const FOOD_EMOJIS: Record<FoodType, string> = {
  A: "🌾",
  B: "🥬",
  C: "🥩",
  D: "🥛",
};

export const FOOD_HOTKEYS: Record<FoodType, string> = {
  A: "g",
  B: "v",
  C: "m",
  D: "k",
};

export const HOTKEY_TO_FOOD: Record<string, FoodType> = {
  g: "A",
  v: "B",
  m: "C",
  k: "D",
};

export const FOOD_COLORS: Record<FoodType, string> = {
  A: "#f5d76e",
  B: "#5dade2",
  C: "#e74c3c",
  D: "#a569bd",
};

export type Inventory = Record<FoodType, number>;
export type GamePhase = "lobby" | "active" | "ended";
export type PlayerStatus = "alive" | "dead" | "disconnected";
export type OrderSide = "bid" | "ask";
export type OrderStatus = "open" | "partially_filled" | "filled" | "cancelled";
export type GameEndReason = "time_limit" | "single_survivor" | "no_survivors";
export type BotDifficulty = "easy" | "medium" | "hard";

export interface PublicOrderBookLevel {
  pricePerUnit: number;
  totalQuantity: number;
}

export interface PublicOrderBook {
  foodType: FoodType;
  bids: PublicOrderBookLevel[];
  asks: PublicOrderBookLevel[];
  lastTradePrice: number | null;
  lastTradeQuantity: number | null;
}

export interface PublicPlayerState {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  status: PlayerStatus;
  produces: FoodType | null;
  diedAtSecond: number | null;
}

export interface PublicTrade {
  id: string;
  foodType: FoodType;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  pricePerUnit: number;
  quantity: number;
  totalPrice: number;
  elapsedSecond: number;
}

export interface GameEvent {
  id: string;
  type:
    | "game_started"
    | "player_died"
    | "game_ended"
    | "player_disconnected"
    | "player_reconnected";
  elapsedSecond: number;
  timestamp: number;
  message: string;
  data?: Record<string, unknown>;
}

export interface PublicGameState {
  roomCode: string;
  phase: GamePhase;
  elapsedSeconds: number;
  remainingSeconds: number;
  maxSeconds: number;
  players: PublicPlayerState[];
  recentTrades: PublicTrade[];
  publicEventLog: GameEvent[];
  botDifficulty: BotDifficulty;
  consumptionIntervalSeconds: number;
}

export interface PrivatePlayerState {
  playerId: string;
  cash: number;
  reservedCash: number;
  availableCash: number;
  inventory: Inventory;
  reservedInventory: Inventory;
  availableInventory: Inventory;
  produces: FoodType | null;
  requiredFoods: FoodType[];
  secondsUntilStarvation: Partial<Record<FoodType, number>>;
}

export interface OwnOrderView {
  id: string;
  foodType: FoodType;
  side: OrderSide;
  pricePerUnit: number;
  originalQuantity: number;
  remainingQuantity: number;
  status: OrderStatus;
  createdAt: number;
}

export interface FinalPlayerState {
  id: string;
  name: string;
  produces: FoodType | null;
  status: PlayerStatus;
  diedAtSecond: number | null;
  finalCash: number;
  finalInventory: Inventory;
  totalBought: number;
  totalSold: number;
  cashFromTrades: number;
  cashSpentOnTrades: number;
}

export interface GameOverPayload {
  winnerIds: string[];
  reason: GameEndReason;
  finalPlayers: FinalPlayerState[];
}

export interface RoomJoinedPayload {
  roomCode: string;
  playerId: string;
  isHost: boolean;
}

export interface ErrorMessage {
  code: string;
  message: string;
}
