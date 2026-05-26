# Greedy Bot

This document explains the current research `greedy` bot in plain English.

It is a one-step trading bot. On each tick, it builds rough estimates of the other players, converts visible market quotes into a shared dollar scale, scores the best buy it could make, scores the best sell it could make, and chooses the more profitable one. If neither looks profitable, it usually keeps or refreshes its sell order.

The bot only uses its own private observation plus public quotes and public trades. It never reads hidden simulator state directly.

## What state it tracks

For each opponent, the bot keeps an internal estimate with:

- estimated cash
- estimated inventory for all four foods
- which food they produce
- whether they are alive

At the start of a game, every opponent is initialized as:

- `cash = initial cash`
- `inventory[food] = expected starting amount of that food`

In the default setup, that means each food starts at the expected split of the 100 starting food units a player receives.

## How opponent estimates are updated

Each tick, before choosing an action, the bot advances those estimates using only public information.

### Tick-based inventory drift

If an opponent is estimated to have been alive over the elapsed ticks:

- their produced food goes up by production each tick
- every non-produced food goes down by consumption each tick

If they died, the bot only advances them through the ticks before death.

### Public-trade updates

The bot also looks at public trades from the previous tick and adjusts estimates:

- buyer cash decreases by `price * quantity`
- seller cash increases by `price * quantity`
- buyer inventory for the traded food increases by `quantity`
- seller inventory for the traded food decreases by `quantity`

It deduplicates trades so the same public trade is not applied twice.

## Normalized food values

The bot uses a simple scarcity score for food:

`normalized_value(units) = 1 / (units + 0.2)`

Interpretation:

- if we have less of a food, we care more about getting more of it
- if someone else has less of a food, we care more about the fact that they are short on it

That second interpretation matters for selling. The opponent-side normalized value is not “how much they care” in an abstract sense. It is specifically our estimate of how much we care that they have that food shortage, because that shortage may let us charge more.

## Softer opponent value for selling

When the bot estimates how much another player might still pay for our produced food, it uses a softer version:

`opponent_normalized_value(units) = min(1 / (units + 0.2), 0.2)`

This caps the opponent-side scarcity effect. In other words, the sell floor still responds to an opponent being short, but not as aggressively as our own buy urgency does.

## Market anchor

The bot converts normalized values into dollar-like values with one shared market anchor per tick.

For every visible public bid and ask in the order books:

- identify who placed the quote
- look up that player’s estimated inventory for the quoted food
- compute that player’s normalized value for that food
- compute `quote_price / normalized_value`

The market anchor is the average of all those ratios.

Important detail:

- the anchor is quote-owner based
- if player 2 posts a quote, the bot uses player 2’s estimated scarcity for that food, not ours

If there are no usable public quotes, the bot falls back to a default anchor.

## How buying works

The bot only considers foods it must consume.

For each required food, it scans every visible ask order.

For a specific ask:

- take that ask’s quoted price
- convert it into normalized-price space with `ask_price / market_anchor`
- walk quantity upward one unit at a time
- accumulate integrated value as if each extra unit were worth `normalized_value(current_units)`
- whenever the running quantity crosses a legal quantity bucket, snapshot the accumulated value
- stop once the normalized value falls below the ask’s normalized price

After that:

- use the last quantity bucket crossed before the stop
- convert the integrated normalized value back to dollars by multiplying by the market anchor
- subtract purchase cost
- that gives the buy profit score for that ask

The bot compares all such buy candidates and keeps the one with the highest profit.

## How selling works

The bot only sells the food it produces.

It caps sell size at:

- the amount of produced food currently available
- `MAX_SELL_QUANTITY = 4`

### Sell price floor

To decide the ask price it wants, the bot looks at every alive opponent.

For each opponent:

- if they produce our food, their opponent value for our food is treated as zero
- otherwise compute:
  `opponent_normalized_value(their_estimated_units_of_our_food) * market_anchor`
- cap that by their estimated cash with:
  `min(opponent_value, opponent_cash)`

The sell target price is the maximum of those opponent-specific values.

That price is then snapped to the nearest legal price bucket and used as the bot’s standing ask price.

### Choosing sell quantity

Once the price bucket is fixed, the bot looks through visible bids on its produced food.

For each bid:

- use the bidder’s offered quantity, capped by our max sell quantity
- snap that quantity down to a legal quantity bucket
- compute profit as:
  `profit = (bid_price - ask_price) * quantity`

The bot picks the bid/quantity pair with the largest profit under that scoring rule.

If no bid gives positive edge, the sell candidate still exists as a standing ask at the chosen price.

## Final action choice

Each tick the bot computes:

- best buy candidate and its profit
- best sell candidate and its profit

Then it acts as follows:

1. If either side has positive profit:
   choose the higher-profit action.
2. Otherwise, if there is a sell candidate:
   compare it with our current open asks.
3. If an existing ask on our produced food has drifted by more than 2 price units from the sell price we would want now:
   `cancel_all`.
4. Otherwise:
   place or keep the current sell candidate.
5. If no sell candidate exists:
   `noop`.

## What this bot is trying to be

This bot is not trying to be game-theoretically optimal. It is a compact greedy policy with three main ideas:

- estimate who is likely short on what
- use public quotes to build a shared dollar scale
- make the single best-looking trade right now

That makes it easy to inspect and fast to simulate, while still being much more stateful than the older panic-threshold bot.
