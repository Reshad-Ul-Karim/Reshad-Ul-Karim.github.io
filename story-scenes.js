/* =========================================================================
   story-scenes.js: one abstract scene per project for story.js.

   Each scene is draw(k, p, t) on a 1000 x 625 canvas. Beats follow the page's
   story list in order: the documented pipeline steps, then the outcome, then
   any second case (a refusal, another mode, another role). k.b(i) is how far
   the story has arrived at beat i (0..1); k.only(i) is beat i alone.
   Visuals are schematic: they show how each system works, not results.
   ========================================================================= */
(function () {
  'use strict';
  var S = {};
  var TAU = Math.PI * 2;

  /* Assistive vision agent: safety, cheapest tool, evidence, speak / ask. */
  S.lumenaa = function (k) {
    var blocked = k.only(5); var last = k.b(6);
    var fx = 60; var fy = 70; var fw = 470; var fh = 360;
    k.glass(fx, fy, fw, fh, 30, { glow: blocked > 0.5 ? k.warn : k.hl, glowA: 0.5 });
    k.glyph('camera', fx + 34, fy + 32, 26, { color: k.ink2 });
    // the photo: a carton with a readable label
    k.alpha(1 - last * 0.75, function () {
      k.glass(fx + 160, fy + 80, 150, 210, 22, { tint: k.decor, glow: k.decor, glowA: 0.6 });
      k.text('OAT MILK', fx + 235, fy + 165, { size: 22, weight: 800, align: 'center' });
      k.text('1 litre', fx + 235, fy + 195, { size: 15, color: k.ink2, align: 'center' });
    });
    var scan = k.only(1) + k.only(5) * 0.6;
    if (scan > 0.01) { var sy = fy + 80 + ((k.t * 0.7) % 1) * 210; k.line([[fx + 140, sy], [fx + 330, sy]], { color: k.hl, width: 3, alpha: scan }); }
    // a hand blocks the view in the second case
    k.alpha(blocked, function () {
      var c = k.c; c.save(); c.filter = 'blur(10px)'; c.fillStyle = 'rgba(40,30,28,0.85)';
      c.beginPath(); c.ellipse(fx + 250, fy + 200, 150, 120, -0.4, 0, TAU); c.fill(); c.restore();
    });
    // earlier sightings for the "where was it" case
    for (var i = 0; i < 3; i++) {
      var tx = fx + 30 + i * 150; var on = i === 1;
      k.glass(tx, fy + 250 - last * 10, 120, 80, 14, { alpha: last, glow: on ? k.hl : null });
      k.text(['Desk', 'Kitchen shelf', 'Hallway'][i], tx + 60, fy + 290 - last * 10, { size: 13, align: 'center', alpha: last, color: on ? k.ink : k.ink2 });
      if (on) k.glyph('pin', tx + 60, fy + 235, 26, { color: k.hl, alpha: last });
    }
    // safety rules wrap everything first
    var safe = k.b(0);
    k.line([[fx - 14, fy - 14], [fx + fw + 14, fy - 14], [fx + fw + 14, fy + fh + 14], [fx - 14, fy + fh + 14]], { close: true, color: k.hl, width: 1.6, dash: [8, 10], offset: -k.t * 20, alpha: 0.6 * safe });
    k.tile('shield', fx + fw + 14, fy - 14, 46, { on: k.only(0) + 0.3, alpha: safe });
    // tools, cheapest first; the cloud model stays dark unless needed
    var tools = [['doc', 'Read text'], ['eye', 'Detect'], ['layers', 'Depth'], ['cloud', 'Cloud model']];
    tools.forEach(function (tl, j) {
      var lit = j === 0 ? k.b(1) * (1 - blocked * 0.6) : (j < 3 ? blocked * 0.55 : 0);
      if (last > 0.5 && j === 1) lit = last;
      k.tile(tl[0], 620 + j * 95, 110, 58, { on: lit, alpha: 0.35 + 0.65 * k.b(1), label: tl[1], color: j === 3 ? k.cool : k.hl, labelSize: 12 });
    });
    if (k.b(1) > 0.05) k.flow(530, 250, 620, 150, { amount: k.b(1), color: k.hl });
    // evidence gauge with a risk threshold
    var ev = k.b(2); var conf = k.lerp(0.86, 0.34, blocked) * ev;
    var gc = blocked > 0.5 ? k.warn : k.hl;
    k.ring(700, 330, 62, conf, { color: gc, alpha: ev, width: 10 });
    var th = -Math.PI / 2 + TAU * 0.7;
    k.line([[700 + Math.cos(th) * 48, 330 + Math.sin(th) * 48], [700 + Math.cos(th) * 78, 330 + Math.sin(th) * 78]], { color: k.ink, width: 3, alpha: ev });
    k.text(Math.round(conf * 100) + '%', 700, 330, { size: 26, weight: 800, align: 'center', alpha: ev });
    k.text('likely right', 700, 410, { size: 13, color: k.ink2, align: 'center', alpha: ev });
    k.text('speak only above the line', 860, 330, { size: 13, color: k.ink2, align: 'center', alpha: ev });
    // the spoken answer
    var say = k.b(3) * (1 - blocked) * (1 - last);
    k.tile('speaker', 640, 520, 52, { on: Math.max(say, blocked, last) });
    k.bubble(690, 480, 270, 64, '“Oat milk, one litre.”', { alpha: say });
    k.bubble(690, 480, 270, 64, '“Move the camera left.”', { alpha: blocked, color: k.warn });
    k.bubble(690, 480, 270, 64, '“Last seen: kitchen shelf.”', { alpha: last });
    k.text('On device · cloud not called', 295, 470, { size: 15, weight: 600, color: k.hl, align: 'center', alpha: k.only(4) });
  };

  /* Hierarchical RoPE: a token's position split into chunk + offset rotations. */
  S['harp-rope'] = function (k) {
    var std = k.b(5) ; var N = 48; var x0 = 70; var w = 860; var cell = w / N; var y = 90;
    var tok = 29; var chunk = 8;
    for (var i = 0; i < N; i++) {
      var inChunk = Math.floor(i / chunk) === Math.floor(tok / chunk);
      var lit = i === tok ? 1 : (inChunk ? k.b(1) * 0.5 * (1 - std) : 0);
      k.dot(x0 + i * cell + cell / 2, y, i === tok ? 7 : 4, i === tok ? k.hl : (lit ? k.decor : k.ink2), i === tok ? 1 : 0.35 + lit, i === tok ? 14 : 0);
    }
    k.text('position ' + tok + ' of a long context', x0 + tok * cell, y - 28, { size: 14, align: 'center', color: k.ink2 });
    // chunk brackets
    var cb = k.b(1) * (1 - std);
    for (var c = 0; c < N / chunk; c++) {
      var cx = x0 + c * chunk * cell; var on = c === Math.floor(tok / chunk);
      k.line([[cx + 4, y + 18], [cx + 4, y + 26], [cx + chunk * cell - 4, y + 26], [cx + chunk * cell - 4, y + 18]], { color: on ? k.decor : k.ink2, width: on ? 2.5 : 1.2, alpha: cb });
      k.text('chunk ' + c, cx + chunk * cell / 2, y + 44, { size: 12, align: 'center', color: on ? k.decor : k.ink2, alpha: cb });
    }
    var off = k.b(2) * (1 - std);
    k.text('offset ' + (tok % chunk) + ' inside chunk ' + Math.floor(tok / chunk), x0 + tok * cell, y + 70, { size: 14, weight: 600, align: 'center', color: k.hl, alpha: off });
    // two dials: slow phase (chunk) and fast phase (offset), combined
    var rot = k.b(3);
    function dial(x, yy, r, ang, col, label, a) {
      k.glass(x - r - 24, yy - r - 24, (r + 24) * 2, (r + 24) * 2, 40, { alpha: a });
      k.ring(x, yy, r, 0, { alpha: a, width: 2 });
      k.line([[x, yy], [x + Math.cos(ang) * r, yy + Math.sin(ang) * r]], { color: col, width: 4, alpha: a });
      k.dot(x + Math.cos(ang) * r, yy + Math.sin(ang) * r, 7, col, a, 14);
      k.text(label, x, yy + r + 44, { size: 14, color: k.ink2, align: 'center', alpha: a });
    }
    var slow = -Math.PI / 2 + (tok / chunk) * 0.55 * rot + k.t * 0.05;
    var fast = -Math.PI / 2 + (tok % chunk) * 0.9 * rot + k.t * 0.2;
    dial(250, 360, 80, slow, k.decor, 'chunk phase (slow)', k.b(1) * (1 - std));
    dial(500, 360, 80, fast, k.hl, 'offset phase (fast)', off);
    var comb = rot * (1 - std);
    k.text('=', 375, 360, { size: 34, align: 'center', color: k.ink2, alpha: comb }); k.text('+', 375, 360, { size: 34, align: 'center', color: k.ink2, alpha: 0 });
    // combined: a nested spiral where every position keeps its own place
    k.alpha(comb, function () {
      for (var j = 0; j < 64; j++) {
        var a1 = -Math.PI / 2 + (j / chunk) * 0.55 + k.t * 0.05; var a2 = (j % chunk) * 0.9;
        var r = 40 + (j % chunk) * 9; var px = 790 + Math.cos(a1) * 70 + Math.cos(a1 + a2) * r * 0.45; var py = 360 + Math.sin(a1) * 70 + Math.sin(a1 + a2) * r * 0.45;
        k.dot(px, py, j === tok ? 7 : 3, j === tok ? k.hl : k.decor, j === tok ? 1 : 0.55, j === tok ? 12 : 0);
      }
    });
    k.text('every position stays distinct', 790, 500, { size: 14, color: k.ink2, align: 'center', alpha: comb });
    k.text('schematic of the idea · exact formulas stay in the research', 500, 585, { size: 13, color: k.ink2, align: 'center', alpha: k.only(4) });
    // baseline: one phase schedule for everything
    k.alpha(std, function () {
      k.glass(170, 230, 660, 300, 30, {});
      k.ring(360, 380, 90, 0, { width: 2 });
      for (var j = 0; j < 48; j++) { var a = -Math.PI / 2 + j * 0.42; k.dot(360 + Math.cos(a) * 90, 380 + Math.sin(a) * 90, j === tok ? 7 : 3.5, j === tok ? k.hl : k.ink2, j === tok ? 1 : 0.6); }
      k.text('Standard RoPE', 560, 330, { size: 22, weight: 700 });
      k.text('one rotation schedule for every position;', 560, 365, { size: 15, color: k.ink2 });
      k.text('far-apart positions drift onto similar angles', 560, 390, { size: 15, color: k.ink2 });
    });
  };

  /* Bangla maths RL: a small model climbs a staged curriculum. */
  S.juktillm = function (k) {
    var steps = 4; var bx = 90; var by = 520; var sw = 170; var sh = 80;
    for (var i = 0; i < steps; i++) {
      var a = i < 2 ? k.b(i) : (i === 2 ? k.b(1) : k.b(2));
      k.glass(bx + i * sw, by - (i + 1) * sh, sw - 12, (i + 1) * sh, 18, { alpha: 0.4 + 0.6 * a, glow: i <= Math.round(k.p) ? k.hl : null, glowA: 0.4 });
      k.text(['১ + ২', '১২ × ৪', '(৩৬ ÷ ৬) + ৭', 'word problems'][i], bx + i * sw + (sw - 12) / 2, by - (i + 1) * sh + 30, { size: 17, weight: 700, align: 'center', alpha: 0.4 + 0.6 * a });
      k.text(['simpler', 'harder', 'multi-step', 'reasoning'][i], bx + i * sw + (sw - 12) / 2, by - (i + 1) * sh + 56, { size: 12, color: k.ink2, align: 'center', alpha: 0.4 + 0.6 * a });
    }
    // the learner climbs
    var lvl = Math.min(3.2, k.p * 1.0); var lx = bx + 75 + lvl * sw; var ly = by - (Math.floor(Math.min(lvl, 3)) + 1) * sh - 40 + Math.sin(k.t * 3) * 4;
    k.tile('chip', lx, ly, 54, { on: 1, label: 'small model' });
    // reward sparks after each success
    for (var j = 0; j < 6; j++) { var ang = k.t * 1.5 + j; k.dot(lx + Math.cos(ang) * 46, ly + Math.sin(ang) * 30, 2.5, k.decor, 0.5 + 0.5 * Math.sin(k.t * 4 + j)); }
    // reasoning chain in Bangla
    var r = k.b(2);
    ['ধাপ ১: ৩৬ ÷ ৬ = ৬', 'ধাপ ২: ৬ + ৭ = ১৩', 'উত্তর: ১৩'].forEach(function (s, i) {
      var a = k.seg(1.6 + i * 0.25, 2 + i * 0.25);
      k.glass(720, 90 + i * 66, 230, 52, 16, { alpha: a, glow: i === 2 ? k.hl : null });
      k.text(s, 835, 116 + i * 66, { size: 17, weight: i === 2 ? 800 : 600, align: 'center', alpha: a });
    });
    k.text('reasoning in Bangla, step by step', 835, 300, { size: 13, color: k.ink2, align: 'center', alpha: r });
    // evaluation
    var ev = k.b(3);
    k.bars(740, 340, 200, 120, [0.32, 0.5, 0.66, 0.78], { grow: ev, alpha: ev, labels: ['1', '2', '3', '4'] });
    k.text('accuracy by stage (schematic)', 840, 495, { size: 12, color: k.ink2, align: 'center', alpha: ev });
  };

  /* Paraphrase geometry: refine one embedding with its paraphrase cloud. */
  S['paraphrase-geometry'] = function (k) {
    var cx = 380; var cy = 320;
    k.glass(60, 60, 640, 500, 30, { alpha: 0.9 });
    k.text('embedding space', 90, 92, { size: 13, color: k.ink2 });
    var r = k.rnd(5); var docs = [];
    for (var i = 0; i < 26; i++) docs.push([110 + r() * 560, 120 + r() * 400]);
    var proj = k.b(3); var ret = k.b(4);
    docs.forEach(function (d, i) { k.dot(d[0], d[1], 4, k.ink2, 0.35); });
    // the sentence and its paraphrases
    var para = k.b(1); var ang = -0.5; var ux = Math.cos(ang); var uy = Math.sin(ang);
    var pts = [];
    var rr = k.rnd(11);
    for (var j = 0; j < 9; j++) { var along = (rr() - 0.5) * 220; var across = (rr() - 0.5) * 90; pts.push([along, across]); }
    pts.forEach(function (q) {
      var across = q[1] * (1 - proj);
      var x = cx + (q[0] * ux - across * uy) * para; var y = cy + (q[0] * uy + across * ux) * para;
      k.dot(x, y, 6, k.decor, para, 10);
      if (proj > 0.05) k.line([[cx + q[0] * ux * para - q[1] * uy, cy + q[0] * uy * para + q[1] * ux], [x, y]], { color: k.decor, width: 1, alpha: 0.4 * proj * (1 - k.gone(3)) });
    });
    // local geometry: principal axis and spread
    var geo = k.b(2) * (1 - k.gone(3) * 0.6);
    k.alpha(geo, function () {
      var c = k.c; c.save(); c.translate(cx, cy); c.rotate(ang); c.strokeStyle = k.a(k.hl, 0.6); c.setLineDash([6, 8]); c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(0, 0, 150, 55 * (1 - proj * 0.7), 0, 0, TAU); c.stroke(); c.restore();
    });
    k.line([[cx - ux * 190, cy - uy * 190], [cx + ux * 190, cy + uy * 190]], { color: k.hl, width: 2, alpha: k.b(2) });
    k.text('meaning direction', cx + ux * 200, cy + uy * 200 - 16, { size: 13, color: k.hl, alpha: k.b(2) });
    // the refined point
    var qx = cx + 20 * ux * proj; var qy = cy + 20 * uy * proj;
    k.dot(cx, cy, 9, k.ink, 1 - proj * 0.5, 0);
    k.dot(qx, qy, 10, k.hl, 0.3 + proj * 0.7, 16);
    k.text(proj > 0.5 ? 'refined' : 'sentence', qx, qy + 26, { size: 13, align: 'center', weight: 600 });
    // retrieval: nearest neighbours in the refined space
    var nn = [docs[3], docs[9], docs[17]];
    nn.forEach(function (d, i) { k.flow(qx, qy, d[0], d[1], { amount: k.seg(3.3 + i * 0.2, 3.9 + i * 0.2), color: i === 0 ? k.hl : k.ink2, count: 2 }); });
    k.dot(nn[0][0], nn[0][1], 8, k.hl, ret, 14);
    // right column: the closed-form step
    var cf = k.b(3);
    k.glass(740, 120, 210, 150, 22, { alpha: cf, glow: k.hl, glowA: 0.6 });
    k.text('closed-form', 845, 165, { size: 15, weight: 700, align: 'center', alpha: cf });
    k.text('projection', 845, 190, { size: 15, weight: 700, align: 'center', alpha: cf });
    k.text('no training step', 845, 230, { size: 13, color: k.ink2, align: 'center', alpha: cf });
    k.tile('check', 845, 360, 64, { on: k.b(5), alpha: k.b(5), label: 'no fine-tuning' });
  };

  /* CAMDet: different cameras, one metric 3D answer. */
  S.camdet = function (k) {
    var gx = 600; var gy = 380;
    // ground grid in fake perspective
    for (var i = -6; i <= 6; i++) k.line([[gx + i * 40, gy - 40], [gx + i * 70, gy + 180]], { color: k.ink2, width: 1, alpha: 0.2 });
    for (var j = 0; j < 6; j++) { var yy = gy - 40 + j * 44; var s = 1 + j * 0.15; k.line([[gx - 240 * s, yy], [gx + 240 * s, yy]], { color: k.ink2, width: 1, alpha: 0.2 }); }
    // three cameras with different lenses
    var cams = [[110, 140, 0.35, 'wide lens'], [110, 320, 0.2, 'standard'], [110, 500, 0.1, 'telephoto']];
    var norm = k.b(1);
    cams.forEach(function (c, i) {
      var fov = k.lerp(c[2], 0.22, norm); var on = 1;
      k.tile('camera', c[0], c[1], 54, { on: 0.4 + 0.6 * k.b(0), label: c[3] });
      k.line([[c[0] + 30, c[1]], [520, c[1] - 260 * fov], [520, c[1] + 260 * fov]], { close: true, color: [k.hl, k.decor, k.cool][i], width: 1.4, alpha: 0.5, fill: k.a([k.hl, k.decor, k.cool][i], 0.06) });
    });
    k.text('same weights for every camera', 300, 40, { size: 15, weight: 600, color: k.hl, align: 'center', alpha: norm });
    // depth rays to the object
    var dep = k.b(2);
    k.flow(150, 320, 560, 340, { amount: dep, color: k.decor });
    k.text('12.4 m', 360, 316, { size: 15, weight: 700, color: k.decor, align: 'center', alpha: dep });
    // the object: 2D box first, then a 3D box that agrees across cameras
    var b3 = k.b(3);
    k.bbox(530, 290, 150, 100, { alpha: (1 - b3) * k.b(0), label: 'car' });
    k.alpha(b3, function () {
      var x = 540; var y = 300; var w = 140; var h = 70; var d = 50;
      var jitter = (1 - k.b(3)) * 10;
      var f = [[x, y + d * 0.4], [x + w, y + d * 0.4], [x + w, y + h + d * 0.4], [x, y + h + d * 0.4]];
      var b = f.map(function (q) { return [q[0] + d + jitter, q[1] - d * 0.6]; });
      k.line(b, { close: true, color: k.hl, width: 2, alpha: 0.6 });
      k.line(f, { close: true, color: k.hl, width: 3, fill: k.a(k.hl, 0.1) });
      for (var m = 0; m < 4; m++) k.line([f[m], b[m]], { color: k.hl, width: 2 });
      k.text('3D box · size, distance, heading', x + w / 2 + 20, y + h + 70, { size: 14, align: 'center', color: k.ink2 });
    });
    // deploy: desktop to edge
    var dp = k.b(4);
    k.glass(760, 70, 200, 170, 24, { alpha: dp, glow: k.hl, glowA: 0.5 });
    k.tile('chip', 810, 130, 48, { on: dp, alpha: dp, label: 'GPU' });
    k.tile('bolt', 905, 130, 48, { on: dp, alpha: dp, label: 'edge' });
    k.text('one exported model', 860, 215, { size: 13, color: k.ink2, align: 'center', alpha: dp });
  };

  /* Pet segmentation: one encoder feeds a mask head and a breed head. */
  S['pet-segmentation'] = function (k) {
    var cmp = k.b(4);
    k.alpha(1 - cmp, function () {
      // the photo with an abstract cat
      k.glass(50, 140, 240, 240, 26, {});
      function cat(fill, stroke, a) {
        var c = k.c; c.save(); c.globalAlpha *= a; c.beginPath();
        c.ellipse(170, 300, 70, 50, 0, 0, TAU); c.moveTo(210, 250); c.arc(170, 235, 42, 0, TAU);
        c.moveTo(140, 205); c.lineTo(150, 170); c.lineTo(165, 200); c.moveTo(175, 200); c.lineTo(192, 170); c.lineTo(200, 205);
        if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 3; c.stroke(); }
        c.restore();
      }
      cat(k.a(k.decor, 0.55), null, 1);
      // shared encoder: shrinking feature maps
      var enc = k.b(0);
      for (var i = 0; i < 4; i++) {
        var s = 160 - i * 32; var x = 330 + i * 70;
        k.glass(x, 260 - s / 2, 46, s, 12, { alpha: enc * k.seg(i * 0.2 - 0.2, i * 0.2 + 0.4), glow: k.hl, glowA: 0.3 + i * 0.15 });
      }
      k.text('shared encoder', 450, 360, { size: 13, color: k.ink2, align: 'center', alpha: enc });
      // two heads
      var sg = k.b(1); var cl = k.b(2);
      k.flow(560, 240, 660, 170, { amount: sg }); k.flow(560, 280, 660, 400, { amount: cl, color: k.decor });
      k.glass(670, 70, 270, 200, 24, { alpha: sg });
      k.text('mask', 690, 95, { size: 13, color: k.ink2, alpha: sg });
      k.alpha(sg, function () { var c = k.c; c.save(); c.translate(690, -40); c.scale(1, 0.9); cat(k.a(k.hl, 0.75 * k.seg(0.6, 1.2)), k.hl, 1); c.restore(); });
      k.glass(670, 320, 270, 190, 24, { alpha: cl });
      k.text('breed', 690, 345, { size: 13, color: k.ink2, alpha: cl });
      k.hbars(790, 370, 130, [['Abyssinian', 0.86], ['Bengal', 0.24], ['Sphynx', 0.12]], { grow: cl, alpha: cl, pos: k.decor });
      k.text('one pass, two answers', 170, 430, { size: 15, weight: 600, color: k.hl, align: 'center', alpha: k.only(3) });
    });
    k.alpha(cmp, function () {
      k.text('Which design helps, and by how much?', 500, 110, { size: 22, weight: 700, align: 'center' });
      [['Baseline U-Net', 0.55], ['Attention U-Net', 0.68], ['Feature-fusion neck', 0.76]].forEach(function (d, i) {
        var x = 190 + i * 230;
        k.glass(x - 90, 160, 180, 330, 26, { glow: i === 2 ? k.hl : null });
        k.bars(x - 30, 200, 60, 220, [d[1]], { grow: cmp, colors: [i === 2 ? k.hl : k.decor] });
        k.text(d[0], x, 460, { size: 14, weight: 600, align: 'center' });
      });
      k.text('relative, schematic', 500, 540, { size: 13, color: k.ink2, align: 'center' });
    });
  };

  /* Mars rover: frame, find keyboard, read keys, aim the arm, press. */
  S['mars-rover-keyboard-typing'] = function (k) {
    var miss = k.b(6);
    var kx = 380; var ky = 300; var kw = 520; var rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    var cam = k.b(0);
    k.glass(kx - 40, ky - 120, kw + 80, 300, 26, { alpha: cam });
    k.glyph('camera', kx - 10, ky - 92, 24, { color: k.ink2, alpha: cam });
    var det = k.b(1); var rec = k.b(2);
    var target = miss > 0.5 ? 'T' : 'R';
    rows.forEach(function (row, r) {
      for (var i = 0; i < row.length; i++) {
        var x = kx + 10 + r * 22 + i * 48; var y = ky - 50 + r * 54; var ch = row[i];
        var isT = ch === target; var smudge = miss > 0.5 && isT;
        k.glass(x, y, 42, 44, 9, { alpha: cam, lift: false, glow: isT && rec > 0.5 ? (smudge ? k.warn : k.hl) : null });
        k.text(smudge ? '?' : ch, x + 21, y + 22, { size: 16, weight: 700, align: 'center', alpha: rec * (smudge ? 1 : (0.6 + 0.4 * (isT ? 1 : 0))), color: smudge ? k.warn : k.ink, mono: true });
      }
    });
    k.bbox(kx - 4, ky - 64, kw + 8, 186, { alpha: det * (1 - k.gone(2) * 0.6), label: 'keyboard' });
    // two-link arm from the rover base
    var aim = k.b(3); var press = k.b(4) * (1 - miss);
    var tx = kx + 10 + 3 * 48 + 21; var ty = ky - 50 + 22; // R key
    var bx = 140; var by = 540;
    var hx = k.lerp(220, tx, aim * (1 - miss * 0.7)); var hy = k.lerp(380, ty - 20 + press * 20, aim * (1 - miss * 0.7));
    var ex = (bx + hx) / 2 - 60; var ey = (by + hy) / 2 - 40;
    k.glass(70, 520, 140, 60, 18, {});
    k.text('rover', 140, 550, { size: 13, color: k.ink2, align: 'center' });
    k.line([[bx, by], [ex, ey], [hx, hy]], { color: k.decor, width: 10, alpha: 0.9 });
    k.dot(ex, ey, 9, k.decor); k.dot(hx, hy, 8, k.hl, 1, 14);
    k.text('θ₁ 41°  θ₂ 63°', ex - 10, ey - 30, { size: 14, mono: true, color: k.hl, alpha: aim * (1 - miss) });
    if (press > 0.6) k.ring(tx, ty, 26 + (k.t * 40) % 30, 0.999, { width: 2, color: k.hl, alpha: 1 - ((k.t * 40) % 30) / 30 });
    // typed text
    var typed = 'ROVER'.slice(0, Math.max(0, Math.round(k.seg(4, 5) * 5)));
    k.glass(560, 520, 360, 64, 18, { alpha: k.b(4) });
    k.text(typed + (Math.sin(k.t * 6) > 0 ? '▍' : ''), 580, 552, { size: 22, mono: true, weight: 700, alpha: k.b(4) * (1 - miss) });
    k.text('no confident read · no keypress sent', 740, 552, { size: 15, weight: 600, color: k.warn, align: 'center', alpha: miss });
  };

  /* PPG sleep staging: pulse wave -> features -> explanations -> stage. */
  S['sleep-stage-xai'] = function (k) {
    var sig = k.b(0);
    k.glass(50, 50, 900, 150, 24, { alpha: sig });
    k.glyph('heart', 84, 82, 24, { color: k.bad, alpha: sig });
    var off = k.t * 0.25;
    k.wave(80, 130, 840, 90, function (u) { var x = (u + off) * 22; var b = x % 1; return Math.exp(-Math.pow((b - 0.25) * 9, 2)) * 1.0 + Math.exp(-Math.pow((b - 0.45) * 10, 2)) * 0.35 - 0.3; }, { alpha: sig, color: k.bad });
    // features pulled out of the wave
    var fe = k.b(1);
    ['heart rate', 'HRV', 'amplitude', 'breathing'].forEach(function (f, i) {
      var a = fe * k.seg(0.5 + i * 0.12, 1 + i * 0.12);
      k.tile(['heart', 'bolt', 'chip', 'wifi'][i], 120 + i * 110, 290, 52, { on: 0.7, alpha: a, label: f, color: k.decor, labelSize: 12 });
      k.flow(120 + i * 110, 200, 120 + i * 110, 258, { amount: a, color: k.decor, count: 1 });
    });
    // explainable model: contributions
    var ex = k.b(2);
    k.glass(50, 370, 470, 200, 24, { alpha: ex });
    k.text('why this stage', 75, 395, { size: 13, color: k.ink2, alpha: ex });
    k.hbars(210, 415, 280, [['HRV', 0.78], ['heart rate', -0.42], ['breathing', 0.36], ['amplitude', -0.18]], { grow: ex, alpha: ex, rh: 22 });
    // hypnogram
    var hy = k.b(3); var night = k.b(4);
    var stages = ['Wake', 'REM', 'Light', 'Deep'];
    k.glass(560, 250, 390, 320, 24, { alpha: hy });
    stages.forEach(function (s, i) { k.text(s, 590, 300 + i * 60, { size: 13, color: k.ink2, alpha: hy }); });
    var seq = [0, 2, 2, 3, 3, 2, 1, 2, 3, 2, 1, 1, 2, 2, 1, 0];
    var upto = Math.max(1, Math.round(k.lerp(4, seq.length, night)));
    var pts = [];
    for (var i = 0; i < upto; i++) { pts.push([650 + i * 18, 300 + seq[i] * 60]); pts.push([650 + (i + 1) * 18, 300 + seq[i] * 60]); }
    k.line(pts, { color: k.hl, width: 3, alpha: hy });
    var ci = upto - 1; k.dot(650 + ci * 18 + 9, 300 + seq[ci] * 60, 8, k.hl, hy, 16);
    k.text(stages[seq[ci]], 650 + ci * 18 + 9, 300 + seq[ci] * 60 - 22, { size: 14, weight: 700, align: 'center', alpha: hy });
    k.text('one low-cost sensor, four stages', 755, 545, { size: 13, color: k.ink2, align: 'center', alpha: night });
  };

  /* Matrimonial hub: filters -> AJAX -> SQL -> results; messages encrypted. */
  S['matrimonial-hub'] = function (k) {
    var msg = k.b(5);
    k.alpha(1 - msg, function () {
      var chips = ['Age 25–30', 'Dhaka', 'Engineer', 'Non-smoker'];
      chips.forEach(function (c, i) {
        var on = k.seg(i * 0.22 - 0.4, i * 0.22);
        k.glass(60, 90 + i * 64, 200, 48, 24, { glow: on > 0.5 ? k.hl : null });
        k.tile('check', 88, 114 + i * 64, 28, { on: on });
        k.text(c, 116, 114 + i * 64, { size: 15, weight: 600 });
      });
      k.flow(270, 230, 420, 230, { amount: k.b(1), color: k.hl });
      k.text('AJAX · no reload', 345, 205, { size: 13, color: k.ink2, align: 'center', alpha: k.b(1) });
      var q = k.b(2);
      k.glass(430, 120, 250, 220, 22, { alpha: q });
      k.glyph('db', 470, 150, 28, { color: k.hl, alpha: q });
      ['SELECT * FROM profiles', 'WHERE age BETWEEN 25', '  AND 30', 'AND city = \'Dhaka\'', 'AND job = \'Engineer\''].forEach(function (l, i) {
        k.text(l.slice(0, Math.round(l.length * k.seg(1.2 + i * 0.15, 1.8 + i * 0.15))), 450, 190 + i * 26, { size: 13, mono: true, alpha: q, color: i === 0 ? k.hl : k.ink });
      });
      // result cards narrow down
      var res = k.b(3); var keep = [0, 3, 5];
      for (var i = 0; i < 8; i++) {
        var kept = keep.indexOf(i) >= 0; var col = i % 2; var row = Math.floor(i / 2);
        var x0 = 720 + col * 120; var y0 = 60 + row * 125;
        var kx = 720 + keep.indexOf(i) * 0 + 60; var ky = 110 + keep.indexOf(i) * 140;
        var x = kept ? k.lerp(x0, kx, res) : x0; var y = kept ? k.lerp(y0, ky, res) : y0;
        var a = kept ? 1 : 1 - res;
        k.glass(x, y, 110, 110, 18, { alpha: a * k.seg(-0.5, 0.2), glow: kept && res > 0.5 ? k.hl : null });
        k.glyph('person', x + 55, y + 48, 40, { color: kept ? k.ink : k.ink2, alpha: a });
      }
      k.text('3 matches', 840, 560, { size: 15, weight: 700, color: k.hl, align: 'center', alpha: k.b(4) });
    });
    k.alpha(msg, function () {
      k.glass(80, 230, 260, 90, 22, { glow: k.hl });
      k.text('“Hi, nice to meet you”', 210, 275, { size: 16, weight: 600, align: 'center' });
      k.flow(350, 275, 650, 275, { amount: 1, color: k.decor, count: 4 });
      k.tile('lock', 500, 275, 60, { on: 1, color: k.decor, label: 'encrypted' });
      k.text('a91f…3c7e', 500, 200, { size: 14, mono: true, color: k.decor, align: 'center' });
      k.glass(660, 230, 260, 90, 22, { glow: k.hl });
      k.text('delivered', 790, 275, { size: 16, weight: 600, align: 'center' });
      k.text('messages and passwords stored encrypted', 500, 400, { size: 15, color: k.ink2, align: 'center' });
    });
  };

  /* WeHeal: a patient's journey through one app; four role dashboards. */
  S.weheal = function (k) {
    var roles = k.b(6);
    k.alpha(1 - roles, function () {
      var st = [['search', 'Find a doctor'], ['calendar', 'Book a slot'], ['video', 'Video consult'], ['doc', 'Records + Rx'], ['card', 'Payment']];
      var y = 470; var x0 = 110; var dx = 195;
      k.line([[x0, y], [x0 + dx * 4, y]], { color: k.ink2, width: 2, alpha: 0.3, dash: [4, 8] });
      var pos = Math.min(4, k.p);
      k.line([[x0, y], [x0 + dx * pos, y]], { color: k.hl, width: 3 });
      st.forEach(function (s, i) { k.tile(s[0], x0 + i * dx, y, 56, { on: k.b(i), label: s[1] }); });
      k.dot(x0 + dx * pos, y - 48, 7, k.decor, 1, 14);
      // the screen for the current step
      var i = Math.max(0, Math.min(4, Math.round(k.p)));
      var a = 1 - Math.abs(k.p - Math.round(k.p)) * 2;
      k.glass(300, 60, 400, 300, 28, { alpha: a, glow: k.hl, glowA: 0.3 });
      var c = k;
      if (i === 0) for (var r = 0; r < 3; r++) { c.glyph('person', 350, 120 + r * 70, 30, { alpha: a }); c.text(['Dr. Rahman · Cardiology', 'Dr. Akter · GP', 'Dr. Sen · Paediatrics'][r], 380, 120 + r * 70, { size: 15, alpha: a }); c.glyph('star', 660, 120 + r * 70, 18, { color: k.decor, alpha: a }); }
      if (i === 1) for (var d = 0; d < 21; d++) { var on = d === 10; c.glass(330 + (d % 7) * 52, 100 + Math.floor(d / 7) * 70, 44, 56, 10, { alpha: a, lift: false, glow: on ? k.hl : null }); c.text(String(d + 8), 352 + (d % 7) * 52, 128 + Math.floor(d / 7) * 70, { size: 14, align: 'center', alpha: a, weight: on ? 800 : 500 }); }
      if (i === 2) { c.glass(330, 90, 200, 240, 18, { alpha: a }); c.glyph('person', 430, 200, 70, { alpha: a }); c.glass(545, 230, 130, 100, 14, { alpha: a }); c.glyph('person', 610, 280, 40, { alpha: a, color: k.ink2 }); c.dot(340 + 12, 102, 5, k.bad, a * (0.5 + 0.5 * Math.sin(k.t * 4))); }
      if (i === 3) { c.glyph('doc', 380, 150, 60, { alpha: a, color: k.hl }); ['Rx  Atorvastatin 10 mg', '      once daily · 30 days', 'History · ECG · labs'].forEach(function (l, r) { c.text(l, 420, 140 + r * 34, { size: 15, mono: r < 2, alpha: a }); }); }
      if (i === 4) { c.glass(380, 120, 240, 140, 18, { alpha: a, tint: k.decor }); c.text('৳ 800', 500, 175, { size: 30, weight: 800, align: 'center', alpha: a }); c.tile('check', 500, 300, 50, { on: 1, alpha: a }); }
      k.text('one app, end to end', 500, 570, { size: 15, weight: 600, color: k.hl, align: 'center', alpha: k.only(5) });
    });
    k.alpha(roles, function () {
      k.glass(400, 230, 200, 120, 24, { glow: k.hl });
      k.tile('calendar', 500, 275, 48, { on: 1 }); k.text('one appointment', 500, 325, { size: 13, align: 'center', color: k.ink2 });
      [['person', 'Patient', 170, 140], ['heart', 'Doctor', 830, 140], ['gear', 'Clinic staff', 170, 460], ['shield', 'Administrator', 830, 460]].forEach(function (r, i) {
        k.glass(r[2] - 100, r[3] - 60, 200, 120, 22, {});
        k.tile(r[0], r[2], r[3] - 8, 46, { on: 0.6, label: r[1] });
        k.flow(r[2] + (r[2] < 500 ? 100 : -100), r[3], 500 + (r[2] < 500 ? -100 : 100), 290, { amount: 1, count: 2, color: [k.hl, k.decor, k.cool, k.hl][i] });
      });
    });
  };

  /* Academic success: 24 features -> prepare -> compare -> three outcomes. */
  S['academic-success-prediction'] = function (k) {
    var r = k.rnd(3); var N = 48; var sort = k.b(3);
    var cls = []; for (var i = 0; i < N; i++) { var v = r(); cls.push(v < 0.5 ? 0 : v < 0.72 ? 1 : 2); }
    var cnt = [0, 0, 0];
    for (var i = 0; i < N; i++) {
      var gx = 90 + (i % 8) * 46; var gy = 110 + Math.floor(i / 8) * 54;
      var c = cls[i]; var slot = cnt[c]++;
      var bx = 560 + c * 140 + (slot % 4) * 28; var by = 200 + Math.floor(slot / 4) * 30;
      var x = k.lerp(gx, bx, sort); var y = k.lerp(gy, by, sort);
      var col = sort > 0.5 ? [k.hl, k.decor, k.bad][c] : k.ink2;
      k.dot(x, y, 8, col, 0.85, sort > 0.5 && c === 2 ? 10 : 0);
      // 24-feature sparkline per student, normalised in "prepare"
      if (sort < 0.95) {
        var a = (1 - sort) * k.b(0) * 0.7; var prep = k.b(1);
        for (var f = 0; f < 6; f++) { var h = (0.2 + r() * 0.8) * k.lerp(1, 0.6, prep) * 14; k.line([[gx - 12 + f * 5, gy + 22], [gx - 12 + f * 5, gy + 22 - h]], { color: prep > 0.5 ? k.hl : k.decor, width: 2, alpha: a }); }
      }
    }
    k.text('4,424 students · 24 features each', 270, 70, { size: 14, color: k.ink2, align: 'center', alpha: 1 - sort });
    // model comparison
    var cmp = k.b(2) * (1 - sort);
    k.glass(520, 90, 420, 300, 24, { alpha: cmp });
    k.text('six models compared', 730, 120, { size: 14, color: k.ink2, align: 'center', alpha: cmp });
    k.bars(560, 150, 340, 180, [0.5, 0.52, 0.55, 0.62, 0.63, 0.63], { grow: cmp, alpha: cmp, labels: ['LR', 'KNN', 'DT', 'NN', 'RF', 'XGB'], colors: [k.ink2, k.ink2, k.ink2, k.decor, k.hl, k.hl] });
    k.text('RF / XGBoost ≈ 63%', 730, 370, { size: 13, weight: 700, color: k.hl, align: 'center', alpha: cmp });
    // three outcomes
    ['Graduate', 'Enrolled', 'Dropout'].forEach(function (s, i) { k.text(s, 610 + i * 140, 170, { size: 15, weight: 700, align: 'center', alpha: sort, color: [k.hl, k.decor, k.bad][i] }); });
    var sup = k.b(4);
    k.glass(620, 440, 300, 90, 22, { alpha: sup, glow: k.bad, glowA: 0.6 });
    k.tile('heart', 670, 485, 46, { on: sup, color: k.bad, alpha: sup });
    k.text('flag early, offer support', 800, 485, { size: 15, weight: 600, align: 'center', alpha: sup });
  };

  /* Gesture keyboard-mouse: hand landmarks -> finger states -> key / pointer. */
  S['gesture-keyboard-mouse'] = function (k) {
    var mouse = k.b(5);
    var hx = 250; var hy = 380; var bob = Math.sin(k.t * 1.5) * 6;
    var tips = [[-90, -60], [-45, -170], [0, -190], [45, -170], [85, -120]];
    var pinch = mouse * (0.5 + 0.5 * Math.sin(k.t * 2));
    var up = [1, 1, 0, 0, 0];
    k.glass(60, 70, 380, 470, 30, {});
    k.text('camera', 90, 100, { size: 13, color: k.ink2 });
    tips.forEach(function (tp, i) {
      var fold = k.b(1) * (up[i] ? 0 : 0.55) * (1 - mouse);
      var tx = hx + tp[0] * (1 - fold * 0.3); var ty = hy + bob + tp[1] * (1 - fold);
      if (mouse && i === 0) { tx = k.lerp(tx, hx + 20, pinch * 0.6); ty = k.lerp(ty, hy - 150, pinch * 0.6); }
      var mx = hx + tp[0] * 0.45; var my = hy + bob + tp[1] * 0.45 + 10;
      k.line([[hx, hy + bob + 60], [mx, my], [tx, ty]], { color: k.ink2, width: 2.5, alpha: k.b(0) });
      k.dot(mx, my, 5, k.ink2, k.b(0));
      var lit = k.b(1) * (up[i] && !mouse ? 1 : 0) + (mouse && (i === 0 || i === 1) ? 1 : 0);
      k.dot(tx, ty, 7, lit ? k.hl : k.ink, k.b(0), lit ? 14 : 0);
    });
    k.dot(hx, hy + bob + 60, 9, k.ink, k.b(0));
    k.text('21 landmarks', 250, 510, { size: 13, color: k.ink2, align: 'center', alpha: k.b(0) * (1 - mouse) });
    k.alpha(1 - mouse, function () {
      // virtual keyboard and suggestions
      var ke = k.b(2);
      var rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
      rows.forEach(function (row, r) { for (var i = 0; i < row.length; i++) { var on = row[i] === 'H' && ke > 0.5; k.glass(480 + r * 18 + i * 46, 260 + r * 52, 40, 44, 9, { lift: false, glow: on ? k.hl : null, alpha: 0.5 + 0.5 * ke }); k.text(row[i], 500 + r * 18 + i * 46, 282 + r * 52, { size: 15, weight: 700, align: 'center', mono: true, alpha: 0.5 + 0.5 * ke }); } });
      k.glass(480, 120, 460, 70, 20, { alpha: ke });
      k.text('h' + (Math.sin(k.t * 6) > 0 ? '▍' : ''), 505, 155, { size: 22, mono: true, weight: 700, alpha: ke });
      var sg = k.b(3);
      ['hello', 'help', 'হ্যালো'].forEach(function (s, i) { k.glass(480 + i * 155, 440, 145, 50, 25, { alpha: sg, glow: i === 0 ? k.hl : null }); k.text(s, 552 + i * 155, 465, { size: 16, weight: 600, align: 'center', alpha: sg }); });
      k.text('next word, English or Bangla', 710, 520, { size: 13, color: k.ink2, align: 'center', alpha: sg });
    });
    k.alpha(mouse, function () {
      k.glass(480, 110, 460, 420, 26, {});
      var pts = []; for (var i = 0; i <= 60; i++) { var u = i / 60; pts.push([540 + u * 340, 320 + Math.sin(u * 5 + k.t) * 90 * (1 - u * 0.4)]); }
      k.line(pts, { color: k.hl, width: 2, alpha: 0.4, dash: [4, 8], offset: -k.t * 30 });
      var u = (k.t * 0.15) % 1; var px = 540 + u * 340; var py = 320 + Math.sin(u * 5 + k.t) * 90 * (1 - u * 0.4);
      k.line([[px, py], [px, py + 26], [px + 8, py + 19], [px + 18, py + 22]], { close: true, color: k.ink, width: 2, fill: k.hl });
      k.text('mouse mode · pinch to click', 710, 490, { size: 14, color: k.ink2, align: 'center' });
    });
  };

  /* DRISTEE: capture -> detect -> depth -> voice; also recognise faces. */
  S['dristee-navigation'] = function (k) {
    var face = k.only(5); var cmd = k.b(6);
    k.glass(60, 60, 600, 420, 30, {});
    // abstract street: vanishing lines
    var vx = 360; var vy = 190;
    k.line([[90, 470], [vx - 20, vy]], { color: k.ink2, width: 1.5, alpha: 0.35 }); k.line([[630, 470], [vx + 20, vy]], { color: k.ink2, width: 1.5, alpha: 0.35 });
    for (var i = 0; i < 6; i++) { var u = ((i / 6) + k.t * 0.08) % 1; var y = vy + Math.pow(u, 2) * 280; k.line([[vx - 4 - u * 40, y], [vx + 4 + u * 40, y]], { color: k.ink2, width: 2, alpha: 0.4 * u }); }
    k.alpha(1 - face, function () {
      // obstacle: a chair; a person further away
      k.glass(380, 300, 110, 120, 14, { tint: k.decor, glow: k.decor, glowA: 0.5 });
      k.glass(230, 230, 50, 110, 20, { tint: k.cool });
      k.bbox(372, 292, 126, 136, { alpha: k.b(1), label: 'chair' });
      k.bbox(222, 222, 66, 126, { alpha: k.b(1), label: 'person', color: k.cool });
      var dep = k.b(2);
      for (var r = 1; r <= 3; r++) k.line([[360 - r * 90, 470], [360 + r * 90, 470]], { color: k.hl, width: 1, alpha: 0 });
      k.text('2 m', 435, 445, { size: 16, weight: 800, color: k.hl, align: 'center', alpha: dep });
      k.text('6 m', 255, 365, { size: 14, weight: 700, color: k.cool, align: 'center', alpha: dep });
      k.alpha(dep * 0.6, function () { var c = k.c; var g = c.createLinearGradient(0, 470, 0, 200); g.addColorStop(0, k.a(k.hl, 0.25)); g.addColorStop(1, k.a(k.cool, 0)); c.fillStyle = g; c.beginPath(); c.moveTo(90, 470); c.lineTo(vx, vy); c.lineTo(630, 470); c.closePath(); c.fill(); });
    });
    k.alpha(face, function () {
      k.glass(300, 170, 120, 170, 50, { tint: k.decor });
      k.glyph('person', 360, 250, 90, { color: k.ink });
      k.bbox(290, 160, 140, 190, { label: 'Ayesha' });
    });
    // voice guidance
    var v = k.b(3);
    k.tile('speaker', 740, 300, 64, { on: v });
    for (var w = 0; w < 3; w++) { var rr = 40 + ((k.t * 40 + w * 25) % 75); k.ring(740, 300, rr, 0.999, { width: 1.5, color: k.hl, alpha: v * (1 - (rr - 40) / 75), track: 'transparent' }); }
    k.bubble(700, 130, 260, 64, face > 0.5 ? '“Ayesha is in front.”' : '“Chair ahead, two metres.”', { alpha: Math.max(v, face) * (1 - cmd) });
    k.bubble(700, 130, 260, 64, '“What is ahead of me?”', { alpha: cmd, color: k.cool });
    k.tile('mic', 740, 470, 48, { on: 0.2 + 0.8 * cmd, alpha: 0.7 + 0.3 * cmd, label: 'voice commands', color: cmd > 0.5 ? k.cool : k.hl });
  };

  /* ViT autism screening: face patches + behaviour signals, fused. */
  S['vit-autism-detection'] = function (k) {
    var fx = 80; var fy = 90;
    k.glass(fx, fy, 260, 260, 30, { alpha: k.b(0) });
    var pt = k.b(0) * k.seg(-0.5, 0.6);
    for (var i = 0; i < 16; i++) {
      var x = fx + 20 + (i % 4) * 56; var y = fy + 20 + Math.floor(i / 4) * 56;
      var tok = k.b(2); var tx = 420 + (i % 8) * 34; var ty = 140 + Math.floor(i / 8) * 34;
      k.glass(k.lerp(x, tx, tok), k.lerp(y, ty, tok), k.lerp(52, 28, tok), k.lerp(52, 28, tok), 8, { alpha: pt, lift: false, glow: i === 5 || i === 6 ? k.hl : null });
    }
    k.alpha(k.b(0) * (1 - k.b(2)), function () { k.glyph('person', fx + 130, fy + 130, 150, { color: k.ink, width: 1.4 }); });
    k.text('facial signals', fx + 130, fy + 290, { size: 13, color: k.ink2, align: 'center', alpha: k.b(0) });
    // behavioural signals as timelines
    var bh = k.b(1);
    k.glass(80, 400, 260, 160, 24, { alpha: bh });
    ['gaze', 'motion', 'response'].forEach(function (s, i) {
      k.text(s, 100, 435 + i * 40, { size: 12, color: k.ink2, alpha: bh });
      k.wave(170, 435 + i * 40, 150, 22, function (u) { return Math.sin(u * (8 + i * 5) + k.t * (1 + i)) * (0.5 + 0.5 * Math.sin(u * 3 + i)); }, { alpha: bh, color: [k.decor, k.cool, k.hl][i], width: 1.8 });
    });
    // transformer attention between tokens
    var at = k.b(2);
    k.glass(400, 110, 300, 220, 24, { alpha: at });
    k.text('Vision Transformer', 550, 300, { size: 13, color: k.ink2, align: 'center', alpha: at });
    for (var a = 0; a < 10; a++) { var i1 = (a * 5) % 16; var i2 = (a * 7 + 3) % 16; var x1 = 434 + (i1 % 8) * 34; var y1 = 154 + Math.floor(i1 / 8) * 34; var x2 = 434 + (i2 % 8) * 34; var y2 = 154 + Math.floor(i2 / 8) * 34 + 60; k.line([[x1, y1], [(x1 + x2) / 2, y1 + 80], [x2, y2 - 40]], { color: k.hl, width: 1, alpha: at * 0.35 * (0.5 + 0.5 * Math.sin(k.t * 2 + a)) }); }
    // fusion
    var fu = k.b(3);
    k.flow(700, 220, 800, 300, { amount: fu }); k.flow(340, 480, 800, 330, { amount: fu, color: k.decor });
    k.tile('chip', 830, 315, 70, { on: fu, alpha: fu, label: 'fusion' });
    k.text('screening support · schematic', 830, 420, { size: 13, color: k.ink2, align: 'center', alpha: k.b(4) });
  };

  /* Wearable: monitor -> fall pattern -> locate -> alert; vitals too. */
  S['wearable-fall-detection'] = function (k) {
    var vit = k.b(5);
    k.glass(60, 80, 230, 230, 60, { glow: k.hl, glowA: 0.4 });
    k.glyph('heart', 175, 160, 50, { color: k.bad });
    k.text(vit > 0.5 ? '138 bpm' : '72 bpm', 175, 225, { size: 22, weight: 800, align: 'center', color: vit > 0.5 ? k.bad : k.ink });
    k.text('wrist device', 175, 340, { size: 13, color: k.ink2, align: 'center' });
    // accelerometer trace with a fall spike
    var fall = k.b(1) * (1 - vit);
    k.glass(330, 80, 610, 160, 24, {});
    k.text(vit > 0.5 ? 'heart rate' : 'acceleration', 355, 105, { size: 13, color: k.ink2 });
    k.wave(350, 170, 570, 110, function (u) {
      var base = Math.sin(u * 40 + k.t * 3) * 0.12;
      if (vit > 0.5) return base + (u > 0.6 ? 0.55 : 0);
      return base + fall * Math.exp(-Math.pow((u - 0.72) * 25, 2)) * 0.95;
    }, { color: vit > 0.5 ? k.bad : k.hl });
    k.text(vit > 0.5 ? 'out of range' : 'fall pattern', 760, 105, { size: 13, weight: 700, color: k.bad, alpha: Math.max(fall, vit) });
    // a figure that tips over
    k.alpha(1 - vit, function () {
      var c = k.c; var ang = fall * 1.35; c.save(); c.translate(430, 470); c.rotate(ang);
      k.dot(0, -120, 14, k.ink); k.line([[0, -105], [0, -45], [-20, 0]], { color: k.ink, width: 5 }); k.line([[0, -45], [20, 0]], { color: k.ink, width: 5 }); k.line([[-25, -90], [25, -80]], { color: k.ink, width: 5 });
      c.restore();
    });
    // locate
    var loc = k.b(2);
    k.glass(560, 290, 200, 190, 22, { alpha: loc });
    for (var i = 0; i < 5; i++) k.line([[580, 310 + i * 36], [740, 330 + i * 30]], { color: k.ink2, width: 1, alpha: loc * 0.3 });
    k.glyph('pin', 660, 370 - Math.abs(Math.sin(k.t * 3)) * 8, 40, { color: k.bad, alpha: loc });
    k.text('GPS location', 660, 455, { size: 13, color: k.ink2, align: 'center', alpha: loc });
    // alert to a carer's phone
    var al = Math.max(k.b(3), vit);
    k.glass(800, 290, 140, 250, 26, { alpha: al });
    k.glyph('phone', 870, 330, 30, { alpha: al, color: k.ink2 });
    k.glass(810, 370, 120, 90, 16, { alpha: al, glow: k.bad });
    k.text(vit > 0.5 ? 'Vitals alert' : 'Fall alert', 870, 400, { size: 14, weight: 800, align: 'center', alpha: al, color: k.bad });
    k.text('location sent', 870, 428, { size: 12, align: 'center', alpha: al * (1 - vit), color: k.ink2 });
    k.text('no button pressed', 660, 560, { size: 15, weight: 600, color: k.hl, align: 'center', alpha: k.only(4) });
  };

  /* RTL robot: IR -> comparator -> transistor logic -> motors, no code. */
  S['obstacle-avoiding-rtl-robot'] = function (k) {
    var clear = k.b(5);
    var wall = 1 - clear;
    // top-down arena
    k.glass(50, 60, 420, 500, 30, {});
    k.alpha(wall, function () { k.glass(80, 90, 360, 40, 10, { tint: k.decor }); });
    var turn = k.b(4) * wall;
    var y = 420 - k.seg(0, 3) * 160 * (1 - turn * 0.2) - clear * ((k.t * 40) % 200);
    if (clear) y = 460 - ((k.t * 50) % 300);
    var ang = -turn * 1.1; var x = 260 + turn * 60;
    var c = k.c; c.save(); c.translate(x, y); c.rotate(ang);
    k.glass(-40, -50, 80, 100, 18, { glow: k.hl, glowA: 0.4 });
    k.line([[-50, -30], [-50, 30]], { color: k.ink, width: 8 }); k.line([[50, -30], [50, 30]], { color: k.ink, width: 8 });
    var ir = k.b(0);
    [-20, 20].forEach(function (sx) { k.line([[sx, -50], [sx * 1.6, -150]], { color: k.bad, width: 2, alpha: ir * 0.7, dash: [5, 6], offset: -k.t * 30 }); });
    c.restore();
    if (turn > 0.2) k.line([[260, 330], [290, 290], [360, 260]], { color: k.hl, width: 2, dash: [6, 8], alpha: turn });
    // the circuit, left to right
    var cmp = k.b(1); var lg = k.b(2); var mot = k.b(3);
    k.glass(500, 70, 450, 140, 22, { alpha: cmp });
    k.text('comparator', 525, 95, { size: 13, color: k.ink2, alpha: cmp });
    var sig = wall * Math.min(1, k.p / 1.2);
    k.bars(540, 115, 120, 80, [0.3 + 0.6 * sig, 0.3 + 0.6 * sig], { alpha: cmp, labels: ['IR L', 'IR R'], colors: [k.bad, k.bad] });
    k.line([[530, 155], [670, 155]], { color: k.ink, width: 2, dash: [6, 5], alpha: cmp });
    k.text('threshold', 700, 155, { size: 13, color: k.ink2, alpha: cmp });
    k.text(sig > 0.5 ? 'HIGH' : 'LOW', 880, 140, { size: 22, weight: 800, mono: true, color: sig > 0.5 ? k.bad : k.hl, align: 'center', alpha: cmp });
    k.glass(500, 240, 450, 130, 22, { alpha: lg });
    k.text('resistor–transistor logic', 525, 265, { size: 13, color: k.ink2, alpha: lg });
    for (var g = 0; g < 4; g++) { var on = (g % 2 === 0) === (sig > 0.5); k.tile('bolt', 570 + g * 100, 315, 46, { on: on ? lg : 0.1, alpha: lg }); }
    k.glass(500, 400, 450, 150, 22, { alpha: mot });
    k.text('motor driver', 525, 425, { size: 13, color: k.ink2, alpha: mot });
    var lspd = sig > 0.5 ? 0.25 : 0.85; var rspd = 0.85;
    [['left motor', lspd, 620], ['right motor', rspd, 830]].forEach(function (m) {
      k.ring(m[2], 480, 30, 0.999, { width: 3, color: k.hl, alpha: mot, track: 'transparent' });
      var a = k.t * 8 * m[1]; k.line([[m[2], 480], [m[2] + Math.cos(a) * 26, 480 + Math.sin(a) * 26]], { color: k.hl, width: 3, alpha: mot });
      k.text(m[0], m[2], 530, { size: 12, color: k.ink2, align: 'center', alpha: mot });
    });
    k.text('0 microcontrollers · 0 lines of code', 260, 590, { size: 14, weight: 600, color: k.hl, align: 'center', alpha: k.b(4) });
  };

  /* Service robot: search -> approach -> grab -> lift; the system behind it. */
  S['service-robot'] = function (k) {
    var sys = k.b(5);
    k.alpha(1 - sys, function () {
      k.glass(50, 60, 640, 500, 30, {});
      var r = k.rnd(8); for (var i = 0; i < 40; i++) k.dot(70 + r() * 600, 80 + r() * 460, 2 + r() * 3, k.ink2, 0.2);
      // marker
      var mx = 540; var my = 170;
      k.glass(mx - 30, my - 30, 60, 60, 6, { tint: '#ffffff', glow: k.hl, glowA: k.b(1) });
      for (var q = 0; q < 9; q++) if ([0, 2, 4, 5, 7].indexOf(q) >= 0) k.c.fillStyle = k.ink, k.c.fillRect(mx - 21 + (q % 3) * 14, my - 21 + Math.floor(q / 3) * 14, 12, 12);
      k.text('ArUco marker', mx, my + 50, { size: 12, color: k.ink2, align: 'center' });
      // search spiral, then approach
      var srch = k.b(0); var appr = k.b(1);
      var pts = []; for (var s = 0; s <= 80 * srch; s++) { var a = s * 0.18; var rr = 20 + s * 1.6; pts.push([200 + Math.cos(a) * rr, 420 + Math.sin(a) * rr * 0.7]); }
      k.line(pts, { color: k.ink2, width: 1.5, dash: [4, 6], alpha: 0.6 });
      var ex = pts.length ? pts[pts.length - 1] : [200, 420];
      var rx = k.lerp(ex[0], mx - 10, appr); var ry = k.lerp(ex[1], my + 90, appr);
      if (appr > 0.05) k.line([[ex[0], ex[1]], [rx, ry]], { color: k.hl, width: 2.5, alpha: appr });
      k.glass(rx - 36, ry - 26, 72, 52, 14, { glow: k.hl, glowA: 0.5 });
      k.text('±5 cm', rx, ry + 44, { size: 13, weight: 700, color: k.hl, align: 'center', alpha: appr * (1 - k.b(2)) });
      // 2-DOF arm: grab, lift
      var grab = k.b(2); var lift = k.b(3);
      var bx = rx; var by = ry - 20; var jx = bx + 10; var jy = by - 40 - lift * 30;
      var hx = k.lerp(bx + 20, mx, grab); var hy = k.lerp(by - 30, my + 30, grab) - lift * 70;
      k.line([[bx, by], [jx, jy], [hx, hy]], { color: k.decor, width: 7 });
      k.dot(hx, hy, 7, k.hl, 1, 12);
      k.alpha(grab, function () { k.glass(hx - 18, hy, 36, 30, 6, { tint: k.decor, glow: k.decor }); });
    });
    var mission = k.only(4);
    k.text('mission complete', 370, 595, { size: 15, weight: 700, color: k.hl, align: 'center', alpha: mission });
    // right column / system view
    k.glass(730, 60 + sys * 0, 220, 500, 30, { alpha: 1 - sys });
    ['search', 'approach', 'grab', 'lift'].forEach(function (s, i) { k.tile(['search', 'pin', 'gear', 'bolt'][i], 840, 120 + i * 115, 50, { on: k.only(i) + (k.p > i + 0.5 ? 0.35 : 0), label: s, alpha: 1 - sys }); });
    k.alpha(sys, function () {
      k.tile('chip', 500, 140, 72, { on: 1, label: 'central computer' });
      k.tile('wifi', 500, 300, 56, { on: 0.7, label: 'WiFi commands' });
      k.tile('gear', 300, 470, 64, { on: 0.8, color: k.decor, label: 'base ESP32' });
      k.tile('bolt', 700, 470, 64, { on: 0.8, color: k.cool, label: 'arm ESP32' });
      k.flow(500, 185, 500, 268, { amount: 1 }); k.flow(500, 330, 320, 430, { amount: 1, color: k.decor }); k.flow(500, 330, 680, 430, { amount: 1, color: k.cool });
    });
  };

  /* Tower defense: build, a wave comes, defend, power up, the core holds. */
  S['tower-defense-game'] = function (k) {
    var path = [[60, 140], [380, 140], [380, 420], [700, 420], [700, 230], [880, 230]];
    k.glass(40, 60, 920, 520, 30, {});
    k.line(path, { color: k.a(k.decor, 0.4), width: 34 }); k.line(path, { color: k.decor, width: 2, alpha: 0.5, dash: [8, 10], offset: -k.t * 30 });
    function at(u) { var segs = []; var L = 0; for (var i = 1; i < path.length; i++) { var d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); segs.push(d); L += d; } var s = u * L; for (var j = 0; j < segs.length; j++) { if (s <= segs[j]) { var q = s / segs[j]; return [k.lerp(path[j][0], path[j + 1][0], q), k.lerp(path[j][1], path[j + 1][1], q)]; } s -= segs[j]; } return path[path.length - 1]; }
    // the core
    var hold = k.b(4);
    k.tile('heart', 900, 230, 64, { on: 0.6 + 0.4 * hold, color: k.hl, label: hold > 0.5 ? 'core holds' : 'core' });
    // towers
    var towers = [[250, 230], [480, 330], [600, 330], [800, 320]];
    towers.forEach(function (tw, i) {
      var a = k.seg(i * 0.2 - 0.3, i * 0.2 + 0.3);
      k.tile('star', tw[0], tw[1], 50, { on: a * 0.8, alpha: a, color: k.cool });
    });
    // wave of enemies
    var wave = k.b(1); var def = k.b(2);
    for (var e = 0; e < 9; e++) {
      var u = ((k.t * 0.05 + e * 0.07) % 1) * wave; var p = at(u);
      var dead = def > 0.5 && (e % 3 === 0) && u > 0.35;
      if (u < 0.01 || dead) continue;
      k.dot(p[0], p[1], e === 8 && k.b(4) > 0.3 ? 16 : 9, k.bad, 0.9, 10);
      if (def > 0.2 && e % 2 === 0) { var tw = towers[e % 4]; k.line([[tw[0], tw[1]], [p[0], p[1]]], { color: k.cool, width: 2, alpha: def * (0.5 + 0.5 * Math.sin(k.t * 12 + e)) }); }
    }
    // power-up burst
    var pw = k.only(3);
    if (pw > 0.01) { for (var b = 0; b < 3; b++) { var rr = 30 + ((k.t * 120 + b * 60) % 180); k.ring(480, 330, rr, 0.999, { width: 3, color: k.decor, alpha: pw * (1 - rr / 210), track: 'transparent' }); } }
    k.text('power-up', 480, 260, { size: 14, weight: 700, color: k.decor, align: 'center', alpha: pw });
    k.glass(70, 480, 220, 70, 20, { alpha: wave });
    k.text('wave ' + Math.max(1, Math.min(7, Math.round(k.lerp(1, 7, k.seg(1, 4))))) + ' / 7', 180, 515, { size: 20, weight: 800, align: 'center', alpha: wave });
    k.text('boss incoming', 180, 470, { size: 13, weight: 700, color: k.bad, align: 'center', alpha: k.b(4) * 0.9 });
  };

  /* Pedestrian–vehicle risk: road, objects, pose, relations, risk + reasons. */
  S['pedestrian-vehicle-conflict-risk'] = function (k) {
    k.glass(50, 60, 560, 420, 30, {});
    var road = k.b(0);
    k.line([[80, 470], [260, 200], [400, 200], [590, 470]], { close: true, color: k.hl, width: 1.5, alpha: road, fill: k.a(k.hl, 0.18 * road) });
    k.text('road', 330, 250, { size: 13, color: k.hl, align: 'center', alpha: road });
    // car and pedestrian
    var cx = 330 + Math.sin(k.t * 0.6) * 6; var cy = 360;
    k.glass(cx - 70, cy - 40, 140, 80, 20, { tint: k.cool });
    k.glass(470, 260, 44, 100, 20, { tint: k.decor });
    var obj = k.b(1);
    k.bbox(cx - 78, cy - 48, 156, 96, { alpha: obj, label: 'car', color: k.cool });
    k.bbox(462, 252, 60, 116, { alpha: obj, label: 'person', color: k.decor });
    // pose
    var pose = k.b(2);
    k.alpha(pose, function () {
      k.dot(492, 270, 7, k.decor, 1, 8);
      k.line([[492, 278], [490, 315], [478, 352]], { color: k.decor, width: 3 }); k.line([[490, 315], [505, 352]], { color: k.decor, width: 3 });
      k.line([[470, 300], [492, 290], [515, 300]], { color: k.decor, width: 3 });
      k.text('facing the road', 492, 395, { size: 12, color: k.decor, align: 'center' });
    });
    // relations
    var rel = k.b(3);
    k.line([[cx + 70, cy], [470, 330]], { color: k.ink, width: 2, dash: [6, 6], offset: -k.t * 20, alpha: rel });
    k.text('3.1 m', (cx + 540) / 2, cy - 30, { size: 15, weight: 800, align: 'center', alpha: rel });
    k.line([[cx, cy], [cx + 120, cy - 10]], { color: k.cool, width: 3, alpha: rel });
    k.text('heading', cx + 140, cy - 14, { size: 12, color: k.cool, alpha: rel });
    // risk + explanation
    var rk = k.b(4);
    k.glass(650, 60, 300, 200, 26, { alpha: rk, glow: k.warn, glowA: 0.6 });
    k.ring(720, 160, 46, 0.72 * rk, { color: k.warn, alpha: rk, width: 9 });
    k.text('High', 720, 160, { size: 18, weight: 800, align: 'center', alpha: rk });
    k.text('conflict risk', 840, 145, { size: 15, weight: 700, alpha: rk, align: 'center' });
    k.text('from one photo', 840, 172, { size: 13, color: k.ink2, alpha: rk, align: 'center' });
    k.glass(650, 290, 300, 230, 26, { alpha: rk });
    k.text('why (SHAP)', 675, 315, { size: 13, color: k.ink2, alpha: rk });
    k.hbars(790, 340, 140, [['distance', 0.82], ['on road', 0.64], ['facing', 0.41], ['speed', -0.2]], { grow: rk, alpha: rk, pos: k.warn, rh: 24 });
  };

  /* Document assistant: retrieve, check the quote, answer with source. */
  S['enterprise-ai-document-assistant'] = function (k) {
    var unsup = k.only(4); var law = k.b(5);
    k.alpha(1 - law, function () {
      // document stack
      for (var i = 0; i < 4; i++) {
        var lit = i === 1 && unsup < 0.5;
        k.glass(60 + i * 18, 90 + i * 22, 220, 280, 18, { glow: lit && k.b(0) > 0.5 ? k.hl : null, alpha: 0.6 + 0.1 * i });
      }
      k.text('HR policy library', 205, 410, { size: 13, color: k.ink2, align: 'center' });
      for (var l = 0; l < 7; l++) k.line([[135, 180 + l * 26], [135 + 150 - (l % 3) * 30, 180 + l * 26]], { color: k.ink2, width: 4, alpha: 0.35 });
      var q = k.b(1);
      k.alpha(q * (1 - unsup), function () { var c = k.c; c.fillStyle = k.a(k.hl, 0.3); k.rr(128, 220, 170, 44, 6); c.fill(); });
      // passages pulled out
      var ret = k.b(0);
      for (var p = 0; p < 3; p++) {
        var a = ret * k.seg(-0.4 + p * 0.2, 0.2 + p * 0.2);
        k.glass(360, 100 + p * 90, 250, 70, 16, { alpha: a, glow: p === 0 && q > 0.5 && unsup < 0.5 ? k.hl : null });
        for (var l = 0; l < 2; l++) k.line([[380, 125 + p * 90 + l * 20], [380 + 200 - l * 50, 125 + p * 90 + l * 20]], { color: k.ink2, width: 4, alpha: a * 0.5 });
        k.flow(300, 230, 360, 135 + p * 90, { amount: a, count: 1 });
      }
      // quote check
      k.tile(unsup > 0.5 ? 'cross' : 'check', 650, 135, 40, { on: q, alpha: q, color: unsup > 0.5 ? k.warn : k.hl });
      k.text(unsup > 0.5 ? 'no passage says this' : 'quote found word for word', 680, 135, { size: 14, weight: 600, alpha: q, color: unsup > 0.5 ? k.warn : k.ink });
      // answer with source
      var ans = k.b(2) * (1 - unsup);
      k.bubble(360, 400, 580, 76, '“Yes, here is what the policy says…”', { alpha: ans });
      k.glass(380, 500, 280, 44, 22, { alpha: ans, glow: k.hl });
      k.glyph('doc', 405, 522, 20, { color: k.hl, alpha: ans });
      k.text('document · page · exact quote', 425, 522, { size: 13, weight: 600, alpha: ans });
      k.bubble(360, 400, 580, 76, '“I don’t know: the policy doesn’t cover that.”', { alpha: unsup, color: k.warn });
      k.text('answers carry their evidence', 650, 580, { size: 14, color: k.hl, weight: 600, align: 'center', alpha: k.only(3) });
    });
    k.alpha(law, function () {
      k.glass(80, 120, 340, 300, 24, {}); k.text('Company policy', 250, 150, { size: 15, weight: 700, align: 'center' });
      k.glass(580, 120, 340, 300, 24, {}); k.text('Bangladesh Labour Act', 750, 150, { size: 15, weight: 700, align: 'center' });
      k.text('Maternity leave: not covered', 250, 240, { size: 16, align: 'center', weight: 600 });
      k.text('Maternity leave: 16 weeks', 750, 240, { size: 16, align: 'center', weight: 600 });
      [0, 1].forEach(function (s) { for (var l = 0; l < 3; l++) k.line([[150 + s * 500, 290 + l * 26], [350 + s * 500 - l * 40, 290 + l * 26]], { color: k.ink2, width: 4, alpha: 0.4 }); });
      k.flow(420, 260, 580, 260, { amount: 1, color: k.warn, count: 3 });
      k.glass(380, 450, 240, 70, 22, { glow: k.warn });
      k.tile('bolt', 420, 485, 36, { on: 1, color: k.warn });
      k.text('gap flagged', 520, 485, { size: 16, weight: 800, color: k.warn, align: 'center' });
    });
  };

  window.StoryScenes = S;
})();
