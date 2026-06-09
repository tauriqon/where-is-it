// src/utils/iconLoader.ts

// Vite의 glob import 기능을 이용해 assets 폴더 내의 모든 커스텀 이미지 파일들을 실시간으로 자동 로드합니다.
// 공간과 수납처 모두 단일 /src/assets/icons/ 폴더에서 불러오도록 통합하였습니다.
export const customIcons = import.meta.glob('/src/assets/icons/*.{png,jpg,jpeg,svg,gif,webp}', { eager: true });

// 이전 버전 호환성을 위해 객체를 그대로 유지합니다.
export const spaceCustomIcons = customIcons;
export const storageCustomIcons = customIcons;

/**
 * 아이콘 식별자(경로 또는 파일명)를 받아 Vite에 의해 번들링된 실제 이미지 URL을 반환합니다.
 * 매칭되는 커스텀 이미지가 없으면 null을 반환하여 이모지 폴백이 작동하도록 지원합니다.
 */
export const getCustomIconUrl = (iconPath: string): string | null => {
  if (!iconPath) return null;

  // 0. HTTP URL 또는 Base64 데이터 URL인 경우 그대로 반환
  if (iconPath.startsWith('http://') || iconPath.startsWith('https://') || iconPath.startsWith('data:image/')) {
    return iconPath;
  }

  // 1. 전체 매칭 경로 확인 (예: '/src/assets/icons/pot.svg')
  if (customIcons[iconPath]) {
    const mod = customIcons[iconPath] as any;
    return mod.default || mod;
  }

  // 1.1 이전 경로 하위호환 처리 (예: '/src/assets/icons/spaces/pot.svg' -> '/src/assets/icons/pot.svg')
  if (iconPath.includes('/spaces/') || iconPath.includes('/storages/')) {
    const filename = iconPath.split('/').pop();
    if (filename) {
      const unifiedPath = `/src/assets/icons/${filename}`;
      if (customIcons[unifiedPath]) {
        const mod = customIcons[unifiedPath] as any;
        return mod.default || mod;
      }
    }
  }

  // 2. 경로의 일부분이나 파일명 매칭 지원 (하위 호환성 및 간소화된 식별용)
  const filename = iconPath.split('/').pop();
  if (filename) {
    for (const [path, mod] of Object.entries(customIcons)) {
      if (path.endsWith(filename)) {
        return (mod as any).default || mod;
      }
    }
  }

  return null;
};
