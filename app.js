/* Spendlite - Personal Finance Tracker (vanilla JS)
   Data is stored locally in localStorage under key SPENDLITE_TRANSACTIONS
*/

(() => {
  const STORAGE_KEY = 'SPENDLITE_TRANSACTIONS_V1';

  /** @typedef {{id:string,type:'income'|'expense',category:string,amount:number,date:string,note?:string}} Transaction */

  const state = {
    transactions: /** @type {Transaction[]} */ ([]),
    filters: { type: 'all', category: '', start: '', end: '', search: '' },
    charts: { trend: null, category: null }
  };

  // Utils
  const formatCurrency = (num) => new Intl.NumberFormat(undefined, { style: 'currency', currency: guessCurrency() }).format(num || 0);
  const guessCurrency = () => {
    try { return new Intl.NumberFormat().resolvedOptions().currency || 'USD'; } catch { return 'USD'; }
  };
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  // Storage
  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [];
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
  }

  // DOM
  const el = {
    incomeTotal: document.getElementById('incomeTotal'),
    expenseTotal: document.getElementById('expenseTotal'),
    balanceTotal: document.getElementById('balanceTotal'),
    form: document.getElementById('transactionForm'),
    type: document.getElementById('type'),
    category: document.getElementById('category'),
    amount: document.getElementById('amount'),
    date: document.getElementById('date'),
    note: document.getElementById('note'),
    tbody: document.getElementById('transactionTbody'),
    categoryList: document.getElementById('categoryList'),
    filterType: document.getElementById('filterType'),
    filterCategory: document.getElementById('filterCategory'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    searchText: document.getElementById('searchText'),
    applyFilters: document.getElementById('applyFilters'),
    clearFilters: document.getElementById('clearFilters'),
    trendCanvas: document.getElementById('trendChart'),
    categoryCanvas: document.getElementById('categoryChart'),
    addQuickIncome: document.getElementById('addQuickIncome'),
    addQuickExpense: document.getElementById('addQuickExpense'),
    exportCsv: document.getElementById('exportCsv'),
    importCsv: document.getElementById('importCsv'),
    loadSample: document.getElementById('loadSample'),
    editDialog: document.getElementById('editDialog'),
    editForm: document.getElementById('editForm'),
    editId: document.getElementById('editId'),
    editType: document.getElementById('editType'),
    editCategory: document.getElementById('editCategory'),
    editAmount: document.getElementById('editAmount'),
    editDate: document.getElementById('editDate'),
    editNote: document.getElementById('editNote')
  };

  // Initialize
  function init() {
    state.transactions = load();
    el.date.value = todayIso();
    bindEvents();
    renderAll();
  }

  function bindEvents() {
    el.form.addEventListener('submit', onAdd);
    el.applyFilters.addEventListener('click', () => { collectFilters(); renderAll(); });
    el.clearFilters.addEventListener('click', () => { resetFilters(); renderAll(); });
    el.addQuickExpense.addEventListener('click', () => quickAdd('expense'));
    el.addQuickIncome.addEventListener('click', () => quickAdd('income'));
    el.exportCsv.addEventListener('click', exportCsv);
    el.importCsv.addEventListener('change', importCsv);
    el.loadSample.addEventListener('click', loadSampleData);

    el.editForm.addEventListener('submit', onSaveEdit);

    // Enhance: 3D tilt and parallax
    initTilt();
    initParallax();
  }

  function quickAdd(type) {
    el.type.value = type;
    el.category.focus();
  }

  /** @param {SubmitEvent} e */
  function onAdd(e) {
    e.preventDefault();
    const t = el.type.value;
    const c = el.category.value.trim();
    const amt = Number(el.amount.value);
    const d = el.date.value || todayIso();
    const n = el.note.value.trim();
    if (!c || !(amt > 0)) return;
    state.transactions.push({ id: uid(), type: t, category: c, amount: round2(amt), date: d, note: n });
    save();
    el.form.reset();
    el.date.value = d;
    renderAll();
  }

  function round2(n){return Math.round(n*100)/100}

  function collectFilters(){
    state.filters.type = el.filterType.value;
    state.filters.category = el.filterCategory.value.trim();
    state.filters.start = el.startDate.value;
    state.filters.end = el.endDate.value;
    state.filters.search = el.searchText.value.trim().toLowerCase();
  }
  function resetFilters(){
    el.filterType.value='all'; el.filterCategory.value=''; el.startDate.value=''; el.endDate.value=''; el.searchText.value='';
    collectFilters();
  }

  function getFiltered(){
    const f = state.filters;
    return state.transactions.filter(tx => {
      if (f.type !== 'all' && tx.type !== f.type) return false;
      if (f.category && tx.category.toLowerCase() !== f.category.toLowerCase()) return false;
      if (f.start && tx.date < f.start) return false;
      if (f.end && tx.date > f.end) return false;
      if (f.search && !(`${tx.category} ${tx.note||''}`.toLowerCase().includes(f.search))) return false;
      return true;
    });
  }

  function renderAll(){
    renderSummary();
    renderTable();
    renderCategoryList();
    renderCharts();
    // re-bind tilt to new nodes
    initTilt();
  }

  function renderSummary(){
    const arr = getFiltered();
    const income = arr.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const expense = arr.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    el.incomeTotal.textContent = formatCurrency(income);
    el.expenseTotal.textContent = formatCurrency(expense);
    el.balanceTotal.textContent = formatCurrency(income - expense);
  }

  function renderTable(){
    const arr = getFiltered().sort((a,b)=> a.date<b.date?1:a.date>b.date?-1:0);
    el.tbody.innerHTML = '';
    for (const tx of arr){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${tx.date}</td>
        <td>${tx.type === 'income' ? 'Income' : 'Expense'}</td>
        <td>${escapeHtml(tx.category)}</td>
        <td class="right">${formatCurrency(tx.amount)}</td>
        <td>${escapeHtml(tx.note||'')}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost" data-action="edit" data-id="${tx.id}">Edit</button>
            <button class="btn btn-danger" data-action="delete" data-id="${tx.id}">Delete</button>
          </div>
        </td>`;
      el.tbody.appendChild(tr);
    }
    el.tbody.querySelectorAll('button[data-action]').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        if (action==='delete') onDelete(id);
        if (action==='edit') openEdit(id);
      });
    });
  }

  function renderCategoryList(){
    const cats = Array.from(new Set(state.transactions.map(t=>t.category))).sort((a,b)=>a.localeCompare(b));
    el.categoryList.innerHTML = cats.map(c=>`<option value="${escapeHtml(c)}"></option>`).join('');
  }

  function onDelete(id){
    if (!confirm('Delete this transaction?')) return;
    const idx = state.transactions.findIndex(t=>t.id===id);
    if (idx>=0){ state.transactions.splice(idx,1); save(); renderAll(); }
  }

  function openEdit(id){
    const tx = state.transactions.find(t=>t.id===id); if (!tx) return;
    el.editId.value = id;
    el.editType.value = tx.type;
    el.editCategory.value = tx.category;
    el.editAmount.value = String(tx.amount);
    el.editDate.value = tx.date;
    el.editNote.value = tx.note||'';
    el.editDialog.showModal();
  }

  /** @param {SubmitEvent} e */
  function onSaveEdit(e){
    e.preventDefault();
    const id = el.editId.value;
    const tx = state.transactions.find(t=>t.id===id); if (!tx) return;
    tx.type = /** @type any */(el.editType.value);
    tx.category = el.editCategory.value.trim();
    tx.amount = round2(Number(el.editAmount.value));
    tx.date = el.editDate.value;
    tx.note = el.editNote.value.trim();
    save();
    el.editDialog.close();
    renderAll();
  }

  // Charts
  function renderCharts(){
    const arr = getFiltered();
    renderTrendChart(arr);
    renderCategoryChart(arr);
  }
  function ensureChart(ctx, cfg, key){
    if (state.charts[key]){ state.charts[key].destroy(); }
    state.charts[key] = new Chart(ctx, cfg);
  }
  function renderTrendChart(arr){
    const map = new Map();
    for (const tx of arr){
      const ym = tx.date.slice(0,7);
      const prev = map.get(ym)||{income:0,expense:0};
      prev[tx.type]+=tx.amount; map.set(ym, prev);
    }
    const labels = Array.from(map.keys()).sort();
    const income = labels.map(l=>map.get(l).income);
    const expense = labels.map(l=>map.get(l).expense);
    ensureChart(el.trendCanvas, {
      type:'line',
      data:{ labels, datasets:[
        {label:'Income', data:income, borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,.2)', tension:.3},
        {label:'Expense', data:expense, borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,.2)', tension:.3}
      ]},
      options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#cbd5e1'}}}, scales:{x:{ticks:{color:'#94a3b8'}}, y:{ticks:{color:'#94a3b8'}}}}
    }, 'trend');
  }
  function renderCategoryChart(arr){
    const map = new Map();
    for (const tx of arr.filter(t=>t.type==='expense')){
      map.set(tx.category, (map.get(tx.category)||0)+tx.amount);
    }
    const labels = Array.from(map.keys()).sort((a,b)=>map.get(b)-map.get(a));
    const data = labels.map(l=>map.get(l));
    const colors = labels.map((_,i)=>`hsl(${(i*47)%360} 80% 50%)`);
    ensureChart(el.categoryCanvas, { type:'doughnut', data:{ labels, datasets:[{ data, backgroundColor:colors }] }, options:{ plugins:{legend:{labels:{color:'#cbd5e1'}}}} }, 'category');
  }

  // CSV Export/Import
  function exportCsv(){
    const rows = [['id','type','category','amount','date','note'], ...state.transactions.map(t=>[t.id,t.type,t.category,String(t.amount),t.date,t.note||''])];
    const csv = rows.map(r=>r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='spendlite.csv'; a.click(); URL.revokeObjectURL(url);
  }
  function csvEscape(v){
    if (v==null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return '"'+s.replace(/"/g,'""')+'"';
    return s;
  }
  function importCsv(ev){
    const file = ev.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const text = String(reader.result||'');
        const rows = parseCsv(text);
        const [header, ...data] = rows;
        const idx = Object.fromEntries(header.map((h,i)=>[h,i]));
        const required = ['id','type','category','amount','date'];
        if (!required.every(k=>k in idx)) throw new Error('Missing columns');
        const imported = data.map(r=>({
          id: r[idx.id]||uid(),
          type: r[idx.type]==='income'?'income':'expense',
          category: r[idx.category]||'Other',
          amount: round2(Number(r[idx.amount]||0)),
          date: (r[idx.date]||todayIso()).slice(0,10),
          note: r[idx.note]||''
        }));
        // Merge by id (replace if same id)
        const mapExisting = new Map(state.transactions.map(t=>[t.id,t]));
        for (const t of imported){ mapExisting.set(t.id, t); }
        state.transactions = Array.from(mapExisting.values());
        save(); renderAll();
      }catch(err){ alert('Failed to import CSV'); }
      ev.target.value='';
    };
    reader.readAsText(file);
  }
  function parseCsv(text){
    const rows=[]; let cur=''; let row=[]; let q=false;
    for (let i=0;i<text.length;i++){
      const ch=text[i];
      if (q){
        if (ch==='"' && text[i+1]==='"'){ cur+='"'; i++; }
        else if (ch==='"'){ q=false; }
        else { cur+=ch; }
      } else {
        if (ch==='"'){ q=true; }
        else if (ch===','){ row.push(cur); cur=''; }
        else if (ch==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
        else if (ch==='\r'){ /* ignore */ }
        else { cur+=ch; }
      }
    }
    if (cur.length>0 || row.length>0){ row.push(cur); rows.push(row); }
    return rows;
  }

  // Sample data
  function loadSampleData(){
    const base = todayIso().slice(0,7);
    const sample = [
      {id:uid(), type:'income', category:'Salary', amount:3500, date:`${base}-01`, note:'Monthly salary'},
      {id:uid(), type:'expense', category:'Rent', amount:1200, date:`${base}-02`, note:''},
      {id:uid(), type:'expense', category:'Groceries', amount:180.45, date:`${base}-05`, note:'Weekly shop'},
      {id:uid(), type:'expense', category:'Transport', amount:60.00, date:`${base}-06`, note:'Pass'},
      {id:uid(), type:'income', category:'Freelance', amount:420.00, date:`${base}-10`, note:'Side gig'},
      {id:uid(), type:'expense', category:'Dining', amount:48.20, date:`${base}-11`, note:''},
      {id:uid(), type:'expense', category:'Utilities', amount:95.10, date:`${base}-12`, note:''}
    ];
    state.transactions = sample.concat(state.transactions);
    save(); renderAll();
  }

  // Helpers
  function escapeHtml(s){
    return s.replace(/[&<>"']/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }

  // 3D Tilt
  function initTilt(){
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const nodes = document.querySelectorAll('[data-tilt]');
    nodes.forEach(node=>{
      if (node.__tiltBound) return; node.__tiltBound = true;
      const max = 12; const scale = 1.02;
      function onMove(e){
        const rect = node.getBoundingClientRect();
        const cx = rect.left + rect.width/2; const cy = rect.top + rect.height/2;
        const px = (e.clientX - cx) / (rect.width/2);
        const py = (e.clientY - cy) / (rect.height/2);
        const rx = (+py * max).toFixed(2);
        const ry = (-px * max).toFixed(2);
        node.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
      }
      function onLeave(){ node.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)'; }
      node.addEventListener('mousemove', onMove);
      node.addEventListener('mouseleave', onLeave);
    });
  }

  // Header Parallax
  function initParallax(){
    const wrap = document.querySelector('.parallax'); if (!wrap) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layers = Array.from(wrap.querySelectorAll('.p-layer'));
    const speeds = [0.02, 0.04, 0.06];
    function onMove(e){
      const { innerWidth:w, innerHeight:h } = window;
      const x = (e.clientX - w/2) / (w/2);
      const y = (e.clientY - h/2) / (h/2);
      layers.forEach((layer,i)=>{
        const s = speeds[i%speeds.length];
        layer.style.transform = `translate(${(-x*s*40).toFixed(1)}px, ${(y*s*30).toFixed(1)}px)`;
      });
    }
    window.addEventListener('mousemove', onMove);
  }

  // Boot
  init();
})();


