import express from "express";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

const MAIN_BACKEND = "https://main-backend-k32m.onrender.com";

// Proxy create-link to main-backend
app.post("/api/create-link", async (req, res) => {
  try {
    const response = await fetch(`${MAIN_BACKEND}/api/checkout/create-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Proxy verify-session to main-backend
app.get("/api/verify-session", async (req, res) => {
  try {
    const { session_id } = req.query;
    const response = await fetch(`${MAIN_BACKEND}/api/checkout/verify-session?session_id=${session_id}`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = parseInt(process.env.PORT || "5000");
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
