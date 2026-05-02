import { randomBytes } from "crypto";

export function createId(): string {
  return randomBytes(8).toString("hex");
}

export function createPlayerId(): string {
  return "p_" + createId();
}

export function createOrderId(): string {
  return "o_" + createId();
}

export function createTradeId(): string {
  return "t_" + createId();
}

export function createEventId(): string {
  return "e_" + createId();
}
