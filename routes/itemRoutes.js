import express from "express";
import { supabase } from "../db.js";

const router = express.Router();

/**
 * 🔹 GET /api/items
 * Obtiene todos los ítems disponibles en la base de datos.
 */
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("❌ Error al obtener ítems:", error.message);
    return res.status(400).json({ error: error.message });
  }

  res.json(data);
});

/**
 * 🔹 GET /api/items/:id
 * Obtiene un ítem específico por su ID.
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("❌ Error al obtener ítem:", error.message);
    return res.status(400).json({ error: error.message });
  }

  res.json(data);
});

/**
 * 🔹 POST /api/items
 * Crea un nuevo ítem (solo si querés poder agregar desde panel admin).
 */
router.post("/", async (req, res) => {
  const { name, skill_bonus, bonus_value } = req.body;

  if (!name || !skill_bonus || !bonus_value) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  const { data, error } = await supabase
    .from("items")
    .insert([{ name, skill_bonus, bonus_value }])
    .select();

  if (error) {
    console.error("❌ Error al crear ítem:", error.message);
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json(data[0]);
});

/**
 * 🔹 PUT /api/items/:id
 * Actualiza un ítem existente.
 */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, skill_bonus, bonus_value } = req.body;

  const { data, error } = await supabase
    .from("items")
    .update({ name, skill_bonus, bonus_value })
    .eq("id", id)
    .select();

  if (error) {
    console.error("❌ Error al actualizar ítem:", error.message);
    return res.status(400).json({ error: error.message });
  }

  res.json(data[0]);
});

/**
 * 🔹 DELETE /api/items/:id
 * Elimina un ítem por ID.
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.from("items").delete().eq("id", id);

  if (error) {
    console.error("❌ Error al eliminar ítem:", error.message);
    return res.status(400).json({ error: error.message });
  }

  res.json({ success: true });
});

// 👇 importante para ES Modules
export default router;
