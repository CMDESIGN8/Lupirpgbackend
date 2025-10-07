import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);

// ⚡ Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // puedes restringirlo a tu dominio de React
    methods: ["GET", "POST"],
  },
});

// 🔑 Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Puerto dinámico para Render
const PORT = process.env.PORT || 10000;

// Almacén temporal de jugadores conectados
let players = {};

// 🚀 Rutas básicas
app.get("/", (req, res) => {
  res.send("LupiRPG Backend corriendo ✅");
});

// 🕹️ Eventos Socket.IO
io.on("connection", (socket) => {
  console.log(`🔌 Nuevo jugador conectado: ${socket.id}`);

  // Nuevo jugador
  socket.on("newPlayer", async (data) => {
    const { userId, x, y } = data;

    // Leer datos del usuario desde Supabase
    const { data: user, error } = await supabase
      .from("socios")
      .select("id, nombre")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("❌ Error leyendo Supabase:", error.message);
    }

    players[socket.id] = {
      id: socket.id,
      userId,
      name: user?.nombre || "Jugador",
      x,
      y,
    };

    console.log("✅ Jugador agregado:", players[socket.id]);

    io.emit("updatePlayers", players);
  });

  // Movimiento
  socket.on("move", (pos) => {
    if (players[socket.id]) {
      players[socket.id].x = pos.x;
      players[socket.id].y = pos.y;
      io.emit("updatePlayers", players);
    }
  });

  // Chat
  socket.on("chatMessage", (msg) => {
    if (players[socket.id]) {
      const message = {
        user: players[socket.id].name,
        message: msg,
      };
      io.emit("chatMessage", message);
    }
  });

  // Desconexión
  socket.on("disconnect", () => {
    console.log(`❌ Jugador desconectado: ${socket.id}`);
    delete players[socket.id];
    io.emit("updatePlayers", players);
  });
});

// 🚀 Iniciar servidor
server.listen(PORT, () => {
  console.log(`Servidor MMORPG corriendo en puerto ${PORT}`);
});
