using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

static class PrintNewsStudioLauncher
{
    private const int StartPort = 4862;
    private const int EndPort = 4962;
    private const string AppMarker = "\"app\":\"PrintNewsStudio\"";

    [STAThread]
    static void Main()
    {
        string appDir = AppDomain.CurrentDomain.BaseDirectory;
        string nodePath = Path.Combine(appDir, "runtime", "node.exe");
        string serverPath = Path.Combine(appDir, "server.js");
        string indexPath = Path.Combine(appDir, "public", "index.html");
        string expectedVersion = ReadExpectedVersion(appDir);
        int port = FindReadyServerPort(expectedVersion);

        if (port == 0)
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

            if (!File.Exists(indexPath))
            {
                MessageBox.Show("The app files are missing. Please extract the whole portable folder again, not only PrintNewsStudio.exe.", "Print News Studio");
                return;
            }

            port = FindOpenPort();
            if (port == 0)
            {
                MessageBox.Show("No open local port was found. Restart the computer, then open PrintNewsStudio.exe again.", "Print News Studio");
                return;
            }

            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = nodePath;
            startInfo.Arguments = "\"server.js\"";
            startInfo.WorkingDirectory = appDir;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            startInfo.WindowStyle = ProcessWindowStyle.Hidden;
            startInfo.EnvironmentVariables["PORT"] = port.ToString();
            Process.Start(startInfo);

            for (int attempt = 0; attempt < 20; attempt += 1)
            {
                if (ServerIsReady(port, expectedVersion)) break;
                Thread.Sleep(250);
            }

            if (!ServerIsReady(port, expectedVersion))
            {
                MessageBox.Show(
                    "Print News Studio could not start. Please restart the computer, extract the portable ZIP again, then open PrintNewsStudio.exe.",
                    "Print News Studio");
                return;
            }
        }

        ProcessStartInfo browser = new ProcessStartInfo();
        browser.FileName = "http://localhost:" + port + "/";
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

    private static int FindReadyServerPort(string expectedVersion)
    {
        for (int port = StartPort; port <= EndPort; port += 1)
        {
            if (ServerIsReady(port, expectedVersion)) return port;
        }
        return 0;
    }

    private static int FindOpenPort()
    {
        for (int port = StartPort; port <= EndPort; port += 1)
        {
            TcpListener listener = null;
            try
            {
                listener = new TcpListener(IPAddress.Loopback, port);
                listener.Start();
                return port;
            }
            catch
            {
                // Keep looking for the next available local port.
            }
            finally
            {
                if (listener != null) listener.Stop();
            }
        }
        return 0;
    }

    private static bool ServerIsReady(int port, string expectedVersion)
    {
        try
        {
            WebRequest request = WebRequest.Create("http://localhost:" + port + "/api/version");
            request.Timeout = 500;
            using (WebResponse response = request.GetResponse())
            using (Stream stream = response.GetResponseStream())
            using (StreamReader reader = new StreamReader(stream))
            {
                string body = reader.ReadToEnd();
                if (!body.Replace(" ", "").Contains(AppMarker)) return false;
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
