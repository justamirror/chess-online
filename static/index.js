let version = location.host.startsWith('beta') ? 'beta' : 'stable';

if (version === 'beta') {
  document.title += ' | Beta';
  let a = document.getElementById('version-switch');
  a.href = 'https://chess-online.repl.co/';
  a.innerText = 'Switch to Stable'
}

async function load(imgs) {
  function loadOne(url) {
    return new Promise((accept, reject)=>{
      let image = new Image();
      image.addEventListener('error', reject);
      image.addEventListener('load', ()=>accept(image));
      image.src = urln
    })
  }
  let promises = [];

  function process(obj) {
    for (let [name, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        promises.push((async () => {
          obj[name] = await loadOne(value)
        })())
      } else {
        process(value);
      }
    }
  }

  process(imgs)

  await Promise.all(promises);
  return imgs
}

let images = await load({
  pieces: {
    king: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Chess_klt60.png',
    bishop: 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Chess_blt60.png',
    knight: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Chess_nlt60.png',
    pawn: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Chess_plt60.png',
    queen: 'https://upload.wikimedia.org/wikipedia/commons/4/49/Chess_qlt60.png',
    rook: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Chess_rlt60.png'
  }
});

window.images = images;

// https://web.dev/canvas-hidipi/

function setupCanvas(canvas) {
  // Get the device pixel ratio, falling back to 1.
  var dpr = window.devicePixelRatio || 1;
  // Get the size of the canvas in CSS pixels.
  var rect = canvas.getBoundingClientRect();
  // Give the canvas pixel dimensions of their CSS
  // size * the device pixel ratio.
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  var ctx = canvas.getContext('2d');
  // Scale all drawing operations by the dpr, so you
  // don't have to worry about the difference.
  ctx.scale(dpr, dpr);
  // Scale by scale variable.
  ctx.scale(scale, scale);
  return ctx;
}

let scale = 40;

let ctx = setupCanvas(document.querySelector('canvas'));

start.onclick = function () {
  login.style.display = 'none';
  let socket = io(location.origin, { query: "version="+version });
  let board = []
  let myTeam = {
    id: ''
  }
  let hoveredTile = {
    x: null,
    y: null
  }
  let selectedPiece = null;
  socket.on('data', function (b, m) {
    board = b;
    myTeam = m;
    for (let x = 0; x < board.length; x++) {
      for (let y = 0; y < board[x].length; y++) {
        let piece = board[x][y];
        ctx.fillStyle = (x + y) % 2 ? "black" : 'white';
        ctx.fillRect(x, y, 1, 1);
        if (piece === null) continue;
        drawPiece(piece.piece, piece.team.color, piece.x, piece.y);
      }
    }
  });
  socket.on('change', function (...values) {
    for (let { x, y, value } of values) {
      board[x][y] = value;
      renderTile(x, y)
    }
  })
  function hover(event) {
    let oldHovered = hoveredTile;
    
    hoveredTile = {
      x: Math.floor(event.clientX / scale), 
      y: Math.floor(event.clientY / scale)
    }

    renderTile(hoveredTile.x, hoveredTile.y)
    renderTile(oldHovered.x, oldHovered.y)
  }
  document.addEventListener('mousemove', hover);
  function renderTile(x, y) {
    if (x === null || y === null) return;
    console.log(x, y, board)
    let piece = board[x]?.[y] || null;
    if (x < 0 || x >= board.length || y < 0 || y >= board[0].length) {
      return
    }
    ctx.fillStyle = (x + y) % 2 ? "black" : 'white';
    ctx.fillRect(x, y, 1, 1);
    if (piece === null) return;
    if (piece.team.id === myTeam.id) {
      if (piece.id === selectedPiece?.id) {
        ctx.fillStyle = '#668cff';
        ctx.fillRect(x, y, 1, 1);
      } else if (piece.x === hoveredTile.x && piece.y === hoveredTile.y) {
        ctx.fillStyle = '#a6a6a6';
        ctx.fillRect(hoveredTile.x, hoveredTile.y, 1, 1);
      }
    }
    drawPiece(piece.piece, piece.team.color, piece.x, piece.y);
  }
  document.addEventListener('click', function (event) {
    hover(event);
    let piece = board[hoveredTile.x]?.[hoveredTile.y] || null;

    if (piece !== null && piece.team.id === myTeam.id) {
      if (selectedPiece?.id == piece.id) {
        selectedPiece = null
      } else {
        selectedPiece = piece;
      }
      renderTile(hoveredTile.x, hoveredTile.y)
    } else if (selectedPiece !== null) {
      socket.emit('move', selectedPiece.id, hoveredTile.x, hoveredTile.y)
    }
  })
}

function drawPiece(name, color="black", x, y) {
  let image = images.pieces[name];
  const c = document.createElement("canvas");
  c.width = image.width;
  c.height = image.height;
  c.ctx = c.getContext("2d"); // attach context to the canvas for easy reference
  c.ctx.drawImage(image,0,0);

  c.ctx.globalCompositeOperation = 'source-in';
  c.ctx.fillStyle = "black";
  c.ctx.fillRect(0,0,image.width,image.height);
  const c2 = document.createElement("canvas");
  c2.width = image.width;
  c2.height = image.height;
  c2.ctx = c2.getContext("2d"); // attach context to the canvas for easy reference
  c2.ctx.drawImage(image,0,0);
  c2.ctx.globalCompositeOperation = 'multiply';
  c2.ctx.fillStyle = color;
  c2.ctx.fillRect(0,0,image.width,image.height);
  c.ctx.drawImage(c2, 0,0);
  ctx.drawImage(c, x, y, 1, 1)
}