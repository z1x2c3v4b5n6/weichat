'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { CallSnapshot } from '@/services/call-service';

interface CallModalProps {
  snapshot: CallSnapshot;
}

export function CallModal({ snapshot }: CallModalProps): JSX.Element | null {
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const { state, localStream, remoteStream } = snapshot;

  useEffect(() => {
    if (localAudioRef.current && localStream) {
      localAudioRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const statusLabel = useMemo(() => {
    if (state.status === 'idle') {
      return null;
    }
    if (state.status === 'calling') {
      return `Calling ${state.partnerName ?? 'participant'}…`;
    }
    if (state.status === 'incoming') {
      return `${state.partnerName ?? 'Someone'} is calling…`;
    }
    if (state.status === 'connecting') {
      return 'Connecting audio…';
    }
    if (state.status === 'connected') {
      return `In call with ${state.partnerName ?? 'participant'}`;
    }
    return null;
  }, [state.partnerName, state.status]);

  if (!statusLabel && !state.error) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-lg flex-col rounded-xl border border-slate-700 bg-slate-900/95 p-4 text-sm text-slate-100 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            {statusLabel && <p className="font-medium text-slate-100">{statusLabel}</p>}
            {state.error && <p className="text-xs text-red-400">{state.error}</p>}
          </div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {state.isMuted ? 'Muted' : 'Live audio'}
          </div>
        </div>
        <audio ref={localAudioRef} autoPlay muted className="hidden" />
        <audio ref={remoteAudioRef} autoPlay className="hidden" />
      </div>
    </div>
  );
}
