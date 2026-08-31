"use client";
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-zinc-100 font-sans selection:bg-red-500/20">
          <div className="max-w-md w-full premium-card p-8 border border-red-650 bg-zinc-900 rounded-3xl shadow-2xl text-center space-y-6 animate-fade-in relative overflow-hidden">
            {/* Ambient Red Glow */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-inner">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black uppercase tracking-wider text-white">System Exception</h2>
              <p className="text-xs text-zinc-400 font-medium">
                An unexpected runtime error occurred within the user interface application layer.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-left overflow-x-auto max-h-32 text-[10px] font-mono text-rose-400 scrollbar-thin">
                {this.state.error.toString()}
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={this.handleRetry}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-red-900/20 active:scale-[0.98]"
              >
                Reset UI Session & Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
