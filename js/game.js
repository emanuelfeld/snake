(function () {
  var Game = function (canvasId) {
    let canvas = document.getElementById(canvasId)

    this.screen = canvas.getContext('2d')
    this.size = { x: canvas.width, y: canvas.height }
    this.pixelSize = { x: 10, y: 10 }
    this.pixels = {
      x: this.size.x / this.pixelSize.x,
      y: this.size.y / this.pixelSize.y
    }

    this.score = 0
    this.active = true

    this.player = new Player(this)

    this.playerGrid = []
    this.coordinateGrid = []

    for (let x = 0; x < this.size.x / this.pixelSize.x; x++) {
      for (let y = 0; y < this.size.y / this.pixelSize.y; y++) {
        this.playerGrid.push(0)
        this.coordinateGrid.push({x: x, y: y})
      }
    }

    this.target = new Target(this.player, this)
    this.keyboard = new Keyboard(this.player, this)

    this.fps = 4
    let interval
    let timeCurrent
    let timePrevious = Date.now()
    let timeDelta

    this.start(this.player, this.target)

    let self = this

    function run () {
      if (self.player.alive === false) {
        self.end(self.player)
        return
      }

      timeCurrent = Date.now()
      timeDelta = timeCurrent - timePrevious
      interval = 1000 / self.fps

      if (timeDelta > interval) {
        timePrevious = timeCurrent - (timeDelta % interval)
        self.update(self.player, self.target)
        self.draw(self.player, self.target)
      }

      if (self.active) {
        window.requestAnimationFrame(run)
      }
    }

    run()
  }

  Game.prototype = {
    start: function () {
      this.screen.clearRect(0, 0, this.size.x, this.size.y)
      drawPixel(this.screen, this.player.location[0], this.player.size)
      drawPixel(this.screen, this.target.location, this.target.size, '#ff0000')
      displayCurrentScore(this.score)
      displayTopScores()
    },

    update: function () {
      let grew = this.player.update(this)
      if (grew) {
        this.score++
        displayCurrentScore(this.score)
        this.fps += 0.5
        this.target.update(this)
      }
    },

    end: function () {
      if (this.active) {
        saveScore(this.score)
        this.active = false
      }

      if (this.player.alive === false) {
        displayGameOver()
      }

      displayTopScores()
    },

    draw: function () {
      if (this.player.trail) {
        removePixel(this.screen, this.player.trail, this.player.size)
      }
      drawPixel(this.screen, this.player.location[0], this.player.size)
      drawPixel(this.screen, this.target.location, this.target.size, '#ff0000')
    }
  }

  var Player = function (game) {
    this.game = game
    this.alive = true
    this.size = game.pixelSize
    this.location = [{ x: 1, y: 12 }]
    this.trail = null
    this.step = 1
    this.velocity = { x: 1, y: 0 }
  }

  Player.prototype = {
    update: function () {
      let headNew = {
        x: this.location[0].x + this.velocity.x,
        y: this.location[0].y + this.velocity.y
      }

      this.location.unshift(headNew)
      this.game.playerGrid[this.location[0].x * this.game.pixels.x + this.location[0].y] = 1

      let growth = this.location.pop()
      let head = this.location[0]
      let tail = this.location.slice(1)
      let target = this.game.target.location

      if (this.hitWall(head) || this.hitObject(head, tail)) {
        this.alive = false
        return false
      } else if (this.hitObject(head, target)) {
        this.location.push(growth)
        this.trail = null
        return true
      }

      this.trail = growth
      this.game.playerGrid[this.trail.x * this.game.pixels.x + this.trail.y] = 0
      return false
    },

    hitWall: function (head) {
      return (head.x < 0 ||
              head.y < 0 ||
              head.x > this.game.pixels.x - 1 ||
              head.y > this.game.pixels.y - 1)
    },

    hitObject: function (head, object) {
      if (!object.length) {
        return colliding(head, object)
      }

      let collision = false
      for (let i = 0; i < object.length; i++) {
        if (colliding(head, object[i])) {
          collision = true
          break
        }
      }

      return collision
    },

    possibleMove: function (axis, nextAxis, direction) {
      if (this.game.score === 0) {
        return true
      }

      return (this.velocity[axis] !== 0 &&
             (this.location[direction][nextAxis] - this.location[1 - direction][nextAxis]) !== this.step)
    }
  }

  var Target = function (player, game) {
    this.game = game
    this.player = player
    this.size = game.pixelSize
    this.update()
  }

  Target.prototype = {
    update: function () {
      let self = this

      function naiveRandom () {
        let found = false
        let result = null
        while (!found) {
          let attempt = {
            x: getRandomInt(0, self.game.pixels.x),
            y: getRandomInt(0, self.game.pixels.y)
          }
          if (!colliding(attempt, self.player.location)) {
            found = true
            result = attempt
            break
          }
        }
        return result
      }

      function filteredRandom () {
        let openCoordinates = []
        for (let i = 0; i < self.game.playerGrid.length; i++) {
          if (self.game.playerGrid[i] === 0) {
            openCoordinates.push(self.game.coordinateGrid[i])
          }
        }
        return openCoordinates[getRandomInt(0, openCoordinates.length - 1)]
      }

      if (this.game.score < 670) {
        this.location = naiveRandom()
      } else {
        this.location = filteredRandom()
      }
    }
  }

  var Keyboard = function (player, game) {
    let KEYS = { LEFT: 37, RIGHT: 39, UP: 38, DOWN: 40 }

    window.onkeydown = function (e) {
      if ([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        e.preventDefault()

        if (e.keyCode === KEYS.LEFT && player.possibleMove('y', 'x', 0)) {
          player.velocity = { x: -player.step, y: 0 }
        } else if (e.keyCode === KEYS.RIGHT && player.possibleMove('y', 'x', 1)) {
          player.velocity = { x: player.step, y: 0 }
        } else if (e.keyCode === KEYS.DOWN && player.possibleMove('x', 'y', 1)) {
          player.velocity = { x: 0, y: player.step }
        } else if (e.keyCode === KEYS.UP && player.possibleMove('x', 'y', 0)) {
          player.velocity = { x: 0, y: -player.step }
        }
      }
    }
  }

  function colliding (b1, b2) {
    return (b1.x === b2.x && b1.y === b2.y)
  }

  function getRandomInt (min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min)) + min
  }

  function drawPixel (screen, location, size, color = '#000000') {
    screen.fillStyle = color
    screen.fillRect(location.x * size.x,
                    location.y * size.y,
                    size.x, size.y)
  }

  function removePixel (screen, location, size) {
    screen.clearRect(location.x * size.x,
                     location.y * size.y,
                     size.x, size.y)
  }

  function saveScore (score) {
    let numScores = 0
    let topScores = JSON.parse(window.localStorage.getItem('snakeScore'))

    if (topScores) {
      numScores = topScores.length
    }

    let scoreDate = new Date()
    let scoreObj = { 'datetime': scoreDate.toDateString(), 'score': score }

    if (numScores === 0 && score !== 0) {
      topScores = [scoreObj]
    } else if (numScores > 0 && topScores[numScores - 1].score <= score) {
      for (let i = 0; i < numScores; i++) {
        if (topScores[i].score <= score) {
          topScores.splice(i, 0, scoreObj)
          break
        }
      }
    } else if (score !== 0 && numScores < 5) {
      topScores.push(scoreObj)
    }

    if (topScores && topScores.length > 5) {
      topScores.pop()
    }

    window.localStorage.setItem('snakeScore', JSON.stringify(topScores))
  }

  function displayTopScores () {
    let numScores = 0
    let topScores = JSON.parse(window.localStorage.getItem('snakeScore'))

    if (topScores) {
      numScores = topScores.length
      if (numScores === 0) {
        return
      }
      document.getElementById('scores').removeAttribute('hidden')
    }

    let displayHTML = ''
    for (let i = 0; i < numScores; i++) {
      displayHTML += topScores[i].datetime + '&emsp;' + topScores[i].score + '<br>'
    }
    document.getElementById('scores-list').innerHTML = displayHTML
  }

  function displayCurrentScore (score) {
    document.getElementById('current-score').innerHTML = score
  }

  function displayGameOver () {
    let gameTitle = document.getElementById('game-title')
    gameTitle.className = 'game-over'
    gameTitle.innerHTML = 'DEAD SNAKE'
  }

  window.onload = function () {
    let game = new Game('screen')

    document.getElementById('new-game').onclick = function () {
      game.end(game.player)

      let gameTitle = document.getElementById('game-title')
      gameTitle.innerHTML = 'SNAKE'
      gameTitle.className = 'game-restart'

      setTimeout(function () {
        game = new Game('screen')
      }, 1000)
    }
  }
})()
