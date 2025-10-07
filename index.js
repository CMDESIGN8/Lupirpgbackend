import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./services/supabase.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// RUTA DE PRUEBA
app.get("/", (req, res) => {
  res.send("MMORPG Backend funcionando con Supabase + Socket.IO 🚀");
});

/**
 * SOCKET.IO LOGIC
 * Manejamos jugadores, movimientos, chat en tiempo real
 */
let players = {}; // jugadores online en memoria

io.on("connection", (socket) => {
  console.log(`Jugador conectado: ${socket.id}`);

  // Nuevo jugador entra
  socket.on("newPlayer", async ({ userId, x, y }) => {
    // Leemos datos del jugador desde Supabase
    const { data, error } = await supabase
      .from("socios")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error al leer Supabase:", error.message);
      return;
    }

    players[socket.id] = {
      id: socket.id,
      userId: data.id,
      name: data.nombre || "Jugador",
      x,
      y
    };

    io.emit("updatePlayers", players);
  });

  // Movimiento
  socket.on("move", ({ x, y }) => {
    if (players[socket.id]) {
      players[socket.id].x = x;
      players[socket.id].y = y;
      io.emit("updatePlayers", players);
    }
  });

  // Chat
  socket.on("chatMessage", (msg) => {
    const player = players[socket.id];
    io.emit("chatMessage", {
      user: player?.name || "Anónimo",
      message: msg
    });
  });

  // Desconexión
  socket.on("disconnect", () => {
    console.log(`Jugador desconectado: ${socket.id}`);
    delete players[socket.id];
    io.emit("updatePlayers", players);
  });
});

// PORT
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Servidor MMORPG corriendo en puerto ${PORT}`);
});
