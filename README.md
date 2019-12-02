[![Built with pwa–starter–kit](https://img.shields.io/badge/built_with-pwa–starter–kit_-blue.svg)](https://github.com/Polymer/pwa-starter-kit "Built with pwa–starter–kit")
[![Build status](https://api.travis-ci.org/Polymer/pwa-starter-kit.svg?branch=template-minimal-ui)](https://travis-ci.org/Polymer/pwa-starter-kit)

# Progressive Web Audio Player

A minimalistic node server and PWA to play audio files online (or cache them for offline use).

# Features

- Precache current file and 3 neighbours
- Pin files to prevent automatic deletion (which doesn't exist yet)
- Remembers the file last played in every folder

# Usage

Just map your audio directory into the accompanying docker container and your are done.

Example docker-compose snippet:

    volumes:
      - /mnt/teracrypt/audio/music/modern:/fs/music:ro
      - /mnt/teracrypt/audio/audiobooks/de:/fs/audiobooks:ro

# Rationale

I got sick of complex setups with subsonic/ampache/plex and the like. All I needed was a filename based player (no tag databases, no cover images, no gimmicks), so I wrote my own.

## TODOs

- [x] Free space once the browser storage quota is reached
