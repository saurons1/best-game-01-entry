// HADAL DIVE — keyboard and mouse input.
// WASD / arrows steer the bathyscaphe, the mouse aims the harpoon, Space dashes,
// P pauses, M mutes, 1/2/3 pick a draft card, Enter or click confirms on menus.
// The loop reads one control object per step: move direction, aim point, dash edge.
import { VIEW_W, VIEW_H } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: VIEW_W / 2, y: VIEW_H / 2 - 120, down: false, clicked: false, clickX: 0, clickY: 0 };
  let actions = 0;
  let draftPick = 0;
  let dashEdge = false;

  function canvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW_W,
      y: ((clientY - rect.top) / rect.height) * VIEW_H,
    };
  }

  function onKeyDown(event) {
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'Space') dashEdge = true;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'Digit1') draftPick = 1;
    if (event.code === 'Digit2') draftPick = 2;
    if (event.code === 'Digit3') draftPick = 3;
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    const p = canvasPoint(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  }
  function onMouseDown(event) {
    const p = canvasPoint(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = p.x;
    mouse.clickY = p.y;
  }
  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** Move vector (-1..1 each axis), aim point, and whether dash was pressed. */
    control() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const dir = MOVE_KEYS[code];
        if (dir) {
          x += dir[0];
          y += dir[1];
        }
      }
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      // Dash is an edge: read it here and clear it, so the action pass that runs
      // before the step cannot swallow it.
      const dash = dashEdge;
      dashEdge = false;
      return { x, y, aimX: mouse.x, aimY: mouse.y, dash };
    },
    takeActions() {
      const out = actions;
      actions = 0;
      return out;
    },
    takeDraftPick() {
      const out = draftPick;
      draftPick = 0;
      return out;
    },
    takeClick() {
      if (!mouse.clicked) return null;
      mouse.clicked = false;
      return { x: mouse.clickX, y: mouse.clickY };
    },
    mouseDown() {
      return mouse.down;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
