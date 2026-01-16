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
    board: [...],               // 20x10 array (simplified: 0=empty, 1=occupied)
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
    captchaRequired: false,     // Whether CAPTCHA is needed
    captchaId: null,            // CAPTCHA challenge ID (if required)
    captchaDataUri: null        // CAPTCHA image as data URI (if required)
}
```

**Understanding the Board:**

The board array is a simplified 20x10 matrix where:
- `0`: Empty cell
- `1`: Occupied cell (contains a locked block)

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
shape: [[1,0],    // #.
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
const state = await tetris.getGameState();
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
    x: 2             // Current X position after move attempt
}
```

**Behavior:**
- The piece attempts to move one column to the left
- If blocked by a wall or other pieces, the piece stays in place
- The `x` value reflects the final position (may be unchanged if blocked)
- To detect if movement occurred, store the X position before calling and compare:

```javascript
const stateBefore = await tetris.getGameState();
const oldX = stateBefore.currentPiece.x;

await tetris.moveLeft();

const stateAfter = await tetris.getGameState();
if (stateAfter.currentPiece.x < oldX) {
    console.log('Moved left successfully');
} else {
    console.log('Blocked - could not move left');
}
```

### Move Right

```javascript
const result = await tetris.moveRight();
```

**Response:**
```javascript
{
    success: true,   // Always true (API call succeeded)
    x: 4             // Current X position after move attempt
}
```

**Behavior:**
- The piece attempts to move one column to the right
- If blocked by a wall or other pieces, the piece stays in place
- The `x` value reflects the final position (may be unchanged if blocked)
- To detect if movement occurred, store the X position before calling and compare:

```javascript
const stateBefore = await tetris.getGameState();
const oldX = stateBefore.currentPiece.x;

await tetris.moveRight();

const stateAfter = await tetris.getGameState();
if (stateAfter.currentPiece.x > oldX) {
    console.log('Moved right successfully');
} else {
    console.log('Blocked - could not move right');
}
```

### Move Down (Soft Drop)

```javascript
const result = await tetris.moveDown();
```

**Response:**
```javascript
{
    success: true,   // true = moved down, false = locked in place
    y: 1             // Current Y position
}
```

**Behavior:**
- **`success: true`**: Piece successfully moved down one row
- **`success: false`**: Piece could not move down and has been **locked in place**
  - The piece hit the bottom or collided with other pieces
  - A new piece automatically spawns at the top
  - The previous `nextPiece` becomes the new `currentPiece`
  - A new `nextPiece` is generated for preview
  - Lines may be cleared if any rows are complete

**Important:** After `success: false`, always call `getGameState()` to get:
- The new current piece
- Updated score (if lines were cleared)
- The new next piece

```javascript
const result = await tetris.moveDown();

if (!result.success) {
    console.log('Piece locked!');
    const newState = await tetris.getGameState();
    console.log('New piece:', newState.currentPiece.type);
    console.log('Score:', newState.score);
}
```

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
- Always call `getGameState()` after hard drop to get:
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
    success: true    // Always true (API call succeeded)
}
```

**Behavior:**
- Attempts to rotate the piece 90° clockwise
- If rotation causes collision (wall, floor, or blocks), rotation is **rejected** and the piece stays in its original orientation
- The API always returns `success: true` (the command was executed), regardless of whether rotation occurred

**To verify if rotation occurred:**

```javascript
const before = await tetris.getGameState();
const oldShape = JSON.stringify(before.currentPiece.shape);

await tetris.rotate();

const after = await tetris.getGameState();
const newShape = JSON.stringify(after.currentPiece.shape);

if (oldShape !== newShape) {
    console.log('Rotated successfully');
} else {
    console.log('Rotation blocked');
}
```

**Rotation Mechanics:**

1. **Shape Transformation:**
   - The `shape` matrix rotates 90° clockwise
   - Algorithm: Transpose matrix, then reverse each row
   ```javascript
   // T-piece before: 2×3        // T-piece after: 3×2
   [[0,1,0],                     [[1,0],
    [1,1,1]]                      [1,1],
                                   [1,0]]
   ```

2. **Position Behavior:**
   - The (x, y) coordinates **do not change**
   - Rotation occurs around the top-left corner of the shape matrix
   - Only the shape changes, not the position

3. **Collision Handling:**
   - If the rotated shape collides with walls, floor, or blocks:
     - Rotation is **rejected**
     - Shape reverts to original orientation
     - **No wall kick** (automatic position adjustment)
   - Always check the shape after rotation to verify if it changed

**Example - Blocked Rotation:**
```javascript
// I-piece at x=9 (near right wall), horizontal orientation
const before = await tetris.getGameState();
console.log(before.currentPiece.shape); // [[1,1,1,1]] (4×1)

await tetris.rotate();

const after = await tetris.getGameState();
// Rotation blocked - vertical (1×4) would exceed right boundary
console.log(after.currentPiece.shape); // Still [[1,1,1,1]]
console.log(after.currentPiece.x);     // Still 9 (unchanged)
```

**Key Points:**
- Call `getGameState()` after rotation to verify if the shape changed
- Bounding box changes with rotation (e.g., 4×1 ↔ 1×4)
- No wall kick - rotation fails silently if the new shape doesn't fit

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
const result = await tetris.submitCaptcha(captchaId, code);
```

**Parameters:**
- `captchaId` (string): The CAPTCHA challenge ID from `getGameState()`
- `code` (string): The user's entered code (4 characters)

**Response on Success:**
```javascript
{
    success: true
}
```

**Response on Failure:**
```javascript
{
    success: false,
    error: "验证码错误"  // "CAPTCHA incorrect"
}
```

**What Happens After Successful Verification:**
1. The CAPTCHA challenge is cleared
2. `captchaVerified` event is triggered (see Event System)
3. Game automatically resumes
4. Subsequent `getGameState()` calls will show `captchaRequired: false`

**Example Flow:**
```javascript
// Method 1: Using API return value
const state = await tetris.getGameState();

if (state.captchaRequired) {
    console.log('CAPTCHA challenge detected');
    const imageUrl = tetris.getCaptchaImageUrl(state.captchaId);
    
    // Get the code (from OCR or user input)
    const code = await recognizeCaptcha(imageUrl); // Your OCR function
    
    // Submit and check result
    try {
        const result = await tetris.submitCaptcha(state.captchaId, code);
        console.log('CAPTCHA verified! Game continues.');
        
        // Verify the challenge is cleared
        const newState = await tetris.getGameState();
        console.log('CAPTCHA cleared:', !newState.captchaRequired); // true
    } catch (error) {
        console.error('CAPTCHA failed:', error.message);
        // Need to get new CAPTCHA and retry
    }
}

// Method 2: Using event listener (recommended for automated systems)
tetris.on('captchaRequired', async (data) => {
    console.log('CAPTCHA required:', data.captchaId);
    const code = await recognizeCaptcha(data.imageUrl);
    await tetris.submitCaptcha(data.captchaId, code);
});

tetris.on('captchaVerified', (data) => {
    console.log('CAPTCHA verification successful!');
    // Game has automatically resumed, continue playing
});
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
| `captchaRequired` | `{captchaId, imageUrl}` | CAPTCHA challenge triggered, game paused |
| `captchaVerified` | `{success: true}` | CAPTCHA verified successfully, game resumed |

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
