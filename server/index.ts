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
    checkout_url TEXT,
    used INTEGER DEFAULT 0,
    expires_at INTEGER
  )
`,
).run();

// Add checkout_url column if missing (for existing databases)
try {
  db.prepare(`ALTER TABLE links ADD COLUMN checkout_url TEXT`).run();
} catch (e) {
  // Column already exists, ignore
}

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

// Webhook handler (must be before JSON middleware)
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
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

// JSON middleware for other routes
app.use(express.json());

app.post("/create-link", requireApiKey, async (req: any, res: any) => {
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
      INSERT INTO links (session_id, checkout_url, expires_at)
      VALUES (?, ?, ?)
    `,
    ).run(
      session.id,
      session.url,
      Date.now() + 60 * 60 * 1000, // expires in 1 hour
    );

    

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

  if (!link.checkout_url) {
    return res.status(500).send("Invalid payment link");
  }

  return res.redirect(link.checkout_url);
});

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>PayLink – Secure One-Time Payment Links</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 40px auto;
          padding: 0 20px;
          line-height: 1.6;
          color: #111;
        }
        h1, h2 {
          color: #222;
        }
        footer {
          margin-top: 40px;
          font-size: 0.9em;
          color: #555;
        }
      </style>
    </head>
    <body>
      <h1>PayLink – Secure One-Time Payment Links</h1>

      <p>
        PayLink is a software service that allows businesses and individuals
        to generate secure, single-use payment links for online payments.
      </p>

      <h2>How it works</h2>
      <ul>
        <li>Create a one-time payment link</li>
        <li>Share the link with a customer</li>
        <li>The link expires after one use or a time limit</li>
      </ul>

      <h2>What customers are paying for</h2>
      <p>
        Customers are paying for access to a secure checkout link that allows
        them to complete a payment online using Stripe.
      </p>

      <h2>Support</h2>
      <p>
        For questions, billing issues, or support, contact:
        <br />
        <strong>Email:</strong> offers@dealdily.com
      </p>

      <h2>Refund policy</h2>
      <p>
        Refunds are handled on a case-by-case basis. Customers may contact
        support to request assistance with payments or disputes.
      </p>

      <footer>
        <p>© ${new Date().getFullYear()} PayLink. All rights reserved.</p>
      </footer>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
