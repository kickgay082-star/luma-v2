'use client';

import { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  buildRoomGeometry,
  clampCameraPosition,
  findNearestInteractableSeat,
  getFloorElevationAt,
  PlayerAnimState,
  PlayerState,
  PlayerTransformUpdate,
  resolvePlayerMovement,
  RoomCustomization,
  SeatState,
  Vec3,
} from '@luma/shared';
import { Avatar3D } from './Avatar3D';
import { RemoteTargetTransform, useLumaStore } from '@/stores/useLumaStore';
import { useFourDStore } from '@/stores/useFourDStore';

export type CameraMode = 'follow' | 'orbit' | 'cinema';

export interface MobileInputState {
  moveX: number; // -1..1
  moveY: number; // -1..1 (forward positive)
  run: boolean;
}

interface LocalPlayerControllerProps {
  localPlayer: PlayerState;
  customization: RoomCustomization;
  seats: SeatState[];
  cameraMode: CameraMode;
  cameraZoom: number;
  inputLocked: boolean; // true when typing in chat/modals
  mobileInputRef: MutableRefObject<MobileInputState>;
  listenerTransformRef: MutableRefObject<{
    position: Vec3;
    forward: Vec3;
    up: Vec3;
  }>;
  onTransformEmit: (update: PlayerTransformUpdate) => void;
  onNearestSeatChange: (seat: SeatState | null) => void;
  onInteractSeat: (seat: SeatState | null) => void;
  onLocalPositionChange?: (pos: Vec3) => void;
}

export function LocalPlayerController({
  localPlayer,
  customization,
  seats,
  cameraMode,
  cameraZoom,
  inputLocked,
  mobileInputRef,
  listenerTransformRef,
  onTransformEmit,
  onNearestSeatChange,
  onInteractSeat,
  onLocalPositionChange,
}: LocalPlayerControllerProps) {
  const { camera, gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const posRef = useRef<Vec3>(localPlayer.position);
  const velRef = useRef<Vec3>([0, 0, 0]);
  const rotYRef = useRef<number>(localPlayer.rotationY);
  const animRef = useRef<PlayerAnimState>(localPlayer.animState);
  const orbitYawRef = useRef<number>(0); // 0 looks toward -Z (screen)
  const orbitPitchRef = useRef<number>(0.28);
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomOffsetRef = useRef<number>(0);
  const seqRef = useRef<number>(0);
  const lastEmitTimeRef = useRef<number>(0);
  const lastSentPosRef = useRef<Vec3>(localPlayer.position);
  const lastSentAnimRef = useRef<PlayerAnimState>(localPlayer.animState);
  const lastNearestIdRef = useRef<string | null>(null);
  const waveUntilRef = useRef<number>(0);

  const geometry = useMemo(
    () => buildRoomGeometry(customization.theme, customization),
    [customization],
  );

  // Sync position when server snaps player into or out of a seat
  useEffect(() => {
    if (localPlayer.seatedSeatId) {
      posRef.current = [...localPlayer.position];
      rotYRef.current = localPlayer.rotationY;
      animRef.current = 'sit';
    } else if (
      Math.hypot(
        posRef.current[0] - localPlayer.position[0],
        posRef.current[2] - localPlayer.position[2],
      ) > 2.2
    ) {
      posRef.current = [...localPlayer.position];
    }
  }, [localPlayer.seatedSeatId, localPlayer.position, localPlayer.rotationY]);

  // Clear stuck keys when input locks, window loses focus, or player sits down
  useEffect(() => {
    keysRef.current = {};
  }, [inputLocked, localPlayer.seatedSeatId]);

  // Keyboard bindings
  useEffect(() => {
    const clearAllKeys = () => {
      keysRef.current = {};
    };

    const normalizeCode = (e: KeyboardEvent): string | null => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          return 'up';
        case 'KeyS':
        case 'ArrowDown':
          return 'down';
        case 'KeyA':
        case 'ArrowLeft':
          return 'left';
        case 'KeyD':
        case 'ArrowRight':
          return 'right';
        case 'ShiftLeft':
        case 'ShiftRight':
          return 'shift';
        default:
          return null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (inputLocked) {
        keysRef.current = {};
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const mapped = normalizeCode(e);
      if (mapped) {
        keysRef.current[mapped] = true;
      }

      const k = e.key.toLowerCase();
      if ((k === 'e' || k === 'f' || e.code === 'KeyE' || e.code === 'KeyF') && !e.repeat) {
        const nearest = findNearestInteractableSeat(posRef.current, seats, 2.2);
        onInteractSeat(nearest?.seat ?? null);
      }

      if ((k === ' ' || e.code === 'Space') && !localPlayer.seatedSeatId && !e.repeat) {
        waveUntilRef.current = performance.now() + 900;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const mapped = normalizeCode(e);
      if (mapped) {
        keysRef.current[mapped] = false;
      }
    };

    const onVisibility = () => {
      if (document.hidden) clearAllKeys();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearAllKeys);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearAllKeys);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [inputLocked, seats, localPlayer.seatedSeatId, onInteractSeat]);

  // Mouse orbit drag & zoom on the WebGL canvas
  useEffect(() => {
    const dom = gl.domElement;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0 || e.button === 2) {
        isDraggingRef.current = true;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      orbitYawRef.current -= dx * 0.0055;
      orbitPitchRef.current = THREE.MathUtils.clamp(
        orbitPitchRef.current + dy * 0.0045,
        -0.12,
        1.05,
      );
    };
    const onPointerUp = () => {
      isDraggingRef.current = false;
    };
    const onWheel = (e: WheelEvent) => {
      zoomOffsetRef.current = THREE.MathUtils.clamp(
        zoomOffsetRef.current + e.deltaY * 0.003,
        -2.0,
        4.0,
      );
    };
    const onContext = (e: MouseEvent) => e.preventDefault();

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: true });
    dom.addEventListener('contextmenu', onContext);
    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContext);
    };
  }, [gl]);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const keys = keysRef.current;

    let inputX = 0;
    let inputZ = 0;

    if (!inputLocked && !localPlayer.seatedSeatId) {
      if (keys['up']) inputZ -= 1;
      if (keys['down']) inputZ += 1;
      if (keys['left']) inputX -= 1;
      if (keys['right']) inputX += 1;

      if (Math.abs(mobileInputRef.current.moveX) > 0.05) {
        inputX += mobileInputRef.current.moveX;
      }
      if (Math.abs(mobileInputRef.current.moveY) > 0.05) {
        inputZ -= mobileInputRef.current.moveY;
      }
    }

    const isRunning = Boolean(keys['shift'] || mobileInputRef.current.run);
    const maxSpeed = isRunning ? 5.8 : 3.6;

    const len = Math.hypot(inputX, inputZ);
    if (len > 0.01 && !localPlayer.seatedSeatId) {
      const nx = inputX / Math.max(1, len);
      const nz = inputZ / Math.max(1, len);

      // Rotate input relative to camera yaw
      const yaw = orbitYawRef.current;
      const worldDirX = nx * Math.cos(yaw) + nz * Math.sin(yaw);
      const worldDirZ = -nx * Math.sin(yaw) + nz * Math.cos(yaw);

      const targetVx = worldDirX * maxSpeed;
      const targetVz = worldDirZ * maxSpeed;
      velRef.current[0] = THREE.MathUtils.lerp(velRef.current[0], targetVx, 12 * dt);
      velRef.current[2] = THREE.MathUtils.lerp(velRef.current[2], targetVz, 12 * dt);

      const desiredPos: Vec3 = [
        posRef.current[0] + velRef.current[0] * dt,
        posRef.current[1],
        posRef.current[2] + velRef.current[2] * dt,
      ];

      const resolved = resolvePlayerMovement(
        posRef.current,
        desiredPos,
        geometry.colliders,
        geometry.bounds,
      );
      resolved[1] = getFloorElevationAt(resolved[2], customization.seatLayout);
      posRef.current = resolved;

      const targetRotY = Math.atan2(worldDirX, worldDirZ);
      rotYRef.current = lerpAngle(rotYRef.current, targetRotY, 12 * dt);
      animRef.current = isRunning ? 'run' : 'walk';
    } else if (localPlayer.seatedSeatId) {
      velRef.current = [0, 0, 0];
      animRef.current = 'sit';
    } else {
      // Natural deceleration
      velRef.current[0] = THREE.MathUtils.lerp(velRef.current[0], 0, 14 * dt);
      velRef.current[2] = THREE.MathUtils.lerp(velRef.current[2], 0, 14 * dt);
      if (Math.hypot(velRef.current[0], velRef.current[2]) > 0.15) {
        const desiredPos: Vec3 = [
          posRef.current[0] + velRef.current[0] * dt,
          posRef.current[1],
          posRef.current[2] + velRef.current[2] * dt,
        ];
        const resolved = resolvePlayerMovement(
          posRef.current,
          desiredPos,
          geometry.colliders,
          geometry.bounds,
        );
        resolved[1] = getFloorElevationAt(resolved[2], customization.seatLayout);
        posRef.current = resolved;
      } else {
        velRef.current = [0, 0, 0];
        animRef.current = performance.now() < waveUntilRef.current ? 'wave' : 'idle';
      }
    }

    // Apply transform to local avatar group immediately (zero-latency prediction)
    if (groupRef.current) {
      groupRef.current.position.set(
        posRef.current[0],
        posRef.current[1],
        posRef.current[2],
      );
      groupRef.current.rotation.y = rotYRef.current;
    }

    // Proximity seat prompt check
    const nearest = findNearestInteractableSeat(posRef.current, seats, 2.2);
    const nearestId = nearest?.seat.id ?? null;
    if (nearestId !== lastNearestIdRef.current) {
      lastNearestIdRef.current = nearestId;
      onNearestSeatChange(nearest?.seat ?? null);
    }

    // Camera positioning with collision clamping
    const headPos = new THREE.Vector3(
      posRef.current[0],
      posRef.current[1] + (localPlayer.seatedSeatId ? 1.28 : 1.55),
      posRef.current[2],
    );

    if (cameraMode === 'cinema') {
      const screenTarget = new THREE.Vector3(...geometry.meta.screen.position);
      const seatCamPos = clampCameraPosition(
        [
          posRef.current[0],
          posRef.current[1] + 1.55,
          posRef.current[2] + 0.15,
        ],
        geometry.bounds,
      );
      camera.position.lerp(new THREE.Vector3(...seatCamPos), 8 * dt);
      camera.lookAt(screenTarget);
    } else {
      const effectiveDist = THREE.MathUtils.clamp(cameraZoom + zoomOffsetRef.current, 2.4, 9.5);
      const camX =
        headPos.x +
        Math.sin(orbitYawRef.current) * Math.cos(orbitPitchRef.current) * effectiveDist;
      const camY =
        headPos.y + Math.sin(orbitPitchRef.current) * effectiveDist * 0.75 + 0.35;
      const camZ =
        headPos.z +
        Math.cos(orbitYawRef.current) * Math.cos(orbitPitchRef.current) * effectiveDist;

      const clampedCam = clampCameraPosition([camX, camY, camZ], geometry.bounds);
      camera.position.lerp(new THREE.Vector3(...clampedCam), 10 * dt);

      const lookAhead =
        cameraMode === 'follow'
          ? new THREE.Vector3(headPos.x, headPos.y + 0.12, headPos.z - 1.2)
          : headPos;
      camera.lookAt(lookAhead);
    }

    // 4DX Motion Seat & Camera Shake / Wave Sway
    const fourD = useFourDStore.getState();
    if (fourD.enabled) {
      const sLevel = Math.min(1.5, fourD.current.shake * fourD.intensity);
      const wLevel = Math.min(1.2, fourD.current.water * fourD.intensity);
      const t4 = clock.elapsedTime;
      if (sLevel > 0.03) {
        const amp = sLevel * 0.11;
        camera.position.x += Math.sin(t4 * 34) * amp;
        camera.position.y += Math.cos(t4 * 41) * amp * 0.85;
        camera.rotation.z += Math.sin(t4 * 27) * sLevel * 0.024;
      }
      if (wLevel > 0.1) {
        camera.position.y += Math.sin(t4 * 2.2) * wLevel * 0.035;
        camera.rotation.z += Math.cos(t4 * 1.5) * wLevel * 0.012;
      }
      if (groupRef.current && localPlayer.seatedSeatId && sLevel > 0.04) {
        groupRef.current.position.y = posRef.current[1] + Math.abs(Math.sin(t4 * 28)) * sLevel * 0.055;
        groupRef.current.rotation.x = Math.sin(t4 * 22) * sLevel * 0.06;
      } else if (groupRef.current) {
        groupRef.current.rotation.x = 0;
      }
    } else if (groupRef.current) {
      groupRef.current.rotation.x = 0;
    }

    // Update Web Audio API AudioListener vector ref
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    listenerTransformRef.current = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      forward: [forward.x, forward.y, forward.z],
      up: [camera.up.x, camera.up.y, camera.up.z],
    };

    onLocalPositionChange?.(posRef.current);

    // Throttled network emit (~18 Hz while active or on anim state transition)
    const now = performance.now();
    const movedDist = Math.hypot(
      posRef.current[0] - lastSentPosRef.current[0],
      posRef.current[2] - lastSentPosRef.current[2],
    );
    const animChanged = animRef.current !== lastSentAnimRef.current;

    if (
      (movedDist > 0.03 && now - lastEmitTimeRef.current >= 55) ||
      (animChanged && now - lastEmitTimeRef.current >= 35)
    ) {
      lastEmitTimeRef.current = now;
      lastSentPosRef.current = [...posRef.current];
      lastSentAnimRef.current = animRef.current;
      seqRef.current += 1;

      onTransformEmit({
        position: [...posRef.current],
        rotationY: rotYRef.current,
        headYaw: clampHead(orbitYawRef.current - rotYRef.current),
        headPitch: -orbitPitchRef.current * 0.4,
        velocity: [...velRef.current],
        animState: animRef.current,
        seq: seqRef.current,
      });
    }
  });

  return (
    <group
      ref={groupRef}
      position={localPlayer.position}
      rotation={[0, localPlayer.rotationY, 0]}
    >
      <Avatar3D
        config={localPlayer.avatar}
        animState={localPlayer.seatedSeatId ? 'sit' : animRef.current}
        displayName={localPlayer.displayName}
        role={localPlayer.role}
        micEnabled={localPlayer.micEnabled}
        isSpeaking={localPlayer.isSpeaking}
        audioLevel={localPlayer.audioLevel}
        mutedByMod={localPlayer.mutedByMod}
        status={localPlayer.status}
        isLocal
        showLabel
      />
    </group>
  );
}

interface RemoteAvatar3DProps {
  player: PlayerState;
  onSelect: (player: PlayerState) => void;
}

export function RemoteAvatar3D({ player, onSelect }: RemoteAvatar3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetRef = useRef<RemoteTargetTransform | null>(null);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const group = groupRef.current;
    if (!group) return;

    const latest = useLumaStore.getState().remoteTargets[player.id];
    if (latest) targetRef.current = latest;
    const t = targetRef.current;
    if (!t) return;

    const smooth = 12 * dt;
    group.position.x = THREE.MathUtils.lerp(group.position.x, t.position[0], smooth);
    group.position.y = THREE.MathUtils.lerp(group.position.y, t.position[1], smooth);
    group.position.z = THREE.MathUtils.lerp(group.position.z, t.position[2], smooth);
    group.rotation.y = lerpAngle(group.rotation.y, t.rotationY, smooth);
  });

  return (
    <group
      ref={groupRef}
      position={player.position}
      rotation={[0, player.rotationY, 0]}
    >
      <Avatar3D
        config={player.avatar}
        animState={player.seatedSeatId ? 'sit' : player.animState}
        displayName={player.displayName}
        role={player.role}
        micEnabled={player.micEnabled}
        isSpeaking={player.isSpeaking}
        audioLevel={player.audioLevel}
        mutedByMod={player.mutedByMod}
        status={player.status}
        headYaw={player.headYaw}
        headPitch={player.headPitch}
        onSelect={() => onSelect(player)}
      />
    </group>
  );
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * Math.min(1, t);
}

function clampHead(angle: number): number {
  let norm = ((angle + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (norm < -Math.PI) norm += Math.PI * 2;
  return THREE.MathUtils.clamp(norm, -0.8, 0.8);
}
