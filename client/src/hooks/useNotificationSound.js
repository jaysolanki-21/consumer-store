import { useRef, useState, useEffect, useCallback } from 'react';

export default function useNotificationSound() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(true);

  // Play notification sound
  const playNotification = useCallback(() => {
    if (!isUnlocked) {
      console.log('Audio not unlocked yet');
      return;
    }

    try {
      const audio = new Audio('/sounds/notification-bell.mp3');
      audio.volume = 0.7;
      audio.play()
        .then(() => console.log('✅ Sound played'))
        .catch(err => console.log('❌ Play failed:', err.name));
    } catch (err) {
      console.error('Error:', err);
    }
  }, [isUnlocked]);

  // Unlock audio
  const unlockAudio = useCallback(async () => {
    try {
      const audio = new Audio('/sounds/notification-bell.mp3');
      audio.volume = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      setIsUnlocked(true);
      setShowUnlockPrompt(false);
      console.log('✅ Audio unlocked!');
      
      // Test sound after unlock
      setTimeout(() => {
        const testAudio = new Audio('/sounds/notification-bell.mp3');
        testAudio.volume = 0.5;
        testAudio.play().catch(e => console.log('Test:', e));
      }, 100);
      
      return true;
    } catch (err) {
      console.log('Unlock failed:', err.name);
      return false;
    }
  }, []);

  return {
    playNotification,
    unlockAudio,
    isUnlocked,
    showUnlockPrompt,
    setShowUnlockPrompt,
  };
}