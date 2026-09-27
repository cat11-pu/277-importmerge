// importrun.js：按应用预算导入并留账
import { priorityOf, compare } from "./sources.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function cloneState(state) {
  const source = state || { values: {}, conflicts: {}, ledger: [], applied: [] };
  const next = { values: {}, conflicts: {}, ledger: [], applied: (source.applied || []).slice() };
  Object.keys(source.values || {}).forEach(function (key) {
    next.values[key] = source.values[key].slice();
  });
  Object.keys(source.conflicts || {}).forEach(function (key) {
    next.conflicts[key] = source.conflicts[key].slice();
  });
  (source.ledger || []).forEach(function (entry) {
    next.ledger.push(entry.slice());
  });
  return next;
}

function tagOf(source, key, value) {
  return JSON.stringify([source, key, value]);
}

function applyImport(state, sources, source, key, value) {
  if (!Object.prototype.hasOwnProperty.call(state.values, key)) {
    state.values[key] = [value, source];
    return;
  }
  const current = state.values[key];
  if (current[1] === source) {
    state.values[key] = [value, source];
    return;
  }
  const order = compare(priorityOf(sources, source), priorityOf(sources, current[1]));
  if (order > 0) {
    state.values[key] = [value, source];
    delete state.conflicts[key];
  } else if (order === 0) {
    if (state.conflicts[key]) state.conflicts[key].push(value);
    else state.conflicts[key] = [current[0], value];
  }
}

function checkEvent(spec, event) {
  const eventCode = spec.event_error_code || "E_BAD_EVENT";
  const sourceCode = spec.source_error_code || "E_NO_SOURCE";
  if (!event || typeof event !== "object" || event.kind !== "import"
      || typeof event.source !== "string" || typeof event.key !== "string"
      || event.value === undefined) {
    fail(eventCode, "事件不合法");
  }
  const sources = spec.sources || {};
  if (!Object.prototype.hasOwnProperty.call(sources, event.source)) {
    fail(sourceCode, "源不在源表里: " + event.source);
  }
}

export function step(spec) {
  const state = cloneState(spec.state);
  const events = spec.events || [];
  const sources = spec.sources || {};
  const carried = state.ledger.length;
  let budget = spec.budget == null ? carried + events.length : spec.budget;
  let applied = 0;

  while (budget > 0 && state.ledger.length > 0) {
    const entry = state.ledger.shift();
    applyImport(state, sources, entry[0], entry[1], entry[2]);
    state.applied.push(tagOf(entry[0], entry[1], entry[2]));
    budget -= 1;
    applied += 1;
  }

  events.forEach(function (event) {
    if (event && typeof event === "object"
        && state.applied.indexOf(tagOf(event.source, event.key, event.value)) !== -1) {
      return;
    }
    checkEvent(spec, event);
    if (budget > 0) {
      applyImport(state, sources, event.source, event.key, event.value);
      state.applied.push(tagOf(event.source, event.key, event.value));
      budget -= 1;
      applied += 1;
    } else {
      state.ledger.push([event.source, event.key, event.value]);
    }
  });

  return { state: state, applied: applied, ledger_before: state.ledger.length,
           ledger: state.ledger.map(function (entry) { return entry.slice(); }),
           judged: applied, judged_bound: carried + events.length };
}

export function close(spec) {
  const state = cloneState(spec.state);
  const sources = spec.sources || {};
  let catchup = 0;
  while (state.ledger.length > 0) {
    const entry = state.ledger.shift();
    applyImport(state, sources, entry[0], entry[1], entry[2]);
    state.applied.push(tagOf(entry[0], entry[1], entry[2]));
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
