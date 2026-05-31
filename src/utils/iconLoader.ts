// src/utils/iconLoader.ts

// Vite의 glob import 기능을 이용해 assets 폴더 내의 모든 커스텀 이미지 파일들을 실시간으로 자동 로드합니다.
// 이렇게 하면 새로운 이미지를 폴더에 추가하고 커밋하는 즉시 코드 수정 없이 앱에 자동 반영됩니다.
export const spaceCustomIcons = import.meta.glob('/src/assets/icons/spaces/*.{png,jpg,jpeg,svg,gif,webp}', { eager: true });
export const storageCustomIcons = import.meta.glob('/src/assets/icons/storages/*.{png,jpg,jpeg,svg,gif,webp}', { eager: true });

/**
 * 아이콘 식별자(경로 또는 파일명)를 받아 Vite에 의해 번들링된 실제 이미지 URL을 반환합니다.
 * 매칭되는 커스텀 이미지가 없으면 null을 반환하여 이모지 폴백이 작동하도록 지원합니다.
 */
export const getCustomIconUrl = (iconPath: string): string | null => {
  if (!iconPath) return null;

  // 1. 전체 매칭 경로 확인 (예: '/src/assets/icons/spaces/pot.svg')
  if (spaceCustomIcons[iconPath]) {
    const mod = spaceCustomIcons[iconPath] as any;
    return mod.default || mod;
  }
  if (storageCustomIcons[iconPath]) {
    const mod = storageCustomIcons[iconPath] as any;
    return mod.default || mod;
  }

  // 2. 경로의 일부분이나 파일명 매칭 지원 (하위 호환성 및 간소화된 식별용)
  const filename = iconPath.split('/').pop();
  if (filename) {
    for (const [path, mod] of Object.entries(spaceCustomIcons)) {
      if (path.endsWith(filename)) {
        return (mod as any).default || mod;
      }
    }
    for (const [path, mod] of Object.entries(storageCustomIcons)) {
      if (path.endsWith(filename)) {
        return (mod as any).default || mod;
      }
    }
  }

  return null;
};
