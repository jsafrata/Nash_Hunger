# Value-Based Greedy Bot

The research `greedy` bot values food from its inventory vector, rescales those values into market dollars, estimates coarse opponent state, and buys only when the visible market is offering a discount.

## Normalized value

Let:

- `I_f` = available units of food `f`
- `required` = foods the bot must consume
- `produces` = the food the bot produces

The produced food has zero normalized value for its holder:

`value_produces_normalized = 0`

For the other three foods, use a softmin over their inventories. Let

- `R` = the required foods
- `m = min(I_r for r in R)`
- `tau = 6`

For each required food `r`:

`w_r = exp(-(I_r - m) / tau)`

`value_r_normalized = w_r / sum(w_k for k in R)`

So scarcer required foods get higher normalized value, the three required-food values sum to `1`, and the produced food gets `0`.

## Market rescaling

Use separate market-wide anchors for buying and selling.

- for each food with positive normalized value:
  use the visible best ask for the buy anchor, or the visible best bid for the sell anchor
- if that side quote is missing for a food, fall back to that food's last trade price
- for each such food, compute `real_value_f / value_f_normalized`
- the anchor is the average of those per-food ratios
- if no usable public prices exist, fall back to a default anchor

Buy values are unnormalized with the buy anchor:

`value_f_dollars_buy = value_f_normalized * buy_anchor`

Sell values are unnormalized with the sell anchor:

`value_f_dollars_sell = value_f_normalized * sell_anchor`

## Opponent estimates

For each opponent, track:

- estimated cash
- estimated inventory of the food they produce

Updates use public information only:

- produced-food inventory increases while the opponent is alive
- cash changes from public trades
- produced-food inventory changes when the opponent trades their own produced food

For foods an opponent does not produce, use a simple decaying baseline estimate from the known consumption rate.

## Sell rule

For the food the bot produces, compute each alive opponent's willingness to pay:

`willingness(opponent, food) = min(opponent_estimated_cash, opponent_value_dollars_sell(food))`

The sell floor is the maximum willingness across alive opponents. The bot sells all produced-food surplus above a one-unit self-reserve.

## Buy rule

For each required food:

- compute `value_f_dollars_buy`
- if `best_ask > value_f_dollars_buy`, do not buy
- if `best_ask <= value_f_dollars_buy`, bid at `best_ask`
- size the buy from the normalized value directly:
  `budget_f = available_cash * value_f_normalized`
  then buy up to the largest legal quantity supported by that budget, current cash, and visible ask size

Among legal buys, choose the one with the largest:

`underpricing_f = value_f_dollars_buy - best_ask_f`

Tie-breaker: scarcer required food wins.

The bot does not place speculative passive bids for required food.

## Action priority

1. highest-ranked legal buy for a required food
2. otherwise a legal sell of produced surplus
3. otherwise `noop`

## Limitations

- Opponent estimates are intentionally coarse.
- The policy is one-step greedy, not lookahead planning.
- Currency values are constrained by the discrete action buckets.
