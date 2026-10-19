import type { City } from '../src/cities/cityRegistry';

// Stable, city-scoped ASCII URLs. Add a mapping before publishing a new district.
export const districtSlugs: Record<City, Record<string, string>> = {
  taipei: {
    中山區: 'zhongshan', 中正區: 'zhongzheng', 信義區: 'xinyi', 內湖區: 'neihu',
    北投區: 'beitou', 南港區: 'nangang', 士林區: 'shilin', 大同區: 'datong',
    大安區: 'da-an', 文山區: 'wenshan', 松山區: 'songshan', 萬華區: 'wanhua',
  },
  'new-taipei': {
    三峽區: 'sanxia', 三芝區: 'sanzhi', 三重區: 'sanchong', 中和區: 'zhonghe',
    五股區: 'wugu', 八里區: 'bali', 土城區: 'tucheng', 坪林區: 'pinglin',
    平溪區: 'pingxi', 新店區: 'xindian', 新莊區: 'xinzhuang', 板橋區: 'banqiao',
    林口區: 'linkou', 樹林區: 'shulin', 永和區: 'yonghe', 汐止區: 'xizhi',
    泰山區: 'taishan', 淡水區: 'tamsui', 深坑區: 'shenkeng', 烏來區: 'wulai',
    瑞芳區: 'ruifang', 石碇區: 'shiding', 石門區: 'shimen', 萬里區: 'wanli',
    蘆洲區: 'luzhou', 貢寮區: 'gongliao', 金山區: 'jinshan', 雙溪區: 'shuangxi',
    鶯歌區: 'yingge',
  },
  taichung: {
    中區: 'central', 北區: 'north', 北屯區: 'beitun', 南區: 'south', 南屯區: 'nantun',
    后里區: 'houli', 和平區: 'heping', 外埔區: 'waipu', 大安區: 'da-an', 大甲區: 'dajia',
    大肚區: 'dadu', 大里區: 'dali', 大雅區: 'daya', 太平區: 'taiping', 新社區: 'xinshe',
    東勢區: 'dongshi', 東區: 'east', 梧棲區: 'wuqi', 沙鹿區: 'shalu', 清水區: 'qingshui',
    潭子區: 'tanzi', 烏日區: 'wuri', 石岡區: 'shigang', 神岡區: 'shengang', 西區: 'west',
    西屯區: 'xitun', 豐原區: 'fengyuan', 霧峰區: 'wufeng', 龍井區: 'longjing',
  },
  kaohsiung: {
    三民區: 'sanmin', 仁武區: 'renwu', 內門區: 'neimen', 六龜區: 'liugui',
    前金區: 'qianjin', 前鎮區: 'qianzhen', 大寮區: 'daliao', 大樹區: 'dashu',
    大社區: 'dashe', 小港區: 'xiaogang', 岡山區: 'gangshan', 左營區: 'zuoying',
    彌陀區: 'mituo', 新興區: 'xinxing', 旗山區: 'qishan', 旗津區: 'qijin',
    杉林區: 'shanlin', 林園區: 'linyuan', 梓官區: 'ziguan', 楠梓區: 'nanzi',
    橋頭區: 'qiaotou', 永安區: 'yong-an', 湖內區: 'hunei', 燕巢區: 'yanchao',
    田寮區: 'tianliao', 甲仙區: 'jiaxian', 美濃區: 'meinong', 苓雅區: 'lingya',
    茄萣區: 'qieding', 路竹區: 'luzhu', 阿蓮區: 'alian', 鳥松區: 'niaosong',
    鳳山區: 'fengshan', 鹽埕區: 'yancheng', 鼓山區: 'gushan',
  },
};
