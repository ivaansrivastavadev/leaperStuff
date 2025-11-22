  // OS names for menu
  const osNames = ['macOS', 'Linux', 'Android', 'FreeBSD', 'Windows'];

  // Corresponding ASCII arts in same order
  const osAsciiArt = [
`
                                                 
                                *                
                            @@@@@                
                          @@@@@@                 
                         @@@@@@                  
                        @@@@@.                   
                        @+                       
            @@@@@@@@@@@+  @@@@@@@@@@@@           
          @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@         
         @@@@@@@@@@@@@@@@@@@@@@@@@@@@@           
        @@@@@@@@@@@@@@@@@@@@@@@@@@@@@            
       @@@@@@@@@@@@@@@@@@@@@@@@@@@@@             
       @@@@@@@@@@@@@@@@@@@@@@@@@@@@@             
       @@@@@@@@@@@@@@@@@@@@@@@@@@@@@             
       @@@@@@@@@@@@@@@@@@@@@@@@@@@@@             
        @@@@@@@@@@@@@@@@@@@@@@@@@@@@@            
        @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@          
         @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@        
          @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@         
           @@@@@@@@@@@@@@@@@@@@@@@@@@@@          
            @@@@@@@@@@@@@@@@@@@@@@@@@@           
              @@@@@@@@@@@@@@@@@@@@@@             
                @@@@*        :@@@@               
                                                 
`,
`
                                                 
                   .#@@@@@@%=.                   
                  -@@@@@@@@-@@:                  
                 .%@@@@@@@@@@@@:                 
                 :@%=%@@#::#@@@-                 
                 :@=+-@% #-:%@@-                 
                 .%=*=:=:#@:%@@+                 
                 .%-:::::::-#@@%                 
                 .%@#+*+=-*-@#-%#.               
                 -%.%%*#+.  -@@@@+               
               .*@:  ...     -@@@@#.             
              .%@*            *@*@@@:.           
             :#+@-            .#@+*@@-           
            .@@@:              .@@*%@@=          
           .*@@+.               -@@=@@%.         
           +%*@.                :@@=@@@:         
          =@@=@                 :%**@@@*         
          -**%:               ..-@@@@@@=         
         .=:::*@:.            :=-@@@@@-..        
      +*%*:::::-@@=           .=:::-:::*:        
     :*:::::::::-@@%.         :+::::::::##.      
      #-:::::::::-#:.       -@:*::::::::::-+     
     -+::::::::::::#-%*+**%@@*=+:::::::=+=:      
     .+*++=-::::::-@+@@@%%%@@#%+::::+%=.         
            .+%%#%%:          :@@%%%-            
                                                                                                     
`,
`
             :#.           .*-             
              :%:-+#%%%#+-.%:              
             :#@@@@@@@@@@@@@#:.            
           :@@@@@@@@@@@@@@@@@@@:           
          =@@@%  %@@@@@@@%  %@@@=          
         .@@@@@@@@@@@@@@@@@@@@@@@.         
         =@@@@@@@@@@@@@@@@@@@@@@@+         
    :+=. ......................... .=+:    
   *@@@@:-@@@@@@@@@@@@@@@@@@@@@@@-:@@@@#   
   #@@@@=-@@@@@@@@@@@@@@@@@@@@@@@-=@@@@%   
   #@@@@=-@@@@@@@@@@@@@@@@@@@@@@@-=@@@@%   
   #@@@@=-@@@@@@@@@@@@@@@@@@@@@@@-=@@@@%   
   #@@@@=-@@@@@@@@@@@@@@@@@@@@@@@-=@@@@%   
   #@@@@=-@@@@@@@@@@@@@@@@@@@@@@@-=@@@@%   
   #@@@@=-@@@@@@@@@@@@@@@@@@@@@@@-=@@@@%   
   +@@@@.-@@@@@@@@@@@@@@@@@@@@@@@-.@@@@+   
    ...  -@@@@@@@@@@@@@@@@@@@@@@@-  ...    
         :@@@@@@@@@@@@@@@@@@@@@@@:         
           .::+@@@@%:::%@@@@*::.           
              +@@@@%. .%@@@@+              
              +@@@@%. .%@@@@+              
              +@@@@%. .%@@@@+              
              .%@@@.   .@@@%.              
`,
`
 *++**                                      **+* 
 %#####%@@@#   %@@@@%%%%%%%%%%@@@@@   #@@@%####% 
 @#####%%   %@@%##############%#   :@@%########@ 
 #@##%%   @@%##################  @@%##########@% 
  %@@#  @%####################%+ %%##########%%  
   @# #@%######################%  %%########%%   
     @%#########################%-  @%#####%     
    @%###########################%%   @@@@@  @:  
   @%##############################%%        %@  
   @#################################%@@#   %%%% 
  @%####################################%%%%###@ 
  @############################################@ 
  @############################################% 
  @############################################% 
  @############################################@ 
  %%###########################################@ 
   @##########################################@# 
   *@########################################%@  
    %@######################################%@   
     #@%###################################%@    
       @%################################%@%     
        %@%############################%@@       
          #@@%#######################%@@         
             %@@%%##############%%@@@#           
                  .+*++++++++**=                 
`,
`
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
                                   
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
llllllllllllllll   llllllllllllllll
`
];

  let currentIndex = 0;

  const display = document.getElementById('terminal-display');
  const popupOverlay = document.getElementById('popupOverlay');
  const osList = document.getElementById('osList');
  const searchInput = document.getElementById('searchInput');

  function showOS(index) {
    currentIndex = index;
    display.textContent = osAsciiArt[index];
  }

  function populateList(filter = '') {
    osList.innerHTML = '';
    const filtered = osNames.filter(os => os.toLowerCase().includes(filter.toLowerCase()));
    filtered.forEach((os, i) => {
      const div = document.createElement('div');
      div.textContent = os;  // show OS name here, NOT ASCII art
      div.setAttribute('role', 'option');
      div.tabIndex = 0;
      div.onclick = () => {
        const realIndex = osNames.indexOf(os);
        showOS(realIndex);
        hidePopup();
      };
      div.onkeydown = (e) => {
        if(e.key === 'Enter' || e.key === ' ') {
          const realIndex = osNames.indexOf(os);
          showOS(realIndex);
          hidePopup();
        }
      };
      osList.appendChild(div);
    });
    if(filtered.length === 0){
      const div = document.createElement('div');
      div.textContent = 'No results';
      div.style.color = '#440000';
      osList.appendChild(div);
    }
  }

  function showPopup() {
    popupOverlay.style.display = 'flex';
    searchInput.value = '';
    populateList();
    searchInput.focus();
  }

  function detectOS() {
    const ua = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
  
    if (platform.includes('mac') || ua.includes('macintosh')) return 'macOS';
    if (platform.includes('win') || ua.includes('windows')) return 'Windows';
    if (/android/.test(ua)) return 'Android';
    if (/iphone|ipad|ipod/.test(ua)) return 'macOS';
    if (/linux/.test(ua)) return 'Linux';
    if (/freebsd/.test(ua)) return 'FreeBSD';

    return 'Linux'; // fallback
  }


  function hidePopup() {
    popupOverlay.style.display = 'none';
  }

  // Click anywhere on body except popup to open menu
  window.addEventListener('click', (e) => {
    if(!popupOverlay.contains(e.target)) {
      showPopup();
    }
  });

  // Clicking outside popup closes it
  popupOverlay.addEventListener('click', (e) => {
    if(e.target === popupOverlay) {
      hidePopup();
    }
  });

  searchInput.addEventListener('input', (e) => {
    populateList(e.target.value);
  });

  // Initialize display
  // Auto-detect OS and show ASCII
  const detectedOS = detectOS();
  const detectedIndex = osNames.indexOf(detectedOS);
  if (detectedIndex !== -1) {
    showOS(detectedIndex);
  } else {
    showOS(0); // fallback to macOS
  }
