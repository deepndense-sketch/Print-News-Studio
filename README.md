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
3. Use Add empty list when you want to start with one blank news section.
4. Check generated news sections.
5. Paste missing source logos into the logo boxes.
6. Edit text directly. Bold text is highlighted light yellow without adding extra weight.
7. Use Sub Text for a smaller Times New Roman line under the headline.
8. Choose the Location folder in Preview and export.
9. Render the PNG list or ZIP.

## Fonts

Copy headline font files into the font folder shown in the app, then reopen or save the folder path again. By default it is `data\fonts`, but users can click Choose or type any folder path in the Fonts line. Supported font files are `.ttf`, `.otf`, `.woff`, and `.woff2`.

The edit section has two headline font choices:

- Aulacese: used for news headlines that contain `//`. The first default is `BarlowCondensed-Bold`.
- English: used for the other headlines. The first default is `Poppins-Bold`; Random picks a font per news item.

Changing either dropdown saves that choice as the next default on that computer.

Date and source text keep the normal app font.

## Saved Folders

- Logos: `data\logos`
- Fonts: the folder shown in the app under Edit news list. By default it is `data\fonts` inside the app folder.
- Exports: the folder shown in the app under Preview and export. By default it is `data\exports` inside the app folder.

## Updates

The app has a Check Update button. It reads `update.json` from this GitHub repo and opens the portable ZIP download link when the version is newer.

For a new release, rebuild `PrintNewsStudio Portable.zip`, replace the ZIP in the repo, and update the version in both `package.json` and `update.json`.
