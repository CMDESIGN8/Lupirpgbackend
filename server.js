import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import playerRoutes from "./routes/playerRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import missionRoutes from "./routes/missionRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";
import playerItemsRoutes from "./routes/playerItemsRoutes.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("✅ LupiApp Backend activo con Supabase"));

app.use("/api/player", playerRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/missions", missionRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/inventory", playerItemsRoutes);

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
