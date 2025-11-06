'use client';

import { useEffect, useRef } from 'react';

interface CallModalProps {
  visible: boolean;
  isCaller: boolean;
  partnerName: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onHangup: () => void;
}

export function CallModal({ visible, isCaller, partnerName, localStream, remoteStream, onHangup }: CallModalProps): JSX.Element | null {
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

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

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 p-6 text-slate-100 shadow-xl">
        <h2 className="text-xl font-semibold">Voice Call</h2>
        <p className="mt-2 text-sm text-slate-400">
          {isCaller ? 'Calling' : 'Incoming call from'} <span className="font-medium text-slate-100">{partnerName}</span>
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <audio ref={localAudioRef} autoPlay muted className="hidden" />
          <audio ref={remoteAudioRef} autoPlay className="hidden" />
          <button
            type="button"
            onClick={onHangup}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            Hang up
          </button>
        </div>
      </div>
    </div>
  );
}
