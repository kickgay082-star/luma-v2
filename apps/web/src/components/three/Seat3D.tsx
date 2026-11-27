'use client';

import { useState } from 'react';
import { SeatState } from '@luma/shared';

interface Seat3DProps {
  seat: SeatState;
  isNearest: boolean;
  isOccupiedByMe: boolean;
  accentColor: string;
  onClaim: (seatId: string) => void;
}

export function Seat3D({
  seat,
  isNearest,
  isOccupiedByMe,
  accentColor,
  onClaim,
}: Seat3DProps) {
  const [hovered, setHovered] = useState(false);
  const occupied = Boolean(seat.occupiedBy);
  const canHighlight = !occupied && (isNearest || hovered);

  const primaryMat =
    seat.seatType === 'cinema'
      ? '#1E1B2E'
      : seat.seatType === 'sofa'
        ? '#262936'
        : seat.seatType === 'gaming'
          ? '#161822'
          : '#23202D';

  const trimColor = isOccupiedByMe
    ? '#34D399'
    : canHighlight
      ? accentColor
      : occupied
        ? '#4B5563'
        : '#2E3346';

  return (
    <group
      position={seat.position}
      rotation={[0, seat.rotationY, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onClaim(seat.id);
      }}
    >
      {/* Seat interaction base indicator */}
      {(isNearest || isOccupiedByMe || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.52, 0.58, 28]} />
          <meshBasicMaterial
            color={isOccupiedByMe ? '#34D399' : occupied ? '#F59E0B' : accentColor}
            transparent
            opacity={0.75}
          />
        </mesh>
      )}

      {/* Base / Pedestal */}
      <mesh castShadow receiveShadow position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.26, 0.34, 0.28, 12]} />
        <meshStandardMaterial color="#0F1117" metalness={0.5} roughness={0.45} />
      </mesh>

      {/* Seat Cushion */}
      <mesh castShadow receiveShadow position={[0, 0.34, 0.04]}>
        <boxGeometry
          args={[
            seat.seatType === 'sofa' ? 0.92 : 0.72,
            0.16,
            0.66,
          ]}
        />
        <meshStandardMaterial color={primaryMat} roughness={0.78} />
      </mesh>

      {/* Backrest */}
      <mesh
        castShadow
        receiveShadow
        position={[0, seat.seatType === 'gaming' ? 0.78 : 0.68, -0.27]}
        rotation={[-0.14, 0, 0]}
      >
        <boxGeometry
          args={[
            seat.seatType === 'sofa' ? 0.92 : 0.68,
            seat.seatType === 'gaming' ? 0.86 : 0.68,
            0.14,
          ]}
        />
        <meshStandardMaterial color={primaryMat} roughness={0.75} />
      </mesh>

      {/* Accent Piping / Headrest */}
      <mesh position={[0, seat.seatType === 'gaming' ? 1.05 : 0.98, -0.22]}>
        <boxGeometry args={[0.36, 0.14, 0.08]} />
        <meshStandardMaterial
          color={trimColor}
          roughness={0.45}
          emissive={canHighlight ? accentColor : '#000000'}
          emissiveIntensity={canHighlight ? 0.35 : 0}
        />
      </mesh>

      {/* Armrests */}
      {seat.seatType !== 'sofa' && (
        <>
          <mesh castShadow position={[-0.39, 0.48, 0.02]}>
            <boxGeometry args={[0.1, 0.14, 0.56]} />
            <meshStandardMaterial color="#141722" roughness={0.6} />
          </mesh>
          <mesh castShadow position={[0.39, 0.48, 0.02]}>
            <boxGeometry args={[0.1, 0.14, 0.56]} />
            <meshStandardMaterial color="#141722" roughness={0.6} />
          </mesh>
        </>
      )}
    </group>
  );
}
