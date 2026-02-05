import { useGameStore } from '../../stores/gameStore';
import { DeepScanIdentityCard } from './DeepScanIdentityCard';

export function PadlockCodeOverlay() {
    const showPadlockCode = useGameStore((state) => state.showPadlockCode);

    if (!showPadlockCode) return null;

    return <DeepScanIdentityCard />;
}
