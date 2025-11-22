    // Easter Egg: Konami Code (simplified - just down arrow)
    const secretEl = document.getElementById("secret");
    let downArrowPressed = false;

    window.addEventListener("keydown", e => {
      if (e.key === 'ArrowDown' || e.keyCode === 40) {
        if (!downArrowPressed) {
          downArrowPressed = true;
          secretEl.style.display = 'block';
          secretEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          initGame();
        }
      }
    });

    // Memory Game Logic
    let gameState = {
      cards: [],
      flippedCards: [],
      matchedPairs: 0,
      totalPairs: 0,
      moves: 0,
      canFlip: true
    };

    const icons = ['star', 'heart', 'bolt', 'gem', 'flag', 'key', 'bell', 'crown'];
    
    function initGame() {
      const gameBoard = document.getElementById('gameBoard');
      gameBoard.innerHTML = '';
      
      // Duplicate and shuffle icons
      gameState.cards = [...icons, ...icons];
      shuffleArray(gameState.cards);
      
      gameState.totalPairs = icons.length;
      gameState.matchedPairs = 0;
      gameState.moves = 0;
      gameState.flippedCards = [];
      gameState.canFlip = true;
      
      updateGameStats();
      
      // Create game cells
      gameState.cards.forEach((icon, index) => {
        const cell = document.createElement('div');
        cell.className = 'game-cell';
        cell.style.aspectRatio = '1';
        cell.style.background = 'rgba(255, 255, 255, 0.1)';
        cell.style.borderRadius = '12px';
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'center';
        cell.style.fontSize = '2rem';
        cell.style.cursor = 'pointer';
        cell.style.transition = 'all 0.3s ease';
        cell.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        
        cell.dataset.index = index;
        cell.dataset.icon = icon;
        cell.innerHTML = '<i class="fas fa-question"></i>';
        
        cell.addEventListener('click', () => flipCard(index));
        cell.addEventListener('mouseenter', () => {
          if (!cell.classList.contains('active')) {
            cell.style.background = 'rgba(255, 255, 255, 0.15)';
            cell.style.transform = 'scale(1.05)';
          }
        });
        cell.addEventListener('mouseleave', () => {
          if (!cell.classList.contains('active')) {
            cell.style.background = 'rgba(255, 255, 255, 0.1)';
            cell.style.transform = 'scale(1)';
          }
        });
        
        gameBoard.appendChild(cell);
      });
    }
    
    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
    
    function flipCard(index) {
      if (!gameState.canFlip || gameState.flippedCards.includes(index)) return;
      
      const cell = document.querySelector(`.game-cell[data-index="${index}"]`);
      const icon = cell.dataset.icon;
      
      // Flip the card
      cell.innerHTML = `<i class="fas fa-${icon}"></i>`;
      cell.style.background = 'var(--color1)';
      cell.style.color = 'var(--color5)';
      cell.classList.add('active');
      
      gameState.flippedCards.push(index);
      
      if (gameState.flippedCards.length === 2) {
        gameState.moves++;
        updateGameStats();
        
        gameState.canFlip = false;
        
        // Check for match
        const firstIndex = gameState.flippedCards[0];
        const secondIndex = gameState.flippedCards[1];
        
        const firstCard = document.querySelector(`.game-cell[data-index="${firstIndex}"]`);
        const secondCard = document.querySelector(`.game-cell[data-index="${secondIndex}"]`);
        
        if (firstCard.dataset.icon === secondCard.dataset.icon) {
          // Match found
          gameState.matchedPairs++;
          updateGameStats();
          
          // Check for win
          if (gameState.matchedPairs === gameState.totalPairs) {
            setTimeout(() => {
              alert('🎉 Congratulations! You won the game! 🎉');
            }, 500);
          }
          
          gameState.flippedCards = [];
          gameState.canFlip = true;
        } else {
          // No match, flip back after a delay
          setTimeout(() => {
            firstCard.innerHTML = '<i class="fas fa-question"></i>';
            secondCard.innerHTML = '<i class="fas fa-question"></i>';
            firstCard.style.background = 'rgba(255, 255, 255, 0.1)';
            firstCard.style.color = 'var(--text-light)';
            secondCard.style.background = 'rgba(255, 255, 255, 0.1)';
            secondCard.style.color = 'var(--text-light)';
            firstCard.classList.remove('active');
            secondCard.classList.remove('active');
            
            gameState.flippedCards = [];
            gameState.canFlip = true;
          }, 500);
        }
      }
    }
    
    function updateGameStats() {
      document.getElementById('movesCount').textContent = gameState.moves;
      document.getElementById('pairsCount').textContent = gameState.matchedPairs;
      document.getElementById('totalPairs').textContent = gameState.totalPairs;
    }
    
    // Event listeners for game controls
    document.getElementById('restartGame').addEventListener('click', initGame);
    document.getElementById('closeGame').addEventListener('click', () => {
      secretEl.style.display = 'none';
      downArrowPressed = false;
    });