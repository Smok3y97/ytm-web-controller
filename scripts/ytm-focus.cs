using System;
using System.Text;
using System.Runtime.InteropServices;

namespace YtmWebController {
    public static class Program {
        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool IsIconic(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool BringWindowToTop(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);

        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

        [DllImport("user32.dll")]
        private static extern bool AllowSetForegroundWindow(int dwProcessId);

        [DllImport("kernel32.dll")]
        private static extern uint GetCurrentThreadId();

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        private const int SW_RESTORE = 9;
        private const int SW_SHOW = 5;
        private const int ASFW_ANY = -1;
        private const byte VK_MENU = 0x12;
        private const uint KEYEVENTF_KEYUP = 0x0002;

        private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
        private static readonly IntPtr HWND_TOP = new IntPtr(0);

        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_NOMOVE = 0x0002;
        private const uint SWP_NOACTIVATE = 0x0010;
        private const uint SWP_NOSENDCHANGING = 0x0400;
        private const uint SWP_FLAGS = SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOSENDCHANGING;

        private static bool IsIgnoredApp(string title) {
            return title.IndexOf("GitHub Desktop", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   title.IndexOf("Visual Studio", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   title.IndexOf("Stream Deck", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   title.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        [STAThread]
        public static int Main(string[] args) {
            IntPtr targetHwnd = IntPtr.Zero;

            // 1. Search for YouTube Music
            EnumWindows((hWnd, lParam) => {
                if (!IsWindowVisible(hWnd)) return true;
                int length = GetWindowTextLength(hWnd);
                if (length == 0) return true;

                StringBuilder builder = new StringBuilder(length + 1);
                GetWindowText(hWnd, builder, builder.Capacity);
                string title = builder.ToString();

                if (IsIgnoredApp(title)) return true;

                if (title.IndexOf("YouTube Music", StringComparison.OrdinalIgnoreCase) >= 0) {
                    targetHwnd = hWnd;
                    return false;
                }

                return true;
            }, IntPtr.Zero);

            // 2. Fallback: Search for YouTube
            if (targetHwnd == IntPtr.Zero) {
                EnumWindows((hWnd, lParam) => {
                    if (!IsWindowVisible(hWnd)) return true;
                    int length = GetWindowTextLength(hWnd);
                    if (length == 0) return true;

                    StringBuilder builder = new StringBuilder(length + 1);
                    GetWindowText(hWnd, builder, builder.Capacity);
                    string title = builder.ToString();

                    if (IsIgnoredApp(title)) return true;

                    if (title.IndexOf("YouTube", StringComparison.OrdinalIgnoreCase) >= 0) {
                        targetHwnd = hWnd;
                        return false;
                    }

                    return true;
                }, IntPtr.Zero);
            }

            if (targetHwnd == IntPtr.Zero) return 1;

            IntPtr fgHwnd = GetForegroundWindow();
            uint curThread = GetCurrentThreadId();
            uint dummyPid1 = 0;
            uint dummyPid2 = 0;
            uint fgThread = fgHwnd != IntPtr.Zero ? GetWindowThreadProcessId(fgHwnd, out dummyPid1) : 0;
            uint targetThread = GetWindowThreadProcessId(targetHwnd, out dummyPid2);

            AllowSetForegroundWindow(ASFW_ANY);

            if (fgThread != 0 && fgThread != curThread) {
                AttachThreadInput(curThread, fgThread, true);
            }
            if (targetThread != 0 && targetThread != curThread) {
                AttachThreadInput(curThread, targetThread, true);
            }

            // Restore only if window is minimized (iconic); preserves custom/maximized size
            if (IsIconic(targetHwnd)) {
                ShowWindow(targetHwnd, SW_RESTORE);
            }

            SetWindowPos(targetHwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_FLAGS);
            SetWindowPos(targetHwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_FLAGS);
            SetWindowPos(targetHwnd, HWND_TOP, 0, 0, 0, 0, SWP_FLAGS);

            keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);
            keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

            SetForegroundWindow(targetHwnd);
            BringWindowToTop(targetHwnd);
            SwitchToThisWindow(targetHwnd, true);

            if (fgThread != 0 && fgThread != curThread) {
                AttachThreadInput(curThread, fgThread, false);
            }
            if (targetThread != 0 && targetThread != curThread) {
                AttachThreadInput(curThread, targetThread, false);
            }

            return 0;
        }
    }
}
