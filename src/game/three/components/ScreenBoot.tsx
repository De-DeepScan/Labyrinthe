import { useState, useEffect } from 'react';
import './ScreenBoot.css';

interface ScreenBootProps {
  /** Called when the full animation is complete */
  onComplete?: () => void;
  /** Total animation duration in ms (default: 2400) */
  duration?: number;
}

export default function ScreenBoot({ onComplete, duration = 2400 }: ScreenBootProps) {
  const [phase, setPhase] = useState<'line' | 'opening' | 'removed'>('line');

  useEffect(() => {
    const openTimer = setTimeout(() => {
      setPhase('opening');
    }, 1300);

    const removeTimer = setTimeout(() => {
      setPhase('removed');
      onComplete?.();
    }, duration);

    return () => {
      clearTimeout(openTimer);
      clearTimeout(removeTimer);
    };
  }, [duration, onComplete]);

  if (phase === 'removed') return null;

  return (
    <div className={`screen-boot ${phase === 'line' ? 'boot-solid' : ''}`}>
      {phase === 'line' && (
        <>
          <div className="boot-line" />
          <div className="boot-glow" />
          <div className="boot-halo" />
          <div className="boot-flare" />
        </>
      )}

      {phase === 'opening' && (
        <>
          <div className="boot-half boot-half-top" />
          <div className="boot-half boot-half-bottom" />
          <div className="boot-seam" />
        </>
      )}
    </div>
  );
}
