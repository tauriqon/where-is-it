// src/utils/iconLoader.ts

export const spaceCustomIcons = import.meta.glob('/src/assets/icons/spaces/*.{png,jpg,jpeg,svg,gif,webp}', { eager: true });
export const storageCustomIcons = import.meta.glob('/src/assets/icons/storages/*.{png,jpg,jpeg,svg,gif,webp}', { eager: true });
export const sectionCustomIcons = import.meta.glob('/src/assets/icons/sections/*.{png,jpg,jpeg,svg,gif,webp}', { eager: true });

export const customIcons = {
  ...spaceCustomIcons,
  ...storageCustomIcons,
  ...sectionCustomIcons
};

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
