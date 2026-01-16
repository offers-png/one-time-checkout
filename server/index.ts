import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import Stripe from "stripe";
import Database from "better-sqlite3";
import { setupVite } from "./vite";
import { registerRoutes } from "./routes";

const app = express();

const db = new Database("links.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE,
    checkout_url TEXT,
    price REAL,
    used INTEGER DEFAULT 0,
    expires_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
  )
`).run();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

app.use((req, res, next) => {
  if (req.originalUrl === "/api/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: false }));

app.post("/api/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];

  if (!sig || !WEBHOOK_SECRET) {
    console.error("Missing signature or webhook secret");
    return res.status(400).json({ error: "Missing signature" });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    db.prepare(`
      UPDATE links
      SET used = 1
      WHERE session_id = ?
    `).run(session.id);
    console.log(`Payment completed for session: ${session.id}`);
  }

  res.json({ received: true });
});

app.get("/pay/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  const link = db
    .prepare(
      `SELECT * FROM links
       WHERE session_id = ?
       AND used = 0
       AND expires_at > ?`
    )
    .get(sessionId, Date.now()) as { session_id: string; checkout_url: string } | undefined;

  if (!link) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Link Expired</title>
        <style>
          body {
            font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 400px;
          }
          h1 { color: #dc2626; margin-bottom: 12px; font-size: 1.5rem; }
          p { color: #666; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Link Expired or Already Used</h1>
          <p>This payment link is no longer valid.</p>
        </div>
      </body>
      </html>
    `);
  }

  db.prepare(`
    UPDATE links
    SET used = 1
    WHERE session_id = ?
  `).run(sessionId);

  return res.redirect(link.checkout_url);
});

app.post("/api/create-link", async (req, res) => {
  try {
    const { price } = req.body;

    if (!price || typeof price !== "number" || price <= 0) {
      return res.status(400).json({ error: "Valid price is required" });
    }

    if (price > 999999) {
      return res.status(400).json({ error: "Price cannot exceed $999,999" });
    }

    const host = req.get("host") || "localhost:5000";
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const baseUrl = `${protocol}://${host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
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
      success_url: `${baseUrl}/success`,
      cancel_url: `${baseUrl}/cancel`,
    });

    if (!session.url) {
      throw new Error("Failed to create checkout session URL");
    }

    db.prepare(`
      INSERT INTO links (session_id, checkout_url, price, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(
      session.id,
      session.url,
      price,
      Date.now() + 60 * 60 * 1000
    );

    res.json({
      private_url: `${baseUrl}/pay/${session.id}`,
    });
  } catch (err: any) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message || "Failed to create payment link" });
  }
});

(async () => {
  const server = createServer(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    console.error(err);
  });

  await registerRoutes(server, app);

  if (app.get("env") === "development") {
    await setupVite(server, app);
  } else {
    const { serveStatic } = await import("./static");
    serveStatic(app);
  }

  const port = 5000;
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });
})();

export { db };
