import express from "express";
import { supabase } from "../db.js";

const router = express.Router();

router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data, error } = await supabase
    .from("player_items")
    .select("*")
    .eq("player_id", userId);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post("/add", async (req, res) => {
  const { player_id, item_id } = req.body;
  const { error } = await supabase
    .from("player_items")
    .insert([{ player_id, item_id }]);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

router.put("/equip", async (req, res) => {
  const { player_item_id, equip } = req.body;
  const { error } = await supabase
    .from("player_items")
    .update({ equipped: equip })
    .eq("id", player_item_id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

export default router;
