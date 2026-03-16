# PBXware Live Transcription

A simple tool that shows live call transcriptions from PBXware in a real-time dashboard. You can run it on your own server to see caller and callee speech as it happens.

## PBXware Requirements

Before using this tool, make sure the following settings are enabled on your **master tenant** in PBXware:

- **Enable Stereo Recordings**: Yes
- **Stereo Recording Format**: ulaw

Without these settings, PBXware will not send transcription data.

## Getting Started

1. Download the right file for your system from the [Releases](../../releases/latest) page:

   | Your system | Download this file |
   |---|---|
   | Linux (most servers) | `pbxware-live-transcription-linux-x64` |
   | Linux (older CPU / "Illegal instruction" error) | `pbxware-live-transcription-linux-x64-baseline` |
   | Linux on ARM (Raspberry Pi, etc.) | `pbxware-live-transcription-linux-arm64` |
   | Mac (Intel) | `pbxware-live-transcription-darwin-x64` |
   | Mac (Apple Silicon / M1–M4) | `pbxware-live-transcription-darwin-arm64` |
   | Windows | `pbxware-live-transcription-windows-x64.exe` |

2. Open a terminal and run it:

   **Linux / Mac:**
   ```bash
   chmod +x pbxware-live-transcription-linux-x64
   ./pbxware-live-transcription-linux-x64
   ```

   **Windows** — double-click the `.exe` file, or run in Command Prompt:
   ```
   pbxware-live-transcription-windows-x64.exe
   ```

3. Open `http://localhost:3000` in your browser — you'll see the dashboard.

4. In PBXware, set the **WebSocket Callback URL** to:
   ```
   ws://your-server-ip:3000/ws
   ```

That's it! Live transcriptions will appear in the dashboard as calls happen.

## Optional Settings

You can configure the tool using environment variables. Set them before the command:

**Linux / Mac:**
```bash
PASSWORD=secret STORAGE=sqlite ./pbxware-live-transcription-linux-x64
```

**Windows (Command Prompt):**
```
set PASSWORD=secret
set STORAGE=sqlite
pbxware-live-transcription-windows-x64.exe
```

| Setting | Default | What it does |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `STORAGE` | `memory` | Set to `sqlite` to keep messages after restart |
| `DB_PATH` | `data/transcription.db` | Where to store the database file (only with `sqlite`) |
| `PASSWORD` | *(none)* | Set a password to protect the dashboard |
| `MAX_MESSAGES` | `500` | How many messages to keep |

### Password Protection

If you set a `PASSWORD`, the dashboard will show a login screen.

In PBXware, add the password to the WebSocket Callback URL as a query parameter:

```
ws://your-server-ip:3000/ws?token=your-password
```

---

## Advanced: Other Ways to Run

### From source (requires [Bun](https://bun.sh))

```bash
bun run src/index.ts
```

### Docker

```bash
docker build -t pbxware-live-transcription .
docker run -p 3000:3000 pbxware-live-transcription
```

### Docker Compose

```bash
docker compose up
```

Edit `docker-compose.yml` to configure settings.

### Compile from Source

```bash
bun build src/index.ts --compile --outfile pbxware-live-transcription
```

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Dashboard |
| `/ws` | WebSocket | Accepts transcription data from PBXware |
| `/history` | GET | List stored messages as JSON |
| `/history` | DELETE | Clear all messages |
| `/stream` | GET | Real-time message stream (SSE) |
