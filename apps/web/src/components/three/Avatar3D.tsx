'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { AvatarConfig, PlayerAnimState, PlayerRole } from '@luma/shared';
import { Mic, MicOff, Crown, Shield } from 'lucide-react';

interface Avatar3DProps {
  config: AvatarConfig;
  animState: PlayerAnimState;
  displayName?: string;
  role?: PlayerRole;
  micEnabled?: boolean;
  isSpeaking?: boolean;
  audioLevel?: number;
  mutedByMod?: boolean;
  status?: 'active' | 'away';
  headYaw?: number;
  headPitch?: number;
  isLocal?: boolean;
  showLabel?: boolean;
  onSelect?: () => void;
}

export function Avatar3D({
  config,
  animState,
  displayName,
  role = 'member',
  micEnabled = false,
  isSpeaking = false,
  audioLevel = 0,
  mutedByMod = false,
  status = 'active',
  headYaw = 0,
  headPitch = 0,
  isLocal = false,
  showLabel = true,
  onSelect,
}: Avatar3DProps) {
  const pelvisRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftShinRef = useRef<THREE.Group>(null);
  const rightShinRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const animClock = useRef(Math.random() * 10);

  const bodyMetrics = useMemo(() => {
    const baseW =
      config.bodyPreset === 'slim'
        ? 0.92
        : config.bodyPreset === 'athletic'
          ? 1.08
          : 1.0;
    const h = config.heightScale || 1;
    const s = (config.shoulderScale || 1) * baseW;
    return { h, s };
  }, [config.bodyPreset, config.heightScale, config.shoulderScale]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    animClock.current += dt;
    const t = animClock.current;

    const pelvis = pelvisRef.current;
    const torso = torsoRef.current;
    const head = headRef.current;
    const lArm = leftArmRef.current;
    const rArm = rightArmRef.current;
    const lLeg = leftLegRef.current;
    const rLeg = rightLegRef.current;
    const lShin = leftShinRef.current;
    const rShin = rightShinRef.current;

    if (!pelvis || !torso || !head || !lArm || !rArm || !lLeg || !rLeg || !lShin || !rShin) {
      return;
    }

    const lerpSpeed = 12 * dt;
    let targetPelvisY = 0.88;
    let targetTorsoX = 0;
    let targetTorsoY = 0;
    let targetLArmX = 0;
    let targetRArmX = 0;
    let targetLArmZ = 0.1;
    let targetRArmZ = -0.1;
    let targetLLegX = 0;
    let targetRLegX = 0;
    let targetLShinX = 0;
    let targetRShinX = 0;

    if (animState === 'walk' || animState === 'run') {
      const freq = animState === 'run' ? 11.5 : 7.2;
      const amp = animState === 'run' ? 0.72 : 0.48;
      const swing = Math.sin(t * freq) * amp;
      targetPelvisY = 0.88 + Math.abs(Math.cos(t * freq)) * (animState === 'run' ? 0.07 : 0.035);
      targetTorsoX = animState === 'run' ? 0.14 : 0.05;
      targetTorsoY = Math.sin(t * freq) * 0.06;
      targetLLegX = swing;
      targetRLegX = -swing;
      targetLShinX = Math.max(0, -swing * 0.65);
      targetRShinX = Math.max(0, swing * 0.65);
      targetLArmX = -swing * 0.82;
      targetRArmX = swing * 0.82;
    } else if (animState === 'sit') {
      targetPelvisY = 0.56;
      targetTorsoX = -0.06 + Math.sin(t * 1.4) * 0.012;
      targetLLegX = -1.42;
      targetRLegX = -1.42;
      targetLShinX = 1.42;
      targetRShinX = 1.42;
      targetLArmX = -0.58;
      targetRArmX = -0.58;
      targetLArmZ = 0.18;
      targetRArmZ = -0.18;
    } else if (animState === 'wave' || animState === 'enter') {
      targetPelvisY = 0.88 + Math.sin(t * 2.5) * 0.015;
      targetRArmX = -2.25;
      targetRArmZ = -0.4 + Math.sin(t * 9) * 0.25;
    } else {
      // Idle breathing & subtle life motion
      targetPelvisY = 0.88 + Math.sin(t * 1.9) * 0.012;
      targetTorsoY = Math.sin(t * 0.85) * 0.025;
      targetLArmZ = 0.1 + Math.sin(t * 1.9) * 0.02;
      targetRArmZ = -0.1 - Math.sin(t * 1.9) * 0.02;
    }

    pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, targetPelvisY, lerpSpeed);
    torso.rotation.x = THREE.MathUtils.lerp(torso.rotation.x, targetTorsoX, lerpSpeed);
    torso.rotation.y = THREE.MathUtils.lerp(torso.rotation.y, targetTorsoY, lerpSpeed);
    lArm.rotation.x = THREE.MathUtils.lerp(lArm.rotation.x, targetLArmX, lerpSpeed);
    rArm.rotation.x = THREE.MathUtils.lerp(rArm.rotation.x, targetRArmX, lerpSpeed);
    lArm.rotation.z = THREE.MathUtils.lerp(lArm.rotation.z, targetLArmZ, lerpSpeed);
    rArm.rotation.z = THREE.MathUtils.lerp(rArm.rotation.z, targetRArmZ, lerpSpeed);
    lLeg.rotation.x = THREE.MathUtils.lerp(lLeg.rotation.x, targetLLegX, lerpSpeed);
    rLeg.rotation.x = THREE.MathUtils.lerp(rLeg.rotation.x, targetRLegX, lerpSpeed);
    lShin.rotation.x = THREE.MathUtils.lerp(lShin.rotation.x, targetLShinX, lerpSpeed);
    rShin.rotation.x = THREE.MathUtils.lerp(rShin.rotation.x, targetRShinX, lerpSpeed);

    // Head tracking + talking nod
    const talkNod = isSpeaking ? Math.sin(t * 14) * (0.04 + audioLevel * 0.08) : 0;
    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, headYaw * 0.65, lerpSpeed);
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, headPitch * 0.45 + talkNod, lerpSpeed);

    // Mouth voice reactivity
    if (mouthRef.current) {
      const mouthOpen = isSpeaking ? 1 + audioLevel * 2.2 + Math.abs(Math.sin(t * 18)) * 0.8 : 1;
      mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, mouthOpen, 18 * dt);
    }

    // Natural eye blink
    if (leftEyeRef.current && rightEyeRef.current) {
      const blinkCycle = t % 4.2;
      const blinkScale = blinkCycle > 4.05 ? 0.12 : 1;
      leftEyeRef.current.scale.y = blinkScale;
      rightEyeRef.current.scale.y = blinkScale;
    }

    // Floor voice indicator pulse
    if (ringRef.current) {
      const targetScale = isSpeaking ? 1.08 + audioLevel * 0.35 : 1;
      ringRef.current.scale.setScalar(
        THREE.MathUtils.lerp(ringRef.current.scale.x, targetScale, 15 * dt),
      );
    }
  });

  const headWidth =
    config.faceShape === 'square' ? 1.06 : config.faceShape === 'angular' ? 0.94 : 1.0;
  const headDepth = config.faceShape === 'soft' ? 1.04 : 0.98;
  const eyeSize =
    config.eyeStyle === 'round' || config.eyeStyle === 'expressive' ? 0.032 : 0.026;
  const browThick = config.eyebrowStyle === 'thick' ? 0.022 : config.eyebrowStyle === 'minimal' ? 0.01 : 0.015;

  const isShorts = config.bottomStyle === 'shorts';

  return (
    <group
      scale={[1, bodyMetrics.h, 1]}
      onClick={(e) => {
        if (onSelect && !isLocal) {
          e.stopPropagation();
          onSelect();
        }
      }}
    >
      {/* Subtle floor presence ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.38, 0.43, 32]} />
        <meshBasicMaterial
          color={isSpeaking ? '#34D399' : isLocal ? '#7C5CFF' : '#3B82F6'}
          transparent
          opacity={isSpeaking ? 0.85 : isLocal ? 0.45 : 0.25}
        />
      </mesh>

      {/* Pelvis / Root */}
      <group ref={pelvisRef} position={[0, 0.88, 0]}>
        {/* Hips */}
        <mesh castShadow receiveShadow position={[0, 0.02, 0]}>
          <boxGeometry args={[0.34 * bodyMetrics.s, 0.16, 0.22]} />
          <meshStandardMaterial color={config.bottomColor} roughness={0.78} />
        </mesh>

        {/* Torso */}
        <group ref={torsoRef} position={[0, 0.1, 0]}>
          <mesh castShadow receiveShadow position={[0, 0.24, 0]}>
            <boxGeometry args={[0.42 * bodyMetrics.s, 0.48, 0.24]} />
            <meshStandardMaterial color={config.topColor} roughness={0.68} />
          </mesh>

          {/* Waist belt & subtle buckle */}
          <mesh position={[0, 0.015, 0]}>
            <boxGeometry args={[0.43 * bodyMetrics.s, 0.045, 0.25]} />
            <meshStandardMaterial color="#18181B" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.015, 0.13]}>
            <boxGeometry args={[0.06, 0.04, 0.015]} />
            <meshStandardMaterial color={config.accessoryColor} metalness={0.65} roughness={0.3} />
          </mesh>

          {/* Outfit style details */}
          {config.topStyle === 'hoodie' && (
            <group>
              <group position={[0, 0.44, -0.09]}>
                <mesh castShadow>
                  <torusGeometry args={[0.14, 0.055, 10, 20, Math.PI * 1.4]} />
                  <meshStandardMaterial color={config.topColor} roughness={0.8} />
                </mesh>
              </group>
              {/* Hoodie drawstrings & kangaroo pocket */}
              <mesh position={[-0.045, 0.34, 0.125]}>
                <boxGeometry args={[0.012, 0.14, 0.012]} />
                <meshStandardMaterial color={config.accessoryColor} roughness={0.6} />
              </mesh>
              <mesh position={[0.045, 0.34, 0.125]}>
                <boxGeometry args={[0.012, 0.14, 0.012]} />
                <meshStandardMaterial color={config.accessoryColor} roughness={0.6} />
              </mesh>
              <mesh position={[0, 0.12, 0.124]}>
                <boxGeometry args={[0.25 * bodyMetrics.s, 0.13, 0.016]} />
                <meshStandardMaterial color={config.topColor} roughness={0.82} />
              </mesh>
            </group>
          )}
          {config.topStyle === 'sweater' && (
            <group>
              <mesh position={[0, 0.47, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.1, 0.028, 8, 18]} />
                <meshStandardMaterial color={config.accessoryColor} roughness={0.75} />
              </mesh>
              <mesh position={[0, 0.045, 0]}>
                <boxGeometry args={[0.428 * bodyMetrics.s, 0.05, 0.248]} />
                <meshStandardMaterial color={config.accessoryColor} roughness={0.8} />
              </mesh>
            </group>
          )}
          {(config.topStyle === 'blazer' || config.topStyle === 'jacket') && (
            <group>
              <mesh position={[0, 0.25, 0.125]}>
                <boxGeometry args={[0.1, 0.42, 0.015]} />
                <meshStandardMaterial
                  color={config.topStyle === 'blazer' ? '#E5E7EB' : '#111827'}
                  roughness={0.5}
                />
              </mesh>
              {/* Lapel / collar trim */}
              <mesh position={[-0.075, 0.41, 0.126]} rotation={[0, 0, -0.24]}>
                <boxGeometry args={[0.05, 0.15, 0.014]} />
                <meshStandardMaterial
                  color={config.topStyle === 'blazer' ? '#1E293B' : config.accessoryColor}
                  roughness={0.45}
                />
              </mesh>
              <mesh position={[0.075, 0.41, 0.126]} rotation={[0, 0, 0.24]}>
                <boxGeometry args={[0.05, 0.15, 0.014]} />
                <meshStandardMaterial
                  color={config.topStyle === 'blazer' ? '#1E293B' : config.accessoryColor}
                  roughness={0.45}
                />
              </mesh>
            </group>
          )}

          {/* Neck */}
          <mesh castShadow position={[0, 0.52, 0]}>
            <cylinderGeometry args={[0.075, 0.085, 0.12, 12]} />
            <meshStandardMaterial color={config.skinTone} roughness={0.62} />
          </mesh>

          {/* Head */}
          <group ref={headRef} position={[0, 0.7, 0]}>
            <mesh
              castShadow
              receiveShadow
              scale={[headWidth, 1.06, headDepth]}
            >
              <sphereGeometry args={[0.175, 22, 18]} />
              <meshStandardMaterial color={config.skinTone} roughness={0.58} />
            </mesh>

            {/* Ears */}
            <mesh position={[-0.175 * headWidth, -0.01, 0]}>
              <sphereGeometry args={[0.036, 10, 10]} />
              <meshStandardMaterial color={config.skinTone} roughness={0.65} />
            </mesh>
            <mesh position={[0.175 * headWidth, -0.01, 0]}>
              <sphereGeometry args={[0.036, 10, 10]} />
              <meshStandardMaterial color={config.skinTone} roughness={0.65} />
            </mesh>

            {/* Eyes */}
            <group position={[0, 0.02, 0.152]}>
              <mesh ref={leftEyeRef} position={[-0.058, 0, 0]}>
                <sphereGeometry args={[eyeSize, 12, 12]} />
                <meshStandardMaterial color={config.eyeColor} roughness={0.25} />
              </mesh>
              <mesh ref={rightEyeRef} position={[0.058, 0, 0]}>
                <sphereGeometry args={[eyeSize, 12, 12]} />
                <meshStandardMaterial color={config.eyeColor} roughness={0.25} />
              </mesh>
              {/* Eyebrows */}
              <mesh
                position={[-0.058, 0.044, 0.005]}
                rotation={[0, 0, config.eyebrowStyle === 'arched' ? 0.14 : 0.03]}
              >
                <boxGeometry args={[0.058, browThick, 0.012]} />
                <meshStandardMaterial color={config.hairColor} roughness={0.8} />
              </mesh>
              <mesh
                position={[0.058, 0.044, 0.005]}
                rotation={[0, 0, config.eyebrowStyle === 'arched' ? -0.14 : -0.03]}
              >
                <boxGeometry args={[0.058, browThick, 0.012]} />
                <meshStandardMaterial color={config.hairColor} roughness={0.8} />
              </mesh>
            </group>

            {/* Mouth */}
            <mesh ref={mouthRef} position={[0, -0.068, 0.155]}>
              <boxGeometry args={[0.056, 0.014, 0.015]} />
              <meshStandardMaterial color="#8B4A4A" roughness={0.5} />
            </mesh>

            {/* Hair Styles */}
            <AvatarHair style={config.hairStyle} color={config.hairColor} />

            {/* Glasses */}
            <AvatarGlasses style={config.glasses} color={config.accessoryColor} />

            {/* Hats / Headphones */}
            <AvatarHat style={config.hat} color={config.accessoryColor} />
          </group>

          {/* Left Arm */}
          <group
            ref={leftArmRef}
            position={[-0.27 * bodyMetrics.s, 0.43, 0]}
          >
            <mesh castShadow position={[0, -0.18, 0]}>
              <capsuleGeometry args={[0.06, 0.28, 6, 10]} />
              <meshStandardMaterial
                color={config.topStyle === 'tshirt' ? config.skinTone : config.topColor}
                roughness={0.7}
              />
            </mesh>
            {config.topStyle === 'tshirt' && (
              <mesh castShadow position={[0, -0.05, 0]}>
                <cylinderGeometry args={[0.072, 0.068, 0.14, 10]} />
                <meshStandardMaterial color={config.topColor} roughness={0.72} />
              </mesh>
            )}
            <mesh castShadow position={[0, -0.38, 0]}>
              <sphereGeometry args={[0.052, 10, 10]} />
              <meshStandardMaterial color={config.skinTone} roughness={0.62} />
            </mesh>
          </group>

          {/* Right Arm */}
          <group
            ref={rightArmRef}
            position={[0.27 * bodyMetrics.s, 0.43, 0]}
          >
            <mesh castShadow position={[0, -0.18, 0]}>
              <capsuleGeometry args={[0.06, 0.28, 6, 10]} />
              <meshStandardMaterial
                color={config.topStyle === 'tshirt' ? config.skinTone : config.topColor}
                roughness={0.7}
              />
            </mesh>
            {config.topStyle === 'tshirt' && (
              <mesh castShadow position={[0, -0.05, 0]}>
                <cylinderGeometry args={[0.072, 0.068, 0.14, 10]} />
                <meshStandardMaterial color={config.topColor} roughness={0.72} />
              </mesh>
            )}
            <mesh castShadow position={[0, -0.38, 0]}>
              <sphereGeometry args={[0.052, 10, 10]} />
              <meshStandardMaterial color={config.skinTone} roughness={0.62} />
            </mesh>
          </group>
        </group>

        {/* Left Leg */}
        <group ref={leftLegRef} position={[-0.1 * bodyMetrics.s, -0.05, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}>
            <capsuleGeometry args={[0.074, 0.28, 6, 10]} />
            <meshStandardMaterial color={config.bottomColor} roughness={0.78} />
          </mesh>
          <group ref={leftShinRef} position={[0, -0.38, 0]}>
            <mesh castShadow position={[0, -0.18, 0]}>
              <capsuleGeometry args={[0.064, 0.26, 6, 10]} />
              <meshStandardMaterial
                color={isShorts ? config.skinTone : config.bottomColor}
                roughness={0.75}
              />
            </mesh>
            <mesh castShadow position={[0, -0.38, 0.045]}>
              <boxGeometry
                args={[
                  0.11,
                  config.shoeStyle === 'boots' ? 0.13 : 0.085,
                  0.22,
                ]}
              />
              <meshStandardMaterial color={config.shoeColor} roughness={0.55} />
            </mesh>
            {config.shoeStyle === 'sneakers' && (
              <mesh position={[0, -0.415, 0.045]}>
                <boxGeometry args={[0.114, 0.022, 0.224]} />
                <meshStandardMaterial color="#F8FAFC" roughness={0.45} />
              </mesh>
            )}
          </group>
        </group>

        {/* Right Leg */}
        <group ref={rightLegRef} position={[0.1 * bodyMetrics.s, -0.05, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}>
            <capsuleGeometry args={[0.074, 0.28, 6, 10]} />
            <meshStandardMaterial color={config.bottomColor} roughness={0.78} />
          </mesh>
          <group ref={rightShinRef} position={[0, -0.38, 0]}>
            <mesh castShadow position={[0, -0.18, 0]}>
              <capsuleGeometry args={[0.064, 0.26, 6, 10]} />
              <meshStandardMaterial
                color={isShorts ? config.skinTone : config.bottomColor}
                roughness={0.75}
              />
            </mesh>
            <mesh castShadow position={[0, -0.38, 0.045]}>
              <boxGeometry
                args={[
                  0.11,
                  config.shoeStyle === 'boots' ? 0.13 : 0.085,
                  0.22,
                ]}
              />
              <meshStandardMaterial color={config.shoeColor} roughness={0.55} />
            </mesh>
            {config.shoeStyle === 'sneakers' && (
              <mesh position={[0, -0.415, 0.045]}>
                <boxGeometry args={[0.114, 0.022, 0.224]} />
                <meshStandardMaterial color="#F8FAFC" roughness={0.45} />
              </mesh>
            )}
          </group>
        </group>
      </group>

      {/* Overhead Floating Identity & Voice Tag */}
      {showLabel && displayName && (
        <Html
          position={[0, 2.02, 0]}
          center
          distanceFactor={8.5}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: onSelect && !isLocal ? 'auto' : 'none' }}
        >
          <button
            type="button"
            onClick={() => onSelect?.()}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-lg backdrop-blur-md transition ${
              isSpeaking
                ? 'border-emerald-400/70 bg-emerald-950/80 text-emerald-100'
                : 'border-white/15 bg-[#0B0D14]/85 text-zinc-100'
            }`}
          >
            {role === 'owner' && <Crown className="h-3 w-3 text-amber-400" />}
            {role === 'moderator' && <Shield className="h-3 w-3 text-[#7C5CFF]" />}
            <span>{displayName}</span>
            {status === 'away' && (
              <span className="rounded bg-amber-500/20 px-1 text-[9px] text-amber-300">
                Uzakta
              </span>
            )}
            {mutedByMod ? (
              <MicOff className="h-3 w-3 text-red-400" />
            ) : micEnabled ? (
              <Mic
                className={`h-3 w-3 ${isSpeaking ? 'text-emerald-400' : 'text-zinc-300'}`}
              />
            ) : (
              <MicOff className="h-3 w-3 text-zinc-500" />
            )}
          </button>
        </Html>
      )}
    </group>
  );
}

function AvatarHair({ style, color }: { style: AvatarConfig['hairStyle']; color: string }) {
  if (style === 'buzz') {
    return (
      <mesh position={[0, 0.03, -0.01]}>
        <sphereGeometry args={[0.179, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    );
  }
  if (style === 'short-fade' || style === 'side-part') {
    return (
      <group>
        <mesh position={[0, 0.045, -0.015]}>
          <sphereGeometry args={[0.184, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
        {style === 'side-part' && (
          <mesh position={[0.04, 0.145, 0.08]} rotation={[0.2, 0.2, -0.15]}>
            <boxGeometry args={[0.18, 0.075, 0.16]} />
            <meshStandardMaterial color={color} roughness={0.78} />
          </mesh>
        )}
      </group>
    );
  }
  if (style === 'long-wavy') {
    return (
      <group>
        <mesh position={[0, 0.04, -0.01]}>
          <sphereGeometry args={[0.188, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshStandardMaterial color={color} roughness={0.74} />
        </mesh>
        <mesh position={[0, -0.12, -0.1]}>
          <boxGeometry args={[0.32, 0.34, 0.16]} />
          <meshStandardMaterial color={color} roughness={0.74} />
        </mesh>
        <mesh position={[-0.145, -0.08, 0.03]}>
          <capsuleGeometry args={[0.045, 0.2, 6, 8]} />
          <meshStandardMaterial color={color} roughness={0.74} />
        </mesh>
        <mesh position={[0.145, -0.08, 0.03]}>
          <capsuleGeometry args={[0.045, 0.2, 6, 8]} />
          <meshStandardMaterial color={color} roughness={0.74} />
        </mesh>
      </group>
    );
  }
  if (style === 'bob') {
    return (
      <group>
        <mesh position={[0, 0.04, -0.015]}>
          <sphereGeometry args={[0.19, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
          <meshStandardMaterial color={color} roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.06, -0.06]}>
          <cylinderGeometry args={[0.19, 0.18, 0.16, 16, 1, false, Math.PI * 0.55, Math.PI * 0.9]} />
          <meshStandardMaterial color={color} roughness={0.75} />
        </mesh>
      </group>
    );
  }
  if (style === 'ponytail') {
    return (
      <group>
        <mesh position={[0, 0.04, -0.01]}>
          <sphereGeometry args={[0.184, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshStandardMaterial color={color} roughness={0.74} />
        </mesh>
        <mesh position={[0, 0.08, -0.175]} rotation={[0.45, 0, 0]}>
          <torusGeometry args={[0.045, 0.014, 8, 14]} />
          <meshStandardMaterial color="#EC4899" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.02, -0.22]} rotation={[0.45, 0, 0]}>
          <capsuleGeometry args={[0.055, 0.22, 6, 10]} />
          <meshStandardMaterial color={color} roughness={0.74} />
        </mesh>
      </group>
    );
  }
  if (style === 'curly') {
    return (
      <group position={[0, 0.08, -0.02]}>
        {[
          [0, 0.1, 0],
          [-0.1, 0.07, 0.04],
          [0.1, 0.07, 0.04],
          [-0.12, 0.02, -0.06],
          [0.12, 0.02, -0.06],
          [0, 0.06, -0.11],
          [-0.06, 0.12, 0.06],
          [0.06, 0.12, 0.06],
        ].map((pos, idx) => (
          <mesh key={idx} position={pos as [number, number, number]}>
            <sphereGeometry args={[0.095, 10, 10]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
        ))}
      </group>
    );
  }
  // mohawk (layered fin segments)
  return (
    <group position={[0, 0.16, -0.01]}>
      <mesh>
        <boxGeometry args={[0.065, 0.14, 0.28]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {[-0.08, 0, 0.08].map((zOff, i) => (
        <mesh key={i} position={[0, 0.07, zOff]} rotation={[-0.15, 0, 0]}>
          <coneGeometry args={[0.04, 0.09, 6]} />
          <meshStandardMaterial color={color} roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

function AvatarGlasses({ style, color }: { style: AvatarConfig['glasses']; color: string }) {
  if (style === 'none') return null;
  if (style === 'visor') {
    return (
      <mesh position={[0, 0.025, 0.165]}>
        <boxGeometry args={[0.24, 0.058, 0.035]} />
        <meshStandardMaterial
          color={color}
          metalness={0.6}
          roughness={0.18}
          emissive={color}
          emissiveIntensity={0.25}
        />
      </mesh>
    );
  }
  const radius = style === 'round' ? 0.045 : 0.042;
  return (
    <group position={[0, 0.022, 0.168]}>
      <mesh position={[-0.06, 0, 0]}>
        <torusGeometry args={[radius, 0.007, 8, 18]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.06, 0, 0]}>
        <torusGeometry args={[radius, 0.007, 8, 18]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.005, 0]}>
        <boxGeometry args={[0.036, 0.008, 0.008]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function AvatarHat({ style, color }: { style: AvatarConfig['hat']; color: string }) {
  if (style === 'none') return null;
  if (style === 'beanie') {
    return (
      <group position={[0, 0.09, -0.01]}>
        <mesh>
          <sphereGeometry args={[0.192, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.182, 0.028, 8, 22]} />
          <meshStandardMaterial color={color} roughness={0.88} />
        </mesh>
      </group>
    );
  }
  if (style === 'cap') {
    return (
      <group position={[0, 0.1, 0]}>
        <mesh>
          <sphereGeometry args={[0.19, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color={color} roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.01, 0.17]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[0.2, 0.016, 0.16]} />
          <meshStandardMaterial color={color} roughness={0.75} />
        </mesh>
      </group>
    );
  }
  if (style === 'fedora') {
    return (
      <group position={[0, 0.15, 0]}>
        <mesh>
          <cylinderGeometry args={[0.14, 0.16, 0.12, 18]} />
          <meshStandardMaterial color={color} roughness={0.72} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.015, 22]} />
          <meshStandardMaterial color={color} roughness={0.72} />
        </mesh>
      </group>
    );
  }
  // headphones
  return (
    <group position={[0, 0.03, 0]}>
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[0.195, 0.018, 8, 24, Math.PI]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[-0.195, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.055, 0.055, 0.045, 14]} />
        <meshStandardMaterial color="#18181B" roughness={0.5} />
      </mesh>
      <mesh position={[0.195, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.055, 0.055, 0.045, 14]} />
        <meshStandardMaterial color="#18181B" roughness={0.5} />
      </mesh>
    </group>
  );
}
