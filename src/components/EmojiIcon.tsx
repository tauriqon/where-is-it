import React from 'react';
import potIcon from '../assets/icons/spaces/pot.svg';

interface EmojiIconProps {
  icon: string;
  size?: number;
  style?: React.CSSProperties;
}

export const EmojiIcon: React.FC<EmojiIconProps> = ({ icon, size = 24, style }) => {
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
