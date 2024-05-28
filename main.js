const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");
const score_tag = document.getElementById("score");
score_tag.innerHTML = "Score: 0 Lines: 0";
if (!gl) {
    console.error("WebGL not supported");
}

const ID_GAME = 1;
let screen = ID_GAME;

let paused = false;
let score = 0;
let lines = 0;
let rquad = -45.0, r_quad = 0.0, qrotate = 0.0;

class Block {
    constructor() {
        this.color = 0;
        this.r = 0.0;
        this.g = 0.0;
        this.b = 0.0;
    }

    copyBlock(block) {
        this.color = block.color;
        this.r = block.r;
        this.g = block.g;
        this.b = block.b;
    }

    clear() {
        this.color = 0;
        this.r = 0.0;
        this.g = 0.0;
        this.b = 0.0;
    }
}

class GameBlock extends Block {
    constructor() {
        super();
        this.x = 0;
        this.y = 0;
    }

    randColor() {
        const colors = [
            { r: 1.0, g: 0.0, b: 0.0, color: 2 }, // RED
            { r: 0.0, g: 1.0, b: 0.0, color: 3 }, // GREEN
            { r: 0.0, g: 0.0, b: 1.0, color: 4 }, // BLUE
            { r: 1.0, g: 1.0, b: 1.0, color: 1 }, // WHITE
            { r: 0.5, g: 0.5, b: 0.5, color: 5 }  // GRAY
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];
        this.r = color.r;
        this.g = color.g;
        this.b = color.b;
        this.color = color.color;
    }
}

const tiles = new Array(17).fill(null).map(() => new Array(8).fill(null).map(() => new Block()));
const gblock = [new GameBlock(), new GameBlock(), new GameBlock()];

// Shader sources
const vertexShaderSrc = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vTexCoord;
void main(void) {
    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
    vTexCoord = aTexCoord;
}`;

const fragmentShaderSrc = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uSampler;
void main(void) {
    gl_FragColor = texture2D(uSampler, vTexCoord);
}`;

// Compile shaders
function compileShader(src, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

const vertexShader = compileShader(vertexShaderSrc, gl.VERTEX_SHADER);
const fragmentShader = compileShader(fragmentShaderSrc, gl.FRAGMENT_SHADER);

// Create shader program
const shaderProgram = gl.createProgram();
gl.attachShader(shaderProgram, vertexShader);
gl.attachShader(shaderProgram, fragmentShader);
gl.linkProgram(shaderProgram);
if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error('Error linking shader program:', gl.getProgramInfoLog(shaderProgram));
}

gl.useProgram(shaderProgram);

const aPosition = gl.getAttribLocation(shaderProgram, 'aPosition');
const aTexCoord = gl.getAttribLocation(shaderProgram, 'aTexCoord');
const uModelViewMatrix = gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');
const uProjectionMatrix = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
const uSampler = gl.getUniformLocation(shaderProgram, 'uSampler');

// Ensure attribute locations are valid before enabling
if (aPosition !== -1) {
    gl.enableVertexAttribArray(aPosition);
}
if (aTexCoord !== -1) {
    gl.enableVertexAttribArray(aTexCoord);
}

// Create buffers
const positionBuffer = gl.createBuffer();
const texCoordBuffer = gl.createBuffer();

function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Placeholder for texture while loading
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]); // blue
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel);

    const image = new Image();
    image.crossOrigin = "anonymous"; // Allow cross-origin images
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);

        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
    };
    image.src = url;

    return texture;
}

function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

function setRectangle(x, y, z, width, height, depth) {
    const x1 = x;
    const x2 = x + width;
    const y1 = y;
    const y2 = y + height;
    const z1 = z;
    const z2 = z + depth;

    return new Float32Array([
        // Front face
        x1, y1, z1,
        x2, y1, z1,
        x1, y2, z1,
        x1, y2, z1,
        x2, y1, z1,
        x2, y2, z1,

        // Back face
        x1, y1, z2,
        x2, y1, z2,
        x1, y2, z2,
        x1, y2, z2,
        x2, y1, z2,
        x2, y2, z2,

        // Left face
        x1, y1, z1,
        x1, y2, z1,
        x1, y1, z2,
        x1, y1, z2,
        x1, y2, z1,
        x1, y2, z2,

        // Right face
        x2, y1, z1,
        x2, y2, z1,
        x2, y1, z2,
        x2, y1, z2,
        x2, y2, z1,
        x2, y2, z2,

        // Top face
        x1, y2, z1,
        x2, y2, z1,
        x1, y2, z2,
        x1, y2, z2,
        x2, y2, z1,
        x2, y2, z2,

        // Bottom face
        x1, y1, z1,
        x2, y1, z1,
        x1, y1, z2,
        x1, y1, z2,
        x2, y1, z1,
        x2, y1, z2
    ]);
}

function setTexCoords() {
    return new Float32Array([
        // Front face
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        0.0, 1.0,
        1.0, 0.0,
        1.0, 1.0,

        // Back face
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        0.0, 1.0,
        1.0, 0.0,
        1.0, 1.0,

        // Left face
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        0.0, 1.0,
        1.0, 0.0,
        1.0, 1.0,

        // Right face
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        0.0, 1.0,
        1.0, 0.0,
        1.0, 1.0,

        // Top face
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        0.0, 1.0,
        1.0, 0.0,
        1.0, 1.0,

        // Bottom face
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        0.0, 1.0,
        1.0, 0.0,
        1.0, 1.0
    ]);
}

function drawRectangle(x, y, z, width, height, depth, textureIndex) {
    gl.bindTexture(gl.TEXTURE_2D, textures[textureIndex]);

    const positions = setRectangle(x, y, z, width, height, depth);
    const texCoords = setTexCoords();

    // Bind and set buffer data for positions
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

    // Bind and set buffer data for texture coordinates
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0);

    // Correct number of vertices for a cube (6 faces, 2 triangles per face, 3 vertices per triangle)
    const vertexCount = positions.length / 3;

    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
}

let textures = [];

function initGL() {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    resizeGL(canvas.width, canvas.height);
    setScreen(ID_GAME);
    releaseBlock();
    setInterval(automaticMoveDown, 850); 
    textures.push(loadTexture(gl, 'img/block1.png'));
    textures.push(loadTexture(gl, 'img/block2.png'));
    textures.push(loadTexture(gl, 'img/block3.png'));
    textures.push(loadTexture(gl, 'img/block4.png'));
    textures.push(loadTexture(gl, 'img/block5.png'));
    textures.push(loadTexture(gl, 'img/block6.png'));
    textures.push(loadTexture(gl, 'img/block7.png'));
}

function resizeGL(width, height) {
    canvas.width = width;
    canvas.height = height;

    gl.viewport(0, 0, width, height);
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 45 * Math.PI / 180, width / height, 0.1, 100.0);
    gl.uniformMatrix4fv(uProjectionMatrix, false, projectionMatrix);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (screen === ID_GAME) {
        renderGame();
    }

    requestAnimationFrame(render);
}

function renderGame() {
    processBlocks();

    const modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [-10.0, 15.0, -45.0]);
    gl.uniformMatrix4fv(uModelViewMatrix, false, modelViewMatrix);

    // Score
    // Placeholder for text rendering

    mat4.rotate(modelViewMatrix, modelViewMatrix, rquad * Math.PI / 180, [1.0, 0.0, 0.0]);
    mat4.rotate(modelViewMatrix, modelViewMatrix, r_quad * Math.PI / 180, [0.0, 1.0, 0.0]);
    gl.uniformMatrix4fv(uModelViewMatrix, false, modelViewMatrix);

    drawBoard();
}

function drawBoard() {
    for (let i = 0; i < 17; i++) {
        for (let z = 0; z < 8; z++) {
            // Draw the static tiles
            if (tiles[i][z].color !== 0) {
                drawTileBlock(i, z, tiles[i][z], tiles[i][z].color - 1);
            }
        }
    }
    // Draw the current game block
    for (let p = 0; p < 3; p++) {
        drawGameBlock(gblock[p], gblock[p].color - 1);
    }
}

function drawGameBlock(block, textureIndex) {
   drawRectangle(block.x * 3.0, -block.y * 2.0, 0.0, 1.0, 1.0, 1.0, textureIndex);
}

function drawTileBlock(i, z, block, textureIndex) {
    drawRectangle(z * 3.0, -i * 2.0, 0.0, 1.0, 1.0, 1.0, textureIndex);
}

function keyDown(event) {
    const key = event.key;

    if (key === 'Escape') {
        // Handle escape key
        return;
    }

    if (screen === ID_GAME) {
        handleGameKeys(key);
    }
}

function handleGameKeys(key) {
    switch (key) {
        case 'h':
        case 'H':
            rquad = 0.0;
            r_quad = 0.0;
            break;
        case 'd':
        case 'D':
            rquad = -45.0;
            r_quad = 0.0;
            break;
        case 'v':
        case 'V':
            rquad = 1.5;
            r_quad = 67.0;
            break;
        case 'p':
        case 'P':
            paused = !paused;
            break;
        case 'ArrowLeft':
            moveLeft();
            break;
        case 'ArrowRight':
            moveRight();
            break;
        case 'ArrowDown':
            moveDown();
            break;
        case 'ArrowUp':
            shiftUp();
            break;
    }
}

function setScreen(newScreen) {
    screen = newScreen;
}

function releaseBlock() {
    do {
        gblock[0].randColor();
        gblock[1].randColor();
        gblock[2].randColor();
    } while (gblock[0].color === gblock[1].color && gblock[0].color === gblock[2].color);

    gblock[0].x = 3;
    gblock[0].y = 0;
    gblock[1].x = 3;
    gblock[1].y = 1;
    gblock[2].x = 3;
    gblock[2].y = 2;
}

function moveLeft() {
    if (gblock[0].x > 0 && tiles[gblock[0].y][gblock[0].x - 1].color === 0 &&
        tiles[gblock[1].y][gblock[1].x - 1].color === 0 && tiles[gblock[2].y][gblock[2].x - 1].color === 0) {
        gblock.forEach(block => block.x--);
    }
}

function moveRight() {
    if (gblock[0].x < 7 && tiles[gblock[0].y][gblock[0].x + 1].color === 0 &&
        tiles[gblock[1].y][gblock[1].x + 1].color === 0 && tiles[gblock[2].y][gblock[2].x + 1].color === 0) {
        gblock.forEach(block => block.x++);
    }
}

function moveDown() {
    let canMoveDown = true;
    for (let p = 0; p < 3; p++) {
        if (gblock[p].y >= 16 || (gblock[p].y < 16 && tiles[gblock[p].y + 1][gblock[p].x].color !== 0)) {
            canMoveDown = false;
            break;
        }
    }

    if (canMoveDown) {
        gblock.forEach(block => block.y++);
    } else {
        gblock.forEach(block => {
            tiles[block.y][block.x].copyBlock(block);
        });

        if (gblock[2].y < 3) {
            clearBoard();
            console.log("Game Over", score);
            score_tag.innerHTML = "Score: 0 Lines: 0";
        } else {
            releaseBlock();
        }
    }
}

function automaticMoveDown() {
    if (!paused && screen === ID_GAME) {
        moveDown();
    }
}

function processBlocks() {
    // Process matches and clear matched blocks
    for (let i = 0; i < 17; i++) {
        for (let z = 0; z < 8; z++) {
            const curColor = tiles[i][z].color;
            if (curColor !== 0) {
                if (z + 2 < 8 && tiles[i][z + 1].color === curColor && tiles[i][z + 2].color === curColor) {
                    tiles[i][z].clear();
                    tiles[i][z + 1].clear();
                    tiles[i][z + 2].clear();
                    addLine(0);
                    return;
                }
                if (z + 3 < 8 && tiles[i][z + 1].color === curColor && tiles[i][z + 2].color === curColor && tiles[i][z + 3].color === curColor) {
                    tiles[i][z].clear();
                    tiles[i][z + 1].clear();
                    tiles[i][z + 2].clear();
                    tiles[i][z + 3].clear();
                    addLine(1);
                    return;
                }
                if (i + 2 < 17 && tiles[i + 1][z].color === curColor && tiles[i + 2][z].color === curColor) {
                    tiles[i][z].clear();
                    tiles[i + 1][z].clear();
                    tiles[i + 2][z].clear();
                    addLine(0);
                    return;
                }
                if (i + 3 < 17 && tiles[i + 1][z].color === curColor && tiles[i + 2][z].color === curColor && tiles[i + 3][z].color === curColor) {
                    tiles[i][z].clear();
                    tiles[i + 1][z].clear();
                    tiles[i + 2][z].clear();
                    tiles[i + 3][z].clear();
                    addLine(1);
                    return;
                }
            }
        }
    }

    for (let i = 0; i < 17; i++) {
        for (let z = 0; z < 8; z++) {
            const curColor = tiles[i][z].color;
            if (curColor !== 0) {
                if (i + 2 < 17 && z + 2 < 8 && tiles[i + 1][z + 1].color === curColor && tiles[i + 2][z + 2].color === curColor) {
                    tiles[i][z].clear();
                    tiles[i + 1][z + 1].clear();
                    tiles[i + 2][z + 2].clear();
                    addLine(2);
                    return;
                }
                if (i - 2 >= 0 && z - 2 >= 0 && tiles[i - 1][z - 1].color === curColor && tiles[i - 2][z - 2].color === curColor) {
                    tiles[i][z].clear();
                    tiles[i - 1][z - 1].clear();
                    tiles[i - 2][z - 2].clear();
                    addLine(1);
                    return;
                }
                if (i - 2 >= 0 && z + 2 < 8 && tiles[i - 1][z + 1].color === curColor && tiles[i - 2][z + 2].color === curColor) {
                    tiles[i][z].clear();
                    tiles[i - 1][z + 1].clear();
                    tiles[i - 2][z + 2].clear();
                    addLine(1);
                    return;
                }
                if (i + 2 < 17 && z - 2 >= 0 && tiles[i + 1][z - 1].color === curColor && tiles[i + 2][z - 2].color === curColor) {
                    tiles[i][z].clear();
                    tiles[i + 1][z - 1].clear();
                    tiles[i + 2][z - 2].clear();
                    addLine(1);
                    return;
                }
            }
        }
    }

    // Apply gravity to make blocks fall
    for (let i = 15; i >= 0; i--) {
        for (let z = 0; z < 8; z++) {
            if (tiles[i][z].color !== 0 && tiles[i + 1][z].color === 0) {
                tiles[i + 1][z].copyBlock(tiles[i][z]);
                tiles[i][z].clear();
            }
        }
    }
}

function checkForMoveDown() {
    if (!paused) {
        moveDown();
    }
}

function clearBoard() {
    for (let i = 0; i < 17; i++) {
        for (let z = 0; z < 8; z++) {
            tiles[i][z].clear();
        }
    }
}

function addLine(type) {
    switch (type) {
        case 0:
            score += 5;
            break;
        case 1:
            score += 7;
            break;
        case 2:
            score += 10;
            break;
    }
    lines++;

    if (lines > 30) {
        xspeed = 5;
        return;
    }
    if (lines > 20) {
        xspeed = 7;
        return;
    }
    if (lines > 10) {
        xspeed = 10;
        return;
    }
    score_tag.innerText = "Score: " + score + " Lines: " + lines;
}

function shiftUp() {
    const temp = { color: gblock[0].color, r: gblock[0].r, g: gblock[0].g, b: gblock[0].b };

    gblock[0].color = gblock[1].color;
    gblock[0].r = gblock[1].r;
    gblock[0].g = gblock[1].g;
    gblock[0].b = gblock[1].b;

    gblock[1].color = gblock[2].color;
    gblock[1].r = gblock[2].r;
    gblock[1].g = gblock[2].g;
    gblock[1].b = gblock[2].b;

    gblock[2].color = temp.color;
    gblock[2].r = temp.r;
    gblock[2].g = temp.g;
    gblock[2].b = temp.b;
}

function shiftDown() {
    const temp = { color: gblock[2].color, r: gblock[2].r, g: gblock[2].g, b: gblock[2].b };

    gblock[2].color = gblock[1].color;
    gblock[2].r = gblock[1].r;
    gblock[2].g = gblock[1].g;
    gblock[2].b = gblock[1].b;

    gblock[1].color = gblock[0].color;
    gblock[1].r = gblock[0].r;
    gblock[1].g = gblock[0].g;
    gblock[1].b = gblock[0].b;

    gblock[0].color = temp.color;
    gblock[0].r = temp.r;
    gblock[0].g = temp.g;
    gblock[0].b = temp.b;
}

document.addEventListener("keydown", keyDown);

initGL();
requestAnimationFrame(render);