// Supabase client is injected via setSupabaseClient() before use
let _supabaseClient = null;

/**
 * Set the Supabase client for multiplayer functionality
 * Must be called before createMultiplayerManager()
 * @param {object} client - Supabase client instance
 */
export function setSupabaseClient(client) {
  _supabaseClient = client;
}

const BROADCAST_THROTTLE_MS = 50; // Send position updates every 50ms (20 updates/sec)

// Fun animal-based name generator
const ADJECTIVES = ["Happy", "Sleepy", "Fluffy", "Bouncy", "Cozy", "Dizzy", "Fuzzy", "Jolly", "Lucky", "Peppy", "Silly", "Snuggly", "Speedy", "Sparkly", "Wiggly", "Zippy"];
const ANIMALS = ["Bunny", "Fox", "Bear", "Panda", "Koala", "Otter", "Penguin", "Owl", "Cat", "Dog", "Duck", "Frog", "Hamster", "Hedgehog", "Raccoon", "Squirrel"];

// Player colors for name tags
const PLAYER_COLORS = [
  "#ff6b6b", "#4ecdc4", "#ffe66d", "#95e1d3", "#f38181",
  "#aa96da", "#fcbad3", "#a8d8ea", "#ffb347", "#98d8c8"
];

/**
 * Multiplayer manager for the bunny game.
 * Uses Supabase Realtime for player synchronization.
 * Presence is the source of truth for connected players.
 *
 * @param {string} worldId - The world ID to connect to (defaults to 'portal')
 */
export function createMultiplayerManager(worldId = 'portal') {
  if (!_supabaseClient) {
    throw new Error('Supabase client not set. Call setSupabaseClient() first.');
  }
  const supabase = _supabaseClient;
  const ROOM_ID = worldId;
  const CHANNEL_NAME = `game_room_${worldId}`;

  let channel = null;
  let playerId = null;
  let playerName = null;
  let playerColor = null;
  let playerAccessories = []; // Array of accessory IDs like ["sunglasses", "topHat"]
  let isHost = false;
  let worldSeed = null;
  let lastBroadcastTime = 0;
  let currentWorldId = worldId;

  // Callbacks set by the game
  let onPlayerJoin = null;
  let onPlayerLeave = null;
  let onPlayerMove = null;
  let onPlayerPresenceUpdate = null; // Called when existing player's presence changes (e.g., color)
  let onWorldSeedReceived = null;
  let onChatMessage = null;
  let onPing = null;
  let onTeleportRequest = null;
  let onTeleportResponse = null;

  /**
   * Generate a unique player ID
   */
  function generatePlayerId() {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get player name - checks localStorage first, falls back to random generation
   */
  function generatePlayerName() {
    // Check localStorage for saved custom name
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('playerName');
      if (savedName) return savedName;
    }
    // Generate a fun random name
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    return `${adj}${animal}`;
  }

  /**
   * Get a color for this player - checks localStorage first, falls back to hash
   */
  function getPlayerColor(id) {
    // Check localStorage for saved mochi color
    if (typeof window !== 'undefined') {
      const savedColor = localStorage.getItem('mochiColor');
      if (savedColor) return savedColor;
    }
    // Fall back to hash-based color
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
  }

  /**
   * Get accessories for this player - checks localStorage
   */
  function loadPlayerAccessories() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mochiAccessories');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  }

  /**
   * Load customization from database for logged-in users
   * Returns null if not logged in or no data found
   */
  async function loadCustomizationFromDb() {
    try {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Query player_customization by account_id
      const { data, error } = await supabase
        .from('player_customization')
        .select('*')
        .eq('account_id', user.id)
        .maybeSingle();

      if (error || !data) return null;

      return {
        playerId: data.player_id,
        color: data.avatar_color,
        accessories: data.accessory_ids || [],
        name: data.avatar_name,
      };
    } catch (e) {
      console.error('Error loading customization from DB:', e);
      return null;
    }
  }

  /**
   * Generate a random world seed
   */
  function generateWorldSeed() {
    return Math.floor(Math.random() * 1000000);
  }

  /**
   * Initialize multiplayer - join or create room
   * Uses presence as source of truth for detecting stale rooms
   */
  async function init() {
    // Try to load from database first (for logged-in users)
    const dbCustomization = await loadCustomizationFromDb();

    if (dbCustomization) {
      // Use database data - this preserves the original player_id so data stays linked
      playerId = dbCustomization.playerId;
      playerName = dbCustomization.name || generatePlayerName();
      playerColor = dbCustomization.color || getPlayerColor(playerId);
      playerAccessories = dbCustomization.accessories || [];

      // Sync to localStorage so it's available elsewhere
      if (typeof window !== 'undefined') {
        localStorage.setItem('playerId', playerId);
        localStorage.setItem('playerName', playerName);
        localStorage.setItem('mochiColor', playerColor);
        localStorage.setItem('mochiAccessories', JSON.stringify(playerAccessories));
      }
    } else {
      // Not logged in or no DB data - use localStorage/generate new
      playerId = generatePlayerId();
      playerName = generatePlayerName();
      playerColor = getPlayerColor(playerId);
      playerAccessories = loadPlayerAccessories();
    }

    // Set up Realtime channel first so we can check presence
    channel = supabase.channel(CHANNEL_NAME, {
      config: {
        presence: { key: playerId },
        broadcast: { self: false },
      },
    });

    // Track which players we've already spawned
    const spawnedPlayers = new Set();

    // Handle presence sync - spawns existing players when we first join
    // Also handles presence updates (e.g., color changes) for existing players
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const playerIds = Object.keys(state);
      console.log("Players in room:", playerIds.length, playerIds);

      const now = Date.now();
      const STALE_THRESHOLD = 300000; // 5 minutes - ignore players who joined long ago without recent activity

      for (const pid of playerIds) {
        if (pid === playerId) continue;

        const presenceData = state[pid]?.[0];

        // Skip stale players (joined > 60s ago with no lastActive update)
        const joinedAt = presenceData?.joinedAt || 0;
        const lastActive = presenceData?.lastActive || joinedAt;
        if (now - lastActive > STALE_THRESHOLD) {
          console.log("Skipping stale player:", pid, "lastActive:", now - lastActive, "ms ago");
          continue;
        }

        if (!spawnedPlayers.has(pid)) {
          // New player - spawn them
          console.log("Spawning existing player from sync:", pid);
          spawnedPlayers.add(pid);
          if (onPlayerJoin) {
            onPlayerJoin(pid, presenceData);
          }
        } else if (onPlayerPresenceUpdate) {
          // Existing player - notify of presence update (e.g., color change)
          onPlayerPresenceUpdate(pid, presenceData);
        }
      }
    });

    channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      console.log("Player joined:", key);
      if (key !== playerId && !spawnedPlayers.has(key)) {
        const presence = newPresences[0];

        // Skip stale players (5 minutes)
        const now = Date.now();
        const lastActive = presence?.lastActive || presence?.joinedAt || 0;
        if (now - lastActive > 300000) {
          console.log("Skipping stale player on join:", key);
          return;
        }

        spawnedPlayers.add(key);
        if (onPlayerJoin) {
          onPlayerJoin(key, presence);
        }
      }
    });

    channel.on("presence", { event: "leave" }, async ({ key }) => {
      console.log("Player left:", key);
      spawnedPlayers.delete(key);
      if (onPlayerLeave && key !== playerId) {
        onPlayerLeave(key);
      }
    });

    // Handle player movement broadcasts
    channel.on("broadcast", { event: "player_move" }, ({ payload }) => {
      if (onPlayerMove && payload.playerId !== playerId) {
        onPlayerMove(payload.playerId, payload);
      }
    });

    // Handle chat messages
    channel.on("broadcast", { event: "chat_message" }, ({ payload }) => {
      if (onChatMessage) {
        onChatMessage(payload);
      }
    });

    // Handle ping/come here
    channel.on("broadcast", { event: "ping" }, ({ payload }) => {
      if (onPing) {
        onPing(payload);
      }
    });

    // Handle teleport requests
    channel.on("broadcast", { event: "teleport_request" }, ({ payload }) => {
      if (onTeleportRequest && payload.targetPlayerId === playerId) {
        onTeleportRequest(payload);
      }
    });

    // Handle teleport responses
    channel.on("broadcast", { event: "teleport_response" }, ({ payload }) => {
      if (onTeleportResponse && payload.targetPlayerId === playerId) {
        onTeleportResponse(payload);
      }
    });

    // Subscribe and wait for it to complete
    await new Promise((resolve) => {
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          console.log("Channel subscribed, tracking presence...");
          const now = Date.now();
          await channel.track({
            playerId,
            playerName,
            playerColor,
            playerAccessories,
            joinedAt: now,
            lastActive: now,
          });
          console.log("Presence tracked");

          // Heartbeat - update lastActive every 20 seconds to prove we're alive
          setInterval(async () => {
            if (channel) {
              await channel.track({
                playerId,
                playerName,
                playerColor,
                playerAccessories,
                joinedAt: now,
                lastActive: Date.now(),
              });
            }
          }, 20000);

          resolve();
        }
      });
    });

    // Wait a moment for presence to sync
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Now check presence state and world
    const presenceState = channel.presenceState();
    const otherPlayers = Object.keys(presenceState).filter((pid) => pid !== playerId);
    console.log("Other players in presence:", otherPlayers.length);

    // Check if world exists in database (using new worlds table)
    const { data: existingWorld, error: fetchError } = await supabase
      .from("worlds")
      .select("*")
      .eq("id", ROOM_ID)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching world:", fetchError);
    }

    if (existingWorld) {
      // World exists - use its seed
      worldSeed = existingWorld.seed;

      if (otherPlayers.length === 0 && !existingWorld.owner_player_id) {
        // No other players and no owner - claim as host
        isHost = true;
        await supabase
          .from("worlds")
          .update({ owner_player_id: playerId })
          .eq("id", ROOM_ID);
        console.log(`Claimed world ${ROOM_ID} as host with seed: ${worldSeed}`);
      } else {
        // World has players or owner - join it
        isHost = existingWorld.owner_player_id === playerId;
        console.log(`Joined existing world ${ROOM_ID} with seed: ${worldSeed}`);
      }
    } else {
      // No world exists - create new one
      // This handles the case where worldId was generated but world wasn't created yet
      worldSeed = generateWorldSeed();
      isHost = true;

      const { error: insertError } = await supabase.from("worlds").insert({
        id: ROOM_ID,
        seed: worldSeed,
        owner_player_id: playerId,
        name: "Untitled World",
      });

      if (insertError) {
        // Race condition - someone else created the world first
        const { data: raceWorld } = await supabase
          .from("worlds")
          .select("*")
          .eq("id", ROOM_ID)
          .single();

        if (raceWorld) {
          worldSeed = raceWorld.seed;
          isHost = false;
          console.log(`Race condition - joined world with seed: ${worldSeed}`);
        }
      } else {
        console.log(`Created new world ${ROOM_ID} with seed: ${worldSeed}`);
      }
    }

    // Delayed sync check for any players we might have missed
    setTimeout(() => {
      const state = channel.presenceState();
      const playerIds = Object.keys(state);
      console.log("Delayed sync check - players:", playerIds.length, playerIds);

      const now = Date.now();
      const STALE_THRESHOLD = 300000; // 5 minutes

      for (const pid of playerIds) {
        if (pid !== playerId && !spawnedPlayers.has(pid)) {
          const presenceData = state[pid]?.[0];

          // Skip stale players
          const lastActive = presenceData?.lastActive || presenceData?.joinedAt || 0;
          if (now - lastActive > STALE_THRESHOLD) {
            console.log("Skipping stale player in delayed sync:", pid, "lastActive:", now - lastActive, "ms ago");
            continue;
          }

          console.log("Spawning player from delayed sync:", pid);
          spawnedPlayers.add(pid);
          if (onPlayerJoin) {
            onPlayerJoin(pid, presenceData);
          }
        }
      }
    }, 500);

    // Notify game of world seed
    if (onWorldSeedReceived) {
      onWorldSeedReceived(worldSeed);
    }

    return { playerId, playerName, playerColor, playerAccessories, worldSeed, isHost };
  }

  /**
   * Broadcast player position (throttled)
   */
  function broadcastPosition(x, y, z, rotation, vx, vz, isMoving, grounded) {
    if (!channel) return;

    const now = Date.now();
    if (now - lastBroadcastTime < BROADCAST_THROTTLE_MS) return;
    lastBroadcastTime = now;

    channel.send({
      type: "broadcast",
      event: "player_move",
      payload: {
        playerId,
        x,
        y,
        z,
        rotation,
        vx,
        vz,
        isMoving,
        grounded,
        timestamp: now,
      },
    });
  }

  /**
   * Leave the room and clean up
   * Just untrack presence - no need to manage player_count
   */
  async function leave() {
    if (!channel) return;

    // Untrack presence
    await channel.untrack();

    // Unsubscribe from channel
    await supabase.removeChannel(channel);

    channel = null;
    console.log("Left room");
  }

  /**
   * Set callback for when a player joins
   */
  function setOnPlayerJoin(callback) {
    onPlayerJoin = callback;
  }

  /**
   * Set callback for when a player leaves
   */
  function setOnPlayerLeave(callback) {
    onPlayerLeave = callback;
  }

  /**
   * Set callback for when a player moves
   */
  function setOnPlayerMove(callback) {
    onPlayerMove = callback;
  }

  /**
   * Set callback for when an existing player's presence updates (e.g., color change)
   */
  function setOnPlayerPresenceUpdate(callback) {
    onPlayerPresenceUpdate = callback;
  }

  /**
   * Set callback for when world seed is received
   */
  function setOnWorldSeedReceived(callback) {
    onWorldSeedReceived = callback;
  }

  /**
   * Set callback for chat messages
   */
  function setOnChatMessage(callback) {
    onChatMessage = callback;
  }

  /**
   * Set callback for pings
   */
  function setOnPing(callback) {
    onPing = callback;
  }

  /**
   * Set callback for teleport requests
   */
  function setOnTeleportRequest(callback) {
    onTeleportRequest = callback;
  }

  /**
   * Set callback for teleport responses
   */
  function setOnTeleportResponse(callback) {
    onTeleportResponse = callback;
  }

  /**
   * Broadcast a chat message
   */
  function broadcastChat(text) {
    if (!channel) return;

    const message = {
      id: `${playerId}_${Date.now()}`,
      playerId,
      playerName,
      color: playerColor,
      text,
      timestamp: Date.now(),
    };

    channel.send({
      type: "broadcast",
      event: "chat_message",
      payload: message,
    });

    // Also trigger local callback so sender sees their own message
    if (onChatMessage) {
      onChatMessage(message);
    }
  }

  /**
   * Broadcast a ping at current position
   */
  function broadcastPing(x, y, z) {
    if (!channel) return;

    const ping = {
      playerId,
      playerName,
      color: playerColor,
      x,
      y,
      z,
      timestamp: Date.now(),
    };

    channel.send({
      type: "broadcast",
      event: "ping",
      payload: ping,
    });

    // Also trigger local callback so sender sees their own ping
    if (onPing) {
      onPing(ping);
    }
  }

  /**
   * Broadcast a teleport request to another player
   */
  function broadcastTeleportRequest(targetPlayerId) {
    if (!channel) return;

    const request = {
      fromPlayerId: playerId,
      fromPlayerName: playerName,
      fromPlayerColor: playerColor,
      targetPlayerId,
      timestamp: Date.now(),
    };

    channel.send({
      type: "broadcast",
      event: "teleport_request",
      payload: request,
    });
  }

  /**
   * Broadcast a teleport response (accept/decline)
   */
  function broadcastTeleportResponse(targetPlayerId, accepted, x, y, z) {
    if (!channel) return;

    const response = {
      fromPlayerId: playerId,
      fromPlayerName: playerName,
      targetPlayerId,
      accepted,
      x,
      y,
      z,
      timestamp: Date.now(),
    };

    channel.send({
      type: "broadcast",
      event: "teleport_response",
      payload: response,
    });
  }

  /**
   * Get current players from presence
   */
  function getPlayers() {
    if (!channel) return {};
    return channel.presenceState();
  }

  /**
   * Get this player's ID
   */
  function getPlayerId() {
    return playerId;
  }

  /**
   * Get this player's name
   */
  function getPlayerName() {
    return playerName;
  }

  /**
   * Get this player's color
   */
  function getPlayerColor() {
    return playerColor;
  }

  /**
   * Save player customization to database
   */
  async function saveCustomizationToDb() {
    if (!playerId) return;

    try {
      const { error } = await supabase
        .from('player_customization')
        .upsert({
          player_id: playerId,
          avatar_color: playerColor,
          accessory_ids: playerAccessories,
          avatar_name: playerName,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'player_id',
        });

      if (error) {
        console.error('Failed to save customization:', error);
      }
    } catch (e) {
      console.error('Error saving customization:', e);
    }
  }

  /**
   * Update this player's color and re-track presence
   * @param {string} newColor - New hex color string
   */
  async function updatePlayerColor(newColor) {
    playerColor = newColor;
    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('mochiColor', newColor);
    }
    // Re-track presence with new color
    if (channel) {
      await channel.track({
        playerId,
        playerName,
        playerColor: newColor,
        playerAccessories,
        joinedAt: Date.now(),
      });
    }
    // Save to database
    await saveCustomizationToDb();
  }

  /**
   * Update this player's name and re-track presence
   * @param {string} newName - New player name (pass empty string to clear and regenerate)
   */
  async function updatePlayerName(newName) {
    if (newName && newName.trim()) {
      // Set custom name
      playerName = newName.trim();
      if (typeof window !== 'undefined') {
        localStorage.setItem('playerName', playerName);
      }
    } else {
      // Clear custom name - regenerate random one
      if (typeof window !== 'undefined') {
        localStorage.removeItem('playerName');
      }
      const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
      playerName = `${adj}${animal}`;
    }
    // Re-track presence with new name
    if (channel) {
      await channel.track({
        playerId,
        playerName,
        playerColor,
        playerAccessories,
        joinedAt: Date.now(),
      });
    }
    // Save to database
    await saveCustomizationToDb();
    return playerName;
  }

  /**
   * Update this player's accessories and re-track presence
   * @param {string[]} newAccessories - Array of accessory IDs like ["sunglasses", "topHat"]
   */
  async function updatePlayerAccessories(newAccessories) {
    playerAccessories = newAccessories || [];
    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('mochiAccessories', JSON.stringify(playerAccessories));
    }
    // Re-track presence with new accessories
    if (channel) {
      await channel.track({
        playerId,
        playerName,
        playerColor,
        playerAccessories: newAccessories,
        joinedAt: Date.now(),
      });
    }
    // Save to database
    await saveCustomizationToDb();
  }

  /**
   * Get this player's accessories
   */
  function getPlayerAccessories() {
    return playerAccessories;
  }

  /**
   * Get world seed
   */
  function getWorldSeed() {
    return worldSeed;
  }

  /**
   * Get world ID
   */
  function getWorldId() {
    return currentWorldId;
  }

  /**
   * Check if this player is the host
   */
  function getIsHost() {
    return isHost;
  }

  return {
    init,
    leave,
    broadcastPosition,
    broadcastChat,
    broadcastPing,
    broadcastTeleportRequest,
    broadcastTeleportResponse,
    setOnPlayerJoin,
    setOnPlayerLeave,
    setOnPlayerMove,
    setOnPlayerPresenceUpdate,
    setOnWorldSeedReceived,
    setOnChatMessage,
    setOnPing,
    setOnTeleportRequest,
    setOnTeleportResponse,
    getPlayers,
    getPlayerId,
    getPlayerName,
    getPlayerColor,
    getPlayerAccessories,
    updatePlayerColor,
    updatePlayerName,
    updatePlayerAccessories,
    getWorldSeed,
    getWorldId,
    getIsHost,
  };
}
