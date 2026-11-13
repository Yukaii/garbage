import { HwmsCityAdapter } from './HwmsAdapter';

/**
 * Adapter for Changhua County (彰化縣) trash collection data
 *
 * Data Source: 環境部 全國垃圾車清運路線查詢網 (hwms.moenv.gov.tw) + TGOS geocoding
 */
export class ChanghuaAdapter extends HwmsCityAdapter {
  readonly cityId = 'changhua' as const;
  readonly displayName = '彰化縣';
  readonly dataUrl = '/changhua-trash-collection-points.json';
  readonly bounds = {
    north: 24.207196,
    south: 23.786046,
    east: 120.679044,
    west: 120.220402,
  };
}
