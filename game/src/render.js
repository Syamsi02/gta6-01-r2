// Meridian Heat — drawing only: the city, the actors and every screen.
// The camera follows the player across a 3400x2600 city; the HUD carries cash,
// health, wanted stars, the clock, the mission objective and a live minimap.

import { WORLD, VIEW, DISTRICTS, ROADS_X, ROADS_Y, ROAD_HALF, MISSIONS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_MISSIONS = 'missions';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const camera = { x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
  }

  function text(value, x, y, size, color, align, bold) {
    const key = `${size}${bold ? 'b' : ''}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCar(x, y, angle, car, isPlayer) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-24, -12, 48, 26);
    ctx.fillStyle = car.color;
    ctx.fillRect(-23, -11, 46, 22);
    // Cabin and windows.
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(-8, -9, 18, 18);
    ctx.fillStyle = '#9fd8ef';
    ctx.fillRect(-6, -8, 6, 16);
    // Headlights and tail lights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(21, -9, 3, 5);
    ctx.fillRect(21, 4, 3, 5);
    ctx.fillStyle = '#e84c3d';
    ctx.fillRect(-24, -9, 3, 5);
    ctx.fillRect(-24, 4, 3, 5);
    if (car.police) {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-2, -11, 8, 22);
      const flash = Math.floor(car.siren * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2a2a' : '#2a6aff';
      ctx.fillRect(-4, -12, 5, 5);
      ctx.fillStyle = flash ? '#2a6aff' : '#ff2a2a';
      ctx.fillRect(-4, 7, 5, 5);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-25, -13, 50, 26);
    }
    ctx.restore();
  }

  function drawPed(x, y, angle, ped, name) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2018';
    ctx.beginPath();
    ctx.arc(4, -2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (name) text(name, x, y - 16, 11, '#ffffff', 'center');
  }

  function drawCity(state, city, camX, camY) {
    // District ground.
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }
    // Beach sand and sea on the west edge.
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect(0, 0, 130, 800);
    ctx.fillStyle = '#2a7ab8';
    ctx.fillRect(0, 0, 70, 800);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let y = 40; y < 800; y += 90) ctx.fillRect(66, y, 14, 40);
    // Parks.
    for (const p of city.parks) {
      ctx.fillStyle = '#4a7a3d';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#6a9a4d';
      for (let i = 0; i < 4; i += 1) {
        circle(p.x + p.w * (0.2 + i * 0.2), p.y + p.h * 0.5, 12, '#5a8a3d');
      }
    }
    // Roads.
    ctx.fillStyle = '#2e2e36';
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_HALF, 0, ROAD_HALF * 2, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_HALF, WORLD.width, ROAD_HALF * 2);
    // Lane dashes.
    ctx.fillStyle = '#e8d44c';
    for (const rx of ROADS_X) {
      for (let y = 20; y < WORLD.height; y += 70) ctx.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of ROADS_Y) {
      for (let x = 20; x < WORLD.width; x += 70) ctx.fillRect(x, ry - 2, 30, 4);
    }
    // Crosswalk stripes at intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        for (let i = -2; i <= 2; i += 1) {
          ctx.fillRect(rx - ROAD_HALF + 4, ry + i * 10 - 3, 10, 6);
          ctx.fillRect(rx + ROAD_HALF - 14, ry + i * 10 - 3, 10, 6);
        }
      }
    }
    // Buildings with roofs, windows and shadows.
    for (const b of city.buildings) {
      if (b.x > camX + VIEW.width + 100 || b.x + b.w < camX - 100) continue;
      if (b.y > camY + VIEW.height + 100 || b.y + b.h < camY - 100) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(b.x, b.y, b.w, 8);
      ctx.fillStyle = '#ffe9a8';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if ((c * 7 + r * 5 + Math.floor(b.x)) % 3 !== 0) continue;
          ctx.fillRect(b.x + 8 + c * 26, b.y + 10 + r * 26, 10, 12);
        }
      }
      if (b.tall) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
      }
    }
    // Landmarks with labels.
    for (const l of city.landmarks) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(l.x + 5, l.y + 7, l.w, l.h);
      ctx.fillStyle = l.color;
      ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(l.x, l.y, l.w, l.h);
      text(l.name, l.x + l.w / 2, l.y + l.h / 2 + 5, 15, '#ffffff', 'center', true);
    }
    // District labels.
    for (const d of DISTRICTS) {
      text(d.name.toUpperCase(), d.x + d.w / 2, d.y + 46, 22, 'rgba(255,255,255,0.35)', 'center', true);
    }
  }

  function drawMarkers(state) {
    for (const mk of state.markers) {
      const pulse = 1 + Math.sin(state.time * 4) * 0.15;
      ctx.save();
      ctx.translate(mk.x, mk.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#f2c230';
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.lineTo(16, -12);
      ctx.lineTo(-16, -12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a1a22';
      circle(0, -18, 6, '#1a1a22');
      ctx.restore();
      text(mk.label, mk.x, mk.y - 44, 14, '#f2c230', 'center', true);
      // Guide line from the player to the marker.
      const px = state.player.inCar ? state.player.inCar.x : state.player.x;
      const py = state.player.inCar ? state.player.inCar.y : state.player.y;
      ctx.strokeStyle = 'rgba(242,194,48,0.35)';
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(mk.x, mk.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (state.fare && state.missionActive) {
      circle(state.fare.x, state.fare.y, 10 + Math.sin(state.time * 5) * 3, '#4fc3e8');
      text('FARE', state.fare.x, state.fare.y - 18, 12, '#4fc3e8', 'center', true);
    }
  }

  function drawMinimap(state, city) {
    const mw = 220; const mh = 168;
    const mx = VIEW.width - mw - 16; const my = VIEW.height - mh - 16;
    const sx = mw / WORLD.width; const sy = mh / WORLD.height;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    ctx.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
    ctx.strokeStyle = '#f2c230';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx - 6, my - 6, mw + 12, mh + 12);
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2a7ab8';
    ctx.fillRect(mx, my, 70 * sx, 800 * sy);
    for (const rx of ROADS_X) ctx.fillRect(mx + rx * sx - 1, my, 2, mh);
    for (const ry of ROADS_Y) ctx.fillRect(mx, my + ry * sy - 1, mw, 2);
    for (const mk of state.markers) {
      circle(mx + mk.x * sx, my + mk.y * sy, 5, '#f2c230');
    }
    for (const cop of state.police) {
      circle(mx + cop.x * sx, my + cop.y * sy, 3, '#2a6aff');
    }
    for (const car of state.cars) {
      if (car.police) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(mx + car.x * sx - 1, my + car.y * sy - 1, 3, 3);
    }
    const px = state.player.inCar ? state.player.inCar.x : state.player.x;
    const py = state.player.inCar ? state.player.inCar.y : state.player.y;
    // Viewport rectangle.
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeRect(mx + camera.x * sx, my + camera.y * sy, VIEW.width * sx, VIEW.height * sy);
    circle(mx + px * sx, my + py * sy, 5, '#ffffff');
    circle(mx + px * sx, my + py * sy, 3, '#e84c3d');
    text('PORT MERIDIAN', mx + mw / 2, my + mh + 26, 11, '#ffffff', 'center', true);
    ctx.restore();
  }

  function drawHud(state) {
    // Top-left: cash, health, wanted stars, clock.
    ctx.fillStyle = 'rgba(10,14,20,0.94)';
    ctx.fillRect(14, 12, 300, 92);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(14, 12, 300, 92);
    text(`$ ${state.cash}`, 28, 44, 26, '#7ae8a8', 'left', true);
    text(`SCORE ${state.score}`, 190, 42, 15, '#ffffff', 'left');
    // Health bar.
    ctx.fillStyle = '#3a2020';
    ctx.fillRect(28, 56, 160, 14);
    ctx.fillStyle = state.health > 40 ? '#4fc36a' : '#e84c3d';
    ctx.fillRect(28, 56, 160 * clamp(state.health / 100, 0, 1), 14);
    text('HP', 196, 68, 13, '#ffffff', 'left');
    // Wanted stars.
    for (let i = 0; i < 5; i += 1) {
      text('★', 28 + i * 24, 96, 20, i < state.wanted ? '#f2c230' : 'rgba(255,255,255,0.25)', 'left');
    }
    const hh = Math.floor(state.clock / 60);
    const mm = Math.floor(state.clock % 60);
    text(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, 240, 96, 18, '#ffffff', 'left', true);
    // Top-centre: mission objective.
    if (state.missionActive) {
      const m = MISSIONS[state.missionIndex];
      ctx.fillStyle = 'rgba(10,14,20,0.78)';
      const w = 460;
      ctx.fillRect((VIEW.width - w) / 2, 12, w, 58);
      ctx.strokeStyle = '#f2c230';
      ctx.strokeRect((VIEW.width - w) / 2, 12, w, 58);
      text(m.title, VIEW.width / 2, 36, 16, '#f2c230', 'center', true);
      text(state.missionText, VIEW.width / 2, 58, 14, '#ffffff', 'center');
    } else if (state.missionIndex < MISSIONS.length) {
      ctx.fillStyle = 'rgba(10,14,20,0.6)';
      ctx.fillRect((VIEW.width - 460) / 2, 12, 460, 34);
      text('Press M to open the mission list', VIEW.width / 2, 35, 14, '#ffffff', 'center');
    } else {
      ctx.fillStyle = 'rgba(10,14,20,0.6)';
      ctx.fillRect((VIEW.width - 460) / 2, 12, 460, 34);
      text('All missions complete — free roam!', VIEW.width / 2, 35, 14, '#7ae8a8', 'center');
    }
    // Bottom-left: controls hint.
    text('WASD drive / walk   •   E enter car   •   Click shoot   •   F punch   •   M mission   •   P pause', 16, VIEW.height - 14, 13, 'rgba(255,255,255,0.75)', 'left');
    // Message toast (kept short so it always fits the panel).
    if (state.messageTimer > 0 && state.message) {
      const msg = state.message.length > 84 ? state.message.slice(0, 81) + '...' : state.message;
      ctx.fillStyle = 'rgba(10,14,20,0.9)';
      const w = Math.min(720, 40 + msg.length * 7.5);
      ctx.fillRect((VIEW.width - w) / 2, VIEW.height - 96, w, 40);
      ctx.strokeStyle = '#4fc3e8';
      ctx.strokeRect((VIEW.width - w) / 2, VIEW.height - 96, w, 40);
      text(msg, VIEW.width / 2, VIEW.height - 69, 15, '#ffffff', 'center');
    }
    drawMinimap(state);
  }

  function drawPanel(title, lines, prompt, accent, topY) {
    const w = 680;
    const h = 150 + lines.length * 34;
    const x = (VIEW.width - w) / 2;
    const y = topY !== undefined ? topY : (VIEW.height - h) / 2;
    ctx.fillStyle = 'rgba(8,10,16,0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || '#f2c230';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    text(title, VIEW.width / 2, y + 72, 52, accent || '#f2c230', 'center', true);
    lines.forEach((line, i) => {
      text(line, VIEW.width / 2, y + 120 + i * 34, 19, '#e8e8e8', 'center');
    });
    text(prompt, VIEW.width / 2, y + h - 28, 19, '#7ae8a8', 'center', true);
  }

  function drawTitle(state, city, best) {
    // A living backdrop: the city with traffic rolling past.
    drawCity(state, city, camera.x, camera.y);
    ctx.fillStyle = 'rgba(8,10,16,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text('MERIDIAN', VIEW.width / 2, 118, 84, '#f2c230', 'center', true);
    text('HEAT', VIEW.width / 2, 196, 84, '#e84c3d', 'center', true);
    text('An open-world crime story in Port Meridian', VIEW.width / 2, 238, 22, '#ffffff', 'center');
    drawPanel('PORT MERIDIAN', [
      'Steal cars. Outrun the harbour police. Run three story missions',
      'for Vera Kline and Eddie Rook — and keep the heat off your back.',
      `Best score ${best}   •   Cash saved: $${state.cash}`,
      '',
      'WASD move & drive  •  E enter / exit car  •  Mouse aim, click to shoot',
      'F punch  •  M start mission  •  P pause  •  Space handbrake',
    ], 'Press Enter or click to start', '#f2c230', 300);
  }

  function drawMissions(state) {
    ctx.fillStyle = 'rgba(8,10,16,0.94)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text('MISSIONS — PORT MERIDIAN', VIEW.width / 2, 110, 40, '#f2c230', 'center', true);
    MISSIONS.forEach((m, i) => {
      const y = 180 + i * 150;
      const done = i < state.missionIndex;
      const active = i === state.missionIndex && state.missionActive;
      ctx.fillStyle = done ? 'rgba(60,120,70,0.5)' : 'rgba(30,34,44,0.9)';
      ctx.fillRect(240, y, 800, 120);
      ctx.strokeStyle = active ? '#f2c230' : 'rgba(255,255,255,0.3)';
      ctx.strokeRect(240, y, 800, 120);
      text(`${i + 1}. ${m.title}  —  ${done ? 'COMPLETE' : active ? 'IN PROGRESS' : 'AVAILABLE'}`, 270, y + 38, 22, done ? '#7ae8a8' : '#ffffff', 'left', true);
      text(`From ${m.giver}  •  Reward $${m.reward}`, 270, y + 68, 16, '#c9c9c9', 'left');
      const brief = m.brief.length > 92 ? m.brief.slice(0, 89) + '...' : m.brief;
      text(brief, 270, y + 96, 15, '#e8e8e8', 'left');
    });
    text('Press M to close, Enter to start the next mission', VIEW.width / 2, 660, 18, '#7ae8a8', 'center');
  }

  function draw(state, city, screen, best) {
    const px = state.player.inCar ? state.player.inCar.x : state.player.x;
    const py = state.player.inCar ? state.player.inCar.y : state.player.y;
    camera.x = clamp(px - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    camera.y = clamp(py - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    const ox = (canvas.width - VIEW.width * scale) / 2;
    const oy = (canvas.height - VIEW.height * scale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);

    if (screen === SCREEN_TITLE) {
      drawTitle(state, city, best);
      return;
    }
    if (screen === SCREEN_MISSIONS) {
      drawMissions(state);
      return;
    }

    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawCity(state, city, camera.x, camera.y);
    // Pickups.
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(pk.bob) * 3;
      if (pk.kind === 'cash') {
        ctx.fillStyle = '#7ae8a8';
        ctx.fillRect(pk.x - 12, pk.y - 8 + bob, 24, 16);
        text('$', pk.x, pk.y + 5 + bob, 14, '#0a2a14', 'center', true);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(pk.x - 11, pk.y - 11 + bob, 22, 22);
        ctx.fillStyle = '#e84c3d';
        ctx.fillRect(pk.x - 3, pk.y - 8 + bob, 6, 16);
        ctx.fillRect(pk.x - 8, pk.y - 3 + bob, 16, 6);
      }
    }
    drawMarkers(state);
    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.x < camera.x - 40 || ped.x > camera.x + VIEW.width + 40) continue;
      if (ped.y < camera.y - 40 || ped.y > camera.y + VIEW.height + 40) continue;
      drawPed(ped.x, ped.y, ped.angle, ped, null);
    }
    // Cars.
    for (const car of state.cars) {
      if (car.x < camera.x - 80 || car.x > camera.x + VIEW.width + 80) continue;
      if (car.y < camera.y - 80 || car.y > camera.y + VIEW.height + 80) continue;
      drawCar(car.x, car.y, car.angle, car, state.player.inCar === car);
    }
    // Bullets.
    for (const b of state.bullets) {
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      ctx.globalAlpha = clamp(pt.life * 2, 0, 1);
      circle(pt.x, pt.y, 4, pt.color);
    }
    ctx.globalAlpha = 1;
    // Player on foot.
    if (state.player.onFoot) {
      const p = state.player;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e84c3d';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd9a8';
      ctx.beginPath();
      ctx.arc(5, -2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(8, -3, 8, 6);
      ctx.restore();
      // Aim line.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 46, p.y + Math.sin(p.angle) * 46);
      ctx.stroke();
    }
    ctx.restore();

    // Screen-space overlays.
    drawHud(state);
    if (state.wanted > 0) {
      ctx.fillStyle = 'rgba(232,76,61,0.10)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      text(`WANTED — ${state.wanted} STAR${state.wanted > 1 ? 'S' : ''}`, VIEW.width / 2, 130, 22, '#ff6a5a', 'center', true);
    }
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8,10,16,0.7)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('PAUSED', ['Port Meridian waits for no one.', `Cash $${state.cash}  •  Score ${state.score}`], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      ctx.fillStyle = 'rgba(8,10,16,0.75)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('BUSTED', [
        'The harbour police finally caught up with you.',
        `Final score ${state.score}  •  Cash $${state.cash}  •  Cars stolen ${state.carsStolen}`,
        `Best score ${best}`,
      ], 'Press Enter to start over', '#e84c3d');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
