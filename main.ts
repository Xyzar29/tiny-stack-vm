// tiny-stack-vm: a faithful interpreter of make.fun's tiny stack ISA (v1).
// One run answers every instance of a set: for each /input/<id>/ it reads
// program.bin + input.bin, runs the bytecode, and writes /output/<id>/stdout.bin
// (exactly the bytes the program wrote) and /output/<id>/exit.txt (exit code
// 0-255). 32-bit wrapping integers, 256-value data stack, 64-deep call stack,
// 256 words of memory, 1,000,000-step and 65,536-byte output limits, ten traps
// with their exit codes. Every rule follows ISA.md; the kit's reference VM is
// the rule where the page could be read two ways. Differentially tested
// against that VM on thousands of drawn programs.
import { chmodSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// [opcode, immediate bytes, pops, pushes] for every opcode of the ISA.
const OPS = [
  [0, 0, 0, 0], [1, 1, 0, 1], [2, 4, 0, 1], [3, 0, 1, 0], [4, 0, 1, 2],
  [5, 0, 2, 2], [6, 0, 2, 3], [7, 0, 3, 3],
  [16, 0, 2, 1], [17, 0, 2, 1], [18, 0, 2, 1], [19, 0, 2, 1], [20, 0, 2, 1],
  [21, 0, 2, 1], [22, 0, 2, 1], [23, 0, 1, 1], [24, 0, 2, 1], [25, 0, 2, 1],
  [26, 0, 2, 1], [27, 0, 1, 1], [28, 0, 2, 1], [29, 0, 2, 1], [30, 0, 2, 1],
  [32, 0, 2, 1], [33, 0, 2, 1], [34, 0, 2, 1],
  [48, 2, 0, 0], [49, 2, 1, 0], [50, 2, 1, 0], [51, 2, 0, 0], [52, 0, 0, 0],
  [64, 0, 1, 1], [65, 0, 2, 0],
  [80, 0, 1, 0], [81, 0, 1, 0], [82, 0, 0, 1], [83, 0, 1, 0],
];
const BY = [];
for (const q of OPS) BY[q[0]] = q;

function run(p, u) {
  const D = new Int32Array(256); // data stack
  const C = new Int32Array(64); // call stack
  const M = new Int32Array(256); // memory, all zero
  const o = new Uint8Array(65536);
  let s = 0, c = 0, n = 0, ip = 0, pc = 0, t = 0;
  const end = (x) => [o.slice(0, n), x];
  for (;;) {
    if (t === 1000000) return end(10);
    if (pc < 0 || pc >= p.length) return end(9);
    const op = p[pc], d = BY[op];
    if (!d) return end(5);
    if (pc + d[1] >= p.length) return end(9);
    t++;
    const nx = pc + 1 + d[1];
    if (s < d[2]) return end(2);
    if (s - d[2] + d[3] > 256) return end(3);
    pc = nx;
    switch (op) {
      case 0: return end(0);
      case 1: D[s++] = (p[nx - 1] << 24) >> 24; break; // PUSH8, sign-extended
      case 2: D[s++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 3: s--; break;
      case 4: D[s] = D[s - 1]; s++; break;
      case 5: { const v = D[s - 1]; D[s - 1] = D[s - 2]; D[s - 2] = v; break; }
      case 6: D[s] = D[s - 2]; s++; break;
      case 7: { const a = D[s - 3]; D[s - 3] = D[s - 2]; D[s - 2] = D[s - 1]; D[s - 1] = a; break; }
      case 23: D[s - 1] = -D[s - 1] | 0; break; // NEG wraps: -INT_MIN is INT_MIN
      case 27: D[s - 1] = ~D[s - 1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 28: case 29: case 30: case 32: case 33: case 34: {
        const b = D[s - 1], a = D[s - 2];
        let r;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b); // low 32 bits of the exact product
        else if (op === 19) {
          if (b === 0) return end(4);
          r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
        } else if (op === 20) {
          if (b === 0) return end(4);
          r = b === -1 ? 0 : (a % b) | 0;
        } else if (op === 21) {
          if (b === 0) return end(4);
          r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
        } else if (op === 22) {
          if (b === 0) return end(4);
          r = ((a >>> 0) % (b >>> 0)) | 0;
        } else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        s -= 2;
        D[s++] = r;
        break;
      }
      case 48: case 49: case 50: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let take = op === 48;
        if (op !== 48) { const v = D[--s]; take = op === 49 ? v === 0 : v !== 0; }
        if (take) pc = nx + rel;
        break;
      }
      case 51:
        if (c === 64) return end(7);
        C[c++] = nx;
        pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 52:
        if (c === 0) return end(8);
        pc = C[--c];
        break;
      case 64: {
        const a = D[s - 1];
        if (a < 0 || a >= 256) return end(6);
        D[s - 1] = M[a];
        break;
      }
      case 65: {
        const a = D[s - 1], v = D[s - 2];
        if (a < 0 || a >= 256) return end(6);
        s -= 2;
        M[a] = v;
        break;
      }
      case 80: { // PRINT: decimal, no newline
        const g = String(D[s - 1]);
        if (n + g.length > 65536) return end(11);
        s--;
        for (let k = 0; k < g.length; k++) o[n++] = g.charCodeAt(k);
        break;
      }
      case 81:
        if (n + 1 > 65536) return end(11);
        o[n++] = D[--s] & 255;
        break;
      case 82: D[s++] = ip < u.length ? u[ip++] : -1; break;
      case 83: return end(D[--s] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
  const d = join(O, id);
  mkdirSync(d, { recursive: true });
  chmodSync(d, 0o755); // the grader collects outputs as another user
  writeFileSync(join(d, 'stdout.bin'), r[0]);
  chmodSync(join(d, 'stdout.bin'), 0o644);
  writeFileSync(join(d, 'exit.txt'), r[1] + '\n');
  chmodSync(join(d, 'exit.txt'), 0o644);
}
