// routes/playerItemsRoutes.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ✅ Obtener inventario completo del jugador (con items anidados)
router.get("/:playerId", async (req, res) => {
  const { playerId } = req.params;

  const { data, error } = await supabase
    .from("player_items")
    .select(`
      id,
      is_equipped,
      items (
        id,
        name,
        skill_bonus,
        bonus_value
      )
    `)
    .eq("player_id", playerId);

  if (error) {
    console.error("❌ Error al obtener inventario:", error.message);
    return res.status(500).json({ error: error.message });
  }

  // ⚠️ Filtramos nulls si hay items sin relación
  const filtered = (data || []).filter(item => item.items !== null);

  return res.json(filtered);
});

// ✅ Equipar o desequipar ítem (mantiene skills)
router.put("/equip", async (req, res) => {
  const { player_item_id, equip } = req.body;

  const { data: playerItem, error: itemError } = await supabase
    .from("player_items")
    .select("player_id, items(skill_bonus, bonus_value)")
    .eq("id", player_item_id)
    .single();

  if (itemError || !playerItem)
    return res.status(404).json({ error: "Item no encontrado" });

  const playerId = playerItem.player_id;
  const { skill_bonus, bonus_value } = playerItem.items;

  await supabase
    .from("player_items")
    .update({ is_equipped: equip })
    .eq("id", player_item_id);

  // Actualizar o crear el skill del jugador
  const { data: skillData } = await supabase
    .from("player_skills")
    .select("id, skill_value")
    .eq("player_id", playerId)
    .eq("skill_name", skill_bonus)
    .maybeSingle();

  const newValue =
    (skillData?.skill_value || 0) + (equip ? bonus_value : -bonus_value);

  if (skillData) {
    await supabase
      .from("player_skills")
      .update({ skill_value: newValue })
      .eq("id", skillData.id);
  } else {
    await supabase.from("player_skills").insert({
      player_id: playerId,
      skill_name: skill_bonus,
      skill_value: newValue,
    });
  }

  res.json({ success: true, new_value: newValue });
});

export default router;
