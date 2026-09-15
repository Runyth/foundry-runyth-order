// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSceneControlTool } from "../src/ui/launchers.mjs";
import { sanitizeHubPosition } from "../src/ui/window-position.mjs";

test("creates a Foundry V13 SceneControlTool using onChange and explicit order", () => {
  const tool = createSceneControlTool({
    select: { order: 0 },
    target: { order: 5 },
  });
  assert.equal(tool.order, 6);
  assert.equal(tool.button, true);
  assert.equal(typeof tool.onChange, "function");
  assert.equal("onClick" in tool, false);
});

test("clamps saved Rules Hub geometry into the current viewport", () => {
  assert.deepEqual(
    sanitizeHubPosition(
      { left: 5000, top: -200, width: 1800, height: 1200 },
      { innerWidth: 1280, innerHeight: 720 },
    ),
    { left: 16, top: 0, width: 1264, height: 704 },
  );

  const small = sanitizeHubPosition({}, { innerWidth: 360, innerHeight: 300 });
  assert.equal(small.width, 344);
  assert.equal(small.height, 284);
  assert.equal(small.left, 8);
  assert.equal(small.top, 8);
});

test("runtime source uses the V13 Scene Controls contract and avoids V12 onClick", async () => {
  const source = await readFile(new URL("../src/ui/launchers.mjs", import.meta.url), "utf8");
  assert.match(source, /controls\?\.tokens/u);
  assert.match(source, /onChange/u);
  assert.doesNotMatch(source, /onClick\s*:/u);
  assert.doesNotMatch(source, /Array\.isArray\(controls\)/u);
});

test("Rules Hub operations do not force-render a closed window", async () => {
  const source = await readFile(new URL("../src/ui/rules-hub.mjs", import.meta.url), "utf8");
  assert.match(source, /if \(!this\.rendered\) return;/u);
  assert.doesNotMatch(source, /finally \{[\s\S]{0,100}render\(\{ force: true \}\)/u);
});
