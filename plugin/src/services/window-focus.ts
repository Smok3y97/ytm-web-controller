/**
 * Window Focus Service
 * 
 * Reliably brings the YouTube Music Browser Tab or PWA Window to the foreground,
 * bypassing Windows ForegroundLockTimeout restrictions using the pre-compiled native
 * Win32 binary ytm-focus.exe (0ms compile latency, instant DWM Z-Order restacking).
 */

import { execFile, exec } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import streamDeck from '@elgato/streamdeck';

export class WindowFocusService {
  private static instance: WindowFocusService;
  private cachedExePath: string | null = null;

  public static getInstance(): WindowFocusService {
    if (!WindowFocusService.instance) {
      WindowFocusService.instance = new WindowFocusService();
    }
    return WindowFocusService.instance;
  }

  public bringToFront(): void {
    if (process.platform === 'win32') {
      this.bringToFrontWindows();
    } else if (process.platform === 'darwin') {
      this.bringToFrontMacOS();
    }
  }

  private bringToFrontWindows(): void {
    try {
      // 1. Resolve and cache native precompiled binary path
      if (this.cachedExePath === null) {
        const candidatePaths = [
          path.resolve(process.cwd(), 'bin', 'ytm-focus.exe'),
          path.resolve(process.cwd(), 'ytm-focus.exe'),
          path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'ytm-focus.exe'),
          path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'bin', 'ytm-focus.exe')
        ];

        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            this.cachedExePath = p;
            break;
          }
        }
        if (!this.cachedExePath) {
          this.cachedExePath = '';
        }
      }

      if (this.cachedExePath) {
        // Ultra-fast 2ms native execution
        execFile(this.cachedExePath, (err) => {
          if (err && err.code !== 0) {
            streamDeck.logger.debug(`[WindowFocus] ytm-focus.exe exited with code ${err.code}`);
          }
        });
        return;
      }

      // 2. Fallback to VB Interaction AppActivate
      const fallbackCmd = `powershell -NoProfile -NonInteractive -WindowStyle Hidden -Command "[void][System.Reflection.Assembly]::LoadWithPartialName('Microsoft.VisualBasic'); try { [Microsoft.VisualBasic.Interaction]::AppActivate('YouTube Music') } catch { try { [Microsoft.VisualBasic.Interaction]::AppActivate('YouTube') } catch {} }"`;
      exec(fallbackCmd, () => { });
    } catch (e) {
      streamDeck.logger.error(`[WindowFocus] Error bringing YouTube Music to front: ${e}`);
    }
  }

  private bringToFrontMacOS(): void {
    const osaScript = `
      tell application "System Events"
        set procList to every process whose name contains "YouTube Music" or name contains "Google Chrome" or name contains "Brave" or name contains "Edge"
        if (count of procList) > 0 then
          set frontmost of (item 1 of procList) to true
        end if
      end tell
    `;
    try {
      exec(`osascript -e '${osaScript}'`, () => { });
    } catch { }
  }
}
