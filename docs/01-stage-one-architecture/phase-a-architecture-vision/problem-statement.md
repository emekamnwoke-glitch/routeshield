# Problem Statement

| | |
|---|---|
| **Phase** | A — Architecture Vision |
| **Document version** | 1.0 |
| **Status** | Baseline |

---

## 1. The problem in one paragraph

When an urban bus network is disrupted without warning, the operator's response is assembled by hand under time pressure. A controller learns of the incident, works out from experience which services are affected, decides what each should do instead, and contacts drivers one at a time. Passenger-facing information updates last, if at all. This works acceptably when one route is affected and degrades sharply when several are, because the process is sequential and the controller is the sequence. The people who most need to know — passengers standing at stops that are about to be skipped — are the last to find out, and frequently never do.

## 2. What actually goes wrong

The failure is not that anyone makes bad decisions. Controllers are experienced and their judgement is usually sound. The failure is structural, and it has four parts.

### 2.1 The process is sequential where the problem is parallel

A disruption affects many services simultaneously. A controller handles them one at a time. The gap between those two facts is the delay, and it grows with the size of the disruption — which means the system performs worst exactly when it is needed most.

### 2.2 Impact assessment depends on memory

Working out which services are affected means knowing which routes pass through the closed section, where each vehicle currently is, which ones have already passed, and which are about to enter. That is a spatial query over live data, performed from memory, under pressure. Experienced controllers do it well. They do not do it exhaustively, and nobody could.

### 2.3 Information reaches people in the wrong order

The order in which people learn about a disruption is roughly the reverse of how urgently they need to know:

| Order | Who learns | When they need to know |
|---|---|---|
| 1st | Controller | When deciding |
| 2nd | Driver | Before the diversion point |
| 3rd | Passengers on board | Before their stop is skipped |
| Last, if ever | Passengers waiting at a stop | **Before they decide to wait** |

The passenger waiting at a stop that will not be served has the most time-critical information need of anyone involved, because their alternative options expire while they wait. They are served last.

### 2.4 The reasoning is not retained

Once the disruption clears, what remains is that services were diverted. Why *those* stops were skipped, what alternatives were considered, what the controller knew at the time — none of it is captured in a form that survives the shift. This has three consequences: the decision cannot be explained afterwards to a passenger, an executive or a regulator; the operator cannot tell good decisions from lucky ones; and nothing is learned, so the same corridor is re-solved from scratch the next time it closes.

## 3. Why it has not already been solved

The obvious answer — use a mapping application — does not work, and understanding why is what defines this problem.

A general-purpose router optimises for a vehicle reaching a destination quickly. A bus is not trying to reach a destination quickly. It is trying to serve a sequence of stops. A router will confidently produce a fast detour that bypasses twelve stops, which for a bus network is a worse outcome than a slow detour serving ten of them. The optimisation target is wrong at the root, and no amount of tuning corrects for optimising the wrong quantity.

A bus-specific solution has to reason about stop sequences, stop importance, vehicle-to-trip assignment, following services that could absorb skipped stops, physical feasibility for a twelve-metre vehicle, and the schedule the network is trying to recover to. Those are not features on top of routing. They are a different problem that happens to contain routing as a component.

## 4. The core challenge

Restated from the baseline concept, which puts it well:

> How can an operator immediately and intelligently reroute its services when a disruption occurs — skipping the fewest stops possible, informing drivers in real time, and keeping passengers connected to their journey — without relying on manual intervention?

One clarification is needed, because as written the last clause conflicts with the rest of the concept and with [P-1](../methodology/architecture-principles.md#p-1--the-human-decides). "Without relying on manual intervention" is read here as *without relying on manual **assembly** of the response* — the spatial reasoning, the option generation, the ranking, the message distribution. The decision itself stays with a human. Automating the analysis and automating the authority are different propositions, and only the first is in scope.

This distinction is developed into an explicit autonomy model in Phase B.

## 5. What a solution must be true of

Derived from the four structural failures above, and carried into Phase B as business requirements:

| # | The solution must | Addresses |
|---|---|---|
| 1 | Assess impact across all affected services at once, not sequentially | §2.1 |
| 2 | Determine affected services from live position and network data rather than recall | §2.2 |
| 3 | Reach passengers at affected stops on a timescale that preserves their alternatives | §2.3 |
| 4 | Retain the decision and its reasoning in a form that survives the shift | §2.4 |
| 5 | Optimise for service continuity, not vehicle travel time | §3 |
| 6 | Leave accountability for the decision with an identifiable person | §4 |
| 7 | Continue to produce useful output when inputs are missing or stale | §6 below |

## 6. The conditions under which this must work

The operating conditions are adversarial in a specific way: **the circumstances that create the need are correlated with the circumstances that degrade the inputs.** A flood that closes a road also disables roadside equipment. An incident that triggers a network-wide response also spikes load on every feed. A protest that blocks a corridor also fills it with people whose phones saturate the local cell.

A design that assumes healthy inputs is a design that is unavailable precisely when it is needed. This is why [P-3](../methodology/architecture-principles.md#p-3--degrade-do-not-fail) exists, and why resilience is a functional concern here rather than an operational one.

## 7. What is not the problem

Stated because solutions to adjacent problems are frequently proposed in place of solutions to this one:

- **Not a prediction problem.** Knowing that a corridor is likely to be blocked next Tuesday is useful, but it is not what is missing. What is missing is the response when it *is* blocked.
- **Not a data availability problem.** The inputs largely exist somewhere in the operator's estate. They are not assembled into a decision at the moment one is needed.
- **Not a driver performance problem.** Drivers execute correctly on the instructions they receive. The delay is upstream of them.
- **Not a scheduling problem.** The timetable is fine. The problem is what to do when the network underneath the timetable changes without notice.
- **Not solved by more controllers.** Adding controllers parallelises the work but multiplies the coordination, and each controller still reasons from memory. It raises the ceiling without changing the shape of the failure.

## 8. Consequence of not solving it

| Consequence | Bears the cost |
|---|---|
| Passengers stranded without information, alternatives already expired | Passengers, disproportionately those with fewest options |
| Service withdrawn rather than diverted, because diverting takes too long to work out | Passengers on affected corridors |
| Controllers making high-consequence decisions under load without support | Control room staff |
| Decisions that cannot be explained afterwards | Operator, in its dealings with passengers and regulator |
| The same corridor re-solved from nothing each time it closes | Operator, continuously |
| Trust eroding in the part of the service that most determines whether it is used at all | The operator's long-term ridership |

That last row is the one that matters. Public transport is used because it is expected to arrive. Disruption is when that expectation is tested, and it is currently when it is least reliably met.
