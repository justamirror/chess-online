let express = require('express');
let fs = require('fs');
let app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
var EventEmitter = require('eventemitter2');

let worldSize = [16, 16];

function createArray(length) {
  var arr = new Array(length || 0),
    i = length;

  if (arguments.length > 1) {
    var args = Array.prototype.slice.call(arguments, 1);
    while(i--) arr[length-1 - i] = createArray.apply(this, args);
  }

  return arr;
}

let board = createArray(...worldSize);

let teamID = 0;

class Team extends EventEmitter {
  constructor(name, color, id=(teamID++)) {
    super()
    this.name = name;
    this.color = color;
    this.inTeam = []
    this.id = id;
  }
  addPiece(piece) {
    this.inTeam[piece.id] = true;
    piece.changeTeam(this);
    this.emit('piece-added', piece);
    let myself = this;
    piece.on('team-changed', function (team) {
      if (team.id !== myself.id) {
        delete myself.inTeam[piece.id];
      }
    })
  }
}

class NullTeam extends Team {
  constructor() {
    super(null, '#8b8ba7');
    this.nullTeam = true;
  }
}

NullTeam = new NullTeam();

let pieceID = 0;
let __pieces = []
function pieceInTheWay(ogX, ogY, newX, newY) {
  if (ogX === newX && ogY === newY) return false;
  let direction = Math.atan2(newX-ogX, newY - ogY);
  let [dirX, dirY] = [Math.cos(direction), Math.sin(direction)];


  let rx = ogX;
  let ry = ogY;

  let x = rx;
  let y = ry;
  
  while (x !== newX && y !== newY) {
    rx += dirX; ry += dirY; x = Math.round(rx); y = Math.round(ry);
    if (board[x][y] !== undefined && x !== ogX && y !== ogY && x !== newX && y !== newY) {
      return true
    }
  }
  return false
}
class Piece extends EventEmitter {
  constructor(piece, x=0, y=0, id=(pieceID++)) {
    super()
    __pieces[id] = this;
    this.piece = piece;
    this.x = x;
    this.y = y;
    this.id = id;
    this.team = NullTeam;
    board[x][y] = this;
    this.team.addPiece(this);

    let myself = this;

    this.onAny(function (event, ...args) {
      Piece.events.emit(event, myself, ...args)
    })
  } 
  changeTeam(value) {
    this.team = value;
    this.emit('team-changed', value)
  }
  move(x, y) {
    let old = [this.x, this.y]
    let [up, left] = [this.y - y, this.x - x];
    let [down, right] = [-up, -left]
    if (x < 0 || x >= worldSize[0] || y < 0 || y >= worldSize[1]) {
      return false
    }
    if (this.piece === 'king') {
      if (up > 1 || down > 1 || left > 1 || right > 1) {
        return false
      }
    } else if (this.piece === 'queen') {
      let stuff = [up, down, left, right].filter(item=>item > 0);
      let good = true;
      for (let i = 0; i < stuff.length; i++) {
        let a = stuff[i];
        let b = stuff[i+1] || stuff[0];
        if (a !== b) {
          good = false;
          break;
        }
      }
      if (!good) {
        return false
      }
    } else if (this.piece === 'bishop') {
      let stuff = [up, down, left, right].filter(item=>item > 0);
      if (stuff.length !== 2) {
        return false
      }
      let good = true;
      for (let i = 0; i < stuff.length; i++) {
        let a = stuff[i];
        let b = stuff[i+1] || stuff[0];
        if (a !== b) {
          good = false;
          break;
        }
      }
      if (!good) {
        return false
      }
    } else if (this.piece === 'knight') {
      let stuff = [up, down, left, right].filter(item=>item > 0).sort();
      if (stuff.length !== 2) {
        return false
      }
      if (!(stuff[0] === 1 && stuff[1] === 2)) {
        return false
      }
    } else if (this.piece === 'rook') {
      let stuff = [up, down, left, right].filter(item=>item > 0);
      if (stuff.length !== 1) {
        return false
      }
      let good = true;
      for (let i = 0; i < stuff.length; i++) {
        let a = stuff[i];
        let b = stuff[i+1] || stuff[0];
        if (a !== b) {
          good = false;
          break;
        }
      }
      if (!good) {
        return false
      }
    }
    if (this.piece !== 'knight' && pieceInTheWay(this.x, this.y, x, y)) {
      return false
    }
    if (this.team.id === board[x][y]?.team?.id) {
      return false
    }
    this.x = x; this.y = y;
    board[this.x][this.y] = undefined;
    board[this.x][this.y] = this;
    this.emit('moved', {
      x: old[0],
      y: old[1]
    })
    return true
  }
}

Piece.events = new EventEmitter();
Piece.get = function (id) {
  return __pieces[id]
}
function degrees(degrees) {
  return degrees
}

Piece.events.on('moved', function (piece, old) {
  io.emit('change', {
    x: old.x,
    y: old.y,
    value: null
  }, {
    x: piece.x,
    y: piece.y,
    value: piece
  })
})
let path = require('path');

app.use(express.static(path.join(__dirname, 'static')));

new Piece('king', 10, 10);

io.on('connection', function (socket) {
  socket.data = new Team(socket.id, 'red');
  socket.data.addPiece(new Piece('queen'))
  socket.emit('data', board, socket.data);
  socket.on('move', function (id, x, y) {
    if (socket.data.inTeam[id]) {
      Piece.get(id).move(x, y)
    }
  })
})

server.listen(3000, () => {
  console.log('listening on *:3000');
});