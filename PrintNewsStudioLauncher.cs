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
    private const int ReadyScanEndPort = 4872;
    private const string AppMarker = "\"app\":\"PrintNewsStudio\"";

    [STAThread]
    static void Main()
    {
        string appDir = AppDomain.CurrentDomain.BaseDirectory;
        try
        {
            Run(appDir);
        }
        catch (Exception error)
        {
            WriteLog(appDir, "Launcher crashed: " + error.ToString());
            MessageBox.Show("Print News Studio launcher had an error. Please open data\\launcher.log and send that file for checking.", "Print News Studio");
        }
    }

    static void Run(string appDir)
    {
        string nodePath = Path.Combine(appDir, "runtime", "node.exe");
        string serverPath = Path.Combine(appDir, "server.js");
        string indexPath = Path.Combine(appDir, "public", "index.html");
        string expectedVersion = ReadExpectedVersion(appDir);
        int port = FindReadyServerPort(expectedVersion);
        WriteLog(appDir, "Launcher opened from " + appDir + ". Expected version " + expectedVersion + ".");
        WriteLog(appDir, "Existing ready server port: " + port + ".");

        if (port == 0)
        {
            WriteLog(appDir, "Checking portable files.");
            if (!File.Exists(nodePath))
            {
                WriteLog(appDir, "Missing runtime\\node.exe.");
                MessageBox.Show("The bundled runtime is missing: runtime\\node.exe", "Print News Studio");
                return;
            }

            if (!File.Exists(serverPath))
            {
                WriteLog(appDir, "Missing server.js.");
                MessageBox.Show("The app server file is missing: server.js", "Print News Studio");
                return;
            }

            if (!File.Exists(indexPath))
            {
                WriteLog(appDir, "Missing public\\index.html.");
                MessageBox.Show("The app files are missing. Please extract the whole portable folder again, not only PrintNewsStudio.exe.", "Print News Studio");
                return;
            }

            WriteLog(appDir, "Looking for an open port.");
            port = FindOpenPort();
            WriteLog(appDir, "Open port result: " + port + ".");
            if (port == 0)
            {
                WriteLog(appDir, "No open port found.");
                MessageBox.Show("No open local port was found. Restart the computer, then open PrintNewsStudio.exe again.", "Print News Studio");
                return;
            }

            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = nodePath;
            startInfo.Arguments = "\"server.js\" --port=" + port;
            startInfo.WorkingDirectory = appDir;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            startInfo.WindowStyle = ProcessWindowStyle.Hidden;
            Process serverProcess = null;
            try
            {
                WriteLog(appDir, "Starting server on port " + port + ".");
                serverProcess = Process.Start(startInfo);
            }
            catch (Exception error)
            {
                WriteLog(appDir, "Could not start node.exe: " + error.Message);
                MessageBox.Show("Print News Studio could not start the bundled runtime. Open data\\launcher.log for details.", "Print News Studio");
                return;
            }

            for (int attempt = 0; attempt < 60; attempt += 1)
            {
                if (ServerIsReady(port, expectedVersion)) break;
                if (serverProcess != null && serverProcess.HasExited)
                {
                    WriteLog(appDir, "Server closed early with exit code " + serverProcess.ExitCode + ".");
                    break;
                }
                Thread.Sleep(500);
            }

            if (!ServerIsReady(port, expectedVersion))
            {
                WriteLog(appDir, "Server did not become ready on port " + port + ".");
                MessageBox.Show(
                    "Print News Studio could not start. Please open data\\launcher.log and send that file for checking.",
                    "Print News Studio");
                return;
            }
        }

        ProcessStartInfo browser = new ProcessStartInfo();
        browser.FileName = "http://localhost:" + port + "/";
        browser.UseShellExecute = true;
        WriteLog(appDir, "Opening browser at " + browser.FileName + ".");
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
        for (int port = StartPort; port <= ReadyScanEndPort; port += 1)
        {
            if (!PortIsBusy(port)) continue;
            if (ServerIsReady(port, expectedVersion)) return port;
        }
        return 0;
    }

    private static int FindOpenPort()
    {
        for (int port = StartPort; port <= EndPort; port += 1)
        {
            if (PortIsBusy(port)) continue;
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

    private static bool PortIsBusy(int port)
    {
        return CanConnect("localhost", port) || CanConnect("127.0.0.1", port) || CanConnect("::1", port);
    }

    private static bool CanConnect(string host, int port)
    {
        TcpClient client = null;
        try
        {
            client = new TcpClient();
            IAsyncResult result = client.BeginConnect(host, port, null, null);
            if (!result.AsyncWaitHandle.WaitOne(150)) return false;
            client.EndConnect(result);
            return true;
        }
        catch
        {
            return false;
        }
        finally
        {
            if (client != null) client.Close();
        }
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

    private static void WriteLog(string appDir, string message)
    {
        try
        {
            string dataDir = Path.Combine(appDir, "data");
            Directory.CreateDirectory(dataDir);
            string line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + message + Environment.NewLine;
            File.AppendAllText(Path.Combine(dataDir, "launcher.log"), line);
        }
        catch
        {
            // Logging should never stop the app from opening.
        }
    }
}
