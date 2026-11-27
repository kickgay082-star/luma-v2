import { ColliderBox, SeatState, Vec3 } from '../types.js';

export const PLAYER_RADIUS = 0.42;

/**
 * Resolves 2D circle-vs-AABB collisions on the XZ plane with smooth sliding
 * and room boundary clamping so avatars never pass through walls, furniture, or props.
 */
export function resolvePlayerMovement(
  currentPos: Vec3,
  desiredPos: Vec3,
  colliders: ColliderBox[],
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  radius: number = PLAYER_RADIUS,
): Vec3 {
  let x = clamp(desiredPos[0], bounds.minX + radius + 0.15, bounds.maxX - radius - 0.15);
  let z = clamp(desiredPos[2], bounds.minZ + radius + 0.15, bounds.maxZ - radius - 0.15);
  const y = desiredPos[1];

  // Two relaxation passes ensure clean resolution at corners between adjacent seats/walls
  for (let pass = 0; pass < 2; pass++) {
    for (const box of colliders) {
      const closestX = clamp(x, box.minX, box.maxX);
      const closestZ = clamp(z, box.minZ, box.maxZ);
      const dx = x - closestX;
      const dz = z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          x += (dx / dist) * overlap;
          z += (dz / dist) * overlap;
        } else {
          // Center is inside box; push out along minimum penetration axis
          const penLeft = Math.abs(x - box.minX);
          const penRight = Math.abs(box.maxX - x);
          const penTop = Math.abs(z - box.minZ);
          const penBottom = Math.abs(box.maxZ - z);
          const minPen = Math.min(penLeft, penRight, penTop, penBottom);

          if (minPen === penLeft) x = box.minX - radius;
          else if (minPen === penRight) x = box.maxX + radius;
          else if (minPen === penTop) z = box.minZ - radius;
          else z = box.maxZ + radius;
        }
      }
    }
  }

  x = clamp(x, bounds.minX + radius + 0.15, bounds.maxX - radius - 0.15);
  z = clamp(z, bounds.minZ + radius + 0.15, bounds.maxZ - radius - 0.15);

  if (Number.isNaN(x) || Number.isNaN(z)) {
    return currentPos;
  }

  return [x, y, z];
}

/**
 * Prevents the third-person camera from clipping through outer walls or ceiling.
 */
export function clampCameraPosition(
  desiredPos: Vec3,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  margin: number = 0.45,
): Vec3 {
  return [
    clamp(desiredPos[0], bounds.minX + margin, bounds.maxX - margin),
    clamp(desiredPos[1], 0.55, 7.6),
    clamp(desiredPos[2], bounds.minZ + margin, bounds.maxZ - margin),
  ];
}

export function findNearestInteractableSeat(
  playerPos: Vec3,
  seats: SeatState[],
  maxDistance: number = 2.1,
): { seat: SeatState; distance: number } | null {
  let best: { seat: SeatState; distance: number } | null = null;
  for (const seat of seats) {
    const dx = playerPos[0] - seat.position[0];
    const dz = playerPos[2] - seat.position[2];
    const dist = Math.hypot(dx, dz);
    if (dist <= maxDistance) {
      if (!best || dist < best.distance) {
        best = { seat, distance: dist };
      }
    }
  }
  return best;
}

/**
 * Computes spatial audio gain attenuation matching Luma proximity zones:
 * - 0-3m: crystal clear (1.0)
 * - 3-8m: natural conversation dropoff (1.0 -> 0.45)
 * - 8-15m: fading distance (0.45 -> 0.04)
 * - > maxDistance: silent (0.0)
 */
export function computeSpatialAttenuation(
  distance: number,
  refDistance: number = 3,
  maxDistance: number = 15,
): number {
  if (distance <= refDistance) return 1;
  if (distance >= maxDistance) return 0;

  const midPoint = Math.min(maxDistance * 0.55, Math.max(refDistance + 1, 8));
  if (distance <= midPoint) {
    const t = (distance - refDistance) / (midPoint - refDistance);
    return 1 - t * 0.55;
  }

  const t = (distance - midPoint) / (maxDistance - midPoint);
  return Math.max(0, 0.45 * Math.pow(1 - t, 1.6));
}

export function distance3D(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
