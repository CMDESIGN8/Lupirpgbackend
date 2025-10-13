import express from "express";
import { supabase } from "../db.js";

const router = express.Router();

// === Obtener datos del jugador ===
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// === Avatares del jugador ===
router.get("/:userId/avatars", async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabase
    .from("avatars")
    .select("*")
    .eq("player_id", userId);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// === Club del jugador ===
router.get("/:userId/club", async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("owner_id", userId)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// === Misiones del jugador ===
router.get("/:userId/missions", async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabase
    .from("player_missions")
    .select("*")
    .eq("player_id", userId);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
