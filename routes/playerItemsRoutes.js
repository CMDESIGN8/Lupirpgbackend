// routes/playerItemsRoutes.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ✅ Obtener inventario de un jugador con info de items
router.get("/:playerId", async (req, res) => {
  const { playerId } = req.params;

  try {
    const { data, error } = await supabase
      .from("player_items")
      .select(`
        id,
        is_equipped,
        items:id(*)  -- Trae toda la info del item
      `)
      .eq("player_id", playerId);

    if (error) throw error;

    // Formatear para que items no sea null
    const inventory = data.map(pi => ({
      id: pi.id,
      is_equipped: pi.is_equipped,
      items: pi.items || {
        id: null,
        name: "Desconocido",
        skill_bonus: "N/A",
        bonus_value: 0
      }
    }));

    res.json(inventory);
  } catch (err) {
    console.error("❌ Error al obtener inventario:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Equipar/desequipar item
router.put("/equip", async (req, res) => {
  const { player_item_id, equip } = req.body;

  try {
    const { data: playerItem, error: itemError } = await supabase
      .from("player_items")
      .select("player_id, item_id, is_equipped, items(name, skill_bonus, bonus_value)")
      .eq("id", player_item_id)
      .single();

    if (itemError || !playerItem) {
      return res.status(404).json({ error: "Item no encontrado" });
    }

    const playerId = playerItem.player_id;
    const { skill_bonus, bonus_value } = playerItem.items;

    // Actualizar el estado del item
    const { error: updateError } = await supabase
      .from("player_items")
      .update({ is_equipped: equip })
      .eq("id", player_item_id);

    if (updateError) throw updateError;

    // Actualizar skill del jugador
    const { data: skillData } = await supabase
      .from("player_skills")
      .select("id, skill_value")
      .eq("player_id", playerId)
      .eq("skill_name", skill_bonus)
      .single();

    const newValue = (skillData?.skill_value || 0) + (equip ? bonus_value : -bonus_value);

    if (skillData) {
      await supabase.from("player_skills").update({ skill_value: newValue }).eq("id", skillData.id);
    } else {
      await supabase.from("player_skills").insert({
        player_id: playerId,
        skill_name: skill_bonus,
        skill_value: newValue,
      });
    }

    res.json({ success: true, new_value: newValue });
  } catch (err) {
    console.error("❌ Error al equipar item:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
