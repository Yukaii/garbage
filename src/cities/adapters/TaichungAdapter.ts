import { CityDataAdapter } from './BaseAdapter';
import type { UnifiedTrashCollectionPoint } from '../../types';

/**
 * Taichung City raw data structure
 * Source: datacenter.taichung.gov.tw
 */
export interface TaichungTrashVehicle {
  lineid: string;        // Line ID
  car: string;           // Vehicle plate number (e.g., "KED-1385")
  time: string;          // Timestamp: YYYYMMDDTHHMMSS (e.g., "20251023T221604")
  location: string;      // Location name in Chinese
  X: string;             // Longitude (as string)
  Y: string;             // Latitude (as string)
  SpeedValue: string;    // Speed value (as string)
  OverSpeed: string;     // "Y" or "N"
}

/**
 * Adapter for Taichung City (台中市) trash collection data
 *
 * Data Source: datacenter.taichung.gov.tw Open Data API
 * - Static pre-fetched JSON file (updated monthly via GitHub Actions)
 * - Direct array format
 * - Coordinates named X/Y instead of longitude/latitude
 * - Timestamp format: YYYYMMDDTHHMMSS
 * - Vehicle-centric data (GPS position snapshots)
 *
 * NOTE: This is fundamentally different from Taipei/New Taipei:
 * - Vehicle positions (not scheduled collection points)
 * - Each record is a vehicle's snapshot location
 * - "arrivalTime" and "departureTime" are derived from timestamp
 */
export class TaichungAdapter extends CityDataAdapter<TaichungTrashVehicle> {
  readonly cityId = 'taichung';
  readonly displayName = '台中市';
  readonly dataUrl = '/taichung-trash-collection-points.json';
  readonly dataType = 'static' as const;

  // Taichung city boundaries (approximate - extract from Taiwan TopoJSON if needed)
  readonly bounds = {
    north: 24.3647,
    south: 24.0097,
    east: 121.1427,
    west: 120.5608,
  };

  async fetchRawData(): Promise<TaichungTrashVehicle[]> {
    return this.fetchJson<TaichungTrashVehicle[]>(this.dataUrl);
  }

  mapToUnified(vehicle: TaichungTrashVehicle): UnifiedTrashCollectionPoint {
    // Parse timestamp: YYYYMMDDTHHMMSS -> extract time as HHMM
    const timestamp = vehicle.time;
    const timeStr = timestamp.split('T')[1]; // Get HHMMSS part
    const arrivalTime = timeStr.slice(0, 4); // HHMM

    // For real-time data, arrival and departure are the same (current position)
    const departureTime = arrivalTime;

    return {
      id: `taichung-${vehicle.car}-${timestamp}`,
      city: this.displayName,
      district: this.extractDistrictFromLocation(vehicle.location),
      village: '', // Not available in real-time data
      location: vehicle.location,
      route: vehicle.lineid,
      arrivalTime,
      departureTime,
      longitude: vehicle.X,
      latitude: vehicle.Y,
      source: 'taichung' as any, // Will need to update UnifiedTrashCollectionPoint type
    };
  }

  /**
   * Extract district name from location string
   * Taichung locations often contain district names like "龍井區..."
   */
  private extractDistrictFromLocation(location: string): string {
    const districtMatch = location.match(/^(.+?區)/);
    return districtMatch ? districtMatch[1] : '';
  }

  /**
   * Post-process: Remove duplicate vehicles (keep only latest position)
   */
  postprocessData(unified: UnifiedTrashCollectionPoint[]): UnifiedTrashCollectionPoint[] {
    // Group by vehicle (extract car number from id)
    const latestPositions = new Map<string, UnifiedTrashCollectionPoint>();

    for (const point of unified) {
      const vehicleId = point.id.split('-')[1]; // Extract "KED-1385" from "taichung-KED-1385-20251023T221604"

      // Keep only the latest timestamp for each vehicle
      const existing = latestPositions.get(vehicleId);
      if (!existing || point.id > existing.id) {
        latestPositions.set(vehicleId, point);
      }
    }

    return Array.from(latestPositions.values());
  }
}
