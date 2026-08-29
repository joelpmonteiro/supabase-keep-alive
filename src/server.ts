const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const intervalMinutes = Number.parseFloat(
  process.env.KEEP_ALIVE_INTERVAL_MINUTES ?? "120",
);
const pingTimeoutMs = Number.parseInt(
  process.env.PING_TIMEOUT_MS ?? "10000",
  10,
);
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const pingUrl =
  process.env.SUPABASE_PING_URL ??
  (supabaseUrl ? `${supabaseUrl}/rest/v1/` : undefined);
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!pingUrl) {
  throw new Error(
    "Configure SUPABASE_PING_URL or SUPABASE_URL before starting the server.",
  );
}

if (!Number.isFinite(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be a valid TCP port.");
}

if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
  throw new Error("KEEP_ALIVE_INTERVAL_MINUTES must be greater than zero.");
}

if (!Number.isFinite(pingTimeoutMs) || pingTimeoutMs <= 0) {
  throw new Error("PING_TIMEOUT_MS must be greater than zero.");
}

const intervalMs = intervalMinutes * 60 * 1_000;
let lastPing: {
  at: string;
  ok: boolean;
  status?: number;
  error?: string;
} | null = null;
let pingInProgress = false;

function headers(): HeadersInit {
  if (!anonKey) return {};

  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
}

async function pingSupabase(): Promise<void> {
  if (pingInProgress) return;
  pingInProgress = true;

  try {
    const response = await fetch(pingUrl, {
      method: "GET",
      headers: headers(),
      signal: AbortSignal.timeout(pingTimeoutMs),
    });

    lastPing = {
      at: new Date().toISOString(),
      ok: response.ok,
      status: response.status,
    };

    if (response.ok) {
      console.log(`[ping] Supabase respondeu com HTTP ${response.status}.`);
    } else {
      console.error(`[ping] Supabase respondeu com HTTP ${response.status}.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastPing = {
      at: new Date().toISOString(),
      ok: false,
      error: message,
    };
    console.error(`[ping] Falha ao acessar o Supabase: ${message}`);
  } finally {
    pingInProgress = false;
  }
}

const server = Bun.serve({
  port,
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({
        service: "supabase-keep-alive",
        status: "ok",
        lastPing,
      });
    }

    if (url.pathname === "/ping" && request.method === "POST") {
      void pingSupabase();
      return Response.json({ message: "Ping iniciado." }, { status: 202 });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Servidor ouvindo em http://localhost:${server.port}`);
console.log(`Ping configurado a cada ${intervalMinutes} minuto(s).`);

void pingSupabase();
const timer = setInterval(() => void pingSupabase(), intervalMs);

type ShutdownSignal = "SIGINT" | "SIGTERM";
const shutdown = (signal: ShutdownSignal) => {
  console.log(`Recebido ${signal}; encerrando...`);
  clearInterval(timer);
  server.stop(true);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
