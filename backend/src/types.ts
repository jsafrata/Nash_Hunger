export type FoodType = "A" | "B" | "C" | "D";

export const FOOD_TYPES: FoodType[] = ["A", "B", "C", "D"];

export const FOOD_DISPLAY_NAMES: Record<FoodType, string> = {
  A: "Wheat",
  B: "Fish",
  C: "Meat",
  D: "Fruit",
};

export type Inventory = Record<FoodType, number>;

export type GamePhase = "lobby" | "active" | "ended";

export type PlayerStatus = "alive" | "dead" | "disconnected";

export interface Player {
  id: string;
  socketId: string | null;
  name: string;
  isHost: boolean;
  isBot: boolean;
  status: PlayerStatus;
  produces: FoodType | null;
  cash: number;
  reservedCash: number;
  inventory: Inventory;
  reservedInventory: Inventory;
  diedAtSecond: number | null;
  disconnectedAtSecond: number | null;
  totalBought: number;
  totalSold: number;
  cashFromTrades: number;
  cashSpentOnTrades: number;
}

export type OrderSide = "bid" | "ask";

export type OrderStatus = "open" | "partially_filled" | "filled" | "cancelled";

export interface Order {
  id: string;
  playerId: string;
  foodType: FoodType;
  side: OrderSide;
  pricePerUnit: number;
  originalQuantity: number;
  remainingQuantity: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Trade {
  id: string;
  foodType: FoodType;
  buyerId: string;
  sellerId: string;
  pricePerUnit: number;
  quantity: number;
  totalPrice: number;
  makerOrderId: string;
  takerOrderId: string;
  timestamp: number;
  elapsedSecond: number;
}

export interface OrderBook {
  foodType: FoodType;
  bids: Order[];
  asks: Order[];
}

export type GameEventType =
  | "game_started"
  | "player_died"
  | "game_ended"
  | "player_disconnected"
  | "player_reconnected";

export interface GameEvent {
  id: string;
  type: GameEventType;
  elapsedSecond: number;
  timestamp: number;
  message: string;
  data?: Record<string, unknown>;
}

export interface GameRoom {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  orderBooks: Record<FoodType, OrderBook>;
  trades: Trade[];
  eventLog: GameEvent[];
  startedAt: number | null;
  endsAt: number | null;
  elapsedSeconds: number;
  maxSeconds: number;
  tickInterval: NodeJS.Timeout | null;
  botIntervals: Map<string, NodeJS.Timeout>;
  rateLimits: Map<string, RateLimitState>;
  winnerIds: string[];
  endReason: GameEndReason | null;
}

export interface RateLimitState {
  ordersThisSecond: number;
  cancelsThisSecond: number;
  windowStart: number;
}

export type GameEndReason = "time_limit" | "single_survivor" | "no_survivors";

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

export interface PublicGameState {
  roomCode: string;
  phase: GamePhase;
  elapsedSeconds: number;
  remainingSeconds: number;
  maxSeconds: number;
  players: PublicPlayerState[];
  recentTrades: PublicTrade[];
  publicEventLog: GameEvent[];
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

export interface PostOrderInput {
  playerId: string;
  side: OrderSide;
  foodType: FoodType;
  quantity: number;
  pricePerUnit: number;
}
