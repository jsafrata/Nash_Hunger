"use client";

import Link from "next/link";
import { useState } from "react";
import { tutorialContent } from "./content";

type MobileHighlightKey =
  | "time"
  | "cash"
  | "food"
  | "players"
  | "prices"
  | "scroll"
  | "buy"
  | "ask"
  | null;

type DesktopHighlightKey =
  | "time"
  | "cash"
  | "food"
  | "players"
  | "prices"
  | "scroll"
  | "buy"
  | "ask"
  | "open-orders"
  | "trade-history"
  | "event-log"
  | null;

function highlightClass(active: boolean) {
  return active
    ? "border-accent bg-accent/30 shadow-[0_0_0_1px_rgba(255,208,94,0.4),0_0_28px_rgba(255,208,94,0.2),0_14px_34px_rgba(212,167,98,0.22)]"
    : "";
}

function AnnotationLabel({
  text,
  className,
  emphasized = false,
  interactive = false,
  onHoverChange,
}: {
  text: string;
  className?: string;
  emphasized?: boolean;
  interactive?: boolean;
  onHoverChange?: (hovered: boolean) => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      onFocus={() => onHoverChange?.(true)}
      onBlur={() => onHoverChange?.(false)}
      className={`rounded-full border px-5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] shadow-[0_6px_18px_rgba(0,0,0,0.28)] transition sm:text-xs ${
        emphasized
          ? "border-accent bg-accent/15 text-accent"
          : "border-accent/35 bg-[#101722] text-text"
      } ${
        interactive
          ? "cursor-pointer ring-1 ring-accent/20 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/16 hover:text-accent hover:shadow-[0_10px_22px_rgba(212,167,98,0.2)] focus-visible:-translate-y-0.5 focus-visible:border-accent focus-visible:bg-accent/16 focus-visible:text-accent focus-visible:shadow-[0_10px_22px_rgba(212,167,98,0.2)]"
          : "cursor-default"
      } ${className ?? ""}`}
    >
      {text}
    </button>
  );
}

function AnnotationHotspot({
  text,
  labelClassName,
  emphasized = false,
  interactive = true,
  onHoverChange,
}: {
  text: string;
  labelClassName: string;
  emphasized?: boolean;
  interactive?: boolean;
  onHoverChange?: (hovered: boolean) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className={`pointer-events-auto absolute ${labelClassName}`}>
        <div className="-m-4 p-4">
          <AnnotationLabel
            text={text}
            emphasized={emphasized}
            interactive={interactive}
            onHoverChange={onHoverChange}
          />
        </div>
      </div>
    </div>
  );
}

function MobileButtonMock({
  label,
  side,
  highlightStepper = false,
}: {
  label: string;
  side: "buy" | "ask";
  highlightStepper?: boolean;
}) {
  const isBuy = side === "buy";
  return (
    <div
      className={`flex overflow-hidden rounded-xl border ${
        isBuy
          ? "border-bid/45 bg-[#122238]"
          : "border-ask/45 bg-[#2a1a14]"
      }`}
    >
      <div
        className={`flex flex-1 items-center justify-center px-2 py-2 text-[10px] font-bold ${
          isBuy ? "text-[#9ac7ff]" : "text-[#ffb596]"
        }`}
      >
        {label}
      </div>
      <div
        className={`flex w-11 flex-col items-center justify-center border-l border-white/10 bg-black/15 transition ${
          highlightStepper
            ? "bg-accent/28 text-accent shadow-[inset_0_0_0_1px_rgba(255,208,94,0.4)]"
            : ""
        }`}
      >
        <span className={`text-[8px] ${highlightStepper ? "text-accent" : "text-muted"}`}>▲</span>
        <span
          className={`mono text-sm font-bold ${highlightStepper ? "text-accent" : "text-text"}`}
        >
          $5
        </span>
        <span className={`text-[8px] ${highlightStepper ? "text-accent" : "text-muted"}`}>▼</span>
      </div>
    </div>
  );
}

function DesktopPillMock({
  label,
  light = true,
}: {
  label: string;
  light?: boolean;
}) {
  return (
    <div
      className={`rounded-full px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
        light ? "bg-[#e8eaf0] text-[#0a0c11]" : "bg-[#0d1219] text-text"
      }`}
    >
      {label}
    </div>
  );
}

function MobilePhoneShell({ activeKey }: { activeKey: MobileHighlightKey }) {
  const foods = [
    { emoji: "🌾", count: "4" },
    { emoji: "🥬", count: "2" },
    { emoji: "🥩", count: "1" },
    { emoji: "🍞", count: "3" },
  ];

  return (
    <div className="rounded-[28px] border border-line bg-[#05070b] p-3 shadow-[0_18px_35px_rgba(0,0,0,0.35)]">
      <div className="rounded-[22px] border border-line/80 bg-[#0f141d] p-2">
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-line/70 bg-[#141b26] p-2">
            <div
              className={`rounded-lg border border-transparent bg-[#0d1219] px-2 py-1.5 transition ${highlightClass(activeKey === "time")}`}
            >
              <div className="text-[9px] uppercase tracking-[0.08em] text-muted">
                Time
              </div>
              <div className="text-base font-bold text-text">1:42</div>
            </div>
            <div
              className={`rounded-lg border border-transparent bg-[#0d1219] px-2 py-1.5 transition ${highlightClass(activeKey === "cash")}`}
            >
              <div className="text-[9px] uppercase tracking-[0.08em] text-muted">
                Cash
              </div>
              <div className="text-base font-bold text-accent">$18</div>
            </div>
          </div>

          <div
            className={`grid grid-cols-4 gap-1 rounded-xl border border-line/70 bg-[#141b26] p-2 transition ${highlightClass(activeKey === "food")}`}
          >
            {foods.map((food, index) => (
              <div
                key={food.emoji}
                className={`rounded-lg px-1.5 py-2 text-center ${
                  index === 0
                    ? "border border-accent/40 bg-accent/10"
                    : "bg-[#0d1219]"
                }`}
              >
                <div className="text-sm">{food.emoji}</div>
                <div className="text-sm font-bold text-text">{food.count}</div>
              </div>
            ))}
          </div>

          <div
            className={`grid grid-cols-4 gap-1 rounded-xl border border-line/70 bg-[#141b26] p-2 transition ${highlightClass(activeKey === "players")}`}
          >
            {["You", "Ana", "Bot", "Kai"].map((name, index) => (
              <div
                key={name}
                className={`rounded-lg px-1 py-1.5 text-center ${
                  index === 0 ? "bg-accent/10" : "bg-[#0d1219]"
                }`}
              >
                <div className="truncate text-[9px] font-semibold text-text">
                  {name}
                </div>
                <div className="text-[8px] uppercase tracking-[0.06em] text-muted">
                  {index === 2 ? "bot" : "alive"}
                </div>
              </div>
            ))}
          </div>

          <div
            className={`rounded-xl border border-line/70 bg-[#141b26] p-2 transition ${highlightClass(activeKey === "prices")}`}
          >
            <div className="grid grid-cols-4 gap-1 border-b border-line/70 pb-1 text-[8px] uppercase tracking-[0.08em] text-muted">
              <div>Food</div>
              <div>Bid</div>
              <div>Ask</div>
              <div>Last</div>
            </div>
            {[
              ["🌾", "5", "7", "6"],
              ["🥬", "4", "6", "5"],
              ["🥩", "8", "10", "9"],
              ["🍞", "3", "4", "4"],
            ].map((row) => (
              <div
                key={row[0]}
                className="grid grid-cols-4 gap-1 py-1 text-[10px] text-text"
              >
                {row.map((cell) => (
                  <div
                    key={cell}
                    className="rounded bg-[#0d1219] px-1.5 py-1 text-center"
                  >
                    {cell}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            {["🌾", "🥬", "🥩", "🍞"].map((food) => (
              <div key={food} className="grid grid-cols-2 gap-1.5">
                <div className={activeKey === "buy" ? highlightClass(true) : ""}>
                  <MobileButtonMock
                    label={`BUY ${food}`}
                    side="buy"
                    highlightStepper={activeKey === "scroll"}
                  />
                </div>
                <div
                  className={activeKey === "ask" ? highlightClass(true) : ""}
                >
                  <MobileButtonMock
                    label={`ASK ${food}`}
                    side="ask"
                    highlightStepper={activeKey === "scroll"}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopScreenShell({ activeKey }: { activeKey: DesktopHighlightKey }) {
  const marketRows = [
    { food: "🌾 Grain", bid: "$5", last: "$6", ask: "$7", hotkey: "[g]" },
    { food: "🥬 Veggie", bid: "$4", last: "$5", ask: "$6", hotkey: "[v]" },
    { food: "🥩 Meat", bid: "$8", last: "$9", ask: "$10", hotkey: "[m]" },
    { food: "🥛 Milk", bid: "$3", last: "$4", ask: "$5", hotkey: "[k]" },
  ];
  const opponents = ["Ana +Grain", "Bot +Veggie", "Kai -Meat"];
  const desktopPanels = [
    {
      title: "Open orders",
      items: ["Bid Meat @ $8", "Ask Grain @ $7", "Bid Bread @ $4"],
    },
    {
      title: "Trade history",
      items: ["Ana bought Greens @ $6", "Bot sold Grain @ $7", "Rin bought Meat @ $9"],
    },
    {
      title: "Event log",
      items: ["Round 3 started", "Kai died from hunger", "1:04 remaining"],
    },
  ];

  return (
    <div className="overflow-hidden rounded-[28px] border border-line bg-[#070a10] p-4 shadow-[0_18px_35px_rgba(0,0,0,0.35)]">
      <div className="space-y-3">
        <div className="card px-5 py-3">
          <div className="flex items-center gap-4">
            <div className="text-base font-bold tracking-tight text-accent">
              Nash Hunger
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] uppercase tracking-[0.08em] text-muted">
                Room
              </span>
              <span className="mono text-lg font-bold text-accent">ABCDE</span>
            </div>
            <div
              className={`flex items-baseline gap-2 rounded-lg px-2 py-1 transition ${highlightClass(
                activeKey === "time",
              )}`}
            >
              <span className="text-[11px] uppercase tracking-[0.08em] text-muted">
                Time
              </span>
              <span className="mono text-2xl font-bold text-text">8:24</span>
            </div>
            <div
              className={`flex items-baseline gap-2 rounded-lg px-2 py-1 transition ${highlightClass(
                activeKey === "players",
              )}`}
            >
              <span className="text-[11px] uppercase tracking-[0.08em] text-muted">
                Alive
              </span>
              <span className="mono text-lg font-bold text-text">3/4</span>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted">
              <span className="inline-block h-2 w-2 rounded-full bg-bid" />
              connected
            </div>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full w-[84%] bg-accent" />
          </div>
        </div>

        <div className="card flex items-center gap-6 px-4 py-3">
          <div className="min-w-[100px] font-semibold text-accent">You</div>
          <div
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-1 transition ${highlightClass(
              activeKey === "food",
            )}`}
          >
            {["🌾 24", "🥬 18", "🥩 12", "🥛 9"].map((item, index) => (
              <div
                key={item}
                className={`rounded-md border ${
                  index === 0
                    ? "border-accent bg-accent/15 px-3.5 py-1.5 shadow-lg"
                    : "border-line bg-[#121925] px-2.5 py-1"
                }`}
              >
                <span className="text-sm font-bold text-text">{item}</span>
              </div>
            ))}
          </div>
          <div
            className={`min-w-[100px] rounded-lg px-2 py-1 text-right transition ${highlightClass(
              activeKey === "cash",
            )}`}
          >
            <div className="mono text-2xl font-bold text-accent">$100</div>
            <div className="mono text-[10px] text-muted">$84 avail</div>
          </div>
        </div>

        <div
          className={`card flex items-center gap-2 px-3 py-2 transition ${highlightClass(
            activeKey === "players",
          )}`}
        >
          {opponents.map((item) => (
            <div
              key={item}
              className="flex-1 rounded-md border border-line bg-[#121925] px-3 py-2 text-sm text-text"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-8 space-y-3">
            <div className="space-y-1.5">
              {marketRows.map((row) => (
                <div
                  key={row.food}
                  className="rounded-md border border-line/70 bg-[#121925]"
                >
                  <div className="flex items-center gap-3 px-3 py-2">
                    <div className="flex flex-col items-start gap-1">
                      <div
                        className={`mono w-16 rounded-md px-1 py-0.5 text-center text-2xl font-bold leading-none text-bid transition ${highlightClass(
                          activeKey === "prices",
                        )}`}
                      >
                        {row.bid}
                      </div>
                      <div className="flex items-center gap-1">
                        <div
                          className={`transition ${highlightClass(
                            activeKey === "ask",
                          )}`}
                        >
                          <DesktopPillMock label="ASK" />
                        </div>
                        <div
                          className={`transition ${highlightClass(
                            activeKey === "buy",
                          )}`}
                        >
                          <DesktopPillMock label="BUY" />
                        </div>
                        <div
                          className={`flex items-stretch gap-0.5 rounded-md transition ${highlightClass(
                            activeKey === "scroll",
                          )}`}
                        >
                          <div className="w-6 rounded border border-line bg-bg/40 text-center text-xs leading-7 text-muted">
                            ▼
                          </div>
                          <div className="mono w-11 rounded border border-line bg-[#0a0c11] px-1 py-1 text-center text-xs text-text">
                            5
                          </div>
                          <div className="w-6 rounded border border-line bg-bg/40 text-center text-xs leading-7 text-muted">
                            ▲
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-1 items-center justify-center gap-2">
                      <span className="text-2xl leading-none">
                        {row.food.split(" ")[0]}
                      </span>
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-bold leading-tight text-text">
                          {row.food.split(" ").slice(1).join(" ")}
                        </span>
                        <span className="text-[10px] text-muted mono leading-tight">
                          last <span className="text-accent">{row.last}</span>
                        </span>
                      </div>
                      <span className="mono text-[10px] text-muted">
                        {row.hotkey}
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div
                        className={`mono w-16 rounded-md px-1 py-0.5 text-center text-2xl font-bold leading-none text-ask transition ${highlightClass(
                          activeKey === "prices",
                        )}`}
                      >
                        {row.ask}
                      </div>
                      <div className="flex items-center gap-1">
                        <div
                          className={`flex items-stretch gap-0.5 rounded-md transition ${highlightClass(
                            activeKey === "scroll",
                          )}`}
                        >
                          <div className="w-6 rounded border border-line bg-bg/40 text-center text-xs leading-7 text-muted">
                            ▼
                          </div>
                          <div className="mono w-11 rounded border border-line bg-[#0a0c11] px-1 py-1 text-center text-xs text-text">
                            7
                          </div>
                          <div className="w-6 rounded border border-line bg-bg/40 text-center text-xs leading-7 text-muted">
                            ▲
                          </div>
                        </div>
                        <div
                          className={`transition ${highlightClass(
                            activeKey === "ask",
                          )}`}
                        >
                          <DesktopPillMock label="ASK" />
                        </div>
                        <div
                          className={`transition ${highlightClass(
                            activeKey === "buy",
                          )}`}
                        >
                          <DesktopPillMock label="BUY" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              className={`card p-4 transition ${highlightClass(
                activeKey === "open-orders",
              )}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="section-title">Your open orders</div>
                <div className="text-xs text-muted">Cancel all</div>
              </div>
              <div className="space-y-1">
                {["BID Meat 1 @ $8", "ASK Grain 2 @ $7", "BID Milk 1 @ $4"].map(
                  (item) => (
                    <div
                      key={item}
                      className="rounded-md border border-line px-2 py-1.5 text-sm text-text"
                    >
                      {item}
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="col-span-4 space-y-3">
            <div
              className={`card p-3 transition ${highlightClass(
                activeKey === "trade-history",
              )}`}
            >
              <div className="section-title mb-2">Trade history</div>
              <div className="space-y-1 text-xs text-text">
                {desktopPanels[1].items.map((item) => (
                  <div
                    key={item}
                    className="rounded-md border border-line/40 px-2 py-1.5"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`card p-4 transition ${highlightClass(
                activeKey === "event-log",
              )}`}
            >
              <div className="section-title mb-3">Event log</div>
              <div className="space-y-1.5 text-xs">
                {desktopPanels[2].items.map((item, index) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="mono w-10 shrink-0 text-muted">
                      0{index}:04
                    </span>
                    <span
                      className={
                        index === 1
                          ? "text-danger"
                          : index === 0
                            ? "text-bid"
                            : "text-text"
                      }
                    >
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CombinedLayouts({
  guideItems,
  desktopFeatures,
}: {
  guideItems: { label: string; description: string }[];
  desktopFeatures: { label: string; description: string }[];
}) {
  const [mobileActive, setMobileActive] = useState<MobileHighlightKey>(null);
  const [desktopActive, setDesktopActive] = useState<DesktopHighlightKey>(null);
  const mobileLabels = [
    { label: "Time", key: "time" as const },
    { label: "Cash", key: "cash" as const },
    { label: "Your food", key: "food" as const },
    { label: "Players", key: "players" as const },
    { label: "Prices", key: "prices" as const },
    { label: "Buy", key: "buy" as const },
    { label: "Ask", key: "ask" as const },
    { label: "Scroll wheel", key: "scroll" as const },
  ];

  const desktopLabels = [
    { label: "Time", key: "time" as const },
    { label: "Cash", key: "cash" as const },
    { label: "Your food", key: "food" as const },
    { label: "Players", key: "players" as const },
    { label: "Best prices", key: "prices" as const },
    { label: "Scroll wheel", key: "scroll" as const },
    { label: "Buy", key: "buy" as const },
    { label: "Ask", key: "ask" as const },
    { label: "Open orders", key: "open-orders" as const },
    { label: "Trade history", key: "trade-history" as const },
    { label: "Event log", key: "event-log" as const },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-8">
        <div className="rounded-xl border border-line bg-[#0d1219] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-accent">
                Mobile layout
              </div>
              <div className="rounded-full border border-accent/30 bg-[#101722] px-3 py-1 text-[11px] font-semibold tracking-[0.04em] text-accent shadow-[0_6px_18px_rgba(0,0,0,0.22)]">
                Hover the labels
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:hidden">
            {mobileLabels.map((item) => (
              <AnnotationLabel
                key={item.label}
                text={item.label}
                interactive
                onHoverChange={(hovered) =>
                  setMobileActive(hovered ? item.key : null)
                }
              />
            ))}
          </div>

          <div className="relative mx-auto mt-8 hidden h-[660px] w-full max-w-[920px] md:block">
            <div className="absolute left-1/2 top-6 w-[340px] -translate-x-1/2">
              <div className="relative z-10">
                <MobilePhoneShell activeKey={mobileActive} />
              </div>
            </div>

            <AnnotationHotspot
              text="Time"
              labelClassName="left-[22px] top-[100px]"
              onHoverChange={(hovered) => setMobileActive(hovered ? "time" : null)}
            />
            <AnnotationHotspot
              text="Cash"
              labelClassName="right-[22px] top-[100px]"
              onHoverChange={(hovered) => setMobileActive(hovered ? "cash" : null)}
            />
            <AnnotationHotspot
              text="Your food"
              labelClassName="left-[22px] top-[208px]"
              onHoverChange={(hovered) => setMobileActive(hovered ? "food" : null)}
            />
            <AnnotationHotspot
              text="Players"
              labelClassName="right-[22px] top-[252px]"
              onHoverChange={(hovered) =>
                setMobileActive(hovered ? "players" : null)
              }
            />
            <AnnotationHotspot
              text="Prices"
              labelClassName="left-[22px] top-[350px]"
              onHoverChange={(hovered) =>
                setMobileActive(hovered ? "prices" : null)
              }
            />
            <AnnotationHotspot
              text="Scroll wheel"
              labelClassName="right-[22px] top-[466px]"
              onHoverChange={(hovered) =>
                setMobileActive(hovered ? "scroll" : null)
              }
            />
            <AnnotationHotspot
              text="Buy"
              labelClassName="left-[22px] top-[550px]"
              onHoverChange={(hovered) => setMobileActive(hovered ? "buy" : null)}
            />
            <AnnotationHotspot
              text="Ask"
              labelClassName="right-[22px] top-[550px]"
              onHoverChange={(hovered) => setMobileActive(hovered ? "ask" : null)}
            />
          </div>

          <div className="mx-auto mt-4 w-full max-w-[300px] md:hidden">
            <div className="relative">
              <MobilePhoneShell activeKey={mobileActive} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-[#0d1219] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-accent">
                Desktop layout
              </div>
              <div className="rounded-full border border-accent/30 bg-[#101722] px-3 py-1 text-[11px] font-semibold tracking-[0.04em] text-accent shadow-[0_6px_18px_rgba(0,0,0,0.22)]">
                Hover the labels
              </div>
            </div>
          </div>

          <div className="mx-auto mt-6 w-full max-w-[1120px]">
            <div className="relative">
              <DesktopScreenShell activeKey={desktopActive} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {desktopLabels.map((item) => (
              <AnnotationLabel
                key={item.label}
                text={item.label}
                interactive
                onHoverChange={(hovered) =>
                  setDesktopActive(hovered ? item.key : null)
                }
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-[#0d1219] p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[...guideItems, ...desktopFeatures].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-line bg-[#121925] p-4"
              >
                <div className="mb-2 text-lg font-bold tracking-tight text-accent">
                  {item.label}
                </div>
                <p className="text-base leading-relaxed text-text">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function highlightLobbyCopy(text: string) {
  const emphasis = "Fill with bots";
  const parts = text.split(emphasis);

  if (parts.length === 1) {
    return text;
  }

  return parts.flatMap((part, index) => {
    if (index === parts.length - 1) {
      return [part];
    }

    return [
      part,
      <span key={`${emphasis}-${index}`} className="font-semibold text-accent">
        {emphasis}
      </span>,
    ];
  });
}

export default function TutorialPage() {
  const { hero, rules, lobby, layouts } = tutorialContent;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="card p-6 sm:p-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold uppercase tracking-[0.08em] text-accent">
              Tutorial
            </div>
            <Link href="/" className="btn-ghost text-xs">
              Back to home
            </Link>
          </div>

          <div className="max-w-3xl">
            <h1 className="mb-4 text-3xl font-bold tracking-tight text-accent sm:text-4xl">
              {hero.title}
            </h1>
            <p className="mb-3 text-lg leading-relaxed text-text">
              {hero.subtitle}
            </p>
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              {hero.summary}
            </p>
          </div>
        </header>

        <section className="card border-accent/30 bg-[linear-gradient(180deg,rgba(212,167,98,0.12),rgba(15,19,27,0.96)_28%)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.2)] sm:p-7">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-accent">
                {rules.title}
              </h2>
            </div>
            <div className="hidden rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-accent sm:block">
              {rules.badge}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {rules.sections.map((section) => (
              <article
                key={section.title}
                className="rounded-2xl border border-line/80 bg-[#121925]/90 p-5 sm:p-6"
              >
                <h3 className="text-xl font-bold tracking-tight text-text">
                  {section.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {section.intro}
                </p>

                <ul className="mt-5 space-y-3">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3">
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                      <p className="text-sm leading-relaxed text-text">{bullet}</p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <article className="card p-5 sm:p-6">
          <div className="space-y-3">
            <div>
              <h2 className="mb-2 text-2xl font-bold tracking-tight">
                {lobby.title}
              </h2>
            </div>

            <div className="space-y-2">
              {lobby.body.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-base leading-relaxed text-text"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <ul className="space-y-2">
              {lobby.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2.5">
                  <span className="mt-2 h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
                  <p className="text-base leading-relaxed text-text">
                    {highlightLobbyCopy(bullet)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <section className="card p-6 sm:p-7">
          <div className="mb-5 max-w-3xl">
            <h2 className="mb-3 text-2xl font-bold tracking-tight">
              {layouts.title}
            </h2>
            {layouts.body.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed text-text">
                {paragraph}
              </p>
            ))}
          </div>
          <CombinedLayouts
            guideItems={layouts.guideItems}
            desktopFeatures={layouts.desktopFeatures}
          />
        </section>
      </div>
    </main>
  );
}
