const SUPABASE_URL = 'https://krtntseehlbrxvoiwflp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtydG50c2VlaGxicnh2b2l3ZmxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjY4OTcsImV4cCI6MjA5MzM0Mjg5N30.kltSaq1zpsBEWmTeUh5bXYbxLEHS2e7NVqs85mU0UE8';
const WEB_BASE = 'https://hubkamicrostock-eng.github.io/vylety-web';

function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function cameraIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="background:#FF6F00;color:#fff;border-radius:50%;width:34px;height:34px;
      display:flex;align-items:center;justify-content:center;font-size:17px;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);border:2px solid #fff;cursor:pointer;">📷</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

function openLightbox(photo) {
  document.getElementById('lightbox-img').src = photo.url;
  document.getElementById('lightbox-caption').textContent =
    `Foto ${photo.index} · ${new Date(photo.timestamp).toLocaleString('cs-CZ')}`;
  document.getElementById('lightbox').classList.add('active');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
}

async function loadTrip(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/trips?id=eq.${id}&select=*,photos(*)`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data[0] || null;
}

function setupShare(tripId) {
  const link = `${WEB_BASE}/trip.html?id=${tripId}`;
  const embed = `<iframe src="${WEB_BASE}/trip.html?id=${tripId}&embed=1" width="800" height="500" style="border:none;border-radius:12px;" allowfullscreen></iframe>`;

  document.getElementById('share-link-input').value = link;
  document.getElementById('share-embed-input').value = embed;

  document.getElementById('btn-share').addEventListener('click', () => {
    document.getElementById('share-panel').classList.add('active');
  });
  document.getElementById('share-close').addEventListener('click', () => {
    document.getElementById('share-panel').classList.remove('active');
  });
  document.getElementById('share-panel').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });

  function setupCopyBtn(btnId, inputId, label) {
    const btn = document.getElementById(btnId);
    btn.addEventListener('click', async () => {
      const text = document.getElementById(inputId).value;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        document.getElementById(inputId).select();
        document.execCommand('copy');
      }
      btn.textContent = '✓ Zkopírováno';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = label; btn.classList.remove('copied'); }, 2000);
    });
  }
  setupCopyBtn('btn-copy-link', 'share-link-input', 'Kopírovat');
  setupCopyBtn('btn-copy-embed', 'share-embed-input', 'Kopírovat kód');
}

async function init() {
  const id = getParam('id');
  const isEmbed = getParam('embed') === '1';

  if (isEmbed) document.body.classList.add('embed');

  if (!id) {
    document.getElementById('map').innerHTML = '<p class="error-msg">Neplatný odkaz – chybí ID výletu.</p>';
    return;
  }

  const map = L.map('map');
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> © <a href="https://carto.com">CARTO</a>',
    maxZoom: 19,
  }).addTo(map);

  let trip;
  try {
    trip = await loadTrip(id);
  } catch (e) {
    document.getElementById('trip-title').textContent = 'Chyba načítání';
    return;
  }

  if (!trip) {
    document.getElementById('trip-title').textContent = 'Výlet nenalezen';
    return;
  }

  const name = trip.name || 'Výlet';
  document.title = name;
  document.getElementById('trip-title').textContent = name;

  // Stats
  document.getElementById('stat-dist').textContent = formatDistance(trip.distance_km);
  document.getElementById('stat-dur').textContent = formatDuration(trip.duration_seconds);
  document.getElementById('stat-speed').textContent = (trip.avg_speed_kmh || 0).toFixed(1);
  document.getElementById('stat-photos').textContent = (trip.photos || []).length;
  document.getElementById('stat-date').textContent = formatDate(trip.started_at);

  // Route
  const track = trip.track || [];
  if (track.length > 0) {
    const coords = track.map(p => [p.lat, p.lng]);
    const route = L.polyline(coords, { color: '#2E7D32', weight: 5, opacity: 0.85 }).addTo(map);
    map.fitBounds(route.getBounds(), { padding: [48, 48] });

    L.circleMarker(coords[0], {
      radius: 9, color: '#fff', fillColor: '#2E7D32', fillOpacity: 1, weight: 2,
    }).addTo(map).bindTooltip('Start');

    L.circleMarker(coords[coords.length - 1], {
      radius: 9, color: '#fff', fillColor: '#C62828', fillOpacity: 1, weight: 2,
    }).addTo(map).bindTooltip('Cíl');
  } else {
    map.setView([50.0755, 14.4378], 10);
  }

  // Photo markers + strip
  const photos = (trip.photos || []).sort((a, b) => a.index - b.index);
  const strip = document.getElementById('photo-strip');

  for (const photo of photos) {
    if (photo.lat && photo.lng) {
      L.marker([photo.lat, photo.lng], { icon: cameraIcon() })
        .addTo(map)
        .bindTooltip(`Foto ${photo.index}`)
        .on('click', () => openLightbox(photo));
    }

    if (photo.url) {
      const img = document.createElement('img');
      img.className = 'photo-thumb';
      img.src = photo.url;
      img.title = `Foto ${photo.index}`;
      img.loading = 'lazy';
      img.addEventListener('click', () => openLightbox(photo));
      strip.appendChild(img);
    }
  }

  // Share setup
  if (!isEmbed) setupShare(id);

  // Lightbox
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeLightbox();
  });
}

init();
