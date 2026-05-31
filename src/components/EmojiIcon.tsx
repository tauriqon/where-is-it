import React from 'react';
import potIcon from '../assets/icons/spaces/pot.svg';
import bedIcon from '../assets/icons/spaces/Bed Emoji.png';
import sofaIcon from '../assets/icons/spaces/Sofa Doodle.png';
import bookcaseIcon from '../assets/icons/storages/Bookcase Color Glass.png';
import buffetIcon from '../assets/icons/storages/Buffet Windows 11 Color.png';
import closetIcon from '../assets/icons/storages/Closet Office M.png';

interface EmojiIconProps {
  icon: string;
  size?: number;
  style?: React.CSSProperties;
}

export const EmojiIcon: React.FC<EmojiIconProps> = ({ icon, size = 24, style }) => {
  // 1단계 [공간]용 커스텀 아이콘 매퍼
  if (icon === '🍳') {
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

  // 2단계 [수납처]용 커스텀 아이콘 매퍼
  if (icon === '📚') {
    return (
      <img 
        src={bookcaseIcon} 
        alt="bookcase" 
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
