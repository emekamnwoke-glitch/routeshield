# Architecture Change Log

Every change to a baselined architecture artefact, newest first. Significant changes link their ADR.

| Date | ID | Class | Change | Origin | Record |
|---|---|---|---|---|---|
| 2026-09-16 | CH-004 | Minor | Repository made public; GitHub Pages confirmed as host; R-011 closed | ADR-0008 review trigger resolved without firing | [Risk register](../phase-f-migration-planning/risk-register.md#1-project-risks) |
| 2026-09-16 | CH-003 | Significant | Stage Two milestone order: *Notifications* (v1.4.0) moved before *Control Dashboard* (v1.5.0) | Phase F — Phase E tension about passengers | [Release plan §2](../phase-f-migration-planning/roadmap-and-release-plan.md#departures-from-the-originally-suggested-milestones) |
| 2026-09-16 | CH-002 | Significant | DD-6 Decision split; new DD-13 Authority | Phase C application architecture | [Application components §2.2](../phase-c-information-systems/application-architecture/application-components.md#22-authority-leaves-dd-6-decision) |
| 2026-09-16 | CH-001 | Significant | DD-5 Response split into DD-5a Impact, DD-5b Options, DD-5c Recommendation | Phase C application architecture — conflict between one-writer-per-domain and BR-011 | [Application components §2.1](../phase-c-information-systems/application-architecture/application-components.md#21-dd-5-response-is-split-into-three) |

CH-001 and CH-002 are changes within an open phase, caught by a later sub-phase before baseline. CH-003 changes a plan, not a design. None of them originated in implementation, so none of them satisfies Phase H's exit condition — they show the process working at small scale, not the feedback loop the charter requires.
