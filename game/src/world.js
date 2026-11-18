// Meridian Heat — the city simulation: buildings, traffic, pedestrians, police,
// pickups, bullets and the three story missions. No drawing and no browser here:
// step() advances one fixed step and returns event flags for sound and messages.

import {
  WORLD, ROADS_X, ROADS_Y, ROAD_HALF, CAR_MODELS, PED_NAMES,
  MISSIONS, PLAYER_SPEED, PLAYER_HEALTH, mulberry32,
} from './config.js';

export const EVENT_SHOOT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_CASH = 4;
export const EVENT_WANTED = 8;
export const EVENT_MISSION = 16;
export const EVENT_CRASH = 32;
export const EVENT_DEAD = 64;
export const EVENT_PUNCH = 128;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * t;
}

export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_HALF + 14) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_HALF + 14) return true;
  return false;
}

export function districtAt(x, y) {
  // Districts are looked up from config by their rectangles in a helper kept in main.
  return null;
}

// Build the static city: buildings fill the blocks between roads, parks and
// landmarks sit in a few blocks, and the beach runs along the west edge.
export function buildCity(random) {
  const buildings = [];
  const parks = [];
  const landmarks = [
    { name: 'Marina Diner', x: 300, y: 620, w: 130, h: 90, color: '#e87ab0' },
    { name: 'Harbour Warehouse', x: 300, y: 2050, w: 170, h: 110, color: '#8a6a4a' },
    { name: 'Old Crane', x: 2700, y: 350, w: 120, h: 120, color: '#c9a86a' },
    { name: 'Palm Hotel', x: 1550, y: 300, w: 150, h: 110, color: '#e8b64c' },
    { name: 'City Hall', x: 1550, y: 1250, w: 170, h: 120, color: '#b8c4d0' },
  ];
  const palette = ['#6a6a78', '#7a5a4a', '#5a6a7a', '#8a7a5a', '#4a5a6a', '#9a8a6a', '#5a5a4a'];
  const xs = [0, ...ROADS_X, WORLD.width];
  const ys = [0, ...ROADS_Y, WORLD.height];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x0 = xs[i] + ROAD_HALF + 14;
      const x1 = xs[i + 1] - ROAD_HALF - 14;
      const y0 = ys[j] + ROAD_HALF + 14;
      const y1 = ys[j + 1] - ROAD_HALF - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      if (x0 < 260 && y0 < 800) continue; // beach strip stays open
      if (landmarks.some((l) => l.x < x1 && l.x + l.w > x0 && l.y < y1 && l.y + l.h > y0)) continue;
      if (random() < 0.16) {
        parks.push({ x: x0 + 20, y: y0 + 20, w: x1 - x0 - 40, h: y1 - y0 - 40 });
        continue;
      }
      const cols = Math.max(1, Math.floor((x1 - x0) / 150));
      const rows = Math.max(1, Math.floor((y1 - y0) / 130));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const bw = (x1 - x0) / cols - 18;
          const bh = (y1 - y0) / rows - 18;
          buildings.push({
            x: x0 + 9 + c * ((x1 - x0) / cols),
            y: y0 + 9 + r * ((y1 - y0) / rows),
            w: bw, h: bh,
            color: palette[Math.floor(random() * palette.length)],
            tall: random() < 0.3,
          });
        }
      }
    }
  }
  return { buildings, parks, landmarks };
}

function pointInBuildings(buildings, x, y, pad) {
  for (const b of buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

export function createGame(seed) {
  const random = mulberry32(seed);
  const city = buildCity(random);

  const state = {
    seed,
    time: 0,
    clock: 8 * 60, // minutes after midnight; the day starts at 08:00
    cash: 120,
    health: PLAYER_HEALTH,
    wanted: 0,
    wantedHeat: 0,
    score: 0,
    kills: 0,
    carsStolen: 0,
    faresDone: 0,
    missionIndex: 0,
    missionStep: 0,
    missionActive: false,
    missionDone: false,
    missionText: '',
    message: '',
    messageTimer: 0,
    gameOver: false,
    player: {
      x: 1400, y: 1100, angle: 0, speed: 0,
      inCar: null, onFoot: true, shootCooldown: 0, punchCooldown: 0,
    },
    cars: [],
    peds: [],
    police: [],
    bullets: [],
    particles: [],
    pickups: [],
    markers: [],
    fare: null,
    rivals: [],
  };

  function spawnCar(x, y, angle, modelIndex, policeCar) {
    const model = CAR_MODELS[modelIndex % CAR_MODELS.length];
    const car = {
      x, y, angle, speed: 0, model, police: !!policeCar,
      driver: !policeCar && random() < 0.75,
      color: model.color, w: 46, h: 22, stuck: 0, siren: 0,
    };
    state.cars.push(car);
    return car;
  }

  function spawnTraffic(count) {
    for (let i = 0; i < count; i += 1) {
      const vertical = random() < 0.5;
      const road = vertical
        ? ROADS_X[Math.floor(random() * ROADS_X.length)]
        : ROADS_Y[Math.floor(random() * ROADS_Y.length)];
      const along = 100 + random() * (vertical ? WORLD.height - 200 : WORLD.width - 200);
      const x = vertical ? road + (random() < 0.5 ? -13 : 13) : along;
      const y = vertical ? along : road + (random() < 0.5 ? -13 : 13);
      const angle = vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
      spawnCar(x, y, angle, Math.floor(random() * 6), false);
    }
  }

  function spawnPeds(count) {
    for (let i = 0; i < count; i += 1) {
      const x = 100 + random() * (WORLD.width - 200);
      const y = 100 + random() * (WORLD.height - 200);
      if (isOnRoad(x, y)) continue;
      state.peds.push({
        x, y, angle: random() * TAU, speed: 28 + random() * 30,
        name: PED_NAMES[Math.floor(random() * PED_NAMES.length)],
        color: ['#e8e8d0', '#d97b4f', '#4fc3e8', '#e8b64c', '#9a6ad0'][Math.floor(random() * 5)],
        wander: random() * 4, scared: 0,
      });
    }
  }

  function spawnPickups() {
    const spots = [
      { x: 620, y: 520, kind: 'cash' }, { x: 1820, y: 820, kind: 'cash' },
      { x: 1020, y: 1720, kind: 'cash' }, { x: 2620, y: 1120, kind: 'cash' },
      { x: 1420, y: 2020, kind: 'health' }, { x: 820, y: 1420, kind: 'health' },
      { x: 2220, y: 520, kind: 'cash' }, { x: 3020, y: 1720, kind: 'health' },
      { x: 420, y: 1120, kind: 'cash' }, { x: 2420, y: 2020, kind: 'cash' },
    ];
    for (const s of spots) state.pickups.push({ ...s, taken: false, bob: random() * TAU });
  }

  function reset() {
    state.time = 0;
    state.clock = 8 * 60;
    state.cash = 120;
    state.health = PLAYER_HEALTH;
    state.wanted = 0;
    state.wantedHeat = 0;
    state.score = 0;
    state.kills = 0;
    state.carsStolen = 0;
    state.faresDone = 0;
    state.missionIndex = 0;
    state.missionStep = 0;
    state.missionActive = false;
    state.missionDone = false;
    state.missionText = '';
    state.gameOver = false;
    state.player.x = 1400;
    state.player.y = 1100;
    state.player.angle = 0;
    state.player.speed = 0;
    state.player.inCar = null;
    state.player.onFoot = true;
    state.cars.length = 0;
    state.peds.length = 0;
    state.police.length = 0;
    state.bullets.length = 0;
    state.particles.length = 0;
    state.pickups.length = 0;
    state.markers.length = 0;
    state.fare = null;
    state.rivals.length = 0;
    spawnTraffic(26);
    spawnPeds(34);
    spawnPickups();
    setMessage('Welcome to Port Meridian. Find a car, or start Mission 1 with M.');
  }

  function setMessage(text) {
    state.message = text;
    state.messageTimer = 5;
  }

  function addWanted(amount) {
    const before = state.wanted;
    state.wantedHeat = clamp(state.wantedHeat + amount, 0, 100);
    state.wanted = state.wantedHeat < 12 ? 0 : state.wantedHeat < 28 ? 1 : state.wantedHeat < 45 ? 2
      : state.wantedHeat < 62 ? 3 : state.wantedHeat < 82 ? 4 : 5;
    if (state.wanted > before) return EVENT_WANTED;
    return 0;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * TAU;
      state.particles.push({
        x, y, vx: Math.cos(a) * speed * (0.4 + random() * 0.8),
        vy: Math.sin(a) * speed * (0.4 + random() * 0.8),
        life: 0.5 + random() * 0.5, color,
      });
    }
  }

  function nearestCar(x, y, maxDist) {
    let best = null; let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar(car) {
    state.player.inCar = car;
    state.player.onFoot = false;
    if (car.driver) {
      car.driver = false;
      state.carsStolen += 1;
      state.score += 25;
      addWanted(6);
      setMessage(`Stole a ${car.model.name}! The owner ran off — keep an eye on the heat.`);
    } else {
      setMessage(`Driving the ${car.model.name}.`);
    }
  }

  function exitCar() {
    const car = state.player.inCar;
    if (!car) return;
    const px = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    const py = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    state.player.x = clamp(px, 20, WORLD.width - 20);
    state.player.y = clamp(py, 20, WORLD.height - 20);
    state.player.angle = car.angle;
    state.player.inCar = null;
    state.player.onFoot = true;
  }

  function fireBullet() {
    const p = state.player;
    const ox = p.x + Math.cos(p.angle) * 22;
    const oy = p.y + Math.sin(p.angle) * 22;
    state.bullets.push({ x: ox, y: oy, vx: Math.cos(p.angle) * 620, vy: Math.sin(p.angle) * 620, life: 0.9, fromPlayer: true });
  }

  // --- missions -------------------------------------------------------------
  function missionMarker() {
    const m = MISSIONS[state.missionIndex];
    if (!m) return null;
    if (m.id === 'm1') {
      if (state.missionStep === 0) return { x: 385, y: 2105, label: 'Warehouse' };
      if (state.missionStep === 2) return { x: 365, y: 665, label: 'Marina Diner' };
      return null;
    }
    if (m.id === 'm2') {
      if (state.missionStep === 0) return { x: 1650, y: 320, label: 'Fare pickup' };
      if (state.missionStep === 1 && state.fare) return { x: state.fare.tx, y: state.fare.ty, label: 'Drop-off' };
      if (state.missionStep === 2) return { x: 1600, y: 1250, label: 'Rival cabs' };
      return null;
    }
    if (m.id === 'm3') {
      if (state.missionStep === 0) return { x: 2620, y: 350, label: 'Yard gate' };
      if (state.missionStep === 2) return { x: 2760, y: 410, label: 'Old Crane' };
      return null;
    }
    return null;
  }

  function startMission() {
    if (state.missionActive || state.missionIndex >= MISSIONS.length) return 0;
    const m = MISSIONS[state.missionIndex];
    state.missionActive = true;
    state.missionStep = 0;
    state.missionText = m.steps[0];
    state.markers = [];
    const mk = missionMarker();
    if (mk) state.markers = [mk];
    setMessage(`${m.giver}: ${m.brief}`);
    if (m.id === 'm2') {
      state.fare = { x: 1650, y: 320, tx: 2200, ty: 1700, picked: false, count: 0 };
    }
    if (m.id === 'm3') addWanted(30);
    return EVENT_MISSION;
  }

  function advanceMission() {
    const m = MISSIONS[state.missionIndex];
    state.missionStep += 1;
    if (state.missionStep >= m.steps.length) {
      state.cash += m.reward;
      state.score += m.reward;
      state.missionActive = false;
      state.missionDone = true;
      state.markers = [];
      state.fare = null;
      state.rivals.length = 0;
      setMessage(`Mission complete: ${m.title} — earned $${m.reward}.`);
      state.missionIndex += 1;
      state.missionStep = 0;
      state.missionText = state.missionIndex < MISSIONS.length
        ? `Next: ${MISSIONS[state.missionIndex].title} (press M)`
        : 'All missions complete — Port Meridian is yours.';
      return EVENT_CASH | EVENT_MISSION;
    }
    state.missionText = m.steps[state.missionStep];
    const mk = missionMarker();
    state.markers = mk ? [mk] : [];
    return EVENT_MISSION;
  }

  function updateMission(dt, events) {
    if (!state.missionActive) return events;
    const m = MISSIONS[state.missionIndex];
    const p = state.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    if (m.id === 'm1') {
      if (state.missionStep === 0 && dist2(px, py, 385, 2105) < 90 * 90) {
        setMessage('Package collected. Deliver it to the Marina Diner.');
        events |= advanceMission();
      } else if (state.missionStep === 1 && dist2(px, py, 365, 665) < 90 * 90) {
        events |= advanceMission();
      }
    } else if (m.id === 'm2') {
      if (state.missionStep === 0 && state.fare && dist2(px, py, state.fare.x, state.fare.y) < 80 * 80) {
        state.fare.picked = true;
        state.missionStep = 1;
        state.missionText = m.steps[1];
        const mk = missionMarker();
        state.markers = mk ? [mk] : [];
        setMessage('Fare aboard. Drive to the drop-off marker.');
      } else if (state.missionStep === 1 && state.fare && state.fare.picked
        && dist2(px, py, state.fare.tx, state.fare.ty) < 80 * 80) {
        state.faresDone += 1;
        state.cash += 60;
        state.score += 60;
        events |= EVENT_CASH;
        if (state.faresDone >= 3) {
          state.missionStep = 2;
          state.missionText = m.steps[2];
          const mk = missionMarker();
          state.markers = mk ? [mk] : [];
          setMessage('Rival cabs are circling Downtown — ram them off the boulevard!');
          for (let i = 0; i < 3; i += 1) {
            const rival = spawnCar(1500 + i * 120, 1250, 0, 1, false);
            rival.driver = true;
            state.rivals.push(rival);
          }
        } else {
          state.fare = { x: 1800 + state.faresDone * 150, y: 300, tx: 1000, ty: 2000, picked: false, count: state.faresDone };
          state.missionStep = 0;
          state.missionText = m.steps[0];
          const mk = missionMarker();
          state.markers = mk ? [mk] : [];
          setMessage(`Fare ${state.faresDone + 1} of 3 is waiting in Palm Heights.`);
        }
      } else if (state.missionStep === 2 && state.rivals.length === 0) {
        events |= advanceMission();
      }
    } else if (m.id === 'm3') {
      if (state.missionStep === 0 && dist2(px, py, 2620, 350) < 90 * 90) {
        state.missionStep = 1;
        state.missionText = m.steps[1];
        setMessage('The yard is hot — lose the police, then make the drop.');
      } else if (state.missionStep === 1 && state.wanted === 0) {
        state.missionStep = 2;
        state.missionText = m.steps[2];
        const mk = missionMarker();
        state.markers = mk ? [mk] : [];
        setMessage('Clean. Make the drop at the Old Crane.');
      } else if (state.missionStep === 2 && dist2(px, py, 2760, 410) < 90 * 90) {
        events |= advanceMission();
      }
    }
    return events;
  }

  // --- police ---------------------------------------------------------------
  function spawnPolice() {
    const p = state.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    const angle = random() * TAU;
    const car = spawnCar(
      clamp(px + Math.cos(angle) * 500, 60, WORLD.width - 60),
      clamp(py + Math.sin(angle) * 500, 60, WORLD.height - 60),
      angle, 6, true,
    );
    car.speed = 120;
    state.police.push(car);
  }

  function updatePolice(dt) {
    const want = state.wanted === 0 ? 0 : state.wanted + 1;
    while (state.police.length < want) spawnPolice();
    while (state.police.length > want) {
      const gone = state.police.pop();
      const idx = state.cars.indexOf(gone);
      if (idx >= 0) state.cars.splice(idx, 1);
    }
    const p = state.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    for (const cop of state.police) {
      cop.siren += dt;
      const target = Math.atan2(py - cop.y, px - cop.x);
      cop.angle = angleLerp(cop.angle, target, Math.min(1, dt * 2.2));
      cop.speed = Math.min(cop.model.top, cop.speed + cop.model.accel * dt);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      if (dist2(cop.x, cop.y, px, py) < 46 * 46) {
        // Busted or rammed: on foot the player takes damage, in a car both take a hit.
        if (p.onFoot) {
          state.health -= 22 * dt;
          if (state.health <= 0) return EVENT_DEAD;
        } else {
          p.inCar.speed *= 0.94;
          if (random() < dt * 0.5) {
            cop.speed *= 0.4;
            burst(cop.x, cop.y, '#f2c230', 8, 160);
          }
        }
      }
    }
    return 0;
  }

  // --- traffic --------------------------------------------------------------
  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.police) continue;
      if (state.player.inCar === car) continue;
      // Follow the road grid: steer toward the nearest road centre, keep speed.
      const onX = ROADS_X.reduce((a, b) => (Math.abs(car.x - b) < Math.abs(car.x - a) ? b : a), ROADS_X[0]);
      const onY = ROADS_Y.reduce((a, b) => (Math.abs(car.y - b) < Math.abs(car.y - a) ? b : a), ROADS_Y[0]);
      const vertical = Math.abs(car.x - onX) < Math.abs(car.y - onY);
      const targetAngle = vertical
        ? (Math.sin(car.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2)
        : (Math.cos(car.angle) >= 0 ? 0 : Math.PI);
      car.angle = angleLerp(car.angle, targetAngle, Math.min(1, dt * 1.5));
      car.speed = Math.min(120 + (car.model.top - 210) * 0.4, car.speed + car.model.accel * 0.5 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // Turn around at the world edge instead of driving off the map.
      if (car.x < 60 || car.x > WORLD.width - 60 || car.y < 60 || car.y > WORLD.height - 60) {
        car.angle += Math.PI;
        car.x = clamp(car.x, 60, WORLD.width - 60);
        car.y = clamp(car.y, 60, WORLD.height - 60);
      }
      // Nudge out of buildings.
      const hit = pointInBuildings(city.buildings, car.x, car.y, 10);
      if (hit) {
        car.angle += Math.PI / 2;
        car.speed *= 0.5;
      }
    }
    // Simple car-car separation so traffic does not stack into one blob.
    for (let i = 0; i < state.cars.length; i += 1) {
      for (let j = i + 1; j < state.cars.length; j += 1) {
        const a = state.cars[i]; const b = state.cars[j];
        const d = dist2(a.x, a.y, b.x, b.y);
        if (d < 50 * 50 && d > 0.01) {
          const dd = Math.sqrt(d);
          const push = (50 - dd) / 2;
          const nx = (b.x - a.x) / dd; const ny = (b.y - a.y) / dd;
          if (state.player.inCar !== a) { a.x -= nx * push; a.y -= ny * push; }
          if (state.player.inCar !== b) { b.x += nx * push; b.y += ny * push; }
        }
      }
    }
  }

  function updatePeds(dt) {
    const p = state.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    for (const ped of state.peds) {
      ped.wander -= dt;
      if (ped.wander <= 0) {
        ped.wander = 2 + random() * 4;
        ped.angle = random() * TAU;
      }
      const dPlayer = Math.sqrt(dist2(ped.x, ped.y, px, py));
      if (dPlayer < 90 && (state.wanted > 0 || (p.inCar && p.inCar.speed > 120))) ped.scared = 2;
      if (ped.scared > 0) {
        ped.scared -= dt;
        const away = Math.atan2(ped.y - py, ped.x - px);
        ped.angle = angleLerp(ped.angle, away, Math.min(1, dt * 6));
        ped.x += Math.cos(ped.angle) * ped.speed * 2.2 * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * 2.2 * dt;
      } else {
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
      ped.x = clamp(ped.x, 30, WORLD.width - 30);
      ped.y = clamp(ped.y, 30, WORLD.height - 30);
      const hit = pointInBuildings(city.buildings, ped.x, ped.y, 4);
      if (hit) ped.angle += Math.PI / 2;
    }
  }

  function updateBullets(dt) {
    let events = 0;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height) {
        state.bullets.splice(i, 1);
        continue;
      }
      // Hit a pedestrian or a police car.
      for (const ped of state.peds) {
        if (dist2(b.x, b.y, ped.x, ped.y) < 16 * 16) {
          burst(ped.x, ped.y, '#c0392b', 10, 140);
          ped.x = -1000;
          state.bullets.splice(i, 1);
          state.kills += 1;
          events |= addWanted(8);
          break;
        }
      }
      if (i >= state.bullets.length) continue;
      for (const cop of state.police) {
        if (dist2(b.x, b.y, cop.x, cop.y) < 26 * 26) {
          burst(cop.x, cop.y, '#f2c230', 12, 180);
          cop.speed *= 0.3;
          state.bullets.splice(i, 1);
          events |= addWanted(5);
          break;
        }
      }
    }
    // Respawn peds that were removed so the streets stay alive.
    if (state.peds.some((p) => p.x < -100)) {
      state.peds = state.peds.filter((p) => p.x >= -100);
      spawnPeds(2);
    }
    return events;
  }

  function updatePickups(dt) {
    let events = 0;
    const p = state.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    for (const pk of state.pickups) {
      pk.bob += dt * 3;
      if (pk.taken) continue;
      if (dist2(px, py, pk.x, pk.y) < 34 * 34) {
        pk.taken = true;
        if (pk.kind === 'cash') {
          state.cash += 50;
          state.score += 50;
          setMessage('Found $50 in a dropped wallet.');
          events |= EVENT_CASH;
        } else {
          state.health = Math.min(PLAYER_HEALTH, state.health + 40);
          setMessage('First-aid kit: +40 health.');
          events |= EVENT_PICKUP;
        }
      }
    }
    return events;
  }

  // --- player ---------------------------------------------------------------
  function updatePlayer(dt, input) {
    let events = 0;
    const p = state.player;
    if (p.shootCooldown > 0) p.shootCooldown -= dt;
    if (p.punchCooldown > 0) p.punchCooldown -= dt;

    if (p.inCar) {
      const car = p.inCar;
      const ax = input.axis();
      const forward = -ax.y; // W is up on screen, which is forward for the car
      const steer = ax.x;
      if (forward !== 0) {
        car.speed += forward * car.model.accel * dt;
        if (forward < 0) car.speed = Math.max(car.speed, -90);
      } else {
        car.speed *= Math.max(0, 1 - dt * 0.8);
      }
      if (input.isDown(' ')) car.speed *= Math.max(0, 1 - dt * 3.5);
      car.speed = clamp(car.speed, -100, car.model.top);
      const turnRate = car.model.grip * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 90);
      car.angle += steer * turnRate * dt * (car.speed >= 0 ? 1 : -1);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const hit = pointInBuildings(city.buildings, nx, ny, 12);
      if (hit) {
        car.speed *= -0.3;
        events |= EVENT_CRASH;
        burst(nx, ny, '#e8b64c', 6, 120);
      } else {
        car.x = clamp(nx, 30, WORLD.width - 30);
        car.y = clamp(ny, 30, WORLD.height - 30);
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = car.speed;
      // Rival cabs in mission 2 are rammed off when hit hard.
      for (let i = state.rivals.length - 1; i >= 0; i -= 1) {
        const r = state.rivals[i];
        if (dist2(car.x, car.y, r.x, r.y) < 52 * 52 && Math.abs(car.speed) > 80) {
          burst(r.x, r.y, '#f2c230', 14, 200);
          const idx = state.cars.indexOf(r);
          if (idx >= 0) state.cars.splice(idx, 1);
          state.rivals.splice(i, 1);
          state.score += 100;
          setMessage('Rival cab run off the road!');
          events |= EVENT_CRASH;
        }
      }
      return events;
    }

    // On foot.
    const ax = input.axis();
    const len = Math.hypot(ax.x, ax.y) || 1;
    const mx = (ax.x / len) * PLAYER_SPEED * (ax.x || ax.y ? 1 : 0);
    const my = (ax.y / len) * PLAYER_SPEED * (ax.x || ax.y ? 1 : 0);
    const nx = p.x + mx * dt;
    const ny = p.y + my * dt;
    if (!pointInBuildings(city.buildings, nx, p.y, 10)) p.x = clamp(nx, 20, WORLD.width - 20);
    if (!pointInBuildings(city.buildings, p.x, ny, 10)) p.y = clamp(ny, 20, WORLD.height - 20);
    if (ax.x || ax.y) p.angle = Math.atan2(my, mx);
    else p.angle = Math.atan2(input.mouse.y - 400, input.mouse.x - 640);

    // Aim with the mouse when standing still; shooting follows the aim.
    const aimX = input.mouse.x - 640;
    const aimY = input.mouse.y - 400;
    if (Math.hypot(aimX, aimY) > 30) p.angle = Math.atan2(aimY, aimX);

    if (input.mouse.clicked && p.shootCooldown <= 0) {
      p.shootCooldown = 0.28;
      fireBullet();
      events |= EVENT_SHOOT;
      events |= addWanted(2);
    }
    if (input.wasPressed('f') && p.punchCooldown <= 0) {
      p.punchCooldown = 0.4;
      events |= EVENT_PUNCH;
      for (const ped of state.peds) {
        if (dist2(p.x, p.y, ped.x, ped.y) < 40 * 40) {
          ped.scared = 3;
          ped.x += Math.cos(p.angle) * 30;
          ped.y += Math.sin(p.angle) * 30;
          events |= addWanted(4);
        }
      }
    }
    return events;
  }

  // --- main step ------------------------------------------------------------
  function step(dt, input) {
    let events = 0;
    state.time += dt;
    state.clock = (8 * 60 + state.time / 2) % (24 * 60);
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.wanted > 0) {
      state.wantedHeat = Math.max(0, state.wantedHeat - dt * 1.1);
      const before = state.wanted;
      state.wanted = state.wantedHeat < 12 ? 0 : state.wantedHeat < 28 ? 1 : state.wantedHeat < 45 ? 2
        : state.wantedHeat < 62 ? 3 : state.wantedHeat < 82 ? 4 : 5;
      if (before > 0 && state.wanted === 0) setMessage('You lost the heat. Lay low.');
    }

    if (input.wasPressed('e')) {
      if (state.player.inCar) exitCar();
      else {
        const car = nearestCar(state.player.x, state.player.y, 70);
        if (car) enterCar(car);
      }
    }
    // Missions start from the mission list (Enter there); M only opens it.

    events |= updatePlayer(dt, input);
    events |= updateTraffic(dt);
    events |= updatePolice(dt);
    updatePeds(dt);
    events |= updateBullets(dt);
    events |= updatePickups(dt);
    events |= updateMission(dt, events);

    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }

    if (state.health <= 0 && !state.gameOver) {
      state.gameOver = true;
      events |= EVENT_DEAD;
    }
    return events;
  }

  reset();
  return { state, city, reset, step, startMission, setMessage, missionMarker, isOnRoad };
}
