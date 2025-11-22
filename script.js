/* =========================
   Naapi-Amin Pro — Triangle
   All in one file (vanilla JS)
   ========================= */

/* ---------- State ---------- */
const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('canvasWrap');

const inline = document.getElementById('inline');
const inlineTitle = document.getElementById('inlineTitle');
const inlineInput = document.getElementById('inlineInput');

const vaEl = document.getElementById('va'), vbEl = document.getElementById('vb'), vcEl = document.getElementById('vc');
const angAEl = document.getElementById('angA'), angBEl = document.getElementById('angB'), angCEl = document.getElementById('angC');
const areaEl = document.getElementById('area'), periEl = document.getElementById('peri'), ttypeEl = document.getElementById('ttype');

let pxPerUnit = 2.0; const pxDefault = 2.0;
let showGrid = false;
let showConstruct = false;
let snap45 = false;
let showSSAAlt = false;

/* User inputs (units arbitrary). null = unknown */
let inputs = { a: 100, b: 140, c: 160, A: null, B: null, C: null };

/* Solutions array from solver */
let solutions = []; let chosenIndex = 0;

/* Anchor A */
let A_pos = { x: 160, y: 420 }; // screen pixels anchor for A

/* pointer / drag state */
let dragging = null; // { which: 'A'|'B'|'C', offsetX, offsetY }

/* helper math */
const EPS = 1e-12;
const toRad = d => d * Math.PI/180;
const toDeg = r => r * 180/Math.PI;
const clamp = x => (x>1?1:(x<-1?-1:x));

/* canvas fit */
function fitCanvas(){
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width);
  canvas.height = Math.round(r.height);
}
window.addEventListener('resize', ()=>{ fitCanvas(); render(); });
fitCanvas();

/* ---------- TRIANGLE SOLVER (analytic) ----------
   Returns array of solutions: each {a,b,c,A,B,C}
   Supports SSS, SAS, ASA, AAS, SSA (ambiguous)
*/
function defined(x){ return x !== null && x !== undefined; }
function maybeNum(x){ return defined(x) ? Number(x) : null; }

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
  // Two angles -> third and scale via any side
  if([A_in,B_in,C_in].filter(defined).length >=2){
    let A = A_in, B = B_in, C = C_in;
    if(!defined(A)) A = 180 - B - C;
    if(!defined(B)) B = 180 - A - C;
    if(!defined(C)) C = 180 - A - B;
    if(defined(a_in)){ const k = a_in / Math.sin(toRad(A)); push({a:a_in,b:k*Math.sin(toRad(B)),c:k*Math.sin(toRad(C)),A,B,C}); return sols; }
    if(defined(b_in)){ const k = b_in / Math.sin(toRad(B)); push({a:k*Math.sin(toRad(A)),b:b_in,c:k*Math.sin(toRad(C)),A,B,C}); return sols; }
    if(defined(c_in)){ const k = c_in / Math.sin(toRad(C)); push({a:k*Math.sin(toRad(A)),b:k*Math.sin(toRad(B)),c:c_in,A,B,C}); return sols; }
  }
  // SAS
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
  // SSA ambiguous permutations
  // A,a,b known -> B possibilities
  if(defined(A_in) && defined(a_in) && defined(b_in) && !defined(B_in)){
    const ratio = b_in * Math.sin(toRad(A_in)) / a_in;
    if(Math.abs(ratio) <= 1 + 1e-12){
      const x1 = toDeg(Math.asin(clamp(ratio))), x2 = 180 - x1;
      [x1,x2].forEach(Bcand=>{
        const Ccand = 180 - A_in - Bcand;
        if(Ccand > 0){ const k = a_in / Math.sin(toRad(A_in)); const cval = k * Math.sin(toRad(Ccand)); push({a:a_in,b:b_in,c:cval,A:A_in,B:Bcand,C:Ccand}); }
      }); return sols;
    }
  }
  // A,a,c known -> C possibilities
  if(defined(A_in) && defined(a_in) && defined(c_in) && !defined(C_in)){
    const ratio = c_in * Math.sin(toRad(A_in)) / a_in;
    if(Math.abs(ratio) <= 1 + 1e-12){
      const x1 = toDeg(Math.asin(clamp(ratio))), x2 = 180 - x1;
      [x1,x2].forEach(Ccand=>{
        const Bcand = 180 - A_in - Ccand;
        if(Bcand > 0){ const k = a_in/Math.sin(toRad(A_in)); const bval = k * Math.sin(toRad(Bcand)); push({a:a_in,b:bval,c:c_in,A:A_in,B:Bcand,C:Ccand}); }
      }); return sols;
    }
  }
  // B permutations
  if(defined(B_in) && defined(b_in) && defined(a_in) && !defined(A_in)){
    const ratio = a_in * Math.sin(toRad(B_in)) / b_in;
    if(Math.abs(ratio) <= 1 + 1e-12){
      const x1 = toDeg(Math.asin(clamp(ratio))), x2 = 180 - x1;
      [x1,x2].forEach(Acand=>{
        const Ccand = 180 - B_in - Acand;
        if(Ccand>0){ const k = b_in/Math.sin(toRad(B_in)); const cval = k*Math.sin(toRad(Ccand)); push({a:a_in,b:b_in,c:cval,A:Acand,B:B_in,C:Ccand}); }
      }); return sols;
    }
  }
  if(defined(B_in) && defined(b_in) && defined(c_in) && !defined(C_in)){
    const ratio = c_in * Math.sin(toRad(B_in)) / b_in;
    if(Math.abs(ratio) <= 1 + 1e-12){
      const x1 = toDeg(Math.asin(clamp(ratio))), x2 = 180 - x1;
      [x1,x2].forEach(Ccand=>{
        const Acand = 180 - B_in - Ccand;
        if(Acand>0){ const k=b_in/Math.sin(toRad(B_in)); const aval = k*Math.sin(toRad(Acand)); push({a:aval,b:b_in,c:c_in,A:Acand,B:B_in,C:Ccand}); }
      }); return sols;
    }
  }
  // C permutations
  if(defined(C_in) && defined(c_in) && defined(a_in) && !defined(A_in)){
    const ratio = a_in * Math.sin(toRad(C_in)) / c_in;
    if(Math.abs(ratio) <= 1 + 1e-12){
      const x1 = toDeg(Math.asin(clamp(ratio))), x2 = 180 - x1;
      [x1,x2].forEach(Acand=>{
        const Bcand = 180 - C_in - Acand;
        if(Bcand>0){ const k=c_in/Math.sin(toRad(C_in)); const bval = k*Math.sin(toRad(Bcand)); push({a:a_in,b:bval,c:c_in,A:Acand,B:Bcand,C:C_in}); }
      }); return sols;
    }
  }
  // not solvable analytically
  return sols;
}

/* ---------- convert solution -> screen points (A fixed anchor) ---------- */
function solutionToPoints(sol){
  const A = { x: A_pos.x, y: A_pos.y };
  const cpx = sol.c * pxPerUnit;
  const B = { x: A.x + cpx, y: A.y };
  const r0 = sol.b * pxPerUnit; // radius from A
  const r1 = sol.a * pxPerUnit; // radius from B
  const dx = B.x - A.x, dy = B.y - A.y; const d = Math.hypot(dx,dy);
  if(d < 1e-6) return {A,B,C:{x:A.x, y:A.y - r0}};
  const a_dist = (r0*r0 - r1*r1 + d*d)/(2*d);
  let h2 = r0*r0 - a_dist*a_dist; if(h2 < 0) h2 = 0;
  const xm = A.x + a_dist * (dx/d), ym = A.y + a_dist * (dy/d);
  const rx = -dy * (Math.sqrt(h2)/d), ry = dx * (Math.sqrt(h2)/d);
  const C1 = { x: xm + rx, y: ym + ry }, C2 = { x: xm - rx, y: ym - ry };
  // prefer the point above baseline (smaller y)
  const C = (C1.y < C2.y) ? C1 : C2;
  return {A,B,C};
}

/* ---------- Construction helpers ---------- */
function midpoint(P,Q){ return {x:(P.x+Q.x)/2, y:(P.y+Q.y)/2}; }
function lineIntersection(p1, p2, p3, p4){
  // returns intersection of lines (p1-p2) and (p3-p4) or null
  const x1=p1.x,y1=p1.y,x2=p2.x,y2=p2.y,x3=p3.x,y3=p3.y,x4=p4.x,y4=p4.y;
  const denom = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4);
  if(Math.abs(denom) < 1e-9) return null;
  const px = ((x1*y2 - y1*x2)*(x3-x4) - (x1-x2)*(x3*y4 - y3*x4))/denom;
  const py = ((x1*y2 - y1*x2)*(y3-y4) - (y1-y2)*(x3*y4 - y3*x4))/denom;
  return {x:px,y:py};
}

/* ---------- Draw ---------- */
function clearCanvas(){ ctx.clearRect(0,0,canvas.width,canvas.height); }

function drawGrid(){
  if(!showGrid) return;
  const gap = 25;
  ctx.save();
  ctx.strokeStyle = '#e6eef8'; ctx.lineWidth = 1;
  for(let x = 0; x < canvas.width; x += gap){
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
  }
  for(let y = 0; y < canvas.height; y += gap){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
  }
  ctx.restore();
}

function drawTriangle(sol, opts = {}){
  const pts = solutionToPoints(sol);
  const A = pts.A, B = pts.B, C = pts.C;

  // edges
  drawLine(A,B, 4, '#163aa2', false);
  drawLine(B,C, 4, '#163aa2', false);
  drawLine(C,A, 4, '#163aa2', false);

  // points
  drawCircle(A,8,'#000'); drawCircle(B,8,'#000'); drawCircle(C,8,'#000');

  // side labels
  const midBC = midpoint(B,C), midCA = midpoint(C,A), midAB = midpoint(A,B);
  drawText(midBC.x, midBC.y-10, sol.a.toFixed(3));
  drawText(midCA.x, midCA.y-10, sol.b.toFixed(3));
  drawText(midAB.x, midAB.y-10, sol.c.toFixed(3));

  // vertex labels and angles
  drawText(A.x+10, A.y-12, 'A'); drawText(A.x+10, A.y+22, 'A=' + (sol.A?sol.A.toFixed(2):'—') + '°');
  drawText(B.x+10, B.y-12, 'B'); drawText(B.x+10, B.y+22, 'B=' + (sol.B?sol.B.toFixed(2):'—') + '°');
  drawText(C.x+10, C.y-12, 'C'); drawText(C.x+10, C.y+22, 'C=' + (sol.C?sol.C.toFixed(2):'—') + '°');

  // construction lines: medians, heights, bisectors, circumcenter/incenter/orthocenter
  if(showConstruct){
    // medians (A->midBC, B->midCA, C->midAB)
    const mBC = midpoint(B,C), mCA = midpoint(C,A), mAB = midpoint(A,B);
    drawLine(A, mBC, 1.2, '#f39c12', true);
    drawLine(B, mCA, 1.2, '#f39c12', true);
    drawLine(C, mAB, 1.2, '#f39c12', true);

    // altitudes (orthocenter)
    const altA = perpendicularFromPointToLine(A,B,C);
    const altB = perpendicularFromPointToLine(B,C,A);
    const altC = perpendicularFromPointToLine(C,A,B);
    if(altA) drawLine(A, altA, 1.2, '#27ae60', true);
    if(altB) drawLine(B, altB, 1.2, '#27ae60', true);
    if(altC) drawLine(C, altC, 1.2, '#27ae60', true);

    // angle bisectors (incenter)
    const bisA = angleBisectorPoint(A,B,C);
    const bisB = angleBisectorPoint(B,C,A);
    const bisC = angleBisectorPoint(C,A,B);
    if(bisA) drawLine(A, bisA, 1.2, '#8e44ad', true);
    if(bisB) drawLine(B, bisB, 1.2, '#8e44ad', true);
    if(bisC) drawLine(C, bisC, 1.2, '#8e44ad', true);

    // centers
    const incenter = computeIncenter(A,B,C);
    if(incenter) { drawCircle(incenter,5,'#8e44ad'); drawText(incenter.x+8, incenter.y+6, 'Incenter'); }
    const circum = computeCircumcenter(A,B,C);
    if(circum) { drawCircle(circum,5,'#3498db'); drawText(circum.x+8, circum.y+6, 'Circumc.'); }
    const orth = computeOrthocenter(A,B,C);
    if(orth) { drawCircle(orth,5,'#27ae60'); drawText(orth.x+8, orth.y+6, 'Orthoc.'); }
  }

  // return points for hit testing
  return {A,B,C};
}

/* primitive drawing */
function drawLine(P,Q, w=2, color='#000', dashed=false){
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dashed? [8,6]: []); ctx.beginPath(); ctx.moveTo(P.x,P.y); ctx.lineTo(Q.x,Q.y); ctx.stroke(); ctx.restore();
}
function drawCircle(P,r=6,color='#000'){ ctx.beginPath(); ctx.fillStyle=color; ctx.arc(P.x,P.y,r,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=1.2; ctx.stroke(); }
function drawText(x,y,text){ ctx.font='13px system-ui'; ctx.fillStyle='#111'; ctx.fillText(text, x, y); }

/* constructions math */
function perpendicularFromPointToLine(P, A, B){
  // returns foot point from P to line AB
  const vx = B.x - A.x, vy = B.y - A.y;
  const t = ((P.x - A.x)*vx + (P.y - A.y)*vy) / (vx*vx + vy*vy);
  const px = A.x + t*vx, py = A.y + t*vy;
  return {x:px, y:py};
}
function angleBisectorPoint(V, P1, P2){
  // return point on internal bisector at distance (approx) average of adjacent sides (just line direction)
  const a = Math.hypot(P1.x - P2.x, P1.y - P2.y);
  const b = Math.hypot(V.x - P1.x, V.y - P1.y);
  const c = Math.hypot(V.x - P2.x, V.y - P2.y);
  if(b < EPS || c < EPS) return null;
  // direction vector = normalized(P1 - V)/b + normalized(P2 - V)/c
  const ux = (P1.x - V.x)/b + (P2.x - V.x)/c;
  const uy = (P1.y - V.y)/b + (P2.y - V.y)/c;
  const mag = Math.hypot(ux, uy); if(mag < EPS) return null;
  const L = Math.max(30, (b+c)/4 * pxPerUnit); // draw some length
  return { x: V.x + (ux/mag)*L, y: V.y + (uy/mag)*L };
}
function computeIncenter(A,B,C){
  const a = Math.hypot(B.x-C.x, B.y-C.y);
  const b = Math.hypot(C.x-A.x, C.y-A.y);
  const c = Math.hypot(A.x-B.x, A.y-B.y);
  const px = (a*A.x + b*B.x + c*C.x) / (a+b+c);
  const py = (a*A.y + b*B.y + c*C.y) / (a+b+c);
  return {x:px,y:py};
}
function computeCircumcenter(A,B,C){
  // perpendicular bisector intersection
  const mAB = midpoint(A,B), mBC = midpoint(B,C);
  const dirAB = {x: B.x - A.x, y: B.y - A.y}, perpAB = {x:-dirAB.y, y:dirAB.x};
  const dirBC = {x: C.x - B.x, y: C.y - B.y}, perpBC = {x:-dirBC.y, y:dirBC.x};
  const p = lineIntersection(mAB, {x:mAB.x+perpAB.x, y:mAB.y+perpAB.y}, mBC, {x:mBC.x+perpBC.x, y:mBC.y+perpBC.y});
  return p;
}
function computeOrthocenter(A,B,C){
  // intersection of two altitudes
  const altAfoot = perpendicularFromPointToLine(A,B,C);
  const altBfoot = perpendicularFromPointToLine(B,C,A);
  const p = lineIntersection(A, altAfoot, B, altBfoot);
  return p;
}

/* ---------- hit testing & interaction ---------- */
function distance(P,Q){ return Math.hypot(P.x-Q.x, P.y-Q.y); }
function distancePointToSegment(P,A,B){
  const vx = B.x - A.x, vy = B.y - A.y;
  const wx = P.x - A.x, wy = P.y - A.y;
  const c1 = vx*wx + vy*wy;
  if(c1 <= 0) return Math.hypot(P.x-A.x, P.y-A.y);
  const c2 = vx*vx + vy*vy;
  if(c2 <= c1) return Math.hypot(P.x-B.x, P.y-B.y);
  const t = c1/c2;
  const projx = A.x + t*vx, projy = A.y + t*vy;
  return Math.hypot(P.x - projx, P.y - projy);
}

/* ---------- solve & render flow ---------- */
function render(){
  fitCanvas();
  clearCanvas();
  drawGrid();
  solutions = solveTriangleFromInputs(inputs);
  if(solutions.length === 0){
    // fallback draw using available input sides (or defaults)
    const pseudo = { a: inputs.a || 100, b: inputs.b || 120, c: inputs.c || 90, A:null,B:null,C:null };
    drawSolutionOnCanvas(pseudo, false);
    updateInfo(null);
    return;
  }
  // if multiple solutions and showSSAAlt true -> draw both faint + main
  if(solutions.length > 1 && showSSAAlt){
    drawSolutionOnCanvas(solutions[1], true);
    drawSolutionOnCanvas(solutions[0], false);
    updateInfo(solutions[0]);
  } else {
    drawSolutionOnCanvas(solutions[chosenIndex], false);
    updateInfo(solutions[chosenIndex]);
  }
}

function drawSolutionOnCanvas(sol, faint=false){
  ctx.save();
  if(faint){ ctx.globalAlpha = 0.32; }
  const pts = drawTriangle(sol, {faint});
  ctx.restore();
  // store last points for hit-testing
  lastPoints = pts;
}

/* ---------- interactive behaviors: pointer/drag/click ---------- */
let lastPoints = null;
canvas.addEventListener('pointerdown', (ev)=>{
  ev.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
  if(!lastPoints){ render(); if(!lastPoints) return; }
  const A = lastPoints.A, B = lastPoints.B, C = lastPoints.C;
  const hitR = 12;

  // vertex hit?
  if(distance({x,y}, A) < hitR){ startDrag('A', x - A.x, y - A.y); return; }
  if(distance({x,y}, B) < hitR){ startDrag('B', x - B.x, y - B.y); return; }
  if(distance({x,y}, C) < hitR){ startDrag('C', x - C.x, y - C.y); return; }

  // edge hit? allow small tolerance
  if(distancePointToSegment({x,y}, B, C) < 10){ openInlineForSide('a', x, y); return; }
  if(distancePointToSegment({x,y}, C, A) < 10){ openInlineForSide('b', x, y); return; }
  if(distancePointToSegment({x,y}, A, B) < 10){ openInlineForSide('c', x, y); return; }
});

function startDrag(which, offX, offY){
  dragging = { which, offX, offY };
  canvas.setPointerCapture && canvas.setPointerCapture();
}
canvas.addEventListener('pointermove', (ev)=>{
  if(!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
  // dragging should update inputs a,b,c in units by moving the corresponding point
  // We compute new screen coords and then set new sides (in units) based on pxPerUnit
  if(!lastPoints) return;
  const pts = lastPoints;
  if(dragging.which === 'A'){
    // move anchor: update A_pos
    A_pos.x = x - dragging.offX; A_pos.y = y - dragging.offY;
    render();
    return;
  }
  if(dragging.which === 'B'){
    // new B in screen
    const newB = { x: x - dragging.offX, y: y - dragging.offY };
    // compute new sides in units
    const c_new = Math.hypot(newB.x - A_pos.x, newB.y - A_pos.y) / pxPerUnit;
    const a_new = Math.hypot(newB.x - pts.C.x, newB.y - pts.C.y) / pxPerUnit;
    inputs.c = roundNum(c_new); inputs.a = roundNum(a_new);
    // if snap on, snap angles or lengths
    if(snap45) { applySnap(); }
    render();
    return;
  }
  if(dragging.which === 'C'){
    const newC = { x: x - dragging.offX, y: y - dragging.offY };
    const b_new = Math.hypot(newC.x - A_pos.x, newC.y - A_pos.y) / pxPerUnit;
    const a_new = Math.hypot(newC.x - pts.B.x, newC.y - pts.B.y) / pxPerUnit;
    inputs.b = roundNum(b_new); inputs.a = roundNum(a_new);
    if(snap45) { applySnap(); }
    render();
    return;
  }
});
canvas.addEventListener('pointerup', (ev)=>{ dragging = null; });

/* double click vertex area to open angle inline */
canvas.addEventListener('dblclick', (ev)=>{
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
  if(!lastPoints) return;
  const A = lastPoints.A, B = lastPoints.B, C = lastPoints.C;
  if(distance({x,y}, A) < 14){ openInlineForAngle('A', x, y); return; }
  if(distance({x,y}, B) < 14){ openInlineForAngle('B', x, y); return; }
  if(distance({x,y}, C) < 14){ openInlineForAngle('C', x, y); return; }
});

/* ---------- inline smart input (no blocking popup) ---------- */
function openInlineForSide(sideName, clientX, clientY){
  popupHide();
  popupTarget = { type:'side', name: sideName };
  inlineTitle.innerText = `Side ${sideName} (units)`;
  const cur = (solutions.length ? solutions[chosenIndex][sideName] : inputs[sideName]) || inputs[sideName] || '';
  inlineInput.value = cur ? Number(cur.toFixed(6)) : '';
  showInlineAt(clientX, clientY);
  inlineInput.focus(); inlineInput.select();
}
function openInlineForAngle(angleName, clientX, clientY){
  popupHide();
  popupTarget = { type:'angle', name: angleName };
  inlineTitle.innerText = `Angle ${angleName} (°)`;
  const cur = (solutions.length ? solutions[chosenIndex][angleName] : inputs[angleName]) || inputs[angleName] || '';
  inlineInput.value = cur ? Number(cur.toFixed(6)) : '';
  showInlineAt(clientX, clientY);
  inlineInput.focus(); inlineInput.select();
}
function showInlineAt(clientX, clientY){
  const rect = wrap.getBoundingClientRect();
  let left = clientX - rect.left + 6;
  let top = clientY - rect.top + 6;
  left = Math.min(left, rect.width - 180); top = Math.min(top, rect.height - 80);
  inline.style.left = left + 'px'; inline.style.top = top + 'px'; inline.style.display = 'block'; inline.setAttribute('aria-hidden','false');
  popupTargetInline = true;
}
function popupHide(){ inline.style.display='none'; inline.setAttribute('aria-hidden','true'); popupTarget = null; popupTargetInline = false; }

/* handle enter on inline input */
let popupTarget = null, popupTargetInline = false;
inlineInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){ applyInlineInput(); }
  if(e.key === 'Escape'){ popupHide(); }
});

function applyInlineInput(){
  const val = parseFloat(inlineInput.value);
  if(!popupTarget) { popupHide(); return; }
  if(popupTarget.type === 'side'){
    if(isNaN(val) || val <= 0){ alert('Positive number required'); return; }
    inputs[popupTarget.name] = val;
    // solving using analytic solver
    solveAndRender();
    popupHide(); return;
  }
  if(popupTarget.type === 'angle'){
    if(isNaN(val) || val <= 0 || val >= 180){ alert('Angle must be between 0 and 180'); return; }
    inputs[popupTarget.name] = val;
    solveAndRender();
    popupHide(); return;
  }
}

/* ---------- solver runner ---------- */
function solveAndRender(){
  solutions = solveTriangleFromInputs(inputs);
  if(solutions.length === 0){
    // keep drawing fallback
    render();
    updateInfo(null); return;
  }
  // choose default solution
  chosenIndex = 0;
  // if SSA alt show selected
  render();
  updateInfo(solutions[chosenIndex]);
}

/* ---------- info update ---------- */
function updateInfo(sol){
  if(!sol){
    vaEl.textContent = inputs.a? Number(inputs.a).toFixed(3): '—';
    vbEl.textContent = inputs.b? Number(inputs.b).toFixed(3): '—';
    vcEl.textContent = inputs.c? Number(inputs.c).toFixed(3): '—';
    angAEl.textContent = inputs.A? Number(inputs.A).toFixed(3): '—';
    angBEl.textContent = inputs.B? Number(inputs.B).toFixed(3): '—';
    angCEl.textContent = inputs.C? Number(inputs.C).toFixed(3): '—';
    areaEl.textContent = '—'; periEl.textContent = '—'; ttypeEl.textContent = '—';
    return;
  }
  vaEl.textContent = sol.a.toFixed(3);
  vbEl.textContent = sol.b.toFixed(3);
  vcEl.textContent = sol.c.toFixed(3);
  angAEl.textContent = sol.A.toFixed(3);
  angBEl.textContent = sol.B.toFixed(3);
  angCEl.textContent = sol.C.toFixed(3);
  const s = (sol.a + sol.b + sol.c)/2;
  const area = Math.sqrt(Math.max(0, s*(s-sol.a)*(s-sol.b)*(s-sol.c)));
  areaEl.textContent = area.toFixed(3);
  periEl.textContent = (sol.a + sol.b + sol.c).toFixed(3);
  ttypeEl.textContent = classifyTriangle(sol);
}

/* ---------- classify triangle ---------- */
function classifyTriangle(sol){
  const arr = [sol.a, sol.b, sol.c].slice().sort((x,y)=>x-y);
  const [x,y,z] = arr; const types = [];
  if(Math.abs(x-y) < 1e-6 && Math.abs(y-z) < 1e-6) types.push('Equilateral');
  else if(Math.abs(x-y) < 1e-6 || Math.abs(y-z) < 1e-6 || Math.abs(x-z) < 1e-6) types.push('Isosceles'); else types.push('Scalene');
  if(Math.abs(x*x + y*y - z*z) < 1e-3) types.push('Right'); else if(x*x + y*y > z*z) types.push('Acute'); else types.push('Obtuse');
  return types.join(', ');
}

/* ---------- helpers ---------- */
function roundNum(x){ return Math.round(x*1000)/1000; }
function applySnap(){
  // snap inputs' angles to nearest 45° multiples if snap45 true
  if(!solutions.length) return;
  const s = solutions[chosenIndex];
  if(!s) return;
  function snapAngleDeg(a){ return Math.round(a / 45) * 45; }
  if(snap45){
    inputs.A = snapAngleDeg(s.A); inputs.B = snapAngleDeg(s.B); inputs.C = 180 - inputs.A - inputs.B;
  }
}

/* ---------- controls binding ---------- */
document.getElementById('zoomIn').addEventListener('click', ()=>{ pxPerUnit *= 1.2; render(); });
document.getElementById('zoomOut').addEventListener('click', ()=>{ pxPerUnit /= 1.2; render(); });
document.getElementById('fitBtn').addEventListener('click', ()=>{ pxPerUnit = pxDefault; render(); });

document.getElementById('gridToggle').addEventListener('click', (e)=>{ showGrid = !showGrid; e.target.textContent = showGrid? 'Grid: ON':'Grid'; render(); });
document.getElementById('constructToggle').addEventListener('click', (e)=>{ showConstruct = !showConstruct; e.target.textContent = showConstruct? 'Construct: ON':'Construct: OFF'; render(); });
document.getElementById('snapToggle').addEventListener('click', (e)=>{ snap45 = !snap45; e.target.textContent = snap45? 'Snap 45°: ON':'Snap 45°: OFF'; if(snap45) applySnap(); render(); });
document.getElementById('ssaToggle').addEventListener('click', (e)=>{ showSSAAlt = !showSSAAlt; e.target.textContent = showSSAAlt? 'SSA alt: ON':'SSA alt: OFF'; render(); });

document.getElementById('resetBtn').addEventListener('click', ()=>{
  inputs = { a:100, b:140, c:160, A:null, B:null, C:null }; pxPerUnit = pxDefault; showGrid=false; showConstruct=false; snap45=false; showSSAAlt=false; render(); });

document.getElementById('exportSVG').addEventListener('click', ()=>{
  if(!solutions.length){ alert('No valid solution to export'); return; }
  const sol = solutions[chosenIndex]; const pts = solutionToPoints(sol);
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">` +
    `<line x1="${pts.A.x}" y1="${pts.A.y}" x2="${pts.B.x}" y2="${pts.B.y}" stroke="#163aa2" stroke-width="4"/>` +
    `<line x1="${pts.B.x}" y1="${pts.B.y}" x2="${pts.C.x}" y2="${pts.C.y}" stroke="#163aa2" stroke-width="4"/>` +
    `<line x1="${pts.C.x}" y1="${pts.C.y}" x2="${pts.A.x}" y2="${pts.A.y}" stroke="#163aa2" stroke-width="4"/>` +
    `</svg>`;
  const blob = new Blob([svgStr], {type:'image/svg+xml'}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'triangle.svg'; a.click(); URL.revokeObjectURL(url);
});
document.getElementById('exportPNG').addEventListener('click', ()=>{
  // render current canvas to data url (we already draw to canvas) -> save
  const link = document.createElement('a'); link.download = 'triangle.png'; link.href = canvas.toDataURL('image/png'); link.click();
});

/* cycle SSA solutions on infoRow click */
document.getElementById('infoRow').addEventListener('click', ()=>{
  if(solutions.length > 1){ chosenIndex = (chosenIndex + 1) % solutions.length; render(); updateInfo(solutions[chosenIndex]); }
});

/* initial render */
solveAndRender();
render();
