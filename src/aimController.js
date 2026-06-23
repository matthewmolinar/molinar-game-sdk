import * as THREE from "three";

/**
 * createAimController — a standardized ranged-aim tool (bow, gun, slingshot…).
 *
 * It does NOT own the weapon model (that's attached to the player via
 * attachItem) or the projectile (the game fires that in onFire). What it
 * standardizes is the *aim feel*: while the player aims, the camera smoothly
 * zooms from a scenic `rest` pose to a first-person / down-the-weapon `aim`
 * pose (aim-down-sights), and it reports draw `power` + `aim` direction so the
 * game can draw its reticle and fire.
 *
 * Usage:
 *   const aimer = createAimController({ camera, rest, aim });
 *   onPointerDown: aimer.start(x, y)
 *   onPointerMove: aimer.moveTo(x, y); const { power, aim } = aimer.metrics();
 *   onPointerUp:   const { power, aim } = aimer.end(); fireProjectile(power, aim)
 *   each frame:    aimer.update(dt)  // drives the camera
 *
 * @param {object} opts
 * @param {THREE.PerspectiveCamera} opts.camera
 * @param {{position:number[], lookAt:number[], fov?:number}} opts.rest  scenic pose
 * @param {{position:number[], lookAt:number[], fov?:number}} opts.aim   zoomed/first-person pose
 * @param {number} [opts.smooth=0.18]   camera ease (0..1 per ~16ms)
 * @param {number} [opts.maxDragPx=220]  drag length that maps to full power
 * @param {boolean} [opts.mirror=true]   slingshot aim (pull down-right → aim up-left)
 */
export function createAimController({ camera, rest, aim, smooth = 0.18, maxDragPx = 220, mirror = true }) {
  const v = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const restPos = v(rest.position), restLook = v(rest.lookAt);
  const aimPos = v(aim.position), aimLook = v(aim.lookAt);
  const restFov = rest.fov ?? camera.fov;
  const aimFov = aim.fov ?? restFov;

  let aiming = false;
  let drag = null; // { x0, y0, x, y }
  const curPos = restPos.clone();
  const curLook = restLook.clone();
  let curFov = restFov;

  function metrics() {
    if (!drag) return { power: 0, aim: { x: 0, y: 0 } };
    const dx = drag.x - drag.x0;
    const dy = drag.y - drag.y0;
    const power = Math.min(1, Math.hypot(dx, dy) / maxDragPx);
    const s = mirror ? -1 : 1;
    return { power, aim: { x: s * dx, y: s * dy } };
  }

  function start(x, y) { aiming = true; drag = { x0: x, y0: y, x, y }; }
  function moveTo(x, y) { if (drag) { drag.x = x; drag.y = y; } }
  function cancel() { aiming = false; drag = null; }
  /** End the aim and return the shot it produced. */
  function end() { const m = metrics(); aiming = false; drag = null; return m; }

  /** Drive the camera toward the current goal pose. Call once per frame. */
  function update(dt = 0.016, extraOffset = null) {
    const k = 1 - Math.pow(1 - smooth, Math.max(dt, 0.0001) * 60);
    curPos.lerp(aiming ? aimPos : restPos, k);
    curLook.lerp(aiming ? aimLook : restLook, k);
    curFov += ((aiming ? aimFov : restFov) - curFov) * k;

    camera.position.copy(curPos);
    if (extraOffset) camera.position.add(extraOffset); // idle sway / shake on top
    camera.lookAt(curLook);
    if (Math.abs(camera.fov - curFov) > 0.01) {
      camera.fov = curFov;
      camera.updateProjectionMatrix();
    }
  }

  return {
    start, moveTo, end, cancel, metrics, update,
    get aiming() { return aiming; },
    get progress() { return curPos.distanceTo(restPos) / (aimPos.distanceTo(restPos) || 1); },
  };
}
