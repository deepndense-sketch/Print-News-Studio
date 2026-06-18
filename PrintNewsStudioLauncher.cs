using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

static class PrintNewsStudioLauncher
{
    private const string Url = "http://localhost:4862/";
    private const string HealthUrl = "http://localhost:4862/api/settings";

    [STAThread]
    static void Main()
    {
        string appDir = AppDomain.CurrentDomain.BaseDirectory;
        string nodePath = Path.Combine(appDir, "runtime", "node.exe");
        string serverPath = Path.Combine(appDir, "server.js");

        if (!ServerIsReady())
        {
            if (!File.Exists(nodePath))
            {
                MessageBox.Show("The bundled runtime is missing: runtime\\node.exe", "Print News Studio");
                return;
            }

            if (!File.Exists(serverPath))
            {
                MessageBox.Show("The app server file is missing: server.js", "Print News Studio");
                return;
            }

            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = nodePath;
            startInfo.Arguments = "\"server.js\"";
            startInfo.WorkingDirectory = appDir;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            startInfo.WindowStyle = ProcessWindowStyle.Hidden;
            Process.Start(startInfo);

            for (int attempt = 0; attempt < 20; attempt += 1)
            {
                if (ServerIsReady()) break;
                Thread.Sleep(250);
            }
        }

        ProcessStartInfo browser = new ProcessStartInfo();
        browser.FileName = Url;
        browser.UseShellExecute = true;
        Process.Start(browser);
    }

    private static bool ServerIsReady()
    {
        try
        {
            WebRequest request = WebRequest.Create(HealthUrl);
            request.Timeout = 500;
            using (request.GetResponse())
            {
                return true;
            }
        }
        catch
        {
            return false;
        }
    }
}
