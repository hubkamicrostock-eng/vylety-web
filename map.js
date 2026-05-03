const SUPABASE_URL = 'https://krtntseehlbrxvoiwflp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtydG50c2VlaGxicnh2b2l3ZmxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjY4OTcsImV4cCI6MjA5MzM0Mjg5N30.kltSaq1zpsBEWmTeUh5bXYbxLEHS2e7NVqs85mU0UE8';

let map, tripData, routeLayer, photoMarkers = [];

function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function cameraIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:#FF6F00;color:#fff;border-radius:50%;
      width:32px;height:32px;display:flex;align-items:center;
      justify-content:center;font-size:16px;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
      border:2px solid #fff;
    ">📷</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function openLightbox(photo) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-img').src = photo.url;
  document.getElementById('lightbox-caption').textContent =
    `Foto ${photo.index} · ${new Date(photo.timestamp).toLocaleString('cs-CZ')}`;
  lb.classList.add('active');
}

document.getElementById('lightbox-close').addEventListener('click', () => {
  document.getElementById('lightbox').classList.remove('active');
});
document.getElementById('lightbox').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
});

async function loadTrip(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/trips?id=eq.${id}&select=*,photos(*)`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const data = await res.json();
  return data[0] || null;
}

async function init() {
  const id = getParam('id');
  if (!id) { document.getElementById('trip-title').textContent = 'Neplatný odkaz'; return; }

  map = L.map('map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  const trip = await loadTrip(id);
  if (!trip) { document.getElementById('trip-title').textContent = 'Výlet nenalezen'; return; }

  tripData = trip;
  document.title = trip.name || 'Výlet';
  document.getElementById('trip-title').textContent = trip.name || 'Výlet';

  // Stats
  document.getElementById('stat-dist').textContent = formatDistance(trip.distance_km);
  document.getElementById('stat-dur').textContent = formatDuration(trip.duration_seconds);
  document.getElementById('stat-speed').textContent = `${(trip.avg_speed_kmh || 0).toFixed(1)} km/h`;
  document.getElementById('stat-photos').textContent = `${(trip.photos || []).length} fotek`;
  document.getElementById('stat-date').textContent = formatDate(trip.started_at);

  // Route
  const track = trip.track || [];
  if (track.length > 0) {
    const coords = track.map(p => [p.lat, p.lng]);
    routeLayer = L.polyline(coords, { color: '#2E7D32', weight: 4, opacity: 0.8 }).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });

    // Start/end markers
    L.circleMarker(coords[0], { radius: 8, color: '#fff', fillColor: '#2E7D32', fillOpacity: 1, weight: 2 })
      .addTo(map).bindTooltip('Start');
    L.circleMarker(coords[coords.length - 1], { radius: 8, color: '#fff', fillColor: '#C62828', fillOpacity: 1, weight: 2 })
      .addTo(map).bindTooltip('Cíl');
  }

  // Photo markers
  for (const photo of trip.photos || []) {
    const marker = L.marker([photo.lat, photo.lng], { icon: cameraIcon() })
      .addTo(map)
      .bindTooltip(`Foto ${photo.index}`);
    marker.on('click', () => openLightbox(photo));
    photoMarkers.push({ marker, photo });
  }

  // Init animation module
  if (typeof initAnimation === 'function') {
    initAnimation(map, track, trip.photos || []);
  }
}

init();
