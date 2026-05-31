import React from 'react';
import { getCustomIconUrl } from '../utils/iconLoader';

interface EmojiIconProps {
  icon: string;
  size?: number;
  style?: React.CSSProperties;
}

export const EmojiIcon: React.FC<EmojiIconProps> = ({ icon, size = 24, style }) => {
  // 등록된 아이콘명/경로가 커스텀 파일 이미지인지 확인하고 실제 URL 로드
  const customUrl = getCustomIconUrl(icon);

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
  
  // 커스텀 이미지가 아니면 기존 이모지 텍스트로 폴백
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
      {icon}
    </span>
  );
};

export default EmojiIcon;
