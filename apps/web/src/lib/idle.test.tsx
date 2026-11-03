import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIdleTimeout } from "./idle";

describe("useIdleTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const opts = (onTimeout: () => void) => ({
    timeoutMs: 10_000,
    warnMs: 3_000,
    onTimeout,
  });

  it("warns near the end, then times out once", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleTimeout(opts(onTimeout)));
    act(() => void vi.advanceTimersByTime(6_000));
    expect(result.current.secondsLeft).toBeNull();
    act(() => void vi.advanceTimersByTime(2_000));
    expect(result.current.secondsLeft).toBe(2);
    expect(onTimeout).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(5_000));
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("activity cancels the warning and restarts the clock", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleTimeout(opts(onTimeout)));
    act(() => void vi.advanceTimersByTime(8_000));
    expect(result.current.secondsLeft).not.toBeNull();
    act(() => void window.dispatchEvent(new Event("keydown")));
    expect(result.current.secondsLeft).toBeNull();
    act(() => void vi.advanceTimersByTime(8_000));
    expect(onTimeout).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(3_000));
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disabled", () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout({ ...opts(onTimeout), enabled: false }));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
