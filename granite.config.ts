import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'family-inventory', // 콘솔에 등록한 appName 식별자
  brand: {
    displayName: '어디 뒀더라?', // 콘솔에 등록한 앱 이름
    primaryColor: '#3182f6', // WhereIsIt의 대표 테마색 (토스 블루)
    icon: '', // 콘솔 앱 정보에서 업로드한 이미지 링크 (필요 시 복사해서 입력 가능)
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});
