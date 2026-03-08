<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>FSMS Flight Replay</title>

  <link href="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css" rel="stylesheet" />

  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
    }

    #map {
      width: 100%;
      height: 100%;
    }

    .panel {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255,255,255,0.95);
      padding: 8px 12px;
      border-radius: 6px;
      z-index: 10;
      font-family: sans-serif;
    }

    #controls { bottom: 90px; }
    #slider-container { bottom: 20px; }
    #speed-container { bottom: 140px; }

    button { cursor: pointer; }
    input[type="range"] { width: 320px; }
  </style>
</head>
<body>

<div id="map"></div>

<div id="speed-container" class="panel">
  Speed:
  <select id="speedSelect">
    <option value="0.25">0.25×</option>
    <option value="0.5">0.5×</option>
    <option value="1" selected>1×</option>
    <option value="2">2×</option>
    <option value="5">5×</option>
    <option value="10">10×</option>
  </select>
</div>

<div id="controls" class="panel">
  <button id="playPause">Pause</button>
</div>

<div id="slider-container" class="panel">
  <input id="timeSlider" type="range" min="0" max="1000" value="0" />
</div>

<script src="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js"></script>

<script>
(async () => {

  // --------------------------------
  // Load replay data
  // --------------------------------
  const FLIGHT_ID = '9d90a57a-abfc-4a31-87ea-bd0d4a31dc82';
  const res = await fetch(`http://127.0.0.1:5000/api/fsms/replay/${FLIGHT_ID}`);
  const data = await res.json();

  const points = data.replay.map(p => ({
    lng: p.lon,
    lat: p.lat,
    time: new Date(p.timestamp),
    altitude: p.altitude_m
  }));

  // --------------------------------
  // Map setup
  // --------------------------------
  const map = new maplibregl.Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json',
    center: [points[0].lng, points[0].lat],
    zoom: 14
  });

  map.addControl(new maplibregl.NavigationControl());

  map.on('load', () => {
    map.addSource('flight-path', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: points.map(p => [p.lng, p.lat])
        }
      }
    });

    map.addLayer({
      id: 'flight-path-layer',
      type: 'line',
      source: 'flight-path',
      paint: {
        'line-color': '#ff0000',
        'line-width': 4
      }
    });
  });

  // --------------------------------
  // Marker + popup
  // --------------------------------
  const marker = new maplibregl.Marker({ color: '#007bff' })
    .setLngLat([points[0].lng, points[0].lat])
    .addTo(map);

  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 25
  }).addTo(map);

  // --------------------------------
  // Controls
  // --------------------------------
  const slider = document.getElementById('timeSlider');
  const playPauseBtn = document.getElementById('playPause');
  const speedSelect = document.getElementById('speedSelect');

  let currentIndex = 0;
  let isPlaying = true;
  let speed = 1;

  let followCamera = true;
  let lastCameraUpdate = 0;

  let playbackStartWallTime = null;
  let playbackStartFlightTime = null;

  // --------------------------------
  // Camera follow
  // --------------------------------
  function updateCamera(lng, lat, now) {
    if (!followCamera) return;
    if (now - lastCameraUpdate < 200) return;

    lastCameraUpdate = now;

    map.easeTo({
      center: [lng, lat],
      duration: 500,
      easing: t => t,
      essential: true
    });
  }

  // --------------------------------
  // Animation loop
  // --------------------------------
  function animate(now) {

    if (!playbackStartWallTime) {
      playbackStartWallTime = now;
      playbackStartFlightTime = points[currentIndex].time.getTime();
    }

    if (isPlaying) {
      const elapsed = (now - playbackStartWallTime) * speed;
      const targetTime = playbackStartFlightTime + elapsed;

      while (
        currentIndex < points.length - 2 &&
        points[currentIndex + 1].time.getTime() <= targetTime
      ) {
        currentIndex++;
      }

      const p1 = points[currentIndex];
      const p2 = points[currentIndex + 1];

      if (p2) {
        const t1 = p1.time.getTime();
        const t2 = p2.time.getTime();
        const progress = Math.min(
          Math.max((targetTime - t1) / (t2 - t1), 0),
          1
        );

        const lng = p1.lng + (p2.lng - p1.lng) * progress;
        const lat = p1.lat + (p2.lat - p1.lat) * progress;
        const alt =
          p1.altitude != null && p2.altitude != null
            ? p1.altitude + (p2.altitude - p1.altitude) * progress
            : null;

        marker.setLngLat([lng, lat]);
        updateCamera(lng, lat, now);

        popup
          .setLngLat([lng, lat])
          .setHTML(
            `<b>Time:</b> ${new Date(targetTime).toLocaleString()}<br>
             <b>Altitude:</b> ${alt?.toFixed(1) ?? '-'} m`
          );

        // Smooth slider (time-based)
        slider.value = Math.min(
          1000,
          ((currentIndex + progress) / (points.length - 1)) * 1000
        );
      }

      // Loop playback
      if (currentIndex >= points.length - 2) {
        currentIndex = 0;
        playbackStartWallTime = now;
        playbackStartFlightTime = points[0].time.getTime();
      }
    } else {
      playbackStartWallTime = now;
      playbackStartFlightTime = points[currentIndex].time.getTime();
    }

    requestAnimationFrame(animate);
  }

  // --------------------------------
  // Slider scrub
  // --------------------------------
  slider.addEventListener('input', () => {
    const t = Number(slider.value) / 1000;
    currentIndex = Math.floor(t * (points.length - 1));

    marker.setLngLat([points[currentIndex].lng, points[currentIndex].lat]);

    playbackStartWallTime = performance.now();
    playbackStartFlightTime = points[currentIndex].time.getTime();
  });

  // --------------------------------
  // Play / Pause
  // --------------------------------
  playPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playPauseBtn.textContent = isPlaying ? 'Pause' : 'Play';

    playbackStartWallTime = performance.now();
    playbackStartFlightTime = points[currentIndex].time.getTime();
  });

  // --------------------------------
  // Speed control
  // --------------------------------
  speedSelect.addEventListener('change', () => {
    speed = Number(speedSelect.value);
    playbackStartWallTime = performance.now();
    playbackStartFlightTime = points[currentIndex].time.getTime();
  });

  // ✅ START
  requestAnimationFrame(animate);

})();
</script>

</body>
</html>