/**
 * ShellBridge - Secure communication between game and Molinar shell (Game Clips)
 *
 * This module handles:
 * 1. Auth sync - receives JWT from parent shell via postMessage
 * 2. Player identity - provides authenticated user info (FROZEN, immutable)
 * 3. Input handling - receives joystick/jump input from parent
 * 4. Coins signaling - signals coin events to parent (parent handles DB)
 * 5. World ID - extracts from URL path
 *
 * SECURITY: This module is in the SDK so game templates CANNOT modify
 * the auth/coins logic. The template just renders; SDK handles sensitive ops.
 *
 * ============================================================================
 * PLAYER DATA CONTRACT (v1.0)
 * ============================================================================
 *
 * SHELL OWNS (source of truth):
 *   - id: string (UUID)         - Unique user identifier from auth.users
 *   - email: string             - User's email address
 *   - username: string          - Display name
 *   - avatar_url: string|null   - Profile picture URL
 *   - metadata: object          - User metadata
 *   - coins: number             - Current coin balance (READ-ONLY)
 *
 * GAME CAN READ (via getPlayer()):
 *   - All fields above, returned as FROZEN object
 *
 * GAME IS FORBIDDEN FROM:
 *   - Mutating any player data
 *   - Directly updating coins in database
 *   - Modifying auth tokens
 *
 * ============================================================================
 * COINS CONTRACT
 * ============================================================================
 *
 * GAME signals coin events to shell:
 *   - signalCoinCollected(amount) - Player collected coin in world
 *   - signalCreatorEarning(objectId, creatorId) - Creator earned from placement
 *
 * SHELL handles:
 *   - Validating the event
 *   - Updating database
 *   - Sending updated coins back to game
 *
 * GAME listens for:
 *   - 'shell-coins-updated' event with new balance
 *
 * ============================================================================
 */

let bridgeInstance = null;
let authResolve = null;
let authPromise = null;

// Supabase client injected from shell
let _supabaseClient = null;

/**
 * Set the Supabase client (called by shell via SDK)
 * @param {object} client - Supabase client instance
 */
export function setShellSupabase(client) {
  _supabaseClient = client;
  if (bridgeInstance) {
    bridgeInstance._supabase = client;
  }
}

class ShellBridge {
  constructor() {
    this._supabase = _supabaseClient;
    this._user = null;
    this._accessToken = null;
    this._coins = 0;
    this._isAuthenticated = false;
    this._isAdmin = false; // Admin status from shell (validated server-side)
    this._flyModeEnabled = false; // Fly mode status from shell
    this._isEmbedded = typeof window !== 'undefined' && window.parent !== window;

    if (typeof window !== 'undefined') {
      this._setupListeners();
    }
  }

  /**
   * Set up message listeners from parent shell
   */
  _setupListeners() {
    window.addEventListener('message', async (event) => {
      const type = event.data?.type;

      // Auth from shell
      if (type === 'molinar-auth') {
        await this._handleAuth(event.data.payload);
        return;
      }

      // Mochi customization updates
      if (type === 'mochi-update') {
        this._dispatchEvent('shell-mochi-update', event.data.payload);
        return;
      }

      // Input from shell (joystick, jump)
      if (type === 'molinar-input') {
        this._dispatchEvent('shell-input', event.data.payload);
        return;
      }

      // Coins updated by shell
      if (type === 'molinar-coins-updated') {
        this._coins = event.data.payload?.coins || 0;
        this._dispatchEvent('shell-coins-updated', { coins: this._coins });
        return;
      }

      // Coins request from shell
      if (type === 'molinar-request-coins') {
        this._dispatchEvent('shell-request-coins', {});
        return;
      }

      // Chat message from shell
      if (type === 'molinar-chat-send') {
        this._dispatchEvent('shell-chat-send', event.data.payload);
        return;
      }

      // Fly mode from shell
      if (type === 'molinar-fly-mode') {
        this._flyModeEnabled = event.data.payload?.enabled === true;
        this._dispatchEvent('shell-fly-mode', { enabled: this._flyModeEnabled });
        return;
      }
    });

    // In standalone mode, check existing session
    if (!this._isEmbedded && this._supabase) {
      this._checkExistingSession();
    }
  }

  /**
   * Handle auth message from shell
   */
  async _handleAuth(payload) {
    const { access_token, refresh_token, user, coins, isAdmin } = payload || {};

    if (!access_token) {
      console.warn('[ShellBridge] Auth message missing access_token');
      return;
    }

    try {
      // Set session in Supabase client if available
      if (this._supabase) {
        const { data, error } = await this._supabase.auth.setSession({
          access_token,
          refresh_token
        });

        if (error) {
          console.error('[ShellBridge] Failed to set session:', error);
          return;
        }

        this._user = data.user || user;
      } else {
        this._user = user;
      }

      this._accessToken = access_token;
      this._coins = typeof coins === 'number' ? coins : 0;
      this._isAdmin = isAdmin === true; // Only true if explicitly set by shell
      this._isAuthenticated = true;

      console.log('[ShellBridge] Auth synced, user:', this._user?.id, 'coins:', this._coins, 'isAdmin:', this._isAdmin);

      // Resolve waiting promises
      if (authResolve) {
        authResolve(this._user);
        authResolve = null;
      }

      // Dispatch ready event
      this._dispatchEvent('shell-auth-ready', {
        user: this._user,
        coins: this._coins
      });

    } catch (err) {
      console.error('[ShellBridge] Auth error:', err);
    }
  }

  /**
   * Check existing session (standalone mode)
   */
  async _checkExistingSession() {
    if (!this._supabase) return;

    try {
      const { data: { session } } = await this._supabase.auth.getSession();
      if (session) {
        this._user = session.user;
        this._accessToken = session.access_token;
        this._isAuthenticated = true;

        if (authResolve) {
          authResolve(this._user);
          authResolve = null;
        }
      }
    } catch (err) {
      console.error('[ShellBridge] Session check error:', err);
    }
  }

  /**
   * Dispatch custom event
   */
  _dispatchEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  /**
   * Send message to parent shell
   */
  _sendToShell(type, payload) {
    if (this._isEmbedded && window.parent) {
      window.parent.postMessage({ type, payload }, '*');
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Wait for authentication
   * @param {number} timeout - Max wait time in ms
   * @returns {Promise<object|null>}
   */
  async waitForAuth(timeout = 5000) {
    if (this._isAuthenticated) {
      return this._user;
    }

    if (!authPromise) {
      authPromise = new Promise((resolve) => {
        authResolve = resolve;
        setTimeout(() => {
          if (authResolve) {
            authResolve(null);
            authResolve = null;
          }
        }, timeout);
      });
    }

    return authPromise;
  }

  /**
   * Get current player (FROZEN - immutable)
   * @returns {object|null}
   */
  getPlayer() {
    if (!this._user) return null;

    const frozenMetadata = Object.freeze({ ...(this._user.user_metadata || {}) });

    return Object.freeze({
      id: this._user.id,
      email: this._user.email,
      username: this._user.user_metadata?.username || this._user.email?.split('@')[0],
      avatar_url: this._user.user_metadata?.avatar_url,
      metadata: frozenMetadata,
      coins: this._coins, // READ-ONLY
    });
  }

  /**
   * Get coins (READ-ONLY)
   * @returns {number}
   */
  getCoins() {
    return this._coins;
  }

  /**
   * Get user ID or null
   * @returns {string|null}
   */
  getUserId() {
    return this._user?.id || null;
  }

  /**
   * Check if authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return this._isAuthenticated;
  }

  /**
   * Check if user is admin (validated server-side by shell)
   * @returns {boolean}
   */
  isAdmin() {
    return this._isAdmin;
  }

  /**
   * Check if fly mode is enabled (controlled by shell)
   * @returns {boolean}
   */
  isFlyModeEnabled() {
    return this._flyModeEnabled;
  }

  /**
   * Check if running in iframe
   * @returns {boolean}
   */
  isEmbedded() {
    return this._isEmbedded;
  }

  /**
   * Get world ID from URL (/w/{worldId})
   * @returns {string|null}
   */
  getWorldId() {
    if (typeof window === 'undefined') return null;

    const match = window.location.pathname.match(/^\/w\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  /**
   * Get access token for API calls
   * @returns {string|null}
   */
  getAccessToken() {
    return this._accessToken;
  }

  /**
   * Check if user can modify a resource
   * @param {string} ownerId
   * @returns {boolean}
   */
  canModify(ownerId) {
    return this._isAuthenticated && this._user?.id === ownerId;
  }

  // ============================================================================
  // COMPATIBILITY METHODS (match old molinar-sdk.js API)
  // ============================================================================

  /**
   * Alias for isEmbedded() - matches old API
   * @returns {boolean}
   */
  isEmbeddedMode() {
    return this._isEmbedded;
  }

  /**
   * Get authenticated user ID or throw
   * @returns {string}
   * @throws {Error} If not authenticated
   */
  getAuthenticatedUserId() {
    if (!this._isAuthenticated || !this._user?.id) {
      throw new Error('Authentication required');
    }
    return this._user.id;
  }

  /**
   * Get authenticated user ID or null
   * @returns {string|null}
   */
  getAuthenticatedUserIdOrNull() {
    return this._user?.id || null;
  }

  /**
   * Get the Supabase client
   * @returns {object|null}
   */
  getSupabase() {
    return this._supabase;
  }

  /**
   * Require authentication - throws if not authenticated
   * @throws {Error}
   */
  requireAuth() {
    if (!this._isAuthenticated || !this._user?.id) {
      throw new Error('Authentication required. Please sign in.');
    }
  }

  /**
   * Require ownership - throws if not owner
   * @param {string} ownerId
   * @throws {Error}
   */
  requireOwnership(ownerId) {
    this.requireAuth();
    if (this._user.id !== ownerId) {
      throw new Error('Permission denied. You can only modify your own content.');
    }
  }

  // ============================================================================
  // COINS SIGNALING (game -> shell)
  // ============================================================================

  /**
   * Signal that player collected a coin
   * Shell will validate and update database
   * @param {number} amount - Coin value
   * @param {object} context - Optional context (position, type, etc.)
   */
  signalCoinCollected(amount = 1, context = {}) {
    this._sendToShell('game-coin-collected', {
      amount,
      userId: this._user?.id,
      worldId: this.getWorldId(),
      timestamp: Date.now(),
      ...context
    });
  }

  /**
   * Signal creator earning from object placement
   * Shell will validate and award coins to creator
   * @param {string} objectId - The placed object
   * @param {string} creatorId - The object creator's ID
   * @param {string} placerId - Who placed it
   */
  signalCreatorEarning(objectId, creatorId, placerId) {
    // Can't earn from own placement
    if (creatorId === placerId) return;

    this._sendToShell('game-creator-earning', {
      objectId,
      creatorId,
      placerId,
      worldId: this.getWorldId(),
      timestamp: Date.now()
    });
  }

  /**
   * Signal game event to shell
   * @param {string} eventType
   * @param {object} payload
   */
  signalGameEvent(eventType, payload = {}) {
    this._sendToShell('game-event', {
      eventType,
      userId: this._user?.id,
      worldId: this.getWorldId(),
      timestamp: Date.now(),
      ...payload
    });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Initialize the ShellBridge singleton
 * @returns {ShellBridge}
 */
export function initShellBridge() {
  if (!bridgeInstance) {
    bridgeInstance = new ShellBridge();
  }
  return bridgeInstance;
}

/**
 * Get the ShellBridge instance
 * @returns {ShellBridge|null}
 */
export function getShellBridge() {
  return bridgeInstance;
}

/**
 * React hook-friendly getter
 * @returns {ShellBridge}
 */
export function useShellBridge() {
  if (!bridgeInstance) {
    bridgeInstance = new ShellBridge();
  }
  return bridgeInstance;
}

// Auto-initialize in browser
if (typeof window !== 'undefined') {
  initShellBridge();
}

export default ShellBridge;
