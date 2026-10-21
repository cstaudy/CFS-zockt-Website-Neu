/* R178: deterministic, fully OFFLINE, synthetic event transport stress model.
   This module is NOT connected to the CFSON server, OBS, TikTok or Twitch. */
(function (root) {
  "use strict";
  const SCENARIOS = Object.freeze({
    normal: Object.freeze({label:"Normalbetrieb", arrivals:12, capacity:28, outageStart:-1, outageEnd:-1, ttl:2500}),
    storm: Object.freeze({label:"Chat-Ansturm", arrivals:75, capacity:13, outageStart:-1, outageEnd:-1, ttl:2500}),
    outage: Object.freeze({label:"Verbindungsabbruch", arrivals:18, capacity:30, outageStart:18, outageEnd:55, ttl:1700}),
    slow: Object.freeze({label:"Langsame Verarbeitung", arrivals:30, capacity:7, outageStart:-1, outageEnd:-1, ttl:1700})
  });
  function positiveInt(value, fallback, min, max) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= min && n <= max ? n : fallback;
  }
  function run(options) {
    const opts = options || {};
    const scenario = Object.hasOwn(SCENARIOS, opts.scenario) ? opts.scenario : "normal";
    const plan = SCENARIOS[scenario];
    const count = positiveInt(opts.count, 3000, 100, 20000);
    const maxQueue = positiveInt(opts.maxQueue, 180, 8, 1024);
    const seed = positiveInt(opts.seed, 178, 1, 2147483647);
    let randomState = seed;
    function rand() { randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5; return (randomState >>> 0) / 4294967296; }
    const queue = [];
    const recent = new Map();
    let generated=0, delivered=0, duplicate=0, overflow=0, expired=0, failed=0, retried=0, peak=0;
    let latencySum=0, maxLatency=0, processingErrors=0, recovered=0, highPrioritySaved=0;
    let lastId=null, tick=0, remaining=0;
    const errors = [];
    function forgetOld(now) { for(const [id, until] of recent) if(until <= now) recent.delete(id); }
    function pushEvent(now) {
      generated++;
      const id = generated % 23 === 0 && lastId ? lastId : `demo-${generated}`;
      if (recent.has(id) && recent.get(id) > now) { duplicate++; return; }
      lastId = id;
      recent.set(id, now + 5000);
      const r=rand();
      const type=r < .82 ? "chat" : r < .94 ? "follow" : "goal";
      const event={id,type,created:now,ready:now,attempt:0};
      if(queue.length >= maxQueue) {
        if (type !== "chat") {
          const pos=queue.findIndex(item => item.type === "chat");
          if(pos >= 0) {queue.splice(pos,1);overflow++;highPrioritySaved++;}
          else {overflow++;return;}
        } else {overflow++;return;}
      }
      queue.push(event);
      if(queue.length > peak)peak=queue.length;
    }
    // Virtual time: 100 ms/tick, not wall-clock performance or browser FPS.
    const lastArrivalTick=Math.ceil(count / plan.arrivals);
    const maxTick=lastArrivalTick+250;
    let lastOfflineTick=-1;
    for(tick=0;tick<=maxTick;tick++) {
      const now=tick*100;
      forgetOld(now);
      for(let i=0;i<plan.arrivals && generated < count;i++) pushEvent(now);
      // Old events must expire even while offline; do not replay stale notifications.
      for(let i=queue.length-1;i>=0;i--) if(now-queue[i].created > plan.ttl){queue.splice(i,1);expired++;}
      const offline=tick>=plan.outageStart && tick<plan.outageEnd;
      if(offline){lastOfflineTick=tick;continue;}
      if(lastOfflineTick>=0 && tick===lastOfflineTick+1) recovered++;
      let budget=plan.capacity;
      // No unbounded retry loop: each delivery attempt consumes capacity.
      let cursor=0;
      while(budget>0 && cursor<queue.length) {
        const evt=queue[cursor];
        if(evt.ready>now){cursor++;continue;}
        budget--;
        // Deterministic synthetic transient sink error (not a network call).
        const transient=(evt.id.endsWith('7') && evt.attempt===0);
        if(transient){
          processingErrors++;
          evt.attempt++;
          evt.ready=now+200;
          retried++;
          cursor++;
          continue;
        }
        queue.splice(cursor,1);
        delivered++;
        const latency=now-evt.created;
        latencySum+=latency;
        maxLatency=Math.max(maxLatency,latency);
      }
      if(generated === count && queue.length===0)break;
    }
    remaining=queue.length;
    const accounted=delivered+duplicate+overflow+expired+failed+remaining;
    if(accounted!==generated) errors.push("event_count_invariant");
    if(peak>maxQueue || remaining>maxQueue) errors.push("queue_bound_invariant");
    if(maxLatency>plan.ttl) errors.push("stale_delivery_invariant");
    if(scenario==='outage' && recovered!==1) errors.push("recovery_invariant");
    return Object.freeze({
      schema:"cfson-r178-synthetic-event-load-v1", type:"offline-model-not-server-benchmark",
      scenario, scenarioLabel:plan.label, seed, tickMs:100, simulatedSeconds:Math.round(tick/10*10)/10,
      config:{count,maxQueue,ttlMs:plan.ttl,eventsPerTick:plan.arrivals,deliveriesPerTick:plan.capacity},
      metrics:{generated,delivered,duplicatesSuppressed:duplicate,backpressureDropped:overflow,expiredDropped:expired,
        terminalFailures:failed,retried,syntheticProcessingErrors:processingErrors,queuePeak:peak,queueRemaining:remaining,
        highPrioritySaved,recoveredAfterOutage:recovered,averageDelayMs:delivered?Math.round(latencySum/delivered):0,
        maxDelayMs:maxLatency,accountedEvents:accounted},
      invariantsPassed:errors.length===0, errors, realInfrastructureTested:false,
      realNetworkTested:false, realOBSPerformanceMeasured:false, productionRelease:"HOLD / NO-GO"
    });
  }
  const api=Object.freeze({run,scenarios:SCENARIOS});
  if(typeof module !== "undefined" && module.exports)module.exports=api;
  else root.CfsonStabilityR178=api;
})(typeof globalThis !== "undefined" ? globalThis : this);
