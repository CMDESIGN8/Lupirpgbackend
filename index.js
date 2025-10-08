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

// ✅ CONFIGURACIÓN CORRECTA DE SUPABASE
const supabase = createClient(
  "https://xvdevkrgsgiiqqhfnnut.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGV2a3Jnc2dpaXFxaGZubnV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTczMzAwNCwiZXhwIjoyMDcxMzA5MDA0fQ.zE369eugKYtjIm6kw4Ecz77XpddfyIPr-dNoCQwaJh4"
);

const PORT = process.env.PORT || 5000;

// Jugadores conectados en memoria
let players = {};

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// ==================== RUTAS DE INVENTARIO ====================

// Obtener inventario de un jugador
app.get("/api/inventory/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    
    console.log(`📦 Solicitando inventario para usuario: ${user_id}`);

    const { data: inventory, error } = await supabase
      .from("player_items")
      .select(`
        *,
        items (*)
      `)
      .eq("player_id", user_id);

    if (error) {
      console.error("❌ Error obteniendo inventario:", error.message);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    console.log(`✅ Inventario encontrado: ${inventory ? inventory.length : 0} items`);
    
    res.json({
      success: true,
      inventory: inventory || []
    });

  } catch (error) {
    console.error("❌ Error en /api/inventory:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener todos los items disponibles
app.get("/api/items", async (req, res) => {
  try {
    const { data: items, error } = await supabase
      .from("items")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      items: items || []
    });
  } catch (error) {
    console.error("❌ Error obteniendo items:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Agregar item al inventario
app.post("/api/inventory/add", async (req, res) => {
  try {
    const { player_id, item_id, is_equipped = false } = req.body;

    console.log(`🎁 Agregando item ${item_id} al jugador ${player_id}`);

    const { data, error } = await supabase
      .from("player_items")
      .insert({
        player_id: player_id,
        item_id: item_id,
        is_equipped: is_equipped
      })
      .select(`
        *,
        items (*)
      `)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: "Item agregado al inventario",
      item: data
    });

  } catch (error) {
    console.error("❌ Error agregando item:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Equipar/Desequipar item
app.put("/api/inventory/equip", async (req, res) => {
  try {
    const { player_item_id, equip } = req.body;

    const { data, error } = await supabase
      .from("player_items")
      .update({ 
        is_equipped: equip 
      })
      .eq("id", player_item_id)
      .select(`
        *,
        items (*)
      `)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: equip ? "Item equipado" : "Item desequipado",
      item: data
    });

  } catch (error) {
    console.error("❌ Error equipando item:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== RUTAS DE PLAYER ====================

// Obtener datos del jugador
app.get("/api/player/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const { data: player, error } = await supabase
      .from("players")
      .select(`
        *,
        player_stats (*),
        player_skills (*)
      `)
      .eq("id", user_id)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      player: player
    });

  } catch (error) {
    console.error("❌ Error obteniendo jugador:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener avatares del jugador
app.get("/api/player/:user_id/avatars", async (req, res) => {
  try {
    const { user_id } = req.params;

    const { data: avatars, error } = await supabase
      .from("player_avatars")
      .select(`
        *,
        avatars (*)
      `)
      .eq("player_id", user_id);

    if (error) throw error;

    res.json({
      success: true,
      avatars: avatars || []
    });

  } catch (error) {
    console.error("❌ Error obteniendo avatares:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== RUTAS DE MISIONES ====================

// Obtener misiones del jugador
app.get("/api/player/:user_id/missions", async (req, res) => {
  try {
    const { user_id } = req.params;

    const { data: missions, error } = await supabase
      .from("player_missions")
      .select(`
        *,
        missions (*)
      `)
      .eq("player_id", user_id);

    if (error) throw error;

    res.json({
      success: true,
      missions: missions || []
    });

  } catch (error) {
    console.error("❌ Error obteniendo misiones:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener todas las misiones disponibles
app.get("/api/missions", async (req, res) => {
  try {
    const { data: missions, error } = await supabase
      .from("missions")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      missions: missions || []
    });

  } catch (error) {
    console.error("❌ Error obteniendo misiones:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== RUTAS DE CLUB ====================

// Obtener club del jugador
app.get("/api/player/:user_id/club", async (req, res) => {
  try {
    const { user_id } = req.params;

    // Primero obtener el jugador con su club_id
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("club_id")
      .eq("id", user_id)
      .single();

    if (playerError) throw playerError;

    if (!player.club_id) {
      return res.json({
        success: true,
        club: null
      });
    }

    // Obtener datos del club
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select(`
        *,
        club_missions (*),
        club_messages (*)
      `)
      .eq("id", player.club_id)
      .single();

    if (clubError) throw clubError;

    res.json({
      success: true,
      club: club
    });

  } catch (error) {
    console.error("❌ Error obteniendo club:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== RUTAS EXISTENTES ====================

app.get("/test-supabase", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("players")
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

app.get("/players", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("players")
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

app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 LupiRPG Backend conectado a Supabase ✅",
    supabase: "Conectado correctamente",
    players_online: Object.keys(players).length,
    endpoints: {
      inventory: "/api/inventory/:user_id",
      items: "/api/items",
      add_item: "/api/inventory/add",
      equip_item: "/api/inventory/equip",
      player: "/api/player/:user_id",
      avatars: "/api/player/:user_id/avatars",
      missions: "/api/player/:user_id/missions",
      all_missions: "/api/missions",
      club: "/api/player/:user_id/club"
    }
  });
});

// ==================== SOCKET.IO ====================

io.on("connection", (socket) => {
  console.log(`🔌 Nuevo jugador conectado: ${socket.id}`);

  socket.on("newPlayer", async ({ userId, username, x, y, avatar_url }) => {
    try {
      console.log(`🎮 Nuevo jugador: ${username} (${userId})`);

      // Usar room_players para la sala (como en tu schema)
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

      // Actualizar también en room_users si existe
      await supabase
        .from("room_users")
        .upsert({
          user_id: userId,
          name: username,
          avatar_url: avatar_url || "default_avatar.png",
          x: x || 100,
          y: y || 100,
          is_online: true,
          last_activity: new Date().toISOString(),
          connection_id: socket.id
        });

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

  socket.on("move", async ({ x, y }) => {
    try {
      if (players[socket.id]) {
        players[socket.id].x = x;
        players[socket.id].y = y;

        const { error } = await supabase
          .from("room_players")
          .update({
            x: x,
            y: y,
            last_activity: new Date().toISOString(),
          })
          .eq("user_id", players[socket.id].userId);

        // Actualizar también en room_users
        await supabase
          .from("room_users")
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

  socket.on("chatMessage", async (msg) => {
    try {
      if (players[socket.id]) {
        const messageData = {
          user: players[socket.id].username,
          message: msg,
          userId: players[socket.id].userId,
          timestamp: new Date().toISOString()
        };

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

        io.emit("chatMessage", messageData);
        console.log(`💬 Chat: ${players[socket.id].username}: ${msg}`);
      }
    } catch (error) {
      console.error("❌ Error en chatMessage:", error);
    }
  });

  socket.on("disconnect", async () => {
    try {
      console.log(`❌ Jugador desconectado: ${socket.id}`);

      if (players[socket.id]) {
        const playerName = players[socket.id].username;
        
        // Marcar como offline en room_players
        const { error } = await supabase
          .from("room_players")
          .delete()
          .eq("user_id", players[socket.id].userId);

        // Marcar como offline en room_users
        await supabase
          .from("room_users")
          .update({
            is_online: false,
            last_activity: new Date().toISOString()
          })
          .eq("user_id", players[socket.id].userId);

        if (error) {
          console.error("❌ Error en Supabase (disconnect):", error.message);
        }

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

  socket.on("ping", () => {
    socket.emit("pong", { timestamp: new Date().toISOString() });
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🎮 Servidor LupiRPG corriendo en puerto ${PORT}`);
  console.log(`🔗 Supabase: Conectado correctamente`);
  console.log(`📦 Sistema de inventario ACTIVO`);
  console.log(`🎯 Sistema de misiones ACTIVO`);
  console.log(`🏆 Sistema de clubes ACTIVO`);
  console.log(`📊 Ruta de test: http://localhost:${PORT}/test-supabase`);
  console.log(`🎒 Ejemplo inventario: http://localhost:${PORT}/api/inventory/TU_USER_ID`);
});
