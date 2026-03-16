import { createStorage } from "./storage";
import {
  broadcast,
  broadcastSourceCount,
  addClient,
  removeClient,
} from "./sse";
import {
  isAuthenticated,
  loginPage,
  hashPassword,
  AUTH_COOKIE_NAME,
} from "./auth";
import { dashboard } from "./dashboard";

const PORT = Number(process.env.PORT) || 3000;
const MAX_MESSAGES = Number(process.env.MAX_MESSAGES) || 500;
const PASSWORD = process.env.PASSWORD || "";
const STORAGE_TYPE = (process.env.STORAGE as "memory" | "sqlite") || "memory";

const storage = createStorage({
  type: STORAGE_TYPE,
  maxMessages: MAX_MESSAGES,
  dbPath: process.env.DB_PATH,
});

const dashboardHtml = dashboard(!!PASSWORD);

function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {}
) {
  return Response.json(data, { status, headers });
}

function requireAuth(req: Request): Response | null {
  if (!PASSWORD) return null;
  if (isAuthenticated(req, PASSWORD)) return null;
  return json({ error: "Unauthorized" }, 401);
}

const sources = new Set<any>();
let callSeq = 0;

const server = Bun.serve({
  hostname: process.env.HOST || "0.0.0.0",
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = req.method;

    // WebSocket upgrade
    if (path === "/ws") {
      if (PASSWORD && !isAuthenticated(req, PASSWORD)) {
        return new Response("Unauthorized", { status: 401 });
      }
      const upgraded = server.upgrade(req, {
        data: { callId: ++callSeq },
      });
      if (upgraded) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (path === "/login" && method === "POST") {
      const form = await req.formData().catch(() => null);
      const pw = form?.get("password")?.toString() || "";
      if (pw === PASSWORD && PASSWORD) {
        const token = hashPassword(PASSWORD);
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/",
            "Set-Cookie": `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
          },
        });
      }
      return new Response(loginPage(true), {
        status: 401,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (path === "/" && method === "GET") {
      if (PASSWORD && !isAuthenticated(req, PASSWORD)) {
        return new Response(loginPage(), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new Response(dashboardHtml, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (path === "/history" && method === "GET") {
      const denied = requireAuth(req);
      if (denied) return denied;
      return json({ messages: storage.list() });
    }

    if (path === "/history" && method === "DELETE") {
      const denied = requireAuth(req);
      if (denied) return denied;
      storage.clear();
      return json({ cleared: true });
    }

    if (path === "/stream" && method === "GET") {
      const denied = requireAuth(req);
      if (denied) return denied;

      let controller!: ReadableStreamDefaultController;
      const stream = new ReadableStream({
        start(c) {
          controller = c;
          addClient(c);
          c.enqueue(": connected\n\n");
          c.enqueue(
            `data: ${JSON.stringify({ type: "sources", count: sources.size })}\n\n`
          );
        },
        cancel() {
          removeClient(controller);
        },
      });

      req.signal.addEventListener("abort", () => removeClient(controller));

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    if (path === "/logout" && method === "GET") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/",
          "Set-Cookie": `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`,
        },
      });
    }

    return json({ error: "Not found" }, 404);
  },
  websocket: {
    open(ws) {
      const callId = (ws.data as any).callId;
      console.log(`WebSocket connected (call #${callId})`);
      sources.add(ws);
      broadcastSourceCount(sources.size);
    },
    message(ws, message) {
      const callId = (ws.data as any).callId;
      const raw =
        typeof message === "string" ? message : new TextDecoder().decode(message);
      try {
        const msg = JSON.parse(raw);
        msg._callId = callId;
        const stored = storage.push(msg);
        broadcast(stored);
      } catch {
        const stored = storage.push({ text: raw, _callId: callId });
        broadcast(stored);
      }
    },
    close(ws) {
      const callId = (ws.data as any).callId;
      console.log(`WebSocket disconnected (call #${callId})`);
      sources.delete(ws);
      broadcastSourceCount(sources.size);
      const endMsg = storage.push({ _callId: callId, _event: "call_ended" });
      broadcast(endMsg);
    },
  },
});

console.log(
  `PBXware Live Transcription running on http://localhost:${server.port}`
);
console.log(`  Storage: ${STORAGE_TYPE}`);
console.log(`  Auth: ${PASSWORD ? "enabled" : "disabled"}`);
