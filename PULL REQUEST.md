# Pull Request: Fix item cooldown animation

## Base
Compared against `main` from `LB JS Demo`.

## Changes
- Clamps the cooldown fraction between 0 and 1.
- Fixes the needle rotation so it advances according to the actual progress.
- Removes the duplicated fixed line from the circular timer.

## Reason
The final state prevents incorrect rotations and odd visual overlays when the cooldown goes out of range.

## Verification
- Pending running `npm run type-check` on this isolated branch.
