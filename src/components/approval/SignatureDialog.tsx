import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Eraser, LoaderCircle, PenLine, X } from 'lucide-react';

const EXPORT_WIDTH = 600;
const MAX_SIGNATURE_LENGTH = 200_000;

interface SignatureDialogProps {
  signerName: string;
  targetLabel: string;
  count: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (signature: string) => void;
}

export default function SignatureDialog({ signerName, targetLabel, count, busy, onCancel, onConfirm }: SignatureDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepareCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(scale, scale);
    context.lineWidth = 2.5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#1d2f24';
    setHasInk(false);
    setError(null);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    prepareCanvas();
  }, []);

  const pointFrom = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = pointFrom(event);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext('2d');
    const last = lastPointRef.current;
    if (!drawingRef.current || !context || !last) return;
    const point = pointFrom(event);
    context.beginPath();
    context.moveTo(last.x, last.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
    setHasInk(true);
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    const output = document.createElement('canvas');
    output.width = EXPORT_WIDTH;
    output.height = Math.round((canvas.height / canvas.width) * EXPORT_WIDTH);
    const context = output.getContext('2d');
    if (!context) {
      setError('서명 이미지를 만들지 못했습니다. 다시 시도해주세요.');
      return;
    }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(canvas, 0, 0, output.width, output.height);
    const signature = output.toDataURL('image/png');
    if (signature.length > MAX_SIGNATURE_LENGTH) {
      setError('서명이 너무 복잡합니다. 다시 쓰기를 누른 뒤 간단하게 서명해주세요.');
      return;
    }
    onConfirm(signature);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="signature-dialog-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/40"
    >
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800"><PenLine className="h-4 w-4" />승인 서명</p>
            <h2 id="signature-dialog-title" className="mt-3 text-2xl font-black text-slate-950">{count}건을 승인합니다</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{targetLabel}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="서명 창 닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>

        <canvas
          ref={canvasRef}
          aria-label="서명 입력 영역. 마우스나 터치로 서명하세요."
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="mt-5 block h-44 w-full cursor-crosshair touch-none rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50"
        />
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>서명자: <strong className="text-slate-700">{signerName}</strong></span>
          <button type="button" onClick={prepareCanvas} disabled={busy || !hasInk} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 font-black text-slate-600 hover:bg-slate-100 disabled:opacity-40"><Eraser className="h-4 w-4" />다시 쓰기</button>
        </div>

        {error && <p role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">취소</button>
          <button type="button" onClick={handleConfirm} disabled={busy || !hasInk} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{busy ? '처리 중...' : '서명하고 승인'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
