/**
 * WhereIsIt 앱 초기 진입 및 공장 초기화 시 자동 생성되는 기본 공간 및 필수 수납처 데이터
 */

export interface InitialSeedStorage {
  name: string;
  icon: string;
  sections: { name: string }[];
}

export interface InitialSeedSpace {
  name: string;
  icon: string;
  storages?: InitialSeedStorage[];
}

export const DEFAULT_INITIAL_SPACES: InitialSeedSpace[] = [
  {
    name: '거실',
    icon: '/src/assets/icons/spaces/Living Room Office L.png',
  },
  {
    name: '주방',
    icon: '/src/assets/icons/spaces/Kitchen Room.png',
    storages: [
      {
        name: '냉장고',
        icon: '❄️',
        sections: [
          { name: '냉장실' },
          { name: '냉동실' },
        ],
      },
    ],
  },
  {
    name: '안방',
    icon: '/src/assets/icons/spaces/Double Bed.png',
    storages: [
      {
        name: '옷장',
        icon: '/src/assets/icons/storages/wardrobe.png',
        sections: [
          { name: '옷걸이 칸' },
          { name: '서랍 칸' },
        ],
      },
    ],
  },
  {
    name: '서재',
    icon: '/src/assets/icons/spaces/Office Office L.png',
  },
  {
    name: '욕실',
    icon: '/src/assets/icons/spaces/Bathtub.png',
    storages: [
      {
        name: '욕실 수납장',
        icon: '/src/assets/icons/storages/cabinet.png',
        sections: [
          { name: '상단 선반' },
          { name: '하단 선반' },
        ],
      },
    ],
  },
  {
    name: '안방욕실',
    icon: '/src/assets/icons/spaces/Bathtub.png',
  },
];
