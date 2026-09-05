import { LEAFLET_MARKER_RENDERER_SCRIPT } from '../src/lib/leafletMarkerRenderer';

type PinElement = {
  title: string;
  tagName: string;
  parentNode: Pane | null;
  readonly nextSibling: PinElement | null;
  readonly isConnected: boolean;
  removeAttribute: jest.Mock;
  focus: jest.Mock;
};
type Pane = {
  children: PinElement[];
  insertBefore: jest.Mock;
};

const setup = () => {
  const document: { activeElement: PinElement | null } = { activeElement: null };
  const pane: Pane = {
    children: [],
    insertBefore: jest.fn((element: PinElement, before: PinElement | null) => {
      const old = pane.children.indexOf(element);
      if (old >= 0) pane.children.splice(old, 1);
      const index = before ? pane.children.indexOf(before) : pane.children.length;
      pane.children.splice(index, 0, element);
      element.parentNode = pane;
      if (document.activeElement === element) document.activeElement = null;
    }),
  };
  const createMarker = jest.fn(
    (coordinates: number[], options: Record<string, unknown>) => {
      const handlers = new Map<string, (event: object) => void>();
      const element: PinElement = {
        title: String(options.title),
        tagName: 'DIV',
        parentNode: null,
        get nextSibling() {
          if (!this.parentNode) return null;
          return pane.children[pane.children.indexOf(this) + 1] ?? null;
        },
        get isConnected() {
          return this.parentNode !== null;
        },
        removeAttribute: jest.fn(() => { element.title = ''; }),
        focus: jest.fn(() => { document.activeElement = element; }),
      };
      const marker = {
        coordinates,
        options,
        element,
        handlers,
        on: jest.fn((name: string, callback: (event: object) => void) => {
          handlers.set(name, callback);
        }),
        off: jest.fn((name: string) => { handlers.delete(name); }),
        setLatLng: jest.fn((next: number[]) => { marker.coordinates = next; }),
        setIcon: jest.fn((icon: unknown) => { options.icon = icon; }),
        getElement: () => element,
      };
      return marker;
    },
  );
  type Marker = ReturnType<typeof createMarker>;
  const layer = {
    addLayer: jest.fn((marker: Marker) => pane.insertBefore(marker.element, null)),
    removeLayer: jest.fn((marker: Marker) => {
      pane.children.splice(pane.children.indexOf(marker.element), 1);
      marker.element.parentNode = null;
    }),
  };
  const icon = jest.fn((color: string) => ({ color }));
  const post = jest.fn();
  const stopPropagation = jest.fn();
  // Execute the exact source embedded into the WebView, with Leaflet's public
  // API boundary instrumented so unnecessary drawing work is observable.
  // eslint-disable-next-line no-new-func
  const render = new Function(
    'L', 'markerLayer', 'getMarkerIcon', 'post', 'document',
    `${LEAFLET_MARKER_RENDERER_SCRIPT}\nreturn renderMarkers;`,
  )({ marker: createMarker, DomEvent: { stopPropagation } }, layer, icon, post, document) as (data: unknown) => void;
  return { render, createMarker, layer, icon, pane, document, post, stopPropagation };
};

const point = (id: number) => ({
  id, lat: 22 + id / 100000, lng: 114, title: `Place ${id}`,
  color: id % 2 ? '#1e88e5' : '#9e9e9e',
});

test('an identical 1,000-point refresh preserves all pins and performs no Leaflet or DOM mutations', () => {
  const map = setup();
  const points = Array.from({ length: 1000 }, (_, index) => point(index + 1));
  map.render(points);
  const pins = map.createMarker.mock.results.map(result => result.value);
  expect(map.createMarker).toHaveBeenCalledTimes(1000);
  expect(map.icon).toHaveBeenCalledTimes(2);
  map.pane.insertBefore.mockClear();
  map.render(points.map(row => ({ ...row, description: 'A non-rendered field changed' })));
  expect(map.createMarker).toHaveBeenCalledTimes(1000);
  expect(map.layer.addLayer).toHaveBeenCalledTimes(1000);
  expect(map.layer.removeLayer).not.toHaveBeenCalled();
  expect(map.pane.insertBefore).not.toHaveBeenCalled();
  for (const pin of pins) {
    expect(pin.setIcon).not.toHaveBeenCalled();
    expect(pin.setLatLng).not.toHaveBeenCalled();
    expect(pin.on).toHaveBeenCalledTimes(1);
  }
});

test('coordinates, colour and translated titles update the same pin and its click target', () => {
  const map = setup();
  map.render([point(1), point(2)]);
  const first = map.createMarker.mock.results[0].value;
  const second = map.createMarker.mock.results[1].value;
  map.render([{ ...point(1), lat: 23, color: '#9e9e9e', title: 'English place' }, point(2)]);
  expect(map.createMarker).toHaveBeenCalledTimes(2);
  expect(first.coordinates).toEqual([23, 114]);
  expect(first.setLatLng).toHaveBeenCalledTimes(1);
  expect(first.setIcon).toHaveBeenCalledTimes(1);
  expect(first.options).toMatchObject({ title: 'English place', alt: 'English place' });
  expect(first.element.title).toBe('English place');
  expect(second.setIcon).not.toHaveBeenCalled();
  expect(second.setLatLng).not.toHaveBeenCalled();
  const event = {};
  first.handlers.get('click')!(event);
  expect(map.post).toHaveBeenCalledWith({ type: 'markerPress', id: 1 });
  expect(map.stopPropagation).toHaveBeenCalledWith(event);
  map.render([{ ...point(1), title: '' }, point(2)]);
  expect(first.element.title).toBe('');
});

test('only removed or invalid pins are detached, and re-adding a removed ID binds one fresh click handler', () => {
  const map = setup();
  map.render([point(1), point(2)]);
  const removed = map.createMarker.mock.results[0].value;
  map.render([{ ...point(1), lat: 'invalid' }, point(2), point(3)]);
  expect(map.layer.removeLayer).toHaveBeenCalledTimes(1);
  expect(map.layer.removeLayer).toHaveBeenCalledWith(removed);
  expect(removed.handlers.size).toBe(0);
  expect(map.createMarker).toHaveBeenCalledTimes(3);
  map.render([point(1), point(2), point(3)]);
  expect(map.createMarker).toHaveBeenCalledTimes(4);
  map.render([]);
  expect(map.pane.children).toHaveLength(0);
  map.render(null);
  expect(map.layer.removeLayer).toHaveBeenCalledTimes(4);
});

test('reordered overlapping pins retain the same DOM nodes, input order and keyboard focus', () => {
  const map = setup();
  map.render([point(1), point(2), point(3)]);
  const pins = map.createMarker.mock.results.map(result => result.value);
  map.document.activeElement = pins[2].element;
  map.render([point(3), point(1), point(2)]);
  expect(map.pane.children).toEqual([pins[2].element, pins[0].element, pins[1].element]);
  expect(map.document.activeElement).toBe(pins[2].element);
  expect(map.createMarker).toHaveBeenCalledTimes(3);
  expect(map.layer.removeLayer).not.toHaveBeenCalled();
});
