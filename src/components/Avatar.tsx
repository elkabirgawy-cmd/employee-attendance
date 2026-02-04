import { useState } from 'react';
import { User } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-8 h-8 text-xs',
  sm: 'w-10 h-10 text-sm',
  md: 'w-16 h-16 text-xl',
  lg: 'w-24 h-24 text-3xl',
  xl: 'w-32 h-32 text-4xl',
};

const iconSizes = {
  xs: 16,
  sm: 20,
  md: 32,
  lg: 48,
  xl: 64,
};

export default function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const showFallback = !src || imageError;

  return (
    <div
      className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 ${className}`}
    >
      {showFallback ? (
        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
          {name ? getInitials(name) : <User size={iconSizes[size]} />}
        </div>
      ) : (
        <>
          {imageLoading && (
            <div className="w-full h-full bg-slate-200 animate-pulse" />
          )}
          <img
            src={src}
            alt={name}
            className={`w-full h-full object-cover ${imageLoading ? 'hidden' : 'block'}`}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
          />
        </>
      )}
    </div>
  );
}
