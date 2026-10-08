/* TUNGO - NDMC Campus Wayfinding
   Map data is traced from the official NDMC Campus Directory (740 x 507 reference).
   Items: [id, name, x, y, w, h, rotation, shape]  (shape: r = box, c = circle) */

var BUILDINGS = [
  ['1','Robert S. Sullivan Bldg.',546,258,14,82,-25],
  ['2','Powerhouse',568,309,9,10,0],
  ['3','General Services Office',562,319,9,9,0],
  ['4','Property Custodian / Supply Office',571,323,9,9,0],
  ['5','Voc-Ed Bldg.',585,328,10,10,0],
  ['6','OMI Residence/CES (Gnd. Flr.)',574,342,10,10,0],
  ['7','CMO',573,357,10,10,0],
  ['8','Recollection House',590,343,10,10,0],
  ['9','Sacristy',603,358,10,10,0],
  ['10','Chapel',603,377,10,10,0],
  ['11','Little Theater',584,381,14,12,0],
  ['12','Research, Planning and Devt.',577,394,10,10,0],
  ['13','Clinic',577,406,10,10,0],
  ['14','Gymnasium',613,414,34,52,-20],
  ['15','LBC Bldg',619,458,10,9,0],
  ['16','Alumni Center',610,457,10,9,0],
  ['17','De Mazenod Bldg.',535,370,16,52,0],
  ['18','McGrath Bldg.',498,385,24,70,0],
  ['19a','Plaza Madonna Bldg.',510,452,26,10,0],
  ['19b','NDMC Facade',480,452,26,10,0],
  ['19c','Oasis Foodhouse',450,442,16,10,0],
  ['20','College Library',460,390,22,52,0],
  ['21','Old Library Bldg.',430,390,22,52,0],
  ['22','ETD Bldg.',375,268,16,92,-10],
  ['23','ECCE Bldg.',355,211,12,12,0],
  ['24','Bishop Mongeau Bldg.',372,178,14,40,0],
  ['25','Computer Hardware Shop',521,200,10,10,0],
  ['26','Electronic Servicing Laboratory',512,192,10,10,0],
  ['27','Automotive Shop',510,177,10,18,0],
  ['28','HS Gordon Bldg.',405,141,34,12,0],
  ['29','HS Computer/Science Lab',362,139,22,14,0],
  ['30','Practical Arts Bldg.',430,116,24,14,0],
  ['31','Nursing Students Dormitory',479,86,10,10,0],
  ['32','Student Aides Quarter',447,66,10,10,0],
  ['33','Student Aides Kitchen',463,66,10,10,0],
  ['34','Ladies Dormitory',505,56,16,16,0],
  ['35','Retreat House (Fish Pond)',683,47,22,26,0]
];
var FACILITIES = [
  ['A','Carpentry Shop',633,427],
  ['B','Rotonda',577,432,'c'],
  ['C','Student Lounge 2',553,369],
  ['D','Student Lounge 1',518,374],
  ['E','Cooperative Bldg.',408,444],
  ['F','Guard House',405,422],
  ['G','ETD Playground',407,376],
  ['H','ETD Covered Court',412,347],
  ['I','ETD Stage',425,410],
  ['J','Soccer Field',471,278],
  ['K','HS Stage',467,214],
  ['L','HS Basketball Court',470,187,60,30],
  ['M','Proposed Tennis Court',470,162,60,18],
  ['N','Volleyball Court',470,146,24,12],
  ['O','HS Student Lounge',407,157],
  ['P','Warehouse',339,121]
];

var ITEMS = [];
BUILDINGS.forEach(function (b) {
  ITEMS.push({ id: b[0], name: b[1], x: b[2], y: b[3], w: b[4], h: b[5], r: b[6], kind: 'b' });
});
FACILITIES.forEach(function (f) {
  ITEMS.push({ id: f[0], name: f[1], x: f[2], y: f[3], w: f[4] || 15, h: f[5] || 15, r: 0, kind: 'f', shape: f[4] === 'c' ? 'c' : 'r' });
});
ITEMS.forEach(function (i) { if (i.id === 'B') { i.w = 30; i.h = 30; } });

// Optional GPS: set the lat/lng of the map's top-left (nw) and bottom-right (se) corners to enable "Use GPS".
var GEO = null; // e.g. { nwLat: 0, nwLng: 0, seLat: 0, seLng: 0 }

/* ---- Building footprints for the 3D renderer: [x1,y1, x2,y2, x3,y3, x4,y4] ---- */
var BLDG = BUILDINGS.map(function (b) {
  var x = b[2], y = b[3], hw = Math.max(b[4], 11) / 2, hh = Math.max(b[5], 11) / 2, a = (b[6] || 0) * Math.PI / 180;
  var c = Math.cos(a), s = Math.sin(a), out = [];
  [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(function (p) {
    out.push(+(x + p[0] * c - p[1] * s).toFixed(2), +(y + p[0] * s + p[1] * c).toFixed(2));
  });
  return out;
});

/* ---- Footpath graph (auto-generated walkway network + doors) ----
   G.n: walkable nodes [x,y] · G.e: edges [i,j] · G.door: item id -> nearest node */
var G = (function () {
  var GROUND = [[322,100],[432,88],[505,58],[534,205],[567,300],[642,400],[642,464],[655,490],[388,490],[396,455],[330,215]];
  var TOP = [[500,40],[700,25],[710,75],[520,78]];
  function inPoly(x, y, p) {
    var c = false;
    for (var i = 0, j = p.length - 1; i < p.length; j = i++)
      if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
    return c;
  }
  var PAD = BLDG.map(function (p) {
    var cx = (p[0] + p[2] + p[4] + p[6]) / 4, cy = (p[1] + p[3] + p[5] + p[7]) / 4, pts = [];
    for (var i = 0; i < 8; i += 2) {
      var dx = p[i] - cx, dy = p[i + 1] - cy, d = Math.hypot(dx, dy) || 1;
      pts.push([cx + dx / d * (d + 2.5), cy + dy / d * (d + 2.5)]);
    }
    return pts;
  });
  function blocked(x, y) {
    for (var i = 0; i < PAD.length; i++) if (inPoly(x, y, PAD[i])) return true;
    return false;
  }
  function walkable(x, y) { return (inPoly(x, y, GROUND) || inPoly(x, y, TOP)) && !blocked(x, y); }
  function cross(ax, ay, bx, by, cx, cy, dx, dy) {
    function o(px, py, qx, qy, rx, ry) {
      var v = (qx - px) * (ry - py) - (qy - py) * (rx - px);
      return v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0;
    }
    return o(ax, ay, bx, by, cx, cy) !== o(ax, ay, bx, by, dx, dy) &&
           o(cx, cy, dx, dy, ax, ay) !== o(cx, cy, dx, dy, bx, by);
  }
  function segBlocked(ax, ay, bx, by) {
    for (var i = 0; i < PAD.length; i++)
      for (var k = 0; k < 4; k++) {
        var p1 = PAD[i][k], p2 = PAD[i][(k + 1) % 4];
        if (cross(ax, ay, bx, by, p1[0], p1[1], p2[0], p2[1])) return true;
      }
    return false;
  }
  var STEP = 15, X0 = 328, X1 = 706, Y0 = 22, Y1 = 494, n = [], at = {}, x, y;
  for (y = Y0; y <= Y1; y += STEP)
    for (x = X0; x <= X1; x += STEP)
      if (walkable(x, y)) { at[x + ',' + y] = n.length; n.push([x, y]); }
  var e = [], seen = {};
  function link(a, b) {
    if (a === undefined || b === undefined || a === b) return;
    var k = a < b ? a + '-' + b : b + '-' + a, A = n[a], B = n[b];
    if (seen[k] || segBlocked(A[0], A[1], B[0], B[1])) return;
    seen[k] = 1; e.push([a, b]);
  }
  for (y = Y0; y <= Y1; y += STEP)
    for (x = X0; x <= X1; x += STEP) {
      var i0 = at[x + ',' + y];
      if (i0 === undefined) continue;
      link(i0, at[(x + STEP) + ',' + y]);
      link(i0, at[x + ',' + (y + STEP)]);
      link(i0, at[(x + STEP) + ',' + (y + STEP)]);
      link(i0, at[(x + STEP) + ',' + (y - STEP)]);
    }
  var door = {};
  ITEMS.forEach(function (it) {
    var b = 0, bd = 1e9;
    for (var i = 0; i < n.length; i++) {
      var d = Math.hypot(n[i][0] - it.x, n[i][1] - it.y);
      if (d < bd) { bd = d; b = i; }
    }
    door[it.id] = b;
  });
  return { n: n, e: e, door: door };
})();
i.id
i.id
Alexander Vincent
var DEFAULT_ME = { id: 'F', x: 405, y: 422, name: 'Guard House (F)' };
var state = { me: DEFAULT_ME, sel: null, dest: null, picking: false, kind: 'all', mapRot: -30 };
var VB0 = [325, 18, 417, 470], vb = VB0.slice(), dragged = false;

try {
  var saved = JSON.parse(localStorage.getItem('tungo-me'));
  if (saved && saved.x) state.me = saved;
} catch (e) {}

function byId(id) { return ITEMS.find(function (i) { return i.id === id; }); }
function $(id) { return document.getElementById(id); }

/* ---------------- ROUTING (uses walkway graph G from mapdata.js) ---------------- */
var ADJ = null;
function initGraph() {
  ADJ = G.n.map(function () { return []; });
  G.e.forEach(function (e) {
    var d = Math.hypot(G.n[e[0]][0] - G.n[e[1]][0], G.n[e[0]][1] - G.n[e[1]][1]);
    ADJ[e[0]].push([e[1], d]); ADJ[e[1]].push([e[0], d]);
  });
}
function nodeFor(p) {
  if (p.id && G.door[p.id] !== undefined) return G.door[p.id];
  var b = 0, bd = 1e9;
  G.n.forEach(function (n, i) { var d = Math.hypot(n[0] - p.x, n[1] - p.y); if (d < bd) { bd = d; b = i; } });
  return b;
}
var routeMemo = { k: null, pts: null };
function findRoute(from, to) {
  var key = (from.id || from.x + ':' + from.y) + '>' + (to.id || to.x + ':' + to.y);
  if (routeMemo.k === key) return routeMemo.pts;
  var a = nodeFor(from), b = nodeFor(to), dist = {}, prev = {}, done = {}, q = [a];
  dist[a] = 0;
  while (q.length) {
    var bi = 0;
    q.forEach(function (v, i) { if (dist[v] < dist[q[bi]]) bi = i; });
    var u = q.splice(bi, 1)[0];
    if (done[u]) continue;
    done[u] = 1;
    if (u === b) break;
    ADJ[u].forEach(function (e) {
      var nd = dist[u] + e[1];
      if (dist[e[0]] === undefined || nd < dist[e[0]]) { dist[e[0]] = nd; prev[e[0]] = u; q.push(e[0]); }
    });
  }
  if (dist[b] === undefined) return null;
  var pts = [], k = b;
  while (k !== undefined) { pts.unshift(G.n[k]); k = prev[k]; }
  routeMemo = { k: key, pts: pts };
  return pts;
}

/* ---------------- 3D SCENE (shared by home overview AND full campus map) ---------------- */
var H3 = null;
function polyOf(b) { return [[b[0], b[1]], [b[2], b[3]], [b[4], b[5]], [b[6], b[7]]]; }
function pointIn(x, y, p) {
  var c = false;
  for (var i = 0, j = p.length - 1; i < p.length; j = i++)
    if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  return c;
}
function heights() {
  return H3 = H3 || BLDG.map(function (b) {
    var p = polyOf(b), a = 0;
    for (var i = 0; i < 4; i++) a += p[i][0] * p[(i + 1) % 4][1] - p[(i + 1) % 4][0] * p[i][1];
    return Math.min(30, 7 + Math.sqrt(Math.abs(a) / 2) / 2.2);
  });
}
function heightAt(x, y) {
  var hs = heights();
  for (var i = 0; i < BLDG.length; i++) if (pointIn(x, y, polyOf(BLDG[i]))) return hs[i];
  return 0;
}
function scene3D(deg, interactive) {
  var th = deg * Math.PI / 180, c = Math.cos(th), sn = Math.sin(th), K = .58, cx = 520, cy = 260;
  function P(x, y, z) { var dx = x - cx, dy = y - cy; return [cx + dx * c - dy * sn, cy + (dx * sn + dy * c) * K - (z || 0)]; }
  function str(a) { return a.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
  var campus = [[322,100],[432,88],[505,58],[534,205],[567,300],[642,400],[642,464],[655,490],[388,490],[396,455],[330,215]];
  var pond = [[500,40],[700,25],[710,75],[520,78]];
  var all = campus.concat(pond).map(function (p) { return P(p[0], p[1], 0); });
  var xs = all.map(function (p) { return p[0]; }), ys = all.map(function (p) { return p[1]; });
  var x0 = Math.min.apply(null, xs) - 14, y0 = Math.min.apply(null, ys) - 46;
  var vb = [x0, y0, Math.max.apply(null, xs) + 14 - x0, Math.max.apply(null, ys) + 26 - y0];
  var s = '';
  [campus, pond].forEach(function (g) {
    s += '<polygon points="' + str(g.map(function (p) { var q = P(p[0], p[1], 0); return [q[0], q[1] + 9]; })) + '" fill="#A9B39F"/>';
    s += '<polygon points="' + str(g.map(function (p) { return P(p[0], p[1], 0); })) + '" fill="#E6EFDD" stroke="#D3DEC8"/>';
  });
  var ell = [];
  for (var a = 0; a < 40; a++) ell.push(P(465 + 62 * Math.cos(a / 40 * 6.283), 312 + 88 * Math.sin(a / 40 * 6.283), 0));
  s += '<polygon points="' + str(ell) + '" fill="#C8E6B8" stroke="#fff" stroke-width="1.5"/>';
  [[[347,112],[374,330],[402,462]], [[392,481],[650,481]]].forEach(function (r) {
    var pp = str(r.map(function (p) { return P(p[0], p[1], 0); }));
    s += '<polyline points="' + pp + '" fill="none" stroke="#DADCE0" stroke-width="15" stroke-linecap="round"/><polyline points="' + pp + '" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round"/>';
  });
  [[[347,112],[374,330],'Notre Dame Avenue'], [[420,481],[640,481],'Quezon Avenue']].forEach(function (r) {
    var A = P(r[0][0], r[0][1], 0), B = P(r[1][0], r[1][1], 0);
    var ang = Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI;
    if (ang > 90 || ang < -90) ang += 180;
    var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    s += '<text x="' + mx.toFixed(1) + '" y="' + (my + 3).toFixed(1) + '" transform="rotate(' + ang.toFixed(1) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1) + ')" font-size="8.5" fill="#70757A" text-anchor="middle" letter-spacing="1">' + r[2] + '</text>';
  });
  var d = '';
  G.e.forEach(function (e) { var a = P(G.n[e[0]][0], G.n[e[0]][1], 0), b = P(G.n[e[1]][0], G.n[e[1]][1], 0); d += 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'L' + b[0].toFixed(1) + ' ' + b[1].toFixed(1); });
  s += '<path d="' + d + '" fill="none" stroke="#DFDBCB" stroke-width="3.4" stroke-linecap="round" opacity=".65"/><path d="' + d + '" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" opacity=".8"/>';
  var hs = heights(), order = BLDG.map(function (b, i) {
    var p = polyOf(b), mx = (p[0][0] + p[2][0]) / 2, my = (p[0][1] + p[2][1]) / 2;
    return { i: i, d: P(mx, my, 0)[1] };
  }).sort(function (a, b) { return a.d - b.d; });
  order.forEach(function (o) {
    var p = polyOf(BLDG[o.i]), h = hs[o.i], walls = [];
    for (var k = 0; k < 4; k++) {
      var A = p[k], B = p[(k + 1) % 4], a0 = P(A[0], A[1], 0), b0 = P(B[0], B[1], 0);
      walls.push({ d: (a0[1] + b0[1]) / 2, pts: [a0, b0, P(B[0], B[1], h), P(A[0], A[1], h)], f: (b0[0] - a0[0]) * (b0[1] - a0[1]) > 0 ? '#CFC8B7' : '#B9B19D' });
    }
    walls.sort(function (a, b) { return a.d - b.d; }).forEach(function (w) { s += '<polygon points="' + str(w.pts) + '" fill="' + w.f + '" stroke="#A89F8A" stroke-width=".6"/>'; });
    s += '<polygon points="' + str(p.map(function (q) { return P(q[0], q[1], h); })) + '" fill="#F4F0E6" stroke="#CFC8B7" stroke-width=".8"/>';
  });
  var dst = state.dest && byId(state.dest);
  if (dst && state.me) {
    var rt = findRoute(state.me, dst);
    if (rt) {
      var rp = str(rt.map(function (p) { return P(p[0], p[1], 1.5); }));
      s += '<polyline points="' + rp + '" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>';
      s += '<polyline points="' + rp + '" fill="none" stroke="#1A73E8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
    }
  }
  ITEMS.forEach(function (i) {
    var cls = 'it ' + i.kind + (state.sel === i.id ? ' sel' : '') + (state.dest === i.id ? ' dst' : '');
    if (i.kind === 'b') {
      var q = P(i.x, i.y, heightAt(i.x, i.y) + 1), fs = i.w < 14 || i.id.length > 2 ? 6.5 : 8.5;
      var t = '<text x="' + q[0].toFixed(1) + '" y="' + (q[1] + 3).toFixed(1) + '" font-size="' + fs + '" font-weight="700" text-anchor="middle" fill="#3C4043" stroke="#fff" stroke-width="2.2" paint-order="stroke">' + i.id + '</text>';
      s += interactive ? '<g class="' + cls + '" data-id="' + i.id + '"><circle class="hx" cx="' + q[0].toFixed(1) + '" cy="' + (q[1] - 2).toFixed(1) + '" r="' + (fs + 7) + '"/>' + t + '</g>' : t;
    } else {
      var g0 = P(i.x, i.y, 0), t2 = P(i.x, i.y, 13 + heightAt(i.x, i.y));
      var pin = '<line x1="' + g0[0].toFixed(1) + '" y1="' + g0[1].toFixed(1) + '" x2="' + t2[0].toFixed(1) + '" y2="' + t2[1].toFixed(1) + '" stroke="#8A8F94" stroke-width="1"/><circle cx="' + t2[0].toFixed(1) + '" cy="' + t2[1].toFixed(1) + '" r="7" fill="#E8710A" stroke="#fff" stroke-width="1.5"/><text x="' + t2[0].toFixed(1) + '" y="' + (t2[1] + 2.😎.toFixed(1) + '" font-size="7.5" font-weight="800" text-anchor="middle" fill="#fff">' + i.id + '</text>';
      s += interactive ? '<g class="' + cls + '" data-id="' + i.id + '"><circle class="hx" cx="' + t2[0].toFixed(1) + '" cy="' + t2[1].toFixed(1) + '" r="12"/>' + pin + '</g>' : pin;
    }
  });
  if (dst) {
    var dq = P(dst.x, dst.y, heightAt(dst.x, dst.y) + 2);
    s += '<circle cx="' + dq[0].toFixed(1) + '" cy="' + dq[1].toFixed(1) + '" r="4.5" fill="#EA4335" stroke="#fff" stroke-width="2" pointer-events="none"/>';
  }
  if (state.me) {
    var m = state.me, g = P(m.x, m.y, 0), top = P(m.x, m.y, heightAt(m.x, m.y) + 18);
    s += '<ellipse class="pulse" cx="' + g[0].toFixed(1) + '" cy="' + g[1].toFixed(1) + '" rx="10" ry="5.8"/>';
    s += '<line x1="' + g[0].toFixed(1) + '" y1="' + g[1].toFixed(1) + '" x2="' + top[0].toFixed(1) + '" y2="' + top[1].toFixed(1) + '" stroke="#1A73E8" stroke-width="2"/>';
    s += '<circle cx="' + top[0].toFixed(1) + '" cy="' + top[1].toFixed(1) + '" r="6" fill="#1A73E8" stroke="#fff" stroke-width="2"/>';
    s += '<rect x="' + (top[0] - 28).toFixed(1) + '" y="' + (top[1] - 24).toFixed(1) + '" width="56" height="14" rx="7" fill="#1A73E8"/><text x="' + top[0].toFixed(1) + '" y="' + (top[1] - 14).toFixed(1) + '" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">You are here</text>';
  }
  return { s: s, vb: vb };
}

/* ---------------- RENDER ---------------- */
function render3D() {
  var r = scene3D(+$('rot').value, false);
  $('homeMap').setAttribute('viewBox', r.vb.join(' '));
  $('homeMap').innerHTML = r.s;
}
function renderFull() {
  var r = scene3D(state.mapRot, true);
  $('fullMap').innerHTML = r.s;
  return r;
}
function fitMap(r) {
  VB0 = (r || scene3D(state.mapRot, true)).vb.slice();
  vb = VB0.slice();
  setView();
}
function mapRot(v) {
  state.mapRot = +v;
  fitMap(renderFull());
}
function render() {
  render3D();
  renderFull();
  $('hereName').textContent = state.me.name;
}

/* ---------------- MAP INTERACTION ---------------- */
function svgPoint(svg, e) {
  var p = svg.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}
/* screen (projected) point -> ground point, so "Set my location" works on the 3D map */
function unproject(sx, sy) {
  var th = state.mapRot * Math.PI / 180, c = Math.cos(th), sn = Math.sin(th), K = .58, cx = 520, cy = 260;
  var a = sx - cx, b = (sy - cy) / K;
  return [cx + a * c + b * sn, cy - a * sn + b * c];
}
function setView() { $('fullMap').setAttribute('viewBox', vb.join(' ')); }
function zoom(f) {
  var cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
  var w = Math.min(VB0[2], Math.max(120, vb[2] * f)), h = w * VB0[3] / VB0[2];
  vb = [Math.min(VB0[0] + VB0[2] - w, Math.max(VB0[0], cx - w / 2)), Math.min(VB0[1] + VB0[3] - h, Math.max(VB0[1], cy - h / 2)), w, h];
  setView();
}
function resetView() { vb = VB0.slice(); setView(); }

function initMap() {
  var svg = $('fullMap'), sx, sy, v0, down = false;
  svg.addEventListener('pointerdown', function (e) {
    down = true; dragged = false; sx = e.clientX; sy = e.clientY; v0 = vb.slice();
  });
  window.addEventListener('pointermove', function (e) {
    if (!down) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) dragged = true;
    if (!dragged || vb[2] >= VB0[2]) return;
    var k = vb[2] / svg.getBoundingClientRect().width;
    vb[0] = Math.min(VB0[0] + VB0[2] - vb[2], Math.max(VB0[0], v0[0] - dx * k));
    vb[1] = Math.min(VB0[1] + VB0[3] - vb[3], Math.max(VB0[1], v0[1] - dy * k));
    setView();
  });
  window.addEventListener('pointerup', function () { down = false; });
  svg.addEventListener('click', function (e) {
    if (dragged) return;
    var g = e.target.closest('.it');
    if (state.picking) {
      var it = g && byId(g.dataset.id);
      if (it) { setMe({ id: it.id, x: it.x, y: it.y, name: it.name + ' (' + it.id + ')' }); return; }
      var p = svgPoint(svg, e), q = unproject(p.x, p.y);
      setMe({ x: Math.round(q[0]), y: Math.round(q[1]), name: 'Pinned spot' });
      return;
    }
    if (g) selectItem(g.dataset.id);
  });
  $('homeMap').addEventListener('click', function () { go('map'); });
  if (GEO) $('gpsBtn').hidden = false;
}

function setMe(m) {
  state.me = m; state.picking = false;
  try { localStorage.setItem('tungo-me', JSON.stringify(m)); } catch (e) {}
  setHint();
  render();
  if (state.sel) showSheet(state.sel);
  toast('Location set: ' + m.name);
}
function startPick() {
  state.picking = true; setHint(); closeSheet();
}
function setHint() {
  var h = $('hint');
  h.className = 'hint' + (state.picking ? ' pick' : '');
  h.textContent = state.picking ? 'Tap the map where you are standing.' : 'Tap a building or facility for details.';
}
function useGPS() {
  if (!navigator.geolocation) return toast('GPS is not available');
  navigator.geolocation.getCurrentPosition(function (p) {
    var fx = (p.coords.longitude - GEO.nwLng) / (GEO.seLng - GEO.nwLng);
    var fy = (p.coords.latitude - GEO.nwLat) / (GEO.seLat - GEO.nwLat);
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return toast('You appear to be outside the campus');
    setMe({ x: Math.round(VB0[0] + fx * VB0[2]), y: Math.round(VB0[1] + fy * VB0[3]), name: 'GPS location' });
  }, function () { toast('Could not get your location'); });
}

/* ---------------- DETAILS ---------------- */
function direction(a, b) {
  var dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return 'You are right next to it.';
  var v = Math.abs(dy) > Math.abs(dx) * .4 ? (dy < 0 ? 'top' : 'bottom') : '';
  var h = Math.abs(dx) > Math.abs(dy) * .4 ? (dx < 0 ? 'left' : 'right') : '';
  return 'From ' + a.name + ', head toward the ' + [v, h].filter(Boolean).join('-') + ' of the map.';
}
function selectItem(id) {
  state.sel = id; render(); showSheet(id);
}
function showSheet(id) {
  var i = byId(id);
  $('sBadge').textContent = i.id;
  $('sBadge').style.borderRadius = i.kind === 'f' ? '50%' : '10px';
  $('sName').textContent = i.name;
  $('sMeta').textContent = i.kind === 'b' ? 'Building ' + i.id + ' on the campus directory' : 'Campus facility ' + i.id;
  $('sDir').textContent = direction(state.me, i);
  $('sGo').onclick = function () { state.dest = id; render(); closeSheet(); toast(findRoute(state.me, i) ? 'Route to ' + i.name : 'No walkable path to this spot on the map'); };
  $('sHere').onclick = function () { setMe({ id: i.id, x: i.x, y: i.y, name: i.name + ' (' + i.id + ')' }); };
  $('sheet').hidden = false;
}
function closeSheet() { $('sheet').hidden = true; state.sel = null; render(); }
function clearRoute() { state.dest = null; render(); }

/* ---------------- DIRECTORY ---------------- */
function setKind(k) {
  state.kind = k;
  document.querySelectorAll('#chips button').forEach(function (b) { b.classList.toggle('on', b.dataset.k === k); });
  renderList();
}
function renderList() {
  var q = $('q').value.toLowerCase().trim();
  var r = ITEMS.filter(function (i) {
    return (state.kind === 'all' || i.kind === state.kind) &&
      (!q || i.name.toLowerCase().indexOf(q) > -1 || i.id.toLowerCase() === q);
  });
  $('count').textContent = r.length ? r.length + ' result' + (r.length > 1 ? 's' : '') : 'No match. Try a shorter name, a number, or a letter.';
  $('list').innerHTML = r.map(function (i) {
    return '<div class="item" onclick="openOnMap(\'' + i.id + '\')"><div class="n ' + i.kind + '">' + i.id + '</div><div><b>' + i.name + '</b><small>' + (i.kind === 'b' ? 'Building ' : 'Facility ') + i.id + '</small></div></div>';
  }).join('');
}
function openOnMap(id) { go('map'); resetView(); selectItem(id); }
function goKind(k) { go('dir'); setKind(k); }
function initHome() {
  $('featured').innerHTML = ['20', '10', '14', '1'].map(function (id) {
    var i = byId(id);
    return '<div class="fcard" onclick="openOnMap(\'' + id + '\')"><div class="n">' + i.id + '</div><b>' + i.name + '</b><small>Building ' + i.id + '</small><span>View on map</span></div>';
  }).join('');
}
function heroGo() {
  $('q').value = $('heroQ').value.trim();
  go('dir');
}

/* ---------------- NAV ---------------- */
function go(p) {
  document.querySelectorAll('.page').forEach(function (e) { e.classList.toggle('on', e.id === 'pg-' + p); });
  document.querySelectorAll('nav a').forEach(function (a) { a.classList.toggle('on', a.dataset.p === p); });
  window.scrollTo(0, 0);
  if (p === 'dir') renderList();
  if (p !== 'map') { state.picking = false; setHint(); }
}
function toast(m) {
  var t = $('toast'); t.textContent = m; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2400);
}

document.addEventListener('DOMContentLoaded', function () {
  ['logo', 'heroLogo'].forEach(function (id) {
    $(id).innerHTML = '<img src="image/ndmc-logo.png" alt="NDMC seal" onerror="this.parentNode.textContent=\'NDMC\'">';
  });
  initGraph(); initMap(); initHome();
  render();
  fitMap();
  go('home');
});
state.me
state.me
Alexander Vincent
:root{--bg:#0E2418;--bg2:#143222;--line:#244B35;--fg:#F3F1E4;--mut:#9FB8A6;--gold:#E2B84A;--paper:#F1F8A8;--red:#B52626;--me:#1D6FF2}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--fg);min-height:100vh;line-height:1.5}
.top{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;padding:10px 20px;background:rgba(14,36,24,.94);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:12px;cursor:pointer}
.brand b{font-family:Fraunces,serif;font-size:22px;color:var(--gold);letter-spacing:.02em;display:block;line-height:1}
.brand small{font-size:11px;color:var(--mut)}
.logo{width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid var(--gold);display:grid;place-items:center;font-size:10px;font-weight:700;color:var(--gold)}
.logo img{width:100%;height:100%;object-fit:contain}
nav{display:flex;gap:6px}
nav a{padding:8px 14px;border-radius:999px;font-size:14px;color:var(--mut);cursor:pointer}
nav a.on{background:var(--gold);color:#1B1604;font-weight:700}
main{max-width:1080px;margin:0 auto;padding:20px}
.page{display:none}.page.on{display:block}
.hero{padding:34px 0 22px}
.kicker{color:var(--mut);font-size:13px;margin-bottom:10px}
h1{font-family:Fraunces,serif;font-weight:800;font-size:clamp(34px,6vw,60px);line-height:1.02;max-width:12em;margin-bottom:22px}
.searchbar{display:flex;gap:8px;max-width:640px}
input.field,.searchbar input{flex:1;width:100%;background:var(--bg2);border:1.5px solid var(--line);color:var(--fg);border-radius:12px;padding:13px 16px;font:inherit}
input:focus{outline:2px solid var(--gold);outline-offset:1px}
.btn{background:var(--gold);color:#1B1604;border:0;border-radius:12px;padding:11px 18px;font:inherit;font-weight:700;cursor:pointer}
.btn.ghost{background:transparent;color:var(--fg);border:1.5px solid var(--line);font-weight:500;padding:9px 14px}
.btn:hover{filter:brightness(1.08)}.btn.ghost:hover{border-color:var(--gold);color:var(--gold)}
.here-line{margin-top:14px;font-size:14px;color:var(--mut)}
.here-line b{color:#7FB2FF}.here-line a{color:var(--gold);cursor:pointer;margin-left:8px;text-decoration:underline}
.mapcard{background:var(--bg2);border:1px solid var(--line);border-radius:18px;padding:12px;position:relative}
.mapcard-h{display:flex;justify-content:space-between;align-items:center;margin:0 4px 10px}
.mapcard h2{font-family:Fraunces,serif;font-size:20px}
svg{width:100%;height:auto;display:block;border-radius:12px;background:#E3EE8E;touch-action:none}
.stats{display:flex;gap:14px;margin-top:16px}
.stats div{flex:1;border:1px solid var(--line);border-radius:14px;padding:14px 18px}
.stats b{font-family:Fraunces,serif;font-size:32px;color:var(--gold);display:block;line-height:1.1}
.stats span{font-size:13px;color:var(--mut)}
.ptitle{font-family:Fraunces,serif;font-size:28px;margin-bottom:14px}
.chips{display:flex;gap:8px;margin:12px 0;flex-wrap:wrap}
.chips button{border:1.5px solid var(--line);background:none;color:var(--mut);padding:7px 14px;border-radius:999px;font:inherit;font-size:13px;cursor:pointer}
.chips button.on{background:var(--gold);border-color:var(--gold);color:#1B1604;font-weight:700}
.count{font-size:13px;color:var(--mut);margin-bottom:10px}
.list{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.item{display:flex;gap:12px;align-items:center;padding:12px;background:var(--bg2);border:1px solid var(--line);border-radius:14px;cursor:pointer}
.item:hover{border-color:var(--gold)}
.badge,.item .n{min-width:44px;height:44px;border-radius:10px;display:grid;place-items:center;font-weight:800;background:var(--paper);color:var(--red);border:2px solid #6C7D3E;font-size:15px}
.item .n.f{border-radius:50%}
.item small{color:var(--mut);display:block;font-size:12px}
.maphead{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:8px}
.tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.hint{font-size:13px;color:var(--mut);margin-bottom:10px}
.hint.pick{color:#1B1604;background:var(--gold);padding:8px 12px;border-radius:10px;font-weight:700}
.zoom{position:absolute;right:22px;top:22px;z-index:5;display:grid;gap:6px}
.zoom button{width:36px;height:36px;border-radius:10px;border:1px solid #6C7D3E;background:#FFFEF0;color:#1B2E10;font-size:18px;cursor:pointer}
.legend{display:flex;gap:16px;flex-wrap:wrap;padding:10px 4px 2px;font-size:12px;color:var(--mut)}
.legend span{display:flex;align-items:center;gap:6px}
.lg{width:14px;height:14px;display:inline-block;border:1.5px solid #6C7D3E;background:var(--paper)}
.lg-f{border-radius:50%}.lg-me{background:var(--me);border-radius:50%;border-color:#fff}
.it{cursor:pointer}.it rect,.it circle{fill:#FFFEF0;stroke:#6C7D3E;stroke-width:1}
.it text{fill:var(--red);font-weight:800;text-anchor:middle;pointer-events:none;font-family:'DM Sans',sans-serif}
.it:hover rect,.it:hover circle{fill:#FFF3B0}
.it.sel rect,.it.sel circle{fill:var(--gold);stroke:#7A5A00;stroke-width:2}
.it.dst rect,.it.dst circle{stroke:var(--red);stroke-width:2.2}
.route{fill:none;stroke:var(--me);stroke-width:3;stroke-linecap:round;stroke-dasharray:7 5;animation:dash .8s linear infinite}
@keyframes dash{to{stroke-dashoffset:-12}}
.pulse{fill:var(--me);opacity:.3;transform-box:fill-box;transform-origin:center;animation:pl 1.8s ease-out infinite}
@keyframes pl{0%{transform:scale(.6);opacity:.5}100%{transform:scale(2.4);opacity:0}}
.sheet{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);width:min(560px,calc(100% - 24px));z-index:30;background:var(--bg);border:1.5px solid var(--gold);border-radius:18px;padding:16px;display:flex;gap:14px;box-shadow:0 18px 50px rgba(0,0,0,.55)}
.sheet[hidden]{display:none}
.sheet .badge{flex-shrink:0;width:54px;height:54px;font-size:19px}
.sheet h3{font-family:Fraunces,serif;font-size:19px;padding-right:26px}
.sheet p{font-size:13px;color:var(--mut)}
.sheet .row{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.sheet .btn{padding:8px 14px;font-size:13px}
.x{position:absolute;right:12px;top:8px;background:none;border:0;color:var(--mut);font-size:24px;cursor:pointer}
.toast{position:fixed;top:70px;right:16px;background:var(--gold);color:#1B1604;padding:10px 16px;border-radius:12px;font-weight:700;font-size:13px;transform:translateX(150%);transition:transform .3s;z-index:50}
.toast.on{transform:none}
@media(max-width:640px){main{padding:14px}.stats{flex-direction:column}nav a{padding:7px 10px;font-size:13px}.brand small{display:none}}
@media(prefers-reduced-motion:reduce){.route,.pulse{animation:none}}
/* ---- v3: home like original + photo map ---- */
body{background:radial-gradient(ellipse 800px 500px at 12% 6%,rgba(27,94,32,.35),transparent),#061A0B}
.it rect,.it circle{fill:rgba(255,255,255,.01);stroke:none}
.it:hover rect,.it:hover circle{fill:rgba(226,184,74,.35);stroke:#B8860B;stroke-width:1.2}
.it.sel rect,.it.sel circle{fill:rgba(226,184,74,.5);stroke:#7A5A00;stroke-width:2}
.it.dst rect,.it.dst circle{stroke:var(--red);stroke-width:2.2}
svg{background:#F1F8A8}
.hero2{text-align:center;padding:26px 0 8px}
.seal{width:116px;height:116px;border-radius:50%;overflow:hidden;margin:0 auto 22px;border:2px solid rgba(226,184,74,.45);box-shadow:0 0 40px rgba(226,184,74,.12);display:grid;place-items:center;color:var(--gold);font-weight:700}
.seal img{width:100%;height:100%;object-fit:contain}
.pill{display:inline-block;border:1px solid rgba(226,184,74,.35);background:rgba(226,184,74,.06);color:var(--gold);font-size:11px;font-weight:700;letter-spacing:.08em;padding:6px 16px;border-radius:999px;margin-bottom:18px}
h1.tg{font-family:'Playfair Display',serif;font-weight:900;font-size:clamp(64px,13vw,112px);line-height:.95;max-width:none;margin:0 0 12px;background:linear-gradient(90deg,#E8D9A0,#fff,#E8D9A0);background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:sh 4s linear infinite}
@keyframes sh{to{background-position:200% 0}}
.sub{font-size:20px;color:#81C784;font-weight:300}
.tagline{font-size:14px;color:rgba(76,175,80,.7);font-style:italic;margin:4px 0 26px}
.hsearch{display:flex;gap:8px;max-width:640px;margin:0 auto 26px;background:rgba(12,38,20,.85);border:1.5px solid var(--line);border-radius:16px;padding:6px}
.hsearch input{flex:1;background:none;border:0;color:var(--fg);font:inherit;padding:10px 14px}
.hsearch input:focus{outline:none}
.cats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;max-width:640px;margin:0 auto}
.cat{background:rgba(12,38,20,.9);border:1px solid var(--line);border-radius:16px;padding:18px 8px;cursor:pointer;transition:.2s}
.cat:hover{transform:translateY(-3px);border-color:rgba(226,184,74,.4)}
.cat i{font-style:normal;display:grid;place-items:center;width:42px;height:42px;margin:0 auto 8px;border-radius:12px;background:rgba(226,184,74,.1);border:1px solid rgba(226,184,74,.25);color:var(--gold);font-weight:800}
.cat b{display:block;font-size:14px}.cat small{font-size:11px;color:var(--mut)}
.stats4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:34px 0}
.stats4 div{background:rgba(12,38,20,.7);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center}
.stats4 small{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.stats4 b{font-size:24px;color:var(--gold)}.stats4 div:nth-child(n+2) b{color:#A5D6A7}
.sec{margin-bottom:12px}
.fscroll{display:flex;gap:14px;overflow-x:auto;padding-bottom:8px}
.fcard{min-width:240px;background:rgba(12,38,20,.9);border:1px solid var(--line);border-radius:16px;padding:16px;cursor:pointer}
.fcard:hover{border-color:rgba(226,184,74,.4)}
.fcard .n{width:42px;height:42px;border-radius:10px;display:grid;place-items:center;font-weight:800;background:rgba(226,184,74,.1);border:1px solid rgba(226,184,74,.25);color:var(--gold);margin-bottom:10px}
.fcard b{display:block}.fcard small{display:block;color:var(--mut);font-size:12px;margin-bottom:8px}
.fcard span{color:var(--gold);font-size:12px;font-weight:700}
@media(max-width:640px){.cats,.stats4{grid-template-columns:repeat(2,1fr)}}
/* ---- v4: visible icons (labels hide only when the photo is loaded) ---- */
.it rect,.it circle{fill:#FFFEF0;stroke:#6C7D3E;stroke-width:1}
.it text{fill:#B52626;font-weight:800;text-anchor:middle;pointer-events:none;font-family:'DM Sans',sans-serif}
.hasphoto .it rect,.hasphoto .it circle{fill:rgba(255,255,255,.01);stroke:none}
.hasphoto .it text{display:none}
.it:hover rect,.it:hover circle{fill:#FFF3B0;stroke:#B8860B;stroke-width:1.2}
.it.sel rect,.it.sel circle{fill:#E2B84A;stroke:#7A5A00;stroke-width:2}
.hasphoto .it:hover rect,.hasphoto .it:hover circle{fill:rgba(226,184,74,.35)}
.hasphoto .it.sel rect,.hasphoto .it.sel circle{fill:rgba(226,184,74,.5)}
.it.dst rect,.it.dst circle{stroke:#B52626;stroke-width:2.2}
/* ---- v5: Google-Maps style vector map ---- */
svg{background:#F1EFE9}
svg .it.b rect{fill:transparent;stroke:none}
svg .it.b text{display:block;fill:#3C4043;font-weight:700;paint-order:stroke;stroke:#fff;stroke-width:2.2px;stroke-linejoin:round}
svg .it.b:hover rect{fill:rgba(26,115,232,.15)}
svg .it.b.sel rect{fill:rgba(251,188,4,.55);stroke:#B06000;stroke-width:1.5}
svg .it.f circle{fill:#E8710A;stroke:#fff;stroke-width:1.6}
svg .it.f text{display:block;fill:#fff;font-weight:800}
svg .it.f:hover circle{fill:#C25E00}
svg .it.f.sel circle{fill:#1A73E8;stroke:#fff;stroke-width:2.2}
svg .it.dst rect,svg .it.dst circle{stroke:#EA4335;stroke-width:2.2}
.rc{fill:none;stroke:#fff;stroke-width:8;stroke-linecap:round;stroke-linejoin:round}
.rt{fill:none;stroke:#1A73E8;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
.legend .lg-b{background:#E4DFD3}.legend .lg-f{background:#E8710A;border-color:#fff}
/* ---- v6: 3D overview ---- */
#homeMap{background:linear-gradient(#DCE8F2,#F1EFE9 55%);max-height:560px;cursor:pointer}
.rot{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--mut);margin-left:auto;margin-right:10px}
.rot input{width:110px;accent-color:var(--gold)}
.mapcard-h{gap:8px;flex-wrap:wrap}
/* ---- v7: full campus map rendered in 3D + always-visible markers ---- */
#fullMap{background:linear-gradient(#DCE8F2,#F1EFE9 55%);cursor:grab}
#fullMap:active{cursor:grabbing}
#fullMap circle.hx{fill:none;stroke:none;pointer-events:all}
svg text{user-select:none;-webkit-user-select:none}
svg .it.b:hover text{fill:#1967D2}
svg .it.b.sel text{fill:#1967D2}
svg .it.b.dst text{fill:#EA4335}
