import React from 'react';
import potIcon from '../assets/icons/spaces/pot.svg';
import bedIcon from '../assets/icons/spaces/Bed Emoji.png';
import sofaIcon from '../assets/icons/spaces/Sofa Doodle.png';
import buffetIcon from '../assets/icons/storages/Buffet Windows 11 Color.png';
import closetIcon from '../assets/icons/storages/Closet Office M.png';

// 신규 추가 공간 아이콘
import bathtubIcon from '../assets/icons/spaces/Bathtub Emoji.png';
import bookshelfIcon from '../assets/icons/spaces/Book Shelf Color.png';
import boxIcon from '../assets/icons/spaces/Box Color Hand Drawn.png';
import kitchenIcon from '../assets/icons/spaces/Kitchen Room Office L.png';

interface EmojiIconProps {
  icon: string;
  size?: number;
  style?: React.CSSProperties;
}

export const EmojiIcon: React.FC<EmojiIconProps> = ({ icon, size = 24, style }) => {
  // 1단계 [공간] & 2단계 [수납처] 공용 및 개별 매칭
  if (icon === '🍳') {
    //🍳 -> 주방 전경 이미지 매핑
    return (
      <img 
        src={kitchenIcon} 
        alt="kitchen" 
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
  if (icon === '🍽️') {
    //🍽️ -> 요리용 냄비 벡터 SVG 매핑
    return (
      <img 
        src={potIcon} 
        alt="pot" 
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
  if (icon === '🛏️') {
    return (
      <img 
        src={bedIcon} 
        alt="bed" 
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
  if (icon === '🛋️') {
    return (
      <img 
        src={sofaIcon} 
        alt="sofa" 
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
  if (icon === '🛁') {
    return (
      <img 
        src={bathtubIcon} 
        alt="bathtub" 
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
  if (icon === '📚') {
    // 서재/책장 공용으로 고화질 Book Shelf Color 사용
    return (
      <img 
        src={bookshelfIcon} 
        alt="bookshelf" 
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
  if (icon === '📦') {
    return (
      <img 
        src={boxIcon} 
        alt="box" 
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

  // 2단계 [수납처] 전용 매퍼
  if (icon === '🗄️') {
    return (
      <img 
        src={buffetIcon} 
        alt="buffet" 
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
  if (icon === '👔') {
    return (
      <img 
        src={closetIcon} 
        alt="closet" 
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
