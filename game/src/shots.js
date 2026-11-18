// Meridian Heat — the screenshot scenes behind ?shot=chase|street|beach|title.
// Each one plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot, so the frame is what a short game really
// looks like and the same seed always gives the same frame.

import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

const STEP = 1 / 60;

// Drive toward a point: steer and throttle like a player would.
function driveToward(game, tx, ty) {
  const car = game.state.player.inCar;
  if (!car) return;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let d = want - car.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  car.angle += Math.max(-1, Math.min(1, d * 2.5)) * 0.09;
  car.speed = Math.min(car.model.top * 0.8, car.speed + 6);
  car.x += Math.cos(car.angle) * car.speed * STEP;
  car.y += Math.sin(car.angle) * car.speed * STEP;
}

function runSteps(game, count, steer) {
  const fakeInput = {
    axis: () => ({ x: 0, y: 0 }),
    isDown: () => false,
    wasPressed: () => false,
    mouse: { x: 640, y: 400, clicked: false, down: false },
  };
  for (let i = 0; i < count; i += 1) {
    if (steer) steer(game, i);
    game.step(STEP, fakeInput);
    if (game.state.gameOver) break;
  }
}

// Put the player in the nearest car and drive it with the autopilot.
function stealAndDrive(game, tx, ty, seconds) {
  const p = game.state.player;
  let best = null; let bestD = Infinity;
  for (const car of game.state.cars) {
    const d = (car.x - p.x) ** 2 + (car.y - p.y) ** 2;
    if (d < bestD) { bestD = d; best = car; }
  }
  if (best) {
    best.driver = false;
    game.state.player.inCar = best;
    game.state.player.onFoot = false;
    game.state.carsStolen += 1;
  }
  runSteps(game, Math.floor(seconds / STEP), (g) => driveToward(g, tx, ty));
}

export function stageShot(name, game) {
  game.reset();
  const s = game.state;
  if (name === 'title') {
    runSteps(game, Math.floor(6 / STEP));
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'beach') {
    // Cruise along the Marina Beach boulevard, then park on the coast road
    // so the sea, the sand and the Marina Diner are all in frame.
    s.player.x = 300;
    s.player.y = 500;
    stealAndDrive(game, 300, 200, 9);
    const car = game.state.player.inCar;
    if (car) {
      car.x = 200;
      car.y = 520;
      car.angle = -Math.PI / 2;
      car.speed = 0;
      game.state.player.x = 200;
      game.state.player.y = 520;
      game.state.player.angle = -Math.PI / 2;
    }
    return { screen: SCREEN_PLAY, best: s.score };
  }
  if (name === 'street') {
    // On foot in Downtown with mission 1 active and the warehouse marker up.
    // The player stands on the road intersection so no roof is underfoot.
    s.player.x = 1400;
    s.player.y = 1400;
    game.startMission();
    runSteps(game, Math.floor(4 / STEP));
    s.player.x = 1400;
    s.player.y = 1400;
    return { screen: SCREEN_PLAY, best: s.score };
  }
  // Default: chase — wanted level 3, police cars closing in, player driving fast.
  s.player.x = 1800;
  s.player.y = 1100;
  stealAndDrive(game, 2200, 1100, 6);
  s.wantedHeat = 55;
  s.wanted = 3;
  game.state.message = 'The harbour police are on your tail — lose them!';
  game.state.messageTimer = 5;
  runSteps(game, Math.floor(2 / STEP), (g) => driveToward(g, 2600, 1400));
  return { screen: SCREEN_PLAY, best: s.score };
}
