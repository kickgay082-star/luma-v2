import {
  ColliderBox,
  RoomCustomization,
  RoomThemeId,
  SeatLayoutType,
  SeatState,
  SeatVisualType,
  Vec3,
} from '../types.js';

export interface RoomThemeMeta {
  id: RoomThemeId;
  name: string;
  subtitle: string;
  badge: string;
  defaultLightColor: string;
  defaultAmbient: number;
  floorColor: string;
  wallColor: string;
  accentColor: string;
  fogColor: string;
  skyColor: string;
  seatVisualType: SeatVisualType;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  screen: {
    position: Vec3;
    baseWidth: number;
    baseHeight: number;
  };
  spawnPoints: Vec3[];
}

export const ROOM_THEMES: Record<RoomThemeId, RoomThemeMeta> = {
  'premium-cinema': {
    id: 'premium-cinema',
    name: 'Premium Sinema Salonu',
    subtitle: 'Akustik duvar panelleri, kademeli platform ve geniş IMAX ekran',
    badge: 'İmza Salon',
    defaultLightColor: '#7C5CFF',
    defaultAmbient: 0.38,
    floorColor: '#111219',
    wallColor: '#161824',
    accentColor: '#7C5CFF',
    fogColor: '#090A0F',
    skyColor: '#07080C',
    seatVisualType: 'cinema',
    bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 },
    screen: { position: [0, 4.1, -10.8], baseWidth: 11.2, baseHeight: 6.3 },
    spawnPoints: [
      [-6.5, 0, 8.5],
      [6.5, 0, 8.5],
      [0, 0, 9.6],
      [-4.2, 0, 9.2],
      [4.2, 0, 9.2],
    ],
  },
  'modern-lounge': {
    id: 'modern-lounge',
    name: 'Modern Lounge',
    subtitle: 'Ahşap çıtalar, sıcak dolaylı aydınlatma ve sosyal oturma grupları',
    badge: 'Sosyal',
    defaultLightColor: '#3B82F6',
    defaultAmbient: 0.52,
    floorColor: '#1A1B22',
    wallColor: '#21232E',
    accentColor: '#3B82F6',
    fogColor: '#0D0E14',
    skyColor: '#0A0B10',
    seatVisualType: 'sofa',
    bounds: { minX: -11.5, maxX: 11.5, minZ: -11.5, maxZ: 11.5 },
    screen: { position: [0, 3.8, -10.2], baseWidth: 9.8, baseHeight: 5.5 },
    spawnPoints: [
      [-6, 0, 8],
      [6, 0, 8],
      [0, 0, 9],
    ],
  },
  'luxury-home': {
    id: 'luxury-home',
    name: 'Lüks Ev Sineması',
    subtitle: 'Kadife dokular, mermer detaylar ve özel VIP izleme deneyimi',
    badge: 'VIP',
    defaultLightColor: '#A78BFA',
    defaultAmbient: 0.44,
    floorColor: '#17141C',
    wallColor: '#1E1A26',
    accentColor: '#8B5CF6',
    fogColor: '#0B0910',
    skyColor: '#09070D',
    seatVisualType: 'lounge',
    bounds: { minX: -11, maxX: 11, minZ: -11, maxZ: 11 },
    screen: { position: [0, 3.7, -9.8], baseWidth: 9.6, baseHeight: 5.4 },
    spawnPoints: [
      [-5.5, 0, 7.8],
      [5.5, 0, 7.8],
      [0, 0, 8.8],
    ],
  },
  minimalist: {
    id: 'minimalist',
    name: 'Minimalist Oda',
    subtitle: 'Temiz mimari hatlar, mat beton yüzeyler ve dikkat dağıtmayan odak',
    badge: 'Saf Odak',
    defaultLightColor: '#94A3B8',
    defaultAmbient: 0.58,
    floorColor: '#181A1F',
    wallColor: '#22252D',
    accentColor: '#60A5FA',
    fogColor: '#101216',
    skyColor: '#0C0D11',
    seatVisualType: 'lounge',
    bounds: { minX: -11, maxX: 11, minZ: -11, maxZ: 11 },
    screen: { position: [0, 3.8, -9.8], baseWidth: 10, baseHeight: 5.6 },
    spawnPoints: [
      [-5, 0, 8],
      [5, 0, 8],
      [0, 0, 9],
    ],
  },
  'gaming-room': {
    id: 'gaming-room',
    name: 'Gaming Room',
    subtitle: 'Akustik köpük duvarlar, oyuncu koltukları ve e-spor sahne ışıkları',
    badge: 'Espor',
    defaultLightColor: '#6366F1',
    defaultAmbient: 0.42,
    floorColor: '#11131B',
    wallColor: '#161925',
    accentColor: '#3B82F6',
    fogColor: '#080A12',
    skyColor: '#06070D',
    seatVisualType: 'gaming',
    bounds: { minX: -11.5, maxX: 11.5, minZ: -11.5, maxZ: 11.5 },
    screen: { position: [0, 3.9, -10.3], baseWidth: 10.6, baseHeight: 6 },
    spawnPoints: [
      [-6, 0, 8.2],
      [6, 0, 8.2],
      [0, 0, 9.2],
    ],
  },
  'retro-cinema': {
    id: 'retro-cinema',
    name: 'Retro Sinema',
    subtitle: 'Art Deco perdeler, sıcak tungsten aplikler ve nostaljik salon',
    badge: 'Klasik',
    defaultLightColor: '#D97706',
    defaultAmbient: 0.4,
    floorColor: '#1A1114',
    wallColor: '#24161A',
    accentColor: '#B45309',
    fogColor: '#10090B',
    skyColor: '#0B0607',
    seatVisualType: 'cinema',
    bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 },
    screen: { position: [0, 4.0, -10.6], baseWidth: 10.6, baseHeight: 6 },
    spawnPoints: [
      [-6, 0, 8.5],
      [6, 0, 8.5],
      [0, 0, 9.4],
    ],
  },
  'space-room': {
    id: 'space-room',
    name: 'Uzay Odası',
    subtitle: 'Yörünge gözlem güvertesi, yıldız kubbesi ve holo-ekran',
    badge: 'Yörünge',
    defaultLightColor: '#38BDF8',
    defaultAmbient: 0.44,
    floorColor: '#0D121C',
    wallColor: '#121A28',
    accentColor: '#38BDF8',
    fogColor: '#050810',
    skyColor: '#03050B',
    seatVisualType: 'gaming',
    bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 },
    screen: { position: [0, 4.0, -10.5], baseWidth: 11, baseHeight: 6.2 },
    spawnPoints: [
      [-6, 0, 8.4],
      [6, 0, 8.4],
      [0, 0, 9.4],
    ],
  },
  'beach-house': {
    id: 'beach-house',
    name: 'Sahil Evi',
    subtitle: 'Açık teras ahşabı, ay ışığı ufku ve rahat sahil şezlongları',
    badge: 'Açık Hava',
    defaultLightColor: '#60A5FA',
    defaultAmbient: 0.62,
    floorColor: '#241F1A',
    wallColor: '#1A2330',
    accentColor: '#38BDF8',
    fogColor: '#0C1622',
    skyColor: '#0A1523',
    seatVisualType: 'lounge',
    bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 },
    screen: { position: [0, 3.8, -10.2], baseWidth: 10.2, baseHeight: 5.7 },
    spawnPoints: [
      [-6, 0, 8.2],
      [6, 0, 8.2],
      [0, 0, 9.1],
    ],
  },
  'dark-cinema': {
    id: 'dark-cinema',
    name: 'Karanlık Sinema',
    subtitle: 'Sıfır yansıma siyah yüzeyler ve saf perde kontrastı',
    badge: 'Pure Black',
    defaultLightColor: '#6D28D9',
    defaultAmbient: 0.24,
    floorColor: '#09090D',
    wallColor: '#0D0D13',
    accentColor: '#7C5CFF',
    fogColor: '#040407',
    skyColor: '#030305',
    seatVisualType: 'cinema',
    bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 },
    screen: { position: [0, 4.1, -10.8], baseWidth: 11.4, baseHeight: 6.4 },
    spawnPoints: [
      [-6.5, 0, 8.5],
      [6.5, 0, 8.5],
      [0, 0, 9.5],
    ],
  },
  'neon-city': {
    id: 'neon-city',
    name: 'Neon Şehir Lounge',
    subtitle: 'Gece gökdelen silüeti, cam korkuluklar ve kontrollü şehir ışıkları',
    badge: 'Penthouse',
    defaultLightColor: '#818CF8',
    defaultAmbient: 0.4,
    floorColor: '#11131D',
    wallColor: '#161A29',
    accentColor: '#7C5CFF',
    fogColor: '#070913',
    skyColor: '#060812',
    seatVisualType: 'sofa',
    bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 },
    screen: { position: [0, 4.0, -10.5], baseWidth: 10.8, baseHeight: 6.1 },
    spawnPoints: [
      [-6, 0, 8.4],
      [6, 0, 8.4],
      [0, 0, 9.4],
    ],
  },
};

export const ROOM_THEME_LIST: RoomThemeMeta[] = Object.values(ROOM_THEMES);

function generateSeatsForLayout(
  layout: SeatLayoutType,
  seatVisualType: SeatVisualType,
): SeatState[] {
  const seats: SeatState[] = [];

  if (layout === 'theater') {
    const rows = [
      { label: 'A', z: -2.6, y: 0, count: 6, spacing: 2.0 },
      { label: 'B', z: 0.8, y: 0.16, count: 6, spacing: 2.1 },
      { label: 'C', z: 4.3, y: 0.34, count: 6, spacing: 2.2 },
    ];
    rows.forEach((r, rowIdx) => {
      const startX = -((r.count - 1) * r.spacing) / 2;
      for (let i = 0; i < r.count; i++) {
        const x = Number((startX + i * r.spacing).toFixed(2));
        seats.push({
          id: `seat-${r.label}${i + 1}`,
          label: `Koltuk ${r.label}${i + 1}`,
          row: rowIdx + 1,
          position: [x, r.y, r.z],
          rotationY: Math.PI, // facing -Z (screen)
          seatType: seatVisualType,
          occupiedBy: null,
          occupiedByName: null,
        });
      }
    });
  } else if (layout === 'lounge-u') {
    // Back sofa line + left & right wing seats facing screen/center
    const backXs = [-3.6, -1.8, 0, 1.8, 3.6];
    backXs.forEach((x, idx) => {
      seats.push({
        id: `seat-U${idx + 1}`,
        label: `Lounge ${idx + 1}`,
        row: 1,
        position: [x, 0, 3.4],
        rotationY: Math.PI,
        seatType: 'sofa',
        occupiedBy: null,
        occupiedByName: null,
      });
    });
    const sideZs = [-1.8, 0.2, 2.0];
    sideZs.forEach((z, idx) => {
      seats.push({
        id: `seat-L${idx + 1}`,
        label: `Sol Kanat ${idx + 1}`,
        row: 2,
        position: [-5.6, 0, z],
        rotationY: Math.PI * 0.72,
        seatType: seatVisualType,
        occupiedBy: null,
        occupiedByName: null,
      });
      seats.push({
        id: `seat-R${idx + 1}`,
        label: `Sağ Kanat ${idx + 1}`,
        row: 2,
        position: [5.6, 0, z],
        rotationY: -Math.PI * 0.72,
        seatType: seatVisualType,
        occupiedBy: null,
        occupiedByName: null,
      });
    });
  } else if (layout === 'circle') {
    const count = 12;
    const radius = 4.8;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 1.4 - Math.PI * 0.7; // semi-circle facing screen
      const x = Number((Math.sin(angle) * radius).toFixed(2));
      const z = Number((Math.cos(angle) * radius - 0.3).toFixed(2));
      const rotY = Math.atan2(-x, -10 - z); // angle towards screen [0, *, -10]
      seats.push({
        id: `seat-C${i + 1}`,
        label: `Çember ${i + 1}`,
        row: 1,
        position: [x, 0, z],
        rotationY: rotY,
        seatType: seatVisualType,
        occupiedBy: null,
        occupiedByName: null,
      });
    }
  } else {
    // duo-rows: couples / duos in two comfy rows
    const rowZs = [-1.8, 2.4];
    const pairCenters = [-4.4, 0, 4.4];
    let n = 1;
    rowZs.forEach((z, rowIdx) => {
      pairCenters.forEach((cx) => {
        [-0.75, 0.75].forEach((offset) => {
          seats.push({
            id: `seat-D${n}`,
            label: `Duo ${n}`,
            row: rowIdx + 1,
            position: [Number((cx + offset).toFixed(2)), rowIdx * 0.18, z],
            rotationY: Math.PI,
            seatType: 'lounge',
            occupiedBy: null,
            occupiedByName: null,
          });
          n++;
        });
      });
    });
  }

  return seats;
}

export interface RoomGeometry {
  meta: RoomThemeMeta;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  seats: SeatState[];
  colliders: ColliderBox[];
}

export function buildRoomGeometry(
  themeId: RoomThemeId,
  customization: Pick<RoomCustomization, 'seatLayout' | 'decorPreset' | 'screenScale'>,
): RoomGeometry {
  const meta = ROOM_THEMES[themeId] ?? ROOM_THEMES['premium-cinema'];
  const seats = generateSeatsForLayout(customization.seatLayout, meta.seatVisualType);
  const b = meta.bounds;
  const wallThickness = 0.6;

  const colliders: ColliderBox[] = [
    // Perimeter walls
    {
      id: 'wall-north',
      minX: b.minX - wallThickness,
      maxX: b.maxX + wallThickness,
      minZ: b.minZ - wallThickness,
      maxZ: b.minZ + 0.15,
      kind: 'wall',
    },
    {
      id: 'wall-south',
      minX: b.minX - wallThickness,
      maxX: b.maxX + wallThickness,
      minZ: b.maxZ - 0.15,
      maxZ: b.maxZ + wallThickness,
      kind: 'wall',
    },
    {
      id: 'wall-west',
      minX: b.minX - wallThickness,
      maxX: b.minX + 0.15,
      minZ: b.minZ,
      maxZ: b.maxZ,
      kind: 'wall',
    },
    {
      id: 'wall-east',
      minX: b.maxX - 0.15,
      maxX: b.maxX + wallThickness,
      minZ: b.minZ,
      maxZ: b.maxZ,
      kind: 'wall',
    },
    // Cinema stage / screen platform collider
    {
      id: 'stage-platform',
      minX: -((meta.screen.baseWidth * customization.screenScale) / 2 + 1.1),
      maxX: (meta.screen.baseWidth * customization.screenScale) / 2 + 1.1,
      minZ: b.minZ,
      maxZ: meta.screen.position[2] + 2.2,
      kind: 'screen',
    },
  ];

  // Add physical collision boxes for each seat so avatars walk around chairs cleanly
  for (const seat of seats) {
    const halfW = seat.seatType === 'sofa' ? 0.62 : 0.48;
    const halfD = 0.52;
    colliders.push({
      id: `col-${seat.id}`,
      minX: seat.position[0] - halfW,
      maxX: seat.position[0] + halfW,
      minZ: seat.position[2] - halfD,
      maxZ: seat.position[2] + halfD,
      kind: 'seat',
    });
  }

  // Decorative side tables / pillars depending on decor preset
  if (customization.decorPreset !== 'minimal') {
    colliders.push(
      {
        id: 'decor-pillar-nw',
        minX: -9.8,
        maxX: -8.6,
        minZ: -6.8,
        maxZ: -5.6,
        kind: 'decor',
      },
      {
        id: 'decor-pillar-ne',
        minX: 8.6,
        maxX: 9.8,
        minZ: -6.8,
        maxZ: -5.6,
        kind: 'decor',
      },
    );
  }

  if (customization.decorPreset === 'lush') {
    colliders.push(
      {
        id: 'decor-console-sw',
        minX: -9.6,
        maxX: -8.0,
        minZ: 5.5,
        maxZ: 6.9,
        kind: 'decor',
      },
      {
        id: 'decor-console-se',
        minX: 8.0,
        maxX: 9.6,
        minZ: 5.5,
        maxZ: 6.9,
        kind: 'decor',
      },
    );
  }

  return {
    meta,
    bounds: b,
    seats,
    colliders,
  };
}

export function getFloorElevationAt(
  z: number,
  layout: SeatLayoutType,
): number {
  if (layout === 'theater') {
    if (z > 2.7 && z < 6.1) return 0.34;
    if (z > -0.7 && z <= 2.7) return 0.16;
  } else if (layout === 'duo-rows') {
    if (z > 0.8 && z < 4.0) return 0.18;
  }
  return 0;
}
