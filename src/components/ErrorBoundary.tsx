"use client";

import { Component, type ReactNode } from "react";

/** 描画中の例外で画面全体が落ちないようにする */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
