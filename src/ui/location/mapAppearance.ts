import { sys } from '../system/tokens';

/**
 * USKOČI's public map palette, applied only to known Positron layers of the expected type.
 * No source, geometry, width, filter, label expression or zoom range is changed. Unknown provider layers retain
 * their own appearance. Keeping this separate from label localisation makes both transformations independently
 * reviewable; a network/style failure still uses the original public style.
 */
const m = sys.map;
const colors: Record<string, { type: string; paint: Record<string, string> }> = {};
function group(type: string, ids: readonly string[], paint: Record<string, string>) {
  for (const id of ids) colors[id] = { type, paint };
}
group('background', ['background'], { 'background-color': m.ground });
group('fill', ['park'], { 'fill-color': m.park });
group('fill', ['landcover_wood'], { 'fill-color': m.woodland });
group('fill', ['landuse_residential'], { 'fill-color': m.residential });
group('fill', ['water'], { 'fill-color': m.water });
group('fill', ['building'], { 'fill-color': m.building, 'fill-outline-color': m.buildingEdge });
group('fill', ['road_area_pier', 'aeroway-area'], { 'fill-color': m.road });
group('line', ['waterway'], { 'line-color': m.waterLine });
group('line', ['highway_path'], { 'line-color': m.path });
group('line', ['highway_minor', 'road_pier', 'aeroway-runway'], { 'line-color': m.road });
// Main streets carry a light warm tint with a firmer edge, so a person can follow them on a small chat map.
group('line', ['highway_major_inner', 'highway_motorway_inner', 'highway_motorway_bridge_inner'], { 'line-color': m.roadMajor });
group('line', ['highway_major_casing', 'highway_motorway_casing', 'highway_motorway_bridge_casing'], { 'line-color': m.roadMajorEdge });
group('line', ['highway_major_subtle', 'highway_motorway_subtle', 'aeroway-runway-casing',
  'aeroway-taxiway'], { 'line-color': m.roadEdge });
group('line', ['railway', 'railway_transit', 'railway_service'], { 'line-color': m.transit });
group('line', ['boundary_2', 'boundary_3', 'boundary_disputed'], { 'line-color': m.boundary });
group('symbol', ['waterway_line_label', 'water_name_point_label', 'water_name_line_label'],
  { 'text-color': m.waterLabel });
group('symbol', ['highway-name-path', 'highway-name-minor', 'highway-name-major'],
  { 'text-color': m.roadLabel, 'text-halo-color': m.ground });
group('symbol', ['label_other', 'label_village', 'label_town', 'label_state', 'label_city',
  'label_city_capital', 'label_country_3', 'label_country_2', 'label_country_1'],
  { 'text-color': m.label, 'text-halo-color': m.ground });

export function uskociMapColors<S extends { layers?: unknown }>(style: S): S {
  if (!Array.isArray(style.layers)) return style;
  return { ...style, layers: style.layers.map((layer: unknown) => {
    if (!layer || typeof layer !== 'object') return layer;
    const value = layer as { id?: unknown; type?: unknown; paint?: Record<string, unknown> };
    const color = typeof value.id === 'string' && Object.hasOwn(colors, value.id) ? colors[value.id] : undefined;
    return color && value.type === color.type ? { ...layer, paint: { ...value.paint, ...color.paint } } : layer;
  }) };
}
