/**
 * 클라이언트 사이드 이미지 압축 유틸리티
 * 
 * 모바일 카메라 고화질 원본(5~15MB)을 업로드 직전 브라우저 캔버스를 통해
 * 모바일 최적 해상도(최대 1024px) 및 JPEG(품질 0.8)로 자동 리사이징/압축합니다.
 * 
 * 효과:
 * - 파일 크기 약 90~95% 절감 (10MB -> 150~300KB)
 * - 모바일 업로드 체감 속도 대폭 향상 (수 초 -> 0.2초 내외)
 * - Supabase Storage 및 Egress(대역폭) 사용량 획기적 절약
 */

export const compressImage = async (
  file: File,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.8
): Promise<File> => {
  // 이미지가 아니거나 SVG 등 벡터 이미지인 경우 원본 유지
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }

  return new Promise((resolve) => {
    try {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // 원본이 이미 기준 해상도보다 작고 용량도 작은 경우(200KB 이하) 불필요한 압축 패스
        if (width <= maxWidth && height <= maxHeight && file.size <= 200 * 1024) {
          resolve(file);
          return;
        }

        // 종횡비(Aspect Ratio)를 유지하며 최대 해상도로 리사이징
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.warn('[ImageCompressor] Canvas 2D context unavailable, using original file');
          resolve(file);
          return;
        }

        // 캔버스에 리사이징된 이미지 렌더링
        ctx.drawImage(img, 0, 0, width, height);

        if (canvas.toBlob) {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                console.warn('[ImageCompressor] toBlob failed, using original file');
                resolve(file);
                return;
              }

              // 파일명 확장자를 .jpg로 정리
              const dotIndex = file.name.lastIndexOf('.');
              const nameWithoutExt = dotIndex !== -1 ? file.name.substring(0, dotIndex) : file.name;
              const compressedFile = new File([blob], `${nameWithoutExt}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });

              console.log(
                `[ImageCompressor] 압축 완료: ${(file.size / 1024).toFixed(1)}KB -> ${(compressedFile.size / 1024).toFixed(1)}KB (약 ${(100 - (compressedFile.size / file.size) * 100).toFixed(0)}% 절감)`
              );

              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        } else {
          // toBlob 미지원 환경 fallback
          try {
            const base64 = canvas.toDataURL('image/jpeg', quality);
            const byteString = atob(base64.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: 'image/jpeg' });
            const dotIndex = file.name.lastIndexOf('.');
            const nameWithoutExt = dotIndex !== -1 ? file.name.substring(0, dotIndex) : file.name;
            const compressedFile = new File([blob], `${nameWithoutExt}.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } catch (e) {
            console.warn('[ImageCompressor] fallback failed, using original file', e);
            resolve(file);
          }
        }
      };

      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        console.warn('[ImageCompressor] 이미지 로드 실패, 원본 파일 유지:', err);
        resolve(file);
      };

      img.src = objectUrl;
    } catch (err) {
      console.warn('[ImageCompressor] 압축 처리 중 예외 발생, 원본 파일 유지:', err);
      resolve(file);
    }
  });
};
