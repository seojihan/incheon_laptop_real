import { Component, ErrorInfo, ReactNode } from 'react';

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('[ui] unexpected render error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
            <h1 className="text-2xl font-black text-slate-900">화면을 표시하지 못했습니다</h1>
            <p className="text-sm text-slate-600 mt-4 leading-6">입력 중인 내용이 있다면 보존되지 않을 수 있습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-7 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">페이지 새로고침</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
