# Tetris Game API Documentation for LLMs

This document provides comprehensive instructions for Large Language Models (LLMs) to understand and interact with the Tetris Game API. The API enables automated control of the game through cross-origin iframe communication.

## Table of Contents

1. [Overview](#overview)
2. [Embedding the Game](#embedding-the-game)
3. [SDK Initialization](#sdk-initialization)
4. [Game Control APIs](#game-control-apis)
5. [State Query APIs](#state-query-apis)
6. [Piece Control APIs](#piece-control-apis)
7. [CAPTCHA Handling](#captcha-handling)
8. [Event System](#event-system)
9. [Response Format](#response-format)
10. [Error Handling](#error-handling)
11. [Complete Example](#complete-example)

---

## Overview

The Tetris Game API provides a complete interface for:
- Querying game state (board, pieces, score)
- Controlling piece movement and rotation
- Handling CAPTCHA challenges
- Listening for game events

**Important:** Player registration and game start are handled inside the game iframe UI. The SDK is used ONLY for controlling the game after it has started.

**Base URL:** The game is hosted at `http://localhost:3001` (or your deployment URL)

**Game URL:** `http://localhost:3001/game.html`

**Board Dimensions:** 20 rows × 10 columns

**Coordinate System:**
- Origin (0, 0) is at the top-left corner
- X increases to the right (0-9)
- Y increases downward (0-19)
- Piece x, y represents the top-left position of the piece's shape matrix

---

## Embedding the Game

To embed the game in your application, use an iframe:

```html
<iframe id="tetris-frame" 
        src="http://localhost:3001/game.html" 
        width="700" 
        height="700"
        style="border: none;"></iframe>
```

---

## SDK Initialization

Load the SDK and initialize it with the iframe:

```html
<script src="http://localhost:3001/tetris-sdk.js"></script>
<script>
    const iframe = document.getElementById('tetris-frame');
    const tetris = new TetrisGameSDK(iframe);
</script>
```

**Important:** You must call `tetris.init()` before using other APIs:

```javascript
await tetris.init();
// Now you can use other APIs
```

**Note:** Player registration/login must be done inside the game iframe UI. The SDK cannot register players - it only controls the game after it has started.

---

## Game Control APIs

### Control Flow

1. Load the game in an iframe
2. Player registers/logins inside the game UI
3. Player clicks "Start Game" inside the game
4. SDK can now control the game via APIs

**SDK only provides game control - not registration or game start.**

---

## State Query APIs

### Get Complete Game State

Returns all current game information:

```javascript
const state = await tetris.getGameState();
```

**Response:**
```javascript
{
    status: "playing",          // "playing", "finished", or "waiting"
    score: 0,                   // Current score
    lines: 0,                   // Lines cleared
    level: 1,                   // Current level
    currentScore: 0,
    highestScore: 5000,         // Player's all-time best
    board: [...],               // 20x10 array
    currentPiece: {...},        // Current falling piece
    nextPiece: {...},           // Next piece preview
    captchaRequired: false,     // Whether CAPTCHA is needed
    captchaId: null             // CAPTCHA challenge ID (if required)
}
```

### Get Detailed Board State

Returns detailed information about the board and pieces:

```javascript
const boardState = await tetris.getBoardState();
```

**Response:**
```javascript
{
    board: [
        // Row 0 (top)
        [null, null, {type: 'I', color: '#00f0f0', x: 2, y: 0}, null, ...],
        // Row 1
        [...],
        // ... 20 rows total
    ],
    boardWidth: 10,
    boardHeight: 20,
    currentPiece: {
        type: 'T',              // Piece type: I, O, T, S, Z, J, L
        color: '#a000f0',       // Color code
        shape: [[0,1,0],[1,1,1]], // 2D rotation matrix (0=empty, 1=filled)
        x: 3,                   // X position on board (top-left origin)
        y: 0,                   // Y position on board
        id: "T_123456_abc"      // Unique piece ID
    },
    nextPiece: {
        type: 'O',
        color: '#f0f000',
        shape: [[1,1],[1,1]],
        preview: true
    },
    score: 0,
    level: 1,
    lines: 0
}
```

**Understanding the Board:**

Each cell in the board array is either:
- `null`: Empty cell
- `{type, color, x, y}`: Occupied cell with block details

**Understanding currentPiece.shape (Rotation State):**

The `shape` field is a **2D rotation matrix** representing the piece's current orientation:
- `0`: Empty cell in the shape matrix
- `1`: Filled cell (part of the piece)

Example - T piece with different rotations:
```javascript
// Rotation 0° (up)
shape: [[0,1,0],  // .#.
        [1,1,1]]  // ###

// Rotation 90° (right)
shape: [[1,0],    // ##
        [1,1],    // ##
        [1,0]]    // #.

// Rotation 180° (down)
shape: [[1,1,1],  // ###
        [0,1,0]]  // .#.

// Rotation 270° (left)
shape: [[0,1],    // .#
        [1,1],    // ##
        [0,1]]    // .#
```

**To check piece orientation:**
```javascript
const piece = state.currentPiece;
const rows = piece.shape.length;
const cols = piece.shape[0].length;
console.log(`Piece is ${cols}x${rows} matrix`);

// Check if it's horizontal (rotation 0° or 180°)
const isHorizontal = piece.shape.length === 1 || 
                     (piece.type === 'I' && piece.shape.length === 1);

// Check if it's vertical (rotation 90° or 270°)
const isVertical = piece.type === 'I' && piece.shape.length === 4;
```

**Piece Types:**

| Type | Shape (ASCII) | Shape Description | Color |
|------|---------------|-------------------|-------|
| I | `####` | 4×1 horizontal line | `#00f0f0` (cyan) |
|   | `#` | | |
|   | `#` | | |
|   | `#` | | |
| O | `##` | 2×2 square | `#f0f000` (yellow) |
|   | `##` | | |
| T | `.#.` | T-shape | `#a000f0` (purple) |
|   | `###` | | |
| S | `.##` | S-shape (right) | `#00f000` (green) |
|   | `##.` | | |
| Z | `##.` | Z-shape (left) | `#f00000` (red) |
|   | `.##` | | |
| J | `#..` | J-shape | `#0000f0` (blue) |
|   | `###` | | |
| L | `..#` | L-shape | `#f0a000` (orange) |
|   | `###` | | |

**ASCII Legend:** `#` = filled cell, `.` = empty cell

**Rotation Note:** All pieces rotate 90° clockwise around their top-left origin. The (x, y) coordinates in the game state indicate the position of this origin point.

---

## Piece Control APIs

### Move Left

```javascript
const result = await tetris.moveLeft();
```

**Response:**
```javascript
{
    success: true,   // Always true (API call succeeded)
    x: 2             // Current X position after attempted move
}
```

**Notes:**
- API call always returns `success: true` (the command was executed)
- If the piece cannot move left (collision or boundary), it stays in its original position
- To verify if movement occurred, compare the X position before and after the call
- The returned `x` value is the piece's current position (may be unchanged if blocked)

### Move Right

```javascript
const result = await tetris.moveRight();
```

**Response:**
```javascript
{
    success: true,   // Always true (API call succeeded)
    x: 4             // Current X position after attempted move
}
```

**Notes:**
- API call always returns `success: true` (the command was executed)
- If the piece cannot move right (collision or boundary), it stays in its original position
- To verify if movement occurred, compare the X position before and after the call
- The returned `x` value is the piece's current position (may be unchanged if blocked)

### Move Down (Soft Drop)

```javascript
const result = await tetris.moveDown();
```

**Response:**
```javascript
{
    success: true,   // true = piece moved down, false = piece locked in place
    y: 1             // Current Y position
}
```

**Notes:**
- Moves the piece down by one row
- **`success: true`**: Piece successfully moved down to a new row
- **`success: false`**: Piece hit the bottom or another piece and has been **locked in place**
  - When locked, a new piece spawns automatically (from `currentPiece`)
  - The previous `nextPiece` becomes the new `currentPiece`
  - A new `nextPiece` is generated
- After receiving `success: false`, call `tetris.getGameState()` to get the new piece information
- The returned `y` value is the piece's final position before locking

### Hard Drop

Instantly drops the piece to the bottom:

```javascript
const result = await tetris.hardDrop();
```

**Response:**
```javascript
{
    success: true    // Always true (API call succeeded)
}
```

**Notes:**
- The piece instantly falls to the lowest possible position
- The piece is immediately locked in place
- A new piece spawns automatically after locking
- Always call `tetris.getGameState()` or `tetris.getBoardState()` after hard drop to get:
  - The new current piece
  - Updated board state
  - New score (if lines were cleared)

### Rotate

Rotates the piece 90 degrees clockwise:

```javascript
const result = await tetris.rotate();
```

**Response:**
```javascript
{
    success: true    // Always true (API call succeeded, but rotation may be blocked)
}
```

**Important:** The API always returns `success: true` even if rotation was blocked by collision. To verify if rotation actually occurred, compare the piece's `shape` matrix before and after:

```javascript
const before = await tetris.getBoardState();
const oldShape = JSON.stringify(before.currentPiece.shape);

await tetris.rotate();

const after = await tetris.getBoardState();
const newShape = JSON.stringify(after.currentPiece.shape);

if (oldShape === newShape) {
    console.log('Rotation blocked by collision');
} else {
    console.log('Rotation successful');
}
```

**Rotation Behavior:**

1. **Shape Matrix Transformation:**
   - The piece's `shape` matrix is rotated 90° clockwise
   - Algorithm: Transpose the matrix, then reverse each row
   - Example:
   ```javascript
   // Before rotation (T-piece, 0°):
   [[0,1,0],
    [1,1,1]]
   
   // After rotation (T-piece, 90°):
   [[1,0],
    [1,1],
    [1,0]]
   ```

2. **Coordinate Behavior:**
   - **The (x, y) position remains unchanged**
   - The piece rotates around its top-left corner (origin point)
   - Only the `shape` matrix changes, not the position
   
3. **Collision Handling:**
   - If rotation causes collision with walls, floor, or other pieces:
     - The rotation is **rejected**
     - The piece reverts to its original orientation
     - **No wall kick or position adjustment is performed**
   - If rotation is rejected:
     - `success: true` is still returned (API call succeeded)
     - But the piece orientation remains unchanged
     - Call `getBoardState()` to verify if rotation occurred

**Example - Rotation Near Wall:**
```javascript
// Piece at x=9, y=5 with horizontal I-piece (4×1)
// Current: [[1,1,1,1]]
const before = await tetris.getBoardState();
console.log(before.currentPiece.shape); // [[1,1,1,1]]

await tetris.rotate();

const after = await tetris.getBoardState();
// Rotation rejected - would extend beyond right wall
console.log(after.currentPiece.shape); // Still [[1,1,1,1]]
console.log(after.currentPiece.x);     // Still 9
console.log(after.currentPiece.y);     // Still 5
```

**Notes:**
- Always call `getBoardState()` after rotation to verify the new orientation
- The piece's bounding box size changes with rotation (e.g., 4×1 becomes 1×4)
- No automatic position adjustment - rotation fails if new shape doesn't fit

---

## CAPTCHA Handling

When the game detects suspicious activity, it requires CAPTCHA verification:

### Detecting CAPTCHA Challenge

```javascript
const state = await tetris.getGameState();

if (state.captchaRequired) {
    console.log('CAPTCHA required! ID:', state.captchaId);
    // Get the image URL
    const imageUrl = tetris.getCaptchaImageUrl(state.captchaId);
    console.log('Image URL:', imageUrl);
}
```

### Submitting CAPTCHA

```javascript
const result = await tetris.submitCaptcha(captchaId, userCode);
```

**Parameters:**
- `captchaId` (string): The CAPTCHA challenge ID from `getGameState()`
- `code` (string): The user's entered code (4 characters)

**Response:**
```javascript
{
    success: true
}
```

**If verification fails:**
```javascript
{
    success: false,
    error: "验证码错误"  // "CAPTCHA incorrect"
}
```

**Example Flow:**
```javascript
const state = await tetris.getGameState();

if (state.captchaRequired) {
    // Display CAPTCHA image to user/AI
    const imageUrl = tetris.getCaptchaImageUrl(state.captchaId);
    
    // Get the code (from OCR or user input)
    const code = await recognizeCaptcha(imageUrl); // Your OCR function
    
    // Submit
    const result = await tetris.submitCaptcha(state.captchaId, code);
    
    if (result.success) {
        console.log('CAPTCHA verified! Game continues.');
    } else {
        console.error('CAPTCHA failed:', result.error);
    }
}
```

---

## Event System

Subscribe to game events for real-time updates:

```javascript
// Listen for game over
const unsubscribe = tetris.on('gameOver', (data) => {
    console.log('Game Over! Final score:', data.score);
    console.log('Rank:', data.rank);
});

// Listen for score updates
tetris.on('scoreUpdate', (data) => {
    console.log(`Lines cleared: ${data.linesCleared}, Score: ${data.score}`);
});

// Listen for CAPTCHA requirement
tetris.on('captchaRequired', (data) => {
    console.log('CAPTCHA required! Image:', data.imageUrl);
});

// Listen for CAPTCHA verification
tetris.on('captchaVerified', (data) => {
    console.log('CAPTCHA verified! Game continues.');
});

// To unsubscribe:
unsubscribe();
```

**Available Events:**

| Event | Data | Description |
|-------|------|-------------|
| `gameOver` | `{score, rank, highestScore}` | Game has ended |
| `scoreUpdate` | `{score, lines, level, linesCleared}` | Score or lines changed |
| `captchaRequired` | `{captchaId, imageUrl}` | CAPTCHA challenge triggered |
| `captchaVerified` | `{success}` | CAPTCHA verification completed |

---

## Response Format

### Successful Response

All successful API calls return a `Promise` that resolves to the expected data:

```javascript
// Simple success
{ success: true }

// State data
{
    status: "playing",
    score: 100,
    board: [...],
    // ... other fields
}

// Movement result
{
    success: true,
    x: 3,
    y: 5
}
```

### Error Response

Failed API calls throw an `Error`:

```javascript
try {
    await tetris.moveLeft();
} catch (error) {
    console.error(error.message);
    // Common errors:
    // - "Game is not playing"
    // - "Unknown SDK command: XXX"
    // - "CAPTCHA verification failed"
}
```

---

## Error Handling

### Common Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Game is not playing" | Called control API when game not active | Wait for player to start game in iframe |
| "Request timeout: XXX" | No response from game | Check game is loaded, refresh iframe |
| "CAPTCHA verification failed" | Incorrect CAPTCHA code | Get new code and retry |

### Best Practices

1. **Always handle errors:**
```javascript
try {
    const result = await tetris.moveLeft();
    if (!result.success) {
        console.log('Could not move - collision or boundary');
    }
} catch (error) {
    console.error('API error:', error.message);
}
```

2. **Check game state before actions:**
```javascript
const state = await tetris.getGameState();
if (state.status !== 'playing') {
    // Wait for player to start game
    console.log('Waiting for game to start...');
    await delay(1000);
}
```

3. **Add delays between actions:**
```javascript
// For human-like behavior
await tetris.moveLeft();
await delay(100);
await tetris.moveDown();
await delay(100);
```

---

## Complete Example

Here's a complete example of an AI player:

```javascript
const iframe = document.getElementById('tetris-frame');
const tetris = new TetrisGameSDK(iframe);

async function runBot() {
    try {
        // Initialize SDK
        await tetris.init();
        console.log('SDK initialized');
        
        // Listen for events
        tetris.on('gameOver', (data) => {
            console.log(`Game Over! Score: ${data.score}, Rank: ${data.rank}`);
        });
        
        tetris.on('captchaRequired', async (data) => {
            console.log('CAPTCHA required!');
            // In a real bot, use OCR to read the CAPTCHA
            // For now, simulate user input
            const code = prompt('Enter CAPTCHA:');
            await tetris.submitCaptcha(data.captchaId, code);
        });
        
        // Game loop
        while (true) {
            const state = await tetris.getGameState();
            
            if (state.status !== 'playing') {
                console.log('Waiting for game to start...');
                await delay(2000);
                continue;
            }
            
            if (state.captchaRequired) {
                await delay(1000);
                continue;
            }
            
            // AI decision logic here
            const action = decideNextMove(state);
            
            switch (action) {
                case 'left':
                    await tetris.moveLeft();
                    break;
                case 'right':
                    await tetris.moveRight();
                    break;
                case 'down':
                    await tetris.moveDown();
                    break;
                case 'drop':
                    await tetris.hardDrop();
                    break;
                case 'rotate':
                    await tetris.rotate();
                    break;
            }
            
            // Delay between actions (simulates human speed)
            await delay(200);
        }
    } catch (error) {
        console.error('Bot error:', error.message);
    }
}

function decideNextMove(state) {
    // Your AI logic here
    // Analyze state.board and state.currentPiece
    // Return: 'left', 'right', 'down', 'drop', or 'rotate'
    return 'down';
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the bot
runBot();
```

**Note:** Before running this bot:
1. Open the game in a browser
2. Register/login as a player inside the game UI
3. Click "Start Game" to begin
4. The SDK will then take over control

---

## Coordinate System Reference

```
Board Coordinate System (20 rows × 10 columns):

    (0,0) ──────► X axis
       │
       │
       │
       ▼ Y axis

Row 0: Top of the board
Row 19: Bottom of the board

Column 0: Left edge
Column 9: Right edge

Piece Position (x, y):
- x: Horizontal position (column index)
- y: Vertical position (row index, increases downward)

Example:
A piece at {x: 3, y: 5} means:
- Its shape matrix starts at row 5, column 3
- The piece extends to rows 5,6,7... and columns 3,4,5...
```

---

## Piece Rotation

### Rotation Mechanics

Pieces rotate **90 degrees clockwise** around their **top-left corner** (origin point).

**Transformation Algorithm:**
1. Transpose the shape matrix (swap rows and columns)
2. Reverse each row
3. Keep the (x, y) position unchanged

**Example - T Piece Rotation:**
```
Rotation 0° → 90°:

Before:              After:
[[0,1,0],            [[1,0],
 [1,1,1]]     →       [1,1],
                      [1,0]]

Position: (x=3, y=5) → (x=3, y=5)  // Unchanged!
```

**Example - I Piece Rotation:**
```
Rotation 0° → 90°:

Before:              After:
[[1,1,1,1]]   →      [[1],
                      [1],
                      [1],
                      [1]]

Position: (x=3, y=0) → (x=3, y=0)  // Unchanged!
Shape changes from 4×1 to 1×4
```

### Important Notes

1. **No Wall Kick:** 
   - If rotation causes collision (wall, floor, or blocks), the rotation is **rejected**
   - The piece stays in its original orientation
   - No position adjustment is attempted

2. **Coordinate Stability:**
   - The (x, y) coordinates **never change** during rotation
   - Only the shape matrix changes
   - The piece rotates around its fixed top-left corner

3. **Bounding Box Changes:**
   - Different rotations have different bounding boxes
   - Example: I-piece alternates between 4×1 (horizontal) and 1×4 (vertical)
   - A 3×2 piece becomes 2×3 after rotation

4. **Collision Detection:**
   - After matrix transformation, check if all filled cells fit within bounds
   - If any cell would be out of bounds or overlap existing blocks:
     - Rotation fails silently
     - API returns `{success: true}` (the call succeeded)
     - But the piece orientation remains unchanged

**Verification Pattern:**
```javascript
const before = await tetris.getBoardState();
const oldShape = JSON.stringify(before.currentPiece.shape);

await tetris.rotate();

const after = await tetris.getBoardState();
const newShape = JSON.stringify(after.currentPiece.shape);

if (oldShape === newShape) {
    console.log('Rotation was blocked by collision');
} else {
    console.log('Rotation successful');
}
```

---

For questions or issues, refer to the game source code or contact the development team.
