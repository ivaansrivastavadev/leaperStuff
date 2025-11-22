    const $ = (id)=>document.getElementById(id);

    function getDeviceId(){
      let id = localStorage.getItem('deviceId');
      if(!id){ id = crypto.randomUUID(); localStorage.setItem('deviceId', id); }
      return id;
    }

    function randomRoom(){
      const animals = ['tiger','otter','panda','eagle','whale','koala','lynx','yak','zebra','gecko','sloth','ibis'];
      const colors  = ['yellow','gold','amber','sun','lemon','honey'];
      return `${colors[Math.floor(Math.random()*colors.length)]}-${animals[Math.floor(Math.random()*animals.length)]}-${Math.floor(1000+Math.random()*8999)}`;
    }

    const deviceId = getDeviceId();
    $('deviceId').textContent = deviceId.slice(0,8);

    const peers = [
      'https://relay.peer.ooo/gun',
      'https://gun-manhattan.herokuapp.com/gun',
      'https://gunjs.herokuapp.com/gun'
    ];

    const gun = Gun({ peers, retry: 2500 });

    let connectedPeers = new Set();
    gun.on('hi', peer => { connectedPeers.add(peer.url); updatePeerStatus(); });
    gun.on('bye', peer => { connectedPeers.delete(peer.url); updatePeerStatus(); });
    function updatePeerStatus(){
      $('peerStatus').textContent = `${connectedPeers.size}/${peers.length} connected`;
    }

    let roomId = '';
    let secret = '';
    let roomNode = null;
    const seen = new Set();

    function initFromHash(){
      const h = decodeURIComponent(location.hash.replace(/^#/,'')).trim();
      if(h){ $('room').value = h; }
      if(!$('room').value) $('room').value = randomRoom();
      $('roomHint').textContent = '';
    }

    initFromHash();

    function setEncHint(){
      if(secret) $('encHint').textContent = 'Encryption: ON (shared secret)';
      else $('encHint').textContent = 'Encryption: OFF (use a Secret to enable)';
    }

    setEncHint();

    $('secret').addEventListener('input', ()=>{ secret = $('secret').value; setEncHint(); });

    $('copyLink').onclick = async ()=>{
      const id = $('room').value.trim();
      const url = location.origin + location.pathname + '#' + encodeURIComponent(id);
      await navigator.clipboard.writeText(url);
      toast(`Invite link copied`);
    };

    $('join').onclick = async ()=>{
      joinRoom($('room').value.trim());
    };

    function toast(msg){
      const div = document.createElement('div');
      div.textContent = msg;
      div.className = 'toast';
      document.body.appendChild(div);
      setTimeout(()=>div.remove(),1600);
    }

    async function enc(plain){
      if(!secret) return plain;
      try{ return await SEA.encrypt(plain, secret); }catch(e){ console.error(e); return plain; }
    }
    async function dec(cipher){
      if(!secret) return cipher;
      try{ return await SEA.decrypt(cipher, secret); }catch(e){ return '[Unable to decrypt – wrong secret?]'; }
    }

    function joinRoom(id){
      if(!id){ toast('Enter a Chat ID'); return; }
      if(roomNode){ roomNode.off(); }
      roomId = id;
      location.hash = encodeURIComponent(roomId);
      $('roomHint').textContent = `Room: ${roomId}`;
      $('chat').innerHTML = '';
      seen.clear();

      roomNode = gun.get('rooms').get(roomId);

      roomNode.get('messages').map().on(async (msg, key)=>{
        if(!msg) return;
        const uid = msg.uid || key;
        if(seen.has(uid)) return; seen.add(uid);

        const text = await dec(msg.text);
        renderMsg({
          me: msg.from === deviceId,
          text: String(text || ''),
          ts: msg.ts || Date.now(),
          from: msg.from
        });
      });

      toast('Joined room');
    }

    function renderMsg({me,text,ts,from}){
      const box = document.createElement('div');
      box.className = 'msg ' + (me? 'me':'them');
      box.innerHTML = `<div>${escapeHtml(text)}</div><div class="meta">${new Date(ts).toLocaleString()} • ${me? 'you': 'id '+(from||'–').slice(0,8)}</div>`;
      $('chat').appendChild(box);
      $('chat').scrollTop = $('chat').scrollHeight;
    }

    function escapeHtml(s){
      return s.replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
    }

    $('send').onclick = async ()=>{
      const t = $('text').value.trim();
      if(!t) return;
      if(!roomId){ toast('Join a room first'); return; }
      const uid = crypto.randomUUID();
      const payload = {
        uid,
        from: deviceId,
        ts: Date.now(),
        text: await enc(t)
      };
      seen.add(uid);
      renderMsg({me:true,text:t,ts:payload.ts,from:deviceId});
      $('text').value='';
      roomNode.get('messages').set(payload);
    };

    $('text').addEventListener('keydown', (e)=>{
      if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); $('send').click(); }
    });

    window.addEventListener('load', ()=>{
      secret = $('secret').value; setEncHint();
      joinRoom($('room').value.trim());
    });