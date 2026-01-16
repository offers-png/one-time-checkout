import express from "express";
import Stripe from "stripe";
import Database from "better-sqlite3";

const db = new Database("links.db");

// Create all tables at startup
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE,
    used INTEGER DEFAULT 0,
    expires_at INTEGER
  )
`,
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS api_usage (
    api_key TEXT,
    date TEXT,
    count INTEGER DEFAULT 0,
    PRIMARY KEY (api_key, date)
  )
`,
).run();

const app = express();

app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

const API_KEY = process.env.API_KEY;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!API_KEY || key !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const row = db
    .prepare(
      `
    SELECT count FROM api_usage
    WHERE api_key = ? AND date = ?
  `,
    )
    .get(key, today);

  if (row && row.count >= 5) {
    return res.status(429).json({ error: "Daily limit reached" });
  }

  next();
}

// Webhook handler (must be before other routes)
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    db.prepare(
      `
      UPDATE links
      SET used = 1
      WHERE session_id = ?
    `,
    ).run(session.id);
  }

  res.json({ received: true });
});

app.post("/create-link", requireApiKey, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const { price } = req.body;
    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({ error: "Invalid price" });
    }

    // Increment API usage
    db.prepare(
      `
      INSERT INTO api_usage (api_key, date, count)
      VALUES (?, ?, 1)
      ON CONFLICT(api_key, date)
      DO UPDATE SET count = count + 1
    `,
    ).run(req.headers["x-api-key"], today);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Private Payment Link" },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel",
    });

    db.prepare(
      `
      INSERT INTO links (session_id, expires_at)
      VALUES (?, ?)
    `,
    ).run(
      session.id,
      Date.now() + 60 * 60 * 1000, // expires in 1 hour
    );

    if (Date.now() > link.expires_at) {
      return res.status(410).send("Link expired");
    }

    const host = req.get("x-forwarded-host") || req.get("host");
    const proto = req.get("x-forwarded-proto") || req.protocol;

    res.json({
      private_url: `${proto}://${host}/pay/${session.id}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Stripe error" });
  }
});

app.get("/pay/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  const link = db
    .prepare(`
      SELECT * FROM links
      WHERE session_id = ?
      AND used = 0
      AND expires_at > ?
    `)
    .get(sessionId, Date.now());

  if (!link) {
    return res.status(410).send("Link expired or already used");
  }

  return res.redirect(
    `https://checkout.stripe.com/pay/${sessionId}`
  );
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
