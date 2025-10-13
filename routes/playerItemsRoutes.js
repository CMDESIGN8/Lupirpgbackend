// routes/playerItemsRoutes.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ✅ Obtener inventario de un jugador
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

  res.json(data);
});

// ✅ Equipar o desequipar ítem y actualizar skills
router.put("/equip", async (req, res) => {
  const { player_item_id, equip } = req.body;

  // 1️⃣ Obtener el item con info de bonus y player_id
  const { data: playerItem, error: itemError } = await supabase
    .from("player_items")
    .select("player_id, item_id, is_equipped, items(skill_bonus, bonus_value)")
    .eq("id", player_item_id)
    .single();

  if (itemError || !playerItem) {
    return res.status(404).json({ error: "Item no encontrado" });
  }

  const playerId = playerItem.player_id;
  const { skill_bonus, bonus_value } = playerItem.items;

  // 2️⃣ Actualizar el estado del ítem
  const { error: updateError } = await supabase
    .from("player_items")
    .update({ is_equipped: equip })
    .eq("id", player_item_id);

  if (updateError) return res.status(500).json({ error: updateError.message });

  // 3️⃣ Modificar el skill correspondiente
  const { data: skillData, error: skillErr } = await supabase
    .from("player_skills")
    .select("id, skill_value")
    .eq("player_id", playerId)
    .eq("skill_name", skill_bonus)
    .single();

  if (skillErr && skillErr.code !== "PGRST116") {
    console.error(skillErr);
    return res.status(500).json({ error: "Error al obtener skill" });
  }

  let newValue = (skillData?.skill_value || 0) + (equip ? bonus_value : -bonus_value);

  if (skillData) {
    // Actualizar skill existente
    await supabase
      .from("player_skills")
      .update({ skill_value: newValue })
      .eq("id", skillData.id);
  } else {
    // Crear nuevo registro de skill si no existía
    await supabase.from("player_skills").insert({
      player_id: playerId,
      skill_name: skill_bonus,
      skill_value: newValue,
    });
  }

  res.json({ success: true, new_value: newValue });
});

export default router;
