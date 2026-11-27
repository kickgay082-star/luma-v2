'use client';

import { useMemo } from 'react';
import { Stars } from '@react-three/drei';
import {
  buildRoomGeometry,
  GraphicsQuality,
  RoomCustomization,
  SeatState,
  VideoState,
} from '@luma/shared';
import { Seat3D } from './Seat3D';
import { CinemaScreen3D } from './CinemaScreen3D';

interface RoomEnvironment3DProps {
  customization: RoomCustomization;
  seats: SeatState[];
  nearestSeatId: string | null;
  localSeatedSeatId: string | null;
  video: VideoState | null;
  graphicsQuality: GraphicsQuality;
  screenVolume: number;
  interactiveScreen: boolean;
  onClaimSeat: (seatId: string) => void;
  onVideoEnded?: () => void;
}

export function RoomEnvironment3D({
  customization,
  seats,
  nearestSeatId,
  localSeatedSeatId,
  video,
  graphicsQuality,
  screenVolume,
  interactiveScreen,
  onClaimSeat,
  onVideoEnded,
}: RoomEnvironment3DProps) {
  const geometry = useMemo(
    () => buildRoomGeometry(customization.theme, customization),
    [customization],
  );

  const meta = geometry.meta;
  const bounds = geometry.bounds;
  const roomW = bounds.maxX - bounds.minX;
  const roomD = bounds.maxZ - bounds.minZ;
  const screenW = meta.screen.baseWidth * customization.screenScale;
  const screenH = meta.screen.baseHeight * customization.screenScale;

  const shadows = graphicsQuality !== 'low';

  return (
    <group>
      <color attach="background" args={[meta.skyColor]} />
      <fog attach="fog" args={[meta.fogColor, 16, 46]} />

      {/* Core Lighting Rig */}
      <ambientLight intensity={customization.ambientIntensity} color="#D8DCFF" />
      <directionalLight
        position={[6, 12, 8]}
        intensity={0.75}
        castShadow={shadows}
        shadow-mapSize={graphicsQuality === 'high' ? [2048, 2048] : [1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        color="#E5E7EB"
      />
      <pointLight
        position={[-8, 5, 4]}
        intensity={1.3}
        distance={22}
        color={customization.lightColor}
      />
      <pointLight
        position={[8, 5, 4]}
        intensity={1.3}
        distance={22}
        color={customization.lightColor}
      />

      {/* Main Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial color={meta.floorColor} roughness={0.85} metalness={0.08} />
      </mesh>

      {/* Stepped Theater Risers matching server getFloorElevationAt */}
      {customization.seatLayout === 'theater' && (
        <group>
          <mesh position={[0, 0.08, 1.0]} receiveShadow castShadow>
            <boxGeometry args={[14.8, 0.16, 3.4]} />
            <meshStandardMaterial color={meta.wallColor} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.17, 4.4]} receiveShadow castShadow>
            <boxGeometry args={[15.4, 0.34, 3.4]} />
            <meshStandardMaterial color={meta.wallColor} roughness={0.85} />
          </mesh>
        </group>
      )}
      {customization.seatLayout === 'duo-rows' && (
        <mesh position={[0, 0.09, 2.4]} receiveShadow castShadow>
          <boxGeometry args={[14, 0.18, 3.2]} />
          <meshStandardMaterial color={meta.wallColor} roughness={0.85} />
        </mesh>
      )}

      {/* Cinema Stage Platform */}
      <mesh
        position={[0, 0.22, meta.screen.position[2] + 1.0]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[screenW + 2.2, 0.44, 2.4]} />
        <meshStandardMaterial color="#0D0F16" roughness={0.75} metalness={0.2} />
      </mesh>

      {/* Perimeter Walls (Left/Right/Front/Back — glass or open panorama for Space/Beach/NeonCity) */}
      <mesh position={[0, 4.2, bounds.minZ]} receiveShadow>
        <boxGeometry args={[roomW, 8.4, 0.35]} />
        <meshStandardMaterial color={meta.wallColor} roughness={0.82} />
      </mesh>
      <mesh position={[0, 4.2, bounds.maxZ]} receiveShadow>
        <boxGeometry args={[roomW, 8.4, 0.35]} />
        <meshStandardMaterial color={meta.wallColor} roughness={0.82} />
      </mesh>
      <mesh position={[bounds.minX, 4.2, 0]} receiveShadow>
        <boxGeometry args={[0.35, 8.4, roomD]} />
        <meshStandardMaterial
          color={meta.wallColor}
          roughness={0.82}
          transparent={customization.theme === 'space-room' || customization.theme === 'neon-city'}
          opacity={customization.theme === 'space-room' || customization.theme === 'neon-city' ? 0.32 : 1}
        />
      </mesh>
      <mesh position={[bounds.maxX, 4.2, 0]} receiveShadow>
        <boxGeometry args={[0.35, 8.4, roomD]} />
        <meshStandardMaterial
          color={meta.wallColor}
          roughness={0.82}
          transparent={customization.theme === 'space-room' || customization.theme === 'neon-city'}
          opacity={customization.theme === 'space-room' || customization.theme === 'neon-city' ? 0.32 : 1}
        />
      </mesh>

      {/* Ceiling */}
      {customization.theme !== 'beach-house' && customization.theme !== 'space-room' && (
        <mesh position={[0, 8.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[roomW, roomD]} />
          <meshStandardMaterial color="#07080C" roughness={0.9} />
        </mesh>
      )}

      {/* Aisle LED Strips */}
      <mesh position={[-7.1, 0.015, 1.5]}>
        <boxGeometry args={[0.06, 0.015, 13]} />
        <meshBasicMaterial color={customization.lightColor} />
      </mesh>
      <mesh position={[7.1, 0.015, 1.5]}>
        <boxGeometry args={[0.06, 0.015, 13]} />
        <meshBasicMaterial color={customization.lightColor} />
      </mesh>

      {/* Decorative Side Pillars (matches server colliders for decorPreset !== 'minimal') */}
      {customization.decorPreset !== 'minimal' && (
        <group>
          {[-9.2, 9.2].map((px, i) => (
            <group key={i} position={[px, 0, -6.2]}>
              <mesh position={[0, 2.8, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.1, 5.6, 1.1]} />
                <meshStandardMaterial color={meta.wallColor} roughness={0.7} />
              </mesh>
              <mesh position={[0, 2.8, 0.56]}>
                <boxGeometry args={[0.08, 4.4, 0.04]} />
                <meshBasicMaterial color={customization.lightColor} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Extra Lush Decor Consoles */}
      {customization.decorPreset === 'lush' && (
        <group>
          {[-8.8, 8.8].map((cx, i) => (
            <group key={i} position={[cx, 0, 6.2]}>
              <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.5, 0.9, 1.3]} />
                <meshStandardMaterial color="#181A24" roughness={0.6} />
              </mesh>
              <mesh position={[0, 1.05, 0]}>
                <cylinderGeometry args={[0.18, 0.14, 0.35, 12]} />
                <meshStandardMaterial
                  color={customization.lightColor}
                  emissive={customization.lightColor}
                  emissiveIntensity={0.6}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Theme-Specific Signatures */}
      <ThemeSpecificBackdrop
        theme={customization.theme}
        lightColor={customization.lightColor}
        graphicsQuality={graphicsQuality}
        screenW={screenW}
        screenH={screenH}
        screenPos={meta.screen.position}
      />

      {/* Synchronized Cinema Screen */}
      <CinemaScreen3D
        position={meta.screen.position}
        width={screenW}
        height={screenH}
        video={video}
        accentColor={customization.lightColor}
        screenVolume={screenVolume}
        interactiveHtml={interactiveScreen}
        onVideoEnded={onVideoEnded}
      />

      {/* Interactive Physical 3D Seats */}
      {seats.map((seat) => (
        <Seat3D
          key={seat.id}
          seat={seat}
          isNearest={seat.id === nearestSeatId}
          isOccupiedByMe={seat.id === localSeatedSeatId}
          accentColor={customization.lightColor}
          onClaim={onClaimSeat}
        />
      ))}
    </group>
  );
}

function ThemeSpecificBackdrop({
  theme,
  lightColor,
  graphicsQuality,
  screenW,
  screenH,
  screenPos,
}: {
  theme: RoomCustomization['theme'];
  lightColor: string;
  graphicsQuality: GraphicsQuality;
  screenW: number;
  screenH: number;
  screenPos: [number, number, number];
}) {
  const starCount = graphicsQuality === 'high' ? 1800 : graphicsQuality === 'medium' ? 900 : 350;

  if (theme === 'space-room') {
    return (
      <group>
        <Stars radius={60} depth={40} count={starCount} factor={3.2} fade speed={0.4} />
        <mesh position={[-22, 6, -18]}>
          <sphereGeometry args={[5.5, 28, 24]} />
          <meshStandardMaterial color="#1E3A5F" roughness={0.7} />
        </mesh>
        <mesh position={[-22, 6, -18]} rotation={[1.2, 0.3, 0]}>
          <torusGeometry args={[8.2, 0.45, 6, 48]} />
          <meshStandardMaterial color="#38BDF8" transparent opacity={0.4} />
        </mesh>
      </group>
    );
  }

  if (theme === 'beach-house') {
    return (
      <group>
        <Stars radius={70} depth={30} count={Math.round(starCount * 0.6)} factor={2.4} fade />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, -30]}>
          <planeGeometry args={[120, 48]} />
          <meshStandardMaterial color="#0A1E33" metalness={0.65} roughness={0.22} />
        </mesh>
        <mesh position={[16, 16, -46]}>
          <sphereGeometry args={[2.2, 20, 20]} />
          <meshBasicMaterial color="#E2E8F0" />
        </mesh>
      </group>
    );
  }

  if (theme === 'neon-city') {
    const towers = [
      [-18, 8, -14, 3, 18],
      [-21, 11, -4, 4, 24],
      [-17, 7, 6, 3.2, 16],
      [18, 9, -12, 3.5, 20],
      [21, 12, 0, 4, 26],
      [17, 7, 9, 3, 15],
    ];
    return (
      <group>
        {towers.map(([x, y, z, w, h], idx) => (
          <group key={idx} position={[x, y, z]}>
            <mesh>
              <boxGeometry args={[w, h, w]} />
              <meshStandardMaterial color="#090B14" roughness={0.6} />
            </mesh>
            <mesh position={[x < 0 ? w / 2 + 0.02 : -w / 2 - 0.02, 0, 0]}>
              <boxGeometry args={[0.04, h * 0.85, 0.16]} />
              <meshBasicMaterial color={idx % 2 === 0 ? lightColor : '#3B82F6'} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (theme === 'retro-cinema') {
    return (
      <group>
        {/* Velvet Curtains flanking the screen */}
        <mesh position={[-screenW / 2 - 1.1, screenPos[1], screenPos[2] + 0.15]}>
          <boxGeometry args={[1.6, screenH + 1.2, 0.35]} />
          <meshStandardMaterial color="#5B1420" roughness={0.9} />
        </mesh>
        <mesh position={[screenW / 2 + 1.1, screenPos[1], screenPos[2] + 0.15]}>
          <boxGeometry args={[1.6, screenH + 1.2, 0.35]} />
          <meshStandardMaterial color="#5B1420" roughness={0.9} />
        </mesh>
      </group>
    );
  }

  // Acoustic wall panels for cinema / gaming / lounge
  return (
    <group>
      {[-8, -4, 0, 4, 8].map((zPos, i) => (
        <group key={i}>
          <mesh position={[-11.78, 3.6, zPos]}>
            <boxGeometry args={[0.08, 4.4, 1.5]} />
            <meshStandardMaterial color="#0D0F16" roughness={0.85} />
          </mesh>
          <mesh position={[11.78, 3.6, zPos]}>
            <boxGeometry args={[0.08, 4.4, 1.5]} />
            <meshStandardMaterial color="#0D0F16" roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
