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
  async function getLocalData(){
    if(localDataCache) return localDataCache;
    try{
      const res = await fetch(LOCAL_JSON, { cache:'no-store' });
      if(!res.ok) throw new Error('local json missing');
      localDataCache = await res.json();
      return localDataCache;
    }catch(e){
      return null;
    }
  }
  

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
      if(isFav(id)) btn.classList.add('active');
      btn.addEventListener('click', () => {
        const user = getSession();
        if(!user){
          try{
            localStorage.setItem('bb_pending_action', JSON.stringify({ type:'fav', id, returnTo: location.href }));
          }catch{}
          const next = encodeURIComponent(location.href);
          location.href = `login.html?next=${next}`;
          return;
        }
        const active = toggleFavorite(id);
        btn.classList.toggle('active', active);
        btn.textContent = active ? '★ Favorited' : '☆ Favorite';
      });
    });
  }

  async function renderMap(){
    const mapEl = document.getElementById('map');
    if(!mapEl || typeof L === 'undefined') return;
    const ateneo = [14.6394, 121.0789]; // center near Ateneo de Manila University
    const map = L.map('map', { scrollWheelZoom: false }).setView(ateneo, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const rows = await getSheetObjects(SHEETS_CFG.stallsSheet);
    let points = [];
    if(rows && rows.length){
      points = rows.map(r => {
        const id = r.id || r.stall_id || toKey(r.name);
        const name = r.name || r.stall_name || 'Stall';
        const lat = Number(r.lat || r.latitude);
        const lng = Number(r.lng || r.lon || r.long || r.longitude);
        const area = r.area || r.location || '';
        return (isFinite(lat) && isFinite(lng)) ? { id, name, lat, lng, area } : null;
      }).filter(Boolean);
    }
    if(points.length === 0){
      // Fallback mock coordinates for common canteens
      points = [
        { id:'gonzaga', name:'Gonzaga Cafeteria', area:'Gonzaga', lat:14.64038, lng:121.07493 },
        { id:'jsec', name:'JSEC', area:'JSEC', lat:14.63882, lng:121.07867 },
        { id:'iso', name:'TGS Fast Foods (ISO)', area:'ISO', lat:14.63686, lng:121.08041 }
      ];
    }
    const markers = points.map(p => {
      const m = L.marker([p.lat, p.lng]).addTo(map);
      m.bindPopup(`<strong>${p.name}</strong><br/><a href="shop.html?stall=${encodeURIComponent(p.id)}&name=${encodeURIComponent(p.name)}">View Menu</a>`);
      m.__area = (p.area||'').toString();
      return m;
    });

    // Chips filtering
    const chips = document.getElementById('areaChips');
    function setActive(area){
      markers.forEach(m => {
        const ok = (area==='all') || (m.__area.toLowerCase() === area.toLowerCase());
        if(ok){ m.addTo(map); } else { map.removeLayer(m); }
      });
      chips?.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-area').toLowerCase()===area.toLowerCase()));
    }
    chips?.addEventListener('click', (e)=>{
      const btn = e.target.closest('.chip');
      if(!btn) return;
      const area = btn.getAttribute('data-area') || 'all';
      setActive(area);
    });
    setActive('all');
  }

  // ---- Google Sheets fetch + CSV parse ----
  const toKey = s => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  async function fetchCsv({sheet}) {
    try {
      // Using a CORS proxy to avoid CORS issues
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEETS_CFG.id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
      
      // Try with proxy first
      const response = await fetch(proxyUrl + encodeURIComponent(sheetUrl), {
        headers: {
          'Content-Type': 'text/csv;charset=UTF-8'
        }
      });
      
      if (!response.ok) {
        // Fallback to direct fetch if proxy fails
        console.warn('Proxy fetch failed, trying direct fetch');
        const directResponse = await fetch(sheetUrl, { 
          mode: 'no-cors',
          credentials: 'omit' 
        });
        
        if (!directResponse.ok) {
          throw new Error(`Failed to fetch data: ${directResponse.status}`);
        }
        return await directResponse.text();
      }
      
      return await response.text();
      
    } catch (error) {
      console.error('Error fetching sheet data:', error);
      // Load from local data if available
      try {
        const localData = await getLocalData();
        if (localData) {
          console.log('Using local data as fallback');
          return localData;
        }
      } catch (e) {
        console.warn('Could not load local data:', e);
      }
      throw error;
    }
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
    
    // Load and process stall data
    if(rows && rows.length){
      items = rows.map(r=>({
        id: r.id || r.stall_id || toKey(r.name || r.stall_name),
        name: r.name || r.stall_name || 'Stall',
        img: r.image || r.banner || r.banner_image || 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop',
        area: normalizeArea(r.area || r.location || r.branch || ''),
        branch: (r.branch || r.area || r.location || '').toString()
      }));
    }
    
    // If no distinct Stalls sheet, derive from Menu sheet by unique stall_name
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
    
    // Fallback to local data if no data loaded yet
    if(items.length === 0){
      const local = await getLocalData();
      if(local && Array.isArray(local)){
        items = local.map(s => ({
          id: toKey(s.stall_name),
          name: s.stall_name,
          img: s.image || 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop',
          area: /jsec/i.test(s.branch||'') ? 'JSEC' : (/gonzaga/i.test(s.branch||'') ? 'Gonzaga' : (/iso/i.test(s.branch||'') ? 'ISO' : (s.branch||'Other')))
        }));
      }
    }
    
    // Final fallback to demo data
    if(items.length === 0){
      items = [
        { id:'gonzaga', name:'Gonzaga Cafeteria', img:'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop', area:'Gonzaga' },
        { id:'jsec', name:'JSEC', img:'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop', area:'JSEC' },
        { id:'iso', name:'TGS Fast Foods (ISO)', img:'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop', area:'ISO' }
      ];
    }

    // Define all the sections with their respective stall names
    const sections = [
      {
        title: 'Gonzaga 1st Floor',
        names: [
          'Chunky Chicks', 'Gamja', 'Obento', 'Day Off', 'Melt Station', 
          'Jamaican Pattie', 'Potato Corner', 'Juzi Juiz', 'Get Bowl\'d', 
          'GHE!', 'Good Taste'
        ]
      },
      {
        title: 'Gonzaga 2nd Floor',
        names: [
          'Swirlicious!', 'Kcroffles', 'Luckys Shawarma Rice and Wraps', 
          'Melteese', 'Chillers', 'Colonel\'s Curry', 'Varda', 
          'Yum Dum Dim', 'Ate Rica\'s Bacsilog'
        ]
      },
      {
        title: 'JSEC',
        names: [
          'Nom Noms', 'Kahlo', 'Tam Pai', 'Namit Gid Ya!', 'Suan Rak', 
          'Ondo', 'Yatako', 'The Breakfast Club', 'Eagle Eatery', 
          'Hikori', 'Baoba', 'Mongch', 'Aja! K-Fusion', 'Lami', 
          'The Middle Feast', 'Hoi An'
        ]
      },
      {
        title: 'ISO',
        names: ['TGS Fast Foods (ISO)']
      },
      {
        title: 'New Rizal Library',
        names: ['Hunger Buster', 'Silingan Coffee']
      }
    ];

    // Create a map of all stalls by name for quick lookup
    const allStallsMap = new Map();
    items.forEach(stall => {
      allStallsMap.set(stall.name, stall);
    });

    // Process each section, sort alphabetically, and create the final sections array
    const processedSections = sections.map(section => {
      // Get or create stall objects for each name in the section
      const stalls = section.names
        .map(name => {
          if (allStallsMap.has(name)) {
            return allStallsMap.get(name);
          }
          return {
            id: toKey(name),
            name: name,
            img: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop',
            area: section.title
          };
        })
        // Sort alphabetically by name
        .sort((a, b) => a.name.localeCompare(b.name));
      
      return {
        title: section.title,
        list: stalls
      };
    });

    // Filter out empty sections
    const nonEmptySections = processedSections.filter(section => section.list.length > 0);

    // Render the sections in a two-column layout
    let html = '<div class="stalls-container">';
    
    nonEmptySections.forEach(section => {
      if (section.list.length === 0) return;
      
      html += `
        <div class="stall-section">
          <h2>${section.title}</h2>
          <div class="stall-list">
      `;
      
      section.list.forEach(stall => {
        const url = `shop.html?stall=${encodeURIComponent(stall.id)}&name=${encodeURIComponent(stall.name)}`;
        html += `
          <div class="stall-item">
            <a href="${url}">
              <img src="${stall.img}" alt="${stall.name}" />
              <span>${stall.name}</span>
            </a>
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    
    // Update the DOM
    lists.innerHTML = html;
    if(status) status.textContent = `${items.length} stalls found`;
    
      // Update the map with the same data
    if (window.updateMapMarkers) {
      updateMapMarkers(items);
    }
  }

  // Function to update map markers
  function updateMapMarkers(stalls) {
    // This function will be called from the map implementation
    // to update markers when the stalls data is loaded
    console.log('Stalls data loaded, update map markers here if needed');
  }

  // Create a menu item card element
  function createMenuItemCard(item) {
    if (!item) return '';

    // Generate star rating display
    const rating = Math.min(5, Math.max(0, parseFloat(item.rating) || 0));
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '★'.repeat(fullStars);
    stars += hasHalfStar ? '½' : '';
    stars += '☆'.repeat(5 - Math.ceil(rating));

    // Format allergens
    const allergens = item.allergens ? 
      String(item.allergens).split(',').map(a => a.trim()).filter(a => a).join(', ') : 
      'None';

    // Create card HTML
    return `
      <div class="card-item" 
           data-id="${item.id}" 
           data-name="${item.name.toLowerCase()}" 
           data-price="${item.price}" 
           data-type="${(item.category || '').toLowerCase()}" 
           data-stall="${(item.stall || '').toLowerCase()}" 
           data-rating="${rating}" 
           data-prep="${item.prep}" 
           data-calories="${item.calories || 0}" 
           data-allergens="${allergens.toLowerCase()}" 
           data-halal="${item.halal ? 'true' : 'false'}" 
           data-pork-free="${item.porkFree ? 'true' : 'false'}" 
           data-vegan="${item.vegan ? 'true' : 'false'}" 
           data-vegetarian="${item.vegetarian ? 'true' : 'false'}">
        
        <div class="card-image">
          <img src="${item.image}" alt="${item.name}" loading="lazy" />
          <div class="card-badge">₱${item.price.toFixed(2)}</div>
          ${item.popular ? '<div class="popular-badge">Popular</div>' : ''}
        </div>
        
        <div class="card-content">
          <div class="card-header">
            <h3 class="card-title">${item.name}</h3>
            <div class="card-rating" title="Rating: ${rating}">
              <span class="stars">${stars}</span>
              <span class="rating">${rating.toFixed(1)}</span>
            </div>
          </div>
          
          <p class="card-desc">${item.description}</p>
          
          <div class="card-meta">
            <span class="meta-item"><i class="icon-time"></i> ${item.prep || 0} min</span>
            <span class="meta-item"><i class="icon-fire"></i> ${item.calories || 'N/A'} cal</span>
          </div>
          
          <div class="card-footer">
            <button class="btn-add">+ Add to cart</button>
            <button class="btn-favorite" data-id="${item.id}">♡</button>
          </div>
        </div>
      </div>
    `;
  }

  // Show toast notification
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  async function renderMenu() {
    const cardsWrap = document.querySelector('.cards.mt-28');
    const bannerTitle = document.querySelector('.banner .title');
    if (!cardsWrap || !bannerTitle) return;

    try {
      // Show loading state
      cardsWrap.innerHTML = '<div class="loading-message">Loading menu items...</div>';

      // Get stall filter from URL
      const stallId = getParam('stall');
      const stallName = getParam('name');
      if (stallName) bannerTitle.textContent = stallName;

      // Fetch menu items from Google Sheets
      const items = await getSheetObjects(SHEETS_CFG.menuSheet);
      
      if (!items || items.length === 0) {
        throw new Error('No menu items found in the Google Sheet');
      }

      // Process and normalize items
      const processedItems = items.map(item => ({
        id: item.id || toKey(item.name || item.item || ''),
        name: item.name || item.item || 'Menu Item',
        price: parseFloat(String(item.price || item.cost || '0').replace(/[^0-9.]/g, '')) || 0,
        description: item.description || item.desc || '',
        image: item.image || item.photo || `https://source.unsplash.com/featured/400x300?food,${encodeURIComponent(item.name || item.item || 'meal')}`,
        stall: item.stall || item.stall_id || item.vendor || item.seller || item.stall_name || '',
        category: item.category || item.item_category || '',
        rating: parseFloat(item.rating || 0),
        calories: parseInt(item.calories || 0, 10),
        prep: parseInt(String(item.prep_time || item.preparation_time || '0').replace(/\D/g, ''), 10) || 0,
        allergens: item.allergens || '',
        halal: (String(item.halal || '').toLowerCase() === 'true') || /halal/i.test(String(item.tags || '')),
        porkFree: (String(item.pork_free || item.porkfree || '').toLowerCase() === 'true') || /pork[- ]?free/i.test(String(item.tags || '')),
        vegan: (String(item.vegan || '').toLowerCase() === 'true') || /vegan/i.test(String(item.tags || '')),
        vegetarian: (String(item.vegetarian || '').toLowerCase() === 'true') || /vegetarian/i.test(String(item.tags || '')),
        popular: (String(item.popular || '').toLowerCase() === 'true')
      }));

      // Filter by stall if specified in URL
      let filteredItems = processedItems;
      if (stallId || stallName) {
        const targetId = (stallId || '').toLowerCase();
        const targetName = (stallName || '').toLowerCase();
        filteredItems = processedItems.filter(item => 
          (stallId && toKey(item.stall) === targetId) ||
          (stallName && item.stall.toLowerCase().includes(targetName))
        );
      }

      // Render cards
      if (filteredItems.length > 0) {
        cardsWrap.innerHTML = filteredItems.map(item => createMenuItemCard(item)).join('');
      } else {
        cardsWrap.innerHTML = '<div class="muted">No menu items found for this stall.</div>';
      }

      // Initialize filters and favorites
      if (typeof hydrateFavButtons === 'function') {
        hydrateFavButtons();
      }
      if (typeof hydrateFilters === 'function') {
        hydrateFilters();
      }
      if (typeof hydrateExports === 'function') {
        hydrateExports(null, null);
      }

    } catch (error) {
      console.error('Error loading menu:', error);
      cardsWrap.innerHTML = `
        <div class="error-message">
          <p>Failed to load menu items. Please try again later.</p>
          <p><small>Error: ${error.message}</small></p>
        </div>
      `;
    }
      // If no specific stall is selected (Filter Menu page), ensure Aja K-Fusion and Baoba items appear at top
      if(!stallId && !stallName){
        const ajaItems = [
          { id: toKey('Jjajangmyeon'), name:'Jjajangmyeon', price:120, description:'Savory black bean noodles with vegetables and egg', image:`https://source.unsplash.com/featured/400x300?food,${encodeURIComponent('Jjajangmyeon')}`, stall:'Aja K-Fusion', category:'Meal', allergens:'Egg, Wheat, Soy, Fish, Shellfish' },
          { id: toKey('Hotteok'), name:'Hotteok', price:85, description:'Sweet Korean pancake with brown sugar and nuts', image:`https://source.unsplash.com/featured/400x300?food,${encodeURIComponent('Hotteok')}`, stall:'Aja K-Fusion', category:'Dessert', allergens:'Wheat' }
        ];
        const baobaItems = [
          { id: toKey('Brown Sugar Milk Tea'), name:'Brown Sugar Milk Tea', price:150, description:'Milk tea with brown sugar pearls and creamy foam', image:`https://source.unsplash.com/featured/400x300?milk%20tea`, stall:'Baoba', category:'Drink', allergens:'Dairy' },
          { id: toKey('Lemon Yakult Tea'), name:'Lemon Yakult Tea', price:130, description:'Zesty lemon tea with creamy Yakult', image:`https://source.unsplash.com/featured/400x300?yakult%20tea`, stall:'Baoba', category:'Drink', allergens:'' }
        ];
        const protoItems = [
          { id: toKey('Chicken Rice Bowl'), name:'Chicken Rice Bowl', price:95, description:'Grilled chicken with steamed rice', image:`https://source.unsplash.com/featured/400x300?chicken%20rice`, stall:'Prototype', category:'Rice Meal', allergens:'', prep:10, halal:true, porkFree:true },
          { id: toKey('Spicy Ramen'), name:'Spicy Ramen', price:140, description:'Hot broth with noodles and chili oil', image:`https://source.unsplash.com/featured/400x300?ramen`, stall:'Prototype', category:'Noodles', allergens:'Wheat', prep:15, porkFree:true },
          { id: toKey('Fresh Lemonade'), name:'Fresh Lemonade', price:60, description:'Refreshing lemon drink', image:`https://source.unsplash.com/featured/400x300?lemonade`, stall:'Prototype', category:'Drink', allergens:'', prep:2, halal:true, porkFree:true },
          { id: toKey('Choco Sundae'), name:'Choco Sundae', price:80, description:'Soft-serve with chocolate syrup', image:`https://source.unsplash.com/featured/400x300?ice%20cream`, stall:'Prototype', category:'Dessert', allergens:'Dairy', prep:3, porkFree:true },
          { id: toKey('Veggie Stir-fry'), name:'Veggie Stir-fry', price:110, description:'Mixed vegetables with tofu', image:`https://source.unsplash.com/featured/400x300?vegetable%20stir%20fry`, stall:'Prototype', category:'Vegetarian', allergens:'Soy', prep:12, halal:true, porkFree:true }
        ];
        filtered = [...ajaItems, ...baobaItems, ...protoItems, ...filtered];
      }
      if(filtered.length){
        cardsWrap.innerHTML = filtered.map(it => `
          <div class="card-item" data-price="${it.price}" data-name="${it.name}" data-type="${it.category||''}" ${it.prep?`data-prep="${it.prep}"`:''} data-allergens="${(it.allergens||'').toString()}" data-halal="${it.halal? 'true':'false'}" data-pork-free="${it.porkFree? 'true':'false'}">
            <div class="name">${it.name}</div>
            <div class="desc">${it.description}</div>
            <div class="price">₱ ${it.price.toFixed(2)}${it.category?` · <span class='muted'>${it.category}</span>`:''} · <span class='muted'>${(it.allergens && String(it.allergens).trim()) ? it.allergens : 'Allergens: None'}</span>${it.halal?` · <span class='muted'>Halal</span>`:''}${it.porkFree?` · <span class='muted'>Pork-free</span>`:''}</div>
            <a class="action-btn action-primary" href="product.html?id=${encodeURIComponent(it.id)}">View</a>
            <button class="fav-btn" data-id="${it.id}">☆ Favorite</button>
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
              <div class="name">${it.item}</div>
              <div class="desc">${it.description||''}</div>
              <div class="price">${it.price}${it.allergens?` · <span class="muted">${(Array.isArray(it.allergens)?it.allergens.join(', '): it.allergens)}</span>`:''}${it.halal?` · <span class="muted">Halal</span>`:''}${it.porkFree?` · <span class="muted">Pork-free</span>`:''}</div>
              <a class="action-btn action-primary" href="product.html?id=${encodeURIComponent(it.id || toKey(it.item))}">View</a>
              <button class="fav-btn" data-id="${it.id || toKey(it.item)}">☆ Favorite</button>
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
        const data = localData || await getLocalData();
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
        const data = localData || await getLocalData();
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
    const budgetValue = $('#budgetValue');
    const prep = $('#prep');
    const prepValue = $('#prepValue');
    const allergenSelect = $('#allergenSelect');
    const halalOnly = $('#halalOnly');
    const porkFreeOnly = $('#porkFreeOnly');
    const veganOnly = $('#veganOnly');
    const vegetarianOnly = $('#vegetarianOnly');
    const cards = $all('#menuCards .card-item, .cards .card-item');
    const container = document.querySelector('.cards.mt-28');
    const locationChips = $('#locationChips');
    const stallFilter = $('#stallFilter');
    const minRatingFilter = $('#minRating');
    const maxRatingFilter = $('#maxRating');
    let demoEl = null;
    let activeLocation = 'all';
    let activeStall = 'all';
    let activeMinRating = 0;
    let activeMaxRating = 5;
    if (budget && budgetValue && budgetMin && budgetMax) {
      // Initial setup
      budgetMin.value = '0';
      budgetMax.value = '500';
      budget.min = '0';
      budget.max = '500';
      budget.value = '500';
      
      // Function to update the budget display and ensure min/max constraints
      const updateBudgetDisplay = () => {
        const min = parseInt(budgetMin.value) || 0;
        const max = parseInt(budgetMax.value) || 500;
        const current = parseInt(budget.value) || 0;
        
        // Update slider's min/max attributes
        budget.min = min;
        budget.max = max;
        
        // Ensure current value is within the new range
        if (current < min) budget.value = min;
        if (current > max) budget.value = max;
        
        budgetValue.textContent = budget.value;
        
        // Update the min/max display
        const rangeDisplay = budget.parentNode.querySelector('.budget-range-display') || 
                            (() => {
                              const el = document.createElement('div');
                              el.className = 'budget-range-display';
                              budget.parentNode.insertBefore(el, budget.nextSibling);
                              return el;
                            })();
        rangeDisplay.textContent = `₱${min} - ₱${max}`;
      };
      
      // Update and filter function
      const updateAndFilter = () => {
        updateBudgetDisplay();
        applyFilters();
      };
      
      // Update on slider change
      budget.addEventListener('input', updateAndFilter);
      
      // Update on min/max input changes
      budgetMin.addEventListener('input', updateAndFilter);
      budgetMax.addEventListener('input', updateAndFilter);
      
      // Initial update
      updateBudgetDisplay();
    }
    if(prep && prepValue){
      const updatePrepLabel = () => prepValue.textContent = prep.value;
      prep.addEventListener('input', () => { updatePrepLabel(); applyFilters(); });
      updatePrepLabel();
    }
    // Get selected allergens from checkboxes
    function getSelectedAllergens() {
      const checkboxes = document.querySelectorAll('#allergenOptions input[type="checkbox"]:checked');
      return Array.from(checkboxes).map(checkbox => checkbox.value);
    }
    // Add event listeners for all filter controls
    if(halalOnly) halalOnly.addEventListener('change', applyFilters);
    if(porkFreeOnly) porkFreeOnly.addEventListener('change', applyFilters);
    if(veganOnly) veganOnly.addEventListener('change', applyFilters);
    if(vegetarianOnly) vegetarianOnly.addEventListener('change', applyFilters);
    
    // Add event listeners for stall and rating filters
    if(stallFilter) stallFilter.addEventListener('change', applyFilters);
    if(minRatingFilter) minRatingFilter.addEventListener('change', applyFilters);
    if(maxRatingFilter) maxRatingFilter.addEventListener('change', applyFilters);
    
    // Type chips handler
    const typeChips = $('#typeChips');
    let activeType = 'all';
    typeChips?.addEventListener('click', (e)=>{
      const btn = e.target.closest('.chip');
      if(!btn) return;
      activeType = btn.getAttribute('data-type') || 'all';
      typeChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c===btn));
      applyFilters();
    });
    
    // Location chips handler
    locationChips?.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      activeLocation = btn.getAttribute('data-location') || 'all';
      locationChips.querySelectorAll('.chip').forEach(c => 
        c.classList.toggle('active', c === btn)
      );
      applyFilters();
    });
    function applyFilters(){
      const q = (search?.value || '').toLowerCase();
      // Get the current min and max values from the inputs
      const minBudget = budgetMin ? Math.min(Number(budgetMin.value) || 0, Number(budgetMax.value) || 500) : 0;
      const maxBudget = budgetMax ? Math.max(Number(budgetMin.value) || 0, Number(budgetMax.value) || 500) : 500;
      const currentBudget = budget ? Number(budget.value) || 0 : 0;
      const maxPrep = prep ? Number(prep.value) : Infinity;
      const minRating = minRatingFilter ? parseFloat(minRatingFilter.value) || 0 : 0;
      const maxRating = maxRatingFilter ? parseFloat(maxRatingFilter.value) || 5 : 5;
      const selectedStall = stallFilter ? stallFilter.value : 'all';
      
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
        const isVegan = (card.getAttribute('data-vegan')||'false') === 'true';
        const isVegetarian = (card.getAttribute('data-vegetarian')||'false') === 'true' || type.includes('vegetarian');
        const location = card.getAttribute('data-location') || '';
        const stall = card.getAttribute('data-stall') || '';
        const rating = parseFloat(card.getAttribute('data-rating') || '0');
        
        // Filter conditions
        const nameMatch = name.includes(q);
        const typeOk = (activeType === 'all') || (type === (activeType || '').toLowerCase());
        const prepOk = (prepMins === null) || (prepMins <= maxPrep);
        const locationOk = (activeLocation === 'all') || (location === activeLocation);
        const stallOk = (selectedStall === 'all') || (stall === selectedStall);
        const ratingOk = (rating >= minRating) && (rating <= maxRating);
        
        // Handle allergen filtering
        let allergenOk = true;
        const selectedAllergens = getSelectedAllergens();
        if (selectedAllergens.length > 0) {
          allergenOk = !selectedAllergens.some(allergen => allergensText.includes(allergen));
        }
        
        // Handle dietary restrictions
        const halalOk = halalOnly ? (!halalOnly.checked || isHalal) : true;
        const porkOk = porkFreeOnly ? (!porkFreeOnly.checked || isPorkFree) : true;
        const veganOk = veganOnly ? (!veganOnly.checked || isVegan) : true;
        const vegetarianOk = vegetarianOnly ? (!vegetarianOnly.checked || isVegetarian) : true;
        
        // Price range check - show items within the min/max range that are also <= current budget
        const priceInRange = (price >= minBudget) && (price <= maxBudget) && 
                           (price <= currentBudget || currentBudget === 0);
        
        // Combine all conditions
        const ok = nameMatch && priceInRange && typeOk && prepOk && locationOk && 
                  stallOk && ratingOk && allergenOk && halalOk && porkOk && veganOk && vegetarianOk;
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
          const demoLocation = activeLocation!=='all' ? activeLocation : 'gonz1f';
          const wantsHalal = !!(halalOnly && halalOnly.checked);
          const wantsPorkFree = !!(porkFreeOnly && porkFreeOnly.checked);
          const wantsVegan = !!(veganOnly && veganOnly.checked);
          demoEl.setAttribute('data-name', demoName);
          demoEl.setAttribute('data-price', String(demoPrice));
          demoEl.setAttribute('data-type', demoType);
          demoEl.setAttribute('data-location', demoLocation);
          demoEl.setAttribute('data-prep', String(demoPrep));
          demoEl.setAttribute('data-allergens', '');
          demoEl.setAttribute('data-halal', wantsHalal ? 'true' : 'false');
          demoEl.setAttribute('data-pork-free', wantsPorkFree ? 'true' : 'false');
          demoEl.setAttribute('data-vegan', wantsVegan ? 'true' : 'false');
          demoEl.innerHTML = `
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
    if(search || budget || prep || allergenSelect || halalOnly || porkFreeOnly){ applyFilters(); }
  }

  function getSession(){
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  }
  function setSession(user){ localStorage.setItem(SESSION_KEY, JSON.stringify(user)); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }

  function hydrateNav(){
    const user = getSession();
    if(user){
      const hasProfile = document.querySelector('nav a[href="profile.html"]');
      document.querySelectorAll('a[href="login.html"]').forEach(a => {
        if(hasProfile){
          // Convert this Login link to a Logout button
          a.textContent = 'Log out';
          a.setAttribute('href','#');
          a.classList.add('btn');
          a.addEventListener('click', (e)=>{ e.preventDefault(); clearSession(); location.href = 'login.html'; });
        } else {
          // No profile link present; use this spot for Profile
          a.textContent = 'Profile';
          a.setAttribute('href','profile.html');
          a.classList.add('btn');
        }
      });
    }
  }

  function hydrateLogin(){
    const form = $('#loginForm');
    if(!form) return;
    // If already logged in and there's a next, redirect immediately
    const nextParam = getParam('next');
    if(getSession() && nextParam){ location.href = nextParam; return; }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#name').value.trim();
      const email = $('#email').value.trim();
      if(!name || !email){ alert('Please enter name and school email.'); return; }
      setSession({ name, email });
      // Execute pending action if any (e.g., favorite)
      try{
        const pending = JSON.parse(localStorage.getItem('bb_pending_action')||'null');
        if(pending && pending.type==='fav' && pending.id){ toggleFavorite(pending.id); }
        localStorage.removeItem('bb_pending_action');
        if(nextParam){ location.href = nextParam; return; }
      }catch{}
      location.href = 'profile.html';
    });
  }

  function hydrateProfile(){
    const nameEl = $('#profileName');
    if(!nameEl) return;
    const user = getSession();
    if(!user){ location.href = 'login.html'; return; }
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

  // Initialize Allergen Filter
  function initializeAllergenFilter() {
    const filterToggle = document.querySelector('.filter-toggle[aria-controls="allergenOptions"]');
    const filterOptions = document.getElementById('allergenOptions');
    const checkboxes = filterOptions.querySelectorAll('input[type="checkbox"]');
    const selectedCount = filterToggle.querySelector('.filter-badge');
    
    // Toggle dropdown
    filterToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = filterToggle.getAttribute('aria-expanded') === 'true';
      filterToggle.setAttribute('aria-expanded', !isExpanded);
      filterOptions.setAttribute('aria-hidden', isExpanded);
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!filterOptions.contains(e.target) && e.target !== filterToggle) {
        filterToggle.setAttribute('aria-expanded', 'false');
        filterOptions.setAttribute('aria-hidden', 'true');
      }
    });

    // Update count and apply filters when checkboxes change
    function updateSelectedCount() {
      const selected = Array.from(checkboxes).filter(checkbox => checkbox.checked).length;
      selectedCount.textContent = selected;
      selectedCount.style.display = selected > 0 ? 'inline-flex' : 'none';
      applyFilters();
    }

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', updateSelectedCount);
    });

    // Initialize
    updateSelectedCount();
  }

  function renderMenu() {
    const cardsWrap = document.querySelector('.cards.mt-28');
    if (!cardsWrap) return;

    // Show loading state
    cardsWrap.innerHTML = '<div class="loading-message">Loading menu items...</div>';

    // Get stall filter from URL if any
    const stallId = getParam('stall');
    const stallName = getParam('name');
    
    // Update page title if we're viewing a specific stall
    const bannerTitle = document.querySelector('.banner .title');
    if (bannerTitle && stallName) {
      bannerTitle.textContent = stallName;
    }

    // Fetch menu items from Google Sheets
    getSheetObjects(SHEETS_CFG.menuSheet)
      .then(items => {
        if (!items || items.length === 0) {
          throw new Error('No menu items found in the Google Sheet');
        }

        // Process and normalize items
        const processedItems = items.map(item => ({
          id: item.id || toKey(item.name || item.item || ''),
          name: item.name || item.item || 'Menu Item',
          price: parseFloat(String(item.price || item.cost || '0').replace(/[^0-9.]/g, '')) || 0,
          description: item.description || item.desc || '',
          image: item.image || item.photo || `https://source.unsplash.com/featured/400x300?food,${encodeURIComponent(item.name || item.item || 'meal')}`,
          stall: item.stall || item.stall_id || item.vendor || item.seller || item.stall_name || '',
          category: item.category || item.item_category || '',
          rating: parseFloat(item.rating || 0),
          calories: parseInt(item.calories || 0, 10),
          prep: parseInt(String(item.prep_time || item.preparation_time || '0').replace(/\D/g, ''), 10) || 0,
          allergens: item.allergens || '',
          halal: (String(item.halal || '').toLowerCase() === 'true') || /halal/i.test(String(item.tags || '')),
          porkFree: (String(item.pork_free || item.porkfree || '').toLowerCase() === 'true') || /pork[- ]?free/i.test(String(item.tags || '')),
          vegan: (String(item.vegan || '').toLowerCase() === 'true') || /vegan/i.test(String(item.tags || '')),
          vegetarian: (String(item.vegetarian || '').toLowerCase() === 'true') || /vegetarian/i.test(String(item.tags || '')),
          popular: (String(item.popular || '').toLowerCase() === 'true')
        }));

        // Filter by stall if specified in URL
        let filteredItems = processedItems;
        if (stallId || stallName) {
          const targetId = (stallId || '').toLowerCase();
          const targetName = (stallName || '').toLowerCase();
          filteredItems = processedItems.filter(item => 
            (stallId && toKey(item.stall) === targetId) ||
            (stallName && item.stall.toLowerCase().includes(targetName))
          );
        }

        // Render cards
        if (filteredItems.length > 0) {
          cardsWrap.innerHTML = filteredItems.map(item => createMenuItemCard(item)).join('');
          
          // Re-initialize event listeners
          if (typeof hydrateFavButtons === 'function') {
            hydrateFavButtons();
          }
          if (typeof hydrateFilters === 'function') {
            hydrateFilters();
          }
        } else {
          cardsWrap.innerHTML = '<div class="error-message">No menu items found for this stall.</div>';
        }
      })
      .catch(error => {
        console.error('Error loading menu:', error);
        cardsWrap.innerHTML = `
          <div class="error-message">
            <p>Failed to load menu items. Please try again later.</p>
            <p><small>Error: ${error.message}</small></p>
          </div>
        `;
      });
  }

  // Make renderMenu available globally for manual triggering if needed
  window.renderMenu = renderMenu;

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    // Initialize logo hydration
    (function hydrateLogo() {
      document.querySelectorAll('img.logo-img').forEach(img => {
        const desired = './assets/logo.png?v=' + Date.now();
        img.onerror = function() { 
          this.onerror = null; 
          this.src = './assets/eagle.svg'; 
        };
        if (!img.src.includes('assets/logo.png')) { 
          img.src = desired; 
        }
      });
    })();

    // Initialize components
    if (typeof initializeAllergenFilter === 'function') initializeAllergenFilter();
    if (typeof hydrateFavButtons === 'function') hydrateFavButtons();
    if (typeof hydrateFilters === 'function') hydrateFilters();
    if (typeof hydrateNav === 'function') hydrateNav();
    if (typeof hydrateLogin === 'function') hydrateLogin();
    if (typeof hydrateProfile === 'function') hydrateProfile();
    if (typeof renderStalls === 'function') renderStalls();
    if (typeof hydrateBudgetPage === 'function') hydrateBudgetPage();
    if (typeof renderMap === 'function') renderMap();
    
    // Load menu if on shop page
    if (document.querySelector('.cards.mt-28')) {
      renderMenu();
    }
  });
})();
