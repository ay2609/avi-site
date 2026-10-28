#!/bin/sh
# The player's board, for its walkthrough: KiCad's GLB export, packed into
# public/player-parts.bin by glb-to-parts.py with the parts KiCad has no model
# for (the cells, the OLED glass, the jack and the microSD socket) added from
# player-extras.json. Three library models the board names aren't in KiCad 10's
# library; their nearest equivalents (same package body) stand in.
#
#   scripts/player-board.sh "~/workspaces/kicad-projects/Tiny Music Player/Tiny Music Player.kicad_pcb"
#
# Needs kicad-cli (KICAD_CLI, default the macOS app's) and numpy.
set -eu
PCB="$1"
CLI="${KICAD_CLI:-/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli}"
MODELS="${KICAD_3D:-$(dirname "$(dirname "$CLI")")/SharedSupport/3dmodels}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

sed -e 's#EP3.5x3.5mm.step#EP3.7x3.7mm.step#' \
    -e 's#Oscillator.3dshapes/Oscillator_SMD_SiT_PQFN-4Pin_2.0x1.6mm.step#Crystal.3dshapes/Crystal_SMD_2016-4Pin_2.0x1.6mm.step#' \
    "$PCB" > "$TMP/board.kicad_pcb"
# The project's own models (the USB-C plug) resolve against its folder.
ln -s "$(dirname "$PCB")/pcb" "$TMP/pcb"
"$CLI" pcb export glb --subst-models --force -D KICAD10_3DMODEL_DIR="$MODELS" \
  -o "$TMP/board.glb" "$TMP/board.kicad_pcb"
python3 "$HERE/glb-to-parts.py" "$TMP/board.glb" "$TMP/board.kicad_pcb" "$HERE/../public/player-parts.bin" "$HERE/player-extras.json"
