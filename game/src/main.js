// HADAL DIVE — boot and the one loop.
// Input is read every frame, the world advances in fixed 1/60 s steps, and the
// renderer paints what is there. Screens: title, play, draft, paused, game over,
// victory. ?seed=N fixes the trench. ?shot=title|play|draft|victory|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP, SCREENS, EVENT_OVER, EVENT_WIN, EVENT_LEVELUP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, resetWorld, stepWorld, chooseDraft } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, draftCardRects } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREENS.TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    resetWorld(world);
    accumulator = 0;
    screen = SCREENS.PLAY;
    announce('Diving. Depth 1. Harpoon fires on its own — aim with the mouse.');
  }

  function endGame(victory) {
    screen = victory ? SCREENS.VICTORY : SCREENS.OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (victory) audio.victory();
    else audio.gameover();
    announce(victory ? `Leviathan slain. Score ${world.state.score}.` : `Hull breached at depth ${world.state.depth}. Score ${world.state.score}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREENS.DRAFT) {
      const pick = input.takeDraftPick();
      if (pick >= 1 && pick <= 3 && chooseDraft(world, pick - 1)) {
        audio.draft();
        screen = SCREENS.PLAY;
        announce('Upgrade taken. Keep diving.');
        return;
      }
      const click = input.takeClick();
      if (click) {
        const rects = draftCardRects();
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i];
          if (click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h && chooseDraft(world, i)) {
            audio.draft();
            screen = SCREENS.PLAY;
            announce('Upgrade taken. Keep diving.');
            return;
          }
        }
      }
      return;
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREENS.TITLE || screen === SCREENS.OVER || screen === SCREENS.VICTORY) startGame();
      else if (screen === SCREENS.PAUSED) {
        screen = SCREENS.PLAY;
        announce('Diving.');
      }
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREENS.PLAY) {
      screen = SCREENS.PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_PAUSE && screen === SCREENS.PAUSED) {
      screen = SCREENS.PLAY;
      announce('Diving.');
    }
    // A click on the title / end screens also starts (or resumes from pause).
    const click = input.takeClick();
    if (click) {
      audio.unlock();
      if (screen === SCREENS.TITLE || screen === SCREENS.OVER || screen === SCREENS.VICTORY) startGame();
      else if (screen === SCREENS.PAUSED) screen = SCREENS.PLAY;
    }
  }

  function step() {
    if (screen === SCREENS.TITLE) {
      // Attract mode: the trench drifts behind the title. The sub cannot sink here.
      stepWorld(world, { x: 0, y: 0, aimX: 640, aimY: 300, dash: false }, STEP, null);
      world.state.player.hull = world.state.player.maxHull;
      world.state.over = false;
      if (world.state.draft) world.state.draft = null;
      return;
    }
    const events = stepWorld(world, input.control(), STEP, audio);
    audio.tick(STEP);
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_LEVELUP && world.state.draft) {
      screen = SCREENS.DRAFT;
      announce('Level up. Choose an upgrade.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREENS.TITLE || screen === SCREENS.PLAY) {
      while (accumulator >= STEP && (screen === SCREENS.TITLE || screen === SCREENS.PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREENS.PLAY) {
      screen = SCREENS.PAUSED;
      announce('Paused.');
    }
  });

  // A handle for scripted play-testing: state, screens and controls, read-only use.
  window.__hadal = {
    state: world.state,
    screen: () => screen,
    start: () => startGame(),
    version: 'hadal-dive-1',
  };

  announce('Hadal Dive. Press Enter or click to dive.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
