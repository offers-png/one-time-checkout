import express from "express";
import Stripe from "stripe";
import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";


const app = express();
const db = new Database("links.db");
const PLAN_MAP: Record<string, number | null> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "lifetime": null
};

db.prepare(`
  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE,
    checkout_url TEXT,
    paid INTEGER DEFAULT 0,
    used INTEGER DEFAULT 0,
    payload TEXT,
    expires_at INTEGER
  )
`).run();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/* =========================
   STRIPE WEBHOOK (PAYMENT)
   ========================= */
app.post(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.headers["stripe-signature"] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        WEBHOOK_SECRET as string
      );
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

        if (!session.id) {
          return res.status(400).json({ error: "Missing session ID" });
        }

        const apiKey = "plk_live_" + crypto.randomUUID().replace(/-/g, "");
        const payload = JSON.stringify({
          type: "api_key",
          value: apiKey,
        });

        const expiresAt = Date.now() + PLAN_MAP["7d"]; // TEMP default

        db.prepare(`
          UPDATE links
          SET paid = 1,
              payload = ?,
              expires_at = ?
          WHERE session_id = ?
        `).run(payload, expiresAt, session.id);

    
    }

    res.json({ received: true });
  }
);

// JSON middleware AFTER webhook
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

/* =========================
   CREATE PAYMENT LINK
   ========================= */
app.post("/api/create-link", async (req, res) => {
  const { price, plan = "7d" } = req.body;

  if (typeof price !== "number" || price <= 0) {
    return res.status(400).json({ error: "Invalid price" });
  }

  if (!(plan in PLAN_MAP)) {
    return res.status(400).json({ error: "Invalid plan" });
  }

  const durationMs = PLAN_MAP[plan];
  const expiresAt = durationMs ? Date.now() + durationMs : null;

  const host = req.get("x-forwarded-host") || req.get("host");
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const baseUrl = `${proto}://${host}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    metadata: { plan },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `API Access (${plan})` },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/pay/${"{CHECKOUT_SESSION_ID}"}`,
    cancel_url: `${baseUrl}/cancel.html`,
  });

  db.prepare(`
    INSERT INTO links (session_id, checkout_url, expires_at)
    VALUES (?, ?, ?)
  `).run(session.id, session.url, expiresAt);

  res.json({
    private_url: `${baseUrl}/pay/${session.id}`,
  });
});


/* =========================
   PAY → REDIRECT ONLY
   ========================= */
  app.get("/pay/:sessionId", (req, res) => {
    const { sessionId } = req.params;

    const link = db.prepare(`
      SELECT * FROM links
      WHERE session_id = ?
      AND expires_at > ?
    `).get(sessionId, Date.now()) as any;

    
    if (!link) {
      return res.redirect(`/wait/${sessionId}`);
    }


    // If NOT paid yet → send to Stripe Checkout
    if (link.paid === 0 && link.checkout_url) {
      return res.redirect(link.checkout_url);
    }

    // Paid → deliver
    res.redirect(`/wait/${sessionId}`);
  });


/* =========================
   DELIVERY (ONE-TIME)
   ========================= */
app.get("/wait/:sessionId", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "wait.html"));
});

app.get("/deliver/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  const link = db.prepare(`
    SELECT * FROM links
    WHERE session_id = ?
    AND paid = 1
    AND used = 0
  `).get(sessionId) as any;

  if (!link) {
    return res.status(410).send("❌ Link already used or invalid.");
  }

  db.prepare(`
    UPDATE links SET used = 1 WHERE session_id = ?
  `).run(sessionId);

  const payload = JSON.parse(link.payload || "{}");

  res.send(`
    <html>
      <body style="font-family:system-ui;text-align:center;padding-top:80px">
        <h1>Your API Key</h1>
        <p style="font-family:monospace;background:#f0f0f0;padding:16px;border-radius:8px;display:inline-block">${payload.value || "N/A"}</p>
        <p style="color:#666;margin-top:16px">Save this key - it will not be shown again.</p>
      </body>
    </html>
  `);
});

/* =========================
   VERIFY COUPON / API KEY
  ========================= */
app.post("/api/verify-coupon", express.json(), (req, res) => {
  const key = req.headers["x-api-key"];
  if (key !== process.env.API_KEY) {
    return res.status(401).json({ valid: false });
}
  const { coupon_key } = req.body;

  const row = db
    .prepare(
      `SELECT id FROM links
       WHERE json_extract(payload,'$.value') = ?
         AND paid = 1
         AND used = 0
         AND expires_at > ?`
    )
    .get(coupon_key, Date.now()) as any;

  if (!row) return res.status(400).json({ valid: false });

  db.prepare(`UPDATE links SET used = 1 WHERE id = ?`).run((row as any).id);
  res.json({ valid: true });
});

/* ========================= */
const PORT = 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
