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

app.get("/pay/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  const link = db.prepare(`
    SELECT * FROM links
    WHERE session_id = ?
    AND used = 0
    AND expires_at > ?
  `).get(sessionId, Date.now()) as any;

  if (!link) {
    return res.status(410).send("❌ This access link is expired or already used.");
  }

  // 🔒 Mark as used immediately
  db.prepare(`
    UPDATE links SET used = 1 WHERE session_id = ?
  `).run(sessionId);

  // ✅ Deliver the payload (V1)
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Access Granted</title>
        <meta charset="UTF-8" />
        <style>
          body {
            font-family: system-ui, sans-serif;
            background: #f4f6f8;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .card {
            background: white;
            padding: 32px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,.1);
            max-width: 420px;
            text-align: center;
          }
          h1 { color: #22c55e; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✅ Access Granted</h1>
          <p>Your payment was confirmed.</p>
          <p>This link has now been locked.</p>

          <hr />

          <p><strong>Delivery Payload:</strong></p>
          <p>This is where your product / access / key will appear.</p>

          <small>Session: ${sessionId}</small>
        </div>
      </body>
    </html>
  `);
});


// Fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

const PORT = 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
