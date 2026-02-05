import { useState } from 'react';

type TransferLabResult = {
  kind: 'probe' | 'send' | 'download';
  ok: boolean;
  durationMs: number;
  details: string;
};

const createTimeoutController = (timeoutMs = 10_000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
};

export const useRealTransferLab = () => {
  const [endpoint, setEndpoint] = useState('http://192.168.1.10:8080');
  const [downloadUrl, setDownloadUrl] = useState('http://192.168.1.10:8080/sample.bin');
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<TransferLabResult | null>(null);

  const runProbe = async () => {
    setIsRunning(true);
    const started = Date.now();
    const timeout = createTimeoutController();

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json,text/plain,*/*' },
        signal: timeout.signal,
      });

      setLastResult({
        kind: 'probe',
        ok: response.ok,
        durationMs: Date.now() - started,
        details: `HTTP ${response.status} ${response.statusText}`,
      });
    } catch (error) {
      setLastResult({
        kind: 'probe',
        ok: false,
        durationMs: Date.now() - started,
        details: `Probe failed: ${String(error)}`,
      });
    } finally {
      timeout.clear();
      setIsRunning(false);
    }
  };

  const runSendPacket = async () => {
    setIsRunning(true);
    const started = Date.now();
    const timeout = createTimeoutController();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: 'CrossBeamApp',
          type: 'transfer-test-packet',
          sentAt: new Date().toISOString(),
          payload: 'Real LAN connectivity test from device',
        }),
        signal: timeout.signal,
      });

      setLastResult({
        kind: 'send',
        ok: response.ok,
        durationMs: Date.now() - started,
        details: `POST response HTTP ${response.status}`,
      });
    } catch (error) {
      setLastResult({
        kind: 'send',
        ok: false,
        durationMs: Date.now() - started,
        details: `Send failed: ${String(error)}`,
      });
    } finally {
      timeout.clear();
      setIsRunning(false);
    }
  };

  const runDownloadTest = async () => {
    setIsRunning(true);
    const started = Date.now();
    const timeout = createTimeoutController();

    try {
      const response = await fetch(downloadUrl, {
        method: 'GET',
        signal: timeout.signal,
      });

      const buffer = await response.arrayBuffer();

      setLastResult({
        kind: 'download',
        ok: response.ok,
        durationMs: Date.now() - started,
        details: `Downloaded ${(buffer.byteLength / (1024 * 1024)).toFixed(2)} MB`,
      });
    } catch (error) {
      setLastResult({
        kind: 'download',
        ok: false,
        durationMs: Date.now() - started,
        details: `Download failed: ${String(error)}`,
      });
    } finally {
      timeout.clear();
      setIsRunning(false);
    }
  };

  return {
    endpoint,
    setEndpoint,
    downloadUrl,
    setDownloadUrl,
    isRunning,
    lastResult,
    runProbe,
    runSendPacket,
    runDownloadTest,
  };
};
