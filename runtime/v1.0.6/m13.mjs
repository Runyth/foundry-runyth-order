// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
const DEFAULT_WIDTH = 920;
const DEFAULT_HEIGHT = 720;
const MIN_WIDTH = 420;
const MIN_HEIGHT = 360;
const VIEWPORT_MARGIN = 16;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function sanitizeHubPosition(
  position = {},
  viewport = globalThis.window ?? {},
  defaults = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
) {
  const viewportWidth = Math.max(320, finiteNumber(viewport.innerWidth) ?? defaults.width);
  const viewportHeight = Math.max(240, finiteNumber(viewport.innerHeight) ?? defaults.height);
  const maximumWidth = Math.max(240, viewportWidth - VIEWPORT_MARGIN);
  const maximumHeight = Math.max(200, viewportHeight - VIEWPORT_MARGIN);
  const minimumWidth = Math.min(MIN_WIDTH, maximumWidth);
  const minimumHeight = Math.min(MIN_HEIGHT, maximumHeight);

  const requestedWidth = finiteNumber(position.width) ?? defaults.width;
  const requestedHeight = finiteNumber(position.height) ?? defaults.height;
  const width = Math.round(clamp(requestedWidth, minimumWidth, maximumWidth));
  const height = Math.round(clamp(requestedHeight, minimumHeight, maximumHeight));

  const maximumLeft = Math.max(0, viewportWidth - width);
  const maximumTop = Math.max(0, viewportHeight - height);
  const requestedLeft = finiteNumber(position.left);
  const requestedTop = finiteNumber(position.top);
  const left = Math.round(
    clamp(requestedLeft ?? (viewportWidth - width) / 2, 0, maximumLeft),
  );
  const top = Math.round(
    clamp(requestedTop ?? (viewportHeight - height) / 2, 0, maximumTop),
  );

  return { left, top, width, height };
}

export const HUB_POSITION_DEFAULTS = Object.freeze({
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
});
