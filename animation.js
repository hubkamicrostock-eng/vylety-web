// Route animation module
// Called by map.js after trip data is loaded

let animMap, animTrack, animPhotos;
let animLine, animMarker;
let animRunning = false, animPaused = false;
let animIndex = 0;
let animTimeout = null;

const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const progressBar = document.getElementById('progress-bar');
const speedSelect = document.getElementById('speed-select');

function initAnimation(map, track, photos) {
  animMap = map;
  animTrack = track;
  animPhotos = photos.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (!track.length) {
    btnPlay.disabled = true;
    return;
  }

  btnPlay.addEventListener('click', startAnimation);
  btnPause.addEventListener('click', togglePause);
  btnReset.addEventListener('click', resetAnimation);
}

function getSpeedMultiplier() {
  return parseFloat(speedSelect.value) || 10;
}

function startAnimation() {
  if (animRunning) return;
  resetAnimation();
  animRunning = true;
  animPaused = false;

  btnPlay.disabled = true;
  btnPause.disabled = false;
  btnReset.disabled = false;

  // Remove static route, draw animated one
  animLine = L.polyline([], { color: '#FF6F00', weight: 4, opacity: 0.9 }).addTo(animMap);

  // Moving dot marker
  const startCoord = [animTrack[0].lat, animTrack[0].lng];
  animMarker = L.circleMarker(startCoord, {
    radius: 8, color: '#fff', fillColor: '#FF6F00', fillOpacity: 1, weight: 2,
  }).addTo(animMap);

  animIndex = 0;
  animMap.flyTo(startCoord, 15, { duration: 1 });
  setTimeout(() => stepAnimation(), 1200);
}

function stepAnimation() {
  if (!animRunning || animPaused) return;
  if (animIndex >= animTrack.length) {
    finishAnimation();
    return;
  }

  const point = animTrack[animIndex];
  const coord = [point.lat, point.lng];

  animLine.addLatLng(coord);
  animMarker.setLatLng(coord);

  const progress = ((animIndex + 1) / animTrack.length) * 100;
  progressBar.style.width = `${progress}%`;

  // Check for nearby photo
  const photoAtPoint = findPhotoNear(point, animIndex);
  if (photoAtPoint) {
    showPhotoOverlay(photoAtPoint, () => {
      animIndex++;
      scheduleNext();
    });
    return;
  }

  animIndex++;
  scheduleNext();
}

function scheduleNext() {
  if (!animRunning || animPaused) return;

  const speedMult = getSpeedMultiplier();

  // Calculate real interval between this and next point
  if (animIndex < animTrack.length) {
    const prev = animTrack[animIndex - 1];
    const curr = animTrack[animIndex];
    const realMs = new Date(curr.timestamp) - new Date(prev.timestamp);
    const delay = Math.max(16, Math.min(realMs / speedMult, 500));
    animTimeout = setTimeout(stepAnimation, delay);
  } else {
    stepAnimation();
  }
}

function findPhotoNear(point, index) {
  const pointTime = new Date(point.timestamp).getTime();
  for (const photo of animPhotos) {
    const photoTime = new Date(photo.timestamp).getTime();
    // Photo is within 10 seconds of this track point
    if (Math.abs(photoTime - pointTime) < 10000) {
      if (!photo._shown) {
        photo._shown = true;
        return photo;
      }
    }
  }
  return null;
}

function showPhotoOverlay(photo, onDone) {
  animPaused = true;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:1500;background:rgba(0,0,0,0.75);
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
    animation:fadeIn 0.3s ease;
  `;
  overlay.innerHTML = `
    <style>@keyframes fadeIn{from{opacity:0}to{opacity:1}}</style>
    <img src="${photo.url}" style="max-width:80vw;max-height:65vh;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.5)" />
    <div style="color:#fff;font-size:1rem">📷 Foto ${photo.index} · ${new Date(photo.timestamp).toLocaleTimeString('cs-CZ')}</div>
    <div style="color:rgba(255,255,255,0.6);font-size:0.85rem">Pokračování za chvíli...</div>
  `;
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.remove();
    animPaused = false;
    onDone();
  }, 2500);
}

function togglePause() {
  if (!animRunning) return;
  animPaused = !animPaused;
  btnPause.textContent = animPaused ? '▶ Pokračovat' : '⏸ Pauza';
  if (!animPaused) scheduleNext();
}

function resetAnimation() {
  animRunning = false;
  animPaused = false;
  if (animTimeout) clearTimeout(animTimeout);
  if (animLine) { animLine.remove(); animLine = null; }
  if (animMarker) { animMarker.remove(); animMarker = null; }
  progressBar.style.width = '0%';
  btnPlay.disabled = false;
  btnPause.disabled = true;
  btnPause.textContent = '⏸ Pauza';
  btnReset.disabled = true;
  // Reset photo shown flags
  if (animPhotos) animPhotos.forEach(p => delete p._shown);
}

function finishAnimation() {
  animRunning = false;
  progressBar.style.width = '100%';
  btnPlay.disabled = false;
  btnPause.disabled = true;
  btnReset.disabled = false;
  if (animMarker) { animMarker.remove(); animMarker = null; }
}

window.initAnimation = initAnimation;
