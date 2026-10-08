import { useState, useRef, useEffect } from 'react';
import '@dotlottie/player-component';

const REMOTE_LOTTIE_URL = 'https://lottie.host/fb8f09a8-c4e7-48d8-910a-1c31c73e9246/YoIDBBY2RN.lottie';
const LOCAL_FALLBACK_URL = '/under-construction.lottie';

export default function MaintenanceAnimation({ className = '' }) {
  const [animationSrc, setAnimationSrc] = useState(REMOTE_LOTTIE_URL);
  const playerRef = useRef(null);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handleError = () => {
      if (animationSrc !== LOCAL_FALLBACK_URL) {
        setAnimationSrc(LOCAL_FALLBACK_URL);
      }
    };

    player.addEventListener('error', handleError);
    return () => {
      player.removeEventListener('error', handleError);
    };
  }, [animationSrc]);

  return (
    <div className={`relative w-52 h-52 sm:w-64 sm:h-64 mx-auto flex items-center justify-center ${className}`}>
      {/* Subtle ambient background glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/15 via-indigo-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

      <dotlottie-player
        ref={playerRef}
        src={animationSrc}
        background="transparent"
        speed="1"
        style={{ width: '100%', height: '100%' }}
        loop
        autoplay
      />
    </div>
  );
}
