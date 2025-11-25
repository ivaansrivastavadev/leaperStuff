        // DOM Elements
        const modeButtons = document.querySelectorAll('.mode-btn');
        const timerContainer = document.querySelector('.timer-container');
        const stopwatchContainer = document.querySelector('.stopwatch-container');
        const timerDisplay = document.querySelector('.time-text');
        const timerRing = document.querySelector('.timer-ring');
        const timerInput = document.querySelector('.timer-input');
        const timerToggle = document.getElementById('timer-toggle');
        const timerStop = document.getElementById('timer-stop');
        const stopwatchTime = document.querySelector('.stopwatch-time');
        const stopwatchToggle = document.getElementById('stopwatch-toggle');
        const stopwatchStop = document.getElementById('stopwatch-stop');
        const lapBtn = document.getElementById('lap-btn');
        const lapList = document.getElementById('lap-list');
        const settingsIcon = document.querySelector('.settings-icon');
        const settingsPopup = document.querySelector('.settings-popup');
        const closeSettings = document.querySelector('.close-settings');
        const darkModeToggle = document.querySelector('.dark-mode-toggle');
        const alertOverlay = document.getElementById('alert-overlay');
        const alertTitle = document.getElementById('alert-title');
        const alertInput = document.getElementById('alert-input');
        const alertOk = document.getElementById('alert-ok');
        const alertCancel = document.getElementById('alert-cancel');
        
        // App State
        let currentMode = 'timer';
        let timerInterval;
        let stopwatchInterval;
        let timerDuration = 0;
        let timerRemaining = 0;
        let timerRunning = false;
        let stopwatchRunning = false;
        let stopwatchTimeValue = 0;
        let stopwatchStartTime = 0;
        let stopwatchPauseTime = 0;
        let laps = [];
        let customStopText = 'STOP';
        let isDarkMode = false;
        
        // Mode Switching
        modeButtons.forEach(button => {
            button.addEventListener('click', () => {
                modeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                currentMode = button.dataset.mode;
                
                timerContainer.classList.remove('active-mode');
                stopwatchContainer.classList.remove('active-mode');
                
                if (currentMode === 'timer') {
                    timerContainer.classList.add('active-mode');
                } else {
                    stopwatchContainer.classList.add('active-mode');
                }
            });
        });
        
        // Timer Functions
        function parseTimeInput(input) {
            // Handle various time formats
            input = input.toLowerCase().trim();
            
            // Handle "1 minute", "2 hours", etc.
            if (input.includes('second')) {
                return parseInt(input) * 1000;
            } else if (input.includes('minute')) {
                return parseInt(input) * 60 * 1000;
            } else if (input.includes('hour')) {
                return parseInt(input) * 60 * 60 * 1000;
            }
            
            // Handle "1:30" format
            if (input.includes(':')) {
                const parts = input.split(':');
                if (parts.length === 2) {
                    return (parseInt(parts[0]) * 60 + parseInt(parts[1])) * 1000;
                } else if (parts.length === 3) {
                    return (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2])) * 1000;
                }
            }
            
            // Handle seconds only "90s" or just "90"
            if (input.endsWith('s')) {
                return parseInt(input) * 1000;
            }
            
            // Default: assume seconds
            return parseInt(input) * 1000;
        }
        
        function formatTime(ms) {
            const hours = Math.floor(ms / 3600000);
            const minutes = Math.floor((ms % 3600000) / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            
            if (hours > 0) {
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }
        
        function updateTimerDisplay() {
            timerDisplay.textContent = formatTime(timerRemaining);
            
            // Update ring color and fill
            const percentage = timerRemaining / timerDuration;
            let ringColor;
            
            if (percentage > 0.3) {
                ringColor = 'var(--timer-green)';
            } else if (percentage > 0.1) {
                ringColor = 'var(--timer-yellow)';
            } else {
                ringColor = 'var(--timer-red)';
            }
            
            timerRing.style.background = `conic-gradient(${ringColor} ${(1 - percentage) * 360}deg, transparent 0deg)`;
        }
        
        function startTimer() {
            if (timerDuration === 0) {
                try {
                    timerDuration = parseTimeInput(timerInput.value);
                    if (isNaN(timerDuration) || timerDuration <= 0) {
                        showAlert('Please enter a valid time');
                        return;
                    }
                } catch (e) {
                    showAlert('Please enter a valid time format');
                    return;
                }
            }
            
            timerRemaining = timerDuration;
            timerRunning = true;
            timerToggle.textContent = 'Pause';
            timerToggle.classList.add('running');
            timerStop.classList.remove('hidden');
            timerInput.disabled = true;
            
            updateTimerDisplay();
            
            timerInterval = setInterval(() => {
                timerRemaining -= 1000;
                
                if (timerRemaining <= 0) {
                    timerRemaining = 0;
                    clearInterval(timerInterval);
                    timerRunning = false;
                    timerToggle.textContent = 'Start';
                    timerToggle.classList.remove('running');
                    timerStop.classList.add('hidden');
                    timerInput.disabled = false;
                    
                    // Show completion alert
                    showAlert('Time\'s Up!', false);
                    playAlertSound();
                }
                
                updateTimerDisplay();
            }, 1000);
        }
        
        function pauseTimer() {
            clearInterval(timerInterval);
            timerRunning = false;
            timerToggle.textContent = 'Resume';
            timerToggle.classList.remove('running');
            timerToggle.classList.add('paused');
        }
        
        function resumeTimer() {
            timerRunning = true;
            timerToggle.textContent = 'Pause';
            timerToggle.classList.remove('paused');
            timerToggle.classList.add('running');
            
            timerInterval = setInterval(() => {
                timerRemaining -= 1000;
                
                if (timerRemaining <= 0) {
                    timerRemaining = 0;
                    clearInterval(timerInterval);
                    timerRunning = false;
                    timerToggle.textContent = 'Start';
                    timerToggle.classList.remove('running');
                    timerStop.classList.add('hidden');
                    timerInput.disabled = false;
                    
                    // Show completion alert
                    showAlert('Time\'s Up!', false);
                    playAlertSound();
                }
                
                updateTimerDisplay();
            }, 1000);
        }
        
        function stopTimer() {
            clearInterval(timerInterval);
            timerRunning = false;
            timerDuration = 0;
            timerRemaining = 0;
            timerToggle.textContent = 'Start';
            timerToggle.classList.remove('running', 'paused');
            timerStop.classList.add('hidden');
            timerInput.disabled = false;
            updateTimerDisplay();
        }
        
        // Timer Controls
        timerToggle.addEventListener('click', () => {
            if (!timerRunning && timerRemaining === 0) {
                startTimer();
            } else if (timerRunning) {
                pauseTimer();
            } else {
                resumeTimer();
            }
        });
        
        timerStop.addEventListener('click', () => {
            if (customStopText) {
                showAlert(`Type "${customStopText}" to stop`, true);
            } else {
                stopTimer();
            }
        });
        
        // Stopwatch Functions
        function formatStopwatchTime(ms) {
            const hours = Math.floor(ms / 3600000);
            const minutes = Math.floor((ms % 3600000) / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            const centiseconds = Math.floor((ms % 1000) / 10);
            
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
        }
        
        function updateStopwatchDisplay() {
            stopwatchTime.textContent = formatStopwatchTime(stopwatchTimeValue);
        }
        
        function startStopwatch() {
            stopwatchRunning = true;
            stopwatchToggle.textContent = 'Pause';
            stopwatchToggle.classList.add('running');
            stopwatchStop.classList.remove('hidden');
            lapBtn.classList.remove('hidden');
            
            if (stopwatchPauseTime > 0) {
                // Resuming from pause
                stopwatchStartTime = Date.now() - (stopwatchPauseTime - stopwatchStartTime);
            } else {
                // Starting fresh
                stopwatchStartTime = Date.now();
                laps = [];
                lapList.innerHTML = '';
                lapList.classList.add('hidden');
            }
            
            stopwatchInterval = setInterval(() => {
                stopwatchTimeValue = Date.now() - stopwatchStartTime;
                updateStopwatchDisplay();
            }, 10);
        }
        
        function pauseStopwatch() {
            clearInterval(stopwatchInterval);
            stopwatchRunning = false;
            stopwatchToggle.textContent = 'Resume';
            stopwatchToggle.classList.remove('running');
            stopwatchToggle.classList.add('paused');
            stopwatchPauseTime = Date.now();
        }
        
        function stopStopwatch() {
            clearInterval(stopwatchInterval);
            stopwatchRunning = false;
            stopwatchTimeValue = 0;
            stopwatchPauseTime = 0;
            stopwatchToggle.textContent = 'Start';
            stopwatchToggle.classList.remove('running', 'paused');
            stopwatchStop.classList.add('hidden');
            lapBtn.classList.add('hidden');
            lapList.classList.add('hidden');
            updateStopwatchDisplay();
        }
        
        function addLap() {
            const lapTime = stopwatchTimeValue;
            laps.push(lapTime);
            
            // Show lap list if it's hidden
            if (lapList.classList.contains('hidden')) {
                lapList.classList.remove('hidden');
                // Animate button shrinking
                stopwatchToggle.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    stopwatchToggle.style.transform = 'scale(1)';
                }, 300);
            }
            
            const lapItem = document.createElement('div');
            lapItem.className = 'lap-item';
            lapItem.textContent = `Lap ${laps.length}: ${formatStopwatchTime(lapTime)}`;
            lapList.appendChild(lapItem);
            
            // Scroll to bottom
            lapList.scrollTop = lapList.scrollHeight;
        }
        
        // Stopwatch Controls
        stopwatchToggle.addEventListener('click', () => {
            if (!stopwatchRunning) {
                startStopwatch();
            } else {
                pauseStopwatch();
            }
        });
        
        stopwatchStop.addEventListener('click', stopStopwatch);
        
        lapBtn.addEventListener('click', addLap);
        
        // Settings
        settingsIcon.addEventListener('click', () => {
            settingsPopup.style.display = 'flex';
        });
        
        closeSettings.addEventListener('click', () => {
            settingsPopup.style.display = 'none';
        });
        
        // Dark Mode Toggle
        darkModeToggle.addEventListener('click', () => {
            isDarkMode = !isDarkMode;
            document.body.classList.toggle('dark-mode', isDarkMode);
            darkModeToggle.textContent = isDarkMode ? '☀️' : '🌙';
        });
        
        // Alert Functions
        function showAlert(message, requireInput = false) {
            alertTitle.textContent = message;
            
            if (requireInput) {
                alertInput.classList.remove('hidden');
                alertCancel.classList.remove('hidden');
                alertInput.value = '';
                alertInput.focus();
            } else {
                alertInput.classList.add('hidden');
                alertCancel.classList.add('hidden');
            }
            
            alertOverlay.style.display = 'flex';
        }
        
        function hideAlert() {
            alertOverlay.style.display = 'none';
        }
        
        function playAlertSound() {
            // In a real implementation, this would play the selected sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.1);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        }
        
        // Alert Controls
        alertOk.addEventListener('click', () => {
            if (alertInput.classList.contains('hidden')) {
                // Simple alert, just close
                hideAlert();
            } else {
                // Input required alert
                if (alertInput.value.toUpperCase() === customStopText.toUpperCase()) {
                    if (currentMode === 'timer') {
                        stopTimer();
                    } else {
                        stopStopwatch();
                    }
                    hideAlert();
                } else {
                    alertInput.value = '';
                    alertInput.focus();
                }
            }
        });
        
        alertCancel.addEventListener('click', hideAlert);
        
        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'j':
                        e.preventDefault();
                        if (currentMode === 'timer' && !timerRunning) {
                            timerInput.focus();
                        } else if (currentMode === 'stopwatch' && stopwatchRunning) {
                            addLap();
                        }
                        break;
                    case ' ':
                        e.preventDefault();
                        if (currentMode === 'timer') {
                            if (!timerRunning && timerRemaining === 0) {
                                startTimer();
                            } else if (timerRunning) {
                                pauseTimer();
                            } else {
                                resumeTimer();
                            }
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        if (currentMode === 'timer' && (timerRunning || timerRemaining > 0)) {
                            if (customStopText) {
                                showAlert(`Type "${customStopText}" to stop`, true);
                            } else {
                                stopTimer();
                            }
                        } else if (currentMode === 'stopwatch' && (stopwatchRunning || stopwatchTimeValue > 0)) {
                            stopStopwatch();
                        }
                        break;
                }
            } else if (e.key === ' ' && currentMode === 'stopwatch') {
                e.preventDefault();
                if (!stopwatchRunning) {
                    startStopwatch();
                } else {
                    pauseStopwatch();
                }
            }
        });
        
        // Settings Change Handlers
        document.getElementById('custom-alert-text').addEventListener('input', (e) => {
            customStopText = e.target.value;
        });
        
        document.getElementById('timer-sound').addEventListener('change', (e) => {
            const customSoundOption = document.getElementById('custom-sound-option');
            if (e.target.value === 'custom') {
                customSoundOption.classList.remove('hidden');
            } else {
                customSoundOption.classList.add('hidden');
            }
        });
        
        // Initialize
        updateTimerDisplay();
        updateStopwatchDisplay();