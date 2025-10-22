export interface TrashCollectionPoint {
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

export interface ApiResponse {
  result: {
    limit: number;
    offset: number;
    count: number;
    sort: string;
    results: TrashCollectionPoint[];
  };
}
