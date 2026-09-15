// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { readFile, writeFile } from "node:fs/promises";
import { deflateRawSync } from "node:zlib";

const FIXED_DOS_DATE = 0x0021;
const FIXED_DOS_TIME = 0x0000;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let number = 0; number < 256; number += 1) {
    let value = number;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[number] = value >>> 0;
  }
  return table;
})();

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value) {
  const buffer = Buffer.allocUnsafe(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function uint32(value) {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

export async function createZip(outputPath, entries) {
  const sorted = [...entries].sort((left, right) => left.name.localeCompare(right.name));
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of sorted) {
    const name = String(entry.name).replaceAll("\\", "/");
    const nameBuffer = Buffer.from(name, "utf8");
    const source = entry.data ?? (await readFile(entry.path));
    const data = Buffer.isBuffer(source) ? source : Buffer.from(source);
    const compressed = deflateRawSync(data, { level: 9 });
    const useDeflate = compressed.length < data.length;
    const body = useDeflate ? compressed : data;
    const method = useDeflate ? 8 : 0;
    const checksum = crc32(data);

    const localHeader = Buffer.concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0x0800),
      uint16(method),
      uint16(FIXED_DOS_TIME),
      uint16(FIXED_DOS_DATE),
      uint32(checksum),
      uint32(body.length),
      uint32(data.length),
      uint16(nameBuffer.length),
      uint16(0),
      nameBuffer,
    ]);
    localChunks.push(localHeader, body);

    const centralHeader = Buffer.concat([
      uint32(0x02014b50),
      uint16(0x0314),
      uint16(20),
      uint16(0x0800),
      uint16(method),
      uint16(FIXED_DOS_TIME),
      uint16(FIXED_DOS_DATE),
      uint32(checksum),
      uint32(body.length),
      uint32(data.length),
      uint16(nameBuffer.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0o100644 << 16),
      uint32(offset),
      nameBuffer,
    ]);
    centralChunks.push(centralHeader);
    offset += localHeader.length + body.length;
  }

  const central = Buffer.concat(centralChunks);
  const end = Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(sorted.length),
    uint16(sorted.length),
    uint32(central.length),
    uint32(offset),
    uint16(0),
  ]);
  await writeFile(outputPath, Buffer.concat([...localChunks, central, end]));
}

export async function listZip(path) {
  const buffer = await readFile(path);
  const names = [];
  let offset = 0;
  while (offset + 4 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature === 0x02014b50) {
      const nameLength = buffer.readUInt16LE(offset + 28);
      const extraLength = buffer.readUInt16LE(offset + 30);
      const commentLength = buffer.readUInt16LE(offset + 32);
      const nameStart = offset + 46;
      names.push(buffer.subarray(nameStart, nameStart + nameLength).toString("utf8"));
      offset = nameStart + nameLength + extraLength + commentLength;
      continue;
    }
    offset += 1;
  }
  return names;
}

function locateCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return null;
}

export async function readZipEntry(path, entryName) {
  const buffer = Buffer.isBuffer(path) ? path : await readFile(path);
  const eocdOffset = locateCentralDirectory(buffer);
  if (eocdOffset === null) throw new Error("ZIP end-of-central-directory not found.");
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
  const localOffset = iterateCentral(buffer, centralDirOffset, entryName);
  const localSignature = buffer.readUInt32LE(localOffset);
  if (localSignature !== 0x04034b50) throw new Error(`Local header missing for ${entryName}.`);
  const method = buffer.readUInt16LE(localOffset + 8);
  const compressedSize = buffer.readUInt32LE(localOffset + 18);
  const nameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + compressedSize);
  if (method === 0) return Buffer.from(data);
  if (method === 8) {
    const { inflateRawSync } = await import("node:zlib");
    return inflateRawSync(data);
  }
  throw new Error(`Unsupported compression method ${method} for ${entryName}.`);
}

function iterateCentral(buffer, fromOffset, entryName) {
  let offset = fromOffset;
  while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x02014b50) {
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    if (name === entryName) return buffer.readUInt32LE(offset + 42);
    offset = nameStart + nameLength + extraLength + commentLength;
  }
  throw new Error(`Entry ${entryName} not found in ZIP.`);
}
