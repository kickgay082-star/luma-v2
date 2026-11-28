'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFourDStore } from '@/stores/useFourDStore';

interface Effects4D3DProps {
  roomW: number;
  roomD: number;
  screenZ: number;
}

function makePositions(count: number, roomW: number, roomD: number, maxY = 8.4): Float32Array {
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = (Math.random() - 0.5) * (roomW - 1.5);
    arr[i * 3 + 1] = Math.random() * maxY;
    arr[i * 3 + 2] = (Math.random() - 0.5) * (roomD - 1.5);
  }
  return arr;
}

export function Effects4D3D({ roomW, roomD, screenZ }: Effects4D3DProps) {
  const waterMeshRef = useRef<THREE.Mesh>(null);
  const waterFoamRef = useRef<THREE.Mesh>(null);
  const rainPointsRef = useRef<THREE.Points>(null);
  const rainMatRef = useRef<THREE.PointsMaterial>(null);
  const firePointsRef = useRef<THREE.Points>(null);
  const fireMatRef = useRef<THREE.PointsMaterial>(null);
  const fireLightRef = useRef<THREE.PointLight>(null);
  const snowPointsRef = useRef<THREE.Points>(null);
  const snowMatRef = useRef<THREE.PointsMaterial>(null);
  const windPointsRef = useRef<THREE.Points>(null);
  const windMatRef = useRef<THREE.PointsMaterial>(null);
  const lightningRef = useRef<THREE.PointLight>(null);
  const ambilightRef = useRef<THREE.PointLight>(null);

  const smoothRef = useRef({
    water: 0,
    rain: 0,
    fire: 0,
    snow: 0,
    wind: 0,
    shake: 0,
    lightning: 0,
  });

  const rainGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(makePositions(420, roomW, roomD), 3));
    return g;
  }, [roomW, roomD]);

  const fireGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(makePositions(260, roomW, roomD, 6.8), 3));
    return g;
  }, [roomW, roomD]);

  const snowGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(makePositions(300, roomW, roomD), 3));
    return g;
  }, [roomW, roomD]);

  const windGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(makePositions(180, roomW, roomD, 6.5), 3));
    return g;
  }, [roomW, roomD]);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const { enabled, intensity, current } = useFourDStore.getState();
    const scale = enabled ? intensity : 0;

    const targetWater = THREE.MathUtils.clamp(current.water * scale, 0, 1.2);
    const targetRain = THREE.MathUtils.clamp(current.rain * scale, 0, 1.2);
    const targetFire = THREE.MathUtils.clamp(current.fire * scale, 0, 1.2);
    const targetSnow = THREE.MathUtils.clamp(current.snow * scale, 0, 1.2);
    const targetWind = THREE.MathUtils.clamp(current.wind * scale, 0, 1.2);
    const targetLightning = THREE.MathUtils.clamp(current.lightning * scale, 0, 1.2);

    const s = smoothRef.current;
    s.water = THREE.MathUtils.lerp(s.water, targetWater, dt * 2.2);
    s.rain = THREE.MathUtils.lerp(s.rain, targetRain, dt * 3.5);
    s.fire = THREE.MathUtils.lerp(s.fire, targetFire, dt * 3.5);
    s.snow = THREE.MathUtils.lerp(s.snow, targetSnow, dt * 2.8);
    s.wind = THREE.MathUtils.lerp(s.wind, targetWind, dt * 4.0);
    s.lightning = THREE.MathUtils.lerp(s.lightning, targetLightning, dt * 12);

    const t = clock.elapsedTime;

    // 1. Rising 3D Cinema Water & Wave Surface
    if (waterMeshRef.current) {
      const active = s.water > 0.03;
      waterMeshRef.current.visible = active;
      if (active) {
        const yLevel = -0.06 + Math.min(1, s.water) * 0.56 + Math.sin(t * 2.4) * 0.035;
        waterMeshRef.current.position.y = yLevel;
        waterMeshRef.current.rotation.x = -Math.PI / 2 + Math.sin(t * 1.7) * 0.015 * s.water;
        waterMeshRef.current.rotation.z = Math.cos(t * 1.3) * 0.014 * s.water;
        const mat = waterMeshRef.current.material as THREE.MeshStandardMaterial;
        mat.opacity = THREE.MathUtils.clamp(0.45 + s.water * 0.34, 0, 0.82);
      }
    }
    if (waterFoamRef.current) {
      const active = s.water > 0.08;
      waterFoamRef.current.visible = active;
      if (active) {
        waterFoamRef.current.position.y =
          -0.04 + Math.min(1, s.water) * 0.56 + Math.cos(t * 3.1) * 0.025;
      }
    }

    // 2. 3D Falling Rain Streaks
    if (rainPointsRef.current && rainMatRef.current) {
      const active = s.rain > 0.03;
      rainPointsRef.current.visible = active;
      if (active) {
        rainMatRef.current.opacity = THREE.MathUtils.clamp(s.rain * 0.72, 0, 0.85);
        const pos = rainGeo.attributes.position as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        const speedY = 12 + s.rain * 10;
        const driftZ = s.wind * 3.5;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 1] -= speedY * dt;
          arr[i + 2] += driftZ * dt;
          if (arr[i + 1] < 0) {
            arr[i + 1] = 8.4;
            arr[i] = (Math.random() - 0.5) * (roomW - 1.5);
            arr[i + 2] = (Math.random() - 0.5) * (roomD - 1.5);
          }
        }
        pos.needsUpdate = true;
      }
    }

    // 3. 3D Rising Fire Embers + Flickering Flame Glow
    if (firePointsRef.current && fireMatRef.current) {
      const active = s.fire > 0.03;
      firePointsRef.current.visible = active;
      if (active) {
        fireMatRef.current.opacity = THREE.MathUtils.clamp(s.fire * 0.9, 0, 0.95);
        const pos = fireGeo.attributes.position as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        const speedY = 2.6 + s.fire * 3.8;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 1] += speedY * dt;
          arr[i] += Math.sin(t * 3 + i) * 0.9 * dt;
          arr[i + 2] += (0.8 + s.wind * 2.2) * dt;
          if (arr[i + 1] > 6.8 || arr[i + 2] > roomD / 2) {
            arr[i + 1] = 0.05 + Math.random() * 0.6;
            arr[i] = (Math.random() - 0.5) * (roomW - 2);
            arr[i + 2] = screenZ + 0.5 + Math.random() * (roomD * 0.75);
          }
        }
        pos.needsUpdate = true;
      }
    }
    if (fireLightRef.current) {
      fireLightRef.current.intensity =
        s.fire > 0.04 ? (2.4 + Math.sin(t * 17) * 0.9 + Math.cos(t * 23) * 0.5) * s.fire : 0;
    }

    // 4. 3D Falling Snowflakes
    if (snowPointsRef.current && snowMatRef.current) {
      const active = s.snow > 0.03;
      snowPointsRef.current.visible = active;
      if (active) {
        snowMatRef.current.opacity = THREE.MathUtils.clamp(s.snow * 0.85, 0, 0.9);
        const pos = snowGeo.attributes.position as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 1] -= (1.6 + s.snow * 1.4) * dt;
          arr[i] += Math.sin(t * 1.6 + i * 0.1) * 0.7 * dt;
          arr[i + 2] += s.wind * 1.4 * dt;
          if (arr[i + 1] < 0) {
            arr[i + 1] = 8.4;
            arr[i] = (Math.random() - 0.5) * (roomW - 1.5);
            arr[i + 2] = (Math.random() - 0.5) * (roomD - 1.5);
          }
        }
        pos.needsUpdate = true;
      }
    }

    // 5. 3D Wind Speed Streaks (from screen toward audience)
    if (windPointsRef.current && windMatRef.current) {
      const active = s.wind > 0.15;
      windPointsRef.current.visible = active;
      if (active) {
        windMatRef.current.opacity = THREE.MathUtils.clamp((s.wind - 0.1) * 0.65, 0, 0.75);
        const pos = windGeo.attributes.position as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        const speedZ = 9 + s.wind * 16;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 2] += speedZ * dt;
          if (arr[i + 2] > roomD / 2) {
            arr[i + 2] = screenZ + 0.5;
            arr[i] = (Math.random() - 0.5) * (roomW - 2);
            arr[i + 1] = 0.5 + Math.random() * 5.8;
          }
        }
        pos.needsUpdate = true;
      }
    }

    // 6. Lightning Strobe Light
    if (lightningRef.current) {
      lightningRef.current.intensity = s.lightning > 0.12 ? s.lightning * 8.5 : 0;
    }

    // 7. Dynamic Screen Ambilight
    if (ambilightRef.current) {
      ambilightRef.current.color.set(current.ambilightColor || '#7C5CFF');
      ambilightRef.current.intensity = enabled ? 1.8 * Math.max(0.6, intensity) : 0.7;
    }
  });

  return (
    <group>
      {/* Dynamic Ambilight From Cinema Screen */}
      <pointLight
        ref={ambilightRef}
        position={[0, 3.8, screenZ + 3.5]}
        distance={28}
        intensity={1.6}
        color="#7C5CFF"
      />

      {/* Fire Warm Flicker Light */}
      <pointLight
        ref={fireLightRef}
        position={[0, 2.2, screenZ + 5.0]}
        distance={26}
        intensity={0}
        color="#FF6B1A"
      />

      {/* Overhead Lightning Flash */}
      <pointLight
        ref={lightningRef}
        position={[0, 7.6, 1]}
        distance={40}
        intensity={0}
        color="#E0F2FE"
      />

      {/* Rising Animated 3D Water Flood Plane */}
      <mesh
        ref={waterMeshRef}
        visible={false}
        position={[0, -0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[roomW - 0.1, roomD - 0.1, 12, 12]} />
        <meshStandardMaterial
          color="#0284C7"
          emissive="#0369A1"
          emissiveIntensity={0.35}
          metalness={0.68}
          roughness={0.14}
          transparent
          opacity={0.72}
        />
      </mesh>
      <mesh
        ref={waterFoamRef}
        visible={false}
        position={[0, -0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[roomW - 0.4, roomD - 0.4]} />
        <meshBasicMaterial color="#7DD3FC" transparent opacity={0.14} wireframe />
      </mesh>

      {/* 3D Rain */}
      <points ref={rainPointsRef} geometry={rainGeo} visible={false}>
        <pointsMaterial
          ref={rainMatRef}
          color="#93C5FD"
          size={0.095}
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </points>

      {/* 3D Fire Embers */}
      <points ref={firePointsRef} geometry={fireGeo} visible={false}>
        <pointsMaterial
          ref={fireMatRef}
          color="#FB923C"
          size={0.14}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* 3D Snow */}
      <points ref={snowPointsRef} geometry={snowGeo} visible={false}>
        <pointsMaterial
          ref={snowMatRef}
          color="#F8FAFC"
          size={0.13}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </points>

      {/* 3D Wind Streaks */}
      <points ref={windPointsRef} geometry={windGeo} visible={false}>
        <pointsMaterial
          ref={windMatRef}
          color="#E2E8F0"
          size={0.075}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
