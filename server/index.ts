import express from "express";
import Stripe from "stripe";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("links.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE,
    checkout_url TEXT,
    used INTEGER DEFAULT 0,
    expires_at INTEGER
  )
`).run();

try {
  db.prepare(`ALTER TABLE links ADD COLUMN checkout_url TEXT`).run();
} catch (e) {
  // Column already exists
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const app = express();

// Webhook route must come before JSON middleware
app.post("/api/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET as string);
  } catch (err: any) {
    console.log(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    db.prepare(`UPDATE links SET used = 1 WHERE session_id = ?`).run(session.id);
  }

  res.json({ received: true });
});

// JSON middleware for other routes
app.use(express.json());

// Serve static files
app.use(express.static(path.join(process.cwd(), "public")));

// Create payment link API
app.post("/api/create-link", async (req: any, res: any) => {
  try {
    const { price } = req.body;
    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({ error: "Invalid price" });
    }

    const host = req.get("x-forwarded-host") || req.get("host");
    const proto = req.get("x-forwarded-proto") || req.protocol;
    const baseUrl = `${proto}://${host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Payment" },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/success.html`,
      cancel_url: `${baseUrl}/cancel.html`,
    });

    db.prepare(`
      INSERT INTO links (session_id, checkout_url, expires_at)
      VALUES (?, ?, ?)
    `).run(session.id, session.url, Date.now() + 60 * 60 * 1000);

    res.json({
      private_url: `${baseUrl}/pay/${session.id}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create payment link" });
  }
});

// Payment redirect
app.get("/pay/:sessionId", (req: any, res: any) => {
  const { sessionId } = req.params;

  const link = db.prepare(`
    SELECT * FROM links
    WHERE session_id = ?
    AND used = 0
    AND expires_at > ?
  `).get(sessionId, Date.now()) as any;

  if (!link) {
    return res.status(410).send("Link expired or already used");
  }

  if (!link.checkout_url) {
    return res.status(500).send("Invalid payment link");
  }

  return res.redirect(link.checkout_url);
});

// Fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

const PORT = 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
