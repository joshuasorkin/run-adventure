# docs/workflows/collect-item-by-passing-target.md

## Intent
When a runner passes near the active quest target, the item is automatically collected.

## Preconditions
- player session exists
- active quest leg exists
- quest leg has target place
- incoming location sample is valid

## Trigger
Server receives a GPS point for the active runner.

## Steps
1. validate request schema
2. persist location sample
3. normalize target place geometry
4. compute distance / pass condition
5. check idempotency against prior collection events
6. if threshold met, create collection event
7. update inventory
8. mark quest leg complete
9. emit next progression state
10. return updated quest state to client

## Edge cases
- duplicate GPS point
- GPS jitter causes rapid in/out threshold
- stale quest target
- provider returned inconsistent place data

## Required tests
- collects once when threshold crossed
- does not collect twice for duplicate submissions
- does not collect when outside threshold
- handles jitter near boundary safely