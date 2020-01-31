[![Built with pwa–starter–kit](https://img.shields.io/badge/built_with-pwa–starter–kit_-blue.svg)](https://github.com/Polymer/pwa-starter-kit "Built with pwa–starter–kit")
[![Build status](https://api.travis-ci.org/Polymer/pwa-starter-kit.svg?branch=template-minimal-ui)](https://travis-ci.org/Polymer/pwa-starter-kit)

# Progressive Web Audio Player

A minimalistic node server and PWA to play audio files online (or cache them for offline use). It currently authenticates via OAUTH2 with a nextcloud instance.

# Features

- Precache current file and 3 neighbours
- Pin files to prevent automatic deletion
- Remembers the file last played in every folder
- Configurable Cache Size

# Usage

Just map your audio directory into the accompanying docker container and configure your nextcloud instance for authentication (add a oauth2 client under Nextcloud/Settings/Security, copy ID and SECRET into accompanying .env.sample file, hand in env file to docker)

Example docker-compose snippet:

    env_file: .env
    volumes:
      - /path/to/music/on/local/pc:/fs/music:ro

# Rationale

I got sick of complex setups with subsonic/ampache/plex and the like. All I needed was a filename based player (no tag databases, no cover images, no gimmicks), so I wrote my own.
