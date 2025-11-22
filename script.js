<!-- PART-3: Paste inside the <script> in PART-1 (replace placeholder) -->
<script>
/* ============================
   PART-3: JavaScript (Drag, Edit, Lock, Scale, Solver)
   Works with PART-1 HTML + PART-2 CSS
   ============================ */

/* ---------- DOM refs ---------- */
const svg = document.getElementById('canvas');
const editPopup = document.getElementById('editPopup');
const editTitle = document.getElementById('editTitle');
const editInput = document.getElementById('editInput');
const editLockCheckbox = document.getElementById('editLock');
const applyEditBtn = document.getElementById('applyEdit');
const cancelEditBtn = document.getElementById('cancelEdit');

const scalePlus = document.getElementById('scalePlus');
const scaleMinus = document.getElementById('scaleMinus');
const scaleValue = document.getElementById('scaleValue');

const sideAEl = document.getElementById('sideA'), sideBEl = document.getElementById('sideB'), sideCEl = document.getElementById('sideC');
const angAEl = document.getElementById('angA'), angBEl = document.getElementById('angB'), angCEl = document.getElementById('angC');
const areaEl = document.getElementById('area'), periEl = document.getElementById('peri');

const exportBtn = document.getElementById('applyEdit'); // reuse apply? (we keep simple export via right-click later if needed)

/* ---------- State ---------- */
// px-per-unit (visual scale)
let pxPerUnit = 2.0;
const pxDefault = 2.0;

// anchor A on screen (fixed for rendering)
let A_pos = { x: 160, y: 420 };

// user inputs (units arbitrary). Null means unknown
let inputs = { a: 100, b: 140, c: 160, A: null, B: null, C: null };

// locks: for vertices and sides
let locks = { A: false, B: false, C: false, a: false, b: false, c: false };

// solver solutions array
let solutions = [];
let chosenIndex = 0;

// last drawn points for hit testing
let lastPoints = null;

/* ---------- Helpers ---------- */
const EPS = 1e-12;
const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;
const clamp = x => (x > 1 ? 1 : (x < -1 ? -1 : x));

function defined(x){ return x !== null && x !== undefined; }
function maybeNum(x){ return defined(x) ? Number(x) : null; }

/* ---------- Solver (same robust analytic solver) ---------- */
function solveTriangleFromInputs(inp){
  const a_in = maybeNum(inp.a), b_in = maybeNum(inp.b), c_in = maybeNum(inp.c);
  const A_in = maybeNum(inp.A), B_in = maybeNum(inp.B), C_in = maybeNum(inp.C);
  const sols = [];
  function push(sol){
    if(!(sol && defined(sol.a) && defined(sol.b) && defined(sol.c) && defined(sol.A) && defined(sol.B) && defined(sol.C))) return;
    if(sol.a <= 0 || sol.b <= 0 || sol.c <= 0) return;
    const sum = sol.A + sol.B + sol.C;
    if(Math.abs(sum - 180) > 1e-5) return;
    sols.push(sol);
  }
  // SSS
  if(defined(a_in) && defined(b_in) && defined(c_in)){
    const A = toDeg(Math.acos(clamp((b_in*b_in + c_in*c_in - a_in*a_in)/(2*b_in*c_in))));
    const B = toDeg(Math.acos(clamp((a_in*a_in + c_in*c_in - b_in*b_in)/(2*a_in*c_in))));
    const C = 180 - A - B;
    push({a:a_in,b:b_in,c:c_in,A,B,C}); return sols;
  }
  // two angles -> third + scale
  if([A_in,B_in,C_in].filter(defined).length >= 2){
    let A = A_in, B = B_in, C = C_in;
    if(!defined(A)) A = 180 - B - C;
    if(!defined(B)) B = 180 - A - C;
    if(!defined(C)) C = 180 - A - B;
    if(defined(a_in)){ const k = a_in / Math.sin(toRad(A)); push({a:a_in,b:k*Math.sin(toRad(B)),c:k*Math.sin(toRad(C)),A,B,C}); return sols; }
    if(defined(b_in)){ const k = b_in / Math.sin(toRad(B)); push({a:k*Math.sin(toRad(A)),b:b_in,c:k*Math.sin(toRad(C)),A,B,C}); return sols; }
    if(defined(c_in)){ const k = c_in / Math.sin(toRad(C)); push({a:k*Math.sin(toRad(A)),b:k*Math.sin(toRad(B)),c:c_in,A,B,C}); return sols; }
  }
  // SAS (included angle)
  if(defined(b_in) && defined(c_in) && defined(A_in) && !defined(a_in)){
    const a = Math.sqrt(b_in*b_in + c_in*c_in - 2*b_in*c_in*Math.cos(toRad(A_in)));
    const B = toDeg(Math.acos(clamp((a*a + c_in*c_in - b_in*b_in)/(2*a*c_in))));
    const C = 180 - A_in - B; push({a,b:b_in,c:c_in,A:A_in,B,C}); return sols;
  }
  if(defined(c_in) && defined(a_in) && defined(B_in) && !defined(b_in)){
    const b = Math.sqrt(c_in*c_in + a_in*a_in - 2*c_in*a_in*Math.cos(toRad(B_in)));
    const C = toDeg(Math.acos(clamp((b*b + a_in*a_in - c_in*c_in)/(2*b*a_in))));
    const A = 180 - B_in - C; push({a:a_in,b,c}); return sols;
  }
  if(defined(a_in) && defined(b_in) && defined(C_in) && !defined(c_in)){
    const c = Math.sqrt(a_in*a_in + b_in*b_in - 2*a_in*b_in*Math.cos(toRad(C_in)));
    const A = toDeg(Math.acos(clamp((b_in*b_in + c*c - a_in*a_in)/(2*b_in*c))));
    const B = 180 - C_in - A; push({a:a_in,b:b_in,c,A,B,C:C_in}); return sols;
  }
  // SSA ambiguous permutations: try permutations to generate 1 or 2 solutions
  if(defined(A_in) && defined(a_in) && defined(b_in) && !defined(B_in)){
    const ratio = b_in * Math.sin(toRad(A_in)) / a_in;
    if(Math.abs(ratio) <= 1 + 1e-12){
      const x1 = toDeg(Math.asin(clamp(ratio)));
      const x2 = 180 - x1;
      [x1,x2].forEach(Bcand=>{
        const Ccand = 180 - A_in - Bcand;
        if(Ccand>0){ const k=a_in/Math.sin(toRad(A_in)); const cval = k*Math.sin(toRad(Ccand)); push({a:a_in,b:b_in,c:cval,A:A_in,B:Bcand,C:Ccand}); }
      }); return sols;
    }
  }
  if(defined(A_in) && defined(a_in) && defined(c_in) && !defined(C_in)){
    const ratio = c_in * Math.sin(toRad(A_in)) / a_in;
    if(Math.abs(ratio) <= 1 + 1e-12){
      const x1 = toDeg(Math.asin(clamp(ratio)));
      const x2 = 180 - x1;
      [x1,x2].forEach(Ccand=>{
        const Bcand = 180 - A_in - Ccand;
        if(Bcand>0){ const k=a_in/Math.sin(toRad(A_in)); const bval = k*Math.sin(toRad(Bcand)); push({a:a_in,b:bval,c:c_in,A:A_in,B:Bcand,C:Ccand}); }
      }); return sols;
    }
  }
  if(defined(B_in) && defined(b_in) && defined(a_in) && !defined(A_in)){
    const ratio = a_in * Math.sin(toRad(B_in)) / b_in;
    if(Math.abs(ratio) <= 1 + 1e-12){
      const x1 = toDeg(Math.asin(clamp(ratio)));
      const x2 = 180 - x1;
      [x1,x2].forEach(Acand=>{
        const Ccand = 180 - B_in - Acand;
        if(Ccand>0){ const k=b_in/Math.sin(toRad(B_in)); const cval = k*Math.sin(toRad(Ccand)); push({a:a_in,b:b_in,c:cval,A:Acand,B:B_in,C:Ccand}); }
      }); return sols;
    }
  }
  if(defined(B_in) && defined(b_in) && defined(c_in) && !defined(C_in)){
    const ratio = c_in * Math.sin(toRad(B_in)) / b_in;
    if(Math.abs(ratio) <= 1 + 1e-12){
      const x1 = toDeg(Math.asin(clamp(ratio)));
      const x2 = 180 - x1;
      [x1,x2].forEach(Ccand=>{
        const Acand = 180 - B_in - Ccand;
        if(Acand>0){ const k=b_in/Math.sin(toRad(B_in)); const aval = k*Math.sin(toRad(Acand)); push({a:aval,b:b_in,c:c_in,A:Acand,B:B_in,C:Ccand}); }
      }); return sols;
    }
  }
  if(defined(C_in) && defined(c_in) && defined(a_in) && !defined(A_in)){
    const ratio = a_in * Math.sin(toRad(C_in)) / c_in;
    if(Math.abs(ratio) <= 1 + 1e-12){
      const x1 = toDeg(Math.asin(clamp(ratio)));
      const x2 = 180 - x1;
      [x1,x2].forEach(Acand=>{
        const Bcand = 180 - C_in - Acand;
        if(Bcand>0){ const k=c_in/Math.sin(toRad(C_in)); const bval = k*Math.sin(toRad(Bcand)); push({a:a_in,b:bval,c:c_in,A:Acand,B:Bcand,C:C_in}); }
      }); return sols;
    }
  }
  // fallback no solutions
  return sols;
}

/* ---------- convert solution -> screen coords, A anchored ---------- */
function solutionToPoints(sol){
  const A = { x: A_pos.x, y: A_pos.y };
  const cpx = sol.c * pxPerUnit;
  const B = { x: A.x + cpx, y: A.y };
  const r0 = sol.b * pxPerUnit;
  const r1 = sol.a * pxPerUnit;
  const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx,dy);
  if(d < 1e-6) return { A, B, C: { x: A.x, y: A.y - r0 } };
  const a_dist = (r0*r0 - r1*r1 + d*d) / (2*d);
  let h2 = r0*r0 - a_dist*a_dist; if(h2 < 0) h2 = 0;
  const xm = A.x + a_dist * (dx/d), ym = A.y + a_dist * (dy/d);
  const rx = -dy * (Math.sqrt(h2)/d), ry = dx * (Math.sqrt(h2)/d);
  const C1 = { x: xm + rx, y: ym + ry }, C2 = { x: xm - rx, y: ym - ry };
  const C = (C1.y < C2.y) ? C1 : C2;
  return { A, B, C };
}

/* ---------- SVG drawing helpers ---------- */
function clearSVG(){
  while(svg.firstChild) svg.removeChild(svg.firstChild);
}

function makeLine(p,q,opts={}){
  const l = document.createElementNS('http://www.w3.org/2000/svg','line');
  l.setAttribute('x1',p.x); l.setAttribute('y1',p.y);
  l.setAttribute('x2',q.x); l.setAttribute('y2',q.y);
  l.setAttribute('stroke', opts.stroke||'#163aa2'); l.setAttribute('stroke-width', opts.width||3);
  if(opts.dash) l.setAttribute('stroke-dasharray', opts.dash);
  if(opts.opacity) l.setAttribute('opacity', opts.opacity);
  svg.appendChild(l);
  return l;
}
function makeCircle(p,r,opts={}){
  const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
  c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', r);
  c.setAttribute('fill', opts.fill||'#000'); c.setAttribute('stroke', opts.stroke||'#fff'); c.setAttribute('stroke-width', opts.swidth||1.4);
  svg.appendChild(c); return c;
}
function makeText(x,y,str,opts={}){
  const t = document.createElementNS('http://www.w3.org/2000/svg','text');
  t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('font-size', opts.size||13);
  t.setAttribute('fill', opts.color||'#111'); t.textContent = str; svg.appendChild(t); return t;
}

/* ---------- render ---------- */
function render(){
  clearSVG();
  // solve
  solutions = solveTriangleFromInputs(inputs);
  if(solutions.length === 0){
    // fallback draw using given sides (no angle info)
    const pseudo = { a: inputs.a || 100, b: inputs.b || 120, c: inputs.c || 90, A:null,B:null,C:null };
    drawSolution(pseudo, false);
    updateInfo(null);
    return;
  }
  if(solutions.length > 1){
    // if multiple & user may pick alternate via UI; draw primary (index chosenIndex) normally
    // optionally draw alternate faintly if lock or toggle (not implemented toggle here) - we just draw chosen
  }
  drawSolution(solutions[chosenIndex], false);
  updateInfo(solutions[chosenIndex]);
}

function drawSolution(sol, faint=false){
  const pts = solutionToPoints(sol);
  const A = pts.A, B = pts.B, C = pts.C;
  lastPoints = pts; // for hit-testing

  // edges
  makeLine(A,B,{width:4, stroke:'#163aa2'});
  makeLine(B,C,{width:4, stroke:'#163aa2'});
  makeLine(C,A,{width:4, stroke:'#163aa2'});

  // points (circles) with data attributes for interaction
  const cA = makeCircle(A,8,{fill:'#000'}); cA.dataset.v='A';
  const cB = makeCircle(B,8,{fill:'#000'}); cB.dataset.v='B';
  const cC = makeCircle(C,8,{fill:'#000'}); cC.dataset.v='C';

  // attach pointer handlers for dragging if not locked
  addVertexHandlers(cA, 'A'); addVertexHandlers(cB,'B'); addVertexHandlers(cC,'C');

  // side labels (midpoints)
  const midAB = { x:(A.x+B.x)/2, y:(A.y+B.y)/2 };
  const midBC = { x:(B.x+C.x)/2, y:(B.y+C.y)/2 };
  const midCA = { x:(C.x+A.x)/2, y:(C.y+A.y)/2 };
  const tAB = makeText(midAB.x, midAB.y - 8, sol.c.toFixed(3)); tAB.dataset.side='c';
  const tBC = makeText(midBC.x, midBC.y - 8, sol.a.toFixed(3)); tBC.dataset.side='a';
  const tCA = makeText(midCA.x, midCA.y - 8, sol.b.toFixed(3)); tCA.dataset.side='b';
  addSideHandlers(tAB,'c'); addSideHandlers(tBC,'a'); addSideHandlers(tCA,'b');

  // vertex labels + angle labels (click for angle edit)
  makeText(A.x+10, A.y-10, 'A'); const angAtA = makeText(A.x+10, A.y+18, 'A=' + (sol.A?sol.A.toFixed(2):'—') + '°'); angAtA.dataset.v='A';
  makeText(B.x+10, B.y-10, 'B'); const angAtB = makeText(B.x+10, B.y+18, 'B=' + (sol.B?sol.B.toFixed(2):'—') + '°'); angAtB.dataset.v='B';
  makeText(C.x+10, C.y-10, 'C'); const angAtC = makeText(C.x+10, C.y+18, 'C=' + (sol.C?sol.C.toFixed(2):'—') + '°'); angAtC.dataset.v='C';

  addAngleHandlers(angAtA,'A'); addAngleHandlers(angAtB,'B'); addAngleHandlers(angAtC,'C');

  // draw lock indicators visually near labels when locked
  drawLockIndicator(A.x-30, A.y-30, locks.A);
  drawLockIndicator(B.x-30, B.y-30, locks.B);
  drawLockIndicator(C.x-30, C.y-30, locks.C);
  drawLockIndicator(midAB.x-40, midAB.y-20, locks.c);
  drawLockIndicator(midBC.x-40, midBC.y-20, locks.a);
  drawLockIndicator(midCA.x-40, midCA.y-20, locks.b);
}

/* lock indicator small circle */
function drawLockIndicator(x,y,isLocked){
  const g = document.createElementNS('http://www.w3.org/2000/svg','g');
  const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
  dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', 6);
  dot.setAttribute('fill', isLocked? '#d9534f':'#b7f0c1');
  dot.setAttribute('stroke', '#fff'); dot.setAttribute('stroke-width', 1.2);
  g.appendChild(dot);
  svg.appendChild(g);
}

/* ---------- event helpers ---------- */
/* vertex circle handlers for pointer drag */
function addVertexHandlers(elem, vName){
  elem.addEventListener('pointerdown', (ev)=>{
    ev.stopPropagation();
    if(locks[vName]) return; // locked: no drag
    startDragVertex(vName, ev);
  });
  // also allow single click to open angle edit
  elem.addEventListener('click', (ev)=>{ ev.stopPropagation(); if(locks[vName]) return; openEditPopupForAngle(vName, ev); });
}

/* side text handlers */
function addSideHandlers(textElem, sideName){
  textElem.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    if(locks[sideName]) return; // locked
    openEditPopupForSide(sideName, ev);
  });
}

/* angle text handlers */
function addAngleHandlers(textElem, vName){
  textElem.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    if(locks[vName]) return;
    openEditPopupForAngle(vName, ev);
  });
}

/* ---------- pointer drag implementation ---------- */
let dragging = null; // { which: 'A'|'B'|'C', offsetX, offsetY }
function startDragVertex(which, ev){
  const rect = svg.getBoundingClientRect();
  const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
  // compute current points
  if(!lastPoints) return;
  const pts = lastPoints; // contains screen coords
  const cur = pts[which];
  if(!cur) return;
  dragging = { which, offX: x - cur.x, offY: y - cur.y };
  // capture pointer
  ev.target.setPointerCapture && ev.target.setPointerCapture(ev.pointerId);
}

svg.addEventListener('pointermove', (ev)=>{
  if(!dragging) return;
  const rect = svg.getBoundingClientRect();
  const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
  const which = dragging.which;
  if(which === 'A'){
    // move anchor A_pos
    if(locks.A) return;
    A_pos.x = x - dragging.offX; A_pos.y = y - dragging.offY;
    render();
    return;
  }
  if(!lastPoints) return;
  const pts = lastPoints;
  if(which === 'B'){
    const newB = { x: x - dragging.offX, y: y - dragging.offY };
    // compute new sides in units
    const c_new = Math.hypot(newB.x - A_pos.x, newB.y - A_pos.y) / pxPerUnit;
    const a_new = Math.hypot(newB.x - pts.C.x, newB.y - pts.C.y) / pxPerUnit;
    if(!locks.c) inputs.c = round3(c_new);
    if(!locks.a) inputs.a = round3(a_new);
    // Drop explicit angles so solver can find consistent solution
    inputs.A = inputs.B = inputs.C = null;
    render();
    return;
  }
  if(which === 'C'){
    const newC = { x: x - dragging.offX, y: y - dragging.offY };
    const b_new = Math.hypot(newC.x - A_pos.x, newC.y - A_pos.y) / pxPerUnit;
    const a_new = Math.hypot(newC.x - pts.B.x, newC.y - pts.B.y) / pxPerUnit;
    if(!locks.b) inputs.b = round3(b_new);
    if(!locks.a) inputs.a = round3(a_new);
    inputs.A = inputs.B = inputs.C = null;
    render();
    return;
  }
});

svg.addEventListener('pointerup', (ev)=>{
  if(dragging && ev.target && ev.target.releasePointerCapture){
    try{ ev.target.releasePointerCapture(ev.pointerId); }catch(e){}
  }
  dragging = null;
});

/* ---------- open popup for editing (side/angle) ---------- */
function openEditPopupForSide(sideName, ev){
  // position popup near event
  const rect = svg.getBoundingClientRect();
  const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
  editPopup.style.left = (x + 8) + 'px';
  editPopup.style.top = (y + 8) + 'px';
  editPopup.style.display = 'block';
  editTitle.textContent = `Edit side ${sideName} (units)`;
  editInput.value = (solutions.length ? solutions[chosenIndex][sideName] : inputs[sideName]) || inputs[sideName] || '';
  editLockCheckbox.checked = locks[sideName] || false;
  editPopup.dataset.kind = 'side'; editPopup.dataset.name = sideName;
  editInput.focus(); editInput.select();
}

function openEditPopupForAngle(vName, ev){
  const rect = svg.getBoundingClientRect();
  const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
  editPopup.style.left = (x + 8) + 'px';
  editPopup.style.top = (y + 8) + 'px';
  editPopup.style.display = 'block';
  editTitle.textContent = `Edit angle ${vName} (deg)`;
  editInput.value = (solutions.length ? solutions[chosenIndex][vName] : inputs[vName]) || inputs[vName] || '';
  editLockCheckbox.checked = locks[vName] || false;
  editPopup.dataset.kind = 'angle'; editPopup.dataset.name = vName;
  editInput.focus(); editInput.select();
}

/* apply / cancel handlers */
applyEditBtn.addEventListener('click', ()=>{
  const kind = editPopup.dataset.kind, name = editPopup.dataset.name;
  const val = parseFloat(editInput.value);
  const lockVal = !!editLockCheckbox.checked;
  if(kind === 'side'){
    if(isNaN(val) || val <= 0){ alert('Enter positive length'); return; }
    if(!locks[name]){ inputs[name] = val; }
    locks[name] = lockVal;
    // clear angles to let solver recalc
    if(!locks.A && !locks.B && !locks.C) { inputs.A = inputs.B = inputs.C = null; }
    solveAndRender();
    closeEditPopup();
    return;
  }
  if(kind === 'angle'){
    if(isNaN(val) || val <= 0 || val >= 180){ alert('Angle must be 0-180'); return; }
    if(!locks[name]){ inputs[name] = val; }
    locks[name] = lockVal;
    // angles present -> solver should produce consistent sides where possible
    solveAndRender();
    closeEditPopup();
    return;
  }
});

cancelEditBtn.addEventListener('click', ()=>{
  closeEditPopup();
});

function closeEditPopup(){
  editPopup.style.display = 'none';
  delete editPopup.dataset.kind; delete editPopup.dataset.name;
}

/* ---------- utility rounding ---------- */
function round3(x){ return Math.round(x*1000)/1000; }

/* ---------- info update ---------- */
function updateInfo(sol){
  if(!sol){
    sideAEl.textContent = inputs.a? round3(inputs.a) : '—';
    sideBEl.textContent = inputs.b? round3(inputs.b) : '—';
    sideCEl.textContent = inputs.c? round3(inputs.c) : '—';
    angAEl.textContent = inputs.A? round3(inputs.A) : '—';
    angBEl.textContent = inputs.B? round3(inputs.B) : '—';
    angCEl.textContent = inputs.C? round3(inputs.C) : '—';
    areaEl.textContent = '—'; periEl.textContent = '—';
    return;
  }
  sideAEl.textContent = round3(sol.a); sideBEl.textContent = round3(sol.b); sideCEl.textContent = round3(sol.c);
  angAEl.textContent = round3(sol.A); angBEl.textContent = round3(sol.B); angCEl.textContent = round3(sol.C);
  const s = (sol.a + sol.b + sol.c)/2;
  const area = Math.sqrt(Math.max(0, s*(s-sol.a)*(s-sol.b)*(s-sol.c)));
  areaEl.textContent = round3(area);
  periEl.textContent = round3(sol.a + sol.b + sol.c);
}

/* ---------- scale controls ---------- */
scalePlus.addEventListener('click', ()=>{
  pxPerUnit *= 1.2; updateScaleLabel(); render();
});
scaleMinus.addEventListener('click', ()=>{
  pxPerUnit /= 1.2; updateScaleLabel(); render();
});
function updateScaleLabel(){ scaleValue.textContent = Math.round(pxPerUnit/pxDefault * 100) + '%' ; }
updateScaleLabel();

/* ---------- solve runner ---------- */
function solveAndRender(){
  solutions = solveTriangleFromInputs(inputs);
  if(solutions.length === 0){
    render(); updateInfo(null); return;
  }
  chosenIndex = 0;
  render();
  updateInfo(solutions[chosenIndex]);
}

/* initial render */
solveAndRender();

/* ---------- hit testing helper (point to segment) ---------- */
function distancePointToSegment(P,A,B){
  const vx = B.x - A.x, vy = B.y - A.y;
  const wx = P.x - A.x, wy = P.y - A.y;
  const c1 = vx*wx + vy*wy;
  if(c1 <= 0) return Math.hypot(P.x - A.x, P.y - A.y);
  const c2 = vx*vx + vy*vy;
  if(c2 <= c1) return Math.hypot(P.x - B.x, P.y - B.y);
  const t = c1 / c2;
  const projx = A.x + t*vx, projy = A.y + t*vy;
  return Math.hypot(P.x - projx, P.y - projy);
}

/* ---------- export SVG (optional) ---------- */
function exportSVG(){
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'triangle.svg'; a.click(); URL.revokeObjectURL(url);
}

/* Allow right-click to export for convenience */
svg.addEventListener('contextmenu', (ev)=>{ ev.preventDefault(); exportSVG(); });

/* ---------- keyboard shortcuts ---------- */
window.addEventListener('keydown', (ev)=>{
  if(ev.key === 'Escape') closeEditPopup();
});

/* End of PART-3 JS */
</script>
