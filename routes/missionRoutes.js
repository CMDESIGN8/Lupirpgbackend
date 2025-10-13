import express from "express";
import { supabase } from "../db.js";
const router = express.Router();

router.get("/", async (req, res) => {
  const { data, error } = await supabase.from("missions").select("*");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
