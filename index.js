import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();

// Configuración CORS mejorada
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:5173", "http://localhost:5173", "http://localhost:5174"],
  credentials: true
}));
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:5173", "http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
    credentials: true
  },
});

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Mundo del juego
const gameWorld = {
  width: 2000,
  height: 2000,
  zones: [
    { name: "Pradera del Deporte", x: 0, y: 0, width: 800, height: 800, type: "starter" },
    { name: "Montaña del Entrenamiento", x: 800, y: 0, width: 600, height: 600, type: "training" },
    { name: "Arena de Competición", x: 0, y: 800, width: 700, height: 700, type: "arena" },
    { name: "Mercado de Habilidades", x: 1400, y: 0, width: 600, height: 1000, type: "market" },
    { name: "Bosque de Misiones", x: 800, y: 600, width: 600, height: 600, type: "quest" },
    { name: "Sala de Clubes", x: 1400, y: 1000, width: 600, height: 1000, type: "club" }
  ]
};

// Jugadores conectados y entidades del mundo
const players = new Map();
const worldEntities = new Map();
const npcs = new Map();

// Inicializar NPCs
function initializeNPCs() {
  npcs.set("entrenador_1", {
    id: "entrenador_1",
    name: "Coach Martínez",
    type: "trainer",
    x: 450,
    y: 350,
    dialog: [
      "¡Bienvenido, joven deportista!",
      "¿Listo para mejorar tus habilidades?",
      "Puedo enseñarte técnicas avanzadas."
    ],
    quests: ["mision_entrenamiento_basico"]
  });

  npcs.set("mercader_1", {
    id: "mercader_1",
    name: "Don Equipos",
    type: "merchant",
    x: 1550,
    y: 200,
    dialog: [
      "¡Los mejores equipos deportivos aquí!",
      "Cambio objetos por LupiCoins.",
      "¿Necesitas mejorar tu equipo?"
    ],
    items: ["balon_epico", "zapatillas_raras", "guantes_legendarios"]
  });

  npcs.set("misionero_1", {
    id: "misionero_1",
    name: "Guía Deportiva",
    type: "quest_giver",
    x: 950,
    y: 750,
    dialog: [
      "¡El mundo del deporte te necesita!",
      "Hay muchas misiones por completar.",
      "Demuestra tu valía en la arena."
    ],
    availableQuests: ["primeros_pasos", "entrenamiento_intenso", "competencia_amistosa"]
  });

  // Agregar más NPCs para llenar el mundo
  npcs.set("entrenador_2", {
    id: "entrenador_2",
    name: "Profesora Ana",
    type: "trainer",
    x: 1100,
    y: 200,
    dialog: [
      "¡La técnica es fundamental!",
      "Practica cada movimiento hasta la perfección.",
      "Te ayudaré a pulir tus habilidades."
    ],
    quests: ["mision_tecnica_avanzada"]
  });

  npcs.set("mercader_2", {
    id: "mercader_2",
    name: "Lupita Comerciante",
    type: "merchant",
    x: 1700,
    y: 500,
    dialog: [
      "¡Ofertas especiales hoy!",
      "Todo para el deportista moderno.",
      "¿Buscas algo en particular?"
    ],
    items: ["pelota_dorada", "uniforme_elite", "botines_velocidad"]
  });
}

// Función para crear un jugador temporal en memoria
function createTemporaryPlayer(userData, socketId) {
  const temporaryId = uuidv4();
  
  return {
    id: socketId,
    userId: temporaryId,
    username: userData.username || `Jugador_${Math.random().toString(36).substr(2, 5)}`,
    level: 1,
    position: "Novato",
    sport: "multideporte",
    experience: 0,
    lupiCoins: 100,
    x: Math.random() * 500 + 100, // Posición aleatoria en la pradera
    y: Math.random() * 500 + 100,
    color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    skills: [
      { skill_name: "velocidad", skill_value: 10 },
      { skill_name: "fuerza", skill_value: 10 },
      { skill_name: "resistencia", skill_value: 10 },
      { skill_name: "tecnica", skill_value: 10 }
    ],
    stats: {
      total_distance: 0,
      training_sessions: 0,
      puzzles_completed: 0
    },
    currentZone: "Pradera del Deporte",
    direction: "down",
    isMoving: false,
    isTemporary: true
  };
}

// Función para buscar o crear jugador en Supabase
async function findOrCreatePlayer(userData, socketId) {
  try {
    // Si no hay userId, crear jugador temporal
    if (!userData.userId) {
      console.log("🎮 Creando jugador temporal...");
      return {
        player: createTemporaryPlayer(userData, socketId),
        isTemporary: true
      };
    }

    // Verificar si el userId es un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isValidUUID = uuidRegex.test(userData.userId);

    if (!isValidUUID) {
      console.log("⚠️ ID no es UUID válido, creando jugador temporal...");
      return {
        player: createTemporaryPlayer(userData, socketId),
        isTemporary: true
      };
    }

    // Buscar usuario en Supabase
    const { data: player, error } = await supabase
      .from("players")
      .select(`
        *,
        player_stats(*),
        player_skills(*),
        player_avatars(
          avatars(*)
        )
      `)
      .eq("id", userData.userId)
      .single();

    if (error || !player) {
      console.log("⚠️ Usuario no encontrado en Supabase, creando temporal...");
      return {
        player: createTemporaryPlayer(userData, socketId),
        isTemporary: true
      };
    }

    // Usuario encontrado en Supabase
    const equippedAvatar = player.player_avatars?.find(pa => pa.is_equipped)?.avatars;
    
    const playerInfo = {
      id: socketId,
      userId: player.id,
      username: player.username,
      level: player.level,
      position: player.position,
      sport: player.sport,
      experience: player.experience,
      lupiCoins: player.lupi_coins,
      x: Math.random() * 500 + 100,
      y: Math.random() * 500 + 100,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      skills: player.player_skills || [],
      stats: player.player_stats?.[0] || {},
      avatar: equippedAvatar,
      currentZone: "Pradera del Deporte",
      direction: "down",
      isMoving: false,
      clubId: player.club_id,
      isTemporary: false
    };

    // Actualizar estado online en Supabase
    await supabase
      .from("players")
      .update({ 
        online_status: true,
        last_online: new Date().toISOString()
      })
      .eq("id", player.id);

    return {
      player: playerInfo,
      isTemporary: false
    };

  } catch (error) {
    console.error("❌ Error en findOrCreatePlayer:", error);
    throw error;
  }
}

// Función para detectar zona
function detectZone(x, y) {
  const zone = gameWorld.zones.find(z => 
    x >= z.x && x <= z.x + z.width && 
    y >= z.y && y <= z.y + z.height
  );
  return zone ? zone.name : "Territorio Desconocido";
}

// Función para obtener socket ID por player ID
function getSocketIdByPlayerId(userId) {
  for (let [socketId, player] of players.entries()) {
    if (player.userId === userId) return socketId;
  }
  return null;
}

// Función para broadcast de jugadores
function broadcastPlayers() {
  const playersArray = Array.from(players.values()).map(p => ({
    id: p.id,
    userId: p.userId,
    username: p.username,
    level: p.level,
    position: p.position,
    x: p.x,
    y: p.y,
    color: p.color,
    direction: p.direction,
    isMoving: p.isMoving,
    currentZone: p.currentZone,
    isTemporary: p.isTemporary
  }));
  
  io.emit("playersList", playersArray);
}

// Función para broadcast de entidades del mundo
function broadcastWorldEntities() {
  const entitiesArray = Array.from(worldEntities.values());
  io.emit("worldEntities", entitiesArray);
}

// Manejo de entrenamiento
async function handleTraining(socket, player, actionData) {
  // Simular entrenamiento y ganar experiencia
  const xpGained = Math.floor(Math.random() * 50) + 25;
  const newExperience = player.experience + xpGained;
  
  // Calcular nuevo nivel
  const newLevel = Math.floor(newExperience / 1000) + 1;
  const leveledUp = newLevel > player.level;

  // Actualizar en memoria
  player.experience = newExperience;
  if (leveledUp) {
    player.level = newLevel;
    
    // Otorgar recompensas por subir de nivel
    player.lupiCoins += 100;
    player.skillPoints = (player.skillPoints || 0) + 5;
  }

  // Actualizar en Supabase solo si no es temporal
  if (!player.isTemporary) {
    await supabase
      .from("players")
      .update({
        experience: newExperience,
        level: newLevel,
        lupi_coins: player.lupiCoins
      })
      .eq("id", player.userId);

    // Actualizar stats de entrenamiento
    await supabase
      .from("player_stats")
      .update({
        training_sessions: (player.stats.training_sessions || 0) + 1
      })
      .eq("player_id", player.userId);
  }

  socket.emit("trainingResult", {
    xpGained,
    newExperience,
    leveledUp,
    newLevel,
    rewards: leveledUp ? { lupiCoins: 100, skillPoints: 5 } : null
  });

  if (leveledUp) {
    socket.broadcast.emit("playerLevelUp", {
      username: player.username,
      newLevel: newLevel
    });
  }
}

// Manejo de misiones
async function handleQuest(socket, player, actionData) {
  // Simular completar misión
  const questReward = {
    xp: 100,
    lupiCoins: 50,
    items: ["poción_energía"]
  };

  player.experience += questReward.xp;
  player.lupiCoins += questReward.lupiCoins;

  socket.emit("questCompleted", {
    questId: actionData.questId,
    rewards: questReward
  });
}

// Manejo de comercio
async function handleTrade(socket, player, actionData) {
  // Simular transacción
  const tradeResult = {
    success: true,
    item: actionData.item,
    cost: actionData.cost,
    message: `¡Has adquirido ${actionData.item}!`
  };

  if (player.lupiCoins >= actionData.cost) {
    player.lupiCoins -= actionData.cost;
    socket.emit("tradeResult", tradeResult);
  } else {
    socket.emit("tradeResult", {
      success: false,
      message: "No tienes suficientes LupiCoins"
    });
  }
}

// Manejo de acciones sociales
async function handleSocialAction(socket, player, actionData) {
  // Emotes y acciones sociales
  socket.broadcast.emit("playerSocialAction", {
    playerId: socket.id,
    username: player.username,
    action: actionData.action,
    emotion: actionData.emotion
  });
}

// Manejo de comandos del chat
async function handleChatCommand(socket, player, command) {
  const args = command.slice(1).split(" ");
  const cmd = args[0].toLowerCase();

  switch (cmd) {
    case "stats":
      const status = player.isTemporary ? " (Jugador Temporal)" : "";
      socket.emit("chatMessage", {
        user: "Sistema",
        message: `Tus estadísticas: Nivel ${player.level}, EXP: ${player.experience}, LupiCoins: ${player.lupiCoins}${status}`,
        timestamp: new Date().toLocaleTimeString(),
        level: 0,
        isSystem: true
      });
      break;

    case "emote":
      const emote = args[1] || "saluda";
      socket.broadcast.emit("playerEmote", {
        playerId: socket.id,
        emote: emote,
        username: player.username
      });
      break;

    case "help":
      socket.emit("chatMessage", {
        user: "Sistema",
        message: "Comandos disponibles: /stats, /emote [acción], /help, /players, /zone",
        timestamp: new Date().toLocaleTimeString(),
        level: 0,
        isSystem: true
      });
      break;

    case "players":
      const playerCount = players.size;
      socket.emit("chatMessage", {
        user: "Sistema",
        message: `Jugadores en línea: ${playerCount}`,
        timestamp: new Date().toLocaleTimeString(),
        level: 0,
        isSystem: true
      });
      break;

    case "zone":
      socket.emit("chatMessage", {
        user: "Sistema",
        message: `Estás en: ${player.currentZone}`,
        timestamp: new Date().toLocaleTimeString(),
        level: 0,
        isSystem: true
      });
      break;

    case "pos":
      socket.emit("chatMessage", {
        user: "Sistema",
        message: `Posición: X=${Math.round(player.x)}, Y=${Math.round(player.y)}`,
        timestamp: new Date().toLocaleTimeString(),
        level: 0,
        isSystem: true
      });
      break;

    default:
      socket.emit("chatMessage", {
        user: "Sistema",
        message: "Comando no reconocido. Usa /help para ayuda.",
        timestamp: new Date().toLocaleTimeString(),
        level: 0,
        isSystem: true
      });
  }
}

// SOCKET.IO CONNECTION HANDLER
io.on("connection", (socket) => {
  console.log("🔌 Nueva conexión:", socket.id);

  // Autenticación para MMORPG
  socket.on("joinGame", async (userData) => {
    try {
      console.log("🎮 Usuario intentando unirse al MMORPG:", userData);

      const { player: playerInfo, isTemporary } = await findOrCreatePlayer(userData, socket.id);

      // Guardar en memoria
      players.set(socket.id, playerInfo);

      // Enviar información del mundo
      socket.emit("gameWorld", gameWorld);
      socket.emit("npcsList", Array.from(npcs.values()));
      
      // Enviar confirmación con datos completos
      socket.emit("joinSuccess", playerInfo);

      // Enviar lista actualizada a todos
      broadcastPlayers();
      broadcastWorldEntities();

      console.log(`✅ ${playerInfo.username} se unió al MMORPG. ${isTemporary ? '(Temporal)' : '(Supabase)'} Nivel ${playerInfo.level}. Total: ${players.size}`);

    } catch (error) {
      console.error("❌ Error en joinGame:", error);
      socket.emit("joinError", { error: "Error del servidor al unirse al juego" });
    }
  });

  // Movimiento del jugador
  socket.on("move", async (data) => {
    const player = players.get(socket.id);
    if (!player) return;

    // Actualizar posición y dirección
    player.x = data.x;
    player.y = data.y;
    player.direction = data.direction || player.direction;
    player.isMoving = data.isMoving || false;

    // Detectar cambio de zona
    const newZone = detectZone(data.x, data.y);
    if (newZone !== player.currentZone) {
      player.currentZone = newZone;
      socket.emit("zoneChanged", { zone: newZone });
      console.log(`🗺️ ${player.username} entró en: ${newZone}`);
    }

    // Actualizar en Supabase solo si no es temporal (cada 10 movimientos para no saturar)
    if (!player.isTemporary && Math.random() < 0.1) {
      await supabase
        .from("player_stats")
        .update({ 
          total_distance: (player.stats.total_distance || 0) + 1 
        })
        .eq("player_id", player.userId);
    }

    // Notificar a otros jugadores
    socket.broadcast.emit("playerMoved", {
      id: socket.id,
      x: data.x,
      y: data.y,
      direction: player.direction,
      isMoving: player.isMoving
    });
  });

  // Interacción con NPCs
  socket.on("interactWithNPC", (data) => {
    const player = players.get(socket.id);
    const npc = npcs.get(data.npcId);
    
    if (!player || !npc) return;

    console.log(`🤝 ${player.username} interactúa con ${npc.name}`);

    // Calcular distancia
    const distance = Math.sqrt(
      Math.pow(player.x - npc.x, 2) + Math.pow(player.y - npc.y, 2)
    );

    if (distance > 100) {
      socket.emit("interactionError", { error: "Demasiado lejos para interactuar" });
      return;
    }

    // Enviar diálogo del NPC
    socket.emit("npcDialog", {
      npcId: npc.id,
      npcName: npc.name,
      dialog: npc.dialog,
      type: npc.type,
      quests: npc.quests || npc.availableQuests || [],
      items: npc.items || []
    });
  });

  // Chat de mundo con comandos
  socket.on("chatMessage", async (messageData) => {
    const player = players.get(socket.id);
    if (!player || !messageData.message.trim()) return;

    const message = messageData.message.trim();

    // Comandos del chat
    if (message.startsWith("/")) {
      handleChatCommand(socket, player, message);
      return;
    }

    const chatData = {
      user: player.username,
      message: message,
      timestamp: new Date().toLocaleTimeString(),
      level: player.level,
      position: player.position,
      zone: player.currentZone
    };

    console.log(`💬 [${player.currentZone}] ${player.username} (Nvl ${player.level}): ${message}`);

    // Enviar a todos los jugadores
    io.emit("chatMessage", chatData);

    // Guardar en Supabase solo si no es temporal
    if (!player.isTemporary) {
      await supabase
        .from("room_messages")
        .insert([{
          user_id: player.userId,
          username: player.username,
          content: message,
          room_id: player.currentZone
        }]);
    }
  });

  // Realizar acciones (entrenar, competir, etc.)
  socket.on("playerAction", async (actionData) => {
    const player = players.get(socket.id);
    if (!player) return;

    console.log(`🎯 ${player.username} realiza acción:`, actionData.type);

    switch (actionData.type) {
      case "train":
        await handleTraining(socket, player, actionData);
        break;
      case "quest":
        await handleQuest(socket, player, actionData);
        break;
      case "trade":
        await handleTrade(socket, player, actionData);
        break;
      case "social":
        await handleSocialAction(socket, player, actionData);
        break;
      default:
        console.log(`❌ Acción desconocida: ${actionData.type}`);
    }
  });

  // Emotes y acciones sociales
  socket.on("playerEmote", (data) => {
    const player = players.get(socket.id);
    if (!player) return;

    socket.broadcast.emit("playerEmote", {
      playerId: socket.id,
      username: player.username,
      emote: data.emote
    });
  });

  // Ping para mantener conexión
  socket.on("ping", () => {
    socket.emit("pong", { timestamp: Date.now() });
  });

  // Desconexión
  socket.on("disconnect", async () => {
    const player = players.get(socket.id);
    if (player) {
      console.log("❌ Desconectado:", player.username);
      
      // Actualizar estado en Supabase solo si no es temporal
      if (!player.isTemporary) {
        await supabase
          .from("players")
          .update({ 
            online_status: false,
            last_online: new Date().toISOString()
          })
          .eq("id", player.userId);
      }

      players.delete(socket.id);
      broadcastPlayers();
      console.log(`👥 Jugadores restantes: ${players.size}`);
    }
  });
});

// RUTAS DE API PARA EL MMORPG

// Health check
app.get("/api/health", (req, res) => {
  const temporaryPlayers = Array.from(players.values()).filter(p => p.isTemporary).length;
  const supabasePlayers = Array.from(players.values()).filter(p => !p.isTemporary).length;
  
  res.json({ 
    status: "OK", 
    message: "Servidor MMORPG funcionando",
    players: {
      total: players.size,
      temporary: temporaryPlayers,
      supabase: supabasePlayers
    },
    world: {
      name: "Deportes MMORPG",
      zones: gameWorld.zones.length,
      npcs: npcs.size
    },
    timestamp: new Date().toISOString()
  });
});

// Información del mundo
app.get("/api/world/players", (req, res) => {
  const playersArray = Array.from(players.values());
  res.json({
    totalPlayers: players.size,
    players: playersArray,
    onlineByZone: getPlayersByZone()
  });
});

app.get("/api/world/npcs", (req, res) => {
  res.json(Array.from(npcs.values()));
});

app.get("/api/world/zones", (req, res) => {
  res.json(gameWorld.zones);
});

// Estadísticas del servidor
app.get("/api/stats", (req, res) => {
  const zonesWithPlayers = {};
  gameWorld.zones.forEach(zone => {
    zonesWithPlayers[zone.name] = Array.from(players.values()).filter(p => p.currentZone === zone.name).length;
  });

  res.json({
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      connections: players.size
    },
    world: {
      zones: zonesWithPlayers,
      totalNPCs: npcs.size
    },
    players: {
      byLevel: getPlayersByLevel(),
      temporary: Array.from(players.values()).filter(p => p.isTemporary).length
    }
  });
});

// Funciones auxiliares
function getPlayersByZone() {
  const zones = {};
  players.forEach(player => {
    zones[player.currentZone] = (zones[player.currentZone] || 0) + 1;
  });
  return zones;
}

function getPlayersByLevel() {
  const levels = {};
  players.forEach(player => {
    levels[player.level] = (levels[player.level] || 0) + 1;
  });
  return levels;
}

// Inicializar el mundo
initializeNPCs();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor MMORPG corriendo en http://localhost:${PORT}`);
  console.log(`🗺️ Mundo inicializado con ${gameWorld.zones.length} zonas y ${npcs.size} NPCs`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`👥 Info del mundo: http://localhost:${PORT}/api/world/players`);
  console.log(`📊 Estadísticas: http://localhost:${PORT}/api/stats`);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
});