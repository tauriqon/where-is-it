// 대외 공식 릴리즈 버전 (Semantic Versioning)
export const APP_RELEASE_VERSION = 'v1.1.0';

// 내부 개발 관리용 빌드 번호 (Build / Revision Number)
export const APP_BUILD_NUMBER = 'b00271';

// 통합 버전 문자열 (UI 하단 및 디버그용)
export const APP_VERSION = `${APP_RELEASE_VERSION} (${APP_BUILD_NUMBER})`;

// =========================================================================
// [기능 플래그 (Feature Flags)]
// =========================================================================
// v1.1.0 가족 공유 및 워크스페이스 전환(Workspace Switching) 모델 정식 활성화
export const ENABLE_FAMILY_SYNC = true;
