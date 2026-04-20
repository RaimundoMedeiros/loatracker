# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- License changed from AGPL-3.0-only to MIT

## [0.1.0] - 2026-04-20

Initial open-source release.

### Added

- Weekly raid tracker with completion, difficulty, and chest tracking for all current raids (Aegir, Brel, Mordum, Armoche, Kazeros, Serca)
- Multi-roster management with drag-and-drop reorder and sort options
- Friends roster sync via proxy or Supabase RPC with PIN-based security
- Custom tab with configurable columns (checkbox, text, textarea, counter) per roster
- Daily tracking for Guardian Raids, Chaos Dungeons, Field Boss, Chaos Gate, and Thaemine
- Auto-import characters from Lost Ark game database (encounters.db)
- Progressive Web App with service worker and offline support
- Auto raid update on focus and configurable interval
- Root open-source documentation and governance files (README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG)
- GitHub CI workflow for lint, typecheck, tests, and build
- Issue and pull request templates for contributions
- Environment template (.env.example) for local setup
