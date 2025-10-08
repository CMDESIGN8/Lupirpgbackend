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
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ✅ CONFIGURACIÓN CORRECTA DE SUPABASE - USANDO SERVICE ROLE KEY
const supabase = createClient(
  "https://xvdevkrgsgiiqqhfnnut.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGV2a3Jnc2dpaXFxaGZubnV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTczMzAwNCwiZXhwIjoyMDcxMzA5MDA0fQ.zE369eugKYtjIm6kw4Ecz77XpddfyIPr-dNoCQwaJh4"
);

const PORT = process.env.PORT || 5000;

// Jugadores conectados en memoria
let players = {};

// Middleware para permitir CORS y JSON
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Ruta de test de Supabase
app.get("/test-supabase", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("room_players")
      .select("*")
      .limit(5);

    if (error) {
      return res.status(500).json({ 
        error: "Error conectando a Supabase", 
        details: error.message 
      });
    }

    res.json({
      message: "✅ Conexión a Supabase exitosa",
      players: data,
      total: data ? data.length : 0
    });
  } catch (error) {
    res.status(500).json({ 
      error: "Error interno del servidor", 
      details: error.message 
    });
  }
});

// Ruta para obtener todos los jugadores
app.get("/players", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("room_players")
      .select("*");

    if (error) throw error;

    res.json({
      success: true,
      players: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Ruta para obtener mensajes del chat
app.get("/messages", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("room_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({
      success: true,
      messages: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Ruta principal
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 LupiRPG Backend conectado a Supabase ✅",
    supabase: "Conectado correctamente",
    players_online: Object.keys(players).length
  });
});

// SOCKET.IO
io.on("connection", (socket) => {
  console.log(`🔌 Nuevo jugador conectado: ${socket.id}`);

  /**
   * Un jugador entra en el juego
   */
  socket.on("newPlayer", async ({ userId, username, x, y, avatar_url }) => {
    try {
      console.log(`🎮 Nuevo jugador: ${username} (${userId})`);

      // Guardamos en Supabase
      const { data, error } = await supabase
        .from("room_players")
        .upsert({
          user_id: userId,
          username: username,
          avatar_url: avatar_url || "default_avatar.png",
          x: x || 100,
          y: y || 100,
          last_activity: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("❌ Error en Supabase (newPlayer):", error.message);
        socket.emit("error", { message: "Error al conectar jugador" });
        return;
      }

      // Guardamos también en memoria
      players[socket.id] = {
        id: socket.id,
        userId: userId,
        username: username,
        avatar_url: avatar_url || "default_avatar.png",
        x: x || 100,
        y: y || 100,
        supabase_data: data
      };

      console.log(`✅ Jugador ${username} guardado en Supabase`);
      
      // Emitir a todos los clientes
      io.emit("updatePlayers", players);
      io.emit("playerJoined", { 
        player: players[socket.id],
        totalPlayers: Object.keys(players).length 
      });

    } catch (error) {
      console.error("❌ Error en newPlayer:", error);
      socket.emit("error", { message: "Error interno del servidor" });
    }
  });

  /**
   * Movimiento del jugador
   */
  socket.on("move", async ({ x, y }) => {
    try {
      if (players[socket.id]) {
        // Actualizar en memoria
        players[socket.id].x = x;
        players[socket.id].y = y;

        // Persistir en Supabase
        const { error } = await supabase
          .from("room_players")
          .update({
            x: x,
            y: y,
            last_activity: new Date().toISOString(),
          })
          .eq("user_id", players[socket.id].userId);

        if (error) {
          console.error("❌ Error en Supabase (move):", error.message);
          return;
        }

        // Emitir a todos los clientes excepto al que se movió
        socket.broadcast.emit("playerMoved", {
          playerId: socket.id,
          x: x,
          y: y
        });
      }
    } catch (error) {
      console.error("❌ Error en move:", error);
    }
  });

  /**
   * Mensaje de chat
   */
  socket.on("chatMessage", async (msg) => {
    try {
      if (players[socket.id]) {
        const messageData = {
          user: players[socket.id].username,
          message: msg,
          userId: players[socket.id].userId,
          timestamp: new Date().toISOString()
        };

        // Guardar en Supabase
        const { error } = await supabase
          .from("room_messages")
          .insert({
            user_id: players[socket.id].userId,
            username: players[socket.id].username,
            content: msg,
            room_id: "main_lobby",
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error("❌ Error en Supabase (chatMessage):", error.message);
          return;
        }

        // Emitir a todos los clientes
        io.emit("chatMessage", messageData);
        console.log(`💬 Chat: ${players[socket.id].username}: ${msg}`);
      }
    } catch (error) {
      console.error("❌ Error en chatMessage:", error);
    }
  });

  /**
   * Desconexión del jugador
   */
  socket.on("disconnect", async () => {
    try {
      console.log(`❌ Jugador desconectado: ${socket.id}`);

      if (players[socket.id]) {
        const playerName = players[socket.id].username;
        
        // Eliminar de Supabase
        const { error } = await supabase
          .from("room_players")
          .delete()
          .eq("user_id", players[socket.id].userId);

        if (error) {
          console.error("❌ Error en Supabase (disconnect):", error.message);
        }

        // Eliminar de memoria y notificar
        delete players[socket.id];
        
        io.emit("playerLeft", { 
          playerId: socket.id, 
          playerName: playerName,
          totalPlayers: Object.keys(players).length 
        });
        
        io.emit("updatePlayers", players);
        
        console.log(`👋 Jugador ${playerName} eliminado de la sala`);
      }
    } catch (error) {
      console.error("❌ Error en disconnect:", error);
    }
  });

  /**
   * Ping para mantener conexión
   */
  socket.on("ping", () => {
    socket.emit("pong", { timestamp: new Date().toISOString() });
  });
});

// Manejo de errores global
process.on("uncaughtException", (error) => {
  console.error("🔥 Error no capturado:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 Promise rechazada no manejada:", reason);
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🎮 Servidor LupiRPG corriendo en puerto ${PORT}`);
  console.log(`🔗 Supabase: Conectado correctamente`);
  console.log(`📊 Ruta de test: http://localhost:${PORT}/test-supabase`);
});
