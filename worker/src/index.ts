import Anthropic from "@anthropic-ai/sdk";

interface Env {
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGIN: string;
}

// Shop-Daten liegen hier auf dem Server, damit niemand über die Seite den System-Prompt umschreiben kann.
const SHOPS: Record<string, { name: string; address: string; email: string }> = {
  espati: { name: "Espati Petshop", address: "İstiklal Mah., Şairfuzuli Cad. No:17/A, Odunpazarı / Eskişehir", email: "espatipetshop@hotmail.com" },
  prenses: { name: "Prenses Petshop", address: "Eskişehir", email: "artipetshopeskisehir@gmail.com" },
  sena: { name: "Sena Petshop", address: "Eskişehir", email: "ramcoedasena26@gmail.com" },
  caglar: { name: "Çağlar Petshop", address: "Eskişehir", email: "tirpancicaglar4@gmail.com" },
  zeybek: { name: "Zeybek Petshop", address: "Eskişehir", email: "zeybekm090@gmail.com" },
  jelibon: { name: "Jelibon Petshop", address: "Eskişehir", email: "cigdemmzuner.26@gmail.com" },
};

const MAX_TURNS = 12;
const MAX_CHARS = 800;

function systemPrompt(shop: { name: string; address: string; email: string }): string {
  return `Sen ${shop.name} adlı Eskişehir'deki bir petshopun web sitesindeki sohbet asistanısın.
Müşteriler kedi, köpek, kuş ve akvaryum ürünleri, mama seçimi, temel bakım ve mağaza bilgileri hakkında soru sorar.

Mağaza bilgileri:
- Adres: ${shop.address}
- E-posta: ${shop.email}
- Ürün grupları: köpek ve kedi maması, kum, ödül, tasma, oyuncak, kuş yemi ve kafes, akvaryum ve ekipman
- Eskişehir içinde eve teslimat yapılır.

Kurallar:
- Müşteri hangi dilde yazarsa o dilde cevap ver (varsayılan Türkçe).
- Kısa ve samimi cevap ver, en fazla 3-4 cümle.
- Fiyat, stok veya açılış saati bilmiyorsan uydurma; müşteriyi mağazayı aramaya ya da e-posta göndermeye yönlendir.
- Hasta veya yaralı hayvan sorularında genel bilgi ver ama mutlaka bir veterinere başvurmasını söyle.
- Petshop ve evcil hayvanlarla ilgisi olmayan konularda kibarca yalnızca bu konularda yardımcı olabileceğini söyle.`;
}

function cors(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN;
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
    if (request.method !== "POST") return json({ error: "Nur POST erlaubt" }, 405, origin);
    if (request.headers.get("Origin") !== origin) return json({ error: "Origin nicht erlaubt" }, 403, origin);

    let body: { shop?: string; messages?: { role: string; content: string }[] };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Ungültiges JSON" }, 400, origin);
    }

    const shop = SHOPS[body.shop ?? ""] ?? SHOPS.espati;
    const raw = Array.isArray(body.messages) ? body.messages.slice(-MAX_TURNS) : [];
    const messages: Anthropic.Beta.BetaMessageParam[] = raw
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, MAX_CHARS) }));
    while (messages.length && messages[0].role !== "user") messages.shift();
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return json({ error: "Letzte Nachricht muss vom Kunden sein" }, 400, origin);
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const response = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 1024,
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: systemPrompt(shop),
        messages,
      });

      if (response.stop_reason === "refusal") {
        return json({ reply: "Bu konuda yardımcı olamıyorum. Lütfen mağazamızla iletişime geçin." }, 200, origin);
      }
      const reply = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return json({ reply: reply || "Şu an cevap veremiyorum, lütfen tekrar deneyin." }, 200, origin);
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        return json({ error: "Çok fazla istek, lütfen biraz sonra tekrar deneyin." }, 429, origin);
      }
      if (error instanceof Anthropic.AuthenticationError) {
        console.error("API-Schlüssel ungültig");
        return json({ error: "Sohbet şu an kullanılamıyor." }, 500, origin);
      }
      if (error instanceof Anthropic.APIError) {
        console.error(`API error ${error.status}:`, error.message);
        return json({ error: "Sohbet şu an kullanılamıyor." }, 502, origin);
      }
      throw error;
    }
  },
};
