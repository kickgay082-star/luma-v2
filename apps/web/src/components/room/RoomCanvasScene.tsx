'use client';

import { MutableRefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  BoardGameId,
  GraphicsQuality,
  PlayerState,
  PlayerTransformUpdate,
  RoomCustomization,
  SeatState,
  Vec3,
  VideoState,
} from '@luma/shared';
import { RoomEnvironment3D } from '@/components/three/RoomEnvironment3D';
import {
  CameraMode,
  LocalPlayerController,
  MobileInputState,
  RemoteAvatar3D,
} from '@/components/three/PlayerControllers3D';

interface RoomCanvasSceneProps {
  graphicsQuality: GraphicsQuality;
  customization: RoomCustomization;
  seats: SeatState[];
  players: PlayerState[];
  localPlayer: PlayerState | null;
  nearestSeat: SeatState | null;
  nearestGameId?: BoardGameId | null;
  video: VideoState | null;
  cameraMode: CameraMode;
  cameraZoom: number;
  screenVolume: number;
  interactiveScreen: boolean;
  suspended?: boolean;
  screenShareStream?: MediaStream | null;
  isLocalScreenSharer?: boolean;
  canControlVideo?: boolean;
  inputLocked: boolean;
  mobileInputRef: MutableRefObject<MobileInputState>;
  listenerTransformRef: MutableRefObject<{
    position: Vec3;
    forward: Vec3;
    up: Vec3;
  }>;
  localPositionRef: MutableRefObject<Vec3>;
  onTransformEmit: (update: PlayerTransformUpdate) => void;
  onNearestSeatChange: (seat: SeatState | null) => void;
  onInteractSeat: (seat: SeatState | null) => void;
  onClaimSeat: (seatId: string) => void;
  onOpenGameStation?: (gameId: BoardGameId) => void;
  onSelectRemotePlayer: (player: PlayerState) => void;
  onPlayerSyncAction?: (payload: {
    action: 'play' | 'pause' | 'seek' | 'rate';
    currentTime?: number;
    playbackRate?: number;
  }) => void;
  onVideoEnded: () => void;
}

export function RoomCanvasScene({
  graphicsQuality,
  customization,
  seats,
  players,
  localPlayer,
  nearestSeat,
  nearestGameId = null,
  video,
  cameraMode,
  cameraZoom,
  screenVolume,
  interactiveScreen,
  suspended = false,
  screenShareStream = null,
  isLocalScreenSharer = false,
  canControlVideo = true,
  inputLocked,
  mobileInputRef,
  listenerTransformRef,
  localPositionRef,
  onTransformEmit,
  onNearestSeatChange,
  onInteractSeat,
  onClaimSeat,
  onOpenGameStation,
  onSelectRemotePlayer,
  onPlayerSyncAction,
  onVideoEnded,
}: RoomCanvasSceneProps) {
  const dpr: [number, number] =
    graphicsQuality === 'low'
      ? [0.75, 1]
      : graphicsQuality === 'medium'
        ? [1, 1.35]
        : [1, 1.85];

  return (
    <Canvas
      shadows={graphicsQuality !== 'low'}
      dpr={dpr}
      camera={{ position: [0, 3.2, 10], fov: 56, near: 0.1, far: 120 }}
      className="h-full w-full"
    >
      <RoomEnvironment3D
        customization={customization}
        seats={seats}
        nearestSeatId={nearestSeat?.id ?? null}
        localSeatedSeatId={localPlayer?.seatedSeatId ?? null}
        nearestGameId={nearestGameId}
        video={video}
        graphicsQuality={graphicsQuality}
        screenVolume={screenVolume}
        interactiveScreen={interactiveScreen}
        suspended={suspended}
        screenShareStream={screenShareStream}
        isLocalScreenSharer={isLocalScreenSharer}
        canControlVideo={canControlVideo}
        onPlayerSyncAction={onPlayerSyncAction}
        onClaimSeat={onClaimSeat}
        onOpenGameStation={onOpenGameStation}
        onVideoEnded={onVideoEnded}
      />

      {localPlayer && (
        <LocalPlayerController
          localPlayer={localPlayer}
          customization={customization}
          seats={seats}
          cameraMode={cameraMode}
          cameraZoom={cameraZoom}
          inputLocked={inputLocked}
          mobileInputRef={mobileInputRef}
          listenerTransformRef={listenerTransformRef}
          onTransformEmit={onTransformEmit}
          onNearestSeatChange={onNearestSeatChange}
          onInteractSeat={onInteractSeat}
          onLocalPositionChange={(pos) => {
            localPositionRef.current = pos;
          }}
        />
      )}

      {players
        .filter((p) => p.id !== localPlayer?.id)
        .map((remote) => (
          <RemoteAvatar3D
            key={remote.id}
            player={remote}
            onSelect={onSelectRemotePlayer}
          />
        ))}
    </Canvas>
  );
}
