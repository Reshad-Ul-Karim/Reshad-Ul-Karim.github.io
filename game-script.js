// ===== GAME SCRIPT =====
class ReshadGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.currentLevel = 0;
        this.score = 0;
        this.lives = 3;
        this.coins = 0;
        this.collectedCoins = 0; // Track collected coins separately
        this.achievements = 0;
        
        // Player object
        this.player = {
            x: 50,
            y: 400,
            width: 40,
            height: 40,
            velocityX: 0,
            velocityY: 0,
            speed: 5,
            jumpPower: 15,
            onGround: false,
            powerUps: {
                tech: 0,
                leadership: 0,
                research: 0
            }
        };
        
        // Game objects
        this.platforms = [];
        this.coins = [];
        this.powerUps = [];
        this.enemies = [];
        this.collectibles = [];
        this.particles = [];
        this.movingObstacles = [];
        this.bullets = [];
        
        // Player sprites
        this.playerSprites = {
            standing: null,
            shooting: null
        };
        this.isShooting = false;
        this.shootingTimer = 0;
        
        // Level data
        this.levels = [
            {
                title: "The Beginning",
                description: "Start your journey at Notre Dame College",
                year: "2019-2020",
                platforms: [
                    {x: 0, y: 500, width: 200, height: 20, type: 'ground'},
                    {x: 250, y: 450, width: 150, height: 20, type: 'platform'},
                    {x: 450, y: 400, width: 150, height: 20, type: 'platform'},
                    {x: 650, y: 350, width: 150, height: 20, type: 'platform'},
                    {x: 850, y: 500, width: 200, height: 20, type: 'ground'},
                    {x: 1100, y: 500, width: 100, height: 20, type: 'ground'}
                ],
                coins: [
                    {x: 100, y: 450, collected: false},
                    {x: 300, y: 400, collected: false},
                    {x: 500, y: 350, collected: false},
                    {x: 700, y: 300, collected: false},
                    {x: 900, y: 450, collected: false}
                ],
                powerUps: [
                    {x: 350, y: 400, type: 'tech', collected: false},
                    {x: 550, y: 350, type: 'leadership', collected: false}
                ],
                movingObstacles: [
                    {x: 300, y: 420, width: 30, height: 30, velocityX: -1, minX: 250, maxX: 400, type: 'enemy'},
                    {x: 500, y: 370, width: 30, height: 30, velocityX: 1, minX: 450, maxX: 600, type: 'enemy'}
                ],
                goal: {x: 1150, y: 400, width: 50, height: 100}
            },
            {
                title: "The Foundation",
                description: "Join BRAC University and Mars Rover Team",
                year: "2020-2022",
                platforms: [
                    {x: 0, y: 500, width: 150, height: 20, type: 'ground'},
                    {x: 200, y: 450, width: 100, height: 20, type: 'platform'},
                    {x: 350, y: 400, width: 100, height: 20, type: 'platform'},
                    {x: 500, y: 350, width: 100, height: 20, type: 'platform'},
                    {x: 650, y: 300, width: 100, height: 20, type: 'platform'},
                    {x: 800, y: 250, width: 100, height: 20, type: 'platform'},
                    {x: 950, y: 500, width: 200, height: 20, type: 'ground'},
                    {x: 1150, y: 500, width: 50, height: 20, type: 'ground'}
                ],
                coins: [
                    {x: 150, y: 450, collected: false},
                    {x: 250, y: 400, collected: false},
                    {x: 400, y: 350, collected: false},
                    {x: 550, y: 300, collected: false},
                    {x: 700, y: 250, collected: false},
                    {x: 850, y: 200, collected: false},
                    {x: 1000, y: 450, collected: false}
                ],
                powerUps: [
                    {x: 300, y: 400, type: 'tech', collected: false},
                    {x: 600, y: 250, type: 'research', collected: false}
                ],
                movingObstacles: [
                    {x: 250, y: 420, width: 30, height: 30, velocityX: -1, minX: 200, maxX: 300, type: 'enemy'},
                    {x: 400, y: 370, width: 30, height: 30, velocityX: 1, minX: 350, maxX: 450, type: 'enemy'},
                    {x: 700, y: 220, width: 30, height: 30, velocityX: -1, minX: 650, maxX: 750, type: 'enemy'}
                ],
                goal: {x: 1175, y: 400, width: 25, height: 100}
            },
            {
                title: "The Breakthrough",
                description: "Achieve URC 2025 Top 8 Global Ranking",
                year: "2022-2024",
                platforms: [
                    {x: 0, y: 500, width: 100, height: 20, type: 'ground'},
                    {x: 150, y: 450, width: 80, height: 20, type: 'platform'},
                    {x: 280, y: 400, width: 80, height: 20, type: 'platform'},
                    {x: 410, y: 350, width: 80, height: 20, type: 'platform'},
                    {x: 540, y: 300, width: 80, height: 20, type: 'platform'},
                    {x: 670, y: 250, width: 80, height: 20, type: 'platform'},
                    {x: 800, y: 200, width: 80, height: 20, type: 'platform'},
                    {x: 930, y: 150, width: 80, height: 20, type: 'platform'},
                    {x: 1060, y: 500, width: 140, height: 20, type: 'ground'}
                ],
                coins: [
                    {x: 100, y: 450, collected: false},
                    {x: 200, y: 400, collected: false},
                    {x: 330, y: 350, collected: false},
                    {x: 460, y: 300, collected: false},
                    {x: 590, y: 250, collected: false},
                    {x: 720, y: 200, collected: false},
                    {x: 850, y: 150, collected: false},
                    {x: 980, y: 100, collected: false},
                    {x: 1100, y: 450, collected: false}
                ],
                powerUps: [
                    {x: 250, y: 400, type: 'tech', collected: false},
                    {x: 500, y: 250, type: 'leadership', collected: false},
                    {x: 750, y: 150, type: 'research', collected: false}
                ],
                movingObstacles: [
                    {x: 200, y: 420, width: 30, height: 30, velocityX: -1, minX: 150, maxX: 230, type: 'enemy'},
                    {x: 350, y: 370, width: 30, height: 30, velocityX: 1, minX: 280, maxX: 360, type: 'enemy'},
                    {x: 500, y: 320, width: 30, height: 30, velocityX: -1, minX: 410, maxX: 490, type: 'enemy'},
                    {x: 750, y: 170, width: 30, height: 30, velocityX: 1, minX: 670, maxX: 750, type: 'enemy'}
                ],
                goal: {x: 1120, y: 400, width: 80, height: 100}
            },
            {
                title: "The Innovation",
                description: "Current Research and Healthcare Innovation",
                year: "2024-Present",
                platforms: [
                    {x: 0, y: 500, width: 80, height: 20, type: 'ground'},
                    {x: 130, y: 450, width: 60, height: 20, type: 'platform'},
                    {x: 240, y: 400, width: 60, height: 20, type: 'platform'},
                    {x: 350, y: 350, width: 60, height: 20, type: 'platform'},
                    {x: 460, y: 300, width: 60, height: 20, type: 'platform'},
                    {x: 570, y: 250, width: 60, height: 20, type: 'platform'},
                    {x: 680, y: 200, width: 60, height: 20, type: 'platform'},
                    {x: 790, y: 150, width: 60, height: 20, type: 'platform'},
                    {x: 900, y: 100, width: 60, height: 20, type: 'platform'},
                    {x: 1010, y: 50, width: 60, height: 20, type: 'platform'},
                    {x: 1120, y: 500, width: 80, height: 20, type: 'ground'}
                ],
                coins: [
                    {x: 80, y: 450, collected: false},
                    {x: 180, y: 400, collected: false},
                    {x: 290, y: 350, collected: false},
                    {x: 400, y: 300, collected: false},
                    {x: 510, y: 250, collected: false},
                    {x: 620, y: 200, collected: false},
                    {x: 730, y: 150, collected: false},
                    {x: 840, y: 100, collected: false},
                    {x: 950, y: 50, collected: false},
                    {x: 1060, y: 0, collected: false},
                    {x: 1160, y: 450, collected: false}
                ],
                powerUps: [
                    {x: 200, y: 400, type: 'tech', collected: false},
                    {x: 420, y: 250, type: 'leadership', collected: false},
                    {x: 640, y: 150, type: 'research', collected: false},
                    {x: 860, y: 50, type: 'tech', collected: false}
                ],
                movingObstacles: [
                    {x: 150, y: 420, width: 30, height: 30, velocityX: -1, minX: 130, maxX: 190, type: 'enemy'},
                    {x: 280, y: 370, width: 30, height: 30, velocityX: 1, minX: 240, maxX: 300, type: 'enemy'},
                    {x: 400, y: 320, width: 30, height: 30, velocityX: -1, minX: 350, maxX: 410, type: 'enemy'},
                    {x: 520, y: 270, width: 30, height: 30, velocityX: 1, minX: 460, maxX: 520, type: 'enemy'},
                    {x: 640, y: 220, width: 30, height: 30, velocityX: -1, minX: 570, maxX: 630, type: 'enemy'},
                    {x: 760, y: 170, width: 30, height: 30, velocityX: 1, minX: 680, maxX: 740, type: 'enemy'}
                ],
                goal: {x: 1140, y: 400, width: 60, height: 100}
            }
        ];
        
        // Audio
        this.audio = {
            music: new Audio(),
            jump: new Audio(),
            coin: new Audio(),
            powerup: new Audio(),
            achievement: new Audio(),
            muted: false
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadSprites();
        this.loadLevel(0);
        this.gameLoop();
    }
    
    loadSprites() {
        // Load standing sprite
        this.playerSprites.standing = new Image();
        this.playerSprites.standing.src = 'assets/game-sprite/Standing.png';
        
        // Load shooting sprite
        this.playerSprites.shooting = new Image();
        this.playerSprites.shooting.src = 'assets/game-sprite/Shooting.png';
    }
    
    setupEventListeners() {
        // Menu buttons
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
        document.getElementById('instructions').addEventListener('click', () => this.showInstructions());
        document.getElementById('close-instructions').addEventListener('click', () => this.hideInstructions());
        document.getElementById('back-to-portfolio').addEventListener('click', () => this.backToPortfolio());
        document.getElementById('play-again').addEventListener('click', () => this.restartGame());
        document.getElementById('back-to-portfolio-end').addEventListener('click', () => this.backToPortfolio());
        
        // Audio controls
        document.getElementById('mute-btn').addEventListener('click', () => this.toggleMute());
        document.getElementById('music-btn').addEventListener('click', () => this.toggleMusic());
        
        // Mobile controls
        document.getElementById('mobile-left').addEventListener('touchstart', (e) => this.handleMobileInput(e, 'left', 'down'));
        document.getElementById('mobile-left').addEventListener('touchend', (e) => this.handleMobileInput(e, 'left', 'up'));
        document.getElementById('mobile-left').addEventListener('mousedown', (e) => this.handleMobileInput(e, 'left', 'down'));
        document.getElementById('mobile-left').addEventListener('mouseup', (e) => this.handleMobileInput(e, 'left', 'up'));
        
        document.getElementById('mobile-right').addEventListener('touchstart', (e) => this.handleMobileInput(e, 'right', 'down'));
        document.getElementById('mobile-right').addEventListener('touchend', (e) => this.handleMobileInput(e, 'right', 'up'));
        document.getElementById('mobile-right').addEventListener('mousedown', (e) => this.handleMobileInput(e, 'right', 'down'));
        document.getElementById('mobile-right').addEventListener('mouseup', (e) => this.handleMobileInput(e, 'right', 'up'));
        
        document.getElementById('mobile-jump').addEventListener('touchstart', (e) => this.handleMobileInput(e, 'jump', 'down'));
        document.getElementById('mobile-jump').addEventListener('click', (e) => this.handleMobileInput(e, 'jump', 'down'));
        
        document.getElementById('mobile-action').addEventListener('touchstart', (e) => this.handleMobileInput(e, 'action', 'down'));
        document.getElementById('mobile-action').addEventListener('click', (e) => this.handleMobileInput(e, 'action', 'down'));
        
        document.getElementById('mobile-fire').addEventListener('touchstart', (e) => this.handleMobileInput(e, 'fire', 'down'));
        document.getElementById('mobile-fire').addEventListener('click', (e) => this.handleMobileInput(e, 'fire', 'down'));
        
        // Prevent default touch behaviors
        document.getElementById('mobile-left').addEventListener('touchstart', (e) => e.preventDefault());
        document.getElementById('mobile-right').addEventListener('touchstart', (e) => e.preventDefault());
        document.getElementById('mobile-jump').addEventListener('touchstart', (e) => e.preventDefault());
        document.getElementById('mobile-action').addEventListener('touchstart', (e) => e.preventDefault());
        document.getElementById('mobile-fire').addEventListener('touchstart', (e) => e.preventDefault());
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }
    
    startGame() {
        this.gameState = 'playing';
        document.getElementById('game-menu').style.display = 'none';
        this.resetPlayer();
    }
    
    restartGame() {
        this.currentLevel = 0;
        this.score = 0;
        this.lives = 3;
        this.coins = 0;
        this.collectedCoins = 0;
        this.achievements = 0;
        this.player.powerUps = {tech: 0, leadership: 0, research: 0};
        this.bullets = [];
        this.movingObstacles = [];
        document.getElementById('game-over').style.display = 'none';
        this.loadLevel(0);
        this.startGame();
    }
    
    backToPortfolio() {
        window.location.href = 'index.html';
    }
    
    showInstructions() {
        document.getElementById('instructions-modal').style.display = 'flex';
    }
    
    hideInstructions() {
        document.getElementById('instructions-modal').style.display = 'none';
    }
    
    toggleMute() {
        this.audio.muted = !this.audio.muted;
        const btn = document.getElementById('mute-btn');
        btn.classList.toggle('muted', this.audio.muted);
        btn.innerHTML = this.audio.muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
    }
    
    toggleMusic() {
        // Music toggle functionality
        const btn = document.getElementById('music-btn');
        btn.classList.toggle('muted');
    }
    
    loadLevel(levelIndex) {
        this.currentLevel = levelIndex;
        const level = this.levels[levelIndex];
        
        // Update UI
        document.getElementById('level-title').textContent = level.title;
        document.getElementById('level-description').textContent = level.description;
        
        // Load platforms
        this.platforms = level.platforms.map(platform => ({...platform}));
        
        // Load coins
        this.coins = level.coins.map(coin => ({...coin}));
        
        // Load power-ups
        this.powerUps = level.powerUps.map(powerUp => ({...powerUp}));
        
        // Load moving obstacles
        this.movingObstacles = level.movingObstacles.map(obstacle => ({...obstacle}));
        
        // Reset player position
        this.resetPlayer();
    }
    
    resetPlayer() {
        this.player.x = 50;
        this.player.y = 400;
        this.player.velocityX = 0;
        this.player.velocityY = 0;
        this.player.onGround = false;
    }
    
    handleMobileInput(e, action, type) {
        if (this.gameState !== 'playing') return;
        
        e.preventDefault();
        
        switch(action) {
            case 'left':
                if (type === 'down') {
                    this.player.velocityX = -this.player.speed;
                } else if (type === 'up') {
                    this.player.velocityX = 0;
                }
                break;
            case 'right':
                if (type === 'down') {
                    this.player.velocityX = this.player.speed;
                } else if (type === 'up') {
                    this.player.velocityX = 0;
                }
                break;
            case 'jump':
                if (type === 'down' && this.player.onGround) {
                    this.player.velocityY = -this.player.jumpPower;
                    this.player.onGround = false;
                    this.playSound('jump');
                }
                break;
            case 'action':
                if (type === 'down') {
                    this.checkGoal();
                }
                break;
            case 'fire':
                if (type === 'down') {
                    this.fire();
                }
                break;
        }
    }
    
    handleKeyDown(e) {
        if (this.gameState !== 'playing') return;
        
        switch(e.code) {
            case 'ArrowLeft':
                this.player.velocityX = -this.player.speed;
                break;
            case 'ArrowRight':
                this.player.velocityX = this.player.speed;
                break;
            case 'ArrowUp':
            case 'Space':
                if (this.player.onGround) {
                    this.player.velocityY = -this.player.jumpPower;
                    this.player.onGround = false;
                    this.playSound('jump');
                }
                break;
            case 'Enter':
                this.checkGoal();
                break;
            case 'KeyX':
                this.fire();
                break;
        }
    }
    
    handleKeyUp(e) {
        if (this.gameState !== 'playing') return;
        
        switch(e.code) {
            case 'ArrowLeft':
            case 'ArrowRight':
                this.player.velocityX = 0;
                break;
        }
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        // Update player physics
        this.updatePlayer();
        
        // Update moving obstacles
        this.updateMovingObstacles();
        
        // Update bullets
        this.updateBullets();
        
        // Check collisions
        this.checkCollisions();
        
        // Update particles
        this.updateParticles();
        
        // Update shooting timer
        if (this.shootingTimer > 0) {
            this.shootingTimer--;
            if (this.shootingTimer === 0) {
                this.isShooting = false;
            }
        }
        
        // Check if player fell off the world
        if (this.player.y > this.canvas.height) {
            this.loseLife();
        }
    }
    
    updatePlayer() {
        // Apply gravity
        this.player.velocityY += 0.8;
        
        // Update position
        this.player.x += this.player.velocityX;
        this.player.y += this.player.velocityY;
        
        // Keep player in bounds
        if (this.player.x < 0) this.player.x = 0;
        if (this.player.x + this.player.width > this.canvas.width) {
            this.player.x = this.canvas.width - this.player.width;
        }
    }
    
    updateMovingObstacles() {
        for (let obstacle of this.movingObstacles) {
            obstacle.x += obstacle.velocityX;
            
            // Reverse direction at boundaries
            if (obstacle.x <= obstacle.minX || obstacle.x >= obstacle.maxX) {
                obstacle.velocityX *= -1;
            }
        }
    }
    
    updateBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            let bullet = this.bullets[i];
            bullet.x += bullet.velocityX;
            
            // Remove bullets that are off screen
            if (bullet.x > this.canvas.width || bullet.x < 0) {
                this.bullets.splice(i, 1);
                continue;
            }
            
            // Check bullet collision with enemies
            for (let j = this.movingObstacles.length - 1; j >= 0; j--) {
                let obstacle = this.movingObstacles[j];
                if (this.isColliding(bullet, obstacle)) {
                    // Destroy both bullet and enemy
                    this.movingObstacles.splice(j, 1);
                    this.bullets.splice(i, 1);
                    this.score += 200;
                    this.playSound('enemy');
                    this.addParticle(obstacle.x, obstacle.y, 'enemy');
                    break;
                }
            }
        }
    }
    
    fire() {
        if (this.gameState !== 'playing') return;
        
        // Create bullet
        this.bullets.push({
            x: this.player.x + this.player.width,
            y: this.player.y + this.player.height / 2,
            width: 8,
            height: 4,
            velocityX: 8
        });
        
        // Set shooting state
        this.isShooting = true;
        this.shootingTimer = 10; // Show shooting sprite for 10 frames
        
        this.playSound('fire');
    }
    
    checkCollisions() {
        // Platform collisions
        this.player.onGround = false;
        
        for (let platform of this.platforms) {
            if (this.isColliding(this.player, platform)) {
                // Landing on top of platform
                if (this.player.velocityY > 0 && this.player.y < platform.y) {
                    this.player.y = platform.y - this.player.height;
                    this.player.velocityY = 0;
                    this.player.onGround = true;
                }
            }
        }
        
        // Moving obstacle collisions
        for (let i = this.movingObstacles.length - 1; i >= 0; i--) {
            let obstacle = this.movingObstacles[i];
            if (this.isColliding(this.player, obstacle)) {
                // Check if player is jumping on enemy from above
                if (this.player.velocityY > 0 && this.player.y < obstacle.y) {
                    // Player jumped on enemy - destroy enemy and bounce
                    this.movingObstacles.splice(i, 1);
                    this.player.velocityY = -this.player.jumpPower * 0.7; // Bounce
                    this.score += 200;
                    this.playSound('enemy');
                    this.addParticle(obstacle.x, obstacle.y, 'enemy');
                } else {
                    // Player hit enemy from side - lose life
                    this.loseLife();
                    return;
                }
            }
        }
        
        // Coin collisions
        for (let i = this.coins.length - 1; i >= 0; i--) {
            let coin = this.coins[i];
            if (!coin.collected && this.isColliding(this.player, coin)) {
                coin.collected = true;
                this.coins++;
                this.collectedCoins++;
                this.score += 100;
                this.playSound('coin');
                this.addParticle(coin.x, coin.y, 'coin');
            }
        }
        
        // Power-up collisions
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            let powerUp = this.powerUps[i];
            if (!powerUp.collected && this.isColliding(this.player, powerUp)) {
                powerUp.collected = true;
                this.player.powerUps[powerUp.type]++;
                this.score += 200;
                this.playSound('powerup');
                this.addParticle(powerUp.x, powerUp.y, 'powerup');
                this.updatePowerUpUI();
            }
        }
    }
    
    checkGoal() {
        const level = this.levels[this.currentLevel];
        if (this.isColliding(this.player, level.goal)) {
            this.completeLevel();
        }
    }
    
    completeLevel() {
        this.achievements++;
        this.score += 500;
        
        if (this.currentLevel < this.levels.length - 1) {
            this.loadLevel(this.currentLevel + 1);
            this.showAchievement(`Level ${this.currentLevel + 1} Complete!`);
        } else {
            this.gameWin();
        }
    }
    
    gameWin() {
        this.gameState = 'gameOver';
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-coins').textContent = this.collectedCoins;
        document.getElementById('final-achievements').textContent = this.achievements;
        document.getElementById('game-over').style.display = 'flex';
    }
    
    loseLife() {
        this.lives--;
        if (this.lives <= 0) {
            this.gameOver();
        } else {
            this.resetPlayer();
        }
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-coins').textContent = this.collectedCoins;
        document.getElementById('final-achievements').textContent = this.achievements;
        document.getElementById('game-over').style.display = 'flex';
    }
    
    isColliding(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    addParticle(x, y, type) {
        this.particles.push({
            x: x,
            y: y,
            velocityX: (Math.random() - 0.5) * 4,
            velocityY: -Math.random() * 3 - 1,
            life: 30,
            type: type
        });
    }
    
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let particle = this.particles[i];
            particle.x += particle.velocityX;
            particle.y += particle.velocityY;
            particle.velocityY += 0.2;
            particle.life--;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    updatePowerUpUI() {
        const powerUpElements = {
            tech: document.getElementById('tech-powerup'),
            leadership: document.getElementById('leadership-powerup'),
            research: document.getElementById('research-powerup')
        };
        
        for (let type in this.player.powerUps) {
            if (this.player.powerUps[type] > 0) {
                powerUpElements[type].classList.add('active');
            }
        }
    }
    
    showAchievement(text) {
        const popup = document.getElementById('achievement-popup');
        document.getElementById('achievement-title').textContent = text;
        popup.classList.add('show');
        this.playSound('achievement');
        
        setTimeout(() => {
            popup.classList.remove('show');
        }, 3000);
    }
    
    playSound(sound) {
        if (this.audio.muted) return;
        // Sound effects would be implemented here
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background
        this.drawBackground();
        
        // Draw platforms
        this.drawPlatforms();
        
        // Draw coins
        this.drawCoins();
        
        // Draw power-ups
        this.drawPowerUps();
        
        // Draw moving obstacles
        this.drawMovingObstacles();
        
        // Draw bullets
        this.drawBullets();
        
        // Draw goal
        this.drawGoal();
        
        // Draw goal indicator if player is near
        this.drawGoalIndicator();
        
        // Draw player
        this.drawPlayer();
        
        // Draw particles
        this.drawParticles();
        
        // Update UI
        this.updateUI();
    }
    
    drawBackground() {
        // Super Mario style background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#5C94FC'); // Sky blue
        gradient.addColorStop(0.7, '#5C94FC'); // Sky blue
        gradient.addColorStop(0.8, '#87CEEB'); // Light sky blue
        gradient.addColorStop(1, '#98FB98'); // Light green ground
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw clouds
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        for (let i = 0; i < 6; i++) {
            const x = (i * 200) + (Date.now() * 0.005) % 200;
            const y = 30 + Math.sin(i * 0.5) * 15;
            this.drawCloud(x, y);
        }
        
        // Draw mountains in background
        this.ctx.fillStyle = 'rgba(139, 69, 19, 0.3)';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 400);
        this.ctx.lineTo(200, 300);
        this.ctx.lineTo(400, 350);
        this.ctx.lineTo(600, 280);
        this.ctx.lineTo(800, 320);
        this.ctx.lineTo(1000, 290);
        this.ctx.lineTo(1200, 350);
        this.ctx.lineTo(1200, 400);
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    drawCloud(x, y) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 20, 0, Math.PI * 2);
        this.ctx.arc(x + 25, y, 25, 0, Math.PI * 2);
        this.ctx.arc(x + 50, y, 20, 0, Math.PI * 2);
        this.ctx.arc(x + 25, y - 15, 20, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawPlatforms() {
        this.ctx.fillStyle = '#8B4513';
        for (let platform of this.platforms) {
            this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            
            // Add some texture
            this.ctx.fillStyle = '#A0522D';
            this.ctx.fillRect(platform.x, platform.y, platform.width, 5);
            this.ctx.fillStyle = '#8B4513';
        }
    }
    
    drawCoins() {
        this.ctx.fillStyle = '#FFD700';
        for (let coin of this.coins) {
            if (!coin.collected) {
                this.ctx.beginPath();
                this.ctx.arc(coin.x + 10, coin.y + 10, 10, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Inner circle
                this.ctx.fillStyle = '#FFA500';
                this.ctx.beginPath();
                this.ctx.arc(coin.x + 10, coin.y + 10, 6, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.fillStyle = '#FFD700';
            }
        }
    }
    
    drawPowerUps() {
        for (let powerUp of this.powerUps) {
            if (!powerUp.collected) {
                this.ctx.fillStyle = this.getPowerUpColor(powerUp.type);
                this.ctx.fillRect(powerUp.x, powerUp.y, 20, 20);
                
                // Add icon
                this.ctx.fillStyle = 'white';
                this.ctx.font = '12px Arial';
                this.ctx.fillText(this.getPowerUpIcon(powerUp.type), powerUp.x + 6, powerUp.y + 14);
            }
        }
    }
    
    getPowerUpColor(type) {
        const colors = {
            tech: '#3498db',
            leadership: '#e74c3c',
            research: '#9b59b6'
        };
        return colors[type] || '#95a5a6';
    }
    
    getPowerUpIcon(type) {
        const icons = {
            tech: '💻',
            leadership: '👥',
            research: '🔬'
        };
        return icons[type] || '?';
    }
    
    drawMovingObstacles() {
        this.ctx.fillStyle = '#8B0000'; // Dark red
        for (let obstacle of this.movingObstacles) {
            this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            
            // Add eyes
            this.ctx.fillStyle = 'white';
            this.ctx.fillRect(obstacle.x + 5, obstacle.y + 5, 5, 5);
            this.ctx.fillRect(obstacle.x + 15, obstacle.y + 5, 5, 5);
            
            // Add pupils
            this.ctx.fillStyle = 'black';
            this.ctx.fillRect(obstacle.x + 7, obstacle.y + 7, 2, 2);
            this.ctx.fillRect(obstacle.x + 17, obstacle.y + 7, 2, 2);
            
            this.ctx.fillStyle = '#8B0000';
        }
    }
    
    drawBullets() {
        this.ctx.fillStyle = '#FFD700'; // Gold bullets
        for (let bullet of this.bullets) {
            this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            
            // Add glow effect
            this.ctx.shadowColor = '#FFD700';
            this.ctx.shadowBlur = 5;
            this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            this.ctx.shadowBlur = 0;
        }
    }
    
    drawGoal() {
        const level = this.levels[this.currentLevel];
        this.ctx.fillStyle = '#f39c12';
        this.ctx.fillRect(level.goal.x, level.goal.y, level.goal.width, level.goal.height);
        
        // Add flag
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.fillRect(level.goal.x + level.goal.width - 10, level.goal.y, 10, 30);
    }
    
    drawGoalIndicator() {
        const level = this.levels[this.currentLevel];
        const distance = Math.abs(this.player.x - (level.goal.x + level.goal.width / 2));
        
        // Show indicator if player is within 100 pixels of goal
        if (distance < 100) {
            const indicatorY = level.goal.y - 30;
            const indicatorX = level.goal.x + level.goal.width / 2 - 15;
            
            // Draw pulsing indicator
            const time = Date.now() * 0.005;
            const scale = Math.sin(time) * 0.3 + 0.7;
            
            this.ctx.save();
            this.ctx.translate(indicatorX + 15, indicatorY + 15);
            this.ctx.scale(scale, scale);
            
            // Draw arrow pointing down
            this.ctx.fillStyle = '#f39c12';
            this.ctx.beginPath();
            this.ctx.moveTo(0, -10);
            this.ctx.lineTo(-8, 0);
            this.ctx.lineTo(8, 0);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Draw text
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.font = 'bold 8px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PRESS', 0, 15);
            this.ctx.fillText('ACTION', 0, 25);
            
            this.ctx.restore();
        }
    }
    
    drawPlayer() {
        // Choose sprite based on shooting state
        const currentSprite = this.isShooting ? this.playerSprites.shooting : this.playerSprites.standing;
        
        // Draw sprite if loaded, otherwise fallback to simple rectangle
        if (currentSprite && currentSprite.complete) {
            this.ctx.drawImage(currentSprite, this.player.x, this.player.y, this.player.width, this.player.height);
        } else {
            // Fallback drawing when sprites aren't loaded yet
            this.ctx.fillStyle = '#2ecc71';
            this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
            
            // Player face
            this.ctx.fillStyle = '#f1c40f';
            this.ctx.fillRect(this.player.x + 5, this.player.y + 5, 30, 20);
            
            // Eyes
            this.ctx.fillStyle = 'black';
            this.ctx.fillRect(this.player.x + 10, this.player.y + 10, 3, 3);
            this.ctx.fillRect(this.player.x + 20, this.player.y + 10, 3, 3);
            
            // Smile
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(this.player.x + 20, this.player.y + 18, 8, 0, Math.PI);
            this.ctx.stroke();
        }
    }
    
    drawParticles() {
        for (let particle of this.particles) {
            this.ctx.fillStyle = particle.type === 'coin' ? '#FFD700' : '#f39c12';
            this.ctx.globalAlpha = particle.life / 30;
            this.ctx.fillRect(particle.x, particle.y, 4, 4);
            this.ctx.globalAlpha = 1;
        }
    }
    
    updateUI() {
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('score').textContent = this.score;
        document.getElementById('coins').textContent = this.collectedCoins;
        document.getElementById('achievements').textContent = this.achievements;
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ReshadGame();
});
