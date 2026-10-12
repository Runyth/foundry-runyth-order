// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildLauncherCard, createSceneControlTool } from "../src/ui/launchers.mjs";
import { sanitizeHubPosition } from "../src/ui/window-position.mjs";

function domStub() {
  const elementTree = [];
  function createElement(tag) {
    const element = {
      tag,
      className: "",
      type: "",
      textContent: "",
      dataset: {},
      children: [],
      append(...childNodes) {
        element.children.push(...childNodes);
      },
      concatenatedText() {
        return element.children.map((child) => (typeof child === "string" || typeof child === "object" ? child.textContent : child)).join("");
      },
    };
    elementTree.push(element);
    return element;
  }
  function createTextNode(text) {
    return { text, textContent: text };
  }
  return { document: { createElement, createTextNode }, elementTree };
}

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

test("launcher source inserts localized text with text-safe DOM nodes only", async () => {
  const source = await readFile(new URL("../src/ui/launchers.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /innerHTML/u);
  assert.doesNotMatch(source, /insertAdjacentHTML/u);
  assert.match(source, /buildLauncherCard\(document, \{[^}]*game\.i18n\.localize/u);
});

test("launcher card builder treats localized values as text, not markup", () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const { document, elementTree } = domStub();
  const card = buildLauncherCard(document, {
    title: `Runyth Order ${hostile}`,
    summary: hostile,
    label: hostile,
  });
  assert.equal(card.tag, "section");
  assert.equal(card.className, "runyth-order-launcher");
  const [heading, summary, button] = card.children;
  assert.equal(heading.tag, "h3");
  assert.equal(heading.children[0].className, "fa-solid fa-diagram-project");
  assert.equal(heading.children[1].textContent, `Runyth Order ${hostile}`, "the title is stored as a literal text node");
  assert.equal(summary.textContent, hostile, "the summary stays an element text property");
  assert.equal(button.tag, "button");
  assert.equal(button.dataset.action, "open-rules-hub");
  assert.equal(button.children[0].className, "fa-solid fa-arrow-up-right-from-square");
  assert.equal(button.children[1].textContent, hostile, "the label is stored as a literal text node");
  assert.ok(!elementTree.some((element) => element.tag === "img"), "no markup may be parsed from localized values");
});
