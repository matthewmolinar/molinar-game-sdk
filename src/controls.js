/**
 * Input handling and direction conversion for camera-relative controls.
 * Supports keyboard, touch swipe, and joystick input.
 */

import { normalizeAngle } from "./camera";

/**
 * Convert screen-space direction to world-space grid direction based on camera orbit angle.
 * Derived directly from camera position math for consistency.
 *
 * @param {number} screenDx - Screen X direction (-1 = left, 1 = right)
 * @param {number} screenDy - Screen Y direction (-1 = up, 1 = down)
 * @param {number} cameraOrbitAngle - Current camera orbit angle in radians
 * @returns {Object} { dx, dz } - World grid direction
 */
export function screenToWorldDirection(screenDx, screenDy, cameraOrbitAngle) {
  const angle = normalizeAngle(cameraOrbitAngle);

  // Camera position relative to player (from camera code):
  //   camOffsetX = sin(angle) * dist
  //   camOffsetZ = -cos(angle) * dist
  // So camera is at player + (sin(angle), y, -cos(angle))
  //
  // Camera's view direction (from camera toward player) is:
  //   (-sin(angle), ?, cos(angle)) - pointing toward player
  //
  // "Screen up" (W key, -screenDy) should move player AWAY from camera
  // That's the same direction as camera's view: (-sin(angle), 0, cos(angle))
  //
  // "Screen right" (D key, +screenDx) should move player to camera's right
  // Camera right = (-cos(angle), 0, -sin(angle))

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Forward (screen up): direction camera is looking = (-sinA, 0, cosA)
  // Right (screen right): camera's right vector = (-cosA, 0, -sinA)
  const forwardX = -sinA;
  const forwardZ = cosA;
  const rightX = -cosA;
  const rightZ = -sinA;

  // Screen up = -screenDy (negative Y is up on screen)
  const fwd = -screenDy;
  const rgt = screenDx;

  const worldX = fwd * forwardX + rgt * rightX;
  const worldZ = fwd * forwardZ + rgt * rightZ;

  // Snap to cardinal direction (grid-based movement)
  if (Math.abs(worldX) > Math.abs(worldZ)) {
    return { dx: worldX > 0 ? 1 : -1, dz: 0 };
  } else {
    return { dx: 0, dz: worldZ > 0 ? 1 : -1 };
  }
}

/**
 * Parse keyboard event to screen direction
 * @param {string} code - KeyboardEvent.code
 * @returns {Object|null} { screenDx, screenDy } or null if not a movement key
 */
export function keyCodeToScreenDirection(code) {
  let screenDx = 0, screenDy = 0;

  if (["ArrowUp", "KeyW"].includes(code)) screenDy = -1;
  else if (["ArrowDown", "KeyS"].includes(code)) screenDy = 1;
  else if (["ArrowLeft", "KeyA"].includes(code)) screenDx = -1;
  else if (["ArrowRight", "KeyD"].includes(code)) screenDx = 1;
  else return null;

  return { screenDx, screenDy };
}

/**
 * Determine swipe direction from touch delta
 * @param {number} dx - Touch delta X
 * @param {number} dy - Touch delta Y
 * @param {number} threshold - Minimum distance to register as swipe
 * @returns {Object|null} { screenDx, screenDy } or null if below threshold
 */
export function touchDeltaToScreenDirection(dx, dy, threshold = 18) {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX < threshold && absY < threshold) {
    return null; // Not a swipe
  }

  if (absX > absY) {
    // Horizontal swipe
    return { screenDx: dx > 0 ? 1 : -1, screenDy: 0 };
  } else {
    // Vertical swipe
    return { screenDx: 0, screenDy: dy > 0 ? 1 : -1 };
  }
}

/**
 * Determine joystick direction from position
 * @param {number} dx - Joystick delta X from center
 * @param {number} dy - Joystick delta Y from center
 * @param {number} threshold - Minimum distance to register direction
 * @returns {Object} { screenDx, screenDy } - May be (0,0) if below threshold
 */
export function joystickToScreenDirection(dx, dy, threshold = 20) {
  if (Math.abs(dx) <= threshold && Math.abs(dy) <= threshold) {
    return { screenDx: 0, screenDy: 0 };
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    return { screenDx: dx > 0 ? 1 : -1, screenDy: 0 };
  } else {
    return { screenDx: 0, screenDy: dy > 0 ? 1 : -1 };
  }
}

/**
 * Create touch state tracker
 * @returns {Object} Touch state object
 */
export function createTouchState() {
  return {
    start: null,        // { x, y, t }
    lastTapTime: 0,
    pinchStartDist: null,
    pinchStartZoom: null,
    cameraTouchId: null, // Track specific touch for camera drag (allows simultaneous joystick + camera)
  };
}

/**
 * Calculate pinch distance between two touches
 * @param {Touch} a - First touch
 * @param {Touch} b - Second touch
 * @returns {number} Distance between touches
 */
export function getPinchDistance(a, b) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

/**
 * Check if a tap is a double-tap
 * @param {number} lastTapTime - Time of last tap
 * @param {number} threshold - Max time between taps (ms)
 * @returns {boolean} True if double-tap
 */
export function isDoubleTap(lastTapTime, threshold = 250) {
  return performance.now() - lastTapTime < threshold;
}

/**
 * Setup document styles to prevent mobile scroll/bounce
 * @returns {Object} Previous styles to restore on cleanup
 */
export function setupMobileStyles() {
  const prev = {
    htmlOverflow: document.documentElement.style.overflow,
    htmlOverscroll: document.documentElement.style.overscrollBehavior,
    bodyOverscroll: document.body.style.overscrollBehavior,
    bodyTouchAction: document.body.style.touchAction,
    htmlUserSelect: document.documentElement.style.userSelect,
    bodyUserSelect: document.body.style.userSelect,
    htmlWebkitUserSelect: document.documentElement.style.webkitUserSelect,
    bodyWebkitUserSelect: document.body.style.webkitUserSelect,
    bodyCallout: document.body.style.webkitTouchCallout,
  };

  document.documentElement.style.overflow = "hidden";
  document.documentElement.style.overscrollBehavior = "none";
  document.body.style.overscrollBehavior = "none";
  document.body.style.touchAction = "none";
  document.documentElement.style.userSelect = "none";
  document.body.style.userSelect = "none";
  document.documentElement.style.webkitUserSelect = "none";
  document.body.style.webkitUserSelect = "none";
  document.body.style.webkitTouchCallout = "none";

  return prev;
}

/**
 * Restore document styles
 * @param {Object} prev - Previous styles from setupMobileStyles
 */
export function restoreMobileStyles(prev) {
  document.documentElement.style.overflow = prev.htmlOverflow;
  document.documentElement.style.overscrollBehavior = prev.htmlOverscroll;
  document.body.style.overscrollBehavior = prev.bodyOverscroll;
  document.body.style.touchAction = prev.bodyTouchAction;
  document.documentElement.style.userSelect = prev.htmlUserSelect;
  document.body.style.userSelect = prev.bodyUserSelect;
  document.documentElement.style.webkitUserSelect = prev.htmlWebkitUserSelect;
  document.body.style.webkitUserSelect = prev.bodyWebkitUserSelect;
  document.body.style.webkitTouchCallout = prev.bodyCallout;
}
