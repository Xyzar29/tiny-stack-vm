[![make.fun](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/Xyzar29/tiny-stack-vm/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/Xyzar29/tiny-stack-vm/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)

# tiny-stack-vm

A faithful interpreter of make.fun's tiny stack ISA for the [22 November 2026 bounty](https://make.fun/bounty/tiny-stack-vm-01-run-20261122) ($100). One run of `main.ts` (Node 22) answers all 40 instances: reads `/input/<id>/program.bin` + `input.bin`, writes `stdout.bin` and `exit.txt`. Wrapping 32-bit integers, 256-value stack, 64-deep call stack, 256 words of memory, step/output limits, all ten traps. Verified against the kit's reference VM on thousands of drawn programs, 0 mismatches.
