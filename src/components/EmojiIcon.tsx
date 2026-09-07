import React from 'react';
import { getCustomIconUrl, isImagePath, getDefaultCustomSpaceIconUrl } from '../utils/iconLoader';

interface EmojiIconProps {
  icon: string;
  size?: number;
  style?: React.CSSProperties;
}

export const EmojiIcon: React.FC<EmojiIconProps> = ({ icon, size = 24, style }) => {
  // 등록된 아이콘명/경로가 커스텀 파일 이미지인지 확인하고 실제 URL 로드
  let customUrl = getCustomIconUrl(icon);

  // 삭제되었거나 존재하지 않는 이미지 경로인 경우 기본 커스텀 아이콘으로 폴백
  if (!customUrl && isImagePath(icon)) {
    customUrl = getDefaultCustomSpaceIconUrl();
  }

  if (customUrl) {
    return (
      <img 
        src={customUrl} 
        alt="custom-icon" 
        style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          display: 'inline-block', 
          verticalAlign: 'middle',
          objectFit: 'contain',
          ...style 
        }} 
      />
    );
  }
  
  // 커스텀 이미지가 아니면 이모지 텍스트로 폴백 (경로 텍스트 노출 차단)
  const displayEmoji = isImagePath(icon) ? '🏠' : (icon || '🏠');

  return (
    <span 
      style={{ 
        fontSize: `${size}px`, 
        lineHeight: 1, 
        display: 'inline-block', 
        verticalAlign: 'middle',
        ...style 
      }}
    >
      {displayEmoji}
    </span>
  );
};

export default EmojiIcon;
