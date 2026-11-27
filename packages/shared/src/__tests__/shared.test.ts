import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoomGeometry,
  computeSpatialAttenuation,
  extractYouTubeId,
  parseM3uPlaylist,
  resolvePlayerMovement,
  validateExternalHttpUrl,
} from '../index.js';

test('SSRF validator rejects private networks and accepts public https', () => {
  assert.equal(validateExternalHttpUrl('https://example.com/stream.m3u8').ok, true);
  assert.equal(validateExternalHttpUrl('http://127.0.0.1:8080/live.m3u8').ok, false);
  assert.equal(validateExternalHttpUrl('http://localhost:3000/test').ok, false);
  assert.equal(validateExternalHttpUrl('http://169.254.169.254/latest/meta-data').ok, false);
  assert.equal(validateExternalHttpUrl('http://192.168.1.10/stream').ok, false);
  assert.equal(validateExternalHttpUrl('ftp://example.com/file').ok, false);
});

test('YouTube URL parser supports watch, short, live, and shorts formats', () => {
  assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=12'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('https://www.youtube.com/live/jfKfPfyJRdk'), 'jfKfPfyJRdk');
  assert.equal(extractYouTubeId('https://notyoutube.com/watch?v=dQw4w9WgXcQ'), null);
});

test('M3U parser extracts channels, logos, and categories safely', () => {
  const sample = `#EXTM3U
#EXTINF:-1 tvg-id="tr1" tvg-logo="https://cdn.example.com/logo1.png" group-title="Belgesel",Doğa HD
https://stream.example.com/doga/index.m3u8
#EXTINF:-1 group-title="Yerel",Yasaklı Lokal
http://127.0.0.1:8080/local.m3u8
#EXTINF:-1 tvg-name="Müzik TV" group-title="Müzik",Müzik Kanalı
https://stream.example.com/music/live.m3u8
`;
  const parsed = parseM3uPlaylist(sample);
  assert.equal(parsed.channels.length, 2);
  assert.equal(parsed.skippedCount, 1);
  assert.deepEqual(parsed.groups, ['Belgesel', 'Müzik']);
  assert.equal(parsed.channels[0].logo, 'https://cdn.example.com/logo1.png');
  assert.equal(parsed.channels[1].name, 'Müzik Kanalı');
});

test('Collision resolver keeps avatar within bounds and outside seats/walls', () => {
  const geom = buildRoomGeometry('premium-cinema', {
    seatLayout: 'theater',
    decorPreset: 'classic',
    screenScale: 1,
  });
  // Attempt to walk out of north wall
  const outWall = resolvePlayerMovement([0, 0, -10], [0, 0, -25], geom.colliders, geom.bounds);
  assert.ok(outWall[2] > geom.bounds.minZ);

  // Attempt to stand directly at center of first seat
  const seat = geom.seats[0];
  const pushedOut = resolvePlayerMovement(
    [seat.position[0], 0, seat.position[2] + 1.2],
    [seat.position[0], 0, seat.position[2]],
    geom.colliders,
    geom.bounds,
  );
  const dist = Math.hypot(pushedOut[0] - seat.position[0], pushedOut[2] - seat.position[2]);
  assert.ok(dist >= 0.4, `Expected push outside seat collider, got dist=${dist}`);
});

test('Spatial audio attenuation respects proximity distance curve', () => {
  assert.equal(computeSpatialAttenuation(1.5, 3, 15), 1);
  assert.equal(computeSpatialAttenuation(3, 3, 15), 1);
  const mid = computeSpatialAttenuation(8, 3, 15);
  assert.ok(mid > 0.3 && mid < 0.7, `Mid gain should be conversational, got ${mid}`);
  const far = computeSpatialAttenuation(12, 3, 15);
  assert.ok(far > 0 && far < mid);
  assert.equal(computeSpatialAttenuation(15.5, 3, 15), 0);
});
