import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { attachSocketHandlers } from "./socket";

const PORT = Number(process.env.PORT ?? 3001);
const RAW_FRONTEND_URL = process.env.FRONTEND_URL ?? "*";

// Accept either a single origin, a comma-separated list, "*", or a regex pattern
// like "/^https:\\/\\/my-app-.*\\.vercel\\.app$/" (with leading and trailing /).
function buildCorsOrigin(): string | RegExp | string[] | true {
  const v = RAW_FRONTEND_URL.trim();
  if (v === "*" || v === "") return true;
  if (v.startsWith("/") && v.endsWith("/")) {
    try {
      return new RegExp(v.slice(1, -1));
    } catch {
      console.warn("[backend] invalid FRONTEND_URL regex, falling back to *");
      return true;
    }
  }
  if (v.includes(",")) {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return v;
}

const corsOrigin = buildCorsOrigin();

const app = express();
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.json({
    name: "food-trading-survival-backend",
    status: "ok",
    cors: RAW_FRONTEND_URL,
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
  },
});

attachSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`[backend] listening on :${PORT}, CORS origin: ${RAW_FRONTEND_URL}`);
});
