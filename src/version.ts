// 대외 공식 릴리즈 버전 (Semantic Versioning)
export const APP_RELEASE_VERSION = 'v1.1.0';

// 내부 개발 관리용 빌드 번호 (Build / Revision Number)
export const APP_BUILD_NUMBER = 'b00231';

// 통합 버전 문자열 (UI 하단 및 디버그용)
export const APP_VERSION = `${APP_RELEASE_VERSION} (${APP_BUILD_NUMBER})`;

// =========================================================================
// [기능 플래그 (Feature Flags)]
// =========================================================================
// 1차 출시 심사용 임시 비활성화 (토스 1차 심사 통과 후 v1.1.0에서 true로 오픈 예정)
export const ENABLE_FAMILY_SYNC = false;
