/**
 * Tetris Game SDK
 * 
 * This SDK allows third-party applications to embed and control
 * the Tetris game through JavaScript APIs using postMessage for
 * cross-origin communication.
 * 
 * Usage:
 * 1. Include this script in your page
 * 2. Create an iframe pointing to the game
 * 3. Initialize the SDK with the iframe element
 * 4. Use the game control APIs to play
 * 
 * Note: Registration/Login should be done inside the iframe game UI
 * 
 * Example:
 *   const tetris = new TetrisGameSDK(iframeElement);
 *   await tetris.init();
 *   const state = await tetris.getGameState();
 *   await tetris.moveLeft();
 */

class TetrisGameSDK {
    /**
     * @param {HTMLIFrameElement} iframe - The iframe element containing the game
     * @param {Object} options - Configuration options
     */
    constructor(iframe, options = {}) {
        this.iframe = iframe;
        this.options = {
            timeout: 10000,
            ...options
        };
        this.messageId = 0;
        this.pendingRequests = new Map();
        this.isReady = false;
        this.readyPromise = null;
        this._eventHandlers = new Map();
        
        this._setupMessageListener();
    }
    
    /**
     * Initialize the SDK and wait for the game to be ready
     * @returns {Promise<void>}
     */
    async init() {
        if (this.isReady) return;
        if (this.readyPromise) return this.readyPromise;
        
        this.readyPromise = new Promise((resolve, reject) => {
            const id = `__init__`;
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error('Game initialization timeout'));
            }, this.options.timeout);
            
            this.pendingRequests.set(id, {
                resolve: () => {
                    clearTimeout(timeout);
                    this.isReady = true;
                    resolve();
                },
                reject
            });
        });
        
        // Send init message with special ID
        this._postMessageWithId('__init__', { type: '__SDK_INIT__' });
        
        return this.readyPromise;
    }
    
    _postMessageWithId(id, data) {
        if (!this.iframe || !this.iframe.contentWindow) {
            return Promise.reject(new Error('Iframe not available'));
        }
        
        const message = {
            __sdkRequest: true,
            id,
            ...data
        };
        
        this.iframe.contentWindow.postMessage(message, '*');
    }
    
    /**
     * Set up message listener for responses from game
     * @private
     */
    _setupMessageListener() {
        window.addEventListener('message', (event) => {
            const message = event.data;
            
            // Handle SDK responses
            if (message && message.__sdkResponse) {
                const { id, success, data, error } = message;
                
                // Check for specific init request
                if (id === '__init__' && this.pendingRequests.has('__init__')) {
                    const pending = this.pendingRequests.get('__init__');
                    this.pendingRequests.delete('__init__');
                    if (success) {
                        pending.resolve(data);
                    } else {
                        pending.reject(new Error(error || 'Unknown error'));
                    }
                    return;
                }
                
                // Handle regular requests by ID
                const pending = this.pendingRequests.get(id);
                if (pending) {
                    this.pendingRequests.delete(id);
                    if (success) {
                        pending.resolve(data);
                    } else {
                        pending.reject(new Error(error || 'Unknown error'));
                    }
                }
            }
            
            // Handle SDK events
            if (message && message.__sdkEvent) {
                const handlers = this._eventHandlers.get(message.event);
                if (handlers) {
                    handlers.forEach(callback => callback(message.data));
                }
            }
        });
    }
    
    /**
     * Send message to game iframe
     * @private
     */
    _postMessage(data) {
        if (!this.iframe || !this.iframe.contentWindow) {
            return Promise.reject(new Error('Iframe not available'));
        }
        
        const id = `msg_${++this.messageId}_${Date.now()}`;
        const message = {
            __sdkRequest: true,
            id,
            ...data
        };
        
        this.iframe.contentWindow.postMessage(message, '*');
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${data.type}`));
            }, this.options.timeout);
            
            this.pendingRequests.set(id, {
                resolve,
                reject
            });
        });
    }
    
    /**
     * Listen for game events
     * @param {string} event - Event name (gameOver, scoreUpdate, etc.)
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this._eventHandlers.has(event)) {
            this._eventHandlers.set(event, new Set());
        }
        this._eventHandlers.get(event).add(callback);
        
        return () => {
            const handlers = this._eventHandlers.get(event);
            if (handlers) {
                handlers.delete(callback);
            }
        };
    }
    
    // ==================== Game Control APIs ====================
    
    /**
     * Get the current game state
     * @returns {Promise<Object>} Game state containing:
     *   - status: 'playing' | 'finished' | 'waiting'
     *   - score: Current score
     *   - lines: Lines cleared
     *   - level: Current level
     *   - board: 20x10 board array
     *   - currentPiece: Current falling piece
     *   - nextPiece: Next piece preview
     *   - captchaRequired: Whether CAPTCHA is needed
     *   - captchaId: CAPTCHA challenge ID (if required)
     */
    async getGameState() {
        return this._postMessage({ type: '__SDK_GET_STATE__' });
    }
    
    /**
     * Get detailed board state with block information
     * @returns {Promise<Object>} Detailed board state containing:
     *   - board: 20x10 array with cell details (null or block object)
     *   - boardWidth: 10
     *   - boardHeight: 20
     *   - currentPiece: Falling piece with position, shape, type
     *   - nextPiece: Next piece preview
     *   - score: Current score
     *   - level: Current level
     *   - lines: Lines cleared
     * 
     * currentPiece shape matrix (rotation state):
     *   The shape is a 2D array where 0=empty, 1=filled.
     *   Example - T piece at different rotations:
     * 
     *   Rotation 0°:  Rotation 90°:  Rotation 180°:  Rotation 270°:
     *   [[0,1,0],     [[1,0],        [[1,1,1],       [[0,1],
     *    [1,1,1]]      [1,1],         [0,1,0]]        [1,1],
     *                   [1,0]]                         [0,1]]
     * 
     *   I piece horizontal:  I piece vertical:
     *   [[1,1,1,1]]          [[1],
     *                         [1],
     *                         [1],
     *                         [1]]
     * 
     *   To determine orientation: check matrix dimensions (rows x cols)
     */
    async getBoardState() {
        return this._postMessage({ type: '__SDK_GET_BOARD__' });
    }
    
    /**
     * Move the current piece left
     * @returns {Promise<Object>} Result { success: boolean, x: number }
     */
    async moveLeft() {
        return this._postMessage({ type: '__SDK_MOVE_LEFT__' });
    }
    
    /**
     * Move the current piece right
     * @returns {Promise<Object>} Result { success: boolean, x: number }
     */
    async moveRight() {
        return this._postMessage({ type: '__SDK_MOVE_RIGHT__' });
    }
    
    /**
     * Move the current piece down (soft drop)
     * @returns {Promise<Object>} Result { success: boolean, y: number }
     */
    async moveDown() {
        return this._postMessage({ type: '__SDK_MOVE_DOWN__' });
    }
    
    /**
     * Hard drop - instantly drop piece to bottom
     * @returns {Promise<Object>} Result { success: boolean }
     */
    async hardDrop() {
        return this._postMessage({ type: '__SDK_HARD_DROP__' });
    }
    
    /**
     * Rotate the current piece clockwise
     * @returns {Promise<Object>} Result { success: boolean }
     */
    async rotate() {
        return this._postMessage({ type: '__SDK_ROTATE__' });
    }
    
    /**
     * Start a new game (player must be logged in)
     * @returns {Promise<Object>} Result { success: boolean }
     */
    async startGame() {
        return this._postMessage({ type: '__SDK_START_GAME__' });
    }
    
    /**
     * End the current game (player must be logged in)
     * @returns {Promise<Object>} Result { success: boolean }
     */
    async endGame() {
        return this._postMessage({ type: '__SDK_END_GAME__' });
    }
    
    /**
     * Pause the game
     * @returns {Promise<Object>} Result { success: boolean, message: string }
     */
    async pauseGame() {
        return this._postMessage({ type: '__SDK_PAUSE_GAME__' });
    }
    
    /**
     * Resume the game
     * @returns {Promise<Object>} Result { success: boolean, message: string }
     */
    async resumeGame() {
        return this._postMessage({ type: '__SDK_RESUME_GAME__' });
    }
    
    /**
     * Submit CAPTCHA verification
     * @param {string} captchaId - CAPTCHA challenge ID
     * @param {string} code - User-entered CAPTCHA code (4 characters)
     * @returns {Promise<Object>} Result { success: boolean }
     */
    async submitCaptcha(captchaId, code) {
        return this._postMessage({
            type: '__SDK_CAPTCHA_SUBMIT__',
            captchaId,
            code
        });
    }
    
    /**
     * Get CAPTCHA image URL for display in external UI
     * @param {string} captchaId - CAPTCHA challenge ID
     * @returns {string} Image URL
     */
    getCaptchaImageUrl(captchaId) {
        const baseUrl = this.iframe.src.split('/game.html')[0];
        return `${baseUrl}/api/captcha/image/${captchaId}`;
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TetrisGameSDK;
}
