using System;
using System.Drawing;
using System.IO;
using System.Text;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Dayfolio
{
    internal static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetProcessDpiAwarenessContext(IntPtr value);

        [STAThread]
        private static void Main()
        {
            bool first;
            using (var instance = new Mutex(true, @"Local\Dayfolio.Desktop", out first))
            {
                if (!first)
                {
                    MessageBox.Show("序日已在运行，请切换到已有窗口。", "序日");
                    return;
                }
                SetProcessDpiAwarenessContext(new IntPtr(-4));
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new PlannerWindow());
            }
        }
    }

    internal sealed class PlannerWindow : Form
    {
        private readonly WebView2 view = new WebView2();
        private const string AppHost = "dayfolio.local";

        internal PlannerWindow()
        {
            Text = "序日 · 日程规划";
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(640, 480);
            ClientSize = new Size(1180, 780);
            view.Dock = DockStyle.Fill;
            Controls.Add(view);
            Shown += Initialize;
        }

        private async void Initialize(object sender, EventArgs args)
        {
            try
            {
                string assets = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ui");
                if (!File.Exists(Path.Combine(assets, "index.html")))
                    throw new FileNotFoundException("缺少界面文件，请完整解压桌面版压缩包。");
                string profile = Path.Combine(Environment.GetFolderPath(
                    Environment.SpecialFolder.LocalApplicationData), "Dayfolio", "WebView2");
                var environment = await CoreWebView2Environment.CreateAsync(null, profile);
                if (IsDisposed) return;
                await view.EnsureCoreWebView2Async(environment);
                if (IsDisposed) return;
                var core = view.CoreWebView2;
                core.SetVirtualHostNameToFolderMapping(AppHost, assets, CoreWebView2HostResourceAccessKind.Deny);
                core.NavigationStarting += (s, e) =>
                {
                    Uri uri;
                    e.Cancel = !Uri.TryCreate(e.Uri, UriKind.Absolute, out uri)
                        || uri.Scheme != "https" || uri.Host != AppHost;
                };
                core.NewWindowRequested += (s, e) => e.Handled = true;
                core.WebMessageReceived += (s, e) =>
                {
                    if (e.Source != "https://" + AppHost + "/index.html") return;
                    var json = e.TryGetWebMessageAsString();
                    BeginInvoke(new Action(() => ExportBackup(json)));
                };
                core.Navigate("https://" + AppHost + "/index.html");
            }
            catch (Exception ex)
            {
                if (IsDisposed) return;
                MessageBox.Show(this, "桌面版未能启动。请确认已安装 Microsoft Edge WebView2 运行时。\n\n" + ex.Message,
                    Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }

        private void ExportBackup(string json)
        {
            using (var dialog = new SaveFileDialog())
            {
                dialog.Title = "导出日程";
                dialog.Filter = "序日日程备份 (*.json)|*.json";
                dialog.FileName = "序日-" + DateTime.Today.ToString("yyyy-MM-dd") + ".json";
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                try
                {
                    File.WriteAllText(dialog.FileName, json, new UTF8Encoding(false));
                }
                catch (Exception ex)
                {
                    MessageBox.Show(this, ex.Message, "日程导出失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }
    }
}
