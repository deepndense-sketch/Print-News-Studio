# Print News Studio

Local browser app for quick news export work. It accepts Excel-style news rows, keeps source logos, previews each news item, and exports PNG files or a ZIP.

## Start

For the portable release, unzip `PrintNewsStudio Portable.zip` and double-click:

```text
PrintNewsStudio.exe
```

For local development, double-click:

```text
Start Print News Studio.cmd
```

Or run manually:

```powershell
node server.js
```

Open:

```text
http://localhost:4862
```

## Main Workflow

1. Copy rows from Excel.
2. Paste into the Excel paste box.
3. Check generated news sections.
4. Paste missing source logos into the logo boxes.
5. Edit text directly. Bold text is also highlighted light yellow.
6. Choose the Location folder in Preview and export.
7. Render the PNG list or ZIP.

## Saved Folders

- Logos: `data\logos`
- Exports: the folder shown in the app under Preview and export. By default it is `data\exports` inside the app folder.

## Updates

The app has a Check Update button. It reads `update.json` from this GitHub repo and opens the portable ZIP download link when the version is newer.

For a new release, rebuild `PrintNewsStudio Portable.zip`, replace the ZIP in the repo, and update the version in both `package.json` and `update.json`.
