import { HwmsCityAdapter } from './HwmsAdapter';

/**
 * Adapter for Yunlin County (雲林縣) trash collection data
 *
 * Data Source: 環境部 全國垃圾車清運路線查詢網 (hwms.moenv.gov.tw) + TGOS geocoding
 */
export class YunlinAdapter extends HwmsCityAdapter {
  readonly cityId = 'yunlin' as const;
  readonly displayName = '雲林縣';
  readonly dataUrl = '/yunlin-trash-collection-points.json';
  readonly bounds = {
    north: 23.866184,
    south: 23.460225,
    east: 120.733942,
    west: 119.996859,
  };
}
