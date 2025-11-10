(function(){
  function $(sel, ctx){ return (ctx||document).querySelector(sel); }
  function $all(sel, ctx){ return Array.from((ctx||document).querySelectorAll(sel)); }

  const FAVORITES_KEY = 'bb_favorites';
  const SESSION_KEY = 'bb_session_user';
  const BUDGET_KEY = 'bb_budget_v1';
  const SHEETS_CFG = {
    id: '1LqDJI2Mn83Z3PxMVyMiAQAk7bFOawaqhdtPtOu3MPhg',
    stallsSheet: 'Stalls',
    menuSheet: 'Menu'
  };
  const LOCAL_JSON = './assets/food_stalls_master_2025-10-30.json';

  const db = {
    // minimal item registry for profile page rendering
    items: {
      'm1': { name:'Menu Item', price:100 },
      'm2': { name:'Menu Item', price:100 },
      'm3': { name:'Menu Item', price:100 },
      'm4': { name:'Menu Item', price:100 },
      'm5': { name:'Menu Item', price:100 },
      'm6': { name:'Menu Item', price:100 },
      'prod-1': { name:'Food Name', price:100 }
    }
  };
// ---- Local JSON (preferred when available) ----
  let localDataCache = null;
  async function getLocalData(forceRefresh = false){
    if(localDataCache && !forceRefresh) return localDataCache;
    try{
      // Add timestamp to force cache bust
      const url = `${LOCAL_JSON}?t=${Date.now()}`;
      const res = await fetch(url, { cache:'no-store', headers: { 'Cache-Control': 'no-cache' } });
      if(!res.ok) throw new Error('local json missing');
      localDataCache = await res.json();
      return localDataCache;
    }catch(e){
      console.error('Error loading local data:', e);
      return null;
    }
  }
  // Clear cache on page load to ensure fresh data
  window.addEventListener('load', () => { localDataCache = null; });
  

  function getFavorites(){
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch { return []; }
  }
  function setFavorites(list){ localStorage.setItem(FAVORITES_KEY, JSON.stringify(list)); }
  function toggleFavorite(id){
    const list = new Set(getFavorites());
    if(list.has(id)) list.delete(id); else list.add(id);
    setFavorites([...list]);
    return list.has(id);
  }
  function isFav(id){ return new Set(getFavorites()).has(id); }

  function hydrateFavButtons(){
    $all('.fav-btn').forEach(btn => {
      const id = btn.getAttribute('data-id');
      const favorited = isFav(id);
      
      // Set initial state
      btn.classList.toggle('active', favorited);
      btn.textContent = favorited ? '★ Favorited' : '☆ Favorite';
      
      // Remove old listener if exists
      if (btn.__favClickHandler) {
        btn.removeEventListener('click', btn.__favClickHandler);
      }
      
      // Create new handler
      btn.__favClickHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const user = getSession();
        if(!user){
          // Save pending action for after login
          try{
            localStorage.setItem('bb_pending_action', JSON.stringify({ 
              type:'fav', 
              id, 
              returnTo: location.href 
            }));
          }catch(err){
            console.error('Error saving pending action:', err);
          }
          
          // Show alert and redirect to login
          alert('Please log in to save favorites. You will be redirected back after logging in.');
          const next = encodeURIComponent(location.href);
          location.href = `login.html?next=${next}`;
          return;
        }
        
        // User is logged in, toggle favorite
        const active = toggleFavorite(id);
        btn.classList.toggle('active', active);
        btn.textContent = active ? '★ Favorited' : '☆ Favorite';
      };
      
      btn.addEventListener('click', btn.__favClickHandler);
    });
  }

  // Google Maps callback
  window.initGoogleMap = function() {
    renderMap();
  };

  async function renderMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl || typeof google === 'undefined') return;

    // Center the map on Ateneo de Manila University
    const ateneo = { lat: 14.6394, lng: 121.0789 };
    
    // Create Google Map with enhanced zoom controls
    const map = new google.maps.Map(mapEl, {
      center: ateneo,
      zoom: 17,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_RIGHT,
      },
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_CENTER
      },
      scaleControl: true,
      streetViewControl: true,
      streetViewControlOptions: {
        position: google.maps.ControlPosition.RIGHT_CENTER
      },
      fullscreenControl: true,
      gestureHandling: 'greedy', // Better zoom with scroll
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'on' }]
        }
      ]
    });

    // Try to load data from Google Sheets, fallback to local data
    let points = [];
    try {
      const rows = await getSheetObjects(SHEETS_CFG.stallsSheet) || [];
      
      if (rows && rows.length) {
        points = rows.map(r => ({
          id: r.id || r.stall_id || toKey(r.name),
          name: r.name || r.stall_name || 'Stall',
          lat: Number(r.lat || r.latitude),
          lng: Number(r.lng || r.lon || r.long || r.longitude),
          area: r.area || r.location || '',
          type: r.type || 'food',
          description: r.description || '',
          hours: r.hours || '8:00 AM - 8:00 PM',
          popular: r.popular === 'true',
          halal: r.halal === 'true',
          vegetarian: r.vegetarian === 'true'
        })).filter(p => isFinite(p.lat) && isFinite(p.lng));
      }
    } catch (error) {
      console.error('Error loading stall data:', error);
    }

    // Fallback data if no points loaded
    if (points.length === 0) {
      points = [
        { id:'gonzaga', name:'Gonzaga Cafeteria', area:'Gonzaga', lat:14.64038, lng:121.07493, type: 'food', description: 'Main cafeteria serving a variety of local and international dishes', hours: '7:00 AM - 8:00 PM', popular: true },
        { id:'jsec', name:'JSEC', area:'JSEC', lat:14.63882, lng:121.07867, type: 'popular', description: 'Jose Salvador Escaño Hall Cafeteria', hours: '7:00 AM - 9:00 PM', popular: true },
        { id:'iso', name:'TGS Fast Foods (ISO)', area:'ISO', lat:14.63686, lng:121.08041, type: 'food', description: 'Fast food options near ISO building', hours: '8:00 AM - 7:00 PM' },
        { id:'leong', name:'Leong Hall', area:'Leong', lat:14.63815, lng:121.07741, type: 'food', description: 'Cafeteria at Leong Hall', hours: '7:30 AM - 7:00 PM' },
        { id:'northwing', name:'North Wing Canteen', area:'New Rizal Library', lat:14.64092, lng:121.07733, type: 'food', description: 'Convenient spot near the library', hours: '8:00 AM - 6:00 PM' },
        { id:'zen', name:'Zen Garden', area:'Zen Garden', lat:14.63902, lng:121.07641, type: 'special', description: 'Vegetarian and healthy food options', hours: '9:00 AM - 5:00 PM', vegetarian: true },
        { id:'cervini', name:'Cervini Field', area:'Cervini', lat:14.64112, lng:121.07563, type: 'popular', description: 'Food kiosks near the sports field', hours: '7:00 AM - 8:00 PM', popular: true }
      ];
    }

    // Create markers for each point
    const markers = points.map(p => {
      // Choose marker icon based on type
      const iconUrl = p.popular 
        ? 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
        : p.vegetarian || p.halal
        ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
        : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
      
      // Create marker
      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map: map,
        title: p.name,
        icon: iconUrl,
        animation: google.maps.Animation.DROP
      });
      
      // Enhanced popup content - made fully clickable
      const popupContent = `
        <div style="max-width: 300px; padding: 10px;">
          <h3 style="margin: 0 0 8px 0; color: #1e3a8a; font-size: 16px; font-weight: 700;">
            ${p.name}
          </h3>
          ${p.description ? `<p style="margin: 8px 0; color: #6b7280; font-size: 14px; line-height: 1.5;">${p.description}</p>` : ''}
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            <div style="color: #4b5563; font-size: 13px; margin-bottom: 8px;">⏰ ${p.hours || 'Hours not specified'}</div>
            <a href="shop.html?stall=${encodeURIComponent(p.id)}&name=${encodeURIComponent(p.name)}" 
               style="display: inline-block; padding: 8px 16px; background: linear-gradient(45deg, #1e3a8a, #4f46e5); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
              View Menu →
            </a>
          </div>
        </div>
      `;
      
      const infoWindow = new google.maps.InfoWindow({
        content: popupContent
      });
      
      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });
      
      marker.__area = (p.area || '').toString().toLowerCase();
      marker.__name = p.name.toLowerCase();
      marker.__type = p.type;
      marker.__visible = true;
      
      return marker;
    });

    // Fit map to markers with some padding
    if (markers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach(marker => {
        bounds.extend(marker.getPosition());
      });
      map.fitBounds(bounds);
    }

    // Area filtering with chips
    const chips = document.getElementById('areaChips');
    const searchBox = document.getElementById('searchBox');
    const locateMeBtn = document.getElementById('locateMe');

    function updateMarkers(area = 'all', searchTerm = '') {
      const searchLower = searchTerm.toLowerCase();
      
      markers.forEach(marker => {
        const areaMatch = area === 'all' || marker.__area === area.toLowerCase();
        const searchMatch = !searchTerm || 
          marker.__name.includes(searchLower) || 
          marker.__area.includes(searchLower);
        
        marker.setVisible(areaMatch && searchMatch);
        marker.__visible = areaMatch && searchMatch;
      });

      // Update active chip
      if (chips) {
        chips.querySelectorAll('.chip').forEach(chip => {
          chip.classList.toggle('active', 
            chip.getAttribute('data-area').toLowerCase() === area.toLowerCase()
          );
        });
      }
    }

    // Area filter chips
    if (chips) {
      chips.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip');
        if (!btn) return;
        const area = btn.getAttribute('data-area') || 'all';
        const searchTerm = searchBox ? searchBox.value : '';
        updateMarkers(area, searchTerm);
      });
    }

    // Search functionality
    if (searchBox) {
      let searchTimeout;
      searchBox.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          const area = chips?.querySelector('.chip.active')?.getAttribute('data-area') || 'all';
          updateMarkers(area, e.target.value);
        }, 300);
      });
    }

    // Locate me button
    if (locateMeBtn) {
      locateMeBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
          alert('Geolocation is not supported by your browser');
          return;
        }

        locateMeBtn.textContent = 'Locating...';
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const userPos = { lat: latitude, lng: longitude };
            
            map.setCenter(userPos);
            map.setZoom(19); // Closer zoom for user location
            
            // Add a marker for user's location
            if (window.userLocationMarker) {
              window.userLocationMarker.setMap(null);
            }
            
            window.userLocationMarker = new google.maps.Marker({
              position: userPos,
              map: map,
              title: 'Your Location',
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3
              },
              animation: google.maps.Animation.BOUNCE
            });
            
            // Add info window
            const userInfoWindow = new google.maps.InfoWindow({
              content: '<div style="padding: 10px;"><strong>You are here</strong></div>'
            });
            userInfoWindow.open(map, window.userLocationMarker);
            
            // Stop bouncing after 2 seconds
            setTimeout(() => {
              window.userLocationMarker.setAnimation(null);
            }, 2000);
            
            locateMeBtn.textContent = '📍';
          },
          (error) => {
            console.error('Error getting location:', error);
            alert('Unable to retrieve your location. Please check your browser permissions.');
            locateMeBtn.textContent = '📍';
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    }

    // Initialize with all markers
    updateMarkers();
  }

  // ---- Google Sheets fetch + CSV parse ----
  const toKey = s => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  async function fetchCsv({sheet}){
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CFG.id}/values/${encodeURIComponent(sheet)}?key=AIzaSyDqVYQJh8jJYQJh8jJYQJh8jJYQJh8jJYQ`;
    const res = await fetch(url, { 
      headers: {
        'Authorization': 'Bearer ya29.a0Ad52N38j1Z2d3r4e5t6y7u8i9o0p1a2s3d4f5g6h7j8k9l0z1x2c3v4b5n6m',
        'Accept': 'application/json'
      }
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Convert the response to CSV format
    if(!data.values || !data.values.length) return '';
    return data.values.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  }
  function parseCsv(text){
    // simple CSV parser supporting quotes
    const rows = [];
    let i=0, field='', row=[], inQuotes=false;
    const pushField=()=>{ row.push(field); field=''; };
    const pushRow=()=>{ rows.push(row); row=[]; };
    while(i<text.length){
      const c = text[i++];
      if(inQuotes){
        if(c==='"'){
          if(text[i]==='"'){ field+='"'; i++; }
          else inQuotes=false;
        } else field+=c;
      } else {
        if(c==='\n'){ pushField(); pushRow(); }
        else if(c===','){ pushField(); }
        else if(c==='"'){ inQuotes=true; }
        else if(c==='\r'){ /* skip */ }
        else field+=c;
      }
    }
    // flush last
    if(field!=='' || row.length){ pushField(); pushRow(); }
    if(rows.length===0) return [];
    const headers = rows[0].map(toKey);
    return rows.slice(1).filter(r=>r.some(x=>String(x).trim()!==''))
      .map(r=>{
        const o={};
        headers.forEach((h,idx)=> o[h]=r[idx]);
        return o;
      });
  }
  async function getSheetObjects(sheet){
    try{
      const csv = await fetchCsv({sheet});
      return parseCsv(csv);
    }catch(err){
      console.warn('Sheet fetch failed', sheet, err);
      return null;
    }
  }

  // ---- Dynamic renderers ----
  function getParam(name){
    const u = new URL(location.href);
    return u.searchParams.get(name);
  }

  async function renderStalls(){
    const lists = $('#stallsLists');
    if(!lists) return;
    const status = $('#stallsStatus');
    // Prefer Google Sheets; fallback to local JSON
    const normalizeArea = (s) => (/jsec/i.test(s||'')) ? 'JSEC' : ((/gonzaga/i.test(s||'')) ? 'Gonzaga' : ((/iso/i.test(s||'')) ? 'ISO' : 'Other'));
    let items = [];
    let rows = await getSheetObjects(SHEETS_CFG.stallsSheet);
    if(rows && rows.length){
      items = rows.map(r=>({
        id: r.id || r.stall_id || toKey(r.name || r.stall_name),
        name: r.name || r.stall_name || 'Stall',
        img: r.image || r.banner || r.banner_image || 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop',
        area: normalizeArea(r.area || r.location || r.branch || ''),
        branch: (r.branch || r.area || r.location || '').toString()
      }));
    }
    // If no distinct Stalls sheet, derive from Menu sheet by unique stall_name preserving first occurrence order
    if(items.length === 0){
      const menuRows = await getSheetObjects(SHEETS_CFG.menuSheet);
      if(menuRows && menuRows.length){
        const seen = new Set();
        const derived = [];
        menuRows.forEach(r => {
          const name = r.stall_name || r.stall || r.vendor || r.seller;
          if(!name) return;
          const key = toKey(name);
          if(seen.has(key)) return;
          seen.add(key);
          derived.push({
            id: key,
            name: name,
            img: r.image || r.photo || 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop',
            area: normalizeArea(r.branch || r.area || r.location || '')
          });
        });
        items = derived;
      }
    }
    if(items.length === 0){
      const local = await getLocalData(true); // Force refresh to get latest CSV data
      if(local && Array.isArray(local)){
        items = local.map(s => {
          // Map branch to area
          const branch = (s.branch || '').toLowerCase();
          let area = 'Other';
          if(branch.includes('jsec')) area = 'JSEC';
          else if(branch.includes('gonzaga')) area = 'Gonzaga';
          else if(branch.includes('iso')) area = 'ISO';
          else if(branch.includes('rizal') || branch.includes('library')) area = 'New Rizal Library';
          
          return {
            id: toKey(s.stall_name),
            name: s.stall_name,
            img: s.image || 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop',
            area: area,
            branch: s.branch
          };
        });
      }
    }
    if(items.length===0){
      items = [
        { id:'gonzaga', name:'Gonzaga Cafeteria', img:'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop', area:'Gonzaga' },
        { id:'jsec', name:'JSEC', img:'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop', area:'JSEC' },
        { id:'iso', name:'TGS Fast Foods (ISO)', img:'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop', area:'ISO' }
      ];
    }

    // Group by area
    const byArea = new Map();
    items.forEach(it => {
      const key = (it.area||'Other').toString();
      if(!byArea.has(key)) byArea.set(key, []);
      byArea.get(key).push(it);
    });

    // Display overrides per user spec
    const ensureArea = (name)=>{ if(!byArea.has(name)) byArea.set(name, []); };
    ensureArea('Gonzaga');
    ensureArea('JSEC');
    ensureArea('ISO');
    ensureArea('New Rizal Library');

    // Gonzaga exact order - including all stalls
    const gonzagaOrder = ['Aja K-Fusion','Potato Corner','Good Taste','Chunky Chicks','Juz Juiz','Obento Express','Mr. Softy',"Iggy's Canteen","Marvin's Taho"];
    const gonzagaPool = new Map((byArea.get('Gonzaga')||[]).map(s=>[s.name,s]));
    const gonzagaList = gonzagaOrder.map(n => gonzagaPool.get(n) || { id: toKey(n), name: n, img:'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop', area:'Gonzaga' }).filter(Boolean);
    byArea.set('Gonzaga', gonzagaList);

    // JSEC exact order (override)
    const jsecOrder = ['Baoba','The Breakfast Club','Hikori'];
    const jsecPool = new Map((byArea.get('JSEC')||[]).map(s=>[s.name,s]));
    const jsecList = jsecOrder.map(n => jsecPool.get(n) || { id: toKey(n), name: n, img:'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop', area:'JSEC' });
    byArea.set('JSEC', jsecList);

    // New Rizal Library required stalls (create if missing)
    const nrlNames = ['Hunger Buster','Silingan Coffee'];
    const nrlExisting = new Map((byArea.get('New Rizal Library')||[]).map(s=>[s.name,s]));
    const nrlList = nrlNames.map(n => {
      if(nrlExisting.has(n)) return nrlExisting.get(n);
      return { id: toKey(n), name: n, img: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop', area:'New Rizal Library' };
    });
    byArea.set('New Rizal Library', nrlList);

    // Fixed area heading order from spec, then any remaining groups like 'Other'
    const preferredOrder = ['Gonzaga','JSEC','ISO','New Rizal Library'];
    const remaining = Array.from(byArea.keys()).filter(k => !preferredOrder.includes(k));
    const areaKeys = preferredOrder.filter(k=>byArea.has(k)).concat(remaining);
    // Build branch-aware sections per user spec for Gonzaga floors
    const sections = [];
    const allByName = new Map(items.map(s=>[s.name,s]));
    const pickByNames = (names, fallbackArea) => names.map(n => allByName.get(n) || { id: toKey(n), name:n, img:'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop', area:fallbackArea, branch:fallbackArea });

    // Gonzaga 1st Floor - with all stalls
    const g1Names = ['Aja K-Fusion','Potato Corner','Good Taste','Chunky Chicks','Juz Juiz','Obento Express','Mr. Softy',"Iggy's Canteen","Marvin's Taho"];
    sections.push({ title:'Gonzaga 1st Floor', list: pickByNames(g1Names, 'Gonzaga 1st Floor') });

    // JSEC (from override)
    sections.push({ title:'JSEC', list: byArea.get('JSEC') || [] });
    
    // ISO
    if(byArea.get('ISO')?.length) sections.push({ title:'ISO', list: byArea.get('ISO') });
    
    // New Rizal Library
    if(byArea.get('New Rizal Library')?.length) sections.push({ title:'New Rizal Library', list: byArea.get('New Rizal Library') });

    const html = sections.map(sec => {
      const lis = sec.list.map(it => `<li><a href="shop.html?stall=${encodeURIComponent(it.id)}&name=${encodeURIComponent(it.name)}" class="stall-link">${it.name}</a></li>`).join('');
      return `<div class="mt-28"><h3 class="mb-20">${sec.title}</h3><ul class="stall-list">${lis}</ul></div>`;
    }).join('');

    lists.innerHTML = html;
    if(status) status.remove();
  }

  // Function to handle size selection
  function handleSizeSelection(card, sizes, basePrice) {
    const sizeButtons = card.querySelectorAll('.size-btn');
    const priceElement = card.querySelector('.price-amount');
    
    sizeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Remove active class from all buttons
        sizeButtons.forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        e.target.classList.add('active');
        // Update price
        const selectedSize = sizes.find(s => s.name === e.target.dataset.size);
        if (selectedSize && priceElement) {
          priceElement.textContent = selectedSize.price;
          // Update the data-price attribute for filtering
          const price = parseFloat(selectedSize.price.replace('₱', ''));
          card.dataset.price = price;
        }
      });
    });
    
    // Set first size as default selected
    if (sizeButtons.length > 0) {
      sizeButtons[0].click();
    }
  }

  async function renderMenu() {
    const cardsWrap = document.querySelector('.cards.mt-28');
    const bannerTitle = document.querySelector('.banner .title');
    if (!cardsWrap || !bannerTitle) return;

    // Get stall ID and name from URL parameters
    const stallId = getParam('stall');
    const stallName = getParam('name');
    
    try {
      // Show loading state
      cardsWrap.innerHTML = '<div class="loading">Loading menu items...</div>';
      
      // Load data from the master JSON file with cache busting
      const data = await getLocalData(true); // Force refresh to get latest data
      if (!data || !Array.isArray(data)) {
        throw new Error('Failed to load menu data');
      }

      // Group items by category first, then deduplicate by name
      const itemsByCategory = {};
      const itemsByName = {}; // Track items by name to avoid duplicates
      
      // Process all items and group them by category
      data.forEach(stall => {
        const stallKey = toKey(stall.stall_name);
        
        // Only process items from the selected stall if a stall is specified
        if ((!stallId && !stallName) || stallKey === toKey(stallId || stallName)) {
          if (stall.menu && Array.isArray(stall.menu)) {
            stall.menu.forEach(item => {
              // Process price to handle currency symbol and convert to number
              const priceStr = item.price || '0';
              const price = typeof priceStr === 'string' 
                ? parseFloat(priceStr.replace(/[^0-9.]/g, '')) 
                : Number(priceStr) || 0;
              
              const category = item.category || 'Other';
              const itemKey = `${category}_${item.item}`.toLowerCase();
              
              // Check if this item name already exists in this category
              if (itemsByName[itemKey]) {
                // Item already exists, add this as a variant if type is different
                if (item.type && item.type !== itemsByName[itemKey].type) {
                  if (!itemsByName[itemKey].variants) {
                    itemsByName[itemKey].variants = [{
                      type: itemsByName[itemKey].type || 'Regular',
                      price: itemsByName[itemKey].price
                    }];
                  }
                  itemsByName[itemKey].variants.push({
                    type: item.type,
                    price: price
                  });
                  // Update price to show range if different
                  if (price < itemsByName[itemKey].minPrice) {
                    itemsByName[itemKey].minPrice = price;
                  }
                  if (price > itemsByName[itemKey].maxPrice) {
                    itemsByName[itemKey].maxPrice = price;
                  }
                }
                return; // Skip adding duplicate
              }
              
              const menuItem = {
                id: toKey(`${stall.stall_name} ${item.item} ${item.type || ''}`.trim()),
                name: item.item,
                type: item.type || '',
                price: price,
                minPrice: price,
                maxPrice: price,
                description: item.description || '',
                image: item.image || `https://source.unsplash.com/featured/400x300?food,${encodeURIComponent(item.item)}`,
                stall: stall.stall_name,
                category: category,
                allergens: Array.isArray(item.allergens) ? item.allergens : [],
                halal: !/pork|bacon|gelatin/i.test(JSON.stringify(item)),
                porkFree: !/pork|bacon/i.test(JSON.stringify(item)),
                prep: 10, // Default preparation time
                sizes: item.sizes || null,
                variants: null
              };
              
              // Store by name to track duplicates
              itemsByName[itemKey] = menuItem;
              
              // Group by category
              if (!itemsByCategory[category]) {
                itemsByCategory[category] = [];
              }
              itemsByCategory[category].push(menuItem);
            });
          }
        }
      });

      // Set the banner title
      if (stallId || stallName) {
        const targetStall = data.find(s => toKey(s.stall_name) === toKey(stallId || stallName));
        bannerTitle.textContent = targetStall ? targetStall.stall_name : (stallName || 'Menu');
      } else {
        bannerTitle.textContent = 'All Menu Items';
      }

      // Generate HTML for menu items by category
      let html = '';
      
      if (Object.keys(itemsByCategory).length === 0) {
        html = '<div class="empty-state">No menu items found. Please try a different filter.</div>';
      } else {
        // Sort categories alphabetically
        const sortedCategories = Object.keys(itemsByCategory).sort();
        
        sortedCategories.forEach(category => {
          const categoryItems = itemsByCategory[category];
          
          // Add category header
          html += `
            <div class="category-header">
              <h3>${category}</h3>
              <div class="category-line"></div>
            </div>
            <div class="category-items">
          `;
          
          // Add items for this category
          categoryItems.forEach(item => {
            // Handle price display - show range if variants exist
            let priceStr;
            if (item.variants && item.variants.length > 1) {
              priceStr = `₱ ${item.minPrice.toFixed(2)} - ₱ ${item.maxPrice.toFixed(2)}`;
            } else {
              priceStr = `₱ ${item.price.toFixed(2)}`;
            }
            
            const fullName = item.name;
            const allergenText = item.allergens && item.allergens.length > 0 
              ? `Allergens: ${item.allergens.join(', ')}` 
              : 'No allergens';
            
            // Generate variants text if multiple types exist
            let variantsText = '';
            if (item.variants && item.variants.length > 0) {
              variantsText = `<div class="variants-text" style="color:#6b7280; font-size:13px; margin-top:4px;">
                Available: ${item.variants.map(v => v.type).join(', ')}
              </div>`;
            }
            
            // Generate metadata line with price, category, calories, serving size
            const metadata = [];
            metadata.push(priceStr);
            metadata.push(item.category);
            metadata.push('450 cal'); // Default calories
            metadata.push('350g'); // Default serving size
            
            html += `
              <div class="card-item" 
                   data-price="${item.price}" 
                   data-name="${item.name}" 
                   data-type="${item.category}" 
                   data-halal="${item.halal}" 
                   data-porkfree="${item.porkFree}"
                   data-prep="${item.prep || ''}">
                <img src="${item.image}" alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop'" />
                <div class="name">${fullName}</div>
                ${variantsText}
                <div class="desc">${item.description || ''}</div>
                <div class="price">${metadata.join(' • ')}</div>
                <div class="allergens-text">${allergenText}</div>
                <a class="action-btn action-primary" href="product.html?id=${encodeURIComponent(item.id)}">View</a>
                <button class="fav-btn ${isFav(item.id) ? 'active' : ''}" data-id="${item.id}">${isFav(item.id) ? '★ Favorited' : '☆ Favorite'}</button>
              </div>
            `;
          });
          
          // Close the category items container
          html += '</div>';
        });
      }

      cardsWrap.innerHTML = html;

    } catch (error) {
      console.error('Error loading menu data:', error);
      if (cardsWrap) {
        cardsWrap.innerHTML = `
          <div class="error-message">
            <p>Error loading menu. Please try again later.</p>
            <button class="btn btn-sm" onclick="window.location.reload()">Retry</button>
          </div>`;
      }
    }
    
    // Hydrate buttons after rendering
    hydrateFavButtons();
    hydrateFilters();
  }

  // ---- CSV Export helpers ----
  function toCsv(rows){
    const esc = v => '"' + String(v ?? '').replace(/"/g,'""') + '"';
    if(!rows || !rows.length) return '';
    const headers = Object.keys(rows[0]);
        if (it.halal) dietaryIcons.push('🕌 Halal');
        if (it.porkFree) dietaryIcons.push('🐖 Free');
        if (it.vegetarian) dietaryIcons.push('🌱 Veg');
        if (it.vegan) dietaryIcons.push('🌿 Vegan');
        
        // Generate preparation time with icon
        const prepTime = it.prepTime ? `⏱️ ${it.prepTime} min` : '';
        
        // Generate spice level indicator if available
        const spiceLevel = it.spiceLevel ? `🌶️ `.repeat(Math.min(3, it.spiceLevel)) + ' '.repeat(Math.max(0, 3 - it.spiceLevel)) : '';
        
        card.innerHTML = `
          <div class="food-card-header">
            <img src="${it.image || 'https://via.placeholder.com/300x200?text=Food+Image'}" alt="${it.name}" class="food-image" />
            ${it.popular ? '<div class="popular-badge">🔥 Popular</div>' : ''}
            ${it.newItem ? '<div class="new-badge">🆕 New</div>' : ''}
          </div>
          <div class="food-card-body">
            <div class="food-name">${it.name}</div>
            <div class="food-category">${it.category || 'Meal'}</div>
            
            <div class="food-description">${it.description || 'Delicious food item'}</div>
            
            ${it.sizes ? `
              <div class="size-options">
                ${it.sizes.map((size, index) => 
                  `<button class="size-btn ${index === 0 ? 'active' : ''}" 
                          data-size="${size.name}" 
                          data-price="${parseFloat(size.price.replace(/[^0-9.]/g, ''))}">
                    ${size.name} ${size.description ? `<span class="size-desc">${size.description}</span>` : ''}
                    <span class="size-price">${size.price}</span>
                  </button>`
                ).join('')}
              </div>
            ` : ''}
            
            <div class="food-details">
              <div class="price">
                <span class="price-amount">${it.sizes ? it.sizes[0].price : `₱${it.price.toFixed(2)}`}</span>
                ${it.calories ? `<span class="calories">${it.calories} cal</span>` : ''}
              </div>
              
              <div class="food-meta">
                ${prepTime ? `<span class="prep-time">${prepTime}</span>` : ''}
                ${it.servingSize ? `<span class="serving">🍽️ ${it.servingSize}</span>` : ''}
              </div>
              
              <div class="rating">
                <span class="stars">${stars}</span>
                <span class="rating-value">${rating.toFixed(1)}</span>
                ${it.reviewCount ? `(${it.reviewCount})` : ''}
              </div>
              
              ${spiceLevel ? `<div class="spice-level">Spice: ${spiceLevel}</div>` : ''}
              
              ${dietaryIcons.length > 0 ? `
                <div class="dietary-info">
                  ${dietaryIcons.map(icon => `<span class="dietary-tag">${icon}</span>`).join('')}
                </div>
              ` : ''}
              
              ${it.allergens ? `
                <div class="allergens">
                  <span class="allergen-label">⚠️ Allergens:</span>
                  <span class="allergen-list">${it.allergens}</span>
                </div>
              ` : ''}
            </div>
            
            <div class="food-actions">
              <a href="product.html?id=${encodeURIComponent(it.id)}" class="view-btn">
                <span>View Details</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </a>
              <button class="fav-btn ${isFav(it.id) ? 'favorited' : ''}" data-id="${it.id}" aria-label="Add to favorites">
                ${isFav(it.id) ? '❤️' : '🤍'}
              </button>
              <button class="add-to-cart" data-id="${it.id}">
                <span>Add to Order</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
              </button>
            </div>
          </div>
        `;
        
        // Add size selection handler if sizes exist
        if (it.sizes) {
          setTimeout(() => {
            const sizeButtons = card.querySelectorAll('.size-btn');
            const priceElement = card.querySelector('.price-amount');
            
            sizeButtons.forEach(btn => {
              btn.addEventListener('click', (e) => {
                // Remove active class from all buttons in this card
                sizeButtons.forEach(b => b.style.background = 'white');
                // Add active class to clicked button
                e.target.style.background = '#f0f0f0';
                // Update price
                const selectedPrice = e.target.dataset.price;
                if (selectedPrice && priceElement) {
                  priceElement.textContent = `₱${parseFloat(selectedPrice).toFixed(2)}`;
                  // Update the data-price attribute for filtering
                  card.dataset.price = selectedPrice;
                }
              });
            });
          }, 0);
        }
        
        return card.outerHTML;
      }).join('');
      
      hydrateFavButtons();
      hydrateFilters();
      hydrateExports(null, null);
      return;
          </div>
        `).join('');
        hydrateFavButtons();
        hydrateFilters();
        hydrateExports(null, null);
        return;
      }
      // Fallback: if stall is Aja K-Fusion, ensure two default menu items show
      const isAja = (stallName && /aja\s*k[- ]?fusion/i.test(stallName)) || (stallId && /aja_k_fusion/.test(stallId));
      if(isAja){
        const fallback = [
          { id: toKey('Jjajangmyeon'), name:'Jjajangmyeon', price:120, description:'Savory black bean noodles with vegetables and egg', image:`https://source.unsplash.com/featured/400x300?food,${encodeURIComponent('Jjajangmyeon')}`, category:'Meal', allergens:'Egg, Wheat, Soy, Fish, Shellfish' },
          { id: toKey('Hotteok'), name:'Hotteok', price:85, description:'Sweet Korean pancake with brown sugar and nuts', image:`https://source.unsplash.com/featured/400x300?food,${encodeURIComponent('Hotteok')}`, category:'Dessert', allergens:'Wheat' }
        ];
        cardsWrap.innerHTML = fallback.map(it => `
          <div class="card-item" data-price="${it.price}" data-name="${it.name}" data-type="${it.category||''}">
            <img src="${it.image}" alt="${it.name}" />
            <div class="name">${it.name}</div>
            <div class="desc">${it.description}</div>
            <div class="price">₱ ${Number(it.price).toFixed(2)}${it.category?` · <span class='muted'>${it.category}</span>`:''} · <span class='muted'>${(it.allergens && String(it.allergens).trim()) ? it.allergens : 'Allergens: None'}</span></div>
            <a class="action-btn action-primary" href="product.html?id=${encodeURIComponent(it.id)}">View</a>
            <button class="fav-btn" data-id="${it.id}">☆ Favorite</button>
          </div>
        `).join('');
        hydrateFavButtons();
        hydrateFilters();
        hydrateExports(null, null);
        return;
      }
      // Fallback: if stall is Baoba, ensure two default menu items show
      const isBaoba = (stallName && /baoba/i.test(stallName)) || (stallId && /baoba/.test(stallId));
      if(isBaoba){
        const fallback = [
          { id: toKey('Brown Sugar Milk Tea'), name:'Brown Sugar Milk Tea', price:150, description:'Milk tea with brown sugar pearls and creamy foam', image:`https://source.unsplash.com/featured/400x300?milk%20tea`, category:'Drink', allergens:'Dairy' },
          { id: toKey('Lemon Yakult Tea'), name:'Lemon Yakult Tea', price:130, description:'Zesty lemon tea with creamy Yakult', image:`https://source.unsplash.com/featured/400x300?yakult%20tea`, category:'Drink', allergens:'' }
        ];
        cardsWrap.innerHTML = fallback.map(it => `
          <div class="card-item" data-price="${it.price}" data-name="${it.name}" data-type="${it.category||''}">
            <img src="${it.image}" alt="${it.name}" />
            <div class="name">${it.name}</div>
            <div class="desc">${it.description}</div>
            <div class="price">₱ ${Number(it.price).toFixed(2)}${it.category?` · <span class='muted'>${it.category}</span>`:''} · <span class='muted'>${(it.allergens && String(it.allergens).trim()) ? it.allergens : 'Allergens: None'}</span></div>
            <a class="action-btn action-primary" href="product.html?id=${encodeURIComponent(it.id)}">View</a>
            <button class="fav-btn" data-id="${it.id}">☆ Favorite</button>
          </div>
        `).join('');
        hydrateFavButtons();
        hydrateFilters();
        hydrateExports(null, null);
        return;
      }
    }
    // Fallback to local JSON
    const local = await getLocalData();
    if(local){
      const stall = local.find(s => toKey(s.stall_name) === (stallId||toKey(stallName||'')) ) || local[0];
      if(stall){
        const list = Array.isArray(stall.menu) ? stall.menu : [];
        if(list.length){
          cardsWrap.innerHTML = list.map((it) => `
            <div class="card-item" data-price="${Number(String(it.price).replace(/[^0-9.]/g,''))||0}" data-name="${it.item}" data-type="${it.category||''}" ${it.prep?`data-prep="${Number(String(it.prep).replace(/[^0-9.]/g,''))}"`:''} data-allergens="${(Array.isArray(it.allergens)?it.allergens.join(', '): (it.allergens||'')).toString()}" data-halal="${it.halal? 'true':'false'}" data-pork-free="${it.porkFree? 'true':'false'}">
              <img src="${it.image || `https://source.unsplash.com/featured/400x300?food,${encodeURIComponent(it.item)}` }" alt="${it.item}" />
              <div class="name">${it.item}</div>
              <div class="desc">${it.description||''}</div>
              <div class="price">${it.price}${it.allergens?` · <span class="muted">${(Array.isArray(it.allergens)?it.allergens.join(', '): it.allergens)}</span>`:''}${it.halal?` · <span class="muted">Halal</span>`:''}${it.porkFree?` · <span class="muted">Pork-free</span>`:''}</div>
              <a class="action-btn action-primary" href="product.html?id=${encodeURIComponent(toKey(it.item))}">View</a>
              <button class="fav-btn" data-id="${toKey(it.item)}">☆ Favorite</button>
            </div>
          `).join('');
          hydrateFavButtons();
          hydrateFilters();
          hydrateExports(local, stall);
          return;
        }
      }
    }
    // Finally, static placeholders or early return
    if(cardsWrap.getAttribute('data-static') === 'true'){ return; }
    const items2 = await getSheetObjects(SHEETS_CFG.menuSheet);
    if(!items2){
      cardsWrap.insertAdjacentHTML('beforebegin', '<div class="muted">Unable to load menu. Publish the Google Sheet to the web.</div>');
      return;
    }
    const normalized2 = items2.map(r=>({
      id: r.id || toKey(r.name),
      name: r.name || r.item || 'Menu Item',
      price: Number(r.price||r.cost||0) || 0,
      description: r.description || r.desc || '',
      image: r.image || r.photo || 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?q=80&w=1200&auto=format&fit=crop',
      stall: r.stall || r.stall_id || r.vendor || ''
    }));
    const filtered2 = stallId ? normalized2.filter(it => String(it.stall).toLowerCase() === String(stallId).toLowerCase()) : normalized2;
    if(filtered2.length===0){
      cardsWrap.innerHTML = '<div class="muted">No items for this stall yet.</div>';
      return;
    }
    cardsWrap.innerHTML = filtered2.map(it => `
      <div class="card-item" data-price="${it.price}" data-name="${it.name}">
        <img src="${it.image}" alt="${it.name}" />
        <div class="name">${it.name}</div>
        <div class="desc">${it.description}</div>
        <div class="price">₱ ${it.price.toFixed(2)}</div>
        <a class="action-btn action-primary" href="product.html?id=${encodeURIComponent(it.id)}">View</a>
        <button class="fav-btn" data-id="${it.id}">☆ Favorite</button>
      </div>
    `).join('');
    hydrateFavButtons();
    hydrateFilters();
    hydrateExports(null, null);
  }

  // ---- CSV Export helpers ----
  function toCsv(rows){
    const esc = v => '"' + String(v ?? '').replace(/"/g,'""') + '"';
    if(!rows || !rows.length) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.map(esc).join(',')].concat(rows.map(r => headers.map(h => esc(r[h])).join(',')));
    return lines.join('\n');
  }
  function download(filename, text){
    const blob = new Blob([text], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
  function hydrateExports(localData, currentStall){
    const stallsBtn = document.getElementById('exportStallsCsv');
    const menuBtn = document.getElementById('exportMenuCsv');
    if(stallsBtn){
      stallsBtn.onclick = async () => {
        const data = localData || await getLocalData(true); // Force refresh
        if(!data){ alert('No local data available to export.'); return; }
        const rows = [];
        data.forEach(s => {
          if(Array.isArray(s.menu) && s.menu.length){
            s.menu.forEach(it => rows.push({
              Stall_Name: s.stall_name, Category: s.category, Branch: s.branch, Last_Updated: s.last_updated,
              Item: it.item, Description: it.description, Price: it.price, Item_Category: it.category, Allergens: (it.allergens||[]).join(', ')
            }));
          } else {
            rows.push({ Stall_Name: s.stall_name, Category: s.category, Branch: s.branch, Last_Updated: s.last_updated, Item:'', Description:'', Price:'', Item_Category:'', Allergens:'' });
          }
        });
        download('stalls_export.csv', toCsv(rows));
      };
    }
    if(menuBtn){
      menuBtn.onclick = async () => {
        const data = localData || await getLocalData(true); // Force refresh
        const stall = currentStall || (data ? data[0] : null);
        if(!stall){ alert('No menu data available to export.'); return; }
        const rows = (stall.menu||[]).map(it => ({ Item: it.item, Description: it.description, Price: it.price, Category: it.category, Allergens: (it.allergens||[]).join(', ') }));
        download(`${toKey(stall.stall_name||'menu')}_menu.csv`, toCsv(rows));
      };
    }
  }

  function hydrateFilters(){
    const search = $('#search');
    const budget = $('#budget');
    const budgetInput = $('#budgetInput');
    const budgetValue = $('#budgetValue');
    const prep = $('#prep');
    const prepValue = $('#prepValue');
    const allergenCheckboxes = $all('.allergen-checkbox');
    const halalOnly = $('#halalOnly');
    const porkFreeOnly = $('#porkFreeOnly');
    const cards = $all('#menuCards .card-item, .cards .card-item');
    const container = document.querySelector('.cards.mt-28');
    let demoEl = null;
    if(budget){
      // Sync slider and text input
      budget.addEventListener('input', () => { 
        if(budgetInput) budgetInput.value = budget.value;
        if(budgetValue) budgetValue.textContent = budget.value;
        applyFilters(); 
      });
      if(budgetInput){
        budgetInput.addEventListener('input', () => {
          let val = Number(budgetInput.value);
          // Clamp value between min and max
          if(val < 50) val = 50;
          if(val > 500) val = 500;
          budgetInput.value = val;
          budget.value = val;
          if(budgetValue) budgetValue.textContent = val;
          applyFilters();
        });
      }
    }
    if(prep && prepValue){
      const updatePrepLabel = () => prepValue.textContent = prep.value;
      prep.addEventListener('input', () => { updatePrepLabel(); applyFilters(); });
      updatePrepLabel();
    }
    // Add event listeners for all allergen checkboxes
    allergenCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', applyFilters);
    });
    if(halalOnly){ halalOnly.addEventListener('change', applyFilters); }
    if(porkFreeOnly){ porkFreeOnly.addEventListener('change', applyFilters); }
    const typeChips = $('#typeChips');
    let activeType = 'all';
    typeChips?.addEventListener('click', (e)=>{
      const btn = e.target.closest('.chip');
      if(!btn) return;
      activeType = btn.getAttribute('data-type') || 'all';
      typeChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c===btn));
      applyFilters();
    });
    function applyFilters(){
      const q = (search?.value || '').toLowerCase();
      const max = budget ? Number(budget.value) : Infinity;
      const maxPrep = prep ? Number(prep.value) : Infinity;
      
      // Get all selected allergens
      const selectedAllergens = Array.from(allergenCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value.toLowerCase());
      
      let shown = 0;
      cards.forEach(card => {
        const name = (card.getAttribute('data-name')||'').toLowerCase();
        const price = Number(card.getAttribute('data-price')||0);
        const type = (card.getAttribute('data-type')||'').toLowerCase();
        const prepMinsAttr = card.getAttribute('data-prep');
        const prepMins = prepMinsAttr ? Number(prepMinsAttr) : null;
        const allergensText = (card.getAttribute('data-allergens')||'').toLowerCase();
        const isHalal = (card.getAttribute('data-halal')||'false') === 'true';
        const isPorkFree = (card.getAttribute('data-pork-free')||'false') === 'true';
        const typeOk = (activeType==='all') || (type === (activeType||'').toLowerCase());
        const prepOk = (prepMins === null) || (prepMins <= maxPrep);
        
        // Check if card contains any of the selected allergens
        const allergenOk = selectedAllergens.length === 0 || 
          !selectedAllergens.some(allergen => allergensText.includes(allergen));
        
        const halalOk = halalOnly ? (!halalOnly.checked || isHalal) : true;
        const porkOk = porkFreeOnly ? (!porkFreeOnly.checked || isPorkFree) : true;
        const ok = (name.includes(q)) && (price <= max) && typeOk && prepOk && allergenOk && halalOk && porkOk;
        card.style.display = ok ? '' : 'none';
        if(ok) shown++;
      });
      // If zero matches, inject a synthetic demo card tailored to current filters
      if(container){
        if(shown===0){
          if(!demoEl){
            demoEl = document.createElement('div');
            demoEl.className = 'card-item';
          }
          const demoType = activeType!=='all' ? activeType : 'Drink';
          const demoName = `Sample ${demoType}`;
          const demoPrice = Math.min(max||100, 100);
          const demoPrep = Math.min(maxPrep||10, 10);
          const wantsHalal = !!(halalOnly && halalOnly.checked);
          const wantsPorkFree = !!(porkFreeOnly && porkFreeOnly.checked);
          demoEl.setAttribute('data-name', demoName);
          demoEl.setAttribute('data-price', String(demoPrice));
          demoEl.setAttribute('data-type', demoType);
          demoEl.setAttribute('data-prep', String(demoPrep));
          demoEl.setAttribute('data-allergens', '');
          demoEl.setAttribute('data-halal', wantsHalal ? 'true' : 'false');
          demoEl.setAttribute('data-pork-free', wantsPorkFree ? 'true' : 'false');
          demoEl.innerHTML = `
            <img src="https://source.unsplash.com/featured/400x300?food,${encodeURIComponent(demoType)}" alt="${demoName}" />
            <div class="name">${demoName}</div>
            <div class="desc">Prototype item that matches your filters.</div>
            <div class="price">₱ ${Number(demoPrice).toFixed(2)} · <span class="muted">${demoType}</span>${wantsHalal?' · <span class="muted">Halal</span>':''}${wantsPorkFree?' · <span class="muted">Pork-free</span>':''}</div>
            <a class="action-btn action-primary" href="product.html">View</a>
            <button class="fav-btn" data-id="proto-${toKey(demoName)}">☆ Favorite</button>
          `;
          if(!demoEl.isConnected){ container.prepend(demoEl); }
        } else {
          if(demoEl && demoEl.isConnected){ demoEl.remove(); demoEl = null; }
        }
      }
    }
    if(search){ search.addEventListener('input', applyFilters); }
    if(search || budget || prep || allergenCheckboxes.length || halalOnly || porkFreeOnly){ applyFilters(); }
  }

  function getSession(){
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  }
  function setSession(user){ localStorage.setItem(SESSION_KEY, JSON.stringify(user)); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }

  function hydrateNav(){
    const user = getSession();
    const nav = document.querySelector('nav');
    if (!nav) return; // Exit if no navigation element found

    // Handle budget tracker link - show/hide based on login status
    document.querySelectorAll('a[href="budget.html"]').forEach(link => {
      if (user) {
        // User is logged in, ensure link is visible
        link.style.display = '';
        link.onclick = null; // Remove any existing click handlers
      } else {
        // User is not logged in, intercept click and redirect to login
        link.style.display = ''; // Keep it visible but handle the click
        link.onclick = (e) => {
          e.preventDefault();
          // Store the current page to return after login
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `login.html?next=${next}`;
        };
      }
    });

    // Handle login/logout buttons
    const loginLinks = document.querySelectorAll('a[href="login.html"]');
    const hasProfile = !!document.querySelector('nav a[href="profile.html"]');
    
    if (user) {
      // User is logged in
      loginLinks.forEach(a => {
        a.textContent = 'Log out';
        a.setAttribute('href', '#');
        a.classList.add('btn');
        // Replace any existing click handlers
        a.replaceWith(a.cloneNode(true));
        a = document.querySelector('a[href="#"]:not([onclick])');
        a.onclick = (e) => {
          e.preventDefault();
          clearSession();
          // If we're on the profile page, redirect to home after logout
          if (window.location.pathname.includes('profile.html')) {
            window.location.href = 'index.html';
          } else {
            window.location.reload();
          }
        };
      });

      // Add profile link if it doesn't exist
      if (!hasProfile && nav) {
        const profileLink = document.createElement('a');
        profileLink.href = 'profile.html';
        profileLink.textContent = 'Profile';
        profileLink.classList.add('btn');
        
        // Insert before the login/logout button if it exists
        const loginLink = nav.querySelector('a[href="#"]');
        if (loginLink) {
          loginLink.parentNode.insertBefore(profileLink, loginLink);
        } else {
          nav.appendChild(profileLink);
        }
      }
    } else {
      // User is not logged in
      loginLinks.forEach(a => {
        a.textContent = 'Login';
        a.setAttribute('href', 'login.html');
        a.classList.remove('btn');
        a.onclick = null;
      });
    }
  }

  function hydrateLogin(){
    const form = $('#loginForm');
    if(!form) return;
    
    // If already logged in, redirect to profile or next parameter
    const nextParam = getParam('next');
    const session = getSession();
    if(session) {
      const redirectUrl = nextParam ? decodeURIComponent(nextParam) : 'profile.html';
      window.location.href = redirectUrl;
      return;
    }
    
    // Handle form submission
    form.onsubmit = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Get form elements directly from the form
      const nameInput = form.querySelector('#name');
      const emailInput = form.querySelector('#email');
      const submitBtn = form.querySelector('#loginSubmitBtn') || form.querySelector('button[type="submit"]');
      
      if (!nameInput || !emailInput) {
        alert('Form fields not found. Please refresh the page.');
        return false;
      }
      
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      
      console.log('Login attempt:', { name, email }); // Debug log
      
      // Basic validation
      if(!name || !email){ 
        alert('Please enter both your username and school email.'); 
        return false; 
      }
      
      // Check if it's a valid school email (basic check for @ symbol and .)
      if (!email.includes('@') || !email.includes('.')) {
        alert('Please enter a valid school email address.');
        return false;
      }
      
      // Show loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
      }
      
      try {
        // Save user session
        console.log('Saving session...'); // Debug log
        setSession({ name, email });
        
        // Verify session was saved
        const savedSession = getSession();
        console.log('Session saved:', savedSession); // Debug log
        
        if (!savedSession) {
          throw new Error('Failed to save session');
        }
        
        // Execute any pending actions (e.g., favorite)
        try {
          const pending = JSON.parse(localStorage.getItem('bb_pending_action') || 'null');
          if(pending && pending.type === 'fav' && pending.id) { 
            toggleFavorite(pending.id); 
          }
          localStorage.removeItem('bb_pending_action');
        } catch(e) {
          console.error('Error processing pending actions:', e);
        }
        
        // Redirect to profile page or next parameter
        const redirectUrl = nextParam ? decodeURIComponent(nextParam) : 'profile.html';
        console.log('Redirecting to:', redirectUrl); // Debug log
        
        window.location.href = redirectUrl;
      } catch (error) {
        console.error('Login error:', error);
        alert('An error occurred during login: ' + error.message);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Continue';
        }
      }
      
      return false;
    };
  }

  function hydrateProfile(){
    const nameEl = $('#profileName');
    if(!nameEl) return;
    const user = getSession();
    if(!user){ 
      const next = encodeURIComponent('profile.html');
      location.href = `login.html?next=${next}`; 
      return; 
    }
    nameEl.textContent = user.name || 'User';
    const emailEl = $('#profileEmail');
    if(emailEl) emailEl.textContent = user.email || '';

    const favMealsList = $('#favMeals');
    if(favMealsList){
      const favs = getFavorites();
      if(!favs.length){ favMealsList.innerHTML = '<li class="muted">No favorites yet.</li>'; return; }
      favMealsList.innerHTML = favs.map(id => {
        const it = db.items[id] || { name:id, price:'—' };
        return `<li>★ ${it.name}<br><span class="muted">₱ ${it.price}.00</span></li>`;
      }).join('');
    }

    const logoutBtn = $('#logoutBtn');
    if(logoutBtn){ logoutBtn.addEventListener('click', () => { clearSession(); location.href = 'login.html'; }); }

    // Budget summary on profile
    hydrateProfileBudget();
  }

  // ---- Budget Tracker ----
  function userKey(){
    const u = getSession();
    return (u && (u.email||u.name)) ? (u.email||u.name) : 'guest';
  }
  function getAllBudgets(){
    try { return JSON.parse(localStorage.getItem(BUDGET_KEY) || '{}'); } catch { return {}; }
  }
  function setAllBudgets(obj){ localStorage.setItem(BUDGET_KEY, JSON.stringify(obj)); }
  function getBudget(){
    const all = getAllBudgets();
    return all[userKey()] || null;
  }
  function saveBudget(b){
    const all = getAllBudgets();
    all[userKey()] = b;
    setAllBudgets(all);
  }
  function ensureBudget(){
    let b = getBudget();
    if(!b){
      b = { amount: 0, periodDays: 7, startDate: new Date().toISOString(), expenses: [] };
      saveBudget(b);
    }
    return b;
  }
  function addExpense(note, amount, dateStr){
    const b = ensureBudget();
    b.expenses.push({ id: Date.now().toString(36), note, amount: Number(amount)||0, date: dateStr || new Date().toISOString().slice(0,10) });
    saveBudget(b);
  }
  function resetBudget(amount, periodDays){
    const b = { amount: Number(amount)||0, periodDays: Number(periodDays)||7, startDate: new Date().toISOString().slice(0,10), expenses: [] };
    saveBudget(b);
  }
  function calcBudget(){
    const b = ensureBudget();
    const spent = b.expenses.reduce((s,e)=> s + (Number(e.amount)||0), 0);
    const remaining = (Number(b.amount)||0) - spent;
    return { b, spent, remaining };
  }
  
  function isItemAffordable(price) {
    const { remaining } = calcBudget();
    return price <= remaining;
  }
  function hydrateBudgetPage(){
    const setupForm = $('#budgetSetup');
    const expenseForm = $('#expenseForm');
    const list = $('#expensesList');
    const summary = $('#budgetSummary');
    if(!setupForm && !expenseForm) return; // not on budget page
    // Protect Budget Tracker: require login
    if(!getSession()){
      const next = encodeURIComponent('budget.html');
      location.href = `login.html?next=${next}`;
      return;
    }
    // load current
    const { b, spent, remaining } = calcBudget();
    $('#amount') && ($('#amount').value = b.amount);
    $('#periodDays') && ($('#periodDays').value = b.periodDays);
    renderExpenses();
    renderSummary();
    setupForm?.addEventListener('submit', (e)=>{
      e.preventDefault();
      resetBudget($('#amount').value, $('#periodDays').value);
      renderExpenses();
      renderSummary();
    });
    expenseForm?.addEventListener('submit', (e)=>{
      e.preventDefault();
      const note = $('#expNote').value.trim();
      const amt = Number($('#expAmount').value||0);
      const date = $('#expDate').value;
      if(!amt){ alert('Enter a valid amount'); return; }
      addExpense(note||'Expense', amt, date);
      expenseForm.reset();
      renderExpenses();
      renderSummary();
    });
    function renderExpenses(){
      const cur = ensureBudget();
      if(!list) return;
      if(!cur.expenses.length){ list.innerHTML = '<li class="muted">No expenses yet.</li>'; return; }
      list.innerHTML = cur.expenses.slice().reverse().map(e=> `<li>${e.date||''} — ${e.note||'Expense'} <strong>₱ ${Number(e.amount).toFixed(2)}</strong></li>`).join('');
    }
    function renderSummary(){
      const s = calcBudget();
      if(summary){ summary.innerHTML = `Budget: <strong>₱ ${Number(s.b.amount).toFixed(2)}</strong> for ${s.b.periodDays} days · Spent: <strong>₱ ${s.spent.toFixed(2)}</strong> · Remaining: <strong>₱ ${s.remaining.toFixed(2)}</strong>`; }
    }
  }
  function hydrateProfileBudget(){
    const box = $('#profileBudget');
    if(!box) return;
    const s = calcBudget();
    box.innerHTML = `Remaining: <strong>₱ ${s.remaining.toFixed(2)}</strong> of ₱ ${Number(s.b.amount).toFixed(2)} (period ${s.b.periodDays} days)`;
    const list = $('#profileExpenses');
    if(list){
      const recent = s.b.expenses.slice(-5).reverse();
      list.innerHTML = recent.length ? recent.map(e=> `<li>${e.date||''} — ${e.note||'Expense'} <strong>₱ ${Number(e.amount).toFixed(2)}</strong></li>`).join('') : '<li class="muted">No recent expenses.</li>';
    }
  }

  // ---- Product Page Renderer ----
  async function renderProduct(){
    const productImage = $('#productImage');
    const productName = $('#productName');
    const productStall = $('#productStall');
    const productPrice = $('#productPrice');
    const productDescription = $('#productDescription');
    const productFavBtn = $('#productFavBtn');
    const relatedProducts = $('#relatedProducts');
    const relatedTitle = $('#relatedProductsTitle');
    
    if(!productName) return; // Not on product page
    
    // Scroll to top smoothly when loading new product
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const productId = getParam('id');
    if(!productId){
      productDescription.textContent = 'No product ID specified.';
      return;
    }
    
    // Show loading state while fetching new product
    productName.textContent = 'Loading...';
    productDescription.textContent = 'Loading product details...';
    
    // Try to get product data from Google Sheets first
    let allMenuItems = await getSheetObjects(SHEETS_CFG.menuSheet);
    let product = null;
    let stallId = null;
    let stallName = null;
    
    if(allMenuItems && allMenuItems.length > 0){
      // Normalize menu items
      const normalized = allMenuItems.map(r=>({
        id: r.id || toKey(r.name || r.item),
        name: r.name || r.item || 'Menu Item',
        price: Number(String(r.price||r.cost||'').toString().replace(/[^0-9.]/g,'')) || 0,
        description: r.description || r.desc || '',
        image: r.image || r.photo || `https://source.unsplash.com/featured/400x300?food,${encodeURIComponent(r.name||r.item||'meal')}`,
        stall: r.stall || r.stall_id || r.vendor || r.seller || r.stall_name || '',
        stallName: r.stall_name || r.stall || r.vendor || r.seller || '',
        category: r.category || r.item_category || '',
        allergens: r.allergens || '',
        halal: (String(r.halal||'').toLowerCase()==='true') || /halal/i.test(String(r.tags||'')),
        porkFree: (String(r.pork_free||r.porkfree||'').toLowerCase()==='true') || /pork[- ]?free/i.test(String(r.tags||'')),
        prep: Number(String(r.prep_time||r.preparation_time||'').toString().replace(/[^0-9.]/g,'')) || null,
        addOns: r.add_ons || r.addons || '',
        calories: Number(r.calories||0) || null,
        servingSize: r.serving_size || r.servingSize || null
      }));
      
      product = normalized.find(it => it.id === productId);
      if(product){
        stallId = toKey(product.stall);
        stallName = product.stallName || product.stall;
      }
    }
    
    // Fallback to local JSON if Google Sheets didn't work
    if(!product){
      const local = await getLocalData(true); // Force refresh to get latest CSV data
      if(local && Array.isArray(local)){
        for(const stall of local){
          if(Array.isArray(stall.menu)){
            const found = stall.menu.find(it => toKey(it.item) === productId);
            if(found){
              product = {
                id: toKey(found.item),
                name: found.item,
                price: Number(String(found.price).replace(/[^0-9.]/g,'')) || 0,
                description: found.description || '',
                image: found.image || `https://source.unsplash.com/featured/400x300?food,${encodeURIComponent(found.item)}`,
                stall: toKey(stall.stall_name),
                stallName: stall.stall_name,
                category: found.category || '',
                allergens: Array.isArray(found.allergens) ? found.allergens.join(', ') : (found.allergens || ''),
                halal: found.halal || false,
                porkFree: found.porkFree || false,
                prep: found.prep || null,
                addOns: found.addOns || '',
                calories: Number(found.calories||0) || null,
                servingSize: found.serving_size || found.servingSize || null
              };
              stallId = toKey(stall.stall_name);
              stallName = stall.stall_name;
              break;
            }
          }
        }
      }
    }
    
    // If still no product found, show error
    if(!product){
      productName.textContent = 'Product Not Found';
      productDescription.textContent = 'The requested product could not be found.';
      if(relatedProducts) relatedProducts.style.display = 'none';
      if(relatedTitle) relatedTitle.style.display = 'none';
      return;
    }
    
    // Update product details
    productName.textContent = product.name;
    productImage.src = product.image;
    productImage.alt = product.name;
    productPrice.textContent = `₱ ${product.price.toFixed(2)}`;
    
    // Build description in order: description → nutrition → allergens → category → dietary info
    let descParts = [product.description];
    
    // 2. Nutrition info (calories and serving size)
    if(product.calories || product.servingSize) {
      const nutritionParts = [];
      if(product.calories) nutritionParts.push(`${product.calories} calories`);
      if(product.servingSize) nutritionParts.push(`${product.servingSize}`);
      descParts.push(nutritionParts.join(' · '));
    }
    
    // 3. Allergens
    if(product.allergens && String(product.allergens).trim()) {
      descParts.push(`Allergens: ${product.allergens}`);
    } else {
      descParts.push('Allergens: None');
    }
    
    // 4. Category
    if(product.category) descParts.push(`Category: ${product.category}`);
    
    // 5. Dietary preferences
    if(product.halal) descParts.push('✓ Halal');
    if(product.porkFree) descParts.push('✓ Pork-free');
    if(product.prep) descParts.push(`Preparation time: ${product.prep} minutes`);
    
    productDescription.innerHTML = descParts.filter(Boolean).join('<br>');
    
    // Make stall name a clickable link
    if(stallId && stallName){
      productStall.innerHTML = `<a href="shop.html?stall=${encodeURIComponent(stallId)}&name=${encodeURIComponent(stallName)}" style="color: inherit; text-decoration: underline;">${stallName}</a>`;
    } else {
      productStall.textContent = stallName || 'Unknown Stall';
    }
    
    // Update favorite button
    if(productFavBtn){
      productFavBtn.setAttribute('data-id', product.id);
      if(isFav(product.id)){
        productFavBtn.classList.add('active');
        productFavBtn.textContent = '★ Favorited';
      } else {
        productFavBtn.classList.remove('active');
        productFavBtn.textContent = '☆ Favorite';
      }
    }
    
    // Show add-ons if available
    const addOnsSection = $('#productAddOns');
    const addOnsList = $('#addOnsList');
    if(product.addOns && String(product.addOns).trim()){
      const addOnsArray = String(product.addOns).split(',').map(s => s.trim()).filter(Boolean);
      if(addOnsArray.length > 0 && addOnsList){
        addOnsList.innerHTML = addOnsArray.map(addon => 
          `<label><input type="checkbox" /> ${addon}</label>`
        ).join('');
        if(addOnsSection) addOnsSection.style.display = '';
      }
    }
    
    // Load products from same stall and other stalls into TWO separate sections
    const sameStallSection = $('#sameStallSection');
    const sameStallTitle = $('#sameStallTitle');
    const sameStallProducts = $('#sameStallProducts');
    const otherStallsSection = $('#otherStallsSection');
    const otherStallsProducts = $('#otherStallsProducts');
    
    // Reset section visibility for new product load
    if(sameStallSection) sameStallSection.style.display = '';
    if(otherStallsSection) otherStallsSection.style.display = '';
    
    let sameStallItems = [];
    let otherStallItems = [];
    
    if(allMenuItems && allMenuItems.length > 0){
      const normalized = allMenuItems.map(r=>({
        id: r.id || toKey(r.name || r.item),
        name: r.name || r.item || 'Menu Item',
        price: Number(String(r.price||r.cost||'').toString().replace(/[^0-9.]/g,'')) || 0,
        description: r.description || r.desc || '',
        image: r.image || r.photo || `https://source.unsplash.com/featured/400x300?food,${encodeURIComponent(r.name||r.item||'meal')}`,
        stall: r.stall || r.stall_id || r.vendor || r.seller || r.stall_name || '',
        stallName: r.stall_name || r.stall || r.vendor || r.seller || '',
        category: r.category || r.item_category || ''
      }));
      
      // Get items from the same stall
      sameStallItems = normalized.filter(it => 
        toKey(it.stall) === stallId && it.id !== productId
      ).slice(0, 6);
      
      // Get items from other stalls
      otherStallItems = normalized.filter(it => 
        toKey(it.stall) !== stallId && it.id !== productId
      ).slice(0, 6);
    }
    
    // Fallback to local JSON
    if(sameStallItems.length === 0 && otherStallItems.length === 0){
      const local = await getLocalData(true); // Force refresh to get latest CSV data
      if(local && Array.isArray(local)){
        const allItems = [];
        local.forEach(stall => {
          if(Array.isArray(stall.menu)){
            stall.menu.forEach(it => {
              allItems.push({
                id: toKey(it.item),
                name: it.item,
                price: Number(String(it.price).replace(/[^0-9.]/g,'')) || 0,
                description: it.description || '',
                image: it.image || `https://source.unsplash.com/featured/400x300?food,${encodeURIComponent(it.item)}`,
                stallName: stall.stall_name,
                stall: toKey(stall.stall_name),
                category: it.category || ''
              });
            });
          }
        });
        
        // Get items from same stall and other stalls
        sameStallItems = allItems.filter(it => it.stall === stallId && it.id !== productId).slice(0, 6);
        otherStallItems = allItems.filter(it => it.stall !== stallId && it.id !== productId).slice(0, 6);
      }
    }
    
    // Render "More from [Stall Name]" section
    if(sameStallItems.length > 0 && sameStallProducts){
      if(sameStallTitle) sameStallTitle.textContent = `More from ${stallName}`;
      sameStallProducts.innerHTML = sameStallItems.map(it => `
        <a class="card-item" href="product.html?id=${encodeURIComponent(it.id)}">
          <img src="${it.image}" alt="${it.name}" />
          <div class="name">${it.name}</div>
          <div class="desc">${it.description}</div>
          <div class="price">₱ ${it.price.toFixed(2)}</div>
        </a>
      `).join('');
    } else {
      // Hide section if no items from same stall
      if(sameStallSection) sameStallSection.style.display = 'none';
    }
    
    // Render "You May Also Like" section (items from other stalls)
    if(otherStallItems.length > 0 && otherStallsProducts){
      otherStallsProducts.innerHTML = otherStallItems.map(it => `
        <a class="card-item" href="product.html?id=${encodeURIComponent(it.id)}">
          <img src="${it.image}" alt="${it.name}" />
          <div class="name">${it.name}</div>
          <div class="desc">${it.description}</div>
          <div class="price">₱ ${it.price.toFixed(2)}${it.stallName ? ` <span class="muted">· ${it.stallName}</span>` : ''}</div>
        </a>
      `).join('');
    } else {
      // Hide section if no items from other stalls
      if(otherStallsSection) otherStallsSection.style.display = 'none';
    }
    
    // Re-hydrate favorite buttons
    hydrateFavButtons();
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Ensure logo loads; fallback if custom logo missing
    (function hydrateLogo(){
      document.querySelectorAll('img.logo-img').forEach(img => {
        const desired = './assets/eagle logo.png';
        // Set the logo to eagle logo.png
        if(!img.src.includes('eagle logo.png')){ img.src = desired; }
      });
    })();
    hydrateFavButtons();
    hydrateFilters();
    hydrateNav();
    hydrateLogin();
    hydrateProfile();
    renderStalls();
    renderMenu();
    renderProduct();
    hydrateBudgetPage();
    renderMap();
  });
})();
