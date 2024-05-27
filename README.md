# MasterPiece3D.JavaScript

![screenshot](https://github.com/lostjared/MasterPiece3D.JavaScript/blob/main/mp3d.jpg)

Conversion of an old C++ OpenGL GLUT demo to JavaScript/WebGL
This is a WebGL-based block game where the player can control falling 
blocks, rotate their colors, and attempt to match colors in a grid.

The original project source code can be found here:
https://github.com/lostjared/Old.Learning.Projects/tree/master/mp3d_win32_vs.net2003

## Features

- Control falling blocks using keyboard inputs.
- Rotate block colors using 'A' and 'S' keys.
- Move blocks left, right, and down using arrow keys.
- New blocks are released periodically.
- Basic game mechanics implemented with WebGL for rendering.

## Controls

- **Arrow Keys**: Move the block left, right, and down.
- **Up Arrow Key**: Rotate the colors
- **H / h**: Reset rotation angles.
- **D / d**: Set specific rotation angle for the block.
- **V / v**: Set different specific rotation angles.

### Prerequisites

- Web browser with WebGL support (most modern browsers).

## Project Structure

- `index.html`: The main HTML file.
- `main.js`: The main JavaScript file containing game logic and WebGL 
rendering.
- `gl-matrix.js`: A library for matrix operations (used for 
transformations in WebGL).
