import { useEffect, useRef } from 'react';
import { type World, type Scene, hour } from '../engine/model';
const W = 480,
  H = 310;
const palette = {
  ink: '#4d4b43',
  cream: '#f4e5c7',
  wood: '#c99f77',
  edge: '#886f55',
  green: '#8d9b6e',
  dark: '#506b53',
  leaf: '#78936a',
};
export const anchors = {
  bed: { x: 391, y: 188 },
  desk: { x: 103, y: 215 },
  shelf: { x: 77, y: 187 },
  plant: { x: 335, y: 237 },
  sofa: { x: 235, y: 200 },
  kitchen: { x: 177, y: 157 },
};
function painter(ctx: CanvasRenderingContext2D) {
  const r = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const line = (x: number, y: number, w: number, c: string) => r(x, y, w, 1, c);
  const ellipse = (x: number, y: number, rx: number, ry: number, c: string) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  function plant(x: number, y: number, size = 1) {
    r(x - 4 * size, y, 10 * size, 11 * size, '#ac7960');
    r(x - 6 * size, y - 2 * size, 14 * size, 4 * size, '#d49d79');
    r(x, y - 18 * size, 2 * size, 17 * size, '#668153');
    r(x - 8 * size, y - 17 * size, 9 * size, 5 * size, palette.leaf);
    r(x + 1 * size, y - 22 * size, 9 * size, 6 * size, '#8ca675');
    r(x - 5 * size, y - 27 * size, 7 * size, 7 * size, '#69895c');
  }
  function window(x: number, y: number, w = 52, h = 43, night = false) {
    r(x - 3, y - 3, w + 6, h + 6, '#b18a6b');
    r(x, y, w, h, night ? '#55677c' : '#b7d0ca');
    r(x + 3, y + 3, w - 6, h - 6, night ? '#71849b' : '#d1e2d6');
    r(x + w / 2 - 2, y, 3, h, '#e9d5b0');
    r(x, y + h / 2, w, 3, '#e9d5b0');
    r(x - 7, y - 5, 7, h + 9, '#dfc6a1');
    r(x + w, y - 5, 7, h + 9, '#dfc6a1');
    r(x - 6, y + h, w + 12, 5, '#a8815f');
  }
  function shelf(x: number, y: number, w = 42, h = 65) {
    r(x + 3, y + 4, w, h, '#b3926b');
    r(x, y, w, h, '#a8815c');
    r(x + 4, y + 4, w - 8, h - 8, '#77644e');
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < Math.floor((w - 10) / 6); i++) {
        const c = ['#81917c', '#d5b378', '#b17b66', '#8e9ba1', '#d8c7a7'][(i + row) % 5];
        r(x + 6 + i * 6, y + 8 + row * 19, 4, 14 - (i % 3) * 2, c);
        r(x + 7 + i * 6, y + 10 + row * 19, 2, 1, '#e8d8b7');
      }
      r(x + 2, y + 24 + row * 19, w - 4, 3, '#c4a078');
    }
    r(x + 3, y + h, 4, 5, palette.edge);
    r(x + w - 7, y + h, 4, 5, palette.edge);
  }
  function table(x: number, y: number, w = 48, h = 21) {
    r(x + 4, y + h, 4, 18, '#937754');
    r(x + w - 8, y + h, 4, 18, '#937754');
    r(x - 2, y + 2, w + 4, h, '#97795b');
    r(x, y, w, h, '#d4b58b');
    line(x + 3, y + 3, w - 6, '#e4caa1');
  }
  function lamp(x: number, y: number, on = false) {
    r(x, y, 3, 36, '#8b775e');
    r(x - 8, y + 34, 20, 4, '#9c8767');
    r(x - 10, y - 2, 23, 12, on ? '#ffde93' : '#e6d3aa');
    r(x - 7, y - 7, 17, 5, '#e6d3aa');
    if (on) {
      ctx.fillStyle = 'rgba(255,220,136,.13)';
      ctx.beginPath();
      ctx.moveTo(x - 7, y + 10);
      ctx.lineTo(x - 27, y + 44);
      ctx.lineTo(x + 30, y + 44);
      ctx.lineTo(x + 10, y + 10);
      ctx.fill();
    }
  }
  function tree(x: number, y: number, s = 1) {
    r(x - 3 * s, y, 7 * s, 35 * s, '#8c7f61');
    r(x - 14 * s, y + 4 * s, 29 * s, 7 * s, '#617c62');
    r(x - 23 * s, y - 8 * s, 46 * s, 19 * s, '#72906e');
    r(x - 18 * s, y - 21 * s, 37 * s, 20 * s, '#829e76');
    r(x - 9 * s, y - 29 * s, 20 * s, 20 * s, '#94ab7f');
    r(x - 18 * s, y - 14 * s, 12 * s, 4 * s, '#9ab287');
  }
  function person(
    x: number,
    y: number,
    hair: string,
    outfit: string,
    skin: string,
    moving: boolean,
    t: number,
    sleep = false,
    npc = false,
    sitting = false,
  ) {
    ellipse(x + 1, y + 1, 10, 3, '#00000019');
    if (sleep) {
      r(x - 9, y - 15, 16, 10, outfit);
      r(x + 5, y - 19, 12, 12, hair);
      r(x + 7, y - 16, 9, 7, skin);
      r(x + 13, y - 13, 3, 1, palette.ink);
      return;
    }
    const stride = moving ? Math.sin(t * 12) * 2 : 0;
    const bob = moving ? Math.abs(Math.sin(t * 12)) : 0;
    if (sitting) {
      r(x - 7, y - 12, 18, 5, '#5d625d');
      r(x + 5, y - 9, 5, 8, '#5d625d');
      r(x + 5, y - 2, 8, 3, '#534a43');
    } else {
      r(x - 6, y - 12 - bob, 5, 11 + stride, '#5d625d');
      r(x + 2, y - 12 - bob, 5, 11 - stride, '#5d625d');
      r(x - 7, y - 2 + stride, 6, 3, '#534a43');
      r(x + 2, y - 2 - stride, 7, 3, '#534a43');
    }
    r(x - 8, y - 27 - bob, 17, 17, outfit);
    r(x - 11, y - 25 - bob, 4, 11, skin);
    r(x + 9, y - 25 - bob, 4, 11, skin);
    r(x - 6, y - 26 - bob, 2, 14, '#ffffff20');
    r(x - 10, y - 42 - bob, 21, 18, hair);
    r(x - 12, y - 38 - bob, 25, 9, hair);
    r(x - 8, y - 36 - bob, 17, 14, skin);
    r(x - 9, y - 40 - bob, 18, 6, hair);
    r(x - 10, y - 35 - bob, 4, 9, hair);
    r(x + 8, y - 35 - bob, 3, 10, hair);
    const blink = Math.floor(t * 10) % 48 === 0;
    r(x - 4, y - 31 - bob, 2, blink ? 1 : 2, '#423e38');
    r(x + 4, y - 31 - bob, 2, blink ? 1 : 2, '#423e38');
    r(x, y - 26 - bob, 3, 1, '#b27361');
    r(x - 6, y - 28 - bob, 3, 2, '#dd9b85');
    r(x + 5, y - 28 - bob, 3, 2, '#dd9b85');
    if (!npc) {
      r(x + 2, y - 40 - bob, 4, 3, '#e8c681');
    }
  }
  return { r, line, ellipse, plant, window, shelf, table, lamp, tree, person };
}
function draw(
  ctx: CanvasRenderingContext2D,
  w: World,
  scene: Scene,
  t: number,
  pos: { x: number; y: number },
  moving: boolean,
) {
  const { r, line, ellipse, plant, window, shelf, table, lamp, tree, person } = painter(ctx);
  const h = hour(w.time),
    night = h >= 19 || h < 6;
  const sky = night ? '#8993a6' : '#ccdcd3';
  r(0, 0, W, H, sky);
  // Quiet distant city, clouds and warm windows.
  r(0, 105, 480, 205, night ? '#8c9d91' : '#b8c6a8');
  for (let i = 0; i < 10; i++) {
    const x = i * 55 - 12,
      top = 48 + ((i * 17) % 39);
    r(x, top, 40, 78, night ? '#7c8691' : '#b9c9c0');
    r(x + 3, top - 4, 34, 4, night ? '#77828d' : '#aec1b6');
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        r(
          x + 7 + a * 10,
          top + 10 + b * 16,
          5,
          7,
          night && (a + b + i) % 3 === 0 ? '#e1c48f' : night ? '#637681' : '#9eafa5',
        );
  }
  for (let i = 0; i < 4; i++) {
    const x = ((i * 151 + t * 2) % 600) - 60;
    r(x, 23 + (i % 2) * 15, 40, 9, night ? '#a0a9b4' : '#e6e8da');
    r(x + 10, 18 + (i % 2) * 15, 23, 8, night ? '#a0a9b4' : '#e6e8da');
  }
  if (night) {
    r(422, 18, 12, 14, '#f3dfad');
    r(418, 21, 7, 8, '#f3dfad');
    for (let i = 0; i < 18; i++) r((i * 71 + 31) % 480, 10 + ((i * 17) % 58), 1, 1, '#f5ead2');
  } else {
    r(408, 20, 17, 17, '#f1dcaa');
    r(404, 24, 25, 9, '#f1dcaa');
  }
  const outdoor = ['park', 'street', 'night'].includes(scene);
  if (!outdoor) {
    // Cutaway dollhouse, deep plinth and pixel floorboards.
    ellipse(240, 280, 211, 15, '#6f785b25');
    r(32, 121, 416, 158, '#957e63');
    r(36, 117, 408, 155, '#cfb190');
    r(36, 148, 408, 118, '#d8bd98');
    for (let y = 150; y < 265; y += 14) {
      line(36, y, 408, '#c7a981');
      for (let x = 36 + (((y / 14) | 0) % 2) * 35; x < 444; x += 70) r(x, y, 1, 14, '#c7a981');
    }
    r(33, 74, 414, 80, '#b69e7c');
    r(39, 77, 402, 72, scene === 'cafe' ? '#d8bca0' : scene === 'office' ? '#c3cfc1' : '#e8d9ba');
    for (let x = 40; x < 440; x += 6) r(x, 78, 1, 68, '#ffffff0b');
    r(39, 146, 402, 6, '#a88d6b');
    r(32, 74, 7, 194, '#af9472');
    r(441, 74, 7, 194, '#af9472');
    r(29, 69, 422, 7, '#967c60');
    r(37, 263, 406, 7, '#e7cba6');
    r(40, 276, 401, 3, '#7e705d');
    if (scene === 'apartment') {
      window(220, 89, 58, 43, night);
      r(227, 136, 44, 3, '#decbab');
      plant(262, 134, 0.6);
      shelf(51, 105, 40, 65);
      r(57, 100, 27, 5, '#e8cbae');
      plant(61, 99, 0.7);
      // Kitchen and little tiles.
      for (let y = 101; y < 135; y += 9)
        for (let x = 110; x < 185; x += 9) {
          r(x, y, 8, 8, (x + y) % 3 ? '#d8d7ba' : '#c0cbb1');
        }
      r(105, 140, 86, 28, '#b8b895');
      r(104, 135, 89, 8, '#eeead5');
      r(111, 147, 32, 18, '#ced0ae');
      r(149, 147, 33, 18, '#ced0ae');
      r(135, 152, 4, 2, '#898e73');
      r(174, 152, 4, 2, '#898e73');
      r(114, 138, 24, 3, '#888d85');
      r(123, 131, 3, 9, '#8a9289');
      r(155, 137, 26, 4, '#65675c');
      r(162, 131, 13, 6, '#ae7862');
      // Work corner.
      table(62, 186, 72, 22);
      r(84, 169, 31, 18, '#605f54');
      r(87, 172, 25, 12, night ? '#d7caa0' : '#a8c7be');
      r(97, 188, 6, 3, '#665f50');
      r(91, 191, 19, 3, '#e4d9bd');
      r(65, 191, 10, 3, '#ba7a60');
      r(121, 182, 7, 9, '#eee2c6');
      r(83, 212, 25, 5, '#a68f6b');
      r(82, 209, 27, 4, '#89977c');
      r(87, 215, 3, 13, '#8c785c');
      r(103, 215, 3, 13, '#8c785c');
      // Rug, sofa, coffee table.
      r(168, 184, 141, 65, '#bb9877');
      r(171, 187, 135, 59, '#ddd0ad');
      for (let y = 193; y < 241; y += 9) line(176, y, 125, '#c7bb99');
      r(183, 164, 94, 32, '#6f8067');
      r(180, 174, 100, 25, '#819475');
      r(184, 185, 92, 15, '#96a383');
      r(179, 174, 10, 29, '#74896c');
      r(272, 174, 10, 29, '#74896c');
      r(192, 169, 23, 18, '#d6b986');
      r(243, 169, 24, 18, '#b8c3a0');
      r(188, 202, 5, 5, '#8a755b');
      r(267, 202, 5, 5, '#8a755b');
      table(207, 216, 53, 17);
      r(216, 218, 16, 9, '#a88470');
      line(218, 219, 12, '#e9d9b9');
      r(245, 214, 6, 7, '#f4e4c7');
      // Sleep corner.
      r(350, 139, 65, 67, '#9a7f60');
      r(346, 144, 73, 12, '#a58a68');
      r(352, 150, 61, 51, '#e5d2b5');
      r(357, 153, 51, 16, '#f2e4cd');
      r(354, 173, 57, 30, '#a7b5a2');
      r(354, 176, 57, 5, '#bdc9b3');
      r(356, 205, 5, 9, '#8b745b');
      r(407, 205, 5, 9, '#8b745b');
      r(329, 146, 15, 25, '#c09c77');
      r(331, 149, 11, 8, '#cfb18b');
      lamp(336, 125, night);
      r(315, 87, 32, 27, '#ae8867');
      r(319, 91, 24, 19, '#e8d5af');
      r(324, 100, 13, 8, '#97aa8c');
      r(330, 95, 4, 4, '#d4ab71');
      plant(328, 239, 1.4);
      plant(427, 223, 0.9);
      r(377, 236, 39, 15, '#a37d60');
      r(381, 231, 31, 9, '#e0c19b');
    } else if (scene === 'office') {
      window(82, 87, 67, 45, night);
      window(203, 87, 67, 45, night);
      shelf(365, 91, 53, 61);
      for (const [x, y] of [
        [64, 174],
        [192, 174],
        [315, 215],
      ]) {
        table(x, y, 87, 27);
        r(x + 23, y - 22, 38, 23, '#626e65');
        r(x + 26, y - 19, 32, 16, '#a6c1b6');
        r(x + 32, y + 5, 24, 4, '#e9dec4');
        r(x + 5, y + 7, 12, 12, '#cfaa7b');
        r(x + 71, y - 7, 7, 9, '#e7d6b7');
        r(x + 28, y + 34, 26, 10, '#84917f');
        r(x + 39, y + 44, 4, 9, '#797561');
      }
      plant(424, 208, 1.2);
      lamp(334, 130, night);
    } else if (scene === 'cafe') {
      window(63, 87, 65, 45, night);
      window(343, 87, 65, 45, night);
      r(177, 87, 82, 41, '#9e795e');
      r(181, 91, 74, 33, '#52695b');
      ctx.fillStyle = '#e4d6b5';
      ctx.font = '7px monospace';
      ctx.fillText('SLOW DAYS', 192, 104);
      ctx.fillText('COFFEE & CAKE', 186, 116);
      r(153, 144, 151, 30, '#ad8262');
      r(150, 138, 156, 8, '#dfc7a2');
      for (let x = 160; x < 296; x += 16) r(x, 148, 1, 24, '#c19977');
      r(168, 116, 27, 23, '#7a8070');
      r(172, 121, 16, 9, '#c1c4ae');
      r(218, 128, 15, 8, '#d5a56c');
      r(243, 128, 15, 8, '#ce8f74');
      plant(287, 133, 0.8);
      for (const [x, y] of [
        [73, 197],
        [203, 220],
        [344, 197],
      ]) {
        table(x, y, 51, 23);
        r(x + 8, y + 3, 10, 7, '#f0dfbe');
        r(x + 33, y + 5, 9, 6, '#b97860');
        r(x + 17, y + 29, 25, 7, '#9caa88');
        r(x + 18, y - 15, 24, 8, '#9caa88');
      }
      plant(429, 228, 1.3);
    } else if (scene === 'library') {
      for (let x = 53; x < 430; x += 65) shelf(x, 86, 51, 78);
      for (const x of [94, 258]) {
        table(x, 203, 103, 29);
        r(x + 13, 205, 24, 13, '#a9b49a');
        r(x + 48, 206, 24, 12, '#e9d8b4');
        r(x + 74, 209, 18, 10, '#ae826e');
        r(x + 35, 237, 30, 7, '#91a07e');
      }
      lamp(239, 175, night);
      plant(425, 227, 1.2);
    } else if (scene === 'shop') {
      for (let x = 60; x < 405; x += 84) {
        shelf(x, 94, 66, 68);
        for (let row = 0; row < 3; row++)
          for (let i = 0; i < 5; i++)
            r(x + 6 + i * 11, 105 + row * 19, 8, 9, ['#ca8f72', '#cfba83', '#9faf90'][row]);
      }
      table(287, 212, 120, 27);
      r(340, 194, 27, 19, '#768476');
      r(345, 197, 17, 10, '#bbccc0');
      r(64, 211, 98, 26, '#b5b79b');
      for (let i = 0; i < 7; i++) r(68 + i * 13, 207, 10, 10, i % 2 ? '#b79160' : '#c1a66b');
    }
  } else if (scene === 'park') {
    r(0, 126, 480, 184, night ? '#7c9176' : '#a7b78d');
    r(0, 222, 480, 32, '#c6bea0');
    r(202, 134, 31, 176, '#c6bea0');
    for (let i = 0; i < 110; i++) {
      const x = (i * 53) % 480,
        y = 137 + ((i * 37) % 173);
      r(x, y, 3, 1, '#879d76');
      if (i % 5 === 0) {
        r(x, y - 3, 3, 2, i % 2 ? '#e8d5aa' : '#d5b4a3');
      }
    }
    for (const [x, y, s] of [
      [50, 144, 1.5],
      [402, 134, 1.8],
      [115, 191, 1.1],
      [363, 237, 1.0],
      [28, 283, 1.2],
    ])
      tree(x, y, s);
    r(270, 199, 80, 10, '#aa8c69');
    r(268, 213, 84, 8, '#bd9b73');
    r(274, 220, 4, 17, '#806f56');
    r(340, 220, 4, 17, '#806f56');
    r(276, 194, 3, 20, '#806f56');
    r(341, 194, 3, 20, '#806f56');
    ellipse(108, 270, 57, 21, '#8baea6');
    ellipse(108, 268, 50, 16, '#a4c2b5');
    line(79 + Math.sin(t) * 5, 265, 22, '#d0dace');
    line(121, 272, 18, '#d0dace');
    lamp(248, 177, night);
  } else if (scene === 'night') {
    r(30, 161, 420, 120, '#aaa99b');
    for (let y = 175; y < 280; y += 18) line(30, y, 420, '#96998d');
    r(26, 147, 429, 16, '#c0b9a1');
    r(27, 145, 429, 4, '#d6c9ad');
    r(26, 150, 7, 137, '#9d9b8a');
    r(448, 149, 7, 138, '#9d9b8a');
    table(166, 218, 56, 22);
    r(174, 220, 12, 7, '#f0dfb8');
    plant(66, 225, 1.8);
    plant(417, 242, 1.5);
    r(274, 221, 56, 24, '#879780');
    r(270, 210, 65, 15, '#7b8c76');
    lamp(369, 193, true);
  } else {
    r(0, 127, 480, 65, '#c7b99b');
    r(0, 192, 480, 43, '#ddcfad');
    r(0, 236, 480, 74, '#9da69c');
    line(0, 236, 480, '#efdfb9');
    for (let x = 0; x < 480; x += 42) r(x, 270, 22, 3, '#d5d4be');
    for (const [x, color] of [
      [26, '#c2b59a'],
      [177, '#d1baa0'],
      [335, '#adbfa6'],
    ] as const) {
      r(x, 87, 118, 100, color);
      r(x - 4, 83, 126, 8, '#937e63');
      window(x + 12, 103, 35, 36, night);
      r(x + 72, 117, 26, 69, '#8a8e79');
      r(x + 76, 122, 18, 43, night ? '#acaf92' : '#bcd0bd');
      r(x + 89, 159, 3, 3, '#ddc592');
      r(x + 7, 146, 48, 10, '#ad826b');
      r(x + 7, 145, 48, 3, '#e4c9a6');
      plant(x + 58, 179, 0.7);
    }
    tree(158, 151, 0.8);
    lamp(312, 172, night);
  }
  // NPCs have their own places. A private apartment is not a shared NPC location.
  if (scene !== 'apartment')
    w.npcs
      .filter((n) => n.scene === scene)
      .slice(0, 3)
      .forEach((_n, i) =>
        person(
          [145, 310, 382][i] + Math.sin(t * 0.3 + i) * 5,
          outdoor ? 225 : 217 + (i % 2) * 25,
          ['#695648', '#594b40', '#9b7959'][i],
          ['#a9a583', '#839d9a', '#b88e7e'][i],
          '#e5b994',
          false,
          t + i,
          false,
          true,
        ),
      );
  if (w.activity.scene === scene) {
    person(
      pos.x,
      pos.y,
      w.character.hair,
      w.character.outfit,
      w.character.skin,
      moving,
      t,
      w.activity.kind === 'sleep' && !moving,
      false,
      !moving &&
        ['read', 'study', 'work', 'create', 'play', 'eat', 'rest', 'coffee'].includes(
          w.activity.kind,
        ),
    );
    if (!moving && ['read', 'study', 'create'].includes(w.activity.kind)) {
      r(pos.x - 7, pos.y - 18, 16, 8, '#eeddb8');
      r(pos.x, pos.y - 18, 1, 8, '#bc9f7a');
    }
    if (w.activity.kind === 'sleep') {
      ctx.fillStyle = '#f0e9d4';
      ctx.font = '8px monospace';
      ctx.fillText('z', pos.x + 12, pos.y - 25 - Math.sin(t) * 3);
      ctx.fillText('z', pos.x + 20, pos.y - 36 - Math.sin(t) * 3);
    }
    if (!moving && ['work', 'play'].includes(w.activity.kind))
      r(pos.x - 6, pos.y - 16, 15, 3, '#cdae86');
  }
  // Tiny foreground details, pixel fireflies and evening color grading.
  if (scene === 'park' || scene === 'night') {
    for (let i = 0; i < 7; i++) {
      r(
        70 + i * 51 + Math.sin(t + i) * 9,
        168 + ((i * 29) % 100) + Math.cos(t * 0.6 + i) * 4,
        2,
        2,
        night ? '#e9d49b' : '#eee2c1',
      );
    }
  }
  if (Math.floor(w.time / 86400000) % 4 === 0) {
    const maxY = outdoor ? H : 65;
    r(0, 0, W, maxY, '#82949920');
    for (let i = 0; i < 45; i++) {
      const x = (i * 37 + t * 7) % 480,
        y = (i * 23 + t * 80) % maxY;
      r(x, y, 1, 5, '#e3eee44a');
    }
  }
  if (night) {
    r(0, 0, W, H, '#313c5820');
  } else if (h > 16 && h < 19) r(0, 0, W, H, '#e7af6f0e');
}
export function PixelWorld({
  world,
  scene,
  onObject,
}: {
  world: World;
  scene: Scene;
  onObject?: (anchor: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    latest = useRef(world),
    currentScene = useRef(scene),
    position = useRef({ x: 240, y: 245 });
  latest.current = world;
  currentScene.current = scene;
  useEffect(() => {
    let frame: number;
    let last = 0;
    const render = (ms: number) => {
      const w = latest.current,
        s = currentScene.current,
        dt = Math.min((ms - last) / 1000, 0.05);
      last = ms;
      const k = w.activity.kind;
      let target = { x: 240, y: 231 };
      if (s === 'apartment') {
        const key =
          k === 'sleep'
            ? 'bed'
            : k === 'work' || k === 'create' || k === 'play'
              ? 'desk'
              : k === 'eat' || k === 'wash'
                ? 'kitchen'
                : k === 'garden'
                  ? 'plant'
                  : k === 'read' || k === 'study'
                    ? 'sofa'
                    : 'sofa';
        target = anchors[key];
      } else if (s === 'office') target = { x: 106, y: 221 };
      else if (s === 'cafe') target = { x: 225, y: 253 };
      else if (s === 'library') target = { x: 141, y: 246 };
      else if (s === 'shop') target = { x: 336, y: 249 };
      else if (s === 'park') target = { x: 225 + Math.sin(ms / 17000) * 50, y: 251 };
      else if (s === 'street') target = { x: 240 + Math.sin(ms / 25000) * 100, y: 218 };
      else target = { x: 296, y: 254 };
      const p = position.current,
        dist = Math.hypot(target.x - p.x, target.y - p.y),
        moving = dist > 2;
      if (moving) {
        const step = Math.min(dist, dt * 42);
        p.x += ((target.x - p.x) / dist) * step;
        p.y += ((target.y - p.y) / dist) * step;
      }
      const ctx = canvas.current?.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        draw(ctx, w, s, ms / 1000, p, moving);
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <canvas
      ref={canvas}
      width={W}
      height={H}
      aria-label={`${scene} 像素生活场景`}
      onClick={(e) => {
        if (scene !== 'apartment' || !onObject) return;
        const b = e.currentTarget.getBoundingClientRect(),
          x = ((e.clientX - b.left) / b.width) * W,
          y = ((e.clientY - b.top) / b.height) * H;
        const hit = Object.entries(anchors).find(([, p]) => Math.hypot(p.x - x, p.y - y) < 35);
        if (hit) onObject(hit[0]);
      }}
    />
  );
}
