import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'family-inventory', // 콘솔에 등록한 appName 식별자
  brand: {
    displayName: '아 찾았다 · 내 물건 찾기', // 콘솔에 등록한 앱 이름
    primaryColor: '#3182f6', // WhereIsIt의 대표 테마색 (토스 블루)
    icon: 'https://frpqupppuosfpdpjfbsk.supabase.co/storage/v1/object/public/item-images/brand/app-icon-v202.png', // Supabase Storage public icon URL (Tight Crop)
  },
  navigationBar: {
    withTitle: false,
    withBackButton: false,
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  permissions: [
    { name: 'photos', access: 'read' },
    { name: 'camera', access: 'access' },
  ],
  outdir: 'dist',
});
