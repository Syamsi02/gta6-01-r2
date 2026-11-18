// Meridian Heat — boot and the one loop.
// Screens: title, play, paused, missions, game over. The world advances in fixed
// 1/60 s steps and the renderer paints what is there. Cash, score and mission
// progress save to localStorage every few seconds and on game over.
//
// ?seed=N fixes the city. ?shot=chase|street|beach|title stages that scene for a
// screenshot instead of running the loop, then sets window.__shotReady.

import { SAVE_KEY } from './config.js';
import {
  createGame, EVENT_SHOOT, EVENT_PICKUP, EVENT_CASH, EVENT_WANTED,
  EVENT_MISSION, EVENT_CRASH, EVENT_DEAD, EVENT_PUNCH,
} from './world.js';
import { createInput } from './input.js';
import {
  createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED,
  SCREEN_OVER, SCREEN_MISSIONS,
} from './render.js';
import { stageShot } from './shots.js';
import { ensureAudio, startMusic, sfx } from './audio.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const SAVE_EVERY_SECONDS = 10;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(seed);
const renderer = createRenderer(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.state.cash,
      score: game.state.score,
      missionIndex: game.state.missionIndex,
      carsStolen: game.state.carsStolen,
      kills: game.state.kills,
      savedAt: Date.now(),
    }));
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
  }
}

function applySave(save) {
  if (!save) return;
  game.state.cash = save.cash || 120;
  game.state.score = save.score || 0;
  game.state.missionIndex = Math.min(save.missionIndex || 0, 3);
  game.state.carsStolen = save.carsStolen || 0;
  game.state.kills = save.kills || 0;
}

function runShot(name) {
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game.state, game.city, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const save = readSave();
  let screen = SCREEN_TITLE;
  let best = save ? save.score || 0 : 0;
  let saveLoaded = false;
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;

  function announce(message) { status.textContent = message; }

  function startGame() {
    ensureAudio();
    startMusic();
    if (save && !saveLoaded) {
      applySave(save);
      saveLoaded = true;
    }
    screen = SCREEN_PLAY;
    announce('Playing Meridian Heat.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (game.state.score > best) best = game.state.score;
    writeSave();
    announce(`Busted. Score ${game.state.score}. Best ${best}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_SHOOT) sfx.shoot();
    if (events & EVENT_PUNCH) sfx.punch();
    if (events & EVENT_PICKUP) sfx.pickup();
    if (events & EVENT_CASH) sfx.cash();
    if (events & EVENT_WANTED) sfx.wanted();
    if (events & EVENT_MISSION) sfx.mission();
    if (events & EVENT_CRASH) sfx.crash();
    if (events & EVENT_DEAD) endGame();
  }

  // One frame's worth of menu keys. The world itself reads M (start mission)
  // and E (enter car) inside step(), so this only handles screen changes.
  function handleMenuKeys() {
    if (input.wasPressed('Enter')) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_MISSIONS) {
        screen = SCREEN_PLAY;
        game.startMission();
        sfx.mission();
      }
      return;
    }
    if (input.mouse.clicked && screen === SCREEN_TITLE) { startGame(); return; }
    if (input.wasPressed('p')) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
      return;
    }
    if (input.wasPressed('m')) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_MISSIONS; announce('Mission list.'); }
      else if (screen === SCREEN_MISSIONS) { screen = SCREEN_PLAY; }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    handleMenuKeys();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        handleEvents(game.step(STEP, input));
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
      saveTimer += 1 / 60;
      if (saveTimer >= SAVE_EVERY_SECONDS) { saveTimer = 0; writeSave(); }
    } else {
      accumulator = 0;
    }
    renderer.draw(game.state, game.city, screen, best);
    input.endFrame();
  }

  // Leaving the tab pauses a running game rather than letting the police
  // close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
  });

  announce('Meridian Heat. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
