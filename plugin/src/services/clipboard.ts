import { spawn } from 'node:child_process';
import process from 'node:process';

/**
 * Copies the provided text to the system clipboard across platforms.
 * 
 * @param text Text string to copy
 */
export function copyToClipboard(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let command: string;
    let args: string[] = [];

    if (process.platform === 'win32') {
      command = 'clip';
    } else if (process.platform === 'darwin') {
      command = 'pbcopy';
    } else {
      command = process.env.WAYLAND_DISPLAY ? 'wl-copy' : 'xclip';
      if (command === 'xclip') {
        args = ['-selection', 'clipboard'];
      }
    }

    let proc;
    try {
      proc = spawn(command, args);
    } catch (err) {
      return reject(err);
    }

    let hasError = false;

    proc.on('error', (err) => {
      hasError = true;
      reject(err);
    });

    proc.on('close', (code) => {
      if (hasError) return;
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Clipboard command '${command}' exited with code ${code}`));
      }
    });

    try {
      proc.stdin.write(text);
      proc.stdin.end();
    } catch (err) {
      hasError = true;
      reject(err);
    }
  });
}
