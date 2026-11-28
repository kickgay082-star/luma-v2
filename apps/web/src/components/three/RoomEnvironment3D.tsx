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
import { Effects4D3D } from './Effects4D3D';

interface RoomEnvironment3DProps {
  customization: RoomCustomization;
  seats: SeatState[];
  nearestSeatId: string | null;
  localSeatedSeatId: string | null;
  video: VideoState | null;
  graphicsQuality: GraphicsQuality;
  screenVolume: number;
  interactiveScreen: boolean;
  suspended?: boolean;
  screenShareStream?: MediaStream | null;
  isLocalScreenSharer?: boolean;
  canControlVideo?: boolean;
  onPlayerSyncAction?: (payload: {
    action: 'play' | 'pause' | 'seek' | 'rate';
    currentTime?: number;
    playbackRate?: number;
  }) => void;
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
  suspended = false,
  screenShareStream = null,
  isLocalScreenSharer = false,
  canControlVideo = true,
  onPlayerSyncAction,
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
  const theme = customization.theme;
  const isOpenAir = theme === 'beach-house' || theme === 'space-room' || theme === 'neon-city';
  const hasCeiling = !isOpenAir && theme !== 'luxury-home';

  return (
    <group>
      <color attach="background" args={[meta.skyColor]} />
      <fog attach="fog" args={[meta.fogColor, isOpenAir ? 24 : 16, isOpenAir ? 85 : 46]} />

      {/* Core Lighting Rig */}
      <ambientLight intensity={customization.ambientIntensity} color={theme === 'beach-house' ? '#FFE8C8' : '#D8DCFF'} />
      <directionalLight
        position={[6, 14, 8]}
        intensity={theme === 'beach-house' ? 1.15 : theme === 'luxury-home' ? 0.95 : 0.75}
        castShadow={shadows}
        shadow-mapSize={graphicsQuality === 'high' ? [2048, 2048] : [1024, 1024]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        color={theme === 'beach-house' ? '#FDE68A' : '#E5E7EB'}
      />
      <pointLight
        position={[-8, 5, 4]}
        intensity={1.3}
        distance={24}
        color={customization.lightColor}
      />
      <pointLight
        position={[8, 5, 4]}
        intensity={1.3}
        distance={24}
        color={customization.lightColor}
      />

      {/* Main Walkable Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial
          color={
            theme === 'beach-house'
              ? '#7C5A3A'
              : theme === 'luxury-home'
                ? '#2E2836'
                : theme === 'modern-lounge'
                  ? '#3A2C23'
                  : meta.floorColor
          }
          roughness={theme === 'luxury-home' ? 0.35 : 0.85}
          metalness={theme === 'luxury-home' ? 0.22 : 0.08}
        />
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

      {/* Cinema Stage Platform (wooden pier deck for beach, marble plinth for mansion) */}
      <mesh
        position={[0, 0.22, meta.screen.position[2] + 1.0]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[screenW + 2.2, 0.44, 2.4]} />
        <meshStandardMaterial
          color={
            theme === 'beach-house'
              ? '#6A4B2E'
              : theme === 'luxury-home'
                ? '#3D3547'
                : '#0D0F16'
          }
          roughness={theme === 'luxury-home' ? 0.3 : 0.75}
          metalness={theme === 'luxury-home' ? 0.25 : 0.18}
        />
      </mesh>

      {/* Enclosed Room Walls (hidden for open-air Beach, Space, Penthouse Neon-City) */}
      {!isOpenAir && (
        <group>
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
            <meshStandardMaterial color={meta.wallColor} roughness={0.82} />
          </mesh>
          <mesh position={[bounds.maxX, 4.2, 0]} receiveShadow>
            <boxGeometry args={[0.35, 8.4, roomD]} />
            <meshStandardMaterial color={meta.wallColor} roughness={0.82} />
          </mesh>
        </group>
      )}

      {/* Ceiling */}
      {hasCeiling && (
        <mesh position={[0, 8.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[roomW, roomD]} />
          <meshStandardMaterial color={theme === 'minimalist' ? '#171920' : '#07080C'} roughness={0.9} />
        </mesh>
      )}

      {/* Aisle LED Strips (indoor cinema/gaming/dark themes only) */}
      {(theme === 'premium-cinema' ||
        theme === 'dark-cinema' ||
        theme === 'gaming-room' ||
        theme === 'retro-cinema') && (
        <group>
          <mesh position={[-7.1, 0.015, 1.5]}>
            <boxGeometry args={[0.06, 0.015, 13]} />
            <meshBasicMaterial color={customization.lightColor} />
          </mesh>
          <mesh position={[7.1, 0.015, 1.5]}>
            <boxGeometry args={[0.06, 0.015, 13]} />
            <meshBasicMaterial color={customization.lightColor} />
          </mesh>
        </group>
      )}

      {/* Decorative Side Pillars matching server colliders */}
      {customization.decorPreset !== 'minimal' && !isOpenAir && (
        <group>
          {[-9.2, 9.2].map((px, i) => (
            <group key={i} position={[px, 0, -6.2]}>
              <mesh position={[0, 2.8, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.1, 5.6, 1.1]} />
                <meshStandardMaterial
                  color={theme === 'luxury-home' ? '#E7DFD1' : meta.wallColor}
                  roughness={theme === 'luxury-home' ? 0.35 : 0.7}
                />
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
                <meshStandardMaterial
                  color={theme === 'beach-house' ? '#704E2E' : '#181A24'}
                  roughness={0.6}
                />
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

      {/* Theme-Specific Full World Architecture */}
      <ThemeSpecificBackdrop
        theme={theme}
        lightColor={customization.lightColor}
        graphicsQuality={graphicsQuality}
        screenW={screenW}
        screenH={screenH}
        screenPos={meta.screen.position}
        roomW={roomW}
        roomD={roomD}
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
        suspended={suspended}
        screenShareStream={screenShareStream}
        isLocalScreenSharer={isLocalScreenSharer}
        canControlVideo={canControlVideo}
        onPlayerSyncAction={onPlayerSyncAction}
        onVideoEnded={onVideoEnded}
      />

      {/* 4DX Physical Immersion Effects (Water, Rain, Fire, Snow, Wind, Lightning, Ambilight) */}
      <Effects4D3D roomW={roomW} roomD={roomD} screenZ={meta.screen.position[2]} />

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

function PalmTree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Curved Segmented Trunk */}
      <mesh position={[0, 1.6, 0]} rotation={[0.06, 0, 0.08]} castShadow>
        <cylinderGeometry args={[0.16, 0.24, 3.2, 8]} />
        <meshStandardMaterial color="#6B4423" roughness={0.9} />
      </mesh>
      <mesh position={[0.18, 4.1, 0.1]} rotation={[0.12, 0, -0.05]} castShadow>
        <cylinderGeometry args={[0.11, 0.16, 2.4, 8]} />
        <meshStandardMaterial color="#7C512B" roughness={0.9} />
      </mesh>
      {/* Palm Fronds + Coconuts */}
      {[0, 1.1, 2.2, 3.3, 4.4, 5.4].map((ang, i) => (
        <group key={i} position={[0.2, 5.2, 0.12]} rotation={[0.35, ang, 0]}>
          <mesh position={[0, -0.15, 1.15]} rotation={[0.28, 0, 0]}>
            <boxGeometry args={[0.42, 0.06, 2.2]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#1E6B3A' : '#268047'} roughness={0.75} />
          </mesh>
        </group>
      ))}
      {[
        [0.08, 4.95, 0.25],
        [0.34, 4.92, 0.05],
        [0.18, 4.96, -0.06],
      ].map((p, idx) => (
        <mesh key={idx} position={p as [number, number, number]}>
          <sphereGeometry args={[0.14, 10, 10]} />
          <meshStandardMaterial color="#4A2E14" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function BeachUmbrella({
  position,
  color = '#EF4444',
}: {
  position: [number, number, number];
  color?: string;
}) {
  return (
    <group position={position}>
      {/* Pole */}
      <mesh position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 2.9, 8]} />
        <meshStandardMaterial color="#E5E7EB" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Umbrella Canopy */}
      <mesh position={[0, 2.75, 0]} castShadow>
        <coneGeometry args={[1.65, 0.65, 8]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* Sun Lounger */}
      <group position={[0.9, 0.2, 0]} rotation={[0, -0.25, 0]}>
        <mesh position={[0, 0.14, 0]} castShadow>
          <boxGeometry args={[0.78, 0.12, 1.85]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.34, -0.7]} rotation={[0.55, 0, 0]} castShadow>
          <boxGeometry args={[0.76, 0.1, 0.55]} />
          <meshStandardMaterial color={color} roughness={0.75} />
        </mesh>
      </group>
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
  roomW,
  roomD,
}: {
  theme: RoomCustomization['theme'];
  lightColor: string;
  graphicsQuality: GraphicsQuality;
  screenW: number;
  screenH: number;
  screenPos: [number, number, number];
  roomW: number;
  roomD: number;
}) {
  const starCount = graphicsQuality === 'high' ? 1800 : graphicsQuality === 'medium' ? 900 : 350;

  // 1. SAHİL & PLAJ (Açık hava ahşap iskele, altın kum sahil, deniz, palmiyeler ve meşaleler)
  if (theme === 'beach-house') {
    return (
      <group>
        <Stars radius={85} depth={30} count={Math.round(starCount * 0.55)} factor={2.6} fade />
        {/* Warm Sunset / Moonlit Horizon Glow */}
        <mesh position={[0, 8, -58]}>
          <circleGeometry args={[5.2, 32]} />
          <meshBasicMaterial color="#FDE68A" />
        </mesh>
        <pointLight position={[0, 10, -35]} intensity={1.8} distance={75} color="#FDBA74" />

        {/* Surrounding Golden Sand Beach */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 4]} receiveShadow>
          <planeGeometry args={[140, 44]} />
          <meshStandardMaterial color="#C8A26A" roughness={0.95} />
        </mesh>

        {/* Deep Ocean Water Extending to Horizon */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, -45]}>
          <planeGeometry args={[180, 75]} />
          <meshStandardMaterial color="#0A4C6B" metalness={0.55} roughness={0.18} />
        </mesh>
        {/* Shoreline Foam Strip */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, -15.5]}>
          <planeGeometry args={[140, 1.8]} />
          <meshBasicMaterial color="#7DD3FC" transparent opacity={0.35} />
        </mesh>

        {/* Low Wooden Deck Railings (left, right, back) */}
        {[-roomW / 2, roomW / 2].map((rx, idx) => (
          <group key={idx} position={[rx, 0, 0]}>
            <mesh position={[0, 0.85, 0]}>
              <boxGeometry args={[0.12, 0.08, roomD]} />
              <meshStandardMaterial color="#5C3D24" roughness={0.8} />
            </mesh>
            {[-10, -5, 0, 5, 10].map((pz, j) => (
              <group key={j} position={[0, 0, pz]}>
                <mesh position={[0, 0.55, 0]}>
                  <boxGeometry args={[0.16, 1.1, 0.16]} />
                  <meshStandardMaterial color="#4A301C" roughness={0.85} />
                </mesh>
                {/* Warm Deck Lantern */}
                <mesh position={[0, 1.2, 0]}>
                  <cylinderGeometry args={[0.12, 0.1, 0.24, 8]} />
                  <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={1.2} />
                </mesh>
                <pointLight position={[0, 1.35, 0]} intensity={0.45} distance={7} color="#FBBF24" />
              </group>
            ))}
          </group>
        ))}

        {/* Screen Wooden Support Posts */}
        {[-screenW / 2 - 0.35, screenW / 2 + 0.35].map((px, i) => (
          <mesh key={i} position={[px, screenPos[1] / 2, screenPos[2] - 0.2]}>
            <cylinderGeometry args={[0.18, 0.22, screenPos[1] + 2.6, 10]} />
            <meshStandardMaterial color="#4A301C" roughness={0.85} />
          </mesh>
        ))}

        {/* Wooden Deck Plank Stripes */}
        {[-9, -6, -3, 0, 3, 6, 9].map((zStripe, idx) => (
          <mesh key={idx} position={[0, 0.008, zStripe]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[roomW - 0.5, 0.06]} />
            <meshStandardMaterial color="#4A301C" roughness={0.9} />
          </mesh>
        ))}

        {/* Beach Umbrellas & Cabana Loungers on the Sand */}
        <BeachUmbrella position={[-14.5, -0.1, 2]} color="#F97316" />
        <BeachUmbrella position={[14.5, -0.1, 2.5]} color="#0EA5E9" />
        <BeachUmbrella position={[-13.8, -0.1, -9.5]} color="#EAB308" />

        {/* Palm Trees Around the Beach */}
        <PalmTree position={[-15.5, -0.1, -6]} />
        <PalmTree position={[15.5, -0.1, -5]} />
        <PalmTree position={[-16.5, -0.1, 7]} />
        <PalmTree position={[16.2, -0.1, 8]} />
        <PalmTree position={[-11, -0.1, -13.5]} />
        <PalmTree position={[11.5, -0.1, -13.8]} />
      </group>
    );
  }

  // 2. MALİKANE (Lüks Villa: mermer zemin, beyaz/altın sütunlar, kristal avize, şömine, halı)
  if (theme === 'luxury-home') {
    return (
      <group>
        {/* Grand Coffered Ceiling */}
        <mesh position={[0, 8.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[roomW, roomD]} />
          <meshStandardMaterial color="#1E1824" roughness={0.5} />
        </mesh>

        {/* Velvet Carpet Under Seating Area */}
        <mesh position={[0, 0.015, 2.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[12.8, 10.5]} />
          <meshStandardMaterial color="#4A1D3D" roughness={0.92} />
        </mesh>
        <mesh position={[0, 0.018, 2.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[5.8, 6.1, 4]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Checkered Marble Floor Trim Tiles */}
        {[-9, -5, -1, 3, 7, 11].map((zTile, i) => (
          <mesh key={i} position={[0, 0.009, zTile]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[roomW - 2, 0.14]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.55} roughness={0.35} />
          </mesh>
        ))}

        {/* Arched Moonlit Villa Windows along Rear Corners */}
        {[-6.8, 6.8].map((wx, idx) => (
          <group key={idx} position={[wx, 4.4, 11.78]}>
            <mesh>
              <boxGeometry args={[3.2, 4.4, 0.14]} />
              <meshStandardMaterial color="#0D192B" emissive="#1E3A8A" emissiveIntensity={0.45} />
            </mesh>
            <mesh position={[0, 0, -0.08]}>
              <boxGeometry args={[3.45, 4.65, 0.06]} />
              <meshStandardMaterial color="#D4AF37" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        ))}

        {/* Grand Crystal Chandelier */}
        <group position={[0, 7.2, 1.5]}>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 1.4, 8]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.4, 0.07, 10, 32]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.85, 0.05, 8, 24]} />
            <meshStandardMaterial color="#FDE68A" emissive="#F59E0B" emissiveIntensity={1.1} />
          </mesh>
          <pointLight position={[0, -0.4, 0]} intensity={2.2} distance={24} color="#FDE68A" />
        </group>

        {/* Marble & Gold Columns along both sides */}
        {[-10.4, 10.4].map((xPos, sideIdx) =>
          [-7, -1, 5].map((zPos, i) => (
            <group key={`${sideIdx}-${i}`} position={[xPos, 0, zPos]}>
              <mesh position={[0, 4.1, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.42, 0.48, 8.2, 16]} />
                <meshStandardMaterial color="#ECE6DC" roughness={0.28} metalness={0.08} />
              </mesh>
              <mesh position={[0, 0.25, 0]}>
                <boxGeometry args={[1.2, 0.5, 1.2]} />
                <meshStandardMaterial color="#D4AF37" metalness={0.7} roughness={0.3} />
              </mesh>
              <mesh position={[0, 7.95, 0]}>
                <boxGeometry args={[1.2, 0.5, 1.2]} />
                <meshStandardMaterial color="#D4AF37" metalness={0.7} roughness={0.3} />
              </mesh>
            </group>
          )),
        )}

        {/* Glowing Villa Fireplace on Left Wall + Art Gallery Frame on Right Wall */}
        <group position={[-10.6, 0, 2]}>
          <mesh position={[0, 1.1, 0]} castShadow>
            <boxGeometry args={[0.8, 2.2, 3.2]} />
            <meshStandardMaterial color="#3A2F3D" roughness={0.4} />
          </mesh>
          <mesh position={[0.42, 0.65, 0]}>
            <boxGeometry args={[0.08, 0.9, 1.6]} />
            <meshStandardMaterial color="#F97316" emissive="#EA580C" emissiveIntensity={1.6} />
          </mesh>
          <pointLight position={[1.1, 0.9, 0]} intensity={1.4} distance={10} color="#FB923C" />
        </group>

        <group position={[10.65, 3.4, 2]}>
          <mesh>
            <boxGeometry args={[0.12, 2.6, 3.8]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.7} roughness={0.25} />
          </mesh>
          <mesh position={[-0.07, 0, 0]}>
            <boxGeometry args={[0.04, 2.2, 3.4]} />
            <meshStandardMaterial color="#2D1B4E" roughness={0.6} />
          </mesh>
        </group>
      </group>
    );
  }

  // 3. MODERN ODA / LOUNGE (Ev salonu: halı, sıcak lambaderler, ahşap duvar çıtaları, pencereler ve bitkiler)
  if (theme === 'modern-lounge') {
    return (
      <group>
        {/* Cozy Woven Living-Room Rug */}
        <mesh position={[0, 0.015, 2.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[12.5, 9.8]} />
          <meshStandardMaterial color="#2E3240" roughness={0.95} />
        </mesh>

        {/* Warm Low Bookshelf & Console on Back Wall */}
        <group position={[0, 0, 11.1]}>
          <mesh position={[0, 1.05, 0]} castShadow>
            <boxGeometry args={[7.2, 2.1, 0.7]} />
            <meshStandardMaterial color="#4A3222" roughness={0.75} />
          </mesh>
          {[-2.4, -0.8, 0.8, 2.4].map((bx, i) => (
            <mesh key={i} position={[bx, 1.45, -0.05]}>
              <boxGeometry args={[1.1, 0.45, 0.5]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? '#D4A373' : '#7C5CFF'}
                roughness={0.65}
              />
            </mesh>
          ))}
        </group>

        {/* Warm Wood Slat Accents & Tall Loft Windows */}
        {[-11.75, 11.75].map((xPos, side) => (
          <group key={side}>
            {[-4, 1.5, 7].map((zPos, j) => (
              <group key={j} position={[xPos, 3.6, zPos]}>
                <mesh>
                  <boxGeometry args={[0.1, 4.4, 2.4]} />
                  <meshStandardMaterial color="#0D192B" emissive="#1E3A5F" emissiveIntensity={0.35} />
                </mesh>
                <mesh position={[side === 0 ? 0.06 : -0.06, 0, 0]}>
                  <boxGeometry args={[0.05, 4.5, 0.08]} />
                  <meshStandardMaterial color="#4B382A" />
                </mesh>
              </group>
            ))}
          </group>
        ))}

        {/* Warm Standing Floor Lamps + Indoor Potted Plants */}
        {[-8.2, 8.2].map((xPos, idx) => (
          <group key={idx} position={[xPos, 0, 4.2]}>
            <mesh position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.04, 0.05, 2.4, 8]} />
              <meshStandardMaterial color="#D4A373" metalness={0.5} />
            </mesh>
            <mesh position={[0, 2.45, 0]}>
              <cylinderGeometry args={[0.28, 0.42, 0.45, 14]} />
              <meshStandardMaterial color="#FEF3C7" emissive="#F59E0B" emissiveIntensity={0.85} />
            </mesh>
            <pointLight position={[0, 2.3, 0]} intensity={1.1} distance={10} color="#FDE68A" />
          </group>
        ))}

        {[-9.8, 9.8].map((xPos, idx) => (
          <group key={idx} position={[xPos, 0, -1.5]}>
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.35, 0.25, 0.7, 12]} />
              <meshStandardMaterial color="#D6D3D1" roughness={0.7} />
            </mesh>
            <mesh position={[0, 1.05, 0]}>
              <dodecahedronGeometry args={[0.55, 0]} />
              <meshStandardMaterial color="#1F6E43" roughness={0.8} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  // 4. UZAY ODASI (Cam kubbe, yıldızlar ve dev halkalı gezegen)
  if (theme === 'space-room') {
    return (
      <group>
        <Stars radius={65} depth={40} count={starCount} factor={3.2} fade speed={0.4} />
        <mesh position={[-22, 6, -18]}>
          <sphereGeometry args={[5.8, 28, 24]} />
          <meshStandardMaterial color="#1E3A5F" roughness={0.65} />
        </mesh>
        <mesh position={[-22, 6, -18]} rotation={[1.2, 0.3, 0]}>
          <torusGeometry args={[8.5, 0.48, 6, 48]} />
          <meshStandardMaterial color="#38BDF8" transparent opacity={0.45} />
        </mesh>
        <mesh position={[20, 12, -32]}>
          <sphereGeometry args={[3.2, 24, 20]} />
          <meshStandardMaterial color="#6D28D9" emissive="#4C1D95" emissiveIntensity={0.4} />
        </mesh>
        {/* Glass Observation Arch Ribs */}
        {[-7, 0, 7].map((zPos, i) => (
          <mesh key={i} position={[0, 4.2, zPos]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[12.2, 0.16, 8, 32, Math.PI]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
      </group>
    );
  }

  // 5. NEON ŞEHİR PENTHOUSE (Açık teras cam korkuluğu + gökdelenler)
  if (theme === 'neon-city') {
    const towers = [
      [-18, 8, -14, 3, 18],
      [-21, 11, -4, 4, 24],
      [-17, 7, 6, 3.2, 16],
      [-10, 10, -22, 3.6, 22],
      [10, 12, -23, 4.2, 26],
      [18, 9, -12, 3.5, 20],
      [21, 12, 0, 4, 26],
      [17, 7, 9, 3, 15],
    ];
    return (
      <group>
        <Stars radius={75} depth={30} count={Math.round(starCount * 0.4)} factor={2} fade />
        {/* Glass Terrace Railings */}
        {[-roomW / 2, roomW / 2].map((rx, idx) => (
          <mesh key={idx} position={[rx, 0.65, 0]}>
            <boxGeometry args={[0.08, 1.3, roomD]} />
            <meshStandardMaterial color="#38BDF8" transparent opacity={0.22} metalness={0.8} roughness={0.1} />
          </mesh>
        ))}
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

  // 6. RETRO SİNEMA (Kadife perdeler, bordo halı, pirinç aplikler)
  if (theme === 'retro-cinema') {
    return (
      <group>
        <mesh position={[0, 0.015, 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[12, 12]} />
          <meshStandardMaterial color="#4A101B" roughness={0.92} />
        </mesh>
        <mesh position={[-screenW / 2 - 1.1, screenPos[1], screenPos[2] + 0.15]}>
          <boxGeometry args={[1.6, screenH + 1.2, 0.35]} />
          <meshStandardMaterial color="#681322" roughness={0.9} />
        </mesh>
        <mesh position={[screenW / 2 + 1.1, screenPos[1], screenPos[2] + 0.15]}>
          <boxGeometry args={[1.6, screenH + 1.2, 0.35]} />
          <meshStandardMaterial color="#681322" roughness={0.9} />
        </mesh>
        {[-11.7, 11.7].map((xPos, s) =>
          [-5, 0, 5].map((zPos, i) => (
            <pointLight key={`${s}-${i}`} position={[xPos * 0.9, 3.6, zPos]} intensity={0.75} distance={9} color="#F59E0B" />
          )),
        )}
      </group>
    );
  }

  // 7. GAMING ROOM (RGB stüdyo masaları, tavan RGB barları ve duvar ışıkları)
  if (theme === 'gaming-room') {
    return (
      <group>
        {/* Overhead RGB Esports Truss Bars */}
        {[-2, 4].map((zBar, idx) => (
          <group key={idx} position={[0, 7.6, zBar]}>
            <mesh>
              <boxGeometry args={[16, 0.14, 0.14]} />
              <meshStandardMaterial
                color={idx === 0 ? lightColor : '#3B82F6'}
                emissive={idx === 0 ? lightColor : '#3B82F6'}
                emissiveIntensity={1.2}
              />
            </mesh>
          </group>
        ))}
        {/* Neon Floor Border Grid */}
        <mesh position={[0, 0.012, 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[7.6, 7.8, 4]} />
          <meshBasicMaterial color={lightColor} />
        </mesh>
        {[-10.4, 10.4].map((xPos, side) =>
          [-3, 3].map((zPos, idx) => (
            <group key={`${side}-${idx}`} position={[xPos, 0, zPos]}>
              <mesh position={[0, 0.75, 0]}>
                <boxGeometry args={[0.9, 0.08, 2.2]} />
                <meshStandardMaterial color="#1E293B" roughness={0.4} />
              </mesh>
              <mesh position={[side === 0 ? -0.25 : 0.25, 1.25, 0]}>
                <boxGeometry args={[0.06, 0.65, 1.3]} />
                <meshStandardMaterial color="#0F172A" emissive={idx % 2 === 0 ? lightColor : '#3B82F6'} emissiveIntensity={0.8} />
              </mesh>
            </group>
          )),
        )}
      </group>
    );
  }

  // 8. MİNİMALİST ODA (Açık tavan ışığı & galeri duvarları)
  if (theme === 'minimalist') {
    return (
      <group>
        <mesh position={[0, 8.35, 1]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[7.5, 9]} />
          <meshBasicMaterial color="#CBD5E1" />
        </mesh>
      </group>
    );
  }

  // 9. SİNEMA SALONLARI (Akustik duvar panelleri)
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
