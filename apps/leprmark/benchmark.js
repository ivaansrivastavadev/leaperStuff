let multiplier = 1;
        let cpuActive = false, ramActive = false, netInterval = null;
        let workers = [], ramJunk = [];

        function updateMult(val) {
            multiplier = Math.max(1, multiplier + val);
            document.getElementById('multText').innerText = multiplier + "x";
        }

        function toggleCPU() {
            cpuActive = !cpuActive;
            if(cpuActive) {
                const blob = new Blob([`while(true){ Math.sqrt(Math.random()*999); }`]);
                const url = URL.createObjectURL(blob);
                const total = (navigator.hardwareConcurrency || 4) * multiplier;
                for(let i=0; i<total; i++) workers.push(new Worker(url));
                document.getElementById('cpu-log').innerText = `Running ${total} Workers`;
            } else {
                workers.forEach(w => w.terminate()); workers = [];
                document.getElementById('cpu-log').innerText = "Stopped";
            }
        }

        function toggleRAM() {
            ramActive = !ramActive;
            if(ramActive) {
                for(let i=0; i < multiplier; i++) {
                    let b = new Uint32Array(32 * 1024 * 1024); // ~128MB per click
                    for(let j=0; j<b.length; j+=1024) b[j] = Math.random() * 0xFFFFFFFF;
                    ramJunk.push(b);
                }
                document.getElementById('ram-log').innerText = `${ramJunk.length * 128}MB Commited`;
            } else { ramJunk = []; document.getElementById('ram-log').innerText = "0MB"; }
        }

        function toggleNet() {
            document.getElementById('netPopup').style.display = 'block';
            if(netInterval) return;
            netInterval = setInterval(async () => {
                // DOWNLOAD
                const start = performance.now();
                const res = await fetch(`https://httpbin.org/bytes/500000?nocache=${Math.random()}`);
                const data = await res.blob();
                const end = performance.now();
                const dl = (0.5 / ((end - start) / 1000)).toFixed(2);
                document.getElementById('dl-speed').innerText = dl;

                // UPLOAD
                const upStart = performance.now();
                await fetch('https://httpbin.org/post', { method: 'POST', body: data });
                const upEnd = performance.now();
                const ul = (0.5 / ((upEnd - upStart) / 1000)).toFixed(2);
                document.getElementById('ul-speed').innerText = ul;
            }, 100);
        }

        function closeNet() {
            clearInterval(netInterval); netInterval = null;
            document.getElementById('netPopup').style.display = 'none';
        }

        function runAllTests() {
            if(!cpuActive) toggleCPU();
            if(!ramActive) toggleRAM();
            toggleNet();
        }

        if(navigator.getBattery) {
            navigator.getBattery().then(b => {
                const update = () => { document.getElementById('batt-log').innerText = `Lvl: ${Math.round(b.level * 100)}%\n${b.charging ? 'Charging' : 'On Battery'}`; };
                update(); b.onlevelchange = update;
            });
        }