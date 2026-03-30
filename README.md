
# Docker Space Monitor

Displays Docker disk usage directly in the Cinnamon panel.

## Features

* Shows selected Docker storage metric
* Hover tooltip shows full breakdown
* Configurable refresh interval
* Toggle total usage
* Color thresholds for quick visibility
* Quick cleanup action

## Requirements

* Docker installed and available in PATH

## Installation

Copy folder to:
~/.local/share/cinnamon/applets/

Then enable in Cinnamon Settings → Applets

## Notes

Uses:
docker system df --format '{{json .}}'
