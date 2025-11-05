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
  async function fetchCsv({sheet}){
    const url = `https://docs.google.com/spreadsheets/d/${SHEETS_CFG.id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
    const res = await fetch(url, { credentials: 'omit' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
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

    // Gonzaga exact order
    const gonzagaOrder = ['Potato Corner','Good Taste','Chunky Chicks','Juz Juiz','Obento Express','Mr. Softy',"Iggy's Canteen",'Marvin’s Taho'];
    const gonzagaPool = new Map((byArea.get('Gonzaga')||[]).map(s=>[s.name,s]));
    const gonzagaList = gonzagaOrder.map(n => gonzagaPool.get(n)).filter(Boolean);
    byArea.set('Gonzaga', gonzagaList);

    // JSEC exact order (override)
    const jsecOrder = ['Lucky Kat','Lami','Aja K-Fusion','Kahlo','Baoba','The breakfast Club','Hikori'];
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

    // Gonzaga 1st Floor
    const g1Names = ['GHE!','Day-off','Marvins Taho Food Product','Good Taste','Obento Express','Juzi Juiz','Chunky Chicks'];
    sections.push({ title:'Gonzaga 1st Floor', list: pickByNames(g1Names, 'Gonzaga 1st Floor') });

    // Gonzaga 2nd Floor
    const g2Names = ['Colonel Curry','Chillers',"Ate Rica's Bacsilog",'Varda Burgers'];
    sections.push({ title:'Gonzaga 2nd Floor', list: pickByNames(g2Names, 'Gonzaga 2nd Floor') });

    // JSEC (from override)
    sections.push({ title:'JSEC', list: byArea.get('JSEC') || [] });
    // ISO
    if(byArea.get('ISO')?.length) sections.push({ title:'ISO', list: byArea.get('ISO') });
    // New Rizal Library
    if(byArea.get('New Rizal Library')?.length) sections.push({ title:'New Rizal Library', list: byArea.get('New Rizal Library') });

    const html = sections.map(sec => {
      const lis = sec.list.map(it => `<li><a href="shop.html?stall=${encodeURIComponent(it.id)}&name=${encodeURIComponent(it.name)}">${it.name}</a></li>`).join('');
      return `<div class="mt-28"><h3 class="mb-20">${sec.title}</h3><ul>${lis}</ul></div>`;
    }).join('');

    lists.innerHTML = html;
    if(status) status.remove();
  }

  async function renderMenu(){
    const cardsWrap = document.querySelector('.cards.mt-28');
    const bannerTitle = document.querySelector('.banner .title');
    if(!cardsWrap || !bannerTitle) return;
    // Prefer Google Sheets; fallback to local JSON; finally placeholders/static
    let stallId = getParam('stall');
    let stallName = getParam('name');
    if(stallName) bannerTitle.textContent = stallName;
    let items = await getSheetObjects(SHEETS_CFG.menuSheet);
    if(items){
      const normalized = items.map(r=>({
        id: r.id || toKey(r.name || r.item),
        name: r.name || r.item || 'Menu Item',
        price: Number(String(r.price||r.cost||'').toString().replace(/[^0-9.]/g,'')) || 0,
        description: r.description || r.desc || '',
        image: r.image || r.photo || `https://source.unsplash.com/featured/400x300?food,${encodeURIComponent(r.name||r.item||'meal')}`,
        stall: r.stall || r.stall_id || r.vendor || r.seller || r.stall_name || '',
        category: r.category || r.item_category || '',
        allergens: r.allergens || '',
        halal: (String(r.halal||'').toLowerCase()==='true') || /halal/i.test(String(r.tags||'')),
        porkFree: (String(r.pork_free||r.porkfree||'').toLowerCase()==='true') || /pork[- ]?free/i.test(String(r.tags||'')),
        prep: Number(String(r.prep_time||r.preparation_time||'').toString().replace(/[^0-9.]/g,'')) || null,
        calories: Number(r.calories||0) || null,
        servingSize: r.serving_size || r.servingSize || null
      }));
      let filtered = stallId ? normalized.filter(it => String(it.stall).toLowerCase() === String(stallId).toLowerCase()) : normalized.slice();
      // Fallback: if no match by stall id, try matching by stall name param
      if(filtered.length === 0 && stallName){
        const target = (stallName||'').toString();
        const targetKey = toKey(target);
        filtered = normalized.filter(it => toKey(it.stall) === targetKey);
      }
      // If no specific stall is selected (Filter Menu page), ensure Aja K-Fusion and Baoba items appear at top
      if(!stallId && !stallName){
        const ajaItems = [
          { id: toKey('Jjajangmyeon'), name:'Jjajangmyeon', price:120, description:'Savory black bean noodles with vegetables and egg', image:`https://source.unsplash.com/featured/400x300?food,${encodeURIComponent('Jjajangmyeon')}`, stall:'Aja K-Fusion', category:'Meal', allergens:'Egg, Wheat, Soy, Fish, Shellfish', calories:450, servingSize:'350g' },
          { id: toKey('Hotteok'), name:'Hotteok', price:85, description:'Sweet Korean pancake with brown sugar and nuts', image:`https://source.unsplash.com/featured/400x300?food,${encodeURIComponent('Hotteok')}`, stall:'Aja K-Fusion', category:'Dessert', allergens:'Wheat', calories:280, servingSize:'120g' }
        ];
        const baobaItems = [
          { id: toKey('Brown Sugar Milk Tea'), name:'Brown Sugar Milk Tea', price:150, description:'Milk tea with brown sugar pearls and creamy foam', image:`https://source.unsplash.com/featured/400x300?milk%20tea`, stall:'Baoba', category:'Drink', allergens:'Dairy', calories:320, servingSize:'500ml' },
          { id: toKey('Lemon Yakult Tea'), name:'Lemon Yakult Tea', price:130, description:'Zesty lemon tea with creamy Yakult', image:`https://source.unsplash.com/featured/400x300?yakult%20tea`, stall:'Baoba', category:'Drink', allergens:'', calories:180, servingSize:'500ml' }
        ];
        const protoItems = [
          { id: toKey('Chicken Rice Bowl'), name:'Chicken Rice Bowl', price:95, description:'Grilled chicken with steamed rice', image:`https://source.unsplash.com/featured/400x300?chicken%20rice`, stall:'Prototype', category:'Rice Meal', allergens:'', prep:10, halal:true, porkFree:true, calories:520, servingSize:'400g' },
          { id: toKey('Spicy Ramen'), name:'Spicy Ramen', price:140, description:'Hot broth with noodles and chili oil', image:`https://source.unsplash.com/featured/400x300?ramen`, stall:'Prototype', category:'Noodles', allergens:'Wheat', prep:15, porkFree:true, calories:380, servingSize:'350ml' },
          { id: toKey('Fresh Lemonade'), name:'Fresh Lemonade', price:60, description:'Refreshing lemon drink', image:`https://source.unsplash.com/featured/400x300?lemonade`, stall:'Prototype', category:'Drink', allergens:'', prep:2, halal:true, porkFree:true, calories:120, servingSize:'300ml' },
          { id: toKey('Choco Sundae'), name:'Choco Sundae', price:80, description:'Soft-serve with chocolate syrup', image:`https://source.unsplash.com/featured/400x300?ice%20cream`, stall:'Prototype', category:'Dessert', allergens:'Dairy', prep:3, porkFree:true, calories:250, servingSize:'150g' },
          { id: toKey('Veggie Stir-fry'), name:'Veggie Stir-fry', price:110, description:'Mixed vegetables with tofu', image:`https://source.unsplash.com/featured/400x300?vegetable%20stir%20fry`, stall:'Prototype', category:'Vegetarian', allergens:'Soy', prep:12, halal:true, porkFree:true, calories:220, servingSize:'300g' }
        ];
        filtered = [...ajaItems, ...baobaItems, ...protoItems, ...filtered];
      }
      if(filtered.length){
        cardsWrap.innerHTML = filtered.map(it => `
          <div class="card-item" data-price="${it.price}" data-name="${it.name}" data-type="${it.category||''}" ${it.prep?`data-prep="${it.prep}"`:''} data-allergens="${(it.allergens||'').toString()}" data-halal="${it.halal? 'true':'false'}" data-pork-free="${it.porkFree? 'true':'false'}">
            <img src="${it.image}" alt="${it.name}" />
            <div class="name">${it.name}</div>
            <div class="desc">${it.description}</div>
            <div class="price">₱ ${it.price.toFixed(2)}${it.category?` · <span class='muted'>${it.category}</span>`:''}${it.calories?` · <span class='muted'>${it.calories} cal</span>`:''}${it.servingSize?` · <span class='muted'>${it.servingSize}</span>`:''}</div>
            <div class="muted" style="font-size: 0.85em; margin-top: 4px;">${(it.allergens && String(it.allergens).trim()) ? `Allergens: ${it.allergens}` : 'No allergens'}${it.halal?` · Halal`:''}${it.porkFree?` · Pork-free`:''}</div>
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
    const budgetInput = $('#budgetInput');
    const budgetValue = $('#budgetValue');
    const prep = $('#prep');
    const prepValue = $('#prepValue');
    const allergenSelect = $('#allergenSelect');
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
    if(allergenSelect){ allergenSelect.addEventListener('change', applyFilters); }
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
        const allergen = (allergenSelect && allergenSelect.value && allergenSelect.value!=='any') ? allergenSelect.value.toLowerCase() : null;
        const allergenOk = allergen ? !allergensText.includes(allergen) : true;
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
      const local = await getLocalData();
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
      const local = await getLocalData();
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
