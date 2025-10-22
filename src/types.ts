// Taipei City data structure (data.taipei)
export interface TaipeiTrashCollectionPoint {
  _id: number;
  _importdate: {
    date: string;
    timezone_type: number;
    timezone: string;
  };
  行政區: string; // District
  里別: string; // Village
  分隊: string; // Squad
  局編: string; // Bureau ID
  車號: string; // Vehicle Number
  路線: string; // Route
  車次: string; // Trip
  抵達時間: string; // Arrival Time (format: HHMM)
  離開時間: string; // Departure Time (format: HHMM)
  地點: string; // Location
  經度: string; // Longitude
  緯度: string; // Latitude
}

export interface TaipeiApiResponse {
  result: {
    limit: number;
    offset: number;
    count: number;
    sort: string;
    results: TaipeiTrashCollectionPoint[];
  };
}

// New Taipei City data structure (data.ntpc.gov.tw)
export interface NewTaipeiTrashCollectionPoint {
  city: string; // District
  lineid: string; // Line ID
  linename: string; // Line name
  rank: string; // Rank in route
  name: string; // Location name
  village: string; // Village
  longitude: string;
  latitude: string;
  time: string; // Time in HH:MM format
  memo: string;
  garbagesunday: string;
  garbagemonday: string;
  garbagetuesday: string;
  garbagewednesday: string;
  garbagethursday: string;
  garbagefriday: string;
  garbagesaturday: string;
  recyclingsunday: string;
  recyclingmonday: string;
  recyclingtuesday: string;
  recyclingwednesday: string;
  recyclingthursday: string;
  recyclingfriday: string;
  recyclingsaturday: string;
  foodscrapssunday: string;
  foodscrapsmonday: string;
  foodscrapstuesday: string;
  foodscrapswednesday: string;
  foodscrapsthursday: string;
  foodscrapsfriday: string;
  foodscrapssaturday: string;
}

// Unified data structure for the app
export interface UnifiedTrashCollectionPoint {
  id: string;
  city: string; // City (Taipei/New Taipei)
  district: string; // District/區
  village: string; // Village/里
  location: string; // Location name
  route: string; // Route/Line name
  arrivalTime: string; // Format: HHMM for internal use
  departureTime: string; // Format: HHMM for internal use
  longitude: string;
  latitude: string;
  source: 'taipei' | 'new-taipei';
}

// Legacy alias for backward compatibility
export type TrashCollectionPoint = TaipeiTrashCollectionPoint;
export type ApiResponse = TaipeiApiResponse;

// Route visualization types
export interface RouteInfo {
  routeId: string; // Unique route identifier
  routeName: string; // Display name
  city: string; // City name
  district: string; // District
  pointCount: number; // Number of stops
  points: UnifiedTrashCollectionPoint[]; // Ordered stops
  source: 'taipei' | 'new-taipei';
}
