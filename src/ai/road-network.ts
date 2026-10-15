/**
 * Coimbatore arterial road network — the state space RIVA searches when it
 * routes offline.
 *
 * Nodes are landmarks and major junctions; edges are the road segments
 * between them, tagged with a road class. This is a deliberate abstraction
 * of the real network (about 35 nodes instead of tens of thousands of OSM
 * ways) with approximate coordinates, but it keeps the property that matters
 * for the search problem: there is a short-but-slow city route and a
 * longer-but-fast bypass route between the south-west (Amrita, Madukkarai)
 * and the north-east (airport, Neelambur), so the cheapest path depends on
 * the objective and on the hour of day.
 *
 * Edge cost model
 *   length  = haversine(a, b) × winding factor of the road class
 *   time    = length / free-flow speed × congestion(hour, class)
 *   A* heuristic (time)     = straight-line km / fastest free-flow speed
 *   A* heuristic (distance) = straight-line km
 * Both heuristics never exceed the true remaining cost (every edge is at
 * least as long as the straight line and no road is faster than the
 * highway free-flow speed), and both are consistent, so A* is optimal.
 */
import type { LatLng } from '../domain/types.js';
import { haversineDistanceKm } from '../services/sim.util.js';
import { search, type SearchProblem, type SearchResult, type SearchStrategy } from './search.js';

export type RoadClass = 'highway' | 'arterial' | 'local';
export type RouteObjective = 'time' | 'distance';

export interface RoadNode {
  id: string;
  name: string;
  coordinates: LatLng;
  /** Extra lowercase names the gazetteer and text matcher accept for this node. */
  aliases: string[];
}

export interface RoadEdge {
  from: string;
  to: string;
  roadClass: RoadClass;
  lengthKm: number;
}

const ROAD_CLASS: Record<RoadClass, { winding: number; freeFlowKmph: number; congestionSensitivity: number }> = {
  // NH544 / L&T bypass / Avinashi Road beyond the airport: fast, barely affected by city rush hour.
  highway: { winding: 1.1, freeFlowKmph: 55, congestionSensitivity: 0.35 },
  // Avinashi Road, Trichy Road, Mettupalayam Road, Sathy Road inside the city.
  arterial: { winding: 1.2, freeFlowKmph: 32, congestionSensitivity: 1.0 },
  // Connector streets.
  local: { winding: 1.25, freeFlowKmph: 24, congestionSensitivity: 0.8 },
};

const FASTEST_KMPH = Math.max(...Object.values(ROAD_CLASS).map((c) => c.freeFlowKmph));

const node = (id: string, name: string, lat: number, lng: number, aliases: string[] = []): RoadNode => ({
  id,
  name,
  coordinates: { lat, lng },
  aliases,
});

export const ROAD_NODES: RoadNode[] = [
  node('amrita', 'Amrita Vishwa Vidyapeetham, Ettimadai', 10.9046, 76.8993, ['amrita', 'amrita university', 'ettimadai', 'amrita university ettimadai']),
  node('madukkarai', 'Madukkarai', 10.904, 76.959),
  node('kuniyamuthur', 'Kuniyamuthur', 10.9622, 76.9536),
  node('kovaipudur', 'Kovaipudur', 10.9437, 76.9298),
  node('perur', 'Perur', 10.9754, 76.9139, ['perur temple']),
  node('ukkadam', 'Ukkadam', 10.988, 76.9617, ['ukkadam bus stand']),
  node('town_hall', 'Town Hall', 10.9946, 76.9614),
  node('coimbatore_junction', 'Coimbatore Junction', 10.9966, 76.9647, ['coimbatore railway station', 'railway station', 'coimbatore junction']),
  node('rs_puram', 'RS Puram', 11.0057, 76.9498, ['r s puram', 'r.s. puram']),
  node('race_course', 'Race Course', 11.0006, 76.9774),
  node('gandhipuram', 'Gandhipuram', 11.0177, 76.9674, ['gandhipuram bus stand']),
  node('saibaba_colony', 'Saibaba Colony', 11.0256, 76.9449),
  node('vadavalli', 'Vadavalli', 11.0245, 76.903),
  node('thudiyalur', 'Thudiyalur', 11.08, 76.944),
  node('ganapathy', 'Ganapathy', 11.04, 76.976),
  node('saravanampatti', 'Saravanampatti', 11.079, 77.0, ['prozone mall']),
  node('kalapatti', 'Kalapatti', 11.07, 77.035),
  node('lakshmi_mills', 'Lakshmi Mills', 11.0125, 76.988),
  node('peelamedu', 'Peelamedu', 11.0262, 77.0026, ['psg tech', 'psg college of technology']),
  node('hope_college', 'Hope College', 11.0275, 77.0183, ['peelamedu it corridor']),
  node('tidel_park', 'Tidel Park', 11.0318, 77.029, ['tidel park coimbatore']),
  node('airport', 'Coimbatore International Airport', 11.03, 77.0434, ['coimbatore airport', 'coimbatore international airport', 'cjb airport']),
  node('chinniyampalayam', 'Chinniyampalayam', 11.04, 77.058),
  node('neelambur', 'Neelambur', 11.056, 77.088),
  node('ramanathapuram', 'Ramanathapuram', 10.997, 76.999),
  node('singanallur', 'Singanallur', 10.999, 77.032, ['singanallur bus stand']),
  node('ondipudur', 'Ondipudur', 10.997, 77.058),
  node('chintamanipudur', 'Chintamanipudur', 10.996, 77.083),
  node('sundarapuram', 'Sundarapuram', 10.958, 76.972),
  node('podanur', 'Podanur', 10.962, 76.981, ['podanur junction']),
  node('malumichampatti', 'Malumichampatti', 10.906, 76.999),
  node('chettipalayam', 'Chettipalayam', 10.918, 77.033),
];

const SEGMENTS: Array<[string, string, RoadClass]> = [
  // NH544 Palakkad Road into the city
  ['amrita', 'madukkarai', 'highway'],
  ['madukkarai', 'kuniyamuthur', 'arterial'],
  ['kuniyamuthur', 'ukkadam', 'arterial'],
  // Western suburbs
  ['kuniyamuthur', 'kovaipudur', 'local'],
  ['kovaipudur', 'perur', 'local'],
  ['perur', 'ukkadam', 'arterial'],
  ['perur', 'vadavalli', 'local'],
  // City core
  ['ukkadam', 'town_hall', 'local'],
  ['town_hall', 'coimbatore_junction', 'local'],
  ['town_hall', 'rs_puram', 'local'],
  ['coimbatore_junction', 'gandhipuram', 'arterial'],
  ['coimbatore_junction', 'race_course', 'arterial'],
  ['rs_puram', 'gandhipuram', 'arterial'],
  ['rs_puram', 'saibaba_colony', 'local'],
  ['rs_puram', 'vadavalli', 'arterial'],
  ['saibaba_colony', 'vadavalli', 'arterial'],
  ['saibaba_colony', 'gandhipuram', 'arterial'],
  // Mettupalayam Road and Sathy Road (north)
  ['saibaba_colony', 'thudiyalur', 'arterial'],
  ['gandhipuram', 'ganapathy', 'arterial'],
  ['ganapathy', 'saravanampatti', 'arterial'],
  ['thudiyalur', 'saravanampatti', 'local'],
  ['ganapathy', 'peelamedu', 'local'],
  ['saravanampatti', 'kalapatti', 'arterial'],
  ['kalapatti', 'airport', 'arterial'],
  // Avinashi Road (east)
  ['gandhipuram', 'lakshmi_mills', 'arterial'],
  ['race_course', 'lakshmi_mills', 'arterial'],
  ['lakshmi_mills', 'peelamedu', 'arterial'],
  ['peelamedu', 'hope_college', 'arterial'],
  ['hope_college', 'airport', 'arterial'],
  ['hope_college', 'tidel_park', 'local'],
  ['tidel_park', 'kalapatti', 'local'],
  ['airport', 'chinniyampalayam', 'arterial'],
  ['chinniyampalayam', 'neelambur', 'highway'],
  // Trichy Road (south-east)
  ['race_course', 'ramanathapuram', 'arterial'],
  ['ramanathapuram', 'singanallur', 'arterial'],
  ['singanallur', 'ondipudur', 'arterial'],
  ['ondipudur', 'chintamanipudur', 'arterial'],
  ['singanallur', 'peelamedu', 'local'],
  ['singanallur', 'airport', 'local'],
  // Pollachi Road and Podanur (south)
  ['ukkadam', 'sundarapuram', 'arterial'],
  ['sundarapuram', 'podanur', 'local'],
  ['podanur', 'ramanathapuram', 'local'],
  ['sundarapuram', 'malumichampatti', 'arterial'],
  ['podanur', 'chettipalayam', 'local'],
  // L&T bypass: Madukkarai → Neelambur, skirting the city to the south and east
  ['madukkarai', 'malumichampatti', 'highway'],
  ['malumichampatti', 'chettipalayam', 'highway'],
  ['chettipalayam', 'chintamanipudur', 'highway'],
  ['chintamanipudur', 'neelambur', 'highway'],
];

const NODE_BY_ID = new Map(ROAD_NODES.map((n) => [n.id, n]));

export const ROAD_EDGES: RoadEdge[] = SEGMENTS.map(([from, to, roadClass]) => ({
  from,
  to,
  roadClass,
  lengthKm:
    Math.round(haversineDistanceKm(NODE_BY_ID.get(from)!.coordinates, NODE_BY_ID.get(to)!.coordinates) * ROAD_CLASS[roadClass].winding * 100) / 100,
}));

/** Undirected adjacency list built once at module load. */
const ADJACENCY = new Map<string, RoadEdge[]>(ROAD_NODES.map((n) => [n.id, []]));
for (const edge of ROAD_EDGES) {
  ADJACENCY.get(edge.from)!.push(edge);
  ADJACENCY.get(edge.to)!.push({ ...edge, from: edge.to, to: edge.from });
}

/**
 * City-wide congestion factor by hour. Same rush-hour windows as
 * ForecastService.getTrafficMultiplier, so fares and travel times agree on
 * when the city is busy.
 */
export function congestionFactor(hour: number): number {
  if ((hour >= 8 && hour < 10) || (hour >= 18 && hour < 21)) return 1.6;
  if (hour >= 10 && hour < 18) return 1.25;
  if (hour >= 21 || hour < 1) return 1.1;
  return 1.0;
}

export function edgeMinutes(edge: RoadEdge, hour: number): number {
  const cls = ROAD_CLASS[edge.roadClass];
  const slowdown = 1 + (congestionFactor(hour) - 1) * cls.congestionSensitivity;
  return (edge.lengthKm / cls.freeFlowKmph) * 60 * slowdown;
}

export function getNode(id: string): RoadNode | undefined {
  return NODE_BY_ID.get(id);
}

/** Matches free text against node names and aliases, longest match first. */
export function findNodeByText(query: string): RoadNode | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const candidates = ROAD_NODES.flatMap((n) => [n.name.toLowerCase(), ...n.aliases].map((label) => ({ n, label })));
  candidates.sort((a, b) => b.label.length - a.label.length);
  return candidates.find(({ label }) => q.includes(label) || (q.length >= 4 && label.includes(q)))?.n ?? null;
}

/** Nearest graph node to a coordinate, or null when the point is too far from the network to snap. */
export function nearestNode(point: LatLng, maxSnapKm = 2.5): { node: RoadNode; distanceKm: number } | null {
  let best: { node: RoadNode; distanceKm: number } | null = null;
  for (const n of ROAD_NODES) {
    const d = haversineDistanceKm(point, n.coordinates);
    if (!best || d < best.distanceKm) best = { node: n, distanceKm: d };
  }
  return best && best.distanceKm <= maxSnapKm ? best : null;
}

export function routeProblem(fromId: string, toId: string, objective: RouteObjective, hour: number): SearchProblem<string> {
  const goal = NODE_BY_ID.get(toId)!.coordinates;
  return {
    initial: fromId,
    isGoal: (id) => id === toId,
    key: (id) => id,
    successors: (id) =>
      ADJACENCY.get(id)!.map((edge) => ({
        state: edge.to,
        cost: objective === 'time' ? edgeMinutes(edge, hour) : edge.lengthKm,
      })),
    heuristic: (id) => {
      const straightKm = haversineDistanceKm(NODE_BY_ID.get(id)!.coordinates, goal);
      return objective === 'time' ? (straightKm / FASTEST_KMPH) * 60 : straightKm;
    },
  };
}

export interface GraphRoute {
  strategy: SearchStrategy;
  objective: RouteObjective;
  found: boolean;
  nodeIds: string[];
  via: string[];
  distanceKm: number;
  durationMinutes: number;
  /** [lng, lat] pairs, same convention as Geoapify route geometry. */
  polyline: Array<[number, number]>;
  search: Omit<SearchResult<string>, 'path'>;
}

export function findRoute(
  fromId: string,
  toId: string,
  options: { strategy?: SearchStrategy; objective?: RouteObjective; hour?: number } = {}
): GraphRoute {
  const strategy = options.strategy ?? 'astar';
  const objective = options.objective ?? 'time';
  const hour = options.hour ?? new Date().getHours();

  const result = search(routeProblem(fromId, toId, objective, hour), strategy);
  const { path, ...stats } = result;

  let distanceKm = 0;
  let durationMinutes = 0;
  for (let i = 1; i < path.length; i++) {
    const edge = ADJACENCY.get(path[i - 1])!.find((e) => e.to === path[i])!;
    distanceKm += edge.lengthKm;
    durationMinutes += edgeMinutes(edge, hour);
  }

  return {
    strategy,
    objective,
    found: result.found,
    nodeIds: path,
    via: path.map((id) => NODE_BY_ID.get(id)!.name),
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMinutes: Math.round(durationMinutes),
    polyline: path.map((id) => {
      const c = NODE_BY_ID.get(id)!.coordinates;
      return [c.lng, c.lat];
    }),
    search: stats,
  };
}
