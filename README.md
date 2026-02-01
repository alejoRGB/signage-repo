# Digital Signage Monorepo

This repository contains both the web dashboard and the player software.

## Structure

- **/web**: Next.js Dashboard Application (Management Interface)
- **/player**: Python Player Service (Raspberry Pi Client)

## Deployment

### Web
Deploy the `/web` directory to Vercel. Ensure Root Directory is set to `web`.

### Player
Run the installer on your Raspberry Pi:
```bash
curl -sL https://raw.githubusercontent.com/alejoRGB/signage-repo/master/player/setup_device.sh | bash
```
