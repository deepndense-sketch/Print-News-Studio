# Print News Studio

Local browser app for quick news export work. It accepts Excel-style news rows, keeps source logos, previews each news item, and exports PNG files or a ZIP.

## Start

For the portable release, unzip `PrintNewsStudio Portable.zip` and double-click:

```text
PrintNewsStudio.exe
```

After Extract All, `PrintNewsStudio.exe`, `public`, `data`, and `runtime` should be in the same folder.

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

The portable launcher starts at port `4862`. If that port is already busy on a user's computer, it automatically tries the next open local port and opens that address.

## Main Workflow

1. Copy rows from Excel.
2. Paste into the Excel paste box.
3. The Priority News List is automatically set to a `Priority News List` folder beside the app. Click Change List Path only if you want to change the Word-file location.
4. Use Add empty list when you want to start with one blank news section.
5. Check generated news sections.
6. Paste missing source logos into the logo boxes.
7. Edit text directly. Bold text is highlighted light yellow without adding extra weight.
8. Use Sub Text for a smaller Times New Roman line under the headline.
9. Choose the Location folder in Preview and export.
10. Render the PNG list or ZIP.

## Priority News List

The Priority News List automatically uses a separate timestamped file such as `Priority News List\Priority News List YYYY-MM-DD HH-MM-SS.docx` beside the app, with its full active path shown beside Change List Path. Every new app session gets a different file; if a filename collision occurs, the app adds `-2`, `-3`, and so on. Click Change List Path only to choose a different location. The selected file and its accumulated entries remain active until Print News Studio is closed. Every item successfully saved by Render PNG List is added as:

```text
#202002 Iran military announces halt to operation against Israel (The Straits Times)
```

The complete line is Times New Roman 22 pt, and only `#202002` is bold. Reopening the location button during the same session writes the accumulated list to the newly selected file.

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
