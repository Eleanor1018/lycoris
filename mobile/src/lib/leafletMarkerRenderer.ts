// Runs inside the existing WebView, sharing its Leaflet, layer and bridge.
// Keep this as source text: stringifying a transpiled function can capture
// Metro/Hermes helpers that do not exist inside the WebView.
export const LEAFLET_MARKER_RENDERER_SCRIPT = `
var markerEntries = new Map();
var markerIcons = new Map();

function markerIcon(color) {
  if (!markerIcons.has(color)) markerIcons.set(color, getMarkerIcon(color));
  return markerIcons.get(color);
}

function renderMarkers(markers) {
  var nextIds = new Set();
  var orderedMarkers = [];
  if (!Array.isArray(markers)) markers = [];

  markers.forEach(function (m) {
    if (!m || typeof m !== 'object') return;
    var id = Number(m.id);
    var lat = Number(m.lat);
    var lng = Number(m.lng);
    if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    var color = typeof m.color === 'string' && m.color ? m.color : '#1e88e5';
    var title = typeof m.title === 'string' ? m.title : '';
    var entry = markerEntries.get(id);

    if (!entry) {
      var marker = L.marker([lat, lng], {
        icon: markerIcon(color), title: title, alt: title
      });
      var onClick = function (evt) {
        if (evt) L.DomEvent.stopPropagation(evt);
        post({ type: 'markerPress', id: id });
      };
      marker.on('click', onClick);
      markerLayer.addLayer(marker);
      entry = { marker: marker, onClick: onClick, lat: lat, lng: lng, color: color, title: title };
      markerEntries.set(id, entry);
    } else {
      if (entry.lat !== lat || entry.lng !== lng) {
        entry.marker.setLatLng([lat, lng]);
      }
      entry.marker.options.title = title;
      entry.marker.options.alt = title;
      if (entry.color !== color) entry.marker.setIcon(markerIcon(color));
      if (entry.title !== title || entry.color !== color) {
        var icon = entry.marker.getElement();
        if (icon) {
          if (title) icon.title = title;
          else icon.removeAttribute('title');
          if (icon.tagName === 'IMG') icon.alt = title;
        }
      }
      entry.lat = lat;
      entry.lng = lng;
      entry.color = color;
      entry.title = title;
    }
    if (!nextIds.has(id)) orderedMarkers.push(entry.marker);
    nextIds.add(id);
  });

  markerEntries.forEach(function (entry, id) {
    if (!nextIds.has(id)) {
      markerLayer.removeLayer(entry.marker);
      entry.marker.off('click', entry.onClick);
      markerEntries.delete(id);
    }
  });

  // Preserve the old input order for overlapping pins and keyboard traversal,
  // without touching DOM nodes already in the right position.
  var before = null;
  var focused = typeof document !== 'undefined' ? document.activeElement : null;
  for (var i = orderedMarkers.length - 1; i >= 0; i--) {
    var element = orderedMarkers[i].getElement();
    if (element && element.parentNode) {
      if (element.nextSibling !== before) element.parentNode.insertBefore(element, before);
      before = element;
    }
  }
  if (focused && focused.isConnected && document.activeElement !== focused) {
    focused.focus({ preventScroll: true });
  }
}
`;
