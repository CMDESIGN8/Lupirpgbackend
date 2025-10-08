import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Cambia a tu frontend si querés restringir
    methods: ["GET", "POST"],
  },
});

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const PORT = process.env.PORT || 10000;

// Jugadores conectados en memoria
let players = {};

// Ruta de test
app.get("/", (req, res) => {
  res.send("LupiRPG Backend conectado a Supabase ✅");
});

// SOCKET.IO
io.on("connection", (socket) => {
  console.log(`🔌 Nuevo jugador conectado: ${socket.id}`);

  /**
   * Un jugador entra en el juego
   */
  socket.on("newPlayer", async ({ userId, username, x, y, avatar_url }) => {
    // Guardamos en Supabase (upsert → inserta si no existe, actualiza si existe)
    const { data, error } = await supabase
      .from("room_players")
      .upsert({
        user_id: userId,
        username,
        avatar_url,
        x,
        y,
        last_activity: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Error en Supabase:", error.message);
    }

    // Guardamos también en memoria
    players[socket.id] = {
      id: socket.id,
      userId,
      username,
      avatar_url,
      x,
      y,
    };

    console.log("✅ Jugador conectado:", players[socket.id]);

    io.emit("updatePlayers", players);
  });

  /**
   * Movimiento
   */
  socket.on("move", async ({ x, y }) => {
    if (players[socket.id]) {
      players[socket.id].x = x;
      players[socket.id].y = y;

      // Persistir en Supabase
      await supabase
        .from("room_players")
        .update({
          x,
          y,
          last_activity: new Date().toISOString(),
        })
        .eq("user_id", players[socket.id].userId);

      io.emit("updatePlayers", players);
    }
  });

  /**
   * Chat
   */
  socket.on("chatMessage", async (msg) => {
    if (players[socket.id]) {
      const message = {
        user: players[socket.id].username,
        message: msg,
      };

      // Guardar en DB
      await supabase.from("room_messages").insert({
        user_id: players[socket.id].userId,
        username: players[socket.id].username,
        content: msg,
        room_id: "main_lobby",
      });

      io.emit("chatMessage", message);
    }
  });

  /**
   * Desconexión
   */
  socket.on("disconnect", async () => {
    console.log(`❌ Jugador desconectado: ${socket.id}`);

    if (players[socket.id]) {
      // Marcar offline en Supabase
      await supabase
        .from("room_players")
        .delete()
        .eq("user_id", players[socket.id].userId);

      delete players[socket.id];
      io.emit("updatePlayers", players);
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Servidor MMORPG corriendo en puerto ${PORT}`);
});
