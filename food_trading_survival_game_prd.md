# PRD: Continuous-Time Food Trading Survival Game

## 1. Product Summary

### 1.1 Working Title
**Continuous Food Market Survival Game**  
Alternative names: **Scarcity Exchange**, **Rations Market**, **Four-Food Exchange**, **Survive the Book**.

### 1.2 Product Description
This is a real-time 4-player market survival game. Each player produces one unique food type, starts with a private food inventory and cash, and must continuously consume the three food types they do **not** produce. Players trade through a continuous limit order book: they can post bids, post asks, and cancel previously posted quotes. Orders can be partially filled, and trades execute using standard exchange-style maker-price logic.

The game lasts **10 minutes**. At the end, among surviving players, the player with the most cash wins.

The frontend will be deployed on **Vercel**. The backend will be deployed on **Railway**.

---

## 2. Core Design Goals

### 2.1 Main Goal
Create a fast real-time trading game where survival depends on continuously managing inventory, cash, production, and market orders under scarcity.

### 2.2 Design Principles

1. **Continuous pressure**  
   Players can trade at any time, while survival checks resolve on a repeating 10-second cycle.

2. **Real market mechanics**  
   The game uses a simplified limit order book with bids, asks, partial fills, quote cancellation, price-time priority, and maker-price execution.

3. **Private information**  
   Players do not see other players’ inventories or cash. They infer scarcity and desperation from orders and trades.

4. **Simple actions, strategic depth**  
   Each player can only post bids, post asks, and cancel quotes, but these actions create bluffing, hoarding, market-making, and survival strategies.

5. **No emergency rescue**  
   There is no emergency market or automatic bailout. Survival depends only on initial inventory, production, and trading.

6. **Cash determines victory**  
   Food is necessary to survive, but the winner is the surviving player with the most cash at the end of the match.

---

## 3. Game Overview

### 3.1 Players
- Exactly **4 players** per game.
- Each player is assigned exactly one unique food type to produce.
- A player does **not** need to eat the food type they produce.
- A player must continuously eat the other 3 food types.

### 3.2 Food Types
There are exactly **4 food types**.

For implementation:

```ts
type FoodType = "A" | "B" | "C" | "D";
```

Possible display names:

```ts
const FOOD_DISPLAY_NAMES = {
  A: "Wheat",
  B: "Fish",
  C: "Meat",
  D: "Fruit",
};
```

The names are cosmetic and can be changed later.

### 3.3 Game Length
- The match lasts exactly **10 minutes**.
- Internally this is **600 seconds**.
- The game runs on a server-authoritative clock.

```ts
const GAME_DURATION_SECONDS = 600;
```

### 3.4 Starting Resources
At game start:

- Each player receives **100 cash**.
- A deck of **400 food units** is created:
  - 100 units of food A
  - 100 units of food B
  - 100 units of food C
  - 100 units of food D
- The deck is shuffled.
- Each player receives exactly **100 food units**.
- Each player is guaranteed at least **20 units of each food type**.
- The remaining **20 units** per player are dealt randomly from the shuffled deck.

Important: the starting food distribution is globally fixed at 100 units of each food type, but it is not fully random at the player level because of the 20-per-food guarantee.

### 3.5 Production
Each player produces one unique food type.

Every 10-second survival cycle:

- Each living player produces **2 units** of their own food type.
- Dead players do not produce.

Example:

If Alice produces food A, then every cycle while Alice is alive:

```text
Alice inventory A += 2
```

### 3.6 Consumption
Every 10-second survival cycle:

- Each living player consumes **1 unit of each food type they do not produce**.
- Each living player therefore consumes **3 food units per cycle**.
- A player does not consume their own produced food type.

Example:

If Alice produces food A, then every cycle she must consume:

```text
1 unit of B
1 unit of C
1 unit of D
```

She does not need to consume A.

### 3.7 Death Condition
At each consumption tick, if a player does not have at least 1 unit of every required food type, they die.

A player dies if they are missing at least one required food type at the moment of consumption.

Example:

Alice produces A. At a consumption tick, her inventory is:

```text
A: 50
B: 3
C: 0
D: 2
```

Alice dies because she is missing C, even though she has many units of A.

### 3.8 Victory Condition
The game ends when either:

1. 600 seconds have elapsed, or
2. only one player remains alive, or
3. all players are dead.

At game end:

- If exactly one player is alive, that player wins.
- If multiple players are alive after 600 seconds, the surviving player with the most cash wins.
- If no players are alive, there is no winner.
- Leftover food has no cash value.

Recommended tie-breaker:

1. Most cash among survivors.
2. If tied, most total leftover food.
3. If still tied, declare joint winners.

Leftover food is not converted into cash; it is only used as a tie-breaker.

---

## 4. Important Balance Note

With the implemented numbers, the game has meaningful pressure but is not mathematically forced into a global shortage.

### 4.1 Total Initial Food
```text
4 food types × 100 units each = 400 initial food units
```

### 4.2 Total Production If All Players Survive
Each cycle:

```text
4 players × 2 units = 8 new food units per cycle
```

Over 600 seconds = 60 cycles:

```text
8 × 60 = 480 produced food units
```

Total food available if all players survive:

```text
400 + 480 = 880 total food units
```

### 4.3 Total Consumption If All Players Survive
Each cycle:

```text
4 players × 3 required food units = 12 consumed food units per cycle
```

Over 600 seconds = 60 cycles:

```text
12 × 60 = 720 consumed food units
```

### 4.4 Total Surplus
```text
880 available - 720 required = 160 food-unit surplus
```

Therefore, with these exact parameters, it is mathematically possible for all four players to survive the full match if they trade well enough.

### 4.5 Per-Food Balance
For each food type:

Initial supply:

```text
100 units
```

Production by that food’s producer across 600 seconds:

```text
2 units/cycle × 60 cycles = 120 units
```

Total supply per food type:

```text
100 + 120 = 220 units
```

Demand for that food type comes from the 3 players who do not produce it:

```text
3 players × 1 unit/cycle × 60 cycles = 180 units
```

Surplus per food type:

```text
220 - 180 = 40 units
```

Across 4 food types:

```text
40 × 4 = 160 units surplus
```

This means the game still creates strong trading pressure, but survival is not mathematically impossible.

---

## 5. Core Game Loop

Unlike the previous round-based version, this version is continuous-time.

There are no discrete trading rounds. Instead, the game has simultaneous ongoing systems:

1. production ticks,
2. consumption ticks,
3. order book matching,
4. death checks,
5. game timer.

### 5.1 High-Level Flow

```text
Lobby
↓
Game Setup
↓
Start 600-second match timer
↓
Every 10 seconds:
  - living players produce 2 units of own food
  - living players consume 1 unit of each non-produced food
  - players missing required food die

At any time during the match:
  - players can post bids
  - players can post asks
  - players can cancel their own orders
  - matching orders execute immediately

Game ends when:
  - 600 seconds pass, or
  - only one player remains alive, or
  - all players die
↓
Winner calculation
↓
Game over screen
```

### 5.2 Tick Order
Every 10-second survival cycle, the backend should process game logic in this order:

1. Check if game is already over.
2. Apply production for all living players.
3. Apply consumption for all living players.
4. Resolve deaths.
5. Cancel or remove dead players’ open orders.
6. Emit updated public and private state.
7. Check game-end conditions.

Recommended order:

```text
Production → Consumption → Death Resolution
```

Reason: production happens during the cycle before the player eats. This gives producers their new output before the consumption check.

Important: a player does not consume their own produced food, so production does not directly save the producer from starvation. It gives them something to sell.

---

## 6. Market System

## 6.1 Market Type
The game uses a continuous limit order book.

Players can submit:

1. **Bid**: an offer to buy a quantity of a food type at a maximum price per unit.
2. **Ask**: an offer to sell a quantity of a food type at a minimum price per unit.
3. **Cancel**: a request to remove one of their own open orders.

### 6.2 Separate Books Per Food Type
Each food type has its own order book.

There are 4 independent order books:

```text
Order Book A
Order Book B
Order Book C
Order Book D
```

Each order book contains:

- bids for that food type,
- asks for that food type.

### 6.3 Order Object

```ts
type OrderSide = "bid" | "ask";

type OrderStatus = "open" | "partially_filled" | "filled" | "cancelled";

interface Order {
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
```

### 6.4 Price and Quantity Rules

- Prices are integer cash amounts.
- Quantities are integer food units.
- Minimum price is 0.
- Minimum quantity is 1.
- A bid cannot exceed the buyer’s available cash.
- An ask cannot exceed the seller’s available inventory for that food type.
- Negative prices are not allowed.
- Decimal quantities are not allowed.
- Decimal prices are not allowed.

### 6.5 Available Balance Locking
When a player posts an order, the backend should reserve the relevant resources.

This prevents players from double-spending cash or double-selling food.

#### For Bids
When a player posts a bid:

```text
reservedCash = pricePerUnit × quantity
```

That cash is locked until:

- the order fills,
- the order partially fills,
- the order is cancelled,
- the player dies,
- the game ends.

#### For Asks
When a player posts an ask:

```text
reservedInventory[foodType] = quantity
```

That food is locked until:

- the order fills,
- the order partially fills,
- the order is cancelled,
- the player dies,
- the game ends.

### 6.6 Why Locking Is Necessary
Without locking, this bug could happen:

1. Alice has 10 cash.
2. Alice posts a bid for 1 unit at 10.
3. Alice also posts another bid for 1 unit at 10.
4. Both execute.
5. Alice would need to pay 20 cash despite only having 10.

To prevent this, the backend must track:

```ts
player.cash
player.reservedCash
player.inventory
player.reservedInventory
```

Available cash:

```ts
availableCash = cash - reservedCash
```

Available food:

```ts
availableFood = inventory[foodType] - reservedInventory[foodType]
```

### 6.7 Consumption and Reserved Inventory
Important design decision:

**Reserved food should not be available for consumption.**

If a player posts an ask, that food is committed to the market and cannot save them from starvation unless they cancel the order before the consumption tick.

This creates strategic risk:

- If you post too much food for sale, you may starve.
- If you cancel in time, you can reclaim the food.

Implementation rule:

At consumption, use only unreserved inventory:

```ts
availableFood = inventory[foodType] - reservedInventory[foodType]
```

If availableFood is less than 1 for any required food, the player dies.

Alternative simpler MVP rule:

- Reserved food remains physically in inventory and can still be consumed.
- If consumed, the order is automatically reduced/cancelled.

Recommended choice: **reserved food is unavailable for consumption**, because this is cleaner and closer to real order-book mechanics.

### 6.8 Production and Reserved Inventory
Newly produced food is added to unreserved inventory.

```ts
player.inventory[player.produces] += 2;
```

It is not automatically listed for sale. The player must manually post asks.

---

## 7. Order Matching Rules

## 7.1 Basic Matching Condition
A bid and ask match if:

```text
bid.pricePerUnit >= ask.pricePerUnit
```

If the highest bid is greater than or equal to the lowest ask, a trade can execute.

### Example

```text
Bid: buy 5 units at $10
Ask: sell 2 units at $8
```

Because:

```text
10 >= 8
```

the orders match.

---

## 7.2 Maker-Taker Price Rule
The transaction price is determined by the **resting order**, also called the **maker order**.

- The maker is the order already sitting on the book.
- The taker is the new incoming order that triggers the match.
- The trade executes at the maker’s price.

### Example 1: Resting Bid, Incoming Ask

Resting order:

```text
10:00 AM — Bid for 5 units at $10
```

Incoming order:

```text
10:05 AM — Ask for 2 units at $8
```

The ask crosses the bid because:

```text
$10 bid >= $8 ask
```

The resting order is the bid at $10.

Therefore:

```text
Transaction price = $10
Units traded = 2
Cash exchanged = $20
```

After trade:

```text
Bid remains open with 3 units at $10
Ask is fully filled and removed
```

### Example 2: Resting Ask, Incoming Bid

Resting order:

```text
10:00 AM — Ask for 5 units at $8
```

Incoming order:

```text
10:05 AM — Bid for 2 units at $10
```

The bid crosses the ask because:

```text
$10 bid >= $8 ask
```

The resting order is the ask at $8.

Therefore:

```text
Transaction price = $8
Units traded = 2
Cash exchanged = $16
```

After trade:

```text
Ask remains open with 3 units at $8
Bid is fully filled and removed
```

### 7.3 Why Maker Price Is Used
This is standard exchange behavior. The taker accepts available liquidity already on the book. If a buyer was already willing to pay $10, then an incoming seller willing to sell at $8 receives the resting buyer’s $10 price because that is the price of the existing liquidity.

---

## 7.4 Partial Fulfillment
Orders can be partially filled.

The quantity traded is:

```text
min(incomingOrder.remainingQuantity, restingOrder.remainingQuantity)
```

### Example

Resting bid:

```text
Buy 5 units at $10
```

Incoming ask:

```text
Sell 2 units at $8
```

Trade quantity:

```text
min(5, 2) = 2 units
```

Residual state:

```text
Bid remains with 3 units
Ask is fully filled
```

---

## 7.5 Price-Time Priority
When multiple orders are available, matching should follow price-time priority.

### For Bids
Higher bid prices have priority.

If prices are tied, earlier orders have priority.

Example bid priority:

```text
1. Bid $12 created at 10:01
2. Bid $11 created at 10:00
3. Bid $10 created at 09:59
4. Bid $10 created at 10:02
```

### For Asks
Lower ask prices have priority.

If prices are tied, earlier orders have priority.

Example ask priority:

```text
1. Ask $7 created at 10:03
2. Ask $8 created at 10:00
3. Ask $8 created at 10:04
4. Ask $9 created at 09:59
```

### Implementation Sorting
For bids:

```ts
bids.sort((a, b) => {
  if (b.pricePerUnit !== a.pricePerUnit) {
    return b.pricePerUnit - a.pricePerUnit;
  }
  return a.createdAt - b.createdAt;
});
```

For asks:

```ts
asks.sort((a, b) => {
  if (a.pricePerUnit !== b.pricePerUnit) {
    return a.pricePerUnit - b.pricePerUnit;
  }
  return a.createdAt - b.createdAt;
});
```

---

## 7.6 Matching Algorithm
When a new order arrives:

1. Validate the order.
2. Reserve required cash or inventory.
3. Try to match it against the opposite side of the book.
4. Execute trades while prices cross and quantity remains.
5. If the incoming order still has remaining quantity, leave it on the book.
6. If fully filled, mark it filled and do not add it to the book.

### Incoming Bid Matching
Incoming bid matches against best asks.

```ts
while (
  incomingBid.remainingQuantity > 0 &&
  bestAsk exists &&
  incomingBid.pricePerUnit >= bestAsk.pricePerUnit
) {
  tradePrice = bestAsk.pricePerUnit; // maker price
  tradeQuantity = Math.min(incomingBid.remainingQuantity, bestAsk.remainingQuantity);
  executeTrade(buyer = incomingBid.playerId, seller = bestAsk.playerId, tradePrice, tradeQuantity);
}
```

### Incoming Ask Matching
Incoming ask matches against best bids.

```ts
while (
  incomingAsk.remainingQuantity > 0 &&
  bestBid exists &&
  bestBid.pricePerUnit >= incomingAsk.pricePerUnit
) {
  tradePrice = bestBid.pricePerUnit; // maker price
  tradeQuantity = Math.min(incomingAsk.remainingQuantity, bestBid.remainingQuantity);
  executeTrade(buyer = bestBid.playerId, seller = incomingAsk.playerId, tradePrice, tradeQuantity);
}
```

---

## 7.7 Multiple Fills From One Incoming Order
An incoming order may match multiple resting orders.

Example:

Resting asks:

```text
Ask 1: sell 2 units at $5
Ask 2: sell 3 units at $6
Ask 3: sell 5 units at $8
```

Incoming bid:

```text
Buy 7 units at $7
```

Execution:

```text
Trade 1: buy 2 at $5
Trade 2: buy 3 at $6
Remaining bid quantity: 2
Ask 3 is at $8, but bid is only $7, so no match.
The remaining bid for 2 units at $7 stays on the book.
```

---

## 7.8 Self-Trade Rule
A player should not be able to trade with themselves.

If a player has both a bid and ask that would match, the backend should not execute a self-trade.

Recommended rule:

- Reject incoming orders that would immediately match against the same player’s opposite-side order.
- Or skip own orders during matching.

Simpler MVP rule:

```text
A player cannot post a bid and ask on the same food type at the same time.
```

Recommended MVP choice: **prevent self-trades by skipping own orders during matching**, but still allow players to have both bids and asks if needed.

---

## 8. Player Actions

## 8.1 Post Bid
A bid means:

> “I want to buy this quantity of this food type, and I am willing to pay up to this price per unit.”

### Input Fields

- food type
- quantity
- price per unit

### Validation

Backend must check:

- player is alive,
- game is active,
- food type is valid,
- quantity is integer >= 1,
- price is integer >= 0,
- player has enough available cash to reserve `quantity × price`,
- order does not violate rate limits.

### Result

- If matching asks exist, trade executes immediately.
- If partially filled, remaining bid stays on the book.
- If not filled, full bid stays on the book.

## 8.2 Post Ask
An ask means:

> “I want to sell this quantity of this food type, and I am willing to accept at least this price per unit.”

### Input Fields

- food type
- quantity
- price per unit

### Validation

Backend must check:

- player is alive,
- game is active,
- food type is valid,
- quantity is integer >= 1,
- price is integer >= 0,
- player has enough available inventory of that food type,
- order does not violate rate limits.

### Result

- If matching bids exist, trade executes immediately.
- If partially filled, remaining ask stays on the book.
- If not filled, full ask stays on the book.

## 8.3 Cancel Order
Players can cancel their own open orders.

### Input

- order id

### Validation

Backend must check:

- order exists,
- order belongs to player,
- order is open or partially filled,
- game is active.

### Result

- Order is marked cancelled.
- Remaining reserved cash or inventory is released.
- Order is removed from active book.

## 8.4 Cancel All Orders
Recommended quality-of-life action.

Players can cancel all their own open orders.

Useful when:

- player is about to starve,
- player wants to reclaim reserved food,
- player wants to reset strategy quickly.

---

## 9. Cash and Inventory Accounting

## 9.1 Player State

```ts
interface Player {
  id: string;
  socketId: string | null;
  name: string;
  isHost: boolean;
  status: "alive" | "dead" | "disconnected";
  produces: FoodType | null;
  cash: number;
  reservedCash: number;
  inventory: Inventory;
  reservedInventory: Inventory;
  diedAtSecond: number | null;
}
```

### 9.2 Available Cash

```ts
availableCash = cash - reservedCash;
```

### 9.3 Available Inventory

```ts
availableInventory[foodType] = inventory[foodType] - reservedInventory[foodType];
```

### 9.4 Bid Reservation
When posting a bid:

```ts
reservedCash += pricePerUnit * quantity;
```

When bid partially fills:

- Buyer pays actual trade price × trade quantity.
- The reserved cash for the filled part is released/adjusted.
- If the trade price is lower than the bid limit, the difference is returned to available cash.

Example:

Incoming bid:

```text
Buy 10 units at max $10
Reserved cash = $100
```

It fills 4 units at $7:

```text
Actual cost = $28
Unused reserved amount for filled quantity = 4 × ($10 - $7) = $12
Remaining reserved for open quantity = 6 × $10 = $60
Total cash decrease = $28
Remaining reserved cash = $60
```

### 9.5 Ask Reservation
When posting an ask:

```ts
reservedInventory[foodType] += quantity;
```

When ask partially fills:

- Seller loses sold food units.
- Seller receives cash.
- Reserved inventory decreases by filled quantity.
- Remaining ask quantity stays reserved.

---

## 10. Order Book State

## 10.1 Order Book Interface

```ts
interface OrderBook {
  foodType: FoodType;
  bids: Order[];
  asks: Order[];
}

interface GameRoom {
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
}
```

## 10.2 Trade Object

```ts
interface Trade {
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
```

## 10.3 Public Order Book View
Players should see public market depth.

Recommended public view:

```ts
interface PublicOrderBookLevel {
  pricePerUnit: number;
  totalQuantity: number;
}

interface PublicOrderBook {
  foodType: FoodType;
  bids: PublicOrderBookLevel[];
  asks: PublicOrderBookLevel[];
  lastTradePrice: number | null;
  lastTradeQuantity: number | null;
}
```

This shows aggregated market depth, not individual private details.

Example:

```text
Food B Order Book

Bids:
$12 × 5
$10 × 8
$7 × 3

Asks:
$15 × 4
$18 × 6
$25 × 2
```

### 10.4 Own Orders View
Each player can see their own individual open orders.

```ts
interface OwnOrderView {
  id: string;
  foodType: FoodType;
  side: OrderSide;
  pricePerUnit: number;
  originalQuantity: number;
  remainingQuantity: number;
  status: OrderStatus;
  createdAt: number;
}
```

---

## 11. Information Visibility Rules

## 11.1 Public Information
All players can see:

- player names,
- player produced food types,
- alive/dead status,
- game timer,
- public order book depth,
- last trade prices,
- recent trades,
- public event log,
- who died and when.

Recommended recent trade display:

```text
Alice bought 5 Fish from Ben at $12/unit.
```

This reveals buyer, seller, food type, quantity, and price.

## 11.2 Private Information
Each player can see only their own:

- exact inventory,
- available inventory,
- reserved inventory,
- cash,
- available cash,
- reserved cash,
- open orders,
- survival warning.

## 11.3 Hidden Information
Players cannot see:

- other players’ exact inventory,
- other players’ exact cash,
- other players’ reserved cash,
- other players’ reserved inventory,
- whether another player is about to starve.

## 11.4 Inference Is Intended
Players may infer hidden information from:

- high bids,
- desperate asks,
- sudden order cancellations,
- trade frequency,
- refusal to sell,
- public death events,
- production roles.

This is a core strategic feature.

---

## 12. Consumption System

## 12.1 Tick Frequency
Consumption happens once per second.

Do not run consumption every frame or every millisecond. The game should use discrete 1-second server ticks.

### Backend Timer
Recommended:

```ts
setInterval(() => gameTick(room), 1000);
```

For more accurate timing, calculate elapsed time from server timestamps rather than trusting the interval count.

## 12.2 Consumption Algorithm

```ts
function consumeFood(room: GameRoom) {
  for (const player of room.players) {
    if (player.status !== "alive") continue;

    const requiredFoods = FOOD_TYPES.filter(food => food !== player.produces);

    const missingFoods = requiredFoods.filter(food => {
      const available = player.inventory[food] - player.reservedInventory[food];
      return available < 1;
    });

    if (missingFoods.length > 0) {
      killPlayer(room, player, missingFoods);
      continue;
    }

    for (const food of requiredFoods) {
      player.inventory[food] -= 1;
    }
  }
}
```

## 12.3 Survival Warning
The frontend should show:

- current required foods,
- seconds remaining until starvation for each required food,
- whether any required food is reserved and therefore unavailable.

Example:

```text
Survival Status
Wheat: 12 available → 12 seconds left
Meat: 3 available → 3 seconds left
Fruit: 0 available → starving now
```

For the player’s own produced food:

```text
Fish: you produce this, not required for survival
```

## 12.4 Starvation Timing
If a player has 0 available units of a required food at the moment of a consumption tick, they die immediately during that tick.

They do not get a grace period.

---

## 13. Production System

## 13.1 Tick Frequency
Production happens once per second, before consumption.

## 13.2 Production Algorithm

```ts
function produceFood(room: GameRoom) {
  for (const player of room.players) {
    if (player.status !== "alive") continue;
    const food = player.produces;
    if (!food) continue;
    player.inventory[food] += 2;
  }
}
```

## 13.3 Production UI
The frontend does not need to show every production event in the log because that would create noise.

Instead, show production passively in the inventory panel.

Example:

```text
You produce: Fish
Production rate: +2 Fish/sec
```

---

## 14. Death Handling

## 14.1 When a Player Dies
When a player dies:

- status becomes `dead`,
- diedAtSecond is recorded,
- all open orders are cancelled,
- all reserved cash and inventory are released or removed,
- player can no longer post orders,
- player no longer produces,
- player no longer consumes,
- player becomes a spectator.

Recommended MVP:

- Dead players’ remaining food and cash are removed from active play.
- Their open orders are cancelled.
- Their inventory is not transferred to anyone.

## 14.2 Public Death Event
Public event log should show:

```text
Alice died at 01:42 because she ran out of Meat.
```

To preserve some hidden information, the exact missing foods may or may not be public.

Recommended MVP: show missing food type publicly, because it helps players understand what happened.

## 14.3 Death During Open Orders
If a player dies while they have open orders:

- cancel all their bids,
- cancel all their asks,
- remove them from all books,
- release reserved resources internally,
- then mark remaining inventory/cash as inactive.

---

## 15. Game End Logic

## 15.1 End Conditions
The game ends if:

```ts
elapsedSeconds >= 600
```

or:

```ts
livingPlayers.length <= 1
```

## 15.2 Winner Logic

```ts
function determineWinners(room: GameRoom) {
  const survivors = room.players.filter(p => p.status === "alive");

  if (survivors.length === 0) return [];

  if (survivors.length === 1) return [survivors[0]];

  const maxCash = Math.max(...survivors.map(p => p.cash));
  const cashLeaders = survivors.filter(p => p.cash === maxCash);

  if (cashLeaders.length === 1) return cashLeaders;

  const maxFood = Math.max(...cashLeaders.map(p => totalInventory(p.inventory)));
  return cashLeaders.filter(p => totalInventory(p.inventory) === maxFood);
}
```

## 15.3 Final Scoreboard
Show:

- winner,
- final cash,
- final inventory,
- alive/dead status,
- death time if dead,
- produced food type,
- total bought,
- total sold,
- profit from trades.

---

## 16. Lobby Flow

## 16.1 Create Room
A user can:

- enter display name,
- click Create Game,
- receive room code and invite link.

## 16.2 Join Room
A user can:

- enter display name,
- enter room code or open invite link,
- join if room has fewer than 4 players and game has not started.

## 16.3 Start Game
The host can start only if exactly 4 players are present.

On start:

1. Assign producer food types.
2. Create shuffled 400-unit deck.
3. Deal 100 units to each player.
4. Give each player 100 cash.
5. Initialize order books.
6. Start 600-second game timer.
7. Begin production/consumption ticks.

---

## 17. Frontend Requirements

## 17.1 Recommended Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Socket.IO client
- Vercel deployment

## 17.2 Main Pages

```text
/
/game/[roomCode]
```

## 17.3 Game Screen Layout
The game screen should have:

1. Top timer/status bar
2. Player status panel
3. Private inventory panel
4. Cash panel
5. Order entry form
6. Order book panel
7. Own open orders panel
8. Recent trades panel
9. Event log
10. Game over modal

---

## 17.4 Top Timer / Status Bar
Show:

```text
Time Left: 02:17
Status: Live
Alive Players: 4/4
```

Also show:

- server connection status,
- reconnecting indicator if needed.

---

## 17.5 Player Status Panel
Show public player info:

```text
Player   Produces   Status
Alice    Wheat      Alive
Ben      Fish       Alive
Cara     Meat       Dead at 01:42
David    Fruit      Alive
```

Do not show other players’ cash or inventory.

---

## 17.6 Private Inventory Panel
Show own inventory clearly.

Example:

```text
You produce: Fish (+2/sec)
You must eat: Wheat, Meat, Fruit (-1/sec each)

Food      Total   Reserved   Available   Survival Seconds
Wheat     20      0          20          20s
Fish      85      30         55          Not required
Meat      6       0          6           6s
Fruit     14      4          10          10s
```

Important: survival seconds should use available inventory, not total inventory.

---

## 17.7 Cash Panel
Show:

```text
Cash: $100
Reserved cash: $35
Available cash: $65
```

---

## 17.8 Order Entry Form
Players can create bids and asks.

Fields:

- side: Bid / Ask
- food type
- quantity
- price per unit
- submit button

### Bid UI Text

```text
Post Bid: buy [quantity] [food] at up to [$price] per unit
```

### Ask UI Text

```text
Post Ask: sell [quantity] [food] at at least [$price] per unit
```

### Validation Messages

Examples:

```text
You do not have enough available cash for this bid.
You do not have enough available Fish for this ask.
Quantity must be at least 1.
Price must be a whole number.
```

---

## 17.9 Order Book Panel
Show one tab per food type.

Each book should show:

- best bids,
- best asks,
- recent trade price,
- spread.

Example:

```text
Food: Wheat

Asks
Price   Quantity
$15     12
$14     4
$13     8

Bids
Price   Quantity
$10     6
$9      20
$7      5

Spread: $13 - $10 = $3
Last trade: 5 units at $12
```

Recommended display:

- asks sorted high to low visually, with lowest ask closest to center,
- bids sorted high to low, with highest bid closest to center.

---

## 17.10 Own Open Orders Panel
Show all own active orders.

Example:

```text
Your Open Orders

Side   Food   Qty Left   Price   Reserved   Action
Bid    Wheat  10         $8      $80        Cancel
Ask    Fish   20         $14     20 Fish    Cancel
```

Include:

- cancel button for each order,
- cancel all button.

---

## 17.11 Recent Trades Panel
Show public recent trades.

Example:

```text
02:13 — Alice bought 5 Wheat from David at $12/unit
02:11 — Cara bought 2 Fish from Ben at $15/unit
02:08 — David bought 10 Meat from Cara at $7/unit
```

---

## 17.12 Event Log
Use event log for major events only:

- game started,
- player died,
- large trade executed,
- game ended,
- player disconnected/reconnected.

Do not log every production or consumption tick.

---

## 18. Backend Requirements

## 18.1 Recommended Stack

- Node.js
- TypeScript
- Express
- Socket.IO
- Railway deployment

Optional:

- PostgreSQL for match history later.
- Redis for scaling later.

MVP:

- In-memory room state.
- No accounts.
- No persistent match history.

## 18.2 Backend Is Authoritative
The backend must control:

- room creation,
- player membership,
- producer assignment,
- food deck creation,
- initial dealing,
- production ticks,
- consumption ticks,
- death checks,
- order validation,
- order book matching,
- trade execution,
- timer,
- winner calculation.

The frontend must never directly change inventory, cash, or game status.

---

## 19. Socket Events

## 19.1 Client to Server

### `create_room`

```ts
{
  playerName: string;
}
```

### `join_room`

```ts
{
  roomCode: string;
  playerName: string;
}
```

### `start_game`

```ts
{
  roomCode: string;
  playerId: string;
}
```

### `post_order`

```ts
{
  roomCode: string;
  playerId: string;
  side: "bid" | "ask";
  foodType: FoodType;
  quantity: number;
  pricePerUnit: number;
}
```

### `cancel_order`

```ts
{
  roomCode: string;
  playerId: string;
  orderId: string;
}
```

### `cancel_all_orders`

```ts
{
  roomCode: string;
  playerId: string;
}
```

### `reconnect_player`

```ts
{
  roomCode: string;
  playerId: string;
}
```

---

## 19.2 Server to Client

### `room_update`
Public game state.

```ts
PublicGameState
```

### `private_update`
Player-specific private state.

```ts
PrivatePlayerState
```

### `order_book_update`
Public aggregated order book state.

```ts
Record<FoodType, PublicOrderBook>
```

### `own_orders_update`
Private own open orders.

```ts
OwnOrderView[]
```

### `trade_executed`
Public trade event.

```ts
{
  foodType: FoodType;
  buyerId: string;
  sellerId: string;
  pricePerUnit: number;
  quantity: number;
  totalPrice: number;
  timestamp: number;
}
```

### `player_died`

```ts
{
  playerId: string;
  diedAtSecond: number;
  missingFoods: FoodType[];
}
```

### `game_over`

```ts
{
  winnerIds: string[];
  reason: "time_limit" | "single_survivor" | "no_survivors";
  finalPlayers: FinalPlayerState[];
}
```

### `error_message`

```ts
{
  message: string;
  code: string;
}
```

---

## 20. Public and Private State Models

## 20.1 Public Game State

```ts
interface PublicGameState {
  roomCode: string;
  phase: GamePhase;
  elapsedSeconds: number;
  remainingSeconds: number;
  players: PublicPlayerState[];
  recentTrades: PublicTrade[];
  publicEventLog: GameEvent[];
}

interface PublicPlayerState {
  id: string;
  name: string;
  isHost: boolean;
  status: "alive" | "dead" | "disconnected";
  produces: FoodType | null;
  diedAtSecond: number | null;
}
```

## 20.2 Private Player State

```ts
interface PrivatePlayerState {
  playerId: string;
  cash: number;
  reservedCash: number;
  availableCash: number;
  inventory: Inventory;
  reservedInventory: Inventory;
  availableInventory: Inventory;
  produces: FoodType;
  requiredFoods: FoodType[];
  secondsUntilStarvation: Partial<Record<FoodType, number>>;
}
```

---

## 21. Core Algorithms

## 21.1 Create Starting Deck

```ts
function createInitialDeck(): FoodType[] {
  const deck: FoodType[] = [];

  for (const food of FOOD_TYPES) {
    for (let i = 0; i < 100; i++) {
      deck.push(food);
    }
  }

  return shuffle(deck);
}
```

## 21.2 Deal Initial Food

```ts
function dealInitialFood(players: Player[], deck: FoodType[]) {
  for (const player of players) {
    player.inventory = { A: 0, B: 0, C: 0, D: 0 };

    for (let i = 0; i < 100; i++) {
      const food = deck.pop();
      if (!food) throw new Error("Deck exhausted");
      player.inventory[food] += 1;
    }
  }
}
```

## 21.3 Game Tick

```ts
function gameTick(room: GameRoom) {
  if (room.phase !== "active") return;

  updateElapsedTime(room);

  if (room.elapsedSeconds >= room.maxSeconds) {
    endGame(room, "time_limit");
    return;
  }

  produceFood(room);
  consumeFood(room);
  cancelOrdersForDeadPlayers(room);
  emitAllState(room);

  const livingPlayers = room.players.filter(p => p.status === "alive");

  if (livingPlayers.length === 0) {
    endGame(room, "no_survivors");
  } else if (livingPlayers.length === 1) {
    endGame(room, "single_survivor");
  }
}
```

## 21.4 Post Order

```ts
function postOrder(room: GameRoom, input: PostOrderInput) {
  const player = getPlayer(room, input.playerId);

  validateOrder(room, player, input);

  const order = createOrder(input);

  reserveResources(player, order);

  matchIncomingOrder(room, order);

  if (order.remainingQuantity > 0) {
    addOrderToBook(room, order);
  } else {
    order.status = "filled";
  }

  emitAllState(room);
}
```

## 21.5 Match Incoming Order

```ts
function matchIncomingOrder(room: GameRoom, incoming: Order) {
  const book = room.orderBooks[incoming.foodType];

  if (incoming.side === "bid") {
    matchBidAgainstAsks(room, incoming, book);
  } else {
    matchAskAgainstBids(room, incoming, book);
  }
}
```

## 21.6 Execute Trade

```ts
function executeTrade(params: {
  room: GameRoom;
  buyerOrder: Order;
  sellerOrder: Order;
  makerOrder: Order;
  takerOrder: Order;
  quantity: number;
}) {
  const { room, buyerOrder, sellerOrder, makerOrder, takerOrder, quantity } = params;

  const buyer = getPlayer(room, buyerOrder.playerId);
  const seller = getPlayer(room, sellerOrder.playerId);

  const pricePerUnit = makerOrder.pricePerUnit;
  const totalPrice = pricePerUnit * quantity;

  buyer.cash -= totalPrice;
  seller.cash += totalPrice;

  seller.inventory[sellerOrder.foodType] -= quantity;
  buyer.inventory[buyerOrder.foodType] += quantity;

  buyerOrder.remainingQuantity -= quantity;
  sellerOrder.remainingQuantity -= quantity;

  updateReservationsAfterTrade(buyer, seller, buyerOrder, sellerOrder, quantity, pricePerUnit);

  if (buyerOrder.remainingQuantity === 0) buyerOrder.status = "filled";
  else buyerOrder.status = "partially_filled";

  if (sellerOrder.remainingQuantity === 0) sellerOrder.status = "filled";
  else sellerOrder.status = "partially_filled";

  room.trades.push({
    id: createId(),
    foodType: buyerOrder.foodType,
    buyerId: buyer.id,
    sellerId: seller.id,
    pricePerUnit,
    quantity,
    totalPrice,
    makerOrderId: makerOrder.id,
    takerOrderId: takerOrder.id,
    timestamp: Date.now(),
    elapsedSecond: room.elapsedSeconds,
  });
}
```

---

## 22. Validation Rules

## 22.1 General Order Validation
Reject order if:

- room does not exist,
- game is not active,
- player does not exist,
- player is not alive,
- food type is invalid,
- quantity is not an integer,
- quantity < 1,
- price is not an integer,
- price < 0.

## 22.2 Bid Validation
Reject bid if:

```ts
pricePerUnit * quantity > player.cash - player.reservedCash
```

## 22.3 Ask Validation
Reject ask if:

```ts
quantity > player.inventory[foodType] - player.reservedInventory[foodType]
```

## 22.4 Cancel Validation
Reject cancellation if:

- order does not exist,
- order does not belong to player,
- order is already filled,
- order is already cancelled.

## 22.5 Rate Limits
To prevent spam, add basic rate limits.

Recommended MVP:

- Max 10 new orders per player per second.
- Max 20 cancellations per player per second.
- Max 50 open orders per player.

If exceeded, reject with:

```text
Too many actions. Slow down.
```

---

## 23. Disconnection Handling

## 23.1 Lobby Disconnection
If a player disconnects in lobby:

- remove them from the room,
- free their slot,
- if host disconnects, assign host to next player,
- delete room if empty.

## 23.2 In-Game Disconnection
Recommended MVP:

- Mark player as `disconnected` but keep them alive for 15 seconds.
- Their production and consumption continue.
- Their open orders remain active.
- If they reconnect within 15 seconds, restore control.
- If not, mark them dead and cancel all orders.

Alternative stricter rule:

- Immediate death on disconnect.

Recommended: 15-second grace period.

## 23.3 Reconnection
Store in localStorage:

- roomCode,
- playerId,
- playerName.

On reload:

```ts
socket.emit("reconnect_player", { roomCode, playerId });
```

---

## 24. Deployment Plan

## 24.1 Frontend on Vercel
Environment variable:

```env
NEXT_PUBLIC_BACKEND_URL=https://your-railway-backend-url
```

Socket connection:

```ts
const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL);
```

## 24.2 Backend on Railway
Environment variables:

```env
PORT=3001
FRONTEND_URL=https://your-vercel-app.vercel.app
NODE_ENV=production
```

CORS setup:

```ts
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});
```

## 24.3 Health Check
Backend should expose:

```text
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

---

## 25. Recommended Project Structure

## 25.1 Frontend

```text
frontend/
  app/
    page.tsx
    game/
      [roomCode]/
        page.tsx
  components/
    Lobby.tsx
    GameBoard.tsx
    TimerBar.tsx
    PlayerPanel.tsx
    InventoryPanel.tsx
    CashPanel.tsx
    OrderEntry.tsx
    OrderBook.tsx
    OwnOrders.tsx
    RecentTrades.tsx
    EventLog.tsx
    GameOverModal.tsx
  hooks/
    useSocket.ts
    useGameState.ts
  lib/
    socket.ts
    types.ts
    food.ts
```

## 25.2 Backend

```text
backend/
  src/
    index.ts
    socket.ts
    rooms.ts
    game/
      setup.ts
      tick.ts
      production.ts
      consumption.ts
      death.ts
      winner.ts
    market/
      orderTypes.ts
      orderBook.ts
      matching.ts
      validation.ts
      reservations.ts
    visibility/
      publicState.ts
      privateState.ts
    utils/
      ids.ts
      shuffle.ts
      roomCode.ts
      time.ts
```

---

## 26. MVP Feature Set

## 26.1 Must Have

- Create room
- Join room
- 4-player lobby
- Host starts game
- Random producer assignment
- Fixed shuffled deck with 100 of each food type
- 100 starting food units per player
- 100 starting cash per player
- 10-minute match timer
- Server-side production every 10 seconds
- Server-side consumption every 10 seconds
- Death by starvation
- Private inventory
- Private cash
- Public order books
- Post bid
- Post ask
- Cancel order
- Partial fills
- Maker-price execution
- Price-time priority
- Reserved cash
- Reserved inventory
- Public trade feed
- Game-over logic
- Final scoreboard

## 26.2 Should Have

- Cancel all orders button
- Survival countdown by food type
- Public recent trade history
- Clear insufficient cash/food errors
- Reconnect support
- Mobile-responsive UI

## 26.3 Nice to Have

- Graph of last trade prices
- Volume chart per food
- Bot players
- Simulation mode
- Match replay
- Persistent match history
- Player accounts
- Custom game parameters
- Randomized food names
- Spectator-only links

---

## 27. Non-Goals for MVP

Do not implement in MVP:

- emergency market,
- loans or debt,
- negative cash,
- more than 4 players,
- fewer than 4 players,
- final food liquidation value,
- decimal prices,
- decimal food units,
- private chat,
- voice chat,
- complex contracts,
- short-selling food,
- margin trading,
- automatic market maker,
- persistent economy across games.

---

## 28. Testing Plan

## 28.1 Unit Tests
Test:

- deck has exactly 400 units,
- deck has exactly 100 of each food type,
- each player receives exactly 100 food units,
- each player gets unique produced food type,
- production adds 2 own food per cycle,
- consumption removes 1 of each non-produced food,
- producer does not consume own food,
- player dies if missing required food,
- player does not die if missing own produced food,
- bid validation rejects insufficient cash,
- ask validation rejects insufficient inventory,
- matching executes when bid >= ask,
- matching does not execute when bid < ask,
- maker price is used,
- partial fills work,
- residual order remains on book,
- filled order is removed,
- cancelled order releases reserves,
- dead player’s orders are cancelled.

## 28.2 Integration Tests
Test full scenarios:

1. Four players start a match.
2. Players produce and consume for 10 seconds.
3. A bid and ask match immediately.
4. A large incoming order fills against multiple resting orders.
5. A resting order is partially filled and remains open.
6. A player cancels an order before consumption and survives.
7. A player reserves too much food in asks and starves.
8. A player dies and all their orders disappear.
9. Game ends when only one survivor remains.
10. Game ends at 600 seconds.
11. Game ends with no survivors.

## 28.3 Manual Playtest Questions
During playtesting, observe:

- Do players understand available vs reserved food?
- Do players understand that reserved food cannot be eaten?
- Does the order book feel intuitive?
- Is 10 minutes too long or too short?
- Are players dying too quickly?
- Is production too low compared to consumption?
- Are prices meaningful?
- Is cash too abundant or too scarce?
- Do players use limit orders strategically?
- Is private inventory fun or confusing?
- Does the game need a tutorial?

---

## 29. Config File

Put all major parameters in one shared config file.

```ts
export const GAME_CONFIG = {
  PLAYER_COUNT: 4,
  FOOD_TYPES: ["A", "B", "C", "D"] as const,
  INITIAL_CASH: 100,
  INITIAL_UNITS_PER_FOOD_TYPE: 100,
  INITIAL_UNITS_PER_PLAYER: 100,
  MIN_INITIAL_UNITS_PER_FOOD_PER_PLAYER: 20,
  GAME_DURATION_SECONDS: 600,
  PRODUCTION_PER_SECOND: 2,
  CONSUMPTION_PER_REQUIRED_FOOD_PER_SECOND: 1,
  CONSUMPTION_INTERVAL_SECONDS: 10,
  MIN_PRICE: 0,
  MIN_ORDER_QUANTITY: 1,
  MAX_OPEN_ORDERS_PER_PLAYER: 50,
  MAX_NEW_ORDERS_PER_PLAYER_PER_SECOND: 10,
  MAX_CANCELS_PER_PLAYER_PER_SECOND: 20,
  DISCONNECT_GRACE_SECONDS: 15,
};
```

---

## 30. Player-Facing Rule Text

This is the simple explanation shown inside the game.

> There are 4 players and 4 food types. Each player produces one unique food type. You do not need to eat the food you produce, but every 10 seconds you must eat 1 unit of each of the other 3 food types.
>
> At the start, each player gets 100 cash and 100 food units from a shuffled deck containing exactly 100 units of each food type. Everyone is guaranteed at least 20 of each food, and the rest is random.
>
> Every 10 seconds, each living player produces 2 units of their own food type and consumes 1 unit of each required food type. If you cannot eat one of your required foods, you die.
>
> You can trade at any time using the order book. Post bids to buy food, post asks to sell food, or cancel your open orders. Orders can be partially filled. If prices match, trades happen automatically. The trade price is the price of the order that was already resting on the book.
>
> The game lasts 10 minutes. If multiple players survive, the surviving player with the most cash wins. Leftover food has no cash value.

---

## 31. Success Criteria

The MVP is successful if:

- 4 players can complete a full real-time game online.
- The server correctly handles production and consumption every 10 seconds.
- The order book correctly supports bids, asks, cancellation, partial fills, and maker-price execution.
- Players understand why they died when they die.
- Private inventory and private cash remain hidden.
- The market produces meaningful prices.
- The game feels tense but not random-broken.
- The winner is calculated correctly.
- The app runs reliably with frontend on Vercel and backend on Railway.
