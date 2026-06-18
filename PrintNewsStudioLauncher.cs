using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

static class PrintNewsStudioLauncher
{
    private const string Url = "http://localhost:4862/";
    private const string HealthUrl = "http://localhost:4862/api/version";

    [STAThread]
    static void Main()
    {
        string appDir = AppDomain.CurrentDomain.BaseDirectory;
        string nodePath = Path.Combine(appDir, "runtime", "node.exe");
        string serverPath = Path.Combine(appDir, "server.js");
        string expectedVersion = ReadExpectedVersion(appDir);

        if (!ServerIsReady(expectedVersion))
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
                if (ServerIsReady(expectedVersion)) break;
                Thread.Sleep(250);
            }

            if (!ServerIsReady(expectedVersion))
            {
                MessageBox.Show(
                    "Another older Print News Studio is still running. Close all Print News Studio windows, wait a few seconds, then open this app again.",
                    "Print News Studio");
                return;
            }
        }

        ProcessStartInfo browser = new ProcessStartInfo();
        browser.FileName = Url;
        browser.UseShellExecute = true;
        Process.Start(browser);
    }

    private static string ReadExpectedVersion(string appDir)
    {
        try
        {
            string packagePath = Path.Combine(appDir, "package.json");
            string text = File.ReadAllText(packagePath);
            Match match = Regex.Match(text, "\"version\"\\s*:\\s*\"([^\"]+)\"");
            return match.Success ? match.Groups[1].Value : "";
        }
        catch
        {
            return "";
        }
    }

    private static bool ServerIsReady(string expectedVersion)
    {
        try
        {
            WebRequest request = WebRequest.Create(HealthUrl);
            request.Timeout = 500;
            using (WebResponse response = request.GetResponse())
            using (Stream stream = response.GetResponseStream())
            using (StreamReader reader = new StreamReader(stream))
            {
                string body = reader.ReadToEnd();
                if (!body.Contains("\"version\"")) return false;
                if (String.IsNullOrEmpty(expectedVersion)) return true;
                return body.Contains(expectedVersion);
            }
        }
        catch
        {
            return false;
        }
    }
}
